#!/usr/bin/env node
/**
 * Fix all UX/UI audit bugs across the preview site.
 * Run: node scripts/fix-audit-ux.js
 */
const fs = require('fs');
const path = require('path');

const PREVIEW = path.join(__dirname, '..', 'preview');

// Helper: read file
const read = (f) => fs.readFileSync(f, 'utf8');
// Helper: write file
const write = (f, content) => fs.writeFileSync(f, content, 'utf8');

// ============================================================
// CORRECT NAV BLOCKS (from contact.html — the reference page)
// ============================================================

// Desktop nav — 5 dropdowns + L'Univers link, with proper UTF-8 and transition-colors
const CORRECT_DESKTOP_NAV = `<nav class="hidden lg:flex space-x-8 h-full items-center">
                    <div class="mega-menu-item relative h-full flex items-center"><button class="flex items-center text-sm font-medium hover:text-brand-light transition-colors py-8">Nos Séances <i data-lucide="chevron-down" class="ml-1 w-4 h-4"></i></button><div class="mega-menu-content absolute top-20 left-1/2 -translate-x-1/2 w-64 bg-white shadow-xl rounded-b-lg border-t border-gray-100"><div class="py-2"><a href="/pages/packs-shooting/portrait-studio.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Portrait en Studio</a><a href="/pages/packs-shooting/shooting-exterieur.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Shooting en Extérieur</a><a href="/pages/packs-shooting/photo-domicile.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Photo à Domicile</a><a href="/pages/packs-shooting/shooting-duo-couple.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Shooting Duo &amp; Couple</a></div></div></div>
                    <div class="mega-menu-item relative h-full flex items-center"><button class="flex items-center text-sm font-medium hover:text-brand-light transition-colors py-8">Votre Objectif <i data-lucide="chevron-down" class="ml-1 w-4 h-4"></i></button><div class="mega-menu-content absolute top-20 left-1/2 -translate-x-1/2 w-80 bg-white shadow-xl rounded-b-lg border-t border-gray-100"><div class="py-2"><a href="/pages/votre-experience/retrouver-confiance-corps.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Confiance &amp; Acceptation</a><a href="/pages/votre-experience/book-modele-professionnel.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Book Professionnel</a><a href="/pages/votre-experience/cadeau-couple-original.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Immortaliser son Couple</a><a href="/pages/votre-experience/premier-shooting-nu.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Cadeau &amp; Célébration</a></div></div></div>
                    <div class="mega-menu-item relative h-full flex items-center"><button class="flex items-center text-sm font-medium hover:text-brand-light transition-colors py-8">Où me trouver ? <i data-lucide="chevron-down" class="ml-1 w-4 h-4"></i></button><div class="mega-menu-content absolute top-20 left-1/2 -translate-x-1/2 w-48 bg-white shadow-xl rounded-b-lg border-t border-gray-100"><div class="py-2"><a href="/pages/photographe/photographe-marseille.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Marseille</a><a href="/pages/photographe/photographe-toulon.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Toulon</a><a href="/pages/photographe/photographe-nice.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Nice</a><a href="/pages/photographe/photographe-paris.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Paris</a></div></div></div>
                    <div class="mega-menu-item relative h-full flex items-center"><button class="flex items-center text-sm font-medium hover:text-brand-light transition-colors py-8">L'Oeuvre <i data-lucide="chevron-down" class="ml-1 w-4 h-4"></i></button><div class="mega-menu-content absolute top-20 left-1/2 -translate-x-1/2 w-64 bg-white shadow-xl rounded-b-lg border-t border-gray-100 overflow-hidden"><div class="py-2"><a href="/pages/portfolio/" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Toutes les oeuvres</a><a href="/pages/portfolio/galerie-portraits-hommes.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Portraits</a><a href="/pages/portfolio/#nus" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Nus &amp; Attributs</a><a href="/pages/portfolio/galerie-couples.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Couples &amp; Duos</a><a href="/pages/portfolio/#creation" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Création d'art</a><a href="/pages/portfolio/#reportages" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Reportages</a></div></div></div>
                    <a href="/pages/a-propos/" class="text-sm font-medium hover:text-brand-light transition-colors">L'Univers</a>
                </nav>`;

