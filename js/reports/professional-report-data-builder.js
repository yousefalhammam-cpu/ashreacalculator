(function (root) {
  'use strict';

  function text(value, fallback) {
    var out = value == null ? '' : String(value).trim();
    return out || (fallback || '');
  }

  function number(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : (fallback || 0);
  }

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value == null ? null : value));
    } catch (_err) {
      return null;
    }
  }

  function readElementValue(id, fallback) {
    if (!root.document || !root.document.getElementById) return fallback || '';
    var el = root.document.getElementById(id);
    return el && typeof el.value !== 'undefined' ? text(el.value, fallback) : (fallback || '');
  }

  function readLocalStorageJson(key) {
    try {
      if (!root.localStorage || typeof root.localStorage.getItem !== 'function') return null;
      var raw = root.localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (_err) {
      return null;
    }
  }

  function callNumber(fnName, fallback) {
    try {
      if (typeof root[fnName] === 'function') return number(root[fnName](), fallback);
    } catch (_err) {}
    return fallback || 0;
  }

  function callObject(fnName, fallback) {
    try {
      if (typeof root[fnName] === 'function') {
        var value = root[fnName]();
        return value && typeof value === 'object' ? value : (fallback || {});
      }
    } catch (_err) {}
    return fallback || {};
  }

  function formatReportReference(projectNo) {
    var base = text(projectNo, 'Q-001').replace(/[^a-zA-Z0-9_-]/g, '-');
    var stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return 'ACP-TR-' + base + '-' + stamp;
  }

  function getLanguage(options) {
    var pref = text(options && options.language, '');
    if (pref === 'ar' || pref === 'en') return pref;
    var globalLang = text(root.lang || (root.AppState && root.AppState.lang), 'ar');
    return globalLang === 'en' ? 'en' : 'ar';
  }

  function roomName(room, lang, index) {
    return text(lang === 'ar' ? (room.ar || room.en) : (room.en || room.ar), lang === 'ar' ? ('غرفة ' + (index + 1)) : ('Room ' + (index + 1)));
  }

  function roomCount(room) {
    return Math.max(1, parseInt(room.roomCount, 10) || 1);
  }

  function readRoomRequiredBtu(room, index) {
    var fromFn = callNumber('getQuoteRequiredBtu', 0);
    if (typeof root.getQuoteRequiredBtu === 'function') {
      try {
        fromFn = number(root.getQuoteRequiredBtu(index), 0);
      } catch (_err) {
        fromFn = 0;
      }
    }
    return fromFn || number(room.requiredBtuH || room.requiredBtu || room.btu || room.loadBtuH || room.load || 0, 0);
  }

  function readRoomSupplyCfm(room, index) {
    if (typeof root.getRoomRequiredCfm === 'function') {
      try {
        var cfm = number(root.getRoomRequiredCfm(index), 0);
        if (cfm > 0) return cfm;
      } catch (_err) {}
    }
    return number(room.requiredCfm || room.cfm || room.supplyCfm || 0, 0) * roomCount(room);
  }

  function readRoomSystemState(index) {
    if (typeof root.getRoomSystemState === 'function') {
      try {
        return root.getRoomSystemState(index) || {};
      } catch (_err) {}
    }
    return {};
  }

  function buildRooms(hist, lang) {
    return hist.map(function (room, index) {
      var count = roomCount(room);
      var requiredBtu = readRoomRequiredBtu(room, index);
      var supplyCfm = readRoomSupplyCfm(room, index);
      var state = readRoomSystemState(index);
      var selectedCapacity = number(state.selectedCapacityBtu || room.selectedBtu || 0, 0);
      return {
        index: index + 1,
        name: roomName(room, lang, index),
        roomType: text(room.roomType || room.category || room.rid, ''),
        quantity: count,
        areaM2: number(room.area || room.areaM2 || room.m2 || 0, 0),
        coolingLoadBtuH: requiredBtu,
        coolingLoadTr: requiredBtu / 12000,
        selectedCapacityBtuH: selectedCapacity,
        supplyCfm: supplyCfm,
        outdoorAirCfm: number(room.oa || room.outdoorAirCfm || 0, 0) * count,
        exhaustCfm: number(room.exh || room.exhaust || room.exhaustCfm || 0, 0) * count,
        totalAch: number(room.ach || room.totalAch || 0, 0),
        outdoorAirAch: number(room.oaAch || room.outdoorAirAch || 0, 0),
        pressureRelationship: text(room.pressure || room.pres || room.pressureRelationship, ''),
        temperatureRangeC: clone(room.tempRange || room.tr || null),
        humidityRangeRh: clone(room.rhRange || room.rh || null),
        assignedSystem: clone(state.systems || room.systems || [])
      };
    });
  }

  function summarizeRooms(rooms) {
    return rooms.reduce(function (acc, room) {
      acc.roomCount += room.quantity || 1;
      acc.coolingLoadBtuH += number(room.coolingLoadBtuH, 0);
      acc.supplyCfm += number(room.supplyCfm, 0);
      acc.outdoorAirCfm += number(room.outdoorAirCfm, 0);
      acc.exhaustCfm += number(room.exhaustCfm, 0);
      acc.selectedCapacityBtuH += number(room.selectedCapacityBtuH, 0);
      return acc;
    }, {
      roomCount: 0,
      coolingLoadBtuH: 0,
      coolingLoadTr: 0,
      supplyCfm: 0,
      outdoorAirCfm: 0,
      exhaustCfm: 0,
      selectedCapacityBtuH: 0,
      selectedCapacityTr: 0
    });
  }

  function buildValidationSummary() {
    var validation = callObject('getProjectEngineeringValidation', {});
    var items = Array.isArray(validation.items) ? validation.items : [];
    var critical = items.filter(function (item) { return item && (item.status === 'fail' || item.status === 'critical'); }).length;
    var warnings = items.filter(function (item) { return item && (item.status === 'warning' || item.status === 'review'); }).length;
    return {
      source: 'rules_engine',
      status: critical ? 'blocked' : (warnings ? 'review' : 'ready'),
      criticalCount: critical,
      warningCount: warnings,
      items: clone(items) || []
    };
  }

  function buildEquipmentSnapshot() {
    var snap = readLocalStorageJson('aircalc_last_selected_equipment_snapshot');
    if (!snap) return null;
    var option = snap.selectionOption || {};
    var record = snap.record || option.record || {};
    var equipmentType = text(record.equipmentType || '');
    var quantity = Math.max(1, parseInt(option.quantity || option.activeQuantity || 1, 10) || 1);
    var hasCoolingCapacity = !!(option.totalCapacityBtuH || record.coolingCapacityBtuH);
    var isAirflowOnlyAhu = equipmentType.toLowerCase() === 'ahu' && !hasCoolingCapacity;
    return {
      snapshotTime: text(snap.snapshotTime || snap.createdAt || ''),
      selectedAt: text(snap.selectedAt || snap.snapshotTime || snap.createdAt || ''),
      manufacturerName: text(record.manufacturerName || ''),
      exactModelNumber: text(record.exactModelNumber || ''),
      equipmentType: equipmentType,
      catalogueStatus: text(record.verificationStatus || ''),
      saudiMarketStatus: text(record.saudiMarketStatus || ''),
      sourceReference: text(record.sourceReference || record.sourceDocumentName || snap.source || ''),
      sourceDocumentName: text(record.sourceDocumentName || ''),
      sampleData: record.sampleData === true,
      quantity: quantity,
      totalCapacityBtuH: isAirflowOnlyAhu ? null : number(option.totalCapacityBtuH || ((record.coolingCapacityBtuH || 0) * quantity), 0),
      coolingCapacityStatus: isAirflowOnlyAhu ? 'coil_submittal_required' : 'catalogue_capacity',
      totalAirflowCfm: number(option.totalAirflowCfm || record.airflowNominalCfm || record.airflowMaxCfm || 0, 0),
      availableEspPa: option.availableEspPa == null ? number(record.availableEspPa || 0, 0) : number(option.availableEspPa, 0),
      voltage: text(record.voltage || ''),
      phase: text(record.phase || ''),
      frequencyHz: text(record.frequencyHz || ''),
      sensibleCapacityBtuH: record.sensibleCapacityBtuH == null ? null : number(record.sensibleCapacityBtuH, 0),
      maxOutdoorTemperatureC: record.maxOutdoorTemperatureC == null ? null : number(record.maxOutdoorTemperatureC, 0),
      requirements: clone(option.selectionRequirements || {}) || {},
      preBindReview: clone(option.preBindReview || null),
      engineerVerificationRequired: clone(option.engineerVerificationRequired || []) || []
    };
  }

  function normalizeDuctSection(section) {
    if (!section || typeof section !== 'object') return null;
    return {
      widthMm: number(section.w || section.widthMm || 0, 0),
      heightMm: number(section.h || section.heightMm || 0, 0),
      actualVelocityFpm: number(section.actualFpm || section.velocityFpm || 0, 0),
      areaActualMm2: number(section.area_actual || section.areaActualMm2 || 0, 0),
      areaRequiredMm2: number(section.area_required || section.areaRequiredMm2 || 0, 0),
      method: text(section.method || '')
    };
  }

  function buildDuctAndEspSummary() {
    var duct = root._lastDuctSizing && typeof root._lastDuctSizing === 'object' ? root._lastDuctSizing : null;
    var esp = root._lastEspCalc && typeof root._lastEspCalc === 'object' ? root._lastEspCalc : null;
    return {
      source: 'rules_engine',
      ductSizingAvailable: !!duct,
      sizingBasis: duct ? text(duct.basis || root._ductBasis || 'required') : '',
      designCfm: duct ? number(duct.qDesign || duct.cfm || duct.Q_cfm || 0, 0) : 0,
      supplyDuct: duct ? normalizeDuctSection(duct.sup || duct.supply || duct.supplyDuct) : null,
      returnDuct: duct ? normalizeDuctSection(duct.ret || duct.return || duct.returnDuct) : null,
      espAvailable: !!esp,
      totalEspPa: esp ? number(esp.totalPa || esp.total || 0, 0) : 0,
      totalEspInWg: esp ? number(esp.totalInwg || esp.totalInWg || 0, 0) : 0,
      frictionPa: esp ? number(esp.frictionPa || esp.straightFrictionPa || esp.friction || 0, 0) : 0,
      fittingLossPa: esp ? number(esp.fittingLossPa || esp.fittingsPa || esp.fittings || 0, 0) : 0,
      adderLossPa: esp ? number(esp.adderLossPa || esp.addersPa || esp.adders || 0, 0) : 0,
      status: esp && esp.status ? clone(esp.status) : null
    };
  }

  function buildProfessionalReportData(options) {
    options = options || {};
    var lang = getLanguage(options);
    var hist = Array.isArray(options.hist) ? options.hist : (Array.isArray(root.hist) ? root.hist : []);
    var firstRoom = hist[0] || {};
    var rooms = buildRooms(hist, lang);
    var totals = summarizeRooms(rooms);
    totals.coolingLoadTr = totals.coolingLoadBtuH / 12000;
    var projectSelectedBtu = callNumber('getSelectedProjectEquipmentBtu', totals.selectedCapacityBtuH);
    var projectSelectedCfm = callNumber('getSelectedProjectEquipmentCfm', 0);
    if (projectSelectedBtu > 0) totals.selectedCapacityBtuH = projectSelectedBtu;
    totals.selectedCapacityTr = totals.selectedCapacityBtuH / 12000;

    var projectNo = text(options.projectNo || readElementValue('tech-no', '') || readElementValue('quote-no', ''), 'Q-001');
    var validation = buildValidationSummary();
    var equipmentSnapshot = buildEquipmentSnapshot();
    var healthScore = root.AirCalcEngineeringAgent && typeof root.AirCalcEngineeringAgent.calculateHealthScore === 'function'
      ? number(root.AirCalcEngineeringAgent.calculateHealthScore(), 0)
      : Math.max(0, 100 - (validation.criticalCount * 25) - (validation.warningCount * 10));

    return {
      schemaVersion: 'professional-report-data-v1',
      sourceOfTruth: 'rules_engine',
      generatedAt: new Date().toISOString(),
      language: lang,
      direction: lang === 'ar' ? 'rtl' : 'ltr',
      identity: {
        projectName: text(options.projectName || readElementValue('tech-project', '') || readElementValue('quote-project', ''), lang === 'ar' ? 'غير محدد' : 'Untitled'),
        projectNo: projectNo,
        clientName: text(options.clientName || readElementValue('report-client', ''), ''),
        location: text(options.location || readElementValue('report-location', ''), ''),
        city: text(options.city || (lang === 'ar' ? firstRoom.cityLabelAr : firstRoom.cityLabelEn) || firstRoom.city || ''),
        buildingType: text(options.buildingType || firstRoom.category || firstRoom.roomType || firstRoom.en || firstRoom.ar || ''),
        engineer: text(options.engineer || readElementValue('report-engineer', '') || readElementValue('designer-name', '') || readElementValue('project-engineer', ''), ''),
        designer: text(options.designer || readElementValue('report-designer', ''), ''),
        date: text(options.date || new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US'), ''),
        reportReference: text(options.reportReference || (typeof root.getReportReferenceNumber === 'function' ? root.getReportReferenceNumber(projectNo) : ''), formatReportReference(projectNo))
      },
      summary: {
        roomCount: totals.roomCount,
        coolingLoadBtuH: totals.coolingLoadBtuH,
        coolingLoadTr: totals.coolingLoadTr,
        supplyCfm: totals.supplyCfm,
        outdoorAirCfm: totals.outdoorAirCfm,
        exhaustCfm: totals.exhaustCfm,
        selectedCapacityBtuH: totals.selectedCapacityBtuH,
        selectedCapacityTr: totals.selectedCapacityTr,
        selectedSupplyCfm: projectSelectedCfm,
        engineeringHealthScore: healthScore
      },
      rooms: rooms,
      validation: validation,
      ductAndEsp: buildDuctAndEspSummary(),
      equipmentSnapshot: equipmentSnapshot,
      engineeringNotes: validation.items.map(function (item) {
        return {
          status: text(item.status || item.priority || ''),
          code: text(item.code || item.id || ''),
          message: text(lang === 'ar' ? (item.arText || item.text) : (item.text || item.arText), '')
        };
      }).filter(function (item) { return item.message; }),
      aiPolicy: {
        sourceOfTruth: 'rules_engine',
        aiRole: 'explain_only',
        aiGeneratesEngineeringNumbers: false
      }
    };
  }

  var api = {
    buildProfessionalReportData: buildProfessionalReportData,
    _internals: {
      formatReportReference: formatReportReference,
      summarizeRooms: summarizeRooms
    }
  };

  root.AirCalcProfessionalReportData = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
