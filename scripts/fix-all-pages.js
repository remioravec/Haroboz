#!/usr/bin/env node
/**
 * fix-all-pages.js
 * Bulk fixes applied to all HTML pages in preview/
 * Excludes: photographe-cote-azur/ and photographe/ directories
 */

const fs = require('fs');
const path = require('path');

const PREVIEW_DIR = '/workspaces/Haroboz/preview';

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function decodeHtmlEntities(str) {
  return str
    .replace(/&agrave;/gi, 'à').replace(/&eacute;/gi, 'é').replace(/&egrave;/gi, 'è')
    .replace(/&ecirc;/gi, 'ê').replace(/&euml;/gi, 'ë').replace(/&ocirc;/gi, 'ô')
    .replace(/&ucirc;/gi, 'û').replace(/&ugrave;/gi, 'ù').replace(/&icirc;/gi, 'î')
    .replace(/&iuml;/gi, 'ï').replace(/&acirc;/gi, 'â').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&nbsp;/gi, ' ')
    .replace(/&mdash;/gi, '—').replace(/&ndash;/gi, '–').replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»').replace(/&Agrave;/g, 'À').replace(/&Eacute;/g, 'É')
    .replace(/&Egrave;/g, 'È').replace(/&Ecirc;/g, 'Ê').replace(/&Ocirc;/g, 'Ô')
    .replace(/&Ucirc;/g, 'Û').replace(/&Ugrave;/g, 'Ù').replace(/&Icirc;/g, 'Î')
    .replace(/&cedil;/gi, 'ç').replace(/&#039;/g, "'");
}

