#!/usr/bin/env node
/**
 * 01-scrape-public.js — Scraping du site public haroboz.com via HTTP
 *
 * Usage : node scripts/01-scrape-public.js
 *         node scripts/01-scrape-public.js --url https://haroboz.com/specific-page
 *
 * PAS BESOIN d'accès WordPress. On crawle le site comme un navigateur.
 *
 * Ce script :
 * 1. Vérifie robots.txt
 * 2. Crawle la homepage puis suit les liens internes
 * 3. Pour chaque page : extrait title, meta, Hn, images, liens, texte
 * 4. Sauvegarde dans scraping/output/{slug}.json
 * 5. Génère config/site-map.json
 */

const fs = require('fs');
const path = require('path');

const SITE_URL = 'https://haroboz.com';
const OUTPUT_DIR = path.resolve(__dirname, '..', 'scraping', 'output');
const CONFIG_DIR = path.resolve(__dirname, '..', 'config');
const DELAY_MS = 1000; // Politesse : 1s entre chaque requête
const MAX_PAGES = 100; // Sécurité : limiter le crawl

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(CONFIG_DIR, { recursive: true });

// ============================================
// PARSEURS HTML (sans dépendance externe)
// ============================================

function extractTag(html, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = html.match(regex);
  return match ? match[1].trim() : '';
}

function extractMetaContent(html, name) {
  // Cherche <meta name="..." content="..."> et <meta property="..." content="...">
  const regex = new RegExp(`<meta\\s+(?:name|property)=["']${name}["']\\s+content=["']([^"']*)["']`, 'i');
  const match = html.match(regex);
  if (match) return match[1];
  // Ordre inversé (content avant name)
  const regex2 = new RegExp(`<meta\\s+content=["']([^"']*)["']\\s+(?:name|property)=["']${name}["']`, 'i');
  const match2 = html.match(regex2);
  return match2 ? match2[1] : '';
}

function extractHeadings(html) {
  const headings = [];
  const regex = /<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    headings.push({
      tag: match[1].toLowerCase(),
      text: match[2].replace(/<[^>]+>/g, '').trim()
    });
  }
  return headings;
}

function extractImages(html) {
  const images = [];
  const regex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    const altMatch = match[0].match(/alt=["']([^"']*?)["']/i);
    images.push({
      src: match[1],
      alt: altMatch ? altMatch[1] : ''
    });
  }
  return images;
}

function extractInternalLinks(html, baseUrl) {
  const links = new Set();
  const regex = /<a[^>]+href=["']([^"'#]+)["']/gi;
  let match;
  while ((match = regex.exec(html)) !== null) {
    let href = match[1].trim();
    // Résoudre les URLs relatives
    if (href.startsWith('/')) {
      href = baseUrl + href;
    }
    // Ne garder que les liens internes
    if (href.startsWith(baseUrl)) {
      // Normaliser : enlever le trailing slash, les query params
      let clean = href.split('?')[0].split('#')[0];
      if (clean.endsWith('/') && clean !== baseUrl + '/') {
        clean = clean.slice(0, -1);
      }
      links.add(clean);
    }
  }
  return [...links];
}

function extractBodyContent(html) {
  // Extraire le contenu du <main> ou du <body> si pas de <main>
  let content = '';
  const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i);
  if (mainMatch) {
    content = mainMatch[1];
  } else {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    content = bodyMatch ? bodyMatch[1] : html;
  }
  return content;
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function urlToSlug(url, baseUrl) {
  let slug = url.replace(baseUrl, '').replace(/^\/|\/$/g, '');
  return slug || 'accueil';
}

// ============================================
// CRAWLER
// ============================================

async function fetchPage(url) {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HarobozScraper/1.0; SEO audit)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      console.warn(`   ⚠️  ${response.status} pour ${url}`);
      return null;
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html')) {
      return null; // Ignorer les fichiers non-HTML
    }

    return await response.text();
  } catch (err) {
    console.warn(`   ❌ Erreur fetch ${url}: ${err.message}`);
    return null;
  }
}

async function scrapePage(url, baseUrl) {
  const html = await fetchPage(url);
  if (!html) return null;

  const slug = urlToSlug(url, baseUrl);
  const bodyContent = extractBodyContent(html);
  const plainText = htmlToText(bodyContent);
  const headings = extractHeadings(bodyContent);
  const images = extractImages(bodyContent);
  const internalLinks = extractInternalLinks(html, baseUrl);

  return {
    url,
    slug,
    title: extractTag(html, 'title'),
    meta_description: extractMetaContent(html, 'description'),
    meta_og_title: extractMetaContent(html, 'og:title'),
    meta_og_description: extractMetaContent(html, 'og:description'),
    meta_og_image: extractMetaContent(html, 'og:image'),
    canonical: (() => {
      const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
      return m ? m[1] : '';
    })(),
    headings,
    h1: headings.filter(h => h.tag === 'h1').map(h => h.text),
    h2s: headings.filter(h => h.tag === 'h2').map(h => h.text),
    images,
    images_count: images.length,
    images_no_alt: images.filter(i => !i.alt).length,
    internal_links: internalLinks,
    internal_links_count: internalLinks.length,
    word_count: plainText.split(' ').filter(w => w.length > 1).length,
    body_html: bodyContent,
    plain_text: plainText.substring(0, 5000), // Limiter pour le JSON
    full_html: html,
    scraped_at: new Date().toISOString()
  };
}

