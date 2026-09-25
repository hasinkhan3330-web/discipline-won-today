# Phase 7 — Accountability + Soft Shield (Audit, zero code)

No look, theme, route or navigation changes. Everything new reuses the existing card, button and Deep Focus styles.

## A) What already exists

### 1. accountability_connections
- Columns: id, user_id (inviter), partner_id (acceptor), invite_id, status (active / revoked / blocked, default active), share_status (bool, default true), share_streak (bool, default false), created_at, ended_at
- Constraints: no self-link (user_id <> partner_id); one active connection per user (unique index `acn_one_active_user` on user_id where active); foreign keys to both users and the invite
- Access rules: both members can read the row. Nobody can add, change or delete rows directly; only the server functions can.
- Gaps:
  - `share_status` is one switch for the whole connection, so each person can't control their own sharing separately.
  - There is no way to mute a partner.

### 2. accountability_invites
- Columns: id, inviter_id, token_hash (exactly 64 hex characters, unique), expires_at (required), accepted_by, accepted_at, revoked_at, created_at
- Only a hash is stored. The plain token is never saved.
- One-time use is enforced by the server function: the invite is locked while it's checked, and it's refused if accepted_at is already set. A rule blocks accepting your own invite.
- Access rules: only the inviter can read their own invites. No direct writes.
- Gaps:
  - The token and its hash are currently made in the browser; the server only receives the hash.
  - Invites expire after 48 hours, not 24.
  - The limit is 5 invites per day, not 3.
  - Nothing blocks sending an invite when you already have a partner.
  - Accepting your own invite gives a specific error message instead of the generic one.

### 3. accountability_events
- Columns: id, connection_id, actor_id, recipient_id, kind, message (max 140 characters), contract_id, created_at
- Event kinds allowed: nudge, cheer, contract_verified, contract_missed, connected, revoked
- Access rules: the sender and the recipient can read an event. No direct writes.
- Currently recorded: connected (on accept), revoked (on revoke or block), nudge/cheer (with free text)

### 4. Existing server functions (Phase 1, live)
- `create_accountability_invite(_token_hash)`: the browser sends the hash; limit 5 per day; expires after 48 hours
- `accept_accountability_invite(_token_hash)`: locks the invite and checks it isn't used, revoked, expired, your own, or joining someone who already has a partner. It then creates the connection and logs "connected".
- `revoke_accountability_connection(_connection_id, _block)`: either person can revoke or block, effective immediately; logs "revoked"
- `send_accountability_nudge(_connection_id, _kind, _message)`: allows free text; limit 3 per connection per 24 hours; no mute check
- `get_partner_today()`: returns partner id, status and day only when sharing is on (no title)

### 5. Deep Focus (read-only) and the contract focus screen
- `DeepFocus.tsx` (404 lines):
  - Full-screen focus with the Frequency Hub music player (6 tracks, lines 26–31, 320–340)
  - "Permanent Strict" and "Flexible" modes (lines 232–233)
  - `abandon()` emergency override with a −5 points penalty (lines 141, 351)
  - "X apps shielded" wording (line 283)
- `ContractFocusSession.tsx` (Phase 3 layer used for contracts):
  - Reuses the same music and Deep Focus styles
  - Confirm dialogs for End Session and Emergency Exit (lines 157–190)
  - Emergency Exit is always available
  - Exits are already recorded as session end reasons: emergency / user_ended
- Keeping the screen awake: **not present anywhere** (no wake lock, no plugin)
- Do Not Disturb: **not present**

### 6. Other existing systems
- Blocking: only `revoke_accountability_connection(..., true)`. There is no reporting system.
- Rate limits: only inside the invite and nudge server functions (numbers above).
- Sharing switch: only the `share_status` column. There is no screen for it.
- Old "Accountability Mode" (pacts): `AccountabilityPanel.tsx` + `accountability_pacts` / `pact_nudges` + `get_pact_status` / `leave_pact`
  - It is **not shown anywhere in the app today**.
  - It stays untouched.

### Every file that touches these areas
- Accountability: `AccountabilityPanel.tsx` (old, not shown), `ContractSheet.tsx` (accountability switch locked off), `lib/verified/contracts.ts`, `routes/_authenticated/dashboard.tsx` (unrelated "partner" wording only)
- Focus: `DeepFocus.tsx`, `FocusMusicPanel.tsx`, `verified/ContractFocusSession.tsx`, `tabs/HomeTab.tsx`
- Privacy: `routes/privacy.tsx` (legal text), `tabs/ProfileTab.tsx`

