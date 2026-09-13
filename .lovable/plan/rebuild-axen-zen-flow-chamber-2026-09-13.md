# Rebuild AXEN Zen Flow Chamber

## Build
- Replace only the existing Zen page with the supplied mobile reference: AXEN header, live coin balance, Breath/Sound/Body controls, duration/settings controls, four phase indicators, full animated chamber, synchronized breathing timeline, quote, controls, intensity, cues, soundscape, and session summary.
- Remove the current Buddha/golden meditation artwork from Zen. Keep the existing six-item bottom navigation unchanged with Zen active.
- Add a reusable Canvas 2D `NeuralWaveCanvas` that renders deterministic cyan/blue/violet contour waves, depth layers, restrained bloom, particles, and one orbital arc around a readable center. It will resize for device pixel ratio and fully clean up its frame and resize listeners.
- Add Theta Calm, Alpha Flow, Beta Focus, and Gamma Clarity as visual presets that only adjust animation speed, density, amplitude, and color balance.

## Session behavior
- Replace the drifting one-second interval with one `performance.now()` session clock shared by timer, 4–4–4–4 breathing state, ring scale, phase indicators, timeline dot, wave motion, particles, and cues.
- Make 5/10/15/20-minute sessions exact, with millisecond-accurate pause/resume and correction after tab inactivity. Pausing freezes the entire experience without restarting.
- On completion, stop motion and audio, show `SESSION COMPLETE`, persist completion once through the existing meditation task/reward flow, update the existing session totals, and reset smoothly to idle without duplicate XP.
- Restart clears the current session to its selected duration and initial inhale state without awarding anything.

## Controls and sound
- Preserve all existing meditation audio URLs and track selection. Audio starts only after a user action, follows pause/resume, loops through the session, supports volume, and drives the equalizer only while playing.
- Add working haptic, soundscape, settings, intensity, and eyes-closed-cue controls with accessible 44px targets, labels, pressed states, focus styles, and safety copy in settings.
- Use real coins and existing meditation totals; show 91 only if no balance is available. No new coin, XP, profile, auth, or routing system will be introduced.

## Technical details
- Add `src/components/NeuralWaveCanvas.tsx`; rebuild `src/tabs/ZenTab.tsx` and `src/hooks/useMeditation.ts`; update only Zen-specific styles and pass the existing coin value into Zen from the dashboard.
- Use the installed Motion package plus CSS for sheets and control transitions; no video, static wave image, Three.js, or heavy new dependency.
- Honor reduced motion by simplifying particles and travel while keeping timing accurate.

## Verification
- Verify TypeScript and the production build.
- Test at 320px, 360px, and 480px widths for visual match, no horizontal overflow, fixed navigation, and accessible controls.
- Exercise start, pause, resume, duration, restart, presets, intensity, haptics/cues, sound selection, volume, and simulated completion; confirm a completion cannot award twice and no console errors occur.
