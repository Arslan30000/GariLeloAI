'use client';

import { useState } from 'react';

interface SearchBarProps {
  placeholder?: string;
  query: string;
  setQuery: (query: string) => void;
  onSearch?: (query: string) => void;
  isSearching?: boolean;
}

export default function SearchBar({
  placeholder = 'e.g., Automatic Honda Civic under 40 lac in Islamabad...',
  query,
  setQuery,
  onSearch,
  isSearching = false,
}: SearchBarProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isSearching) onSearch?.(query);
  };

  return (
    <form className="search-bar" id="search-bar" onSubmit={handleSubmit}>
      <div className="search-bar-inner">
        <svg
          className="search-bar-icon"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>

        <input
          type="text"
          className="search-bar-input"
          id="search-input"
          placeholder={placeholder}
          value={query}
          disabled={isSearching}
          onChange={(e) => setQuery(e.target.value)}
        />

        <button
          type="submit"
          className={`search-bar-btn${isSearching ? ' is-loading' : ''}`}
          id="search-submit-btn"
          disabled={isSearching}
          aria-label={isSearching ? 'Searching…' : 'Search'}
        >
          {isSearching ? (
            /* Simple CSS spinner — animate via globals.css .is-loading */
            <span className="spinner" aria-hidden="true" />
          ) : (
            <>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>Search</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
