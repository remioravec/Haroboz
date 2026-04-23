// wp-push/migrate/lib/wp-client.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const SITE = process.env.WP_SITE_URL.replace(/\/$/, '');
const AUTH = 'Basic ' + Buffer.from(
  `${process.env.WP_USERNAME}:${process.env.WP_APP_PASSWORD}`
).toString('base64');

async function wpFetch(endpoint, opts = {}) {
  const url = endpoint.startsWith('http') ? endpoint : SITE + endpoint;
  const headers = {
    Authorization: AUTH,
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  const res = await fetch(url, { ...opts, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`WP ${res.status} on ${endpoint} — ${body.slice(0, 200)}`);
  }
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : res.text();
}

async function wpFetchAll(endpoint, params = {}) {
  // Auto-paginate
  const all = [];
  let page = 1;
  while (true) {
    const qs = new URLSearchParams({ ...params, per_page: 100, page }).toString();
    const sep = endpoint.includes('?') ? '&' : '?';
    const res = await fetch(SITE + endpoint + sep + qs, { headers: { Authorization: AUTH } });
    if (res.status === 400) break; // page > total_pages
    if (!res.ok) throw new Error(`WP ${res.status} on ${endpoint}?${qs}`);
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < 100) break;
    page++;
  }
  return all;
}

module.exports = { SITE, AUTH, wpFetch, wpFetchAll };
