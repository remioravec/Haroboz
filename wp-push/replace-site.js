#!/usr/bin/env node
/**
 * HAROBOZ — Remplacement Complet du Site WordPress (Mode Client-Side)
 *
 * Architecture:
 *   - Serveur Express minimal sur le port 4000
 *   - Lit les 29 pages HTML du dossier preview/ au démarrage
 *   - Sert l'interface web + l'API /api/pages
 *   - TOUS les appels vers WordPress se font depuis le navigateur (CORS)
 *   - Le navigateur du client peut atteindre haroboz.com ; le Codespace ne peut pas
 *
 * Usage: node wp-push/replace-site.js
 * Puis ouvrir http://localhost:4000
 *
 * Prérequis côté WP: haroboz-cors.php dans wp-content/mu-plugins/ (téléchargeable via /api/cors-plugin)
 */

'use strict';

const express = require('express');
const fs      = require('fs');
const path    = require('path');

const app         = express();
const PREVIEW_DIR = path.join(__dirname, '..', 'preview');
const CORS_FILE   = path.join(__dirname, 'haroboz-cors.php');
const PORT        = 4000;

app.use(express.json({ limit: '50mb' }));

// ─────────────────────────────────────────────────────────────
//  HTML helpers (server-side, used to build the page registry)
// ─────────────────────────────────────────────────────────────

function extractTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].trim() : '';
}

function extractMeta(html) {
  const m = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i)
           || html.match(/<meta\s+content=["']([^"']*)["']\s+name=["']description["']/i);
  return m ? m[1].trim() : '';
}

// ─────────────────────────────────────────────────────────────
//  Filesystem scan → page registry
// ─────────────────────────────────────────────────────────────

function findHtmlFiles(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results = results.concat(findHtmlFiles(full));
    } else if (entry.name.endsWith('.html')) {
      results.push(full);
    }
  }
  return results;
}

function buildPageRegistry() {
  const files = findHtmlFiles(PREVIEW_DIR);
  const pages = [];

  for (const fp of files) {
    const rel   = path.relative(PREVIEW_DIR, fp).replace(/\\/g, '/');
    const html  = fs.readFileSync(fp, 'utf-8');
    const parts = rel.split('/');

    let slug, wpSlug, parentSlug, isHome;

    if (rel === 'index.html') {
      // Root homepage
      isHome     = true;
      slug       = 'accueil';
      wpSlug     = '';
      parentSlug = null;
    } else if (parts.length === 2 && parts[0] === 'pages') {
      // Top-level page: pages/contact.html
      isHome     = false;
      slug       = parts[1].replace('.html', '');
      wpSlug     = slug;
      parentSlug = null;
    } else if (parts.length === 3 && parts[2] === 'index.html') {
      // Category index: pages/packs-shooting/index.html
      isHome     = false;
      slug       = parts[1];
      wpSlug     = parts[1];
      parentSlug = null;
    } else if (parts.length === 3) {
      // Child page: pages/packs-shooting/portrait-studio-cannes.html
      isHome     = false;
      slug       = parts[2].replace('.html', '');
      wpSlug     = slug;
      parentSlug = parts[1];
    } else {
      isHome     = false;
      slug       = rel.replace('.html', '').replace(/\//g, '-');
      wpSlug     = slug;
      parentSlug = null;
    }

    pages.push({
      file:       rel,
      slug,
      wpSlug,
      parentSlug,
      isHome,
      title:      extractTitle(html),
      metaDesc:   extractMeta(html),
      html,                          // full raw HTML — client does all processing
    });
  }

  // Sort: home → parent pages (index.html or top-level) → children
  pages.sort((a, b) => {
    if (a.isHome)                     return -1;
    if (b.isHome)                     return  1;
    if (!a.parentSlug && b.parentSlug) return -1;
    if (a.parentSlug && !b.parentSlug) return  1;
    return a.slug.localeCompare(b.slug);
  });

  return pages;
}

const PAGES = buildPageRegistry();
console.log(`${PAGES.length} pages chargées depuis preview/`);

// ─────────────────────────────────────────────────────────────
//  API routes
// ─────────────────────────────────────────────────────────────

// Page registry — includes full HTML so client can process it
app.get('/api/pages', (req, res) => {
  res.json(PAGES.map(p => ({
    file:       p.file,
    slug:       p.slug,
    wpSlug:     p.wpSlug,
    parentSlug: p.parentSlug,
    isHome:     p.isHome,
    title:      p.title,
    metaDesc:   p.metaDesc,
    html:       p.html,
  })));
});

// CORS plugin download as installable .zip for WP admin
app.get('/api/cors-plugin', (req, res) => {
  if (!fs.existsSync(CORS_FILE)) {
    res.status(404).send('haroboz-cors.php introuvable');
    return;
  }
  const phpContent = fs.readFileSync(CORS_FILE);
  const zipBuffer  = buildPluginZip('haroboz-cors', 'haroboz-cors.php', phpContent);
  res.setHeader('Content-Disposition', 'attachment; filename="haroboz-cors.zip"');
  res.setHeader('Content-Type', 'application/zip');
  res.send(zipBuffer);
});

/**
 * Build a minimal ZIP archive containing one file inside a folder.
 * WordPress expects: pluginname/pluginname.php inside the zip.
 * Uses raw ZIP format (no external dependency).
 */
function buildPluginZip(folderName, fileName, fileContent) {
  const fullPath = folderName + '/' + fileName;
  const buf      = Buffer.from(fileContent);
  const crc      = crc32(buf);
  const now      = new Date();

  // DOS date/time encoding
  const dosTime = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)) & 0xFFFF;
  const dosDate = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xFFFF;

  const nameBuffer = Buffer.from(fullPath, 'utf-8');
  const nameLen    = nameBuffer.length;

  // Local file header (30 + nameLen)
  const lfh = Buffer.alloc(30 + nameLen);
  lfh.writeUInt32LE(0x04034b50, 0);   // signature
  lfh.writeUInt16LE(20, 4);           // version needed
  lfh.writeUInt16LE(0, 6);            // flags
  lfh.writeUInt16LE(0, 8);            // compression: stored
  lfh.writeUInt16LE(dosTime, 10);
  lfh.writeUInt16LE(dosDate, 12);
  lfh.writeUInt32LE(crc, 14);
  lfh.writeUInt32LE(buf.length, 18);  // compressed size
  lfh.writeUInt32LE(buf.length, 22);  // uncompressed size
  lfh.writeUInt16LE(nameLen, 26);
  lfh.writeUInt16LE(0, 28);           // extra field length
  nameBuffer.copy(lfh, 30);

  // Central directory header (46 + nameLen)
  const cdOffset = lfh.length + buf.length;
  const cdh = Buffer.alloc(46 + nameLen);
  cdh.writeUInt32LE(0x02014b50, 0);   // signature
  cdh.writeUInt16LE(20, 4);           // version made by
  cdh.writeUInt16LE(20, 6);           // version needed
  cdh.writeUInt16LE(0, 8);            // flags
  cdh.writeUInt16LE(0, 10);           // compression: stored
  cdh.writeUInt16LE(dosTime, 12);
  cdh.writeUInt16LE(dosDate, 14);
  cdh.writeUInt32LE(crc, 16);
  cdh.writeUInt32LE(buf.length, 20);
  cdh.writeUInt32LE(buf.length, 24);
  cdh.writeUInt16LE(nameLen, 28);
  cdh.writeUInt16LE(0, 30);           // extra field length
  cdh.writeUInt16LE(0, 32);           // comment length
  cdh.writeUInt16LE(0, 34);           // disk number
  cdh.writeUInt16LE(0, 36);           // internal attrs
  cdh.writeUInt32LE(0, 38);           // external attrs
  cdh.writeUInt32LE(0, 42);           // local header offset
  nameBuffer.copy(cdh, 46);

  // End of central directory (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);           // disk number
  eocd.writeUInt16LE(0, 6);           // disk with CD
  eocd.writeUInt16LE(1, 8);           // entries on disk
  eocd.writeUInt16LE(1, 10);          // total entries
  eocd.writeUInt32LE(cdh.length, 12); // CD size
  eocd.writeUInt32LE(cdOffset, 16);   // CD offset
  eocd.writeUInt16LE(0, 20);          // comment length

  return Buffer.concat([lfh, buf, cdh, eocd]);
}

