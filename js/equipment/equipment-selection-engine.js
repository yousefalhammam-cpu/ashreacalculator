(function () {
  'use strict';

  var DEFAULT_SCORE_WEIGHTS = {
    capacity: 20,
    sensibleCapacity: 10,
    airflow: 15,
    esp: 15,
    electrical: 10,
    outdoorTemperature: 8,
    efficiency: 8,
    marketData: 5,
    verification: 5,
    unitCount: 2,
    otherFactors: 2
  };

  function n(value, fallback) {
    var num = Number(value);
    return isFinite(num) ? num : (fallback || 0);
  }

  function arr(value) {
    return Array.isArray(value) ? value : [];
  }

  function normalizeRecord(record) {
    var schema = window.AirCalcEquipmentSchema;
    return schema && schema.normalizeEquipmentRecord ? schema.normalizeEquipmentRecord(record) : (record || {});
  }

  function isVerifiedRecord(record) {
    var status = String((record && record.verificationStatus) || '').toLowerCase();
    return status === 'verified' || status === 'published';
  }

  function buildRequirements(input) {
    input = input || {};
    return {
      requiredCoolingLoadBtuH: n(input.requiredCoolingLoadBtuH),
      requiredSensibleLoadBtuH: input.requiredSensibleLoadBtuH == null ? null : n(input.requiredSensibleLoadBtuH),
      requiredSupplyCfm: n(input.requiredSupplyCfm),
      requiredEspPa: input.requiredEspPa == null ? null : n(input.requiredEspPa),
      equipmentType: String(input.equipmentType || '').trim(),
      voltage: input.voltage == null ? null : n(input.voltage),
      phase: input.phase == null ? null : n(input.phase),
      frequencyHz: input.frequencyHz == null ? null : n(input.frequencyHz),
      outdoorDesignTemperatureC: input.outdoorDesignTemperatureC == null ? null : n(input.outdoorDesignTemperatureC),
      numberOfUnitsPreference: input.numberOfUnitsPreference || 'auto',
      redundancyPreference: input.redundancyPreference || 'none',
      preferredManufacturers: arr(input.preferredManufacturers).map(function (v) { return String(v).toLowerCase(); }),
      marketRegion: String(input.marketRegion || '').trim(),
      requireSaudiListing: !!input.requireSaudiListing,
      verifiedDataOnly: input.verifiedDataOnly !== false,
      includeSampleData: !!input.includeSampleData,
      maxUnits: Math.max(1, Math.min(8, parseInt(input.maxUnits, 10) || 4)),
      weights: Object.assign({}, DEFAULT_SCORE_WEIGHTS, input.weights || {})
    };
  }

  function isHardFailure(record, req) {
    var reasons = [];
    if (record.sampleData && !req.includeSampleData) reasons.push(reason('sample_data', 'Sample data is excluded from engineering selection.'));
    if (record.discontinued) reasons.push(reason('discontinued', 'Model is discontinued.'));
    if (req.verifiedDataOnly && !isVerifiedRecord(record)) reasons.push(reason('unverified', 'Verified data only is enabled.'));
    if (req.equipmentType && record.equipmentType !== req.equipmentType) reasons.push(reason('equipment_type', 'Equipment type does not match.'));
    if (req.marketRegion && record.marketRegion && record.marketRegion !== req.marketRegion) reasons.push(reason('market_region', 'Market region does not match.'));
    if (req.requireSaudiListing && !['listed', 'available', 'approved', 'verified'].includes(String(record.saudiMarketStatus || '').toLowerCase())) {
      reasons.push(reason('saudi_listing', 'Saudi/GCC availability requires confirmation.'));
    }
    if (req.voltage != null && record.voltage != null && n(record.voltage) !== req.voltage) reasons.push(reason('voltage', 'Voltage does not match.'));
    if (req.phase != null && record.phase != null && n(record.phase) !== req.phase) reasons.push(reason('phase', 'Phase does not match.'));
    if (req.frequencyHz != null && record.frequencyHz != null && n(record.frequencyHz) !== req.frequencyHz) reasons.push(reason('frequency', 'Frequency does not match.'));
    if (req.outdoorDesignTemperatureC != null && record.maxOutdoorTemperatureC != null && n(record.maxOutdoorTemperatureC) < req.outdoorDesignTemperatureC) {
      reasons.push(reason('outdoor_temperature', 'Outdoor design temperature exceeds catalogue maximum.'));
    }
    return reasons;
  }

  function reason(code, message) {
    return { code: code, message: message };
  }

  function capacityStatus(totalCapacity, required) {
    if (!required) return { ok: true, oversizingPercent: 0, undersizedPercent: 0 };
    var diff = totalCapacity - required;
    return {
      ok: diff >= 0,
      oversizingPercent: diff >= 0 ? Math.round((diff / required) * 1000) / 10 : 0,
      undersizedPercent: diff < 0 ? Math.round((Math.abs(diff) / required) * 1000) / 10 : 0
    };
  }

  function buildCombination(record, qty, req, standby) {
    var activeQty = standby ? Math.max(1, qty - 1) : qty;
    var unitCapacity = n(record.coolingCapacityBtuH);
    var unitSensible = record.sensibleCapacityBtuH == null ? null : n(record.sensibleCapacityBtuH);
    var unitCfm = n(record.airflowNominalCfm || record.airflowMaxCfm || record.airflowMinCfm);
    var totalCapacity = unitCapacity * activeQty;
    var totalSensible = unitSensible == null ? null : unitSensible * activeQty;
    var totalAirflow = unitCfm * activeQty;
    var cap = capacityStatus(totalCapacity, req.requiredCoolingLoadBtuH);
    var reasons = [];
    if (!cap.ok) reasons.push(reason('capacity_below_load', 'Total active capacity is below required cooling load.'));
    if (req.requiredSupplyCfm && totalAirflow < req.requiredSupplyCfm) reasons.push(reason('airflow_below_requirement', 'Total active airflow is below required supply CFM.'));
    if (req.requiredEspPa != null && record.availableEspPa != null && n(record.availableEspPa) < req.requiredEspPa) reasons.push(reason('esp_below_requirement', 'Available ESP is below required ESP.'));
    if (req.requiredSensibleLoadBtuH != null && totalSensible != null && totalSensible < req.requiredSensibleLoadBtuH) reasons.push(reason('sensible_capacity_below_requirement', 'Total sensible capacity is below required sensible load.'));
    var score = scoreCombination(record, {
      qty: qty,
      activeQty: activeQty,
      totalCapacityBtuH: totalCapacity,
      totalSensibleCapacityBtuH: totalSensible,
      totalAirflowCfm: totalAirflow,
      standby: standby,
      capacity: cap,
      hardReasons: reasons
    }, req);
    return {
      optionId: record.id + '-x' + qty + (standby ? '-nplus1' : ''),
      equipmentId: record.id,
      record: record,
      quantity: qty,
      activeQuantity: activeQty,
      standbyQuantity: qty - activeQty,
      redundancyLevel: standby ? 'N+1' : 'none',
      totalCapacityBtuH: totalCapacity,
      totalSensibleCapacityBtuH: totalSensible,
      totalAirflowCfm: totalAirflow,
      availableEspPa: record.availableEspPa,
      totalInputPowerKw: record.inputPowerKw == null ? null : n(record.inputPowerKw) * qty,
      oversizingPercent: cap.oversizingPercent,
      undersizedPercent: cap.undersizedPercent,
      installationComplexity: qty === 1 ? 'low' : (qty <= 3 ? 'medium' : 'high'),
      maintenanceImpact: qty === 1 ? 'single point' : 'multiple units',
      dataVerificationQuality: record.verificationStatus || 'unknown',
      rejected: reasons.length > 0,
      rejectionReasons: reasons,
      matchScore: score.total,
      scoreBreakdown: score.breakdown
    };
  }

  function ratioScore(actual, required, max, mode) {
    if (required == null || required <= 0 || actual == null) return Math.round(max * 0.55);
    if (actual < required) return 0;
    var over = (actual - required) / required;
    var penalty = mode === 'capacity' ? Math.min(max, over * max * 1.8) : Math.min(max * 0.65, over * max);
    return Math.max(0, Math.round((max - penalty) * 10) / 10);
  }

  function scoreCombination(record, combo, req) {
    var w = req.weights;
    var efficiencyValue = n(record.seer || record.eer || record.cop || record.iplv);
    var preferred = req.preferredManufacturers.indexOf(String(record.manufacturerId || '').toLowerCase()) >= 0;
    var breakdown = {
      capacity: ratioScore(combo.totalCapacityBtuH, req.requiredCoolingLoadBtuH, w.capacity, 'capacity'),
      sensibleCapacity: req.requiredSensibleLoadBtuH == null || combo.totalSensibleCapacityBtuH == null ? Math.round(w.sensibleCapacity * 0.5) : ratioScore(combo.totalSensibleCapacityBtuH, req.requiredSensibleLoadBtuH, w.sensibleCapacity, 'sensible'),
      airflow: ratioScore(combo.totalAirflowCfm, req.requiredSupplyCfm, w.airflow, 'airflow'),
      esp: req.requiredEspPa == null || record.availableEspPa == null ? Math.round(w.esp * 0.55) : ratioScore(record.availableEspPa, req.requiredEspPa, w.esp, 'esp'),
      electrical: electricalScore(record, req, w.electrical),
      outdoorTemperature: outdoorScore(record, req, w.outdoorTemperature),
      efficiency: efficiencyValue > 0 ? w.efficiency : Math.round(w.efficiency * 0.45),
      marketData: marketScore(record, req, w.marketData),
      verification: isVerifiedRecord(record) ? w.verification : (record.verificationStatus === 'sample' ? 0 : Math.round(w.verification * 0.35)),
      unitCount: unitCountScore(combo, req, w.unitCount),
      otherFactors: preferred ? w.otherFactors : Math.round(w.otherFactors * 0.5)
    };
    var total = Object.keys(breakdown).reduce(function (sum, key) { return sum + n(breakdown[key]); }, 0);
    return { total: Math.max(0, Math.min(100, Math.round(total))), breakdown: breakdown };
  }

  function electricalScore(record, req, max) {
    if (req.voltage == null && req.phase == null && req.frequencyHz == null) return Math.round(max * 0.75);
    if (req.voltage != null && record.voltage != null && n(record.voltage) !== req.voltage) return 0;
    if (req.phase != null && record.phase != null && n(record.phase) !== req.phase) return 0;
    if (req.frequencyHz != null && record.frequencyHz != null && n(record.frequencyHz) !== req.frequencyHz) return 0;
    return max;
  }

  function outdoorScore(record, req, max) {
    if (req.outdoorDesignTemperatureC == null || record.maxOutdoorTemperatureC == null) return Math.round(max * 0.45);
    return n(record.maxOutdoorTemperatureC) >= req.outdoorDesignTemperatureC ? max : 0;
  }

  function marketScore(record, req, max) {
    var status = String(record.saudiMarketStatus || '').toLowerCase();
    if (req.requireSaudiListing) {
      return ['listed', 'available', 'approved', 'verified'].includes(status) ? max : 0;
    }
    if (!status) return Math.round(max * 0.4);
    if (status === 'sample_only') return 0;
    return max;
  }

  function unitCountScore(combo, req, max) {
    if (req.redundancyPreference === 'n_plus_1') return (combo.redundancyLevel === 'N+1' || combo.standby) ? max : 0;
    if (req.numberOfUnitsPreference === 'single') return combo.quantity === 1 ? max : 0;
    return combo.quantity <= 3 ? max : Math.round(max * 0.5);
  }

  function generateCombinations(record, req) {
    var out = [];
    for (var qty = 1; qty <= req.maxUnits; qty++) {
      out.push(buildCombination(record, qty, req, false));
    }
    if (req.redundancyPreference === 'n_plus_1') {
      for (var standbyQty = 2; standbyQty <= req.maxUnits + 1; standbyQty++) {
        out.push(buildCombination(record, standbyQty, req, true));
      }
    }
    return out;
  }

  function selectEquipment(input) {
    var req = buildRequirements(input || {});
    var records = arr((input || {}).records).map(normalizeRecord);
    var rejectedAlternatives = [];
    var candidateOptions = [];
    var missingProjectData = [];
    if (!req.requiredCoolingLoadBtuH) missingProjectData.push('requiredCoolingLoadBtuH');
    if (!req.requiredSupplyCfm) missingProjectData.push('requiredSupplyCfm');
    if (req.requiredEspPa == null) missingProjectData.push('requiredEspPa');

    records.forEach(function (record) {
      var hardReasons = isHardFailure(record, req);
      if (hardReasons.length) {
        rejectedAlternatives.push({
          equipmentId: record.id,
          record: record,
          rejectedBy: 'hard_filter',
          reasons: hardReasons
        });
        return;
      }
      generateCombinations(record, req).forEach(function (combo) {
        if (combo.rejected) {
          rejectedAlternatives.push({
            optionId: combo.optionId,
            equipmentId: record.id,
            record: record,
            rejectedBy: 'engineering_compatibility',
            reasons: combo.rejectionReasons,
            option: combo
          });
        } else {
          candidateOptions.push(combo);
        }
      });
    });

    candidateOptions.sort(function (a, b) {
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return a.oversizingPercent - b.oversizingPercent;
    });
    var buckets = buildRecommendationBuckets(candidateOptions, req);

    return {
      ok: true,
      requirements: req,
      recommendedOption: candidateOptions[0] || null,
      bestAlternative: candidateOptions[1] || null,
      recommendationBuckets: buckets,
      otherSuitableOptions: candidateOptions.slice(2),
      suitableOptions: candidateOptions,
      rejectedAlternatives: rejectedAlternatives,
      missingProjectData: missingProjectData,
      engineerVerificationRequired: buildVerificationItems(candidateOptions[0], req)
    };
  }

  function bestBy(options, scoreFn) {
    return (options || []).slice().sort(function (a, b) {
      var diff = scoreFn(b) - scoreFn(a);
      if (diff !== 0) return diff;
      if (b.matchScore !== a.matchScore) return b.matchScore - a.matchScore;
      return a.oversizingPercent - b.oversizingPercent;
    })[0] || null;
  }

  function marketAvailabilityScore(record) {
    var status = String((record && record.saudiMarketStatus) || '').toLowerCase();
    if (['listed', 'available', 'approved', 'verified'].indexOf(status) >= 0) return 100;
    if (status === 'pending' || status === 'review') return 45;
    return status ? 20 : 0;
  }

  function efficiencyScore(record) {
    record = record || {};
    return n(record.seer || record.eer || record.cop || record.iplv);
  }

  function noiseScore(record) {
    var db = record && record.soundLevelDb == null ? null : n(record.soundLevelDb);
    return db == null || db <= 0 ? 0 : 200 - db;
  }

  function buildRecommendationBuckets(options, req) {
    options = options || [];
    var recommended = options[0] || null;
    var buckets = [
      {
        id: 'best_match',
        label: 'Best Match',
        option: recommended,
        reason: recommended ? 'Highest deterministic match score after engineering filters.' : 'No suitable option found.'
      },
      {
        id: 'highest_efficiency',
        label: 'Highest Efficiency',
        option: bestBy(options.filter(function (option) { return efficiencyScore(option.record) > 0; }), function (option) {
          return efficiencyScore(option.record);
        }),
        reason: 'Highest available EER/SEER/COP/IPLV among suitable options.'
      },
      {
        id: 'lowest_noise',
        label: 'Lowest Noise',
        option: bestBy(options.filter(function (option) { return n((option.record || {}).soundLevelDb) > 0; }), function (option) {
          return noiseScore(option.record);
        }),
        reason: 'Lowest documented sound level among suitable options.'
      },
      {
        id: 'market_preferred',
        label: req.marketRegion === 'SA' ? 'Saudi Market Preferred' : 'Market Preferred',
        option: bestBy(options, function (option) {
          return marketAvailabilityScore(option.record);
        }),
        reason: 'Best documented market availability among suitable options.'
      },
      {
        id: 'lowest_power',
        label: 'Lowest Input Power',
        option: bestBy(options.filter(function (option) { return option.totalInputPowerKw != null && option.totalInputPowerKw > 0; }), function (option) {
          return 1000 - n(option.totalInputPowerKw);
        }),
        reason: 'Lowest documented total input power among suitable options.'
      }
    ];
    return buckets.map(function (bucket) {
      return Object.assign({}, bucket, {
        available: !!bucket.option,
        optionId: bucket.option ? bucket.option.optionId : ''
      });
    });
  }

  function buildVerificationItems(option, req) {
    var items = [];
    if (!option) return ['No suitable equipment option found.'];
    var record = option.record || {};
    if (record.sensibleCapacityBtuH == null) items.push('Sensible capacity missing.');
    if (record.sourceReference == null || record.sourceReference === '') items.push('Catalogue source missing.');
    if (!record.saudiMarketStatus || record.saudiMarketStatus === 'unknown') items.push('Saudi availability requires confirmation.');
    if (record.maxOutdoorTemperatureC == null && req.outdoorDesignTemperatureC != null) items.push('Outdoor temperature data missing.');
    return items;
  }

  window.AirCalcEquipmentSelection = {
    DEFAULT_SCORE_WEIGHTS: DEFAULT_SCORE_WEIGHTS,
    buildRequirements: buildRequirements,
    selectEquipment: selectEquipment,
    buildRecommendationBuckets: buildRecommendationBuckets,
    generateCombinations: generateCombinations,
    scoreCombination: scoreCombination
  };
})();
