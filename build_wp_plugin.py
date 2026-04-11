#!/usr/bin/env python3
"""
build_wp_plugin.py — Haroboz Site Deployer
Converts static HTML site into an installable WordPress plugin ZIP.

Usage:
    python build_wp_plugin.py [--source preview/] [--output wp-plugin/]
"""

import os
import re
import json
import shutil
import zipfile
import argparse
from html.parser import HTMLParser
from pathlib import Path

try:
    from PIL import Image
    HAS_PIL = True
except ImportError:
    HAS_PIL = False

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
PLUGIN_SLUG = "haroboz-deployer"
PLUGIN_NAME = "Haroboz Site Deployer"
PLUGIN_DESC = "Déploie le site statique Haroboz dans WordPress"
PLUGIN_VERSION = "3.0"
PLUGIN_AUTHOR = "Haroboz Dev"
META_PREFIX = "_haroboz"  # post-meta prefix
IMG_MAX_SIZE = 1600  # max width/height in pixels
IMG_QUALITY = 82     # JPEG quality


# ---------------------------------------------------------------------------
# HTML Metadata Extractor
# ---------------------------------------------------------------------------
class MetaExtractor(HTMLParser):
    """Lightweight HTML parser that pulls title, meta description, and images."""

    def __init__(self):
        super().__init__()
        self._in_title = False
        self.title = ""
        self.meta_description = ""
        self.images: list[str] = []

    def handle_starttag(self, tag, attrs):
        d = dict(attrs)
        if tag == "title":
            self._in_title = True
        elif tag == "meta" and d.get("name", "").lower() == "description":
            self.meta_description = d.get("content", "")
        elif tag == "img" and d.get("src"):
            self.images.append(d["src"])

    def handle_data(self, data):
        if self._in_title:
            self.title += data

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False


def extract_metadata(html_content: str) -> dict:
    parser = MetaExtractor()
    parser.feed(html_content)
    return {
        "title": parser.title.strip(),
        "meta_description": parser.meta_description.strip(),
        "images": parser.images,
    }


# ---------------------------------------------------------------------------
# Slug helpers
# ---------------------------------------------------------------------------
def file_to_slug(rel_path: str) -> str:
    """Convert relative file path to a WP-friendly slug.
    Examples:
        index.html                           -> index
        pages/boutique/carte-cadeau.html     -> boutique/carte-cadeau
        pages/boutique/index.html            -> boutique
    """
    slug = rel_path.replace("\\", "/")
    # strip leading pages/ prefix
    if slug.startswith("pages/"):
        slug = slug[len("pages/"):]
    # strip .html
    if slug.endswith(".html"):
        slug = slug[: -len(".html")]
    # folder/index -> folder
    if slug.endswith("/index"):
        slug = slug[: -len("/index")]
    if slug == "index":
        slug = "index"  # homepage marker
    return slug


def parent_slug(slug: str) -> str | None:
    """Return parent slug or None for top-level pages."""
    if "/" not in slug:
        return None
    return slug.rsplit("/", 1)[0]


def slug_to_filename(slug: str) -> str:
    """Convert slug to safe filename for data/html/."""
    return slug.replace("/", "__") + ".html"


# ---------------------------------------------------------------------------
# Image optimization
# ---------------------------------------------------------------------------
def optimize_image(src_path: Path, dst_path: Path):
    """Convert image to optimized JPEG. Resize if larger than IMG_MAX_SIZE."""
    if not HAS_PIL:
        # Fallback: just copy
        shutil.copy2(src_path, dst_path)
        return

    try:
        img = Image.open(src_path)
        img = img.convert("RGB")
        if max(img.size) > IMG_MAX_SIZE:
            ratio = IMG_MAX_SIZE / max(img.size)
            new_size = (int(img.size[0] * ratio), int(img.size[1] * ratio))
            img = img.resize(new_size, Image.LANCZOS)
        # Change extension to .jpg
        dst_jpg = dst_path.with_suffix(".jpg")
        img.save(dst_jpg, "JPEG", quality=IMG_QUALITY, optimize=True)
        return dst_jpg
    except Exception as e:
        print(f"    WARNING: Could not optimize {src_path.name}: {e}")
        shutil.copy2(src_path, dst_path)
        return dst_path


def collect_used_images(pages: list[dict]) -> set[str]:
    """Extract all unique canonical image paths from pages metadata."""
    used = set()
    for p in pages:
        for img_src in p["images"]:
            path = img_src.lstrip("/")
            if path.startswith("img/"):
                path = path[4:]  # strip "img/" prefix
            used.add(path)
    return used


