// wp-push/migrate/00b-smoke-custom.js
// Smoke test for the custom Haroboz API endpoint (post-plugin-upload).
const api = require('./lib/haroboz-api');

async function main() {
  console.log(`\n=== Haroboz custom API smoke test on ${api.SITE} ===\n`);

  const tests = [
    ['ping', () => api.ping()],
    ['diag', () => api.diag()],
    ['active_theme', () => api.activeTheme()],
    ['list_plugins (count only)', async () => (await api.listPlugins()).length + ' plugins'],
    ['list_pages (count only)', async () => (await api.listPages('any')).length + ' pages'],
    ['list_media (first batch)', async () => (await api.api('list_media', { offset: 0, limit: 5 })).length + ' media (first 5)'],
  ];

  for (const [label, fn] of tests) {
    try {
      const out = await fn();
      console.log(`✅ ${label} →`, typeof out === 'string' ? out : JSON.stringify(out).slice(0, 200));
    } catch (e) {
      console.log(`❌ ${label} → ${e.message}`);
    }
  }
  console.log('\n=== Done ===\n');
}

main().catch(e => { console.error(e); process.exit(1); });
