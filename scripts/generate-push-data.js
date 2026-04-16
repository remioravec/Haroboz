#!/usr/bin/env node
/**
 * HAROBOZ — Generate push data for WordPress MCP tool calls
 *
 * Reads all HTML files from preview/, processes them the same way as repush.js,
 * and outputs a JSON file at scripts/push-data.json with an array of page objects
 * ready for use with mcp__wordpress__run_api_function.
 *
 * Usage: node scripts/generate-push-data.js
 */

'use strict';

const fs   = require('fs');
const path = require('path');

const PREVIEW_DIR = path.join(__dirname, '..', 'preview');
const SITE_URL    = 'https://haroboz.com';
const OUTPUT_FILE = path.join(__dirname, 'push-data.json');

// ─── Helpers (copied from wp-push/repush.js) ─────────────────

function extractTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].trim() : '';
}

function extractMeta(html) {
  const m = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)
           || html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
  return m ? m[1].trim() : '';
}

function rewriteLinks(html, siteUrl) {
  // Anchor links: /pages/category/#anchor
  html = html.replace(/href="\/pages\/([^"\/]+)\/(#[^"]*)"/g,
    (_, cat, anchor) => 'href="' + siteUrl + '/' + cat + '/' + anchor + '"');
  // Category index: /pages/category/
  html = html.replace(/href="\/pages\/([^"\/]+)\/"/g,
    (_, cat) => 'href="' + siteUrl + '/' + cat + '/"');
  // Category index.html: /pages/category/index.html
  html = html.replace(/href="\/pages\/([^"\/]+)\/index\.html"/g,
    (_, cat) => 'href="' + siteUrl + '/' + cat + '/"');
  // Child page: /pages/category/page.html
  html = html.replace(/href="\/pages\/([^"\/]+)\/([^"]+)\.html"/g,
    (_, cat, pg) => 'href="' + siteUrl + '/' + cat + '/' + pg + '/"');
  // Top-level page: /pages/page.html
  html = html.replace(/href="\/pages\/([^"\/]+)\.html"/g,
    (_, pg) => 'href="' + siteUrl + '/' + pg + '/"');
  // Homepage
  html = html.replace(/href="\/"/g, 'href="' + siteUrl + '/"');
  return html;
}

function extractBody(rawHtml) {
  const m = rawHtml.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  let body = m ? m[1].trim() : rawHtml;
  // Strip all <script> blocks
  body = body.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  return body.trim();
}

function extractStyles(rawHtml) {
  const blocks = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(rawHtml)) !== null) blocks.push(m[1]);
  return blocks.join('\n');
}

function buildWpContent(html, siteUrl) {
  html = rewriteLinks(html, siteUrl);
  const bodyContent = extractBody(html);
  const pageStyles  = extractStyles(html);
  return '<style>\n' + pageStyles + '\n</style>\n<div class="haroboz-page">\n' + bodyContent + '\n</div>';
}

// ─── Filesystem scan ─────────────────────────────────────────

function findHtmlFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(findHtmlFiles(full));
    else if (entry.name.endsWith('.html')) results.push(full);
  }
  return results;
}

// ─── Main ────────────────────────────────────────────────────

function main() {
  console.log('Scanning preview/ for HTML files...');
  const files = findHtmlFiles(PREVIEW_DIR);
  console.log(`Found ${files.length} HTML files.`);

  const pages = [];

  for (const fp of files) {
    const rel   = path.relative(PREVIEW_DIR, fp).replace(/\\/g, '/');
    const html  = fs.readFileSync(fp, 'utf-8');
    const parts = rel.split('/');

    let slug, wpSlug, parentSlug, isHome;

    if (rel === 'index.html') {
      isHome = true; slug = 'accueil'; wpSlug = ''; parentSlug = null;
    } else if (parts.length === 2 && parts[0] === 'pages') {
      // pages/contact.html → top-level page
      isHome = false; slug = parts[1].replace('.html', ''); wpSlug = slug; parentSlug = null;
    } else if (parts.length === 3 && parts[2] === 'index.html') {
      // pages/packs-shooting/index.html → parent page
      isHome = false; slug = parts[1]; wpSlug = parts[1]; parentSlug = null;
    } else if (parts.length === 3) {
      // pages/packs-shooting/portrait-studio.html → child page
      isHome = false; slug = parts[2].replace('.html', ''); wpSlug = slug; parentSlug = parts[1];
    } else {
      isHome = false; slug = rel.replace('.html', '').replace(/\//g, '-'); wpSlug = slug; parentSlug = null;
    }

    const title   = extractTitle(html);
    const metaDesc = extractMeta(html);
    const content = buildWpContent(html, SITE_URL);

    // Warn about any remaining /pages/ links
    const remaining = (content.match(/href="\/pages\//g) || []).length;
    if (remaining > 0) {
      console.warn(`  WARN: ${rel} — ${remaining} liens /pages/ non transformés`);
    }

    pages.push({
      file: rel,
      slug,
      wpSlug,
      parentSlug,
      isHome,
      title,
      metaDesc,
      content,
    });
  }

  // Sort: home first, then parents (no parentSlug), then children
  pages.sort((a, b) => {
    if (a.isHome) return -1;
    if (b.isHome) return 1;
    if (!a.parentSlug && b.parentSlug) return -1;
    if (a.parentSlug && !b.parentSlug) return 1;
    return a.slug.localeCompare(b.slug);
  });

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(pages, null, 2), 'utf-8');

  console.log(`\nOutput written to: ${OUTPUT_FILE}`);
  console.log(`Total pages: ${pages.length}`);
  console.log('\nBreakdown:');
  const home     = pages.filter(p => p.isHome);
  const parents  = pages.filter(p => !p.isHome && !p.parentSlug);
  const children = pages.filter(p => !p.isHome && p.parentSlug);
  console.log(`  Home:     ${home.length}`);
  console.log(`  Parents:  ${parents.length}`);
  console.log(`  Children: ${children.length}`);
  console.log('\nPage list (in push order):');
  for (const p of pages) {
    const tag = p.isHome ? '[HOME]' : p.parentSlug ? `[child of ${p.parentSlug}]` : '[parent]';
    console.log(`  ${tag.padEnd(30)} ${p.file}`);
  }
}

main();
