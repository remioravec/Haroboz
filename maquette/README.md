# Maquette Haroboz — Design System v2

## Stack technique
- **Tailwind CSS** via CDN (`https://cdn.tailwindcss.com`)
- **Google Fonts** : Inter (sans-serif) + Playfair Display (serif)
- **Icones** : Lucide Icons (`https://unpkg.com/lucide@latest`)
- **Pas de framework JS** — vanilla JS uniquement

## Couleurs (brand)
- `brand` (DEFAULT) : `#1C0052` (violet profond)
- `brand-light` : `#2a007a`
- `brand-50` : `#f0f4ff` (fond clair)

## Tailwind Config
```js
tailwind.config = {
    theme: {
        extend: {
            colors: {
                brand: {
                    DEFAULT: '#1C0052',
                    light: '#2a007a',
                    50: '#f0f4ff',
                }
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                serif: ['Playfair Display', 'serif'],
            }
        }
    }
}
```

## Architecture des sections (homepage)
1. Hero (bg-brand-50, grid 2 cols)
2. Objectifs (bg-white, grid 4 cols)
3. A Propos (bg-white, grid 2 cols)
4. Types de Seances (bg-brand, grid 4 cols, cards overlay)
5. Portfolio Instagram (bg-gray-50, grid carres)
6. Etapes (bg-white, 4 steps)
7. Tarifs (bg-brand-50, 3 packs)
8. FAQ (bg-white, details/summary)
9. Lieux (bg-gray-50, flex wrap)
10. CTA Final (bg-brand, effets blur)
11. Footer (bg-brand)

## Navigation
- Desktop : mega-menu avec hover (CSS transitions)
- Mobile : drawer slide-in depuis la droite avec accordeons
- CTA header : bouton rounded-full bg-brand

## Ce que Claude Code fait :
1. **Utilise** ce design system Tailwind pour toutes les pages
2. **Combine** le design avec le contenu SEO optimise
3. **Genere** un site preview complet dans `preview/`
4. Les liens internes pointent vers les pages existantes du projet
5. Le HTML est pense pour etre **facilement injectable dans Elementor** plus tard
