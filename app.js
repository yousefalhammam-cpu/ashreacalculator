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
var lang = 'ar';
var curRoom = null; // set in initApp() after data loaded
var devs = [];
var hist = [];
var qlines = []; // [{qty,up}] parallel to hist
var editIdx = -1;
var calcRoomsOpenIdx = -1;
var resultsMode = 'total';
var hcFreshAirMode = 'ashrae';
var vatOn = true;
var instPct = 10;
var qsValidity = 14;
var qsNotes = '';
var lastRoomDims = null;
var LEGACY_VOL_KEY = 'legacyVolume';

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
      lvol:'الحجم المحسوب (م³)',llen:'الطول (م)',lwidth:'العرض (م)',lheight:'الارتفاع (م)',ltype:'نوع الغرفة',lroomcount:'عدد الغرف',lloadfactor:'معامل الحمل',lloadfactorval:'القيمة الحالية',lppl:'👤 عدد الأشخاص — 400 BTU/h',ladd:'+ إضافة جهاز',
      lmodal:'اختر نوع الجهاز',ldtot:'إجمالي حمل الأجهزة',sroom:'الغرفة',sdev:'الأجهزة',
      bvol:'حجم الغرفة',bbase:'الحمل الأساسي',bppl:'حمل الأشخاص',bdev:'حمل الأجهزة',bsub:'الإجمالي',bsf:'+ معامل أمان 10%',
      hempty:'لا توجد حسابات بعد',
      qempty:'لا توجد غرف — احسب غرفة أولاً',delroom:'حذف',delroomconfirm:'هل تريد حذف هذه الغرفة؟',
      cur:'ر.س',dempty:'لا أجهزة — اضغط + للإضافة',
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
      qexport:'تصدير عرض السعر (CSV)',qdel:'🗑️ تم الحذف',qsttl:'⚙️ إعدادات عرض السعر',qsinst:'نسبة التركيب',qsvat:'تفعيل ضريبة القيمة المضافة',qsvalid:'مدة صلاحية العرض',qsnotes:'ملاحظات',qsnph:'مثال: العرض شامل التوريد والتركيب داخل المدينة.',v7:'7 أيام',v14:'14 يوم',v30:'30 يوم',qssubl:'المجموع الفرعي (المعدات)',qsinstl:'التركيب',qsvatl:'ضريبة القيمة المضافة 15%',qsqtyl:'إجمالي الكمية',expcsv:'CSV',exphtml:'فاتورة HTML',exppdf:'تحميل PDF',exptechpdf:'تقرير فني',invtitle:'فاتورة / عرض سعر',invvalid:'صلاحية العرض',invdate:'التاريخ',invnotes:'ملاحظات',invroom:'نوع الغرفة',invvol:'الحجم',invppl:'أشخاص',invtr:'TR',invcfm:'CFM',invbtu:'BTU/h',invmkt:'Mkt BTU',invqty:'الكمية',invup:'سعر الوحدة',invlt:'إجمالي السطر',invsubt:'المجموع الفرعي',invinst:'التركيب',invvat:'ضريبة 15%',invgrand:'الإجمالي النهائي',invdiscl:'تقدير أولي — لا يُعتمد للتصميم النهائي'},
  en:{calc:'Calculate ▶',hclr:'Clear History',ncalc:'Calc',nhist:'Quotation',ncontact:'Contact',nset:'Settings',nprojects:'Projects',
      mltr:'Cooling Load',mlcfm:'Supply CFM',mlbtu:'Heat Load',mlmkt:'Market BTU',
      roominfo:'Room Information',roomnote:'Enter dimensions in meters; volume is calculated automatically.',
      acttl:'Recommended AC Selection',
      laddquote:'Quotation',
      aclsys:'System Type',aclmode:'Sizing Mode',aclround:'Capacity Rounding',
      aclbrand:'Brand / Model',aclvolt:'Voltage',acleff:'Efficiency',
      acmtotal:'One unit for project',acmroom:'Unit per room',
      acrbtu:'Recommended BTU/h',acrunits:'Units Required',acrsys:'System Type',
      acroomtot:'Total Units',
      acround_btu:'BTU/h Market Steps',acround_htr:'0.5 TR Steps',acround_1tr:'1 TR Steps',
      acsplit:'Split (Wall)',acducted:'Ducted Split',acpackage:'Package Unit',acvrf:'VRF',acchiller:'Chiller',accassette:'Cassette',acchillerfcu:'Chiller FCU',acwindow:'Window AC',
      lvol:'Calculated Volume (m³)',llen:'Length (m)',lwidth:'Width (m)',lheight:'Height (m)',ltype:'Room Type',lroomcount:'Room Count',lloadfactor:'Load Factor',lloadfactorval:'Current Value',lppl:'👤 Persons — 400 BTU/h each',ladd:'+ Add Device',
      lmodal:'Select Device Type',ldtot:'Total Device Load',sroom:'ROOM',sdev:'DEVICES',
      bvol:'Room Volume',bbase:'Base Load',bppl:'People Load',bdev:'Device Load',bsub:'Sub-total',bsf:'+ Safety 10%',
      hempty:'No calculations yet',
      qempty:'No rooms — calculate a room first',
      cur:'SAR',dempty:'No devices — tap + to add',
      tnov:'⚠️ Enter room dimensions first',tcalc:'✅ Calculated',tclr:'🗑️ Cleared',
      slang:'Language',slsub:'Switch interface language',
      hcttl:'ASHRAE 170 — Airflow',
      hcach:'Total ACH',hcsup:'Supply CFM',hcoa:'Outdoor Air CFM',hcrec:'Recirculated CFM',hcexh:'Exhaust CFM',
      lfhelper:'Quick estimate — not a substitute for detailed calculation',
      freshairmode:'Fresh Air Mode',freshairashrae:'ASHRAE Mixed Air',freshair100:'100% Fresh Air',freshairwarning:'100% Fresh Air increases load and energy use. Engineer review required.',
      exporthap:'Export to HAP',haprooms:'Rooms',hapsummary:'Summary',hapmeta:'Metadata',calcmode:'Calculation Mode',ashraehc:'ASHRAE Healthcare',loadmode:'Load Factor Estimate',freshairlabel:'Fresh Air Mode',mixedair:'ASHRAE Mixed Air',fresh100lbl:'100% Fresh Air',
      ppos:'Positive Pressure ▲',pneg:'Negative Pressure ▼',pneu:'Neutral Pressure',
      vcfm:'Supply CFM',cumttl:'Cumulative Total — Multiple Rooms',histttl:'Quotation',
      qttl:'📋 QUOTATION',qproject:'Project Name',qqno:'Quotation No.',
      qqty:'Quantity',qup:'Unit Price',qlt:'Line Total',
      qtqty:'Total Quantity',qtgrand:'Grand Total',
      qempty:'No rooms saved — calculate a room first',delroom:'Delete',delroomconfirm:'Are you sure you want to delete this room?',
      qexport:'Export Quotation (CSV)',qdel:'🗑️ Deleted',qsttl:'⚙️ Quotation Settings',qsinst:'Installation %',qsvat:'Enable VAT',qsvalid:'Quotation Validity',qsnotes:'Notes',qsnph:'Example: Price includes supply & installation within city limits.',v7:'7 days',v14:'14 days',v30:'30 days',qssubl:'Equipment Subtotal',qsinstl:'Installation',qsvatl:'VAT 15%',qsqtyl:'Total Quantity',expcsv:'CSV',exphtml:'Invoice HTML',exppdf:'Download PDF',exptechpdf:'Tech Report',invtitle:'Quotation / Invoice',invvalid:'Validity',invdate:'Date',invnotes:'Notes',invroom:'Room Type',invvol:'Volume m³',invppl:'Persons',invtr:'TR',invcfm:'CFM',invbtu:'BTU/h',invmkt:'Mkt BTU',invqty:'Qty',invup:'Unit Price',invlt:'Line Total',invsubt:'Equipment Subtotal',invinst:'Installation',invvat:'VAT 15%',invgrand:'Grand Total',invdiscl:'Preliminary estimate — not for final design submittal'}
};
Object.assign(T.ar,{
  settingssec:'الإعدادات',
  accountsec:'الحساب',
  plansec:'الخطة',
  rsk:'النتائج المباشرة',
  rsc:'تظهر هنا أهم نتائج التكييف مباشرة بعد الحساب.',
  rmlast:'آخر غرفة',
  rmtotal:'إجمالي الغرف',
  cmhc:'وضع الحساب: ASHRAE للرعاية الصحية',
  cmrot:'وضع الحساب: معامل الحمل السريع',
  cmhcsub:'معايير ASHRAE محفوظة لهذه الغرفة — لا يتم استبدال تهوية ASHRAE بمعامل الحمل.',
  cmrotsub:'معامل الحمل BTU/m³ مستخدم لهذه الغرفة قبل تنفيذ الحساب.',
  step1:'الخطوة 1',
  step2:'الخطوة 2',
  step3:'الخطوة 3',
  devtitle:'أحمال الأجهزة',
  devnote:'أضف أحمال الأجهزة فقط عندما تكون مؤثرة في التقدير.',
  calctitle:'احسب وراجع',
  calcnote:'نفّذ الحساب ثم راجع التفصيل وتوجيهات تدفق الهواء بالأسفل.',
  bttl:'التفصيل',
  notelbl:'ملاحظة',
  cumtr:'إجمالي TR',
  cumcfm:'إجمالي CFM',
  cumbtu:'إجمالي BTU/h',
  cummkt:'سعة السوق',
  pttr:'إجمالي TR',
  ptcfm:'إجمالي CFM',
  ptbtu:'إجمالي BTU/h',
  ptmkt:'سعة السوق',
  authacct:'الحساب',
  authanon:'يمكنك استخدام التطبيق بدون تسجيل دخول',
  authsignin:'تسجيل الدخول',
  authcreate:'إنشاء حساب',
  authfullname:'الاسم الكامل',
  authemail:'البريد الإلكتروني',
  authpassword:'كلمة المرور',
  authconfirm:'تأكيد كلمة المرور',
  authforgot:'نسيت كلمة المرور؟',
  authlogout:'تسجيل الخروج',
  authsignedin:'تم تسجيل الدخول',
  authcreated:'تم إنشاء الحساب',
  authreset:'أرسلنا رابط إعادة تعيين كلمة المرور',
  authcloudreq:'يتطلب تسجيل الدخول للحفظ السحابي',
  authmodeanon:'يمكنك استخدام التطبيق بدون تسجيل دخول',
  authtrialfree:'ميزات Pro مجانية خلال الفترة التجريبية.',
  authloggedin:'تم تسجيل الدخول باسم',
  authfullname_req:'الاسم الكامل مطلوب',
  authemail_invalid:'أدخل بريدًا إلكترونيًا صحيحًا',
  authpassword_min:'كلمة المرور يجب ألا تقل عن 8 أحرف',
  authconfirm_mismatch:'تأكيد كلمة المرور غير مطابق',
  authfirebase_unavailable:'تعذّر الاتصال بخدمة الحساب الآن',
  authoffline:'أنت غير متصل حاليًا — يمكن استخدام التطبيق محليًا',
  authcloudcoming:'الحفظ السحابي قادم قريبًا'
});
Object.assign(T.en,{
  settingssec:'Settings',
  accountsec:'Account',
  plansec:'Plan',
  rsk:'Live Results',
  rsc:'Your key HVAC sizing outputs update here after calculation.',
  rmlast:'Last Room',
  rmtotal:'All Rooms Total',
  cmhc:'Calculation Mode: ASHRAE Healthcare',
  cmrot:'Calculation Mode: Load Factor Estimate',
  cmhcsub:'ASHRAE standards are preserved for this room — ventilation is not replaced by load factor.',
  cmrotsub:'Load Factor BTU/m³ is used for this room before calculation.',
  step1:'Step 1',
  step2:'Step 2',
  step3:'Step 3',
  devtitle:'Equipment Loads',
  devnote:'Add plug loads and process equipment only when they matter to the estimate.',
  calctitle:'Calculate and Review',
  calcnote:'Run the estimate, then inspect the breakdown and airflow guidance below.',
  bttl:'Breakdown',
  notelbl:'Note',
  cumtr:'Total TR',
  cumcfm:'Total CFM',
  cumbtu:'Total BTU/h',
  cummkt:'Market BTU',
  pttr:'Total TR',
  ptcfm:'Total CFM',
  ptbtu:'Total BTU/h',
  ptmkt:'Mkt BTU',
  authacct:'Account',
  authanon:'You can use the app without signing in',
  authsignin:'Sign In',
  authcreate:'Create Account',
  authfullname:'Full Name',
  authemail:'Email',
  authpassword:'Password',
  authconfirm:'Confirm Password',
  authforgot:'Forgot Password?',
  authlogout:'Log Out',
  authsignedin:'Signed in',
  authcreated:'Account created',
  authreset:'Password reset link sent',
  authcloudreq:'Login required for cloud saving',
  authmodeanon:'You can use the app without signing in',
  authtrialfree:'Pro features are free during the trial period.',
  authloggedin:'Signed in as',
  authfullname_req:'Full name is required',
  authemail_invalid:'Enter a valid email address',
  authpassword_min:'Password must be at least 8 characters',
  authconfirm_mismatch:'Confirm password does not match',
  authfirebase_unavailable:'Account service is unavailable right now',
  authoffline:'You appear to be offline — local calculator remains available',
  authcloudcoming:'Cloud saving is coming soon'
});
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
    'results-kicker':'rsk','results-caption':'rsc',
    'results-mode-last':'rmlast','results-mode-total':'rmtotal',
    'room-step-kicker':'step1','devices-step-kicker':'step2','calc-step-kicker':'step3',
    'room-input-title':'roominfo','room-input-note':'roomnote',
    'devices-title':'devtitle','devices-note':'devnote',
    'calc-title':'calctitle','calc-note':'calcnote',
    'nl-calc':'ncalc','nl-hist':'nhist','nl-contact':'ncontact','nl-settings':'nset','nl-projects':'nprojects',
    'lbl-vol':'lvol','lbl-len':'llen','lbl-width':'lwidth','lbl-height':'lheight','lbl-type':'ltype','lbl-room-count':'lroomcount','lbl-load-factor':'lloadfactor','lbl-load-factor-value':'lloadfactorval','lbl-ppl':'lppl',
    'lbl-add':'ladd','lbl-modal':'lmodal','lbl-dtot':'ldtot',
    'st-room':'sroom','st-dev':'sdev',
    'breakdown-ttl':'bttl','hc-note-lbl':'notelbl',
    'brl-vol':'bvol','brl-base':'bbase','brl-ppl':'bppl','brl-dev':'bdev','brl-sub':'bsub','brl-sf':'bsf',
    'sl-lang':'slang','sl-sub':'slsub',
    'settings-section-title':'settingssec','account-section-title':'accountsec','plan-section-title':'plansec',
    'auth-panel-title':'authacct','auth-modal-title':'authacct',
    'auth-fullname-lbl':'authfullname','auth-email-lbl':'authemail','auth-password-lbl':'authpassword','auth-confirm-lbl':'authconfirm',
    'hcttl':'hcttl','hcl-ach':'hcach','hcl-sup':'hcsup','hcl-oa':'hcoa','hcl-rec':'hcrec','hcl-exh':'hcexh',
    'lbl-fresh-air-mode':'freshairmode','lbl-export-hap':'exporthap',
    'cum-ttl':'cumttl','hist-ttl-lbl':'histttl',
    'cum-lbl-tr':'cumtr','cum-lbl-cfm':'cumcfm','cum-lbl-btu':'cumbtu','cum-lbl-mkt':'cummkt',
    'ptot-lbl-tr':'pttr','ptot-lbl-cfm':'ptcfm','ptot-lbl-btu':'ptbtu','ptot-lbl-mkt':'ptmkt',
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
  if (inpVol) inpVol.placeholder = '0.0';

  ['inp-len','inp-width','inp-height'].forEach(function(id){
    var el = G(id);
    if(el) el.placeholder = '0.0';
  });

  var inpPpl = G('inp-ppl');
  if (inpPpl) inpPpl.placeholder = '0';
  var loadFactorInp = G('inp-load-factor');
  if (loadFactorInp) loadFactorInp.placeholder = curRoom && curRoom.factor ? String(curRoom.factor) : '260';
  var loadFactorHelper = G('load-factor-helper');
  if (loadFactorHelper) loadFactorHelper.textContent = t('lfhelper');
  var loadFactorPreset = G('inp-load-factor-preset');
  if (loadFactorPreset && loadFactorPreset.options.length >= 6){
    loadFactorPreset.options[0].text = '—';
    loadFactorPreset.options[1].text = lang === 'ar' ? 'خفيف 220' : 'Light 220';
    loadFactorPreset.options[2].text = lang === 'ar' ? 'متوسط 260' : 'Medium 260';
    loadFactorPreset.options[3].text = lang === 'ar' ? 'عالي 300' : 'High 300';
    loadFactorPreset.options[4].text = lang === 'ar' ? 'شديد 340' : 'Severe 340';
    loadFactorPreset.options[5].text = lang === 'ar' ? 'مخصص' : 'Custom';
  }
  var freshAirMode = G('inp-fresh-air-mode');
  if(freshAirMode && freshAirMode.options.length >= 2){
    freshAirMode.options[0].text = t('freshairashrae');
    freshAirMode.options[1].text = t('freshair100');
  }

  var quoteProject = G('quote-project');
  if (quoteProject) quoteProject.placeholder = lang === 'ar' ? 'اسم المشروع' : 'Project Name';
  var techProject = G('tech-project');
  if (techProject) techProject.placeholder = lang === 'ar' ? 'اسم المشروع' : 'Project Name';
  var techNo = G('tech-no');
  if (techNo) techNo.placeholder = 'Q-001';
  var quoteProjPricingTtl = G('quote-proj-pricing-ttl');
  if (quoteProjPricingTtl) quoteProjPricingTtl.textContent = lang === 'ar' ? 'التسعير' : 'Pricing';
  var techTitle = G('tech-ttl');
  if (techTitle) techTitle.textContent = lang === 'ar' ? 'التقرير الفني' : 'Technical Report';
  var techProjectLbl = G('tech-project-lbl');
  if (techProjectLbl) techProjectLbl.textContent = lang === 'ar' ? 'اسم المشروع' : 'Project Name';
  var techQnoLbl = G('tech-qno-lbl');
  if (techQnoLbl) techQnoLbl.textContent = lang === 'ar' ? 'رقم المشروع' : 'Project No.';
  var techNote = G('tech-note');
  if (techNote) techNote.textContent = lang === 'ar' ? 'راجع بيانات المشروع ثم صدّر التقرير الفني PDF مباشرة من هنا.' : 'Review project data, then export the technical report PDF directly from here.';
  var techExportLbl = G('tech-export-lbl');
  if (techExportLbl) techExportLbl.textContent = lang === 'ar' ? 'تقرير فني PDF' : 'Tech Report PDF';
  var techNavLbl = G('nl-tech');
  if (techNavLbl) techNavLbl.textContent = lang === 'ar' ? 'التقرير الفني' : 'Tech Report';
  var conDesc = G('con-desc');
  if (conDesc) conDesc.textContent = lang === 'ar'
    ? 'AirCalc Pro أداة هندسية مبسطة لحساب أحمال التبريد والتهوية وتجهيز عرض السعر والتقرير الفني بسرعة ووضوح.'
    : 'AirCalc Pro is a streamlined engineering tool for cooling load and ventilation calculations, with fast quotation and technical report preparation.';
  var conFeatures = G('con-features');
  if (conFeatures) conFeatures.innerHTML = lang === 'ar'
    ? '<div class="con-feat">• حساب حمل التبريد و CFM و BTU</div><div class="con-feat">• معايير الغرف وتجهيزات الأجهزة حسب الاستخدام</div><div class="con-feat">• عرض سعر وتقرير فني وتصدير PDF</div><div class="con-feat">• وضع المشروع وحساب مجاري الهواء و ESP</div>'
    : '<div class="con-feat">• Cooling load, CFM, and BTU calculations</div><div class="con-feat">• Room standards and equipment presets by use case</div><div class="con-feat">• Quotation, technical report, and PDF export</div><div class="con-feat">• Project mode, duct sizing, and ESP calculation</div>';

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
  if (dt) dt.textContent = curRoom ? rLabel(curRoom) : '—';

  var dimGrid = G('dim-grid');
  if (dimGrid) dimGrid.setAttribute('aria-label', lang === 'ar' ? 'أبعاد الغرفة' : 'Room dimensions');

  var roomCountStepper = G('room-count-stepper');
  if (roomCountStepper) roomCountStepper.setAttribute('aria-label', lang === 'ar' ? 'تعديل عدد الغرف' : 'Adjust room count');

  var personsStepper = G('persons-stepper');
  if (personsStepper) personsStepper.setAttribute('aria-label', lang === 'ar' ? 'تعديل عدد الأشخاص' : 'Adjust persons');
  var freshAirRow = G('fresh-air-row');
  if (freshAirRow) freshAirRow.setAttribute('aria-label', t('freshairmode'));

  var roomBtns = document.querySelectorAll('#room-count-stepper button');
  if (roomBtns[0]) roomBtns[0].setAttribute('aria-label', lang === 'ar' ? 'زيادة عدد الغرف' : 'Increase room count');
  if (roomBtns[1]) roomBtns[1].setAttribute('aria-label', lang === 'ar' ? 'تقليل عدد الغرف' : 'Decrease room count');

  var pplBtns = document.querySelectorAll('#persons-stepper button');
  if (pplBtns[0]) pplBtns[0].setAttribute('aria-label', lang === 'ar' ? 'زيادة عدد الأشخاص' : 'Increase persons');
  if (pplBtns[1]) pplBtns[1].setAttribute('aria-label', lang === 'ar' ? 'تقليل عدد الأشخاص' : 'Decrease persons');

  var themeBtn = G('themeBtn');
  if (themeBtn) themeBtn.title = lang === 'ar' ? 'تبديل المظهر' : 'Toggle theme';

  var calcNav = G('ni-calc');
  if (calcNav) calcNav.title = lang === 'ar' ? 'الحاسبة' : 'Calculator';

  var saveBtn = G('quote-save-btn');
  if (saveBtn) saveBtn.title = lang === 'ar' ? 'حفظ المشروع' : 'Save Project';
}

function applyLangModuleSync(){
  updateProjLabels();
  updatePlanUI();
  _syncUpgradeSheetLang();
  _syncAdvDuctLabels();
  if (window.AppAuth && typeof window.AppAuth.updateAuthUI === 'function') {
    window.AppAuth.updateAuthUI();
  }

  if (window.AppProjects){
    window.AppProjects.updateProjMgrLabels();
  }
}

function applyLangRenders(){
  renderRoomDropdown();
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
  updateCalculationModeUI(curRoom);
}
function toggleLang(){
  lang = lang === 'ar' ? 'en' : 'ar';
  applyLang();
}

var _theme = 'light';

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
// ── NAVIGATION ────────────────────────────────────────────────────────────
function goPanel(name){
  document.querySelectorAll('.panel').forEach(function(p){p.classList.remove('on');});
  document.querySelectorAll('.ni').forEach(function(n){n.classList.remove('on');});
  var p=G('p-'+name), n=G('ni-'+name);
  if(p) p.classList.add('on');
  if(n) n.classList.add('on');
}

function syncProjectFields(source){
  var fromProject = G(source + '-project');
  var fromNo = G(source + '-no');
  var toPrefix = source === 'tech' ? 'quote' : 'tech';
  var toProject = G(toPrefix + '-project');
  var toNo = G(toPrefix + '-no');
  if(fromProject && toProject && toProject.value !== fromProject.value) toProject.value = fromProject.value;
  if(fromNo && toNo && toNo.value !== fromNo.value) toNo.value = fromNo.value;
}

function exportTechPDFFromPanel(){
  syncProjectFields('tech');
  exportTechPDF();
}

function arrangeReportAndQuoteLayout(){
  var quoteSettingsSlot = G('quote-settings-slot');
  var quoteProjPricingSlot = G('quote-proj-pricing-slot');
  var quoteProjPricingInlineSlot = G('quote-proj-pricing-inline-slot');
  var techCumSlot = G('tech-cum-slot');
  var techControlsSlot = G('tech-controls-slot');
  var techProjSlot = G('tech-proj-slot');
  var techAnalysisSlot = G('tech-analysis-slot');
  if(!quoteSettingsSlot || !quoteProjPricingSlot || !quoteProjPricingInlineSlot || !techCumSlot || !techControlsSlot || !techProjSlot || !techAnalysisSlot) return;

  var qsCard = G('qs-card');
  if(qsCard && qsCard.parentNode !== quoteSettingsSlot) quoteSettingsSlot.appendChild(qsCard);

  var cumCard = G('cum-card');
  if(cumCard && cumCard.parentNode !== techCumSlot) techCumSlot.appendChild(cumCard);

  var bundleRow = G('bundle-row');
  if(bundleRow && bundleRow.parentNode !== techControlsSlot) techControlsSlot.appendChild(bundleRow);

  var modeToggleRow = G('mode-toggle-row');
  if(modeToggleRow && modeToggleRow.parentNode !== techControlsSlot) techControlsSlot.appendChild(modeToggleRow);

  var projBlock = G('proj-block');
  if(projBlock && projBlock.parentNode !== techProjSlot) techProjSlot.appendChild(projBlock);

  var calcModeRow = G('calc-mode-row');
  if(calcModeRow && calcModeRow.parentNode !== techAnalysisSlot) techAnalysisSlot.appendChild(calcModeRow);

  var advDuctBlock = G('adv-duct-block');
  if(advDuctBlock && advDuctBlock.parentNode !== techAnalysisSlot) techAnalysisSlot.appendChild(advDuctBlock);

  var projUpGroup = G('proj-up-group');
  var projLineTotal = G('proj-line-total');
  if(projUpGroup && projLineTotal){
    var pricingCard = G('quote-proj-pricing-card');
    if(!pricingCard){
      pricingCard = document.createElement('div');
      pricingCard.className = 'quote-proj-pricing-card';
      pricingCard.id = 'quote-proj-pricing-card';
      pricingCard.innerHTML =
        '<div class="sec-ttl" id="quote-proj-pricing-ttl">'+(lang==='ar'?'التسعير':'Pricing')+'</div>'+
        '<div class="quote-proj-pricing-grid" id="quote-proj-pricing-grid"></div>';
    }
    var pricingGrid = pricingCard.querySelector('#quote-proj-pricing-grid');
    if(pricingCard.parentNode !== quoteProjPricingInlineSlot) quoteProjPricingInlineSlot.appendChild(pricingCard);
    if(pricingGrid && projUpGroup.parentNode !== pricingGrid) pricingGrid.appendChild(projUpGroup);
    if(pricingGrid && projLineTotal.parentNode !== pricingGrid) pricingGrid.appendChild(projLineTotal);
  }
  updateQuoteModeAuxVisibility();
}

function updateQuoteModeAuxVisibility(){
  var quoteProjPricingSlot = G('quote-proj-pricing-slot');
  if(quoteProjPricingSlot) quoteProjPricingSlot.style.display = (quoteMode === 'proj') ? '' : 'none';
  var quoteProjPricingInlineSlot = G('quote-proj-pricing-inline-slot');
  if(quoteProjPricingInlineSlot) quoteProjPricingInlineSlot.style.display = (quoteMode === 'proj') ? '' : 'none';
  var quoteProjPricingCard = G('quote-proj-pricing-card');
  if(quoteProjPricingCard) quoteProjPricingCard.style.display = (quoteMode === 'proj') ? '' : 'none';
  var projUpGroup = G('proj-up-group');
  if(projUpGroup){
    var inQuotePricing = !!projUpGroup.closest('#quote-proj-pricing-card, #quote-proj-pricing-inline-slot, #quote-proj-pricing-grid');
    projUpGroup.style.display = (quoteMode === 'proj' && inQuotePricing) ? '' : 'none';
  }
}

// ── DROPDOWN ──────────────────────────────────────────────────────────────
function toggleDD(id){
  var m = G(id);
  if(!m) return;

  var open = m.classList.contains('show');
  closeAllDD();

  if(!open){
    m.classList.add('show');
    var fType = G('f-type');
    if(fType) fType.classList.add('open');
  }
}

function closeAllDD(){
  document.querySelectorAll('.dd-menu.show').forEach(function(m){
    m.classList.remove('show');
  });

  var ft = G('f-type');
  if(ft) ft.classList.remove('open');
}
document.addEventListener('click',function(e){
  if(!e.target.closest('.dd-wrap')) closeAllDD();
});
var ROOM_GROUP_ORDER = {
  general:['r_office','r_residential','r_retail','r_kitchen','r_server','r_classroom','r_gym','r_mosque','r_restaurant'],
  healthcare:['h_patient_room','h_corridor','h_or','h_or_sub','h_icu','h_ccu','h_emergency','h_exam','h_treatment','h_medication','h_isolation','h_airborne','h_protective','h_nicu','h_nursery','h_labor','h_lab','h_pathology','h_autopsy','h_radiology','h_mri','h_dialysis','h_cath_lab','h_cardiac_cath','h_ep_lab','h_ir_lab','h_neuro_angio','h_hybrid_or','h_sterile_decontam','h_sterile_clean','h_sterile_storage','h_dental','h_physio','h_waiting','h_nurse','h_pharmacy','h_hkitchen','h_soiled','h_clean','h_toilet','h_records']
};
function renderRoomDropdown(){
  var dd = G('dd-room');
  if(!dd || !ROOMS) return;
  function roomBadge(room){
    return room.mode === 'hc' ? 'ASHRAE' : 'BTU/m³';
  }
  function roomSub(room){
    if(room.mode === 'hc'){
      var pressure = room.pres === 'positive'
        ? (lang === 'ar' ? 'ضغط موجب' : 'Positive')
        : room.pres === 'negative'
          ? (lang === 'ar' ? 'ضغط سالب' : 'Negative')
          : (lang === 'ar' ? 'ضغط محايد' : 'Neutral');
      return room.oach + ' OA · ' + room.tach + ' ACH · ' + pressure;
    }
    return lang === 'ar' ? 'تقدير سريع بمعامل حمل' : 'Quick load factor estimate';
  }
  function itemHtml(roomId){
    var room = ROOMS[roomId];
    if(!room) return '';
    var selected = curRoom && curRoom.id === roomId ? ' sel' : '';
    return '<div class="dd-item'+selected+'" onclick="pickRoom(this,\''+roomId+'\')">'+
      '<div class="dd-item-info"><div>'+rLabel(room)+'</div><div class="dd-item-sub">'+roomSub(room)+'</div></div>'+
      '<span class="dd-badge">'+roomBadge(room)+'</span></div>';
  }
  var generalHdr = lang === 'ar' ? 'عام — معامل حمل' : 'General — Load Factor';
  var hcHdr = lang === 'ar' ? 'رعاية صحية — ASHRAE' : 'Healthcare — ASHRAE';
  dd.innerHTML =
    '<div class="dd-cat-hdr">'+generalHdr+'</div>'+
    ROOM_GROUP_ORDER.general.map(itemHtml).join('')+
    '<div class="dd-cat-hdr">'+hcHdr+'</div>'+
    ROOM_GROUP_ORDER.healthcare.map(itemHtml).join('');
}
function pickRoom(el,rid){
  var r=ROOMS[rid]; if(!r) return;
  curRoom=r;
  document.querySelectorAll('#dd-room .dd-item').forEach(function(i){i.classList.remove('sel');});
  if(el) el.classList.add('sel');
  closeAllDD();
  G('dt').textContent=rLabel(r);
  setFreshAirMode('ashrae');
  syncLoadFactorFromRoom(r);
  updateCalculationModeUI(r);
  clearRoomDimensionInputs();
  G('inp-vol').value=''; G('inp-ppl').value='';
  var roomKey = inferRoomStandardKey(curRoom);
  applyRoomEquipmentPreset(roomKey);
  renderDevs();
  G('breakdown').classList.remove('show');
  G('hc-card').style.display='none';
  flash('vtr','0.00'); flash('vcfm','0'); flash('vbtu','0'); flash('vmkt','0');
}

// Expose inline HTML handlers explicitly.
window.goPanel = goPanel;
window.toggleDD = toggleDD;
window.closeAllDD = closeAllDD;
window.pickRoom = pickRoom;
window.stepRoomNumber = stepRoomNumber;
window.onRoomCountInput = onRoomCountInput;
window.onLoadFactorPresetChange = onLoadFactorPresetChange;
window.onLoadFactorInput = onLoadFactorInput;
window.onPplInput = onPplInput;
window.onDimInput = onDimInput;
window.onVolInput = onVolInput;
window.setResultsMode = setResultsMode;
window.toggleCalcRoom = toggleCalcRoom;
window.stepProjQty = stepProjQty;
window.setProjQtyManual = setProjQtyManual;
window.setProjectQtyAuto = setProjectQtyAuto;
window.openModal = openModal;
window.closeModal = closeModal;
window.overlayClick = overlayClick;
window.filterTab = filterTab;
window.doCalc = doCalc;
window.addToQuote = addToQuote;
window.stepQuoteQty = stepQuoteQty;
window.setQtyAuto = setQtyAuto;
window.setQty = setQty;
window.setUp = setUp;
window.setUnitType = setUnitType;
window.setSelBtu = setSelBtu;
window.editRec = editRec;
window.delRec = delRec;
window.toggleVAT = toggleVAT;
window.onFreshAirModeChange = onFreshAirModeChange;
window.exportHAP = exportHAP;

// ── DEVICES ───────────────────────────────────────────────────────────────
function totalDevBtu(){
  return devs.reduce(function(s,d){
    var c=DEVS.filter(function(x){return x.id===d.id;})[0];
    return s+(c?w2b(c.w)*d.qty:0);
  },0);
}
function renderDevs(){
  var list=G('dev-list'); list.innerHTML='';
  if(!devs.length){
    var em=document.createElement('div'); em.className='dev-empty'; em.textContent=t('dempty');
    list.appendChild(em); G('dev-total').style.display='none'; return;
  }
  devs.forEach(function(d){
    var c=DEVS.filter(function(x){return x.id===d.id;})[0]; if(!c) return;
    var name=lang==='ar'?c.ar:c.en;
    var btu=w2b(c.w)*d.qty;
    var row=document.createElement('div'); row.className='dev-row';
    row.innerHTML='<div class="dev-ico">'+c.e+'</div>'+
      '<div class="dev-info"><div class="dev-name">'+name+'</div><div class="dev-watt">'+c.w+'W × '+d.qty+' = '+(c.w*d.qty).toLocaleString()+'W</div></div>'+
      '<div class="dev-qty">'+
        '<div class="qbtn" onclick="chgQty(\''+d.id+'\',-1)">−</div>'+
        '<div class="qnum">'+d.qty+'</div>'+
        '<div class="qbtn" onclick="chgQty(\''+d.id+'\',1)">+</div>'+
      '</div>'+
      '<div class="dev-btu">'+btu.toLocaleString()+' BTU/h</div>'+
      '<div class="dev-del" onclick="delDev(\''+d.id+'\')">🗑</div>';
    list.appendChild(row);
  });
  G('dev-total').style.display='flex';
  G('val-dtot').textContent=totalDevBtu().toLocaleString()+' BTU/h';
}
function chgQty(id,d){
  for(var i=0;i<devs.length;i++){if(devs[i].id===id){devs[i].qty+=d;if(devs[i].qty<=0)devs.splice(i,1);break;}}
  renderDevs();
}
function delDev(id){ devs=devs.filter(function(d){return d.id!==id;}); renderDevs(); }

// ── MODAL ─────────────────────────────────────────────────────────────────
function openModal(){ buildGrid(null); document.querySelectorAll('.ftab').forEach(function(t,i){t.className='ftab'+(i===0?' on':'');}); G('overlay').classList.add('on'); }
function closeModal(){ G('overlay').classList.remove('on'); }
function overlayClick(e){ if(e.target===G('overlay')) closeModal(); }
function filterTab(el,grp){ document.querySelectorAll('.ftab').forEach(function(t){t.className='ftab';}); el.className='ftab on'; buildGrid(grp); }
var gLabel={office:{ar:'🏢 Office',en:'🏢 Office'},light:{ar:'💡 Lighting',en:'💡 Lighting'},home:{ar:'🏠 Domestic',en:'🏠 Domestic'},health:{ar:'🏥 Healthcare',en:'🏥 Healthcare'}};
function allowedGroups(){
  if(!curRoom) return ['office','light','home','health'];
  if(curRoom.cat==='healthcare') return ['health','light'];
  if(curRoom.cat==='home') return ['home','light','office'];
  return ['office','light','home'];
}
function buildGrid(grp){
  var grid=G('cat-grid'); grid.innerHTML='';
  var ag=allowedGroups();
  var groups=grp&&ag.indexOf(grp)!==-1?[grp]:ag;
  groups.forEach(function(gk){
    var items=DEVS.filter(function(d){return d.g===gk;}); if(!items.length) return;
    var hdr=document.createElement('div'); hdr.className='cat-hdr'; hdr.textContent=gLabel[gk][lang]; grid.appendChild(hdr);
    items.forEach(function(d){
      var wl=d.w>=1000?(d.w/1000).toFixed(1)+'kW':d.w+'W';
      var card=document.createElement('div'); card.className='cat-item';
      card.innerHTML='<div class="cat-ico">'+d.e+'</div><div class="cat-name">'+(lang==='ar'?d.ar:d.en)+'</div><div class="cat-w">'+wl+'</div><div class="cat-btu">'+w2b(d.w).toLocaleString()+' BTU/h</div>';
      (function(did,dname){
        card.onclick=function(){
          var found=false;
          for(var i=0;i<devs.length;i++){if(devs[i].id===did){devs[i].qty++;found=true;break;}}
          if(!found) devs.push({id:did,qty:1});
          closeModal(); renderDevs(); toast('✅ '+dname+' +1');
        };
      })(d.id,lang==='ar'?d.ar:d.en);
      grid.appendChild(card);
    });
  });
}


