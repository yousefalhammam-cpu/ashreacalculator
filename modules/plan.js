/* ============================================================
   modules/plan.js  —  AirCalc Pro plan management
   Plain script, no ES modules.
   Public API on window.AppPlan AND directly on window.
   localStorage key : aircalc_plan
   Default plan     : free
   Supported plans  : free | pro | monthly | yearly | lifetime
   ============================================================ */

(function (w) {

  /* ── Constants ──────────────────────────────────────────────────── */

  var PLAN_KEY         = 'aircalc_plan';
  var VALID            = ['free', 'pro', 'monthly', 'yearly', 'lifetime'];
  var PRO_PLANS        = ['pro', 'monthly', 'yearly', 'lifetime'];
  var MAX_FREE_PROJECTS = 3;

  /* ── Feature maps ───────────────────────────────────────────────── */

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

  /* ── Internal state ─────────────────────────────────────────────── */

  var _selectedPricePlan = 'lifetime'; /* active pill in upgrade overlay */

  /* ── DOM helpers ────────────────────────────────────────────────── */

  function _el(id) {
    return document.getElementById(id);
  }

  function _toggleClass(id, cls, force) {
    var node = _el(id);
    if (node) node.classList.toggle(cls, !!force);
  }

  /* Use the app's own toast() when it is available */
  function _toast(msg) {
    if (typeof w.toast === 'function') {
      w.toast(msg);
    } else {
      console.warn('[plan] ' + msg);
    }
  }

  /* Convenience: read app language (falls back to 'en') */
  function _isAr() {
    return (typeof w.lang !== 'undefined') ? w.lang === 'ar' : false;
  }

  /* ── 1. getCurrentPlan ──────────────────────────────────────────── */

  function getCurrentPlan() {
    try {
      var stored = localStorage.getItem(PLAN_KEY);
      if (stored && VALID.indexOf(stored) !== -1) return stored;
    } catch (e) { /* storage blocked */ }
    return 'free';
  }

  /* ── 2. isPro ───────────────────────────────────────────────────── */

  function isPro(plan) {
    var p = (plan !== undefined) ? plan : getCurrentPlan();
    return PRO_PLANS.indexOf(p) !== -1;
  }

  /* ── 3. getFeatureAccess ────────────────────────────────────────── */

  function getFeatureAccess(plan) {
    var p = (plan !== undefined) ? plan : getCurrentPlan();
    return FEATURES[p] || FREE_FEATURES;
  }

  /* ── 4. hasAccess ───────────────────────────────────────────────── */

  function hasAccess(featureKey) {
    return getFeatureAccess(getCurrentPlan())[featureKey] === true;
  }

  /* ── 5. setCurrentPlan ──────────────────────────────────────────── */
  /* Declared after helpers it calls are defined above.
     updatePlanUI is declared below — safe because setCurrentPlan
     is only ever *called* at runtime, after the whole IIFE has run. */

  function setCurrentPlan(plan) {
    if (VALID.indexOf(plan) === -1) {
      console.error('[plan] Unknown plan: ' + plan);
      return;
    }
    try { localStorage.setItem(PLAN_KEY, plan); } catch (e) { /* blocked */ }
    updatePlanUI();
    document.dispatchEvent(new CustomEvent('planChanged', { detail: { plan: plan } }));
  }

  /* ── 6. requireFeature ──────────────────────────────────────────── */
  /*
   * Guards a feature gate.
   * Returns true  → caller may proceed.
   * Returns false → access denied; upgrade overlay has been shown.
   * Does NOT throw — callers must check the return value.
   */

  function requireFeature(featureKey, message) {
    if (hasAccess(featureKey)) return true;
    var msg = message || (_isAr()
      ? 'هذه الميزة متاحة في خطة Pro فقط.'
      : 'This feature requires AirCalc Pro.');
    _toast('🔒 ' + msg);
    openUpgradeSheet();
    return false;
  }

  /* ── 7. canSaveProject ──────────────────────────────────────────── */
  /*
   * Call BEFORE saving a project to enforce the free-plan 3-project cap.
   *
   * @param {Array|number} existingProjects
   *   The current array of saved projects, or just its numeric count.
   *   Used to determine whether the limit has been reached.
   *
   * @param {boolean} isEdit
   *   Pass true when the user is editing/overwriting an existing project
   *   slot (not creating a new one). Edits are always allowed on any plan.
   *
   * @returns {boolean}
   *   true  → save is allowed, caller may proceed.
   *   false → limit reached (or feature blocked); upgrade overlay opened,
   *           caller must abort the save.
   */

  function canSaveProject(existingProjects, isEdit) {
    /* Editing an existing project is always allowed on every plan */
    if (isEdit) return true;

    /* Paid plans have no project limit */
    if (isPro()) return true;

    /* Free plan: count current saved projects */
    var count = Array.isArray(existingProjects)
      ? existingProjects.length
      : (parseInt(existingProjects, 10) || 0);

    if (count < MAX_FREE_PROJECTS) return true;

    /* Limit reached — show toast and open upgrade overlay */
    var msg = _isAr()
      ? 'الخطة المجانية تسمح بحفظ حتى ' + MAX_FREE_PROJECTS + ' مشاريع فقط. قم بالترقية للحصول على مشاريع غير محدودة.'
      : 'Free plan allows up to ' + MAX_FREE_PROJECTS + ' saved projects. Upgrade for unlimited projects.';
    _toast('🔒 ' + msg);
    openUpgradeSheet();
    return false;
  }

  /* ── 8. updatePlanUI ────────────────────────────────────────────── */

  function updatePlanUI() {
    var plan  = getCurrentPlan();
    var pro   = isPro(plan);
    var isAr  = _isAr();
    var fa    = getFeatureAccess(plan);

    var planLabels = {
      free:     isAr ? 'مجاني'          : 'Free',
      pro:      isAr ? 'Pro (دائم)'     : 'Pro (perpetual)',
      monthly:  isAr ? 'Pro شهري'       : 'Pro Monthly',
      yearly:   isAr ? 'Pro سنوي'       : 'Pro Yearly',
      lifetime: isAr ? 'Pro مدى الحياة' : 'Pro Lifetime'
    };
    var planLabel = planLabels[plan] || plan;

    /* #plan-status-pill */
    var pill = _el('plan-status-pill');
    if (pill) {
      pill.textContent = pro ? planLabel + ' ⭐' : (isAr ? 'مجاني' : 'Free');
      VALID.forEach(function (p) { pill.classList.remove('plan--' + p); });
      pill.classList.add('plan--' + plan);
      pill.classList.toggle('pro',  pro);
      pill.classList.toggle('free', !pro);
    }

    /* #header-plan-badge */
    var badge = _el('header-plan-badge');
    if (badge) {
      badge.textContent = pro ? 'PRO ⭐' : (isAr ? 'مجاني' : 'FREE');
      badge.classList.toggle('badge--pro',  pro);
      badge.classList.toggle('badge--free', !pro);
    }

    /* #ptg-live-badge */
    var liveBadge = _el('ptg-live-badge');
    if (liveBadge) {
      liveBadge.textContent = pro ? planLabel + ' ⭐' : (isAr ? 'مجاني' : 'Free');
      liveBadge.className = 'plan-status-pill ' + (pro ? 'pro' : 'free');
    }

    /* Tab buttons: #tbtn-free / #tbtn-pro / #tbtn-monthly / #tbtn-yearly */
    ['free', 'pro', 'monthly', 'yearly'].forEach(function (p) {
      _toggleClass('tbtn-' + p, 'active',      plan === p);
      _toggleClass('tbtn-' + p, 'active-plan', plan === p);
    });

    /* #ptg-desc */
    var descEl = _el('ptg-desc');
    if (descEl) {
      descEl.innerHTML =
        '<span style="color:var(--a);font-weight:700">' +
        (isAr ? 'الخطة الحالية: ' : 'Current plan: ') +
        '</span>' + planLabel +
        (pro
          ? ' &nbsp;·&nbsp; <span style="color:var(--g)">' +
            (isAr ? 'كل الميزات مفعّلة' : 'All features unlocked') + '</span>'
          : ' &nbsp;·&nbsp; <span style="color:var(--am)">' +
            (isAr ? 'حتى 3 مشاريع، بدون PDF' : 'Up to 3 projects, no PDF') + '</span>');
    }

    /* #ptg-features */
    var featEl = _el('ptg-features');
    if (featEl) {
      var featureList = [
        { key: 'exportCSV',         ar: 'تصدير CSV',           en: 'CSV export'         },
        { key: 'exportPDF',         ar: 'تصدير PDF',           en: 'PDF export'         },
        { key: 'techReport',        ar: 'التقرير الفني',        en: 'Tech Report'        },
        { key: 'projectMode',       ar: 'وضع المشروع',          en: 'Project mode'       },
        { key: 'ductSizing',        ar: 'تصميم المجاري',        en: 'Duct sizing'        },
        { key: 'espCalc',           ar: 'حساب ESP',             en: 'ESP calc'           },
        { key: 'unlimitedProjects', ar: 'مشاريع غير محدودة',    en: 'Unlimited projects' }
      ];
      featEl.innerHTML = featureList.map(function (f) {
        var ok = fa[f.key] === true;
        return '<div class="ptg-feat ' + (ok ? 'ok' : 'no') + '">' +
          (ok ? '✅' : '❌') + ' ' + (isAr ? f.ar : f.en) +
          '</div>';
      }).join('');
    }

    /* #btn-pdf — exportPDF gate */
    var btnPdf = _el('btn-pdf');
    if (btnPdf) {
      btnPdf.classList.toggle('btn-locked', !fa.exportPDF);
      btnPdf.classList.toggle('locked',     !fa.exportPDF);
    }

    /* #btn-techpdf — techReport gate */
    var btnTech = _el('btn-techpdf');
    if (btnTech) {
      btnTech.classList.toggle('btn-locked', !fa.techReport);
      btnTech.classList.toggle('locked',     !fa.techReport);
    }

    /* #mode-btn-proj — projectMode gate */
    var btnProj = _el('mode-btn-proj');
    if (btnProj) {
      btnProj.classList.toggle('btn-locked', !fa.projectMode);
      btnProj.classList.toggle('locked',     !fa.projectMode);
    }

    /* #proj-duct-block — ductSizing gate */
    var ductBlock = _el('proj-duct-block');
    if (ductBlock) ductBlock.classList.toggle('section-locked', !fa.ductSizing);

    /* #esp-block — espCalc gate */
    var espBlock = _el('esp-block');
    if (espBlock) espBlock.classList.toggle('section-locked', !fa.espCalc);

    /* Settings panel strings */
    var upgLbl = _el('sl-upgrade-lbl');
    if (upgLbl) upgLbl.textContent = pro
      ? (isAr ? 'AirCalc Pro — مفعّل ⭐' : 'AirCalc Pro — Active ⭐')
      : (isAr ? 'الترقية إلى AirCalc Pro' : 'Upgrade to AirCalc Pro');

    var upgSub = _el('sl-upgrade-sub');
    if (upgSub) upgSub.textContent = pro
      ? (isAr ? 'تستمتع بكامل المزايا الاحترافية' : 'All Pro features are unlocked')
      : (isAr ? 'افتح PDF، التقرير الفني، مشاريع غير محدودة' : 'Unlock PDF, Tech Report, unlimited projects');

    /* Keep overlay pills in sync */
    ['lifetime', 'yearly', 'monthly'].forEach(function (p) {
      _toggleClass('pp-' + p, 'active',   _selectedPricePlan === p);
      _toggleClass('pp-' + p, 'selected', _selectedPricePlan === p);
    });
  }

  /* ── 9. openUpgradeSheet ────────────────────────────────────────── */

  function openUpgradeSheet() {
    var overlay = _el('upgrade-overlay');
    if (!overlay) { console.warn('[plan] #upgrade-overlay not found'); return; }
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overlay-open');
    selectPricePill(_selectedPricePlan);
    _syncUpgradeSheetLang();
    var sheet = overlay.querySelector('.upgrade-sheet');
    if (sheet) {
      var first = sheet.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])');
      if (first) setTimeout(function () { first.focus(); }, 50);
    }
  }

  /* ── 10. closeUpgradeSheet ──────────────────────────────────────── */

  function closeUpgradeSheet(e) {
    /* When triggered by a click event, only close if the click landed on
       the backdrop (#upgrade-overlay itself), not inside .upgrade-sheet */
    if (e && e.type === 'click') {
      var sheet = document.querySelector('#upgrade-overlay .upgrade-sheet');
      if (sheet && sheet.contains(e.target)) return;
    }
    var overlay = _el('upgrade-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overlay-open');
  }

  /* ── 11. selectPricePill ────────────────────────────────────────── */

  function selectPricePill(planKey) {
    _selectedPricePlan = planKey;
    ['lifetime', 'yearly', 'monthly'].forEach(function (p) {
      _toggleClass('pp-' + p, 'active',   p === planKey);
      _toggleClass('pp-' + p, 'selected', p === planKey);
    });
  }

  /* ── 12. upgradeToPro ───────────────────────────────────────────── */

  function upgradeToPro() {
    var isAr = _isAr();
    var btn  = _el('btn-upgrade-main');
    if (btn) {
      btn.disabled    = true;
      btn.textContent = isAr ? 'جارٍ المعالجة…' : 'Processing…';
    }
    /* ── Replace this setTimeout with your real payment integration ── */
    setTimeout(function () {
      setCurrentPlan(_selectedPricePlan);
      closeUpgradeSheet();
      if (btn) {
        btn.disabled    = false;
        btn.textContent = isAr ? '⭐ الترقية إلى Pro الآن' : '⭐ Upgrade to Pro Now';
      }
      _toast(isAr ? '⭐ تم تفعيل AirCalc Pro!' : '⭐ AirCalc Pro activated!');
    }, 800);
  }

  /* ── 13. _syncUpgradeSheetLang (internal) ───────────────────────── */

  function _syncUpgradeSheetLang() {
    var isAr = _isAr();
    function sl(id, ar, en) {
      var node = _el(id);
      if (node) node.textContent = isAr ? ar : en;
    }
    sl('ush-sub',         'ارفع مستوى عملك الهندسي',                        'Elevate your engineering workflow');
    sl('pc-free-name',    'مجاني',                                           'Free');
    sl('pc-pro-name',     'Pro ⭐',                                          'Pro ⭐');
    sl('pcf1', 'حساب TR / CFM / BTU',     'TR / CFM / BTU Calc');
    sl('pcf2', 'أحمال الأجهزة',           'Device loads');
    sl('pcf3', 'عرض سعر أساسي',           'Basic quotation');
    sl('pcf4', 'تصدير CSV',               'CSV export');
    sl('pcf5', 'حتى 3 مشاريع',            'Up to 3 projects');
    sl('pcf6', 'تصدير PDF',               'PDF export');
    sl('pcf7', 'التقرير الفني',            'Tech Report');
    sl('pcf8', 'Duct / ESP',              'Duct / ESP');
    sl('pcp1', 'كل مزايا المجاني',        'All Free features');
    sl('pcp2', 'تصدير PDF',               'PDF export');
    sl('pcp3', 'التقرير الفني',            'Tech Report');
    sl('pcp4', 'مشاريع غير محدودة',        'Unlimited projects');
    sl('pcp5', 'وضع وحدة للمشروع',        'Project unit mode');
    sl('pcp6', 'Duct Sizing',             'Duct Sizing');
    sl('pcp7', 'ESP Calculation',         'ESP Calculation');
    sl('pcp8', 'مزايا مستقبلية',           'Future Pro tools');
    sl('pp-lf-amt',   'SAR 99',           'SAR 99');
    sl('pp-lf-per',   'مدى الحياة',        'Lifetime');
    sl('pp-lf-badge', 'الأفضل قيمة',       'Best value');
    sl('pp-yr-amt',   'SAR 149',          'SAR 149');
    sl('pp-yr-per',   'سنوياً',            'Yearly');
    sl('pp-mo-amt',   'SAR 19',           'SAR 19');
    sl('pp-mo-per',   'شهرياً',            'Monthly');
    sl('ush-cta',   '⭐ الترقية إلى Pro الآن', '⭐ Upgrade to Pro Now');
    sl('ush-later', 'متابعة بالنسخة المجانية',  'Continue with Free');
    sl('ush-note',  'للتجربة فقط — الدفع قيد التطوير', 'Demo only — payment coming soon');
    sl('sl-upgrade-lbl',
      isPro() ? 'AirCalc Pro — مفعّل ⭐' : 'الترقية إلى AirCalc Pro',
      isPro() ? 'AirCalc Pro — Active ⭐' : 'Upgrade to AirCalc Pro');
    sl('sl-upgrade-sub',
      isPro() ? 'تستمتع بكامل المزايا' : 'افتح PDF، التقرير الفني، مشاريع غير محدودة',
      isPro() ? 'All Pro features unlocked' : 'Unlock PDF, Tech Report, unlimited projects');
  }

  /* ── 14. Auto-init ──────────────────────────────────────────────── */

  function _init() {
    updatePlanUI();
    /* Escape key closes the overlay */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeUpgradeSheet();
    });
    /* Backdrop click closes the overlay */
    var overlay = _el('upgrade-overlay');
    if (overlay) overlay.addEventListener('click', closeUpgradeSheet);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  /* ── Public API ─────────────────────────────────────────────────── */

  /* window.AppPlan — namespace used inside app.js as window.AppPlan.xxx */
  w.AppPlan = {
    getCurrentPlan:    getCurrentPlan,
    setCurrentPlan:    setCurrentPlan,
    getFeatureAccess:  getFeatureAccess,
    hasAccess:         hasAccess,
    requireFeature:    requireFeature,
    canSaveProject:    canSaveProject,
    isPro:             isPro,
    updatePlanUI:      updatePlanUI,
    MAX_FREE_PROJECTS: MAX_FREE_PROJECTS
  };

  /* Also on window directly so existing onclick="fn()" attributes work */
  w.getCurrentPlan    = getCurrentPlan;
  w.setCurrentPlan    = setCurrentPlan;
  w.getFeatureAccess  = getFeatureAccess;
  w.hasAccess         = hasAccess;
  w.requireFeature    = requireFeature;
  w.canSaveProject    = canSaveProject;
  w.updatePlanUI      = updatePlanUI;
  w.openUpgradeSheet  = openUpgradeSheet;
  w.closeUpgradeSheet = closeUpgradeSheet;
  w.selectPricePill   = selectPricePill;
  w.upgradeToPro      = upgradeToPro;

}(window));