// Mobile menu nav — all 5 accordions with proper links
const CORRECT_MOBILE_NAV = `<nav class="space-y-2">
                <div class="border-b border-gray-100 py-3"><button class="flex justify-between items-center w-full text-left font-medium text-brand mobile-accordion-btn">Nos Séances <i data-lucide="chevron-down" class="w-4 h-4"></i></button><div class="hidden mt-3 space-y-3 pl-4 border-l-2 border-brand-50"><a href="/pages/packs-shooting/portrait-studio.html" class="block text-sm text-gray-600 hover:text-brand">Portrait en Studio</a><a href="/pages/packs-shooting/shooting-exterieur.html" class="block text-sm text-gray-600 hover:text-brand">Shooting en Extérieur</a><a href="/pages/packs-shooting/photo-domicile.html" class="block text-sm text-gray-600 hover:text-brand">Photo à Domicile</a><a href="/pages/packs-shooting/shooting-duo-couple.html" class="block text-sm text-gray-600 hover:text-brand">Shooting Duo &amp; Couple</a></div></div>
                <div class="border-b border-gray-100 py-3"><button class="flex justify-between items-center w-full text-left font-medium text-brand mobile-accordion-btn">Votre Objectif <i data-lucide="chevron-down" class="w-4 h-4"></i></button><div class="hidden mt-3 space-y-3 pl-4 border-l-2 border-brand-50"><a href="/pages/votre-experience/retrouver-confiance-corps.html" class="block text-sm text-gray-600 hover:text-brand">Confiance &amp; Acceptation</a><a href="/pages/votre-experience/book-modele-professionnel.html" class="block text-sm text-gray-600 hover:text-brand">Book Professionnel</a><a href="/pages/votre-experience/cadeau-couple-original.html" class="block text-sm text-gray-600 hover:text-brand">Immortaliser son Couple</a><a href="/pages/votre-experience/premier-shooting-nu.html" class="block text-sm text-gray-600 hover:text-brand">Cadeau &amp; Célébration</a></div></div>
                <div class="border-b border-gray-100 py-3"><button class="flex justify-between items-center w-full text-left font-medium text-brand mobile-accordion-btn">Où me trouver ? <i data-lucide="chevron-down" class="w-4 h-4"></i></button><div class="hidden mt-3 space-y-3 pl-4 border-l-2 border-brand-50"><a href="/pages/photographe/photographe-marseille.html" class="block text-sm text-gray-600 hover:text-brand">Marseille</a><a href="/pages/photographe/photographe-toulon.html" class="block text-sm text-gray-600 hover:text-brand">Toulon</a><a href="/pages/photographe/photographe-nice.html" class="block text-sm text-gray-600 hover:text-brand">Nice</a><a href="/pages/photographe/photographe-paris.html" class="block text-sm text-gray-600 hover:text-brand">Paris</a></div></div>
                <div class="border-b border-gray-100 py-3"><button class="flex justify-between items-center w-full text-left font-medium text-brand mobile-accordion-btn">L'Oeuvre <i data-lucide="chevron-down" class="w-4 h-4"></i></button><div class="hidden mt-3 space-y-3 pl-4 border-l-2 border-brand-50"><a href="/pages/portfolio/" class="block text-sm text-gray-600 hover:text-brand">Toutes les oeuvres</a><a href="/pages/portfolio/galerie-portraits-hommes.html" class="block text-sm text-gray-600 hover:text-brand">Portraits</a><a href="/pages/portfolio/#nus" class="block text-sm text-gray-600 hover:text-brand">Nus &amp; Attributs</a><a href="/pages/portfolio/galerie-couples.html" class="block text-sm text-gray-600 hover:text-brand">Couples &amp; Duos</a><a href="/pages/portfolio/#creation" class="block text-sm text-gray-600 hover:text-brand">Création d'art</a><a href="/pages/portfolio/#reportages" class="block text-sm text-gray-600 hover:text-brand">Reportages</a></div></div>
                <div class="border-b border-gray-100 py-3"><a href="/pages/a-propos/" class="block font-medium text-brand">L'Univers</a></div>
            </nav>`;

// CTA button (desktop) — popup version
const CORRECT_CTA = `<div class="hidden lg:flex items-center"><button onclick="openPopup()" class="bg-brand text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-brand-light shadow-md flex items-center cursor-pointer"><i data-lucide="calendar" class="w-4 h-4 mr-2"></i> Prendre RDV gratuit</button></div>`;

