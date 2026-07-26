'use client';

import { useState, useEffect, useCallback } from 'react';
import Navbar from './Navbar';
import Hero from './Hero';
import CarGrid from './CarGrid';
import Footer from './Footer';
import type { CarListing, QuickFilter, SearchFilters } from '../types';

/* ── Sample quick filters (driven by data, not hardcoded markup) ─ */
const QUICK_FILTERS: QuickFilter[] = [
  { id: 'family-30', label: 'Family Cars under 30L', query: 'family car under 30 lac' },
  { id: 'fuel-eco',  label: 'Great Fuel Economy',    query: 'fuel efficient car' },
  { id: 'low-mile',  label: 'Low Mileage SUVs',      query: 'low mileage SUV' },
  { id: 'auto-50',   label: 'Automatic under 50L',    query: 'automatic under 50 lac' },
  { id: 'civic-isl', label: 'Honda Civic Islamabad',  query: 'Honda Civic Islamabad' },
];

/* ── Sample cars shown on first load (before any search is run) ── */
const SAMPLE_CARS: CarListing[] = [
  {
    id: '1',
    title: 'Suzuki Swift GLX',
    year: 2023,
    price: 3450000,
    priceFormatted: 'PKR 34.50L',
    mileage: 1800,
    mileageFormatted: '1,800 km',
    transmission: 'Automatic',
    city: 'Lahore',
    source: 'OLX',
    sourceUrl: 'https://www.olx.com.pk/item/suzuki-swift-glx-2023-iid-108920112',
    imageUrl: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=600',
    aiScore: 95,
    dealRating: 'Great Deal',
  },
  {
    id: '2',
    title: 'Honda Civic Oriel',
    year: 2021,
    price: 6800000,
    priceFormatted: 'PKR 68.00L',
    mileage: 42000,
    mileageFormatted: '42,000 km',
    transmission: 'Automatic',
    city: 'Islamabad',
    source: 'PakWheels',
    sourceUrl: 'https://www.pakwheels.com/used-cars/honda-civic-2021-for-sale-in-islamabad',
    imageUrl: 'https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&q=80&w=600',
    aiScore: 89,
    dealRating: 'Good Deal',
  },
  {
    id: '3',
    title: 'Suzuki Alto VXR',
    year: 2022,
    price: 2300000,
    priceFormatted: 'PKR 23.00L',
    mileage: 28000,
    mileageFormatted: '28,000 km',
    transmission: 'Manual',
    city: 'Karachi',
    source: 'OLX',
    sourceUrl: 'https://www.olx.com.pk/item/suzuki-alto-vxr-2022-iid-108930492',
    imageUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=600',
    aiScore: 92,
    dealRating: 'Great Deal',
  },
  {
    id: '4',
    title: 'Kia Sportage AWD',
    year: 2022,
    price: 7400000,
    priceFormatted: 'PKR 74.00L',
    mileage: 25000,
    mileageFormatted: '25,000 km',
    transmission: 'Automatic',
    city: 'Islamabad',
    source: 'CarFirst',
    sourceUrl: 'https://carfirst.com/buy-car/kia-sportage-2022',
    imageUrl: 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=80&w=600',
    aiScore: 82,
    dealRating: 'Fair Deal',
  },
  {
    id: '5',
    title: 'Toyota Corolla Altis Grande',
    year: 2022,
    price: 5900000,
    priceFormatted: 'PKR 59.00L',
    mileage: 18500,
    mileageFormatted: '18,500 km',
    transmission: 'Automatic',
    city: 'Lahore',
    source: 'PakWheels',
    sourceUrl: 'https://www.pakwheels.com/used-cars/toyota-corolla-2022-for-sale-in-lahore',
    imageUrl: 'https://images.unsplash.com/photo-1605559424843-9e4c228bf1c2?auto=format&fit=crop&q=80&w=600',
    aiScore: 88,
    dealRating: 'Good Deal',
  },
  {
    id: '6',
    title: 'Toyota Yaris Ativ X',
    year: 2021,
    price: 4500000,
    priceFormatted: 'PKR 45.00L',
    mileage: 35000,
    mileageFormatted: '35,000 km',
    transmission: 'Automatic',
    city: 'Karachi',
    source: 'PakWheels',
    sourceUrl: 'https://www.pakwheels.com/used-cars/toyota-yaris-2021-for-sale-in-karachi',
    imageUrl: 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&q=80&w=600',
    aiScore: 91,
    dealRating: 'Good Deal',
  },
  {
    id: '7',
    title: 'Toyota Prado TX',
    year: 2018,
    price: 19500000,
    priceFormatted: 'PKR 1.95Cr',
    mileage: 88000,
    mileageFormatted: '88,000 km',
    transmission: 'Automatic',
    city: 'Islamabad',
    source: 'OLX',
    sourceUrl: 'https://www.olx.com.pk/item/toyota-prado-tx-2018-iid-108940582',
    imageUrl: 'https://images.unsplash.com/photo-1511919884226-fd3cad34687c?auto=format&fit=crop&q=80&w=600',
    aiScore: 78,
    dealRating: 'Fair Deal',
  },
  {
    id: '8',
    title: 'Suzuki Cultus VXL',
    year: 2020,
    price: 2850000,
    priceFormatted: 'PKR 28.50L',
    mileage: 55000,
    mileageFormatted: '55,000 km',
    transmission: 'Manual',
    city: 'Karachi',
    source: 'OLX',
    sourceUrl: 'https://www.olx.com.pk/item/suzuki-cultus-vxl-2020-iid-108950183',
    imageUrl: 'https://images.unsplash.com/photo-1541899481282-d53bffe3c35d?auto=format&fit=crop&q=80&w=600',
    aiScore: 94,
    dealRating: 'Great Deal',
  },
];

