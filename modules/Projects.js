// ── AirCalc Pro — modules/projects.js ────────────────────────────────────
// Full project management: save, load, rename, duplicate, delete
// Storage key: aircalc_projects
// Does NOT touch HVAC formulas, quotation flow, or existing localStorage keys.

(function () {
  'use strict';

  var STORAGE_KEY = 'aircalc_projects';

  // ── Helpers ───────────────────────────────────────────────────────────────
  function G(id) { return document.getElementById(id); }
  function _lang() { return typeof lang !== 'undefined' ? lang : 'ar'; }
  function _t(ar, en) { return _lang() === 'ar' ? ar : en; }
  function _toast(msg) {
    if (window.AppHelpers) { window.AppHelpers.toast(msg); return; }
    if (typeof toast === 'function') toast(msg);
  }
  function _money(v) {
    return Number(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function _now() { return new Date().toISOString(); }
  function _fmtDate(iso) {
    try {
      var d = new Date(iso);
      return d.toLocaleDateString(_lang() === 'ar' ? 'ar-SA' : 'en-GB') +
             ' ' + d.toLocaleTimeString(_lang() === 'ar' ? 'ar-SA' : 'en-GB',
               { hour: '2-digit', minute: '2-digit' });
    } catch(e) { return iso || ''; }
  }

  // ── Storage layer ─────────────────────────────────────────────────────────
  function _loadAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch(e) { return []; }
  }
  function _saveAll(arr) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(arr)); return true; }
    catch(e) { console.warn('[Projects] save failed:', e); return false; }
  }

  // ── Snapshot current app state ────────────────────────────────────────────
  function _snapshot() {
    var snap = {};

    // Core arrays
    snap.hist    = (typeof hist    !== 'undefined') ? JSON.parse(JSON.stringify(hist))    : [];
    snap.qlines  = (typeof qlines  !== 'undefined') ? JSON.parse(JSON.stringify(qlines))  : [];
    snap.devs    = (typeof devs    !== 'undefined') ? JSON.parse(JSON.stringify(devs))    : [];

    // Quote settings
    snap.vatOn      = (typeof vatOn      !== 'undefined') ? vatOn      : true;
    snap.instPct    = parseInt((G('qs-inst')      || {value:'10'}).value)  || 10;
    snap.qsValidity = parseInt((G('qs-validity')  || {value:'14'}).value)  || 14;
    snap.qsNotes    = (G('qs-notes') || {value:''}).value || '';
    snap.quoteNo    = (G('quote-no') || {value:'Q-001'}).value || 'Q-001';

    // Mode
    snap.quoteMode  = (typeof quoteMode  !== 'undefined') ? quoteMode  : 'room';
    snap.bundleOn   = (typeof bundleOn   !== 'undefined') ? bundleOn   : false;
    snap.bundleConfig = (typeof bundleConfig !== 'undefined')
      ? JSON.parse(JSON.stringify(bundleConfig)) : {};

    // Project mode state
    snap.projState = (typeof projState !== 'undefined')
      ? JSON.parse(JSON.stringify(projState)) : {};

    // Duct / ESP UI values
    snap.ductVelSup  = parseInt((G('duct-vel-sup')    || {value:'1000'}).value) || 1000;
    snap.ductVelRet  = parseInt((G('duct-vel-ret')    || {value:'800'}).value)  || 800;
    snap.ductCfmPerTr= parseInt((G('duct-cfm-per-tr') || {value:'400'}).value)  || 400;
    snap.espLenSup   = parseFloat((G('esp-len-sup')   || {value:'30'}).value)   || 30;
    snap.espLenRet   = parseFloat((G('esp-len-ret')   || {value:'20'}).value)   || 20;
    snap.espBends    = parseInt((G('esp-bends')        || {value:'4'}).value)   || 4;
    snap.espFric     = parseFloat((G('esp-fric')       || {value:'1.0'}).value) || 1.0;

    // Project mode UI
    snap.projSysType = (G('proj-systype') || {value:'split'}).value || 'split';
    snap.projCap     = parseInt((G('proj-cap') || {value:'0'}).value)  || 0;
    snap.projQty     = parseInt((G('proj-qty') || {value:'1'}).value)  || 1;
    snap.projUp      = parseFloat((G('proj-up')|| {value:'0'}).value)  || 0;

    // Current room
    snap.curRoomId = (typeof curRoom !== 'undefined' && curRoom) ? curRoom.id : null;

    // Computed totals for display
    var totTR = 0, totBTU = 0, totMKT = 0, totCFM = 0;
    snap.hist.forEach(function(h) {
      totTR  += parseFloat(h.tr)  || 0;
      totBTU += parseInt(h.btu)   || 0;
      totMKT += parseInt(h.mkt)   || 0;
      totCFM += parseInt(h.cfm)   || 0;
    });
    snap.totals = {
      tr: Math.round(totTR * 100) / 100,
      btu: totBTU, mkt: totMKT, cfm: totCFM,
      rooms: snap.hist.length
    };

    // Grand total from DOM
    var gtEl = G('qt-grand');
    snap.grandTotalStr = gtEl ? gtEl.textContent : '';

    // Language
    snap.lang = _lang();

    return snap;
  }

  // ── Restore snapshot into app ─────────────────────────────────────────────
  function _restore(snap) {
    if (!snap) return;

    // Restore arrays
    if (typeof hist    !== 'undefined') hist    = JSON.parse(JSON.stringify(snap.hist    || []));
    if (typeof qlines  !== 'undefined') qlines  = JSON.parse(JSON.stringify(snap.qlines  || []));
    if (typeof devs    !== 'undefined') devs    = JSON.parse(JSON.stringify(snap.devs    || []));

    // Quote settings
    if (typeof vatOn      !== 'undefined') vatOn      = snap.vatOn !== undefined ? snap.vatOn : true;
    if (typeof instPct    !== 'undefined') instPct    = snap.instPct    || 10;
    if (typeof qsValidity !== 'undefined') qsValidity = snap.qsValidity || 14;
    if (typeof qsNotes    !== 'undefined') qsNotes    = snap.qsNotes    || '';

    // Mode
    if (typeof quoteMode   !== 'undefined') quoteMode   = snap.quoteMode   || 'room';
    if (typeof bundleOn    !== 'undefined') bundleOn    = snap.bundleOn    || false;
    if (typeof bundleConfig !== 'undefined' && snap.bundleConfig) {
      Object.keys(snap.bundleConfig).forEach(function(k) {
        bundleConfig[k] = snap.bundleConfig[k];
      });
    }
    if (typeof projState !== 'undefined' && snap.projState) {
      Object.keys(snap.projState).forEach(function(k) {
        projState[k] = snap.projState[k];
      });
    }

    // Restore curRoom
    if (snap.curRoomId && typeof ROOMS !== 'undefined' && ROOMS[snap.curRoomId]) {
      if (typeof curRoom !== 'undefined') curRoom = ROOMS[snap.curRoomId];
    }

    // Restore DOM inputs
    var setV = function(id, v) { var el = G(id); if (el && v !== undefined) el.value = String(v); };
    setV('qs-inst',       snap.instPct);
    setV('qs-validity',   snap.qsValidity);
    setV('qs-notes',      snap.qsNotes);
    setV('quote-no',      snap.quoteNo || 'Q-001');
    setV('duct-vel-sup',  snap.ductVelSup);
    setV('duct-vel-ret',  snap.ductVelRet);
    setV('duct-cfm-per-tr', snap.ductCfmPerTr);
    setV('esp-len-sup',   snap.espLenSup);
    setV('esp-len-ret',   snap.espLenRet);
    setV('esp-bends',     snap.espBends);
    setV('esp-fric',      snap.espFric);
    setV('proj-qty',      snap.projQty);
    setV('proj-up',       snap.projUp);

    // VAT toggle
    var vtBtn = G('vat-tog');
    if (vtBtn) {
      if (snap.vatOn) vtBtn.classList.add('on'); else vtBtn.classList.remove('on');
    }

    // Persist to legacy localStorage
    try {
      localStorage.setItem('acp9h',  JSON.stringify(snap.hist   || []));
      localStorage.setItem('acp9q',  JSON.stringify(snap.qlines || []));
      localStorage.setItem('acp9qs', JSON.stringify({
        vatOn: snap.vatOn, instPct: snap.instPct,
        qsValidity: snap.qsValidity, qsNotes: snap.qsNotes
      }));
      localStorage.setItem('acp9mode', snap.quoteMode || 'room');
      if (snap.bundleConfig) localStorage.setItem('ac_bundleConfig', JSON.stringify(snap.bundleConfig));
    } catch(e) {}

    // Re-render UI
    if (typeof applyQSState      === 'function') applyQSState();
    if (typeof setQuoteMode      === 'function') setQuoteMode(snap.quoteMode || 'room');
    if (typeof _updateBundleUI   === 'function') _updateBundleUI();
    if (typeof renderDevs        === 'function') renderDevs();
    if (typeof renderHist        === 'function') renderHist();
    if (typeof refreshGrandTotal === 'function') refreshGrandTotal();
    if (typeof applyLang         === 'function') applyLang();

    // Restore room label
    if (typeof curRoom !== 'undefined' && curRoom) {
      var dtEl = G('dt');
      if (dtEl) dtEl.textContent = _lang() === 'ar' ? curRoom.ar : curRoom.en;
    }

    // Restore proj dropdowns
    if (snap.projSysType && typeof onProjSysTypeChange === 'function') {
      var stSel = G('proj-systype');
      if (stSel) {
        stSel.value = snap.projSysType;
        onProjSysTypeChange();
        // Re-set cap after rebuild
        setTimeout(function() {
          var capSel = G('proj-cap');
          if (capSel && snap.projCap) capSel.value = String(snap.projCap);
        }, 50);
      }
    }
  }

  // ── Public: get all projects ──────────────────────────────────────────────
  function getProjects() { return _loadAll(); }

  // ── Public: save current app state as project ─────────────────────────────
  function saveCurrentProject() {
    var projName = (G('quote-project') || {value:''}).value.trim();

    if (!projName) {
      // Prompt for name
      _showSaveAsModal(null, null);
      return;
    }

    var all = _loadAll();
    var existing = null;
    for (var i = 0; i < all.length; i++) {
      if (all[i].name.trim().toLowerCase() === projName.toLowerCase()) {
        existing = all[i]; break;
      }
    }

    if (existing) {
      // Update existing
      existing.snapshot  = _snapshot();
      existing.updatedAt = _now();
      _saveAll(all);
      _toast(_t('✅ تم تحديث المشروع: ', '✅ Project updated: ') + projName);
    } else {
      // Create new
      var proj = {
        id:        _uid(),
        name:      projName,
        createdAt: _now(),
        updatedAt: _now(),
        snapshot:  _snapshot()
      };
      all.unshift(proj);
      _saveAll(all);
      _toast(_t('✅ تم حفظ المشروع: ', '✅ Project saved: ') + projName);
    }

    renderProjects();
  }

  // ── Public: load a project by id ─────────────────────────────────────────
  function loadProject(id) {
    var all = _loadAll();
    var proj = null;
    for (var i = 0; i < all.length; i++) { if (all[i].id === id) { proj = all[i]; break; } }
    if (!proj) { _toast(_t('⚠️ المشروع غير موجود', '⚠️ Project not found')); return; }

    // Restore project name into quote-project field
    var qpEl = G('quote-project');
    if (qpEl) qpEl.value = proj.name;

    // Restore full snapshot
    _restore(proj.snapshot);

    // Navigate to calculator
    if (typeof goPanel === 'function') goPanel('calc');

    // Touch updatedAt
    proj.updatedAt = _now();
    _saveAll(all);

    _toast(_t('📂 تم فتح المشروع: ', '📂 Opened: ') + proj.name);
  }

  // ── Public: delete project ────────────────────────────────────────────────
  function deleteProject(id) {
    var all = _loadAll();
    var name = '';
    all = all.filter(function(p) { if (p.id === id) { name = p.name; return false; } return true; });
    _saveAll(all);
    renderProjects();
    _toast(_t('🗑️ تم حذف: ', '🗑️ Deleted: ') + name);
  }

  // ── Public: duplicate project ─────────────────────────────────────────────
  function duplicateProject(id) {
    var all = _loadAll();
    var src = null;
    for (var i = 0; i < all.length; i++) { if (all[i].id === id) { src = all[i]; break; } }
    if (!src) return;
    var copy = JSON.parse(JSON.stringify(src));
    copy.id = _uid();
    copy.name = src.name + (_lang() === 'ar' ? ' — نسخة' : ' — Copy');
    copy.createdAt = _now();
    copy.updatedAt = _now();
    all.unshift(copy);
    _saveAll(all);
    renderProjects();
    _toast(_t('📋 تم النسخ: ', '📋 Duplicated: ') + copy.name);
  }

  // ── Rename modal ──────────────────────────────────────────────────────────
  function _showRenameModal(id, currentName) {
    var old = document.getElementById('pm-rename-overlay');
    if (old) old.remove();

    var isAr = _lang() === 'ar';
    var ov = document.createElement('div');
    ov.className = 'pm-rename-overlay';
    ov.id = 'pm-rename-overlay';
    ov.innerHTML =
      '<div class="pm-rename-box">' +
        '<div class="pm-rename-ttl">' + (isAr ? '✏️ إعادة تسمية المشروع' : '✏️ Rename Project') + '</div>' +
        '<input class="pm-rename-inp" id="pm-rename-val" type="text" value="' +
          currentName.replace(/"/g, '&quot;') + '" placeholder="' +
          (isAr ? 'اسم المشروع' : 'Project name') + '">' +
        '<div class="pm-rename-btns">' +
          '<button class="pm-rename-cancel" onclick="document.getElementById(\'pm-rename-overlay\').remove()">' +
            (isAr ? 'إلغاء' : 'Cancel') + '</button>' +
          '<button class="pm-rename-ok" onclick="window._pmDoRename(\'' + id + '\')">' +
            (isAr ? 'حفظ' : 'Save') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    setTimeout(function() {
      var inp = document.getElementById('pm-rename-val');
      if (inp) { inp.focus(); inp.select(); }
    }, 80);
  }

  window._pmDoRename = function(id) {
    var inp = document.getElementById('pm-rename-val');
    if (!inp) return;
    var newName = inp.value.trim();
    if (!newName) { _toast(_t('⚠️ أدخل اسم المشروع', '⚠️ Enter project name')); return; }
    var all = _loadAll();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) {
        all[i].name = newName;
        all[i].updatedAt = _now();
        if (all[i].snapshot) all[i].snapshot.projName = newName;
        break;
      }
    }
    _saveAll(all);
    var ov = document.getElementById('pm-rename-overlay');
    if (ov) ov.remove();
    renderProjects();
    _toast(_t('✅ تم تغيير الاسم', '✅ Renamed successfully'));
  };

  // ── Save-As modal ─────────────────────────────────────────────────────────
  function _showSaveAsModal(existingId, suggestedName) {
    var old = document.getElementById('pm-saveas-overlay');
    if (old) old.remove();

    var isAr = _lang() === 'ar';
    var defName = suggestedName || (G('quote-project') || {value:''}).value.trim() ||
                  (isAr ? 'مشروع جديد' : 'New Project');

    var ov = document.createElement('div');
    ov.className = 'pm-saveas-overlay';
    ov.id = 'pm-saveas-overlay';
    ov.innerHTML =
      '<div class="pm-saveas-box">' +
        '<div class="pm-rename-ttl">' +
          (existingId
            ? (isAr ? '💾 حفظ كمشروع جديد' : '💾 Save as New Project')
            : (isAr ? '💾 حفظ المشروع' : '💾 Save Project')) +
        '</div>' +
        '<div style="font-size:11px;color:var(--tm);margin-bottom:10px;font-family:var(--fe)">' +
          (isAr ? 'أدخل اسم المشروع:' : 'Enter project name:') +
        '</div>' +
        '<input class="pm-rename-inp" id="pm-saveas-val" type="text" value="' +
          defName.replace(/"/g, '&quot;') + '" placeholder="' +
          (isAr ? 'اسم المشروع' : 'Project name') + '">' +
        '<div class="pm-rename-btns">' +
          '<button class="pm-rename-cancel" onclick="document.getElementById(\'pm-saveas-overlay\').remove()">' +
            (isAr ? 'إلغاء' : 'Cancel') + '</button>' +
          '<button class="pm-rename-ok" onclick="window._pmDoSaveAs()">' +
            (isAr ? 'حفظ' : 'Save') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(ov);
    setTimeout(function() {
      var inp = document.getElementById('pm-saveas-val');
      if (inp) { inp.focus(); inp.select(); }
    }, 80);
  }

  window._pmDoSaveAs = function() {
    var inp = document.getElementById('pm-saveas-val');
    if (!inp) return;
    var name = inp.value.trim();
    if (!name) { _toast(_t('⚠️ أدخل اسم المشروع', '⚠️ Enter project name')); return; }

    // Set quote-project field to this name
    var qpEl = G('quote-project');
    if (qpEl) qpEl.value = name;

    // Force-create new (ignore existing match)
    var all = _loadAll();
    var proj = {
      id: _uid(), name: name,
      createdAt: _now(), updatedAt: _now(),
      snapshot: _snapshot()
    };
    all.unshift(proj);
    _saveAll(all);

    var ov = document.getElementById('pm-saveas-overlay');
    if (ov) ov.remove();

    renderProjects();
    _toast(_t('✅ تم الحفظ: ', '✅ Saved: ') + name);
  };

  // ── Render projects list ──────────────────────────────────────────────────
  function renderProjects() {
    var list = G('pm-list');
    if (!list) return;

    var isAr    = _lang() === 'ar';
    var all     = _loadAll();
    var query   = ((G('pm-search') || {value:''}).value || '').trim().toLowerCase();

    // Update search placeholder
    var si = G('pm-search');
    if (si) si.placeholder = isAr ? 'بحث في المشاريع...' : 'Search projects...';

    var filtered = query
      ? all.filter(function(p) { return p.name.toLowerCase().indexOf(query) !== -1; })
      : all;

    // Empty state
    if (!filtered.length) {
      list.innerHTML =
        '<div class="pm-empty">' +
          '<div class="pm-empty-ico">📁</div>' +
          (all.length === 0
            ? '<div class="pm-empty-ttl">' + (isAr ? 'لا توجد مشاريع بعد' : 'No projects yet') + '</div>' +
              '<div class="pm-empty-sub">' +
                (isAr
                  ? 'احسب غرفة، أضفها للعرض،\nثم اضغط "حفظ المشروع الحالي"'
                  : 'Calculate a room, add it to the quote,\nthen tap "Save Current Project"') +
              '</div>'
            : '<div class="pm-empty-ttl">' + (isAr ? 'لا نتائج' : 'No results') + '</div>' +
              '<div class="pm-empty-sub">' + (isAr ? 'جرّب كلمة بحث مختلفة' : 'Try a different search term') + '</div>'
          ) +
        '</div>';
      return;
    }

    var html = '';
    filtered.forEach(function(proj) {
      var snap = proj.snapshot || {};
      var totals = snap.totals || {};
      var rooms = totals.rooms || 0;
      var totTR = totals.tr || 0;
      var totBTU = totals.btu || 0;
      var grandStr = snap.grandTotalStr || '';

      // Capacity badge
      var capBadge = totTR > 0
        ? '<span class="pm-card-badge">' + totTR.toFixed(1) + ' TR</span>'
        : '';

      // Meta pills
      var pills = '';
      if (rooms > 0) {
        pills += '<span class="pm-meta-pill">' +
          '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg>' +
          rooms + ' ' + (isAr ? 'غرفة' : 'rooms') + '</span>';
      }
      if (totBTU > 0) {
        pills += '<span class="pm-meta-pill green">' + Number(totBTU).toLocaleString() + ' BTU/h</span>';
      }
      if (totals.cfm > 0) {
        pills += '<span class="pm-meta-pill">' + Number(totals.cfm).toLocaleString() + ' CFM</span>';
      }
      if (grandStr) {
        pills += '<span class="pm-meta-pill amber">💰 ' + grandStr + '</span>';
      }
      if (snap.quoteMode === 'proj') {
        pills += '<span class="pm-meta-pill">' + (isAr ? 'وحدة مشروع' : 'Project unit') + '</span>';
      }
      if (snap.bundleOn) {
        pills += '<span class="pm-meta-pill">🔒 Bundle</span>';
      }

      var dates =
        '<span>' + (isAr ? 'أُنشئ: ' : 'Created: ') + _fmtDate(proj.createdAt) + '</span>' +
        '<span>' + (isAr ? 'آخر تعديل: ' : 'Updated: ') + _fmtDate(proj.updatedAt) + '</span>';

      var pid = proj.id;
      var pname = proj.name.replace(/'/g, "\\'").replace(/"/g, '&quot;');

      html +=
        '<div class="pm-card" id="pmc-' + pid + '">' +
          '<div class="pm-card-top">' +
            '<div class="pm-card-name">' + _escHtml(proj.name) + '</div>' +
            capBadge +
          '</div>' +
          (pills ? '<div class="pm-card-meta">' + pills + '</div>' : '') +
          '<div class="pm-card-dates">' + dates + '</div>' +
          '<div class="pm-card-actions">' +
            '<button class="pm-act-btn open" onclick="loadProject(\'' + pid + '\')">' +
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 3l14 9-14 9V3z"/></svg>' +
              (isAr ? 'فتح' : 'Open') +
            '</button>' +
            '<button class="pm-act-btn" onclick="_pmRename(\'' + pid + '\',\'' + pname + '\')">' +
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>' +
              (isAr ? 'إعادة تسمية' : 'Rename') +
            '</button>' +
            '<button class="pm-act-btn" onclick="duplicateProject(\'' + pid + '\')">' +
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>' +
              (isAr ? 'نسخ' : 'Duplicate') +
            '</button>' +
            '<button class="pm-act-btn del" onclick="_pmDelete(\'' + pid + '\',\'' + pname + '\')">' +
              '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>' +
              (isAr ? 'حذف' : 'Delete') +
            '</button>' +
          '</div>' +
        '</div>';
    });

    list.innerHTML = html;
  }

  // ── HTML escape helper ────────────────────────────────────────────────────
  function _escHtml(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── Window-level click handlers for inline onclick ────────────────────────
  window._pmRename = function(id, name) { _showRenameModal(id, name.replace(/&quot;/g, '"')); };
  window._pmDelete = function(id, name) {
    var isAr = _lang() === 'ar';
    var label = name.replace(/&quot;/g, '"');
    var msg = isAr
      ? 'هل تريد حذف المشروع "' + label + '"؟'
      : 'Delete project "' + label + '"?';
    if (window.confirm(msg)) deleteProject(id);
  };
  window._pmSaveAs = function() { _showSaveAsModal(null, null); };

  // ── Update header labels on language change ───────────────────────────────
  function updateProjMgrLabels() {
    var isAr = _lang() === 'ar';
    var ttl = G('pm-ttl');
    if (ttl) ttl.textContent = isAr ? '📁 المشاريع' : '📁 Projects';
    var saveLbl = G('pm-save-lbl');
    if (saveLbl) saveLbl.textContent = isAr ? 'حفظ المشروع الحالي' : 'Save Current Project';
    var nlProj = G('nl-projects');
    if (nlProj) nlProj.textContent = isAr ? 'المشاريع' : 'Projects';
  }

  // ── Expose namespace ──────────────────────────────────────────────────────
  window.AppProjects = {
    getProjects:          getProjects,
    saveCurrentProject:   saveCurrentProject,
    loadProject:          loadProject,
    deleteProject:        deleteProject,
    duplicateProject:     duplicateProject,
    renderProjects:       renderProjects,
    updateProjMgrLabels:  updateProjMgrLabels,
    saveAsModal:          _showSaveAsModal
  };

  // ── Backward-compat window bindings ──────────────────────────────────────
  window.saveCurrentProject  = saveCurrentProject;
  window.loadProject         = loadProject;
  window.deleteProject       = deleteProject;
  window.duplicateProject    = duplicateProject;
  window.renderProjects      = renderProjects;

  console.log('[AirCalc] AppProjects initialised');
})();