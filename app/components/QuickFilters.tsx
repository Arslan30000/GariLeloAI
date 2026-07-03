'use client';

import type { QuickFilter } from '../types';

interface QuickFiltersProps {
  filters: QuickFilter[];
  onFilterClick?: (filter: QuickFilter) => void;
}

export default function QuickFilters({ filters, onFilterClick }: QuickFiltersProps) {
  if (filters.length === 0) return null;

  return (
    <div className="quick-filters" id="quick-filters">
      {filters.map((filter) => (
        <button
          key={filter.id}
          className="quick-filter-tag"
          id={`filter-${filter.id}`}
          onClick={() => onFilterClick?.(filter)}
        >
          {filter.label}
        </button>
      ))}
    </div>
  );
}
