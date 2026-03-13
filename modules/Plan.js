(function () {
  'use strict';

  var PLAN_KEY = 'aircalc_plan';
  var PRICE_KEY = 'aircalc_selected_price_plan';
  var DEFAULT_PLAN = 'free';
  var GUARDS_APPLIED = false;

  function G(id){ return document.getElementById(id); }

  function isAr(){
    return (typeof lang !== 'undefined' ? lang : 'ar') === 'ar';
  }

  function toastMsg(msg){
    if (typeof toast === 'function') toast(msg);
    else alert(msg);
  }

  function normalizePlan(plan){
    var p = String(plan || '').toLowerCase().trim();
    if (['free', 'pro', 'monthly', 'yearly', 'lifetime'].indexOf(p) === -1) return DEFAULT_PLAN;
    return p;
  }

  function getCurrentPlan(){
    try {
      return normalizePlan(localStorage.getItem(PLAN_KEY) || DEFAULT_PLAN);
    } catch(e){
      return DEFAULT_PLAN;
    }
  }

  function setCurrentPlan(plan){
    var next = normalizePlan(plan);
    try { localStorage.setItem(PLAN_KEY, next); } catch(e){}
    updatePlanUI();

    var label = getPlanLabel(next);
    toastMsg(isAr() ? ('✅ تم تفعيل الخطة: ' + label) : ('✅ Plan activated: ' + label));
    return next;
  }

  function getPlanLabel(plan){
    plan = normalizePlan(plan);
    if (plan === 'free') return isAr() ? 'مجاني' : 'Free';
    if (plan === 'pro') return 'Pro';
    if (plan === 'monthly') return isAr() ? 'شهري' : 'Monthly';
    if (plan === 'yearly') return isAr() ? 'سنوي' : 'Yearly';
    if (plan === 'lifetime') return isAr() ? 'مدى الحياة' : 'Lifetime';
    return plan;
  }

  function isPaidPlan(plan){
    plan = normalizePlan(plan || getCurrentPlan());
    return plan !== 'free';
  }

  function getFeatureAccess(plan){
    plan = normalizePlan(plan || getCurrentPlan());

    if (plan === 'free') {
      return {
        exportCSV: true,
        exportPDF: false,
        techReport: false,
        unlimitedProjects: false,
        projectMode: false,
        ductSizing: false,
        espCalc: false
      };
    }

    return {
      exportCSV: true,
      exportPDF: true,
      techReport: true,
      unlimitedProjects: true,
      projectMode: true,
      ductSizing: true,
      espCalc: true
    };
  }

  function hasAccess(featureKey){
    var access = getFeatureAccess(getCurrentPlan());
    return !!access[featureKey];
  }

  function requireFeature(featureKey, message){
    if (hasAccess(featureKey)) return true;

    toastMsg(
      message ||
      (isAr()
        ? 'هذه الميزة متاحة في النسخة المدفوعة فقط'
        : 'This feature is available in the paid version only')
    );

    openUpgradeSheet();
    return false;
  }

  function getSelectedPricePill(){
    try {
      return normalizePlan(localStorage.getItem(PRICE_KEY) || 'lifetime');
    } catch(e){
      return 'lifetime';
    }
  }

  function selectPricePill(type){
    var chosen = normalizePlan(type);
    if (['monthly', 'yearly', 'lifetime'].indexOf(chosen) === -1) chosen = 'lifetime';

    try { localStorage.setItem(PRICE_KEY, chosen); } catch(e){}

    ['lifetime', 'yearly', 'monthly'].forEach(function (key) {
      var el = G('pp-' + key);
      if (!el) return;
      if (key === chosen) el.classList.add('active');
      else el.classList.remove('active');
    });
  }

  function openUpgradeSheet(){
    var ov = G('upgrade-overlay');
    if (!ov) return;
    ov.classList.remove('hidden');
    ov.style.display = 'flex';
  }

  function closeUpgradeSheet(event){
    if (event && event.target && event.target !== G('upgrade-overlay')) return;
    var ov = G('upgrade-overlay');
    if (!ov) return;
    ov.classList.add('hidden');
    ov.style.display = 'none';
  }

  function upgradeToPro(){
    var selected = getSelectedPricePill();

    if (selected === 'monthly') setCurrentPlan('monthly');
    else if (selected === 'yearly') setCurrentPlan('yearly');
    else if (selected === 'lifetime') setCurrentPlan('lifetime');
    else setCurrentPlan('pro');

    closeUpgradeSheet();

    toastMsg(
      isAr()
        ? '⭐ تم تفعيل النسخة المدفوعة للتجربة'
        : '⭐ Pro version activated for testing'
    );
  }

  function setText(id, value){
    var el = G(id);
    if (el) el.textContent = value;
  }

  function setPlanPill(el, plan){
    if (!el) return;
    el.classList.remove('free', 'pro', 'monthly', 'yearly', 'lifetime');

    if (plan === 'free') el.classList.add('free');
    else if (plan === 'monthly') el.classList.add('monthly');
    else if (plan === 'yearly') el.classList.add('yearly');
    else if (plan === 'lifetime') el.classList.add('lifetime');
    else el.classList.add('pro');

    el.textContent = getPlanLabel(plan);
  }

  function setLockedState(el, locked, lockedText){
    if (!el) return;

    el.disabled = !!locked;
    el.classList.toggle('locked', !!locked);
    el.style.opacity = locked ? '.6' : '';
    el.style.filter = locked ? 'grayscale(.12)' : '';
    el.style.cursor = locked ? 'not-allowed' : '';

    if (locked) {
      el.setAttribute('title', lockedText || (isAr() ? 'ميزة مدفوعة' : 'Paid feature'));
    } else {
      el.removeAttribute('title');
    }
  }

  function updateHeaderBadge(plan){
    var badge = G('header-plan-badge');
    if (!badge) return;

    if (plan === 'free') {
      badge.textContent = 'FREE';
      badge.style.background = 'linear-gradient(135deg,#cbd5e1,#f8fafc)';
      badge.style.color = '#0f172a';
      badge.style.border = '1px solid rgba(148,163,184,.45)';
      badge.style.boxShadow = '0 0 12px rgba(148,163,184,.15)';
    } else {
      badge.textContent = 'PRO';
      badge.style.background = 'linear-gradient(135deg,#fbbf24,#fde68a)';
      badge.style.color = '#0f172a';
      badge.style.border = '1px solid rgba(251,191,36,.55)';
      badge.style.boxShadow = '0 0 12px rgba(251,191,36,.18)';
    }
  }

  function buildFeatureSummary(plan){
    var paid = isPaidPlan(plan);

    if (isAr()) {
      return paid
        ? 'الخطة المدفوعة مفعلة — جميع المزايا الاحترافية متاحة الآن.'
        : 'الخطة المجانية مفعلة — الحسابات الأساسية و CSV متاحان، بينما PDF والتقرير الفني ووضع المشروع والمزايا المتقدمة مقفلة.';
    }

    return paid
      ? 'Paid plan active — all premium features are available.'
      : 'Free plan active — basic calculations and CSV are available, while PDF, technical report, project mode, and advanced features are locked.';
  }

  function buildFeaturesList(plan){
    var paid = isPaidPlan(plan);
    var items = paid
      ? [
          isAr() ? '✅ PDF متاح' : '✅ PDF enabled',
          isAr() ? '✅ التقرير الفني متاح' : '✅ Technical report enabled',
          isAr() ? '✅ مشاريع غير محدودة' : '✅ Unlimited projects',
          isAr() ? '✅ وضع المشروع متاح' : '✅ Project mode enabled',
          isAr() ? '✅ Duct Sizing متاح' : '✅ Duct sizing enabled',
          isAr() ? '✅ ESP متاح' : '✅ ESP enabled'
        ]
      : [
          isAr() ? '✅ CSV متاح' : '✅ CSV enabled',
          isAr() ? '✅ حتى 3 مشاريع' : '✅ Up to 3 projects',
          isAr() ? '🔒 PDF مقفل' : '🔒 PDF locked',
          isAr() ? '🔒 التقرير الفني مقفل' : '🔒 Technical report locked',
          isAr() ? '🔒 وضع المشروع مقفل' : '🔒 Project mode locked',
          isAr() ? '🔒 Duct / ESP مقفل' : '🔒 Duct / ESP locked'
        ];

    var wrap = G('ptg-features');
    if (!wrap) return;
    wrap.innerHTML = items.map(function (txt) {
      return '<div style="font-size:11px;color:var(--tm);padding:6px 8px;background:var(--s2);border:1px solid var(--b);border-radius:8px;">' + txt + '</div>';
    }).join('');
  }

  function markActiveTestButton(plan){
    ['free', 'pro', 'monthly', 'yearly'].forEach(function (key) {
      var btn = G('tbtn-' + key);
      if (!btn) return;

      if (key === plan) {
        btn.classList.add('active');
        btn.style.border = '1px solid rgba(56,189,248,.5)';
        btn.style.boxShadow = '0 0 0 2px rgba(56,189,248,.12)';
        btn.style.opacity = '1';
      } else {
        btn.classList.remove('active');
        btn.style.border = '';
        btn.style.boxShadow = '';
        btn.style.opacity = '.9';
      }
    });
  }

  function updatePremiumButtons(plan){
    var isFree = plan === 'free';

    setLockedState(G('btn-pdf'), isFree, isAr() ? 'PDF متاح في النسخة المدفوعة فقط' : 'PDF is available in Pro only');
    setLockedState(G('btn-techpdf'), isFree, isAr() ? 'التقرير الفني متاح في النسخة المدفوعة فقط' : 'Technical report is available in Pro only');
    setLockedState(G('mode-btn-proj'), isFree, isAr() ? 'وضع المشروع متاح في النسخة المدفوعة فقط' : 'Project mode is available in Pro only');

    var ductBlock = G('proj-duct-block');
    if (ductBlock) ductBlock.style.opacity = isFree ? '.55' : '';

    var espBlock = G('esp-block');
    if (espBlock) espBlock.style.opacity = isFree ? '.55' : '';
  }

  function updateUpgradeTexts(plan){
    var paid = isPaidPlan(plan);
    setText('sl-upgrade-lbl', paid ? (isAr() ? 'إدارة AirCalc Pro' : 'Manage AirCalc Pro') : (isAr() ? 'الترقية إلى AirCalc Pro' : 'Upgrade to AirCalc Pro'));
    setText('sl-upgrade-sub', paid ? (isAr() ? 'النسخة المدفوعة مفعلة حالياً' : 'Paid plan is currently active') : (isAr() ? 'افتح PDF، التقرير الفني، مشاريع غير محدودة' : 'Unlock PDF, technical report, and unlimited projects'));
    setText('ush-cta', paid ? (isAr() ? '✅ الخطة مفعلة' : '✅ Plan Active') : (isAr() ? '⭐ الترقية إلى Pro الآن' : '⭐ Upgrade to Pro Now'));
  }

  function updatePlanUI(){
    var plan = getCurrentPlan();

    setPlanPill(G('plan-status-pill'), plan);
    setPlanPill(G('ptg-live-badge'), plan);
    updateHeaderBadge(plan);

    setText('ptg-title', isAr() ? 'حالة الخطة' : 'Plan Status');
    setText('ptg-sub', isAr() ? 'اختبار سريع للخطط' : 'Quick plan testing');
    setText('ptg-desc', buildFeatureSummary(plan));

    setText('tbtn-free-lbl', 'Free');
    setText('tbtn-free-sub', isAr() ? 'حساب + CSV' : 'Calc + CSV');
    setText('tbtn-pro-lbl', 'Pro');
    setText('tbtn-pro-sub', isAr() ? 'كل المزايا' : 'All features');
    setText('tbtn-monthly-lbl', 'Monthly');
    setText('tbtn-monthly-sub', isAr() ? '19 ر.س / شهر' : '19 SAR / month');
    setText('tbtn-yearly-lbl', 'Yearly');
    setText('tbtn-yearly-sub', isAr() ? '149 ر.س / سنة' : '149 SAR / year');

    updatePremiumButtons(plan);
    updateUpgradeTexts(plan);
    buildFeaturesList(plan);
    markActiveTestButton(plan);
    selectPricePill(getSelectedPricePill());

    var note = G('ush-note');
    if (note) {
      note.textContent = isAr()
        ? 'للتجربة فقط — الدفع قيد التطوير'
        : 'For testing only — billing is under development';
    }
  }

  function applyPlanGuards(){
    if (GUARDS_APPLIED) return;
    GUARDS_APPLIED = true;

    if (typeof window.exportPDF === 'function' && !window.exportPDF.__planWrapped) {
      var _exportPDF = window.exportPDF;
      window.exportPDF = function () {
        if (!requireFeature('exportPDF', isAr() ? 'تصدير PDF متاح في النسخة المدفوعة فقط' : 'PDF export is available in Pro only')) return;
        return _exportPDF.apply(this, arguments);
      };
      window.exportPDF.__planWrapped = true;
    }

    if (typeof window.exportTechPDF === 'function' && !window.exportTechPDF.__planWrapped) {
      var _exportTechPDF = window.exportTechPDF;
      window.exportTechPDF = function () {
        if (!requireFeature('techReport', isAr() ? 'التقرير الفني متاح في النسخة المدفوعة فقط' : 'Technical report is available in Pro only')) return;
        return _exportTechPDF.apply(this, arguments);
      };
      window.exportTechPDF.__planWrapped = true;
    }

    if (typeof window.setQuoteMode === 'function' && !window.setQuoteMode.__planWrapped) {
      var _setQuoteMode = window.setQuoteMode;
      window.setQuoteMode = function (mode) {
        if (mode === 'proj' && !requireFeature('projectMode', isAr() ? 'وضع المشروع متاح في النسخة المدفوعة فقط' : 'Project mode is available in Pro only')) {
          return;
        }
        var res = _setQuoteMode.apply(this, arguments);
        updatePlanUI();
        return res;
      };
      window.setQuoteMode.__planWrapped = true;
    }

    if (typeof window.calcESP === 'function' && !window.calcESP.__planWrapped) {
      var _calcESP = window.calcESP;
      window.calcESP = function () {
        if (!requireFeature('espCalc', isAr() ? 'حساب ESP متاح في النسخة المدفوعة فقط' : 'ESP is available in Pro only')) return;
        return _calcESP.apply(this, arguments);
      };
      window.calcESP.__planWrapped = true;
    }

    if (typeof window.setDuctBasis === 'function' && !window.setDuctBasis.__planWrapped) {
      var _setDuctBasis = window.setDuctBasis;
      window.setDuctBasis = function () {
        if (!requireFeature('ductSizing', isAr() ? 'تصميم الدكت متاح في النسخة المدفوعة فقط' : 'Duct sizing is available in Pro only')) return;
        return _setDuctBasis.apply(this, arguments);
      };
      window.setDuctBasis.__planWrapped = true;
    }

    if (typeof window.saveCurrentProject === 'function' && !window.saveCurrentProject.__planWrapped) {
      var _saveCurrentProject = window.saveCurrentProject;
      window.saveCurrentProject = function () {
        if (!hasAccess('unlimitedProjects')) {
          try {
            var projects = (window.AppProjects && typeof window.AppProjects.getProjects === 'function')
              ? window.AppProjects.getProjects()
              : [];

            var currentId = localStorage.getItem('aircalc_current_project_id') || '';
            var nameEl = G('quote-project');
            var name = String(nameEl && nameEl.value || '').trim().toLowerCase();

            var isEditingExisting = false;

            if (currentId) {
              isEditingExisting = projects.some(function (p) { return p.id === currentId; });
            }

            if (!isEditingExisting && name) {
              isEditingExisting = projects.some(function (p) {
                return String(p.name || '').trim().toLowerCase() === name;
              });
            }

            if (!isEditingExisting && projects.length >= 3) {
              toastMsg(isAr() ? 'النسخة المجانية تسمح حتى 3 مشاريع فقط' : 'Free version allows up to 3 projects only');
              openUpgradeSheet();
              return;
            }
          } catch(e){}
        }

        return _saveCurrentProject.apply(this, arguments);
      };
      window.saveCurrentProject.__planWrapped = true;
    }
  }

  function waitAndApplyGuards(){
    var tries = 0;
    var timer = setInterval(function () {
      tries += 1;
      applyPlanGuards();
      updatePlanUI();

      if (tries > 20) clearInterval(timer);
      if (typeof window.exportPDF === 'function' &&
          typeof window.exportTechPDF === 'function' &&
          typeof window.setQuoteMode === 'function' &&
          typeof window.saveCurrentProject === 'function') {
        clearInterval(timer);
      }
    }, 400);
  }

  window.getCurrentPlan = getCurrentPlan;
  window.setCurrentPlan = setCurrentPlan;
  window.getFeatureAccess = getFeatureAccess;
  window.hasAccess = hasAccess;
  window.requireFeature = requireFeature;
  window.updatePlanUI = updatePlanUI;
  window.openUpgradeSheet = openUpgradeSheet;
  window.closeUpgradeSheet = closeUpgradeSheet;
  window.selectPricePill = selectPricePill;
  window.upgradeToPro = upgradeToPro;

  document.addEventListener('DOMContentLoaded', function () {
    if (!localStorage.getItem(PLAN_KEY)) {
      try { localStorage.setItem(PLAN_KEY, DEFAULT_PLAN); } catch(e){}
    }
    if (!localStorage.getItem(PRICE_KEY)) {
      try { localStorage.setItem(PRICE_KEY, 'lifetime'); } catch(e){}
    }

    updatePlanUI();
    waitAndApplyGuards();
  });

  window.addEventListener('load', function () {
    updatePlanUI();
    waitAndApplyGuards();
    setTimeout(updatePlanUI, 600);
    setTimeout(updatePlanUI, 1500);
  });
})();