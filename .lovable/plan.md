# Close the 5 gaps before final approval

Points 3 and 4 are answered below from real evidence (nothing changed). Points 1, 2 and 5 need changes or test runs, and they wait for your approval.

## 3. Deep Focus screen: the exact diff (already checked)
The only commit that touched `src/components/DeepFocus.tsx` in this feature is `b933b4c`. It changed **one line**:
```diff
-  { id: "f49", label: "49 MIN", sub: "IGNITION", minutes: 49, reward: 5 },
+  { id: "f49", label: "49 MIN", sub: "IGNITION", minutes: 49, reward: 10 },
```
Nothing else changed: no layout, no other logic, and line 283 is untouched.

## 4. All 39 security warnings (already checked)
They are all the **same type, graded WARN by the checker**: "signed-in users can run a function that has elevated rights". Each function checks who is calling it on the inside. My own severity rating for each one:

**Low: intended to be called by the signed-in user, and each checks ownership inside (33):**
accept_accountability_invite, award_contract, buy_streak_shield, claim_streak_milestones, complete_focus_music_session, complete_focus_session, complete_task, complete_top_task, complete_wake_protocol, complete_zen_session, create_accountability_invite, end_contract_session, get_entitlement, get_my_accountability, get_or_create_referral_code, get_pact_status, get_partner_contract_summary, get_partner_today, goal_overview, initialize_trial, leave_pact, list_friends, mark_goal_celebrated, redeem_referral_code, respond_friend_request, revoke_accountability_connection, save_goal, save_wake_plan, send_accountability_nudge, send_friend_request, set_accountability_prefs, start_contract_session, start_recovery, use_streak_shield

**Low: read-only public ranking data, no private fields (3):** leaderboard_top, my_leaderboard_position, rank_scan

**Medium: worth reviewing before going live (2):**
- `recalc_goal`: signed-in users can trigger a recalculation for a goal id. I will confirm it refuses other users' goals. If it doesn't, I will make it server-only.
- `apply_daily_penalty`: users can trigger their own daily penalty check. I will confirm it can't run twice in one day.

**High: none.**

## 1. Streak badge guard (fix)
The problem: the claim currently trusts the `streak` and `longest_streak` numbers on the profile.
The fix: `claim_streak_milestones()` will calculate the real streak from `task_completions` (the most consecutive days with at least one completion, in the user's time zone) and pay a milestone only when **both** the profile number and the real count reach the threshold. It will ignore any test or override flag. The coin amounts and the once-per-milestone key stay the same.
Test: a user whose profile says 400 days but has only 3 real completion days claims → no badge, no coins.

## 2. 4AM selfie liveness (fix)
In `WakeSelfie.tsx`, the camera screen samples the live feed for about 2 seconds before capture:
- **Motion check:** it compares small greyscale frames. A real person shows natural micro-movement. A perfectly still image (a photo held very steady, or a frozen feed) is refused.
- **Two frames sent:** one at the start and one at the end of the 2 seconds. The server requires a person in both frames and requires that the two frames differ by more than a small threshold. If the server doesn't see that, it refuses the check-in. Both photos are still dropped straight away and never stored.
- **Honest limits:** this is not blink detection or face matching. A photo that someone moves by hand, or a video played on another screen, can still pass. It does not check who the person is. Real anti-spoofing needs a native liveness SDK.
The look stays the same apart from one short line: "Hold still and look at the camera…".

## 5. Full test report (run after approval)
- **Database tests (throwaway accounts, fully rolled back), with PASS/FAIL printed per case:** the 50 cap across contract + Deep Focus + habits + top tasks combined; each coin value (contract 20, recovery 2, Deep Focus 10/10/15, 4AM 10, priority 3, custom clamped 1–5, Focus Music 0); each milestone 7/21/100/290/365 paying once, with a second claim paying 0; the new insufficient-streak refusal; goal at 17,999 → 99%, at 18,000 → 100%; 4AM selfie refused at 3:59 and 4:30 (a server check using a fixed test time).
- **Coach:** real calls to the Coach with "What is a contract?" and "How does the Goals feature work?", showing the full answers word for word.
- Results go into `/mnt/documents/AXEN_Economy_Test_Report.md` and are summarized in chat.

## Technical notes
- One migration: create-or-replace `claim_streak_milestones` with a `real_streak(uid)` helper (search_path '', not callable by anon). Server-only review for `recalc_goal` and `apply_daily_penalty` if the check fails.
- `wake-selfie.functions.ts` accepts `frames: [a, b]`. It runs person detection on both and compares frame size and bytes as a basic check that the frames differ. The client-side motion score is used only to decide when to enable capture.
- Nothing is published.
