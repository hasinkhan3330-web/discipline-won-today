# Remove Alarm Readiness + Milestone Journey from 4AM Protocol

Only the circled area changes. Nothing else.

## Change
- Remove the whole **Alarm Readiness** block (Notifications, Push subscription, Overnight Mode, Phone volume, the three buttons and the warning text).
- Remove the whole **Milestone Journey** block.
- After that, the existing **I'M AWAKE** button and **Save protocol settings** sit right below Evening Plan / Math difficulty, with no gap. Both keep working exactly as now.

## Kept exactly as is
4AM Protocol header, wake time tiers, countdown, metrics, Sleep Goal, Wake Reminder (alarm time, on/off, repeat), Evening Plan, Math difficulty, alarm ringing and rewards, all styling and colours.

## Technical details
- `src/components/WakeProtocol.tsx`: delete the `<WakeReadiness onReady={setReady} />` line and the `<section className="wakep__journey">` block. Remove only imports that become unused (`WakeReadiness`, `Sparkles`, `MILESTONES` if unused elsewhere). `WakeReadiness.tsx` file itself left untouched.
- The `ready` state stays (still read by the countdown line); it simply keeps its default value. No CSS, logic or other files changed.
- Verify: typecheck/build clean, and a 360px screenshot showing I'M AWAKE directly under the settings.
