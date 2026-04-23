# Inventaire WP haroboz.com — 2026-04-23

**Site :** https://haroboz.com
**Pages totales :** 28
**Posts :** 2
**Médias :** 566
**Plugins :** 0
**Thème actif :** inconnu

## ⚠️ Anomalie auth Basic REST API

**Problème :** LiteSpeed/Hostinger stripe le header `Authorization` sur les requêtes HTTP GET avant que PHP le reçoive.
**Impact :** Impossible d'accéder à `context=edit`, `status=any`, `/wp/v2/plugins`, `/wp/v2/themes` via l'API REST.
**Fix à déployer :** Ajouter dans `haroboz-deploy.php` (déjà fait localement) :
```php
if (!isset($_SERVER['HTTP_AUTHORIZATION']) && isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $_SERVER['HTTP_AUTHORIZATION'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
}
```
**Action requise :** Uploader `wp-push/haroboz-deploy.php` (avec le fix) via hPanel Hostinger > Gestionnaire de fichiers > `/wp-content/plugins/haroboz-deploy/haroboz-deploy.php`

## Pages modifiées après le push takeover (2026-03-30)

| ID | Slug | Title | Modified | Status | Longueur |
|---|---|---|---|---|---|
| 3379 | `tirages-art-edition-limitee` | Tirages d&rsquo;Art Édition Limitée | Haroboz | 2026-04-15 | publish | 33706 |
| 3377 | `temoignages-clients` | Témoignages Clients – Avis Shooting Photo Homme |  | 2026-04-15 | publish | 33574 |
| 3375 | `shooting-exterieur` | Shooting Extérieur – Lumière Naturelle dans le Sud | 2026-04-15 | publish | 42723 |
| 3373 | `shooting-duo-couple` | Shooting Duo &amp; Couple – Expérience Intime à De | 2026-04-15 | publish | 42469 |
| 3371 | `retrouver-confiance-corps` | Retrouver Confiance en Son Corps – Photo Masculine | 2026-04-15 | publish | 39280 |
| 3369 | `premier-shooting-nu` | Premier Shooting Nu – Guide et Conseils | Haroboz | 2026-04-15 | publish | 40531 |
| 3367 | `portrait-studio` | Portrait Studio – Shooting Privé Art Masculin | Ha | 2026-04-15 | publish | 41232 |
| 3365 | `photographe-toulon` | Photographe Art Masculin Toulon – Shooting Privé | | 2026-04-15 | publish | 37377 |
| 3363 | `photographe-paris` | Photographe Art Masculin Paris – Shooting Privé |  | 2026-04-15 | publish | 37463 |
| 3361 | `photographe-nice` | Photographe Nu Masculin Nice – Art Photo Homme | H | 2026-04-15 | publish | 37434 |
| 3359 | `photographe-marseille` | Photographe Art Masculin Marseille – Shooting Priv | 2026-04-15 | publish | 37676 |
| 3357 | `photo-domicile` | Photo à Domicile – Shooting Intime chez Vous | Har | 2026-04-15 | publish | 44004 |
| 3355 | `luc-desbois-photographe` | Vision Artistique – Haroboz|Luc Desbois | 2026-04-18 | publish | 26175 |
| 3353 | `galerie-privee-client` | Galerie Privée Client – Accès Sécurisé | Haroboz | 2026-04-15 | publish | 33336 |
| 3351 | `galerie-portraits-hommes` | Galerie Portraits Hommes – Photo Nu Masculin Art | | 2026-04-15 | publish | 36582 |
| 3349 | `galerie-couples` | Galerie Couples – Shooting Photo Duo Intime | Haro | 2026-04-15 | publish | 32941 |
| 3347 | `carte-cadeau` | Carte Cadeau Shooting Photo | Haroboz | 2026-04-15 | publish | 34865 |
| 3345 | `cadeau-couple-original` | Cadeau Couple Original – Shooting Photo Intime | H | 2026-04-15 | publish | 40407 |
| 3343 | `book-modele-professionnel` | Book Modèle Professionnel – Photos Homme Marseille | 2026-04-15 | publish | 40050 |
| 3341 | `votre-experience` | Votre Expérience Photo – Du Shooting au Tirage d&r | 2026-04-15 | publish | 43698 |
| 3339 | `portfolio` | Portfolio Nu Masculin – Galerie Photo Homme | Haro | 2026-04-15 | publish | 36707 |
| 3337 | `photographe` | Nos Lieux de Shooting – Marseille Toulon Nice Pari | 2026-04-15 | publish | 34249 |
| 3335 | `packs-shooting` | Packs Shooting Photo – Séance et Tirage d&rsquo;Ar | 2026-04-15 | publish | 43661 |
| 3333 | `mentions-legales` | Mentions Légales – Haroboz | Photographe Marseille | 2026-04-15 | publish | 33353 |
| 3331 | `contact` | Contact – Réservez Votre Shooting Photo | Haroboz  | 2026-04-15 | publish | 32624 |
| 3329 | `boutique` | Boutique – Tirages d&rsquo;Art et Cartes Cadeaux | | 2026-04-18 | publish | 30155 |
| 3327 | `a-propos` | Haroboz – Luc Desbois, Photographe Art Masculin | 2026-04-22 | publish | 25941 |
| 3244 | `accueil` | Photographe Art Masculin – Shooting &#038; Tirage  | 2026-04-15 | publish | 121406 |

