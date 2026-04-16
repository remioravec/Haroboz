#!/usr/bin/env node
/**
 * fix-audit-bugs.js
 * Applies 7 audit fixes to all 28 HTML files in /workspaces/Haroboz/preview/
 */

const fs = require('fs');
const path = require('path');

const PREVIEW_DIR = '/workspaces/Haroboz/preview';

// ─── Collect all HTML files ───────────────────────────────────────────────────
function findHtmlFiles(dir) {
  let results = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findHtmlFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

const htmlFiles = findHtmlFiles(PREVIEW_DIR).sort();
console.log(`\nFound ${htmlFiles.length} HTML files.\n`);

// ─── Counters ─────────────────────────────────────────────────────────────────
const stats = {
  fix1: 0,  // phone number
  fix2: 0,  // Réalisations → L'Oeuvre dropdown (desktop + mobile)
  fix3: 0,  // Où me trouver cities → links
  fix4: 0,  // footer Lieux cities → links
  fix5: 0,  // homepage Mes lieux
  fix6: 0,  // shooting-exterieur-cote-azur → shooting-exterieur
  fix7: 0,  // missing French accents
};
const fileChanges = {};

// ─── L'Oeuvre desktop dropdown (exact HTML from index.html) ──────────────────
const OEUVRE_DESKTOP_DROPDOWN = `<div class="mega-menu-item relative h-full flex items-center">
                    <button class="flex items-center text-sm font-medium hover:text-brand-light transition-colors py-8">L'Oeuvre <i data-lucide="chevron-down" class="ml-1 w-4 h-4"></i></button>
                    <div class="mega-menu-content absolute top-20 left-1/2 -translate-x-1/2 w-64 bg-white shadow-xl rounded-b-lg border-t border-gray-100 overflow-hidden">
                        <div class="py-2">
                            <a href="/pages/portfolio/" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Toutes les oeuvres</a>
                            <a href="/pages/portfolio/galerie-portraits-hommes.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Portraits</a>
                            <a href="/pages/portfolio/#nus" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Nus &amp; Attributs</a>
                            <a href="/pages/portfolio/galerie-couples.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Couples &amp; Duos</a>
                            <a href="/pages/portfolio/#creation" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Création d'art</a>
                            <a href="/pages/portfolio/#reportages" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Reportages</a>
                        </div>
                    </div>
                </div>`;

// Mobile L'Oeuvre accordion (compact single-line form to match other pages)
const OEUVRE_MOBILE_ACCORDION = `<div class="border-b border-gray-100 py-3"><button class="flex justify-between items-center w-full text-left font-medium text-brand mobile-accordion-btn">L'Oeuvre <i data-lucide="chevron-down" class="w-4 h-4"></i></button><div class="hidden mt-3 space-y-3 pl-4 border-l-2 border-brand-50"><a href="/pages/portfolio/" class="block text-sm text-gray-600 hover:text-brand">Toutes les oeuvres</a><a href="/pages/portfolio/galerie-portraits-hommes.html" class="block text-sm text-gray-600 hover:text-brand">Portraits</a><a href="/pages/portfolio/#nus" class="block text-sm text-gray-600 hover:text-brand">Nus &amp; Attributs</a><a href="/pages/portfolio/galerie-couples.html" class="block text-sm text-gray-600 hover:text-brand">Couples &amp; Duos</a><a href="/pages/portfolio/#creation" class="block text-sm text-gray-600 hover:text-brand">Création d'art</a><a href="/pages/portfolio/#reportages" class="block text-sm text-gray-600 hover:text-brand">Reportages</a></div></div>`;

// ─── Process each file ────────────────────────────────────────────────────────
for (const filePath of htmlFiles) {
  let content = fs.readFileSync(filePath, 'utf8');
  let original = content;
  const changes = [];
  const isIndex = filePath === path.join(PREVIEW_DIR, 'index.html');

  // ── FIX 1: Replace fake phone number ────────────────────────────────────────
  const fix1Pattern = /tel:\+33600000000/g;
  const fix1Count = (content.match(fix1Pattern) || []).length;
  if (fix1Count > 0) {
    content = content.replace(fix1Pattern, 'tel:+33688704041');
    stats.fix1 += fix1Count;
    changes.push(`Fix1: replaced ${fix1Count} phone number(s)`);
  }

  // ── FIX 2: Réalisations → L'Oeuvre dropdown (non-index pages only) ──────────
  if (!isIndex) {
    // Desktop: flat "Réalisations" link → L'Oeuvre dropdown
    // Pattern varies slightly per page (some have transition-colors, some don't)
    // Use a regex to handle both variants
    const fix2DesktopPattern = /<a\s+href="\/pages\/portfolio\/"\s+class="text-sm font-medium hover:text-brand-light(?:\s+transition-colors)?">Réalisations<\/a>/g;
    const fix2DesktopCount = (content.match(fix2DesktopPattern) || []).length;
    if (fix2DesktopCount > 0) {
      content = content.replace(fix2DesktopPattern, OEUVRE_DESKTOP_DROPDOWN);
      stats.fix2 += fix2DesktopCount;
      changes.push(`Fix2 desktop: replaced ${fix2DesktopCount} "Réalisations" flat link(s)`);
    }

    // Mobile: flat "Réalisations" link → L'Oeuvre accordion
    // Two class variants found in the wild:
    //   class="block font-medium text-brand"
    //   class="block w-full text-left font-medium text-brand"
    const fix2MobilePattern = /<div class="border-b border-gray-100 py-3"><a href="\/pages\/portfolio\/" class="block(?:\s+w-full\s+text-left)?\s+font-medium text-brand">Réalisations<\/a><\/div>/g;
    const fix2MobileCount = (content.match(fix2MobilePattern) || []).length;
    if (fix2MobileCount > 0) {
      content = content.replace(fix2MobilePattern, OEUVRE_MOBILE_ACCORDION);
      stats.fix2 += fix2MobileCount;
      changes.push(`Fix2 mobile: replaced ${fix2MobileCount} "Réalisations" mobile link(s)`);
    }
  }

  // ── FIX 3: "Où me trouver" dropdown — span cities → links ──────────────────
  // Desktop nav — Marseille
  let c3 = 0;
  const desktopMarseilleSpan = /<span class="block px-6 py-3 text-sm text-brand font-medium">Marseille<\/span>/g;
  if (desktopMarseilleSpan.test(content)) {
    content = content.replace(
      /<span class="block px-6 py-3 text-sm text-brand font-medium">Marseille<\/span>/g,
      '<a href="/pages/photographe/photographe-marseille.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Marseille</a>'
    );
    c3++;
  }
  // Desktop nav — Toulon
  const desktopToulonSpan = /<span class="block px-6 py-3 text-sm text-brand font-medium">Toulon<\/span>/g;
  if (desktopToulonSpan.test(content)) {
    content = content.replace(
      /<span class="block px-6 py-3 text-sm text-brand font-medium">Toulon<\/span>/g,
      '<a href="/pages/photographe/photographe-toulon.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Toulon</a>'
    );
    c3++;
  }
  // Desktop nav — Paris
  const desktopParisSpan = /<span class="block px-6 py-3 text-sm text-brand font-medium">Paris<\/span>/g;
  if (desktopParisSpan.test(content)) {
    content = content.replace(
      /<span class="block px-6 py-3 text-sm text-brand font-medium">Paris<\/span>/g,
      '<a href="/pages/photographe/photographe-paris.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Paris</a>'
    );
    c3++;
  }

  // Mobile nav — Marseille
  const mobileMarseilleSpan = /<span class="block text-sm text-gray-600">Marseille<\/span>/g;
  if (mobileMarseilleSpan.test(content)) {
    content = content.replace(
      /<span class="block text-sm text-gray-600">Marseille<\/span>/g,
      '<a href="/pages/photographe/photographe-marseille.html" class="block text-sm text-gray-600 hover:text-brand">Marseille</a>'
    );
    c3++;
  }
  // Mobile nav — Toulon
  const mobileToulonSpan = /<span class="block text-sm text-gray-600">Toulon<\/span>/g;
  if (mobileToulonSpan.test(content)) {
    content = content.replace(
      /<span class="block text-sm text-gray-600">Toulon<\/span>/g,
      '<a href="/pages/photographe/photographe-toulon.html" class="block text-sm text-gray-600 hover:text-brand">Toulon</a>'
    );
    c3++;
  }
  // Mobile nav — Paris
  const mobileparisSpan = /<span class="block text-sm text-gray-600">Paris<\/span>/g;
  if (mobileparisSpan.test(content)) {
    content = content.replace(
      /<span class="block text-sm text-gray-600">Paris<\/span>/g,
      '<a href="/pages/photographe/photographe-paris.html" class="block text-sm text-gray-600 hover:text-brand">Paris</a>'
    );
    c3++;
  }

  if (c3 > 0) {
    stats.fix3 += c3;
    changes.push(`Fix3: made ${c3} city span(s) clickable in nav`);
  }

  // ── FIX 4: Footer "Lieux" section — span cities → links ────────────────────
  let c4 = 0;
  // Marseille in footer
  const footerMarseilleSpan = /<span class="text-sm text-gray-300">Marseille<\/span>/g;
  if (footerMarseilleSpan.test(content)) {
    content = content.replace(
      /<span class="text-sm text-gray-300">Marseille<\/span>/g,
      '<a href="/pages/photographe/photographe-marseille.html" class="text-sm text-gray-300 hover:text-white">Marseille</a>'
    );
    c4++;
  }
  // Toulon in footer
  const footerToulonSpan = /<span class="text-sm text-gray-300">Toulon<\/span>/g;
  if (footerToulonSpan.test(content)) {
    content = content.replace(
      /<span class="text-sm text-gray-300">Toulon<\/span>/g,
      '<a href="/pages/photographe/photographe-toulon.html" class="text-sm text-gray-300 hover:text-white">Toulon</a>'
    );
    c4++;
  }
  // Paris in footer
  const footerParisSpan = /<span class="text-sm text-gray-300">Paris<\/span>/g;
  if (footerParisSpan.test(content)) {
    content = content.replace(
      /<span class="text-sm text-gray-300">Paris<\/span>/g,
      '<a href="/pages/photographe/photographe-paris.html" class="text-sm text-gray-300 hover:text-white">Paris</a>'
    );
    c4++;
  }

  if (c4 > 0) {
    stats.fix4 += c4;
    changes.push(`Fix4: made ${c4} city span(s) clickable in footer`);
  }

  // ── FIX 5: Homepage "Mes lieux" section ─────────────────────────────────────
  if (isIndex) {
    let c5 = 0;
    // Marseille card in Mes lieux — href="/pages/photographe/" near "Marseille"
    // We look for the specific anchor that wraps Marseille text with the hub href
    const marseilleLieux = /<a href="\/pages\/photographe\/" class="flex items-center text-brand font-serif text-lg[^"]*hover:text-brand-light[^"]*group">\s*<i[^>]*><\/i>\s*Marseille\s*<\/a>/g;
    if (marseilleLieux.test(content)) {
      content = content.replace(
        marseilleLieux,
        (match) => match.replace('href="/pages/photographe/"', 'href="/pages/photographe/photographe-marseille.html"')
      );
      c5++;
    }
    // Toulon card
    const toulonLieux = /<a href="\/pages\/photographe\/" class="flex items-center text-brand font-serif text-lg[^"]*hover:text-brand-light[^"]*group">\s*<i[^>]*><\/i>\s*Toulon\s*<\/a>/g;
    if (toulonLieux.test(content)) {
      content = content.replace(
        toulonLieux,
        (match) => match.replace('href="/pages/photographe/"', 'href="/pages/photographe/photographe-toulon.html"')
      );
      c5++;
    }
    // Paris card
    const parisLieux = /<a href="\/pages\/photographe\/" class="flex items-center text-brand font-serif text-lg[^"]*hover:text-brand-light[^"]*group">\s*<i[^>]*><\/i>\s*Paris\s*<\/a>/g;
    if (parisLieux.test(content)) {
      content = content.replace(
        parisLieux,
        (match) => match.replace('href="/pages/photographe/"', 'href="/pages/photographe/photographe-paris.html"')
      );
      c5++;
    }

    if (c5 > 0) {
      stats.fix5 += c5;
      changes.push(`Fix5: fixed ${c5} city link(s) in "Mes lieux" section`);
    }
  }

  // ── FIX 6: shooting-exterieur-cote-azur → shooting-exterieur in hrefs ───────
  const fix6Pattern = /shooting-exterieur-cote-azur(\.html)?/g;
  const fix6Count = (content.match(fix6Pattern) || []).length;
  if (fix6Count > 0) {
    content = content.replace(fix6Pattern, (match, ext) => 'shooting-exterieur' + (ext || ''));
    stats.fix6 += fix6Count;
    changes.push(`Fix6: renamed ${fix6Count} shooting-exterieur-cote-azur reference(s)`);
  }

  // ── FIX 7: Missing French accents (visible text only, not URLs/classes/IDs) ──
  let c7 = 0;

  // Helper: replace in text nodes only (between > and <), not in attributes
  // We use a regex that matches text between tags
  function fixInText(html, from, to) {
    // Match content between > and < that contains our target string
    // This avoids touching attribute values
    return html.replace(/>([^<]*)</g, (match, text) => {
      if (text.includes(from)) {
        return '>' + text.split(from).join(to) + '<';
      }
      return match;
    });
  }

  // "coordonnees" → "coordonnées" in text nodes
  const before7a = (content.match(/>([^<]*coordonnees[^<]*)</g) || []).length;
  content = fixInText(content, 'coordonnees', 'coordonnées');
  const after7a = (content.match(/>([^<]*coordonnees[^<]*)</g) || []).length;
  c7 += before7a - after7a;

  // "echange" → "échange" in text nodes (standalone word)
  // Match word boundaries in text nodes
  const before7b = (content.match(/>([^<]*\bechange\b[^<]*)</g) || []).length;
  content = content.replace(/>([^<]*)</g, (match, text) => {
    if (/\bechange\b/.test(text)) {
      return '>' + text.replace(/\bechange\b/g, 'échange') + '<';
    }
    return match;
  });
  const after7b = (content.match(/>([^<]*\bechange\b[^<]*)</g) || []).length;
  c7 += before7b - after7b;

  // "experience" → "expérience" in text nodes (standalone word, not in URLs)
  const before7c = (content.match(/>([^<]*\bexperience\b[^<]*)</g) || []).length;
  content = content.replace(/>([^<]*)</g, (match, text) => {
    if (/\bexperience\b/.test(text)) {
      return '>' + text.replace(/\bexperience\b/g, 'expérience') + '<';
    }
    return match;
  });
  const after7c = (content.match(/>([^<]*\bexperience\b[^<]*)</g) || []).length;
  c7 += before7c - after7c;

  // "Etre rappele" → "Être rappelé"
  const before7d = (content.match(/>([^<]*Etre rappele[^<]*)</g) || []).length;
  content = fixInText(content, 'Etre rappele', 'Être rappelé');
  const after7d = (content.match(/>([^<]*Etre rappele[^<]*)</g) || []).length;
  c7 += before7d - after7d;

  // "Reserver" → "Réserver" in text nodes
  const before7e = (content.match(/>([^<]*\bReserver\b[^<]*)</g) || []).length;
  content = content.replace(/>([^<]*)</g, (match, text) => {
    if (/\bReserver\b/.test(text)) {
      return '>' + text.replace(/\bReserver\b/g, 'Réserver') + '<';
    }
    return match;
  });
  const after7e = (content.match(/>([^<]*\bReserver\b[^<]*)</g) || []).length;
  c7 += before7e - after7e;

  if (c7 > 0) {
    stats.fix7 += c7;
    changes.push(`Fix7: corrected ${c7} missing accent(s)`);
  }

  // ── Write if changed ─────────────────────────────────────────────────────────
  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf8');
    const relPath = path.relative(PREVIEW_DIR, filePath);
    fileChanges[relPath] = changes;
    console.log(`  [CHANGED] ${relPath}`);
    for (const c of changes) {
      console.log(`           → ${c}`);
    }
  } else {
    const relPath = path.relative(PREVIEW_DIR, filePath);
    console.log(`  [no-op]  ${relPath}`);
  }
}

