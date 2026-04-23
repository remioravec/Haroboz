// wp-push/migrate/15-publish-pages.js
// Phase 5 : publish all Elementor-built draft pages.
const fs = require('fs');
const path = require('path');
const api = require('./lib/haroboz-api');

async function main() {
  const report = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '../../content/build-report.json'), 'utf8'
  ));
  const ok = report.filter(r => r.status === 'ok');
  console.log(`Publication de ${ok.length} pages…\n`);

  for (const r of ok) {
    try {
      await api.updatePage(r.id, { status: 'publish' });
      console.log(`  ✅ ${r.slug.padEnd(35)} → id ${r.id} published`);
    } catch (e) {
      console.log(`  ❌ ${r.slug} → ${e.message.slice(0, 150)}`);
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  console.log(`\n✅ Publication terminée.`);
}
main().catch(e => { console.error(e); process.exit(1); });
