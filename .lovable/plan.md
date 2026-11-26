# Workout photo proof with AXEN_PROOF_ENGINE (+10 coins)

Scope: only the Workout task's verify flow. AI Coach, its Gemini key, other tasks, design, sign-in, checkout and alarms stay untouched.

## What the user sees
1. Tap Workout -> small sheet: pick Gym / Pushups / Home Workout / Running / Yoga or type your own.
2. "Verify & Complete Workout" -> opens the live camera only (no gallery picker).
3. Photo is shrunk on the phone (max 600px wide, JPEG 70%) and checked in about a second.
4. Verified -> Workout marked done, +10 coins, streak/leaderboard update as today.
5. Rejected -> shows the AI's one-line reason; one retry allowed within 60 seconds.

## Technical details
- New server function `verifyWorkoutProof` (project uses server functions, not Edge Functions), signed-in users only. Reads only the `AXEN_PROOF_ENGINE` secret, calls `gemini-2.5-flash` with your exact auditor prompt and JSON-only output. Coach keeps its own key.
- Reward is decided on the server only after Gemini says verified: one new database function awards +10 coins through the existing coin ledger, once per user per local day (no replay), and completes the Workout task through the existing completion path so streak/leaderboard work unchanged.
- Daily cap: I could not find an existing 50-coin daily cap in the code. The new function will refuse the +10 if the user already earned 50+ coins today (counted from the existing ledger); no other reward is changed.
- Retry limit (1 retry / 60s) enforced on the server too, not just the screen.
- Camera: `<input type="file" accept="image/*" capture="environment">`. Note: some Android/iOS browsers may still offer a gallery option; this is a browser limitation, so the AI prompt also rejects screen/old-looking photos.
- Files: new workout proof sheet component, new server function file, one migration (function + small attempts log), small hook in the existing Workout verify entry in TaskVerify. Existing GPS/scan options stay.
- Test: rule test for +10 once/day and the 50 cap.
