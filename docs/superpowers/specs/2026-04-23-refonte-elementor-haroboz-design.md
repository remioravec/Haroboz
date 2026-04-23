# Spec — Refonte Elementor Haroboz (Design + Contenu Gutenberg client)

**Date :** 2026-04-23
**Propriétaire :** Rémi Oravec (administration@remi-oravec.fr)
**Statut :** Validé par brainstorming (approche A + B + big bang, Elementor Pro)

---

## 1. Contexte

Le site haroboz.com tourne actuellement grâce au plugin WordPress `haroboz-deploy.php` (v7, build `mo1desu8`). Ce plugin **court-circuite 100 % du rendu WP** via `template_redirect` et sert 28 pages HTML statiques embarquées en base64. Le thème WP et tout le contenu Gutenberg/Elementor natif ne s'affichent pas publiquement.

Problème : le client a récemment **modifié du contenu directement dans l'admin WP (éditeur Gutenberg)**. Ces modifications sont invisibles publiquement parce que le plugin les masque. Le client souhaite en plus **migrer vers Elementor** pour pouvoir éditer lui-même le site à l'avenir.

## 2. Objectif

Reconstruire les 28 pages du site **en Elementor Pro** avec :
- **Le design du preview actuel** (rendu servi par le plugin) reproduit à l'identique en "visuellement très proche" (pas pixel-perfect mais indiscernable au survol normal).
- **Les textes Gutenberg récemment modifiés par le client** injectés à la place des textes du preview, section par section, là où il y a divergence.

Puis **désactiver le plugin `haroboz-deploy`** pour que les pages Elementor deviennent la source publique. Le client pourra ensuite éditer chaque page directement depuis l'interface Elementor.

## 3. Critères de succès

1. Toutes les pages du site (≤ 28) existent en Elementor et sont éditables via l'UI native.
2. Le rendu public correspond visuellement au preview actuel (palette, typo, structure, interactions équivalentes).
3. Tous les **textes modifiés par le client en Gutenberg** apparaissent dans la version Elementor.
4. Aucune régression SEO : `<title>`, meta description, Open Graph, URLs canoniques préservés.
5. Le popup "rendez-vous", la FAQ dépliable, le menu mobile, le formulaire contact fonctionnent.
6. Le plugin `haroboz-deploy` est désactivé (mais non supprimé : rollback possible).
7. Le client dispose d'un guide d'édition simple (1-2 pages) pour modifier une section sans casser la mise en page.

## 4. Non-objectifs

- **Pas de refonte du contenu** : on n'ajoute pas de pages ni de sections. On migre l'existant.
- **Pas de refonte graphique** : on reste sur la charte actuelle (sobre, premium, noir/gris/beige).
- **Pas de pixel-perfect** : on accepte des écarts de ±4 px sur espacements, shadows, border-radius si ça évite du CSS custom fragile.
- **Pas de développement de plugin custom ni de widget Elementor custom** : widgets natifs Pro uniquement + CSS custom minimal dans "Global Styles".

## 5. Architecture cible

### 5.1 Stack WordPress
- **Thème** : Hello Elementor (thème vide officiel, laisse Elementor piloter). Si un autre thème est actif, on bascule sur Hello Elementor.
- **Plugins requis** : Elementor + Elementor Pro (déjà installé).
- **Plugin désactivé à la fin** : `haroboz-deploy` (sans désinstallation, pour rollback).
- **Plugins SEO** : on garde celui déjà utilisé (Yoast ou RankMath — à confirmer en Phase 0).

### 5.2 Elementor — structure
- **Theme Builder** pour les éléments globaux :
  - **Header** (menu 4 items + logo), appliqué à toutes les pages.
  - **Footer** (2 colonnes + mentions), appliqué à toutes les pages.
  - **Popup rendez-vous** (floating CTA), déclenché par clic sur "Prendre rendez-vous" ou scroll.
- **Global Styles** configurés via "Site Settings" :
  - Palette couleurs : noir principal, gris foncé, gris clair, beige accent, blanc.
  - Typographie : fonts Google identiques au preview (à identifier en Phase 0), tailles H1→H6, corps.
  - Styles de boutons (primaire/secondaire), liens, inputs.
- **Templates de page** : un template Elementor par page, créé sous "Templates > Saved Templates".

### 5.3 Organisation des pages (clusters)
- **Accueil** — template unique, page d'entrée.
- **Packs (×4 pages)** — même structure, textes différents : 1 template de base dupliqué 4 fois.
- **Portfolio / catégories** — structure commune, images différentes : 1 template dupliqué.
- **Pages uniques** : À propos, Votre expérience, Le photographe, Contact, Mentions légales, etc.

Nombre final de pages exact sera arrêté en Phase 0 (après inventaire API WP).

### 5.4 Flux de données

```
[WP Base Gutenberg client]          [preview/pages/*.html (plugin source)]
         │                                           │
         ▼ (API REST)                                ▼ (lecture fichiers)
  content/gutenberg-client/                   preview/pages/
         │                                           │
         └────────────┬──────────────────────────────┘
                      ▼
              [Diff + fusion]
                      │
                      ▼
       content/fused/{slug}.json   ← source de vérité pour Elementor
                      │
                      ▼
    [Build Elementor via API WP + elementor_data]
                      │
                      ▼
              [Pages WP Elementor]
                      │
                      ▼
         [Désactivation plugin takeover]
                      │
                      ▼
                [Site en Elementor]
```

## 6. Découpage en phases

