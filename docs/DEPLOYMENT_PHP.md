# Deploy frontend to PHP 8.2 / DirectAdmin

The PHP host serves the existing browser client only. Cloudflare Workers and
Durable Objects remain the authoritative multiplayer backend. No MySQL, Node.js
runtime or background process is required on DirectAdmin.

1. Upload the repository root, including `index.php` and the `public/` folder,
   into the domain's document root (for example `public_html/`).
2. Enable PHP 8.2 and HTTPS in DirectAdmin.
3. Copy `config/app.php.example` to `config/app.php` and replace the sample
   URL with the deployed Worker HTTPS URL, or set the `CTP_WORKER_URL`
   environment variable.
4. Visit the domain root. PHP serves `public/index.html` and injects the
   Worker URL. The client uses HTTPS for API calls and WSS for multiplayer.

The Worker must be deployed separately with `wrangler.toml`. Keep Worker
secrets in Cloudflare settings, never in the frontend or PHP config. The 3D
renderer is lazy-loaded from jsDelivr; when the CDN/WebGL is unavailable, the
existing HTML board remains available.

## Worker URL format

`https://<worker-name>.<account-subdomain>.workers.dev`

Do not append `/ws` or `/api`; the client adds those paths itself.
