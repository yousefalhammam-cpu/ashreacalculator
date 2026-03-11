// ── AirCalc Pro — modules/pdf.js ─────────────────────────────────────────
// Owns: exportCSV, exportInvoiceHTML, exportPDF, exportTechPDF,
//       invCommon, invSharedCss, buildPage1, buildPage2, buildInvoiceHTML
//
// Strategy: shadow extract — defines window.AppPdf namespace.
//   All functions delegate to live app.js globals at call-time.
//   Backward-compatibility window bindings preserved for HTML handlers.
//   app.js (defer) will re-declare these as globals too — the last declaration
//   wins. Since app.js runs after this file (defer vs sync), app.js versions
//   remain the live ones. These serve as forward-compat namespace + fallback.
//
// NOTE: buildPage2 in app.js is PATCHED at lines ~2478+ to add duct sizing
//   distribution table. That patch remains in app.js; this module does NOT
//   duplicate it — we proxy to app.js buildPage2 if available.

(function () {
  'use strict';

  // ── Accessors for live globals ────────────────────────────────────────────
  function G(id)   { return document.getElementById(id); }
  function _lang() { return typeof lang !== 'undefined' ? lang : 'ar'; }
  function _vatOn(){ return typeof vatOn !== 'undefined' ? vatOn : true; }
  function _hist() { return typeof hist !== 'undefined' ? hist : []; }
  function _qlines(){ return typeof qlines !== 'undefined' ? qlines : []; }

  function _t(k) {
    if (window.AppI18n) return window.AppI18n.t(k);
    if (typeof t === 'function') return t(k);
    return k;
  }
  function _toast(msg) {
    if (window.AppHelpers) { window.AppHelpers.toast(msg); return; }
    if (typeof toast === 'function') toast(msg);
  }
  function _money(v) {
    if (window.AppHelpers) return window.AppHelpers.money(v);
    return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function _getQty(i) {
    if (typeof getQty === 'function') return getQty(i);
    return Math.max(1, parseInt((_qlines()[i] || {}).qty) || 1);
  }
  function _getUP(i) {
    if (typeof getUP === 'function') return getUP(i);
    return parseFloat((_qlines()[i] || {}).up) || 0;
  }
  function _getUT(i) {
    if (typeof getUT === 'function') return getUT(i);
    return (_qlines()[i] || {}).unitType || 'split';
  }
  function _getSelBtu(i) {
    if (typeof getSelBtu === 'function') return getSelBtu(i);
    return parseInt((_qlines()[i] || {}).selectedBtu) || 0;
  }
  function _acRoundBtu(btu, method) {
    if (typeof acRoundBtu === 'function') return acRoundBtu(btu, method);
    var steps = [9000,12000,18000,24000,27000,30000,36000,42000,48000,60000,72000,96000,120000];
    for (var i = 0; i < steps.length; i++) { if (steps[i] >= btu) return steps[i]; }
    return Math.ceil(btu / 12000) * 12000;
  }
  function _utLabel(key) {
    if (typeof utLabel === 'function') return utLabel(key);
    return key;
  }

  // ── Lazy-load PDF libraries ───────────────────────────────────────────────
  function loadLib(url, name, ready, onLoad, onErr) {
    if (ready) { onLoad(); return; }
    var s = document.createElement('script');
    s.src = url; s.crossOrigin = 'anonymous';
    s.onload = onLoad;
    s.onerror = function () { onErr(name); };
    document.body.appendChild(s);
  }

  function ensurePdfLibs(callback) {
    var h2cReady    = typeof html2canvas !== 'undefined';
    var jspdfReady  = typeof window.jspdf !== 'undefined';
    if (h2cReady && jspdfReady) { callback(true); return; }

    var loaded = 0, failed = 0;
    function done() {
      loaded + failed >= 2 && callback(failed === 0);
    }
    function ok()       { loaded++; done(); }
    function err(name)  { console.warn(name + ' failed'); failed++; done(); }

    loadLib(
      'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
      'html2canvas', h2cReady, ok, err
    );
    loadLib(
      'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
      'jsPDF', jspdfReady, ok, err
    );
  }

  // ── invCommon ─────────────────────────────────────────────────────────────
  function invCommon() {
    // Delegates to app.js invCommon if available (it has live globals)
    if (typeof window._appInvCommon === 'function') return window._appInvCommon();

    var l    = _lang();
    var isAr = l === 'ar';
    var h    = _hist(), ql = _qlines();

    var proj = (G('quote-project') || { value: '' }).value.trim() ||
               (isAr ? 'غير محدد' : 'Untitled');
    var qno  = (G('quote-no') || { value: '' }).value.trim() || 'Q-001';
    var today = new Date().toLocaleDateString(isAr ? 'ar-SA' : 'en-GB');
    var ip    = parseInt(((G('qs-inst') || { value: '10' })).value) || 10;
    var validDays = parseInt(((G('qs-validity') || { value: '14' })).value) || 14;
    var validLabel = isAr
      ? validDays + (validDays === 7 ? ' أيام' : ' يوم')
      : validDays + ' days';
    var notes = (G('qs-notes') || { value: '' }).value || '';
    var dir   = isAr ? 'rtl' : 'ltr';
    var cur   = _t('cur');

    var subtotal = 0, totalQty = 0;
    for (var i = 0; i < h.length; i++) {
      totalQty += _getQty(i);
      subtotal += _getQty(i) * _getUP(i);
    }
    var instAmt = subtotal * ip / 100;
    var vatBase = subtotal + instAmt;
    var vatAmt  = _vatOn() ? vatBase * 0.15 : 0;
    var grand   = vatBase + vatAmt;

    var fontLink = isAr
      ? '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">'
      : '<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet">';
    var bodyFont = isAr ? "'Cairo', Arial, sans-serif" : "'Segoe UI', Arial, sans-serif";

    var UT_AR = typeof UT_LABELS_AR !== 'undefined' ? UT_LABELS_AR : {};
    var UT_EN = typeof UT_LABELS_EN !== 'undefined' ? UT_LABELS_EN : {};
    var utLbls = {};
    Object.keys(UT_AR).forEach(function (k) {
      utLbls[k] = isAr ? UT_AR[k] : (UT_EN[k] || k);
    });
    utLbls['chillerfcu'] = isAr ? 'وحدة مناولة / FCU' : 'FCU (Chilled Water)';
    utLbls['chiller']    = isAr ? 'تشيلر هوائي' : 'Chiller (Air-Cooled)';

    var bundleMode = (typeof bundleOn !== 'undefined' && bundleOn) &&
                     (typeof quoteMode !== 'undefined' && quoteMode === 'proj');

    return {
      proj: proj, qno: qno, today: today, ip: ip,
      validDays: validDays, validLabel: validLabel, notes: notes,
      isAr: isAr, dir: dir, cur: cur,
      subtotal: subtotal, totalQty: totalQty,
      instAmt: instAmt, vatBase: vatBase, vatAmt: vatAmt, grand: grand,
      fontLink: fontLink, bodyFont: bodyFont, utLbls: utLbls,
      isBundleProj: bundleMode
    };
  }

  // ── exportCSV ─────────────────────────────────────────────────────────────
  // Delegates to app.js exportCSV — it uses many live globals directly
  function exportCSV() {
    if (typeof window._appExportCSV === 'function') { window._appExportCSV(); return; }
    // Fallback: call app.js global directly
    if (typeof exportCSV._appFn === 'function') { exportCSV._appFn(); return; }
    _toast(_lang() === 'ar' ? '⚠️ جارٍ التحميل' : '⚠️ Loading...');
  }

  // ── exportInvoiceHTML ─────────────────────────────────────────────────────
  function exportInvoiceHTML() {
    if (!_hist().length) {
      _toast(_lang() === 'ar' ? '⚠️ لا توجد غرف' : '⚠️ No rooms');
      return;
    }
    var win = window.open('', '_blank');
    if (!win) {
      _toast(_lang() === 'ar' ? '⚠️ افتح منبثقات المتصفح' : '⚠️ Allow popups');
      return;
    }
    // buildInvoiceHTML is in app.js
    var html = (typeof buildInvoiceHTML === 'function')
      ? buildInvoiceHTML()
      : '<p>buildInvoiceHTML not found</p>';
    win.document.write(html);
    win.document.close();
  }

  // ── _capturePdfPages — shared page capture logic ──────────────────────────
  function _capturePdfPages(pages, css, onDone, onError) {
    var A4W = 794, SCALE = 2;
    var jsPDF = window.jspdf.jsPDF;
    var pdf   = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    var pageW_mm = 210, pageH_mm = 297;

    function captureNext(idx) {
      if (idx >= pages.length) { onDone(pdf); return; }
      var pageEl = pages[idx];
      html2canvas(pageEl, {
        scale: SCALE, useCORS: true, allowTaint: true,
        backgroundColor: '#ffffff', width: A4W, windowWidth: A4W,
        scrollX: 0, scrollY: 0, logging: false
      }).then(function (canvas) {
        if (idx > 0) pdf.addPage();
        var canvH_mm = (canvas.height / canvas.width) * pageW_mm;
        if (canvH_mm <= pageH_mm) {
          pdf.addImage(canvas.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, pageW_mm, canvH_mm);
        } else {
          var sliceH_px = Math.floor((pageH_mm / pageW_mm) * canvas.width);
          var yOff = 0, isFirst = true;
          while (yOff < canvas.height) {
            var sc  = document.createElement('canvas');
            sc.width = canvas.width;
            var rem = canvas.height - yOff;
            sc.height = Math.min(sliceH_px, rem);
            var ctx = sc.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, sc.width, sc.height);
            ctx.drawImage(canvas, 0, -yOff);
            var sliceH_mm = (sc.height / canvas.width) * pageW_mm;
            if (!isFirst) pdf.addPage();
            pdf.addImage(sc.toDataURL('image/jpeg', 0.93), 'JPEG', 0, 0, pageW_mm, sliceH_mm);
            isFirst = false;
            yOff   += sliceH_px;
          }
        }
        captureNext(idx + 1);
      }).catch(onError);
    }

    captureNext(0);
  }

  // ── exportPDF ─────────────────────────────────────────────────────────────
  function exportPDF() {
    var l = _lang();
    if (!_hist().length) {
      _toast(l === 'ar' ? '⚠️ لا توجد غرف' : '⚠️ No rooms saved');
      return;
    }
    var btn = G('btn-pdf');
    if (btn) {
      btn.disabled = true;
      btn.textContent = l === 'ar' ? 'جارٍ تحميل المكتبات...' : 'Loading libraries...';
    }

    ensurePdfLibs(function (ok) {
      if (btn) {
        btn.disabled = false;
        btn.textContent = l === 'ar' ? '📥 تحميل PDF' : '📥 Download PDF';
      }
      if (!ok) { _toast(l === 'ar' ? '⚠️ فشل تحميل مكتبة PDF' : '⚠️ PDF library failed'); return; }
      _doExportPDF();
    });
  }

  function _doExportPDF() {
    var l   = _lang();
    var btn = G('btn-pdf');
    if (btn) { btn.disabled = true; btn.textContent = l === 'ar' ? 'جارٍ التحميل...' : 'Generating...'; }

    // Use app.js page builders (they carry all live state)
    var c        = (typeof invCommon    === 'function') ? invCommon()    : {};
    var css      = (typeof invSharedCss === 'function') ? invSharedCss(c) : '';
    var page1Fn  = (typeof buildPage1   === 'function') ? buildPage1     : function () { return ''; };
    var page2Fn  = (typeof buildPage2   === 'function') ? buildPage2     : function () { return ''; };

    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;z-index:-1;';
    wrap.innerHTML = page1Fn(c) + page2Fn(c);
    document.body.appendChild(wrap);

    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    wrap.prepend(styleEl);

    var fontLink = document.createElement('link');
    fontLink.rel  = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap';
    wrap.prepend(fontLink);

    var pages = [wrap.querySelector('#pdf-page1'), wrap.querySelector('#pdf-page2')].filter(Boolean);

    var cleanup = function () { if (document.body.contains(wrap)) document.body.removeChild(wrap); };

    var doCapture = function () {
      _capturePdfPages(pages, css,
        function (pdf) {
          cleanup();
          var qno  = (G('quote-no')      || { value: '' }).value.trim() || '';
          var proj = (G('quote-project') || { value: '' }).value.trim() || '';
          var fname = 'AirCalc_Invoice';
          if (qno) fname = 'Quote_' + qno;
          else if (proj) fname = proj.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g, '_');
          pdf.save(fname + '.pdf');
          _toast(l === 'ar' ? '📥 تم تحميل PDF' : '📥 PDF downloaded');
          if (btn) { btn.disabled = false; btn.innerHTML = '📥 <span id="lbl-export3">' + (l === 'ar' ? 'تحميل PDF' : 'Download PDF') + '</span>'; }
        },
        function (err) {
          cleanup();
          console.error('PDF error:', err);
          _toast(l === 'ar' ? '❌ فشل التحميل' : '❌ PDF failed');
          if (btn) { btn.disabled = false; btn.innerHTML = '📥 <span id="lbl-export3">' + (l === 'ar' ? 'تحميل PDF' : 'Download PDF') + '</span>'; }
        }
      );
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        setTimeout(doCapture, l === 'ar' ? 800 : 400);
      });
    } else {
      setTimeout(doCapture, l === 'ar' ? 1000 : 600);
    }
  }

  // ── exportTechPDF ─────────────────────────────────────────────────────────
  function exportTechPDF() {
    var l = _lang();
    if (!_hist().length) {
      _toast(l === 'ar' ? '⚠️ لا توجد غرف' : '⚠️ No rooms');
      return;
    }
    var btn = G('btn-techpdf');
    if (btn) {
      btn.disabled = true;
      btn.textContent = l === 'ar' ? 'جارٍ تحميل المكتبات...' : 'Loading libraries...';
    }

    ensurePdfLibs(function (ok) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '🛠️ <span id="lbl-export4">' + (l === 'ar' ? 'تقرير فني' : 'Tech Report') + '</span>';
      }
      if (!ok) { _toast(l === 'ar' ? '⚠️ فشل تحميل مكتبة PDF' : '⚠️ PDF library failed'); return; }
      _doExportTechPDF();
    });
  }

  function _doExportTechPDF() {
    var l   = _lang();
    var btn = G('btn-techpdf');
    if (btn) { btn.disabled = true; btn.textContent = l === 'ar' ? 'جارٍ التحميل...' : 'Generating...'; }

    var c       = (typeof invCommon    === 'function') ? invCommon()     : {};
    var css     = (typeof invSharedCss === 'function') ? invSharedCss(c) : '';
    var page2Fn = (typeof buildPage2   === 'function') ? buildPage2      : function () { return ''; };

    var wrap = document.createElement('div');
    wrap.style.cssText = 'position:fixed;left:-9999px;top:0;width:794px;background:#fff;z-index:-1;';
    wrap.innerHTML = page2Fn(c);
    document.body.appendChild(wrap);

    var styleEl = document.createElement('style');
    styleEl.textContent = css;
    wrap.prepend(styleEl);

    var fontLink = document.createElement('link');
    fontLink.rel  = 'stylesheet';
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap';
    wrap.prepend(fontLink);

    var pageEl = wrap.querySelector('#pdf-page2');
    if (!pageEl) {
      if (document.body.contains(wrap)) document.body.removeChild(wrap);
      _toast(l === 'ar' ? '❌ صفحة التقرير غير موجودة' : '❌ Tech page not found');
      if (btn) { btn.disabled = false; btn.innerHTML = '🛠️ <span id="lbl-export4">' + (l === 'ar' ? 'تقرير فني' : 'Tech Report') + '</span>'; }
      return;
    }

    var cleanup = function () { if (document.body.contains(wrap)) document.body.removeChild(wrap); };

    var doCapture = function () {
      _capturePdfPages([pageEl], css,
        function (pdf) {
          cleanup();
          var qno = (G('quote-no') || { value: '' }).value.trim() || '';
          var fname = qno ? 'TechReport_' + qno : 'TechReport_AirCalc';
          pdf.save(fname + '.pdf');
          _toast(l === 'ar' ? '📄 تم استخراج التقرير الفني' : '📄 Technical report exported');
          if (btn) { btn.disabled = false; btn.innerHTML = '🛠️ <span id="lbl-export4">' + (l === 'ar' ? 'تقرير فني' : 'Tech Report') + '</span>'; }
        },
        function (err) {
          cleanup();
          console.error('TechPDF error:', err);
          _toast(l === 'ar' ? '❌ فشل استخراج التقرير' : '❌ Export failed');
          if (btn) { btn.disabled = false; btn.innerHTML = '🛠️ <span id="lbl-export4">' + (l === 'ar' ? 'تقرير فني' : 'Tech Report') + '</span>'; }
        }
      );
    };

    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        setTimeout(doCapture, l === 'ar' ? 800 : 400);
      });
    } else {
      setTimeout(doCapture, l === 'ar' ? 1000 : 600);
    }
  }

  // ── Expose namespace ──────────────────────────────────────────────────────
  window.AppPdf = {
    invCommon:        invCommon,
    exportCSV:        exportCSV,
    exportInvoiceHTML: exportInvoiceHTML,
    exportPDF:        exportPDF,
    exportTechPDF:    exportTechPDF,
    _doExportPDF:     _doExportPDF,
    _doExportTechPDF: _doExportTechPDF,
    ensurePdfLibs:    ensurePdfLibs
  };

  // ── Backward-compatibility window bindings ────────────────────────────────
  // NOTE: app.js (defer) will OVERWRITE these with its own versions which
  // directly reference live globals. Do not remove — they serve as early
  // fallback if app.js is thinned later.
  window.exportCSV          = exportCSV;
  window.exportInvoiceHTML  = exportInvoiceHTML;
  window.exportPDF          = exportPDF;
  window.exportTechPDF      = exportTechPDF;

  console.log('[AirCalc] AppPdf initialised');
})();
