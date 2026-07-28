"""
GariLelo AI — PakWheels Scraper
Scrapes newly-added used-car listings from PakWheels, evaluates each
with Gemini, and upserts the result into the Supabase `cars` table.

Run:   python scraper.py
Cron:  every 12 h via GitHub Actions (see .github/workflows/scraper-cron.yml)
"""

import os
import re
import json
import asyncio
from datetime import datetime, timezone, timedelta
from dotenv import load_dotenv
from google import genai
from google.genai import types as genai_types
from supabase import create_client, Client
from playwright.async_api import async_playwright, Page

# ── Load env (works locally from .env.local; in CI vars are injected) ──
load_dotenv(".env.local")

SUPABASE_URL         = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
GEMINI_API_KEY       = os.environ["GEMINI_API_KEY"]

# ── Clients ─────────────────────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
_genai_client = genai.Client(api_key=GEMINI_API_KEY)

PAGES_TO_SCRAPE   = 5
GEMINI_BATCH_SIZE = 10  # 130 cars / 10 = 13 API calls — well within 1500/day free tier
BASE_LIST_URL     = "https://www.pakwheels.com/used-cars/search/-/?sort=date"


# ════════════════════════════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════════════════════════════
def _clean_int(text: str) -> int | None:
    """'4,500 km' -> 4500"""
    digits = re.sub(r"[^\d]", "", str(text))
    return int(digits) if digits else None


def _parse_pkr(text: str) -> int:
    """Parse PakWheels price text into full PKR integer.
    Handles:
      'PKR 64.75 Lac'  -> 6_475_000
      'PKR 1.25 Crore' -> 12_500_000
      'PKR 3,995,000'  -> 3_995_000
      '3995000'        -> 3_995_000
    """
    t = text.strip().replace(",", "")
    lac = re.search(r"([\d]+\.?\d*)\s*[Ll]ac", t)
    if lac:
        return int(float(lac.group(1)) * 100_000)
    crore = re.search(r"([\d]+\.?\d*)\s*[Cc]r", t)
    if crore:
        return int(float(crore.group(1)) * 10_000_000)
    # Plain digit string (already full PKR)
    return _clean_int(t) or 0


def _parse_url(url: str) -> dict:
    """
    PakWheels URLs are like:
      /used-cars/honda-civic-2022-for-sale-in-islamabad-12345678
    Extract make, model, year, city from the slug as a reliable fallback.
    """
    slug = url.rstrip("/").split("/")[-1]
    # Remove trailing numeric ID
    slug = re.sub(r"-\d+$", "", slug)
    # Remove "for-sale-in-<city>" suffix
    city_match = re.search(r"-for-sale-in-(.+)$", slug)
    city = city_match.group(1).replace("-", " ").title() if city_match else ""
    slug = re.sub(r"-for-sale-in-.+$", "", slug)
    # Last token that is a 4-digit year
    parts = slug.split("-")
    year, make, model_parts = None, "", []
    for i, p in enumerate(parts):
        if re.fullmatch(r"20\d\d", p):
            year = int(p)
            make = parts[0].title() if i > 0 else ""
            model_parts = parts[1:i]
            break
    model = " ".join(p.title() for p in model_parts)
    return {"make": make, "model": model, "year": year, "city": city}


async def _try_text(page: Page, *selectors: str, timeout: int = 5_000) -> str:
    """Try each selector in order; return the first that succeeds."""
    for sel in selectors:
        try:
            return (await page.locator(sel).first.inner_text(timeout=timeout)).strip()
        except Exception:
            continue
    return ""


# ════════════════════════════════════════════════════════════════════════
# STEP 1 — Gemini AI batch evaluation
# gemini-2.0-flash: 1,500 req/day free (vs 20/day for 2.5-flash)
# Batch size 10: 130 cars = 13 API calls per run
# ════════════════════════════════════════════════════════════════════════
_FALLBACK_EVAL = {"ai_score": None, "ai_label": "Unevaluated", "ai_summary": "Analysis unavailable."}


