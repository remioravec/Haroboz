<?php
/**
 * Plugin Name: Haroboz Site Takeover
 * Plugin URI: https://github.com/remioravec/Haroboz
 * Description: Remplace 100% du rendu WordPress. Le thème est court-circuité : chaque page affiche directement le HTML Haroboz sans aucun élément WP. Active aussi CORS pour le push. À DÉSACTIVER après la mise en ligne.
 * Version: 3.0
 * Author: Haroboz
 * License: GPL-2.0-or-later
 *
 * INSTALLATION:
 *   Extensions → Ajouter → Téléverser une extension → haroboz-takeover.zip
 *   Puis activer.
 *
 * SÉCURITÉ: Désactivez et supprimez ce plugin une fois le site stabilisé.
 */

if (!defined('ABSPATH')) exit;

/* ──────────────────────────────────────────────────────────────
   1. CORS — API REST (nécessaire pour le push depuis le Codespace)
────────────────────────────────────────────────────────────── */
add_action('rest_api_init', function () {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function ($value) {
        $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type, Content-Disposition, X-WP-Nonce');
        header('Access-Control-Allow-Credentials: true');

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            status_header(200);
            exit();
        }

        return $value;
    });
}, 15);

/* ──────────────────────────────────────────────────────────────
   2. TEMPLATE TAKEOVER — Court-circuite le thème à 100%

   On intercepte template_redirect (priorité 1, très tôt) pour
   servir un HTML complet et faire exit(). Le thème WordPress
   n'a AUCUNE chance de s'exécuter.
────────────────────────────────────────────────────────────── */
add_action('template_redirect', function () {
    if (is_admin() || wp_doing_ajax() || defined('REST_REQUEST')) {
        return;
    }

    if (!is_page() && !is_front_page()) {
        return;
    }

    // Récupérer le contenu de la page
    global $post;
    if (!$post) return;

    // On utilise le contenu BRUT — pas apply_filters('the_content')
    // car wpautop ajouterait des <p>/<br> qui cassent le HTML Tailwind.
    // Le contenu est déjà du HTML complet poussé par replace-site.js.
    $content = $post->post_content;
    $title   = get_the_title();

    // Meta description (Yoast → RankMath → fallback excerpt)
    $meta_desc = '';
    if (function_exists('YoastSEO')) {
        $meta_desc = get_post_meta($post->ID, '_yoast_wpseo_metadesc', true);
    }
    if (!$meta_desc) {
        $meta_desc = get_post_meta($post->ID, 'rank_math_description', true);
    }
    if (!$meta_desc) {
        $meta_desc = wp_strip_all_tags(get_the_excerpt());
    }

    // SEO title (Yoast → RankMath → fallback)
    $seo_title = '';
    if (function_exists('YoastSEO')) {
        $seo_title = get_post_meta($post->ID, '_yoast_wpseo_title', true);
    }
    if (!$seo_title) {
        $seo_title = get_post_meta($post->ID, 'rank_math_title', true);
    }
    if (!$seo_title) {
        $seo_title = $title;
    }

    // Canonical URL
    $canonical = get_permalink();

    // Servir le HTML complet — le thème n'a AUCUNE chance de s'exécuter
    status_header(200);
    header('Content-Type: text/html; charset=utf-8');

    echo '<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>' . esc_html($seo_title) . '</title>
    <meta name="description" content="' . esc_attr($meta_desc) . '">
    <link rel="canonical" href="' . esc_url($canonical) . '">

    <!-- Open Graph -->
    <meta property="og:title" content="' . esc_attr($seo_title) . '">
    <meta property="og:description" content="' . esc_attr($meta_desc) . '">
    <meta property="og:url" content="' . esc_url($canonical) . '">
    <meta property="og:type" content="website">
    <meta property="og:site_name" content="Haroboz">

    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    colors: {
                        brand: { DEFAULT: \'#0a1a3a\', light: \'#122a5c\', 50: \'#e8edf5\' }
                    },
                    fontFamily: {
                        sans: [\'Inter\', \'sans-serif\'],
                        serif: [\'Playfair Display\', \'serif\']
                    }
                }
            }
        };
    </script>

    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">

    <!-- Lucide Icons -->
    <script src="https://unpkg.com/lucide@latest"></script>

    <style>
        .haroboz-page { font-family: \'Inter\', sans-serif; }
    </style>
</head>
<body class="bg-white text-gray-900 antialiased">

' . $content . '

<script>
(function() {
    /* Lucide init */
    function initLucide() {
        if (window.lucide) { try { lucide.createIcons(); } catch(e) {} }
    }
    document.addEventListener("DOMContentLoaded", initLucide);
    window.addEventListener("load", initLucide);

    /* FAQ Cards toggle */
    window.toggleFaq = function(btn) {
        var card = btn.closest(".faq-card");
        if (!card) return;
        var content = card.querySelector(".faq-content");
        var chevron = card.querySelector(".faq-chevron");
        var isOpen = content.style.maxHeight && content.style.maxHeight !== "0px";

        document.querySelectorAll(".faq-card").forEach(function(otherCard) {
            if (otherCard !== card) {
                var oc = otherCard.querySelector(".faq-content");
                var och = otherCard.querySelector(".faq-chevron");
                if (oc) oc.style.maxHeight = "0px";
                if (och) och.style.transform = "rotate(0deg)";
            }
        });

        if (isOpen) {
            content.style.maxHeight = "0px";
            if (chevron) chevron.style.transform = "rotate(0deg)";
        } else {
            content.style.maxHeight = content.scrollHeight + "px";
            if (chevron) chevron.style.transform = "rotate(180deg)";
            setTimeout(initLucide, 50);
        }
    };

    /* Popup open/close */
    window.openPopup = function() {
        var popup = document.getElementById("booking-popup");
        if (!popup) return;
        popup.classList.remove("popup-hidden");
        popup.classList.add("popup-visible");
        document.body.classList.add("overflow-hidden");
        initLucide();
    };

    window.closePopup = function() {
        var popup = document.getElementById("booking-popup");
        if (!popup) return;
        popup.classList.remove("popup-visible");
        popup.classList.add("popup-hidden");
        document.body.classList.remove("overflow-hidden");
    };

    document.addEventListener("keydown", function(e) {
        if (e.key === "Escape") window.closePopup();
    });

    window.handleSubmit = function(e) {
        e.preventDefault();
        var form = document.getElementById("booking-form");
        var success = document.getElementById("popup-success");
        if (form) form.classList.add("hidden");
        if (success) success.classList.remove("hidden");
        initLucide();
    };

    document.addEventListener("DOMContentLoaded", function() {
        /* Mobile menu toggle */
        var mobileMenuBtn = document.getElementById("mobile-menu-btn");
        var closeMenuBtn  = document.getElementById("close-menu-btn");
        var mobileMenu    = document.getElementById("mobile-menu");
        var overlay       = document.getElementById("mobile-overlay");

        function toggleMobileMenu() {
            if (!mobileMenu || !overlay) return;
            mobileMenu.classList.toggle("menu-open");
            overlay.classList.toggle("hidden");
            document.body.classList.toggle("overflow-hidden");
        }

        if (mobileMenuBtn) mobileMenuBtn.addEventListener("click", toggleMobileMenu);
        if (closeMenuBtn)  closeMenuBtn.addEventListener("click", toggleMobileMenu);
        if (overlay)       overlay.addEventListener("click", toggleMobileMenu);

        /* Mobile accordion */
        document.querySelectorAll(".mobile-accordion-btn").forEach(function(btn) {
            btn.addEventListener("click", function() {
                var content = this.nextElementSibling;
                var icon    = this.querySelector("i");
                if (!content) return;
                content.classList.toggle("hidden");
                if (icon) {
                    icon.style.transform = content.classList.contains("hidden")
                        ? "rotate(0deg)" : "rotate(180deg)";
                }
            });
        });

        /* Header transparent → white on scroll */
        var mainHeader = document.getElementById("main-header");
        if (mainHeader) {
            var headerLogo   = mainHeader.querySelector("a");
            var headerCtaBtn = document.getElementById("header-cta-btn");
            var menuBtn      = document.getElementById("mobile-menu-btn");

            function updateHeader() {
                var scrolled = window.scrollY > 80;
                if (scrolled) {
                    mainHeader.classList.remove("bg-transparent");
                    mainHeader.classList.add("bg-white", "shadow-sm");
                    if (headerLogo) { headerLogo.classList.remove("text-white"); headerLogo.classList.add("text-brand"); }
                    mainHeader.querySelectorAll("nav > .mega-menu-item > button, nav > a").forEach(function(el) {
                        el.classList.remove("text-white/90", "hover:text-white");
                        el.classList.add("text-brand", "hover:text-brand-light");
                    });
                    if (headerCtaBtn) {
                        headerCtaBtn.classList.remove("bg-white/20", "backdrop-blur-sm", "text-white", "border-white/30", "hover:bg-white", "hover:text-brand");
                        headerCtaBtn.classList.add("bg-brand", "text-white", "border-brand", "hover:bg-brand-light");
                    }
                    if (menuBtn) { menuBtn.classList.remove("text-white"); menuBtn.classList.add("text-brand"); }
                } else {
                    mainHeader.classList.add("bg-transparent");
                    mainHeader.classList.remove("bg-white", "shadow-sm");
                    if (headerLogo) { headerLogo.classList.add("text-white"); headerLogo.classList.remove("text-brand"); }
                    mainHeader.querySelectorAll("nav > .mega-menu-item > button, nav > a").forEach(function(el) {
                        el.classList.add("text-white/90", "hover:text-white");
                        el.classList.remove("text-brand", "hover:text-brand-light");
                    });
                    if (headerCtaBtn) {
                        headerCtaBtn.classList.add("bg-white/20", "backdrop-blur-sm", "text-white", "border-white/30", "hover:bg-white", "hover:text-brand");
                        headerCtaBtn.classList.remove("bg-brand", "border-brand", "hover:bg-brand-light");
                    }
                    if (menuBtn) { menuBtn.classList.add("text-white"); menuBtn.classList.remove("text-brand"); }
                }
            }
            updateHeader();
            window.addEventListener("scroll", updateHeader, { passive: true });
        }

        /* Floating CTA visibility */
        var floatingCta = document.getElementById("floating-cta");
        if (floatingCta) {
            window.addEventListener("scroll", function() {
                if (window.scrollY > 600) {
                    floatingCta.classList.remove("opacity-0", "translate-y-4", "pointer-events-none");
                    floatingCta.classList.add("opacity-100", "translate-y-0", "pointer-events-auto");
                } else {
                    floatingCta.classList.add("opacity-0", "translate-y-4", "pointer-events-none");
                    floatingCta.classList.remove("opacity-100", "translate-y-0", "pointer-events-auto");
                }
            }, { passive: true });
        }

        /* Smooth scroll for anchors */
        document.querySelectorAll("a[href^=\'#\']").forEach(function(anchor) {
            anchor.addEventListener("click", function(e) {
                var target = document.querySelector(anchor.getAttribute("href"));
                if (target) {
                    e.preventDefault();
                    target.scrollIntoView({ behavior: "smooth", block: "start" });
                }
            });
        });
    });
})();
</script>

</body>
</html>';

    exit; // CRUCIAL — empêche WordPress de continuer le rendu du thème
}, 1);

/* ──────────────────────────────────────────────────────────────
   4. DÉSACTIVER wpautop — WordPress ajoute des <p> et <br>
   partout dans le contenu, ce qui casse le HTML Tailwind.
────────────────────────────────────────────────────────────── */
add_action('init', function () {
    // Désactiver l'auto-formatage sur le contenu des pages
    remove_filter('the_content', 'wpautop');
    remove_filter('the_content', 'wptexturize');

    // Désactiver aussi les smart quotes et tirets WordPress
    remove_filter('the_title', 'wptexturize');
});

/* ──────────────────────────────────────────────────────────────
   5. PERMETTRE LE HTML COMPLET — WordPress filtre certaines
   balises HTML dans le contenu. On doit tout autoriser.
────────────────────────────────────────────────────────────── */
add_filter('wp_kses_allowed_html', function ($allowed, $context) {
    if ($context === 'post') {
        // Autoriser les balises nécessaires au contenu Haroboz
        $allowed['style']  = array('type' => true);
        $allowed['div']    = array(
            'class' => true, 'id' => true, 'style' => true,
            'onclick' => true, 'data-*' => true,
        );
        $allowed['button'] = array(
            'class' => true, 'id' => true, 'onclick' => true,
            'type' => true, 'aria-label' => true, 'data-*' => true,
        );
        $allowed['svg']    = array(
            'class' => true, 'xmlns' => true, 'viewbox' => true,
            'fill' => true, 'stroke' => true, 'width' => true,
            'height' => true, 'stroke-width' => true,
            'stroke-linecap' => true, 'stroke-linejoin' => true,
        );
        $allowed['path']   = array('d' => true, 'fill' => true, 'stroke' => true);
        $allowed['circle'] = array('cx' => true, 'cy' => true, 'r' => true);
        $allowed['line']   = array('x1' => true, 'y1' => true, 'x2' => true, 'y2' => true);
        $allowed['i']      = array(
            'data-lucide' => true, 'class' => true,
        );
        $allowed['nav']    = array('class' => true, 'id' => true);
        $allowed['header'] = array('class' => true, 'id' => true);
        $allowed['footer'] = array('class' => true, 'id' => true);
        $allowed['main']   = array('class' => true, 'id' => true);
        $allowed['section']= array(
            'class' => true, 'id' => true,
            'itemscope' => true, 'itemtype' => true,
        );
        $allowed['form']   = array(
            'class' => true, 'id' => true, 'onsubmit' => true,
            'action' => true, 'method' => true,
        );
        $allowed['input']  = array(
            'class' => true, 'id' => true, 'type' => true,
            'name' => true, 'placeholder' => true, 'required' => true,
            'value' => true,
        );
        $allowed['textarea'] = array(
            'class' => true, 'id' => true, 'name' => true,
            'rows' => true, 'placeholder' => true, 'required' => true,
        );
        $allowed['select'] = array(
            'class' => true, 'id' => true, 'name' => true, 'required' => true,
        );
        $allowed['option'] = array('value' => true, 'selected' => true);
        $allowed['label']  = array('class' => true, 'for' => true);
    }
    return $allowed;
}, 10, 2);

/* ──────────────────────────────────────────────────────────────
   6. ADMIN BAR — Masquer la barre admin en front (optionnel)
────────────────────────────────────────────────────────────── */
add_filter('show_admin_bar', '__return_false');
