'use client';

import type { CarListing } from '../types';
import { motion } from 'framer-motion';

interface CarCardProps {
  car: CarListing;
  onViewDeal?: (car: CarListing) => void;
  onToggleFavorite?: (car: CarListing) => void;
}

/* ── Helper: ai_label / dealRating → CSS modifier class ──────── */
function dealClass(label: string | undefined, rating: CarListing['dealRating']): string {
  const value = (label ?? rating ?? '').toLowerCase();
  if (value.includes('great'))      return 'deal-great';
  if (value.includes('good'))       return 'deal-good';
  if (value.includes('fair'))       return 'deal-fair';
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

/* ── Inline SVG icons (correct semantic icons) ─────────────────── */

/** Odometer / mileage — speedometer needle */
function MileageIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 1 0 10 10" />
      <path d="M12 6v2" />
      <path d="M6.3 9 8 10.5" />
      <path d="M12 12l4-4" />
    </svg>
  );
}

/** Transmission — gear/cog */
function TransmissionIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

/** Location — map pin */
function LocationIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

/** Engine — wrench (universally recognized for engine/mechanical) */
function EngineIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  );
}

/** AI star */
function StarIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
    </svg>
  );
}

export default function CarCard({ car, onViewDeal, onToggleFavorite }: CarCardProps) {
  const isFav = car.isFavorite ?? false;

  const displayLabel = car.aiLabel ?? (car.dealRating !== 'No Rating' ? car.dealRating : null);
  const scoreDisplay = car.aiScore != null ? car.aiScore : null;

  const handleFav = () => onToggleFavorite?.(car);

  return (
    <motion.article 
      className="car-card" 
      id={`car-${car.id}`}
      layout
      variants={{
        hidden: { opacity: 0, y: 30, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } }
      }}
      initial="hidden"
      animate="visible"
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      whileHover={{ y: -8, transition: { duration: 0.2 } }}
    >
      {/* Image area */}
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
            <StarIcon />
            {scoreDisplay}
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="car-card-body">
        <h3 className="car-card-title">
          {car.title} <span className="car-card-year">{car.year}</span>
        </h3>

        {/* Price row with AI deal label */}
        <div className="car-card-price-row">
          <span className="car-card-price">{car.priceFormatted}</span>
          {displayLabel && (
            <span className={`car-card-deal ${dealClass(car.aiLabel, car.dealRating)}`}>
              {displayLabel}
            </span>
          )}
        </div>

        {/* AI one-line summary */}
        {car.aiSummary && (
          <p className="car-card-ai-summary">
            <StarIcon />
            {car.aiSummary}
          </p>
        )}

        {/* Meta row */}
        <div className="car-card-meta">
          <span className="car-card-meta-item" title={car.mileageFormatted}>
            <MileageIcon />
            {car.mileageFormatted}
          </span>
          <span className="car-card-meta-item" title={car.transmission}>
            <TransmissionIcon />
            {car.transmission}
          </span>
          <span className="car-card-meta-item car-card-meta-city" title={car.city}>
            <LocationIcon />
            <span className="meta-city-text">{car.city}</span>
          </span>
          {car.engineCapacity && (
            <span className="car-card-meta-item" title={`${car.engineCapacity}cc`}>
              <EngineIcon />
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
    </motion.article>
  );
}