async def evaluate_batch(cars: list[dict]) -> list[dict]:
    """Send up to GEMINI_BATCH_SIZE cars to Gemini in one call.
    Returns a list of dicts with ai_score, ai_label, ai_summary.
    """
    if not cars:
        return []

    print(f"  Batch-evaluating {len(cars)} car(s) with Gemini ...")

    # Build a compact representation — only send fields Gemini needs
    slim = [
        {
            "index": i,
            "make":  c.get("make"),
            "model": c.get("model"),
            "year":  c.get("year"),
            "price": c.get("price"),
            "mileage": c.get("mileage"),
            "transmission": c.get("transmission"),
            "fuel_type": c.get("fuel_type"),
            "engine_capacity": c.get("engine_capacity"),
            "city": c.get("city"),
            "seller_description": (c.get("seller_description") or "")[:300],
        }
        for i, c in enumerate(cars)
    ]

    prompt = f"""
You are an expert Pakistani used-car evaluator. Analyse each listing below and rate it for value-for-money in the current Pakistani market.

Listings:
{json.dumps(slim, indent=2, ensure_ascii=False)}

For EACH listing return a JSON object with:
- "index": the same index number
- "ai_score": integer 1-10
- "ai_label": exactly one of "Great Deal", "Good Deal", "Fair Price", "Overpriced"
- "ai_summary": one engaging sentence (mention price, mileage, or key features)

Respond ONLY with a valid JSON array, e.g.:
[{{"index":0,"ai_score":8,"ai_label":"Good Deal","ai_summary":"..."}}, ...]
"""

    try:
        response = _genai_client.models.generate_content(
            model="gemini-2.0-flash",
            contents=prompt,
            config=genai_types.GenerateContentConfig(
                response_mime_type="application/json",
            ),
        )
        raw = response.text.strip()
        # Strip markdown code fences if present
        if raw.startswith("```"):
            raw = re.sub(r"^```[a-z]*\n?", "", raw)
            raw = re.sub(r"\n?```$", "", raw)
        evaluations = json.loads(raw)
        # Map by index
        by_index = {e["index"]: e for e in evaluations}
        return [
            {
                "ai_score":   by_index.get(i, {}).get("ai_score"),
                "ai_label":   by_index.get(i, {}).get("ai_label", "Unevaluated"),
                "ai_summary": by_index.get(i, {}).get("ai_summary", "Analysis unavailable."),
            }
            for i in range(len(cars))
        ]
    except Exception as exc:
        print(f"  WARNING: Gemini batch failed: {exc}")
        return [_FALLBACK_EVAL] * len(cars)