function truncateAtWord(str, maxLen) {
  if (str.length <= maxLen) return str;
  const truncated = str.substring(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  const cut = lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated;
  return cut.replace(/[,\-–]\s*$/, '').trim();
}

// ────────────────────────────────────────────────────────────────────────────
// Collect files to process
// ────────────────────────────────────────────────────────────────────────────

function collectHtmlFiles(dir, fileList = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip excluded directories
      if (
        fullPath.includes('/photographe-cote-azur') ||
        fullPath.endsWith('/photographe')
      ) continue;
      collectHtmlFiles(fullPath, fileList);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const htmlFiles = collectHtmlFiles(PREVIEW_DIR);
console.log(`\nProcessing ${htmlFiles.length} HTML files (excluding photographe-cote-azur/ and photographe/)\n`);

// ────────────────────────────────────────────────────────────────────────────
// Canonical path computation
// ────────────────────────────────────────────────────────────────────────────

function getCanonicalUrl(filePath) {
  const rel = path.relative(PREVIEW_DIR, filePath);
  if (rel === 'index.html') return 'https://haroboz.com/';
  const withoutExt = rel.replace(/\.html$/, '').replace(/\/index$/, '');
  const cleanPath = withoutExt.replace(/^pages\//, '');
  return `https://haroboz.com/${cleanPath}/`;
}

// ────────────────────────────────────────────────────────────────────────────
// Per-file title overrides (already decoded)
// ────────────────────────────────────────────────────────────────────────────

const TITLE_OVERRIDES = {
  'pages/boutique/galerie-privee-client.html': 'Galerie Privée Client – Accès Sécurisé | Haroboz',
  'pages/a-propos/index.html': 'Haroboz – Luc Desbois, Photographe Art Masculin',
  'pages/a-propos/luc-desbois-photographe.html': 'Vision Artistique – Luc Desbois | Haroboz',
  'pages/boutique/carte-cadeau.html': 'Carte Cadeau Shooting Photo | Haroboz',
  'pages/boutique/tirages-art-edition-limitee.html': "Tirages d'Art Édition Limitée | Haroboz",
  'index.html': 'Photographe Art Masculin – Shooting & Tirage | Haroboz',
};

// ────────────────────────────────────────────────────────────────────────────
// Deleted pages → redirect to /pages/photographe/
// ────────────────────────────────────────────────────────────────────────────

const DELETED_PAGES = [
  'photographe-mougins.html',
  'shooting-couple-antibes.html',
  'shooting-mandelieu.html',
  'photographe-homme-nu-cannes.html',
];

// ────────────────────────────────────────────────────────────────────────────
// Desktop "Où me trouver" menu content replacement
// ────────────────────────────────────────────────────────────────────────────

const DESKTOP_OU_ME_TROUVER_OLD = `<div class="py-2"><span class="block px-6 py-3 text-sm text-brand font-medium">Marseille</span><span class="block px-6 py-3 text-sm text-brand font-medium">Toulon</span><a href="/pages/photographe-cote-azur/photographe-nice.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand">Nice</a><span class="block px-6 py-3 text-sm text-brand font-medium">Paris</span></div>`;

const DESKTOP_OU_ME_TROUVER_NEW = `<div class="py-2"><a href="/pages/photographe/photographe-marseille.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand">Marseille</a><a href="/pages/photographe/photographe-toulon.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand">Toulon</a><a href="/pages/photographe/photographe-nice.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand">Nice</a><a href="/pages/photographe/photographe-paris.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand">Paris</a></div>`;

// ────────────────────────────────────────────────────────────────────────────
// Mobile "Où me trouver" menu content replacement
// ────────────────────────────────────────────────────────────────────────────

const MOBILE_OU_ME_TROUVER_OLD = `<div class="hidden mt-3 space-y-3 pl-4 border-l-2 border-brand-50"><span class="block text-sm text-brand font-medium">Marseille</span><span class="block text-sm text-brand font-medium">Toulon</span><a href="/pages/photographe-cote-azur/photographe-nice.html" class="block text-sm text-gray-600 hover:text-brand">Nice</a><span class="block text-sm text-brand font-medium">Paris</span></div>`;

const MOBILE_OU_ME_TROUVER_NEW = `<div class="hidden mt-3 space-y-3 pl-4 border-l-2 border-brand-50"><a href="/pages/photographe/photographe-marseille.html" class="block text-sm text-gray-600 hover:text-brand">Marseille</a><a href="/pages/photographe/photographe-toulon.html" class="block text-sm text-gray-600 hover:text-brand">Toulon</a><a href="/pages/photographe/photographe-nice.html" class="block text-sm text-gray-600 hover:text-brand">Nice</a><a href="/pages/photographe/photographe-paris.html" class="block text-sm text-gray-600 hover:text-brand">Paris</a></div>`;

// ────────────────────────────────────────────────────────────────────────────
// Footer Lieux old → new
// ────────────────────────────────────────────────────────────────────────────

const FOOTER_LIEUX_OLD = `<div><h4 class="font-serif text-lg font-bold mb-4">Lieux</h4><ul class="space-y-2"><li><span class="text-sm text-gray-300">Marseille</span></li><li><span class="text-sm text-gray-300">Toulon</span></li><li><a href="/pages/photographe-cote-azur/photographe-nice.html" class="text-sm text-gray-300 hover:text-white">Nice</a></li><li><span class="text-sm text-gray-300">Paris</span></li></ul></div>`;

const FOOTER_LIEUX_NEW = `<div><div class="font-serif text-lg font-bold mb-4">Lieux</div><ul class="space-y-2"><li><a href="/pages/photographe/photographe-marseille.html" class="text-sm text-gray-300 hover:text-white">Marseille</a></li><li><a href="/pages/photographe/photographe-toulon.html" class="text-sm text-gray-300 hover:text-white">Toulon</a></li><li><a href="/pages/photographe/photographe-nice.html" class="text-sm text-gray-300 hover:text-white">Nice</a></li><li><a href="/pages/photographe/photographe-paris.html" class="text-sm text-gray-300 hover:text-white">Paris</a></li></ul></div>`;

// ────────────────────────────────────────────────────────────────────────────
// Process each file
// ────────────────────────────────────────────────────────────────────────────

let totalChanges = 0;

for (const filePath of htmlFiles) {
  const relPath = path.relative(PREVIEW_DIR, filePath);
  let content = fs.readFileSync(filePath, 'utf8');
  const original = content;
  const changes = [];

  // ── 1. Fix broken internal links ────────────────────────────────────────

  const linkFixes = [
    [
      'href="/pages/votre-experience/premier-shooting.html"',
      'href="/pages/votre-experience/premier-shooting-nu.html"',
      'broken link: premier-shooting → premier-shooting-nu',
    ],
    [
      'href="/pages/votre-experience/retrouver-confiance.html"',
      'href="/pages/votre-experience/retrouver-confiance-corps.html"',
      'broken link: retrouver-confiance → retrouver-confiance-corps',
    ],
    [
      'href="/pages/boutique/tirages-art.html"',
      'href="/pages/boutique/tirages-art-edition-limitee.html"',
      'broken link: tirages-art → tirages-art-edition-limitee',
    ],
    [
      'href="/pages/boutique/galerie-privee.html"',
      'href="/pages/boutique/galerie-privee-client.html"',
      'broken link: galerie-privee → galerie-privee-client',
    ],
  ];

  for (const [oldHref, newHref, desc] of linkFixes) {
    if (content.includes(oldHref)) {
      content = content.split(oldHref).join(newHref);
      changes.push(`  [1] ${desc}`);
    }
  }

  // ── 2. Path references for renamed/moved files ───────────────────────────

  // portrait-studio-cannes.html → portrait-studio.html
  if (content.includes('portrait-studio-cannes.html')) {
    content = content.split('portrait-studio-cannes.html').join('portrait-studio.html');
    changes.push('  [2] portrait-studio-cannes.html → portrait-studio.html');
  }

  // Handle deleted pages first (before generic photographe-cote-azur replacement)
  for (const deletedPage of DELETED_PAGES) {
    const oldHref = `href="/pages/photographe-cote-azur/${deletedPage}"`;
    if (content.includes(oldHref)) {
      content = content.split(oldHref).join('href="/pages/photographe/"');
      changes.push(`  [2] Deleted page link removed: ${deletedPage} → /pages/photographe/`);
    }
  }

  // Replace remaining photographe-cote-azur/ hrefs with photographe/
  if (content.includes('href="/pages/photographe-cote-azur/')) {
    content = content.split('href="/pages/photographe-cote-azur/').join('href="/pages/photographe/');
    changes.push('  [2] photographe-cote-azur/ → photographe/ (href refs)');
  }

  // ── 3. Add canonical tag ─────────────────────────────────────────────────

  const canonicalUrl = getCanonicalUrl(filePath);
  if (!content.includes('rel="canonical"')) {
    const canonicalTag = `    <link rel="canonical" href="${canonicalUrl}">\n`;
    content = content.replace('</head>', canonicalTag + '</head>');
    changes.push(`  [3] Added canonical: ${canonicalUrl}`);
  }

  // ── 4. Add Open Graph tags ───────────────────────────────────────────────

  if (!content.includes('og:title')) {
    const titleMatch = content.match(/<title>([^<]+)<\/title>/);
    let titleText = titleMatch ? decodeHtmlEntities(titleMatch[1]).trim() : 'Haroboz';

    const descMatch = content.match(/<meta name="description" content="([^"]+)"/);
    let descText = descMatch ? decodeHtmlEntities(descMatch[1]).trim() : '';

    const ogTags = `    <meta property="og:title" content="${titleText}">
    <meta property="og:description" content="${descText}">
    <meta property="og:type" content="website">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:image" content="https://haroboz.com/wp-content/uploads/haroboz-og.jpg">`;

    if (descMatch) {
      const descLine = `<meta name="description" content="${descMatch[1]}">`;
      content = content.replace(descLine, descLine + '\n' + ogTags);
    } else {
      content = content.replace('</title>', '</title>\n' + ogTags);
    }
    changes.push('  [4] Added OG tags');
  }

  // ── 5. Fix meta titles > 60 characters ──────────────────────────────────

  const titleOverride = TITLE_OVERRIDES[relPath];
  if (titleOverride) {
    const titleMatch = content.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      const currentDecoded = decodeHtmlEntities(titleMatch[1]).trim();
      if (currentDecoded !== titleOverride) {
        content = content.replace(/<title>[^<]+<\/title>/, `<title>${titleOverride}</title>`);
        changes.push(`  [5] Title updated: "${titleOverride}"`);
      }
    }
  } else {
    const titleMatch = content.match(/<title>([^<]+)<\/title>/);
    if (titleMatch) {
      const decoded = decodeHtmlEntities(titleMatch[1]).trim();
      if (decoded.length > 60) {
        const truncated = truncateAtWord(decoded, 57) + '...';
        if (truncated !== decoded) {
          content = content.replace(/<title>[^<]+<\/title>/, `<title>${truncated}</title>`);
          changes.push(`  [5] Title truncated to ${truncated.length} chars: "${truncated}"`);
        }
      }
    }
  }

  // ── 5b. Sync og:title with final <title> ────────────────────────────────

  {
    const titleMatch = content.match(/<title>([^<]+)<\/title>/);
    const ogTitleMatch = content.match(/<meta property="og:title" content="([^"]+)"/);
    if (titleMatch && ogTitleMatch) {
      const currentTitle = titleMatch[1]; // may be HTML-entity-encoded or plain
      const currentOgTitle = ogTitleMatch[1];
      if (currentTitle !== currentOgTitle) {
        content = content.replace(
          `<meta property="og:title" content="${currentOgTitle}"`,
          `<meta property="og:title" content="${currentTitle}"`
        );
        changes.push(`  [5b] og:title synced with title tag`);
      }
    }
  }

  // ── 6. Fix meta descriptions > 160 characters ───────────────────────────

  const descMatch2 = content.match(/<meta name="description" content="([^"]+)"/);
  if (descMatch2) {
    const rawDesc = descMatch2[1];
    const decoded = decodeHtmlEntities(rawDesc).trim();
    if (decoded.length > 160) {
      const truncated = truncateAtWord(decoded, 155) + '.';
      content = content.replace(
        `<meta name="description" content="${rawDesc}"`,
        `<meta name="description" content="${truncated}"`
      );
      changes.push(`  [6] Meta description truncated to ${truncated.length} chars`);
    }
  }

  // ── 7. Replace footer <h4> with <div> ───────────────────────────────────

  if (/<h4 class="font-serif text-lg font-bold mb-4">/.test(content)) {
    const countBefore = (content.match(/<h4 class="font-serif text-lg font-bold mb-4">/g) || []).length;
    content = content.replace(/<h4 class="font-serif text-lg font-bold mb-4">/g, '<div class="font-serif text-lg font-bold mb-4">');
    // Replace closing tags — all </h4> in these pages are from footer columns
    const closingCount = (content.match(/<\/h4>/g) || []).length;
    content = content.replace(/<\/h4>/g, '</div>');
    changes.push(`  [7] Replaced ${countBefore} <h4> with <div> (${closingCount} closing tags)`);
  }

  // ── 8. Update footer "Lieux" section ────────────────────────────────────

  if (content.includes(FOOTER_LIEUX_OLD)) {
    content = content.replace(FOOTER_LIEUX_OLD, FOOTER_LIEUX_NEW);
    changes.push('  [8] Footer Lieux section updated with 4 city links');
  } else {
    // Try after h4→div replacement (the div version)
    const FOOTER_LIEUX_OLD_DIV = FOOTER_LIEUX_OLD
      .replace('<h4 class="font-serif text-lg font-bold mb-4">', '<div class="font-serif text-lg font-bold mb-4">')
      .replace('</h4>', '</div>');
    if (content.includes(FOOTER_LIEUX_OLD_DIV)) {
      content = content.replace(FOOTER_LIEUX_OLD_DIV, FOOTER_LIEUX_NEW);
      changes.push('  [8] Footer Lieux section updated (post-div replacement)');
    }
  }

  // ── 9. Update "Où me trouver" menu (desktop + mobile) ───────────────────

  if (content.includes(DESKTOP_OU_ME_TROUVER_OLD)) {
    content = content.replace(DESKTOP_OU_ME_TROUVER_OLD, DESKTOP_OU_ME_TROUVER_NEW);
    changes.push('  [9] Desktop "Où me trouver" menu updated');
  }

  if (content.includes(MOBILE_OU_ME_TROUVER_OLD)) {
    content = content.replace(MOBILE_OU_ME_TROUVER_OLD, MOBILE_OU_ME_TROUVER_NEW);
    changes.push('  [9] Mobile "Où me trouver" menu updated');
  }

  // Also fix any already-updated Nice link still pointing to photographe-cote-azur
  // (handled by step 2 already)

  // ── 10. Purge residual "Côte d'Azur" mentions from non-geo pages ─────────

  const isGeoPage = relPath.includes('photographe/') ||
                    relPath.includes('photographe-cote-azur/');

  if (!isGeoPage) {
    // Protect the filename in href attributes
    const placeholder = '___EXTERIEUR_COTE_AZUR_PLACEHOLDER___';
    let safeContent = content.split('shooting-exterieur-cote-azur').join(placeholder);

    // Also protect "Côte d'Azur" that appears inside href attributes (filenames etc.)
    const coteDazurRegex = /C[oô]te d[''']Azur/g;
    if (coteDazurRegex.test(safeContent)) {
      const count = (safeContent.match(/C[oô]te d[''']Azur/g) || []).length;
      safeContent = safeContent.replace(/C[oô]te d[''']Azur/g, 'Sud de la France');
      changes.push(`  [10] ${count} 'Côte d'Azur' replaced with 'Sud de la France'`);
    }

    content = safeContent.split(placeholder).join('shooting-exterieur-cote-azur');
  }

  // ── Write file if changed ────────────────────────────────────────────────

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalChanges++;
    console.log(`\n✓ ${relPath} (${changes.length} fix group${changes.length > 1 ? 's' : ''})`);
    for (const c of changes) console.log(c);
  } else {
    console.log(`  ${relPath} — no changes`);
  }
}

console.log(`\n═══════════════════════════════════════════════════════`);
console.log(`DONE. ${totalChanges} files modified out of ${htmlFiles.length} processed.`);
console.log(`═══════════════════════════════════════════════════════\n`);