function _fallbackAppRooms(){
  return {
    inferRoomStandardKey:function(room){
      if(!room) return 'office';
      var rid=(room.id||'').toLowerCase();
      var en=(room.en||'').toLowerCase();
      if(rid.indexOf('operating')>=0 || en.indexOf('operating room')>=0) return 'operating_room';
      if(rid.indexOf('icu')>=0 || en.indexOf('icu')>=0) return 'icu';
      if(rid.indexOf('nicu')>=0 || en.indexOf('nicu')>=0) return 'nicu';
      if(rid.indexOf('isolation')>=0 || en.indexOf('isolation')>=0) return 'isolation_room';
      if(rid.indexOf('protective')>=0 || en.indexOf('protective')>=0) return 'protective_environment';
      if(rid.indexOf('emergency')>=0 || en.indexOf('emergency')>=0) return 'emergency_exam';
      if(rid.indexOf('patient')>=0 || en.indexOf('patient')>=0) return 'patient_room';
      if(rid.indexOf('exam')>=0 || en.indexOf('exam')>=0) return 'exam_room';
      if(rid.indexOf('treatment')>=0 || en.indexOf('treatment')>=0) return 'treatment_room';
      if(rid.indexOf('cath')>=0 || rid.indexOf('ep_')>=0 || rid.indexOf('hybrid')>=0 || en.indexOf('catheterization')>=0 || en.indexOf('electrophysiology')>=0 || en.indexOf('interventional radiology')>=0 || en.indexOf('angiography')>=0 || en.indexOf('hybrid or')>=0) return 'radiology';
      if(rid.indexOf('lab')>=0 || en.indexOf('laboratory')>=0 || en.indexOf('lab')>=0) return 'laboratory';
      if(rid.indexOf('pharmacy')>=0 || en.indexOf('pharmacy')>=0) return 'pharmacy_clean';
      if(rid.indexOf('sterile')>=0 || en.indexOf('sterile')>=0 || en.indexOf('cssd')>=0) return 'sterile_processing';
      if(rid.indexOf('wait')>=0 || en.indexOf('waiting')>=0) return 'waiting_area';
      if(rid.indexOf('corridor')>=0 || en.indexOf('corridor')>=0) return 'corridor';
      return 'office';
    },
    getRoomStandard:function(room){
      var key=this.inferRoomStandardKey(room);
      return ROOM_STANDARDS[key] || {
        category:'unknown',
        roomType:room ? (room.en||room.ar||'Room') : 'Room',
        ach:null, oa:null, exhaust:null, pressure:'Neutral', notes:'No standard linked'
      };
    },
    getRecommendedEquipmentIds:function(room){
      var key=this.inferRoomStandardKey(room);
      return ROOM_EQUIPMENT_PRESETS[key] || [];
    },
    applyRoomEquipmentPreset:function(roomKey){
      var preset=ROOM_EQUIPMENT_PRESETS[roomKey];
      if(!preset || !Array.isArray(preset)) return;
      devs=preset.map(function(item){
        return typeof item==='string' ? {id:item,qty:1} : {id:item.id,qty:item.qty||1};
      }).filter(function(x){ return !!x.id; });
    },
    getEquipmentSummary:function(){
      var items=(devs||[]).map(function(d){
        var c=DEVS.filter(function(x){ return x.id===d.id; })[0];
        return c ? {
          id:d.id,
          name:(lang==='ar'?c.ar:c.en),
          qty:d.qty||1,
          watt:(c.w||0)*(d.qty||1),
          btu:Math.round((c.w||0)*3.412*(d.qty||1)),
          group:c.g||''
        } : null;
      }).filter(Boolean);
      return {
        items:items,
        totalBtu:items.reduce(function(s,x){ return s+(x.btu||0); },0),
        totalWatt:items.reduce(function(s,x){ return s+(x.watt||0); },0),
        text:items.map(function(x){ return x.name+'×'+x.qty; }).join(' | ')
      };
    },
    getEquipmentGroupLabel:function(g){
      var map={
        office:{ar:'مكتبي',en:'Office'},
        light:{ar:'إنارة',en:'Lighting'},
        home:{ar:'منزلي',en:'Domestic'},
        health:{ar:'رعاية صحية',en:'Healthcare'},
        medical:{ar:'أجهزة طبية',en:'Medical Equipment'},
        lab:{ar:'أجهزة مختبر',en:'Laboratory Equipment'},
        support:{ar:'دعم سريري',en:'Clinical Support'}
      };
      var item=map[g] || {ar:g||'عام',en:g||'General'};
      return lang==='ar' ? item.ar : item.en;
    },
    getPressureLabel:function(p){
      var v=(p||'neutral').toLowerCase();
      if(v==='positive') return lang==='ar' ? 'ضغط موجب' : 'Positive';
      if(v==='negative') return lang==='ar' ? 'ضغط سالب' : 'Negative';
      return lang==='ar' ? 'متعادل' : 'Neutral';
    },
    getCategoryLabel:function(cat){
      var map={
        inpatient:{ar:'تنويم',en:'Inpatient'},
        critical:{ar:'رعاية حرجة',en:'Critical Care'},
        procedure:{ar:'إجراءات',en:'Procedure'},
        diagnostic:{ar:'تشخيص',en:'Diagnostic'},
        support:{ar:'خدمات مساندة',en:'Support'},
        public:{ar:'عام',en:'Public'},
        unknown:{ar:'غير مصنف',en:'Uncategorized'}
      };
      var item=map[cat] || {ar:cat||'غير مصنف',en:cat||'Uncategorized'};
      return lang==='ar' ? item.ar : item.en;
    }
  };
}

function _appRooms(){
  return window.AppRooms || _fallbackAppRooms();
}

function inferRoomStandardKey(room){
  return _appRooms().inferRoomStandardKey(room);
}

function getRoomStandard(room){
  return _appRooms().getRoomStandard(room);
}

function getRecommendedEquipmentIds(room){
  return _appRooms().getRecommendedEquipmentIds(room);
}

function applyRoomEquipmentPreset(roomKey){
  return _appRooms().applyRoomEquipmentPreset(roomKey);
}

function getEquipmentSummary(){
  return _appRooms().getEquipmentSummary();
}

function getEquipmentGroupLabel(g){
  return _appRooms().getEquipmentGroupLabel(g);
}

function getPressureLabel(p){
  return _appRooms().getPressureLabel(p);
}

function getCategoryLabel(cat){
  return _appRooms().getCategoryLabel(cat);
}

function updateRoomStandardCard(std, cfmValue){
  var card = G('hc-card');
  if(!card) return;

  var ttl = G('hcttl');
  if(ttl) ttl.textContent = lang==='ar' ? 'معايير الغرفة والتهوية' : 'Room Standards & Ventilation';

  var achEl = G('hcv-ach');
  if(achEl) achEl.textContent = std && std.ach != null ? std.ach : '—';

  var supEl = G('hcv-sup');
  if(supEl) supEl.textContent = cfmValue != null ? Number(cfmValue).toLocaleString() : '—';

  var oaEl = G('hcv-oa');
  if(oaEl) oaEl.textContent = std && std.oa != null ? String(std.oa) : '—';
  var recEl = G('hcv-rec');
  if(recEl) recEl.textContent = std && std.recirc != null ? String(std.recirc) : '—';

  var exhEl = G('hcv-exh');
  if(exhEl) exhEl.textContent = std && std.exhaust != null ? String(std.exhaust) : '—';

  var pill = G('hc-pill');
  if(pill){
    var p = std && std.pressure ? std.pressure : 'Neutral';
    pill.textContent = getPressureLabel(p);
    pill.className = 'hc-pill ' + (p === 'Positive' ? 'pos' : p === 'Negative' ? 'neg' : 'neu');
  }

  var noteRow = G('hc-note-row');
  var noteVal = G('hcv-note');
  if(noteRow && noteVal){
    var noteText = '';
    if(std){
      noteText = (lang==='ar' ? 'الفئة: ' : 'Category: ') + getCategoryLabel(std.category) + (std.notes ? ' | ' + std.notes : '');
    }
    if(noteText){
      noteRow.style.display = '';
      noteVal.textContent = noteText;
    } else {
      noteRow.style.display = 'none';
    }
  }
}

// ── CALCULATION ───────────────────────────────────────────────────────────
function normalizeNumericInput(el){
  if(!el) return '';
  el.value=(el.value||'')
    .replace(/[٠-٩]/g,function(d){return '٠١٢٣٤٥٦٧٨٩'.indexOf(d);})
    .replace(/[۰-۹]/g,function(d){return '۰۱۲۳۴۵۶۷۸۹'.indexOf(d);})
    .replace(/[٫,]/g,'.')
    .replace(/[^0-9.]/g,'')
    .replace(/(\..*)\./g,'$1');
  return el.value;
}
function readRoomDimensions(){
  var lenEl=G('inp-len'), widthEl=G('inp-width'), heightEl=G('inp-height');
  var len=parseFloat(normalizeNumericInput(lenEl))||0;
  var width=parseFloat(normalizeNumericInput(widthEl))||0;
  var height=parseFloat(normalizeNumericInput(heightEl))||0;
  return {
    len:len,
    width:width,
    height:height,
    hasAny:len>0||width>0||height>0,
    complete:len>0&&width>0&&height>0
  };
}
function formatVolumeValue(vol){
  if(!vol) return '';
  var rounded=Math.round(vol*10)/10;
  return Number.isInteger(rounded)?String(rounded):rounded.toFixed(1);
}
function setLegacyRoomVolume(vol){
  var volEl=G('inp-vol');
  if(!volEl) return;
  var numeric=parseFloat(vol)||0;
  if(numeric>0){
    volEl.dataset[LEGACY_VOL_KEY]=String(numeric);
    volEl.value=formatVolumeValue(numeric);
  } else {
    delete volEl.dataset[LEGACY_VOL_KEY];
    volEl.value='';
  }
}
function setRoomVolumeFromDimensions(){
  var dims=readRoomDimensions();
  var volEl=G('inp-vol');
  if(dims.complete){
    var vol=dims.len*dims.width*dims.height;
    var displayVol=parseFloat(formatVolumeValue(vol))||0;
    if(volEl) volEl.value=formatVolumeValue(displayVol);
    if(volEl) delete volEl.dataset[LEGACY_VOL_KEY];
    lastRoomDims={len:dims.len,width:dims.width,height:dims.height};
    return {volume:displayVol,dims:lastRoomDims,complete:true,source:'dimensions'};
  }
  if(dims.hasAny){
    if(volEl) volEl.value='';
    if(volEl) delete volEl.dataset[LEGACY_VOL_KEY];
    lastRoomDims=null;
    return {volume:0,dims:null,complete:false,source:'incomplete'};
  }
  if(volEl && volEl.dataset[LEGACY_VOL_KEY]){
    var legacyVol=parseFloat(volEl.dataset[LEGACY_VOL_KEY])||0;
    volEl.value=formatVolumeValue(legacyVol);
    lastRoomDims=null;
    return {volume:legacyVol,dims:null,complete:false,source:'legacy'};
  }
  if(volEl) volEl.value='';
  lastRoomDims=null;
  return {volume:0,dims:null,complete:false,source:'empty'};
}
function clearRoomDimensionInputs(){
  ['inp-len','inp-width','inp-height'].forEach(function(id){
    var el=G(id);
    if(el) el.value='';
  });
  lastRoomDims=null;
  setLegacyRoomVolume(0);
}
function setRoomDimensionInputs(dims){
  clearRoomDimensionInputs();
  if(!dims) return;
  if(G('inp-len')) G('inp-len').value=dims.len||'';
  if(G('inp-width')) G('inp-width').value=dims.width||'';
  if(G('inp-height')) G('inp-height').value=dims.height||'';
  setRoomVolumeFromDimensions();
}
function onDimInput(){ setRoomVolumeFromDimensions(); }
function onVolInput(){ setRoomVolumeFromDimensions(); }
function onPplInput(){ normalizeNumericInput(G('inp-ppl')); }
function stepRoomNumber(id, delta, min){
  var el=G(id);
  if(!el) return;
  normalizeNumericInput(el);
  var current=parseInt(el.value,10);
  if(isNaN(current)) current=min||0;
  var next=Math.max(min||0,current+delta);
  el.value=String(next);
  if(id==='inp-room-count') onRoomCountInput();
  if(id==='inp-ppl') onPplInput();
}

function onRoomCountInput(){
  var el=G('inp-room-count');
  if(!el) return;
  normalizeNumericInput(el);
  el.value=(el.value||'').replace(/[^\d]/g,'');
  if(!el.value) return;
  var n=parseInt(el.value,10);
  if(isNaN(n)) return;
  el.value=String(Math.max(0,n));
}

function setLoadFactorPresetValue(factor){
  var presetEl = G('inp-load-factor-preset');
  if(!presetEl) return;
  var key = String(parseInt(factor,10)||'');
  if(key==='220' || key==='260' || key==='300' || key==='340') presetEl.value = key;
  else presetEl.value = factor ? 'custom' : '';
  setLoadFactorInputMode(presetEl.value === 'custom');
}

function setLoadFactorInputMode(isCustom){
  var inputEl = G('inp-load-factor');
  if(!inputEl) return;
  inputEl.readOnly = !isCustom;
  inputEl.classList.toggle('readonly-like', !isCustom);
}

function syncLoadFactorFromRoom(room){
  var inputEl = G('inp-load-factor');
  if(!inputEl) return;
  var factor = room && room.factor ? Number(room.factor) : 0;
  inputEl.value = factor ? String(factor) : '';
  setLoadFactorPresetValue(factor);
}

function setFreshAirMode(mode){
  hcFreshAirMode = mode === 'fresh100' ? 'fresh100' : 'ashrae';
  var sel = G('inp-fresh-air-mode');
  if(sel) sel.value = hcFreshAirMode;
  var warning = G('fresh-air-warning');
  if(warning){
    if(curRoom && curRoom.mode === 'hc' && hcFreshAirMode === 'fresh100'){
      warning.style.display = '';
      warning.innerHTML = '<strong>'+t('freshair100')+'</strong><span>'+t('freshairwarning')+'</span>';
    } else {
      warning.style.display = 'none';
      warning.textContent = '';
    }
  }
}

function onFreshAirModeChange(){
  var sel = G('inp-fresh-air-mode');
  setFreshAirMode(sel ? sel.value : 'ashrae');
}

function updateCalculationModeUI(room){
  var row = G('load-factor-row');
  var helper = G('load-factor-helper');
  var note = G('calc-mode-note');
  var freshAirRow = G('fresh-air-row');
  var isHC = !!(room && room.mode === 'hc');
  if(row) row.style.display = isHC ? 'none' : '';
  if(helper) helper.style.display = isHC ? 'none' : '';
  if(freshAirRow) freshAirRow.style.display = isHC ? '' : 'none';
  if(!note) return;
  if(!room){
    note.style.display = 'none';
    note.textContent = '';
    note.className = 'calc-mode-note';
    setFreshAirMode('ashrae');
    return;
  }
  note.style.display = '';
  note.className = 'calc-mode-note ' + (isHC ? 'hc' : 'rot');
  note.innerHTML = isHC
    ? '<strong>'+t('cmhc')+'</strong><span>'+t('cmhcsub')+'</span>'
    : '<strong>'+t('cmrot')+'</strong><span>'+t('cmrotsub')+'</span>';
  setFreshAirMode(getFreshAirMode());
}

function onLoadFactorPresetChange(){
  var presetEl = G('inp-load-factor-preset');
  var inputEl = G('inp-load-factor');
  if(!presetEl || !inputEl) return;
  var val = presetEl.value;
  setLoadFactorInputMode(val === 'custom');
  if(val === 'custom') return;
  if(!val){
    inputEl.value = '';
    return;
  }
  inputEl.value = String(val);
}

function onLoadFactorInput(){
  var inputEl = G('inp-load-factor');
  if(!inputEl) return;
  if(inputEl.readOnly) return;
  normalizeNumericInput(inputEl);
  var raw = (inputEl.value||'').replace(/[^\d.]/g,'');
  inputEl.value = raw;
  if(!raw){
    setLoadFactorPresetValue('');
    return;
  }
  var factor = parseFloat(raw);
  if(isNaN(factor)) return;
  factor = Math.max(100, Math.min(800, factor));
  inputEl.value = String(Math.round(factor));
  setLoadFactorPresetValue(Math.round(factor));
}

function getFreshAirMode(){
  return hcFreshAirMode === 'fresh100' ? 'fresh100' : 'ashrae';
}

function getSelectedLoadFactor(){
  var inputEl = G('inp-load-factor');
  var raw = inputEl ? parseFloat(inputEl.value) : NaN;
  if(!isNaN(raw) && raw >= 100 && raw <= 800) return raw;
  return curRoom && curRoom.factor ? Number(curRoom.factor) : 260;
}

function getRoomCount(){
  var el=G('inp-room-count');
  var n=el?parseInt(el.value,10):1;
  return Math.max(1,n||1);
}
function doCalc(){
  var wasEditing = editIdx >= 0;
  var volState=setRoomVolumeFromDimensions();
  var vol=volState.volume||0;
  var ppl=parseInt(G('inp-ppl').value)||0;
  if(!curRoom){
    toast(lang==='ar'?'⚠️ اختر نوع الغرفة أولاً':'⚠️ Select room type first');
    return;
  }
  if(!vol){ toast(t('tnov')); return; }
  if(curRoom.mode==='hc') calcHC(vol,ppl);
  else calcROT(vol,ppl);
  if(!wasEditing){
    setTimeout(function(){
      resetCalcEntryForm();
    }, 0);
  }
}
function calcROT(vol,ppl){
  var loadFactor = getSelectedLoadFactor();
  var base=vol*loadFactor, pplb=ppl*400, devb=totalDevBtu();
  var sub=base+pplb+devb, total=sub*1.10;
  var tr=total/12000, cfm=Math.round(tr*400), mkt=Math.ceil(total/9000)*9000;
  var std=getRoomStandard(curRoom);
  flash('vtr',tr.toFixed(2)); flash('vcfm',cfm.toLocaleString()); flash('vbtu',Math.round(total).toLocaleString()); flash('vmkt',mkt.toLocaleString());
  G('brv-vol').textContent=vol; G('brv-base').textContent=Math.round(base).toLocaleString();
  G('brv-ppl').textContent=Math.round(pplb).toLocaleString(); G('brv-dev').textContent=Math.round(devb).toLocaleString();
  G('brv-sub').textContent=Math.round(sub).toLocaleString(); G('brv-sf').textContent=Math.round(total).toLocaleString();
  G('breakdown').classList.add('show');
  updateRoomStandardCard(std, cfm);
  G('hc-card').style.display='block';
  saveHist(vol,ppl,tr,cfm,total,mkt,devb,{
    loadFactor: loadFactor,
    category: std.category,
    roomType: std.roomType,
    ach: std.ach,
    oa: std.oa,
    exhaust: std.exhaust,
    pressure: std.pressure,
    notes: std.notes
  });
  showCalcQuoteAction();
  toast(t('tcalc'));
}
function calcHC(vol,ppl){
  var r=curRoom, ft3=m3toft3(vol);
  var loadFactor = getSelectedLoadFactor();
  var freshMode = getFreshAirMode();
  var sup=Math.round((r.tach*ft3)/60), oa=freshMode === 'fresh100' ? Math.round((r.tach*ft3)/60) : Math.round((r.oach*ft3)/60);
  var recirc=Math.max(0,sup-oa);
  var exh=r.pres==='negative'?Math.round(sup*1.10):r.pres==='positive'?Math.round(sup*0.90):sup;
  var base=sup*1.08*20, pplb=ppl*400, devb=totalDevBtu();
  var sub=base+pplb+devb, total=sub*1.10;
  var tr=total/12000, mkt=Math.ceil(total/9000)*9000;
  flash('vtr',tr.toFixed(2)); flash('vcfm',sup.toLocaleString()); flash('vbtu',Math.round(total).toLocaleString()); flash('vmkt',mkt.toLocaleString());
  G('brv-vol').textContent=vol; G('brv-base').textContent=Math.round(base).toLocaleString();
  G('brv-ppl').textContent=Math.round(pplb).toLocaleString(); G('brv-dev').textContent=Math.round(devb).toLocaleString();
  G('brv-sub').textContent=Math.round(sub).toLocaleString(); G('brv-sf').textContent=Math.round(total).toLocaleString();
  G('breakdown').classList.add('show');
  var pill=G('hc-pill');
  var pk=r.pres==='positive'?'ppos':r.pres==='negative'?'pneg':'pneu';
  pill.textContent=t(pk); pill.className='hc-pill '+(r.pres==='positive'?'pos':r.pres==='negative'?'neg':'neu');
  G('hc-temp').textContent=r.tr[0]+'–'+r.tr[1]+' °C';
  G('hc-rh').textContent=r.rh[0]+'–'+r.rh[1]+'% RH';
  G('hcv-ach').textContent=r.tach; G('hcv-sup').textContent=sup.toLocaleString();
  G('hcv-oa').textContent=oa.toLocaleString(); G('hcv-rec').textContent=recirc.toLocaleString(); G('hcv-exh').textContent=exh.toLocaleString();
  if(r.note || freshMode === 'fresh100'){
    G('hc-note-row').style.display='';
    G('hcv-note').textContent = [r.note || '', freshMode === 'fresh100' ? t('freshairwarning') : ''].filter(Boolean).join(' | ');
  }else{G('hc-note-row').style.display='none';}
  G('hc-card').style.display='block';
  saveHist(vol,ppl,tr,sup,total,mkt,devb,{
    loadFactor: loadFactor,
    sup:sup,
    oa:oa,
    recirc:recirc,
    exh:exh,
    pres:r.pres,
    freshAirMode:freshMode,
    category:'support_clinical',
    roomType:r.en || r.ar || 'Healthcare Room',
    ach:r.tach || null,
    oa:r.oach || null,
    exhaust:exh || null,
    pressure:r.pres || 'Neutral',
    notes:r.note || ''
  });
  showCalcQuoteAction();
  toast(t('tcalc'));
}

// ── HISTORY ───────────────────────────────────────────────────────────────
function saveHist(vol,ppl,tr,cfm,totalBtu,mkt,devBtu,hcdata){
  var eq = getEquipmentSummary();
  var roomCount = getRoomCount();
  var rec={
    time:new Date().toLocaleString('ar-SA'),
    rid:curRoom.id, ar:curRoom.ar, en:curRoom.en,
    vol:vol, ppl:ppl, roomCount:roomCount, loadFactor:getSelectedLoadFactor(),
    calcMode: curRoom && curRoom.mode === 'hc' ? 'hc' : 'rot',
    dims:lastRoomDims,
    devSum:eq.text,
    devBtu:eq.totalBtu,
    equipmentItems:eq.items,
    equipmentBtu:eq.totalBtu,
    equipmentWatt:eq.totalWatt,
    tr:tr.toFixed(2), cfm:cfm, btu:Math.round(totalBtu), mkt:mkt
  };
  if(hcdata){
    if(hcdata.loadFactor != null) rec.loadFactor = hcdata.loadFactor;
    rec.sup=hcdata.sup;
    rec.oa=hcdata.oa;
    rec.recirc=hcdata.recirc;
    rec.exh=hcdata.exh;
    rec.pres=hcdata.pres;
    rec.freshAirMode=hcdata.freshAirMode;
    rec.category=hcdata.category;
    rec.roomType=hcdata.roomType;
    rec.ach=hcdata.ach;
    rec.oaStd=hcdata.oa;
    rec.exhaust=hcdata.exhaust;
    rec.pressure=hcdata.pressure;
    rec.notes=hcdata.notes;
  }
  if(editIdx>=0&&editIdx<hist.length){
    var _editAt=editIdx;
    hist[_editAt]=rec; editIdx=-1;
    calcRoomsOpenIdx = _editAt;
    ensureQuoteLine(_editAt);
    syncQuoteLineRecommendation(_editAt,{keepSelectedCapacity:getQtyAuto(_editAt)});
  } else {
    hist.push(rec);
    var _pUT=(qlines.length>0?qlines[qlines.length-1].unitType:'')||'split';
    var _newIdx=hist.length-1;
    calcRoomsOpenIdx = _newIdx;
    qlines.push({qty:1,up:0,unitType:_pUT,selectedBtu:0,qtyAuto:true,autoReason:''});
    syncQuoteLineRecommendation(_newIdx,{unitType:_pUT});
    if(hist.length>100){hist.shift();qlines.shift();}
  }
  syncProjectRecommendation({keepSelectedCapacity:getProjectQtyAuto()});
  save(); renderHist();
  updateDirectResults();
  if(window.AppProjects&&window.AppProjects.updateNavDots) window.AppProjects.updateNavDots();
}

function resetCalcEntryForm(){
  curRoom = null;
  document.querySelectorAll('#dd-room .dd-item').forEach(function(item){
    item.classList.remove('sel');
  });
  var dtEl = G('dt'); if(dtEl) dtEl.textContent = '—';
  clearRoomDimensionInputs();
  var lenEl = G('inp-len'); if(lenEl) lenEl.value = '';
  var widthEl = G('inp-width'); if(widthEl) widthEl.value = '';
  var heightEl = G('inp-height'); if(heightEl) heightEl.value = '';
  var volEl = G('inp-vol'); if(volEl) volEl.value = '';
  var pplEl = G('inp-ppl'); if(pplEl) pplEl.value = '';
  var roomCountEl = G('inp-room-count'); if(roomCountEl) roomCountEl.value = '0';
  var loadFactorEl = G('inp-load-factor'); if(loadFactorEl) loadFactorEl.value = '';
  var loadFactorPresetEl = G('inp-load-factor-preset'); if(loadFactorPresetEl) loadFactorPresetEl.value = '';
  setFreshAirMode('ashrae');
  updateCalculationModeUI(null);
  devs = [];
  renderDevs();
  G('breakdown').classList.remove('show');
  G('hc-card').style.display='none';
}

function toggleCalcRoom(idx){
  calcRoomsOpenIdx = (calcRoomsOpenIdx === idx) ? -1 : idx;
  renderCalcRooms();
}

function calcRoomDetailHtml(h, idx){
  var rc = Math.max(1,parseInt(h.roomCount,10)||1);
  var dimsLine = '';
  if(h.dims && (h.dims.len || h.dims.width || h.dims.height)){
    dimsLine = '<div class="calc-room-detail-row calc-room-detail-row-wide calc-room-detail-dims"><span class="calc-room-detail-lbl">'+(lang==='ar'?'الأبعاد':'Dimensions')+'</span><span class="calc-room-detail-val">'+
      [h.dims.len||0,h.dims.width||0,h.dims.height||0].join(' × ')+' '+(lang==='ar'?'م':'m')+
    '</span></div>';
  }
  var roomTypeLine = h.roomType ? h.roomType : ((lang==='ar'?(h.ar||h.en):(h.en||h.ar))||'');
  var hcLine = '';
  if(h.ach || h.pressure || h.oaStd || h.exhaust){
    var hcBits = [];
    if(h.ach) hcBits.push('ACH '+h.ach);
    if(h.oaStd) hcBits.push('OA '+h.oaStd);
    if(h.recirc != null) hcBits.push((lang==='ar'?'راجع':'Recirc')+' '+h.recirc);
    if(h.exhaust) hcBits.push((lang==='ar'?'عادم':'Exh')+' '+h.exhaust);
    if(h.pressure) hcBits.push((lang==='ar'?'ضغط':'Pressure')+' '+h.pressure);
    if(h.freshAirMode) hcBits.push((lang==='ar'?'هواء نقي':'Fresh Air')+' '+(h.freshAirMode==='fresh100'?(lang==='ar'?'100%':'100%'):(lang==='ar'?'ASHRAE':'ASHRAE')));
    hcLine = '<div class="calc-room-detail-note">'+hcBits.join(' · ')+'</div>';
  }
  return '<div class="calc-room-detail">'+
    '<div class="calc-room-detail-grid">'+
      '<div class="calc-room-detail-row calc-room-detail-row-wide calc-room-detail-type"><span class="calc-room-detail-lbl">'+(lang==='ar'?'نوع الغرفة':'Room Type')+'</span><span class="calc-room-detail-val">'+roomTypeLine+'</span></div>'+
      dimsLine+
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+t('calcmode')+'</span><span class="calc-room-detail-val">'+(h.calcMode==='hc'?t('ashraehc'):t('loadmode'))+'</span></div>'+
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+(lang==='ar'?'الحجم':'Volume')+'</span><span class="calc-room-detail-val">'+h.vol+' m³</span></div>'+
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+(lang==='ar'?'عدد الغرف':'Room Count')+'</span><span class="calc-room-detail-val">'+rc+'</span></div>'+
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+(lang==='ar'?'عدد الأشخاص':'People')+'</span><span class="calc-room-detail-val">'+h.ppl+'</span></div>'+
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+(lang==='ar'?'معامل الحمل':'Load Factor')+'</span><span class="calc-room-detail-val">'+Number(h.loadFactor||0).toLocaleString()+' BTU/m³</span></div>'+
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">TR</span><span class="calc-room-detail-val">'+h.tr+'</span></div>'+
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">CFM</span><span class="calc-room-detail-val">'+Number(h.cfm||0).toLocaleString()+'</span></div>'+
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">BTU/h</span><span class="calc-room-detail-val">'+Number(h.btu||0).toLocaleString()+'</span></div>'+
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+(lang==='ar'?'سعة السوق':'Market BTU')+'</span><span class="calc-room-detail-val">'+Number(h.mkt||0).toLocaleString()+'</span></div>'+
      (h.equipmentBtu?'<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+(lang==='ar'?'حمل الأجهزة':'Equipment Load')+'</span><span class="calc-room-detail-val">'+Number(h.equipmentBtu).toLocaleString()+' BTU/h</span></div>':'')+
      (h.devSum?'<div class="calc-room-detail-row calc-room-detail-row-wide calc-room-detail-equipment"><span class="calc-room-detail-lbl">'+(lang==='ar'?'الأجهزة':'Equipment')+'</span><span class="calc-room-detail-val">'+h.devSum+'</span></div>':'')+
    '</div>'+
    hcLine+
    '<div class="calc-room-detail-actions">'+
      '<button class="hact-btn calc-room-edit-btn" onclick="event.stopPropagation();editRec('+idx+')">✏️ '+(lang==='ar'?'تعديل':'Edit')+'</button>'+
      '<button class="hact-btn del-btn calc-room-del-btn" onclick="event.stopPropagation();delRec('+idx+')">🗑️ '+t('delroom')+'</button>'+
    '</div>'+
  '</div>';
}

function calcRoomListHtml(){
  return hist.map(function(h,idx){
    var _rn=lang==='ar'?(h.ar||h.en):(h.en||h.ar);
    var name=_rn.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/gu,'').trim();
    var isOpen = idx === calcRoomsOpenIdx;
    return '<div class="hist-item calc-room-item'+(isOpen?' open':'')+'">'+
      '<button type="button" class="calc-room-toggle" onclick="toggleCalcRoom('+idx+')">'+
        '<div class="hist-main">'+
          '<div class="hist-room">'+(idx+1)+'. '+name+'</div>'+
        '</div>'+
        '<div class="hist-right">'+
          '<div class="hist-tr">'+h.tr+' TR</div>'+
          '<div class="calc-room-chevron" aria-hidden="true">'+(isOpen?'▴':'▾')+'</div>'+
        '</div>'+
      '</button>'+
      (isOpen ? calcRoomDetailHtml(h, idx) : '')+
    '</div>';
  }).join('');
}

function renderCalcRooms(){
  var card=G('calc-rooms-card'), list=G('calc-rooms-list'), count=G('calc-rooms-count'), title=G('calc-rooms-title');
  if(!card||!list) return;
  if(calcRoomsOpenIdx >= hist.length) calcRoomsOpenIdx = hist.length ? hist.length - 1 : -1;
  if(count) count.textContent=hist.length;
  if(title) title.textContent=lang==='ar'?'الغرف المحسوبة':'Calculated Rooms';
  if(!hist.length){
    card.style.display='none';
    list.innerHTML='';
    return;
  }
  card.style.display='';
  list.innerHTML=calcRoomListHtml();
}

function showCalcQuoteAction(){
  renderCalcRooms();
  var aw=G('add-quote-wrap');
  if(aw) aw.style.display='none';
  setTimeout(function(){
    var target=G('calc-rooms-card');
    if(target&&target.scrollIntoView) target.scrollIntoView({behavior:'smooth',block:'nearest'});
  },40);
}

function renderHist(){
  var list=G('hist-list'); list.innerHTML='';
  G('hist-count').textContent=hist.length;
  if(!hist.length){
    var em=document.createElement('div'); em.className='hist-empty'; em.textContent=t('hempty');
    list.appendChild(em); G('cum-card').style.display='none';
    renderCalcRooms();
    renderQuote(); return;
  }
  var totTR=0,totCFM=0,totBTU=0,totMKT=0;
  hist.forEach(function(h){
    var rc=Math.max(1,parseInt(h.roomCount,10)||1);
    totTR+=(parseFloat(h.tr)||0)*rc;
    totCFM+=(h.cfm||0)*rc;
    totBTU+=(h.btu||0)*rc;
    totMKT+=(h.mkt||0)*rc;
  });
  G('cum-tr').textContent=totTR.toFixed(2); G('cum-cfm').textContent=totCFM.toLocaleString();
  G('cum-btu').textContent=totBTU.toLocaleString(); G('cum-mkt').textContent=totMKT.toLocaleString();
  G('cum-card').style.display='';
  hist.forEach(function(h,idx){
    var cfmLine=''; if(h.sup) cfmLine='S:'+h.sup+' OA:'+h.oa+' Exh:'+h.exh+' CFM';
    var _rn=lang==='ar'?(h.ar||h.en):(h.en||h.ar);
    var name=_rn.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/gu,'').trim();
    var row=document.createElement('div'); row.className='hist-item';
    row.innerHTML='<div class="hist-main">'+
      '<div class="hist-room">'+(idx+1)+'. '+name+'</div>'+
      '<div class="hist-detail">'+h.vol+' m³ · '+(Math.max(1,parseInt(h.roomCount,10)||1))+' '+(lang==='ar'?'غرف':'rooms')+' · '+h.ppl+' '+(lang==='ar'?'أشخاص':'people')+(h.devSum?' · '+h.devSum:'')+'</div>'+
      (h.equipmentBtu?'<div class="hist-cfm">'+(lang==='ar'?'حمل الأجهزة: ':'Equipment Load: ')+Number(h.equipmentBtu).toLocaleString()+' BTU/h</div>':'')+
      (h.roomType?'<div class="hist-cfm">'+(lang==='ar'?'نوع الغرفة: ':'Room Type: ')+h.roomType+(h.category?' | '+(lang==='ar'?'الفئة: ':'Category: ')+getCategoryLabel(h.category):'')+'</div>':'')+
      (cfmLine?'<div class="hist-cfm">'+cfmLine+'</div>':'')+
      '<div class="hist-time">'+h.time+'</div>'+
      '<div class="hist-actions">'+
        '<button class="hact-btn" onclick="editRec('+idx+')">✏️</button>'+
        '<button class="hact-btn del-btn" onclick="delRec('+idx+')">🗑️</button>'+
      '</div>'+
    '</div>'+
    '<div class="hist-right">'+
      '<div class="hist-tr">'+h.tr+' TR</div>'+
      '<div class="hist-btu">'+Number(h.btu).toLocaleString()+' BTU/h</div>'+
      '<div class="hist-btu">'+Number(h.mkt).toLocaleString()+' Mkt</div>'+
    '</div>';
    list.appendChild(row);
  });
  renderCalcRooms();
  renderQuote();
  updateDirectResults();
  if(window.AppProjects&&window.AppProjects.updateNavDots) window.AppProjects.updateNavDots();
}

function delRec(idx){
  if(idx < 0 || idx >= hist.length) return;
  if(!confirm(t('delroomconfirm'))) return;
  hist.splice(idx,1);
  qlines.splice(idx,1);
  if(calcRoomsOpenIdx === idx) calcRoomsOpenIdx = -1;
  else if(calcRoomsOpenIdx > idx) calcRoomsOpenIdx--;
  save();
  renderHist();
  updateDirectResults();
  toast(t('qdel'));
  if(window.AppProjects&&window.AppProjects.updateNavDots) window.AppProjects.updateNavDots();
}
function editRec(idx){
  var h=hist[idx]; if(!h) return;
  calcRoomsOpenIdx = idx;
  goPanel('calc');
  if(h.rid&&ROOMS[h.rid]){
    curRoom=ROOMS[h.rid];
    document.querySelectorAll('#dd-room .dd-item').forEach(function(item){
      item.classList.remove('sel');
      if((item.getAttribute('onclick')||'').indexOf("'"+h.rid+"'")>=0) item.classList.add('sel');
    });
    G('dt').textContent=rLabel(curRoom);
  }
  G('inp-vol').value=h.vol; G('inp-ppl').value=h.ppl;
  setFreshAirMode(h.freshAirMode || 'ashrae');
  syncLoadFactorFromRoom(curRoom);
  updateCalculationModeUI(curRoom);
  if(h.loadFactor != null){
    var lfEl = G('inp-load-factor');
    if(lfEl) lfEl.value = String(h.loadFactor);
    setLoadFactorPresetValue(h.loadFactor);
  }
  var rcInput=G('inp-room-count'); if(rcInput) rcInput.value=Math.max(1,parseInt(h.roomCount,10)||getQty(idx)||1);
  setRoomDimensionInputs(h.dims);
  if(!h.dims) setLegacyRoomVolume(h.vol);
  devs=[];
  if(h.devSum){ h.devSum.split(' | ').forEach(function(part){
    var m=part.match(/^(.+?)×(\d+)$/); if(!m) return;
    var nm=m[1].trim(), qty=parseInt(m[2],10)||1;
    var c=DEVS.filter(function(x){return x.ar===nm||x.en===nm;})[0];
    if(c) devs.push({id:c.id,qty:qty});
  }); }
  renderDevs(); editIdx=idx;
  toast(lang==='ar'?'✏️ تم تحميل السجل للتعديل':'✏️ Record loaded for editing');
}
function resetApp(){
  // ── 1. Clear in-memory state ──────────────────────────────────────
  hist    = [];
  qlines  = [];
  devs    = [];
  editIdx = -1;

  // ── 2. Remove ALL app localStorage keys ──────────────────────────
try {
  AppStorage.clearAll();
} catch(e){}

  // ── 3. Reset runtime variables to factory defaults ────────────────
  vatOn      = true;
  instPct    = 10;
  qsValidity = 14;
  qsNotes    = '';
  bundleOn   = false;
  quoteMode  = 'room';
  projState  = { sysType:'split', selBtu:0, qty:1, up:0, qtyAuto:true, autoReason:'' };
  bundleConfig.unitType    = 'package';
  bundleConfig.selectedBtu = 0;
  bundleConfig.qty         = 1;
  bundleConfig.unitPrice   = 0;
  bundleConfig.designBasis = 'required';
  bundleConfig.supplyFpm   = 1000;
  bundleConfig.returnFpm   = 800;
  bundleConfig.cfmPerTr    = 400;

  // ── 4. Reset UI inputs ────────────────────────────────────────────
  clearRoomDimensionInputs();
  var inpVol = G('inp-vol');        if(inpVol)  inpVol.value  = '';
  var inpPpl = G('inp-ppl');        if(inpPpl)  inpPpl.value  = '';
  var qProj  = G('quote-project');  if(qProj)   qProj.value   = '';
  var qNo    = G('quote-no');       if(qNo)     qNo.value     = 'Q-001';
  var tProj  = G('tech-project');   if(tProj)   tProj.value   = '';
  var tNo    = G('tech-no');        if(tNo)     tNo.value     = 'Q-001';
  var qsInst = G('qs-inst');        if(qsInst)  qsInst.value  = '10';
  var qsVal  = G('qs-validity');    if(qsVal)   qsVal.value   = '14';
  var qsNts  = G('qs-notes');       if(qsNts)   qsNts.value   = '';
  var pQty   = G('proj-qty');       if(pQty)    pQty.value    = '1';
  var pUp    = G('proj-up');        if(pUp)     pUp.value     = '';

  // ── 5. Reset metrics display ──────────────────────────────────────
  flash('vtr','0.00'); flash('vcfm','0'); flash('vbtu','0'); flash('vmkt','0');
  var bd = G('breakdown');      if(bd)  bd.classList.remove('show');
  var hc = G('hc-card');        if(hc)  hc.style.display = 'none';
  var aw = G('add-quote-wrap'); if(aw)  aw.style.display = 'none';

  // ── 6. Navigate and re-render ─────────────────────────────────────
  goPanel('calc');
  setQuoteMode('room');
  _updateBundleUI();
  renderDevs();
  renderHist();
  applyQSState();
  refreshGrandTotal();

  // ── 7. Toast confirmation ─────────────────────────────────────────
  toast(lang === 'ar' ? '✅ تم تصفير التطبيق بالكامل' : '✅ App reset completed');
}

function clearHist(){ resetApp(); if(window.AppProjects&&window.AppProjects.updateNavDots) window.AppProjects.updateNavDots(); }

