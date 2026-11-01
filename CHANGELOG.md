# Changelog

## Unreleased — 3D board visual upgrade

- Added a polished 3D board base with metallic trim, tile surfaces and a Vietnamese center plaque.
- Rebuilt 3D dice with visible pips on all six faces and improved roll animation.
- Added subtle pawn idle motion and responsive 3D canvas styling for mobile.
- Kept the existing HTML board as an automatic fallback when WebGL is unavailable.


## Unreleased — Multiplayer session hardening

- Added per-player cryptographically random session tokens for room reconnects.
- Persisted room session credentials in the browser so a refresh can restore the same player.
- Rejected reconnect attempts with an invalid token and closed stale sockets when a player reconnects elsewhere.
- Corrected the lobby player-capacity label to match the four-player online limit.


## Unreleased — 3D and PHP hosting foundation

- Added a lazy-loaded Three.js board with 3D tile meshes, pawn models, lighting,
  camera orbit and touch-friendly zoom.
- Kept the HTML board as a fallback when WebGL or the external module CDN fails.
- Added a PHP 8.2 entry point for DirectAdmin and configurable Worker endpoint.
- Updated room creation and WebSocket URL handling for separately hosted
  frontend and Cloudflare backend.
- Room-code generation now uses Web Crypto and six-character codes.
