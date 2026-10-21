# AXEN Accountability — Discipline Engine upgrade

Scope: Accountability screen only (Profile → Accountability). Contract, Zen, Coach, Rank, Stats, Home, You and 4AM Protocol stay untouched.

## What exists today (audited)
- One partner per user, with invites, mute, sharing, block and remove (`accountability_connections`, `accountability_invites`, `accountability_events`).
- Pacts are built on the existing daily contracts, sessions, proof submissions, partner review (`partner_proof_action`) and the 15-minute comeback recovery.
- Trust summary exists (`get_trust_summary`) but uses a different count-based formula.
- Five fixed Hindi nudges plus an "Emergency nudge" button, sent through `send_accountability_nudge`.
- No coin stakes exist; a previous request removed all stakes from Accountability.
- No voice input exists anywhere in the app.

## Risks to confirm before building
1. **Stakes come back.** A previous request removed all stakes. This plan adds coin-only stakes, never real money. It uses the existing coin balance and ledger, not a second coin system.
2. **Theme.** The current Accountability screen uses warm navy with a blue accent. The brief says "neon-lime". The plan keeps the current Accountability look unless you say otherwise.
3. **Trust Score changes** to the 70/30 formula. The old score display is replaced.
4. **Recovery.** Today's comeback is a flat 15 minutes. The new "restart now" option adds a 5–10 minute version, while the existing comeback and its reward stay unchanged.
5. **Template nudges and the Emergency button get removed.** They are replaced by one free-text partner message with length and rate limits and a mute check. Old message history stays visible.
6. **Voice input** uses the phone's built-in speech recognition where available. Inside the Android app it may not be supported, so it falls back to keyboard only. That can only be confirmed on a real device.
7. **Video is not built.** Co-focus is a synced timer and presence room, stated honestly.
8. **Early-warning reminders while the app is closed** depend on the existing phone notifications. The server sends a backup in-app alert. Exact timing on real phones stays unverified.

## Phases (each verified before the next)

### Phase 1 — Database (exact SQL shown for approval first, additive only)
- Extra commitment fields on the existing contracts: what counts as done, a fallback action, and a deadline.
- `pact_stakes`: the two partners' stakes, the terms version, both acceptances, and the state (pending, active, escrowed, awaiting_review, approved, rejected, disputed, settled, cancelled). Each pact settles once, enforced by a unique key.
- Stake holds and payouts go through the existing coin ledger, with new reason codes and unique keys. A hold is refused if the balance is too low, so balances can never go negative.
- `pact_disputes` (written reason, 24-hour window), `trust_events`, `cofocus_sessions` with one check-in per partner, `recovery_choices`, `partner_messages`, and `commitment_reminders` (idempotency key, quiet hours, timezone).
- Least-privilege row rules: owners and the connected partner can only read. All writes go through protected server functions. Nothing is open to signed-out users.

### Phase 2 — Settlement engine (server)
A single row-locked `settle_pact` function implements the approved matrix exactly:
- Both approved, or approved by the 24-hour timeout: each partner gets their own stake back, plus the existing completion reward.
- One approved and the other missed: the completer gets both stakes.
- Both missed: both forfeit their stake, with no transfer.
- Mutual cancel before the deadline: full refund.
- Late proof gets a 15-minute grace only if the upload was started before the deadline, using a server timestamp.
- Review timeout: auto-approve, and both get their stakes back with no transfer.
- A rejection needs a reason and opens a 24-hour dispute. If unresolved, both get their stakes back. A rejection never hands coins to the rejecting partner.
- Duplicate or concurrent calls pay nothing extra.
- Deadlines, timeouts and dispute windows are closed by a single shared job. The job is armed only while open pacts exist and removed once none remain, following the existing comeback pattern. Opening the app also triggers it.
- Any edge case outside the matrix is reported to you, not guessed.

### Phase 3 — Screens
- Commitment form with four fields. Each field has a mic button and an editable transcript. The microphone is requested only when tapped, with keyboard fallback.
- Pact terms with an Accept button for each partner.
- Proof review screen: photo, stake at risk, 24-hour countdown, Approve, or Reject with a reason. "Self-reported" and "Partner-verified" look clearly different.
- Trust Score shows both percentages, and the combined score only after 5 outcomes and 5 reviews. It is labeled "initial product-defined metric".
- "Work Together Now": 25/50/75-minute sessions, task title, Quiet Mode, and a shared server start time. Outcomes are ready, active, completed, cancelled, interrupted or no-show, followed by a check-in from each partner.
- Recovery card: neutral wording, a one-tap reason, then restart (5–10 minutes), reduce scope, or reschedule. History is never erased.
- Weekly Review built only from stored data, with an "insufficient data" label when needed.
- One message composer with a mic, in place of the template nudges and the Emergency button.

### Phase 4 — Early-warning reminder
- One reminder 2 hours before the deadline, using the existing notifications plus a server backup.
- It is skipped if the commitment was created less than 2 hours before the deadline, and recalculated on completion, cancellation or reschedule.
- It respects quiet hours and timezone, and has an idempotency key.
- Copy: "Your commitment is due in 2 hours. Start now, or switch to your 5-minute fallback." Tapping it opens the commitment.

### Phase 5 — Tests and report
- bun tests against an isolated test database: every matrix case, disputes, concurrency, duplicates, insufficient balance, partner permissions, disconnected focus sessions, and all the reminder cases.
- Voice fallback unit tests.
- Existing test suites for Contract, Zen, wake, coins and others rerun to confirm nothing changed.
- Two temporary accounts for a live flow, then deleted.
- Final report: files, migrations, real results, and anything unverified (physical phones, closed-app timing, voice on Android).

## Technical notes
- Server functions use `createServerFn` with `requireSupabaseAuth`. All money-like logic lives in SECURITY DEFINER SQL using `axen_is_server_write`-style guards.
- Files: `AccountabilitySection.tsx` (split into new `src/components/accountability/*` files), `NudgeListener.tsx` (message/reminder/session kinds), new `src/lib/accountability/*.functions.ts`, new tests under `tests/accountability-*.test.ts`, and a scoped CSS module.
- Nothing is published without your separate approval.