// ── QUOTATION ─────────────────────────────────────────────────────────────
function getQty(i){ return Math.max(1,parseInt((qlines[i]||{}).qty)||1); }
function getRecordRoomCount(i){ return Math.max(1,parseInt((hist[i]||{}).roomCount,10)||1); }
function getTotalRecordRoomCount(){
  var total=0;
  for(var i=0;i<hist.length;i++) total+=getRecordRoomCount(i);
  return total;
}
function getUP(i){ return parseFloat((qlines[i]||{}).up)||0; }
function getUT(i){ return (qlines[i]||{}).unitType||'split'; }
function getSelBtu(i){ return parseInt((qlines[i]||{}).selectedBtu)||0; }
function getQtyAuto(i){ return !qlines[i] || qlines[i].qtyAuto !== false; }
function getQtyAutoReason(i){ return (qlines[i]||{}).autoReason || ''; }
function ensureQuoteLine(i){
  if(!qlines[i]){
    qlines[i]={qty:1,up:0,unitType:'split',selectedBtu:0,qtyAuto:true,autoReason:''};
  } else {
    if(qlines[i].qtyAuto === undefined) qlines[i].qtyAuto = true;
    if(qlines[i].autoReason === undefined) qlines[i].autoReason = '';
    if(!qlines[i].unitType) qlines[i].unitType = 'split';
    if(qlines[i].selectedBtu === undefined) qlines[i].selectedBtu = 0;
    if(qlines[i].up === undefined) qlines[i].up = 0;
    if(qlines[i].qty === undefined) qlines[i].qty = 1;
  }
  return qlines[i];
}
function isPerRoomUnitType(utKey){
  return ['split','window','cassette','ducted','floor'].indexOf(utKey||'') >= 0;
}
function isCentralUnitType(utKey){
  return ['package','ahu','fcu','chiller_air','chiller_water','vrf'].indexOf(utKey||'') >= 0;
}
function getCatalogEntryByBtu(utKey, btu){
  var cat=getCatalog(utKey);
  for(var i=0;i<cat.length;i++){
    if((cat[i].btu||0)===parseInt(btu,10)) return cat[i];
  }
  return null;
}
function getCatalogMaxBtu(utKey){
  var cat=getCatalog(utKey);
  return cat.length ? (cat[cat.length-1].btu||0) : 0;
}
function getProjectReferenceRoomLoad(){
  var maxBtu=0, maxCfm=0;
  for(var i=0;i<hist.length;i++){
    maxBtu=Math.max(maxBtu, parseInt((hist[i]||{}).btu)||0);
    maxCfm=Math.max(maxCfm, parseInt((hist[i]||{}).cfm)||0);
  }
  return {btu:maxBtu, cfm:maxCfm};
}
function buildAutoQtyReason(kind, details){
  var isAr = lang==='ar';
  if(kind==='room-count'){
    return isAr
      ? 'تم اختيار العدد تلقائيًا حسب عدد الغرف'
      : 'Quantity auto-selected based on room count';
  }
  if(kind==='single-central'){
    return isAr
      ? 'تم اختيار وحدة واحدة تغطي الحمل الكلي'
      : 'One unit selected to cover total project load';
  }
  if(kind==='capacity-limit'){
    return isAr
      ? 'تم زيادة العدد لأن الحمل أعلى من سعة الوحدة'
      : 'Quantity increased because load exceeds selected unit capacity';
  }
  if(kind==='manual'){
    return isAr
      ? 'تم تعديل العدد يدويًا'
      : 'Quantity was manually overridden';
  }
  if(kind==='central-match'){
    return isAr
      ? 'تم اختيار العدد تلقائيًا حسب الحمل الكلي والسعة المختارة'
      : 'Quantity auto-selected from total load and selected capacity';
  }
  return details || '';
}
function getAutoUnitDecision(utKey, totalRequiredBtu, totalRequiredCfm, roomCount, currentSelectedBtu, perRoomBtu, perRoomCfm){
  var validCurrent = !!getCatalogEntryByBtu(utKey, currentSelectedBtu);
  var recommendedCap;
  var selectedCap;
  var qty = 1;
  var reason = '';

  if(isPerRoomUnitType(utKey)){
    recommendedCap = defaultCapForUT(utKey, perRoomBtu || totalRequiredBtu, perRoomCfm || totalRequiredCfm);
    selectedCap = validCurrent ? currentSelectedBtu : recommendedCap;
    qty = Math.max(1, roomCount || 1);
    reason = buildAutoQtyReason('room-count');
    return {qty:qty, selectedBtu:selectedCap, reason:reason};
  }

  recommendedCap = defaultCapForUT(utKey, totalRequiredBtu, totalRequiredCfm);
  selectedCap = validCurrent ? currentSelectedBtu : recommendedCap;
  if(selectedCap <= 0) selectedCap = recommendedCap;
  qty = Math.max(1, Math.ceil(totalRequiredBtu / Math.max(1, selectedCap)));

  if(qty <= 1 && recommendedCap >= totalRequiredBtu){
    qty = 1;
    reason = buildAutoQtyReason('single-central');
  } else if(qty > 1){
    reason = buildAutoQtyReason('capacity-limit');
  } else {
    reason = buildAutoQtyReason('central-match');
  }
  return {qty:qty, selectedBtu:selectedCap, reason:reason};
}
function syncQuoteLineRecommendation(i, opts){
  opts = opts || {};
  var line = ensureQuoteLine(i);
  var utKey = opts.unitType || line.unitType || 'split';
  var h = hist[i] || {};
  var roomCount = getRecordRoomCount(i);
  var roomBtu = parseInt(h.btu)||0;
  var roomCfm = parseInt(h.cfm)||0;
  var totalBtu = isPerRoomUnitType(utKey) ? roomBtu : roomBtu * roomCount;
  var totalCfm = isPerRoomUnitType(utKey) ? roomCfm : roomCfm * roomCount;
  var currentSelectedBtu = opts.keepSelectedCapacity ? line.selectedBtu : 0;
  var decision = getAutoUnitDecision(utKey, totalBtu, totalCfm, roomCount, currentSelectedBtu, roomBtu, roomCfm);
  line.unitType = utKey;
  line.selectedBtu = decision.selectedBtu;
  line.autoReason = line.qtyAuto === false ? buildAutoQtyReason('manual') : decision.reason;
  if(line.qtyAuto !== false) line.qty = decision.qty;
  return line;
}
function getProjectQtyAuto(){ return projState.qtyAuto !== false; }
function getProjectAutoReason(){ return projState.autoReason || ''; }
function syncProjectRecommendation(opts){
  opts = opts || {};
  if(projState.qtyAuto === undefined) projState.qtyAuto = true;
  if(projState.autoReason === undefined) projState.autoReason = '';
  var utKey = opts.unitType || projState.sysType || 'split';
  var totalBtu = getProjTotalBtu();
  var totalCfm = getProjTotalCfm();
  var totalRooms = getTotalRecordRoomCount();
  var refRoom = getProjectReferenceRoomLoad();
  var currentSelectedBtu = opts.keepSelectedCapacity ? projState.selBtu : 0;
  var decision = getAutoUnitDecision(
    utKey,
    isPerRoomUnitType(utKey) ? refRoom.btu : totalBtu,
    isPerRoomUnitType(utKey) ? refRoom.cfm : totalCfm,
    isPerRoomUnitType(utKey) ? totalRooms : 1,
    currentSelectedBtu,
    refRoom.btu,
    refRoom.cfm
  );
  projState.sysType = utKey;
  projState.selBtu = decision.selectedBtu;
  projState.autoReason = projState.qtyAuto === false ? buildAutoQtyReason('manual') : decision.reason;
  if(projState.qtyAuto !== false) projState.qty = decision.qty;
  return projState;
}
function setSelBtu(i,v){
  var line = ensureQuoteLine(i);
  line.selectedBtu=parseInt(v)||0;
  if(line.qtyAuto !== false){
    syncQuoteLineRecommendation(i,{keepSelectedCapacity:true});
  }
  save();
  renderQuote();
}

function isSharedUnitType(utKey){
  return !isPerRoomUnitType(utKey);
}

function getQuoteRequiredBtu(i, utKey){
  var h=hist[i]||{};
  var roomBtu=parseInt(h.btu)||0;
  return roomBtu * getRecordRoomCount(i);
}

function getRecommendedQuoteUnitConfig(i, utKey){
  var line = ensureQuoteLine(i);
  var prevQtyAuto = line.qtyAuto;
  line.qtyAuto = true;
  syncQuoteLineRecommendation(i,{unitType:utKey});
  line.qtyAuto = prevQtyAuto;
  return {
    qty: Math.max(1, parseInt(line.qty,10)||1),
    selectedBtu: parseInt(line.selectedBtu,10)||0,
    reason: line.autoReason || ''
  };
}


// ── DUCT VELOCITY RATING ─────────────────────────────────────────────────
// Returns {rating, badge, color, bg, border} for a given actual velocity
// ductType: 'supply' | 'return'
// isHealthcare: bool (room has h.sup ASHRAE 170 data)
function getDuctVelocityRating(actualFpm, ductType, isHealthcare){
  if(!actualFpm || actualFpm <= 0) return null;
  var lims;
  if(ductType === 'supply'){
    lims = isHealthcare
      ? [{max:600,r:'Low',e:'🔵',c:'#1d4ed8',bg:'#dbeafe',bd:'#93c5fd'},
         {max:800,r:'Excellent',e:'✅',c:'#166534',bg:'#dcfce7',bd:'#86efac'},
         {max:1000,r:'Acceptable',e:'🟡',c:'#374151',bg:'#f3f4f6',bd:'#d1d5db'},
         {max:1200,r:'High',e:'⚠',c:'#92400e',bg:'#fef3c7',bd:'#fcd34d'},
         {max:9999,r:'Critical',e:'⛔',c:'#991b1b',bg:'#fee2e2',bd:'#fca5a5'}]
      : [{max:700,r:'Low',e:'🔵',c:'#1d4ed8',bg:'#dbeafe',bd:'#93c5fd'},
         {max:900,r:'Excellent',e:'✅',c:'#166534',bg:'#dcfce7',bd:'#86efac'},
         {max:1100,r:'Acceptable',e:'🟡',c:'#374151',bg:'#f3f4f6',bd:'#d1d5db'},
         {max:1400,r:'High',e:'⚠',c:'#92400e',bg:'#fef3c7',bd:'#fcd34d'},
         {max:9999,r:'Critical',e:'⛔',c:'#991b1b',bg:'#fee2e2',bd:'#fca5a5'}];
  } else {
    lims = isHealthcare
      ? [{max:450,r:'Low',e:'🔵',c:'#1d4ed8',bg:'#dbeafe',bd:'#93c5fd'},
         {max:650,r:'Excellent',e:'✅',c:'#166534',bg:'#dcfce7',bd:'#86efac'},
         {max:850,r:'Acceptable',e:'🟡',c:'#374151',bg:'#f3f4f6',bd:'#d1d5db'},
         {max:1000,r:'High',e:'⚠',c:'#92400e',bg:'#fef3c7',bd:'#fcd34d'},
         {max:9999,r:'Critical',e:'⛔',c:'#991b1b',bg:'#fee2e2',bd:'#fca5a5'}]
      : [{max:500,r:'Low',e:'🔵',c:'#1d4ed8',bg:'#dbeafe',bd:'#93c5fd'},
         {max:700,r:'Excellent',e:'✅',c:'#166534',bg:'#dcfce7',bd:'#86efac'},
         {max:900,r:'Acceptable',e:'🟡',c:'#374151',bg:'#f3f4f6',bd:'#d1d5db'},
         {max:1100,r:'High',e:'⚠',c:'#92400e',bg:'#fef3c7',bd:'#fcd34d'},
         {max:9999,r:'Critical',e:'⛔',c:'#991b1b',bg:'#fee2e2',bd:'#fca5a5'}];
  }
  for(var k=0;k<lims.length;k++){
    if(actualFpm <= lims[k].max) return lims[k];
  }
  return lims[lims.length-1];
}
// Build an inline badge HTML string for rating display
function ratingBadge(rt, isAr){
  if(!rt) return '—';
  var lbl = isAr ? {
    'Excellent':'ممتاز','Acceptable':'مقبول','High':'مرتفع','Critical':'حرج','Low':'منخفض'
  }[rt.r]||rt.r : rt.r;
  return '<span style="display:inline-flex;align-items:center;gap:3px;background:'+rt.bg+';color:'+rt.c+';border:1px solid '+rt.bd+';border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap">'+rt.e+' '+lbl+'</span>';
}
// Recommendation text based on worst rating
function ductRecommendation(supRt, retRt, isAr){
  var worst = 'Excellent';
  var order = ['Low','Excellent','Acceptable','High','Critical'];
  var sr = supRt?supRt.r:'Excellent', rr = retRt?retRt.r:'Excellent';
  if(order.indexOf(sr) > order.indexOf(worst)) worst = sr;
  if(order.indexOf(rr) > order.indexOf(worst)) worst = rr;
  if(worst === 'High' || worst === 'Critical'){
    return isAr
      ? '⚠ يُفضَّل زيادة مقاس المجرى لتقليل الضوضاء والضغط الساكن.'
      : '⚠ Consider increasing duct size to reduce noise & static pressure.';
  }
  return isAr
    ? '✅ السرعة مناسبة من الناحية الفنية.'
    : '✅ Velocity is within acceptable engineering limits.';
}
function renderQuote(){
  var list=G('qi-list'); if(list) list.innerHTML='';
  var quoteView=G('quote-view-list'); if(quoteView) quoteView.innerHTML='';
  if(quoteMode==='proj' && getProjectQtyAuto()){
    syncProjectRecommendation({keepSelectedCapacity:true});
  }
  if(!hist.length){
    var em=document.createElement('div'); em.className='qi-empty'; em.textContent=t('qempty');
    if(list) list.appendChild(em);
    if(quoteView){
      var em2=document.createElement('div'); em2.className='qi-empty'; em2.textContent=t('qempty');
      quoteView.appendChild(em2);
    }
    G('qt-total-qty').textContent='0'; G('qt-grand').textContent='0.00'; return;
  }
  if(quoteMode==='proj' && quoteView){
    var projReqBtu = getProjTotalBtu();
    var projItem = document.createElement('div');
    projItem.className = 'quote-readonly-card';
    projItem.innerHTML =
      '<div class="quote-readonly-head"><span class="qi-num">#1</span><span class="qi-name">'+(lang==='ar'?'وحدة للمشروع':'Project Unit')+'</span></div>'+
      '<div class="quote-readonly-grid">'+
        '<div class="quote-readonly-stat"><div class="quote-readonly-label">'+(lang==='ar'?'نوع النظام':'System Type')+'</div><div class="quote-readonly-value">'+utLabel(projState.sysType||'split')+'</div></div>'+
        '<div class="quote-readonly-stat"><div class="quote-readonly-label">'+(lang==='ar'?'السعة المختارة':'Selected Capacity')+'</div><div class="quote-readonly-value">'+Number(projState.selBtu||0).toLocaleString()+' BTU</div></div>'+
        '<div class="quote-readonly-stat"><div class="quote-readonly-label">'+(lang==='ar'?'عدد الوحدات':'Unit Count')+'</div><div class="quote-readonly-value">'+(projState.qty||1)+'</div></div>'+
        '<div class="quote-readonly-stat"><div class="quote-readonly-label">'+(lang==='ar'?'الحمل المطلوب':'Required Load')+'</div><div class="quote-readonly-value">'+Number(projReqBtu||0).toLocaleString()+' BTU/h</div></div>'+
      '</div>'+
      '<div class="quote-readonly-note">'+(getProjectAutoReason()?getProjectAutoReason()+'<br>':'')+(lang==='ar'?'يتم تعديل نوع النظام والسعة من التقرير الفني فقط.':'System type and capacity are edited from the technical report only.')+'</div>';
    quoteView.appendChild(projItem);
  }
  hist.forEach(function(h,i){
    ensureQuoteLine(i);
    if(getQtyAuto(i)) syncQuoteLineRecommendation(i,{keepSelectedCapacity:true});
    var qty=getQty(i), roomCount=getRecordRoomCount(i), up=getUP(i), lt=qty*up;
    var _rn=lang==='ar'?(h.ar||h.en):(h.en||h.ar);
    var name=_rn.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/gu,'').trim();
    var item=document.createElement('div'); item.className='qi-item';
    var hcLine='';
    if(h.sup){
      var pl=lang==='ar'?(h.pres==='positive'?'موجب':h.pres==='negative'?'سالب':'محايد'):(h.pres==='positive'?'Pos':h.pres==='negative'?'Neg':'Neutral');
      hcLine='<div class="qi-hcline">ASHRAE — S:'+h.sup+' OA:'+h.oa+' Exh:'+h.exh+' CFM | '+pl+'</div>';
    } else if(h.roomType || h.ach || h.oaStd || h.exhaust){
      hcLine='<div class="qi-hcline">'+
        (h.roomType ? ((lang==='ar'?'النوع: ':'Type: ')+h.roomType+' | ') : '')+
        (h.category ? ((lang==='ar'?'الفئة: ':'Category: ')+getCategoryLabel(h.category)+' | ') : '')+
        'ACH: '+(h.ach != null ? h.ach : '—')+
        ' | OA: '+(h.oaStd != null ? h.oaStd : '—')+
        ' | Exh: '+(h.exhaust != null ? h.exhaust : '—')+
        ' | '+(lang==='ar'?'Pressure: ':'Pressure: ')+(h.pressure || 'Neutral')+
      '</div>';
    }
    var devLine=h.devSum?'<div class="qi-devline">⚡ '+h.devSum+(h.equipmentBtu?' · '+Number(h.equipmentBtu).toLocaleString()+' BTU/h':'')+'</div>':'';
    var UT_KEYS=['split','floor','ducted','cassette','package','vrf','chiller_air','chiller_water','fcu','ahu','window'];
    var utSelOpts=UT_KEYS.map(function(k){ return '<option value="'+k+'"'+(getUT(i)===k?' selected':'')+'>'+utLabel(k)+'</option>'; }).join('');
    // ── Bundle lock: disable per-room unit controls when bundleOn=true ──
    // Works in both 'room' and 'proj' modes
    var _bundleLocked = bundleOn;
    var _lockNote = _bundleLocked
      ? '<div class="bundle-lock-note">'+(lang==='ar'
          ? '🔒 تم تعطيل اختيار الوحدات لكل غرفة بسبب تفعيل التجميع'
          : '🔒 Per-room unit selection is locked because Bundle is enabled')+'</div>'
      : '';
    var _autoQty = getQtyAuto(i);
    var _qtyDisabled = _bundleLocked || _autoQty;
    var qtyCtrlHtml='<div class="qi-unit-count"><span class="qi-utype-lbl">'+(lang==='ar'?'عدد الوحدات':'Units Needed')+'</span>'+
      '<div class="qi-unit-stepper" aria-label="'+(lang==='ar'?'تعديل عدد الوحدات':'Adjust units needed')+'">'+
        '<button type="button" class="qbtn'+(_qtyDisabled?' qty-locked':'')+'" '+(_qtyDisabled?'disabled':'')+' onclick="stepQuoteQty('+i+',1)" aria-label="'+(lang==='ar'?'زيادة عدد الوحدات':'Increase units needed')+'">+</button>'+
        '<input class="qi-unit-count-input'+(_qtyDisabled?' qty-locked-input':'')+'" type="number" min="1" step="1" value="'+qty+'" '+(_qtyDisabled?'readonly':'')+' onchange="setQty('+i+',this.value)">'+
        '<button type="button" class="qbtn'+(_qtyDisabled?' qty-locked':'')+'" '+(_qtyDisabled?'disabled':'')+' onclick="stepQuoteQty('+i+',-1)" aria-label="'+(lang==='ar'?'تقليل عدد الوحدات':'Decrease units needed')+'">−</button>'+
      '</div>'+
      '</div>';
    var reqBtu = parseInt(h.btu)||0;
    var curUT = getUT(i);
    var catItems = getCatalog(curUT);
    var selBtu = getSelBtu(i);
    // Validate selBtu is in catalog; if not, pick best default
    var validBtus = catItems.map(function(x){return x.btu;});
    if(!selBtu || validBtus.indexOf(selBtu)<0){
      selBtu = getRecommendedQuoteUnitConfig(i, curUT).selectedBtu;
      qlines[i].selectedBtu = selBtu;
    }
    var btuStepOpts = catItems.map(function(c){
      var lbl = lang==='ar' ? c.label.ar : c.label.en;
      return '<option value="'+c.btu+'"'+(selBtu===c.btu?' selected':'')+'>'+lbl+'</option>';
    }).join('');
    var capCtrlHtml = '<div class="qi-unit-cap"><span class="qi-utype-lbl">'+(lang==='ar'?'سعة الوحدة':'Unit Capacity')+'</span>'+
      (_bundleLocked
        ? '<select class="qi-cap-sel" disabled style="opacity:.45;cursor:not-allowed">'+btuStepOpts+'</select>'
        : '<select class="qi-cap-sel" onchange="setSelBtu('+i+',this.value)">'+btuStepOpts+'</select>')+
      '</div>';
    var utHtml='<div class="qi-utype"><span class="qi-utype-lbl">'+(lang==='ar'?'نوع الوحدة':'Unit Type')+'</span>'+
      (_bundleLocked
        ? '<select class="qi-utype-sel" disabled style="opacity:.45;cursor:not-allowed">'+utSelOpts+'</select>'
        : '<select class="qi-utype-sel" onchange="setUnitType('+i+',this.value)">'+utSelOpts+'</select>')+
      qtyCtrlHtml+
      capCtrlHtml+
      '<div class="qty-auto-row">'+
        '<button type="button" class="qty-auto-btn '+(_autoQty?'active':'')+'" onclick="setQtyAuto('+i+',true)">'+(lang==='ar'?'تلقائي':'Auto')+'</button>'+
        '<button type="button" class="qty-auto-btn '+(!_autoQty?'active':'')+'" onclick="setQtyAuto('+i+',false)"'+(_bundleLocked?' disabled':'')+'>'+(lang==='ar'?'يدوي':'Manual')+'</button>'+
      '</div>'+
      '<div class="qty-auto-note">'+(_bundleLocked
        ? (lang==='ar'?'التحكم من وحدة المشروع بسبب تفعيل التجميع':'Controlled by project unit because bundle mode is enabled')
        : getQtyAutoReason(i))+'</div>'+
      '</div>';
    var capHtml = '';
    // In bundle mode: per-room warnings are suppressed (project-level shown separately)
    var reqCompareBtu = getQuoteRequiredBtu(i, curUT);
    var effCap = _bundleLocked ? reqCompareBtu : selBtu * qty; // neutralise per-room warnings in bundle mode
    // Delta% = ((selBtu*qty - reqBtu) / reqBtu) * 100 — TRUE percentage
    var warnHtml = '';
    var capBadge = '';
    if(reqCompareBtu > 0){
      var deltaRaw = (effCap - reqCompareBtu) / reqCompareBtu * 100;
      var deltaRnd = Math.round(deltaRaw * 10) / 10;
      var absDelta = Math.abs(deltaRnd);
      var reqTR = (reqCompareBtu/12000).toFixed(1);
      var selTR = (effCap/12000).toFixed(1);
      var pctStr = (deltaRnd >= 0 ? '+' : '') + deltaRnd.toFixed(1) + '%';

      if(deltaRaw < 0){
        // DEFICIT
        var defLines = lang==='ar'
          ? ['تنبيه: السعة أقل من الحمل المطلوب.',
             'العجز: '+deltaRnd.toFixed(1)+'%',
             'المطلوب: '+Number(reqCompareBtu).toLocaleString()+' BTU/h (~'+reqTR+' TR)',
             'المختار: '+Number(effCap).toLocaleString()+' BTU/h (~'+selTR+' TR)',
             'يُنصح برفع السعة أو تقسيم الحمل.']
          : ['Warning: Capacity below required load.',
             'Deficit: '+deltaRnd.toFixed(1)+'%',
             'Required: '+Number(reqCompareBtu).toLocaleString()+' BTU/h (~'+reqTR+' TR)',
             'Selected: '+Number(effCap).toLocaleString()+' BTU/h (~'+selTR+' TR)',
             'Consider higher capacity or multiple units.'];

        var sev = absDelta > 15 ? 'severe' : 'mild';
        var icon = absDelta > 15 ? '⛔' : '⚠';
        warnHtml = '<div class="qi-warn '+sev+'"><div class="qi-warn-head">'+icon+' '+defLines[0]+'</div>'
          +defLines.slice(1).map(function(l){return '<div class="qi-warn-row">'+l+'</div>';}).join('')
          +'</div>';
        capBadge = '<span class="qi-cap-badge '+(absDelta>15?'deficit-severe':'deficit-mild')+'">'+icon+' '+(lang==='ar'?'عجز سعة':'Deficit')+' '+deltaRnd.toFixed(1)+'%</span>';
      } else if(deltaRaw <= 5){
        capBadge = '<span class="qi-cap-badge matched">✓ '+(lang==='ar'?'مطابقة':'Match')+' '+pctStr+'</span>';
      } else if(deltaRaw <= 25){
        capBadge = '<span class="qi-cap-badge oversize-ok">'+(lang==='ar'?'سعة زائدة':'Slight oversize')+' '+pctStr+'</span>';
      } else {
        var highMsg = lang==='ar'
          ? 'ملاحظة: السعة أعلى من المطلوب ('+pctStr+') — احتمال قصر دورة الضاغط (Short Cycling).'
          : 'Note: Capacity exceeds load by '+pctStr+'. Short cycling risk.';
        warnHtml = '<div class="qi-warn mild"><div class="qi-warn-head">ℹ '+highMsg+'</div></div>';
        capBadge = '<span class="qi-cap-badge oversize-high">'+(lang==='ar'?'سعة عالية':'High oversize')+' '+pctStr+'</span>';
      }
    }
    if(!_bundleLocked && capBadge) capHtml = '<div class="qi-cap-status">'+capBadge+'</div>';

    // Duct sizing for this room (if ducted) — Q only, no load change
    var roomDuctHtml = '';
    if(isDucted(curUT) && (parseInt(h.cfm)>0 || selBtu>0)){
      var _vSup = parseInt((G('duct-vel-sup')||{value:'1000'}).value)||1000;
      var _vRet = parseInt((G('duct-vel-ret')||{value:'800'}).value)||800;
      var _cfmPerTr = parseInt((G('duct-cfm-per-tr')||{value:'400'}).value)||400;
      var _ductCfmObj = getDuctCfm(curUT, selBtu, parseInt(h.cfm)||0, _cfmPerTr);
      var _rCfm = _ductCfmObj.cfm;
      // Build ONE clear source label per spec
      var _cfmSrcLbl;
      if(_ductCfmObj.source==='unit'){
        _cfmSrcLbl = lang==='ar'
          ? 'مصدر CFM: السعة المختارة'
          : 'CFM Source: Selected Capacity';
      } else if(_ductCfmObj.source==='tr'){
        _cfmSrcLbl = lang==='ar'
          ? 'مصدر CFM: TR × ' + _cfmPerTr
          : 'CFM Source: TR × ' + _cfmPerTr;
      } else {
        _cfmSrcLbl = lang==='ar'
          ? 'مصدر CFM: إجمالي التدفق المحسوب'
          : 'CFM Source: Calculated Total Flow';
      }
      var _dSup = calcDuctSize(_rCfm, _vSup);
      var _dRet = calcDuctSize(_rCfm, _vRet); // Return uses same CFM with own velocity
      var _dSupD = _dSup ? (_dSup.std||_dSup.calc) : null;
      var _dRetD = _dRet ? (_dRet.std||_dRet.calc) : null;
      var _supLbl = _dSupD ? ductSizeLabel(_dSupD) : '—';
      var _retLbl = _dRetD ? ductSizeLabel(_dRetD) : '—';
      // Cache structured duct data for Advanced Mode (avoids fragile DOM text parsing)
      window._lastDuctSizing = {
        supCfm: _rCfm, retCfm: Math.round(_rCfm * 0.9),
        sup: _dSupD ? { w: _dSupD.w, h: _dSupD.h, actualFpm: _dSupD.actualFpm } : null,
        ret: _dRetD ? { w: _dRetD.w, h: _dRetD.h, actualFpm: _dRetD.actualFpm } : null,
        vSup: _vSup, vRet: _vRet
      };
      // Only show CFM/TR note when source is 'tr'
      var _cfmTrNote = (_ductCfmObj.source==='tr')
        ? '<div class="duct-note" style="color:var(--am)">'+(lang==='ar'?'نسبة CFM/TR قابلة للتعديل في إعدادات المجاري':'Adjust CFM/TR ratio in duct settings')+'</div>'
        : '';
      roomDuctHtml = '<div class="duct-block">'+
        '<div class="duct-block-ttl">'+(lang==='ar'?'🌬 مجاري الهواء':'🌬 Duct Sizing')+'</div>'+
        '<div class="duct-row">'+
          '<span class="duct-lbl">'+(lang==='ar'?'إمداد:':'Supply:')+'</span>'+
          '<span class="duct-val">'+_supLbl+'</span>'+
          '<span class="duct-lbl">'+(lang==='ar'?'رجوع:':'Return:')+'</span>'+
          '<span class="duct-val">'+_retLbl+'</span>'+
        '</div>'+
        '<div class="duct-row" style="margin-top:4px">'+
          '<span dir="rtl" style="font-size:10px;color:var(--a);background:var(--ad);padding:3px 9px;border-radius:10px;font-family:var(--fe);white-space:nowrap;display:inline-flex;align-items:center;gap:4px">'+
          (lang==='ar'
            ? '<span dir="rtl">'+_cfmSrcLbl+'</span><span dir="ltr" style="font-family:var(--fe)"> — Q = '+Number(_rCfm).toLocaleString()+' CFM</span>'
            : '<span>'+_cfmSrcLbl+' — Q = '+Number(_rCfm).toLocaleString()+' CFM</span>'
          )+
          '</span>'+
        '</div>'+
        _cfmTrNote+
        (function(){
          if(_ductCfmObj.source==='unit' && (parseInt(h.cfm)||0) > 0){
            var _rCalcCfm = parseInt(h.cfm)||0;
            var _rdPct = ((_rCfm - _rCalcCfm) / _rCalcCfm) * 100;
            var _rdR = Math.round(_rdPct * 10) / 10;
            var _rdSign = _rdR >= 0 ? '+' : '';
            var _rdStr = _rdSign + _rdR.toFixed(1) + '%';
            var _rdNote = '';
            if(_rdR > 25){
              _rdNote = '<div class="duct-note" style="color:#f59e0b;margin-top:2px">⚠️ ملاحظة: التدفق المختار أعلى من المطلوب—قد يلزم ضبط المخارج/دمبرز لتفادي السرعات العالية.</div>';
            } else if(_rdR < 0){
              _rdNote = '<div class="duct-note" style="color:#ef4444;margin-top:2px">⚠️ تنبيه: التدفق المختار أقل من المطلوب—قد يقل الأداء.</div>';
            }
            return '<div class="duct-note" style="margin-top:5px">' +
              '<span style="color:var(--tm)">التدفق المطلوب (من الحساب): </span>' +
              '<span style="font-family:var(--fe)">' + Number(_rCalcCfm).toLocaleString() + ' CFM</span>' +
              '</div>' +
              '<div class="duct-note">' +
              '<span style="color:var(--tm)">التدفق المختار (الوحدة): </span>' +
              '<span style="font-family:var(--fe);color:var(--g)">' + Number(_rCfm).toLocaleString() + ' CFM</span>' +
              '<span style="margin-right:5px;font-family:var(--fe);color:' + (_rdR < 0 ? '#ef4444' : _rdR > 25 ? '#f59e0b' : 'var(--g)') + '"> (' + _rdStr + ')</span>' +
              '</div>' + _rdNote;
          }
          return '';
        })()+
        '<div class="duct-note">'+(lang==='ar'?'سرعة الإمداد: ':'Sup vel: ')+_vSup+' fpm | '+(lang==='ar'?'الرجوع: ':'Ret: ')+_vRet+' fpm</div>'+
      '</div>';
    }

    item.innerHTML=
      '<div class="qi-head"><span class="qi-num">#'+(i+1)+'</span><span class="qi-name">'+name+'</span></div>'+utHtml+_lockNote+
      '<div class="qi-body">'+
        '<div class="qi-tech">'+
          '<div class="qi-stat"><div class="qi-slbl">m³</div><div class="qi-sval">'+h.vol+'</div></div>'+
          '<div class="qi-stat"><div class="qi-slbl">'+(lang==='ar'?'غرف':'Rooms')+'</div><div class="qi-sval ca">'+roomCount+'</div></div>'+
          '<div class="qi-stat"><div class="qi-slbl">👤</div><div class="qi-sval">'+h.ppl+'</div></div>'+
          '<div class="qi-stat"><div class="qi-slbl">TR</div><div class="qi-sval ca">'+h.tr+'</div></div>'+
          '<div class="qi-stat"><div class="qi-slbl">CFM</div><div class="qi-sval">'+Number(h.cfm).toLocaleString()+'</div></div>'+
          '<div class="qi-stat"><div class="qi-slbl">BTU/h</div><div class="qi-sval cam">'+Number(h.btu).toLocaleString()+'</div></div>'+
          '<div class="qi-stat"><div class="qi-slbl">Mkt BTU</div><div class="qi-sval">'+Number(h.mkt).toLocaleString()+'</div></div>'+
          (h.devBtu>0?'<div class="qi-stat"><div class="qi-slbl">Dev</div><div class="qi-sval cam">'+Number(h.devBtu).toLocaleString()+'</div></div>':'')+
        '</div>'+
        devLine+hcLine+capHtml+(_bundleLocked?'':warnHtml)+roomDuctHtml+
      '</div>';
    if(list) list.appendChild(item);
    if(quoteView && quoteMode!=='proj'){
      var ro=document.createElement('div');
      ro.className='quote-readonly-card';
      ro.innerHTML=
        '<div class="quote-readonly-head"><span class="qi-num">#'+(i+1)+'</span><span class="qi-name">'+name+'</span></div>'+
        '<div class="quote-readonly-grid">'+
          '<div class="quote-readonly-stat"><div class="quote-readonly-label">'+(lang==='ar'?'نوع الوحدة':'Unit Type')+'</div><div class="quote-readonly-value">'+utLabel(curUT)+'</div></div>'+
          '<div class="quote-readonly-stat"><div class="quote-readonly-label">'+(lang==='ar'?'سعة الوحدة':'Unit Capacity')+'</div><div class="quote-readonly-value">'+Number(selBtu||0).toLocaleString()+' BTU</div></div>'+
          '<div class="quote-readonly-stat"><div class="quote-readonly-label">'+(lang==='ar'?'عدد الوحدات':'Unit Count')+'</div><div class="quote-readonly-value">'+qty+'</div></div>'+
          '<div class="quote-readonly-stat"><div class="quote-readonly-label">'+(lang==='ar'?'عدد الغرف':'Room Count')+'</div><div class="quote-readonly-value">'+roomCount+'</div></div>'+
        '</div>'+
        '<div class="qi-price-row qi-price-row-simple quote-price-row">'+
          '<div>'+
            '<div class="qi-plbl">'+(lang==='ar'?'سعر الوحدة':'Unit Price')+'</div>'+
            '<input class="minp" type="number" min="0" step="0.01" value="'+(up||'')+'" placeholder="0.00" onchange="setUp('+i+',this.value)">'+
          '</div>'+
          '<div class="qi-lt-box">'+
            '<div class="qi-lt-lbl">'+(lang==='ar'?'الإجمالي':'Total')+'</div>'+
            '<div class="qi-lt-val" id="qlt-'+i+'">'+money(lt)+'</div>'+
          '</div>'+
        '</div>'+
        '<div class="quote-readonly-note">'+(getQtyAutoReason(i)?getQtyAutoReason(i)+'<br>':'')+(lang==='ar'?'يتم تعديل نوع التكييف والسعة من التقرير الفني فقط.':'AC type and capacity are edited from the technical report only.')+'</div>';
      quoteView.appendChild(ro);
    }
  });
  refreshGrandTotal();
}

function setQtyAuto(i, enabled){
  var line = ensureQuoteLine(i);
  line.qtyAuto = enabled !== false;
  if(line.qtyAuto){
    syncQuoteLineRecommendation(i,{keepSelectedCapacity:true});
  } else {
    line.autoReason = buildAutoQtyReason('manual');
  }
  save();
  renderQuote();
}
function setQty(i,v){
  var line = ensureQuoteLine(i);
  if(line.qtyAuto !== false) return;
  line.qty=Math.max(1,parseInt(v)||1);
  line.autoReason = buildAutoQtyReason('manual');
  save();
  var e=G('qlt-'+i); if(e) e.textContent=money(getQty(i)*getUP(i));
  refreshGrandTotal();
  renderQuote();
}
function stepQuoteQty(i,delta){
  if(getQtyAuto(i)) return;
  setQty(i,getQty(i)+(parseInt(delta,10)||0));
}
function setUnitType(i,v){
  var line = ensureQuoteLine(i);
  var oldType=line.unitType||'split';
  var newType=v||'split';
  line.unitType=newType;
  if(oldType!==newType){
    syncQuoteLineRecommendation(i,{unitType:newType});
  } else if(line.qtyAuto !== false){
    syncQuoteLineRecommendation(i,{unitType:newType,keepSelectedCapacity:true});
  }
  save(); renderQuote();
}

function setUp(i,v){ if(!qlines[i]) qlines[i]={qty:1,up:0}; qlines[i].up=parseFloat(v)||0; save(); var e=G('qlt-'+i); if(e) e.textContent=money(getQty(i)*getUP(i)); refreshGrandTotal(); }

function refreshGrandTotal(){
  var totalQty=0, subtotal=0;
  for(var i=0;i<hist.length;i++){ totalQty+=getQty(i); subtotal+=getQty(i)*getUP(i); }
  var ip=parseInt((G('qs-inst')||{value:'10'}).value)||10;
  var instAmt=subtotal*ip/100;
  var vatBase=subtotal+instAmt;
  var vatAmt=vatOn?vatBase*0.15:0;
  var grand=vatBase+vatAmt;
  var cur=t('cur');
  var isl=G('qs-instl'); if(isl) isl.textContent=t('qsinstl')+' ('+ip+'%)';
  var sv=G('qs-subtotal-v'); if(sv) sv.textContent=cur+' '+money(subtotal);
  var iv=G('qs-inst-v'); if(iv) iv.textContent=cur+' '+money(instAmt);
  var vr=G('vat-row'); if(vr) vr.style.display=vatOn?'':'none';
  var vv=G('qs-vat-v'); if(vv) vv.textContent=cur+' '+money(vatAmt);
  G('qt-total-qty').textContent=totalQty;
  G('qt-grand').textContent=cur+' '+money(grand);
}

