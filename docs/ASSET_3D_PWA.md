# Asset audit & 3D/PWA roadmap

## Audit snapshot

- The current game uses HTML/CSS/Vanilla JS and a server-authoritative Cloudflare Worker + Durable Objects backend. Keep the game rules, WebSocket protocol, offline AI and save keys unchanged.
- `public/assets/manifest.json` inventories original SVG/vector assets: 8 board groups, 8 characters, 12 tokens, 5 building levels, card illustrations, effects and UI. The declared asset policy is `externalAssets: false`.
- SVG artwork is 2D. The updated CSS adds toy-like depth, soft shadows, raised controls and a bright pastel surface treatment; it does **not** pretend those files are true 3D models.
- PWA shell files and app icons are now part of `public/`. Online room creation and WebSocket endpoints are deliberately excluded from service-worker caching.

## Visual direction

- Audience: family-friendly and readable for all ages.
- Palette: sky blue and cloud white, with sunny yellow, mint, coral and violet accents.
- Shape language: rounded toy pieces, raised buttons, soft ambient shadows, clear labels and generous touch targets.
- Motion: brief dice/token feedback; respect `prefers-reduced-motion`.
- Keep Vietnamese copy, original property names and existing game semantics. Do not use Monopoly branding or copyrighted game assets.

## True 3D asset plan (not yet implemented)

Before adding binary GLB/GLTF models, create and validate a small original low-poly set:
1. Six-sided dice with correct pip layout and rounded edges.
2. One reusable house model with five material/mesh variants for house levels and hotel.
3. Eight player tokens that remain recognizable at small mobile sizes.
4. A compact board-center decoration and coin/star particles.

Suggested pipeline:
- Model original low-poly assets in Blender; export GLB with applied transforms, correct normals, compressed textures where appropriate, and no embedded copyrighted logos.
- Target mobile-first budgets: each token under ~5k triangles, each building under ~8k triangles, textures mostly 512px or smaller; prefer shared materials.
- Keep a 2D SVG/CSS fallback so low-end phones and offline play do not depend on WebGL.
- Only introduce Three.js or another renderer after a measured prototype proves acceptable performance and graceful fallback. Do not load a 3D engine just to decorate the static home screen.
- Add attribution/license records for every external asset if the no-external-assets policy is ever changed.

## PWA acceptance checks

- Manifest is served from `/manifest.webmanifest`; icons resolve under `/assets/icons/`.
- Service worker caches only same-origin GET shell/static resources; never cache `/api/*` or `/ws`.
- Update the cache version whenever the shell cache strategy changes.
- Test installability and offline reload on Android Chrome; verify online rooms still require a connection.
- Confirm build checks and manual board interactions before merging.
