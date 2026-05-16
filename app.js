// ── ERROR HANDLERS ──────────────────────────────────────────────────────
window.addEventListener('error', function(e){ console.error('[AirCalc]', e.message, e.error); });
window.addEventListener('unhandledrejection', function(e){ console.error('[AirCalc] Unhandled:', e.reason); });
if(typeof window.trackEvent !== 'function'){
  window.trackEvent = function(eventName, params){
    try{
      if(typeof window.gtag === 'function') window.gtag('event', eventName, params || {});
    }catch(error){
      console.warn('GA event failed silently:', eventName);
    }
  };
}
function trackAppEvent(eventName, params){
  try{
    window.trackEvent(eventName, params || {});
  }catch(error){
    console.warn('GA event failed silently:', eventName);
  }
}
function currentAnalyticsLanguage(){
  var active = window.lang || document.documentElement.lang || 'ar';
  return active === 'en' ? 'en' : 'ar';
}
function currentAnalyticsRoomType(){
  if(!curRoom) return '';
  return curRoom.id || curRoom.en || curRoom.ar || '';
}
window.addEventListener('load', function(){
  trackAppEvent('app_open', { language: currentAnalyticsLanguage() });
});

// ── DATA PLACEHOLDERS (populated by loadAppData) ─────────────────────────
var ROOMS = {};
var DEVS = [];
var AC_CATALOG = {};
var UT_TO_CAT = {};
var UT_LABELS_AR = {};
var UT_LABELS_EN = {};
var ROOM_STANDARDS = {};
var ROOM_EQUIPMENT_PRESETS = {};
var roomSystemDrafts = {};
var _DUCT_WIDTHS  = [150,200,250,300,350,400,450,500,600,700,800,900,1000,1100,1200];
var _DUCT_HEIGHTS = [100,150,200,250,300,350,400,450,500,600,700,800];

function repairMojibakeText(value){
  if(typeof value !== 'string') return value;
  if(!/[ØÙÃÂ]/.test(value)) return value;
  try{
    return decodeURIComponent(escape(value));
  }catch(e){
    return value;
  }
}

function normalizeAppDataText(value){
  if(Array.isArray(value)){
    return value.map(normalizeAppDataText);
  }
  if(value && typeof value === 'object'){
    Object.keys(value).forEach(function(key){
      value[key] = normalizeAppDataText(value[key]);
    });
    return value;
  }
  return repairMojibakeText(value);
}

// ── DATA.JSON LOADER ─────────────────────────────────────────────────────
function loadAppData(data){
  data = normalizeAppDataText(data || {});
  ROOMS       = data.ROOMS;
  DEVS        = data.DEVS;
  AC_CATALOG  = data.AC_CATALOG;
  UT_TO_CAT   = data.UT_TO_CAT;
  UT_LABELS_AR = data.UT_LABELS_AR;
  UT_LABELS_EN = data.UT_LABELS_EN;
  ROOM_STANDARDS = data.ROOM_STANDARDS || {};
  ROOM_EQUIPMENT_PRESETS = data.ROOM_EQUIPMENT_PRESETS || {};
  _DUCT_WIDTHS  = data.DUCT_WIDTHS  || _DUCT_WIDTHS;
  _DUCT_HEIGHTS = data.DUCT_HEIGHTS || _DUCT_HEIGHTS;
  // Rebuild DUCT_STD after widths/heights are loaded
  buildDuctStd();
}

function loadMixedSystems(){
  try{
    var raw = localStorage.getItem(MIXED_SYSTEMS_KEY);
    var parsed = raw ? JSON.parse(raw) : [];
    var migrated = false;
    if(Array.isArray(parsed) && parsed.length && qlines.length === 1){
      var line = ensureQuoteLine(0);
      if(!Array.isArray(line.systems) || !line.systems.length){
        line.systems = parsed.map(normalizeQuoteSystem);
        migrated = true;
      }
    }
    if(migrated){
      localStorage.removeItem(MIXED_SYSTEMS_KEY);
      try{ AppStorage.saveHistory(hist, qlines); }catch(err){}
    }
  }catch(e){}
}

