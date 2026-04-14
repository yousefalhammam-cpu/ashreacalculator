// ── AirCalc Pro — core/state.js ──────────────────────────────────────────
// Centralised app state. All values here mirror the defaults in app.js.
// This is a READ reference for new code; existing app.js vars are still
// the live source of truth until the full migration is complete.

window.AppState = {

  // ── Language & Theme ────────────────────────────────────────────────
  lang:       'ar',       // 'ar' | 'en'
  theme:      'dark',     // 'dark' | 'light'

  // ── Room / Device state ─────────────────────────────────────────────
  curRoom:    null,       // current ROOMS entry object
  devs:       [],         // [{id, qty}]

  // ── History & Quotation ─────────────────────────────────────────────
  hist:       [],         // array of saved room calc records
  qlines:     [],         // [{qty, up, unitType, selectedBtu}] — parallel to hist
  editIdx:    -1,         // index of record being edited (-1 = new)

  // ── Quotation settings ───────────────────────────────────────────────
  vatOn:      true,
  instPct:    10,
  qsValidity: 14,
  qsNotes:    '',

  // ── Quote mode ───────────────────────────────────────────────────────
  quoteMode:  'room',     // 'room' | 'proj'

  // ── Bundle mode ──────────────────────────────────────────────────────
  bundleOn:   false,
  bundleConfig: {
    unitType:    'package',
    selectedBtu: 0,
    qty:         1,
    unitPrice:   0,
    designBasis: 'required',
    supplyFpm:   1000,
    returnFpm:   800,
    cfmPerTr:    400
  },

  // ── Project mode state ───────────────────────────────────────────────
  projState: {
    sysType: 'split',
    selBtu:  0,
    qty:     1,
    up:      0
  },

  // ── Data tables (populated after data.json fetch) ────────────────────
  data: {
    ROOMS:       {},
    DEVS:        [],
    AC_CATALOG:  {},
    UT_TO_CAT:   {},
    UT_LABELS_AR:{},
    UT_LABELS_EN:{},
    DUCT_WIDTHS: [150,200,250,300,350,400,450,500,600,700,800,900,1000,1100,1200],
    DUCT_HEIGHTS:[100,150,200,250,300,350,400,450,500,600,700,800]
  }
};

// Sync helper — call after any state change to keep legacy vars aligned
// (Used transitionally until app.js vars are replaced)
window.AppState.syncToLegacy = function() {
  if (typeof lang        !== 'undefined') lang        = AppState.lang;
  if (typeof _theme      !== 'undefined') _theme      = AppState.theme;
  if (typeof curRoom     !== 'undefined') curRoom     = AppState.curRoom;
  if (typeof devs        !== 'undefined') devs        = AppState.devs;
  if (typeof hist        !== 'undefined') hist        = AppState.hist;
  if (typeof qlines      !== 'undefined') qlines      = AppState.qlines;
  if (typeof editIdx     !== 'undefined') editIdx     = AppState.editIdx;
  if (typeof vatOn       !== 'undefined') vatOn       = AppState.vatOn;
  if (typeof instPct     !== 'undefined') instPct     = AppState.instPct;
  if (typeof qsValidity  !== 'undefined') qsValidity  = AppState.qsValidity;
  if (typeof qsNotes     !== 'undefined') qsNotes     = AppState.qsNotes;
  if (typeof quoteMode   !== 'undefined') quoteMode   = AppState.quoteMode;
  if (typeof bundleOn    !== 'undefined') bundleOn    = AppState.bundleOn;
};

console.log('[AirCalc] AppState initialised');
// ── AirCalc Pro — core/helpers.js ───────────────────────────────────────
// Shared utility functions exposed on window.AppHelpers.
// These wrap (and will eventually replace) the inline helpers in app.js.

