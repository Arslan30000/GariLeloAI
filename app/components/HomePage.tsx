'use client';

import Navbar from './Navbar';
import Hero from './Hero';
import CarGrid from './CarGrid';
import Footer from './Footer';
import type { CarListing, QuickFilter } from '../types';

/* ── Sample quick filters (driven by data, not hardcoded markup) ─ */
const QUICK_FILTERS: QuickFilter[] = [
  { id: 'family-30', label: 'Family Cars under 30L', query: 'family car under 30 lac' },
  { id: 'fuel-eco',  label: 'Great Fuel Economy',    query: 'fuel efficient car' },
  { id: 'low-mile',  label: 'Low Mileage SUVs',      query: 'low mileage SUV' },
  { id: 'auto-50',   label: 'Automatic under 50L',    query: 'automatic under 50 lac' },
  { id: 'civic-isl', label: 'Honda Civic Islamabad',  query: 'Honda Civic Islamabad' },
];

/* ── Sample cars (empty by default — populate with your data) ──── */
const SAMPLE_CARS: CarListing[] = [
  // This array is intentionally left empty.
  // You will populate it from your API / backend.
  // Example shape for reference (uncomment or add entries):
  // {
  //   id: '1',
  //   title: 'Suzuki Swift GLX',
  //   year: 2023,
  //   price: 3450000,
  //   priceFormatted: 'PKR 34.50L',
  //   mileage: 1800,
  //   mileageFormatted: '1,800 km',
  //   transmission: 'Automatic',
  //   city: 'Karachi',
  //   source: 'OLX',
  //   sourceUrl: '#',
  //   aiScore: 95,
  //   dealRating: 'Great Deal',
  // },
];

export default function HomePage() {
  const handleSearch = (query: string) => {
    console.log('Search:', query);
    // TODO: Wire up to your search API
  };

  const handleFilterClick = (filter: QuickFilter) => {
    console.log('Quick filter:', filter.query);
    // TODO: Wire up to your search API
  };

  const handleViewDeal = (car: CarListing) => {
    window.open(car.sourceUrl, '_blank', 'noopener,noreferrer');
  };

  const handleToggleFavorite = (car: CarListing) => {
    console.log('Toggle fav:', car.id);
    // TODO: Wire up to your favorites logic
  };

  return (
    <div className="app-shell">
      <Navbar />
      <main className="main-content">
        <Hero
          quickFilters={QUICK_FILTERS}
          onSearch={handleSearch}
          onFilterClick={handleFilterClick}
        />
        <CarGrid
          cars={SAMPLE_CARS}
          onViewDeal={handleViewDeal}
          onToggleFavorite={handleToggleFavorite}
        />
      </main>
      <Footer />
    </div>
  );
}
