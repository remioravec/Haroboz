#!/usr/bin/env node
/**
 * HAROBOZ — Remplacement Complet du Site WordPress
 *
 * Serveur local + interface web.
 * Récupère les images existantes du WP, remplace les URLs, pousse tout.
 *
 * Usage: node wp-push/replace-site.js
 * Puis ouvrir http://localhost:4000
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
app.use(express.json({ limit: '50mb' }));

const PREVIEW_DIR = path.join(__dirname, '..', 'preview');
const PORT = 4000;

// ===== WordPress API proxy =====
async function wpFetch(baseUrl, user, pass, endpoint, method = 'GET', body = null) {
  const url = `${baseUrl}/wp-json${endpoint}`;
  const headers = {
    'Authorization': 'Basic ' + Buffer.from(`${user}:${pass}`).toString('base64'),
    'Content-Type': 'application/json',
  };
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const resp = await fetch(url, opts);
  const text = await resp.text();
  if (!resp.ok) throw new Error(`WP ${resp.status}: ${text.substring(0, 300)}`);
  return JSON.parse(text);
}

// ===== Extract from HTML =====
function extractTitle(html) {
  const m = html.match(/<title>([^<]*)<\/title>/i);
  return m ? m[1].trim() : '';
}
function extractMeta(html) {
  const m = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']*)["']/i);
  return m ? m[1].trim() : '';
}
function extractStyles(html) {
  const styles = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(html)) !== null) styles.push(m[1]);
  return styles.join('\n');
}
function extractBody(html) {
  const m = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return m ? m[1].trim() : '';
}

// CSS to hide WP theme
const HIDE_WP = `
#wpadminbar{display:none!important}
html{margin-top:0!important}
.site-header,#masthead,.wp-site-blocks>header:first-child,
.site-footer,#colophon,.wp-site-blocks>footer:last-child,
.sidebar,.widget-area,.entry-header,.page-header,
.entry-footer,.post-navigation,.nav-links,.entry-meta,
.cat-links,.tags-links,.edit-link,.comments-area,#comments{display:none!important}
body,html,.site,.site-content,.content-area,.site-main,
.entry-content,.page-content,.wp-site-blocks,
.wp-block-post-content,.has-global-padding{
max-width:100%!important;width:100%!important;padding:0!important;margin:0!important}
.entry-content>*,.wp-block-post-content>*{max-width:100%!important;margin-left:0!important;margin-right:0!important}
`;

// ===== Build page registry =====
function findHtml(dir) {
  let r = [];
  if (!fs.existsSync(dir)) return r;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) r = r.concat(findHtml(fp));
    else if (e.name.endsWith('.html')) r.push(fp);
  }
  return r;
}

function buildPages() {
  const files = findHtml(PREVIEW_DIR);
  const pages = [];

  for (const fp of files) {
    const rel = path.relative(PREVIEW_DIR, fp).replace(/\\/g, '/');
    const html = fs.readFileSync(fp, 'utf-8');
    const isHome = rel === 'index.html';
    const parts = rel.split('/');

    let slug, wpSlug, parentSlug;
    if (isHome) { slug = 'accueil'; wpSlug = ''; parentSlug = null; }
    else if (parts.length === 2 && parts[0] === 'pages') {
      slug = parts[1].replace('.html', ''); wpSlug = slug; parentSlug = null;
    } else if (parts.length === 3 && parts[2] === 'index.html') {
      slug = parts[1]; wpSlug = parts[1]; parentSlug = null;
    } else if (parts.length === 3) {
      slug = parts[2].replace('.html', ''); wpSlug = slug; parentSlug = parts[1];
    } else { slug = rel.replace('.html', ''); wpSlug = slug; parentSlug = null; }

    // Extract all images referenced in this page
    const imgRefs = [];
    const imgRe = /src=["']([^"']*\.(png|jpg|jpeg|webp|svg))["']/gi;
    let im;
    while ((im = imgRe.exec(html)) !== null) {
      if (!imgRefs.includes(im[1])) imgRefs.push(im[1]);
    }

    pages.push({
      file: rel, slug, wpSlug, parentSlug, isHome,
      title: extractTitle(html),
      metaDesc: extractMeta(html),
      styles: extractStyles(html),
      body: extractBody(html),
      images: imgRefs,
    });
  }

  // Sort: home first, parents, then children
  pages.sort((a, b) => {
    if (a.isHome) return -1; if (b.isHome) return 1;
    if (!a.parentSlug && b.parentSlug) return -1;
    if (a.parentSlug && !b.parentSlug) return 1;
    return 0;
  });

  return pages;
}

const PAGES = buildPages();
console.log(`${PAGES.length} pages loaded from preview/`);

// ===== API Routes =====

// Test connection
app.post('/api/test', async (req, res) => {
  try {
    const { url, user, pass } = req.body;
    const data = await wpFetch(url, user, pass, '/');
    res.json({ ok: true, name: data.name, url: data.url });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// Get all WP media (to build image URL map)
app.post('/api/media', async (req, res) => {
  try {
    const { url, user, pass } = req.body;
    let all = [], page = 1;
    while (true) {
      const batch = await wpFetch(url, user, pass, `/wp/v2/media?per_page=100&page=${page}`);
      all = all.concat(batch.map(m => ({
        id: m.id,
        filename: m.source_url.split('/').pop(),
        url: m.source_url,
        title: m.title?.rendered || '',
      })));
      if (batch.length < 100) break;
      page++;
    }
    res.json({ ok: true, media: all, count: all.length });
  } catch (e) {
    res.json({ ok: false, error: e.message, media: [] });
  }
});

// Get all WP pages
app.post('/api/wp-pages', async (req, res) => {
  try {
    const { url, user, pass } = req.body;
    let all = [], page = 1;
    while (true) {
      const batch = await wpFetch(url, user, pass, `/wp/v2/pages?per_page=100&page=${page}&status=any`);
      all = all.concat(batch.map(p => ({ id: p.id, slug: p.slug, title: p.title?.rendered })));
      if (batch.length < 100) break;
      page++;
    }
    res.json({ ok: true, pages: all });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// Get pages registry
app.get('/api/pages', (req, res) => {
  res.json(PAGES.map(p => ({
    file: p.file, slug: p.slug, wpSlug: p.wpSlug,
    parentSlug: p.parentSlug, isHome: p.isHome,
    title: p.title, metaDesc: p.metaDesc,
    bodyLen: p.body.length, imageCount: p.images.length,
  })));
});

// Push a single page
app.post('/api/push', async (req, res) => {
  try {
    const { url, user, pass, index, mediaMap, parentMap, status } = req.body;
    const p = PAGES[index];
    if (!p) return res.json({ ok: false, error: 'Page not found' });

    // Build full content with styles + assets + body
    let content = p.body;

    // Replace image URLs with WP media URLs
    if (mediaMap) {
      for (const [localPath, wpUrl] of Object.entries(mediaMap)) {
        content = content.split(localPath).join(wpUrl);
      }
    }

    // Replace internal links
    content = content.replace(/href="\/pages\/([^"]+)\.html"/g, `href="${url}/$1/"`);
    content = content.replace(/href="\/pages\/([^"]+)\/"/g, `href="${url}/$1/"`);
    content = content.replace(/href="\/"/g, `href="${url}/"`);

    // Wrap with styles and assets
    const fullContent = `<style>${HIDE_WP}\n${p.styles}</style>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config={theme:{extend:{colors:{brand:{DEFAULT:'#0a1a3a',light:'#122a5c','50':'#e8edf5'}},fontFamily:{sans:['Inter','sans-serif'],serif:['Playfair Display','serif']}}}}</script>
<script src="https://unpkg.com/lucide@latest"></script>
<div class="haroboz-page">${content}</div>`;

    const parentId = p.parentSlug && parentMap?.[p.parentSlug] ? parentMap[p.parentSlug] : 0;
    const title = p.title.split('–')[0].split('|')[0].trim();
    const slug = p.wpSlug || 'accueil';

    // Check if exists
    let existing = null;
    try {
      const ex = await wpFetch(url, user, pass, `/wp/v2/pages?slug=${slug}&status=any`);
      if (ex.length > 0) existing = ex[0];
    } catch(e) {}

    let result;
    if (existing) {
      result = await wpFetch(url, user, pass, `/wp/v2/pages/${existing.id}`, 'PUT', {
        title, content: fullContent, status: status || 'draft', parent: parentId
      });
    } else {
      result = await wpFetch(url, user, pass, '/wp/v2/pages', 'POST', {
        title, content: fullContent, slug, status: status || 'draft', parent: parentId
      });
    }

    // Try SEO meta
    try {
      await wpFetch(url, user, pass, `/wp/v2/pages/${result.id}`, 'PUT', {
        meta: { _yoast_wpseo_title: p.title, _yoast_wpseo_metadesc: p.metaDesc }
      });
    } catch(e) {
      try {
        await wpFetch(url, user, pass, `/wp/v2/pages/${result.id}`, 'PUT', {
          meta: { rank_math_title: p.title, rank_math_description: p.metaDesc }
        });
      } catch(e2) {}
    }

    res.json({ ok: true, id: result.id, slug: result.slug, isNew: !existing });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// Set homepage
app.post('/api/set-homepage', async (req, res) => {
  try {
    const { url, user, pass, pageId } = req.body;
    await wpFetch(url, user, pass, '/wp/v2/settings', 'PUT', {
      show_on_front: 'page', page_on_front: pageId
    });
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// Delete all WP pages
app.post('/api/delete-all', async (req, res) => {
  try {
    const { url, user, pass } = req.body;
    let all = [], page = 1;
    while (true) {
      const batch = await wpFetch(url, user, pass, `/wp/v2/pages?per_page=100&page=${page}&status=any`);
      all = all.concat(batch);
      if (batch.length < 100) break;
      page++;
    }
    let deleted = 0;
    for (const p of all) {
      try {
        await wpFetch(url, user, pass, `/wp/v2/pages/${p.id}?force=true`, 'DELETE');
        deleted++;
      } catch(e) {}
    }
    res.json({ ok: true, deleted, total: all.length });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// ===== Serve Web UI =====
app.get('/', (req, res) => {
  res.send(UI_HTML);
});

const UI_HTML = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>HAROBOZ — Remplacer le Site</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Playfair+Display:wght@400;600&display=swap" rel="stylesheet">
<style>
:root{--n:#0a1a3a;--nl:#122a5c;--ns:#0d2248;--g:#c9a84c;--gl:#e0c777;--ok:#22c55e;--ko:#ef4444;--info:#3b82f6;--t:#e2e8f0;--td:#94a3b8;--tb:#f8fafc;--b:#1e3a5f;--c:#0d2248}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Inter',sans-serif;background:var(--n);color:var(--t);min-height:100vh}
h1,h2,h3{font-family:'Playfair Display',serif}
.ctn{max-width:1000px;margin:0 auto;padding:20px}
.hdr{background:var(--nl);padding:16px 0;border-bottom:1px solid var(--b)}
.hdr .ctn{display:flex;align-items:center;justify-content:space-between}
.hdr h1{font-size:1.2rem;color:var(--g)}
.hdr h1 span{font-family:Inter;font-weight:400;font-size:.75rem;color:var(--td);margin-left:8px}
.conn{display:flex;align-items:center;gap:8px;font-size:.8rem}
.dot{width:10px;height:10px;border-radius:50%;background:var(--ko)}.dot.on{background:var(--ok)}
.card{background:var(--c);border:1px solid var(--b);border-radius:8px;padding:16px;margin-bottom:16px}
.fg{margin-bottom:10px}
.fg label{display:block;font-size:.7rem;font-weight:500;color:var(--td);margin-bottom:2px;text-transform:uppercase}
.fg input{width:100%;padding:8px 10px;background:var(--ns);border:1px solid var(--b);border-radius:6px;color:var(--t);font-size:.85rem}
.fg input:focus{outline:none;border-color:var(--g)}
.row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.btn{display:inline-flex;align-items:center;gap:6px;padding:10px 18px;border:none;border-radius:6px;font-weight:600;font-size:.8rem;cursor:pointer;transition:.2s;font-family:Inter}
.btn-g{background:var(--g);color:var(--n)}.btn-g:hover{background:var(--gl)}.btn-g:disabled{opacity:.5;cursor:not-allowed}
.btn-d{background:var(--ko);color:#fff}.btn-d:hover{background:#dc2626}
.btn-o{background:transparent;border:1px solid var(--b);color:var(--t)}.btn-o:hover{border-color:var(--g);color:var(--g)}
.btn-sm{padding:6px 12px;font-size:.7rem}
.msg{padding:10px;border-radius:6px;font-size:.8rem;margin-top:8px;display:none}
.msg.ok{display:block;background:rgba(34,197,94,.1);border:1px solid var(--ok);color:var(--ok)}
.msg.ko{display:block;background:rgba(239,68,68,.1);border:1px solid var(--ko);color:var(--ko)}
.msg.info{display:block;background:rgba(59,130,246,.1);border:1px solid var(--info);color:var(--info)}
.pbc{width:100%;height:8px;background:var(--ns);border-radius:4px;overflow:hidden;margin:8px 0}
.pbf{height:100%;background:linear-gradient(90deg,var(--g),var(--gl));border-radius:4px;transition:width .3s;width:0}
.log{background:#030b18;border:1px solid var(--b);border-radius:6px;padding:10px;max-height:400px;overflow-y:auto;font-family:'Courier New',monospace;font-size:.72rem;line-height:1.7}
.le{padding:1px 0}.le.ok{color:var(--ok)}.le.ko{color:var(--ko)}.le.info{color:var(--info)}.le.warn{color:var(--g)}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px}
.stat{background:var(--ns);border-radius:6px;padding:10px;text-align:center}
.stat b{display:block;font-size:1.4rem;color:var(--g);font-family:'Playfair Display'}
.stat small{font-size:.6rem;color:var(--td);text-transform:uppercase}
.check{display:flex;align-items:center;gap:6px;font-size:.8rem;color:var(--td);margin-bottom:6px;cursor:pointer}
.check input{accent-color:var(--g)}
hr{border:none;border-top:1px solid var(--b);margin:16px 0}
.danger{border-color:var(--ko);background:rgba(239,68,68,.03)}
@media(max-width:600px){.row{grid-template-columns:1fr}.stats{grid-template-columns:1fr 1fr}}
</style>
</head>
<body>

<header class="hdr"><div class="ctn">
  <h1>HAROBOZ <span>Remplacer le Site</span></h1>
  <div class="conn"><div class="dot" id="dot"></div><span id="stxt">Non connecté</span></div>
</div></header>

<div class="ctn">

<!-- STEP 1: CONNECTION -->
<div class="card">
  <h2 style="color:var(--g);font-size:1rem;margin-bottom:12px">1. Connexion WordPress</h2>
  <div class="fg"><label>URL du site</label><input id="wpUrl" value="https://haroboz.com"></div>
  <div class="row">
    <div class="fg"><label>Utilisateur</label><input id="wpUser" value="admin"></div>
    <div class="fg"><label>Mot de passe application</label><input id="wpPass" type="password" placeholder="xxxx xxxx xxxx xxxx"></div>
  </div>
  <button class="btn btn-g" onclick="testConn()">Tester la connexion</button>
  <div class="msg" id="connMsg"></div>
</div>

<!-- STEP 2: MEDIA SCAN -->
<div class="card">
  <h2 style="color:var(--g);font-size:1rem;margin-bottom:12px">2. Scanner les images existantes</h2>
  <p style="font-size:.8rem;color:var(--td);margin-bottom:10px">Récupère toutes les images déjà sur le WordPress pour les réutiliser dans les nouvelles pages.</p>
  <button class="btn btn-g" onclick="scanMedia()" id="btnMedia">Scanner la médiathèque WP</button>
  <div class="msg" id="mediaMsg"></div>
</div>

<!-- STEP 3: PUSH -->
<div class="card">
  <h2 style="color:var(--g);font-size:1rem;margin-bottom:12px">3. Remplacer le site</h2>
  <div class="stats">
    <div class="stat"><b id="nPages">${PAGES.length}</b><small>Pages</small></div>
    <div class="stat"><b id="nMedia">0</b><small>Images mappées</small></div>
    <div class="stat"><b id="nOk">0</b><small>Succès</small></div>
    <div class="stat"><b id="nKo">0</b><small>Erreurs</small></div>
  </div>
  <label class="check"><input type="checkbox" id="optPub"> Publier directement (sinon brouillon)</label>
  <label class="check"><input type="checkbox" id="optSeo" checked> Mettre à jour meta SEO</label>
  <label class="check"><input type="checkbox" id="optHome" checked> Définir la page d'accueil</label>
  <hr>
  <div style="display:flex;gap:8px;flex-wrap:wrap">
    <button class="btn btn-g" style="padding:12px 24px;font-size:.9rem" onclick="pushAll()" id="btnPush">
      REMPLACER TOUT LE SITE
    </button>
    <button class="btn btn-o" onclick="retryFailed()">Relancer les échecs</button>
  </div>
  <div class="pbc"><div class="pbf" id="prog"></div></div>
  <div style="font-size:.8rem;color:var(--td)" id="progTxt">En attente...</div>
</div>

<!-- LOG -->
<div class="card">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
    <h3 style="color:var(--g);font-size:.9rem">Journal</h3>
    <button class="btn btn-o btn-sm" onclick="exportLog()">Exporter</button>
  </div>
  <div class="log" id="log"><div class="le info">Prêt. Connectez-vous puis cliquez sur Remplacer.</div></div>
</div>

<!-- DANGER -->
<div class="card danger">
  <h3 style="color:var(--ko);font-size:.85rem;margin-bottom:8px">Zone dangereuse</h3>
  <button class="btn btn-d btn-sm" onclick="deleteAll()">Supprimer toutes les pages WP</button>
</div>

</div>

<script>
let wpUrl='',wpUser='',wpPass='',connected=false;
let mediaMap={};  // filename -> wpUrl
let parentMap={}; // slug -> wpPageId
let results={ok:[],ko:[]};

function log(m,t=''){const d=document.createElement('div');d.className='le '+t;d.textContent=new Date().toLocaleTimeString()+' — '+m;const l=document.getElementById('log');l.appendChild(d);l.scrollTop=l.scrollHeight;}
function creds(){return{url:wpUrl,user:wpUser,pass:wpPass};}

async function testConn(){
  wpUrl=document.getElementById('wpUrl').value.replace(/\\/$/,'');
  wpUser=document.getElementById('wpUser').value;
  wpPass=document.getElementById('wpPass').value;
  const m=document.getElementById('connMsg');
  m.className='msg info';m.textContent='Connexion...';
  try{
    const r=await(await fetch('/api/test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(creds())})).json();
    if(r.ok){connected=true;m.className='msg ok';m.innerHTML='<b>Connecté !</b> '+r.name;document.getElementById('dot').classList.add('on');document.getElementById('stxt').textContent=r.name;}
    else{m.className='msg ko';m.textContent='Erreur: '+r.error;}
  }catch(e){m.className='msg ko';m.textContent='Erreur réseau: '+e.message;}
}

async function scanMedia(){
  if(!connected)return alert('Connectez-vous d\\'abord');
  const m=document.getElementById('mediaMsg');const btn=document.getElementById('btnMedia');
  m.className='msg info';m.textContent='Scan en cours...';btn.disabled=true;
  try{
    const r=await(await fetch('/api/media',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(creds())})).json();
    if(r.ok){
      // Build mapping: match filenames from preview to WP media URLs
      mediaMap={};
      for(const img of r.media){
        const fn=img.filename.toLowerCase();
        mediaMap[fn]=img.url;
        // Also map without extension changes
        mediaMap[img.filename]=img.url;
      }
      document.getElementById('nMedia').textContent=r.count;
      m.className='msg ok';m.innerHTML='<b>'+r.count+' images trouvées.</b> Les URLs seront automatiquement remplacées dans le contenu.';
      log(r.count+' images récupérées de la médiathèque WP','ok');
    }else{m.className='msg ko';m.textContent='Erreur: '+r.error;}
  }catch(e){m.className='msg ko';m.textContent=e.message;}
  btn.disabled=false;
}

async function pushAll(){
  if(!connected)return alert('Connectez-vous');
  if(!confirm('Remplacer TOUT le site WordPress ?'))return;
  const btn=document.getElementById('btnPush');btn.disabled=true;
  document.getElementById('log').innerHTML='';
  results={ok:[],ko:[]};parentMap={};
  const status=document.getElementById('optPub').checked?'publish':'draft';
  let homeId=null;

  log('Démarrage du remplacement...','info');

  const pages=await(await fetch('/api/pages')).json();

  for(let i=0;i<pages.length;i++){
    const p=pages[i];
    log('Push '+p.slug+' ('+p.title.substring(0,40)+')...');

    try{
      const r=await(await fetch('/api/push',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
        ...creds(),index:i,mediaMap,parentMap,status
      })})).json();

      if(r.ok){
        log('  ✓ '+(r.isNew?'Créée':'Mise à jour')+' #'+r.id,'ok');
        if(p.isHome)homeId=r.id;
        if(!p.parentSlug)parentMap[p.slug]=r.id;
        if(p.file.endsWith('index.html'))parentMap[p.slug]=r.id;
        results.ok.push(p.slug);
      }else{
        log('  ✗ '+r.error,'ko');
        results.ko.push(p.slug);
      }
    }catch(e){
      log('  ✗ Réseau: '+e.message,'ko');
      results.ko.push(p.slug);
    }

    document.getElementById('nOk').textContent=results.ok.length;
    document.getElementById('nKo').textContent=results.ko.length;
    document.getElementById('prog').style.width=((i+1)/pages.length*100)+'%';
    document.getElementById('progTxt').textContent=(i+1)+'/'+pages.length+' — '+results.ok.length+' OK, '+results.ko.length+' erreurs';
  }

  // Set homepage
  if(document.getElementById('optHome').checked&&homeId){
    log('Définition page d\\'accueil #'+homeId+'...','info');
    try{
      const r=await(await fetch('/api/set-homepage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...creds(),pageId:homeId})})).json();
      if(r.ok)log('Page d\\'accueil définie','ok');else log('Erreur homepage: '+r.error,'ko');
    }catch(e){log('Erreur homepage: '+e.message,'ko');}
  }

  log('');
  log('TERMINÉ — '+results.ok.length+' OK, '+results.ko.length+' erreurs',results.ko.length?'warn':'ok');
  btn.disabled=false;
}

async function retryFailed(){
  if(!results.ko.length)return alert('Aucun échec');
  alert('Relance de '+results.ko.length+' pages en erreur...');
  // TODO: implement retry
}

async function deleteAll(){
  if(!connected)return alert('Connectez-vous');
  if(!confirm('SUPPRIMER toutes les pages WP ?'))return;
  if(prompt('Tapez SUPPRIMER pour confirmer')!=='SUPPRIMER')return;
  log('Suppression de toutes les pages...','warn');
  const r=await(await fetch('/api/delete-all',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(creds())})).json();
  if(r.ok)log(r.deleted+'/'+r.total+' pages supprimées','warn');
  else log('Erreur: '+r.error,'ko');
}

function exportLog(){
  const b=new Blob([document.getElementById('log').innerText],{type:'text/plain'});
  const a=document.createElement('a');a.href=URL.createObjectURL(b);a.download='haroboz-push.log';a.click();
}
</script>
</body>
</html>`;

// ===== Start server =====
app.listen(PORT, () => {
  console.log(`\n╔══════════════════════════════════════════════╗`);
  console.log(`║  HAROBOZ — Remplacement du Site WordPress     ║`);
  console.log(`╠══════════════════════════════════════════════╣`);
  console.log(`║  ${PAGES.length} pages prêtes                              ║`);
  console.log(`║  Ouvrir: http://localhost:${PORT}                  ║`);
  console.log(`╚══════════════════════════════════════════════╝\n`);
});
