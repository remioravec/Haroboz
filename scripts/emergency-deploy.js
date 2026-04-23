#!/usr/bin/env node
/**
 * Emergency static build from content/fused/*.html for off-Hostinger hosting.
 * Output: /workspaces/Haroboz/emergency-build/
 *
 * Each fused file is wrapped with Tailwind CDN + fonts + Lucide, matching
 * the original preview's chrome. Images reference haroboz.com's still-serving
 * CDN (LiteSpeed serves /wp-content/uploads/* statically even with plugins broken).
 */
const fs = require('fs');
const path = require('path');

const FUSED = path.join(__dirname, '..', 'content', 'fused');
const OUT = path.join(__dirname, '..', 'emergency-build');

if (!fs.existsSync(FUSED)) {
  console.error(`Missing ${FUSED}`);
  process.exit(1);
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

const CHROME = (title, meta) => `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title}</title>
<meta name="description" content="${meta}">
<link rel="icon" href="https://haroboz.com/wp-content/uploads/2025/10/cropped-Group-1959.webp">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config={theme:{extend:{colors:{brand:'#0f1115',accent:'#c8a86c',ink:'#222228',muted:'#6e6e76',paper:'#faf8f4'},fontFamily:{serif:['Playfair Display','serif'],sans:['Inter','system-ui','sans-serif']}}}};</script>
<script src="https://unpkg.com/lucide@latest"></script>
<style>
body{font-family:Inter,system-ui,sans-serif;color:#222228}
.mega-menu-content{visibility:hidden;opacity:0;transform:translateY(10px);transition:all .3s ease-in-out}
.mega-menu-item:hover .mega-menu-content{visibility:visible;opacity:1;transform:translateY(0);pointer-events:auto}
#mobile-menu{transition:transform .3s ease-in-out}
.menu-open{transform:translateX(0)!important}
#booking-popup{transition:opacity .3s ease,visibility .3s ease}
#booking-popup.popup-hidden{opacity:0;visibility:hidden}
#booking-popup.popup-visible{opacity:1;visibility:visible}
</style>
</head>
<body>
`;

const FOOTER_SCRIPTS = `
<script>
document.addEventListener('DOMContentLoaded',()=>{
  if(window.lucide)lucide.createIcons();
  const mobileBtn=document.getElementById('mobile-menu-button');
  const mobileMenu=document.getElementById('mobile-menu');
  const closeBtn=document.getElementById('mobile-close-button');
  if(mobileBtn&&mobileMenu){mobileBtn.onclick=()=>mobileMenu.classList.toggle('menu-open');}
  if(closeBtn&&mobileMenu){closeBtn.onclick=()=>mobileMenu.classList.remove('menu-open');}
  document.querySelectorAll('[data-popup="open"]').forEach(b=>b.onclick=e=>{e.preventDefault();const p=document.getElementById('booking-popup');p&&p.classList.replace('popup-hidden','popup-visible');});
  document.querySelectorAll('[data-popup="close"]').forEach(b=>b.onclick=()=>{const p=document.getElementById('booking-popup');p&&p.classList.replace('popup-visible','popup-hidden');});
});
</script>
</body>
</html>`;

// Mapping slug → URL path
function slugToPath(slug) {
  if (slug === 'accueil') return '/index.html';
  // nested slugs like packs-shooting, photo-domicile etc. — we keep flat URL /slug/ for simplicity
  return `/${slug}/index.html`;
}

// Helper: extract title and meta description from the body HTML (look for <h1>)
function extractTitleMeta(html, fallbackTitle) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = h1 ? h1[1].replace(/<[^>]+>/g, '').trim() : fallbackTitle;
  return { title, meta: title.slice(0, 155) };
}

