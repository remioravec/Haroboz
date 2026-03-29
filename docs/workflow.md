# WORKFLOW — Projet HAROBOZ (Mode Sans Accès WP)

## Phase A — Preview Cloud (maintenant)

### Prérequis
- [ ] Node.js ≥ 18 installé
- [ ] Claude Code lancé dans le dossier du projet
- [ ] Maquette HTML/CSS/JS fournie dans `maquette/`

---

### Étape 0 — Vérification rapide

```bash
cd haroboz-claude-code
node -v   # doit être ≥ 18
```

---

### Étape 1 — Scraping du site public

```bash
node scripts/01-scrape-public.js
```

Ce que ça fait :
- Crawle https://haroboz.com page par page (HTTP public, aucun login)
- Respecte un délai de 1s entre les requêtes (politesse)
- Extrait : title, meta, Hn, images, liens, texte brut
- Sauvegarde chaque page dans `scraping/output/{slug}.json`
- Génère `config/site-map.json` (cartographie complète)

Vérifier :
- [ ] Toutes les pages publiques sont scrapées
- [ ] Le HTML est complet
- [ ] Les images sont listées avec leurs URLs absolues

Pour scraper une seule page :
```bash
node scripts/01-scrape-public.js --url=https://haroboz.com/une-page
```

---

### Étape 2 — Analyse SEO

```bash
node scripts/02-analyze-structure.js
```

Produit `scraping/output/analysis-report.json` avec :
- Problèmes SEO par page (H1, meta, contenu court, images sans alt)
- Maillage interne actuel (qui linke vers qui)
- Pages orphelines (aucun lien entrant)
- Gap avec le cocon sémantique cible (pages manquantes à créer)

---

### Étape 3 — Placer la maquette

Mettre les fichiers HTML/CSS/JS de la maquette dans `maquette/` :

```
maquette/
├── index.html
├── css/
│   └── style.css
├── js/
│   └── main.js
└── img/
```

Le build script (`03-build-preview.js`) :
- Copie le CSS/JS de la maquette dans `preview/`
- Utilise ces styles pour toutes les pages générées
- Si pas de maquette : utilise un design par défaut (dark, gold, premium)

---

### Étape 4 — Rédiger les contenus SEO

Pour chaque page du cocon sémantique (`seo/cocon-semantique.md`) :

1. Créer le brief : `seo/briefs/{slug}-brief.md` (copier `_TEMPLATE-BRIEF.md`)
2. Rédiger le contenu HTML dans `content/pages/{slug}.json`
3. Respecter la fiche client (`seo/fiche-client.md`)
4. Intégrer le maillage (`seo/maillage-interne.md`)

Le champ `content` du JSON contient le HTML des sections `<main>` :
- Le header et le footer sont ajoutés automatiquement par le build
- Les liens internes utilisent les chemins relatifs du preview (`/pages/slug.html`)
- Les images pointent vers les URLs du site actuel (`https://haroboz.com/...`)

Ordre de rédaction recommandé :
1. Page d'accueil (`accueil.json`)
2. Pages mères des silos (6 pages)
3. Pages filles prioritaires (Silo 3 Localité d'abord — SEO local)
4. Le reste

---

### Étape 5 — Construire le preview

```bash
node scripts/03-build-preview.js
```

Génère un site statique complet dans `preview/` :
- `preview/index.html` — Page d'accueil
- `preview/pages/*.html` — Toutes les pages intérieures
- `preview/css/` — Styles (maquette ou défaut)
- `preview/js/` — Scripts

Chaque page inclut :
- Header avec navigation (depuis `content/menus/main.json`)
- Footer complet (depuis `content/menus/footer.json`)
- Bandeau "PREVIEW" en bas de page
- Meta SEO complètes (title, description, og:*)

---

### Étape 6 — Tester en local

```bash
node scripts/04-serve-local.js
```

Ouvre http://localhost:3000 dans le navigateur.
Vérifier :
- [ ] Toutes les pages se chargent
- [ ] La navigation fonctionne (menu + footer)
- [ ] Le responsive est OK (tester en mobile)
- [ ] Les liens de maillage interne fonctionnent
- [ ] Le design correspond à la maquette

---

### Étape 7 — Déployer sur le cloud

**Option rapide (recommandée) — Netlify Drop :**
1. Aller sur https://app.netlify.com/drop
2. Glisser le dossier `preview/` dans la fenêtre
3. Copier l'URL et l'envoyer au client
4. Terminé.

**Autres options :**
```bash
# Surge.sh (1 commande)
bash scripts/05-deploy-cloud.sh surge

# Vercel
bash scripts/05-deploy-cloud.sh vercel

# Netlify CLI
bash scripts/05-deploy-cloud.sh netlify

# GitHub Pages
bash scripts/05-deploy-cloud.sh github
```

---

## Phase B — Push WordPress (quand le client donne les accès)

1. Copier `wp-push/.env.example` → `wp-push/.env`
2. Remplir username + Application Password
3. Utiliser les scripts dans `wp-push/` pour :
   - Créer/mettre à jour les pages (toujours en brouillon)
   - Configurer les meta SEO (Yoast/RankMath)
   - Mettre à jour les menus

Les scripts WP seront finalisés à ce moment-là.
