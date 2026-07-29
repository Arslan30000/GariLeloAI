'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Navbar from './Navbar';
import Hero from './Hero';
import CarGrid from './CarGrid';
import CarCard from './CarCard';
import Footer from './Footer';
import AdvancedFilters from './AdvancedFilters';
import type { CarListing, QuickFilter, SearchFilters } from '../types';

type ActivePage = 'home' | 'saved' | 'trends';

/* ── Quick filters ──────────────────────────────────────────────── */
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

  const platformRaw = String(raw.source_platform ?? raw.source ?? '');
  const validSources = ['OLX', 'PakWheels', 'CarFirst'];
  const source = validSources.find((s) =>
    platformRaw.toLowerCase().includes(s.toLowerCase())
  ) as CarListing['source'] ?? 'Other';

  const imageUrls: string[] = Array.isArray(raw.image_urls)
    ? (raw.image_urls as string[])
    : [];
  const imageUrl = imageUrls[0] ?? undefined;

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
    sourceUrl: String(raw.url ?? '#'),
    imageUrl,
    imageUrls: imageUrls.length ? imageUrls : undefined,
    aiScore: raw.ai_score != null ? Number(raw.ai_score) : undefined,
    aiLabel,
    aiSummary: raw.ai_summary ? String(raw.ai_summary) : undefined,
    dealRating,
  };
}

