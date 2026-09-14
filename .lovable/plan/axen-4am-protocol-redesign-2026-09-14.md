# AXEN 4AM Protocol Redesign

## Scope
Redesign only the existing wake protocol experience opened from the Wake Up mission. Keep the dashboard route, six-item bottom navigation, alarm verification, account data, streaks, rewards, reminders, and all other AXEN pages unchanged.

## Build
- Extract the current inline wake setup into a focused `WakeProtocol` component using the existing handlers and account state.
- Apply the requested pre-dawn palette and typography through wake-scoped semantic tokens only.
- Add the animated horizon, selectable 4AM–7AM tiles, next-window countdown, metric row, milestone journey, and collapsible Sleep Goal, Wake Reminder, and Evening Plan sections.
- Keep ringtone and verification-mode controls inside the relevant collapsible areas without placeholder controls.
- Make “I’M AWAKE” save the selected wake plan and perform the existing idempotent daily check-in; show loading, error, already-complete, and “DAY SECURED” success states.
- Load the user’s current wake alarm/session data for accurate reminder state, day number, metrics, and completed-today status.
- Preserve the timed full-screen challenge and existing server-side duplicate protection.

## Technical details
- Use the installed Motion library (`motion/react`) with transform/opacity animations only and reduced-motion support.
- Reuse `save_wake_plan` and `complete_wake_protocol`; no destructive database changes.
- Keep native/local alarm scheduling and ringtone preview behavior.
- Scope all new CSS to the wake screen, with 44px controls, safe-area spacing, and no horizontal overflow.

## Verification
- Run type checks and production build.
- Test authenticated mobile rendering and interactions at 360px and 430px: wake selection, collapsibles, reminder/time, save/check-in, success/error handling, close behavior, and unchanged bottom navigation.