def build_images(source_img_dir: Path, output_img_dir: Path, used_images: set[str]) -> dict:
    """Optimize and copy used images. Returns mapping: /img/rel -> plugin-relative URL."""
    output_img_dir.mkdir(parents=True, exist_ok=True)
    mapping = {}
    processed = 0

    for rel in sorted(used_images):
        src = source_img_dir / rel
        if not src.exists():
            print(f"    MISSING: {rel}")
            continue

        # Flatten to single directory: wetransfer/photo.png -> wetransfer__photo.jpg
        flat_name = rel.replace("/", "__")
        dst = output_img_dir / flat_name

        result_path = optimize_image(src, dst)
        if result_path:
            # The plugin will serve this via PHP endpoint
            final_name = result_path.name
            mapping[f"/img/{rel}"] = final_name
            processed += 1

    return mapping


# ---------------------------------------------------------------------------
# Image path normalization
# ---------------------------------------------------------------------------
def normalize_image_paths(
    html: str,
    source_file: str,
    images_base_url: str | None = None,
    image_map: dict | None = None,
) -> str:
    """Normalize all image src paths to a canonical form.

    All relative paths (../../img/x, ../img/x) and absolute paths (/img/x)
    are resolved to a canonical /img/subdir/file.ext form, then optionally
    rewritten using:
    1. image_map (exact key lookup: /img/subdir/file.ext -> WP URL)
    2. images_base_url (prefix replacement: /img/x -> base_url/x)
    """
    # Determine the directory of the source file for relative resolution
    parts = source_file.replace("\\", "/").split("/")
    if len(parts) > 1:
        source_dir_parts = parts[:-1]
    else:
        source_dir_parts = []

    def resolve_img_src(match):
        attr = match.group(1)  # 'src='
        quote = match.group(2)
        path = match.group(3)

        # Skip external URLs, data URIs
        if path.startswith(("http://", "https://", "data:", "blob:")):
            return match.group(0)

        # Resolve the path to canonical form
        if path.startswith("/"):
            canonical = path
        else:
            # Relative path — resolve against source file directory
            combined = source_dir_parts + path.split("/")
            stack = []
            for seg in combined:
                if seg == "..":
                    if stack:
                        stack.pop()
                elif seg != "." and seg != "":
                    stack.append(seg)
            canonical = "/" + "/".join(stack)

        # 1. Try exact match from image_map
        if image_map and canonical in image_map and image_map[canonical]:
            return f'{attr}{quote}{image_map[canonical]}{quote}'

        # 2. Apply base URL rewriting if configured
        if images_base_url and canonical.startswith("/img/"):
            img_rel = canonical[len("/img/"):]
            new_url = images_base_url.rstrip("/") + "/" + img_rel
            return f'{attr}{quote}{new_url}{quote}'

        return f'{attr}{quote}{canonical}{quote}'

    # Match src="..." in img tags (and also background-image, srcset, etc.)
    return re.sub(r'(src=)(["\'])([^"\']+)\2', resolve_img_src, html)


# ---------------------------------------------------------------------------
# Scan source directory
# ---------------------------------------------------------------------------
def scan_site(
    source_dir: Path,
    images_base_url: str | None = None,
    image_map: dict | None = None,
) -> list[dict]:
    pages = []
    for html_file in sorted(source_dir.rglob("*.html")):
        rel = html_file.relative_to(source_dir).as_posix()
        content = html_file.read_text(encoding="utf-8")

        # Normalize image paths before extracting metadata
        content = normalize_image_paths(content, rel, images_base_url, image_map)

        meta = extract_metadata(content)
        slug = file_to_slug(rel)
        pages.append(
            {
                "title": meta["title"] or slug,
                "slug": slug,
                "parent_slug": parent_slug(slug),
                "meta_description": meta["meta_description"],
                "images": meta["images"],
                "html_content": content,
                "source_file": rel,
            }
        )
    # Sort so parents come before children
    pages.sort(key=lambda p: p["slug"].count("/"))
    return pages


