# Refonte Elementor Haroboz — Plan d'Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrer les 28 pages du plugin takeover vers Elementor Pro, en intégrant les textes modifiés par le client dans Gutenberg, et désactiver le plugin takeover à la fin.

**Architecture:** Scripts Node.js qui parlent à l'API REST WordPress (pages, médias, post meta `_elementor_data`). Le design Elementor est généré en JSON à partir du preview actuel et injecté via l'API. Theme Builder Pro pour header/footer/popup globaux. Hello Elementor comme thème vide.

**Tech Stack:** Node.js 18+, dotenv, fetch natif, cheerio (parsing HTML), WordPress REST API, Elementor Pro 3.x.

**Spec:** `docs/superpowers/specs/2026-04-23-refonte-elementor-haroboz-design.md`

---

## Conventions

- **Fichiers de scripts** : `wp-push/migrate/<step>.js` (tous les scripts de migration dans ce sous-dossier, laisser `replace-site.js` intact comme fallback).
- **Fichiers de données** : `content/gutenberg-client/{slug}.json`, `content/fused/{slug}.json`.
- **Docs produites** : `docs/inventory-2026-04-23.md`, `docs/diff-gutenberg.md`, `docs/guide-elementor-client.md`.
- **Builder Elementor** : `wp-push/migrate/elementor-builder.js` (helpers pour générer `_elementor_data`).
- **Safety** : chaque écriture WP (création page, upload média) → retry 3× avec backoff 2s.
- **Slugs et IDs** : chaque section/widget Elementor a un ID hexadécimal de 7 chars, unique par page. On génère avec `crypto.randomBytes(3).toString('hex') + 'a'`.

---

## Phase 0 — Inventaire WP

### Task 1 : Smoke test API WP

**Files:**
- Create: `wp-push/migrate/00-smoke-test.js`

- [ ] **Step 1.1 : Créer le script smoke test**

```javascript
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
```

- [ ] **Step 1.2 : Exécuter**

Run: `node wp-push/migrate/00-smoke-test.js`
Expected: 4 lignes ✅. Si ❌ sur "User auth check", regenerer un app password sur WP admin → Users → Profile → Application Passwords, puis mettre à jour `.env`.

- [ ] **Step 1.3 : Commit**

```bash
git add wp-push/migrate/00-smoke-test.js
git commit -m "Phase 0 : smoke test API WP"
```

### Task 2 : Script d'inventaire complet

**Files:**
- Create: `wp-push/migrate/01-inventory.js`
- Create: `wp-push/migrate/lib/wp-client.js`

- [ ] **Step 2.1 : Créer le client WP réutilisable**

```javascript
// wp-push/migrate/lib/wp-client.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const SITE = process.env.WP_SITE_URL.replace(/\/$/, '');
const AUTH = 'Basic ' + Buffer.from(
  `${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`
).toString('base64');

async function wpFetch(endpoint, opts = {}) {
  const url = endpoint.startsWith('http') ? endpoint : SITE + endpoint;
  const headers = {
    Authorization: AUTH,
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WP ${res.status} on ${endpoint} — ${body.slice(0, 200)}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

async function wpFetchAll(endpoint, params = {}) {
  // Auto-paginate
  const all = [];
  let page = 1;
  while (true) {
    const qs = new URLSearchParams({ ...params, per_page: 100, page }).toString();
    const sep = endpoint.includes('?') ? '&' : '?';
    const res = await fetch(SITE + endpoint + sep + qs, { headers: { Authorization: AUTH } });
    if (res.status === 400) break; // page > total_pages
    if (!res.ok) throw new Error(`WP ${res.status} on ${endpoint}?${qs}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return all;
}

module.exports = { SITE, AUTH, wpFetch, wpFetchAll };
```

- [ ] **Step 2.2 : Créer le script d'inventaire**

```javascript
// wp-push/migrate/01-inventory.js
const fs = require('fs');
const path = require('path');
const { SITE, wpFetch, wpFetchAll } = require('./lib/wp-client');

