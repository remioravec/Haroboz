#!/usr/bin/env node
/**
 * 04-serve-local.js — Serveur local pour preview
 *
 * Usage : node scripts/04-serve-local.js
 *         node scripts/04-serve-local.js --port 8080
 *
 * Sert le dossier preview/ sur http://localhost:3000
 * Zéro dépendance — Node.js natif uniquement
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PREVIEW_DIR = path.resolve(__dirname, '..', 'preview');
const PORT = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1]) || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // Défaut : index.html
  if (urlPath === '/') urlPath = '/index.html';

  // Essayer avec .html ou index.html si pas d'extension
  let filePath = path.join(PREVIEW_DIR, urlPath);
  if (!path.extname(filePath)) {
    // Dossier → chercher index.html
    const indexPath = path.join(filePath, 'index.html');
    if (fs.existsSync(indexPath)) {
      filePath = indexPath;
    } else if (fs.existsSync(filePath + '.html')) {
      filePath = filePath + '.html';
    }
  }
  // Fallback : essayer dans pages/
  if (!fs.existsSync(filePath)) {
    const pagesPath = path.join(PREVIEW_DIR, 'pages', urlPath.replace(/^\//, ''));
    if (fs.existsSync(pagesPath)) {
      filePath = pagesPath;
    } else if (fs.existsSync(path.join(pagesPath, 'index.html'))) {
      filePath = path.join(pagesPath, 'index.html');
    } else if (fs.existsSync(pagesPath + '.html')) {
      filePath = pagesPath + '.html';
    }
  }

  // Sécurité : ne pas sortir du dossier preview
  if (!filePath.startsWith(PREVIEW_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<h1>404</h1><p>Page introuvable : ${urlPath}</p><p><a href="/">← Retour à l'accueil</a></p>`);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500);
      res.end('Erreur serveur');
      return;
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-cache'
    });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n🌐 HAROBOZ Preview Server`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   Dossier : ${PREVIEW_DIR}`);
  console.log(`\n   Ctrl+C pour arrêter\n`);
});