# ---------------------------------------------------------------------------
# PHP generator
# ---------------------------------------------------------------------------
def generate_plugin_php() -> str:
    return r"""<?php
/*
Plugin Name: """ + PLUGIN_NAME + r"""
Description: """ + PLUGIN_DESC + r""" — Inclut le takeover complet du thème, CORS, et le dashboard de déploiement.
Version: """ + PLUGIN_VERSION + r"""
Author: """ + PLUGIN_AUTHOR + r"""
License: GPL-2.0-or-later
*/

if (!defined('ABSPATH')) exit;

define('HAROBOZ_PLUGIN_DIR', plugin_dir_path(__FILE__));
define('HAROBOZ_PLUGIN_URL', plugin_dir_url(__FILE__));
define('HAROBOZ_META_PREFIX', '""" + META_PREFIX + r"""');

/* ==========================================================================
   1. CORS — API REST (nécessaire pour le push depuis le Codespace)
   ========================================================================== */
add_action('rest_api_init', function () {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function ($value) {
        $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type, Content-Disposition, X-WP-Nonce');
        header('Access-Control-Allow-Credentials: true');

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            status_header(200);
            exit();
        }

        return $value;
    });
}, 15);

/* ==========================================================================
   2. DÉSACTIVER wpautop — WordPress ajoute des <p> et <br> partout
      dans le contenu, ce qui casse le HTML Tailwind.
   ========================================================================== */
add_action('init', function () {
    remove_filter('the_content', 'wpautop');
    remove_filter('the_content', 'wptexturize');
    remove_filter('the_title', 'wptexturize');
});

/* ==========================================================================
   3. PERMETTRE LE HTML COMPLET — WordPress filtre certaines balises HTML
      dans le contenu. On doit tout autoriser pour Tailwind + SVG + forms.
   ========================================================================== */
add_filter('wp_kses_allowed_html', function ($allowed, $context) {
    if ($context === 'post') {
        $allowed['style']    = array('type' => true);
        $allowed['div']      = array('class' => true, 'id' => true, 'style' => true, 'onclick' => true, 'data-*' => true);
        $allowed['button']   = array('class' => true, 'id' => true, 'onclick' => true, 'type' => true, 'aria-label' => true, 'data-*' => true);
        $allowed['svg']      = array('class' => true, 'xmlns' => true, 'viewbox' => true, 'fill' => true, 'stroke' => true, 'width' => true, 'height' => true, 'stroke-width' => true, 'stroke-linecap' => true, 'stroke-linejoin' => true);
        $allowed['path']     = array('d' => true, 'fill' => true, 'stroke' => true);
        $allowed['circle']   = array('cx' => true, 'cy' => true, 'r' => true);
        $allowed['line']     = array('x1' => true, 'y1' => true, 'x2' => true, 'y2' => true);
        $allowed['i']        = array('data-lucide' => true, 'class' => true);
        $allowed['nav']      = array('class' => true, 'id' => true);
        $allowed['header']   = array('class' => true, 'id' => true);
        $allowed['footer']   = array('class' => true, 'id' => true);
        $allowed['main']     = array('class' => true, 'id' => true);
        $allowed['section']  = array('class' => true, 'id' => true, 'itemscope' => true, 'itemtype' => true);
        $allowed['form']     = array('class' => true, 'id' => true, 'onsubmit' => true, 'action' => true, 'method' => true);
        $allowed['input']    = array('class' => true, 'id' => true, 'type' => true, 'name' => true, 'placeholder' => true, 'required' => true, 'value' => true);
        $allowed['textarea'] = array('class' => true, 'id' => true, 'name' => true, 'rows' => true, 'placeholder' => true, 'required' => true);
        $allowed['select']   = array('class' => true, 'id' => true, 'name' => true, 'required' => true);
        $allowed['option']   = array('value' => true, 'selected' => true);
        $allowed['label']    = array('class' => true, 'for' => true);
    }
    return $allowed;
}, 10, 2);

/* ==========================================================================
   4. MASQUER LA BARRE ADMIN en front
   ========================================================================== */
add_filter('show_admin_bar', '__return_false');

/* ==========================================================================
   5. ADMIN MENU — Dashboard + Images
   ========================================================================== */
add_action('admin_menu', function () {
    add_menu_page(
        'Haroboz Site',
        'Haroboz Site',
        'manage_options',
        'haroboz-deployer',
        'haroboz_admin_page',
        'dashicons-admin-home',
        3
    );
    add_submenu_page(
        'haroboz-deployer',
        'Images',
        'Images',
        'manage_options',
        'haroboz-images',
        'haroboz_images_page'
    );
});

add_action('admin_enqueue_scripts', function ($hook) {
    if (strpos($hook, 'haroboz') === false) return;
    wp_enqueue_style('haroboz-admin', HAROBOZ_PLUGIN_URL . 'admin/admin.css', [], '""" + PLUGIN_VERSION + r"""');
    wp_enqueue_script('haroboz-admin', HAROBOZ_PLUGIN_URL . 'admin/admin.js', ['jquery'], '""" + PLUGIN_VERSION + r"""', true);
    wp_localize_script('haroboz-admin', 'harobozAjax', [
        'url'   => admin_url('admin-ajax.php'),
        'nonce' => wp_create_nonce('haroboz_nonce'),
    ]);
});

/* ==========================================================================
   6. DATA HELPERS
   ========================================================================== */
function haroboz_get_pages_data() {
    $file = HAROBOZ_PLUGIN_DIR . 'data/pages.json';
    if (!file_exists($file)) return [];
    return json_decode(file_get_contents($file), true) ?: [];
}

function haroboz_get_html($slug) {
    $filename = str_replace('/', '__', $slug) . '.html';
    $file = HAROBOZ_PLUGIN_DIR . 'data/html/' . $filename;
    if (!file_exists($file)) return false;
    return file_get_contents($file);
}

function haroboz_find_page_by_meta($slug) {
    $query = new WP_Query([
        'post_type'      => 'page',
        'posts_per_page' => 1,
        'meta_key'       => HAROBOZ_META_PREFIX . '_slug',
        'meta_value'     => $slug,
        'post_status'    => 'any',
    ]);
    return $query->have_posts() ? $query->posts[0] : null;
}

/* ==========================================================================
   7. RESOLVE RELATIVE LINKS
   ========================================================================== */
function haroboz_resolve_links($html, $current_slug) {
    $parts = explode('/', $current_slug);
    if (count($parts) > 1) {
        array_pop($parts);
        $base_dir = implode('/', $parts);
    } else {
        $base_dir = '';
    }

    return preg_replace_callback(
        '/href=["\']([^"\'#][^"\']*)["\']/',
        function ($m) use ($base_dir, $current_slug) {
            $href = $m[1];

            // Skip external, mailto, tel, javascript, anchors
            if (preg_match('#^(https?://|mailto:|tel:|javascript:)#i', $href)) {
                return $m[0];
            }
            // Skip asset files
            if (preg_match('#\.(css|js|png|jpg|jpeg|gif|svg|webp|ico|pdf)(\?|$)#i', $href)) {
                return $m[0];
            }

            // Resolve relative path
            $resolved = $href;
            if (strpos($href, '../') === 0 || strpos($href, './') === 0) {
                $combined = $base_dir ? $base_dir . '/' . $href : $href;
                $segments = explode('/', $combined);
                $stack = [];
                foreach ($segments as $seg) {
                    if ($seg === '..') {
                        array_pop($stack);
                    } elseif ($seg !== '.' && $seg !== '') {
                        $stack[] = $seg;
                    }
                }
                $resolved = implode('/', $stack);
            }

            // Clean: remove .html, index suffix
            $resolved = preg_replace('#\.html$#', '', $resolved);
            $resolved = preg_replace('#/index$#', '', $resolved);
            $resolved = trim($resolved, '/');

            if ($resolved === 'index') {
                return 'href="/"';
            }

            return 'href="/' . $resolved . '/"';
        },
        $html
    );
}

/* ==========================================================================
   8. TEMPLATE TAKEOVER — Court-circuite le thème à 100%

   On intercepte template_redirect (priorité 1, très tôt) pour servir
   le HTML complet stocké en post_meta et faire exit().
   Le thème WordPress n'a AUCUNE chance de s'exécuter.
   ========================================================================== */
add_action('template_redirect', function () {
    // Ne pas intercepter admin, AJAX, REST
    if (is_admin() || wp_doing_ajax() || defined('REST_REQUEST')) {
        return;
    }

    if (!is_page() && !is_front_page()) {
        return;
    }

    global $post;
    if (!$post) return;

    // Lire le HTML complet depuis post_meta
    $full_html = get_post_meta($post->ID, HAROBOZ_META_PREFIX . '_full_html', true);
    if (!$full_html) return;

    // Remplacer le placeholder images par l'URL réelle du plugin
    $img_url = HAROBOZ_PLUGIN_URL . 'data/img';
    $full_html = str_replace('%%HAROBOZ_IMG%%', $img_url, $full_html);

    // Appliquer le mapping d'images personnalisé (admin > Images)
    $image_map = get_option('haroboz_image_map', []);
    if (is_array($image_map)) {
        foreach ($image_map as $old => $new) {
            if (!empty($new)) {
                $full_html = str_replace($old, $new, $full_html);
            }
        }
    }

    // Servir le HTML complet — le thème n'a AUCUNE chance de s'exécuter
    status_header(200);
    header('Content-Type: text/html; charset=utf-8');
    echo $full_html;
    exit; // CRUCIAL — empêche WordPress de continuer le rendu du thème

}, 1);

/* ==========================================================================
   9. ADMIN PAGES — Dashboard
   ========================================================================== */
function haroboz_admin_page() {
    $pages = haroboz_get_pages_data();
    $total = count($pages);
    $deployed = 0;
    foreach ($pages as $p) {
        if (haroboz_find_page_by_meta($p['slug'])) $deployed++;
    }
    $pending = $total - $deployed;

    // Group by category
    $groups = [];
    foreach ($pages as $p) {
        $cat = explode('/', $p['slug'])[0] ?? 'racine';
        if ($p['slug'] === 'index') $cat = 'racine';
        $groups[$cat][] = $p;
    }

    echo '<div class="wrap haroboz-wrap">';
    echo '<h1>Haroboz Site Deployer</h1>';

    // Stats cards
    echo '<div class="haroboz-stats">';
    echo '<div class="haroboz-card"><span class="haroboz-num">' . $total . '</span><span class="haroboz-label">Total</span></div>';
    echo '<div class="haroboz-card haroboz-ok"><span class="haroboz-num">' . $deployed . '</span><span class="haroboz-label">Déployées</span></div>';
    echo '<div class="haroboz-card haroboz-wait"><span class="haroboz-num">' . $pending . '</span><span class="haroboz-label">En attente</span></div>';
    echo '</div>';

    // Action buttons
    echo '<div class="haroboz-actions">';
    echo '<button class="button button-primary button-hero" id="haroboz-deploy-all">Déployer tout (' . $total . ' pages)</button> ';
    echo '<button class="button button-secondary" id="haroboz-reset">Reset tout</button>';
    echo '</div>';

    // Progress bar
    echo '<div class="haroboz-progress" style="display:none;">';
    echo '<div class="haroboz-progress-bar"><div class="haroboz-progress-fill"></div></div>';
    echo '<div class="haroboz-progress-text"></div>';
    echo '</div>';

    // Log
    echo '<div id="haroboz-log" class="haroboz-log" style="display:none;"></div>';

    // Pages table grouped by category
    foreach ($groups as $cat => $cat_pages) {
        $label = $cat === 'racine' ? 'Page d\'accueil' : ucfirst(str_replace('-', ' ', $cat));
        echo '<h2 class="haroboz-cat">' . esc_html($label) . '</h2>';
        echo '<table class="wp-list-table widefat fixed striped">';
        echo '<thead><tr><th>Page</th><th>Slug</th><th>Status</th><th>Action</th></tr></thead><tbody>';
        foreach ($cat_pages as $p) {
            $exists = haroboz_find_page_by_meta($p['slug']);
            $status = $exists ? '<span class="haroboz-badge haroboz-badge-ok">Déployée</span>' : '<span class="haroboz-badge haroboz-badge-wait">En attente</span>';
            echo '<tr>';
            echo '<td>' . esc_html($p['title']) . '</td>';
            echo '<td><code>' . esc_html($p['slug']) . '</code></td>';
            echo '<td>' . $status . '</td>';
            echo '<td><button class="button haroboz-deploy-single" data-slug="' . esc_attr($p['slug']) . '">Déployer</button></td>';
            echo '</tr>';
        }
        echo '</tbody></table>';
    }

    echo '</div>';
}

/* ==========================================================================
   10. ADMIN PAGES — Images
   ========================================================================== */
function haroboz_images_page() {
    $pages = haroboz_get_pages_data();
    $all_images = [];
    foreach ($pages as $p) {
        foreach ($p['images'] as $img) {
            $all_images[$img] = true;
        }
    }
    $all_images = array_keys($all_images);
    sort($all_images);
    $image_map = get_option('haroboz_image_map', []);

    echo '<div class="wrap haroboz-wrap">';
    echo '<h1>Mapping d\'images</h1>';
    echo '<p>Remplacez les URLs d\'images du site statique par celles de la médiathèque WordPress.</p>';
    echo '<form id="haroboz-image-form">';
    echo '<table class="wp-list-table widefat fixed striped">';
    echo '<thead><tr><th>Image originale</th><th>URL de remplacement</th></tr></thead><tbody>';
    foreach ($all_images as $img) {
        $val = isset($image_map[$img]) ? $image_map[$img] : '';
        echo '<tr>';
        echo '<td><code style="word-break:break-all;">' . esc_html($img) . '</code></td>';
        echo '<td><input type="text" class="large-text" name="img_map[' . esc_attr($img) . ']" value="' . esc_attr($val) . '" placeholder="Laisser vide = garder l\'original"></td>';
        echo '</tr>';
    }
    echo '</tbody></table>';
    echo '<p><button type="submit" class="button button-primary">Enregistrer le mapping</button></p>';
    echo '</form>';
    echo '</div>';
}

/* ==========================================================================
   11. AJAX HANDLERS
   ========================================================================== */
// --- Deploy single page ---
add_action('wp_ajax_haroboz_deploy', function () {
    check_ajax_referer('haroboz_nonce', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error('Permission denied');

    $slug = sanitize_text_field($_POST['slug'] ?? '');
    if (!$slug) wp_send_json_error('No slug');

    $pages = haroboz_get_pages_data();
    $page_data = null;
    foreach ($pages as $p) {
        if ($p['slug'] === $slug) { $page_data = $p; break; }
    }
    if (!$page_data) wp_send_json_error('Page not found in data');

    $html = haroboz_get_html($slug);
    if (!$html) wp_send_json_error('HTML file not found');

    // Resolve relative links
    $html = haroboz_resolve_links($html, $slug);

    // Resolve parent ID
    $parent_id = 0;
    if (!empty($page_data['parent_slug'])) {
        $parent = haroboz_find_page_by_meta($page_data['parent_slug']);
        if ($parent) $parent_id = $parent->ID;
    }

    // WP slug = last segment only
    $wp_slug = basename(str_replace('/', '-', $slug));
    if (strpos($slug, '/') !== false) {
        $wp_slug = basename($slug);
    }

    // Check if page already exists
    $existing = haroboz_find_page_by_meta($slug);

    $page_args = [
        'post_title'   => $page_data['title'],
        'post_name'    => $wp_slug,
        'post_content' => '<!-- Managed by Haroboz Deployer -->',
        'post_status'  => 'publish',
        'post_type'    => 'page',
        'post_parent'  => $parent_id,
    ];

    if ($existing) {
        $page_args['ID'] = $existing->ID;
        $page_id = wp_update_post($page_args);
    } else {
        $page_id = wp_insert_post($page_args);
    }

    if (is_wp_error($page_id)) {
        wp_send_json_error($page_id->get_error_message());
    }

    // Store HTML and metadata in post meta
    update_post_meta($page_id, HAROBOZ_META_PREFIX . '_full_html', $html);
    update_post_meta($page_id, HAROBOZ_META_PREFIX . '_slug', $slug);
    update_post_meta($page_id, HAROBOZ_META_PREFIX . '_meta_desc', $page_data['meta_description']);
    update_post_meta($page_id, HAROBOZ_META_PREFIX . '_managed', '1');

    // Homepage handling
    if ($slug === 'index') {
        update_option('show_on_front', 'page');
        update_option('page_on_front', $page_id);
    }

    wp_send_json_success([
        'page_id' => $page_id,
        'slug'    => $slug,
        'title'   => $page_data['title'],
        'updated' => !!$existing,
    ]);
});

// --- Reset all pages ---
add_action('wp_ajax_haroboz_reset', function () {
    check_ajax_referer('haroboz_nonce', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error('Permission denied');

    $query = new WP_Query([
        'post_type'      => 'page',
        'posts_per_page' => -1,
        'meta_key'       => HAROBOZ_META_PREFIX . '_managed',
        'meta_value'     => '1',
    ]);

    $count = 0;
    foreach ($query->posts as $post) {
        wp_delete_post($post->ID, true);
        $count++;
    }

    // Reset homepage
    delete_option('page_on_front');

    wp_send_json_success(['deleted' => $count]);
});

// --- Status ---
add_action('wp_ajax_haroboz_status', function () {
    check_ajax_referer('haroboz_nonce', 'nonce');

    $pages = haroboz_get_pages_data();
    $deployed = [];
    foreach ($pages as $p) {
        $existing = haroboz_find_page_by_meta($p['slug']);
        $deployed[$p['slug']] = !!$existing;
    }
    wp_send_json_success(['deployed' => $deployed, 'total' => count($pages)]);
});

// --- Save image mapping ---
add_action('wp_ajax_haroboz_save_images', function () {
    check_ajax_referer('haroboz_nonce', 'nonce');
    if (!current_user_can('manage_options')) wp_send_json_error('Permission denied');

    $map = [];
    if (isset($_POST['img_map']) && is_array($_POST['img_map'])) {
        foreach ($_POST['img_map'] as $old => $new) {
            $map[sanitize_text_field($old)] = esc_url_raw($new);
        }
    }
    update_option('haroboz_image_map', $map);
    wp_send_json_success(['count' => count($map)]);
});
"""


