import { useState } from 'react';
import { doc, serverTimestamp, updateDoc, writeBatch } from 'firebase/firestore';
import { Eye, Search, ShieldAlert, Trash2, UserCheck, UserX, X } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { ConfirmModal } from '../ConfirmModal';
import {
  formatAccountStatus,
  formatRegistrationStatus,
  formatTimestamp,
} from '../../utils/formatters';
import type { MinecraftEdition, PlayerProfile, RegistrationStatus, AccountStatus } from '../../types/umc';

interface AdminPlayersPanelProps {
  players: PlayerProfile[];
  adminUid: string;
  onFeedback: (type: 'success' | 'error', text: string) => void;
}

export function AdminPlayersPanel({ players, adminUid, onFeedback }: AdminPlayersPanelProps) {
  const [search, setSearch] = useState('');
  const [regFilter, setRegFilter] = useState<'ALL' | RegistrationStatus>('ALL');
  const [accFilter, setAccFilter] = useState<'ALL' | AccountStatus>('ALL');
  const [editionFilter, setEditionFilter] = useState<'ALL' | MinecraftEdition>('ALL');

  const [selectedPlayer, setSelectedPlayer] = useState<PlayerProfile | null>(null);
  const [reasonModal, setReasonModal] = useState<{
    player: PlayerProfile;
    action: 'REJECT' | 'SUSPEND';
  } | null>(null);
  const [reasonText, setReasonText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<PlayerProfile | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const filtered = players.filter((p) => {
    const matchReg = regFilter === 'ALL' || p.registrationStatus === regFilter;
    const matchAcc = accFilter === 'ALL' || p.accountStatus === accFilter;
    const matchEd = editionFilter === 'ALL' || p.minecraftEdition === editionFilter;
    const q = search.trim().toLowerCase();
    const matchQ =
      !q ||
      p.fullName.toLowerCase().includes(q) ||
      p.username.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      p.minecraftUsername.toLowerCase().includes(q) ||
      p.country.toLowerCase().includes(q) ||
      p.state.toLowerCase().includes(q) ||
      p.district.toLowerCase().includes(q);
    return matchReg && matchAcc && matchEd && matchQ;
  });

  const handleApprove = async (player: PlayerProfile) => {
    setBusyId(player.uid);
    try {
      const ref = doc(db, 'players', player.uid);
      try {
        await updateDoc(ref, {
          registrationStatus: 'APPROVED',
          statusReason: '',
          reviewedBy: adminUid,
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `players/${player.uid}`);
      }
      onFeedback('success', `Player ${player.username} approved.`);
      if (selectedPlayer?.uid === player.uid) {
        setSelectedPlayer({ ...player, registrationStatus: 'APPROVED', statusReason: '' });
      }
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to approve player.');
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmReasonAction = async () => {
    if (!reasonModal) return;
    const { player, action } = reasonModal;
    setBusyId(player.uid);
    try {
      const ref = doc(db, 'players', player.uid);
      const updates =
        action === 'REJECT'
          ? {
              registrationStatus: 'REJECTED' as const,
              statusReason: reasonText.trim().slice(0, 300),
              reviewedBy: adminUid,
              reviewedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }
          : {
              accountStatus: 'SUSPENDED' as const,
              statusReason: reasonText.trim().slice(0, 300),
              reviewedBy: adminUid,
              reviewedAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            };
      try {
        await updateDoc(ref, updates);
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `players/${player.uid}`);
      }
      onFeedback(
        'success',
        action === 'REJECT'
          ? `Player ${player.username} rejected.`
          : `Player ${player.username} suspended.`
      );
      setReasonModal(null);
      setReasonText('');
      setSelectedPlayer(null);
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setBusyId(null);
    }
  };

  const handleReactivate = async (player: PlayerProfile) => {
    setBusyId(player.uid);
    try {
      const ref = doc(db, 'players', player.uid);
      try {
        await updateDoc(ref, {
          accountStatus: 'ACTIVE',
          statusReason: '',
          reviewedBy: adminUid,
          reviewedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `players/${player.uid}`);
      }
      onFeedback('success', `Player ${player.username} reactivated.`);
      if (selectedPlayer?.uid === player.uid) {
        setSelectedPlayer({ ...player, accountStatus: 'ACTIVE', statusReason: '' });
      }
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to reactivate player.');
    } finally {
      setBusyId(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deleteTarget) return;
    setBusyId(deleteTarget.uid);
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'players', deleteTarget.uid));
      batch.delete(doc(db, 'usernames', deleteTarget.usernameLower));
      batch.delete(doc(db, 'mcUsernames', deleteTarget.minecraftUsernameLower));
      try {
        await batch.commit();
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `players/${deleteTarget.uid}`);
      }
      onFeedback('success', `Player record for ${deleteTarget.username} permanently deleted.`);
      setDeleteTarget(null);
      if (selectedPlayer?.uid === deleteTarget.uid) setSelectedPlayer(null);
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to delete player.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search & Filters */}
      <div className="p-5 rounded-xl bg-[#11151B] border border-[#232B38] space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, username, email, IGN, or region..."
              className="w-full pl-10 pr-4 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>

          <select
            value={regFilter}
            onChange={(e) => setRegFilter(e.target.value as 'ALL' | RegistrationStatus)}
            aria-label="Filter by registration status"
            className="px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
          >
            <option value="ALL">All Registration States</option>
            <option value="PENDING_APPROVAL">Pending Approval</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <div className="grid grid-cols-2 gap-2">
            <select
              value={accFilter}
              onChange={(e) => setAccFilter(e.target.value as 'ALL' | AccountStatus)}
              aria-label="Filter by account status"
              className="px-3 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">All Accounts</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
            </select>
            <select
              value={editionFilter}
              onChange={(e) => setEditionFilter(e.target.value as 'ALL' | MinecraftEdition)}
              aria-label="Filter by Minecraft edition"
              className="px-3 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              <option value="ALL">All Editions</option>
              <option value="JAVA">Java</option>
              <option value="BEDROCK">Bedrock</option>
              <option value="BOTH">Both</option>
            </select>
          </div>
        </div>

        <div className="text-xs text-slate-400 font-mono tabular-nums">
          Showing {filtered.length} of {players.length} registered players
        </div>
      </div>

      {/* Players Table */}
      <div className="rounded-xl bg-[#11151B] border border-[#232B38] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            No registered players match the current search or filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-[#1E2530] bg-[#0D1117] text-xs text-slate-400">
                  <th className="py-3.5 px-4">Player</th>
                  <th className="py-3.5 px-4">Minecraft IGN</th>
                  <th className="py-3.5 px-4">Region</th>
                  <th className="py-3.5 px-4">Registered</th>
                  <th className="py-3.5 px-4">Approval</th>
                  <th className="py-3.5 px-4">Account</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A202B]">
                {filtered.map((p) => {
                  const regSt = formatRegistrationStatus(p.registrationStatus);
                  const accSt = formatAccountStatus(p.accountStatus);
                  const isBusy = busyId === p.uid;
                  return (
                    <tr key={p.uid} className="hover:bg-[#151A22] transition-colors">
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-white">{p.fullName}</div>
                        <div className="text-xs text-slate-400">
                          @{p.username} · {p.email}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-mono text-slate-200">{p.minecraftUsername}</div>
                        <div className="text-xs text-slate-400">{p.minecraftEdition}</div>
                      </td>
                      <td className="py-3.5 px-4 text-xs text-slate-300">
                        {p.district}, {p.state}, {p.country}
                      </td>
                      <td className="py-3.5 px-4 font-mono tabular-nums text-xs text-slate-300 whitespace-nowrap">
                        {formatTimestamp(p.createdAt)}
                      </td>
                      <td className={`py-3.5 px-4 text-xs font-semibold whitespace-nowrap ${regSt.colorClass}`}>
                        {regSt.label}
                      </td>
                      <td className={`py-3.5 px-4 text-xs font-semibold whitespace-nowrap ${accSt.colorClass}`}>
                        {accSt.label}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setSelectedPlayer(p)}
                            title="View Player Profile"
                            className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-[#1D2430] transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {p.registrationStatus !== 'APPROVED' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleApprove(p)}
                              title="Approve Player"
                              className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/15 transition-colors disabled:opacity-40"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          )}

                          {p.registrationStatus !== 'REJECTED' && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                setReasonText(p.statusReason || '');
                                setReasonModal({ player: p, action: 'REJECT' });
                              }}
                              title="Reject Player"
                              className="p-2 rounded-lg text-amber-400 hover:bg-amber-500/15 transition-colors disabled:opacity-40"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          )}

                          {p.accountStatus === 'ACTIVE' ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                setReasonText(p.statusReason || '');
                                setReasonModal({ player: p, action: 'SUSPEND' });
                              }}
                              title="Suspend Account"
                              className="p-2 rounded-lg text-orange-400 hover:bg-orange-500/15 transition-colors disabled:opacity-40"
                            >
                              <ShieldAlert className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleReactivate(p)}
                              title="Reactivate Account"
                              className="px-2.5 py-1.5 text-xs font-semibold rounded-lg text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 whitespace-nowrap"
                            >
                              Reactivate
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => setDeleteTarget(p)}
                            title="Delete Player Account"
                            className="p-2 rounded-lg text-red-400 hover:bg-red-500/15 transition-colors disabled:opacity-40"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Player Profile Inspection Modal */}
      {selectedPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-2xl bg-[#11151B] border border-[#232B38] rounded-xl p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 border-b border-[#1E2530] pb-4">
              <div>
                <h3 className="text-2xl font-display font-bold text-white">
                  {selectedPlayer.fullName}
                </h3>
                <p className="text-sm text-slate-400">
                  @{selectedPlayer.username} · {selectedPlayer.email}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPlayer(null)}
                className="text-slate-400 hover:text-white p-1"
                aria-label="Close player profile"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-xs text-slate-500">Minecraft Username</span>
                <p className="font-mono text-white">{selectedPlayer.minecraftUsername}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Minecraft Edition</span>
                <p className="text-white">{selectedPlayer.minecraftEdition}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Age</span>
                <p className="font-mono tabular-nums text-white">{selectedPlayer.age}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Contact Details</span>
                <p className="text-white">{selectedPlayer.contactDetails}</p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Country / State / District</span>
                <p className="text-white">
                  {selectedPlayer.country} / {selectedPlayer.state} / {selectedPlayer.district}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Registration Date</span>
                <p className="font-mono tabular-nums text-white">
                  {formatTimestamp(selectedPlayer.createdAt)}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Registration Status</span>
                <p className={`font-semibold ${formatRegistrationStatus(selectedPlayer.registrationStatus).colorClass}`}>
                  {formatRegistrationStatus(selectedPlayer.registrationStatus).label}
                </p>
              </div>
              <div>
                <span className="text-xs text-slate-500">Account Status</span>
                <p className={`font-semibold ${formatAccountStatus(selectedPlayer.accountStatus).colorClass}`}>
                  {formatAccountStatus(selectedPlayer.accountStatus).label}
                </p>
              </div>
            </div>

            {selectedPlayer.statusReason && (
              <div className="p-3.5 rounded-lg bg-[#0B0E12] border border-[#1E2530] text-sm">
                <span className="text-xs text-slate-500 block">Status Note</span>
                <span className="text-slate-200">{selectedPlayer.statusReason}</span>
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-4 border-t border-[#1E2530]">
              <button
                type="button"
                disabled={busyId === selectedPlayer.uid}
                onClick={() => handleApprove(selectedPlayer)}
                className="px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={busyId === selectedPlayer.uid}
                onClick={() => {
                  setReasonText(selectedPlayer.statusReason || '');
                  setReasonModal({ player: selectedPlayer, action: 'REJECT' });
                }}
                className="px-4 py-2 text-xs font-semibold text-amber-200 bg-amber-600/20 hover:bg-amber-600/30 border border-amber-500/40 rounded-lg"
              >
                Reject
              </button>
              {selectedPlayer.accountStatus === 'ACTIVE' ? (
                <button
                  type="button"
                  disabled={busyId === selectedPlayer.uid}
                  onClick={() => {
                    setReasonText(selectedPlayer.statusReason || '');
                    setReasonModal({ player: selectedPlayer, action: 'SUSPEND' });
                  }}
                  className="px-4 py-2 text-xs font-semibold text-orange-200 bg-orange-600/20 hover:bg-orange-600/30 border border-orange-500/40 rounded-lg"
                >
                  Suspend
                </button>
              ) : (
                <button
                  type="button"
                  disabled={busyId === selectedPlayer.uid}
                  onClick={() => handleReactivate(selectedPlayer)}
                  className="px-4 py-2 text-xs font-semibold text-emerald-200 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 rounded-lg"
                >
                  Reactivate
                </button>
              )}
              <button
                type="button"
                disabled={busyId === selectedPlayer.uid}
                onClick={() => setDeleteTarget(selectedPlayer)}
                className="px-4 py-2 text-xs font-semibold text-red-200 bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 rounded-lg ml-auto"
              >
                Delete Account
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject / Suspend Reason Modal */}
      {reasonModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-[#11151B] border border-[#232B38] rounded-xl p-6 space-y-4">
            <h3 className="text-xl font-bold text-white">
              {reasonModal.action === 'REJECT' ? 'Reject Player' : 'Suspend Player'}:{' '}
              {reasonModal.player.username}
            </h3>
            <p className="text-sm text-slate-400">
              Optionally include a reason that will be visible on the player&apos;s dashboard.
            </p>
            <textarea
              rows={3}
              maxLength={300}
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="Enter reason (optional)..."
              className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReasonModal(null)}
                className="px-4 py-2 text-sm text-slate-300 bg-[#181E27] border border-[#2A3444] rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={busyId === reasonModal.player.uid}
                onClick={handleConfirmReasonAction}
                className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 rounded-lg"
              >
                {reasonModal.action === 'REJECT' ? 'Confirm Reject' : 'Confirm Suspend'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Player Account"
        description={`Are you sure you want to permanently delete the player record for ${
          deleteTarget?.username || ''
        } (${deleteTarget?.minecraftUsername || ''})? This removes their profile and frees their reserved username.`}
        confirmLabel="Delete Permanently"
        danger
        loading={busyId === deleteTarget?.uid}
        onConfirm={handleDeleteAccount}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
