# AXEN Production Upgrade Plan

## Scope guard
- Upgrade only first-time onboarding, membership, 4AM Challenge, AXEN Coach, Focus Music, and Reminders.
- Preserve Home, Rank, Stats, You, Zen, authentication, uploaded media, routes, coins/XP, themes, and active subscriptions.
- Keep the existing six-item bottom navigation and current dashboard data contracts intact.
- Remove visible debug/test copy and duplicate presentation paths without removing the real RevenueCat/store entitlement pipeline.

## 1. Shared AXEN presentation layer
- Add scoped AXEN tokens for `#030711`, `#08101D`, `#0C1524`, off-white text, secondary blue-gray text, cyan/blue/violet accents, and thin borders.
- Apply these tokens only to the six upgraded experiences, with 16px mobile gutters, 44px controls, safe areas, no horizontal overflow, and reduced-motion fallbacks.
- Use lightweight CSS/SVG/canvas motion; retain existing app fonts and assets.

## 2. One-time onboarding and blueprint
- Replace the current four-slide walkthrough with the 12-question flow, progress, back navigation, optional-question skips, validation, loading/error/retry states, and directional transitions.
- Reuse `profiles` rather than creating another profile system. Add the requested answer fields plus resume position/version and safe-minor-mode state.
- Save each answer immediately for the authenticated user and resume at the last unfinished step.
- Separate the old pre-signup quiz completion from authenticated onboarding so normal signups no longer bypass the new flow.
- For under-18 selections, complete onboarding smoothly in safe minor mode: minimize personalization, disable unnecessary tracking/advertising signals, protect private answers, and keep the flow consent-ready without blocking the user.
- Build “Your AXEN Blueprint” from submitted answers only: weekly social time, clearly estimated reclaimed time, structured-day graph, milestones, and personalized recommendations.
- “Activate My AXEN Plan” atomically marks onboarding complete, creates the first habit only when it does not already exist, and opens Home. Add a reusable reset function for the existing Settings/Profile surface’s future “Retake AXEN Assessment” action.

## 3. Membership page, billing, and entitlement consistency
- Replace the visible paywall with the requested Basic vs AXEN Pro comparison, monthly/yearly selector, recurring-billing disclosure, Terms, Privacy, restore, manage, and Basic continuation.
- Keep RevenueCat, Google Play/App Store purchase sheets, webhook verification, server entitlement verification, restore, and lifecycle syncing.
- Read localized package prices from the active store offering when available; use ₹99/₹499 only as the web/non-store display fallback.
- Consolidate UI gating around the existing authoritative entitlement result so Home gates, Coach, Rank/Zen access, account status, and purchase refreshes cannot disagree.
- Remove hardcoded test/debug labels from the interface. Keep product configuration external; do not fake a successful purchase or frontend-only unlock.

## 4. 4AM Protocol
- Refactor the duplicated wake setup/verification presentation into one reusable flow while retaining current ringtone assets, local notification support, wake RPCs, Home wake completion, and coin/streak updates.
- Add the clean protocol view: current day, wake target, sunrise horizon, current/best streak, monthly consistency, sleep-time recommendation, check-in window, non-shaming recovery, milestones, and reminder status.
- Persist target, mode, tone, window, and sleep recommendation to the user’s existing alarm/profile data.
- Harden server completion: validate the saved alarm and allowed time window, prevent duplicate daily XP/coins, record attempts/sessions, preserve the chosen tone/mode, and support a missed/recovery state without negative credits.
- Reconcile native notification taps/app resume into the full-screen challenge; re-arm schedules safely. Keep browser notification behavior best-effort.
- Do not enable 4AM automatically from onboarding; only suggest or configure it when the user chose a relevant wake/focus goal.

## 5. AXEN Coach
- Keep the existing authenticated, Pro-gated AI service and voice capability, but redesign the requested focused chat experience with personalized greeting and action chips.
- Add private conversation/message tables with owner-only access, history loading, new/delete conversation, empty/loading/error states, and bounded message storage.
- Stream concise responses, enriched only with the user’s real onboarding and discipline data; maintain non-medical, non-shaming guidance.
- Return a safe structured suggested action alongside advice. “Turn advice into habit” and “Add to today’s plan” will use confirmation and existing task logic, with duplicate prevention and visible success/error states.
- Keep secrets server-side. Harden voice authentication so the long-lived provider key is not exposed in normal frontend code; retain graceful microphone/network failure handling.

## 6. AXEN Focus music
- Upgrade the existing Focus Music panel without breaking `DeepFocusHandle.openMusic()` or the separate Deep Focus lock/timer system.
- Provide 25/45/60/90-minute sessions, existing tracks, play/pause/previous/next, volume, loop, intensity, synchronized timer/progress, and a code-generated waveform that stops with playback and resets on completion.
- Persist an in-progress session locally for accurate pause/resume from the same timestamp and support background audio where the platform allows it; never autoplay.
- Add a server-owned completion function that validates elapsed time, writes to existing focus session/coin ledgers, and awards existing rank XP/coins once only. Show an end-session summary.

## 7. Reminders
- Keep the compact Home reminder block and upgrade the existing You/Profile reminder manager rather than adding a competing route.
- Extend `habit_reminders` for title, linked habit/goal, weekdays, repeat mode, sound, vibration, snooze, enabled state, scheduling status, and stable native notification IDs.
- Share one reminder service between Home and You so create/edit/toggle/delete updates both surfaces immediately.
- Add Today timeline, Upcoming, permission status, six active reminders above the fold, empty state, and complete controls.
- Schedule through Capacitor local notifications on mobile and the browser API where supported; store “scheduled” only after success, cancel old schedules on edit/delete/disable, preserve timezone intent, and reschedule on resume/device restart where supported.
- Align free limits with the membership page: Basic supports three reminders; Pro supports unlimited reminders. Repair access rules so Basic users can actually use their allowance.

## 8. Backend migration and safety
- Apply one additive, backward-compatible migration through Lovable Cloud: profile onboarding fields; reminder fields/indexes; private coach conversations/messages; wake/check-in metadata; and idempotent completion/action functions.
- Every new table receives explicit authenticated/service grants, RLS, owner-only policies, timestamps, uniqueness constraints, and validation. Existing rows remain valid.
- Do not edit generated backend types manually; regenerate through the migration flow.
- Add indexes for the user/date/status queries used by onboarding resume, coach history, reminders, wake history, and session summaries.

## 9. Integration and verification
- Add focused unit tests for onboarding calculations/validation, wake windows/idempotency, focus timing, reminder schedule generation, and entitlement display mapping.
- Run TypeScript and production builds after implementation.
- Use signed-in Playwright checks at 320, 360, 430, and 480px for onboarding resume/completion, blueprint calculations, Basic/Pro UI, wake check-in, Coach actions/history, focus synchronization, all reminder controls, safe areas, overflow, and console errors.
- Recheck unchanged Home, Rank, Stats, You, and Zen interactions plus authentication, coins, XP, subscription unlock/restore events, uploaded audio/images, and all six navigation buttons.
- Validate Android configuration and notification registration without changing package ID or signing settings.

## External setup that cannot be fabricated
- A live RevenueCat Android public key (`goog_…`), optional iOS public key (`appl_…`), matching store product IDs, and server webhook/secret configuration are still required for real store purchases. The app will surface a clean unavailable state until these are configured; it will never simulate Pro access.
- Exact killed-app alarm takeover behavior remains subject to Android/iOS notification and foreground-launch policies; the implementation will use the strongest supported local-notification/resume path without making impossible platform guarantees.
