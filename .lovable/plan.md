# Database health check and fixes

## What I checked
- Every database call in the app (table reads and server actions) against the live backend: **all 100% match**. No missing tables, columns or functions. (The only non-table name, `avatars`, is the photo storage folder, which is correct.)
- Backend error logs for the last 7 days currently come back empty, so I can't see the exact 25 database errors from here. The recent wake-alarm "0 XP score" error was already fixed last turn and likely accounts for part of them.

## Confirmed cause of the live-update (Realtime) errors
The app listens for live changes on 5 tables, but the backend only broadcasts 3 of them:

| Listened to | Broadcast? |
|---|---|
| subscriptions | yes |
| accountability_events | yes |
| entitlements | **no** |
| payment_events | **no** |
| profiles | **no** |

Each listener on a non-broadcast table fails to connect and retries, which produces repeated Realtime errors and lowers the success rate.

## Fix
1. Add `entitlements`, `payment_events` and `profiles` to live broadcasting (one small additive change). Existing row rules already limit each user to their own rows, so no one sees others' data.
2. Run the backend security checker and a permissions sweep on all tables; fix only real gaps it reports (no changes to rewards, coins, auth or screens).
3. Re-check backend logs after the change, and sign in to confirm the dashboard, paywall and accountability screens connect with no live-update errors.

## Not changed
No screens, design, rewards, coins, XP, auth or payment logic.

## Technical details
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE public.entitlements, public.payment_events, public.profiles;
```
RLS on these three is owner-scoped already; verify with `pg_policies` before applying.
