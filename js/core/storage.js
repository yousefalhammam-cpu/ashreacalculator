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

  // Recover the known legacy ACH/CFM collision without changing loads or prices.
  function normalizeRoomRecord(room) {
    if (!room || typeof room !== 'object') return room;
    var healthcare = room.mode === 'hc' || room.calcMode === 'hc' || /^h_/.test(room.rid || room.id || '');
    if (!healthcare) return room;
    room.mode = room.calcMode = 'hc';
    if (room.airflowSchemaVersion === 2) return room;
    var volume = Number(room.vol), totalAch = Number(room.ach);
    var outdoorAch = Number(room.outdoorAch != null ? room.outdoorAch : room.oaStd);
    var recoverable = room.oaStd != null && Number.isFinite(volume) && volume > 0 &&
      Number.isFinite(totalAch) && totalAch > 0 && Number.isFinite(outdoorAch) && outdoorAch >= 0 && outdoorAch <= totalAch;
    if (!recoverable) {
      room.airflowReviewRequired = true;
      return room;
    }
    var previousOa = room.oa;
    var supply = Number(room.sup || room.cfm) || Math.round(totalAch * volume * 35.3147 / 60);
    var outdoor = room.outdoorAirCfm != null ? Number(room.outdoorAirCfm) :
      (room.freshAirMode === 'fresh100' ? supply : Math.round(outdoorAch * volume * 35.3147 / 60));
    if (!Number.isFinite(outdoor) || outdoor < 0 || outdoor > supply) {
      room.airflowReviewRequired = true;
      return room;
    }
    room.outdoorAirCfm = room.oa = outdoor;
    room.outdoorAch = room.oaAch = room.oaStd = outdoorAch;
    room.recirc = Math.max(0, supply - outdoor);
    room.airflowSchemaVersion = 2;
    room.airflowMigration = { previousOa: previousOa, basis: 'stored_volume_and_ach', reviewRequired: true };
    room.finalLoadVerified = false;
    room.airflowBalanceVerified = false;
    return room;
  }

  function normalizeHistory(records) {
    return Array.isArray(records) ? records.map(normalizeRoomRecord) : [];
  }

  // Explicitly priced/manual legacy selections are assignments; automatic suggestions are not.
  function normalizeQuoteLines(lines) {
    if (!Array.isArray(lines)) return [];
    return lines.map(function(line, index){
      if (!line || typeof line !== 'object') return {};
      if (Array.isArray(line.systems) && line.systems.length) return line;
      var capacity = Number(line.selectedBtu), price = Number(line.up) || 0;
      if (!(capacity > 0) || !(price > 0 || line.qtyAuto === false)) return line;
      var id = 'legacy_room_system_' + index;
      line.systems = [{ id:id, unitType:line.unitType || 'split', selectedBtu:capacity,
        qty:Math.max(1, parseInt(line.qty,10) || 1), manualCapacity:true,
        manualCapacityBtuH:capacity, selectionMode:'manual' }];
      line.systemPrices = line.systemPrices || {};
      line.systemPrices[id] = { unitPrice:price };
      line.systemPricing = line.systemPrices;
      return line;
    });
  }

  // ── HISTORY ────────────────────────────────────────────────────────────────
  function saveHistory(hist, qlines) {
    lsSet('acp9h', hist);
    lsSet('acp9q', qlines);
  }

  function restoreHistory() {
    var hist   = normalizeHistory(lsGet('acp9h', []));
    var qlines = normalizeQuoteLines(lsGet('acp9q', []));

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
    normalizeRoomRecord: normalizeRoomRecord,
    normalizeHistory: normalizeHistory,
    normalizeQuoteLines: normalizeQuoteLines,

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
