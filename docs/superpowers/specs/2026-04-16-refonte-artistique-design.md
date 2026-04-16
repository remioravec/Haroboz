# Refonte Artistique Haroboz — Design Spec

**Date :** 2026-04-16
**Contexte :** Le site haroboz.com fonctionne (plugin v7 static actif). Le client demande une refonte du ton, du maillage et des CTAs pour passer d'un site "académique/corporate" à un site de photographe artiste.

---

## 1. Navigation — Menu simplifié

### Avant : 5 items, 22 liens, 4 mega-dropdowns
### Après : 4 items, 7 liens, 1 dropdown

```
HAROBOZ          Séances ▾         Réalisations    L'Univers    Contact       [Rendez-vous]  [IG]
                 ├ Portrait Studio
                 ├ Extérieur
                 ├ Domicile
                 └ Duo & Couple
```

**Supprimé du menu :**
- "Votre Objectif" (4 items) — pages gardées, liées depuis les packs et la homepage
- "Où me trouver ?" (4 villes) — déplacé dans le footer uniquement (pages SEO, pas de nav)
- "L'Oeuvre" (6 sous-items) — remplacé par "Réalisations" (lien direct portfolio avec filtres)

**Mobile :** même 4 items, seul "Séances" a un accordion. Bas du drawer : bouton "Rendez-vous" + numéro de téléphone.

**Header scroll :** fond transparent → blanc au scroll. Logo + liens passent de blanc à brand.

---

## 2. Footer — 2 colonnes + barre

### Avant : 4 colonnes, ~16 liens
### Après : 2 colonnes + barre bottom

```
Haroboz                        Explorer
├ L'Univers                    ├ Portraits
├ Contact                      ├ Nus & Attributs
├ Mentions légales             ├ Couples & Duos
└ Marseille | Toulon           ├ Tirages d'Art
  Nice | Paris                 └ Carte Cadeau

──────────────────────────────────────────────────────────
[IG] @hbozart   |   06 88 70 40 41   |   © 2026 Haroboz — Luc Desbois   |   [Rendez-vous]
```

---

## 3. CTAs — 2 labels, partout

| CTA | Label | Style | Icône | Action |
|-----|-------|-------|-------|--------|
| **Primaire** | Rendez-vous | Bouton plein brand | Calendrier | Ouvre popup booking |
| **Secondaire** | Réalisations | Bouton outline/ghost | Flèche → | Lien vers /portfolio/ |

