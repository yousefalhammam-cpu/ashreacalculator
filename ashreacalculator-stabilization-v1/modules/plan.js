// ── AirCalc Pro — modules/plan.js ─────────────────────────────────────────
// Central Free vs Pro plan system.
// Storage key: aircalc_plan
// Plans: 'free' | 'pro' | 'monthly' | 'yearly' | 'lifetime'
// All 'pro' variants share the same feature set.
// ─────────────────────────────────────────────────────────────────────────
(function () {
  'use strict';

  var PLAN_KEY       = 'aircalc_plan';
  var FREE_PROJ_LIMIT = 3;

  // ── Feature map ──────────────────────────────────────────────────────────
  // true = available on plan
  var FEATURE_MAP = {
    free: {
      exportCSV:         true,
      exportPDF:         false,
      techReport:        false,
      unlimitedProjects: false,
      projectMode:       false,
      ductSizing:        false,
      espCalc:           false,
      advancedDuct:      false
    },
    pro: {
      exportCSV:         true,
      exportPDF:         true,
      techReport:        true,
      unlimitedProjects: true,
      projectMode:       true,
      ductSizing:        true,
      espCalc:           true,
      advancedDuct:      true
    }
  };
  // monthly / yearly / lifetime share pro features
  FEATURE_MAP.monthly  = FEATURE_MAP.pro;
  FEATURE_MAP.yearly   = FEATURE_MAP.pro;
  FEATURE_MAP.lifetime = FEATURE_MAP.pro;

  // ── Helpers ──────────────────────────────────────────────────────────────
  function _lang() { return (typeof lang !== 'undefined') ? lang : 'ar'; }
  function _toast(msg) {
    if (typeof toast === 'function') { toast(msg); return; }
    if (window.AppHelpers) window.AppHelpers.toast(msg);
  }
  function _isAr() { return _lang() === 'ar'; }

  // ── Core API ─────────────────────────────────────────────────────────────

  function getCurrentPlan() {
    try {
      if (window.AppStorage && typeof AppStorage.restorePlan === 'function') {
        return AppStorage.restorePlan() || 'free';
      }
      return localStorage.getItem(PLAN_KEY) || 'free';
    } catch(e) {
      return 'free';
    }
  }

  function setCurrentPlan(plan) {
    var valid = ['free','pro','monthly','yearly','lifetime'];
    if (valid.indexOf(plan) < 0) plan = 'free';
    try {
      if (window.AppStorage && typeof AppStorage.savePlan === 'function') {
        AppStorage.savePlan(plan);
      } else {
        localStorage.setItem(PLAN_KEY, plan);
      }
    } catch(e) {}
    if (typeof updatePlanUI === 'function') updatePlanUI();
    console.log('[AirCalc] Plan set to:', plan);
  }

  function isPro() {
    return getCurrentPlan() !== 'free';
  }

  function getFeatureAccess(plan) {
    return FEATURE_MAP[plan] || FEATURE_MAP.free;
  }

  function hasAccess(featureKey) {
    var plan = getCurrentPlan();
    var map  = getFeatureAccess(plan);
    return map[featureKey] === true;
  }

  // requireFeature — returns true if allowed, shows toast + returns false if not
  function requireFeature(featureKey) {
    if (hasAccess(featureKey)) return true;
    var msgs = {
      exportPDF:         _isAr() ? '📄 تصدير PDF متاح في نسخة Pro فقط'           : '📄 PDF export is a Pro feature',
      techReport:        _isAr() ? '🛠️ التقرير الفني متاح في نسخة Pro فقط'       : '🛠️ Tech Report is a Pro feature',
      unlimitedProjects: _isAr() ? '📁 رُقِّ إلى Pro لحفظ مشاريع غير محدودة'    : '📁 Upgrade to Pro for unlimited projects',
      projectMode:       _isAr() ? '🏢 وضع المشروع متاح في نسخة Pro فقط'        : '🏢 Project mode is a Pro feature',
      ductSizing:        _isAr() ? '🌬 تصميم مجاري الهواء متاح في نسخة Pro فقط' : '🌬 Duct sizing is a Pro feature',
      espCalc:           _isAr() ? '🔧 حساب ESP متاح في نسخة Pro فقط'           : '🔧 ESP calc is a Pro feature',
      advancedDuct:      _isAr() ? 'التحليل المتقدم للمجاري متاح في نسخة Pro فقط' : 'Advanced duct analysis is a Pro feature'
    };
    var msg = msgs[featureKey]
      || (_isAr() ? '🔒 هذه الميزة متاحة في نسخة Pro فقط' : '🔒 This feature requires Pro');
    _toast(msg);
    // Flash upgrade button in settings
    setTimeout(function() {
      var btn = document.getElementById('set-upgrade-btn');
      if (btn) {
        btn.classList.add('upgrade-pulse');
        setTimeout(function(){ btn.classList.remove('upgrade-pulse'); }, 1200);
      }
    }, 300);
    return false;
  }

  function getProjectLimit() {
    return hasAccess('unlimitedProjects') ? Infinity : FREE_PROJ_LIMIT;
  }

  // ── Expose ────────────────────────────────────────────────────────────────
  window.AppPlan = {
    getCurrentPlan:  getCurrentPlan,
    setCurrentPlan:  setCurrentPlan,
    isPro:           isPro,
    getFeatureAccess:getFeatureAccess,
    hasAccess:       hasAccess,
    requireFeature:  requireFeature,
    getProjectLimit: getProjectLimit,
    FREE_PROJ_LIMIT: FREE_PROJ_LIMIT
  };

  // Backward-compat shortcuts
  window.getCurrentPlan  = getCurrentPlan;
  window.setCurrentPlan  = setCurrentPlan;
  window.hasAccess       = hasAccess;
  window.requireFeature  = requireFeature;

  console.log('[AirCalc] AppPlan initialised — plan:', getCurrentPlan());
})();