# ════════════════════════════════════════════════════════════════════════
# STEP 2 — Scrape a single PakWheels listing page
# ════════════════════════════════════════════════════════════════════════
async def scrape_listing(page: Page, url: str) -> dict | None:
    """Deep-scrape one PakWheels listing using JSON-LD + exact HTML selectors."""
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=40_000)
        await page.wait_for_timeout(2_500)

        url_data = _parse_url(url)

        # ══════════════════════════════════════════════════════════════
        # PRIMARY SOURCE: JSON-LD script tag
        # PakWheels embeds all key data in <script type="application/ld+json">
        # This is far more reliable than CSS selectors.
        # ══════════════════════════════════════════════════════════════
        ld = {}
        try:
            ld_text = await page.locator('script[type="application/ld+json"]').first.inner_text(timeout=5_000)
            ld = json.loads(ld_text)
        except Exception:
            pass

        make  = ld.get("manufacturer") or ld.get("brand", {}).get("name") or url_data.get("make", "Unknown")
        model = ld.get("model") or url_data.get("model", "Unknown")
        year  = int(ld.get("modelDate") or url_data.get("year") or 2020)

        # Price from JSON-LD offers block
        # offers can be a dict OR a list — handle both
        price = 0
        try:
            offers = ld.get("offers", {})
            if isinstance(offers, list):
                offers = offers[0] if offers else {}
            raw_price = offers.get("price")
            if raw_price is not None:
                # Could be int (3995000) or string ('3,995,000' or '64.75 Lac')
                price = _parse_pkr(str(raw_price))
        except (TypeError, ValueError, AttributeError):
            pass

        transmission_raw = ld.get("vehicleTransmission", "")
        transmission = "Automatic" if "auto" in transmission_raw.lower() else "Manual"

        color     = ld.get("color", "")
        body_type = ld.get("bodyType", "")
        fuel_type = ld.get("fuelType", "")

        # Mileage: can be a plain string "165,000 km" OR a QuantitativeValue dict
        mileage_raw = ld.get("mileageFromOdometer", "")
        if isinstance(mileage_raw, dict):
            # {"@type": "QuantitativeValue", "value": 165000, "unitCode": "KMT"}
            mileage = _clean_int(str(mileage_raw.get("value", "")))
        else:
            mileage = _clean_int(mileage_raw)

        # Engine capacity: from engineDisplacement "1500cc" → 1500
        engine_raw = ld.get("vehicleEngine", {}).get("engineDisplacement", "")
        engine_capacity = _clean_int(engine_raw)

        # ══════════════════════════════════════════════════════════════
        # SECONDARY: HTML selectors for fields not in JSON-LD
        # ══════════════════════════════════════════════════════════════

        # ── City: "Karachi Sindh" → "Karachi" ─────────────────────────
        city = ""
        try:
            city_raw = (await page.locator("p.detail-sub-heading a").first.inner_text(timeout=5_000)).strip()
            # Strip province suffix (e.g. "Karachi Sindh" → "Karachi")
            city = city_raw.split()[0] if city_raw else url_data.get("city", "")
        except Exception:
            city = url_data.get("city", "")

        # ── ul.ul-featured: alternating li.ad-data / li pairs ─────────
        # e.g. ["Registered In", "Karachi", "Color", "Blue", "Assembly", "Imported", ...]
        registered_in = ""
        assembly = ""
        try:
            all_lis = await page.locator("ul.ul-featured li").all()
            texts = [(await li.inner_text(timeout=2_000)).strip() for li in all_lis]
            # Walk pairs: texts[0]=key, texts[1]=value, texts[2]=key ...
            for i in range(0, len(texts) - 1, 2):
                key = texts[i].lower().rstrip(":")
                val = texts[i + 1]
                if "registered" in key:
                    registered_in = val
                elif "assembly" in key:
                    assembly = val
                elif "engine" in key and not engine_capacity:
                    engine_capacity = _clean_int(val)
                elif "body" in key and not body_type:
                    body_type = val
                elif "color" in key and not color:
                    color = val
        except Exception:
            pass

        # ── Spec table fallback (always visible, never lazy-loaded) ───
        # <table class="table-engine-detail"> has year | mileage | fuel | transmission
        try:
            td_texts = [(await td.inner_text(timeout=2_000)).strip()
                        for td in await page.locator("table.table-engine-detail td p").all()]
            # order is: [year, mileage, fuel_type, transmission]
            if len(td_texts) >= 2 and not mileage:
                mileage = _clean_int(td_texts[1])  # "165,000 km" → 165000
            if len(td_texts) >= 3 and not fuel_type:
                fuel_type = td_texts[2]
            if len(td_texts) >= 4 and not transmission_raw:
                transmission = "Automatic" if "auto" in td_texts[3].lower() else "Manual"
        except Exception:
            pass

        # ── Fallback price from page if JSON-LD had none ──────────────
        if price == 0:
            price_raw = await _try_text(
                page,
                ".price-box strong", ".price-box h4",
                ".generic-white.fs18",          # price shown in gallery overlay
                ".listing-price strong", ".car-price strong",
            )
            price = _parse_pkr(price_raw) if price_raw else 0

        print(f"  price={price:,}  mileage={mileage}")

        # ── Seller description ────────────────────────────────────────
        description = ""
        try:
            desc_el = page.locator("#scroll_seller_comments ~ div, #scroll_seller_comments + div")
            description = (await desc_el.first.inner_text(timeout=4_000)).strip()
        except Exception:
            description = await _try_text(page, ".seller-comments", ".comments", timeout=3_000)

        # ══════════════════════════════════════════════════════════════
        # IMAGES: read data-src from li.lslide elements — NOT img tags
        # The <img> src is a base64 placeholder; the real URL is on the <li>
        # ══════════════════════════════════════════════════════════════
        images: list[str] = []
        try:
            # li.lslide elements hold the full-res URL in data-src
            slide_lis = await page.locator("ul.light-gallery li.lslide").all()
            for li in slide_lis:
                src = await li.get_attribute("data-src") or ""
                # Skip PakWheels inspection pitch slides
                if src and "cache" in src and src not in images:
                    images.append(src)
                if len(images) >= 5:
                    break

            # Fallback 1: any li with data-src containing "cache"
            if not images:
                all_lis = await page.locator("li[data-src]").all()
                for li in all_lis:
                    src = await li.get_attribute("data-src") or ""
                    if "cache" in src and src not in images:
                        images.append(src)
                    if len(images) >= 5:
                        break

            # Fallback 2: JSON-LD has the first image already
            if not images and ld.get("image"):
                images.append(ld["image"])

            # Fallback 3: img tags with data-original (PakWheels attribute)
            if not images:
                img_els = await page.locator("img[data-original]").all()
                for img in img_els:
                    src = await img.get_attribute("data-original") or ""
                    if "cache" in src and src not in images:
                        images.append(src)
                    if len(images) >= 5:
                        break

        except Exception as img_exc:
            print(f"  WARNING: Image extraction failed: {img_exc}")

        # Only skip if we couldn't even determine the make
        if not make or make == "Unknown":
            print(f"  Skipping — could not extract make")
            return None
        if price == 0:
            print(f"  Warning: price is 0 (may be Price on Call) — saving anyway")

        return {
            "url":                url,
            "source_platform":    "PakWheels",
            "make":               make,
            "model":              model,
            "year":               year,
            "price":              price,
            "mileage":            mileage,
            "city":               city or None,
            "registered_in":      registered_in or None,
            "transmission":       transmission,
            "engine_capacity":    engine_capacity,
            "fuel_type":          fuel_type or None,
            "assembly":           assembly or None,
            "color":              color or None,
            "body_type":          body_type or None,
            "image_urls":         images,
            "seller_description": description or None,
            "ad_last_updated":    datetime.now(timezone.utc).isoformat(),
        }

    except Exception as exc:
        print(f"  FAILED to scrape {url}: {exc}")
        return None


