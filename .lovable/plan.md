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

---

# Batch — Partner nudges aur cheers save karna (additive backend)

"Home" = You tab ke andar Accountability Home. Scoring, streak, trust, coins, achievements, auth, baaki tabs, existing tables/columns aur Hinglish texts bilkul same.

## Abhi kya hai (check kiya)
- Nudge / emergency / "Aaj ka task kiya" → `send_accountability_nudge(_connection_id, _kind, _message)`; ye pehle se `accountability_events` mein row likhta hai. Mute (`muted_by_user/partner`), limits (3 per contract, 10/24h) aur 5 preset texts server par check hote hain.
- Cheer → `acct_send_cheer(_kind)` (fire/clap/muscle), `acct_cheers` mein row, din mein ek baar per kind.
- "Mute nudges" = `accountability_connections.muted_by_*`.

## Naya table `partner_events`
| column | type | note |
|---|---|---|
| id | uuid pk default gen_random_uuid() | |
| connection_id | uuid not null | extra column (aapki list se zyada): isi se Remove/Block ke baad history chhupegi |
| from_user | uuid not null | plain uuid, auth.users par FK nahi (project rule) |
| to_user | uuid not null | |
| kind | text not null, check in ('nudge','cheer','emergency') | |
| text | text not null | bilkul wahi preset text jo bheja gaya |
| created_at | timestamptz not null default now() | |
| seen_at | timestamptz null | |
Index: (to_user, created_at desc), (from_user, created_at desc).

Grants: `authenticated` ko sirf SELECT aur `UPDATE (seen_at)` column-level — **INSERT nahi**; DELETE kisi ko nahi; `service_role` ALL; anon kuch nahi.

## RLS policies
1. **Select** — `auth.uid() in (from_user, to_user)` AND `connection_id` abhi bhi `status='active'` connection hai jisme dono parties hain. Remove/Block ke baad dono taraf history gayab (data delete nahi hota).
2. **Insert** — koi grant nahi, koi policy nahi. Rows sirf SECURITY DEFINER triggers banate hain, isliye limits aur mute rules bypass nahi ho sakte.
3. **Update** — sirf `to_user = auth.uid()` aur active connection; column grant ki wajah se sirf `seen_at` badal sakta hai.
4. **Delete** — koi policy nahi → users delete nahi kar sakte.

## Send path kaise badlega
Existing functions **nahi** badlenge (parameters, return value, behaviour, limits, mute sab same). Iske bajay do naye AFTER INSERT triggers (SECURITY DEFINER):
- `accountability_events` par: jab `kind in ('nudge','emergency')` → `partner_events` row (text = stored message). `checkin`/`commitment` save nahi honge.
- `acct_cheers` par: har nayi cheer → `partner_events` row (kind 'cheer', text = 🔥 / 👏 / 💪). Duplicate cheer (ON CONFLICT DO NOTHING) par row nahi banti, to double entry nahi.
Isliye mute, limits aur "partner nahi" wale rules automatically lagu rehte hain, aur Remove/Block ke baad naye sends existing functions hi rok dete hain. Trigger ka history insert `BEGIN … EXCEPTION WHEN others THEN RAISE WARNING … END` mein wrapped: history save fail ho to warning log hoti hai aur original nudge/cheer phir bhi successful rehta hai.

## UI
- **Check-ins → "Recent"**: last 30 din, newest first; kind icon, text, time ("2h ago"), unread dot; emergency coral. Empty: "Abhi tak koi nudge ya cheer nahi". Loading skeleton, error + "Try again".
- List khulte hi mere received unseen items par `seen_at = now()`.
- **Accountability Home partner card**: unread count badge; agar maine nudges mute kiye hain to badge nahi (history phir bhi dikhegi).
- Sending buttons send ke dauran disabled (double send nahi).
- Remove/Block ke baad list khaali, send buttons pehle jaise band.

## Testing
- Koi test account nahi banega. Policies SQL se ek transaction ke andar test hongi jo end mein ROLLBACK hota hai (stranger read nahi kar sakta, recipient sirf seen_at badal sakta hai, insert/delete blocked, trigger failure send ko nahi rokta). Kuch bhi permanent nahi banega.
- Aapke account se koi real nudge ya cheer nahi bheja jayega.
- UI: 360/390/414px, Dark + Simple; Recent list ka empty/loading/error state aapke account par (bina bheje).

## Live par asar
- Database change (naya table, policies, triggers) apply hote hi **live app par turant** lagu ho jayega — preview aur live ek hi database use karte hain. Live users ke liye iska matlab sirf itna: unke nudges/cheers ab history mein bhi save honge; unhe kuch naya dikhega nahi.
- Recent list aur badge (screen changes) live users ko **Publish ke baad** hi dikhenge.

## Order
Sirf ye backend batch + Recent list/badge. Batch 2 (Check-in, New pact, Check-ins restyle) aapke kehne tak shuru nahi hoga.
