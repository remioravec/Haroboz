# CLAUDE.md — Projet HAROBOZ : Refonte Design + SEO (Mode Sans Accès WP)

## 🎯 MISSION GLOBALE

Tu es un développeur front-end + expert SEO chargé de la **refonte complète du site haroboz.com**.

**Contexte :** On n'a PAS encore accès au WordPress du client.  
Le workflow se fait en 2 grandes phases :

1. **PHASE A (maintenant)** — Scraper le site public → Refondre le design → Générer un site statique de preview → Déployer sur le cloud pour montrer au client
2. **PHASE B (plus tard)** — Quand le client valide + donne les accès WP → Pousser le contenu via l'API WordPress

Ce fichier couvre la **PHASE A** uniquement.

---

## 📁 STRUCTURE DU PROJET

```
haroboz-claude-code/
├── CLAUDE.md                         ← CE FICHIER
├── package.json
├── .gitignore
│
├── scripts/
│   ├── 01-scrape-public.js           ← Scraping HTTP du site public
│   ├── 02-analyze-structure.js       ← Analyse contenu + SEO
│   ├── 03-build-preview.js           ← Génère le site statique de preview
│   ├── 04-serve-local.js             ← Serveur local pour tester
│   └── 05-deploy-cloud.sh            ← Script de déploiement cloud
│
├── config/
│   ├── site-map.json                 ← Cartographie du site (généré par scraping)
│   └── pages-registry.json           ← Registre de toutes les pages à produire
│
├── scraping/
│   └── output/                       ← HTML brut scrapé (1 fichier par page)
│
├── maquette/                         ← MAQUETTE HTML/CSS/JS (fournie par toi)
│   └── README.md
│
├── content/
│   ├── pages/                        ← Contenu SEO par page (JSON)
│   └── menus/                        ← Structures de navigation (JSON)
│
├── seo/
│   ├── fiche-client.md               ← Fiche Client complète
│   ├── cocon-semantique.md           ← Architecture des silos
│   ├── maillage-interne.md           ← Plan de liens
│   └── briefs/                       ← Un brief SEO par page
│
├── preview/                          ← SITE STATIQUE DE PREVIEW (déployable)
│   ├── index.html                    ← Page d'accueil refaite
│   ├── pages/                        ← Toutes les pages intérieures
│   ├── css/
│   │   ├── style.css                 ← Styles extraits/adaptés de la maquette
│   │   └── variables.css             ← Système de design (couleurs, fonts, spacing)
│   ├── js/
│   │   └── main.js                   ← Scripts (menu mobile, smooth scroll, etc.)
│   └── img/                          ← Images récupérées du site actuel
│
├── wp-push/                          ← PHASE B — Scripts API WP (pour plus tard)
│   ├── wp-api.js
│   ├── push-page.js
│   ├── update-menus.js
│   └── .env.example
│
└── docs/
    ├── workflow.md
    └── checklist-livraison.md
```

---

## 🔄 WORKFLOW PHASE A — Sans accès WordPress

### ÉTAPE 1 — SCRAPING PUBLIC
**Script :** `scripts/01-scrape-public.js`

On crawle le site public via HTTP (fetch sur les URLs).  
Pour chaque page on récupère :
- Le HTML complet
- Les balises `<title>`, `<meta description>`, `<meta og:*>`
- La structure Hn (H1, H2, H3...)
- Les images (src, alt)
- Les liens internes
- Le texte brut (pour analyse de contenu)

Méthode :
1. Partir de la homepage `https://haroboz.com`
2. Extraire tous les liens internes
3. Crawler récursivement chaque page
4. Sauvegarder dans `scraping/output/{slug}.json`
5. Générer `config/site-map.json`

### ÉTAPE 2 — ANALYSE
**Script :** `scripts/02-analyze-structure.js`

Analyser chaque page scrapée :
- Structure Hn (H1 manquant, doublons, hiérarchie cassée)
- Longueur du contenu (mots)
- Images sans alt
- Maillage interne actuel (qui linke vers qui)
- Pages orphelines
- Meta SEO manquantes

### ÉTAPE 3 — RÉDACTION SEO
Pour chaque page du cocon sémantique (voir `seo/cocon-semantique.md`) :
1. Créer le brief dans `seo/briefs/{slug}-brief.md`
2. Rédiger le contenu optimisé
3. Sauvegarder dans `content/pages/{slug}.json`

### ÉTAPE 4 — CONSTRUCTION DU PREVIEW
**Script :** `scripts/03-build-preview.js`

Combine la maquette + le contenu SEO pour générer des pages HTML statiques :
1. Lire le template de la maquette
2. Pour chaque page dans `content/pages/`, injecter le contenu dans le template
3. Appliquer le maillage interne (liens relatifs entre pages)
4. Générer le menu + footer
5. Écrire le résultat dans `preview/`