async function main() {
  console.log(`Inventaire de ${SITE}…`);

  const pages = await wpFetchAll('/wp-json/wp/v2/pages', { status: 'any', context: 'edit' });
  const posts = await wpFetchAll('/wp-json/wp/v2/posts', { status: 'any', context: 'edit' });
  const media = await wpFetchAll('/wp-json/wp/v2/media');
  const menus = await wpFetch('/wp-json/wp/v2/menus').catch(() => []);

  // Thème + plugins via endpoints admin (REST v2 wp/v2/themes + wp/v2/plugins)
  let plugins = [];
  let themes = [];
  try {
    plugins = await wpFetch('/wp-json/wp/v2/plugins');
    themes = await wpFetch('/wp-json/wp/v2/themes');
  } catch (e) {
    console.warn('⚠️  Impossible de lister plugins/themes via REST :', e.message);
  }

  const out = {
    scanned_at: new Date().toISOString(),
    site_url: SITE,
    pages: pages.map(p => ({
      id: p.id,
      slug: p.slug,
      status: p.status,
      title: p.title?.rendered || '',
      modified: p.modified,
      date: p.date,
      content_length: (p.content?.raw || '').length,
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
    plugins: plugins.map(p => ({ plugin: p.plugin, status: p.status, name: p.name, version: p.version })),
    active_theme: themes.find(t => t.status === 'active') || null,
  };

  const outDir = path.resolve(__dirname, '../../content/inventory');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'inventory-raw.json');
  fs.writeFileSync(outFile, JSON.stringify(out, null, 2));
  console.log(`✅ Inventaire écrit : ${outFile}`);
  console.log(`   ${out.pages.length} pages, ${out.posts.length} posts, ${out.media_count} médias, ${out.plugins.length} plugins`);
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 2.3 : Exécuter**

Run: `node wp-push/migrate/01-inventory.js`
Expected: fichier `content/inventory/inventory-raw.json` créé. Log affiche compte de pages/posts/médias/plugins.

- [ ] **Step 2.4 : Commit**

```bash
git add wp-push/migrate/01-inventory.js wp-push/migrate/lib/wp-client.js
git commit -m "Phase 0 : script d'inventaire WP (pages, medias, plugins, theme)"
```

### Task 3 : Rapport d'inventaire lisible

**Files:**
- Create: `wp-push/migrate/02-inventory-report.js`
- Output: `docs/inventory-2026-04-23.md`

- [ ] **Step 3.1 : Créer le générateur de rapport**

```javascript
// wp-push/migrate/02-inventory-report.js
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../../content/inventory/inventory-raw.json'), 'utf8'
));

// Date de référence = dernier push du plugin takeover (2026-03-30)
const REF_DATE = '2026-03-30T00:00:00';

const modified = raw.pages.filter(p => p.modified > REF_DATE);
const unmodified = raw.pages.filter(p => p.modified <= REF_DATE);

const lines = [];
lines.push(`# Inventaire WP haroboz.com — ${raw.scanned_at.slice(0, 10)}`);
lines.push('');
lines.push(`**Site :** ${raw.site_url}`);
lines.push(`**Pages totales :** ${raw.pages.length}`);
lines.push(`**Posts :** ${raw.posts.length}`);
lines.push(`**Médias :** ${raw.media_count}`);
lines.push(`**Plugins :** ${raw.plugins.length}`);
lines.push(`**Thème actif :** ${raw.active_theme?.name?.raw || raw.active_theme?.stylesheet || 'inconnu'}`);
lines.push('');

lines.push('## Pages modifiées après le push takeover (2026-03-30)');
lines.push('');
lines.push('| ID | Slug | Title | Modified | Status | Longueur |');
lines.push('|---|---|---|---|---|---|');
for (const p of modified) {
  lines.push(`| ${p.id} | \`${p.slug}\` | ${p.title.slice(0, 50)} | ${p.modified.slice(0, 10)} | ${p.status} | ${p.content_length} |`);
}
lines.push('');

lines.push('## Pages non modifiées depuis');
lines.push('');
lines.push('| ID | Slug | Title | Modified | Status |');
lines.push('|---|---|---|---|---|');
for (const p of unmodified) {
  lines.push(`| ${p.id} | \`${p.slug}\` | ${p.title.slice(0, 50)} | ${p.modified.slice(0, 10)} | ${p.status} |`);
}
lines.push('');

lines.push('## Plugins actifs');
lines.push('');
lines.push('| Nom | Version | Statut |');
lines.push('|---|---|---|');
for (const pl of raw.plugins.filter(p => p.status === 'active')) {
  lines.push(`| ${pl.name} | ${pl.version} | ${pl.status} |`);
}
lines.push('');

lines.push('## Plugins clés à vérifier');
lines.push('');
const wanted = ['elementor', 'elementor-pro', 'hello-elementor', 'haroboz', 'yoast', 'rank-math', 'seo'];
for (const w of wanted) {
  const found = raw.plugins.filter(p => (p.plugin || '').toLowerCase().includes(w) || (p.name || '').toLowerCase().includes(w));
  for (const f of found) {
    lines.push(`- \`${f.plugin}\` : ${f.name} ${f.version} → **${f.status}**`);
  }
}
lines.push('');

lines.push('## Médias (5 premiers)');
lines.push('');
for (const m of raw.media.slice(0, 5)) {
  lines.push(`- [${m.id}] ${m.slug} → ${m.source_url}`);
}

fs.writeFileSync(
  path.resolve(__dirname, '../../docs/inventory-2026-04-23.md'),
  lines.join('\n')
);
console.log('✅ docs/inventory-2026-04-23.md écrit');
```

- [ ] **Step 3.2 : Exécuter**

Run: `node wp-push/migrate/02-inventory-report.js`
Expected: `docs/inventory-2026-04-23.md` contient tables et stats.

- [ ] **Step 3.3 : Lire le rapport et noter les pages modifiées**

Ouvrir `docs/inventory-2026-04-23.md`, noter dans le `summary` en tête du fichier :
- Nombre de pages "dirties" (modifiées)
- Plugin SEO présent (Yoast ou RankMath)
- Thème actuel (Hello Elementor, ou autre qu'il faudra basculer)

- [ ] **Step 3.4 : Commit**

```bash
git add wp-push/migrate/02-inventory-report.js docs/inventory-2026-04-23.md content/inventory/inventory-raw.json
git commit -m "Phase 0 : rapport d'inventaire WP"
```

---

## Phase 1 — Extraction contenu Gutenberg

### Task 4 : Télécharger le contenu Gutenberg brut de chaque page

**Files:**
- Create: `wp-push/migrate/03-extract-gutenberg.js`
- Create: `content/gutenberg-client/<slug>.json` (×N)

- [ ] **Step 4.1 : Créer le script**

```javascript
// wp-push/migrate/03-extract-gutenberg.js
const fs = require('fs');
const path = require('path');
const { wpFetch } = require('./lib/wp-client');

async function main() {
  const raw = JSON.parse(fs.readFileSync(
    path.resolve(__dirname, '../../content/inventory/inventory-raw.json'), 'utf8'
  ));

  const outDir = path.resolve(__dirname, '../../content/gutenberg-client');
  fs.mkdirSync(outDir, { recursive: true });

  for (const p of raw.pages) {
    const full = await wpFetch(`/wp-json/wp/v2/pages/${p.id}?context=edit`);
    const record = {
      id: full.id,
      slug: full.slug,
      status: full.status,
      date: full.date,
      modified: full.modified,
      title: full.title?.raw || full.title?.rendered || '',
      content_raw: full.content?.raw || '',
      content_rendered: full.content?.rendered || '',
      excerpt: full.excerpt?.raw || '',
      meta: full.meta || {},
      parent: full.parent,
      menu_order: full.menu_order,
      template: full.template,
      yoast_head_json: full.yoast_head_json || null,
      rank_math_title: full.meta?.rank_math_title || null,
      rank_math_description: full.meta?.rank_math_description || null,
    };
    const file = path.join(outDir, `${full.slug || full.id}.json`);
    fs.writeFileSync(file, JSON.stringify(record, null, 2));
    console.log(`  ${full.slug} (${full.id}) → ${record.content_raw.length} octets`);
  }
  console.log(`✅ ${raw.pages.length} pages écrites dans ${outDir}`);
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 4.2 : Exécuter**

Run: `node wp-push/migrate/03-extract-gutenberg.js`
Expected: un fichier `.json` par page dans `content/gutenberg-client/`.

- [ ] **Step 4.3 : Commit**

```bash
git add wp-push/migrate/03-extract-gutenberg.js content/gutenberg-client/
git commit -m "Phase 1 : extraction contenu Gutenberg brut (pages WP)"
```

### Task 5 : Parser Gutenberg → texte plain (pour diff)

**Files:**
- Create: `wp-push/migrate/lib/gutenberg-parse.js`
- Create: `wp-push/migrate/04-gutenberg-to-text.js`

- [ ] **Step 5.1 : Créer le parser Gutenberg**

```javascript
// wp-push/migrate/lib/gutenberg-parse.js
// Parse un contenu Gutenberg raw → arbre de blocs simplifié
// Chaque bloc Gutenberg est sous la forme :
//   <!-- wp:<name> {json} -->
//   <contenu>
//   <!-- /wp:<name> -->

const BLOCK_OPEN = /<!--\s*wp:([a-z0-9/-]+)(\s+({[^]*?}))?\s*(\/)?-->/g;
const BLOCK_CLOSE = /<!--\s*\/wp:([a-z0-9/-]+)\s*-->/g;

function parseBlocks(html) {
  const blocks = [];
  let i = 0;
  const src = html;
  while (i < src.length) {
    BLOCK_OPEN.lastIndex = i;
    const m = BLOCK_OPEN.exec(src);
    if (!m) break;
    const [full, name, , attrsJson, selfClose] = m;
    const attrs = attrsJson ? safeJson(attrsJson) : {};
    if (selfClose === '/') {
      blocks.push({ name, attrs, inner: '', children: [] });
      i = m.index + full.length;
      continue;
    }
    // find matching close
    const closeRe = new RegExp(`<!--\\s*/wp:${name.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*-->`, 'g');
    closeRe.lastIndex = m.index + full.length;
    const close = closeRe.exec(src);
    if (!close) {
      blocks.push({ name, attrs, inner: src.slice(m.index + full.length), children: [] });
      break;
    }
    const inner = src.slice(m.index + full.length, close.index);
    blocks.push({ name, attrs, inner, children: parseBlocks(inner) });
    i = close.index + close[0].length;
  }
  return blocks;
}

function safeJson(s) { try { return JSON.parse(s); } catch { return {}; } }

function blocksToText(blocks) {
  // renvoie un tableau de { tag, text } en ordre doc
  const out = [];
  for (const b of blocks) {
    if (b.children.length) {
      out.push(...blocksToText(b.children));
    } else {
      const text = stripTags(b.inner).trim();
      if (!text) continue;
      const tag = inferTag(b.name, b.attrs);
      out.push({ block: b.name, tag, text });
    }
  }
  return out;
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function inferTag(name, attrs) {
  if (name === 'core/heading') return `h${attrs.level || 2}`;
  if (name === 'core/paragraph') return 'p';
  if (name === 'core/list') return 'ul';
  if (name === 'core/list-item') return 'li';
  if (name === 'core/quote') return 'blockquote';
  if (name === 'core/button' || name === 'core/buttons') return 'button';
  if (name === 'core/image') return 'img';
  return 'block';
}

module.exports = { parseBlocks, blocksToText, stripTags };
```

- [ ] **Step 5.2 : Créer le convertisseur "Gutenberg → texte"**

```javascript
// wp-push/migrate/04-gutenberg-to-text.js
const fs = require('fs');
const path = require('path');
const { parseBlocks, blocksToText } = require('./lib/gutenberg-parse');

const srcDir = path.resolve(__dirname, '../../content/gutenberg-client');
const outDir = path.resolve(__dirname, '../../content/gutenberg-text');
fs.mkdirSync(outDir, { recursive: true });

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.json'));
for (const f of files) {
  const rec = JSON.parse(fs.readFileSync(path.join(srcDir, f), 'utf8'));
  const blocks = parseBlocks(rec.content_raw || '');
  const text = blocksToText(blocks);
  fs.writeFileSync(
    path.join(outDir, f),
    JSON.stringify({ slug: rec.slug, title: rec.title, blocks: text }, null, 2)
  );
}
console.log(`✅ ${files.length} fichiers parsés → ${outDir}`);
```

- [ ] **Step 5.3 : Exécuter**

Run: `node wp-push/migrate/04-gutenberg-to-text.js`
Expected: même nombre de fichiers dans `content/gutenberg-text/`.

- [ ] **Step 5.4 : Commit**

```bash
git add wp-push/migrate/lib/gutenberg-parse.js wp-push/migrate/04-gutenberg-to-text.js content/gutenberg-text/
git commit -m "Phase 1 : parser Gutenberg brut vers texte structure"
```

### Task 6 : Parser le preview actuel → texte plain (pour diff)

**Files:**
- Create: `wp-push/migrate/lib/preview-parse.js`
- Create: `wp-push/migrate/05-preview-to-text.js`

- [ ] **Step 6.1 : Installer cheerio**

Run: `npm install cheerio`

- [ ] **Step 6.2 : Créer le parser preview**

```javascript
// wp-push/migrate/lib/preview-parse.js
const cheerio = require('cheerio');

function previewToText(html) {
  const $ = cheerio.load(html);
  const title = $('title').text().trim();
  const metaDesc = $('meta[name="description"]').attr('content') || '';
  const blocks = [];
  $('main *').each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    if (!['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'li', 'blockquote', 'button', 'a'].includes(tag)) return;
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (!text || text.length < 3) return;
    blocks.push({ tag, text });
  });
  return { title, metaDesc, blocks };
}

module.exports = { previewToText };
```

- [ ] **Step 6.3 : Créer le convertisseur preview → texte**

```javascript
// wp-push/migrate/05-preview-to-text.js
const fs = require('fs');
const path = require('path');
const { previewToText } = require('./lib/preview-parse');

const previewRoot = path.resolve(__dirname, '../../preview');
const outDir = path.resolve(__dirname, '../../content/preview-text');
fs.mkdirSync(outDir, { recursive: true });

function walk(dir, rel = '') {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full, rel ? `${rel}/${f}` : f);
    } else if (f.endsWith('.html')) {
      const relPath = rel ? `${rel}/${f}` : f;
      const slug = relPath === 'index.html' ? 'accueil' : relPath.replace(/\/index\.html$/, '').replace(/\.html$/, '').replace(/\//g, '--');
      const html = fs.readFileSync(full, 'utf8');
      const data = previewToText(html);
      fs.writeFileSync(
        path.join(outDir, `${slug}.json`),
        JSON.stringify({ slug, source_path: relPath, ...data }, null, 2)
      );
    }
  }
}

walk(path.join(previewRoot, 'pages'));
// racine
const idx = fs.readFileSync(path.join(previewRoot, 'index.html'), 'utf8');
fs.writeFileSync(
  path.join(outDir, 'accueil.json'),
  JSON.stringify({ slug: 'accueil', source_path: 'index.html', ...previewToText(idx) }, null, 2)
);

console.log(`✅ preview-text/ prêt`);
```

- [ ] **Step 6.4 : Exécuter**

Run: `node wp-push/migrate/05-preview-to-text.js`
Expected: 28 fichiers dans `content/preview-text/` (slugs = accueil, contact, mentions-legales, packs-shooting, packs-shooting--photo-domicile, etc.).

- [ ] **Step 6.5 : Commit**

```bash
git add package.json package-lock.json wp-push/migrate/lib/preview-parse.js wp-push/migrate/05-preview-to-text.js content/preview-text/
git commit -m "Phase 1 : parser preview HTML vers texte structure"
```

### Task 7 : Rapport de divergence Gutenberg ↔ preview

**Files:**
- Create: `wp-push/migrate/06-diff-report.js`
- Output: `docs/diff-gutenberg.md`

- [ ] **Step 7.1 : Créer le mapping slug WP ↔ slug preview**

Éditer en haut du script : table `SLUG_MAP` entre slug WP (`accueil`, `packs-shooting`, etc.) et slug preview (`accueil`, `packs-shooting`, `packs-shooting--photo-domicile`…).

```javascript
// wp-push/migrate/06-diff-report.js
const fs = require('fs');
const path = require('path');

// Map slug WP → slug preview (à ajuster selon inventaire réel)
// Par défaut : identité
const gutenbergDir = path.resolve(__dirname, '../../content/gutenberg-text');
const previewDir = path.resolve(__dirname, '../../content/preview-text');
const gutFiles = fs.readdirSync(gutenbergDir).filter(f => f.endsWith('.json'));
const previewFiles = fs.readdirSync(previewDir).filter(f => f.endsWith('.json'));

const previewBySlug = Object.fromEntries(
  previewFiles.map(f => {
    const data = JSON.parse(fs.readFileSync(path.join(previewDir, f), 'utf8'));
    return [data.slug, data];
  })
);

const lines = [];
lines.push('# Diff Gutenberg ↔ Preview');
lines.push('');
lines.push(`Généré : ${new Date().toISOString().slice(0, 10)}`);
lines.push('');

const matched = [];
const orphansGut = [];
const orphansPrev = new Set(Object.keys(previewBySlug));

for (const f of gutFiles) {
  const g = JSON.parse(fs.readFileSync(path.join(gutenbergDir, f), 'utf8'));
  const candidates = [g.slug, g.slug?.replace(/\//g, '--')];
  const previewData = candidates.map(s => previewBySlug[s]).find(Boolean);
  if (!previewData) {
    orphansGut.push(g.slug);
    continue;
  }
  orphansPrev.delete(previewData.slug);

  // Diff textes : ensemble de strings normalisées
  const gutTexts = (g.blocks || []).map(b => normalize(b.text));
  const prevTexts = (previewData.blocks || []).map(b => normalize(b.text));
  const inGutNotPrev = gutTexts.filter(t => !prevTexts.includes(t) && t.length > 15);
  const inPrevNotGut = prevTexts.filter(t => !gutTexts.includes(t) && t.length > 15);

  matched.push({
    slug: g.slug,
    preview_slug: previewData.slug,
    added_in_gutenberg: inGutNotPrev.length,
    removed_from_preview: inPrevNotGut.length,
    added_samples: inGutNotPrev.slice(0, 3),
    removed_samples: inPrevNotGut.slice(0, 3),
  });
}

function normalize(s) { return (s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }

lines.push('## Pages en correspondance');
lines.push('');
lines.push('| Slug WP | Slug preview | Ajouts Gutenberg | Disparus du preview |');
lines.push('|---|---|---|---|');
for (const m of matched) {
  lines.push(`| \`${m.slug}\` | \`${m.preview_slug}\` | ${m.added_in_gutenberg} | ${m.removed_from_preview} |`);
}

lines.push('');
lines.push('## Pages Gutenberg sans équivalent preview');
lines.push(orphansGut.map(s => `- \`${s}\``).join('\n') || '(aucune)');

lines.push('');
lines.push('## Pages preview sans équivalent Gutenberg');
lines.push([...orphansPrev].map(s => `- \`${s}\``).join('\n') || '(aucune)');

lines.push('');
lines.push('## Détail des changements (échantillons)');
for (const m of matched) {
  if (m.added_in_gutenberg === 0 && m.removed_from_preview === 0) continue;
  lines.push('');
  lines.push(`### \`${m.slug}\` ↔ \`${m.preview_slug}\``);
  if (m.added_samples.length) {
    lines.push('');
    lines.push('**Ajouts Gutenberg :**');
    for (const t of m.added_samples) lines.push(`  - ${t.slice(0, 200)}`);
  }
  if (m.removed_samples.length) {
    lines.push('');
    lines.push('**Disparus du preview :**');
    for (const t of m.removed_samples) lines.push(`  - ${t.slice(0, 200)}`);
  }
}

fs.writeFileSync(path.resolve(__dirname, '../../docs/diff-gutenberg.md'), lines.join('\n'));
console.log('✅ docs/diff-gutenberg.md écrit');
```

- [ ] **Step 7.2 : Exécuter**

Run: `node wp-push/migrate/06-diff-report.js`
Expected: `docs/diff-gutenberg.md` liste les pages avec diff + orphelines.

- [ ] **Step 7.3 : Lire et valider**

Ouvrir `docs/diff-gutenberg.md`. Si orphelins présents, décider cas par cas : slug renommé, page supprimée, nouvelle page Gutenberg ? Noter les décisions dans le fichier lui-même (bloc "Décisions" en bas).

- [ ] **Step 7.4 : Commit**

```bash
git add wp-push/migrate/06-diff-report.js docs/diff-gutenberg.md
git commit -m "Phase 1 : rapport de divergence Gutenberg vs preview"
```

---

## Phase 2 — Fusion contenu

### Task 8 : Stratégie de fusion et script

**Files:**
- Create: `wp-push/migrate/07-fuse-content.js`
- Output: `content/fused/<slug>.json`

Stratégie :
- La structure de sections (nombre et ordre) vient du **preview**.
- Pour chaque section, on cherche dans Gutenberg si un bloc équivalent existe (par heading titre ou par proximité sémantique).
- Si trouvé ET différent → on remplace le texte du preview par celui de Gutenberg.
- Si pas trouvé → on garde le preview tel quel.

- [ ] **Step 8.1 : Créer le script de fusion**

```javascript
// wp-push/migrate/07-fuse-content.js
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const previewRoot = path.resolve(__dirname, '../../preview');
const gutenbergTextDir = path.resolve(__dirname, '../../content/gutenberg-text');
const outDir = path.resolve(__dirname, '../../content/fused');
fs.mkdirSync(outDir, { recursive: true });

const gutFiles = fs.readdirSync(gutenbergTextDir).filter(f => f.endsWith('.json'));
const gutBySlug = {};
for (const f of gutFiles) {
  const g = JSON.parse(fs.readFileSync(path.join(gutenbergTextDir, f), 'utf8'));
  gutBySlug[g.slug] = g;
  if (g.slug !== g.slug.replace(/\//g, '--')) {
    gutBySlug[g.slug.replace(/\//g, '--')] = g;
  }
}

function findBestGutenbergReplacement(prevTag, prevText, gutBlocks) {
  // 1. Match exact sur tag + début de texte normalisé
  const prevNorm = prevText.toLowerCase().replace(/\s+/g, ' ').trim();
  for (const gb of gutBlocks) {
    if (gb.tag !== prevTag) continue;
    const gNorm = gb.text.toLowerCase().replace(/\s+/g, ' ').trim();
    if (gNorm === prevNorm) return null; // inchangé
    // Même heading slug-ified ?
    if (prevTag.startsWith('h') && gNorm.split(' ')[0] === prevNorm.split(' ')[0]) {
      return gb.text;
    }
  }
  // 2. Match par heading parent : on laisse le prev tel quel (sinon trop d'erreur)
  return null;
}

function fusePage(previewHtmlPath, gutBlocks) {
  const html = fs.readFileSync(previewHtmlPath, 'utf8');
  const $ = cheerio.load(html, { decodeEntities: false });
  let replacements = 0;

  $('main h1, main h2, main h3, main h4, main h5, main h6, main p, main li, main blockquote').each((_, el) => {
    const tag = el.tagName.toLowerCase();
    const text = $(el).text().replace(/\s+/g, ' ').trim();
    if (text.length < 10) return;
    const replacement = findBestGutenbergReplacement(tag, text, gutBlocks);
    if (replacement && replacement !== text) {
      $(el).text(replacement);
      replacements++;
    }
  });

  return { html: $.html(), replacements };
}

function walkPreview(dir, rel = '') {
  const results = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      results.push(...walkPreview(full, rel ? `${rel}/${f}` : f));
    } else if (f.endsWith('.html')) {
      results.push({ full, rel: rel ? `${rel}/${f}` : f });
    }
  }
  return results;
}

const pageFiles = walkPreview(path.join(previewRoot, 'pages'));
pageFiles.push({ full: path.join(previewRoot, 'index.html'), rel: 'index.html' });

const report = [];
for (const { full, rel } of pageFiles) {
  const slug = rel === 'index.html' ? 'accueil' : rel.replace(/\/index\.html$/, '').replace(/\.html$/, '').replace(/\//g, '--');
  const gut = gutBySlug[slug] || gutBySlug[slug.split('--')[0]];
  if (!gut) {
    report.push({ slug, status: 'no-gutenberg', replacements: 0 });
    continue;
  }
  const { html, replacements } = fusePage(full, gut.blocks || []);
  const outPath = path.join(outDir, `${slug}.html`);
  fs.writeFileSync(outPath, html);
  report.push({ slug, preview: rel, replacements, from_gutenberg: gut.slug });
}

fs.writeFileSync(
  path.join(outDir, '_report.json'),
  JSON.stringify(report, null, 2)
);

console.log(`✅ ${report.length} pages fusionnées. Remplacements : ${report.reduce((a, b) => a + (b.replacements || 0), 0)}`);
for (const r of report) {
  console.log(`  ${r.slug} : ${r.replacements || 0} remplacements ${r.status === 'no-gutenberg' ? '(pas de Gutenberg)' : ''}`);
}
```

- [ ] **Step 8.2 : Exécuter**

Run: `node wp-push/migrate/07-fuse-content.js`
Expected: fichiers `content/fused/<slug>.html` créés + `_report.json`. Compte total de remplacements loggé.

- [ ] **Step 8.3 : Validation manuelle de 2-3 pages**

Ouvrir dans le navigateur quelques pages fusionnées :
```bash
python3 -m http.server 8080 --directory content/fused
# Ouvrir http://localhost:8080/<slug>.html (note: les chemins relatifs CSS/img casseront — c'est normal)
```
Ou comparer côte à côte : `diff preview/pages/<slug>.html content/fused/<slug>.html`.

Si certaines sections sont "cassées" (texte remplacé là où il ne fallait pas), revenir sur la fonction `findBestGutenbergReplacement` pour affiner la règle, puis relancer.

- [ ] **Step 8.4 : Commit**

```bash
git add wp-push/migrate/07-fuse-content.js content/fused/
git commit -m "Phase 2 : fusion texte Gutenberg client dans preview"
```

### Task 9 : Mettre à jour le preview avec la version fusionnée (source de vérité)

- [ ] **Step 9.1 : Script de rebase preview ← fused**

```javascript
// wp-push/migrate/08-rebase-preview.js
const fs = require('fs');
const path = require('path');

const fusedDir = path.resolve(__dirname, '../../content/fused');
const previewRoot = path.resolve(__dirname, '../../preview');

const report = JSON.parse(fs.readFileSync(path.join(fusedDir, '_report.json'), 'utf8'));
let copied = 0;
for (const r of report) {
  if (!r.preview) continue;
  const src = path.join(fusedDir, `${r.slug}.html`);
  const dst = path.join(previewRoot, 'pages', r.preview);
  // Cas spécial : accueil
  const realDst = r.preview === 'index.html' ? path.join(previewRoot, 'index.html') : dst;
  if (!fs.existsSync(src)) continue;
  fs.copyFileSync(src, realDst);
  copied++;
}
console.log(`✅ ${copied} pages preview mises à jour depuis content/fused/`);
```

- [ ] **Step 9.2 : Exécuter**

Run: `node wp-push/migrate/08-rebase-preview.js`
Expected: pages HTML du preview mises à jour avec les textes fusionnés.

- [ ] **Step 9.3 : Servir et tester visuellement**

Run: `node scripts/04-serve-local.js`
Ouvrir `http://localhost:3000`, cliquer dans plusieurs pages, confirmer que le rendu est OK et que les textes client apparaissent.

- [ ] **Step 9.4 : Commit**

```bash
git add wp-push/migrate/08-rebase-preview.js preview/
git commit -m "Phase 2 : rebase preview avec textes fusionnés (source de verite Elementor)"
```

---

## Phase 3 — Fondations Elementor

### Task 10 : Vérifier / installer Hello Elementor

- [ ] **Step 10.1 : Vérifier le thème actif via `docs/inventory-2026-04-23.md`**

Si `active_theme` = `hello-elementor` → passer à Task 11.
Sinon : identifier l'écart. Si c'est un autre thème avec custom styles, il faudra basculer manuellement (pas d'endpoint REST fiable pour activer un thème). Documenter dans `docs/elementor-setup.md`.

- [ ] **Step 10.2 : Si bascule manuelle nécessaire — procédure**

Créer le doc `docs/elementor-setup.md` avec la procédure :
1. Se connecter à WP admin.
2. Apparence > Thèmes > Activer `Hello Elementor` (ou l'installer d'abord via "Ajouter").
3. Confirmer que le rendu public reste pris en charge par le plugin takeover (ça reste le cas jusqu'à Phase 5).
4. Commit le doc.

### Task 11 : Upload des médias manquants dans la médiathèque WP

**Files:**
- Create: `wp-push/migrate/09-upload-media.js`
- Output: `content/media-map.json`

- [ ] **Step 11.1 : Extraire la liste des images référencées par le preview**

```javascript
// wp-push/migrate/09a-list-preview-images.js
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const previewRoot = path.resolve(__dirname, '../../preview');
const used = new Set();

function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) walk(full);
    else if (f.endsWith('.html')) {
      const html = fs.readFileSync(full, 'utf8');
      const $ = cheerio.load(html);
      $('img').each((_, el) => {
        const src = $(el).attr('src');
        if (src) used.add(src);
      });
      // backgrounds via style
      const re = /url\(["']?([^"')]+)["']?\)/g;
      let m;
      while ((m = re.exec(html))) used.add(m[1]);
    }
  }
}
walk(previewRoot);

const list = [...used].sort();
fs.writeFileSync(
  path.resolve(__dirname, '../../content/media-used.json'),
  JSON.stringify(list, null, 2)
);
console.log(`✅ ${list.length} ressources média trouvées → content/media-used.json`);
```

Run: `node wp-push/migrate/09a-list-preview-images.js`
Expected: `content/media-used.json` liste toutes les URLs d'images.

- [ ] **Step 11.2 : Upload script vers WP**

```javascript
// wp-push/migrate/09-upload-media.js
const fs = require('fs');
const path = require('path');
const { SITE, AUTH } = require('./lib/wp-client');

const inventory = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../../content/inventory/inventory-raw.json'), 'utf8'
));
const used = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../../content/media-used.json'), 'utf8'
));

// Ceux déjà dans la médiathèque (par basename) sont considérés présents.
const existingByBasename = {};
for (const m of inventory.media) {
  const base = path.basename(m.source_url).toLowerCase();
  existingByBasename[base] = m;
}

const map = {}; // src URL → { media_id, wp_url }
const missing = [];

for (const src of used) {
  if (!src) continue;
  const base = path.basename(src.split('?')[0]).toLowerCase();
  if (existingByBasename[base]) {
    map[src] = {
      media_id: existingByBasename[base].id,
      wp_url: existingByBasename[base].source_url,
    };
  } else {
    missing.push(src);
  }
}

async function uploadOne(src) {
  // Résoudre l'URL : si src commence par /img/ → fichier local preview/img/...
  let buf, filename;
  if (src.startsWith('/')) {
    const local = path.resolve(__dirname, '../..', 'preview' + src);
    if (!fs.existsSync(local)) return null;
    buf = fs.readFileSync(local);
    filename = path.basename(local);
  } else if (src.startsWith('http')) {
    const res = await fetch(src);
    if (!res.ok) return null;
    buf = Buffer.from(await res.arrayBuffer());
    filename = path.basename(src.split('?')[0]);
  } else return null;

  const mime = filename.match(/\.(jpe?g|png|webp|gif|svg)$/i)
    ? `image/${filename.split('.').pop().toLowerCase().replace('jpg', 'jpeg')}`
    : 'application/octet-stream';

  const res = await fetch(SITE + '/wp-json/wp/v2/media', {
    method: 'POST',
    headers: {
      Authorization: AUTH,
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Type': mime,
    },
    body: buf,
  });
  if (!res.ok) {
    console.warn(`⚠️  échec upload ${src} → ${res.status}`);
    return null;
  }
  return res.json();
}

async function main() {
  for (const src of missing) {
    const uploaded = await uploadOne(src);
    if (uploaded) {
      map[src] = { media_id: uploaded.id, wp_url: uploaded.source_url };
      console.log(`  ✅ ${src} → ${uploaded.id}`);
    }
  }
  fs.writeFileSync(
    path.resolve(__dirname, '../../content/media-map.json'),
    JSON.stringify(map, null, 2)
  );
  console.log(`✅ Media map écrit (${Object.keys(map).length} entrées)`);
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 11.3 : Exécuter**

Run: `node wp-push/migrate/09-upload-media.js`
Expected: `content/media-map.json` avec une entrée par URL d'image utilisée.

- [ ] **Step 11.4 : Commit**

```bash
git add wp-push/migrate/09a-list-preview-images.js wp-push/migrate/09-upload-media.js content/media-used.json content/media-map.json
git commit -m "Phase 3 : upload medias manquants dans WP mediatheque"
```

### Task 12 : Extraire les design tokens du preview

**Files:**
- Create: `wp-push/migrate/10-extract-tokens.js`
- Output: `content/design-tokens.json`

- [ ] **Step 12.1 : Scan du CSS du preview**

```javascript
// wp-push/migrate/10-extract-tokens.js
const fs = require('fs');
const path = require('path');

const cssFile = path.resolve(__dirname, '../../preview/css/style.css');
const varsFile = path.resolve(__dirname, '../../preview/css/variables.css');
const tokens = { colors: {}, fonts: {}, sizes: {}, spacing: {}, radii: {}, shadows: {} };

for (const f of [varsFile, cssFile].filter(fs.existsSync)) {
  const css = fs.readFileSync(f, 'utf8');
  // CSS custom properties
  const re = /--([a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(css))) {
    const [name, value] = [m[1], m[2].trim()];
    if (/color|bg|accent/.test(name)) tokens.colors[name] = value;
    else if (/font|family/.test(name)) tokens.fonts[name] = value;
    else if (/size|scale/.test(name)) tokens.sizes[name] = value;
    else if (/space|gap|pad/.test(name)) tokens.spacing[name] = value;
    else if (/radius|round/.test(name)) tokens.radii[name] = value;
    else if (/shadow/.test(name)) tokens.shadows[name] = value;
  }
  // Fallback : récupérer les font-family uniques
  const ffRe = /font-family\s*:\s*([^;]+);/gi;
  let m2;
  while ((m2 = ffRe.exec(css))) tokens.fonts[`ff_${Object.keys(tokens.fonts).length}`] = m2[1].trim();
}

fs.writeFileSync(
  path.resolve(__dirname, '../../content/design-tokens.json'),
  JSON.stringify(tokens, null, 2)
);
console.log(`✅ content/design-tokens.json écrit`);
console.log(JSON.stringify(tokens, null, 2));
```

- [ ] **Step 12.2 : Exécuter et valider**

Run: `node wp-push/migrate/10-extract-tokens.js`
Expected: `content/design-tokens.json` contient palette (noir, gris, accent), familles de fonts.

- [ ] **Step 12.3 : Commit**

```bash
git add wp-push/migrate/10-extract-tokens.js content/design-tokens.json
git commit -m "Phase 3 : extraction design tokens du preview"
```

### Task 13 : Configurer Global Styles Elementor via API

Elementor stocke les Global Styles dans la base WP sous `option_name = elementor_active_kit` (ID du post kit) + les settings dans `_elementor_page_settings` du kit. On peut lire et écrire ce kit via l'API REST.

**Files:**
- Create: `wp-push/migrate/11-elementor-kit.js`

- [ ] **Step 13.1 : Récupérer l'ID du kit actif**

```javascript
// wp-push/migrate/11-elementor-kit.js
const fs = require('fs');
const path = require('path');
const { wpFetch } = require('./lib/wp-client');

async function main() {
  // Elementor Kit = custom post_type "elementor_library" avec template_type = "kit"
  // On le récupère via /wp-json/wp/v2/elementor_library?template_type=kit
  let kits = [];
  try {
    kits = await wpFetch('/wp-json/wp/v2/elementor_library?per_page=20');
  } catch (e) {
    console.error('⚠️  Impossible de lister elementor_library via REST. Le kit peut nécessiter un app access spécifique ou une extension CORS.');
    process.exit(2);
  }
  const kit = kits.find(k => k.meta?._elementor_template_type === 'kit') || kits[0];
  if (!kit) {
    console.error('❌ Aucun kit Elementor trouvé. Ouvrir Elementor > Site Settings pour en créer un.');
    process.exit(3);
  }
  console.log(`Kit actif : id=${kit.id}, slug=${kit.slug}`);
  fs.writeFileSync(
    path.resolve(__dirname, '../../content/elementor-kit.json'),
    JSON.stringify(kit, null, 2)
  );
}
main().catch(e => { console.error(e); process.exit(1); });
```

Run: `node wp-push/migrate/11-elementor-kit.js`
Expected: ID du kit affiché. Si erreur "Aucun kit Elementor trouvé" → ouvrir WP admin, activer Elementor, aller dans Elementor > Kit Library > sélectionner un kit par défaut (ou "Start from scratch"). Relancer.

- [ ] **Step 13.2 : Pousser les couleurs / fonts globaux via `_elementor_page_settings`**

```javascript
// wp-push/migrate/12-elementor-kit-push.js
const fs = require('fs');
const path = require('path');
const { SITE, AUTH, wpFetch } = require('./lib/wp-client');

const kit = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../content/elementor-kit.json'), 'utf8'));
const tokens = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../content/design-tokens.json'), 'utf8'));

// Palette Elementor = tableau [{ _id, title, color }]
function palette() {
  const entries = Object.entries(tokens.colors).slice(0, 8);
  return entries.map(([name, value], i) => ({
    _id: String(i + 1).padStart(8, '0'),
    title: name,
    color: value,
  }));
}

const system_colors = palette();

// Font primary : première famille détectée
const primaryFont = Object.values(tokens.fonts)[0]?.split(',')[0].trim().replace(/['"]/g, '') || 'Inter';

const settings = {
  system_colors,
  custom_colors: [],
  system_typography: [
    { _id: 'primary', title: 'Primary', typography_typography: 'custom', typography_font_family: primaryFont, typography_font_weight: '600' },
    { _id: 'secondary', title: 'Secondary', typography_typography: 'custom', typography_font_family: primaryFont, typography_font_weight: '400' },
    { _id: 'text', title: 'Text', typography_typography: 'custom', typography_font_family: primaryFont, typography_font_weight: '400' },
    { _id: 'accent', title: 'Accent', typography_typography: 'custom', typography_font_family: primaryFont, typography_font_weight: '700' },
  ],
};

async function main() {
  const body = {
    meta: {
      _elementor_page_settings: settings,
    },
  };
  const res = await fetch(`${SITE}/wp-json/wp/v2/elementor_library/${kit.id}`, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  console.log('Status', res.status);
  console.log((await res.text()).slice(0, 500));
}
main().catch(e => { console.error(e); process.exit(1); });
```

Run: `node wp-push/migrate/12-elementor-kit-push.js`
Expected: status 200. Visible dans WP admin > Elementor > Site Settings.

**Note** : si l'API refuse d'écrire dans `_elementor_page_settings` (certains setups filtrent les metas protégées), documenter et passer en manuel : créer les couleurs / typo via l'UI Elementor. Le reste du plan fonctionne quand même.

- [ ] **Step 13.3 : Commit**

```bash
git add wp-push/migrate/11-elementor-kit.js wp-push/migrate/12-elementor-kit-push.js content/elementor-kit.json
git commit -m "Phase 3 : configuration Global Styles Elementor (couleurs, typo)"
```

### Task 14 : Builder Elementor (librairie de helpers)

**Files:**
- Create: `wp-push/migrate/lib/elementor-builder.js`

- [ ] **Step 14.1 : Créer la librairie**

```javascript
// wp-push/migrate/lib/elementor-builder.js
const crypto = require('crypto');

function id() {
  return crypto.randomBytes(3).toString('hex') + Math.floor(Math.random() * 10);
}

function section(children = [], settings = {}) {
  return {
    id: id(),
    elType: 'section',
    settings,
    elements: children,
    isInner: false,
  };
}

function column(children = [], size = 100) {
  return {
    id: id(),
    elType: 'column',
    settings: { _column_size: size, _inline_size: null },
    elements: children,
    isInner: false,
  };
}

function widget(type, settings = {}) {
  return {
    id: id(),
    elType: 'widget',
    widgetType: type,
    settings,
    elements: [],
    isInner: false,
  };
}

// Helpers widget
const heading = (text, level = 'h2', align = 'center', color = null) =>
  widget('heading', { title: text, header_size: level, align, ...(color ? { title_color: color } : {}) });

const paragraph = (text, align = 'left') =>
  widget('text-editor', { editor: `<p>${text}</p>`, align });

const button = (text, href = '#', style = 'primary') =>
  widget('button', {
    text,
    link: { url: href, is_external: false, nofollow: false },
    button_type: style,
    align: 'center',
  });

const image = (url, alt = '', id_media = 0) =>
  widget('image', { image: { url, id: id_media, alt } });

const spacer = (height = 40) =>
  widget('spacer', { space: { size: height, unit: 'px' } });

const html = (code) =>
  widget('html', { html: code });

module.exports = { id, section, column, widget, heading, paragraph, button, image, spacer, html };
```

- [ ] **Step 14.2 : Test unitaire inline**

```javascript
// wp-push/migrate/lib/elementor-builder.test.js
const b = require('./elementor-builder');
const json = b.section([b.column([b.heading('Hello', 'h1'), b.paragraph('Body')])]);
console.assert(json.elType === 'section', 'section type');
console.assert(json.elements.length === 1, 'one column');
console.assert(json.elements[0].elements.length === 2, 'two widgets');
console.log('✅ builder OK');
```

Run: `node wp-push/migrate/lib/elementor-builder.test.js`
Expected: `✅ builder OK`.

- [ ] **Step 14.3 : Commit**

```bash
git add wp-push/migrate/lib/elementor-builder.js wp-push/migrate/lib/elementor-builder.test.js
git commit -m "Phase 3 : librairie builder Elementor (sections, colonnes, widgets)"
```

### Task 15 : Convertisseur HTML → Elementor

**Files:**
- Create: `wp-push/migrate/lib/html-to-elementor.js`

La stratégie : parser chaque `<section>` du preview et la traduire en une section Elementor. Pour chaque enfant (h1-h6, p, img, a.btn), on émet un widget correspondant.

- [ ] **Step 15.1 : Créer le convertisseur**

```javascript
// wp-push/migrate/lib/html-to-elementor.js
const cheerio = require('cheerio');
const b = require('./elementor-builder');

function convertPage(html, mediaMap = {}) {
  const $ = cheerio.load(html, { decodeEntities: false });
  const sections = [];
  $('main > section, main > .hrb-section').each((_, el) => {
    sections.push(convertSection($, el, mediaMap));
  });
  // Si pas de <section>, fallback: toute la main dans une section
  if (sections.length === 0) {
    sections.push(convertSection($, $('main')[0], mediaMap));
  }
  return sections;
}

function convertSection($, el, mediaMap) {
  const kids = [];
  $(el).find('h1, h2, h3, h4, h5, h6, p, img, a.hrb-btn, a.btn, ul, blockquote, .hrb-faq-item').each((_, node) => {
    const widget = nodeToWidget($, node, mediaMap);
    if (widget) kids.push(widget);
  });
  return b.section([b.column(kids)]);
}

function nodeToWidget($, node, mediaMap) {
  const tag = node.tagName?.toLowerCase();
  const $n = $(node);
  const text = $n.text().replace(/\s+/g, ' ').trim();
  if (!text && tag !== 'img') return null;

  if (/^h[1-6]$/.test(tag)) {
    return b.heading(text, tag, $n.css('text-align') || 'left');
  }
  if (tag === 'p') {
    return b.paragraph($n.html() || text);
  }
  if (tag === 'img') {
    const src = $n.attr('src');
    const alt = $n.attr('alt') || '';
    const map = mediaMap[src];
    return b.image(map?.wp_url || src, alt, map?.media_id || 0);
  }
  if (tag === 'a' && ($n.hasClass('hrb-btn') || $n.hasClass('btn'))) {
    return b.button(text, $n.attr('href') || '#');
  }
  if (tag === 'ul') {
    return b.widget('icon-list', {
      icon_list: $n.find('li').map((_, li) => ({ text: $(li).text().trim() })).get(),
    });
  }
  if (tag === 'blockquote') {
    return b.widget('blockquote', { blockquote_content: text });
  }
  // FAQ items → accordion (géré par caller)
  return null;
}

function extractFaqAsAccordion($, mainEl) {
  const items = [];
  $(mainEl).find('.hrb-faq-item, details').each((_, el) => {
    const q = $(el).find('summary, .hrb-faq-q').first().text().trim();
    const a = $(el).find('p, .hrb-faq-a').first().text().trim();
    if (q && a) items.push({ tab_title: q, tab_content: a });
  });
  if (!items.length) return null;
  return b.widget('accordion', { tabs: items });
}

module.exports = { convertPage, extractFaqAsAccordion };
```

- [ ] **Step 15.2 : Test sur la page accueil**

```javascript
// wp-push/migrate/lib/html-to-elementor.test.js
const fs = require('fs');
const path = require('path');
const { convertPage } = require('./html-to-elementor');

const html = fs.readFileSync(path.resolve(__dirname, '../../../preview/index.html'), 'utf8');
const mediaMap = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../../../content/media-map.json'), 'utf8'
));
const sections = convertPage(html, mediaMap);
console.log(`✅ accueil convertie en ${sections.length} sections.`);
console.log(`Première section contient ${sections[0].elements[0].elements.length} widgets.`);
// Dump
fs.writeFileSync(
  path.resolve(__dirname, '../../../content/test-accueil.elementor.json'),
  JSON.stringify(sections, null, 2)
);
```

Run: `node wp-push/migrate/lib/html-to-elementor.test.js`
Expected: dump de la structure Elementor générée dans `content/test-accueil.elementor.json`. Ouvrir et inspecter.

- [ ] **Step 15.3 : Commit**

```bash
git add wp-push/migrate/lib/html-to-elementor.js wp-push/migrate/lib/html-to-elementor.test.js content/test-accueil.elementor.json
git commit -m "Phase 3 : convertisseur HTML preview vers structure Elementor"
```

### Task 16 : Header / Footer / Popup via Theme Builder

Pour Theme Builder, il faut créer 3 posts `elementor_library` avec `template_type` = `header`, `footer`, `popup` et les conditions associées (appliquer à tout le site). Les conditions Theme Builder sont stockées dans l'option WP `elementor_pro_theme_builder_conditions`.

**Files:**
- Create: `wp-push/migrate/13-theme-builder.js`

- [ ] **Step 16.1 : Créer header**

```javascript
// wp-push/migrate/13-theme-builder.js
const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');
const { SITE, AUTH, wpFetch } = require('./lib/wp-client');
const b = require('./lib/elementor-builder');

const previewHtml = fs.readFileSync(path.resolve(__dirname, '../../preview/index.html'), 'utf8');
const $ = cheerio.load(previewHtml);

// --- HEADER ---
async function buildHeader() {
  const $header = $('header').first();
  const logoText = $header.find('.hrb-logo, .logo').first().text().trim() || 'Haroboz';
  const menuItems = [];
  $header.find('nav a').each((_, a) => {
    menuItems.push({ text: $(a).text().trim(), link: { url: $(a).attr('href'), is_external: false } });
  });
  const data = [b.section([
    b.column([b.heading(logoText, 'h1', 'left')], 30),
    b.column([b.widget('nav-menu', { menu: 0, layout: 'horizontal' })], 70),
  ], { layout: 'full_width', content_position: 'middle' })];
  return createLibraryItem('Header Haroboz', 'header', data, [{ type: 'include', name: 'general' }]);
}

async function buildFooter() {
  const $footer = $('footer').first();
  const cols = [];
  $footer.find('.hrb-footer-col, .footer-col, .col').each((_, c) => {
    const headingEl = $(c).find('h3, h4').first();
    const items = [];
    if (headingEl.length) items.push(b.heading(headingEl.text().trim(), 'h4', 'left'));
    $(c).find('a, p').each((_, link) => {
      const txt = $(link).text().trim();
      if (txt) items.push(b.paragraph(txt));
    });
    cols.push(b.column(items, 50));
  });
  const data = [b.section(cols.length ? cols : [b.column([b.paragraph('© Haroboz')])])];
  return createLibraryItem('Footer Haroboz', 'footer', data, [{ type: 'include', name: 'general' }]);
}

async function buildPopup() {
  const $popup = $('.hrb-popup, .popup').first();
  if (!$popup.length) return null;
  const data = [b.section([b.column([
    b.heading($popup.find('h1,h2,h3').first().text().trim() || 'Prendre rendez-vous', 'h2'),
    b.paragraph($popup.find('p').first().text().trim() || ''),
    b.button('Réserver', '#contact'),
  ])])];
  // Un popup n'a PAS de conditions Theme Builder classiques — on le déclenche par trigger action
  return createLibraryItem('Popup Rendez-vous', 'popup', data, []);
}

async function createLibraryItem(title, templateType, elementorData, conditions) {
  const meta = {
    _elementor_data: JSON.stringify(elementorData),
    _elementor_edit_mode: 'builder',
    _elementor_template_type: templateType,
    _elementor_version: '3.20.0',
  };
  const body = { title, status: 'publish', template: '', meta };
  const res = await fetch(`${SITE}/wp-json/wp/v2/elementor_library`, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  console.log(`  ${templateType} → id=${json.id}, status ${res.status}`);
  if (conditions.length) {
    // Appliquer les conditions via l'option (nécessite un endpoint custom ou Pro) — fallback manuel
    console.log(`    ⚠️  Conditions à appliquer manuellement dans WP admin > Templates > Theme Builder pour ${templateType} (${json.id})`);
  }
  return json.id;
}

async function main() {
  console.log('Création header…');
  const headerId = await buildHeader();
  console.log('Création footer…');
  const footerId = await buildFooter();
  console.log('Création popup…');
  const popupId = await buildPopup();
  const out = { header: headerId, footer: footerId, popup: popupId };
  fs.writeFileSync(
    path.resolve(__dirname, '../../content/theme-builder.json'),
    JSON.stringify(out, null, 2)
  );
  console.log('✅ Theme Builder :', out);
  console.log('👉 Finaliser manuellement : WP admin > Templates > Theme Builder → assigner "Entire Site" aux header/footer créés.');
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 16.2 : Exécuter**

Run: `node wp-push/migrate/13-theme-builder.js`
Expected: 3 IDs créés. Aller dans WP admin > Elementor > Templates > Theme Builder, confirmer que Header Haroboz, Footer Haroboz, Popup Rendez-vous existent. Assigner conditions "Entire Site" au header et footer.

- [ ] **Step 16.3 : Commit**

```bash
git add wp-push/migrate/13-theme-builder.js content/theme-builder.json
git commit -m "Phase 3 : creation header/footer/popup via Theme Builder"
```

---

## Phase 4 — Build des 28 pages en Elementor

### Task 17 : Script de création d'une page Elementor

**Files:**
- Create: `wp-push/migrate/14-build-page.js`

- [ ] **Step 17.1 : Script de build unitaire**

```javascript
// wp-push/migrate/14-build-page.js
// Usage : node wp-push/migrate/14-build-page.js <slug-preview>
// ex : node wp-push/migrate/14-build-page.js accueil

const fs = require('fs');
const path = require('path');
const { SITE, AUTH } = require('./lib/wp-client');
const { convertPage } = require('./lib/html-to-elementor');

async function main() {
  const slug = process.argv[2];
  if (!slug) { console.error('Usage: build-page.js <slug>'); process.exit(2); }

  // Charger mapping slug preview → slug WP
  const invRaw = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../content/inventory/inventory-raw.json'), 'utf8'));
  const pageBySlug = Object.fromEntries(invRaw.pages.map(p => [p.slug, p]));

  // Fichier preview correspondant
  const previewPath = slug === 'accueil'
    ? path.resolve(__dirname, '../../preview/index.html')
    : path.resolve(__dirname, '../../preview/pages', `${slug.replace(/--/g, '/')}.html`);
  const dirIndexPath = slug === 'accueil'
    ? previewPath
    : path.resolve(__dirname, '../../preview/pages', slug.replace(/--/g, '/'), 'index.html');

  const htmlPath = fs.existsSync(previewPath) ? previewPath : (fs.existsSync(dirIndexPath) ? dirIndexPath : null);
  if (!htmlPath) { console.error(`Preview introuvable pour ${slug}`); process.exit(3); }

  const html = fs.readFileSync(htmlPath, 'utf8');
  const mediaMap = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../content/media-map.json'), 'utf8'));
  const elementorData = convertPage(html, mediaMap);

  // Retrouver le title / meta
  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const title = $('title').text().trim();
  const description = $('meta[name="description"]').attr('content') || '';

  // Slug WP = même que slug preview (conversion -- → /)
  const wpSlug = slug.replace(/--/g, '-'); // simplifié ; ajuster si parent/child
  const existing = pageBySlug[wpSlug] || pageBySlug[slug];

  const meta = {
    _elementor_data: JSON.stringify(elementorData),
    _elementor_edit_mode: 'builder',
    _elementor_template_type: 'wp-page',
    _elementor_version: '3.20.0',
    _elementor_page_settings: {},
    _wp_page_template: 'elementor_header_footer',
  };

  // Ajouter meta SEO si plugin détecté
  const seoPlugin = (process.env.SEO_PLUGIN || '').toLowerCase();
  if (seoPlugin.includes('rank')) {
    meta.rank_math_title = title;
    meta.rank_math_description = description;
  } else if (seoPlugin.includes('yoast')) {
    meta._yoast_wpseo_title = title;
    meta._yoast_wpseo_metadesc = description;
  }

  const body = {
    title,
    status: 'draft', // ← DRAFT tant que Phase 5 non validée
    template: 'elementor_header_footer',
    meta,
    slug: wpSlug,
  };

  let res;
  if (existing) {
    res = await fetch(`${SITE}/wp-json/wp/v2/pages/${existing.id}`, {
      method: 'POST',
      headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } else {
    res = await fetch(`${SITE}/wp-json/wp/v2/pages`, {
      method: 'POST',
      headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }
  const json = await res.json();
  console.log(`${res.ok ? '✅' : '❌'} ${slug} → page WP ${json.id} (${json.status})`);
  if (!res.ok) console.log('Error:', JSON.stringify(json).slice(0, 500));
  return json;
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 17.2 : Test sur "accueil"**

Run: `node wp-push/migrate/14-build-page.js accueil`
Expected: `✅ accueil → page WP <id> (draft)`.

- [ ] **Step 17.3 : Ouvrir la page dans WP admin > Pages > accueil > Modifier avec Elementor**

Confirmer visuellement :
- La structure en sections apparaît.
- Les headings et paragraphes sont bien là.
- Les boutons sont présents.
- L'image hero est correctement référencée (pas de broken link).

Si le rendu est trop éloigné du preview, ajuster le convertisseur (`lib/html-to-elementor.js`) — pas le builder. Relancer.

- [ ] **Step 17.4 : Commit**

```bash
git add wp-push/migrate/14-build-page.js
git commit -m "Phase 4 : script de build d'une page Elementor depuis preview fusionne"
```

### Task 18 : Bulk build de toutes les pages (draft)

**Files:**
- Create: `wp-push/migrate/15-build-all.js`

- [ ] **Step 18.1 : Script bulk**

```javascript
// wp-push/migrate/15-build-all.js
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Liste des slugs preview (hiérarchie conservée sous -- )
const SLUGS = [
  'accueil',
  'contact',
  'mentions-legales',
  'a-propos',
  'a-propos--luc-desbois-photographe',
  'boutique',
  'boutique--carte-cadeau',
  'boutique--galerie-privee-client',
  'boutique--tirages-art-edition-limitee',
  'packs-shooting',
  'packs-shooting--photo-domicile',
  'packs-shooting--portrait-studio',
  'packs-shooting--shooting-duo-couple',
  'packs-shooting--shooting-exterieur',
  'photographe',
  'photographe--photographe-marseille',
  'photographe--photographe-nice',
  'photographe--photographe-paris',
  'photographe--photographe-toulon',
  'portfolio',
  'portfolio--galerie-couples',
  'portfolio--galerie-portraits-hommes',
  'portfolio--temoignages-clients',
  'votre-experience',
  'votre-experience--book-modele-professionnel',
  'votre-experience--cadeau-couple-original',
  'votre-experience--premier-shooting-nu',
  'votre-experience--retrouver-confiance-corps',
];

const report = [];
for (const slug of SLUGS) {
  try {
    const out = execSync(`node ${path.join(__dirname, '14-build-page.js')} ${slug}`, { encoding: 'utf8' });
    process.stdout.write(out);
    report.push({ slug, status: 'ok', log: out.trim() });
  } catch (e) {
    console.error(`❌ ${slug}`, e.message);
    report.push({ slug, status: 'error', log: e.message });
  }
}
fs.writeFileSync(path.resolve(__dirname, '../../content/build-report.json'), JSON.stringify(report, null, 2));
console.log(`\nBuild terminé : ${report.filter(r => r.status === 'ok').length}/${report.length} succès.`);
```

- [ ] **Step 18.2 : Exécuter**

Run: `node wp-push/migrate/15-build-all.js`
Expected: 28 lignes ✅. Si erreurs, examiner `content/build-report.json`.

- [ ] **Step 18.3 : Vérifier dans WP admin**

WP admin > Pages : 28 pages en statut "brouillon", éditables via Elementor.

- [ ] **Step 18.4 : Tour de validation visuelle (draft preview)**

Pour chaque slug, WP admin > Pages > cliquer "Aperçu" (draft preview) pour voir le rendu Elementor + header/footer/popup globaux.

Si les ~5 pages les plus importantes (accueil, packs, photographe, contact, votre-experience) ont un rendu conforme au preview, on poursuit. Sinon, itérer sur `lib/html-to-elementor.js` et relancer le build (les pages existantes sont mises à jour, pas dupliquées).

- [ ] **Step 18.5 : Commit**

```bash
git add wp-push/migrate/15-build-all.js content/build-report.json
git commit -m "Phase 4 : build des 28 pages en Elementor (statut draft)"
```

### Task 19 : Raffinement par cluster

Si des sections complexes (hero, timeline "Votre expérience", grille de témoignages, cartes pack) demandent un rendu particulier, on crée des **converters spécialisés** dans `lib/converters/` appelés par `html-to-elementor.js` selon la classe CSS de la section.

- [ ] **Step 19.1 : Identifier les sections qui ne rendent pas bien**

Lister dans `docs/rendering-issues.md` les sections qui pègent, par page.

- [ ] **Step 19.2 : Pour chaque type de section problématique, créer un converter dédié**

Exemple : timeline `.hrb-timeline` → widget Elementor `icon-list` verticalement alignée, ou 3 colonnes avec widgets `icon-box`.

```javascript
// wp-push/migrate/lib/converters/timeline.js
const b = require('../elementor-builder');
module.exports = function convertTimeline($, el) {
  const items = [];
  $(el).find('.hrb-timeline-item, li').each((_, it) => {
    const title = $(it).find('h3, h4').first().text().trim();
    const desc = $(it).find('p').first().text().trim();
    items.push(b.widget('icon-box', {
      title_text: title,
      description_text: desc,
      selected_icon: { value: 'fas fa-check', library: 'fa-solid' },
    }));
  });
  return b.section([b.column(items)]);
};
```

Puis dans `html-to-elementor.js`, détecter `.hrb-timeline` et déléguer.

- [ ] **Step 19.3 : Relancer `build-all` et re-vérifier**

Run: `node wp-push/migrate/15-build-all.js`

Répéter jusqu'à ce que les pages rendent ~95 % fidèle au preview.

- [ ] **Step 19.4 : Commit (par batch de converters)**

```bash
git add wp-push/migrate/lib/converters/
git commit -m "Phase 4 : converters specialises pour sections complexes"
```

---

## Phase 5 — Basculement

### Task 20 : Préparer le checklist pré-basculement

- [ ] **Step 20.1 : Créer la checklist**

Fichier : `docs/checklist-basculement.md`

```markdown
# Checklist pré-basculement Elementor

- [ ] 28 pages Elementor en draft, toutes validées visuellement
- [ ] Header / Footer / Popup assignés à "Entire Site" dans Theme Builder
- [ ] Global Styles configurés (palette + typo)
- [ ] Médiathèque contient toutes les images du preview
- [ ] Meta SEO (title, description) présentes sur chaque page
- [ ] Plugin `haroboz-deploy` identifié et prêt à désactiver
- [ ] Backup BDD WP fait (via plugin ou phpMyAdmin)
- [ ] Lien de rollback documenté (réactiver le plugin haroboz-deploy en 1 clic)
```

Run : vérifier chaque case.

### Task 21 : POINT DE CONFIRMATION UTILISATEUR

> **STOP AGENT** : Cette tâche demande une action publique visible. Avant toute écriture :
>
> 1. Présenter à l'utilisateur un résumé : nombre de pages en draft, écarts résiduels avec le preview, checklist complète.
> 2. **Attendre confirmation explicite** : "OK, bascule" / "Attends, je relis d'abord les pages".
> 3. Si confirmation, poursuivre Task 22.
> 4. Si pas de confirmation, s'arrêter ici et laisser l'utilisateur relire les pages draft.

### Task 22 : Désactiver le plugin takeover

**Files:**
- Create: `wp-push/migrate/16-disable-takeover.js`

- [ ] **Step 22.1 : Script de désactivation**

```javascript
// wp-push/migrate/16-disable-takeover.js
const { SITE, AUTH, wpFetch } = require('./lib/wp-client');

async function main() {
  const plugins = await wpFetch('/wp-json/wp/v2/plugins');
  const takeover = plugins.find(p => (p.plugin || '').includes('haroboz-deploy') || (p.name || '').toLowerCase().includes('haroboz'));
  if (!takeover) { console.log('ℹ️  Plugin takeover non trouvé.'); return; }
  console.log(`Désactivation de ${takeover.plugin}…`);
  const res = await fetch(`${SITE}/wp-json/wp/v2/plugins/${encodeURIComponent(takeover.plugin)}`, {
    method: 'POST',
    headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'inactive' }),
  });
  console.log(`Status: ${res.status}`);
  console.log(await res.text());
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 22.2 : Exécuter**

Run: `node wp-push/migrate/16-disable-takeover.js`
Expected: status 200, plugin inactif.

### Task 23 : Publier les pages Elementor

**Files:**
- Create: `wp-push/migrate/17-publish-pages.js`

- [ ] **Step 23.1 : Script de publication**

```javascript
// wp-push/migrate/17-publish-pages.js
const { SITE, AUTH, wpFetchAll } = require('./lib/wp-client');

async function main() {
  const pages = await wpFetchAll('/wp-json/wp/v2/pages', { status: 'draft' });
  console.log(`${pages.length} pages draft à publier…`);
  for (const p of pages) {
    if (!p.meta?._elementor_edit_mode) continue; // ne publier QUE les pages Elementor qu'on a créées
    const res = await fetch(`${SITE}/wp-json/wp/v2/pages/${p.id}`, {
      method: 'POST',
      headers: { Authorization: AUTH, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'publish' }),
    });
    console.log(`  ${p.slug} → ${res.status}`);
  }
}
main().catch(e => { console.error(e); process.exit(1); });
```

- [ ] **Step 23.2 : Exécuter**

Run: `node wp-push/migrate/17-publish-pages.js`
Expected: ~28 pages passées en `publish`.

### Task 24 : Vérifier le rendu public immédiatement

- [ ] **Step 24.1 : Tour rapide**

Ouvrir dans un navigateur privé : `https://haroboz.com/`, `/packs-shooting/`, `/contact/`, `/votre-experience/`.
- Header / footer / popup visibles.
- Pas d'erreur 404.
- Contenu correspond au preview/fused.

- [ ] **Step 24.2 : Si casse majeure**

Rollback immédiat :
- WP admin > Extensions > réactiver `Haroboz Static Site`.
- Debug à chaud, re-désactiver quand c'est corrigé.

- [ ] **Step 24.3 : Commit**

```bash
git add wp-push/migrate/16-disable-takeover.js wp-push/migrate/17-publish-pages.js docs/checklist-basculement.md
git commit -m "Phase 5 : bascule Elementor (desactivation plugin + publication pages)"
```

---

## Phase 6 — Recette et remise

### Task 25 : Recette qualité complète

- [ ] **Step 25.1 : Checklist de test**

Fichier `docs/recette-elementor.md` :

```markdown
# Recette Elementor Haroboz — <date>

Pour chaque page :
- [ ] Desktop 1440px — rendu conforme au preview
- [ ] Mobile 375px — rendu responsive, pas de débord horizontal
- [ ] Tablet 768px — mise en page correcte
- [ ] Menu mobile fonctionnel
- [ ] Popup rendez-vous déclenchable + fermable
- [ ] FAQ dépliable
- [ ] Formulaire contact : soumission OK
- [ ] Liens internes (maillage) OK
- [ ] `<title>` et meta description correctes
- [ ] Lighthouse : perf > 70, SEO > 90
```

Parcourir chaque page.

### Task 26 : Audit Lighthouse des pages clés

- [ ] **Step 26.1 : Lancer Lighthouse**

```bash
npx lighthouse https://haroboz.com/ --output=json --output-path=./reports/lighthouse-accueil.json --only-categories=performance,seo,accessibility --quiet
npx lighthouse https://haroboz.com/packs-shooting/ --output=json --output-path=./reports/lighthouse-packs.json --only-categories=performance,seo,accessibility --quiet
npx lighthouse https://haroboz.com/contact/ --output=json --output-path=./reports/lighthouse-contact.json --only-categories=performance,seo,accessibility --quiet
```

Noter les scores dans `docs/recette-elementor.md`.

### Task 27 : Guide édition client

- [ ] **Step 27.1 : Créer le guide**

Fichier `docs/guide-elementor-client.md` :

```markdown
# Guide d'édition Haroboz — Elementor

## Comment modifier un texte
1. WP admin > Pages > cliquer la page.
2. Cliquer "Modifier avec Elementor".
3. Cliquer sur le texte à changer → panneau gauche.
4. Éditer. Cliquer "Publier" (en bas).

## Comment remplacer une image
1. Idem jusqu'à l'éditeur Elementor.
2. Cliquer sur l'image → panneau gauche > Choisir une image.
3. Téléverser ou sélectionner dans la médiathèque.
4. Publier.

## Comment modifier le header (menu)
1. WP admin > Templates > Theme Builder > Header Haroboz > Modifier avec Elementor.

## Comment ne pas casser une page
- Ne pas supprimer les sections sans savoir.
- Éviter de changer "taille de colonne" sans vérifier le mobile.
- En cas de doute : Ctrl+Z, ou "Historique" en haut à droite.

## En cas de pépin
Contacter Rémi (administration@remi-oravec.fr).
```

- [ ] **Step 27.2 : Commit**

```bash
git add docs/recette-elementor.md docs/guide-elementor-client.md reports/
git commit -m "Phase 6 : recette + guide edition client"
```

### Task 28 : Clôture

- [ ] **Step 28.1 : Mettre à jour le README**

Ajouter dans `README.md` une section "État projet — 2026-04-23" : migration Elementor complète, plugin takeover désactivé, voir `docs/guide-elementor-client.md`.

- [ ] **Step 28.2 : Commit final**

```bash
git add README.md
git commit -m "Cloture refonte Elementor : guide client + README"
```

---

## Annexes

### Rollback d'urgence
Si le site casse après Phase 5 :
1. WP admin > Extensions > réactiver `Haroboz Static Site`.
2. WP admin > Pages > passer les 28 pages Elementor en "brouillon".
3. Le site redevient servi par le plugin takeover.

### Slug map (WP ↔ preview)
- Si la hiérarchie des pages WP est plate (pas de parent), les slugs preview comme `packs-shooting/photo-domicile` deviendront des slugs WP simples comme `photo-domicile`. Le script `14-build-page.js` fait une conversion `--` → `-`. Vérifier en Phase 0 si le client a créé des pages en enfant ou pas, et adapter la logique.
