'use client';

import { useState } from 'react';
import type { CarListing, SortOption } from '../types';
import CarCard from './CarCard';

interface CarGridProps {
  cars: CarListing[];
  onViewDeal?: (car: CarListing) => void;
  onToggleFavorite?: (car: CarListing) => void;
  isLoading?: boolean;
  hasSearched?: boolean;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance',   label: 'Relevance' },
  { value: 'price-asc',   label: 'Price: Low → High' },
  { value: 'price-desc',  label: 'Price: High → Low' },
  { value: 'year-desc',   label: 'Year: Newest' },
  { value: 'mileage-asc', label: 'Mileage: Lowest' },
];

function sortCars(cars: CarListing[], sort: SortOption): CarListing[] {
  const copy = [...cars];
  switch (sort) {
    case 'price-asc':   return copy.sort((a, b) => a.price - b.price);
    case 'price-desc':  return copy.sort((a, b) => b.price - a.price);
    case 'year-desc':   return copy.sort((a, b) => b.year - a.year);
    case 'mileage-asc': return copy.sort((a, b) => a.mileage - b.mileage);
    default:            return copy;
  }
}

export default function CarGrid({
  cars,
  onViewDeal,
  onToggleFavorite,
  isLoading = false,
  hasSearched = false,
}: CarGridProps) {
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const sorted = sortCars(cars, sortBy);

  return (
    <section className="car-grid-section" id="car-grid-section">
      {/* ── Header row ─────────────────────────────────────── */}
      <div className="car-grid-header">
        <p className="car-grid-count">
          {isLoading ? (
            <span>Searching with AI…</span>
          ) : (
            <>
              <strong>{cars.length}</strong>{' '}
              {hasSearched ? 'results found' : 'cars featured'}
            </>
          )}
        </p>

        <div className="car-grid-sort">
          <label htmlFor="sort-select" className="car-grid-sort-label">
            Sort by:
          </label>
          <select
            id="sort-select"
            className="car-grid-sort-select"
            value={sortBy}
            disabled={isLoading}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Grid ───────────────────────────────────────────── */}
      {isLoading ? (
        <div className="car-grid-loading" id="car-grid-loading" aria-live="polite">
          <div className="spinner-large" aria-hidden="true" />
          <p>Our AI is analysing your query…</p>
        </div>
      ) : sorted.length > 0 ? (
        <div className="car-grid" id="car-grid">
          {sorted.map((car) => (
            <CarCard
              key={car.id}
              car={car}
              onViewDeal={onViewDeal}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      ) : hasSearched ? (
        <div className="car-grid-empty" id="car-grid-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p>No cars found. Try a different search.</p>
        </div>
      ) : (
        <div className="car-grid-empty" id="car-grid-welcome">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
            <path d="M19 17H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l2-3h8l2 3h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2z"/>
            <circle cx="12" cy="12" r="2.5"/>
          </svg>
          <p>Type anything above to find your perfect car.</p>
          <p style={{ fontSize: '13px', opacity: 0.6, marginTop: 4 }}>
            Try &quot;White automatic Civic in Islamabad under 70 lac&quot;
          </p>
        </div>
      )}
    </section>
  );
}
