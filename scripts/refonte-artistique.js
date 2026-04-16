#!/usr/bin/env node
/**
 * refonte-artistique.js
 * Applique les changements globaux de design sur les 28 fichiers HTML de preview/
 *
 * 1. Nav desktop → 4 items (Séances dropdown, Réalisations, L'Univers, Contact)
 * 2. CTA desktop → Instagram icon + bouton "Rendez-vous"
 * 3. Menu mobile simplifié (4 items, accordion uniquement pour Séances)
 * 4. Footer 2 colonnes
 * 5. Floating CTA → "Rendez-vous", sans pulse-ring
 * 6. Scroll threshold → 40% de la hauteur
 * 7. Labels CTA dans le contenu
 */

const fs = require('fs');
const path = require('path');

// ─── NOUVEAU NAV DESKTOP ─────────────────────────────────────────────────────

const NEW_DESKTOP_NAV = `<nav class="hidden lg:flex space-x-8 h-full items-center">
                    <!-- Séances (dropdown) -->
                    <div class="mega-menu-item relative h-full flex items-center">
                        <button class="flex items-center text-sm font-medium hover:text-brand-light transition-colors py-8">
                            Séances
                            <i data-lucide="chevron-down" class="ml-1 w-4 h-4"></i>
                        </button>
                        <div class="mega-menu-content absolute top-20 left-1/2 -translate-x-1/2 w-64 bg-white shadow-xl rounded-b-lg border-t border-gray-100 overflow-hidden">
                            <div class="py-2">
                                <a href="/pages/packs-shooting/portrait-studio.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Portrait en Studio</a>
                                <a href="/pages/packs-shooting/shooting-exterieur.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Shooting en Extérieur</a>
                                <a href="/pages/packs-shooting/photo-domicile.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Photo à Domicile</a>
                                <a href="/pages/packs-shooting/shooting-duo-couple.html" class="block px-6 py-3 text-sm hover:bg-brand-50 hover:text-brand transition-colors">Shooting Duo &amp; Couple</a>
                            </div>
                        </div>
                    </div>
                    <!-- Réalisations (lien direct) -->
                    <a href="/pages/portfolio/" class="text-sm font-medium hover:text-brand-light transition-colors">Réalisations</a>
                    <!-- L'Univers (lien direct) -->
                    <a href="/pages/a-propos/" class="text-sm font-medium hover:text-brand-light transition-colors">L'Univers</a>
                    <!-- Contact (lien direct) -->
                    <a href="/pages/contact.html" class="text-sm font-medium hover:text-brand-light transition-colors">Contact</a>
                </nav>`;

// ─── NOUVEAU CTA DESKTOP (homepage — fond transparent au départ) ─────────────

const NEW_DESKTOP_CTA_HOMEPAGE = `<div class="hidden lg:flex items-center gap-3">
                    <a href="https://www.instagram.com/hbozart/" target="_blank" rel="noopener" class="text-gray-400 hover:text-brand transition-colors">
                        <i data-lucide="instagram" class="w-5 h-5"></i>
                    </a>
                    <button id="header-cta-btn" onclick="openPopup()" class="bg-white/20 backdrop-blur-sm text-white border border-white/30 px-6 py-2.5 rounded-full text-sm font-medium hover:bg-white hover:text-brand transition-all shadow-md hover:shadow-lg flex items-center cursor-pointer">
                        <i data-lucide="calendar" class="w-4 h-4 mr-2"></i>
                        Rendez-vous
                    </button>
                </div>`;

// ─── NOUVEAU CTA DESKTOP (pages intérieures — fond blanc fixe) ───────────────

const NEW_DESKTOP_CTA_INNER = `<div class="hidden lg:flex items-center gap-3">
                    <a href="https://www.instagram.com/hbozart/" target="_blank" rel="noopener" class="text-gray-400 hover:text-brand transition-colors">
                        <i data-lucide="instagram" class="w-5 h-5"></i>
                    </a>
                    <button onclick="openPopup()" class="bg-brand text-white px-6 py-2.5 rounded-full text-sm font-medium hover:bg-brand-light transition-colors shadow-md hover:shadow-lg flex items-center cursor-pointer">
                        <i data-lucide="calendar" class="w-4 h-4 mr-2"></i>
                        Rendez-vous
                    </button>
                </div>`;

// ─── NOUVEAU MENU MOBILE ─────────────────────────────────────────────────────

