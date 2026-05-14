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
    if (qs.instPct)                  S.instPct    = qs.instPct;
    if (qs.qsValidity)               S.qsValidity = qs.qsValidity;
    if (qs.qsNotes    !== undefined) S.qsNotes    = qs.qsNotes;

    // Quote mode
    S.quoteMode = AS.restoreQuoteMode();

    // Theme
    S.theme = AS.restoreTheme();

    // Language
    try {
      var savedLang = localStorage.getItem('aircalc_lang');
      if (savedLang === 'ar' || savedLang === 'en') {
        S.lang = savedLang;
      }
    } catch (e) {}

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
    if (qs.instPct)             S.instPct = qs.instPct;
    if (qs.qsValidity)          S.qsValidity = qs.qsValidity;
    if (qs.qsNotes !== undefined) S.qsNotes = qs.qsNotes;
    var qm = localStorage.getItem('acp9mode');
    if (qm === 'proj') S.quoteMode = 'proj';
    var th = localStorage.getItem('acp9theme');
    if (th === 'light') S.theme = 'light';
    var savedLang = localStorage.getItem('aircalc_lang');
    if (savedLang === 'ar' || savedLang === 'en') S.lang = savedLang;
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

  function loadBootstrapScriptData() {
    return new Promise(function(resolve, reject) {
      if (window.__AIRCALC_BOOT_DATA__ && typeof window.__AIRCALC_BOOT_DATA__ === 'object') {
        resolve(window.__AIRCALC_BOOT_DATA__);
        return;
      }
      var script = document.createElement('script');
      script.src = './data.bootstrap.js';
      script.async = false;
      script.onload = function() {
        if (window.__AIRCALC_BOOT_DATA__ && typeof window.__AIRCALC_BOOT_DATA__ === 'object') {
          resolve(window.__AIRCALC_BOOT_DATA__);
          return;
        }
        reject(new Error('Bootstrap data script loaded but data was not found'));
      };
      script.onerror = function() {
        reject(new Error('Failed to load bootstrap data script'));
      };
      document.head.appendChild(script);
    });
  }

  function loadAppBootstrapData() {
    if (window.__AIRCALC_BOOT_DATA__ && typeof window.__AIRCALC_BOOT_DATA__ === 'object') {
      return Promise.resolve(window.__AIRCALC_BOOT_DATA__);
    }
    if (window.location && window.location.protocol === 'file:') {
      return loadBootstrapScriptData();
    }
    return fetch('./data.json')
      .then(function(r) {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' fetching data.json');
        return r.json();
      });
  }

  function installRuntimePatches() {
    if (window.__AIRCALC_RUNTIME_PATCH_INSTALLED__) return;
    window.__AIRCALC_RUNTIME_PATCH_INSTALLED__ = true;

    function normalizeQuoteMode(mode) {
      return mode === 'proj' ? 'proj' : 'room';
    }

    function setSharedQuoteMode(mode) {
      quoteMode = normalizeQuoteMode(mode);
      if (window.AppState && typeof window.AppState === 'object') {
        window.AppState.quoteMode = quoteMode;
      }
      try {
        AppStorage.saveQuoteMode(quoteMode);
      } catch (e) {}
      return quoteMode;
    }

    function refreshModeDependentUi() {
      if (typeof syncAllRoomSystemStates === 'function') syncAllRoomSystemStates();
      if (quoteMode === 'proj' && typeof getProjectQtyAuto === 'function' && getProjectQtyAuto()) {
        if (typeof syncProjectRecommendation === 'function') {
          syncProjectRecommendation({ keepSelectedCapacity: true });
        }
      }
      if (typeof renderHist === 'function') renderHist();
      if (quoteMode === 'proj' && typeof renderProjBlock === 'function') renderProjBlock();
      if (typeof updateQuoteModeAuxVisibility === 'function') updateQuoteModeAuxVisibility();
      if (typeof applyLang === 'function') applyLang();
      if (typeof updateDirectResults === 'function') updateDirectResults();
      if (typeof refreshGrandTotal === 'function') refreshGrandTotal();
    }

    function getRoomRequiredBtu(i) {
      var room = hist[i] || {};
      return parseInt(room.finalBtu || room.requiredBtu || room.btu, 10) || 0;
    }

    function getRoomRequiredCfm(i) {
      var room = hist[i] || {};
      return Math.max(0, parseInt(room.requiredCfm || room.cfm, 10) || 0);
    }

    function getUnitAirflowCfm(system) {
      if (!system) return 0;
      var selectedBtu = typeof toSystemBtu === 'function'
        ? toSystemBtu(system.selectedBtu)
        : (parseInt(system.selectedBtu, 10) || 0);
      if (selectedBtu <= 0) return 0;
      var unitType = typeof getAllowedSystemType === 'function' ? getAllowedSystemType(system.unitType) : system.unitType;
      var cfmPerTr = (bundleConfig && bundleConfig.cfmPerTr) ? parseInt(bundleConfig.cfmPerTr, 10) || 400 : 400;
      if (typeof getDuctCfm === 'function') {
        var resolved = getDuctCfm(unitType, selectedBtu, 0, cfmPerTr);
        return Math.max(0, parseInt(resolved && resolved.cfm, 10) || 0);
      }
      return Math.round((selectedBtu / 12000) * cfmPerTr);
    }

    function getCapacityStatus(requiredBtu, selectedCapacityBtu) {
      requiredBtu = Math.max(0, parseInt(requiredBtu, 10) || 0);
      selectedCapacityBtu = Math.max(0, parseInt(selectedCapacityBtu, 10) || 0);
      if (selectedCapacityBtu <= 0) {
        return {
          key: 'no_system_selected',
          delta: 0,
          deltaText: '0.0%',
          label: lang === 'ar' ? 'لم يتم اختيار وحدات تكييف بعد' : 'No HVAC systems selected yet',
          css: 'pending'
        };
      }
      if (requiredBtu <= 0) {
        return {
          key: 'matched',
          delta: 0,
          deltaText: '0.0%',
          label: lang === 'ar' ? 'السعة المختارة مناسبة' : 'Selected capacity is suitable',
          css: 'matched'
        };
      }
      var raw = ((selectedCapacityBtu - requiredBtu) / requiredBtu) * 100;
      var rounded = Math.round(raw * 10) / 10;
      var deltaText = (rounded >= 0 ? '+' : '') + rounded.toFixed(1) + '%';
      if (selectedCapacityBtu < requiredBtu) {
        return {
          key: 'undersized',
          delta: rounded,
          deltaText: deltaText,
          label: lang === 'ar' ? 'السعة المختارة أقل من المطلوب' : 'Selected capacity is below required load',
          css: 'deficit-mild'
        };
      }
      if (selectedCapacityBtu <= requiredBtu * 1.10) {
        return {
          key: 'matched',
          delta: rounded,
          deltaText: deltaText,
          label: lang === 'ar' ? 'السعة المختارة مناسبة' : 'Selected capacity is suitable',
          css: 'matched'
        };
      }
      return {
        key: 'oversized',
        delta: rounded,
        deltaText: deltaText,
        label: lang === 'ar' ? 'السعة المختارة أعلى من المطلوب' : 'Selected capacity is higher than required load',
        css: raw <= 25 ? 'oversize-ok' : 'oversize-high'
      };
    }

    function getAirflowStatus(requiredCfm, selectedCfm) {
      requiredCfm = Math.max(0, parseInt(requiredCfm, 10) || 0);
      selectedCfm = Math.max(0, parseInt(selectedCfm, 10) || 0);
      if (selectedCfm <= 0) {
        return {
          key: 'no_system_selected',
          delta: 0,
          deltaText: '',
          label: lang === 'ar' ? 'لم يتم اختيار وحدات تكييف بعد' : 'No HVAC systems selected yet',
          css: 'deficit-mild'
        };
      }
      if (requiredCfm <= 0) {
        return {
          key: 'matched',
          delta: 0,
          deltaText: '',
          label: lang === 'ar' ? 'تدفق الهواء المختار مناسب' : 'Selected airflow is suitable',
          css: 'matched'
        };
      }
      var raw = ((selectedCfm - requiredCfm) / requiredCfm) * 100;
      var rounded = Math.round(raw * 10) / 10;
      var deltaText = (rounded >= 0 ? '+' : '') + rounded.toFixed(1) + '%';
      if (selectedCfm < requiredCfm) {
        return {
          key: 'undersized',
          delta: rounded,
          deltaText: deltaText,
          label: lang === 'ar' ? 'تدفق الهواء المختار أقل من المطلوب' : 'Selected airflow is below required airflow',
          css: 'deficit-mild'
        };
      }
      if (selectedCfm <= requiredCfm * 1.10) {
        return {
          key: 'matched',
          delta: rounded,
          deltaText: deltaText,
          label: lang === 'ar' ? 'تدفق الهواء المختار مناسب' : 'Selected airflow is suitable',
          css: 'matched'
        };
      }
      return {
        key: 'oversized',
        delta: rounded,
        deltaText: deltaText,
        label: lang === 'ar' ? 'تدفق الهواء المختار أعلى من المطلوب' : 'Selected airflow is higher than required airflow',
        css: raw <= 25 ? 'oversize-ok' : 'oversize-high'
      };
    }

    function getRoomSystemState(i) {
      var room = hist[i] || {};
      var requiredBtu = getRoomRequiredBtu(i);
      var requiredCfm = getRoomRequiredCfm(i);
      var systems = ensureRoomSystems(i).map(normalizeQuoteSystem);
      var selectedCapacityBtu = systems.reduce(function(sum, system) {
        var btu = typeof toSystemBtu === 'function' ? toSystemBtu(system.selectedBtu) : (parseInt(system.selectedBtu, 10) || 0);
        return sum + (btu * Math.max(1, parseInt(system.qty, 10) || 1));
      }, 0);
      var selectedSystemCfm = systems.reduce(function(sum, system) {
        return sum + (getUnitAirflowCfm(system) * Math.max(1, parseInt(system.qty, 10) || 1));
      }, 0);
      var capacityDifference = selectedCapacityBtu - requiredBtu;
      var airflowDifference = selectedSystemCfm - requiredCfm;
      var status = getCapacityStatus(requiredBtu, selectedCapacityBtu);
      var isHealthcare = typeof isHealthcareRoom === 'function' ? isHealthcareRoom(room) : !!(room && room.mode === 'hc');
      var airflowStatus = isHealthcare ? getAirflowStatus(requiredCfm, selectedSystemCfm) : null;
      return {
        systems: systems,
        requiredBtu: requiredBtu,
        requiredCfm: requiredCfm,
        selectedCapacityBtu: selectedCapacityBtu,
        selectedSystemCfm: selectedSystemCfm,
        capacityDifference: capacityDifference,
        airflowDifference: airflowDifference,
        capacityStatus: status.key,
        capacityStatusMeta: status,
        airflowStatus: airflowStatus ? airflowStatus.key : '',
        airflowStatusMeta: airflowStatus,
        isHealthcare: isHealthcare,
        pressureRequirement: room.pres || room.pressure || ''
      };
    }

    function syncRoomSystemState(i) {
      if (i < 0 || i >= hist.length) return null;
      var line = ensureQuoteLine(i);
      var state = getRoomSystemState(i);
      line.systems = state.systems.map(normalizeQuoteSystem);
      line.selectedCapacityBtu = state.selectedCapacityBtu;
      line.capacityDifference = state.capacityDifference;
      line.capacityStatus = state.capacityStatus;
      line.requiredCfm = state.requiredCfm;
      line.selectedSystemCfm = state.selectedSystemCfm;
      line.airflowDifference = state.airflowDifference;
      line.airflowStatus = state.airflowStatus;
      hist[i].requiredBtu = state.requiredBtu;
      hist[i].finalBtu = state.requiredBtu;
      hist[i].systems = state.systems.map(normalizeQuoteSystem);
      hist[i].selectedCapacityBtu = state.selectedCapacityBtu;
      hist[i].capacityDifference = state.capacityDifference;
      hist[i].capacityStatus = state.capacityStatus;
      hist[i].capacityDeltaPct = state.capacityStatusMeta.delta;
      hist[i].requiredCfm = state.requiredCfm;
      hist[i].selectedSystemCfm = state.selectedSystemCfm;
      hist[i].airflowDifference = state.airflowDifference;
      hist[i].airflowStatus = state.airflowStatus;
      return state;
    }

    function syncAllRoomSystemStates() {
      for (var i = 0; i < hist.length; i++) syncRoomSystemState(i);
    }

    function recalcRoomSystems(i) {
      var state = syncRoomSystemState(i);
      if (typeof persistQuoteState === 'function') persistQuoteState();
      if (typeof renderTechReport === 'function') renderTechReport();
      if (typeof renderQuotation === 'function') renderQuotation();
      if (typeof updateDirectResults === 'function') updateDirectResults();
      if (typeof refreshGrandTotal === 'function') refreshGrandTotal();
      return state;
    }

    function renderRoomSystemsEditor(i, requiredBtu) {
      var roomState = syncRoomSystemState(i) || getRoomSystemState(i);
      var systems = roomState.systems;
      var selectedCapacity = roomState.selectedCapacityBtu;
      var status = roomState.capacityStatusMeta;
      var requiredVal = roomState.requiredBtu;
      var diffVal = roomState.capacityDifference;
      var rowsHtml = systems.map(function(system) {
        var typeOpts = MIXED_SYSTEM_TYPES.map(function(key) {
          return '<option value="' + key + '"' + (system.unitType === key ? ' selected' : '') + '>' + utLabel(key) + '</option>';
        }).join('');
        var capOpts = getCatalog(system.unitType).map(function(item) {
          var lbl = lang === 'ar' ? item.label.ar : item.label.en;
          return '<option value="' + item.btu + '"' + ((parseInt(system.selectedBtu, 10) || 0) === (parseInt(item.btu, 10) || 0) ? ' selected' : '') + '>' + lbl + '</option>';
        }).join('');
        var totalSelected = (parseInt(system.selectedBtu, 10) || 0) * Math.max(1, parseInt(system.qty, 10) || 1);
        var typeControl = '<div class="system-select-field"><select class="qi-utype-sel system-select-control" onchange="updateRoomSystem(' + i + ',\'' + system.id + '\',\'unitType\',this.value)">' + typeOpts + '</select></div>';
        return '' +
          '<div class="mixed-system-row">' +
            '<div class="mixed-system-grid">' +
              '<div class="proj-input-group mixed-field mixed-field-type"><div class="qi-plbl">' + t('mixedtype') + '</div>' + typeControl + '</div>' +
              '<div class="proj-input-group mixed-field mixed-field-qty"><div class="qi-plbl">' + t('mixedqty') + '</div><div class="mixed-qty-stepper"><button type="button" class="qbtn" onclick="decrementSystemQty(' + i + ',\'' + system.id + '\')">-</button><input class="mixed-qty-value" type="text" readonly value="' + system.qty + '"><button type="button" class="qbtn" onclick="incrementSystemQty(' + i + ',\'' + system.id + '\')">+</button></div></div>' +
              '<div class="proj-input-group mixed-field mixed-field-capacity"><div class="qi-plbl">' + t('mixedcapacity') + '</div><div class="system-select-field"><select class="qi-cap-sel system-select-control" onchange="updateRoomSystem(' + i + ',\'' + system.id + '\',\'selectedBtu\',this.value)">' + capOpts + '</select></div></div>' +
              '<div class="proj-input-group mixed-field mixed-field-total"><div class="qi-plbl">' + t('mixedtotalcapacity') + '</div><div class="mixed-total-remove-row"><div class="ninput mixed-total-display" style="display:flex;align-items:center">' + Number(totalSelected).toLocaleString() + ' BTU/h</div><button type="button" class="mixed-system-remove" onclick="removeRoomSystem(' + i + ',\'' + system.id + '\')">' + t('mixedremove') + '</button></div></div>' +
            '</div>' +
          '</div>';
      }).join('');
      var diffLabel = diffVal < 0
        ? (lang === 'ar'
            ? 'السعة المختارة أقل من المطلوب بمقدار ' + Number(Math.abs(diffVal) || 0).toLocaleString() + ' BTU/h'
            : 'Selected capacity is short by ' + Number(Math.abs(diffVal) || 0).toLocaleString() + ' BTU/h')
        : (lang === 'ar'
            ? 'السعة المختارة أعلى من المطلوب بمقدار ' + Number(diffVal || 0).toLocaleString() + ' BTU/h'
            : 'Selected capacity exceeds required load by ' + Number(diffVal || 0).toLocaleString() + ' BTU/h');
      var statusHtml = '<div class="qi-cap-status"><span class="qi-cap-badge ' + status.css + '">' + status.label + (status.key !== 'no_system_selected' ? ' ' + status.deltaText : '') + '</span></div>';
      var statusNoteHtml = '<div class="qty-auto-note" style="margin-top:6px">' + (status.key === 'no_system_selected' ? status.label : diffLabel) + '</div>';
      var airflowSummaryHtml = '';
      if (roomState.isHealthcare) {
        var airflowStatus = roomState.airflowStatusMeta || getAirflowStatus(roomState.requiredCfm, roomState.selectedSystemCfm);
        var airflowDiff = roomState.airflowDifference;
        var airflowDiffLabel = airflowDiff < 0
          ? (lang === 'ar'
              ? 'تدفق الهواء المختار أقل من المطلوب بمقدار ' + Number(Math.abs(airflowDiff) || 0).toLocaleString() + ' CFM'
              : 'Selected airflow is short by ' + Number(Math.abs(airflowDiff) || 0).toLocaleString() + ' CFM')
          : (lang === 'ar'
              ? 'تدفق الهواء المختار أعلى من المطلوب بمقدار ' + Number(airflowDiff || 0).toLocaleString() + ' CFM'
              : 'Selected airflow exceeds required airflow by ' + Number(airflowDiff || 0).toLocaleString() + ' CFM');
        var pressureText = roomState.pressureRequirement
          ? (lang === 'ar' ? 'متطلب الضغط: ' : 'Pressure requirement: ') + roomState.pressureRequirement
          : '';
        airflowSummaryHtml =
          '<div class="mixed-system-total"><span class="mixed-system-total-label">' + (lang === 'ar' ? 'التدفق المطلوب' : 'Required CFM') + '</span><span>' + Number(roomState.requiredCfm || 0).toLocaleString() + ' CFM</span></div>' +
          '<div class="mixed-system-total"><span class="mixed-system-total-label">' + (lang === 'ar' ? 'تدفق الوحدات المختارة' : 'Selected System CFM') + '</span><span>' + Number(roomState.selectedSystemCfm || 0).toLocaleString() + ' CFM</span></div>' +
          '<div class="mixed-system-total"><span class="mixed-system-total-label">' + (lang === 'ar' ? 'حالة تدفق الهواء' : 'Airflow Status') + '</span><span class="qi-cap-badge ' + airflowStatus.css + '">' + airflowStatus.label + (airflowStatus.key !== 'no_system_selected' ? ' ' + airflowStatus.deltaText : '') + '</span></div>' +
          '<div class="qty-auto-note" style="margin-top:6px">' + (airflowStatus.key === 'no_system_selected' ? airflowStatus.label : airflowDiffLabel) + (pressureText ? '<br>' + pressureText : '') + '</div>';
      }
      return '' +
        '<div class="mixed-systems-card room-mixed-systems">' +
          '<div class="mixed-systems-head">' +
            '<div class="mixed-systems-title">' + t('mixedsystems') + '</div>' +
          '</div>' +
          '<div class="mixed-systems-list">' +
            (rowsHtml || '<div class="mixed-systems-empty">' + t('mixedempty') + '</div>') +
          '</div>' +
          '<div class="mixed-systems-actions mixed-systems-add-row"><button type="button" class="mixed-systems-btn primary" onclick="addRoomSystem(' + i + ')" aria-label="' + t('mixedadd') + '">' + t('mixedadd') + '</button></div>' +
          '<div class="mixed-system-foot" style="margin-top:10px">' +
            '<div class="mixed-system-total"><span class="mixed-system-total-label">' + t('mixedrequiredcapacity') + '</span><span>' + Number(requiredVal || 0).toLocaleString() + ' BTU/h</span></div>' +
            '<div class="mixed-system-total"><span class="mixed-system-total-label">' + t('mixedselectedtotal') + '</span><span>' + Number(selectedCapacity || 0).toLocaleString() + ' BTU/h</span></div>' +
            '<div class="mixed-system-total"><span class="mixed-system-total-label">' + t('mixeddifference') + '</span><span>' + (diffVal >= 0 ? '+' : '') + Number(diffVal || 0).toLocaleString() + ' BTU/h</span></div>' +
          '</div>' +
          statusHtml +
          statusNoteHtml +
          airflowSummaryHtml +
        '</div>';
    }

    function setQuoteMode(mode) {
      mode = setSharedQuoteMode(mode);
      var btnRoom = G('mode-btn-room'), btnProj = G('mode-btn-proj');
      var qiList = G('qi-list'), projBlock = G('proj-block');
      var bundleRow = G('bundle-row');
      if (mode === 'proj') {
        if (btnRoom) btnRoom.classList.remove('active');
        if (btnProj) btnProj.classList.add('active');
        if (qiList) qiList.style.display = 'none';
        if (projBlock) projBlock.style.display = '';
        if (bundleRow) bundleRow.style.display = '';
      } else {
        if (btnRoom) btnRoom.classList.add('active');
        if (btnProj) btnProj.classList.remove('active');
        if (qiList) qiList.style.display = '';
        if (projBlock) projBlock.style.display = 'none';
        if (bundleRow) bundleRow.style.display = hist.length > 1 ? '' : 'none';
      }
      if (typeof _updateBundleUI === 'function') _updateBundleUI();
      refreshModeDependentUi();
    }

    window.normalizeQuoteMode = normalizeQuoteMode;
    window.setSharedQuoteMode = setSharedQuoteMode;
    window.refreshModeDependentUi = refreshModeDependentUi;
    window.getRoomRequiredBtu = getRoomRequiredBtu;
    window.getRoomRequiredCfm = getRoomRequiredCfm;
    window.getUnitAirflowCfm = getUnitAirflowCfm;
    window.getCapacityStatus = getCapacityStatus;
    window.getSystemCapacityStatus = getCapacityStatus;
    window.getAirflowStatus = getAirflowStatus;
    window.getRoomSystemState = getRoomSystemState;
    window.syncRoomSystemState = syncRoomSystemState;
    window.syncAllRoomSystemStates = syncAllRoomSystemStates;
    window.recalcRoomSystems = recalcRoomSystems;
    window.renderRoomSystemsEditor = renderRoomSystemsEditor;
    window.setQuoteMode = setQuoteMode;
  }

  // ── Boot sequence ────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function() {
    console.log('[AirCalc] main.js DOMContentLoaded — starting boot');
    installRuntimePatches();

    // 1. Fetch and validate data.json
    loadAppBootstrapData()
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
