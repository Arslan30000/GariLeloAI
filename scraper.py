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
from pydantic import BaseModel
from supabase import create_client, Client
import google.generativeai as genai
from playwright.async_api import async_playwright, Page

# ── Load env (works locally from .env.local; in CI vars are injected) ──
load_dotenv(".env.local")

SUPABASE_URL         = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
GEMINI_API_KEY       = os.environ["GEMINI_API_KEY"]

# ── Clients ─────────────────────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
genai.configure(api_key=GEMINI_API_KEY)

PAGES_TO_SCRAPE = 5
BASE_LIST_URL   = "https://www.pakwheels.com/used-cars/search/-/?sort=date"

# ── Gemini response schema ───────────────────────────────────────────────
class CarEvaluation(BaseModel):
    ai_score: int        # 1–10 value-for-money score
    ai_label: str        # "Great Deal" | "Good Deal" | "Fair Price" | "Overpriced"
    ai_summary: str      # One engaging sentence


# ════════════════════════════════════════════════════════════════════════
# HELPERS
# ════════════════════════════════════════════════════════════════════════
def _clean_int(text: str) -> int | None:
    """'4,500 km' → 4500"""
    digits = re.sub(r"[^\d]", "", str(text))
    return int(digits) if digits else None


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
# STEP 1 — Gemini AI evaluation
# ════════════════════════════════════════════════════════════════════════
async def evaluate_with_gemini(car: dict) -> dict:
    print(f"  🧠 Evaluating {car.get('make')} {car.get('model')} "
          f"{car.get('year')} @ PKR {car.get('price', 0):,} …")

    model = genai.GenerativeModel("gemini-2.5-flash")
    prompt = f"""
You are an expert Pakistani used-car evaluator. Analyse this listing:

{json.dumps(car, indent=2, ensure_ascii=False)}

Score it 1–10 for value-for-money in the current Pakistani market.
Label it exactly as one of: "Great Deal", "Good Deal", "Fair Price", "Overpriced".
Write ONE engaging sentence explaining your verdict (mention mileage, features, or price).

Respond ONLY with valid JSON: {{"ai_score": <int>, "ai_label": "<string>", "ai_summary": "<string>"}}
"""
    try:
        result = model.generate_content(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=CarEvaluation,
            ),
        )
        return json.loads(result.text)
    except Exception as exc:
        print(f"  ⚠️  Gemini failed: {exc}")
        return {"ai_score": None, "ai_label": "Unevaluated", "ai_summary": "Analysis unavailable."}


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
        price = 0
        try:
            price = int(ld.get("offers", {}).get("price") or 0)
        except (TypeError, ValueError):
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
            price = _clean_int(price_raw) or 0

        print(f"  💰 price={price:,}  📏 mileage={mileage}")

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
            print(f"  ⚠️  Image extraction failed: {img_exc}")

        # Only skip if we couldn't even determine the make
        if not make or make == "Unknown":
            print(f"  ⚠️  Skipping — could not extract make")
            return None
        if price == 0:
            print(f"  ⚠️  Warning: price is 0 (may be Price on Call) — saving anyway")

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
        print(f"  ❌ Failed to scrape {url}: {exc}")
        return None


# ════════════════════════════════════════════════════════════════════════
# STEP 3 — Collect listing URLs from search result pages
# ════════════════════════════════════════════════════════════════════════
async def collect_listing_urls(page: Page, num_pages: int) -> list[str]:
    urls: list[str] = []
    for page_num in range(1, num_pages + 1):
        list_url = f"{BASE_LIST_URL}&page={page_num}"
        print(f"📄 Collecting URLs from page {page_num}: {list_url}")
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
                    print(f"  ⚠️  Retrying page {page_num} …")
                    await asyncio.sleep(3)
                else:
                    print(f"  ⚠️  Could not load list page {page_num}: {exc}")
    return urls


# ════════════════════════════════════════════════════════════════════════
# STEP 4 — 60-day garbage collection
# ════════════════════════════════════════════════════════════════════════
def garbage_collect():
    cutoff = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    try:
        result = supabase.table("cars").delete().lt("created_at", cutoff).execute()
        deleted = len(result.data) if result.data else 0
        print(f"🗑️  Garbage collected {deleted} rows older than 60 days.")
    except Exception as exc:
        print(f"  ⚠️  Garbage collection failed: {exc}")


# ════════════════════════════════════════════════════════════════════════
# MAIN RUNNER
# ════════════════════════════════════════════════════════════════════════
async def run():
    print("🚀 GariLelo AI Scraper starting…")

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
        print(f"\n✅ Total unique URLs collected: {len(all_urls)}\n")

        new_count = skipped_count = error_count = 0

        for idx, url in enumerate(all_urls, 1):
            print(f"[{idx}/{len(all_urls)}] {url}")

            # ── Deduplication ────────────────────────────────────────
            try:
                existing = supabase.table("cars").select("id").eq("url", url).execute()
                if existing.data:
                    print("  ⏩ Already in DB — skipping.")
                    skipped_count += 1
                    continue
            except Exception as exc:
                print(f"  ⚠️  DB check failed: {exc}")

            # ── Scrape detail page ───────────────────────────────────
            car_data = await scrape_listing(page, url)
            if not car_data:
                error_count += 1
                continue

            # ── Gemini AI evaluation ─────────────────────────────────
            ai_eval = await evaluate_with_gemini(car_data)

            # ── Upsert to Supabase ───────────────────────────────────
            payload = {**car_data, **ai_eval}
            try:
                supabase.table("cars").upsert(payload, on_conflict="url").execute()
                print(
                    f"  💾 Saved: {car_data['make']} {car_data['model']} "
                    f"({car_data['year']}) — {ai_eval['ai_label']} ({ai_eval['ai_score']}/10)"
                )
                new_count += 1
            except Exception as exc:
                print(f"  ❌ DB insert failed: {exc}")
                error_count += 1

            # Polite delay between requests
            await asyncio.sleep(2)

        await browser.close()

    # ── Garbage collection ───────────────────────────────────────────
    garbage_collect()
    print(f"\n🏁 Done! New: {new_count} | Skipped: {skipped_count} | Errors: {error_count}")


if __name__ == "__main__":
    asyncio.run(run())
