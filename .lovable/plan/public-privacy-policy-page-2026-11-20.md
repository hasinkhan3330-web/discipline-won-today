# Public /privacy-policy page

## Goal
axonhabit.app/privacy-policy opens for everyone (no sign-in) and shows a full privacy policy. Nothing else in the app changes; the existing /privacy and /terms pages stay as they are.

## Page content (AXEN by NEXT AI, contact support@next-ai.app, dated today)
1. Who we are
2. Account & login data — email, display name, profile photo; Google Sign-In shares name, email and photo only; passwords stored hashed by our sign-in provider.
3. Alarms & Wake Protocol — alarm times, repeat days, timezone, solve results; alarms are scheduled on your phone; offline solves are saved on the phone and sent when you're back online; no answer keys stored on the device.
4. Notifications — alarm and reminder notifications, exact-alarm and notification permissions, can be turned off in phone settings.
5. Coins, streaks & rewards — calculated on our servers; daily coin decay; leaderboard shows display name only, never email.
6. Payments — Google Play Billing and RevenueCat; we never see card details.
7. Other data — partner/accountability sharing, proof photos (private, visible to an active partner only), AI coach messages and voice (processed by Google Gemini), camera photos checked by Roboflow.
8. Data storage & security — encrypted connections, access rules per user.
9. Your rights
10. Account deletion — how to request (email support@next-ai.app from your account email, subject "Delete my account"); deleted within 90 days, payment records kept as law requires.
11. Children — not for under 13.
12. Changes & contact

## After building
I'll check the page loads in the preview without signing in, then you click Publish so it goes live on axonhabit.app.

## Technical details
- New route `src/routes/privacy-policy.tsx` (public, outside `_authenticated`), reusing the same legal page layout/styling as `privacy.tsx` (copy the shell locally; don't edit privacy.tsx).
- head(): title "Privacy Policy — AXEN Habit & Discipline", description, canonical https://axonhabit.app/privacy-policy.
- No database, auth or other route changes.

## Note
The Android Google sign-in fix from earlier is paused and can follow as a separate step.
