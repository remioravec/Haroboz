// wp-push/migrate/13-build-pages.js
// For each preview page, create/update a WP page with Elementor data.
// Strategy (v1) : 1 section × 1 column × 1 HTML widget containing the full body content.
// The client can later split the HTML widget into native Elementor widgets for finer editing.
//
// Pages are pushed as DRAFT — they become publish only during Phase 5 (basculement).

const fs = require('fs');
const path = require('path');
const api = require('./lib/haroboz-api');
const b = require('./lib/elementor-builder');

async function main() {
  const inventory = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '../../content/inventory/inventory-raw.json'), 'utf8'
  ));
  const pageBySlug = Object.fromEntries(inventory.pages.map(p => [p.slug, p]));

  const fusedDir = path.resolve(__dirname, '../../content/fused');
  const slugs = fs.readdirSync(fusedDir)
    .filter(f => f.endsWith('.html'))
    .map(f => f.replace(/\.html$/, ''))
    .sort();

  console.log(`Building ${slugs.length} Elementor pages (as draft)…\n`);

  const report = [];
  for (const slug of slugs) {
    const html = fs.readFileSync(path.join(fusedDir, `${slug}.html`), 'utf8')
      .replace(/^<!--[^>]*-->\s*/, ''); // strip the leading comment we added in step 04
    const wpPage = pageBySlug[slug];
    if (!wpPage) {
      console.log(`  ⚠️  ${slug} : pas de page WP correspondante → skip`);
      report.push({ slug, status: 'no-wp-page' });
      continue;
    }

    // Build Elementor data
    const elementorData = b.wrapHtml(html);
    const dataStr = JSON.stringify(elementorData);

    // Preserve existing yoast meta if present (title + description)
    const existingMeta = wpPage && wpPage.meta ? {} : {};

    const meta = {
      _elementor_data: dataStr,
      _elementor_edit_mode: 'builder',
      _elementor_template_type: 'wp-page',
      _elementor_version: b.ELEMENTOR_VERSION,
      _elementor_pro_version: '3.28.0',
      _elementor_page_settings: JSON.stringify({}),
      // Set page template directly via meta (Hello Elementor provides 'elementor_canvas' and 'elementor_header_footer').
      _wp_page_template: 'elementor_canvas',
    };

    try {
      await api.updatePage(wpPage.id, {
        status: 'draft',
        meta,
      });
      console.log(`  ✅ ${slug.padEnd(35)} → id ${wpPage.id} (draft, elementor_data ${(dataStr.length / 1024).toFixed(1)} KB)`);
      report.push({ slug, id: wpPage.id, size_kb: +(dataStr.length / 1024).toFixed(1), status: 'ok' });
    } catch (e) {
      console.log(`  ❌ ${slug} → ${e.message.slice(0, 200)}`);
      report.push({ slug, id: wpPage.id, status: 'error', error: e.message });
    }
    // Spacing: let LiteSpeed/PHP finish cleanup between heavy writes
    await new Promise(r => setTimeout(r, 1500));
  }

  const outFile = path.resolve(__dirname, '../../content/build-report.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));
  const ok = report.filter(r => r.status === 'ok').length;
  console.log(`\n✅ ${ok}/${report.length} pages construites. Rapport : ${outFile}`);
}

main().catch(e => { console.error(e); process.exit(1); });
