#!/usr/bin/env node
/**
 * Replace placeholder divs with real Unsplash images
 * Add "Tirages d'art" showcase section to relevant pages
 */

const fs = require('fs');
const path = require('path');

const PREVIEW_DIR = path.resolve(__dirname, '..', 'preview');

// ═══════════════════════════════════════════
// IMAGE POOLS — Unsplash (free, hotlinkable)
// ═══════════════════════════════════════════

const IMAGES = {
    // Studio / photography atmosphere
    studio: [
        'https://images.unsplash.com/photo-1604514628550-37477afdf4e3?w=800&auto=format&q=80', // dark studio
        'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&q=80', // camera close
        'https://images.unsplash.com/photo-1554048612-b6a482bc67e5?w=800&auto=format&q=80', // studio lights
        'https://images.unsplash.com/photo-1542038784456-1ea8e935640e?w=800&auto=format&q=80', // photography
        'https://images.unsplash.com/photo-1471341971476-ae15ff5dd4ea?w=800&auto=format&q=80', // dark moody
        'https://images.unsplash.com/photo-1609921212029-bb5a28e60960?w=800&auto=format&q=80', // artistic lighting
    ],
    // Art prints / tirages / framed art
    tirages: [
        'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&auto=format&q=80', // art gallery wall
        'https://images.unsplash.com/photo-1578926288207-a90027e434c1?w=800&auto=format&q=80', // framed art
        'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&auto=format&q=80', // gallery display
        'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&auto=format&q=80', // art on wall
        'https://images.unsplash.com/photo-1582555172866-f73bb12a2ab3?w=800&auto=format&q=80', // fine art print
        'https://images.unsplash.com/photo-1541367777708-7905fe3296c0?w=800&auto=format&q=80', // print detail
    ],
    // Côte d'Azur / Mediterranean
    cannes: [
        'https://images.unsplash.com/photo-1533104816931-20fa691ff6ca?w=800&auto=format&q=80', // Cannes harbor
        'https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99?w=800&auto=format&q=80', // French Riviera coast
        'https://images.unsplash.com/photo-1491166617655-0723a0999cfc?w=800&auto=format&q=80', // Mediterranean sunset
    ],
    nice: [
        'https://images.unsplash.com/photo-1491522106034-25cb0b2e10dc?w=800&auto=format&q=80', // Nice coastline
        'https://images.unsplash.com/photo-1534961880437-ce5ae2033053?w=800&auto=format&q=80', // Nice promenade
        'https://images.unsplash.com/photo-1555993539-1732b0258235?w=800&auto=format&q=80', // Nice old town
    ],
    antibes: [
        'https://images.unsplash.com/photo-1569949381669-ecf31ae8e613?w=800&auto=format&q=80', // Antibes fort
        'https://images.unsplash.com/photo-1596394723269-e8940a9a8539?w=800&auto=format&q=80', // Mediterranean sea
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&q=80', // coastal rocks
    ],
    mougins: [
        'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&auto=format&q=80', // Provençal village
        'https://images.unsplash.com/photo-1523531294919-4bcd7c65e216?w=800&auto=format&q=80', // Provence lavender
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&auto=format&q=80', // scenic provence
    ],
    mandelieu: [
        'https://images.unsplash.com/photo-1504803900752-c2051699d0e9?w=800&auto=format&q=80', // Esterel red rocks
        'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=800&auto=format&q=80', // Mediterranean waves
        'https://images.unsplash.com/photo-1468413253725-0d5181091126?w=800&auto=format&q=80', // sunset coast
    ],
    // Confidence / body positive / introspection
    confiance: [
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=800&auto=format&q=80', // man portrait
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&auto=format&q=80', // man face
        'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=800&auto=format&q=80', // man contemplative
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=800&auto=format&q=80', // man confident
        'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800&auto=format&q=80', // portrait light
    ],
    // Couple / duo
    couple: [
        'https://images.unsplash.com/photo-1529634597503-139d3726fed5?w=800&auto=format&q=80', // couple hands
        'https://images.unsplash.com/photo-1494774157365-9e04c6720e47?w=800&auto=format&q=80', // couple silhouette
        'https://images.unsplash.com/photo-1516589178581-6cd7833ae3b2?w=800&auto=format&q=80', // intimate moment
    ],
    // Gift / cadeau
    cadeau: [
        'https://images.unsplash.com/photo-1549465220-1a8b9238f760?w=800&auto=format&q=80', // gift box elegant
        'https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=800&auto=format&q=80', // wrapped gift
        'https://images.unsplash.com/photo-1607344645866-009c320b63e0?w=800&auto=format&q=80', // celebration
    ],
    // Book / portfolio / professional
    book: [
        'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&auto=format&q=80', // model posing
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&q=80', // professional portrait
        'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&q=80', // modeling
    ],
    // Home / domicile / lifestyle
    domicile: [
        'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&auto=format&q=80', // elegant interior
        'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&auto=format&q=80', // luxury room
        'https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=800&auto=format&q=80', // home atmosphere
    ],
    // Extérieur / outdoor
    exterieur: [
        'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&auto=format&q=80', // beach
        'https://images.unsplash.com/photo-1500375592092-40eb2168fd21?w=800&auto=format&q=80', // ocean
        'https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800&auto=format&q=80', // scenic outdoor
        'https://images.unsplash.com/photo-1491166617655-0723a0999cfc?w=800&auto=format&q=80', // sunset
    ],
    // Boutique / gallery display
    boutique: [
        'https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=800&auto=format&q=80', // gallery wall
        'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&auto=format&q=80', // art display
        'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=800&auto=format&q=80', // art pieces
    ],
};