## Pages non modifiées depuis

| ID | Slug | Title | Modified | Status |
|---|---|---|---|---|

## Plugins actifs

_Plugins non récupérables via REST (auth requise). Plugins inférés depuis les namespaces REST ci-dessous._

## Plugins clés à vérifier

- **Elementor (actif)** (déduit depuis namespace `elementor/v1`)
- **Elementor Pro (actif)** (déduit depuis namespace `elementor-pro/v1`)
- **Hello Elementor theme (actif)** (déduit depuis namespace `elementor-hello-elementor/v1`)
- **Yoast SEO (actif)** (déduit depuis namespace `yoast/v1`)
- **iThemes Security / Solid Security (actif)** (déduit depuis namespace `ithemes-security/v1`)
- **LiteSpeed Cache (actif)** (déduit depuis namespace `litespeed/v1`)
- **Google Site Kit (actif)** (déduit depuis namespace `google-site-kit/v1`)
- **JWT Authentication (actif)** (déduit depuis namespace `jwt-auth/v1`)
- **Elementor AI (actif)** (déduit depuis namespace `elementor-ai/v1`)
- **Kadence Blocks MailerLite (actif)** (déduit depuis namespace `kb-mailerlite/v1`)
- **Kadence Blocks Pro (actif)** (déduit depuis namespace `kbp/v1`)

## Namespaces REST disponibles

- `ithemes-security/rpc`
- `ithemes-security/v1`
- `oembed/1.0`
- `bsf-custom-fonts/v1`
- `custom-fonts/v1`
- `litespeed/v1`
- `litespeed/v3`
- `yoast/v1`
- `elementor-one/v1`
- `kb-mailerlite/v1`
- `kb-getresponse/v1`
- `kb-fluentcrm/v1`
- `kbp/v1`
- `kb-lottieanimation/v1`
- `kb-vector/v1`
- `kb-design-library/v1`
- `kb-image-picker/v1`
- `elementor/v1`
- `elementor-pro/v1`
- `elementor-hello-elementor/v1`
- `google-site-kit/v1`
- `elementor/v1/documents`
- `elementor-ai/v1`
- `elementor/v1/feedback`
- `wp/v2`
- `jwt-auth/v1`
- `mcp`
- `wp-site-health/v1`
- `wp-block-editor/v1`
- `wp-abilities/v1`

## Médias (5 premiers)

- [3325] photoroom_20260125_171037-1 → https://haroboz.com/wp-content/uploads/2026/04/Photoroom_20260125_171037-1-scaled.png
- [3324] photoroom_20250617_103842-1 → https://haroboz.com/wp-content/uploads/2026/04/Photoroom_20250617_103842-1-scaled.png
- [3323] photoroom_20250615_223935-1 → https://haroboz.com/wp-content/uploads/2026/04/Photoroom_20250615_223935-1-scaled.png
- [3322] photoroom_20250615_213259-1-2 → https://haroboz.com/wp-content/uploads/2026/04/Photoroom_20250615_213259-1-scaled.png
- [3321] photoroom_20250506_212353-1-2 → https://haroboz.com/wp-content/uploads/2026/04/Photoroom_20250506_212353-1-scaled.png