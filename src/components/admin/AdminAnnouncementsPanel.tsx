import React, { useState } from 'react';
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { Edit3, Plus, Trash2 } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../../lib/firebase';
import { ConfirmModal } from '../ConfirmModal';
import { formatAnnouncementCategory } from '../../utils/formatters';
import type { Announcement, AnnouncementCategory } from '../../types/umc';

interface AdminAnnouncementsPanelProps {
  announcements: Announcement[];
  adminUid: string;
  adminName: string;
  onFeedback: (type: 'success' | 'error', text: string) => void;
}

export function AdminAnnouncementsPanel({
  announcements,
  adminUid,
  adminName,
  onFeedback,
}: AdminAnnouncementsPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<AnnouncementCategory>('GENERAL');
  const [publishedDate, setPublishedDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [isImportant, setIsImportant] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setCategory('GENERAL');
    setPublishedDate(new Date().toISOString().slice(0, 10));
    setIsImportant(false);
  };

  const startEdit = (a: Announcement) => {
    setEditingId(a.id);
    setTitle(a.title);
    setContent(a.content);
    setCategory(a.category);
    setPublishedDate(a.publishedDate);
    setIsImportant(a.isImportant);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim().length < 3 || content.trim().length < 5) {
      onFeedback('error', 'Title (min 3 chars) and content (min 5 chars) are required.');
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        const ref = doc(db, 'announcements', editingId);
        try {
          await updateDoc(ref, {
            title: title.trim(),
            content: content.trim(),
            category,
            isImportant,
            publishedDate,
            authorName: adminName,
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `announcements/${editingId}`);
        }
        onFeedback('success', 'Announcement updated.');
      } else {
        const id = `ann_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const ref = doc(db, 'announcements', id);
        try {
          await setDoc(ref, {
            title: title.trim(),
            content: content.trim(),
            category,
            isImportant,
            publishedDate,
            authorId: adminUid,
            authorName: adminName,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.CREATE, `announcements/${id}`);
        }
        onFeedback('success', 'Announcement published.');
      }
      resetForm();
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to save announcement.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      try {
        await deleteDoc(doc(db, 'announcements', deleteTarget.id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `announcements/${deleteTarget.id}`);
      }
      onFeedback('success', 'Announcement deleted.');
      setDeleteTarget(null);
      if (editingId === deleteTarget.id) resetForm();
    } catch (err) {
      onFeedback('error', err instanceof Error ? err.message : 'Failed to delete announcement.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Publish / Edit Form */}
      <form
        onSubmit={handleSubmit}
        className="lg:col-span-5 p-6 rounded-xl bg-[#11151B] border border-[#232B38] space-y-4 h-fit"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">
            {editingId ? 'Edit Announcement' : 'Publish Announcement'}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-400 hover:text-white underline"
            >
              Cancel Edit
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <label htmlFor="ann-title" className="block text-sm font-medium text-slate-200">
            Title *
          </label>
          <input
            id="ann-title"
            type="text"
            required
            maxLength={140}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Season 1 Qualifiers Open"
            className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="ann-cat" className="block text-sm font-medium text-slate-200">
              Category
            </label>
            <select
              id="ann-cat"
              value={category}
              onChange={(e) => setCategory(e.target.value as AnnouncementCategory)}
              className="w-full px-3 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
            >
              <option value="GENERAL">General</option>
              <option value="TOURNAMENT">Tournament</option>
              <option value="RULE_UPDATE">Rule Update</option>
              <option value="MAINTENANCE">Maintenance</option>
              <option value="URGENT">Important Notice</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label htmlFor="ann-date" className="block text-sm font-medium text-slate-200">
              Announcement Date
            </label>
            <input
              id="ann-date"
              type="date"
              required
              value={publishedDate}
              onChange={(e) => setPublishedDate(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 font-mono focus:border-emerald-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="ann-content" className="block text-sm font-medium text-slate-200">
            Message Content *
          </label>
          <textarea
            id="ann-content"
            rows={5}
            required
            maxLength={4000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write the official announcement..."
            className="w-full px-3.5 py-2.5 text-sm bg-[#0B0E12] border border-[#263040] rounded-lg text-slate-100 focus:border-emerald-500 focus:outline-none"
          />
        </div>

        <label className="flex items-center gap-2.5 text-sm text-slate-200 cursor-pointer">
          <input
            type="checkbox"
            checked={isImportant}
            onChange={(e) => setIsImportant(e.target.checked)}
            className="w-4 h-4 rounded border-[#2A3444] bg-[#0B0E12] text-emerald-500"
          />
          <span>Display as Important Notice on Homepage</span>
        </label>

        <button
          type="submit"
          disabled={saving}
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          {saving ? 'Saving...' : editingId ? 'Update Announcement' : 'Publish Announcement'}
        </button>
      </form>

      {/* Announcements List */}
      <div className="lg:col-span-7 space-y-4">
        {announcements.length === 0 ? (
          <div className="p-8 rounded-xl bg-[#11151B] border border-[#232B38] text-sm text-slate-400 text-center">
            No announcements published yet.
          </div>
        ) : (
          announcements.map((a) => (
            <div
              key={a.id}
              className="p-5 rounded-xl bg-[#11151B] border border-[#232B38] space-y-2.5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                    {a.isImportant && (
                      <>
                        <span className="font-semibold text-emerald-400">Homepage Notice</span>
                        <span aria-hidden="true">·</span>
                      </>
                    )}
                    <span>{formatAnnouncementCategory(a.category)}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">{a.publishedDate}</span>
                  </div>
                  <h3 className="text-lg font-bold text-white">{a.title}</h3>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => startEdit(a)}
                    title="Edit Announcement"
                    className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-[#1D2430]"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(a)}
                    title="Delete Announcement"
                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/15"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm text-slate-300 whitespace-pre-line">{a.content}</p>
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete Announcement"
        description={`Delete "${deleteTarget?.title || ''}"? This cannot be undone.`}
        confirmLabel="Delete"
        danger
        loading={saving}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  );
}
