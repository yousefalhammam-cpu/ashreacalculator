/* ============================================================
   modules/plan.js  —  AirCalc Pro plan management
   Plain script, no ES modules. All functions on window.
   localStorage key : aircalc_plan
   Default plan     : free
   Supported plans  : free | pro | monthly | yearly | lifetime
   ============================================================ */

(function (w) {

  var PLAN_KEY  = 'aircalc_plan';
  var VALID     = ['free', 'pro', 'monthly', 'yearly', 'lifetime'];
  var PRO_PLANS = ['pro', 'monthly', 'yearly', 'lifetime'];

  /* ── Feature maps ─────────────────────────────────────── */

  var FREE_FEATURES = {
    exportCSV:         true,
    exportPDF:         false,
    techReport:        false,
    unlimitedProjects: false,
    projectMode:       false,
    ductSizing:        false,
    espCalc:           false
  };

  var PRO_FEATURES = {
    exportCSV:         true,
    exportPDF:         true,
    techReport:        true,
    unlimitedProjects: true,
    projectMode:       true,
    ductSizing:        true,
    espCalc:           true
  };

  var FEATURES = {
    free:     FREE_FEATURES,
    pro:      PRO_FEATURES,
    monthly:  PRO_FEATURES,
    yearly:   PRO_FEATURES,
    lifetime: PRO_FEATURES
  };

  /* Active billing pill inside the overlay */
  var _activePill = 'yearly';

  /* ── DOM helpers ──────────────────────────────────────── */

  function el(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    var node = el(id);
    if (node) node.textContent = text;
  }

  function setHidden(id, hide) {
    var node = el(id);
    if (node) node.hidden = !!hide;
  }

  function toggleClass(id, cls, force) {
    var node = el(id);
    if (node) node.classList.toggle(cls, !!force);
  }

  function isPro(plan) {
    return PRO_PLANS.indexOf(plan) !== -1;
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
    return FEATURES[plan] || FREE_FEATURES;
  };

  w.hasAccess = function (featureKey) {
    var map = w.getFeatureAccess(w.getCurrentPlan());
    return map[featureKey] === true;
  };

  w.requireFeature = function (featureKey, message) {
    if (w.hasAccess(featureKey)) return;
    var msg = message || 'Upgrade your plan to unlock this feature.';
    var subtitle = document.querySelector('#upgrade-overlay .upgrade-sheet .upgrade-subtitle');
    if (subtitle) subtitle.textContent = msg;
    w.openUpgradeSheet();
    throw new Error('[plan] Access denied – ' + featureKey + ': ' + msg);
  };

  /* ── UI update ────────────────────────────────────────── */

  w.updatePlanUI = function () {
    var plan  = w.getCurrentPlan();
    var paid  = isPro(plan);
    var label = plan.charAt(0).toUpperCase() + plan.slice(1);

    /* #plan-status-pill */
    var pill = el('plan-status-pill');
    if (pill) {
      pill.textContent = paid ? label + ' ✓' : 'Free';
      VALID.forEach(function (t) { pill.classList.remove('plan--' + t); });
      pill.classList.add('plan--' + plan);
    }

    /* #header-plan-badge */
    setText('header-plan-badge', label);
    toggleClass('header-plan-badge', 'badge--pro',  paid);
    toggleClass('header-plan-badge', 'badge--free', !paid);

    /* #ptg-live-badge — visible on paid plans only */
    setHidden('ptg-live-badge', !paid);

    /* Tab buttons: mark whichever tab matches the current plan */
    ['free', 'pro', 'monthly', 'yearly'].forEach(function (t) {
      toggleClass('tbtn-' + t, 'active', plan === t);
    });

    /* #ptg-desc */
    var descEl = el('ptg-desc');
    if (descEl) {
      descEl.textContent = paid
        ? 'Full access to all AirCalc Pro tools and reports.'
        : 'Upgrade to Pro for PDF exports, duct sizing, ESP calc, and more.';
    }

    /* #ptg-features */
    var featEl = el('ptg-features');
    if (featEl) {
      featEl.textContent = paid
        ? '✔ Export PDF  ✔ Tech Report  ✔ Unlimited Projects  ✔ Project Mode  ✔ Duct Sizing  ✔ ESP Calc'
        : '✘ Export PDF  ✘ Tech Report  ✘ Unlimited Projects  ✘ Project Mode  ✘ Duct Sizing  ✘ ESP Calc';
    }

    /* #btn-pdf — gated on exportPDF */
    var btnPdf = el('btn-pdf');
    if (btnPdf) {
      btnPdf.disabled = !paid;
      btnPdf.classList.toggle('locked', !paid);
    }

    /* #btn-techpdf — gated on techReport */
    var btnTechpdf = el('btn-techpdf');
    if (btnTechpdf) {
      btnTechpdf.disabled = !paid;
      btnTechpdf.classList.toggle('locked', !paid);
    }

    /* #mode-btn-proj — gated on projectMode */
    var modeBtnProj = el('mode-btn-proj');
    if (modeBtnProj) {
      modeBtnProj.disabled = !paid;
      modeBtnProj.classList.toggle('locked', !paid);
    }
  };

  /* ── Upgrade overlay ──────────────────────────────────── */

  w.openUpgradeSheet = function () {
    var overlay = el('upgrade-overlay');
    if (!overlay) { console.warn('[plan] #upgrade-overlay not found'); return; }

    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overlay-open');

    w.selectPricePill(_activePill);

    /* Move focus to first interactive element inside the sheet */
    var sheet = overlay.querySelector('.upgrade-sheet');
    if (sheet) {
      var first = sheet.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])');
      if (first) first.focus();
    }
  };

  w.closeUpgradeSheet = function (event) {
    /* When triggered by a click, only close if the click landed on the
       overlay backdrop — not inside .upgrade-sheet itself.             */
    if (event && event.type === 'click') {
      var sheet = document.querySelector('#upgrade-overlay .upgrade-sheet');
      if (sheet && sheet.contains(event.target)) return;
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

    /* #pp-monthly, #pp-yearly, #pp-lifetime */
    ['monthly', 'yearly', 'lifetime'].forEach(function (t) {
      toggleClass('pp-' + t, 'selected', t === type);
    });

    /* Keep matching tab buttons in sync */
    ['monthly', 'yearly'].forEach(function (t) {
      toggleClass('tbtn-' + t, 'active', t === type);
    });
  };

  /* ── Upgrade action ───────────────────────────────────── */

  w.upgradeToPro = function () {
    var planMap = { monthly: 'monthly', yearly: 'yearly', lifetime: 'lifetime' };
    var target  = planMap[_activePill] || 'yearly';

    var btn = el('btn-upgrade-main');
    if (btn) { btn.disabled = true; btn.textContent = 'Processing…'; }

    /* ── Swap the setTimeout for your real payment integration ── */
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

    /* Escape closes the overlay */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') w.closeUpgradeSheet();
    });

    /* Backdrop click closes the overlay */
    var overlay = el('upgrade-overlay');
    if (overlay) overlay.addEventListener('click', w.closeUpgradeSheet);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

}(window));