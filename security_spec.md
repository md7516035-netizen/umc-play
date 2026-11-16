# UMC Security Specification & Red-Team Payloads

## 1. Data Invariants
1. **Strict Two-Role Model**: Only `PLAYER` and `ADMINISTRATOR` roles exist. Coordinator roles are completely disallowed by schema and security rules.
2. **Player Registration Integrity**: A newly registered player document (`players/{uid}`) must match `request.auth.uid`, enforce `role == 'PLAYER'`, `registrationStatus == 'PENDING_APPROVAL'`, and `accountStatus == 'ACTIVE'`, and use `request.time` for `createdAt`/`updatedAt`.
3. **No Self-Approval / No Privilege Escalation**: Players can only update non-status profile fields (`fullName`, `country`, `state`, `district`, `minecraftEdition`, `age`, `contactDetails`, `updatedAt`). They cannot alter `role`, `registrationStatus`, `accountStatus`, `uid`, `email`, or `reviewedBy`.
4. **PII Isolation**: `players/{uid}` and `contactMessages/{messageId}` contain PII (`email`, `contactDetails`, `district`). Public/non-admin `list` queries on `players` and `contactMessages` are strictly denied.
5. **Uniqueness Enforcement**: `usernames/{usernameLower}` and `mcUsernames/{mcUsernameLower}` disallow `list` queries and reject updates or overwrites (`allow update: if false`).
6. **Backend-Enforced Tournament Gate**: Only players with `registrationStatus == 'APPROVED'` and `accountStatus == 'ACTIVE'` in `players/{uid}` can create a participant entry in `tournaments/{id}/participants/{uid}`, and only when the parent tournament has `status == 'REGISTRATION_OPEN'` and `siteConfig/global.registrationOpen == true`.
7. **Admin Bootstrapping & Spoofing Guard**: Admin access via email requires `request.auth.token.email_verified == true` or explicit membership in `admins/{uid}`. Public creation of `admins/{uid}` is strictly denied.
8. **Shadow Field Rejection**: Every entity validation helper enforces both `keys().hasAll(...)` and `keys().hasOnly(...)` plus strict type and string length bounds.
9. **Tournament-Bound Project Submissions**: Every `projectSubmissions/{submissionId}` must reference an existing, published (`isPublished != false`), active (not `CANCELLED` or `COMPLETED`) tournament, submitted strictly on or before `projectDeadlineAt` (`request.time <= projectDeadlineAt`). Only `APPROVED` & `ACTIVE` players can submit, and every submission starts with `status == 'PENDING'`.
10. **Project Privacy Gate**: Only `APPROVED` submissions are publicly readable; `PENDING` and `REJECTED` submissions and their file chunks are readable only by the owning player (`playerUid == request.auth.uid`) or an `isAdmin()`.

## 2. "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Self-Approval on Registration**: `players/{uid}` create with `registrationStatus: "APPROVED"`.
2. **Privilege Escalation on Registration**: `players/{uid}` create with `role: "ADMIN"` or `role: "COORDINATOR"`.
3. **Self-Approval on Update**: `players/{uid}` update by owner changing `registrationStatus` from `"PENDING_APPROVAL"` to `"APPROVED"`.
4. **Self-Reactivation from Suspension**: `players/{uid}` update by owner changing `accountStatus` from `"SUSPENDED"` to `"ACTIVE"`.
5. **Shadow Field Injection**: `players/{uid}` or `projectSubmissions/{sid}` create/update with extra ghost key `{ isVerified: true }`.
6. **Unapproved Player Tournament Join / Project Submit**: `tournaments/{tid}/participants/{uid}` or `projectSubmissions/{sid}` create when `players/{uid}.registrationStatus == "PENDING_APPROVAL"`.
7. **Suspended Player Tournament Join / Project Submit**: `tournaments/{tid}/participants/{uid}` or `projectSubmissions/{sid}` create when `players/{uid}.accountStatus == "SUSPENDED"`.
8. **Draft / Deleted / Past-Deadline Tournament Submission**: `projectSubmissions/{sid}` create when parent tournament has `isPublished: false`, does not exist, or `request.time > projectDeadlineAt`.
9. **Project Self-Approval**: `projectSubmissions/{sid}` create with `status: "APPROVED"`, or owner update changing `status` to `"APPROVED"`.
10. **Pending Project Scraping**: `projectSubmissions` `list` or `get` for `PENDING`/`REJECTED` submission by non-owner non-admin user.
11. **Contact Inbox & PII Scraping**: `players` or `contactMessages` `list` or `get` by non-admin user.
12. **Resource Poisoning / Timestamp Spoofing**: `announcements`, `players`, or `projectSubmissions` write with oversized strings or client-backdated `createdAt`.