const NEW_MOBILE_MENU = `<div id="mobile-menu" class="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-2xl z-50 transform translate-x-full overflow-y-auto">
        <div class="p-6">
            <div class="flex items-center justify-between mb-8">
                <span class="font-serif text-2xl font-bold text-brand">HAROBOZ</span>
                <button id="close-menu-btn" class="text-gray-500 hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 rounded-lg"><i data-lucide="x" class="w-7 h-7"></i></button>
            </div>
            <nav class="space-y-2">
                <!-- Séances accordion -->
                <div class="border-b border-gray-100 py-3">
                    <button class="flex justify-between items-center w-full text-left font-medium text-brand mobile-accordion-btn">
                        Séances
                        <i data-lucide="chevron-down" class="w-4 h-4 transition-transform duration-200"></i>
                    </button>
                    <div class="hidden mt-3 space-y-3 pl-4 border-l-2 border-brand-50">
                        <a href="/pages/packs-shooting/portrait-studio.html" class="block text-sm text-gray-600 hover:text-brand">Portrait en Studio</a>
                        <a href="/pages/packs-shooting/shooting-exterieur.html" class="block text-sm text-gray-600 hover:text-brand">Shooting en Extérieur</a>
                        <a href="/pages/packs-shooting/photo-domicile.html" class="block text-sm text-gray-600 hover:text-brand">Photo à Domicile</a>
                        <a href="/pages/packs-shooting/shooting-duo-couple.html" class="block text-sm text-gray-600 hover:text-brand">Shooting Duo &amp; Couple</a>
                    </div>
                </div>
                <!-- Réalisations lien direct -->
                <div class="border-b border-gray-100 py-3">
                    <a href="/pages/portfolio/" class="block w-full text-left font-medium text-brand">Réalisations</a>
                </div>
                <!-- L'Univers lien direct -->
                <div class="border-b border-gray-100 py-3">
                    <a href="/pages/a-propos/" class="block w-full text-left font-medium text-brand">L'Univers</a>
                </div>
                <!-- Contact lien direct -->
                <div class="border-b border-gray-100 py-3">
                    <a href="/pages/contact.html" class="block w-full text-left font-medium text-brand">Contact</a>
                </div>
            </nav>
            <div class="mt-8">
                <button onclick="openPopup(); toggleMobileMenu();" class="w-full bg-brand text-white px-6 py-4 rounded-xl text-center font-medium hover:bg-brand-light transition-colors shadow-md flex justify-center items-center cursor-pointer">
                    <i data-lucide="calendar" class="w-5 h-5 mr-2"></i> Rendez-vous
                </button>
                <p class="mt-4 text-center text-sm text-gray-500 flex items-center justify-center gap-2">
                    <i data-lucide="phone" class="w-4 h-4"></i>
                    06 88 70 40 41
                </p>
            </div>
        </div>
    </div>`;

// ─── NOUVEAU FOOTER ───────────────────────────────────────────────────────────

const NEW_FOOTER = `<footer class="bg-brand text-white border-t border-brand-light/20">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
            <div class="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-16">

                <!-- Colonne 1 : Haroboz -->
                <div>
                    <div class="font-serif text-lg font-bold mb-4">Haroboz</div>
                    <ul class="space-y-2 mb-4">
                        <li><a href="/pages/a-propos/" class="text-sm text-gray-300 hover:text-white transition-colors">L'Univers</a></li>
                        <li><a href="/pages/contact.html" class="text-sm text-gray-300 hover:text-white transition-colors">Contact</a></li>
                        <li><a href="/pages/mentions-legales.html" class="text-sm text-gray-300 hover:text-white transition-colors">Mentions légales</a></li>
                    </ul>
                    <div class="flex flex-wrap gap-x-3 gap-y-1 text-sm text-gray-400">
                        <a href="/pages/photographe/photographe-marseille.html" class="hover:text-white transition-colors">Marseille</a>
                        <span class="text-gray-600">|</span>
                        <a href="/pages/photographe/photographe-toulon.html" class="hover:text-white transition-colors">Toulon</a>
                        <span class="text-gray-600">|</span>
                        <a href="/pages/photographe/photographe-nice.html" class="hover:text-white transition-colors">Nice</a>
                        <span class="text-gray-600">|</span>
                        <a href="/pages/photographe/photographe-paris.html" class="hover:text-white transition-colors">Paris</a>
                    </div>
                </div>

                <!-- Colonne 2 : Explorer -->
                <div>
                    <div class="font-serif text-lg font-bold mb-4">Explorer</div>
                    <ul class="space-y-2">
                        <li><a href="/pages/portfolio/galerie-portraits-hommes.html" class="text-sm text-gray-300 hover:text-white transition-colors">Portraits</a></li>
                        <li><a href="/pages/portfolio/#nus" class="text-sm text-gray-300 hover:text-white transition-colors">Nus &amp; Attributs</a></li>
                        <li><a href="/pages/portfolio/galerie-couples.html" class="text-sm text-gray-300 hover:text-white transition-colors">Couples &amp; Duos</a></li>
                        <li><a href="/pages/boutique/tirages-art-edition-limitee.html" class="text-sm text-gray-300 hover:text-white transition-colors">Tirages d'Art</a></li>
                        <li><a href="/pages/boutique/carte-cadeau.html" class="text-sm text-gray-300 hover:text-white transition-colors">Carte Cadeau</a></li>
                    </ul>
                </div>

            </div>

            <!-- Barre inférieure -->
            <div class="border-t border-white/10 mt-10 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
                <div class="flex items-center gap-4 flex-wrap justify-center md:justify-start">
                    <a href="https://www.instagram.com/hbozart/" target="_blank" rel="noopener" class="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5">
                        <i data-lucide="instagram" class="w-4 h-4"></i>
                        <span class="text-sm">@hbozart</span>
                    </a>
                    <span class="text-gray-600 hidden md:inline">|</span>
                    <a href="tel:0688704041" class="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5 text-sm">
                        <i data-lucide="phone" class="w-4 h-4"></i>
                        06 88 70 40 41
                    </a>
                    <span class="text-gray-600 hidden md:inline">|</span>
                    <p class="text-sm text-gray-400">&copy; 2026 Haroboz &mdash; Luc Desbois</p>
                </div>
                <button onclick="openPopup()" class="bg-white/10 hover:bg-white/20 text-white px-5 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer">
                    <i data-lucide="calendar" class="w-4 h-4"></i>
                    Rendez-vous
                </button>
            </div>
        </div>
    </footer>`;

