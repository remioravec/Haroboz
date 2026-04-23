# Guide d'édition Haroboz — Elementor

> Ton site haroboz.com est désormais piloté par **Elementor Pro**. Tu peux éditer chaque page directement depuis l'admin WordPress, sans toucher au code.

---

## Accéder à l'éditeur d'une page

1. Connecte-toi sur `https://haroboz.com/wp-admin`
2. Menu gauche → **Pages**
3. Survole la page à modifier → **Modifier avec Elementor**

L'éditeur s'ouvre dans une nouvelle interface avec ta page au milieu et un panneau d'outils à gauche.

---

## Modifier un texte ou une image

Chaque page contient actuellement un **gros bloc HTML** (le design existant). Deux façons de modifier :

### Option simple — éditer tout le contenu

1. Clique n'importe où dans le contenu de la page (dans la zone centrale).
2. Le panneau gauche affiche **"HTML"** avec une boîte de texte contenant le code HTML.
3. Repère le texte à changer dans le code (ex: "Bienvenue chez Haroboz").
4. Remplace-le par ton nouveau texte (attention à ne pas toucher aux balises `<...>`).
5. Clique **"Mettre à jour"** en bas à gauche.

Pour une image : repère la ligne `<img src="https://haroboz.com/wp-content/uploads/..." />` et change l'URL par celle d'une autre image de ta médiathèque (WP admin → Médias → clic droit sur une image → "Copier l'adresse").

### Option confort — décomposer une section en widgets natifs

Si tu veux éditer une section précise de manière plus visuelle (cliquer sur un titre pour le modifier directement), il faut "décomposer" cette section. Comme c'est un travail technique, **envoie-moi un message** quand tu veux qu'on le fasse sur telle ou telle section (ex: "je veux pouvoir éditer le hero de l'accueil visuellement").

---

## Modifier le menu (header)

Le menu apparaît en haut de toutes les pages. Pour le modifier :

1. WP admin → **Templates → Theme Builder**
2. Liste : "Header Haroboz"
3. **Modifier avec Elementor**
4. Même principe : clic sur le bloc HTML, édite le code, "Mettre à jour"

⚠️ Toute modif du menu se répercute sur **toutes les pages** du site.

## Modifier le pied de page (footer)

1. WP admin → **Templates → Theme Builder**
2. "Footer Haroboz" → **Modifier avec Elementor**

## Modifier le pop-up "Prendre rendez-vous"

1. WP admin → **Templates → Theme Builder**
2. "Haroboz Popup Rendez-vous" → **Modifier avec Elementor**

---

## Règles à respecter

### Ce que tu peux faire sans crainte
- Modifier un **texte**
- Remplacer une **image** (par une autre de la médiathèque)
- Corriger une **faute de frappe**
- Changer un **lien** (ex: URL de bouton)

### Ce qu'il vaut mieux ne pas toucher sans moi
- Supprimer le widget HTML complet d'une page (tu perds tout le contenu)
- Toucher à la balise `<script>` ou `<style>` au début du header
- Modifier les "Paramètres de la page" dans Elementor (onglet en bas à gauche)
- Modifier les "Paramètres du site" (à éviter)

### Avant toute modif importante
WP admin → **UpdraftPlus** (déjà installé) → **Sauvegarder maintenant**. En cas de problème, on pourra restaurer.

---

## En cas de souci

**Le site s'affiche bizarre / cassé** :
1. WP admin → **Extensions** → cherche **"Haroboz Static Site"** → **Activer**
2. Le site revient à l'état précédent (version du 23 avril 2026)
3. Préviens-moi, je regarde ce qui a mal tourné

**Erreur "Permission refusée" dans Elementor** :
1. Déconnecte-toi puis reconnecte-toi.
2. Si ça persiste, vide le cache : WP admin → **LiteSpeed Cache** → **Toolbox → Purger tout**

**Je ne trouve plus une page** :
WP admin → **Pages → Tous** (en haut, filtre "Publiés / Brouillons"). Si tu l'as mise en brouillon par erreur, reprends-la.

---

## Contact

**Rémi** — `administration@remi-oravec.fr`

---

_Dernière mise à jour : 23 avril 2026 — après migration vers Elementor Pro._
