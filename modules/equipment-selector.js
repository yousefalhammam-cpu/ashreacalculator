(function () {
  'use strict';

  var currentStep = 1;
  var lastResult = null;
  var selectedOptionId = '';
  var aiExplainSerial = 0;
  var selectionContext = null;

  function G(id) { return document.getElementById(id); }
  function isAr() { return (window.lang || document.documentElement.lang || 'ar') !== 'en'; }
  function t(ar, en) { return isAr() ? ar : en; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
  function num(value) {
    var n = Number(value);
    return isFinite(n) ? n : 0;
  }
  function fmt(value, suffix) {
    if (value == null || value === '' || !isFinite(Number(value))) return t('ØºÙŠØ± Ù…ØªÙˆÙØ±', 'Not provided');
    return Number(value).toLocaleString('en-US') + (suffix ? ' ' + suffix : '');
  }
  function callNumber(name, fallback) {
    try {
      if (typeof window[name] === 'function') return num(window[name]());
    } catch (e) {}
    return num(fallback);
  }

  function defaultRequirements() {
    var requiredBtu = callNumber('getProjectRequiredLoadBtu', callNumber('getProjTotalBtu', 0));
    var requiredCfm = callNumber('getProjectRequiredLoadCfm', callNumber('getProjTotalCfm', 0));
    var context = selectionContext || {};
    var req = {
      requiredCoolingLoadBtuH: requiredBtu,
      requiredSupplyCfm: requiredCfm,
      requiredEspPa: window._lastEspCalc && window._lastEspCalc.totalPa != null ? num(window._lastEspCalc.totalPa) : 0,
      equipmentType: context.equipmentType || 'package',
      voltage: context.voltage == null ? 380 : context.voltage,
      phase: context.phase == null ? 3 : context.phase,
      frequencyHz: context.frequencyHz == null ? 60 : context.frequencyHz,
      marketRegion: context.marketRegion || 'SA',
      verifiedDataOnly: context.verifiedDataOnly !== false,
      requireSaudiListing: !!context.requireSaudiListing,
      redundancyPreference: 'none',
      maxUnits: context.maxUnits || 4
    };
    if (context.requiredCoolingLoadBtuH != null) req.requiredCoolingLoadBtuH = num(context.requiredCoolingLoadBtuH);
    if (context.requiredSupplyCfm != null) req.requiredSupplyCfm = num(context.requiredSupplyCfm);
    if (context.requiredEspPa != null) req.requiredEspPa = num(context.requiredEspPa);
    return req;
  }

  function readRequirements() {
    return {
      requiredCoolingLoadBtuH: num((G('equip-select-load') || {}).value),
      requiredSupplyCfm: num((G('equip-select-cfm') || {}).value),
      requiredEspPa: num((G('equip-select-esp') || {}).value),
      equipmentType: (G('equip-select-type') || {}).value || 'package',
      voltage: num((G('equip-select-voltage') || {}).value),
      phase: num((G('equip-select-phase') || {}).value),
      frequencyHz: num((G('equip-select-frequency') || {}).value),
      marketRegion: (G('equip-select-market') || {}).value || 'SA',
      verifiedDataOnly: !!((G('equip-select-verified') || {}).checked),
      requireSaudiListing: !!((G('equip-select-saudi') || {}).checked),
      redundancyPreference: (G('equip-select-redundancy') || {}).value || 'none',
      maxUnits: num((G('equip-select-max-units') || {}).value) || 4
    };
  }

  function setInputValue(id, value) {
    var el = G(id);
    if (el) el.value = value == null ? '' : String(value);
  }

  function fillDefaults() {
    var req = defaultRequirements();
    setInputValue('equip-select-load', req.requiredCoolingLoadBtuH || '');
    setInputValue('equip-select-cfm', req.requiredSupplyCfm || '');
    setInputValue('equip-select-esp', req.requiredEspPa || '');
    setInputValue('equip-select-type', req.equipmentType);
    setInputValue('equip-select-voltage', req.voltage);
    setInputValue('equip-select-phase', req.phase);
    setInputValue('equip-select-frequency', req.frequencyHz);
    setInputValue('equip-select-market', req.marketRegion);
    setInputValue('equip-select-redundancy', req.redundancyPreference);
    setInputValue('equip-select-max-units', req.maxUnits);
    var verified = G('equip-select-verified');
    if (verified) verified.checked = req.verifiedDataOnly;
    var saudi = G('equip-select-saudi');
    if (saudi) saudi.checked = req.requireSaudiListing;
  }

  function setStep(step) {
    currentStep = Math.max(1, Math.min(6, step));
    Array.prototype.slice.call(document.querySelectorAll('.equip-wizard-step')).forEach(function (el) {
      el.classList.toggle('on', Number(el.dataset.step) === currentStep);
    });
    Array.prototype.slice.call(document.querySelectorAll('.equip-step-dot')).forEach(function (el) {
      el.classList.toggle('on', Number(el.dataset.step) === currentStep);
      el.classList.toggle('done', Number(el.dataset.step) < currentStep);
    });
  }

  function openWizard(context) {
    selectionContext = context || null;
    fillDefaults();
    renderRequirementSummary();
    ensureManualCapacityPanel();
    lastResult = null;
    selectedOptionId = '';
    renderResults();
    setStep(1);
    var modal = G('equip-select-modal');
    if (modal) modal.classList.add('on');
  }

  function closeWizard() {
    var modal = G('equip-select-modal');
    if (modal) modal.classList.remove('on');
  }

  function renderRequirementSummary() {
    var host = G('equip-select-requirement-summary');
    if (!host) return;
    var req = readRequirements();
    host.innerHTML =
      card(t('Ø§Ù„Ø­Ù…Ù„ Ø§Ù„Ù…Ø·Ù„ÙˆØ¨', 'Required load'), fmt(req.requiredCoolingLoadBtuH, 'BTU/h')) +
      card(t('ØªØ¯ÙÙ‚ Ø§Ù„Ù‡ÙˆØ§Ø¡', 'Supply airflow'), fmt(req.requiredSupplyCfm, 'CFM')) +
      card('ESP', fmt(req.requiredEspPa, 'Pa')) +
      card(t('Ù†ÙˆØ¹ Ø§Ù„ÙˆØ­Ø¯Ø©', 'Equipment type'), esc(req.equipmentType || '-'));
  }

  function card(label, value) {
    return '<div class="equip-wizard-metric"><span>' + esc(label) + '</span><strong>' + value + '</strong></div>';
  }

  function manualCapacityHtml() {
    var presets = [12000, 18000, 24000, 30000, 36000, 48000, 60000];
    return '<div class="equip-manual-capacity-panel">' +
      '<div class="equip-manual-tabs"><span>' + t('\u0627\u062e\u062a\u064a\u0627\u0631 \u0645\u0648\u062f\u064a\u0644 \u0645\u0646 \u0627\u0644\u0633\u0648\u0642', 'Select Market Equipment') + '</span><span>' + t('\u0625\u062f\u062e\u0627\u0644 \u0633\u0639\u0629 \u064a\u062f\u0648\u064a\u0629', 'Manual Capacity') + '</span></div>' +
      '<div class="equip-manual-note">' + t('\u0627\u0644\u0633\u0639\u0629 \u0627\u0644\u064a\u062f\u0648\u064a\u0629 \u0644\u064a\u0633\u062a \u0645\u0648\u062f\u064a\u0644\u0627 \u0645\u0648\u062b\u0642\u0627 \u0645\u0646 \u0634\u0631\u0643\u0629.', 'Manual generic capacity is not a verified manufacturer model.') + '</div>' +
      '<div class="equip-manual-buttons">' +
        presets.map(function (btu) {
          return '<button type="button" onclick="AppEquipmentSelector.applyManualCapacity(' + btu + ')">' + Number(btu).toLocaleString('en-US') + ' BTU/h</button>';
        }).join('') +
        '<input class="ninput" id="equip-manual-custom-btu" type="number" min="0" placeholder="Custom BTU/h">' +
        '<button type="button" onclick="AppEquipmentSelector.applyManualCapacity((document.getElementById(&quot;equip-manual-custom-btu&quot;)||{}).value)">' + t('\u062a\u0637\u0628\u064a\u0642', 'Apply') + '</button>' +
      '</div>' +
    '</div>';
  }

  function ensureManualCapacityPanel() {
    var summaryHost = G('equip-select-requirement-summary');
    if (summaryHost && !summaryHost.querySelector('.equip-manual-capacity-panel')) {
      summaryHost.insertAdjacentHTML('beforeend', manualCapacityHtml());
    }
  }

  function availableRecords() {
    if (window.AppEquipmentDatabase && typeof window.AppEquipmentDatabase.allRecords === 'function') {
      return window.AppEquipmentDatabase.allRecords();
    }
    return [];
  }

  function recordMatchesSystemUnitType(systemUnitType, record) {
    if (!record) return false;
    if (record.equipmentType !== 'chiller') return true;
    var descriptor = String((record.series || '') + ' ' + (record.exactModelNumber || '') + ' ' + (record.notes || '')).toLowerCase();
    if (systemUnitType === 'chiller_air') return descriptor.indexOf('air-cooled') >= 0 || descriptor.indexOf('air cooled') >= 0;
    if (systemUnitType === 'chiller_water') return descriptor.indexOf('water-cooled') >= 0 || descriptor.indexOf('water cooled') >= 0;
    return true;
  }

  function runSelection() {
    var engine = window.AirCalcEquipmentSelection;
    if (!engine || typeof engine.selectEquipment !== 'function') {
      lastResult = { error: 'selection_engine_unavailable' };
      renderResults();
      setStep(4);
      return;
    }
    var req = readRequirements();
    req.systemUnitType = (selectionContext && selectionContext.systemUnitType) || req.equipmentType || '';
    req.records = availableRecords().filter(function (record) {
      return recordMatchesSystemUnitType(req.systemUnitType, record);
    });
    lastResult = engine.selectEquipment(req);
    selectedOptionId = lastResult.recommendedOption ? lastResult.recommendedOption.optionId : '';
    renderResults();
    setStep(4);
  }

  function optionHtml(option, tone, title) {
    if (!option) return '';
    var record = option.record || {};
    var selected = option.optionId === selectedOptionId ? ' selected' : '';
    return '<div class="equip-option-card ' + (tone || '') + selected + '" onclick="AppEquipmentSelector.chooseOption(\'' + esc(option.optionId) + '\')">' +
      '<div class="equip-option-head"><div><span>' + esc(title || '') + '</span><strong>' + esc(record.manufacturerName || '-') + ' Â· ' + esc(record.exactModelNumber || '-') + '</strong></div><b>' + option.matchScore + '/100</b></div>' +
      '<div class="equip-option-grid">' +
        card('BTU/h', fmt(option.totalCapacityBtuH, '')) +
        card('CFM', fmt(option.totalAirflowCfm, '')) +
        card('ESP', fmt(option.availableEspPa, 'Pa')) +
        card(t('Ø§Ù„Ø¹Ø¯Ø¯', 'Qty'), fmt(option.quantity, '')) +
        card(t('Ø²ÙŠØ§Ø¯Ø© Ø§Ù„Ø³Ø¹Ø©', 'Oversizing'), fmt(option.oversizingPercent, '%')) +
        card(t('Ø§Ù„ØªÙƒØ±Ø§Ø±', 'Redundancy'), esc(option.redundancyLevel || 'none')) +
      '</div>' +
      '<details class="equip-score-detail"><summary>' + t('ØªÙØµÙŠÙ„ Match Score', 'Match Score breakdown') + '</summary>' + scoreHtml(option.scoreBreakdown || {}) + '</details>' +
    '</div>';
  }

  function scoreHtml(score) {
    return '<div class="equip-score-grid">' + Object.keys(score).map(function (key) {
      return '<div><span>' + esc(key) + '</span><strong>' + esc(score[key]) + '</strong></div>';
    }).join('') + '</div>';
  }

  function bucketHtml(buckets) {
    buckets = buckets || [];
    if (!buckets.length) return '';
    return '<div class="equip-bucket-grid">' + buckets.map(function (bucket) {
      var option = bucket.option || {};
      var record = option.record || {};
      var clickable = bucket.available && option.optionId ? ' onclick="AppEquipmentSelector.chooseOption(\'' + esc(option.optionId) + '\')"' : '';
      return '<button type="button" class="equip-bucket-card ' + (bucket.available ? 'available' : 'empty') + '"' + clickable + '>' +
        '<span>' + esc(bucket.label || bucket.id || '-') + '</span>' +
        '<strong>' + (bucket.available ? esc((record.manufacturerName || '-') + ' Â· ' + (record.exactModelNumber || '-')) : t('ØºÙŠØ± Ù…ØªÙˆÙØ±', 'Not available')) + '</strong>' +
        '<small>' + esc(bucket.reason || '') + '</small>' +
      '</button>';
    }).join('') + '</div>';
  }

  function selectedOptionReview(option) {
    if (!option || !lastResult) {
      return {
        status: 'review',
        label: t('ÙŠØ­ØªØ§Ø¬ Ù…Ø±Ø§Ø¬Ø¹Ø©', 'Needs Review'),
        notes: [t('Ø§Ø®ØªØ± Ø®ÙŠØ§Ø±Ù‹Ø§ Ù…Ù† Ù†ØªØ§Ø¦Ø¬ Ø§Ù„Ù…Ø·Ø§Ø¨Ù‚Ø© Ù‚Ø¨Ù„ Ø±Ø¨Ø·Ù‡ Ø¨Ø§Ù„Ù…Ø´Ø±ÙˆØ¹.', 'Choose an option from the matching results before binding it to the project.')]
      };
    }
    var req = lastResult.requirements || readRequirements();
    var record = option.record || {};
    var notes = [];
    var critical = false;
    function pctBelow(required, actual) {
      required = num(required);
      actual = num(actual);
      if (required <= 0 || actual <= 0 || actual >= required) return 0;
      return Math.round(((required - actual) / required) * 1000) / 10;
    }
    var capacityShort = pctBelow(req.requiredCoolingLoadBtuH, option.totalCapacityBtuH);
    if (capacityShort > 5) {
      critical = true;
      notes.push(t('Ø§Ù„Ø³Ø¹Ø© Ø£Ù‚Ù„ Ù…Ù† Ø­Ù…Ù„ Ø§Ù„Ù…Ø´Ø±ÙˆØ¹ Ø¨Ù†Ø³Ø¨Ø© ', 'Capacity is below project load by ') + capacityShort.toFixed(1) + '%.');
    }
    var cfmShort = pctBelow(req.requiredSupplyCfm, option.totalAirflowCfm);
    if (cfmShort > 10) {
      critical = true;
      notes.push(t('ØªØ¯ÙÙ‚ Ø§Ù„Ù‡ÙˆØ§Ø¡ Ø£Ù‚Ù„ Ù…Ù† Ù…ØªØ·Ù„Ø¨ Ø§Ù„Ù…Ø´Ø±ÙˆØ¹ Ø¨Ù†Ø³Ø¨Ø© ', 'Airflow is below project requirement by ') + cfmShort.toFixed(1) + '%.');
    }
    if (req.requiredEspPa != null && num(req.requiredEspPa) > 0 && record.availableEspPa != null && num(record.availableEspPa) < num(req.requiredEspPa)) {
      critical = true;
      notes.push(t('ESP Ø§Ù„Ù…ØªØ§Ø­ Ø£Ù‚Ù„ Ù…Ù† Ù…ØªØ·Ù„Ø¨ Ø§Ù„Ù…Ø´Ø±ÙˆØ¹.', 'Available ESP is below the project requirement.'));
    }
    ['voltage', 'phase', 'frequencyHz'].forEach(function (field) {
      if (req[field] != null && record[field] != null && num(req[field]) !== num(record[field])) {
        critical = true;
        notes.push(t('Ø¹Ø¯Ù… ØªØ·Ø§Ø¨Ù‚ ÙƒÙ‡Ø±Ø¨Ø§Ø¦ÙŠ: ', 'Electrical mismatch: ') + field + '.');
      }
    });
    if (record.sampleData || record.discontinued) {
      critical = true;
      notes.push(record.sampleData ? t('Ù‡Ø°Ø§ Ø§Ù„Ø³Ø¬Ù„ Sample Data ÙˆÙ„Ø§ ÙŠØµÙ„Ø­ Ù„Ù„Ø§Ø¹ØªÙ…Ø§Ø¯.', 'This record is sample data and cannot be approved.') : t('Ø§Ù„Ù…ÙˆØ¯ÙŠÙ„ Ù…ØªÙˆÙ‚Ù ÙˆÙ„Ø§ ÙŠØµÙ„Ø­ Ù„Ù„Ø§Ø®ØªÙŠØ§Ø± Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ.', 'The model is discontinued and cannot be final-selected.'));
    }
    if (record.verificationStatus !== 'verified' && record.verificationStatus !== 'published') notes.push(t('Ø¨ÙŠØ§Ù†Ø§Øª Ø§Ù„ÙƒØªØ§Ù„ÙˆØ¬ ØºÙŠØ± Ù…ÙˆØ«Ù‚Ø© Ø¨Ø§Ù„ÙƒØ§Ù…Ù„.', 'Catalogue data is not fully verified.'));
    if (!record.sourceReference && !record.sourceDocumentName) notes.push(t('Ù…Ø±Ø¬Ø¹ Ø§Ù„ÙƒØªØ§Ù„ÙˆØ¬ ØºÙŠØ± Ù…Ø±ÙÙ‚.', 'Catalogue source reference is missing.'));
    if (record.sensibleCapacityBtuH == null) notes.push(t('Ø³Ø¹Ø© Sensible ØºÙŠØ± Ù…ØªÙˆÙØ±Ø© ÙˆØªØ­ØªØ§Ø¬ Ù…Ø±Ø§Ø¬Ø¹Ø©.', 'Sensible capacity is missing and needs review.'));
    if (record.maxOutdoorTemperatureC == null) notes.push(t('Ø¯Ø±Ø¬Ø© Ø­Ø±Ø§Ø±Ø© Ø§Ù„ØªØ´ØºÙŠÙ„ Ø§Ù„Ø®Ø§Ø±Ø¬ÙŠØ© ØºÙŠØ± Ù…ÙˆØ«Ù‚Ø©.', 'Outdoor operating temperature is not documented.'));
    if ((lastResult.missingProjectData || []).length) notes.push(t('ØªÙˆØ¬Ø¯ Ø¨ÙŠØ§Ù†Ø§Øª Ù…Ø´Ø±ÙˆØ¹ Ù†Ø§Ù‚ØµØ©: ', 'Missing project data: ') + lastResult.missingProjectData.join(', ') + '.');
    if ((lastResult.engineerVerificationRequired || []).length) notes = notes.concat(lastResult.engineerVerificationRequired);

    if (critical) {
      return { status: 'critical', label: t('Ø­Ø±Ø¬', 'Critical'), notes: notes };
    }
    if (notes.length) {
      return { status: 'review', label: t('ÙŠØ­ØªØ§Ø¬ Ù…Ø±Ø§Ø¬Ø¹Ø©', 'Needs Review'), notes: notes };
    }
    return {
      status: 'ready',
      label: t('Ø¬Ø§Ù‡Ø² Ù„Ù„Ø±Ø¨Ø·', 'Ready to Bind'),
      notes: [t('Ø§Ù„Ø®ÙŠØ§Ø± ÙŠØ·Ø§Ø¨Ù‚ Ù‚ÙˆØ§Ø¹Ø¯ Ø§Ù„Ù…Ø·Ø§Ø¨Ù‚Ø© Ø§Ù„Ø­Ø§Ù„ÙŠØ©ØŒ Ù…Ø¹ Ø¨Ù‚Ø§Ø¡ Ø§Ù„Ø§Ø¹ØªÙ…Ø§Ø¯ Ø§Ù„Ù†Ù‡Ø§Ø¦ÙŠ Ù„Ù„Ù…Ù‡Ù†Ø¯Ø³.', 'This option passes current matching rules; final approval remains with the engineer.')]
    };
  }

  function reviewHtml(option) {
    var review = selectedOptionReview(option);
    return '<div class="equip-prebind-review ' + review.status + '">' +
      '<div class="equip-prebind-head"><span>' + t('Ø­ÙƒÙ… Rules Engine Ù‚Ø¨Ù„ Ø§Ù„Ø­ÙØ¸', 'Rules Engine Pre-Bind Review') + '</span><strong>' + esc(review.label) + '</strong></div>' +
      '<ul>' + review.notes.slice(0, 5).map(function (note) { return '<li>' + esc(note) + '</li>'; }).join('') + '</ul>' +
    '</div>';
  }

  function updateApplyButtonState(option) {
    var btn = G('equip-apply-selection-btn');
    if (!btn) return;
    var review = option ? selectedOptionReview(option) : null;
    var blocked = !option || (review && review.status === 'critical');
    btn.disabled = blocked;
    btn.classList.toggle('is-blocked', blocked);
    btn.textContent = blocked
      ? t('Ù…Ø­Ø¸ÙˆØ± Ø¨ÙˆØ§Ø³Ø·Ø© Rules Engine', 'Blocked by Rules Engine')
      : t('Ø±Ø¨Ø· Ø§Ù„Ø®ÙŠØ§Ø± Ø§Ù„Ù…Ø­Ø¯Ø¯ Ø¨Ø§Ù„Ù…Ø´Ø±ÙˆØ¹', 'Apply Selected Option to Project');
    btn.title = blocked
      ? t('Ø§Ø®ØªØ± Ø®ÙŠØ§Ø±Ù‹Ø§ ØºÙŠØ± Ø­Ø±Ø¬ Ù‚Ø¨Ù„ Ø±Ø¨Ø·Ù‡ Ø¨Ø§Ù„Ù…Ø´Ø±ÙˆØ¹.', 'Choose a non-critical option before binding it to the project.')
      : t('Ø³ÙŠØªÙ… Ø­ÙØ¸ snapshot Ø§Ù„ÙˆØ­Ø¯Ø© ÙˆØ±Ø¨Ø·Ù‡ Ø¨Ø§Ù„Ù…Ø´Ø±ÙˆØ¹.', 'The equipment snapshot will be saved and bound to the project.');
  }

  function rejectedHtml(rejected) {
    rejected = (rejected || []).slice(0, 12);
    if (!rejected.length) return '<div class="equip-wizard-empty">' + t('Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¨Ø¯Ø§Ø¦Ù„ Ù…Ø±ÙÙˆØ¶Ø©.', 'No rejected alternatives.') + '</div>';
    return rejected.map(function (alt) {
      var record = alt.record || {};
      return '<div class="equip-rejected-row"><strong>' + esc(record.manufacturerName || '-') + ' Â· ' + esc(record.exactModelNumber || '-') + '</strong><span>' +
        (alt.reasons || []).map(function (r) { return esc(r.message || r.code); }).join(' | ') +
      '</span></div>';
    }).join('');
  }

  function renderResults() {
    var host = G('equip-select-results');
    if (!host) return;
    if (!lastResult) {
      host.innerHTML = '<div class="equip-wizard-empty">' + t('Ø´ØºÙ‘Ù„ Ù…Ø­Ø±Ùƒ Ø§Ù„Ù…Ø·Ø§Ø¨Ù‚Ø© Ù„Ø¹Ø±Ø¶ Ø§Ù„Ø®ÙŠØ§Ø±Ø§Øª.', 'Run the matching engine to show options.') + '</div>';
      updateApplyButtonState(null);
      renderAiExplanation();
      return;
    }
    if (lastResult.error) {
      host.innerHTML = '<div class="equip-wizard-empty danger">' + t('Ù…Ø­Ø±Ùƒ Ø§Ù„Ø§Ø®ØªÙŠØ§Ø± ØºÙŠØ± Ù…ØªÙˆÙØ±.', 'Selection engine is unavailable.') + '</div>';
      updateApplyButtonState(null);
      renderAiExplanation();
      return;
    }
    var activeOption = selectedOption();
    host.innerHTML =
      reviewHtml(activeOption) +
      '<h4>' + t('Recommendation Buckets', 'Recommendation Buckets') + '</h4>' +
      bucketHtml(lastResult.recommendationBuckets) +
      '<h4>' + t('Recommended Option', 'Recommended Option') + '</h4>' +
      (lastResult.recommendedOption ? optionHtml(lastResult.recommendedOption, 'recommended', t('Ø§Ù„Ø®ÙŠØ§Ø± Ø§Ù„Ù…ÙˆØµÙ‰ Ø¨Ù‡', 'Recommended')) : '<div class="equip-wizard-empty">' + t('Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø®ÙŠØ§Ø± Ù…Ù†Ø§Ø³Ø¨.', 'No suitable option found.') + '</div>') +
      '<h4>' + t('Best Alternative', 'Best Alternative') + '</h4>' +
      (lastResult.bestAlternative ? optionHtml(lastResult.bestAlternative, 'alternative', t('Ø£ÙØ¶Ù„ Ø¨Ø¯ÙŠÙ„', 'Best alternative')) : '<div class="equip-wizard-empty">' + t('Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø¨Ø¯ÙŠÙ„ Ù…Ù†Ø§Ø³Ø¨.', 'No suitable alternative.') + '</div>') +
      '<h4>' + t('Other Suitable Options', 'Other Suitable Options') + '</h4>' +
      ((lastResult.otherSuitableOptions || []).slice(0, 4).map(function (option) { return optionHtml(option, 'other', t('Ø®ÙŠØ§Ø± Ù…Ù†Ø§Ø³Ø¨', 'Suitable option')); }).join('') || '<div class="equip-wizard-empty">' + t('Ù„Ø§ ØªÙˆØ¬Ø¯ Ø®ÙŠØ§Ø±Ø§Øª Ø¥Ø¶Ø§ÙÙŠØ©.', 'No other suitable options.') + '</div>') +
      '<h4>' + t('Rejected Alternatives', 'Rejected Alternatives') + '</h4>' +
      rejectedHtml(lastResult.rejectedAlternatives) +
      '<h4>' + t('Missing Project Data', 'Missing Project Data') + '</h4>' +
      '<div class="equip-wizard-note">' + esc((lastResult.missingProjectData || []).join(', ') || t('Ù„Ø§ ØªÙˆØ¬Ø¯ Ø¨ÙŠØ§Ù†Ø§Øª Ø£Ø³Ø§Ø³ÙŠØ© Ù†Ø§Ù‚ØµØ©.', 'No critical missing data.')) + '</div>' +
      '<h4>' + t('Engineer Verification Required', 'Engineer Verification Required') + '</h4>' +
      '<div class="equip-wizard-note">' + esc((lastResult.engineerVerificationRequired || []).join(' | ') || t('Ù„Ø§ ØªÙˆØ¬Ø¯ Ù…Ù„Ø§Ø­Ø¸Ø§Øª ØªØ­Ù‚Ù‚ Ø¥Ø¶Ø§ÙÙŠØ©.', 'No additional verification notes.')) + '</div>';
    updateApplyButtonState(activeOption);
    renderAiExplanation();
  }

  function renderAiExplanation() {
    var host = G('equip-select-ai');
    if (!host) return;
    var client = window.AirCalcAIExplanationClient;
    var activeOption = selectedOption();
    var review = activeOption ? selectedOptionReview(activeOption) : null;
    host.innerHTML =
      '<div class="equip-ai-foundation">' +
        '<strong>' + t('Ø´Ø±Ø­ AI ØºÙŠØ± Ù…ØªØµÙ„ Ø¨Ø¹Ø¯', 'AI explanation is not connected yet') + '</strong>' +
        '<p>' + t('Ù†ØªØ§Ø¦Ø¬ Ø§Ù„Ù…Ø·Ø§Ø¨Ù‚Ø© ÙˆØ§Ù„ØªØ±ØªÙŠØ¨ Ø£Ø¹Ù„Ø§Ù‡ ØµØ§Ø¯Ø±Ø© Ù…Ù† Ù…Ø­Ø±Ùƒ deterministic. AI Ù„Ø§ ÙŠÙ†ØªØ¬ Ø§Ù„Ø£Ø±Ù‚Ø§Ù… Ø§Ù„Ù‡Ù†Ø¯Ø³ÙŠØ© ÙˆÙ„Ø§ ÙŠØºÙŠØ± Ø§Ù„ØªØ±ØªÙŠØ¨. ÙÙŠ Ø§Ù„Ù…Ø±Ø­Ù„Ø© Ø§Ù„ØªØ§Ù„ÙŠØ© Ø³ÙŠØªÙ… ØªÙˆØµÙŠÙ„ backend Ø¢Ù…Ù† Ù„Ù„Ø´Ø±Ø­ ÙÙ‚Ø·.', 'The matching and ranking results above come from the deterministic engine. AI does not generate numbers or change ranking. A secure backend can later explain the result only.') + '</p>' +
      '</div>';
    if (!lastResult || !client || typeof client.requestExplanation !== 'function' || typeof client.buildEquipmentSelectionContext !== 'function') return;
    var serial = ++aiExplainSerial;
    var context = client.buildEquipmentSelectionContext(lastResult, activeOption, review);
    client.requestExplanation(context).then(function (result) {
      if (serial !== aiExplainSerial || !host) return;
      if (!result || !result.ok) {
        host.innerHTML =
          '<div class="equip-ai-foundation">' +
            '<strong>' + t('Ø´Ø±Ø­ AI ØºÙŠØ± Ù…ØªØ§Ø­', 'AI explanation unavailable') + '</strong>' +
            '<p>' + t('ØªÙ… Ø§Ù„Ø­ÙØ§Ø¸ Ø¹Ù„Ù‰ Ù†ØªØ§Ø¦Ø¬ Rules Engine ÙˆØ§Ù„ØªØµÙ†ÙŠÙØ§Øª ÙƒÙ…Ø§ Ù‡ÙŠ. Ø³Ø¨Ø¨ Ø§Ù„ØªØ¹Ø°Ø±: ', 'Rules Engine results and buckets remain unchanged. Reason: ') + esc((result && result.reason) || 'ai_unavailable') + '</p>' +
          '</div>';
        return;
      }
      var response = result.response || {};
      var backend = result.backend || {};
      host.innerHTML =
        '<div class="equip-ai-foundation connected">' +
          '<strong>' + t('Ø´Ø±Ø­ AI Ù…Ù† backend', 'Backend AI Explanation') + '</strong>' +
          '<div class="equip-ai-meta">' +
            '<span>Provider: ' + esc(backend.provider || 'unknown') + '</span>' +
            '<span>Source: ' + esc(backend.sourceOfTruth || 'rules_engine') + '</span>' +
            '<span>Role: ' + esc(backend.aiRole || 'explain_only') + '</span>' +
          '</div>' +
          '<p>' + esc(response.explanation || response.reportReadyNarrative || '') + '</p>' +
          (response.riskSummary ? '<p>' + esc(response.riskSummary) + '</p>' : '') +
        '</div>';
    });
  }

  function chooseOption(optionId) {
    selectedOptionId = optionId;
    renderResults();
  }

  function selectedOption() {
    if (!lastResult) return null;
    var options = [lastResult.recommendedOption, lastResult.bestAlternative].concat(lastResult.otherSuitableOptions || []).filter(Boolean);
    return options.filter(function (option) { return option.optionId === selectedOptionId; })[0] || lastResult.recommendedOption || null;
  }

  function applySelectedOption() {
    var option = selectedOption();
    if (!option || !window.AppEquipmentDatabase || typeof window.AppEquipmentDatabase.selectForProject !== 'function') {
      if (window.toast) window.toast(t('Ù„Ø§ ÙŠÙˆØ¬Ø¯ Ø®ÙŠØ§Ø± Ù‚Ø§Ø¨Ù„ Ù„Ù„ØªØ·Ø¨ÙŠÙ‚.', 'No applicable option selected.'));
      return;
    }
    var review = selectedOptionReview(option);
    if (review.status === 'critical') {
      if (window.toast) window.toast(t('Ù„Ø§ ÙŠÙ…ÙƒÙ† Ø±Ø¨Ø· Ø®ÙŠØ§Ø± Ø­Ø±Ø¬ Ø¨Ø§Ù„Ù…Ø´Ø±ÙˆØ¹. Ø§Ø®ØªØ± Ø¨Ø¯ÙŠÙ„Ù‹Ø§ Ø£Ùˆ Ø¹Ø¯Ù‘Ù„ Ø§Ù„Ù…ØªØ·Ù„Ø¨Ø§Øª.', 'Critical equipment cannot be bound to the project. Choose another option or revise requirements.'));
      renderResults();
      return;
    }
    var snapshotOption = Object.assign({}, option, {
      selectionRequirements: lastResult && lastResult.requirements ? lastResult.requirements : readRequirements(),
      engineerVerificationRequired: lastResult && lastResult.engineerVerificationRequired ? lastResult.engineerVerificationRequired : [],
      missingProjectData: lastResult && lastResult.missingProjectData ? lastResult.missingProjectData : [],
      preBindReview: {
        source: 'rules_engine',
        status: review.status,
        label: review.label,
        notes: review.notes || []
      }
    });
    if (selectionContext && selectionContext.target === 'projectSystem' && typeof window.applyProjectSystemEquipmentSelection === 'function') {
      if (window.applyProjectSystemEquipmentSelection(selectionContext.systemId, option.equipmentId, snapshotOption)) {
        closeWizard();
        return;
      }
    }
    window.AppEquipmentDatabase.selectForProject(option.equipmentId, snapshotOption);
    setStep(6);
  }

  function applyManualCapacity(value) {
    var btu = num(value);
    if (btu <= 0) {
      if (window.toast) window.toast(t('\u0623\u062f\u062e\u0644 \u0633\u0639\u0629 \u0635\u062d\u064a\u062d\u0629.', 'Enter a valid capacity.'));
      return;
    }
    if (selectionContext && selectionContext.target === 'projectSystem' && typeof window.applyProjectSystemManualCapacity === 'function') {
      if (window.applyProjectSystemManualCapacity(selectionContext.systemId, btu)) {
        closeWizard();
        return;
      }
    }
    if (typeof window.setProjWorkflowCapacity === 'function') window.setProjWorkflowCapacity(btu);
    if (window.toast) window.toast(t('\u062a\u0645 \u062d\u0641\u0638 \u0633\u0639\u0629 \u064a\u062f\u0648\u064a\u0629.', 'Manual capacity saved.'));
    closeWizard();
  }

  function updateLabels() {
    var btn = G('equip-ai-select-btn');
    if (btn) btn.textContent = t('\u0627\u062e\u062a\u064a\u0627\u0631 \u0623\u0641\u0636\u0644 \u0648\u062d\u062f\u0629 \u062a\u0644\u0642\u0627\u0626\u064a\u0627', 'AI Select Best Equipment');
    var title = G('equip-select-title');
    if (title) title.textContent = t('\u0627\u062e\u062a\u064a\u0627\u0631 \u0648\u062d\u062f\u0629 \u0627\u0644\u062a\u0643\u064a\u064a\u0641', 'Select HVAC Equipment');
    var subtitle = G('equip-select-subtitle');
    if (subtitle) subtitle.textContent = t('\u0627\u0644\u0641\u0644\u062a\u0631\u0629 \u0648\u0627\u0644\u062a\u0631\u062a\u064a\u0628 \u0645\u0646 Rules Engine\u060c \u0648AI \u0644\u0644\u0634\u0631\u062d \u0641\u0642\u0637 \u0648\u0644\u0627 \u064a\u0646\u062a\u062c \u0627\u0644\u0623\u0631\u0642\u0627\u0645.', 'Filtering and ranking come from the Rules Engine. AI explains only and does not generate numbers.');
  }

  function init() {
    updateLabels();
    setTimeout(function () {
      if (typeof window.applyLang === 'function' && !window.applyLang._equipmentSelectorPatched) {
        var original = window.applyLang;
        window.applyLang = function () {
          var result = original.apply(this, arguments);
          updateLabels();
          return result;
        };
        window.applyLang._equipmentSelectorPatched = true;
      }
    }, 0);
  }

  window.AppEquipmentSelector = {
    open: openWizard,
    openForProjectSystem: openWizard,
    close: closeWizard,
    next: function () { if (currentStep === 1) { renderRequirementSummary(); ensureManualCapacityPanel(); } setStep(currentStep + 1); },
    back: function () { setStep(currentStep - 1); },
    go: setStep,
    runSelection: runSelection,
    chooseOption: chooseOption,
    applySelectedOption: applySelectedOption,
    applyManualCapacity: applyManualCapacity,
    readRequirements: readRequirements,
    defaultRequirements: defaultRequirements
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
