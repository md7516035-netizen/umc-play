import { Link } from 'react-router-dom';
import { Wrench } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { UmcLogo } from '../components/UmcLogo';

export function MaintenancePage() {
  const { siteConfig, isAdmin } = useAuth();

  return (
    <div className="min-h-screen bg-[#090B0E] text-slate-100 flex flex-col items-center justify-center px-4 py-16">
      <div className="w-full max-w-xl bg-[#11151B] border border-[#232B38] rounded-xl p-8 sm:p-10 space-y-6 text-center">
        <div className="flex flex-col items-center gap-3">
          <UmcLogo className="w-12 h-12" />
          <span className="font-mono text-xs uppercase tracking-wider text-amber-400">
            HTTP 503 · Scheduled Maintenance
          </span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-display font-bold text-white">
          UMC Platform Under Maintenance
        </h1>

        <p className="text-base text-slate-300 leading-relaxed">
          {siteConfig.maintenanceMessage ||
            'UMC tournament systems and player portals are temporarily offline for maintenance.'}
        </p>

        {siteConfig.maintenanceAnnouncement && (
          <div className="p-4 rounded-lg bg-[#0B0E12] border border-[#1E2530] text-sm text-slate-300 text-left space-y-1">
            <div className="flex items-center gap-2 font-semibold text-emerald-400 text-xs uppercase tracking-wide">
              <Wrench className="w-3.5 h-3.5" />
              <span>Maintenance Announcement</span>
            </div>
            <p className="leading-relaxed">{siteConfig.maintenanceAnnouncement}</p>
          </div>
        )}

        <div className="pt-4 border-t border-[#1E2530] flex flex-col sm:flex-row items-center justify-center gap-3">
          {isAdmin ? (
            <Link
              to="/admin"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
            >
              Return to Administrator Dashboard
            </Link>
          ) : (
            <Link
              to="/admin-portal"
              className="px-5 py-2.5 text-sm font-medium text-slate-300 hover:text-white bg-[#181E27] hover:bg-[#202834] border border-[#2A3444] rounded-lg transition-colors"
            >
              Authorized Administrator Access
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