# ---------------------------------------------------------------------------
# Admin JS generator
# ---------------------------------------------------------------------------
def generate_admin_js() -> str:
    return r"""(function($) {
    'use strict';

    var $log, $progress, $progressFill, $progressText;

    function log(msg, type) {
        type = type || 'info';
        var cls = type === 'error' ? 'haroboz-log-error' : (type === 'success' ? 'haroboz-log-success' : '');
        $log.show().append('<div class="' + cls + '">' + msg + '</div>');
        $log.scrollTop($log[0].scrollHeight);
    }

    function showProgress(current, total) {
        var pct = Math.round((current / total) * 100);
        $progress.show();
        $progressFill.css('width', pct + '%');
        $progressText.text(current + ' / ' + total + ' (' + pct + '%)');
    }

    $(function() {
        $log = $('#haroboz-log');
        $progress = $('.haroboz-progress');
        $progressFill = $('.haroboz-progress-fill');
        $progressText = $('.haroboz-progress-text');

        // Deploy all — sequential AJAX calls
        $('#haroboz-deploy-all').on('click', function() {
            if (!confirm('Déployer toutes les pages ?')) return;
            var $btn = $(this).prop('disabled', true);
            $log.empty();
            log('Démarrage du déploiement...');

            // Get list of slugs from table
            var slugs = [];
            $('.haroboz-deploy-single').each(function() {
                slugs.push($(this).data('slug'));
            });

            var total = slugs.length, done = 0, errors = 0;
            showProgress(0, total);

            function deployNext() {
                if (done >= total) {
                    log('Terminé ! ' + (total - errors) + '/' + total + ' pages déployées.', errors ? 'error' : 'success');
                    $btn.prop('disabled', false);
                    location.reload();
                    return;
                }
                var slug = slugs[done];
                $.post(harobozAjax.url, {
                    action: 'haroboz_deploy',
                    nonce: harobozAjax.nonce,
                    slug: slug
                }).done(function(res) {
                    if (res.success) {
                        log('✓ ' + res.data.title + ' (' + slug + ')', 'success');
                    } else {
                        log('✗ ' + slug + ' : ' + (res.data || 'Erreur'), 'error');
                        errors++;
                    }
                }).fail(function() {
                    log('✗ ' + slug + ' : erreur réseau', 'error');
                    errors++;
                }).always(function() {
                    done++;
                    showProgress(done, total);
                    deployNext();
                });
            }
            deployNext();
        });

        // Deploy single
        $('.haroboz-deploy-single').on('click', function() {
            var $btn = $(this).prop('disabled', true);
            var slug = $btn.data('slug');
            $log.empty();
            log('Déploiement de ' + slug + '...');

            $.post(harobozAjax.url, {
                action: 'haroboz_deploy',
                nonce: harobozAjax.nonce,
                slug: slug
            }).done(function(res) {
                if (res.success) {
                    log('✓ ' + res.data.title + ' déployée !', 'success');
                    location.reload();
                } else {
                    log('✗ Erreur : ' + (res.data || 'inconnue'), 'error');
                }
            }).fail(function() {
                log('✗ Erreur réseau', 'error');
            }).always(function() {
                $btn.prop('disabled', false);
            });
        });

        // Reset
        $('#haroboz-reset').on('click', function() {
            if (!confirm('ATTENTION : Supprimer toutes les pages créées par Haroboz ?')) return;
            var $btn = $(this).prop('disabled', true);
            $log.empty();
            log('Suppression en cours...');

            $.post(harobozAjax.url, {
                action: 'haroboz_reset',
                nonce: harobozAjax.nonce
            }).done(function(res) {
                if (res.success) {
                    log(res.data.deleted + ' pages supprimées.', 'success');
                    location.reload();
                } else {
                    log('Erreur : ' + (res.data || 'inconnue'), 'error');
                }
            }).fail(function() {
                log('Erreur réseau', 'error');
            }).always(function() {
                $btn.prop('disabled', false);
            });
        });

        // Image mapping form
        $('#haroboz-image-form').on('submit', function(e) {
            e.preventDefault();
            var data = $(this).serialize();
            $.post(harobozAjax.url, data + '&action=haroboz_save_images&nonce=' + harobozAjax.nonce)
                .done(function(res) {
                    if (res.success) {
                        alert('Mapping enregistré (' + res.data.count + ' images)');
                    } else {
                        alert('Erreur');
                    }
                });
        });
    });
})(jQuery);
"""


