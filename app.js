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
  ar:{calc:'احسب ▶',hclr:'مسح السجل',ncalc:'الحاسبة',nhist:'عرض السعر',ncontact:'تواصل',nset:'الإعدادات',
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
      qexport:'تصدير عرض السعر (CSV)',qdel:'🗑️ تم الحذف',qsttl:'⚙️ إعدادات عرض السعر',qsinst:'نسبة التركيب',qsvat:'تفعيل ضريبة القيمة المضافة',qsvalid:'مدة صلاحية العرض',qsnotes:'ملاحظات',qsnph:'مثال: العرض شامل التوريد والتركيب داخل المدينة.',v7:'7 أيام',v14:'14 يوم',v30:'30 يوم',qssubl:'المجموع الفرعي (المعدات)',qsinstl:'التركيب',qsvatl:'ضريبة القيمة المضافة 15%',qsqtyl:'إجمالي الكمية',expcsv:'📊 CSV',exphtml:'🖨️ فاتورة HTML',exppdf:'📥 تحميل PDF',exptechpdf:'🛠️ تقرير فني',invtitle:'فاتورة / عرض سعر',invvalid:'صلاحية العرض',invdate:'التاريخ',invnotes:'ملاحظات',invroom:'نوع الغرفة',invvol:'الحجم',invppl:'أشخاص',invtr:'TR',invcfm:'CFM',invbtu:'BTU/h',invmkt:'Mkt BTU',invqty:'الكمية',invup:'سعر الوحدة',invlt:'إجمالي السطر',invsubt:'المجموع الفرعي',invinst:'التركيب',invvat:'ضريبة 15%',invgrand:'الإجمالي النهائي',invdiscl:'تقدير أولي — لا يُعتمد للتصميم النهائي'},
  en:{calc:'Calculate ▶',hclr:'Clear History',ncalc:'Calc',nhist:'Quotation',ncontact:'Contact',nset:'Settings',
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
      qexport:'Export Quotation (CSV)',qdel:'🗑️ Deleted',qsttl:'⚙️ Quotation Settings',qsinst:'Installation %',qsvat:'Enable VAT',qsvalid:'Quotation Validity',qsnotes:'Notes',qsnph:'Example: Price includes supply & installation within city limits.',v7:'7 days',v14:'14 days',v30:'30 days',qssubl:'Equipment Subtotal',qsinstl:'Installation',qsvatl:'VAT 15%',qsqtyl:'Total Quantity',expcsv:'📊 CSV',exphtml:'🖨️ Invoice HTML',exppdf:'📥 Download PDF',exptechpdf:'🛠️ Tech Report',invtitle:'Quotation / Invoice',invvalid:'Validity',invdate:'Date',invnotes:'Notes',invroom:'Room Type',invvol:'Volume m³',invppl:'Persons',invtr:'TR',invcfm:'CFM',invbtu:'BTU/h',invmkt:'Mkt BTU',invqty:'Qty',invup:'Unit Price',invlt:'Line Total',invsubt:'Equipment Subtotal',invinst:'Installation',invvat:'VAT 15%',invgrand:'Grand Total',invdiscl:'Preliminary estimate — not for final design submittal'}
};
function t(k){ return T[lang][k]||k; }