// ── CSV EXPORT ────────────────────────────────────────────────────────────
function exportCSV(){
  if(!hist.length){ toast(lang==='ar'?'\u26a0\ufe0f \u0644\u0627 \u062a\u0648\u062c\u062f \u063a\u0631\u0641':'\u26a0\ufe0f No rooms saved'); return; }
  var proj=G('quote-project').value.trim()||(lang==='ar'?'\u063a\u064a\u0631 \u0645\u062d\u062f\u062f':'Untitled');
  var qno=G('quote-no').value.trim()||'Q-001';
  var today=new Date().toISOString().slice(0,10);
  var ip=parseInt((G('qs-inst')||{value:'10'}).value)||10;
  var vd=parseInt((G('qs-validity')||{value:'14'}).value)||14;
  var notes=(G('qs-notes')||{value:''}).value||'';
  var subtotal=0,totalQty=0;
  for(var i=0;i<hist.length;i++){totalQty+=getQty(i);subtotal+=getQty(i)*getUP(i);}
  var instAmt=subtotal*ip/100;
  var vatBase=subtotal+instAmt;
  var vatAmt=vatOn?vatBase*0.15:0;
  var grand=vatBase+vatAmt;
  var rows=[];
  if(lang==='ar'){
    rows.push(['AirCalc Pro \u2014 \u0639\u0631\u0636 \u0627\u0644\u0633\u0639\u0631','','','','','','','','','','','','']);
    rows.push(['\u0627\u0633\u0645 \u0627\u0644\u0645\u0634\u0631\u0648\u0639',proj,'','','','','','','','','','','']);
    rows.push(['\u0631\u0642\u0645 \u0639\u0631\u0636 \u0627\u0644\u0633\u0639\u0631',qno,'','','','','','','','','','','']);
    rows.push(['\u0627\u0644\u062a\u0627\u0631\u064a\u062e',today,'','','','','','','','','','','']);
    rows.push(['\u0635\u0644\u0627\u062d\u064a\u0629 \u0627\u0644\u0639\u0631\u0636',vd+' \u064a\u0648\u0645','','','','','','','','','','','']);
    rows.push(['','','','','','','','','','','','','']);
    rows.push(['#','\u0646\u0648\u0639 \u0627\u0644\u063a\u0631\u0641\u0629','\u0646\u0648\u0639 \u0627\u0644\u0648\u062d\u062f\u0629','\u0627\u0644\u0633\u0639\u0629 \u0627\u0644\u0645\u062e\u062a\u0627\u0631\u0629','\u0627\u0644\u062d\u062c\u0645 \u0645\u00b3','\u0639\u062f\u062f \u0627\u0644\u063a\u0631\u0641','\u0623\u0634\u062e\u0627\u0635','\u062d\u0645\u0644 \u0627\u0644\u0623\u062c\u0647\u0632\u0629 BTU/h','TR','CFM','BTU/h','\u0633\u0648\u0642 BTU','ASHRAE','\u0627\u0644\u0643\u0645\u064a\u0629','\u0633\u0639\u0631 \u0627\u0644\u0648\u062d\u062f\u0629','\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0633\u0637\u0631']);
    hist.forEach(function(h,i){
      var hc=h.sup?'S:'+h.sup+' OA:'+h.oa+' Exh:'+h.exh+' '+h.pres:'\u2014';
      var _ut=utLabel(getUT(i));
      var _sb=getSelBtu(i)||acRoundBtu(parseInt(h.btu)||0,'btu');
      rows.push([i+1,h.ar||h.en,_ut,Number(_sb).toLocaleString()+' BTU',h.vol,getRecordRoomCount(i),h.ppl,h.devBtu||0,h.tr,h.cfm,h.btu,h.mkt,hc,getQty(i),getUP(i),money(getQty(i)*getUP(i))]);
    });
    rows.push(['','','','','','','','','','','','','']);
    rows.push(['\u0627\u0644\u0645\u062c\u0645\u0648\u0639 \u0627\u0644\u0641\u0631\u0639\u064a','\u0631.\u0633 '+money(subtotal),'','','','','','','','','','','']);
    rows.push(['\u0627\u0644\u062a\u0631\u0643\u064a\u0628 ('+ip+'%)','\u0631.\u0633 '+money(instAmt),'','','','','','','','','','','']);
    if(vatOn) rows.push(['\u0636\u0631\u064a\u0628\u0629 \u0627\u0644\u0642\u064a\u0645\u0629 \u0627\u0644\u0645\u0636\u0627\u0641\u0629 15%','\u0631.\u0633 '+money(vatAmt),'','','','','','','','','','','']);
    rows.push(['\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0643\u0645\u064a\u0629',totalQty,'','','','','','','','','','','']);
    rows.push(['\u0627\u0644\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0646\u0647\u0627\u0626\u064a','\u0631.\u0633 '+money(grand),'','','','','','','','','','','']);
    if(notes) rows.push(['\u0645\u0644\u0627\u062d\u0638\u0627\u062a',notes,'','','','','','','','','','','']);
    rows.push(['','','','','','','','','','','','','']);
    rows.push(['\u062a\u0646\u0628\u064a\u0647: \u062a\u0642\u062f\u064a\u0631 \u0623\u0648\u0644\u064a \u2014 \u0644\u0627 \u064a\u064f\u0639\u062a\u0645\u062f \u0644\u0644\u062a\u0635\u0645\u064a\u0645 \u0627\u0644\u0646\u0647\u0627\u0626\u064a','','','','','','','','','','','','']);
  } else {
    rows.push(['AirCalc Pro \u2014 Quotation','','','','','','','','','','','','']);
    rows.push(['Project Name',proj,'','','','','','','','','','','']);
    rows.push(['Quotation No.',qno,'','','','','','','','','','','']);
    rows.push(['Date',today,'','','','','','','','','','','']);
    rows.push(['Validity',vd+' days','','','','','','','','','','','']);
    rows.push(['','','','','','','','','','','','','']);
    rows.push(['#','Room Type','System Type','Selected Capacity','Volume m\u00b3','Room Count','Persons','Device Load BTU/h','TR','CFM','BTU/h','Market BTU','ASHRAE','Quantity','Unit Price','Line Total']);
    hist.forEach(function(h,i){
      var hc=h.sup?'S:'+h.sup+' OA:'+h.oa+' Exh:'+h.exh+' '+h.pres:'\u2014';
      var _ut2=utLabel(getUT(i));
      var _sb2=getSelBtu(i)||acRoundBtu(parseInt(h.btu)||0,'btu');
      rows.push([i+1,h.en||h.ar,_ut2,Number(_sb2).toLocaleString()+' BTU',h.vol,getRecordRoomCount(i),h.ppl,h.devBtu||0,h.tr,h.cfm,h.btu,h.mkt,hc,getQty(i),getUP(i),money(getQty(i)*getUP(i))]);
    });
    rows.push(['','','','','','','','','','','','','']);
    rows.push(['Equipment Subtotal','SAR '+money(subtotal),'','','','','','','','','','','']);
    rows.push(['Installation ('+ip+'%)','SAR '+money(instAmt),'','','','','','','','','','','']);
    if(vatOn) rows.push(['VAT 15%','SAR '+money(vatAmt),'','','','','','','','','','','']);
    rows.push(['Total Quantity',totalQty,'','','','','','','','','','','']);
    rows.push(['Grand Total','SAR '+money(grand),'','','','','','','','','','','']);
    if(notes) rows.push(['Notes',notes,'','','','','','','','','','','']);
    rows.push(['','','','','','','','','','','','','']);
    rows.push(['Notice: Preliminary estimate \u2014 not for final design submittal','','','','','','','','','','','','']);
  }
  var csv=rows.map(function(r){
    return r.map(function(c){var s=String(c).replace(/"/g,'""');return /[,"\n]/.test(s)?'"'+s+'"':s;}).join(',');
  }).join('\r\n');
  var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='quotation_'+qno.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g,'_')+'.csv';a.click();
  toast(lang==='ar'?'📄 \u062a\u0645 \u062a\u0635\u062f\u064a\u0631 \u0627\u0644\u0645\u0644\u0641':'📄 CSV exported');
}

