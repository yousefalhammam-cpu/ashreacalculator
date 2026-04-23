// ── AirCalc Pro — core/storage.js ───────────────────────────────────────
// Centralises all localStorage access.
// Keys are unchanged from original app.js to preserve existing user data.
//
// Existing keys:
//   acp9h           → history array
//   acp9q           → quotation lines array
//   acp9qs          → quotation settings object
//   acp9mode        → quoteMode string ('room'|'proj')
//   acp9theme       → theme string ('dark'|'light')
//   ac_bundleConfig → bundle config object

(function () {
  'use strict';

  var H = window.AppHelpers;

  // ── Safe JSON helpers ─────────────────────────────────────────────────────
  function safeParse(raw, fallback) {
    if (H && H.safeJSONParse) return H.safeJSONParse(raw, fallback);
    try {
      var v = JSON.parse(raw);
      return (v !== null && v !== undefined) ? v : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function safeStringify(value) {
    try {
      return JSON.stringify(value);
    } catch (e) {
      return null;
    }
  }

  function lsSet(key, value) {
    try {
      localStorage.setItem(key, safeStringify(value));
      return true;
    } catch (e) {
      console.warn('[Storage] set failed:', key, e);
      return false;
    }
  }

  function lsGet(key, fallback) {
    try {
      return safeParse(localStorage.getItem(key), fallback);
    } catch (e) {
      return fallback;
    }
  }

  function lsSetRaw(key, value) {
    try {
      localStorage.setItem(key, value);
      return true;
    } catch (e) {
      console.warn('[Storage] setRaw failed:', key, e);
      return false;
    }
  }

  function lsGetRaw(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  }

  function lsRemove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {}
  }

  // ── HISTORY ────────────────────────────────────────────────────────────────
  function saveHistory(hist, qlines) {
    lsSet('acp9h', hist);
    lsSet('acp9q', qlines);
  }

  function restoreHistory() {
    var hist   = lsGet('acp9h', []);
    var qlines = lsGet('acp9q', []);

    while (qlines.length < hist.length) {
      var last = qlines.length > 0 ? qlines[qlines.length - 1] : {};
      qlines.push({
        qty: 1,
        up: last.up || 0,
        unitType: last.unitType || 'split',
        selectedBtu: last.selectedBtu || 0
      });
    }

    qlines = qlines.slice(0, hist.length);
    return { hist: hist, qlines: qlines };
  }

  // ── QUOTATION SETTINGS ─────────────────────────────────────────────────────
  function saveQuoteSettings(settings) {
    lsSet('acp9qs', settings);
  }

  function restoreQuoteSettings() {
    return lsGet('acp9qs', {
      vatOn: true,
      instPct: 10,
      qsValidity: 14,
      qsNotes: ''
    });
  }

  // ── QUOTE MODE ─────────────────────────────────────────────────────────────
  function saveQuoteMode(mode) {
    lsSetRaw('acp9mode', mode);
  }

  function restoreQuoteMode() {
    var raw = lsGetRaw('acp9mode');
    return raw === 'proj' ? 'proj' : 'room';
  }

  // ── THEME ──────────────────────────────────────────────────────────────────
  function saveTheme(theme) {
    lsSetRaw('acp9theme', theme);
  }

  function restoreTheme() {
    var raw = lsGetRaw('acp9theme');
    return raw === 'dark' ? 'dark' : 'light';
  }

    // ── CALC MODE ──────────────────────────────────────────────────────────────
  function saveCalcMode(mode) {
    lsSetRaw('aircalc_calc_mode', mode);
  }

  function restoreCalcMode() {
    var raw = lsGetRaw('aircalc_calc_mode');
    return raw === 'advanced' ? 'advanced' : 'basic';
  }

  // ── CURRENT PROJECT ID ─────────────────────────────────────────────────────
  function saveCurrentProjectId(id) {
    if (!id) {
      lsRemove('aircalc_current_project_id');
      return;
    }
    lsSetRaw('aircalc_current_project_id', String(id));
  }

  function restoreCurrentProjectId() {
    return lsGetRaw('aircalc_current_project_id') || '';
  }
  // ── BUNDLE CONFIG ──────────────────────────────────────────────────────────
  var BUNDLE_CONFIG_DEFAULTS = {
    unitType: 'package',
    selectedBtu: 0,
    qty: 1,
    unitPrice: 0,
    designBasis: 'required',
    supplyFpm: 1000,
    returnFpm: 800,
    cfmPerTr: 400
  };

  function saveBundleConfig(config) {
    lsSet('ac_bundleConfig', config);
  }

  function restoreBundleConfig() {
    var saved = lsGet('ac_bundleConfig', null);
    if (!saved || typeof saved !== 'object') {
      return Object.assign({}, BUNDLE_CONFIG_DEFAULTS);
    }

    var merged = Object.assign({}, BUNDLE_CONFIG_DEFAULTS);
    Object.keys(saved).forEach(function (k) {
      if (k in merged) merged[k] = saved[k];
    });
    return merged;
  }

  // ── CLEAR ALL ──────────────────────────────────────────────────────────────
    function clearAll() {
    lsRemove('acp9h');
    lsRemove('acp9q');
    lsRemove('acp9qs');
    lsRemove('acp9mode');
    lsRemove('acp9theme');
    lsRemove('ac_bundleConfig');
    lsRemove('aircalc_calc_mode');
    lsRemove('aircalc_current_project_id');
  }

  // ── Expose ─────────────────────────────────────────────────────────────────
    window.AppStorage = {
    saveHistory: saveHistory,
    restoreHistory: restoreHistory,

    saveQuoteSettings: saveQuoteSettings,
    restoreQuoteSettings: restoreQuoteSettings,

    saveQuoteMode: saveQuoteMode,
    restoreQuoteMode: restoreQuoteMode,

    saveTheme: saveTheme,
    restoreTheme: restoreTheme,

    saveCalcMode: saveCalcMode,
    restoreCalcMode: restoreCalcMode,

    saveCurrentProjectId: saveCurrentProjectId,
    restoreCurrentProjectId: restoreCurrentProjectId,

    saveBundleConfig: saveBundleConfig,
    restoreBundleConfig: restoreBundleConfig,
    BUNDLE_CONFIG_DEFAULTS: BUNDLE_CONFIG_DEFAULTS,

    clearAll: clearAll
  };

  console.log('[AirCalc] AppStorage initialised');
})();
