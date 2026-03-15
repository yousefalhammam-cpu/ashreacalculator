// ── AirCalc Pro — main.js ────────────────────────────────────────────────
// Bootstrap entry point. Runs after DOM ready.
// Phase 3: uses AppStorage directly instead of raw localStorage calls.

(function() {
  'use strict';

  // ── Helpers shorthand ────────────────────────────────────────────────
  var H = window.AppHelpers;
  var S = window.AppState;

  // ── Fallback error UI ────────────────────────────────────────────────
  function showFatalError(err) {
    console.error('[AirCalc] Fatal startup error:', err);
    document.body.innerHTML = [
      '<div style="padding:40px;text-align:center;color:#f87171;',
      'font-family:sans-serif;background:#0a0e17;min-height:100vh;">',
      '<div style="font-size:48px;margin-bottom:16px;">⚠️</div>',
      '<h2 style="color:#f87171;margin-bottom:8px;">فشل تحميل التطبيق / App failed to load</h2>',
      '<p style="color:#94a3b8;margin-bottom:4px;">' + (err && err.message ? err.message : String(err)) + '</p>',
      '<p style="color:#64748b;font-size:13px;margin-bottom:24px;">',
      'Make sure data.json is present and accessible on the server.</p>',
      '<button onclick="location.reload()" style="',
      'padding:12px 28px;background:#0ea5e9;color:#fff;border:none;',
      'border-radius:8px;cursor:pointer;font-size:16px;font-family:sans-serif">',
      '🔄 إعادة المحاولة / Retry</button>',
      '</div>'
    ].join('');
  }

  // ── Restore state via AppStorage ─────────────────────────────────────────
  // Phase 3: delegates entirely to AppStorage — no raw localStorage here.
  function restoreState() {
    var AS = window.AppStorage;
    if (!AS) {
      console.warn('[AirCalc] AppStorage not available — falling back to raw localStorage');
      _restoreStateLegacy();
      return;
    }

    // History + qlines
    var histData = AS.restoreHistory();
    S.hist   = histData.hist;
    S.qlines = histData.qlines;

    // Quote settings
    var qs = AS.restoreQuoteSettings();
    if (qs.vatOn      !== undefined) S.vatOn      = qs.vatOn;
    if (qs.instPct    !== undefined) S.instPct    = qs.instPct;
    if (qs.qsValidity !== undefined) S.qsValidity = qs.qsValidity;
    if (qs.qsNotes    !== undefined) S.qsNotes    = qs.qsNotes;

    // Quote mode
    S.quoteMode = AS.restoreQuoteMode();

    // Theme
    S.theme = AS.restoreTheme();

    // Bundle config
    var bc = AS.restoreBundleConfig();
    if (bc && typeof bc === 'object') {
      Object.keys(bc).forEach(function (k) {
        if (k in S.bundleConfig) S.bundleConfig[k] = bc[k];
      });
    }

    console.log('[AirCalc] State restored via AppStorage —',
      S.hist.length, 'history records,',
      'mode:', S.quoteMode,
      'theme:', S.theme
    );
  }

  // ── Legacy fallback (only if AppStorage unavailable) ─────────────────────
  function _restoreStateLegacy() {
    S.hist   = H.safeJSONParse(localStorage.getItem('acp9h'), []);
    S.qlines = H.safeJSONParse(localStorage.getItem('acp9q'), []);
    while (S.qlines.length < S.hist.length) {
      var last = S.qlines.length > 0 ? S.qlines[S.qlines.length - 1] : {};
      S.qlines.push({ qty:1, up: last.up||0, unitType: last.unitType||'split', selectedBtu: last.selectedBtu||0 });
    }
    S.qlines = S.qlines.slice(0, S.hist.length);
    var qs = H.safeJSONParse(localStorage.getItem('acp9qs'), {});
    if (qs.vatOn !== undefined) S.vatOn = qs.vatOn;
    if (qs.instPct    !== undefined) S.instPct    = qs.instPct;
    if (qs.qsValidity !== undefined) S.qsValidity = qs.qsValidity;
    if (qs.qsNotes !== undefined) S.qsNotes = qs.qsNotes;
    var qm = localStorage.getItem('acp9mode');
    if (qm === 'proj') S.quoteMode = 'proj';
    var th = localStorage.getItem('acp9theme');
    if (th === 'light') S.theme = 'light';
    var bc = H.safeJSONParse(localStorage.getItem('ac_bundleConfig'), null);
    if (bc && typeof bc === 'object') {
      Object.keys(bc).forEach(function (k) { if (k in S.bundleConfig) S.bundleConfig[k] = bc[k]; });
    }
    console.log('[AirCalc] State restored via legacy fallback —', S.hist.length, 'records');
  }

  // ── Register service worker ───────────────────────────────────────────
  function registerSW() {
    if (!('serviceWorker' in navigator)) {
      console.warn('[AirCalc] Service workers not supported');
      return;
    }
    navigator.serviceWorker.register('./sw.js')
      .then(function(reg) {
        console.log('[AirCalc] SW registered, scope:', reg.scope);
      })
      .catch(function(err) {
        console.warn('[AirCalc] SW registration failed:', err);
      });
  }

  // ── Boot sequence ────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    console.log('[AirCalc] main.js DOMContentLoaded — starting boot');

    // 1. Fetch and validate data.json
    fetch('./data.json')
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' fetching data.json');
        return r.json();
      })
      .then(function(data) {
        // 2. Validate
        H.validateAppData(data);
        console.log('[AirCalc] data.json validated ✅ —',
          Object.keys(data.ROOMS).length, 'rooms,',
          data.DEVS.length, 'devices'
        );

        // 3. Load into AppState
        S.data.ROOMS        = data.ROOMS;
        S.data.DEVS         = data.DEVS;
        S.data.AC_CATALOG   = data.AC_CATALOG;
        S.data.UT_TO_CAT    = data.UT_TO_CAT;
        S.data.UT_LABELS_AR = data.UT_LABELS_AR;
        S.data.UT_LABELS_EN = data.UT_LABELS_EN;
        if (data.DUCT_WIDTHS)  S.data.DUCT_WIDTHS  = data.DUCT_WIDTHS;
        if (data.DUCT_HEIGHTS) S.data.DUCT_HEIGHTS = data.DUCT_HEIGHTS;

        // 4. Restore localStorage state
        restoreState();

        // 5. Sync AppState → legacy app.js vars
        S.syncToLegacy();

        // 6. Hand off to existing app.js bootstrap functions
        //    (loadAppData + initApp are still defined in app.js)
        if (typeof loadAppData === 'function') loadAppData(data);
        if (typeof initApp     === 'function') initApp();

        // 7. Register service worker
        registerSW();

        console.log('[AirCalc] Boot complete ✅');
      })
      .catch(function(err) {
        showFatalError(err);
      });
  });

})();
