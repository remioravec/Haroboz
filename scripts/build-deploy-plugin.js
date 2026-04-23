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

// Load or create persistent API key for custom endpoint (bypasses LiteSpeed auth strip)
const KEY_FILE = path.join(ROOT, 'wp-push', '.haroboz-api-key');
let API_KEY;
if (fs.existsSync(KEY_FILE)) {
  API_KEY = fs.readFileSync(KEY_FILE, 'utf8').trim();
} else {
  API_KEY = 'hrbz-' + BUILD_VERSION + '-' + require('crypto').randomBytes(24).toString('hex');
  fs.writeFileSync(KEY_FILE, API_KEY + '\n');
}
console.log(`API key : ${API_KEY.slice(0, 20)}... (stored in wp-push/.haroboz-api-key)`);

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
L.push('/* Try every known rebinding strategy. Without this, WP REST API with Basic auth returns 401. */');
L.push('if (!isset($_SERVER[\'HTTP_AUTHORIZATION\'])) {');
L.push('    if (isset($_SERVER[\'REDIRECT_HTTP_AUTHORIZATION\'])) {');
L.push('        $_SERVER[\'HTTP_AUTHORIZATION\'] = $_SERVER[\'REDIRECT_HTTP_AUTHORIZATION\'];');
L.push('    } elseif (isset($_SERVER[\'PHP_AUTH_USER\'], $_SERVER[\'PHP_AUTH_PW\'])) {');
L.push('        $_SERVER[\'HTTP_AUTHORIZATION\'] = \'Basic \' . base64_encode($_SERVER[\'PHP_AUTH_USER\'] . \':\' . $_SERVER[\'PHP_AUTH_PW\']);');
L.push('    } elseif (function_exists(\'getallheaders\')) {');
L.push('        $_h = getallheaders();');
L.push('        foreach ($_h as $_k => $_v) {');
L.push('            if (strcasecmp($_k, \'Authorization\') === 0) { $_SERVER[\'HTTP_AUTHORIZATION\'] = $_v; break; }');
L.push('        }');
L.push('    } elseif (isset($_SERVER[\'HTTP_X_AUTHORIZATION\'])) {');
L.push('        $_SERVER[\'HTTP_AUTHORIZATION\'] = $_SERVER[\'HTTP_X_AUTHORIZATION\'];');
L.push('    }');
L.push('}');
L.push('');
L.push('define(\'HAROBOZ_BUILD\', \'' + BUILD_VERSION + '\');');
L.push('define(\'HAROBOZ_API_KEY\', ' + JSON.stringify(API_KEY) + ');');
L.push('');
L.push('/* CUSTOM API ENDPOINT: bypass LiteSpeed auth strip with shared secret. */');
L.push('/* Call: POST /?haroboz_api=1   X-Haroboz-Key: <key>   body JSON { action, params }. */');
L.push('add_action(\'init\', \'haroboz_api_dispatch\', 0);');
L.push('function haroboz_api_dispatch() {');
L.push('    if (!isset($_GET[\'haroboz_api\'])) return;');
L.push('    $key = isset($_SERVER[\'HTTP_X_HAROBOZ_KEY\']) ? $_SERVER[\'HTTP_X_HAROBOZ_KEY\'] : (isset($_GET[\'k\']) ? $_GET[\'k\'] : \'\');');
L.push('    if (!hash_equals(HAROBOZ_API_KEY, $key)) { status_header(403); header(\'Content-Type: application/json\'); echo json_encode(array(\'error\'=>\'forbidden\')); exit; }');
L.push('    @ini_set(\'memory_limit\', \'512M\');');
L.push('    @set_time_limit(120);');
L.push('    header(\'Content-Type: application/json; charset=utf-8\');');
L.push('    header(\'Cache-Control: no-store, no-cache, must-revalidate, max-age=0\');');
L.push('    $raw = file_get_contents(\'php://input\');');
L.push('    $req = $raw ? json_decode($raw, true) : array();');
L.push('    if (!is_array($req)) $req = array();');
L.push('    $action = isset($req[\'action\']) ? $req[\'action\'] : (isset($_GET[\'action\']) ? $_GET[\'action\'] : \'ping\');');
L.push('    $params = isset($req[\'params\']) ? $req[\'params\'] : array();');
L.push('    try {');
L.push('        $out = haroboz_api_handle($action, $params);');
L.push('        echo json_encode(array(\'ok\'=>true, \'action\'=>$action, \'data\'=>$out));');
L.push('    } catch (Throwable $e) {');
L.push('        status_header(500);');
L.push('        echo json_encode(array(\'ok\'=>false, \'action\'=>$action, \'error\'=>$e->getMessage(), \'file\'=>basename($e->getFile()), \'line\'=>$e->getLine()));');
L.push('    }');
L.push('    exit;');
L.push('}');
L.push('');
L.push('function haroboz_api_handle($action, $params) {');
L.push('    switch ($action) {');
L.push('        case \'ping\':');
L.push('            return array(\'build\'=>HAROBOZ_BUILD, \'wp\'=>get_bloginfo(\'version\'), \'time\'=>time());');
L.push('        case \'diag\':');
L.push('            return array(');
L.push('                \'has_HTTP_AUTHORIZATION\' => isset($_SERVER[\'HTTP_AUTHORIZATION\']),');
L.push('                \'has_REDIRECT_HTTP_AUTHORIZATION\' => isset($_SERVER[\'REDIRECT_HTTP_AUTHORIZATION\']),');
L.push('                \'server_software\' => isset($_SERVER[\'SERVER_SOFTWARE\']) ? $_SERVER[\'SERVER_SOFTWARE\'] : \'?\',');
L.push('                \'php\' => PHP_VERSION,');
L.push('                \'active_plugins\' => get_option(\'active_plugins\'),');
L.push('                \'theme\' => wp_get_theme()->get_stylesheet(),');
L.push('            );');
L.push('        case \'list_pages\':');
L.push('            $status = isset($params[\'status\']) ? $params[\'status\'] : \'any\';');
L.push('            $qp = array(\'post_type\'=>\'page\', \'posts_per_page\'=>-1, \'post_status\'=>$status, \'orderby\'=>\'ID\', \'order\'=>\'ASC\');');
L.push('            $posts = get_posts($qp);');
L.push('            $out = array();');
L.push('            foreach ($posts as $p) {');
L.push('                $out[] = array(');
L.push('                    \'id\' => $p->ID,');
L.push('                    \'slug\' => $p->post_name,');
L.push('                    \'title\' => $p->post_title,');
L.push('                    \'status\' => $p->post_status,');
L.push('                    \'modified\' => $p->post_modified_gmt,');
L.push('                    \'date\' => $p->post_date_gmt,');
L.push('                    \'parent\' => $p->post_parent,');
L.push('                    \'menu_order\' => $p->menu_order,');
L.push('                    \'content_length\' => strlen($p->post_content),');
L.push('                    \'excerpt\' => $p->post_excerpt,');
L.push('                    \'template\' => get_page_template_slug($p->ID),');
L.push('                );');
L.push('            }');
L.push('            return $out;');
L.push('        case \'get_page\':');
L.push('            $id = (int)$params[\'id\'];');
L.push('            $p = get_post($id);');
L.push('            if (!$p) throw new Exception(\'page not found\');');
L.push('            $meta = get_post_meta($id);');
L.push('            $flat = array();');
L.push('            foreach ($meta as $k=>$v) { $flat[$k] = is_array($v) && count($v)===1 ? $v[0] : $v; }');
L.push('            return array(');
L.push('                \'id\'=>$p->ID, \'slug\'=>$p->post_name, \'title\'=>$p->post_title,');
L.push('                \'status\'=>$p->post_status, \'content_raw\'=>$p->post_content,');
L.push('                \'excerpt\'=>$p->post_excerpt, \'modified\'=>$p->post_modified_gmt,');
L.push('                \'date\'=>$p->post_date_gmt, \'parent\'=>$p->post_parent,');
L.push('                \'menu_order\'=>$p->menu_order, \'template\'=>get_page_template_slug($p->ID),');
L.push('                \'meta\'=>$flat,');
L.push('            );');
L.push('        case \'update_page\':');
L.push('            $data = $params[\'data\']; $id = (int)$params[\'id\'];');
L.push('            $update = array(\'ID\'=>$id);');
L.push('            foreach (array(\'post_title\'=>\'title\', \'post_content\'=>\'content\', \'post_status\'=>\'status\', \'post_name\'=>\'slug\', \'post_excerpt\'=>\'excerpt\', \'menu_order\'=>\'menu_order\', \'post_parent\'=>\'parent\', \'page_template\'=>\'template\') as $wp=>$in) {');
L.push('                if (isset($data[$in])) $update[$wp] = $data[$in];');
L.push('            }');
L.push('            $r = wp_update_post($update, true);');
L.push('            if (is_wp_error($r)) throw new Exception($r->get_error_message());');
L.push('            if (!empty($data[\'meta\'])) {');
L.push('                foreach ($data[\'meta\'] as $k=>$v) update_post_meta($id, $k, wp_slash($v));');
L.push('            }');
L.push('            return array(\'id\'=>$r);');
L.push('        case \'create_page\':');
L.push('            $data = $params[\'data\'];');
L.push('            $insert = array(\'post_type\'=>\'page\', \'post_status\'=>isset($data[\'status\'])?$data[\'status\']:\'draft\');');
L.push('            foreach (array(\'post_title\'=>\'title\', \'post_content\'=>\'content\', \'post_name\'=>\'slug\', \'post_excerpt\'=>\'excerpt\', \'menu_order\'=>\'menu_order\', \'post_parent\'=>\'parent\', \'page_template\'=>\'template\') as $wp=>$in) {');
L.push('                if (isset($data[$in])) $insert[$wp] = $data[$in];');
L.push('            }');
L.push('            $id = wp_insert_post($insert, true);');
L.push('            if (is_wp_error($id)) throw new Exception($id->get_error_message());');
L.push('            if (!empty($data[\'meta\'])) {');
L.push('                foreach ($data[\'meta\'] as $k=>$v) update_post_meta($id, $k, wp_slash($v));');
L.push('            }');
L.push('            return array(\'id\'=>$id);');
L.push('        case \'create_elementor_library\':');
L.push('            $data = $params[\'data\'];');
L.push('            $insert = array(\'post_type\'=>\'elementor_library\', \'post_status\'=>\'publish\', \'post_title\'=>$data[\'title\']);');
L.push('            $id = wp_insert_post($insert, true);');
L.push('            if (is_wp_error($id)) throw new Exception($id->get_error_message());');
L.push('            if (!empty($data[\'meta\'])) {');
L.push('                foreach ($data[\'meta\'] as $k=>$v) update_post_meta($id, $k, wp_slash($v));');
L.push('            }');
L.push('            return array(\'id\'=>$id);');
L.push('        case \'list_media\':');
L.push('            $offset = isset($params[\'offset\'])?(int)$params[\'offset\']:0;');
L.push('            $limit = isset($params[\'limit\'])?(int)$params[\'limit\']:200;');
L.push('            $posts = get_posts(array(\'post_type\'=>\'attachment\', \'posts_per_page\'=>$limit, \'offset\'=>$offset, \'post_status\'=>\'inherit\'));');
L.push('            $out = array();');
L.push('            foreach ($posts as $p) {');
L.push('                $out[] = array(');
L.push('                    \'id\'=>$p->ID, \'slug\'=>$p->post_name, \'title\'=>$p->post_title,');
L.push('                    \'source_url\'=>wp_get_attachment_url($p->ID), \'mime_type\'=>$p->post_mime_type,');
L.push('                    \'alt_text\'=>get_post_meta($p->ID, \'_wp_attachment_image_alt\', true),');
L.push('                    \'date\'=>$p->post_date_gmt,');
L.push('                );');
L.push('            }');
L.push('            return $out;');
L.push('        case \'upload_media\':');
L.push('            $filename = sanitize_file_name($params[\'filename\']);');
L.push('            $mime = isset($params[\'mime\'])?$params[\'mime\']:\'application/octet-stream\';');
L.push('            $data = base64_decode($params[\'base64_data\']);');
L.push('            if (!$data) throw new Exception(\'empty base64_data\');');
L.push('            $upload = wp_upload_bits($filename, null, $data);');
L.push('            if (!empty($upload[\'error\'])) throw new Exception($upload[\'error\']);');
L.push('            $attach = array(\'post_mime_type\'=>$mime, \'post_title\'=>sanitize_text_field(isset($params[\'title\'])?$params[\'title\']:$filename), \'post_status\'=>\'inherit\', \'post_content\'=>\'\');');
L.push('            $id = wp_insert_attachment($attach, $upload[\'file\']);');
L.push('            if (is_wp_error($id)) throw new Exception($id->get_error_message());');
L.push('            require_once ABSPATH . \'wp-admin/includes/image.php\';');
L.push('            wp_update_attachment_metadata($id, wp_generate_attachment_metadata($id, $upload[\'file\']));');
L.push('            if (!empty($params[\'alt\'])) update_post_meta($id, \'_wp_attachment_image_alt\', $params[\'alt\']);');
L.push('            return array(\'id\'=>$id, \'url\'=>wp_get_attachment_url($id));');
L.push('        case \'list_plugins\':');
L.push('            if (!function_exists(\'get_plugins\')) require_once ABSPATH . \'wp-admin/includes/plugin.php\';');
L.push('            $all = get_plugins(); $active = get_option(\'active_plugins\', array());');
L.push('            $out = array();');
L.push('            foreach ($all as $file=>$data) { $out[] = array(\'plugin\'=>$file, \'name\'=>$data[\'Name\'], \'version\'=>$data[\'Version\'], \'active\'=>in_array($file, $active)); }');
L.push('            return $out;');
L.push('        case \'toggle_plugin\':');
L.push('            if (!function_exists(\'activate_plugin\')) require_once ABSPATH . \'wp-admin/includes/plugin.php\';');
L.push('            $plugin = $params[\'plugin\']; $active = !empty($params[\'active\']);');
L.push('            if ($active) { $r = activate_plugin($plugin); if (is_wp_error($r)) throw new Exception($r->get_error_message()); }');
L.push('            else { deactivate_plugins($plugin); }');
L.push('            return array(\'plugin\'=>$plugin, \'active\'=>$active);');
L.push('        case \'active_theme\':');
L.push('            $t = wp_get_theme(); return array(\'stylesheet\'=>$t->get_stylesheet(), \'name\'=>$t->get(\'Name\'), \'version\'=>$t->get(\'Version\'));');
L.push('        case \'rest_namespaces\':');
L.push('            $s = rest_get_server(); return array_keys($s->get_namespaces());');
L.push('        default:');
L.push('            throw new Exception(\'unknown action: \' . $action);');
L.push('    }');
L.push('}');
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
