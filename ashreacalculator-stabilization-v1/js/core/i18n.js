// ── AirCalc Pro — core/i18n.js ───────────────────────────────────────────
// Transitional bridge for i18n.
// app.js still owns the live translation logic for now.
// This file only exposes a safe AppI18n wrapper so the refactor can proceed
// without breaking the current app.

(function () {
  'use strict';

  function t(key) {
    if (typeof window._i18n_t === 'function') return window._i18n_t(key);
    if (typeof window.t === 'function') return window.t(key);
    return key;
  }

  function applyLang() {
    if (typeof window._i18n_applyLang === 'function') return window._i18n_applyLang();
    if (typeof window.applyLang === 'function') return window.applyLang();
  }

  function toggleLang() {
    if (typeof window._i18n_toggleLang === 'function') return window._i18n_toggleLang();
    if (typeof window.toggleLang === 'function') return window.toggleLang();
  }

  window.AppI18n = {
    T: {},
    t: t,
    applyLang: applyLang,
    toggleLang: toggleLang,
    LABEL_MAP: {}
  };

  console.log('[AirCalc] i18n bridge initialised');
})();
