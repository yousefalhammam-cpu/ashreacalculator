// ── ERROR HANDLERS ──────────────────────────────────────────────────────
window.addEventListener('error', function(e){ console.error('[AirCalc]', e.message, e.error); });
window.addEventListener('unhandledrejection', function(e){ console.error('[AirCalc] Unhandled:', e.reason); });

// ── DATA PLACEHOLDERS (populated by loadAppData) ─────────────────────────
var ROOMS = {};
var DEVS = [];
var AC_CATALOG = {};
var UT_TO_CAT = {};
var UT_LABELS_AR = {};
var UT_LABELS_EN = {};
var ROOM_STANDARDS = {};
var ROOM_EQUIPMENT_PRESETS = {};
var _DUCT_WIDTHS  = [150,200,250,300,350,400,450,500,600,700,800,900,1000,1100,1200];
var _DUCT_HEIGHTS = [100,150,200,250,300,350,400,450,500,600,700,800];

// ── DATA.JSON LOADER ─────────────────────────────────────────────────────
function loadAppData(data){
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
  }catch(e){}

  _applyTheme();

  // Initialize UI
  curRoom = ROOMS['r_office'] || Object.values(ROOMS)[0];
  applyRoomEquipmentPreset(inferRoomStandardKey(curRoom));
  applyLang();
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
var lang = 'ar';
var curRoom = null; // set in initApp() after data loaded
var devs = [];
var hist = [];
var qlines = []; // [{qty,up}] parallel to hist
var editIdx = -1;
var vatOn = true;
var instPct = 10;
var qsValidity = 14;
var qsNotes = '';

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
  try{
    AppStorage.saveHistory(hist, qlines);
  }catch(e){}
}
function rLabel(r){ return lang==='ar'?r.ar:r.en; }