window.AppHelpers = {

  // ── DOM ──────────────────────────────────────────────────────────────
  /** Get element by id */
  G: function(id) {
    return document.getElementById(id);
  },

  // ── Formatting ───────────────────────────────────────────────────────
  /** Format number as 2-decimal money string */
  money: function(v) {
    return (Math.round((v || 0) * 100) / 100).toFixed(2);
  },

  /** Watts → BTU/h  (1 W = 3.41214 BTU/h) */
  w2b: function(w) {
    return Math.round((w || 0) * 3.41214);
  },

  /** Cubic metres → cubic feet */
  m3toft3: function(m) {
    return (m || 0) * 35.3147;
  },

  // ── UI feedback ──────────────────────────────────────────────────────
  /** Show a temporary toast notification */
  toast: function(msg) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(AppHelpers._toastTimer);
    AppHelpers._toastTimer = setTimeout(function() {
      el.classList.remove('show');
    }, 3000);
  },
  _toastTimer: null,

  /** Animate-update a metric display element */
  flash: function(id, value) {
    var el = document.getElementById(id);
    if (!el) return;
    el.classList.add('fade');
    setTimeout(function() {
      el.textContent = value;
      el.classList.remove('fade');
    }, 150);
  },

  // ── Data safety ───────────────────────────────────────────────────────
  /** Safe JSON parse with fallback */
  safeJSONParse: function(value, fallback) {
    try {
      var parsed = JSON.parse(value);
      return (parsed !== null && parsed !== undefined) ? parsed : fallback;
    } catch(e) {
      return fallback;
    }
  },

  /**
   * Validate that loaded data.json has all required keys.
   * Throws an Error with a descriptive message if anything is missing.
   */
  validateAppData: function(data) {
    var required = [
      'ROOMS',
      'DEVS',
      'AC_CATALOG',
      'UT_TO_CAT',
      'UT_LABELS_AR',
      'UT_LABELS_EN'
    ];
    if (!data || typeof data !== 'object') {
      throw new Error('data.json is empty or not a valid JSON object.');
    }
    var missing = required.filter(function(key) {
      return !(key in data);
    });
    if (missing.length > 0) {
      throw new Error('data.json is missing required keys: ' + missing.join(', '));
    }
    if (typeof data.ROOMS !== 'object' || Array.isArray(data.ROOMS)) {
      throw new Error('data.json: ROOMS must be an object (key→room).');
    }
    if (!Array.isArray(data.DEVS)) {
      throw new Error('data.json: DEVS must be an array.');
    }
    if (Object.keys(data.ROOMS).length === 0) {
      throw new Error('data.json: ROOMS is empty.');
    }
    if (data.DEVS.length === 0) {
      throw new Error('data.json: DEVS is empty.');
    }
    return true; // all good
  }

};

console.log('[AirCalc] AppHelpers initialised');
// ── AirCalc Pro — core/storage.js ───────────────────────────────────────
// Centralises all localStorage access.
// Keys are unchanged from original app.js to preserve existing user data.
//
// Existing keys:
//   acp9h          → history array
//   acp9q          → quotation lines array
//   acp9qs         → quotation settings object
//   acp9mode       → quoteMode string ('room'|'proj')
//   acp9theme      → theme string ('dark'|'light')
//   ac_bundleConfig → bundle config object

