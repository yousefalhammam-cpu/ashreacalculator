// AirCalc Pro - modules/projects.js
// Project management and dashboard rendering.
(function () {
  'use strict';

  var STORAGE_KEY = 'aircalc_projects';
  var CURRENT_KEY = 'aircalc_current_project_id';

  function G(id) { return document.getElementById(id); }
  function _lang() { return (typeof lang !== 'undefined') ? lang : 'ar'; }
  function _isAr() { return _lang() === 'ar'; }
  function _t(ar, en) { return _isAr() ? ar : en; }

  function _toast(msg) {
    if (typeof toast === 'function') return toast(msg);
    if (window.AppHelpers && typeof window.AppHelpers.toast === 'function') {
      return window.AppHelpers.toast(msg);
    }
  }

  function _uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function _now() {
    return new Date().toISOString();
  }

  function _fmtDate(iso) {
    if (!iso) return '';
    try {
      var d = new Date(iso);
      var loc = _isAr() ? 'ar-SA' : 'en-GB';
      return d.toLocaleDateString(loc) + ' ' +
        d.toLocaleTimeString(loc, { hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return iso;
    }
  }

  function _escHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _safeNum(v, digits) {
    var n = Number(v);
    if (!isFinite(n)) return 0;
    return typeof digits === 'number' ? Number(n.toFixed(digits)) : n;
  }

  function _clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function _loadAll() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      var arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function _saveAll(arr) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
      return true;
    } catch (e) {
      console.warn('[Projects] write failed', e);
      return false;
    }
  }

  function _getCurrentId() {
    return localStorage.getItem(CURRENT_KEY) || null;
  }

  function _setCurrentId(id) {
    if (id) localStorage.setItem(CURRENT_KEY, id);
    else localStorage.removeItem(CURRENT_KEY);
  }

  function _getCurrentProjectField(id, fallback) {
    var el = G(id);
    return el ? el.value : fallback;
  }

  function _snapshot() {
    var snap = {};

    snap.hist = (typeof hist !== 'undefined') ? _clone(hist) : [];
    snap.qlines = (typeof qlines !== 'undefined') ? _clone(qlines) : [];
    snap.devs = (typeof devs !== 'undefined') ? _clone(devs) : [];

    snap.projName = (_getCurrentProjectField('tech-project', '') || _getCurrentProjectField('quote-project', '') || '').trim();
    snap.quoteNo = (_getCurrentProjectField('tech-no', '') || _getCurrentProjectField('quote-no', 'Q-001') || 'Q-001').trim() || 'Q-001';

    snap.vatOn = (typeof vatOn !== 'undefined') ? vatOn : true;
    snap.instPct = parseInt((_getCurrentProjectField('qs-inst', '10')), 10) || 10;
    snap.qsValidity = parseInt((_getCurrentProjectField('qs-validity', '14')), 10) || 14;
    snap.qsNotes = _getCurrentProjectField('qs-notes', '') || '';

    snap.quoteMode = (typeof quoteMode !== 'undefined') ? quoteMode : 'room';
    snap.bundleOn = (typeof bundleOn !== 'undefined') ? bundleOn : false;
    snap.bundleConfig = (typeof bundleConfig !== 'undefined') ? _clone(bundleConfig) : {};
    snap.projState = (typeof projState !== 'undefined') ? _clone(projState) : {};

    snap.ductVelSup = parseInt(_getCurrentProjectField('duct-vel-sup', '1000'), 10) || 1000;
    snap.ductVelRet = parseInt(_getCurrentProjectField('duct-vel-ret', '800'), 10) || 800;
    snap.ductCfmPerTr = parseInt(_getCurrentProjectField('duct-cfm-per-tr', '400'), 10) || 400;
    snap.espLenSup = parseFloat(_getCurrentProjectField('esp-len-sup', '30')) || 30;
    snap.espLenRet = parseFloat(_getCurrentProjectField('esp-len-ret', '20')) || 20;
    snap.espBends = parseInt(_getCurrentProjectField('esp-bends', '4'), 10) || 4;
    snap.espFric = parseFloat(_getCurrentProjectField('esp-fric', '1')) || 1;

    snap.projSysType = _getCurrentProjectField('proj-systype', 'split') || 'split';
    snap.projCap = parseInt(_getCurrentProjectField('proj-cap', '0'), 10) || 0;
    snap.projQty = parseInt(_getCurrentProjectField('proj-qty', '1'), 10) || 1;
    snap.projUp = parseFloat(_getCurrentProjectField('proj-up', '0')) || 0;

    snap.curRoomId = (typeof curRoom !== 'undefined' && curRoom) ? curRoom.id : null;
    snap.lang = _lang();

    var totTR = 0, totBTU = 0, totMKT = 0, totCFM = 0;
    snap.hist.forEach(function (h) {
      totTR += parseFloat(h.tr) || 0;
      totBTU += parseInt(h.btu, 10) || 0;
      totMKT += parseInt(h.mkt, 10) || 0;
      totCFM += parseInt(h.cfm, 10) || 0;
    });
    snap.totals = {
      rooms: snap.hist.length,
      tr: Math.round(totTR * 100) / 100,
      btu: totBTU,
      mkt: totMKT,
      cfm: totCFM
    };

    var gtEl = G('qt-grand');
    snap.grandTotalStr = gtEl ? String(gtEl.textContent || '').trim() : '';

    snap.quotation = {
      identity: {
        projectName: snap.projName || '',
        quoteNo: snap.quoteNo || 'Q-001'
      },
      lines: _clone(snap.qlines || []),
      settings: {
        vatOn: snap.vatOn,
        instPct: snap.instPct,
        qsValidity: snap.qsValidity,
        qsNotes: snap.qsNotes || ''
      },
      selectedUnits: (snap.hist || []).map(function (h, idx) {
        var line = (snap.qlines || [])[idx] || {};
        return {
          roomName: h.roomType || h.ar || h.en || '',
          unitType: line.unitType || '',
          selectedBtu: _safeNum(line.selectedBtu || 0),
          qty: _safeNum(line.qty || 0),
          unitPrice: _safeNum(line.up || 0, 2),
          lineTotal: _safeNum((line.qty || 0) * (line.up || 0), 2)
        };
      }),
      roomBreakdown: (snap.hist || []).map(function (h, idx) {
        return {
          roomName: h.roomType || h.ar || h.en || '',
          roomCount: _safeNum(h.roomCount || 1),
          volume: _safeNum(h.vol || 0, 2),
          people: _safeNum(h.ppl || 0),
          cfm: _safeNum(h.cfm || 0),
          btu: _safeNum(h.btu || 0),
          tr: _safeNum(h.tr || 0, 2),
          marketBtu: _safeNum(h.mkt || 0),
          line: _clone((snap.qlines || [])[idx] || {})
        };
      }),
      total: _safeNum((function () {
        var raw = gtEl ? String(gtEl.textContent || '').replace(/[^0-9.\-]/g, '') : '0';
        return parseFloat(raw) || 0;
      })(), 2)
    };

    return snap;
  }

  function _restore(snap) {
    if (!snap) return;
    var qState = snap.quotation || null;

    if (typeof hist !== 'undefined') hist = _clone(snap.hist || []);
    if (typeof qlines !== 'undefined') qlines = _clone((qState && qState.lines) || snap.qlines || []);
    if (typeof devs !== 'undefined') devs = _clone(snap.devs || []);

    if (typeof vatOn !== 'undefined') vatOn = (qState && qState.settings && qState.settings.vatOn !== undefined) ? qState.settings.vatOn : (snap.vatOn !== undefined ? snap.vatOn : true);
    if (typeof instPct !== 'undefined') instPct = (qState && qState.settings && qState.settings.instPct) || snap.instPct || 10;
    if (typeof qsValidity !== 'undefined') qsValidity = (qState && qState.settings && qState.settings.qsValidity) || snap.qsValidity || 14;
    if (typeof qsNotes !== 'undefined') qsNotes = (qState && qState.settings && qState.settings.qsNotes !== undefined) ? qState.settings.qsNotes : (snap.qsNotes || '');
    if (typeof quoteMode !== 'undefined') quoteMode = snap.quoteMode || 'room';
    if (typeof bundleOn !== 'undefined') bundleOn = !!snap.bundleOn;
    if (typeof bundleConfig !== 'undefined' && snap.bundleConfig && typeof snap.bundleConfig === 'object') {
      Object.keys(bundleConfig).forEach(function (k) { delete bundleConfig[k]; });
      Object.keys(snap.bundleConfig).forEach(function (k) { bundleConfig[k] = snap.bundleConfig[k]; });
    }
    if (typeof projState !== 'undefined' && snap.projState && typeof snap.projState === 'object') {
      Object.keys(projState).forEach(function (k) { delete projState[k]; });
      Object.keys(snap.projState).forEach(function (k) { projState[k] = snap.projState[k]; });
    }

    if (snap.curRoomId && typeof ROOMS !== 'undefined' && ROOMS[snap.curRoomId] && typeof curRoom !== 'undefined') {
      curRoom = ROOMS[snap.curRoomId];
    }

    function sv(id, value) {
      var el = G(id);
      if (el && value !== undefined && value !== null) el.value = String(value);
    }

    sv('quote-project', (qState && qState.identity && qState.identity.projectName) || snap.projName || '');
    sv('quote-no', (qState && qState.identity && qState.identity.quoteNo) || snap.quoteNo || 'Q-001');
    sv('tech-project', (qState && qState.identity && qState.identity.projectName) || snap.projName || '');
    sv('tech-no', (qState && qState.identity && qState.identity.quoteNo) || snap.quoteNo || 'Q-001');
    sv('qs-inst', (qState && qState.settings && qState.settings.instPct) || snap.instPct || 10);
    sv('qs-validity', (qState && qState.settings && qState.settings.qsValidity) || snap.qsValidity || 14);
    sv('qs-notes', (qState && qState.settings && qState.settings.qsNotes !== undefined) ? qState.settings.qsNotes : (snap.qsNotes || ''));
    sv('duct-vel-sup', snap.ductVelSup || 1000);
    sv('duct-vel-ret', snap.ductVelRet || 800);
    sv('duct-cfm-per-tr', snap.ductCfmPerTr || 400);
    sv('esp-len-sup', snap.espLenSup || 30);
    sv('esp-len-ret', snap.espLenRet || 20);
    sv('esp-bends', snap.espBends || 4);
    sv('esp-fric', snap.espFric || 1);
    sv('proj-qty', snap.projQty || 1);
    sv('proj-up', snap.projUp || 0);

    try {
      localStorage.setItem('acp9h', JSON.stringify(snap.hist || []));
      localStorage.setItem('acp9q', JSON.stringify((qState && qState.lines) || snap.qlines || []));
      localStorage.setItem('acp9qs', JSON.stringify({
        vatOn: (qState && qState.settings && qState.settings.vatOn !== undefined) ? qState.settings.vatOn : snap.vatOn,
        instPct: (qState && qState.settings && qState.settings.instPct) || snap.instPct,
        qsValidity: (qState && qState.settings && qState.settings.qsValidity) || snap.qsValidity,
        qsNotes: (qState && qState.settings && qState.settings.qsNotes !== undefined) ? qState.settings.qsNotes : snap.qsNotes
      }));
      localStorage.setItem('acp9mode', snap.quoteMode || 'room');
      if (snap.bundleConfig) localStorage.setItem('ac_bundleConfig', JSON.stringify(snap.bundleConfig));
    } catch (e) {}

    if (typeof applyQSState === 'function') applyQSState();
    if (typeof renderDevs === 'function') renderDevs();
    if (typeof renderHist === 'function') renderHist();
    if (typeof setQuoteMode === 'function') setQuoteMode(snap.quoteMode || 'room');
    if (typeof _updateBundleUI === 'function') _updateBundleUI();
    if (typeof refreshGrandTotal === 'function') refreshGrandTotal();
    if (typeof renderQuote === 'function') renderQuote();

    if (typeof curRoom !== 'undefined' && curRoom) {
      var dtEl = G('dt');
      if (dtEl) dtEl.textContent = _isAr() ? curRoom.ar : curRoom.en;
    }

    if (snap.projSysType) {
      setTimeout(function () {
        var stSel = G('proj-systype');
        if (stSel) {
          stSel.value = snap.projSysType;
          if (typeof onProjSysTypeChange === 'function') onProjSysTypeChange();
        }
        setTimeout(function () {
          var capSel = G('proj-cap');
          if (capSel && snap.projCap) capSel.value = String(snap.projCap);
          if (typeof renderProjBlock === 'function' && typeof quoteMode !== 'undefined' && quoteMode === 'proj') {
            renderProjBlock();
          }
        }, 60);
      }, 30);
    }
  }

  function saveCurrentProject(opts) {
    opts = opts || {};
    if (window.AppPlan && !window.AppPlan.requirePro('save_project')) return;
    var projName = (_getCurrentProjectField('tech-project', '') || _getCurrentProjectField('quote-project', '') || '').trim();

    if (!projName) {
      _toast(_t('أدخل اسم المشروع أولاً', 'Enter a project name first'));
      var el = G('tech-project') || G('quote-project');
      if (el) el.focus();
      return;
    }

    var all = _loadAll();
    var snap = _snapshot();
    var now = _now();
    var curId = _getCurrentId();
    var foundIdx = -1;

    if (curId) {
      for (var i = 0; i < all.length; i++) {
        if (all[i].id === curId) {
          foundIdx = i;
          break;
        }
      }
    }

    if (foundIdx < 0) {
      var normName = projName.toLowerCase();
      for (var j = 0; j < all.length; j++) {
        if (String(all[j].name || '').trim().toLowerCase() === normName) {
          foundIdx = j;
          break;
        }
      }
    }

    if (foundIdx >= 0) {
      all[foundIdx].name = projName;
      all[foundIdx].snapshot = snap;
      all[foundIdx].updatedAt = now;
      _saveAll(all);
      _setCurrentId(all[foundIdx].id);
      if (!opts.silentNavigate) _toast(_t('تم تحديث المشروع: ', 'Updated: ') + projName);
    } else {
      var limit = (window.AppPlan && typeof window.AppPlan.getProjectLimit === 'function')
        ? window.AppPlan.getProjectLimit()
        : Infinity;
      if (all.length >= limit) {
        _toast(_isAr()
          ? 'وصلت للحد الأقصى من المشاريع في الخطة الحالية'
          : 'You reached the project limit for the current plan');
        return;
      }
      var newProj = {
        id: _uid(),
        name: projName,
        createdAt: now,
        updatedAt: now,
        snapshot: snap
      };
      all.unshift(newProj);
      _saveAll(all);
      _setCurrentId(newProj.id);
      _toast(_t('تم حفظ المشروع: ', 'Saved: ') + projName);
    }

    renderProjects();
    updateNavDots();
    if (typeof window.trackEvent === 'function') {
      window.trackEvent('save_project', {
        language: _isAr() ? 'ar' : 'en',
        rooms: (snap && snap.hist && snap.hist.length) || 0
      });
    }
    if (!opts.silentNavigate && typeof goPanel === 'function') goPanel('projects');
  }

  function _findProject(id) {
    var all = _loadAll();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) return { all: all, project: all[i], index: i };
    }
    return { all: all, project: null, index: -1 };
  }

  function setActiveProject(projectId) {
    var found = _findProject(projectId);
    if (!found.project) {
      _toast(_t('المشروع غير موجود', 'Project not found'));
      return null;
    }

    _restore(found.project.snapshot || {});
    _setCurrentId(found.project.id);
    if (window.AppStorage && typeof window.AppStorage.saveCurrentProjectId === 'function') {
      window.AppStorage.saveCurrentProjectId(found.project.id);
    }
    found.project.updatedAt = _now();
    _saveAll(found.all);
    renderProjects();
    updateNavDots();
    return found.project;
  }

  function loadProject(id) {
    var proj = setActiveProject(id);
    if (!proj) return;
    if (typeof goPanel === 'function') goPanel('calc');
    _toast(_t('تم فتح المشروع: ', 'Project opened: ') + proj.name);
  }

  function deleteProject(id) {
    var all = _loadAll();
    var name = '';
    var next = all.filter(function (p) {
      if (p.id === id) {
        name = p.name;
        return false;
      }
      return true;
    });
    _saveAll(next);
    if (_getCurrentId() === id) _setCurrentId(null);
    renderProjects();
    updateNavDots();
    _toast(_t('تم حذف: ', 'Deleted: ') + name);
  }

  function saveQuotationToCurrentProject() {
    if (window.AppPlan && !window.AppPlan.requirePro('save_quotation')) return false;
    var curId = _getCurrentId();
    if (!curId && window.AppStorage && typeof window.AppStorage.restoreCurrentProjectId === 'function') {
      curId = window.AppStorage.restoreCurrentProjectId();
    }
    if (!curId) {
      _toast(_t('افتح أو احفظ مشروعًا أولًا', 'Open or save a project first'));
      return false;
    }

    var found = _findProject(curId);
    if (!found.project) {
      _setCurrentId(null);
      _toast(_t('افتح أو احفظ مشروعًا أولًا', 'Open or save a project first'));
      return false;
    }

    found.project.name = _snapshot().projName || found.project.name || '';
    found.project.snapshot = _snapshot();
    found.project.updatedAt = _now();
    _saveAll(found.all);
    _setCurrentId(found.project.id);

    renderProjects();
    updateNavDots();
    if (typeof window.trackEvent === 'function') {
      window.trackEvent('save_quotation', {
        language: _isAr() ? 'ar' : 'en',
        rooms: (found.project.snapshot && found.project.snapshot.hist && found.project.snapshot.hist.length) || 0
      });
    }
    _toast(_t('تم حفظ عرض السعر', 'Quotation saved'));
    return true;
  }

  function _readQuotationTotal(snap) {
    if (!snap) return 0;
    if (snap.quotation && isFinite(Number(snap.quotation.total))) {
      return Number(snap.quotation.total) || 0;
    }
    var raw = String(snap.grandTotalStr || '').replace(/[^0-9.\-]/g, '');
    return parseFloat(raw) || 0;
  }

  function _getProjectCalcMode(snap) {
    var rooms = (snap && snap.hist) || [];
    for (var i = 0; i < rooms.length; i++) {
      var h = rooms[i] || {};
      if (h.calcMode === 'hc' || h.ach || h.oaStd || h.sup || h.exh || h.pressure) {
        return 'ashrae';
      }
    }
    return 'load';
  }

  function _getProjectCalcModeLabel(snap) {
    return _getProjectCalcMode(snap) === 'ashrae'
      ? _t('ASHRAE', 'ASHRAE')
      : _t('معامل حمل', 'Load Factor');
  }

  function _projectMatchesDate(updatedAt, filterValue) {
    if (!filterValue || filterValue === 'all') return true;
    var days = parseInt(filterValue, 10);
    if (!days) return true;
    var updated = new Date(updatedAt || 0).getTime();
    if (!updated) return false;
    return updated >= (Date.now() - days * 24 * 60 * 60 * 1000);
  }

  function _projectMatchesRooms(roomCount, filterValue) {
    if (!filterValue || filterValue === 'all') return true;
    if (filterValue === '1-3') return roomCount >= 1 && roomCount <= 3;
    if (filterValue === '4+') return roomCount >= 4;
    if (filterValue === '4-8') return roomCount >= 4 && roomCount <= 8;
    if (filterValue === '9+') return roomCount >= 9;
    return true;
  }

  function _restoreProjectForAction(id, panelName) {
    var proj = setActiveProject(id);
    if (!proj) return null;
    if (panelName && typeof goPanel === 'function') goPanel(panelName);
    return proj;
  }

  function openProjectReport(id) {
    if (window.AppPlan && !window.AppPlan.requirePro('dashboard')) return;
    var proj = _restoreProjectForAction(id, 'tech');
    if (proj) _toast(_t('تم فتح التقرير: ', 'Report opened: ') + proj.name);
  }

  function openProjectQuotation(id) {
    if (window.AppPlan && !window.AppPlan.requirePro('dashboard')) return;
    var proj = _restoreProjectForAction(id, 'hist');
    if (proj) _toast(_t('تم فتح عرض السعر: ', 'Quotation opened: ') + proj.name);
  }

  function exportProjectPDF(id) {
    if (window.AppPlan && !window.AppPlan.requirePro('export_pdf')) return;
    var proj = setActiveProject(id);
    if (!proj) return;
    if (typeof exportTechPDF === 'function') {
      setTimeout(function () { exportTechPDF(); }, 120);
    } else if (typeof exportPDF === 'function') {
      setTimeout(function () { exportPDF(); }, 120);
    } else {
      _toast(_t('تصدير PDF غير متاح الآن', 'PDF export is not available right now'));
    }
  }

  function exportProjectHAP(id) {
    if (window.AppPlan && !window.AppPlan.requirePro('export_hap')) return;
    var proj = setActiveProject(id);
    if (!proj) return;
    if (typeof exportHAP === 'function') {
      setTimeout(function () { exportHAP(); }, 120);
    } else {
      _toast(_t('تصدير HAP غير متاح الآن', 'HAP export is not available right now'));
    }
  }

  function duplicateProject(id) {
    if (window.AppPlan && !window.AppPlan.requirePro('dashboard')) return;
    var found = _findProject(id);
    if (!found.project) {
      _toast(_t('المشروع غير موجود', 'Project not found'));
      return;
    }
    var copy = _clone(found.project);
    copy.id = _uid();
    copy.createdAt = _now();
    copy.updatedAt = copy.createdAt;
    copy.name = _isAr() ? ('نسخة من ' + found.project.name) : ('Copy of ' + found.project.name);
    found.all.unshift(copy);
    _saveAll(found.all);
    _setCurrentId(copy.id);
    renderProjects();
    updateNavDots();
    _toast(_t('تم نسخ المشروع', 'Project duplicated'));
  }

  function createNewProjectFromDashboard() {
    if (typeof goPanel === 'function') goPanel('calc');
    _toast(_t('ابدأ مشروعًا جديدًا من صفحة الحساب', 'Start a new project from the calculator page'));
  }

  function renderProjects() {
    var list = G('pm-list');
    if (!list) return;

    var isAr = _isAr();
    var all = _loadAll();
    var query = String(((G('pm-search') || { value: '' }).value || '')).trim().toLowerCase();
    var curId = _getCurrentId();
    var typeFilter = (G('pm-filter-type') || { value: 'all' }).value || 'all';
    var dateFilter = (G('pm-filter-date') || { value: 'all' }).value || 'all';
    var roomsFilter = (G('pm-filter-rooms') || { value: 'all' }).value || 'all';
    var sortBy = (G('pm-sort') || { value: 'latest' }).value || 'latest';

    var si = G('pm-search');
    if (si) si.placeholder = isAr ? 'بحث باسم المشروع...' : 'Search by project name...';

    var shown = all.filter(function (p) {
      var snap = p.snapshot || {};
      var totals = snap.totals || {};
      var roomCount = Number(totals.rooms || ((snap.hist && snap.hist.length) || 0)) || 0;
      var mode = _getProjectCalcMode(snap);
      var name = String(p.name || '').toLowerCase();
      if (query && name.indexOf(query) === -1) return false;
      if (typeFilter === 'ashrae' && mode !== 'ashrae') return false;
      if (typeFilter === 'load' && mode !== 'load') return false;
      if (!_projectMatchesDate(p.updatedAt, dateFilter)) return false;
      if (!_projectMatchesRooms(roomCount, roomsFilter)) return false;
      return true;
    });

    shown.sort(function (a, b) {
      var as = a.snapshot || {}, bs = b.snapshot || {};
      var at = as.totals || {}, bt = bs.totals || {};
      if (sortBy === 'name') {
        return String(a.name || '').localeCompare(String(b.name || ''), isAr ? 'ar' : 'en', { sensitivity: 'base' });
      }
      if (sortBy === 'largest') {
        return Number(bt.btu || 0) - Number(at.btu || 0);
      }
      return new Date(b.updatedAt || 0).getTime() - new Date(a.updatedAt || 0).getTime();
    });

    if (!shown.length) {
      list.innerHTML =
        '<div class="pm-empty">' +
          '<div class="pm-empty-ico">📁</div>' +
          (all.length === 0
            ? '<div class="pm-empty-ttl">' + (isAr ? 'لا توجد مشاريع محفوظة' : 'No saved projects') + '</div>' +
              '<div class="pm-empty-sub">' + (isAr ? 'ابدأ مشروعًا جديدًا ثم احفظه ليظهر هنا في لوحة المشاريع.' : 'Create and save a project to see it here in the dashboard.') + '</div>' +
              '<button class="pm-empty-cta" onclick="createNewProjectFromDashboard()">' + (isAr ? 'إنشاء مشروع جديد' : 'Create New Project') + '</button>'
            : '<div class="pm-empty-ttl">' + (isAr ? 'لا توجد نتائج مطابقة' : 'No matching projects') + '</div>' +
              '<div class="pm-empty-sub">' + (isAr ? 'جرّب تغيير البحث أو التصفية' : 'Try changing the search or filters') + '</div>') +
        '</div>';
      updateNavDots();
      return;
    }

    var html = '';
    shown.forEach(function (proj) {
      var snap = proj.snapshot || {};
      var tot = snap.totals || {};
      var isCur = proj.id === curId;
      var roomCount = Number(tot.rooms || ((snap.hist && snap.hist.length) || 0)) || 0;
      var quotationTotal = _readQuotationTotal(snap);
      var calcMode = _getProjectCalcModeLabel(snap);
      var calcModeClass = _getProjectCalcMode(snap) === 'ashrae' ? 'green' : 'amber';
      var pid = proj.id;
      var pname = String(proj.name || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      var cardStyle = isCur ? ' style="border-color:rgba(76,175,80,.35);box-shadow:0 0 0 1px rgba(76,175,80,.16);"' : '';

      html +=
        '<div class="pm-card" id="pmc-' + pid + '"' + cardStyle + '>' +
          '<div class="pm-card-top">' +
            '<div class="pm-card-name">' +
              (isCur ? '<span style="color:var(--g);font-size:10px;margin-inline-end:6px;">●</span>' : '') +
              _escHtml(proj.name) +
            '</div>' +
            '<span class="pm-card-badge">' + _escHtml(calcMode) + '</span>' +
          '</div>' +
          '<div class="pm-card-meta">' +
            '<span class="pm-meta-pill ' + calcModeClass + '">' + _escHtml(calcMode) + '</span>' +
            (snap.quoteMode === 'proj' ? '<span class="pm-meta-pill">' + (isAr ? 'وحدة للمشروع' : 'Project Unit') + '</span>' : '') +
            (snap.bundleOn ? '<span class="pm-meta-pill">Bundle</span>' : '') +
            (snap.quoteNo ? '<span class="pm-meta-pill"># ' + _escHtml(snap.quoteNo) + '</span>' : '') +
          '</div>' +
          '<div class="pm-stats">' +
            '<div class="pm-stat"><div class="pm-stat-lbl">' + (isAr ? 'عدد الغرف' : 'Rooms') + '</div><div class="pm-stat-val">' + roomCount + '</div></div>' +
            '<div class="pm-stat"><div class="pm-stat-lbl">' + (isAr ? 'إجمالي الحمل' : 'Total Load') + '</div><div class="pm-stat-val">' + Number(tot.btu || 0).toLocaleString() + '<small> BTU/h</small></div></div>' +
            '<div class="pm-stat"><div class="pm-stat-lbl">' + (isAr ? 'إجمالي طن التبريد' : 'Total TR') + '</div><div class="pm-stat-val">' + Number(tot.tr || 0).toFixed(2) + '<small> TR</small></div></div>' +
            '<div class="pm-stat"><div class="pm-stat-lbl">' + (isAr ? 'إجمالي الهواء' : 'Total CFM') + '</div><div class="pm-stat-val">' + Number(tot.cfm || 0).toLocaleString() + '<small> CFM</small></div></div>' +
            '<div class="pm-stat"><div class="pm-stat-lbl">' + (isAr ? 'قيمة العرض' : 'Quotation Total') + '</div><div class="pm-stat-val">' + quotationTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '<small> ﷼</small></div></div>' +
            '<div class="pm-stat"><div class="pm-stat-lbl">' + (isAr ? 'آخر تحديث' : 'Last Updated') + '</div><div class="pm-stat-val"><small>' + _fmtDate(proj.updatedAt) + '</small></div></div>' +
          '</div>' +
          '<div class="pm-card-actions primary">' +
            '<button class="pm-act-btn open" data-pro-feature="projectDashboard" onclick="loadProject(\'' + pid + '\')">' + (isAr ? 'فتح المشروع' : 'Open Project') + '</button>' +
            '<button class="pm-act-btn report" data-pro-feature="projectDashboard" onclick="openProjectReport(\'' + pid + '\')">' + (isAr ? 'عرض التقرير' : 'View Report') + '</button>' +
            '<button class="pm-act-btn quote" data-pro-feature="projectDashboard" onclick="openProjectQuotation(\'' + pid + '\')">' + (isAr ? 'عرض السعر' : 'View Quotation') + '</button>' +
          '</div>' +
          '<div class="pm-card-actions">' +
            '<button class="pm-act-btn export" data-pro-feature="exportPDF" onclick="exportProjectPDF(\'' + pid + '\')">' + (isAr ? 'تصدير PDF' : 'Export PDF') + '</button>' +
            '<button class="pm-act-btn export" data-pro-feature="exportHAP" onclick="exportProjectHAP(\'' + pid + '\')">' + (isAr ? 'تصدير HAP' : 'Export HAP') + '</button>' +
            '<button class="pm-act-btn copy" data-pro-feature="projectDashboard" onclick="duplicateProject(\'' + pid + '\')">' + (isAr ? 'نسخ المشروع' : 'Duplicate Project') + '</button>' +
            '<button class="pm-act-btn del" data-pro-feature="projectDashboard" onclick="_pmConfirmDelete(\'' + pid + '\',\'' + pname + '\')">' + (isAr ? 'حذف المشروع' : 'Delete Project') + '</button>' +
          '</div>' +
        '</div>';
    });

    list.innerHTML = html;
    if (window.AppPlan && typeof window.AppPlan.syncLockedUI === 'function') {
      window.AppPlan.syncLockedUI(list);
    }
    updateNavDots();
  }

  function updateProjMgrLabels() {
    var isAr = _isAr();
    function sl(id, ar, en) {
      var el = G(id);
      if (el) el.textContent = isAr ? ar : en;
    }
    function setOptionText(selectEl, index, ar, en) {
      if (selectEl && selectEl.options && selectEl.options[index]) {
        selectEl.options[index].text = isAr ? ar : en;
      }
    }

    sl('pm-ttl', '📁 لوحة المشاريع', '📁 Project Dashboard');
    sl('pm-save-lbl', 'حفظ المشروع الحالي', 'Save Current Project');
    sl('nl-projects', 'المشاريع', 'Projects');
    sl('pm-filter-lbl', 'تصفية', 'Filter');
    sl('pm-date-lbl', 'التاريخ', 'Date');
    sl('pm-rooms-lbl', 'الغرف', 'Rooms');
    sl('pm-sort-lbl', 'ترتيب', 'Sort');

    var search = G('pm-search');
    if (search) search.placeholder = isAr ? 'بحث باسم المشروع...' : 'Search by project name...';

    var typeSel = G('pm-filter-type');
    setOptionText(typeSel, 0, 'الكل', 'All');
    setOptionText(typeSel, 1, 'ASHRAE', 'ASHRAE');
    setOptionText(typeSel, 2, 'معامل حمل', 'Load Factor');

    var dateSel = G('pm-filter-date');
    setOptionText(dateSel, 0, 'الكل', 'All');
    setOptionText(dateSel, 1, 'آخر 7 أيام', 'Last 7 days');
    setOptionText(dateSel, 2, 'آخر 30 يومًا', 'Last 30 days');
    setOptionText(dateSel, 3, 'هذا العام', 'This year');

    var roomsSel = G('pm-filter-rooms');
    setOptionText(roomsSel, 0, 'الكل', 'All');
    setOptionText(roomsSel, 1, '1 - 3 غرف', '1 - 3 rooms');
    setOptionText(roomsSel, 2, '4+ غرف', '4+ rooms');
    setOptionText(roomsSel, 3, '9+ غرف', '9+ rooms');

    var sortSel = G('pm-sort');
    setOptionText(sortSel, 0, 'الأحدث', 'Latest');
    setOptionText(sortSel, 1, 'الأكبر', 'Largest');
    setOptionText(sortSel, 2, 'الاسم', 'Name');

    var btn = G('quote-save-btn') || G('qp-save-btn');
    if (btn) btn.title = isAr ? 'حفظ المشروع' : 'Save Project';
  }

  function _isPanelActive(panelId) {
    var el = G(panelId);
    return !!(el && el.classList.contains('on'));
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

  window._pmConfirmDelete = function (id, name) {
    var cleanName = String(name || '').replace(/\\'/g, "'");
    var msg = _isAr()
      ? ('هل تريد حذف المشروع "' + cleanName + '"؟')
      : ('Are you sure you want to delete "' + cleanName + '"?');
    if (window.confirm(msg)) deleteProject(id);
  };

  function _bindWindow() {
    window.saveCurrentProject = saveCurrentProject;
    window.saveQuotationToCurrentProject = saveQuotationToCurrentProject;
    window.loadProject = loadProject;
    window.openProject = loadProject;
    window.setActiveProject = setActiveProject;
    window.openProjectReport = openProjectReport;
    window.openProjectQuotation = openProjectQuotation;
    window.exportProjectPDF = exportProjectPDF;
    window.exportProjectHAP = exportProjectHAP;
    window.duplicateProject = duplicateProject;
    window.createNewProjectFromDashboard = createNewProjectFromDashboard;
    window.deleteProject = deleteProject;
    window.renderProjects = renderProjects;

    window.AppProjects = {
      saveCurrentProject: saveCurrentProject,
      saveQuotationToCurrentProject: saveQuotationToCurrentProject,
      loadProject: loadProject,
      openProject: loadProject,
      setActiveProject: setActiveProject,
      openProjectReport: openProjectReport,
      openProjectQuotation: openProjectQuotation,
      exportProjectPDF: exportProjectPDF,
      exportProjectHAP: exportProjectHAP,
      duplicateProject: duplicateProject,
      createNewProjectFromDashboard: createNewProjectFromDashboard,
      deleteProject: deleteProject,
      renderProjects: renderProjects,
      updateProjMgrLabels: updateProjMgrLabels,
      updateProjectsDot: updateProjectsDot,
      updateHistDot: updateHistDot,
      updateNavDots: updateNavDots,
      getProjects: _loadAll,
      snapshot: _snapshot
    };
  }

  _bindWindow();

  document.addEventListener('DOMContentLoaded', function () {
    setTimeout(_bindWindow, 0);
    setTimeout(updateNavDots, 200);

    setTimeout(function () {
      if (typeof goPanel === 'function' && !goPanel._pmPatched) {
        var originalGoPanel = goPanel;
        goPanel = function (name) {
          if (name === 'projects' && window.AppPlan && !window.AppPlan.requireFeature('projectDashboard')) {
            return;
          }
          originalGoPanel(name);
          if (name === 'projects') {
            updateProjMgrLabels();
            renderProjects();
          }
          updateNavDots();
        };
        goPanel._pmPatched = true;
        window.goPanel = goPanel;
      }
    }, 150);
  });

  console.log('[AirCalc] AppProjects dashboard initialised');
})();
