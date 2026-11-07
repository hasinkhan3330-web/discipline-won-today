# Accountability one-shot build (replaces all earlier Batch A / stake SQL)

Scope: only You → Accountability, its sheets and needed backend. Home, Rank, Zen, Stats, Coach, Home Contract card, 4AM, Verified Rank List, banner and bottom nav untouched. No stakes, Match me, squads, AI coach, Work Together, presence, Supporter, rest days, 12h auto-confirm, or coin/XP/rank/seal changes.

## Known facts from read-only checks
- Contracts are written directly by the Home card; the existing guard only blocks server-owned fields, so the 6 new fields pass through the same path (no guard change needed).
- Invites already use 128-bit random codes, stored hashed; existing create/accept kept as-is (24h expiry stays).
- User-side completion time = completed session end or first proof submission.

## Backend (one additive migration, applied directly)
- Contracts: add `is_solo`, `partner_visibility`, `minimum_version` (≤140), `obstacles` (≤280), `evidence_required`, `paused_at`.
- `acct_checkins` (owner read/write, one per day) and `acct_milestones_seen` (owner only), plus an owner settings row for "show my tree to my partner" (default on).
- Read-only functions, each checks the signed-in user, `search_path=''`, no anon access: `acct_garden_score`, `acct_partner_garden_stage`, `acct_pair_streak`, `acct_partner_checkin_status`, `acct_weekly_report`, `acct_mark_milestone_seen`.
- Garden: 85% on-time share of due pacts (Recovered = 60%), 15% check-in days, −10 per overdue pending pact, stages Seed/Sapling/Young/Lush/Ancient at 0/20/40/60/80; computed on read.
- No existing function or trigger edited. Verify with `has_function_privilege()` afterwards.

## App (Accountability-only files)
- Scoped dark (default) + light tokens with a header switch; card, pill, input, list, ring, week strip, tree components.
- Screens in priority order: Home + week strip + no-partner/invite/Go solo → 3-step Pact Creator (one-time, today/tomorrow) → proof, review (+ Ask clarification via existing composer), Recovery (Restart, 15-min Comeback, Reschedule, Pause; Reduce only if existing restart exists) → daily check-in with cheers → garden + pair streak milestone → weekly report with share image.
- Loading, empty, error and denied states; no overflow at 360px.

## Your three conditions
1. Invite screen shows the real 24-hour expiry, never 48h.
2. Partner tree and partner check-in return data only when an accepted connection exists between the two users; the tree also needs that user's "show my tree" on. Tested with two partners and a non-partner (gets nothing).
3. Cheers and clarification messages use additive schema only; no existing function or trigger edited.

## Tests
Two-account partner flows; anon denied on all new functions; cross-user reads blocked; Home card ↔ Accountability pacts; garden thresholds; milestone shown once; empty weekly report; both themes; Comeback, nudges and Trust unchanged.

## Final report
What was built, what was skipped and why, assumptions made.
