// wp-push/migrate/01-inventory.js
// Full WP inventory via the custom Haroboz API endpoint (bypasses LiteSpeed auth strip).
const fs = require('fs');
const path = require('path');
const api = require('./lib/haroboz-api');

async function main() {
  console.log(`Inventaire de ${api.SITE}…`);

  const [ping, theme, plugins, pages, media, namespaces] = await Promise.all([
    api.ping(),
    api.activeTheme(),
    api.listPlugins(),
    api.listPages('any'),
    api.listMedia(),
    api.restNamespaces(),
  ]);

  const out = {
    scanned_at: new Date().toISOString(),
    site_url: api.SITE,
    ping,
    active_theme: theme,
    plugins,
    pages,
    media_count: media.length,
    media,
    rest_namespaces: namespaces,
  };

  const outDir = path.resolve(__dirname, '../../content/inventory');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'inventory-raw.json');
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`✅ Inventaire écrit : ${outFile}`);
  console.log(`   ${pages.length} pages, ${media.length} médias, ${plugins.length} plugins (${plugins.filter(p=>p.active).length} actifs)`);
  console.log(`   Thème : ${theme.name} ${theme.version} (${theme.stylesheet})`);
  console.log(`   Build plugin : ${ping.build}, WP ${ping.wp}`);
}
main().catch(e => { console.error(e); process.exit(1); });
