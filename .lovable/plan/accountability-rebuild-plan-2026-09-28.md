# Accountability rebuild plan

## Confirmed current state
- The active screen is **Profile → Accountability**, backed by the one-partner protected flow. The older pact panel is not mounted and will remain untouched.
- Live in-app delivery already uses `accountability_events` and the existing dashboard-level listener.
- The server currently accepts only four fixed English nudges and enforces authentication, active partnership, recipient mute, 3 nudges per partner contract, and 10 per 24 hours.
- The partner summary currently exposes only the shared contract title/status. It does not yet return commitments or weekly partner statistics.
- Existing event rows are readable only by their sender or recipient; browser inserts, updates, and deletes are denied.

## Changes to build

### 1. Smart nudges and Emergency Nudge
Replace the four existing choices with exactly these five fixed messages:
- “Bhai uth, aaj ka task pending hai 🔥”
- “Tera streak toot raha hai — 1 task kar abhi ⚡”
- “Discipline seeker ya excuse maker? Choice teri 💀”
- “Top 10 mein aana hai? Aaj ka kaam kar 🏆”
- “Main dekh raha hoon — mat chook aaj 🤝”

Add **🚨 Emergency Nudge** as a distinct fixed server-generated event. It will use the same mute protection and the same 3-per-contract / 10-per-24-hours limits; it is not a bypass.

The server, not the browser, will validate every allowed action and message. Custom messages remain rejected.

### 2. Verified Daily Check-in
Add **✅ Aaj ka task kiya**.
- Enabled only after the signed-in user has a server-recorded completion for today.
- The server rechecks completion; changing the screen cannot bypass it.
- The server generates: **“[Username] ne aaj apna task complete kiya”**. The browser cannot supply the username or confirmation text.
- At most one check-in per user per day, preventing duplicate confirmations.
- It uses the existing live in-app notification path and respects an active partnership and mute setting.

### 3. Our Contract
Add an **Our Contract** section with two short commitments:
- “My commitment” is editable by the signed-in user, maximum 100 characters.
- “Partner commitment” is read-only.
- Each user can change only their own side while the partnership is active.
- Empty commitments show a restrained empty state; no invented text.

### 4. Partner Stats
Add one compact three-number row:
- Current streak
- Coins earned this week
- Tasks completed this week

All three values are calculated server-side for the active partner. Weekly values use the current calendar week and verified backend records. No full history, private notes, proof, location, contact details, or AI analysis is exposed.

### 5. Existing controls and presentation
Keep unchanged:
- Remove partner
- Block & report
- Share my contract progress
- Mute nudges
- Invite/join partner flow
- Recent sent/received history
- AXEN dark theme, navigation, typography, and existing card styling

The current partner contract title/status sharing remains controlled by the existing share toggle.

## Exact implementation scope

### New database migration
Add only:
- Two directional commitment fields on `accountability_connections`, each limited server-side to 100 characters.
- A protected save-commitment function that updates only the caller’s side.
- A protected dashboard-summary function returning the active partner’s display name/avatar, current sharing/mute state, both commitments, and the three requested aggregate stats.
- A protected accountability-action function, or a backward-compatible extension of `send_accountability_nudge`, for the five fixed nudges, Emergency Nudge, and verified Daily Check-in.
- Authenticated-only execute permissions; preserve current row security and event read restrictions.

No new table is planned. Existing connections, invites, and event history remain valid.

### Existing files to modify
- `src/components/verified/AccountabilitySection.tsx`
  - Replace the nudge choices.
  - Add Daily Check-in, Our Contract, and Partner Stats.
  - Preserve invite/join, sharing, mute, history, removal, and block controls.
- `src/components/verified/NudgeListener.tsx`
  - Extend the existing listener to display nudge, emergency, and verified check-in messages through the same AXEN toast/haptic path.
- `src/integrations/supabase/types.ts`
  - Generated type refresh only if the migration requires it; no hand-authored behavior.
- The new migration file under the existing migration directory.

### Files explicitly untouched
- `src/components/AccountabilityPanel.tsx` legacy pact flow
- XP, coins, rewards, ranks, badge rules, and leaderboard logic
- Deep Focus, Zen, alarms, Goals, Coach, and contract reward flows
- Navigation, routes, authentication flow, and global theme
- Existing invite security, one-partner rule, revocation behavior, and notification subscription architecture

## Validation after approval
1. Each of the five fixed nudges saves one event and appears live for the receiver with exact text.
2. A custom message is rejected server-side.
3. Emergency Nudge appears urgently but obeys mute and normal limits.
4. Fourth contract nudge is blocked; 11th rolling-day nudge is blocked.
5. Muted, removed, blocked, unauthenticated, or unrelated users cannot send actions.
6. Daily Check-in is blocked before completion, succeeds after a verified completion, uses the server-generated safe username, and cannot duplicate that day.
7. Each user can save only their own commitment; 101 characters, unrelated access, and inactive partnerships are rejected.
8. Both commitments render correctly, including empty states.
9. Partner streak, weekly coins, and weekly completed tasks match server-calculated records and expose no raw private rows.
10. Sender and receiver histories are correct; unrelated users cannot read them.
11. Existing share/mute/remove/block/invite/join controls still work.
12. Live two-user flow, phone-width layout, no overflow, compilation, and available automated checks pass.

Testing will use isolated temporary records or transaction rollback and will not alter real balances or rewards. Work stops and reports the first unresolved failure. Nothing will be published.
