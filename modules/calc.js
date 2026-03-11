// ── AirCalc Pro — modules/calc.js ───────────────────────────────────────
// Owns: room calculation trigger, calcROT, calcHC, saveHist hook.
// All engineering formulas preserved verbatim from app.js.
// Exposed on window.AppCalc.
// app.js still declares these as globals — this module runs BEFORE app.js
// so window.AppCalc is available as a clean reference. In a later phase,
// app.js globals can be replaced with AppCalc.* calls.

(function () {
  'use strict';

  var H = window.AppHelpers;

  function G(id) { return H ? H.G(id) : document.getElementById(id); }
  function t(k)  { return window.AppI18n ? window.AppI18n.t(k) : (typeof window.T !== 'undefined' && window.T[lang] ? window.T[lang][k] : k); }

  // ── Numeric input normaliser (Arabic→Western digits) ─────────────────────
  function normInput(el) {
    if (!el) return;
    el.value = el.value.replace(/[٠-٩]/g, function (d) {
      return '٠١٢٣٤٥٦٧٨٩'.indexOf(d);
    });
  }

  function onVolInput() { normInput(G('inp-vol')); }
  function onPplInput() { normInput(G('inp-ppl')); }

  // ── Total device BTU/h load (reads live `devs` + `DEVS` globals) ─────────
  function totalDevBtu() {
    if (typeof devs === 'undefined' || typeof DEVS === 'undefined') return 0;
    var total = 0;
    devs.forEach(function (d) {
      var c = DEVS.filter(function (x) { return x.id === d.id; })[0];
      if (c) total += c.w * d.qty * 3.412; // W → BTU/h
    });
    return Math.round(total);
  }

  // ── Main calculation dispatcher ──────────────────────────────────────────
  function doCalc() {
    var vol = parseFloat(G('inp-vol').value) || 0;
    var ppl = parseInt(G('inp-ppl').value)  || 0;
    if (!vol) {
      if (typeof toast === 'function') toast(t('tnov'));
      return;
    }
    var room = (typeof curRoom !== 'undefined') ? curRoom : null;
    if (!room) return;
    if (room.mode === 'hc') {
      calcHC(vol, ppl);
    } else {
      calcROT(vol, ppl);
    }
  }

  // ── calcROT: standard room occupancy/type calculation ────────────────────
  // Preserved verbatim from app.js — do NOT change formulas.
  function calcROT(vol, ppl) {
    var room  = (typeof curRoom !== 'undefined') ? curRoom : {};
    var base  = vol * (room.factor || 0);
    var pplb  = ppl * 400;
    var devb  = totalDevBtu();
    var sub   = base + pplb + devb;
    var total = sub * 1.10;   // 10% safety factor
    var tr    = total / 12000;
    var cfm   = Math.round(tr * 400);
    var mkt   = Math.ceil(total / 9000) * 9000;

    // Flash metric cards
    if (typeof flash === 'function') {
      flash('vtr', tr.toFixed(2));
      flash('vcfm', cfm.toLocaleString());
      flash('vbtu', Math.round(total).toLocaleString());
      flash('vmkt', mkt.toLocaleString());
    }

    // Breakdown card values
    _setBreakdown(vol, base, pplb, devb, sub, total);
    var bd = G('breakdown'); if (bd) bd.classList.add('show');
    var hc = G('hc-card');  if (hc) hc.style.display = 'none';

    // Persist to history
    if (typeof saveHist === 'function') saveHist(vol, ppl, tr, cfm, total, mkt, devb, null);

    var aw = G('add-quote-wrap'); if (aw) aw.style.display = 'block';
    if (typeof toast === 'function') toast(t('tcalc'));
  }

  // ── calcHC: ASHRAE 170 healthcare airflow calculation ────────────────────
  // Preserved verbatim from app.js — do NOT change formulas.
  function calcHC(vol, ppl) {
    var r    = (typeof curRoom !== 'undefined') ? curRoom : {};
    var ft3  = (H ? H.m3toft3(vol) : vol * 35.3147);
    var sup  = Math.round((r.tach * ft3) / 60);
    var oa   = Math.round((r.oach * ft3) / 60);
    var exh;
    if (r.pres === 'negative') {
      exh = Math.round(sup * 1.10);
    } else if (r.pres === 'positive') {
      exh = Math.round(sup * 0.90);
    } else {
      exh = sup;
    }

    var base  = sup * 1.08 * 20;
    var pplb  = ppl * 400;
    var devb  = totalDevBtu();
    var sub   = base + pplb + devb;
    var total = sub * 1.10;
    var tr    = total / 12000;
    var mkt   = Math.ceil(total / 9000) * 9000;

    if (typeof flash === 'function') {
      flash('vtr', tr.toFixed(2));
      flash('vcfm', sup.toLocaleString());
      flash('vbtu', Math.round(total).toLocaleString());
      flash('vmkt', mkt.toLocaleString());
    }

    _setBreakdown(vol, base, pplb, devb, sub, total);
    var bd = G('breakdown'); if (bd) bd.classList.add('show');

    // HC-specific card
    var pill = G('hc-pill');
    if (pill) {
      var l = (typeof lang !== 'undefined') ? lang : 'ar';
      var pk = r.pres === 'positive' ? 'ppos' : r.pres === 'negative' ? 'pneg' : 'pneu';
      pill.textContent = t(pk);
      pill.className = 'hc-pill ' + (r.pres === 'positive' ? 'pos' : r.pres === 'negative' ? 'neg' : 'neu');
    }

    var _s = function (id, v) { var e = G(id); if (e) e.textContent = v; };
    _s('hc-temp',  (r.tr  || [0, 0])[0] + '–' + (r.tr  || [0, 0])[1] + ' °C');
    _s('hc-rh',    (r.rh  || [0, 0])[0] + '–' + (r.rh  || [0, 0])[1] + '% RH');
    _s('hcv-ach',  r.tach);
    _s('hcv-sup',  sup.toLocaleString());
    _s('hcv-oa',   oa.toLocaleString());
    _s('hcv-exh',  exh.toLocaleString());

    var noteRow = G('hc-note-row');
    if (r.note) {
      if (noteRow) noteRow.style.display = '';
      _s('hcv-note', r.note);
    } else {
      if (noteRow) noteRow.style.display = 'none';
    }

    var hcCard = G('hc-card'); if (hcCard) hcCard.style.display = 'block';

    if (typeof saveHist === 'function') {
      saveHist(vol, ppl, tr, sup, total, mkt, devb, { sup: sup, oa: oa, exh: exh, pres: r.pres });
    }

    var aw = G('add-quote-wrap'); if (aw) aw.style.display = 'block';
    if (typeof toast === 'function') toast(t('tcalc'));
  }

  // ── Private: update breakdown card DOM ───────────────────────────────────
  function _setBreakdown(vol, base, pplb, devb, sub, total) {
    var _s = function (id, v) { var e = G(id); if (e) e.textContent = v; };
    _s('brv-vol',  vol);
    _s('brv-base', Math.round(base).toLocaleString());
    _s('brv-ppl',  Math.round(pplb).toLocaleString());
    _s('brv-dev',  Math.round(devb).toLocaleString());
    _s('brv-sub',  Math.round(sub).toLocaleString());
    _s('brv-sf',   Math.round(total).toLocaleString());
  }

  // ── Expose ────────────────────────────────────────────────────────────────
  window.AppCalc = {
    onVolInput:   onVolInput,
    onPplInput:   onPplInput,
    doCalc:       doCalc,
    calcROT:      calcROT,
    calcHC:       calcHC,
    totalDevBtu:  totalDevBtu
  };

  console.log('[AirCalc] AppCalc initialised');
})();
