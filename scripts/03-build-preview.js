#!/usr/bin/env node
/**
 * 03-build-preview.js — Génère le site statique de preview
 *
 * Usage : node scripts/03-build-preview.js
 *
 * Combine :
 * - La maquette (maquette/) → template HTML/CSS/JS
 * - Le contenu SEO (content/pages/*.json) → texte optimisé
 * - Le maillage (content/menus/*.json) → navigation
 *
 * Produit un site statique complet dans preview/
 * prêt à être déployé sur Netlify, Vercel, Surge, etc.
 */

const fs = require('fs');
const path = require('path');

const PREVIEW_DIR = path.resolve(__dirname, '..', 'preview');
const CONTENT_DIR = path.resolve(__dirname, '..', 'content', 'pages');
const MENUS_DIR = path.resolve(__dirname, '..', 'content', 'menus');
const MAQUETTE_DIR = path.resolve(__dirname, '..', 'maquette');

// Créer la structure de sortie
fs.mkdirSync(path.join(PREVIEW_DIR, 'pages'), { recursive: true });
fs.mkdirSync(path.join(PREVIEW_DIR, 'css'), { recursive: true });
fs.mkdirSync(path.join(PREVIEW_DIR, 'js'), { recursive: true });
fs.mkdirSync(path.join(PREVIEW_DIR, 'img'), { recursive: true });

// ============================================
// CHARGEMENT DES DONNÉES
// ============================================

function loadContentPages() {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs.readdirSync(CONTENT_DIR)
    .filter(f => f.endsWith('.json') && !f.startsWith('_'))
    .map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(CONTENT_DIR, f), 'utf8'));
      data._filename = f;
      return data;
    });
}

function loadMenu(name) {
  const menuPath = path.join(MENUS_DIR, `${name}.json`);
  if (!fs.existsSync(menuPath)) return null;
  return JSON.parse(fs.readFileSync(menuPath, 'utf8'));
}

// ============================================
// GÉNÉRATION DU HEADER
// ============================================

function buildNav(mainMenu) {
  if (!mainMenu) return '<nav class="hrb-nav"><a href="/" class="hrb-logo">HAROBOZ</a></nav>';

  let navItems = '';
  for (const item of mainMenu.items || []) {
    if (item.children && item.children.length > 0) {
      let subItems = item.children
        .map(child => `<li><a href="${child.url}">${child.title}</a></li>`)
        .join('\n              ');
      navItems += `
          <li class="hrb-nav__dropdown">
            <a href="${item.url}">${item.title} <span class="hrb-nav__arrow">▾</span></a>
            <ul class="hrb-nav__submenu">
              ${subItems}
            </ul>
          </li>`;
    } else {
      navItems += `\n          <li><a href="${item.url}">${item.title}</a></li>`;
    }
  }

  return `
  <header class="hrb-header">
    <div class="hrb-header__inner">
      <a href="/" class="hrb-logo">HAROBOZ</a>
      <button class="hrb-hamburger" aria-label="Menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
      <nav class="hrb-nav">
        <ul class="hrb-nav__list">
          ${navItems}
        </ul>
      </nav>
    </div>
  </header>`;
}

// ============================================
// GÉNÉRATION DU FOOTER
// ============================================

function buildFooter(footerMenu) {
  if (!footerMenu || !footerMenu.columns) {
    return `
  <footer class="hrb-footer">
    <div class="hrb-footer__inner">
      <p>&copy; ${new Date().getFullYear()} HAROBOZ — Luc Desbois Photographe — Côte d'Azur</p>
    </div>
  </footer>`;
  }

  let columns = footerMenu.columns.map(col => {
    const links = col.items
      .map(item => `<li><a href="${item.url}">${item.title}</a></li>`)
      .join('\n          ');
    return `
      <div class="hrb-footer__column">
        <h4>${col.title}</h4>
        <ul>
          ${links}
        </ul>
      </div>`;
  }).join('\n');

  return `
  <footer class="hrb-footer">
    <div class="hrb-footer__columns">
      ${columns}
    </div>
    <div class="hrb-footer__bottom">
      <p>&copy; ${new Date().getFullYear()} HAROBOZ — Luc Desbois Photographe — Cannes, Côte d'Azur</p>
    </div>
  </footer>`;
}