# ---------------------------------------------------------------------------
# Admin CSS generator
# ---------------------------------------------------------------------------
def generate_admin_css() -> str:
    return r"""
.haroboz-wrap { max-width: 1100px; }
.haroboz-stats { display: flex; gap: 16px; margin: 20px 0; }
.haroboz-card {
    background: #fff; border: 1px solid #ccd0d4; border-radius: 8px;
    padding: 20px 30px; text-align: center; min-width: 140px;
    box-shadow: 0 1px 3px rgba(0,0,0,.06);
}
.haroboz-card.haroboz-ok { border-left: 4px solid #00a32a; }
.haroboz-card.haroboz-wait { border-left: 4px solid #dba617; }
.haroboz-num { display: block; font-size: 32px; font-weight: 700; color: #1d2327; }
.haroboz-label { display: block; font-size: 13px; color: #646970; margin-top: 4px; }
.haroboz-actions { margin: 20px 0; }
.haroboz-cat { margin-top: 30px; padding-bottom: 8px; border-bottom: 2px solid #2271b1; }

/* Progress bar */
.haroboz-progress { margin: 16px 0; }
.haroboz-progress-bar {
    height: 24px; background: #e2e4e7; border-radius: 12px; overflow: hidden;
}
.haroboz-progress-fill {
    height: 100%; background: linear-gradient(90deg, #2271b1, #135e96);
    border-radius: 12px; transition: width .3s ease; width: 0%;
}
.haroboz-progress-text { text-align: center; margin-top: 6px; font-size: 13px; color: #50575e; }

/* Badges */
.haroboz-badge {
    display: inline-block; padding: 3px 10px; border-radius: 12px;
    font-size: 12px; font-weight: 600;
}
.haroboz-badge-ok { background: #d4edda; color: #155724; }
.haroboz-badge-wait { background: #fff3cd; color: #856404; }

/* Log */
.haroboz-log {
    background: #1d2327; color: #c3c4c7; padding: 16px; border-radius: 8px;
    max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 13px;
    margin: 16px 0;
}
.haroboz-log div { padding: 2px 0; }
.haroboz-log-success { color: #00a32a; }
.haroboz-log-error { color: #d63638; }
"""


