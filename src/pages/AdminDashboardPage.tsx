import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import {
  BarChart3,
  Inbox,
  LogOut,
  Megaphone,
  Settings,
  Shield,
  Trophy,
  UserCog,
  Users,
} from 'lucide-react';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { AdminPlayersPanel } from '../components/admin/AdminPlayersPanel';
import { AdminTournamentsPanel } from '../components/admin/AdminTournamentsPanel';
import { AdminAnnouncementsPanel } from '../components/admin/AdminAnnouncementsPanel';
import { AdminSiteControlsPanel } from '../components/admin/AdminSiteControlsPanel';
import { AdminInboxAndAccessPanel } from '../components/admin/AdminInboxAndAccessPanel';
import { AdminAccountSecurityPanel } from '../components/admin/AdminAccountSecurityPanel';
import type {
  AdminUser,
  Announcement,
  ContactMessage,
  PlayerProfile,
  Tournament,
} from '../types/umc';

type AdminTab =
  | 'overview'
  | 'players'
  | 'tournaments'
  | 'announcements'
  | 'controls'
  | 'inbox'
  | 'account';

export function AdminDashboardPage() {
  const { user, isAdmin, authReady, siteConfig, siteRules, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [players, setPlayers] = useState<PlayerProfile[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (!authReady || !isAdmin) return;

    const uPlayers = onSnapshot(
      query(collection(db, 'players'), orderBy('createdAt', 'desc')),
      (snap) => setPlayers(snap.docs.map((d) => d.data() as PlayerProfile))
    );
    const uTourn = onSnapshot(
      query(collection(db, 'tournaments'), orderBy('createdAt', 'desc')),
      (snap) => setTournaments(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Tournament)))
    );
    const uAnn = onSnapshot(
      query(collection(db, 'announcements'), orderBy('createdAt', 'desc')),
      (snap) => setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)))
    );
    const uMsg = onSnapshot(
      query(collection(db, 'contactMessages'), orderBy('createdAt', 'desc')),
      (snap) => setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ContactMessage)))
    );
    const uAdmins = onSnapshot(collection(db, 'admins'), (snap) =>
      setAdmins(snap.docs.map((d) => d.data() as AdminUser))
    );

    return () => {
      uPlayers();
      uTourn();
      uAnn();
      uMsg();
      uAdmins();
    };
  }, [authReady, isAdmin]);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedback({ type, text });
  };

  if (!authReady) {
    return (
      <div className="bg-[#090B0E] text-slate-300 py-24 text-center text-sm">
        Verifying Administrator credentials...
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="bg-[#090B0E] text-slate-100 py-20 px-4">
        <div className="max-w-md mx-auto bg-[#11151B] border border-[#232B38] rounded-xl p-8 text-center space-y-4">
          <Shield className="w-10 h-10 text-red-400 mx-auto" />
          <h1 className="text-2xl font-display font-bold text-white">
            Administrator Access Required
          </h1>
          <p className="text-sm text-slate-400">
            This management console is strictly restricted to authorized UMC Administrators.
          </p>
          <Link
            to="/admin-login"
            className="inline-block px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
          >
            Go to Administrator Login
          </Link>
        </div>
      </div>
    );
  }

  const pendingCount = players.filter((p) => p.registrationStatus === 'PENDING_APPROVAL').length;
  const approvedCount = players.filter((p) => p.registrationStatus === 'APPROVED').length;
  const rejectedCount = players.filter((p) => p.registrationStatus === 'REJECTED').length;
  const suspendedCount = players.filter((p) => p.accountStatus === 'SUSPENDED').length;
  const openMsgCount = messages.filter((m) => m.status === 'NEW').length;

  const navItems: { id: AdminTab; label: string; icon: typeof BarChart3; count?: number }[] = [
    { id: 'overview', label: 'Statistics', icon: BarChart3 },
    { id: 'players', label: 'Players', icon: Users, count: pendingCount > 0 ? pendingCount : undefined },
    { id: 'tournaments', label: 'Tournaments', icon: Trophy },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'controls', label: 'Site & Rules', icon: Settings },
    { id: 'inbox', label: 'Inbox & Admins', icon: Inbox, count: openMsgCount > 0 ? openMsgCount : undefined },
    { id: 'account', label: 'Account & Security', icon: UserCog },
  ];
  const currentAdminRecord = admins.find((a) => a.uid === user?.uid);

  return (
    <div className="bg-[#090B0E] text-slate-100 min-h-[calc(100vh-4rem)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Top Admin Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#1C222D]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              UMC Management Console
            </p>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-white">
              Administrator Dashboard
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Signed in as {currentAdminRecord?.username ? `@${currentAdminRecord.username} · ` : ''}
              {user.email} · Site Availability:{' '}
              <span className={siteConfig.maintenanceEnabled ? 'text-amber-400' : 'text-emerald-400'}>
                {siteConfig.maintenanceEnabled ? 'Maintenance ON (503)' : 'Online (200)'}
              </span>{' '}
              · Registration:{' '}
              <span className={siteConfig.registrationOpen ? 'text-emerald-400' : 'text-red-400'}>
                {siteConfig.registrationOpen ? 'Open' : 'Closed'}
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-200 bg-[#141922] hover:bg-[#1D2430] border border-[#283244] rounded-lg self-start sm:self-auto whitespace-nowrap shrink-0"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {feedback && (
          <div
            className={`p-4 rounded-lg border text-sm flex items-center justify-between gap-4 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/50 border-red-500/40 text-red-200'
            }`}
          >
            <span>{feedback.text}</span>
            <button
              type="button"
              onClick={() => setFeedback(null)}
              className="text-xs underline opacity-80 hover:opacity-100"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Section Tabs */}
        <div className="flex flex-wrap gap-1 p-1 bg-[#11151B] border border-[#232B38] rounded-lg">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === item.id
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{item.label}</span>
                {item.count !== undefined && (
                  <span className="font-mono text-[11px] opacity-90">({item.count})</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Overview & Website Statistics */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Total Registered Players', value: players.length, tone: 'text-white' },
                { label: 'Pending Approval', value: pendingCount, tone: 'text-amber-400' },
                { label: 'Approved Players', value: approvedCount, tone: 'text-emerald-400' },
                { label: 'Rejected Players', value: rejectedCount, tone: 'text-red-400' },
                { label: 'Suspended Accounts', value: suspendedCount, tone: 'text-orange-400' },
                { label: 'Total Tournaments', value: tournaments.length, tone: 'text-white' },
                { label: 'Announcements', value: announcements.length, tone: 'text-white' },
                { label: 'Open Inquiries', value: openMsgCount, tone: 'text-sky-400' },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="p-5 rounded-xl bg-[#11151B] border border-[#232B38] space-y-1"
                >
                  <div className="text-xs text-slate-400">{stat.label}</div>
                  <div className={`text-3xl font-mono font-bold tabular-nums ${stat.tone}`}>
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="p-6 rounded-xl bg-[#11151B] border border-[#232B38] space-y-4">
                <h2 className="text-xl font-bold text-white">Pending Player Queue</h2>
                {pendingCount === 0 ? (
                  <p className="text-sm text-slate-400">
                    All player registrations have been reviewed.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {players
                      .filter((p) => p.registrationStatus === 'PENDING_APPROVAL')
                      .slice(0, 5)
                      .map((p) => (
                        <div
                          key={p.uid}
                          className="p-3.5 rounded-lg bg-[#0B0E12] border border-[#1E2530] flex items-center justify-between gap-3"
                        >
                          <div>
                            <div className="text-sm font-semibold text-white">
                              {p.fullName} (@{p.username})
                            </div>
                            <div className="text-xs text-slate-400">
                              IGN: {p.minecraftUsername} · {p.minecraftEdition}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveTab('players')}
                            className="px-3 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 rounded-lg"
                          >
                            Review
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="p-6 rounded-xl bg-[#11151B] border border-[#232B38] space-y-4">
                <h2 className="text-xl font-bold text-white">Quick Management Actions</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('players')}
                    className="p-4 text-left rounded-lg bg-[#0B0E12] hover:bg-[#151B23] border border-[#1E2530] transition-colors"
                  >
                    <div className="font-semibold text-white text-sm">Approve Players</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Review pending profiles and accounts
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('tournaments')}
                    className="p-4 text-left rounded-lg bg-[#0B0E12] hover:bg-[#151B23] border border-[#1E2530] transition-colors"
                  >
                    <div className="font-semibold text-white text-sm">Manage Tournaments</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Create events, teams, and match scores
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('announcements')}
                    className="p-4 text-left rounded-lg bg-[#0B0E12] hover:bg-[#151B23] border border-[#1E2530] transition-colors"
                  >
                    <div className="font-semibold text-white text-sm">Post Announcement</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Publish notices to homepage & feed
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('controls')}
                    className="p-4 text-left rounded-lg bg-[#0B0E12] hover:bg-[#151B23] border border-[#1E2530] transition-colors"
                  >
                    <div className="font-semibold text-white text-sm">Maintenance & Rules</div>
                    <div className="text-xs text-slate-400 mt-1">
                      Toggle 503 mode, registration & rules
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'players' && (
          <AdminPlayersPanel
            players={players}
            adminUid={user.uid}
            onFeedback={showFeedback}
          />
        )}

        {activeTab === 'tournaments' && (
          <AdminTournamentsPanel
            tournaments={tournaments}
            players={players}
            adminUid={user.uid}
            onFeedback={showFeedback}
          />
        )}

        {activeTab === 'announcements' && (
          <AdminAnnouncementsPanel
            announcements={announcements}
            adminUid={user.uid}
            adminName={user.displayName || user.email || 'UMC Administrator'}
            onFeedback={showFeedback}
          />
        )}

        {activeTab === 'controls' && (
          <AdminSiteControlsPanel
            siteConfig={siteConfig}
            siteRules={siteRules}
            adminUid={user.uid}
            onFeedback={showFeedback}
          />
        )}

        {activeTab === 'inbox' && (
          <AdminInboxAndAccessPanel
            messages={messages}
            admins={admins}
            currentAdminUid={user.uid}
            onFeedback={showFeedback}
          />
        )}

        {activeTab === 'account' && (
          <AdminAccountSecurityPanel
            user={user}
            currentAdminRecord={currentAdminRecord}
            onFeedback={showFeedback}
          />
        )}
      </div>
    </div>
  );
}
