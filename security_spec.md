# Security Specification & Payload-First Verification — Smart Mess Manager

## 1. Data Invariants
1. **Master Gate & Verified Email**: Every write and private read requires `request.auth != null && request.auth.token.email_verified == true`.
2. **Owner Supremacy**: The bootstrapped owner (`mdraezul96@gmail.com`) holds permanent `admin` privileges and cannot be downgraded or deleted by any Manager.
3. **Zero Privilege Escalation**: Regular users registering themselves in `/users/{uid}` may only set `role: 'member'`; only an Admin can promote a user to `manager` or `admin`.
4. **PII Isolation**: `/users/{uid}` and `/members/{memberId}` contain phone numbers, NIDs, and addresses. Non-managers can only read their own record (`uid == request.auth.uid` or `linkedUid == request.auth.uid`).
5. **Immutable Audit Trail**: `/auditLogs/{logId}` documents are append-only (`allow update, delete: if false`).
6. **No Shadow Fields**: Every collection enforces strict `keys().hasAll(...) && keys().hasOnly(...)` and type + size bounds via `isValid[Entity](incoming())`.
7. **ID Poisoning Guard**: Every single-doc operation validates `isValidId(docId)` (`^[a-zA-Z0-9_-]+$`, max length 128).
8. **Query Cost Protection**: `allow list` rules avoid `get()`/`exists()` loops and enforce role or ownership constraints directly.

## 2. Dirty Dozen Attack Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Read/Write**: Read `/members/m1` with `request.auth == null` -> DENIED.
2. **Unverified Email Write**: Create `/expenses/e1` with `email_verified: false` -> DENIED.
3. **Self-Promotion to Admin**: Member creates `/users/{uid}` with `role: 'admin'` -> DENIED.
4. **Manager Escalation**: Manager updates `/users/{managerUid}` to `role: 'admin'` -> DENIED.
5. **Manager Demoting Owner**: Manager updates Owner's `/users/{ownerUid}` to `role: 'member'` -> DENIED.
6. **Shadow Field Injection**: Admin creates `/expenses/e1` with extra field `isApprovedByFake: true` -> DENIED (`hasOnly` rejects).
7. **ID Poisoning (1.5KB Document ID)**: Create `/rooms/<1500-char-id>` -> DENIED (`isValidId` rejects >128 chars).
8. **PII Scraping**: Member A calls `get` on `/members/memberB` -> DENIED.
9. **Member Editing Meal Entry**: Member updates `/mealEntries/2026-11-18_m1` -> DENIED (`isManagerOrAdmin` required).
10. **Member Creating Expense**: Member creates `/expenses/e1` -> DENIED (`isManagerOrAdmin` required).
11. **Audit Log Tampering**: Manager or Admin attempts `update` or `delete` on `/auditLogs/log1` -> DENIED.
12. **Negative Financial Amount**: Manager creates `/payments/p1` with `amount: -500` -> DENIED.
