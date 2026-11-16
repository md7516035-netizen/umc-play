import { Link } from 'react-router-dom';
import { UmcLogo } from './UmcLogo';

export function Footer() {
  return (
    <footer className="bg-[#07090C] border-t border-[#1C222D] text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div className="md:col-span-2 space-y-3">
            <Link
              to="/"
              className="inline-flex items-center gap-2.5 text-lg font-display font-bold tracking-wide text-slate-100"
            >
              <UmcLogo className="w-7 h-7" />
              <span>UMC – Unofficial Minecraft Community</span>
            </Link>
            <p className="text-sm text-slate-400 max-w-md leading-relaxed">
              Competitive Minecraft esports platform built by the Unofficial Minecraft Community.
              Verified player rosters, structured tournaments, and transparent fair-play governance.
            </p>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-200 tracking-wide">Platform</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/tournaments" className="hover:text-emerald-400 transition-colors">
                  Tournaments
                </Link>
              </li>
              <li>
                <Link to="/announcements" className="hover:text-emerald-400 transition-colors">
                  Announcements
                </Link>
              </li>
              <li>
                <Link to="/rules" className="hover:text-emerald-400 transition-colors">
                  Rules & Regulations
                </Link>
              </li>
              <li>
                <Link to="/about" className="hover:text-emerald-400 transition-colors">
                  About UMC
                </Link>
              </li>
              <li>
                <Link to="/contact" className="hover:text-emerald-400 transition-colors">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-semibold text-slate-200 tracking-wide">Accounts</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link to="/register" className="hover:text-emerald-400 transition-colors">
                  Player Registration
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-emerald-400 transition-colors">
                  Player Login
                </Link>
              </li>
              <li>
                <Link to="/dashboard" className="hover:text-emerald-400 transition-colors">
                  Player Dashboard
                </Link>
              </li>
              <li>
                <Link to="/admin-portal" className="hover:text-emerald-400 transition-colors">
                  Administrator Portal
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-[#161C26] flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <p>
            © {new Date().getFullYear()} UMC – Unofficial Minecraft Community. Not an official
            Mojang or Microsoft product.
          </p>
          <div className="flex items-center gap-4">
            <Link to="/rules" className="hover:text-slate-300 transition-colors">
              Fair-Play Policy
            </Link>
            <span aria-hidden="true">·</span>
            <Link to="/contact" className="hover:text-slate-300 transition-colors">
              Support
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
