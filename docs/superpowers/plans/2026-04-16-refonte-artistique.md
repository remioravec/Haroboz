# Refonte Artistique Haroboz — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transformer le site Haroboz d'un ton "académique/corporate" vers un site de photographe artiste avec menu simplifié, 2 CTAs ("Rendez-vous" + "Réalisations"), texte réduit et patterns navboost.

**Architecture:** Un script Node.js (`scripts/refonte-artistique.js`) applique les changements globaux (header, footer, mobile menu, floating CTA, labels CTA) sur les 28 pages HTML. Ensuite, les pages à fort contenu (homepage, expérience, packs, portfolio) sont éditées individuellement pour réduire le texte et changer le ton.

**Tech Stack:** Node.js (fs), HTML/Tailwind CSS, vanilla JS. Pas de framework.

**Spec:** `docs/superpowers/specs/2026-04-16-refonte-artistique-design.md`

---

### Task 1: Script de refonte globale (header, footer, mobile menu, floating CTA)

**Files:**
- Create: `scripts/refonte-artistique.js`
- Read: All 28 HTML files in `preview/`

Ce script remplace le header, footer, mobile menu, floating CTA et tous les labels CTA dans CHAQUE page HTML.

- [ ] **Step 1: Create the script with new HTML templates**

Create `scripts/refonte-artistique.js` with the new header, footer, mobile menu and floating CTA as string constants. The script reads each HTML file, replaces the old components with the new ones, and writes back.

**New header (desktop):** 4 nav items — "Séances" (dropdown: Studio, Extérieur, Domicile, Duo), "Réalisations" (direct link to /pages/portfolio/), "L'Univers" (direct link to /pages/a-propos/), "Contact" (direct link to /pages/contact.html). Right side: Instagram icon + "Rendez-vous" button.

**New mobile menu:** Same 4 items, only "Séances" has accordion. Bottom: "Rendez-vous" button + phone number `06 88 70 40 41`.

**New footer:** 2 columns ("Haroboz": L'Univers, Contact, Mentions légales, cities inline. "Explorer": Portraits, Nus & Attributs, Couples & Duos, Tirages d'Art, Carte Cadeau). Bottom bar: IG icon + phone + copyright + Rendez-vous button.

**New floating CTA:** "Rendez-vous" with calendar icon, appears at 40% scroll (not 600px fixed), NO pulse-ring animation.

**CTA label replacements across all content:**
- "Prendre RDV gratuit" → "Rendez-vous"
- "Prendre RDV" → "Rendez-vous"
- "Réserver ma séance" → "Rendez-vous"
- "Être rappelé sous 24h" → "Rendez-vous"
- "Réserver une consultation gratuite" → "Rendez-vous"
- "Réserver en toute confidentialité" → "Rendez-vous"
- "Découvrir l'oeuvre" / "Voir toutes les réalisations" → "Réalisations"

- [ ] **Step 2: Run the script**

```bash
node scripts/refonte-artistique.js
```

Expected: "28 pages updated" with details of changes per page.

- [ ] **Step 3: Verify with local server**

```bash
node scripts/04-serve-local.js
```

Open http://localhost:3000 — check header has 4 items, footer has 2 columns, floating CTA says "Rendez-vous", no pulse animation.

- [ ] **Step 4: Commit**

```bash
git add scripts/refonte-artistique.js preview/
git commit -m "Refonte globale : menu 4 items, footer 2 cols, CTAs Rendez-vous/Réalisations"
```

---

### Task 2: Homepage — réécriture contenu

**Files:**
- Modify: `preview/index.html`

Reduce homepage from ~3000 words to ~1200. Remove sections, shorten text, apply new tone.

- [ ] **Step 1: Remove sections**

Remove these sections entirely from index.html:
- Section "pricing/offre" (pack pricing cards with prices)
- Section "Où me trouver / Lieux" (cities grid — now in footer only)
- Section "Quête" / "Que viennent chercher les hommes?" intent cards (content stays on votre-experience sub-pages)

- [ ] **Step 2: Reduce FAQ from 8 to 3**

Keep only the 3 most important FAQs:
1. "Comment se passe un shooting ?" (process)
2. "Faut-il être à l'aise avec son corps ?" (reassurance)
3. "Que comprend le pack ?" (value proposition)

- [ ] **Step 3: Rewrite hero section**

Apply new tone rules. Replace:
- "En quête, conquête, reconquête de son image..." → "Chaque homme a une image de lui qu'il n'a jamais vue. Je la cherche avec lui."
- Hero CTAs: "Rendez-vous" (primary) + "Réalisations" (secondary outline)

- [ ] **Step 4: Shorten pack cards section**

Each pack card: image + title + 1 line description + "Découvrir" link. No paragraphs. Max 15 words per card.

- [ ] **Step 5: Shorten testimonials to 2**

