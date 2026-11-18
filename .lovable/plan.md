# Partner chat + notification inbox — audit (read-only) and plan

## 1. Backend and sign-in (checked)
- Backend: Lovable Cloud. Sign-in: Cloud auth; user id comes from the verified session (`auth.uid()` in database rules).
- Partnerships: `accountability_connections` (user_id, partner_id, status active/revoked/blocked). Invites: `accountability_invites` with the existing pairing code.

## 2. What already exists (checked)
| Table | Rows | Used by the app? | Rules |
|---|---|---|---|
| partner_messages (id, connection_id, sender_id, recipient_id, body, created_at) | 0 | No | Sender/recipient can read; nobody can write; does not check the partnership is still active |
| partner_events (nudge/cheer/emergency history, seen_at) | 17 | Yes, Recent list + badge | Read only while partnership active; recipient updates seen_at only; written only by triggers |
| accountability_events, acct_cheers | — | Yes, existing sends | Unchanged |

## 3. Why things "disappear" (checked)
- Partner chat was never built: there is no send function, no screen, and `partner_messages` is empty. Nothing to lose.
- Toasts are temporary on purpose; nudges/cheers already persist in partner_events since the last batch.

## 4. Proposed design (reuse, no duplicate tables)
- Extend `partner_messages` additively: `client_key uuid NOT NULL` (unique per sender, idempotency), `kind text default 'text'` (validated by trigger: text only), `read_at timestamptz`. Length limit 1–500 chars via trigger.
- No new conversations table: the partnership row is the conversation (one per pair, self-pairing already impossible).
- No new notifications table: messages also add a `partner_events` row with kind `message` (extend the kind check), so the existing Recent list/badge become the inbox. Dedup key = the message id.
- One SECURITY DEFINER function `send_partner_message(p_body, p_client_key)` with `SET search_path = public`: sender from auth.uid(), partner from the active connection, rejects blocked/revoked/muted, rate-limit, inserts message + event in one transaction, returns the existing row on repeat client_key.
- `mark_partner_messages_read(p_connection)` function for read status.

## 5. Rules
- SELECT: sender/recipient AND `acct_connection_active_for(connection_id, auth.uid())` (replaces the current looser read rule).
- INSERT/UPDATE/DELETE: none for users; only through the two functions.
- Live updates: existing realtime private channel per connection with the same participant check.
- Third account: sees 0 rows (tested in a rolled-back transaction, no real accounts).

## 6. Risks / unknowns
- Free-text needs block/report and abuse handling; Block already hides everything.
- Adding `message` to partner_events kind touches a table from the last batch (additive only).
- Push to a closed phone is not in scope.

## 7. Batches
- Batch 1: one migration (columns, triggers, 2 functions, tighter read rule), SQL tests in rolled-back transactions, revert SQL. Stop.
- Batch 2: small Chat view inside Accountability Check-ins (existing design tokens), files `acct/PartnerChat.tsx`, `acct.module.css`, `AccountabilitySection.tsx`. No other screens.
- Batch 3: messages in Recent list/badge, realtime, final A/B/C checks with mocked writes; no real sends.
