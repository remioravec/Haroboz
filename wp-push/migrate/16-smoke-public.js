// wp-push/migrate/16-smoke-public.js
// After basculement (plugin desactive + pages published), smoke-test public URLs.
const fs = require('fs');
const path = require('path');

const SITE = (require('dotenv').config({ path: path.resolve(__dirname, '../.env') }) && process.env.WP_SITE_URL || '').replace(/\/$/, '');

const inv = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../content/inventory/inventory-raw.json'), 'utf8'));
const slugs = inv.pages.filter(p => p.status === 'publish' && p.slug).map(p => p.slug);

async function main() {
  console.log(`Smoke test ${slugs.length} URLs publiques sur ${SITE}…\n`);
  const results = [];
  for (const slug of slugs) {
    const url = slug === 'accueil' ? SITE + '/' : `${SITE}/${slug}/`;
    try {
      const res = await fetch(url, { redirect: 'follow' });
      const body = await res.text();
      const hasTitle = /<title>/i.test(body);
      const hasHaroboz = /haroboz|Haroboz/.test(body);
      const sizeKB = (body.length / 1024).toFixed(1);
      const sample = body.match(/<title>([^<]+)<\/title>/i);
      const status = res.ok && hasTitle && hasHaroboz ? '✅' : '❌';
      console.log(`  ${status} ${url.padEnd(60)} ${res.status} | ${sizeKB} KB | ${sample ? sample[1].slice(0, 50) : '(no title)'}`);
      results.push({ slug, url, status: res.status, size: body.length, title: sample ? sample[1] : null, ok: res.ok && hasTitle && hasHaroboz });
    } catch (e) {
      console.log(`  💥 ${url} → ${e.message}`);
      results.push({ slug, url, error: e.message });
    }
  }
  const ok = results.filter(r => r.ok).length;
  console.log(`\n${ok}/${results.length} URLs OK.`);
  fs.writeFileSync(path.resolve(__dirname, '../../content/smoke-public.json'), JSON.stringify(results, null, 2));
}

main().catch(e => { console.error(e); process.exit(1); });
