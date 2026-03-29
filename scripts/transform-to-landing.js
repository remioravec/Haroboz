#!/usr/bin/env node
/**
 * Transform inner pages from blog-style to landing page style
 * - Splits SEO content into alternating full-width sections
 * - Adds gallery/réalisations section
 * - Uses 2-column grid layouts with visual placeholders
 */

const fs = require('fs');
const path = require('path');

const PREVIEW_DIR = path.resolve(__dirname, '..', 'preview');

// Gallery section to insert between content blocks
const GALLERY_SECTION = `
        <!-- RÉALISATIONS — Mini galerie -->
        <section class="py-12 md:py-16 bg-gray-50 border-y border-gray-100">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="text-center mb-8">
                    <span class="text-xs font-bold tracking-widest text-gray-400 uppercase block mb-2">Réalisations</span>
                    <h3 class="text-2xl md:text-3xl font-serif text-brand">Un aperçu de nos créations</h3>
                </div>
                <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                    <div class="aspect-[3/4] rounded-2xl bg-gradient-to-br from-brand/5 to-brand/15 flex items-center justify-center group hover:shadow-lg transition-all duration-300">
                        <i data-lucide="camera" class="w-8 h-8 text-brand/30 group-hover:text-brand/50 transition-colors"></i>
                    </div>
                    <div class="aspect-[3/4] rounded-2xl bg-gradient-to-tr from-brand/10 to-brand/5 flex items-center justify-center group hover:shadow-lg transition-all duration-300">
                        <i data-lucide="image" class="w-8 h-8 text-brand/30 group-hover:text-brand/50 transition-colors"></i>
                    </div>
                    <div class="aspect-[3/4] rounded-2xl bg-gradient-to-bl from-brand/5 to-brand/20 flex items-center justify-center group hover:shadow-lg transition-all duration-300 hidden md:flex">
                        <i data-lucide="aperture" class="w-8 h-8 text-brand/30 group-hover:text-brand/50 transition-colors"></i>
                    </div>
                    <div class="aspect-[3/4] rounded-2xl bg-gradient-to-tl from-brand/15 to-brand/5 flex items-center justify-center group hover:shadow-lg transition-all duration-300 hidden md:flex">
                        <i data-lucide="sun" class="w-8 h-8 text-brand/30 group-hover:text-brand/50 transition-colors"></i>
                    </div>
                </div>
                <div class="text-center mt-8">
                    <a href="/pages/portfolio/" class="inline-flex items-center text-brand font-medium hover:text-brand-light transition-colors group">
                        <span>Voir toutes les réalisations</span>
                        <i data-lucide="arrow-right" class="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform"></i>
                    </a>
                </div>
            </div>
        </section>`;

// Visual placeholders for grid layouts - varied icons
const VISUALS = [
    { icon: 'camera', gradient: 'from-brand/5 to-brand/15' },
    { icon: 'image', gradient: 'from-brand/10 to-brand/5' },
    { icon: 'aperture', gradient: 'from-brand/5 to-brand/20' },
    { icon: 'sun', gradient: 'from-brand/15 to-brand/5' },
    { icon: 'eye', gradient: 'from-brand/5 to-brand/10' },
    { icon: 'sparkles', gradient: 'from-brand/10 to-brand/15' },
];

function splitContentByH2(contentHtml) {
    // Split the inner content by <h2 tags
    const parts = contentHtml.split(/(?=<h2\s)/);
    return parts.filter(p => p.trim().length > 0);
}

function wrapInSection(contentBlock, index, isLast) {
    const bgClass = index % 2 === 0 ? 'bg-white' : 'bg-gray-50';
    const visual = VISUALS[index % VISUALS.length];
    const isReversed = index % 2 === 1;

    // Check if this block has a list (ul) — if so, make it full width
    const hasList = contentBlock.includes('<ul ');
    // Check if content is very short
    const textLength = contentBlock.replace(/<[^>]+>/g, '').trim().length;
    const isShort = textLength < 200;

    if (hasList || isShort || isLast) {
        // Full-width centered layout for lists and short content
        return `
        <section class="py-12 lg:py-16 ${bgClass}">
            <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                ${contentBlock}
            </div>
        </section>`;
    }

    // 2-column grid layout with visual placeholder
    const visualDiv = `<div class="aspect-[4/3] rounded-2xl bg-gradient-to-br ${visual.gradient} flex items-center justify-center shadow-inner">
                        <i data-lucide="${visual.icon}" class="w-12 h-12 text-brand/25"></i>
                    </div>`;

    if (isReversed) {
        return `
        <section class="py-12 lg:py-16 ${bgClass}">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                    <div class="order-2 lg:order-1">
                        ${visualDiv}
                    </div>
                    <div class="order-1 lg:order-2">
                        ${contentBlock}
                    </div>
                </div>
            </div>
        </section>`;
    } else {
        return `
        <section class="py-12 lg:py-16 ${bgClass}">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div class="grid lg:grid-cols-2 gap-10 lg:gap-16 items-center">
                    <div>
                        ${contentBlock}
                    </div>
                    <div>
                        ${visualDiv}
                    </div>
                </div>
            </div>
        </section>`;
    }
}