/** CRC-32 (ISO 3309) */
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─────────────────────────────────────────────────────────────
//  Web UI
// ─────────────────────────────────────────────────────────────

const UI_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HAROBOZ — Remplacer le Site</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600&display=swap" rel="stylesheet">
<style>
:root {
  --n:    #0a1a3a;
  --nl:   #122a5c;
  --ns:   #0d2248;
  --nd:   #061228;
  --b:    #1e3a5f;
  --g:    #c9a84c;
  --gl:   #e0c777;
  --gd:   #a8873d;
  --ok:   #22c55e;
  --ko:   #ef4444;
  --inf:  #3b82f6;
  --warn: #f59e0b;
  --t:    #e2e8f0;
  --td:   #94a3b8;
  --ts:   #64748b;
}
*, *::before, *::after { margin:0; padding:0; box-sizing:border-box }
body {
  font-family: 'Inter', sans-serif;
  background: var(--n);
  color: var(--t);
  min-height: 100vh;
  line-height: 1.5;
}
h1, h2, h3, .playfair { font-family: 'Playfair Display', serif }

/* ── Layout ── */
.hdr {
  background: var(--nl);
  border-bottom: 1px solid var(--b);
  padding: 14px 0;
  position: sticky;
  top: 0;
  z-index: 100;
}
.hdr .inner {
  max-width: 1040px;
  margin: 0 auto;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.hdr h1 { font-size: 1.15rem; color: var(--g); letter-spacing: .02em }
.hdr h1 span { font-family: Inter; font-weight: 400; font-size: .72rem; color: var(--td); margin-left: 10px }
.conn-badge {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: .75rem;
  color: var(--td);
}
.dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: var(--ko);
  flex-shrink: 0;
  transition: background .3s;
}
.dot.on { background: var(--ok) }

.wrap { max-width: 1040px; margin: 0 auto; padding: 24px 20px }

/* ── Cards ── */
.card {
  background: var(--ns);
  border: 1px solid var(--b);
  border-radius: 10px;
  padding: 20px;
  margin-bottom: 18px;
}
.card-title {
  font-size: .95rem;
  color: var(--g);
  margin-bottom: 14px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.card-title .step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--g);
  color: var(--n);
  font-family: Inter;
  font-size: .7rem;
  font-weight: 700;
  flex-shrink: 0;
}

/* ── Forms ── */
.fg { margin-bottom: 12px }
.fg label {
  display: block;
  font-size: .68rem;
  font-weight: 600;
  color: var(--td);
  text-transform: uppercase;
  letter-spacing: .06em;
  margin-bottom: 4px;
}
.fg input {
  width: 100%;
  padding: 9px 12px;
  background: var(--nd);
  border: 1px solid var(--b);
  border-radius: 6px;
  color: var(--t);
  font-size: .85rem;
  font-family: Inter;
  transition: border-color .2s;
}
.fg input:focus { outline: none; border-color: var(--g) }
.fg input::placeholder { color: var(--ts) }
.row2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px }

