import type { Timestamp } from 'firebase/firestore';
import type {
  AccountStatus,
  AnnouncementCategory,
  MatchStatus,
  RegistrationStatus,
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