### ÉTAPE 5 — PREVIEW LOCAL
**Script :** `scripts/04-serve-local.js`

Serveur HTTP local pour tester le rendu avant déploiement.

```bash
node scripts/04-serve-local.js
# → http://localhost:3000
```

### ÉTAPE 6 — DÉPLOIEMENT CLOUD
**Script :** `scripts/05-deploy-cloud.sh`

Déployer le dossier `preview/` sur un hébergement cloud gratuit pour montrer au client.

Options :
- **Netlify Drop** (le plus simple — drag & drop)
- **Vercel** (CLI)  
- **GitHub Pages** (si repo git)
- **Surge.sh** (1 commande)

---

## 📋 FICHE CLIENT SEO — HAROBOZ (Résumé)

### Cible
- Hommes 25-60 ans, résidents/vacanciers Côte d'Azur
- Couples cherchant une expérience cadeau premium
- CSP+ ou budget bien-être/art

### UVP
> "Vivez une expérience photographique libératrice sur la Côte d'Azur. De la prise de vue personnalisée jusqu'au tirage d'art privé, révélez votre masculinité en toute confiance."

### Ton éditorial
**Rassurant, confidentiel, valorisant, ancré localement, haut de gamme.**

### Mots-clés de marque (À UTILISER)
- Cannes, Côte d'Azur, French Riviera, Alpes-Maritimes (06)
- Pack, Expérience complète, Shooting inclus
- Confiance en soi, bienveillance, lâcher-prise
- Espace privé, galerie sécurisée, discrétion
- Tirage d'art, œuvre, souvenir tangible

### Mots-clés (À ÉVITER)
- Paris, Lyon, Marseille
- "Juste les fichiers numériques", prestation à l'heure
- Gêne, complexe (ne pas insister sur le négatif)
- Publication publique, exposition non consentie
- Impression classique, tirage photo basique

### Signaux EEAT pour méta titres
- "Shooting privé et confidentiel à Cannes"
- "Pack complet : Séance photo et Tirage d'Art inclus"
- "Photographe spécialiste de la beauté masculine sur la Côte d'Azur"

### Format Méta Titre (OBLIGATOIRE)
```
[Mot-clé principal] – [Avantage + mots-clés secondaires] | [Signal EEAT/Trust]
```
Max 60 caractères. Mot-clé principal EN PREMIER.

---

## 🧱 CONVENTIONS HTML — PREVIEW STATIQUE

Le preview utilise du HTML/CSS/JS pur (pas d'Elementor, pas de WP).

Structure type d'une page :
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[Méta Titre SEO]</title>
  <meta name="description" content="[Méta Description SEO]">
  <link rel="stylesheet" href="/css/variables.css">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>

  <!-- HEADER (partagé — inclus par le build) -->
  <header class="hrb-header">...</header>

  <!-- CONTENU PRINCIPAL -->
  <main class="hrb-main">
    <section class="hrb-hero">...</section>
    <section class="hrb-section">...</section>
    <section class="hrb-faq" itemscope itemtype="https://schema.org/FAQPage">...</section>
    <section class="hrb-cta">...</section>
  </main>

  <!-- FOOTER (partagé — inclus par le build) -->
  <footer class="hrb-footer">...</footer>

  <script src="/js/main.js"></script>
</body>
</html>
```

Classes CSS préfixées `hrb-` pour éviter tout conflit lors de la future intégration WP.

---

## ⚠️ RÈGLES NON NÉGOCIABLES

1. **Scraping public uniquement** — pas d'API WP, pas de login
2. **Respecter robots.txt** — vérifier avant de crawler
3. **Images** — récupérer les URLs (pas les fichiers) et les utiliser en `<img src="https://haroboz.com/...">`
4. **Preview = vitrine** — le client voit le résultat, pas le code source
5. **SEO brief AVANT rédaction** — chaque page a son brief
6. **Maillage systématique** — chaque page liée selon le plan
7. **Mobile-first** — le preview doit être responsive
8. **Performance** — HTML léger, pas de framework JS lourd
9. **Pas de contenu factice** — tout le texte est du vrai copywriting SEO
10. **Prévoir la conversion WP** — le HTML doit être facilement injectable dans Elementor

---

## 🚀 PHASE B — Quand on aura les accès WP

Les scripts dans `wp-push/` seront utilisés pour :
1. Se connecter via l'API REST WP (Application Password)
2. Créer/mettre à jour les pages avec le contenu HTML
3. Configurer les meta SEO (Yoast/RankMath)
4. Mettre à jour les menus

Tout est préparé dans `wp-push/` mais **ne sera activé que plus tard**.
