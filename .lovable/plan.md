# Phase 3B: Daily changing nudge suggestions

## What exists (checked)
- `nudge_templates` (id, category, text, active) has 6 rows: n1–n5 (push/hard/gentle) and `emergency`. Readable by signed-in users, nobody can edit.
- `send_nudge(template_id, pact_id)` already accepts any active template and enforces every limit. It does not change in this phase.
- Privacy switch "Share my pact progress" = `accountability_connections.share_by_user` / `share_by_partner`.
- Nudge buttons in `AccountabilitySection.tsx` are hard-coded to n1–n5.

## Database (one migration, additive)
1. `nudge_templates`: add `state_tag text NOT NULL DEFAULT 'generic'` and `language text NOT NULL DEFAULT 'hinglish'`. Existing rows become generic/hinglish, so their text and IDs stay the same.
2. New private table `nudge_suggestion_log` (sender, receiver, template_id, local_day, created_at, unique(sender, receiver, template_id, local_day)). Nothing is granted to anon or authenticated; only the function writes it.
3. `get_nudge_suggestions()`: SECURITY DEFINER, `search_path=public`, authenticated execute only.
   - Takes the partner from `auth.uid()` through the active connection. Returns nothing when there is no partner, the sender is muted, or the pair is blocked or removed.
   - Uses the receiver's local day from `acct_user_today(receiver)`, which falls back to UTC.
   - If the receiver shares progress, it works out one state from `daily_contracts` and connection data, in this order: overdue, due soon (within 2h), session not started, stuck (started but not done after planned time), streak at risk, comeback available, pact completed, partner working. Otherwise the state is `generic`.
   - Picks up to 4 templates (gentle, push, hard; never emergency). The order is `md5(receiver||day||template_id)`, so results stay the same on refresh. It skips templates logged or sent (`accountability_events.template_id`) for this pair in the previous 7 days, not counting today. If too few are left, it falls back to generic.
   - Logs what was shown (ON CONFLICT DO NOTHING) and returns only `{template_id, category, text}`. No receiver data is returned and nothing is sent.
4. Seed rows through the data tool, not the migration: at least 5 respectful Hinglish templates for each of the 8 states, plus 5 extra generic ones. Hard can be firm, never abusive.

## Frontend (smallest change)
- The nudge buttons show the suggestions and send their `template_id` through the existing `send_nudge`. They fall back to today's n1–n5 if the call fails. Layout, styles and other copy stay the same. Emergency is unchanged.

## Rolled-back tests (one real pair, BEGIN…ROLLBACK)
- Two calls on the same day return identical lists, and a call for another day gives a different list.
- Share OFF returns only generic templates. Share ON with an overdue pact returns overdue templates.
- A template sent 3 days ago is excluded. One sent 8 days ago can come back.
- The output keys are only template_id, category, text. A stranger or removed partner gets an empty result. A direct select or insert on the log is denied.
- Emergency 1/day: send emergency, move it back 31 min, send again → ERR emergency limit.

## Report
Max 8 lines, then raw test output, raw `get_nudge_suggestions`, full raw `send_nudge` and `send_accountability_nudge`, and ACLs. Stop.

## Rollback
`DROP FUNCTION get_nudge_suggestions(); DROP TABLE nudge_suggestion_log;`, delete the seeded template rows by id, and revert the frontend file. The new template columns can stay.
