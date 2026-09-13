# Zen Mode cinematic meditation scene

## Build
- Use the complete supplied meditation artwork as Zen Mode’s sharp, static visual foundation.
- Add a separately masked golden mandala overlay so only the circular energy pattern moves; the figure, flowers, and forest never animate.
- Synchronize ring rotation and chakra glow with the existing meditation timer: smooth start, exact-position pause/resume, continuous looping, and eased stop on completion/reset.
- Keep the existing audio library, seamless track looping, volume, session lengths, rewards, and navigation unchanged.

## Technical details
- Store the uploaded artwork through the project asset system.
- Use compositor-only transforms and opacity, `will-change`, and reduced-motion handling.
- Verify typing and the mobile Zen layout after implementation.
