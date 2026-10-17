(function(root){
  'use strict';

  function n(value){
    var out = Number(value);
    return Number.isFinite(out) ? out : 0;
  }

  function clamp(value, min, max){
    return Math.max(min, Math.min(max, value));
  }

  function round(value){
    return Math.round(n(value));
  }

  function pctDelta(required, selected){
    required = n(required);
    selected = n(selected);
    if(required <= 0) return 0;
    return ((selected - required) / required) * 100;
  }

  function tone(score){
    score = n(score);
    if(score >= 85) return 'green';
    if(score >= 65) return 'blue';
    return 'red';
  }

  function capacityScore(requiredBtu, selectedBtu){
    requiredBtu = n(requiredBtu);
    selectedBtu = n(selectedBtu);
    if(requiredBtu <= 0 || selectedBtu <= 0) return 45;
    var delta = pctDelta(requiredBtu, selectedBtu);
    if(delta < 0) return clamp(70 + delta * 1.8, 0, 70);
    if(delta <= 10) return clamp(100 - Math.abs(delta - 5) * 1.5, 85, 100);
    return clamp(100 - (delta - 10) * 2.2, 35, 88);
  }

  function airflowScore(requiredCfm, selectedCfm){
    requiredCfm = n(requiredCfm);
    selectedCfm = n(selectedCfm);
    if(requiredCfm <= 0) return 60;
    if(selectedCfm <= 0) return 50;
    var delta = pctDelta(requiredCfm, selectedCfm);
    if(delta < 0) return clamp(65 + delta * 2.5, 0, 65);
    if(delta <= 15) return clamp(100 - Math.abs(delta - 5), 82, 100);
    return clamp(100 - (delta - 15) * 1.4, 45, 85);
  }

  function espScore(snapshot){
    var esp = snapshot && snapshot.esp ? snapshot.esp : null;
    if(!esp) return 68;
    var totalPa = n(esp.totalPa || esp.total || esp.value);
    if(totalPa <= 0) return 68;
    if(totalPa <= 150) return 95;
    if(totalPa <= 250) return 82;
    if(totalPa <= 350) return 68;
    return 48;
  }

  function equipmentVerificationScore(snapshot){
    var systems = snapshot && snapshot.systems ? snapshot.systems.items || [] : [];
    if(!systems.length) return 50;
    var total = 0;
    systems.forEach(function(system){
      var snap = system.equipmentSnapshot || {};
      var record = snap.record || snap;
      var source = String(record.verificationStatus || snap.verificationStatus || snap.sourceStatus || snap.catalogueStatus || '').toLowerCase();
      var model = snap.model || snap.modelNumber || system.equipmentId;
      var score = model ? 70 : 45;
      if(['verified', 'verified-real-catalogue'].indexOf(source) >= 0) score = 92;
      else score = Math.min(score, 60);
      if(source.indexOf('sample') >= 0 || source.indexOf('mock') >= 0) score = 45;
      total += score;
    });
    return round(total / systems.length);
  }

  function dataQualityScore(snapshot){
    var roomCount = n(snapshot && snapshot.rooms && snapshot.rooms.count);
    var missing = n(snapshot && snapshot.rooms && snapshot.rooms.missingInputs);
    if(roomCount <= 0) return 35;
    var base = 100 - missing * 8;
    var validationItems = snapshot && snapshot.validation && Array.isArray(snapshot.validation.items) ? snapshot.validation.items : [];
    var missingValidation = validationItems.filter(function(item){
      var text = String((item && (item.label || item.title || item.message || item.text)) || '').toLowerCase();
      return text.indexOf('missing') >= 0 || text.indexOf('غير') >= 0 || text.indexOf('مدخل') >= 0;
    }).length;
    return clamp(base - missingValidation * 6, 20, 100);
  }

  function energyScore(snapshot){
    var required = n(snapshot && snapshot.totals && snapshot.totals.requiredBtu);
    var selected = n(snapshot && snapshot.totals && snapshot.totals.selectedBtu);
    if(required <= 0 || selected <= 0) return 55;
    var over = Math.max(0, pctDelta(required, selected));
    var under = Math.max(0, -pctDelta(required, selected));
    return clamp(96 - over * 1.8 - under * 2.4, 25, 96);
  }

  function maintainabilityScore(snapshot){
    var systems = snapshot && snapshot.systems ? snapshot.systems.items || [] : [];
    if(!systems.length) return 50;
    var score = 92;
    if(systems.length > 4) score -= (systems.length - 4) * 5;
    systems.forEach(function(system){
      if(!system.equipmentSnapshot) score -= 8;
      if(String(system.unitType || '').toLowerCase().indexOf('ahu') >= 0) score -= 2;
    });
    return clamp(score, 40, 95);
  }

  function electricalScore(snapshot){
    var systems = snapshot && snapshot.systems ? snapshot.systems.items || [] : [];
    if(!systems.length) return 58;
    var total = 0;
    systems.forEach(function(system){
      var snap = system.equipmentSnapshot || {};
      var hasElectrical = !!(snap.voltage || snap.phase || snap.frequency || snap.electrical);
      total += hasElectrical ? 90 : 62;
    });
    return round(total / systems.length);
  }

  function validationPenalty(snapshot){
    var items = snapshot && snapshot.validation && Array.isArray(snapshot.validation.items) ? snapshot.validation.items : [];
    var penalty = 0;
    items.forEach(function(item){
      var status = String((item && (item.status || item.severity || item.level)) || '').toLowerCase();
      if(status.indexOf('critical') >= 0 || status.indexOf('حرج') >= 0) penalty += 8;
      else if(status.indexOf('warn') >= 0 || status.indexOf('review') >= 0 || status.indexOf('مراجعة') >= 0) penalty += 4;
      else penalty += 1;
    });
    return penalty;
  }

  function calculateHealth(snapshot){
    snapshot = snapshot || {};
    var metrics = {
      capacity: capacityScore(snapshot.totals && snapshot.totals.requiredBtu, snapshot.totals && snapshot.totals.selectedBtu),
      airflow: snapshot.airflowReview && snapshot.airflowReview.filterActive && !snapshot.airflowReview.filterReady?50:airflowScore(snapshot.totals && snapshot.totals.requiredCfm, snapshot.totals && snapshot.totals.selectedCfm),
      esp: espScore(snapshot),
      energy: energyScore(snapshot),
      electrical: electricalScore(snapshot),
      maintainability: maintainabilityScore(snapshot),
      dataQuality: dataQualityScore(snapshot),
      equipmentVerification: equipmentVerificationScore(snapshot)
    };
    var weights = {
      capacity: 0.18,
      airflow: 0.16,
      esp: 0.1,
      energy: 0.12,
      electrical: 0.08,
      maintainability: 0.08,
      dataQuality: 0.14,
      equipmentVerification: 0.14
    };
    var overall = 0;
    Object.keys(metrics).forEach(function(key){ overall += metrics[key] * weights[key]; });
    overall = clamp(round(overall - validationPenalty(snapshot)), 0, 100);
    return {
      sourceOfTruth: 'rules_engine',
      overall: overall,
      tone: tone(overall),
      metrics: Object.keys(metrics).map(function(key){
        var actual=key==='airflow' && snapshot.totals?round(snapshot.totals.selectedCfm)+' CFM':(key==='esp' && snapshot.esp?round(snapshot.esp.totalPa)+' Pa':'');
        return { key: key, score: round(metrics[key]), tone: tone(metrics[key]),actual:actual, estimated:key==='airflow' && !!(snapshot.airflowReview && snapshot.airflowReview.estimated),pending:key==='airflow' && !!(snapshot.airflowReview && snapshot.airflowReview.filterActive && !snapshot.airflowReview.filterReady) };
      })
    };
  }

  function recommendation(priority, title, reason, benefit, action){
    return { priority: priority, title: title, reason: reason, expectedBenefit: benefit, action: action || null };
  }

  function buildRecommendations(snapshot, health){
    snapshot = snapshot || {};
    health = health || calculateHealth(snapshot);
    var recs = [];
    var totals = snapshot.totals || {};
    var capDelta = pctDelta(totals.requiredBtu, totals.selectedBtu);
    var cfmDelta = pctDelta(totals.requiredCfm, totals.selectedCfm);

    if(totals.requiredBtu > 0 && totals.selectedBtu <= 0){
      recs.push(recommendation('critical', 'Select project equipment', 'The project has calculated load but no selected equipment capacity.', 'Enables capacity validation and reporting readiness.'));
    }else if(capDelta < 0){
      recs.push(recommendation('critical', 'Increase selected capacity', 'Selected equipment capacity is below the required cooling load.', 'Reduces undersizing risk before approval.'));
    }else if(capDelta > 10){
      recs.push(recommendation('warning', 'Review oversizing', 'Selected capacity is significantly above the required cooling load.', 'Improves comfort, cycling behavior, and energy performance.'));
    }

    if(totals.requiredCfm > 0 && totals.selectedCfm > 0 && cfmDelta < 0){
      recs.push(recommendation('warning', 'Review supply airflow', 'Selected equipment airflow is below the project required CFM.', 'Improves air distribution and ventilation confidence.'));
    }

    if(health.metrics.some(function(metric){ return metric.key === 'equipmentVerification' && metric.score < 70; })){
      recs.push(recommendation('warning', 'Verify catalogue data', 'One or more selected units are missing verified catalogue snapshots.', 'Improves submittal traceability and reduces model selection errors.'));
    }

    if((snapshot.rooms && snapshot.rooms.missingInputs) > 0){
      recs.push(recommendation('suggestion', 'Complete room inputs', 'Some room records are missing required load or airflow fields.', 'Improves data quality and review confidence.'));
    }

    if(health.metrics.some(function(metric){ return metric.key === 'esp' && metric.score < 70; })){
      recs.push(recommendation('warning', 'Check duct ESP', 'Static pressure appears incomplete or outside a comfortable validation band.', 'Reduces fan selection and noise risk.'));
    }

    if(!recs.length){
      recs.push(recommendation('suggestion', 'Keep current engineering path', 'The deterministic checks do not show a blocking design risk.', 'Maintain review discipline before final approval.'));
    }
    return recs;
  }

  function buildActionCenter(snapshot, recommendations){
    recommendations = recommendations || buildRecommendations(snapshot);
    return {
      critical: recommendations.filter(function(item){ return item.priority === 'critical'; }),
      warnings: recommendations.filter(function(item){ return item.priority === 'warning'; }),
      suggestions: recommendations.filter(function(item){ return item.priority === 'suggestion'; }),
      missingData: (snapshot.rooms && snapshot.rooms.missingInputs) || 0,
      reviewRequired: recommendations.some(function(item){ return item.priority !== 'suggestion'; })
    };
  }

  function scenario(label, description, totals, selectedBtu, selectedCfm, unitCount, scoreBias){
    var score = calculateHealth({
      totals: {
        requiredBtu: totals.requiredBtu,
        requiredCfm: totals.requiredCfm,
        selectedBtu: selectedBtu,
        selectedCfm: selectedCfm
      },
      rooms: { count: 1, missingInputs: 0 },
      systems: { items: [{ selectedCapacityBtu: selectedBtu, cfm: selectedCfm, unitCount: unitCount, equipmentSnapshot: { sourceStatus: 'derived-from-current-database' } }] },
      validation: { items: [] },
      esp: null
    }).overall + (scoreBias || 0);
    return {
      label: label,
      description: description,
      equipment: 'From current equipment database',
      capacityBtu: round(selectedBtu),
      oversizingPct: Math.round(pctDelta(totals.requiredBtu, selectedBtu) * 10) / 10,
      cfm: round(selectedCfm),
      esp: 'Use current ESP calculation',
      estimatedEnergy: Math.max(1, round(100 - Math.max(0, pctDelta(totals.requiredBtu, selectedBtu)))),
      numberOfUnits: unitCount,
      engineeringScore: clamp(round(score), 0, 100)
    };
  }

  function buildOptimizationScenarios(snapshot){
    snapshot = snapshot || {};
    var totals = snapshot.totals || {};
    var requiredBtu = Math.max(0, n(totals.requiredBtu));
    var requiredCfm = Math.max(0, n(totals.requiredCfm));
    var selectedBtu = Math.max(0, n(totals.selectedBtu));
    var selectedCfm = Math.max(0, n(totals.selectedCfm));
    var currentUnits = snapshot.systems && snapshot.systems.items && snapshot.systems.items.length ? snapshot.systems.items.reduce(function(sum, system){ return sum + Math.max(1, n(system.unitCount)); }, 0) : 1;

    if(requiredBtu <= 0){
      return [];
    }

    var balancedBtu = Math.max(requiredBtu * 1.05, selectedBtu || requiredBtu * 1.05);
    if(selectedBtu && pctDelta(requiredBtu, selectedBtu) > 18) balancedBtu = requiredBtu * 1.08;
    var balancedCfm = selectedCfm || requiredCfm;
    var airflowCfm = Math.max(requiredCfm * 1.05, selectedCfm || requiredCfm * 1.05);
    var lowerOversizeBtu = selectedBtu && pctDelta(requiredBtu, selectedBtu) > 12 ? requiredBtu * 1.1 : balancedBtu;

    return [
      scenario('A', 'Balanced capacity', totals, balancedBtu, balancedCfm, currentUnits, 0),
      scenario('B', 'Airflow risk reduction', totals, Math.max(balancedBtu, lowerOversizeBtu), airflowCfm, currentUnits, 2),
      scenario('C', 'Lower oversizing', totals, lowerOversizeBtu, Math.max(requiredCfm, balancedCfm), currentUnits, 1)
    ];
  }

  function calculateConfidence(snapshot, health){
    health = health || calculateHealth(snapshot);
    var data = health.metrics.filter(function(metric){ return metric.key === 'dataQuality'; })[0];
    var equip = health.metrics.filter(function(metric){ return metric.key === 'equipmentVerification'; })[0];
    var findings = (snapshot.validation && Array.isArray(snapshot.validation.items)) ? snapshot.validation.items.length : 0;
    var score = ((data ? data.score : 60) * 0.35) + ((equip ? equip.score : 60) * 0.35) + (Math.max(30, 100 - findings * 8) * 0.3);
    return {
      score: clamp(round(score), 0, 100),
      tone: tone(score),
      basis: ['Data completeness', 'Verified equipment snapshots', 'Engineer review findings', 'Missing inputs', 'Catalogue quality'],
      aiGeneratedNumbers: false
    };
  }

  function buildDecisionExplanation(snapshot, health, recommendations){
    snapshot = snapshot || {};
    health = health || calculateHealth(snapshot);
    recommendations = recommendations || buildRecommendations(snapshot, health);
    var totals = snapshot.totals || {};
    var systems = snapshot.systems && snapshot.systems.items ? snapshot.systems.items : [];
    var selectedModels = systems.map(function(system){
      var snap = system.equipmentSnapshot || {};
      return snap.model || snap.modelNumber || system.equipmentId || system.unitType || 'Selected equipment';
    });
    var capacityDelta = pctDelta(totals.requiredBtu, totals.selectedBtu);
    var airflowDelta = pctDelta(totals.requiredCfm, totals.selectedCfm);
    return {
      sourceOfTruth: 'rules_engine',
      summary: 'The current decision is explained from calculated project load, selected equipment snapshots, airflow totals, and Engineer Review findings.',
      basis: [
        'Required load: ' + round(totals.requiredBtu) + ' BTU/h',
        'Selected capacity: ' + round(totals.selectedBtu) + ' BTU/h',
        'Capacity delta: ' + (Math.round(capacityDelta * 10) / 10) + '%',
        'Required airflow: ' + round(totals.requiredCfm) + ' CFM',
        'Selected airflow: ' + round(totals.selectedCfm) + ' CFM',
        'Airflow delta: ' + (Math.round(airflowDelta * 10) / 10) + '%',
        'Selected equipment: ' + (selectedModels.length ? selectedModels.join(', ') : 'No equipment selected')
      ],
      reviewFindings: recommendations.map(function(item){ return item.title + ': ' + item.reason; }),
      aiGeneratedNumbers: false
    };
  }

  function buildSmartComparison(snapshot, scenarios, previousSnapshot){
    snapshot = snapshot || {};
    scenarios = scenarios || buildOptimizationScenarios(snapshot);
    var totals = snapshot.totals || {};
    var health = calculateHealth(snapshot);
    var optimized = scenarios.length ? scenarios.reduce(function(best, item){
      return item.engineeringScore > best.engineeringScore ? item : best;
    }, scenarios[0]) : null;
    var previousTotals = previousSnapshot && previousSnapshot.totals ? previousSnapshot.totals : null;
    return {
      sourceOfTruth: 'rules_engine',
      rows: [
        {
          name: 'Current',
          capacityBtu: round(totals.selectedBtu),
          cfm: round(totals.selectedCfm),
          oversizingPct: Math.round(pctDelta(totals.requiredBtu, totals.selectedBtu) * 10) / 10,
          engineeringScore: health.overall
        },
        {
          name: 'Optimized',
          capacityBtu: optimized ? optimized.capacityBtu : 0,
          cfm: optimized ? optimized.cfm : 0,
          oversizingPct: optimized ? optimized.oversizingPct : 0,
          engineeringScore: optimized ? optimized.engineeringScore : 0
        },
        {
          name: 'Previous',
          capacityBtu: previousTotals ? round(previousTotals.selectedBtu) : 0,
          cfm: previousTotals ? round(previousTotals.selectedCfm) : 0,
          oversizingPct: previousTotals ? Math.round(pctDelta(previousTotals.requiredBtu, previousTotals.selectedBtu) * 10) / 10 : 0,
          engineeringScore: previousSnapshot ? calculateHealth(previousSnapshot).overall : 0
        }
      ]
    };
  }

  function buildReviewReport(snapshot, health, recommendations, confidence, scenarios){
    health = health || calculateHealth(snapshot);
    recommendations = recommendations || buildRecommendations(snapshot, health);
    confidence = confidence || calculateConfidence(snapshot, health);
    scenarios = scenarios || buildOptimizationScenarios(snapshot);
    return {
      title: 'HVAC Engineering Review Report',
      generatedAt: new Date().toISOString(),
      sourceOfTruth: 'rules_engine',
      aiGeneratedNumbers: false,
      identity: snapshot && snapshot.identity ? snapshot.identity : {},
      projectKey: snapshot && snapshot.identity ? snapshot.identity.projectKey : 'default-project',
      projectHealth: health.overall,
      confidence: confidence.score,
      totals: snapshot && snapshot.totals ? snapshot.totals : {},
      metrics: health.metrics,
      recommendations: recommendations,
      scenarios: scenarios,
      decisionExplanation: buildDecisionExplanation(snapshot, health, recommendations)
    };
  }

  function buildDeliveryReadiness(snapshot, health, recommendations, confidence){
    health = health || calculateHealth(snapshot);
    recommendations = recommendations || buildRecommendations(snapshot, health);
    confidence = confidence || calculateConfidence(snapshot, health);
    var critical = recommendations.filter(function(item){ return item.priority === 'critical'; }).length;
    var warnings = recommendations.filter(function(item){ return item.priority === 'warning'; }).length;
    var missing = snapshot && snapshot.rooms ? n(snapshot.rooms.missingInputs) : 0;
    var totals = snapshot.totals || {};
    var requiredChecksPass = n(totals.requiredBtu) > 0 && n(totals.selectedBtu) >= n(totals.requiredBtu) &&
      n(totals.requiredCfm) > 0 && n(totals.selectedCfm) >= n(totals.requiredCfm) &&
      equipmentVerificationScore(snapshot) >= 90;
    var ready = requiredChecksPass && health.overall >= 80 && confidence.score >= 75 && critical === 0 && missing === 0 && warnings === 0;
    var status = ready ? 'ready' : (critical || health.overall < 65 ? 'blocked' : 'review_required');
    return {
      sourceOfTruth: 'rules_engine',
      status: status,
      readyForClient: ready,
      health: health.overall,
      confidence: confidence.score,
      critical: critical,
      warnings: warnings,
      missingInputs: missing,
      requiredActions: recommendations.filter(function(item){ return item.priority !== 'suggestion'; }).map(function(item){ return item.title; }),
      aiGeneratedNumbers: false
    };
  }

  function buildHandoffChecklist(snapshot, health, recommendations, confidence, readiness){
    snapshot = snapshot || {};
    health = health || calculateHealth(snapshot);
    recommendations = recommendations || buildRecommendations(snapshot, health);
    confidence = confidence || calculateConfidence(snapshot, health);
    readiness = readiness || buildDeliveryReadiness(snapshot, health, recommendations, confidence);
    var totals = snapshot.totals || {};
    var systems = snapshot.systems && snapshot.systems.items ? snapshot.systems.items : [];
    var hasEquipmentSnapshot = systems.some(function(system){ return !!(system && system.equipmentSnapshot); });
    var critical = recommendations.some(function(item){ return item.priority === 'critical'; });
    var items = [
      {
        id: 'load_calculated',
        label: 'Cooling load calculated',
        passed: n(totals.requiredBtu) > 0,
        detail: n(totals.requiredBtu) > 0 ? round(totals.requiredBtu) + ' BTU/h' : 'Missing project load'
      },
      {
        id: 'equipment_selected',
        label: 'Equipment capacity selected',
        passed: n(totals.selectedBtu) > 0,
        detail: n(totals.selectedBtu) > 0 ? round(totals.selectedBtu) + ' BTU/h' : 'No selected capacity'
      },
      {
        id: 'equipment_snapshot',
        label: 'Equipment snapshot available',
        passed: hasEquipmentSnapshot,
        detail: hasEquipmentSnapshot ? 'At least one project unit has a catalogue snapshot' : 'No catalogue snapshot attached'
      },
      {
        id: 'airflow_checked',
        label: 'Supply airflow checked',
        passed: n(totals.requiredCfm) > 0 && n(totals.selectedCfm) > 0,
        detail: round(totals.requiredCfm) + ' / ' + round(totals.selectedCfm) + ' CFM'
      },
      {
        id: 'critical_clear',
        label: 'No critical review findings',
        passed: !critical,
        detail: critical ? 'Critical findings remain' : 'No critical findings'
      },
      {
        id: 'data_complete',
        label: 'Required data complete',
        passed: !snapshot.rooms || n(snapshot.rooms.missingInputs) === 0,
        detail: (snapshot.rooms ? n(snapshot.rooms.missingInputs) : 0) + ' missing inputs'
      },
      {
        id: 'confidence_ready',
        label: 'Engineering confidence acceptable',
        passed: confidence.score >= 75,
        detail: confidence.score + '/100'
      },
      {
        id: 'report_ready',
        label: 'Delivery readiness gate',
        passed: readiness.readyForClient,
        detail: readiness.status
      },
      {
        id: 'ai_guardrail',
        label: 'AI is explain-only',
        passed: true,
        detail: 'AI does not calculate or select equipment'
      }
    ];
    var passed = items.filter(function(item){ return item.passed; }).length;
    return {
      sourceOfTruth: 'rules_engine',
      aiGeneratedNumbers: false,
      passed: passed,
      total: items.length,
      complete: passed === items.length,
      items: items
    };
  }

  function riskFromRecommendation(item, index){
    var severity = item.priority === 'critical' ? 'high' : (item.priority === 'warning' ? 'medium' : 'low');
    return {
      id: 'risk-' + (index + 1),
      severity: severity,
      title: item.title,
      impact: item.expectedBenefit || item.reason || 'Engineering review impact',
      mitigation: item.reason || 'Review with HVAC engineer before approval.',
      source: 'rules_engine'
    };
  }

  function buildRiskRegister(snapshot, health, recommendations, readiness){
    health = health || calculateHealth(snapshot);
    recommendations = recommendations || buildRecommendations(snapshot, health);
    readiness = readiness || buildDeliveryReadiness(snapshot, health, recommendations, calculateConfidence(snapshot, health));
    var risks = recommendations.map(riskFromRecommendation);
    if(readiness.status === 'blocked'){
      risks.unshift({
        id: 'risk-delivery-blocked',
        severity: 'high',
        title: 'Delivery readiness is blocked',
        impact: 'Project should not be issued to client before blocking review items are closed.',
        mitigation: 'Resolve critical findings, missing inputs, or low health score, then re-run review.',
        source: 'rules_engine'
      });
    }
    if(!risks.length){
      risks.push({
        id: 'risk-monitor',
        severity: 'low',
        title: 'Monitor project assumptions',
        impact: 'Assumptions may change after client or consultant review.',
        mitigation: 'Save a review snapshot before issuing the report.',
        source: 'rules_engine'
      });
    }
    return {
      sourceOfTruth: 'rules_engine',
      aiGeneratedNumbers: false,
      high: risks.filter(function(item){ return item.severity === 'high'; }).length,
      medium: risks.filter(function(item){ return item.severity === 'medium'; }).length,
      low: risks.filter(function(item){ return item.severity === 'low'; }).length,
      items: risks.slice(0, 8)
    };
  }

  root.AirCalcCopilotHealthEngine = {
    calculateHealth: calculateHealth,
    buildRecommendations: buildRecommendations,
    buildActionCenter: buildActionCenter,
    buildOptimizationScenarios: buildOptimizationScenarios,
    calculateConfidence: calculateConfidence,
    buildDecisionExplanation: buildDecisionExplanation,
    buildSmartComparison: buildSmartComparison,
    buildReviewReport: buildReviewReport,
    buildDeliveryReadiness: buildDeliveryReadiness,
    buildHandoffChecklist: buildHandoffChecklist,
    buildRiskRegister: buildRiskRegister,
    _internal: {
      capacityScore: capacityScore,
      airflowScore: airflowScore,
      pctDelta: pctDelta
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
