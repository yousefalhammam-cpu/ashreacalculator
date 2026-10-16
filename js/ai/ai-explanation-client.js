(function (root) {
  'use strict';

  var DEFAULT_TIMEOUT_MS = 6000;

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value == null ? null : value));
    } catch (_err) {
      return null;
    }
  }

  function text(value) {
    return value == null ? '' : String(value).trim();
  }

  function safeNumber(value) {
    var n = Number(value);
    return isFinite(n) ? n : null;
  }

  function compactOption(option) {
    option = option || {};
    var record = option.record || {};
    return {
      optionId: text(option.optionId),
      equipmentId: text(option.equipmentId),
      manufacturerName: text(record.manufacturerName),
      exactModelNumber: text(record.exactModelNumber),
      quantity: safeNumber(option.quantity),
      activeQuantity: safeNumber(option.activeQuantity),
      totalCapacityBtuH: safeNumber(option.totalCapacityBtuH),
      totalAirflowCfm: safeNumber(option.totalAirflowCfm),
      availableEspPa: safeNumber(option.availableEspPa),
      oversizingPercent: safeNumber(option.oversizingPercent),
      matchScore: safeNumber(option.matchScore),
      verificationStatus: text(record.verificationStatus),
      sourceDocumentName: text(record.sourceDocumentName),
      sourceReference: text(record.sourceReference),
      saudiMarketStatus: text(record.saudiMarketStatus),
      scoreBreakdown: clone(option.scoreBreakdown || {})
    };
  }

  function buildEquipmentSelectionContext(selectionResult, selectedOption, preBindReview) {
    selectionResult = selectionResult || {};
    return {
      task: 'equipment_selection_explanation',
      language: root.lang === 'ar' ? 'ar' : 'en',
      contractVersion: 1,
      sourceOfTruth: 'rules_engine',
      aiRole: 'explain_only',
      requirements: clone(selectionResult.requirements || {}),
      selectedOption: compactOption(selectedOption || selectionResult.recommendedOption),
      recommendedOption: compactOption(selectionResult.recommendedOption),
      bestAlternative: compactOption(selectionResult.bestAlternative),
      recommendationBuckets: (selectionResult.recommendationBuckets || []).map(function (bucket) {
        return {
          id: text(bucket.id),
          label: text(bucket.label),
          reason: text(bucket.reason),
          available: !!bucket.available,
          optionId: text(bucket.optionId)
        };
      }),
      missingProjectData: clone(selectionResult.missingProjectData || []),
      engineerVerificationRequired: clone(selectionResult.engineerVerificationRequired || []),
      preBindReview: clone(preBindReview || {}),
      constraints: {
        mustNotGenerateEngineeringNumbers: true,
        mustNotChangeRanking: true,
        mustNotVerifyCatalogueData: true,
        mustUseOnlyProvidedValues: true
      }
    };
  }

  function collectNumbers(value, out) {
    out = out || {};
    if (value == null) return out;
    if (typeof value === 'number' && isFinite(value)) {
      out[String(value)] = true;
      out[String(Math.round(value))] = true;
      out[value.toLocaleString('en-US')] = true;
      return out;
    }
    if (typeof value === 'string') {
      (value.match(/-?\d+(?:,\d{3})*(?:\.\d+)?/g) || []).forEach(function (num) {
        out[num] = true;
        out[num.replace(/,/g, '')] = true;
      });
      return out;
    }
    if (Array.isArray(value)) {
      value.forEach(function (item) { collectNumbers(item, out); });
      return out;
    }
    if (typeof value === 'object') {
      Object.keys(value).forEach(function (key) { collectNumbers(value[key], out); });
    }
    return out;
  }

  function validateExplainOnlyResponse(response, sourceContext) {
    var allowed = collectNumbers(sourceContext, {});
    var payload = clone(response || {});
    var fields = ['explanation', 'riskSummary', 'questionsForEngineer', 'alternativeInterpretation', 'reportReadyNarrative'];
    var unsupported = {};
    fields.forEach(function (field) {
      collectNumbers(payload && payload[field], unsupported);
    });
    var bad = Object.keys(unsupported).filter(function (num) { return !allowed[num] && !allowed[num.replace(/,/g, '')]; });
    if (bad.length) {
      return { ok: false, reason: 'ai_returned_unsupported_engineering_numbers', unsupportedNumbers: bad.slice(0, 10) };
    }
    return { ok: true, response: payload };
  }

  function unwrapBackendResponse(data) {
    if (data && data.ok === false) {
      return { ok: false, reason: data.reason || 'ai_backend_rejected_response', fallback: true, backend: data };
    }
    if (data && data.response && typeof data.response === 'object') {
      return {
        ok: true,
        payload: data.response,
        backend: {
          sourceOfTruth: data.sourceOfTruth,
          aiRole: data.aiRole,
          provider: data.provider
        }
      };
    }
    return { ok: true, payload: data || {} };
  }

  function endpoint() {
    return text((root.AirCalcAIConfig && root.AirCalcAIConfig.explanationEndpoint) || '');
  }

  function timeoutSignal(timeoutMs) {
    if (!root.AbortController) return { signal: undefined, cancel: function () {} };
    var controller = new root.AbortController();
    var timer = root.setTimeout(function () { controller.abort(); }, timeoutMs || DEFAULT_TIMEOUT_MS);
    return {
      signal: controller.signal,
      cancel: function () { root.clearTimeout(timer); }
    };
  }

  async function requestExplanation(context, options) {
    options = options || {};
    var url = text(options.endpoint || endpoint());
    if (!url) return { ok: false, reason: 'ai_backend_not_configured', fallback: true };
    if (typeof root.fetch !== 'function') return { ok: false, reason: 'fetch_unavailable', fallback: true };

    var guard = timeoutSignal(options.timeoutMs || (root.AirCalcAIConfig && root.AirCalcAIConfig.timeoutMs) || DEFAULT_TIMEOUT_MS);
    try {
      var res = await root.fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context: context }),
        signal: guard.signal
      });
      guard.cancel();
      if (!res || !res.ok) return { ok: false, reason: 'ai_backend_http_error', status: res && res.status, fallback: true };
      var data = await res.json();
      var unwrapped = unwrapBackendResponse(data);
      if (!unwrapped.ok) return unwrapped;
      var validation = validateExplainOnlyResponse(unwrapped.payload, context);
      if (!validation.ok) return Object.assign({ fallback: true }, validation);
      return { ok: true, response: validation.response, backend: unwrapped.backend || null };
    } catch (err) {
      guard.cancel();
      return { ok: false, reason: (err && err.name === 'AbortError') ? 'ai_backend_timeout' : 'ai_backend_failed', fallback: true };
    }
  }

  root.AirCalcAIExplanationClient = {
    buildEquipmentSelectionContext: buildEquipmentSelectionContext,
    validateExplainOnlyResponse: validateExplainOnlyResponse,
    unwrapBackendResponse: unwrapBackendResponse,
    requestExplanation: requestExplanation
  };
})(typeof window !== 'undefined' ? window : globalThis);
