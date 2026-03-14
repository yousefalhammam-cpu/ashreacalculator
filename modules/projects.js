// ── AirCalc Pro — modules/projects.js  v3 ─────────────────────────────────
// Project management: save, update, load, delete.
// Storage keys:
//   aircalc_projects          — array of project objects
//   aircalc_current_project_id — id of the currently open project (cleared on load/new)
// ─────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var STORAGE_KEY  = 'aircalc_projects';
  var CURRENT_KEY  = 'aircalc_current_project_id';

  // ── Tiny helpers ──────────────────────────────────────────────────────
  function G(id)      { return document.getElementById(id); }
  function _lang()    { return (typeof lang !== 'undefined') ? lang : 'ar'; }
  function _isAr()    { return _lang() === 'ar'; }
  function _t(ar, en) { return _isAr() ? ar : en; }

  function _toast(msg) {
    if (typeof toast === 'function') { toast(msg); return; }
    if (window.AppHelpers) window.AppHelpers.toast(msg);
  }

  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function _now()    { return new Date().toISOString(); }

  function _fmtDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso), loc = _isAr() ? 'ar-SA' : 'en-GB';
      return d.toLocaleDateString(loc) + ' ' +
             d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
    } catch(e) { return iso; }
  }

  function _escHtml(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/\"/g,'&quot;');
  }

  // ── localStorage helpers ──────────────────────────────────────────────
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
    catch(e) { console.warn('[Projects] write failed', e); return false; }
  }

  function _getCurrentId() {
    return localStorage.getItem(CURRENT_KEY) || null;
  }

  function _setCurrentId(id) {
    if (id) localStorage.setItem(CURRENT_KEY, id);
    else    localStorage.removeItem(CURRENT_KEY);
  }

  // ── Snapshot — reads all live globals at call-time ────────────────────
  function _snapshot() {
    var snap = {};

    // Core arrays
    snap.hist   = (typeof hist   !== 'undefined') ? JSON.parse(JSON.stringify(hist))   : [];
    snap.qlines = (typeof qlines !== 'undefined') ? JSON.parse(JSON.stringify(qlines)) : [];
    snap.devs   = (typeof devs   !== 'undefined') ? JSON.parse(JSON.stringify(devs))   : [];

    // Quote identity
    snap.projName = (G('quote-project') || {value:''}).value.trim();
    snap.quoteNo  = (G('quote-no')      || {value:'Q-001'}).value.trim() || 'Q-001';

    // Quote settings
    snap.vatOn      = (typeof vatOn      !== 'undefined') ? vatOn      : true;
    snap.instPct    = parseInt((G('qs-inst')     || {value:'10'}).value) || 10;
    snap.qsValidity = parseInt((G('qs-validity') || {value:'14'}).value) || 14;
    snap.qsNotes    = (G('qs-notes') || {value:''}).value || '';

    // Modes
    snap.quoteMode    = (typeof quoteMode    !== 'undefined') ? quoteMode    : 'room';
    snap.bundleOn     = (typeof bundleOn     !== 'undefined') ? bundleOn     : false;
    snap.bundleConfig = (typeof bundleConfig !== 'undefined') ? JSON.parse(JSON.stringify(bundleConfig)) : {};
    snap.projState    = (typeof projState    !== 'undefined') ? JSON.parse(JSON.stringify(projState))    : {};

    // Duct / ESP
    snap.ductVelSup   = parseInt((G('duct-vel-sup')    || {value:'1000'}).value) || 1000;
    snap.ductVelRet   = parseInt((G('duct-vel-ret')    || {value:'800'}).value)  || 800;
    snap.ductCfmPerTr = parseInt((G('duct-cfm-per-tr') || {value:'400'}).value)  || 400;
    snap.espLenSup    = parseFloat((G('esp-len-sup')   || {value:'30'}).value)   || 30;
    snap.espLenRet    = parseFloat((G('esp-len-ret')   || {value:'20'}).value)   || 20;
    snap.espBends     = parseInt((G('esp-bends')       || {value:'4'}).value)    || 4;
    snap.espFric      = parseFloat((G('esp-fric')      || {value:'1.0'}).value)  || 1.0;

    // Project-mode unit block
    snap.projSysType = (G('proj-systype') || {value:'split'}).value || 'split';
    snap.projCap     = parseInt((G('proj-cap') || {value:'0'}).value) || 0;
    snap.projQty     = parseInt((G('proj-qty') || {value:'1'}).value) || 1;
    snap.projUp      = parseFloat((G('proj-up')|| {value:'0'}).value) || 0;

    // Current room id
    snap.curRoomId = (typeof curRoom !== 'undefined' && curRoom) ? curRoom.id : null;

    // Language
    snap.lang = _lang();

    // Computed totals (for card display)
    var totTR=0, totBTU=0, totMKT=0, totCFM=0;
    snap.hist.forEach(function(h){
      totTR  += parseFloat(h.tr)  || 0;
      totBTU += parseInt(h.btu)   || 0;
      totMKT += parseInt(h.mkt)   || 0;
      totCFM += parseInt(h.cfm)   || 0;
    });
    snap.totals = {
      rooms: snap.hist.length,
      tr:    Math.round(totTR * 100) / 100,
      btu:   totBTU, mkt: totMKT, cfm: totCFM
    };

    // Grand total string
    var gtEl = G('qt-grand');
    snap.grandTotalStr = gtEl ? gtEl.textContent.trim() : '';

    return snap;
  }

  // ── Restore snapshot into live app ────────────────────────────────────
  function _restore(snap) {
    if (!snap) return;

    // JS globals
    if (typeof hist   !== 'undefined') hist   = JSON.parse(JSON.stringify(snap.hist   || []));
    if (typeof qlines !== 'undefined') qlines = JSON.parse(JSON.stringify(snap.qlines || []));
    if (typeof devs   !== 'undefined') devs   = JSON.parse(JSON.stringify(snap.devs   || []));

    if (typeof vatOn      !== 'undefined') vatOn      = (snap.vatOn !== undefined) ? snap.vatOn : true;
    if (typeof instPct    !== 'undefined') instPct    = snap.instPct    || 10;
    if (typeof qsValidity !== 'undefined') qsValidity = snap.qsValidity || 14;
    if (typeof qsNotes    !== 'undefined') qsNotes    = snap.qsNotes    || '';
    if (typeof quoteMode  !== 'undefined') quoteMode  = snap.quoteMode  || 'room';
    if (typeof bundleOn   !== 'undefined') bundleOn   = snap.bundleOn   || false;

    if (typeof bundleConfig !== 'undefined' && snap.bundleConfig && typeof snap.bundleConfig === 'object') {
      Object.keys(snap.bundleConfig).forEach(function(k){ bundleConfig[k] = snap.bundleConfig[k]; });
    }
    if (typeof projState !== 'undefined' && snap.projState && typeof snap.projState === 'object') {
      Object.keys(snap.projState).forEach(function(k){ projState[k] = snap.projState[k]; });
    }

    // curRoom
    if (snap.curRoomId && typeof ROOMS !== 'undefined' && ROOMS[snap.curRoomId]) {
      if (typeof curRoom !== 'undefined') curRoom = ROOMS[snap.curRoomId];
    }

    // DOM inputs
    function sv(id, v) { var el=G(id); if(el && v !== undefined && v !== null) el.value = String(v); }
    sv('quote-project',   snap.projName   || '');
    sv('quote-no',        snap.quoteNo    || 'Q-001');
    sv('qs-inst',         snap.instPct    || 10);
    sv('qs-validity',     snap.qsValidity || 14);
    sv('qs-notes',        snap.qsNotes    || '');
    sv('duct-vel-sup',    snap.ductVelSup   || 1000);
    sv('duct-vel-ret',    snap.ductVelRet   || 800);
    sv('duct-cfm-per-tr', snap.ductCfmPerTr || 400);
    sv('esp-len-sup',     snap.espLenSup    || 30);
    sv('esp-len-ret',     snap.espLenRet    || 20);
    sv('esp-bends',       snap.espBends     || 4);
    sv('esp-fric',        snap.espFric      || 1.0);
    sv('proj-qty',        snap.projQty      || 1);
    sv('proj-up',         snap.projUp       || 0);

    // Sync legacy localStorage so app.js save() works correctly later
    try {
      localStorage.setItem('acp9h',    JSON.stringify(snap.hist   || []));
      localStorage.setItem('acp9q',    JSON.stringify(snap.qlines || []));
      localStorage.setItem('acp9qs',   JSON.stringify({ vatOn:snap.vatOn, instPct:snap.instPct, qsValidity:snap.qsValidity, qsNotes:snap.qsNotes }));
      localStorage.setItem('acp9mode', snap.quoteMode || 'room');
      if (snap.bundleConfig) localStorage.setItem('ac_bundleConfig', JSON.stringify(snap.bundleConfig));
    } catch(e) {}

    // Re-render UI in correct dependency order
    if (typeof applyQSState      === 'function') applyQSState();
    if (typeof renderDevs        === 'function') renderDevs();
    if (typeof renderHist        === 'function') renderHist();
    if (typeof setQuoteMode      === 'function') setQuoteMode(snap.quoteMode || 'room');
    if (typeof _updateBundleUI   === 'function') _updateBundleUI();
    if (typeof refreshGrandTotal === 'function') refreshGrandTotal();

    // Room label
    if (typeof curRoom !== 'undefined' && curRoom) {
      var dtEl = G('dt');
      if (dtEl) dtEl.textContent = _isAr() ? curRoom.ar : curRoom.en;
    }

    // Project-mode dropdowns (small defer for DOM to settle after setQuoteMode)
    if (snap.projSysType) {
      setTimeout(function(){
        var stSel = G('proj-systype');
        if (stSel) {
          stSel.value = snap.projSysType;
          if (typeof onProjSysTypeChange === 'function') onProjSysTypeChange();
        }
        setTimeout(function(){
          var capSel = G('proj-cap');
          if (capSel && snap.projCap) capSel.value = String(snap.projCap);
          if (typeof renderProjBlock === 'function' && (typeof quoteMode !== 'undefined') && quoteMode === 'proj') {
            renderProjBlock();
          }
        }, 60);
      }, 30);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ════════════════════════════════════════════════════════════════════

  // ── saveCurrentProject(opts) ─────────────────────────────────────────
  // opts.silentNavigate = true → do NOT navigate away (used by H2 auto-save)
  // Save logic priority:
  //   1. Match by currentProjectId (update in-place — most reliable)
  //   2. Match by normalised name   (update if found)
  //   3. Create new project
  function saveCurrentProject(opts) {
    opts = opts || {};

    var projName = (G('quote-project') || {value:''}).value.trim();

    // Require a name — show error and stop
    if (!projName) {
      _toast(_t('⚠️ أدخل اسم المشروع أولاً', '⚠️ Enter a project name first'));
      var el = G('quote-project');
      if (el) {
        el.focus();
        var origBorder = el.style.borderColor;
        el.style.borderColor = 'var(--r)';
        setTimeout(function(){ el.style.borderColor = origBorder; }, 1500);
      }
      return;
    }

    var all      = _loadAll();
    var snap     = _snapshot();
    var now      = _now();
    var curId    = _getCurrentId();
    var foundIdx = -1;

    // Priority 1: match by stored current-project id
    if (curId) {
      for (var i = 0; i < all.length; i++) {
        if (all[i].id === curId) { foundIdx = i; break; }
      }
    }

    // Priority 2: match by normalised name
    if (foundIdx < 0) {
      var normName = projName.toLowerCase();
      for (var j = 0; j < all.length; j++) {
        if (all[j].name.trim().toLowerCase() === normName) { foundIdx = j; break; }
      }
    }

    if (foundIdx >= 0) {
      // UPDATE existing
      all[foundIdx].name      = projName;   // allow rename via field
      all[foundIdx].snapshot  = snap;
      all[foundIdx].updatedAt = now;
      _saveAll(all);
      _setCurrentId(all[foundIdx].id);
      if (!opts.silentNavigate) {
        _toast(_t('✅ تم تحديث المشروع: ', '✅ Updated: ') + projName);
      }
    } else {
      // CREATE new — check free plan project limit first
      var limit = (window.AppPlan && typeof window.AppPlan.getProjectLimit === 'function')
        ? window.AppPlan.getProjectLimit()
        : Infinity;
      if (all.length >= limit) {
        // Free limit hit
        _toast(_isAr()
          ? '📁 وصلت للحد الأقصى (3 مشاريع) — رُقِّ إلى Pro لمشاريع غير محدودة'
          : '📁 Free limit reached (3 projects) — upgrade to Pro for unlimited');
        // Flash upgrade button
        setTimeout(function(){
          var btn2 = document.getElementById('set-upgrade-btn');
          if (btn2) { btn2.classList.add('upgrade-pulse'); setTimeout(function(){ btn2.classList.remove('upgrade-pulse'); }, 1200); }
        }, 300);
        return;
      }
      var newProj = {
        id:        _uid(),
        name:      projName,
        createdAt: now,
        updatedAt: now,
        snapshot:  snap
      };
      all.unshift(newProj);
      _saveAll(all);
      _setCurrentId(newProj.id);
      _toast(_t('💾 تم حفظ المشروع: ', '💾 Saved: ') + projName);
    }

    // Flash the save button (green checkmark feedback)
    var btn = G('quote-save-btn') || G('qp-save-btn');
    if (btn) {
      var origBg    = btn.style.background;
      var origColor = btn.style.color;
      var origBorder = btn.style.border;
      btn.style.background = 'linear-gradient(135deg,rgba(52,211,153,.6),rgba(52,211,153,.4))';
      btn.style.color      = '#fff';
      btn.style.border     = '1px solid rgba(52,211,153,.8)';
      setTimeout(function(){
        btn.style.background = origBg;
        btn.style.color      = origColor;
        btn.style.border     = origBorder;
      }, 1200);
    }

    // Always refresh projects list
    renderProjects();
    updateNavDots();

    // Navigate to Projects page (unless called silently from H2 auto-save)
    if (!opts.silentNavigate && typeof goPanel === 'function') {
      goPanel('projects');
    }
  }

  // ── loadProject / openProject ─────────────────────────────────────────
  function loadProject(id) {
    var all = _loadAll(), proj = null;
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) { proj = all[i]; break; }
    }
    if (!proj) {
      _toast(_t('⚠️ المشروع غير موجود', '⚠️ Project not found'));
      return;
    }

    // Restore full snapshot into app
    _restore(proj.snapshot);

    // Mark as current project so H2 auto-save can update it
    _setCurrentId(proj.id);

    // Touch updatedAt
    proj.updatedAt = _now();
    _saveAll(all);

    // Navigate to Quotation page to show the loaded data
    if (typeof goPanel === 'function') goPanel('hist');

    _toast(_t('📂 تم فتح: ', '📂 Opened: ') + proj.name);
  }

  // ── deleteProject ─────────────────────────────────────────────────────
  function deleteProject(id) {
    var all = _loadAll(), name = '';
    var next = all.filter(function(p){
      if (p.id === id) { name = p.name; return false; }
      return true;
    });
    _saveAll(next);

    // If we deleted the current project, clear the current id
    if (_getCurrentId() === id) _setCurrentId(null);

    renderProjects();
    updateNavDots();
    _toast(_t('🗑️ تم حذف: ', '🗑️ Deleted: ') + name);
  }

  // ── renderProjects ────────────────────────────────────────────────────
  function renderProjects() {
    var list = G('pm-list');
    if (!list) return;

    var isAr  = _isAr();
    var all   = _loadAll();
    var query = ((G('pm-search') || {value:''}).value || '').trim().toLowerCase();
    var curId = _getCurrentId();

    // Update search placeholder language
    var si = G('pm-search');
    if (si) si.placeholder = isAr ? 'بحث في المشاريع...' : 'Search projects...';

    var shown = query
      ? all.filter(function(p){ return p.name.toLowerCase().indexOf(query) !== -1; })
      : all;

    // Empty state
    if (!shown.length) {
      list.innerHTML =
        '<div class="pm-empty">' +
          '<div class="pm-empty-ico">📁</div>' +
          (all.length === 0
            ? '<div class="pm-empty-ttl">' + (isAr ? 'لا توجد مشاريع بعد' : 'No saved projects yet') + '</div>' +
              '<div class="pm-empty-sub">' +
                (isAr
                  ? 'اكتب اسم المشروع في خانة «اسم المشروع» في صفحة عرض السعر، ثم اضغط 💾'
                  : 'Enter a name in the "Project Name" field on the Quotation page, then press 💾') +
              '</div>'
            : '<div class="pm-empty-ttl">' + (isAr ? 'لا نتائج' : 'No results') + '</div>' +
              '<div class="pm-empty-sub">' + (isAr ? 'جرّب كلمة مختلفة' : 'Try a different keyword') + '</div>'
          ) +
        '</div>';
      updateNavDots();
      return;
    }

    var html = '';
    shown.forEach(function(proj){
      var snap   = proj.snapshot || {};
      var tot    = snap.totals   || {};
      var isCur  = (proj.id === curId);

      // Pills
      var pills = '';
      if (tot.rooms > 0)
        pills += '<span class="pm-meta-pill"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/></svg> ' + tot.rooms + ' ' + (isAr ? 'غرفة' : 'rooms') + '</span>';
      if (tot.tr > 0)
        pills += '<span class="pm-meta-pill green">' + tot.tr.toFixed(1) + ' TR</span>';
      if (tot.btu > 0)
        pills += '<span class="pm-meta-pill">' + Number(tot.btu).toLocaleString() + ' BTU/h</span>';
      if (snap.grandTotalStr)
        pills += '<span class="pm-meta-pill amber">💰 ' + _escHtml(snap.grandTotalStr) + '</span>';
      if (snap.quoteMode === 'proj')
        pills += '<span class="pm-meta-pill">🏢 ' + (isAr ? 'وحدة مشروع' : 'Proj unit') + '</span>';
      if (snap.bundleOn)
        pills += '<span class="pm-meta-pill">🔒 Bundle</span>';
      if (snap.quoteNo)
        pills += '<span class="pm-meta-pill"># ' + _escHtml(snap.quoteNo) + '</span>';

      var pid   = proj.id;
      var pname = proj.name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

      // Active border if this is the currently open project
      var cardStyle = isCur
        ? ' style="border-color:rgba(52,211،153,.5);box-shadow:0 0 0 1px rgba(52,211,153,.2);"'
        : '';

      html +=
        '<div class="pm-card" id="pmc-' + pid + '"' + cardStyle + '>' +
          '<div class="pm-card-top">' +
            '<div class="pm-card-name">' +
              (isCur ? '<span style="color:var(--g);font-size:10px;margin-inline-end:6px;">●</span>' : '') +
              _escHtml(proj.name) +
            '</div>' +
            (tot.tr > 0 ? '<span class="pm-card-badge">' + tot.tr.toFixed(1) + ' TR</span>' : '') +
          '</div>' +
          (pills ? '<div class="pm-card-meta">' + pills + '</div>' : '') +
          '<div class="pm-card-dates">' +
            '<span>' + (isAr ? 'أُنشئ: ' : 'Created: ') + _fmtDate(proj.createdAt) + '</span>' +
            '<span>' + (isAr ? 'آخر تعديل: ' : 'Updated: ') + _fmtDate(proj.updatedAt) + '</span>' +
          '</div>' +
          '<div class="pm-card-actions">' +
            '<button class="pm-act-btn open" onclick="loadProject(\'' + pid + '\')">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 3l14 9-14 9V3z"/></svg> ' +
              (isAr ? 'فتح / تعديل' : 'Open / Edit') +
            '</button>' +
            '<button class="pm-act-btn del" onclick="_pmConfirmDelete(\'' + pid + '\',\'' + pname + '\')">' +
              '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg> ' +
              (isAr ? 'حذف' : 'Delete') +
            '</button>' +
          '</div>' +
        '</div>';
    });
    list.innerHTML = html;
    updateNavDots();
  }

  // ── updateProjMgrLabels ───────────────────────────────────────────────
  function updateProjMgrLabels() {
    var isAr = _isAr();
    function sl(id, ar, en){ var el=G(id); if(el) el.textContent = isAr ? ar : en; }
    sl('pm-ttl',        '📁 المشاريع',         '📁 Projects');
    sl('pm-save-lbl',   'حفظ المشروع الحالي',  'Save Current Project');
    sl('nl-projects',   'المشاريع',            'Projects');
    sl('quote-save-lbl','حفظ',                 'Save');
    var si = G('pm-search'); if(si) si.placeholder = isAr ? 'بحث في المشاريع...' : 'Search projects...';
    var btn = G('quote-save-btn') || G('qp-save-btn');
    if (btn) btn.title = isAr ? 'حفظ المشروع' : 'Save Project';
  }

  // ── Nav red dots ──────────────────────────────────────────────────────
  function _isPanelActive(panelId) {
    var el = document.getElementById(panelId);
    return el && el.classList.contains('on');
  }

  function updateProjectsDot() {
    var dot = G('projects-dot');
    if (!dot) return;
    var hasSaved = _loadAll().length > 0;
    var panelOpen = _isPanelActive('p-projects');
    dot.style.display = (hasSaved && !panelOpen) ? '' : 'none';
  }

  function updateHistDot() {
    var dot = G('hist-dot');
    if (!dot) return;
    var histLen = (typeof hist !== 'undefined') ? hist.length : 0;
    var panelOpen = _isPanelActive('p-hist');
    dot.style.display = (histLen > 0 && !panelOpen) ? '' : 'none';
  }

  function updateNavDots() {
    updateProjectsDot();
    updateHistDot();
  }

  // ── Delete confirm ────────────────────────────────────────────────────
  window._pmConfirmDelete = function(id, name) {
    var n   = name.replace(/\\'/g, "'");
    var msg = _isAr()
      ? 'هل تريد حذف المشروع "' + n + '"؟'
      : 'Delete project "' + n + '"?';
    if (window.confirm(msg)) deleteProject(id);
  };

  // ── Window bindings — set now AND after DOMContentLoaded ─────────────
  function _bindWindow() {
    window.saveCurrentProject = saveCurrentProject;
    window.loadProject        = loadProject;
    window.openProject        = loadProject;    // alias
    window.deleteProject      = deleteProject;
    window.renderProjects     = renderProjects;
    window.AppProjects = {
      saveCurrentProject:  saveCurrentProject,
      loadProject:         loadProject,
      openProject:         loadProject,
      deleteProject:       deleteProject,
      renderProjects:      renderProjects,
      updateProjMgrLabels: updateProjMgrLabels,
      updateProjectsDot:   updateProjectsDot,
      updateHistDot:       updateHistDot,
      updateNavDots:       updateNavDots,
      getProjects:         _loadAll,
      snapshot:            _snapshot
    };
  }

  // Bind immediately (sync — before app.js defer)
  _bindWindow();

  // Re-bind after all deferred scripts have run
  document.addEventListener('DOMContentLoaded', function(){
    setTimeout(_bindWindow, 0);   // tick 0: after defer scripts

    // Initial dot state on page load
    setTimeout(updateNavDots, 200);

    // Patch goPanel once (needs goPanel to exist from app.js defer)
    setTimeout(function(){
      if (typeof goPanel === 'function' && !goPanel._pmPatched) {
        var _orig = goPanel;
        goPanel = function(name){
          _orig(name);
          if (name === 'projects') {
            updateProjMgrLabels();
            renderProjects();
          }
          // Always refresh dots on any panel switch
          updateNavDots();
        };
        goPanel._pmPatched = true;
        window.goPanel = goPanel;
      }
    }, 150);
  });

  console.log('[AirCalc] AppProjects v3 initialised');
})();