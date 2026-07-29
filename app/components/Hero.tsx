'use client';

import SearchBar from './SearchBar';
import QuickFilters from './QuickFilters';
import type { QuickFilter } from '../types';
import { motion } from 'framer-motion';

interface HeroProps {
  quickFilters: QuickFilter[];
  query: string;
  setQuery: (query: string) => void;
  onSearch?: (query: string) => void;
  onFilterClick?: (filter: QuickFilter) => void;
  isSearching?: boolean;
}

export default function Hero({ quickFilters, query, setQuery, onSearch, onFilterClick, isSearching }: HeroProps) {
  return (
    <section className="hero" id="hero-section">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
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
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <SearchBar
        query={query}
        setQuery={setQuery}
        onSearch={onSearch}
        isSearching={isSearching}
      />
      </motion.div>

      {/* Quick filters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <QuickFilters filters={quickFilters} onFilterClick={onFilterClick} />
      </motion.div>
    </section>
  );
}
