// wp-push/migrate/lib/elementor-builder.js
// Helpers to build Elementor JSON structures.
const crypto = require('crypto');

const ELEMENTOR_VERSION = '3.28.0'; // Elementor schema version — must match the installed plugin.

function id() {
  return crypto.randomBytes(4).toString('hex').slice(0, 7);
}

function section(children = [], settings = {}) {
  return {
    id: id(),
    elType: 'section',
    settings,
    elements: children,
    isInner: false,
  };
}

function column(children = [], size = 100, settings = {}) {
  return {
    id: id(),
    elType: 'column',
    settings: { _column_size: size, _inline_size: null, ...settings },
    elements: children,
    isInner: false,
  };
}

function widget(type, settings = {}) {
  return {
    id: id(),
    elType: 'widget',
    widgetType: type,
    settings,
    elements: [],
    isInner: false,
  };
}

// Specific widget helpers
const heading = (title, level = 'h2', settings = {}) =>
  widget('heading', { title, header_size: level, ...settings });

const text = (html, settings = {}) =>
  widget('text-editor', { editor: html, ...settings });

const button = (text, href = '#', settings = {}) =>
  widget('button', {
    text,
    link: { url: href, is_external: '', nofollow: '' },
    ...settings,
  });

const image = (url, alt = '', id_media = 0, settings = {}) =>
  widget('image', { image: { url, id: id_media, alt }, ...settings });

const html = (code, settings = {}) =>
  widget('html', { html: code, ...settings });

const spacer = (space = 40, unit = 'px') =>
  widget('spacer', { space: { unit, size: space } });

// Wrap raw HTML into the minimal Elementor structure (1 section, 1 column, 1 html widget).
function wrapHtml(rawHtml, sectionSettings = {}) {
  return [section([column([html(rawHtml)])], {
    stretch_section: 'section-stretched',
    content_width: { unit: 'px', size: 1140 },
    layout: 'boxed',
    gap: 'no',
    ...sectionSettings,
  })];
}

module.exports = {
  ELEMENTOR_VERSION,
  id, section, column, widget,
  heading, text, button, image, html, spacer,
  wrapHtml,
};
