/* ============================================================
   modules/plan.js  —  AirCalc Pro plan management
   Plain script, no ES modules.
   Public API exposed on window.AppPlan AND directly on window.
   localStorage key : aircalc_plan
   Default plan     : free
   Supported plans  : free | pro | monthly | yearly | lifetime
   ============================================================ */

(function (w) {

  /* ── Constants ──────────────────────────────────────────── */
  var PLAN_KEY  = 'aircalc_plan';
  var VALID     = ['free', 'pro', 'monthly', 'yearly', 'lifetime'];
  var PRO_PLANS = ['pro', 'monthly', 'yearly', 'lifetime'];
  var MAX_FREE_PROJECTS = 3;

  /* ── Feature maps ────────────────────────────────────────── */
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

  /* Selected pill inside upgrade overlay */
  var _selectedPricePlan = 'lifetime';

  /* ── DOM helpers ─────────────────────────────────────────── */
  function el(id) { return document.getElementById(id); }

  function setText(id, text) {
    var node = el(id);
    if (node) node.textContent = text;
  }

  function toggleClass(id, cls, force) {
    var node = el(id);
    if (node) node.classList.toggle(cls, !!force);
  }

  /* Use the app's own toast() when available, else console.warn */
  function _toast(msg) {
    if (typeof w.toast === 'function') {
      w.toast(msg);
    } else {
      console.warn('[plan] ' + msg);
    }
  }

  /* ── Core plan state ─────────────────────────────────────── */

  function getCurrentPlan() {
    try {
      var stored = localStorage.getItem(PLAN_KEY);
      if (stored && VALID.indexOf(stored) !== -1) return stored;
    } catch (e) { /* storage blocked */ }
    return 'free';
  }

  function setCurrentPlan(plan) {
    if (VALID.indexOf(plan) === -1) {
      console.error('[plan] Unknown plan: ' + plan);
      return;
    }
    try { localStorage.setItem(PLAN_KEY, plan); } catch (e) { /* blocked */ }
    updatePlanUI();
    document.dispatchEvent(new CustomEvent('planChanged', { detail: { plan: plan } }));
  }

  function isPro(plan) {
    var p = plan !== undefined ? plan : getCurrentPlan();
    return PRO_PLANS.indexOf(p) !== -1;
  }

  /* ── Feature access ──────────────────────────────────────── */

  function getFeatureAccess(plan) {
    return FEATURES[plan !== undefined ? plan : getCurrentPlan()] || FREE_FEATURES;
  }

  function hasAccess(featureKey) {
    return getFeatureAccess(getCurrentPlan())[featureKey] === true;
  }

  /**
   * Guards a feature.
   * Returns true  → caller may proceed.
   * Returns false → caller must abort; upgrade overlay has been opened.
   * NOTE: does NOT throw — callers check the return value.
   */
  function requireFeature(featureKey, message) {
    if (hasAccess(featureKey)) return true;
    var isAr = (typeof lang !== 'undefined') ? lang === 'ar' : false;
    var msg = message || (isAr
      ? 'هذه الميزة متاحة في خطة Pro فقط.'
      : 'This feature requires AirCalc Pro.');
    _toast('🔒 ' + msg);
    openUpgradeSheet();
    return false;
  }

  /* ── Project count gate ──────────────────────────────────── */

  /**
   * Call before saving a NEW project (not editing an existing one).
   * Pass the current saved-projects array (or its length).
   * Returns true  → save is allowed.
   * Returns false → limit reached; upgrade overlay opened.
   *
   * @param {Array|number} existingProjects  array of projects OR count
   * @param {boolean}      isEdit            true if editing existing (always allowed)
   */
  function canSaveProject(existingProjects, isEdit) {
    if (isEdit) return true;
    if (isPro()) return true;
    var count = Array.isArray(existingProjects)
      ? existingProjects.length
      : (parseInt(existingProjects) || 0);
    if (count < MAX_FREE_PROJECTS) return true;
    var isAr = (typeof lang !== 'undefined') ? lang === 'ar' : false;
    var msg = isAr
      ? 'الخطة المجانية تسمح بحفظ حتى ' + MAX_FREE_PROJECTS + ' مشاريع فقط. قم بالترقية للحصول على مشاريع غير محدودة.'
      : 'Free plan allows up to ' + MAX_FREE_PROJECTS + ' saved projects. Upgrade for unlimited projects.';
    _toast('🔒 ' + msg);
    openUpgradeSheet();
    return false;
  }

  /* ── updatePlanUI ────────────────────────────────────────── */

  function updatePlanUI() {
    var plan  = getCurrentPlan();
    var pro   = isPro(plan);
    var isAr  = (typeof lang !== 'undefined') ? lang === 'ar' : false;
    var fa    = getFeatureAccess(plan);

    /* plan labels */
    var planLabels = {
      free:     isAr ? 'مجاني'          : 'Free',
      pro:      isAr ? 'Pro (دائم)'     : 'Pro (perpetual)',
      monthly:  isAr ? 'Pro شهري'       : 'Pro Monthly',
      yearly:   isAr ? 'Pro سنوي'       : 'Pro Yearly',
      lifetime: isAr ? 'Pro مدى الحياة' : 'Pro Lifetime'
    };
    var planLabel = planLabels[plan] || plan;

    /* ── #plan-status-pill ── */
    var pill = el('plan-status-pill');
    if (pill) {
      pill.textContent = pro ? planLabel + ' ⭐' : (isAr ? 'مجاني' : 'Free');
      VALID.forEach(function (p) { pill.classList.remove('plan--' + p); });
      pill.classList.add('plan--' + plan);
      pill.classList.toggle('pro', pro);
      pill.classList.toggle('free', !pro);
    }

    /* ── #header-plan-badge ── */
    var badge = el('header-plan-badge');
    if (badge) {
      badge.textContent = pro ? 'PRO ⭐' : (isAr ? 'مجاني' : 'FREE');
      badge.classList.toggle('badge--pro',  pro);
      badge.classList.toggle('badge--free', !pro);
    }

    /* ── #ptg-live-badge ── */
    var liveBadge = el('ptg-live-badge');
    if (liveBadge) {
      liveBadge.textContent = pro
        ? planLabel + ' ⭐'
        : (isAr ? 'مجاني' : 'Free');
      liveBadge.className = 'plan-status-pill ' + (pro ? 'pro' : 'free');
    }

    /* ── Tab buttons: #tbtn-free / pro / monthly / yearly ── */
    ['free', 'pro', 'monthly', 'yearly'].forEach(function (p) {
      toggleClass('tbtn-' + p, 'active', plan === p);
      toggleClass('tbtn-' + p, 'active-plan', plan === p);
    });

    /* ── #ptg-desc ── */
    var descEl = el('ptg-desc');
    if (descEl) {
      descEl.innerHTML =
        '<span style="color:var(--a);font-weight:700">' +
        (isAr ? 'الخطة الحالية: ' : 'Current plan: ') +
        '</span>' + planLabel +
        (pro
          ? ' &nbsp;·&nbsp; <span style="color:var(--g)">' + (isAr ? 'كل الميزات مفعّلة' : 'All features unlocked') + '</span>'
          : ' &nbsp;·&nbsp; <span style="color:var(--am)">' + (isAr ? 'حتى 3 مشاريع، بدون PDF' : 'Up to 3 projects, no PDF') + '</span>');
    }

    /* ── #ptg-features ── */
    var featEl = el('ptg-features');
    if (featEl) {
      var featureList = [
        { key: 'exportCSV',         ar: 'تصدير CSV',           en: 'CSV export'        },
        { key: 'exportPDF',         ar: 'تصدير PDF',           en: 'PDF export'        },
        { key: 'techReport',        ar: 'التقرير الفني',        en: 'Tech Report'       },
        { key: 'projectMode',       ar: 'وضع المشروع',          en: 'Project mode'      },
        { key: 'ductSizing',        ar: 'تصميم المجاري',        en: 'Duct sizing'       },
        { key: 'espCalc',           ar: 'حساب ESP',             en: 'ESP calc'          },
        { key: 'unlimitedProjects', ar: 'مشاريع غير محدودة',    en: 'Unlimited projects'}
      ];
      featEl.innerHTML = featureList.map(function (f) {
        var ok = fa[f.key] === true;
        return '<div class="ptg-feat ' + (ok ? 'ok' : 'no') + '">' +
          (ok ? '✅' : '❌') + ' ' + (isAr ? f.ar : f.en) +
          '</div>';
      }).join('');
    }

    /* ── #btn-pdf  (exportPDF gate) ── */
    var btnPdf = el('btn-pdf');
    if (btnPdf) {
      btnPdf.classList.toggle('btn-locked', !fa.exportPDF);
      btnPdf.classList.toggle('locked',     !fa.exportPDF);
    }

    /* ── #btn-techpdf  (techReport gate) ── */
    var btnTech = el('btn-techpdf');
    if (btnTech) {
      btnTech.classList.toggle('btn-locked', !fa.techReport);
      btnTech.classList.toggle('locked',     !fa.techReport);
    }

    /* ── #mode-btn-proj  (projectMode gate) ── */
    var btnProj = el('mode-btn-proj');
    if (btnProj) {
      btnProj.classList.toggle('btn-locked', !fa.projectMode);
      btnProj.classList.toggle('locked',     !fa.projectMode);
    }

    /* ── Duct / ESP section overlays ── */
    var ductBlock = el('proj-duct-block');
    if (ductBlock) ductBlock.classList.toggle('section-locked', !fa.ductSizing);

    var espBlock  = el('esp-block');
    if (espBlock)  espBlock.classList.toggle('section-locked',  !fa.espCalc);

    /* ── Settings panel strings ── */
    var upgLbl = el('sl-upgrade-lbl');
    if (upgLbl) upgLbl.textContent = pro
      ? (isAr ? 'AirCalc Pro — مفعّل ⭐' : 'AirCalc Pro — Active ⭐')
      : (isAr ? 'الترقية إلى AirCalc Pro' : 'Upgrade to AirCalc Pro');

    var upgSub = el('sl-upgrade-sub');
    if (upgSub) upgSub.textContent = pro
      ? (isAr ? 'تستمتع بكامل المزايا الاحترافية' : 'All Pro features are unlocked')
      : (isAr ? 'افتح PDF، التقرير الفني، مشاريع غير محدودة' : 'Unlock PDF, Tech Report, unlimited projects');

    /* ── Upgrade overlay pill highlight ── */
    ['lifetime', 'yearly', 'monthly'].forEach(function (p) {
      toggleClass('pp-' + p, 'active', _selectedPricePlan === p);
    });
  }

  /* ── Upgrade overlay ─────────────────────────────────────── */

  function openUpgradeSheet() {
    var overlay = el('upgrade-overlay');
    if (!overlay) { console.warn('[plan] #upgrade-overlay not found'); return; }
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('overlay-open');
    selectPricePill(_selectedPricePlan);
    _syncUpgradeSheetLang();
    /* focus first interactive element inside .upgrade-sheet */
    var sheet = overlay.querySelector('.upgrade-sheet');
    if (sheet) {
      var first = sheet.querySelector('button, [href], input, [tabindex]:not([tabindex="-1"])');
      if (first) setTimeout(function () { first.focus(); }, 50);
    }
  }

  function closeUpgradeSheet(e) {
    /* Only close when the click is on the backdrop, not inside .upgrade-sheet */
    if (e && e.type === 'click') {
      var sheet = document.querySelector('#upgrade-overlay .upgrade-sheet');
      if (sheet && sheet.contains(e.target)) return;
    }
    var overlay = el('upgrade-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('overlay-open');
  }

  /* ── Price pill ──────────────────────────────────────────── */

  function selectPricePill(planKey) {
    _selectedPricePlan = planKey;
    ['lifetime', 'yearly', 'monthly'].forEach(function (p) {
      toggleClass('pp-' + p, 'active',    p === planKey);
      toggleClass('pp-' + p, 'selected',  p === planKey);
    });
  }

  /* ── Upgrade CTA ─────────────────────────────────────────── */

  function upgradeToPro() {
    var btn = el('btn-upgrade-main');
    if (btn) { btn.disabled = true; btn.textContent = (typeof lang !== 'undefined' && lang === 'ar') ? 'جارٍ المعالجة…' : 'Processing…'; }

    /* ── Replace the setTimeout with your real payment integration ── */
    setTimeout(function () {
      setCurrentPlan(_selectedPricePlan);
      closeUpgradeSheet();
      if (btn) {
        btn.disabled = false;
        btn.textContent = (typeof lang !== 'undefined' && lang === 'ar') ? '⭐ الترقية إلى Pro الآن' : '⭐ Upgrade to Pro Now';
      }
      _toast(typeof lang !== 'undefined' && lang === 'ar'
        ? '⭐ تم تفعيل AirCalc Pro!'
        : '⭐ AirCalc Pro activated!');
    }, 800);
  }

  /* ── Upgrade sheet label sync ────────────────────────────── */

  function _syncUpgradeSheetLang() {
    var isAr = (typeof lang !== 'undefined') ? lang === 'ar' : false;
    function sl(id, ar, en) { var node = el(id); if (node) node.textContent = isAr ? ar : en; }
    sl('ush-sub',         'ارفع مستوى عملك الهندسي',                       'Elevate your engineering workflow');
    sl('pc-free-name',    'مجاني',                                          'Free');
    sl('pc-pro-name',     'Pro ⭐',                                         'Pro ⭐');
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
    sl('pp-lf-amt',   'SAR 99',          'SAR 99');
    sl('pp-lf-per',   'مدى الحياة',       'Lifetime');
    sl('pp-lf-badge', 'الأفضل قيمة',      'Best value');
    sl('pp-yr-amt',   'SAR 149',         'SAR 149');
    sl('pp-yr-per',   'سنوياً',           'Yearly');
    sl('pp-mo-amt',   'SAR 19',          'SAR 19');
    sl('pp-mo-per',   'شهرياً',           'Monthly');
    sl('ush-cta',     '⭐ الترقية إلى Pro الآن', '⭐ Upgrade to Pro Now');
    sl('ush-later',   'متابعة بالنسخة المجانية',  'Continue with Free');
    sl('ush-note',    'للتجربة فقط — الدفع قيد التطوير', 'Demo only — payment coming soon');
    sl('sl-upgrade-lbl',
      isPro() ? 'AirCalc Pro — مفعّل ⭐' : 'الترقية إلى AirCalc Pro',
      isPro() ? 'AirCalc Pro — Active ⭐' : 'Upgrade to AirCalc Pro');
    sl('sl-upgrade-sub',
      isPro() ? 'تستمتع بكامل المزايا' : 'افتح PDF، التقرير الفني، مشاريع غير محدودة',
      isPro() ? 'All Pro features unlocked' : 'Unlock PDF, Tech Report, unlimited projects');
  }

  /* ── Auto-init ───────────────────────────────────────────── */

  function _init() {
    updatePlanUI();

    /* Escape closes overlay */
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeUpgradeSheet();
    });

    /* Backdrop click closes overlay */
    var overlay = el('upgrade-overlay');
    if (overlay) overlay.addEventListener('click', closeUpgradeSheet);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  /* ── Public API ──────────────────────────────────────────── */

  /* Namespace object used inside app.js as window.AppPlan.xxx */
  var AppPlan = {
    getCurrentPlan:  getCurrentPlan,
    setCurrentPlan:  setCurrentPlan,
    getFeatureAccess: getFeatureAccess,
    hasAccess:       hasAccess,
    requireFeature:  requireFeature,
    canSaveProject:  canSaveProject,
    isPro:           isPro,
    updatePlanUI:    updatePlanUI,
    MAX_FREE_PROJECTS: MAX_FREE_PROJECTS
  };

  w.AppPlan = AppPlan;

  /* Also expose each function directly on window so existing
     inline onclick="..." attributes keep working unchanged.   */
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