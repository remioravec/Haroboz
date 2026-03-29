/**
 * wp-api.js — Module de connexion API REST WordPress
 * ⚠️ PHASE B — À utiliser quand le client donne les accès WP
 *
 * Prérequis :
 * 1. Copier .env.example → .env
 * 2. Remplir les credentials
 * 3. Créer un Application Password dans WP Admin
 */

const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.resolve(__dirname, '.env');
  if (!fs.existsSync(envPath)) {
    console.error('❌ Fichier .env introuvable dans wp-push/');
    console.error('   Copier .env.example → .env et remplir les credentials.');
    process.exit(1);
  }
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [key, ...val] = trimmed.split('=');
    env[key.trim()] = val.join('=').trim();
  }
  return env;
}

const ENV = loadEnv();
const BASE_URL = ENV.WP_SITE_URL?.replace(/\/$/, '');
const AUTH = Buffer.from(`${ENV.WP_USERNAME}:${ENV.WP_APP_PASSWORD}`).toString('base64');

async function wpFetch(endpoint, options = {}) {
  const url = `${BASE_URL}/wp-json${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Basic ${AUTH}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`WP API ${response.status} on ${endpoint}: ${body}`);
  }
  return response.json();
}

async function testConnection() {
  try {
    const site = await wpFetch('/');
    console.log(`✅ Connecté : ${site.name} (${site.url})`);
    return true;
  } catch (e) {
    console.error(`❌ Connexion échouée : ${e.message}`);
    return false;
  }
}

async function getAllPages() {
  let all = [], page = 1, more = true;
  while (more) {
    const batch = await wpFetch(`/wp/v2/pages?per_page=100&page=${page}`);
    all = all.concat(batch);
    more = batch.length === 100;
    page++;
  }
  return all;
}

async function createPage(data) {
  return wpFetch('/wp/v2/pages', {
    method: 'POST',
    body: JSON.stringify({ ...data, status: 'draft' })
  });
}

async function updatePage(id, data) {
  return wpFetch(`/wp/v2/pages/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
}

module.exports = { wpFetch, testConnection, getAllPages, createPage, updatePage, ENV, BASE_URL };
