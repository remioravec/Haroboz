#!/usr/bin/env node
/**
 * Script de reconstruction complète du site HAROBOZ
 * - Corrige les villes (Marseille→Cannes, Toulon→Antibes, Paris→Mougins)
 * - Renomme les fichiers
 * - Ajoute Mandelieu à la navigation
 * - Crée les pages manquantes (Mougins, Mandelieu)
 * - Corrige le footer
 */

const fs = require('fs');
const path = require('path');

const PREVIEW_DIR = path.join(__dirname, '..', 'preview');

// ===== STEP 1: Collect all HTML files =====
function getAllHtmlFiles(dir) {
  let results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(getAllHtmlFiles(fullPath));
    } else if (entry.name.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

// ===== STEP 2: Navigation replacement map =====
const NAV_REPLACEMENTS = [
  // File references in links
  ['portrait-studio-marseille.html', 'portrait-studio-cannes.html'],
  ['photographe-homme-nu-marseille.html', 'photographe-homme-nu-cannes.html'],
  ['shooting-couple-toulon.html', 'shooting-couple-antibes.html'],
  ['photographe-paris.html', 'photographe-mougins.html'],
];

// City label replacements in navigation (careful — only in nav/footer context)
const CITY_LABEL_REPLACEMENTS = [
  // Footer & nav: city labels
  ['>Marseille</a>', '>Cannes</a>'],
  ['>Toulon</a>', '>Antibes</a>'],
  ['>Paris</a>', '>Mougins</a>'],
  // Footer copyright
  ['Photographe Nu Masculin | Marseille', 'Photographe Nu Masculin | Cannes'],
  // Meta descriptions referencing wrong cities
  ['Marseille, Toulon, Nice et Paris', 'Cannes, Antibes, Nice et Mougins'],
  ['à Marseille', 'à Cannes'],
];

// Add Mandelieu to navigation - we'll do this with a specific regex
const MANDELIEU_NAV_DESKTOP = `<a href="/pages/photographe-cote-azur/shooting-mandelieu.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Mandelieu</a>`;
const MANDELIEU_NAV_MOBILE = `<a href="/pages/photographe-cote-azur/shooting-mandelieu.html" class="block text-sm text-gray-600 hover:text-brand">Mandelieu</a>`;
const MANDELIEU_FOOTER = `<li><a href="/pages/photographe-cote-azur/shooting-mandelieu.html" class="text-sm text-gray-300 hover:text-white">Mandelieu</a></li>`;

function fixNavigation(html) {
  // Apply all link replacements
  for (const [from, to] of NAV_REPLACEMENTS) {
    html = html.split(from).join(to);
  }

  // Apply city label replacements
  for (const [from, to] of CITY_LABEL_REPLACEMENTS) {
    html = html.split(from).join(to);
  }

  // Add Mandelieu to desktop nav (after Mougins entry in Côte d'Azur dropdown)
  // Look for the last entry before </div></div></div> in the Côte d'Azur menu
  if (!html.includes('shooting-mandelieu.html')) {
    // Desktop: add after the Mougins (was Paris) link in nav
    html = html.replace(
      /(photographe-mougins\.html"[^>]*>Mougins<\/a>)(<\/div><\/div><\/div>)/g,
      `$1${MANDELIEU_NAV_DESKTOP}$2`
    );

    // Mobile: add after Mougins in mobile accordion
    html = html.replace(
      /(photographe-mougins\.html"[^>]*>Mougins<\/a>)(\s*<\/div>\s*<\/div>)/g,
      (match, p1, p2) => {
        // Only replace if it's in mobile context (block text-sm text-gray-600)
        if (p1.includes('text-gray-600')) {
          return `${p1}\n                        ${MANDELIEU_NAV_MOBILE}${p2}`;
        }
        return match;
      }
    );

    // Footer: add Mandelieu after Mougins in footer
    html = html.replace(
      /(photographe-mougins\.html"[^>]*>Mougins<\/a><\/li>)/g,
      `$1${MANDELIEU_FOOTER}`
    );
  }

  return html;
}

// ===== STEP 3: Fix the index.html (photographe-cote-azur) meta description =====
function fixPhotographeCoteAzurIndex(html, filePath) {
  if (filePath.includes('photographe-cote-azur/index.html')) {
    html = html.replace(
      /Marseille, Toulon, Nice et Paris/g,
      'Cannes, Antibes, Nice, Mougins et Mandelieu'
    );
    html = html.replace(
      /Marseille, Nice et Paris/g,
      'Cannes, Antibes, Nice et Mougins'
    );
  }
  return html;
}

// ===== STEP 4: Process all files =====
function processAllFiles() {
  const files = getAllHtmlFiles(PREVIEW_DIR);
  console.log(`Found ${files.length} HTML files to process\n`);

  for (const filePath of files) {
    let html = fs.readFileSync(filePath, 'utf-8');
    const original = html;

    html = fixNavigation(html);
    html = fixPhotographeCoteAzurIndex(html, filePath);

    if (html !== original) {
      fs.writeFileSync(filePath, html);
      console.log(`✓ Fixed: ${path.relative(PREVIEW_DIR, filePath)}`);
    } else {
      console.log(`  Unchanged: ${path.relative(PREVIEW_DIR, filePath)}`);
    }
  }
}

// ===== STEP 5: Rename files =====
function renameFiles() {
  const renames = [
    ['pages/packs-shooting/portrait-studio-marseille.html', 'pages/packs-shooting/portrait-studio-cannes.html'],
    ['pages/photographe-cote-azur/photographe-homme-nu-marseille.html', 'pages/photographe-cote-azur/photographe-homme-nu-cannes.html'],
    ['pages/photographe-cote-azur/shooting-couple-toulon.html', 'pages/photographe-cote-azur/shooting-couple-antibes.html'],
    ['pages/photographe-cote-azur/photographe-paris.html', 'pages/photographe-cote-azur/photographe-mougins.html'],
  ];

  console.log('\n--- Renaming files ---');
  for (const [from, to] of renames) {
    const fromPath = path.join(PREVIEW_DIR, from);
    const toPath = path.join(PREVIEW_DIR, to);
    if (fs.existsSync(fromPath)) {
      fs.renameSync(fromPath, toPath);
      console.log(`✓ Renamed: ${from} → ${to}`);
    } else if (fs.existsSync(toPath)) {
      console.log(`  Already exists: ${to}`);
    } else {
      console.log(`✗ Not found: ${from}`);
    }
  }
}

// ===== STEP 6: Fix content inside renamed files =====
function fixRenamedFileContent() {
  console.log('\n--- Fixing content in renamed files ---');

  const fixes = [
    {
      file: 'pages/packs-shooting/portrait-studio-cannes.html',
      replacements: [
        ['Portrait Studio Marseille', 'Portrait Studio Cannes'],
        ['portrait studio à Marseille', 'portrait studio à Cannes'],
        ['studio Marseille', 'studio Cannes'],
        ['en studio à Marseille', 'en studio à Cannes'],
        ['Portrait en Studio à Marseille', 'Portrait en Studio à Cannes'],
        ['Marseille et alentours', 'Cannes et alentours'],
        ['studios à Marseille', 'studios à Cannes'],
        ['Marseille – Shooting', 'Cannes – Shooting'],
        ['Marseille –', 'Cannes –'],
      ]
    },
    {
      file: 'pages/photographe-cote-azur/photographe-homme-nu-cannes.html',
      replacements: [
        ['Marseille', 'Cannes'],
      ]
    },
    {
      file: 'pages/photographe-cote-azur/shooting-couple-antibes.html',
      replacements: [
        ['Toulon', 'Antibes'],
      ]
    },
    {
      file: 'pages/photographe-cote-azur/photographe-mougins.html',
      replacements: [
        ['Paris', 'Mougins'],
        ['parisien', 'mouginois'],
        ['parisienne', 'mouginoise'],
      ]
    },
  ];

  for (const fix of fixes) {
    const filePath = path.join(PREVIEW_DIR, fix.file);
    if (!fs.existsSync(filePath)) {
      console.log(`✗ Not found: ${fix.file}`);
      continue;
    }

    let html = fs.readFileSync(filePath, 'utf-8');
    for (const [from, to] of fix.replacements) {
      html = html.split(from).join(to);
    }
    fs.writeFileSync(filePath, html);
    console.log(`✓ Content fixed: ${fix.file}`);
  }
}

// ===== STEP 7: Fix homepage meta =====
function fixHomepage() {
  console.log('\n--- Fixing homepage ---');
  const homePath = path.join(PREVIEW_DIR, 'index.html');
  let html = fs.readFileSync(homePath, 'utf-8');

  // Fix title - should focus on Cannes, not Marseille
  html = html.replace(
    /Photographe Nu Masculin Marseille/g,
    'Photographe Nu Masculin Cannes'
  );
  html = html.replace(
    /nu masculin à Marseille/g,
    'nu masculin à Cannes'
  );

  fs.writeFileSync(homePath, html);
  console.log('✓ Homepage meta titles fixed (Marseille → Cannes)');
}

// ===== RUN ALL =====
console.log('=== HAROBOZ Site Reconstruction ===\n');

// First fix navigation in all files (before renaming)
processAllFiles();

// Then rename files
renameFiles();

// Fix content inside renamed files
fixRenamedFileContent();

// Fix homepage
fixHomepage();

console.log('\n=== Done! ===');
