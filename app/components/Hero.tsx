'use client';

import SearchBar from './SearchBar';
import QuickFilters from './QuickFilters';
import type { QuickFilter } from '../types';

interface HeroProps {
  quickFilters: QuickFilter[];
  onSearch?: (query: string) => void;
  onFilterClick?: (filter: QuickFilter) => void;
}

export default function Hero({ quickFilters, onSearch, onFilterClick }: HeroProps) {
  return (
    <section className="hero" id="hero-section">
      {/* Platform banner */}
      <div className="hero-banner">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2L9.19 8.63 2 9.24l5.46 4.73L5.82 21 12 17.27 18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2z" />
        </svg>
        <span>AI-Powered Search · OLX · PakWheels · CarFirst</span>
      </div>

      {/* Headline */}
      <h1 className="hero-headline">
        Find your perfect car{' '}
        <span className="hero-headline-accent">
          without the endless scrolling.
        </span>
      </h1>
      <p className="hero-subtitle">
        Our AI searches all platforms in seconds.
      </p>

      {/* Search */}
      <SearchBar onSearch={onSearch} />

      {/* Quick filters */}
      <QuickFilters filters={quickFilters} onFilterClick={onFilterClick} />
    </section>
  );
}
