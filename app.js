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
  _DUCT_WIDTHS  = data.DUCT_WIDTHS  || _DUCT_WIDTHS;
  _DUCT_HEIGHTS = data.DUCT_HEIGHTS || _DUCT_HEIGHTS;
  // Rebuild DUCT_STD after widths/heights are loaded
  buildDuctStd();
}

function initApp(){
  // Restore state from localStorage
  try { hist = JSON.parse(localStorage.getItem('acp9h') || '[]'); } catch(e){ hist=[]; }
  try { qlines = JSON.parse(localStorage.getItem('acp9q') || '[]'); } catch(e){ qlines=[]; }
  while(qlines.length < hist.length){
    var lastUp=(qlines.length>0?qlines[qlines.length-1].up:0)||0;
    var lastUT=(qlines.length>0?qlines[qlines.length-1].unitType:'')||'split';
    var lastBtu=(qlines.length>0?qlines[qlines.length-1].selectedBtu:0)||0;
    qlines.push({qty:1,up:lastUp,unitType:lastUT,selectedBtu:lastBtu});
  }
  qlines = qlines.slice(0, hist.length);
  // Restore quote settings
  try{
    var _qs=JSON.parse(localStorage.getItem('acp9qs')||'{}');
    if(_qs.vatOn!==undefined) vatOn=_qs.vatOn;
    if(_qs.instPct) instPct=_qs.instPct;
    if(_qs.qsValidity) qsValidity=_qs.qsValidity;
    if(_qs.qsNotes!==undefined) qsNotes=_qs.qsNotes;
  }catch(e){}
  applyQSState();
  // Restore quoteMode
  try{ var _qm9=localStorage.getItem('acp9mode'); if(_qm9==='proj') quoteMode='proj'; }catch(e){}
  // Restore bundle config
  try{
    var _bc=localStorage.getItem('ac_bundleConfig');
    if(_bc){ var o=JSON.parse(_bc); Object.keys(o).forEach(function(k){ bundleConfig[k]=o[k]; }); }
  }catch(e){}
  // Restore theme
  try{ var _t9=localStorage.getItem('acp9theme'); if(_t9==='light') _theme='light'; }catch(e){}
  _applyTheme();
  // Initialize UI
  curRoom = ROOMS['r_office'] || Object.values(ROOMS)[0];
  applyLang();
  applyQSState();
  setQuoteMode(quoteMode);
  renderHist();
  initProjDropdowns();
  updateProjLabels();
  // Service Worker registration
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(function(e){ console.warn('SW reg failed:', e); });
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
  vatOn=G('vat-tog').classList.contains('on');
  instPct=parseInt(G('qs-inst').value)||10;
  qsValidity=parseInt(G('qs-validity').value)||14;
  qsNotes=G('qs-notes').value||'';
  try{ localStorage.setItem('acp9qs',JSON.stringify({vatOn:vatOn,instPct:instPct,qsValidity:qsValidity,qsNotes:qsNotes})); }catch(e){}
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
function toast(msg){ var t=G('toast'); t.textContent=msg; t.classList.add('on'); setTimeout(function(){t.classList.remove('on');},2600); }
function save(){ try{ localStorage.setItem('acp9h',JSON.stringify(hist)); localStorage.setItem('acp9q',JSON.stringify(qlines)); }catch(e){} }
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

function applyLang(){
  document.documentElement.lang = lang;
  document.documentElement.dir = lang==='ar'?'rtl':'ltr';
  G('langBtn').textContent = lang==='ar'?'EN':'ع';
  G('tog-lang').className = 'tog'+(lang==='ar'?' on':'');
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
    'qt-qty-lbl':'qtqty','qt-grand-lbl':'qtgrand',
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
    'qs-vatl':'qsvatl',
    'qt-qty-lbl':'qsqtyl',
    'qt-grand-lbl':'qtgrand'
  };
  for(var id in m){ var e=G(id); if(e) e.textContent=t(m[id]); }
  G('dis-ar').style.display = lang==='ar'?'':'none';
  G('dis-en').style.display = lang==='en'?'':'none';
  G('inp-vol').placeholder = lang==='ar'?'٠ م³':'0 m³';
  G('inp-ppl').placeholder = '0';
  G('quote-project').placeholder = lang==='ar'?'اسم المشروع':'Project Name';
  var v7=G('v7'),v14=G('v14'),v30=G('v30');
  if(v7) v7.textContent=t('v7');
  if(v14) v14.textContent=t('v14');
  if(v30) v30.textContent=t('v30');
  var qn=G('qs-notes'); if(qn) qn.placeholder=t('qsnph');
  var isl=G('qs-instl'); if(isl){
    var ip2=parseInt((G('qs-inst')||{value:'10'}).value)||10;
    isl.textContent=t('qsinstl')+' ('+ip2+'%)';
  }
  G('dt').textContent = rLabel(curRoom);
  renderDevs();
  renderHist();
}
function toggleLang(){ lang=lang==='ar'?'en':'ar'; applyLang(); }

