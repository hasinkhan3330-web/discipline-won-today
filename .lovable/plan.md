# Personalized AXEN Voice Coach

Upgrade the existing voice coach so it opens the conversation itself, knows the user's real
AXEN progress, and can pull fresh numbers mid-conversation. No screen, photo, layout, colour,
navigation or existing feature changes — the same coach button, the same visuals.

## What the user will experience

- Tap the existing mic: connecting state → the coach speaks first, by name, in about 20–40
  seconds, mentioning 2–3 real facts (a win, a gap) and ending with one question.
- It talks accurately about: today's completed / pending / missed habits, coins earned today,
  total coins, current and best streak, weakly performing habits, 7- and 30-day completion
  rate, goal, leaderboard rank, gap to the next rank.
- Mid-call it can refresh today's progress or rank when the user asks "what's my rank now".
- Anything the app doesn't actually know is said as unknown, never invented.
- On ending, the coach saves a one-line summary and the action the user agreed to, so the next
  session can reference it.

## Data the snapshot is built from (existing tables only)

`profiles` (name, coins, streak, longest_streak, primary_goal, biggest_distraction,
safe_minor_mode), `tasks` (active only), `task_completions` (last 30 days),
`coin_transactions` (today), `daily_top_tasks` (today), and the existing leaderboard RPCs
`my_leaderboard_position` / `leaderboard_top` so the rank matches exactly what the Rank screen
shows. Missed = an active daily habit with no completion on a past day; today's uncompleted
habits are "pending", never "missed".

## Technical plan

1. **`src/utils/coach-context.functions.ts`** (new) — `getCoachContext`, `getTodayProgress`,
   `getLeaderboardPosition`, `saveCoachSessionSummary`, all `createServerFn` +
   `requireSupabaseAuth` + `has_premium_access`, user id taken from the verified session only.
   Each returns a compact JSON snapshot in the requested shape (nulls where data is absent).
   Zod validation on the summary input; capped lengths; no free-form SQL exposed.
2. **Migration** — new `public.coach_sessions` (id, user_id → auth.users, session_id,
   started_at, ended_at, short_session_summary, user_agreed_next_action, next_check_in_at,
   model, provider, quality metadata). GRANTs for `authenticated`/`service_role`, RLS
   owner-only select/insert/update, no delete by others. No transcripts, no audio stored.
   Existing `coach_notes` / `coach_conversations` / `coach_messages` stay untouched.
3. **`src/utils/voice.functions.ts`** — keep the same return contract so the UI keeps working.
   Add: per-user rate limiting (session starts per hour), and attempt a short-lived Gemini
   ephemeral auth token first (`v1alpha/auth_tokens`, ~10 min expiry, single session use),
   falling back to the current key path only if the token is rejected, so the voice experience
   never breaks. The permanent key is never returned when a token succeeds, and is never
   logged. The snapshot is fetched server-side in the same call.
4. **`src/components/VoiceCoach.tsx`** — same markup, same styling, same button; changes are
   inside the session setup:
   - richer system instruction (the AXEN Coach identity, truth rules, language matching,
     depth, streak/coin/rank coaching, emotional-safety and crisis handling, voice rules),
     with the snapshot attached as private session context.
   - after setup completes, send a single `SESSION_START` turn so the coach speaks first;
     guarded so re-render or reconnect never replays the greeting.
   - enable input/output transcription, context-window compression, and session resumption
     (store the newest resumption handle; reconnect on GoAway/socket drop without re-greeting).
   - declare the four tools; handle `toolCall` by invoking the matching server function and
     posting `toolResponse` back; tool errors return a plain error the coach speaks around.
   - existing cleanup (mic, audio context, socket, interruption handling) kept as is.
5. **Model** — keep the current live audio model unless the tool config is rejected; verify by
   running one real session.

## Out of scope

No UI redesign, no second coach page, no changes to habits, coins, streaks, completions,
leaderboard logic, billing, or any other screen. The model can never write coins, completions,
streaks or ranks — only read the snapshot and save its own session summary.
