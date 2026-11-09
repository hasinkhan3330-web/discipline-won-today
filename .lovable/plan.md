# Deep Focus restyle + remove Focus Music

## Values taken from your existing UI (Contract sheet, coin badge)
- Background `#05070A`; dot pattern: 1px dot of `#1C2342` at 78%, on a 22px grid.
- Card fill: deep navy `#10162D` to `#070A14`. Border: 1px `#232D52`. Text `#F6F7FC`, muted `#A9B0CC`.
- Lime `#B6F500` (bright lime `#D2FF3D`), violet `#8B5CF6`, gold `#F5A524`.
- Sheet: 32px top corners, grabber, 1px violet border at 45%, soft violet shadow, no blur.
- Steps: numbered circles with a 1px line between them (lime to violet). Mono caps labels at 9 to 10px.
- Coin amounts use the existing gold coin badge. Selected tiles and focused inputs get a 1.5px lime border with a light lime tint.
- Primary button: the Contract lime button with black text. Close X: the Contract's rounded-square button with a 1px border.
- Simple theme: white `#FFFFFF`, border `#E7E7E3`, ink `#111111`, black pill buttons.

Before coding, I'll read the remaining Contract button, switch and input rules and list the exact values. No new colors.

## 1. Remove Focus Music completely
- Home Deep Focus card: remove the "Focus music" row under Configure Lock.
- Home: remove the separate "Focus Music" card (25 min · 14Hz Beta), with no gap left behind.
- Delete the Focus Music popup, along with its state, the `openMusic` handle, the `onMusicReward` prop chain (Home, Deep Focus and the dashboard), its CSS block, the unused `focus-music` server function and the `beta14` audio file.
- Delete the Coach's knowledge line about Focus Music, so the Coach stops offering it.
- Keep the Frequency Hub tracks and the audio files they share (Battle Wave, 40Hz, etc.). Saved coin records stay untouched.
- Then search for "Focus Music", "Soundscape", "Start focus session" and "14Hz Beta". The only expected match is the unrelated Zen volume label "Soundscape volume", which isn't Deep Focus.

## 2. Dark restyle (only the Deep Focus screens)
New scoped stylesheet `deep-focus.module.css`, plus edits to the existing `df-*` rules only.
- Remove the square grid and use the dot pattern. Replace cyan everywhere with lime. Remove blur, glassy panels, text glows and shadow glows.
- Lock Setup is laid out like the Contract sheet: header label, title and close button; a summary strip with a gold coin chip; steps 01 to 03 with the numbered line; duration tiles and lock-mode cards in the selected/unselected style; app tiles with icon wells and lime switches; the dashed "Choose Apps" card; the info strip with "NO EXIT" in lime; and a lime confirm button with the lock icon in a dark circle.
- Focus Active: a navy status bar with a lime-outlined LIVE chip; a timer ring with a navy track, lime arc, round ends and no glow; white numbers; the eagle photo framed with a 1px border and 20px corners; reward tiles with the gold coin chip; and the Frequency Hub rows restyled with a lime playing marker, thin scrollbar, lime sliders and LOOP chip.
- The exit, complete and confirm dialogs follow the same card, button and sheet rules.

## 3. Simple theme
Scoped Simple rules for the same parts: white cards, hairline borders, black pill buttons and ink `#111`. No lime, cyan, purple, dots or glow. The eagle photo gets a rounded white-bordered frame. The Deep Focus parts are marked so the app-wide Simple recolouring doesn't fight these rules.

## 4. Unchanged
Timer, locking, strict/flexible modes, native plugins, the app picker logic, coins/points, the backend, sign-in, payments, page addresses, all text, and every other screen.

## 5. Checks
- Search the Deep Focus files for 00e5ff, cyan, 22d3ee, 06b6d4, teal, backdrop-blur, text-shadow, glow and grid backgrounds, and fix every hit.
- Browser screenshots at 360x800 and 390x844, in Dark and Simple, for the Home card, Lock Setup, Focus Active and the dialogs. Check there's no sideways scroll, no clipped text and that every tap target is at least 44px. Compare side by side with the Contract sheet.
- Rerun the existing Coach and theme tests.
- A real locked session and native app blocking can't be run in the test browser. I'll open Focus Active by starting a flexible session, and won't finish it, so no coins are awarded.