// ─── NOUVEAU FLOATING CTA ─────────────────────────────────────────────────────

const NEW_FLOATING_CTA = `<div id="floating-cta" class="fixed bottom-6 right-6 z-40 opacity-0 translate-y-4 transition-all duration-300 pointer-events-none">
        <button onclick="openPopup()" class="relative bg-brand text-white w-14 h-14 md:w-auto md:h-auto md:px-6 md:py-3 rounded-full shadow-2xl hover:bg-brand-light transition-colors flex items-center justify-center cursor-pointer">
            <i data-lucide="calendar" class="w-6 h-6 md:w-5 md:h-5 md:mr-2"></i>
            <span class="hidden md:inline font-medium">Rendez-vous</span>
        </button>
    </div>`;

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Remplace un bloc délimité par startMarker et un tag fermant compté.
 * startMarker : regex qui matche l'ouverture du bloc
 * tagName : 'div' | 'nav' | 'footer' | etc.
 * replacement : string
 */
function replaceBalancedBlock(html, startMarker, tagName, replacement) {
    const startMatch = startMarker.exec(html);
    if (!startMatch) return { html, changed: false };

    const startIdx = startMatch.index;
    // Compter les tags pour trouver la fermeture
    const openTag = new RegExp(`<${tagName}[\\s>]`, 'gi');
    const closeTag = new RegExp(`</${tagName}>`, 'gi');

    let depth = 0;
    let endIdx = -1;
    const searchFrom = startIdx;
    const segment = html.slice(searchFrom);

    // Parcours caractère par caractère via regex alternée
    const combined = new RegExp(`<${tagName}[\\s>/]|</${tagName}>`, 'gi');
    let m;
    while ((m = combined.exec(segment)) !== null) {
        if (m[0].startsWith(`<${tagName}`) && !m[0].startsWith(`</${tagName}`)) {
            depth++;
        } else {
            depth--;
            if (depth === 0) {
                endIdx = searchFrom + m.index + m[0].length;
                break;
            }
        }
    }

    if (endIdx === -1) return { html, changed: false };

    const before = html.slice(0, startIdx);
    const after = html.slice(endIdx);
    return { html: before + replacement + after, changed: true };
}

/**
 * Remplace <footer ... </footer>
 */
function replaceFooter(html) {
    const start = html.indexOf('<footer');
    if (start === -1) return { html, changed: false };
    const end = html.indexOf('</footer>', start);
    if (end === -1) return { html, changed: false };
    const newHtml = html.slice(0, start) + NEW_FOOTER + html.slice(end + '</footer>'.length);
    return { html: newHtml, changed: true };
}

/**
 * Remplace <nav class="hidden lg:flex ... </nav>
 */
function replaceDesktopNav(html) {
    return replaceBalancedBlock(
        html,
        /<nav class="hidden lg:flex/,
        'nav',
        NEW_DESKTOP_NAV
    );
}

/**
 * Remplace le bloc CTA desktop (div contenant le bouton header)
 * Deux variantes :
 *   - homepage : `<div class="hidden lg:flex items-center gap-3">`
 *   - inner    : `<div class="hidden lg:flex items-center">`
 */
function replaceDesktopCTA(html, isHomepage) {
    const replacement = isHomepage ? NEW_DESKTOP_CTA_HOMEPAGE : NEW_DESKTOP_CTA_INNER;

    // Pattern pour les deux variantes
    const patterns = [
        /<div class="hidden lg:flex items-center gap-3">/,
        /<div class="hidden lg:flex items-center">/,
    ];

    for (const pat of patterns) {
        if (pat.test(html)) {
            const result = replaceBalancedBlock(html, pat, 'div', replacement);
            if (result.changed) return result;
        }
    }
    return { html, changed: false };
}

