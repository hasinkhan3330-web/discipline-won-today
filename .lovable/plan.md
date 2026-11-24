# Alarm 07:30 cutoff — ring/vibration band (sirf alarm cutoff)

Coins ka 07:30 cutoff server par pehle se laga hai (0 coins, 0 XP). Ab sirf ringing aur vibration ko 07:30 par band karna hai. UI, Repeat Daily, rewards, database aur packages kuch nahi badlega.

## Abhi kya hota hai
- Android phone par alarm ek main notification + 30 follow-ups (har minute) schedule karta hai, yani 07:20 ka alarm 07:50 tak bajta reh sakta hai.
- Alarm screen khuli ho to har 5 second par server se check karke sound aur vibration chalta rehta hai, chahe 07:30 nikal gaya ho.
- App kholte hi agar alarm "ringing" ho to woh alarm screen par le jaata hai.

## Kya badlega
1. **Android schedule:** 07:30 (us din ka phone ka local time) ya uske baad wala koi bhi notification schedule hi nahi hoga. Toh app band ho, phone lock ho, tab bhi 07:30 ke baad sound/vibration nahi aayega.
2. **Alarm screen:** 07:30 hote hi sound band, vibration band, us alarm ke baaki notifications cancel, aur screen apne aap Home par wapas. Repeat Daily wala kal ka alarm waise hi rahega.
3. **Auto-open:** 07:30 ke baad app kholne par alarm screen dobara nahi khulegi.
4. **Coins:** pehle se server par band hain; kuch nahi badla.

## Test
- Naye tests: 07:29:59 par schedule/ringing chalta hai; 07:30:00 aur baad mein koi notification nahi, screen band. 07:20 alarm ke follow-ups 07:29 par ruk jaate hain. Repeat Daily ka agla din wala alarm safe rehta hai. Alag timezone (India) bhi check.
- Purane alarm/wake tests dobara chalaunga.
- Browser mein alarm screen ko fake time (07:29 aur 07:30) ke saath check karunga. Asli Android/iPhone par test main yahan nahi kar sakta.

## Honest limits
- **iOS:** app mein abhi native iPhone alarm hai hi nahi; iPhone par alarm sirf tab bajta hai jab app khula ho. Wahan 07:30 par screen band ho jayegi, par app band ho to iOS par pehle bhi alarm nahi bajta tha.
- **Android:** agar phone ka time/timezone user ne badla ho, to cutoff phone ke clock ke hisaab se hoga (coins phir bhi server ke hisaab se 0).
- Jo notification 07:29 par aa chuka hai, uski awaaz Android ke apne niyam se kuch second chal sakti hai.

## Technical details
- `src/lib/native-alarms-core.ts`: add pure `wakeCutoffAt(firingAt)` (same local date, 07:30:00) and filter in `buildSchedule` (`at < cutoff`); `activeOfflineFiring` also rejects firings past cutoff.
- `src/components/wake/AlarmScreen.tsx`: a timer to the event's cutoff calls `webAlarmScheduler.stopVerified()`, `stopAlarmHaptics()`, `markFiringSolved(firing)`, then navigates to `/dashboard`; ring only if before cutoff.
- `src/components/wake/WakeObserver.tsx`: skip `/alarm` redirect when past cutoff.
- Tests in `tests/native-alarms.test.ts`. No schema, server, UI-copy or dependency change.