(function () {
  'use strict';

  var H = window.AppHelpers;

  // ── Safe JSON helpers ─────────────────────────────────────────────────────
  function safeParse(raw, fallback) {
    if (H && H.safeJSONParse) return H.safeJSONParse(raw, fallback);
    try { var v = JSON.parse(raw); return (v !== null && v !== undefined) ? v : fallback; }
    catch (e) { return fallback; }
  }
  function safeStringify(value) {
    try { return JSON.stringify(value); } catch (e) { return null; }
  }
  function lsSet(key, value) {
    try { localStorage.setItem(key, safeStringify(value)); return true; }
    catch (e) { console.warn('[Storage] set failed:', key, e); return false; }
  }
  function lsGet(key, fallback) {
    try { return safeParse(localStorage.getItem(key), fallback); }
    catch (e) { return fallback; }
  }
  function lsSetRaw(key, value) {
    try { localStorage.setItem(key, value); return true; }
    catch (e) { console.warn('[Storage] setRaw failed:', key, e); return false; }
  }
  function lsGetRaw(key) {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  }
  function lsRemove(key) {
    try { localStorage.removeItem(key); } catch (e) {}
  }

  // ── HISTORY ────────────────────────────────────────────────────────────────
  function saveHistory(hist, qlines) {
    lsSet('acp9h', hist);
    lsSet('acp9q', qlines);
  }

  function restoreHistory() {
    var hist   = lsGet('acp9h', []);
    var qlines = lsGet('acp9q', []);
    // Normalise: qlines must be same length as hist
    while (qlines.length < hist.length) {
      var last = qlines.length > 0 ? qlines[qlines.length - 1] : {};
      qlines.push({
        qty: 1,
        up: last.up || 0,
        unitType: last.unitType || 'split',
        selectedBtu: last.selectedBtu || 0
      });
    }
    qlines = qlines.slice(0, hist.length);
    return { hist: hist, qlines: qlines };
  }

  // ── QUOTATION SETTINGS ─────────────────────────────────────────────────────
  function saveQuoteSettings(settings) {
    // settings = { vatOn, instPct, qsValidity, qsNotes }
    lsSet('acp9qs', settings);
  }

  function restoreQuoteSettings() {
    return lsGet('acp9qs', {
      vatOn: true,
      instPct: 10,
      qsValidity: 14,
      qsNotes: ''
    });
  }

  // ── QUOTE MODE ─────────────────────────────────────────────────────────────
  function saveQuoteMode(mode) {
    lsSetRaw('acp9mode', mode);
  }

  function restoreQuoteMode() {
    var raw = lsGetRaw('acp9mode');
    return raw === 'proj' ? 'proj' : 'room';
  }

  // ── THEME ──────────────────────────────────────────────────────────────────
  function saveTheme(theme) {
    lsSetRaw('acp9theme', theme);
  }

  function restoreTheme() {
    var raw = lsGetRaw('acp9theme');
    return raw === 'light' ? 'light' : 'dark';
  }

  // ── BUNDLE CONFIG ──────────────────────────────────────────────────────────
  var BUNDLE_CONFIG_DEFAULTS = {
    unitType:    'package',
    selectedBtu: 0,
    qty:         1,
    unitPrice:   0,
    designBasis: 'required',
    supplyFpm:   1000,
    returnFpm:   800,
    cfmPerTr:    400
  };

  function saveBundleConfig(config) {
    lsSet('ac_bundleConfig', config);
  }

  function restoreBundleConfig() {
    var saved = lsGet('ac_bundleConfig', null);
    if (!saved || typeof saved !== 'object') return Object.assign({}, BUNDLE_CONFIG_DEFAULTS);
    // Merge saved over defaults — preserves any new keys added in future
    var merged = Object.assign({}, BUNDLE_CONFIG_DEFAULTS);
    Object.keys(saved).forEach(function (k) {
      if (k in merged) merged[k] = saved[k];
    });
    return merged;
  }

  // ── CLEAR ALL ──────────────────────────────────────────────────────────────
  function clearAll() {
    lsRemove('acp9h');
    lsRemove('acp9q');
    lsRemove('acp9qs');
    lsRemove('acp9mode');
    lsRemove('acp9theme');
    lsRemove('ac_bundleConfig');
  }

  // ── Expose ──────────────────────────────────────────────────────────────────
  window.AppStorage = {
    // History
    saveHistory:          saveHistory,
    restoreHistory:       restoreHistory,
    // Quote settings
    saveQuoteSettings:    saveQuoteSettings,
    restoreQuoteSettings: restoreQuoteSettings,
    // Quote mode
    saveQuoteMode:        saveQuoteMode,
    restoreQuoteMode:     restoreQuoteMode,
    // Theme
    saveTheme:            saveTheme,
    restoreTheme:         restoreTheme,
    // Bundle
    saveBundleConfig:     saveBundleConfig,
    restoreBundleConfig:  restoreBundleConfig,
    BUNDLE_CONFIG_DEFAULTS: BUNDLE_CONFIG_DEFAULTS,
    // Nuclear option
    clearAll:             clearAll
  };

  console.log('[AirCalc] AppStorage initialised');
})();
// ── AirCalc Pro — core/i18n.js ───────────────────────────────────────────
// Owns: translation dictionary, t(), applyLang(), toggleLang()
// Strategy: defines window.AppI18n, then shadows the global functions that
//   app.js declares so only one definition is live at runtime.
//   applyLang() keeps calling renderDevs() / renderHist() as before — those
//   remain in app.js until a later phase.

