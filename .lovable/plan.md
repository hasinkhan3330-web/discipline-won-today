# Coach tab: new orb design, visuals only

## What changes (Coach tab only)
- Remove the coach photo and its overlay, the old "Coach knows you" bar, the old voice card and the "Open text coach" bar.
- Hide the gold "SUBSCRIPTION ENDS" strip on the Coach tab only. Its date moves into the status pill. Other tabs keep the strip.
- Build the new screen from top to bottom, matching your reference: theme chips (Lime / Ice blue / Violet, saved as `axen-theme`), header with AXEN logo, keyboard button and status pill, particle orb with glow, the real "% Coach knows you" (tap opens Quick setup), status label, the three prompt chips, the "Talk to your coach" card with the mic button, and the existing bottom tab bar recoloured to the accent.
- The text coach opens as a dark bottom sheet from the keyboard button. Chat logic stays the same.

## What stays exactly the same
- Gemini Live session, its tools and setup, the text coach logic, the profile percentage calculation, Quick setup, the plan panel's data, subscription and auth logic, routing, the database and every other tab.

## Technical details
- New Coach-only files: `src/components/coach/orb/CoachOrbScreen.tsx`, `OrbCanvas.tsx` (a 1:1 port of the reference canvas math: 450 Fibonacci points, dpr capped at 2, smoothing `1-0.0015^dt`, f clamped to 1.1, paused when the tab is hidden, reduced motion respected), and `coach-orb.module.css` (the reference CSS values, scoped with CSS variables `--a/--b/--bg/--card/--pill/--muted/--line`). Manrope is loaded with a `<link>` tag.
- `VoiceCoach.tsx`: logic stays as it is. Add a small optional `onVoiceState(state, getLevel)` callback and two AnalyserNodes:
  - one on the existing mic source (no second `getUserMedia`)
  - one on the playback output
  
  Map the states from real Live events: mic on → listening, mic stop or turn start → thinking, first audio chunk → speaking, turn complete with the queue drained → idle. Expose `start`/`stop` and the percentage through the same component, using a headless render mode so the old card is not drawn.
- `AiCoach.tsx`: render `CoachOrbScreen` instead of the photo stage. Chips call the same `send(text)` and set the orb to thinking. The text chat moves into the sheet unchanged.
- Pill date comes from the same entitlement source as `AccountStatusStrip`, formatted DD Mon YYYY; it shows Expired · date or Free when there is no active subscription. The bottom nav receives an accent class only while the Coach tab is active.
- `CoachPlanPanel` stays reachable from the stat row through Quick setup and the existing plan flow, with no data changes.
- Verification: Playwright at 390x844 and 360x645 (no page scroll or overflow), theme switching and persistence, chip sends, sheet opens, stat opens Quick setup. Existing Coach tests rerun. Real mic and speaker levels on a physical phone will be reported as untested.
