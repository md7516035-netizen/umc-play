import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="w-full max-w-md bg-[#11151B] border border-[#232B38] rounded-xl p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {danger && (
              <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
            )}
            <h3 id="confirm-modal-title" className="text-xl font-bold text-slate-100">
              {title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="text-slate-400 hover:text-slate-200 p-1 rounded-lg transition-colors"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="mt-3 text-sm text-slate-300 leading-relaxed">{description}</p>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-slate-300 bg-[#181E27] border border-[#2A3444] rounded-lg hover:bg-[#1F2733] transition-colors whitespace-nowrap shrink-0"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 disabled:opacity-50 ${
              danger
                ? 'bg-red-600 hover:bg-red-500 text-white'
                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
            }`}
          >
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
