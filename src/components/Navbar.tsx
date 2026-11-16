import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UmcLogo } from './UmcLogo';

export function Navbar() {
  const { user, isAdmin, playerProfile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const primaryCta = isAdmin
    ? { to: '/admin', label: 'Admin Console' }
    : user && playerProfile
    ? { to: '/dashboard', label: 'Player Hub' }
    : { to: '/login', label: 'Player Login' };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#090B0E]/95 backdrop-blur-md border-b border-[#1E2530]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-line Brand Zone */}
        <Link
          to="/"
          className="flex items-center gap-2.5 text-lg font-display font-bold tracking-wide text-slate-100 whitespace-nowrap shrink-0"
        >
          <UmcLogo className="w-7 h-7 shrink-0" />
          <span>UMC Community</span>
        </Link>

        {/* Zone 2: 5 concise single-line text links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium" aria-label="Primary">
          <Link
            to="/"
            className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
              isActive('/')
                ? 'text-emerald-400 border-b-2 border-emerald-500'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Home
          </Link>
          <Link
            to="/tournaments"
            className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
              isActive('/tournaments')
                ? 'text-emerald-400 border-b-2 border-emerald-500'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Tournaments
          </Link>
          <Link
            to="/announcements"
            className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
              isActive('/announcements')
                ? 'text-emerald-400 border-b-2 border-emerald-500'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Announcements
          </Link>
          <Link
            to="/rules"
            className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
              isActive('/rules')
                ? 'text-emerald-400 border-b-2 border-emerald-500'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            Rules
          </Link>
          <Link
            to="/about"
            className={`whitespace-nowrap shrink-0 py-1 transition-colors ${
              isActive('/about')
                ? 'text-emerald-400 border-b-2 border-emerald-500'
                : 'text-slate-300 hover:text-white'
            }`}
          >
            About
          </Link>
        </nav>

        {/* Zone 3: 1 Primary Action + Mobile Menu Trigger */}
        <div className="flex items-center gap-3 shrink-0">
          <Link
            to={primaryCta.to}
            className="hidden md:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            {primaryCta.label}
          </Link>

          <button
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="md:hidden inline-flex items-center justify-center w-11 h-11 rounded-lg text-slate-200 hover:bg-[#161B24] transition-colors"
            aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="md:hidden border-t border-[#1E2530] bg-[#0D1117] px-4 py-4 space-y-1">
          {[
            { to: '/', label: 'Home' },
            { to: '/about', label: 'About UMC' },
            { to: '/tournaments', label: 'Tournaments' },
            { to: '/announcements', label: 'Announcements' },
            { to: '/rules', label: 'Rules & Regulations' },
            { to: '/contact', label: 'Contact Us' },
            { to: '/register', label: 'Player Registration' },
            { to: '/login', label: 'Player Login' },
            ...(user && playerProfile ? [{ to: '/dashboard', label: 'Player Dashboard' }] : []),
            { to: isAdmin ? '/admin' : '/admin-login', label: isAdmin ? 'Administrator Dashboard' : 'Administrator Login' },
          ].map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={`block px-3 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive(item.to)
                  ? 'bg-emerald-500/15 text-emerald-300'
                  : 'text-slate-200 hover:bg-[#161B24]'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
