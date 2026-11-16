import type { Timestamp } from 'firebase/firestore';
import type {
  AccountStatus,
  AnnouncementCategory,
  MatchStatus,
  ProjectSubmissionStatus,
  RegistrationStatus,
  Tournament,
  TournamentStatus,
} from '../types/umc';

export function formatTimestamp(ts?: Timestamp | null): string {
  if (!ts || typeof ts.toDate !== 'function') return '—';
  const date = ts.toDate();
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatRegistrationStatus(status: RegistrationStatus): {
  label: string;
  colorClass: string;
} {
  switch (status) {
    case 'APPROVED':
      return { label: 'Approved', colorClass: 'text-emerald-400' };
    case 'REJECTED':
      return { label: 'Rejected', colorClass: 'text-red-400' };
    case 'PENDING_APPROVAL':
    default:
      return { label: 'Pending Approval', colorClass: 'text-amber-400' };
  }
}

export function formatAccountStatus(status: AccountStatus): {
  label: string;
  colorClass: string;
} {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Active', colorClass: 'text-emerald-400' };
    case 'SUSPENDED':
    default:
      return { label: 'Suspended', colorClass: 'text-red-400' };
  }
}

export function formatTournamentStatus(status: TournamentStatus): {
  label: string;
  colorClass: string;
} {
  switch (status) {
    case 'REGISTRATION_OPEN':
      return { label: 'Registration Open', colorClass: 'text-emerald-400' };
    case 'ONGOING':
      return { label: 'Ongoing', colorClass: 'text-sky-400' };
    case 'COMPLETED':
      return { label: 'Completed', colorClass: 'text-slate-300' };
    case 'CANCELLED':
      return { label: 'Cancelled', colorClass: 'text-red-400' };
    case 'UPCOMING':
    default:
      return { label: 'Upcoming', colorClass: 'text-amber-400' };
  }
}

export function formatMatchStatus(status: MatchStatus): {
  label: string;
  colorClass: string;
} {
  switch (status) {
    case 'LIVE':
      return { label: 'Live', colorClass: 'text-emerald-400' };
    case 'COMPLETED':
      return { label: 'Completed', colorClass: 'text-slate-300' };
    case 'SCHEDULED':
    default:
      return { label: 'Scheduled', colorClass: 'text-amber-400' };
  }
}

export function formatSubmissionStatus(status: ProjectSubmissionStatus): {
  label: string;
  colorClass: string;
} {
  switch (status) {
    case 'APPROVED':
      return { label: 'Approved', colorClass: 'text-emerald-400' };
    case 'REJECTED':
      return { label: 'Rejected', colorClass: 'text-red-400' };
    case 'PENDING':
    default:
      return { label: 'Pending', colorClass: 'text-amber-400' };
  }
}

export function formatAnnouncementCategory(cat: AnnouncementCategory): string {
  switch (cat) {
    case 'TOURNAMENT':
      return 'Tournament';
    case 'RULE_UPDATE':
      return 'Rule Update';
    case 'MAINTENANCE':
      return 'Maintenance';
    case 'URGENT':
      return 'Important Notice';
    case 'GENERAL':
    default:
      return 'General';
  }
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function isTournamentPublished(t: Pick<Tournament, 'isPublished'>): boolean {
  return t.isPublished !== false;
}

export function parseDeadlineInputToDate(value?: string | null): Date | null {
  if (!value || !value.trim()) return null;
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split('-').map(Number);
    return new Date(y, m - 1, d, 23, 59, 59, 999);
  }
  const parsed = new Date(v);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getTournamentDeadlineDate(t: Tournament): Date | null {
  if (t.projectDeadlineAt && typeof t.projectDeadlineAt.toDate === 'function') {
    return t.projectDeadlineAt.toDate();
  }
  const fromProjectStr = parseDeadlineInputToDate(t.projectDeadline);
  if (fromProjectStr) return fromProjectStr;
  return parseDeadlineInputToDate(t.registrationDeadline);
}

export function formatDeadlineDisplay(t: Tournament): string {
  if (t.projectDeadline && t.projectDeadline.trim()) {
    return t.projectDeadline.replace('T', ' ');
  }
  if (t.projectDeadlineAt && typeof t.projectDeadlineAt.toDate === 'function') {
    return t.projectDeadlineAt.toDate().toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return t.registrationDeadline || '—';
}

export function isTournamentSubmissionOpen(
  t: Tournament,
  nowMs: number = Date.now()
): {
  open: boolean;
  reason?: string;
  deadlineText: string;
} {
  const deadlineText = formatDeadlineDisplay(t);
  if (!isTournamentPublished(t)) {
    return {
      open: false,
      reason: 'This tournament is currently saved as a draft (unpublished).',
      deadlineText,
    };
  }
  if (t.status === 'CANCELLED') {
    return {
      open: false,
      reason: 'This tournament has been cancelled.',
      deadlineText,
    };
  }
  if (t.status === 'COMPLETED') {
    return {
      open: false,
      reason: 'This tournament is completed and no longer accepts submissions.',
      deadlineText,
    };
  }
  const deadlineDate = getTournamentDeadlineDate(t);
  if (deadlineDate && nowMs > deadlineDate.getTime()) {
    return {
      open: false,
      reason: `Submission deadline passed (${deadlineText}).`,
      deadlineText,
    };
  }
  return { open: true, deadlineText };
}
