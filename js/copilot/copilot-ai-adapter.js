(function(root){
  'use strict';

  function clone(value){
    try{
      return JSON.parse(JSON.stringify(value == null ? null : value));
    }catch(error){
      return null;
    }
  }

  function safeText(value){
    return value == null ? '' : String(value);
  }

  function buildContext(report){
    report = report || {};
    return {
      task: 'hvac_design_copilot_summary',
      contractVersion: 1,
      sourceOfTruth: 'rules_engine',
      aiRole: 'explain_only',
      language: root.lang === 'ar' ? 'ar' : 'en',
      projectHealth: report.projectHealth,
      confidence: report.confidence,
      totals: clone(report.totals || {}),
      metrics: clone(report.metrics || []),
      recommendations: clone(report.recommendations || []),
      scenarios: clone(report.scenarios || []),
      decisionExplanation: clone(report.decisionExplanation || {}),
      constraints: {
        mustNotGenerateEngineeringNumbers: true,
        mustNotSelectEquipment: true,
        mustNotChangeScores: true,
        mustNotChangeRanking: true,
        mustNotVerifyCatalogueData: true,
        mustNotInventCatalogueData: true,
        mustUseOnlyProvidedValues: true
      }
    };
  }

  function fallbackSummary(report, reason){
    report = report || {};
    var recs = Array.isArray(report.recommendations) ? report.recommendations : [];
    var critical = recs.filter(function(item){ return item.priority === 'critical'; }).length;
    var warnings = recs.filter(function(item){ return item.priority === 'warning'; }).length;
    var first = recs[0] || {};
    return {
      ok: true,
      fallback: true,
      reason: reason || 'ai_summary_fallback',
      sourceOfTruth: 'rules_engine',
      aiGeneratedNumbers: false,
      summary: 'Rules Engine review score is ' + safeText(report.projectHealth) + '/100 with confidence ' + safeText(report.confidence) + '/100.',
      priority: critical ? 'critical' : (warnings ? 'warning' : 'suggestion'),
      nextStep: first.title || 'Continue deterministic engineering review.',
      note: 'AI summary unavailable or not configured. Rules Engine results remain active.'
    };
  }

  function normalizeAiResponse(result, report){
    if(!result || !result.ok){
      return fallbackSummary(report, result && result.reason);
    }
    var payload = result.response || {};
    return {
      ok: true,
      fallback: false,
      sourceOfTruth: 'rules_engine',
      aiGeneratedNumbers: false,
      summary: safeText(payload.reportReadyNarrative || payload.explanation || payload.riskSummary || ''),
      priority: safeText(payload.priority || ''),
      nextStep: safeText((payload.questionsForEngineer && payload.questionsForEngineer[0]) || payload.alternativeInterpretation || ''),
      note: 'AI text is explain-only. Engineering values remain from deterministic engines.'
    };
  }

  async function summarizeReview(report, options){
    options = options || {};
    var context = buildContext(report);
    if(options.forceFailure){
      return fallbackSummary(report, 'forced_failure_for_test');
    }
    if(!root.AirCalcAIExplanationClient || typeof root.AirCalcAIExplanationClient.requestExplanation !== 'function'){
      return fallbackSummary(report, 'ai_client_unavailable');
    }
    var result = await root.AirCalcAIExplanationClient.requestExplanation(context, {
      endpoint: options.endpoint,
      timeoutMs: options.timeoutMs || (root.AirCalcAIConfig && root.AirCalcAIConfig.timeoutMs) || 5000
    });
    return normalizeAiResponse(result, report);
  }

  root.AirCalcCopilotAIAdapter = {
    buildContext: buildContext,
    fallbackSummary: fallbackSummary,
    summarizeReview: summarizeReview
  };
})(typeof window !== 'undefined' ? window : globalThis);
