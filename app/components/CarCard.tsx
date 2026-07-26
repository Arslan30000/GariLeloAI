'use client';

import type { CarListing } from '../types';

interface CarCardProps {
  car: CarListing;
  onViewDeal?: (car: CarListing) => void;
  onToggleFavorite?: (car: CarListing) => void;
}

/* ── Helper: ai_label / dealRating → CSS modifier class ──────── */
function dealClass(label: string | undefined, rating: CarListing['dealRating']): string {
  const value = (label ?? rating ?? '').toLowerCase();
  if (value.includes('great'))     return 'deal-great';
  if (value.includes('good'))      return 'deal-good';
  if (value.includes('fair'))      return 'deal-fair';
  if (value.includes('overpriced')) return 'deal-over';
  return 'deal-none';
}

/* ── Helper: source → badge class ─────────────────────────────── */
function sourceClass(source: CarListing['source']): string {
  switch (source) {
    case 'OLX':       return 'source-olx';
    case 'PakWheels': return 'source-pakwheels';
    case 'CarFirst':  return 'source-carfirst';
    default:          return 'source-other';
  }
}

export default function CarCard({ car, onViewDeal, onToggleFavorite }: CarCardProps) {
  // Read isFavorite directly from the prop so the card always reflects
  // the parent's authoritative favorites list (no stale useState).
  const isFav = car.isFavorite ?? false;

  // Prefer the Gemini-generated label from the DB; fall back to dealRating
  const displayLabel = car.aiLabel ?? (car.dealRating !== 'No Rating' ? car.dealRating : null);
  // Use ai_score (1–10 from scraper) — convert to display format
  const scoreDisplay = car.aiScore != null ? car.aiScore : null;

  const handleFav = () => {
    onToggleFavorite?.(car);
  };

  return (
    <article className="car-card" id={`car-${car.id}`}>
      {/* ── Image area ─────────────────────────────────────── */}
      <div className="car-card-image">
        {car.imageUrl ? (
          <img src={car.imageUrl} alt={car.title} loading="lazy" />
        ) : (
          <div className="car-card-placeholder">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" opacity="0.35">
              <path d="M7 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
              <path d="M17 17m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" />
              <path d="M5 17h-2v-6l2-5h9l4 5h1a2 2 0 0 1 2 2v4h-2m-4 0h-6m-6 -6h15m-6 -3l-2 -3" />
            </svg>
          </div>
        )}

        {/* Source badge */}
        <span className={`car-card-source ${sourceClass(car.source)}`}>
          {car.source}
        </span>

        {/* Favorite button */}
        <button
          className={`car-card-fav ${isFav ? 'is-fav' : ''}`}
          onClick={handleFav}
          aria-label={isFav ? 'Remove from favorites' : 'Add to favorites'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={isFav ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
        </button>

        {/* AI Score badge */}
        {scoreDisplay != null && (
          <span className="car-card-ai-score">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
            </svg>
            {scoreDisplay}
          </span>
        )}
      </div>

      {/* ── Card body ──────────────────────────────────────── */}
      <div className="car-card-body">
        <h3 className="car-card-title">
          {car.title} <span className="car-card-year">{car.year}</span>
        </h3>

        {/* Price row with AI deal label */}
        <div className="car-card-price-row">
          <span className="car-card-price">{car.priceFormatted}</span>
          {displayLabel && (
            <span className={`car-card-deal ${dealClass(car.aiLabel, car.dealRating)}`}>
              {displayLabel.includes('Great') && '● '}{displayLabel}
            </span>
          )}
        </div>

        {/* AI one-line summary from Gemini (only when scraped from DB) */}
        {car.aiSummary && (
          <p className="car-card-ai-summary">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 4, opacity: 0.7, flexShrink: 0 }}>
              <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
            </svg>
            {car.aiSummary}
          </p>
        )}

        {/* Meta row */}
        <div className="car-card-meta">
          <span className="car-card-meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 20V10M18 20V4M6 20v-4" />
            </svg>
            {car.mileageFormatted}
          </span>
          <span className="car-card-meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <path d="M16 12h-4V8" />
            </svg>
            {car.transmission}
          </span>
          <span className="car-card-meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            {car.city}
          </span>
          {car.engineCapacity && (
            <span className="car-card-meta-item">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                <line x1="12" y1="12" x2="12" y2="16" />
              </svg>
              {car.engineCapacity}cc
            </span>
          )}
        </div>

        <a
          href={car.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="car-card-cta"
          id={`view-deal-${car.id}`}
          onClick={(e) => {
            if (onViewDeal) {
              e.preventDefault();
              onViewDeal(car);
            }
          }}
        >
          View Deal
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </a>
      </div>
    </article>
  );
}
