# Deep Focus visual redesign

## Scope
Redesign only the three existing Deep Focus states inside the current focus flow:
1. App block list
2. Lock setup
3. Active lock

All timers, rewards, leaderboard points, lock modes, app toggles, custom apps, audio tracks, playback, volume, loop behavior, session recovery, and completion logic remain unchanged.

## Visual direction
- Deep black-navy focus cockpit with a faint technical grid
- Compact frosted surfaces with thin cyan holographic borders and rare violet edge accents
- Red reserved for emergency-exit danger states
- Technical mono typography, calm spacing, and no oversized cards
- Subtle edge drift, status pulses, selection transitions, and countdown motion with reduced-motion support

## Implementation
- Replace the inline visual styling in the setup and active states with scoped Deep Focus classes.
- Add a compact duration selector using the existing three focus tiers.
- Present strict and flexible modes as equal holographic selection plates.
- Restyle Social, Games, Messaging, Video Streaming, and Custom as dense frosted app groups with cyan toggles.
- Add a concise block summary and biometric-style start control while preserving the existing start handler.
- Recompose the active view around the existing countdown ring, Mentor Mode eagle, reward tiles, Frequency Hub, loop/volume controls, and strict/flexible status.
- Add scoped styles and animations without changing other AXEN screens.

## Validation
- Verify setup controls, mode selection, duration changes, app toggles, custom app entry, session start, audio selection, loop, volume, and flexible exit.
- Check mobile layouts at 360px and 430px for safe areas, 44px controls, no overlap, and no horizontal overflow.
- Confirm reduced-motion behavior and run the project checks.
