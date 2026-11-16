import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { formatTimestamp } from '../utils/formatters';

export function RulesPage() {
  const { siteRules } = useAuth();

  const sections = [
    { id: 'player-rules', num: '01', title: 'Player Rules', body: siteRules.playerRules },
    { id: 'tournament-rules', num: '02', title: 'Tournament Rules', body: siteRules.tournamentRules },
    {
      id: 'participation',
      num: '03',
      title: 'Participation Requirements',
      body: siteRules.participationRequirements,
    },
    {
      id: 'disqualification',
      num: '04',
      title: 'Disqualification Rules',
      body: siteRules.disqualificationRules,
    },
    { id: 'fair-play', num: '05', title: 'Fair-Play Policy', body: siteRules.fairPlayPolicy },
  ];

  return (
    <div className="bg-[#090B0E] text-slate-100 py-14 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        <div className="space-y-3 border-b border-[#1C222D] pb-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>Official Rulebook</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold text-white">
            Rules and Regulations
          </h1>
          <p className="text-base text-slate-400 max-w-2xl">
            Every UMC competitor agrees to abide by these official standards. Rules are
            maintained and enforced directly by UMC Administrators.
          </p>
          {siteRules.updatedAt && (
            <p className="text-xs font-mono text-slate-500 tabular-nums">
              Last updated: {formatTimestamp(siteRules.updatedAt)}
            </p>
          )}
        </div>

        <nav
          className="flex flex-wrap gap-2 pb-2"
          aria-label="Rulebook sections"
        >
          {sections.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="px-3.5 py-2 text-xs font-medium bg-[#11151B] hover:bg-[#181E27] border border-[#232B38] rounded-lg text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {s.num}. {s.title}
            </a>
          ))}
        </nav>

        <div className="space-y-6">
          {sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="p-6 sm:p-8 rounded-xl bg-[#11151B] border border-[#232B38] space-y-3 scroll-mt-24"
            >
              <h2 className="text-2xl font-display font-bold text-white">
                {section.num}. {section.title}
              </h2>
              <div className="text-sm sm:text-base text-slate-300 leading-relaxed whitespace-pre-line">
                {section.body}
              </div>
            </section>
          ))}
        </div>

        <div className="p-6 rounded-xl bg-[#0E1319] border border-[#232B38] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-white">
              Need clarification or want to report a violation?
            </h3>
            <p className="text-sm text-slate-400 mt-1">
              Submit a report directly to the UMC Administrator team.
            </p>
          </div>
          <Link
            to="/contact"
            className="px-4 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Contact Administrators
          </Link>
        </div>
      </div>
    </div>
  );
}
