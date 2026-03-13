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

  var PLAN_KEY          = 'aircalc_plan';
  var VALID             = ['free', 'pro', 'monthly', 'yearly', 'lifetime'];
  var PRO_PLANS         = ['pro', 'monthly', 'yearly', 'lifetime'];
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

  var _selectedPricePlan = 'lifetime';

  /* ── DOM helpers ────────────────────────────────────────────────── */

  function _el(id) {
    return document.getElementById(id);
  }

  function _toast(msg) {
    if (typeof w.toast === 'function') {
      w.toast(msg);
    } else {
      console.warn('[plan] ' + msg);
    }
  }

  function _isAr() {
    return (typeof w.lang !== 'undefined') ? w.lang === 'ar' : false;
  }

  /*
   * Lock or unlock an ACTION button (btn-pdf, btn-techpdf).
   * These buttons are fully disabled on free — clicks do nothing.
   * app.js gates the actual action with requireFeature() so the
   * locked visual + disabled state are both needed.
   */
  function _gateActionButton(node, allowed) {
    if (!node) return;
    if (allowed) {
      node.disabled = false;
      node.classList.remove('locked', 'btn-locked');
    } else {
      node.disabled = true;
      node.classList.add('locked', 'btn-locked');
    }
  }

  /*
   * Lock or unlock a MODE button (mode-btn-proj).
   * IMPORTANT: mode buttons must NEVER be disabled because clicking
   * a locked mode button should open the upgrade overlay.
   * We only apply / remove the visual locked classes; the click
   * handler in app.js calls requireFeature() which does the rest.
   */
  function _gateModeButton(node, allowed) {
    if (!node) return;
    node.disabled = false; /* always keep clickable */
    if (allowed) {
      node.classList.remove('locked', 'btn-locked');
    } else {
      node.classList.add('locked', 'btn-locked');
    }
  }

  /*
   * Lock or unlock a section block.
   */
  function _gateSection(node, allowed) {
    if (!node) return;
    if (allowed) {
      node.classList.remove('section-locked');
    } else {
      node.classList.add('section-locked');
    }
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
   * Returns true  → caller may proceed.
   * Returns false → access denied; upgrade overlay shown.
   * Does NOT throw.
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
   * Call BEFORE saving a new project to enforce the free-plan cap.
   *
   * @param {Array|number} existingProjects  array or numeric count
   * @param {boolean}      isEdit            true = editing existing slot
   * @returns {boolean}  true = proceed, false = blocked (overlay shown)
   */

  function canSaveProject(existingProjects, isEdit) {
    if (isEdit)  return true;
    if (isPro()) return true;

    var count = Array.isArray(existingProjects)
      ? existingProjects.length
      : (parseInt(existingProjects, 10) || 0);

    if (count < MAX_FREE_PROJECTS) return true;

    var msg = _isAr()
      ? 'الخطة المجانية تسمح بحفظ حتى ' + MAX_FREE_PROJECTS + ' مشاريع فقط. قم بالترقية للحصول على مشاريع غير محدودة.'
      : 'Free plan allows up to ' + MAX_FREE_PROJECTS + ' saved projects. Upgrade for unlimited projects.';
    _toast('🔒 ' + msg);
    openUpgradeSheet();
    return false;
  }

  /* ── 8. updatePlanUI ────────────────────────────────────────────── */
  /*
   * Single source of truth for all plan-dependent UI state.
   *
   * Design rules:
   *   - Uses classList.add/remove exclusively (never toggle) so every
   *     call is fully deterministic regardless of previous plan state.
   *   - Action buttons (pdf, techpdf) are disabled on free — their
   *     onclick is gated by requireFeature() in app.js anyway.
   *   - Mode buttons (mode-btn-proj) are NEVER disabled — clicking a
   *     locked mode button must still open the upgrade overlay.
   *   - When downgrading to free while in project mode, room mode is
   *     restored immediately via setQuoteMode('room') if available,
   *     or via direct DOM manipulation as a fallback.
   */

  function updatePlanUI() {
    var plan = getCurrentPlan();
    var pro  = isPro(plan);
    var isAr = _isAr();
    var fa   = getFeatureAccess(plan);

    /* ── Plan label strings ──────────────────────────────────────── */
    var planLabels = {
      free:     isAr ? 'مجاني'          : 'Free',
      pro:      isAr ? 'Pro (دائم)'     : 'Pro (perpetual)',
      monthly:  isAr ? 'Pro شهري'       : 'Pro Monthly',
      yearly:   isAr ? 'Pro سنوي'       : 'Pro Yearly',
      lifetime: isAr ? 'Pro مدى الحياة' : 'Pro Lifetime'
    };
    var planLabel = planLabels[plan] || plan;

    /* ── #plan-status-pill ───────────────────────────────────────── */
    var pill = _el('plan-status-pill');
    if (pill) {
      pill.textContent = pro ? planLabel + ' ⭐' : (isAr ? 'مجاني' : 'Free');
      VALID.forEach(function (p) { pill.classList.remove('plan--' + p); });
      pill.classList.add('plan--' + plan);
      if (pro) { pill.classList.add('pro');  pill.classList.remove('free'); }
      else      { pill.classList.add('free'); pill.classList.remove('pro');  }
    }

    /* ── #header-plan-badge ──────────────────────────────────────── */
    var badge = _el('header-plan-badge');
    if (badge) {
      badge.textContent = pro ? 'PRO ⭐' : (isAr ? 'مجاني' : 'FREE');
      if (pro) { badge.classList.add('badge--pro');  badge.classList.remove('badge--free'); }
      else      { badge.classList.add('badge--free'); badge.classList.remove('badge--pro');  }
    }

    /* ── #ptg-live-badge ─────────────────────────────────────────── */
    var liveBadge = _el('ptg-live-badge');
    if (liveBadge) {
      liveBadge.textContent = pro ? planLabel + ' ⭐' : (isAr ? 'مجاني' : 'Free');
      liveBadge.className   = 'plan-status-pill ' + (pro ? 'pro' : 'free');
    }

    /* ── Tab buttons: #tbtn-free / pro / monthly / yearly ────────── */
    ['free', 'pro', 'monthly', 'yearly'].forEach(function (p) {
      var btn = _el('tbtn-' + p);
      if (!btn) return;
      if (plan === p) { btn.classList.add('active', 'active-plan'); }
      else             { btn.classList.remove('active', 'active-plan'); }
    });

    /* ── #ptg-desc ───────────────────────────────────────────────── */
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

    /* ── #ptg-features grid ──────────────────────────────────────── */
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

    /* ── Action buttons: disabled on free, enabled on pro ────────── */
    /*
     * #btn-pdf and #btn-techpdf are pure action triggers.
     * Disabling them is correct — there is no interactive locked-click
     * behaviour needed; app.js re-gates them with requireFeature() too.
     */
    _gateActionButton(_el('btn-pdf'),      fa.exportPDF);
    _gateActionButton(_el('btn-techpdf'),  fa.techReport);

    /* ── Mode button: visually locked on free, always clickable ───── */
    /*
     * #mode-btn-proj must remain clickable even when locked so that
     * clicking it fires the onclick in app.js → requireFeature() →
     * upgrade overlay.  Only visual classes are toggled here.
     */
    _gateModeButton(_el('mode-btn-proj'), fa.projectMode);

    /* ── Section blocks ──────────────────────────────────────────── */
    _gateSection(_el('proj-duct-block'), fa.ductSizing);
    _gateSection(_el('esp-block'),       fa.espCalc);

    /* ── Force room mode when projectMode is revoked ─────────────── */
    /*
     * Strategy (most-to-least reliable):
     *   1. Call w.setQuoteMode('room') if it exists — app.js function
     *      that owns mode state and DOM wiring.
     *   2. If quoteMode global exists and equals 'proj', manipulate
     *      DOM directly as a fallback.
     *   3. Always attempt the DOM fallback unconditionally when
     *      projectMode is false — covers cases where quoteMode global
     *      is a module-local variable not exposed on window.
     */
    if (!fa.projectMode) {
      /* Strategy 1: delegate to app.js */
      if (typeof w.setQuoteMode === 'function') {
        /* Only call if actually in proj mode to avoid unnecessary redraws */
        var currentMode = (typeof w.quoteMode !== 'undefined') ? w.quoteMode : null;
        if (currentMode === 'proj' || currentMode === null) {
          w.setQuoteMode('room');
        }
      } else {
        /* Strategy 2 & 3: direct DOM fallback */
        var qiList    = _el('qi-list');
        var projBlock = _el('proj-block');
        var bundleRow = _el('bundle-row');
        var btnRoom   = _el('mode-btn-room');
        var btnProj   = _el('mode-btn-proj');

        if (qiList)    { qiList.style.display    = ''; }
        if (projBlock) { projBlock.style.display  = 'none'; }
        if (bundleRow) { bundleRow.style.display  = 'none'; }
        if (btnRoom)   { btnRoom.classList.add('active');    btnRoom.classList.remove('inactive'); }
        if (btnProj)   { btnProj.classList.remove('active'); btnProj.classList.add('inactive');    }

        /* Write back to window.quoteMode if it is exposed */
        if (typeof w.quoteMode !== 'undefined') { w.quoteMode = 'room'; }
      }
    }

    /* ── Settings panel labels ───────────────────────────────────── */
    var upgLbl = _el('sl-upgrade-lbl');
    if (upgLbl) upgLbl.textContent = pro
      ? (isAr ? 'AirCalc Pro — مفعّل ⭐' : 'AirCalc Pro — Active ⭐')
      : (isAr ? 'الترقية إلى AirCalc Pro' : 'Upgrade to AirCalc Pro');

    var upgSub = _el('sl-upgrade-sub');
    if (upgSub) upgSub.textContent = pro
      ? (isAr ? 'تستمتع بكامل المزايا الاحترافية' : 'All Pro features are unlocked')
      : (isAr ? 'افتح PDF، التقرير الفني، مشاريع غير محدودة' : 'Unlock PDF, Tech Report, unlimited projects');

    /* ── Upgrade overlay price pills ─────────────────────────────── */
    ['lifetime', 'yearly', 'monthly'].forEach(function (p) {
      var node = _el('pp-' + p);
      if (!node) return;
      if (_selectedPricePlan === p) { node.classList.add('active', 'selected'); }
      else                           { node.classList.remove('active', 'selected'); }
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
      if (first) { setTimeout(function () { first.focus(); }, 50); }
    }
  }

  /* ── 10. closeUpgradeSheet ──────────────────────────────────────── */

  function closeUpgradeSheet(e) {
    /* Backdrop-click: only close when click landed outside .upgrade-sheet */
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
      var node = _el('pp-' + p);
      if (!node) return;
      if (p === planKey) { node.classList.add('active', 'selected'); }
      else                { node.classList.remove('active', 'selected'); }
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
    sl('ush-sub',      'ارفع مستوى عملك الهندسي',                        'Elevate your engineering workflow');
    sl('pc-free-name', 'مجاني',                                           'Free');
    sl('pc-pro-name',  'Pro ⭐',                                          'Pro ⭐');
    sl('pcf1', 'حساب TR / CFM / BTU',      'TR / CFM / BTU Calc');
    sl('pcf2', 'أحمال الأجهزة',            'Device loads');
    sl('pcf3', 'عرض سعر أساسي',            'Basic quotation');
    sl('pcf4', 'تصدير CSV',                'CSV export');
    sl('pcf5', 'حتى 3 مشاريع',             'Up to 3 projects');
    sl('pcf6', 'تصدير PDF',                'PDF export');
    sl('pcf7', 'التقرير الفني',             'Tech Report');
    sl('pcf8', 'Duct / ESP',               'Duct / ESP');
    sl('pcp1', 'كل مزايا المجاني',         'All Free features');
    sl('pcp2', 'تصدير PDF',                'PDF export');
    sl('pcp3', 'التقرير الفني',             'Tech Report');
    sl('pcp4', 'مشاريع غير محدودة',         'Unlimited projects');
    sl('pcp5', 'وضع وحدة للمشروع',         'Project unit mode');
    sl('pcp6', 'Duct Sizing',              'Duct Sizing');
    sl('pcp7', 'ESP Calculation',          'ESP Calculation');
    sl('pcp8', 'مزايا مستقبلية',            'Future Pro tools');
    sl('pp-lf-amt',   'SAR 99',            'SAR 99');
    sl('pp-lf-per',   'مدى الحياة',         'Lifetime');
    sl('pp-lf-badge', 'الأفضل قيمة',        'Best value');
    sl('pp-yr-amt',   'SAR 149',           'SAR 149');
    sl('pp-yr-per',   'سنوياً',             'Yearly');
    sl('pp-mo-amt',   'SAR 19',            'SAR 19');
    sl('pp-mo-per',   'شهرياً',             'Monthly');
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
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeUpgradeSheet(); }
    });
    var overlay = _el('upgrade-overlay');
    if (overlay) { overlay.addEventListener('click', closeUpgradeSheet); }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _init);
  } else {
    _init();
  }

  /* ── Public API ─────────────────────────────────────────────────── */

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