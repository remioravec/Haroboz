// wp-push/migrate/04-extract-body.js
// From each WP page's raw HTML, extract:
//   - body_content (everything between header and footer, i.e. the main content area)
//   - save to content/fused/<slug>.html
// Also extracts ONE header/footer/popup reference sample → content/shared/{header,footer,popup}.html

const fs = require('fs');
const path = require('path');
const cheerio = require('cheerio');

const srcDir = path.resolve(__dirname, '../../content/gutenberg-client');
const outDir = path.resolve(__dirname, '../../content/fused');
const sharedDir = path.resolve(__dirname, '../../content/shared');
fs.mkdirSync(outDir, { recursive: true });
fs.mkdirSync(sharedDir, { recursive: true });

function extractBody(html) {
  const $ = cheerio.load(html, { decodeEntities: false });
  // Remove scripts/styles that belong to chrome (we'll rely on Elementor/theme for styling).
  $('style').remove();
  $('script').remove();

  const header = $('header').first().clone();
  const footer = $('footer').first().clone();
  const popup = $('#booking-popup, .booking-popup, [id*="popup"]').first().clone();

  // Remove header/footer/popup from main clone to keep only body content.
  $('header').remove();
  $('footer').remove();
  $('#booking-popup, .booking-popup, [id*="popup"]').remove();

  // Some pages wrap content in .haroboz-page; strip that wrapper.
  const root = $('.haroboz-page').first();
  const bodyHtml = root.length ? root.html() : $('body').html() || $.html();

  return {
    body: bodyHtml || '',
    header: header.length ? $.html(header) : '',
    footer: footer.length ? $.html(footer) : '',
    popup: popup.length ? $.html(popup) : '',
  };
}

const files = fs.readdirSync(srcDir).filter(f => f.endsWith('.json'));
let savedHeader = false, savedFooter = false, savedPopup = false;
const report = [];

for (const f of files) {
  const rec = JSON.parse(fs.readFileSync(path.join(srcDir, f), 'utf8'));
  const { body, header, footer, popup } = extractBody(rec.content_raw);
  fs.writeFileSync(
    path.join(outDir, `${rec.slug}.html`),
    `<!-- slug:${rec.slug} | id:${rec.id} | modified:${rec.modified} -->\n${body}`
  );
  report.push({ slug: rec.slug, id: rec.id, body_len: body.length, has_header: !!header, has_footer: !!footer, has_popup: !!popup });

  if (!savedHeader && header) { fs.writeFileSync(path.join(sharedDir, 'header.html'), header); savedHeader = true; }
  if (!savedFooter && footer) { fs.writeFileSync(path.join(sharedDir, 'footer.html'), footer); savedFooter = true; }
  if (!savedPopup && popup) { fs.writeFileSync(path.join(sharedDir, 'popup.html'), popup); savedPopup = true; }
}

fs.writeFileSync(path.join(outDir, '_report.json'), JSON.stringify(report, null, 2));
console.log(`✅ ${files.length} pages extraites dans ${outDir}`);
console.log(`✅ Shared : header=${savedHeader} footer=${savedFooter} popup=${savedPopup} → ${sharedDir}`);
const totalBody = report.reduce((a, b) => a + b.body_len, 0);
console.log(`   Body total : ${(totalBody / 1024).toFixed(1)} KB`);