/**
 * Remplace le mobile menu (div#mobile-menu) + l'overlay qui suit
 */
function replaceMobileMenu(html) {
    const result = replaceBalancedBlock(
        html,
        /<div id="mobile-menu"/,
        'div',
        NEW_MOBILE_MENU
    );
    if (!result.changed) return result;

    // Supprimer aussi l'overlay juste après (s'il existe)
    // L'overlay a id="mobile-overlay" mais on le laisse — on ne le supprime pas,
    // on le garde car le JS l'utilise. Juste on remplace le mobile-menu.
    return result;
}

/**
 * Remplace le floating CTA (div#floating-cta)
 */
function replaceFloatingCTA(html) {
    return replaceBalancedBlock(
        html,
        /<div id="floating-cta"/,
        'div',
        NEW_FLOATING_CTA
    );
}

/**
 * Met à jour le seuil scroll du floating CTA dans le bloc <script>
 */
function updateScrollThreshold(html) {
    // Toutes les variantes connues du threshold
    const patterns = [
        /window\.scrollY > 600/g,
        /window\.scrollY > 400/g,
        /window\.scrollY > 300/g,
    ];
    let changed = false;
    for (const pat of patterns) {
        if (pat.test(html)) {
            html = html.replace(pat, 'window.scrollY > document.documentElement.scrollHeight * 0.4');
            changed = true;
        }
    }
    return { html, changed };
}

/**
 * Remplace les labels CTA dans tout le document (body content)
 * Ordre important : les plus longs en premier pour éviter les doubles remplacements
 */
function replaceCTALabels(html) {
    const replacements = [
        // Boutons / textes
        [/Prendre RDV gratuit/g, 'Rendez-vous'],
        [/Réserver une consultation gratuite/g, 'Rendez-vous'],
        [/Réserver en toute confidentialité/g, 'Rendez-vous'],
        [/Réserver ma séance/g, 'Rendez-vous'],
        [/Être rappelé sous 24h/g, 'Rendez-vous'],
        [/Prendre RDV/g, 'Rendez-vous'],
        // Liens / CTA secondaires
        [/Voir toutes les réalisations/g, 'Réalisations'],
        [/Découvrir l['']oeuvre/g, 'Réalisations'],
    ];

    let changed = false;
    for (const [pat, repl] of replacements) {
        if (pat.test(html)) {
            html = html.replace(pat, repl);
            changed = true;
        }
    }
    return { html, changed };
}

// ─── TRAITEMENT PRINCIPAL ─────────────────────────────────────────────────────

function findHtmlFiles(dir) {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...findHtmlFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.html')) {
            results.push(fullPath);
        }
    }
    return results;
}

const PREVIEW_DIR = path.resolve(__dirname, '../preview');
const files = findHtmlFiles(PREVIEW_DIR);

console.log(`\nTraitement de ${files.length} fichiers HTML...\n`);

let totalChanged = 0;

for (const filePath of files) {
    const rel = path.relative(PREVIEW_DIR, filePath);
    const isHomepage = rel === 'index.html';

    let html = fs.readFileSync(filePath, 'utf8');
    const original = html;
    const changes = [];

    // 1. Nav desktop
    let r = replaceDesktopNav(html);
    if (r.changed) { html = r.html; changes.push('nav desktop'); }

    // 2. CTA desktop
    r = replaceDesktopCTA(html, isHomepage);
    if (r.changed) { html = r.html; changes.push('CTA desktop'); }

    // 3. Menu mobile
    r = replaceMobileMenu(html);
    if (r.changed) { html = r.html; changes.push('menu mobile'); }

    // 4. Footer
    r = replaceFooter(html);
    if (r.changed) { html = r.html; changes.push('footer'); }

    // 5. Floating CTA
    r = replaceFloatingCTA(html);
    if (r.changed) { html = r.html; changes.push('floating CTA'); }

    // 6. Scroll threshold
    r = updateScrollThreshold(html);
    if (r.changed) { html = r.html; changes.push('scroll threshold'); }

    // 7. Labels CTA
    r = replaceCTALabels(html);
    if (r.changed) { html = r.html; changes.push('CTA labels'); }

    if (html !== original) {
        fs.writeFileSync(filePath, html, 'utf8');
        totalChanged++;
        console.log(`  [OK] ${rel}`);
        console.log(`       → ${changes.join(', ')}`);
    } else {
        console.log(`  [--] ${rel} (aucun changement)`);
    }
}

console.log(`\nTerminé — ${totalChanged}/${files.length} fichiers modifiés.\n`);