function initApp(){
  // Restore state via AppStorage
  try {
    var _restored = AppStorage.restoreHistory();
    hist = _restored.hist || [];
    qlines = _restored.qlines || [];
  } catch(e){
    hist = [];
    qlines = [];
  }
  loadMixedSystems();

  // Restore quote settings
  try{
    var _qs = AppStorage.restoreQuoteSettings();
    if(_qs.vatOn !== undefined) vatOn = _qs.vatOn;
    if(_qs.instPct) instPct = _qs.instPct;
    if(_qs.qsValidity) qsValidity = _qs.qsValidity;
    if(_qs.qsNotes !== undefined) qsNotes = _qs.qsNotes;
  }catch(e){}

  applyQSState();

  // Restore quoteMode
  try{
    quoteMode = AppStorage.restoreQuoteMode();
  }catch(e){}

  // Restore bundle config
  try{
    var _bc = AppStorage.restoreBundleConfig();
    if(_bc){
      Object.keys(_bc).forEach(function(k){
        bundleConfig[k] = _bc[k];
      });
    }
  }catch(e){}

  // Restore theme
  try{
    _theme = AppStorage.restoreTheme();
    if(localStorage.getItem('acp_light_refresh_v1') !== '1'){
      _theme = 'light';
      AppStorage.saveTheme(_theme);
      localStorage.setItem('acp_light_refresh_v1','1');
    }
  }catch(e){}

  _applyTheme();

  for(var qi=0; qi<qlines.length; qi++){
    ensureQuoteLine(qi);
  }
  syncProjectRecommendation({keepSelectedCapacity:true});

  // Initialize UI
  curRoom = null;
  devs = [];
  applyLang();
  setResultsMode(resultsMode);
  arrangeReportAndQuoteLayout();
  applyQSState();
  setQuoteMode(quoteMode);
  renderHist();
  initProjDropdowns();
  updateProjLabels();

  // Service Worker registration
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(function(e){
      console.warn('SW reg failed:', e);
    });
  }
}

// ── BOOTSTRAP ────────────────────────────────────────────────────────────
// NOTE: The DOMContentLoaded boot block below is DISABLED.
// Bootstrapping is now handled by main.js which calls loadAppData() + initApp().
// Do NOT re-enable this block — it would cause double initialisation.
/*
document.addEventListener('DOMContentLoaded', function(){
  fetch('./data.json')
    .then(function(r){
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function(data){
      loadAppData(data);
      initApp();
    })
    .catch(function(err){
      console.error('[AirCalc] data.json load failed:', err);
      if(typeof toast === 'function'){
        toast('⚠️ فشل تحميل البيانات / Data load failed: ' + err.message);
      }
      document.body.innerHTML = '<div style="padding:40px;text-align:center;color:#f87171;font-family:sans-serif"><h2>⚠️ Error loading app data</h2><p>' + err.message + '</p><p>Check that data.json is accessible.</p><button onclick="location.reload()" style="margin-top:16px;padding:10px 24px;background:#0ea5e9;color:#fff;border:none;border-radius:8px;cursor:pointer;font-size:16px">Retry</button></div>';
    });
});
*/


// ── DATA ──────────────────────────────────────────────────────────────────

// [DATA: ROOMS loaded from data.json]

// [DATA: DEVS loaded from data.json]