# ---------------------------------------------------------------------------
# MAIN BUILD
# ---------------------------------------------------------------------------
def build(source_dir: str, output_dir: str, images_base_url: str | None = None,
          image_map_file: str | None = None):
    source = Path(source_dir)
    output = Path(output_dir)

    if not source.exists():
        print(f"ERROR: Source directory '{source}' not found.")
        return

    # Load image map if provided
    image_map = None
    if image_map_file:
        map_path = Path(image_map_file)
        if map_path.exists():
            image_map = json.loads(map_path.read_text(encoding="utf-8"))
            print(f"🖼️  Loaded {len(image_map)} image mappings from {map_path}")
        else:
            print(f"WARNING: Image map file '{map_path}' not found, skipping.")

    print(f"📂 Scanning {source}...")
    if images_base_url:
        print(f"🖼️  Images base URL: {images_base_url}")
    pages = scan_site(source, images_base_url, image_map)
    print(f"   Found {len(pages)} pages")

    # Prepare output directories
    plugin_dir = output / PLUGIN_SLUG
    if plugin_dir.exists():
        shutil.rmtree(plugin_dir)

    data_dir = plugin_dir / "data"
    html_dir = data_dir / "html"
    admin_dir = plugin_dir / "admin"
    plugin_img_dir = data_dir / "img"
    html_dir.mkdir(parents=True)
    admin_dir.mkdir(parents=True)

    # 0. Optimize and embed used images
    source_img_dir = source / "img"
    img_file_map = {}
    if source_img_dir.exists() and not images_base_url and not image_map:
        print("🖼️  Optimizing images...")
        used = collect_used_images(pages)
        print(f"   {len(used)} unique images referenced")
        img_file_map = build_images(source_img_dir, plugin_img_dir, used)
        print(f"   {len(img_file_map)} images optimized")

        # Rewrite image URLs in page HTML to use plugin endpoint
        for p in pages:
            for old_path, new_filename in img_file_map.items():
                p["html_content"] = p["html_content"].replace(
                    f'src="{old_path}"',
                    f'src="%%HAROBOZ_IMG%%/{new_filename}"',
                )
                p["html_content"] = p["html_content"].replace(
                    f"src='{old_path}'",
                    f"src='%%HAROBOZ_IMG%%/{new_filename}'",
                )
        # Re-extract image metadata after rewrite
        for p in pages:
            meta = extract_metadata(p["html_content"])
            p["images"] = meta["images"]

    # 1. Write individual HTML files
    print("📝 Writing HTML files...")
    for p in pages:
        fname = slug_to_filename(p["slug"])
        (html_dir / fname).write_text(p["html_content"], encoding="utf-8")

    # 2. Write pages.json (without html_content)
    pages_meta = [
        {
            "title": p["title"],
            "slug": p["slug"],
            "parent_slug": p["parent_slug"],
            "meta_description": p["meta_description"],
            "images": p["images"],
        }
        for p in pages
    ]
    (data_dir / "pages.json").write_text(
        json.dumps(pages_meta, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    print(f"   pages.json: {len(pages_meta)} entries")

    # 3. Write plugin PHP
    (plugin_dir / f"{PLUGIN_SLUG}.php").write_text(
        generate_plugin_php(), encoding="utf-8"
    )

    # 4. Write admin assets
    (admin_dir / "admin.js").write_text(generate_admin_js(), encoding="utf-8")
    (admin_dir / "admin.css").write_text(generate_admin_css(), encoding="utf-8")

    # 5. Create ZIP
    zip_path = output / f"{PLUGIN_SLUG}.zip"
    print(f"📦 Creating {zip_path}...")
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in sorted(plugin_dir.rglob("*")):
            if file.is_file():
                arcname = file.relative_to(output).as_posix()
                zf.write(file, arcname)

    # Summary
    zip_size = zip_path.stat().st_size / 1024
    print(f"\n✅ Build complete!")
    print(f"   Plugin: {plugin_dir}")
    print(f"   ZIP:    {zip_path} ({zip_size:.0f} KB)")
    print(f"   Pages:  {len(pages)}")
    print(f"\n   → Installez {zip_path.name} dans WordPress > Extensions > Ajouter")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build Haroboz WP Deployer plugin")
    parser.add_argument(
        "--source", default="preview", help="Source directory with HTML files (default: preview)"
    )
    parser.add_argument(
        "--output", default="wp-plugin", help="Output directory (default: wp-plugin)"
    )
    parser.add_argument(
        "--images-base-url",
        default=None,
        help="Base URL for images (e.g. https://haroboz.com/wp-content/uploads/haroboz-img). "
             "All /img/... paths will be rewritten to this URL.",
    )
    parser.add_argument(
        "--image-map",
        default=None,
        help="Path to image_map.json (generated by upload_images_wp.py). "
             "Maps local /img/... paths to WordPress media URLs.",
    )
    args = parser.parse_args()
    build(args.source, args.output, args.images_base_url, args.image_map)
