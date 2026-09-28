# Remove wake face verification

## Result
Keep the current ultra-futuristic Wake Protocol and alarm screens unchanged, but remove the camera/selfie requirement completely and restore the previous math/science challenge flow.

## App changes
- Remove the Wake Selfie screen and its server-call module.
- Reconnect Wake mission taps and Profile habit completion to the existing Wake Protocol screen.
- After a correct alarm challenge, use the prior authenticated wake-completion call instead of opening the camera.
- Keep tiers, ringtone choices, alarm scheduling, challenge modes, styling, navigation, and unrelated rewards unchanged.
- Update Coach wording so it describes the math/science alarm challenge, not a selfie.

## Backend change requiring the existing approval gate
- Restore the previous authenticated, idempotent `complete_wake_protocol` behavior so a solved challenge can mark the Wake task complete and award the existing wake reward once per day.
- Remove authenticated use of the obsolete selfie-only path; keep historical migration files unchanged.
- Apply no backend change until its exact SQL has been shown and approved.

## Verification
- Confirm no camera permission or selfie screen appears from Home, Profile, manual check-in, or scheduled alarm completion.
- Confirm the futuristic Wake Protocol layout remains unchanged.
- Confirm math/science challenge, ringtone, save, scheduling, and once-daily completion behavior.
- Check mobile layout, console errors, and the current build status.