const files = fs.readdirSync(FUSED).filter(f => f.endsWith('.html'));
let count = 0;
// Map haroboz.com/<slug>/ → /<slug>/ relative paths, and map nested slugs.
// Known nested slugs: a-propos/luc-desbois-photographe, boutique/carte-cadeau, packs-shooting/..., photographe/..., portfolio/..., votre-experience/...
const NESTED = {
  'luc-desbois-photographe': 'a-propos/luc-desbois-photographe',
  'carte-cadeau': 'boutique/carte-cadeau',
  'galerie-privee-client': 'boutique/galerie-privee-client',
  'tirages-art-edition-limitee': 'boutique/tirages-art-edition-limitee',
  'photo-domicile': 'packs-shooting/photo-domicile',
  'portrait-studio': 'packs-shooting/portrait-studio',
  'shooting-duo-couple': 'packs-shooting/shooting-duo-couple',
  'shooting-exterieur': 'packs-shooting/shooting-exterieur',
  'photographe-marseille': 'photographe/photographe-marseille',
  'photographe-toulon': 'photographe/photographe-toulon',
  'photographe-nice': 'photographe/photographe-nice',
  'photographe-paris': 'photographe/photographe-paris',
  'galerie-couples': 'portfolio/galerie-couples',
  'galerie-portraits-hommes': 'portfolio/galerie-portraits-hommes',
  'temoignages-clients': 'portfolio/temoignages-clients',
  'book-modele-professionnel': 'votre-experience/book-modele-professionnel',
  'cadeau-couple-original': 'votre-experience/cadeau-couple-original',
  'premier-shooting-nu': 'votre-experience/premier-shooting-nu',
  'retrouver-confiance-corps': 'votre-experience/retrouver-confiance-corps',
};

// Base path for deployment (GitHub Pages serves under /Haroboz/). Change to '' for root deploy.
const BASE = process.env.EMERGENCY_BASE || '/Haroboz';

function rewriteInternalLinks(html) {
  // https://haroboz.com/ → /Haroboz/
  // https://haroboz.com/<slug>/ → /Haroboz/<nested>/ if nested, else /Haroboz/<slug>/
  return html.replace(/https:\/\/haroboz\.com(\/[^"'\s#?]*)/g, (match, pathPart) => {
    // keep images and wp-content assets pointing at haroboz.com
    if (pathPart.includes('/wp-content/') || pathPart.includes('/wp-admin/') || pathPart.includes('/wp-json')) {
      return match;
    }
    if (pathPart === '/' || pathPart === '') return `${BASE}/`;
    const clean = pathPart.replace(/\/$/, '');
    const parts = clean.split('/').filter(Boolean);
    const last = parts[parts.length - 1];
    if (NESTED[last]) {
      return `${BASE}/${NESTED[last]}/`;
    }
    return `${BASE}${pathPart}`;
  });
}

function slugToPath(slug) {
  if (slug === 'accueil') return '/index.html';
  if (NESTED[slug]) return `/${NESTED[slug]}/index.html`;
  return `/${slug}/index.html`;
}

for (const f of files) {
  const slug = f.replace(/\.html$/, '');
  let src = fs.readFileSync(path.join(FUSED, f), 'utf8').replace(/^<!--[^>]*-->\s*/, '');
  src = rewriteInternalLinks(src);
  const { title, meta } = extractTitleMeta(src, slug);
  const wrapped = CHROME(title + ' | Haroboz', meta) + src + FOOTER_SCRIPTS;
  const outPath = path.join(OUT, slugToPath(slug));
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, wrapped);
  count++;
}

// Copy favicon redirect
fs.writeFileSync(
  path.join(OUT, '404.html'),
  CHROME('Page non trouvée | Haroboz', 'Page introuvable') +
    '<main class="min-h-screen flex items-center justify-center p-8"><div class="text-center"><h1 class="text-4xl font-serif mb-4">Page introuvable</h1><p class="text-gray-600 mb-6">La page demandée n\'existe pas.</p><a href="/" class="text-brand underline">Retour à l\'accueil</a></div></main>' +
    FOOTER_SCRIPTS
);

console.log(`✅ Built ${count} pages → ${OUT}`);
console.log(`   Deploy with: npx netlify-cli deploy --dir=emergency-build --prod`);
console.log(`   Or:         npx surge emergency-build <your-subdomain>.surge.sh`);
