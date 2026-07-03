// ── Car listing types ─────────────────────────────────────────────
export type DealRating = "Great Deal" | "Good Deal" | "Fair Deal" | "No Rating";

export type CarSource = "OLX" | "PakWheels" | "CarFirst" | "Other";

export interface CarListing {
  id: string;
  title: string;
  year: number;
  price: number;              // numeric price in PKR
  priceFormatted: string;     // e.g. "PKR 34.50L" or "PKR 1.68Cr"
  mileage: number;            // in km
  mileageFormatted: string;   // e.g. "1,800 km"
  transmission: "Automatic" | "Manual";
  fuelType?: string;
  city: string;
  source: CarSource;
  sourceUrl: string;
  imageUrl?: string;          // optional — no images for now
  aiScore?: number;           // 0–100 AI match score
  dealRating: DealRating;
  isFavorite?: boolean;
}

// ── Quick-filter tag type ────────────────────────────────────────
export interface QuickFilter {
  id: string;
  label: string;
  query: string;
}

// ── Sort options ─────────────────────────────────────────────────
export type SortOption =
  | "relevance"
  | "price-asc"
  | "price-desc"
  | "year-desc"
  | "mileage-asc";
