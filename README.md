# 🚀 HAROBOZ — Refonte WordPress + SEO via Claude Code

## Situation

Pas encore d'accès au WordPress du client.  
On travaille en **2 phases** :

| Phase | Quand | Quoi |
|-------|-------|------|
| **A** | Maintenant | Scraper le site public → Refondre le design → Preview cloud |
| **B** | Plus tard | Le client valide → Il donne les accès WP → Push via API |

---

## Quick Start (Phase A)

```bash
# 1. Scraper le site actuel
node scripts/01-scrape-public.js

# 2. Analyser la structure + SEO
node scripts/02-analyze-structure.js

# 3. Placer la maquette dans maquette/

# 4. Rédiger les contenus dans content/pages/*.json

# 5. Construire le preview
node scripts/03-build-preview.js

# 6. Tester en local
node scripts/04-serve-local.js
# → http://localhost:3000

# 7. Déployer pour le client
# Option rapide : glisser preview/ sur https://app.netlify.com/drop
# Ou : bash scripts/05-deploy-cloud.sh surge
```

---

## Fichiers clés

| Fichier | Rôle |
|---------|------|
| `CLAUDE.md` | **Instructions complètes** (lire EN PREMIER) |
| `seo/fiche-client.md` | Persona, ton, mots-clés, EEAT |
| `seo/cocon-semantique.md` | Architecture 6 silos, ~27 pages |
| `seo/maillage-interne.md` | Plan de liens entre pages |
| `config/pages-registry.json` | Liste de toutes les pages à produire |
| `content/pages/_EXAMPLE-FORMAT.json` | Format JSON attendu par page |
| `content/menus/main.json` | Structure du menu principal |
| `content/menus/footer.json` | Structure du footer |
| `scripts/` | Scraping → Analyse → Build → Serve → Deploy |
| `wp-push/` | Scripts API WordPress (Phase B) |

---

## Règles

1. **Scraping public** — pas de login, pas d'API WP
2. **SEO brief AVANT rédaction** — chaque page a son brief
3. **Preview = vitrine** — URL cloud propre pour le client
4. **Mobile-first** — responsive obligatoire
5. **Prêt pour WP** — HTML injectable dans Elementor
