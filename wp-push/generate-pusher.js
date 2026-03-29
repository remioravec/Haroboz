const fs = require('fs');
const path = require('path');

const previewDir = path.join(__dirname, '..', 'preview');

// ===== 1. COLLECT ALL HTML FILES =====
const files = [];
function walk(dir) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, f.name);
    if (f.isDirectory()) walk(fp);
    else if (f.name.endsWith('.html')) files.push(fp);
  }
}
walk(previewDir);

// ===== 2. BUILD LINK MAPPING (preview path -> WP slug path) =====
const linkMap = {};
for (const fp of files) {
  const rel = path.relative(previewDir, fp);
  const previewPath = '/' + rel;
  const altPath = previewPath.replace(/\/index\.html$/, '/');
  let slug = rel.replace(/\/index\.html$/, '').replace(/\.html$/, '').replace(/^pages\//, '');
  if (rel === 'index.html') slug = '';
  const parts = slug.split('/');
  const wpSlug = parts[parts.length - 1] || '';
  const wpPath = wpSlug ? '/' + wpSlug + '/' : '/';
  linkMap[previewPath] = wpPath;
  linkMap[altPath] = wpPath;
}

// ===== 3. COLLECT ALL USED LOCAL IMAGES =====
const usedImages = new Set();
for (const fp of files) {
  const html = fs.readFileSync(fp, 'utf-8');
  const srcs = [...html.matchAll(/src=["']([^"']*?)["']/g)].map(m => m[1]);
  srcs.filter(s => s.startsWith('/img/')).forEach(s => usedImages.add(s));
}
const imageList = [...usedImages].sort();

// Get image sizes (not embedding base64 — too large, user will select folder)
const imagesData = {};
let totalImgSize = 0;
for (const img of imageList) {
  const fp = path.join(previewDir, img);
  try {
    const stat = fs.statSync(fp);
    totalImgSize += stat.size;
    imagesData[img] = { size: stat.size, name: path.basename(img) };
  } catch (e) {
    console.log('MISSING image:', img);
  }
}
console.log(`Images: ${imageList.length} files, ${(totalImgSize / 1024 / 1024).toFixed(0)} MB total`);

// ===== 4. LOAD COMPILED TAILWIND CSS =====
const compiledCSS = fs.readFileSync(path.join(__dirname, 'tailwind-compiled.css'), 'utf-8');
console.log(`Tailwind compiled CSS: ${(compiledCSS.length / 1024).toFixed(0)} KB`);

// ===== 5. LOAD LUCIDE SVG ICONS =====
const lucideDir = path.join(__dirname, '..', 'node_modules', 'lucide-static', 'icons');
const lucideIcons = {};
for (const fp of files) {
  const html = fs.readFileSync(fp, 'utf-8');
  const matches = [...html.matchAll(/data-lucide=["']([^"']+)["']/g)];
  matches.forEach(m => {
    const name = m[1];
    if (!lucideIcons[name]) {
      const svgPath = path.join(lucideDir, name + '.svg');
      try {
        let svg = fs.readFileSync(svgPath, 'utf-8');
        // Remove the license comment and make it inline-friendly
        svg = svg.replace(/<!--[\s\S]*?-->\n?/, '').trim();
        lucideIcons[name] = svg;
      } catch (e) {
        console.log('Missing Lucide icon:', name);
        lucideIcons[name] = null;
      }
    }
  });
}
console.log(`Lucide icons loaded: ${Object.keys(lucideIcons).length}`);

// ===== 6. EXTRACT PAGE DATA =====
const pages = files.map(fp => {
  const html = fs.readFileSync(fp, 'utf-8');
  const title = (html.match(/<title>(.*?)<\/title>/s) || [])[1] || '';
  const desc = (html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/s) || [])[1] || '';

  // Head: extract only inline styles (NOT scripts — WP strips them)
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/);
  const head = headMatch ? headMatch[1] : '';
  const headParts = [];

  // Google Fonts link
  const fonts = head.match(/<link[^>]*fonts\.googleapis[^>]*>/);
  if (fonts) headParts.push(fonts[0]);
  const preconnects = [...head.matchAll(/<link[^>]*rel=["']preconnect["'][^>]*>/g)];
  preconnects.forEach(p => headParts.push(p[0]));

  // Compiled Tailwind CSS (replaces CDN script)
  headParts.push('<style id="tailwind-compiled">' + compiledCSS + '</style>');

  // Original inline styles
  const headStyles = [...head.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)];
  headStyles.forEach(s => headParts.push(s[0]));

  // Body: extract ONLY <main> content (no header/footer — WP theme handles those)
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  const body = bodyMatch ? bodyMatch[1] : '';

  // Extract main content
  const mainMatch = body.match(/<main[^>]*>[\s\S]*?<\/main>/);
  let mainContent = mainMatch ? mainMatch[0] : '';

  // Replace Lucide icon placeholders with inline SVGs
  for (const [name, svg] of Object.entries(lucideIcons)) {
    if (!svg) continue;
    // Replace <i data-lucide="name" class="..."></i> with inline SVG
    const regex = new RegExp('<i\\s+data-lucide=["\']' + name + '["\']([^>]*)><\\/i>', 'g');
    mainContent = mainContent.replace(regex, (match, attrs) => {
      // Extract class from original tag
      const classMatch = attrs.match(/class=["']([^"']*)["']/);
      const cls = classMatch ? classMatch[1] : '';
      // Add class to SVG
      return svg.replace('<svg', '<svg' + (cls ? ' class="' + cls + '"' : ''));
    });
  }

  // Extract popup (booking form after footer)
  const popupMatch = body.match(/<div id="booking-popup"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
  const popup = popupMatch ? popupMatch[0] : '';

  // Combine: styles + main + popup (NO scripts, NO header, NO footer)
  let fullContent = headParts.join('\n') + '\n' + mainContent;
  if (popup) fullContent += '\n' + popup;

  // Rewrite internal links
  for (const [from, to] of Object.entries(linkMap)) {
    fullContent = fullContent.split('href="' + from + '"').join('href="' + to + '"');
    fullContent = fullContent.split("href='" + from + "'").join("href='" + to + "'");
  }

  // Slug
  let rel = path.relative(previewDir, fp);
  let slug = rel.replace(/\/index\.html$/, '').replace(/\.html$/, '').replace(/^pages\//, '');
  if (rel === 'index.html') slug = '';
  const parts = slug.split('/');
  const wpSlug = parts[parts.length - 1] || 'accueil-refonte';
  const parentSlug = parts.length > 1 ? parts[parts.length - 2] : '';

  return { file: rel, slug, wpSlug, parentSlug, title, desc, content: fullContent };
});

const totalSize = pages.reduce((s, p) => s + p.content.length, 0);
console.log(`Pages: ${pages.length}, Total page content: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);

// ===== 5. GENERATE PUSHER HTML =====
// Images are too large for inline base64 (~412MB). Instead, the pusher will read
// images from the user's filesystem using a file picker.

const pusherHTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Haroboz - WordPress | Push Complet v2</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0a1a3a; color: #e8edf5; padding: 20px; }
  h1 { text-align: center; margin-bottom: 5px; font-size: 1.8em; }
  h2 { text-align: center; margin: 20px 0 15px; font-size: 1.3em; }
  .subtitle { text-align: center; color: #8899bb; margin-bottom: 25px; font-size: 0.95em; }
  .badge { display: inline-block; background: #22c55e; color: #fff; padding: 2px 10px; border-radius: 20px; font-size: 0.8em; margin-left: 8px; }

  .config { background: #122a5c; padding: 20px; border-radius: 12px; margin-bottom: 20px; max-width: 700px; margin-left: auto; margin-right: auto; }
  .config label { display: block; margin-bottom: 5px; font-weight: 600; font-size: 0.95em; }
  .config input, .config select { width: 100%; padding: 10px; border-radius: 6px; border: 1px solid #2a4a8c; background: #0a1a3a; color: white; font-size: 14px; margin-bottom: 15px; }

  .actions { text-align: center; margin-bottom: 20px; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  .btn { padding: 12px 24px; border-radius: 8px; border: none; font-size: 14px; font-weight: 600; cursor: pointer; transition: all .2s; }
  .btn-primary { background: #3b82f6; color: white; }
  .btn-primary:hover { background: #2563eb; }
  .btn-danger { background: #ef4444; color: white; }
  .btn-success { background: #22c55e; color: white; }
  .btn-warning { background: #f59e0b; color: white; }
  .btn-purple { background: #8b5cf6; color: white; }
  .btn:disabled { opacity: 0.5; cursor: not-allowed; }

  .info-box { background: #1e3a6e; padding: 15px; border-radius: 8px; max-width: 700px; margin: 0 auto 20px; font-size: 0.88em; line-height: 1.6; }
  .info-box strong { color: #60a5fa; }

  .pages-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px; max-width: 1200px; margin: 0 auto; }
  .page-card { background: #122a5c; padding: 12px 15px; border-radius: 8px; border-left: 4px solid #3b82f6; }
  .page-card.success { border-left-color: #22c55e; background: #0f2a1a; }
  .page-card.error { border-left-color: #ef4444; background: #2a0f0f; }
  .page-card.pending { border-left-color: #f59e0b; }
  .page-card h3 { font-size: 0.88em; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .page-card .slug { color: #8899bb; font-size: 0.78em; }
  .page-card .status { font-size: 0.82em; margin-top: 6px; font-weight: 600; }
  .page-card .status.ok { color: #22c55e; }
  .page-card .status.err { color: #ef4444; }
  .page-card .status.wait { color: #f59e0b; }

  .log { background: #000; color: #0f0; padding: 15px; border-radius: 8px; max-height: 300px; overflow-y: auto; font-family: monospace; font-size: 11px; margin: 15px auto; max-width: 1200px; white-space: pre-wrap; word-break: break-all; }

  .progress { text-align: center; font-size: 1.1em; margin: 10px 0; }
  .progress-bar { height: 8px; background: #1e3a6e; border-radius: 4px; max-width: 500px; margin: 8px auto; overflow: hidden; }
  .progress-bar .fill { height: 100%; background: linear-gradient(90deg, #3b82f6, #22c55e); transition: width 0.3s; border-radius: 4px; }

  .checkbox-row { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
  .checkbox-row input[type="checkbox"] { width: 18px; height: 18px; accent-color: #3b82f6; }
  .checkbox-row label { margin-bottom: 0; font-size: 0.9em; }

  .tab-bar { display: flex; gap: 0; max-width: 1200px; margin: 0 auto 15px; border-bottom: 2px solid #1e3a6e; }
  .tab { padding: 10px 20px; cursor: pointer; color: #6b8ab8; font-weight: 500; border-bottom: 2px solid transparent; margin-bottom: -2px; }
  .tab.active { color: #60a5fa; border-bottom-color: #3b82f6; }
  .tab-content { display: none; }
  .tab-content.active { display: block; }

  .img-status { max-width: 1200px; margin: 0 auto; }
  .img-row { display: flex; align-items: center; gap: 10px; padding: 6px 10px; border-bottom: 1px solid #1e3a6e; font-size: 0.85em; }
  .img-row .name { flex: 1; color: #93c5fd; }
  .img-row .size { color: #6b8ab8; width: 80px; }
  .img-row .st { width: 200px; }
  .img-row .st.ok { color: #22c55e; }
  .img-row .st.err { color: #ef4444; }
  .img-row .st.wait { color: #6b8ab8; }
</style>
</head>
<body>

<h1>Haroboz - WordPress</h1>
<p class="subtitle">Push complet v2 | ${pages.length} pages + ${imageList.length} images | Liens internes corriges | Sans header/footer (theme WP)</p>

<div class="config">
  <label>URL du site WordPress</label>
  <input type="text" id="wpUrl" value="https://haroboz.com">

  <label>Nom d'utilisateur WordPress</label>
  <input type="text" id="wpUser" value="admin">

  <label>Mot de passe d'application</label>
  <input type="password" id="wpPass" value="">

  <div class="checkbox-row">
    <input type="checkbox" id="draftMode" checked>
    <label for="draftMode">Creer en mode Brouillon</label>
  </div>
  <div class="checkbox-row">
    <input type="checkbox" id="skipExisting">
    <label for="skipExisting">Ignorer les pages existantes</label>
  </div>
</div>

<div class="info-box">
  <strong>v2 — Corrections :</strong><br>
  1. Liens internes reecris vers les slugs WordPress (ex: /portrait-studio-marseille/)<br>
  2. Header et footer retires du contenu (le theme WP gere ca)<br>
  3. Images uploadees sur la mediatheque WP puis URLs mises a jour dans le contenu<br>
  <strong>Ordre :</strong> Images d'abord, puis pages (pour que les URLs images soient correctes).
</div>

<div class="config" style="border: 2px dashed #8b5cf6;">
  <label>Dossier d'images (preview/img)</label>
  <p style="font-size:0.82em;color:#8899bb;margin-bottom:10px;">Selectionnez le dossier <strong>img</strong> telecharge depuis le Codespace. Le pusher y trouvera les ${imageList.length} images.</p>
  <input type="file" id="imgFolder" webkitdirectory multiple style="padding:8px;">
  <div id="imgFolderStatus" style="font-size:0.85em;margin-top:5px;color:#6b8ab8;"></div>
</div>

<div class="actions">
  <button class="btn btn-primary" onclick="testConnection()">Tester connexion</button>
  <button class="btn btn-purple" onclick="uploadAllImages()">1. Uploader images (${imageList.length})</button>
  <button class="btn btn-success" onclick="pushAllPages()" id="btnPush">2. Pousser pages (${pages.length})</button>
  <button class="btn btn-warning" onclick="doEverything()">Tout faire</button>
  <button class="btn btn-danger" onclick="stopPush()">Stop</button>
</div>

<div class="progress" id="progress"></div>
<div class="progress-bar" id="progressBar" style="display:none"><div class="fill" id="progressFill"></div></div>

<div class="tab-bar">
  <div class="tab active" onclick="switchTab(this,'pages')">Pages (${pages.length})</div>
  <div class="tab" onclick="switchTab(this,'images')">Images (${imageList.length})</div>
  <div class="tab" onclick="switchTab(this,'log')">Journal</div>
</div>

<div class="tab-content active" id="tab-pages">
  <div class="pages-grid" id="pagesGrid"></div>
</div>
<div class="tab-content" id="tab-images">
  <div class="img-status" id="imgGrid"></div>
</div>
<div class="tab-content" id="tab-log">
  <div class="log" id="log"></div>
</div>

<script>
// ===== PAGE METADATA =====
var PAGES = ${JSON.stringify(pages.map(p => ({
  file: p.file, slug: p.slug, wpSlug: p.wpSlug, parentSlug: p.parentSlug,
  title: p.title, desc: p.desc, contentLength: p.content.length
})))};

// ===== PAGE CONTENTS (base64 to avoid script conflicts) =====
var PAGE_CONTENTS_B64 = {};
${pages.map((p, i) => `PAGE_CONTENTS_B64[${i}] = "${Buffer.from(p.content).toString('base64')}";`).join('\n')}

function getPageContent(i) {
  return decodeURIComponent(escape(atob(PAGE_CONTENTS_B64[i])));
}

// ===== IMAGE LIST (to upload) =====
var IMAGES = ${JSON.stringify(imageList.map(img => ({
  path: img,
  name: path.basename(img),
  size: imagesData[img] ? imagesData[img].size : 0
})))};

// ===== IMAGE FILES (loaded from user's folder selection) =====
var IMG_FILES = {}; // index -> File object (set after folder selection)

var shouldStop = false;
var parentMap = {};
var imageUrlMap = {}; // old path -> new WP URL

// ===== UI =====
function switchTab(el, name) {
  document.querySelectorAll('.tab').forEach(function(t) { t.classList.remove('active'); });
  document.querySelectorAll('.tab-content').forEach(function(t) { t.classList.remove('active'); });
  document.getElementById('tab-' + name).classList.add('active');
  el.classList.add('active');
}

function log(msg) {
  var el = document.getElementById('log');
  el.textContent += new Date().toLocaleTimeString('fr-FR') + ' | ' + msg + '\\n';
  el.scrollTop = el.scrollHeight;
}

function updateProgress(current, total, label) {
  document.getElementById('progress').textContent = current + ' / ' + total + ' ' + (label || '');
  document.getElementById('progressBar').style.display = 'block';
  document.getElementById('progressFill').style.width = ((current / total) * 100) + '%';
}

function updateCard(i, status, msg) {
  var card = document.getElementById('page-' + i);
  if (!card) return;
  card.className = 'page-card ' + status;
  var s = card.querySelector('.status');
  s.textContent = msg;
  s.className = 'status ' + (status === 'success' ? 'ok' : status === 'error' ? 'err' : 'wait');
}

function updateImgRow(i, status, msg) {
  var row = document.getElementById('img-' + i);
  if (!row) return;
  var s = row.querySelector('.st');
  s.textContent = msg;
  s.className = 'st ' + (status === 'success' ? 'ok' : status === 'error' ? 'err' : 'wait');
}

function renderCards() {
  document.getElementById('pagesGrid').innerHTML = PAGES.map(function(p, i) {
    return '<div class="page-card" id="page-' + i + '">'
      + '<h3>' + (p.title || p.wpSlug) + '</h3>'
      + '<div class="slug">WP: /' + p.wpSlug + '/' + (p.parentSlug ? ' (parent: ' + p.parentSlug + ')' : '') + '</div>'
      + '<div class="status wait">En attente</div></div>';
  }).join('');

  document.getElementById('imgGrid').innerHTML = IMAGES.map(function(img, i) {
    return '<div class="img-row" id="img-' + i + '">'
      + '<div class="name">' + img.name + '</div>'
      + '<div class="size">' + (img.size / 1024 / 1024).toFixed(1) + ' MB</div>'
      + '<div class="st wait">En attente</div></div>';
  }).join('');
}

function getConfig() {
  return {
    url: document.getElementById('wpUrl').value.replace(/\\/$/, ''),
    user: document.getElementById('wpUser').value,
    pass: document.getElementById('wpPass').value,
    draft: document.getElementById('draftMode').checked,
    skipExisting: document.getElementById('skipExisting').checked,
  };
}

function authHeader() {
  var c = getConfig();
  return 'Basic ' + btoa(c.user + ':' + c.pass);
}

async function wpFetch(endpoint, options) {
  options = options || {};
  var c = getConfig();
  var headers = options.headers || {};
  if (!headers['Content-Type'] && !options.isUpload) headers['Content-Type'] = 'application/json';
  headers['Authorization'] = authHeader();
  var fetchOpts = { method: options.method || 'GET', headers: headers };
  if (options.body) fetchOpts.body = options.body;
  var resp = await fetch(c.url + '/wp-json/wp/v2/' + endpoint, fetchOpts);
  var text = await resp.text();
  var data;
  try { data = JSON.parse(text); } catch(e) { throw new Error('Non-JSON: ' + text.substring(0, 200)); }
  if (!resp.ok) throw new Error(data.message || data.code || 'HTTP ' + resp.status);
  return data;
}

// ===== TEST CONNECTION =====
async function testConnection() {
  log('Test de connexion...');
  try {
    var user = await wpFetch('users/me');
    log('OK: ' + user.name + ' (ID ' + user.id + ')');
    var caps = user.capabilities || {};
    log('unfiltered_html: ' + (caps.unfiltered_html ? 'OUI' : 'NON'));
    var pages = await wpFetch('pages?per_page=100&status=any');
    log(pages.length + ' pages existantes');
  } catch(e) { log('ERREUR: ' + e.message); }
}

// ===== FOLDER PICKER HANDLER =====
document.getElementById('imgFolder').addEventListener('change', function(e) {
  var files = e.target.files;
  var matched = 0;
  for (var f = 0; f < files.length; f++) {
    var file = files[f];
    var fname = file.name;
    // Match by filename
    for (var i = 0; i < IMAGES.length; i++) {
      if (IMAGES[i].name === fname && !IMG_FILES[i]) {
        IMG_FILES[i] = file;
        matched++;
        break;
      }
    }
  }
  document.getElementById('imgFolderStatus').textContent = matched + ' / ' + IMAGES.length + ' images trouvees dans le dossier selectionne (' + files.length + ' fichiers au total)';
  document.getElementById('imgFolderStatus').style.color = matched === IMAGES.length ? '#22c55e' : '#f59e0b';
  log('Dossier selectionne: ' + matched + '/' + IMAGES.length + ' images matchees');
});

// ===== IMAGE UPLOAD =====
async function uploadImage(index) {
  var img = IMAGES[index];
  var file = IMG_FILES[index];
  if (!file) { log('  Image manquante: ' + img.name + ' (pas dans le dossier)'); return null; }

  // Check if image already exists by filename
  try {
    var existing = await wpFetch('media?search=' + encodeURIComponent(img.name.replace('.png','')) + '&per_page=5');
    for (var e = 0; e < existing.length; e++) {
      if (existing[e].source_url && existing[e].source_url.indexOf(img.name.replace('.png','')) !== -1) {
        var url = existing[e].source_url;
        imageUrlMap[img.path] = url;
        log('  Deja presente: ' + img.name);
        updateImgRow(index, 'success', 'Existante');
        return url;
      }
    }
  } catch(e) {}

  var formData = new FormData();
  formData.append('file', file, img.name);

  var c = getConfig();
  var resp = await fetch(c.url + '/wp-json/wp/v2/media', {
    method: 'POST',
    headers: { 'Authorization': authHeader() },
    body: formData
  });
  var text = await resp.text();
  var data;
  try { data = JSON.parse(text); } catch(e) { throw new Error('Non-JSON: ' + text.substring(0, 100)); }
  if (!resp.ok) throw new Error(data.message || 'HTTP ' + resp.status);

  imageUrlMap[img.path] = data.source_url;
  return data.source_url;
}

async function uploadAllImages() {
  log('=== Upload de ' + IMAGES.length + ' images ===');
  var done = 0, errors = 0;

  for (var i = 0; i < IMAGES.length; i++) {
    if (shouldStop) { log('Arrete'); break; }
    updateImgRow(i, 'pending', 'Upload...');
    log('IMG ' + (i+1) + '/' + IMAGES.length + ': ' + IMAGES[i].name + ' (' + (IMAGES[i].size/1024/1024).toFixed(1) + ' MB)...');

    try {
      var url = await uploadImage(i);
      if (url) {
        done++;
        updateImgRow(i, 'success', url.split('/').pop());
        log('  OK -> ' + url);
      }
    } catch(e) {
      errors++;
      updateImgRow(i, 'error', e.message);
      log('  ERREUR: ' + e.message);
    }
    updateProgress(done + errors, IMAGES.length, 'images');
    await new Promise(function(r) { setTimeout(r, 300); });
  }
  log('=== Images: ' + done + ' OK, ' + errors + ' erreurs ===');
  log('Map images: ' + Object.keys(imageUrlMap).length + ' URLs');
}

// ===== PAGE PUSH =====
async function findParent(parentSlug) {
  if (!parentSlug) return 0;
  if (parentMap[parentSlug]) return parentMap[parentSlug];
  try {
    var existing = await wpFetch('pages?slug=' + encodeURIComponent(parentSlug) + '&status=any');
    if (existing.length > 0) { parentMap[parentSlug] = existing[0].id; return existing[0].id; }
  } catch(e) {}
  return 0;
}

async function pushPage(index) {
  var page = PAGES[index];
  var config = getConfig();
  var content = getPageContent(index);

  // Replace local image paths with WP media URLs
  for (var oldPath in imageUrlMap) {
    content = content.split('src="' + oldPath + '"').join('src="' + imageUrlMap[oldPath] + '"');
    content = content.split("src='" + oldPath + "'").join("src='" + imageUrlMap[oldPath] + "'");
  }

  // Check existing
  var existingId = null;
  try {
    var existing = await wpFetch('pages?slug=' + encodeURIComponent(page.wpSlug) + '&status=any');
    if (existing.length > 0) {
      existingId = existing[0].id;
      if (config.skipExisting) { parentMap[page.wpSlug] = existingId; return { id: existingId, status: 'skipped' }; }
    }
  } catch(e) {}

  var parentId = await findParent(page.parentSlug);
  var body = {
    title: page.title,
    content: content,
    status: config.draft ? 'draft' : 'publish',
    slug: page.wpSlug
  };
  if (parentId) body.parent = parentId;
  if (page.desc) {
    body.meta = {
      _yoast_wpseo_metadesc: page.desc,
      _yoast_wpseo_title: page.title,
      rank_math_description: page.desc,
      rank_math_title: page.title
    };
  }

  var result;
  if (existingId) {
    result = await wpFetch('pages/' + existingId, { method: 'PUT', body: JSON.stringify(body) });
  } else {
    result = await wpFetch('pages', { method: 'POST', body: JSON.stringify(body) });
  }
  parentMap[page.wpSlug] = result.id;
  return result;
}

async function pushAllPages() {
  shouldStop = false;
  log('=== Push de ' + PAGES.length + ' pages ===');
  if (Object.keys(imageUrlMap).length === 0) {
    log('ATTENTION: aucune image uploadee. Les images locales ne s afficheront pas.');
  }

  // Parents first
  var parents = PAGES.map(function(p,i){return Object.assign({},p,{index:i});}).filter(function(p){return !p.parentSlug;});
  var children = PAGES.map(function(p,i){return Object.assign({},p,{index:i});}).filter(function(p){return p.parentSlug;});
  var ordered = parents.concat(children);
  var done = 0, errors = 0;

  for (var j = 0; j < ordered.length; j++) {
    var page = ordered[j];
    if (shouldStop) { log('Arrete'); break; }
    updateCard(page.index, 'pending', 'Push...');
    log('PAGE ' + (j+1) + '/' + ordered.length + ': ' + page.wpSlug);
    try {
      var result = await pushPage(page.index);
      if (result.status === 'skipped') {
        updateCard(page.index, 'success', 'Ignoree (ID ' + result.id + ')');
      } else {
        done++;
        updateCard(page.index, 'success', 'OK ID ' + result.id + ' (' + result.status + ')');
        log('  OK -> ID ' + result.id);
      }
    } catch(e) {
      errors++;
      updateCard(page.index, 'error', e.message);
      log('  ERREUR: ' + e.message);
    }
    updateProgress(done + errors, ordered.length, 'pages');
    await new Promise(function(r) { setTimeout(r, 500); });
  }
  log('=== Pages: ' + done + ' OK, ' + errors + ' erreurs ===');
}

async function doEverything() {
  log('=== LANCEMENT COMPLET ===');
  await uploadAllImages();
  if (!shouldStop) await pushAllPages();
  log('=== TOUT TERMINE ===');
}

function stopPush() { shouldStop = true; log('Arret demande...'); }

renderCards();
log('Pret. ' + PAGES.length + ' pages + ' + IMAGES.length + ' images.');
log('Liens internes corriges vers slugs WP.');
log('Header/footer retires (le theme WP les gere).');
log('');
log('Cliquez "Tout faire" ou uploadez les images puis les pages separement.');
</script>
</body>
</html>`;

const outputPath = path.join(__dirname, 'wp-pusher.html');
fs.writeFileSync(outputPath, pusherHTML);
const fileSize = Buffer.byteLength(pusherHTML);
console.log(`\nFichier: ${outputPath}`);
console.log(`Taille: ${(fileSize / 1024 / 1024).toFixed(0)} MB`);
if (fileSize > 500 * 1024 * 1024) {
  console.log('ATTENTION: fichier tres volumineux, le navigateur pourrait avoir du mal.');
}
