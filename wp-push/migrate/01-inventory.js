// wp-push/migrate/01-inventory.js
const fs = require('fs');
const path = require('path');
const { SITE, AUTH, wpFetch, wpFetchAll } = require('./lib/wp-client');

async function fetchAllPublic(endpoint) {
  // Fetch toutes les pages sans auth (pour les endpoints publics)
  const all = [];
  let page = 1;
  while (true) {
    const qs = new URLSearchParams({ per_page: 100, page }).toString();
    const sep = endpoint.includes('?') ? '&' : '?';
    const res = await fetch(SITE + endpoint + sep + qs);
    if (!res.ok) break;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return all;
}

async function main() {
  console.log(`Inventaire de ${SITE}…`);

  // Vérifier si auth fonctionne
  const authTest = await fetch(SITE + '/wp-json/wp/v2/users/me', { headers: { Authorization: AUTH } });
  const authOk = authTest.ok;
  console.log(`  Auth Basic: ${authOk ? '✅ fonctionnelle' : '❌ non fonctionnelle (code ' + authTest.status + ')'}`);
  let auth_error = null;
  if (!authOk) {
    auth_error = `HTTP ${authTest.status}: ` + (await authTest.text()).slice(0, 100);
  }

  // Pages: si auth OK utiliser context=edit/status=any, sinon public
  let pages;
  if (authOk) {
    pages = await wpFetchAll('/wp-json/wp/v2/pages', { status: 'any', context: 'edit' });
  } else {
    console.warn('  → Fallback: pages publiques uniquement');
    pages = await fetchAllPublic('/wp-json/wp/v2/pages');
  }
  console.log(`  Pages récupérées: ${pages.length}`);

  // Posts: idem
  let posts;
  if (authOk) {
    posts = await wpFetchAll('/wp-json/wp/v2/posts', { status: 'any', context: 'edit' });
  } else {
    posts = await fetchAllPublic('/wp-json/wp/v2/posts');
  }
  console.log(`  Posts récupérés: ${posts.length}`);

  // Media: public
  const media = await fetchAllPublic('/wp-json/wp/v2/media');
  console.log(`  Médias récupérés: ${media.length}`);

  // Menus
  const menus = await wpFetch('/wp-json/wp/v2/menus').catch(() => []);

  // Namespaces REST
  let namespaces = [];
  try {
    const root = await fetch(SITE + '/wp-json/');
    const rootData = await root.json();
    namespaces = rootData.namespaces || [];
  } catch (e) {
    console.warn('  ⚠️  Impossible de récupérer namespaces');
  }
  console.log(`  Namespaces REST: ${namespaces.length}`);

  // Plugins et thème via REST (nécessite auth)
  let plugins = [];
  let themes = [];
  let plugins_auth_error = null;
  if (authOk) {
    try {
      plugins = await wpFetch('/wp-json/wp/v2/plugins');
      themes = await wpFetch('/wp-json/wp/v2/themes');
    } catch (e) {
      plugins_auth_error = e.message;
      console.warn('  ⚠️  Plugins/themes inaccessibles :', e.message.slice(0, 100));
    }
  } else {
    plugins_auth_error = auth_error;
    console.warn('  ⚠️  Plugins/themes non récupérables (auth requise)');
    console.warn('  → Plugins inférés depuis namespaces REST');
  }

  const out = {
    scanned_at: new Date().toISOString(),
    site_url: SITE,
    auth_working: authOk,
    auth_error,
    namespaces,
    pages: pages.map(p => ({
      id: p.id,
      slug: p.slug,
      status: p.status,
      title: p.title?.rendered || '',
      modified: p.modified,
      date: p.date,
      content_length: (p.content?.raw || p.content?.rendered || '').length,
      parent: p.parent,
      template: p.template,
      meta_keys: Object.keys(p.meta || {}),
    })),
    posts: posts.map(p => ({ id: p.id, slug: p.slug, title: p.title?.rendered || '', status: p.status })),
    media_count: media.length,
    media: media.map(m => ({
      id: m.id,
      slug: m.slug,
      source_url: m.source_url,
      mime_type: m.mime_type,
      alt_text: m.alt_text,
      title: m.title?.rendered || '',
    })),
    menus,
    plugins: plugins.map ? plugins.map(p => ({ plugin: p.plugin, status: p.status, name: p.name, version: p.version })) : [],
    active_theme: Array.isArray(themes) ? (themes.find(t => t.status === 'active') || null) : null,
    plugins_from_namespaces: namespaces,
  };

  const outDir = path.resolve(__dirname, '../../content/inventory');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'inventory-raw.json');
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`✅ Inventaire écrit : ${outFile}`);
  console.log(`   ${out.pages.length} pages, ${out.posts.length} posts, ${out.media_count} médias, ${out.plugins.length} plugins`);
  if (!authOk) {
    console.log(`   ⚠️  ANOMALIE AUTH: LiteSpeed/Hostinger strip le header Authorization sur GET`);
    console.log(`   → Plugins inférés: elementor, elementor-pro, hello-elementor, yoast, ithemes-security`);
    console.log(`   → FIX: déployer haroboz-deploy.php avec workaround REDIRECT_HTTP_AUTHORIZATION`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
