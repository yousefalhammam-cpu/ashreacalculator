// ── AirCalc Pro — modules/history.js ─────────────────────────────────────
// Owns: saveHist, renderHist, delRec, editRec, resetApp, clearHist
// Strategy: shadow extract — defines window.AppHistory.
//   All functions read live globals from app.js.
//   Backward-compatible window bindings kept for HTML inline handlers.
//
// Depends on at call-time (live globals from app.js):
//   hist, qlines, devs, editIdx, lang, curRoom, ROOMS, DEVS,
//   vatOn, instPct, quoteMode, bundleOn, bundleConfig, projState,
//   G, t, toast, flash, money, save, renderQuote, renderDevs,
//   applyLang, applyQSState, refreshGrandTotal, setQuoteMode,
//   _updateBundleUI, goPanel

(function () {
  'use strict';

  function G(id)   { return document.getElementById(id); }
  function _t(k)   {
    if (window.AppI18n)  return window.AppI18n.t(k);
    if (typeof t === 'function') return t(k);
    return k;
  }
  function _toast(msg) {
    if (window.AppHelpers) { window.AppHelpers.toast(msg); return; }
    if (typeof toast === 'function') toast(msg);
  }
  function _flash(id, v) {
    if (window.AppHelpers) { window.AppHelpers.flash(id, v); return; }
    if (typeof flash === 'function') flash(id, v);
  }
  function _save() {
    if (typeof save === 'function') save();
  }
  function _lang() { return typeof lang !== 'undefined' ? lang : 'ar'; }
  function _money(v) {
    if (window.AppHelpers) return window.AppHelpers.money(v);
    return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // ── saveHist ──────────────────────────────────────────────────────────────
  function saveHist(vol, ppl, tr, cfm, totalBtu, mkt, devBtu, hcdata) {
    var D    = typeof DEVS !== 'undefined' ? DEVS : [];
    var d    = typeof devs !== 'undefined' ? devs : [];
    var l    = _lang();
    var cr   = typeof curRoom !== 'undefined' ? curRoom : {};
    var eIdx = typeof editIdx !== 'undefined' ? editIdx : -1;
    var h    = typeof hist    !== 'undefined' ? hist    : [];
    var ql   = typeof qlines  !== 'undefined' ? qlines  : [];

    var devSum = d.map(function (item) {
      var c = D.filter(function (x) { return x.id === item.id; })[0];
      return c ? (l === 'ar' ? c.ar : c.en) + '×' + item.qty : '';
    }).filter(Boolean).join(' | ');

    var rec = {
      time:   new Date().toLocaleString('ar-SA'),
      rid:    cr.id,
      ar:     cr.ar,
      en:     cr.en,
      vol:    vol,
      ppl:    ppl,
      devSum: devSum,
      devBtu: devBtu,
      tr:     tr.toFixed(2),
      cfm:    cfm,
      btu:    Math.round(totalBtu),
      mkt:    mkt
    };
    if (hcdata) {
      rec.sup  = hcdata.sup;
      rec.oa   = hcdata.oa;
      rec.exh  = hcdata.exh;
      rec.pres = hcdata.pres;
    }

    if (eIdx >= 0 && eIdx < h.length) {
      h[eIdx] = rec;
      if (typeof editIdx !== 'undefined') editIdx = -1;
    } else {
      h.push(rec);
      var prevUT  = (ql.length > 0 ? ql[ql.length - 1].unitType  : '') || 'split';
      var prevBtu = (ql.length > 0 ? ql[ql.length - 1].selectedBtu : 0)  || 0;
      ql.push({ qty: 1, up: 0, unitType: prevUT, selectedBtu: prevBtu });
      if (h.length > 100) { h.shift(); ql.shift(); }
    }

    _save();
    renderHist();
  }

  // ── renderHist ────────────────────────────────────────────────────────────
  function renderHist() {
    var list = G('hist-list');
    if (!list) return;
    list.innerHTML = '';

    var h  = typeof hist   !== 'undefined' ? hist   : [];
    var l  = _lang();

    var cntEl = G('hist-count');
    if (cntEl) cntEl.textContent = h.length;

    if (!h.length) {
      var em = document.createElement('div');
      em.className = 'hist-empty';
      em.textContent = _t('hempty');
      list.appendChild(em);
      var cc = G('cum-card');
      if (cc) cc.style.display = 'none';
      if (typeof renderQuote === 'function') renderQuote();
      return;
    }

    // Cumulative totals
    var totTR = 0, totCFM = 0, totBTU = 0, totMKT = 0;
    h.forEach(function (r) {
      totTR  += parseFloat(r.tr)  || 0;
      totCFM += r.cfm || 0;
      totBTU += r.btu || 0;
      totMKT += r.mkt || 0;
    });
    var setV = function (id, v) { var el = G(id); if (el) el.textContent = v; };
    setV('cum-tr',  totTR.toFixed(2));
    setV('cum-cfm', totCFM.toLocaleString());
    setV('cum-btu', totBTU.toLocaleString());
    setV('cum-mkt', totMKT.toLocaleString());
    var cumCard = G('cum-card');
    if (cumCard) cumCard.style.display = '';

    // Render each record
    var EMOJI_RE = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/gu;
    h.forEach(function (rec, idx) {
      var cfmLine = '';
      if (rec.sup) cfmLine = 'S:' + rec.sup + ' OA:' + rec.oa + ' Exh:' + rec.exh + ' CFM';
      var _rn  = l === 'ar' ? (rec.ar || rec.en) : (rec.en || rec.ar);
      var name = _rn.replace(EMOJI_RE, '').trim();

      var row = document.createElement('div');
      row.className = 'hist-item';
      row.innerHTML =
        '<div class="hist-main">' +
          '<div class="hist-room">' + (idx + 1) + '. ' + name + '</div>' +
          '<div class="hist-detail">' + rec.vol + ' m³ · ' + rec.ppl + ' 👤' +
            (rec.devSum ? ' · ' + rec.devSum : '') + '</div>' +
          (cfmLine ? '<div class="hist-cfm">' + cfmLine + '</div>' : '') +
          '<div class="hist-time">' + rec.time + '</div>' +
          '<div class="hist-actions">' +
            '<button class="hact-btn" onclick="editRec(' + idx + ')">✏️</button>' +
            '<button class="hact-btn del-btn" onclick="delRec(' + idx + ')">🗑️</button>' +
          '</div>' +
        '</div>' +
        '<div class="hist-right">' +
          '<div class="hist-tr">' + rec.tr + ' TR</div>' +
          '<div class="hist-btu">' + Number(rec.btu).toLocaleString() + ' BTU/h</div>' +
          '<div class="hist-btu">' + Number(rec.mkt).toLocaleString() + ' Mkt</div>' +
        '</div>';
      list.appendChild(row);
    });

    if (typeof renderQuote === 'function') renderQuote();
  }

  // ── delRec ────────────────────────────────────────────────────────────────
  function delRec(idx) {
    if (typeof hist   !== 'undefined') hist.splice(idx, 1);
    if (typeof qlines !== 'undefined') qlines.splice(idx, 1);
    _save();
    renderHist();
    _toast(_t('qdel'));
  }

  // ── editRec ───────────────────────────────────────────────────────────────
  function editRec(idx) {
    var h  = typeof hist  !== 'undefined' ? hist  : [];
    var D  = typeof DEVS  !== 'undefined' ? DEVS  : [];
    var rec = h[idx];
    if (!rec) return;

    if (typeof goPanel === 'function') goPanel('calc');

    var ROOMS_ref = typeof ROOMS !== 'undefined' ? ROOMS : {};
    if (rec.rid && ROOMS_ref[rec.rid]) {
      if (typeof curRoom !== 'undefined') curRoom = ROOMS_ref[rec.rid];
      document.querySelectorAll('#dd-room .dd-item').forEach(function (item) {
        item.classList.remove('sel');
        if ((item.getAttribute('onclick') || '').indexOf("'" + rec.rid + "'") >= 0) {
          item.classList.add('sel');
        }
      });
      var dt = G('dt');
      if (dt && typeof curRoom !== 'undefined') {
        dt.textContent = _lang() === 'ar' ? curRoom.ar : curRoom.en;
      }
    }

    var vEl = G('inp-vol'); if (vEl) vEl.value = rec.vol;
    var pEl = G('inp-ppl'); if (pEl) pEl.value = rec.ppl;

    if (typeof devs !== 'undefined') devs = [];
    if (rec.devSum) {
      rec.devSum.split(' | ').forEach(function (part) {
        var m = part.match(/^(.+?)×(\d+)$/);
        if (!m) return;
        var nm  = m[1].trim();
        var qty = parseInt(m[2], 10) || 1;
        var c   = D.filter(function (x) { return x.ar === nm || x.en === nm; })[0];
        if (c && typeof devs !== 'undefined') devs.push({ id: c.id, qty: qty });
      });
    }

    if (typeof renderDevs === 'function') renderDevs();
    if (typeof editIdx    !== 'undefined') editIdx = idx;
    _toast(_lang() === 'ar'
      ? '✏️ تم تحميل السجل للتعديل'
      : '✏️ Record loaded for editing');
  }

  // ── resetApp ──────────────────────────────────────────────────────────────
  function resetApp() {
    // 1. Clear in-memory state
    if (typeof hist      !== 'undefined') hist      = [];
    if (typeof qlines    !== 'undefined') qlines    = [];
    if (typeof devs      !== 'undefined') devs      = [];
    if (typeof editIdx   !== 'undefined') editIdx   = -1;

    // 2. Clear persisted storage
    if (window.AppStorage && typeof AppStorage.clearAll === 'function') {
      try { AppStorage.clearAll(); } catch(e) {}
    } else {
      var keys = ['acp9h','acp9q','acp9qs','acp9mode','ac_bundleConfig','acp9theme','aircalc_calc_mode','aircalc_current_project_id','aircalc_plan'];
      keys.forEach(function (k) { try { localStorage.removeItem(k); } catch(e) {} });
    }

    // 3. Reset runtime variables
    if (typeof vatOn      !== 'undefined') vatOn      = true;
    if (typeof instPct    !== 'undefined') instPct    = 10;
    if (typeof qsValidity !== 'undefined') qsValidity = 14;
    if (typeof qsNotes    !== 'undefined') qsNotes    = '';
    if (typeof bundleOn   !== 'undefined') bundleOn   = false;
    if (typeof quoteMode  !== 'undefined') quoteMode  = 'room';
    if (typeof projState  !== 'undefined') {
      projState.sysType = 'split';
      projState.selBtu  = 0;
      projState.qty     = 1;
      projState.up      = 0;
    }
    if (typeof bundleConfig !== 'undefined') {
      bundleConfig.unitType    = 'package';
      bundleConfig.selectedBtu = 0;
      bundleConfig.qty         = 1;
      bundleConfig.unitPrice   = 0;
      bundleConfig.designBasis = 'required';
      bundleConfig.supplyFpm   = 1000;
      bundleConfig.returnFpm   = 800;
      bundleConfig.cfmPerTr    = 400;
    }

    // 4. Reset UI inputs
    var fields = {
      'inp-vol': '', 'inp-ppl': '', 'quote-project': '',
      'quote-no': 'Q-001', 'qs-inst': '10',
      'qs-validity': '14', 'qs-notes': '',
      'proj-qty': '1', 'proj-up': ''
    };
    Object.keys(fields).forEach(function (id) {
      var el = G(id); if (el) el.value = fields[id];
    });

    // 5. Reset metric displays
    _flash('vtr', '0.00'); _flash('vcfm', '0');
    _flash('vbtu', '0');   _flash('vmkt', '0');
    var bd = G('breakdown');      if (bd) bd.classList.remove('show');
    var hc = G('hc-card');        if (hc) hc.style.display = 'none';
    var aw = G('add-quote-wrap'); if (aw) aw.style.display = 'none';

    // 6. Navigate and re-render
    if (typeof goPanel          === 'function') goPanel('calc');
    if (typeof setQuoteMode     === 'function') setQuoteMode('room');
    if (typeof _updateBundleUI  === 'function') _updateBundleUI();
    if (typeof renderDevs       === 'function') renderDevs();
    renderHist();
    if (typeof applyQSState     === 'function') applyQSState();
    if (typeof refreshGrandTotal === 'function') refreshGrandTotal();

    // 7. Confirm
    _toast(_lang() === 'ar' ? '✅ تم تصفير التطبيق بالكامل' : '✅ App reset completed');
  }

  // ── clearHist — delegates to resetApp ────────────────────────────────────
  function clearHist() { resetApp(); }

  // ── Expose namespace ──────────────────────────────────────────────────────
  window.AppHistory = {
    saveHist:   saveHist,
    renderHist: renderHist,
    delRec:     delRec,
    editRec:    editRec,
    resetApp:   resetApp,
    clearHist:  clearHist
  };

  // ── Backward-compatibility window bindings ────────────────────────────────
  // app.js (defer) will overwrite these; they serve as early fallback only.
  window.saveHist   = saveHist;
  window.renderHist = renderHist;
  window.delRec     = delRec;
  window.editRec    = editRec;
  window.resetApp   = resetApp;
  window.clearHist  = clearHist;

  console.log('[AirCalc] AppHistory initialised');
})();
