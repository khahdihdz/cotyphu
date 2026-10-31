# Changelog

## Unreleased — 3D and PHP hosting foundation

- Added a lazy-loaded Three.js board with 3D tile meshes, pawn models, lighting,
  camera orbit and touch-friendly zoom.
- Kept the HTML board as a fallback when WebGL or the external module CDN fails.
- Added a PHP 8.2 entry point for DirectAdmin and configurable Worker endpoint.
- Updated room creation and WebSocket URL handling for separately hosted
  frontend and Cloudflare backend.
- Room-code generation now uses Web Crypto and six-character codes.
