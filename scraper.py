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

SUPABASE_URL        = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_SERVICE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
GEMINI_API_KEY      = os.environ["GEMINI_API_KEY"]

# ── Clients ─────────────────────────────────────────────────────────────
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
genai.configure(api_key=GEMINI_API_KEY)

# Pages to scrape per run (24 listings/page × 5 pages ≈ 120 cars)
PAGES_TO_SCRAPE = 5
BASE_LIST_URL   = "https://www.pakwheels.com/used-cars/search/-/?sort=date"

# ── Gemini response schema ───────────────────────────────────────────────
class CarEvaluation(BaseModel):
    ai_score: int        # 1–10 value-for-money score
    ai_label: str        # "Great Deal" | "Good Deal" | "Fair Price" | "Overpriced"
    ai_summary: str      # One engaging sentence


# ════════════════════════════════════════════════════════════════════════
# STEP 1 — AI evaluation
# ════════════════════════════════════════════════════════════════════════
async def evaluate_with_gemini(car: dict) -> dict:
    """Ask Gemini to score and summarise a listing for the Pakistani market."""
    print(f"  🧠 Evaluating {car.get('make')} {car.get('model')} {car.get('year')} @ PKR {car.get('price'):,} …")

    model = genai.GenerativeModel("gemini-2.5-flash")
    prompt = f"""
You are an expert Pakistani used-car evaluator. Analyse this listing:

{json.dumps(car, indent=2, ensure_ascii=False)}

Score it 1–10 for value-for-money in the current Pakistani market.
Label it exactly as one of: "Great Deal", "Good Deal", "Fair Price", "Overpriced".
Write ONE engaging sentence explaining your verdict (mention mileage, features, or price alignment).

Respond ONLY with valid JSON matching the schema:
{{"ai_score": <int>, "ai_label": "<string>", "ai_summary": "<string>"}}
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
def _clean_int(text: str) -> int | None:
    """Extract the first integer from a string like '4,500 km' → 4500."""
    digits = re.sub(r"[^\d]", "", text)
    return int(digits) if digits else None


async def scrape_listing(page: Page, url: str) -> dict | None:
    """Deep-scrape one PakWheels listing URL → dict matching the DB schema."""
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=35_000)
        await page.wait_for_selector(".price-box", timeout=10_000)

        # ── Title: "Toyota Corolla 2021" ──────────────────────────────
        title_raw = (await page.locator("h1.listing-car-title").inner_text()).strip()
        # e.g. "Honda Civic 2022" → make="Honda", model="Civic", year=2022
        title_parts  = title_raw.rsplit(" ", 1)
        year_str     = title_parts[-1] if title_parts[-1].isdigit() else ""
        make_model   = title_parts[0] if year_str else title_raw
        make_parts   = make_model.split(" ", 1)
        make         = make_parts[0].strip()
        model        = make_parts[1].strip() if len(make_parts) > 1 else make_model

        # ── Price ─────────────────────────────────────────────────────
        price_raw = await page.locator(".price-box strong").first.inner_text()
        price = _clean_int(price_raw) or 0

        # ── City (appears after the price line) ───────────────────────
        city = ""
        try:
            city_raw = await page.locator(".listing-location span").first.inner_text()
            city = city_raw.strip()
        except Exception:
            pass

        # ── Spec table (key-value pairs in two-column dl/ul) ──────────
        specs: dict[str, str] = {}
        try:
            rows = await page.locator("ul.car-info li").all()
            for row in rows:
                text = await row.inner_text()
                if ":" in text:
                    k, _, v = text.partition(":")
                    specs[k.strip().lower()] = v.strip()
        except Exception:
            pass

        # Fallback: labelled spec items used on some page layouts
        try:
            items = await page.locator(".car-specs .row .col-xs-6").all()
            for item in items:
                text = await item.inner_text()
                lines = [l.strip() for l in text.splitlines() if l.strip()]
                if len(lines) >= 2:
                    specs[lines[0].lower()] = lines[1]
        except Exception:
            pass

        # ── Extract individual fields from specs dict ─────────────────
        mileage_raw      = specs.get("mileage", specs.get("driven", ""))
        engine_raw       = specs.get("engine capacity", specs.get("engine", ""))
        transmission     = specs.get("transmission", "Manual").strip()
        fuel_type        = specs.get("fuel type", specs.get("fuel", "Petrol")).strip()
        assembly         = specs.get("assembly", "Local").strip()
        color            = specs.get("color", specs.get("colour", "")).strip()
        body_type        = specs.get("body type", specs.get("body", "")).strip()
        registered_in    = specs.get("registered in", specs.get("registered areas", "")).strip()
        year_spec        = specs.get("year", year_str)

        mileage         = _clean_int(mileage_raw)
        engine_capacity = _clean_int(engine_raw)
        year            = _clean_int(year_spec) or 2020

        # Normalise transmission
        transmission = "Automatic" if "auto" in transmission.lower() else "Manual"

        # ── Seller description ────────────────────────────────────────
        description = ""
        try:
            description = (await page.locator(".seller-comments").first.inner_text()).strip()
        except Exception:
            pass

        # ── Images (up to 5) ─────────────────────────────────────────
        images: list[str] = []
        try:
            img_els = await page.locator(".gallery-thumb img, .owl-item img").all()
            for img in img_els[:8]:
                src = await img.get_attribute("src") or await img.get_attribute("data-src")
                if src and src.startswith("http") and src not in images:
                    images.append(src)
                    if len(images) >= 5:
                        break
        except Exception:
            pass

        return {
            "url":                url,
            "source_platform":    "PakWheels",
            "make":               make,
            "model":              model,
            "year":               year,
            "price":              price,
            "mileage":            mileage,
            "city":               city,
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
        try:
            await page.goto(list_url, wait_until="networkidle", timeout=45_000)
            # PakWheels listing links: <a class="car-name ad-detail-path" href="/used-cars/...">
            anchors = await page.locator("a.car-name.ad-detail-path").all()
            for a in anchors:
                href = await a.get_attribute("href")
                if href:
                    full = href if href.startswith("http") else f"https://www.pakwheels.com{href}"
                    if full not in urls:
                        urls.append(full)
            print(f"   ↳ Found {len(anchors)} listings on this page.")
        except Exception as exc:
            print(f"  ⚠️  Could not load list page {page_num}: {exc}")
    return urls


# ════════════════════════════════════════════════════════════════════════
# STEP 4 — Garbage collection (delete rows older than 60 days)
# ════════════════════════════════════════════════════════════════════════
def garbage_collect():
    cutoff = (datetime.now(timezone.utc) - timedelta(days=60)).isoformat()
    try:
        result = (
            supabase.table("cars")
            .delete()
            .lt("created_at", cutoff)
            .execute()
        )
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
            print(f"[{idx}/{len(all_urls)}] Processing: {url}")

            # ── Deduplication check ──────────────────────────────────
            try:
                existing = supabase.table("cars").select("id").eq("url", url).execute()
                if existing.data:
                    print("  ⏩ Already in DB — skipping.")
                    skipped_count += 1
                    continue
            except Exception as exc:
                print(f"  ⚠️  DB check failed: {exc}")

            # ── Deep scrape ──────────────────────────────────────────
            car_data = await scrape_listing(page, url)
            if not car_data:
                error_count += 1
                continue

            # ── Gemini AI evaluation ─────────────────────────────────
            ai_eval = await evaluate_with_gemini(car_data)

            # ── Merge and upsert ─────────────────────────────────────
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

            # Small delay to be polite to the server
            await asyncio.sleep(1.5)

        await browser.close()

    # ── Garbage collection ───────────────────────────────────────────
    garbage_collect()

    print(
        f"\n🏁 Done! New: {new_count} | Skipped: {skipped_count} | Errors: {error_count}"
    )


if __name__ == "__main__":
    asyncio.run(run())
