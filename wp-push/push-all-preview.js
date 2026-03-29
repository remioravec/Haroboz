#!/usr/bin/env node
/**
 * push-all-preview.js — Push ALL preview HTML pages to WordPress
 *
 * Reads each HTML file from preview/, extracts:
 *   - <title> → WP page title
 *   - <meta name="description"> → Yoast/RankMath meta
 *   - <main>...</main> → WP page content
 *   - slug from file path
 *   - parent page from directory structure
 *
 * Usage:
 *   node wp-push/push-all-preview.js                # Push all as draft
 *   node wp-push/push-all-preview.js --publish       # Push all as published
 *   node wp-push/push-all-preview.js --dry-run       # Preview only
 *   node wp-push/push-all-preview.js --retry         # Retry failed pages
 */

const fs = require('fs');
const path = require('path');
const wp = require('./wp-api');

const PREVIEW_DIR = path.resolve(__dirname, '..', 'preview');
const STATUS_FILE = path.resolve(__dirname, 'push-status.json');

// ===== Parse HTML helpers =====
function extractBetween(html, startTag, endTag) {
  const startIdx = html.indexOf(startTag);
  if (startIdx === -1) return '';
  const contentStart = startIdx + startTag.length;
  const endIdx = html.indexOf(endTag, contentStart);
  if (endIdx === -1) return '';
  return html.substring(contentStart, endIdx);
}

function extractTitle(html) {
  const match = html.match(/<title>([^<]+)<\/title>/);
  return match ? match[1].trim() : '';
}

function extractMetaDescription(html) {
  const match = html.match(/<meta\s+name="description"\s+content="([^"]+)"/);
  return match ? match[1].trim() : '';
}

function extractMainContent(html) {
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/);
  return mainMatch ? mainMatch[1].trim() : '';
}

// ===== Build page registry from preview files =====
function buildPageRegistry() {
  const pages = [];

  // Homepage
  const indexPath = path.join(PREVIEW_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    pages.push({
      file: indexPath,
      slug: 'accueil',
      wpSlug: '',  // Homepage
      parent: null,
      isIndex: true,
    });
  }

  // Crawl pages/ directory
  const pagesDir = path.join(PREVIEW_DIR, 'pages');
  function crawl(dir, parentSlug) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // Check for index.html (parent page)
        const indexFile = path.join(fullPath, 'index.html');
        if (fs.existsSync(indexFile)) {
          pages.push({
            file: indexFile,
            slug: entry.name,
            wpSlug: entry.name,
            parent: parentSlug,
            isIndex: true,
          });
        }
        // Crawl children
        crawl(fullPath, entry.name);
      } else if (entry.name.endsWith('.html') && entry.name !== 'index.html') {
        const slug = entry.name.replace('.html', '');
        pages.push({
          file: fullPath,
          slug: slug,
          wpSlug: slug,
          parent: parentSlug,
          isIndex: false,
        });
      }
    }
  }
  crawl(pagesDir, null);
  return pages;
}

