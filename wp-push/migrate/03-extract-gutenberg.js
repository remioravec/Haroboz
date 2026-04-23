// wp-push/migrate/03-extract-gutenberg.js
// Extract raw Gutenberg content for every WP page via Haroboz custom API.
const fs = require('fs');
const path = require('path');
const api = require('./lib/haroboz-api');

async function main() {
  const raw = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '../../content/inventory/inventory-raw.json'), 'utf8'
  ));

  const outDir = path.resolve(__dirname, '../../content/gutenberg-client');
  fs.mkdirSync(outDir, { recursive: true });

  // Filter: published pages with non-empty slug (skip the orphan Elementor #3406 draft).
  const pages = raw.pages.filter(p => p.status === 'publish' && p.slug);
  console.log(`Extraction de ${pages.length} pages Gutenberg…`);

  let total = 0;
  for (const p of pages) {
    const full = await api.getPage(p.id);
    const record = {
      id: full.id,
      slug: full.slug,
      status: full.status,
      date: full.date,
      modified: full.modified,
      title: full.title || '',
      content_raw: full.content_raw || '',
      excerpt: full.excerpt || '',
      parent: full.parent,
      menu_order: full.menu_order,
      template: full.template,
      meta: full.meta || {},
    };
    const file = path.join(outDir, `${full.slug || full.id}.json`);
    fs.writeFileSync(file, JSON.stringify(record, null, 2));
    total += record.content_raw.length;
    const kb = (record.content_raw.length / 1024).toFixed(1);
    console.log(`  ${full.slug.padEnd(35)} | ${kb} KB | modified ${full.modified.slice(0, 10)}`);
  }
  console.log(`\n✅ ${pages.length} pages écrites dans ${outDir}`);
  console.log(`   Total : ${(total / 1024).toFixed(1)} KB de contenu Gutenberg`);
}
main().catch(e => { console.error(e); process.exit(1); });
