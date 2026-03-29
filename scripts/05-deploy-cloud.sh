#!/bin/bash
# ============================================
# 05-deploy-cloud.sh — Déploiement du preview
# ============================================
#
# Usage :
#   bash scripts/05-deploy-cloud.sh netlify
#   bash scripts/05-deploy-cloud.sh surge
#   bash scripts/05-deploy-cloud.sh vercel
#   bash scripts/05-deploy-cloud.sh github
#
# Déploie le dossier preview/ sur un hébergement cloud gratuit.

set -e

PREVIEW_DIR="$(dirname "$0")/../preview"
DEPLOY_TARGET="${1:-help}"

echo ""
echo "🚀 DÉPLOIEMENT HAROBOZ PREVIEW"
echo "==============================="
echo ""

# Vérifier que le preview existe
if [ ! -f "$PREVIEW_DIR/index.html" ]; then
  echo "❌ Pas de index.html dans preview/"
  echo "   Lancer d'abord : node scripts/03-build-preview.js"
  exit 1
fi

case "$DEPLOY_TARGET" in

  # ============================================
  # OPTION 1 : NETLIFY (recommandé — le plus simple)
  # ============================================
  netlify)
    echo "📦 Déploiement sur Netlify..."
    echo ""

    # Vérifier si netlify-cli est installé
    if ! command -v netlify &> /dev/null; then
      echo "   Installation de netlify-cli..."
      npm install -g netlify-cli
    fi

    # Déployer
    echo "   Drag & Drop automatique du dossier preview/..."
    netlify deploy --dir="$PREVIEW_DIR" --prod

    echo ""
    echo "✅ Déployé sur Netlify !"
    echo "   💡 Première fois ? Suivre les instructions pour lier un site."
    echo "   💡 Alternative rapide : https://app.netlify.com/drop"
    echo "      → Glisser-déposer le dossier preview/ directement."
    ;;

  # ============================================
  # OPTION 2 : SURGE.SH (1 commande, gratuit)
  # ============================================
  surge)
    echo "📦 Déploiement sur Surge.sh..."
    echo ""

    if ! command -v surge &> /dev/null; then
      echo "   Installation de surge..."
      npm install -g surge
    fi

    SURGE_DOMAIN="haroboz-preview.surge.sh"
    echo "   Domaine : $SURGE_DOMAIN"
    surge "$PREVIEW_DIR" "$SURGE_DOMAIN"

    echo ""
    echo "✅ Déployé sur Surge !"
    echo "   🌐 URL : https://$SURGE_DOMAIN"
    ;;

  # ============================================
  # OPTION 3 : VERCEL
  # ============================================
  vercel)
    echo "📦 Déploiement sur Vercel..."
    echo ""

    if ! command -v vercel &> /dev/null; then
      echo "   Installation de vercel..."
      npm install -g vercel
    fi

    cd "$PREVIEW_DIR"
    vercel --prod

    echo ""
    echo "✅ Déployé sur Vercel !"
    ;;

  # ============================================
  # OPTION 4 : GITHUB PAGES
  # ============================================
  github)
    echo "📦 Préparation pour GitHub Pages..."
    echo ""

    # Vérifier si on est dans un repo git
    if ! git rev-parse --is-inside-work-tree &> /dev/null 2>&1; then
      echo "   ⚠️ Pas de repo Git détecté."
      echo "   Initialisation..."
      git init
      git add .
      git commit -m "Initial commit — HAROBOZ preview"
    fi

    # Créer/mettre à jour la branche gh-pages
    echo "   Création de la branche gh-pages..."
    git subtree push --prefix preview origin gh-pages 2>/dev/null || {
      echo "   ⚠️ Méthode alternative..."
      git checkout --orphan gh-pages
      git rm -rf .
      cp -r "$PREVIEW_DIR"/* .
      git add .
      git commit -m "Deploy HAROBOZ preview"
      git push origin gh-pages --force
      git checkout main 2>/dev/null || git checkout master
    }

    echo ""
    echo "✅ Poussé sur gh-pages !"
    echo "   → Activer GitHub Pages dans Settings > Pages > Source: gh-pages"
    ;;

  # ============================================
  # AIDE
  # ============================================
  *)
    echo "Usage : bash scripts/05-deploy-cloud.sh <provider>"
    echo ""
    echo "Providers disponibles :"
    echo ""
    echo "  netlify   — Le plus simple (drag & drop possible)"
    echo "              https://app.netlify.com/drop"
    echo ""
    echo "  surge     — 1 commande, gratuit, domaine .surge.sh"
    echo "              npm install -g surge && surge preview/"
    echo ""
    echo "  vercel    — Déploiement rapide avec preview URL"
    echo "              npm install -g vercel && cd preview && vercel"
    echo ""
    echo "  github    — GitHub Pages (nécessite un repo)"
    echo ""
    echo "💡 Le plus rapide pour montrer au client :"
    echo "   1. Aller sur https://app.netlify.com/drop"
    echo "   2. Glisser le dossier preview/"
    echo "   3. Copier l'URL et l'envoyer au client"
    ;;

esac
