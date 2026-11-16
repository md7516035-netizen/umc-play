import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { sendEmailVerification, sendPasswordResetEmail } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  LogOut,
  Megaphone,
  Settings,
  ShieldAlert,
  Trophy,
  User,
} from 'lucide-react';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { UMC_LIMITS } from '../constants/validation';
import {
  formatAccountStatus,
  formatAnnouncementCategory,
  formatRegistrationStatus,
  formatTimestamp,
  formatTournamentStatus,
} from '../utils/formatters';
import type { Announcement, MinecraftEdition, Tournament } from '../types/umc';

export function PlayerDashboardPage() {
  const { user, playerProfile, isAdmin, authReady, logout } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'overview' | 'tournaments' | 'announcements' | 'settings'>('overview');
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [joinedIds, setJoinedIds] = useState<Record<string, boolean>>({});
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile edit form state
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('');
  const [stateRegion, setStateRegion] = useState('');
  const [district, setDistrict] = useState('');
  const [minecraftEdition, setMinecraftEdition] = useState<MinecraftEdition>('JAVA');
  const [age, setAge] = useState('');
  const [contactDetails, setContactDetails] = useState('');

  useEffect(() => {
    if (playerProfile) {
      setFullName(playerProfile.fullName);
      setCountry(playerProfile.country);
      setStateRegion(playerProfile.state);
      setDistrict(playerProfile.district);
      setMinecraftEdition(playerProfile.minecraftEdition);
      setAge(String(playerProfile.age));
      setContactDetails(playerProfile.contactDetails);
    }
  }, [playerProfile]);

  useEffect(() => {
    if (!authReady || !user) return;

    const tQ = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'));
    const unsubT = onSnapshot(tQ, async (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Tournament));
      setTournaments(list);

      // Check participation status for each tournament
      const map: Record<string, boolean> = {};
      await Promise.all(
        list.map(async (t) => {
          try {
            const pSnap = await getDoc(doc(db, 'tournaments', t.id, 'participants', user.uid));
            map[t.id] = pSnap.exists();
          } catch {
            map[t.id] = false;
          }
        })
      );
      setJoinedIds(map);
    });

    const aQ = query(collection(db, 'announcements'), orderBy('createdAt', 'desc'));
    const unsubA = onSnapshot(aQ, (snap) => {
      setAnnouncements(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Announcement)));
    });

    return () => {
      unsubT();
      unsubA();
    };
  }, [authReady, user]);

  if (!authReady) {
    return (
      <div className="bg-[#090B0E] text-slate-300 py-24 text-center text-sm">
        Loading your Player Dashboard...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="bg-[#090B0E] text-slate-100 py-20 px-4">
        <div className="max-w-md mx-auto bg-[#11151B] border border-[#232B38] rounded-xl p-8 text-center space-y-4">
          <h1 className="text-2xl font-display font-bold text-white">Sign In Required</h1>
          <p className="text-sm text-slate-400">
            Please log in with your registered player account to access the Player Dashboard.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              to="/login"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
            >
              Player Login
            </Link>
            <Link
              to="/register"
              className="px-5 py-2.5 text-sm font-medium text-slate-200 bg-[#181E27] border border-[#2A3444] rounded-lg transition-colors"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!playerProfile) {
    return (
      <div className="bg-[#090B0E] text-slate-100 py-20 px-4">
        <div className="max-w-md mx-auto bg-[#11151B] border border-[#232B38] rounded-xl p-8 text-center space-y-4">
          <h1 className="text-2xl font-display font-bold text-white">
            {isAdmin ? 'Administrator Account' : 'Player Profile Not Found'}
          </h1>
          <p className="text-sm text-slate-400">
            {isAdmin
              ? 'You are signed in as an Administrator without a Player profile.'
              : 'Your Firebase Auth account does not have an associated UMC player registration.'}
          </p>
          <div className="flex justify-center gap-3 pt-2">
            {isAdmin ? (
              <Link
                to="/admin"
                className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
              >
                Open Admin Dashboard
              </Link>
            ) : (
              <Link
                to="/register"
                className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
              >
                Complete Player Registration
              </Link>
            )}
            <button
              type="button"
              onClick={async () => {
                await logout();
                navigate('/');
              }}
              className="px-5 py-2.5 text-sm font-medium text-slate-200 bg-[#181E27] border border-[#2A3444] rounded-lg"
            >
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  const regStatusInfo = formatRegistrationStatus(playerProfile.registrationStatus);
  const accStatusInfo = formatAccountStatus(playerProfile.accountStatus);
  const isApprovedAndActive =
    playerProfile.registrationStatus === 'APPROVED' && playerProfile.accountStatus === 'ACTIVE';

  const handleJoinTournament = async (tournamentId: string) => {
    setFeedback(null);
    if (!isApprovedAndActive) {
      setFeedback({
        type: 'error',
        text: 'Only approved and active players can register for tournaments.',
      });
      return;
    }
    setActionBusy(tournamentId);
    try {
      const partRef = doc(db, 'tournaments', tournamentId, 'participants', user.uid);
      try {
        await setDoc(partRef, {
          playerUid: user.uid,
          tournamentId,
          username: playerProfile.username,
          minecraftUsername: playerProfile.minecraftUsername,
          minecraftEdition: playerProfile.minecraftEdition,
          teamId: '',
          teamName: '',
          joinedAt: serverTimestamp(),
        });
      } catch (fsErr) {
        handleFirestoreError(
          fsErr,
          OperationType.CREATE,
          `tournaments/${tournamentId}/participants/${user.uid}`
        );
      }
      setJoinedIds((prev) => ({ ...prev, [tournamentId]: true }));
      setFeedback({ type: 'success', text: 'Successfully registered for the tournament.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Could not join tournament.',
      });
    } finally {
      setActionBusy(null);
    }
  };

  const handleLeaveTournament = async (tournamentId: string) => {
    setFeedback(null);
    setActionBusy(tournamentId);
    try {
      const partRef = doc(db, 'tournaments', tournamentId, 'participants', user.uid);
      try {
        await deleteDoc(partRef);
      } catch (fsErr) {
        handleFirestoreError(
          fsErr,
          OperationType.DELETE,
          `tournaments/${tournamentId}/participants/${user.uid}`
        );
      }
      setJoinedIds((prev) => ({ ...prev, [tournamentId]: false }));
      setFeedback({ type: 'success', text: 'You have withdrawn from the tournament.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to withdraw right now.',
      });
    } finally {
      setActionBusy(null);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    const parsedAge = Number(age);
    if (fullName.trim().length < 2 || fullName.trim().length > UMC_LIMITS.FULL_NAME_MAX) {
      setFeedback({ type: 'error', text: 'Full name must be 2–80 characters.' });
      return;
    }
    if (!Number.isInteger(parsedAge) || parsedAge < 13 || parsedAge > 99) {
      setFeedback({ type: 'error', text: 'Age must be between 13 and 99.' });
      return;
    }
    setActionBusy('profile');
    try {
      const playerRef = doc(db, 'players', user.uid);
      try {
        await updateDoc(playerRef, {
          fullName: fullName.trim(),
          country: country.trim(),
          state: stateRegion.trim(),
          district: district.trim(),
          minecraftEdition,
          age: parsedAge,
          contactDetails: contactDetails.trim(),
          updatedAt: serverTimestamp(),
        });
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.UPDATE, `players/${user.uid}`);
      }
      setFeedback({ type: 'success', text: 'Profile settings saved successfully.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Failed to update profile.',
      });
    } finally {
      setActionBusy(null);
    }
  };

  const handleResendVerification = async () => {
    setFeedback(null);
    try {
      await sendEmailVerification(user);
      setFeedback({ type: 'success', text: 'Verification email sent. Check your inbox.' });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to send verification email.',
      });
    }
  };

  const handlePasswordReset = async () => {
    setFeedback(null);
    if (!user.email) return;
    try {
      await sendPasswordResetEmail(auth, user.email);
      setFeedback({ type: 'success', text: `Password reset email sent to ${user.email}.` });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to send password reset email.',
      });
    }
  };

  const joinedTournaments = tournaments.filter((t) => joinedIds[t.id]);

  return (
    <div className="bg-[#090B0E] text-slate-100 py-10 sm:py-14">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Top Player Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#1C222D]">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Player Dashboard
            </p>
            <h1 className="text-3xl sm:text-4xl font-display font-bold text-white">
              {playerProfile.fullName}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-sm text-slate-400">
              <span>@{playerProfile.username}</span>
              <span aria-hidden="true">·</span>
              <span>IGN: {playerProfile.minecraftUsername}</span>
              <span aria-hidden="true">·</span>
              <span>{playerProfile.minecraftEdition} Edition</span>
            </div>
          </div>

          <button
            type="button"
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-slate-200 bg-[#141922] hover:bg-[#1D2430] border border-[#283244] rounded-lg transition-colors self-start md:self-auto whitespace-nowrap shrink-0"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        {/* Approval / Rejection / Suspension Notification Banners */}
        {playerProfile.accountStatus === 'SUSPENDED' && (
          <div className="p-5 rounded-xl bg-red-950/40 border border-red-500/40 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <h2 className="font-bold text-red-200">Account Suspended</h2>
              <p className="text-red-200/90">
                Your UMC account is currently suspended and restricted from tournament
                participation.
                {playerProfile.statusReason ? ` Reason: ${playerProfile.statusReason}` : ''}
              </p>
            </div>
          </div>
        )}

        {playerProfile.registrationStatus === 'PENDING_APPROVAL' && (
          <div className="p-5 rounded-xl bg-amber-950/35 border border-amber-500/35 flex items-start gap-3">
            <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <h2 className="font-bold text-amber-200">Registration Pending Approval</h2>
              <p className="text-amber-100/85">
                Your registration is awaiting Administrator review. Restricted tournament
                entry will unlock once an Administrator approves your profile.
              </p>
            </div>
          </div>
        )}

        {playerProfile.registrationStatus === 'REJECTED' && (
          <div className="p-5 rounded-xl bg-red-950/40 border border-red-500/40 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-sm">
              <h2 className="font-bold text-red-200">Registration Rejected</h2>
              <p className="text-red-100/90">
                Your registration was rejected by an Administrator.
                {playerProfile.statusReason ? ` Note: ${playerProfile.statusReason}` : ''} You
                may update your profile details and contact administration for re-evaluation.
              </p>
            </div>
          </div>
        )}

        {playerProfile.registrationStatus === 'APPROVED' &&
          playerProfile.accountStatus === 'ACTIVE' && (
            <div className="p-5 rounded-xl bg-emerald-950/35 border border-emerald-500/35 flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <h2 className="font-bold text-emerald-200">Registration Approved</h2>
                <p className="text-emerald-100/85">
                  Your player profile is verified and active. You can now join open UMC
                  tournaments.
                </p>
              </div>
            </div>
          )}

        {!user.emailVerified && (
          <div className="p-4 rounded-xl bg-[#11151B] border border-[#232B38] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-sm">
            <span className="text-slate-300">
              Your email address (<strong className="text-white">{user.email}</strong>) is not
              verified yet.
            </span>
            <button
              type="button"
              onClick={handleResendVerification}
              className="px-4 py-2 text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Resend Verification Email
            </button>
          </div>
        )}

        {feedback && (
          <div
            className={`p-4 rounded-lg border text-sm ${
              feedback.type === 'success'
                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                : 'bg-red-950/50 border-red-500/40 text-red-200'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-1 p-1 bg-[#11151B] border border-[#232B38] rounded-lg w-fit">
          {[
            { id: 'overview', label: 'Overview', icon: User },
            { id: 'tournaments', label: 'Tournaments', icon: Trophy },
            { id: 'announcements', label: 'Announcements', icon: Megaphone },
            { id: 'settings', label: 'Profile Settings', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === tab.id
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-7 p-6 rounded-xl bg-[#11151B] border border-[#232B38] space-y-5">
              <h2 className="text-xl font-bold text-white">Player Status Summary</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="p-4 rounded-lg bg-[#0B0E12] border border-[#1E2530]">
                  <div className="text-xs text-slate-500">Player Name</div>
                  <div className="text-base font-semibold text-white mt-1">
                    {playerProfile.fullName}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-[#0B0E12] border border-[#1E2530]">
                  <div className="text-xs text-slate-500">UMC Username</div>
                  <div className="text-base font-semibold text-white mt-1">
                    {playerProfile.username}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-[#0B0E12] border border-[#1E2530]">
                  <div className="text-xs text-slate-500">Minecraft Username</div>
                  <div className="text-base font-semibold text-white mt-1">
                    {playerProfile.minecraftUsername}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-[#0B0E12] border border-[#1E2530]">
                  <div className="text-xs text-slate-500">Registration Status</div>
                  <div className={`text-base font-semibold mt-1 ${regStatusInfo.colorClass}`}>
                    {regStatusInfo.label}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-[#0B0E12] border border-[#1E2530]">
                  <div className="text-xs text-slate-500">Account Status</div>
                  <div className={`text-base font-semibold mt-1 ${accStatusInfo.colorClass}`}>
                    {accStatusInfo.label}
                  </div>
                </div>
                <div className="p-4 rounded-lg bg-[#0B0E12] border border-[#1E2530]">
                  <div className="text-xs text-slate-500">Registered On</div>
                  <div className="text-base font-mono tabular-nums text-white mt-1">
                    {formatTimestamp(playerProfile.createdAt)}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 p-6 rounded-xl bg-[#11151B] border border-[#232B38] space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white">Your Tournaments</h2>
                <span className="text-xs font-mono tabular-nums text-slate-400">
                  {joinedTournaments.length} joined
                </span>
              </div>
              {joinedTournaments.length === 0 ? (
                <p className="text-sm text-slate-400">
                  You have not joined any tournaments yet.
                  {isApprovedAndActive
                    ? ' Visit the Tournaments tab to enter an open championship.'
                    : ''}
                </p>
              ) : (
                <div className="space-y-3">
                  {joinedTournaments.map((t) => {
                    const st = formatTournamentStatus(t.status);
                    return (
                      <div
                        key={t.id}
                        className="p-4 rounded-lg bg-[#0B0E12] border border-[#1E2530] flex items-center justify-between gap-3"
                      >
                        <div>
                          <div className="font-semibold text-white text-sm">{t.name}</div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            <span className={st.colorClass}>{st.label}</span>
                            <span aria-hidden="true"> · </span>
                            <span className="font-mono tabular-nums">{t.tournamentDate}</span>
                          </div>
                        </div>
                        <Link
                          to={`/tournaments?id=${t.id}`}
                          className="text-xs font-semibold text-emerald-400 hover:underline whitespace-nowrap shrink-0"
                        >
                          Details
                        </Link>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tournaments' && (
          <div className="space-y-4">
            {!isApprovedAndActive && (
              <div className="p-4 rounded-lg bg-[#11151B] border border-amber-500/30 text-sm text-amber-200">
                Tournament entry is locked until your registration status is{' '}
                <strong>Approved</strong> and your account status is <strong>Active</strong>.
              </div>
            )}

            {tournaments.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#11151B] border border-[#232B38] text-sm text-slate-400">
                No tournaments are currently listed.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {tournaments.map((t) => {
                  const st = formatTournamentStatus(t.status);
                  const isJoined = !!joinedIds[t.id];
                  const canJoin = isApprovedAndActive && t.status === 'REGISTRATION_OPEN';

                  return (
                    <div
                      key={t.id}
                      className="p-6 rounded-xl bg-[#11151B] border border-[#232B38] flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className={`font-semibold ${st.colorClass}`}>{st.label}</span>
                          <span aria-hidden="true">·</span>
                          <span>{t.edition}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">Event: {t.tournamentDate}</span>
                        </div>
                        <h3 className="text-xl font-bold text-white">{t.name}</h3>
                        <p className="text-sm text-slate-400 line-clamp-3">{t.description}</p>
                      </div>

                      <div className="pt-3 border-t border-[#1E2530] flex flex-wrap items-center justify-between gap-3">
                        <Link
                          to={`/tournaments?id=${t.id}`}
                          className="text-xs font-semibold text-slate-300 hover:text-white underline"
                        >
                          Brackets & Teams
                        </Link>
                        {isJoined ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-emerald-400">
                              Registered
                            </span>
                            {t.status === 'REGISTRATION_OPEN' && (
                              <button
                                type="button"
                                disabled={actionBusy === t.id}
                                onClick={() => handleLeaveTournament(t.id)}
                                className="px-3 py-1.5 text-xs font-medium text-red-300 bg-red-950/40 hover:bg-red-950/70 border border-red-500/30 rounded-lg transition-colors"
                              >
                                Withdraw
                              </button>
                            )}
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={!canJoin || actionBusy === t.id}
                            onClick={() => handleJoinTournament(t.id)}
                            className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:bg-[#1A212B] disabled:text-slate-500 rounded-lg transition-colors"
                          >
                            {actionBusy === t.id
                              ? 'Joining...'
                              : t.status !== 'REGISTRATION_OPEN'
                              ? 'Registration Closed'
                              : !isApprovedAndActive
                              ? 'Approval Required'
                              : 'Join Tournament'}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {activeTab === 'announcements' && (
          <div className="space-y-4">
            {announcements.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#11151B] border border-[#232B38] text-sm text-slate-400">
                No announcements published yet.
              </div>
            ) : (
              announcements.map((a) => (
                <article
                  key={a.id}
                  className="p-6 rounded-xl bg-[#11151B] border border-[#232B38] space-y-2"
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
                  <p className="text-sm text-slate-300 whitespace-pre-line">{a.content}</p>
                </article>
              ))
            )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="max-w-2xl p-6 sm:p-8 rounded-xl bg-[#11151B] border border-[#232B38] space-y-6">
            <h2 className="text-xl font-bold text-white">Profile Settings</h2>
            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-400">UMC Username (Locked)</label>
                  <input
                    type="text"
                    disabled
                    value={playerProfile.username}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#090B0E] border border-[#1E2530] rounded-lg text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs text-slate-400">Minecraft Username (Locked)</label>
                  <input
                    type="text"
                    disabled
                    value={playerProfile.minecraftUsername}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#090B0E] border border-[#1E2530] rounded-lg text-slate-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="prof-fullname" className="block text-sm font-medium text-slate-200">
                    Full Name
                  </label>
                  <input
                    id="prof-fullname"
                    type="text"
                    required
                    maxLength={UMC_LIMITS.FULL_NAME_MAX}
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="prof-age" className="block text-sm font-medium text-slate-200">
                    Age
                  </label>
                  <input
                    id="prof-age"
                    type="number"
                    required
                    min={13}
                    max={99}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 font-mono tabular-nums focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="prof-edition" className="block text-sm font-medium text-slate-200">
                    Minecraft Edition
                  </label>
                  <select
                    id="prof-edition"
                    value={minecraftEdition}
                    onChange={(e) => setMinecraftEdition(e.target.value as MinecraftEdition)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                  >
                    <option value="JAVA">Java Edition</option>
                    <option value="BEDROCK">Bedrock Edition</option>
                    <option value="BOTH">Both (Java & Bedrock)</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="prof-contact" className="block text-sm font-medium text-slate-200">
                    Contact Details
                  </label>
                  <input
                    id="prof-contact"
                    type="text"
                    required
                    maxLength={UMC_LIMITS.CONTACT_MAX}
                    value={contactDetails}
                    onChange={(e) => setContactDetails(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="prof-country" className="block text-sm font-medium text-slate-200">
                    Country
                  </label>
                  <input
                    id="prof-country"
                    type="text"
                    required
                    maxLength={UMC_LIMITS.REGION_MAX}
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="prof-state" className="block text-sm font-medium text-slate-200">
                    State
                  </label>
                  <input
                    id="prof-state"
                    type="text"
                    required
                    maxLength={UMC_LIMITS.REGION_MAX}
                    value={stateRegion}
                    onChange={(e) => setStateRegion(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="prof-district" className="block text-sm font-medium text-slate-200">
                    District
                  </label>
                  <input
                    id="prof-district"
                    type="text"
                    required
                    maxLength={UMC_LIMITS.REGION_MAX}
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-4 pt-3 border-t border-[#1E2530]">
                <button
                  type="submit"
                  disabled={actionBusy === 'profile'}
                  className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
                >
                  {actionBusy === 'profile' ? 'Saving...' : 'Save Changes'}
                </button>
                <button
                  type="button"
                  onClick={handlePasswordReset}
                  className="text-sm text-emerald-400 hover:underline font-medium"
                >
                  Send Password Reset Email
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
