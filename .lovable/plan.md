# AXEN First-Launch Assessment

## Scope

Replace only the existing pre-signup quiz with the attached reference-inspired first-launch journey. Preserve the AXEN boot sequence, existing login/signup, authentication, dashboard, navigation, all authenticated screens, subscriptions, rewards, and current app behavior.

## Experience

- Keep the current app boot animation, then show a full-screen mobile-first AXEN introduction for first-time visitors.
- Add the 10 requested questions with working Back/Next controls, validation, animated progress, compact glass choices, age and 1–10 selectors, and the custom habit field.
- Persist each answer locally as it is entered so an interrupted journey resumes at the same step.
- Keep an unobtrusive “I already have an account — sign in” path for returning users; authenticated users continue to bypass the assessment.
- After question 10, run the four staged analysis messages, followed by calculated result screens:
  1. Your Time
  2. Your Current Trajectory
  3. What Could Change?
  4. Your AXEN Profile and Starting Baseline
  5. Final “Enter AXEN” screen
- “Enter AXEN” closes only the first-launch layer and reveals the existing login/signup exactly as it is.

## Calculations and honesty

- Derive daily time loss from the selected phone, social-media, felt-waste, control, discipline, and procrastination answers using a documented deterministic formula.
- Derive weekly/yearly totals and reclaimable time from that daily estimate; never show invented personal measurements.
- Label results “Estimated — Based on your answers.”
- Label improvement visuals “AXEN scenario projection” and explicitly state that they are projections, not guaranteed results.
- Drive radial charts, trajectory graphs, comparison graphs, profile values, and the baseline score from those same answers.

## Visual direction

- Closely reproduce the reference’s compact portrait composition: near-black cosmic background, cyan/violet edge light, slim segmented progress, dense rounded glass option rows, technical labels, luminous number selectors, radial analysis graphics, dual trajectory panels, and cinematic screen transitions.
- Use AXEN’s existing logo, fonts, colors, tokens, and animation language so this addition feels native without restyling any existing screen.
- Keep all controls at least 44px, support phone safe areas, prevent scrolling where the reference is screen-sized, and disable nonessential motion when reduced motion is requested.

## Safe persistence

- Extend the existing pre-signup answer payload rather than altering authentication.
- Keep unfinished answers on-device before an account exists.
- After successful login/signup, securely copy the completed assessment into a dedicated user-owned backend record with row-level access; never expose another user’s answers.
- Mark completion locally for immediate one-time behavior and in the user-owned record for durable signed-in behavior across devices.
- Existing users remain able to go directly to sign-in; no authenticated app content or existing profile data is changed.

## Files and boundaries

- Rebuild only the isolated pre-signup assessment component and its scoped styles.
- Make the smallest necessary integration updates in the existing landing page and answer-persistence helper.
- Add only the backend storage required for these assessment answers, including grants and owner-only access rules.
- Do not modify existing dashboard, Home, Habits, Stats, You, Rank, navigation, billing, onboarding after signup, or any other feature.

## Verification

- Verify all 10 questions, validation, Back/Next, resume behavior, progress, analysis sequence, calculated values, graphs, final handoff to existing login, and returning-user bypass.
- Verify at 360px and 430px widths with no overflow or text collision.
- Verify reduced motion, refresh recovery, account sign-in handoff, and secure post-auth answer storage.
- Run the focused typecheck/build and confirm existing login and dashboard entry remain functional.
