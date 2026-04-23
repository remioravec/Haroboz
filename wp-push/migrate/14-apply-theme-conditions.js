// wp-push/migrate/14-apply-theme-conditions.js
// After creating the Theme Builder header/footer in step 12, assign them to "Entire Site".
// Elementor Pro stores conditions in post meta `_elementor_conditions` on each template.

const fs = require('fs');
const path = require('path');
const api = require('./lib/haroboz-api');

async function main() {
  const tb = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '../../content/theme-builder.json'), 'utf8'
  ));

  // Elementor Pro stores conditions as serialized PHP array, but recent versions accept JSON-ish structures.
  // The include everywhere condition is: "include/general"
  async function assign(id, condition) {
    const meta = { _elementor_conditions: [condition] };
    await api.updatePage(id, { meta });
    console.log(`  ✅ template ${id} → condition "${condition}"`);
  }

  // Note: updatePage is for pages; elementor_library uses same update path in our API.
  // We use generic api call to update meta.
  async function setMeta(id, key, value) {
    return api.api('update_page', { id, data: { meta: { [key]: value } } });
  }

  try {
    await setMeta(tb.header, '_elementor_conditions', ['include/general']);
    console.log(`  Header (${tb.header}) → Entire Site`);
  } catch (e) { console.log(`  ❌ Header : ${e.message}`); }

  try {
    await setMeta(tb.footer, '_elementor_conditions', ['include/general']);
    console.log(`  Footer (${tb.footer}) → Entire Site`);
  } catch (e) { console.log(`  ❌ Footer : ${e.message}`); }

  console.log('\n👉 Vérification manuelle : WP admin > Templates > Theme Builder');
  console.log('   Si Header/Footer n\'apparaissent pas comme "Everywhere", réassigne manuellement.');
}

main().catch(e => { console.error(e); process.exit(1); });
