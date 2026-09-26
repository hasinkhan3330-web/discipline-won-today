# AXEN Economy, XP Info, Streak Badges, Goals, Habits and Coach Knowledge

All six parts are logic and content changes. The theme, layout, navigation, Deep Focus screen design, Zen and Home order stay the same. The only visible additions are the ones you asked for: the XP info dot, the 5 milestone circles with badges, the badge next to your name, and the Goals tooltip text.

## Decisions you confirmed
- Deep Focus: 49 min = 10 coins, 2 h = 10, 3 h = 15. Focus Music pays 0 coins.
- The 50 coins per day limit counts everything: contracts, Deep Focus, 4AM, habits and top tasks.
- Goal progress counts only coins from habits linked to that goal, toward 18,000.
- A streak badge unlocks when you reach that many streak days. It pays its coin amount once.

## 1. Coin economy (all enforced on the server)
| Action | Coins |
|---|---|
| Contract verified | 20 (recovery stays 2) |
| Deep Focus 49m / 2h / 3h | 10 / 10 / 15 |
| 4AM QR verified | 10 |
| Regular habit tick | 2 |
| Important (priority) habit tick | 3 |
| Custom habit | 1 to 5 (your choice, capped) |
| Focus Music | 0 |
| Daily limit | 50 in total |

- One shared server check reads today's earned coins (in your own time zone) and cuts any reward that would go past 50. It never gives negative coins, and it never changes past coins or balances.
- Contract XP stays 20 (recovery stays 8). Existing score events and leaderboard code are not touched.
- The Focus Music panel keeps its look. Only the "+coins" text becomes "Focus only · no coins".

## 2. XP info dot
- A tiny glowing dot sits directly above "Use Focus Mode +15 XP" in "How to Earn XP & Climb Ranks". It reuses the existing futuristic info dot and pop-up card.
- The card lists: Complete Habits +10 · Achieve Goals +20 · Stay Consistent +5 daily · Use Focus Mode +15 · Meditate +10 · Unlock Achievements +25. It closes when you tap outside. No new page.

## 3. Streak milestones (Stats)
- The same section header and circle style, but with 5 circles: 7 / 21 / 100 / 290 / 365 days, each showing 350+ / 1050+ / 5000+ / 14500+ / 18250+.
- Circles you haven't reached stay dim with no badge. Reached circles get a glossy check badge at the top-right: yellow, green, blue, red, and a dark-blue diamond with extra glow for 365.
- Server: a new function awards each milestone's coins once, using a new unique key per milestone. This milestone bonus counts outside the 50 per day limit. If you want the limit to apply here too, say so. With a limit of 50, a 350-coin bonus could never be paid.
- Your highest badge shows next to your name on Profile and on your own Rank row. The badge is based on your recorded best streak, so it stays permanent.

## 4. Goals
- The progress bar fills by coins from linked habits divided by 18,000. The label on the right reads "2,450 / 18,000 coins". The bar reaches 100% only at 18,000.
- Existing goals get a target of 18,000. The goal recalculation counts only coins from linked habits.
- The existing info dot next to "Aim clearly. Advance deliberately." shows the Action Promise text exactly as you wrote it.

## 5. Build Your Discipline
- Priority habits no longer complete with one instant tap:
  - Wake Up 4AM: the tick can only be activated between 4:00 and 4:30 AM your time. The server checks the time; earlier or later taps are refused with a short note.
  - Cold Shower and Workout: a tap opens a small "Mark done" confirmation. The server records the real time and only accepts it between 4:00 AM and 11:59 PM on that day, once.
  - The circle looks exactly the same.
- Build Any Habit: the reward is chosen from 1 to 5 coins (default 2). "Require scan proof" is removed from the form and from the save logic. The server also caps the reward at 1 to 5.

## 6. Coach knowledge
- One shared knowledge file describes every feature: Home, Rank, Zen, Coach, Stats, milestones and badges, Profile, Goals (18,000), Habits (verified ticks, 1–5 coins), the coin table, contracts, recovery, accountability, Deep Focus, 4AM and Focus Music.
- Coin values and milestones are imported from the same constants the app uses, so the Coach stays accurate if they change.
- Both the text Coach and the voice Coach receive this knowledge plus your live data (coins, streak, rank, today's contract, partner status). No change to the chat look, avatar or voice.

## Technical section
- One migration (all "IF NOT EXISTS" or create-or-replace; nothing dropped):
  - Helper `axen_daily_coin_room(user)` calculates the remaining room under 50 from today's coin_transactions in the profile timezone.
  - Replacements for `complete_task` (2/3/custom 1–5 plus priority time windows), `complete_focus_session` (10/10/15), `complete_focus_music_session` (0), `complete_alarm`/wake (10), `award_contract` coins 20; each applies the daily room.
  - New `claim_streak_milestones()` with idempotency key `streak:<n>`.
  - `recalc_goal` / `sync_goals_from_completion` count only linked-habit coins, with target_coins set to 18000.
  - The `validate_task_builder_fields` trigger caps pts at 1–5 for custom habits and forces require_scan false.
  - Every function uses search_path '', is revoked from PUBLIC/anon and granted to authenticated.
- Shared constants in `src/lib/economy.ts` are used by the UI and by `src/lib/coach-knowledge.ts`. That knowledge file is injected into `coach.functions.ts` and the voice coach system instruction.
- DeepFocus.tsx: only reward text or constants change, and only if they show coin numbers. If you still want that file frozen, I will leave it alone and change only the server amounts.
- Tests run in a rolled-back harness: daily limit, each reward value, one-time milestones, priority time windows, custom 1–5 limit, goal math, and Coach answers about contracts and accountability. Regression covers all 6 tabs.

## Not touched
Navigation, theme, auth, Zen, score_events and coin_transactions structure, leaderboard ranking logic, Phase 1–7 privacy rules. Nothing is published.
