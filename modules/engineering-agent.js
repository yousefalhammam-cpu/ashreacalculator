(function () {
  'use strict';

  function clone(value) {
    if (value == null) return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_err) {
      return value;
    }
  }

  function getGlobalArray(name) {
    return Array.isArray(window[name]) ? window[name] : [];
  }

  function getGlobalObject(name) {
    var value = window[name];
    return value && typeof value === 'object' ? value : {};
  }

  function getEngineeringValidationThresholds() {
    var engine = window.AirCalcEngineering;
    return (engine && engine.VALIDATION_THRESHOLDS) || {
      MATCH_MAX_OVERSIZE_PCT: 10,
      GENERAL_OVERSIZE_HIGH_PCT: 25,
      ESP_LOW_MAX_PA: 125,
      ESP_VALIDATION_REVIEW_MAX_PA: 225
    };
  }

  function getEngineeringSourceStatus() {
    var knowledge = window.AirCalcEngineeringKnowledge;
    if (knowledge && typeof knowledge.getDataSourceStatus === 'function') {
      return knowledge.getDataSourceStatus();
    }
    return getGlobalObject('ENGINEERING_SOURCE_STATUS');
  }

  function callNumber(fnName, fallback) {
    try {
      if (typeof window[fnName] === 'function') {
        var value = Number(window[fnName]());
        return isFinite(value) ? value : (fallback || 0);
      }
    } catch (_err) {}
    return fallback || 0;
  }

  function callObject(fnName, fallback) {
    try {
      if (typeof window[fnName] === 'function') {
        var value = window[fnName]();
        return value && typeof value === 'object' ? value : (fallback || {});
      }
    } catch (_err) {}
    return fallback || {};
  }

  function normalizeStatus(status) {
    if (status === 'pass' || status === 'ok') return 'ok';
    if (status === 'fail' || status === 'critical') return 'critical';
    if (status === 'warning' || status === 'review') return 'warning';
    if (status === 'not_applicable') return 'ok';
    if (status === 'needs_input' || status === 'missing') return 'needs_input';
    return 'warning';
  }

  function statusWeight(status) {
    var normalized = normalizeStatus(status);
    if (normalized === 'critical') return 4;
    if (normalized === 'needs_input') return 3;
    if (normalized === 'warning') return 2;
    return 1;
  }

  function actionKey(action) {
    if (action && action.agentGeneric) {
      return String(action.text || action.arText || '');
    }
    return [
      action.scope || '',
      action.roomId || '',
      action.code || '',
      action.text || ''
    ].join('|');
  }

  function pushAction(actions, seen, action) {
    if (!action || !action.text) return;
    var key = actionKey(action);
    if (seen[key]) return;
    seen[key] = true;
    actions.push(action);
  }

  function percentDifference(required, selected) {
    required = Number(required) || 0;
    selected = Number(selected) || 0;
    if (required <= 0 || selected <= 0) return null;
    return ((selected - required) / required) * 100;
  }

  function readEquipmentSelectionSnapshot() {
    try {
      var raw = window.localStorage && window.localStorage.getItem('aircalc_last_selected_equipment_snapshot');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function getCurrentEquipmentRecord(id) {
    try {
      if (!id || !window.AppEquipmentDatabase || typeof window.AppEquipmentDatabase.allRecords !== 'function') return null;
      var records = window.AppEquipmentDatabase.allRecords() || [];
      return records.filter(function (record) { return record && record.id === id; })[0] || null;
    } catch (e) {
      return null;
    }
  }

  function equipmentSelectionNumbers(equipmentSelection) {
    equipmentSelection = equipmentSelection || {};
    var option = equipmentSelection.selectionOption || {};
    var record = equipmentSelection.record || option.record || {};
    var qty = Number(option.quantity || option.activeQuantity || 1) || 1;
    return {
      option: option,
      record: record,
      requirements: option.selectionRequirements || {},
      totalCapacityBtuH: Number(option.totalCapacityBtuH || ((record.coolingCapacityBtuH || 0) * qty)) || 0,
      totalAirflowCfm: Number(option.totalAirflowCfm || ((record.airflowNominalCfm || record.airflowMaxCfm || 0) * qty)) || 0,
      availableEspPa: option.availableEspPa == null ? (record.availableEspPa == null ? null : Number(record.availableEspPa)) : Number(option.availableEspPa)
    };
  }

  function pushEquipmentSelectionActions(actions, seen, snapshot, thresholds) {
    var equipmentSelection = snapshot && snapshot.equipmentSelection;
    if (!equipmentSelection) return;

    var data = equipmentSelectionNumbers(equipmentSelection);
    var record = data.record || {};
    var option = data.option || {};
    var req = data.requirements || {};
    var totals = snapshot.totals || {};
    var savedRequiredBtu = Number(req.requiredCoolingLoadBtuH) || 0;
    var savedRequiredCfm = Number(req.requiredSupplyCfm) || 0;
    var currentRequiredBtu = Number(totals.requiredBtu) || 0;
    var currentRequiredCfm = Number(totals.requiredCfm) || 0;
    var currentRequiredEspPa = window._lastEspCalc && window._lastEspCalc.totalPa != null ? Number(window._lastEspCalc.totalPa) : null;
    var requiredBtu = currentRequiredBtu || savedRequiredBtu;
    var requiredCfm = currentRequiredCfm || savedRequiredCfm;
    var requiredEspPa = currentRequiredEspPa != null && currentRequiredEspPa > 0 ? currentRequiredEspPa : (req.requiredEspPa == null ? null : Number(req.requiredEspPa));
    var modelLabel = [record.manufacturerName, record.exactModelNumber].filter(Boolean).join(' ') || 'Selected equipment';

    var loadRequirementChanged = savedRequiredBtu && currentRequiredBtu && Math.abs(percentDifference(savedRequiredBtu, currentRequiredBtu) || 0) > 2;
    var cfmRequirementChanged = savedRequiredCfm && currentRequiredCfm && Math.abs(percentDifference(savedRequiredCfm, currentRequiredCfm) || 0) > 2;
    var espRequirementChanged = req.requiredEspPa != null && currentRequiredEspPa != null && Math.abs(Number(req.requiredEspPa) - Number(currentRequiredEspPa)) > 5;
    if (loadRequirementChanged || cfmRequirementChanged || espRequirementChanged) {
      pushAction(actions, seen, {
        priority: 'warning',
        scope: 'project',
        code: 'equipment_selection_requirements_changed',
        text: modelLabel + ' was selected against older project requirements; re-run equipment selection before approval.',
        arText: 'تم اختيار ' + modelLabel + ' بناءً على متطلبات مشروع قديمة؛ أعد تشغيل اختيار الوحدة قبل الاعتماد.'
      });
    }

    if (record.sampleData) {
      pushAction(actions, seen, {
        priority: 'critical',
        scope: 'project',
        code: 'equipment_sample_data_selected',
        text: modelLabel + ' is marked as sample data and cannot be used for professional approval.',
        arText: modelLabel + ' مسجل كبيانات تجريبية ولا يصلح للاعتماد المهني.'
      });
    }

    if (record.discontinued) {
      pushAction(actions, seen, {
        priority: 'critical',
        scope: 'project',
        code: 'equipment_discontinued',
        text: modelLabel + ' is marked as discontinued; select an active catalogue model.',
        arText: modelLabel + ' مسجل كموديل متوقف؛ اختر موديل كتالوج فعال.'
      });
    }

    var capacityDiff = percentDifference(requiredBtu, data.totalCapacityBtuH);
    if (capacityDiff !== null && capacityDiff < -5) {
      pushAction(actions, seen, {
        priority: 'critical',
        scope: 'project',
        code: 'equipment_capacity_below_project_load',
        text: modelLabel + ' snapshot capacity is ' + Math.abs(capacityDiff).toFixed(1) + '% below project load.',
        arText: 'سعة ' + modelLabel + ' في snapshot أقل من حمل المشروع بنسبة ' + Math.abs(capacityDiff).toFixed(1) + '%.'
      });
    } else if (capacityDiff !== null && capacityDiff > thresholds.GENERAL_OVERSIZE_HIGH_PCT) {
      pushAction(actions, seen, {
        priority: 'warning',
        scope: 'project',
        code: 'equipment_capacity_above_project_load',
        text: modelLabel + ' snapshot capacity is ' + capacityDiff.toFixed(1) + '% above project load; review staging and humidity control.',
        arText: 'سعة ' + modelLabel + ' في snapshot أعلى من حمل المشروع بنسبة ' + capacityDiff.toFixed(1) + '%؛ راجع التدرج والتحكم بالرطوبة.'
      });
    }

    var airflowDiff = percentDifference(requiredCfm, data.totalAirflowCfm);
    if (airflowDiff !== null && airflowDiff < -thresholds.MATCH_MAX_OVERSIZE_PCT) {
      pushAction(actions, seen, {
        priority: 'warning',
        scope: 'project',
        code: 'equipment_airflow_below_project_requirement',
        text: modelLabel + ' catalogue airflow is ' + Math.abs(airflowDiff).toFixed(1) + '% below project CFM; verify distribution or select another unit.',
        arText: 'تدفق هواء ' + modelLabel + ' في الكتالوج أقل من CFM المشروع بنسبة ' + Math.abs(airflowDiff).toFixed(1) + '%؛ راجع التوزيع أو اختر وحدة أخرى.'
      });
    }

    if (requiredEspPa != null && requiredEspPa > 0 && data.availableEspPa != null && data.availableEspPa < requiredEspPa) {
      pushAction(actions, seen, {
        priority: 'critical',
        scope: 'project',
        code: 'equipment_esp_below_project_requirement',
        text: modelLabel + ' available ESP is below the project ESP requirement.',
        arText: 'ESP المتاح في ' + modelLabel + ' أقل من متطلب ESP للمشروع.'
      });
    }

    ['voltage', 'phase', 'frequencyHz'].forEach(function (field) {
      if (req[field] != null && record[field] != null && Number(req[field]) !== Number(record[field])) {
        pushAction(actions, seen, {
          priority: 'critical',
          scope: 'project',
          code: 'equipment_electrical_mismatch_' + field,
          text: modelLabel + ' electrical ' + field + ' does not match the project requirement.',
          arText: 'القيمة الكهربائية ' + field + ' في ' + modelLabel + ' لا تطابق متطلب المشروع.'
        });
      }
    });

    if (record.verificationStatus !== 'verified' && record.verificationStatus !== 'published') {
      pushAction(actions, seen, {
        priority: 'warning',
        scope: 'project',
        code: 'equipment_catalogue_not_verified',
        text: modelLabel + ' catalogue data is not verified; confirm the source document before approval.',
        arText: 'بيانات كتالوج ' + modelLabel + ' غير موثقة؛ أكد مصدر الكتالوج قبل الاعتماد.'
      });
    }

    if (record.sensibleCapacityBtuH == null) {
      pushAction(actions, seen, {
        priority: 'warning',
        scope: 'project',
        code: 'equipment_sensible_capacity_missing',
        text: modelLabel + ' is missing sensible capacity data; review SHR/latent performance before final approval.',
        arText: modelLabel + ' لا يحتوي على سعة sensible؛ راجع SHR والأداء الكامن قبل الاعتماد النهائي.'
      });
    }

    if (record.maxOutdoorTemperatureC == null) {
      pushAction(actions, seen, {
        priority: 'warning',
        scope: 'project',
        code: 'equipment_outdoor_temperature_missing',
        text: modelLabel + ' is missing maximum outdoor operating temperature; confirm suitability for design conditions.',
        arText: modelLabel + ' لا يحتوي على أقصى درجة حرارة خارجية للتشغيل؛ أكد مناسبته لظروف التصميم.'
      });
    }

    if (!record.sourceReference && !record.sourceDocumentName) {
      pushAction(actions, seen, {
        priority: 'warning',
        scope: 'project',
        code: 'equipment_catalogue_source_missing',
        text: modelLabel + ' is missing catalogue source reference.',
        arText: modelLabel + ' لا يحتوي على مرجع مصدر الكتالوج.'
      });
    }

    var saudiStatus = String(record.saudiMarketStatus || '').toLowerCase();
    if (!saudiStatus || saudiStatus === 'sample_only' || saudiStatus === 'unknown') {
      pushAction(actions, seen, {
        priority: 'warning',
        scope: 'project',
        code: 'equipment_saudi_availability_review',
        text: modelLabel + ' Saudi/GCC availability requires confirmation before quotation.',
        arText: 'توفر ' + modelLabel + ' في السعودية/الخليج يحتاج تأكيد قبل عرض السعر.'
      });
    }

    if ((option.engineerVerificationRequired || []).length) {
      pushAction(actions, seen, {
        priority: 'warning',
        scope: 'project',
        code: 'equipment_selection_engine_notes',
        text: 'Equipment selector requires engineer review: ' + option.engineerVerificationRequired.join(' | '),
        arText: 'محرك اختيار المعدات يتطلب مراجعة مهندس: ' + option.engineerVerificationRequired.join(' | '),
        agentGeneric: true
      });
    }

    var currentRecord = getCurrentEquipmentRecord(record.id);
    if (currentRecord && record.updatedAt && currentRecord.updatedAt && String(currentRecord.updatedAt) > String(record.updatedAt)) {
      pushAction(actions, seen, {
        priority: 'warning',
        scope: 'project',
        code: 'equipment_snapshot_outdated',
        text: modelLabel + ' snapshot is older than the current equipment database record; re-run selection before approval.',
        arText: 'snapshot الخاص بـ ' + modelLabel + ' أقدم من سجل قاعدة المعدات الحالي؛ أعد تشغيل الاختيار قبل الاعتماد.'
      });
    }
  }

  function isDuctedUnitType(unitType) {
    unitType = String(unitType || '').toLowerCase();
    return ['ducted', 'package', 'vrf', 'fcu', 'ahu', 'chiller_air', 'chiller_water', 'chillerfcu', 'chiller'].indexOf(unitType) >= 0;
  }

  function roomHasDuctedSystem(room) {
    return Array.isArray(room.systems) && room.systems.some(function (system) {
      return isDuctedUnitType(system && system.unitType);
    });
  }

  function getProjectSystemType(projectState) {
    try {
      var node = document.getElementById('proj-systype');
      if (node && node.value) return node.value;
    } catch (_err) {}
    return (projectState && projectState.sysType) || 'split';
  }

  function isCfmValidationItem(item, index) {
    var title = String((item && item.title) || '').toLowerCase();
    return index === 1 || title.indexOf('cfm') >= 0 || title.indexOf('airflow') >= 0 || title.indexOf('تدفق') >= 0;
  }

  function downgradeNonDuctedCfmItems(items, isDucted, selectedCfm) {
    if (isDucted) return items;
    return (items || []).map(function (item, index) {
      if (!item || !isCfmValidationItem(item, index)) return item;
      if (normalizeStatus(item.status) !== 'critical') return item;

      var copy = clone(item);
      copy.status = 'warning';
      copy.badgeEn = 'Review';
      copy.badgeAr = 'مراجعة';
      copy.detail = 'For non-ducted split systems, capacity is the primary pass/fail check. Use CFM as a manufacturer airflow review item, not as a critical blocker unless ventilation or air distribution proof is required.';
      copy.message = copy.detail;
      copy.agentArText = 'في نظام السبليت غير الدكت، السعة BTU هي فحص الاعتماد الأساسي. استخدم CFM كمراجعة لهواء الوحدة من كتالوج الشركة فقط إذا كان مطلوبًا إثبات التهوية أو توزيع الهواء.';
      copy.action = {
        label: 'Guidance',
        text: 'For wall split systems, confirm BTU capacity and room coverage first. Review manufacturer airflow only if the design requires ventilation/distribution proof.'
      };
      return copy;
    });
  }

  function summarizeFindings(items) {
    var summary = {
      ok: 0,
      needs_input: 0,
      warning: 0,
      critical: 0
    };

    (items || []).forEach(function (item) {
      var key = normalizeStatus(item && item.status);
      summary[key] += 1;
    });

    return summary;
  }

  function overallHealth(summary) {
    if (summary.critical > 0) return 'critical';
    if (summary.needs_input > 0) return 'needs_input';
    if (summary.warning > 0) return 'warning';
    return 'ok';
  }

  function mergeSummaries(primary, secondary) {
    primary = primary || {};
    secondary = secondary || {};
    return {
      ok: Number(primary.ok || 0) + Number(secondary.ok || 0),
      needs_input: Number(primary.needs_input || 0) + Number(secondary.needs_input || 0),
      warning: Number(primary.warning || 0) + Number(secondary.warning || 0),
      critical: Number(primary.critical || 0) + Number(secondary.critical || 0)
    };
  }

  function roomLabel(room) {
    return room.roomType || room.en || room.ar || room.rid || 'Room';
  }

  function roomRequiredBtu(index, room) {
    var value = 0;
    try {
      if (typeof window.getRoomRequiredBtu === 'function') {
        value = Number(window.getRoomRequiredBtu(index)) || 0;
      }
    } catch (_err) {}
    return value || Number(room && (room.btu || room.requiredBtu)) || 0;
  }

  function roomRequiredCfm(index, room) {
    var value = 0;
    try {
      if (typeof window.getRoomRequiredCfm === 'function') {
        value = Number(window.getRoomRequiredCfm(index)) || 0;
      }
    } catch (_err) {}
    return value || Number(room && (room.cfm || room.requiredCfm)) || 0;
  }

  function isHealthcare(room) {
    try {
      if (typeof window.isHealthcareRoom === 'function') return !!window.isHealthcareRoom(room);
    } catch (_err) {}
    return !!(room && (room.mode === 'hc' || room.sup || room.ach));
  }

  function buildRoomSnapshot(room, index, qline) {
    var state = {};
    try {
      if (typeof window.getRoomSystemState === 'function') {
        state = window.getRoomSystemState(index) || {};
      }
    } catch (_err) {}

    var assignment = {};
    try {
      if (typeof window.getRoomAssignment === 'function') {
        assignment = window.getRoomAssignment(index) || {};
      }
    } catch (_err2) {}

    var validation = {};
    try {
      if (typeof window.getRoomEngineeringValidation === 'function') {
        validation = window.getRoomEngineeringValidation(index, state) || {};
      }
    } catch (_err3) {}

    var systems = clone(state.systems || []);
    var selectedSystemCfm = Number(state.selectedSystemCfm || room.selectedSystemCfm) || 0;
    var items = downgradeNonDuctedCfmItems(
      Array.isArray(validation.items) ? validation.items : [],
      systems.some(function (system) { return isDuctedUnitType(system && system.unitType); }),
      selectedSystemCfm
    );
    var findingSummary = summarizeFindings(items);

    return {
      id: room.rid || room.id || String(index + 1),
      index: index,
      label: roomLabel(room),
      calculationMode: room.calcMode || (room.mode === 'hc' ? 'hc' : 'rot'),
      isHealthcare: isHealthcare(room),
      volumeM3: Number(room.vol) || 0,
      people: Number(room.peopleCount || room.ppl) || 0,
      requiredBtu: roomRequiredBtu(index, room),
      requiredCfm: roomRequiredCfm(index, room),
      selectedCapacityBtu: Number(state.selectedCapacityBtu || room.selectedCapacityBtu) || 0,
      selectedSystemCfm: selectedSystemCfm,
      systems: systems,
      marketBtu: Number(room.mkt) || 0,
      tr: Number(room.tr) || 0,
      ach: room.ach != null ? Number(room.ach) : null,
      pressure: room.pres || room.pressure || '',
      assignment: clone(assignment),
      quoteLine: clone(qline || {}),
      validation: {
        health: overallHealth(findingSummary),
        summary: findingSummary,
        items: clone(items),
        notes: clone(validation.notes || [])
      }
    };
  }

  function buildEngineeringSnapshot() {
    var hist = getGlobalArray('hist');
    var qlines = getGlobalArray('qlines');
    var rooms = hist.map(function (room, index) {
      return buildRoomSnapshot(room || {}, index, qlines[index] || {});
    });

    var projectState = clone(getGlobalObject('projState'));
    var projectValidation = callObject('getProjectEngineeringValidation', { items: [], notes: [] });

    var totals = {
      rooms: rooms.length,
      healthcareRooms: rooms.filter(function (room) { return room.isHealthcare; }).length,
      requiredBtu: callNumber('getProjectRequiredLoadBtu', rooms.reduce(function (sum, room) { return sum + room.requiredBtu; }, 0)),
      requiredCfm: callNumber('getProjectRequiredLoadCfm', rooms.reduce(function (sum, room) { return sum + room.requiredCfm; }, 0)),
      selectedCapacityBtu: callNumber('getSelectedProjectEquipmentBtu', rooms.reduce(function (sum, room) { return sum + room.selectedCapacityBtu; }, 0)),
      selectedCfm: callNumber('getSelectedProjectEquipmentCfm', rooms.reduce(function (sum, room) { return sum + room.selectedSystemCfm; }, 0))
    };
    totals.requiredTr = totals.requiredBtu / 12000;

    var projectItems = downgradeNonDuctedCfmItems(
      Array.isArray(projectValidation.items) ? projectValidation.items : [],
      isDuctedUnitType(getProjectSystemType(projectState)),
      totals.selectedCfm
    );
    var projectSummary = summarizeFindings(projectItems);

    return {
      version: 'phase-2a',
      generatedAt: new Date().toISOString(),
      quoteMode: window.quoteMode || 'room',
      projectState: projectState,
      totals: totals,
      equipmentSelection: readEquipmentSelectionSnapshot(),
      rooms: rooms,
      validation: {
        health: overallHealth(projectSummary),
        summary: projectSummary,
        items: clone(projectItems),
        notes: clone(projectValidation.notes || [])
      }
    };
  }

  function buildNextActions(snapshot) {
    snapshot = snapshot || buildEngineeringSnapshot();
    var actions = [];
    var seen = {};
    var thresholds = getEngineeringValidationThresholds();
    var sourceStatus = getEngineeringSourceStatus();
    var healthcareSource = sourceStatus.healthcareRoomValues || {};
    var generalSource = sourceStatus.generalRoomLoadFactors || {};

    if (!snapshot.rooms.length) {
      pushAction(actions, seen, {
        priority: 'critical',
        scope: 'project',
        code: 'add_first_room',
        text: 'Add at least one room before engineering validation can be meaningful.',
        arText: 'أضف غرفة واحدة على الأقل قبل أن يصبح التحقق الهندسي مفيدًا.'
      });
    }

    snapshot.rooms.forEach(function (room) {
      if (!room.volumeM3) {
        pushAction(actions, seen, {
          priority: 'needs_input',
          scope: 'room',
          roomId: room.id,
          code: 'missing_room_volume',
          text: 'Enter room dimensions before approving the calculation for ' + room.label + '.',
          arText: 'أدخل أبعاد الغرفة قبل اعتماد الحساب: ' + room.label + '.'
        });
      }

      if (room.people <= 0 && !room.isHealthcare) {
        pushAction(actions, seen, {
          priority: 'needs_input',
          scope: 'room',
          roomId: room.id,
          code: 'missing_people_count',
          text: 'Confirm people count for ' + room.label + ' so sensible load and ventilation assumptions are clear.',
          agentGeneric: true,
          arText: 'أكد عدد الأشخاص للغرفة حتى تكون افتراضات الحمل والتهوية واضحة: ' + room.label + '.'
        });
      }

      if (room.isHealthcare) {
        pushAction(actions, seen, {
          priority: 'warning',
          scope: 'room',
          roomId: room.id,
          code: 'healthcare_review',
          text: 'Review ACH, outdoor air, exhaust, and pressure relationship for ' + room.label + '.',
          arText: 'راجع ACH والهواء الخارجي والعادم وعلاقة الضغط للغرفة: ' + room.label + '.'
        });
        if (healthcareSource.status === 'requires_source_confirmation') {
          pushAction(actions, seen, {
            priority: 'warning',
            scope: 'room',
            roomId: room.id,
            code: 'healthcare_source_confirmation',
            text: 'Confirm the ASHRAE 170 source basis for ' + room.label + ' before final design approval.',
            arText: 'أكد مرجعية ASHRAE 170 للغرفة قبل اعتماد التصميم النهائي: ' + room.label + '.',
            agentGeneric: true
          });
        }
      }

      var capacityDiff = percentDifference(room.requiredBtu, room.selectedCapacityBtu || room.marketBtu);
      if (capacityDiff !== null && capacityDiff < -5) {
        pushAction(actions, seen, {
          priority: 'critical',
          scope: 'room',
          roomId: room.id,
          code: 'room_capacity_undersized',
          text: room.label + ' capacity is ' + Math.abs(capacityDiff).toFixed(1) + '% below required load; select a larger unit or revise assumptions.',
          arText: 'سعة ' + room.label + ' أقل من الحمل المطلوب بنسبة ' + Math.abs(capacityDiff).toFixed(1) + '%؛ اختر وحدة أكبر أو راجع الافتراضات.'
        });
      } else if (capacityDiff !== null && capacityDiff > thresholds.GENERAL_OVERSIZE_HIGH_PCT) {
        pushAction(actions, seen, {
          priority: 'warning',
          scope: 'room',
          roomId: room.id,
          code: 'room_capacity_oversized',
          text: room.label + ' capacity is ' + capacityDiff.toFixed(1) + '% above required load; review short cycling and humidity control.',
          arText: 'سعة ' + room.label + ' أعلى من الحمل المطلوب بنسبة ' + capacityDiff.toFixed(1) + '%؛ راجع احتمالية التشغيل المتقطع والتحكم بالرطوبة.'
        });
      }

      var cfmDiff = percentDifference(room.requiredCfm, room.selectedSystemCfm);
      var roomIsDucted = roomHasDuctedSystem(room);
      if (cfmDiff !== null && cfmDiff < -thresholds.MATCH_MAX_OVERSIZE_PCT && roomIsDucted) {
        pushAction(actions, seen, {
          priority: 'critical',
          scope: 'room',
          roomId: room.id,
          code: 'room_cfm_low',
          text: room.label + ' selected airflow is ' + Math.abs(cfmDiff).toFixed(1) + '% below required CFM; review unit airflow or air distribution.',
          arText: 'تدفق الهواء المختار في ' + room.label + ' أقل من المطلوب بنسبة ' + Math.abs(cfmDiff).toFixed(1) + '%؛ راجع تدفق الوحدة أو توزيع الهواء.'
        });
      } else if (cfmDiff !== null && cfmDiff < -thresholds.MATCH_MAX_OVERSIZE_PCT && !roomIsDucted) {
        pushAction(actions, seen, {
          priority: 'warning',
          scope: 'room',
          roomId: room.id,
          code: 'split_cfm_review',
          text: room.label + ' selected airflow is lower than the estimated CFM. For non-ducted split systems, keep capacity as the primary check and verify manufacturer airflow only if needed.',
          arText: 'تدفق الهواء المختار أقل من CFM التقديري في ' + room.label + '. في السبليت غير الدكت، اعتبر السعة BTU هي الفحص الأساسي وراجع CFM الشركة المصنعة عند الحاجة فقط.',
          agentGeneric: true
        });
      } else if (cfmDiff !== null && cfmDiff > thresholds.GENERAL_OVERSIZE_HIGH_PCT) {
        pushAction(actions, seen, {
          priority: 'warning',
          scope: 'room',
          roomId: room.id,
          code: 'room_cfm_high',
          text: room.label + ' selected airflow is high versus required CFM; review noise, drafts, and diffuser selection.',
          arText: 'تدفق الهواء المختار في ' + room.label + ' أعلى من المطلوب؛ راجع الضوضاء والتيارات واختيار المخارج.'
        });
      }

      if (roomIsDucted) {
        pushAction(actions, seen, {
          priority: 'warning',
          scope: 'room',
          roomId: room.id,
          code: 'ducted_room_review',
          text: 'Review duct velocity and preliminary ESP before approving ducted system for ' + room.label + '.',
          arText: 'راجع سرعة الدكت و ESP المبدئي قبل اعتماد النظام الدكت للغرفة: ' + room.label + '.'
        });
      }

      (room.validation.items || []).forEach(function (item) {
        var normalized = normalizeStatus(item && item.status);
        if (normalized === 'ok') return;
        pushAction(actions, seen, {
          priority: normalized,
          scope: 'room',
          roomId: room.id,
          code: 'room_validation_' + normalized,
          text: (item && (item.detail || item.title)) || ('Review ' + room.label + '.'),
          arText: item && item.agentArText,
          agentGeneric: !!(item && item.agentArText)
        });
      });
    });

    var totals = snapshot.totals || {};
    if ((snapshot.rooms || []).some(function (room) { return !room.isHealthcare; }) && generalSource.status === 'preliminary_app_baseline') {
      pushAction(actions, seen, {
        priority: 'warning',
        scope: 'project',
        code: 'general_load_source_confirmation',
        text: 'General quick-load factors are preliminary app baselines; confirm the project load basis before final design approval.',
        arText: 'عوامل الحمل العامة تقديرية أولية؛ أكد أساس حمل المشروع قبل اعتماد التصميم النهائي.',
        agentGeneric: true
      });
    }

    var projectCapacityDiff = percentDifference(totals.requiredBtu, totals.selectedCapacityBtu);
    if (projectCapacityDiff !== null && projectCapacityDiff < -5) {
      pushAction(actions, seen, {
        priority: 'critical',
        scope: 'project',
        code: 'project_capacity_undersized',
        text: 'Project selected capacity is ' + Math.abs(projectCapacityDiff).toFixed(1) + '% below total required load.',
        arText: 'سعة المشروع المختارة أقل من إجمالي الحمل المطلوب بنسبة ' + Math.abs(projectCapacityDiff).toFixed(1) + '%.'
      });
    } else if (projectCapacityDiff !== null && projectCapacityDiff > thresholds.GENERAL_OVERSIZE_HIGH_PCT) {
      pushAction(actions, seen, {
        priority: 'warning',
        scope: 'project',
        code: 'project_capacity_oversized',
        text: 'Project selected capacity is ' + projectCapacityDiff.toFixed(1) + '% above total required load; review staging and humidity control.',
        arText: 'سعة المشروع المختارة أعلى من إجمالي الحمل المطلوب بنسبة ' + projectCapacityDiff.toFixed(1) + '%؛ راجع التدرج والتحكم بالرطوبة.'
      });
    }

    var projectIsDucted = isDuctedUnitType(getProjectSystemType(snapshot.projectState)) || (snapshot.rooms || []).some(roomHasDuctedSystem);
    var projectCfmDiff = percentDifference(totals.requiredCfm, totals.selectedCfm);
    if (projectCfmDiff !== null && projectCfmDiff < -thresholds.MATCH_MAX_OVERSIZE_PCT && projectIsDucted) {
      pushAction(actions, seen, {
        priority: 'critical',
        scope: 'project',
        code: 'project_cfm_low',
        text: 'Project selected airflow is ' + Math.abs(projectCfmDiff).toFixed(1) + '% below required CFM.',
        arText: 'تدفق الهواء المختار للمشروع أقل من المطلوب بنسبة ' + Math.abs(projectCfmDiff).toFixed(1) + '%.'
      });
    } else if (projectCfmDiff !== null && projectCfmDiff < -thresholds.MATCH_MAX_OVERSIZE_PCT && !projectIsDucted) {
      pushAction(actions, seen, {
        priority: 'warning',
        scope: 'project',
        code: 'split_project_cfm_review',
        text: 'Project airflow is below the estimated CFM, but the selected system is non-ducted. Treat this as manufacturer airflow review, not a critical blocker.',
        arText: 'CFM المشروع أقل من التقدير، لكن النظام المختار غير دكت. اعتبرها مراجعة لهواء كتالوج الشركة وليست مانعًا حرجًا طالما السعة مناسبة.',
        agentGeneric: true
      });
    }

    if (projectIsDucted && window._lastEspCalc && Number(window._lastEspCalc.totalPa) > thresholds.ESP_VALIDATION_REVIEW_MAX_PA) {
      pushAction(actions, seen, {
        priority: 'critical',
        scope: 'project',
        code: 'esp_high',
        text: 'Preliminary ESP is high; review duct lengths, bends, filters, coil, diffusers, dampers, and fan selection.',
        arText: 'قيمة ESP المبدئية مرتفعة؛ راجع أطوال الدكت والأكواع والفلاتر والكويل والمخارج والدمابر واختيار المروحة.'
      });
    } else if (projectIsDucted && window._lastEspCalc && Number(window._lastEspCalc.totalPa) > thresholds.ESP_LOW_MAX_PA) {
      pushAction(actions, seen, {
        priority: 'warning',
        scope: 'project',
        code: 'esp_medium',
        text: 'Preliminary ESP needs review against unit catalog and duct layout before approval.',
        arText: 'قيمة ESP المبدئية تحتاج مراجعة مع كتالوج الوحدة ومخطط الدكت قبل الاعتماد.'
      });
    }

    (snapshot.validation.items || []).forEach(function (item) {
      var normalized = normalizeStatus(item && item.status);
      if (normalized === 'ok') return;
      pushAction(actions, seen, {
        priority: normalized,
        scope: 'project',
        code: 'project_validation_' + normalized,
        text: (item && (item.detail || item.title)) || 'Review project validation.',
        arText: item && item.agentArText,
        agentGeneric: !!(item && item.agentArText)
      });
    });

    pushEquipmentSelectionActions(actions, seen, snapshot, thresholds);

    actions.sort(function (a, b) {
      return statusWeight(b.priority) - statusWeight(a.priority);
    });

    return actions.slice(0, 12);
  }

  function diagnosticCopy(action, room, ar) {
    var code = (action && action.code) || '';
    var roomName = room && room.label ? room.label : (ar ? 'الغرفة' : 'Room');
    var fallback = localizedActionText(action, ar);

    if (code === 'missing_room_volume') {
      return {
        issue: ar ? 'أبعاد الغرفة غير مكتملة: ' + roomName : 'Room dimensions are incomplete: ' + roomName,
        impact: ar ? 'لا يمكن اعتماد الحجم والحمل الحراري بثقة.' : 'Volume and cooling load cannot be approved with confidence.',
        guidance: ar ? 'أكمل الطول والعرض والارتفاع ثم أعد الحساب قبل التقرير.' : 'Enter length, width, and height, then recalculate before reporting.'
      };
    }

    if (code === 'missing_people_count') {
      return {
        issue: ar ? 'عدد الأشخاص غير مؤكد: ' + roomName : 'People count is not confirmed: ' + roomName,
        impact: ar ? 'افتراضات الحمل الداخلي والتهوية قد تكون غير دقيقة.' : 'Internal load and ventilation assumptions may be inaccurate.',
        guidance: ar ? 'أدخل عدد الأشخاص المتوقع أو قيمة تقديرية واضحة قبل اعتماد النتائج.' : 'Enter the expected people count or a documented estimate before approval.'
      };
    }

    if (code === 'healthcare_review') {
      return {
        issue: ar ? 'الغرفة صحية وتحتاج مراجعة معيارية: ' + roomName : 'Healthcare room needs standards review: ' + roomName,
        impact: ar ? 'ACH والضغط والهواء الخارجي تؤثر على صلاحية التصميم.' : 'ACH, pressure relationship, and outdoor air affect design acceptability.',
        guidance: ar ? 'راجع ACH والهواء الخارجي والعادم والضغط قبل إصدار التقرير.' : 'Review ACH, outdoor air, exhaust, and pressure before issuing the report.'
      };
    }

    if (code === 'healthcare_source_confirmation') {
      return {
        issue: ar ? 'مرجعية قيم ASHRAE 170 تحتاج تأكيد: ' + roomName : 'ASHRAE 170 source basis needs confirmation: ' + roomName,
        impact: ar ? 'القيم الحالية تصلح كمراجعة أولية، وليست اعتمادًا نهائيًا بدون مطابقة الإصدار والاشتراط المحلي.' : 'Current values are suitable for preliminary review, not final approval without edition and authority confirmation.',
        guidance: ar ? 'طابق ACH/OA/Pressure/Temperature/RH مع الإصدار المعتمد من ASHRAE 170 ومتطلبات الجهة المحلية قبل التسليم.' : 'Match ACH/OA/Pressure/Temperature/RH against the adopted ASHRAE 170 edition and local authority before handoff.'
      };
    }

    if (code === 'general_load_source_confirmation') {
      return {
        issue: ar ? 'أساس الحمل العام تقديري أولي' : 'General load basis is preliminary',
        impact: ar ? 'عوامل الحمل السريعة تساعد في التقدير، لكنها لا تستبدل حساب الأحمال التفصيلي عند الاعتماد النهائي.' : 'Quick-load factors support early estimates, but do not replace detailed load calculations for final approval.',
        guidance: ar ? 'وثق أساس الحمل أو استخدم حسابًا تفصيليًا للغلاف والأحمال الداخلية عند الحاجة.' : 'Document the load basis or use a detailed envelope/internal-load calculation when required.'
      };
    }

    if (code === 'room_capacity_undersized') {
      return {
        issue: ar ? 'السعة المختارة أقل من حمل الغرفة: ' + roomName : 'Selected capacity is below room load: ' + roomName,
        impact: ar ? 'قد لا تحقق الوحدة درجة الحرارة المطلوبة في ظروف الذروة.' : 'The unit may not meet the required temperature at peak conditions.',
        guidance: ar ? 'اختر سعة أعلى أو راجع افتراضات الحمل قبل اعتماد عرض السعر.' : 'Select a larger capacity or review load assumptions before quoting.'
      };
    }

    if (code === 'room_capacity_oversized') {
      return {
        issue: ar ? 'السعة المختارة أعلى بوضوح من حمل الغرفة: ' + roomName : 'Selected capacity is clearly above room load: ' + roomName,
        impact: ar ? 'قد يزيد خطر التشغيل المتقطع وضعف التحكم بالرطوبة.' : 'Short cycling and weak humidity control become more likely.',
        guidance: ar ? 'راجع أقرب سعة مناسبة أو سبب هامش الأمان قبل التقرير.' : 'Review the nearest suitable capacity or document the safety margin.'
      };
    }

    if (code === 'room_cfm_low') {
      return {
        issue: ar ? 'تدفق الهواء المختار أقل من المطلوب: ' + roomName : 'Selected airflow is below required CFM: ' + roomName,
        impact: ar ? 'قد يتأثر توزيع الهواء وأداء المخارج في نظام الدكت.' : 'Air distribution and diffuser performance may be affected in ducted systems.',
        guidance: ar ? 'راجع CFM الوحدة وتوزيع الهواء وسرعات الدكت قبل الاعتماد.' : 'Review unit CFM, air distribution, and duct velocities before approval.'
      };
    }

    if (code === 'split_cfm_review') {
      return {
        issue: ar ? 'CFM أقل من التقدير في نظام سبليت غير دكت: ' + roomName : 'CFM is below estimate for a non-ducted split system: ' + roomName,
        impact: ar ? 'ليست مشكلة حرجة إذا كانت السعة BTU مناسبة، لكنها تحتاج توثيق عند الحاجة.' : 'Not critical when BTU capacity is suitable, but may need documentation if required.',
        guidance: ar ? 'اعتمد فحص السعة أولاً، وراجع كتالوج الشركة عند طلب إثبات تدفق الهواء.' : 'Use capacity as the primary check and verify manufacturer airflow when proof is required.'
      };
    }

    if (code === 'room_cfm_high') {
      return {
        issue: ar ? 'تدفق الهواء المختار أعلى من المطلوب: ' + roomName : 'Selected airflow is above required CFM: ' + roomName,
        impact: ar ? 'قد تظهر ضوضاء أو تيارات هواء غير مريحة.' : 'Noise or uncomfortable drafts may appear.',
        guidance: ar ? 'راجع اختيار المخارج وسرعات الهواء ومواصفات الوحدة.' : 'Review diffuser selection, air velocity, and unit specifications.'
      };
    }

    if (code === 'ducted_room_review') {
      return {
        issue: ar ? 'نظام دكت يحتاج مراجعة توزيع: ' + roomName : 'Ducted system needs distribution review: ' + roomName,
        impact: ar ? 'ESP وسرعة الدكت قد تغير اختيار المروحة أو أبعاد الدكت.' : 'ESP and duct velocity may affect fan selection or duct sizing.',
        guidance: ar ? 'راجع سرعة الدكت وESP المبدئي قبل اعتماد النظام.' : 'Review duct velocity and preliminary ESP before approval.'
      };
    }

    return {
      issue: fallback,
      impact: ar ? 'قد تؤثر هذه الملاحظة على جاهزية التقرير أو الاعتماد.' : 'This note may affect report readiness or approval.',
      guidance: ar ? 'راجع السبب وعدّل المدخلات أو وثّق الافتراض قبل المتابعة.' : 'Review the cause, adjust inputs, or document the assumption before continuing.'
    };
  }

  function buildRoomDiagnostics(snapshot, actions) {
    snapshot = snapshot || buildEngineeringSnapshot();
    actions = actions || buildNextActions(snapshot);
    var rooms = snapshot.rooms || [];
    var diagnostics = [];
    var seen = {};

    actions.forEach(function (action) {
      if (!action || action.scope !== 'room') return;
      var room = rooms.filter(function (item) {
        return String(item.id) === String(action.roomId);
      })[0] || null;
      var key = [action.roomId || '', action.code || '', action.text || ''].join('|');
      if (seen[key]) return;
      seen[key] = true;

      diagnostics.push({
        priority: normalizeStatus(action.priority),
        roomId: action.roomId || '',
        roomLabel: room && room.label ? room.label : '',
        code: action.code || '',
        text: action.text || '',
        arText: action.arText || '',
        copyEn: diagnosticCopy(action, room, false),
        copyAr: diagnosticCopy(action, room, true)
      });
    });

    diagnostics.sort(function (a, b) {
      return statusWeight(b.priority) - statusWeight(a.priority);
    });

    return diagnostics.slice(0, 6);
  }

  function workflowStep(id, status, labelEn, labelAr, noteEn, noteAr) {
    return {
      id: id,
      status: normalizeStatus(status),
      labelEn: labelEn,
      labelAr: labelAr,
      noteEn: noteEn,
      noteAr: noteAr
    };
  }

  function hasQuotePricing(snapshot) {
    return (snapshot.rooms || []).some(function (room) {
      var line = room.quoteLine || {};
      return Number(line.up || line.unitPrice || line.price) > 0 || Number(line.total || line.lineTotal) > 0;
    });
  }

  function hasSavedProject() {
    try {
      if (window.AppStorage && typeof window.AppStorage.restoreCurrentProjectId === 'function') {
        return !!window.AppStorage.restoreCurrentProjectId();
      }
    } catch (_err) {}
    try {
      return !!window.localStorage.getItem('acp9_current_project_id');
    } catch (_err2) {}
    return false;
  }

  function isSourceConfirmationAction(action) {
    var code = String((action && action.code) || '');
    return code === 'healthcare_source_confirmation' || code === 'general_load_source_confirmation';
  }

  function buildReportReadiness(snapshot, actions) {
    snapshot = snapshot || buildEngineeringSnapshot();
    actions = actions || buildNextActions(snapshot);
    var totals = snapshot.totals || {};
    var hasRooms = (snapshot.rooms || []).length > 0;
    var hasCalculated = totals.requiredBtu > 0 && totals.requiredCfm > 0;
    var priced = hasQuotePricing(snapshot);
    var hasCritical = actions.some(function (action) { return normalizeStatus(action.priority) === 'critical'; });
    var hasMissingInput = actions.some(function (action) { return normalizeStatus(action.priority) === 'needs_input' || action.code === 'add_first_room'; });
    var hasWarning = actions.some(function (action) { return normalizeStatus(action.priority) === 'warning'; });
    var sourceConfirmationRequired = actions.some(isSourceConfirmationAction);
    var firstAction = actions && actions.length ? actions[0] : null;

    var status = 'ready';
    var reportStatus = 'ready';
    var quoteStatus = priced ? 'ready' : 'needs_pricing';
    var finalApprovalStatus = 'ready';
    var reason = 'Project is ready for report review.';
    var arReason = 'المشروع جاهز لمراجعة التقرير.';

    if (!hasRooms) {
      status = 'needs_input';
      reportStatus = 'blocked';
      quoteStatus = 'blocked';
      finalApprovalStatus = 'blocked';
      reason = 'Add at least one room before generating deliverables.';
      arReason = 'أضف غرفة واحدة على الأقل قبل إنشاء المخرجات.';
    } else if (!hasCalculated) {
      status = 'needs_input';
      reportStatus = 'blocked';
      quoteStatus = 'blocked';
      finalApprovalStatus = 'blocked';
      reason = 'Complete calculations before generating report or quotation.';
      arReason = 'أكمل الحسابات قبل إنشاء التقرير أو عرض السعر.';
    } else if (hasCritical) {
      status = 'blocked';
      reportStatus = 'blocked';
      quoteStatus = 'blocked';
      finalApprovalStatus = 'blocked';
      reason = firstAction ? firstAction.text : 'Critical engineering issue must be resolved before approval.';
      arReason = firstAction && firstAction.arText ? firstAction.arText : 'توجد مشكلة هندسية حرجة يجب حلها قبل الاعتماد.';
    } else if (hasMissingInput) {
      status = 'needs_input';
      reportStatus = 'blocked';
      quoteStatus = 'blocked';
      finalApprovalStatus = 'blocked';
      reason = firstAction ? firstAction.text : 'Missing inputs must be completed before approval.';
      arReason = firstAction && firstAction.arText ? firstAction.arText : 'توجد مدخلات ناقصة يجب إكمالها قبل الاعتماد.';
    } else if (sourceConfirmationRequired) {
      status = 'review';
      reportStatus = 'review';
      quoteStatus = priced ? 'review' : 'needs_pricing';
      finalApprovalStatus = 'review';
      var sourceAction = actions.filter(isSourceConfirmationAction)[0] || firstAction;
      reason = sourceAction ? sourceAction.text : 'Engineering source assumptions require confirmation before final design approval.';
      arReason = sourceAction && sourceAction.arText ? sourceAction.arText : 'تحتاج افتراضات المصدر الهندسي إلى تأكيد قبل اعتماد التصميم النهائي.';
    } else if (hasWarning) {
      status = 'review';
      reportStatus = 'review';
      quoteStatus = priced ? 'review' : 'needs_pricing';
      finalApprovalStatus = 'review';
      reason = firstAction ? firstAction.text : 'Engineering warnings should be reviewed before approval.';
      arReason = firstAction && firstAction.arText ? firstAction.arText : 'توجد ملاحظات هندسية تحتاج مراجعة قبل الاعتماد.';
    } else if (!priced) {
      status = 'ready';
      reportStatus = 'ready';
      quoteStatus = 'needs_pricing';
      reason = 'Report is ready; quotation still needs pricing.';
      arReason = 'التقرير جاهز؛ عرض السعر ما زال يحتاج تسعير.';
    }

    return {
      status: status,
      reportStatus: reportStatus,
      quoteStatus: quoteStatus,
      finalApprovalStatus: finalApprovalStatus,
      sourceConfirmationRequired: sourceConfirmationRequired,
      reason: reason,
      arReason: arReason,
      canIssueReport: reportStatus === 'ready',
      canReviewReport: reportStatus === 'ready' || reportStatus === 'review',
      canIssueQuote: quoteStatus === 'ready',
      firstAction: clone(firstAction)
    };
  }

  function buildWorkflowState(snapshot, actions) {
    snapshot = snapshot || buildEngineeringSnapshot();
    actions = actions || buildNextActions(snapshot);
    var totals = snapshot.totals || {};
    var hasRooms = (snapshot.rooms || []).length > 0;
    var hasCalculated = totals.requiredBtu > 0 && totals.requiredCfm > 0;
    var blockingInput = actions.some(function (action) {
      return action.priority === 'needs_input' || action.code === 'add_first_room';
    });
    var critical = actions.some(function (action) { return action.priority === 'critical'; });
    var warning = actions.some(function (action) { return action.priority === 'warning'; });
    var priced = hasQuotePricing(snapshot);
    var saved = hasSavedProject();

    return {
      currentStep: !hasRooms ? 'inputs' : (!hasCalculated ? 'calculate' : (critical || warning ? 'validate' : (!priced ? 'quote' : (!saved ? 'save' : 'complete')))),
      steps: [
        workflowStep(
          'inputs',
          hasRooms && !blockingInput ? 'ok' : 'needs_input',
          'Inputs',
          'المدخلات',
          hasRooms ? 'Rooms are available for review.' : 'Add rooms and required dimensions.',
          hasRooms ? 'الغرف متاحة للمراجعة.' : 'أضف الغرف والأبعاد المطلوبة.'
        ),
        workflowStep(
          'calculate',
          hasCalculated ? 'ok' : 'needs_input',
          'Calculate',
          'الحساب',
          hasCalculated ? 'BTU, TR, and CFM are available.' : 'Run calculation to generate BTU, TR, and CFM.',
          hasCalculated ? 'BTU و TR و CFM متاحة.' : 'شغل الحساب لإنتاج BTU و TR و CFM.'
        ),
        workflowStep(
          'validate',
          critical ? 'critical' : (warning ? 'warning' : (hasCalculated ? 'ok' : 'needs_input')),
          'Validate',
          'التحقق',
          critical ? 'Critical engineering items need action.' : (warning ? 'Engineering warnings need review.' : 'Validation is ready for report review.'),
          critical ? 'توجد نقاط هندسية حرجة تحتاج إجراء.' : (warning ? 'توجد تحذيرات هندسية تحتاج مراجعة.' : 'التحقق جاهز لمراجعة التقرير.')
        ),
        workflowStep(
          'fix',
          critical || warning ? 'warning' : (hasCalculated ? 'ok' : 'needs_input'),
          'Fix',
          'التصحيح',
          critical || warning ? 'Resolve the highest-priority action first.' : 'No blocking fix is currently detected.',
          critical || warning ? 'عالج الإجراء الأعلى أولوية أولًا.' : 'لا يوجد تصحيح مانع حاليًا.'
        ),
        workflowStep(
          'report',
          hasCalculated && !critical ? 'ok' : 'warning',
          'Report',
          'التقرير',
          hasCalculated ? 'Technical report can be reviewed with current caveats.' : 'Calculate before generating a useful report.',
          hasCalculated ? 'يمكن مراجعة التقرير الفني مع التحفظات الحالية.' : 'احسب أولًا قبل إنشاء تقرير مفيد.'
        ),
        workflowStep(
          'quote',
          priced ? 'ok' : (hasCalculated ? 'warning' : 'needs_input'),
          'Quote',
          'عرض السعر',
          priced ? 'Pricing exists for at least one line.' : 'Add pricing before sharing the quotation.',
          priced ? 'يوجد تسعير لسطر واحد على الأقل.' : 'أضف التسعير قبل مشاركة عرض السعر.'
        ),
        workflowStep(
          'save',
          saved ? 'ok' : (hasRooms ? 'warning' : 'needs_input'),
          'Save',
          'الحفظ',
          saved ? 'Current project appears saved.' : 'Save the project before switching context.',
          saved ? 'يبدو أن المشروع الحالي محفوظ.' : 'احفظ المشروع قبل الانتقال لسياق آخر.'
        )
      ]
    };
  }

  function runEngineeringValidation(snapshot) {
    snapshot = snapshot || buildEngineeringSnapshot();
    var actions = buildNextActions(snapshot);
    var actionSummary = summarizeFindings(actions.map(function (action) {
      return { status: action && action.priority };
    }));
    var summary = mergeSummaries(snapshot.validation.summary, actionSummary);
    return {
      health: overallHealth(summary),
      summary: summary,
      nextActions: actions,
      roomDiagnostics: buildRoomDiagnostics(snapshot, actions),
      readiness: buildReportReadiness(snapshot, actions),
      workflow: buildWorkflowState(snapshot, actions),
      snapshot: snapshot
    };
  }

  function isArabic() {
    return (window.lang || document.documentElement.lang || 'ar') !== 'en';
  }

  function formatNumber(value, digits) {
    value = Number(value) || 0;
    if (typeof digits === 'number') return value.toLocaleString(undefined, { maximumFractionDigits: digits });
    return Math.round(value).toLocaleString();
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function healthLabel(health, ar) {
    var labels = {
      ok: ar ? 'مستقر' : 'OK',
      warning: ar ? 'يحتاج مراجعة' : 'Warning',
      needs_input: ar ? 'مدخلات ناقصة' : 'Needs Input',
      critical: ar ? 'حرج' : 'Critical'
    };
    return labels[normalizeStatus(health)] || labels.warning;
  }

  function healthBadgeClass(health) {
    var normalized = normalizeStatus(health);
    if (normalized === 'ok') return 'pass';
    if (normalized === 'critical') return 'fail';
    if (normalized === 'needs_input') return 'warning';
    return 'warning';
  }

  function localizedActionText(action, ar) {
    if (!action || !action.text) return ar ? 'راجع حالة المشروع.' : 'Review project status.';
    if (!ar) return action.text;
    if (action.arText) return action.arText;
    if (action.code === 'add_first_room') return 'أضف غرفة واحدة على الأقل قبل بدء التحقق الهندسي.';
    return action.text
      .replace('Enter room dimensions to calculate volume for ', 'أدخل أبعاد الغرفة لحساب الحجم: ')
      .replace('Review healthcare airflow assumptions for ', 'راجع افتراضات تهوية الرعاية الصحية: ')
      .replace('Review project validation.', 'راجع التحقق الهندسي للمشروع.');
  }

  function ensureAgentPanel() {
    var existing = document.getElementById('engineering-agent-card');
    if (existing) return existing;

    var host = document.getElementById('desktop-insights');
    if (!host) return null;

    var card = document.createElement('div');
    card.className = 'desktop-insight-card';
    card.id = 'engineering-agent-card';
    card.innerHTML = '' +
      '<div class="desktop-insight-title" id="engineering-agent-title">Smart Engineering Reviewer</div>' +
      '<div class="desktop-insight-list compact" id="engineering-agent-metrics"></div>' +
      '<div class="desktop-insight-list compact" id="engineering-agent-workflow"></div>' +
      '<div class="desktop-insight-actions" id="engineering-agent-readiness"></div>' +
      '<div class="desktop-insight-actions" id="engineering-agent-commands"></div>';

    var validationCard = document.getElementById('desktop-insight-validation-title');
    var validationHost = validationCard && validationCard.closest ? validationCard.closest('.desktop-insight-card') : null;
    if (validationHost && validationHost.parentNode === host) {
      host.insertBefore(card, validationHost);
    } else {
      host.appendChild(card);
    }
    return card;
  }

  function renderAgentMetrics(snapshot, result, ar) {
    var host = document.getElementById('engineering-agent-metrics');
    if (!host) return;
    var totals = snapshot.totals || {};
    var summary = result.summary || {};
    var badgeClass = healthBadgeClass(result.health);
    host.innerHTML = '' +
      '<div class="desktop-insight-row"><span>' + (ar ? 'حالة المشروع' : 'Project Health') + '</span><strong class="validation-badge ' + badgeClass + '">' + healthLabel(result.health, ar) + '</strong></div>' +
      '<div class="desktop-insight-row"><span>' + (ar ? 'الغرف' : 'Rooms') + '</span><strong>' + formatNumber(totals.rooms) + '</strong></div>' +
      '<div class="desktop-insight-row"><span>' + (ar ? 'غرف صحية' : 'Healthcare') + '</span><strong>' + formatNumber(totals.healthcareRooms) + '</strong></div>' +
      '<div class="desktop-insight-row"><span>' + (ar ? 'الحمل المطلوب' : 'Required Load') + '</span><strong>' + formatNumber(totals.requiredBtu) + ' BTU/h</strong></div>' +
      '<div class="desktop-insight-row"><span>' + (ar ? 'التبريد' : 'Cooling') + '</span><strong>' + formatNumber(totals.requiredTr, 2) + ' TR</strong></div>' +
      '<div class="desktop-insight-row"><span>' + (ar ? 'الهواء المطلوب' : 'Airflow') + '</span><strong>' + formatNumber(totals.requiredCfm) + ' CFM</strong></div>' +
      '<div class="desktop-insight-row"><span>' + (ar ? 'تحذيرات' : 'Warnings') + '</span><strong>' + formatNumber((summary.warning || 0) + (summary.needs_input || 0) + (summary.critical || 0)) + '</strong></div>';
  }

  function renderWorkflowState(workflow, ar) {
    var host = document.getElementById('engineering-agent-workflow');
    if (!host || !workflow || !Array.isArray(workflow.steps)) return;

    host.innerHTML = workflow.steps.map(function (step) {
      var badgeClass = healthBadgeClass(step.status);
      var label = ar ? step.labelAr : step.labelEn;
      var note = ar ? step.noteAr : step.noteEn;
      return '' +
        '<div class="desktop-insight-row" title="' + escapeHtml(note || '') + '">' +
          '<span>' + escapeHtml(label) + '</span>' +
          '<strong class="validation-badge ' + badgeClass + '">' + escapeHtml(healthLabel(step.status, ar)) + '</strong>' +
        '</div>';
    }).join('');
  }

  function readinessLabel(status, ar) {
    var labels = {
      ready: ar ? 'جاهز' : 'Ready',
      review: ar ? 'يحتاج مراجعة' : 'Review',
      needs_input: ar ? 'مدخلات ناقصة' : 'Needs Input',
      blocked: ar ? 'غير جاهز' : 'Not Ready',
      needs_pricing: ar ? 'يحتاج تسعير' : 'Needs Pricing'
    };
    return labels[status] || labels.review;
  }

  function readinessTone(status) {
    if (status === 'ready') return 'pass';
    if (status === 'blocked') return 'fail';
    return 'warning';
  }

  function renderReadinessGate(readiness, ar) {
    var host = document.getElementById('engineering-agent-readiness');
    if (!host || !readiness) return;

    var reason = ar ? readiness.arReason : readiness.reason;
    host.innerHTML = '' +
      '<div class="engineering-readiness-card" style="padding:12px 14px;border-radius:12px;border:1px solid rgba(148,163,184,.35);background:#fff;display:flex;flex-direction:column;gap:8px">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px">' +
          '<strong style="font-size:12px;color:#0f172a">' + escapeHtml(ar ? 'جاهزية التسليم' : 'Delivery Readiness') + '</strong>' +
          '<span class="validation-badge ' + readinessTone(readiness.status) + '">' + escapeHtml(readinessLabel(readiness.status, ar)) + '</span>' +
        '</div>' +
        '<div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">' +
          '<div class="desktop-insight-row" style="margin:0"><span>' + escapeHtml(ar ? 'التقرير الفني' : 'Technical Report') + '</span><strong class="validation-badge ' + readinessTone(readiness.reportStatus === 'ready' ? 'ready' : readiness.reportStatus) + '">' + escapeHtml(readinessLabel(readiness.reportStatus, ar)) + '</strong></div>' +
          '<div class="desktop-insight-row" style="margin:0"><span>' + escapeHtml(ar ? 'عرض السعر' : 'Quotation') + '</span><strong class="validation-badge ' + readinessTone(readiness.quoteStatus === 'ready' ? 'ready' : readiness.quoteStatus) + '">' + escapeHtml(readinessLabel(readiness.quoteStatus, ar)) + '</strong></div>' +
          '<div class="desktop-insight-row" style="margin:0"><span>' + escapeHtml(ar ? 'الاعتماد النهائي' : 'Final Approval') + '</span><strong class="validation-badge ' + readinessTone(readiness.finalApprovalStatus === 'ready' ? 'ready' : readiness.finalApprovalStatus) + '">' + escapeHtml(readinessLabel(readiness.finalApprovalStatus, ar)) + '</strong></div>' +
        '</div>' +
        '<div style="font-size:12px;line-height:1.7;color:#475569">' + escapeHtml(reason) + '</div>' +
      '</div>';
  }

  function renderDiagnosticNote(diagnostic, ar) {
    var copy = ar ? diagnostic.copyAr : diagnostic.copyEn;
    var badge = healthLabel(diagnostic.priority, ar);
    return '' +
      '<div class="engineering-agent-diagnostic" style="padding:10px 0;border-top:1px solid rgba(245,158,11,.22)">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:4px">' +
          '<strong style="font-size:12px;color:#78350f">' + escapeHtml(copy.issue) + '</strong>' +
          '<span class="validation-badge warning" style="flex:0 0 auto">' + escapeHtml(badge) + '</span>' +
        '</div>' +
        '<div style="font-size:12px;color:#92400e">' + escapeHtml(copy.impact) + '</div>' +
        '<div style="font-size:12px;color:#78350f;margin-top:3px">' + escapeHtml(copy.guidance) + '</div>' +
      '</div>';
  }

  function renderAgentCommands(result, ar) {
    var host = document.getElementById('engineering-agent-commands');
    if (!host) return;

    var firstAction = result && result.nextActions && result.nextActions.length ? result.nextActions[0] : null;
    var actionText = firstAction
      ? localizedActionText(firstAction, ar)
      : (ar ? 'لا توجد ملاحظات حرجة حاليا.' : 'No critical notes right now.');

    var diagnostics = (result && result.roomDiagnostics) || [];
    var diagnosticRows = diagnostics.length
      ? diagnostics.slice(0, 4).map(function (diagnostic) { return renderDiagnosticNote(diagnostic, ar); }).join('')
      : '<div style="font-size:12px;color:#78350f;margin-top:6px">' + escapeHtml(actionText) + '</div>';

    host.innerHTML = '' +
      '<div class="engineering-agent-note-card" style="display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:12px;border:1px solid rgba(245,158,11,.38);background:rgba(254,243,199,.86);color:#78350f;line-height:1.7">' +
        '<span aria-hidden="true" style="display:inline-flex;width:24px;height:24px;align-items:center;justify-content:center;border-radius:999px;background:#f59e0b;color:#fff;font-size:14px;flex:0 0 auto">&#128161;</span>' +
        '<div style="display:flex;flex-direction:column;gap:6px;min-width:0">' +
          '<strong style="font-size:12px">' + escapeHtml(ar ? 'الملاحظات الهندسية' : 'Engineering Notes') + '</strong>' +
          diagnosticRows +
        '</div>' +
      '</div>';
  }

  function openPanel(panelName) {
    try {
      if (typeof window.goPanel === 'function') {
        window.goPanel(panelName);
        return true;
      }
    } catch (_err) {}
    try {
      if (typeof window.openDesktopView === 'function') {
        var view = panelName === 'hist' ? 'hist' : panelName;
        window.openDesktopView(view);
        return true;
      }
    } catch (_err2) {}
    return false;
  }

  function focusFirstInputIssue(action) {
    var target = null;
    if (action && action.code === 'missing_room_volume') target = document.getElementById('inp-len') || document.getElementById('inp-vol');
    if (action && action.code === 'missing_people_count') target = document.getElementById('inp-ppl');
    if (!target) target = document.getElementById('workflow-calc-btn') || document.getElementById('lbl-calc');
    if (target && typeof target.focus === 'function') {
      try { target.focus(); } catch (_err) {}
      try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_err2) {}
      return true;
    }
    return false;
  }

  function notifyGuide(message) {
    if (!message) return;
    try {
      if (typeof window.toast === 'function') {
        window.toast(message);
        return;
      }
    } catch (_err) {}
  }

  function deliverableStatus(readiness, kind) {
    if (!readiness) return 'blocked';
    return kind === 'quote' ? readiness.quoteStatus : readiness.reportStatus;
  }

  function readinessGuardMessage(readiness, kind, ar) {
    var status = deliverableStatus(readiness, kind);
    var deliverable = kind === 'quote'
      ? (ar ? 'عرض السعر' : 'quotation')
      : (ar ? 'التقرير الفني' : 'technical report');

    if (status === 'ready') return '';
    if (status === 'review') {
      return ar
        ? deliverable + ' يحتاج مراجعة هندسية قبل الاعتماد النهائي.'
        : 'The ' + deliverable + ' needs engineering review before final approval.';
    }
    if (status === 'needs_pricing') {
      return ar
        ? 'عرض السعر يحتاج تسعيرًا قبل التصدير.'
        : 'The quotation needs pricing before export.';
    }
    return ar
      ? deliverable + ' غير جاهز. راجع جاهزية التسليم في المراجع الهندسي الذكي.'
      : 'The ' + deliverable + ' is not ready. Review Delivery Readiness in the Smart Engineering Reviewer.';
  }

  function allowDeliverable(kind) {
    var result = runEngineeringValidation();
    var readiness = result && result.readiness;
    var status = deliverableStatus(readiness, kind);
    var ar = isArabic();
    if (status === 'ready') return true;

    refreshAgentPanel();
    notifyGuide(readinessGuardMessage(readiness, kind, ar));

    if (status === 'review') return true;
    return false;
  }

  function wrapDeliverableGuard(fnName, kind) {
    var original = window[fnName];
    if (typeof original !== 'function' || original.__readinessGuardWrapped) return;
    var wrapped = function () {
      if (!allowDeliverable(kind)) return false;
      return original.apply(this, arguments);
    };
    wrapped.__readinessGuardWrapped = true;
    window[fnName] = wrapped;
  }

  function focusElementByIds(ids) {
    var target = null;
    (ids || []).some(function (id) {
      target = document.getElementById(id);
      return !!target;
    });
    if (!target) return false;
    try { target.focus(); } catch (_err) {}
    try { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (_err2) {}
    return true;
  }

  function guideAction(action, result) {
    action = action || {};
    result = result || runEngineeringValidation();
    var ar = isArabic();
    var code = action.code || '';

    if (code === 'add_first_room' || code === 'missing_room_volume') {
      openPanel('calc');
      focusElementByIds(['inp-len', 'inp-width', 'inp-height', 'inp-vol']);
      notifyGuide(ar ? 'أدخل أبعاد الغرفة ثم اضغط حساب.' : 'Enter room dimensions, then calculate.');
      return true;
    }

    if (code === 'missing_people_count') {
      openPanel('calc');
      focusElementByIds(['inp-ppl']);
      notifyGuide(ar ? 'أكد عدد الأشخاص. إذا غير معروف، استخدم قيمة تقديرية مناسبة ثم راجعها قبل التقرير النهائي.' : 'Confirm people count. If unknown, use a reasonable estimate and review it before final reporting.');
      return true;
    }

    if (code.indexOf('capacity') >= 0) {
      openPanel('calc');
      focusElementByIds(['proj-systype', 'calc-workflow-card', 'calc-room-table-wrap']);
      notifyGuide(ar ? 'راجع نوع النظام والسعة المختارة. لا يتم تغيير السعة تلقائيًا بدون موافقتك.' : 'Review system type and selected capacity. Capacity is not changed automatically.');
      return true;
    }

    if (code === 'split_cfm_review' || code === 'split_project_cfm_review' || code.indexOf('cfm') >= 0) {
      openPanel('calc');
      focusElementByIds(['proj-systype', 'proj-duct-block', 'calc-room-table-wrap']);
      notifyGuide(ar ? 'لأن النظام سبليت جداري، السعة BTU هي الفحص الأساسي. راجع CFM كتالوج الشركة فقط إذا كان مطلوبًا إثبات التهوية أو توزيع الهواء.' : 'For wall split systems, BTU capacity is the primary check. Review catalog CFM only if ventilation or distribution proof is required.');
      return true;
    }

    if (code.indexOf('esp') >= 0 || code.indexOf('duct') >= 0) {
      openPanel('calc');
      focusElementByIds(['esp-block', 'proj-duct-block']);
      notifyGuide(ar ? 'راجع الدكت و ESP فقط للأنظمة الدكتية مثل Ducted / Package / AHU / FCU.' : 'Review duct and ESP only for ducted systems such as Ducted / Package / AHU / FCU.');
      return true;
    }

    if (result && result.workflow && result.workflow.currentStep === 'quote') {
      openPanel('hist');
      notifyGuide(ar ? 'راجع التسعير والكميات قبل مشاركة عرض السعر.' : 'Review pricing and quantities before sharing the quote.');
      return true;
    }

    if (result && result.workflow && result.workflow.currentStep === 'save') {
      runAgentCommand('save');
      return true;
    }

    openPanel('tech');
    notifyGuide(ar ? 'افتح التقرير الفني لمراجعة تفاصيل التحقق قبل الاعتماد.' : 'Open the technical report to review validation details before approval.');
    return true;
  }

  function runAgentCommand(command) {
    var result = runEngineeringValidation();
    var firstAction = (result.nextActions || [])[0] || null;
    var currentStep = result.workflow ? result.workflow.currentStep : '';

    if (command === 'primary') {
      guideAction(firstAction, result);
    } else if (command === 'report') {
      openPanel('tech');
    } else if (command === 'quote') {
      openPanel('hist');
    } else if (command === 'save') {
      try {
        if (typeof window.saveCurrentProject === 'function') window.saveCurrentProject();
      } catch (_err3) {}
    }

    window.setTimeout(refreshAgentPanel, 0);
  }

  function refreshAgentPanel() {
    var card = ensureAgentPanel();
    if (!card) return null;

    var ar = isArabic();
    var title = document.getElementById('engineering-agent-title');
    if (title) title.textContent = ar ? 'المراجع الهندسي الذكي' : 'Smart Engineering Reviewer';

    var result = runEngineeringValidation();
    renderAgentMetrics(result.snapshot, result, ar);
    renderWorkflowState(result.workflow, ar);
    renderReadinessGate(result.readiness, ar);
    renderAgentCommands(result, ar);
    card.setAttribute('data-health', normalizeStatus(result.health));
    return result;
  }

  function wrapRefresh(fnName) {
    var original = window[fnName];
    if (typeof original !== 'function' || original.__engineeringAgentWrapped) return;
    var wrapped = function () {
      var result = original.apply(this, arguments);
      window.setTimeout(refreshAgentPanel, 0);
      return result;
    };
    wrapped.__engineeringAgentWrapped = true;
    window[fnName] = wrapped;
  }

  function installAgentPanel() {
    refreshAgentPanel();
    [
      'doCalc',
      'addToQuote',
      'clearHist',
      'saveCurrentProject',
      'setQuoteMode',
      'renderDesktopInsightPanel',
      'renderProjBlock',
      'renderHist',
      'renderQuote'
    ].forEach(wrapRefresh);
    wrapDeliverableGuard('exportTechPDF', 'report');
    wrapDeliverableGuard('exportTechPDFFromPanel', 'report');
    wrapDeliverableGuard('exportPDF', 'quote');
    window.setTimeout(refreshAgentPanel, 250);
  }

  window.AppEngineeringAgent = {
    buildEngineeringSnapshot: buildEngineeringSnapshot,
    buildNextActions: buildNextActions,
    buildRoomDiagnostics: buildRoomDiagnostics,
    buildReportReadiness: buildReportReadiness,
    buildWorkflowState: buildWorkflowState,
    runEngineeringValidation: runEngineeringValidation,
    guideAction: guideAction,
    runAgentCommand: runAgentCommand,
    normalizeStatus: normalizeStatus,
    refreshAgentPanel: refreshAgentPanel
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', installAgentPanel);
  } else {
    window.setTimeout(installAgentPanel, 0);
  }
})();
