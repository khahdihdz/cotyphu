## Unreleased

### Improved
- Expanded JavaScript syntax checks to cover every runtime, backend and build module.
- Added a production asset smoke test for the local Three.js bundle, OrbitControls import map and runtime configuration.
- Corrected README multiplayer session section formatting and documented the production smoke-test command.

### Fixed
- Use the locally bundled Three.js import map directly in the source HTML, not only as a build-time rewrite.
- Reset the 3D loader after initialization failure so the game can retry instead of retaining a failed promise.
- Show the underlying module/WebGL error in the UI to make remaining device-specific failures diagnosable.
- Bump the service-worker shell cache to v5 so clients discard previously cached 3D assets.

# Changelog

## Unreleased — Fix 3D library delivery

- Validate that the local Three.js and OrbitControls bundles are generated and complete during production builds.
- Precache both local 3D modules in the versioned service-worker shell cache and refresh clients to cache v4.
- Avoid depending on a third-party CDN to load the 3D engine at runtime.


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