// Mobile CTA — popup version
const CORRECT_MOBILE_CTA = `<div class="mt-8"><button onclick="openPopup(); toggleMobileMenu();" class="w-full bg-brand text-white px-6 py-4 rounded-xl font-medium hover:bg-brand-light shadow-md flex justify-center items-center cursor-pointer"><i data-lucide="calendar" class="w-5 h-5 mr-2"></i> Prendre RDV gratuit</button></div>`;

// Favicon link tag
const FAVICON_TAG = '    <link rel="icon" type="image/svg+xml" href="/favicon.svg">';

// ============================================================
// Counters
// ============================================================
let totalFixes = 0;
const log = (file, fix) => { totalFixes++; console.log(`  [FIX] ${path.relative(PREVIEW, file)}: ${fix}`); };

// ============================================================
// 1. Get all HTML files
// ============================================================
function getAllHtml(dir) {
    let results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) results.push(...getAllHtml(full));
        else if (entry.name.endsWith('.html')) results.push(full);
    }
    return results;
}

const allFiles = getAllHtml(PREVIEW);
console.log(`Found ${allFiles.length} HTML files\n`);

// ============================================================
// 2. Fix each file
// ============================================================
for (const file of allFiles) {
    let html = read(file);
    let changed = false;
    const rel = path.relative(PREVIEW, file);
    const isBoutique = rel.startsWith('pages/boutique/');
    const isIndex = rel === 'index.html';
    const isMentions = rel === 'pages/mentions-legales.html';

    // ----------------------------------------------------------
    // BUG 1: Add favicon to all subpages missing it
    // ----------------------------------------------------------
    if (!html.includes('rel="icon"') && !isIndex) {
        html = html.replace(
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
            '<meta name="viewport" content="width=device-width, initial-scale=1.0">\n' + FAVICON_TAG
        );
        log(file, 'Added favicon');
        changed = true;
    }

    // ----------------------------------------------------------
    // BUG 2-4: Fix boutique pages — broken nav (desktop + mobile)
    // ----------------------------------------------------------
    if (isBoutique) {
        // Replace desktop nav
        const navMatch = html.match(/<nav class="hidden lg:flex[\s\S]*?<\/nav>/);
        if (navMatch) {
            html = html.replace(navMatch[0], CORRECT_DESKTOP_NAV);
            log(file, 'Fixed desktop nav (added L\'Oeuvre dropdown + transition-colors)');
            changed = true;
        }

        // Replace mobile nav
        const mobileNavMatch = html.match(/<nav class="space-y-2">[\s\S]*?<\/nav>/);
        if (mobileNavMatch) {
            html = html.replace(mobileNavMatch[0], CORRECT_MOBILE_NAV);
            log(file, 'Fixed mobile nav (added L\'Oeuvre accordion + city links)');
            changed = true;
        }

        // Fix desktop CTA (if missing openPopup)
        if (!html.includes('onclick="openPopup()"') && html.includes('Prendre RDV')) {
            // Replace the CTA div
            const ctaMatch = html.match(/<div class="hidden lg:flex items-center">.*?<\/div>/);
            if (ctaMatch) {
                html = html.replace(ctaMatch[0], CORRECT_CTA);
                log(file, 'Fixed desktop CTA to use openPopup()');
                changed = true;
            }
        }

        // Fix mobile CTA
        const mobileCta = html.match(/<div class="mt-8">.*?Prendre RDV.*?<\/div>/);
        if (mobileCta && !mobileCta[0].includes('openPopup')) {
            html = html.replace(mobileCta[0], CORRECT_MOBILE_CTA);
            log(file, 'Fixed mobile CTA to use openPopup()');
            changed = true;
        }

        // Fix HTML entity encoding → UTF-8 in body content
        // Only fix entities that are clearly French accents in the body
        // Note: &amp; is correct for & so we don't touch those
        html = html.replace(/&eacute;/g, 'é');
        html = html.replace(/&egrave;/g, 'è');
        html = html.replace(/&agrave;/g, 'à');
        html = html.replace(/&Eacute;/g, 'É');
        html = html.replace(/&mdash;/g, '—');
        log(file, 'Normalized HTML entities to UTF-8');
        changed = true;
    }

    // ----------------------------------------------------------
    // BUG 5: Fix missing accents in popup (index.html)
    // ----------------------------------------------------------
    if (isIndex) {
        const accentFixes = [
            ['mieux je prepare votre seance. Reponse sous 24h.', 'mieux je prépare votre séance. Réponse sous 24h.'],
            ['Prenom *', 'Prénom *'],
            ['Votre prenom', 'Votre prénom'],
            ['Age (optionnel)', 'Âge (optionnel)'],
            ['Telephone *', 'Téléphone *'],
            ['Marquer une etape', 'Marquer une étape'],
            ['Simple curiosite', 'Simple curiosité'],
            ['Lumiere naturelle', 'Lumière naturelle'],
            ['Sensuel / epure', 'Sensuel / épuré'],
            ['Habille / suggestif', 'Habillé / suggestif'],
            ['Nu integral', 'Nu intégral'],
            ['Avez-vous deja pose nu ou en sous-vetements', 'Avez-vous déjà posé nu ou en sous-vêtements'],
            ['Niveau de nudite envisage', 'Niveau de nudité envisagé'],
            ['style recherche', 'style recherché'],
            ['Format de tirage d\'art souhaite', 'Format de tirage d\'art souhaité'],
            ['Cote pratique', 'Côté pratique'],
            ['Pas de date precise', 'Pas de date précise'],
            ['Le plus tot possible', 'Le plus tôt possible'],
            ['Plus tard / je reflechis', 'Plus tard / je réfléchis'],
            ['envies, questions, apprehensions', 'envies, questions, appréhensions'],
            ['par la tete', 'par la tête'],
            ['m\'aide a preparer une seance', 'm\'aide à préparer une séance'],
            ['Envoyer ma demande — Reponse sous 24h', 'Envoyer ma demande — Réponse sous 24h'],
            ['vos donnees ne seront jamais partagees', 'vos données ne seront jamais partagées'],
            ['Demande envoyee !', 'Demande envoyée !'],
            ['ces precieux details', 'ces précieux détails'],
            ['un échange telephonique confidentiel et personnalise', 'un échange téléphonique confidentiel et personnalisé'],
            ['votre pack inclut la seance photo', 'votre pack inclut la séance photo'],
            ['Rien a ajouter', 'Rien à ajouter'],
            ['a partir de 250', 'à partir de 250'],
            ['a partir de 350', 'à partir de 350'],
            ['A Domicile', 'À Domicile'],
            ['Evasion Exterieur', 'Évasion Extérieur'],
            ['supplement', 'supplément'],
            ['Shooting prive', 'Shooting privé'],
        ];
        for (const [from, to] of accentFixes) {
            if (html.includes(from)) {
                html = html.replaceAll(from, to);
                log(file, `Accent fix: "${from}" → "${to}"`);
                changed = true;
            }
        }
    }

    // ----------------------------------------------------------
    // BUG 8: Fix z-index conflicts (index.html)
    // ----------------------------------------------------------
    if (isIndex) {
        // Floating CTA: z-50 → z-40 (below header/mobile menu)
        if (html.includes('id="floating-cta" class="fixed bottom-6 right-6 z-50')) {
            html = html.replace(
                'id="floating-cta" class="fixed bottom-6 right-6 z-50',
                'id="floating-cta" class="fixed bottom-6 right-6 z-40'
            );
            log(file, 'Fixed floating CTA z-index: z-50 → z-40');
            changed = true;
        }
    }

    // ----------------------------------------------------------
    // BUG 9: Fix mentions-legales CTA — use openPopup() instead of contact link
    // ----------------------------------------------------------
    if (isMentions) {
        // Fix desktop CTA
        if (html.includes('<a href="/pages/contact.html" class="bg-brand text-white px-6 py-2.5')) {
            html = html.replace(
                '<a href="/pages/contact.html" class="bg-brand text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-brand-light shadow-md flex items-center"><i data-lucide="calendar" class="w-4 h-4 mr-2"></i> Prendre RDV gratuit</a>',
                '<button onclick="openPopup()" class="bg-brand text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-brand-light shadow-md flex items-center cursor-pointer"><i data-lucide="calendar" class="w-4 h-4 mr-2"></i> Prendre RDV gratuit</button>'
            );
            log(file, 'Fixed desktop CTA: contact link → openPopup()');
            changed = true;
        }
        // Fix mobile CTA
        if (html.includes('<a href="/pages/contact.html" class="w-full bg-brand')) {
            html = html.replace(
                '<a href="/pages/contact.html" class="w-full bg-brand text-white px-6 py-4 rounded-xl font-medium hover:bg-brand-light shadow-md flex justify-center items-center"><i data-lucide="calendar" class="w-5 h-5 mr-2"></i> Prendre RDV gratuit</a>',
                '<button onclick="openPopup(); toggleMobileMenu();" class="w-full bg-brand text-white px-6 py-4 rounded-xl font-medium hover:bg-brand-light shadow-md flex justify-center items-center cursor-pointer"><i data-lucide="calendar" class="w-5 h-5 mr-2"></i> Prendre RDV gratuit</button>'
            );
            log(file, 'Fixed mobile CTA: contact link → openPopup()');
            changed = true;
        }
    }

    // ----------------------------------------------------------
    // BUG 11: Fix focus:outline-none without focus:ring replacement
    // ----------------------------------------------------------
    // Mobile menu button
    if (html.includes('id="mobile-menu-btn" class="text-brand hover:text-brand-light focus:outline-none p-2"')) {
        html = html.replace(
            'id="mobile-menu-btn" class="text-brand hover:text-brand-light focus:outline-none p-2"',
            'id="mobile-menu-btn" class="text-brand hover:text-brand-light focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 rounded-lg p-2"'
        );
        log(file, 'Added focus:ring to mobile menu button');
        changed = true;
    }
    // Close menu button
    if (html.includes('id="close-menu-btn" class="text-gray-500 hover:text-brand focus:outline-none"')) {
        html = html.replace(
            'id="close-menu-btn" class="text-gray-500 hover:text-brand focus:outline-none"',
            'id="close-menu-btn" class="text-gray-500 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 rounded-lg"'
        );
        log(file, 'Added focus:ring to close menu button');
        changed = true;
    }

    // ----------------------------------------------------------
    // BUG 12: Fix missing transition-colors on nav items (all pages)
    // ----------------------------------------------------------
    // Fix nav buttons missing transition-colors
    const navBtnPattern = /hover:text-brand-light py-8"/g;
    if (html.match(navBtnPattern)) {
        html = html.replace(navBtnPattern, 'hover:text-brand-light transition-colors py-8"');
        log(file, 'Added missing transition-colors on nav buttons');
        changed = true;
    }
    // Fix Nice city link missing transition-colors
    html = html.replace(
        'hover:text-brand-50 hover:text-brand">Nice',
        'hover:text-brand-50 hover:text-brand transition-colors">Nice'
    );

    // ----------------------------------------------------------
    // BUG 14: Fix form error handling — show error message on failure
    // ----------------------------------------------------------
    if (isIndex) {
        // Replace the catch block that shows success on error
        html = html.replace(
            ".catch(()=>{document.getElementById('booking-form').classList.add('hidden');document.getElementById('popup-success').classList.remove('hidden');initLucide();})",
            ".catch(()=>{alert('Une erreur est survenue. Veuillez réessayer ou nous contacter au 06 88 70 40 41.');})"
        );
        log(file, 'Fixed form error handling: show error instead of fake success');
        changed = true;
    }

    // Fix contact.html form error handling too
    if (rel === 'pages/contact.html') {
        // Read the full file to check for the catch pattern
        if (html.includes(".catch(()=>{") && html.includes("classList.add('hidden')")) {
            html = html.replace(
                /\.catch\(\(\)=>\{[^}]*classList\.add\('hidden'\)[^}]*\}\)/g,
                ".catch(()=>{alert('Une erreur est survenue. Veuillez réessayer ou nous contacter au 06 88 70 40 41.');})"
            );
            log(file, 'Fixed form error handling');
            changed = true;
        }
    }

    // ----------------------------------------------------------
    // Write changes
    // ----------------------------------------------------------
    if (changed) {
        write(file, html);
        console.log(`  ✓ ${rel} updated\n`);
    }
}

console.log(`\n=== Done: ${totalFixes} fixes applied across ${allFiles.length} files ===`);
