# Phase 2 of 8 — Today's Contract (plan only, nothing changed yet)

## 0. Gates (please confirm)
- Phase 1 verdict: **PASSED**. All 16 security checks pass on the live database.
- Branch: the editor runs on a branch Lovable manages (`edit/edt-0dea…`), not `feature/verified-discipline`. I can't switch branches or make commits myself. Lovable saves each change as its own checkpoint.
- Database: the only one this editor can change is the **live** one. Phase 1 went there because you chose that. Your separate test database can't be changed from here.
- If you approve this plan, Phase 2 also goes on live, with all changes additive only. If you don't, Phase 2 is **BLOCKED**.

## 1. What already exists and gets reused
- **Home screen:** `src/tabs/HomeTab.tsx` (167 lines). The card goes in **one new spot**: between the "Today's Discipline" panel (the one with the Start Deep Focus button) and "Today Missions". Nothing on Home is removed or moved.
- **Look and feel:** the existing `AX` colours, `cardStyle()` and `titleStyle` from `src/tabs/styles.ts`, and the `EmptyState` component. No new colours or global CSS, and no Tailwind or theme changes.
- **Pop-up window:** follows the same full-screen overlay as `TopThreeModal`: fixed, `zIndex 300`, the same dark backdrop, and a sheet anchored to the bottom that respects the phone's safe areas. No new pop-up system.
- **Goals and the signed-in user:** goals are read with the existing browser client, `supabase.from("goals").select("id,title,…")`. That list is limited to the signed-in user by existing rules. The user comes from the existing session. No new database client.
- **Phase 1 contract data:** `daily_contracts` already has the rules this phase needs:
  - `dc_insert_own` and `dc_update_own_editable` limit users to their own drafts and scheduled contracts.
  - The `guard_contract_fields` trigger:
    - makes the owner the signed-in user;
    - checks the timezone;
    - works out the local date from the scheduled time and timezone on the server;
    - checks the linked goal belongs to the user;
    - rejects times in the past and any change to server-only fields;
    - only allows valid status changes.
  - `dc_one_primary_per_day` allows one main contract per user per local day.
  - Deleting contracts is not possible for users.
- **No new server functions.** Creating and editing go through these existing, already-tested rules directly.

## 2. Gaps in Phase 1 (proposed small migration, shown here, not applied)
1. **Cancel:** there is no "cancelled" status. Also, the one-per-day rule counts every contract, so a cancelled contract would block making a new one that day.
2. **Reminder preference:** there is nowhere to store it.

```sql
ALTER TYPE public.contract_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TABLE public.daily_contracts
  ADD COLUMN IF NOT EXISTS reminder_pref text NOT NULL DEFAULT 'standard'
  CHECK (reminder_pref IN ('none','standard','early'));
DROP INDEX IF EXISTS public.dc_one_primary_per_day;
CREATE UNIQUE INDEX IF NOT EXISTS dc_one_primary_per_day
  ON public.daily_contracts (user_id, local_day)
  WHERE is_recovery = false AND status <> 'cancelled';
-- guard_contract_fields: users may also move draft/scheduled -> cancelled (final; can't be undone),
-- and the insert/update rules above accept 'cancelled' only as a new status.
```

Cancelled rows are kept for history and never deleted. Reminder preference is only stored for now; reminders themselves come in Phase 5.

## 3. Files
- **New:** `src/components/verified/ContractCard.tsx`
  - shows all states: loading, empty, draft, scheduled, and read-only views of active, awaiting proof, completed, missed and cancelled;
  - handles errors: offline, permission denied and "try again".
- **New:** `src/components/verified/ContractSheet.tsx`
  - the create/edit form, then a review step, then an explicit Confirm;
  - offers fixed suggestion templates, which can be edited and never change the goal;
  - partner accountability is shown switched off with "Coming soon".
- **New:** `src/lib/verified/contracts.ts`
  - types, form checks and the fixed templates;
  - timezone handling, and turning database errors into plain messages (for example, "already have a contract today").
- **Edited:** `src/tabs/HomeTab.tsx`, **one import and one line** to place the card.

The card is kept separate from shared components so a mistake can't affect other screens.

## 4. Behaviour
- **Fields:**
  - title (3–120 characters)
  - category: study, work, workout, meditation, reading or other
  - date and time, plus the phone's timezone (checked on the server)
  - planned length (5–360 minutes)
  - rescue length (1 minute up to the planned length, capped at 60)
  - optional cue and optional private note
  - how you'll prove it: timer, recall, checklist or photo
  - difficulty (1–5)
  - reminder preference
- **Start contract:** the button is disabled, with the note "Focus integration arrives next phase". It never shows a fake success.
- **Reschedule:** changes the date and time. The server then recalculates the local date, and if that clashes with another contract you get a clear message.
- **Cancel:** asks you to confirm first. There is no delete.
- **Double taps:** buttons lock while saving, and the one-per-day database rule backs this up. "Saved" only appears after the database confirms.
- **No optimistic updates:** the card only changes after the database confirms.

## 5. Tests (on live, using temporary test accounts and data that is always undone)
- **Database checks:**
  - linked and unlinked contracts;
  - length and title limits;
  - duplicate day rejected, and allowed again after cancelling;
  - the day changing across midnight in the user's timezone, including a clock-change (DST) date in a zone like America/New_York;
  - reschedule across a date boundary;
  - cancel works and delete is denied;
  - user A can't see or change user B's contracts;
  - server-only fields rejected.
- **In the preview at phone sizes (360 and 390 wide):**
  - empty, then create, then review, then confirm, then scheduled;
  - double tap creates one contract;
  - offline shows an error with "Try again";
  - expired sign-in shows a permission message.
  - I'll check that Home, missions, Deep Focus and navigation look unchanged, that there are no console errors, and that the app builds cleanly.
- **Real contract rows:** the preview can sign in as your account. Any contract created there during testing is cancelled afterwards; contracts can't be deleted.

## 6. Rollback
- **Screen:** remove the one line from HomeTab, which hides the feature completely. Or restore the checkpoint from before Phase 2.
- **Database:**
  - drop the `reminder_pref` column;
  - put back the original one-per-day rule and the original guard;
  - the extra 'cancelled' status value stays but is harmless.

## 7. Risks
- The work happens on the live database, and approval replaces the separate-test-database requirement.
- Clock-change (DST) handling depends on the phone reporting the right timezone. The server checks it.
- Status names are fixed in the database. Adding 'cancelled' can't be undone, but it's harmless.