Keep only 2 most impactful testimonials. Remove the others.

- [ ] **Step 6: Rewrite "À propos" teaser**

Max 2 sentences + photo + link "Découvrir l'univers →"

- [ ] **Step 7: Add final CTA section with both buttons**

```html
<section class="py-20 bg-brand text-white text-center">
  <h2 class="text-3xl font-serif mb-4">Prêt ?</h2>
  <p class="text-lg text-gray-300 mb-8 max-w-lg mx-auto">Un échange gratuit, sans engagement. Je vous rappelle sous 24h.</p>
  <div class="flex flex-col sm:flex-row gap-4 justify-center">
    <button onclick="openPopup()" class="bg-white text-brand px-8 py-4 rounded-full font-medium">
      <i data-lucide="calendar" class="w-5 h-5 mr-2 inline"></i> Rendez-vous
    </button>
    <a href="/pages/portfolio/" class="border border-white/30 text-white px-8 py-4 rounded-full font-medium hover:bg-white/10">
      Réalisations <i data-lucide="arrow-right" class="w-5 h-5 ml-2 inline"></i>
    </a>
  </div>
</section>
```

- [ ] **Step 8: Apply tone fixes throughout**

Search and replace academic language:
- "nous proposons" → "je propose" (or rephrase)
- "espace d'écoute" → "on parle avant de shooter"
- "body positive" → remove or rephrase
- "thérapie par l'image" → remove
- "nourrie par" → remove or rephrase
- "actualisation" → remove

- [ ] **Step 9: Commit**

```bash
git add preview/index.html
git commit -m "Homepage : contenu allégé, ton artistique, ~1200 mots"
```

---

### Task 3: Page Expérience — timeline visuelle

**Files:**
- Modify: `preview/pages/votre-experience/index.html`

Replace the 4 long narrative sections with a compact visual timeline.

- [ ] **Step 1: Replace 4-step narrative with timeline**

Replace the 4 alternating left/right sections (each with 2 paragraphs + image) with a single timeline section:

```html
<section class="py-16 bg-white">
  <div class="max-w-4xl mx-auto px-4">
    <h2 class="text-3xl font-serif text-brand text-center mb-12">De l'idée au tirage</h2>
    <div class="space-y-8">
      <!-- Step 1 -->
      <div class="flex items-start gap-6">
        <div class="flex-shrink-0 w-12 h-12 bg-brand text-white rounded-full flex items-center justify-center font-bold">1</div>
        <div>
          <h3 class="text-lg font-medium text-brand mb-1">L'échange</h3>
          <p class="text-gray-600">On parle au téléphone. Je comprends ce que vous cherchez, vous comprenez comment je travaille. Zéro engagement.</p>
        </div>
      </div>
      <!-- Step 2 -->
      <div class="flex items-start gap-6">
        <div class="flex-shrink-0 w-12 h-12 bg-brand text-white rounded-full flex items-center justify-center font-bold">2</div>
        <div>
          <h3 class="text-lg font-medium text-brand mb-1">La séance</h3>
          <p class="text-gray-600">En studio ou en extérieur, on prend le temps. Je dirige, vous lâchez prise. Confidentiel, toujours.</p>
        </div>
      </div>
      <!-- Step 3 -->
      <div class="flex items-start gap-6">
        <div class="flex-shrink-0 w-12 h-12 bg-brand text-white rounded-full flex items-center justify-center font-bold">3</div>
        <div>
          <h3 class="text-lg font-medium text-brand mb-1">La sélection</h3>
          <p class="text-gray-600">Je retouche les images. Vous choisissez vos préférées dans votre galerie privée.</p>
        </div>
      </div>
      <!-- Step 4 -->
      <div class="flex items-start gap-6">
        <div class="flex-shrink-0 w-12 h-12 bg-brand text-white rounded-full flex items-center justify-center font-bold">4</div>
        <div>
          <h3 class="text-lg font-medium text-brand mb-1">Le tirage</h3>
          <p class="text-gray-600">Votre image préférée, tirée sur papier Fine Art. Une oeuvre que vous accrochez chez vous.</p>
        </div>
      </div>
    </div>
  </div>
</section>
```

- [ ] **Step 2: Keep hub cards section at bottom**

Keep the 4 navigation cards (Confiance, Book Pro, Couple, Cadeau) — they are links to sub-pages, not prose. Just ensure they use the new tone.

- [ ] **Step 3: Apply tone fixes and add final CTA**

Same "Rendez-vous" + "Réalisations" final section as homepage.

- [ ] **Step 4: Commit**

```bash
git add preview/pages/votre-experience/index.html
git commit -m "Expérience : timeline visuelle, ~400 mots"
```

---

### Task 4: Pages Packs — réduction texte (×4 pages)

