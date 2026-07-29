'use client';

import { useState } from 'react';
import type { SearchFilters } from '../types';

interface AdvancedFiltersProps {
  manualFilters: Partial<SearchFilters>;
  setManualFilters: (filters: Partial<SearchFilters>) => void;
  onApply: () => void;
  onClose: () => void;
}

export default function AdvancedFilters({
  manualFilters,
  setManualFilters,
  onApply,
  onClose,
}: AdvancedFiltersProps) {
  // Local state for sliders/inputs before they are applied
  const [localFilters, setLocalFilters] = useState<Partial<SearchFilters>>(manualFilters);

  const handleUpdate = (key: keyof SearchFilters, value: any) => {
    setLocalFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    setManualFilters(localFilters);
    onApply();
  };

  const handleClear = () => {
    setLocalFilters({});
    setManualFilters({});
    onApply();
  };

  return (
    <div className="advanced-filters-panel">
      <div className="af-header">
        <h3>Advanced Filters</h3>
        <button className="af-close-btn" onClick={onClose} aria-label="Close filters">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div className="af-grid">
        {/* Price Range */}
        <div className="af-group">
          <label>Max Price (PKR)</label>
          <select
            value={localFilters.max_price || ''}
            onChange={(e) => handleUpdate('max_price', e.target.value ? Number(e.target.value) : null)}
            className="af-select"
          >
            <option value="">Any Price</option>
            <option value="1000000">Under 10 Lac</option>
            <option value="2000000">Under 20 Lac</option>
            <option value="3000000">Under 30 Lac</option>
            <option value="5000000">Under 50 Lac</option>
            <option value="10000000">Under 1 Crore</option>
          </select>
        </div>

        {/* Body Type */}
        <div className="af-group">
          <label>Body Type</label>
          <select
            value={localFilters.body_type || ''}
            onChange={(e) => handleUpdate('body_type', e.target.value || null)}
            className="af-select"
          >
            <option value="">All Types</option>
            <option value="Sedan">Sedan</option>
            <option value="Hatchback">Hatchback</option>
            <option value="SUV">SUV</option>
            <option value="Van">Van / Minivan</option>
            <option value="Crossover">Crossover</option>
            <option value="Pickup">Pickup</option>
          </select>
        </div>

        {/* AI Score */}
        <div className="af-group">
          <label>Minimum AI Score</label>
          <div className="af-slider-wrap">
            <input
              type="range"
              min="0"
              max="10"
              value={localFilters.ai_score_min || 0}
              onChange={(e) => handleUpdate('ai_score_min', Number(e.target.value))}
              className="af-slider"
            />
            <span className="af-slider-val">{localFilters.ai_score_min || 'Any'}</span>
          </div>
        </div>

        {/* Engine Capacity */}
        <div className="af-group">
          <label>Min Engine Capacity (cc)</label>
          <select
            value={localFilters.engine_capacity || ''}
            onChange={(e) => handleUpdate('engine_capacity', e.target.value ? Number(e.target.value) : null)}
            className="af-select"
          >
            <option value="">Any</option>
            <option value="660">660cc +</option>
            <option value="1000">1000cc +</option>
            <option value="1300">1300cc +</option>
            <option value="1800">1800cc +</option>
          </select>
        </div>

        {/* Call for Price Toggle */}
        <div className="af-group af-group--full">
          <label className="af-checkbox-label">
            <input
              type="checkbox"
              checked={localFilters.include_call_for_price === true}
              onChange={(e) => handleUpdate('include_call_for_price', e.target.checked ? true : null)}
            />
            Include "Call for Price" (Price = 0) listings
          </label>
          <p className="af-help-text">If disabled, these will be hidden when a max price is set.</p>
        </div>
      </div>

      <div className="af-actions">
        <button className="af-btn-clear" onClick={handleClear}>Clear</button>
        <button className="af-btn-apply" onClick={handleApply}>Apply Filters</button>
      </div>
    </div>
  );
}
