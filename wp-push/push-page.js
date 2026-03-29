#!/usr/bin/env node
/**
 * push-page.js — Push contenu vers WordPress (Phase B)
 *
 * Usage :
 *   node wp-push/push-page.js <slug>              # Mise à jour
 *   node wp-push/push-page.js <slug> --create      # Création
 *   node wp-push/push-page.js <slug> --dry-run     # Simulation
 *
 * Lit le fichier content/pages/<slug>.json et pousse vers WP.
 * ⚠️ TOUJOURS en brouillon (draft).
 */

const path = require('path');
const fs = require('fs');
const wp = require('./wp-api');

const CONTENT_DIR = path.resolve(__dirname, '..', 'content', 'pages');

async function main() {
  const args = process.argv.slice(2);
  const slug = args.find(a => !a.startsWith('--'));
  const isCreate = args.includes('--create');
  const isDryRun = args.includes('--dry-run');

  if (!slug) {
    console.error('Usage : node wp-push/push-page.js <slug> [--create] [--dry-run]');
    process.exit(1);
  }

  const contentFile = path.join(CONTENT_DIR, `${slug}.json`);
  if (!fs.existsSync(contentFile)) {
    console.error(`❌ Fichier introuvable : content/pages/${slug}.json`);
    process.exit(1);
  }

  const pageData = JSON.parse(fs.readFileSync(contentFile, 'utf8'));

  // Convertir les liens preview (relatifs) en liens WordPress (absolus)
  let wpContent = pageData.content;
  wpContent = wpContent.replace(/href="\/pages\/([^"]+)\.html"/g, `href="${wp.BASE_URL}/$1/"`);
  wpContent = wpContent.replace(/href="\/"/g, `href="${wp.BASE_URL}/"`);
  // Retirer le bandeau preview
  wpContent = wpContent.replace(/<div class="hrb-preview-banner">.*?<\/div>/g, '');

  console.log(`\n📄 ${isCreate ? 'CRÉATION' : 'MISE À JOUR'} : ${pageData.title}`);
  console.log(`   Slug : ${slug}`);
  console.log(`   Dry run : ${isDryRun}`);

  const connected = await wp.testConnection();
  if (!connected) process.exit(1);

  if (isDryRun) {
    console.log('\n🔍 Données qui seraient envoyées :');
    console.log(`   Title : ${pageData.title}`);
    console.log(`   Meta Title : ${pageData.meta_title}`);
    console.log(`   Meta Desc : ${pageData.meta_description}`);
    console.log(`   Content length : ${wpContent.length} car.`);
    return;
  }

  if (isCreate) {
    const result = await wp.createPage({
      title: pageData.title,
      content: wpContent,
      slug: slug,
      parent: pageData.parent || 0
    });
    console.log(`✅ Page créée #${result.id} en brouillon`);
  } else {
    // Chercher la page par slug
    const existing = await wp.wpFetch(`/wp/v2/pages?slug=${slug}`);
    if (existing.length === 0) {
      console.error(`❌ Aucune page avec le slug "${slug}". Utiliser --create.`);
      process.exit(1);
    }
    await wp.updatePage(existing[0].id, {
      title: pageData.title,
      content: wpContent
    });
    console.log(`✅ Page #${existing[0].id} mise à jour`);
  }
}

main().catch(err => {
  console.error('❌', err.message);
  process.exit(1);
});
