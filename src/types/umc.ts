import type { Timestamp } from 'firebase/firestore';

export type MinecraftEdition = 'JAVA' | 'BEDROCK' | 'BOTH';
export type TournamentEdition = 'JAVA' | 'BEDROCK' | 'CROSSPLAY';
export type RegistrationStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED';
export type TournamentStatus =
  | 'UPCOMING'
  | 'REGISTRATION_OPEN'
  | 'ONGOING'
  | 'COMPLETED'
  | 'CANCELLED';
export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'COMPLETED';
export type AnnouncementCategory =
  | 'GENERAL'
  | 'TOURNAMENT'
  | 'RULE_UPDATE'
  | 'MAINTENANCE'
  | 'URGENT';

export interface AdminUser {
  uid: string;
  email: string;
  displayName: string;
  username?: string;
  addedBy: string;
  createdAt: Timestamp | null;
  updatedAt?: Timestamp | null;
}

export interface PlayerProfile {
  uid: string;
  fullName: string;
  username: string;
  usernameLower: string;
  email: string;
  country: string;
  state: string;
  district: string;
  minecraftUsername: string;
  minecraftUsernameLower: string;
  minecraftEdition: MinecraftEdition;
  age: number;
  contactDetails: string;
  role: 'PLAYER';
  registrationStatus: RegistrationStatus;
  accountStatus: AccountStatus;
  statusReason: string;
  reviewedBy: string;
  reviewedAt?: Timestamp | null;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface SiteConfig {
  registrationOpen: boolean;
  registrationClosedMessage: string;
  maintenanceEnabled: boolean;
  maintenanceMessage: string;
  maintenanceAnnouncement: string;
  updatedBy: string;
  updatedAt?: Timestamp | null;
}

export interface SiteRules {
  playerRules: string;
  tournamentRules: string;
  participationRequirements: string;
  disqualificationRules: string;
  fairPlayPolicy: string;
  updatedBy: string;
  updatedAt?: Timestamp | null;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: AnnouncementCategory;
  isImportant: boolean;
  publishedDate: string;
  authorId: string;
  authorName: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface Tournament {
  id: string;
  name: string;
  description: string;
  tournamentDate: string;
  registrationDeadline: string;
  status: TournamentStatus;
  edition: TournamentEdition;
  format: string;
  maxParticipants: number;
  winnerName: string;
  winnerAnnouncement: string;
  createdBy: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface TournamentParticipant {
  playerUid: string;
  tournamentId: string;
  username: string;
  minecraftUsername: string;
  minecraftEdition: MinecraftEdition;
  teamId: string;
  teamName: string;
  joinedAt: Timestamp | null;
}

export interface TournamentTeam {
  id: string;
  tournamentId: string;
  name: string;
  tag: string;
  captainUid: string;
  memberNames: string[];
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface TournamentMatch {
  id: string;
  tournamentId: string;
  round: string;
  participantA: string;
  participantB: string;
  scheduledTime: string;
  scoreA: number;
  scoreB: number;
  winner: string;
  status: MatchStatus;
  notes: string;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

export interface ContactMessage {
  id: string;
  name: string;
  email: string;
  minecraftUsername: string;
  subject: string;
  message: string;
  status: 'NEW' | 'RESOLVED';
  createdAt: Timestamp | null;
}