function addMiniCta(afterIndex) {
    return `
        <section class="py-8 bg-brand-50 border-y border-brand/10">
            <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
                <p class="text-brand font-serif text-lg md:text-xl text-center sm:text-left">Envie de vivre cette expérience ?</p>
                <button onclick="openPopup()" class="bg-brand text-white px-6 py-3 rounded-full text-sm font-medium hover:bg-brand-light transition-colors shadow-md flex items-center cursor-pointer whitespace-nowrap">
                    <i data-lucide="calendar" class="w-4 h-4 mr-2"></i> Prendre RDV gratuit
                </button>
            </div>
        </section>`;
}

function transformPage(filePath) {
    let html = fs.readFileSync(filePath, 'utf-8');

    // Find the SEO content section
    const seoStartMatch = html.match(/<!-- SEO CONTENT -->\s*\n\s*<section[^>]*>\s*\n\s*<div[^>]*>/s);
    if (!seoStartMatch) {
        // Try alternate pattern: look for the content section after hero
        const altMatch = html.match(/<section class="py-12 lg:py-20 bg-white">\s*\n\s*<div class="max-w-3xl/s);
        if (!altMatch) {
            console.log(`  SKIP (no content section found): ${filePath}`);
            return false;
        }
    }

    // Extract the content section more carefully
    // Find the opening: <section class="py-12 lg:py-20 bg-white">...<div class="max-w-3xl...">
    const contentSectionRegex = /(<section class="py-12 lg:py-20 bg-white">\s*<div class="max-w-3xl[^"]*">)([\s\S]*?)(<\/div>\s*<\/section>)/;
    const match = html.match(contentSectionRegex);

    if (!match) {
        console.log(`  SKIP (content regex no match): ${filePath}`);
        return false;
    }

    const innerContent = match[2];

    // Split content by H2 headings
    const blocks = splitContentByH2(innerContent);

    if (blocks.length < 2) {
        console.log(`  SKIP (only ${blocks.length} block): ${filePath}`);
        return false;
    }

    console.log(`  TRANSFORM: ${blocks.length} content blocks`);

    // Build new sections
    let newSections = '';
    const galleryInsertIndex = Math.min(2, blocks.length - 1); // After 2nd block or before last

    for (let i = 0; i < blocks.length; i++) {
        // Fix h2 mt classes for first in block
        let block = blocks[i];
        // Remove mt-0 or mt-12 from h2s since they're now in their own sections
        block = block.replace(/class="text-2xl md:text-3xl font-serif text-brand mt-(?:0|12) mb-4"/g,
            'class="text-2xl md:text-3xl font-serif text-brand mb-4"');

        newSections += wrapInSection(block, i, i === blocks.length - 1);

        // Insert gallery after the designated block
        if (i === galleryInsertIndex - 1) {
            newSections += GALLERY_SECTION;
        }

        // Insert mini-CTA after the first block
        if (i === 0 && blocks.length > 2) {
            newSections += addMiniCta(i);
        }
    }

    // Replace the original content section with new sections
    html = html.replace(contentSectionRegex, newSections);

    fs.writeFileSync(filePath, html, 'utf-8');
    return true;
}

// Find all inner pages (not index.html at root)
function findPages(dir) {
    const pages = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
            pages.push(...findPages(fullPath));
        } else if (item.name.endsWith('.html') && fullPath !== path.join(PREVIEW_DIR, 'index.html')) {
            pages.push(fullPath);
        }
    }
    return pages;
}

const pages = findPages(path.join(PREVIEW_DIR, 'pages'));
console.log(`Found ${pages.length} inner pages\n`);

let transformed = 0;
let skipped = 0;

for (const page of pages) {
    const rel = path.relative(PREVIEW_DIR, page);
    console.log(`Processing: ${rel}`);
    if (transformPage(page)) {
        transformed++;
    } else {
        skipped++;
    }
}

console.log(`\nDone: ${transformed} transformed, ${skipped} skipped`);
