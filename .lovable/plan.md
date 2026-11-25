# Gemini model check (audit result + proposed change)

## What the app uses today
| AI feature | How it connects | Model now |
|---|---|---|
| Coach text chat | Lovable AI (no Google key) | google/gemini-3.8-flash |
| Coach plan generation | Lovable AI (no Google key) | google/gemini-3.8-flash |
| Coach voice (live talk) | Your own Gemini API key | gemini-2.5-flash-native-audio-latest |
| Photo/proof verification (Contract proofs) | Roboflow, not Gemini | coco/9 |

## Important facts
- No image verification uses Gemini. Photo proofs are checked by Roboflow, so there is nothing to switch there.
- Voice already uses the 2.5 Flash family. Live voice only works with the "native-audio" version, so plain gemini-2.5-flash would break voice. Keep as is.
- Coach text and plans run through Lovable AI, billed in Lovable credits, not your Google free tier. Switching them to gemini-2.5-flash would not use your Google free tier, and 2.5 Flash is an older model than what they use now.

## Proposed change (only if you still want it)
- In the single Coach model settings file, change the text chat and plan model from google/gemini-3.8-flash to google/gemini-2.5-flash (if Lovable AI still offers it; otherwise stop and report).
- Nothing else: no voice change, no Roboflow change, no UI, rewards, database or sign-in changes.

## Technical details
- File: src/lib/coach-config.ts — COACH_CHAT_MODEL and COACH_PLAN_MODEL only.
- Verify slug availability via listModels() before editing; run existing coach tests; typecheck.