function applyLang(){
  document.documentElement.lang = lang;
  document.documentElement.dir = lang==='ar'?'rtl':'ltr';
  G('langBtn').textContent = lang==='ar'?'EN':'ع';
  G('tog-lang').className = 'tog'+(lang==='ar'?' on':'');
  var m = {
    'lbl-calc':'calc','lbl-hclr':'hclr',
    'nl-calc':'ncalc','nl-hist':'nhist','nl-contact':'ncontact','nl-settings':'nset',
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
}

function delRec(idx){ hist.splice(idx,1); qlines.splice(idx,1); save(); renderHist(); toast(t('qdel')); }
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

function clearHist(){ resetApp(); }

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
      var _supLbl = _dSup ? ductSizeLabel(_dSup.std||_dSup.calc) : '—';
      var _retLbl = _dRet ? ductSizeLabel(_dRet.std||_dRet.calc) : '—';
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
    rows.push(['#','\u0646\u0648\u0639 \u0627\u0644\u063a\u0631\u0641\u0629','\u0646\u0648\u0639 \u0627\u0644\u0648\u062d\u062f\u0629','\u0627\u0644\u0633\u0639\u0629 \u0627\u0644\u0645\u062e\u062a\u0627\u0631\u0629','\u0627\u0644\u062d\u062c\u0645 \u0645\u00b3','\u0623\u0634\u062e\u0627\u0635','\u062d\u0645\u0644 \u0627\u0644\u0623\u062c\u0647\u0632\u0629 BTU/h','TR','CFM','BTU/h','\u0633\u0648\u0642 BTU','ASHRAE','\u0627\u0644\u0643\u0645\u064a\u0629','\u0633\u0639\u0631 \u0627\u0644\u0648\u062d\u062f\u0629','\u0625\u062c\u0645\u0627\u0644\u064a \u0627\u0644\u0633\u0637\u0631']);
    hist.forEach(function(h,i){
      var hc=h.sup?'S:'+h.sup+' OA:'+h.oa+' Exh:'+h.exh+' '+h.pres:'\u2014';
      var _ut=utLabel(getUT(i));
      var _sb=getSelBtu(i)||acRoundBtu(parseInt(h.btu)||0,'btu');
      rows.push([i+1,h.ar||h.en,_ut,Number(_sb).toLocaleString()+' BTU',h.vol,h.ppl,h.devBtu||0,h.tr,h.cfm,h.btu,h.mkt,hc,getQty(i),getUP(i),money(getQty(i)*getUP(i))]);
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
    rows.push(['#','Room Type','System Type','Selected Capacity','Volume m\u00b3','Persons','Device Load BTU/h','TR','CFM','BTU/h','Market BTU','ASHRAE','Quantity','Unit Price','Line Total']);
    hist.forEach(function(h,i){
      var hc=h.sup?'S:'+h.sup+' OA:'+h.oa+' Exh:'+h.exh+' '+h.pres:'\u2014';
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
    // HC details
    var hcHtml='';
    if(h.sup){
      var presLbl=c.isAr?(h.pres==='positive'?'موجب':h.pres==='negative'?'سالب':'محايد'):(h.pres==='positive'?'Positive':h.pres==='negative'?'Negative':'Neutral');
      hcHtml='<div class="hc-detail-box">'
        +'<div style="font-size:10px;color:#0369a1;font-weight:700;margin-bottom:8px">ASHRAE 170</div>'
        +'<div class="hc-grid">'
          +'<div class="hc-item"><div class="hc-lbl">'+(c.isAr?'إمداد':'Supply')+'</div><div class="hc-val">'+h.sup+'</div></div>'
          +'<div class="hc-item"><div class="hc-lbl">OA CFM</div><div class="hc-val">'+(h.oa||'—')+'</div></div>'
          +'<div class="hc-item"><div class="hc-lbl">'+(c.isAr?'عادم':'Exhaust')+'</div><div class="hc-val">'+(h.exh||'—')+'</div></div>'
          +'<div class="hc-item"><div class="hc-lbl">'+(c.isAr?'الضغط':'Pressure')+'</div><div class="hc-val">'+presLbl+'</div></div>'
        +'</div>'
      +'</div>';
    }
    // Devices
    var devHtml=h.devSum?'<div style="font-size:11px;color:#64748b;margin-top:6px">⚡ '+h.devSum+'</div>':'';
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
                '<td style="padding:5px 6px;border:1px solid #bbf7d0;font-weight:600;color:#0369a1">'+(c.isAr?'هواء طازج OA':'Fresh Air OA')+'</td>'+
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
        +hcHtml+devHtml+techDuctHtml
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
      if(btn){ btn.disabled=false; btn.innerHTML='📥 <span id="lbl-export3">'+(lang==='ar'?'تحميل PDF':'Download PDF')+'</span>'; }
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
      if(btn){ btn.disabled=false; btn.innerHTML='📥 <span id="lbl-export3">'+(lang==='ar'?'تحميل PDF':'Download PDF')+'</span>'; }
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
  var btn=G('btn-techpdf');
  if(btn){ btn.disabled=true; btn.textContent=lang==='ar'?'جارٍ تحميل المكتبات...':'Loading libraries...'; }
  var loaded=0, failed=0;
  function onLoad(){ loaded++; if(loaded+failed>=2){ if(btn){btn.disabled=false;btn.innerHTML='🛠️ <span id="lbl-export4">'+(lang==='ar'?'تقرير فني':'Tech Report')+'</span>';} if(failed===0) _doExportTechPDF(); else toast(lang==='ar'?'⚠️ فشل تحميل مكتبة PDF':'⚠️ PDF library failed to load'); } }
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
  var btn=G('btn-techpdf');
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
      if(btn){ btn.disabled=false; btn.innerHTML='🛠️ <span id="lbl-export4">'+(lang==='ar'?'تقرير فني':'Tech Report')+'</span>'; }
    }).catch(function(err){
      document.body.removeChild(wrap);
      console.error('TechPDF error:',err);
      toast(lang==='ar'?'❌ فشل استخراج التقرير':'❌ Export failed');
      if(btn){ btn.disabled=false; btn.innerHTML='🛠️ <span id="lbl-export4">'+(lang==='ar'?'تقرير فني':'Tech Report')+'</span>'; }
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
// ── ESP Calculation ──────────────────────────────────────────────────────
// ESP = Friction loss + Fitting losses + Filter/coil adders
// Friction: (lenSup + lenRet) * fricPa
// Fittings: bends × K × dynamicPressure_Pa
//   Dynamic pressure Pa = 0.5 × 1.2 × V_m/s²  (V_m/s = fpm × 0.00508)
// Adder: 30 Pa for supply diffuser + 20 Pa for filter (typical)
// Classification: Low < 125 Pa, Medium 125-250 Pa, High > 250 Pa
function calcESP(){
  var isAr = lang==='ar';
  var espBlock = G('esp-block');
  if(!espBlock) return;
  var lenSup = parseFloat((G('esp-len-sup')||{value:'30'}).value)||30;
  var lenRet = parseFloat((G('esp-len-ret')||{value:'20'}).value)||20;
  var bends  = parseInt((G('esp-bends')||{value:'4'}).value)||4;
  var fric   = parseFloat((G('esp-fric')||{value:'1.0'}).value)||1.0;
  var vSup   = parseInt((G('duct-vel-sup')||{value:'1000'}).value)||1000;
  // Convert fpm to m/s
  var vMs = vSup * 0.00508;
  // Dynamic pressure Pa
  var dynPa = 0.5 * 1.2 * vMs * vMs;
  // K factor per bend ≈ 0.3 (typical elbow)
  var K = 0.3;
  // Total ESP
  var frictionLoss = (lenSup + lenRet) * fric;
  var fittingLoss  = bends * K * dynPa;
  var adderLoss    = 50; // typical: 30 diffuser + 20 filter
  var totalEsp     = frictionLoss + fittingLoss + adderLoss;
  totalEsp = Math.round(totalEsp);
  // Classify
  var espClass, espColor, espIcon;
  if(totalEsp < 125){
    espClass = isAr ? 'منخفض' : 'Low';
    espColor = '#065f46'; espIcon = '🟢';
  } else if(totalEsp <= 250){
    espClass = isAr ? 'متوسط' : 'Medium';
    espColor = '#92400e'; espIcon = '🟡';
  } else {
    espClass = isAr ? 'عالٍ' : 'High';
    espColor = '#991b1b'; espIcon = '🔴';
  }
  var espResult = G('esp-result');
  if(espResult){
    var badgeCls = totalEsp<125?'esp-low':(totalEsp<=250?'esp-med':'esp-high');
    espResult.innerHTML =
      '<span class="esp-badge '+badgeCls+'">'+espIcon+' '+espClass+' — '+totalEsp+' Pa</span>'+
      '<span style="font-size:9px;color:var(--tm)">'+(isAr
        ?('احتكاك: '+Math.round(frictionLoss)+' + وصلات: '+Math.round(fittingLoss)+' + إضافي: '+adderLoss+' Pa')
        :('Friction: '+Math.round(frictionLoss)+' + Fittings: '+Math.round(fittingLoss)+' + Adders: '+adderLoss+' Pa')
      )+'</span>';
  }
}

window._ductBasis = 'required'; // 'required' | 'selected'
function setDuctBasis(basis){
  window._ductBasis = basis;
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
  try{ localStorage.setItem('ac_bundleConfig',JSON.stringify(bundleConfig)); }catch(e){}
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
  up: 0
};
// [quoteMode restored in initApp]

function setQuoteMode(mode){
  quoteMode = mode;
  try{ localStorage.setItem('acp9mode', mode); }catch(e){}
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
  // Auto-select best capacity
  var _tc=getProjTotalCfm(); var _reqCfmForCat = (_tc > 0) ? Math.ceil(_tc / Math.max(1, projState.qty)) : 0;
  projState.selBtu = defaultCapForUT(projState.sysType, Math.ceil(totalBtu / Math.max(1, projState.qty)), _reqCfmForCat);
  // Set dropdown
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
      // Auto pick
      var needed = totalBtu;
      var perUnit = Math.ceil(needed / Math.max(1,projState.qty));
      var _reqCfmAuto = (totalCfm > 0) ? Math.ceil(totalCfm / Math.max(1, projState.qty)) : 0;
      projState.selBtu = defaultCapForUT(curUT, perUnit, _reqCfmAuto);
      capSel.value = projState.selBtu;
      if(!capSel.value && cat2.length){ capSel.selectedIndex=0; projState.selBtu=cat2[0].btu; }
    }
    projState.selBtu = parseInt(capSel.value) || (cat2.length?cat2[0].btu:0);
  }

  // Qty / UP
  var qtyEl = G('proj-qty'), upEl = G('proj-up');
  projState.qty = Math.max(1, parseInt((qtyEl||{value:'1'}).value)||1);
  projState.up  = parseFloat((upEl||{value:'0'}).value)||0;

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
      var _sfric=G('esp-lbl-fric'); if(_sfric) _sfric.textContent=isAr?'احتكاك (Pa/m)':'Friction (Pa/m)';

    } else {
      ductBlock.style.display='none';
    }
  }// Line total
  var lt = projState.qty * projState.selBtu > 0 ? projState.qty * projState.up : 0;
  lt = projState.qty * projState.up;
  setV('proj-lt-val', (G('cur-sym')?G('cur-sym').textContent:t('cur'))+' '+money(lt));

  refreshGrandTotal();
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
                '<td style="padding:5px 8px;border:1px solid #bae6fd;text-align:center;font-family:monospace">'+Number(rbtu).toLocaleString()+'</td>'+
                '<td style="padding:5px 8px;border:1px solid #bae6fd;text-align:center;font-family:monospace">'+(rbtu/12000).toFixed(2)+'</td>'+
                '<td style="padding:5px 8px;border:1px solid #bae6fd;text-align:center;font-family:monospace">'+rcfm.toLocaleString()+'</td>'+
                '<td style="padding:5px 8px;border:1px solid #bae6fd;text-align:center;font-family:monospace">'+(rh.vol||'—')+'</td>'+
              '</tr>';
            });
            rrows+='<tr style="background:#dbeafe;font-weight:700">'+
              '<td style="padding:6px 8px;border:1px solid #93c5fd;text-align:center" colspan="2">'+(c.isAr?'الإجمالي المطلوب':'Total Required')+'</td>'+
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
                '<td style="padding:6px 8px;border:1px solid #86efac;font-weight:600;color:#0369a1">'+(c.isAr?'هواء طازج OA':'Fresh Air OA')+'</td>'+
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
          var _espEl=G('esp-result');
          if(!_espEl||!_espEl.textContent.trim()) return '';
          var _espTxt=(_espEl.textContent||'').replace(/[^\w\d\s؀-\u06FF.+,\-%]/g,'').trim();
          if(!_espTxt) return '';
          var _espLenS=parseFloat((G('esp-len-sup')||{value:'30'}).value)||30;
          var _espLenR=parseFloat((G('esp-len-ret')||{value:'20'}).value)||20;
          var _espBends=parseInt((G('esp-bends')||{value:'4'}).value)||4;
          return '<div style="margin-top:6px;padding:6px 10px;background:#fef9c3;border:1px solid #fde68a;border-radius:5px;font-size:10px;color:#78350f">'+
            '⚡ ESP: '+_espTxt+' | '+(c.isAr?'طول الإمداد':'Sup.L')+' '+_espLenS+'m | '+(c.isAr?'طول الرجوع':'Ret.L')+' '+_espLenR+'m | '+(c.isAr?'انحناءات':'Bends')+' '+_espBends+
            '<div style="font-size:9px;margin-top:2px;color:#92400e">'+(c.isAr?'تقدير أولي — يجب التحقق بتحليل مجاري تفصيلي':'Preliminary estimate only. Verify with detailed duct analysis.')+'</div>'+
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
var _origApplyLang = applyLang;
applyLang = function(){
  _origApplyLang();
  updateProjLabels();
  if(quoteMode==='proj') renderProjBlock();
};

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