/** Normalize a Supabase `cars` row into the CarListing shape used by the UI. */
function normalizeApiCar(raw: Record<string, unknown>, index: number): CarListing {
  const price = Number(raw.price ?? 0);
  const mileage = Number(raw.mileage ?? 0);

  const priceFormatted =
    price >= 10_000_000
      ? `PKR ${(price / 10_000_000).toFixed(2)}Cr`
      : `PKR ${(price / 100_000).toFixed(2)}L`;

  const mileageFormatted = `${mileage.toLocaleString('en-PK')} km`;

  // Map source_platform to CarSource union
  const platformRaw = String(raw.source_platform ?? raw.source ?? '');
  const validSources = ['OLX', 'PakWheels', 'CarFirst'];
  const source = validSources.find((s) =>
    platformRaw.toLowerCase().includes(s.toLowerCase())
  ) as CarListing['source'] ?? 'Other';

  // image_urls is TEXT[] in Supabase — take the first one
  const imageUrls: string[] = Array.isArray(raw.image_urls)
    ? (raw.image_urls as string[])
    : [];
  const imageUrl = imageUrls[0] ?? undefined;

  // ai_label from Gemini (e.g. "Great Deal", "Overpriced") — also used as dealRating
  const aiLabel = raw.ai_label ? String(raw.ai_label) : undefined;
  const VALID_RATINGS = ['Great Deal', 'Good Deal', 'Fair Deal', 'Fair Price', 'Overpriced'];
  const dealRating = VALID_RATINGS.includes(aiLabel ?? '')
    ? (aiLabel as CarListing['dealRating'])
    : 'No Rating';

  return {
    id: String(raw.id ?? `api-${index}`),
    title: `${raw.make ?? ''} ${raw.model ?? ''}`.trim() || 'Unknown Car',
    year: Number(raw.year ?? new Date().getFullYear()),
    price,
    priceFormatted,
    mileage,
    mileageFormatted,
    transmission: raw.transmission === 'Manual' ? 'Manual' : 'Automatic',
    fuelType: raw.fuel_type ? String(raw.fuel_type) : undefined,
    city: String(raw.city ?? ''),
    registeredIn: raw.registered_in ? String(raw.registered_in) : undefined,
    engineCapacity: raw.engine_capacity ? Number(raw.engine_capacity) : undefined,
    assembly: raw.assembly ? String(raw.assembly) : undefined,
    color: raw.color ? String(raw.color) : undefined,
    bodyType: raw.body_type ? String(raw.body_type) : undefined,
    source,
    sourcePlatform: platformRaw || undefined,
    sourceUrl: String(raw.url ?? '#'),          // DB column is `url` (the original listing URL)
    imageUrl,
    imageUrls: imageUrls.length ? imageUrls : undefined,
    aiScore: raw.ai_score != null ? Number(raw.ai_score) : undefined,
    aiLabel,
    aiSummary: raw.ai_summary ? String(raw.ai_summary) : undefined,
    dealRating,
  };
}

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [displayedCars, setDisplayedCars] = useState<CarListing[]>(SAMPLE_CARS);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [interpretedFilters, setInterpretedFilters] = useState<SearchFilters | null>(null);

  /* ── Persist favorites ─────────────────────────────────────── */
  useEffect(() => {
    const saved = localStorage.getItem('garilelo-favorites');
    if (saved) {
      try { setFavorites(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, []);

  /* ── Stamp isFavorite onto whichever list is displayed ──────── */
  const stampFavorites = useCallback(
    (cars: CarListing[], favsList: string[]) =>
      cars.map((car) => ({ ...car, isFavorite: favsList.includes(car.id) })),
    []
  );

  /* ── API search (calls Gemini → Supabase on the server) ─────── */
  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setDisplayedCars(stampFavorites(SAMPLE_CARS, favorites));
        setHasSearched(false);
        setSearchError(null);
        return;
      }

      setIsSearching(true);
      setSearchError(null);
      setHasSearched(true);
      setInterpretedFilters(null);

      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userQuery: query }),
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data?.error ?? `Server error (${res.status})`);
        }

        // Store what Gemini understood so we can show the feedback banner
        if (data.interpretedFilters) {
          setInterpretedFilters(data.interpretedFilters as SearchFilters);
        }

        const apiCars: CarListing[] = (data.results ?? []).map(
          (raw: Record<string, unknown>, i: number) => normalizeApiCar(raw, i)
        );

        // If Supabase has no data yet, fall back to client-side filtered sample cars
        if (apiCars.length === 0) {
          const fallback = clientSideFilter(SAMPLE_CARS, query);
          setDisplayedCars(stampFavorites(fallback, favorites));
        } else {
          setDisplayedCars(stampFavorites(apiCars, favorites));
        }
      } catch (err) {
        console.error('Search error:', err);
        const message = err instanceof Error ? err.message : 'Search failed.';
        setSearchError(message);
        setInterpretedFilters(null);
        // Still show client-side results so the page doesn't go blank
        setDisplayedCars(stampFavorites(clientSideFilter(SAMPLE_CARS, query), favorites));
      } finally {
        setIsSearching(false);
      }
    },
    [favorites, stampFavorites]
  );

  /* ── Quick-filter chip click ─────────────────────────────────── */
  const handleFilterClick = useCallback(
    (filter: QuickFilter) => {
      setSearchQuery(filter.query);
      handleSearch(filter.query);
    },
    [handleSearch]
  );

  /* ── View deal ──────────────────────────────────────────────── */
  const handleViewDeal = (car: CarListing) => {
    window.open(car.sourceUrl, '_blank', 'noopener,noreferrer');
  };

  /* ── Toggle favorite ────────────────────────────────────────── */
  const handleToggleFavorite = (car: CarListing) => {
    setFavorites((prev) => {
      const next = prev.includes(car.id)
        ? prev.filter((id) => id !== car.id)
        : [...prev, car.id];
      localStorage.setItem('garilelo-favorites', JSON.stringify(next));
      // Re-stamp the currently displayed list
      setDisplayedCars((cars) => stampFavorites(cars, next));
      return next;
    });
  };

  // Build non-null filter chips for the AI feedback banner
  const filterChips = interpretedFilters
    ? Object.entries(interpretedFilters)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => {
          const labels: Record<string, string> = {
            make: '🚗', model: '📋', max_price: '💰',
            city: '📍', transmission: '⚙️', color: '🎨',
          };
          const val = k === 'max_price'
            ? `Under PKR ${Number(v).toLocaleString('en-PK')}`
            : String(v);
          return { key: k, label: `${labels[k] ?? ''} ${val}`.trim() };
        })
    : [];

  return (
    <div className="app-shell">
      <Navbar />
      <main className="main-content">
        <Hero
          quickFilters={QUICK_FILTERS}
          query={searchQuery}
          setQuery={setSearchQuery}
          onSearch={handleSearch}
          onFilterClick={handleFilterClick}
          isSearching={isSearching}
        />

        {/* AI Feedback Banner — shows what Gemini understood */}
        {filterChips.length > 0 && !isSearching && (
          <div className="ai-feedback-banner" role="status" aria-live="polite">
            <span className="ai-feedback-label">AI understood:</span>
            {filterChips.map(({ key, label }) => (
              <span key={key} className="ai-feedback-chip">{label}</span>
            ))}
          </div>
        )}

        {/* Search error message */}
        {searchError && (
          <div className="search-error-banner" role="alert">
            ⚠ {searchError}
          </div>
        )}

        <CarGrid
          cars={displayedCars}
          onViewDeal={handleViewDeal}
          onToggleFavorite={handleToggleFavorite}
          isLoading={isSearching}
          hasSearched={hasSearched}
        />
      </main>
      <Footer />
    </div>
  );
}