// ═══════════════════════════════════════════
// PAGE → IMAGE MAPPING
// ═══════════════════════════════════════════

const PAGE_IMAGES = {
    'packs-shooting/portrait-studio-cannes': ['studio', 'tirages', 'studio', 'tirages', 'cannes'],
    'packs-shooting/shooting-exterieur-cote-azur': ['exterieur', 'cannes', 'tirages', 'exterieur', 'studio'],
    'packs-shooting/photo-domicile': ['domicile', 'studio', 'tirages', 'domicile', 'confiance'],
    'packs-shooting/shooting-duo-couple': ['couple', 'studio', 'tirages', 'couple', 'cannes'],
    'packs-shooting/index': ['studio', 'tirages'],
    'votre-experience/retrouver-confiance-corps': ['confiance', 'studio', 'tirages', 'confiance', 'cannes'],
    'votre-experience/book-modele-professionnel': ['book', 'studio', 'tirages', 'book', 'cannes'],
    'votre-experience/premier-shooting-nu': ['confiance', 'studio', 'tirages', 'confiance', 'cannes'],
    'votre-experience/cadeau-couple-original': ['cadeau', 'couple', 'tirages', 'cadeau', 'cannes'],
    'votre-experience/index': ['confiance', 'studio', 'tirages', 'confiance', 'cadeau', 'couple'],
    'photographe-cote-azur/photographe-homme-nu-cannes': ['cannes', 'studio', 'tirages'],
    'photographe-cote-azur/photographe-nice': ['nice', 'studio', 'tirages'],
    'photographe-cote-azur/shooting-couple-antibes': ['antibes', 'couple', 'tirages'],
    'photographe-cote-azur/photographe-mougins': ['mougins', 'studio', 'tirages'],
    'photographe-cote-azur/shooting-mandelieu': ['mandelieu', 'studio', 'tirages'],
    'photographe-cote-azur/index': ['cannes'],
    'mentions-legales': ['studio', 'cannes', 'tirages', 'studio', 'cannes', 'tirages', 'studio', 'cannes'],
    'boutique/index': ['tirages', 'boutique'],
    'boutique/tirages-art-edition-limitee': ['tirages', 'boutique'],
    'boutique/carte-cadeau': ['cadeau', 'tirages'],
    'boutique/galerie-privee-client': ['boutique', 'tirages'],
};