// ── LANG ──────────────────────────────────────────────────────────────────
var T = {
  ar:{calc:'احسب ▶',hclr:'مسح السجل',ncalc:'الحاسبة',nhist:'عرض السعر',ncontact:'تواصل',nset:'الإعدادات',nprojects:'المشاريع',
      mltr:'حمل التبريد',mlcfm:'تدفق الإمداد',mlbtu:'حمل الحرارة',mlmkt:'BTU السوق',
      acttl:'اختيار نوع التكييف المقترح',
      laddquote:'أضف للعرض',
      aclsys:'نوع النظام',aclmode:'وضع التوزيع',aclround:'تقريب السعة',
      aclbrand:'الماركة / الموديل',aclvolt:'الجهد الكهربائي',acleff:'كفاءة الطاقة',
      acmtotal:'وحدة واحدة للمشروع',acmroom:'وحدة لكل غرفة',
      acrbtu:'BTU/h الموصى بها',acrunits:'عدد الوحدات',acrsys:'نوع النظام',
      acroomtot:'إجمالي الوحدات',
      acround_btu:'خطوات السوق BTU/h',acround_htr:'خطوات 0.5 TR',acround_1tr:'خطوات 1 TR',
      acsplit:'سبليت (Split)',acducted:'سبليت مخفي (Ducted)',acpackage:'وحدة مركزية (Package)',acvrf:'VRF',acchiller:'تبريد مركزي (Chiller)',accassette:'كاسيت (Cassette)',acchillerfcu:'فريش إير + FCU',acwindow:'تكييف شباك (Window)',
      lvol:'حجم الغرفة (m³)',ltype:'نوع الغرفة',lppl:'👤 أشخاص — 400 BTU/h',ladd:'+ إضافة جهاز',
      lmodal:'اختر نوع الجهاز',ldtot:'إجمالي حمل الأجهزة',sroom:'الغرفة',sdev:'الأجهزة',
      bvol:'حجم الغرفة',bbase:'الحمل الأساسي',bppl:'حمل الأشخاص',bdev:'حمل الأجهزة',bsub:'الإجمالي',bsf:'+ معامل أمان 10%',
      hempty:'لا توجد حسابات بعد',
      qempty:'لا توجد غرف — احسب غرفة أولاً',
      cur:'ر.س',dempty:'لا أجهزة — اضغط + للإضافة',
      tnov:'⚠️ أدخل حجم الغرفة أولاً',tcalc:'✅ تم الحساب',tclr:'🗑️ تم المسح',
      slang:'اللغة / Language',slsub:'تبديل واجهة اللغة',
      hcttl:'ASHRAE 170 — تدفق الهواء',
      hcach:'إجمالي ACH',hcsup:'تدفق الإمداد',hcoa:'هواء خارجي',hcexh:'تدفق العادم',
      ppos:'ضغط موجب ▲',pneg:'ضغط سالب ▼',pneu:'ضغط محايد',
      vcfm:'تدفق الإمداد',cumttl:'الإجمالي التراكمي لعدة غرف',histttl:'عرض السعر',
      qttl:'📋 عرض السعر',qproject:'اسم المشروع',qqno:'رقم عرض السعر',
      qqty:'الكمية',qup:'سعر الوحدة',qlt:'إجمالي السطر',
      qtqty:'إجمالي الكمية',qtgrand:'الإجمالي النهائي',
      qempty:'لا توجد غرف — احسب غرفة أولاً',
      qexport:'تصدير عرض السعر (CSV)',qdel:'🗑️ تم الحذف',qsttl:'⚙️ إعدادات عرض السعر',qsinst:'نسبة التركيب',qsvat:'تفعيل ضريبة القيمة المضافة',qsvalid:'مدة صلاحية العرض',qsnotes:'ملاحظات',qsnph:'مثال: العرض شامل التوريد والتركيب داخل المدينة.',v7:'7 أيام',v14:'14 يوم',v30:'30 يوم',qssubl:'المجموع الفرعي (المعدات)',qsinstl:'التركيب',qsvatl:'ضريبة القيمة المضافة 15%',qsqtyl:'إجمالي الكمية',expcsv:'CSV',exphtml:'فاتورة HTML',exppdf:'تحميل PDF',exptechpdf:'تقرير فني',invtitle:'فاتورة / عرض سعر',invvalid:'صلاحية العرض',invdate:'التاريخ',invnotes:'ملاحظات',invroom:'نوع الغرفة',invvol:'الحجم',invppl:'أشخاص',invtr:'TR',invcfm:'CFM',invbtu:'BTU/h',invmkt:'Mkt BTU',invqty:'الكمية',invup:'سعر الوحدة',invlt:'إجمالي السطر',invsubt:'المجموع الفرعي',invinst:'التركيب',invvat:'ضريبة 15%',invgrand:'الإجمالي النهائي',invdiscl:'تقدير أولي — لا يُعتمد للتصميم النهائي'},
  en:{calc:'Calculate ▶',hclr:'Clear History',ncalc:'Calc',nhist:'Quotation',ncontact:'Contact',nset:'Settings',nprojects:'Projects',
      mltr:'Cooling Load',mlcfm:'Supply CFM',mlbtu:'Heat Load',mlmkt:'Market BTU',
      acttl:'Recommended AC Selection',
      laddquote:'Add to Quote',
      aclsys:'System Type',aclmode:'Sizing Mode',aclround:'Capacity Rounding',
      aclbrand:'Brand / Model',aclvolt:'Voltage',acleff:'Efficiency',
      acmtotal:'One unit for project',acmroom:'Unit per room',
      acrbtu:'Recommended BTU/h',acrunits:'Units Required',acrsys:'System Type',
      acroomtot:'Total Units',
      acround_btu:'BTU/h Market Steps',acround_htr:'0.5 TR Steps',acround_1tr:'1 TR Steps',
      acsplit:'Split (Wall)',acducted:'Ducted Split',acpackage:'Package Unit',acvrf:'VRF',acchiller:'Chiller',accassette:'Cassette',acchillerfcu:'Chiller FCU',acwindow:'Window AC',
      lvol:'Room Volume (m³)',ltype:'Room Type',lppl:'👤 Persons — 400 BTU/h each',ladd:'+ Add Device',
      lmodal:'Select Device Type',ldtot:'Total Device Load',sroom:'ROOM',sdev:'DEVICES',
      bvol:'Room Volume',bbase:'Base Load',bppl:'People Load',bdev:'Device Load',bsub:'Sub-total',bsf:'+ Safety 10%',
      hempty:'No calculations yet',
      qempty:'No rooms — calculate a room first',
      cur:'SAR',dempty:'No devices — tap + to add',
      tnov:'⚠️ Enter room volume first',tcalc:'✅ Calculated',tclr:'🗑️ Cleared',
      slang:'Language',slsub:'Switch interface language',
      hcttl:'ASHRAE 170 — Airflow',
      hcach:'Total ACH',hcsup:'Supply CFM',hcoa:'Outdoor Air CFM',hcexh:'Exhaust CFM',
      ppos:'Positive Pressure ▲',pneg:'Negative Pressure ▼',pneu:'Neutral Pressure',
      vcfm:'Supply CFM',cumttl:'Cumulative Total — Multiple Rooms',histttl:'Quotation',
      qttl:'📋 QUOTATION',qproject:'Project Name',qqno:'Quotation No.',
      qqty:'Quantity',qup:'Unit Price',qlt:'Line Total',
      qtqty:'Total Quantity',qtgrand:'Grand Total',
      qempty:'No rooms saved — calculate a room first',
      qexport:'Export Quotation (CSV)',qdel:'🗑️ Deleted',qsttl:'⚙️ Quotation Settings',qsinst:'Installation %',qsvat:'Enable VAT',qsvalid:'Quotation Validity',qsnotes:'Notes',qsnph:'Example: Price includes supply & installation within city limits.',v7:'7 days',v14:'14 days',v30:'30 days',qssubl:'Equipment Subtotal',qsinstl:'Installation',qsvatl:'VAT 15%',qsqtyl:'Total Quantity',expcsv:'CSV',exphtml:'Invoice HTML',exppdf:'Download PDF',exptechpdf:'Tech Report',invtitle:'Quotation / Invoice',invvalid:'Validity',invdate:'Date',invnotes:'Notes',invroom:'Room Type',invvol:'Volume m³',invppl:'Persons',invtr:'TR',invcfm:'CFM',invbtu:'BTU/h',invmkt:'Mkt BTU',invqty:'Qty',invup:'Unit Price',invlt:'Line Total',invsubt:'Equipment Subtotal',invinst:'Installation',invvat:'VAT 15%',invgrand:'Grand Total',invdiscl:'Preliminary estimate — not for final design submittal'}
};
function t(k){ return T[lang][k]||k; }