/* ── Saved Cars Panel ───────────────────────────────────────────── */
function SavedCarsPanel({
  savedCars,
  onViewDeal,
  onToggleFavorite,
}: {
  savedCars: CarListing[];
  onViewDeal: (car: CarListing) => void;
  onToggleFavorite: (car: CarListing) => void;
}) {
  if (savedCars.length === 0) {
    return (
      <div className="page-panel">
        <div className="page-panel-header">
          <h2 className="page-panel-title">Saved Cars</h2>
          <p className="page-panel-subtitle">Your bookmarked listings appear here.</p>
        </div>
        <div className="car-grid-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
          </svg>
          <p>No saved cars yet.</p>
          <p style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>
            Click the heart icon on any listing to save it here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-panel">
      <div className="page-panel-header">
        <h2 className="page-panel-title">Saved Cars</h2>
        <p className="page-panel-subtitle">{savedCars.length} saved listing{savedCars.length !== 1 ? 's' : ''}</p>
      </div>
      <div className="car-grid">
        {savedCars.map((car) => (
          <CarCard
            key={car.id}
            car={{ ...car, isFavorite: true }}
            onViewDeal={onViewDeal}
            onToggleFavorite={onToggleFavorite}
          />
        ))}
      </div>
    </div>
  );
}

/* ── Market Trends Panel ────────────────────────────────────────── */
function MarketTrendsPanel({ cars }: { cars: CarListing[] }) {
  const stats = useMemo(() => {
    if (cars.length === 0) return null;

    // Deal distribution
    const dealCounts: Record<string, number> = {};
    cars.forEach((c) => {
      const label = c.aiLabel ?? 'Unevaluated';
      dealCounts[label] = (dealCounts[label] ?? 0) + 1;
    });

    // Average price by top makes
    const byMake: Record<string, number[]> = {};
    cars.forEach((c) => {
      const make = c.title.split(' ')[0];
      if (!byMake[make]) byMake[make] = [];
      if (c.price > 0) byMake[make].push(c.price);
    });
    const makeAvg = Object.entries(byMake)
      .filter(([, prices]) => prices.length >= 2)
      .map(([make, prices]) => ({
        make,
        count: prices.length,
        avg: Math.round(prices.reduce((a, b) => a + b, 0) / prices.length),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Top cities
    const cityCounts: Record<string, number> = {};
    cars.forEach((c) => {
      if (c.city) cityCounts[c.city] = (cityCounts[c.city] ?? 0) + 1;
    });
    const topCities = Object.entries(cityCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const priced = cars.filter((c) => c.price > 0);
    const avgPrice = priced.length
      ? Math.round(priced.reduce((a, c) => a + c.price, 0) / priced.length)
      : 0;
    const minPrice = priced.length ? Math.min(...priced.map((c) => c.price)) : 0;
    const maxPrice = priced.length ? Math.max(...priced.map((c) => c.price)) : 0;

    return { dealCounts, makeAvg, topCities, avgPrice, minPrice, maxPrice, total: cars.length };
  }, [cars]);

  const fmtPKR = (n: number) =>
    n >= 10_000_000
      ? `${(n / 10_000_000).toFixed(1)} Cr`
      : `${(n / 100_000).toFixed(1)} L`;

  const dealColors: Record<string, string> = {
    'Great Deal': '#22c55e',
    'Good Deal': '#eab308',
    'Fair Price': '#f97316',
    'Overpriced': '#ef4444',
    'Unevaluated': '#64748b',
  };

  if (!stats) {
    return (
      <div className="page-panel">
        <div className="page-panel-header">
          <h2 className="page-panel-title">Market Trends</h2>
          <p className="page-panel-subtitle">Search for cars first to see market analytics.</p>
        </div>
        <div className="car-grid-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
            <polyline points="17 6 23 6 23 12" />
          </svg>
          <p>No data yet — run a search first.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-panel">
      <div className="page-panel-header">
        <h2 className="page-panel-title">Market Trends</h2>
        <p className="page-panel-subtitle">Analytics based on {stats.total} listings in the database</p>
      </div>

      {/* Summary cards */}
      <div className="trends-stats-row">
        <div className="trends-stat-card">
          <span className="trends-stat-label">Average Price</span>
          <span className="trends-stat-value">{fmtPKR(stats.avgPrice)}</span>
        </div>
        <div className="trends-stat-card">
          <span className="trends-stat-label">Lowest Price</span>
          <span className="trends-stat-value">{fmtPKR(stats.minPrice)}</span>
        </div>
        <div className="trends-stat-card">
          <span className="trends-stat-label">Highest Price</span>
          <span className="trends-stat-value">{fmtPKR(stats.maxPrice)}</span>
        </div>
        <div className="trends-stat-card">
          <span className="trends-stat-label">Total Listings</span>
          <span className="trends-stat-value">{stats.total}</span>
        </div>
      </div>

      <div className="trends-grid">
        {/* Deal distribution */}
        <div className="trends-card">
          <h3 className="trends-card-title">AI Deal Ratings</h3>
          <div className="trends-deal-list">
            {Object.entries(stats.dealCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([label, count]) => (
                <div key={label} className="trends-deal-row">
                  <span
                    className="trends-deal-dot"
                    style={{ background: dealColors[label] ?? '#64748b' }}
                  />
                  <span className="trends-deal-label">{label}</span>
                  <span className="trends-deal-bar-wrap">
                    <span
                      className="trends-deal-bar"
                      style={{
                        width: `${Math.round((count / stats.total) * 100)}%`,
                        background: dealColors[label] ?? '#64748b',
                      }}
                    />
                  </span>
                  <span className="trends-deal-count">{count}</span>
                </div>
              ))}
          </div>
        </div>

        {/* Top cities */}
        <div className="trends-card">
          <h3 className="trends-card-title">Top Cities</h3>
          <div className="trends-deal-list">
            {stats.topCities.map(([city, count]) => (
              <div key={city} className="trends-deal-row">
                <span className="trends-deal-dot" style={{ background: 'var(--brand)' }} />
                <span className="trends-deal-label">{city}</span>
                <span className="trends-deal-bar-wrap">
                  <span
                    className="trends-deal-bar"
                    style={{
                      width: `${Math.round((count / stats.topCities[0][1]) * 100)}%`,
                      background: 'var(--brand)',
                    }}
                  />
                </span>
                <span className="trends-deal-count">{count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Avg price by make */}
        <div className="trends-card trends-card--wide">
          <h3 className="trends-card-title">Average Price by Make</h3>
          <div className="trends-make-table">
            <div className="trends-make-row trends-make-row--header">
              <span>Make</span>
              <span>Listings</span>
              <span>Avg Price</span>
            </div>
            {stats.makeAvg.map(({ make, count, avg }) => (
              <div key={make} className="trends-make-row">
                <span>{make}</span>
                <span>{count}</span>
                <span>PKR {fmtPKR(avg)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────────────── */
export default function HomePage() {
  const [activePage, setActivePage] = useState<ActivePage>('home');
  const [searchQuery, setSearchQuery] = useState('');
  const [displayedCars, setDisplayedCars] = useState<CarListing[]>([]);
  const [savedCarObjects, setSavedCarObjects] = useState<CarListing[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [interpretedFilters, setInterpretedFilters] = useState<SearchFilters | null>(null);
  
  // Manual Filters State
  const [manualFilters, setManualFilters] = useState<Partial<SearchFilters>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  /* Load saved state from localStorage */
  useEffect(() => {
    const savedIds = localStorage.getItem('garilelo-favorites');
    if (savedIds) {
      try { setFavorites(JSON.parse(savedIds)); } catch { /* ignore */ }
    }
    const savedCarsRaw = localStorage.getItem('garilelo-saved-cars');
    if (savedCarsRaw) {
      try { setSavedCarObjects(JSON.parse(savedCarsRaw)); } catch { /* ignore */ }
    }
  }, []);

  /* Stamp isFavorite */
  const carsWithFavorites = useMemo(
    () => displayedCars.map((car) => ({ ...car, isFavorite: favorites.includes(car.id) })),
    [displayedCars, favorites]
  );

  /* API search */
  const handleSearch = useCallback(
    async (query: string, filtersOverride?: Partial<SearchFilters>) => {
      const filtersToUse = filtersOverride ?? manualFilters;
      if (!query.trim()) {
        setDisplayedCars([]);
        setHasSearched(false);
        setSearchError(null);
        setInterpretedFilters(null);
        return;
      }
      setActivePage('home');
      setIsSearching(true);
      setSearchError(null);
      setHasSearched(true);
      setInterpretedFilters(null);

      try {
        const res = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userQuery: query, manualFilters: filtersToUse }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? `Server error (${res.status})`);
        if (data.interpretedFilters) setInterpretedFilters(data.interpretedFilters as SearchFilters);
        const apiCars: CarListing[] = (data.results ?? []).map(
          (raw: Record<string, unknown>, i: number) => normalizeApiCar(raw, i)
        );
        setDisplayedCars(apiCars);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Search failed.';
        setSearchError(message);
        setInterpretedFilters(null);
        setDisplayedCars([]);
      } finally {
        setIsSearching(false);
      }
    },
    [manualFilters]
  );

  /* Quick filter */
  const handleFilterClick = useCallback(
    (filter: QuickFilter) => {
      setSearchQuery(filter.query);
      void handleSearch(filter.query);
    },
    [handleSearch]
  );

  /* View deal */
  const handleViewDeal = (car: CarListing) => {
    window.open(car.sourceUrl, '_blank', 'noopener,noreferrer');
  };

  /* Toggle favorite — also persist full object */
  const handleToggleFavorite = (car: CarListing) => {
    setFavorites((prevIds) => {
      const isSaved = prevIds.includes(car.id);
      const nextIds = isSaved ? prevIds.filter((id) => id !== car.id) : [...prevIds, car.id];
      localStorage.setItem('garilelo-favorites', JSON.stringify(nextIds));

      setSavedCarObjects((prevCars) => {
        const nextCars = isSaved
          ? prevCars.filter((c) => c.id !== car.id)
          : [...prevCars, car];
        localStorage.setItem('garilelo-saved-cars', JSON.stringify(nextCars));
        return nextCars;
      });

      return nextIds;
    });
  };

  /* AI feedback chips — no emojis */
  const filterChips = interpretedFilters
    ? Object.entries(interpretedFilters)
        .filter(([, v]) => v !== null)
        .map(([k, v]) => {
          const labels: Record<string, string> = {
            make: 'Make', model: 'Model', max_price: 'Max Price',
            city: 'City', transmission: 'Transmission', color: 'Color',
            body_type: 'Body Type', fuel_type: 'Fuel',
          };
          const val = k === 'max_price'
            ? `Under PKR ${Number(v).toLocaleString('en-PK')}`
            : String(v);
          return { key: k, label: `${labels[k] ?? k}: ${val}` };
        })
    : [];

  return (
    <div className="app-shell">
      <Navbar activePage={activePage} onPageChange={setActivePage} />
      <main className="main-content">
        {activePage === 'saved' ? (
          <SavedCarsPanel
            savedCars={savedCarObjects}
            onViewDeal={handleViewDeal}
            onToggleFavorite={handleToggleFavorite}
          />
        ) : activePage === 'trends' ? (
          <MarketTrendsPanel cars={displayedCars.length > 0 ? displayedCars : savedCarObjects} />
        ) : (
          <>
            <Hero
              quickFilters={QUICK_FILTERS}
              query={searchQuery}
              setQuery={setSearchQuery}
              onSearch={handleSearch}
              onFilterClick={handleFilterClick}
              isSearching={isSearching}
            />
            
            {!showAdvanced && !isSearching && (
              <div style={{ textAlign: 'center', marginTop: '-1.5rem', marginBottom: '2rem', position: 'relative', zIndex: 10 }}>
                <button 
                  onClick={() => setShowAdvanced(true)}
                  style={{
                    background: 'var(--bg-surface)', border: '1px solid var(--border)', 
                    padding: '0.5rem 1rem', borderRadius: 'var(--radius-full)',
                    fontSize: '0.9rem', color: 'var(--text-secondary)', cursor: 'pointer',
                    boxShadow: '0 2px 4px rgb(0 0 0 / 0.05)'
                  }}
                >
                  + Advanced Filters
                </button>
              </div>
            )}

            {showAdvanced && (
              <AdvancedFilters
                manualFilters={manualFilters}
                setManualFilters={setManualFilters}
                onApply={() => {
                  setShowAdvanced(false);
                  if (hasSearched) handleSearch(searchQuery);
                }}
                onClose={() => setShowAdvanced(false)}
              />
            )}

            {/* AI Feedback Banner */}
            {filterChips.length > 0 && !isSearching && (
              <div className="ai-feedback-banner" role="status" aria-live="polite">
                <span className="ai-feedback-label">AI understood:</span>
                {filterChips.map(({ key, label }) => (
                  <span key={key} className="ai-feedback-chip">{label}</span>
                ))}
              </div>
            )}

            {/* Search error */}
            {searchError && (
              <div className="search-error-banner" role="alert">
                {searchError}
              </div>
            )}

            <CarGrid
              cars={carsWithFavorites}
              onViewDeal={handleViewDeal}
              onToggleFavorite={handleToggleFavorite}
              isLoading={isSearching}
              hasSearched={hasSearched}
            />
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
