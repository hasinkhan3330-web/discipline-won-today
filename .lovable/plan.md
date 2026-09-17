# Rebuild only the AXEN leaderboard

## Scope
- Keep routes, authentication, Discipline Points, filters, country setting, avatar controls, personal position card, Rank content below it, and all other tabs unchanged.
- Redesign only the leaderboard header, India/Global and Weekly/All-Time selectors, Top 3 podium, and ranks 4–100 list.

## Build
- Create a compact cyberpunk arena using the existing cyan/violet system, restrained gold/silver/bronze podium treatments, animated edge light, particles, and a subtle grid.
- Keep #1 elevated in the center with #2 and #3 flanking it; preserve live avatars, flags, DP, elite status, and server ranking.
- Present ranks 4–100 in a bounded scrolling list, with the signed-in user highlighted whenever present.
- Add smooth reduced-motion-aware transitions between filter states while preserving loading, empty, error, refresh, and rank-up states.
- Leave the existing personal position card and everything below it byte-for-byte unchanged.

## Validation
- Verify India/Global and Weekly/All-Time switching, Top 100 limits, Top 3 order, scroll behavior, and unchanged personal card.
- Check 360×645 and 430px mobile layouts for overflow and run the production build.
