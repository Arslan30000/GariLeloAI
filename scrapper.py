import os
import json
import asyncio
from dotenv import load_dotenv
from pydantic import BaseModel
from typing import List, Optional
from supabase import create_client, Client
import google.generativeai as genai
from playwright.async_api import async_playwright

# Load environment variables from .env.local
load_dotenv('.env.local')

# 1. INITIALIZE SUPABASE
supabase: Client = create_client(
    os.getenv("NEXT_PUBLIC_SUPABASE_URL"), 
    os.getenv("SUPABASE_SERVICE_ROLE_KEY")
)

# 2. INITIALIZE GEMINI
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# Strict JSON Schema for Gemini Evaluation
class CarEvaluation(BaseModel):
    ai_score: int
    ai_label: str
    ai_summary: str

async def evaluate_car_with_gemini(car_details_json: dict) -> dict:
    """Sends all extracted car specs to Gemini for a smart local market deal analysis"""
    print(f"🧠 Gemini is evaluating: {car_details_json['make']} {car_details_json['model']} ({car_details_json['year']})...")
    
    model = genai.GenerativeModel("gemini-2.5-flash")
    
    prompt = f"""
    You are an expert Pakistani used car evaluator. Analyze this listing data and its price:
    
    {json.dumps(car_details_json, indent=2)}
    
    1. Score this listing out of 10 based on its value for money in the current Pakistani market.
    2. Label it exactly as 'Great Deal', 'Good Deal', 'Fair Price', or 'Overpriced'.
    3. Write a single, highly engaging, one-sentence summary explaining your decision (mentioning things like mileage, features, or price alignment).
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
    except Exception as e:
        print(f"⚠️ Gemini evaluation failed: {e}. Defaulting to empty analysis.")
        return {"ai_score": None, "ai_label": "Unevaluated", "ai_summary": "Analysis unavailable."}

async def scrape_car_details(page, url: str) -> Optional[dict]:
    """Navigates inside a listing page to scrape every single column in your DB schema"""
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        
        # NOTE: You will inspect the target site and update these CSS selectors to match their pages.
        # This is structured specifically to extract what your database table expects.
        
        # 1. Basic Text Extractions (With fallbacks to avoid crashes)
        seller_description = await page.locator('.seller-description-class').inner_text() or ""
        
        # 2. Extract Key-Value Spec Specs (Transmission, Assembly, etc.)
        # Often sites list specs in a grid/table. We can parse them dynamically:
        specs = {}
        spec_elements = await page.locator('.spec-item-class').all()
        for element in spec_elements:
            key = await element.locator('.label').inner_text() # e.g. "Assembly"
            val = await element.locator('.value').inner_text() # e.g. "Local"
            specs[key.strip().lower()] = val.strip()

        # 3. Extract Image URLs (Grabbing up to 5 image links)
        images = []
        image_elements = await page.locator('.slider-image-class img').all()
        for img in image_elements[:5]: # Cap at 5 images to save DB space
            src = await img.get_attribute('src')
            if src:
                images.append(src)

        # 4. Parse fields safely matching your DB types
        raw_price = await page.locator('.price-class').inner_text()
        # Clean price string "PKR 4,500,000" -> integer 4500000
        price = int(''.join(filter(str.isdigit, raw_price))) if raw_price else 0

        raw_mileage = specs.get('mileage', '0')
        mileage = int(''.join(filter(str.isdigit, raw_mileage))) if raw_mileage else 0

        raw_cc = specs.get('engine capacity', '0')
        engine_capacity = int(''.join(filter(str.isdigit, raw_cc))) if raw_cc else None

        # Format and map directly to your table's columns
        car_data = {
            "url": url,
            "source_platform": "PakWheels" if "pakwheels" in url else "OLX",
            "make": specs.get('make', 'Unknown'),
            "model": specs.get('model', 'Unknown'),
            "year": int(specs.get('year', 2020)),
            "price": price,
            "mileage": mileage,
            "city": specs.get('city', 'Unknown'),
            "registered_in": specs.get('registered areas', 'Unregistered'),
            "transmission": specs.get('transmission', 'Manual'),
            "engine_capacity": engine_capacity,
            "fuel_type": specs.get('fuel type', 'Petrol'),
            "assembly": specs.get('assembly', 'Local'),
            "color": specs.get('color', 'Unknown'),
            "body_type": specs.get('body type', 'Sedan'),
            "image_urls": images,
            "seller_description": seller_description,
        }
        return car_data
    except Exception as e:
        print(f"❌ Failed to scrape detail page {url}: {e}")
        return None

async def run_scraper():
    print("🚀 Starting the Fully Mapped Playwright Scraper...")
    
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        # Emulate a real user browser header to minimize bot detection blocks
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()
        
        # Step 1: Browse "Newly Added" list page
        target_list_url = "https://example-car-site.com/used-cars/newly-added" 
        await page.goto(target_list_url, wait_until="networkidle")
        
        # Grab listing links
        listing_cards = await page.locator('.car-listing-card a.listing-link').all()
        urls_to_scrape = []
        for card in listing_cards:
            url = await card.get_attribute('href')
            if url:
                # Build complete URL if it's relative
                full_url = url if url.startswith('http') else f"https://example-car-site.com{url}"
                urls_to_scrape.append(full_url)
        
        print(f"📋 Found {len(urls_to_scrape)} potential cars on the list page.")

        # Step 2: Loop through and deeply process each unique car
        for url in urls_to_scrape[:10]: # Process 10 at a time to prevent rate limits during testing
            
            # --- SUPABASE UNIQUE CONSTRAINT CHECK ---
            existing = supabase.table('cars').select('id').eq('url', url).execute()
            if len(existing.data) > 0:
                print(f"⏩ Skipped: {url} (Already exists in Supabase)")
                continue
            
            # Step 3: Scrape the deep detailed page
            car_specs = await scrape_car_details(page, url)
            if not car_specs:
                continue

            # Step 4: Feed the scraped details to Gemini to get the AI analysis columns
            ai_evaluation = await evaluate_car_with_gemini(car_specs)
            
            # Merge the scraped spec data with the AI analysis columns
            final_db_payload = {
                **car_specs,
                "ai_score": ai_evaluation["ai_score"],
                "ai_label": ai_evaluation["ai_label"],
                "ai_summary": ai_evaluation["ai_summary"]
            }

            # Step 5: Save everything directly to Supabase
            try:
                supabase.table('cars').insert(final_db_payload).execute()
                print(f"💾 Successfully saved {final_db_payload['make']} {final_db_payload['model']} to Supabase with AI Rating: {final_db_payload['ai_score']}/10!")
            except Exception as e:
                print(f"❌ Supabase database insertion error: {e}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_scraper())