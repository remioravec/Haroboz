<?php
/**
 * Plugin Name: Haroboz CDN + CORS
 * Plugin URI: https://github.com/remioravec/Haroboz
 * Description: Active CORS sur l'API REST, injecte Tailwind/Lucide/Google Fonts dans <head>, et masque le thème WP. À DÉSACTIVER et SUPPRIMER après utilisation.
 * Version: 2.0
 * Author: Haroboz
 * License: GPL-2.0-or-later
 *
 * INSTALLATION:
 *   Extensions → Ajouter → Téléverser une extension → haroboz-cors.zip
 *
 * SÉCURITÉ: Désactivez et supprimez ce plugin une fois le push terminé.
 */

/* ──────────────────────────────────────────────────────────────
   1. CORS — API REST
────────────────────────────────────────────────────────────── */
add_action('rest_api_init', function () {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function ($value) {
        $origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '*';
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Authorization, Content-Type, X-WP-Nonce');
        header('Access-Control-Allow-Credentials: true');

        if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
            status_header(200);
            exit();
        }

        return $value;
    });
}, 15);

/* ──────────────────────────────────────────────────────────────
   2 & 3. HEAD INJECTION — CDN deps + HIDE_WP CSS (frontend only)
────────────────────────────────────────────────────────────── */
add_action('wp_head', function () {
    if (is_admin()) return;
    ?>
<!-- Haroboz CDN: Tailwind -->
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: '#0a1a3a', light: '#122a5c', 50: '#e8edf5' }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Playfair Display', 'serif']
      }
    }
  }
};
</script>
<!-- Haroboz CDN: Google Fonts -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<!-- Haroboz CDN: Lucide Icons -->
<script src="https://unpkg.com/lucide@latest"></script>
<!-- Haroboz: Hide WP theme -->
<style>
/* Reset WP chrome */
#wpadminbar { display: none !important }
html { margin-top: 0 !important }

/* Hide ALL theme header/footer/sidebar — covers classic + block + FSE themes */
.site-header, #masthead, header#masthead,
.wp-site-blocks > header, .wp-site-blocks > header:first-child,
header.wp-block-template-part,
.main-navigation, #site-navigation, .primary-navigation,
nav.wp-block-navigation, .wp-block-navigation,
#site-header, .ast-header, .genesis-header,
.site-footer, #colophon, footer#colophon,
.wp-site-blocks > footer, .wp-site-blocks > footer:last-child,
footer.wp-block-template-part,
.sidebar, .widget-area, #secondary,
.entry-header, .page-header, .entry-footer,
.post-navigation, .nav-links, .entry-meta,
.cat-links, .tags-links, .edit-link,
.comments-area, #comments,
.wp-block-template-part,
.page-title, .wp-block-post-title { display: none !important }

/* Full-width everything */
body, html, .site, .site-content, .content-area, .site-main,
.entry-content, .page-content, .wp-site-blocks,
.wp-block-post-content, .has-global-padding,
.wp-block-group, .alignfull, .alignwide,
article, .type-page, .hentry {
  max-width: 100% !important; width: 100% !important;
  padding: 0 !important; margin: 0 !important;
}
.entry-content > *, .wp-block-post-content > * {
  max-width: 100% !important;
  margin-left: 0 !important; margin-right: 0 !important;
}

/* Our content takes over */
.haroboz-page {
  position: relative; z-index: 10;
  font-family: 'Inter', sans-serif;
}
</style>
    <?php
}, 1);