// ============================================
// TEMPLATE DE PAGE COMPLÈTE
// ============================================

function buildPage({ title, metaTitle, metaDescription, slug, content, header, footer, isHome = false }) {
  const cssPath = isHome ? 'css/style.css' : '../css/style.css';
  const cssVarsPath = isHome ? 'css/variables.css' : '../css/variables.css';
  const jsPath = isHome ? 'js/main.js' : '../js/main.js';

  // Ajuster les liens du header/footer pour les sous-pages
  let adjustedHeader = header;
  let adjustedFooter = footer;
  if (!isHome) {
    // Les liens relatifs dans le header/footer doivent pointer vers la racine
    adjustedHeader = header.replace(/href="\//g, 'href="../');
    adjustedFooter = footer.replace(/href="\//g, 'href="../');
  }

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${metaTitle || title}</title>
  <meta name="description" content="${metaDescription || ''}">
  <meta property="og:title" content="${metaTitle || title}">
  <meta property="og:description" content="${metaDescription || ''}">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="fr_FR">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="stylesheet" href="${cssVarsPath}">
  <link rel="stylesheet" href="${cssPath}">
</head>
<body class="hrb-page hrb-page--${slug}">

${adjustedHeader}

<main class="hrb-main">
${content}
</main>

${adjustedFooter}

<script src="${jsPath}"></script>
</body>
</html>`;
}

// ============================================
// GÉNÉRATION CSS PAR DÉFAUT
// (sera remplacé/complété par la maquette)
// ============================================

function generateDefaultCSS() {
  // Variables CSS
  const variables = `/* HAROBOZ Design System — Variables */
:root {
  /* Couleurs */
  --hrb-black: #1a1a1a;
  --hrb-white: #fafafa;
  --hrb-gold: #c9a96e;
  --hrb-gold-light: #d4b97e;
  --hrb-gray-dark: #2d2d2d;
  --hrb-gray-medium: #666;
  --hrb-gray-light: #e8e8e8;
  --hrb-bg: #111;
  --hrb-bg-section: #1a1a1a;
  --hrb-text: #e0e0e0;
  --hrb-text-muted: #999;

  /* Typography */
  --hrb-font-display: 'Playfair Display', Georgia, serif;
  --hrb-font-body: 'Inter', -apple-system, sans-serif;
  --hrb-font-size-base: 1rem;
  --hrb-font-size-sm: 0.875rem;
  --hrb-font-size-lg: 1.125rem;
  --hrb-font-size-xl: 1.5rem;
  --hrb-font-size-2xl: 2rem;
  --hrb-font-size-3xl: 3rem;
  --hrb-font-size-hero: clamp(2.5rem, 5vw, 4.5rem);

  /* Spacing */
  --hrb-space-xs: 0.5rem;
  --hrb-space-sm: 1rem;
  --hrb-space-md: 2rem;
  --hrb-space-lg: 4rem;
  --hrb-space-xl: 6rem;
  --hrb-space-2xl: 8rem;

  /* Layout */
  --hrb-max-width: 1200px;
  --hrb-border-radius: 4px;

  /* Transitions */
  --hrb-transition: 0.3s ease;
}
`;

  // Styles principaux
  const style = `/* HAROBOZ — Styles principaux */
@import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&family=Inter:wght@300;400;500;600&display=swap');

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html { scroll-behavior: smooth; }

body {
  font-family: var(--hrb-font-body);
  font-size: var(--hrb-font-size-base);
  color: var(--hrb-text);
  background: var(--hrb-bg);
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
}

img { max-width: 100%; height: auto; display: block; }
a { color: var(--hrb-gold); text-decoration: none; transition: color var(--hrb-transition); }
a:hover { color: var(--hrb-gold-light); }

/* === HEADER === */
.hrb-header {
  position: fixed; top: 0; left: 0; right: 0; z-index: 100;
  background: rgba(17, 17, 17, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid rgba(201, 169, 110, 0.1);
}
.hrb-header__inner {
  max-width: var(--hrb-max-width);
  margin: 0 auto;
  padding: var(--hrb-space-sm) var(--hrb-space-md);
  display: flex; align-items: center; justify-content: space-between;
}
.hrb-logo {
  font-family: var(--hrb-font-display);
  font-size: var(--hrb-font-size-xl);
  font-weight: 700;
  color: var(--hrb-gold);
  letter-spacing: 0.15em;
}
.hrb-nav__list {
  display: flex; list-style: none; gap: var(--hrb-space-md);
}
.hrb-nav__list a { color: var(--hrb-text); font-size: var(--hrb-font-size-sm); font-weight: 400; }
.hrb-nav__list a:hover { color: var(--hrb-gold); }
.hrb-nav__dropdown { position: relative; }
.hrb-nav__submenu {
  display: none; position: absolute; top: 100%; left: 0;
  background: var(--hrb-gray-dark); border: 1px solid rgba(201,169,110,0.15);
  padding: var(--hrb-space-xs) 0; min-width: 220px; list-style: none;
}
.hrb-nav__dropdown:hover .hrb-nav__submenu { display: block; }
.hrb-nav__submenu li a { padding: var(--hrb-space-xs) var(--hrb-space-sm); display: block; white-space: nowrap; }
.hrb-hamburger { display: none; background: none; border: none; cursor: pointer; }
.hrb-hamburger span { display: block; width: 24px; height: 2px; background: var(--hrb-gold); margin: 5px 0; transition: var(--hrb-transition); }

/* === MAIN === */
.hrb-main { padding-top: 80px; }

/* === HERO === */
.hrb-hero {
  min-height: 80vh;
  display: flex; align-items: center; justify-content: center;
  text-align: center;
  padding: var(--hrb-space-2xl) var(--hrb-space-md);
  background-size: cover; background-position: center;
  position: relative;
}
.hrb-hero::before {
  content: ''; position: absolute; inset: 0;
  background: linear-gradient(135deg, rgba(17,17,17,0.85), rgba(17,17,17,0.6));
}
.hrb-hero__content { position: relative; z-index: 1; max-width: 800px; }
.hrb-hero h1 {
  font-family: var(--hrb-font-display);
  font-size: var(--hrb-font-size-hero);
  font-weight: 700; color: var(--hrb-white);
  line-height: 1.15; margin-bottom: var(--hrb-space-sm);
}
.hrb-hero__subtitle {
  font-size: var(--hrb-font-size-lg); color: var(--hrb-text-muted);
  margin-bottom: var(--hrb-space-md); max-width: 600px; margin-left: auto; margin-right: auto;
}

/* === SECTIONS === */
.hrb-section {
  padding: var(--hrb-space-xl) var(--hrb-space-md);
  max-width: var(--hrb-max-width); margin: 0 auto;
}
.hrb-section--dark { background: var(--hrb-bg-section); max-width: 100%; }
.hrb-section--dark > * { max-width: var(--hrb-max-width); margin: 0 auto; }
.hrb-section h2 {
  font-family: var(--hrb-font-display);
  font-size: var(--hrb-font-size-2xl); color: var(--hrb-white);
  margin-bottom: var(--hrb-space-md); text-align: center;
}
.hrb-section h3 {
  font-family: var(--hrb-font-display);
  font-size: var(--hrb-font-size-xl); color: var(--hrb-gold);
  margin-bottom: var(--hrb-space-sm);
}
.hrb-section p { margin-bottom: var(--hrb-space-sm); max-width: 75ch; }

/* === BOUTON === */
.hrb-btn {
  display: inline-block;
  padding: 14px 36px;
  background: var(--hrb-gold);
  color: var(--hrb-black);
  font-weight: 600;
  font-size: var(--hrb-font-size-sm);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  border: 2px solid var(--hrb-gold);
  transition: all var(--hrb-transition);
  cursor: pointer;
}
.hrb-btn:hover { background: transparent; color: var(--hrb-gold); }
.hrb-btn--outline { background: transparent; color: var(--hrb-gold); }
.hrb-btn--outline:hover { background: var(--hrb-gold); color: var(--hrb-black); }

/* === GRILLE PACKS === */
.hrb-packs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: var(--hrb-space-md);
  margin-top: var(--hrb-space-md);
}
.hrb-pack-card {
  background: var(--hrb-bg-section);
  border: 1px solid rgba(201,169,110,0.12);
  overflow: hidden;
  transition: transform var(--hrb-transition), border-color var(--hrb-transition);
}
.hrb-pack-card:hover { transform: translateY(-4px); border-color: var(--hrb-gold); }
.hrb-pack-card img { width: 100%; height: 240px; object-fit: cover; }
.hrb-pack-card__body { padding: var(--hrb-space-sm) var(--hrb-space-md) var(--hrb-space-md); }
.hrb-pack-card h3 { font-size: var(--hrb-font-size-lg); margin-bottom: var(--hrb-space-xs); }

/* === RÉASSURANCE === */
.hrb-reassurance {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--hrb-space-md);
  text-align: center;
  margin-top: var(--hrb-space-md);
}
.hrb-reassurance__item { padding: var(--hrb-space-md); }
.hrb-reassurance__icon { font-size: 2.5rem; color: var(--hrb-gold); margin-bottom: var(--hrb-space-sm); }

/* === TÉMOIGNAGES === */
.hrb-testimonial {
  background: var(--hrb-bg-section);
  border-left: 3px solid var(--hrb-gold);
  padding: var(--hrb-space-md);
  margin-bottom: var(--hrb-space-md);
}
.hrb-testimonial blockquote { font-style: italic; font-size: var(--hrb-font-size-lg); }
.hrb-testimonial cite { display: block; margin-top: var(--hrb-space-sm); color: var(--hrb-gold); font-style: normal; }

/* === FAQ === */
.hrb-faq__item { border-bottom: 1px solid rgba(255,255,255,0.08); padding: var(--hrb-space-sm) 0; }
.hrb-faq__item h3 { cursor: pointer; font-size: var(--hrb-font-size-base); font-family: var(--hrb-font-body); font-weight: 600; color: var(--hrb-white); }
.hrb-faq__item p { margin-top: var(--hrb-space-xs); color: var(--hrb-text-muted); }

/* === CTA === */
.hrb-cta {
  text-align: center;
  padding: var(--hrb-space-2xl) var(--hrb-space-md);
  background: linear-gradient(135deg, var(--hrb-gray-dark), var(--hrb-bg));
  border-top: 1px solid rgba(201,169,110,0.1);
  border-bottom: 1px solid rgba(201,169,110,0.1);
}

/* === FOOTER === */
.hrb-footer { background: var(--hrb-black); padding: var(--hrb-space-xl) var(--hrb-space-md) var(--hrb-space-md); }
.hrb-footer__columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: var(--hrb-space-lg);
  max-width: var(--hrb-max-width); margin: 0 auto;
}
.hrb-footer__column h4 {
  font-family: var(--hrb-font-display);
  color: var(--hrb-gold); font-size: var(--hrb-font-size-sm);
  text-transform: uppercase; letter-spacing: 0.1em;
  margin-bottom: var(--hrb-space-sm);
}
.hrb-footer__column ul { list-style: none; }
.hrb-footer__column li { margin-bottom: var(--hrb-space-xs); }
.hrb-footer__column a { color: var(--hrb-text-muted); font-size: var(--hrb-font-size-sm); }
.hrb-footer__column a:hover { color: var(--hrb-gold); }
.hrb-footer__bottom {
  max-width: var(--hrb-max-width); margin: var(--hrb-space-lg) auto 0;
  padding-top: var(--hrb-space-md); border-top: 1px solid rgba(255,255,255,0.06);
  text-align: center; color: var(--hrb-text-muted); font-size: var(--hrb-font-size-sm);
}

/* === PREVIEW BANNER === */
.hrb-preview-banner {
  position: fixed; bottom: 0; left: 0; right: 0; z-index: 999;
  background: var(--hrb-gold); color: var(--hrb-black);
  text-align: center; padding: 10px;
  font-size: var(--hrb-font-size-sm); font-weight: 600;
}

/* === RESPONSIVE === */
@media (max-width: 768px) {
  .hrb-hamburger { display: block; }
  .hrb-nav { display: none; position: absolute; top: 100%; left: 0; right: 0; background: var(--hrb-bg); padding: var(--hrb-space-md); }
  .hrb-nav.active { display: block; }
  .hrb-nav__list { flex-direction: column; gap: var(--hrb-space-sm); }
  .hrb-nav__submenu { position: static; border: none; padding-left: var(--hrb-space-md); }
  .hrb-nav__dropdown:hover .hrb-nav__submenu { display: block; }
  .hrb-hero { min-height: 60vh; padding: var(--hrb-space-xl) var(--hrb-space-sm); }
  .hrb-hero h1 { font-size: var(--hrb-font-size-2xl); }
  .hrb-section { padding: var(--hrb-space-lg) var(--hrb-space-sm); }
}
`;

  return { variables, style };
}

// ============================================
// GÉNÉRATION JS
// ============================================

function generateJS() {
  return `/* HAROBOZ — Scripts */
document.addEventListener('DOMContentLoaded', () => {
  // Menu mobile
  const hamburger = document.querySelector('.hrb-hamburger');
  const nav = document.querySelector('.hrb-nav');
  if (hamburger && nav) {
    hamburger.addEventListener('click', () => {
      nav.classList.toggle('active');
      hamburger.setAttribute('aria-expanded', nav.classList.contains('active'));
    });
  }

  // Smooth scroll pour les ancres
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Header shrink on scroll
  const header = document.querySelector('.hrb-header');
  if (header) {
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 50);
    });
  }
});
`;
}

// ============================================
// BUILD PRINCIPAL
// ============================================

function main() {
  console.log('🔨 BUILD PREVIEW — HAROBOZ');
  console.log('==========================\n');

  // 1. Charger les contenus
  const pages = loadContentPages();
  const mainMenu = loadMenu('main');
  const footerMenu = loadMenu('footer');

  console.log(`   📄 ${pages.length} pages de contenu trouvées`);
  console.log(`   📋 Menu principal : ${mainMenu ? 'OK' : '⚠️ Absent'}`);
  console.log(`   📋 Menu footer : ${footerMenu ? 'OK' : '⚠️ Absent'}`);

  // 2. Vérifier la maquette
  const hasMaquette = fs.existsSync(MAQUETTE_DIR) &&
    fs.readdirSync(MAQUETTE_DIR).some(f => f.endsWith('.html'));

  if (hasMaquette) {
    console.log('   📐 Maquette détectée — les styles seront fusionnés');
    // Copier les fichiers CSS/JS de la maquette
    const maquetteCss = path.join(MAQUETTE_DIR, 'css');
    const maquetteJs = path.join(MAQUETTE_DIR, 'js');
    if (fs.existsSync(maquetteCss)) {
      for (const f of fs.readdirSync(maquetteCss)) {
        fs.copyFileSync(path.join(maquetteCss, f), path.join(PREVIEW_DIR, 'css', f));
      }
      console.log('   ✅ CSS maquette copié');
    }
    if (fs.existsSync(maquetteJs)) {
      for (const f of fs.readdirSync(maquetteJs)) {
        fs.copyFileSync(path.join(maquetteJs, f), path.join(PREVIEW_DIR, 'js', f));
      }
      console.log('   ✅ JS maquette copié');
    }
  } else {
    console.log('   📐 Pas de maquette — utilisation des styles par défaut');
  }

  // 3. Générer le CSS par défaut (si pas de maquette ou en complément)
  const css = generateDefaultCSS();
  const varsPath = path.join(PREVIEW_DIR, 'css', 'variables.css');
  const stylePath = path.join(PREVIEW_DIR, 'css', 'style.css');

  if (!fs.existsSync(varsPath)) {
    fs.writeFileSync(varsPath, css.variables, 'utf8');
  }
  if (!fs.existsSync(stylePath)) {
    fs.writeFileSync(stylePath, css.style, 'utf8');
  }

  // 4. Générer le JS
  const jsPath = path.join(PREVIEW_DIR, 'js', 'main.js');
  if (!fs.existsSync(jsPath)) {
    fs.writeFileSync(jsPath, generateJS(), 'utf8');
  }

  // 5. Construire header et footer
  const header = buildNav(mainMenu);
  const footer = buildFooter(footerMenu);

  // 6. Générer les pages
  if (pages.length === 0) {
    console.log('\n   ⚠️  Aucune page de contenu dans content/pages/');
    console.log('   → Créer des fichiers .json (voir content/pages/_EXAMPLE-FORMAT.json)');

    // Générer une page d'accueil placeholder
    const placeholderHtml = buildPage({
      title: 'HAROBOZ — Preview en construction',
      metaTitle: 'HAROBOZ — Photographe Nu Masculin Côte d\'Azur',
      metaDescription: 'Site en construction. Refonte en cours.',
      slug: 'accueil',
      isHome: true,
      header,
      footer,
      content: `
    <section class="hrb-hero" style="background-image: url('https://haroboz.com/wp-content/uploads/hero-placeholder.jpg');">
      <div class="hrb-hero__content">
        <h1>Preview en construction</h1>
        <p class="hrb-hero__subtitle">Le contenu de chaque page sera généré à partir des fichiers content/pages/*.json</p>
      </div>
    </section>
    <section class="hrb-section" style="text-align: center; padding: 4rem 2rem;">
      <h2>Pages prévues dans le cocon sémantique</h2>
      <p>Voir seo/cocon-semantique.md pour l'architecture complète.</p>
    </section>
    <div class="hrb-preview-banner">⚡ PREVIEW — Site en cours de construction — HAROBOZ</div>`
    });

    fs.writeFileSync(path.join(PREVIEW_DIR, 'index.html'), placeholderHtml, 'utf8');
    console.log('   📄 index.html placeholder généré');

  } else {
    let homeGenerated = false;

    for (const page of pages) {
      const isHome = page.slug === 'accueil' || page.slug === '' || page.slug === 'home';
      const html = buildPage({
        title: page.title,
        metaTitle: page.meta_title,
        metaDescription: page.meta_description,
        slug: page.slug,
        content: page.content + '\n    <div class="hrb-preview-banner">⚡ PREVIEW — HAROBOZ — Refonte en cours</div>',
        header,
        footer,
        isHome
      });

      if (isHome) {
        fs.writeFileSync(path.join(PREVIEW_DIR, 'index.html'), html, 'utf8');
        homeGenerated = true;
        console.log(`   ✅ index.html (${page.slug})`);
      } else {
        const pageDir = path.join(PREVIEW_DIR, 'pages');
        fs.writeFileSync(path.join(pageDir, `${page.slug}.html`), html, 'utf8');
        console.log(`   ✅ pages/${page.slug}.html`);
      }
    }

    if (!homeGenerated) {
      console.log('   ⚠️  Pas de page d\'accueil — créer content/pages/accueil.json');
    }
  }

  // 7. Résumé
  console.log('\n========================================');
  console.log('✅ BUILD TERMINÉ');
  console.log('========================================');
  console.log(`   📁 Site statique dans : preview/`);
  console.log(`   📄 Pages générées : ${pages.length || 1}`);
  console.log('\n   ➡️  Tester en local :  node scripts/04-serve-local.js');
  console.log('   ➡️  Déployer :         bash scripts/05-deploy-cloud.sh');
}

main();
