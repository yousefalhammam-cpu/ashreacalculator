(function (root, factory) {
  'use strict';
  var knowledge = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = knowledge;
  root.AirCalcEngineeringKnowledge = knowledge;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  function clone(value) {
    if (value == null) return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_err) {
      return value;
    }
  }

  function objectOrEmpty(value) {
    return value && typeof value === 'object' ? value : {};
  }

  function arrayOrEmpty(value) {
    return Array.isArray(value) ? value : [];
  }

  function getDataSourceStatus() {
    var status = objectOrEmpty(root.ENGINEERING_SOURCE_STATUS);
    return {
      healthcareRoomValues: status.healthcareRoomValues || {
        status: 'requires_source_confirmation',
        basis: 'Healthcare values require confirmation against the adopted ASHRAE 170 edition and local authority requirements.',
        scope: ['healthcare room airflow, pressure, temperature, and humidity values'],
        approvalRequiredBeforeFinalDesign: true,
        todo: 'Confirm against the adopted ASHRAE 170 edition and local authority requirements before final design approval.'
      },
      generalRoomLoadFactors: status.generalRoomLoadFactors || {
        status: 'preliminary_app_baseline',
        basis: 'General quick-load factors are preliminary application baselines.',
        approvalRequiredBeforeFinalDesign: true,
        todo: 'Confirm project load basis or replace with detailed envelope/load calculation where required.'
      }
    };
  }

  var REFERENCES = [
    {
      id: 'ashrae_170_healthcare',
      title: 'ASHRAE 170 healthcare ventilation requirements',
      category: 'healthcare',
      sourceStatusKey: 'healthcareRoomValues',
      approvalRequiredBeforeFinalDesign: true
    },
    {
      id: 'ashrae_62_1_ventilation',
      title: 'ASHRAE 62.1 baseline ventilation reference',
      category: 'ventilation',
      sourceStatusKey: 'generalRoomLoadFactors',
      approvalRequiredBeforeFinalDesign: true
    },
    {
      id: 'aircalc_preliminary_quick_load',
      title: 'AirCalc Pro preliminary quick-load basis',
      category: 'load_calculation',
      sourceStatusKey: 'generalRoomLoadFactors',
      approvalRequiredBeforeFinalDesign: true
    }
  ];

  var GLOSSARY = {
    btuh: {
      term: 'BTU/h',
      description: 'Cooling or heating rate in British thermal units per hour.',
      unitType: 'capacity'
    },
    tr: {
      term: 'TR',
      description: 'Ton of refrigeration. AirCalc uses 12,000 BTU/h per TR.',
      unitType: 'capacity'
    },
    cfm: {
      term: 'CFM',
      description: 'Cubic feet per minute airflow rate.',
      unitType: 'airflow'
    },
    ach: {
      term: 'ACH',
      description: 'Air changes per hour.',
      unitType: 'ventilation'
    },
    esp: {
      term: 'ESP',
      description: 'External static pressure available from or required of the air-handling equipment.',
      unitType: 'pressure'
    },
    mixed_air: {
      term: 'Mixed Air',
      description: 'Combination of outdoor air and recirculated return air.',
      unitType: 'ventilation'
    }
  };

  var DESIGN_ASSUMPTIONS = {
    calculationSource: 'Engineering Calculation Engine is the only source of engineering calculation values.',
    aiBoundary: 'AI may explain deterministic outputs but must not generate engineering values or override rules.',
    sampleDataBoundary: 'Sample equipment data must not be used for final engineering selection.',
    finalApprovalBoundary: 'Source-confirmation TODO items require qualified HVAC engineering review before final approval.'
  };

  function getCalculationConstants() {
    var engine = objectOrEmpty(root.AirCalcEngineering);
    return clone(engine.CONSTANTS || {});
  }

  function getValidationThresholds() {
    var engine = objectOrEmpty(root.AirCalcEngineering);
    return clone(engine.VALIDATION_THRESHOLDS || {});
  }

  function getAssumptionSources() {
    var engine = objectOrEmpty(root.AirCalcEngineering);
    return clone(engine.ASSUMPTION_SOURCES || {});
  }

  function allRooms() {
    return objectOrEmpty(root.ROOMS);
  }

  function getHealthcareRoomRequirements(roomId) {
    var room = allRooms()[roomId];
    if (!room || room.mode !== 'hc') return null;
    var totalAch = room.ach == null ? room.tach : room.ach;
    var outdoorAch = room.oa == null ? room.oach : room.oa;
    var pressure = room.pressure == null ? room.pres : room.pressure;
    return {
      roomId: roomId,
      nameAr: room.ar || '',
      nameEn: room.en || '',
      totalAch: totalAch == null ? null : Number(totalAch),
      outdoorAch: outdoorAch == null ? null : Number(outdoorAch),
      pressure: pressure || null,
      temperatureRange: arrayOrEmpty(room.tr),
      humidityRange: arrayOrEmpty(room.rh),
      sourceStatus: clone(getDataSourceStatus().healthcareRoomValues),
      sourceReferenceId: 'ashrae_170_healthcare'
    };
  }

  function listHealthcareRoomRequirements() {
    var rooms = allRooms();
    return Object.keys(rooms)
      .map(function (roomId) { return getHealthcareRoomRequirements(roomId); })
      .filter(Boolean);
  }

  function getReference(id) {
    return clone(REFERENCES.filter(function (ref) { return ref.id === id; })[0] || null);
  }

  function listReferences() {
    return clone(REFERENCES);
  }

  function getGlossaryTerm(key) {
    return clone(GLOSSARY[String(key || '').toLowerCase()] || null);
  }

  function listGlossary() {
    return clone(GLOSSARY);
  }

  function getValidationRule(ruleId) {
    var thresholds = getValidationThresholds();
    var rules = {
      capacity_match_band: {
        id: 'capacity_match_band',
        title: 'Selected capacity match band',
        source: 'Engineering Calculation Engine validation thresholds',
        threshold: thresholds.MATCH_MAX_OVERSIZE_PCT,
        unit: 'percent'
      },
      high_oversize_review: {
        id: 'high_oversize_review',
        title: 'High oversize review threshold',
        source: 'Engineering Calculation Engine validation thresholds',
        threshold: thresholds.GENERAL_OVERSIZE_HIGH_PCT,
        unit: 'percent'
      },
      esp_low_review: {
        id: 'esp_low_review',
        title: 'Low ESP review threshold',
        source: 'Engineering Calculation Engine validation thresholds',
        threshold: thresholds.ESP_LOW_MAX_PA,
        unit: 'Pa'
      }
    };
    return clone(rules[ruleId] || null);
  }

  function listValidationRules() {
    return ['capacity_match_band', 'high_oversize_review', 'esp_low_review']
      .map(getValidationRule)
      .filter(Boolean);
  }

  function getKnowledgeSummary() {
    var sourceStatus = getDataSourceStatus();
    return {
      layer: 'Engineering Knowledge Base',
      independentFromAi: true,
      calculationEngineIsSourceOfTruth: true,
      references: REFERENCES.length,
      healthcareRooms: listHealthcareRoomRequirements().length,
      glossaryTerms: Object.keys(GLOSSARY).length,
      sourceStatus: clone(sourceStatus)
    };
  }

  return {
    DESIGN_ASSUMPTIONS: clone(DESIGN_ASSUMPTIONS),
    getDataSourceStatus: getDataSourceStatus,
    getCalculationConstants: getCalculationConstants,
    getValidationThresholds: getValidationThresholds,
    getAssumptionSources: getAssumptionSources,
    getHealthcareRoomRequirements: getHealthcareRoomRequirements,
    listHealthcareRoomRequirements: listHealthcareRoomRequirements,
    getReference: getReference,
    listReferences: listReferences,
    getGlossaryTerm: getGlossaryTerm,
    listGlossary: listGlossary,
    getValidationRule: getValidationRule,
    listValidationRules: listValidationRules,
    getKnowledgeSummary: getKnowledgeSummary
  };
});