// ─── Rename shooting-exterieur-cote-azur.html ────────────────────────────────
const oldFile = path.join(PREVIEW_DIR, 'pages/packs-shooting/shooting-exterieur-cote-azur.html');
const newFile = path.join(PREVIEW_DIR, 'pages/packs-shooting/shooting-exterieur.html');
if (fs.existsSync(oldFile)) {
  // We need to apply fix6 to its internal content too (already done above if it was in our list)
  // Just rename it
  if (!fs.existsSync(newFile)) {
    fs.renameSync(oldFile, newFile);
    console.log(`\n  [RENAMED] pages/packs-shooting/shooting-exterieur-cote-azur.html → shooting-exterieur.html`);
  } else {
    console.log(`\n  [INFO] shooting-exterieur.html already exists, skipping rename`);
  }
} else if (fs.existsSync(newFile)) {
  console.log(`\n  [INFO] File already renamed: shooting-exterieur.html exists`);
} else {
  console.log(`\n  [WARN] Could not find shooting-exterieur-cote-azur.html to rename`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log('\n' + '═'.repeat(60));
console.log('SUMMARY OF CHANGES');
console.log('═'.repeat(60));
console.log(`Fix 1 — Phone number replacements:          ${stats.fix1}`);
console.log(`Fix 2 — Réalisations→L'Oeuvre dropdown:    ${stats.fix2}`);
console.log(`Fix 3 — Où me trouver cities clickable:     ${stats.fix3}`);
console.log(`Fix 4 — Footer Lieux cities clickable:      ${stats.fix4}`);
console.log(`Fix 5 — Homepage Mes lieux city hrefs:      ${stats.fix5}`);
console.log(`Fix 6 — shooting-exterieur-cote-azur refs: ${stats.fix6}`);
console.log(`Fix 7 — Missing French accents:             ${stats.fix7}`);
console.log('─'.repeat(60));
console.log(`Files changed: ${Object.keys(fileChanges).length} / ${htmlFiles.length}`);

// ─── Verification: count remaining problem patterns ───────────────────────────
console.log('\n' + '═'.repeat(60));
console.log('VERIFICATION — Remaining problem patterns');
console.log('═'.repeat(60));

const allFiles = findHtmlFiles(PREVIEW_DIR);

let rem1 = 0, rem2 = 0, rem3a = 0, rem3b = 0, rem4 = 0, rem6 = 0, rem7 = 0;
for (const f of allFiles) {
  const c = fs.readFileSync(f, 'utf8');
  rem1 += (c.match(/tel:\+33600000000/g) || []).length;
  // Fix2: only count nav-area "Réalisations" flat links (desktop flat link and mobile flat div link)
  // Footer "Réalisations" in Haroboz column is intentional — exclude it
  rem2 += (c.match(/<a href="\/pages\/portfolio\/" class="text-sm font-medium hover:text-brand-light(?:\s+transition-colors)?">Réalisations<\/a>/g) || []).length;
  rem2 += (c.match(/<div class="border-b border-gray-100 py-3"><a href="\/pages\/portfolio\/" class="block(?:\s+w-full\s+text-left)?\s+font-medium text-brand">Réalisations<\/a><\/div>/g) || []).length;
  rem3a += (c.match(/<span class="block px-6 py-3 text-sm text-brand font-medium">(Marseille|Toulon|Paris)<\/span>/g) || []).length;
  rem3b += (c.match(/<span class="block text-sm text-gray-600">(Marseille|Toulon|Paris)<\/span>/g) || []).length;
  rem4 += (c.match(/<span class="text-sm text-gray-300">(Marseille|Toulon|Paris)<\/span>/g) || []).length;
  rem6 += (c.match(/shooting-exterieur-cote-azur/g) || []).length;
  // Fix7: count only unaccented forms that appear as visible text (between tags)
  // Use the same text-node approach: >...word...<
  rem7 += (c.match(/>([^<]*coordonnees[^<]*)</g) || []).length;
  rem7 += (c.match(/>([^<]*\bechange\b[^<]*)</g) || []).length;
  rem7 += (c.match(/>([^<]*Etre rappele[^<]*)</g) || []).length;
  rem7 += (c.match(/>([^<]*\bReserver\b[^<]*)</g) || []).length;
  // For "experience": only count if it's unaccented in text nodes (not in URLs or name= attributes)
  rem7 += (c.match(/>([^<]*[^é]experience[^<]*)</g) || []).length;
}

console.log(`Fix 1 — Remaining fake phone:                     ${rem1} ${rem1 === 0 ? 'OK' : 'STILL PRESENT'}`);
console.log(`Fix 2 — Remaining "Realisations" nav links:       ${rem2} ${rem2 === 0 ? 'OK' : 'STILL PRESENT'}`);
console.log(`Fix 3 — Remaining city spans in desktop nav:      ${rem3a} ${rem3a === 0 ? 'OK' : 'STILL PRESENT'}`);
console.log(`Fix 3 — Remaining city spans in mobile nav:       ${rem3b} ${rem3b === 0 ? 'OK' : 'STILL PRESENT'}`);
console.log(`Fix 4 — Remaining city spans in footer:           ${rem4} ${rem4 === 0 ? 'OK' : 'STILL PRESENT'}`);
console.log(`Fix 6 — Remaining cote-azur slug references:      ${rem6} ${rem6 === 0 ? 'OK' : 'STILL PRESENT'}`);
console.log(`Fix 7 — Remaining missing accent patterns:        ${rem7} ${rem7 === 0 ? 'OK' : 'STILL PRESENT'}`);

// Check old file no longer exists
const oldStillExists = fs.existsSync(path.join(PREVIEW_DIR, 'pages/packs-shooting/shooting-exterieur-cote-azur.html'));
const newExists = fs.existsSync(path.join(PREVIEW_DIR, 'pages/packs-shooting/shooting-exterieur.html'));
console.log(`Fix 6 — Old file deleted:                         ${!oldStillExists ? '✓' : '✗ OLD FILE STILL EXISTS'}`);
console.log(`Fix 6 — New file exists:                          ${newExists ? '✓' : '✗ NEW FILE MISSING'}`);

console.log('\nDone.\n');
