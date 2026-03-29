#!/usr/bin/env node
/**
 * 02-analyze-structure.js — Analyse SEO du site scrapé
 *
 * Usage : node scripts/02-analyze-structure.js
 *
 * Lit les fichiers dans scraping/output/ et produit un rapport :
 * - Problèmes SEO par page
 * - Maillage interne actuel (qui linke vers qui)
 * - Pages orphelines
 * - Inventaire des images
 * - Comparaison avec le cocon sémantique cible
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.resolve(__dirname, '..', 'scraping', 'output');

function main() {
  console.log('🔬 ANALYSE SEO — HAROBOZ');
  console.log('========================\n');

  const files = fs.readdirSync(OUTPUT_DIR).filter(f => f.endsWith('.json'));
  if (files.length === 0) {
    console.error('❌ Aucun fichier scrapé. Lancer d\'abord : node scripts/01-scrape-public.js');
    process.exit(1);
  }

  const pages = files.map(f => JSON.parse(fs.readFileSync(path.join(OUTPUT_DIR, f), 'utf8')));
  console.log(`📄 ${pages.length} pages à analyser\n`);

  const report = {
    generated_at: new Date().toISOString(),
    pages: [],
    seo_issues: [],
    maillage: { links: [], orphans: [] },
    images_audit: { total: 0, no_alt: 0, details: [] },
    cocon_gap: []
  };

  // Pages cibles du cocon sémantique
  const coconSlugs = [
    'packs-shooting', 'portrait-studio-cannes', 'shooting-exterieur-cote-azur',
    'shooting-duo-couple', 'photo-domicile', 'votre-experience',
    'retrouver-confiance-corps', 'book-modele-professionnel', 'premier-shooting-nu',
    'cadeau-couple-original', 'photographe-cote-azur', 'photographe-homme-nu-cannes',
    'shooting-couple-antibes', 'photographe-mougins', 'photographe-nice',
    'shooting-mandelieu', 'portfolio', 'temoignages-clients',
    'galerie-portraits-hommes', 'galerie-couples', 'boutique',
    'tirages-art-edition-limitee', 'carte-cadeau', 'galerie-privee-client',
    'a-propos', 'contact'
  ];

  const existingSlugs = new Set(pages.map(p => p.slug));
  const allLinkedUrls = new Set();

  for (const page of pages) {
    const issues = [];

    // H1
    if (page.h1.length === 0) issues.push('❌ Pas de H1');
    if (page.h1.length > 1) issues.push(`⚠️ ${page.h1.length} H1 — devrait être unique`);

    // Meta
    if (!page.meta_description) issues.push('❌ Pas de meta description');
    if (page.meta_description && page.meta_description.length > 160) {
      issues.push(`⚠️ Meta description trop longue (${page.meta_description.length} car.)`);
    }
    if (page.title && page.title.length > 65) {
      issues.push(`⚠️ Title tag long (${page.title.length} car.)`);
    }

    // Contenu
    if (page.word_count < 300) issues.push(`⚠️ Contenu court (${page.word_count} mots)`);
    if (page.h2s.length === 0 && page.word_count > 300) issues.push('⚠️ Pas de H2');

    // Images
    if (page.images_no_alt > 0) issues.push(`⚠️ ${page.images_no_alt} images sans alt`);

    // Maillage
    if (page.internal_links_count === 0) issues.push('⚠️ Aucun lien interne sortant');

    // Collecter les liens
    for (const link of (page.internal_links || [])) {
      allLinkedUrls.add(link.replace(/\/$/, ''));
      report.maillage.links.push({
        from: page.slug,
        to: link
      });
    }

    report.pages.push({
      slug: page.slug,
      url: page.url,
      title: page.title,
      h1: page.h1,
      h2s: page.h2s,
      word_count: page.word_count,
      images: page.images_count,
      images_no_alt: page.images_no_alt,
      internal_links: page.internal_links_count,
      has_meta_desc: !!page.meta_description,
      issues_count: issues.length,
      issues
    });

    if (issues.length > 0) {
      report.seo_issues.push({ slug: page.slug, issues });
    }

    // Audit images
    for (const img of (page.images || [])) {
      report.images_audit.total++;
      if (!img.alt) report.images_audit.no_alt++;
      report.images_audit.details.push({
        page: page.slug,
        src: img.src,
        alt: img.alt || '⚠️ MANQUANT'
      });
    }
  }

  // Pages orphelines
  for (const page of pages) {
    const pageUrl = page.url?.replace(/\/$/, '') || '';
    if (!allLinkedUrls.has(pageUrl) && page.slug !== 'accueil' && page.slug !== '') {
      report.maillage.orphans.push({
        slug: page.slug,
        title: page.title,
        url: page.url
      });
    }
  }

  // Gap cocon sémantique (pages qui n'existent pas encore)
  for (const slug of coconSlugs) {
    if (!existingSlugs.has(slug)) {
      report.cocon_gap.push(slug);
    }
  }

  // Sauvegarder
  const reportPath = path.join(OUTPUT_DIR, 'analysis-report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

  // Affichage
  console.log('========================================');
  console.log('📊 RAPPORT D\'ANALYSE SEO');
  console.log('========================================');

  console.log(`\n📄 PAGES (${report.pages.length})`);
  for (const p of report.pages) {
    const status = p.issues_count === 0 ? '✅' : `⚠️ ${p.issues_count} pb`;
    console.log(`   ${status}  ${p.slug} — ${p.word_count} mots — ${p.h1[0] || 'PAS DE H1'}`);
  }

  if (report.seo_issues.length > 0) {
    console.log(`\n🚨 PROBLÈMES SEO (${report.seo_issues.length} pages)`);
    for (const item of report.seo_issues) {
      console.log(`\n   📄 ${item.slug} :`);
      for (const issue of item.issues) {
        console.log(`      ${issue}`);
      }
    }
  }

  if (report.maillage.orphans.length > 0) {
    console.log(`\n🔗 PAGES ORPHELINES (aucun lien entrant) :`);
    for (const p of report.maillage.orphans) {
      console.log(`   - ${p.slug}`);
    }
  }

  if (report.cocon_gap.length > 0) {
    console.log(`\n🆕 PAGES DU COCON À CRÉER (${report.cocon_gap.length}) :`);
    for (const slug of report.cocon_gap) {
      console.log(`   + ${slug}`);
    }
  }

  console.log(`\n🖼️  IMAGES : ${report.images_audit.total} total, ${report.images_audit.no_alt} sans alt`);

  console.log(`\n   📁 Rapport : scraping/output/analysis-report.json`);
  console.log('   ➡️  Prochaine étape : Rédiger les contenus dans content/pages/');
}

main();