// ── STATE ─────────────────────────────────────────────────────────────────
var lang = (function(){
  try{
    var savedLang = localStorage.getItem('aircalc_lang');
    return savedLang === 'en' ? 'en' : 'ar';
  }catch(e){
    return 'ar';
  }
})();
var curRoom = null; // set in initApp() after data loaded
var devs = [];
var hist = [];
var qlines = []; // [{qty,up}] parallel to hist
var editIdx = -1;
var calcRoomsOpenIdx = -1;
var resultsMode = 'total';
var vatOn = true;
var instPct = 10;
var qsValidity = 14;
var qsNotes = '';
var lastRoomDims = null;
var LEGACY_VOL_KEY = 'legacyVolume';
var DEFAULT_CITY_KEY = 'al_kharj';
var hcFreshAirMode = 'ashrae';
var peopleManualOverride = false;
var _syncingPeopleEstimate = false;
var CITY_FACTORS = {
  riyadh:{ar:'الرياض',en:'Riyadh',factor:260},
  al_kharj:{ar:'الخرج',en:'Al Kharj',factor:265},
  jeddah:{ar:'جدة',en:'Jeddah',factor:250},
  dammam:{ar:'الدمام',en:'Dammam',factor:255},
  al_khobar:{ar:'الخبر',en:'Al Khobar',factor:255},
  makkah:{ar:'مكة',en:'Makkah',factor:270},
  madinah:{ar:'المدينة المنورة',en:'Madinah',factor:255},
  abha:{ar:'أبها',en:'Abha',factor:140},
  taif:{ar:'الطائف',en:'Taif',factor:170},
  al_baha:{ar:'الباحة',en:'Al Baha',factor:165},
  tabuk:{ar:'تبوك',en:'Tabuk',factor:200},
  hail:{ar:'حائل',en:'Hail',factor:210},
  najran:{ar:'نجران',en:'Najran',factor:245},
  jazan:{ar:'جازان',en:'Jazan',factor:270}
};
var CITY_FACTOR_ORDER = ['riyadh','al_kharj','jeddah','dammam','al_khobar','makkah','madinah','abha','taif','al_baha','tabuk','hail','najran','jazan'];
var WINDOW_EXPOSURE = {
  shaded:{ar:'مظلل',en:'Shaded',factor:500},
  direct:{ar:'شمس مباشرة',en:'Direct Sun',factor:650}
};
var INSULATION_TYPES = {
  excellent:{ar:'عزل ممتاز',en:'Excellent insulation',multiplier:0.90},
  medium:{ar:'عزل متوسط',en:'Medium insulation',multiplier:1.00},
  none:{ar:'بدون عزل',en:'No insulation',multiplier:1.15}
};
var MIXED_SYSTEMS_KEY = 'acp_mixed_systems';
var MIXED_SYSTEM_TYPES = ['split','floor','ducted','cassette','package','vrf','chiller_air','chiller_water','fcu','ahu','window'];
var OCCUPANCY_TYPES = {
  normal:{ar:'عادي',en:'Normal',density:1.2},
  medium:{ar:'متوسط',en:'Medium',density:1.0},
  crowded:{ar:'مزدحم',en:'Crowded',density:0.8}
};
var MOSQUE_OCCUPANCY_TYPES = {
  regular:{ar:'صلاة اعتيادية',en:'Regular Prayer',density:1.0},
  friday:{ar:'صلاة الجمعة',en:'Friday Prayer',density:0.8},
  very_crowded:{ar:'شديد الازدحام',en:'Very Crowded',density:0.65}
};

function qsPersist(){
  var vatTog = G('vat-tog');
  var qsInstEl = G('qs-inst');
  var qsValidityEl = G('qs-validity');
  var qsNotesEl = G('qs-notes');

  vatOn = vatTog ? vatTog.classList.contains('on') : true;
  instPct = qsInstEl ? (parseInt(qsInstEl.value) || 10) : 10;
  qsValidity = qsValidityEl ? (parseInt(qsValidityEl.value) || 14) : 14;
  qsNotes = qsNotesEl ? (qsNotesEl.value || '') : '';

  try{
    AppStorage.saveQuoteSettings({
      vatOn: vatOn,
      instPct: instPct,
      qsValidity: qsValidity,
      qsNotes: qsNotes
    });
  }catch(e){}

  refreshGrandTotal();
}
function toggleVAT(){
  G('vat-tog').classList.toggle('on');
  vatOn=G('vat-tog').classList.contains('on');
  G('vat-row').style.display=vatOn?'':'none';
  qsPersist();
}
function applyQSState(){
  var inst=G('qs-inst'); if(inst) inst.value=String(instPct);
  var vt=G('vat-tog');
  if(vt){if(vatOn)vt.classList.add('on');else vt.classList.remove('on');}
  var vr=G('vat-row'); if(vr) vr.style.display=vatOn?'':'none';
  var val=G('qs-validity'); if(val) val.value=String(qsValidity);
  var notes=G('qs-notes'); if(notes) notes.value=qsNotes;
}

