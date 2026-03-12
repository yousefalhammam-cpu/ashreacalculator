(function () {
  'use strict';

  var STORAGE_KEY = 'aircalc_projects';
  var CURRENT_KEY = 'aircalc_current_project_id';

  function G(id) { return document.getElementById(id); }
  function isAr() { return (typeof lang !== 'undefined' ? lang : 'ar') === 'ar'; }
  function nowIso() { return new Date().toISOString(); }
  function uid() {
    return 'prj_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }
  function safeParse(v, fallback) {
    try { return JSON.parse(v); } catch (e) { return fallback; }
  }
  function toastMsg(msg) {
    if (typeof toast === 'function') toast(msg);
    else console.log(msg);
  }
  function clone(obj, fallback) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return fallback; }
  }

  function getProjects() {
    return safeParse(localStorage.getItem(STORAGE_KEY), []) || [];
  }

  function saveProjects(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list || []));
  }

  function getCurrentProjectId() {
    return localStorage.getItem(CURRENT_KEY) || '';
  }

  function setCurrentProjectId(id) {
    if (id) localStorage.setItem(CURRENT_KEY, id);
    else localStorage.removeItem(CURRENT_KEY);
  }

  function normalizeName(name) {
    return String(name || '').trim().toLowerCase();
  }

  function findProjectIndexById(id, list) {
    list = list || getProjects();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return i;
    }
    return -1;
  }

  function findProjectIndexByName(name, list) {
    list = list || getProjects();
    var norm = normalizeName(name);
    for (var i = 0; i < list.length; i++) {
      if (normalizeName(list[i].name) === norm) return i;
    }
    return -1;
  }

  function buildProjectSummary(snapshot) {
    var rooms = (snapshot && snapshot.hist ? snapshot.hist.length : 0) || 0;
    var totalBtu = 0, totalCfm = 0, totalTr = 0;

    (snapshot.hist || []).forEach(function (h) {
      totalBtu += parseInt(h.btu, 10) || 0;
      totalCfm += parseInt(h.cfm, 10) || 0;
      totalTr += parseFloat(h.tr) || 0;
    });

    var grand = 0;
    if (snapshot.quoteMode === 'proj') {
      var p = snapshot.projState || {};
      grand = (parseInt(p.qty, 10) || 0) * (parseFloat(p.up) || 0);
    } else {
      (snapshot.qlines || []).forEach(function (q) {
        grand += (parseInt(q.qty, 10) || 0) * (parseFloat(q.up) || 0);
      });
    }

    return {
      rooms: rooms,
      totalBtu: totalBtu,
      totalCfm: totalCfm,
      totalTr: Number(totalTr.toFixed(2)),
      grand: Number(grand.toFixed(2))
    };
  }

  function captureProjectState() {
    var projName = (G('quote-project') && G('quote-project').value || '').trim();
    var quoteNo = (G('quote-no') && G('quote-no').value || '').trim();

    return {
      name: projName,
      quoteNo: quoteNo,
      hist: clone(typeof hist !== 'undefined' ? hist : [], []),
      qlines: clone(typeof qlines !== 'undefined' ? qlines : [], []),
      devs: clone(typeof devs !== 'undefined' ? devs : [], []),
      lang: (typeof lang !== 'undefined' ? lang : 'ar'),
      vatOn: (typeof vatOn !== 'undefined' ? vatOn : true),
      instPct: (typeof instPct !== 'undefined' ? instPct : 10),
      qsValidity: (typeof qsValidity !== 'undefined' ? qsValidity : 14),
      qsNotes: (typeof qsNotes !== 'undefined' ? qsNotes : ''),
      quoteMode: (typeof quoteMode !== 'undefined' ? quoteMode : 'room'),
      bundleOn: (typeof bundleOn !== 'undefined' ? bundleOn : false),
      bundleConfig: clone(typeof bundleConfig !== 'undefined' ? bundleConfig : {}, {}),
      projState: clone(typeof projState !== 'undefined' ? projState : {}, {}),
      theme: (typeof _theme !== 'undefined' ? _theme : 'dark'),
      currentRoomId: (typeof curRoom !== 'undefined' && curRoom && curRoom.id ? curRoom.id : ''),
      roomVolume: (G('inp-vol') && G('inp-vol').value || ''),
      peopleCount: (G('inp-ppl') && G('inp-ppl').value || ''),
      editIdx: -1
    };
  }

  function applyProjectState(project) {
    if (!project || !project.state) return;
    var s = project.state;

    if (typeof lang !== 'undefined') lang = s.lang || 'ar';
    if (typeof vatOn !== 'undefined') vatOn = s.vatOn !== undefined ? s.vatOn : true;
    if (typeof instPct !== 'undefined') instPct = s.instPct || 10;
    if (typeof qsValidity !== 'undefined') qsValidity = s.qsValidity || 14;
    if (typeof qsNotes !== 'undefined') qsNotes = s.qsNotes || '';
    if (typeof quoteMode !== 'undefined') quoteMode = s.quoteMode || 'room';
    if (typeof bundleOn !== 'undefined') bundleOn = !!s.bundleOn;

    if (typeof bundleConfig !== 'undefined' && s.bundleConfig) {
      Object.keys(bundleConfig).forEach(function (k) {
        if (s.bundleConfig.hasOwnProperty(k)) bundleConfig[k] = s.bundleConfig[k];
      });
    }

    if (typeof projState !== 'undefined' && s.projState) {
      Object.keys(projState).forEach(function (k) {
        if (s.projState.hasOwnProperty(k)) projState[k] = s.projState[k];
      });
    }

    if (typeof hist !== 'undefined') hist = clone(s.hist || [], []);
    if (typeof qlines !== 'undefined') qlines = clone(s.qlines || [], []);
    if (typeof devs !== 'undefined') devs = clone(s.devs || [], []);
    if (typeof editIdx !== 'undefined') editIdx = -1;
    if (typeof _theme !== 'undefined') _theme = s.theme || 'dark';

    if (typeof ROOMS !== 'undefined' && s.currentRoomId && ROOMS[s.currentRoomId]) {
      curRoom = ROOMS[s.currentRoomId];
    }

    if (G('quote-project')) G('quote-project').value = project.name || s.name || '';
    if (G('quote-no')) G('quote-no').value = s.quoteNo || '';
    if (G('inp-vol')) G('inp-vol').value = s.roomVolume || '';
    if (G('inp-ppl')) G('inp-ppl').value = s.peopleCount || '';

    if (typeof _applyTheme === 'function') _applyTheme();
    if (typeof applyQSState === 'function') applyQSState();
    if (typeof renderDevs === 'function') renderDevs();
    if (typeof renderHist === 'function') renderHist();
    if (typeof applyLang === 'function') applyLang();
    if (typeof setQuoteMode === 'function') setQuoteMode(s.quoteMode || 'room');
    if (typeof _updateBundleUI === 'function') _updateBundleUI();
    if (typeof updateProjLabels === 'function') updateProjLabels();
    if (typeof renderProjBlock === 'function' && (s.quoteMode === 'proj')) renderProjBlock();

    setCurrentProjectId(project.id);

    if (typeof goPanel === 'function') goPanel('projects');

    toastMsg(isAr() ? '✅ تم فتح المشروع للتعديل' : '✅ Project opened for editing');
  }

  function createProjectCard(project) {
    var summary = project.summary || buildProjectSummary(project.state || {});
    var updated = project.updatedAt ? new Date(project.updatedAt) : new Date();
    var updatedTxt = updated.toLocaleString(isAr() ? 'ar-SA' : 'en-GB');

    return [
      '<div class="proj-card" style="background:var(--s2);border:1px solid var(--b);border-radius:14px;padding:12px;margin-bottom:10px;">',
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px;">',
          '<div style="min-width:0;flex:1;">',
            '<div style="font-size:14px;font-weight:700;color:var(--t);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">', project.name || '—', '</div>',
            '<div style="font-size:11px;color:var(--tm);margin-top:4px;">', isAr() ? 'آخر تحديث: ' : 'Updated: ', updatedTxt, '</div>',
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px;font-size:11px;color:var(--tm);">',
              '<span>🏠 ', summary.rooms || 0, ' ', (isAr() ? 'غرف' : 'rooms'), '</span>',
              '<span>❄️ ', Number(summary.totalTr || 0).toFixed(2), ' TR</span>',
              '<span>🌬️ ', Number(summary.totalCfm || 0).toLocaleString(), ' CFM</span>',
            '</div>',
          '</div>',
          '<div style="display:flex;gap:6px;flex-shrink:0;">',
            '<button onclick="openProject(\'', project.id, '\')" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(56,189,248,.35);background:rgba(56,189,248,.1);color:var(--a);cursor:pointer;font-size:12px;">', (isAr() ? 'فتح' : 'Open'), '</button>',
            '<button onclick="deleteProject(\'', project.id, '\')" style="padding:8px 10px;border-radius:10px;border:1px solid rgba(239,68,68,.35);background:rgba(239,68,68,.1);color:#ef4444;cursor:pointer;font-size:12px;">', (isAr() ? 'حذف' : 'Delete'), '</button>',
          '</div>',
        '</div>',
      '</div>'
    ].join('');
  }

  function renderProjects() {
    var listEl = G('pm-list');
    if (!listEl) return;

    var search = normalizeName(G('pm-search') ? G('pm-search').value : '');
    var all = getProjects().sort(function (a, b) {
      return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
    });

    if (search) {
      all = all.filter(function (p) {
        return normalizeName(p.name).indexOf(search) !== -1;
      });
    }

    if (!all.length) {
      listEl.innerHTML =
        '<div class="qi-empty" style="margin-top:12px;">' +
        (isAr() ? 'لا توجد مشاريع محفوظة بعد' : 'No saved projects yet') +
        '</div>';
      return;
    }

    listEl.innerHTML = all.map(createProjectCard).join('');
  }

  function saveCurrentProject(options) {
    options = options || {};
    var projInput = G('quote-project');
    var name = (projInput && projInput.value || '').trim();

    if (!name) {
      toastMsg(isAr() ? '⚠️ اكتب اسم المشروع أولاً' : '⚠️ Enter project name first');
      if (projInput) projInput.focus();
      return;
    }

    var all = getProjects();
    var currentId = getCurrentProjectId();
    var idx = -1;

    if (currentId) idx = findProjectIndexById(currentId, all);
    if (idx === -1) idx = findProjectIndexByName(name, all);

    var snapshot = captureProjectState();
    var project;

    if (idx >= 0) {
      project = all[idx];
      project.name = name;
      project.state = snapshot;
      project.summary = buildProjectSummary(snapshot);
      project.updatedAt = nowIso();
      all[idx] = project;
    } else {
      project = {
        id: uid(),
        name: name,
        createdAt: nowIso(),
        updatedAt: nowIso(),
        state: snapshot,
        summary: buildProjectSummary(snapshot)
      };
      all.unshift(project);
    }

    saveProjects(all);
    setCurrentProjectId(project.id);
    renderProjects();

    toastMsg(isAr() ? '✅ تم حفظ المشروع' : '✅ Project saved');

    if (!options.silentNavigate && typeof goPanel === 'function') {
      goPanel('projects');
    }
  }

  function openProject(id) {
    var all = getProjects();
    var idx = findProjectIndexById(id, all);
    if (idx === -1) {
      toastMsg(isAr() ? '⚠️ المشروع غير موجود' : '⚠️ Project not found');
      return;
    }
    applyProjectState(all[idx]);
  }

  function deleteProject(id) {
    var all = getProjects();
    var idx = findProjectIndexById(id, all);
    if (idx === -1) return;

    all.splice(idx, 1);
    saveProjects(all);

    if (getCurrentProjectId() === id) {
      setCurrentProjectId('');
    }

    renderProjects();
    toastMsg(isAr() ? '🗑️ تم حذف المشروع' : '🗑️ Project deleted');
  }

  function updateProjMgrLabels() {
    if (G('pm-ttl')) G('pm-ttl').textContent = isAr() ? '📁 المشاريع' : '📁 Projects';
    if (G('pm-save-lbl')) G('pm-save-lbl').textContent = isAr() ? 'حفظ المشروع الحالي' : 'Save Current Project';
    if (G('pm-search')) G('pm-search').placeholder = isAr() ? 'بحث في المشاريع...' : 'Search projects...';
    if (G('nl-projects')) G('nl-projects').textContent = isAr() ? 'المشاريع' : 'Projects';
    if (G('quote-save-lbl')) G('quote-save-lbl').textContent = isAr() ? 'حفظ' : 'Save';
  }

  window.AppProjects = {
    getProjects: getProjects,
    saveCurrentProject: saveCurrentProject,
    renderProjects: renderProjects,
    openProject: openProject,
    deleteProject: deleteProject,
    updateProjMgrLabels: updateProjMgrLabels
  };

  window.saveCurrentProject = saveCurrentProject;
  window.renderProjects = renderProjects;
  window.openProject = openProject;
  window.loadProject = openProject;
  window.deleteProject = deleteProject;

  document.addEventListener('DOMContentLoaded', function () {
    updateProjMgrLabels();
    renderProjects();
  });
})();