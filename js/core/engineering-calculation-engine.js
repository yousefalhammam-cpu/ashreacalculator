(function (root, factory) {
  'use strict';
  var engine = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = engine;
  root.AirCalcEngineering = engine;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  var CONSTANTS = {
    W_TO_BTUH: 3.41214,
    M3_TO_FT3: 35.3147,
    M2_TO_FT2: 10.7639,
    CFM_TO_LPS: 0.47194745,
    BTUH_TO_KW: 0.00029307107,
    TR_TO_BTUH: 12000,
    TR_TO_KW: 3.5168525,
    DEFAULT_PEOPLE_BTUH: 400,
    DEFAULT_SAFETY_FACTOR: 1.10,
    DEFAULT_CFM_PER_TR: 400,
    DEFAULT_MARKET_STEP_BTUH: 9000,
    DEFAULT_HEALTHCARE_DELTA_T_F: 20,
    AIR_HEAT_CONSTANT_IP: 1.08,
    FT2_TO_MM2: 92903.04,
    PA_TO_INWG: 1 / 249.0889,
    INWG_TO_PA: 249.089,
    FPM_TO_MS: 0.00508,
    FT_TO_M: 0.3048,
    MM_TO_FT: 0.00328084,
    ADVANCED_DUCT_FRICTION_FACTOR: 0.02
  };

  var VALIDATION_THRESHOLDS = {
    // Current app behavior: 0% to +10% selected capacity/airflow is treated as matched.
    // TODO: Confirm acceptable oversizing bands by system type, humidity control needs, and owner criteria.
    MATCH_MAX_OVERSIZE_PCT: 10,
    CAPACITY_REVIEW_MAX_OVERSIZE_PCT: 20,
    GENERAL_OVERSIZE_HIGH_PCT: 25,

    // Current app behavior for duct velocity review. These are preliminary acoustic/static-pressure guidance limits.
    // TODO: Confirm by occupancy, duct location, diffuser selection, and project acoustic criteria.
    DUCT_SUPPLY_PASS_MAX_FPM: 1200,
    DUCT_RETURN_PASS_MAX_FPM: 1000,
    DUCT_REVIEW_MAX_FPM: 1400,

    // Conservative unified ESP review bands for the current preliminary workflow.
    // TODO: Confirm final project basis against unit fan tables and duct layout.
    ESP_LOW_MAX_PA: 125,
    ESP_VALIDATION_REVIEW_MAX_PA: 225,
    ESP_SUMMARY_MEDIUM_MAX_PA: 225
  };

  var ASSUMPTION_SOURCES = {
    DEFAULT_PEOPLE_BTUH: 'Current app preliminary default; requires review by occupancy/activity type.',
    DEFAULT_SAFETY_FACTOR: 'Current app behavior: 10% safety factor.',
    DEFAULT_CFM_PER_TR: 'Current app behavior: preliminary 400 CFM/TR airflow estimate.',
    DEFAULT_MARKET_STEP_BTUH: 'Current app behavior for Saudi market capacity rounding step.',
    DEFAULT_HEALTHCARE_DELTA_T_F: 'Current app preliminary healthcare load delta-T; requires project design-basis confirmation.',
    AIR_HEAT_CONSTANT_IP: 'Imperial sensible heat equation constant used by current app: BTU/h = 1.08 * CFM * deltaT[F].',
    VALIDATION_THRESHOLDS: 'Current app review bands; not a final code compliance basis.'
  };

  function number(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function nonNegative(value, fallback) {
    return Math.max(0, number(value, fallback));
  }

  function positive(value, fallback) {
    var n = number(value, fallback);
    return n > 0 ? n : (fallback || 0);
  }

  function validateNonNegative(input, fields) {
    var errors = [];
    fields.forEach(function (field) {
      if (number(input[field], 0) < 0) errors.push(field + ' must be non-negative.');
    });
    return errors;
  }

  function round(value, digits) {
    var p = Math.pow(10, digits || 0);
    return Math.round(number(value, 0) * p) / p;
  }

  function wattsToBtuh(watts) {
    return Math.round(nonNegative(watts) * CONSTANTS.W_TO_BTUH);
  }

  function m3ToFt3(m3) {
    return nonNegative(m3) * CONSTANTS.M3_TO_FT3;
  }

  function m2ToFt2(m2) {
    return nonNegative(m2) * CONSTANTS.M2_TO_FT2;
  }

  function cfmToLps(cfm) {
    return nonNegative(cfm) * CONSTANTS.CFM_TO_LPS;
  }

  function btuhToKw(btuh) {
    return nonNegative(btuh) * CONSTANTS.BTUH_TO_KW;
  }

  function trToKw(tr) {
    return nonNegative(tr) * CONSTANTS.TR_TO_KW;
  }

  function btuhToTr(btuh) {
    return nonNegative(btuh) / CONSTANTS.TR_TO_BTUH;
  }

  function trToBtuh(tr) {
    return nonNegative(tr) * CONSTANTS.TR_TO_BTUH;
  }

  function convertUnit(input) {
    input = input || {};
    var errors = validateNonNegative(input, ['value']);
    var from = String(input.from || '').toLowerCase();
    var to = String(input.to || '').toLowerCase();
    var value = number(input.value, 0);
    var key = from + '->' + to;
    var factors = {
      'm2->ft2': CONSTANTS.M2_TO_FT2,
      'ft2->m2': 1 / CONSTANTS.M2_TO_FT2,
      'm3->ft3': CONSTANTS.M3_TO_FT3,
      'ft3->m3': 1 / CONSTANTS.M3_TO_FT3,
      'cfm->lps': CONSTANTS.CFM_TO_LPS,
      'lps->cfm': 1 / CONSTANTS.CFM_TO_LPS,
      'btuh->kw': CONSTANTS.BTUH_TO_KW,
      'kw->btuh': 1 / CONSTANTS.BTUH_TO_KW,
      'tr->kw': CONSTANTS.TR_TO_KW,
      'kw->tr': 1 / CONSTANTS.TR_TO_KW,
      'btuh->tr': 1 / CONSTANTS.TR_TO_BTUH,
      'tr->btuh': CONSTANTS.TR_TO_BTUH
    };

    if (!from) errors.push('from unit is required.');
    if (!to) errors.push('to unit is required.');
    if (from && to && from !== to && !Object.prototype.hasOwnProperty.call(factors, key)) {
      errors.push('unsupported unit conversion: ' + from + ' to ' + to + '.');
    }
    if (errors.length) return { ok: false, errors: errors };

    return {
      ok: true,
      value: from === to ? value : value * factors[key],
      from: from,
      to: to
    };
  }

  function marketRoundBtuh(btuh, stepBtuh) {
    var step = positive(stepBtuh, CONSTANTS.DEFAULT_MARKET_STEP_BTUH);
    var load = nonNegative(btuh);
    return load > 0 ? Math.ceil(load / step) * step : 0;
  }

  function calculateMarketCapacity(input) {
    input = input || {};
    var errors = validateNonNegative(input, [
      'btuh',
      'stepBtuh'
    ]);
    if (errors.length) return { ok: false, errors: errors };

    var step = positive(input.stepBtuh, CONSTANTS.DEFAULT_MARKET_STEP_BTUH);
    if (step <= 0) return { ok: false, errors: ['stepBtuh must be greater than zero.'] };

    var load = nonNegative(input.btuh);
    return {
      ok: true,
      requiredBtuh: load,
      stepBtuh: step,
      marketBtuh: load > 0 ? Math.ceil(load / step) * step : 0
    };
  }

  function calculateGeneralRoom(input) {
    input = input || {};
    var errors = validateNonNegative(input, [
      'volumeM3',
      'loadFactorBtuhPerM3',
      'insulationMultiplier',
      'windowLoadBtuh',
      'peopleCount',
      'peopleBtuh',
      'deviceLoadBtuh',
      'safetyFactor',
      'cfmPerTr',
      'marketStepBtuh'
    ]);
    if (errors.length) return { ok: false, errors: errors };

    var volumeM3 = nonNegative(input.volumeM3);
    var loadFactor = nonNegative(input.loadFactorBtuhPerM3);
    var insulationMultiplier = positive(input.insulationMultiplier, 1);
    var windowLoadBtuh = nonNegative(input.windowLoadBtuh);
    var peopleBtuh = nonNegative(input.peopleCount) * positive(input.peopleBtuh, CONSTANTS.DEFAULT_PEOPLE_BTUH);
    var deviceLoadBtuh = nonNegative(input.deviceLoadBtuh);
    var safetyFactor = positive(input.safetyFactor, CONSTANTS.DEFAULT_SAFETY_FACTOR);
    var cfmPerTr = positive(input.cfmPerTr, CONSTANTS.DEFAULT_CFM_PER_TR);

    // General HVAC quick-load method used by the current app:
    // base load [BTU/h] = room volume [m3] * climate/load factor [BTU/h per m3] * insulation multiplier.
    var baseBtuh = volumeM3 * loadFactor * insulationMultiplier;
    var subtotalBtuh = baseBtuh + windowLoadBtuh + peopleBtuh + deviceLoadBtuh;
    var totalBtuh = subtotalBtuh * safetyFactor;
    var tr = btuhToTr(totalBtuh);
    var supplyCfm = Math.round(tr * cfmPerTr);

    return {
      ok: true,
      baseBtuh: baseBtuh,
      windowLoadBtuh: windowLoadBtuh,
      peopleBtuh: peopleBtuh,
      deviceLoadBtuh: deviceLoadBtuh,
      subtotalBtuh: subtotalBtuh,
      totalBtuh: totalBtuh,
      tr: tr,
      supplyCfm: supplyCfm,
      marketBtuh: marketRoundBtuh(totalBtuh, input.marketStepBtuh)
    };
  }

  function airflowFromAch(volumeM3, ach) {
    // ACH airflow: CFM = ACH * volume[ft3] / 60.
    return Math.round((nonNegative(ach) * m3ToFt3(volumeM3)) / 60);
  }

  function exhaustFromPressure(supplyCfm, pressure) {
    var p = String(pressure || 'neutral').toLowerCase();
    if (p === 'negative') return Math.round(nonNegative(supplyCfm) * 1.10);
    if (p === 'positive') return Math.round(nonNegative(supplyCfm) * 0.90);
    return Math.round(nonNegative(supplyCfm));
  }

  function calculateHealthcareRoom(input) {
    input = input || {};
    var errors = validateNonNegative(input, [
      'volumeM3',
      'totalAch',
      'outdoorAch',
      'peopleCount',
      'peopleBtuh',
      'deviceLoadBtuh',
      'safetyFactor',
      'airHeatConstant',
      'deltaTF',
      'marketStepBtuh'
    ]);
    if (errors.length) return { ok: false, errors: errors };

    var volumeM3 = nonNegative(input.volumeM3);
    var totalAch = nonNegative(input.totalAch);
    var outdoorAch = nonNegative(input.outdoorAch);
    var freshAirMode = input.freshAirMode === 'fresh100' ? 'fresh100' : 'ashrae';
    var supplyCfm = airflowFromAch(volumeM3, totalAch);
    var outdoorAirCfm = freshAirMode === 'fresh100'
      ? airflowFromAch(volumeM3, totalAch)
      : airflowFromAch(volumeM3, outdoorAch);
    var recirculatedCfm = Math.max(0, supplyCfm - outdoorAirCfm);
    var exhaustCfm = exhaustFromPressure(supplyCfm, input.pressure);

    // Healthcare load currently follows the existing app formula:
    // ventilation sensible load [BTU/h] = supply CFM * 1.08 * deltaT[F].
    // TODO: Verify room-by-room load assumptions against the governing project HVAC basis before using as final design.
    var baseBtuh = supplyCfm *
      positive(input.airHeatConstant, CONSTANTS.AIR_HEAT_CONSTANT_IP) *
      positive(input.deltaTF, CONSTANTS.DEFAULT_HEALTHCARE_DELTA_T_F);
    var peopleBtuh = nonNegative(input.peopleCount) * positive(input.peopleBtuh, CONSTANTS.DEFAULT_PEOPLE_BTUH);
    var deviceLoadBtuh = nonNegative(input.deviceLoadBtuh);
    var subtotalBtuh = baseBtuh + peopleBtuh + deviceLoadBtuh;
    var totalBtuh = subtotalBtuh * positive(input.safetyFactor, CONSTANTS.DEFAULT_SAFETY_FACTOR);
    var tr = btuhToTr(totalBtuh);

    return {
      ok: true,
      supplyCfm: supplyCfm,
      outdoorAirCfm: outdoorAirCfm,
      recirculatedCfm: recirculatedCfm,
      exhaustCfm: exhaustCfm,
      baseBtuh: baseBtuh,
      peopleBtuh: peopleBtuh,
      deviceLoadBtuh: deviceLoadBtuh,
      subtotalBtuh: subtotalBtuh,
      totalBtuh: totalBtuh,
      tr: tr,
      marketBtuh: marketRoundBtuh(totalBtuh, input.marketStepBtuh)
    };
  }

  function calculateMixedAir(input) {
    input = input || {};
    var errors = validateNonNegative(input, [
      'supplyCfm',
      'outdoorAirCfm'
    ]);
    if (errors.length) return { ok: false, errors: errors };

    var supplyCfm = nonNegative(input.supplyCfm);
    var outdoorAirCfm = Math.min(supplyCfm, nonNegative(input.outdoorAirCfm));
    return {
      ok: true,
      supplyCfm: supplyCfm,
      outdoorAirCfm: outdoorAirCfm,
      recirculatedCfm: Math.max(0, supplyCfm - outdoorAirCfm),
      outdoorAirPercent: supplyCfm > 0 ? round((outdoorAirCfm / supplyCfm) * 100, 1) : 0
    };
  }

  function ductCandidateScore(widthMm, heightMm, areaRequiredMm2, actualFpm) {
    var ratio = Math.max(widthMm, heightMm) / Math.min(widthMm, heightMm);
    var oversize = ((widthMm * heightMm) - areaRequiredMm2) / Math.max(areaRequiredMm2, 1);
    var ratioPenalty = Math.abs(ratio - 2);
    var velocityPenalty = actualFpm > 2500 ? 1000 + (actualFpm - 2500) : 0;
    return velocityPenalty + (oversize * 10) + ratioPenalty;
  }

  function makeDuctCandidate(widthMm, heightMm, areaRequiredMm2, cfm, method) {
    var areaFt2 = (widthMm * heightMm) / CONSTANTS.FT2_TO_MM2;
    var actualFpm = areaFt2 > 0 ? Math.round(nonNegative(cfm) / areaFt2) : 0;
    return {
      w: widthMm,
      h: heightMm,
      area_required: Math.round(areaRequiredMm2),
      area_actual: widthMm * heightMm,
      ratio: (Math.max(widthMm, heightMm) / Math.min(widthMm, heightMm)).toFixed(2),
      method: method,
      actualFpm: actualFpm,
      score: ductCandidateScore(widthMm, heightMm, areaRequiredMm2, actualFpm)
    };
  }

  function calculateDuctSize(input) {
    input = input || {};
    var errors = validateNonNegative(input, [
      'cfm',
      'velocityFpm',
      'minSideMm',
      'maxSideMm',
      'maxAspectRatio'
    ]);
    if (errors.length) return { ok: false, errors: errors };

    var cfm = nonNegative(input.cfm);
    var velocityFpm = positive(input.velocityFpm, 1000);
    if (!cfm) return null;

    var ductStd = Array.isArray(input.standardSizes) ? input.standardSizes : [];
    var areaFt2 = cfm / velocityFpm;
    var areaMm2 = areaFt2 * CONSTANTS.FT2_TO_MM2;
    var minSide = positive(input.minSideMm, 150);
    var maxSide = positive(input.maxSideMm, 1800);
    var maxAspectRatio = positive(input.maxAspectRatio, 4);
    var preferredHeights = input.preferredHeightsMm || [150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800];
    var stdBest = null;
    var best = null;

    ductStd.forEach(function (size) {
      var sw = number(size[0], 0);
      var sh = number(size[1], 0);
      var ratio = Math.max(sw, sh) / Math.min(sw, sh);
      if (sw >= minSide && sh >= minSide && sw <= maxSide && sh <= maxSide &&
          ratio <= maxAspectRatio && sw * sh >= areaMm2) {
        var cand = makeDuctCandidate(sw, sh, areaMm2, cfm, 'std');
        if (!stdBest || cand.score < stdBest.score) stdBest = cand;
      }
    });

    preferredHeights.forEach(function (heightMm) {
      var h = positive(heightMm, 0);
      if (!h) return;
      var w = Math.max(minSide, Math.ceil((areaMm2 / h) / 50) * 50);
      var ratio = Math.max(w, h) / Math.min(w, h);
      if (w <= maxSide && ratio <= maxAspectRatio) {
        var cand = makeDuctCandidate(w, h, areaMm2, cfm, 'calc');
        if (!best || cand.score < best.score) best = cand;
      }
    });

    if (!best) {
      var fallbackHeight = 800;
      var fallbackWidth = Math.max(minSide, Math.ceil((areaMm2 / fallbackHeight) / 50) * 50);
      best = makeDuctCandidate(fallbackWidth, fallbackHeight, areaMm2, cfm, 'calc');
    }

    return { ok: true, calc: best, std: stdBest || best };
  }

  function rectangularDuctAreaFt2(widthMm, heightMm) {
    return (nonNegative(widthMm) * nonNegative(heightMm)) / CONSTANTS.FT2_TO_MM2;
  }

  function rectangularDuctPerimeterFt(widthMm, heightMm) {
    return 2 * (nonNegative(widthMm) + nonNegative(heightMm)) * CONSTANTS.MM_TO_FT;
  }

  function hydraulicDiameter(widthMm, heightMm) {
    var areaFt2 = rectangularDuctAreaFt2(widthMm, heightMm);
    var perimeterFt = rectangularDuctPerimeterFt(widthMm, heightMm);
    if (perimeterFt <= 0) return { Dh_ft: 0, Dh_in: 0, Dh_mm: 0 };
    var dhFt = (4 * areaFt2) / perimeterFt;
    return {
      Dh_ft: dhFt,
      Dh_in: dhFt * 12,
      Dh_mm: dhFt / CONSTANTS.MM_TO_FT
    };
  }

  function ductVelocity(input) {
    input = input || {};
    var errors = validateNonNegative(input, ['cfm', 'areaFt2']);
    if (errors.length) return { ok: false, errors: errors };

    var areaFt2 = nonNegative(input.areaFt2);
    if (areaFt2 <= 0) return { ok: true, V_fpm: 0, V_ms: 0 };
    var velocityFpm = nonNegative(input.cfm) / areaFt2;
    return {
      ok: true,
      V_fpm: velocityFpm,
      V_ms: velocityFpm * CONSTANTS.FPM_TO_MS
    };
  }

  function velocityPressure(input) {
    input = input || {};
    var errors = validateNonNegative(input, ['velocityFpm']);
    if (errors.length) return { ok: false, errors: errors };

    // ASHRAE duct velocity pressure relationship for standard air:
    // Pv [in.w.g.] = (V[fpm] / 4005)^2.
    var pvInwg = Math.pow(nonNegative(input.velocityFpm) / 4005, 2);
    return {
      ok: true,
      Pv_inwg: pvInwg,
      Pv_pa: pvInwg * CONSTANTS.INWG_TO_PA
    };
  }

  function straightFrictionLoss(input) {
    input = input || {};
    var errors = validateNonNegative(input, ['lengthFt', 'hydraulicDiameterFt', 'velocityPressureInwg', 'frictionFactor']);
    if (errors.length) return { ok: false, errors: errors };

    var dhFt = nonNegative(input.hydraulicDiameterFt);
    var f = positive(input.frictionFactor, CONSTANTS.ADVANCED_DUCT_FRICTION_FACTOR);
    if (dhFt <= 0) return { ok: true, dP_inwg: 0, dP_pa: 0, dP_per100ft_inwg: 0 };

    // Darcy-Weisbach duct friction approximation used by the current advanced duct panel:
    // deltaP = f * (L / Dh) * Pv. TODO: Confirm f against final material/roughness and Reynolds range.
    var pvInwg = nonNegative(input.velocityPressureInwg);
    var dPInwg = f * (nonNegative(input.lengthFt) / dhFt) * pvInwg;
    var per100 = f * (100 / dhFt) * pvInwg;
    return {
      ok: true,
      dP_inwg: dPInwg,
      dP_pa: dPInwg * CONSTANTS.INWG_TO_PA,
      dP_per100ft_inwg: per100
    };
  }

  function calculateAdvancedDuctAnalysis(input) {
    input = input || {};
    var errors = validateNonNegative(input, [
      'cfm',
      'widthMm',
      'heightMm',
      'lengthM',
      'frictionFactor'
    ]);
    if (errors.length) return { ok: false, errors: errors };

    var cfm = nonNegative(input.cfm);
    var widthMm = nonNegative(input.widthMm);
    var heightMm = nonNegative(input.heightMm);
    if (!cfm || !widthMm || !heightMm) return null;

    var lengthM = nonNegative(input.lengthM);
    var lengthFt = lengthM / CONSTANTS.FT_TO_M;
    var areaFt2 = rectangularDuctAreaFt2(widthMm, heightMm);
    var areaM2 = areaFt2 * 0.0929;
    var dh = hydraulicDiameter(widthMm, heightMm);
    var velocity = ductVelocity({ cfm: cfm, areaFt2: areaFt2 });
    var pv = velocityPressure({ velocityFpm: velocity.V_fpm });
    var friction = lengthFt > 0
      ? straightFrictionLoss({
        lengthFt: lengthFt,
        hydraulicDiameterFt: dh.Dh_ft,
        velocityPressureInwg: pv.Pv_inwg,
        frictionFactor: input.frictionFactor
      })
      : null;

    return {
      ok: true,
      Q_cfm: cfm,
      W_mm: widthMm,
      H_mm: heightMm,
      L_m: lengthM,
      L_ft: round(lengthFt, 1),
      A_ft2: round(areaFt2, 4),
      A_m2: round(areaM2, 4),
      V_fpm: Math.round(velocity.V_fpm),
      V_ms: round(velocity.V_ms, 2),
      Dh_in: round(dh.Dh_in, 1),
      Dh_mm: Math.round(dh.Dh_mm),
      Pv_inwg: round(pv.Pv_inwg, 3),
      Pv_pa: round(pv.Pv_pa, 1),
      dP_inwg: friction ? round(friction.dP_inwg, 3) : null,
      dP_pa: friction ? round(friction.dP_pa, 1) : null,
      dP_per100ft_inwg: friction ? round(friction.dP_per100ft_inwg, 3) : null,
      f_used: positive(input.frictionFactor, CONSTANTS.ADVANCED_DUCT_FRICTION_FACTOR),
      note: 'Darcy-Weisbach, f=0.02 (galvanised steel, preliminary). ASHRAE Ch.21.'
    };
  }

  function resolveDuctCfm(input) {
    input = input || {};
    var errors = validateNonNegative(input, [
      'selectedBtuh',
      'cfmPerTr',
      'fallbackCfm',
      'catalogCfm'
    ]);
    if (errors.length) return { ok: false, errors: errors };

    var selectedBtuh = nonNegative(input.selectedBtuh);
    var cfmPerTr = positive(input.cfmPerTr, CONSTANTS.DEFAULT_CFM_PER_TR);
    var fallbackCfm = nonNegative(input.fallbackCfm);
    var catalogCfm = nonNegative(input.catalogCfm);
    if (catalogCfm > 0) return { cfm: catalogCfm, source: 'unit' };
    if (selectedBtuh > 0) return { cfm: Math.round(btuhToTr(selectedBtuh) * cfmPerTr), source: 'tr' };
    return { cfm: Math.max(1, fallbackCfm), source: 'calc' };
  }

  function calculateEsp(input) {
    input = input || {};
    var errors = validateNonNegative(input, [
      'lenSupM',
      'lenRetM',
      'bends',
      'frictionPaPerM',
      'bendLossPerPa',
      'filterLossPa',
      'diffuserLossPa',
      'coilLossPa',
      'damperLossPa',
      'otherLossPa'
    ]);
    if (errors.length) return { ok: false, errors: errors };

    var lenSup = nonNegative(input.lenSupM);
    var lenRet = nonNegative(input.lenRetM);
    var bends = Math.max(0, Math.round(nonNegative(input.bends)));
    var frictionPaPerM = nonNegative(input.frictionPaPerM);
    var bendLossPa = bends * nonNegative(input.bendLossPerPa);
    var adders = nonNegative(input.filterLossPa) +
      nonNegative(input.diffuserLossPa) +
      nonNegative(input.coilLossPa) +
      nonNegative(input.damperLossPa) +
      nonNegative(input.otherLossPa);
    var straight = (lenSup + lenRet) * frictionPaPerM;
    var totalPa = straight + bendLossPa + adders;
    var status = totalPa < VALIDATION_THRESHOLDS.ESP_LOW_MAX_PA
      ? { key: 'low', ar: 'منخفض', en: 'Low' }
      : totalPa <= VALIDATION_THRESHOLDS.ESP_SUMMARY_MEDIUM_MAX_PA
        ? { key: 'med', ar: 'متوسط', en: 'Medium' }
        : { key: 'high', ar: 'عال', en: 'High' };

    return {
      ok: true,
      straightFrictionPa: round(straight, 1),
      bendLossPa: round(bendLossPa, 1),
      filterLossPa: nonNegative(input.filterLossPa),
      diffuserLossPa: nonNegative(input.diffuserLossPa),
      coilLossPa: nonNegative(input.coilLossPa),
      damperLossPa: nonNegative(input.damperLossPa),
      otherLossPa: nonNegative(input.otherLossPa),
      addersPa: round(adders, 1),
      totalPa: round(totalPa, 1),
      totalInwg: round(totalPa * CONSTANTS.PA_TO_INWG, 2),
      status: status
    };
  }

  return {
    CONSTANTS: CONSTANTS,
    VALIDATION_THRESHOLDS: VALIDATION_THRESHOLDS,
    ASSUMPTION_SOURCES: ASSUMPTION_SOURCES,
    validateNonNegative: validateNonNegative,
    wattsToBtuh: wattsToBtuh,
    m3ToFt3: m3ToFt3,
    m2ToFt2: m2ToFt2,
    cfmToLps: cfmToLps,
    btuhToKw: btuhToKw,
    trToKw: trToKw,
    btuhToTr: btuhToTr,
    trToBtuh: trToBtuh,
    convertUnit: convertUnit,
    marketRoundBtuh: marketRoundBtuh,
    calculateMarketCapacity: calculateMarketCapacity,
    airflowFromAch: airflowFromAch,
    exhaustFromPressure: exhaustFromPressure,
    calculateGeneralRoom: calculateGeneralRoom,
    calculateHealthcareRoom: calculateHealthcareRoom,
    calculateMixedAir: calculateMixedAir,
    calculateDuctSize: calculateDuctSize,
    rectangularDuctAreaFt2: rectangularDuctAreaFt2,
    rectangularDuctPerimeterFt: rectangularDuctPerimeterFt,
    hydraulicDiameter: hydraulicDiameter,
    ductVelocity: ductVelocity,
    velocityPressure: velocityPressure,
    straightFrictionLoss: straightFrictionLoss,
    calculateAdvancedDuctAnalysis: calculateAdvancedDuctAnalysis,
    resolveDuctCfm: resolveDuctCfm,
    calculateEsp: calculateEsp
  };
});
