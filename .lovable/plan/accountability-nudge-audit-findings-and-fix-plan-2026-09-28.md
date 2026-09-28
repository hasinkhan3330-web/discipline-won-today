# Accountability nudge — audit findings and fix plan

## Audit (read-only, done)
1. **How a nudge is saved:** Profile > Accountability calls the server function `send_accountability_nudge`. It checks sign-in, an active partner, the 4 fixed messages, mute, 3 per contract and 10 per day, then inserts a row into `accountability_events` (kind = nudge). Recent rows exist ("Start now", "Great work", ...), so **sending works**.
2. **Who can read the row:** a single read rule `aev_select_party` — actor or recipient only. The receiver **can** read it. Direct inserts, edits and deletes are blocked.
3. **Receiver side:** **nothing listens.** No code reads `accountability_events`, and the table is not in the live-updates list (only `subscriptions` is). There is no in-app banner, no bell, and no phone notification for nudges.
4. The older `AccountabilityPanel` (pact_nudges) is a separate legacy flow; it stays untouched.

**Root cause:** nudges are saved but never delivered, because the receiver has no live listener and no in-app alert.

## Fix (additive, awaiting approval)
- **Database (one small migration):** add `accountability_events` to the live-updates list. No table, rule, rate limit or reward change.
  ```sql
  ALTER PUBLICATION supabase_realtime ADD TABLE public.accountability_events;
  ```
- **New `src/components/verified/NudgeListener.tsx`:** mounted once in the dashboard. Listens for new rows where recipient = me, shows the existing AXEN toast "Your partner sent: [message]", plays the existing haptic, and increments an unread count.
- **`AccountabilitySection.tsx`:** add a small "Recent nudges" list (last 10, sent + received) with an unread dot that clears when viewed. Uses current styles only.
- **`dashboard.tsx`:** one line to mount the listener. Nothing else changes.
- Phone push while the app is closed is not included (needs a push service); in-app alerts work while the app is open.

## Tests after approval
1 row created, 2 receiver sees banner, 3 correct text, 4 4th nudge on a contract blocked, 5 muted blocked, 6 removed partner blocked, 7 custom message rejected, 8 both see history. Stop on any failure; report PASSED or BLOCKED.

## Untouched
Notification/reminder system, XP/coins, rate limits, Rank badges, Deep Focus, Zen, navigation, theme.
