#!/usr/bin/env node
/**
 * generate-wp-pusher.js — v2
 * Generates a COMPLETE self-contained WP replacement tool:
 * pages, menus, media, footer — full site replacement in 1 click.
 */

const fs = require('fs');
const path = require('path');

const PREVIEW_DIR = path.join(__dirname, '..', 'preview');
const MENUS_DIR = path.join(__dirname, '..', 'content', 'menus');
const OUTPUT_FILE = path.join(__dirname, '..', 'wp-push', 'haroboz-pusher.html');

// ===== Helpers =====
function findHtmlFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(findHtmlFiles(fullPath));
    else if (entry.name.endsWith('.html')) results.push(fullPath);
  }
  return results;
}

function extractMain(html) {
  const m = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  return m ? m[1].trim() : '';
}
function extractTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].trim() : '';
}
function extractMeta(html) {
  const m = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  return m ? m[1].trim() : '';
}
function extractHeader(html) {
  const m = html.match(/<header[^>]*>([\s\S]*?)<\/header>/i);
  return m ? m[0] : '';
}
function extractFooter(html) {
  const m = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i);
  return m ? m[0] : '';
}
function extractImages(html) {
  const imgs = [];
  const re = /src=["']([^"']*\.(png|jpg|jpeg|webp|svg))['"]/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!imgs.includes(m[1])) imgs.push(m[1]);
  }
  return imgs;
}

function getSilo(slug, parentSlug) {
  const s = parentSlug || slug;
  if (s.startsWith('packs-shooting')) return 'Packs';
  if (s.startsWith('votre-experience')) return 'Parcours';
  if (s.startsWith('photographe-cote-azur')) return 'Local';
  if (s.startsWith('portfolio')) return 'Portfolio';
  if (s.startsWith('boutique')) return 'Boutique';
  if (s.startsWith('a-propos')) return 'About';
  return 'Other';
}

// ===== Build data =====
function buildRegistry() {
  const files = findHtmlFiles(PREVIEW_DIR);
  const pages = [];
  const allImages = new Set();

  for (const filePath of files) {
    const rel = path.relative(PREVIEW_DIR, filePath).replace(/\\/g, '/');
    const html = fs.readFileSync(filePath, 'utf-8');
    const mainContent = extractMain(html);
    const title = extractTitle(html);
    const metaDesc = extractMeta(html);
    const isHome = rel === 'index.html';

    let slug, wpSlug, parentSlug;
    const parts = rel.split('/');

    if (isHome) { slug = 'accueil'; wpSlug = ''; parentSlug = null; }
    else if (parts.length === 2 && parts[0] === 'pages') {
      slug = parts[1].replace('.html', ''); wpSlug = slug; parentSlug = null;
    } else if (parts.length === 3 && parts[2] === 'index.html') {
      slug = parts[1]; wpSlug = parts[1]; parentSlug = null;
    } else if (parts.length === 3) {
      slug = parts[2].replace('.html', ''); wpSlug = slug; parentSlug = parts[1];
    } else { slug = rel.replace('.html', ''); wpSlug = slug; parentSlug = null; }

    // Collect images
    for (const img of extractImages(mainContent)) allImages.add(img);

    pages.push({
      file: rel, title, metaDesc, slug, wpSlug, parentSlug,
      silo: getSilo(slug, parentSlug), isHome,
      contentLen: mainContent.length,
      wordCount: mainContent.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length,
      mainContent
    });
  }

  // Sort: homepage → parents → children → standalone
  pages.sort((a, b) => {
    if (a.isHome) return -1; if (b.isHome) return 1;
    if (!a.parentSlug && b.parentSlug) return -1;
    if (a.parentSlug && !b.parentSlug) return 1;
    return 0;
  });

  return { pages, images: [...allImages] };
}

function loadMenus() {
  const menus = {};
  if (fs.existsSync(path.join(MENUS_DIR, 'main-menu.json')))
    menus.main = JSON.parse(fs.readFileSync(path.join(MENUS_DIR, 'main-menu.json'), 'utf-8'));
  if (fs.existsSync(path.join(MENUS_DIR, 'footer.json')))
    menus.footer = JSON.parse(fs.readFileSync(path.join(MENUS_DIR, 'footer.json'), 'utf-8'));
  return menus;
}

function loadHeaderFooter() {
  const indexPath = path.join(PREVIEW_DIR, 'index.html');
  if (!fs.existsSync(indexPath)) return { header: '', footer: '' };
  const html = fs.readFileSync(indexPath, 'utf-8');
  return { header: extractHeader(html), footer: extractFooter(html) };
}

// ===== Generate =====
const { pages, images } = buildRegistry();
const menus = loadMenus();
const { header, footer } = loadHeaderFooter();

console.log(`Pages: ${pages.length}`);
console.log(`Images referenced: ${images.length}`);
console.log(`Menus: ${Object.keys(menus).join(', ')}`);

// Escape for embedding in JS
function jsEscape(str) {
  return str.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$');
}

const pagesJson = JSON.stringify(pages.map(p => ({
  ...p,
  mainContent: undefined, // will be in separate array for size
})));

// Build content array separately (compressed references)
const contentsArray = pages.map(p => p.mainContent);

