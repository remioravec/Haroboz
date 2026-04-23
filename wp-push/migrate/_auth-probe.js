// wp-push/migrate/_auth-probe.js
// Test all auth strategies against haroboz.com to find one that works
require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const SITE = process.env.WP_SITE_URL.replace(/\/$/, '');
const USER = process.env.WP_USERNAME;
const PASS = process.env.WP_APP_PASSWORD;

async function test(label, fn) {
  try {
    const r = await fn();
    const ok = r.ok ? '✅' : '❌';
    console.log(`${ok} ${label} → ${r.status}`);
    if (!r.ok) {
      const body = await r.text();
      console.log('   ', body.slice(0, 200));
    } else {
      const body = await r.json().catch(() => null);
      if (body) console.log('   ', JSON.stringify(body).slice(0, 200));
    }
    return r;
  } catch (e) {
    console.log(`💥 ${label} → ${e.message}`);
  }
}

async function main() {
  console.log(`\n=== Probing auth on ${SITE} ===\n`);
  console.log(`User: ${USER}, pass: ${PASS ? PASS.slice(0, 4) + '...' : '(missing)'}\n`);

  const basicAuth = 'Basic ' + Buffer.from(`${USER}:${PASS}`).toString('base64');

  // 1. Classic Basic auth in header on GET
  await test('1. GET users/me with Basic header', () =>
    fetch(`${SITE}/wp-json/wp/v2/users/me`, { headers: { Authorization: basicAuth } })
  );

  // 2. Basic auth in header on POST (for comparison — sometimes POST passes differently)
  await test('2. POST to users (should auth) with Basic header', () =>
    fetch(`${SITE}/wp-json/wp/v2/pages?per_page=1&context=edit`, {
      method: 'GET',
      headers: { Authorization: basicAuth },
    })
  );

  // 3. Basic auth via URL query (some setups accept this)
  await test('3. GET users/me with creds in URL (auth=basic:)', () =>
    fetch(`${SITE}/wp-json/wp/v2/users/me?auth=basic:${encodeURIComponent(PASS)}`, {
      headers: { 'X-WP-Username': USER },
    })
  );

  // 4. Basic auth via HTTP URL (https://user:pass@host/) — fetch doesn't allow this directly; check via URL object
  await test('4. GET users/me with embedded URL creds', () => {
    const u = new URL(`${SITE}/wp-json/wp/v2/users/me`);
    u.username = USER;
    u.password = PASS;
    return fetch(u.toString());
  });

  // 5. JWT Auth — try to get a token (app password usually does NOT work; but let's try)
  const jwtAttempt = await test('5. POST /jwt-auth/v1/token with app password', () =>
    fetch(`${SITE}/wp-json/jwt-auth/v1/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: USER, password: PASS }),
    })
  );
  let token = null;
  if (jwtAttempt && jwtAttempt.ok) {
    // can't double-read body; already consumed in test
  } else {
    // retry to extract token
    try {
      const r = await fetch(`${SITE}/wp-json/jwt-auth/v1/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: USER, password: PASS }),
      });
      if (r.ok) {
        const b = await r.json();
        token = b.token;
      }
    } catch (_) {}
  }

  // 6. If JWT token obtained → test it
  if (token) {
    await test('6. GET users/me with JWT Bearer', () =>
      fetch(`${SITE}/wp-json/wp/v2/users/me`, { headers: { Authorization: `Bearer ${token}` } })
    );
  }

  // 7. Alternative: X-Authorization custom header (some WAFs forward this)
  await test('7. GET users/me with X-Authorization Basic', () =>
    fetch(`${SITE}/wp-json/wp/v2/users/me`, { headers: { 'X-Authorization': basicAuth } })
  );

  // 8. MCP namespace — maybe it has auth endpoints
  await test('8. GET /wp-json/mcp (explore)', () =>
    fetch(`${SITE}/wp-json/mcp`, { headers: { Authorization: basicAuth } })
  );

  // 9. Direct REST Nonce flow — no, requires session cookie.

  console.log('\n=== Done ===');
}

main().catch(e => { console.error(e); process.exit(1); });
