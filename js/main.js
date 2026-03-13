/* ==============================================
   HAROBOZ — Scripts principaux
   ============================================== */

document.addEventListener('DOMContentLoaded', () => {

  /* Menu mobile */
  const toggle = document.querySelector('.hrb-menu-toggle');
  const navList = document.querySelector('.hrb-nav-list');
  if (toggle && navList) {
    toggle.addEventListener('click', () => {
      navList.classList.toggle('active');
      toggle.classList.toggle('open');
      document.body.style.overflow = navList.classList.contains('active') ? 'hidden' : '';
    });
    navList.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        navList.classList.remove('active');
        toggle.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }

  /* FAQ accordéon */
  document.querySelectorAll('.hrb-faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const expanded = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', !expanded);
      const answer = btn.nextElementSibling;
      if (!expanded) {
        answer.style.maxHeight = answer.scrollHeight + 'px';
      } else {
        answer.style.maxHeight = '0';
      }
    });
  });

  /* Header scroll effect */
  const header = document.querySelector('.hrb-header');
  if (header) {
    let lastScroll = 0;
    window.addEventListener('scroll', () => {
      const current = window.scrollY;
      if (current > 80) {
        header.style.background = 'rgba(10, 10, 10, 0.98)';
      } else {
        header.style.background = 'rgba(10, 10, 10, 0.92)';
      }
      lastScroll = current;
    }, { passive: true });
  }

  /* Smooth scroll pour ancres */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* Reveal au scroll */
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('hrb-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.hrb-reveal').forEach(el => observer.observe(el));
});