/* ── Buttons ── */
.btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 18px;
  border: none;
  border-radius: 7px;
  font-weight: 600;
  font-size: .8rem;
  cursor: pointer;
  transition: all .2s;
  font-family: Inter;
  white-space: nowrap;
}
.btn:disabled { opacity: .45; cursor: not-allowed }
.btn-gold   { background: var(--g);  color: var(--n) }
.btn-gold:hover:not(:disabled)   { background: var(--gl) }
.btn-ghost  { background: transparent; border: 1px solid var(--b); color: var(--t) }
.btn-ghost:hover:not(:disabled)  { border-color: var(--g); color: var(--g) }
.btn-danger { background: var(--ko); color: #fff }
.btn-danger:hover:not(:disabled) { background: #dc2626 }
.btn-big    { padding: 13px 28px; font-size: .95rem }
.btn-sm     { padding: 6px 12px; font-size: .72rem }

/* ── Alerts ── */
.alert {
  display: none;
  padding: 11px 14px;
  border-radius: 7px;
  font-size: .8rem;
  margin-top: 10px;
  line-height: 1.5;
}
.alert.show  { display: block }
.alert.ok   { background: rgba(34,197,94,.08);  border: 1px solid rgba(34,197,94,.4);  color: var(--ok) }
.alert.ko   { background: rgba(239,68,68,.08);  border: 1px solid rgba(239,68,68,.4);  color: #fca5a5 }
.alert.info { background: rgba(59,130,246,.08); border: 1px solid rgba(59,130,246,.4); color: #93c5fd }
.alert.warn { background: rgba(201,168,76,.08); border: 1px solid rgba(201,168,76,.4); color: var(--gl) }

/* ── CORS notice ── */
.cors-notice {
  display: none;
  background: rgba(201,168,76,.06);
  border: 1px solid var(--gd);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 18px;
}
.cors-notice h3 { font-size: .82rem; color: var(--g); margin-bottom: 8px }
.cors-notice p  { font-size: .77rem; color: var(--td); line-height: 1.65 }
.cors-notice code {
  background: var(--nd);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: .72rem;
  color: var(--t);
}
.cors-notice a  { color: var(--g); text-decoration: underline; cursor: pointer }

/* ── Stats grid ── */
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 16px;
}
.stat {
  background: var(--nd);
  border: 1px solid var(--b);
  border-radius: 8px;
  padding: 12px 10px;
  text-align: center;
}
.stat b {
  display: block;
  font-size: 1.5rem;
  color: var(--g);
  font-family: 'Playfair Display', serif;
  line-height: 1.2;
}
.stat.ok b { color: var(--ok) }
.stat.ko b { color: var(--ko) }
.stat small {
  font-size: .6rem;
  color: var(--td);
  text-transform: uppercase;
  letter-spacing: .05em;
}

/* ── Checkboxes ── */
.opt {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: .8rem;
  color: var(--td);
  margin-bottom: 8px;
  cursor: pointer;
}
.opt input[type="checkbox"] { accent-color: var(--g); width: 14px; height: 14px; cursor: pointer }

/* ── Progress ── */
.pb-wrap { margin: 12px 0 4px }
.pb-track {
  width: 100%;
  height: 7px;
  background: var(--nd);
  border-radius: 4px;
  overflow: hidden;
}
.pb-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--g), var(--gl));
  border-radius: 4px;
  width: 0;
  transition: width .35s ease;
}
.pb-label { font-size: .75rem; color: var(--td); margin-top: 5px }

