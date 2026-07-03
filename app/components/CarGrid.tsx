'use client';

import { useState } from 'react';
import type { CarListing, SortOption } from '../types';
import CarCard from './CarCard';

interface CarGridProps {
  cars: CarListing[];
  onViewDeal?: (car: CarListing) => void;
  onToggleFavorite?: (car: CarListing) => void;
}

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'relevance',  label: 'Relevance' },
  { value: 'price-asc',  label: 'Price: Low → High' },
  { value: 'price-desc', label: 'Price: High → Low' },
  { value: 'year-desc',  label: 'Year: Newest' },
  { value: 'mileage-asc', label: 'Mileage: Lowest' },
];

function sortCars(cars: CarListing[], sort: SortOption): CarListing[] {
  const copy = [...cars];
  switch (sort) {
    case 'price-asc':
      return copy.sort((a, b) => a.price - b.price);
    case 'price-desc':
      return copy.sort((a, b) => b.price - a.price);
    case 'year-desc':
      return copy.sort((a, b) => b.year - a.year);
    case 'mileage-asc':
      return copy.sort((a, b) => a.mileage - b.mileage);
    default:
      return copy;
  }
}

export default function CarGrid({ cars, onViewDeal, onToggleFavorite }: CarGridProps) {
  const [sortBy, setSortBy] = useState<SortOption>('relevance');
  const sorted = sortCars(cars, sortBy);

  return (
    <section className="car-grid-section" id="car-grid-section">
      {/* ── Header row ─────────────────────────────────────── */}
      <div className="car-grid-header">
        <p className="car-grid-count">
          <strong>{cars.length}</strong> cars found
        </p>

        <div className="car-grid-sort">
          <label htmlFor="sort-select" className="car-grid-sort-label">
            Sort by:
          </label>
          <select
            id="sort-select"
            className="car-grid-sort-select"
            value={sortBy}
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
      {sorted.length > 0 ? (
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
      ) : (
        <div className="car-grid-empty" id="car-grid-empty">
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.3">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <p>No cars found. Try a different search.</p>
        </div>
      )}
    </section>
  );
}
