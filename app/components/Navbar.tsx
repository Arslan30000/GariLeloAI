'use client';

import { useTheme } from './ThemeProvider';

/* ── SVG icons ──────────────────────────────────────────────────── */

function CarIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 16H9m10 0h3v-3.15a1 1 0 0 0-.84-.99L16 11l-2.7-3.6a2 2 0 0 0-1.6-.8H9.3a2 2 0 0 0-1.6.8L5 11l-5.16.86a1 1 0 0 0-.84.99V16h3m10 0a2.5 2.5 0 1 1-5 0m5 0a2.5 2.5 0 1 0-5 0m-10 0a2.5 2.5 0 1 1-5 0m5 0a2.5 2.5 0 1 0-5 0"/>
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function TrendingIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

/* ── Component ──────────────────────────────────────────────────── */

interface NavbarProps {
  activePage?: 'home' | 'saved' | 'trends';
  onPageChange?: (page: 'home' | 'saved' | 'trends') => void;
}

export default function Navbar({ activePage = 'home', onPageChange }: NavbarProps) {
  const { theme, toggleTheme, mounted } = useTheme();

  return (
    <nav className="navbar" id="main-navbar">
      <div className="navbar-inner">
        {/* Logo */}
        <button
          className="navbar-logo"
          id="navbar-logo"
          onClick={() => onPageChange?.('home')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '12px' }}
        >
          <svg width="42" height="42" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="4" y="4" width="92" height="92" fill="#5b85ff" stroke="#000" strokeWidth="8" />
            <path d="M35 96 V50 C35 35 45 25 70 22 H96 V96 Z" fill="#FFF" stroke="#000" strokeWidth="8" strokeLinejoin="round" />
            <path d="M42 50 C48 40 58 35 70 35 H96 V50 Z" fill="#fff" stroke="#000" strokeWidth="6" strokeLinejoin="round" />
            <path d="M42 50 C48 40 58 35 70 35 H96" fill="none" stroke="#000" strokeWidth="6" />
            <ellipse cx="26" cy="46" rx="10" ry="6" fill="#000" />
            <path d="M38 65 Q55 60 96 60" fill="none" stroke="#000" strokeWidth="6" />
            <path d="M42 58 Q52 55 65 58" fill="none" stroke="#000" strokeWidth="8" strokeLinecap="round" />
            <path d="M42 80 Q60 85 96 80" fill="none" stroke="#000" strokeWidth="6" />
            <path d="M50 96 V82 Q50 72 65 72 Q80 72 80 82 V96" fill="#000" />
            <rect x="76" y="22" width="8" height="74" fill="#5b85ff" />
          </svg>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'center' }}>
            <span style={{ fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '0.5px', lineHeight: 1.1 }}>
              GariLeloAi
            </span>
            <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'var(--text-tertiary)', letterSpacing: '1.2px', marginTop: '1px' }}>
              CAR BUYING, SIMPLIFIED
            </span>
          </div>
        </button>

        {/* Links */}
        <div className="navbar-links">
          <button
            className={`navbar-link ${activePage === 'saved' ? 'navbar-link--active' : ''}`}
            id="nav-saved"
            onClick={() => onPageChange?.(activePage === 'saved' ? 'home' : 'saved')}
          >
            <BookmarkIcon />
            <span>Saved Cars</span>
          </button>
          <button
            className={`navbar-link ${activePage === 'trends' ? 'navbar-link--active' : ''}`}
            id="nav-trends"
            onClick={() => onPageChange?.(activePage === 'trends' ? 'home' : 'trends')}
          >
            <TrendingIcon />
            <span>Market Trends</span>
          </button>
        </div>

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="theme-toggle"
          id="theme-toggle"
          aria-label={mounted ? `Switch to ${theme === 'light' ? 'dark' : 'light'} mode` : 'Toggle theme'}
        >
          {!mounted ? (
            <div style={{ width: 18, height: 18 }} />
          ) : theme === 'light' ? (
            <MoonIcon />
          ) : (
            <SunIcon />
          )}
        </button>
      </div>
    </nav>
  );
}