var _theme = 'dark';
function toggleTheme(){
  _theme = _theme === 'dark' ? 'light' : 'dark';
  _applyTheme();
  try{ localStorage.setItem('acp9theme', _theme); }catch(e){}
}
function _applyTheme(){
  var btn = G('themeBtn');
  if(_theme === 'light'){
    document.body.classList.add('light-theme');
    if(btn) btn.textContent = '☀️';
  } else {
    document.body.classList.remove('light-theme');
    if(btn) btn.textContent = '🌙';
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

// ── DROPDOWN ──────────────────────────────────────────────────────────────
function toggleDD(id){
  var m=G(id), open=m.classList.contains('show');
  closeAllDD();
  if(!open){ m.classList.add('show'); G('f-type').classList.add('open'); }
}
function closeAllDD(){
  document.querySelectorAll('.dd-menu.show').forEach(function(m){m.classList.remove('show');});
  var ft=G('f-type'); if(ft) ft.classList.remove('open');
}
document.addEventListener('click',function(e){
  if(!e.target.closest('.dd-wrap')) closeAllDD();
});
function pickRoom(el,rid){
  var r=ROOMS[rid]; if(!r) return;
  curRoom=r;
  document.querySelectorAll('#dd-room .dd-item').forEach(function(i){i.classList.remove('sel');});
  el.classList.add('sel');
  closeAllDD();
  G('dt').textContent=rLabel(r);
  G('inp-vol').value=''; G('inp-ppl').value='';
  devs=[]; renderDevs();
  G('breakdown').classList.remove('show');
  G('hc-card').style.display='none';
  flash('vtr','0.00'); flash('vcfm','0'); flash('vbtu','0'); flash('vmkt','0');
}

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

// ── CALCULATION ───────────────────────────────────────────────────────────
function onVolInput(){ G('inp-vol').value=G('inp-vol').value.replace(/[٠-٩]/g,function(d){return'٠١٢٣٤٥٦٧٨٩'.indexOf(d);}); }
function onPplInput(){ G('inp-ppl').value=G('inp-ppl').value.replace(/[٠-٩]/g,function(d){return'٠١٢٣٤٥٦٧٨٩'.indexOf(d);}); }

function doCalc(){
  var vol=parseFloat(G('inp-vol').value)||0;
  var ppl=parseInt(G('inp-ppl').value)||0;
  if(!vol){ toast(t('tnov')); return; }
  if(curRoom.mode==='hc') calcHC(vol,ppl);
  else calcROT(vol,ppl);
}
function calcROT(vol,ppl){
  var base=vol*curRoom.factor, pplb=ppl*400, devb=totalDevBtu();
  var sub=base+pplb+devb, total=sub*1.10;
  var tr=total/12000, cfm=Math.round(tr*400), mkt=Math.ceil(total/9000)*9000;
  flash('vtr',tr.toFixed(2)); flash('vcfm',cfm.toLocaleString()); flash('vbtu',Math.round(total).toLocaleString()); flash('vmkt',mkt.toLocaleString());
  G('brv-vol').textContent=vol; G('brv-base').textContent=Math.round(base).toLocaleString();
  G('brv-ppl').textContent=Math.round(pplb).toLocaleString(); G('brv-dev').textContent=Math.round(devb).toLocaleString();
  G('brv-sub').textContent=Math.round(sub).toLocaleString(); G('brv-sf').textContent=Math.round(total).toLocaleString();
  G('breakdown').classList.add('show'); G('hc-card').style.display='none';
  saveHist(vol,ppl,tr,cfm,total,mkt,devb,null);
  G('add-quote-wrap').style.display='block';
  toast(t('tcalc'));
}
function calcHC(vol,ppl){
  var r=curRoom, ft3=m3toft3(vol);
  var sup=Math.round((r.tach*ft3)/60), oa=Math.round((r.oach*ft3)/60);
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
  G('hcv-oa').textContent=oa.toLocaleString(); G('hcv-exh').textContent=exh.toLocaleString();
  if(r.note){G('hc-note-row').style.display='';G('hcv-note').textContent=r.note;}else{G('hc-note-row').style.display='none';}
  G('hc-card').style.display='block';
  saveHist(vol,ppl,tr,sup,total,mkt,devb,{sup:sup,oa:oa,exh:exh,pres:r.pres});
  G('add-quote-wrap').style.display='block';
  toast(t('tcalc'));
}

// ── HISTORY ───────────────────────────────────────────────────────────────
function saveHist(vol,ppl,tr,cfm,totalBtu,mkt,devBtu,hcdata){
  var devSum=devs.map(function(d){
    var c=DEVS.filter(function(x){return x.id===d.id;})[0];
    return c?(lang==='ar'?c.ar:c.en)+'×'+d.qty:'';
  }).filter(Boolean).join(' | ');
  var rec={
    time:new Date().toLocaleString('ar-SA'),
    rid:curRoom.id, ar:curRoom.ar, en:curRoom.en,
    vol:vol, ppl:ppl, devSum:devSum, devBtu:devBtu,
    tr:tr.toFixed(2), cfm:cfm, btu:Math.round(totalBtu), mkt:mkt
  };
  if(hcdata){ rec.sup=hcdata.sup; rec.oa=hcdata.oa; rec.exh=hcdata.exh; rec.pres=hcdata.pres; }
  if(editIdx>=0&&editIdx<hist.length){
    hist[editIdx]=rec; editIdx=-1;
  } else {
    hist.push(rec);
    var _pUT=(qlines.length>0?qlines[qlines.length-1].unitType:'')||'split';
    var _pBtu=(qlines.length>0?qlines[qlines.length-1].selectedBtu:0)||0;
    qlines.push({qty:1,up:0,unitType:_pUT,selectedBtu:_pBtu});
    if(hist.length>100){hist.shift();qlines.shift();}
  }
  save(); renderHist();
  if(window.AppProjects&&window.AppProjects.updateNavDots) window.AppProjects.updateNavDots();
}

function renderHist(){
  var list=G('hist-list'); list.innerHTML='';
  G('hist-count').textContent=hist.length;
  if(!hist.length){
    var em=document.createElement('div'); em.className='hist-empty'; em.textContent=t('hempty');
    list.appendChild(em); G('cum-card').style.display='none';
    renderQuote(); return;
  }
  var totTR=0,totCFM=0,totBTU=0,totMKT=0;
  hist.forEach(function(h){ totTR+=parseFloat(h.tr)||0; totCFM+=h.cfm||0; totBTU+=h.btu||0; totMKT+=h.mkt||0; });
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
      '<div class="hist-detail">'+h.vol+' m³ · '+h.ppl+' 👤'+(h.devSum?' · '+h.devSum:'')+'</div>'+
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
  renderQuote();
  if(window.AppProjects&&window.AppProjects.updateNavDots) window.AppProjects.updateNavDots();
}

function delRec(idx){ hist.splice(idx,1); qlines.splice(idx,1); save(); renderHist(); toast(t('qdel')); if(window.AppProjects&&window.AppProjects.updateNavDots) window.AppProjects.updateNavDots(); }
function editRec(idx){
  var h=hist[idx]; if(!h) return;
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
    localStorage.removeItem('acp9h');
    localStorage.removeItem('acp9q');
    localStorage.removeItem('acp9qs');
    localStorage.removeItem('acp9mode');
    localStorage.removeItem('ac_bundleConfig');
    localStorage.removeItem('acp9theme');
  } catch(e){}

  // ── 3. Reset runtime variables to factory defaults ────────────────
  vatOn      = true;
  instPct    = 10;
  qsValidity = 14;
  qsNotes    = '';
  bundleOn   = false;
  quoteMode  = 'room';
  projState  = { sysType:'split', selBtu:0, qty:1, up:0 };
  bundleConfig.unitType    = 'package';
  bundleConfig.selectedBtu = 0;
  bundleConfig.qty         = 1;
  bundleConfig.unitPrice   = 0;
  bundleConfig.designBasis = 'required';
  bundleConfig.supplyFpm   = 1000;
  bundleConfig.returnFpm   = 800;
  bundleConfig.cfmPerTr    = 400;

  // ── 4. Reset UI inputs ────────────────────────────────────────────
  var inpVol = G('inp-vol');        if(inpVol)  inpVol.value  = '';
  var inpPpl = G('inp-ppl');        if(inpPpl)  inpPpl.value  = '';
  var qProj  = G('quote-project');  if(qProj)   qProj.value   = '';
  var qNo    = G('quote-no');       if(qNo)     qNo.value     = 'Q-001';
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
function getUP(i){ return parseFloat((qlines[i]||{}).up)||0; }
function getUT(i){ return (qlines[i]||{}).unitType||'split'; }
function getSelBtu(i){ return parseInt((qlines[i]||{}).selectedBtu)||0; }
function setSelBtu(i,v){ if(!qlines[i]) qlines[i]={qty:1,up:0,unitType:'split',selectedBtu:0}; qlines[i].selectedBtu=parseInt(v)||0; save(); renderQuote(); }


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
  var list=G('qi-list'); list.innerHTML='';
  if(!hist.length){
    var em=document.createElement('div'); em.className='qi-empty'; em.textContent=t('qempty');
    list.appendChild(em);
    G('qt-total-qty').textContent='0'; G('qt-grand').textContent='0.00'; return;
  }
  hist.forEach(function(h,i){
    var qty=getQty(i), up=getUP(i), lt=qty*up;
    var _rn=lang==='ar'?(h.ar||h.en):(h.en||h.ar);
    var name=_rn.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/gu,'').trim();
    var item=document.createElement('div'); item.className='qi-item';
    var hcLine='';
    if(h.sup){
      var pl=lang==='ar'?(h.pres==='positive'?'موجب':h.pres==='negative'?'سالب':'محايد'):(h.pres==='positive'?'Pos':h.pres==='negative'?'Neg':'Neutral');
      hcLine='<div class="qi-hcline">ASHRAE — S:'+h.sup+' OA:'+h.oa+' Exh:'+h.exh+' CFM | '+pl+'</div>';
    }
    var devLine=h.devSum?'<div class="qi-devline">⚡ '+h.devSum+'</div>':'';
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
    var utHtml='<div class="qi-utype"><span class="qi-utype-lbl">'+(lang==='ar'?'نوع الوحدة':'Unit Type')+'</span>'+
      (_bundleLocked
        ? '<select class="qi-utype-sel" disabled style="opacity:.45;cursor:not-allowed">'+utSelOpts+'</select>'
        : '<select class="qi-utype-sel" onchange="setUnitType('+i+',this.value)">'+utSelOpts+'</select>')+
      '</div>';
    var reqBtu = parseInt(h.btu)||0;
    var curUT = getUT(i);
    var catItems = getCatalog(curUT);
    var selBtu = getSelBtu(i);
    // Validate selBtu is in catalog; if not, pick best default
    var validBtus = catItems.map(function(x){return x.btu;});
    if(!selBtu || validBtus.indexOf(selBtu)<0){
      selBtu = defaultCapForUT(curUT, reqBtu);
      qlines[i].selectedBtu = selBtu;
    }
    var btuStepOpts = catItems.map(function(c){
      var lbl = lang==='ar' ? c.label.ar : c.label.en;
      return '<option value="'+c.btu+'"'+(selBtu===c.btu?' selected':'')+'>'+lbl+'</option>';
    }).join('');
    var capHtml = '<div class="qi-cap-row"><span class="qi-cap-lbl">'+(lang==='ar'?'السعة المختارة':'Selected Capacity')+'</span>'+
      (_bundleLocked
        ? '<select class="qi-cap-sel" disabled style="opacity:.45;cursor:not-allowed">'+btuStepOpts+'</select>'
        : '<select class="qi-cap-sel" onchange="setSelBtu('+i+',this.value)">'+btuStepOpts+'</select>')+
      '<span class="qi-cap-badge-slot"></span></div>';
    // In bundle mode: per-room warnings are suppressed (project-level shown separately)
    var effCap = _bundleLocked ? reqBtu : selBtu * qty; // neutralise per-room warnings in bundle mode
    // Delta% = ((selBtu*qty - reqBtu) / reqBtu) * 100 — TRUE percentage
    var warnHtml = '';
    var capBadge = '';
    if(reqBtu > 0){
      var deltaRaw = (effCap - reqBtu) / reqBtu * 100;
      var deltaRnd = Math.round(deltaRaw * 10) / 10;
      var absDelta = Math.abs(deltaRnd);
      var reqTR = (reqBtu/12000).toFixed(1);
      var selTR = (effCap/12000).toFixed(1);
      var pctStr = (deltaRnd >= 0 ? '+' : '') + deltaRnd.toFixed(1) + '%';

      if(deltaRaw < 0){
        // DEFICIT
        var defLines = lang==='ar'
          ? ['تنبيه: السعة أقل من الحمل المطلوب.',
             'العجز: '+deltaRnd.toFixed(1)+'%',
             'المطلوب: '+Number(reqBtu).toLocaleString()+' BTU/h (~'+reqTR+' TR)',
             'المختار: '+Number(effCap).toLocaleString()+' BTU/h (~'+selTR+' TR)',
             'يُنصح برفع السعة أو تقسيم الحمل.']
          : ['Warning: Capacity below required load.',
             'Deficit: '+deltaRnd.toFixed(1)+'%',
             'Required: '+Number(reqBtu).toLocaleString()+' BTU/h (~'+reqTR+' TR)',
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
    if(!_bundleLocked) capHtml = capHtml.replace('<span class="qi-cap-badge-slot"></span>', capBadge);
    else capHtml = capHtml.replace('<span class="qi-cap-badge-slot"></span>', '');

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
            ? '<span dir="rtl">'+_cfmSrcLbl+'</span><span dir="ltr" style="font-family:var(--fe)"> — Q = '+Number(_rCfm).toLocaleString()+' CFM</span>'
            : '<span>'+_cfmSrcLbl+' — Q = '+Number(_rCfm).toLocaleString()+' CFM</span>'
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
          '<div class="qi-stat"><div class="qi-slbl">👤</div><div class="qi-sval">'+h.ppl+'</div></div>'+
          '<div class="qi-stat"><div class="qi-slbl">TR</div><div class="qi-sval ca">'+h.tr+'</div></div>'+
          '<div class="qi-stat"><div class="qi-slbl">CFM</div><div class="qi-sval">'+Number(h.cfm).toLocaleString()+'</div></div>'+
          '<div class="qi-stat"><div class="qi-slbl">BTU/h</div><div class="qi-sval cam">'+Number(h.btu).toLocaleString()+'</div></div>'+
          '<div class="qi-stat"><div class="qi-slbl">Mkt BTU</div><div class="qi-sval">'+Number(h.mkt).toLocaleString()+'</div></div>'+
          (h.devBtu>0?'<div class="qi-stat"><div class="qi-slbl">Dev</div><div class="qi-sval cam">'+Number(h.devBtu).toLocaleString()+'</div></div>':'')+
        '</div>'+
        devLine+hcLine+capHtml+(_bundleLocked?'':warnHtml)+roomDuctHtml+
        '<div class="qi-price-row">'+
          '<div>'+
            '<div class="qi-plbl">'+(lang==='ar'?'الكمية':'Qty')+'</div>'+
            '<input class="minp" type="number" min="1" step="1" value="'+qty+'" onchange="setQty('+i+',this.value)">'+
          '</div>'+
          '<div>'+
            '<div class="qi-plbl">'+(lang==='ar'?'سعر الوحدة':'Unit Price')+'</div>'+
            '<input class="minp" type="number" min="0" step="0.01" value="'+(up||'')+'" placeholder="0.00" onchange="setUp('+i+',this.value)">'+
          '</div>'+
          '<div class="qi-lt-box">'+
            '<div class="qi-lt-lbl">'+(lang==='ar'?'الإجمالي':'Total')+'</div>'+
            '<div class="qi-lt-val" id="qlt-'+i+'">'+money(lt)+'</div>'+
          '</div>'+
        '</div>'+
      '</div>';
    list.appendChild(item);
  });
  refreshGrandTotal();
}

function setQty(i,v){ if(!qlines[i]) qlines[i]={qty:1,up:0}; qlines[i].qty=Math.max(1,parseInt(v)||1); save(); var e=G('qlt-'+i); if(e) e.textContent=money(getQty(i)*getUP(i)); refreshGrandTotal(); renderQuote(); }
function setUnitType(i,v){
  if(!qlines[i]) qlines[i]={qty:1,up:0,unitType:'split',selectedBtu:0};
  var oldType=qlines[i].unitType||'split';
  var newType=v||'split';
  qlines[i].unitType=newType;
  if(oldType!==newType){
    var reqBtu2=parseInt((hist[i]||{}).btu)||0;
    var newCat=getCatalog(newType);
    var validBtus2=newCat.map(function(x){return x.btu;});
    if(validBtus2.indexOf(qlines[i].selectedBtu)<0){
      qlines[i].selectedBtu=defaultCapForUT(newType,reqBtu2);
    }
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
  if(!hist.length){ toast(lang==='ar'?'⚠️ لا توجد غرف':'⚠️ No rooms saved'); return; }
  var proj=G('quote-project').value.trim()||(lang==='ar'?'غير محدد':'Untitled');
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
    rows.push(['AirCalc Pro — عرض السعر','','','','','','','','','','','','']);
    rows.push(['اسم المشروع',proj,'','','','','','','','','','','']);
    rows.push(['رقم عرض السعر',qno,'','','','','','','','','','','']);
    rows.push(['التاريخ',today,'','','','','','','','','','','']);
    rows.push(['صلاحية العرض',vd+' يوم','','','','','','','','','','','']);
    rows.push(['','','','','','','','','','','','','']);
    rows.push(['#','نوع الغرفة','نوع الوحدة','السعة المختارة','الحجم م³','أشخاص','حمل الأجهزة BTU/h','TR','CFM','BTU/h','سوق BTU','ASHRAE','الكمية','سعر الوحدة','إجمالي السطر']);
    hist.forEach(function(h,i){
      var hc=h.sup?'S:'+h.sup+' OA:'+h.oa+' Exh:'+h.exh+' '+h.pres:'—';
      var _ut=utLabel(getUT(i));
      var _sb=getSelBtu(i)||acRoundBtu(parseInt(h.btu)||0,'btu');
      rows.push([i+1,h.ar||h.en,_ut,Number(_sb).toLocaleString()+' BTU',h.vol,h.ppl,h.devBtu||0,h.tr,h.cfm,h.btu,h.mkt,hc,getQty(i),getUP(i),money(getQty(i)*getUP(i))]);
    });
    rows.push(['','','','','','','','','','','','','']);
    rows.push(['المجموع الفرعي','ر.س '+money(subtotal),'','','','','','','','','','','']);
    rows.push(['التركيب ('+ip+'%)','ر.س '+money(instAmt),'','','','','','','','','','','']);
    if(vatOn) rows.push(['ضريبة القيمة المضافة 15%','ر.س '+money(vatAmt),'','','','','','','','','','','']);
    rows.push(['إجمالي الكمية',totalQty,'','','','','','','','','','','']);
    rows.push(['الإجمالي النهائي','ر.س '+money(grand),'','','','','','','','','','','']);
    if(notes) rows.push(['ملاحظات',notes,'','','','','','','','','','','']);
    rows.push(['','','','','','','','','','','','','']);
    rows.push(['تنبيه: تقدير أولي — لا يُعتمد للتصميم النهائي','','','','','','','','','','','','']);
  } else {
    rows.push(['AirCalc Pro — Quotation','','','','','','','','','','','','']);
    rows.push(['Project Name',proj,'','','','','','','','','','','']);
    rows.push(['Quotation No.',qno,'','','','','','','','','','','']);
    rows.push(['Date',today,'','','','','','','','','','','']);
    rows.push(['Validity',vd+' days','','','','','','','','','','','']);
    rows.push(['','','','','','','','','','','','','']);
    rows.push(['#','Room Type','System Type','Selected Capacity','Volume m³','Persons','Device Load BTU/h','TR','CFM','BTU/h','Market BTU','ASHRAE','Quantity','Unit Price','Line Total']);
    hist.forEach(function(h,i){
      var hc=h.sup?'S:'+h.sup+' OA:'+h.oa+' Exh:'+h.exh+' '+h.pres:'—';
      var _ut2=utLabel(getUT(i));
      var _sb2=getSelBtu(i)||acRoundBtu(parseInt(h.btu)||0,'btu');
      rows.push([i+1,h.en||h.ar,_ut2,Number(_sb2).toLocaleString()+' BTU',h.vol,h.ppl,h.devBtu||0,h.tr,h.cfm,h.btu,h.mkt,hc,getQty(i),getUP(i),money(getQty(i)*getUP(i))]);
    });
    rows.push(['','','','','','','','','','','','','']);
    rows.push(['Equipment Subtotal','SAR '+money(subtotal),'','','','','','','','','','','']);
    rows.push(['Installation ('+ip+'%)','SAR '+money(instAmt),'','','','','','','','','','','']);
    if(vatOn) rows.push(['VAT 15%','SAR '+money(vatAmt),'','','','','','','','','','','']);
    rows.push(['Total Quantity',totalQty,'','','','','','','','','','','']);
    rows.push(['Grand Total','SAR '+money(grand),'','','','','','','','','','','']);
    if(notes) rows.push(['Notes',notes,'','','','','','','','','','','']);
    rows.push(['','','','','','','','','','','','','']);
    rows.push(['Notice: Preliminary estimate — not for final design submittal','','','','','','','','','','','','']);
  }
  var csv=rows.map(function(r){
    return r.map(function(c){var s=String(c).replace(/"/g,'""');return /[,"\n]/.test(s)?'"'+s+'"':s;}).join(',');
  }).join('\r\n');
  var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);
  a.download='quotation_'+qno.replace(/[^a-zA-Z0-9\u0600-\u06FF_-]/g,'_')+'.csv';a.click();
  toast(lang==='ar'?'📄 تم تصدير الملف':'📄 CSV exported');
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
    +' .inv-brand-sub{font-size:11px;color:#64748b;margin-top:2px