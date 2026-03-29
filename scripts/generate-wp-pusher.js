#!/usr/bin/env node
/**
 * generate-wp-pusher.js — v3
 *
 * Generates a self-contained WP pusher that pushes COMPLETE pages:
 * CSS + Tailwind + Fonts + Header + Main + Footer + JS
 *
 * The key insight: we push the FULL page body content (not just <main>),
 * plus all CSS/JS as inline assets, plus CSS to hide the WP theme chrome.
 * WordPress preserves <script> and <style> for admin users (unfiltered_html).
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
    const fp = path.join(dir, entry.name);
    if (entry.isDirectory()) results = results.concat(findHtmlFiles(fp));
    else if (entry.name.endsWith('.html')) results.push(fp);
  }
  return results;
}

function extractTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].trim() : '';
}

function extractMeta(html) {
  const m = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  return m ? m[1].trim() : '';
}

function extractStyles(html) {
  // Extract ALL <style> blocks from <head>
  const styles = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(html)) !== null) styles.push(m[1]);
  return styles.join('\n');
}

function extractBodyContent(html) {
  // Extract everything between <body...> and </body>
  const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return m ? m[1].trim() : '';
}

function extractBodyClass(html) {
  const m = html.match(/<body\s+class="([^"]*)"/i);
  return m ? m[1] : '';
}

function getSilo(slug, parentSlug) {
  const s = parentSlug || slug;
  if (s.startsWith('packs')) return 'Packs';
  if (s.startsWith('votre')) return 'Parcours';
  if (s.startsWith('photographe')) return 'Local';
  if (s.startsWith('portfolio')) return 'Portfolio';
  if (s.startsWith('boutique')) return 'Boutique';
  if (s.startsWith('a-propos')) return 'About';
  return 'Other';
}

// CSS to hide WordPress theme chrome
const WP_HIDE_CSS = `
/* === HAROBOZ: Hide WP Theme Chrome === */
#wpadminbar { display: none !important; }
html { margin-top: 0 !important; }
.site-header, #masthead, .wp-site-blocks > header:first-child,
.site-footer, #colophon, .wp-site-blocks > footer:last-child,
.sidebar, .widget-area, .entry-header, .page-header,
.entry-footer, .post-navigation, .nav-links,
.entry-meta, .cat-links, .tags-links, .edit-link,
.comments-area, #comments { display: none !important; }
body, html, .site, .site-content, .content-area, .site-main,
.entry-content, .page-content, .wp-site-blocks,
.wp-block-post-content, .has-global-padding {
  max-width: 100% !important; width: 100% !important;
  padding: 0 !important; margin: 0 !important;
}
.entry-content > *, .wp-block-post-content > * {
  max-width: 100% !important; margin-left: 0 !important; margin-right: 0 !important;
}
body { background: #f9fafb !important; }
.haroboz-page { font-family: 'Inter', sans-serif; color: #0a1a3a; }
`.trim();

// ===== Build registry =====
function buildRegistry() {
  const files = findHtmlFiles(PREVIEW_DIR);
  const pages = [];

  for (const filePath of files) {
    const rel = path.relative(PREVIEW_DIR, filePath).replace(/\\/g, '/');
    const html = fs.readFileSync(filePath, 'utf-8');
    const title = extractTitle(html);
    const metaDesc = extractMeta(html);
    const customStyles = extractStyles(html);
    const bodyContent = extractBodyContent(html);
    const bodyClass = extractBodyClass(html);
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

    // Build FULL content: WP hide CSS + custom styles + assets + full body
    const fullContent = `
<style>${WP_HIDE_CSS}\n${customStyles}</style>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"><\/script>
<script>tailwind.config={theme:{extend:{colors:{brand:{DEFAULT:'#0a1a3a',light:'#122a5c','50':'#e8edf5'}},fontFamily:{sans:['Inter','sans-serif'],serif:['Playfair Display','serif']}}}}<\/script>
<script src="https://unpkg.com/lucide@latest"><\/script>
<div class="haroboz-page ${bodyClass}">
${bodyContent}
</div>`.trim();

    const wordCount = bodyContent.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length;

    pages.push({
      file: rel, title, metaDesc, slug, wpSlug, parentSlug,
      silo: getSilo(slug, parentSlug), isHome,
      contentLen: fullContent.length, wordCount,
      fullContent
    });
  }

  pages.sort((a, b) => {
    if (a.isHome) return -1; if (b.isHome) return 1;
    if (!a.parentSlug && b.parentSlug) return -1;
    if (a.parentSlug && !b.parentSlug) return 1;
    return 0;
  });

  return pages;
}

function loadMenus() {
  const menus = {};
  try { menus.main = JSON.parse(fs.readFileSync(path.join(MENUS_DIR, 'main-menu.json'), 'utf-8')); } catch(e) {}
  try { menus.footer = JSON.parse(fs.readFileSync(path.join(MENUS_DIR, 'footer.json'), 'utf-8')); } catch(e) {}
  return menus;
}

// ===== Build =====
const pages = buildRegistry();
const menus = loadMenus();

console.log(`Pages: ${pages.length}`);
console.log(`Total content size: ${(pages.reduce((a,p) => a+p.fullContent.length, 0) / 1024 / 1024).toFixed(2)} MB`);

function jsEsc(s) { return s.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$'); }

// ===== HTML Template =====
const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HAROBOZ — Remplacement Complet du Site</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{--n:#0a1a3a;--nl:#122a5c;--ns:#0d2248;--g:#c9a84c;--gl:#e0c777;--gd:#8a7233;--ok:#22c55e;--ko:#ef4444;--info:#3b82f6;--warn:#f59e0b;--t:#e2e8f0;--td:#94a3b8;--tb:#f8fafc;--b:#1e3a5f;--c:#0d2248}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:var(--n);color:var(--t);min-height:100vh;line-height:1.6}
h1,h2,h3{font-family:'Playfair Display',serif;font-weight:600}
.ctn{max-width:1200px;margin:0 auto;padding:0 20px}
.hdr{background:linear-gradient(135deg,var(--n),var(--nl));border-bottom:1px solid var(--b);padding:16px 0;position:sticky;top:0;z-index:100}
.hdr .ctn{display:flex;align-items:center;justify-content:space-between;gap:12px}
.hdr h1{font-size:1.3rem;color:var(--g)}.hdr h1 span{color:var(--td);font-family:'Inter';font-weight:400;font-size:.75rem;margin-left:8px}
.dot{width:10px;height:10px;border-radius:50%;background:var(--ko);display:inline-block;transition:.3s}.dot.on{background:var(--ok)}
.tabs{display:flex;gap:0;border-bottom:2px solid var(--b);margin:16px 0 0;overflow-x:auto}
.tab{padding:8px 16px;cursor:pointer;font-weight:500;font-size:.8rem;color:var(--td);border:none;border-bottom:2px solid transparent;margin-bottom:-2px;transition:.2s;background:none;white-space:nowrap}
.tab:hover{color:var(--t)}.tab.on{color:var(--g);border-bottom-color:var(--g)}
.pnl{display:none;padding:24px 0}.pnl.on{display:block}
.fg{margin-bottom:14px}
.fg label{display:block;font-size:.75rem;font-weight:500;color:var(--td);margin-bottom:3px;text-transform:uppercase;letter-spacing:.05em}
.fg input,.fg select{width:100%;padding:10px 12px;background:var(--ns);border:1px solid var(--b);border-radius:6px;color:var(--t);font-size:.85rem;font-family:'Inter'}
.fg input:focus{outline:none;border-color:var(--g)}
.fr{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border:none;border-radius:6px;font-family:'Inter';font-weight:600;font-size:.8rem;cursor:pointer;transition:.2s}
.btn-g{background:var(--g);color:var(--n)}.btn-g:hover{background:var(--gl)}.btn-g:disabled{background:var(--gd);cursor:not-allowed}
.btn-o{background:transparent;border:1px solid var(--b);color:var(--t)}.btn-o:hover{border-color:var(--g);color:var(--g)}
.btn-d{background:var(--ko);color:#fff}.btn-d:hover{background:#dc2626}
.btn-sm{padding:5px 10px;font-size:.7rem}
.card{background:var(--c);border:1px solid var(--b);border-radius:8px;padding:16px}
.cc{max-width:550px;margin:0 auto}
.cr{margin-top:14px;padding:12px;border-radius:6px;display:none;font-size:.8rem}
.cr.ok{display:block;background:rgba(34,197,94,.1);border:1px solid var(--ok)}.cr.ko{display:block;background:rgba(239,68,68,.1);border:1px solid var(--ko)}
.pg{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px;margin-top:12px}
.pk{background:var(--c);border:1px solid var(--b);border-radius:6px;padding:10px;font-size:.8rem}
.pk .kh{display:flex;align-items:center;gap:8px;margin-bottom:4px}
.pk .kh input[type=checkbox]{accent-color:var(--g);cursor:pointer}
.pk .kt{font-weight:600;color:var(--tb);flex:1;font-size:.8rem}
.sb{display:inline-block;padding:2px 7px;border-radius:8px;font-size:.6rem;font-weight:600;text-transform:uppercase}
.sb.pe{background:rgba(148,163,184,.2);color:var(--td)}.sb.pu{background:rgba(59,130,246,.2);color:var(--info)}
.sb.dn{background:rgba(34,197,94,.2);color:var(--ok)}.sb.er{background:rgba(239,68,68,.2);color:var(--ko)}
.pills{display:flex;gap:4px;flex-wrap:wrap;margin-bottom:10px}
.pill{padding:3px 10px;border-radius:12px;font-size:.7rem;cursor:pointer;border:1px solid var(--b);background:transparent;color:var(--td)}
.pill:hover,.pill.on{border-color:var(--g);color:var(--g);background:rgba(201,168,76,.08)}
.pbc{width:100%;height:6px;background:var(--ns);border-radius:3px;overflow:hidden;margin:8px 0}
.pbf{height:100%;background:linear-gradient(90deg,var(--g),var(--gl));border-radius:3px;transition:width .3s;width:0}
.log{background:#050e1f;border:1px solid var(--b);border-radius:6px;padding:10px;max-height:300px;overflow-y:auto;font-family:'Courier New',monospace;font-size:.7rem;line-height:1.7}
.le{padding:1px 0}.le.ok{color:var(--ok)}.le.ko{color:var(--ko)}.le.info{color:var(--info)}.le.warn{color:var(--warn)}
.pp{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:768px){.pp,.fr{grid-template-columns:1fr}}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(100px,1fr));gap:8px;margin-bottom:14px}
.stat{background:var(--ns);border-radius:6px;padding:10px;text-align:center}
.stat .sv{font-size:1.5rem;font-weight:700;color:var(--g);font-family:'Playfair Display'}
.stat .sl{font-size:.6rem;color:var(--td);text-transform:uppercase;margin-top:2px}
.steps{display:flex;gap:6px;margin-bottom:16px;flex-wrap:wrap}
.step{padding:6px 12px;border-radius:14px;font-size:.7rem;color:var(--td);background:var(--ns);border:1px solid var(--b)}
.step.active{color:var(--g);border-color:var(--g)}.step.done{color:var(--ok);border-color:var(--ok)}
.danger-zone{margin-top:30px;padding:14px;border:1px solid var(--ko);border-radius:6px;background:rgba(239,68,68,.03)}
.media-drop{border:2px dashed var(--b);border-radius:10px;padding:30px;text-align:center;cursor:pointer;transition:.2s}
.media-drop:hover{border-color:var(--g)}
.media-drop h3{color:var(--g);margin-bottom:4px;font-size:1rem}
.media-drop p{color:var(--td);font-size:.8rem}
.note{background:rgba(201,168,76,.08);border:1px solid var(--gd);border-radius:6px;padding:12px;margin:12px 0;font-size:.8rem;color:var(--gl)}
.note strong{color:var(--g)}
</style>
</head>
<body>

<header class="hdr"><div class="ctn">
  <h1>HAROBOZ <span>Remplacement Complet v3</span></h1>
  <div><span class="dot" id="dot"></span> <span id="stxt" style="font-size:.75rem;color:var(--td)">Non connecté</span></div>
</div></header>

<div class="ctn">
<div class="tabs">
  <button class="tab on" onclick="showTab('connect')">1. Connexion</button>
  <button class="tab" onclick="showTab('pages')">2. Pages (${pages.length})</button>
  <button class="tab" onclick="showTab('media')">3. Médias</button>
  <button class="tab" onclick="showTab('push')">4. Push Complet</button>
</div>

<!-- CONNEXION -->
<div class="pnl on" id="tab-connect">
<div class="card cc">
  <h2 style="color:var(--g);margin-bottom:16px;font-size:1.1rem">Connexion WordPress</h2>
  <div class="note"><strong>Important :</strong> L'outil pousse le HTML complet (CSS Tailwind + header + footer + JS) pour chaque page. Le thème WP est masqué automatiquement par CSS.</div>
  <div class="fg"><label>URL du site</label><input id="wpUrl" value="https://haroboz.com"></div>
  <div class="fr">
    <div class="fg"><label>Utilisateur</label><input id="wpUser" value="admin"></div>
    <div class="fg"><label>App Password</label><input type="password" id="wpPass"></div>
  </div>
  <button class="btn btn-g" onclick="testConn()" id="btnTest">Tester la connexion</button>
  <div class="cr" id="connRes"></div>
</div>
</div>

<!-- PAGES -->
<div class="pnl" id="tab-pages">
<div class="stats" id="pgStats"></div>
<div class="pills" id="siloF"></div>
<div style="display:flex;gap:6px;margin-bottom:8px">
  <button class="btn btn-o btn-sm" onclick="selAll(true)">Tout cocher</button>
  <button class="btn btn-o btn-sm" onclick="selAll(false)">Tout décocher</button>
</div>
<div class="pg" id="pgGrid"></div>
</div>

<!-- MEDIA -->
<div class="pnl" id="tab-media">
<div class="note"><strong>Optionnel :</strong> Uploadez les images pour les héberger sur WordPress. Si vous ne le faites pas, les images utiliseront les chemins relatifs existants.</div>
<div class="stats">
  <div class="stat"><div class="sv" id="mTotal">0</div><div class="sl">Fichiers prêts</div></div>
  <div class="stat"><div class="sv" id="mDone">0</div><div class="sl">Uploadés</div></div>
</div>
<div class="media-drop" onclick="document.getElementById('mInput').click()" ondrop="onDrop(event)" ondragover="event.preventDefault()">
  <h3>Glissez vos images ici</h3>
  <p>ou cliquez pour parcourir</p>
  <input type="file" id="mInput" multiple accept="image/*" style="display:none" onchange="addFiles(this.files)">
</div>
<button class="btn btn-g" style="margin-top:10px" onclick="uploadAll()">Uploader vers WordPress</button>
<div class="pbc"><div class="pbf" id="mProg"></div></div>
<div id="mList" style="margin-top:8px;font-size:.75rem;color:var(--td)"></div>
</div>

<!-- PUSH COMPLET -->
<div class="pnl" id="tab-push">
<div class="steps">
  <div class="step" id="s1">1. Scan WP</div>
  <div class="step" id="s2">2. Pages</div>
  <div class="step" id="s3">3. SEO</div>
  <div class="step" id="s4">4. Homepage</div>
</div>
<div class="pp">
<div>
  <div class="card" style="margin-bottom:12px">
    <h3 style="color:var(--g);margin-bottom:10px;font-size:.95rem">Options</h3>
    <label style="display:flex;align-items:center;gap:6px;font-size:.8rem;color:var(--td);cursor:pointer;margin-bottom:6px">
      <input type="checkbox" id="optPublish" style="accent-color:var(--g)"> Publier directement (sinon brouillon)
    </label>
    <label style="display:flex;align-items:center;gap:6px;font-size:.8rem;color:var(--td);cursor:pointer;margin-bottom:6px">
      <input type="checkbox" id="optReplace" checked style="accent-color:var(--g)"> Remplacer pages existantes (même slug)
    </label>
    <label style="display:flex;align-items:center;gap:6px;font-size:.8rem;color:var(--td);cursor:pointer;margin-bottom:6px">
      <input type="checkbox" id="optSeo" checked style="accent-color:var(--g)"> Mettre à jour meta SEO
    </label>
    <label style="display:flex;align-items:center;gap:6px;font-size:.8rem;color:var(--td);cursor:pointer">
      <input type="checkbox" id="optHome" checked style="accent-color:var(--g)"> Définir page d'accueil
    </label>
  </div>
  <button class="btn btn-g" style="padding:14px 28px;font-size:.95rem;width:100%" onclick="pushAll()" id="btnPush">
    REMPLACER TOUT LE SITE (${pages.length} pages)
  </button>
  <button class="btn btn-o" style="width:100%;margin-top:8px" onclick="pushSelected()">Pousser les pages sélectionnées</button>
  <button class="btn btn-o btn-sm" style="margin-top:8px" onclick="retryFailed()">Relancer les échecs</button>
  <div class="pbc"><div class="pbf" id="pProg"></div></div>
  <div style="font-size:.8rem;color:var(--td)" id="pTxt">En attente...</div>
  <div style="margin-top:8px;display:flex;gap:6px">
    <button class="btn btn-o btn-sm" onclick="exportLog()">Exporter log</button>
  </div>
  <div class="danger-zone">
    <h3 style="color:var(--ko);font-size:.85rem;margin-bottom:6px">Zone dangereuse</h3>
    <button class="btn btn-d btn-sm" onclick="deleteAllPages()">Supprimer toutes les pages WP</button>
  </div>
</div>
<div>
  <div class="log" id="logEl"><div class="le info">Prêt. Cliquez sur "Remplacer tout le site".</div></div>
</div>
</div>
</div>

</div>

<script>
// ===== DATA =====
const PAGES = ${JSON.stringify(pages.map(p => ({...p, fullContent: undefined})))};
const CONTENTS = ${JSON.stringify(pages.map(p => p.fullContent))};
const MENUS = ${JSON.stringify(menus)};
PAGES.forEach((p,i) => p.fullContent = CONTENTS[i]);

// ===== STATE =====
let wpUrl='', wpUser='', wpPass='', connected=false;
let parentMap={}, results={ok:[],ko:[],skip:[]};
let mediaFiles=[], mediaMap={};

// ===== UI =====
function showTab(id) {
  document.querySelectorAll('.pnl').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('on'));
  document.getElementById('tab-'+id).classList.add('on');
  event.target.classList.add('on');
}
function log(m,t=''){const d=document.createElement('div');d.className='le '+t;d.textContent=new Date().toLocaleTimeString()+' '+m;document.getElementById('logEl').appendChild(d);document.getElementById('logEl').scrollTop=9e9;}
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}

// ===== CONNECTION =====
async function testConn(){
  wpUrl=document.getElementById('wpUrl').value.replace(/\\/$/,'');
  wpUser=document.getElementById('wpUser').value;
  wpPass=document.getElementById('wpPass').value;
  const r=document.getElementById('connRes');
  try{
    const d=await wp('/');
    connected=true;
    document.getElementById('dot').classList.add('on');
    document.getElementById('stxt').textContent=d.name||'Connecté';
    r.className='cr ok';r.innerHTML='<b style="color:var(--ok)">Connecté !</b> '+d.name+'<br>'+d.url;
    localStorage.setItem('hrb',JSON.stringify({u:wpUrl,n:wpUser}));
  }catch(e){
    connected=false;r.className='cr ko';
    let msg=e.message;
    if(msg.includes('fetch'))msg+='<br><br>Si le serveur est en ligne, c\\'est probablement un problème CORS. Installez le plugin WP "<b>WP CORS</b>" ou l\\'extension navigateur "Allow CORS".';
    r.innerHTML='<b style="color:var(--ko)">Erreur</b><br>'+msg;
  }
}
async function wp(ep,opt={}){
  const r=await fetch(wpUrl+'/wp-json'+ep,{...opt,headers:{'Authorization':'Basic '+btoa(wpUser+':'+wpPass),'Content-Type':'application/json',...(opt.headers||{})}});
  if(!r.ok){const b=await r.text();throw new Error('HTTP '+r.status+': '+b.substring(0,200));}
  return r.json();
}

// ===== PAGES GRID =====
function renderPages(){
  const silos=[...new Set(PAGES.map(p=>p.silo))];
  document.getElementById('pgStats').innerHTML=
    '<div class="stat"><div class="sv">'+PAGES.length+'</div><div class="sl">Pages</div></div>'+
    '<div class="stat"><div class="sv">'+PAGES.reduce((a,p)=>a+p.wordCount,0).toLocaleString()+'</div><div class="sl">Mots</div></div>'+
    '<div class="stat"><div class="sv">'+silos.length+'</div><div class="sl">Silos</div></div>';
  document.getElementById('siloF').innerHTML='<button class="pill on" onclick="filt(null,this)">Tout</button>'+silos.map(s=>'<button class="pill" onclick="filt(\\''+s+'\\',this)">'+s+'</button>').join('');
  document.getElementById('pgGrid').innerHTML=PAGES.map((p,i)=>'<div class="pk" data-s="'+p.silo+'" id="p'+i+'"><div class="kh"><input type=checkbox checked data-i='+i+'><div class="kt">'+p.title.substring(0,50)+'</div><span class="sb pe" id="st'+i+'">Prêt</span></div><div style="font-size:.65rem;color:var(--td)">'+p.wpSlug+' · '+(p.parentSlug||'racine')+' · '+Math.round(p.contentLen/1024)+'Ko</div></div>').join('');
}
function filt(s,btn){document.querySelectorAll('.pill').forEach(p=>p.classList.remove('on'));btn.classList.add('on');document.querySelectorAll('.pk').forEach(c=>{c.style.display=(!s||c.dataset.s===s)?'':'none';});}
function selAll(v){document.querySelectorAll('.pk input[type=checkbox]').forEach(cb=>cb.checked=v);}

// ===== MEDIA =====
function addFiles(files){
  mediaFiles=[...mediaFiles,...Array.from(files)];
  document.getElementById('mTotal').textContent=mediaFiles.length;
  document.getElementById('mList').innerHTML=mediaFiles.map(f=>'<div>'+f.name+' ('+Math.round(f.size/1024)+'Ko)</div>').join('');
}
function onDrop(e){e.preventDefault();addFiles(e.dataTransfer.files);}
async function uploadAll(){
  if(!connected)return alert('Connectez-vous d\\'abord');
  let done=0;
  for(const f of mediaFiles){
    try{
      const fd=new FormData();fd.append('file',f,f.name);
      const r=await fetch(wpUrl+'/wp-json/wp/v2/media',{method:'POST',headers:{'Authorization':'Basic '+btoa(wpUser+':'+wpPass)},body:fd});
      const d=await r.json();
      if(d.source_url)mediaMap[f.name]=d.source_url;
    }catch(e){}
    done++;
    document.getElementById('mProg').style.width=(done/mediaFiles.length*100)+'%';
    document.getElementById('mDone').textContent=done;
    await sleep(300);
  }
  alert(Object.keys(mediaMap).length+' images uploadées !');
}

// ===== CONVERT CONTENT =====
function convert(html){
  // Fix internal links for WP
  html=html.replace(/href="\\/pages\\/([^"]+)\\.html"/g,'href="'+wpUrl+'/$1/"');
  html=html.replace(/href="\\/pages\\/([^"]+)\\/"/g,'href="'+wpUrl+'/$1/"');
  html=html.replace(/href="\\/"/g,'href="'+wpUrl+'/"');
  // Fix image paths
  html=html.replace(/src="\\.\\.\\/.\\.\\/img\\//g,'src="'+wpUrl+'/wp-content/uploads/haroboz/');
  html=html.replace(/src="\\.\\.\\/img\\//g,'src="'+wpUrl+'/wp-content/uploads/haroboz/');
  html=html.replace(/src="\\/img\\//g,'src="'+wpUrl+'/wp-content/uploads/haroboz/');
  // Apply uploaded media map
  for(const[n,u] of Object.entries(mediaMap)){html=html.split(n).join(u);}
  return html;
}

// ===== PUSH =====
function setS(i,cls,txt){const e=document.getElementById('st'+i);if(e){e.className='sb '+cls;e.textContent=txt;}}
function setStep(id,cls){document.getElementById(id).className='step '+cls;}

async function getAllWpPages(){
  let all=[],p=1;
  while(true){const b=await wp('/wp/v2/pages?per_page=100&page='+p+'&status=any');all=all.concat(b);if(b.length<100)break;p++;}
  return all;
}

async function pushAll(){
  if(!connected)return alert('Connectez-vous');
  if(!confirm('Remplacer TOUT le site par les '+PAGES.length+' nouvelles pages ?'))return;
  const btn=document.getElementById('btnPush');btn.disabled=true;
  document.getElementById('logEl').innerHTML='';
  results={ok:[],ko:[],skip:[]};parentMap={};
  const status=document.getElementById('optPublish').checked?'publish':'draft';
  const doReplace=document.getElementById('optReplace').checked;
  const doSeo=document.getElementById('optSeo').checked;
  const doHome=document.getElementById('optHome').checked;
  let homeId=null;

  // Step 1
  setStep('s1','active');
  log('Scan des pages WP existantes...','info');
  let existing=[];
  try{existing=await getAllWpPages();log(existing.length+' pages trouvées','info');}catch(e){log('Erreur scan: '+e.message,'ko');}
  setStep('s1','done');

  // Step 2 - Pages
  setStep('s2','active');
  let done=0;
  for(let i=0;i<PAGES.length;i++){
    const p=PAGES[i];
    const content=convert(p.fullContent);
    const parentId=p.parentSlug?(parentMap[p.parentSlug]||0):0;
    const title=p.title.split('–')[0].split('|')[0].trim();
    const slug=p.wpSlug||'accueil';
    setS(i,'pu','Push...');
    log('Push: '+slug);
    try{
      const ex=existing.find(e=>e.slug===slug);
      let r;
      if(ex&&doReplace){
        r=await wp('/wp/v2/pages/'+ex.id,{method:'PUT',body:JSON.stringify({title,content,status,parent:parentId})});
        log('  Mise à jour #'+r.id,'ok');
      }else{
        r=await wp('/wp/v2/pages',{method:'POST',body:JSON.stringify({title,content,slug,status,parent:parentId})});
        log('  Créée #'+r.id,'ok');
      }
      if(p.isHome)homeId=r.id;
      if(!p.parentSlug||p.file.endsWith('index.html'))parentMap[p.slug]=r.id;
      // SEO
      if(doSeo){
        try{await wp('/wp/v2/pages/'+r.id,{method:'PUT',body:JSON.stringify({meta:{_yoast_wpseo_title:p.title,_yoast_wpseo_metadesc:p.metaDesc}})});}
        catch(e){try{await wp('/wp/v2/pages/'+r.id,{method:'PUT',body:JSON.stringify({meta:{rank_math_title:p.title,rank_math_description:p.metaDesc}})});}catch(e2){}}
      }
      setS(i,'dn','OK');results.ok.push(slug);
    }catch(e){
      log('  ERREUR: '+e.message,'ko');setS(i,'er','Erreur');results.ko.push(slug);
    }
    done++;
    document.getElementById('pProg').style.width=(done/PAGES.length*100)+'%';
    document.getElementById('pTxt').textContent=done+'/'+PAGES.length+' — '+results.ok.length+' OK, '+results.ko.length+' erreurs';
    await sleep(500);
  }
  setStep('s2','done');setStep('s3','done');

  // Step 4 - Homepage
  setStep('s4','active');
  if(doHome&&homeId){
    try{
      await wp('/wp/v2/settings',{method:'PUT',body:JSON.stringify({show_on_front:'page',page_on_front:homeId})});
      log('Page d\\'accueil définie #'+homeId,'ok');
    }catch(e){log('Homepage: '+e.message,'warn');}
  }
  setStep('s4','done');
  log('');log('TERMINÉ — '+results.ok.length+' OK, '+results.ko.length+' erreurs',results.ko.length?'warn':'ok');
  btn.disabled=false;
}

async function pushSelected(){
  if(!connected)return alert('Connectez-vous');
  const sel=[...document.querySelectorAll('.pk input:checked')].map(c=>+c.dataset.i);
  if(!sel.length)return alert('Aucune page sélectionnée');
  document.getElementById('logEl').innerHTML='';
  const status=document.getElementById('optPublish').checked?'publish':'draft';
  let existing=[];try{existing=await getAllWpPages();}catch(e){}
  let done=0;
  for(const i of sel){
    const p=PAGES[i];const content=convert(p.fullContent);
    const parentId=p.parentSlug?(parentMap[p.parentSlug]||0):0;
    const title=p.title.split('–')[0].split('|')[0].trim();
    const slug=p.wpSlug||'accueil';
    setS(i,'pu','Push...');
    try{
      const ex=existing.find(e=>e.slug===slug);let r;
      if(ex){r=await wp('/wp/v2/pages/'+ex.id,{method:'PUT',body:JSON.stringify({title,content,status,parent:parentId})});}
      else{r=await wp('/wp/v2/pages',{method:'POST',body:JSON.stringify({title,content,slug,status,parent:parentId})});}
      if(!p.parentSlug||p.file.endsWith('index.html'))parentMap[p.slug]=r.id;
      setS(i,'dn','OK');log('OK: '+slug+' #'+r.id,'ok');
    }catch(e){setS(i,'er','Erreur');log('ERREUR: '+slug+' '+e.message,'ko');}
    done++;document.getElementById('pProg').style.width=(done/sel.length*100)+'%';
    await sleep(500);
  }
}

async function retryFailed(){
  if(!results.ko.length)return alert('Aucun échec');
  const slugs=[...results.ko];results.ko=[];
  for(const slug of slugs){const i=PAGES.findIndex(p=>p.slug===slug);if(i>=0){document.querySelectorAll('.pk input')[i].checked=true;}}
  pushSelected();
}

async function deleteAllPages(){
  if(!connected)return alert('Connectez-vous');
  if(!confirm('SUPPRIMER TOUTES les pages WP ?'))return;
  if(prompt('Tapez SUPPRIMER')!=='SUPPRIMER')return;
  const pages=await getAllWpPages();
  for(const p of pages){try{await wp('/wp/v2/pages/'+p.id+'?force=true',{method:'DELETE'});log('Supprimée: '+p.slug,'ko');}catch(e){}await sleep(200);}
  log(pages.length+' pages supprimées','warn');
}

function exportLog(){
  const b=new Blob([JSON.stringify({date:new Date(),results,log:document.getElementById('logEl').innerText},null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='haroboz-push-'+new Date().toISOString().slice(0,10)+'.json';a.click();
}

// ===== INIT =====
try{const s=JSON.parse(localStorage.getItem('hrb')||'{}');if(s.u)document.getElementById('wpUrl').value=s.u;if(s.n)document.getElementById('wpUser').value=s.n;}catch(e){}
renderPages();
</script>
</body>
</html>`;

fs.writeFileSync(OUTPUT_FILE, html);
const stats = fs.statSync(OUTPUT_FILE);
console.log(`Generated: ${OUTPUT_FILE}`);
console.log(`Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
