// wp-push/migrate/00-smoke-test.js
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const SITE = process.env.WP_SITE_URL.replace(/\/$/, '');
const AUTH = 'Basic ' + Buffer.from(
  `${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`
).toString('base64');

async function main() {
  const endpoints = [
    ['/wp-json/', 'Rest API root'],
    ['/wp-json/wp/v2/pages?per_page=1', 'Pages endpoint'],
    ['/wp-json/wp/v2/media?per_page=1', 'Media endpoint'],
    ['/wp-json/wp/v2/users/me', 'User auth check'],
  ];
  for (const [path, label] of endpoints) {
    const res = await fetch(SITE + path, { headers: { Authorization: AUTH } });
    const ok = res.ok ? '✅' : '❌';
    console.log(`${ok} ${label} → ${res.status} ${res.statusText}`);
    if (!res.ok) {
      const body = await res.text();
      console.log('   Body:', body.slice(0, 300));
    }
  }
}
main().catch(e => { console.error(e); process.exit(1); });
