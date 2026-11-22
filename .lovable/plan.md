# Restore UI to last known-good version

Baseline: commit 70804e6 (Nov 15). Your screenshots match it: My Journey shows Nov 15, plus All Ranks, the wake mission sheets and the black/lime/violet look.

## What I found
- The only change since then that altered the whole app's look was the "Simple is the default" theme setting. It was already reverted in `src/lib/theme/theme.tsx` (new visitors now get Dark).
- The Dark/Simple switcher (`AppearanceSwitcher.tsx`) is unchanged since the baseline and still offers both options.
- Every other screen file changed since Nov 15 holds requested features you asked to keep (5-habit message, send_nudge/get_nudge_suggestions, Accountability batches, Coach fixes, alarms). None is a redesign.

## Files to revert
- None. Reverting any of the files below would remove a kept feature without bringing back any old look.

## Files deliberately kept, and why
- src/lib/theme/theme.tsx: already matches the baseline except the Dark default you want.
- src/styles.css: only adds the Home "My Plan" pill. Existing styles unchanged.
- src/tabs/HomeTab.tsx, GoalHabitPicker.tsx: My Plan shortcut and the 5-habit message.
- src/components/verified/AccountabilitySection.tsx, acct/*: Accountability batches plus send_nudge/get_nudge_suggestions.
- coach-orb.module.css, CoachOrbScreen.tsx, AiCoach.tsx: tap-blocking fix and the "Plan my tomorrow" chip.
- WakeProtocol.tsx, wake/*: native alarms and offline coins-pending line.
- routes (privacy-policy, terms, join, dashboard, my-plan), ProfileTab/ProfileDetailScreens: Aevonix contact text and features.

## Verification step (build mode)
- Check Dark and Simple render and switch at 390px on the signed-out pages. Signed-in tabs need your account on a phone: after Publish, open Home → Command Center → Appearance and tap Dark.

No database changes.