const outputHtml = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HAROBOZ — Remplacement Complet du Site WordPress</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{--n:#0a1a3a;--nl:#122a5c;--nm:#1a3366;--ns:#0d2248;--g:#c9a84c;--gl:#e0c777;--gd:#8a7233;--ok:#22c55e;--ko:#ef4444;--info:#3b82f6;--warn:#f59e0b;--t:#e2e8f0;--td:#94a3b8;--tb:#f8fafc;--b:#1e3a5f;--c:#0d2248}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:var(--n);color:var(--t);min-height:100vh;line-height:1.6}
h1,h2,h3,h4{font-family:'Playfair Display',serif;font-weight:600}
.ctn{max-width:1400px;margin:0 auto;padding:0 24px}
.hdr{background:linear-gradient(135deg,var(--n),var(--nl));border-bottom:1px solid var(--b);padding:20px 0;position:sticky;top:0;z-index:100}
.hdr .ctn{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px}
.hdr h1{font-size:1.4rem;color:var(--g)}
.hdr h1 span{color:var(--td);font-family:'Inter';font-weight:400;font-size:.8rem;margin-left:10px}
.hdr-s{display:flex;align-items:center;gap:10px}
.dot{width:10px;height:10px;border-radius:50%;background:var(--ko);transition:.3s}
.dot.on{background:var(--ok)}
.tabs{display:flex;gap:0;border-bottom:2px solid var(--b);margin:20px 0 0;overflow-x:auto}
.tab{padding:10px 20px;cursor:pointer;font-weight:500;font-size:.85rem;color:var(--td);border:none;border-bottom:2px solid transparent;margin-bottom:-2px;transition:.2s;background:none;white-space:nowrap}
.tab:hover{color:var(--t)}.tab.on{color:var(--g);border-bottom-color:var(--g)}
.pnl{display:none;padding:28px 0}.pnl.on{display:block}
.fg{margin-bottom:16px}
.fg label{display:block;font-size:.8rem;font-weight:500;color:var(--td);margin-bottom:4px;text-transform:uppercase;letter-spacing:.05em}
.fg input,.fg select,.fg textarea{width:100%;padding:10px 14px;background:var(--ns);border:1px solid var(--b);border-radius:8px;color:var(--t);font-size:.9rem;font-family:'Inter';transition:.2s}
.fg input:focus,.fg select:focus,.fg textarea:focus{outline:none;border-color:var(--g)}
.fr{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.btn{display:inline-flex;align-items:center;gap:8px;padding:10px 20px;border:none;border-radius:8px;font-family:'Inter';font-weight:600;font-size:.85rem;cursor:pointer;transition:.2s}
.btn-g{background:var(--g);color:var(--n)}.btn-g:hover{background:var(--gl);transform:translateY(-1px)}.btn-g:disabled{background:var(--gd);cursor:not-allowed;transform:none}
.btn-o{background:transparent;border:1px solid var(--b);color:var(--t)}.btn-o:hover{border-color:var(--g);color:var(--g)}
.btn-d{background:var(--ko);color:#fff}.btn-d:hover{background:#dc2626}
.btn-ok{background:var(--ok);color:#fff}
.btn-sm{padding:6px 12px;font-size:.75rem}
.card{background:var(--c);border:1px solid var(--b);border-radius:10px;padding:20px;transition:.2s}
.card:hover{border-color:var(--gd)}
.cc{max-width:600px;margin:0 auto}
.cr{margin-top:16px;padding:14px;border-radius:8px;display:none}
.cr.ok{display:block;background:rgba(34,197,94,.1);border:1px solid var(--ok)}.cr.ko{display:block;background:rgba(239,68,68,.1);border:1px solid var(--ko)}
.pc{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:16px}
.pills{display:flex;gap:6px;flex-wrap:wrap}
.pill{padding:5px 12px;border-radius:16px;font-size:.75rem;font-weight:500;cursor:pointer;border:1px solid var(--b);background:transparent;color:var(--td);transition:.2s}
.pill:hover,.pill.on{border-color:var(--g);color:var(--g);background:rgba(201,168,76,.1)}
.pg{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:14px}
.pk{background:var(--c);border:1px solid var(--b);border-radius:8px;padding:14px;position:relative;transition:.2s}
.pk:hover{border-color:var(--gd)}
.pk .kh{display:flex;align-items:flex-start;gap:10px;margin-bottom:8px}
.pk .kh input[type=checkbox]{width:16px;height:16px;margin-top:3px;accent-color:var(--g);cursor:pointer}
.pk .kt{font-size:.85rem;font-weight:600;color:var(--tb);line-height:1.3;flex:1}
.pk .km{font-size:.7rem;color:var(--td);margin-bottom:6px}
.pk .km span{margin-right:10px}
.sb{display:inline-block;padding:2px 8px;border-radius:10px;font-size:.65rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em}
.sb.pe{background:rgba(148,163,184,.2);color:var(--td)}
.sb.pu{background:rgba(59,130,246,.2);color:var(--info)}
.sb.dn{background:rgba(34,197,94,.2);color:var(--ok)}
.sb.er{background:rgba(239,68,68,.2);color:var(--ko)}
.pp{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:768px){.pp{grid-template-columns:1fr}.fr{grid-template-columns:1fr}}
.pa{display:flex;flex-direction:column;gap:14px}
.pmt{display:flex;align-items:center;gap:14px;padding:14px;background:var(--ns);border-radius:8px}
.ts{position:relative;width:44px;height:24px;background:var(--b);border-radius:12px;cursor:pointer;transition:.2s;border:none}
.ts.on{background:var(--g)}
.ts::after{content:'';position:absolute;top:2px;left:2px;width:20px;height:20px;background:#fff;border-radius:50%;transition:.2s}
.ts.on::after{transform:translateX(20px)}
.pbc{width:100%;height:8px;background:var(--ns);border-radius:4px;overflow:hidden;margin:10px 0}
.pbf{height:100%;background:linear-gradient(90deg,var(--g),var(--gl));border-radius:4px;transition:width .3s;width:0}
.pt{font-size:.8rem;color:var(--td)}
.log{background:#050e1f;border:1px solid var(--b);border-radius:8px;padding:14px;max-height:350px;overflow-y:auto;font-family:'Courier New',monospace;font-size:.75rem;line-height:1.8}
.le{padding:1px 0}.le.ok{color:var(--ok)}.le.ko{color:var(--ko)}.le.info{color:var(--info)}.le.warn{color:var(--warn)}
.steps{display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap}
.step{padding:8px 16px;border-radius:20px;font-size:.8rem;font-weight:500;color:var(--td);background:var(--ns);border:1px solid var(--b)}
.step.active{color:var(--g);border-color:var(--g);background:rgba(201,168,76,.08)}
.step.done{color:var(--ok);border-color:var(--ok);background:rgba(34,197,94,.08)}
.media-drop{border:2px dashed var(--b);border-radius:12px;padding:40px;text-align:center;transition:.2s;cursor:pointer}
.media-drop:hover,.media-drop.over{border-color:var(--g);background:rgba(201,168,76,.05)}
.media-drop h3{color:var(--g);margin-bottom:8px}
.media-drop p{color:var(--td);font-size:.85rem}
.media-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-top:16px}
.media-item{background:var(--c);border:1px solid var(--b);border-radius:8px;padding:8px;text-align:center;font-size:.7rem;color:var(--td);position:relative}
.media-item img{width:100%;height:80px;object-fit:cover;border-radius:4px;margin-bottom:4px}
.media-item .sb{position:absolute;top:4px;right:4px}
.menu-tree{background:var(--ns);border-radius:8px;padding:16px}
.menu-tree ul{list-style:none;padding-left:20px}
.menu-tree li{padding:4px 0;font-size:.85rem;color:var(--t)}
.menu-tree li::before{content:'├─ ';color:var(--gd);font-family:monospace}
.menu-tree li:last-child::before{content:'└─ '}
.menu-tree>ul{padding-left:0}
.menu-tree>ul>li::before{content:''}
.menu-tree>ul>li{font-weight:600;color:var(--g);padding:6px 0}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:20px}
.stat{background:var(--ns);border-radius:8px;padding:14px;text-align:center}
.stat .sv{font-size:1.8rem;font-weight:700;color:var(--g);font-family:'Playfair Display'}
.stat .sl{font-size:.7rem;color:var(--td);text-transform:uppercase;letter-spacing:.05em;margin-top:2px}
.danger-zone{margin-top:40px;padding:20px;border:1px solid var(--ko);border-radius:8px;background:rgba(239,68,68,.05)}
.danger-zone h3{color:var(--ko);margin-bottom:10px;font-size:1rem}
</style>
</head>
<body>

<header class="hdr">
<div class="ctn">
  <h1>HAROBOZ <span>Remplacement Complet du Site</span></h1>
  <div class="hdr-s">
    <div class="dot" id="statusDot"></div>
    <span id="statusText" style="font-size:.8rem;color:var(--td)">Non connecté</span>
  </div>
</div>
</header>

<div class="ctn">
  <div class="tabs">
    <button class="tab on" onclick="showTab('connect')">1. Connexion</button>
    <button class="tab" onclick="showTab('pages')">2. Pages (${pages.length})</button>
    <button class="tab" onclick="showTab('menus')">3. Menus & Footer</button>
    <button class="tab" onclick="showTab('media')">4. Médias</button>
    <button class="tab" onclick="showTab('push')">5. Push Complet</button>
  </div>

  <!-- TAB 1: CONNECTION -->
  <div class="pnl on" id="tab-connect">
    <div class="card cc">
      <h2 style="color:var(--g);margin-bottom:20px;font-size:1.3rem">Connexion WordPress</h2>
      <div class="fg">
        <label>URL du site WordPress</label>
        <input type="url" id="wpUrl" value="https://haroboz.com" placeholder="https://monsite.com">
      </div>
      <div class="fr">
        <div class="fg"><label>Nom d'utilisateur</label><input type="text" id="wpUser" placeholder="admin"></div>
        <div class="fg"><label>Mot de passe application</label><input type="password" id="wpPass" placeholder="xxxx xxxx xxxx xxxx"></div>
      </div>
      <button class="btn btn-g" onclick="testConnection()" id="btnTest">Tester la connexion</button>
      <div class="cr" id="connResult"></div>
      <div style="margin-top:16px;font-size:.75rem;color:var(--td)">
        <p>Créez un mot de passe d'application dans : WP Admin → Utilisateurs → Profil → Mots de passe d'application</p>
      </div>
    </div>
  </div>

  <!-- TAB 2: PAGES -->
  <div class="pnl" id="tab-pages">
    <div class="stats" id="pageStats"></div>
    <div class="pc">
      <div class="pills" id="siloFilters"></div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-o btn-sm" onclick="selectAll(true)">Tout sélectionner</button>
        <button class="btn btn-o btn-sm" onclick="selectAll(false)">Tout désélectionner</button>
      </div>
    </div>
    <div class="pg" id="pageGrid"></div>
  </div>

  <!-- TAB 3: MENUS -->
  <div class="pnl" id="tab-menus">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      <div class="card">
        <h3 style="color:var(--g);margin-bottom:16px">Menu Principal</h3>
        <div class="menu-tree" id="mainMenuTree"></div>
        <button class="btn btn-g" style="margin-top:16px" onclick="pushMenu('main')" id="btnPushMainMenu">Pousser le menu principal</button>
      </div>
      <div class="card">
        <h3 style="color:var(--g);margin-bottom:16px">Footer (4 colonnes)</h3>
        <div class="menu-tree" id="footerMenuTree"></div>
        <button class="btn btn-g" style="margin-top:16px" onclick="pushMenu('footer')" id="btnPushFooter">Pousser le footer</button>
      </div>
    </div>
    <div class="card" style="margin-top:20px">
      <h3 style="color:var(--g);margin-bottom:12px">Structure du Header & Footer (HTML)</h3>
      <p style="font-size:.8rem;color:var(--td);margin-bottom:12px">Ce contenu sera injecté via un widget ou un bloc réutilisable WordPress.</p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        <div>
          <label style="font-size:.75rem;color:var(--td);display:block;margin-bottom:4px">HEADER HTML</label>
          <textarea id="headerHtml" rows="6" style="width:100%;padding:10px;background:var(--ns);border:1px solid var(--b);border-radius:8px;color:var(--t);font-family:monospace;font-size:.7rem;resize:vertical"></textarea>
        </div>
        <div>
          <label style="font-size:.75rem;color:var(--td);display:block;margin-bottom:4px">FOOTER HTML</label>
          <textarea id="footerHtml" rows="6" style="width:100%;padding:10px;background:var(--ns);border:1px solid var(--b);border-radius:8px;color:var(--t);font-family:monospace;font-size:.7rem;resize:vertical"></textarea>
        </div>
      </div>
      <button class="btn btn-g" style="margin-top:12px" onclick="pushHeaderFooterBlocks()">Créer en blocs réutilisables</button>
    </div>
  </div>

  <!-- TAB 4: MEDIA -->
  <div class="pnl" id="tab-media">
    <div class="stats">
      <div class="stat"><div class="sv" id="mediaTotal">0</div><div class="sl">Images référencées</div></div>
      <div class="stat"><div class="sv" id="mediaUploaded">0</div><div class="sl">Uploadées</div></div>
      <div class="stat"><div class="sv" id="mediaPending">0</div><div class="sl">En attente</div></div>
    </div>
    <div class="media-drop" id="mediaDrop" ondrop="handleDrop(event)" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)">
      <h3>Glissez vos images ici</h3>
      <p>ou <label style="color:var(--g);cursor:pointer;text-decoration:underline"><input type="file" id="mediaInput" multiple accept="image/*" style="display:none" onchange="handleFiles(this.files)">parcourez vos fichiers</label></p>
      <p style="margin-top:8px;font-size:.75rem">PNG, JPG, WebP — Les images seront uploadées dans /wp-content/uploads/</p>
    </div>
    <div style="margin-top:16px;display:flex;gap:8px">
      <button class="btn btn-g" onclick="uploadAllMedia()" id="btnUploadMedia">Uploader toutes les images</button>
      <button class="btn btn-o" onclick="fixImageUrls()">Mettre à jour les URLs dans le contenu</button>
    </div>
    <div class="pbc" style="margin-top:12px"><div class="pbf" id="mediaProgress"></div></div>
    <div class="media-grid" id="mediaGrid"></div>
  </div>

  <!-- TAB 5: PUSH COMPLET -->
  <div class="pnl" id="tab-push">
    <div class="steps" id="pushSteps">
      <div class="step" data-step="cleanup">1. Nettoyage WP</div>
      <div class="step" data-step="pages">2. Pages (${pages.length})</div>
      <div class="step" data-step="menus">3. Menus</div>
      <div class="step" data-step="seo">4. SEO Meta</div>
      <div class="step" data-step="verify">5. Vérification</div>
    </div>
    <div class="pp">
      <div class="pa">
        <div class="card">
          <h3 style="color:var(--g);margin-bottom:12px">Mode de publication</h3>
          <div class="pmt">
            <span style="font-size:.85rem">Brouillon</span>
            <button class="ts" id="publishToggle" onclick="togglePublish()"></button>
            <span style="font-size:.85rem">Publié</span>
          </div>
          <div style="margin-top:12px">
            <label style="display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--td);cursor:pointer">
              <input type="checkbox" id="chkReplace" checked style="accent-color:var(--g)"> Remplacer les pages existantes (même slug)
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--td);cursor:pointer;margin-top:8px">
              <input type="checkbox" id="chkMenus" checked style="accent-color:var(--g)"> Mettre à jour les menus
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--td);cursor:pointer;margin-top:8px">
              <input type="checkbox" id="chkSeo" checked style="accent-color:var(--g)"> Mettre à jour les meta SEO (Yoast/RankMath)
            </label>
            <label style="display:flex;align-items:center;gap:8px;font-size:.8rem;color:var(--td);cursor:pointer;margin-top:8px">
              <input type="checkbox" id="chkHomepage" checked style="accent-color:var(--g)"> Définir la page d'accueil
            </label>
          </div>
        </div>
        <button class="btn btn-g" style="padding:16px 32px;font-size:1rem" onclick="pushAll()" id="btnPushAll">
          REMPLACER TOUT LE SITE
        </button>
        <button class="btn btn-o" onclick="pushSelected()" id="btnPushSelected">Pousser uniquement les pages sélectionnées</button>
        <button class="btn btn-o" onclick="retryFailed()">Relancer les échecs</button>
        <div class="pbc"><div class="pbf" id="pushProgress"></div></div>
        <div class="pt" id="pushProgressText">En attente...</div>
        <button class="btn btn-o btn-sm" onclick="exportLog()" style="margin-top:8px">Exporter le log</button>
      </div>
      <div>
        <div class="log" id="pushLog"><div class="le info">En attente de lancement...</div></div>
      </div>
    </div>
    <div class="danger-zone">
      <h3>Zone dangereuse</h3>
      <p style="font-size:.8rem;color:var(--td);margin-bottom:12px">Supprimer TOUTES les pages WordPress existantes avant de pousser. Irréversible.</p>
      <button class="btn btn-d btn-sm" onclick="deleteAllWpPages()">Supprimer toutes les pages WP</button>
    </div>
  </div>
</div>

<script>
// ===== EMBEDDED DATA =====
const PAGES = ${JSON.stringify(pages.map(p => ({ ...p, mainContent: undefined })), null, 0)};
const CONTENTS = ${JSON.stringify(contentsArray)};
const MENUS = ${JSON.stringify(menus)};
const IMAGES_LIST = ${JSON.stringify(images)};
const HEADER_HTML = \`${jsEscape(header)}\`;
const FOOTER_HTML = \`${jsEscape(footer)}\`;

// Attach content back
PAGES.forEach((p, i) => p.mainContent = CONTENTS[i]);

// ===== STATE =====
let wpUrl = '', wpUser = '', wpPass = '';
let connected = false;
let publishMode = false;
let parentIdMap = {};
let mediaMap = {};  // localPath → wpUrl
let uploadedFiles = [];
let pushResults = { success: [], failed: [], skipped: [] };

// ===== TABS =====
function showTab(id) {
  document.querySelectorAll('.pnl').forEach(p => p.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('on'));
  document.getElementById('tab-' + id).classList.add('on');
  document.querySelector(\`[onclick="showTab('\${id}')"]\`).classList.add('on');
}

// ===== CONNECTION =====
async function testConnection() {
  wpUrl = document.getElementById('wpUrl').value.replace(/\\/$/, '');
  wpUser = document.getElementById('wpUser').value;
  wpPass = document.getElementById('wpPass').value;
  const btn = document.getElementById('btnTest');
  const res = document.getElementById('connResult');
  btn.disabled = true; btn.textContent = 'Connexion en cours...';

  try {
    const r = await wpFetch('/');
    connected = true;
    document.getElementById('statusDot').classList.add('on');
    document.getElementById('statusText').textContent = r.name || 'Connecté';
    res.className = 'cr ok';
    res.innerHTML = '<strong style="color:var(--ok)">Connecté !</strong> Site : ' + (r.name || wpUrl) + '<br>URL : ' + (r.url || wpUrl) + '<br>Utilisateur authentifié avec succès.';
    localStorage.setItem('haroboz_wp', JSON.stringify({ url: wpUrl, user: wpUser }));
  } catch (e) {
    connected = false;
    document.getElementById('statusDot').classList.remove('on');
    document.getElementById('statusText').textContent = 'Erreur';
    res.className = 'cr ko';
    let msg = e.message;
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError')) {
      msg += '<br><br><strong>Conseil CORS :</strong> Si le serveur est en ligne mais bloqué par CORS, installez le plugin WP <code>WP-CORS</code> ou utilisez une extension navigateur "Allow CORS".';
    }
    res.innerHTML = '<strong style="color:var(--ko)">Erreur</strong><br>' + msg;
  }
  btn.disabled = false; btn.textContent = 'Tester la connexion';
}

async function wpFetch(endpoint, options = {}) {
  const url = wpUrl + '/wp-json' + endpoint;
  const r = await fetch(url, {
    ...options,
    headers: {
      'Authorization': 'Basic ' + btoa(wpUser + ':' + wpPass),
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!r.ok) {
    const body = await r.text();
    throw new Error(\`HTTP \${r.status}: \${body.substring(0, 200)}\`);
  }
  return r.json();
}

// ===== PAGE GRID =====
function renderPages() {
  const grid = document.getElementById('pageGrid');
  const silos = [...new Set(PAGES.map(p => p.silo))];

  // Stats
  document.getElementById('pageStats').innerHTML = \`
    <div class="stat"><div class="sv">\${PAGES.length}</div><div class="sl">Pages</div></div>
    <div class="stat"><div class="sv">\${PAGES.reduce((a,p) => a + p.wordCount, 0).toLocaleString()}</div><div class="sl">Mots</div></div>
    <div class="stat"><div class="sv">\${silos.length}</div><div class="sl">Silos</div></div>
    <div class="stat"><div class="sv">\${IMAGES_LIST.length}</div><div class="sl">Images</div></div>
  \`;

  // Filters
  const filtersEl = document.getElementById('siloFilters');
  filtersEl.innerHTML = '<button class="pill on" onclick="filterSilo(null, this)">Tout</button>' +
    silos.map(s => \`<button class="pill" onclick="filterSilo('\${s}', this)">\${s}</button>\`).join('');

  // Grid
  grid.innerHTML = PAGES.map((p, i) => \`
    <div class="pk" data-silo="\${p.silo}" data-idx="\${i}" id="page-\${i}">
      <div class="kh">
        <input type="checkbox" checked data-idx="\${i}">
        <div class="kt">\${p.title}</div>
        <span class="sb pe" id="status-\${i}">En attente</span>
      </div>
      <div class="km">
        <span>slug: \${p.wpSlug || '/'}</span>
        <span>\${p.parentSlug ? 'parent: ' + p.parentSlug : 'racine'}</span>
        <span>\${p.wordCount} mots</span>
      </div>
      <div style="display:flex;gap:6px">
        <button class="btn btn-o btn-sm" onclick="previewPage(\${i})">Aperçu</button>
        <button class="btn btn-o btn-sm" onclick="pushSinglePage(\${i})">Push</button>
      </div>
    </div>
  \`).join('');
}

function filterSilo(silo, btn) {
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('on'));
  btn.classList.add('on');
  document.querySelectorAll('.pk').forEach(card => {
    card.style.display = (!silo || card.dataset.silo === silo) ? '' : 'none';
  });
}

function selectAll(state) {
  document.querySelectorAll('.pk input[type=checkbox]').forEach(cb => {
    if (cb.closest('.pk').style.display !== 'none') cb.checked = state;
  });
}

function previewPage(idx) {
  const p = PAGES[idx];
  const w = window.open('', '_blank');
  w.document.write(\`<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><title>\${p.title}</title>
    <script src="https://cdn.tailwindcss.com"><\\/script>
    <script>tailwind.config={theme:{extend:{colors:{brand:{DEFAULT:'#0a1a3a',light:'#122a5c','50':'#e8edf5'}},fontFamily:{sans:['Inter','sans-serif'],serif:['Playfair Display','serif']}}}}<\\/script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;600&display=swap" rel="stylesheet">
    <script src="https://unpkg.com/lucide@latest"><\\/script>
  </head><body class="bg-gray-50 font-sans text-brand"><main>\${p.mainContent}</main>
  <script>lucide.createIcons()<\\/script></body></html>\`);
}

// ===== MENUS =====
function renderMenus() {
  // Main menu
  const mainTree = document.getElementById('mainMenuTree');
  if (MENUS.main && MENUS.main.items) {
    mainTree.innerHTML = '<ul>' + MENUS.main.items.map(item => renderMenuItem(item)).join('') + '</ul>';
  }

  // Footer
  const footerTree = document.getElementById('footerMenuTree');
  if (MENUS.footer && MENUS.footer.columns) {
    footerTree.innerHTML = '<ul>' + MENUS.footer.columns.map(col => \`
      <li>\${col.title}<ul>\${col.items.map(it => \`<li>\${it.title}</li>\`).join('')}</ul></li>
    \`).join('') + '</ul>';
  }

  document.getElementById('headerHtml').value = HEADER_HTML.substring(0, 5000);
  document.getElementById('footerHtml').value = FOOTER_HTML.substring(0, 5000);
}

function renderMenuItem(item) {
  let html = '<li>' + item.title || item.label;
  if (item.children && item.children.length) {
    html += '<ul>' + item.children.map(c => renderMenuItem(c)).join('') + '</ul>';
  }
  return html + '</li>';
}

async function pushMenu(type) {
  if (!connected) return alert('Connectez-vous d\\'abord');
  const btn = document.getElementById(type === 'main' ? 'btnPushMainMenu' : 'btnPushFooter');
  btn.disabled = true; btn.textContent = 'Push en cours...';

  try {
    // Get existing menus
    let menus;
    try { menus = await wpFetch('/wp/v2/menus'); } catch(e) {
      // Try nav menus endpoint
      try { menus = await wpFetch('/wp/v2/navigation'); } catch(e2) {
        alert('API Menus non disponible. Installez le plugin "WP REST API Menus" ou utilisez WP 5.9+.');
        btn.disabled = false; btn.textContent = type === 'main' ? 'Pousser le menu principal' : 'Pousser le footer';
        return;
      }
    }

    const menuData = type === 'main' ? MENUS.main : MENUS.footer;
    const menuName = type === 'main' ? 'Menu Principal Haroboz' : 'Footer Haroboz';

    // Create or find menu
    let menuId;
    const existing = menus.find(m => m.name === menuName || m.slug === menuName.toLowerCase().replace(/\\s+/g, '-'));
    if (existing) {
      menuId = existing.id;
    } else {
      const created = await wpFetch('/wp/v2/menus', { method: 'POST', body: JSON.stringify({ name: menuName }) });
      menuId = created.id;
    }

    // Delete existing items
    const existingItems = await wpFetch(\`/wp/v2/menu-items?menus=\${menuId}&per_page=100\`);
    for (const item of existingItems) {
      await wpFetch(\`/wp/v2/menu-items/\${item.id}?force=true\`, { method: 'DELETE' });
    }

    // Push new items
    if (type === 'main' && menuData.items) {
      for (const item of menuData.items) {
        const parentItem = await wpFetch('/wp/v2/menu-items', {
          method: 'POST',
          body: JSON.stringify({
            title: item.title || item.label,
            url: wpUrl + (item.url || '/'),
            menus: menuId,
            menu_order: item.order || 0
          })
        });
        if (item.children) {
          for (const child of item.children) {
            await wpFetch('/wp/v2/menu-items', {
              method: 'POST',
              body: JSON.stringify({
                title: child.title || child.label,
                url: wpUrl + (child.url || '/'),
                menus: menuId,
                parent: parentItem.id,
                menu_order: child.order || 0
              })
            });
          }
        }
      }
    }

    alert(menuName + ' mis à jour avec succès !');
  } catch (e) {
    alert('Erreur: ' + e.message);
  }
  btn.disabled = false; btn.textContent = type === 'main' ? 'Pousser le menu principal' : 'Pousser le footer';
}

async function pushHeaderFooterBlocks() {
  if (!connected) return alert('Connectez-vous d\\'abord');
  try {
    // Create reusable blocks (wp_block post type)
    const headerContent = document.getElementById('headerHtml').value;
    const footerContent = document.getElementById('footerHtml').value;

    if (headerContent) {
      await wpFetch('/wp/v2/blocks', {
        method: 'POST',
        body: JSON.stringify({ title: 'Haroboz Header', content: '<!-- wp:html -->' + headerContent + '<!-- /wp:html -->', status: 'publish' })
      });
    }
    if (footerContent) {
      await wpFetch('/wp/v2/blocks', {
        method: 'POST',
        body: JSON.stringify({ title: 'Haroboz Footer', content: '<!-- wp:html -->' + footerContent + '<!-- /wp:html -->', status: 'publish' })
      });
    }
    alert('Blocs Header & Footer créés !');
  } catch(e) { alert('Erreur: ' + e.message); }
}

// ===== MEDIA =====
function renderMedia() {
  document.getElementById('mediaTotal').textContent = IMAGES_LIST.length;
  document.getElementById('mediaPending').textContent = IMAGES_LIST.length;
  document.getElementById('mediaUploaded').textContent = '0';
}

function handleDragOver(e) { e.preventDefault(); e.currentTarget.classList.add('over'); }
function handleDragLeave(e) { e.currentTarget.classList.remove('over'); }
function handleDrop(e) {
  e.preventDefault(); e.currentTarget.classList.remove('over');
  handleFiles(e.dataTransfer.files);
}
function handleFiles(files) {
  uploadedFiles = [...uploadedFiles, ...Array.from(files)];
  const grid = document.getElementById('mediaGrid');
  for (const f of files) {
    const div = document.createElement('div');
    div.className = 'media-item';
    div.innerHTML = \`<img src="\${URL.createObjectURL(f)}" alt="\${f.name}"><div>\${f.name}</div><span class="sb pe">Prêt</span>\`;
    div.dataset.filename = f.name;
    grid.appendChild(div);
  }
}

async function uploadAllMedia() {
  if (!connected) return alert('Connectez-vous d\\'abord');
  if (!uploadedFiles.length) return alert('Aucun fichier sélectionné');
  const btn = document.getElementById('btnUploadMedia');
  btn.disabled = true;
  let done = 0;

  for (const file of uploadedFiles) {
    try {
      const formData = new FormData();
      formData.append('file', file, file.name);
      const r = await fetch(wpUrl + '/wp-json/wp/v2/media', {
        method: 'POST',
        headers: { 'Authorization': 'Basic ' + btoa(wpUser + ':' + wpPass) },
        body: formData
      });
      const data = await r.json();
      if (data.source_url) {
        mediaMap[file.name] = data.source_url;
        const el = document.querySelector(\`[data-filename="\${file.name}"] .sb\`);
        if (el) { el.className = 'sb dn'; el.textContent = 'OK'; }
      }
    } catch(e) {
      const el = document.querySelector(\`[data-filename="\${file.name}"] .sb\`);
      if (el) { el.className = 'sb er'; el.textContent = 'Erreur'; }
    }
    done++;
    document.getElementById('mediaProgress').style.width = (done/uploadedFiles.length*100) + '%';
    document.getElementById('mediaUploaded').textContent = done;
    document.getElementById('mediaPending').textContent = uploadedFiles.length - done;
    await sleep(300);
  }
  btn.disabled = false;
  alert('Upload terminé ! ' + Object.keys(mediaMap).length + ' images uploadées.');
}

function fixImageUrls() {
  let fixed = 0;
  PAGES.forEach(p => {
    for (const [filename, wpMediaUrl] of Object.entries(mediaMap)) {
      if (p.mainContent.includes(filename)) {
        p.mainContent = p.mainContent.split(filename).join(wpMediaUrl);
        fixed++;
      }
    }
  });
  alert(fixed + ' références d\\'images mises à jour dans le contenu.');
}

// ===== PUSH ALL =====
function log(msg, type = '') {
  const el = document.getElementById('pushLog');
  const div = document.createElement('div');
  div.className = 'le ' + type;
  div.textContent = new Date().toLocaleTimeString() + ' — ' + msg;
  el.appendChild(div);
  el.scrollTop = el.scrollHeight;
}

function setStep(step) {
  document.querySelectorAll('.step').forEach(s => {
    if (s.dataset.step === step) s.classList.add('active');
    else s.classList.remove('active');
  });
}
function doneStep(step) {
  document.querySelectorAll('.step').forEach(s => {
    if (s.dataset.step === step) { s.classList.remove('active'); s.classList.add('done'); }
  });
}

function convertContent(html) {
  html = html.replace(/href="\\/pages\\/([^"]+)\\.html"/g, \`href="\${wpUrl}/$1/"\`);
  html = html.replace(/href="\\/pages\\/([^"]+)\\/"/g, \`href="\${wpUrl}/$1/"\`);
  html = html.replace(/href="\\/"/g, \`href="\${wpUrl}/"\`);
  html = html.replace(/src="\\.\\.\\/.\\.\\/img\\//g, \`src="\${wpUrl}/wp-content/uploads/haroboz/\`);
  html = html.replace(/src="\\.\\.\\/img\\//g, \`src="\${wpUrl}/wp-content/uploads/haroboz/\`);
  html = html.replace(/src="\\/img\\//g, \`src="\${wpUrl}/wp-content/uploads/haroboz/\`);
  // Apply media map
  for (const [filename, wpMediaUrl] of Object.entries(mediaMap)) {
    html = html.split(filename).join(wpMediaUrl);
  }
  return html;
}

function togglePublish() {
  publishMode = !publishMode;
  document.getElementById('publishToggle').classList.toggle('on');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function getSelectedIndices() {
  return [...document.querySelectorAll('.pk input[type=checkbox]:checked')].map(cb => parseInt(cb.dataset.idx));
}

async function pushAll() {
  if (!connected) return alert('Connectez-vous d\\'abord');
  if (!confirm('Remplacer TOUT le contenu du site WordPress par les ' + PAGES.length + ' pages du preview ?')) return;

  const btn = document.getElementById('btnPushAll');
  btn.disabled = true;
  document.getElementById('pushLog').innerHTML = '';
  pushResults = { success: [], failed: [], skipped: [] };
  parentIdMap = {};

  const status = publishMode ? 'publish' : 'draft';
  const doMenus = document.getElementById('chkMenus').checked;
  const doSeo = document.getElementById('chkSeo').checked;
  const doReplace = document.getElementById('chkReplace').checked;
  const doHomepage = document.getElementById('chkHomepage').checked;

  // Step 1: Get existing pages
  setStep('cleanup');
  log('Récupération des pages WP existantes...', 'info');
  let existingPages = [];
  try {
    existingPages = await getAllWpPages();
    log(\`\${existingPages.length} pages existantes trouvées\`, 'info');
  } catch(e) { log('Erreur: ' + e.message, 'ko'); }
  doneStep('cleanup');

  // Step 2: Push pages
  setStep('pages');
  let done = 0;
  let homePageId = null;

  for (let i = 0; i < PAGES.length; i++) {
    const p = PAGES[i];
    const content = convertContent(p.mainContent);
    const parentId = p.parentSlug ? (parentIdMap[p.parentSlug] || 0) : 0;
    const title = p.title.split('–')[0].split('|')[0].trim();
    const pageSlug = p.wpSlug || 'accueil';

    updateStatus(i, 'pu', 'Push...');
    log(\`Push: \${p.slug} (\${title})\`);

    try {
      const existing = existingPages.find(ep => ep.slug === pageSlug);
      let result;

      if (existing && doReplace) {
        result = await wpFetch(\`/wp/v2/pages/\${existing.id}\`, {
          method: 'PUT',
          body: JSON.stringify({ title, content, status, parent: parentId })
        });
        log(\`  ✓ Mise à jour #\${result.id}\`, 'ok');
      } else {
        result = await wpFetch('/wp/v2/pages', {
          method: 'POST',
          body: JSON.stringify({ title, content, slug: pageSlug, status, parent: parentId })
        });
        log(\`  ✓ Créée #\${result.id}\`, 'ok');
      }

      if (p.isHome) homePageId = result.id;
      if (!p.parentSlug || p.file.endsWith('index.html')) parentIdMap[p.slug] = result.id;

      // SEO meta
      if (doSeo) {
        try {
          await wpFetch(\`/wp/v2/pages/\${result.id}\`, {
            method: 'PUT',
            body: JSON.stringify({ meta: { _yoast_wpseo_title: p.title, _yoast_wpseo_metadesc: p.metaDesc } })
          });
        } catch(e) {
          try {
            await wpFetch(\`/wp/v2/pages/\${result.id}\`, {
              method: 'PUT',
              body: JSON.stringify({ meta: { rank_math_title: p.title, rank_math_description: p.metaDesc } })
            });
          } catch(e2) {}
        }
      }

      updateStatus(i, 'dn', 'OK');
      pushResults.success.push(p.slug);
    } catch(e) {
      log(\`  ✗ Erreur: \${e.message}\`, 'ko');
      updateStatus(i, 'er', 'Erreur');
      pushResults.failed.push(p.slug);
    }

    done++;
    document.getElementById('pushProgress').style.width = (done/PAGES.length*100) + '%';
    document.getElementById('pushProgressText').textContent = \`\${done}/\${PAGES.length} pages — \${pushResults.success.length} OK, \${pushResults.failed.length} erreurs\`;
    await sleep(500);
  }
  doneStep('pages');

  // Step 3: Menus
  if (doMenus) {
    setStep('menus');
    log('Mise à jour des menus...', 'info');
    try { await pushMenu('main'); log('Menu principal mis à jour', 'ok'); } catch(e) { log('Menu: ' + e.message, 'warn'); }
    doneStep('menus');
  }

  // Step 4: SEO done during page push
  doneStep('seo');

  // Step 5: Set homepage
  setStep('verify');
  if (doHomepage && homePageId) {
    try {
      await wpFetch('/wp/v2/settings', {
        method: 'PUT',
        body: JSON.stringify({ show_on_front: 'page', page_on_front: homePageId })
      });
      log(\`Page d'accueil définie : #\${homePageId}\`, 'ok');
    } catch(e) { log('Homepage setting: ' + e.message, 'warn'); }
  }

  log('', '');
  log(\`TERMINÉ — \${pushResults.success.length} OK, \${pushResults.failed.length} erreurs\`, pushResults.failed.length ? 'warn' : 'ok');
  doneStep('verify');

  btn.disabled = false;
}

async function pushSelected() {
  if (!connected) return alert('Connectez-vous d\\'abord');
  const indices = getSelectedIndices();
  if (!indices.length) return alert('Aucune page sélectionnée');

  document.getElementById('pushLog').innerHTML = '';
  const status = publishMode ? 'publish' : 'draft';
  let existingPages = [];
  try { existingPages = await getAllWpPages(); } catch(e) {}

  let done = 0;
  for (const i of indices) {
    const p = PAGES[i];
    const content = convertContent(p.mainContent);
    const parentId = p.parentSlug ? (parentIdMap[p.parentSlug] || 0) : 0;
    const title = p.title.split('–')[0].split('|')[0].trim();
    const pageSlug = p.wpSlug || 'accueil';

    updateStatus(i, 'pu', 'Push...');
    try {
      const existing = existingPages.find(ep => ep.slug === pageSlug);
      let result;
      if (existing) {
        result = await wpFetch(\`/wp/v2/pages/\${existing.id}\`, { method: 'PUT', body: JSON.stringify({ title, content, status, parent: parentId }) });
      } else {
        result = await wpFetch('/wp/v2/pages', { method: 'POST', body: JSON.stringify({ title, content, slug: pageSlug, status, parent: parentId }) });
      }
      if (!p.parentSlug || p.file.endsWith('index.html')) parentIdMap[p.slug] = result.id;
      updateStatus(i, 'dn', 'OK');
      log(\`✓ \${p.slug} → #\${result.id}\`, 'ok');
    } catch(e) {
      updateStatus(i, 'er', 'Erreur');
      log(\`✗ \${p.slug}: \${e.message}\`, 'ko');
    }
    done++;
    document.getElementById('pushProgress').style.width = (done/indices.length*100) + '%';
    await sleep(500);
  }
}

async function pushSinglePage(idx) {
  if (!connected) return alert('Connectez-vous d\\'abord');
  let existingPages = [];
  try { existingPages = await getAllWpPages(); } catch(e) {}
  const p = PAGES[idx];
  const content = convertContent(p.mainContent);
  const parentId = p.parentSlug ? (parentIdMap[p.parentSlug] || 0) : 0;
  const title = p.title.split('–')[0].split('|')[0].trim();
  const status = publishMode ? 'publish' : 'draft';
  const pageSlug = p.wpSlug || 'accueil';

  updateStatus(idx, 'pu', 'Push...');
  try {
    const existing = existingPages.find(ep => ep.slug === pageSlug);
    let result;
    if (existing) {
      result = await wpFetch(\`/wp/v2/pages/\${existing.id}\`, { method: 'PUT', body: JSON.stringify({ title, content, status, parent: parentId }) });
    } else {
      result = await wpFetch('/wp/v2/pages', { method: 'POST', body: JSON.stringify({ title, content, slug: pageSlug, status, parent: parentId }) });
    }
    if (!p.parentSlug || p.file.endsWith('index.html')) parentIdMap[p.slug] = result.id;
    updateStatus(idx, 'dn', 'OK');
    alert(\`Page "\${p.slug}" pushée avec succès ! (ID: #\${result.id})\`);
  } catch(e) {
    updateStatus(idx, 'er', 'Erreur');
    alert('Erreur: ' + e.message);
  }
}

function retryFailed() {
  const failed = pushResults.failed;
  if (!failed.length) return alert('Aucun échec à relancer');
  pushResults.failed = [];
  for (const slug of failed) {
    const idx = PAGES.findIndex(p => p.slug === slug);
    if (idx >= 0) pushSinglePage(idx);
  }
}

async function getAllWpPages() {
  let all = [], page = 1;
  while (true) {
    const batch = await wpFetch(\`/wp/v2/pages?per_page=100&page=\${page}&status=any\`);
    all = all.concat(batch);
    if (batch.length < 100) break;
    page++;
  }
  return all;
}

async function deleteAllWpPages() {
  if (!connected) return alert('Connectez-vous d\\'abord');
  if (!confirm('ATTENTION : Supprimer TOUTES les pages WordPress ?')) return;
  if (!confirm('Êtes-vous VRAIMENT sûr ? C\\'est irréversible.')) return;
  if (prompt('Tapez "SUPPRIMER" pour confirmer') !== 'SUPPRIMER') return;

  log('Suppression de toutes les pages WP...', 'warn');
  const pages = await getAllWpPages();
  for (const p of pages) {
    try {
      await wpFetch(\`/wp/v2/pages/\${p.id}?force=true\`, { method: 'DELETE' });
      log(\`Supprimée: \${p.slug} (#\${p.id})\`, 'ko');
    } catch(e) { log(\`Erreur suppression #\${p.id}: \${e.message}\`, 'ko'); }
    await sleep(200);
  }
  log(\`\${pages.length} pages supprimées\`, 'warn');
}

function updateStatus(idx, cls, text) {
  const el = document.getElementById('status-' + idx);
  if (el) { el.className = 'sb ' + cls; el.textContent = text; }
}

function exportLog() {
  const log = document.getElementById('pushLog').innerText;
  const data = { date: new Date().toISOString(), results: pushResults, log };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = 'haroboz-push-log-' + new Date().toISOString().slice(0,10) + '.json';
  a.click();
}

// ===== LOAD SAVED STATE =====
try {
  const saved = JSON.parse(localStorage.getItem('haroboz_wp') || '{}');
  if (saved.url) document.getElementById('wpUrl').value = saved.url;
  if (saved.user) document.getElementById('wpUser').value = saved.user;
} catch(e) {}

// ===== INIT =====
renderPages();
renderMenus();
renderMedia();
</script>
</body>
</html>`;

fs.writeFileSync(OUTPUT_FILE, outputHtml);
const stats = fs.statSync(OUTPUT_FILE);
console.log(`\nGenerated: ${OUTPUT_FILE}`);
console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
console.log(`Pages embedded: ${pages.length}`);