### Règles
- **Header** : "Rendez-vous" uniquement
- **Hero** : "Rendez-vous" + "Réalisations" côte à côte
- **Mid-page** : "Rendez-vous" seul (l'utilisateur browse déjà)
- **Section finale** : "Rendez-vous" + "Réalisations" côte à côte
- **Floating** : "Rendez-vous" seul, apparaît à 40% scroll, **sans pulse animation**
- **Pages portfolio** : "Rendez-vous" seul (l'utilisateur est déjà sur les réalisations)
- **Max 3 CTAs par page** (header + 1 mid + 1 final)

### Labels supprimés
- "Prendre RDV gratuit" → "Rendez-vous"
- "Réserver ma séance" → supprimé
- "Être rappelé sous 24h" → supprimé
- "Réserver une consultation gratuite" → supprimé
- "Réserver en toute confidentialité" → supprimé

Note : "gratuit" et "sous 24h" restent dans le **popup** lui-même, pas sur les boutons.

---

## 4. Réduction de texte

### Règle générale
- Max 3 phrases par paragraphe
- Max 2 paragraphes par section
- Si un bloc a besoin de plus : utiliser des bullets, icônes ou images

### Par page

| Page | Mots avant | Mots cible | Actions |
|------|-----------|------------|---------|
| **Homepage** | ~3000 | ~1200 | Supprimer section pricing/offre. FAQ 8→3. Supprimer section "Quête". Raccourcir cards packs (image + titre + 1 ligne). Testimonials 2 max. |
| **Expérience index** | ~1300 | ~400 | Remplacer 4 sections narratives par une timeline visuelle (icône + 2 phrases par étape, tout dans 1 section). |
| **Packs (×4)** | ~1400 | ~600 | 1 paragraphe hero (3 phrases max). Reste en bullets/icônes. FAQ 3-4 items. Mini galerie gardée. |
| **Portfolio** | ~960 | ~300 | 90% images, 10% texte. 1 phrase d'intro sous le H1, puis grille, puis CTA. |
| **À propos** | ~550 | **~550** | **Inchangé** — c'est le coeur artistique du site. |
| **Villes (×4)** | ~400 | ~400 | Gardées telles quelles (SEO local). |
| **Contact** | ~400 | ~300 | Léger allègement de la section "avant de nous contacter". |
| **Boutique pages** | variable | variable | Inchangées pour l'instant. |

---

## 5. Règles de ton

1. **"Je" pas "nous"** — "Je photographie" pas "Nous proposons". Solo artist, pas d'équipe.
2. **Phrases courtes, voix active** — Tuer les nominalisations ("actualisation" → "reprendre le contrôle de son image").
3. **Concret > abstrait** — "un tirage que tu accroches chez toi" pas "un souvenir tangible".
4. **Max 3 phrases par paragraphe** — Les images sont le contenu, le texte est le liant.
5. **Zéro langage thérapeutique** — Photographe artiste, pas coach. Supprimer : "body positive", "thérapie par l'image", "acte de réconciliation", "démarche profondément libératrice", "espace d'écoute", "nourrie par".

### Exemples de réécriture

| Avant | Après |
|-------|-------|
| "En quête, conquête, reconquête de son image — sujet de toute une vie: construction, affirmation, actualisation." | "Chaque homme a une image de lui qu'il n'a jamais vue. Je la cherche avec lui." |
| "Nous avons fait le choix d'une approche radicalement différente." | "Je ne vends pas des heures. Je livre une oeuvre." |
| "Un espace d'écoute où chaque question trouve sa réponse." | "On parle avant de shooter. Pas de surprises." |
| "Une démarche profondément libératrice nourrie par des années de pratique." | "Dix ans que je fais ça. Chaque séance m'apprend quelque chose." |

---

## 6. Navboost — Patterns UX

### 6.1 Galerie masonry avec "Voir plus"
- Homepage et portfolio : 8 images visibles, 8+ cachées
- Bouton "Voir plus" toggle JS (pas de rechargement page)
- Augmente scroll depth + temps sur page

### 6.2 Teaser "page suivante"
- Avant chaque footer : card full-width avec image de fond + titre de la page suivante + flèche
- Ex : bas de "Portrait Studio" → "Vous aimerez aussi : Shooting Extérieur"
- Réduit le bounce rate

### 6.3 Floating CTA propre
- Apparaît à 40% du scroll
- Pas d'animation pulse (trop agressif)
- Simple bouton "Rendez-vous" avec icône calendrier
- Transition opacity douce

### 6.4 Interactions hover portfolio
- Scale subtle (1.02) + ombre sur les images
- Overlay avec titre/catégorie au hover
- Tailwind `group-hover` sur le container

---

## 7. Fichiers impactés

### Globaux (toutes les pages)
Tous les fichiers HTML dans `preview/` partagent le même header, footer, popup et floating CTA. Le script `scripts/fix-all-pages.js` peut appliquer les changements globaux.

### Spécifiques
- `preview/index.html` — homepage, réécriture majeure
- `preview/pages/votre-experience/index.html` — timeline visuelle
- `preview/pages/packs-shooting/*.html` — réduction texte (×4 pages)
- `preview/pages/portfolio/index.html` — allègement texte
- `preview/pages/contact.html` — léger allègement

### Pas touchés
- `preview/pages/a-propos/*` — gardé tel quel
- `preview/pages/photographe/*` — pages SEO villes, gardées
- `preview/pages/mentions-legales.html` — légal, gardé
- `preview/pages/boutique/*` — gardé pour l'instant

---

## 8. Critères d'acceptation

1. **Menu** : 4 items top-level, 1 dropdown (4 sous-items), 7 liens cliquables max hors logo/CTA
2. **CTAs** : `grep -r` sur tous les HTML ne retourne que "Rendez-vous" et "Réalisations" comme labels de boutons CTA
3. **Footer** : 2 colonnes de liens + 1 barre bottom, <12 liens total
4. **Texte** : Homepage <1300 mots, Expérience <500, Packs <700, Portfolio <300
5. **Ton** : Zéro instance de "nous proposons", "espace d'écoute", "actualisation", "nourrie par", "body positive", "thérapie par l'image"
6. **Navboost** : galerie "Voir plus" fonctionne sans rechargement, floating CTA sans pulse, teaser page suivante présent sur chaque page pack
7. **Plugin** : `node scripts/build-deploy-plugin.js` génère le plugin, ZIP uploadable, site fonctionnel

---

## 9. Hors scope

- Refonte des pages boutique (tirages, carte-cadeau, galerie privée)
- Changement des images/photos
- Modification du popup booking (contenu du formulaire)
- Pages SEO villes (contenu)
- Nouvelle identité visuelle (couleurs, fonts restent les mêmes)
