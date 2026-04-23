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
var lastRoomDims = null;

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
