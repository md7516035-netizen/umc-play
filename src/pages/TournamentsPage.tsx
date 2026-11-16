import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { Calendar, Search, Shield, Swords, Trophy, Users } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { TOURNAMENT_BANNER_IMAGE } from '../constants/validation';
import { SafeImage } from '../components/SafeImage';
import { formatMatchStatus, formatTournamentStatus } from '../utils/formatters';
import type {
  Tournament,
  TournamentMatch,
  TournamentParticipant,
  TournamentStatus,
  TournamentTeam,
} from '../types/umc';

export function TournamentsPage() {
  const { user, playerProfile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get('id');

  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'ALL' | TournamentStatus>('ALL');
  const [searchTerm, setSearchTerm] = useState('');

  // Selected tournament details
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);
  const [detailTab, setDetailTab] = useState<'matches' | 'teams' | 'participants'>('matches');
  const [busyJoin, setBusyJoin] = useState(false);
  const [joinMsg, setJoinMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'tournaments'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Tournament));
        setTournaments(list);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsub();
  }, []);

  const activeTournament = tournaments.find((t) => t.id === selectedId) || null;

  useEffect(() => {
    if (!activeTournament) {
      setParticipants([]);
      setTeams([]);
      setMatches([]);
      return;
    }

    const unsubP = onSnapshot(
      collection(db, 'tournaments', activeTournament.id, 'participants'),
      (snap) => {
        setParticipants(snap.docs.map((d) => d.data() as TournamentParticipant));
      }
    );
    const unsubT = onSnapshot(
      collection(db, 'tournaments', activeTournament.id, 'teams'),
      (snap) => {
        setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TournamentTeam)));
      }
    );
    const unsubM = onSnapshot(
      collection(db, 'tournaments', activeTournament.id, 'matches'),
      (snap) => {
        setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TournamentMatch)));
      }
    );

    return () => {
      unsubP();
      unsubT();
      unsubM();
    };
  }, [activeTournament?.id]);

  const filtered = tournaments.filter((t) => {
    const matchesStatus = statusFilter === 'ALL' || t.status === statusFilter;
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q || t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const isPlayerJoined = !!user && participants.some((p) => p.playerUid === user.uid);
  const isApprovedActive =
    playerProfile?.registrationStatus === 'APPROVED' &&
    playerProfile?.accountStatus === 'ACTIVE';

  const handleJoin = async () => {
    if (!activeTournament || !user || !playerProfile) return;
    setJoinMsg(null);
    setBusyJoin(true);
    try {
      const partRef = doc(db, 'tournaments', activeTournament.id, 'participants', user.uid);
      try {
        await setDoc(partRef, {
          playerUid: user.uid,
          tournamentId: activeTournament.id,
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
          `tournaments/${activeTournament.id}/participants/${user.uid}`
        );
      }
      setJoinMsg({ type: 'success', text: 'You are now registered in this tournament.' });
    } catch (err) {
      setJoinMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to register for tournament.',
      });
    } finally {
      setBusyJoin(false);
    }
  };

  const handleWithdraw = async () => {
    if (!activeTournament || !user) return;
    setJoinMsg(null);
    setBusyJoin(true);
    try {
      const partRef = doc(db, 'tournaments', activeTournament.id, 'participants', user.uid);
      try {
        await deleteDoc(partRef);
      } catch (fsErr) {
        handleFirestoreError(
          fsErr,
          OperationType.DELETE,
          `tournaments/${activeTournament.id}/participants/${user.uid}`
        );
      }
      setJoinMsg({ type: 'success', text: 'Withdrawn from tournament.' });
    } catch (err) {
      setJoinMsg({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to withdraw.',
      });
    } finally {
      setBusyJoin(false);
    }
  };

  return (
    <div className="bg-[#090B0E] text-slate-100 py-12 sm:py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
        {/* Header Banner */}
        <div className="rounded-xl overflow-hidden border border-[#232B38] bg-[#11151B]">
          <div className="relative h-48 sm:h-56">
            <SafeImage
              src={TOURNAMENT_BANNER_IMAGE}
              alt="UMC Tournaments Arena"
              className="w-full h-full object-cover opacity-55"
              fallbackTitle="UMC Tournaments"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#11151B] via-[#11151B]/60 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 space-y-1">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                <Trophy className="w-4 h-4" />
                <span>Competitive Circuit</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-display font-bold text-white">
                UMC Tournaments
              </h1>
            </div>
          </div>
        </div>

        {/* Selected Tournament Detail View */}
        {activeTournament && (
          <div className="p-6 sm:p-8 rounded-xl bg-[#11151B] border border-emerald-500/35 space-y-6">
            <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-[#1E2530] pb-6">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setSearchParams({})}
                  className="text-xs font-semibold text-emerald-400 hover:underline"
                >
                  ← Back to all tournaments
                </button>
                <h2 className="text-3xl font-display font-bold text-white">
                  {activeTournament.name}
                </h2>
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                  <span className={`font-semibold ${formatTournamentStatus(activeTournament.status).colorClass}`}>
                    {formatTournamentStatus(activeTournament.status).label}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{activeTournament.edition} Edition</span>
                  <span aria-hidden="true">·</span>
                  <span>{activeTournament.format}</span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    Date: {activeTournament.tournamentDate}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span className="font-mono tabular-nums">
                    Deadline: {activeTournament.registrationDeadline}
                  </span>
                </div>
              </div>

              <div className="shrink-0">
                {!user ? (
                  <Link
                    to="/login"
                    className="inline-block px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
                  >
                    Login to Join
                  </Link>
                ) : isPlayerJoined ? (
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-emerald-400">
                      Registered Competitor
                    </span>
                    {activeTournament.status === 'REGISTRATION_OPEN' && (
                      <button
                        type="button"
                        disabled={busyJoin}
                        onClick={handleWithdraw}
                        className="px-3.5 py-2 text-xs font-semibold text-red-300 bg-red-950/50 border border-red-500/30 rounded-lg hover:bg-red-950/80"
                      >
                        Withdraw
                      </button>
                    )}
                  </div>
                ) : activeTournament.status === 'REGISTRATION_OPEN' ? (
                  isApprovedActive ? (
                    <button
                      type="button"
                      disabled={busyJoin || participants.length >= activeTournament.maxParticipants}
                      onClick={handleJoin}
                      className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {busyJoin
                        ? 'Registering...'
                        : participants.length >= activeTournament.maxParticipants
                        ? 'Tournament Full'
                        : 'Join Tournament'}
                    </button>
                  ) : (
                    <span className="text-xs text-amber-300">
                      Approved & Active player status required to enter
                    </span>
                  )
                ) : null}
              </div>
            </div>

            {joinMsg && (
              <div
                className={`p-3.5 rounded-lg border text-sm ${
                  joinMsg.type === 'success'
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                    : 'bg-red-950/50 border-red-500/40 text-red-200'
                }`}
              >
                {joinMsg.text}
              </div>
            )}

            <p className="text-sm sm:text-base text-slate-300 leading-relaxed whitespace-pre-line">
              {activeTournament.description}
            </p>

            {/* Winner Announcement */}
            {(activeTournament.winnerName || activeTournament.winnerAnnouncement) && (
              <div className="p-5 rounded-xl bg-emerald-950/30 border border-emerald-500/35 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  <Trophy className="w-4 h-4" />
                  <span>Winner Announcement</span>
                </div>
                {activeTournament.winnerName && (
                  <div className="text-xl font-bold text-white">
                    Champion: {activeTournament.winnerName}
                  </div>
                )}
                {activeTournament.winnerAnnouncement && (
                  <p className="text-sm text-slate-200">{activeTournament.winnerAnnouncement}</p>
                )}
              </div>
            )}

            {/* Sub-tabs: Match Schedule & Results / Teams / Participants */}
            <div className="flex flex-wrap gap-1 p-1 bg-[#0B0E12] border border-[#1E2530] rounded-lg w-fit">
              <button
                type="button"
                onClick={() => setDetailTab('matches')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors ${
                  detailTab === 'matches' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Swords className="w-3.5 h-3.5" />
                Matches & Results ({matches.length})
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('teams')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors ${
                  detailTab === 'teams' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Teams ({teams.length})
              </button>
              <button
                type="button"
                onClick={() => setDetailTab('participants')}
                className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors ${
                  detailTab === 'participants'
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Participants ({participants.length}/{activeTournament.maxParticipants})
              </button>
            </div>

            {detailTab === 'matches' && (
              <div className="space-y-3">
                {matches.length === 0 ? (
                  <p className="text-sm text-slate-400">Match schedule has not been published yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-[#1E2530] text-xs text-slate-400">
                          <th className="py-3 pr-4">Round</th>
                          <th className="py-3 pr-4">Matchup</th>
                          <th className="py-3 pr-4">Schedule</th>
                          <th className="py-3 pr-4 text-right">Score</th>
                          <th className="py-3 pr-4">Status</th>
                          <th className="py-3">Winner</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A202B]">
                        {matches.map((m) => {
                          const ms = formatMatchStatus(m.status);
                          return (
                            <tr key={m.id}>
                              <td className="py-3 pr-4 font-medium text-slate-200">{m.round}</td>
                              <td className="py-3 pr-4 text-white font-semibold">
                                {m.participantA} <span className="text-slate-500">vs</span> {m.participantB}
                              </td>
                              <td className="py-3 pr-4 font-mono tabular-nums text-xs text-slate-300">
                                {m.scheduledTime}
                              </td>
                              <td className="py-3 pr-4 text-right font-mono tabular-nums text-slate-200">
                                {m.scoreA} – {m.scoreB}
                              </td>
                              <td className={`py-3 pr-4 text-xs font-semibold ${ms.colorClass}`}>
                                {ms.label}
                              </td>
                              <td className="py-3 text-emerald-400 font-medium">
                                {m.winner || '—'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {detailTab === 'teams' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {teams.length === 0 ? (
                  <p className="text-sm text-slate-400">No teams configured for this event yet.</p>
                ) : (
                  teams.map((team) => (
                    <div
                      key={team.id}
                      className="p-4 rounded-lg bg-[#0B0E12] border border-[#1E2530] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-white">{team.name}</h3>
                        <span className="font-mono text-xs text-emerald-400">[{team.tag}]</span>
                      </div>
                      <p className="text-xs text-slate-400">
                        Roster:{' '}
                        {team.memberNames.length > 0
                          ? team.memberNames.join(', ')
                          : 'No members assigned'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            )}

            {detailTab === 'participants' && (
              <div>
                {participants.length === 0 ? (
                  <p className="text-sm text-slate-400">No approved players have joined yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-[#1E2530] text-xs text-slate-400">
                          <th className="py-3 pr-4">UMC Username</th>
                          <th className="py-3 pr-4">Minecraft IGN</th>
                          <th className="py-3 pr-4">Edition</th>
                          <th className="py-3">Assigned Team</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#1A202B]">
                        {participants.map((p) => (
                          <tr key={p.playerUid}>
                            <td className="py-3 pr-4 text-white font-medium">{p.username}</td>
                            <td className="py-3 pr-4 font-mono text-slate-200">{p.minecraftUsername}</td>
                            <td className="py-3 pr-4 text-xs text-slate-400">{p.minecraftEdition}</td>
                            <td className="py-3 text-slate-300">{p.teamName || 'Unassigned'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search tournaments..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#11151B] border border-[#232B38] rounded-lg text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1 p-1 bg-[#11151B] border border-[#232B38] rounded-lg">
            {(['ALL', 'REGISTRATION_OPEN', 'UPCOMING', 'ONGOING', 'COMPLETED'] as const).map(
              (st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStatusFilter(st)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    statusFilter === st
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st === 'ALL' ? 'All' : formatTournamentStatus(st).label}
                </button>
              )
            )}
          </div>
        </div>

        {/* Tournament Grid */}
        {loading ? (
          <div className="p-8 rounded-xl bg-[#11151B] border border-[#232B38] text-sm text-slate-400">
            Loading tournaments...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#11151B] border border-[#232B38] text-sm text-slate-400">
            No tournaments match your criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((t) => {
              const st = formatTournamentStatus(t.status);
              return (
                <div
                  key={t.id}
                  className="p-6 rounded-xl bg-[#11151B] border border-[#232B38] flex flex-col justify-between gap-4"
                >
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                      <span className={`font-semibold ${st.colorClass}`}>{st.label}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t.edition}</span>
                      <span aria-hidden="true">·</span>
                      <span>{t.format}</span>
                    </div>
                    <h2 className="text-2xl font-display font-bold text-white">{t.name}</h2>
                    <p className="text-sm text-slate-400 line-clamp-3">{t.description}</p>
                    {t.winnerName && (
                      <p className="text-xs text-emerald-400 font-semibold">
                        Champion: {t.winnerName}
                      </p>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[#1E2530] flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-xs font-mono tabular-nums text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{t.tournamentDate}</span>
                      <span aria-hidden="true">·</span>
                      <span>Deadline: {t.registrationDeadline}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSearchParams({ id: t.id })}
                      className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Open Bracket & Details
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
