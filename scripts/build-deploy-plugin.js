#!/usr/bin/env node
/**
 * Generates haroboz-deploy.php — a WordPress plugin that serves
 * COMPLETE static HTML pages directly, bypassing WordPress entirely.
 *
 * How it works:
 *   - All preview HTML files are embedded in the plugin (base64)
 *   - On any front-end request, the plugin matches the URL to a page
 *   - If matched: outputs the FULL HTML and exits (no theme, no filters)
 *   - WordPress is just the CMS host — zero rendering dependency
 *
 * Usage: node scripts/build-deploy-plugin.js
 * Output: wp-push/haroboz-deploy.php
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const ROOT        = path.join(__dirname, '..');
const PREVIEW_DIR = path.join(ROOT, 'preview');
const SITE_URL    = 'https://haroboz.com';
const OUT_FILE    = path.join(ROOT, 'wp-push', 'haroboz-deploy.php');
const BUILD_VERSION = Date.now().toString(36);

// --- Helpers ---

function findHtml(dir) {
  let r = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const f = path.join(dir, e.name);
    if (e.isDirectory()) r = r.concat(findHtml(f));
    else if (e.name.endsWith('.html')) r.push(f);
  }
  return r;
}

function extractTitle(h) {
  const m = h.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].trim() : '';
}

function extractMeta(h) {
  const m = h.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)
         || h.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
  return m ? m[1].trim() : '';
}

function rewriteLinks(html) {
  // /pages/category/page.html → https://haroboz.com/category/page/
  html = html.replace(/href="\/pages\/([^"\/]+)\/(#[^"]*)"/g, (_, c, a) => `href="${SITE_URL}/${c}/${a}"`);
  html = html.replace(/href="\/pages\/([^"\/]+)\/"/g, (_, c) => `href="${SITE_URL}/${c}/"`);
  html = html.replace(/href="\/pages\/([^"\/]+)\/index\.html"/g, (_, c) => `href="${SITE_URL}/${c}/"`);
  html = html.replace(/href="\/pages\/([^"\/]+)\/([^"]+)\.html"/g, (_, c, p) => `href="${SITE_URL}/${c}/${p}/"`);
  html = html.replace(/href="\/pages\/([^"\/]+)\.html"/g, (_, p) => `href="${SITE_URL}/${p}/"`);
  html = html.replace(/href="\/"/g, `href="${SITE_URL}/"`);
  return html;
}

function rewriteImages(html, mediaMap) {
  return html.replace(/src="([^"]*\.(png|jpg|jpeg|webp|svg))"/gi, (match, src) => {
    if (src.startsWith('http')) return match;
    const fn = src.split('/').pop();
    if (mediaMap[fn]) return `src="${mediaMap[fn]}"`;
    const base = fn.replace(/\.(png|jpg|jpeg|webp)$/i, '');
    const found = Object.keys(mediaMap).find(k => k.startsWith(base));
    if (found) return `src="${mediaMap[found]}"`;
    return match;
  });
}

// --- Main ---

// Load media map
let mediaMap = {};
const mmPath = path.join(ROOT, 'scripts', 'media-map.json');
if (fs.existsSync(mmPath)) {
  mediaMap = JSON.parse(fs.readFileSync(mmPath, 'utf-8'));
  console.log(`${Object.keys(mediaMap).length} media mappings loaded`);
}

// Build page registry: URL path → full HTML
const files = findHtml(PREVIEW_DIR);
const pages = {}; // urlPath → { html, title, metaDesc }

for (const fp of files) {
  const rel  = path.relative(PREVIEW_DIR, fp).replace(/\\/g, '/');
  let html = fs.readFileSync(fp, 'utf-8');
  const parts = rel.split('/');

  // Determine URL path
  let urlPath;
  if (rel === 'index.html') {
    urlPath = '/';
  } else if (parts.length === 2 && parts[0] === 'pages') {
    urlPath = '/' + parts[1].replace('.html', '') + '/';
  } else if (parts.length === 3 && parts[2] === 'index.html') {
    urlPath = '/' + parts[1] + '/';
  } else if (parts.length === 3) {
    urlPath = '/' + parts[1] + '/' + parts[2].replace('.html', '') + '/';
  } else {
    urlPath = '/' + rel.replace('.html', '') + '/';
  }

  // Transform HTML
  html = rewriteLinks(html);
  html = rewriteImages(html, mediaMap);

  pages[urlPath] = {
    html,
    title: extractTitle(html),
    metaDesc: extractMeta(html),
  };
}

const urlPaths = Object.keys(pages);
console.log(`${urlPaths.length} pages processed:`);
urlPaths.forEach(p => console.log(`  ${p} → ${pages[p].title.substring(0, 50)}`));

// Encode all pages as base64 JSON
const pagesData = {};
for (const [urlPath, data] of Object.entries(pages)) {
  pagesData[urlPath] = {
    h: Buffer.from(data.html).toString('base64'),
    t: data.title,
    m: data.metaDesc,
  };
}
const b64 = Buffer.from(JSON.stringify(pagesData)).toString('base64');

// --- Generate PHP (string concat to avoid $ escaping issues) ---
const L = [];
L.push('<?php');
L.push('/**');
L.push(' * Plugin Name: Haroboz Static Site');
L.push(' * Description: Sert ' + urlPaths.length + ' pages HTML statiques. WordPress = CMS hote, zero rendu theme.');
L.push(' * Version: 7.' + BUILD_VERSION);
L.push(' * Author: Haroboz');
L.push(' */');
L.push('if (!defined(\'ABSPATH\')) exit;');
L.push('');
L.push('/* FIX: LiteSpeed/Hostinger strips the Authorization header before PHP sees it. */');
L.push('/* We restore it from REDIRECT_HTTP_AUTHORIZATION (set by Apache mod_rewrite). */');
L.push('/* Without this, WP REST API with Basic auth / App Passwords returns 401. */');
L.push('if (!isset($_SERVER[\'HTTP_AUTHORIZATION\']) && isset($_SERVER[\'REDIRECT_HTTP_AUTHORIZATION\'])) {');
L.push('    $_SERVER[\'HTTP_AUTHORIZATION\'] = $_SERVER[\'REDIRECT_HTTP_AUTHORIZATION\'];');
L.push('}');
L.push('');
L.push('define(\'HAROBOZ_BUILD\', \'' + BUILD_VERSION + '\');');
L.push('');
L.push('/* PAGE STORE — ' + urlPaths.length + ' pages embedded (build ' + new Date().toISOString().slice(0, 10) + ') */');
L.push('function haroboz_get_pages() {');
L.push('    static $cache = null;');
L.push('    if ($cache !== null) return $cache;');
L.push('    $raw = json_decode(base64_decode(\'');
L.push(b64);
L.push('\'), true);');
L.push('    $cache = array();');
L.push('    foreach ($raw as $path => $data) {');
L.push('        $cache[$path] = array(');
L.push('            \'html\'  => base64_decode($data[\'h\']),');
L.push('            \'title\' => $data[\'t\'],');
L.push('            \'meta\'  => $data[\'m\'],');
L.push('        );');
L.push('    }');
L.push('    return $cache;');
L.push('}');
L.push('');
L.push('/* STATIC SERVE — Intercepts ALL front-end requests */');
L.push('add_action(\'template_redirect\', \'haroboz_static_serve\', -999);');
L.push('');
L.push('function haroboz_static_serve() {');
L.push('    if (is_admin()) return;');
L.push('    if (function_exists(\'wp_doing_ajax\') && wp_doing_ajax()) return;');
L.push('    if (defined(\'REST_REQUEST\') && REST_REQUEST) return;');
L.push('    if (defined(\'DOING_CRON\') && DOING_CRON) return;');
L.push('    if (is_robots()) return;');
L.push('    if (is_feed()) return;');
L.push('');
L.push('    $path = parse_url($_SERVER[\'REQUEST_URI\'], PHP_URL_PATH);');
L.push('    $path = rtrim($path, \'/\');');
L.push('    if ($path === \'\') $path = \'/\';');
L.push('    else $path .= \'/\';');
L.push('');
L.push('    $pages = haroboz_get_pages();');
L.push('');
L.push('    if (!isset($pages[$path])) {');
L.push('        $alt = rtrim($path, \'/\');');
L.push('        if ($alt !== \'\' && isset($pages[$alt . \'/\'])) {');
L.push('            $path = $alt . \'/\';');
L.push('        } else {');
L.push('            return;');
L.push('        }');
L.push('    }');
L.push('');
L.push('    status_header(200);');
L.push('    header(\'Content-Type: text/html; charset=utf-8\');');
L.push('    header(\'X-Haroboz-Static: \' . HAROBOZ_BUILD);');
L.push('    header(\'X-LiteSpeed-Cache-Control: public,max-age=604800\');');
L.push('');
L.push('    echo $pages[$path][\'html\'];');
L.push('    exit;');
L.push('}');
L.push('');
L.push('/* CORS — for API access */');
L.push('add_action(\'rest_api_init\', function() {');
L.push('    remove_filter(\'rest_pre_serve_request\', \'rest_send_cors_headers\');');
L.push('    add_filter(\'rest_pre_serve_request\', function($value) {');
L.push('        $o = isset($_SERVER[\'HTTP_ORIGIN\']) ? $_SERVER[\'HTTP_ORIGIN\'] : \'*\';');
L.push('        header(\'Access-Control-Allow-Origin: \' . $o);');
L.push('        header(\'Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS\');');
L.push('        header(\'Access-Control-Allow-Headers: Authorization, Content-Type, Content-Disposition, X-WP-Nonce\');');
L.push('        header(\'Access-Control-Allow-Credentials: true\');');
L.push('        if ($_SERVER[\'REQUEST_METHOD\'] === \'OPTIONS\') { status_header(200); exit; }');
L.push('        return $value;');
L.push('    });');
L.push('}, 15);');
L.push('');
L.push('/* CACHE PURGE — on activation */');
L.push('register_activation_hook(__FILE__, function() {');
L.push('    if (class_exists(\'LiteSpeed_Cache_API\')) { LiteSpeed_Cache_API::purge_all(); }');
L.push('    if (function_exists(\'litespeed_purge_all\')) { litespeed_purge_all(); }');
L.push('    wp_cache_flush();');
L.push('    flush_rewrite_rules();');
L.push('});');
L.push('');
L.push('add_filter(\'show_admin_bar\', \'__return_false\');');

const php = L.join('\n');
fs.writeFileSync(OUT_FILE, php);

console.log(`\nPlugin written: ${OUT_FILE}`);
console.log(`Size: ${Math.round(php.length / 1024)} KB`);
console.log(`\nTo create zip: cd wp-push && zip haroboz-deploy.zip haroboz-deploy.php`);