(function () {
  'use strict';

  // ── Full translation dictionary ──────────────────────────────────────────
  var T = {
    ar: {
      calc: 'احسب ▶', hclr: 'مسح السجل', ncalc: 'الحاسبة', nhist: 'عرض السعر',
      ncontact: 'تواصل', nset: 'الإعدادات',
      mltr: 'حمل التبريد', mlcfm: 'تدفق الإمداد', mlbtu: 'حمل الحرارة', mlmkt: 'BTU السوق',
      acttl: 'اختيار نوع التكييف المقترح',
      laddquote: 'أضف للعرض',
      aclsys: 'نوع النظام', aclmode: 'وضع التوزيع', aclround: 'تقريب السعة',
      aclbrand: 'الماركة / الموديل', aclvolt: 'الجهد الكهربائي', acleff: 'كفاءة الطاقة',
      acmtotal: 'وحدة واحدة للمشروع', acmroom: 'وحدة لكل غرفة',
      acrbtu: 'BTU/h الموصى بها', acrunits: 'عدد الوحدات', acrsys: 'نوع النظام',
      acroomtot: 'إجمالي الوحدات',
      acround_btu: 'خطوات السوق BTU/h', acround_htr: 'خطوات 0.5 TR', acround_1tr: 'خطوات 1 TR',
      acsplit: 'سبليت (Split)', acducted: 'سبليت مخفي (Ducted)', acpackage: 'وحدة مركزية (Package)',
      acvrf: 'VRF', acchiller: 'تبريد مركزي (Chiller)', accassette: 'كاسيت (Cassette)',
      acchillerfcu: 'فريش إير + FCU', acwindow: 'تكييف شباك (Window)',
      lvol: 'حجم الغرفة (m³)', ltype: 'نوع الغرفة', lppl: '👤 أشخاص — 400 BTU/h',
      ladd: '+ إضافة جهاز',
      lmodal: 'اختر نوع الجهاز', ldtot: 'إجمالي حمل الأجهزة',
      sroom: 'الغرفة', sdev: 'الأجهزة',
      bvol: 'حجم الغرفة', bbase: 'الحمل الأساسي', bppl: 'حمل الأشخاص',
      bdev: 'حمل الأجهزة', bsub: 'الإجمالي', bsf: '+ معامل أمان 10%',
      hempty: 'لا توجد حسابات بعد',
      qempty: 'لا توجد غرف — احسب غرفة أولاً',
      cur: 'ر.س', dempty: 'لا أجهزة — اضغط + للإضافة',
      tnov: '⚠️ أدخل حجم الغرفة أولاً', tcalc: '✅ تم الحساب', tclr: '🗑️ تم المسح',
      slang: 'اللغة / Language', slsub: 'تبديل واجهة اللغة',
      hcttl: 'ASHRAE 170 — تدفق الهواء',
      hcach: 'إجمالي ACH', hcsup: 'تدفق الإمداد', hcoa: 'هواء خارجي', hcexh: 'تدفق العادم',
      ppos: 'ضغط موجب ▲', pneg: 'ضغط سالب ▼', pneu: 'ضغط محايد',
      vcfm: 'تدفق الإمداد', cumttl: 'الإجمالي التراكمي لعدة غرف', histttl: 'عرض السعر',
      qttl: '📋 عرض السعر', qproject: 'اسم المشروع', qqno: 'رقم عرض السعر',
      qqty: 'الكمية', qup: 'سعر الوحدة', qlt: 'إجمالي السطر',
      qtqty: 'إجمالي الكمية', qtgrand: 'الإجمالي النهائي',
      qexport: 'تصدير عرض السعر (CSV)', qdel: '🗑️ تم الحذف',
      qsttl: '⚙️ إعدادات عرض السعر', qsinst: 'نسبة التركيب', qsvat: 'تفعيل ضريبة القيمة المضافة',
      qsvalid: 'مدة صلاحية العرض', qsnotes: 'ملاحظات',
      qsnph: 'مثال: العرض شامل التوريد والتركيب داخل المدينة.',
      v7: '7 أيام', v14: '14 يوم', v30: '30 يوم',
      qssubl: 'المجموع الفرعي (المعدات)', qsinstl: 'التركيب', qsvatl: 'ضريبة القيمة المضافة 15%',
      qsqtyl: 'إجمالي الكمية',
      expcsv: '📊 CSV', exphtml: '🖨️ فاتورة HTML', exppdf: '📥 تحميل PDF', exptechpdf: '🛠️ تقرير فني',
      invtitle: 'فاتورة / عرض سعر', invvalid: 'صلاحية العرض', invdate: 'التاريخ',
      invnotes: 'ملاحظات', invroom: 'نوع الغرفة', invvol: 'الحجم', invppl: 'أشخاص',
      invtr: 'TR', invcfm: 'CFM', invbtu: 'BTU/h', invmkt: 'Mkt BTU',
      invqty: 'الكمية', invup: 'سعر الوحدة', invlt: 'إجمالي السطر',
      invsubt: 'المجموع الفرعي', invinst: 'التركيب', invvat: 'ضريبة 15%',
      invgrand: 'الإجمالي النهائي',
      invdiscl: 'تقدير أولي — لا يُعتمد للتصميم النهائي'
    },
    en: {
      calc: 'Calculate ▶', hclr: 'Clear History', ncalc: 'Calc', nhist: 'Quotation',
      ncontact: 'Contact', nset: 'Settings',
      mltr: 'Cooling Load', mlcfm: 'Supply CFM', mlbtu: 'Heat Load', mlmkt: 'Market BTU',
      acttl: 'Recommended AC Selection',
      laddquote: 'Add to Quote',
      aclsys: 'System Type', aclmode: 'Sizing Mode', aclround: 'Capacity Rounding',
      aclbrand: 'Brand / Model', aclvolt: 'Voltage', acleff: 'Efficiency',
      acmtotal: 'One unit for project', acmroom: 'Unit per room',
      acrbtu: 'Recommended BTU/h', acrunits: 'Units Required', acrsys: 'System Type',
      acroomtot: 'Total Units',
      acround_btu: 'BTU/h Market Steps', acround_htr: '0.5 TR Steps', acround_1tr: '1 TR Steps',
      acsplit: 'Split (Wall)', acducted: 'Ducted Split', acpackage: 'Package Unit',
      acvrf: 'VRF', acchiller: 'Chiller', accassette: 'Cassette',
      acchillerfcu: 'Chiller FCU', acwindow: 'Window AC',
      lvol: 'Room Volume (m³)', ltype: 'Room Type', lppl: '👤 Persons — 400 BTU/h each',
      ladd: '+ Add Device',
      lmodal: 'Select Device Type', ldtot: 'Total Device Load',
      sroom: 'ROOM', sdev: 'DEVICES',
      bvol: 'Room Volume', bbase: 'Base Load', bppl: 'People Load',
      bdev: 'Device Load', bsub: 'Sub-total', bsf: '+ Safety 10%',
      hempty: 'No calculations yet',
      qempty: 'No rooms — calculate a room first',
      cur: 'SAR', dempty: 'No devices — tap + to add',
      tnov: '⚠️ Enter room volume first', tcalc: '✅ Calculated', tclr: '🗑️ Cleared',
      slang: 'Language', slsub: 'Switch interface language',
      hcttl: 'ASHRAE 170 — Airflow',
      hcach: 'Total ACH', hcsup: 'Supply CFM', hcoa: 'Outdoor Air CFM', hcexh: 'Exhaust CFM',
      ppos: 'Positive Pressure ▲', pneg: 'Negative Pressure ▼', pneu: 'Neutral Pressure',
      vcfm: 'Supply CFM', cumttl: 'Cumulative Total — Multiple Rooms', histttl: 'Quotation',
      qttl: '📋 QUOTATION', qproject: 'Project Name', qqno: 'Quotation No.',
      qqty: 'Quantity', qup: 'Unit Price', qlt: 'Line Total',
      qtqty: 'Total Quantity', qtgrand: 'Grand Total',
      qexport: 'Export Quotation (CSV)', qdel: '🗑️ Deleted',
      qsttl: '⚙️ Quotation Settings', qsinst: 'Installation %', qsvat: 'Enable VAT',
      qsvalid: 'Quotation Validity', qsnotes: 'Notes',
      qsnph: 'Example: Price includes supply & installation within city limits.',
      v7: '7 days', v14: '14 days', v30: '30 days',
      qssubl: 'Equipment Subtotal', qsinstl: 'Installation', qsvatl: 'VAT 15%',
      qsqtyl: 'Total Quantity',
      expcsv: '📊 CSV', exphtml: '🖨️ Invoice HTML', exppdf: '📥 Download PDF', exptechpdf: '🛠️ Tech Report',
      invtitle: 'Quotation / Invoice', invvalid: 'Validity', invdate: 'Date',
      invnotes: 'Notes', invroom: 'Room Type', invvol: 'Volume m³', invppl: 'Persons',
      invtr: 'TR', invcfm: 'CFM', invbtu: 'BTU/h', invmkt: 'Mkt BTU',
      invqty: 'Qty', invup: 'Unit Price', invlt: 'Line Total',
      invsubt: 'Equipment Subtotal', invinst: 'Installation', invvat: 'VAT 15%',
      invgrand: 'Grand Total',
      invdiscl: 'Preliminary estimate — not for final design submittal'
    }
  };

  // ── ID→translation-key map (mirrors applyLang in app.js exactly) ────────
  var LABEL_MAP = {
    'lbl-calc': 'calc', 'lbl-hclr': 'hclr',
    'nl-calc': 'ncalc', 'nl-hist': 'nhist', 'nl-contact': 'ncontact', 'nl-settings': 'nset',
    'lbl-vol': 'lvol', 'lbl-type': 'ltype', 'lbl-ppl': 'lppl',
    'lbl-add': 'ladd', 'lbl-modal': 'lmodal', 'lbl-dtot': 'ldtot',
    'st-room': 'sroom', 'st-dev': 'sdev',
    'brl-vol': 'bvol', 'brl-base': 'bbase', 'brl-ppl': 'bppl',
    'brl-dev': 'bdev', 'brl-sub': 'bsub', 'brl-sf': 'bsf',
    'sl-lang': 'slang', 'sl-sub': 'slsub',
    'hcttl': 'hcttl', 'hcl-ach': 'hcach', 'hcl-sup': 'hcsup', 'hcl-oa': 'hcoa', 'hcl-exh': 'hcexh',
    'cum-ttl': 'cumttl', 'hist-ttl-lbl': 'histttl',
    'q-ttl': 'qttl', 'lbl-project': 'qproject', 'lbl-qno': 'qqno',
    'qt-qty-lbl': 'qtqty', 'qt-grand-lbl': 'qtgrand',
    'lbl-export': 'expcsv', 'lbl-export2': 'exphtml', 'lbl-export3': 'exppdf', 'lbl-export4': 'exptechpdf',
    'ml-tr': 'mltr', 'ml-cfm': 'mlcfm', 'ml-btu': 'mlbtu', 'ml-mkt': 'mlmkt',
    'ac-ttl': 'acttl', 'lbl-add-quote': 'laddquote',
    'ac-lbl-sys': 'aclsys', 'ac-lbl-mode': 'aclmode', 'ac-lbl-round': 'aclround',
    'ac-lbl-brand': 'aclbrand', 'ac-lbl-volt': 'aclvolt', 'ac-lbl-eff': 'acleff',
    'ac-mode-total-lbl': 'acmtotal', 'ac-mode-room-lbl': 'acmroom',
    'ac-rec-btu-lbl': 'acrbtu', 'ac-rec-units-lbl': 'acrunits', 'ac-rec-sys-lbl': 'acrsys',
    'ac-room-total-lbl': 'acroomtot',
    'ac-opt-split': 'acsplit', 'ac-opt-ducted': 'acducted', 'ac-opt-package': 'acpackage',
    'ac-opt-vrf': 'acvrf', 'ac-opt-chiller': 'acchiller',
    'qs-ttl': 'qsttl', 'qs-inst-lbl': 'qsinst', 'qs-vat-lbl': 'qsvat',
    'qs-valid-lbl': 'qsvalid', 'qs-notes-lbl': 'qsnotes',
    'qs-subl': 'qssubl', 'qs-vatl': 'qsvatl',
    'qt-qty-lbl': 'qsqtyl', 'qt-grand-lbl': 'qtgrand'
  };

  // ── Core translation function ─────────────────────────────────────────────
  function t(key) {
    // read live `lang` global from app.js (still owns lang var)
    var l = (typeof lang !== 'undefined') ? lang : 'ar';
    return (T[l] && T[l][key]) ? T[l][key] : key;
  }

  // ── applyLang: mirrors app.js applyLang() exactly ───────────────────────
  function applyLang() {
    var l = (typeof lang !== 'undefined') ? lang : 'ar';
    var G = window.AppHelpers ? window.AppHelpers.G : function (id) { return document.getElementById(id); };
    var curRoomRef = (typeof curRoom !== 'undefined') ? curRoom : null;

    document.documentElement.lang = l;
    document.documentElement.dir = l === 'ar' ? 'rtl' : 'ltr';

    var langBtn = G('langBtn');
    if (langBtn) langBtn.textContent = l === 'ar' ? 'EN' : 'ع';

    var togLang = G('tog-lang');
    if (togLang) togLang.className = 'tog' + (l === 'ar' ? ' on' : '');

    // Update all mapped labels
    for (var id in LABEL_MAP) {
      var el = G(id);
      if (el) el.textContent = t(LABEL_MAP[id]);
    }

    // Show/hide AR/EN display blocks
    var disAr = G('dis-ar'), disEn = G('dis-en');
    if (disAr) disAr.style.display = l === 'ar' ? '' : 'none';
    if (disEn) disEn.style.display = l === 'en' ? '' : 'none';

    // Placeholders
    var inpVol = G('inp-vol');
    if (inpVol) inpVol.placeholder = l === 'ar' ? '٠ م³' : '0 m³';
    var inpPpl = G('inp-ppl');
    if (inpPpl) inpPpl.placeholder = '0';
    var qProj = G('quote-project');
    if (qProj) qProj.placeholder = l === 'ar' ? 'اسم المشروع' : 'Project Name';

    // Validity select options
    var v7 = G('v7'), v14 = G('v14'), v30 = G('v30');
    if (v7)  v7.textContent  = t('v7');
    if (v14) v14.textContent = t('v14');
    if (v30) v30.textContent = t('v30');

    // Notes placeholder
    var qNotes = G('qs-notes');
    if (qNotes) qNotes.placeholder = t('qsnph');

    // Installation label with current %
    var instLbl = G('qs-instl');
    if (instLbl) {
      var ip2 = parseInt(((G('qs-inst') || { value: '10' }).value)) || 10;
      instLbl.textContent = t('qsinstl') + ' (' + ip2 + '%)';
    }

    // Current room label
    var dt = G('dt');
    if (dt && curRoomRef) {
      dt.textContent = l === 'ar' ? curRoomRef.ar : curRoomRef.en;
    }

    // Re-render device & history lists (still in app.js — safe cross-call)
    if (typeof renderDevs === 'function') renderDevs();
    if (typeof renderHist === 'function') renderHist();
  }

  // ── toggleLang ───────────────────────────────────────────────────────────
  function toggleLang() {
    // Mutate the live global `lang` (owned by app.js)
    if (typeof lang !== 'undefined') {
      lang = (lang === 'ar') ? 'en' : 'ar';
    }
    applyLang();
  }

  // ── Expose as module ─────────────────────────────────────────────────────
  window.AppI18n = {
    T: T,
    t: t,
    applyLang: applyLang,
    toggleLang: toggleLang,
    LABEL_MAP: LABEL_MAP
  };

  // Shadow the global functions so both app.js stubs and AppI18n point
  // to the same implementation.  app.js defines t/applyLang/toggleLang
  // AFTER this file loads (because it uses defer), so we patch window
  // here and let app.js overwrite; then main.js re-patches after defer.
  // The safest approach: expose on window so app.js can just call them.
  window._i18n_t          = t;
  window._i18n_applyLang  = applyLang;
  window._i18n_toggleLang = toggleLang;

  console.log('[AirCalc] i18n initialised');
})();