// ── HELPERS ───────────────────────────────────────────────────────────────
function G(id){ return document.getElementById(id); }
function w2b(w){ return Math.round(w*3.412); }
function m3toft3(m){ return m*35.3147; }
function money(v){ return Number(v||0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function flash(id,v){ var e=G(id); if(!e)return; e.classList.add('fade'); setTimeout(function(){e.textContent=v;e.classList.remove('fade');},150); }
function toast(msg){
  var t = G('toast');
  if(!t) return;
  t.textContent = msg;
  t.classList.add('on');
  setTimeout(function(){
    t.classList.remove('on');
  },2600);
}
function save(){
  syncAllRoomSystemStates();
  try{
    AppStorage.saveHistory(hist, qlines);
  }catch(e){}
}
function persistQuoteState(){
  save();
}
function renderTechReport(){
  renderQuote();
}
function renderQuotation(){
  renderQuote();
}
function normalizeQuoteMode(mode){
  return mode === 'proj' ? 'proj' : 'room';
}
function setSharedQuoteMode(mode){
  quoteMode = normalizeQuoteMode(mode);
  if(window.AppState && typeof window.AppState === 'object'){
    window.AppState.quoteMode = quoteMode;
  }
  try{
    AppStorage.saveQuoteMode(quoteMode);
  }catch(e){}
  return quoteMode;
}
function refreshModeDependentUi(){
  syncAllRoomSystemStates();
  if(quoteMode === 'proj' && getProjectQtyAuto()){
    syncProjectRecommendation({keepSelectedCapacity:true});
  }
  renderHist();
  if(quoteMode === 'proj'){
    renderProjBlock();
  }
  updateQuoteModeAuxVisibility();
  applyLang();
  updateDirectResults();
  refreshGrandTotal();
}
function rLabel(r){ return lang==='ar'?r.ar:r.en; }

function setResultsMode(mode){
  resultsMode = mode === 'total' ? 'total' : 'last';
  var lastBtn = G('results-mode-last');
  var totalBtn = G('results-mode-total');
  if(lastBtn) lastBtn.classList.toggle('on', resultsMode === 'last');
  if(totalBtn) totalBtn.classList.toggle('on', resultsMode === 'total');
  updateDirectResults();
}

function updateDirectResults(){
  if(!hist.length){
    flash('vtr','0.00');
    flash('vcfm','0');
    flash('vbtu','0');
    flash('vmkt','0');
    return;
  }
  if(resultsMode === 'total'){
    var totTR=0,totCFM=0,totBTU=0,totMKT=0;
    hist.forEach(function(h){
      var rc=Math.max(1,parseInt(h.roomCount,10)||1);
      totTR += (parseFloat(h.tr)||0) * rc;
      totCFM += (parseInt(h.cfm,10)||0) * rc;
      totBTU += (parseInt(h.btu,10)||0) * rc;
      totMKT += (parseInt(h.mkt,10)||0) * rc;
    });
    flash('vtr',totTR.toFixed(2));
    flash('vcfm',totCFM.toLocaleString());
    flash('vbtu',totBTU.toLocaleString());
    flash('vmkt',totMKT.toLocaleString());
    return;
  }
  var h = hist[hist.length-1];
  if(!h) return;
  flash('vtr',Number(h.tr||0).toFixed(2));
  flash('vcfm',Number(h.cfm||0).toLocaleString());
  flash('vbtu',Number(h.btu||0).toLocaleString());
  flash('vmkt',Number(h.mkt||0).toLocaleString());
}

// ── LANG ──────────────────────────────────────────────────────────────────
var T = {
  ar:{calc:'احسب ▶',hclr:'مسح السجل',ncalc:'الحاسبة',nhist:'عرض السعر',ncontact:'تواصل',nset:'الإعدادات',nprojects:'المشاريع',
      mltr:'حمل التبريد',mlcfm:'تدفق الإمداد',mlbtu:'حمل الحرارة',mlmkt:'BTU السوق',
      roominfo:'بيانات الغرفة',roomnote:'أدخل أبعاد الغرفة بالمتر، وسيتم حساب الحجم تلقائياً.',
      acttl:'اختيار نوع التكييف المقترح',
      laddquote:'عرض السعر',
      aclsys:'نوع النظام',aclmode:'وضع التوزيع',aclround:'تقريب السعة',
      aclbrand:'الماركة / الموديل',aclvolt:'الجهد الكهربائي',acleff:'كفاءة الطاقة',
      acmtotal:'وحدة واحدة للمشروع',acmroom:'وحدة لكل غرفة',
      acrbtu:'BTU/h الموصى بها',acrunits:'عدد الوحدات',acrsys:'نوع النظام',
      acroomtot:'إجمالي الوحدات',
      acround_btu:'خطوات السوق BTU/h',acround_htr:'خطوات 0.5 TR',acround_1tr:'خطوات 1 TR',
      acsplit:'سبليت (Split)',acducted:'سبليت مخفي (Ducted)',acpackage:'وحدة مركزية (Package)',acvrf:'VRF',acchiller:'تبريد مركزي (Chiller)',accassette:'كاسيت (Cassette)',acchillerfcu:'فريش إير + FCU',acwindow:'تكييف شباك (Window)',
      lvol:'الحجم المحسوب (م³)',llen:'الطول (م)',lwidth:'العرض (م)',lheight:'الارتفاع (م)',ltype:'نوع الغرفة',lroomcount:'عدد الغرف',lloadfactor:'معامل الحمل',lloadfactorval:'القيمة الحالية',lppl:'عدد الأشخاص',ladd:'+ إضافة جهاز',
      lmodal:'اختر نوع الجهاز',ldtot:'إجمالي حمل الأجهزة',sroom:'الغرفة',sdev:'الأجهزة',
      bvol:'حجم الغرفة',bbase:'الحمل الأساسي',bppl:'حمل الأشخاص',bdev:'حمل الأجهزة',bsub:'الإجمالي',bsf:'+ معامل أمان 10%',
      hempty:'لا توجد حسابات بعد',
      qempty:'لا توجد غرف — احسب غرفة أولاً',delroom:'حذف',delroomconfirm:'هل تريد حذف هذه الغرفة؟',
      cur:'﷼',dempty:'لا أجهزة — اضغط + للإضافة',
      tnov:'⚠️ أدخل أبعاد الغرفة أولاً',tcalc:'✅ تم الحساب',tclr:'🗑️ تم المسح',
      slang:'اللغة / Language',slsub:'تبديل واجهة اللغة',
      hcttl:'ASHRAE 170 — تدفق الهواء',
      hcach:'إجمالي ACH',hcsup:'تدفق الإمداد',hcoa:'هواء خارجي',hcrec:'هواء راجع',hcexh:'تدفق العادم',
      lfhelper:'تقدير سريع — لا يستبدل الحساب التفصيلي',
      freshairmode:'وضع الهواء النقي',freshairashrae:'حسب ASHRAE',freshair100:'هواء نقي 100%',freshairwarning:'وضع 100% هواء نقي يزيد الحمل واستهلاك الطاقة ويتطلب مراجعة مهندس.',
      exporthap:'تصدير إلى HAP',haprooms:'الغرف',hapsummary:'الملخص',hapmeta:'البيانات',calcmode:'وضع الحساب',ashraehc:'ASHRAE للرعاية الصحية',loadmode:'معامل حمل سريع',freshairlabel:'وضع الهواء النقي',mixedair:'حسب ASHRAE',fresh100lbl:'هواء نقي 100%',
      ppos:'ضغط موجب ▲',pneg:'ضغط سالب ▼',pneu:'ضغط محايد',
      vcfm:'تدفق الإمداد',cumttl:'الإجمالي التراكمي لعدة غرف',histttl:'سجل الغرف',
      qttl:'📋 عرض السعر',qproject:'اسم المشروع',qqno:'رقم عرض السعر',
      qqty:'الكمية',qup:'سعر الوحدة',qlt:'إجمالي السطر',
      qtqty:'إجمالي الكمية',qtgrand:'الإجمالي النهائي',
      qempty:'لا توجد غرف — احسب غرفة أولاً',
      qexport:'تصدير عرض السعر (CSV)',qdel:'🗑️ تم الحذف',qsttl:'⚙️ إعدادات عرض السعر',qsinst:'نسبة التركيب',qsvat:'تفعيل ضريبة القيمة المضافة',qsvalid:'مدة صلاحية العرض',qsnotes:'ملاحظات',qsnph:'مثال: العرض شامل التوريد والتركيب داخل المدينة.',v7:'7 أيام',v14:'14 يوم',v30:'30 يوم',qssubl:'المجموع الفرعي (المعدات)',qsinstl:'التركيب',qsvatl:'ضريبة القيمة المضافة 15%',qsqtyl:'إجمالي الكمية',qsave:'حفظ العرض',qsaveok:'تم حفظ عرض السعر',qsavewarn:'افتح أو احفظ مشروعًا أولًا',expcsv:'CSV',exphtml:'فاتورة HTML',exppdf:'تحميل PDF',exptechpdf:'تقرير فني',invtitle:'فاتورة / عرض سعر',invvalid:'صلاحية العرض',invdate:'التاريخ',invnotes:'ملاحظات',invroom:'نوع الغرفة',invvol:'الحجم',invppl:'أشخاص',invtr:'TR',invcfm:'CFM',invbtu:'BTU/h',invmkt:'Mkt BTU',invqty:'الكمية',invup:'سعر الوحدة',invlt:'إجمالي السطر',invsubt:'المجموع الفرعي',invinst:'التركيب',invvat:'ضريبة 15%',invgrand:'الإجمالي النهائي',invdiscl:'تقدير أولي — لا يُعتمد للتصميم النهائي'}
...