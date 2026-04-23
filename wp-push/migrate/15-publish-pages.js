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
      // Pass template explicitly to overwrite the previous 'elementor_canvas' value which
      // isn't whitelisted by Hello Elementor 3.4.7 → 'default' is always valid.
      // Elementor renders the content; Theme Builder supplies header/footer.
      await api.updatePage(r.id, { status: 'publish', template: 'default' });
      console.log(`  ✅ ${r.slug.padEnd(35)} → id ${r.id} published`);
    } catch (e) {
      console.log(`  ❌ ${r.slug} → ${e.message.slice(0, 200)}`);
    }
    await new Promise(res => setTimeout(res, 1000));
  }
  console.log(`\n✅ Publication terminée.`);
}
main().catch(e => { console.error(e); process.exit(1); });
