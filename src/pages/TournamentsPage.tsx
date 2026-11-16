import { useEffect, useMemo, useState } from 'react';
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
  where,
} from 'firebase/firestore';
import {
  AlertCircle,
  Calendar,
  Clock,
  Download,
  ExternalLink,
  FolderCheck,
  Search,
  Shield,
  Swords,
  Trophy,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { TOURNAMENT_BANNER_IMAGE } from '../constants/validation';
import { SafeImage } from '../components/SafeImage';
import {
  formatBytes,
  formatMatchStatus,
  formatTournamentStatus,
  isTournamentPublished,
  isTournamentSubmissionOpen,
} from '../utils/formatters';
import { downloadSubmissionFile } from '../utils/mediaFiles';
import type {
  ProjectSubmission,
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
  const [approvedSubmissions, setApprovedSubmissions] = useState<ProjectSubmission[]>([]);
  const [detailTab, setDetailTab] = useState<'matches' | 'projects' | 'teams' | 'participants'>(
    'matches'
  );
  const [busyJoin, setBusyJoin] = useState(false);
  const [joinMsg, setJoinMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState('');
  const [previewImage, setPreviewImage] = useState<{ src: string; title: string } | null>(null);

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

  // Only published tournaments are visible on the public website
  const publishedTournaments = useMemo(
    () => tournaments.filter((t) => isTournamentPublished(t)),
    [tournaments]
  );

  const rawSelectedTournament = selectedId
    ? tournaments.find((t) => t.id === selectedId) || null
    : null;
  const activeTournament =
    rawSelectedTournament && isTournamentPublished(rawSelectedTournament)
      ? rawSelectedTournament
      : null;

  useEffect(() => {
    if (!activeTournament) {
      setParticipants([]);
      setTeams([]);
      setMatches([]);
      setApprovedSubmissions([]);
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
    // Single equality filter satisfies firestore.rules allow list without composite index
    const subQuery = query(
      collection(db, 'projectSubmissions'),
      where('status', '==', 'APPROVED')
    );
    const unsubSubs = onSnapshot(subQuery, (snap) => {
      const list = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as ProjectSubmission))
        .filter((s) => s.tournamentId === activeTournament.id);
      list.sort((a, b) => {
        const am = a.createdAt && typeof a.createdAt.toMillis === 'function' ? a.createdAt.toMillis() : 0;
        const bm = b.createdAt && typeof b.createdAt.toMillis === 'function' ? b.createdAt.toMillis() : 0;
        return bm - am;
      });
      setApprovedSubmissions(list);
    });

    return () => {
      unsubP();
      unsubT();
      unsubM();
      unsubSubs();
    };
  }, [activeTournament?.id]);

  const filtered = publishedTournaments.filter((t) => {
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

  const handleDownloadProject = async (sub: ProjectSubmission) => {
    setDownloadError('');
    setDownloadingId(sub.id);
    try {
      await downloadSubmissionFile(sub);
    } catch (err) {
      setDownloadError(
        err instanceof Error ? err.message : 'Unable to download project file.'
      );
    } finally {
      setDownloadingId(null);
    }
  };

  const activeGate = activeTournament ? isTournamentSubmissionOpen(activeTournament) : null;

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

        {/* Safe Notice if selected tournament was deleted or unpublished */}
        {!loading && selectedId && !activeTournament && (
          <div className="p-6 rounded-xl bg-[#11151B] border border-amber-500/35 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <h2 className="font-bold text-white">
                  {rawSelectedTournament
                    ? 'This tournament has been unpublished'
                    : 'Tournament not found'}
                </h2>
                <p className="text-slate-400">
                  {rawSelectedTournament
                    ? 'Administrators moved this tournament to drafts. Project uploads are paused while unpublished.'
                    : 'This tournament may have been removed or the link is no longer valid.'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSearchParams({})}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg self-start sm:self-auto whitespace-nowrap shrink-0"
            >
              View Published Tournaments
            </button>
          </div>
        )}

        {/* Selected Tournament Detail View */}
        {activeTournament && activeGate && (
          <div className="rounded-xl overflow-hidden bg-[#11151B] border border-emerald-500/35">
            {activeTournament.imageUrl && (
              <div className="relative h-48 sm:h-64 border-b border-[#1E2530]">
                <SafeImage
                  src={activeTournament.imageUrl}
                  alt={activeTournament.name}
                  className="w-full h-full object-cover"
                  fallbackTitle={activeTournament.name}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#11151B] via-transparent to-transparent" />
              </div>
            )}

            <div className="p-6 sm:p-8 space-y-6">
              <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 border-b border-[#1E2530] pb-6">
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
                    <span
                      className={`font-semibold ${
                        formatTournamentStatus(activeTournament.status).colorClass
                      }`}
                    >
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
                      Project Deadline: {activeGate.deadlineText}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 shrink-0">
                  {activeGate.open ? (
                    <Link
                      to={`/tournaments/${activeTournament.id}/submit`}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      <Upload className="w-4 h-4" />
                      Upload Project
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      title={activeGate.reason}
                      className="inline-flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-500 bg-[#1A212B] border border-[#252E3C] rounded-lg cursor-not-allowed whitespace-nowrap shrink-0"
                    >
                      <Clock className="w-4 h-4" />
                      Submissions Closed
                    </button>
                  )}

                  {!user ? (
                    <Link
                      to="/login"
                      className="inline-block px-4 py-2.5 text-xs sm:text-sm font-semibold text-slate-100 bg-[#181E27] hover:bg-[#222A37] border border-[#2C374A] rounded-lg transition-colors whitespace-nowrap shrink-0"
                    >
                      Login to Join Bracket
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
                        className="px-4 py-2.5 text-xs sm:text-sm font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {busyJoin
                          ? 'Registering...'
                          : participants.length >= activeTournament.maxParticipants
                          ? 'Tournament Full'
                          : 'Join Bracket'}
                      </button>
                    ) : (
                      <span className="text-xs text-amber-300">
                        Approved & Active player status required
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

              <div className="space-y-4">
                <p className="text-sm sm:text-base text-slate-300 leading-relaxed whitespace-pre-line">
                  {activeTournament.description}
                </p>

                {activeTournament.rules && (
                  <div className="p-5 rounded-xl bg-[#0B0E12] border border-[#1E2530] space-y-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                      Tournament Rules & Project Requirements
                    </h3>
                    <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                      {activeTournament.rules}
                    </p>
                  </div>
                )}
              </div>

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

              {/* Sub-tabs */}
              <div className="flex flex-wrap gap-1 p-1 bg-[#0B0E12] border border-[#1E2530] rounded-lg w-fit">
                <button
                  type="button"
                  onClick={() => setDetailTab('matches')}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors ${
                    detailTab === 'matches'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Swords className="w-3.5 h-3.5" />
                  Matches & Results ({matches.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab('projects')}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors ${
                    detailTab === 'projects'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FolderCheck className="w-3.5 h-3.5" />
                  Approved Projects ({approvedSubmissions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setDetailTab('teams')}
                  className={`inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-md transition-colors ${
                    detailTab === 'teams'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-white'
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
                    <p className="text-sm text-slate-400">
                      Match schedule has not been published yet.
                    </p>
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
                                  {m.participantA}{' '}
                                  <span className="text-slate-500">vs</span> {m.participantB}
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

              {detailTab === 'projects' && (
                <div className="space-y-4">
                  {downloadError && (
                    <div className="p-3.5 rounded-lg bg-red-950/50 border border-red-500/40 text-red-200 text-sm">
                      {downloadError}
                    </div>
                  )}
                  {approvedSubmissions.length === 0 ? (
                    <div className="p-6 rounded-xl bg-[#0B0E12] border border-[#1E2530] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <p className="text-sm text-slate-400">
                        No approved projects have been published for this tournament yet.
                      </p>
                      {activeGate.open && (
                        <Link
                          to={`/tournaments/${activeTournament.id}/submit`}
                          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg self-start whitespace-nowrap shrink-0"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Upload Project
                        </Link>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {approvedSubmissions.map((sub) => (
                        <article
                          key={sub.id}
                          className="p-5 rounded-xl bg-[#0B0E12] border border-[#1E2530] flex flex-col justify-between gap-4"
                        >
                          <div className="space-y-3">
                            {sub.screenshots && sub.screenshots.length > 0 && (
                              <div className="grid grid-cols-3 gap-2">
                                {sub.screenshots.map((shot, idx) => (
                                  <button
                                    key={`${sub.id}-pub-shot-${idx}`}
                                    type="button"
                                    onClick={() =>
                                      setPreviewImage({
                                        src: shot,
                                        title: `${sub.title} — Screenshot ${idx + 1}`,
                                      })
                                    }
                                    className="aspect-video rounded-md overflow-hidden border border-[#232B38] bg-[#11151B]"
                                  >
                                    <img
                                      src={shot}
                                      alt={`${sub.title} screenshot ${idx + 1}`}
                                      className="w-full h-full object-cover"
                                    />
                                  </button>
                                ))}
                              </div>
                            )}

                            <div className="space-y-1">
                              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                                <span className="font-semibold text-emerald-400">Approved</span>
                                <span aria-hidden="true">·</span>
                                <span>By @{sub.playerUsername}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono text-slate-300">
                                  IGN: {sub.minecraftUsername}
                                </span>
                              </div>
                              <h3 className="text-lg font-bold text-white">{sub.title}</h3>
                            </div>

                            <p className="text-sm text-slate-300 whitespace-pre-line line-clamp-4">
                              {sub.description}
                            </p>
                          </div>

                          <div className="pt-3 border-t border-[#1A212C] flex flex-wrap items-center gap-2">
                            {sub.projectFileChunkCount > 0 && (
                              <button
                                type="button"
                                disabled={downloadingId === sub.id}
                                onClick={() => handleDownloadProject(sub)}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#181E27] hover:bg-[#222B38] border border-[#2C374A] rounded-lg disabled:opacity-50"
                              >
                                <Download className="w-3.5 h-3.5 text-emerald-400" />
                                {downloadingId === sub.id
                                  ? 'Downloading...'
                                  : `Download (${formatBytes(sub.projectFileSize)})`}
                              </button>
                            )}
                            {sub.externalFileUrl && (
                              <a
                                href={sub.externalFileUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                Project Link
                              </a>
                            )}
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {detailTab === 'teams' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {teams.length === 0 ? (
                    <p className="text-sm text-slate-400">
                      No teams configured for this event yet.
                    </p>
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
                    <p className="text-sm text-slate-400">
                      No approved players have joined yet.
                    </p>
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
                              <td className="py-3 pr-4 font-mono text-slate-200">
                                {p.minecraftUsername}
                              </td>
                              <td className="py-3 pr-4 text-xs text-slate-400">
                                {p.minecraftEdition}
                              </td>
                              <td className="py-3 text-slate-300">
                                {p.teamName || 'Unassigned'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
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

        {/* Published Tournament Grid */}
        {loading ? (
          <div className="p-8 rounded-xl bg-[#11151B] border border-[#232B38] text-sm text-slate-400">
            Loading tournaments...
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#11151B] border border-[#232B38] text-sm text-slate-400">
            No published tournaments match your criteria.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((t) => {
              const st = formatTournamentStatus(t.status);
              const subGate = isTournamentSubmissionOpen(t);
              return (
                <div
                  key={t.id}
                  className="rounded-xl overflow-hidden bg-[#11151B] border border-[#232B38] flex flex-col justify-between"
                >
                  <div>
                    <div className="h-44 relative overflow-hidden border-b border-[#1E2530]">
                      <SafeImage
                        src={t.imageUrl || TOURNAMENT_BANNER_IMAGE}
                        alt={t.name}
                        className="w-full h-full object-cover opacity-80"
                        fallbackTitle={t.name}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-[#11151B] via-[#11151B]/35 to-transparent" />
                    </div>

                    <div className="p-6 pb-4 space-y-2.5">
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
                  </div>

                  <div className="px-6 pb-6 pt-4 border-t border-[#1E2530] space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono tabular-nums text-slate-400">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Event: {t.tournamentDate}</span>
                      <span aria-hidden="true">·</span>
                      <span>Project Deadline: {subGate.deadlineText}</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setSearchParams({ id: t.id })}
                        className="w-full px-4 py-2.5 text-xs font-semibold text-slate-100 bg-[#181E27] hover:bg-[#222A37] border border-[#2C374A] rounded-lg transition-colors whitespace-nowrap"
                      >
                        View Tournament
                      </button>

                      {subGate.open ? (
                        <Link
                          to={`/tournaments/${t.id}/submit`}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors whitespace-nowrap"
                        >
                          <Upload className="w-3.5 h-3.5" />
                          Upload Project
                        </Link>
                      ) : (
                        <button
                          type="button"
                          disabled
                          title={subGate.reason}
                          className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-slate-500 bg-[#151A22] border border-[#232B38] rounded-lg cursor-not-allowed whitespace-nowrap"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          Submissions Closed
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Screenshot Enlargement Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 bg-black/85 p-4 flex items-center justify-center"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="max-w-4xl w-full rounded-xl bg-[#11151B] border border-[#263040] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-[#232B38] flex items-center justify-between gap-4">
              <span className="text-sm font-semibold text-white truncate">
                {previewImage.title}
              </span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-[#1D2430]"
                aria-label="Close image preview"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-3 bg-[#090B0E] flex items-center justify-center max-h-[80vh]">
              <img
                src={previewImage.src}
                alt={previewImage.title}
                className="max-h-[75vh] w-auto object-contain rounded"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

