'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [displayedCars, setDisplayedCars] = useState<CarListing[]>([]);
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

  /* ── Stamp isFavorite onto the displayed list ───────────────── */
  const carsWithFavorites = useMemo(
    () => displayedCars.map((car) => ({ ...car, isFavorite: favorites.includes(car.id) })),
    [displayedCars, favorites]
  );

  /* ── API search (calls Gemini → Supabase on the server) ─────── */
  const handleSearch = useCallback(
    async (query: string) => {
      if (!query.trim()) {
        setDisplayedCars([]);
        setHasSearched(false);
        setSearchError(null);
        setInterpretedFilters(null);
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

        if (data.interpretedFilters) {
          setInterpretedFilters(data.interpretedFilters as SearchFilters);
        }

        const apiCars: CarListing[] = (data.results ?? []).map(
          (raw: Record<string, unknown>, i: number) => normalizeApiCar(raw, i)
        );
        setDisplayedCars(apiCars);
      } catch (err) {
        console.error('Search error:', err);
        const message = err instanceof Error ? err.message : 'Search failed.';
        setSearchError(message);
        setInterpretedFilters(null);
        setDisplayedCars([]);
      } finally {
        setIsSearching(false);
      }
    },
    [favorites]
  );

  /* ── Quick-filter chip click ─────────────────────────────────── */
  const handleFilterClick = useCallback(
    (filter: QuickFilter) => {
      setSearchQuery(filter.query);
      void handleSearch(filter.query);
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
          cars={carsWithFavorites}
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