// ============================================
// MAIN
// ============================================

async function main() {
  console.log('🕷️  SCRAPING PUBLIC — HAROBOZ.COM');
  console.log('==================================\n');

  const args = process.argv.slice(2);
  const singleUrl = args.find(a => a.startsWith('--url='))?.split('=')[1];

  // 1. Vérifier robots.txt
  console.log('1️⃣  Vérification robots.txt...');
  const robotsTxt = await fetchPage(`${SITE_URL}/robots.txt`);
  if (robotsTxt) {
    console.log('   📄 robots.txt trouvé :');
    console.log('   ' + robotsTxt.split('\n').slice(0, 10).join('\n   '));
    // Vérification basique : pas de Disallow: /
    if (robotsTxt.includes('Disallow: /\n') || robotsTxt.includes('Disallow: / ')) {
      console.warn('\n   ⚠️  Le site interdit le crawl complet. On continue sur les pages publiques accessibles.');
    }
  } else {
    console.log('   Pas de robots.txt — on continue.');
  }
  console.log('');

  // 2. Crawler
  const visited = new Set();
  const toVisit = singleUrl ? [singleUrl] : [`${SITE_URL}/`];
  const allPages = [];

  console.log(`2️⃣  Début du crawl depuis ${toVisit[0]}...\n`);

  while (toVisit.length > 0 && visited.size < MAX_PAGES) {
    const url = toVisit.shift();

    // Normaliser
    let normalizedUrl = url.split('?')[0].split('#')[0];
    if (normalizedUrl.endsWith('/') && normalizedUrl !== `${SITE_URL}/`) {
      normalizedUrl = normalizedUrl.slice(0, -1);
    }

    if (visited.has(normalizedUrl)) continue;
    visited.add(normalizedUrl);

    // Ignorer les fichiers statiques
    if (/\.(jpg|jpeg|png|gif|svg|pdf|css|js|xml|ico|woff|woff2|ttf|eot)$/i.test(normalizedUrl)) {
      continue;
    }

    console.log(`   🔍 [${visited.size}/${MAX_PAGES}] ${normalizedUrl}`);

    const pageData = await scrapePage(normalizedUrl, SITE_URL);
    if (!pageData) continue;

    allPages.push(pageData);

    // Sauvegarder la page
    const safeSlug = pageData.slug.replace(/\//g, '_') || 'accueil';
    const outputPath = path.join(OUTPUT_DIR, `${safeSlug}.json`);
    fs.writeFileSync(outputPath, JSON.stringify(pageData, null, 2), 'utf8');

    // Ajouter les liens internes à visiter (sauf si single URL)
    if (!singleUrl) {
      for (const link of pageData.internal_links) {
        if (!visited.has(link) && !toVisit.includes(link)) {
          toVisit.push(link);
        }
      }
    }

    // Politesse
    await new Promise(r => setTimeout(r, DELAY_MS));
  }

  // 3. Générer la sitemap
  console.log('\n3️⃣  Génération de la cartographie...');

  const siteMap = {
    generated_at: new Date().toISOString(),
    site_url: SITE_URL,
    crawl_mode: 'public_http',
    pages: allPages.map(p => ({
      url: p.url,
      slug: p.slug,
      title: p.title,
      h1: p.h1,
      word_count: p.word_count,
      images_count: p.images_count,
      internal_links_count: p.internal_links_count,
      has_meta_description: !!p.meta_description
    })),
    stats: {
      total_pages: allPages.length,
      total_words: allPages.reduce((sum, p) => sum + p.word_count, 0),
      avg_words: Math.round(allPages.reduce((sum, p) => sum + p.word_count, 0) / (allPages.length || 1)),
      pages_without_h1: allPages.filter(p => p.h1.length === 0).length,
      pages_without_meta: allPages.filter(p => !p.meta_description).length,
      total_images: allPages.reduce((sum, p) => sum + p.images_count, 0),
      images_without_alt: allPages.reduce((sum, p) => sum + p.images_no_alt, 0)
    }
  };

  fs.writeFileSync(
    path.join(CONFIG_DIR, 'site-map.json'),
    JSON.stringify(siteMap, null, 2), 'utf8'
  );

  // 4. Résumé
  console.log('\n========================================');
  console.log('📊 RÉSUMÉ DU SCRAPING');
  console.log('========================================');
  console.log(`   Pages crawlées   : ${siteMap.stats.total_pages}`);
  console.log(`   Mots totaux      : ${siteMap.stats.total_words}`);
  console.log(`   Mots moyens/page : ${siteMap.stats.avg_words}`);
  console.log(`   Sans H1          : ${siteMap.stats.pages_without_h1}`);
  console.log(`   Sans meta desc   : ${siteMap.stats.pages_without_meta}`);
  console.log(`   Images totales   : ${siteMap.stats.total_images}`);
  console.log(`   Images sans alt  : ${siteMap.stats.images_without_alt}`);
  console.log(`\n   📁 Pages dans  : scraping/output/`);
  console.log(`   🗺️  Sitemap dans : config/site-map.json`);
  console.log('\n   ➡️  Prochaine étape : node scripts/02-analyze-structure.js');
}

main().catch(err => {
  console.error('❌ Erreur fatale :', err);
  process.exit(1);
});
