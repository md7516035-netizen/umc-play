import React, { useState } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { CheckCircle2, Mail, Shield, Trash2, UserPlus } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { ConfirmModal } from '../ConfirmModal';
import { formatTimestamp } from '../../utils/formatters';
import type { AdminUser, ContactMessage } from '../../types/umc';

interface AdminInboxAndAccessPanelProps {
  messages: ContactMessage[];
  admins: AdminUser[];
  currentAdminUid: string;
  onFeedback: (type: 'success' | 'error', text: string) => void;
}

export function AdminInboxAndAccessPanel({
  messages,
  admins,
  currentAdminUid,
  onFeedback,
}: AdminInboxAndAccessPanelProps) {
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteAdminTarget, setDeleteAdminTarget] = useState<AdminUser | null>(null);
  const [deleteMsgTarget, setDeleteMsgTarget] = useState<ContactMessage | null>(null);

  const handleResolveMsg = async (msg: ContactMessage) => {
    setBusy(true);
    try {
      const ref = doc(db, 'contactMessages', msg.id);
      try {
        await updateDoc(ref, {
          status: msg.status === 'NEW' ? 'RESOLVED' : 'NEW',
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `contactMessages/${msg.id}`);
      }
      onFeedback('success', 'Inquiry status updated.');
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to update inquiry.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteMsg = async () => {
    if (!deleteMsgTarget) return;
    setBusy(true);
    try {
      try {
        await deleteDoc(doc(db, 'contactMessages', deleteMsgTarget.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `contactMessages/${deleteMsgTarget.id}`);
      }
      onFeedback('success', 'Inquiry deleted.');
      setDeleteMsgTarget(null);
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to delete inquiry.');
    } finally {
      setBusy(false);
    }
  };

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = newAdminUid.trim();
    const email = newAdminEmail.trim().toLowerCase();
    const displayName = newAdminName.trim();
    if (!/^[a-zA-Z0-9_\-]+$/.test(uid)) {
      onFeedback('error', 'Firebase Auth UID must be alphanumeric/underscores/hyphens.');
      return;
    }
    setBusy(true);
    try {
      const ref = doc(db, 'admins', uid);
      try {
        await setDoc(ref, {
          uid,
          email,
          displayName,
          addedBy: currentAdminUid,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, `admins/${uid}`);
      }
      onFeedback('success', `Administrator ${displayName} added.`);
      setNewAdminUid('');
      setNewAdminEmail('');
      setNewAdminName('');
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to add administrator.');
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteAdmin = async () => {
    if (!deleteAdminTarget) return;
    setBusy(true);
    try {
      try {
        await deleteDoc(doc(db, 'admins', deleteAdminTarget.uid));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `admins/${deleteAdminTarget.uid}`);
      }
      onFeedback('success', `Removed admin ${deleteAdminTarget.displayName}.`);
      setDeleteAdminTarget(null);
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to remove administrator.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Contact Inquiries */}
      <div className="lg:col-span-7 space-y-4">
        <div className="flex items-center gap-2 text-lg font-bold text-white">
          <Mail className="w-5 h-5 text-emerald-400" />
          <h2>Contact Us Inquiries ({messages.length})</h2>
        </div>

        {messages.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#11151B] border border-[#232B38] text-sm text-slate-400">
            No contact inquiries received yet.
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className="p-5 rounded-xl bg-[#11151B] border border-[#232B38] space-y-2.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    <span
                      className={`font-semibold ${
                        m.status === 'NEW' ? 'text-amber-400' : 'text-emerald-400'
                      }`}
                    >
                      {m.status === 'NEW' ? 'Open' : 'Resolved'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{m.name}</span>
                    <span aria-hidden="true">·</span>
                    <span>{m.email}</span>
                    {m.minecraftUsername && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono">IGN: {m.minecraftUsername}</span>
                      </>
                    )}
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{formatTimestamp(m.createdAt)}</span>
                  </div>
                  <h3 className="text-base font-bold text-white mt-1">{m.subject}</h3>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => handleResolveMsg(m)}
                    title={m.status === 'NEW' ? 'Mark Resolved' : 'Reopen'}
                    className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/15"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setDeleteMsgTarget(m)}
                    title="Delete Inquiry"
                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/15"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-300 whitespace-pre-line">{m.message}</p>
            </div>
          ))
        )}
      </div>

      {/* Authorized Administrator Registry */}
      <div className="lg:col-span-5 space-y-6">
        <div className="p-6 rounded-xl bg-[#11151B] border border-[#232B38] space-y-4">
          <div className="flex items-center gap-2 text-lg font-bold text-white">
            <Shield className="w-5 h-5 text-emerald-400" />
            <h2>Authorized Administrators</h2>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Only existing administrators can grant or revoke administrator permissions. Public
            administrator signup is permanently disabled.
          </p>

          <div className="space-y-2.5">
            {admins.map((a) => (
              <div
                key={a.uid}
                className="p-3.5 rounded-lg bg-[#0B0E12] border border-[#1E2530] flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white truncate">{a.displayName}</div>
                  <div className="text-xs text-slate-400 truncate">{a.email}</div>
                  <div className="text-[11px] font-mono text-slate-500 truncate">UID: {a.uid}</div>
                </div>
                {a.uid !== currentAdminUid && (
                  <button
                    type="button"
                    onClick={() => setDeleteAdminTarget(a)}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/15 shrink-0"
                    title="Revoke Administrator Access"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>

          <form onSubmit={handleAddAdmin} className="pt-4 border-t border-[#1E2530] space-y-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-emerald-400" />
              Authorize New Administrator
            </h3>
            <input
              type="text"
              required
              value={newAdminUid}
              onChange={(e) => setNewAdminUid(e.target.value)}
              placeholder="Firebase Auth UID"
              className="w-full px-3 py-2 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="email"
              required
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              placeholder="Admin Email"
              className="w-full px-3 py-2 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
            <input
              type="text"
              required
              value={newAdminName}
              onChange={(e) => setNewAdminName(e.target.value)}
              placeholder="Display Name"
              className="w-full px-3 py-2 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
            >
              Add Administrator
            </button>
          </form>
        </div>
      </div>

      <ConfirmModal
        open={!!deleteMsgTarget}
        title="Delete Inquiry"
        description={`Delete inquiry "${deleteMsgTarget?.subject || ''}"?`}
        confirmLabel="Delete"
        danger
        loading={busy}
        onConfirm={handleDeleteMsg}
        onCancel={() => setDeleteMsgTarget(null)}
      />

      <ConfirmModal
        open={!!deleteAdminTarget}
        title="Revoke Administrator Access"
        description={`Remove administrator permissions for ${deleteAdminTarget?.displayName || ''} (${
          deleteAdminTarget?.email || ''
        })?`}
        confirmLabel="Revoke Access"
        danger
        loading={busy}
        onConfirm={handleDeleteAdmin}
        onCancel={() => setDeleteAdminTarget(null)}
      />
    </div>
  );
}