/* ── Log ── */
.log-box {
  background: #030b18;
  border: 1px solid var(--b);
  border-radius: 7px;
  padding: 12px 14px;
  max-height: 420px;
  overflow-y: auto;
  font-family: 'Courier New', monospace;
  font-size: .72rem;
  line-height: 1.75;
  scroll-behavior: smooth;
}
.le        { padding: 0 }
.le.ok   { color: var(--ok) }
.le.ko   { color: #fca5a5 }
.le.info { color: #93c5fd }
.le.warn { color: var(--gl) }
.le.muted{ color: var(--ts) }

/* ── Dividers ── */
hr { border: none; border-top: 1px solid var(--b); margin: 16px 0 }

/* ── Danger card ── */
.card.danger {
  border-color: rgba(239,68,68,.35);
  background: rgba(239,68,68,.03);
}

/* ── Actions row ── */
.actions { display: flex; gap: 10px; flex-wrap: wrap; align-items: center }

/* ── Media status ── */
.media-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  background: var(--nd);
  border: 1px solid var(--b);
  border-radius: 20px;
  font-size: .73rem;
  color: var(--td);
}
.media-badge b { color: var(--g) }

@media (max-width: 640px) {
  .row2  { grid-template-columns: 1fr }
  .stats { grid-template-columns: 1fr 1fr }
  .btn-big { width: 100% }
}
</style>
</head>
<body>

<!-- ═══════════════════════ HEADER ═══════════════════════ -->
<header class="hdr">
  <div class="inner">
    <h1>HAROBOZ <span>Remplacer le Site</span></h1>
    <div class="conn-badge">
      <div class="dot" id="dot"></div>
      <span id="connLabel">Non connecté</span>
    </div>
  </div>
</header>

<div class="wrap">

<!-- ─── CORS NOTICE ─── -->
<div class="cors-notice" id="corsNotice">
  <h3>⚠ Plugin CORS requis</h3>
  <p>
    Le navigateur ne peut pas interroger l'API WordPress sans les bons en-têtes CORS.<br>
    <strong>Installation en 3 clics :</strong>
  </p>
  <ol style="margin:8px 0 8px 18px;font-size:.78rem;line-height:1.8;color:var(--t)">
    <li><a href="/api/cors-plugin" style="color:var(--g);font-weight:600;text-decoration:underline;cursor:pointer">Télécharger haroboz-cors.zip</a></li>
    <li>Dans WP Admin → <b>Extensions → Ajouter → Téléverser une extension</b> → choisir le .zip → Installer</li>
    <li><b>Activer</b> le plugin, puis revenir ici et retester la connexion</li>
  </ol>
  <p style="color:var(--ko);font-size:.7rem;margin-top:4px">⚠ Désactivez et supprimez ce plugin une fois le push terminé.</p>
</div>

<!-- ─── STEP 1 : CONNECTION ─── -->
<div class="card">
  <div class="card-title"><span class="step-num">1</span> Connexion WordPress</div>
  <div class="fg">
    <label>URL du site</label>
    <input id="wpUrl" value="https://haroboz.com" placeholder="https://haroboz.com">
  </div>
  <div class="row2">
    <div class="fg">
      <label>Utilisateur</label>
      <input id="wpUser" value="admin" placeholder="admin">
    </div>
    <div class="fg">
      <label>Mot de passe application</label>
      <input id="wpPass" type="password" placeholder="xxxx xxxx xxxx xxxx xxxx xxxx">
    </div>
  </div>
  <button class="btn btn-gold" id="btnTest" onclick="testConn()">Tester la connexion</button>
  <div class="alert" id="connAlert"></div>
</div>

<!-- ─── STEP 2 : MEDIA SCAN ─── -->
<div class="card">
  <div class="card-title"><span class="step-num">2</span> Scanner les images existantes</div>
  <p style="font-size:.8rem;color:var(--td);margin-bottom:12px">
    Récupère toutes les images déjà présentes dans la médiathèque WordPress.
    Les chemins <code style="font-size:.7rem;background:var(--nd);padding:1px 5px;border-radius:3px">/img/…</code>
    seront automatiquement remplacés par les URLs WP correspondantes.
  </p>
  <div class="actions">
    <button class="btn btn-gold" id="btnMedia" onclick="scanMedia()">Scanner la médiathèque WP</button>
    <div class="media-badge" id="mediaBadge" style="display:none">
      <span>🖼</span><b id="mediaCount">0</b> images trouvées
    </div>
  </div>
  <div class="alert" id="mediaAlert"></div>
</div>

<!-- ─── STEP 3 : PUSH ─── -->
<div class="card">
  <div class="card-title"><span class="step-num">3</span> Remplacer le site</div>

  <div class="stats">
    <div class="stat">
      <b id="nPages">${PAGES.length}</b>
      <small>Pages</small>
    </div>
    <div class="stat">
      <b id="nMedia">0</b>
      <small>Images mappées</small>
    </div>
    <div class="stat ok">
      <b id="nOk">0</b>
      <small>Succès</small>
    </div>
    <div class="stat ko">
      <b id="nKo">0</b>
      <small>Erreurs</small>
    </div>
  </div>

  <label class="opt"><input type="checkbox" id="optPub"> Publier directement (sinon brouillon)</label>
  <label class="opt"><input type="checkbox" id="optSeo" checked> Mettre à jour meta SEO (Yoast / RankMath)</label>
  <label class="opt"><input type="checkbox" id="optHome" checked> Définir la page d'accueil</label>
  <label class="opt"><input type="checkbox" id="optClean"> Nettoyer les anciennes pages WP avant push</label>

  <hr>

  <div class="actions">
    <button class="btn btn-gold btn-big" id="btnPush" onclick="pushAll()">
      REMPLACER TOUT LE SITE
    </button>
    <button class="btn btn-ghost" id="btnRetry" onclick="retryFailed()">
      Relancer les échecs
    </button>
  </div>

  <div class="pb-wrap">
    <div class="pb-track"><div class="pb-fill" id="pbFill"></div></div>
    <div class="pb-label" id="pbLabel">En attente…</div>
  </div>
</div>

<!-- ─── STEP 4 : LOG ─── -->
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
    <div class="card-title" style="margin-bottom:0"><span class="step-num">4</span> Journal en temps réel</div>
    <button class="btn btn-ghost btn-sm" onclick="exportLog()">Exporter .log</button>
  </div>
  <div class="log-box" id="logBox">
    <div class="le info">Prêt — Connectez-vous d'abord, puis cliquez sur "Remplacer tout le site".</div>
  </div>
</div>

<!-- ─── DANGER ZONE ─── -->
<div class="card danger">
  <div style="font-size:.8rem;font-weight:600;color:var(--ko);margin-bottom:10px">Zone dangereuse</div>
  <button class="btn btn-danger btn-sm" onclick="deleteAllPages()">Supprimer toutes les pages WP</button>
</div>

</div><!-- /wrap -->

<script>
/* ================================================================
   STATE
================================================================ */
let wpUrl    = '';
let wpUser   = '';
let wpPass   = '';
let connected = false;

let mediaMap  = {};   // filename (lowercase) → WP media URL
let parentMap = {};   // slug → WP page ID (built during push)
let failedPages = []; // pages that failed during last push
let allPages  = [];
let pushRunning = false;

const results = { ok: 0, ko: 0 };

/* ================================================================
   LOGGING
================================================================ */
function log(msg, type = '') {
  const box = document.getElementById('logBox');
  const el  = document.createElement('div');
  el.className = 'le ' + type;
  const ts = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  el.textContent = ts + '  ' + msg;
  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
}

function exportLog() {
  const text = Array.from(document.querySelectorAll('#logBox .le'))
    .map(el => el.textContent).join('\\n');
  const b = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(b);
  a.download = 'haroboz-push-' + new Date().toISOString().slice(0,19).replace(/:/g,'-') + '.log';
  a.click();
}

/* ================================================================
   ALERTS
================================================================ */
function showAlert(id, type, html) {
  const el = document.getElementById(id);
  el.className = 'alert show ' + type;
  el.innerHTML = html;
}

function hideAlert(id) {
  const el = document.getElementById(id);
  el.className = 'alert';
  el.innerHTML = '';
}

/* ================================================================
   WP FETCH — client-side call to WP REST API
================================================================ */
async function wpFetch(endpoint, method = 'GET', body = null) {
  const url  = wpUrl + '/wp-json' + endpoint;
  const auth = 'Basic ' + btoa(wpUser + ':' + wpPass);
  const opts = {
    method,
    headers: {
      'Authorization': auth,
      'Content-Type': 'application/json',
    },
  };
  if (body !== null) opts.body = JSON.stringify(body);

  try {
    const resp = await fetch(url, opts);
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error('WP ' + resp.status + ': ' + txt.substring(0, 300));
    }
    if (resp.status === 204) return {};
    return await resp.json();
  } catch (e) {
    if (e instanceof TypeError && e.message.includes('Failed to fetch')) {
      throw new Error('CORS bloqué — Installez haroboz-cors.php dans wp-content/mu-plugins/ (voir ci-dessus)');
    }
    throw e;
  }
}