// Gallery images (4 images for the Réalisations section)
const GALLERY_IMAGES = [
    'https://images.unsplash.com/photo-1604514628550-37477afdf4e3?w=600&auto=format&q=80',
    'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=600&auto=format&q=80',
    'https://images.unsplash.com/photo-1492562080023-ab3db95bfbce?w=600&auto=format&q=80',
    'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=600&auto=format&q=80',
];

// ═══════════════════════════════════════════
// TIRAGES D'ART SHOWCASE SECTION
// ═══════════════════════════════════════════

const TIRAGES_SECTION = `
        <!-- TIRAGES D'ART — Mise en avant -->
        <section class="py-14 md:py-20 bg-white border-t border-gray-100">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                    <div>
                        <span class="text-xs font-bold tracking-widest text-brand/60 uppercase block mb-3">Inclus dans chaque pack</span>
                        <h3 class="text-2xl md:text-3xl font-serif text-brand mb-4">Votre tirage d'art Fine Art</h3>
                        <p class="text-gray-600 leading-relaxed mb-4">Chaque séance Haroboz aboutit à une œuvre tangible : un tirage d'art signé et numéroté, imprimé sur papier Hahnemühle avec des encres pigmentaires de qualité muséale. Ce n'est pas un simple fichier numérique — c'est un objet d'art que vous conserverez toute votre vie.</p>
                        <div class="flex flex-wrap gap-4 mb-6">
                            <div class="flex items-center gap-2 text-sm text-gray-500">
                                <i data-lucide="printer" class="w-4 h-4 text-brand"></i>
                                <span>Papier Fine Art Hahnemühle</span>
                            </div>
                            <div class="flex items-center gap-2 text-sm text-gray-500">
                                <i data-lucide="pen-tool" class="w-4 h-4 text-brand"></i>
                                <span>Signé & numéroté</span>
                            </div>
                            <div class="flex items-center gap-2 text-sm text-gray-500">
                                <i data-lucide="shield-check" class="w-4 h-4 text-brand"></i>
                                <span>Édition limitée</span>
                            </div>
                        </div>
                        <a href="/pages/boutique/tirages-art-edition-limitee.html" class="inline-flex items-center text-brand font-medium hover:text-brand-light transition-colors group">
                            <span>Découvrir nos tirages d'art</span>
                            <i data-lucide="arrow-right" class="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform"></i>
                        </a>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <img src="https://images.unsplash.com/photo-1513364776144-60967b0f800f?w=600&auto=format&q=80" alt="Tirage d'art Fine Art encadré" class="rounded-2xl aspect-[3/4] object-cover w-full shadow-lg" loading="lazy">
                        <img src="https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?w=600&auto=format&q=80" alt="Galerie de tirages d'art" class="rounded-2xl aspect-[3/4] object-cover w-full shadow-lg mt-6" loading="lazy">
                    </div>
                </div>
            </div>
        </section>`;

// ═══════════════════════════════════════════
// TRANSFORMATION FUNCTIONS
// ═══════════════════════════════════════════

function getPageKey(filePath) {
    const rel = path.relative(path.join(PREVIEW_DIR, 'pages'), filePath)
        .replace('.html', '')
        .replace(/\\/g, '/');
    // Remove trailing /index
    return rel.replace(/\/index$/, '/index');
}

function replaceContentPlaceholders(html, pageKey) {
    const categories = PAGE_IMAGES[pageKey];
    if (!categories) return html;

    let imageIndex = {};

    // Replace 4:3 aspect ratio placeholders (content blocks)
    let contentCounter = 0;
    html = html.replace(
        /<div class="aspect-\[4\/3\] rounded-2xl bg-gradient-to-br [^"]*flex items-center justify-center shadow-inner">\s*<i data-lucide="[^"]*"[^>]*><\/i>\s*<\/div>/g,
        (match) => {
            const catName = categories[contentCounter % categories.length];
            const cat = IMAGES[catName] || IMAGES.studio;
            if (!imageIndex[catName]) imageIndex[catName] = 0;
            const img = cat[imageIndex[catName] % cat.length];
            imageIndex[catName]++;
            contentCounter++;
            return `<img src="${img}" alt="Haroboz — Photographie d'art" class="aspect-[4/3] rounded-2xl object-cover w-full shadow-lg" loading="lazy">`;
        }
    );

    return html;
}

