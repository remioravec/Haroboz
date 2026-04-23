// wp-push/migrate/12-theme-builder.js
// Create Elementor Theme Builder templates: header, footer, popup.
// The header wraps the shared "chrome" (Tailwind CDN + Google Fonts + Lucide) so it loads once globally.
//
// Output: content/theme-builder.json   (mapping template_type → WP post id)

const fs = require('fs');
const path = require('path');
const api = require('./lib/haroboz-api');
const b = require('./lib/elementor-builder');

function readShared(name) {
  const p = path.resolve(__dirname, '../../content/shared', name + '.html');
  return fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : '';
}

const CHROME = `<!-- Haroboz chrome : Tailwind + fonts + Lucide -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: { brand: '#0f1115', accent: '#c8a86c', ink: '#222228', muted: '#6e6e76', paper: '#faf8f4' },
        fontFamily: { serif: ['Playfair Display', 'serif'], sans: ['Inter', 'system-ui', 'sans-serif'] },
      },
    },
  };
</script>
<script src="https://unpkg.com/lucide@latest"></script>
<script>document.addEventListener('DOMContentLoaded',()=>{window.lucide&&lucide.createIcons();});</script>
<style>
  .elementor-section.elementor-section-boxed > .elementor-container { max-width: none !important; }
  .elementor-widget-container { line-height: 1.5; }
  body { font-family: Inter, system-ui, sans-serif; color: #222228; }
  /* Hide Elementor default spacing around our HTML widget so the raw Tailwind layout is untouched. */
  .haroboz-raw .elementor-widget-container { padding: 0 !important; margin: 0 !important; }
</style>
`;

async function createLibraryItem(title, templateType, elementorData) {
  const meta = {
    _elementor_data: JSON.stringify(elementorData),
    _elementor_edit_mode: 'builder',
    _elementor_template_type: templateType,
    _elementor_version: b.ELEMENTOR_VERSION,
    _elementor_pro_version: '3.28.0',
  };
  const r = await api.createLibraryItem({ title, meta });
  console.log(`  ${templateType.padEnd(8)} → post id ${r.id}`);
  return r.id;
}

async function main() {
  console.log('Creating Theme Builder items…');

  const headerHtml = readShared('header');
  const footerHtml = readShared('footer');
  const popupHtml = readShared('popup');

  // Header = chrome + site header HTML, in a single HTML widget.
  const headerData = b.wrapHtml(CHROME + '\n' + headerHtml);
  const footerData = b.wrapHtml(footerHtml);
  const popupData = b.wrapHtml(popupHtml);

  const result = {
    header: await createLibraryItem('Haroboz Header', 'header', headerData),
    footer: await createLibraryItem('Haroboz Footer', 'footer', footerData),
    popup: await createLibraryItem('Haroboz Popup Rendez-vous', 'popup', popupData),
  };

  const outFile = path.resolve(__dirname, '../../content/theme-builder.json');
  fs.writeFileSync(outFile, JSON.stringify(result, null, 2));
  console.log(`\n✅ Theme Builder templates written: ${outFile}`);
  console.log('\n👉 Étape manuelle à faire si les conditions ne se posent pas automatiquement :');
  console.log('   WP admin > Templates > Theme Builder → Header Haroboz → Publication → Conditions : "Entire Site"');
  console.log('   Idem pour Footer. Le popup se déclenchera via un bouton qui cible son ID.');
}

main().catch(e => { console.error(e); process.exit(1); });