/* ================================================================
   STEP 1 — CONNEXION
================================================================ */
async function testConn() {
  wpUrl  = document.getElementById('wpUrl').value.replace(/\\/+$/, '');
  wpUser = document.getElementById('wpUser').value.trim();
  wpPass = document.getElementById('wpPass').value.trim();

  if (!wpUrl || !wpUser || !wpPass) {
    showAlert('connAlert', 'ko', 'Tous les champs sont requis.');
    return;
  }

  const btn = document.getElementById('btnTest');
  btn.disabled = true;
  showAlert('connAlert', 'info', 'Connexion en cours…');
  document.getElementById('corsNotice').style.display = 'none';

  try {
    log('Connexion à ' + wpUrl + '…', 'info');
    const data = await wpFetch('/');
    connected = true;
    document.getElementById('dot').classList.add('on');
    document.getElementById('connLabel').textContent = data.name || wpUrl;
    showAlert('connAlert', 'ok', '<b>Connecté !</b> ' + (data.name || wpUrl) + ' — WP ' + (data.gmt_offset !== undefined ? '(REST OK)' : ''));
    log('Connecté à "' + (data.name || wpUrl) + '"', 'ok');
  } catch (e) {
    connected = false;
    document.getElementById('dot').classList.remove('on');
    showAlert('connAlert', 'ko', 'Erreur : ' + e.message);
    log('Échec connexion : ' + e.message, 'ko');
    if (e.message.includes('CORS')) {
      document.getElementById('corsNotice').style.display = 'block';
    }
  } finally {
    btn.disabled = false;
  }
}