### Strict Shield audit
- Android: accessibility service permission is **not present**. The app only has internet and billing permissions.
- iOS: FamilyControls entitlement is **not present**; there is no iOS project.
- Conclusion: **Strict shield not available in this release.** No blocking code will be added.
- Note: Deep Focus already says "X APPS shielded" (line 283). That is pre-existing wording that I will not touch, because `DeepFocus.tsx` is read-only. Nothing new will claim that apps are blocked.

## B) Proposed changes

### Database (additive only; SQL shown for approval before applying)
1. **New columns on connections:**
   - `share_by_user` and `share_by_partner` (each person's own sharing switch, default on). `share_status` is kept but no longer used.
   - `muted_by_user` and `muted_by_partner` (default off)
2. **Replace the two invite functions with safer versions:**
   - Expiry after 24 hours
   - 3 invites per day
   - At most 1 invite per hour (invites are share links with no named person, so "1 per target per hour" becomes 1 per hour overall)
   - A new invite is refused if you already have a partner, with the message "You already have a partner"
   - Every invalid case (expired, used, your own, missing) returns the same generic "Invite invalid or expired"
3. **Replace `send_accountability_nudge`:**
   - Only these messages: "You've got this", "Start now", "Great work", "Try the rescue version". No custom text.
   - At most 3 per contract and 10 per day to the partner
   - Refused if the receiver has muted you or the connection is blocked
4. **New:**
   - `set_accountability_prefs(sharing, mute)`: changes only your own side
   - `get_partner_contract_summary()`: returns only the partner's today's contract title, status and start time, and only when the partner's sharing is on and the connection is active. Otherwise it returns nothing.
   - `get_my_accountability()`: returns connection id, partner display name, avatar, and both sharing/mute states. No email, coins or XP.
5. **Reused unchanged:** `revoke_accountability_connection` (revoke, plus block). "Report" will use block as the report action (there is no reporting system yet).
6. **Permissions:** signed-out visitors can't run any of these; signed-in users can. Every function locks its search path.

### Server function (new file `src/lib/verified/accountability.functions.ts`)
- `createInvite`:
  - Makes 32 secure random bytes on the server and hashes them with SHA-256
  - Calls the database function with the hash and returns the plain token to the inviter only once
  - Never logs the token
- `acceptInvite(token)`: hashes on the server and calls the accept function

### Screens (exact line changes shown for approval before editing)
1. **New file `src/components/verified/AccountabilitySection.tsx`**, built with the existing card and button styles:
   - Shows your partner, or "No partner yet"
   - **Invite** button: shows a copyable code
   - "Enter code" box to accept an invite
   - **Sharing** switch
   - **Mute** switch
   - The 4 fixed nudge buttons
   - Revoke button
   - Block & report button
2. **`src/tabs/ProfileTab.tsx`:**
   - Add one "Accountability" item to the existing grid, in the same card style (the list around lines 55–60)
   - Add one detail view in the same pattern as the existing "account" view (around line 52)
3. **`src/components/verified/ContractCard.tsx`:** when the contract has accountability on, a partner exists and your sharing is on, show one line: "{partner} · Partner can see your progress".
4. **`src/components/verified/ContractSheet.tsx`:** unlock the existing accountability switch, only when you have an active partner.
5. **Soft Shield (only what's missing), in `ContractFocusSession.tsx` only:**
   - A small "Keep screen awake" switch using the browser's screen wake lock, released when the session ends
   - One static line of Do Not Disturb tips
   - Exit events are already recorded, so nothing new there
6. **Not touched:** DeepFocus.tsx, Zen, navigation, Home sections, the old pacts panel

## C) Confirmed untouched
- Phases 1–6 functions and screens
- `award_contract`, `finalize_contract_and_award`, `start_recovery`
- score_events, coin_transactions, ranks and leaderboard
- DeepFocus.tsx core logic
- Zen, the 6 tabs, and the Home order

## Privacy matrix
| Data | Owner | Partner | Public |
|---|---|---|---|
| Contract title | Yes | Only if sharing on | No |
| Status / started time | Yes | Only if sharing on | No |
| Private note | Yes | Never | No |
| Proof photo (never stored) | Yes | Never | No |
| XP / coins | Yes | Never | No |
| Health / steps / location | Yes | Never | No |
| Full history / AI analysis | Yes | Never | No |
| Email / phone | Yes | Never | No |

The partner only ever gets data through `get_partner_contract_summary`, which returns 3 fields. There is no direct table access for partner data.

## Delivery
1. Approve this audit.
2. I show the full database SQL and wait for approval.
3. I show the exact screen line changes and wait for approval.
4. I implement and run all 31 tests, stopping on any failure.
5. I report PHASE 7 PASSED or BLOCKED, with the privacy matrix and the strict shield report.

No Phase 8, no native blocking, no merge or publish.
