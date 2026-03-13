/* ============================================================
   modules/plan.js  —  AirCalc plan management
   Plain script (no ES modules). All functions on window.
   localStorage key : aircalc_plan
   Default plan     : free
   Supported plans  : free | pro | monthly | yearly | lifetime
   ============================================================ */

(function (w) {

  var PLAN_KEY  = 'aircalc_plan';
  var VALID     = ['free', 'pro', 'monthly', 'yearly', 'lifetime'];

  /* "pro" behaviour is shared by every paid tier */
  var PRO_PLANS = ['pro', 'monthly', 'yearly', 'lifetime'];

  /* ── Feature map ──────────────────────────────────────────
     Keys must match every caller of hasAccess() in the app.
     Free gets the basics; every paid tier gets everything.   */
  var FEATURES = {
    free: {
      basicCalc:        true,
      projectionMode:   false,
      exportPDF:        false,
      exportTechPDF:    false,
      liveBadge:        false,
      unlimitedHistory: false,
      multiCurrency:    false,
      advancedCharts:   false
    },
    pro: {
      basicCalc:        true,
      projectionMode:   true,
      exportPDF:        true,
      exportTechPDF:    true,
      liveBadge:        true,
      unlimitedHistory: true,
      multiCurrency:    true,
      advancedCharts:   true
    }
  };
  /* monthly / yearly / lifetime share pro feature set */
  FEATURES.monthly  = FEATURES.pro;
  FEATURES.yearly   = FEATURES.pro;
  FEATURES.lifetime = FEATURES.pro;

  /* Track the billing-period pill selected inside the overlay */
  var _activePill = 'yearly';

  /* ── Helpers ──────────────────────────────────────────── */

  function isPro(plan) {
    return PRO_PLANS.indexOf(plan) !== -1;
  }

  function el(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    var node = el(id);
    if (node) node.textContent = text;
  }

  function setHidden(id, hide) {
    var node = el(id);
    if (node) node.hidden = hide;
  }

  function toggleClass(id, cls, force) {
    var node = el(id);
    if (node) node.classList.toggle(cls, force);
  }

  /* ── Core getters / setters ───────────────────────────── */

  w.getCurrentPlan = function () {
    try {
      var stored = localStorage.getItem(PLAN_KEY);
      if (stored && VALID.indexOf(stored) !== -1) return stored;
    } catch (e) { /* storage blocked */ }
    return 'free';
  };

  w.setCurrentPlan = function (plan) {
    if (VALID.indexOf(plan) === -1) {
      console.error('[plan] Unknown plan: ' + plan);
      return;
    }
    try {
      localStorage.setItem(PLAN_KEY, plan);
    } catch (e) { /* storage blocked */ }
    w.updatePlanUI();
    document.dispatchEvent(new CustomEvent('planChanged', { detail: { plan: plan } }));
  };

  /* ── Feature access ───────────────────────────────────── */

  w.getFeatureAccess = function (plan) {
    return FEATURES[plan] || FEATURES['free'];
  };

  w.hasAccess = function (featureKey) {
    var map = w.getFeatureAccess(w.getCurrentPlan());
    return map[featureKey] === true;
  };

  w.requireFeature = function (featureKey, message) {
    if (w.hasAccess(featureKey)) return;
    var msg = message || 'Upgrade your plan to unlock this feature.';
    var subtitle = document.querySelector('#upgrade-overlay .upgrade-subtitle');
    if (subtitle) subtitle.textContent = msg;
    w.openUpgradeSheet();
    throw new Error('[plan] Access denied – ' + featureKey + ': ' + msg);
  };

  /* ── UI update ────────────────────────────────────────── */

  w.updatePlanUI = function () {
    var plan  = w.getCurrentPlan();
    var paid  = isPro(plan);
    var label = plan.charAt(0).toUpperCase() + plan.slice(1);

    /* ── Status pill (#plan-status-pill) ── */
    var pill = el('plan-status-pill');
    if (pill) {
      pill.textContent = paid ? label + ' ✓' : 'Free';
      pill.className   = pill.className.replace(/\bplan--(free|pro|monthly|yearly|lifetime)\b/g, '');
      pill.classList.add('plan--' + plan);
    }

    /* ── Header badge (#header-plan-badge) ── */
    setText('header-plan-badge', label);
    toggleClass('header-plan-badge', 'badge--pro',  paid);
    toggleClass('header-plan-badge', 'badge--free', !paid);

    /* ── Live badge (#ptg-live-badge) ── */
    setHidden('ptg-live-badge', !paid);

    /* ── Tab buttons – mark the active tier ── */
    ['free', 'pro', 'monthly', 'yearly'].forEach(function (t) {
      toggleClass('tbtn-' + t, 'active', plan === t);
    });

    /* ── PTG description / feature list ── */
    var descEl = el('ptg-desc');
    if (descEl) {
      descEl.textContent = paid
        ? 'Full access to all projection tools and live data.'
        : 'Upgrade to Pro for advanced projections and PDF exports.';
    }

    var featEl = el('ptg-features');
    if (featEl) {
      featEl.textContent = paid
        ? '✔ Projections  ✔ PDF export  ✔ Live badge  ✔ Unlimited history'
        : '✘ Projections  ✘ PDF export  ✘ Live badge  ✘ Unlimited history';
    }

    /* ── Gated buttons ── */
    var btnPdf      = el('btn-pdf');
    var btnTechpdf  = el('btn-techpdf');
    var modeBtnProj = el('mode-btn-proj');

    if (btnPdf)      { btnPdf.disabled      = !paid; btnPdf.classList.toggle('locked', !paid); }
    if (btnTechpdf)  { btnTechpdf.disabled  = !paid; btnTechpdf.classList.toggle('locked', !paid); }
    if (modeBtnProj) { modeBtnProj.disabled = !paid; modeBtnProj.classList.toggle('locked', !paid); }
  };

  /* ── Upgrade overlay ──────────────────────────────────── */

  w.openUpgradeSheet = function () {
    var overlay = el('upgrade-overlay');
    if (!overlay) { console.warn('[plan] #upgrade-overlay not found'); return; }

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overlay-open');

    w.selectPricePill(_activePill);

    var first = overlay.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])');
    if (first) first.focus();
  };

  w.closeUpgradeSheet = function (event) {
    /* If triggered by a click, close only when target is the backdrop itself */
    if (event && event.type === 'click') {
      var card = document.querySelector('#upgrade-overlay .overlay-card');
      if (card && card !== event.target && card.contains(event.target)) return;
    }

    var overlay = el('upgrade-overlay');
    if (!overlay) return;

    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overlay-open');
  };

  /* ── Price pill selection ─────────────────────────────── */

  w.selectPricePill = function (type) {
    _activePill = type;

    /* Pill elements: #pp-lifetime, #pp-yearly, #pp-monthly */
    ['lifetime', 'yearly', 'monthly'].forEach(function (t) {
      toggleClass('pp-' + t, 'selected', t === type);
    });

    /* Also align tab buttons if visible in overlay */
    ['monthly', 'yearly'].forEach(function (t) {
      toggleClass('tbtn-' + t, 'active', t === type);
    });
  };

  /* ── Upgrade action ───────────────────────────────────── */

  w.upgradeToPro = function () {
    /* Map the selected pill to the matching plan key */
    var planMap = { monthly: 'monthly', yearly: 'yearly', lifetime: 'lifetime' };
    var target  = planMap[_activePill] || 'yearly';

    var btn = document.querySelector('#upgrade-overlay .upgrade-cta-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Processing…'; }

    /* ── Replace the timeout below with your real payment flow ── */
    setTimeout(function () {
      w.setCurrentPlan(target);
      w.closeUpgradeSheet();

      if (btn) { btn.disabled = false; btn.textContent = 'Upgrade Now'; }

      var conf = el('upgrade-confirmation');
      if (conf) {
        conf.hidden = false;
        setTimeout(function () { conf.hidden = true; }, 4000);
      }
    }, 800);
  };

  /* ── Auto-init ────────────────────────────────────────── */

  function init() {
    w.updatePlanUI();

    /* Escape key closes overlay */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') w.closeUpgradeSheet();
    });

    /* Backdrop click closes overlay */
    var overlay = el('upgrade-overlay');
    if (overlay) overlay.addEventListener('click', w.closeUpgradeSheet);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}(window));