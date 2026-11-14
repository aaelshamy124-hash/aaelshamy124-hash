# Security Specification — Galina Export Advisor AI

## 1. Data Invariants
1. **Identity & Email Verification**: All user-scoped reads and writes require an authenticated user (`request.auth != null`) with a verified email (`request.auth.token.email_verified == true`).
2. **Zero Self-Assigned Privilege**: New `/users/{userId}` documents must initialize with `role == 'USER'` and `uid == request.auth.uid`; users cannot promote themselves to `'ADMIN'` or modify `/admins/{uid}`.
3. **PII Isolation (Split Collection)**: User PII (`email`) and exporter domain config live exclusively under `/users/{userId}/private/{docId}`, guarded by Master Gate `get(/databases/.../users/$(userId)).data.uid == request.auth.uid` and strict owner-only access.
4. **Owner-Scoped Leads & CRM Buyers**: `/leads/{leadId}` and `/crmBuyers/{buyerId}` contain corporate emails, phones, and addresses. Single-document `get`, `update`, and `delete` require `existing().ownerUid == request.auth.uid || isAdmin()`. `allow list` strictly evaluates `resource.data.ownerUid == request.auth.uid`.
5. **Path Variable & Payload Hardening**: Every document ID path variable must satisfy `isValidId(id)` (`^[a-zA-Z0-9_\\-]+$`, `<= 128` chars). Every string and array validates `.size()`, type, and required/allowed keys (`hasAll` + `hasOnly`).
6. **Temporal Integrity & Immutability**: `createdAt` and `updatedAt` must equal `request.time` on `create`. On `update`, `ownerUid`, `leadId`/`buyerId`, and `createdAt` are immutable and `updatedAt == request.time`.
7. **Action-Based Updates & Terminal State Locking**: Updates validate full schema first (`isValid[Entity](incoming())`), branch cleanly via `affectedKeys().hasOnly(...)`, and enforce terminal state locks (`ARCHIVED` leads and `Won`/`Lost` deal status transitions locked unless `isAdmin()`).

## 2. The "Dirty Dozen" Adversarial Payloads (Must All Return PERMISSION_DENIED)
1. **Unverified Admin Email Spoof**: Signed in with `email == 'aaelshamy124@gmail.com'` and `email_verified == false`, attempting to `get` another user's `/leads/{leadId}`.
2. **Self-Assigned Admin Role**: `CREATE /users/u1` with `{ uid: 'u1', displayName: 'Attacker', role: 'ADMIN', createdAt: serverTimestamp, updatedAt: serverTimestamp }`.
3. **Privilege Escalation Update**: `UPDATE /users/u1` changing `role` from `'USER'` to `'ADMIN'`.
4. **Shadow / Ghost Field Injection**: `CREATE /leads/u1_LEAD-1` including all valid fields plus an undeclared `shadowVerified: true`.
5. **Identity Spoofing on Lead Creation**: `CREATE /leads/u1_LEAD-2` signed in as `u1` with `ownerUid: 'victim_uid'`.
6. **Cross-Tenant PII Read**: Signed in as `u2`, attempting `GET /users/u1/private/profile`.
7. **Unscoped List Scraping**: Signed in as `u2`, attempting `LIST /leads` without `where('ownerUid', '==', 'u2')`.
8. **ID Poisoning Attack**: `CREATE /leads/bad$id..with.150chars...` violating `^[a-zA-Z0-9_\\-]+$` or `<= 128`.
9. **Resource Exhaustion / Value Poisoning**: `UPDATE /crmBuyers/u1_b1` setting `notes` to a 5,000-char string (exceeding `maxLength: 2000`) or `sourceUrls: [12345]`.
10. **Forged Timestamp Injection**: `CREATE /crmBuyers/u1_b2` passing a backdated client `Date` for `createdAt` instead of `request.time`.
11. **Terminal State Bypass**: Non-admin user attempting `UPDATE /crmBuyers/u1_won` to change `status` from `'Won'` back to `'Negotiation'`.
12. **Orphaned Subcollection Write**: Attempting `CREATE /users/u_missing/products/p1` when parent `/users/u_missing` does not exist.
