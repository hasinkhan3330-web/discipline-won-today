# AXEN — Backend strength pass (design unchanged)

Koi bhi screen ka design, layout, colour ya text nahi badlega. Sirf andar ka kaam pakka hoga: har button live, data real, animations smooth, errors par app kabhi crash na kare.

## Data rules

- Existing tables (alarms, alarm_sessions, coin_transactions, profiles.coins/streak/shields, tasks, task_completions, focus_sessions, goals, habit_reminders, accountability_pacts, friendships) waise hi rahenge — koi rename, koi migration, koi duplicate table.
- Shield aur Accountability ka current behaviour bilkul unchanged. Missed day ka natija wahi systems decide karenge.
- Sirf 4 nayi cheezein add hongi:
  - `quiz_questions` — math/science question bank (shared read).
  - `quiz_attempts` — kis alarm par kaunsa question, sahi/galat, kab.
  - `unlock_rewards` — one-time unlocks jaise 5000-coin gift (user + reward key unique, duplicate impossible).
  - `coach_notes` — daily summary, consistency score, suggested focus.
  - XP alag table nahi: XP existing coin_transactions + alarm_sessions + focus_sessions se derive hoga, ek hi server function se, taki Rank aur Stats hamesha same number dikhayein.

## Phase 1 — Wake protocol pakka karna

- 4/5/6/7 AM tap → confirm sheet (time + reward 21/15/10/5 coins) → existing `alarms` row save/update, chuna hua question `quiz_attempts` me link.
- Alarm time aane par full-screen Wake Protocol (jo abhi bana hai) — looping sound, sahi jawab par hi band.
- Sahi jawab: alarm session record, coins credit (existing coin ledger se), streak update existing rules se, Home par Wake Up tick.
- Galat jawab: shake + naya sawal, koi coin nahi katega.
- Alarm miss: grace window ke baad quietly missed mark, coins nahi ghatenge; shield/accountability apna kaam khud karenge.
- Audio block ho jaye to "Tap to start alarm" button; notification permission ho to reminder notification.

## Phase 2 — Har button live + loading/error

- Poore app ke primary buttons ka audit: Home command action, mission rows, scan, shields, reminders, Deep Focus, lock setup, focus music, Zen controls, Rank cards/rewards, Stats/You ke saare sections, Coach, Accountability toggle, unlock/gift.
- Har action par: turant visual feedback, in-flight spinner/disabled state, fail hone par friendly message aur retry — app kabhi blank ya stuck na ho.
- Double-tap guard har reward action par, taki coins kabhi double na milein.

## Phase 3 — Rank, Stats/You, Coach real data

- Ek hi shared stats source: streak, weekly consistency, lifetime coins, total wake completions, focus minutes, zen minutes, XP aur rank.
- Rank screen wahi design, par XP/coins/streak/consistency live; reward unlock progress real thresholds par.
- Stats/You ke paragraphs real numbers se bante hain (jaise "is hafte X/7 discipline days", strongest mission, suggested focus).
- Coach: agar AI already wired hai to usi se chhota message; warna rule-based encouraging suggestion, kabhi shaming nahi. Message `coach_notes` me din bhar ke liye cache.

## Phase 4 — Zen sessions + 5000 gift

- Zen start/pause/stop existing animation ke saath: session record banta hai, minimum duration par success + coins.
- Coins 5000 par pehli baar gift unlock — celebration, phir permanent "Unlocked" entry. Duplicate unlock database level par block.

## Smoothness

- Animations sirf transform/opacity par, reduced-motion respect.
- Timers aur heavy loops UI block na karein; background refresh ke dauraan screen jaise ki waise rahe.

## Verification

Har phase ke baad: typecheck + production build, aur phone size par live click-through — Home, Alarm, Zen, Rank, Stats, You, Coach, Accountability — console errors zero, koi horizontal scroll nahi, koi dead button nahi.
