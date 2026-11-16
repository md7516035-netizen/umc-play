import React, { useEffect, useState } from 'react';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  Edit3,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Plus,
  Save,
  Shield,
  Swords,
  Trash2,
  Trophy,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { UMC_LIMITS } from '../../constants/validation';
import { ConfirmModal } from '../ConfirmModal';
import { SafeImage } from '../SafeImage';
import {
  formatDeadlineDisplay,
  formatMatchStatus,
  formatTournamentStatus,
  isTournamentPublished,
  parseDeadlineInputToDate,
} from '../../utils/formatters';
import { compressImageToDataUrl } from '../../utils/mediaFiles';
import type {
  MatchStatus,
  PlayerProfile,
  Tournament,
  TournamentEdition,
  TournamentMatch,
  TournamentParticipant,
  TournamentStatus,
  TournamentTeam,
} from '../../types/umc';

interface AdminTournamentsPanelProps {
  tournaments: Tournament[];
  players: PlayerProfile[];
  adminUid: string;
  onFeedback: (type: 'success' | 'error', text: string) => void;
}

export function AdminTournamentsPanel({
  tournaments,
  players,
  adminUid,
  onFeedback,
}: AdminTournamentsPanelProps) {
  const [editingTournamentId, setEditingTournamentId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [rules, setRules] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [processingImage, setProcessingImage] = useState(false);
  const [tournamentDate, setTournamentDate] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [projectDeadline, setProjectDeadline] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [status, setStatus] = useState<TournamentStatus>('REGISTRATION_OPEN');
  const [edition, setEdition] = useState<TournamentEdition>('CROSSPLAY');
  const [format, setFormat] = useState('Solo / Squads');
  const [maxParticipants, setMaxParticipants] = useState('64');
  const [winnerName, setWinnerName] = useState('');
  const [winnerAnnouncement, setWinnerAnnouncement] = useState('');
  const [savingTournament, setSavingTournament] = useState(false);
  const [togglingPublishId, setTogglingPublishId] = useState<string | null>(null);

  const [deleteTournamentTarget, setDeleteTournamentTarget] = useState<Tournament | null>(null);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);
  const [subTab, setSubTab] = useState<'participants' | 'teams' | 'matches'>('participants');

  // Subcollection state for selectedTournament
  const [participants, setParticipants] = useState<TournamentParticipant[]>([]);
  const [teams, setTeams] = useState<TournamentTeam[]>([]);
  const [matches, setMatches] = useState<TournamentMatch[]>([]);

  // Add approved player manually to tournament
  const [addPlayerUid, setAddPlayerUid] = useState('');

  // Team form
  const [teamName, setTeamName] = useState('');
  const [teamTag, setTeamTag] = useState('');
  const [teamMembersText, setTeamMembersText] = useState('');
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);

  // Match form
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [matchRound, setMatchRound] = useState('');
  const [matchA, setMatchA] = useState('');
  const [matchB, setMatchB] = useState('');
  const [matchTime, setMatchTime] = useState('');
  const [scoreA, setScoreA] = useState('0');
  const [scoreB, setScoreB] = useState('0');
  const [matchWinner, setMatchWinner] = useState('');
  const [matchStatus, setMatchStatus] = useState<MatchStatus>('SCHEDULED');
  const [matchNotes, setMatchNotes] = useState('');

  useEffect(() => {
    if (!selectedTournament) {
      setParticipants([]);
      setTeams([]);
      setMatches([]);
      return;
    }

    const u1 = onSnapshot(
      collection(db, 'tournaments', selectedTournament.id, 'participants'),
      (snap) => setParticipants(snap.docs.map((d) => d.data() as TournamentParticipant))
    );
    const u2 = onSnapshot(
      collection(db, 'tournaments', selectedTournament.id, 'teams'),
      (snap) => setTeams(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TournamentTeam)))
    );
    const u3 = onSnapshot(
      collection(db, 'tournaments', selectedTournament.id, 'matches'),
      (snap) => setMatches(snap.docs.map((d) => ({ id: d.id, ...d.data() } as TournamentMatch)))
    );

    return () => {
      u1();
      u2();
      u3();
    };
  }, [selectedTournament?.id]);

  const resetTournamentForm = () => {
    setEditingTournamentId(null);
    setName('');
    setDescription('');
    setRules('');
    setImageUrl('');
    setTournamentDate('');
    setRegistrationDeadline('');
    setProjectDeadline('');
    setIsPublished(true);
    setStatus('REGISTRATION_OPEN');
    setEdition('CROSSPLAY');
    setFormat('Solo / Squads');
    setMaxParticipants('64');
    setWinnerName('');
    setWinnerAnnouncement('');
  };

  const startEditTournament = (t: Tournament) => {
    setEditingTournamentId(t.id);
    setName(t.name);
    setDescription(t.description);
    setRules(t.rules || '');
    setImageUrl(t.imageUrl || '');
    setTournamentDate(t.tournamentDate);
    setRegistrationDeadline(t.registrationDeadline);
    setProjectDeadline(t.projectDeadline || '');
    setIsPublished(isTournamentPublished(t));
    setStatus(t.status);
    setEdition(t.edition);
    setFormat(t.format);
    setMaxParticipants(String(t.maxParticipants));
    setWinnerName(t.winnerName);
    setWinnerAnnouncement(t.winnerAnnouncement);
  };

  const handleTournamentImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setProcessingImage(true);
    try {
      const dataUrl = await compressImageToDataUrl(file, 1280, UMC_LIMITS.IMAGE_DATA_URL_MAX_CHARS);
      setImageUrl(dataUrl);
      onFeedback('success', 'Tournament cover image compressed and attached.');
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Unable to process image.');
    } finally {
      setProcessingImage(false);
    }
  };

  const saveTournamentWithPublishState = async (publishState: boolean) => {
    const maxP = Number(maxParticipants);
    if (
      name.trim().length < UMC_LIMITS.TOURNAMENT_NAME_MIN ||
      description.trim().length < UMC_LIMITS.TOURNAMENT_DESC_MIN
    ) {
      onFeedback('error', 'Tournament name (min 3 chars) and description (min 10 chars) are required.');
      return;
    }
    if (!tournamentDate.trim() || !registrationDeadline.trim()) {
      onFeedback('error', 'Tournament date and registration deadline are required.');
      return;
    }
    if (rules.trim().length > UMC_LIMITS.TOURNAMENT_RULES_MAX) {
      onFeedback('error', `Tournament rules must be under ${UMC_LIMITS.TOURNAMENT_RULES_MAX} characters.`);
      return;
    }
    if (imageUrl.trim().length > 240000) {
      onFeedback('error', 'Tournament image URL/data is too large. Please upload a smaller image.');
      return;
    }
    if (!Number.isInteger(maxP) || maxP < 2 || maxP > 1000) {
      onFeedback('error', 'Max participants must be between 2 and 1000.');
      return;
    }

    const effectiveDeadlineStr = projectDeadline.trim() || registrationDeadline.trim();
    const deadlineDate = parseDeadlineInputToDate(effectiveDeadlineStr);
    const projectDeadlineAt = deadlineDate ? Timestamp.fromDate(deadlineDate) : null;

    setSavingTournament(true);
    try {
      const sharedFields = {
        name: name.trim(),
        description: description.trim(),
        rules: rules.trim(),
        imageUrl: imageUrl.trim(),
        tournamentDate: tournamentDate.trim(),
        registrationDeadline: registrationDeadline.trim(),
        projectDeadline: projectDeadline.trim(),
        projectDeadlineAt,
        isPublished: publishState,
        status,
        edition,
        format: format.trim(),
        maxParticipants: maxP,
        winnerName: winnerName.trim(),
        winnerAnnouncement: winnerAnnouncement.trim(),
      };

      if (editingTournamentId) {
        const ref = doc(db, 'tournaments', editingTournamentId);
        try {
          await updateDoc(ref, {
            ...sharedFields,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `tournaments/${editingTournamentId}`);
        }
        onFeedback(
          'success',
          publishState
            ? 'Tournament updated and published to the website.'
            : 'Tournament updated and saved as draft (hidden from public).'
        );
      } else {
        const id = `tourn_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const ref = doc(db, 'tournaments', id);
        try {
          await setDoc(ref, {
            ...sharedFields,
            createdBy: adminUid,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `tournaments/${id}`);
        }
        onFeedback(
          'success',
          publishState
            ? 'Tournament created and published automatically on the public website.'
            : 'Tournament saved as draft. Only administrators can view drafts.'
        );
      }
      resetTournamentForm();
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to save tournament.');
    } finally {
      setSavingTournament(false);
    }
  };

  const handleSaveTournament = async (e: React.FormEvent) => {
    e.preventDefault();
    await saveTournamentWithPublishState(isPublished);
  };

  const handleTogglePublish = async (t: Tournament) => {
    const nextPublished = !isTournamentPublished(t);
    setTogglingPublishId(t.id);
    try {
      try {
        await updateDoc(doc(db, 'tournaments', t.id), {
          isPublished: nextPublished,
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `tournaments/${t.id}`);
      }
      onFeedback(
        'success',
        nextPublished
          ? `"${t.name}" is now published on the public website.`
          : `"${t.name}" was unpublished and moved to drafts.`
      );
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Unable to update visibility.');
    } finally {
      setTogglingPublishId(null);
    }
  };

  const handleDeleteTournament = async () => {
    if (!deleteTournamentTarget) return;
    setSavingTournament(true);
    try {
      try {
        await deleteDoc(doc(db, 'tournaments', deleteTournamentTarget.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `tournaments/${deleteTournamentTarget.id}`);
      }
      onFeedback('success', `Tournament "${deleteTournamentTarget.name}" deleted.`);
      if (selectedTournament?.id === deleteTournamentTarget.id) setSelectedTournament(null);
      if (editingTournamentId === deleteTournamentTarget.id) resetTournamentForm();
      setDeleteTournamentTarget(null);
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to delete tournament.');
    } finally {
      setSavingTournament(false);
    }
  };

  const approvedPlayersNotJoined = players.filter(
    (p) =>
      p.registrationStatus === 'APPROVED' &&
      p.accountStatus === 'ACTIVE' &&
      !participants.some((part) => part.playerUid === p.uid)
  );

  const handleAddParticipant = async () => {
    if (!selectedTournament || !addPlayerUid) return;
    const player = players.find((p) => p.uid === addPlayerUid);
    if (!player) return;
    try {
      await setDoc(doc(db, 'tournaments', selectedTournament.id, 'participants', player.uid), {
        playerUid: player.uid,
        tournamentId: selectedTournament.id,
        username: player.username,
        minecraftUsername: player.minecraftUsername,
        minecraftEdition: player.minecraftEdition,
        teamId: '',
        teamName: '',
        joinedAt: serverTimestamp(),
      });
      setAddPlayerUid('');
      onFeedback('success', `Added ${player.username} to ${selectedTournament.name}.`);
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Could not add participant.');
    }
  };

  const handleAssignTeam = async (playerUid: string, teamId: string) => {
    if (!selectedTournament) return;
    const team = teams.find((t) => t.id === teamId);
    try {
      await updateDoc(doc(db, 'tournaments', selectedTournament.id, 'participants', playerUid), {
        teamId: team ? team.id : '',
        teamName: team ? team.name : '',
      });
      onFeedback('success', 'Participant team assignment updated.');
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to assign team.');
    }
  };

  const handleRemoveParticipant = async (playerUid: string) => {
    if (!selectedTournament) return;
    try {
      await deleteDoc(doc(db, 'tournaments', selectedTournament.id, 'participants', playerUid));
      onFeedback('success', 'Participant removed.');
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to remove participant.');
    }
  };

  const handleSaveTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTournament) return;
    const memberNames = teamMembersText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 16);
    try {
      if (editingTeamId) {
        await updateDoc(doc(db, 'tournaments', selectedTournament.id, 'teams', editingTeamId), {
          name: teamName.trim(),
          tag: teamTag.trim(),
          captainUid: '',
          memberNames,
          updatedAt: serverTimestamp(),
        });
        onFeedback('success', 'Team updated.');
      } else {
        const tid = `team_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await setDoc(doc(db, 'tournaments', selectedTournament.id, 'teams', tid), {
          tournamentId: selectedTournament.id,
          name: teamName.trim(),
          tag: teamTag.trim(),
          captainUid: '',
          memberNames,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        onFeedback('success', 'Team created.');
      }
      setEditingTeamId(null);
      setTeamName('');
      setTeamTag('');
      setTeamMembersText('');
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to save team.');
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!selectedTournament) return;
    try {
      await deleteDoc(doc(db, 'tournaments', selectedTournament.id, 'teams', teamId));
      onFeedback('success', 'Team deleted.');
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to delete team.');
    }
  };

  const handleSaveMatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTournament) return;
    try {
      const payload = {
        tournamentId: selectedTournament.id,
        round: matchRound.trim(),
        participantA: matchA.trim(),
        participantB: matchB.trim(),
        scheduledTime: matchTime.trim(),
        scoreA: Math.max(0, Number(scoreA) || 0),
        scoreB: Math.max(0, Number(scoreB) || 0),
        winner: matchWinner.trim(),
        status: matchStatus,
        notes: matchNotes.trim(),
        updatedAt: serverTimestamp(),
      };
      if (editingMatchId) {
        await updateDoc(
          doc(db, 'tournaments', selectedTournament.id, 'matches', editingMatchId),
          payload
        );
        onFeedback('success', 'Match updated.');
      } else {
        const mid = `match_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await setDoc(doc(db, 'tournaments', selectedTournament.id, 'matches', mid), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        onFeedback('success', 'Match scheduled.');
      }
      setEditingMatchId(null);
      setMatchRound('');
      setMatchA('');
      setMatchB('');
      setMatchTime('');
      setScoreA('0');
      setScoreB('0');
      setMatchWinner('');
      setMatchStatus('SCHEDULED');
      setMatchNotes('');
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to save match.');
    }
  };

  const handleDeleteMatch = async (matchId: string) => {
    if (!selectedTournament) return;
    try {
      await deleteDoc(doc(db, 'tournaments', selectedTournament.id, 'matches', matchId));
      onFeedback('success', 'Match deleted.');
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to delete match.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Create / Edit Tournament Form */}
        <form
          onSubmit={handleSaveTournament}
          className="lg:col-span-5 p-6 rounded-xl bg-[#11151B] border border-[#232B38] space-y-4 h-fit"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              {editingTournamentId ? 'Edit Tournament' : 'Create Tournament'}
            </h2>
            {editingTournamentId && (
              <button
                type="button"
                onClick={resetTournamentForm}
                className="text-xs text-slate-400 hover:text-white underline"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-200">Tournament Name *</label>
            <input
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="UMC Winter Championship 2026"
              className="w-full px-3.5 py-2 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-200">Description *</label>
            <textarea
              rows={3}
              required
              maxLength={3000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Rules summary, game modes, and stage details..."
              className="w-full px-3.5 py-2 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-slate-200">
              Tournament Rules (Optional)
            </label>
            <textarea
              rows={3}
              maxLength={UMC_LIMITS.TOURNAMENT_RULES_MAX}
              value={rules}
              onChange={(e) => setRules(e.target.value)}
              placeholder="Specific build themes, project file requirements, world version, and judging criteria..."
              className="w-full px-3.5 py-2 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          {/* Tournament Image Upload / URL */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-sm font-medium text-slate-200">
                Tournament Cover Image (Optional)
              </label>
              {imageUrl && (
                <button
                  type="button"
                  onClick={() => setImageUrl('')}
                  className="inline-flex items-center gap-1 text-xs text-red-400 hover:underline"
                >
                  <X className="w-3.5 h-3.5" />
                  Remove
                </button>
              )}
            </div>

            {imageUrl && (
              <div className="h-32 rounded-lg overflow-hidden border border-[#263040] bg-[#0B0E12]">
                <SafeImage
                  src={imageUrl}
                  alt="Tournament banner preview"
                  className="w-full h-full object-cover"
                  fallbackTitle="Tournament Banner"
                />
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-2">
              <label className="inline-flex items-center justify-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-100 bg-[#181E27] hover:bg-[#222A37] border border-[#2C374A] rounded-lg cursor-pointer whitespace-nowrap shrink-0">
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                {processingImage ? 'Compressing...' : 'Upload Image'}
                <input
                  type="file"
                  accept="image/*"
                  disabled={processingImage}
                  onChange={handleTournamentImageUpload}
                  className="hidden"
                />
              </label>
              <div className="relative flex-1">
                <ImageIcon className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={imageUrl.startsWith('data:') ? '' : imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder={
                    imageUrl.startsWith('data:')
                      ? 'Uploaded image attached (or paste URL to replace)'
                      : 'Or paste https:// image URL...'
                  }
                  className="w-full pl-8 pr-3 py-2 text-xs bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Tournament Date *</label>
              <input
                type="date"
                required
                value={tournamentDate}
                onChange={(e) => setTournamentDate(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">
                Registration Deadline *
              </label>
              <input
                type="date"
                required
                value={registrationDeadline}
                onChange={(e) => setRegistrationDeadline(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Project Submission Deadline (Date & Time)
            </label>
            <input
              type="datetime-local"
              value={projectDeadline}
              onChange={(e) => setProjectDeadline(e.target.value)}
              className="w-full px-3 py-2 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 font-mono"
            />
            <p className="text-[11px] text-slate-500">
              Players cannot upload projects after this deadline. Leave blank to use end of
              Registration Deadline ({registrationDeadline || 'required above'}).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TournamentStatus)}
                className="w-full px-3 py-2 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100"
              >
                <option value="UPCOMING">Upcoming</option>
                <option value="REGISTRATION_OPEN">Registration Open</option>
                <option value="ONGOING">Ongoing</option>
                <option value="COMPLETED">Completed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Edition</label>
              <select
                value={edition}
                onChange={(e) => setEdition(e.target.value as TournamentEdition)}
                className="w-full px-3 py-2 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100"
              >
                <option value="CROSSPLAY">Crossplay</option>
                <option value="JAVA">Java Edition</option>
                <option value="BEDROCK">Bedrock Edition</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Format *</label>
              <input
                type="text"
                required
                maxLength={80}
                value={format}
                onChange={(e) => setFormat(e.target.value)}
                placeholder="4v4 / Solo"
                className="w-full px-3 py-2 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-300">Max Players *</label>
              <input
                type="number"
                required
                min={2}
                max={1000}
                value={maxParticipants}
                onChange={(e) => setMaxParticipants(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Winner / Champion (Optional)
            </label>
            <input
              type="text"
              maxLength={120}
              value={winnerName}
              onChange={(e) => setWinnerName(e.target.value)}
              placeholder="Team or Player Champion Name"
              className="w-full px-3 py-2 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-slate-300">
              Winner Announcement (Optional)
            </label>
            <textarea
              rows={2}
              maxLength={1000}
              value={winnerAnnouncement}
              onChange={(e) => setWinnerAnnouncement(e.target.value)}
              placeholder="Official podium summary..."
              className="w-full px-3 py-2 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
            <button
              type="button"
              disabled={savingTournament || processingImage}
              onClick={() => saveTournamentWithPublishState(true)}
              className="inline-flex items-center justify-center gap-2 py-2.5 px-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              {savingTournament
                ? 'Saving...'
                : editingTournamentId
                ? 'Save & Publish'
                : 'Publish Tournament'}
            </button>
            <button
              type="button"
              disabled={savingTournament || processingImage}
              onClick={() => saveTournamentWithPublishState(false)}
              className="inline-flex items-center justify-center gap-2 py-2.5 px-3 text-sm font-semibold text-slate-200 bg-[#181E27] hover:bg-[#222B38] border border-[#2C374A] rounded-lg transition-colors disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {editingTournamentId ? 'Save as Draft' : 'Save Draft'}
            </button>
          </div>
        </form>

        {/* Tournament List */}
        <div className="lg:col-span-7 space-y-4">
          {tournaments.length === 0 ? (
            <div className="p-8 rounded-xl bg-[#11151B] border border-[#232B38] text-sm text-slate-400 text-center">
              No tournaments created yet. Create your first tournament using the form.
            </div>
          ) : (
            tournaments.map((t) => {
              const st = formatTournamentStatus(t.status);
              const published = isTournamentPublished(t);
              const isSelected = selectedTournament?.id === t.id;
              return (
                <div
                  key={t.id}
                  className={`p-5 rounded-xl border space-y-3 ${
                    isSelected
                      ? 'bg-[#12191E] border-emerald-500/45'
                      : 'bg-[#11151B] border-[#232B38]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      {t.imageUrl && (
                        <div className="w-16 h-16 rounded-lg overflow-hidden border border-[#232B38] bg-[#0B0E12] shrink-0 hidden sm:block">
                          <SafeImage
                            src={t.imageUrl}
                            alt={t.name}
                            className="w-full h-full object-cover"
                            fallbackTitle={t.name}
                          />
                        </div>
                      )}
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span
                            className={`font-semibold ${
                              published ? 'text-emerald-400' : 'text-amber-400'
                            }`}
                          >
                            {published ? 'Published' : 'Draft'}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span className={`font-semibold ${st.colorClass}`}>{st.label}</span>
                          <span aria-hidden="true">·</span>
                          <span>{t.edition}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">{t.tournamentDate}</span>
                        </div>
                        <h3 className="text-xl font-bold text-white truncate">{t.name}</h3>
                        <p className="text-xs text-slate-400 font-mono tabular-nums">
                          Project Deadline: {formatDeadlineDisplay(t)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        disabled={togglingPublishId === t.id}
                        onClick={() => handleTogglePublish(t)}
                        title={published ? 'Unpublish (Move to Draft)' : 'Publish Tournament'}
                        className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-[#1D2430] disabled:opacity-50"
                      >
                        {published ? (
                          <EyeOff className="w-4 h-4 text-amber-300" />
                        ) : (
                          <Eye className="w-4 h-4 text-emerald-400" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => startEditTournament(t)}
                        title="Edit Tournament"
                        className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-[#1D2430]"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTournamentTarget(t)}
                        title="Delete Tournament"
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/15"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-slate-400 line-clamp-2">{t.description}</p>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1E2530]">
                    <span className="text-xs text-slate-400">
                      {t.winnerName ? `Winner: ${t.winnerName}` : `Format: ${t.format}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={togglingPublishId === t.id}
                        onClick={() => handleTogglePublish(t)}
                        className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                          published
                            ? 'text-amber-300 bg-amber-500/10 border-amber-500/30 hover:bg-amber-500/20'
                            : 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30 hover:bg-emerald-500/20'
                        }`}
                      >
                        {togglingPublishId === t.id
                          ? 'Updating...'
                          : published
                          ? 'Unpublish'
                          : 'Publish Now'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedTournament(isSelected ? null : t)}
                        className="px-3.5 py-1.5 text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg"
                      >
                        {isSelected ? 'Close Bracket Manager' : 'Manage Roster, Teams & Matches'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Selected Tournament Operations: Participants, Teams, Matches */}
      {selectedTournament && (
        <div className="p-6 rounded-xl bg-[#11151B] border border-emerald-500/35 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1E2530] pb-4">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                Tournament Operations
              </span>
              <h3 className="text-2xl font-display font-bold text-white">
                {selectedTournament.name}
              </h3>
            </div>

            <div className="flex flex-wrap gap-1 p-1 bg-[#0B0E12] border border-[#1E2530] rounded-lg">
              <button
                type="button"
                onClick={() => setSubTab('participants')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md ${
                  subTab === 'participants' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                Participants ({participants.length})
              </button>
              <button
                type="button"
                onClick={() => setSubTab('teams')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md ${
                  subTab === 'teams' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                Teams ({teams.length})
              </button>
              <button
                type="button"
                onClick={() => setSubTab('matches')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md ${
                  subTab === 'matches' ? 'bg-emerald-600 text-white' : 'text-slate-400'
                }`}
              >
                <Swords className="w-3.5 h-3.5" />
                Matches & Results ({matches.length})
              </button>
            </div>
          </div>

          {/* Participants Subtab */}
          {subTab === 'participants' && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <select
                  value={addPlayerUid}
                  onChange={(e) => setAddPlayerUid(e.target.value)}
                  className="flex-1 max-w-md px-3.5 py-2 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100"
                >
                  <option value="">Select an approved player to enroll...</option>
                  {approvedPlayersNotJoined.map((p) => (
                    <option key={p.uid} value={p.uid}>
                      {p.username} (IGN: {p.minecraftUsername})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!addPlayerUid}
                  onClick={handleAddParticipant}
                  className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg disabled:opacity-40"
                >
                  Add Participant
                </button>
              </div>

              {participants.length === 0 ? (
                <p className="text-sm text-slate-400">No participants enrolled yet.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-[#1E2530] text-xs text-slate-400">
                        <th className="py-2.5 pr-4">Username</th>
                        <th className="py-2.5 pr-4">Minecraft IGN</th>
                        <th className="py-2.5 pr-4">Edition</th>
                        <th className="py-2.5 pr-4">Assign Team</th>
                        <th className="py-2.5 text-right">Remove</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1A202B]">
                      {participants.map((part) => (
                        <tr key={part.playerUid}>
                          <td className="py-2.5 pr-4 font-medium text-white">{part.username}</td>
                          <td className="py-2.5 pr-4 font-mono text-slate-200">
                            {part.minecraftUsername}
                          </td>
                          <td className="py-2.5 pr-4 text-xs text-slate-400">
                            {part.minecraftEdition}
                          </td>
                          <td className="py-2.5 pr-4">
                            <select
                              value={part.teamId}
                              onChange={(e) => handleAssignTeam(part.playerUid, e.target.value)}
                              className="px-2.5 py-1.5 text-xs bg-[#0B0E12] border border-[#263040] rounded text-slate-100"
                            >
                              <option value="">Unassigned</option>
                              {teams.map((tm) => (
                                <option key={tm.id} value={tm.id}>
                                  {tm.name} [{tm.tag}]
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => handleRemoveParticipant(part.playerUid)}
                              className="p-1.5 text-red-400 hover:bg-red-500/15 rounded"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Teams Subtab */}
          {subTab === 'teams' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleSaveTeam}
                className="lg:col-span-4 p-4 rounded-lg bg-[#0B0E12] border border-[#1E2530] space-y-3 h-fit"
              >
                <h4 className="font-bold text-white text-sm">
                  {editingTeamId ? 'Edit Team' : 'Create Team'}
                </h4>
                <input
                  type="text"
                  required
                  maxLength={80}
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  placeholder="Team Name (e.g. Emerald Guardians)"
                  className="w-full px-3 py-2 text-sm bg-[#11151B] border border-[#263040] rounded-lg text-slate-100"
                />
                <input
                  type="text"
                  required
                  maxLength={12}
                  value={teamTag}
                  onChange={(e) => setTeamTag(e.target.value)}
                  placeholder="Tag (e.g. EMG)"
                  className="w-full px-3 py-2 text-sm bg-[#11151B] border border-[#263040] rounded-lg text-slate-100 font-mono"
                />
                <input
                  type="text"
                  value={teamMembersText}
                  onChange={(e) => setTeamMembersText(e.target.value)}
                  placeholder="Member IGNs (comma-separated)"
                  className="w-full px-3 py-2 text-sm bg-[#11151B] border border-[#263040] rounded-lg text-slate-100"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
                  >
                    {editingTeamId ? 'Update Team' : 'Add Team'}
                  </button>
                  {editingTeamId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTeamId(null);
                        setTeamName('');
                        setTeamTag('');
                        setTeamMembersText('');
                      }}
                      className="px-3 py-2 text-xs text-slate-300 bg-[#181E27] rounded-lg"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {teams.length === 0 ? (
                  <p className="text-sm text-slate-400">No teams created yet.</p>
                ) : (
                  teams.map((tm) => (
                    <div
                      key={tm.id}
                      className="p-4 rounded-lg bg-[#0B0E12] border border-[#1E2530] space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-bold text-white">{tm.name}</span>{' '}
                          <span className="font-mono text-xs text-emerald-400">[{tm.tag}]</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingTeamId(tm.id);
                              setTeamName(tm.name);
                              setTeamTag(tm.tag);
                              setTeamMembersText(tm.memberNames.join(', '));
                            }}
                            className="p-1 text-slate-300 hover:text-white"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTeam(tm.id)}
                            className="p-1 text-red-400"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400">
                        {tm.memberNames.length > 0
                          ? tm.memberNames.join(', ')
                          : 'No roster names listed'}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Matches & Results Subtab */}
          {subTab === 'matches' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <form
                onSubmit={handleSaveMatch}
                className="lg:col-span-4 p-4 rounded-lg bg-[#0B0E12] border border-[#1E2530] space-y-3 h-fit"
              >
                <h4 className="font-bold text-white text-sm flex items-center gap-1.5">
                  <Trophy className="w-4 h-4 text-emerald-400" />
                  {editingMatchId ? 'Update Match / Result' : 'Schedule Match'}
                </h4>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={matchRound}
                  onChange={(e) => setMatchRound(e.target.value)}
                  placeholder="Round (e.g. Quarterfinal 1)"
                  className="w-full px-3 py-2 text-sm bg-[#11151B] border border-[#263040] rounded-lg text-slate-100"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={matchA}
                    onChange={(e) => setMatchA(e.target.value)}
                    placeholder="Team / Player A"
                    className="w-full px-3 py-2 text-sm bg-[#11151B] border border-[#263040] rounded-lg text-slate-100"
                  />
                  <input
                    type="text"
                    required
                    maxLength={80}
                    value={matchB}
                    onChange={(e) => setMatchB(e.target.value)}
                    placeholder="Team / Player B"
                    className="w-full px-3 py-2 text-sm bg-[#11151B] border border-[#263040] rounded-lg text-slate-100"
                  />
                </div>
                <input
                  type="text"
                  required
                  maxLength={60}
                  value={matchTime}
                  onChange={(e) => setMatchTime(e.target.value)}
                  placeholder="Schedule (e.g. 2026-12-01 18:00 UTC)"
                  className="w-full px-3 py-2 text-sm bg-[#11151B] border border-[#263040] rounded-lg text-slate-100 font-mono"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={scoreA}
                    onChange={(e) => setScoreA(e.target.value)}
                    placeholder="Score A"
                    className="w-full px-3 py-2 text-sm bg-[#11151B] border border-[#263040] rounded-lg text-slate-100 font-mono tabular-nums"
                  />
                  <input
                    type="number"
                    min={0}
                    max={9999}
                    value={scoreB}
                    onChange={(e) => setScoreB(e.target.value)}
                    placeholder="Score B"
                    className="w-full px-3 py-2 text-sm bg-[#11151B] border border-[#263040] rounded-lg text-slate-100 font-mono tabular-nums"
                  />
                  <select
                    value={matchStatus}
                    onChange={(e) => setMatchStatus(e.target.value as MatchStatus)}
                    className="w-full px-2 py-2 text-xs bg-[#11151B] border border-[#263040] rounded-lg text-slate-100"
                  >
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="LIVE">Live</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
                <input
                  type="text"
                  maxLength={80}
                  value={matchWinner}
                  onChange={(e) => setMatchWinner(e.target.value)}
                  placeholder="Match Winner (Optional)"
                  className="w-full px-3 py-2 text-sm bg-[#11151B] border border-[#263040] rounded-lg text-slate-100"
                />
                <input
                  type="text"
                  maxLength={300}
                  value={matchNotes}
                  onChange={(e) => setMatchNotes(e.target.value)}
                  placeholder="Notes / Server Lobby (Optional)"
                  className="w-full px-3 py-2 text-sm bg-[#11151B] border border-[#263040] rounded-lg text-slate-100"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="flex-1 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
                  >
                    {editingMatchId ? 'Update Match' : 'Save Match'}
                  </button>
                  {editingMatchId && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMatchId(null);
                        setMatchRound('');
                        setMatchA('');
                        setMatchB('');
                        setMatchTime('');
                        setScoreA('0');
                        setScoreB('0');
                        setMatchWinner('');
                        setMatchStatus('SCHEDULED');
                        setMatchNotes('');
                      }}
                      className="px-3 py-2 text-xs text-slate-300 bg-[#181E27] rounded-lg"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="lg:col-span-8 space-y-3">
                {matches.length === 0 ? (
                  <p className="text-sm text-slate-400">No matches scheduled yet.</p>
                ) : (
                  matches.map((m) => {
                    const ms = formatMatchStatus(m.status);
                    return (
                      <div
                        key={m.id}
                        className="p-4 rounded-lg bg-[#0B0E12] border border-[#1E2530] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <span className={`font-semibold ${ms.colorClass}`}>{ms.label}</span>
                            <span aria-hidden="true">·</span>
                            <span>{m.round}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">{m.scheduledTime}</span>
                          </div>
                          <div className="text-base font-bold text-white">
                            {m.participantA}{' '}
                            <span className="font-mono text-emerald-400 mx-1">
                              {m.scoreA} – {m.scoreB}
                            </span>{' '}
                            {m.participantB}
                          </div>
                          {m.winner && (
                            <div className="text-xs text-emerald-400">Winner: {m.winner}</div>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMatchId(m.id);
                              setMatchRound(m.round);
                              setMatchA(m.participantA);
                              setMatchB(m.participantB);
                              setMatchTime(m.scheduledTime);
                              setScoreA(String(m.scoreA));
                              setScoreB(String(m.scoreB));
                              setMatchWinner(m.winner);
                              setMatchStatus(m.status);
                              setMatchNotes(m.notes);
                            }}
                            className="p-2 text-slate-300 hover:text-white rounded hover:bg-[#181E27]"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMatch(m.id)}
                            className="p-2 text-red-400 rounded hover:bg-red-500/15"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTournamentTarget}
        title="Delete Tournament"
        description={`Delete "${deleteTournamentTarget?.name || ''}"?`}
        confirmLabel="Delete"
        danger
        loading={savingTournament}
        onConfirm={handleDeleteTournament}
        onCancel={() => setDeleteTournamentTarget(null)}
      />
    </div>
  );
}
