<?php
declare(strict_types=1);
// PHP 8.2 entry point for DirectAdmin. Cloudflare remains the multiplayer server.
$settings = [];
$configFile = __DIR__ . '/config/app.php';
if (is_file($configFile)) {
    $loaded = require $configFile;
    if (is_array($loaded)) $settings = $loaded;
}
$workerUrl = rtrim(trim((string) (getenv('CTP_WORKER_URL') ?: ($settings['worker_url'] ?? ''))), '/');
if ($workerUrl !== '' && (!filter_var($workerUrl, FILTER_VALIDATE_URL) || parse_url($workerUrl, PHP_URL_SCHEME) !== 'https')) {
    http_response_code(500); header('Content-Type: text/plain; charset=utf-8');
    exit('CTP_WORKER_URL must be a valid HTTPS URL.');
}
$file = __DIR__ . '/public/index.html';
if (!is_file($file)) { http_response_code(500); exit('Missing public/index.html. Upload the complete repository.'); }
$html = file_get_contents($file);
$config = json_encode(['workerUrl'=>$workerUrl], JSON_HEX_TAG|JSON_HEX_AMP|JSON_HEX_APOS|JSON_HEX_QUOT|JSON_UNESCAPED_SLASHES);
$html = preg_replace('/<head>/i', '<head>\n<base href="/public/">\n<script>window.CTP_CONFIG='.$config.';</script>', $html, 1);
header('Content-Type: text/html; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header('Cache-Control: no-cache, must-revalidate');
echo $html;
