# AXEN Command Center Home

## Goal
Restyle and reorganize only the existing Home screen into a calm graphite-black command center with electric-lime accents, matching the current You and Stats visual language.

## Build
- Add a Home-only visual system using Sora headings, Manrope body text, matte graphite surfaces, off-white text, fine dividers, and lime status accents.
- Recompose the existing Home content in this order: AXEN header and live coin balance; Today’s Discipline summary; Today Missions; Streak & Shields; Reminders; Deep Focus System; Focus Music.
- Keep every live value and existing action wired to its current handler: habit completion, scan verification, shield details/purchase, reminder editing and notification permission, focus tier selection, lock setup, session completion, and focus music controls.
- Expose the existing Deep Focus and Focus Music actions through the new primary buttons without changing their timer, lock, audio, or reward logic.
- Leave the six-item bottom navigation unchanged, with Home active.

## Technical details
- Update only Home presentation files and Home-scoped styles; no database, API, authentication, reward, timer, reminder, or navigation changes.
- Reuse the current `ShieldCard`, `RemindersCard`, `DeepFocus`, and `FocusMusicPanel` components, adding presentation props only where needed to connect the new Home controls to their existing internal actions.
- Preserve empty, loading, active-session, setup, and completion states.
- Verify at the current 360×645 phone size and a wider mobile size for 44px touch targets, safe-area spacing, horizontal overflow, button behavior, and console errors; then run typecheck and production build.
