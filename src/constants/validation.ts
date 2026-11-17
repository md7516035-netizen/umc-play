import type { SiteConfig, SiteRules } from '../types/umc';

export const UMC_LIMITS = {
  FULL_NAME_MIN: 2,
  FULL_NAME_MAX: 80,
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,
  EMAIL_MIN: 5,
  EMAIL_MAX: 120,
  REGION_MIN: 2,
  REGION_MAX: 60,
  MC_USERNAME_MIN: 3,
  MC_USERNAME_MAX: 32,
  AGE_MIN: 13,
  AGE_MAX: 99,
  CONTACT_MIN: 3,
  CONTACT_MAX: 120,
  STATUS_REASON_MAX: 300,
  CONFIG_MSG_MAX: 500,
  RULES_SECTION_MAX: 5000,
  ANNOUNCEMENT_TITLE_MIN: 3,
  ANNOUNCEMENT_TITLE_MAX: 140,
  ANNOUNCEMENT_CONTENT_MIN: 5,
  ANNOUNCEMENT_CONTENT_MAX: 4000,
  TOURNAMENT_NAME_MIN: 3,
  TOURNAMENT_NAME_MAX: 120,
  TOURNAMENT_DESC_MIN: 10,
  TOURNAMENT_DESC_MAX: 3000,
  TOURNAMENT_RULES_MAX: 4000,
  IMAGE_DATA_URL_MAX_CHARS: 220000,
  PROJECT_TITLE_MIN: 3,
  PROJECT_TITLE_MAX: 120,
  PROJECT_DESC_MIN: 10,
  PROJECT_DESC_MAX: 4000,
  PROJECT_MAX_FILE_BYTES: 3145728,
  PROJECT_ADMIN_NOTE_MAX: 500,
  CONTACT_SUBJECT_MIN: 3,
  CONTACT_SUBJECT_MAX: 140,
  CONTACT_MESSAGE_MIN: 10,
  CONTACT_MESSAGE_MAX: 3000,
} as const;

export const UMC_PATTERNS = {
  USERNAME: /^[a-zA-Z0-9_]{3,30}$/,
  MC_USERNAME: /^[a-zA-Z0-9_ ]{3,32}$/,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  SAFE_ID: /^[a-zA-Z0-9_\-]+$/,
} as const;

export function normalizeMcKey(mcUsername: string): string {
  return mcUsername.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_\-]/g, '_');
}

export const DEFAULT_SITE_CONFIG: SiteConfig = {
  registrationOpen: true,
  registrationClosedMessage: 'Player Registration is Currently Closed.',
  maintenanceEnabled: false,
  maintenanceMessage:
    'UMC tournament systems and player portals are temporarily offline for scheduled maintenance.',
  maintenanceAnnouncement:
    'Normal tournament services will resume shortly. Administrators can access the management portal directly.',
  updatedBy: 'system',
  updatedAt: null,
};

export const DEFAULT_SITE_RULES: SiteRules = {
  playerRules:
    '1. Every participant must register using authentic personal details and an active Minecraft username.\n2. Only one account per player is permitted across the UMC platform.\n3. Players must maintain respectful conduct in all lobbies, broadcasts, and community channels.\n4. Account sharing, impersonation, or submitting false location or age details is strictly prohibited.',
  tournamentRules:
    '1. Match schedules and server connection details are published prior to each round.\n2. Players and teams must check in at least 15 minutes before their scheduled match time.\n3. Tournament administrators hold final authority over bracket seeding, tiebreakers, and match restarts.\n4. All match scores and winner declarations become official once recorded by UMC administrators.',
  participationRequirements:
    '1. Players must hold an APPROVED registration status and an ACTIVE account status.\n2. Minimum age requirement is 13 years old at the time of registration.\n3. Participants must use a valid Minecraft Java Edition or Bedrock Edition client matching the tournament specification.\n4. Players must verify their email address and keep contact information current.',
  disqualificationRules:
    '1. Use of hacked clients, auto-clickers, X-ray texture packs, macro scripts, or unauthorized gameplay modifications results in immediate disqualification.\n2. Match-fixing, intentional disconnecting, or colluding with opposing teams leads to permanent suspension.\n3. Failing to appear within 10 minutes of scheduled match start forfeits the match.\n4. Harassment, hate speech, or abusive behavior toward players or administrators results in account suspension.',
  fairPlayPolicy:
    '1. UMC upholds competitive integrity across both Java and Bedrock competitions.\n2. Only unmodified clients or administrator-approved performance mods (such as FPS optimization packs without gameplay advantages) are allowed.\n3. Players must cooperate with administrator verification requests, including screen or client checks when requested.\n4. Suspected rule violations should be reported immediately through the official Contact Us form.',
  updatedBy: 'system',
  updatedAt: null,
};

export const HERO_ARENA_IMAGE = '/src/assets/images/umc_hero_arena_1794818081180.jpg';
export const TOURNAMENT_BANNER_IMAGE = '/src/assets/images/umc_tournament_banner_1794818080617.jpg';
export const ABOUT_CREST_IMAGE = '/src/assets/images/umc_about_crest_1794818080803.jpg';
