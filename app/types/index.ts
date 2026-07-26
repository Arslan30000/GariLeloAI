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
  max_price: number | null;
  city: string | null;
  transmission: 'Automatic' | 'Manual' | null;
  color: string | null;
}

// ── Sort options ─────────────────────────────────────────────────
export type SortOption =
  | 'relevance'
  | 'price-asc'
  | 'price-desc'
  | 'year-desc'
  | 'mileage-asc';
