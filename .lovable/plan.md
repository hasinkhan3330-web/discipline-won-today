# Accountability foundation: Step 0 (Phase A) + Phase 1 only

## Step 0: pending Phase A (already approved by you)
Apply one migration: the current `apply_daily_penalty()` unchanged, plus `FOR UPDATE` on the first SELECT. No grants or revokes. Afterwards, show `pg_get_functiondef` and the owner/proacl/prosecdef/proconfig output. No other Discipline change.

## Phase 1: what I checked (LIVE)
- RLS is on for every accountability table. `accountability_connections`, `accountability_invites`, `partner_messages`, `partner_events` and `acct_cheers` have SELECT-only policies. `acct_checkins` and `acct_settings` allow own-row writes.
- Invites: the browser sends a 64-hex token hash. `accept_accountability_invite` locks the invite row, is single-use, blocks self-redeem and checks expiry, and its errors are generic. Limit: 3 invites a day.
- Privacy toggles exist: `accountability_connections.share_by_user/share_by_partner` ("Share my pact progress") and `acct_settings.show_tree` ("Show my tree").
- Proofs: `proof_submissions.private_storage_path` exists, but there is **no proof storage bucket** (only `avatars` + exports).

## Phase 1: gaps to fix (additive only)
1. **Helpers** `is_active_partner(uuid)` and `my_active_partner()`: SECURITY DEFINER, `search_path=public`, EXECUTE for authenticated only (revoked from PUBLIC/anon).
2. **Leftover anon grants**: revoke on `acct_cheers`, `acct_checkins`, `acct_settings`, `acct_milestones_seen`. Policies already block anon, so nothing changes for users.
3. **`partner_messages_party_read`**: add the active-partner check.
4. **Partner-safe reads**: check that partner data reaches the browser only through the existing SECURITY DEFINER RPCs (`get_partner_today`, `acct_partner_garden_stage`, `get_partner_contract_summary`). Add `share_by_*` and `show_tree` checks inside them where missing, and return stage only, never score. Signatures and return shape stay the same.
5. **Invite failed tries**: add a small `accountability_invite_attempts` table (user_id, created_at; no user grants). Block after 5 failures per hour, with a generic error. Confirm the 24h expiry in `create_accountability_invite` (shorten it only if it is longer).
6. **Proof bucket** `proofs`: private, images only, 5MB, path `{user_id}/...`, storage rules for owner read/write plus active-partner read; signed URLs of 60s in code only where proofs are already shown.
7. **Remove/Block**: already enforced through `acct_connection_active_for`. I will re-check each partner read path.
No revokes on lifecycle tables in this phase. No UI change.

## Evidence after Phase 1 (then STOP)
`pg_policies` for the touched tables, table grants, ACL and definitions of the new or changed functions, and storage bucket and policies. Max 8-line report. Then I wait for "continue".

## Blockers / NOT VERIFIED
- Item 4 may show an RPC that leaks the garden score. If fixing it needs a UI change, I stop and report.
- Item 6: proof upload code may not exist yet. In that case I create only the bucket and its rules.

## Approved additions (override the items above)
- **Item 3:** No change. Today's `partner_messages_party_read` already lets a user read their own sent and received rows, also after removal, which is what you asked for. Skipped, so no history gets hidden.
- **Item 4:** Every partner-data RPC must derive the partner from `auth.uid()`. Any RPC taking a client-supplied user id must check for an active partnership. No anon EXECUTE, fixed search_path. Each one is listed in the evidence.
- **Item 5:** First measure the invite code the user types (`mkInvite` in code). If it is a random token of 128 bits or more, item 5 is skipped. If it is short, failed attempts are saved by returning an error code instead of raising, but only if the current UI handles that unchanged; otherwise I report a blocker.
- **Item 6:** Partner read on a proof file requires a `proof_submissions` row with that `private_storage_path`, status `submitted` and an owner who is the active partner. A folder match alone is not enough.
- **Report adds:** confirm that no client-writable column in `acct_checkins`, `acct_settings` or `acct_milestones_seen` feeds coins, garden score or trust (checked against the function bodies that compute them).
