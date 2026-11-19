# Phase 3 — Nudges saved and private (reuse, no duplicate tables)

## What already exists (LIVE evidence)
- `partner_events` (17 rows) already stores every nudge/emergency/cheer: from_user, to_user, connection_id, kind, text snapshot, created_at, seen_at. Filled only by fail-safe triggers on `accountability_events` and `acct_cheers`. Clients: SELECT + UPDATE(seen_at) only; no insert, no delete. → this is the nudge store; `seen_at` = read_at.
- `send_accountability_nudge` already: auth.uid(), active connection only (blocked/removed rejected), mute check server-side, fixed 5-text allowlist, 3 per pact, 10 per 24h. Gaps: no template ID, no category, no 30-min/hourly/hard/emergency limits, pact chosen by server not optional.
- `partner_messages` (0 rows, unused) and `acct_cheers` stay untouched. Recent list (`PartnerHistory.tsx`) + unread badge already read `partner_events`.
- Not in realtime publication: `partner_events` (only `accountability_events`, which `NudgeListener` uses with party-only RLS).
- Nudges give no coins/trust/streak today (no award call in the path) — kept.

## Build
1. Additive columns: `partner_events.template_id text`, `partner_events.category text` (gentle|push|hard|emergency, nullable for old rows), `accountability_events.template_id text`.
2. Minimal server table `nudge_templates` (id, category, text, active) — the same table Phase 3B will extend; seeded ONLY with today's 5 Hinglish texts + the emergency text, mapped to categories. SELECT for authenticated (active rows), no client writes.
3. `send_nudge(_template_id text, _pact_id uuid default null)`: SECURITY DEFINER, search_path=public, authenticated execute only. Partner from auth.uid() via active connection (blocked/removed → no send), mute respected, pact (if given) must belong to the receiver, text copied from template at send time. Limits from `partner_events` per sender→receiver: same template 1/30 min, 3/hour, 10/day, hard 2/day, emergency 1/day. Inserts into `accountability_events` (same path, so the trigger saves history and the live popup keeps working); trigger copies template_id + category.
4. Old `send_accountability_nudge` stays for check-in/details/commitment; frontend nudge/emergency buttons switch to `send_nudge`. Same UI and copy.
5. History after removal (user chose keep): `partner_events` SELECT policy drops the active-connection condition, so sender/receiver keep their own rows; the seen_at UPDATE stays party-only (no active-connection requirement). The Recent list and badge stay hidden on screens without an active partner. Sends are still blocked by `send_nudge`.
6. Rolled-back SQL tests for each limit, mute, removed partner, stranger read, direct insert denied. No real sends, no test accounts. Rollback SQL included.

## Report then STOP
Max 8 lines + raw definitions/ACLs/policies.
