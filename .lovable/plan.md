# Accountability Batch 2 — Check-in, New pact, Check-ins (sirf Accountability)

Sirf Accountability ke 3 sub-screens ka look badlega. Backend, rules, streak/trust/coins, saved data ka shape, Hinglish nudges, bottom nav aur baaki tabs bilkul same rahenge. Dark aur Simple dono.

## Files jo badlengi
- `src/components/verified/acct/AcctScreens.tsx` — `CheckinScreen`, `PactCreator` (sirf dikhawat; `validatePact`, save row, EVIDENCE/REMINDER logic same)
- `src/components/verified/AccountabilitySection.tsx` — sirf `view === "partner"` (Check-ins) block
- `src/components/verified/acct/AcctUI.tsx` — naye chhote shared pieces: Timeline step (01–04), Segmented control, Stepper bar, Sticky action bar, Time picker sheet
- `src/components/verified/acct/acct.module.css` — naye classes, existing tokens hi

## Screen 3 — Daily check-in
- Numbered timeline 01–04, mono uppercase labels, navy rounded inputs, "30 sec" chip.
- Yes/Not yet aur Yes/I'm fine pehle se selected nahi (agar aaj ka check-in pehle se saved hai to wahi dikhega).
- Placeholders + counter (x/140). Save tab tak band jab tak dono sawaal ka jawab na ho; neeche chhota reason.
- Save = lime gradient pill. Save hone par chhota lime celebration + "your partner will see this", phir wapas.
- Partner today card + 3 cheer buttons, bheje gaye ka "Sent" state (session ke liye).
- Streak count-up: check-in streak is screen ke paas nahi hai — real data na ho to nahi dikhaunga (Batch 1 rule).

## Screen 4 — New pact (3 steps)
- Header mein 3-segment lime stepper; sticky "Next →" bar bottom nav ke upar; disabled ho to wajah neeche.
- Step 1: timeline fields with placeholders/examples; category chips icon ke saath (Study, Work, Workout, Meditation, Reading, Creative, Other — sirf jo categories code mein already hain); Today/Tomorrow segmented; native date-time ki jagah custom picker ("Tue 17 Nov · 7:45 PM", 12-hour, +30m/+1h/+3h chips); session length stepper + presets 15/25/30/45/60 (5–240 limit same); live summary card; inline error `validatePact` se hi.
- Step 2 aur 3: same fields/options, naya style.
- Step 3 ke end mein "REVIEW" contract card (title, time, length, evidence, partner/visibility, reminder).

## Screen 5 — Check-ins
- "Daily check-in" lime primary button; dono ka aaj ka status (me lime, partner violet) — partner ka existing check-in status call se.
- Partner's week: existing "streak · tasks" line styled. 7-din bar chart **nahi** — per-day data existing queries mein nahi hai (real-data rule).
- "Our contract" card: textarea, counter, Save sirf change par, "Saved" state; partner ka text violet bubble.
- Nudges: wahi 5 texts word-for-word, intensity groups (Gentle / Push / Hard) icon ke saath; toast existing `send` se.
- Emergency nudge coral outline + alert icon, bhejne se pehle confirm dialog.
- "Aaj ka task kiya" clear action button, done/not-done states, behavior same.

## Check
360/390/414px, Dark + Simple: horizontal scroll nahi, console errors nahi; pact save aur check-in save test account par; typecheck/build.

## Technical details
- Pickers `datetime-local` string format (`toLocalInput`) hi set karte hain, isliye `validatePact` aur insert row unchanged.
- Check-in save payload same; sirf UI-level "unanswered" state (`null`) jo save ke waqt boolean ban jaata hai.
- Koi naya table, RPC, dependency ya global CSS nahi.