function applyDocumentLang(){
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
}

function applyLangHeaderUI(){
  var langBtn = G('langBtn');
  if (langBtn) langBtn.textContent = lang === 'ar' ? 'EN' : 'ع';

  var togLang = G('tog-lang');
  if (togLang) togLang.className = 'tog' + (lang === 'ar' ? ' on' : '');
}

function applyLangStaticTexts(){
  var m = {
    'lbl-calc':'calc','lbl-hclr':'hclr',
    'nl-calc':'ncalc','nl-hist':'nhist','nl-contact':'ncontact','nl-settings':'nset','nl-projects':'nprojects',
    'lbl-vol':'lvol','lbl-type':'ltype','lbl-ppl':'lppl',
    'lbl-add':'ladd','lbl-modal':'lmodal','lbl-dtot':'ldtot',
    'st-room':'sroom','st-dev':'sdev',
    'brl-vol':'bvol','brl-base':'bbase','brl-ppl':'bppl','brl-dev':'bdev','brl-sub':'bsub','brl-sf':'bsf',
    'sl-lang':'slang','sl-sub':'slsub',
    'hcttl':'hcttl','hcl-ach':'hcach','hcl-sup':'hcsup','hcl-oa':'hcoa','hcl-exh':'hcexh',
    'cum-ttl':'cumttl','hist-ttl-lbl':'histttl',
    'q-ttl':'qttl','lbl-project':'qproject','lbl-qno':'qqno',
    'lbl-export':'expcsv',
    'lbl-export2':'exphtml',
    'lbl-export3':'exppdf',
    'lbl-export4':'exptechpdf',
    'ml-tr':'mltr','ml-cfm':'mlcfm','ml-btu':'mlbtu','ml-mkt':'mlmkt',
    'ac-ttl':'acttl','lbl-add-quote':'laddquote',
    'ac-lbl-sys':'aclsys','ac-lbl-mode':'aclmode','ac-lbl-round':'aclround',
    'ac-lbl-brand':'aclbrand','ac-lbl-volt':'aclvolt','ac-lbl-eff':'acleff',
    'ac-mode-total-lbl':'acmtotal','ac-mode-room-lbl':'acmroom',
    'ac-rec-btu-lbl':'acrbtu','ac-rec-units-lbl':'acrunits','ac-rec-sys-lbl':'acrsys',
    'ac-room-total-lbl':'acroomtot',
    'ac-opt-split':'acsplit','ac-opt-ducted':'acducted','ac-opt-package':'acpackage',
    'ac-opt-vrf':'acvrf','ac-opt-chiller':'acchiller',
    'qs-ttl':'qsttl',
    'qs-inst-lbl':'qsinst',
    'qs-vat-lbl':'qsvat',
    'qs-valid-lbl':'qsvalid',
    'qs-notes-lbl':'qsnotes',
    'qs-subl':'qssubl',
    'qs-vatl':'qsvatl'
  };

  for (var id in m){
    var e = G(id);
    if (e) e.textContent = t(m[id]);
  }

  var qtQtyLbl = G('qt-qty-lbl');
  if (qtQtyLbl) qtQtyLbl.textContent = quoteMode === 'proj' ? t('qqty') : t('qsqtyl');

  var qtGrandLbl = G('qt-grand-lbl');
  if (qtGrandLbl) qtGrandLbl.textContent = t('qtgrand');
}