# ════════════════════════════════════════════════════════════════════════
# STEP 3 — Collect listing URLs from search result pages
# ════════════════════════════════════════════════════════════════════════
async def collect_listing_urls(page: Page, num_pages: int) -> list[str]:
    urls: list[str] = []
    for page_num in range(1, num_pages + 1):
        list_url = f"{BASE_LIST_URL}&page={page_num}"
        print(f"Collecting URLs from page {page_num}: {list_url}")
        for attempt in range(2):          # retry once on timeout
            try:
                await page.goto(list_url, wait_until="domcontentloaded", timeout=40_000)
                await page.wait_for_timeout(2_000)
                anchors = await page.locator("a.car-name.ad-detail-path").all()
                for a in anchors:
                    href = await a.get_attribute("href")
                    if href:
                        full = (href if href.startswith("http")
                                else f"https://www.pakwheels.com{href}")
                        if full not in urls:
                            urls.append(full)
                print(f"   ↳ Found {len(anchors)} listings on this page.")
                break
            except Exception as exc:
                if attempt == 0:
                    print(f"  Retrying page {page_num} ...")
                    await asyncio.sleep(3)
                else:
                    print(f"  WARNING: Could not load list page {page_num}: {exc}")
    return urls


# ════════════════════════════════════════════════════════════════════════
# STEP 4 — 60-day garbage collection
# ════════════════════════════════════════════════════════════════════════
def garbage_collect():
    cutoff = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    try:
        result = supabase.table("cars").delete().lt("created_at", cutoff).execute()
        deleted = len(result.data) if result.data else 0
        print(f"Garbage collected {deleted} rows older than 60 days.")
    except Exception as exc:
        print(f"  WARNING: Garbage collection failed: {exc}")


# ════════════════════════════════════════════════════════════════════════
# MAIN RUNNER
# ════════════════════════════════════════════════════════════════════════
async def run():
    print("GariLelo AI Scraper starting...")

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/125.0.0.0 Safari/537.36"
            ),
            viewport={"width": 1280, "height": 800},
        )
        page = await context.new_page()

        # ── Collect URLs ─────────────────────────────────────────────
        all_urls = await collect_listing_urls(page, PAGES_TO_SCRAPE)
        print(f"\nTotal unique URLs collected: {len(all_urls)}\n")

        new_count = skipped_count = error_count = 0
        pending: list[dict] = []   # scraped cars queued for batch AI eval

        for idx, url in enumerate(all_urls, 1):
            print(f"[{idx}/{len(all_urls)}] {url}")

            # Deduplication
            try:
                existing = supabase.table("cars").select("id").eq("url", url).execute()
                if existing.data:
                    print("  Already in DB - skipping.")
                    skipped_count += 1
                    continue
            except Exception as exc:
                print(f"  DB check failed: {exc}")

            car_data = await scrape_listing(page, url)
            if not car_data:
                error_count += 1
            else:
                pending.append(car_data)

            await asyncio.sleep(2)

        await browser.close()

    print(f"\n{len(pending)} new car(s) scraped. Starting batch AI evaluation...\n")

    # Phase 2: evaluate in batches of GEMINI_BATCH_SIZE (1 API call per batch)
    for batch_start in range(0, len(pending), GEMINI_BATCH_SIZE):
        batch = pending[batch_start : batch_start + GEMINI_BATCH_SIZE]
        evaluations = await evaluate_batch(batch)

        for car_data, ai_eval in zip(batch, evaluations):
            payload = {**car_data, **ai_eval}
            try:
                supabase.table("cars").upsert(payload, on_conflict="url").execute()
                print(
                    f"  Saved: {car_data['make']} {car_data['model']} ({car_data['year']}) "
                    f"- {ai_eval['ai_label']} ({ai_eval['ai_score']}/10)"
                )
                new_count += 1
            except Exception as exc:
                print(f"  DB insert failed: {exc}")
                error_count += 1

        # Pause between Gemini batches to respect rate limits
        if batch_start + GEMINI_BATCH_SIZE < len(pending):
            await asyncio.sleep(4)

    garbage_collect()
    gemini_calls = -(-len(pending) // GEMINI_BATCH_SIZE)
    print(f"\nDone! New: {new_count} | Skipped: {skipped_count} | Errors: {error_count}")
    print(f"Gemini API calls used this run: ~{gemini_calls}")



if __name__ == "__main__":
    asyncio.run(run())
