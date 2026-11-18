# Accountability Batch 4 (short)

Scope: Accountability (You tab) plus ONE new public page `/join/$code`. No changes to scoring, streak, trust, coins, partner_events, pairing logic, auth or other tabs. No new dependency, no new table, no new policy, no migration.

## What was checked
- Invite codes are made by the existing `mkInvite` and applied by the existing `doAccept({ code })` (accountability.functions.ts). Today's share link is `/dashboard?acct_code=CODE`, which pre-fills the code box; the user still taps Join.
- Pair-streak milestones are already remembered in the existing `acct_milestones_seen` table (per account, not per device).
- The Android app loads axonhabit.app inside the app but has no link handler, so a `/join` link opens in the phone's browser, not in the installed app.

## Build
1. **Home priority** — one top card chosen in this order: missed pact (Recovery card with Comeback, or Reschedule opening New pact pre-filled with the old title/minutes) > pact due today > check-in due > unread partner cheer > garden. Empty states show one next action only. Display order only; same data as now.
2. **Cheer after check-in** — on the saved state, one "Cheer partner" button using the existing cheer send. Hidden with no partner.
3. **Partner quiet 48h** — if the partner's latest check-in timestamp already loaded is older than 48h: gentle, no-blame card with dismiss (remembered on the device per partner per day). Hidden if timestamp not available.
4. **Invite** — reuse existing code. "Invite on WhatsApp" (Web Share, wa.me fallback) and "Copy link", with an editable supportive Hinglish message + link `https://axonhabit.app/join/CODE`. Message edits stay on the device only.
5. **`/join/$code` (new public route)** — one line about Axen, one "Log in / Sign up" button. Logged-out: shows nothing private, never checks the code. Code is kept in sessionStorage (existing `axen.acct.code` key) and after login the user lands on Accountability where the existing `doAccept` is called once automatically. Any failure (invalid, used, expired, own code) shows one friendly generic message. noindex.
6. **Share cards** — drawn on a canvas on the device, 1080x1920 and 1080x1080, for weekly recap and streak milestone: "AXEN", axonhabit.app, real numbers already loaded (pair streak, check-ins this week, garden stage). Never proof or pact titles. Partner first name only when the new "Include my partner's first name" switch is on (off by default, saved on the device). Web Share with file, fallback download.
7. **Milestone sheet** — pair streak 3/7/14/30 and garden stage-up; dismissible, once per milestone, remembered on the device (localStorage). The existing pair-streak record in `acct_milestones_seen` keeps being written as today, so it is not shown twice.
8. **Solo** — users with no partner get an "Invite a partner" card (opens item 4).

## Technical details
- Files: `AccountabilitySection.tsx`, `AcctScreens.tsx` (cheer after check-in), `acct.module.css`, new `acct/ShareCard.ts` (canvas), new `acct/home-priority.ts` (pure picker + vitest), new `src/routes/join.$code.tsx`.
- Device keys: `axen.acct.quiet.<partner>.<date>`, `axen.acct.ms.<kind>.<n>`, `axen.acct.share.partnerName`, `axen.acct.inviteMsg`.
- Auto-join after login reuses the existing `acct_code` reader; only change is calling the existing `join()` once when a code came from `/join`.
- Verify with Playwright, writes blocked; `/join` checked logged-out only.

## Not possible without extra work
- Opening `/join` inside the installed Android app needs a link handler in the Android app plus a site verification file, and a new app build. Not included.