function applyLangInputsAndLabels(){
  var disAr = G('dis-ar');
  if (disAr) disAr.style.display = lang === 'ar' ? '' : 'none';

  var disEn = G('dis-en');
  if (disEn) disEn.style.display = lang === 'en' ? '' : 'none';

  var inpVol = G('inp-vol');
  if (inpVol) inpVol.placeholder = lang === 'ar' ? '٠ م³' : '0 m³';

  var inpPpl = G('inp-ppl');
  if (inpPpl) inpPpl.placeholder = '0';

  var quoteProject = G('quote-project');
  if (quoteProject) quoteProject.placeholder = lang === 'ar' ? 'اسم المشروع' : 'Project Name';

  var v7 = G('v7'), v14 = G('v14'), v30 = G('v30');
  if (v7) v7.textContent = t('v7');
  if (v14) v14.textContent = t('v14');
  if (v30) v30.textContent = t('v30');

  var qn = G('qs-notes');
  if (qn) qn.placeholder = t('qsnph');

  var isl = G('qs-instl');
  if (isl){
    var ip2 = parseInt((G('qs-inst') || { value:'10' }).value, 10) || 10;
    isl.textContent = t('qsinstl') + ' (' + ip2 + '%)';
  }

  var dt = G('dt');
  if (dt && curRoom) dt.textContent = rLabel(curRoom);
}

function applyLangModuleSync(){
  updateProjLabels();
  updatePlanUI();
  _syncUpgradeSheetLang();
  _syncAdvDuctLabels();

  if (window.AppProjects){
    window.AppProjects.updateProjMgrLabels();
  }
}

function applyLangRenders(){
  renderDevs();
  renderHist();

  if (quoteMode === 'proj') renderProjBlock();

  if (window.AppProjects){
    var pp = G('p-projects');
    if (pp && pp.classList.contains('on')) {
      window.AppProjects.renderProjects();
    }
  }
}

function applyLang(){
  applyDocumentLang();
  applyLangHeaderUI();
  applyLangStaticTexts();
  applyLangInputsAndLabels();
  applyLangModuleSync();
  applyLangRenders();
}
function toggleLang(){
  lang = lang === 'ar' ? 'en' : 'ar';
  applyLang();
}

var _theme = 'dark';

function toggleTheme(){
  _theme = _theme === 'dark' ? 'light' : 'dark';
  _applyTheme();
  try{
    AppStorage.saveTheme(_theme);
  }catch(e){}
}

function _applyTheme(){
  var btn = G('themeBtn');
  if (_theme === 'light'){
    document.body.classList.add('light-theme');
    if (btn) btn.textContent = '☀️';
  } else {
    document.body.classList.remove('light-theme');
    if (btn) btn.textContent = '🌙';
  }
}
// ... truncated ...