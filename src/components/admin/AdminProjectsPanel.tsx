import { useMemo, useState } from 'react';
import {
  doc,
  serverTimestamp,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  CheckCircle2,
  Clock,
  Download,
  ExternalLink,
  FolderKanban,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { UMC_LIMITS } from '../../constants/validation';
import { ConfirmModal } from '../ConfirmModal';
import {
  formatBytes,
  formatSubmissionStatus,
  formatTimestamp,
  isTournamentPublished,
} from '../../utils/formatters';
import { downloadSubmissionFile } from '../../utils/mediaFiles';
import type {
  ProjectSubmission,
  ProjectSubmissionStatus,
  Tournament,
} from '../../types/umc';

interface AdminProjectsPanelProps {
  submissions: ProjectSubmission[];
  tournaments: Tournament[];
  adminUid: string;
  onFeedback: (type: 'success' | 'error', text: string) => void;
}

export function AdminProjectsPanel({
  submissions,
  tournaments,
  adminUid,
  onFeedback,
}: AdminProjectsPanelProps) {
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProjectSubmissionStatus>('ALL');
  const [tournamentFilter, setTournamentFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [adminNotes, setAdminNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProjectSubmission | null>(null);

  const tournamentMap = useMemo(() => {
    const map = new Map<string, Tournament>();
    for (const t of tournaments) {
      map.set(t.id, t);
    }
    return map;
  }, [tournaments]);

  // All tournament IDs represented in either tournaments list or existing submissions
  const filterTournamentOptions = useMemo(() => {
    const seen = new Map<string, string>();
    for (const t of tournaments) {
      seen.set(t.id, t.name);
    }
    for (const s of submissions) {
      if (!seen.has(s.tournamentId)) {
        seen.set(s.tournamentId, `${s.tournamentName} (Deleted Tournament)`);
      }
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [tournaments, submissions]);

  const filteredSubmissions = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return submissions.filter((s) => {
      if (statusFilter !== 'ALL' && s.status !== statusFilter) return false;
      if (tournamentFilter !== 'ALL' && s.tournamentId !== tournamentFilter) return false;
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        s.playerUsername.toLowerCase().includes(q) ||
        s.minecraftUsername.toLowerCase().includes(q) ||
        s.tournamentName.toLowerCase().includes(q)
      );
    });
  }, [submissions, statusFilter, tournamentFilter, searchTerm]);

  // Group filtered submissions by tournament
  const groupedByTournament = useMemo(() => {
    const groups = new Map<
      string,
      {
        tournamentId: string;
        tournamentName: string;
        tournament: Tournament | null;
        items: ProjectSubmission[];
      }
    >();

    for (const sub of filteredSubmissions) {
      const existing = groups.get(sub.tournamentId);
      const tObj = tournamentMap.get(sub.tournamentId) || null;
      if (existing) {
        existing.items.push(sub);
      } else {
        groups.set(sub.tournamentId, {
          tournamentId: sub.tournamentId,
          tournamentName: tObj?.name || sub.tournamentName,
          tournament: tObj,
          items: [sub],
        });
      }
    }

    return Array.from(groups.values());
  }, [filteredSubmissions, tournamentMap]);

  const getNoteValue = (sub: ProjectSubmission) =>
    adminNotes[sub.id] !== undefined ? adminNotes[sub.id] : sub.adminNote || '';

  const handleReviewStatus = async (
    sub: ProjectSubmission,
    nextStatus: ProjectSubmissionStatus
  ) => {
    const note = getNoteValue(sub).trim().slice(0, UMC_LIMITS.PROJECT_ADMIN_NOTE_MAX);
    setBusyId(sub.id);
    try {
      const ref = doc(db, 'projectSubmissions', sub.id);
      try {
        await updateDoc(ref, {
          status: nextStatus,
          adminNote: note,
          reviewedBy: adminUid,
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `projectSubmissions/${sub.id}`);
      }
      const label =
        nextStatus === 'APPROVED'
          ? 'Approved (now visible publicly)'
          : nextStatus === 'REJECTED'
          ? 'Rejected'
          : 'Reset to Pending';
      onFeedback('success', `Project "${sub.title}" marked as ${label}.`);
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Unable to update submission status.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteSubmission = async () => {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setBusyId(target.id);
    try {
      const batch = writeBatch(db);
      for (let i = 0; i < (target.projectFileChunkCount || 0); i += 1) {
        batch.delete(doc(db, 'projectSubmissions', target.id, 'chunks', `chunk_${i}`));
      }
      batch.delete(doc(db, 'projectSubmissions', target.id));
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `projectSubmissions/${target.id}`);
      }
      onFeedback('success', `Project submission "${target.title}" deleted.`);
      setDeleteTarget(null);
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to delete submission.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDownload = async (sub: ProjectSubmission) => {
    setDownloadingId(sub.id);
    try {
      await downloadSubmissionFile(sub);
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Unable to download project file.');
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="p-4 sm:p-5 rounded-xl bg-[#11151B] border border-[#232B38] space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row gap-3 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search project, player, IGN, or tournament..."
                className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <select
              value={tournamentFilter}
              onChange={(e) => setTournamentFilter(e.target.value)}
              className="px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">All Tournaments ({submissions.length})</option>
              {filterTournamentOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap gap-1 p-1 bg-[#0B0E12] border border-[#1E2530] rounded-lg w-fit">
            {(['ALL', 'PENDING', 'APPROVED', 'REJECTED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === st
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {st === 'ALL' ? 'All Statuses' : formatSubmissionStatus(st).label}
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-slate-400">
          Showing {filteredSubmissions.length} of {submissions.length} project submission
          {submissions.length === 1 ? '' : 's'} grouped by tournament. Only{' '}
          <strong className="text-emerald-400">Approved</strong> projects appear on public
          tournament pages.
        </p>
      </div>

      {/* Grouped Submissions */}
      {groupedByTournament.length === 0 ? (
        <div className="p-8 rounded-xl bg-[#11151B] border border-[#232B38] text-center space-y-2">
          <FolderKanban className="w-8 h-8 text-slate-500 mx-auto" />
          <p className="text-sm text-slate-300 font-medium">No matching project submissions found.</p>
          <p className="text-xs text-slate-500">
            Submitted player projects will automatically appear here organized by tournament.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByTournament.map((group) => {
            const pendingCount = group.items.filter((i) => i.status === 'PENDING').length;
            const approvedCount = group.items.filter((i) => i.status === 'APPROVED').length;
            const rejectedCount = group.items.filter((i) => i.status === 'REJECTED').length;

            const tournamentStateLabel = !group.tournament
              ? 'Deleted Tournament'
              : isTournamentPublished(group.tournament)
              ? 'Published Tournament'
              : 'Draft (Unpublished)';
            const tournamentStateTone = !group.tournament
              ? 'text-red-400'
              : isTournamentPublished(group.tournament)
              ? 'text-emerald-400'
              : 'text-amber-400';

            return (
              <section
                key={group.tournamentId}
                className="rounded-xl bg-[#11151B] border border-[#232B38] overflow-hidden"
              >
                {/* Tournament Group Header */}
                <div className="p-5 bg-[#0E1218] border-b border-[#232B38] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className={`font-semibold ${tournamentStateTone}`}>
                        {tournamentStateLabel}
                      </span>
                      <span aria-hidden="true" className="text-slate-600">·</span>
                      <span className="font-mono tabular-nums text-slate-400">
                        {group.items.length} submission{group.items.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <h2 className="text-xl font-display font-bold text-white">
                      {group.tournamentName}
                    </h2>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs font-mono tabular-nums">
                    <span className="text-amber-400">Pending: {pendingCount}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-emerald-400">Approved: {approvedCount}</span>
                    <span aria-hidden="true" className="text-slate-600">·</span>
                    <span className="text-red-400">Rejected: {rejectedCount}</span>
                  </div>
                </div>

                {/* Submissions inside this Tournament */}
                <div className="divide-y divide-[#1E2530]">
                  {group.items.map((sub) => {
                    const st = formatSubmissionStatus(sub.status);
                    const isBusy = busyId === sub.id;
                    const isDownloading = downloadingId === sub.id;

                    return (
                      <article key={sub.id} className="p-5 sm:p-6 space-y-4">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span className={`font-semibold ${st.colorClass}`}>{st.label}</span>
                              <span aria-hidden="true">·</span>
                              <span className="text-slate-200 font-medium">
                                @{sub.playerUsername}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono text-slate-300">
                                IGN: {sub.minecraftUsername}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono tabular-nums">
                                {formatTimestamp(sub.createdAt)}
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-white">{sub.title}</h3>
                          </div>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setDeleteTarget(sub)}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-red-300 bg-red-950/35 hover:bg-red-950/70 border border-red-500/30 rounded-lg self-start whitespace-nowrap shrink-0 disabled:opacity-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Delete
                          </button>
                        </div>

                        <p className="text-sm text-slate-300 whitespace-pre-line leading-relaxed">
                          {sub.description}
                        </p>

                        {/* Attached Project File & External Link */}
                        <div className="flex flex-wrap items-center gap-3 pt-1">
                          {sub.projectFileChunkCount > 0 && (
                            <button
                              type="button"
                              disabled={isDownloading}
                              onClick={() => handleDownload(sub)}
                              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#181E27] hover:bg-[#222B38] border border-[#2C374A] rounded-lg transition-colors disabled:opacity-50"
                            >
                              <Download className="w-4 h-4 text-emerald-400" />
                              {isDownloading
                                ? 'Preparing Download...'
                                : `Download ${sub.projectFileName} (${formatBytes(
                                    sub.projectFileSize
                                  )})`}
                            </button>
                          )}

                          {sub.externalFileUrl && (
                            <a
                              href={sub.externalFileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-lg transition-colors"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              External Project Link
                            </a>
                          )}
                        </div>

                        {/* Review Controls */}
                        <div className="pt-4 border-t border-[#1A212C] flex flex-col lg:flex-row lg:items-center gap-3">
                          <input
                            type="text"
                            maxLength={UMC_LIMITS.PROJECT_ADMIN_NOTE_MAX}
                            value={getNoteValue(sub)}
                            onChange={(e) =>
                              setAdminNotes((prev) => ({ ...prev, [sub.id]: e.target.value }))
                            }
                            placeholder="Optional admin feedback or rejection reason for the player..."
                            className="flex-1 px-3.5 py-2 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
                          />

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleReviewStatus(sub, 'APPROVED')}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Approve
                            </button>
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleReviewStatus(sub, 'REJECTED')}
                              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-red-200 bg-red-600/80 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              Reject
                            </button>
                            {sub.status !== 'PENDING' && (
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleReviewStatus(sub, 'PENDING')}
                                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 rounded-lg transition-colors disabled:opacity-50"
                              >
                                <Clock className="w-3.5 h-3.5" />
                                Set Pending
                              </button>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Project Submission"
        description={`Permanently delete project "${deleteTarget?.title || ''}" submitted by @${
          deleteTarget?.playerUsername || ''
        }? This removes the project submission and any uploaded file chunks.`}
        confirmLabel="Delete Project"
        danger
        loading={busyId === deleteTarget?.id}
        onConfirm={handleDeleteSubmission}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
