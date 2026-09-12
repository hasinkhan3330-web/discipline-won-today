# Clean Coach Scene and Reliable Voice Interruption

## Changes
- Remove AXEN/logo, tagline, coach identity, status, and other branding text layered over the coach background while keeping the original clean cinematic image and functional voice/chat controls.
- Add a session abort controller and session-generation guard so canceled or replaced voice sessions cannot keep processing socket events or audio.
- Replace continuous unbounded playback scheduling with a bounded PCM queue that clears immediately on interruption, stop, socket close, or session replacement.
- Add local voice-activity signaling to Gemini Live so user speech sends explicit activity start/end events and immediately cancels coach playback.
- Preserve existing premium access, text coaching, navigation, and Gemini authentication behavior.

## Verification
- Run focused type checks.
- Verify the coach screen at the current mobile size has no branding overlays.
- Exercise start/stop handling where browser microphone access permits, and confirm queued audio is cleared on cancellation.
