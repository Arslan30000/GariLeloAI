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
    try:
        # Use domcontentloaded — networkidle times out on ad-heavy pages
        await page.goto(url, wait_until="domcontentloaded", timeout=40_000)
        # Give JS components a moment to render
        await page.wait_for_timeout(2_500)

        # ── URL-based fallbacks (always available, never timeout) ─────
        url_data = _parse_url(url)

        # ── Title: try known PakWheels selectors, fall back to URL ────
        title_raw = await _try_text(
            page,
            "h1.car-heading",           # most listing pages
            "h1.listing-car-title",     # some variants
            ".car-heading h1",
            "h1",                       # last resort
        )
        if title_raw:
            # "Honda Civic 2022" → split off year
            parts = title_raw.rsplit(" ", 1)
            if parts[-1].isdigit() and len(parts[-1]) == 4:
                make_model, year_str = " ".join(parts[:-1]), parts[-1]
            else:
                make_model, year_str = title_raw, str(url_data.get("year") or "")
            make_parts = make_model.split(" ", 1)
            make  = make_parts[0].strip()
            model = make_parts[1].strip() if len(make_parts) > 1 else make_model
        else:
            # Full fallback from URL slug
            make  = url_data.get("make", "Unknown")
            model = url_data.get("model", "Unknown")
            year_str = str(url_data.get("year") or "2020")

        year = _clean_int(year_str) or url_data.get("year") or 2020

        # ── Price ─────────────────────────────────────────────────────
        price_raw = await _try_text(
            page,
            ".price-box strong",
            ".price-box h4",
            ".price-box .price-amount",
            ".listing-price strong",
            ".car-price strong",
        )
        price = _clean_int(price_raw) or 0

        # ── City ──────────────────────────────────────────────────────
        city_raw = await _try_text(
            page,
            ".listing-location span",
            ".seller-location span",
            ".loc span",
            ".listing-details .date-plate-wrap em",
        )
        city = city_raw or url_data.get("city", "")

        # ── Spec table: try two common layouts ────────────────────────
        specs: dict[str, str] = {}

        # Layout A: <ul class="car-info"> <li>Key: Value</li> …
        try:
            rows = await page.locator("ul.car-info li").all()
            for row in rows:
                text = (await row.inner_text(timeout=3_000)).strip()
                if ":" in text:
                    k, _, v = text.partition(":")
                    specs[k.strip().lower()] = v.strip()
        except Exception:
            pass

        # Layout B: pairs of .title / .value inside .car-specs
        try:
            keys   = await page.locator(".car-specs .title").all()
            values = await page.locator(".car-specs .value").all()
            for k_el, v_el in zip(keys, values):
                k = (await k_el.inner_text(timeout=2_000)).strip().lower()
                v = (await v_el.inner_text(timeout=2_000)).strip()
                if k and v:
                    specs[k] = v
        except Exception:
            pass

        # Layout C: dl > dt + dd  (some listing types)
        try:
            dts = await page.locator("dl dt").all()
            dds = await page.locator("dl dd").all()
            for dt_el, dd_el in zip(dts, dds):
                k = (await dt_el.inner_text(timeout=2_000)).strip().lower()
                v = (await dd_el.inner_text(timeout=2_000)).strip()
                if k and v:
                    specs[k] = v
        except Exception:
            pass

        # ── Extract fields from specs (with sensible defaults) ────────
        mileage_raw   = specs.get("mileage", specs.get("driven", ""))
        engine_raw    = specs.get("engine capacity", specs.get("engine", ""))
        transmission  = specs.get("transmission", "Manual").strip()
        fuel_type     = specs.get("fuel type", specs.get("fuel", "Petrol")).strip()
        assembly      = specs.get("assembly", "Local").strip()
        color         = specs.get("color", specs.get("colour", "")).strip()
        body_type     = specs.get("body type", specs.get("body", "")).strip()
        registered_in = specs.get("registered in",
                                   specs.get("registered areas", "")).strip()
        year_spec     = specs.get("year", str(year))

        mileage         = _clean_int(mileage_raw)
        engine_capacity = _clean_int(engine_raw)
        # Override year from specs if present
        year = _clean_int(year_spec) or year
        # Normalise transmission
        transmission = "Automatic" if "auto" in transmission.lower() else "Manual"

        # ── Seller description ────────────────────────────────────────
        description = await _try_text(
            page,
            ".seller-comments",
            ".seller-comment",
            ".comments",
            ".description",
            timeout=3_000,
        )

        # ── Images (up to 5) ─────────────────────────────────────────
        # PakWheels lazy-loads images: the real URL lives in data-src,
        # data-lazy, or data-original — NOT the src attribute.
        # We scroll the page first to trigger the lazy-load observer.
        images: list[str] = []
        try:
            # Scroll down a bit to wake up the lazy-load observer
            await page.evaluate("window.scrollBy(0, 600)")
            await page.wait_for_timeout(1_500)
            await page.evaluate("window.scrollTo(0, 0)")

            # Candidate selectors from most to least specific
            gallery_selectors = [
                ".ad-gallery img",
                ".gallery-thumb img",
                ".owl-item img",
                ".slick-slide img",
                ".carousel-inner img",
                ".fancybox-image",
                "img[data-src]",       # any lazy-loaded img
                "img[data-lazy]",
                "img[data-original]",
            ]

            for sel in gallery_selectors:
                img_els = await page.locator(sel).all()
                for img in img_els:
                    # Check all common lazy-load attributes, then fall back to src
                    src = ""
                    for attr in ("data-src", "data-lazy", "data-original",
                                 "data-lazy-src", "src"):
                        val = await img.get_attribute(attr) or ""
                        if val.startswith("http"):
                            src = val
                            break

                    # Only keep real car photos (filter out icons/placeholders)
                    # PakWheels uses imgix CDN or their own cdn.pakwheels.com
                    if not src:
                        continue
                    is_car_photo = any(domain in src for domain in [
                        "pakwheels", "imgix", "cloudfront", "amazonaws",
                        "imagin", "motorimage",
                    ])
                    is_tiny = "placeholder" in src.lower() or "logo" in src.lower()
                    if is_car_photo and not is_tiny and src not in images:
                        images.append(src)
                    if len(images) >= 5:
                        break
                if images:
                    break

            # Last resort: grab any large img on the page with a photo-like URL
            if not images:
                all_imgs = await page.locator("img").all()
                for img in all_imgs:
                    for attr in ("data-src", "data-lazy", "data-original", "src"):
                        src = await img.get_attribute(attr) or ""
                        if (src.startswith("http") and
                                any(ext in src for ext in [".jpg", ".jpeg", ".webp", ".png"]) and
                                "placeholder" not in src.lower() and
                                "logo" not in src.lower() and
                                src not in images):
                            images.append(src)
                            break
                    if len(images) >= 5:
                        break

        except Exception as img_exc:
            print(f"  ⚠️  Image extraction failed: {img_exc}")

        # Only save if we have the minimum required fields
        if not make or price == 0:
            print(f"  ⚠️  Skipping — could not extract make/price (make={make!r}, price={price})")
            return None

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
