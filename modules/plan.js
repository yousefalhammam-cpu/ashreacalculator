// AirCalc Pro — modules/plan.js
// Firebase-backed Guest vs PRO Early Access plan system.
(function () {
  'use strict';

  var GUEST_PROJECT_LIMIT = 0;

  var FEATURE_MAP = {
    guest: {
      exportCSV:         true,
      exportPDF:         false,
      exportHAP:         false,
      techReport:        false,
      unlimitedProjects: false,
      projectMode:       false,
      projectDashboard:  false,
      ductSizing:        false,
      espCalc:           false,
      advancedDuct:      false,
      saveQuotation:     false
    },
    pro: {
      exportCSV:         true,
      exportPDF:         true,
      exportHAP:         true,
      techReport:        true,
      unlimitedProjects: true,
      projectMode:       true,
      projectDashboard:  true,
      ductSizing:        true,
      espCalc:           true,
      advancedDuct:      true,
      saveQuotation:     true
    }
  };

  function _lang() { return (typeof lang !== 'undefined') ? lang : 'ar'; }
  function _isAr() { return _lang() === 'ar'; }
  function _toast(msg) {
    if (typeof toast === 'function') { toast(msg); return; }
    if (window.AppHelpers && typeof window.AppHelpers.toast === 'function') window.AppHelpers.toast(msg);
  }
  function _auth() { return window.AppAuth || null; }
  function _user() {
    var auth = _auth();
    return auth && typeof auth.getCurrentUser === 'function' ? auth.getCurrentUser() : null;
  }
  function _profile() {
    var auth = _auth();
    return auth && typeof auth.getCurrentProfile === 'function' ? (auth.getCurrentProfile() || null) : null;
  }

  function getCurrentPlan() {
    return _user() ? 'pro' : 'guest';
  }

  function getAccessType() {
    if (!_user()) return 'guest';
    var profile = _profile();
    return (profile && profile.accessType) || 'early_access';
  }

  function setCurrentPlan() {
    // No-op for backward compatibility. Auth state is the source of truth.
    if (typeof updatePlanUI === 'function') updatePlanUI();
    return getCurrentPlan();
  }

  function isPro() {
    return getCurrentPlan() === 'pro';
  }

  function isEarlyAccess() {
    return isPro() && getAccessType() === 'early_access';
  }

  function getFeatureAccess(plan) {
    return FEATURE_MAP[plan] || FEATURE_MAP.guest;
  }

  function hasAccess(featureKey) {
    var plan = getCurrentPlan();
    var map = getFeatureAccess(plan);
    return map[featureKey] === true;
  }

  function requireFeature(featureKey) {
    if (hasAccess(featureKey)) return true;
    var msgs = {
      exportPDF:         _isAr() ? 'سجّل الدخول لتفعيل PRO مجانًا وتصدير PDF' : 'Sign in to unlock PRO for free and export PDF',
      exportHAP:         _isAr() ? 'سجّل الدخول لتفعيل PRO مجانًا وتصدير HAP' : 'Sign in to unlock PRO for free and export HAP',
      techReport:        _isAr() ? 'سجّل الدخول لتفعيل PRO مجانًا واستخدام التقرير الفني' : 'Sign in to unlock PRO for free and use the tech report',
      unlimitedProjects: _isAr() ? 'سجّل الدخول لتفعيل PRO مجانًا وحفظ المشاريع' : 'Sign in to unlock PRO for free and save projects',
      projectMode:       _isAr() ? 'سجّل الدخول لتفعيل PRO مجانًا واستخدام وضع المشروع' : 'Sign in to unlock PRO for free and use project mode',
      projectDashboard:  _isAr() ? 'سجّل الدخول لتفعيل PRO مجانًا وفتح لوحة المشاريع' : 'Sign in to unlock PRO for free and open the project dashboard',
      ductSizing:        _isAr() ? 'سجّل الدخول لتفعيل PRO مجانًا واستخدام تصميم المجاري' : 'Sign in to unlock PRO for free and use duct sizing',
      espCalc:           _isAr() ? 'سجّل الدخول لتفعيل PRO مجانًا واستخدام ESP' : 'Sign in to unlock PRO for free and use ESP',
      advancedDuct:      _isAr() ? 'سجّل الدخول لتفعيل PRO مجانًا والتحليل المتقدم' : 'Sign in to unlock PRO for free and use advanced analysis',
      saveQuotation:     _isAr() ? 'سجّل الدخول لتفعيل PRO مجانًا وحفظ عرض السعر' : 'Sign in to unlock PRO for free and save the quotation'
    };
    _toast(msgs[featureKey] || (_isAr() ? 'سجّل الدخول لتفعيل PRO مجانًا' : 'Sign in to unlock PRO for free'));
    if (window.AppAuth && typeof window.AppAuth.openAuthModal === 'function') {
      setTimeout(function () { window.AppAuth.openAuthModal(); }, 120);
    }
    return false;
  }

  function getProjectLimit() {
    return hasAccess('unlimitedProjects') ? Infinity : GUEST_PROJECT_LIMIT;
  }

  window.AppPlan = {
    getCurrentPlan:   getCurrentPlan,
    getAccessType:    getAccessType,
    setCurrentPlan:   setCurrentPlan,
    isPro:            isPro,
    isEarlyAccess:    isEarlyAccess,
    getFeatureAccess: getFeatureAccess,
    hasAccess:        hasAccess,
    requireFeature:   requireFeature,
    getProjectLimit:  getProjectLimit,
    GUEST_PROJECT_LIMIT: GUEST_PROJECT_LIMIT
  };

  window.getCurrentPlan = getCurrentPlan;
  window.setCurrentPlan = setCurrentPlan;
  window.hasAccess = hasAccess;
  window.requireFeature = requireFeature;

  console.log('[AirCalc] AppPlan initialised — Firebase-backed access control');
})();
