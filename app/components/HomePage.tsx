'use client';

import { useState, useEffect, useCallback } from 'react';
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

/* ── Sample cars (populated with Pakistani car details and external links only) ──── */
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
  }
];

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredCars, setFilteredCars] = useState<CarListing[]>(SAMPLE_CARS);
  const [favorites, setFavorites] = useState<string[]>([]);

  // Load favorites from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('garilelo-favorites');
    if (saved) {
      try {
        setFavorites(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Filter cars client-side whenever searchQuery or favorites list changes
  const applyFilter = useCallback((query: string, favsList: string[]) => {
    let result = [...SAMPLE_CARS];

    // Map favorites state onto the listing objects
    result = result.map(car => ({
      ...car,
      isFavorite: favsList.includes(car.id)
    }));

    if (query.trim()) {
      const q = query.toLowerCase();

      // Simple keyword matching for standard requirements (AI-like parsing)
      const isUnder30L = q.includes('under 30 lac') || q.includes('under 30l') || q.includes('under 30');
      const isUnder50L = q.includes('under 50 lac') || q.includes('under 50l') || q.includes('under 50');
      const isAutomatic = q.includes('automatic') || q.includes('auto');
      const isManual = q.includes('manual');
      const isLowMileage = q.includes('low mileage') || q.includes('mileage');
      const isFuelEco = q.includes('fuel efficient') || q.includes('fuel eco') || q.includes('efficient') || q.includes('economy');
      const isSUV = q.includes('suv') || q.includes('prado') || q.includes('sportage');

      result = result.filter((car) => {
        // Price filters
        if (isUnder30L && car.price > 3000000) return false;
        if (isUnder50L && car.price > 5000000) return false;

        // Transmission filters
        if (isAutomatic && car.transmission !== 'Automatic') return false;
        if (isManual && car.transmission !== 'Manual') return false;

        // Mileage filters
        if (isLowMileage && car.mileage > 30000) return false;

        // Fuel economy filters (Alto, Cultus, Swift)
        if (isFuelEco && !['suzuki alto', 'suzuki cultus', 'suzuki swift'].some(model => car.title.toLowerCase().includes(model))) return false;

        // SUV filter
        if (isSUV && !['sportage', 'prado'].some(model => car.title.toLowerCase().includes(model))) return false;

        // General text search (removes the keywords and searches title/city/source)
        const cleanQuery = q
          .replace('family car', '')
          .replace('under 30 lac', '')
          .replace('under 30l', '')
          .replace('under 30', '')
          .replace('under 50 lac', '')
          .replace('under 50l', '')
          .replace('under 50', '')
          .replace('automatic', '')
          .replace('manual', '')
          .replace('low mileage', '')
          .replace('fuel efficient', '')
          .replace('efficient', '')
          .replace('car', '')
          .replace('suv', '')
          .trim();

        if (cleanQuery) {
          const matchTitle = car.title.toLowerCase().includes(cleanQuery);
          const matchCity = car.city.toLowerCase().includes(cleanQuery);
          const matchSource = car.source.toLowerCase().includes(cleanQuery);
          return matchTitle || matchCity || matchSource;
        }

        return true;
      });
    }

    setFilteredCars(result);
  }, []);

  useEffect(() => {
    applyFilter(searchQuery, favorites);
  }, [searchQuery, favorites, applyFilter]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
  };

  const handleFilterClick = (filter: QuickFilter) => {
    setSearchQuery(filter.query);
  };

  const handleViewDeal = (car: CarListing) => {
    window.open(car.sourceUrl, '_blank', 'noopener,noreferrer');
  };

  const handleToggleFavorite = (car: CarListing) => {
    setFavorites((prev) => {
      const next = prev.includes(car.id)
        ? prev.filter((id) => id !== car.id)
        : [...prev, car.id];
      localStorage.setItem('garilelo-favorites', JSON.stringify(next));
      return next;
    });
  };

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
        />
        <CarGrid
          cars={filteredCars}
          onViewDeal={handleViewDeal}
          onToggleFavorite={handleToggleFavorite}
        />
      </main>
      <Footer />
    </div>
  );
}
