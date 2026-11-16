import { useEffect, useState } from 'react';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { Megaphone, Search } from 'lucide-react';
import { db } from '../lib/firebase';
import { formatAnnouncementCategory } from '../utils/formatters';
import type { Announcement, AnnouncementCategory } from '../types/umc';

export function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | AnnouncementCategory>('ALL');

  useEffect(() => {
    const q = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement));
        items.sort((a, b) => {
          if (a.isImportant !== b.isImportant) return Number(b.isImportant) - Number(a.isImportant);
          return b.publishedDate.localeCompare(a.publishedDate);
        });
        setAnnouncements(items);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const filtered = announcements.filter((item) => {
    const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      item.title.toLowerCase().includes(q) ||
      item.content.toLowerCase().includes(q) ||
      item.authorName.toLowerCase().includes(q);
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="bg-[#090B0E] text-slate-100 py-14 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="space-y-3 border-b border-[#1C222D] pb-8">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
            <Megaphone className="w-4 h-4" />
            <span>Official Feed</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-display font-bold text-white">
            Announcements & Notices
          </h1>
          <p className="text-base text-slate-400">
            Official championship schedules, rule updates, maintenance notices, and community
            bulletins published by UMC Administrators.
          </p>
        </div>

        {/* Search & Filter Controls */}
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search announcements..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#11151B] border border-[#232B38] rounded-lg text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#11151B] border border-[#232B38] rounded-lg">
            {(['ALL', 'URGENT', 'TOURNAMENT', 'RULE_UPDATE', 'MAINTENANCE', 'GENERAL'] as const).map(
              (cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    categoryFilter === cat
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {cat === 'ALL' ? 'All' : formatAnnouncementCategory(cat)}
                </button>
              )
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-8 rounded-xl bg-[#11151B] border border-[#232B38] text-sm text-slate-400">
            Loading announcements...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#11151B] border border-[#232B38] text-sm text-slate-400">
            No announcements match the current filter.
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map((item) => (
              <article
                key={item.id}
                className={`p-6 rounded-xl border space-y-3 ${
                  item.isImportant
                    ? 'bg-[#12191E] border-emerald-500/40'
                    : 'bg-[#11151B] border-[#232B38]'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  {item.isImportant && (
                    <>
                      <span className="font-semibold text-emerald-400">Pinned Notice</span>
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  <span className="text-slate-300 font-medium">
                    {formatAnnouncementCategory(item.category)}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">{item.publishedDate}</span>
                  <span aria-hidden="true">·</span>
                  <span>By {item.authorName}</span>
                </div>
                <h2 className="text-2xl font-display font-bold text-white">{item.title}</h2>
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed whitespace-pre-line">
                  {item.content}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
