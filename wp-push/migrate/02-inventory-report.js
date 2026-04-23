// wp-push/migrate/02-inventory-report.js
// Readable inventory report from inventory-raw.json.
const fs = require('fs');
const path = require('path');

const raw = JSON.parse(fs.readFileSync(
  path.resolve(__dirname, '../../content/inventory/inventory-raw.json'), 'utf8'
));

// Last takeover push = 2026-03-30 (from memory)
const REF_DATE = '2026-03-30T00:00:00';
const modified = raw.pages.filter(p => p.modified > REF_DATE);
const unmodified = raw.pages.filter(p => p.modified <= REF_DATE);

const L = [];
L.push(`# Inventaire WP haroboz.com — ${raw.scanned_at.slice(0, 10)}`);
L.push('');
L.push(`**Site :** ${raw.site_url}  `);
L.push(`**Build plugin Haroboz :** \`${raw.ping.build}\`  `);
L.push(`**WP :** ${raw.ping.wp}  `);
L.push(`**Thème actif :** \`${raw.active_theme.stylesheet}\` (${raw.active_theme.name} ${raw.active_theme.version})  `);
L.push(`**Pages totales :** ${raw.pages.length}  `);
L.push(`**Médias :** ${raw.media_count}  `);
L.push(`**Plugins actifs :** ${raw.plugins.filter(p => p.active).length} / ${raw.plugins.length}`);
L.push('');

L.push('## Plugins actifs');
L.push('');
L.push('| Plugin | Nom | Version |');
L.push('|---|---|---|');
for (const pl of raw.plugins.filter(p => p.active)) {
  L.push(`| \`${pl.plugin}\` | ${pl.name} | ${pl.version} |`);
}
L.push('');

L.push('## Plugins clés pour la migration');
L.push('');
const keyPlugins = [
  ['Elementor', 'elementor/'],
  ['Elementor Pro', 'elementor-pro'],
  ['Hello Elementor', 'hello-elementor'],
  ['Yoast SEO', 'wordpress-seo'],
  ['Haroboz Static Site', 'haroboz-deploy'],
  ['LiteSpeed Cache', 'litespeed-cache'],
];
for (const [label, needle] of keyPlugins) {
  const found = raw.plugins.find(p => p.plugin.includes(needle));
  if (found) {
    L.push(`- **${label}** : \`${found.plugin}\` (${found.version}) — ${found.active ? '✅ actif' : '❌ inactif'}`);
  } else {
    L.push(`- **${label}** : non installé`);
  }
}
L.push('');

L.push(`## Pages modifiées après le push takeover (${REF_DATE.slice(0, 10)})`);
L.push('');
L.push(`**${modified.length} page(s)** modifiée(s) récemment par le client :`);
L.push('');
L.push('| ID | Slug | Title | Modified | Longueur (octets) |');
L.push('|---|---|---|---|---|');
for (const p of modified) {
  L.push(`| ${p.id} | \`${p.slug}\` | ${(p.title || '').slice(0, 60)} | ${p.modified.slice(0, 10)} | ${p.content_length} |`);
}
L.push('');

L.push(`## Pages non modifiées depuis`);
L.push('');
L.push(`**${unmodified.length} page(s)** :`);
L.push('');
if (unmodified.length) {
  L.push('| ID | Slug | Title | Modified |');
  L.push('|---|---|---|---|');
  for (const p of unmodified) {
    L.push(`| ${p.id} | \`${p.slug}\` | ${(p.title || '').slice(0, 60)} | ${p.modified.slice(0, 10)} |`);
  }
} else {
  L.push('_(aucune — toutes les pages ont été modifiées)_');
}
L.push('');

L.push('## Correspondance avec le preview local');
L.push('');
const previewSlugs = new Set();
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (f.endsWith('.html')) {
      const rel = path.relative(path.resolve(__dirname, '../../preview'), full).replace(/\\/g, '/');
      const slug = rel === 'index.html' ? 'accueil'
                 : rel.replace(/\/index\.html$/, '').replace(/\.html$/, '').replace(/^pages\//, '');
      previewSlugs.add(slug);
    }
  }
}
walk(path.resolve(__dirname, '../../preview'));

const previewSlugSet = [...previewSlugs];
const wpSlugs = raw.pages.map(p => p.slug);
const pvNorm = new Set(previewSlugSet.map(s => s.split('/').pop()));
const wpNorm = new Set(wpSlugs);
const onlyInPreview = [...pvNorm].filter(s => !wpNorm.has(s));
const onlyInWP = [...wpNorm].filter(s => !pvNorm.has(s));

L.push(`- **Pages preview (HTML local)** : ${previewSlugSet.length}`);
L.push(`- **Pages WP** : ${wpSlugs.length}`);
L.push(`- **En commun (last segment)** : ${[...pvNorm].filter(s => wpNorm.has(s)).length}`);
L.push(`- **Seulement dans preview** : ${onlyInPreview.length}${onlyInPreview.length ? ' → ' + onlyInPreview.map(s => `\`${s}\``).join(', ') : ''}`);
L.push(`- **Seulement dans WP** : ${onlyInWP.length}${onlyInWP.length ? ' → ' + onlyInWP.map(s => `\`${s}\``).join(', ') : ''}`);
L.push('');

L.push('## Namespaces REST disponibles');
L.push('');
for (const ns of raw.rest_namespaces) L.push(`- \`${ns}\``);

fs.writeFileSync(
  path.resolve(__dirname, '../../docs/inventory-2026-04-23.md'),
  L.join('\n')
);
console.log('✅ docs/inventory-2026-04-23.md regenerated');