**Files:**
- Modify: `preview/pages/packs-shooting/portrait-studio.html`
- Modify: `preview/pages/packs-shooting/shooting-exterieur.html`
- Modify: `preview/pages/packs-shooting/photo-domicile.html`
- Modify: `preview/pages/packs-shooting/shooting-duo-couple.html`

Each pack page: hero paragraph max 3 sentences, convert long prose sections to bullet/icon lists, keep FAQ 3-4 items, keep mini gallery, apply tone.

- [ ] **Step 1: Rewrite each pack page**

For each of the 4 pages:
1. Hero paragraph: max 3 sentences, first person ("Je"), concrete
2. "Ce qui est inclus" section: icon + short line list (not paragraphs)
3. "Pourquoi choisir" section: remove or convert to 3 bullet points max
4. FAQ: keep 3-4 items, shorten questions
5. Remove any "pricing/offre" detailed sections
6. Final CTA: "Rendez-vous" + "Réalisations"
7. Add "next page teaser" before footer (link to another pack)

- [ ] **Step 2: Apply tone fixes**

Same rules as homepage: "je" not "nous", short sentences, no therapeutic language.

- [ ] **Step 3: Commit**

```bash
git add preview/pages/packs-shooting/
git commit -m "Packs (×4) : texte réduit ~600 mots, ton artistique, teasers page suivante"
```

---

### Task 5: Portfolio — allègement texte

**Files:**
- Modify: `preview/pages/portfolio/index.html`

- [ ] **Step 1: Reduce to 90% images, 10% text**

- 1 sentence intro under H1 (not a paragraph)
- Gallery grid with category filter buttons (keep existing)
- Remove or drastically shorten the "Notre approche photographique" section (currently 3 paragraphs → 1 sentence)
- Remove "Une galerie d'art au masculin" 4-paragraph SEO block (or compress to 2 sentences)
- Keep Instagram follow section
- Final CTA: "Rendez-vous" only (user is already viewing réalisations)

- [ ] **Step 2: Add masonry "Voir plus" toggle**

If the gallery has >8 images, hide images 9+ with `class="hidden gallery-extra"` and add a "Voir plus" button that toggles them:

```html
<button id="gallery-toggle" onclick="document.querySelectorAll('.gallery-extra').forEach(e=>e.classList.toggle('hidden'));this.textContent=this.textContent==='Voir plus'?'Voir moins':'Voir plus'" class="mt-8 mx-auto block border border-brand text-brand px-6 py-3 rounded-full hover:bg-brand hover:text-white transition-colors">
  Voir plus
</button>
```

- [ ] **Step 3: Commit**

```bash
git add preview/pages/portfolio/index.html
git commit -m "Portfolio : 90% images, masonry Voir plus, ~300 mots"
```

---

### Task 6: Contact page — léger allègement

**Files:**
- Modify: `preview/pages/contact.html`

- [ ] **Step 1: Shorten "avant de nous contacter" section**

Reduce from 6 bullet items to 3. Remove the most obvious ones. Change "nous" to first person.

- [ ] **Step 2: Update CTA labels**

Ensure all buttons say "Rendez-vous" or "Réalisations" per spec.

- [ ] **Step 3: Commit**

```bash
git add preview/pages/contact.html
git commit -m "Contact : texte allégé, CTAs uniformisés"
```

---

### Task 7: Build plugin & verify

**Files:**
- Run: `scripts/build-deploy-plugin.js`
- Output: `wp-push/haroboz-deploy.php` + `wp-push/haroboz-deploy.zip`

- [ ] **Step 1: Rebuild plugin**

```bash
node scripts/build-deploy-plugin.js
```

Expected: "28 pages processed", plugin written.

- [ ] **Step 2: Check PHP syntax**

```bash
php -l wp-push/haroboz-deploy.php
```

Expected: "No syntax errors detected"

- [ ] **Step 3: Create ZIP**

```bash
cd wp-push && rm -f haroboz-deploy.zip && zip haroboz-deploy.zip haroboz-deploy.php
```

- [ ] **Step 4: Run acceptance checks**

```bash
# Menu: 4 nav items only
grep -c "mega-menu-item" preview/index.html
# Expected: 1 (only "Séances" has dropdown)

# CTAs: no old labels
grep -rl "Prendre RDV gratuit\|Réserver ma séance\|Être rappelé sous 24h" preview/
# Expected: no results

# Footer: 2 columns
grep -c "grid-cols-2" preview/index.html | head -1
# Should find the 2-col footer grid

# No academic language
grep -rl "espace d.écoute\|body positive\|thérapie par l.image\|actualisation\|nourrie par" preview/
# Expected: no results (except maybe a-propos which is untouched)
```

- [ ] **Step 5: Final commit**

```bash
git add wp-push/ scripts/
git commit -m "Build plugin v7.1 : refonte artistique complète"
git push origin main
```
