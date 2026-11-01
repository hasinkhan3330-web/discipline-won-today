# Fix: alarm keeps ringing after a correct answer ("score_events_points_check")

## Root cause (confirmed)
- The score rule only accepts points from 1 to 500.
- When you solve a wake alarm, the server saves wake XP using the hour of the alarm: 4AM = 10, 5AM = 7, 6AM = 5, 7AM = 3, **any other hour = 0**.
- Your alarm was at about 5 PM, so the XP was 0. Saving 0 breaks the rule, and the whole solve is undone. The alarm stays "ringing", no coins are saved, and the raw database error appears on screen.
- The other two places that save score points (Contract and Comeback) use fixed positive XP and are not affected. I will double-check this with a test.

## What I will change
1. **Server solve step (wake answer):** save a wake XP row only when the XP is above 0. Alarms outside 4–7AM still stop, record the session and streak, and give 0 XP. Coin rules stay as they are now (outside the reward window = 0 coins, with the existing honest message).
2. **Keep the score rule as is (1–500).** A 0-point XP row has no meaning, and wrong answers do not take points away in this app. I will not change the rule; I will stop sending invalid values instead. The points field is already required.
3. **Friendly errors:** the alarm screen will show a short message like "Couldn't save just now, retrying…" instead of raw database text. The full error is still logged in the console.
4. **Retry:** if the solve request fails because of the network or the server, it retries up to 3 times with backoff, then keeps retrying when you are back online. This uses the existing in-memory offline queue.

## Deliberately not changed (please confirm)
- **Stopping the alarm without the server.** Your saved rule says the alarm stops only after the server checks the answer, because answer keys never reach the phone. If the phone stopped the alarm by itself, anyone could skip it. So I will keep the server check, fix the cause of the failure, and add retries. If you want a local stop anyway (for example, after the 3 retries fail), tell me and I'll make that the plan.
- No visual changes.

## Tests
- Correct answers at 4AM, 5AM and a 5PM alarm: alarm stops, the right XP is saved (or none at 5PM), and there is no error.
- A wrong answer resets the "correct in a row" count and issues a new question.
- For science questions, 2 correct in a row stops the alarm, and 1 does not.
- A failed or offline request retries and never shows raw database text. The alarm never counts as solved without the server.
- Every other place that saves score points sends a value from 1 to 500.
- Temporary test accounts are deleted afterwards. I will then list exactly what changed.

## Technical details
- Migration: `CREATE OR REPLACE public.wake_submit_answer`. Wrap the `score_events` insert in `IF public.wake_slot_reward(...) > 0 THEN … END IF`. Everything else stays byte-identical.
- Client: on the alarm screen, map the solve error to a friendly toast and add bounded retries to the existing answer queue.
