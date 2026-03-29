#!/usr/bin/env node
/**
 * update-menus.js — Mise à jour des menus WordPress (Phase B)
 *
 * Usage :
 *   node wp-push/update-menus.js --list
 *   node wp-push/update-menus.js --export
 */

const wp = require('./wp-api');

async function main() {
  const args = process.argv.slice(2);
  await wp.testConnection();

  if (args.includes('--list')) {
    console.log('\n📋 Menus WordPress :');
    try {
      const menus = await wp.wpFetch('/wp/v2/menus');
      for (const m of menus) {
        console.log(`   ${m.name} (ID: ${m.id})`);
      }
    } catch {
      console.log('   ⚠️ Endpoint menus non disponible. Installer WP REST API Menus.');
    }
  } else {
    console.log('Usage :');
    console.log('  node wp-push/update-menus.js --list');
    console.log('  node wp-push/update-menus.js --export');
    console.log('\n⚠️ La mise à jour des menus se fait manuellement dans WP Admin');
    console.log('   ou via le plugin Nav Menu REST API.');
    console.log('\n   Structure recommandée → voir content/menus/main.json');
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1); });