### Phase 0 — Inventaire (préalable)
- Connexion API WP via credentials `wp-push/.env`.
- Lister toutes les pages (`/wp/v2/pages?per_page=100`) : id, slug, title, status, modified_date, content (raw Gutenberg), meta SEO.
- Identifier les pages modifiées par le client (post-date du dernier push takeover = 2026-03-30).
- Scanner la médiathèque (`/wp/v2/media`) : liste, URLs, IDs.
- Lister les plugins actifs et le thème actif (via endpoint admin ou requête auth).
- **Livrable** : `docs/inventory-2026-04-23.md` avec tableau des pages, diff potentiel, stats médiathèque, plugins actifs.

### Phase 1 — Extraction contenu Gutenberg
- Pour chaque page listée : récupérer le contenu brut Gutenberg et le stocker.
- Pour chaque page : extraire en texte plein (strip blocks) pour faciliter le diff.
- Produire un rapport de divergence par page (quels textes ont changé vs preview actuel).
- **Livrable** : `content/gutenberg-client/{slug}.json` + `docs/diff-gutenberg.md`.

### Phase 2 — Fusion contenu
- Pour chaque page : produire une version fusionnée qui prend la structure/design du preview et remplace les textes là où le client a modifié.
- Valider qu'aucune section du preview n'est orpheline ni contradictoire.
- **Livrable** : `content/fused/{slug}.json` + régénération `preview/pages/*.html` avec textes fusionnés.

### Phase 3 — Fondations Elementor
- Installer/activer Hello Elementor si besoin (aujourd'hui le thème actif est peut-être autre).
- Upload médias manquants dans la médiathèque WP (images aujourd'hui embedded dans le plugin).
- Configurer Global Styles Elementor (couleurs, typo, boutons).
- Créer header, footer, popup via Theme Builder.
- **Livrable** : site WP avec design system Elementor en place, header/footer/popup globaux publiés.

### Phase 4 — Build des 28 pages en Elementor
- Pour chaque page fusionnée, créer un template Elementor qui reproduit la structure en widgets natifs.
- Utiliser les clusters (Packs, Portfolio) pour factoriser.
- Chaque page est créée **en statut `draft` ou `private`** tant que la Phase 5 n'est pas validée.
- **Livrable** : 28 pages Elementor sauvegardées, non publiques.

### Phase 5 — Basculement (point de confirmation)
**STOP** : avant toute action publique, demander confirmation à l'utilisateur (actions visibles publiquement).
- Désactiver le plugin `haroboz-deploy` (via l'API plugins).
- Publier les 28 pages Elementor (status `publish`).
- Configurer redirections si certains slugs ont changé.
- Vérifier `<title>`, meta description, OG sur chaque page.
- **Livrable** : site public entièrement en Elementor.

### Phase 6 — Recette + remise client
- Tour complet des 28 pages (desktop + mobile).
- Vérification du popup, de la FAQ, du formulaire contact, du menu mobile.
- Test Lighthouse (perf, accessibilité, SEO, best practices).
- Rédiger un guide court "comment éditer une page Elementor" (1-2 pages Markdown).
- **Livrable** : rapport de recette + `docs/guide-elementor-client.md`.

## 7. Risques et stratégies de mitigation

| Risque | Impact | Mitigation |
|---|---|---|
| Les credentials WP du .env sont expirés | Bloquant Phase 0 | Test de connexion en premier ; si échec, demander un nouvel app password |
| Certaines pages Gutenberg sont vides (client n'a rien modifié) | Moyen | On garde le texte du preview, aucune fusion nécessaire pour ces pages |
| Des images sont embedded dans le plugin et introuvables ailleurs | Moyen | Extraire les URLs/base64 du plugin et les upload vers la médiathèque |
| Elementor "mange" des espacements non conformes | Faible | Utiliser "Global Spacing" et CSS custom Global si besoin |
| Le client a créé de nouvelles pages en Gutenberg qui n'existent pas dans le preview | Moyen | Les lister séparément ; décision au cas par cas (les créer en Elementor ou pas) |
| Désactiver le plugin casse quelque chose d'imprévu | Élevé | Phase 5 derrière un gate explicite de confirmation + rollback possible (plugin non désinstallé) |
| Le thème actif n'est pas Hello Elementor et casse le rendu Elementor | Moyen | Basculer sur Hello Elementor en Phase 3, après test sur 1 page |

## 8. Environnement et accès

- **Repo** : `/workspaces/Haroboz/` (ce projet, branche `main`).
- **Credentials WP** : `wp-push/.env` (clés `WP_SITE_URL`, `WP_USERNAME`, `WP_APP_PASSWORD`, `SEO_PLUGIN`, `PUSH_MODE`).
- **Outils existants utilisables** :
  - `wp-push/replace-site.js` (serveur local Node qui a le pipeline de push original).
  - `scripts/01-scrape-public.js` à `scripts/04-serve-local.js`.
  - Bibliothèque `preview/pages/*.html` (source du design actuel).

## 9. Hors scope explicite

- Refonte graphique globale.
- Optimisations perf avancées (lazy-loading custom, CDN).
- Mise en place d'un workflow de staging séparé.
- Traduction/multilingue.
- A/B testing.
- Intégrations tiers (Stripe, CRM, mail marketing).

## 10. Points de validation utilisateur

1. **Avant Phase 5** : confirmation pour désactivation du plugin `haroboz-deploy`.
2. (Optionnel) Après Phase 3 : un aperçu du header/footer/popup en Elementor, avant de lancer le build des 28 pages.

Tout le reste avance en autonomie.
