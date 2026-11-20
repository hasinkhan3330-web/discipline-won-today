# Access-rule (RLS) audit and proposed fixes

## Results (read-only, live database)

All 65 app tables (public) have RLS on. No app table has an anon or public policy. Every policy on user data checks auth.uid(), except the cases listed below.

| Table | RLS | Policies (command: condition) | Verdict |
|---|---|---|---|
| 8 server-only tables: alarm_events, daily_coin_decay, nudge_suggestion_log, wake_delivery_log, wake_push_outbox, wake_push_subscriptions, wake_question_history, wake_typing_sentences | On | none, so the app is locked out | Safe |
| billing_plans | On | ALL for service_role: true | Safe (server-only role) |
| payment_events, subscriptions | On | ALL for service_role: auth.uid() IS NULL OR owner; plus owner SELECT | Safe (server-only role) |
| billing_notifications | On | SELECT: false | Safe |
| nudge_templates | On | SELECT: active | Safe (shared, non-personal text) |
| quiz_questions | On | SELECT: is_active AND NOT wake_only | Safe (shared content) |
| coach_messages | On | DELETE: owner, and DELETE: false; UPDATE: false; INSERT/SELECT: owner | Risky: the two DELETE rules combine with OR, so users can still delete their own coach history |
| partner_messages | On | SELECT: sender or recipient | Risky (low): no active-partnership check. The table is unused and empty |
| coach_memory, coach_plan_materialized, coach_plans, coach_profile, daily_coin_decay, nudge_templates, plan_tasks | On | owner-only policies | Risky (low): leftover anon table grants. RLS still blocks them, but this goes against defense in depth |
| All other public tables (about 50) | On | authenticated, owner or partner via auth.uid() | Safe |
| storage.objects: avatars, proofs (both private) | On | owner folder = auth.uid(); proofs partner read needs a matching proof row | Safe |
| 4 database_export_* buckets | private | no policies, so the app is locked out | Safe |
| auth.*, vault.secrets, realtime partitions, drizzle/supabase_migrations | Off | system-managed, no anon access | Safe (managed, not changed) |
| cron.job, cron.job_run_details, realtime.messages, storage.* | On | platform-managed | Safe (managed, not changed) |

Open tables: none.

## Fixes I would apply (one migration, waits for your approval)

1. coach_messages: drop the permissive "owner can delete" policy, so the existing DELETE false rule takes effect. Users can no longer delete coach history from the app. Confirm first that no screen offers deleting a conversation. If one does, keep the policy and mark this as accepted.
2. partner_messages: change SELECT to (sender or recipient) AND is_active_partner(other party). It's unused today, so nothing visible changes.
3. Revoke all privileges from anon on the 7 tables listed above. Signed-out users never used them, so nothing visible changes.

No changes to auth, storage, cron, realtime or other system schemas.

## Technical details

- Rollback: recreate the dropped policy, the old partner_messages policy, and GRANT the same privileges back to anon.
- Check after applying: rerun the anon-privilege and pg_policies queries, then load Coach and Accountability as a signed-in user.