/* ──────────────────────────────────────────────────────────────
   4. FOOTER INJECTION — Lucide init + interactive scripts
────────────────────────────────────────────────────────────── */
add_action('wp_footer', function () {
    if (is_admin()) return;
    ?>
<script>
(function() {
  /* Lucide init */
  function initLucide() {
    if (window.lucide) { try { lucide.createIcons(); } catch(e) {} }
  }
  document.addEventListener('DOMContentLoaded', initLucide);
  window.addEventListener('load', initLucide);

  /* FAQ Cards toggle */
  window.toggleFaq = function(btn) {
    var card = btn.closest('.faq-card');
    if (!card) return;
    var content = card.querySelector('.faq-content');
    var chevron = card.querySelector('.faq-chevron');
    var isOpen = content.style.maxHeight && content.style.maxHeight !== '0px';

    document.querySelectorAll('.faq-card').forEach(function(otherCard) {
      if (otherCard !== card) {
        var oc = otherCard.querySelector('.faq-content');
        var och = otherCard.querySelector('.faq-chevron');
        if (oc) oc.style.maxHeight = '0px';
        if (och) och.style.transform = 'rotate(0deg)';
      }
    });

    if (isOpen) {
      content.style.maxHeight = '0px';
      if (chevron) chevron.style.transform = 'rotate(0deg)';
    } else {
      content.style.maxHeight = content.scrollHeight + 'px';
      if (chevron) chevron.style.transform = 'rotate(180deg)';
      setTimeout(initLucide, 50);
    }
  };

  /* Popup open/close */
  window.openPopup = function() {
    var popup = document.getElementById('booking-popup');
    if (!popup) return;
    popup.classList.remove('popup-hidden');
    popup.classList.add('popup-visible');
    document.body.classList.add('overflow-hidden');
    initLucide();
  };

  window.closePopup = function() {
    var popup = document.getElementById('booking-popup');
    if (!popup) return;
    popup.classList.remove('popup-visible');
    popup.classList.add('popup-hidden');
    document.body.classList.remove('overflow-hidden');
  };

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') window.closePopup();
  });

  window.handleSubmit = function(e) {
    e.preventDefault();
    var form = document.getElementById('booking-form');
    var success = document.getElementById('popup-success');
    if (form) form.classList.add('hidden');
    if (success) success.classList.remove('hidden');
    initLucide();
  };

  document.addEventListener('DOMContentLoaded', function() {
    /* Mobile menu toggle */
    var mobileMenuBtn = document.getElementById('mobile-menu-btn');
    var closeMenuBtn  = document.getElementById('close-menu-btn');
    var mobileMenu    = document.getElementById('mobile-menu');
    var overlay       = document.getElementById('mobile-overlay');

    function toggleMobileMenu() {
      if (!mobileMenu || !overlay) return;
      mobileMenu.classList.toggle('menu-open');
      overlay.classList.toggle('hidden');
      document.body.classList.toggle('overflow-hidden');
    }

    if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', toggleMobileMenu);
    if (closeMenuBtn)  closeMenuBtn.addEventListener('click', toggleMobileMenu);
    if (overlay)       overlay.addEventListener('click', toggleMobileMenu);

    /* Mobile accordion */
    document.querySelectorAll('.mobile-accordion-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var content = this.nextElementSibling;
        var icon    = this.querySelector('i');
        if (!content) return;
        content.classList.toggle('hidden');
        if (icon) {
          icon.style.transform = content.classList.contains('hidden')
            ? 'rotate(0deg)' : 'rotate(180deg)';
        }
      });
    });

    /* Header transparent → white on scroll */
    var mainHeader = document.getElementById('main-header');
    if (mainHeader) {
      var headerLogo   = mainHeader.querySelector('a');
      var headerCtaBtn = document.getElementById('header-cta-btn');
      var menuBtn      = document.getElementById('mobile-menu-btn');

      function updateHeader() {
        var scrolled = window.scrollY > 80;
        if (scrolled) {
          mainHeader.classList.remove('bg-transparent');
          mainHeader.classList.add('bg-white', 'shadow-sm');
          if (headerLogo) { headerLogo.classList.remove('text-white'); headerLogo.classList.add('text-brand'); }
          mainHeader.querySelectorAll('nav > .mega-menu-item > button, nav > a').forEach(function(el) {
            el.classList.remove('text-white/90', 'hover:text-white');
            el.classList.add('text-brand', 'hover:text-brand-light');
          });
          if (headerCtaBtn) {
            headerCtaBtn.classList.remove('bg-white/20', 'backdrop-blur-sm', 'text-white', 'border-white/30', 'hover:bg-white', 'hover:text-brand');
            headerCtaBtn.classList.add('bg-brand', 'text-white', 'border-brand', 'hover:bg-brand-light');
          }
          if (menuBtn) { menuBtn.classList.remove('text-white'); menuBtn.classList.add('text-brand'); }
        } else {
          mainHeader.classList.add('bg-transparent');
          mainHeader.classList.remove('bg-white', 'shadow-sm');
          if (headerLogo) { headerLogo.classList.add('text-white'); headerLogo.classList.remove('text-brand'); }
          mainHeader.querySelectorAll('nav > .mega-menu-item > button, nav > a').forEach(function(el) {
            el.classList.add('text-white/90', 'hover:text-white');
            el.classList.remove('text-brand', 'hover:text-brand-light');
          });
          if (headerCtaBtn) {
            headerCtaBtn.classList.add('bg-white/20', 'backdrop-blur-sm', 'text-white', 'border-white/30', 'hover:bg-white', 'hover:text-brand');
            headerCtaBtn.classList.remove('bg-brand', 'border-brand', 'hover:bg-brand-light');
          }
          if (menuBtn) { menuBtn.classList.add('text-white'); menuBtn.classList.remove('text-brand'); }
        }
      }
      updateHeader();
      window.addEventListener('scroll', updateHeader, { passive: true });
    }

    /* Floating CTA visibility */
    var floatingCta = document.getElementById('floating-cta');
    if (floatingCta) {
      window.addEventListener('scroll', function() {
        if (window.scrollY > 600) {
          floatingCta.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
          floatingCta.classList.add('opacity-100', 'translate-y-0', 'pointer-events-auto');
        } else {
          floatingCta.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
          floatingCta.classList.remove('opacity-100', 'translate-y-0', 'pointer-events-auto');
        }
      }, { passive: true });
    }

    /* Smooth scroll for anchors */
    document.querySelectorAll('a[href^="#"]').forEach(function(anchor) {
      anchor.addEventListener('click', function(e) {
        var target = document.querySelector(anchor.getAttribute('href'));
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  });
})();
</script>
    <?php
}, 10);
