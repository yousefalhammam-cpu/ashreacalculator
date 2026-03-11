// ── AirCalc Pro — modules/quote.js ──────────────────────────────────────
// Owns: quote rendering, line-item updates, totals, VAT, bundle, proj mode.
// All rendering logic preserved verbatim from app.js.
// Exposed on window.AppQuote.
// app.js still re-declares these as globals (renderQuote, refreshGrandTotal,
// etc.) — this module is a clean extracted reference. The globals in app.js
// will be pointed to AppQuote in a later phase.

(function () {
  'use strict';

  var H = window.AppHelpers;

  function G(id)   { return H ? H.G(id) : document.getElementById(id); }
  function money(v){ return H ? H.money(v) : Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function t(k)    { return window.AppI18n ? window.AppI18n.t(k) : k; }

  // ── Quotation line helpers (read globals from app.js) ────────────────────
  function getQty(i)    { return Math.max(1, parseInt(((typeof qlines !== 'undefined' ? qlines : [])[i] || {}).qty) || 1); }
  function getUP(i)     { return parseFloat(((typeof qlines !== 'undefined' ? qlines : [])[i] || {}).up) || 0; }
  function getUT(i)     { return ((typeof qlines !== 'undefined' ? qlines : [])[i] || {}).unitType || 'split'; }
  function getSelBtu(i) { return parseInt(((typeof qlines !== 'undefined' ? qlines : [])[i] || {}).selectedBtu) || 0; }

  function _hist()   { return typeof hist   !== 'undefined' ? hist   : []; }
  function _qlines() { return typeof qlines !== 'undefined' ? qlines : []; }
  function _vatOn()  { return typeof vatOn  !== 'undefined' ? vatOn  : true; }
  function _lang()   { return typeof lang   !== 'undefined' ? lang   : 'ar'; }
  function _bundleOn(){ return typeof bundleOn !== 'undefined' ? bundleOn : false; }
  function _quoteMode(){ return typeof quoteMode !== 'undefined' ? quoteMode : 'room'; }

  // ── refreshGrandTotal ────────────────────────────────────────────────────
  // Grand-total calc — handles both room mode and project mode.
  function refreshGrandTotal() {
    var totalQty = 0, subtotal = 0;
    if (_quoteMode() === 'proj') {
      var pQty = Math.max(1, parseInt((G('proj-qty') || { value: '1' }).value) || 1);
      var pUP  = parseFloat((G('proj-up') || { value: '0' }).value) || 0;
      totalQty = pQty;
      subtotal = pQty * pUP;
    } else {
      var h = _hist(), q = _qlines();
      for (var i = 0; i < h.length; i++) {
        totalQty += getQty(i);
        subtotal += getQty(i) * getUP(i);
      }
    }
    var ip      = parseInt((G('qs-inst') || { value: '10' }).value) || 10;
    var instAmt = subtotal * ip / 100;
    var vatBase = subtotal + instAmt;
    var vatAmt  = _vatOn() ? vatBase * 0.15 : 0;
    var grand   = vatBase + vatAmt;
    var cur     = t('cur');

    var isl = G('qs-instl');   if (isl) isl.textContent = t('qsinstl') + ' (' + ip + '%)';
    var sv  = G('qs-subtotal-v'); if (sv) sv.textContent  = cur + ' ' + money(subtotal);
    var iv  = G('qs-inst-v');  if (iv)  iv.textContent   = cur + ' ' + money(instAmt);
    var vr  = G('vat-row');    if (vr)  vr.style.display = _vatOn() ? '' : 'none';
    var vv  = G('qs-vat-v');   if (vv)  vv.textContent   = cur + ' ' + money(vatAmt);
    var tq  = G('qt-total-qty'); if (tq) tq.textContent  = totalQty;
    var tg  = G('qt-grand');   if (tg)  tg.textContent   = cur + ' ' + money(grand);
  }

  // ── addToQuote ───────────────────────────────────────────────────────────
  function addToQuote() {
    if (typeof goPanel === 'function') goPanel('hist');
    if (typeof toast === 'function') {
      toast(_lang() === 'ar' ? '✅ تم الإضافة للعرض' : '✅ Added to quote');
    }
    var br = G('bundle-row');
    if (br) br.style.display = _hist().length > 1 ? '' : 'none';
    if (typeof _updateBundleUI === 'function') _updateBundleUI();
  }

  // ── setQty / setUP / setSelBtu ────────────────────────────────────────────
  function setQty(i, v) {
    var q = _qlines(); if (!q[i]) q[i] = { qty: 1, up: 0 };
    q[i].qty = Math.max(1, parseInt(v) || 1);
    if (typeof save === 'function') save();
    var e = G('qlt-' + i); if (e) e.textContent = money(getQty(i) * getUP(i));
    refreshGrandTotal();
    if (typeof renderQuote === 'function') renderQuote();
  }

  function setUp(i, v) {
    var q = _qlines(); if (!q[i]) q[i] = { qty: 1, up: 0 };
    q[i].up = parseFloat(v) || 0;
    if (typeof save === 'function') save();
    var e = G('qlt-' + i); if (e) e.textContent = money(getQty(i) * getUP(i));
    refreshGrandTotal();
  }

  function setSelBtu(i, v) {
    var q = _qlines(); if (!q[i]) q[i] = { qty: 1, up: 0, unitType: 'split', selectedBtu: 0 };
    q[i].selectedBtu = parseInt(v) || 0;
    if (typeof save === 'function') save();
    if (typeof renderQuote === 'function') renderQuote();
  }

  function setUnitType(i, v) {
    var q = _qlines(); if (!q[i]) q[i] = { qty: 1, up: 0, unitType: 'split', selectedBtu: 0 };
    var oldType = q[i].unitType || 'split';
    var newType = v || 'split';
    q[i].unitType = newType;
    if (oldType !== newType) {
      var reqBtu2 = parseInt((_hist()[i] || {}).btu) || 0;
      if (typeof getCatalog === 'function' && typeof defaultCapForUT === 'function') {
        var newCat = getCatalog(newType);
        var validBtus = newCat.map(function (x) { return x.btu; });
        if (validBtus.indexOf(q[i].selectedBtu) < 0) {
          q[i].selectedBtu = defaultCapForUT(newType, reqBtu2);
        }
      }
    }
    if (typeof save === 'function') save();
    if (typeof renderQuote === 'function') renderQuote();
  }

  // ── Quote settings persistence ────────────────────────────────────────────
  function qsPersist() {
    var vatToggle = G('vat-tog');
    if (typeof vatOn !== 'undefined' && vatToggle) vatOn = vatToggle.classList.contains('on');
    if (typeof instPct   !== 'undefined') instPct   = parseInt((G('qs-inst')     || { value: '10' }).value)  || 10;
    if (typeof qsValidity !== 'undefined') qsValidity = parseInt((G('qs-validity') || { value: '14' }).value) || 14;
    if (typeof qsNotes   !== 'undefined') qsNotes   = (G('qs-notes') || { value: '' }).value || '';
    if (window.AppStorage) {
      AppStorage.saveQuoteSettings({ vatOn: vatOn, instPct: instPct, qsValidity: qsValidity, qsNotes: qsNotes });
    } else {
      try { localStorage.setItem('acp9qs', JSON.stringify({ vatOn: vatOn, instPct: instPct, qsValidity: qsValidity, qsNotes: qsNotes })); } catch (e) {}
    }
    refreshGrandTotal();
  }

  function toggleVAT() {
    var vt = G('vat-tog'); if (!vt) return;
    vt.classList.toggle('on');
    if (typeof vatOn !== 'undefined') vatOn = vt.classList.contains('on');
    var vr = G('vat-row'); if (vr) vr.style.display = _vatOn() ? '' : 'none';
    qsPersist();
  }

  function applyQSState() {
    var inst = G('qs-inst');     if (inst) inst.value = String(typeof instPct !== 'undefined' ? instPct : 10);
    var vt   = G('vat-tog');
    if (vt) {
      if (_vatOn()) vt.classList.add('on'); else vt.classList.remove('on');
    }
    var vr = G('vat-row');       if (vr) vr.style.display = _vatOn() ? '' : 'none';
    var val = G('qs-validity');  if (val) val.value = String(typeof qsValidity !== 'undefined' ? qsValidity : 14);
    var nts = G('qs-notes');     if (nts) nts.value = typeof qsNotes !== 'undefined' ? qsNotes : '';
  }

  // ── Expose ────────────────────────────────────────────────────────────────
  window.AppQuote = {
    refreshGrandTotal: refreshGrandTotal,
    addToQuote:        addToQuote,
    setQty:            setQty,
    setUp:             setUp,
    setSelBtu:         setSelBtu,
    setUnitType:       setUnitType,
    qsPersist:         qsPersist,
    toggleVAT:         toggleVAT,
    applyQSState:      applyQSState,
    // Accessors used by invoice / export helpers
    getQty:     getQty,
    getUP:      getUP,
    getUT:      getUT,
    getSelBtu:  getSelBtu
  };

  console.log('[AirCalc] AppQuote initialised');
})();