function replaceGalleryPlaceholders(html) {
    // Replace 3:4 gallery placeholders
    let galleryIdx = 0;
    html = html.replace(
        /<div class="aspect-\[3\/4\] rounded-2xl bg-gradient-to-[a-z]+ from-brand\/\d+ to-brand\/\d+ flex items-center justify-center group hover:shadow-lg transition-all duration-300(?:\s+hidden md:flex)?">\s*<i data-lucide="[^"]*"[^>]*><\/i>\s*<\/div>/g,
        (match) => {
            const img = GALLERY_IMAGES[galleryIdx % GALLERY_IMAGES.length];
            const hidden = match.includes('hidden md:flex') ? ' hidden md:block' : '';
            galleryIdx++;
            return `<img src="${img}" alt="Réalisation Haroboz" class="aspect-[3/4] rounded-2xl object-cover w-full shadow-md hover:shadow-xl transition-shadow duration-300${hidden}" loading="lazy">`;
        }
    );

    return html;
}

function addTiragesSection(html) {
    // Don't add if page is in boutique (already about tirages) or is mentions-legales
    // Insert before the FAQ section or before the CTA section
    if (html.includes("Votre tirage d'art Fine Art")) return html; // Already has it

    // Find the best insertion point: before FAQ or before final CTA
    const faqMatch = html.indexOf('itemtype="https://schema.org/FAQPage"');
    const ctaMatch = html.lastIndexOf('<!-- CTA');

    let insertPoint = -1;
    if (faqMatch > -1) {
        // Find the section start before FAQ
        insertPoint = html.lastIndexOf('<section', faqMatch);
    } else if (ctaMatch > -1) {
        insertPoint = ctaMatch;
    }

    if (insertPoint > -1) {
        html = html.slice(0, insertPoint) + TIRAGES_SECTION + '\n\n        ' + html.slice(insertPoint);
    }

    return html;
}

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════

function findPages(dir) {
    const pages = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            pages.push(...findPages(fullPath));
        } else if (item.name.endsWith('.html')) {
            pages.push(fullPath);
        }
    }
    return pages;
}

const pages = findPages(path.join(PREVIEW_DIR, 'pages'));
console.log(`Processing ${pages.length} pages...\n`);

let imagesAdded = 0;
let tiragesAdded = 0;

for (const page of pages) {
    const rel = path.relative(PREVIEW_DIR, page);
    const pageKey = getPageKey(page);

    let html = fs.readFileSync(page, 'utf-8');
    const origLen = html.length;

    // 1. Replace content placeholders with images
    html = replaceContentPlaceholders(html, pageKey);

    // 2. Replace gallery placeholders
    html = replaceGalleryPlaceholders(html);

    // 3. Add tirages section (skip boutique pages, mentions-legales, contact, portfolio)
    const skipTirages = rel.includes('boutique/') || rel.includes('mentions-legales') ||
                        rel.includes('contact') || rel.includes('portfolio/');
    if (!skipTirages) {
        const beforeTirages = html.length;
        html = addTiragesSection(html);
        if (html.length !== beforeTirages) tiragesAdded++;
    }

    if (html.length !== origLen) {
        fs.writeFileSync(page, html, 'utf-8');
        const imgCount = (html.match(/<img[^>]*unsplash/g) || []).length;
        console.log(`  ✓ ${rel} — ${imgCount} images${!skipTirages && html.includes("Votre tirage d'art") ? ' + tirages' : ''}`);
        imagesAdded++;
    } else {
        console.log(`  - ${rel} (no changes)`);
    }
}

console.log(`\nDone: ${imagesAdded} pages updated, ${tiragesAdded} tirages sections added`);
