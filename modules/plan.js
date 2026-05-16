// AirCalc Pro - modules/plan.js
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
      saveQuotation:     false,
      cloudSave:         false
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
      saveQuotation:     true,
      cloudSave:         true
    }
  };

  var FEATURE_ALIAS = {
    export_pdf:   'exportPDF',
    export_hap:   'exportHAP',
    save_project: 'unlimitedProjects',
    save_quote:   'saveQuotation',
    save_quotation: 'saveQuotation',
    dashboard:    'projectDashboard',
    cloud_save:   'cloudSave',
    report:       'techReport',
    project_mode: 'projectMode',
    advanced_duct: 'advancedDuct'
  };

  var FEATURE_MESSAGES = {
    exportPDF: {
      ar: 'سجّل الدخول لتفعيل PRO وتصدير PDF.',
      en: 'Sign in to unlock PRO and export PDF.'
    },
    exportHAP: {
      ar: 'سجّل الدخول لتفعيل PRO وتصدير HAP.',
      en: 'Sign in to unlock PRO and export HAP.'
    },
    techReport: {
      ar: 'سجّل الدخول لتفعيل PRO واستخدام التقرير الفني.',
      en: 'Sign in to unlock PRO and use the technical report.'
    },
    unlimitedProjects: {
      ar: 'سجّل الدخول لتفعيل PRO وحفظ المشاريع.',
      en: 'Sign in to unlock PRO and save projects.'
    },
    projectMode: {
      ar: 'سجّل الدخول لتفعيل PRO واستخدام وضع المشروع.',
      en: 'Sign in to unlock PRO and use project mode.'
    },
    projectDashboard: {
      ar: 'سجّل الدخول لتفعيل PRO وفتح لوحة المشاريع.',
      en: 'Sign in to unlock PRO and open the project dashboard.'
    },
    ductSizing: {
      ar: 'سجّل الدخول لتفعيل PRO واستخدام تصميم المجاري.',
      en: 'Sign in to unlock PRO and use duct sizing.'
    },
    espCalc: {
      ar: 'سجّل الدخول لتفعيل PRO واستخدام حساب ESP.',
      en: 'Sign in to unlock PRO and use ESP calculation.'
    },
    advancedDuct: {
      ar: 'سجّل الدخول لتفعيل PRO واستخدام التحليل المتقدم.',
      en: 'Sign in to unlock PRO and use advanced analysis.'
    },
    saveQuotation: {
      ar: 'سجّل الدخول لتفعيل PRO وحفظ عرض السعر.',
      en: 'Sign in to unlock PRO and save the quotation.'
    },
    cloudSave: {
      ar: 'سجّل الدخول لتفعيل PRO والحفظ السحابي.',
      en: 'Sign in to unlock PRO and use cloud saving.'
    }
  };

  var _lockedUiBound = false;

  function _lang() { return (typeof lang !== 'undefined') ? lang : 'ar'; }
  function _isAr() { return _lang() === 'ar'; }

  function _toast(msg) {
    if (typeof toast === 'function') { toast(msg); return; }
    if (window.AppHelpers && typeof window.AppHelpers.toast === 'function') {
      window.AppHelpers.toast(msg);
    }
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

  function _resolveFeatureKey(featureName) {
    if (!featureName) return '';
    if (FEATURE_MAP.pro[featureName] !== undefined) return featureName;
    return FEATURE_ALIAS[featureName] || featureName;
  }

  function _featureMessage(featureKey) {
    var msg = FEATURE_MESSAGES[_resolveFeatureKey(featureKey)] || null;
    if (!msg) return _isAr() ? 'سجّل الدخول لتفعيل PRO مجانًا.' : 'Sign in to unlock PRO for free.';
    return _isAr() ? msg.ar : msg.en;
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
    var key = _resolveFeatureKey(featureKey);
    var plan = getCurrentPlan();
    var map = getFeatureAccess(plan);
    return map[key] === true;
  }

  function _track(name, params) {
    try {
      if (typeof window.trackEvent === 'function') {
        window.trackEvent(name, params || {});
      }
    } catch (error) {
      console.warn('GA event failed silently:', name);
    }
  }

  function showProLoginModal(featureName) {
    var key = _resolveFeatureKey(featureName);
    _track('pro_modal_view', {
      feature: key,
      language: (window.lang || document.documentElement.lang || 'ar') === 'en' ? 'en' : 'ar'
    });
    _toast(_featureMessage(featureName));
    if (window.AppAuth && typeof window.AppAuth.openAuthModal === 'function') {
      setTimeout(function () {
        window.AppAuth.openAuthModal({
          proUnlock: true,
          featureKey: key
        });
      }, 80);
    }
    return false;
  }

  function requirePro(featureName, callback) {
    var key = _resolveFeatureKey(featureName);
    if (!_user() || getCurrentPlan() !== 'pro' || !hasAccess(key)) {
      _track('pro_blocked', {
        feature: key,
        language: (window.lang || document.documentElement.lang || 'ar') === 'en' ? 'en' : 'ar'
      });
      showProLoginModal(key);
      return false;
    }
    _track('pro_feature_used', {
      feature: key,
      language: (window.lang || document.documentElement.lang || 'ar') === 'en' ? 'en' : 'ar'
    });
    if (typeof callback === 'function') callback();
    return true;
  }

  function requireFeature(featureKey) {
    return requirePro(featureKey);
  }

  function getProjectLimit() {
    return hasAccess('unlimitedProjects') ? Infinity : GUEST_PROJECT_LIMIT;
  }

  function _toggleLockedElement(el, locked) {
    if (!el) return;
    el.dataset.proLocked = locked ? 'true' : 'false';
    el.setAttribute('aria-disabled', locked ? 'true' : 'false');
    el.classList.toggle('btn-locked', locked);
    el.classList.toggle('pro-locked-trigger', locked);
    if (el.classList.contains('ni')) el.classList.toggle('pro-locked-nav', locked);
    if (locked) {
      if (!el.hasAttribute('data-prev-tabindex') && el.hasAttribute('tabindex')) {
        el.setAttribute('data-prev-tabindex', el.getAttribute('tabindex'));
      }
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
      el.setAttribute('role', el.getAttribute('role') || 'button');
    } else {
      if (el.hasAttribute('data-prev-tabindex')) {
        el.setAttribute('tabindex', el.getAttribute('data-prev-tabindex'));
        el.removeAttribute('data-prev-tabindex');
      } else if (el.classList.contains('ni')) {
        el.setAttribute('tabindex', '0');
      } else {
        el.removeAttribute('tabindex');
      }
    }
  }

  function syncLockedUI(root) {
    var scope = root || document;
    if (!scope || !scope.querySelectorAll) return;
    scope.querySelectorAll('[data-pro-feature]').forEach(function (el) {
      var feature = el.getAttribute('data-pro-feature') || '';
      _toggleLockedElement(el, !hasAccess(feature));
    });
  }

  function _handleLockedInteraction(ev) {
    var target = ev.target && ev.target.closest ? ev.target.closest('[data-pro-feature]') : null;
    if (!target || target.dataset.proLocked !== 'true') return;
    if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault();
    ev.stopPropagation();
    if (typeof ev.stopImmediatePropagation === 'function') ev.stopImmediatePropagation();
    showProLoginModal(target.getAttribute('data-pro-feature') || '');
  }

  function bindLockedUiGuards() {
    if (_lockedUiBound) return;
    _lockedUiBound = true;
    document.addEventListener('click', _handleLockedInteraction, true);
    document.addEventListener('keydown', _handleLockedInteraction, true);
  }

  bindLockedUiGuards();
  document.addEventListener('DOMContentLoaded', function () {
    syncLockedUI(document);
  });

  window.AppPlan = {
    getCurrentPlan:   getCurrentPlan,
    getAccessType:    getAccessType,
    setCurrentPlan:   setCurrentPlan,
    isPro:            isPro,
    isEarlyAccess:    isEarlyAccess,
    getFeatureAccess: getFeatureAccess,
    hasAccess:        hasAccess,
    requireFeature:   requireFeature,
    requirePro:       requirePro,
    showProLoginModal: showProLoginModal,
    syncLockedUI:     syncLockedUI,
    getProjectLimit:  getProjectLimit,
    GUEST_PROJECT_LIMIT: GUEST_PROJECT_LIMIT
  };

  window.getCurrentPlan = getCurrentPlan;
  window.setCurrentPlan = setCurrentPlan;
  window.hasAccess = hasAccess;
  window.requireFeature = requireFeature;
  window.requirePro = requirePro;
  window.showProLoginModal = showProLoginModal;

  console.log('[AirCalc] AppPlan initialised - Firebase-backed access control');
})();
