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

if (!raw.auth_working) {
  lines.push('## ⚠️ Anomalie auth Basic REST API');
  lines.push('');
  lines.push('**Problème :** LiteSpeed/Hostinger stripe le header `Authorization` sur les requêtes HTTP GET avant que PHP le reçoive.');
  lines.push('**Impact :** Impossible d\'accéder à `context=edit`, `status=any`, `/wp/v2/plugins`, `/wp/v2/themes` via l\'API REST.');
  lines.push('**Fix à déployer :** Ajouter dans `haroboz-deploy.php` (déjà fait localement) :');
  lines.push('```php');
  lines.push('if (!isset($_SERVER[\'HTTP_AUTHORIZATION\']) && isset($_SERVER[\'REDIRECT_HTTP_AUTHORIZATION\'])) {');
  lines.push('    $_SERVER[\'HTTP_AUTHORIZATION\'] = $_SERVER[\'REDIRECT_HTTP_AUTHORIZATION\'];');
  lines.push('}');
  lines.push('```');
  lines.push('**Action requise :** Uploader `wp-push/haroboz-deploy.php` (avec le fix) via hPanel Hostinger > Gestionnaire de fichiers > `/wp-content/plugins/haroboz-deploy/haroboz-deploy.php`');
  lines.push('');
}

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
if (raw.plugins.length > 0) {
  lines.push('| Nom | Version | Statut |');
  lines.push('|---|---|---|');
  for (const pl of raw.plugins.filter(p => p.status === 'active')) {
    lines.push(`| ${pl.name} | ${pl.version} | ${pl.status} |`);
  }
} else {
  lines.push('_Plugins non récupérables via REST (auth requise). Plugins inférés depuis les namespaces REST ci-dessous._');
}
lines.push('');

lines.push('## Plugins clés à vérifier');
lines.push('');
const wanted = ['elementor', 'elementor-pro', 'hello-elementor', 'haroboz', 'yoast', 'rank-math', 'seo'];
if (raw.plugins.length > 0) {
  for (const w of wanted) {
    const found = raw.plugins.filter(p => (p.plugin || '').toLowerCase().includes(w) || (p.name || '').toLowerCase().includes(w));
    for (const f of found) {
      lines.push(`- \`${f.plugin}\` : ${f.name} ${f.version} → **${f.status}**`);
    }
  }
} else {
  // Déduction depuis namespaces
  const ns = raw.plugins_from_namespaces || raw.namespaces || [];
  const pluginMap = {
    'elementor/v1': 'Elementor (actif)',
    'elementor-pro/v1': 'Elementor Pro (actif)',
    'elementor-hello-elementor/v1': 'Hello Elementor theme (actif)',
    'yoast/v1': 'Yoast SEO (actif)',
    'ithemes-security/v1': 'iThemes Security / Solid Security (actif)',
    'litespeed/v1': 'LiteSpeed Cache (actif)',
    'google-site-kit/v1': 'Google Site Kit (actif)',
    'jwt-auth/v1': 'JWT Authentication (actif)',
    'elementor-ai/v1': 'Elementor AI (actif)',
    'kb-mailerlite/v1': 'Kadence Blocks MailerLite (actif)',
    'kbp/v1': 'Kadence Blocks Pro (actif)',
  };
  for (const [key, label] of Object.entries(pluginMap)) {
    if (ns.includes(key)) {
      lines.push(`- **${label}** (déduit depuis namespace \`${key}\`)`);
    }
  }
}
lines.push('');

lines.push('## Namespaces REST disponibles');
lines.push('');
const ns = raw.plugins_from_namespaces || raw.namespaces || [];
for (const n of ns) {
  lines.push(`- \`${n}\``);
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
