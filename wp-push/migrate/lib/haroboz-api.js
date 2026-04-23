// wp-push/migrate/lib/haroboz-api.js
// Client for the custom endpoint exposed by haroboz-deploy.php.
// Bypasses LiteSpeed auth strip by using a shared secret instead of Basic/Bearer auth.

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const SITE = (process.env.WP_SITE_URL || '').replace(/\/$/, '');
if (!SITE) throw new Error('WP_SITE_URL missing in .env');

const KEY_FILE = path.resolve(__dirname, '../../.haroboz-api-key');
if (!fs.existsSync(KEY_FILE)) {
  throw new Error(`Missing ${KEY_FILE}. Run: node scripts/build-deploy-plugin.js first.`);
}
const API_KEY = fs.readFileSync(KEY_FILE, 'utf8').trim();

/**
 * Call the Haroboz API.
 * @param {string} action - ping, diag, list_pages, get_page, update_page, create_page,
 *                          create_elementor_library, list_media, upload_media,
 *                          list_plugins, toggle_plugin, active_theme, rest_namespaces
 * @param {object} params
 */
async function api(action, params = {}) {
  const url = `${SITE}/?haroboz_api=1`;
  const body = JSON.stringify({ action, params });
  // Retry 5x with generous backoff for LiteSpeed/WAF flakes on 5xx
  let lastErr;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Haroboz-Key': API_KEY,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'Connection': 'close',
        },
        body,
      });
      const text = await res.text();
      let json;
      try { json = JSON.parse(text); } catch { json = { raw: text.slice(0, 800) }; }
      if (!res.ok) {
        // 4xx = client error, don't retry
        if (res.status >= 400 && res.status < 500) {
          throw new Error(`Haroboz API ${action} → ${res.status}: ${JSON.stringify(json).slice(0, 400)}`);
        }
        // 5xx → retry
        const sample = JSON.stringify(json).slice(0, 200);
        throw new Error(`transient ${res.status}: ${sample}`);
      }
      if (json.ok === false) {
        throw new Error(`Haroboz API ${action} error: ${json.error || 'unknown'} (${json.file}:${json.line})`);
      }
      return json.data;
    } catch (e) {
      lastErr = e;
      if (attempt < 5) {
        const delayMs = attempt * 3000; // 3s, 6s, 9s, 12s
        await new Promise(r => setTimeout(r, delayMs));
      }
    }
  }
  throw lastErr;
}

// Convenience functions
const ping = () => api('ping');
const diag = () => api('diag');
const listPages = (status = 'any') => api('list_pages', { status });
const getPage = (id) => api('get_page', { id });
const updatePage = (id, data) => api('update_page', { id, data });
const createPage = (data) => api('create_page', { data });
const createLibraryItem = (data) => api('create_elementor_library', { data });
const listMedia = async () => {
  const all = [];
  let offset = 0;
  while (true) {
    const batch = await api('list_media', { offset, limit: 100 });
    if (!batch.length) break;
    all.push(...batch);
    if (batch.length < 100) break;
    offset += 100;
  }
  return all;
};
const uploadMedia = (filename, mime, base64Data, title, alt) =>
  api('upload_media', { filename, mime, base64_data: base64Data, title, alt });
const listPlugins = () => api('list_plugins');
const togglePlugin = (plugin, active) => api('toggle_plugin', { plugin, active });
const activeTheme = () => api('active_theme');
const restNamespaces = () => api('rest_namespaces');

module.exports = {
  SITE,
  api,
  ping, diag, listPages, getPage, updatePage, createPage, createLibraryItem,
  listMedia, uploadMedia, listPlugins, togglePlugin, activeTheme, restNamespaces,
};