/* ================================================================
   STEP 2 — MEDIA SCAN
================================================================ */
async function scanMedia() {
  if (!connected) { alert('Connectez-vous d\\'abord (étape 1).'); return; }

  const btn = document.getElementById('btnMedia');
  btn.disabled = true;
  showAlert('mediaAlert', 'info', 'Scan en cours…');
  log('Récupération de la médiathèque WP…', 'info');

  try {
    let all = [];
    let page = 1;
    while (true) {
      const batch = await wpFetch('/wp/v2/media?per_page=100&page=' + page);
      if (!Array.isArray(batch) || batch.length === 0) break;
      all = all.concat(batch);
      log('  Page ' + page + ' : ' + batch.length + ' images', 'muted');
      if (batch.length < 100) break;
      page++;
    }

    // Build map: filename (original + lowercase) → WP URL
    mediaMap = {};
    for (const item of all) {
      const rawUrl  = item.source_url || '';
      const filename = rawUrl.split('/').pop();
      if (filename) {
        mediaMap[filename]            = rawUrl;
        mediaMap[filename.toLowerCase()] = rawUrl;
      }
    }

    const count = all.length;
    document.getElementById('nMedia').textContent    = count;
    document.getElementById('mediaCount').textContent = count;
    document.getElementById('mediaBadge').style.display = 'inline-flex';

    showAlert('mediaAlert', 'ok', '<b>' + count + ' images trouvées.</b> Les chemins /img/… seront remplacés automatiquement.');
    log(count + ' images indexées depuis la médiathèque WP.', 'ok');
  } catch (e) {
    showAlert('mediaAlert', 'ko', 'Erreur : ' + e.message);
    log('Erreur scan media : ' + e.message, 'ko');
  }

  btn.disabled = false;
}

/* ================================================================
   CONTENT PROCESSING — runs in browser
================================================================ */

// CSS injected at top of every WP page to hide the theme
const HIDE_WP_CSS = \`
/* ── Haroboz: Hide WP theme ── */
#wpadminbar { display: none !important }
html { margin-top: 0 !important }
.site-header, #masthead, .wp-site-blocks > header:first-child,
.site-footer, #colophon, .wp-site-blocks > footer:last-child,
.sidebar, .widget-area, #secondary,
.entry-header, .page-header, .entry-footer,
.post-navigation, .nav-links, .entry-meta,
.cat-links, .tags-links, .edit-link,
.comments-area, #comments,
.wp-block-template-part { display: none !important }
body, html, .site, .site-content, .content-area, .site-main,
.entry-content, .page-content, .wp-site-blocks,
.wp-block-post-content, .has-global-padding {
  max-width: 100% !important; width: 100% !important;
  padding: 0 !important; margin: 0 !important;
}
.entry-content > *, .wp-block-post-content > * {
  max-width: 100% !important;
  margin-left: 0 !important; margin-right: 0 !important;
}
.haroboz-page {
  position: relative; z-index: 10;
  font-family: 'Inter', sans-serif;
}
\`;

/**
 * Rewrite internal preview links to live WP URLs.
 * /pages/category/page.html → https://haroboz.com/category/page/
 */
function rewriteLinks(html, siteUrl) {
  // Category index via /pages/category/ (trailing slash)
  html = html.replace(/href="\\/pages\\/([^"\\/]+)\\/"/g,
    (_, cat) => 'href="' + siteUrl + '/' + cat + '/"');

  // Category index via /pages/category/index.html
  html = html.replace(/href="\\/pages\\/([^"\\/]+)\\/index\\.html"/g,
    (_, cat) => 'href="' + siteUrl + '/' + cat + '/"');

  // Child page: /pages/category/page.html
  html = html.replace(/href="\\/pages\\/([^"\\/]+)\\/([^"]+)\\.html"/g,
    (_, cat, pg) => 'href="' + siteUrl + '/' + cat + '/' + pg + '/"');

  // Top-level page: /pages/page.html
  html = html.replace(/href="\\/pages\\/([^"\\/]+)\\.html"/g,
    (_, pg) => 'href="' + siteUrl + '/' + pg + '/"');

  // Homepage
  html = html.replace(/href="\\/"/g, 'href="' + siteUrl + '/"');

  return html;
}

/**
 * Rewrite /img/filename.ext → WP media library URL (if found).
 * Leaves https://haroboz.com/wp-content/... URLs unchanged.
 */
function rewriteImages(html, mMap) {
  if (!mMap || Object.keys(mMap).length === 0) return html;

  // src="/img/…"
  html = html.replace(/src="\\/img\\/([^"]+)"/g, (match, filename) => {
    const wpUrl = mMap[filename] || mMap[filename.toLowerCase()];
    return wpUrl ? 'src="' + wpUrl + '"' : match;
  });

  // background-image: url(/img/…)
  html = html.replace(/url\\(\\/img\\/([^)]+)\\)/g, (match, filename) => {
    const wpUrl = mMap[filename] || mMap[filename.toLowerCase()];
    return wpUrl ? 'url(' + wpUrl + ')' : match;
  });

  // srcset="/img/…"
  html = html.replace(/srcset="\\/img\\/([^"]+)"/g, (match, filename) => {
    const wpUrl = mMap[filename] || mMap[filename.toLowerCase()];
    return wpUrl ? 'srcset="' + wpUrl + '"' : match;
  });

  return html;
}

/**
 * Extract the text between <body…> and </body>.
 */
function extractBody(rawHtml) {
  const m = rawHtml.match(/<body[^>]*>([\\s\\S]*)<\\/body>/i);
  return m ? m[1].trim() : rawHtml;
}

/**
 * Extract all <style>…</style> blocks (joined).
 */
function extractStyles(rawHtml) {
  const blocks = [];
  const re = /<style[^>]*>([\\s\\S]*?)<\\/style>/gi;
  let m;
  while ((m = re.exec(rawHtml)) !== null) blocks.push(m[1]);
  return blocks.join('\\n');
}

/**
 * Extract all inline <script> blocks (no src=, not tailwind.config).
 */
function extractScripts(rawHtml) {
  const blocks = [];
  const re = /<script(?![^>]*\\bsrc=)[^>]*>([\\s\\S]*?)<\\/script>/gi;
  let m;
  while ((m = re.exec(rawHtml)) !== null) {
    const content = m[1].trim();
    if (content && !content.trimStart().startsWith('tailwind.config')) {
      blocks.push(content);
    }
  }
  return blocks.join('\\n');
}

/**
 * Build the full WP page content field from a raw preview HTML file.
 * Result: CDN deps + hide-WP CSS + page styles + body + page scripts.
 */
function buildWpContent(page, siteUrl, mMap) {
  // 1. Start from full raw HTML
  let html = page.html;

  // 2. Rewrite links and images
  html = rewriteLinks(html, siteUrl);
  html = rewriteImages(html, mMap);

  // 3. Extract parts
  const bodyContent = extractBody(html);
  const pageStyles  = extractStyles(html);
  const pageScripts = extractScripts(html);

  // 4. Assemble WP content wrapper
  //    Note: <\/script> escaping prevents early string termination
  const fullContent =
    '<scr' + 'ipt src="https://cdn.tailwindcss.com"></scr' + 'ipt>\\n' +
    '<scr' + 'ipt>\\n' +
    'tailwind.config = {\\n' +
    '  theme: {\\n' +
    '    extend: {\\n' +
    '      colors: {\\n' +
    '        brand: { DEFAULT: \\'#0a1a3a\\', light: \\'#122a5c\\', 50: \\'#e8edf5\\' }\\n' +
    '      },\\n' +
    '      fontFamily: {\\n' +
    '        sans: [\\'Inter\\', \\'sans-serif\\'],\\n' +
    '        serif: [\\'Playfair Display\\', \\'serif\\']\\n' +
    '      }\\n' +
    '    }\\n' +
    '  }\\n' +
    '}\\n' +
    '</scr' + 'ipt>\\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">\\n' +
    '<scr' + 'ipt src="https://unpkg.com/lucide@latest"></scr' + 'ipt>\\n' +
    '<style>\\n' + HIDE_WP_CSS + '\\n' + pageStyles + '\\n</style>\\n' +
    '<div class="haroboz-page">\\n' + bodyContent + '\\n</div>\\n' +
    (pageScripts ? (
      '<scr' + 'ipt>\\n' +
      '(function(){\\n' +
      'function initLucide(){if(window.lucide){try{lucide.createIcons();}catch(e){}}}\\n' +
      'initLucide();\\n' +
      'window.addEventListener(\\'load\\', initLucide);\\n' +
      pageScripts + '\\n' +
      '})();\\n' +
      '</scr' + 'ipt>'
    ) : '');

  return fullContent;
}

/* ================================================================
   PUSH HELPERS
================================================================ */

async function pushOnePage(page, siteUrl, status) {
  const wpContent  = buildWpContent(page, siteUrl, mediaMap);
  const parentId   = (page.parentSlug && parentMap[page.parentSlug]) ? parentMap[page.parentSlug] : 0;
  const fullTitle  = page.title;   // full SEO title — do NOT truncate
  const slug       = page.wpSlug || 'accueil';

  // Check if page already exists
  let existing = null;
  if (slug) {
    try {
      const ex = await wpFetch('/wp/v2/pages?slug=' + encodeURIComponent(slug) + '&status=any');
      if (Array.isArray(ex) && ex.length > 0) existing = ex[0];
    } catch(_) {}
  }

  let result;
  if (existing) {
    result = await wpFetch('/wp/v2/pages/' + existing.id, 'PUT', {
      title:   fullTitle,
      content: wpContent,
      status,
      parent:  parentId,
    });
  } else {
    result = await wpFetch('/wp/v2/pages', 'POST', {
      title:   fullTitle,
      content: wpContent,
      slug,
      status,
      parent:  parentId,
    });
  }

  // Update SEO meta (Yoast first, then RankMath)
  if (document.getElementById('optSeo').checked) {
    try {
      await wpFetch('/wp/v2/pages/' + result.id, 'PUT', {
        meta: {
          _yoast_wpseo_title:    page.title,
          _yoast_wpseo_metadesc: page.metaDesc,
        }
      });
    } catch(_) {
      try {
        await wpFetch('/wp/v2/pages/' + result.id, 'PUT', {
          meta: {
            rank_math_title:       page.title,
            rank_math_description: page.metaDesc,
          }
        });
      } catch(_2) {
        // SEO plugin not available — not fatal
      }
    }
  }

  // Record parent mapping
  if (!page.parentSlug || page.file.endsWith('index.html')) {
    parentMap[page.slug] = result.id;
  }

  return result;
}

function updateProgress(done, total) {
  const pct = total ? Math.round(done / total * 100) : 0;
  document.getElementById('pbFill').style.width  = pct + '%';
  document.getElementById('pbLabel').textContent  =
    done + '/' + total + ' — ' + results.ok + ' OK, ' + results.ko + ' erreurs';
  document.getElementById('nOk').textContent = results.ok;
  document.getElementById('nKo').textContent = results.ko;
}

/* ================================================================
   STEP 3 — PUSH ALL
================================================================ */
async function pushAll() {
  if (!connected) { alert('Connectez-vous d\\'abord (étape 1).'); return; }
  if (pushRunning) return;
  if (!confirm('Remplacer TOUT le site WordPress ?\\n\\nCette action modifie / crée ' + allPages.length + ' pages.')) return;

  pushRunning = true;
  const btn = document.getElementById('btnPush');
  btn.disabled = true;

  // Reset UI
  document.getElementById('logBox').innerHTML = '';
  results.ok = 0;
  results.ko = 0;
  parentMap  = {};
  failedPages = [];

  const status   = document.getElementById('optPub').checked ? 'publish' : 'draft';
  const siteUrl  = document.getElementById('wpUrl').value.replace(/\\/+$/, '');
  let   homeId   = null;

  log('Chargement des pages depuis le serveur…', 'info');

  try {
    const resp = await fetch('/api/pages');
    allPages = await resp.json();
  } catch (e) {
    log('Impossible de charger /api/pages : ' + e.message, 'ko');
    btn.disabled = false;
    pushRunning = false;
    return;
  }

  log(allPages.length + ' pages chargées. Début du push (' + status + ')…', 'info');
  document.getElementById('nPages').textContent = allPages.length;

  // Optional: clean old WP pages first
  if (document.getElementById('optClean').checked) {
    log('Nettoyage des anciennes pages…', 'warn');
    await cleanOldPages(allPages);
    parentMap = {}; // reset after deletion
  }

  for (let i = 0; i < allPages.length; i++) {
    const page = allPages[i];
    const label = page.slug + ' — ' + page.title.substring(0, 50);
    log('Push [' + (i + 1) + '/' + allPages.length + '] ' + label + '…');

    try {
      const result = await pushOnePage(page, siteUrl, status);
      log('  ✓ ' + (result.link || '#' + result.id), 'ok');
      results.ok++;
      if (page.isHome) homeId = result.id;
    } catch (e) {
      log('  ✗ ' + e.message, 'ko');
      results.ko++;
      failedPages.push(page);
    }

    updateProgress(i + 1, allPages.length);
    // Yield to keep UI responsive
    await new Promise(r => setTimeout(r, 0));
  }

  // Set homepage
  if (document.getElementById('optHome').checked && homeId) {
    log('Définition de la page d\\'accueil (ID #' + homeId + ')…', 'info');
    try {
      await wpFetch('/wp/v2/settings', 'PUT', {
        show_on_front: 'page',
        page_on_front: homeId,
      });
      log('Page d\\'accueil définie.', 'ok');
    } catch (e) {
      log('Impossible de définir la page d\\'accueil : ' + e.message, 'ko');
    }
  }

  // Final summary
  log('', 'muted');
  const summary = 'TERMINÉ — ' + results.ok + ' OK, ' + results.ko + ' erreur' + (results.ko > 1 ? 's' : '');
  log(summary, results.ko > 0 ? 'warn' : 'ok');

  btn.disabled = false;
  pushRunning  = false;
}

/* ================================================================
   RETRY FAILED
================================================================ */
async function retryFailed() {
  if (!connected) { alert('Connectez-vous d\\'abord.'); return; }
  if (!failedPages.length) { alert('Aucune page en échec à relancer.'); return; }
  if (pushRunning) return;

  pushRunning = true;
  const btn    = document.getElementById('btnRetry');
  btn.disabled = true;

  const siteUrl = document.getElementById('wpUrl').value.replace(/\\/+$/, '');
  const status  = document.getElementById('optPub').checked ? 'publish' : 'draft';
  const toRetry = failedPages.slice();
  failedPages   = [];

  log('Relance de ' + toRetry.length + ' page(s) en échec…', 'warn');

  for (let i = 0; i < toRetry.length; i++) {
    const page  = toRetry[i];
    log('Retry [' + (i + 1) + '/' + toRetry.length + '] ' + page.slug + '…');
    try {
      const result = await pushOnePage(page, siteUrl, status);
      log('  ✓ ' + (result.link || '#' + result.id), 'ok');
      results.ok++;
      results.ko = Math.max(0, results.ko - 1);
    } catch (e) {
      log('  ✗ ' + e.message, 'ko');
      failedPages.push(page);
    }
    document.getElementById('nOk').textContent = results.ok;
    document.getElementById('nKo').textContent = results.ko;
    await new Promise(r => setTimeout(r, 0));
  }

  log('Retry terminé — ' + failedPages.length + ' encore en échec.', failedPages.length ? 'warn' : 'ok');
  btn.disabled = false;
  pushRunning  = false;
}

/* ================================================================
   CLEAN OLD PAGES
================================================================ */
async function cleanOldPages(pages) {
  const slugsToDelete = new Set(pages.map(p => p.wpSlug).filter(Boolean));
  let deleted = 0;
  for (const slug of slugsToDelete) {
    try {
      const ex = await wpFetch('/wp/v2/pages?slug=' + encodeURIComponent(slug) + '&status=any');
      for (const p of (Array.isArray(ex) ? ex : [])) {
        await wpFetch('/wp/v2/pages/' + p.id + '?force=true', 'DELETE');
        deleted++;
      }
    } catch(_) {}
  }
  log('  ' + deleted + ' ancienne(s) page(s) supprimée(s).', 'warn');
}

/* ================================================================
   DANGER ZONE
================================================================ */
async function deleteAllPages() {
  if (!connected) { alert('Connectez-vous d\\'abord.'); return; }
  if (!confirm('⚠ ATTENTION — Supprimer TOUTES les pages WordPress ?\\n\\nCette action est IRRÉVERSIBLE.')) return;
  const confirmation = prompt('Tapez SUPPRIMER pour confirmer la suppression totale :');
  if (confirmation !== 'SUPPRIMER') { alert('Annulé.'); return; }

  log('Suppression de toutes les pages WP en cours…', 'warn');

  try {
    let all = [];
    let page = 1;
    while (true) {
      const batch = await wpFetch('/wp/v2/pages?per_page=100&page=' + page + '&status=any');
      if (!Array.isArray(batch) || batch.length === 0) break;
      all = all.concat(batch);
      if (batch.length < 100) break;
      page++;
    }

    let deleted = 0;
    for (const p of all) {
      try {
        await wpFetch('/wp/v2/pages/' + p.id + '?force=true', 'DELETE');
        deleted++;
        log('  Supprimé : ' + (p.slug || '#' + p.id), 'warn');
      } catch (e) {
        log('  Échec suppression #' + p.id + ' : ' + e.message, 'ko');
      }
    }
    log(deleted + '/' + all.length + ' pages supprimées.', 'warn');
  } catch (e) {
    log('Erreur : ' + e.message, 'ko');
  }
}
</script>
</body>
</html>`;

app.get('/', (req, res) => {
  res.send(UI_HTML);
});

// ─────────────────────────────────────────────────────────────
//  Start
// ─────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  const pad = n => String(n).padEnd(3);
  console.log('\n╔═════════════════════════════════════════════════╗');
  console.log('║  HAROBOZ — Remplacement du Site WordPress        ║');
  console.log('╠═════════════════════════════════════════════════╣');
  console.log(`║  ${pad(PAGES.length)} pages prêtes depuis preview/               ║`);
  console.log(`║  Interface : http://localhost:${PORT}                 ║`);
  console.log('╚═════════════════════════════════════════════════╝\n');
});
