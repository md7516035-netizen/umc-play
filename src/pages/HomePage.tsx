import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
} from 'firebase/firestore';
import { ArrowRight, Calendar, ChevronRight, Mail, ShieldCheck, Trophy } from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import {
  ABOUT_CREST_IMAGE,
  HERO_ARENA_IMAGE,
  TOURNAMENT_BANNER_IMAGE,
} from '../constants/validation';
import { SafeImage } from '../components/SafeImage';
import {
  formatAnnouncementCategory,
  formatTournamentStatus,
} from '../utils/formatters';
import type { Announcement, Tournament } from '../types/umc';

export function HomePage() {
  const { user, playerProfile, isAdmin, siteConfig } = useAuth();
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingFeeds, setLoadingFeeds] = useState(true);

  useEffect(() => {
    const annQuery = query(
      collection(db, 'announcements'),
      orderBy('createdAt', 'desc'),
      limit(4)
    );
    const unsubAnn = onSnapshot(
      annQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement));
        // Prioritize important notices at the top
        list.sort((a, b) => Number(b.isImportant) - Number(a.isImportant));
        setAnnouncements(list);
        setLoadingFeeds(false);
      },
      () => setLoadingFeeds(false)
    );

    const tournQuery = query(
      collection(db, 'tournaments'),
      orderBy('createdAt', 'desc'),
      limit(4)
    );
    const unsubTourn = onSnapshot(
      tournQuery,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Tournament));
        setTournaments(list);
      },
      () => {}
    );

    return () => {
      unsubAnn();
      unsubTourn();
    };
  }, []);

  const importantNotices = announcements.filter((a) => a.isImportant);

  return (
    <div className="bg-[#090B0E] text-slate-100">
      {/* 1. Hero Section */}
      <section className="relative overflow-hidden border-b border-[#1C222D]">
        <div className="absolute inset-0">
          <SafeImage
            src={HERO_ARENA_IMAGE}
            alt="UMC Unofficial Minecraft Community Arena"
            className="w-full h-full object-cover opacity-45"
            fallbackTitle="UMC Community Arena"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#090B0E] via-[#090B0E]/75 to-[#090B0E]/55" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 sm:py-28 lg:py-32">
          <div className="max-w-3xl space-y-6">
            <p className="text-sm font-medium text-emerald-400 tracking-wide">
              UMC · Competitive Minecraft Esports
            </p>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-display font-bold tracking-tight text-white leading-[1.05]">
              UMC – Unofficial Minecraft Community
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
              Competitive Minecraft esports built around verified player rosters, structured
              Java and Bedrock tournaments, and strict administrator-governed fair play.
            </p>

            {!siteConfig.registrationOpen && (
              <div className="p-4 rounded-lg bg-amber-950/40 border border-amber-500/30 text-amber-200 text-sm">
                <span className="font-semibold">Registration Notice:</span>{' '}
                {siteConfig.registrationClosedMessage || 'Player Registration is Currently Closed.'}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-2">
              {user && playerProfile ? (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Open Player Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : isAdmin ? (
                <Link
                  to="/admin"
                  className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Open Administrator Dashboard
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <>
                  <Link
                    to="/register"
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Register as Player
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-slate-100 bg-[#141922] hover:bg-[#1C2330] border border-[#283244] rounded-lg transition-colors whitespace-nowrap shrink-0"
                  >
                    Player Login
                  </Link>
                </>
              )}
              <Link
                to="/tournaments"
                className="inline-flex items-center gap-1.5 px-4 py-3 text-sm font-medium text-slate-300 hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                Browse Tournaments
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Important Notices Bar (if any exist in Firestore) */}
      {importantNotices.length > 0 && (
        <section className="border-b border-[#1C222D] bg-[#0E1319]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 space-y-2">
            {importantNotices.map((notice) => (
              <div
                key={notice.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-emerald-400">Important Notice</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="font-medium text-slate-100">{notice.title}</span>
                  <span aria-hidden="true" className="text-slate-600">·</span>
                  <span className="text-slate-400 line-clamp-1">{notice.content}</span>
                </div>
                <Link
                  to="/announcements"
                  className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 whitespace-nowrap shrink-0"
                >
                  Read notice
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 2. About UMC Section */}
      <section className="py-16 sm:py-20 border-b border-[#1C222D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-7 flex flex-col justify-center space-y-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                About UMC
              </p>
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-white">
                Structured Competitive Minecraft, Direct Governance
              </h2>
              <p className="text-base text-slate-300 leading-relaxed">
                The Unofficial Minecraft Community (UMC) brings competitive players together
                across Java Edition and Bedrock Edition under a clear, accountable two-tier
                structure: registered <strong className="text-white">Players</strong> and
                authorized <strong className="text-white">Administrators</strong>.
              </p>
              <p className="text-base text-slate-400 leading-relaxed">
                Every player application undergoes direct administrator verification before
                gaining tournament access. This guarantees authentic identities, clean bracket
                integrity, and fair competition across every championship season.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-4 border-t border-[#1E2530]">
                <div>
                  <h3 className="text-base font-semibold text-white">01. Verified Rosters</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    All accounts start in pending review until approved by an administrator.
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">02. Cross-Edition</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Dedicated support for Java Edition, Bedrock Edition, and crossplay events.
                  </p>
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">03. Live Brackets</h3>
                  <p className="mt-1 text-sm text-slate-400">
                    Official schedules, team lineups, match scores, and winner records.
                  </p>
                </div>
              </div>

              <div className="pt-2">
                <Link
                  to="/about"
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Learn more about UMC
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="h-full min-h-[260px] rounded-xl overflow-hidden border border-[#232B38] bg-[#11151B]">
                <SafeImage
                  src={ABOUT_CREST_IMAGE}
                  alt="UMC Obsidian and Emerald Community Trophy"
                  className="w-full h-full object-cover"
                  fallbackTitle="UMC Community Crest"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Upcoming Tournaments */}
      <section className="py-16 sm:py-20 border-b border-[#1C222D] bg-[#0B0E12]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Championship Schedule
              </p>
              <h2 className="text-3xl sm:text-4xl font-display font-bold text-white">
                Upcoming & Active Tournaments
              </h2>
            </div>
            <Link
              to="/tournaments"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-400 hover:text-emerald-300 whitespace-nowrap shrink-0"
            >
              View all tournaments
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          <div className="rounded-xl overflow-hidden border border-[#232B38] bg-[#11151B]">
            <div className="h-44 sm:h-52 relative overflow-hidden border-b border-[#232B38]">
              <SafeImage
                src={TOURNAMENT_BANNER_IMAGE}
                alt="UMC Tournament Battleground"
                className="w-full h-full object-cover opacity-70"
                fallbackTitle="UMC Tournament Stage"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#11151B] via-[#11151B]/40 to-transparent" />
              <div className="absolute bottom-4 left-6 right-6 flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm font-medium text-slate-200">
                  <Trophy className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Approved players can enter open championship brackets</span>
                </div>
              </div>
            </div>

            {loadingFeeds ? (
              <div className="p-8 text-sm text-slate-400">Loading tournaments...</div>
            ) : tournaments.length === 0 ? (
              <div className="p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">
                    No tournaments published yet
                  </h3>
                  <p className="text-sm text-slate-400 mt-1">
                    Administrators will publish upcoming seasons and registration deadlines here.
                  </p>
                </div>
                <Link
                  to="/register"
                  className="px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
                >
                  Register Account Early
                </Link>
              </div>
            ) : (
              <div className="divide-y divide-[#1E2530]">
                {tournaments.map((t) => {
                  const st = formatTournamentStatus(t.status);
                  return (
                    <div
                      key={t.id}
                      className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[#151A22] transition-colors"
                    >
                      <div className="space-y-1.5">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className={`font-semibold ${st.colorClass}`}>{st.label}</span>
                          <span aria-hidden="true">·</span>
                          <span>{t.edition} Edition</span>
                          <span aria-hidden="true">·</span>
                          <span>{t.format}</span>
                        </div>
                        <h3 className="text-xl font-bold text-white">{t.name}</h3>
                        <p className="text-sm text-slate-400 line-clamp-2 max-w-2xl">
                          {t.description}
                        </p>
                      </div>
                      <div className="flex flex-col sm:flex-row md:flex-col items-start sm:items-center md:items-end gap-2 shrink-0">
                        <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-300">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          <span>Event: {t.tournamentDate}</span>
                        </div>
                        <Link
                          to={`/tournaments?id=${t.id}`}
                          className="px-4 py-2 text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          View Details
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 4. Latest Announcements & Rules Overview */}
      <section className="py-16 sm:py-20 border-b border-[#1C222D]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Latest Announcements */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  Community Dispatches
                </p>
                <h2 className="text-3xl font-display font-bold text-white mt-1">
                  Latest Announcements
                </h2>
              </div>
              <Link
                to="/announcements"
                className="text-sm font-semibold text-emerald-400 hover:text-emerald-300 whitespace-nowrap shrink-0"
              >
                All announcements
              </Link>
            </div>

            {announcements.length === 0 ? (
              <div className="p-6 rounded-xl bg-[#11151B] border border-[#232B38] text-sm text-slate-400">
                No announcements have been published yet. Check back soon for season updates.
              </div>
            ) : (
              <div className="space-y-4">
                {announcements.map((a) => (
                  <article
                    key={a.id}
                    className="p-5 rounded-xl bg-[#11151B] border border-[#232B38] space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className={a.isImportant ? 'font-semibold text-emerald-400' : 'text-slate-300'}>
                        {formatAnnouncementCategory(a.category)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">{a.publishedDate}</span>
                      <span aria-hidden="true">·</span>
                      <span>{a.authorName}</span>
                    </div>
                    <h3 className="text-lg font-bold text-white">{a.title}</h3>
                    <p className="text-sm text-slate-300 leading-relaxed line-clamp-3">
                      {a.content}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Rules & Regulations + Contact Summary */}
          <div className="lg:col-span-5 space-y-8">
            <div className="p-6 rounded-xl bg-[#11151B] border border-[#232B38] space-y-4">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
                <h2 className="text-2xl font-display font-bold text-white">
                  Rules & Regulations
                </h2>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                All UMC players must comply with official competition standards covering
                account authenticity, client integrity, match punctuality, and fair play.
              </p>
              <ul className="space-y-2 text-sm text-slate-400">
                <li>01. Player Conduct & Single-Account Policy</li>
                <li>02. Tournament Bracket & Check-In Rules</li>
                <li>03. Participation & Age (13+) Requirements</li>
                <li>04. Zero-Tolerance Disqualification Rules</li>
                <li>05. Java & Bedrock Fair-Play Policy</li>
              </ul>
              <div className="pt-2">
                <Link
                  to="/rules"
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-100 bg-[#181E27] hover:bg-[#202834] border border-[#2B3547] rounded-lg transition-colors"
                >
                  Read Official Rulebook
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-[#11151B] border border-[#232B38] space-y-4">
              <div className="flex items-center gap-2.5 text-emerald-400">
                <Mail className="w-5 h-5" />
                <h2 className="text-2xl font-display font-bold text-white">
                  Contact UMC Administration
                </h2>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">
                Need help with registration approval, tournament scheduling, or reporting a
                fair-play issue? Send a direct inquiry to the UMC admin team.
              </p>
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
              >
                Open Contact Form
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
