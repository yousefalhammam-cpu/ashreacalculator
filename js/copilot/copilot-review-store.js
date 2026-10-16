(function(root){
  'use strict';

  var STORE_KEY = 'aircalc_hvac_design_copilot_review_snapshots_v1';
  var MAX_SNAPSHOTS = 12;

  function clone(value){
    try{
      return JSON.parse(JSON.stringify(value == null ? null : value));
    }catch(error){
      return null;
    }
  }

  function normalizeProjectKey(projectKey){
    return String(projectKey || 'default-project').toLowerCase().replace(/[^a-z0-9_-]+/g, '-').slice(0, 90) || 'default-project';
  }

  function readBucket(){
    try{
      var parsed = JSON.parse(root.localStorage.getItem(STORE_KEY) || '{}');
      if(Array.isArray(parsed)) return { 'default-project': parsed };
      return parsed && typeof parsed === 'object' ? parsed : {};
    }catch(error){
      return {};
    }
  }

  function writeBucket(bucket){
    try{
      root.localStorage.setItem(STORE_KEY, JSON.stringify(bucket || {}));
    }catch(error){}
  }

  function readAll(projectKey){
    var bucket = readBucket();
    var key = normalizeProjectKey(projectKey);
    var items = bucket[key] || [];
    return Array.isArray(items) ? items : [];
  }

  function writeAll(items, projectKey){
    var bucket = readBucket();
    bucket[normalizeProjectKey(projectKey)] = (items || []).slice(0, MAX_SNAPSHOTS);
    writeBucket(bucket);
  }

  function compactReport(report){
    report = report || {};
    return {
      title: report.title || 'HVAC Engineering Review Report',
      generatedAt: report.generatedAt || new Date().toISOString(),
      sourceOfTruth: 'rules_engine',
      aiGeneratedNumbers: false,
      identity: clone(report.identity || {}),
      projectKey: normalizeProjectKey(report.projectKey || (report.identity && report.identity.projectKey)),
      projectHealth: Number(report.projectHealth || 0),
      confidence: Number(report.confidence || 0),
      totals: clone(report.totals || {}),
      metrics: clone(report.metrics || []),
      recommendations: clone(report.recommendations || []),
      scenarios: clone(report.scenarios || []),
      decisionExplanation: clone(report.decisionExplanation || {})
    };
  }

  function save(report){
    report = report || {};
    var projectKey = report.projectKey || (report.identity && report.identity.projectKey);
    var items = readAll(projectKey);
    var snapshot = compactReport(report);
    snapshot.id = 'review-' + Date.now();
    items.unshift(snapshot);
    writeAll(items, snapshot.projectKey);
    return snapshot;
  }

  function latest(projectKey){
    return readAll(projectKey)[0] || null;
  }

  function previous(projectKey){
    return readAll(projectKey)[1] || null;
  }

  function clear(projectKey){
    if(projectKey){
      writeAll([], projectKey);
      return;
    }
    writeBucket({});
  }

  function summarize(projectKey){
    var items = readAll(projectKey);
    var latestItem = items[0] || null;
    return {
      projectKey: normalizeProjectKey(projectKey),
      count: items.length,
      latestHealth: latestItem ? latestItem.projectHealth : 0,
      latestConfidence: latestItem ? latestItem.confidence : 0,
      latestAt: latestItem ? latestItem.generatedAt : '',
      sourceOfTruth: 'rules_engine',
      aiGeneratedNumbers: false
    };
  }

  function exportProject(projectKey){
    var key = normalizeProjectKey(projectKey);
    return {
      schemaVersion: 'copilot-review-export-v1',
      exportedAt: new Date().toISOString(),
      projectKey: key,
      sourceOfTruth: 'rules_engine',
      aiGeneratedNumbers: false,
      snapshots: readAll(key)
    };
  }

  function importProject(payload, projectKey){
    payload = payload || {};
    var key = normalizeProjectKey(projectKey || payload.projectKey);
    var incoming = Array.isArray(payload.snapshots) ? payload.snapshots : [];
    var safe = incoming.map(compactReport).map(function(item){
      item.projectKey = key;
      item.id = item.id || ('review-' + Date.now());
      return item;
    });
    writeAll(safe, key);
    return readAll(key);
  }

  root.AirCalcCopilotReviewStore = {
    key: STORE_KEY,
    maxSnapshots: MAX_SNAPSHOTS,
    readAll: readAll,
    save: save,
    latest: latest,
    previous: previous,
    clear: clear,
    summarize: summarize,
    exportProject: exportProject,
    importProject: importProject
  };
})(typeof window !== 'undefined' ? window : globalThis);
