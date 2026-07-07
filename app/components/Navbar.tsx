'use client';

import { useTheme } from './ThemeProvider';

/* ── SVG icons (inline to avoid external deps) ──────────────────── */

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

/* ── Navigation links config ────────────────────────────────────── */

interface NavLink {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_LINKS: NavLink[] = [
  { id: 'saved', label: 'Saved Cars', href: '#saved', icon: <BookmarkIcon /> },
  { id: 'trends', label: 'Market Trends', href: '#trends', icon: <TrendingIcon /> },
];

/* ── Component ──────────────────────────────────────────────────── */

export default function Navbar() {
  const { theme, toggleTheme, mounted } = useTheme();

  return (
    <nav className="navbar" id="main-navbar">
      <div className="navbar-inner">
        {/* ── Logo ─────────────────────────────────────────── */}
        <a href="/" className="navbar-logo" id="navbar-logo">
          <div className="navbar-logo-icon">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="navbar-logo-text">
            GariLelo<span className="navbar-logo-ai">AI</span>
          </span>
        </a>

        {/* ── Links ────────────────────────────────────────── */}
        <div className="navbar-links">
          {NAV_LINKS.map((link) => (
            <a key={link.id} href={link.href} className="navbar-link" id={`nav-${link.id}`}>
              {link.icon}
              <span>{link.label}</span>
            </a>
          ))}
        </div>

        {/* ── Theme toggle ─────────────────────────────────── */}
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
