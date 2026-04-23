// wp-push/migrate/11-elementor-prep.js
// Prepare Elementor foundations:
//   - Discover active Elementor kit
//   - Inject Tailwind CDN + Google Fonts + Lucide into the site (via Hello Elementor / Elementor custom head)
//
// We use the Haroboz API to write into WP options directly (bypassing LiteSpeed auth strip).

const fs = require('fs');
const path = require('path');
const api = require('./lib/haroboz-api');

async function main() {
  // 1. Discover Elementor kit id
  const ping = await api.ping();
  console.log(`WP ${ping.wp}, plugin build ${ping.build}`);

  // Kit is a post of type 'elementor_library' with meta _elementor_template_type = 'kit'.
  // List elementor_library items via a dedicated action if we add one later; for now,
  // we rely on Elementor storing active kit id in option 'elementor_active_kit'.
  // That option is readable via our API through a generic wp_option call — but our API
  // doesn't expose raw options. We'll rely on the theme-level custom head injection instead.

  // 2. Inject custom head code via option 'elementor_custom_css' is not enough.
  //    We use wp_head injection via a tiny WP option read/write. Since we don't expose
  //    that, we add a dedicated action "set_custom_head" to the plugin. For now,
  //    we'll put Tailwind + fonts into the kit's _elementor_page_settings -> custom_css
  //    option via the api actions. If that doesn't work, we fall back to injecting into
  //    every page's _elementor_page_settings.

  // The simplest reliable way: inject into wp_head via a mu-plugin dropped by our
  // custom API. We'll extend the plugin with 'set_option' / 'get_option' + 'set_custom_head'
  // in a subsequent pass if needed.

  // For this iteration, we embed the chrome in each page's HTML widget wrapper.
  console.log('\n⚠️  This step is a no-op in v1: Tailwind/fonts will be injected as a <head>-style block at the top of each page HTML widget.');
  console.log('   (Elementor renders the widget HTML in the page body, so we can safely embed <script>/<link> tags there — browsers will execute them.)');

  // 3. Write a shared "chrome" HTML snippet that will be prepended to every page body.
  const sharedChrome = `<!-- Haroboz chrome : Tailwind + fonts + Lucide -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<script src="https://cdn.tailwindcss.com"></script>
<script>
  tailwind.config = {
    theme: {
      extend: {
        colors: {
          brand: '#0f1115',
          accent: '#c8a86c',
          ink: '#222228',
          muted: '#6e6e76',
          paper: '#faf8f4',
        },
        fontFamily: {
          serif: ['Playfair Display', 'serif'],
          sans: ['Inter', 'system-ui', 'sans-serif'],
        },
      },
    },
  };
</script>
<script src="https://unpkg.com/lucide@latest"></script>
<script>
  document.addEventListener('DOMContentLoaded', () => { if (window.lucide) lucide.createIcons(); });
</script>
<style>
  /* Let Elementor container go full width so Tailwind's max-w-* rules work natively. */
  .elementor-section.elementor-section-boxed > .elementor-container { max-width: none !important; }
  .haroboz-page { font-family: Inter, system-ui, sans-serif; color: #222228; }
</style>
`;

  const outFile = path.resolve(__dirname, '../../content/shared/chrome.html');
  fs.writeFileSync(outFile, sharedChrome);
  console.log(`✅ Chrome HTML écrit : ${outFile}`);
}

main().catch(e => { console.error(e); process.exit(1); });
