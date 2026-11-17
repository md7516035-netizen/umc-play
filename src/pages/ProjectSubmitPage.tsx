import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { doc, onSnapshot, serverTimestamp, writeBatch } from 'firebase/firestore';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  FileArchive,
  Lock,
  ShieldAlert,
  Trophy,
  Upload,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { TOURNAMENT_BANNER_IMAGE, UMC_LIMITS, UMC_PATTERNS } from '../constants/validation';
import { SafeImage } from '../components/SafeImage';
import {
  formatBytes,
  formatTournamentStatus,
  isTournamentPublished,
  isTournamentSubmissionOpen,
} from '../utils/formatters';
import { readFileAsBase64Chunks } from '../utils/mediaFiles';
import type { Tournament } from '../types/umc';

export function ProjectSubmitPage() {
  const { tournamentId } = useParams<{ tournamentId: string }>();
  const { user, playerProfile, isAdmin, authReady } = useAuth();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loadingTournament, setLoadingTournament] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [minecraftUsername, setMinecraftUsername] = useState('');
  const [ignInitialized, setIgnInitialized] = useState(false);
  const [projectFile, setProjectFile] = useState<File | null>(null);
  const [externalFileUrl, setExternalFileUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [submittedSuccess, setSubmittedSuccess] = useState<{
    title: string;
    tournamentName: string;
    tournamentId: string;
  } | null>(null);

  useEffect(() => {
    if (!tournamentId || !UMC_PATTERNS.SAFE_ID.test(tournamentId)) {
      setTournament(null);
      setLoadingTournament(false);
      return;
    }

    setLoadingTournament(true);
    setLoadError('');
    const ref = doc(db, 'tournaments', tournamentId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setTournament({ id: snap.id, ...snap.data() } as Tournament);
        } else {
          setTournament(null);
        }
        setLoadingTournament(false);
      },
      (err) => {
        setLoadError(err.message || 'Unable to load tournament.');
        setLoadingTournament(false);
      }
    );
    return () => unsub();
  }, [tournamentId]);

  useEffect(() => {
    if (playerProfile && !ignInitialized) {
      setMinecraftUsername(playerProfile.minecraftUsername);
      setIgnInitialized(true);
    }
  }, [playerProfile, ignInitialized]);

  const handleProjectFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    e.target.value = '';
    setFormError('');
    if (!file) return;
    if (file.size <= 0) {
      setFormError('Selected file is empty.');
      return;
    }
    if (file.size > UMC_LIMITS.PROJECT_MAX_FILE_BYTES) {
      setFormError(
        `File "${file.name}" (${formatBytes(
          file.size
        )}) exceeds the 3 MB direct upload limit. Upload a file up to 3 MB or paste an external download URL below.`
      );
      return;
    }
    setProjectFile(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!tournament || !user || !playerProfile) {
      setFormError('Missing tournament or signed-in player profile.');
      return;
    }

    // Re-check live deadline & publication gate right before upload
    const liveGate = isTournamentSubmissionOpen(tournament);
    if (!liveGate.open) {
      setFormError(liveGate.reason || 'Submissions are closed for this tournament.');
      return;
    }

    const cleanTitle = title.trim();
    const cleanDesc = description.trim();
    const cleanIgn = minecraftUsername.trim();
    const cleanUrl = externalFileUrl.trim();

    if (
      cleanTitle.length < UMC_LIMITS.PROJECT_TITLE_MIN ||
      cleanTitle.length > UMC_LIMITS.PROJECT_TITLE_MAX
    ) {
      setFormError(
        `Project title must be between ${UMC_LIMITS.PROJECT_TITLE_MIN} and ${UMC_LIMITS.PROJECT_TITLE_MAX} characters.`
      );
      return;
    }
    if (!UMC_PATTERNS.MC_USERNAME.test(cleanIgn)) {
      setFormError('Minecraft username must be 3–32 alphanumeric/underscore/space characters.');
      return;
    }
    if (
      cleanDesc.length < UMC_LIMITS.PROJECT_DESC_MIN ||
      cleanDesc.length > UMC_LIMITS.PROJECT_DESC_MAX
    ) {
      setFormError(
        `Project description must be between ${UMC_LIMITS.PROJECT_DESC_MIN} and ${UMC_LIMITS.PROJECT_DESC_MAX} characters.`
      );
      return;
    }
    if (!projectFile && cleanUrl.length < 8) {
      setFormError(
        'Please upload your project file (up to 3 MB) or provide a valid external download URL.'
      );
      return;
    }
    if (cleanUrl && !/^https?:\/\/\S+$/i.test(cleanUrl)) {
      setFormError('External download URL must start with https:// or http://.');
      return;
    }

    setSubmitting(true);
    const subId = `sub_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    try {
      const chunks = projectFile ? await readFileAsBase64Chunks(projectFile) : [];
      const batch = writeBatch(db);
      const subRef = doc(db, 'projectSubmissions', subId);

      batch.set(subRef, {
        tournamentId: tournament.id,
        tournamentName: tournament.name.slice(0, UMC_LIMITS.TOURNAMENT_NAME_MAX),
        playerUid: user.uid,
        playerUsername: playerProfile.username,
        minecraftUsername: cleanIgn,
        title: cleanTitle,
        description: cleanDesc,
        projectFileName: projectFile ? projectFile.name.slice(0, 160) : '',
        projectFileSize: projectFile ? projectFile.size : 0,
        projectFileMime: projectFile
          ? (projectFile.type || 'application/octet-stream').slice(0, 120)
          : '',
        projectFileChunkCount: chunks.length,
        externalFileUrl: cleanUrl,
        status: 'PENDING',
        adminNote: '',
        reviewedBy: '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      chunks.forEach((dataBase64, idx) => {
        const chunkRef = doc(db, 'projectSubmissions', subId, 'chunks', `chunk_${idx}`);
        batch.set(chunkRef, {
          submissionId: subId,
          tournamentId: tournament.id,
          playerUid: user.uid,
          chunkIndex: idx,
          dataBase64,
          createdAt: serverTimestamp(),
        });
      });

      try {
        await batch.commit();
      } catch (fsErr) {
        handleFirestoreError(fsErr, OperationType.CREATE, `projectSubmissions/${subId}`);
      }

      setSubmittedSuccess({
        title: cleanTitle,
        tournamentName: tournament.name,
        tournamentId: tournament.id,
      });
    } catch (err) {
      setFormError(
        err instanceof Error
          ? err.message
          : 'Unable to save your project submission. Please check the tournament deadline and your account status.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingTournament || !authReady) {
    return (
      <div className="bg-[#090B0E] text-slate-300 py-24 text-center text-sm">
        Loading tournament submission portal...
      </div>
    );
  }

  if (loadError || !tournament) {
    return (
      <div className="bg-[#090B0E] text-slate-100 py-16 px-4">
        <div className="max-w-lg mx-auto p-8 rounded-xl bg-[#11151B] border border-[#232B38] text-center space-y-4">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <h1 className="text-2xl font-display font-bold text-white">Tournament Unavailable</h1>
          <p className="text-sm text-slate-400">
            {loadError || 'This tournament does not exist or may have been removed by administration.'}
          </p>
          <Link
            to="/tournaments"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Tournaments
          </Link>
        </div>
      </div>
    );
  }

  if (!isTournamentPublished(tournament)) {
    return (
      <div className="bg-[#090B0E] text-slate-100 py-16 px-4">
        <div className="max-w-lg mx-auto p-8 rounded-xl bg-[#11151B] border border-[#232B38] text-center space-y-4">
          <Lock className="w-10 h-10 text-amber-400 mx-auto" />
          <h1 className="text-2xl font-display font-bold text-white">
            Tournament Not Published
          </h1>
          <p className="text-sm text-slate-400">
            This tournament is currently saved as a draft and is not accepting project submissions.
          </p>
          <Link
            to="/tournaments"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
          >
            <ArrowLeft className="w-4 h-4" />
            View Published Tournaments
          </Link>
        </div>
      </div>
    );
  }

  const gate = isTournamentSubmissionOpen(tournament);
  const statusInfo = formatTournamentStatus(tournament.status);
  const bannerImg = tournament.imageUrl || TOURNAMENT_BANNER_IMAGE;

  if (submittedSuccess) {
    return (
      <div className="bg-[#090B0E] text-slate-100 py-16 px-4">
        <div className="max-w-xl mx-auto p-8 rounded-xl bg-[#11151B] border border-emerald-500/40 text-center space-y-5">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
              Submission Received
            </p>
            <h1 className="text-3xl font-display font-bold text-white">
              Project Uploaded Successfully
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Your project <strong className="text-white">{submittedSuccess.title}</strong> has been
              linked to <strong className="text-white">{submittedSuccess.tournamentName}</strong>{' '}
              and placed in <strong className="text-amber-300">Pending</strong> review. Once an
              Administrator approves it, your project will appear publicly on the tournament page.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
            <Link
              to="/dashboard?tab=projects"
              className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors"
            >
              View My Submitted Projects
            </Link>
            <Link
              to={`/tournaments?id=${submittedSuccess.tournamentId}`}
              className="px-5 py-2.5 text-sm font-semibold text-slate-200 bg-[#181E27] hover:bg-[#222B38] border border-[#2C374A] rounded-lg transition-colors"
            >
              Back to Tournament
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#090B0E] text-slate-100 py-10 sm:py-14 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <Link
            to={`/tournaments?id=${tournament.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to {tournament.name}
          </Link>
        </div>

        {/* Linked Tournament Context Card */}
        <div className="rounded-xl overflow-hidden border border-[#232B38] bg-[#11151B]">
          <div className="relative h-44 sm:h-52">
            <SafeImage
              src={bannerImg}
              alt={tournament.name}
              className="w-full h-full object-cover opacity-60"
              fallbackTitle={tournament.name}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#11151B] via-[#11151B]/65 to-transparent" />
            <div className="absolute bottom-5 left-5 right-5 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300">
                <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                <span className="font-semibold text-emerald-400">Tournament Project Upload</span>
                <span aria-hidden="true">·</span>
                <span className={`font-semibold ${statusInfo.colorClass}`}>{statusInfo.label}</span>
                <span aria-hidden="true">·</span>
                <span>{tournament.edition} Edition</span>
              </div>
              <h1 className="text-2xl sm:text-4xl font-display font-bold text-white">
                {tournament.name}
              </h1>
            </div>
          </div>

          <div className="p-5 sm:p-6 border-t border-[#1E2530] space-y-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-300">
                <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>
                  Project Submission Deadline:{' '}
                  <strong className="font-mono text-white">{gate.deadlineText}</strong>
                </span>
              </div>
              <span
                className={`text-xs font-semibold ${
                  gate.open ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {gate.open ? 'Submissions Open' : 'Submissions Closed'}
              </span>
            </div>

            {tournament.rules && (
              <div className="p-4 rounded-lg bg-[#0B0E12] border border-[#1E2530] space-y-1.5">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Tournament Project Rules
                </div>
                <p className="text-xs sm:text-sm text-slate-300 whitespace-pre-line leading-relaxed">
                  {tournament.rules}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Access & Deadline Gates */}
        {!gate.open ? (
          <div className="p-6 sm:p-8 rounded-xl bg-[#11151B] border border-red-500/35 text-center space-y-4">
            <Clock className="w-9 h-9 text-red-400 mx-auto" />
            <h2 className="text-2xl font-display font-bold text-white">
              Project Submissions Closed
            </h2>
            <p className="text-sm text-slate-300 max-w-lg mx-auto">
              {gate.reason || 'This tournament is no longer accepting project uploads.'}
            </p>
            <Link
              to={`/tournaments?id=${tournament.id}`}
              className="inline-block px-5 py-2.5 text-sm font-semibold text-white bg-[#181E27] hover:bg-[#222B38] border border-[#2C374A] rounded-lg"
            >
              View Tournament Details & Approved Projects
            </Link>
          </div>
        ) : !user ? (
          <div className="p-6 sm:p-8 rounded-xl bg-[#11151B] border border-[#232B38] text-center space-y-4">
            <Lock className="w-9 h-9 text-emerald-400 mx-auto" />
            <h2 className="text-2xl font-display font-bold text-white">Player Login Required</h2>
            <p className="text-sm text-slate-300 max-w-md mx-auto">
              Sign in with your approved UMC player account to upload a project for{' '}
              <strong className="text-white">{tournament.name}</strong>.
            </p>
            <div className="flex flex-wrap justify-center gap-3 pt-1">
              <Link
                to={`/login?redirect=${encodeURIComponent(`/tournaments/${tournament.id}/submit`)}`}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
              >
                Login to Upload Project
              </Link>
              <Link
                to="/register"
                className="px-5 py-2.5 text-sm font-semibold text-slate-200 bg-[#181E27] hover:bg-[#222B38] border border-[#2C374A] rounded-lg"
              >
                Register as Player
              </Link>
            </div>
          </div>
        ) : !playerProfile ? (
          <div className="p-6 sm:p-8 rounded-xl bg-[#11151B] border border-[#232B38] text-center space-y-4">
            <ShieldAlert className="w-9 h-9 text-amber-400 mx-auto" />
            <h2 className="text-2xl font-display font-bold text-white">
              {isAdmin ? 'Administrator Account Signed In' : 'Player Profile Required'}
            </h2>
            <p className="text-sm text-slate-300 max-w-lg mx-auto">
              {isAdmin
                ? 'Only approved Player accounts can submit tournament projects. Use the Admin Dashboard Projects tab to review and approve player submissions.'
                : 'Complete your UMC player registration before submitting tournament projects.'}
            </p>
            <Link
              to={isAdmin ? '/admin' : '/register'}
              className="inline-block px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
            >
              {isAdmin ? 'Open Admin Dashboard' : 'Register Player Profile'}
            </Link>
          </div>
        ) : playerProfile.registrationStatus !== 'APPROVED' ||
          playerProfile.accountStatus !== 'ACTIVE' ? (
          <div className="p-6 sm:p-8 rounded-xl bg-[#11151B] border border-amber-500/35 text-center space-y-4">
            <ShieldAlert className="w-9 h-9 text-amber-400 mx-auto" />
            <h2 className="text-2xl font-display font-bold text-white">
              Player Approval Required
            </h2>
            <p className="text-sm text-slate-300 max-w-lg mx-auto">
              Only players with <strong className="text-emerald-400">Approved</strong>{' '}
              registration and <strong className="text-emerald-400">Active</strong> account status
              can upload tournament projects. Check your Player Dashboard for updates.
            </p>
            <Link
              to="/dashboard"
              className="inline-block px-5 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
            >
              Go to Player Dashboard
            </Link>
          </div>
        ) : (
          /* Eligible Player Project Submission Form */
          <form
            onSubmit={handleSubmit}
            className="p-6 sm:p-8 rounded-xl bg-[#11151B] border border-[#232B38] space-y-6"
          >
            <div className="border-b border-[#1E2530] pb-4 space-y-1">
              <h2 className="text-2xl font-display font-bold text-white">
                Submit Your Tournament Project
              </h2>
              <p className="text-xs sm:text-sm text-slate-400">
                Submitting as <strong className="text-white">@{playerProfile.username}</strong> for{' '}
                <strong className="text-emerald-400">{tournament.name}</strong>.
              </p>
            </div>

            {formError && (
              <div className="p-4 rounded-lg bg-red-950/50 border border-red-500/40 text-red-200 text-sm">
                {formError}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label htmlFor="proj-title" className="block text-sm font-medium text-slate-200">
                  Project Title *
                </label>
                <input
                  id="proj-title"
                  type="text"
                  required
                  minLength={UMC_LIMITS.PROJECT_TITLE_MIN}
                  maxLength={UMC_LIMITS.PROJECT_TITLE_MAX}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Emerald Citadel PvP Map"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="proj-ign" className="block text-sm font-medium text-slate-200">
                  Minecraft Username *
                </label>
                <input
                  id="proj-ign"
                  type="text"
                  required
                  minLength={UMC_LIMITS.MC_USERNAME_MIN}
                  maxLength={UMC_LIMITS.MC_USERNAME_MAX}
                  value={minecraftUsername}
                  onChange={(e) => setMinecraftUsername(e.target.value)}
                  placeholder="Your Minecraft IGN"
                  className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="proj-desc" className="block text-sm font-medium text-slate-200">
                Project Description *
              </label>
              <textarea
                id="proj-desc"
                rows={4}
                required
                minLength={UMC_LIMITS.PROJECT_DESC_MIN}
                maxLength={UMC_LIMITS.PROJECT_DESC_MAX}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain your build, Minecraft version compatibility, coordinates/spawn details, and features..."
                className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            {/* Project File Upload & Optional External URL */}
            <div className="space-y-4 p-4 sm:p-5 rounded-xl bg-[#0B0E12] border border-[#1E2530]">
              <div className="space-y-1">
                <label className="block text-sm font-medium text-slate-200">
                  Project File Upload * (World / Schematic / Resource Pack / Archive up to 3 MB)
                </label>
                <p className="text-xs text-slate-400">
                  Upload a `.mcworld`, `.zip`, `.mcpack`, `.litematic`, `.schem`, or project archive
                  directly into Firebase (max 3 MB). For larger files, include an external download
                  link below.
                </p>
              </div>

              {projectFile ? (
                <div className="p-3.5 rounded-lg bg-[#11151B] border border-emerald-500/35 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileArchive className="w-5 h-5 text-emerald-400 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-white truncate">
                        {projectFile.name}
                      </div>
                      <div className="text-xs font-mono text-slate-400">
                        {formatBytes(projectFile.size)}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setProjectFile(null)}
                    className="px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/15 rounded-lg shrink-0"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2.5 px-4 py-3.5 rounded-lg bg-[#11151B] hover:bg-[#171D26] border border-dashed border-[#2C374A] cursor-pointer text-sm text-slate-200 transition-colors">
                  <Upload className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>Choose Project File (.mcworld, .zip, .mcpack, .schem, etc.)</span>
                  <input
                    type="file"
                    accept=".mcworld,.mcpack,.mcaddon,.mctemplate,.zip,.rar,.7z,.litematic,.schem,.schematic,.nbt,.jar,.pdf,application/zip,application/octet-stream"
                    onChange={handleProjectFileSelected}
                    className="hidden"
                  />
                </label>
              )}

              <div className="space-y-1.5">
                <label htmlFor="proj-url" className="block text-xs font-medium text-slate-300">
                  External Download URL (Optional unless file &gt; 3 MB)
                </label>
                <input
                  id="proj-url"
                  type="url"
                  maxLength={300}
                  value={externalFileUrl}
                  onChange={(e) => setExternalFileUrl(e.target.value)}
                  placeholder="https://drive.google.com/... or https://github.com/..."
                  className="w-full px-3.5 py-2 text-sm bg-[#11151B] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-[#1E2530]">
              <p className="text-xs text-slate-400">
                Submissions start as <strong className="text-amber-400">Pending</strong> until
                reviewed and approved by an Administrator.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Upload className="w-4 h-4" />
                {submitting ? 'Uploading Project...' : 'Submit Project'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
