// ── Car listing types ─────────────────────────────────────────────
export type DealRating =
  | 'Great Deal'
  | 'Good Deal'
  | 'Fair Deal'
  | 'Fair Price'    // Gemini scraper label
  | 'Overpriced'    // Gemini scraper label
  | 'No Rating';

export type CarSource = 'OLX' | 'PakWheels' | 'CarFirst' | 'Other';

export interface CarListing {
  id: string;
  title: string;
  year: number;
  price: number;              // numeric price in PKR
  priceFormatted: string;     // e.g. "PKR 34.50L" or "PKR 1.68Cr"
  mileage: number;            // in km
  mileageFormatted: string;   // e.g. "1,800 km"
  transmission: 'Automatic' | 'Manual';
  fuelType?: string;
  city: string;
  registeredIn?: string;      // e.g. "Islamabad", "Unregistered"
  engineCapacity?: number;    // in cc
  assembly?: string;          // "Local" | "Imported"
  color?: string;
  bodyType?: string;
  source: CarSource;
  sourcePlatform?: string;    // raw source_platform from DB
  sourceUrl: string;
  imageUrl?: string;          // first image from image_urls[]
  imageUrls?: string[];       // full array from DB
  aiScore?: number;           // 1–10 deal score from Gemini
  aiLabel?: string;           // e.g. "Great Deal", "Overpriced"
  aiSummary?: string;         // one-sentence Gemini analysis
  dealRating: DealRating;
  isFavorite?: boolean;
}

// ── Quick-filter tag type ────────────────────────────────────────
export interface QuickFilter {
  id: string;
  label: string;
  query: string;
}

// ── AI filter shape returned by the search API ───────────────────
export interface SearchFilters {
  make: string | null;
  model: string | null;
  min_price: number | null;
  max_price: number | null;
  min_year: number | null;
  max_year: number | null;
  city: string | null;
  transmission: 'Automatic' | 'Manual' | null;
  color: string | null;
  body_type: string | null;   // e.g. "Van", "SUV", "Sedan", "Hatchback"
  fuel_type: string | null;   // e.g. "Hybrid", "Diesel", "Petrol"
  engine_capacity: number | null; // Minimum CC, e.g. 1800
  ai_score_min: number | null; // 1-10
  keyword_search: string | null; // For semantic searches like "fast"
  include_call_for_price: boolean | null; // Strictly false for low budget searches
}

// ── Sort options ─────────────────────────────────────────────────
export type SortOption =
  | 'relevance'
  | 'price-asc'
  | 'price-desc'
  | 'year-desc'
  | 'mileage-asc';