/* ── Client-side keyword filter (fallback when API has no data) ── */
function clientSideFilter(cars: CarListing[], query: string): CarListing[] {
  if (!query.trim()) return cars;
  const q = query.toLowerCase();

  const isUnder30L = /under\s*30/.test(q);
  const isUnder50L = /under\s*50/.test(q);
  const isAutomatic = q.includes('automatic') || q.includes('auto');
  const isManual = q.includes('manual');
  const isLowMileage = q.includes('low mileage') || q.includes('mileage');
  const isFuelEco = q.includes('fuel efficient') || q.includes('efficient') || q.includes('economy');
  const isSUV = q.includes('suv') || q.includes('prado') || q.includes('sportage');

  return cars.filter((car) => {
    if (isUnder30L && car.price > 3_000_000) return false;
    if (isUnder50L && car.price > 5_000_000) return false;
    if (isAutomatic && car.transmission !== 'Automatic') return false;
    if (isManual && car.transmission !== 'Manual') return false;
    if (isLowMileage && car.mileage > 30_000) return false;
    if (isFuelEco && !['suzuki alto', 'suzuki cultus', 'suzuki swift'].some((m) => car.title.toLowerCase().includes(m))) return false;
    if (isSUV && !['sportage', 'prado'].some((m) => car.title.toLowerCase().includes(m))) return false;

    const cleanQ = q
      .replace(/family\s*car|under\s*\d+\s*lac[s]?|under\s*\d+[lL]|automatic|manual|low\s*mileage|fuel\s*efficient|efficient|economy|suv|car/g, '')
      .trim();
    if (cleanQ) {
      return (
        car.title.toLowerCase().includes(cleanQ) ||
        car.city.toLowerCase().includes(cleanQ) ||
        car.source.toLowerCase().includes(cleanQ)
      );
    }
    return true;
  });
}