function xmlEscape(v){
  return String(v == null ? '' : v)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&apos;');
}
function sheetColName(n){
  var s = '';
  while(n >= 0){
    s = String.fromCharCode((n % 26) + 65) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}
function sheetXmlFromRows(rows){
  var xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
  rows.forEach(function(row, rIdx){
    xml += '<row r="'+(rIdx+1)+'">';
    row.forEach(function(cell, cIdx){
      var ref = sheetColName(cIdx) + (rIdx + 1);
      var val = cell == null ? '' : cell;
      if(typeof val === 'number' && isFinite(val)){
        xml += '<c r="'+ref+'"><v>'+val+'</v></c>';
      } else {
        xml += '<c r="'+ref+'" t="inlineStr"><is><t>'+xmlEscape(val)+'</t></is></c>';
      }
    });
    xml += '</row>';
  });
  xml += '</sheetData></worksheet>';
  return xml;
}
function uint16LE(n){ return [n & 255, (n >>> 8) & 255]; }
function uint32LE(n){ return [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255]; }
var _crcTable = null;
function getCrcTable(){
  if(_crcTable) return _crcTable;
  _crcTable = [];
  for(var n=0; n<256; n++){
    var c = n;
    for(var k=0; k<8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    _crcTable[n] = c >>> 0;
  }
  return _crcTable;
}
function crc32(bytes){
  var table = getCrcTable();
  var crc = 0 ^ (-1);
  for(var i=0;i<bytes.length;i++) crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
  return (crc ^ (-1)) >>> 0;
}
function utf8Bytes(str){
  return new TextEncoder().encode(str);
}
function makeStoredZip(files){
  var localParts = [];
  var centralParts = [];
  var offset = 0;
  files.forEach(function(file){
    var nameBytes = utf8Bytes(file.name);
    var dataBytes = utf8Bytes(file.data);
    var crc = crc32(dataBytes);
    var localHeader = new Uint8Array([
      0x50,0x4b,0x03,0x04,
      20,0,0,0,0,0,0,0,0,0,
      ...uint32LE(crc),
      ...uint32LE(dataBytes.length),
      ...uint32LE(dataBytes.length),
      ...uint16LE(nameBytes.length),
      0,0
    ]);
    localParts.push(localHeader, nameBytes, dataBytes);
    var centralHeader = new Uint8Array([
      0x50,0x4b,0x01,0x02,
      20,0,20,0,0,0,0,0,0,0,
      ...uint32LE(crc),
      ...uint32LE(dataBytes.length),
      ...uint32LE(dataBytes.length),
      ...uint16LE(nameBytes.length),
      0,0,0,0,0,0,0,0,
      ...uint32LE(0),
      ...uint32LE(offset)
    ]);
    centralParts.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + dataBytes.length;
  });
  var centralSize = centralParts.reduce(function(s,part){ return s + part.length; }, 0);
  var endRecord = new Uint8Array([
    0x50,0x4b,0x05,0x06,
    0,0,0,0,
    ...uint16LE(files.length),
    ...uint16LE(files.length),
    ...uint32LE(centralSize),
    ...uint32LE(offset),
    0,0
  ]);
  return new Blob(localParts.concat(centralParts).concat([endRecord]), {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
}
function buildHapWorkbookBlob(roomRows, summaryRows, metaRows){
  var files = [
    {name:'[Content_Types].xml', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>'},
    {name:'_rels/.rels', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>'},
    {name:'docProps/app.xml', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>AirCalc Pro</Application></Properties>'},
    {name:'docProps/core.xml', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>AirCalc HAP Export</dc:title><dc:creator>AirCalc Pro</dc:creator></cp:coreProperties>'},
    {name:'xl/workbook.xml', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="'+xmlEscape(t('haprooms'))+'" sheetId="1" r:id="rId1"/><sheet name="'+xmlEscape(t('hapsummary'))+'" sheetId="2" r:id="rId2"/><sheet name="'+xmlEscape(t('hapmeta'))+'" sheetId="3" r:id="rId3"/></sheets></workbook>'},
    {name:'xl/_rels/workbook.xml.rels', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'},
    {name:'xl/styles.xml', data:'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs></styleSheet>'},
    {name:'xl/worksheets/sheet1.xml', data:sheetXmlFromRows(roomRows)},
    {name:'xl/worksheets/sheet2.xml', data:sheetXmlFromRows(summaryRows)},
    {name:'xl/worksheets/sheet3.xml', data:sheetXmlFromRows(metaRows)}
  ];
  return makeStoredZip(files);
}
function safeVal(v, fallback){
  return v == null || v === '' || (typeof v === 'number' && !isFinite(v)) ? (fallback == null ? '' : fallback) : v;
}
function exportHAP(){
  if(!hist.length){ toast(lang==='ar'?'⚠️ لا توجد غرف محفوظة':'⚠️ No saved rooms'); return; }
  var projectName = ((G('quote-project')||{value:''}).value || (G('tech-project')||{value:''}).value || '').trim() || (lang==='ar'?'غير محدد':'Untitled');
  var today = new Date().toISOString().slice(0,10);
  var roomRows = [[
    'Room Name','Room Type','Calculation Mode','Volume','Area','Height','People','Equipment Load','Load Factor','Fresh Air Mode','Outdoor Air CFM','Recirculated CFM','Exhaust CFM','Total CFM','Total BTU','TR','ACH','Pressure'
  ]];
  var totalBtu = 0, totalTr = 0, totalCfm = 0;
  hist.forEach(function(h){
    var dims = h.dims || {};
    var area = (Number(dims.len||0) * Number(dims.width||0)) || 0;
    var modeLabel = h.calcMode === 'hc' ? t('ashraehc') : t('loadmode');
    var freshAirModeLabel = h.calcMode === 'hc'
      ? (h.freshAirMode === 'fresh100' ? t('fresh100lbl') : t('mixedair'))
      : '';
    roomRows.push([
      safeVal(lang==='ar'?(h.ar||h.en):(h.en||h.ar)),
      safeVal(h.roomType || (lang==='ar'?(h.ar||h.en):(h.en||h.ar))),
      safeVal(modeLabel),
      Number(h.vol||0),
      Number(area.toFixed(2)),
      Number(dims.height||0),
      Number(h.ppl||0),
      Number(h.equipmentBtu||0),
      h.calcMode === 'hc' ? '' : Number(h.loadFactor||0),
      safeVal(freshAirModeLabel),
      Number(h.oa||0),
      Number(h.recirc||0),
      Number(h.exh||0),
      Number(h.cfm||0),
      Number(h.btu||0),
      Number(h.tr||0),
      h.ach != null ? Number(h.ach) : '',
      safeVal(h.pressure || h.pres || '')
    ]);
    totalBtu += Number(h.btu||0);
    totalTr += Number(h.tr||0);
    totalCfm += Number(h.cfm||0);
  });
  var summaryRows = [
    ['Metric','Value'],
    ['Total Rooms', hist.length],
    ['Total BTU', totalBtu],
    ['Total TR', Number(totalTr.toFixed(2))],
    ['Total CFM', totalCfm]
  ];
  var metaRows = [
    ['Project Name', projectName],
    ['Date', today],
    ['Mode', quoteMode === 'proj' ? 'Project' : 'Room']
  ];
  var blob = buildHapWorkbookBlob(roomRows, summaryRows, metaRows);
  var a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'AirCalc_HAP_Export_' + today + '.xlsx';
  a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
  toast(lang==='ar'?'📊 تم تصدير ملف HAP':'📊 HAP export downloaded');
}
function exportInvoiceHTML(){
  if(!hist.length){ toast(lang==='ar'?'⚠️ لا توجد غرف':'⚠️ No rooms'); return; }
  var win=window.open('','_blank');
  if(!win){ toast(lang==='ar'?'⚠️ افتح منبثقات المتصفح':'⚠️ Allow popups'); return; }
  win.document.write(buildInvoiceHTML());
  win.document.close();
}


// ── SHARED INVOICE HELPERS ─────────────────────────────────────────────────
function invCommon(){
  var proj = (G('quote-project')||{value:''}).value.trim()||(lang==='ar'?'غير محدد':'Untitled');
  var qno  = (G('quote-no')||{value:''}).value.trim()||'Q-001';
  var today = new Date().toLocaleDateString(lang==='ar'?'ar-SA':'en-GB');
  var ip = parseInt(((G('qs-inst')||{value:'10'})).value)||10;
  var validDays = parseInt(((G('qs-validity')||{value:'14'})).value)||14;
  var validLabel = lang==='ar'
    ? validDays+(validDays===7?' أيام':' يوم')
    : validDays+' days';
  var notes = (G('qs-notes')||{value:''}).value||'';
  var isAr = lang==='ar';
  var dir  = isAr?'rtl':'ltr';
  var cur  = t('cur');
  var subtotal=0, totalQty=0;
  for(var i=0;i<hist.length;i++){ totalQty+=getQty(i); subtotal+=getQty(i)*getUP(i); }
  var instAmt = subtotal*ip/100;
  var vatBase = subtotal+instAmt;
  var vatAmt  = vatOn ? vatBase*0.15 : 0;
  var grand   = vatBase+vatAmt;
  var fontLink = isAr
    ? '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">'
    : '<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet">';
  var bodyFont = isAr ? "'Cairo', Arial, sans-serif" : "'Segoe UI', Arial, sans-serif";
  var utLbls={}; Object.keys(UT_LABELS_AR).forEach(function(k){utLbls[k]=isAr?UT_LABELS_AR[k]:UT_LABELS_EN[k];}); utLbls['chillerfcu']=isAr?'وحدة مناولة / FCU':'FCU (Chilled Water)'; utLbls['chiller']=isAr?'تشيلر هوائي':'Chiller (Air-Cooled)';
  return {proj:proj,qno:qno,today:today,ip:ip,validDays:validDays,validLabel:validLabel,notes:notes,isAr:isAr,dir:dir,cur:cur,subtotal:subtotal,totalQty:totalQty,instAmt:instAmt,vatBase:vatBase,vatAmt:vatAmt,grand:grand,fontLink:fontLink,bodyFont:bodyFont,utLbls:utLbls,isBundleProj:(bundleOn&&quoteMode==='proj')};
}

function invSharedCss(c){
  return '*{margin:0;padding:0;box-sizing:border-box;}'
    +' body{font-family:'+c.bodyFont+';background:#ffffff;color:#1e293b;direction:'+c.dir+';}'
    +' .inv-page{width:794px;background:#ffffff;padding:36px 44px;page-break-after:always;}'
    +' .inv-header{display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:24px;padding-bottom:18px;border-bottom:3px solid #0f172a;gap:20px;}'
    +' .inv-brand{display:flex;align-items:center;gap:12px;}'
    +' .inv-brand-icon{width:48px;height:48px;background:linear-gradient(135deg,#0ea5e9,#0369a1);border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:22px;font-weight:700;}'
    +' .inv-brand-name{font-size:20px;font-weight:700;color:#0f172a;letter-spacing:1px;}'
    +' .inv-brand-sub{font-size:11px;color:#64748b;margin-top:2px;}'
    +' .inv-meta-grid{display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:10px;margin-bottom:22px;background:#f8fafc;border-radius:8px;padding:14px;border:1px solid #e2e8f0;}'
    +' .inv-meta-item{}'
    +' .inv-meta-lbl{font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;}'
    +' .inv-meta-val{font-size:13px;font-weight:600;color:#0f172a;}'
    +' .page-title{font-size:14px;font-weight:700;color:#0f172a;margin-bottom:14px;padding-bottom:8px;border-bottom:2px solid #e2e8f0;display:flex;align-items:center;gap:8px;}'
    +' .page-badge{font-size:10px;font-weight:700;padding:2px 10px;border-radius:20px;}'
    +' .page-badge.client{background:#dbeafe;color:#1d4ed8;}'
    +' .page-badge.tech{background:#dcfce7;color:#166534;}'
    +' table{width:100%;border-collapse:collapse;margin-bottom:16px;font-size:12px;}'    +' .tbl-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-bottom:16px;}'    +' .tbl-wrap table{margin-bottom:0;}'    +' @media(max-width:600px){table{font-size:11px;}th,td{padding:6px 8px;}}'
    +' th{padding:9px 8px;font-weight:700;text-align:center;background:#0f172a;color:#fff;}'
    +' td{padding:8px 8px;border-bottom:1px solid #e2e8f0;text-align:center;vertical-align:middle;}'
    +' tr:hover td{background:#f8fafc;}'
    +' .totals-box{background:#f8fafc;border-radius:8px;padding:16px;border:1px solid #e2e8f0;margin-bottom:16px;}'
    +' .tot-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;font-size:13px;border-bottom:1px solid #e2e8f0;}'
    +' .tot-row:last-child{border-bottom:none;padding-top:10px;font-size:15px;font-weight:700;color:#0ea5e9;}'
    +' .tot-lbl{color:#475569;}'
    +' .tot-val{font-weight:600;color:#0f172a;}'
    +' .warn-box{background:#fffbeb;border:1px solid #f59e0b;border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:11px;color:#92400e;}'
    +' .warn-inline{background:#fffbeb;border:1px solid #fbbf24;border-radius:4px;padding:6px 10px;font-size:11px;color:#92400e;margin-top:6px;}'
    +' .badge-ok{display:inline-block;background:#dcfce7;color:#166534;border-radius:12px;padding:2px 8px;font-size:10px;font-weight:700;}'
    +' .badge-warn{display:inline-block;background:#fef3c7;color:#d97706;border-radius:12px;padding:2px 8px;font-size:10px;font-weight:700;}'
    +' .badge-over{display:inline-block;background:#dbeafe;color:#1d4ed8;border-radius:12px;padding:2px 8px;font-size:10px;font-weight:700;}'
    +' .footer{margin-top:auto;padding-top:14px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;text-align:center;}'
    +' .td-name{text-align:'+(c.isAr?'right':'left')+';padding-'+( c.isAr?'right':'left')+':12px;}'
    +' .sec-lbl{font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.5px;margin:14px 0 8px;}'
    +' .hc-detail-box{background:#f0f9ff;border:1px solid #bae6fd;border-radius:6px;padding:10px 12px;margin-bottom:8px;font-size:11px;}'
    +' .hc-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;}'
    +' .hc-item{text-align:center;}'
    +' .hc-lbl{color:#64748b;font-size:10px;}'
    +' .hc-val{font-weight:700;color:#0369a1;font-size:13px;margin-top:2px;}'
    +' .room-tech-card{border:1px solid #e2e8f0;border-radius:8px;margin-bottom:12px;overflow:hidden;}'
    +' .room-tech-head{background:#0f172a;color:#fff;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;}'
    +' .room-tech-body{padding:12px 14px;}'
    +' .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:10px;}'
    +' .stat-item{text-align:center;background:#f8fafc;border-radius:6px;padding:8px 4px;}'
    +' .stat-lbl{font-size:10px;color:#64748b;}'
    +' .stat-val{font-size:14px;font-weight:700;color:#0ea5e9;margin-top:2px;}';
}

function buildPage1(c){
  // Client Summary Page
  var rows='';
  for(var i=0;i<hist.length;i++){
    var h=hist[i];
    var _nm=c.isAr?(h.ar||h.en):(h.en||h.ar);
    var name=_nm.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/gu,'').trim();
    var utKey=getUT(i); var utLbl=c.utLbls[utKey]||utKey;
    var selBtu=getSelBtu(i)||acRoundBtu(parseInt(h.btu)||0,'btu');
    var selTR=(selBtu/12000).toFixed(1);
    var lt=getQty(i)*getUP(i);
    var bg=i%2===0?'#ffffff':'#f8fafc';
    rows+='<tr style="background:'+bg+'">'
      +'<td style="color:#64748b">'+(i+1)+'</td>'
      +'<td class="td-name">'+name+'<div style="font-size:10px;color:#0ea5e9;margin-top:1px;font-weight:600">'+utLbl+'</div></td>'
      +'<td>'+h.vol+'</td>'
      +'<td>'+getRecordRoomCount(i)+'</td>'
      +'<td>'+Number(selBtu).toLocaleString()+' BTU</td>'
      +'<td>'+selTR+' TR</td>'
      +'<td>'+getQty(i)+'</td>'
      +'<td>'+c.cur+' '+money(getUP(i))+'</td>'
      +'<td style="color:#059669;font-weight:700">'+c.cur+' '+money(lt)+'</td>'
      +(function(){
        var _rb=parseInt(h.btu)||0;
        var _sb=getSelBtu(i)||acRoundBtu(_rb,'btu');
        var _ef=_sb*getQty(i);
        var _raw=_rb>0?((_ef-_rb)/_rb*100):0;
        var _rnd=Math.round(_raw*10)/10;
        var _pct=(_rnd>=0?'+':'')+_rnd.toFixed(1)+'%';
        var _bc,_bt;
        if(_raw<0){
          var _abs2=Math.abs(_rnd);
          if(_abs2>15){_bc='#dc2626';_bt='⛔ '+(c.isAr?'عجز شديد':'Severe Deficit')+' '+_rnd.toFixed(1)+'%';}
          else{_bc='#d97706';_bt='⚠ '+(c.isAr?'عجز سعة':'Deficit')+' '+_rnd.toFixed(1)+'%';}
        } else if(_raw<=5){_bc='#059669';_bt='✓ '+(c.isAr?'مطابقة':'Match')+' '+_pct;}
        else if(_raw<=25){_bc='#4f46e5';_bt=(c.isAr?'سعة زائدة':'Slight oversize')+' '+_pct;}
        else{_bc='#6b7280';_bt=(c.isAr?'سعة عالية':'High oversize')+' '+_pct;}
        return '<td style="text-align:center"><span style="font-size:10px;font-weight:700;color:'+_bc+'">'+_bt+'</span></td>';
      })()
      +'</tr>';
  }
  var vatRowHtml = vatOn
    ? '<div class="tot-row"><span class="tot-lbl">'+(c.isAr?'ضريبة القيمة المضافة 15%':'VAT 15%')+'</span><span class="tot-val" style="color:#d97706">'+c.cur+' '+money(c.vatAmt)+'</span></div>'
    : '';
  var notesHtml = c.notes
    ? '<div style="margin-bottom:14px;padding:10px 14px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0"><div style="font-size:10px;color:#94a3b8;margin-bottom:4px">'+(c.isAr?'ملاحظات':'Notes')+'</div><div style="font-size:12px;color:#334155">'+c.notes.replace(/\n/g,'<br>')+'</div></div>'
    : '';
  var th=c.isAr?'background:#0f172a;color:#fff;padding:9px 8px;font-weight:700;text-align:right;padding-right:12px':'background:#0f172a;color:#fff;padding:9px 8px;font-weight:700;text-align:left;padding-left:12px';
  var thC='background:#0f172a;color:#fff;padding:9px 8px;font-weight:700;text-align:center;';
  return '<div class="inv-page" id="pdf-page1">'
    +'<div class="inv-header">'
      +'<div class="inv-brand">'
        +'<div class="inv-brand-icon">❄</div>'
        +'<div><div class="inv-brand-name">AirCalc Pro</div>'
        +'<div class="inv-brand-sub">HVAC Engineering Suite</div></div>'
      +'</div>'
      +'<div style="text-align:'+(c.isAr?'left':'right')+'">'
        +'<div style="font-size:18px;font-weight:700;color:#0f172a">'+(c.isAr?'عرض سعر':'Quotation')+'</div>'
        +'<div style="font-size:13px;color:#64748b;margin-top:3px"># '+c.qno+'</div>'
      +'</div>'
    +'</div>'
    +'<div class="inv-meta-grid">'
      +'<div class="inv-meta-item"><div class="inv-meta-lbl">'+(c.isAr?'المشروع':'Project')+'</div><div class="inv-meta-val">'+c.proj+'</div></div>'
      +'<div class="inv-meta-item"><div class="inv-meta-lbl">'+(c.isAr?'التاريخ':'Date')+'</div><div class="inv-meta-val">'+c.today+'</div></div>'
      +'<div class="inv-meta-item"><div class="inv-meta-lbl">'+(c.isAr?'صلاحية العرض':'Validity')+'</div><div class="inv-meta-val">'+c.validLabel+'</div></div>'
      +'<div class="inv-meta-item"><div class="inv-meta-lbl">'+(c.isAr?'عدد البنود':'Items')+'</div><div class="inv-meta-val">'+hist.length+'</div></div>'
    +'</div>'
    +'<div class="page-title">'+(c.isAr?'ملخص العميل':'Client Summary')+'<span class="page-badge client">'+(c.isAr?'صفحة العميل':'Page 1 / Client')+'</span></div>'
    +'<div class="tbl-wrap"><table>'
      +'<thead><tr>'
        +'<th style="'+thC+'">#</th>'
        +'<th style="'+th+'">'+(c.isAr?'نوع الغرفة / النظام':'Room / System')+'</th>'
        +'<th style="'+thC+'">m³</th>'
        +'<th style="'+thC+'">'+(c.isAr?'عدد الغرف':'Room Count')+'</th>'
        +'<th style="'+thC+'">BTU/h</th>'
        +'<th style="'+thC+'">TR</th>'
        +'<th style="'+thC+'">'+(c.isAr?'الكمية':'Qty')+'</th>'
        +'<th style="'+thC+'">'+(c.isAr?'سعر الوحدة':'Unit Price')+'</th>'
        +'<th style="'+thC+'">'+(c.isAr?'الإجمالي':'Total')+'</th>'
        +'<th style="'+thC+'">'+(c.isAr?'الحالة':'Status')+'</th>'
      +'</tr></thead>'
      +'<tbody>'+rows+'</tbody>'
    +'</table></div>'
    +'<div class="totals-box">'
      +'<div class="tot-row"><span class="tot-lbl">'+(c.isAr?'المجموع الفرعي':'Subtotal')+'</span><span class="tot-val">'+c.cur+' '+money(c.subtotal)+'</span></div>'
      +'<div class="tot-row"><span class="tot-lbl">'+(c.isAr?'التركيب ('+c.ip+'%)':'Installation ('+c.ip+'%)')+'</span><span class="tot-val">'+c.cur+' '+money(c.instAmt)+'</span></div>'
      +vatRowHtml
      +'<div class="tot-row"><span class="tot-lbl">'+(c.isAr?'الإجمالي النهائي':'Grand Total')+'</span><span class="tot-val">'+c.cur+' '+money(c.grand)+'</span></div>'
    +'</div>'
    +notesHtml
    +'<div class="footer">AirCalc Pro — HVAC Engineering Suite &copy; '+new Date().getFullYear()+' &nbsp;|&nbsp; '+(c.isAr?'هذا العرض صالح لمدة':'Valid for')+' '+c.validLabel+'</div>'
    +'</div>';
}

function buildPage2(c){
  // Technician Detail Page
  var cards='';
  var anyUndersized=false, undersizedCount=0;
  for(var i=0;i<hist.length;i++){
    var h=hist[i];
    var _nm=c.isAr?(h.ar||h.en):(h.en||h.ar);
    var name=_nm.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/gu,'').trim();
    var utKey=getUT(i); var utLbl=c.utLbls[utKey]||utKey;
    var reqBtu=parseInt(h.btu)||0;
    // In project/bundle mode, per-room selBtu is irrelevant — use reqBtu to neutralise room warnings
    var _isBundleMode = (quoteMode==='proj') || bundleOn;
    var selBtu = _isBundleMode ? acRoundBtu(reqBtu,'btu') : (getSelBtu(i)||acRoundBtu(reqBtu,'btu'));
    var effCap = _isBundleMode ? reqBtu : selBtu*getQty(i);
    var marginPct=reqBtu>0?Math.round((effCap/reqBtu-1)*100):0;
    if(!_isBundleMode && reqBtu>0&&effCap<reqBtu){ anyUndersized=true; undersizedCount++; }
    var reqTR=(reqBtu/12000).toFixed(1), effTR=(effCap/12000).toFixed(1);
    var selTR=(selBtu/12000).toFixed(1);
    // Warning or badge
    var warnHtml='';
    var d2raw=reqBtu>0?((effCap-reqBtu)/reqBtu*100):0;
    var d2rnd=Math.round(d2raw*10)/10, d2abs=Math.abs(d2rnd);
    var d2pct=(d2rnd>=0?'+':'')+d2rnd.toFixed(1)+'%';
    if(d2raw < 0){
      var d2icon=d2abs>15?'⛔':'⚠';
      var d2bgc=d2abs>15?'#fef2f2':'#fffbeb';
      var d2bc=d2abs>15?'#fca5a5':'#fbbf24';
      var d2tc=d2abs>15?'#dc2626':'#d97706';
      var d2lbl=c.isAr?(d2abs>15?'عجز سعة BTU شديد':'عجز سعة BTU طفيف'):(d2abs>15?'Severe BTU Deficit':'Mild BTU Deficit');
      warnHtml='<div style="background:'+d2bgc+';border:1px solid '+d2bc+';border-radius:4px;padding:8px 10px;font-size:11px;color:'+d2tc+'">'+d2icon+' '+d2lbl+': '+d2rnd.toFixed(1)+'% | '+(c.isAr?'المطلوب':'Req')+': '+Number(reqBtu).toLocaleString()+' BTU | '+(c.isAr?'المختار':'Sel')+': '+Number(effCap).toLocaleString()+' BTU</div>';
    } else if(d2raw <= 5){
      warnHtml='<span class="badge-ok">✓ '+(c.isAr?'مطابقة':'Match')+' '+d2pct+'</span>';
    } else if(d2raw <= 25){
      warnHtml='<span class="badge-over">'+(c.isAr?'سعة زائدة':'Slight oversize')+' '+d2pct+'</span>';
    } else {
      warnHtml='<span style="display:inline-block;background:#ede9fe;color:#7c3aed;border-radius:12px;padding:2px 8px;font-size:10px;font-weight:700">'+(c.isAr?'سعة عالية':'High oversize')+' '+d2pct+'</span>';
    }
    var roomLogicHtml='';
    if(h.roomType || h.ach || h.oaStd || h.exhaust || h.pressure || h.freshAirMode){
      roomLogicHtml='<div class="hc-detail-box">'+
        '<div style="font-size:10px;color:#0369a1;font-weight:700;margin-bottom:8px">'+(c.isAr?'محرك معايير الغرفة':'Room Standards Engine')+'</div>'+
        '<div class="hc-grid">'+
          '<div class="hc-item"><div class="hc-lbl">'+(c.isAr?'النوع':'Type')+'</div><div class="hc-val">'+(h.roomType||'—')+'</div></div>'+
          '<div class="hc-item"><div class="hc-lbl">'+t('calcmode')+'</div><div class="hc-val">'+(h.calcMode==='hc'?t('ashraehc'):t('loadmode'))+'</div></div>'+
          '<div class="hc-item"><div class="hc-lbl">Total ACH</div><div class="hc-val">'+(h.ach!=null?h.ach:'—')+'</div></div>'+
          '<div class="hc-item"><div class="hc-lbl">OA ACH</div><div class="hc-val">'+(h.oaStd!=null?h.oaStd:'—')+'</div></div>'+
        '</div>'+
        '<div class="hc-grid" style="margin-top:8px">'+
          '<div class="hc-item"><div class="hc-lbl">'+(c.isAr?'العادم':'Exhaust')+'</div><div class="hc-val">'+(h.exhaust!=null?h.exhaust:'—')+'</div></div>'+
          '<div class="hc-item"><div class="hc-lbl">'+(c.isAr?'الضغط':'Pressure')+'</div><div class="hc-val">'+(h.pressure||'—')+'</div></div>'+
          '<div class="hc-item"><div class="hc-lbl">'+t('freshairlabel')+'</div><div class="hc-val">'+(h.freshAirMode==='fresh100'?t('fresh100lbl'):h.calcMode==='hc'?t('mixedair'):'—')+'</div></div>'+
          '<div class="hc-item"><div class="hc-lbl">'+(c.isAr?'الفئة':'Category')+'</div><div class="hc-val">'+(h.category?getCategoryLabel(h.category):'—')+'</div></div>'+
        '</div>'+
        '<div style="margin-top:8px;font-size:10px;color:#64748b">'+(h.notes||'—')+'</div>'+
      '</div>';
    }

    // HC details
    var hcHtml='';
    if(h.sup){
      var presLbl=c.isAr?(h.pres==='positive'?'موجب':h.pres==='negative'?'سالب':'محايد'):(h.pres==='positive'?'Positive':h.pres==='negative'?'Negative':'Neutral');
      hcHtml='<div class="hc-detail-box">'
        +'<div style="font-size:10px;color:#0369a1;font-weight:700;margin-bottom:8px">ASHRAE 170</div>'
        +'<div class="hc-grid">'
          +'<div class="hc-item"><div class="hc-lbl">'+(c.isAr?'إمداد':'Supply')+'</div><div class="hc-val">'+h.sup+'</div></div>'
          +'<div class="hc-item"><div class="hc-lbl">'+(c.isAr?'هواء خارجي':'Outdoor Air')+'</div><div class="hc-val">'+(h.oa||'—')+'</div></div>'
          +'<div class="hc-item"><div class="hc-lbl">'+(c.isAr?'هواء راجع':'Recirculated')+'</div><div class="hc-val">'+(h.recirc||0)+'</div></div>'
          +'<div class="hc-item"><div class="hc-lbl">'+(c.isAr?'عادم':'Exhaust')+'</div><div class="hc-val">'+(h.exh||'—')+'</div></div>'
          +'<div class="hc-item"><div class="hc-lbl">'+(c.isAr?'الضغط':'Pressure')+'</div><div class="hc-val">'+presLbl+'</div></div>'
        +'</div>'
        +'<div style="margin-top:8px;font-size:10px;color:#64748b">'+t('freshairlabel')+': '+(h.freshAirMode==='fresh100'?t('fresh100lbl'):t('mixedair'))+'</div>'
      +'</div>';
    }
    // Devices
    var devHtml=h.devSum?'<div style="font-size:11px;color:#64748b;margin-top:6px">⚡ '+h.devSum+(h.equipmentBtu?' | '+Number(h.equipmentBtu).toLocaleString()+' BTU/h':'')+'</div>':'';
    var equipmentHtml='';
    if(h.equipmentItems && h.equipmentItems.length){
      equipmentHtml='<div style="margin-top:8px;border:1px dashed #cbd5e1;border-radius:8px;padding:8px 10px">'+
        '<div style="font-size:10px;font-weight:700;color:#0369a1;margin-bottom:6px">'+(c.isAr?'ملخص حمل الأجهزة':'Equipment Heat Load Summary')+'</div>'+
        h.equipmentItems.map(function(eq){
          return '<div style="display:flex;justify-content:space-between;gap:8px;font-size:10px;color:#334155;margin:3px 0">'+
            '<span>'+eq.name+' × '+eq.qty+'</span>'+
            '<span>'+Number(eq.btu).toLocaleString()+' BTU/h</span>'+
          '</div>';
        }).join('')+
        '<div style="display:flex;justify-content:space-between;gap:8px;font-size:10px;font-weight:700;color:#0f172a;border-top:1px solid #e2e8f0;margin-top:6px;padding-top:6px">'+
          '<span>'+(c.isAr?'الإجمالي':'Total')+'</span>'+
          '<span>'+Number(h.equipmentBtu||0).toLocaleString()+' BTU/h</span>'+
        '</div>'+
      '</div>';
    }
    // Per-room duct sizing in tech PDF
    var techDuctHtml='';
    var _techUT=getUT(i);
    var _techCfm=parseInt(h.cfm)||0;
    if(isDucted(_techUT) && (_techCfm>0||selBtu>0)){
      var _tvSup=parseInt((G('duct-vel-sup')||{value:'1000'}).value)||1000;
      var _tvRet=parseInt((G('duct-vel-ret')||{value:'800'}).value)||800;
      var _tCfmPerTr=parseInt((G('duct-cfm-per-tr')||{value:'400'}).value)||400;
      // In bundle mode: per-room duct uses required CFM (h.cfm); otherwise use getDuctCfm
      var _usedCfm, _techCfmSrcLbl;
      if(_isBundleMode && _techCfm > 0){
        _usedCfm = _techCfm;
        _techCfmSrcLbl = c.isAr ? 'CFM المطلوب للغرفة' : 'Required Room CFM';
      } else {
        var _techDuctCfm=getDuctCfm(_techUT,selBtu,_techCfm,_tCfmPerTr);
        _usedCfm=_techDuctCfm.cfm;
        _techCfmSrcLbl=c.isAr
          ?(_techDuctCfm.source==='unit'?'CFM من سعة الوحدة'
           :_techDuctCfm.source==='tr'?'CFM = TR × '+_tCfmPerTr
           :'CFM المحسوب للغرفة')
          :_techDuctCfm.label;
      }
      var _tdSup=calcDuctSize(_usedCfm,_tvSup);
      var _tdRet=calcDuctSize(_usedCfm,_tvRet);
      var _tds=_tdSup?_tdSup.std||_tdSup.calc:null;
      var _tdr=_tdRet?_tdRet.std||_tdRet.calc:null;
      // ── Actual velocity = Q / area_required × velocity_fpm (recalc from area)
      var _tActSupFpm = (_tds && _tds.area_required > 0)
        ? Math.round(_usedCfm * 2.118 / (_tds.area_required / 92903.04))  // mm²→ft² /2.118 for CFM→ft³/min
        : _tvSup;
      var _tActRetFpm = (_tdr && _tdr.area_required > 0)
        ? Math.round(Math.round(_usedCfm*0.9) * 2.118 / (_tdr.area_required / 92903.04))
        : _tvRet;
      // Use design velocity directly (selected duct is sized for it)
      var _tActSupFpm2 = _tvSup, _tActRetFpm2 = _tvRet;
      var _isHC = !!(h.sup);  // healthcare room has ASHRAE 170 sup/ret/exh fields
      var _supRt = getDuctVelocityRating(_tActSupFpm2, 'supply', _isHC);
      var _retRt = getDuctVelocityRating(_tActRetFpm2, 'return', _isHC);
      var _recTxt = ductRecommendation(_supRt, _retRt, c.isAr);
      techDuctHtml='<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:10px 12px;margin-top:8px;font-size:11px">'+
        '<div style="font-weight:700;color:#166534;margin-bottom:6px;font-size:12px">'+(c.isAr?'🌬 جدول مجاري الهواء':'🌬 Duct Schedule')+'</div>'+
        '<div style="margin-bottom:8px"><span style="font-size:10px;background:#dcfce7;color:#166534;border-radius:10px;padding:2px 8px;font-weight:600">'+_techCfmSrcLbl+'</span>'+
        ' <span style="font-size:10px;color:#374151;font-weight:700">Q = '+Number(_usedCfm).toLocaleString()+' CFM</span></div>'+
        '<table style="width:100%;border-collapse:collapse;font-size:10px">'+
          '<thead><tr style="background:#f0fdf4">'+
            '<th style="padding:4px 6px;border:1px solid #bbf7d0;text-align:'+(c.isAr?'right':'left')+';color:#374151">'+(c.isAr?'المجرى':'Duct')+'</th>'+
            '<th style="padding:4px 6px;border:1px solid #bbf7d0;text-align:center;color:#374151">CFM / m³/s</th>'+
            '<th style="padding:4px 6px;border:1px solid #bbf7d0;text-align:center;color:#374151">'+(c.isAr?'المساحة المطلوبة':'Req. Area')+'</th>'+
            '<th style="padding:4px 6px;border:1px solid #bbf7d0;text-align:center;color:#374151">'+(c.isAr?'الحجم':'Size')+'</th>'+
            '<th style="padding:4px 6px;border:1px solid #bbf7d0;text-align:center;color:#374151">'+(c.isAr?'السرعة':'Vel.')+'</th>'+
            '<th style="padding:4px 6px;border:1px solid #bbf7d0;text-align:center;color:#374151">'+(c.isAr?'النسبة':'Ratio')+'</th>'+
            '<th style="padding:4px 6px;border:1px solid #bbf7d0;text-align:center;color:#374151">'+(c.isAr?'التقييم':'Rating')+'</th>'+
          '</tr></thead>'+
          '<tbody>'+
            '<tr>'+
              '<td style="padding:5px 6px;border:1px solid #bbf7d0;font-weight:600;color:#059669">'+(c.isAr?'إمداد':'Supply')+'</td>'+
              '<td style="padding:5px 6px;border:1px solid #bbf7d0;text-align:center;font-family:monospace">'+Math.round(_usedCfm).toLocaleString()+'<div style="font-size:8px;color:#64748b">'+((_usedCfm*0.000471947).toFixed(3))+' m³/s</div></td>'+
              '<td style="padding:5px 6px;border:1px solid #bbf7d0;text-align:center;font-family:monospace;font-size:9px">'+(_tds?Number(_tds.area_required||0).toLocaleString()+' mm²':'—')+'</td>'+
              '<td style="padding:5px 6px;border:1px solid #bbf7d0;text-align:center;font-weight:700;color:#059669">'+(_tds?_tds.w+'×'+_tds.h+' mm':'—')+'</td>'+
              '<td style="padding:5px 6px;border:1px solid #bbf7d0;text-align:center;font-family:monospace">'+_tActSupFpm2+' fpm</td>'+
              '<td style="padding:5px 6px;border:1px solid #bbf7d0;text-align:center">'+(_tds?'1:'+_tds.ratio:'—')+'</td>'+
              '<td style="padding:5px 6px;border:1px solid #bbf7d0;text-align:center">'+ratingBadge(_supRt,c.isAr)+'</td>'+
            '</tr>'+
            '<tr>'+
              '<td style="padding:5px 6px;border:1px solid #bbf7d0;font-weight:600;color:#0284c7">'+(c.isAr?'رجوع':'Return')+'</td>'+
              '<td style="padding:5px 6px;border:1px solid #bbf7d0;text-align:center;font-family:monospace">'+Math.round(_usedCfm*0.9).toLocaleString()+'<div style="font-size:8px;color:#64748b">'+((_usedCfm*0.9*0.000471947).toFixed(3))+' m³/s</div></td>'+
              '<td style="padding:5px 6px;border:1px solid #bbf7d0;text-align:center;font-family:monospace;font-size:9px">'+(_tdr?Number(_tdr.area_required||0).toLocaleString()+' mm²':'—')+'</td>'+
              '<td style="padding:5px 6px;border:1px solid #bbf7d0;text-align:center;font-weight:700;color:#059669">'+(_tdr?_tdr.w+'×'+_tdr.h+' mm':'—')+'</td>'+
              '<td style="padding:5px 6px;border:1px solid #bbf7d0;text-align:center;font-family:monospace">'+_tActRetFpm2+' fpm</td>'+
              '<td style="padding:5px 6px;border:1px solid #bbf7d0;text-align:center">'+(_tdr?'1:'+_tdr.ratio:'—')+'</td>'+
              '<td style="padding:5px 6px;border:1px solid #bbf7d0;text-align:center">'+ratingBadge(_retRt,c.isAr)+'</td>'+
            '</tr>'+
            // Fresh Air row — only for healthcare rooms (h.oa > 0)
            ((_isHC && (parseInt(h.oa)||0)>0)?(function(){
              var _faVel=600; // fresh air target: 600 fpm (≈3 m/s per ASHRAE)
              var _faCfm=parseInt(h.oa)||0;
              var _faD=calcDuctSize(_faCfm,_faVel);
              var _faDs=_faD?(_faD.std||_faD.calc):null;
              var _faRt=getDuctVelocityRating(_faVel,'supply',true);
              return '<tr style="background:#f0f9ff">'+
                '<td style="padding:5px 6px;border:1px solid #bbf7d0;font-weight:600;color:#0369a1">'+(c.isAr?'هواء خارجي (OA CFM)':'Outdoor Air (OA CFM)')+'</td>'+
                '<td style="padding:5px 6px;border:1px solid #bbf7d0;text-align:center;font-family:monospace">'+_faCfm.toLocaleString()+'<div style="font-size:8px;color:#64748b">'+(_faCfm*0.000471947).toFixed(3)+' m³/s</div></td>'+
                '<td style="padding:5px 6px;border:1px solid #bbf7d0;text-align:center;font-family:monospace;font-size:9px">'+(_faDs?Number(_faDs.area_required||0).toLocaleString()+' mm²':'—')+'</td>'+
                '<td style="padding:5px 6px;border:1px solid #bbf7d0;text-align:center;font-weight:700;color:#0369a1">'+(_faDs?_faDs.w+'×'+_faDs.h+' mm':'—')+'</td>'+
                '<td style="padding:5px 6px;border:1px solid #bbf7d0;text-align:center;font-family:monospace">'+_faVel+' fpm</td>'+
                '<td style="padding:5px 6px;border:1px solid #bbf7d0;text-align:center">'+(_faDs?'1:'+_faDs.ratio:'—')+'</td>'+
                '<td style="padding:5px 6px;border:1px solid #bbf7d0;text-align:center">'+ratingBadge(_faRt,c.isAr)+'</td>'+
              '</tr>';
            })():'')+
          '</tbody>'+
        '</table>'+
        '<div style="margin-top:7px;padding:5px 8px;border-radius:5px;background:'+
          ((_supRt&&(_supRt.r==='High'||_supRt.r==='Critical'))||(_retRt&&(_retRt.r==='High'||_retRt.r==='Critical'))?'#fef3c7':'#f0fdf4')+
          ';border:1px solid '+
          ((_supRt&&(_supRt.r==='High'||_supRt.r==='Critical'))||(_retRt&&(_retRt.r==='High'||_retRt.r==='Critical'))?'#fcd34d':'#bbf7d0')+
          ';font-size:10px;color:#374151">'+_recTxt+'</div>'+
        (_isHC?'<div style="font-size:9px;color:#6b7280;margin-top:4px">'+
          (c.isAr?'* حدود ASHRAE 170 للغرف الصحية مُطبَّقة':'* ASHRAE 170 healthcare velocity limits applied')+'</div>':'')+
      '</div>';
    }
    var _headCapLbl = _isBundleMode
      ? (c.isAr?'حمل الغرفة: ':'Room Load: ')+Number(reqBtu).toLocaleString()+' BTU ('+reqTR+' TR)'
      : Number(selBtu).toLocaleString()+' BTU / '+selTR+' TR';
    cards+='<div class="room-tech-card">'
      +'<div class="room-tech-head">'
        +'<span style="font-weight:700">#'+(i+1)+' '+name+'</span>'
        +'<span style="font-size:11px;opacity:.8">'+(_isBundleMode?'':''+utLbl+' — ')+_headCapLbl+'</span>'
      +'</div>'
      +'<div class="room-tech-body">'
        +'<div class="stat-grid">'
          +'<div class="stat-item"><div class="stat-lbl">'+(c.isAr?'عدد الغرف':'Room Count')+'</div><div class="stat-val">'+getRecordRoomCount(i)+'</div></div>'
          +'<div class="stat-item"><div class="stat-lbl">'+(c.isAr?'حمل الحرارة':'Required BTU/h')+'</div><div class="stat-val">'+Number(reqBtu).toLocaleString()+'</div></div>'
          +'<div class="stat-item"><div class="stat-lbl">'+(c.isAr?'TR المطلوب':'Required TR')+'</div><div class="stat-val">'+reqTR+'</div></div>'
          +'<div class="stat-item"><div class="stat-lbl">'+(c.isAr?'تدفق الهواء':'Supply CFM')+'</div><div class="stat-val">'+Number(h.cfm).toLocaleString()+'</div></div>'
          +'<div class="stat-item"><div class="stat-lbl">Market BTU</div><div class="stat-val">'+Number(h.mkt).toLocaleString()+'</div></div>'
        +'</div>'
        +(c.isBundleProj?'':'<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">'
        +'<span style="font-size:10px;color:#64748b;font-weight:600">'+(c.isAr?'الحالة':'Status')+':</span>'
        +warnHtml
        +'<span style="font-size:10px;color:#94a3b8;margin-'+( c.isAr?'right':'left')+':auto">'+Number(selBtu).toLocaleString()+' BTU × '+getQty(i)+(getQty(i)>1?' = '+Number(effCap).toLocaleString()+' BTU/h':'')+' </span>'
        +'</div>')
        +roomLogicHtml+hcHtml+devHtml+equipmentHtml+techDuctHtml
      +'</div>'
    +'</div>';
  }
  var globalWarn='';
  var _isBM = (quoteMode==='proj')||bundleOn;
  if(_isBM){
    // Project/Bundle mode: show project-level BTU + CFM summary instead of per-room warnings
    var _bmReqBtu=0, _bmReqCfm=0;
    for(var _bi=0;_bi<hist.length;_bi++){ _bmReqBtu+=parseInt(hist[_bi].btu)||0; _bmReqCfm+=parseInt(hist[_bi].cfm)||0; }
    var _bmSelBtu=projState.selBtu*projState.qty;
    var _bmSelTr=(_bmSelBtu/12000).toFixed(2);
    var _bmReqTr=(_bmReqBtu/12000).toFixed(2);
    var _bmBtuDelta=_bmReqBtu>0?Math.round((_bmSelBtu-_bmReqBtu)/_bmReqBtu*1000)/10:0;
    var _bmBtuSign=_bmBtuDelta>=0?'+':'';
    var _bmBtuClr; var _bmBtuBadge;
    if(_bmBtuDelta<0){
      var _bmAbs=Math.abs(_bmBtuDelta);
      _bmBtuClr=_bmAbs>15?'#dc2626':'#d97706';
      _bmBtuBadge=(_bmAbs>15?'⛔ ':'⚠ ')+(c.isAr?'عجز سعة BTU ':'BTU Deficit ')+_bmBtuDelta.toFixed(1)+'%';
    } else if(_bmBtuDelta<=5){
      _bmBtuClr='#059669'; _bmBtuBadge='✓ '+(c.isAr?'مطابقة':'Match')+' +'+_bmBtuDelta.toFixed(1)+'%';
    } else if(_bmBtuDelta<=25){
      _bmBtuClr='#4f46e5'; _bmBtuBadge=(c.isAr?'سعة زائدة':'Slight Oversize')+' +'+_bmBtuDelta.toFixed(1)+'%';
    } else {
      _bmBtuClr='#6b7280'; _bmBtuBadge=(c.isAr?'سعة عالية':'High Oversize')+' +'+_bmBtuDelta.toFixed(1)+'%';
    }
    // CFM comparison
    var _bmCfmPerTr=parseInt((typeof G==='function'&&G('duct-cfm-per-tr')?G('duct-cfm-per-tr').value:400))||400;
    var _bmUnitCfm=projState.selBtu>0?Math.round((projState.selBtu/12000)*_bmCfmPerTr)*projState.qty:0;
    var _bmCfmDelta=_bmReqCfm>0&&_bmUnitCfm>0?Math.round((_bmUnitCfm-_bmReqCfm)/_bmReqCfm*1000)/10:0;
    var _bmCfmSign=_bmCfmDelta>=0?'+':'';
    var _bmCfmClr=_bmCfmDelta<0?'#dc2626':(_bmCfmDelta>0?'#059669':'#059669');
    var _bmCfmBadge=_bmCfmDelta<0?(c.isAr?'⚠ تنبيه تدفق الهواء':'⚠ Airflow Warning'):(c.isAr?'✅ تدفق مناسب':'✅ Airflow OK');
    globalWarn=
      '<div style="border:1px solid #bfdbfe;border-radius:8px;padding:14px;margin-bottom:12px;background:#eff6ff;page-break-inside:avoid">'+
        '<div style="font-size:12px;font-weight:700;color:#1e40af;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #bfdbfe">'+
          '📊 '+(c.isAr?'ملخص مستوى المشروع — Project Summary':'Project-Level Summary')+'</div>'+
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:10px">'+
          '<div style="background:#fff;border:1px solid #dbeafe;border-radius:6px;padding:10px;text-align:center">'+
            '<div style="font-size:9px;color:#64748b;margin-bottom:3px">'+(c.isAr?'BTU مطلوب':'Required BTU')+'</div>'+
            '<div style="font-size:13px;font-weight:700;color:#0f172a;font-family:monospace">'+Number(_bmReqBtu).toLocaleString()+'</div>'+
            '<div style="font-size:9px;color:#94a3b8">'+_bmReqTr+' TR</div>'+
          '</div>'+
          '<div style="background:#fff;border:1px solid #dbeafe;border-radius:6px;padding:10px;text-align:center">'+
            '<div style="font-size:9px;color:#64748b;margin-bottom:3px">'+(c.isAr?'BTU المختار':'Selected BTU')+'</div>'+
            '<div style="font-size:13px;font-weight:700;color:'+_bmBtuClr+';font-family:monospace">'+Number(_bmSelBtu).toLocaleString()+'</div>'+
            '<div style="font-size:9px;color:#94a3b8">'+_bmSelTr+' TR | '+_bmBtuSign+_bmBtuDelta+'%</div>'+
          '</div>'+
          '<div style="background:#fff;border:1px solid #dbeafe;border-radius:6px;padding:10px;text-align:center">'+
            '<div style="font-size:9px;color:#64748b;margin-bottom:3px">'+(c.isAr?'حالة BTU':'BTU Status')+'</div>'+
            '<div style="font-size:11px;font-weight:700;color:'+_bmBtuClr+';margin-top:4px">'+_bmBtuBadge+'</div>'+
          '</div>'+
        '</div>'+
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">'+
          '<div style="background:#fff;border:1px solid #dcfce7;border-radius:6px;padding:10px;text-align:center">'+
            '<div style="font-size:9px;color:#64748b;margin-bottom:3px">'+(c.isAr?'CFM المطلوب':'Required CFM')+'</div>'+
            '<div style="font-size:13px;font-weight:700;color:#0f172a;font-family:monospace">'+(_bmReqCfm>0?Number(_bmReqCfm).toLocaleString():'—')+'</div>'+
            '<div style="font-size:9px;color:#94a3b8">CFM</div>'+
          '</div>'+
          '<div style="background:#fff;border:1px solid #dcfce7;border-radius:6px;padding:10px;text-align:center">'+
            '<div style="font-size:9px;color:#64748b;margin-bottom:3px">'+(c.isAr?'CFM الوحدة':'Unit CFM')+'</div>'+
            '<div style="font-size:13px;font-weight:700;color:'+_bmCfmClr+';font-family:monospace">'+(_bmUnitCfm>0?Number(_bmUnitCfm).toLocaleString():'—')+'</div>'+
            '<div style="font-size:9px;color:#94a3b8">'+(_bmCfmDelta!==0?_bmCfmSign+_bmCfmDelta+'%':'')+'</div>'+
          '</div>'+
          '<div style="background:#fff;border:1px solid #dcfce7;border-radius:6px;padding:10px;text-align:center">'+
            '<div style="font-size:9px;color:#64748b;margin-bottom:3px">'+(c.isAr?'حالة تدفق الهواء':'Airflow Status')+'</div>'+
            '<div style="font-size:11px;font-weight:700;color:'+_bmCfmClr+';margin-top:4px">'+_bmCfmBadge+'</div>'+
          '</div>'+
        '</div>'+
      '</div>';
  } else if(anyUndersized){
    globalWarn='<div class="warn-box">⚠️ <strong>'+(c.isAr?'تحذير':'Warning')+':</strong> '+
      (c.isAr
        ?'عدد البنود ناقصة السعة: <strong>'+undersizedCount+'</strong> من <strong>'+hist.length+'</strong> — يرجى مراجعة السعات قبل الاعتماد.'
        :'Undersized items: <strong>'+undersizedCount+'</strong> of <strong>'+hist.length+'</strong> — please review capacities before approval.')+
      '</div>';
  }
  return '<div class="inv-page" id="pdf-page2">'
    +'<div class="inv-header">'
      +'<div class="inv-brand">'
        +'<div class="inv-brand-icon">🔧</div>'
        +'<div><div class="inv-brand-name">AirCalc Pro</div>'
        +'<div class="inv-brand-sub">Technical Details — '+c.proj+'</div></div>'
      +'</div>'
      +'<div style="text-align:'+(c.isAr?'left':'right')+'">'
        +'<div style="font-size:13px;color:#64748b"># '+c.qno+'</div>'
        +'<div style="font-size:12px;color:#94a3b8;margin-top:2px">'+c.today+'</div>'
      +'</div>'
    +'</div>'
    +'<div class="page-title">'+(c.isAr?'التفاصيل الفنية':'Technician Details')+'<span class="page-badge tech">'+(c.isAr?'صفحة فنية':'Page 2 / Technical')+'</span></div>'
    +globalWarn
    +cards
    +'<div class="footer">AirCalc Pro — HVAC Engineering Suite &copy; '+new Date().getFullYear()+'</div>'
    +'</div>';
}

function buildInvoiceHTML(){
  // For HTML export and legacy use — returns single-page client summary
  var c=invCommon();
  var css=invSharedCss(c);
  var page1=buildPage1(c);
  return '<!DOCTYPE html><html lang="'+(c.isAr?'ar':'en')+'" dir="'+c.dir+'">'
    +'<head><meta charset="UTF-8">'+c.fontLink+'<style>'+css+'</style></head>'
    +'<body>'+page1+'</body></html>';
}


function exportPDF(){
  if(!hist.length){ toast(lang==='ar'?'⚠️ لا توجد غرف':'⚠️ No rooms saved'); return; }
  // Lazy-load PDF libraries on first use
  var h2cReady = typeof html2canvas !== 'undefined';
  var jspdfReady = typeof window.jspdf !== 'undefined';
  if(h2cReady && jspdfReady){ _doExportPDF(); return; }
  var btn=G('btn-pdf');
  if(btn){ btn.disabled=true; btn.textContent=lang==='ar'?'جارٍ تحميل المكتبات...':'Loading libraries...'; }
  var loaded=0, failed=0;
  function onLoad(){ loaded++; if(loaded+failed>=2){ if(btn){btn.disabled=false;btn.textContent=lang==='ar'?'📥 تحميل PDF':'📥 Download PDF';} if(failed===0) _doExportPDF(); else toast(lang==='ar'?'⚠️ فشل تحميل مكتبة PDF':'⚠️ PDF library failed to load'); } }
  function onErr(name){ failed++; console.warn(name+' failed'); onLoad(); }
  function loadLib(url, name, ready){
    if(ready){ loaded++; return; }
    var s=document.createElement('script'); s.src=url; s.crossOrigin='anonymous';
    s.onload=onLoad; s.onerror=function(){ onErr(name); };
    document.body.appendChild(s);
  }
  loadLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js','html2canvas',h2cReady);
  loadLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js','jsPDF',jspdfReady);
}
function _doExportPDF(){
  var btn=G('btn-pdf');
  if(btn){ btn.disabled=true; btn.textContent=lang==='ar'?'جارٍ التحميل...':'Generating...'; }

  var c=invCommon();
  var css=invSharedCss(c);
  var page1Html=buildPage1(c);
  var page2Html=buildPage2(c);

  // Build two-page container
  var wrap=document.createElement('div');
  wrap.style.cssText='position:fixed;left:-9999px;top:0;width:794px;background:#fff;z-index:-1;';
  wrap.innerHTML='<!DOCTYPE html><html><head><style>'+css+'</style></head><body>'
    +page1Html+page2Html+'</body></html>';
  // Actually we just inject the page HTML divs directly (no nested doc)
  wrap.innerHTML=page1Html+page2Html;
  document.body.appendChild(wrap);

  var A4W=794, A4H=1123, SCALE=2;
  var jsPDF=window.jspdf.jsPDF;
  var pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  var pageW_mm=210, pageH_mm=297;

  var pages=[wrap.querySelector('#pdf-page1'), wrap.querySelector('#pdf-page2')];

  // Apply shared styles inline for html2canvas
  var styleEl=document.createElement('style');
  styleEl.textContent=css;
  wrap.prepend(styleEl);

  var capturePages=function(pageIdx){
    if(pageIdx>=pages.length){
      document.body.removeChild(wrap);
      var qno=(G('quote-no')||{value:''}).value.trim()||'';
      var proj=(G('quote-project')||{value:''}).value.trim()||'';
      var fname='AirCalc_Invoice';
      if(qno) fname='Quote_'+qno;
      else if(proj) fname=proj.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g,'_');
      pdf.save(fname+'.pdf');
      toast(lang==='ar'?'📥 تم تحميل PDF':'📥 PDF downloaded');
      if(btn){ btn.disabled=false; btn.innerHTML='<span id="lbl-export3">'+(lang==='ar'?'تحميل PDF':'Download PDF')+'</span>'; }
      return;
    }
    var pageEl=pages[pageIdx];
    html2canvas(pageEl,{
      scale:SCALE, useCORS:true, allowTaint:true,
      backgroundColor:'#ffffff', width:A4W, windowWidth:A4W,
      scrollX:0, scrollY:0, logging:false
    }).then(function(canvas){
      if(pageIdx>0) pdf.addPage();
      var canvH_mm=(canvas.height/canvas.width)*pageW_mm;
      if(canvH_mm<=pageH_mm){
        pdf.addImage(canvas.toDataURL('image/jpeg',0.93),'JPEG',0,0,pageW_mm,canvH_mm);
      } else {
        var sliceH_px=Math.floor((pageH_mm/pageW_mm)*canvas.width);
        var yOff=0;
        var isFirstSlice=true;
        while(yOff<canvas.height){
          var sc=document.createElement('canvas');
          sc.width=canvas.width;
          var rem=canvas.height-yOff;
          sc.height=Math.min(sliceH_px,rem);
          var ctx=sc.getContext('2d');
          ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,sc.width,sc.height);
          ctx.drawImage(canvas,0,-yOff);
          var sliceH_mm=(sc.height/canvas.width)*pageW_mm;
          if(!isFirstSlice) pdf.addPage();
          pdf.addImage(sc.toDataURL('image/jpeg',0.93),'JPEG',0,0,pageW_mm,sliceH_mm);
          isFirstSlice=false;
          yOff+=sliceH_px;
        }
      }
      capturePages(pageIdx+1);
    }).catch(function(err){
      document.body.removeChild(wrap);
      console.error('PDF error:',err);
      toast(lang==='ar'?'❌ فشل التحميل':'❌ PDF failed');
      if(btn){ btn.disabled=false; btn.innerHTML='<span id="lbl-export3">'+(lang==='ar'?'تحميل PDF':'Download PDF')+'</span>'; }
    });
  };

  // Load Cairo font explicitly before capture for Arabic glyph rendering
  var _fontLink = document.createElement('link');
  _fontLink.rel='stylesheet';
  _fontLink.href='https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap';
  wrap.prepend(_fontLink);
  // Wait for fonts then capture (800ms for Arabic, 400ms for Latin)
  if(document.fonts&&document.fonts.ready){
    document.fonts.ready.then(function(){
      setTimeout(function(){ capturePages(0); }, lang==='ar' ? 800 : 400);
    });
  } else {
    setTimeout(function(){ capturePages(0); }, lang==='ar' ? 1000 : 600);
  }
}



// ── TECH REPORT PDF EXPORT ────────────────────────────────────────────────
function exportTechPDF(){
  if(!hist.length){ toast(lang==='ar'?'⚠️ لا توجد غرف':'⚠️ No rooms'); return; }
  var h2cReady = typeof html2canvas !== 'undefined';
  var jspdfReady = typeof window.jspdf !== 'undefined';
  if(h2cReady && jspdfReady){ _doExportTechPDF(); return; }
  var btn=G('btn-techpdf-panel') || G('btn-techpdf');
  if(btn){ btn.disabled=true; btn.textContent=lang==='ar'?'جارٍ تحميل المكتبات...':'Loading libraries...'; }
  var loaded=0, failed=0;
  function onLoad(){ loaded++; if(loaded+failed>=2){ if(btn){btn.disabled=false;btn.innerHTML='<span id="lbl-export4">'+(lang==='ar'?'تقرير فني':'Tech Report')+'</span>';} if(failed===0) _doExportTechPDF(); else toast(lang==='ar'?'⚠️ فشل تحميل مكتبة PDF':'⚠️ PDF library failed to load'); } }
  function onErr(name){ failed++; console.warn(name+' failed'); onLoad(); }
  function loadLib(url, name, ready){
    if(ready){ loaded++; return; }
    var s=document.createElement('script'); s.src=url; s.crossOrigin='anonymous';
    s.onload=onLoad; s.onerror=function(){ onErr(name); };
    document.body.appendChild(s);
  }
  loadLib('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js','html2canvas',h2cReady);
  loadLib('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js','jsPDF',jspdfReady);
}
function _doExportTechPDF(){
  var btn=G('btn-techpdf-panel') || G('btn-techpdf');
  if(btn){ btn.disabled=true; btn.textContent=lang==='ar'?'جارٍ التحميل...':'Generating...'; }

  var c=invCommon();
  var css=invSharedCss(c);
  var page2Html=buildPage2(c);

  var wrap=document.createElement('div');
  wrap.style.cssText='position:fixed;left:-9999px;top:0;width:794px;background:#fff;z-index:-1;';
  wrap.innerHTML=page2Html;
  document.body.appendChild(wrap);

  var styleEl=document.createElement('style');
  styleEl.textContent=css;
  wrap.prepend(styleEl);

  var fontLink=document.createElement('link');
  fontLink.rel='stylesheet';
  fontLink.href='https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap';
  wrap.prepend(fontLink);

  var A4W=794, SCALE=2;
  var jsPDF=window.jspdf.jsPDF;
  var pdf=new jsPDF({orientation:'portrait',unit:'mm',format:'a4'});
  var pageW_mm=210, pageH_mm=297;

  var pageEl=wrap.querySelector('#pdf-page2');

  var doCapture=function(){
    html2canvas(pageEl,{
      scale:SCALE, useCORS:true, allowTaint:true,
      backgroundColor:'#ffffff', width:A4W, windowWidth:A4W,
      scrollX:0, scrollY:0, logging:false
    }).then(function(canvas){
      document.body.removeChild(wrap);
      var canvH_mm=(canvas.height/canvas.width)*pageW_mm;
      if(canvH_mm<=pageH_mm){
        pdf.addImage(canvas.toDataURL('image/jpeg',0.93),'JPEG',0,0,pageW_mm,canvH_mm);
      } else {
        var sliceH_px=Math.floor((pageH_mm/pageW_mm)*canvas.width);
        var yOff=0, isFirst=true;
        while(yOff<canvas.height){
          var sc=document.createElement('canvas');
          sc.width=canvas.width;
          var rem=canvas.height-yOff;
          sc.height=Math.min(sliceH_px,rem);
          var ctx=sc.getContext('2d');
          ctx.fillStyle='#ffffff'; ctx.fillRect(0,0,sc.width,sc.height);
          ctx.drawImage(canvas,0,-yOff);
          var sliceH_mm=(sc.height/canvas.width)*pageW_mm;
          if(!isFirst) pdf.addPage();
          pdf.addImage(sc.toDataURL('image/jpeg',0.93),'JPEG',0,0,pageW_mm,sliceH_mm);
          isFirst=false; yOff+=sliceH_px;
        }
      }
      var qno=(G('quote-no')||{value:''}).value.trim()||'';
      var fname=qno ? 'TechReport_'+qno : 'TechReport_AirCalc';
      pdf.save(fname+'.pdf');
      toast(lang==='ar'?'📄 تم استخراج التقرير الفني':'📄 Technical report exported');
      if(btn){ btn.disabled=false; btn.innerHTML='<span id="lbl-export4">'+(lang==='ar'?'تقرير فني':'Tech Report')+'</span>'; }
    }).catch(function(err){
      document.body.removeChild(wrap);
      console.error('TechPDF error:',err);
      toast(lang==='ar'?'❌ فشل استخراج التقرير':'❌ Export failed');
      if(btn){ btn.disabled=false; btn.innerHTML='<span id="lbl-export4">'+(lang==='ar'?'تقرير فني':'Tech Report')+'</span>'; }
    });
  };

  if(document.fonts&&document.fonts.ready){
    document.fonts.ready.then(function(){
      setTimeout(doCapture, lang==='ar' ? 800 : 400);
    });
  } else {
    setTimeout(doCapture, lang==='ar' ? 1000 : 600);
  }
}


// ── AC SYSTEM CATALOG (Saudi market) ────────────────────────────────────
// Each entry: { btu: <BTU/h>, cfm: <optional CFM for FCU/AHU>, label: {ar, en} }
// [DATA: AC_CATALOG loaded from data.json]

// Map unit type keys to AC_CATALOG keys
// [DATA: UT_TO_CAT loaded from data.json]

// Labels for each unit type key (Arabic + English)
// [DATA: UT_LABELS_AR loaded from data.json]

// [DATA: UT_LABELS_EN loaded from data.json]

function utLabel(key){ return lang==='ar' ? (UT_LABELS_AR[key]||key) : (UT_LABELS_EN[key]||key); }

function getCatalog(utKey){
  var catKey = UT_TO_CAT[utKey] || utKey;
  return AC_CATALOG[catKey] || AC_CATALOG['split'];
}

// Get best default capacity from catalog >= reqBtu
function defaultCapForUT(utKey, reqBtu, reqCfm){
  var cat = getCatalog(utKey);
  // For CFM-based catalogs (fcu/ahu) and a valid reqCfm, pick smallest cfm >= reqCfm
  if(reqCfm && reqCfm > 0 && cat.length > 0 && cat[0].cfm){
    for(var i=0;i<cat.length;i++){ if((cat[i].cfm||0) >= reqCfm) return cat[i].btu; }
    return cat[cat.length-1].btu;
  }
  // BTU-based catalogs: pick smallest btu >= reqBtu
  for(var i=0;i<cat.length;i++){ if(cat[i].btu >= reqBtu) return cat[i].btu; }
  return cat[cat.length-1].btu;
}

var AC_BTU_STEPS = [9000,12000,18000,24000,27000,30000,36000,42000,48000,60000,72000,96000,120000];

function acRoundBtu(btu, method){
  if(method==='btu'){
    for(var i=0;i<AC_BTU_STEPS.length;i++){ if(AC_BTU_STEPS[i]>=btu) return AC_BTU_STEPS[i]; }
    return Math.ceil(btu/12000)*12000;
  } else if(method==='htr'){
    var tr=btu/12000, r=Math.ceil(tr*2)/2; return Math.round(r*12000);
  } else {
    var tr=btu/12000, r=Math.ceil(tr); return Math.round(r*12000);
  }
}



function addToQuote(){
  goPanel('hist');
  toast(lang==='ar'?'✅ تم الإضافة للعرض':'✅ Added to quote');
  // Refresh bundle row visibility (show when >1 room)
  var _br=G('bundle-row');
  if(_br) _br.style.display = hist.length > 1 ? '' : 'none';
  if(typeof _updateBundleUI === 'function') _updateBundleUI();
}




// ══════════════════════════════════════════════════════════════════
// A) DUCT SIZING
// ══════════════════════════════════════════════════════════════════
var DUCT_DUCTED_TYPES = ['ducted','package','vrf','fcu','ahu','chillerfcu','chiller'];

function isDucted(utKey){
  return DUCT_DUCTED_TYPES.indexOf(utKey||'') >= 0;
}

// Standard rectangular duct candidates [w, h] in mm
// Standard Saudi market duct sizes — widths × heights (mm)
// Sorted by area ascending; calcDuctSize picks smallest valid size
// [DATA: _DUCT_WIDTHS loaded from data.json]

// [DATA: _DUCT_HEIGHTS loaded from data.json]
var DUCT_STD = [];
function buildDuctStd(){
  var arr = [];
  for(var wi=0;wi<_DUCT_WIDTHS.length;wi++){
    for(var hi=0;hi<_DUCT_HEIGHTS.length;hi++){
      var w=_DUCT_WIDTHS[wi], h=_DUCT_HEIGHTS[hi];
      var ratio = w >= h ? w/h : h/w;
      if(ratio <= 4) arr.push([w,h]);
    }
  }
  arr.sort(function(a,b){ return (a[0]*a[1])-(b[0]*b[1]); });
  DUCT_STD = arr;
}
buildDuctStd(); // initial build with defaults (overridden by data.json on load)

// Compute duct size from CFM and velocity (fpm)
// Returns {calc, std} where each has {w,h,area_required,area_actual,ratio,method,actualFpm}
function calcDuctSize(cfm, velocityFpm){
  if(!cfm || cfm <= 0) return null;
  var areaFt2 = cfm / velocityFpm;
  var areaMm2 = areaFt2 * 92903.04; // 1 ft² = 92903.04 mm²
  var minSide = 150; // mm minimum

  // ── Find best from full DUCT_STD (already sorted by area asc) ──
  var stdBest = null;
  for(var si=0; si<DUCT_STD.length; si++){
    var sw=DUCT_STD[si][0], sh=DUCT_STD[si][1];
    if(sw >= minSide && sh >= minSide && sw*sh >= areaMm2){
      var _aFt2 = (sw*sh)/92903.04;
      stdBest = {w:sw, h:sh, area_required:Math.round(areaMm2), area_actual:sw*sh,
                 ratio:Math.max(sw,sh)/Math.min(sw,sh)|0, method:'std',
                 actualFpm: _aFt2>0?Math.round(cfm/_aFt2):velocityFpm};
      break;
    }
  }

  // ── Fallback: calc from preferred heights ──
  var best = null;
  var heights = [200,250,300,350,400,450,500,600];
  for(var hi=0; hi<heights.length; hi++){
    var h = heights[hi];
    var wRaw = areaMm2 / h;
    var w = Math.ceil(wRaw / 50) * 50;
    if(w < minSide) w = minSide;
    var ratio = w/h;
    if(w <= 1500 && ratio <= 4){
      var _aFt2c = (w*h)/92903.04;
      best = {w:w, h:h, area_required:Math.round(areaMm2), area_actual:w*h,
              ratio:ratio.toFixed(2), method:'calc',
              actualFpm: _aFt2c>0?Math.round(cfm/_aFt2c):velocityFpm};
      break;
    }
  }
  if(!best){
    var h2=600, wRaw2=areaMm2/h2, w2=Math.max(minSide,Math.ceil(wRaw2/50)*50);
    var _aFt2f=(w2*h2)/92903.04;
    best={w:w2,h:h2,area_required:Math.round(areaMm2),area_actual:w2*h2,
          ratio:(w2/h2).toFixed(2),method:'calc',
          actualFpm:_aFt2f>0?Math.round(cfm/_aFt2f):velocityFpm};
  }
  return {calc:best, std:stdBest||best};
}

function ductSizeLabel(d){
  if(!d) return '—';
  return d.w + '×' + d.h + ' mm';
}

// ── getDuctCfm: resolve Q_cfm for duct sizing only (does NOT affect load calcs)
// cfmPerTr: user-selectable 350|400|450, default 400
// Returns {cfm, source, label}
//   source 'unit'  — catalog entry has explicit CFM field (FCU/AHU)
//   source 'tr'    — BTU-only catalog → derive from Selected TR × cfmPerTr
//   source 'calc'  — fallback to computed supply CFM
function getDuctCfm(utKey, selBtu, fallbackCfm, cfmPerTr){
  cfmPerTr = cfmPerTr || 400;
  var cat = getCatalog(utKey);
  // Priority 1: catalog entry has explicit CFM
  for(var ci=0; ci<cat.length; ci++){
    if(cat[ci].btu === selBtu && cat[ci].cfm && cat[ci].cfm > 0){
      return {cfm: cat[ci].cfm, source: 'unit',
              label: 'CFM Source: Selected Unit CFM'};
    }
  }
  // Priority 2: BTU-only catalog entry → derive from TR
  if(selBtu > 0){
    var selTrVal = selBtu / 12000;
    var derivedCfm = Math.round(selTrVal * cfmPerTr);
    if(derivedCfm > 0){
      return {cfm: derivedCfm, source: 'tr',
              label: 'CFM Source: Selected TR × ' + cfmPerTr};
    }
  }
  // Priority 3: computed supply CFM
  return {cfm: Math.max(1, fallbackCfm||0), source: 'calc',
          label: 'CFM Source: Calculated Supply CFM'};
}

// Project mode: multiply per-unit CFM by qty (for unit/tr sources)
function getProjDuctCfm(utKey, selBtu, qty, fallbackTotalCfm, cfmPerTr){
  cfmPerTr = cfmPerTr || 400;
  var per = getDuctCfm(utKey, selBtu, 0, cfmPerTr);
  if(per.source === 'unit' || per.source === 'tr'){
    var totalCfm = per.cfm * Math.max(1, qty||1);
    return {cfm: totalCfm, source: per.source,
            label: per.label + ' × ' + Math.max(1,qty||1) + ' units'};
  }
  return {cfm: Math.max(1, fallbackTotalCfm||0), source: 'calc',
          label: 'CFM Source: Calculated Total CFM'};
}

// ── Duct sizing basis toggle state ──
function paToInwg(pa){
  return (parseFloat(pa)||0) / 249.0889;
}
var espBreakdownOpen = false;
function syncEspBreakdownToggle(){
  var btn = G('esp-breakdown-toggle');
  var body = G('esp-breakdown');
  if(body) body.classList.toggle('hidden', !espBreakdownOpen);
  if(btn) btn.textContent = lang==='ar'
    ? (espBreakdownOpen ? 'إخفاء تفاصيل الحساب' : 'عرض تفاصيل الحساب')
    : (espBreakdownOpen ? 'Hide Calculation Details' : 'Show Calculation Details');
}
function toggleEspBreakdown(){
  espBreakdownOpen = !espBreakdownOpen;
  syncEspBreakdownToggle();
}
function getEspNumber(id, fallback){
  var el = G(id);
  if(!el) return fallback || 0;
  var val = parseFloat(el.value);
  if(isNaN(val)) val = fallback || 0;
  el.value = String(val);
  return val;
}
function getEspInputs(){
  return {
    lenSup: getEspNumber('esp-len-sup', 30),
    lenRet: getEspNumber('esp-len-ret', 20),
    bends: Math.max(0, parseInt(getEspNumber('esp-bends', 4), 10) || 0),
    fric: getEspNumber('esp-fric', 1.0),
    bendLossPer: getEspNumber('esp-bend-loss', 10),
    filterLoss: getEspNumber('esp-filter-loss', 20),
    diffuserLoss: getEspNumber('esp-diffuser-loss', 30),
    coilLoss: getEspNumber('esp-coil-loss', 0),
    damperLoss: getEspNumber('esp-damper-loss', 0),
    otherLoss: getEspNumber('esp-other-loss', 0)
  };
}
function calculateEspBreakdown(inputs){
  var straightFriction = (inputs.lenSup + inputs.lenRet) * inputs.fric;
  var bendLoss = inputs.bends * inputs.bendLossPer;
  var adders = inputs.filterLoss + inputs.diffuserLoss + inputs.coilLoss + inputs.damperLoss + inputs.otherLoss;
  var totalPa = straightFriction + bendLoss + adders;
  var totalInwg = paToInwg(totalPa);
  var status = totalPa < 125
    ? {key:'low', ar:'منخفض', en:'Low', icon:'🟢'}
    : totalPa <= 250
      ? {key:'med', ar:'متوسط', en:'Medium', icon:'🟡'}
      : {key:'high', ar:'عالٍ', en:'High', icon:'🔴'};
  return {
    inputs: inputs,
    straightFrictionPa: Math.round(straightFriction * 10) / 10,
    bendLossPa: Math.round(bendLoss * 10) / 10,
    filterLossPa: inputs.filterLoss,
    diffuserLossPa: inputs.diffuserLoss,
    coilLossPa: inputs.coilLoss,
    damperLossPa: inputs.damperLoss,
    otherLossPa: inputs.otherLoss,
    addersPa: Math.round(adders * 10) / 10,
    totalPa: Math.round(totalPa * 10) / 10,
    totalInwg: Math.round(totalInwg * 100) / 100,
    status: status
  };
}
function calcESP(){
  var isAr = lang==='ar';
  var espBlock = G('esp-block');
  if(!espBlock) return;
  var breakdown = calculateEspBreakdown(getEspInputs());
  window._lastEspCalc = breakdown;

  var espResult = G('esp-result');
  if(espResult){
    var badgeCls = breakdown.status.key === 'low' ? 'esp-low' : (breakdown.status.key === 'med' ? 'esp-med' : 'esp-high');
    espResult.innerHTML =
      '<span class="esp-badge '+badgeCls+'">'+breakdown.status.icon+' '+(isAr ? breakdown.status.ar : breakdown.status.en)+'</span>'+
      '<div class="esp-total-stack">'+
        '<div class="esp-total-main">'+(isAr ? 'ESP الكلي' : 'Total ESP')+' — '+Number(breakdown.totalPa).toLocaleString()+' Pa</div>'+
        '<div class="esp-total-sub">'+Number(breakdown.totalInwg).toFixed(2)+' in.w.g.</div>'+
      '</div>';
  }

  var espBreakdown = G('esp-breakdown');
  if(espBreakdown){
    var rows = [
      { ar:'فقد الاحتكاك المستقيم', en:'Straight Friction Loss', value: breakdown.straightFrictionPa },
      { ar:'فقد الانحناءات', en:'Bend Loss', value: breakdown.bendLossPa },
      { ar:'فقد الفلتر', en:'Filter Loss', value: breakdown.filterLossPa },
      { ar:'فقد مخارج الهواء / الجريلات', en:'Diffuser / Grille Loss', value: breakdown.diffuserLossPa },
      { ar:'فقد الكويل', en:'Coil Loss', value: breakdown.coilLossPa },
      { ar:'فقد الدامبر', en:'Damper Loss', value: breakdown.damperLossPa },
      { ar:'بدل إضافي', en:'Other Allowance', value: breakdown.otherLossPa },
      { ar:'ESP الكلي', en:'Total ESP', value: breakdown.totalPa, emph:true }
    ];
    espBreakdown.innerHTML = rows.map(function(row){
      return '<div class="esp-break-row'+(row.emph?' esp-break-row-total':'')+'">'+
        '<span class="esp-break-lbl">'+(isAr ? row.ar : row.en)+'</span>'+
        '<span class="esp-break-val">'+Number(row.value).toLocaleString()+' Pa</span>'+
      '</div>';
    }).join('');
  }
  syncEspBreakdownToggle();

  var espNote = G('esp-note');
  if(espNote){
    espNote.textContent = isAr
      ? 'تقدير أولي للضغط الساكن — يجب التحقق من كتالوج الوحدة ومخطط الدكت قبل الاعتماد.'
      : 'Preliminary ESP estimate — verify against unit catalog and duct layout before final design.';
  }

  var espCatalogNote = G('esp-catalog-note');
  if(espCatalogNote){
    espCatalogNote.textContent = isAr
      ? 'بيانات ESP من كتالوج المصنع غير متوفرة — تحقق من بيانات الشركة المصنعة.'
      : 'Catalog ESP data is not available — verify manufacturer data.';
  }
}

window._ductBasis = 'required'; // 'required' | 'selected'
window.toggleEspBreakdown = toggleEspBreakdown;
function setDuctBasis(basis){
  window._ductBasis = basis;
  renderProjBlock();
}

function stepProjQty(delta){
  if(getProjectQtyAuto()) return;
  var el = G('proj-qty');
  if(!el) return;
  var next = Math.max(1, (parseInt(el.value,10) || 1) + (parseInt(delta,10) || 0));
  el.value = next;
  projState.qty = next;
  projState.autoReason = buildAutoQtyReason('manual');
  renderProjBlock();
}
function setProjQtyManual(v){
  if(getProjectQtyAuto()) return;
  projState.qty = Math.max(1, parseInt(v,10) || 1);
  projState.autoReason = buildAutoQtyReason('manual');
  renderProjBlock();
}
function setProjectQtyAuto(enabled){
  projState.qtyAuto = enabled !== false;
  if(projState.qtyAuto){
    syncProjectRecommendation({keepSelectedCapacity:true});
  } else {
    projState.autoReason = buildAutoQtyReason('manual');
  }
  renderProjBlock();
}

// ══════════════════════════════════════════════════════════════════
// B) PROJECT MODE STATE
// ══════════════════════════════════════════════════════════════════
// ── Bundle mode (per-room locking) ────────────────────────────────
var bundleOn = false;
// bundleConfig stores project unit config when bundle is ON (persisted)
var bundleConfig = {
  unitType: 'package',
  selectedBtu: 0,
  qty: 1,
  unitPrice: 0,
  designBasis: 'required',
  supplyFpm: 1000,
  returnFpm: 800,
  cfmPerTr: 400
};
// [bundle config restored in initApp]
function saveBundleConfig(){
  try{
    AppStorage.saveBundleConfig(bundleConfig);
  }catch(e){}
}
function _updateBundleUI(){
  var btn=G('bundle-btn'), lbl=G('bundle-btn-lbl'), desc=G('bundle-desc');
  var ar=lang==='ar';
  if(bundleOn){
    if(btn) btn.classList.add('on');
    if(lbl) lbl.textContent = ar ? '🔒 إيقاف التجميع' : '🔒 Disable Bundle';
    if(desc) desc.textContent = ar
      ? 'التجميع مفعّل — اختيار الوحدات لكل غرفة معطّل، يُستخدم إعداد وحدة المشروع فقط'
      : 'Bundle ON — per-room unit selection locked, uses project unit settings only';
  } else {
    if(btn) btn.classList.remove('on');
    if(lbl) lbl.textContent = ar ? '🔓 تفعيل التجميع' : '🔓 Enable Bundle';
    if(desc) desc.textContent = ar
      ? 'يعطّل اختيار الوحدات لكل غرفة ويعتمد على وحدة المشروع فقط'
      : 'Locks per-room unit selection, uses project unit only';
  }
  // show bundle row only in proj mode
  var row=G('bundle-row');
  if(row) row.style.display = (quoteMode==='proj') ? '' : 'none';
}
function toggleBundle(){
  bundleOn = !bundleOn;
  _updateBundleUI();
  if(quoteMode==='proj'){ renderProjBlock(); } else { renderQuote(); }
}
var quoteMode = 'room'; // 'room' | 'proj'
var projState = {
  sysType: 'split',
  selBtu: 0,
  qty: 1,
  up: 0,
  qtyAuto: true,
  autoReason: ''
};
// [quoteMode restored in initApp]

function setQuoteMode(mode){
  quoteMode = mode;
  try{
    AppStorage.saveQuoteMode(mode);
  }catch(e){}
  var btnRoom = G('mode-btn-room'), btnProj = G('mode-btn-proj');
  var qiList = G('qi-list'), projBlock = G('proj-block');
  var bundleRow = G('bundle-row');
  if(mode === 'proj'){
    if(btnRoom) btnRoom.classList.remove('active');
    if(btnProj) btnProj.classList.add('active');
    if(qiList) qiList.style.display = 'none';
    if(projBlock) projBlock.style.display = '';
    // Show bundle toggle only in proj mode
    if(bundleRow) bundleRow.style.display = '';
    _updateBundleUI();
    renderProjBlock();
    refreshGrandTotal();
  } else {
    if(btnRoom) btnRoom.classList.add('active');
    if(btnProj) btnProj.classList.remove('active');
    if(qiList) qiList.style.display = '';
    if(projBlock) projBlock.style.display = 'none';
    // In room mode, bundle toggle shown only if there are rooms to aggregate
    if(bundleRow) bundleRow.style.display = hist.length > 1 ? '' : 'none';
    _updateBundleUI();
    renderQuote();
    refreshGrandTotal();
  }
  updateQuoteModeAuxVisibility();
}

function onProjSysTypeChange(){
  var sel = G('proj-systype');
  if(!sel) return;
  projState.sysType = sel.value;
  // Rebuild capacity dropdown
  var capSel = G('proj-cap');
  if(!capSel) return;
  var cat = getCatalog(projState.sysType);
  var totalBtu = getProjTotalBtu();
  capSel.innerHTML = cat.map(function(c){
    var lbl = lang==='ar' ? c.label.ar : c.label.en;
    return '<option value="'+c.btu+'">'+lbl+'</option>';
  }).join('');
  syncProjectRecommendation({unitType:projState.sysType});
  capSel.value = projState.selBtu;
  if(!capSel.value && cat.length) { capSel.selectedIndex=0; projState.selBtu=cat[0].btu; }
  renderProjBlock();
}

function getProjTotalBtu(){
  var t=0; for(var i=0;i<hist.length;i++) t+=parseInt(hist[i].btu)||0; return t;
}
function getProjTotalCfm(){
  var t=0; for(var i=0;i<hist.length;i++) t+=parseInt(hist[i].cfm)||0; return t;
}
function getProjTotalTr(){
  return getProjTotalBtu()/12000;
}
function getProjTotalMkt(){
  var t=0; for(var i=0;i<hist.length;i++) t+=parseInt(hist[i].mkt)||0; return t;
}

function renderProjBlock(){
  if(quoteMode!=='proj') return;
  var isAr = lang==='ar';

  // Totals
  var totalBtu = getProjTotalBtu();
  var totalCfm = getProjTotalCfm();
  var totalTr  = getProjTotalTr();
  var totalMkt = getProjTotalMkt();
  var setV = function(id,v){ var el=G(id); if(el) el.textContent=v; };
  setV('ptot-tr', totalTr.toFixed(1));
  setV('ptot-cfm', Math.round(totalCfm).toLocaleString());
  setV('ptot-btu', Math.round(totalBtu).toLocaleString());
  setV('ptot-mkt', Math.round(totalMkt).toLocaleString());

  // Populate system type dropdown if empty
  var sysTypeSel = G('proj-systype');
  if(sysTypeSel && !sysTypeSel.options.length){
    var UT_KEYS_PROJ = ['split','floor','ducted','cassette','package','vrf','chiller_air','chiller_water','fcu','ahu','window'];
    sysTypeSel.innerHTML = UT_KEYS_PROJ.map(function(k){
      return '<option value="'+k+'"'+(projState.sysType===k?' selected':'')+'>'+utLabel(k)+'</option>';
    }).join('');
  }
  var curUT = (sysTypeSel && sysTypeSel.value) || projState.sysType;

  // Capacity dropdown
  var capSel = G('proj-cap');
  if(capSel){
    var cat2 = getCatalog(curUT);
    // Only rebuild if stale
    if(!capSel.options.length || capSel.dataset.forType !== curUT){
      capSel.innerHTML = cat2.map(function(c){
        var lbl = lang==='ar' ? c.label.ar : c.label.en;
        return '<option value="'+c.btu+'">'+lbl+'</option>';
      }).join('');
      capSel.dataset.forType = curUT;
      syncProjectRecommendation({unitType:curUT});
      capSel.value = projState.selBtu;
      if(!capSel.value && cat2.length){ capSel.selectedIndex=0; projState.selBtu=cat2[0].btu; }
    }
    projState.selBtu = parseInt(capSel.value) || (cat2.length?cat2[0].btu:0);
    if(getProjectQtyAuto()){
      syncProjectRecommendation({unitType:curUT,keepSelectedCapacity:true});
      capSel.value = projState.selBtu;
    }
  }

  // Qty / UP
  var qtyEl = G('proj-qty'), upEl = G('proj-up');
  projState.qty = Math.max(1, parseInt((qtyEl||{value:'1'}).value)||1);
  projState.up  = parseFloat((upEl||{value:'0'}).value)||0;
  if(getProjectQtyAuto()){
    syncProjectRecommendation({unitType:curUT,keepSelectedCapacity:true});
    projState.up  = parseFloat((upEl||{value:'0'}).value)||0;
  } else {
    projState.autoReason = buildAutoQtyReason('manual');
  }
  if(qtyEl){
    qtyEl.value = projState.qty;
    qtyEl.readOnly = getProjectQtyAuto();
  }

  var projQtyAutoTools = G('proj-qty-auto-tools');
  if(projQtyAutoTools){
    projQtyAutoTools.innerHTML =
      '<div class="qty-auto-row">'+
        '<button type="button" class="qty-auto-btn '+(getProjectQtyAuto()?'active':'')+'" onclick="setProjectQtyAuto(true)">'+(isAr?'تلقائي':'Auto')+'</button>'+
        '<button type="button" class="qty-auto-btn '+(!getProjectQtyAuto()?'active':'')+'" onclick="setProjectQtyAuto(false)">'+(isAr?'يدوي':'Manual')+'</button>'+
      '</div>'+
      '<div class="qty-auto-note">'+getProjectAutoReason()+'</div>';
  }

  var projQtyMinus = G('proj-qty-minus');
  var projQtyPlus = G('proj-qty-plus');
  if(projQtyMinus) projQtyMinus.disabled = getProjectQtyAuto();
  if(projQtyPlus) projQtyPlus.disabled = getProjectQtyAuto();

  // Capacity comparison
  var reqBtu = totalBtu;
  var effBtu = projState.selBtu * projState.qty;
  var statusRow = G('proj-status-row');
  if(statusRow && reqBtu > 0){
    var deltaRaw = (effBtu - reqBtu) / reqBtu * 100;
    var deltaRnd = Math.round(deltaRaw*10)/10;
    var pctStr = (deltaRnd>=0?'+':'')+deltaRnd.toFixed(1)+'%';
    var badge, warnDiv='';
    if(deltaRaw < 0){
      var abs2=Math.abs(deltaRnd), sev=abs2>15?'severe':'mild';
      var icon=abs2>15?'⛔':'⚠';
      badge='<span class="qi-cap-badge '+(abs2>15?'deficit-severe':'deficit-mild')+'">'+icon+' '+(isAr?'عجز سعة':'Deficit')+' '+(-deltaRnd).toFixed(1)+'%</span>';
      warnDiv='<div class="qi-warn '+sev+'" style="margin-top:8px">'+
        '<div class="qi-warn-head">'+(isAr?'السعة الكلية أقل من الحمل المطلوب':'Total capacity below required load')+'</div>'+
        '<div class="qi-warn-row">'+(isAr?'المطلوب: ':'Required: ')+Math.round(reqBtu).toLocaleString()+' BTU/h — '+
          (isAr?'المختار: ':'Selected: ')+Math.round(effBtu).toLocaleString()+' BTU/h</div>'+
        '</div>';
    } else if(deltaRaw<=5){
      badge='<span class="qi-cap-badge matched">✓ '+(isAr?'مطابقة':'Match')+' '+pctStr+'</span>';
    } else if(deltaRaw<=25){
      badge='<span class="qi-cap-badge oversize-ok">'+(isAr?'سعة زائدة':'Slight oversize')+' '+pctStr+'</span>';
    } else {
      badge='<span class="qi-cap-badge oversize-high">'+(isAr?'سعة عالية':'High oversize')+' '+pctStr+'</span>';
      warnDiv='<div class="qi-warn mild" style="margin-top:8px"><div class="qi-warn-head">ℹ '+(isAr?'السعة أعلى بكثير — احتمال قصر دورة الضاغط.':'Significant oversize — short cycling risk.')+'</div></div>';
    }
    statusRow.innerHTML = badge + warnDiv;
  } else if(statusRow){ statusRow.innerHTML=''; }

  // ── DUCT SIZING ─────────────────────────────────────────────────
  var ductBlock = G('proj-duct-block');
  if(ductBlock){
    if(isDucted(curUT) && (totalCfm > 0 || projState.selBtu > 0)){
      ductBlock.style.display='';
      var vSup = parseInt((G('duct-vel-sup')||{value:'1000'}).value)||1000;
      var vRet = parseInt((G('duct-vel-ret')||{value:'800'}).value)||800;
      var _cfmPerTr = parseInt((G('duct-cfm-per-tr')||{value:'400'}).value)||400;

      // ── requiredCFM: what the project NEEDS (used for duct sizing ALWAYS) ──
      var requiredCFM = (totalCfm > 0)
        ? Math.round(totalCfm)
        : Math.round(totalTr * _cfmPerTr);
      var _qReqSrc = (totalCfm > 0)
        ? (isAr ? 'إجمالي CFM المشروع' : 'Project Total CFM')
        : (isAr ? ('TR × ' + _cfmPerTr + ' CFM/TR') : ('TR × ' + _cfmPerTr + ' CFM/TR'));

      // ── unitCFM: what the selected unit configuration provides ──
      var _catD = getCatalog(curUT);
      var _selEntry = null;
      for(var _ci=0; _ci<_catD.length; _ci++){
        if(_catD[_ci].btu === projState.selBtu){ _selEntry = _catD[_ci]; break; }
      }
      var _isCfmBased = (_selEntry && _selEntry.cfm > 0);
      var _unitCfmPerUnit = 0, _qSelSrcAr = '', _qSelSrcEn = '';
      if(_isCfmBased){
        _unitCfmPerUnit = _selEntry.cfm;
        _qSelSrcAr = 'CFM الوحدة × ' + projState.qty + ' وحدة';
        _qSelSrcEn = 'Unit CFM × ' + projState.qty + ' unit(s)';
      } else if(projState.selBtu > 0){
        var _selTr = projState.selBtu / 12000;
        _unitCfmPerUnit = Math.round(_selTr * _cfmPerTr);
        _qSelSrcAr = _selTr.toFixed(1) + ' TR × ' + _cfmPerTr + ' × ' + projState.qty;
        _qSelSrcEn = _selTr.toFixed(1) + ' TR × ' + _cfmPerTr + ' × ' + projState.qty;
      }
      var unitCFM = _unitCfmPerUnit * Math.max(1, projState.qty);

      // ── Read sizing basis toggle ──
      var _basis = (typeof window._ductBasis !== 'undefined') ? window._ductBasis : 'required';
      // Q_design: required basis → use project required CFM; unit basis → use unit CFM
      var Q_design = (_basis === 'unit' && unitCFM > 0) ? unitCFM : requiredCFM;

      // ── Show/hide CFM/TR row ──
      var cfmTrRow = G('duct-cfm-per-tr-row');
      if(cfmTrRow) cfmTrRow.style.display = (_isCfmBased && totalCfm > 0) ? 'none' : '';

      // ── Toggle button styles ──
      var _btnReq = G('duct-basis-req'), _btnSel = G('duct-basis-sel');
      if(_btnReq && _btnSel){
        if(_basis === 'required'){
          _btnReq.style.cssText='padding:3px 10px;border-radius:4px;border:1px solid rgba(52,211,153,.6);background:rgba(52,211,153,.18);color:var(--g);font-size:10px;font-family:var(--fe);cursor:pointer;font-weight:700';
          _btnSel.style.cssText='padding:3px 10px;border-radius:4px;border:1px solid var(--b);background:var(--s3);color:var(--tm);font-size:10px;font-family:var(--fe);cursor:pointer;font-weight:400';
        } else {
          _btnSel.style.cssText='padding:3px 10px;border-radius:4px;border:1px solid rgba(56,189,248,.6);background:rgba(56,189,248,.18);color:var(--a);font-size:10px;font-family:var(--fe);cursor:pointer;font-weight:700';
          _btnReq.style.cssText='padding:3px 10px;border-radius:4px;border:1px solid var(--b);background:var(--s3);color:var(--tm);font-size:10px;font-family:var(--fe);cursor:pointer;font-weight:400';
        }
        _btnReq.textContent = isAr ? 'حسب الاحتياج' : 'Required';
        _btnSel.textContent = isAr ? 'حسب الوحدة' : 'Selected Unit';
      }

      // ── CFM info panel: show both Q_design and unitCFM clearly ──
      var _qInfoEl = G('duct-q-info');
      if(_qInfoEl){
        var _cfmDiff = unitCFM > 0 ? ((unitCFM - requiredCFM) / requiredCFM * 100) : 0;
        var _cfmDiffSign = _cfmDiff >= 0 ? '+' : '';
        var _cfmMatchColor = unitCFM <= 0 ? 'var(--tm)'
          : (_cfmDiff < -10 ? '#ef4444' : (_cfmDiff > 25 ? '#f59e0b' : '#34d399'));
        var _cfmMatchIcon = unitCFM <= 0 ? '' : (_cfmDiff < -10 ? '⚠ ' : (_cfmDiff > 25 ? '⚠ ' : '✅ '));
        if(isAr){
          _qInfoEl.innerHTML =
            '<div class="duct-note" style="margin-bottom:4px;direction:rtl">'+
              '<span style="color:var(--tm)">مصدر CFM التصميم: </span>'+
              '<strong style="color:var(--g);font-family:var(--fe)">Q = '+Number(Q_design).toLocaleString()+' CFM</strong>'+
              '<span style="color:var(--tm);font-size:9px"> ('+_qReqSrc+')</span>'+
            '</div>'+
            (unitCFM>0?
              '<div class="duct-note" style="direction:rtl">'+
                '<span style="color:var(--tm)">CFM حسب الوحدة: </span>'+
                '<span style="font-family:var(--fe);color:var(--tm)">'+Number(unitCFM).toLocaleString()+' CFM</span>'+
                '<span style="color:var(--tm);font-size:9px"> ('+_qSelSrcAr+')</span>'+
                '<span style="color:'+_cfmMatchColor+';font-size:9px;margin-right:6px"> '+_cfmDiffSign+_cfmDiff.toFixed(1)+'%</span>'+
              '</div>':'');
        } else {
          _qInfoEl.innerHTML =
            '<div class="duct-note" style="margin-bottom:4px">'+
              '<span style="color:var(--tm)">Duct Design CFM: </span>'+
              '<strong style="color:var(--g);font-family:var(--fe)">Q = '+Number(Q_design).toLocaleString()+' CFM</strong>'+
              '<span style="color:var(--tm);font-size:9px"> ('+_qReqSrc+')</span>'+
            '</div>'+
            (unitCFM>0?
              '<div class="duct-note">'+
                '<span style="color:var(--tm)">Unit airflow: </span>'+
                '<span style="font-family:var(--fe);color:var(--tm)">'+Number(unitCFM).toLocaleString()+' CFM</span>'+
                '<span style="color:var(--tm);font-size:9px"> ('+_qSelSrcEn+')</span>'+
                '<span style="color:'+_cfmMatchColor+';font-size:9px;margin-left:6px"> '+_cfmDiffSign+_cfmDiff.toFixed(1)+'%</span>'+
              '</div>':'');
        }
      }

      // ── Airflow warning: unitCFM vs requiredCFM (separate from duct sizing) ──
      var _qWarnEl = G('duct-q-warn');
      if(_qWarnEl && requiredCFM > 0 && unitCFM > 0){
        var _diffPct2 = (unitCFM - requiredCFM) / requiredCFM * 100;
        if(_diffPct2 < -10){
          _qWarnEl.style.display='';
          _qWarnEl.innerHTML =
            '<div class="duct-note" style="background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.35);border-radius:5px;padding:5px 9px;margin-bottom:4px;direction:'+(isAr?'rtl':'ltr')+'">'+
            '<span style="color:#ef4444;font-weight:700">'+
            (isAr?'⚠ تنبيه تدفق الهواء: ':'⚠ Airflow Warning: ')+
            '</span>'+
            '<span style="color:#ef4444;font-size:10px">'+
            (isAr
              ? 'CFM الوحدة ('+Number(unitCFM).toLocaleString()+') أقل من المطلوب ('+Number(requiredCFM).toLocaleString()+') بنسبة '+Math.abs(_diffPct2).toFixed(1)+'% — قد يؤثر على جودة التهوية/التبريد.'
              : 'Unit CFM ('+Number(unitCFM).toLocaleString()+') is '+Math.abs(_diffPct2).toFixed(1)+'% below required ('+Number(requiredCFM).toLocaleString()+') — may affect ventilation/cooling performance.')+
            '</span>'+
            '<div style="font-size:9px;color:#94a3b8;margin-top:3px">'+
            (isAr?'* مقاسات المجاري محسوبة دائمًا على أساس CFM المطلوب.':'* Duct dimensions are always sized using required CFM.')+
            '</div></div>';
        } else if(_diffPct2 > 25){
          _qWarnEl.style.display='';
          _qWarnEl.innerHTML =
            '<div class="duct-note" style="background:rgba(251,191,36,.08);border:1px solid rgba(251,191,36,.35);border-radius:5px;padding:5px 9px;margin-bottom:4px;direction:'+(isAr?'rtl':'ltr')+'">'+
            '<span style="color:#f59e0b;font-weight:700">'+
            (isAr?'⚠ ملاحظة تدفق الهواء: ':'⚠ Airflow Note: ')+
            '</span>'+
            '<span style="color:#f59e0b;font-size:10px">'+
            (isAr
              ? 'CFM الوحدة ('+Number(unitCFM).toLocaleString()+') أعلى من المطلوب بنسبة '+_diffPct2.toFixed(1)+'% — تحقق من الضوضاء/Short Cycling.'
              : 'Unit CFM ('+Number(unitCFM).toLocaleString()+') exceeds required by '+_diffPct2.toFixed(1)+'% — verify noise/short cycling.')+
            '</span></div>';
        } else {
          _qWarnEl.style.display='';
          _qWarnEl.innerHTML =
            '<div class="duct-note" style="background:rgba(52,211,153,.06);border:1px solid rgba(52,211,153,.3);border-radius:5px;padding:5px 9px;margin-bottom:4px;direction:'+(isAr?'rtl':'ltr')+'">'+
            '<span style="color:#34d399;font-weight:700">✅ </span>'+
            '<span style="color:#34d399;font-size:10px">'+
            (isAr
              ? 'تدفق الوحدة مناسب للمطلوب ('+Number(unitCFM).toLocaleString()+' / '+Number(requiredCFM).toLocaleString()+' CFM)'
              : 'Unit airflow meets requirement ('+Number(unitCFM).toLocaleString()+' / '+Number(requiredCFM).toLocaleString()+' CFM)')+
            '</span></div>';
        }
      } else if(_qWarnEl){ _qWarnEl.style.display='none'; }

      // ── Size ducts using Q_design (requiredCFM) ALWAYS ──
      var supDuct = calcDuctSize(Q_design, vSup);
      var retDuct = calcDuctSize(Q_design, vRet); // Return uses same Q_design but its own velocity
      var _sd = supDuct ? (supDuct.std||supDuct.calc) : null;
      var _rd = retDuct ? (retDuct.std||retDuct.calc) : null;
      // Cache structured duct data for Advanced Mode (avoids fragile DOM text parsing)
      window._lastDuctSizing = {
        supCfm: Q_design, retCfm: Math.round(Q_design * 0.9),
        sup: _sd ? { w: _sd.w, h: _sd.h, actualFpm: _sd.actualFpm } : null,
        ret: _rd ? { w: _rd.w, h: _rd.h, actualFpm: _rd.actualFpm } : null,
        vSup: vSup, vRet: vRet
      };
      // m³/s: 1 CFM = 0.000471947 m³/s
      var _qM3s = (Q_design * 0.000471947).toFixed(3);
      setV('duct-sup-val', _sd ? ductSizeLabel(_sd)+(_sd.actualFpm?' ('+_sd.actualFpm+' fpm)':'') : '—');
      setV('duct-ret-val', _rd ? ductSizeLabel(_rd)+(_rd.actualFpm?' ('+_rd.actualFpm+' fpm)':'') : '—');
      // Show m³/s in Q info panel
      var _m3sEl = G('duct-m3s-row');
      if(_m3sEl) _m3sEl.textContent = (isAr?'Q = '+Number(Q_design).toLocaleString()+' CFM = '+_qM3s+' m³/s':'Q = '+Number(Q_design).toLocaleString()+' CFM = '+_qM3s+' m³/s');

      // ── Basis label ──
      var _bLbl = G('duct-basis-lbl');
      if(_bLbl) _bLbl.textContent = isAr ? 'أساس التصميم:' : 'Sizing basis:';

      // ── Update ESP and labels ──
      calcESP();
      // ESP label translations
      var _espTtl=G('esp-ttl'); if(_espTtl) _espTtl.textContent=isAr?'حساب الضغط الساكن (ESP)':'Static Pressure (ESP)';
      var _slsup=G('esp-lbl-len-sup'); if(_slsup) _slsup.textContent=isAr?'طول الإمداد (م)':'Supply Length (m)';
      var _slret=G('esp-lbl-len-ret'); if(_slret) _slret.textContent=isAr?'طول الرجوع (م)':'Return Length (m)';
      var _sbnd=G('esp-lbl-bends'); if(_sbnd) _sbnd.textContent=isAr?'عدد الانحناءات':'No. of Bends';
      var _sfric=G('esp-lbl-fric'); if(_sfric) _sfric.textContent=isAr?'فقد الاحتكاك المستقيم (Pa/m)':'Straight Friction Loss (Pa/m)';
      var _sBend=G('esp-lbl-bend-loss'); if(_sBend) _sBend.textContent=isAr?'فقد الانحناءة الواحدة (Pa)':'Bend Loss (Pa)';
      var _sFilter=G('esp-lbl-filter'); if(_sFilter) _sFilter.textContent=isAr?'فقد الفلتر (Pa)':'Filter Loss (Pa)';
      var _sDiff=G('esp-lbl-diffuser'); if(_sDiff) _sDiff.textContent=isAr?'فقد مخارج الهواء / الجريلات (Pa)':'Diffuser / Grille Loss (Pa)';
      var _espPathGroup=G('esp-group-path'); if(_espPathGroup) _espPathGroup.textContent=isAr?'مدخلات المسار':'Path Inputs';
      var _espLossGroup=G('esp-group-losses'); if(_espLossGroup) _espLossGroup.textContent=isAr?'الفواقد الإضافية':'Additional Losses';
      var _espResultGroup=G('esp-group-result'); if(_espResultGroup) _espResultGroup.textContent='ESP ' + (isAr?'النتيجة':'Result');
      var _espBreakGroup=G('esp-group-breakdown'); if(_espBreakGroup) _espBreakGroup.textContent=isAr?'تفصيل الحساب':'Calculation Breakdown';
      syncEspBreakdownToggle();
      var _sCoil=G('esp-lbl-coil'); if(_sCoil) _sCoil.textContent=isAr?'فقد الكويل (Pa)':'Coil Loss (Pa)';
      var _sDamper=G('esp-lbl-damper'); if(_sDamper) _sDamper.textContent=isAr?'فقد الدامبر (Pa)':'Damper Loss (Pa)';
      var _sOther=G('esp-lbl-other'); if(_sOther) _sOther.textContent=isAr?'بدل إضافي (Pa)':'Other Allowance (Pa)';

    } else {
      ductBlock.style.display='none';
    }
  }// Line total
  var lt = projState.qty * projState.selBtu > 0 ? projState.qty * projState.up : 0;
  lt = projState.qty * projState.up;
  setV('proj-lt-val', (G('cur-sym')?G('cur-sym').textContent:t('cur'))+' '+money(lt));

  refreshGrandTotal();
  renderQuote();
  updateQuoteModeAuxVisibility();
}

// ── Update labels on lang change
function updateProjLabels(){
  var isAr=lang==='ar';
  var sl=function(id,ar,en){ var el=G(id); if(el) el.textContent=isAr?ar:en; };
  sl('proj-block-ttl','📊 إجماليات المشروع','📊 Project Totals');
  sl('proj-lbl-systype','نوع النظام','System Type');
  sl('proj-lbl-cap','السعة المختارة','Selected Capacity');
  sl('proj-lbl-qty','عدد الوحدات','Unit Count');
  sl('proj-lbl-up','سعر الوحدة (ر.س)','Unit Price (SAR)');
  sl('proj-duct-ttl','🌬 تصميم مجاري الهواء','🌬 Duct Sizing');
  sl('duct-vel-sup-lbl','سرعة الإمداد (fpm)','Supply Velocity (fpm)');
  sl('duct-vel-ret-lbl','سرعة الرجوع (fpm)','Return Velocity (fpm)');
  sl('duct-sup-lbl','مجرى الإمداد الرئيسي:','Main Supply Duct:');
  sl('duct-ret-lbl','مجرى الرجوع الرئيسي:','Main Return Duct:');
  sl('duct-note-txt','تصميم أولي — يجب التحقق من الضغط الساكن والمخطط.','Preliminary sizing — verify with static pressure & layout.');
  sl('duct-cfmtr-lbl','CFM/TR','CFM/TR');
  sl('duct-basis-lbl','أساس التصميم:','Sizing basis:');
  sl('proj-lt-lbl','إجمالي السطر','Line Total');
  sl('esp-ttl','حساب الضغط الساكن (ESP)','Static Pressure (ESP)');
  sl('esp-lbl-len-sup','طول مجرى الإمداد (م)','Supply Duct Length (m)');
  sl('esp-lbl-len-ret','طول مجرى الرجوع (م)','Return Duct Length (m)');
  sl('esp-lbl-bends','عدد الانحناءات','Number of Bends');
  sl('esp-lbl-fric','فقد الاحتكاك المستقيم (Pa/m)','Straight Friction Loss (Pa/m)');
  sl('esp-lbl-bend-loss','فقد الانحناءة الواحدة (Pa)','Bend Loss (Pa)');
  sl('esp-lbl-filter','فقد الفلتر (Pa)','Filter Loss (Pa)');
  sl('esp-lbl-diffuser','فقد مخارج الهواء / الجريلات (Pa)','Diffuser / Grille Loss (Pa)');
  sl('esp-group-path','مدخلات المسار','Path Inputs');
  sl('esp-group-losses','الفواقد الإضافية','Additional Losses');
  sl('esp-group-result','نتيجة ESP','ESP Result');
  sl('esp-group-breakdown','تفصيل الحساب','Calculation Breakdown');
  syncEspBreakdownToggle();
  sl('esp-lbl-coil','فقد الكويل (Pa)','Coil Loss (Pa)');
  sl('esp-lbl-damper','فقد الدامبر (Pa)','Damper Loss (Pa)');
  sl('esp-lbl-other','بدل إضافي (Pa)','Other Allowance (Pa)');
  sl('mode-lbl-room','🏠 وحدة لكل غرفة','🏠 Unit per Room');
  sl('mode-lbl-proj','🏢 وحدة للمشروع','🏢 One Unit for Project');
  // Refresh capacity labels in proj-cap dropdown
  var capSel=G('proj-cap');
  if(capSel && capSel.dataset.forType){
    var cat=getCatalog(capSel.dataset.forType);
    var cur=parseInt(capSel.value)||0;
    capSel.innerHTML=cat.map(function(c){
      var lbl=lang==='ar'?c.label.ar:c.label.en;
      return '<option value="'+c.btu+'"'+(c.btu===cur?' selected':'')+'>'+lbl+'</option>';
    }).join('');
  }
  // Proj system type dropdown
  var stSel=G('proj-systype');
  if(stSel && stSel.options.length){
    var curST=stSel.value;
    stSel.innerHTML=['split','floor','ducted','cassette','package','vrf','chiller_air','chiller_water','fcu','ahu','window'].map(function(k){
      return '<option value="'+k+'"'+(k===curST?' selected':'')+'>'+utLabel(k)+'</option>';
    }).join('');
  }
  calcESP();
}

// ══════════════════════════════════════════════════════════════════
// C) OVERRIDE refreshGrandTotal to handle project mode
// ══════════════════════════════════════════════════════════════════
var _origRefreshGT = refreshGrandTotal;
refreshGrandTotal = function(){
  var totalQty=0, subtotal=0;
  if(quoteMode==='proj'){
    var pQty = Math.max(1, parseInt((G('proj-qty')||{value:'1'}).value)||1);
    var pUP  = parseFloat((G('proj-up')||{value:'0'}).value)||0;
    totalQty = pQty;
    subtotal = pQty * pUP;
  } else {
    for(var i=0;i<hist.length;i++){ totalQty+=getQty(i); subtotal+=getQty(i)*getUP(i); }
  }
  var ip=parseInt((G('qs-inst')||{value:'10'}).value)||10;
  var instAmt=subtotal*ip/100;
  var vatBase=subtotal+instAmt;
  var vatAmt=vatOn?vatBase*0.15:0;
  var grand=vatBase+vatAmt;
  var cur=t('cur');
  var isl=G('qs-instl'); if(isl) isl.textContent=t('qsinstl')+' ('+ip+'%)';
  var sv=G('qs-subtotal-v'); if(sv) sv.textContent=cur+' '+money(subtotal);
  var iv=G('qs-inst-v'); if(iv) iv.textContent=cur+' '+money(instAmt);
  var vr=G('vat-row'); if(vr) vr.style.display=vatOn?'':'none';
  var vv=G('qs-vat-v'); if(vv) vv.textContent=cur+' '+money(vatAmt);
  var tq=G('qt-total-qty'); if(tq) tq.textContent=totalQty;
  var tg=G('qt-grand'); if(tg) tg.textContent=cur+' '+money(grand);
};

// ══════════════════════════════════════════════════════════════════
// D) OVERRIDE buildPage1 to support project mode
// ══════════════════════════════════════════════════════════════════
var _origBuildPage1 = buildPage1;
buildPage1 = function(c){
  if(quoteMode !== 'proj') return _origBuildPage1(c);
  // Project mode: single line item
  var sysTypeSel=G('proj-systype'); var curUT=(sysTypeSel&&sysTypeSel.value)||projState.sysType;
  var utLbl=c.utLbls[curUT]||curUT;
  var selBtu=projState.selBtu||0;
  var selTR=(selBtu/12000).toFixed(1);
  var qty=projState.qty, up=projState.up, lt=qty*up;
  var totalReqBtu=getProjTotalBtu();
  var effBtu=selBtu*qty;
  var d3raw=totalReqBtu>0?((effBtu-totalReqBtu)/totalReqBtu*100):0;
  var d3rnd=Math.round(d3raw*10)/10, d3pct=(d3rnd>=0?'+':'')+d3rnd.toFixed(1)+'%';
  var d3bc, d3bt;
  if(d3raw<0){ var abs3=Math.abs(d3rnd); d3bc=abs3>15?'#dc2626':'#d97706'; d3bt=(abs3>15?'⛔ ':'⚠ ')+(c.isAr?'عجز سعة':'Capacity Deficit')+' '+d3rnd.toFixed(1)+'%'; }
  else if(d3raw<=5){ d3bc='#059669'; d3bt='✓ '+(c.isAr?'مطابقة':'Match')+' '+d3pct; }
  else if(d3raw<=25){ d3bc='#4f46e5'; d3bt=(c.isAr?'سعة زائدة':'Slight Oversize')+' '+d3pct; }
  else { d3bc='#6b7280'; d3bt=(c.isAr?'سعة عالية':'High Oversize')+' '+d3pct; }
  var row='<tr style="background:#ffffff">'+
    '<td style="color:#64748b">1</td>'+
    '<td class="td-name">'+(c.isAr?'مشروع كامل':'Whole Project')+'<div style="font-size:10px;color:#0ea5e9;font-weight:600">'+utLbl+'</div></td>'+
    '<td>'+Number(selBtu).toLocaleString()+' BTU</td>'+
    '<td>'+selTR+' TR</td>'+
    '<td>'+qty+'</td>'+
    '<td>'+c.cur+' '+money(up)+'</td>'+
    '<td style="color:#059669;font-weight:700">'+c.cur+' '+money(lt)+'</td>'+
    '<td style="text-align:center"><span style="font-size:10px;font-weight:700;color:'+d3bc+'">'+d3bt+'</span></td>'+
    '</tr>';
  var ip=c.ip; var subtotal=lt; var instAmt=subtotal*ip/100; var vatBase=subtotal+instAmt;
  var vatAmt=vatOn?vatBase*0.15:0; var grand=vatBase+vatAmt;
  var vatRowHtml=vatOn?'<div class="tot-row"><span class="tot-lbl">'+(c.isAr?'ضريبة القيمة المضافة 15%':'VAT 15%')+'</span><span class="tot-val">'+c.cur+' '+money(vatAmt)+'</span></div>':'';
  var notesHtml=c.notes?'<div style="margin-bottom:14px;padding:10px 14px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;font-size:12px;color:#475569"><strong>'+(c.isAr?'ملاحظات:':'Notes:')+'</strong> '+c.notes+'</div>':'';
  var th=c.isAr?'background:#0f172a;color:#fff;padding:9px 8px;font-weight:700;text-align:right;padding-right:12px;':'background:#0f172a;color:#fff;padding:9px 8px;font-weight:700;text-align:left;padding-left:12px;';
  var thC='background:#0f172a;color:#fff;padding:9px 8px;font-weight:700;text-align:center;';
  return '<div class="inv-page" id="pdf-page1">'+
    '<div class="inv-header">'+
      '<div class="inv-brand">'+
        '<div class="inv-brand-icon">❄</div>'+
        '<div><div class="inv-brand-name">AirCalc Pro</div>'+
        '<div class="inv-brand-sub">HVAC Engineering Suite</div></div>'+
      '</div>'+
      '<div style="text-align:'+(c.isAr?'left':'right')+'">'+
        '<div style="font-size:18px;font-weight:700;color:#0f172a">'+(c.isAr?'عرض سعر':'Quotation')+'</div>'+
        '<div style="font-size:13px;color:#64748b;margin-top:3px"># '+c.qno+'</div>'+
      '</div>'+
    '</div>'+
    '<div class="inv-meta-grid">'+
      '<div class="inv-meta-item"><div class="inv-meta-lbl">'+(c.isAr?'المشروع':'Project')+'</div><div class="inv-meta-val">'+c.proj+'</div></div>'+
      '<div class="inv-meta-item"><div class="inv-meta-lbl">'+(c.isAr?'التاريخ':'Date')+'</div><div class="inv-meta-val">'+c.today+'</div></div>'+
      '<div class="inv-meta-item"><div class="inv-meta-lbl">'+(c.isAr?'صلاحية العرض':'Validity')+'</div><div class="inv-meta-val">'+c.validLabel+'</div></div>'+
      '<div class="inv-meta-item"><div class="inv-meta-lbl">'+(c.isAr?'الوضع':'Mode')+'</div><div class="inv-meta-val">'+(c.isAr?'وحدة للمشروع':'Project Unit')+'</div></div>'+
    '</div>'+
    '<div class="page-title">'+(c.isAr?'ملخص العميل':'Client Summary')+'<span class="page-badge client">'+(c.isAr?'للعميل':'CLIENT')+'</span></div>'+
    '<table>'+
      '<thead><tr>'+
        '<th style="'+thC+'">#</th>'+
        '<th style="'+th+'">'+(c.isAr?'نوع الغرفة / النظام':'Room / System')+'</th>'+
        '<th style="'+thC+'">BTU/h</th>'+
        '<th style="'+thC+'">TR</th>'+
        '<th style="'+thC+'">'+(c.isAr?'الكمية':'Qty')+'</th>'+
        '<th style="'+thC+'">'+(c.isAr?'سعر الوحدة':'Unit Price')+'</th>'+
        '<th style="'+thC+'">'+(c.isAr?'الإجمالي':'Total')+'</th>'+
        '<th style="'+thC+'">'+(c.isAr?'الحالة':'Status')+'</th>'+
      '</tr></thead>'+
      '<tbody>'+row+'</tbody>'+
    '</table>'+
    '<div class="totals-box">'+
      '<div class="tot-row"><span class="tot-lbl">'+(c.isAr?'المجموع الفرعي':'Subtotal')+'</span><span class="tot-val">'+c.cur+' '+money(subtotal)+'</span></div>'+
      '<div class="tot-row"><span class="tot-lbl">'+(c.isAr?'التركيب ('+ip+'%)':'Installation ('+ip+'%)')+'</span><span class="tot-val">'+c.cur+' '+money(instAmt)+'</span></div>'+
      vatRowHtml+
      '<div class="tot-row"><span class="tot-lbl">'+(c.isAr?'الإجمالي النهائي':'Grand Total')+'</span><span class="tot-val" style="color:#0ea5e9;font-size:15px">'+c.cur+' '+money(grand)+'</span></div>'+
    '</div>'+
    notesHtml+
    (hist.length>0?
      '<div style="margin-bottom:14px;border:1px solid #e0f2fe;border-radius:8px;overflow:hidden;page-break-inside:avoid">'+
        '<div style="background:#0284c7;color:#fff;padding:8px 14px;font-size:11px;font-weight:700">'+
          '🏠 '+(c.isAr?'الغرف المشمولة في هذا العرض':'Rooms Included in This Quotation')+
        '</div>'+
        '<table style="width:100%;border-collapse:collapse;font-size:10px">'+
          '<thead><tr style="background:#e0f2fe">'+
            '<th style="padding:5px 8px;border:1px solid #bae6fd;text-align:center;color:#0369a1">#</th>'+
            '<th style="padding:5px 8px;border:1px solid #bae6fd;text-align:'+(c.isAr?'right':'left')+';color:#0369a1">'+(c.isAr?'اسم الغرفة':'Room Name')+'</th>'+
            '<th style="padding:5px 8px;border:1px solid #bae6fd;text-align:center;color:#0369a1">'+(c.isAr?'عدد الغرف':'Room Count')+'</th>'+
            '<th style="padding:5px 8px;border:1px solid #bae6fd;text-align:center;color:#0369a1">BTU/h</th>'+
            '<th style="padding:5px 8px;border:1px solid #bae6fd;text-align:center;color:#0369a1">TR</th>'+
            '<th style="padding:5px 8px;border:1px solid #bae6fd;text-align:center;color:#0369a1">CFM</th>'+
            '<th style="padding:5px 8px;border:1px solid #bae6fd;text-align:center;color:#0369a1">m³</th>'+
          '</tr></thead><tbody>'+
          (function(){
            var rrows='', reqTotBtu=0, reqTotCfm=0;
            hist.forEach(function(rh,ri){
              var rn=c.isAr?(rh.ar||rh.en):(rh.en||rh.ar);
              rn=(rn||'').replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}]/gu,'').trim();
              var rbtu=parseInt(rh.btu)||0, rcfm=parseInt(rh.cfm)||0;
              reqTotBtu+=rbtu; reqTotCfm+=rcfm;
              var rbg=(ri%2===0)?'#ffffff':'#f0f9ff';
              rrows+='<tr style="background:'+rbg+'">'+
                '<td style="padding:5px 8px;border:1px solid #bae6fd;text-align:center;color:#64748b">'+(ri+1)+'</td>'+
                '<td style="padding:5px 8px;border:1px solid #bae6fd;font-weight:600">'+rn+'</td>'+
                '<td style="padding:5px 8px;border:1px solid #bae6fd;text-align:center;font-family:monospace">'+getRecordRoomCount(ri)+'</td>'+
                '<td style="padding:5px 8px;border:1px solid #bae6fd;text-align:center;font-family:monospace">'+Number(rbtu).toLocaleString()+'</td>'+
                '<td style="padding:5px 8px;border:1px solid #bae6fd;text-align:center;font-family:monospace">'+(rbtu/12000).toFixed(2)+'</td>'+
                '<td style="padding:5px 8px;border:1px solid #bae6fd;text-align:center;font-family:monospace">'+rcfm.toLocaleString()+'</td>'+
                '<td style="padding:5px 8px;border:1px solid #bae6fd;text-align:center;font-family:monospace">'+(rh.vol||'—')+'</td>'+
              '</tr>';
            });
            rrows+='<tr style="background:#dbeafe;font-weight:700">'+
              '<td style="padding:6px 8px;border:1px solid #93c5fd;text-align:center" colspan="2">'+(c.isAr?'الإجمالي المطلوب':'Total Required')+'</td>'+
              '<td style="padding:6px 8px;border:1px solid #93c5fd;text-align:center;font-family:monospace;color:#1d4ed8">'+getTotalRecordRoomCount()+'</td>'+
              '<td style="padding:6px 8px;border:1px solid #93c5fd;text-align:center;font-family:monospace;color:#1d4ed8">'+Number(reqTotBtu).toLocaleString()+'</td>'+
              '<td style="padding:6px 8px;border:1px solid #93c5fd;text-align:center;font-family:monospace;color:#1d4ed8">'+(reqTotBtu/12000).toFixed(2)+'</td>'+
              '<td style="padding:6px 8px;border:1px solid #93c5fd;text-align:center;font-family:monospace;color:#1d4ed8">'+reqTotCfm.toLocaleString()+'</td>'+
              '<td style="padding:6px 8px;border:1px solid #93c5fd;text-align:center">—</td>'+
            '</tr>';
            return rrows;
          })()+
        '</tbody></table>'+
      '</div>'
    :'')+
    '<div class="footer">AirCalc Pro — HVAC Engineering Suite © '+new Date().getFullYear()+'</div>'+
    '</div>';
};

// ══════════════════════════════════════════════════════════════════
// E) OVERRIDE buildPage2 to add duct sizing + distribution table
// ══════════════════════════════════════════════════════════════════
var _origBuildPage2 = buildPage2;
buildPage2 = function(c){
  var base = _origBuildPage2(c);
  // Append duct sizing and distribution sections
  var extra = '';
  var sysTypeSel=G('proj-systype'); var curUT=(sysTypeSel&&sysTypeSel.value)||projState.sysType;
  var totalCfm = getProjTotalCfm();
  var totalTr2  = getProjTotalTr();
  var totalBtu2 = getProjTotalBtu();

  // ══ BUNDLE+PROJ: Project-level capacity & airflow summary banner ══════════
  if(c.isBundleProj){
    var _bSelBtu2 = projState.selBtu * Math.max(1,projState.qty);
    var _bCapDelta2 = totalBtu2>0?((_bSelBtu2-totalBtu2)/totalBtu2*100):0;
    var _bCapRnd2 = Math.round(_bCapDelta2*10)/10;
    var _bCapColor2 = Math.abs(_bCapDelta2)<5?'#166534':(_bCapDelta2>0?'#1d4ed8':'#dc2626');
    var _bCapLbl2 = c.isAr
      ? (Math.abs(_bCapDelta2)<5?'✅ مطابقة':(_bCapDelta2>0?'سعة BTU زائدة +'+_bCapRnd2+'%':'⚠ عجز سعة BTU '+_bCapRnd2+'%'))
      : (Math.abs(_bCapDelta2)<5?'✅ Match':(_bCapDelta2>0?'BTU Oversize +'+_bCapRnd2+'%':'⚠ BTU Deficit '+_bCapRnd2+'%'));
    var _bCfmPerTr2=parseInt((G('duct-cfm-per-tr')||{value:'400'}).value)||400;
    var _bReqCfm2 = totalCfm>0?Math.round(totalCfm):Math.round(totalTr2*_bCfmPerTr2);
    var _bCatD2=getCatalog(curUT); var _bSE2=null;
    for(var _bi2=0;_bi2<_bCatD2.length;_bi2++){ if(_bCatD2[_bi2].btu===projState.selBtu){_bSE2=_bCatD2[_bi2];break;} }
    var _bUnitCfmP2=(_bSE2&&_bSE2.cfm>0)?_bSE2.cfm:Math.round((projState.selBtu/12000)*_bCfmPerTr2);
    var _bUnitCfm2=_bUnitCfmP2*Math.max(1,projState.qty);
    var _bCfmDelta2=_bReqCfm2>0?((_bUnitCfm2-_bReqCfm2)/_bReqCfm2*100):0;
    var _bCfmRnd2=Math.round(_bCfmDelta2*10)/10;
    var _bCfmColor2=_bCfmDelta2<-5?'#dc2626':(_bCfmDelta2>25?'#d97706':'#166534');
    var _bCfmLbl2=c.isAr
      ?(_bCfmDelta2<-5?'⚠ تنبيه تدفق '+_bCfmRnd2+'%':(_bCfmDelta2>25?'تدفق زائد +'+_bCfmRnd2+'%':'✅ تدفق مناسب'))
      :(_bCfmDelta2<-5?'⚠ Airflow Warning '+_bCfmRnd2+'%':(_bCfmDelta2>25?'Excess Airflow +'+_bCfmRnd2+'%':'✅ Airflow OK'));
    var _bUtLbl2=c.utLbls[curUT]||curUT;
    extra+=
      '<div style="border:1px solid #fbbf24;border-radius:8px;padding:14px;margin-bottom:12px;background:#fffbeb;page-break-inside:avoid">'+
        '<div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #fde68a">'+
          '🏢 '+(c.isAr?'ملخص وحدة المشروع (وضع التجميع)':'Project Unit Summary (Bundle Mode)')+'</div>'+
        '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">'+
          '<div style="background:#fff;border:1px solid #fde68a;border-radius:6px;padding:8px;text-align:center">'+
            '<div style="font-size:9px;color:#64748b;margin-bottom:2px">'+(c.isAr?'نوع النظام':'System')+'</div>'+
            '<div style="font-size:12px;font-weight:700;color:#0ea5e9">'+_bUtLbl2+'</div></div>'+
          '<div style="background:#fff;border:1px solid #fde68a;border-radius:6px;padding:8px;text-align:center">'+
            '<div style="font-size:9px;color:#64748b;margin-bottom:2px">'+(c.isAr?'السعة × الكمية':'Capacity × Qty')+'</div>'+
            '<div style="font-size:11px;font-weight:700;color:#0ea5e9;font-family:monospace">'+Number(projState.selBtu).toLocaleString()+' × '+projState.qty+'</div></div>'+
          '<div style="background:#fff;border:1px solid #fde68a;border-radius:6px;padding:8px;text-align:center">'+
            '<div style="font-size:9px;color:#64748b;margin-bottom:2px">'+(c.isAr?'حالة BTU':'BTU Status')+'</div>'+
            '<div style="font-size:11px;font-weight:700;color:'+_bCapColor2+'">'+_bCapLbl2+'</div></div>'+
          '<div style="background:#fff;border:1px solid #fde68a;border-radius:6px;padding:8px;text-align:center">'+
            '<div style="font-size:9px;color:#64748b;margin-bottom:2px">'+(c.isAr?'تدفق الهواء':'Airflow')+'</div>'+
            '<div style="font-size:11px;font-weight:700;color:'+_bCfmColor2+'">'+_bCfmLbl2+'</div></div>'+
        '</div>'+
        '<table style="width:100%;border-collapse:collapse;font-size:10px;margin:0"><thead>'+
          '<tr style="background:#fef3c7">'+
            '<th style="padding:5px 8px;border:1px solid #fde68a;text-align:center">'+(c.isAr?'البيان':'Item')+'</th>'+
            '<th style="padding:5px 8px;border:1px solid #fde68a;text-align:center">'+(c.isAr?'المطلوب':'Required')+'</th>'+
            '<th style="padding:5px 8px;border:1px solid #fde68a;text-align:center">'+(c.isAr?'حسب الوحدة':'By Unit')+'</th>'+
            '<th style="padding:5px 8px;border:1px solid #fde68a;text-align:center">'+(c.isAr?'الفرق %':'Delta %')+'</th>'+
          '</tr></thead><tbody>'+
          '<tr>'+
            '<td style="padding:6px 8px;border:1px solid #fde68a;font-weight:600;text-align:center">BTU/h</td>'+
            '<td style="padding:6px 8px;border:1px solid #fde68a;text-align:center;font-family:monospace">'+Number(totalBtu2).toLocaleString()+'</td>'+
            '<td style="padding:6px 8px;border:1px solid #fde68a;text-align:center;font-family:monospace">'+Number(_bSelBtu2).toLocaleString()+'</td>'+
            '<td style="padding:6px 8px;border:1px solid #fde68a;text-align:center;color:'+_bCapColor2+';font-weight:700">'+(_bCapRnd2>=0?'+':'')+_bCapRnd2.toFixed(1)+'%</td>'+
          '</tr>'+
          '<tr>'+
            '<td style="padding:6px 8px;border:1px solid #fde68a;font-weight:600;text-align:center">CFM</td>'+
            '<td style="padding:6px 8px;border:1px solid #fde68a;text-align:center;font-family:monospace">'+Number(_bReqCfm2).toLocaleString()+'</td>'+
            '<td style="padding:6px 8px;border:1px solid #fde68a;text-align:center;font-family:monospace">'+Number(_bUnitCfm2).toLocaleString()+'</td>'+
            '<td style="padding:6px 8px;border:1px solid #fde68a;text-align:center;color:'+_bCfmColor2+';font-weight:700">'+(_bCfmRnd2>=0?'+':'')+_bCfmRnd2.toFixed(1)+'%</td>'+
          '</tr>'+
        '</tbody></table>'+
        '<div style="font-size:9px;color:#92400e;margin-top:6px">'+
          (c.isAr?'⚠ التجميع مفعّل: تعمل غرف المشروع كلها بوحدة واحدة. المقارنة على مستوى المشروع الكلي.':'⚠ Bundle Mode: All rooms share one project unit. Comparison is at project level.')+'</div>'+
      '</div>';
  }

  // ══ PROJECT/BUNDLE MODE: Full Duct Sizing Summary section ══════════════════════
  if((quoteMode==='proj'||bundleOn) && isDucted(curUT)){
    var vSup=parseInt((G('duct-vel-sup')||{value:'1000'}).value)||1000;
    var vRet=parseInt((G('duct-vel-ret')||{value:'800'}).value)||800;
    var _p2CfmPerTr=parseInt((G('duct-cfm-per-tr')||{value:'400'}).value)||400;
    // Q_design for PDF: follows the basis toggle
    var _p2RequiredCFM = (totalCfm > 0) ? Math.round(totalCfm) : Math.round(getProjTotalTr() * _p2CfmPerTr);
    var _p2Basis2 = (typeof window._ductBasis !== 'undefined') ? window._ductBasis : 'required';
    // Compute unitCFM for comparison
    var _p2CatD2 = getCatalog(curUT);
    var _p2SE2 = null;
    for(var _p2k=0;_p2k<_p2CatD2.length;_p2k++){ if(_p2CatD2[_p2k].btu===projState.selBtu){_p2SE2=_p2CatD2[_p2k];break;} }
    var _p2UCpu2 = (_p2SE2&&_p2SE2.cfm>0)?_p2SE2.cfm:(projState.selBtu>0?Math.round((projState.selBtu/12000)*_p2CfmPerTr):0);
    var _p2UnitCFM2 = _p2UCpu2 * Math.max(1,projState.qty);
    var _p2Cfm = (_p2Basis2==='unit' && _p2UnitCFM2>0) ? _p2UnitCFM2 : _p2RequiredCFM;
    // unitCFM for display comparison
    var _p2CatD = getCatalog(curUT);
    var _p2SelEntry = null;
    for(var _p2ci=0; _p2ci<_p2CatD.length; _p2ci++){
      if(_p2CatD[_p2ci].btu === projState.selBtu){ _p2SelEntry = _p2CatD[_p2ci]; break; }
    }
    var _p2UnitCfmPerUnit = (_p2SelEntry && _p2SelEntry.cfm > 0)
      ? _p2SelEntry.cfm
      : (projState.selBtu > 0 ? Math.round((projState.selBtu/12000) * _p2CfmPerTr) : 0);
    var _p2UnitCFM = _p2UnitCfmPerUnit * Math.max(1, projState.qty);
    var _p2Basis = _p2Basis2; // follows UI toggle
    var _p2BasisLbl = c.isAr
      ? (_p2Basis==='unit' ? 'حسب الوحدة — Q الوحدة' : 'حسب الاحتياج — Q المطلوب')
      : (_p2Basis==='unit' ? 'Unit CFM' : 'Required CFM (Project Load)');
    var _p2CfmSrcLbl = c.isAr
      ? (_p2Basis==='unit' ? 'CFM الوحدة المختارة' : 'إجمالي CFM المطلوب')
      : (_p2Basis==='unit' ? 'Selected Unit CFM' : 'Required Total CFM');
    // BTU Capacity status (separate from airflow)
    var _selBtu2 = projState.selBtu * Math.max(1,projState.qty);
    var _capDelta = totalBtu2>0 ? ((_selBtu2-totalBtu2)/totalBtu2*100) : 0;
    var _capDeltaRnd = Math.round(_capDelta*10)/10;
    var _capStatusAr, _capStatusEn, _capColor;
    if(_capDelta<0){
      var _capAbs=Math.abs(_capDeltaRnd);
      _capColor=_capAbs>15?'#dc2626':'#d97706';
      _capStatusAr=(_capAbs>15?'⛔ ':'⚠ ')+'عجز سعة '+_capDeltaRnd.toFixed(1)+'%';
      _capStatusEn=(_capAbs>15?'⛔ ':'⚠ ')+'Deficit '+_capDeltaRnd.toFixed(1)+'%';
    } else if(_capDelta<=5){
      _capColor='#059669'; _capStatusAr='✓ مطابقة +'+_capDeltaRnd.toFixed(1)+'%'; _capStatusEn='✓ Match +'+_capDeltaRnd.toFixed(1)+'%';
    } else if(_capDelta<=25){
      _capColor='#4f46e5'; _capStatusAr='سعة زائدة +'+_capDeltaRnd.toFixed(1)+'%'; _capStatusEn='Slight Oversize +'+_capDeltaRnd.toFixed(1)+'%';
    } else {
      _capColor='#6b7280'; _capStatusAr='سعة عالية +'+_capDeltaRnd.toFixed(1)+'%'; _capStatusEn='High Oversize +'+_capDeltaRnd.toFixed(1)+'%';
    }
    // Airflow (CFM) status — separate comparison
    var _cfmDeltaPdf = _p2UnitCFM>0 && _p2RequiredCFM>0 ? ((_p2UnitCFM-_p2RequiredCFM)/_p2RequiredCFM*100) : 0;
    var _cfmStatusAr, _cfmStatusEn, _cfmStatusColor;
    if(_p2UnitCFM <= 0){ _cfmStatusAr='—'; _cfmStatusEn='—'; _cfmStatusColor='#64748b'; }
    else if(_cfmDeltaPdf < -10){ _cfmStatusAr='⚠ تنبيه تدفق الهواء '+_cfmDeltaPdf.toFixed(1)+'%'; _cfmStatusEn='⚠ Airflow Warning '+_cfmDeltaPdf.toFixed(1)+'%'; _cfmStatusColor='#dc2626'; }
    else if(_cfmDeltaPdf > 25){ _cfmStatusAr='تدفق زائد +'+_cfmDeltaPdf.toFixed(1)+'%'; _cfmStatusEn='Excess Airflow +'+_cfmDeltaPdf.toFixed(1)+'%'; _cfmStatusColor='#d97706'; }
    else { _cfmStatusAr='✅ تدفق مناسب'; _cfmStatusEn='✅ Airflow OK'; _cfmStatusColor='#166534'; }

    // Duct calculations
    var supD=calcDuctSize(_p2Cfm>0?_p2Cfm:1,vSup);
    var retD=calcDuctSize(_p2Cfm>0?_p2Cfm:1,vRet); // Return uses same Q_design with own velocity
    var sd=supD?supD.std||supD.calc:null, rd=retD?retD.std||retD.calc:null;
    var _p2SupRt = getDuctVelocityRating(vSup,'supply',false);
    var _p2RetRt = getDuctVelocityRating(vRet,'return',false);
    var _p2Rec = ductRecommendation(_p2SupRt,_p2RetRt,c.isAr);
    var _p2WorstHigh = (_p2SupRt&&(_p2SupRt.r==='High'||_p2SupRt.r==='Critical'))||(_p2RetRt&&(_p2RetRt.r==='High'||_p2RetRt.r==='Critical'));
    var _utLbl = c.utLbls[curUT]||curUT;
    var _sysName = c.isAr?('وحدة '+_utLbl):((_utLbl)+' Unit');

    extra +=
      // ── Design Basis Summary box ──────────────────────────────────────
      '<div style="border:1px solid #bfdbfe;border-radius:8px;padding:14px;margin-bottom:10px;background:#eff6ff;page-break-inside:avoid">'+
        '<div style="font-size:12px;font-weight:700;color:#1e40af;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #bfdbfe;display:flex;align-items:center;gap:6px">'+
          '📐 '+(c.isAr?'أساس التصميم — Design Basis':'Design Basis')+'</div>'+
        '<div style="display:grid;grid-template-columns:repeat(6,1fr);gap:8px">'+
          '<div style="background:#fff;border:1px solid #dbeafe;border-radius:6px;padding:8px;text-align:center">'+
            '<div style="font-size:9px;color:#64748b;margin-bottom:3px">'+(c.isAr?'إجمالي CFM المطلوب':'Total CFM (Req.)')+'</div>'+
            '<div style="font-size:14px;font-weight:700;color:#0ea5e9;font-family:monospace">'+(totalCfm>0?Math.round(totalCfm).toLocaleString():'—')+'</div>'+
            '<div style="font-size:9px;color:#94a3b8">CFM</div>'+
          '</div>'+
          '<div style="background:#fff;border:1px solid #dbeafe;border-radius:6px;padding:8px;text-align:center">'+
            '<div style="font-size:9px;color:#64748b;margin-bottom:3px">'+(c.isAr?'إجمالي TR':'Total TR')+'</div>'+
            '<div style="font-size:14px;font-weight:700;color:#0ea5e9;font-family:monospace">'+totalTr2.toFixed(2)+'</div>'+
            '<div style="font-size:9px;color:#94a3b8">TR</div>'+
          '</div>'+
          '<div style="background:#fff;border:1px solid #dbeafe;border-radius:6px;padding:8px;text-align:center">'+
            '<div style="font-size:9px;color:#64748b;margin-bottom:3px">CFM/TR</div>'+
            '<div style="font-size:14px;font-weight:700;color:#0ea5e9;font-family:monospace">'+_p2CfmPerTr+'</div>'+
            '<div style="font-size:9px;color:#94a3b8">fpm/TR</div>'+
          '</div>'+
          '<div style="background:#fff;border:1px solid #dbeafe;border-radius:6px;padding:8px;text-align:center">'+
            '<div style="font-size:9px;color:#64748b;margin-bottom:3px">'+(c.isAr?'أساس التصميم':'Sizing Basis')+'</div>'+
            '<div style="font-size:10px;font-weight:700;color:#1d4ed8;margin-top:2px">'+_p2BasisLbl+'</div>'+
          '</div>'+
          '<div style="background:#fff;border:1px solid #dbeafe;border-radius:6px;padding:8px;text-align:center">'+
            '<div style="font-size:9px;color:#64748b;margin-bottom:3px">'+(c.isAr?'حالة BTU':'BTU Status')+'</div>'+
            '<div style="font-size:10px;font-weight:700;color:'+_capColor+';margin-top:2px">'+(c.isAr?_capStatusAr:_capStatusEn)+'</div>'+
          '</div>'+
          '<div style="background:#fff;border:1px solid #dbeafe;border-radius:6px;padding:8px;text-align:center">'+
            '<div style="font-size:9px;color:#64748b;margin-bottom:3px">'+(c.isAr?'حالة تدفق الهواء':'Airflow Status')+'</div>'+
            '<div style="font-size:10px;font-weight:700;color:'+_cfmStatusColor+';margin-top:2px">'+(c.isAr?_cfmStatusAr:_cfmStatusEn)+'</div>'+
          '</div>'+
        '</div>'+
      '</div>'+

      // ── Main Duct Sizing Summary Table (path-based: Supply / Return / Fresh) ───
      '<div style="border:1px solid #bbf7d0;border-radius:8px;padding:14px;margin-bottom:12px;background:#f0fdf4;page-break-inside:avoid">'+
        '<div style="font-size:12px;font-weight:700;color:#166534;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #bbf7d0;display:flex;align-items:center;gap:6px">'+
          '🌬 '+(c.isAr?'جدول تصميم مجاري الهواء (إمداد / رجوع / طازج)':'Duct Sizing Table — Supply / Return / Fresh Air')+'</div>'+
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:0">'+
          '<thead><tr style="background:#dcfce7">'+
            '<th style="padding:6px 8px;border:1px solid #86efac;text-align:'+(c.isAr?'right':'left')+';color:#166534">'+(c.isAr?'المجرى':'Duct Path')+'</th>'+
            '<th style="padding:6px 8px;border:1px solid #86efac;text-align:center;color:#166534">Q (CFM)</th>'+
            '<th style="padding:6px 8px;border:1px solid #86efac;text-align:center;color:#166534">m³/s</th>'+
            '<th style="padding:6px 8px;border:1px solid #86efac;text-align:center;color:#166534">'+(c.isAr?'هدف FPM':'Target FPM')+'</th>'+
            '<th style="padding:6px 8px;border:1px solid #86efac;text-align:center;color:#166534">'+(c.isAr?'مساحة مطلوبة mm²':'Req. Area mm²')+'</th>'+
            '<th style="padding:6px 8px;border:1px solid #86efac;text-align:center;color:#166534">'+(c.isAr?'الحجم المختار':'Selected Size')+'</th>'+
            '<th style="padding:6px 8px;border:1px solid #86efac;text-align:center;color:#166534">'+(c.isAr?'FPM فعلي':'Act. FPM')+'</th>'+
            '<th style="padding:6px 8px;border:1px solid #86efac;text-align:center;color:#166534">'+(c.isAr?'التقييم':'Rating')+'</th>'+
          '</tr></thead>'+
          '<tbody>'+
          (function(){
            var _retCfmP=Math.round(_p2Cfm*0.9);
            var _actSupFpm=sd&&sd.actualFpm?sd.actualFpm:(sd?Math.round(_p2Cfm/(sd.w*sd.h/92903.04)):vSup);
            var _actRetFpm=rd&&rd.actualFpm?rd.actualFpm:(rd?Math.round(_retCfmP/(rd.w*rd.h/92903.04)):vRet);
            var _supActClr=Math.abs(_actSupFpm-vSup)>vSup*0.1?'#f59e0b':'#059669';
            var _retActClr=Math.abs(_actRetFpm-vRet)>vRet*0.1?'#f59e0b':'#059669';
            var _supRtP=getDuctVelocityRating(vSup,'supply',false);
            var _retRtP=getDuctVelocityRating(vRet,'return',false);
            // Fresh air — sum OA from all HC rooms
            var _totalOaCfm=0;
            for(var _hci2=0;_hci2<hist.length;_hci2++){ if(hist[_hci2].oa) _totalOaCfm+=parseInt(hist[_hci2].oa)||0; }
            var _faRowP='';
            if(_totalOaCfm>0){
              var _faVelP=600;
              var _faDsP=calcDuctSize(_totalOaCfm,_faVelP);
              var _faStdP=_faDsP?(_faDsP.std||_faDsP.calc):null;
              var _faRtP=getDuctVelocityRating(_faVelP,'supply',true);
              _faRowP='<tr style="background:#f0f9ff">'+
                '<td style="padding:6px 8px;border:1px solid #86efac;font-weight:600;color:#0369a1">'+(c.isAr?'هواء خارجي (إجمالي OA CFM)':'Outdoor Air (Total OA CFM)')+'</td>'+
                '<td style="padding:6px 8px;border:1px solid #86efac;text-align:center;font-family:monospace">'+_totalOaCfm.toLocaleString()+'</td>'+
                '<td style="padding:6px 8px;border:1px solid #86efac;text-align:center;font-family:monospace">'+(_totalOaCfm*0.000471947).toFixed(3)+'</td>'+
                '<td style="padding:6px 8px;border:1px solid #86efac;text-align:center;font-family:monospace">'+_faVelP+'</td>'+
                '<td style="padding:6px 8px;border:1px solid #86efac;text-align:center;font-family:monospace;font-size:9px">'+(_faStdP?Number(_faStdP.area_required||0).toLocaleString():'—')+'</td>'+
                '<td style="padding:6px 8px;border:1px solid #86efac;text-align:center;font-weight:700;color:#0369a1">'+(_faStdP?_faStdP.w+'×'+_faStdP.h+' mm':'—')+'</td>'+
                '<td style="padding:6px 8px;border:1px solid #86efac;text-align:center;font-family:monospace">'+_faVelP+'</td>'+
                '<td style="padding:6px 8px;border:1px solid #86efac;text-align:center">'+ratingBadge(_faRtP,c.isAr)+'</td>'+
              '</tr>';
            }
            return '<tr>'+
              '<td style="padding:7px 8px;border:1px solid #bbf7d0;font-weight:600;color:#059669">'+(c.isAr?'إمداد':'Supply')+'<div style="font-size:9px;font-weight:400;color:#64748b">'+_p2BasisLbl+'</div></td>'+
              '<td style="padding:7px 8px;border:1px solid #bbf7d0;text-align:center;font-family:monospace">'+(_p2Cfm>0?Math.round(_p2Cfm).toLocaleString():'—')+'</td>'+
              '<td style="padding:7px 8px;border:1px solid #bbf7d0;text-align:center;font-family:monospace">'+(_p2Cfm>0?(_p2Cfm*0.000471947).toFixed(3):'—')+'</td>'+
              '<td style="padding:7px 8px;border:1px solid #bbf7d0;text-align:center;font-family:monospace">'+vSup+'</td>'+
              '<td style="padding:7px 8px;border:1px solid #bbf7d0;text-align:center;font-family:monospace;font-size:9px">'+(_p2Cfm>0&&sd?Number(sd.area_required||0).toLocaleString():'—')+'</td>'+
              '<td style="padding:7px 8px;border:1px solid #bbf7d0;text-align:center;font-weight:700;color:#059669">'+(sd?sd.w+'×'+sd.h+' mm':'—')+'</td>'+
              '<td style="padding:7px 8px;border:1px solid #bbf7d0;text-align:center;font-family:monospace;color:'+_supActClr+'">'+_actSupFpm+'</td>'+
              '<td style="padding:7px 8px;border:1px solid #bbf7d0;text-align:center">'+ratingBadge(_supRtP,c.isAr)+'</td>'+
            '</tr>'+
            '<tr>'+
              '<td style="padding:7px 8px;border:1px solid #bbf7d0;font-weight:600;color:#0284c7">'+(c.isAr?'رجوع (90%)':'Return (90%)')+'</td>'+
              '<td style="padding:7px 8px;border:1px solid #bbf7d0;text-align:center;font-family:monospace">'+(_p2Cfm>0?_retCfmP.toLocaleString():'—')+'</td>'+
              '<td style="padding:7px 8px;border:1px solid #bbf7d0;text-align:center;font-family:monospace">'+(_p2Cfm>0?(_retCfmP*0.000471947).toFixed(3):'—')+'</td>'+
              '<td style="padding:7px 8px;border:1px solid #bbf7d0;text-align:center;font-family:monospace">'+vRet+'</td>'+
              '<td style="padding:7px 8px;border:1px solid #bbf7d0;text-align:center;font-family:monospace;font-size:9px">'+(_p2Cfm>0&&rd?Number(rd.area_required||0).toLocaleString():'—')+'</td>'+
              '<td style="padding:7px 8px;border:1px solid #bbf7d0;text-align:center;font-weight:700;color:#059669">'+(rd?rd.w+'×'+rd.h+' mm':'—')+'</td>'+
              '<td style="padding:7px 8px;border:1px solid #bbf7d0;text-align:center;font-family:monospace;color:'+_retActClr+'">'+_actRetFpm+'</td>'+
              '<td style="padding:7px 8px;border:1px solid #bbf7d0;text-align:center">'+ratingBadge(_retRtP,c.isAr)+'</td>'+
            '</tr>'+
            _faRowP;
          })()+
          '</tbody>'+
        '</table></div>'+
        '<div style="margin-top:8px;padding:7px 10px;border-radius:6px;background:'+(_p2WorstHigh?'#fef3c7':'#f0fdf4')+';border:1px solid '+(_p2WorstHigh?'#fcd34d':'#bbf7d0')+';font-size:10px;color:#374151">'+
          _p2Rec+
        '</div>'+
        // ESP summary if available
        (function(){
          var _esp = window._lastEspCalc;
          if(!_esp) return '';
          var rows = [
            {lbl:c.isAr?'فقد الاحتكاك المستقيم':'Straight Friction', val:_esp.straightFrictionPa},
            {lbl:c.isAr?'فقد الانحناءات':'Bend Loss', val:_esp.bendLossPa},
            {lbl:c.isAr?'فقد الفلتر':'Filter Loss', val:_esp.filterLossPa},
            {lbl:c.isAr?'فقد مخارج الهواء / الجريلات':'Diffuser / Grille Loss', val:_esp.diffuserLossPa},
            {lbl:c.isAr?'فقد الكويل':'Coil Loss', val:_esp.coilLossPa},
            {lbl:c.isAr?'فقد الدامبر':'Damper Loss', val:_esp.damperLossPa},
            {lbl:c.isAr?'بدل إضافي':'Other Allowance', val:_esp.otherLossPa},
            {lbl:c.isAr?'ESP الكلي':'Total ESP', val:_esp.totalPa, emph:true}
          ];
          return '<div style="margin-top:8px;border:1px solid #fde68a;border-radius:8px;padding:12px;background:#fffbeb;page-break-inside:avoid">'+
            '<div style="font-size:12px;font-weight:700;color:#92400e;margin-bottom:8px">⚡ '+(c.isAr?'تقدير أولي للضغط الساكن':'Preliminary ESP Estimate')+'</div>'+
            '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">'+
              '<span style="padding:4px 10px;border-radius:999px;border:1px solid #fcd34d;background:#fff7ed;color:#92400e;font-size:10px;font-weight:700">'+(_esp.status.icon||'')+' '+(c.isAr?_esp.status.ar:_esp.status.en)+'</span>'+
              '<span style="padding:4px 10px;border-radius:999px;border:1px solid #e5e7eb;background:#fff;color:#111827;font-size:10px;font-weight:700">'+Number(_esp.totalPa).toLocaleString()+' Pa</span>'+
              '<span style="padding:4px 10px;border-radius:999px;border:1px solid #e5e7eb;background:#fff;color:#111827;font-size:10px;font-weight:700">'+Number(_esp.totalInwg).toFixed(2)+' in.w.g.</span>'+
            '</div>'+
            '<table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:8px"><tbody>'+
              rows.map(function(r){
                return '<tr'+(r.emph?' style="background:#fff7ed;font-weight:700"':'')+'>'+
                  '<td style="padding:6px 8px;border:1px solid #fde68a;text-align:'+(c.isAr?'right':'left')+'">'+r.lbl+'</td>'+
                  '<td style="padding:6px 8px;border:1px solid #fde68a;text-align:center;font-family:monospace">'+Number(r.val).toLocaleString()+' Pa</td>'+
                '</tr>';
              }).join('')+
            '</tbody></table>'+
            '<div style="font-size:9px;color:#92400e;line-height:1.7">'+(c.isAr
              ?'تقدير أولي للضغط الساكن — يجب التحقق من كتالوج الوحدة ومخطط الدكت قبل الاعتماد.'
              :'Preliminary ESP estimate — verify against unit catalog and duct layout before final design.')+'</div>'+
            '<div style="font-size:9px;color:#a16207;line-height:1.7;margin-top:3px">'+(c.isAr
              ?'بيانات ESP من كتالوج المصنع غير متوفرة — تحقق من بيانات الشركة المصنعة.'
              :'Catalog ESP data is not available — verify manufacturer data.')+'</div>'+
          '</div>';
        })()+
      '</div>';
  }
  // ══ BOTH MODES: Air Distribution by Room table ════════════════════════
  if((quoteMode==='proj'||bundleOn) && hist.length>0){
    var totalCfm2=getProjTotalCfm();
    var rows2='';
    for(var i=0;i<hist.length;i++){
      var h2=hist[i]; var rCfm=parseInt(h2.cfm)||0;
      var pct=totalCfm2>0?((rCfm/totalCfm2)*100).toFixed(1):0;
      var allocCfm=totalCfm2>0&&_p2Cfm>0?Math.round(_p2Cfm*(rCfm/totalCfm2)):0;
      var nm=c.isAr?(h2.ar||h2.en):(h2.en||h2.ar);
      var rCfmPct = totalCfm2>0?((rCfm/totalCfm2)*100).toFixed(0):0;
      rows2+='<tr>'+
        '<td style="text-align:center;color:#64748b">'+(i+1)+'</td>'+
        '<td style="text-align:'+(c.isAr?'right':'left')+';font-weight:600">'+nm+'</td>'+
        '<td style="text-align:center;font-family:monospace">'+rCfm.toLocaleString()+'</td>'+
        '<td style="text-align:center">'+
          '<div style="background:#e0f2fe;border-radius:3px;height:8px;width:100%;max-width:60px;display:inline-block;vertical-align:middle;margin:'+(c.isAr?'0 4px 0 0':'0 0 0 4px')+'">'+
            '<div style="background:#0284c7;height:8px;border-radius:3px;width:'+Math.min(100,rCfmPct)+'%"></div>'+
          '</div>'+
          '<span style="font-size:9px;font-family:monospace">'+pct+'%</span>'+
        '</td>'+
        '<td style="text-align:center;font-weight:600;color:#059669;font-family:monospace">'+allocCfm.toLocaleString()+'</td>'+
      '</tr>';
    }
    extra+='<div style="border:1px solid #dbeafe;border-radius:8px;padding:14px;margin-bottom:12px;background:#eff6ff;page-break-inside:avoid">'+
      '<div style="font-size:12px;font-weight:700;color:#1e40af;margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid #bfdbfe">'+
        '📊 '+(c.isAr?'توزيع تدفق الهواء على الغرف':'Air Distribution by Room')+'</div>'+
      '<table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:0"><thead>'+
        '<tr style="background:#dbeafe">'+
          '<th style="padding:6px;border:1px solid #93c5fd;text-align:center;color:#1d4ed8">#</th>'+
          '<th style="padding:6px;border:1px solid #93c5fd;text-align:'+(c.isAr?'right':'left')+';color:#1d4ed8">'+(c.isAr?'الغرفة':'Room')+'</th>'+
          '<th style="padding:6px;border:1px solid #93c5fd;text-align:center;color:#1d4ed8">'+(c.isAr?'CFM الغرفة':'Room CFM')+'</th>'+
          '<th style="padding:6px;border:1px solid #93c5fd;text-align:center;color:#1d4ed8">'+(c.isAr?'النسبة %':'Share %')+'</th>'+
          '<th style="padding:6px;border:1px solid #93c5fd;text-align:center;color:#1d4ed8">'+(c.isAr?'CFM المخصص':'Allocated CFM')+'</th>'+
        '</tr></thead>'+
        '<tbody>'+rows2+'</tbody>'+
      '</table>'+
      '<div style="font-size:9px;color:#6b7280;margin-top:6px;font-style:italic">'+(c.isAr?'التوزيع تناسبي بناءً على CFM كل غرفة. / CFM المخصص = Q_duct × نسبة الغرفة.':'Distribution is proportional to each room CFM. Allocated CFM = Q_duct × room share.')+'</div>'+
    '</div>';
  }
  if(!extra) return base;
  // Insert before last closing </div> of pdf-page2
  return base.replace(/<\/div>\s*$/, extra+'</div>');
};

// ══════════════════════════════════════════════════════════════════
// F) PATCH applyLang to also update project labels
// ══════════════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════
// G) INIT: populate proj system type dropdown on first load
// ══════════════════════════════════════════════════════════════════
function initProjDropdowns(){
  var sysTypeSel=G('proj-systype');
  if(sysTypeSel && !sysTypeSel.options.length){
    ['split','floor','ducted','cassette','package','vrf','chiller_air','chiller_water','fcu','ahu','window'].forEach(function(k){
      var opt=document.createElement('option');
      opt.value=k; opt.textContent=utLabel(k);
      if(k===projState.sysType) opt.selected=true;
      sysTypeSel.appendChild(opt);
    });
  }
}


// ══════════════════════════════════════════════════════════════════
// H) PROJECTS MODULE — integration patches
// ══════════════════════════════════════════════════════════════════

// H1) applyLang: update Projects panel labels and re-render if visible

// H2) Optional auto-refresh for currently open project only
(function(){
  var _shOrig = saveHist;
  saveHist = function(vol,ppl,tr,cfm,totalBtu,mkt,devBtu,hcdata){
    _shOrig(vol,ppl,tr,cfm,totalBtu,mkt,devBtu,hcdata);
    if (window.AppProjects && AppStorage.restoreCurrentProjectId()) {
      setTimeout(function(){
        window.AppProjects.saveCurrentProject({ silentNavigate: true });
      }, 100);
    }
  };
})();

// H3) goPanel patch — render projects list when switching to projects tab
(function(){
  var _gpOrig = goPanel;
  goPanel = function(name){
    _gpOrig(name);
    if(name==='projects' && window.AppProjects){
      window.AppProjects.updateProjMgrLabels();
      window.AppProjects.renderProjects();
    }
  };
})();

// H4) Add "Save as New Project" button behaviour via Quotation save button
// When user clicks save from projects panel it calls saveCurrentProject()
// which is already wired. No extra patch needed.


// ══════════════════════════════════════════════════════════════════
// I) FREE vs PRO PLAN SYSTEM
// ══════════════════════════════════════════════════════════════════

// ── I1) Gate exportPDF ────────────────────────────────────────────
(function(){
  var _origExportPDF = exportPDF;
  exportPDF = function(){
    if (!window.AppPlan || !window.AppPlan.requireFeature('exportPDF')) return;
    _origExportPDF();
  };
  window.exportPDF = exportPDF;
})();

// ── I2) Gate exportTechPDF ────────────────────────────────────────
(function(){
  var _origExportTechPDF = exportTechPDF;
  exportTechPDF = function(){
    if (!window.AppPlan || !window.AppPlan.requireFeature('techReport')) return;
    _origExportTechPDF();
  };
  window.exportTechPDF = exportTechPDF;
})();

// ── I3) Gate setQuoteMode — block 'proj' on free plan ────────────
(function(){
  var _origSetQuoteMode = setQuoteMode;
  setQuoteMode = function(mode){
    if (mode === 'proj' && window.AppPlan && !window.AppPlan.hasAccess('projectMode')) {
      window.AppPlan.requireFeature('projectMode');
      return;
    }
    _origSetQuoteMode(mode);
  };
  window.setQuoteMode = setQuoteMode;
})();

// ── I4) updatePlanUI — sync all UI to current plan ────────────────
function updatePlanUI(){
  var earlyAccess = window.AppPlan && window.AppPlan.isEarlyAccess ? window.AppPlan.isEarlyAccess() : true;
  var isPro = window.AppPlan ? window.AppPlan.isPro() : false;
  var featuresOpen = earlyAccess || isPro;
  var isAr  = lang === 'ar';
  var earlyAccessText = isAr ? 'نسخة تجريبية مجانية' : 'Free Trial Version';
  var freeEarlyText = isAr ? 'مجاني / نسخة تجريبية مجانية' : 'Free / Trial Version';

  // Header badge
  var badge = G('header-plan-badge');
  if (badge) {
    badge.textContent = earlyAccess ? earlyAccessText : (isPro ? 'PRO' : (isAr ? 'مجاني' : 'FREE'));
    badge.className = earlyAccess ? 'early-badge' : (isPro ? 'pro-badge' : 'free-badge');
  }

  // Settings status pill
  var pill = G('plan-status-pill');
  if (pill) {
    pill.textContent = earlyAccess ? freeEarlyText : (isPro ? 'Pro ⭐' : (isAr ? 'مجاني' : 'Free'));
    pill.className = 'plan-status-pill ' + (earlyAccess ? 'early' : (isPro ? 'pro' : 'free'));
  }

  // Settings upgrade row label
  var upgLbl = G('sl-upgrade-lbl');
  if (upgLbl) upgLbl.textContent = isAr ? 'نسخة تجريبية مجانية' : 'Free Trial Version';

  var upgSub = G('sl-upgrade-sub');
  if (upgSub) upgSub.textContent = isAr
    ? 'ميزات Pro مجانية خلال الفترة التجريبية.'
    : 'Pro features are free during the trial period.';

  // PDF button locked state
  var btnPdf  = G('btn-pdf');
  var btnTech = G('btn-techpdf');
  var btnTechPanel = G('btn-techpdf-panel');
  if (btnPdf)  { btnPdf.classList.toggle('btn-locked',  !featuresOpen); }
  if (btnTech) { btnTech.classList.toggle('btn-locked', !featuresOpen); }
  if (btnTechPanel) { btnTechPanel.classList.toggle('btn-locked', !featuresOpen); }

  // Project mode button locked state
  var btnProj = G('mode-btn-proj');
  if (btnProj) { btnProj.classList.toggle('btn-locked', !featuresOpen); }

  // Duct and ESP blocks — lock overlay when free
  var ductBlock = G('proj-duct-block');
  if (ductBlock) { ductBlock.classList.toggle('section-locked', !featuresOpen); }
  var espBlock  = G('esp-block');
  if (espBlock)  { espBlock.classList.toggle('section-locked',  !featuresOpen); }

  // ── Plan Status test card ────────────────────────────────────────
  // Live badge in header of test card
  var liveBadge = G('ptg-live-badge');
  if (liveBadge) {
    liveBadge.textContent = freeEarlyText;
    liveBadge.className = 'plan-status-pill early';
  }

  // Title & sub
  var ptgTitle = G('ptg-title');
  if (ptgTitle) ptgTitle.textContent = isAr ? 'نسخة تجريبية مجانية' : 'Free Trial Version';
  var ptgSub = G('ptg-sub');
  if (ptgSub) ptgSub.textContent = isAr ? 'ميزات Pro مجانية خلال الفترة التجريبية.' : 'Pro features are free during the trial period.';
  if (G('ea-monthly-name')) G('ea-monthly-name').textContent = isAr ? 'شهري' : 'Monthly';
  if (G('ea-monthly-price')) G('ea-monthly-price').textContent = isAr ? '19 ر.س / شهر' : '19 SAR / month';
  if (G('ea-yearly-name')) G('ea-yearly-name').textContent = isAr ? 'سنوي' : 'Yearly';
  if (G('ea-yearly-price')) G('ea-yearly-price').textContent = isAr ? '149 ر.س / سنة' : '149 SAR / year';
  if (G('ea-soon-monthly')) G('ea-soon-monthly').textContent = isAr ? 'قريبًا' : 'Coming Soon';
  if (G('ea-soon-yearly')) G('ea-soon-yearly').textContent = isAr ? 'قريبًا' : 'Coming Soon';

  // Active plan description
  var descEl = G('ptg-desc');
  if (descEl) {
    descEl.innerHTML =
      '<span style="color:var(--a);font-weight:700;">' +
      (isAr ? 'الحالة الحالية: ' : 'Current status: ') +
      '</span>' + freeEarlyText +
      ' &nbsp;·&nbsp; <span style="color:var(--g);">' +
      (isAr ? 'ميزات Pro مجانية خلال الفترة التجريبية.' : 'Pro features are free during the trial period.') +
      '</span><br><span style="color:var(--am);">' +
      (isAr ? 'الخطط المدفوعة قادمة قريبًا.' : 'Paid plans are coming soon.') +
      '</span>';
  }

  // Feature access summary grid
  var featEl = G('ptg-features');
  if (featEl) {
    var features = [
      { key:'exportCSV',         ar:'تصدير CSV',           en:'CSV export' },
      { key:'exportPDF',         ar:'تصدير PDF',           en:'PDF export' },
      { key:'techReport',        ar:'التقرير الفني',        en:'Tech Report' },
      { key:'projectMode',       ar:'وضع المشروع',          en:'Project mode' },
      { key:'ductSizing',        ar:'تصميم المجاري',        en:'Duct sizing' },
      { key:'espCalc',           ar:'حساب ESP',             en:'ESP calc' },
      { key:'unlimitedProjects', ar:'مشاريع غير محدودة',    en:'Unlimited projects' }
    ];
    var fa = {};
    features.forEach(function(f){ fa[f.key] = true; });
    featEl.innerHTML = features.map(function(f){
      var ok = fa[f.key] === true;
      return '<div class="ptg-feat ' + (ok?'ok':'no') + '">' +
        (ok ? '✅' : '❌') + ' ' +
        (isAr ? f.ar : f.en) +
      '</div>';
    }).join('');
  }

  // Bundle row — only relevant for Pro (project mode)
  // no need to hide, setQuoteMode guards it
}

// ── I5) Upgrade sheet controls ────────────────────────────────────
var _selectedPricePlan = 'lifetime';

function openUpgradeSheet(){
  var overlay = G('upgrade-overlay');
  if (overlay) overlay.classList.remove('hidden');
  _syncUpgradeSheetLang();
}

function closeUpgradeSheet(e){
  if (e && e.target !== G('upgrade-overlay')) return;
  var overlay = G('upgrade-overlay');
  if (overlay) overlay.classList.add('hidden');
}

function selectPricePill(planKey){
  _selectedPricePlan = planKey;
}

function upgradeToPro(){
  toast(lang==='ar' ? 'الخطط المدفوعة قادمة قريبًا.' : 'Paid plans are coming soon.');
}

function _syncUpgradeSheetLang(){
  var isAr = lang === 'ar';
  function sl(id, ar, en){ var el=G(id); if(el) el.textContent = isAr?ar:en; }
  sl('ush-title-accent','نسخة تجريبية مجانية',                           'Free Trial');
  sl('ush-sub',         'ميزات Pro مجانية خلال الفترة التجريبية.',        'Pro features are free during the trial period.');
  sl('pc-free-name',    'مجاني',                                          'Free');
  sl('pc-pro-name',     'Pro ⭐',                                         'Pro ⭐');
  sl('pcf1','حساب TR / CFM / BTU',     'TR / CFM / BTU Calc');
  sl('pcf2','أحمال الأجهزة',           'Device loads');
  sl('pcf3','عرض سعر أساسي',           'Basic quotation');
  sl('pcf4','تصدير CSV',               'CSV export');
  sl('pcf5','حتى 3 مشاريع',            'Up to 3 projects');
  sl('pcf6','تصدير PDF',               'PDF export');
  sl('pcf7','التقرير الفني',            'Tech Report');
  sl('pcf8','Duct / ESP',              'Duct / ESP');
  sl('pcp1','كل مزايا المجاني',        'All Free features');
  sl('pcp2','تصدير PDF',               'PDF export');
  sl('pcp3','التقرير الفني',            'Tech Report');
  sl('pcp4','مشاريع غير محدودة',        'Unlimited projects');
  sl('pcp5','وضع وحدة للمشروع',        'Project unit mode');
  sl('pcp6','Duct Sizing',             'Duct Sizing');
  sl('pcp7','ESP Calculation',         'ESP Calculation');
  sl('pcp8','مزايا مستقبلية',           'Future Pro tools');
  sl('pp-yr-amt','149 ر.س',  '149 SAR');
  sl('pp-yr-per','سنوياً',    'Yearly');
  sl('pp-yr-badge','قريبًا', 'Coming Soon');
  sl('pp-mo-amt','19 ر.س',   '19 SAR');
  sl('pp-mo-per','شهرياً',    'Monthly');
  sl('pp-mo-badge','قريبًا', 'Coming Soon');
  sl('ush-cta',   'الخطط المدفوعة قادمة قريبًا', 'Paid plans are coming soon');
  sl('ush-later', 'متابعة',  'Continue');
  sl('ush-note',  'ميزات Pro مجانية خلال الفترة التجريبية.', 'Pro features are free during the trial period.');
  sl('sl-upgrade-lbl','نسخة تجريبية مجانية','Free Trial Version');
  sl('sl-upgrade-sub','ميزات Pro مجانية خلال الفترة التجريبية.','Pro features are free during the trial period.');
}

// ── I6) Patch applyLang to also update plan UI labels ─────────────


// ── I7) Init plan UI on first load ────────────────────────────────
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(function(){
    updatePlanUI();
  }, 200);
});


// ══════════════════════════════════════════════════════════════════
// J) CALCULATION MODE SYSTEM (Basic / Advanced)
// ══════════════════════════════════════════════════════════════════


var calcMode = (function(){
  try { return AppStorage.restoreCalcMode(); }
  catch(e) { return 'basic'; }
})();
// ── J1) setCalcMode ────────────────────────────────────────────────
function setCalcMode(mode) {
  if (mode === 'advanced') {
    // Gate: Pro only
    if (window.AppPlan && !window.AppPlan.requireFeature('advancedDuct')) {
      // requireFeature already showed the toast — do NOT activate
      return;
    }
  }
  calcMode = mode;
  try { AppStorage.saveCalcMode(mode); } catch(e){}

  // Update button states
  var btnB = G('calc-mode-btn-basic');
  var btnA = G('calc-mode-btn-advanced');
  if (btnB) btnB.classList.toggle('active', mode === 'basic');
  if (btnA) btnA.classList.toggle('active', mode === 'advanced');

  // Show/hide advanced block
  var advBlock = G('adv-duct-block');
  if (advBlock) advBlock.style.display = (mode === 'advanced') ? '' : 'none';

  // Re-render to populate/clear advanced fields
  if (mode === 'advanced') renderAdvancedDuct();
}

// ── J2) renderAdvancedDuct ─────────────────────────────────────────
// Runs ASHRAE Ch.21 analysis on current duct sizing results.
// Uses window._lastDuctSizing (set by renderProjBlock / renderQuote)
// instead of parsing rendered DOM text — robust and reliable.
function renderAdvancedDuct() {
  if (calcMode !== 'advanced') return;
  if (!window.AppDuct || !window.AppDuct.advancedDuctAnalysis) return;

  var cache = window._lastDuctSizing || null;

  // ── Resolve structured duct dimensions + CFM ──────────────────────
  var supW = 0, supH = 0, retW = 0, retH = 0;
  var supCfm = 0, retCfm = 0;

  if (cache) {
    supCfm = cache.supCfm || 0;
    retCfm = cache.retCfm || Math.round(supCfm * 0.9);
    if (cache.sup) { supW = cache.sup.w || 0; supH = cache.sup.h || 0; }
    if (cache.ret) { retW = cache.ret.w || 0; retH = cache.ret.h || 0; }
  }

  // Fallback: rebuild CFM from live state if cache empty
  if (supCfm <= 0) {
    if (quoteMode === 'proj') {
      var stSel = G('proj-systype');
      var utKey = stSel ? stSel.value : 'package';
      var selBtu = projState ? (projState.selBtu || 0) : 0;
      var qty    = projState ? (projState.qty || 1) : 1;
      var cfmPTr = parseInt((G('duct-cfm-per-tr') || {value:'400'}).value) || 400;
      var r = window.AppDuct.getProjDuctCfm(utKey, selBtu, qty, 0, cfmPTr);
      supCfm = r ? r.cfm : 0;
    } else {
      if (typeof hist !== 'undefined') hist.forEach(function(h){ supCfm += (h.cfm || 0); });
    }
    retCfm = Math.round(supCfm * 0.9);
  }

  // Fallback: derive dimensions from velocity if duct sizing not yet run
  if ((supW === 0 || supH === 0) && supCfm > 0) {
    var vSup = cache ? (cache.vSup || 1000) : (parseInt((G('duct-vel-sup')||{value:'1000'}).value)||1000);
    var aFt2 = supCfm / vSup;
    var side = Math.round(Math.sqrt(aFt2 * 92903.04) / 50) * 50;
    supW = supH = Math.max(150, side);
  }
  if ((retW === 0 || retH === 0) && retCfm > 0) {
    var vRet = cache ? (cache.vRet || 800) : (parseInt((G('duct-vel-ret')||{value:'800'}).value)||800);
    var aFt2r = retCfm / vRet;
    var sideR = Math.round(Math.sqrt(aFt2r * 92903.04) / 50) * 50;
    retW = retH = Math.max(150, sideR);
  }

  // ── ESP duct run lengths (from ESP inputs) ────────────────────────
  var L_sup_m = parseFloat((G('esp-len-sup') || {value:'30'}).value) || 30;
  var L_ret_m = parseFloat((G('esp-len-ret') || {value:'20'}).value) || 20;

  // ── Run ASHRAE Ch.21 analysis ─────────────────────────────────────
  // advancedDuctAnalysis(Q_cfm, W_mm, H_mm, L_m)
  // Formulas:  A=W×H/92903, Dh=4A/P (ASHRAE Eq.21-1),
  //            Pv=(V/4005)² in.w.g. (ASHRAE Eq.21-2),
  //            ΔPf=f×(L/Dh)×Pv Darcy-Weisbach f=0.02
  var supAna = (supW > 0 && supH > 0 && supCfm > 0)
    ? window.AppDuct.advancedDuctAnalysis(supCfm, supW, supH, L_sup_m)
    : null;
  var retAna = (retW > 0 && retH > 0 && retCfm > 0)
    ? window.AppDuct.advancedDuctAnalysis(retCfm, retW, retH, L_ret_m)
    : null;

  // ── Populate result fields ────────────────────────────────────────
  function setField(id, value) {
    var el = G(id);
    if (el) el.textContent = (value !== null && value !== undefined) ? value : '—';
  }
  function setRichField(id, main, sub) {
    var el = G(id);
    if (!el) return;
    if (!main) {
      el.textContent = '—';
      return;
    }
    el.innerHTML =
      '<div class="adv-field-main">' + main + '</div>' +
      (sub ? '<div class="adv-field-sub">' + sub + '</div>' : '');
  }
  function asRatioLabel(sec) {
    if (!sec) return '—';
    if (sec.ratio) return '1:' + sec.ratio;
    if (sec.w && sec.h) {
      var mx = Math.max(sec.w, sec.h), mn = Math.max(1, Math.min(sec.w, sec.h));
      return '1:' + (Math.round((mx / mn) * 10) / 10);
    }
    return '—';
  }
  function frictionState(ana) {
    if (!ana || ana.dP_per100ft_inwg === null || ana.dP_per100ft_inwg === undefined) return null;
    var v = ana.dP_per100ft_inwg;
    if (v <= 0.08) return { cls:'good', txtAr:'منخفض ومريح', txtEn:'Low and quiet' };
    if (v <= 0.12) return { cls:'ok', txtAr:'مقبول تصميمياً', txtEn:'Good for design' };
    if (v <= 0.18) return { cls:'warn', txtAr:'مرتفع نسبياً', txtEn:'Elevated friction' };
    return { cls:'bad', txtAr:'مرتفع جداً', txtEn:'High pressure drop' };
  }
  function statusClass(rt) {
    if (!rt || !rt.r) return 'ok';
    if (rt.r === 'Excellent' || rt.r === 'Acceptable') return 'good';
    if (rt.r === 'Low') return 'ok';
    if (rt.r === 'High') return 'warn';
    return 'bad';
  }
  function aspectState(sec) {
    if (!sec) return { cls:'ok', txtAr:'غير متاح', txtEn:'Not available' };
    var ratio = parseFloat(sec.ratio || 0);
    if (!ratio && sec.w && sec.h) ratio = Math.max(sec.w, sec.h) / Math.max(1, Math.min(sec.w, sec.h));
    if (!ratio) return { cls:'ok', txtAr:'غير متاح', txtEn:'Not available' };
    if (ratio <= 2.5) return { cls:'good', txtAr:'قريب من النسبة المفضلة', txtEn:'Near preferred ratio' };
    if (ratio <= 4) return { cls:'warn', txtAr:'مقبول لكن ممدود', txtEn:'Acceptable but stretched' };
    return { cls:'bad', txtAr:'نسبة غير مفضلة', txtEn:'Poor aspect ratio' };
  }
  function summaryCard(labelAr, labelEn, ana, sec, ductType) {
    if (!ana) return '';
    var isAr = lang === 'ar';
    var isHealthcare = false;
    var rt = window.AppDuct.getDuctVelocityRating
      ? window.AppDuct.getDuctVelocityRating(ana.V_fpm, ductType, isHealthcare)
      : null;
    var fr = frictionState(ana);
    var ar = aspectState(sec);
    var ratioLbl = asRatioLabel(sec);
    return '' +
      '<div class="adv-duct-summary-card">' +
        '<div class="adv-duct-summary-head">' +
          '<div class="adv-duct-summary-title">' + (isAr ? labelAr : labelEn) + '</div>' +
          '<div class="adv-duct-summary-badge adv-duct-summary-badge-' + statusClass(rt) + '">' +
            (rt ? ((rt.e || '') + ' ' + rt.r) : (isAr ? 'قيد التقييم' : 'Checking')) +
          '</div>' +
        '</div>' +
        '<div class="adv-duct-meta">' +
          '<span class="adv-duct-pill adv-duct-pill-' + statusClass(rt) + '">' +
            (isAr ? 'السرعة: ' : 'Velocity: ') + ana.V_fpm + ' fpm' +
          '</span>' +
          '<span class="adv-duct-pill adv-duct-pill-' + (fr ? fr.cls : 'ok') + '">' +
            (isAr ? 'الاحتكاك: ' : 'Friction: ') + (ana.dP_per100ft_inwg !== null ? ana.dP_per100ft_inwg + ' in.w.g./100ft' : '—') +
          '</span>' +
          '<span class="adv-duct-pill adv-duct-pill-' + ar.cls + '">' +
            (isAr ? 'النسبة: ' : 'Ratio: ') + ratioLbl +
          '</span>' +
        '</div>' +
        '<div class="adv-duct-summary-copy">' +
          '<div>' + (fr ? (isAr ? fr.txtAr : fr.txtEn) : '') + '</div>' +
          '<div>' + (isAr ? ar.txtAr : ar.txtEn) + '</div>' +
        '</div>' +
      '</div>';
  }

  if (supAna) {
    setRichField('adv-val-area-sup', supAna.A_m2 + ' m²', supAna.A_ft2 + ' ft²');
    setRichField('adv-val-vel-sup',  supAna.V_ms + ' m/s', supAna.V_fpm + ' fpm');
    setRichField('adv-val-dh-sup',   supAna.Dh_mm + ' mm', supAna.Dh_in + ' in');
    setRichField('adv-val-pv-sup',   supAna.Pv_pa + ' Pa', supAna.Pv_inwg + ' in.w.g.');
    setRichField(
      'adv-val-dp-sup',
      supAna.dP_pa !== null ? supAna.dP_pa + ' Pa run' : '—',
      supAna.dP_inwg !== null && supAna.dP_per100ft_inwg !== null
        ? supAna.dP_inwg + ' in.w.g. run  •  ' + supAna.dP_per100ft_inwg + ' in.w.g./100ft'
        : ''
    );
  } else {
    ['adv-val-area-sup','adv-val-vel-sup','adv-val-dh-sup','adv-val-pv-sup','adv-val-dp-sup']
      .forEach(function(id){ setField(id, '—'); });
  }

  if (retAna) {
    setRichField('adv-val-area-ret', retAna.A_m2 + ' m²', retAna.A_ft2 + ' ft²');
    setRichField('adv-val-vel-ret',  retAna.V_ms + ' m/s', retAna.V_fpm + ' fpm');
    setRichField('adv-val-dh-ret',   retAna.Dh_mm + ' mm', retAna.Dh_in + ' in');
    setRichField('adv-val-pv-ret',   retAna.Pv_pa + ' Pa', retAna.Pv_inwg + ' in.w.g.');
    setRichField(
      'adv-val-dp-ret',
      retAna.dP_pa !== null ? retAna.dP_pa + ' Pa run' : '—',
      retAna.dP_inwg !== null && retAna.dP_per100ft_inwg !== null
        ? retAna.dP_inwg + ' in.w.g. run  •  ' + retAna.dP_per100ft_inwg + ' in.w.g./100ft'
        : ''
    );
  } else {
    ['adv-val-area-ret','adv-val-vel-ret','adv-val-dh-ret','adv-val-pv-ret','adv-val-dp-ret']
      .forEach(function(id){ setField(id, '—'); });
  }

  var noteEl = G('adv-duct-note');
  if (noteEl) {
    var isAr = lang === 'ar';
    var supRt = supAna && window.AppDuct.getDuctVelocityRating
      ? window.AppDuct.getDuctVelocityRating(supAna.V_fpm, 'supply', false)
      : null;
    var retRt = retAna && window.AppDuct.getDuctVelocityRating
      ? window.AppDuct.getDuctVelocityRating(retAna.V_fpm, 'return', false)
      : null;
    var recTxt = window.AppDuct.ductRecommendation
      ? window.AppDuct.ductRecommendation(supRt, retRt, isAr)
      : (isAr ? 'تحقق من السرعات ومعدل الاحتكاك قبل الاعتماد النهائي.' : 'Verify velocity and friction before final approval.');
    noteEl.dataset.rich = '1';
    noteEl.innerHTML =
      '<div class="adv-duct-summary">' +
        '<div class="adv-duct-summary-intro">' +
          (isAr
            ? 'مراجعة أولية طبقاً لأسس ASHRAE Chapter 21 باستخدام السرعة الفعلية، معدل الاحتكاك، ونسبة أبعاد المجرى.'
            : 'Preliminary ASHRAE Chapter 21 review using actual velocity, friction rate, and duct aspect ratio.') +
        '</div>' +
        '<div class="adv-duct-summary-grid">' +
          summaryCard('الإمداد', 'Supply', supAna, cache ? cache.sup : null, 'supply') +
          summaryCard('الرجوع', 'Return', retAna, cache ? cache.ret : null, 'return') +
        '</div>' +
        '<div class="adv-duct-recommend">' + recTxt + '</div>' +
        '<div class="adv-duct-footnote">' +
          (isAr
            ? 'Darcy-Weisbach · f=0.02 · هواء قياسي ASHRAE عند 20°C · هذا فحص مبدئي وليس بديلاً عن التصميم النهائي أو نظام Equal Friction الكامل.'
            : 'Darcy-Weisbach · f=0.02 · ASHRAE standard air at 20°C · Preliminary check only, not a substitute for final equal-friction system design.') +
        '</div>' +
      '</div>';
  }

  _syncAdvDuctLabels();
}

// ── J3) Language sync for advanced block ──────────────────────────
function _syncAdvDuctLabels() {
  var isAr = lang === 'ar';
  function sl(id, ar, en){ var el=G(id); if(el) el.textContent = isAr?ar:en; }
  sl('calc-mode-lbl-basic',    'سريع',    'Basic');
  sl('calc-mode-lbl-advanced', 'متقدم',   'Advanced');
  sl('adv-duct-title',  'التحليل الهندسي المتقدم للمجاري', 'Advanced Duct Engineering Analysis');
  sl('adv-sup-label',   'مجرى الإمداد',  'Supply Duct');
  sl('adv-ret-label',   'مجرى الرجوع',   'Return Duct');
  sl('adv-lbl-area-sup',  'المساحة A',              'Area A');
  sl('adv-lbl-vel-sup',   'السرعة V',               'Velocity V');
  sl('adv-lbl-dh-sup',    'القطر الهيدروليكي Dh',    'Hydraulic Diam. Dh');
  sl('adv-lbl-pv-sup',    'ضغط السرعة Pv',           'Velocity Pressure Pv');
  sl('adv-lbl-dp-sup',    'فقد الاحتكاك المستقيم',   'Straight Friction Loss');
  sl('adv-lbl-area-ret',  'المساحة A',              'Area A');
  sl('adv-lbl-vel-ret',   'السرعة V',               'Velocity V');
  sl('adv-lbl-dh-ret',    'القطر الهيدروليكي Dh',    'Hydraulic Diam. Dh');
  sl('adv-lbl-pv-ret',    'ضغط السرعة Pv',           'Velocity Pressure Pv');
  sl('adv-lbl-dp-ret',    'فقد الاحتكاك المستقيم',   'Straight Friction Loss');
  var noteEl = G('adv-duct-note');
  if (noteEl && noteEl.dataset.rich !== '1') noteEl.textContent = isAr
    ? 'معادلة دارسي-وايسباخ · f = 0.02 (صاج مجلفن) · هواء قياسي ASHRAE 20°C · تصميم أولي'
    : 'Darcy-Weisbach · f = 0.02 (galvanised steel) · ASHRAE Standard Air 20°C · Preliminary sizing only';
}

// ── J4) applyLang patch removed: labels now sync via applyLangModuleSync() ─────────────
// ── J5) Patch renderProjBlock and renderQuote to refresh advanced ──
(function(){
  if (typeof renderProjBlock === 'function') {
    var _origRPB = renderProjBlock;
    renderProjBlock = function(){
      _origRPB.apply(this, arguments);
      if (calcMode === 'advanced') setTimeout(renderAdvancedDuct, 50);
    };
  }
})();

// ── J6) updatePlanUI: lock advanced mode button on free plan ──────
(function(){
  var _origUPUI = updatePlanUI;
  updatePlanUI = function(){
    _origUPUI();
    var advancedOpen = window.AppPlan ? window.AppPlan.hasAccess('advancedDuct') : true;
    var btnA = G('calc-mode-btn-advanced');
    if (btnA) {
      btnA.classList.toggle('btn-locked', !advancedOpen);
      // Force back to basic if now on free
      if (!advancedOpen && calcMode === 'advanced') {
        calcMode = 'basic';
        try { AppStorage.saveCalcMode('basic'); } catch(e){}
        var btnB = G('calc-mode-btn-basic');
        if (btnB) btnB.classList.add('active');
        btnA.classList.remove('active');
        var advBlock = G('adv-duct-block');
        if (advBlock) advBlock.style.display = 'none';
      }
    }
  };
})();

// ── J7) Init calc mode on page load ───────────────────────────────
document.addEventListener('DOMContentLoaded', function(){
  setTimeout(function(){
    setCalcMode(calcMode);   // restore saved state
  }, 250);
});

// ASHRAE-oriented duct sizing override:
// prefer balanced rectangular ducts near 2:1 and avoid excessive velocities.
var ASHRAE_RECT_TARGET_RATIO = 2.0;
var ASHRAE_RECT_MAX_RATIO = 4.0;
var ASHRAE_MAX_DUCT_FPM = 2500;

function _ductCandidateScore(ww, hh, areaMm2, actualFpm){
  var ratio = Math.max(ww,hh) / Math.min(ww,hh);
  var oversize = ((ww * hh) - areaMm2) / Math.max(areaMm2, 1);
  var ratioPenalty = Math.abs(ratio - ASHRAE_RECT_TARGET_RATIO);
  var velocityPenalty = actualFpm > ASHRAE_MAX_DUCT_FPM ? 1000 + (actualFpm - ASHRAE_MAX_DUCT_FPM) : 0;
  return velocityPenalty + (oversize * 10) + ratioPenalty;
}

function _makeDuctCandidate(ww, hh, areaMm2, cfm, velocityFpm, method){
  var aFt2 = (ww * hh) / 92903.04;
  var actualFpm = aFt2 > 0 ? Math.round(cfm / aFt2) : velocityFpm;
  return {
    w: ww,
    h: hh,
    area_required: Math.round(areaMm2),
    area_actual: ww * hh,
    ratio: (Math.max(ww,hh) / Math.min(ww,hh)).toFixed(2),
    method: method,
    actualFpm: actualFpm,
    score: _ductCandidateScore(ww, hh, areaMm2, actualFpm)
  };
}

function calcDuctSize(cfm, velocityFpm){
  if(!cfm || cfm <= 0) return null;
  var areaFt2 = cfm / velocityFpm;
  var areaMm2 = areaFt2 * 92903.04;
  var minSide = 150;
  var maxSide = 1800;
  var stdBest = null;
  var best = null;
  var heights = [150,200,250,300,350,400,450,500,600,700,800];

  for(var si=0; si<DUCT_STD.length; si++){
    var sw=DUCT_STD[si][0], sh=DUCT_STD[si][1];
    var stdRatio = Math.max(sw,sh) / Math.min(sw,sh);
    if(sw >= minSide && sh >= minSide && sw <= maxSide && sh <= maxSide &&
       stdRatio <= ASHRAE_RECT_MAX_RATIO && sw*sh >= areaMm2){
      var stdCand = _makeDuctCandidate(sw, sh, areaMm2, cfm, velocityFpm, 'std');
      if(!stdBest || stdCand.score < stdBest.score) stdBest = stdCand;
    }
  }

  for(var hi=0; hi<heights.length; hi++){
    var h = heights[hi];
    var wRaw = areaMm2 / h;
    var w = Math.ceil(wRaw / 50) * 50;
    if(w < minSide) w = minSide;
    var ratio = Math.max(w,h) / Math.min(w,h);
    if(w <= maxSide && ratio <= ASHRAE_RECT_MAX_RATIO){
      var calcCand = _makeDuctCandidate(w, h, areaMm2, cfm, velocityFpm, 'calc');
      if(!best || calcCand.score < best.score) best = calcCand;
    }
  }

  if(!best){
    var h2 = 800;
    var wRaw2 = areaMm2 / h2;
    var w2 = Math.max(minSide, Math.ceil(wRaw2 / 50) * 50);
    best = _makeDuctCandidate(w2, h2, areaMm2, cfm, velocityFpm, 'calc');
  }

  return {calc:best, std:stdBest || best};
}