// ===== Convert preview links to WP links =====
function convertLinks(html, baseUrl) {
  // /pages/packs-shooting/portrait-studio-cannes.html → /packs-shooting/portrait-studio-cannes/
  html = html.replace(/href="\/pages\/([^"]+)\.html"/g, `href="${baseUrl}/$1/"`);
  // /pages/packs-shooting/ → /packs-shooting/
  html = html.replace(/href="\/pages\/([^"]+)\/"/g, `href="${baseUrl}/$1/"`);
  // / → homepage
  html = html.replace(/href="\/"/g, `href="${baseUrl}/"`);
  // Image paths: ../../img/ → absolute
  html = html.replace(/src="\.\.\/\.\.\/img\//g, `src="${baseUrl}/wp-content/uploads/haroboz/`);
  html = html.replace(/src="\.\.\/img\//g, `src="${baseUrl}/wp-content/uploads/haroboz/`);
  html = html.replace(/src="\/img\//g, `src="${baseUrl}/wp-content/uploads/haroboz/`);
  return html;
}

// ===== Yoast SEO meta update =====
async function updateYoastMeta(pageId, metaTitle, metaDesc) {
  try {
    await wp.wpFetch(`/wp/v2/pages/${pageId}`, {
      method: 'PUT',
      body: JSON.stringify({
        meta: {
          _yoast_wpseo_title: metaTitle,
          _yoast_wpseo_metadesc: metaDesc,
        }
      })
    });
  } catch (e) {
    // Yoast may not be installed, try RankMath
    try {
      await wp.wpFetch(`/wp/v2/pages/${pageId}`, {
        method: 'PUT',
        body: JSON.stringify({
          meta: {
            rank_math_title: metaTitle,
            rank_math_description: metaDesc,
          }
        })
      });
    } catch (e2) {
      console.log(`   ⚠️  SEO meta non mis à jour (plugin non détecté)`);
    }
  }
}

// ===== Main push logic =====
async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isPublish = args.includes('--publish');
  const isRetry = args.includes('--retry');
  const status = isPublish ? 'publish' : 'draft';

  console.log('╔══════════════════════════════════════════╗');
  console.log('║   HAROBOZ — Push Preview → WordPress     ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : isPublish ? 'PUBLISH' : 'DRAFT'}\n`);

  // Test connection
  if (!isDryRun) {
    const connected = await wp.testConnection();
    if (!connected) {
      console.error('\n❌ Impossible de se connecter à WordPress.');
      console.error('   Vérifiez que le serveur est en ligne et que les credentials sont corrects.');
      process.exit(1);
    }
  }

  // Build registry
  const registry = buildPageRegistry();
  console.log(`📋 ${registry.length} pages trouvées dans preview/\n`);

  // Load previous status for retry mode
  let previousStatus = {};
  if (isRetry && fs.existsSync(STATUS_FILE)) {
    previousStatus = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
  }

  // Get existing WP pages for matching
  let existingPages = [];
  if (!isDryRun) {
    console.log('📡 Récupération des pages WordPress existantes...');
    existingPages = await wp.getAllPages();
    console.log(`   ${existingPages.length} pages existantes trouvées\n`);
  }

  // Track results
  const results = { success: [], failed: [], skipped: [] };
  const parentIdMap = {};  // slug → WP page ID

  // Sort: parent pages first (so we have their IDs for children)
  registry.sort((a, b) => {
    if (a.parent === null && b.parent !== null) return -1;
    if (a.parent !== null && b.parent === null) return 1;
    if (a.isIndex && !b.isIndex) return -1;
    if (!a.isIndex && b.isIndex) return 1;
    return 0;
  });

  for (const page of registry) {
    // Skip non-failed pages in retry mode
    if (isRetry && previousStatus[page.slug] === 'success') {
      console.log(`⏭️  ${page.slug} (déjà pushé)`);
      results.skipped.push(page.slug);
      continue;
    }

    const html = fs.readFileSync(page.file, 'utf8');
    const title = extractTitle(html);
    const metaDesc = extractMetaDescription(html);
    const mainContent = extractMainContent(html);

    if (!mainContent) {
      console.log(`⚠️  ${page.slug} — pas de <main> trouvé, skip`);
      results.skipped.push(page.slug);
      continue;
    }

    const wpContent = isDryRun ? mainContent : convertLinks(mainContent, wp.BASE_URL);
    const parentId = page.parent ? (parentIdMap[page.parent] || 0) : 0;

    console.log(`📄 ${page.slug}`);
    console.log(`   Title: ${title}`);
    console.log(`   Parent: ${page.parent || 'none'} (ID: ${parentId})`);
    console.log(`   Content: ${wpContent.length} chars`);

    if (isDryRun) {
      results.success.push(page.slug);
      continue;
    }

    try {
      // Check if page exists
      const existing = existingPages.find(p => p.slug === page.wpSlug);

      let result;
      if (existing) {
        // Update existing page
        result = await wp.updatePage(existing.id, {
          title: title.split('–')[0].split('|')[0].trim(),
          content: wpContent,
          status: status,
          parent: parentId,
        });
        console.log(`   ✅ Mise à jour #${result.id}`);
      } else {
        // Create new page
        result = await wp.createPage({
          title: title.split('–')[0].split('|')[0].trim(),
          content: wpContent,
          slug: page.wpSlug,
          status: status,
          parent: parentId,
        });
        console.log(`   ✅ Créée #${result.id}`);
      }

      // Store parent ID for children
      if (page.isIndex) {
        parentIdMap[page.slug] = result.id;
      }

      // Update SEO meta
      await updateYoastMeta(result.id, title, metaDesc);

      results.success.push(page.slug);

      // Rate limiting — 500ms between requests
      await new Promise(r => setTimeout(r, 500));
    } catch (err) {
      console.log(`   ❌ Erreur: ${err.message}`);
      results.failed.push(page.slug);
    }
  }

  // Save status
  const statusData = {};
  for (const s of results.success) statusData[s] = 'success';
  for (const f of results.failed) statusData[f] = 'failed';
  fs.writeFileSync(STATUS_FILE, JSON.stringify(statusData, null, 2));

  // Summary
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║              RÉSUMÉ                       ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log(`✅ Succès:  ${results.success.length}`);
  console.log(`❌ Échecs:  ${results.failed.length}`);
  console.log(`⏭️  Skippés: ${results.skipped.length}`);
  if (results.failed.length > 0) {
    console.log(`\nPages en échec: ${results.failed.join(', ')}`);
    console.log('Relancer avec --retry pour réessayer uniquement les échecs.');
  }
}

main().catch(err => {
  console.error('❌ Erreur fatale:', err.message);
  process.exit(1);
});
