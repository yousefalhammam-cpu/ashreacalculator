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
var ENGINEERING_SOURCE_STATUS = {};
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
  ENGINEERING_SOURCE_STATUS = data.ENGINEERING_SOURCE_STATUS || {};
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

function makeWorkspaceId(prefix){
  return (prefix || 'id') + '_' + Math.random().toString(36).slice(2,10);
}

function normalizeRoomAssignment(assignment){
  assignment = assignment || {};
  var mode = assignment.mode || 'independent';
  if(['independent','project','zone'].indexOf(mode) < 0) mode = 'independent';
  return {
    mode: mode,
    zoneId: assignment.zoneId || '',
    projectSystemId: assignment.projectSystemId || ''
  };
}

function normalizeHvacZone(zone){
  zone = zone || {};
  return {
    id: zone.id || makeWorkspaceId('zone'),
    name: zone.name || (lang==='ar' ? 'منطقة HVAC' : 'HVAC Zone'),
    systemLabel: zone.systemLabel || '',
    roomIds: Array.isArray(zone.roomIds) ? Array.from(new Set(zone.roomIds.filter(Boolean))) : [],
    systems: Array.isArray(zone.systems) ? zone.systems.map(normalizeQuoteSystem) : [normalizeQuoteSystem({
      unitType:'ahu',
      selectedBtu:getDefaultSystemCapacity('ahu'),
      qty:1
    })]
  };
}

function normalizeProjectSystem(system){
  return normalizeQuoteSystem(system);
}
function addNormalizedSystemToCollection(collection, defaults){
  var list = Array.isArray(collection) ? collection.slice() : [];
  var source = defaults || {};
  list.push(normalizeQuoteSystem({
    unitType: source.unitType || 'split',
    selectedBtu: source.selectedBtu || getDefaultSystemCapacity(source.unitType || 'split'),
    qty: source.qty || 1
  }));
  return list.map(normalizeQuoteSystem);
}
function updateNormalizedSystemInCollection(collection, systemId, field, value){
  var list = Array.isArray(collection) ? collection.slice() : [];
  for(var i=0;i<list.length;i++){
    var system = list[i];
    if(!system || system.id !== systemId) continue;
    if(field === 'unitType'){
      system.unitType = getAllowedSystemType(value);
      system.selectedBtu = getDefaultSystemCapacity(system.unitType);
      system.equipmentDatabaseId = '';
      system.equipmentSnapshot = null;
      system.selectedEquipmentOption = null;
      system.manualCapacity = false;
      system.manualCapacityBtuH = 0;
      system.selectionMode = 'none';
      system.equipmentReviewStatus = '';
      system.selectedEquipmentId = '';
      system.selectedManufacturer = '';
      system.selectedModel = '';
      system.selectedCapacityBtuH = system.selectedBtu;
      system.selectedCapacityTr = system.selectedBtu / 12000;
      system.selectedAirflowCfm = 0;
      system.selectedQuantity = Math.max(1, parseInt(system.qty, 10) || 1);
      system.totalInstalledCapacityBtuH = system.selectedBtu * system.selectedQuantity;
      system.totalInstalledAirflowCfm = 0;
      system.automaticSelectionReason = '';
    } else if(field === 'selectedBtu'){
      system.selectedBtu = toSystemBtu(value) || getDefaultSystemCapacity(system.unitType);
      system.equipmentDatabaseId = '';
      system.equipmentSnapshot = null;
      system.selectedEquipmentOption = null;
      system.manualCapacity = true;
      system.manualCapacityBtuH = system.selectedBtu;
      system.selectionMode = 'manual';
      system.equipmentReviewStatus = 'manual_capacity';
    } else if(field === 'qty'){
      system.qty = Math.max(1, parseInt(value,10) || 1);
      system.selectedQuantity = system.qty;
      var perf = getInstalledEquipmentPerformance(system);
      system.totalInstalledCapacityBtuH = perf.totalCapacityBtuH;
      system.totalInstalledAirflowCfm = perf.totalAirflowCfm;
    }
    break;
  }
  return list.map(normalizeQuoteSystem);
}
function removeSystemFromCollection(collection, systemId){
  var list = Array.isArray(collection) ? collection.slice() : [];
  return list.filter(function(system){ return system && system.id !== systemId; }).map(normalizeQuoteSystem);
}

function saveHvacZones(){
  try{
    localStorage.setItem(HVAC_ZONES_KEY, JSON.stringify(hvacZones.map(normalizeHvacZone)));
  }catch(e){}
}

function saveProjectSystems(){
  try{
    localStorage.setItem(HVAC_PROJECT_SYSTEMS_KEY, JSON.stringify((projectSystems || []).map(normalizeProjectSystem)));
    localStorage.setItem('aircalc_duct_dimensions', JSON.stringify(projState.ductDimensions || {}));
    localStorage.setItem('aircalc_duct_filter',JSON.stringify(projState.ductFilter || {type:'none'}));
  }catch(e){}
}

function saveSelectedHvacScenario(){
  try{
    if(selectedHvacDesignScenario){
      localStorage.setItem(HVAC_SELECTED_SCENARIO_KEY, JSON.stringify(selectedHvacDesignScenario));
    } else {
      localStorage.removeItem(HVAC_SELECTED_SCENARIO_KEY);
    }
  }catch(e){}
}

function loadHvacZones(){
  try{
    var raw = localStorage.getItem(HVAC_ZONES_KEY);
    var parsed = raw ? JSON.parse(raw) : [];
    hvacZones = Array.isArray(parsed) ? parsed.map(normalizeHvacZone) : [];
  }catch(e){
    hvacZones = [];
  }
}

function loadProjectSystems(){
  try{
    var raw = localStorage.getItem(HVAC_PROJECT_SYSTEMS_KEY);
    var parsed = raw ? JSON.parse(raw) : [];
    projectSystems = Array.isArray(parsed) ? parsed.map(normalizeProjectSystem) : [];
    var dimensions = JSON.parse(localStorage.getItem('aircalc_duct_dimensions') || '{}');
    projState.ductDimensions = {};
    ['sup','ret'].forEach(function(side){
      var size = dimensions && dimensions[side];
      if(size){
        var w=Number(size.w),h=Number(size.h);
        if((w>=100 && w<=1800) || (h>=100 && h<=1800))projState.ductDimensions[side]={w:w>=100 && w<=1800?w:null,h:h>=100 && h<=1800?h:null};
      }
    });
    var filter=JSON.parse(localStorage.getItem('aircalc_duct_filter') || 'null');
    projState.ductFilter=filter && typeof filter==='object'?filter:{type:'none'};
  }catch(e){
    projectSystems = [];
  }
}

function loadSelectedHvacScenario(){
  try{
    var raw = localStorage.getItem(HVAC_SELECTED_SCENARIO_KEY);
    selectedHvacDesignScenario = raw ? JSON.parse(raw) : null;
  }catch(e){
    selectedHvacDesignScenario = null;
  }
}

function ensureProjectSystems(){
  if(!Array.isArray(projectSystems)) projectSystems = [];
  var used = {};
  projectSystems = projectSystems.map(function(system){
    var normalized = normalizeProjectSystem(system);
    if(!normalized.id || used[normalized.id]){
      normalized.id = createQuoteSystemId();
    }
    used[normalized.id] = true;
    // Keep references held by quotation editors when normalizing project state.
    return system && typeof system === 'object' ? Object.assign(system, normalized) : normalized;
  });
  return projectSystems;
}

function seedProjectSystemsFromLegacyState(){
  ensureProjectSystems();
  if(projectSystems.length) return projectSystems;
  var unitType = getAllowedSystemType(projState.sysType || 'split');
  var defaultBtu = toSystemBtu(projState.selBtu) || getDefaultSystemCapacity(unitType);
  var defaultQty = Math.max(1, parseInt(projState.qty,10) || 1);
  projectSystems = [normalizeProjectSystem({
    unitType: unitType,
    selectedBtu: defaultBtu,
    qty: defaultQty
  })];
  saveProjectSystems();
  return projectSystems;
}

function ensureRoomRecordId(i){
  var line = ensureQuoteLine(i);
  var room = hist[i] || {};
  var rid = room._roomRecordId || line.roomRecordId || makeWorkspaceId('room');
  room._roomRecordId = rid;
  line.roomRecordId = rid;
  hist[i] = room;
  qlines[i] = line;
  return rid;
}

function ensureAllRoomRecordIds(){
  for(var i=0;i<hist.length;i++) ensureRoomRecordId(i);
}

function expandLegacyMultiRoomRecords(){
  if(!Array.isArray(hist) || !Array.isArray(qlines) || !hist.length) return false;
  var nextHist = [];
  var nextQlines = [];
  var changed = false;
  for(var i=0;i<hist.length;i++){
    var room = hist[i] || {};
    var line = ensureQuoteLine(i);
    var rc = Math.max(1, parseInt(room.roomCount,10) || 1);
    if(rc <= 1){
      nextHist.push(room);
      nextQlines.push(line);
      continue;
    }
    changed = true;
    for(var ci=0; ci<rc; ci++){
      var roomClone = JSON.parse(JSON.stringify(room));
      roomClone.roomCount = 1;
      delete roomClone._roomRecordId;
      var lineClone = JSON.parse(JSON.stringify(line));
      lineClone.roomRecordId = '';
      lineClone.assignment = normalizeRoomAssignment(lineClone.assignment);
      if(lineClone.assignment.mode !== 'project'){
        lineClone.qty = 1;
        lineClone.selectedBtu = 0;
        lineClone.qtyAuto = true;
        lineClone.autoReason = '';
        lineClone.systems = [];
        lineClone.selectedCapacityBtu = 0;
        lineClone.capacityDifference = 0;
        lineClone.capacityStatus = '';
        lineClone.requiredCfm = 0;
        lineClone.selectedSystemCfm = 0;
        lineClone.airflowDifference = 0;
        lineClone.airflowStatus = '';
        lineClone.assignment = normalizeRoomAssignment({ mode:'independent', zoneId:'', projectSystemId:'' });
      }
      nextHist.push(roomClone);
      nextQlines.push(lineClone);
    }
  }
  if(!changed) return false;
  hist = nextHist;
  qlines = nextQlines;
  ensureAllRoomRecordIds();
  return true;
}

function getRoomIndexByRecordId(roomRecordId){
  for(var i=0;i<hist.length;i++){
    if(ensureRoomRecordId(i) === roomRecordId) return i;
  }
  return -1;
}

function getRoomAssignment(i){
  var line = ensureQuoteLine(i);
  line.assignment = normalizeRoomAssignment(line.assignment);
  return line.assignment;
}

function getZoneById(zoneId){
  for(var i=0;i<hvacZones.length;i++){
    if(hvacZones[i] && hvacZones[i].id === zoneId) return hvacZones[i];
  }
  return null;
}

function createHvacZone(name, roomIndex){
  var zone = normalizeHvacZone({
    name: name || (lang==='ar' ? 'منطقة جديدة' : 'New Zone'),
    roomIds: roomIndex >= 0 ? [ensureRoomRecordId(roomIndex)] : []
  });
  hvacZones.push(zone);
  saveHvacZones();
  return zone;
}

function getZoneRoomIndices(zoneId){
  var zone = getZoneById(zoneId);
  if(!zone) return [];
  ensureAllRoomRecordIds();
  return zone.roomIds.map(getRoomIndexByRecordId).filter(function(idx){ return idx >= 0; });
}

function getProjectAssignedRoomIndices(){
  ensureAllRoomRecordIds();
  if(quoteMode === 'proj'){
    return hist.map(function(_, idx){ return idx; });
  }
  var indices = [];
  for(var i=0;i<hist.length;i++){
    if(getRoomAssignment(i).mode === 'project') indices.push(i);
  }
  return indices;
}

function getProjectSystem(systemId){
  ensureProjectSystems();
  for(var i=0;i<projectSystems.length;i++){
    if(projectSystems[i] && projectSystems[i].id === systemId) return projectSystems[i];
  }
  return null;
}

function getProjectSystemDisplayName(systemId){
  ensureProjectSystems();
  for(var i=0;i<projectSystems.length;i++){
    if(projectSystems[i] && projectSystems[i].id === systemId){
      return (lang==='ar' ? 'وحدة المشروع ' : 'Project Unit ') + (i + 1);
    }
  }
  return lang==='ar' ? 'وحدة المشروع' : 'Project Unit';
}

function getProjectSystemAssignedRoomIndices(systemId){
  if(quoteMode === 'proj'){
    return getProjectAssignedRoomIndices();
  }
  var indices = [];
  ensureAllRoomRecordIds();
  for(var i=0;i<hist.length;i++){
    var assignment = getRoomAssignment(i);
    if(assignment.mode === 'project' && assignment.projectSystemId === systemId){
      indices.push(i);
    }
  }
  return indices;
}

function getProjectSystemRequiredBtu(systemId){
  return getProjectSystemAssignedRoomIndices(systemId).reduce(function(sum, idx){
    return sum + getRoomRequiredBtu(idx);
  }, 0);
}

function getProjectSystemRequiredCfm(systemId){
  return getProjectSystemAssignedRoomIndices(systemId).reduce(function(sum, idx){
    return sum + getRoomRequiredCfm(idx);
  }, 0);
}

function assignRoomToProjectSystem(roomIndex, systemId){
  if(roomIndex < 0 || roomIndex >= hist.length) return;
  if(!getProjectSystem(systemId)) return;
  setRoomAssignmentMode(roomIndex, 'project', '', systemId);
}

function clearRoomProjectSystemAssignment(roomIndex){
  if(roomIndex < 0 || roomIndex >= hist.length) return;
  setRoomAssignmentMode(roomIndex, 'project', '', '');
}

function getProjectSystemsSelectedBtu(){
  ensureProjectSystems();
  return projectSystems.reduce(function(sum, system){
    return sum + getSelectedInstalledCapacity(system);
  }, 0);
}

function getProjectSystemsSelectedCfm(){
  ensureProjectSystems();
  return projectSystems.reduce(function(sum, system){
    return sum + (getUnitAirflowCfm(system) * Math.max(1, parseInt(system.qty,10) || 1));
  }, 0);
}

function syncLegacyProjectStateFromSystems(){
  ensureProjectSystems();
  if(!projectSystems.length) return;
  var primarySystem = projectSystems[0] || {};
  projState.sysType = getAllowedSystemType(primarySystem.unitType || projState.sysType || 'split');
  projState.selBtu = Math.max(0, getSelectedUnitCapacityBtu(primarySystem) || getDefaultSystemCapacity(projState.sysType));
  projState.qty = Math.max(1, parseInt(primarySystem.qty,10) || 1);
  projState.qtyAuto = false;
  projState.autoReason = buildAutoQtyReason('manual');
}

function getZoneSelectedBtu(zone){
  zone = typeof zone === 'string' ? getZoneById(zone) : zone;
  if(!zone) return 0;
  return (zone.systems || []).reduce(function(sum, system){
    return sum + getSelectedInstalledCapacity(system);
  }, 0);
}

function getZoneSelectedCfm(zone){
  zone = typeof zone === 'string' ? getZoneById(zone) : zone;
  if(!zone) return 0;
  return (zone.systems || []).reduce(function(sum, system){
    return sum + (getUnitAirflowCfm(system) * Math.max(1, parseInt(system.qty,10)||1));
  }, 0);
}

function getZoneRequiredBtu(zoneId){
  return getZoneRoomIndices(zoneId).reduce(function(sum, idx){
    return sum + getRoomRequiredBtu(idx);
  }, 0);
}

function getZoneRequiredCfm(zoneId){
  return getZoneRoomIndices(zoneId).reduce(function(sum, idx){
    return sum + getRoomRequiredCfm(idx);
  }, 0);
}

function getZoneState(zoneId){
  var zone = getZoneById(zoneId);
  if(!zone) return null;
  var requiredBtu = getZoneRequiredBtu(zoneId);
  var requiredCfm = getZoneRequiredCfm(zoneId);
  var selectedBtu = getZoneSelectedBtu(zone);
  var selectedCfm = getZoneSelectedCfm(zone);
  var status = getProjectCapacityStatus(requiredBtu, selectedBtu);
  return {
    zone: zone,
    roomIndices: getZoneRoomIndices(zoneId),
    requiredBtu: requiredBtu,
    requiredCfm: requiredCfm,
    selectedBtu: selectedBtu,
    selectedCfm: selectedCfm,
    status: status
  };
}

function removeRoomFromAllZones(roomRecordId){
  hvacZones.forEach(function(zone){
    zone.roomIds = (zone.roomIds || []).filter(function(id){ return id !== roomRecordId; });
  });
  hvacZones = hvacZones.filter(function(zone){ return (zone.roomIds || []).length > 0 || (zone.systems || []).length > 0; });
  saveHvacZones();
}

function setRoomAssignmentMode(i, mode, zoneId, projectSystemId){
  if(quoteMode !== 'proj'){
    mode = 'independent';
    zoneId = '';
    projectSystemId = '';
  } else {
    mode = 'project';
    zoneId = '';
    projectSystemId = projectSystemId || '';
  }
  var line = ensureQuoteLine(i);
  line.assignment = normalizeRoomAssignment({ mode: mode, zoneId: zoneId || '', projectSystemId: projectSystemId || '' });
  var roomId = ensureRoomRecordId(i);
  removeRoomFromAllZones(roomId);
  saveHvacZones();
  persistQuoteState();
  recalcProjectTotals();
  renderCalcWorkflowCard();
  renderTechReport();
  renderQuotation();
  renderDesktopInsightPanel();
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
  loadHvacZones();
  loadProjectSystems();
  loadSelectedHvacScenario();
  var _expandedLegacyRooms = expandLegacyMultiRoomRecords();
  if(_expandedLegacyRooms){
    try{ AppStorage.saveHistory(hist, qlines); }catch(e){}
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
  ensureAllRoomRecordIds();
  ensureProjectSystems();
  syncProjectRecommendation({keepSelectedCapacity:true});

  // Initialize UI
  curRoom = null;
  devs = [];
  applyLang();
  setResultsMode(resultsMode);
  arrangeReportAndQuoteLayout();
  syncDesktopWorkflowPlacement();
  applyQSState();
  setQuoteMode(quoteMode);
  renderHist();
  initProjDropdowns();
  updateProjLabels();
  bindUnifiedQtySteppers();

  // Service Worker registration
  if('serviceWorker' in navigator){
    var _host = (location && location.hostname ? location.hostname : '').toLowerCase();
    var _isLocalPreview = _host === '127.0.0.1' || _host === 'localhost' || _host === '::1';
    if(_isLocalPreview){
      navigator.serviceWorker.getRegistrations().then(function(registrations){
        registrations.forEach(function(reg){ reg.unregister(); });
      }).catch(function(e){
        console.warn('SW unregister failed:', e);
      });
    } else {
      navigator.serviceWorker.register('./sw.js').catch(function(e){
        console.warn('SW reg failed:', e);
      });
    }
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
var hvacZones = [];
var projectSystems = [];
var selectedHvacDesignScenario = null;
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
var HVAC_ZONES_KEY = 'acp_hvac_zones_v1';
var HVAC_PROJECT_SYSTEMS_KEY = 'acp_project_systems_v1';
var HVAC_SELECTED_SCENARIO_KEY = 'acp_selected_design_scenario_v1';
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
  saveHvacZones();
  saveProjectSystems();
}
function persistQuoteState(){
  save();
}
function safeUiRender(label, fn){
  try{
    if(typeof fn === 'function') fn();
  }catch(e){
    try{ console.error('[AirCalc UI render error] ' + label, e); }catch(_err){}
  }
}
function rerenderAfterProjectUnitChange(){
  safeUiRender('renderProjBlock', renderProjBlock);
  safeUiRender('renderCalcWorkflowCard', renderCalcWorkflowCard);
  safeUiRender('renderCalcRooms', renderCalcRooms);
  safeUiRender('renderHist', renderHist);
  safeUiRender('renderHomeProjectSummary', renderHomeProjectSummary);
  safeUiRender('renderProjectExplorer', renderProjectExplorer);
  safeUiRender('renderTechReport', renderTechReport);
  safeUiRender('renderQuotation', renderQuotation);
  safeUiRender('renderDesktopInsightPanel', renderDesktopInsightPanel);
  safeUiRender('refreshGrandTotal', refreshGrandTotal);
}
function patchVisibleRoomUnitCards(i){
  if(i == null || i < 0 || i >= hist.length) return;
  var room = hist[i];
  if(!room) return;
  try{
    document.querySelectorAll('.assignment-room-card[data-room-index="'+i+'"]').forEach(function(node){
      node.outerHTML = renderAssignmentRoomCard(i, room);
    });
  }catch(e){
    try{ console.error('[AirCalc UI render error] patch assignment room card', e); }catch(_err){}
  }
  try{
    document.querySelectorAll('.calc-room-row[data-room-index="'+i+'"]').forEach(function(node){
      node.outerHTML = buildRoomWorkflowRow(room, i);
    });
  }catch(e){
    try{ console.error('[AirCalc UI render error] patch calc room row', e); }catch(_err){}
  }
}
var roomUnitRefreshTimers = {};
function rerenderAfterRoomUnitChangeNow(i){
  safeUiRender('renderCalcWorkflowCard', renderCalcWorkflowCard);
  safeUiRender('renderCalcRooms', renderCalcRooms);
  safeUiRender('renderHist', renderHist);
  safeUiRender('renderHomeProjectSummary', renderHomeProjectSummary);
  safeUiRender('renderProjectExplorer', renderProjectExplorer);
  safeUiRender('renderTechReport', renderTechReport);
  safeUiRender('renderQuotation', renderQuotation);
  safeUiRender('renderDesktopInsightPanel', renderDesktopInsightPanel);
  safeUiRender('refreshGrandTotal', refreshGrandTotal);
  safeUiRender('patchVisibleRoomUnitCards', function(){ patchVisibleRoomUnitCards(i); });
}
function rerenderAfterRoomUnitChange(i){
  if(roomUnitRefreshTimers[i]){
    if(typeof roomUnitRefreshTimers[i] === 'object' && typeof roomUnitRefreshTimers[i].cancel === 'function'){
      roomUnitRefreshTimers[i].cancel();
    } else {
      clearTimeout(roomUnitRefreshTimers[i]);
    }
  }
  var commitRoomUnitRender = function(){
    if(roomUnitRefreshTimers[i]) delete roomUnitRefreshTimers[i];
    rerenderAfterRoomUnitChangeNow(i);
  };
  if(typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'){
    var rafA = 0, rafB = 0;
    rafA = window.requestAnimationFrame(function(){
      rafB = window.requestAnimationFrame(commitRoomUnitRender);
    });
    roomUnitRefreshTimers[i] = { cancel: function(){
      try{ window.cancelAnimationFrame(rafA); }catch(_e){}
      try{ window.cancelAnimationFrame(rafB); }catch(_e2){}
    }};
    return;
  }
  roomUnitRefreshTimers[i] = setTimeout(commitRoomUnitRender, 16);
}
function renderTechReport(){
  renderQuote();
  var techProject = G('tech-project');
  var techNo = G('tech-no');
  var techSaveBtn = G('tech-save-btn');
  var techCumSlot = G('tech-cum-slot');
  var techControlsSlot = G('tech-controls-slot');
  var techRoomSlot = G('tech-room-slot');
  var techProjSlot = G('tech-proj-slot');
  if(techProject){ techProject.readOnly = true; techProject.setAttribute('readonly','readonly'); }
  if(techNo){ techNo.readOnly = true; techNo.setAttribute('readonly','readonly'); }
  if(techSaveBtn) techSaveBtn.style.display = 'none';
  if(techCumSlot) techCumSlot.style.display = 'none';
  if(techControlsSlot) techControlsSlot.style.display = 'none';
  if(techRoomSlot) techRoomSlot.style.display = 'none';
  if(techProjSlot) techProjSlot.style.display = 'none';
  enforceTechnicalReportEnglishDigits();
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
function isProjectHvacMode(){
  return normalizeQuoteMode(quoteMode) === 'proj';
}
function ensureExpandedLegacyRoomsLive(){
  var expanded = expandLegacyMultiRoomRecords();
  if(expanded){
    try{ AppStorage.saveHistory(hist, qlines); }catch(e){}
  }
  return expanded;
}
function refreshModeDependentUi(){
  ensureExpandedLegacyRoomsLive();
  syncAllRoomSystemStates();
  if(typeof recalcProjectTotals === 'function') recalcProjectTotals();
  if(isProjectHvacMode() && getProjectQtyAuto()){
    syncProjectRecommendation({keepSelectedCapacity:true});
  }
  renderHist();
  if(isProjectHvacMode()){
    renderProjBlock();
  }
  updateQuoteModeAuxVisibility();
  applyLang();
  updateDirectResults();
  if(typeof renderHomeProjectSummary === 'function') renderHomeProjectSummary();
  if(typeof renderDesktopInsightPanel === 'function') renderDesktopInsightPanel();
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
    renderHomeProjectSummary();
    return;
  }
  if(resultsMode === 'total'){
    var selectedSummary = getActiveSelectedEquipmentSummary();
    var totTR=0,totCFM=0,totBTU=0;
    hist.forEach(function(h){
      var rc=Math.max(1,parseInt(h.roomCount,10)||1);
      totTR += (parseFloat(h.tr)||0) * rc;
      totCFM += (parseInt(h.cfm,10)||0) * rc;
      totBTU += (parseInt(h.btu,10)||0) * rc;
    });
    flash('vtr',totTR.toFixed(2));
    flash('vcfm',totCFM.toLocaleString());
    flash('vbtu',totBTU.toLocaleString());
    flash('vmkt',Math.round(selectedSummary.btu || 0).toLocaleString());
    renderHomeProjectSummary();
    return;
  }
  var h = hist[hist.length-1];
  if(!h) return;
  var activeSummary = getActiveSelectedEquipmentSummary();
  flash('vtr',Number(h.tr||0).toFixed(2));
  flash('vcfm',Number(h.cfm||0).toLocaleString());
  flash('vbtu',Number(h.btu||0).toLocaleString());
  flash('vmkt',Math.round(activeSummary.btu || 0).toLocaleString());
  renderHomeProjectSummary();
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
      qexport:'تصدير عرض السعر (CSV)',qdel:'🗑️ تم الحذف',qsttl:'⚙️ إعدادات عرض السعر',qsinst:'نسبة التركيب',qsvat:'تفعيل ضريبة القيمة المضافة',qsvalid:'مدة صلاحية العرض',qsnotes:'ملاحظات',qsnph:'مثال: العرض شامل التوريد والتركيب داخل المدينة.',v7:'7 أيام',v14:'14 يوم',v30:'30 يوم',qssubl:'المجموع الفرعي (المعدات)',qsinstl:'التركيب',qsvatl:'ضريبة القيمة المضافة 15%',qsqtyl:'إجمالي الكمية',qsave:'حفظ العرض',qsaveok:'تم حفظ عرض السعر',qsavewarn:'افتح أو احفظ مشروعًا أولًا',expcsv:'CSV',exphtml:'فاتورة HTML',exppdf:'PDF عرض السعر',exptechpdf:'تقرير فني',invtitle:'فاتورة / عرض سعر',invvalid:'صلاحية العرض',invdate:'التاريخ',invnotes:'ملاحظات',invroom:'نوع الغرفة',invvol:'الحجم',invppl:'أشخاص',invtr:'TR',invcfm:'CFM',invbtu:'BTU/h',invmkt:'Mkt BTU',invqty:'الكمية',invup:'سعر الوحدة',invlt:'إجمالي السطر',invsubt:'المجموع الفرعي',invinst:'التركيب',invvat:'ضريبة 15%',invgrand:'الإجمالي النهائي',invdiscl:'تقدير أولي — لا يُعتمد للتصميم النهائي'},
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
      lvol:'Calculated Volume (m³)',llen:'Length (m)',lwidth:'Width (m)',lheight:'Height (m)',ltype:'Room Type',lroomcount:'Room Count',lloadfactor:'Load Factor',lloadfactorval:'Current Value',lppl:'People Count',ladd:'+ Add Device',
      lmodal:'Select Device Type',ldtot:'Total Device Load',sroom:'ROOM',sdev:'DEVICES',
      bvol:'Room Volume',bbase:'Base Load',bppl:'People Load',bdev:'Device Load',bsub:'Sub-total',bsf:'+ Safety 10%',
      hempty:'No calculations yet',
      qempty:'No rooms — calculate a room first',
      cur:'﷼',dempty:'No devices — tap + to add',
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
      qexport:'Export Quotation (CSV)',qdel:'🗑️ Deleted',qsttl:'⚙️ Quotation Settings',qsinst:'Installation %',qsvat:'Enable VAT',qsvalid:'Quotation Validity',qsnotes:'Notes',qsnph:'Example: Price includes supply & installation within city limits.',v7:'7 days',v14:'14 days',v30:'30 days',qssubl:'Equipment Subtotal',qsinstl:'Installation',qsvatl:'VAT 15%',qsqtyl:'Total Quantity',qsave:'Save Quotation',qsaveok:'Quotation saved',qsavewarn:'Open or save a project first',expcsv:'CSV',exphtml:'Invoice HTML',exppdf:'Quotation PDF',exptechpdf:'Tech Report',invtitle:'Quotation / Invoice',invvalid:'Validity',invdate:'Date',invnotes:'Notes',invroom:'Room Type',invvol:'Volume m³',invppl:'Persons',invtr:'TR',invcfm:'CFM',invbtu:'BTU/h',invmkt:'Mkt BTU',invqty:'Qty',invup:'Unit Price',invlt:'Line Total',invsubt:'Equipment Subtotal',invinst:'Installation',invvat:'VAT 15%',invgrand:'Grand Total',invdiscl:'Preliminary estimate — not for final design submittal'}
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
  cmrot:'وضع الحساب: تقدير المدينة',
  cmhcsub:'معايير ASHRAE محفوظة لهذه الغرفة — لا يتم استبدال تهوية ASHRAE بعوامل التقدير العامة.',
  cmrotsub:'تقدير المدينة والعزل والنوافذ والإشغال مستخدم لهذه الغرفة قبل تنفيذ الحساب.',
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
  authsigninunlock:'تسجيل الدخول / تفعيل PRO مجانًا',
  authgueststatus:'سجّل الدخول لتفعيل PRO مجانًا',
  authearlypro:'وصول مبكر PRO',
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
  authcloudreq:'يتطلب تسجيل الدخول للوصول إلى مزايا PRO والحفظ السحابي',
  authmodeanon:'يمكنك استخدام التطبيق بدون تسجيل دخول',
  authtrialfree:'ميزات Pro مجانية خلال الفترة التجريبية.',
  authearlypromsg:'ميزات PRO مجانية خلال الوصول المبكر.',
  authloggedin:'تم تسجيل الدخول باسم',
  authfullname_req:'الاسم الكامل مطلوب',
  authemail_invalid:'أدخل بريدًا إلكترونيًا صحيحًا',
  authpassword_min:'كلمة المرور يجب ألا تقل عن 8 أحرف',
  authconfirm_mismatch:'تأكيد كلمة المرور غير مطابق',
  authfirebase_unavailable:'تعذّر الاتصال بخدمة الحساب الآن',
  authoffline:'أنت غير متصل حاليًا — يمكن استخدام التطبيق محليًا',
  authcloudcoming:'الحفظ السحابي قادم قريبًا',
  lcity:'المدينة',
  lcityfactor:'معامل المدينة',
  lcustomfactor:'تخصيص المعامل',
  lcustomfactorval:'القيمة المخصصة',
  lfactordefault:'افتراضي',
  lfactorcustom:'مخصص',
  ladvanced:'مدخلات متقدمة',
  loccupancy:'نوع الإشغال',
  lwindowarea:'مساحة النوافذ (م²)',
  lexposure:'نوع التعرض',
  linsulation:'نوع الجدار / العزل',
  lexpshaded:'مظلل',
  lexpdirect:'شمس مباشرة',
  linsulexcellent:'عزل ممتاز',
  linsulmedium:'عزل متوسط',
  linsulnone:'بدون عزل',
  peopleautohelper:'تم تقدير عدد الأشخاص تلقائيًا حسب المساحة، ويمكن تعديله يدويًا.',
  occmanual:'تم تعديل عدد الأشخاص يدويًا',
  bwindow:'حمل النوافذ',
  bwindowarea:'مساحة النوافذ',
  bcity:'المدينة',
  bcityfactor:'معامل المدينة',
  binsulation:'نوع العزل',
  binsulationm:'معامل العزل',
  bpeoplecount:'عدد الأشخاص',
  healthcaremode:'وضع صحي (ASHRAE)',
  mixedsystems:'',
  mixedadd:'إضافة وحدة',
  mixedtype:'نوع النظام',
  mixedcapacity:'السعة',
  mixedqty:'عدد الوحدات',
  mixedunitprice:'سعر الوحدة',
  mixedlinetotal:'إجمالي السطر',
  mixedtotalcapacity:'إجمالي السعة',
  mixedrequiredcapacity:'السعة المطلوبة',
  mixeddifference:'الفرق',
  mixedremove:'حذف',
  mixedclear:'مسح الأنظمة',
  mixedempty:'لا توجد أنظمة مضافة حتى الآن',
  mixedselectedtotal:'إجمالي السعة المختارة',
  mixedmatched:'مطابقة',
  mixedundersized:'الأنظمة المختارة أقل من الحمل المطلوب',
  mixedoversized:'الأنظمة المختارة أعلى من الحمل المطلوب',
  smartsuggestions:'الاقتراحات الذكية',
  suggestionapply:'تطبيق الاقتراح',
  suggestionstatus:'الحالة',
  suggestiontotal:'إجمالي السعة',
  suggestiondifference:'الفرق',
  suggestionempty:'لا توجد اقتراحات مناسبة لهذه الغرفة حاليًا'
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
  cmrot:'Calculation Mode: City Estimate',
  cmhcsub:'ASHRAE standards are preserved for this room — ventilation is not replaced by general estimate inputs.',
  cmrotsub:'City factor, insulation, windows, and occupancy are used for this room before calculation.',
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
  authsigninunlock:'Sign in / Unlock PRO for Free',
  authgueststatus:'Sign in to unlock PRO for free',
  authearlypro:'PRO Early Access',
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
  authcloudreq:'Login required for PRO features and cloud saving',
  authmodeanon:'You can use the app without signing in',
  authtrialfree:'Pro features are free during the trial period.',
  authearlypromsg:'PRO features are free during Early Access.',
  authloggedin:'Signed in as',
  authfullname_req:'Full name is required',
  authemail_invalid:'Enter a valid email address',
  authpassword_min:'Password must be at least 8 characters',
  authconfirm_mismatch:'Confirm password does not match',
  authfirebase_unavailable:'Account service is unavailable right now',
  authoffline:'You appear to be offline — local calculator remains available',
  authcloudcoming:'Cloud saving is coming soon',
  lcity:'City',
  lcityfactor:'City Factor',
  lcustomfactor:'Customize Factor',
  lcustomfactorval:'Custom Value',
  lfactordefault:'Default',
  lfactorcustom:'Custom',
  ladvanced:'Advanced Inputs',
  loccupancy:'Occupancy Type',
  lwindowarea:'Window Area (m²)',
  lexposure:'Exposure Type',
  linsulation:'Wall / Insulation Type',
  lexpshaded:'Shaded',
  lexpdirect:'Direct Sun',
  linsulexcellent:'Excellent insulation',
  linsulmedium:'Medium insulation',
  linsulnone:'No insulation',
  peopleautohelper:'People count is estimated automatically based on area and can be edited manually.',
  occmanual:'People count manually overridden',
  bwindow:'Window Load',
  bwindowarea:'Window Area',
  bcity:'City',
  bcityfactor:'City Factor',
  binsulation:'Insulation Type',
  binsulationm:'Insulation Multiplier',
  bpeoplecount:'People Count',
  healthcaremode:'Healthcare Mode (ASHRAE)',
  mixedsystems:'',
  mixedadd:'Add Unit',
  mixedtype:'System Type',
  mixedcapacity:'Capacity',
  mixedqty:'Unit Qty',
  mixedunitprice:'Unit Price',
  mixedlinetotal:'Line Total',
  mixedtotalcapacity:'Total Capacity',
  mixedrequiredcapacity:'Required Capacity',
  mixeddifference:'Difference',
  mixedremove:'Remove',
  mixedclear:'Clear Systems',
  mixedempty:'No systems added yet',
  mixedselectedtotal:'Total Selected Capacity',
  mixedmatched:'Capacity matched',
  mixedundersized:'Selected systems are undersized',
  mixedoversized:'Selected systems are oversized',
  smartsuggestions:'Smart Unit Suggestions',
  suggestionapply:'Apply Suggestion',
  suggestionstatus:'Status',
  suggestiontotal:'Total Capacity',
  suggestiondifference:'Difference',
  suggestionempty:'No suitable suggestions available for this room yet'
});
function t(k){ return T[lang][k]||k; }

function createQuoteSystemId(){
  return 'sys_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}
function toSystemBtu(value){
  return parseInt(String(value == null ? '' : value).replace(/[^0-9.-]/g,''), 10) || 0;
}
function getAllowedSystemType(unitType){
  return MIXED_SYSTEM_TYPES.indexOf(unitType) >= 0 ? unitType : 'split';
}
function getWorkflowSystemTypeKeys(){
  var keys = Object.keys(UT_TO_CAT || {});
  if(!keys.length) keys = ['split','package','vrf','ahu','fcu','ducted','cassette','window','floor'];
  return keys.filter(function(key, idx){
    return !!key && keys.indexOf(key) === idx;
  });
}
function getDefaultSystemCapacity(unitType){
  var catalog = getCatalog(getAllowedSystemType(unitType));
  return catalog && catalog.length ? (parseInt(catalog[0].btu, 10) || 0) : 0;
}
function normalizeQuoteSystem(item){
  var row = item && typeof item === 'object' ? item : {};
  var unitType = getAllowedSystemType(row.unitType);
  var catalog = getCatalog(unitType);
  var validBtus = catalog.map(function(entry){ return toSystemBtu(entry.btu); });
  var selectedBtu = toSystemBtu(row.selectedBtu);
  var hasEquipmentSnapshot = !!(row.equipmentDatabaseId || row.equipmentSnapshot || row.manualCapacity);
  var preserveAirflowOnlyConcept = row.selectionMode === 'conceptual' && unitType === 'ahu' && !selectedBtu;
  if(!preserveAirflowOnlyConcept && (!selectedBtu || (!hasEquipmentSnapshot && validBtus.indexOf(selectedBtu) < 0))){
    selectedBtu = getDefaultSystemCapacity(unitType);
  }
  return {
    id: row.id || createQuoteSystemId(),
    unitType: unitType,
    selectedBtu: selectedBtu,
    qty: Math.max(1, parseInt(row.qty, 10) || 1),
    equipmentId: row.equipmentId || row.equipmentDatabaseId || '',
    equipmentDatabaseId: row.equipmentDatabaseId || '',
    equipmentSnapshot: row.equipmentSnapshot || null,
    manualCapacity: row.manualCapacity === true,
    manualCapacityBtuH: toSystemBtu(row.manualCapacityBtuH || (row.manualCapacity === true ? selectedBtu : 0)),
    selectionMode: row.selectionMode || (row.equipmentDatabaseId ? 'database' : (row.manualCapacity === true ? 'manual' : 'none')),
    selectedEquipmentOption: row.selectedEquipmentOption || null,
    equipmentReviewStatus: row.equipmentReviewStatus || '',
    selectedEquipmentId: row.selectedEquipmentId || row.equipmentId || row.equipmentDatabaseId || '',
    selectedManufacturer: row.selectedManufacturer || '',
    selectedModel: row.selectedModel || '',
    selectedCapacityBtuH: toSystemBtu(row.selectedCapacityBtuH || selectedBtu),
    selectedCapacityTr: Number(row.selectedCapacityTr || (selectedBtu / 12000) || 0),
    selectedAirflowCfm: Math.max(0, parseInt(row.selectedAirflowCfm, 10) || 0),
    selectedQuantity: Math.max(1, parseInt(row.selectedQuantity || row.qty, 10) || 1),
    totalInstalledCapacityBtuH: Math.max(0, toSystemBtu(row.totalInstalledCapacityBtuH || (selectedBtu * Math.max(1, parseInt(row.qty, 10) || 1)))),
    totalInstalledAirflowCfm: Math.max(0, parseInt(row.totalInstalledAirflowCfm, 10) || 0),
    automaticSelectionReason: row.automaticSelectionReason || row.autoReason || '',
    scenarioStatus: row.scenarioStatus || '',
    conceptualScenarioSnapshot: row.conceptualScenarioSnapshot || null,
    conceptualCapacityBtuH: Math.max(0, toSystemBtu(row.conceptualCapacityBtuH || 0)),
    finalEquipmentCapacityBtuH: Math.max(0, toSystemBtu(row.finalEquipmentCapacityBtuH || row.selectedCapacityBtuH || 0)),
    quotationDraft: row.quotationDraft && typeof row.quotationDraft === 'object' ? row.quotationDraft : null
  };
}
function ensureRoomSystems(i){
  var line = ensureQuoteLine(i);
  if(!Array.isArray(line.systems)) line.systems = [];
  var used = {};
  line.systems = line.systems.map(function(system){
    var normalized = normalizeQuoteSystem(system);
    if(!normalized.id || used[normalized.id]){
      normalized.id = createQuoteSystemId();
    }
    used[normalized.id] = true;
    return normalized;
  });
  return line.systems;
}
function getQuoteSystems(i){
  var line = ensureQuoteLine(i);
  line.systems = ensureRoomSystems(i);
  if(!line.systemPrices || typeof line.systemPrices !== 'object') line.systemPrices = {};
  if(!line.systemPricing || typeof line.systemPricing !== 'object') line.systemPricing = line.systemPrices;
  return line.systems;
}
function getRoomSystemPricingMap(i){
  var line = ensureQuoteLine(i);
  if(!line.systemPrices || typeof line.systemPrices !== 'object') line.systemPrices = {};
  if(line.systemPricing && typeof line.systemPricing === 'object'){
    Object.keys(line.systemPricing).forEach(function(key){
      if(line.systemPrices[key] === undefined) line.systemPrices[key] = line.systemPricing[key];
    });
  }
  line.systemPricing = line.systemPrices;
  return line.systemPrices;
}
function getRoomSystemUnitPrice(i, systemId){
  var pricing = getRoomSystemPricingMap(i);
  var entry = pricing[systemId];
  var raw = (entry && typeof entry === 'object') ? entry.unitPrice : entry;
  return Math.max(0, parseFloat(raw) || 0);
}
function getRoomSystemDraft(i){
  if(!roomSystemDrafts[i]){
    roomSystemDrafts[i] = {
      unitType:'split',
      selectedBtu:getDefaultSystemCapacity('split'),
      qty:1
    };
  }
  var draft = roomSystemDrafts[i];
  draft.unitType = getAllowedSystemType(draft.unitType);
  var draftCatalog = getCatalog(draft.unitType);
  var validBtus = draftCatalog.map(function(entry){ return parseInt(entry.btu, 10) || 0; });
  var draftBtu = parseInt(draft.selectedBtu, 10) || 0;
  if(!draftBtu || validBtus.indexOf(draftBtu) < 0){
    draft.selectedBtu = getDefaultSystemCapacity(draft.unitType);
  }
  draft.qty = Math.max(1, parseInt(draft.qty, 10) || 1);
  return draft;
}
function updateRoomSystemDraft(i, field, value){
  var draft = getRoomSystemDraft(i);
  if(field === 'unitType'){
    draft.unitType = getAllowedSystemType(value);
    draft.selectedBtu = getDefaultSystemCapacity(draft.unitType);
  } else if(field === 'selectedBtu'){
    draft.selectedBtu = parseInt(value, 10) || getDefaultSystemCapacity(draft.unitType);
  } else if(field === 'qty'){
    draft.qty = Math.max(1, parseInt(value, 10) || 1);
  }
  renderQuote();
}
function getQuoteSystemIndex(i, systemId){
  var systems = ensureRoomSystems(i);
  for(var si=0;si<systems.length;si++){
    if(systems[si] && systems[si].id === systemId) return si;
  }
  return -1;
}
function getQuoteSystemLineTotal(i, system){
  if(!system) return 0;
  return Math.max(1, parseInt(system.qty, 10) || 1) * getRoomSystemUnitPrice(i, system.id);
}
function getRoomSystemsSelectedCapacity(i){
  return ensureRoomSystems(i).reduce(function(sum, system){
    return sum + getSelectedInstalledCapacity(system);
  }, 0);
}
function getRoomSystemsSubtotal(i){
  var subtotal = 0;
  getQuoteSystems(i).forEach(function(system){
    subtotal += getQuoteSystemLineTotal(i, system);
  });
  return subtotal;
}
function getRoomSystemsQty(i){
  var qty = 0;
  getQuoteSystems(i).forEach(function(system){
    qty += Math.max(1, parseInt(system.qty, 10) || 1);
  });
  return qty;
}
function hasRoomSystems(i){
  return getQuoteSystems(i).length > 0;
}
function getRoomRequiredBtu(i){
  var room = hist[i] || {};
  return parseInt(room.finalBtu || room.requiredBtu || room.btu, 10) || 0;
}
function getRoomRequiredCfm(i){
  var room = hist[i] || {};
  return Math.max(0, parseInt(room.requiredCfm || room.cfm, 10) || 0);
}
function getUnitAirflowCfm(system){
  var perf = getInstalledEquipmentPerformance(system);
  return perf.unitAirflowCfm;
}
function getInstalledEquipmentPerformance(system){
  if(!system){
    return {
      unitCapacityBtuH: 0,
      quantity: 1,
      totalCapacityBtuH: 0,
      unitAirflowCfm: 0,
      totalAirflowCfm: 0,
      equipmentId: '',
      manufacturer: '',
      model: '',
      selectionMode: 'none'
    };
  }
  var qty = Math.max(1, parseInt(system.qty, 10) || 1);
  var option = system.selectedEquipmentOption || (system.equipmentSnapshot && system.equipmentSnapshot.selectionOption) || null;
  var record = system.equipmentSnapshot && system.equipmentSnapshot.record ? system.equipmentSnapshot.record : null;
  var unitCapacity = 0;
  var unitCfm = 0;
  if(option && option.totalAirflowCfm != null && option.quantity){
    unitCfm = Math.round((parseFloat(option.totalAirflowCfm) || 0) / Math.max(1, parseInt(option.quantity, 10) || 1));
  }
  if(record){
    unitCapacity = Math.max(0, toSystemBtu(record.coolingCapacityBtuH || 0));
    if(!unitCfm){
      var recordCfm = parseFloat(record.airflowNominalCfm || record.airflowMaxCfm || record.airflowMinCfm) || 0;
      if(recordCfm > 0) unitCfm = Math.round(recordCfm);
    }
  }
  if(!unitCapacity) unitCapacity = getSelectedUnitCapacityBtu(system);
  if(unitCapacity <= 0){
    return {
      unitCapacityBtuH: 0,
      quantity: qty,
      totalCapacityBtuH: 0,
      unitAirflowCfm: unitCfm,
      totalAirflowCfm: unitCfm * qty,
      equipmentId: system.equipmentId || system.equipmentDatabaseId || '',
      manufacturer: record ? (record.manufacturerName || record.brand || '') : '',
      model: record ? (record.exactModelNumber || record.series || '') : '',
      selectionMode: system.selectionMode || 'none'
    };
  }
  if(!unitCfm){
    var selectedBtu = toSystemBtu(unitCapacity);
    var unitType = getAllowedSystemType(system.unitType);
    var cfmPerTr = getCurrentCfmPerTr();
    var resolved = getDuctCfm(unitType, selectedBtu, 0, cfmPerTr);
    unitCfm = Math.max(0, parseInt(resolved.cfm, 10) || 0);
  }
  return {
    unitCapacityBtuH: unitCapacity,
    quantity: qty,
    totalCapacityBtuH: unitCapacity * qty,
    unitAirflowCfm: unitCfm,
    totalAirflowCfm: unitCfm * qty,
    equipmentId: system.equipmentId || system.equipmentDatabaseId || (record && record.id) || '',
    manufacturer: record ? (record.manufacturerName || record.brand || '') : (system.selectedManufacturer || ''),
    model: record ? (record.exactModelNumber || record.series || '') : (system.selectedModel || ''),
    selectionMode: system.selectionMode || (record ? 'database' : 'none')
  };
}
function getEstimatedUnitAirflowCfm(system){
  system = system || {};
  var selectedBtu = toSystemBtu(system.selectedBtu);
  if(selectedBtu <= 0) return 0;
  var unitType = getAllowedSystemType(system.unitType);
  var cfmPerTr = getCurrentCfmPerTr();
  var resolved = getDuctCfm(unitType, selectedBtu, 0, cfmPerTr);
  return Math.max(0, parseInt(resolved.cfm, 10) || 0);
}
function getSelectedUnitCapacityBtu(system){
  system = system || {};
  var snapshot = system.equipmentSnapshot || null;
  var record = snapshot && snapshot.record ? snapshot.record : null;
  if(system.selectionMode === 'database' || system.equipmentDatabaseId || record){
    return Math.max(0, toSystemBtu((record && record.coolingCapacityBtuH) || system.selectedBtu));
  }
  if(system.selectionMode === 'manual' || system.manualCapacity){
    return Math.max(0, toSystemBtu(system.manualCapacityBtuH || system.selectedBtu));
  }
  return Math.max(0, toSystemBtu(system.selectedBtu));
}
function getSelectedInstalledCapacity(system){
  return getInstalledEquipmentPerformance(system).totalCapacityBtuH;
}
function getCurrentCfmPerTr(){
  if(projState && projState.cfmPerTr){
    return parseInt(projState.cfmPerTr, 10) || 400;
  }
  if(bundleConfig && bundleConfig.cfmPerTr){
    return parseInt(bundleConfig.cfmPerTr, 10) || 400;
  }
  return 400;
}
function getSelectedSystemsAirflowCfm(i){
  return ensureRoomSystems(i).reduce(function(sum, system){
    return sum + (getUnitAirflowCfm(system) * Math.max(1, parseInt(system.qty, 10) || 1));
  }, 0);
}
function getRoomQuoteSubtotal(i){
  var assignment = getRoomAssignment(i);
  if(assignment.mode !== 'independent') return 0;
  return hasRoomSystems(i) ? getRoomSystemsSubtotal(i) : (getQty(i) * getUP(i));
}
function getRoomQuoteTotalQty(i){
  var assignment = getRoomAssignment(i);
  if(assignment.mode !== 'independent') return 0;
  return hasRoomSystems(i) ? getRoomSystemsQty(i) : getQty(i);
}
function getRoomModeQuoteTotals(){
  var totalQty = 0, subtotal = 0;
  syncAllRoomSystemStates();
  for(var i=0;i<hist.length;i++){
    totalQty += getRoomQuoteTotalQty(i);
    subtotal += getRoomQuoteSubtotal(i);
  }
  if(isProjectHvacMode()){
    var pQty = Math.max(1, parseInt((G('proj-qty')||{value:projState.qty||'1'}).value,10) || projState.qty || 1);
    var pUP = parseFloat((G('proj-up')||{value:projState.up || '0'}).value) || projState.up || 0;
    totalQty += pQty;
    subtotal += pQty * pUP;
  }
  return { totalQty: totalQty, subtotal: subtotal };
}
function getEngineeringValidationThresholds(){
  var engine = window.AirCalcEngineering;
  return (engine && engine.VALIDATION_THRESHOLDS) || {
    MATCH_MAX_OVERSIZE_PCT: 10,
    CAPACITY_REVIEW_MAX_OVERSIZE_PCT: 20,
    GENERAL_OVERSIZE_HIGH_PCT: 25,
    DUCT_SUPPLY_PASS_MAX_FPM: 1200,
    DUCT_RETURN_PASS_MAX_FPM: 1000,
    DUCT_REVIEW_MAX_FPM: 1400,
    ESP_LOW_MAX_PA: 125,
    ESP_VALIDATION_REVIEW_MAX_PA: 225,
    ESP_SUMMARY_MEDIUM_MAX_PA: 225
  };
}
function getCapacityStatus(requiredBtu, selectedCapacityBtu){
  var thresholds = getEngineeringValidationThresholds();
  requiredBtu = Math.max(0, parseInt(requiredBtu, 10) || 0);
  selectedCapacityBtu = Math.max(0, parseInt(selectedCapacityBtu, 10) || 0);
  if(selectedCapacityBtu <= 0){
    return {
      key:'no_system_selected',
      delta:0,
      deltaText:'0.0%',
      label:lang==='ar' ? 'لم يتم اختيار وحدات تكييف بعد' : 'No HVAC systems selected yet',
      css:'pending'
    };
  }
  if(requiredBtu <= 0){
    return {
      key:'matched',
      delta:0,
      deltaText:'0.0%',
      label:lang==='ar' ? 'السعة المختارة مناسبة' : 'Selected capacity is suitable',
      css:'matched'
    };
  }
  var raw = ((selectedCapacityBtu - requiredBtu) / requiredBtu) * 100;
  var rounded = Math.round(raw * 10) / 10;
  var deltaText = (rounded >= 0 ? '+' : '') + rounded.toFixed(1) + '%';
  if(raw < 0){
    return {
      key:'undersized',
      delta:rounded,
      deltaText:deltaText,
      label:lang==='ar' ? 'السعة المختارة أقل من المطلوب' : 'Selected capacity is below required load',
      css:'deficit-mild'
    };
  }
  if(raw <= thresholds.MATCH_MAX_OVERSIZE_PCT){
    return {
      key:'matched',
      delta:rounded,
      deltaText:deltaText,
      label:lang==='ar' ? 'السعة المختارة مناسبة' : 'Selected capacity is suitable',
      css:'matched'
    };
  }
  return {
    key:'oversized',
    delta:rounded,
    deltaText:deltaText,
    label:lang==='ar' ? 'السعة المختارة أعلى من المطلوب' : 'Selected capacity is higher than required load',
    css:raw <= thresholds.GENERAL_OVERSIZE_HIGH_PCT ? 'oversize-ok' : 'oversize-high'
  };
}
function getProjectCapacityStatus(requiredBtu, selectedCapacityBtu){
  var thresholds = getEngineeringValidationThresholds();
  requiredBtu = Math.max(0, parseInt(requiredBtu, 10) || 0);
  selectedCapacityBtu = Math.max(0, parseInt(selectedCapacityBtu, 10) || 0);
  var difference = selectedCapacityBtu - requiredBtu;
  var percent = requiredBtu > 0 ? (difference / requiredBtu) * 100 : 0;
  var percentRounded = Math.round(percent * 10) / 10;
  var percentText = (percentRounded >= 0 ? '+' : '') + percentRounded.toFixed(1) + '%';
  if(selectedCapacityBtu <= 0){
    return {
      key:'no_system_selected',
      difference: difference,
      percent: percentRounded,
      percentText: percentText,
      label:lang==='ar' ? 'لم يتم اختيار وحدات تكييف بعد' : 'No HVAC systems selected yet',
      css:'pending'
    };
  }
  if(requiredBtu <= 0){
    return {
      key:'matched',
      difference: difference,
      percent: percentRounded,
      percentText: percentText,
      label:lang==='ar' ? 'السعة المختارة مناسبة' : 'Selected capacity is suitable',
      css:'matched'
    };
  }
  if(selectedCapacityBtu < requiredBtu){
    return {
      key:'undersized',
      difference: difference,
      percent: percentRounded,
      percentText: percentText,
      label:lang==='ar' ? 'السعة المختارة أقل من المطلوب بنسبة ' + Math.abs(percentRounded).toFixed(1) + '%' : 'Selected capacity is ' + Math.abs(percentRounded).toFixed(1) + '% below required load',
      css:percentRounded <= -15 ? 'deficit-severe' : 'deficit-mild'
    };
  }
  if(percent <= thresholds.MATCH_MAX_OVERSIZE_PCT){
    return {
      key:'matched',
      difference: difference,
      percent: percentRounded,
      percentText: percentText,
      label:lang==='ar' ? 'السعة المختارة مناسبة' : 'Selected capacity is suitable',
      css:'matched'
    };
  }
  return {
    key:'oversized',
    difference: difference,
    percent: percentRounded,
    percentText: percentText,
    label:lang==='ar' ? 'السعة المختارة أعلى من المطلوب بنسبة ' + percentRounded.toFixed(1) + '%' : 'Selected capacity is ' + percentRounded.toFixed(1) + '% above required load',
    css:'oversize-high'
  };
}
function getSystemCapacityStatus(requiredBtu, selectedCapacityBtu){
  return getCapacityStatus(requiredBtu, selectedCapacityBtu);
}
function getAirflowStatus(requiredCfm, selectedCfm){
  var thresholds = getEngineeringValidationThresholds();
  requiredCfm = Math.max(0, parseInt(requiredCfm, 10) || 0);
  selectedCfm = Math.max(0, parseInt(selectedCfm, 10) || 0);
  if(selectedCfm <= 0){
    return {
      key:'no_system_selected',
      delta:0,
      deltaText:'',
      label:lang==='ar' ? 'لم يتم اختيار وحدات تكييف بعد' : 'No HVAC systems selected yet',
      css:'deficit-mild'
    };
  }
  if(requiredCfm <= 0){
    return {
      key:'matched',
      delta:0,
      deltaText:'',
      label:lang==='ar' ? 'تدفق الهواء المختار مناسب' : 'Selected airflow is suitable',
      css:'matched'
    };
  }
  var raw = ((selectedCfm - requiredCfm) / requiredCfm) * 100;
  var rounded = Math.round(raw * 10) / 10;
  var deltaText = (rounded >= 0 ? '+' : '') + rounded.toFixed(1) + '%';
  if(selectedCfm < requiredCfm){
    return {
      key:'undersized',
      delta:rounded,
      deltaText:deltaText,
      label:lang==='ar' ? 'تدفق الهواء المختار أقل من المطلوب' : 'Selected airflow is below required airflow',
      css:'deficit-mild'
    };
  }
  if(raw <= thresholds.MATCH_MAX_OVERSIZE_PCT){
    return {
      key:'matched',
      delta:rounded,
      deltaText:deltaText,
      label:lang==='ar' ? 'تدفق الهواء المختار مناسب' : 'Selected airflow is suitable',
      css:'matched'
    };
  }
  return {
    key:'oversized',
    delta:rounded,
    deltaText:deltaText,
    label:lang==='ar' ? 'تدفق الهواء المختار أعلى من المطلوب' : 'Selected airflow is higher than required airflow',
    css:raw <= thresholds.GENERAL_OVERSIZE_HIGH_PCT ? 'oversize-ok' : 'oversize-high'
  };
}
function getCalculationLevelMeta(isAr){
  return {
    badge: isAr ? 'مستوى الحساب: تقديري مبدئي' : 'Calculation Level: Preliminary',
    disclaimer: isAr
      ? 'هذه النتائج تقديرية ومسترشدة بالمراجع الهندسية ولا تغني عن التصميم التفصيلي أو اعتماد المهندس المختص.'
      : 'These results are preliminary and guided by engineering references. They do not replace detailed design or professional approval.',
    reportDisclaimer: isAr
      ? 'لا يعتبر هذا التقرير اعتمادًا نهائيًا للتصميم، ويجب مراجعته من مهندس مختص قبل التنفيذ.'
      : 'This report is not a final design approval and must be reviewed by a qualified engineer before implementation.'
  };
}
function getValidationStatusMeta(key){
  var isAr = lang === 'ar';
  var map = {
    pass: {
      label: isAr ? 'مطابق' : 'Pass',
      css: 'pass'
    },
    warning: {
      label: isAr ? 'يحتاج مراجعة' : 'Review',
      css: 'warning'
    },
    fail: {
      label: isAr ? 'غير مطابق' : 'Fail',
      css: 'fail'
    },
    not_applicable: {
      label: isAr ? 'غير منطبق' : 'N/A',
      css: 'not-applicable'
    }
  };
  return map[key] || map.not_applicable;
}
function buildValidationItem(title, statusKey, detail, values){
  return {
    title: title,
    status: statusKey,
    detail: detail || '',
    values: Array.isArray(values) ? values.filter(Boolean) : [],
    action: null,
    meta: getValidationStatusMeta(statusKey)
  };
}
function buildValidationValue(labelAr, labelEn, value){
  return {
    label: lang === 'ar' ? labelAr : labelEn,
    value: value
  };
}
function getValidationStatusIcon(statusKey){
  if(statusKey === 'pass') return '✓';
  if(statusKey === 'warning') return '!';
  if(statusKey === 'fail') return '×';
  return '–';
}
function buildValidationAction(text, applyFix){
  return {
    label: lang === 'ar' ? 'الإجراء المقترح' : 'Recommended Action',
    text: text || '',
    applyFix: applyFix || null
  };
}
function attachValidationAction(item, action){
  if(item) item.action = action || null;
  return item;
}
function getCapacityValidationAction(requiredBtu, selectedBtu, unitCapacity, quantity, scope, targetId){
  var thresholds = getEngineeringValidationThresholds();
  requiredBtu = Math.max(0, parseInt(requiredBtu, 10) || 0);
  selectedBtu = Math.max(0, parseInt(selectedBtu, 10) || 0);
  unitCapacity = Math.max(0, parseInt(unitCapacity, 10) || 0);
  quantity = Math.max(1, parseInt(quantity, 10) || 1);
  if(requiredBtu <= 0 || selectedBtu <= 0){
    return buildValidationAction(lang === 'ar' ? 'لا توجد بيانات كافية لتحديد إجراء تصحيحي.' : 'Not enough data to suggest a corrective action.');
  }
  if(selectedBtu < requiredBtu){
    var suggestedQty = unitCapacity > 0 ? Math.ceil(requiredBtu / unitCapacity) : 0;
    var correctedBtu = suggestedQty > 0 ? suggestedQty * unitCapacity : 0;
    var correctedPct = requiredBtu > 0 && correctedBtu > 0 ? Math.round((((correctedBtu - requiredBtu) / requiredBtu) * 1000)) / 10 : 0;
    var fix = null;
    if(suggestedQty > quantity && unitCapacity > 0 && targetId){
      fix = { scope: scope, targetId: targetId, qty: suggestedQty };
    }
    return buildValidationAction(
      lang === 'ar'
        ? 'السعة المختارة أقل من المطلوب. زِد عدد الوحدات أو اختر سعة أعلى.' + (suggestedQty > 0 ? '<br>ارفع عدد الوحدات من ' + quantity + ' إلى ' + suggestedQty + '<br>السعة بعد التعديل: ' + Number(correctedBtu).toLocaleString() + ' BTU' + '<br>نسبة الزيادة بعد التعديل: ' + (correctedPct >= 0 ? '+' : '') + correctedPct.toFixed(1) + '%' : '')
        : 'Selected capacity is below required. Increase unit quantity or choose a higher capacity.' + (suggestedQty > 0 ? '<br>Raise quantity from ' + quantity + ' to ' + suggestedQty + '<br>Capacity after fix: ' + Number(correctedBtu).toLocaleString() + ' BTU' + '<br>Post-fix increase: ' + (correctedPct >= 0 ? '+' : '') + correctedPct.toFixed(1) + '%' : ''),
      fix
    );
  }
  var overPct = ((selectedBtu - requiredBtu) / requiredBtu) * 100;
  if(overPct <= thresholds.MATCH_MAX_OVERSIZE_PCT){
    return buildValidationAction(lang === 'ar' ? 'لا يلزم إجراء. السعة ضمن النطاق المقبول.' : 'No action needed. Capacity is within the accepted range.');
  }
  if(overPct <= thresholds.CAPACITY_REVIEW_MAX_OVERSIZE_PCT){
    return buildValidationAction(lang === 'ar' ? 'السعة أعلى من المطلوب ولكنها ضمن نطاق يحتاج مراجعة. تحقق من نوع المشروع والرطوبة ودورات التشغيل.' : 'Capacity is above required but still within a review range. Check project type, humidity, and operating cycles.');
  }
  var reducedQty = unitCapacity > 0 ? Math.max(1, quantity - 1) : 0;
  var reducedBtu = reducedQty > 0 ? reducedQty * unitCapacity : 0;
  var reduceHint = (reducedQty > 0 && reducedBtu >= requiredBtu)
    ? (lang === 'ar'
        ? '<br>قلل عدد الوحدات من ' + quantity + ' إلى ' + reducedQty + '<br>السعة بعد التعديل: ' + Number(reducedBtu).toLocaleString() + ' BTU'
        : '<br>Reduce quantity from ' + quantity + ' to ' + reducedQty + '<br>Capacity after fix: ' + Number(reducedBtu).toLocaleString() + ' BTU')
    : (lang === 'ar'
        ? '<br>راجع اختيار سعة أقرب أقل إذا كانت متاحة.'
        : '<br>Review a lower nearby capacity if available.');
  var oversizeFix = (reducedQty > 0 && reducedBtu >= requiredBtu && reducedQty < quantity && targetId)
    ? { scope: scope, targetId: targetId, qty: reducedQty }
    : null;
  return buildValidationAction(
    (lang === 'ar'
      ? 'السعة المختارة أعلى بكثير من المطلوب. قلل عدد الوحدات أو اختر سعة أقل لتجنب الهدر أو التشغيل المتقطع.'
      : 'Selected capacity is far above required. Reduce unit quantity or choose a lower capacity to avoid waste or short cycling.') + reduceHint,
    oversizeFix
  );
}
function getCfmValidationAction(requiredCfm, selectedCfm){
  var thresholds = getEngineeringValidationThresholds();
  requiredCfm = Math.max(0, parseInt(requiredCfm, 10) || 0);
  selectedCfm = Math.max(0, parseInt(selectedCfm, 10) || 0);
  var cfmPerTr = (bundleConfig && bundleConfig.cfmPerTr) ? parseInt(bundleConfig.cfmPerTr, 10) || 400 : 400;
  if(requiredCfm <= 0 || selectedCfm <= 0){
    return buildValidationAction(lang === 'ar' ? 'لا توجد بيانات كافية لتحديد إجراء تصحيحي لتدفق الهواء.' : 'Not enough airflow data to suggest a corrective action.');
  }
  if(selectedCfm < requiredCfm){
    var addCfm = requiredCfm - selectedCfm;
    var addTr = addCfm / cfmPerTr;
    return buildValidationAction(
      lang === 'ar'
        ? 'تدفق الهواء أقل من المطلوب. اختر وحدة ذات CFM أعلى أو زد عدد الوحدات.' + '<br>تحتاج تقريبًا +' + Number(addCfm).toLocaleString() + ' CFM إضافية، ما يعادل تقريبًا +' + addTr.toFixed(1) + ' TR.'
        : 'Airflow is below required. Choose a higher-CFM unit or increase quantity.' + '<br>You need about +' + Number(addCfm).toLocaleString() + ' CFM, roughly +' + addTr.toFixed(1) + ' TR.'
    );
  }
  var overPct = ((selectedCfm - requiredCfm) / requiredCfm) * 100;
  if(overPct <= thresholds.MATCH_MAX_OVERSIZE_PCT){
    return buildValidationAction(lang === 'ar' ? 'لا يلزم إجراء. تدفق الهواء يحقق الحد الأدنى المطلوب.' : 'No action needed. Airflow meets the minimum required flow.');
  }
  return buildValidationAction(lang === 'ar' ? 'تدفق الهواء أعلى من اللازم. راجع مستوى الضوضاء وسرعات الدكت.' : 'Airflow is higher than needed. Review noise level and duct velocities.');
}
function getAshraeValidationAction(item, roomState){
  if(!roomState || !roomState.isHealthcare){
    return buildValidationAction(lang === 'ar' ? 'لا يلزم إجراء. المشروع غير مصنف كغرفة صحية.' : 'No action needed. This project is not classified as a healthcare room.');
  }
  if(item && item.status === 'fail'){
    return buildValidationAction(lang === 'ar' ? 'راجع ACH و OA وعلاقة الضغط حسب نوع الغرفة. قد تحتاج زيادة الهواء الخارجي أو تعديل الإمداد/العادم.' : 'Review ACH, OA, and pressure relationship for this room type. You may need more outdoor air or supply/exhaust adjustment.');
  }
  if(item && item.status === 'warning'){
    return buildValidationAction(lang === 'ar' ? 'راجع بيانات ACH و OA والضغط للتأكد من اكتمال التحقق المسترشد بـ ASHRAE.' : 'Review ACH, OA, and pressure inputs to complete the ASHRAE-guided check.');
  }
  return buildValidationAction(lang === 'ar' ? 'لا يلزم إجراء. استمر في مراجعة ACH والضغط ضمن التصميم التفصيلي.' : 'No action needed. Continue reviewing ACH and pressure during detailed design.');
}
function getDuctVelocityValidationAction(statusKey, values){
  var thresholds = getEngineeringValidationThresholds();
  var sup = 0, ret = 0;
  (values || []).forEach(function(v){
    if(!v || !v.label) return;
    if(v.label.indexOf('الإمداد') >= 0 || v.label.indexOf('Supply') >= 0) sup = parseInt(v.value, 10) || sup;
    if(v.label.indexOf('الرجوع') >= 0 || v.label.indexOf('Return') >= 0) ret = parseInt(v.value, 10) || ret;
  });
  if(statusKey === 'pass'){
    return buildValidationAction(lang === 'ar' ? 'لا يلزم إجراء. سرعات الدكت ضمن النطاق المقبول.' : 'No action needed. Duct velocities are within the accepted range.');
  }
  if(statusKey === 'warning' || statusKey === 'fail'){
    var parts = [];
    if(sup > thresholds.DUCT_SUPPLY_PASS_MAX_FPM) parts.push(lang === 'ar' ? 'سرعة دكت الإمداد مرتفعة وقد تسبب ضوضاء. كبّر مقاس الدكت أو قلل سرعة التصميم.' : 'Supply duct velocity is high and may cause noise. Increase duct size or reduce design velocity.');
    if(ret > thresholds.DUCT_RETURN_PASS_MAX_FPM) parts.push(lang === 'ar' ? 'سرعة الراجع مرتفعة. كبّر مقاس الراجع أو أضف مسار رجوع إضافي.' : 'Return velocity is high. Increase return size or add an additional return path.');
    return buildValidationAction(parts.join(' '));
  }
  return buildValidationAction(lang === 'ar' ? 'لا يوجد إجراء لأن الفحص غير منطبق.' : 'No action needed because this check is not applicable.');
}
function getEspValidationAction(item, espValue){
  if(item && item.status === 'not_applicable'){
    return buildValidationAction(lang === 'ar' ? 'لا يوجد إجراء لأن الفحص غير منطبق على هذا النظام.' : 'No action needed because this check is not applicable to this system.');
  }
  if(!espValue){
    return buildValidationAction(lang === 'ar' ? 'أدخل بيانات الدكت والمكونات للحصول على تحقق أدق للـ ESP.' : 'Enter duct and component data for a more accurate ESP check.');
  }
  if(item && (item.status === 'warning' || item.status === 'fail')){
    return buildValidationAction(lang === 'ar' ? 'راجع مكونات النظام مثل الفلاتر، الكويل، المخارج، الدكت، والمخمدات. قد تحتاج مروحة بضغط أعلى أو تقليل مقاومة الدكت.' : 'Review filters, coil, outlets, ductwork, and dampers. A higher-pressure fan or lower duct resistance may be needed.');
  }
  return buildValidationAction(lang === 'ar' ? 'لا يلزم إجراء. الضغط الساكن ضمن نطاق مقبول.' : 'No action needed. Static pressure is within an acceptable range.');
}
function applyValidationFix(scope, targetId, qty){
  qty = Math.max(1, parseInt(qty, 10) || 1);
  if(scope === 'project'){
    if(getProjectQtyAuto()) projState.qtyAuto = false;
    projState.qty = qty;
    projState.autoReason = buildAutoQtyReason('manual');
    persistQuoteState();
    renderProjBlock();
    updateDirectResults();
    renderTechReport();
    renderQuotation();
    refreshGrandTotal();
    return;
  }
  if(scope === 'room' && targetId){
    var parts = String(targetId).split('|');
    var roomIndex = parseInt(parts[0], 10);
    var systemId = parts.slice(1).join('|');
    if(isNaN(roomIndex) || !systemId) return;
    updateRoomSystem(roomIndex, systemId, 'qty', qty);
  }
}
function evaluateCapacityValidation(requiredBtu, selectedCapacityBtu){
  var thresholds = getEngineeringValidationThresholds();
  requiredBtu = Math.max(0, parseInt(requiredBtu, 10) || 0);
  selectedCapacityBtu = Math.max(0, parseInt(selectedCapacityBtu, 10) || 0);
  if(requiredBtu <= 0 || selectedCapacityBtu <= 0){
    return buildValidationItem(lang==='ar' ? 'فحص السعة' : 'Capacity Check', 'not_applicable', lang==='ar' ? 'لا توجد سعة مختارة للمقارنة.' : 'No selected capacity to compare yet.');
  }
  var diff = selectedCapacityBtu - requiredBtu;
  var pct = requiredBtu > 0 ? Math.round((diff / requiredBtu) * 1000) / 10 : 0;
  var pctAbs = Math.abs(pct).toFixed(1) + '%';
  var values = [
    buildValidationValue('المطلوب', 'Required', Number(requiredBtu).toLocaleString() + ' BTU/h'),
    buildValidationValue('المختار', 'Selected', Number(selectedCapacityBtu).toLocaleString() + ' BTU'),
    buildValidationValue('الفرق', 'Difference', (diff >= 0 ? '+' : '-') + Number(Math.abs(diff)).toLocaleString() + ' BTU'),
    buildValidationValue('الفرق %', 'Difference %', (pct >= 0 ? '+' : '-') + pctAbs)
  ];
  if(diff < 0 && Math.abs(pct) <= 2){
    return buildValidationItem(
      lang==='ar' ? 'فحص السعة' : 'Capacity Check',
      'warning',
      lang==='ar'
        ? 'السعة المختارة أقل من المطلوب بفارق بسيط ' + Number(Math.abs(diff)).toLocaleString() + ' BTU/h (' + pctAbs + ') وتحتاج مراجعة قبل الاعتماد.'
        : 'Selected capacity is slightly below required by ' + Number(Math.abs(diff)).toLocaleString() + ' BTU/h (' + pctAbs + ') and should be reviewed before approval.',
      values
    );
  }
  if(diff < 0){
    return buildValidationItem(
      lang==='ar' ? 'فحص السعة' : 'Capacity Check',
      'fail',
      lang==='ar'
        ? 'السعة المختارة أقل من المطلوب بمقدار ' + Number(Math.abs(diff)).toLocaleString() + ' BTU/h (' + pctAbs + ').'
        : 'Selected capacity is below required by ' + Number(Math.abs(diff)).toLocaleString() + ' BTU/h (' + pctAbs + ').',
      values
    );
  }
  if(pct <= thresholds.MATCH_MAX_OVERSIZE_PCT){
    return buildValidationItem(
      lang==='ar' ? 'فحص السعة' : 'Capacity Check',
      'pass',
      lang==='ar'
        ? 'السعة المختارة ضمن نطاق المطابقة المقبول حتى +' + thresholds.MATCH_MAX_OVERSIZE_PCT + '%.'
        : 'Selected capacity is within the accepted 0% to +' + thresholds.MATCH_MAX_OVERSIZE_PCT + '% range.',
      values
    );
  }
  if(pct <= thresholds.CAPACITY_REVIEW_MAX_OVERSIZE_PCT){
    return buildValidationItem(
      lang==='ar' ? 'فحص السعة' : 'Capacity Check',
      'warning',
      lang==='ar'
        ? 'السعة المختارة أعلى من المطلوب بنسبة ' + pct.toFixed(1) + '% وتحتاج مراجعة.'
        : 'Selected capacity is ' + pct.toFixed(1) + '% above required and should be reviewed.',
      values
    );
  }
  return buildValidationItem(
    lang==='ar' ? 'فحص السعة' : 'Capacity Check',
    'fail',
      lang==='ar'
      ? 'السعة المختارة أعلى من المطلوب بأكثر من ' + thresholds.CAPACITY_REVIEW_MAX_OVERSIZE_PCT + '% وتحتاج مراجعة قوية.'
      : 'Selected capacity exceeds required by more than ' + thresholds.CAPACITY_REVIEW_MAX_OVERSIZE_PCT + '% and should be strongly reviewed.',
    values
  );
}
function evaluateCfmValidation(requiredCfm, selectedCfm){
  var thresholds = getEngineeringValidationThresholds();
  requiredCfm = Math.max(0, parseInt(requiredCfm, 10) || 0);
  selectedCfm = Math.max(0, parseInt(selectedCfm, 10) || 0);
  if(requiredCfm <= 0 || selectedCfm <= 0){
    return buildValidationItem(lang==='ar' ? 'فحص تدفق الهواء' : 'CFM Check', 'not_applicable', lang==='ar' ? 'لا توجد بيانات CFM كافية.' : 'Insufficient CFM data.');
  }
  var diff = selectedCfm - requiredCfm;
  var pct = requiredCfm > 0 ? Math.round((diff / requiredCfm) * 1000) / 10 : 0;
  var values = [
    buildValidationValue('المطلوب', 'Required', Number(requiredCfm).toLocaleString() + ' CFM'),
    buildValidationValue('المختار', 'Selected', Number(selectedCfm).toLocaleString() + ' CFM'),
    buildValidationValue('الفرق', 'Difference', (diff >= 0 ? '+' : '-') + Number(Math.abs(diff)).toLocaleString() + ' CFM')
  ];
  if(diff < 0){
    return buildValidationItem(
      lang==='ar' ? 'فحص تدفق الهواء' : 'CFM Check',
      'fail',
      lang==='ar'
        ? 'تدفق الهواء المختار أقل من المطلوب بمقدار ' + Number(Math.abs(diff)).toLocaleString() + ' CFM.'
        : 'Selected airflow is below required by ' + Number(Math.abs(diff)).toLocaleString() + ' CFM.',
      values
    );
  }
  if(pct <= thresholds.MATCH_MAX_OVERSIZE_PCT){
    return buildValidationItem(
      lang==='ar' ? 'فحص تدفق الهواء' : 'CFM Check',
      'pass',
      lang==='ar'
        ? 'تدفق الهواء يحقق الحد الأدنى المطلوب.'
        : 'Airflow meets the minimum required flow.',
      values
    );
  }
  return buildValidationItem(
    lang==='ar' ? 'فحص تدفق الهواء' : 'CFM Check',
    'warning',
    lang==='ar'
      ? 'تدفق الهواء أعلى من المطلوب ويستحسن مراجعته.'
      : 'Airflow is above the required level and should be reviewed.',
    values.concat([
      buildValidationValue('الفرق %', 'Difference %', '+' + Math.abs(pct).toFixed(1) + '%')
    ])
  );
}
function evaluateAshraeGuidedValidation(roomState, room){
  if(!roomState || !roomState.isHealthcare){
    return buildValidationItem(lang==='ar' ? 'تحقق مسترشد بـ ASHRAE' : 'ASHRAE-guided check', 'not_applicable', lang==='ar' ? 'لا ينطبق على الغرف غير الصحية.' : 'Not applicable to non-healthcare rooms.');
  }
  var requiredCfm = Math.max(0, parseInt(roomState.requiredCfm, 10) || 0);
  var selectedCfm = Math.max(0, parseInt(roomState.selectedSystemCfm, 10) || 0);
  var cfmDiff = selectedCfm - requiredCfm;
  var pressureReq = roomState.pressureRequirement || room.pressure || room.pres || '';
  var baseValues = [
    buildValidationValue('ACH', 'ACH', room.ach != null ? String(room.ach) : (lang === 'ar' ? 'غير متاح' : 'N/A')),
    buildValidationValue('OA', 'OA', room.oaStd != null ? String(room.oaStd) : room.oa != null ? String(room.oa) : (lang === 'ar' ? 'غير متاح' : 'N/A')),
    buildValidationValue('العادم', 'Exhaust', room.exhaust != null ? String(room.exhaust) : room.exh != null ? String(room.exh) : (lang === 'ar' ? 'غير متاح' : 'N/A')),
    buildValidationValue('الضغط', 'Pressure', pressureReq || (lang === 'ar' ? 'غير متاح' : 'N/A')),
    buildValidationValue('CFM المطلوب', 'Required CFM', Number(requiredCfm || 0).toLocaleString() + ' CFM'),
    buildValidationValue('CFM المختار', 'Selected CFM', Number(selectedCfm || 0).toLocaleString() + ' CFM'),
    buildValidationValue('الفرق', 'Difference', (cfmDiff >= 0 ? '+' : '-') + Number(Math.abs(cfmDiff) || 0).toLocaleString() + ' CFM')
  ];
  var hasInputs = !!(room && (room.ach != null || room.sup || room.oaStd != null || room.oa != null || room.exhaust != null || room.exh != null || room.pressure || room.pres));
  if(!hasInputs){
    return buildValidationItem(lang==='ar' ? 'تحقق مسترشد بـ ASHRAE' : 'ASHRAE-guided check', 'warning', lang==='ar' ? 'بيانات ASHRAE لهذه الغرفة غير مكتملة.' : 'ASHRAE guidance data for this room is incomplete.', baseValues);
  }
  if(selectedCfm < requiredCfm){
    return buildValidationItem(
      lang==='ar' ? 'تحقق مسترشد بـ ASHRAE' : 'ASHRAE-guided check',
      'fail',
      lang==='ar'
        ? 'هذه غرفة صحية وتتطلب مراجعة ACH والضغط وتدفق الهواء؛ التدفق الحالي أقل من المطلوب.'
        : 'This healthcare room requires ACH, pressure, and airflow review; current airflow is below required.',
      baseValues
    );
  }
  var detail = lang==='ar'
    ? 'تمت مراجعة ACH/OA/Exhaust/Pressure بشكل استرشادي' + (pressureReq ? ' — الضغط: ' + pressureReq : '') + '.'
    : 'ACH/OA/Exhaust/Pressure reviewed as an ASHRAE-guided check' + (pressureReq ? ' — pressure: ' + pressureReq : '') + '.';
  return buildValidationItem(lang==='ar' ? 'تحقق مسترشد بـ ASHRAE' : 'ASHRAE-guided check', pressureReq ? 'pass' : 'warning', detail, baseValues);
}
function evaluateDuctVelocityValidation(selectedCfm, isDuctedSystem){
  var thresholds = getEngineeringValidationThresholds();
  if(!isDuctedSystem || selectedCfm <= 0){
    return buildValidationItem(lang==='ar' ? 'فحص سرعة المجرى' : 'Duct Velocity Check', 'not_applicable', lang==='ar' ? 'لا ينطبق على الأنظمة غير المجرّية.' : 'Not applicable to non-ducted systems.');
  }
  var supTarget = parseInt((G('duct-vel-sup')||{value:'1000'}).value,10) || 1000;
  var retTarget = parseInt((G('duct-vel-ret')||{value:'800'}).value,10) || 800;
  var sizing = window._lastDuctSizing || {};
  var supDuct = calcDuctSize(sizing.supCfm || selectedCfm, supTarget, 'sup');
  var retDuct = calcDuctSize(sizing.retCfm || selectedCfm, retTarget, 'ret');
  var sup = supDuct ? (supDuct.std || supDuct.calc) : null;
  var ret = retDuct ? (retDuct.std || retDuct.calc) : null;
  var supFpm = sup && sup.actualFpm ? sup.actualFpm : supTarget;
  var retFpm = ret && ret.actualFpm ? ret.actualFpm : retTarget;
  var worst = Math.max(supFpm, retFpm);
  var detail = (lang==='ar' ? 'الإمداد ' : 'Supply ') + supFpm + ' fpm · ' + (lang==='ar' ? 'الرجوع ' : 'Return ') + retFpm + ' fpm';
  var values = [
    buildValidationValue('إمداد مستهدف', 'Supply target', supTarget + ' fpm'),
    buildValidationValue('إمداد فعلي', 'Supply actual', supFpm + ' fpm'),
    buildValidationValue('راجع مستهدف', 'Return target', retTarget + ' fpm'),
    buildValidationValue('راجع فعلي', 'Return actual', retFpm + ' fpm')
  ];
  if(supFpm <= thresholds.DUCT_SUPPLY_PASS_MAX_FPM && retFpm <= thresholds.DUCT_RETURN_PASS_MAX_FPM){
    return buildValidationItem(lang==='ar' ? 'فحص سرعة المجرى' : 'Duct Velocity Check', 'pass', detail, values);
  }
  if(worst <= thresholds.DUCT_REVIEW_MAX_FPM){
    return buildValidationItem(lang==='ar' ? 'فحص سرعة المجرى' : 'Duct Velocity Check', 'warning', detail, values);
  }
  return buildValidationItem(lang==='ar' ? 'فحص سرعة المجرى' : 'Duct Velocity Check', 'fail', detail, values);
}
function evaluateEspValidation(isDuctedSystem){
  var thresholds = getEngineeringValidationThresholds();
  if(!isDuctedSystem){
    return buildValidationItem(lang==='ar' ? 'فحص ESP' : 'ESP Check', 'not_applicable', lang==='ar' ? 'لا ينطبق على الأنظمة غير المجرّية.' : 'Not applicable to non-ducted systems.');
  }
  var esp = window._lastEspCalc;
  if(!esp || !esp.totalPa){
    return buildValidationItem(lang==='ar' ? 'فحص ESP' : 'ESP Check', 'warning', lang==='ar' ? 'تقدير ESP غير متاح بعد أو يحتاج إدخال مسار المجاري.' : 'ESP estimate is not available yet or needs duct path inputs.');
  }
  var detail = (lang==='ar' ? 'ESP الكلي: ' : 'Total ESP: ') + Number(esp.totalPa).toLocaleString() + ' Pa';
  var values = [
    buildValidationValue('ESP الحالي', 'Current ESP', Number(esp.totalPa).toLocaleString() + ' Pa'),
    buildValidationValue('حد المراجعة', 'Review limit', thresholds.ESP_LOW_MAX_PA + ' Pa'),
    buildValidationValue('حد الفشل', 'Fail limit', thresholds.ESP_VALIDATION_REVIEW_MAX_PA + ' Pa')
  ];
  if(esp.totalPa <= thresholds.ESP_LOW_MAX_PA) return buildValidationItem(lang==='ar' ? 'فحص ESP' : 'ESP Check', 'pass', detail, values);
  if(esp.totalPa <= thresholds.ESP_VALIDATION_REVIEW_MAX_PA) return buildValidationItem(lang==='ar' ? 'فحص ESP' : 'ESP Check', 'warning', detail, values.concat([
    buildValidationValue('التجاوز', 'Overage', '+' + Number(esp.totalPa - thresholds.ESP_LOW_MAX_PA).toLocaleString() + ' Pa')
  ]));
  return buildValidationItem(lang==='ar' ? 'فحص ESP' : 'ESP Check', 'fail', detail, values.concat([
    buildValidationValue('التجاوز', 'Overage', '+' + Number(esp.totalPa - thresholds.ESP_VALIDATION_REVIEW_MAX_PA).toLocaleString() + ' Pa')
  ]));
}
function buildEngineeringNotesFromValidation(items, isHealthcare){
  var notes = [];
  items.forEach(function(item){
    if(!item) return;
    if((item.title.indexOf('Capacity') >= 0 || item.title.indexOf('السعة') >= 0) && item.status === 'fail'){
      notes.push(lang==='ar' ? 'السعة المختارة تحتاج تصحيحًا قبل الاعتماد.' : 'Selected capacity needs correction before approval.');
    } else if((item.title.indexOf('Capacity') >= 0 || item.title.indexOf('السعة') >= 0) && item.status === 'warning'){
      notes.push(lang==='ar' ? 'السعة المختارة أعلى من المطلوب وتحتاج مراجعة تشغيلية.' : 'Selected capacity is above required and should be operationally reviewed.');
    }
    if((item.title.indexOf('CFM') >= 0 || item.title.indexOf('تدفق') >= 0) && item.status === 'fail'){
      notes.push(lang==='ar' ? 'تدفق الهواء لا يحقق الحد الأدنى المطلوب.' : 'Airflow does not meet the minimum required flow.');
    }
    if((item.title.indexOf('ESP') >= 0) && item.status === 'warning'){
      notes.push(lang==='ar' ? 'الضغط الساكن يحتاج مراجعة مع مكونات النظام.' : 'Static pressure should be reviewed with the system components.');
    }
  });
  if(isHealthcare){
    notes.push(lang==='ar' ? 'هذه الغرفة صحية وتتطلب مراجعة ACH والضغط.' : 'This is a healthcare room and requires ACH and pressure validation.');
  }
  notes = notes.filter(function(note, idx){ return note && notes.indexOf(note) === idx; });
  if(!notes.length){
    notes.push(lang==='ar' ? 'لم تُسجّل ملاحظات هندسية إضافية.' : 'No additional engineering notes were generated.');
  }
  return notes;
}
function renderEngineeringValidationPanel(title, items, notes){
  var rows = (items || []).map(function(item){
    var meta = item.meta || getValidationStatusMeta(item.status);
    return ''+
      '<div class="validation-card validation-'+meta.css+'">'+
        '<div class="validation-card-header">'+
          '<span class="validation-item-icon '+meta.css+'">'+getValidationStatusIcon(item.status)+'</span>'+
          '<div class="validation-card-titleblock">'+
            '<div class="validation-card-title">'+item.title+'</div>'+
          '</div>'+
          '<span class="validation-badge '+meta.css+'">'+meta.label+'</span>'+
        '</div>'+
      '</div>';
  }).join('');
  return ''+
    '<details class="tech-validation-accordion">'+
      '<summary>'+title+'</summary>'+
      '<div class="tech-validation-body">'+
        '<div class="engineering-validation-grid validation-checklist-grid">'+rows+'</div>'+
      '</div>'+
    '</details>';
}
function buildValidationSummaryInline(items, isAr){
  return (items || []).map(function(item){
    var meta = item.meta || getValidationStatusMeta(item.status);
    return '<div style="display:flex;justify-content:space-between;gap:8px;font-size:10px;padding:4px 0;border-bottom:1px solid #e2e8f0"><span>' + item.title + '</span><span style="font-weight:700;color:' + (meta.css==='pass'?'#166534':meta.css==='warning'?'#b45309':meta.css==='fail'?'#b91c1c':'#64748b') + '">' + meta.label + '</span></div>';
  }).join('');
}
function buildReportPreludeHtml(isAr){
  var meta = getCalculationLevelMeta(isAr);
  var reportMeta = getReportProjectMeta();
  var projectLink = getReportProjectLink();
  return ''+
    '<div style="border:1px solid #bfdbfe;border-radius:8px;padding:12px 14px;background:#f8fbff;margin-bottom:12px;page-break-inside:avoid">'+
      '<div style="font-size:11px;font-weight:700;color:#1d4ed8;margin-bottom:6px">'+meta.badge+'</div>'+
      '<div style="font-size:10px;color:#475569;line-height:1.7;margin-bottom:6px">'+meta.disclaimer+'</div>'+
      '<div style="font-size:10px;color:#7c2d12;line-height:1.7">'+meta.reportDisclaimer+'</div>'+
      '<div style="margin-top:10px;border-top:1px solid #dbeafe;padding-top:10px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px">'+
        buildPdfReportMetaCell(isAr ? 'اسم العميل' : 'Client', reportMeta.clientName)+
        buildPdfReportMetaCell(isAr ? 'الموقع' : 'Location', reportMeta.location)+
        buildPdfReportMetaCell(isAr ? 'المصمم' : 'Designer', reportMeta.designer)+
        buildPdfReportMetaCell(isAr ? 'مرجع التقرير' : 'Report Ref.', reportMeta.reportReference)+
        buildPdfReportMetaCell(isAr ? 'رابط المشروع' : 'Project Link', projectLink.label)+
        buildPdfReportMetaCell('QR', projectLink.qrStatus)+
      '</div>'+
    '</div>';
}
function ensureRoomEngineeringState(i, roomState){
  if(roomState && typeof roomState.requiredBtu !== 'undefined') return roomState;
  var fallbackState = null;
  try { fallbackState = syncRoomSystemState(i); } catch(_errA) {}
  if(fallbackState && typeof fallbackState.requiredBtu !== 'undefined') return fallbackState;
  try { fallbackState = getRoomSystemState(i); } catch(_errB) {}
  if(fallbackState && typeof fallbackState.requiredBtu !== 'undefined') return fallbackState;
  var room = hist[i] || {};
  return {
    systems: [],
    requiredBtu: getRoomRequiredBtu(i),
    requiredCfm: getRoomRequiredCfm(i),
    selectedCapacityBtu: Number(room.selectedCapacityBtu) || 0,
    selectedSystemCfm: Number(room.selectedSystemCfm) || 0,
    capacityDifference: 0,
    airflowDifference: 0,
    capacityStatus: '',
    capacityStatusMeta: null,
    airflowStatus: '',
    airflowStatusMeta: null,
    isHealthcare: isHealthcareRoom(room),
    pressureRequirement: room.pres || room.pressure || '',
    assignment: normalizeRoomAssignment((ensureQuoteLine(i) || {}).assignment || { mode:'independent' })
  };
}
function getRoomEngineeringValidation(i, roomState){
  roomState = ensureRoomEngineeringState(i, roomState);
  var room = hist[i] || {};
  var assignment = getRoomAssignment(i);
  if(assignment.mode === 'project'){
    return {
      items: [
        buildValidationItem(
          lang==='ar' ? 'ربط الوحدة' : 'HVAC Assignment',
          'warning',
          lang==='ar' ? 'هذه الغرفة مرتبطة بوحدة المشروع المركزية. تتم المطابقة على إجمالي المشروع وليس على هذه الغرفة منفردة.' : 'This room is connected to the project central unit. Validation is performed at project level rather than per room.'
        ),
        evaluateAshraeGuidedValidation(roomState, room)
      ],
      notes: [lang==='ar' ? 'راجع حالة وحدة المشروع المركزية للتأكد من مطابقة إجمالي الأحمال.' : 'Review the central project unit to validate the combined load.']
    };
  }
  if(assignment.mode === 'zone' && assignment.zoneId){
    var zone = getZoneById(assignment.zoneId);
    return {
      items: [
        buildValidationItem(
          lang==='ar' ? 'ربط المنطقة' : 'Zone Assignment',
          zone ? 'pass' : 'fail',
          zone
            ? ((lang==='ar' ? 'هذه الغرفة مرتبطة بالمنطقة: ' : 'This room is connected to zone: ') + zone.name)
            : (lang==='ar' ? 'منطقة HVAC المرتبطة بهذه الغرفة غير موجودة.' : 'The HVAC zone linked to this room no longer exists.')
        ),
        evaluateAshraeGuidedValidation(roomState, room)
      ],
      notes: [zone
        ? (lang==='ar' ? 'تتم المطابقة على مستوى المنطقة وفق مجموع أحمال الغرف المرتبطة.' : 'Validation is performed at zone level using the combined assigned room load.')
        : (lang==='ar' ? 'أعد ربط الغرفة بمنطقة صحيحة أو اجعلها مستقلة.' : 'Reconnect this room to a valid zone or make it independent.')]
    };
  }
  var systems = roomState && roomState.systems ? roomState.systems : [];
  var selectedCapacity = roomState ? roomState.selectedCapacityBtu : 0;
  var selectedCfm = roomState ? roomState.selectedSystemCfm : 0;
  var isDuctedSystem = systems.some(function(system){ return isDucted(system.unitType); });
  var primarySystem = systems.length === 1 ? systems[0] : null;
  var items = [
    evaluateCapacityValidation(roomState.requiredBtu, selectedCapacity),
    evaluateCfmValidation(roomState.requiredCfm, selectedCfm),
    evaluateAshraeGuidedValidation(roomState, room),
    evaluateDuctVelocityValidation(selectedCfm || roomState.requiredCfm, isDuctedSystem),
    evaluateEspValidation(isDuctedSystem)
  ];
  if(items[0]) attachValidationAction(items[0], getCapacityValidationAction(roomState.requiredBtu, selectedCapacity, primarySystem ? primarySystem.selectedBtu : 0, primarySystem ? primarySystem.qty : 1, 'room', primarySystem ? (i + '|' + primarySystem.id) : null));
  if(items[1]) attachValidationAction(items[1], getCfmValidationAction(roomState.requiredCfm, selectedCfm));
  if(items[2]) attachValidationAction(items[2], getAshraeValidationAction(items[2], roomState));
  if(items[3]) attachValidationAction(items[3], getDuctVelocityValidationAction(items[3].status, items[3].values));
  if(items[4]) attachValidationAction(items[4], getEspValidationAction(items[4], window._lastEspCalc && window._lastEspCalc.totalPa));
  var notes = buildEngineeringNotesFromValidation(items, roomState.isHealthcare);
  return {
    items: items,
    notes: notes
  };
}
function getProjectEngineeringValidation(){
  ensureProjectSystems();
  if(isProjectHvacMode()){
    syncLegacyProjectStateFromSystems();
  }
  var requiredBtu = getProjectRequiredLoadBtu();
  var requiredCfm = getProjectRequiredLoadCfm();
  var selectedBtu = getSelectedProjectEquipmentBtu();
  var selectedCfm = getSelectedProjectEquipmentCfm();
  var currentType = ((G('proj-systype') && G('proj-systype').value) || projState.sysType || 'split');
  var isDuctedSystem = isDucted(currentType);
  var hasHealthcareRooms = hist.some(function(room){ return isHealthcareRoom(room); });
  var ashraeItem = hasHealthcareRooms
    ? buildValidationItem(lang==='ar' ? 'تحقق مسترشد بـ ASHRAE' : 'ASHRAE-guided check', 'warning', lang==='ar' ? 'المشروع يحتوي غرفًا صحية ويجب مراجعتها على مستوى الغرف.' : 'This project contains healthcare rooms that should be reviewed at room level.')
    : buildValidationItem(lang==='ar' ? 'تحقق مسترشد بـ ASHRAE' : 'ASHRAE-guided check', 'not_applicable', lang==='ar' ? 'لا ينطبق على مشروع غير صحي.' : 'Not applicable to a non-healthcare project.');
  var items = [
    evaluateCapacityValidation(requiredBtu, selectedBtu),
    evaluateCfmValidation(requiredCfm, selectedCfm),
    ashraeItem,
    evaluateDuctVelocityValidation(selectedCfm || requiredCfm, isDuctedSystem),
    evaluateEspValidation(isDuctedSystem)
  ];
  if(items[0]) attachValidationAction(items[0], getCapacityValidationAction(requiredBtu, selectedBtu, getProjectCentralSelectedBtu(), 1, 'project', 'project'));
  if(items[1]) attachValidationAction(items[1], getCfmValidationAction(requiredCfm, selectedCfm));
  if(items[2]) attachValidationAction(items[2], getAshraeValidationAction(items[2], hasHealthcareRooms ? { isHealthcare: true } : null));
  if(items[3]) attachValidationAction(items[3], getDuctVelocityValidationAction(items[3].status, items[3].values));
  if(items[4]) attachValidationAction(items[4], getEspValidationAction(items[4], window._lastEspCalc && window._lastEspCalc.totalPa));
  var notes = buildEngineeringNotesFromValidation(items, hasHealthcareRooms);
  return {
    items: items,
    notes: notes
  };
}
function getFirstReportRecord(){
  return hist.length ? (hist[0] || {}) : {};
}
function getOptionalReportField(ids, fallback){
  for(var i=0;i<ids.length;i++){
    var el = G(ids[i]);
    if(el && typeof el.value === 'string' && el.value.trim()) return el.value.trim();
    if(el && el.textContent && el.textContent.trim()) return el.textContent.trim();
  }
  return fallback;
}
function getReportReferenceNumber(projectNo){
  var rawDate = new Date();
  var yyyy = rawDate.getFullYear();
  var mm = String(rawDate.getMonth() + 1).padStart(2, '0');
  var dd = String(rawDate.getDate()).padStart(2, '0');
  var safeProjectNo = String(projectNo || 'Q-001').replace(/[^a-zA-Z0-9_-]/g, '');
  return 'ACP-TR-' + safeProjectNo + '-' + yyyy + mm + dd;
}
function getCurrentSavedProjectForReport(){
  try{
    var currentId = localStorage.getItem('aircalc_current_project_id') || '';
    var projects = JSON.parse(localStorage.getItem('aircalc_projects') || '[]');
    if(!Array.isArray(projects)) return null;
    for(var i=0;i<projects.length;i++){
      if(projects[i] && projects[i].id === currentId) return projects[i];
    }
  }catch(_err){}
  return null;
}
function getReportProjectLink(){
  var savedProject = getCurrentSavedProjectForReport();
  if(savedProject && savedProject.projectUrl && /^https?:\/\//i.test(savedProject.projectUrl)){
    return {
      url: savedProject.projectUrl,
      label: savedProject.projectUrl,
      qrStatus: lang === 'ar' ? 'QR مرفق' : 'QR included',
      available: true
    };
  }
  var href = '';
  try { href = window.location && window.location.href ? window.location.href : ''; } catch(_err) {}
  var usable = !!(href && /^https?:\/\//i.test(href));
  if(usable && savedProject && savedProject.cloudId){
    try{
      var u = new URL(href);
      u.searchParams.set('project', savedProject.cloudId);
      href = u.toString();
    }catch(_urlErr){}
  }
  return {
    url: usable ? href : '',
    label: usable ? href : (lang === 'ar' ? 'يتطلب حفظًا سحابيًا' : 'Requires cloud-saved project'),
    qrStatus: usable ? (lang === 'ar' ? 'QR مرفق' : 'QR included') : (lang === 'ar' ? 'غير متاح محليًا' : 'Unavailable locally'),
    available: usable
  };
}
function buildReportQrHtml(link, isAr){
  link = link || getReportProjectLink();
  if(!link.available || !link.url){
    return '<div class="report-qr-card unavailable">'+
      '<div class="report-qr-title">'+(isAr?'QR المشروع':'Project QR')+'</div>'+
      '<div class="report-qr-placeholder">'+(isAr?'غير متاح':'N/A')+'</div>'+
      '<div class="report-qr-caption">'+esc(link.label || (isAr?'يتطلب حفظًا سحابيًا':'Requires cloud save'))+'</div>'+
    '</div>';
  }
  var qrUrl = 'https://api.qrserver.com/v1/create-qr-code/?size=140x140&margin=8&data=' + encodeURIComponent(link.url);
  return '<div class="report-qr-card">'+
    '<div class="report-qr-title">'+(isAr?'QR المشروع':'Project QR')+'</div>'+
    '<img class="report-qr-img" crossorigin="anonymous" src="'+esc(qrUrl)+'" alt="Project QR Code">'+
    '<div class="report-qr-caption">'+esc(link.url)+'</div>'+
  '</div>';
}
function waitForPdfImages(root, timeoutMs){
  root = root || document;
  timeoutMs = timeoutMs || 2500;
  var images = Array.prototype.slice.call(root.querySelectorAll('img'));
  if(!images.length) return Promise.resolve();
  var tasks = images.map(function(img){
    if(img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(function(resolve){
      var done = false;
      var timer = setTimeout(function(){
        if(done) return;
        done = true;
        if(img.classList && img.classList.contains('report-qr-img')){
          var fallback = document.createElement('div');
          fallback.className = 'report-qr-placeholder';
          fallback.textContent = 'QR';
          img.parentNode.replaceChild(fallback, img);
        }
        resolve();
      }, timeoutMs);
      img.onload = function(){
        if(done) return;
        done = true;
        clearTimeout(timer);
        resolve();
      };
      img.onerror = function(){
        if(done) return;
        done = true;
        clearTimeout(timer);
        if(img.classList && img.classList.contains('report-qr-img')){
          var fallback = document.createElement('div');
          fallback.className = 'report-qr-placeholder';
          fallback.textContent = 'QR';
          img.parentNode.replaceChild(fallback, img);
        }
        resolve();
      };
    });
  });
  return Promise.all(tasks).then(function(){});
}
function buildPdfReportMetaCell(label, value){
  return '<div style="background:#fff;border:1px solid #dbeafe;border-radius:6px;padding:7px 8px;min-height:42px">'+
    '<div style="font-size:8px;color:#64748b;margin-bottom:2px">'+esc(label)+'</div>'+
    '<div style="font-size:10px;color:#0f172a;font-weight:700;line-height:1.4;word-break:break-word">'+esc(value || '—')+'</div>'+
  '</div>';
}
function refreshReportIdentityFields(){
  persistProjectIdentityDraft();
  refreshProjectIdentitySummaries();
  // Do not move report containers while the user is typing in them.
  var field=document.activeElement;
  if(field && /^(report-client|report-location|report-designer)$/.test(field.id)){
    if(!field._identityBlurPending) field.addEventListener('blur',function(){
      field._identityBlurPending=false;
      if(typeof renderTechReportFoundation==='function') renderTechReportFoundation();
    },{once:true});
    field._identityBlurPending=true;
    return;
  }
  if(typeof renderTechReportFoundation==='function') renderTechReportFoundation();
}
function getReportLanguagePreference(){
  var el = G('report-language');
  var value = el && el.value ? String(el.value) : 'auto';
  return value === 'ar' || value === 'en' ? value : 'auto';
}
function getEffectiveReportLanguage(){
  var preference = getReportLanguagePreference();
  return preference === 'auto' ? lang : preference;
}
function getProfessionalReportDataForReport(options){
  if(!window.AirCalcProfessionalReportData || typeof window.AirCalcProfessionalReportData.buildProfessionalReportData !== 'function') return null;
  try{
    return window.AirCalcProfessionalReportData.buildProfessionalReportData(options || {});
  }catch(err){
    console.warn('[AirCalc] Professional report data builder failed:', err);
    return null;
  }
}
function refreshProfessionalReportDataCache(options){
  var data = getProfessionalReportDataForReport(options || { language: getEffectiveReportLanguage() });
  window._lastProfessionalReportData = data;
  return data;
}
function getReportProjectMeta(){
  var first = getFirstReportRecord();
  var projectNo = ((G('tech-no')||{value:''}).value || (G('quote-no')||{value:''}).value || 'Q-001').trim();
  var city = lang === 'ar' ? (first.cityLabelAr || '—') : (first.cityLabelEn || '—');
  return {
    projectName: ((G('tech-project')||{value:''}).value || (G('quote-project')||{value:''}).value || '').trim() || '—',
    projectNo: projectNo,
    clientName: getOptionalReportField(['report-client','client-name','quote-client','project-client'], lang === 'ar' ? 'غير محدد' : 'Not specified'),
    location: getOptionalReportField(['report-location','project-location','quote-location'], city),
    city: city,
    buildingType: first.category ? getCategoryLabel(first.category) : (first.roomType || ((lang==='ar' ? (first.ar || first.en) : (first.en || first.ar)) || '—')),
    engineer: getOptionalReportField(['report-engineer','designer-name','project-engineer'], lang === 'ar' ? 'غير محدد' : 'Not specified'),
    designer: getOptionalReportField(['report-designer','designer-name','project-designer'], lang === 'ar' ? 'غير محدد' : 'Not specified'),
    date: new Date().toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US'),
    reportReference: getReportReferenceNumber(projectNo)
  };
}
function getCentralizedReportMeta(languageOverride){
  var meta = getReportProjectMeta();
  var reportData = window._lastProfessionalReportData || refreshProfessionalReportDataCache({ language: languageOverride || getEffectiveReportLanguage() });
  var reportIdentity = reportData && reportData.identity ? reportData.identity : null;
  if(reportIdentity){
    meta.projectName = reportIdentity.projectName || meta.projectName;
    meta.projectNo = reportIdentity.projectNo || meta.projectNo;
    meta.clientName = reportIdentity.clientName || meta.clientName;
    meta.location = reportIdentity.location || meta.location;
    meta.city = reportIdentity.city || meta.city;
    meta.buildingType = reportIdentity.buildingType || meta.buildingType;
    meta.engineer = reportIdentity.engineer || meta.engineer;
    meta.designer = reportIdentity.designer || meta.designer;
    meta.date = reportIdentity.date || meta.date;
    meta.reportReference = reportIdentity.reportReference || meta.reportReference;
  }
  return {
    meta: meta,
    source: reportIdentity ? 'professional-report-identity' : 'legacy-project-meta',
    identity: reportIdentity
  };
}
function getReportAssignedSystemLabel(i){
  var state = getRoomSystemState(i);
  var assignment = getRoomAssignment(i);
  if(assignment.mode === 'project'){
    return lang==='ar' ? 'وحدات المشروع' : 'Project Units';
  }
  if(assignment.mode === 'zone'){
    var zone = getZoneById(assignment.zoneId);
    return zone ? zone.name : (lang==='ar' ? 'منطقة HVAC' : 'HVAC Zone');
  }
  if(!state.systems.length) return lang==='ar' ? 'لا يوجد وحدة' : 'No unit';
  if(state.systems.length > 1) return lang==='ar' ? 'أنظمة متعددة' : 'Multiple systems';
  var primary = state.systems[0];
  return utLabel(primary.unitType || 'split') + ' · ' + Number(primary.selectedBtu || 0).toLocaleString() + ' BTU × ' + Math.max(1, parseInt(primary.qty,10) || 1);
}
function toEnglishDigits(value){
  var map = {
    '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9',
    '۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9',
    '٫':'.','٬':','
  };
  return String(value == null ? '' : value).replace(/[٠-٩۰-۹٫٬]/g, function(ch){ return map[ch] || ch; });
}
function enforceEnglishDigitsInElement(rootEl){
  if(!rootEl || typeof document === 'undefined' || typeof document.createTreeWalker !== 'function') return;
  var textNodeType = (typeof NodeFilter !== 'undefined' && NodeFilter.SHOW_TEXT) ? NodeFilter.SHOW_TEXT : 4;
  var walker = document.createTreeWalker(rootEl, textNodeType, null);
  var nodes = [];
  var node;
  while((node = walker.nextNode())) nodes.push(node);
  nodes.forEach(function(textNode){
    var next = toEnglishDigits(textNode.nodeValue);
    if(next !== textNode.nodeValue) textNode.nodeValue = next;
  });
}
function enforceTechnicalReportEnglishDigits(){
  enforceEnglishDigitsInElement(G('p-tech'));
  enforceEnglishDigitsInElement(G('hvac-design-copilot-panel'));
}
if(typeof window !== 'undefined'){
  window.AirCalcToEnglishDigits = toEnglishDigits;
  window.AirCalcEnforceTechnicalReportEnglishDigits = enforceTechnicalReportEnglishDigits;
}
function getReportRoomSourceRecord(room){
  if(!room) return null;
  if(typeof ROOMS !== 'undefined' && room.rid && ROOMS[room.rid]) return ROOMS[room.rid];
  return null;
}
function formatReportNumber(value, unit){
  var n = Number(value);
  if(!isFinite(n) || n <= 0) return '—';
  return Number(Math.round(n)).toLocaleString() + (unit ? ' ' + unit : '');
}
function formatReportOutdoorAir(room, roomCount){
  var rc = Math.max(1, parseInt(roomCount,10) || 1);
  if(room && room.oa != null && Number(room.oa) > 0) return formatReportNumber(Number(room.oa) * rc, 'CFM');
  return '—';
}
function formatReportExhaust(room, roomCount){
  var rc = Math.max(1, parseInt(roomCount,10) || 1);
  var value = room && room.exh != null ? room.exh : (room && room.exhaust != null ? room.exhaust : null);
  return formatReportNumber(Number(value || 0) * rc, 'CFM');
}
function formatReportTempRh(room){
  var source = getReportRoomSourceRecord(room);
  var temp = room && Array.isArray(room.tempRange) ? room.tempRange : (source && Array.isArray(source.tr) ? source.tr : null);
  var rh = room && Array.isArray(room.rhRange) ? room.rhRange : (source && Array.isArray(source.rh) ? source.rh : null);
  var parts = [];
  if(temp && temp.length >= 2) parts.push(temp[0] + '-' + temp[1] + ' °C');
  if(rh && rh.length >= 2) parts.push(rh[0] + '-' + rh[1] + '% RH');
  return parts.length ? parts.join(' · ') : '—';
}
function buildTechnicalReportHeaderHtml(c){
  var centralized = getCentralizedReportMeta(c.isAr ? 'ar' : 'en');
  var meta = centralized.meta;
  var link = getReportProjectLink();
  var title = c.isAr ? 'التقرير الفني لحسابات HVAC' : 'HVAC Technical Report';
  var subtitle = c.isAr ? 'AirCalc Pro - منصة حسابات وعروض أسعار التكييف' : 'AirCalc Pro - HVAC Calculation & Quotation Suite';
  var reportStatus = c.isAr ? 'مراجعة هندسية أولية' : 'Preliminary Engineering Review';
  return ''+
    '<div class="inv-header">'+
      '<div class="inv-brand">'+
        '<div class="inv-brand-icon">AC</div>'+
        '<div><div class="inv-brand-name">AirCalc Pro</div>'+
        '<div class="inv-brand-sub">'+esc(subtitle)+'</div></div>'+
      '</div>'+
      '<div style="text-align:'+(c.isAr?'left':'right')+'">'+
        '<div style="font-size:18px;font-weight:800;color:#0f172a">'+esc(title)+'</div>'+
        '<div style="font-size:11px;color:#64748b;margin-top:4px">'+esc(reportStatus)+'</div>'+
        '<div style="font-size:11px;color:#0ea5e9;margin-top:4px;font-weight:700">'+esc(meta.reportReference)+'</div>'+
      '</div>'+
    '</div>'+
    '<div data-report-source="'+(centralized.identity ? 'professional-report-header-identity' : 'legacy-report-header')+'" style="border:1px solid #dbeafe;border-radius:10px;padding:14px;margin-bottom:14px;background:#f8fbff;page-break-inside:avoid">'+
      '<div style="display:grid;grid-template-columns:1fr 118px;gap:12px;align-items:stretch">'+
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px">'+
          buildPdfReportMetaCell(c.isAr ? 'اسم المشروع' : 'Project Name', meta.projectName)+
          buildPdfReportMetaCell(c.isAr ? 'رقم المشروع' : 'Project No.', meta.projectNo)+
          buildPdfReportMetaCell(c.isAr ? 'تاريخ التقرير' : 'Report Date', meta.date)+
          buildPdfReportMetaCell(c.isAr ? 'حالة التقرير' : 'Report Status', reportStatus)+
          buildPdfReportMetaCell(c.isAr ? 'اسم العميل' : 'Client', meta.clientName)+
          buildPdfReportMetaCell(c.isAr ? 'الموقع' : 'Location', meta.location)+
          buildPdfReportMetaCell(c.isAr ? 'المصمم' : 'Designer', meta.designer)+
          buildPdfReportMetaCell(c.isAr ? 'مرجع التقرير' : 'Report Ref.', meta.reportReference)+
          buildPdfReportMetaCell('QR / Link', link.qrStatus)+
        '</div>'+
        buildReportQrHtml(link, c.isAr)+
      '</div>'+
    '</div>';
}
function renderTechReportProjectInfoSection(){
  var centralized = getCentralizedReportMeta(getEffectiveReportLanguage());
  var meta = centralized.meta;
  return ''+
    '<section class="tech-doc-section" data-report-source="'+centralized.source+'">'+
      '<div class="tech-doc-section-head">'+(lang==='ar' ? 'بيانات المشروع' : 'Project Information')+'</div>'+
      '<div class="tech-doc-grid meta">'+
        '<div class="tech-doc-cell"><span>'+(lang==='ar'?'اسم المشروع':'Project Name')+'</span><strong>'+esc(meta.projectName)+'</strong></div>'+
        '<div class="tech-doc-cell"><span>'+(lang==='ar'?'رقم المشروع':'Project Number')+'</span><strong>'+esc(meta.projectNo)+'</strong></div>'+
        '<div class="tech-doc-cell"><span>'+(lang==='ar'?'اسم العميل':'Client Name')+'</span><strong>'+esc(meta.clientName)+'</strong></div>'+
        '<div class="tech-doc-cell"><span>'+(lang==='ar'?'الموقع':'Location')+'</span><strong>'+esc(meta.location)+'</strong></div>'+
        '<div class="tech-doc-cell"><span>'+(lang==='ar'?'المدينة':'City')+'</span><strong>'+esc(meta.city)+'</strong></div>'+
        '<div class="tech-doc-cell"><span>'+(lang==='ar'?'نوع المبنى':'Building Type')+'</span><strong>'+esc(meta.buildingType)+'</strong></div>'+
        '<div class="tech-doc-cell"><span>'+(lang==='ar'?'المهندس':'Engineer')+'</span><strong>'+esc(meta.engineer)+'</strong></div>'+
        '<div class="tech-doc-cell"><span>'+(lang==='ar'?'المصمم':'Designer')+'</span><strong>'+esc(meta.designer)+'</strong></div>'+
        '<div class="tech-doc-cell"><span>'+(lang==='ar'?'مرجع التقرير':'Report Reference')+'</span><strong>'+esc(meta.reportReference)+'</strong></div>'+
        '<div class="tech-doc-cell"><span>'+(lang==='ar'?'التاريخ':'Date')+'</span><strong>'+esc(meta.date)+'</strong></div>'+
      '</div>'+
    '</section>';
}
function getTechReportSummaryMetrics(){
  ensureExpandedLegacyRoomsLive();
  var centralized = getCentralizedReportSummary();
  var totalLoadBtu = getProjectRequiredLoadBtu();
  var totalLoadTr = totalLoadBtu / 12000;
  var totalRequiredCfm = getProjectRequiredLoadCfm();
  var selectedBtu = getSelectedProjectEquipmentBtu();
  var selectedTr = getSelectedProjectEquipmentTr();
  var selectedCfm = getSelectedProjectEquipmentCfm();
  if(centralized.summary){
    totalLoadBtu = centralized.summary.coolingLoadBtuH || totalLoadBtu;
    totalLoadTr = centralized.summary.coolingLoadTr || (totalLoadBtu / 12000);
    totalRequiredCfm = centralized.summary.supplyCfm || totalRequiredCfm;
    selectedBtu = centralized.summary.selectedCapacityBtuH || selectedBtu;
    selectedTr = centralized.summary.selectedCapacityTr || (selectedBtu / 12000);
    selectedCfm = centralized.summary.selectedSupplyCfm || selectedCfm;
  }
  var projectStatus = getProjectCapacityStatus(totalLoadBtu, selectedBtu);
  var validation = getProjectEngineeringValidation();
  var roomCount = hist.length;
  var unitCount = 0;
  if(isProjectHvacMode()){
    unitCount = ensureProjectSystems().reduce(function(sum, system){
      return sum + Math.max(1, parseInt(system.qty,10) || 1);
    }, 0);
  } else {
    hist.forEach(function(h, i){
      var state = getRoomSystemState(i);
      (state.systems || []).forEach(function(system){
        unitCount += Math.max(1, parseInt(system.qty,10) || 1);
      });
    });
  }
  var warnings = (validation.items || []).filter(function(item){
    return item && (item.status === 'warning' || item.status === 'fail');
  }).length;
  return {
    totalLoadBtu: totalLoadBtu,
    totalLoadTr: totalLoadTr,
    totalRequiredCfm: totalRequiredCfm,
    selectedBtu: selectedBtu,
    selectedTr: selectedTr,
    selectedCfm: selectedCfm,
    roomCount: roomCount,
    unitCount: unitCount,
    projectStatus: projectStatus,
    warnings: warnings,
    safetyMarginPct: projectStatus.percent || 0
  };
}
function getCentralizedReportSummary(){
  var reportData = window._lastProfessionalReportData || refreshProfessionalReportDataCache({ language: getEffectiveReportLanguage() });
  var reportSummary = reportData && reportData.summary ? reportData.summary : null;
  if(!reportSummary) return { summary: null, source: 'legacy-report-summary' };
  return {
    source: 'professional-report-summary',
    summary: {
      coolingLoadBtuH: Number(reportSummary.coolingLoadBtuH || 0),
      coolingLoadTr: Number(reportSummary.coolingLoadTr || (Number(reportSummary.coolingLoadBtuH || 0) / 12000) || 0),
      supplyCfm: Number(reportSummary.supplyCfm || 0),
      outdoorAirCfm: Number(reportSummary.outdoorAirCfm || 0),
      exhaustCfm: Number(reportSummary.exhaustCfm || 0),
      selectedCapacityBtuH: Number(reportSummary.selectedCapacityBtuH || 0),
      selectedCapacityTr: Number(reportSummary.selectedCapacityTr || (Number(reportSummary.selectedCapacityBtuH || 0) / 12000) || 0),
      selectedSupplyCfm: Number(reportSummary.selectedSupplyCfm || 0),
      engineeringHealthScore: Number(reportSummary.engineeringHealthScore || 0)
    }
  };
}
function renderTechReportDashboardSummarySection(){
  var m = getTechReportSummaryMetrics();
  var tone = m.projectStatus.key === 'matched' ? 'pass' : (m.projectStatus.key === 'undersized' ? 'fail' : 'review');
  var cards = [
    { label: lang==='ar' ? 'إجمالي حمل التبريد' : 'Total Cooling Load', value: Number(m.totalLoadBtu||0).toLocaleString() + ' BTU/h' },
    { label: lang==='ar' ? 'إجمالي السعة المختارة' : 'Total Selected Capacity', value: Number(m.selectedBtu||0).toLocaleString() + ' BTU' },
    { label: lang==='ar' ? 'إجمالي CFM' : 'Total CFM', value: Number(m.totalRequiredCfm||0).toLocaleString() + ' CFM' },
    { label: lang==='ar' ? 'إجمالي TR' : 'Total TR', value: m.totalLoadTr.toFixed(2) + ' TR' },
    { label: lang==='ar' ? 'عدد الغرف' : 'Number of Rooms', value: String(m.roomCount) },
    { label: lang==='ar' ? 'عدد الوحدات' : 'Number of Units', value: String(m.unitCount) },
    { label: lang==='ar' ? 'مطابقة السعة فقط' : 'Capacity match only', value: m.projectStatus.label, tone:tone },
    { label: lang==='ar' ? 'فرق السعة عن الحمل' : 'Capacity difference from load', value: (m.safetyMarginPct >= 0 ? '+' : '') + m.safetyMarginPct.toFixed(1) + '%' }
  ];
  return '<section class="tech-doc-section">'+
    '<div class="tech-doc-section-head">'+(lang==='ar' ? 'ملخص المشروع التنفيذي' : 'Executive Project Summary')+'</div>'+
    '<div class="tech-report-summary-grid">'+
      cards.map(function(card){
        return '<div class="tech-report-summary-card'+(card.tone ? (' is-'+card.tone) : '')+(String(card.value).length>35?' is-text-value':'')+'"><span>'+esc(card.label)+'</span><strong>'+esc(card.value)+'</strong></div>';
      }).join('')+
    '</div>'+
  '</section>';
}
function renderTechReportChartsSection(){
  if(!hist.length){
    return '<section class="tech-doc-section"><div class="tech-doc-section-head">'+(lang==='ar'?'الرسوم الهندسية':'Engineering Charts')+'</div><div class="tech-doc-empty">'+(lang==='ar'?'لا توجد بيانات كافية لإظهار الرسوم بعد.' :'Not enough data to render charts yet.')+'</div></section>';
  }
  var colors = ['#2ea8e5','#0ea5e9','#22c55e','#f59e0b','#8b5cf6','#ef4444','#14b8a6','#64748b'];
  var totalBtu = Math.max(1, getProjectRequiredLoadBtu());
  var maxRoomBtu = 1;
  var maxRoomCfm = 1;
  var projectMode = isProjectHvacMode();
  var rooms = hist.map(function(h, i){
    var state = getRoomSystemState(i);
    var requiredBtu = getQuoteRequiredBtu(i);
    var requiredCfm = getRoomRequiredCfm(i);
    var selectedBtu = projectMode ? 0 : Number(state.selectedCapacityBtu || 0);
    var name = ((lang==='ar' ? (h.ar || h.en) : (h.en || h.ar)) || (lang==='ar' ? 'Room' : 'Room')).replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/gu,'').trim();
    maxRoomBtu = Math.max(maxRoomBtu, requiredBtu, selectedBtu);
    maxRoomCfm = Math.max(maxRoomCfm, requiredCfm);
    return { name:name, requiredBtu:requiredBtu, selectedBtu:selectedBtu, requiredCfm:requiredCfm };
  });
  var pieStops = [];
  var legends = [];
  var cursor = 0;
  rooms.forEach(function(room, idx){
    var pct = (room.requiredBtu / totalBtu) * 100;
    var next = cursor + pct;
    var color = colors[idx % colors.length];
    pieStops.push(color + ' ' + cursor.toFixed(2) + '% ' + next.toFixed(2) + '%');
    legends.push('<div class="tech-chart-legend-item"><span class="swatch" style="background:'+color+'"></span><strong>'+esc(room.name)+'</strong><span>'+pct.toFixed(1)+'%</span></div>');
    cursor = next;
  });
  var validationCounts = { matched:0, review:0, undersized:0, oversized:0 };
  rooms.forEach(function(room){
    var st = getCapacityStatus(room.requiredBtu, room.selectedBtu);
    if(st.key === 'matched') validationCounts.matched++;
    else if(st.key === 'undersized') validationCounts.undersized++;
    else if(st.key === 'oversized'){
      if(Number(st.delta || 0) <= 20) validationCounts.review++;
      else validationCounts.oversized++;
    }
  });
  var totalStatuses = Math.max(1, validationCounts.matched + validationCounts.review + validationCounts.undersized + validationCounts.oversized);
  var selectedCapacityCard = projectMode
    ? '<div class="tech-chart-card"><div class="tech-chart-title">'+(lang==='ar'?'السعة المركزية المختارة مقابل الحمل الكلي':'Central Selected Capacity vs Total Load')+'</div><div class="tech-bars-list"><div class="tech-bar-row"><div class="tech-bar-head"><strong>'+(lang==='ar'?'المشروع بالكامل':'Entire Project')+'</strong><span>'+Number(totalBtu||0).toLocaleString()+' / '+Number(getSelectedProjectEquipmentBtu()||0).toLocaleString()+' BTU</span></div><div class="tech-bar-track"><span class="tech-bar-fill required" style="width:100%"></span><span class="tech-bar-fill selected" style="width:'+((Math.max(0,getSelectedProjectEquipmentBtu())/Math.max(1,totalBtu))*100).toFixed(1)+'%"></span></div></div></div></div>'
    : '<div class="tech-chart-card"><div class="tech-chart-title">'+(lang==='ar'?'BTU المطلوب مقابل المختار لكل غرفة':'Required BTU vs Selected BTU per Room')+'</div><div class="tech-bars-list">'+rooms.map(function(room){ return '<div class="tech-bar-row"><div class="tech-bar-head"><strong>'+esc(room.name)+'</strong><span>'+Number(room.requiredBtu||0).toLocaleString()+' / '+Number(room.selectedBtu||0).toLocaleString()+' BTU</span></div><div class="tech-bar-track"><span class="tech-bar-fill required" style="width:'+((room.requiredBtu/maxRoomBtu)*100).toFixed(1)+'%"></span><span class="tech-bar-fill selected" style="width:'+((room.selectedBtu/maxRoomBtu)*100).toFixed(1)+'%"></span></div></div>'; }).join('')+'</div></div>';
  return '<section class="tech-doc-section">'+
    '<div class="tech-doc-section-head">'+(lang==='ar' ? 'الرسوم والتحليلات الهندسية' : 'Engineering Charts & Analytics')+'</div>'+
    '<div class="tech-report-charts-grid">'+
      '<div class="tech-chart-card"><div class="tech-chart-title">'+(lang==='ar'?'توزيع حمل التبريد لكل غرفة':'Cooling Load Distribution per Room')+'</div><div class="tech-pie-layout"><div class="tech-pie-chart" style="background:conic-gradient('+pieStops.join(',')+')"></div><div class="tech-chart-legend">'+legends.join('')+'</div></div></div>'+
      selectedCapacityCard+
      '<div class="tech-chart-card"><div class="tech-chart-title">'+(lang==='ar'?'توزيع CFM للغرف':'CFM Distribution Chart')+'</div><div class="tech-bars-list">'+rooms.map(function(room){ return '<div class="tech-bar-row"><div class="tech-bar-head"><strong>'+esc(room.name)+'</strong><span>'+Number(room.requiredCfm||0).toLocaleString()+' CFM</span></div><div class="tech-bar-track single"><span class="tech-bar-fill cfm" style="width:'+((room.requiredCfm/maxRoomCfm)*100).toFixed(1)+'%"></span></div></div>'; }).join('')+'</div></div>'+
      '<div class="tech-chart-card"><div class="tech-chart-title">'+(lang==='ar'?'حالات المطابقة':'Validation Status Chart')+'</div><div class="tech-status-stack"><span class="stack-pass" style="width:'+((validationCounts.matched/totalStatuses)*100).toFixed(1)+'%"></span><span class="stack-review" style="width:'+((validationCounts.review/totalStatuses)*100).toFixed(1)+'%"></span><span class="stack-fail" style="width:'+((validationCounts.undersized/totalStatuses)*100).toFixed(1)+'%"></span><span class="stack-over" style="width:'+((validationCounts.oversized/totalStatuses)*100).toFixed(1)+'%"></span></div><div class="tech-chart-legend compact"><div class="tech-chart-legend-item"><span class="swatch stack-pass"></span><strong>'+(lang==='ar'?'مطابق':'Matched')+'</strong><span>'+validationCounts.matched+'</span></div><div class="tech-chart-legend-item"><span class="swatch stack-review"></span><strong>'+(lang==='ar'?'مراجعة':'Review')+'</strong><span>'+validationCounts.review+'</span></div><div class="tech-chart-legend-item"><span class="swatch stack-fail"></span><strong>'+(lang==='ar'?'أقل من المطلوب':'Undersized')+'</strong><span>'+validationCounts.undersized+'</span></div><div class="tech-chart-legend-item"><span class="swatch stack-over"></span><strong>'+(lang==='ar'?'أعلى من المطلوب':'Oversized')+'</strong><span>'+validationCounts.oversized+'</span></div></div></div>'+
    '</div>'+
  '</section>';
}
function renderTechReportRoomLoadTable(){
  if(!hist.length){
    return '<section class="tech-doc-section"><div class="tech-doc-section-head">'+(lang==='ar'?'جدول أحمال الغرف':'Room Load Table')+'</div><div class="tech-doc-empty">'+(lang==='ar'?'لا توجد غرف محسوبة بعد.' :'No calculated rooms yet.')+'</div></section>';
  }
  var reportData = window._lastProfessionalReportData || refreshProfessionalReportDataCache({ language: getEffectiveReportLanguage() });
  var reportRooms = reportData && Array.isArray(reportData.rooms) ? reportData.rooms : [];
  var projectMode = isProjectHvacMode();
  var selectedCols = projectMode ? '' : '<th>'+(lang==='ar'?'BTU المختار':'Selected BTU')+'</th><th>'+(lang==='ar'?'نوع الوحدة':'Unit Type')+'</th>';
  if(reportRooms.length){
    var reportRows = reportRooms.map(function(room, i){
      var sourceRoom = hist[i] || {};
      var state = getRoomSystemState(i);
      var status = getWorkflowStatusMeta(i, state);
      var presetMeta = getRecordEquipmentPresetMeta(sourceRoom);
      var presetNoteHtml = presetMeta
        ? '<div class="tech-doc-inline-note tech-doc-preset-note">'+(lang==='ar'?'أجهزة افتراضية محسوبة: ':'Default equipment included: ')+esc(presetMeta.names.join('، '))+' · '+Number(presetMeta.totalBtu||0).toLocaleString()+' BTU/h</div>'
        : '';
      var tempRhParts = [];
      if(Array.isArray(room.temperatureRangeC) && room.temperatureRangeC.length >= 2) tempRhParts.push(room.temperatureRangeC[0] + '-' + room.temperatureRangeC[1] + ' °C');
      if(Array.isArray(room.humidityRangeRh) && room.humidityRangeRh.length >= 2) tempRhParts.push(room.humidityRangeRh[0] + '-' + room.humidityRangeRh[1] + '% RH');
      var tempRh = tempRhParts.length ? tempRhParts.join(' · ') : '—';
      var selectedCells = projectMode ? '' : '<td>'+Number(room.selectedCapacityBtuH || 0).toLocaleString()+'</td><td>'+esc(getReportAssignedSystemLabel(i))+'</td>';
      return '<tr>'+
        '<td>'+esc((room.name || (lang==='ar'?'غرفة':'Room')) + (room.quantity > 1 ? (' × ' + room.quantity) : ''))+presetNoteHtml+'</td>'+
        '<td>'+(Number(room.areaM2 || 0) > 0 ? Number(room.areaM2).toLocaleString()+' m²' : '—')+'</td>'+
        '<td>'+Number(room.coolingLoadBtuH || 0).toLocaleString()+'</td>'+
        selectedCells+
        '<td>'+Number(room.coolingLoadTr || 0).toFixed(2)+'</td>'+
        '<td>'+Number(room.supplyCfm || 0).toLocaleString()+'</td>'+
        '<td>'+(Number(room.outdoorAirCfm || 0) > 0 ? Number(room.outdoorAirCfm).toLocaleString()+' CFM' : '—')+'</td>'+
        '<td>'+(Number(room.exhaustCfm || 0) > 0 ? Number(room.exhaustCfm).toLocaleString()+' CFM' : '—')+'</td>'+
        '<td>'+(room.totalAch != null && Number(room.totalAch || 0) > 0 ? esc(String(room.totalAch)) : '—')+'</td>'+
        '<td>'+esc(getPressureLabel(room.pressureRelationship || sourceRoom.pressure || sourceRoom.pres || ''))+'</td>'+
        '<td>'+esc(tempRh)+'</td>'+
        '<td><span class="calc-room-status-pill is-'+status.tone+'">'+esc(status.label)+'</span></td>'+
      '</tr>';
    }).join('');
    return ''+
      '<section class="tech-doc-section">'+
        '<div class="tech-doc-section-head">'+(lang==='ar' ? 'جدول أحمال الغرف' : 'Room Load Table')+'</div>'+
        '<div class="tech-doc-table-wrap"><table class="tech-doc-table" data-report-source="professional-report-data"><thead><tr>'+
        '<th>'+(lang==='ar'?'الغرفة':'Room')+'</th>'+
        '<th>'+(lang==='ar'?'المساحة':'Area')+'</th>'+
        '<th>'+(lang==='ar'?'BTU/h المطلوب':'BTU/h Required')+'</th>'+
        selectedCols+
        '<th>TR</th><th>CFM</th>'+
        '<th>'+(lang==='ar'?'هواء خارجي':'Outdoor Air')+'</th>'+
        '<th>'+(lang==='ar'?'عادم':'Exhaust')+'</th>'+
        '<th>ACH</th>'+
        '<th>'+(lang==='ar'?'الضغط':'Pressure')+'</th>'+
        '<th>'+(lang==='ar'?'الحرارة / الرطوبة':'Temp / RH')+'</th>'+
        '<th>'+(lang==='ar'?'الحالة':'Status')+'</th>'+
        '</tr></thead><tbody>'+reportRows+'</tbody></table></div>'+
      '</section>';
  }
  var projectMode = isProjectHvacMode();
  var rows = hist.map(function(h, i){
    var rc = Math.max(1, parseInt(h.roomCount,10) || 1);
    var area = getWorkflowRoomArea(h);
    var state = getRoomSystemState(i);
    var status = getWorkflowStatusMeta(i, state);
    var name = ((lang==='ar' ? (h.ar || h.en) : (h.en || h.ar)) || (lang==='ar' ? 'غرفة' : 'Room')).replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/gu,'').trim();
    var pressure = h.pressure || h.pres || (lang === 'ar' ? 'غير منطبق' : 'N/A');
    var presetMeta = getRecordEquipmentPresetMeta(h);
    var presetNoteHtml = presetMeta
      ? '<div class="tech-doc-inline-note tech-doc-preset-note">'+(lang==='ar'?'أجهزة افتراضية محسوبة: ':'Default equipment included: ')+esc(presetMeta.names.join('، '))+' · '+Number(presetMeta.totalBtu||0).toLocaleString()+' BTU/h</div>'
      : '';
    return '<tr>'+
      '<td>'+esc(name + (rc > 1 ? (' × ' + rc) : ''))+presetNoteHtml+'</td>'+
      '<td>'+(area ? Number(area).toLocaleString()+' m²' : '—')+'</td>'+
      '<td>'+Number(getQuoteRequiredBtu(i) || 0).toLocaleString()+'</td>'+
      '<td>'+(Number(getQuoteRequiredBtu(i) || 0)/12000).toFixed(2)+'</td>'+
      '<td>'+Number(((parseInt(h.cfm,10)||0) * rc) || 0).toLocaleString()+'</td>'+
      '<td>'+esc(formatReportOutdoorAir(h, rc))+'</td>'+
      '<td>'+esc(formatReportExhaust(h, rc))+'</td>'+
      '<td>'+(h.ach != null ? esc(String(h.ach)) : '—')+'</td>'+
      '<td>'+esc(getPressureLabel(pressure))+'</td>'+
      '<td>'+esc(formatReportTempRh(h))+'</td>'+
      '<td><span class="calc-room-status-pill is-'+status.tone+'">'+esc(status.label)+'</span></td>'+
    '</tr>';
  }).join('');
  var selectedCols = projectMode ? '' : '<th>'+(lang==='ar'?'BTU المختار':'Selected BTU')+'</th><th>'+(lang==='ar'?'نوع الوحدة':'Unit Type')+'</th>';
  if(!projectMode){
    rows = hist.map(function(h, i){
      var rc = Math.max(1, parseInt(h.roomCount,10) || 1);
      var area = getWorkflowRoomArea(h);
      var state = getRoomSystemState(i);
      var status = getWorkflowStatusMeta(i, state);
      var name = ((lang==='ar' ? (h.ar || h.en) : (h.en || h.ar)) || (lang==='ar' ? 'غرفة' : 'Room')).replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/gu,'').trim();
      var pressure = h.pressure || h.pres || (lang === 'ar' ? 'غير منطبق' : 'N/A');
      var presetMeta = getRecordEquipmentPresetMeta(h);
      var presetNoteHtml = presetMeta
        ? '<div class="tech-doc-inline-note tech-doc-preset-note">'+(lang==='ar'?'أجهزة افتراضية محسوبة: ':'Default equipment included: ')+esc(presetMeta.names.join('، '))+' · '+Number(presetMeta.totalBtu||0).toLocaleString()+' BTU/h</div>'
        : '';
      return '<tr>'+
        '<td>'+esc(name + (rc > 1 ? (' × ' + rc) : ''))+presetNoteHtml+'</td>'+
        '<td>'+(area ? Number(area).toLocaleString()+' m²' : '—')+'</td>'+
        '<td>'+Number(getQuoteRequiredBtu(i) || 0).toLocaleString()+'</td>'+
        '<td>'+Number(state.selectedCapacityBtu || 0).toLocaleString()+'</td>'+
        '<td>'+(Number(getQuoteRequiredBtu(i) || 0)/12000).toFixed(2)+'</td>'+
        '<td>'+Number(((parseInt(h.cfm,10)||0) * rc) || 0).toLocaleString()+'</td>'+
        '<td>'+esc(formatReportOutdoorAir(h, rc))+'</td>'+
        '<td>'+esc(formatReportExhaust(h, rc))+'</td>'+
        '<td>'+(h.ach != null ? esc(String(h.ach)) : '—')+'</td>'+
        '<td>'+esc(getPressureLabel(pressure))+'</td>'+
        '<td>'+esc(formatReportTempRh(h))+'</td>'+
        '<td>'+esc(getReportAssignedSystemLabel(i))+'</td>'+
        '<td><span class="calc-room-status-pill is-'+status.tone+'">'+esc(status.label)+'</span></td>'+
      '</tr>';
    }).join('');
  }
  return ''+
    '<section class="tech-doc-section">'+
      '<div class="tech-doc-section-head">'+(lang==='ar' ? 'جدول أحمال الغرف' : 'Room Load Table')+'</div>'+
      '<div class="tech-doc-table-wrap"><table class="tech-doc-table"><thead><tr>'+
      '<th>'+(lang==='ar'?'الغرفة':'Room')+'</th>'+
      '<th>'+(lang==='ar'?'المساحة':'Area')+'</th>'+
      '<th>'+(lang==='ar'?'BTU/h المطلوب':'BTU/h Required')+'</th>'+
      selectedCols+
      '<th>TR</th><th>CFM</th>'+
      '<th>'+(lang==='ar'?'هواء خارجي':'Outdoor Air')+'</th>'+
      '<th>'+(lang==='ar'?'عادم':'Exhaust')+'</th>'+
      '<th>ACH</th>'+
      '<th>'+(lang==='ar'?'الضغط':'Pressure')+'</th>'+
      '<th>'+(lang==='ar'?'الحرارة / الرطوبة':'Temp / RH')+'</th>'+
      '<th>'+(lang==='ar'?'الحالة':'Status')+'</th>'+
      '</tr></thead><tbody>'+rows+'</tbody></table></div>'+
    '</section>';
}
function renderTechReportEngineeringSummary(){
  var centralized = getCentralizedReportSummary();
  var totalBtu = getProjectRequiredLoadBtu();
  var totalCfm = getProjectRequiredLoadCfm();
  var selectedBtu = getSelectedProjectEquipmentBtu();
  var selectedCfm = getSelectedProjectEquipmentCfm();
  if(centralized.summary){
    totalBtu = centralized.summary.coolingLoadBtuH || totalBtu;
    totalCfm = centralized.summary.supplyCfm || totalCfm;
    selectedBtu = centralized.summary.selectedCapacityBtuH || selectedBtu;
    selectedCfm = centralized.summary.selectedSupplyCfm || selectedCfm;
  }
  var status = getProjectCapacityStatus(totalBtu, selectedBtu);
  return ''+
    '<section class="tech-doc-section">'+
      '<div class="tech-doc-section-head">'+(lang==='ar' ? 'الملخص الهندسي' : 'Engineering Summary')+'</div>'+
      '<div class="tech-doc-reasoning">'+
        '<div class="tech-doc-reason"><strong>'+(lang==='ar'?'فحص السعة':'Capacity Check')+'</strong><span>'+(lang==='ar'?'الحمل المطلوب':'Required Load')+': '+Number(totalBtu||0).toLocaleString()+' BTU/h</span><span>'+(lang==='ar'?'السعة المختارة':'Selected Capacity')+': '+Number(selectedBtu||0).toLocaleString()+' BTU</span><span>'+(lang==='ar'?'الفرق':'Difference')+': '+(status.difference>=0?'+':'')+Number(status.difference||0).toLocaleString()+' BTU · '+(status.percentText||'0.0%')+'</span><span>'+esc(status.label)+'</span></div>'+
        '<div class="tech-doc-reason"><strong>'+(lang==='ar'?'فحص الهواء':'Airflow Check')+'</strong><span>'+(lang==='ar'?'الهواء المطلوب':'Required Airflow')+': '+Number(totalCfm||0).toLocaleString()+' CFM</span><span>'+(lang==='ar'?'الهواء المختار':'Selected Airflow')+': '+Number(selectedCfm||0).toLocaleString()+' CFM</span><span>'+(selectedCfm >= totalCfm ? (lang==='ar'?'تدفق الهواء يحقق الحد الأدنى المطلوب.' :'Selected airflow meets the minimum requirement.') : (lang==='ar'?'تدفق الهواء أقل من المطلوب ويحتاج مراجعة.' :'Selected airflow is below the required minimum and should be reviewed.'))+'</span></div>'+
      '</div>'+
    '</section>';
}

function renderReportAlertEditor(alert){
  var rule = String(alert.sourceRule || '') + ' ' + String(alert.title || '');
  if(alert.sourceRule === 'preliminary_load_basis') return '<button type="button" class="no-print" onclick="openDesktopView(\'home\')">'+(lang==='ar'?'مراجعة بيانات الغرف والأحمال':'Review room inputs and loads')+'</button>';
  if(alert.sourceRule === 'missing_equipment_snapshot' || alert.sourceRule === 'Manufacturer Recommendation Engine') return '<button type="button" class="no-print" onclick="openDesktopView(\'hist\')">'+(lang==='ar'?'مراجعة خيارات عرض السعر':'Review quotation options')+'</button>';
  if(/airflow|selected_cfm|CFM Check|تدفق الهواء/i.test(rule)) return '<div class="no-print"><button type="button" onclick="scrollTechnicalReportSection(\'report-equipment\')">'+(lang==='ar'?'مراجعة تدفق المعدة واختيار البديل':'Review equipment airflow and alternatives')+'</button><button type="button" onclick="scrollTechnicalReportSection(\'report-air\')">'+(lang==='ar'?'مراجعة توزيع الهواء':'Review air distribution')+'</button><p>'+(lang==='ar'?'تعديل مقاس الدكت يغير السرعة وفقد الضغط؛ لا يغير تدفق المعدة المسجل.':'Duct dimensions affect velocity and pressure loss; they do not change recorded equipment airflow.')+'</p>'+renderReportDuctEditor()+'</div>';
  if(/duct|مجار|دكت/i.test(rule)) return '<button type="button" onclick="openHealthMetricEditor(\'airflow\')">'+(lang==='ar'?'تعديل الدكت والفلتر':'Edit duct and filter')+'</button>';
  if(!/capacity|السعة/i.test(rule)) return '';
  var systems = isProjectHvacMode() ? ensureProjectSystems() : [];
  if(!isProjectHvacMode()) hist.forEach(function(room,index){
    ensureRoomSystems(index).forEach(function(system){systems.push(Object.assign({},system,{reportRoomIndex:index}));});
  });
  return systems.map(function(system){
    return '<form class="report-inline-editor" onsubmit="return applyReportCapacityAction(this)">'+
      '<input type="hidden" name="systemId" value="'+esc(system.id)+'">'+
      '<input type="hidden" name="roomIndex" value="'+(system.reportRoomIndex == null ? '' : system.reportRoomIndex)+'">'+
      '<label>'+esc(system.reportRoomIndex == null ? getProjectSystemDisplayName(system.id) : ((lang==='ar'?'الغرفة ':'Room ')+(system.reportRoomIndex+1)))+' · BTU/h'+
      '<input name="capacity" aria-label="BTU/h" type="number" min="1" step="1" required value="'+getSelectedUnitCapacityBtu(system)+'"></label>'+
      '<button type="submit">'+(lang==='ar'?'تطبيق السعة':'Apply capacity')+'</button></form>';
  }).join('') || '<button type="button" onclick="openDesktopView(\'home\')">'+(lang==='ar'?'تعديل سعات الغرف':'Edit room capacities')+'</button>';
}

function applyReportCapacityAction(form){
  var value = Number(form.elements.capacity.value);
  if(!Number.isFinite(value) || value <= 0) return false;
  var roomIndex = form.elements.roomIndex && form.elements.roomIndex.value;
  if(roomIndex != null && roomIndex !== ''){
    var system = ensureRoomSystems(Number(roomIndex)).find(function(entry){return entry.id === form.elements.systemId.value;});
    if(!system) return false;
    system.equipmentSnapshot = null;
    system.equipmentDatabaseId = '';
    system.equipmentId = '';
    system.selectedEquipmentId = '';
    system.selectedEquipmentOption = null;
    system.selectedManufacturer = '';
    system.selectedModel = '';
    system.conceptualScenarioSnapshot = null;
    system.selectionMode = 'manual';
    system.manualCapacity = true;
    system.manualCapacityBtuH = value;
    system.selectedBtu = value;
    system.selectedCapacityBtuH = value;
    system.selectedCapacityTr = value / 12000;
    system.selectedAirflowCfm = getEstimatedUnitAirflowCfm(system);
    system.totalInstalledCapacityBtuH = value * system.qty;
    system.totalInstalledAirflowCfm = system.selectedAirflowCfm * system.qty;
    system.finalEquipmentCapacityBtuH = 0;
    updateRoomSystem(Number(roomIndex),system.id,'selectedBtu',value);
  }
  else applyProjectSystemManualCapacity(form.elements.systemId.value, value);
  renderTechReportFoundation();
  return false;
}

function getReportDuctSuggestions(side){
  var cache = window._lastDuctSizing || {};
  var cfm = Number(side === 'sup' ? cache.supCfm : cache.retCfm);
  var velocity = Number(side === 'sup' ? cache.vSup : cache.vRet);
  if(['sup','ret'].indexOf(side)<0 || !Number.isFinite(cfm) || !Number.isFinite(velocity) || cfm<=0 || velocity<=0) return [];
  // Q / V gives area in ft2; 92903.04 converts ft2 to mm2.
  var area = cfm / velocity * 92903.04;
  var candidates = [], seen = {};
  for(var h=150; h<=1800; h+=50){
    var w = Math.max(h, Math.ceil(area / h / 50) * 50);
    if(w>1800 || w/h>ASHRAE_RECT_MAX_RATIO) continue;
    var key=w+'x'+h;
    if(seen[key]) continue;
    seen[key]=true;
    candidates.push(_makeDuctCandidate(w,h,area,cfm,velocity,'suggested'));
  }
  return candidates.sort(function(a,b){return a.area_actual-b.area_actual || Number(a.ratio)-Number(b.ratio);}).slice(0,3);
}

function selectReportDuctSuggestion(side,index){
  var candidate = getReportDuctSuggestions(side)[index];
  if(!candidate) return false;
  return applyReportDuctAction({elements:{side:{value:side},width:{value:candidate.w},height:{value:candidate.h}}});
}

function calculateFilterAirflow(q, operatingPa, shutoffPa, filterPa){
  if(![q,operatingPa,shutoffPa,filterPa].every(Number.isFinite) || q<=0 || operatingPa<=0 || shutoffPa<=operatingPa || filterPa<0) return null;
  // Linear fan approximation through shutoff and the original duty point;
  // baseline system and filter resistance scale with flow squared.
  var a=operatingPa+filterPa, b=shutoffPa-operatingPa;
  var ratio=2*shutoffPa/(b+Math.sqrt(b*b+4*a*shutoffPa));
  return {cfm:q*ratio,lossPercent:(1-ratio)*100};
}
function applyReportFilter(form){
  var data={type:form.elements.filterType.value,drop:Number(form.elements.drop.value),operating:Number(form.elements.operating.value),shutoff:Number(form.elements.shutoff.value)};
  if(!['none','H13','H14','other'].includes(data.type)) return false;
  if(data.type!=='none' && (!form.reportValidity() || ![data.drop,data.operating,data.shutoff].every(Number.isFinite) || data.shutoff<=data.operating)) {
    form.elements.shutoff.setCustomValidity(lang==='ar'?'ضغط الإغلاق يجب أن يتجاوز ضغط نقطة التشغيل.':'Shutoff pressure must exceed duty pressure.');
    form.elements.shutoff.reportValidity();return false;
  }
  projState.ductFilter=data;persistQuoteState();renderTechReportFoundation();return false;
}
function renderReportFilterEditor(){
  return '<section class="tech-doc-section">'+renderInlineAirflowControls()+'</section>';
}

function getDuctFanTypes(){
  return [
    {id:'unspecified',ar:'اختر نوع المروحة',en:'Select fan type'},
    {id:'centrifugal_backward',ar:'طرد مركزي — ريش منحنية للخلف',en:'Centrifugal — backward curved'},
    {id:'centrifugal_forward',ar:'طرد مركزي — ريش منحنية للأمام',en:'Centrifugal — forward curved'},
    {id:'plug',ar:'مروحة بلَغ / بلينم',en:'Plug / plenum fan'},
    {id:'axial',ar:'مروحة محورية',en:'Axial fan'},
    {id:'mixed_flow',ar:'مروحة مختلطة التدفق',en:'Mixed-flow fan'},
    {id:'other',ar:'نوع آخر / يدوي',en:'Other / manual'}
  ];
}
function getDuctFilterReviewState(){
  var cache=window._lastDuctSizing || {},f=projState.ductFilter || {type:'none'};
  var q=Number(getSelectedProjectEquipmentCfm() || cache.supCfm || 0);
  var preset=getInlineFilterPresets().find(function(item){return item.id===f.type;});
  var count=preset && preset.pa && q>0?Math.max(1,Math.ceil(q*1.6990108/preset.flow)):0;
  var drop=f.type==='none'?0:(preset && preset.pa?(q>0?preset.pa*Math.pow(q*1.6990108/(count*preset.flow),2):null):f.drop);
  var estimate=drop!=null && f.type!=='none'?calculateFilterAirflow(q,Number(f.operating),Number(f.shutoff),Number(drop)):null;
  var sup=null,ret=null;
  ['sup','ret'].forEach(function(side){
    var size=(projState.ductDimensions || {})[side] || cache[side];
    var flow=side==='sup'?q:Number(cache.retCfm || q*0.9);
    var len=Number((G(side==='sup'?'esp-len-sup':'esp-len-ret') || {value:side==='sup'?30:20}).value);
    if(window.AppDuct && size && size.w>0 && size.h>0 && flow>0){
      var a=window.AppDuct.advancedDuctAnalysis(flow,size.w,size.h,len);
      if(side==='sup')sup=a;else ret=a;
    }
  });
  return {equipmentCfm:q,effectiveCfm:estimate?estimate.cfm:q,estimated:!!estimate,filterActive:f.type!=='none',filterReady:f.type==='none' || !!estimate,filterLossPa:drop,filterCount:count,sup:sup,ret:ret};
}
function getInlineFilterPresets(){
  return [
    {id:'none',ar:'بدون فلتر إضافي',en:'No additional filter'},
    {id:'merv11',ar:'فلتر جيبي MERV 11 — Camfil B6',en:'Bag filter MERV 11 — Camfil B6',pa:70,flow:2800},
    {id:'merv14',ar:'فلتر دقيق MERV 14 — Camfil M8',en:'Fine filter MERV 14 — Camfil M8',pa:130,flow:3400},
    {id:'hepa14',ar:'HEPA H14 — Camfil Megalam MX14',en:'HEPA H14 — Camfil Megalam MX14',pa:95,flow:605},
    {id:'other',ar:'يدوي — أدخل مقاومة الفلتر',en:'Manual — enter filter resistance'}
  ];
}
function updateInlineDuctFilter(form){
  if(!form.checkValidity()){form.reportValidity();return;}
  var q=Number((window._lastDuctSizing || {}).supCfm || 0);
  var previous=projState.ductFilter || {};
  var fanType=form.elements.fanType?form.elements.fanType.value:'unspecified';
  if(!getDuctFanTypes().some(function(item){return item.id===fanType;}))return;
  var data={type:form.elements.filterType.value,fanType:fanType};
  ['drop','operating','shutoff'].forEach(function(key){var value=form.elements[key].value;data[key]=value===''?null:Number(value);});
  if((previous.fanType || 'unspecified')!==fanType){data.operating=null;data.shutoff=null;}
  var preset=getInlineFilterPresets().find(function(item){return item.id===data.type;});
  if(!preset)return;
  if(preset.pa){
    data.count=Math.max(1,Math.ceil(q*1.6990108/preset.flow));
    data.drop=q>0?preset.pa*Math.pow(q*1.6990108/(data.count*preset.flow),2):null;
  }else if(data.type==='none')data.drop=0;
  projState.ductFilter=data;
  projState.ductDimensions=projState.ductDimensions || {};
  [['sup','width','height'],['ret','retWidth','retHeight']].forEach(function(row){
    var w=Number(form.elements[row[1]].value),h=Number(form.elements[row[2]].value);
    projState.ductDimensions[row[0]]={w:w>=100 && w<=1800?w:null,h:h>=100 && h<=1800?h:null};
  });
  persistQuoteState();renderProjBlock();calcESP();syncDuctSelectionToQuotations();renderQuote();renderAdvancedDuct();renderTechReportFoundation();
  if(window.AppHvacDesignCopilot)window.AppHvacDesignCopilot.refresh();
}
function getDuctAndFilterSnapshot(){
  var review=getDuctFilterReviewState(),cache=window._lastDuctSizing || {};
  var size=projState.ductDimensions || {};
  return {schemaVersion:'duct-filter-v1',supply:Object.assign({},size.sup || cache.sup || {}),returnDuct:Object.assign({},size.ret || cache.ret || {}),filter:Object.assign({},projState.ductFilter || {type:'none'}),review:review,espPa:window._lastEspCalc?window._lastEspCalc.totalPa:null};
}
function syncDuctSelectionToQuotations(){
  var selection=getDuctAndFilterSnapshot();
  (projectSystems || []).forEach(function(system){
    if(system.quotationDraft){
      system.quotationDraft.ductAndFilter=selection;
      if(system.quotationDraft.snapshot)system.quotationDraft.snapshot.ductAndFilter=selection;
    }
  });
  saveProjectSystems();
}
function renderDuctAndFilterSummary(isAr){
  var data=getDuctAndFilterSnapshot();
  if(!data.supply.w && !data.supply.h && !data.returnDuct.w && !data.returnDuct.h && data.filter.type==='none')return '';
  var filter=getInlineFilterPresets().find(function(item){return item.id===data.filter.type;});
  var fan=getDuctFanTypes().find(function(item){return item.id===data.filter.fanType;});
  function size(s){return (s.w || '—')+' × '+(s.h || '—')+' mm';}
  var rows=[
    [isAr?'دكت الإمداد (العرض × الارتفاع)':'Supply duct (width × height)',size(data.supply)],
    [isAr?'دكت الراجع (العرض × الارتفاع)':'Return duct (width × height)',size(data.returnDuct)],
    [isAr?'الفلتر':'Filter',filter?(isAr?filter.ar:filter.en):data.filter.type],
    [isAr?'نوع المروحة':'Fan type',fan?(isAr?fan.ar:fan.en):'—'],
    [isAr?'مقاومة الفلتر الإضافي':'Added filter resistance',data.review.filterLossPa==null?'—':Number(data.review.filterLossPa).toFixed(1)+' Pa'],
    [isAr?'تدفق المعدة قبل الفلتر':'Equipment flow before filter',Math.round(data.review.equipmentCfm)+' CFM'],
    [isAr?'التدفق التقديري بعد الفلتر':'Estimated flow after filter',data.review.estimated?Math.round(data.review.effectiveCfm)+' CFM':(data.review.filterActive?(isAr?'يلزم استكمال بيانات المروحة':'Fan data required'):(isAr?'لا يوجد فلتر إضافي':'No added filter'))],
    [isAr?'الضغط المحسوب':'Calculated pressure',data.espPa==null?'—':data.espPa+' Pa']
  ];
  return '<section class="duct-filter-summary" data-duct-filter-summary="true" style="border:1px solid #b0b0b0;border-radius:6px;padding:12px;margin:12px 0;page-break-inside:avoid"><h3 style="font-size:15px;margin:0 0 8px">'+(isAr?'الدكت والفلتر المعتمدان للتسعير والمراجعة':'Duct and filter selection for pricing and review')+'</h3><table style="width:100%;font-size:12px;border-collapse:collapse"><tbody>'+rows.map(function(row){return '<tr><th style="text-align:start;padding:5px;border-bottom:1px solid #ddd">'+esc(row[0])+'</th><td style="padding:5px;border-bottom:1px solid #ddd">'+esc(row[1])+'</td></tr>';}).join('')+'</tbody></table><small>'+(isAr?'اختيارات تصميمية؛ تقدير التدفق ليس قياسًا ميدانيًا. تكلفة التوريد والتركيب تُسعّر بشكل منفصل.':'Design selections; estimated airflow is not a field measurement. Supply and installation are priced separately.')+'</small></section>';
}
function renderDuctDesignGuidance(review, filterType, ar){
  var tips=ar?[
    ['تحديد المقاس','ابدأ بتدفق الهواء المطلوب لكل مسار، وليس بسعة التكييف وحدها. اختر العرض والارتفاع مع مراعاة السقف والعزل، وتجنب المقاطع شديدة التسطح قدر الإمكان.'],
    ['السرعة والضغط','عند ثبات التدفق، تكبير مساحة الدكت يقلل السرعة وفقد الضغط عادةً. راجع أيضًا طول المسار والأكواع والتفرعات؛ المقاس وحده لا يكفي.'],
    ['اختيار الفلتر','اختره حسب استخدام المكان ومتطلبات جودة الهواء. راجع مقاومته عند تدفق التشغيل ومقاومته النهائية الموصى بها للاستبدال، وتحقق من قدرة المروحة.'],
    ['بيانات المروحة','اختيار النوع وحده لا يحدد الأداء. أدخل ضغوط المروحة من كتالوجها لتقدير تأثير الفلتر؛ التقدير ليس بديلًا لمنحنى المصنع.']
  ]:[
    ['Duct size','Start with the required airflow for each path, not cooling capacity alone. Allow room for insulation and ceiling clearance; avoid very flat sections where practical.'],
    ['Velocity and pressure','At fixed airflow, a larger duct area generally reduces velocity and pressure loss. Also review lengths, bends and branches; dimensions alone are not enough.'],
    ['Filter selection','Select for room use and air-quality requirements. Check resistance at operating airflow and the recommended final replacement resistance against fan capability.'],
    ['Fan data','Fan type alone does not define performance. Enter catalogue fan pressures to estimate filter impact; this estimate does not replace the manufacturer curve.']
  ];
  var message=!(review.equipmentCfm>0)?(ar?'حدد تدفق المعدة أولًا حتى يمكن تقييم الدكت والفلتر.':'Set equipment airflow first to assess the duct and filter.'):
    review.filterActive&&!review.filterReady?(ar?'بيانات المروحة غير مكتملة؛ التدفق بعد الفلتر غير محسوب.':'Fan data is incomplete; post-filter airflow is not calculated.'):
    !(review.sup&&review.ret)?(ar?'أكمل عرض وارتفاع دكت الإمداد والراجع لإظهار السرعة وفقد الضغط.':'Complete supply and return dimensions to show velocity and pressure loss.'):
    (ar?'قارن السرعة وفقد الضغط بمتطلبات مشروعك وقدرة المروحة؛ تغيير المقاس لا يغير تدفق المعدة المسجل.':'Compare velocity and pressure loss with project requirements and fan capability; resizing does not change recorded equipment airflow.');
  return '<aside class="duct-design-guidance"><h4>'+(ar?'دليل اختيار الدكت والفلتر':'Duct and filter selection guide')+'</h4><dl>'+tips.map(function(tip){return '<div><dt>'+esc(tip[0])+'</dt><dd>'+esc(tip[1])+'</dd></div>';}).join('')+'</dl>'+
    (filterType==='hepa14'?'<p class="duct-guidance-hepa">'+(ar?'HEPA: تحقق من حاجة المشروع إليه ومساحة تركيبه وإحكامه وقدرة المروحة؛ ليس بديلًا مباشرًا لأي فلتر قائم.':'HEPA: verify project need, installation space, sealing and fan capability; it is not a direct replacement for every existing filter.')+'</p>':'')+
    '<p class="duct-guidance-next" role="status">'+esc(message)+'</p><small>'+(ar?'مراجعة حسابية وفق المدخلات، وليست اعتمادًا نهائيًا للتصميم.':'Calculated review based on inputs, not final design approval.')+'</small></aside>';
}
function renderInlineAirflowControls(){
  var ar=lang==='ar',cache=window._lastDuctSizing || {},f=projState.ductFilter || {type:'none'};
  var review=getDuctFilterReviewState();
  var q=review.equipmentCfm,presets=getInlineFilterPresets();
  var preset=presets.find(function(item){return item.id===f.type;}) || presets[presets.length-1];
  var count=review.filterCount;
  var drop=review.filterLossPa;
  var result=review.estimated?{cfm:review.effectiveCfm,lossPercent:(1-review.effectiveCfm/q)*100}:null;
  function dimension(name,label,value){
    var sizes=[];for(var n=100;n<=1800;n+=50)sizes.push(n);
    if(Number(value)>0 && sizes.indexOf(Number(value))<0)sizes.push(Number(value));
    sizes.sort(function(a,b){return a-b;});
    return '<label>'+label+'<select name="'+name+'"><option value="">'+(ar?'اختر المقاس':'Select size')+'</option>'+sizes.map(function(n){return '<option value="'+n+'"'+(Number(value)===n?' selected':'')+'>'+n+' mm</option>';}).join('')+'</select></label>';
  }
  function number(name,label,value,hidden){
    return '<label'+(hidden?' hidden':'')+'>'+label+'<input type="number" name="'+name+'" min="0" step="any" value="'+(value==null?'':esc(String(value)))+'"></label>';
  }
  var sup=(projState.ductDimensions || {}).sup || cache.sup || {},ret=(projState.ductDimensions || {}).ret || cache.ret || {};
  var options=presets.map(function(item){return '<option value="'+item.id+'"'+(preset.id===item.id?' selected':'')+'>'+esc(ar?item.ar:item.en)+'</option>';}).join('');
  var fanOptions=getDuctFanTypes().map(function(item){return '<option value="'+item.id+'"'+((f.fanType || 'unspecified')===item.id?' selected':'')+'>'+esc(ar?item.ar:item.en)+'</option>';}).join('');
  var fanField='<label>'+(ar?'نوع المروحة':'Fan type')+'<select name="fanType">'+fanOptions+'</select></label>';
  var status=f.type==='none'?(ar?'بدون فلتر إضافي':'No additional filter'):result?Math.round(result.cfm).toLocaleString('en-US')+' CFM · '+result.lossPercent.toFixed(1)+'% '+(ar?'انخفاض تقديري':'estimated reduction'):(ar?'أدخل بيانات المروحة وتدفق التصميم لإظهار النتيجة':'Enter fan data and design flow to show the result');
  var ductResult=renderDuctDesignGuidance(review,f.type,ar)+['sup','ret'].map(function(side){
    var size=side==='sup'?sup:ret,flow=Number(side==='sup'?q:(cache.retCfm || q*0.9));
    var length=Number((G(side==='sup'?'esp-len-sup':'esp-len-ret') || {value:side==='sup'?30:20}).value);
    var a=side==='sup'?review.sup:review.ret;
    return '<p>'+ (side==='sup'?(ar?'الإمداد':'Supply'):(ar?'الراجع':'Return'))+': <bdi>'+(a?flow.toLocaleString('en-US')+' CFM · '+a.V_ms+' m/s · '+a.dP_pa+' Pa':'—')+'</bdi></p>';
  }).join('');
  return '<h3>'+(ar?'الدكت والفلتر':'Duct and filter')+'</h3><form class="inline-duct-form" onchange="updateInlineDuctFilter(this)" onsubmit="return false"><fieldset><legend>'+(ar?'دكت الإمداد':'Supply duct')+'</legend><div class="inline-duct-primary">'+dimension('width',ar?'العرض':'Width',sup.w)+dimension('height',ar?'الارتفاع':'Height',sup.h)+'<label>'+(ar?'الفلتر':'Filter')+'<select name="filterType">'+options+'</select></label>'+fanField+'</div>'+number('drop',ar?'مقاومة الفلتر اليدوية Pa':'Manual filter resistance Pa',drop,preset.id!=='other')+'</fieldset><fieldset><legend>'+(ar?'دكت الراجع':'Return duct')+'</legend><div class="inline-duct-primary">'+dimension('retWidth',ar?'العرض':'Width',ret.w)+dimension('retHeight',ar?'الارتفاع':'Height',ret.h)+'</div></fieldset><details class="fan-curve-settings"><summary>'+(ar?'بيانات المروحة لحساب تأثير الفلتر':'Fan data for filter impact')+'</summary><p>'+(ar?'اختيار النوع لا يحدد أداء المروحة. عند تغييره أدخل ضغوط منحنى المروحة الجديدة.':'Fan type does not define performance. When changing type, enter pressure data from the new fan curve.')+'</p><div class="inline-duct-primary">'+number('operating',ar?'الضغط عند نقطة التصميم Pa':'Duty pressure Pa',f.operating,false)+number('shutoff',ar?'ضغط المروحة عند تدفق صفري Pa':'Shutoff pressure Pa',f.shutoff,false)+'</div></details></form><div class="inline-duct-result" aria-live="polite"><strong>'+(ar?'التدفق بعد الفلتر':'Flow after filter')+'</strong><p>'+status+'</p>'+ductResult+'</div><p class="copilot-note">'+(preset.pa?(ar?'مقاومة تقديرية ':'Estimated resistance ')+(drop==null?'—':drop.toFixed(1))+' Pa · '+(ar?'عدد فلاتر متوازية مقترح: ':'Suggested parallel filters: ')+count+'. ':'')+(ar?'الفلاتر المدرجة أمثلة كتالوجية وليست مقاومة ثابتة للفئة. التقدير يستخدم منحنى مقاومة تربيعي ومروحة خطية ثابتة السرعة، ولا يغني عن منحنى المصنع. تغيير الأبعاد يحدث السرعة وفقد الضغط، ولا يغير تدفق التصميم.':'Listed filters are catalogue examples, not fixed class resistance. Estimate uses quadratic resistance and a fixed-speed linear fan approximation, not a manufacturer curve. Dimensions update velocity and pressure, not design flow.')+'</p>';
}

function returnToHealthDashboard(){
  var returnButton=G('health-return-button');if(returnButton)returnButton.remove();
  if(window.AppHvacDesignCopilot) window.AppHvacDesignCopilot.refresh();
  openDesktopView('tech');
  selectTechnicalReportTopic('report-decision');
  var panel=G('hvac-design-copilot-panel');
  if(panel){panel.scrollIntoView({behavior:'smooth',block:'start'});}
}
function openHealthMetricEditor(key){
  var inlineTargets={airflow:'health-airflow-controls',esp:'health-airflow-controls',capacity:'health-capacity-controls',energy:'health-capacity-controls',electrical:'health-equipment-controls',equipmentVerification:'health-equipment-controls',dataQuality:'health-room-controls',maintainability:'health-capacity-controls'};
  if(inlineTargets[key] && G(inlineTargets[key])){
    openDesktopView('tech');selectTechnicalReportTopic('report-decision');
    var target=G(inlineTargets[key]);target.tabIndex=-1;target.scrollIntoView({behavior:'smooth',block:'start'});target.focus({preventScroll:true});return;
  }
  if(key==='airflow' || key==='esp'){
    openDesktopView('tech');selectTechnicalReportTopic('report-decision');
    var inline=G('health-airflow-controls');
    if(inline){inline.tabIndex=-1;inline.scrollIntoView({behavior:'smooth',block:'start'});inline.focus({preventScroll:true});}
    return;
  }
  var actions={airflow:['report-air','تدفق الهواء','Airflow'],capacity:['report-loads','السعة','Capacity'],energy:['report-loads','مؤشر السعة','Capacity indicator'],esp:['report-air','الضغط والدكت','Pressure and ducts'],electrical:['report-equipment','بيانات المعدة الكهربائية','Equipment electrical data'],maintainability:['report-equipment','توزيع الوحدات','Unit schedule'],equipmentVerification:['report-equipment','بيانات الكتالوج','Catalogue evidence'],dataQuality:['report-loads','بيانات الغرف','Room inputs']};
  var action=actions[key];if(!action)return;
  if(!G('health-return-button')){
    var back=document.createElement('button');back.id='health-return-button';back.type='button';
    back.textContent=lang==='ar'?'تحديث والعودة للصحة الهندسية':'Refresh and return to health';
    back.onclick=returnToHealthDashboard;document.body.appendChild(back);
  }
  openDesktopView('tech');selectTechnicalReportTopic(action[0]);
  var old=G('health-metric-editor');if(old)old.remove();
  var host=G(action[0]);if(!host)return;
  var box=document.createElement('section');box.id='health-metric-editor';box.className='tech-doc-section';box.tabIndex=-1;
  var ar=lang==='ar';
  var content='';
  if(key==='airflow')content='<p>'+ (ar?'المطلوب: ':'Required: ')+getProjectRequiredLoadCfm()+' CFM · '+(ar?'المختار: ':'Selected: ')+getSelectedProjectEquipmentCfm()+' CFM</p><p>'+(ar?'راجع سعة الوحدات أو اختر معدة بتدفق كتالوجي مناسب. تعديل الدكت يغيّر السرعة وفقد الضغط، ولا يغيّر CFM المعدة.':'Review unit capacity or choose equipment with suitable catalogue airflow. Duct dimensions affect velocity and pressure, not equipment CFM.')+'</p>'+renderReportAlertEditor({sourceRule:'capacity',title:''});
  else if(key==='capacity' || key==='energy')content=renderReportAlertEditor({sourceRule:'capacity',title:''});
  else if(key==='esp')content=renderReportDuctEditor();
  var route=key==='dataQuality'?'calc':(key==='electrical' || key==='equipmentVerification' || key==='airflow'?'hist':'calc');
  box.innerHTML='<h3>'+esc(ar?action[1]:action[2])+'</h3>'+content+'<div class="scenario-actions"><button type="button" onclick="openDesktopView(\''+route+'\')">'+(ar?(route==='hist'?'اختيار المعدة وبياناتها':'تعديل بيانات التصميم'):(route==='hist'?'Choose equipment and data':'Edit design inputs'))+'</button><button type="button" onclick="returnToHealthDashboard()">'+(ar?'تحديث والعودة إلى الصحة الهندسية':'Refresh and return to health')+'</button></div>';
  host.insertBefore(box,host.children[1] || null);
  Array.from(box.querySelectorAll('details')).forEach(function(el){el.open=true;});
  box.scrollIntoView({behavior:'smooth',block:'start'});box.focus({preventScroll:true});
}

function renderReportDuctEditor(){
  var cache = window._lastDuctSizing || {};
  return '<details class="report-duct-adjustment"><summary>'+(lang==='ar'?'تعديل مقاسات الدكت':'Adjust duct dimensions')+'</summary>'+['sup','ret'].map(function(side){
    var size = (projState.ductDimensions || {})[side] || cache[side] || {};
    return '<form class="report-inline-editor" onsubmit="return applyReportDuctAction(this)">'+
      '<input name="side" type="hidden" value="'+side+'">'+
      '<strong>'+ (side==='sup' ? (lang==='ar'?'دكت الإمداد':'Supply duct') : (lang==='ar'?'دكت الراجع':'Return duct'))+'</strong>'+
      '<div class="report-duct-suggestions">'+(getReportDuctSuggestions(side).map(function(option,index){
        return '<button type="button" onclick="selectReportDuctSuggestion(\''+side+'\','+index+')"><b dir="ltr">'+option.w+' × '+option.h+' mm</b><br><span dir="ltr">'+option.actualFpm+' fpm</span></button>';
      }).join('') || '<span>'+(lang==='ar'?'حدد تدفق التصميم وسرعته لإظهار المقاسات المقترحة.':'Set design airflow and velocity to calculate suggestions.')+'</span>')+'</div>'+
      '<label>'+(lang==='ar'?'العرض mm':'Width mm')+'<input name="width" type="number" min="150" max="1800" step="1" required value="'+(size.w||'')+'"></label>'+
      '<label>'+(lang==='ar'?'الارتفاع mm':'Height mm')+'<input name="height" type="number" min="150" max="1800" step="1" required value="'+(size.h||'')+'"></label>'+
      '<button type="submit">'+(lang==='ar'?'تطبيق المقاس':'Apply size')+'</button>'+
      '<button type="button" onclick="resetReportDuctSize(\''+side+'\')">'+(lang==='ar'?'مقاس تلقائي':'Automatic size')+'</button></form>';
  }).join('')+'</details>';
}

function applyReportDuctAction(form){
  var w=Number(form.elements.width.value), h=Number(form.elements.height.value), side=form.elements.side.value;
  if(['sup','ret'].indexOf(side)<0 || !Number.isFinite(w) || !Number.isFinite(h) || w<100 || h<100 || w>1800 || h>1800) return false;
  projState.ductDimensions = projState.ductDimensions || {};
  projState.ductDimensions[side] = {w:w,h:h};
  persistQuoteState();
  renderProjBlock();
  renderQuote();
  calcESP();
  syncDuctSelectionToQuotations();
  renderAdvancedDuct();
  renderTechReportFoundation();
  return false;
}

function resetReportDuctSize(side){
  if(projState.ductDimensions) delete projState.ductDimensions[side];
  persistQuoteState();
  renderProjBlock();
  renderQuote();
  calcESP();
  syncDuctSelectionToQuotations();
  renderAdvancedDuct();
  renderTechReportFoundation();
}

function renderTechReportCriticalAlertsSection(compact){
  var model = window._lastTechnicalReportModel || buildTechnicalReportModel();
  var alerts = model.alerts || [];
  var status = model.engineeringStatus || {};
  var topAlerts = alerts;
  var statusText = status.criticalCount > 0
    ? (status.criticalCount + ' Critical Issues - ' + status.warningCount + ' Warnings - Review Required')
    : (alerts.length ? (status.warningCount + ' Warnings - Review Required') : (lang === 'ar' ? 'لا توجد مشاكل حرجة حسب المدخلات المتاحة' : 'No critical engineering issues detected based on available inputs'));
  statusText = lang === 'ar'
    ? (status.criticalCount || 0)+' عوائق · '+((status.warningCount || 0)+(status.reviewCount || 0))+' تحتاج مراجعة'
    : (status.criticalCount || 0)+' blockers · '+((status.warningCount || 0)+(status.reviewCount || 0))+' to review';
  var alertHtml = topAlerts.length ? topAlerts.map(function(alert){
    var tone = alert.severity === 'CRITICAL' ? 'critical' : (alert.severity === 'WARNING' ? 'warning' : (alert.severity === 'REVIEW REQUIRED' ? 'review' : 'info'));
    return '<article class="tech-alert-card is-'+tone+'">'+
      '<div class="tech-alert-icon" aria-hidden="true">!</div>'+
      '<div class="tech-alert-body">'+
        '<div class="tech-alert-head"><span>'+esc(lang==='ar' ? ({'CRITICAL':'يتطلب معالجة','WARNING':'تحذير','REVIEW REQUIRED':'يحتاج تحقق','INFORMATION':'معلومة'}[alert.severity] || alert.severity) : alert.severity)+'</span><strong>'+esc(alert.title)+'</strong></div>'+
        '<p>'+esc(alert.detected || '')+'</p>'+
        (alert.actualValue && alert.requiredValue ? '<p><strong>'+(lang==='ar'?'المختار: ':'Selected: ')+esc(alert.actualValue)+'</strong> · '+(lang==='ar'?'المطلوب: ':'Required: ')+esc(alert.requiredValue)+'</p>' : '')+
        '<p class="report-alert-action"><strong>'+(lang==='ar'?'الإجراء: ':'Action: ')+'</strong>'+esc(alert.requiredAction || '')+'</p>'+
        '<div class="report-alert-controls">'+(compact && /airflow|selected_cfm|CFM Check|تدفق الهواء/i.test(String(alert.sourceRule||'')+' '+String(alert.title||'')) ? '<button type="button" onclick="openHealthMetricEditor(\'airflow\')">'+(lang==='ar'?'مراجعة الدكت والفلتر':'Review duct and filter')+'</button>' : renderReportAlertEditor(alert))+'</div>'+
        (compact ? '' : '<details class="report-alert-evidence"><summary>'+(lang==='ar'?'القيم والأثر الهندسي':'Values and engineering impact')+'</summary><div class="tech-alert-grid">'+
          '<div><span>'+(lang==='ar'?'القيمة الحالية':'Actual')+'</span><strong>'+esc(alert.actualValue || '—')+'</strong></div>'+
          '<div><span>'+(lang==='ar'?'المطلوب':'Required')+'</span><strong>'+esc(alert.requiredValue || '—')+'</strong></div>'+
          '<div><span>'+(lang==='ar'?'الأثر الهندسي':'Engineering Impact')+'</span><strong>'+esc(alert.impact || '—')+'</strong></div>'+
          '<div><span>'+(lang==='ar'?'الإجراء المطلوب':'Required Action')+'</span><strong>'+esc(alert.requiredAction || '—')+'</strong></div>'+
          '<div><span>'+(lang==='ar'?'النطاق المتأثر':'Affected Scope')+'</span><strong>'+esc(alert.affectedScope || '—')+'</strong></div>'+
          '<div><span>'+(lang==='ar'?'قاعدة المصدر':'Source Rule')+'</span><strong>'+esc(alert.sourceRule || 'Rules Engine')+'</strong></div>'+
        '</div></details>')+
      '</div>'+
    '</article>';
  }).join('') : '<div class="tech-doc-empty">'+(lang==='ar'?'لا توجد تنبيهات حرجة بناءً على المدخلات الحالية، لكن هذا لا يعني اعتماد السلامة النهائية.' :'No critical issues were detected from current inputs. This is not a final safety approval.')+'</div>';
  return '<section class="tech-doc-section tech-alert-section" data-report-source="technical-report-model-alerts">'+
    '<div class="tech-status-strip"><span>'+(lang==='ar'?'حالة المراجعة':'Review status')+'</span><strong>'+esc(statusText)+'</strong></div>'+
    '<div class="tech-doc-section-head">'+(lang==='ar'?'ما يحتاج قرارك':'Decisions and required checks')+'</div>'+
    '<div class="tech-alert-list">'+alertHtml+'</div>'+
  '</section>';
}

function renderTechReportSelectedScenarioSection(){
  var model = window._lastTechnicalReportModel || buildTechnicalReportModel();
  var scenario = model.selectedScenario || {};
  var groups = model.selectedScenarioSystems || [];
  if(!scenario || (!scenario.scenarioId && !groups.length)){
    return '<section class="tech-doc-section"><div class="tech-doc-section-head">'+(lang==='ar'?'سيناريو التصميم المختار':'Selected Design Scenario')+'</div><div class="tech-doc-empty">'+(lang==='ar'?'لم يتم اختيار سيناريو تصميم بعد. يعرض التقرير وحدات المشروع الحالية فقط.' :'No design scenario has been selected yet. The report is using current project units only.')+'</div></section>';
  }
  var scenarioTitle = scenario.title || (lang === 'ar' ? 'سيناريو وحدات المشروع' : 'Project Unit Scenario');
  var scenarioRows = groups.map(function(group){
    var s = group.scenario || {};
    var unitDiff = (Number(s.totalConceptualCapacityBtuH || 0) - Number(getProjectRequiredLoadBtu() || 0));
    var oversize = Number(getProjectRequiredLoadBtu() || 0) > 0 ? (unitDiff / Number(getProjectRequiredLoadBtu() || 1)) * 100 : null;
    return '<div class="tech-scenario-row">'+
      '<div><span>'+(lang==='ar'?'نوع النظام':'System Type')+'</span><strong>'+esc(utLabel(s.systemType))+'</strong></div>'+
      '<div><span>'+(lang==='ar'?'عدد الوحدات':'Quantity')+'</span><strong>'+esc(String(s.quantity))+'</strong></div>'+
      '<div><span>'+(lang==='ar'?'السعة القياسية للوحدة':'Standard Capacity / Unit')+'</span><strong>'+Number(s.standardUnitCapacityBtuH||0).toLocaleString()+' BTU/h</strong></div>'+
      '<div><span>'+(lang==='ar'?'إجمالي السعة المفاهيمية':'Total Conceptual Capacity')+'</span><strong>'+Number(s.totalConceptualCapacityBtuH||0).toLocaleString()+' BTU/h</strong></div>'+
      '<div><span>'+(lang==='ar'?'الحمل المطلوب':'Required Load')+'</span><strong>'+Number(getProjectRequiredLoadBtu()||0).toLocaleString()+' BTU/h</strong></div>'+
      '<div><span>'+(lang==='ar'?'فرق السعة':'Capacity Difference')+'</span><strong>'+(unitDiff >= 0 ? '+' : '')+Number(unitDiff||0).toLocaleString()+' BTU/h · '+(oversize == null ? '—' : ((oversize >= 0 ? '+' : '') + oversize.toFixed(1) + '%'))+'</strong></div>'+
      '<div><span>'+(lang==='ar'?'CFM المطلوب':'Required CFM')+'</span><strong>'+Number(s.requiredAirflowCfm||0).toLocaleString()+' CFM</strong></div>'+
      '<div><span>'+(lang==='ar'?'CFM مفاهيمي':'Conceptual CFM')+'</span><strong>'+Number(s.conceptualAirflowCfm||0).toLocaleString()+' CFM</strong></div>'+
    '</div>';
  }).join('');
  var notes = []
    .concat(scenario.assumptions || [])
    .concat(scenario.warnings || [])
    .filter(Boolean)
    .slice(0, 6);
  return '<section class="tech-doc-section" data-report-source="technical-report-model-selected-scenario">'+
    '<div class="tech-doc-section-head">'+(lang==='ar'?'سيناريو التصميم المختار':'Selected Design Scenario')+'</div>'+
    '<div class="tech-scenario-summary">'+
      '<div><span>Scenario</span><strong>'+esc(scenarioTitle)+'</strong><em>'+esc(scenario.architecture || '')+'</em></div>'+
      '<div><span>'+(lang==='ar'?'الحالة':'Status')+'</span><strong>'+esc(scenario.scenarioStatus || scenario.manufacturerSelectionStatus || (lang==='ar'?'معدات الشركة معلقة':'Equipment Pending'))+'</strong></div>'+
    '</div>'+
    '<div class="tech-scenario-grid">'+scenarioRows+'</div>'+
    '<div class="tech-doc-reasoning">'+(notes.length ? notes.map(function(note){ return '<div class="tech-doc-reason"><span>'+esc(note)+'</span></div>'; }).join('') : '<div class="tech-doc-reason"><span>'+(lang==='ar'?'لا توجد افتراضات إضافية مسجلة لهذا السيناريو.' :'No additional assumptions are recorded for this scenario.')+'</span></div>')+'</div>'+
  '</section>';
}

function renderTechReportAirflowReviewSection(){
  var model = window._lastTechnicalReportModel || buildTechnicalReportModel();
  var airflow = model.airflowReview || {};
  var actualCfm = getSelectedProjectEquipmentCfm();
  var filterReview=getDuctFilterReviewState();
  var shortage = Number(actualCfm || 0) - Number(airflow.requiredSupplyCfm || 0);
  return '<section class="tech-doc-section" data-report-source="technical-report-model-airflow">'+
    '<div class="tech-doc-section-head">'+(lang==='ar'?'مراجعة الهواء والتهوية':'Airflow and Ventilation Review')+'</div>'+
    '<div class="tech-doc-grid summary">'+
      '<div class="tech-doc-cell"><span>'+(lang==='ar'?'CFM المطلوب':'Required Supply CFM')+'</span><strong>'+formatReportNumber(airflow.requiredSupplyCfm, 'CFM')+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(lang==='ar'?'CFM مفاهيمي':'Conceptual CFM')+'</span><strong>'+formatReportNumber(airflow.conceptualCfm, 'CFM')+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(lang==='ar'?'CFM كتالوجي بعد الاختيار':'Catalogue Equipment CFM')+'</span><strong>'+formatReportNumber(actualCfm, 'CFM')+'</strong></div>'+
      (filterReview.filterActive?'<div class="tech-doc-cell"><span>'+(lang==='ar'?'التدفق التقديري بعد الفلتر':'Estimated flow after filter')+'</span><strong>'+(filterReview.estimated?formatReportNumber(filterReview.effectiveCfm,'CFM'):(lang==='ar'?'يلزم استكمال بيانات المروحة':'Fan data required'))+'</strong></div>':'')+
      '<div class="tech-doc-cell"><span>'+(lang==='ar'?'هواء خارجي':'Outdoor Air')+'</span><strong>'+formatReportNumber(airflow.outdoorAirCfm, 'CFM')+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(lang==='ar'?'هواء عادم':'Exhaust Air')+'</span><strong>'+formatReportNumber(airflow.exhaustCfm, 'CFM')+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(lang==='ar'?'فرق تدفق الهواء':'Airflow Difference')+'</span><strong>'+(shortage >= 0 ? '+' : '')+Number(shortage||0).toLocaleString()+' CFM</strong></div>'+
    '</div>'+
  '</section>';
}

function renderTechReportEquipmentTable(){
  var rows = [];
  if(isProjectHvacMode()){
    ensureProjectSystems().forEach(function(system){
      var unitCapacity = getSelectedUnitCapacityBtu(system);
      var installedCapacity = getSelectedInstalledCapacity(system);
      rows.push({
        name: getProjectSystemDisplayName(system.id),
        type: utLabel(system.unitType || 'split'),
        capacity: unitCapacity > 0 ? Number(unitCapacity).toLocaleString() + ' BTU' : (lang==='ar' ? 'حسب اعتماد الكويل' : 'By coil submittal'),
        totalBtu: installedCapacity > 0 ? Number(installedCapacity).toLocaleString() + ' BTU' : (lang==='ar' ? 'حسب اعتماد الكويل' : 'By coil submittal'),
        totalTr: installedCapacity > 0 ? (installedCapacity / 12000).toFixed(2) + ' TR' : '—',
        airflow: Number(getUnitAirflowCfm(system) * Math.max(1, parseInt(system.qty,10) || 1) || 0).toLocaleString() + ' CFM',
        qty: Math.max(1, parseInt(system.qty,10) || 1),
        esp: isDucted(system.unitType) && window._lastEspCalc && window._lastEspCalc.totalPa != null ? Number(window._lastEspCalc.totalPa).toLocaleString() + ' Pa' : '—'
      });
    });
  } else {
    hist.forEach(function(h, i){
    var state = getRoomSystemState(i);
    (state.systems || []).forEach(function(system, sIdx){
      rows.push({
        name: ((lang === 'ar' ? (h.ar || h.en) : (h.en || h.ar)) || (lang === 'ar' ? 'غرفة' : 'Room')) + ' #' + (sIdx + 1),
        type: utLabel(system.unitType || 'split'),
        capacity: Number(system.selectedBtu || 0).toLocaleString() + ' BTU',
        totalBtu: Number((system.selectedBtu || 0) * Math.max(1, parseInt(system.qty,10) || 1)).toLocaleString() + ' BTU',
        totalTr: (((Number(system.selectedBtu || 0) * Math.max(1, parseInt(system.qty,10) || 1))) / 12000).toFixed(2) + ' TR',
        airflow: Number(getUnitAirflowCfm(system) * Math.max(1, parseInt(system.qty,10) || 1) || 0).toLocaleString() + ' CFM',
        qty: Math.max(1, parseInt(system.qty,10) || 1),
        esp: isDucted(system.unitType) && window._lastEspCalc && window._lastEspCalc.totalPa != null ? Number(window._lastEspCalc.totalPa).toLocaleString() + ' Pa' : '—'
      });
    });
    });
  }
  if(!rows.length){
    return '<section class="tech-doc-section"><div class="tech-doc-section-head">'+(lang==='ar' ? 'جدول وحدات التكييف' : 'HVAC Equipment Table')+'</div><div class="tech-doc-empty">'+(lang==='ar' ? 'لا توجد وحدات معينة بعد.' : 'No assigned HVAC equipment yet.')+'</div></section>';
  }
  return '<section class="tech-doc-section">'+
    '<div class="tech-doc-section-head">'+(lang==='ar' ? 'جدول وحدات التكييف' : 'HVAC Equipment Table')+'</div>'+
    '<div class="tech-doc-table-wrap"><table class="tech-doc-table"><thead><tr>'+
      '<th>'+(lang==='ar'?'الوحدة':'Unit')+'</th>'+
      '<th>'+(lang==='ar'?'النوع':'Type')+'</th>'+
      '<th>'+(lang==='ar'?'السعة':'Capacity')+'</th>'+
      '<th>'+(lang==='ar'?'الكمية':'Quantity')+'</th>'+
      '<th>'+(lang==='ar'?'إجمالي BTU':'Total BTU')+'</th>'+
      '<th>'+(lang==='ar'?'إجمالي TR':'Total TR')+'</th>'+
      '<th>'+(lang==='ar'?'إجمالي CFM':'Total CFM')+'</th>'+
      '<th>ESP</th>'+
    '</tr></thead><tbody>'+
    rows.map(function(row){
      return '<tr><td>'+esc(row.name)+'</td><td>'+esc(row.type)+'</td><td>'+esc(row.capacity)+'</td><td>'+esc(String(row.qty))+'</td><td>'+esc(row.totalBtu)+'</td><td>'+esc(row.totalTr)+'</td><td>'+esc(row.airflow)+'</td><td>'+esc(row.esp)+'</td></tr>';
    }).join('')+
    '</tbody></table></div></section>';
}

function getManufacturerRecommendationMatchRules(){
  return {
    source: 'central_manufacturer_recommendation_rules',
    exactPct: 3,
    nearPct: 5,
    acceptablePct: 10,
    airflowTolerancePct: 15,
    espTolerancePct: 0,
    maxPrimaryRecommendations: 3,
    note: 'Capacity matching rules are configurable report rules and must be reviewed before final engineering approval.'
  };
}

function getEquipmentCatalogueNumber(record){
  return record && (record.catalogueNumber || record.catalogNumber || record.sourceDocumentIdentifier || record.sourceDocumentName || record.sourceReference || record.id || '');
}

function getEquipmentEfficiencyLabel(record){
  if(!record) return '—';
  var pairs = [
    ['EER', record.eer],
    ['SEER', record.seer],
    ['COP', record.cop],
    ['IPLV', record.iplv],
    ['Efficiency', record.efficiencyValue || record.efficiency]
  ];
  for(var i=0;i<pairs.length;i++){
    if(pairs[i][1] != null && pairs[i][1] !== '') return pairs[i][0] + ' ' + pairs[i][1];
  }
  return '—';
}

function classifyManufacturerCapacityMatch(unitDeltaPct, record, rules){
  rules = rules || getManufacturerRecommendationMatchRules();
  var abs = Math.abs(Number(unitDeltaPct || 0));
  if(record && ['verified','verified-real-catalogue'].indexOf(String(record.verificationStatus || record.catalogueStatus || '').toLowerCase()) < 0){
    if(abs <= rules.nearPct) return 'Acceptable Match';
  }
  if(abs <= rules.exactPct) return 'Exact or Near Match';
  if(abs <= rules.nearPct) return 'Near Match';
  if(abs <= rules.acceptablePct) return 'Acceptable Match';
  return 'Alternative Configuration';
}

function getSelectedReportScenarioSystems(){
  var systems = isProjectHvacMode() ? ensureProjectSystems() : [];
  if(systems.length) return systems.map(normalizeProjectSystem);
  var roomSystems = [];
  hist.forEach(function(_h, i){
    var state = getRoomSystemState(i);
    (state.systems || []).forEach(function(system){ roomSystems.push(normalizeProjectSystem(system)); });
  });
  return roomSystems;
}

function getReportScenarioSnapshotForSystem(system){
  system = normalizeProjectSystem(system || {});
  var snap = system.conceptualScenarioSnapshot || {};
  var selectedScenario = selectedHvacDesignScenario || {};
  var installed = getSelectedReportScenarioSystems().reduce(function(total, entry){return total + getSelectedInstalledCapacity(entry);},0);
  var loadShare = installed > 0 ? getSelectedInstalledCapacity(system) / installed : 1;
  return {
    requiredCoolingCapacityBtuH: getProjectRequiredLoadBtu() * loadShare,
    selectedScenarioId: snap.selectedScenarioId || selectedScenario.scenarioId || '',
    scenarioType: snap.scenarioType || selectedScenario.scenarioType || '',
    systemType: system.unitType || 'split',
    standardUnitCapacityBtuH: Number(snap.standardUnitCapacityBtuH || getSelectedUnitCapacityBtu(system) || 0),
    quantity: Math.max(1, parseInt(snap.quantity || system.qty, 10) || 1),
    totalConceptualCapacityBtuH: Number(snap.totalInstalledCapacityBtuH || getSelectedInstalledCapacity(system) || 0),
    requiredAirflowCfm: Number(snap.requiredAirflowCfm || getProjectRequiredLoadCfm() || 0),
    conceptualAirflowCfm: Number(snap.estimatedInstalledAirflowCfm || (getUnitAirflowCfm(system) * Math.max(1, parseInt(system.qty, 10) || 1)) || 0),
    requiredEsp: window._lastEspCalc && window._lastEspCalc.totalPa != null ? Number(window._lastEspCalc.totalPa) || 0 : 0,
    electricalRequirements: {
      voltage: 380,
      phase: 3,
      frequencyHz: 60
    },
    roomAssignments: snap.roomAssignments || [],
    freshAirRequirement: Number(getCentralizedReportSummary().summary && getCentralizedReportSummary().summary.outdoorAirCfm || 0),
    assumptions: snap.assumptions || selectedScenario.assumptions || [],
    warnings: snap.warnings || selectedScenario.warnings || []
  };
}

function findManufacturerMatchesForScenario(scenario, equipmentDatabase, opts){
  opts = opts || {};
  var rules = opts.rules || getManufacturerRecommendationMatchRules();
  var systemType = getAllowedSystemType((scenario && scenario.systemType) || 'split');
  var targetUnitBtu = Math.max(0, Number((scenario && scenario.standardUnitCapacityBtuH) || 0) || 0);
  var qty = Math.max(1, parseInt((scenario && scenario.quantity) || 1, 10) || 1);
  var targetUnitCfm = Math.max(0, Math.round(Number((scenario && scenario.conceptualAirflowCfm) || 0) / qty) || 0);
  var requiredProjectLoad = Math.max(0, Number(getProjectRequiredLoadBtu() || 0) || 0);
  var requiredEsp = Math.max(0, Number((scenario && scenario.requiredEsp) || 0) || 0);
  var records = Array.isArray(equipmentDatabase) ? equipmentDatabase : [];
  var matches = [];
  records.forEach(function(record){
    if(!record || record.discontinued || record.sampleData) return;
    if(!isProjectSystemEquipmentRecordCompatible(systemType, record)) return;
    var unitBtu = Number(record.coolingCapacityBtuH || 0);
    var unitCfm = Number(record.airflowNominalCfm || record.airflowMaxCfm || record.airflowMinCfm || 0);
    if(targetUnitBtu > 0 && unitBtu <= 0) return;
    if(targetUnitBtu <= 0 && targetUnitCfm > 0 && unitCfm <= 0) return;
    var unitDeltaBtu = unitBtu - targetUnitBtu;
    var unitDeltaPct = targetUnitBtu > 0 ? (unitDeltaBtu / targetUnitBtu) * 100 : null;
    var actualTotalBtu = unitBtu * qty;
    // A catalogue substitute must cover the selected capacity, including its existing margin.
    // Do not add another safety factor or accept negative matching tolerances.
    if(targetUnitBtu > 0 && unitBtu < targetUnitBtu) return;
    if(actualTotalBtu < Number(scenario.requiredCoolingCapacityBtuH || 0)) return;
    var conceptualTotalBtu = Number((scenario && scenario.totalConceptualCapacityBtuH) || (targetUnitBtu * qty) || 0);
    var conceptualDeltaBtu = actualTotalBtu - conceptualTotalBtu;
    var projectDeltaBtu = actualTotalBtu - requiredProjectLoad;
    var projectDeltaPct = requiredProjectLoad > 0 ? (projectDeltaBtu / requiredProjectLoad) * 100 : null;
    var totalCfm = unitCfm * qty;
    var airflowDeltaPct = targetUnitCfm > 0 && unitCfm > 0 ? ((unitCfm - targetUnitCfm) / targetUnitCfm) * 100 : null;
    var availableEsp = Number(record.availableEspPa || record.externalStaticPressurePa || 0) || 0;
    var espOk = !requiredEsp || !availableEsp || availableEsp >= requiredEsp;
    var classification = classifyManufacturerCapacityMatch(unitDeltaPct || 0, record, rules);
    var undersized = targetUnitBtu > 0 && unitBtu > 0 && unitBtu < targetUnitBtu;
    var verification = String(record.verificationStatus || record.catalogueStatus || '').toLowerCase();
    var isVerified = verification === 'verified' || verification === 'verified-real-catalogue';
    var verifiedBonus = isVerified ? -8 : 0;
    var sameMarketBonus = String(record.saudiMarketStatus || '').toLowerCase().indexOf('available') >= 0 ? -3 : 0;
    var score = Math.abs(unitDeltaPct == null ? 99 : unitDeltaPct) * 2 +
      (undersized ? 18 : 0) +
      (airflowDeltaPct != null && airflowDeltaPct < -rules.airflowTolerancePct ? 12 : 0) +
      (!espOk ? 16 : 0) +
      verifiedBonus + sameMarketBonus;
    var notes = [];
    if(undersized) notes.push(lang === 'ar' ? 'السعة الفعلية أقل من السعة القياسية المختارة لكل وحدة؛ يلزم اعتماد مهندس قبل الاختيار.' : 'Actual catalogue capacity is below the selected standard capacity per unit; engineer approval is required.');
    if(airflowDeltaPct != null && airflowDeltaPct < -rules.airflowTolerancePct) notes.push(lang === 'ar' ? 'تدفق هواء الكتالوج أقل من التدفق المفاهيمي للوحدة.' : 'Catalogue airflow is below the conceptual airflow per unit.');
    if(!espOk) notes.push(lang === 'ar' ? 'ESP المتاح أقل من ESP المحسوب ويحتاج مراجعة.' : 'Available ESP is below calculated ESP and requires review.');
    if(!isVerified) notes.push(lang === 'ar' ? 'حالة توثيق الكتالوج تحتاج مراجعة قبل الاعتماد.' : 'Catalogue verification status requires review before approval.');
    matches.push({
      record: record,
      systemType: systemType,
      quantity: qty,
      standardUnitCapacityBtuH: targetUnitBtu,
      actualUnitCapacityBtuH: unitBtu,
      unitCapacityDifferenceBtuH: unitDeltaBtu,
      unitCapacityDifferencePct: unitDeltaPct,
      conceptualTotalCapacityBtuH: conceptualTotalBtu,
      actualTotalCapacityBtuH: actualTotalBtu,
      conceptualCapacityDifferenceBtuH: conceptualDeltaBtu,
      projectLoadDifferenceBtuH: projectDeltaBtu,
      projectOversizingPct: projectDeltaPct,
      airflowPerUnitCfm: unitCfm,
      totalAirflowCfm: totalCfm,
      availableEspPa: availableEsp,
      requiredEspPa: requiredEsp,
      classification: classification,
      severity: undersized || !espOk ? 'WARNING' : (classification === 'Alternative Configuration' ? 'REVIEW REQUIRED' : 'INFORMATION'),
      score: score,
      notes: notes,
      rules: rules
    });
  });
  matches.sort(function(a,b){ return a.score - b.score; });
  var picked = [];
  var seenManufacturers = {};
  matches.forEach(function(item){
    if(picked.length >= rules.maxPrimaryRecommendations) return;
    var maker = String(item.record.manufacturerName || item.record.brand || '').toLowerCase();
    if(maker && seenManufacturers[maker]) return;
    if(item.classification === 'Alternative Configuration') return;
    picked.push(item);
    if(maker) seenManufacturers[maker] = true;
  });
  matches.forEach(function(item){
    if(picked.length >= rules.maxPrimaryRecommendations) return;
    if(picked.indexOf(item) < 0 && item.classification !== 'Alternative Configuration') picked.push(item);
  });
  var alternatives = matches.filter(function(item){ return item.classification === 'Alternative Configuration'; }).slice(0, 3);
  return {
    primary: picked,
    alternatives: alternatives,
    all: matches,
    rules: rules,
    status: picked.length ? 'matched' : (alternatives.length ? 'alternatives_only' : 'no_verified_match')
  };
}

function getEquipmentRecordsForReportRecommendations(system, limit){
  system = normalizeProjectSystem(system || {});
  limit = Math.max(1, parseInt(limit, 10) || 3);
  var scenario = getReportScenarioSnapshotForSystem(system);
  var records = [];
  try{
    records = window.AppEquipmentDatabase && typeof window.AppEquipmentDatabase.allRecords === 'function'
      ? window.AppEquipmentDatabase.allRecords()
      : [];
  }catch(_err){
    records = [];
  }
  return findManufacturerMatchesForScenario(scenario, records, { rules: Object.assign({}, getManufacturerRecommendationMatchRules(), { maxPrimaryRecommendations: limit }) }).primary;
}

function buildTechnicalReportModel(project){
  var summary = getTechReportSummaryMetrics();
  var validation = getProjectEngineeringValidation();
  var systems = getSelectedReportScenarioSystems();
  var records = [];
  try{
    records = window.AppEquipmentDatabase && typeof window.AppEquipmentDatabase.allRecords === 'function'
      ? window.AppEquipmentDatabase.allRecords()
      : [];
  }catch(_err){ records = []; }
  var scenarioSystems = systems.map(function(system){
    var scenario = getReportScenarioSnapshotForSystem(system);
    var match = findManufacturerMatchesForScenario(scenario, records, { rules: getManufacturerRecommendationMatchRules() });
    return { system: system, scenario: scenario, manufacturerRecommendations: match };
  });
  var alerts = buildTechnicalReportAlerts(summary, validation, scenarioSystems);
  return {
    reportMetadata: getCentralizedReportMeta(getEffectiveReportLanguage()).meta,
    executiveSummary: summary,
    engineeringStatus: {
      criticalCount: alerts.filter(function(a){ return a.severity === 'CRITICAL'; }).length,
      warningCount: alerts.filter(function(a){ return a.severity === 'WARNING'; }).length,
      reviewCount: alerts.filter(function(a){ return a.severity === 'REVIEW REQUIRED'; }).length,
      infoCount: alerts.filter(function(a){ return a.severity === 'INFORMATION'; }).length,
      status: alerts.some(function(a){ return a.severity === 'CRITICAL'; }) ? 'Critical Review Required' : (alerts.length ? 'Review Required' : 'No Critical Issues Detected')
    },
    alerts: alerts,
    selectedScenario: selectedHvacDesignScenario || null,
    selectedScenarioSystems: scenarioSystems,
    loadSummary: summary,
    roomSummary: hist,
    manufacturerRecommendations: scenarioSystems.map(function(item){ return item.manufacturerRecommendations; }),
    airflowReview: {
      requiredSupplyCfm: summary.totalRequiredCfm,
      conceptualCfm: summary.selectedCfm,
      outdoorAirCfm: getCentralizedReportSummary().summary ? getCentralizedReportSummary().summary.outdoorAirCfm : 0,
      exhaustCfm: getCentralizedReportSummary().summary ? getCentralizedReportSummary().summary.exhaustCfm : 0
    },
    ductEspReview: window._lastEspCalc || null,
    ductAndFilter: getDuctAndFilterSnapshot(),
    complianceReview: validation,
    requiredActions: alerts.map(function(alert){ return alert.requiredAction; }).filter(Boolean),
    assumptions: scenarioSystems.reduce(function(list, item){ return list.concat(item.scenario.assumptions || []); }, []),
    references: ['Rules Engine', 'Equipment Database', 'Engineering Calculation Engine'],
    sourceOfTruth: 'buildTechnicalReportModel'
  };
}

function buildTechnicalReportAlerts(summary, validation, scenarioSystems){
  var alerts = [];
  var selectedBtu = Number(summary.selectedBtu || 0);
  var requiredBtu = Number(summary.totalLoadBtu || 0);
  var selectedCfm = Number(summary.selectedCfm || 0);
  var requiredCfm = Number(summary.totalRequiredCfm || 0);
  function addCheck(id, titleAr, titleEn, reasonAr, reasonEn, actionAr, actionEn, severity){
    alerts.push({severity:severity || 'REVIEW REQUIRED', title:lang==='ar'?titleAr:titleEn,
      detected:lang==='ar'?reasonAr:reasonEn, requiredAction:lang==='ar'?actionAr:actionEn,
      affectedScope:lang==='ar'?'المشروع':'Project', sourceRule:id});
  }
  if(!(requiredBtu > 0)){
    addCheck('missing_project_load','لم يُحسب حمل المشروع','Project load not calculated',
      'لا تتوفر نتيجة حمل موجبة لتقييم الاختيار.','No positive load is available for equipment assessment.',
      'أضف الغرف واحسب الأحمال في صفحة التصميم.','Add rooms and calculate loads on the design page.');
    return alerts;
  }
  if(!(selectedBtu > 0)) addCheck('missing_selected_capacity','لم تُحدد سعة التبريد','Cooling capacity not selected',
    'لا يمكن تقييم تغطية الحمل قبل تحديد السعة.','Load coverage cannot be assessed without a selected capacity.',
    'اختر نظامًا وسعة، ولـ AHU راجع اعتماد ملف التبريد.','Select a system and capacity; for an AHU obtain coil selection data.');
  if(!(requiredCfm > 0) || !(selectedCfm > 0)) addCheck('missing_airflow','بيانات الهواء غير مكتملة','Airflow data incomplete',
    'غياب CFM لا يعني مطابقة تدفق الهواء.','Missing CFM does not establish airflow compliance.',
    'تحقق من الهواء المطلوب وأدخل تدفق المعدة عند نقطة التشغيل.','Confirm required airflow and equipment airflow at the operating point.');
  if(selectedBtu > requiredBtu * 1.10) addCheck('project_capacity_review_10pct','زيادة السعة تحتاج مراجعة','Capacity excess needs review',
    'زيادة السعة تتجاوز حد المراجعة للمشروع 10%؛ هذا ليس حد ASHRAE عامًا.','Capacity exceeds the project review threshold of 10%; this is not a universal ASHRAE limit.',
    'راجع اختيار السعة والتحكم بالأحمال الجزئية والرطوبة.','Review capacity selection, part-load control and humidity.','WARNING');
  if(selectedBtu > requiredBtu * 1.10){
    var capacityAlert = alerts[alerts.length - 1];
    capacityAlert.actualValue = selectedBtu.toLocaleString('en-US') + ' BTU/h';
    capacityAlert.requiredValue = requiredBtu.toLocaleString('en-US') + ' BTU/h';
    capacityAlert.detected += ' ' + (lang==='ar'?'الزيادة الفعلية: ':'Actual excess: ') + ((selectedBtu / requiredBtu - 1) * 100).toFixed(1) + '%.';
  }
  addCheck('preliminary_load_basis','تأكيد أساس حساب الحمل','Confirm load calculation basis',
    'الأحمال التقديرية ومتطلبات التهوية وحدها لا تثبت اكتمال التصميم.','Preliminary loads and ventilation requirements alone do not establish a complete design.',
    'راجع ظروف التصميم والأحمال المحسوسة والكامنة وافتراضات الغرف قبل الإصدار.','Review design conditions, sensible and latent loads and room assumptions before issue.');
  if(requiredBtu > 0 && selectedBtu > 0 && selectedBtu < requiredBtu){
    alerts.push({
      severity: 'CRITICAL',
      title: lang === 'ar' ? 'السعة المركبة أقل من الحمل المحسوب' : 'Installed capacity is below calculated load',
      detected: lang === 'ar' ? 'السعة المختارة لا تغطي حمل المشروع.' : 'Selected capacity does not cover the project load.',
      actualValue: Number(selectedBtu).toLocaleString() + ' BTU/h',
      requiredValue: Number(requiredBtu).toLocaleString() + ' BTU/h',
      impact: lang === 'ar' ? 'احتمال عدم تحقيق درجة الحرارة التصميمية عند الذروة.' : 'The design may fail to meet peak cooling conditions.',
      requiredAction: lang === 'ar' ? 'ارفع السعة أو اختر سيناريو/معدة مناسبة قبل الاعتماد.' : 'Increase capacity or select a suitable scenario/equipment before approval.',
      affectedScope: lang === 'ar' ? 'المشروع' : 'Project',
      sourceRule: 'Rules Engine: project_capacity >= project_load'
    });
  }
  if(requiredCfm > 0 && selectedCfm > 0 && selectedCfm < requiredCfm){
    alerts.push({
      severity: 'WARNING',
      title: lang === 'ar' ? 'تدفق هواء الإمداد أقل من المطلوب' : 'Selected supply airflow is below requirement',
      detected: lang === 'ar' ? 'CFM المختار أقل من CFM المطلوب للمشروع.' : 'Selected CFM is below the project required CFM.',
      actualValue: Number(selectedCfm).toLocaleString() + ' CFM',
      requiredValue: Number(requiredCfm).toLocaleString() + ' CFM',
      impact: lang === 'ar' ? 'قد يضعف توزيع الهواء والراحة الحرارية.' : 'Air distribution and comfort may be affected.',
      requiredAction: lang === 'ar' ? 'راجع CFM الوحدة أو توزيع الهواء قبل اعتماد التقرير.' : 'Review unit airflow or air distribution before report approval.',
      affectedScope: lang === 'ar' ? 'المشروع' : 'Project',
      sourceRule: 'Rules Engine: selected_cfm >= required_cfm'
    });
  }
  (validation.items || []).forEach(function(item){
    if(!item || (item.status !== 'fail' && item.status !== 'warning')) return;
    // The project-level comparisons above already describe these same checks.
    if(['فحص السعة','Capacity Check'].indexOf(item.title) >= 0 && requiredBtu > 0 && selectedBtu > 0 && (selectedBtu < requiredBtu || selectedBtu > requiredBtu * 1.10)) return;
    if(['فحص تدفق الهواء','CFM Check'].indexOf(item.title) >= 0 && requiredCfm > 0 && selectedCfm > 0 && selectedCfm < requiredCfm) return;
    alerts.push({
      severity: item.status === 'fail' ? 'CRITICAL' : 'REVIEW REQUIRED',
      title: item.title || (lang === 'ar' ? 'تنبيه هندسي' : 'Engineering alert'),
      detected: item.message || '',
      actualValue: summarizeValidationValues(item) || '—',
      requiredValue: item.action && item.action.text ? item.action.text : '—',
      impact: lang === 'ar' ? 'قد تؤثر هذه الملاحظة على جاهزية التقرير للاعتماد.' : 'This issue may affect report readiness for approval.',
      requiredAction: item.action && item.action.text ? item.action.text : (lang === 'ar' ? 'راجع المدخلات والنتائج.' : 'Review inputs and results.'),
      affectedScope: item.scope || (lang === 'ar' ? 'عام' : 'General'),
      sourceRule: item.ruleId || item.id || 'Rules Engine'
    });
    if(['فحص تدفق الهواء','CFM Check'].indexOf(item.title) >= 0 && requiredCfm > 0 && selectedCfm > 0){
      var airflowAlert = alerts[alerts.length - 1];
      var airflowDifference = selectedCfm - requiredCfm;
      airflowAlert.actualValue = selectedCfm.toLocaleString('en-US') + ' CFM';
      airflowAlert.requiredValue = requiredCfm.toLocaleString('en-US') + ' CFM';
      airflowAlert.detected = (lang==='ar'?'فرق تدفق الهواء: ':'Airflow difference: ') + (airflowDifference >= 0 ? '+' : '') + airflowDifference.toLocaleString('en-US') + ' CFM (' + (airflowDifference / requiredCfm * 100).toFixed(1) + '%).';
      airflowAlert.sourceRule = 'project_airflow_comparison';
    }
  });
  scenarioSystems.forEach(function(item){
    if(!item.system.equipmentSnapshot && (!item.manufacturerRecommendations || item.manufacturerRecommendations.status !== 'no_verified_match')){
      addCheck('missing_equipment_snapshot','اختيار الشركة والموديل غير مكتمل','Manufacturer and model selection incomplete',
        'السعة القياسية اختيار مفاهيمي وليست إثبات أداء كتالوجي.','Standard capacity is conceptual, not evidence of catalogue performance.',
        'اختر معدة من المقترحات أدناه وراجع بياناتها الفنية.','Select equipment below and review its technical data.');
    }
    if(!item.manufacturerRecommendations || item.manufacturerRecommendations.status !== 'no_verified_match') return;
    alerts.push({
      severity: 'REVIEW REQUIRED',
      title: lang === 'ar' ? 'لا توجد مطابقة ضمن النوع والسعة المختارين' : 'No match within the selected type and capacity',
      detected: lang === 'ar' ? 'تم البحث في بيانات المعدات غير التجريبية؛ لا توجد نتيجة تحقق شروط النوع والسعة والكمية الحالية. هذا لا يعني أن قاعدة الوحدات غير موثوقة.' : 'Non-sample equipment records were searched. None meets the current type, capacity and quantity constraints; this is not a database trust failure.',
      actualValue: Number(item.scenario.standardUnitCapacityBtuH || 0).toLocaleString() + ' BTU/h',
      requiredValue: utLabel(item.scenario.systemType),
      impact: lang === 'ar' ? 'يبقى التصميم مفاهيميًا حتى إضافة أو اعتماد بيانات كتالوج مناسبة.' : 'Design remains conceptual until suitable catalogue data is added or approved.',
      requiredAction: lang === 'ar' ? 'أضف كتالوجًا موثقًا أو راجع الاختيار؛ لا تعتبر عدم توفر البيانات فشلًا للمعدة.' : 'Add a verified catalogue or review the selection; missing data is not proof of equipment failure.',
      affectedScope: getProjectSystemDisplayName(item.system.id),
      sourceRule: 'Manufacturer Recommendation Engine'
    });
  });
  var seen = {};
  return alerts.filter(function(alert){
    if(alert.sourceRule==='missing_equipment_snapshot' || alert.sourceRule==='Manufacturer Recommendation Engine') return false;
    ['title','detected','requiredAction','actualValue','requiredValue','impact'].forEach(function(key){
      if(!alert[key]) return;
      var plain = document.createElement('div');
      plain.innerHTML = String(alert[key]).replace(/<br\s*\/?\s*>/gi, ' · ');
      alert[key] = plain.textContent;
    });
    var key = alert.severity + '|' + alert.title + '|' + alert.affectedScope;
    if(seen[key]) return false;
    seen[key] = true;
    return true;
  }).sort(function(a,b){
    var rank = { 'CRITICAL':0, 'WARNING':1, 'REVIEW REQUIRED':2, 'INFORMATION':3 };
    return (rank[a.severity] == null ? 9 : rank[a.severity]) - (rank[b.severity] == null ? 9 : rank[b.severity]);
  });
}

function renderTechReportEquipmentRecommendationsSection(){
  var model = window._lastTechnicalReportModel || buildTechnicalReportModel();
  var groups = model.selectedScenarioSystems || [];
  var rules = getManufacturerRecommendationMatchRules();
  if(!groups.length){
    return '<section class="tech-doc-section"><div class="tech-doc-section-head">'+(lang==='ar'?'مقترحات المعدات حسب الشركات':'Manufacturer Equipment Recommendations')+'</div><div class="tech-doc-empty">'+(lang==='ar'?'اختر سيناريو أو وحدة مشروع أولاً حتى تظهر مقترحات الشركات.' :'Select a project scenario or unit first to show manufacturer recommendations.')+'</div></section>';
  }
  var body = groups.map(function(group){
    var system = group.system || {};
    var scenario = group.scenario || {};
    var match = group.manufacturerRecommendations || {};
    var hasSelectedEquipment = !!(system.equipmentSnapshot || system.selectedEquipmentOption || system.selectedEquipmentId || system.selectedManufacturer || system.selectedModel);
    var cards = (match.primary || []).map(function(item){
      var record = item.record || {};
      var statusTone = item.severity === 'WARNING' ? 'warning' : (item.classification === 'Exact or Near Match' || item.classification === 'Near Match' ? 'good' : 'review');
      var matchLabel = item.classification === 'Exact or Near Match' || item.classification === 'Near Match'
        ? (lang === 'ar' ? 'ممتاز' : 'Excellent')
        : (item.classification === 'Acceptable Match' ? (lang === 'ar' ? 'جيد' : 'Good') : (lang === 'ar' ? 'مراجعة' : 'Review'));
      var rating = item.classification === 'Acceptable Match' ? '★★★★☆' : (item.severity === 'WARNING' ? '★★★☆☆' : '★★★★★');
      var option = {
        optionId: (record.id || 'report-rec') + '-report-x' + item.quantity,
        equipmentId: record.id,
        record: record,
        quantity: item.quantity,
        activeQuantity: item.quantity,
        totalCapacityBtuH: item.actualTotalCapacityBtuH,
        totalAirflowCfm: item.totalAirflowCfm,
        availableEspPa: item.availableEspPa,
        selectionMode: 'report_recommendation',
        automaticSelectionReason: 'Selected from Technical Report manufacturer recommendations',
        preBindReview: {
          source: 'technical_report_recommendation_engine',
          status: item.severity === 'WARNING' ? 'review_required' : 'rules_engine_reviewed',
          label: item.classification,
          notes: item.notes || []
        }
      };
      var optionKey = btoa(unescape(encodeURIComponent(JSON.stringify({
        systemId: system.id,
        equipmentId: record.id,
        option: option
      })))).replace(/=+$/,'');
      window._reportEquipmentRecommendationOptions = window._reportEquipmentRecommendationOptions || {};
      window._reportEquipmentRecommendationOptions[optionKey] = { systemId: system.id, equipmentId: record.id, option: option };
      return '<article class="manufacturer-rec-card is-'+statusTone+'">'+
        '<div class="manufacturer-rec-logo">'+esc((record.manufacturerName || record.brand || 'AC').slice(0,2).toUpperCase())+'</div>'+
        '<div class="manufacturer-rec-head"><div><span>'+esc(matchLabel)+'</span><strong>'+esc(record.manufacturerName || record.brand || '—')+'</strong><em>'+esc(record.exactModelNumber || record.series || '—')+'</em></div></div>'+
        '<div class="manufacturer-rec-compact">'+
          '<div><span>'+(lang==='ar'?'السعة':'Capacity')+'</span><strong>'+Number(item.actualUnitCapacityBtuH||0).toLocaleString()+' BTU/h</strong></div>'+
          '<div><span>'+(lang==='ar'?'الكمية':'Quantity')+'</span><strong>'+item.quantity+'</strong></div>'+
          '<div><span>'+(lang==='ar'?'التقييم':'Match Rating')+'</span><strong class="manufacturer-rec-rating">'+rating+'</strong></div>'+
        '</div>'+
        '<details class="manufacturer-rec-details"><summary>'+(lang==='ar'?'عرض التفاصيل':'View Details')+'</summary>'+
          '<div class="manufacturer-rec-grid">'+
            '<div><span>'+(lang==='ar'?'نوع المعدة':'Equipment Type')+'</span><strong>'+esc(utLabel(mapEquipmentTypeToProjectSystemType(record.equipmentType, scenario.systemType)))+'</strong></div>'+
            '<div><span>'+(lang==='ar'?'السعة القياسية':'Standard Capacity')+'</span><strong>'+Number(item.standardUnitCapacityBtuH||0).toLocaleString()+' BTU/h</strong></div>'+
            '<div><span>'+(lang==='ar'?'فرق الوحدة':'Unit Difference')+'</span><strong>'+(item.unitCapacityDifferenceBtuH >= 0 ? '+' : '')+Number(item.unitCapacityDifferenceBtuH||0).toLocaleString()+' BTU/h</strong></div>'+
            '<div><span>'+(lang==='ar'?'إجمالي السعة':'Total Capacity')+'</span><strong>'+Number(item.actualTotalCapacityBtuH||0).toLocaleString()+' BTU/h</strong></div>'+
            '<div><span>CFM</span><strong>'+reportEquipmentValue(item.totalAirflowCfm, 'CFM')+'</strong></div>'+
            '<div><span>ESP</span><strong>'+reportEquipmentValue(item.availableEspPa, 'Pa')+'</strong></div>'+
          '</div>'+
        '</details>'+
        '<button type="button" class="manufacturer-rec-select no-print" onclick="selectReportManufacturerRecommendation(\''+esc(optionKey)+'\')">'+(lang==='ar'?'اختيار هذه المعدة':'Select This Equipment')+'</button>'+
      '</article>';
    }).join('');
    var alternatives = (match.alternatives || []).length
      ? '<details class="manufacturer-alt-config"><summary>Alternative Configurations</summary>'+
        match.alternatives.map(function(item){
          var record = item.record || {};
          return '<div class="manufacturer-alt-row"><strong>'+esc(record.manufacturerName || record.brand || '—')+' · '+esc(record.exactModelNumber || record.series || '—')+'</strong><span>'+item.quantity+' x '+Number(item.actualUnitCapacityBtuH||0).toLocaleString()+' BTU/h · '+esc(item.classification)+'</span></div>';
        }).join('')+
      '</details>'
      : '';
    if(!cards){
      cards = '<div class="tech-doc-empty">'+(lang==='ar'?'لم يتم العثور على معدة موثقة مطابقة للسعة القياسية المختارة. الخيارات: وسّع حدود المطابقة، اعرض المطابقات القريبة، أضف بيانات معدات، أو استمر بالسعة المفاهيمية.' :'No verified manufacturer match was found for the selected standard capacity. Options: expand tolerance, view near matches, add equipment data, or continue with conceptual capacity.')+'</div>';
    }
    var recommendationsBlock = hasSelectedEquipment
      ? '<details class="manufacturer-other-recommendations"><summary>'+(lang==='ar'?'عرض مقترحات أخرى':'View Other Recommendations')+'</summary><div class="manufacturer-rec-cards">'+cards+'</div>'+alternatives+'</details>'
      : '<div class="manufacturer-rec-cards">'+cards+'</div>'+alternatives;
    return '<div class="manufacturer-rec-group">'+
      '<div class="manufacturer-rec-group-head"><strong>'+esc(getProjectSystemDisplayName(system.id) || utLabel(scenario.systemType))+'</strong><span>'+(lang==='ar'?'مطابقة على نفس السيناريو والكمية: ':'Matched to selected scenario and quantity: ')+esc(utLabel(scenario.systemType))+' · '+scenario.quantity+' x '+Number(scenario.standardUnitCapacityBtuH||0).toLocaleString()+' BTU/h</span></div>'+
      recommendationsBlock+
    '</div>';
  }).join('');
  return '<section class="tech-doc-section" data-report-source="equipment-database-recommendations">'+
    '<div class="tech-doc-section-head">'+(lang==='ar'?'مقترحات الشركات المصنعة':'Manufacturer Recommendations')+'</div>'+
    '<div class="tech-doc-note">'+(lang==='ar'?'تمت مطابقة هذه المعدات مع السعات القياسية المختارة في صفحة التصميم الرئيسية، وقد تختلف السعة الفعلية في الكتالوج بشكل محدود.' :'These recommendations are matched to the conceptual capacities selected in the main design page. Catalogue capacities may differ slightly from standard capacities.')+'</div>'+
    '<div class="tech-doc-note">'+(lang==='ar'?'حدود المطابقة: دقيق ±3%، قريب ±5%، مقبول حتى ±10%. لا يتم اعتماد أي مقترح تلقائيًا.' :'Matching limits: exact ±3%, near ±5%, acceptable up to ±10%. No recommendation is applied automatically.')+'</div>'+
    body+
  '</section>';
}

function renderTechReportActionsRequiredSection(){
  var model = window._lastTechnicalReportModel || buildTechnicalReportModel();
  var actions = (model.requiredActions || []).filter(Boolean);
  var alerts = (model.alerts || []).filter(function(alert){
    return alert && (alert.severity === 'CRITICAL' || alert.severity === 'WARNING' || alert.severity === 'REVIEW REQUIRED');
  });
  var title = lang === 'ar' ? 'الإجراءات المطلوبة قبل الاعتماد' : 'Actions Required Before Approval';
  var empty = lang === 'ar' ? 'لا توجد إجراءات حرجة حالياً. راجع التفاصيل الفنية قبل الإصدار النهائي.' : 'No critical actions are currently required. Review technical details before final issue.';
  var rows = actions.length ? actions : alerts.map(function(alert){
    return alert.requiredAction || alert.title;
  });
  if(!rows.length){
    return '<section class="tech-doc-section tech-actions-section" data-report-source="technical-report-actions"><div class="tech-doc-section-head">'+title+'</div><div class="tech-doc-empty">'+empty+'</div></section>';
  }
  return '<section class="tech-doc-section tech-actions-section" data-report-source="technical-report-actions">'+
    '<div class="tech-doc-section-head">'+title+'</div>'+
    '<div class="tech-actions-list">'+rows.map(function(item, idx){
      return '<div class="tech-action-row"><span>'+String(idx + 1)+'</span><strong>'+esc(item)+'</strong></div>';
    }).join('')+'</div>'+
  '</section>';
}

function getQuotationIdentitySnapshot(){
  var reportMeta = {};
  try{
    reportMeta = typeof getCentralizedReportMeta === 'function'
      ? (getCentralizedReportMeta(typeof getEffectiveReportLanguage === 'function' ? getEffectiveReportLanguage() : lang).meta || {})
      : {};
  }catch(_err){
    reportMeta = {};
  }
  var projectName = ((G('tech-project')||{value:''}).value || (G('quote-project')||{value:''}).value || reportMeta.projectName || '').trim();
  var projectNumber = ((G('tech-no')||{value:''}).value || (G('quote-no')||{value:''}).value || reportMeta.projectNumber || 'Q-001').trim();
  return {
    projectName: projectName || (lang === 'ar' ? 'غير محدد' : 'Untitled'),
    projectNumber: projectNumber || 'Q-001',
    client: getOptionalReportField(['report-client','client-name','quote-client','project-client'], ''),
    location: getOptionalReportField(['report-location','project-location','quote-location'], ''),
    selectedLanguage: typeof getEffectiveReportLanguage === 'function' ? getEffectiveReportLanguage() : lang
  };
}
function getSystemQuotationEquipmentSnapshot(system){
  system = system || {};
  var option = system.selectedEquipmentOption || (system.equipmentSnapshot && system.equipmentSnapshot.selectionOption) || {};
  var record = (system.equipmentSnapshot && system.equipmentSnapshot.record) || option.record || {};
  var qty = Math.max(1, parseInt(option.quantity || system.qty, 10) || 1);
  var standardCapacity = Number((system.conceptualScenarioSnapshot && system.conceptualScenarioSnapshot.standardUnitCapacityBtuH) || system.selectedBtu || 0) || 0;
  var actualCapacity = Number(system.selectedCapacityBtuH || record.coolingCapacityBtuH || option.unitCapacityBtuH || standardCapacity || 0) || 0;
  return {
    project: getQuotationIdentitySnapshot(),
    systemId: system.id || '',
    systemType: system.unitType || 'split',
    selectedScenario: (system.conceptualScenarioSnapshot && (system.conceptualScenarioSnapshot.name || system.conceptualScenarioSnapshot.id)) || getProjectSystemDisplayName(system.id) || '',
    quantity: qty,
    standardCapacityBtuH: standardCapacity,
    actualCapacityBtuH: actualCapacity,
    totalActualCapacityBtuH: actualCapacity * qty,
    manufacturer: system.selectedManufacturer || record.manufacturerName || record.brand || '',
    model: system.selectedModel || record.exactModelNumber || record.series || '',
    equipmentType: record.equipmentType || mapProjectSystemTypeToEquipmentType(system.unitType),
    cfm: Number(system.selectedAirflowCfm || record.airflowNominalCfm || record.airflowMaxCfm || 0) || 0,
    totalCfm: Number(system.totalInstalledAirflowCfm || option.totalAirflowCfm || ((system.selectedAirflowCfm || record.airflowNominalCfm || 0) * qty) || 0) || 0,
    esp: option.availableEspPa == null ? record.availableEspPa : option.availableEspPa,
    voltage: record.voltage || '',
    phase: record.phase || '',
    efficiency: record.eer || record.cop || record.efficiency || record.energyEfficiency || '',
    sourceReference: record.sourceReference || record.sourceDocumentName || '',
    imageUrl: record.imageUrl || record.image || record.photoUrl || '',
    equipmentSnapshot: system.equipmentSnapshot || null,
    engineeringNotes: getProjectEngineeringValidation().notes || [],
    freshAirNotes: renderFreshAirNotesForQuotation(),
    ductAndFilter: getDuctAndFilterSnapshot()
  };
}
function renderFreshAirNotesForQuotation(){
  var notes = [];
  var cfm = getProjTotalCfm();
  if(cfm > 0) notes.push((lang === 'ar' ? 'تدفق الإمداد المطلوب: ' : 'Required supply airflow: ') + Number(cfm).toLocaleString() + ' CFM');
  var healthcareCount = hist.filter(function(room){ return room && (room.isHealthcare || room.roomType || room.ach || room.oaStd || room.exhaust); }).length;
  if(healthcareCount) notes.push((lang === 'ar' ? 'توجد غرف صحية تحتاج مراجعة تهوية: ' : 'Healthcare ventilation review required for rooms: ') + healthcareCount);
  if(!notes.length) notes.push(lang === 'ar' ? 'لا توجد ملاحظات هواء نقي إضافية.' : 'No additional fresh air notes.');
  return notes;
}
function buildDefaultQuotationLines(system, existingDraft){
  var snap = getSystemQuotationEquipmentSnapshot(system);
  var existingByKey = {};
  if(existingDraft && Array.isArray(existingDraft.lines)){
    existingDraft.lines.forEach(function(line){
      if(line && line.key) existingByKey[line.key] = line;
    });
  }
  function line(key, labelAr, labelEn, qty, lockedTech){
    var previous = existingByKey[key] || {};
    return {
      id: previous.id || makeWorkspaceId('quote_line'),
      key: key,
      labelAr: labelAr,
      labelEn: labelEn,
      quantity: key === 'equipment' ? snap.quantity : Math.max(0, Number(previous.quantity != null ? previous.quantity : qty) || 0),
      unitPrice: Number(previous.unitPrice || 0) || 0,
      notes: previous.notes || '',
      lockedTechnical: lockedTech === true,
      removable: key !== 'equipment'
    };
  }
  return [
    line('equipment', snap.quantity + ' × ' + [snap.manufacturer, utLabel(snap.systemType), snap.model].filter(Boolean).join(' ') + ' ' + Number(snap.actualCapacityBtuH || 0).toLocaleString() + ' BTU/h', snap.quantity + ' × ' + [snap.manufacturer, utLabel(snap.systemType), snap.model].filter(Boolean).join(' ') + ' ' + Number(snap.actualCapacityBtuH || 0).toLocaleString() + ' BTU/h', snap.quantity, true),
    line('installation', 'التركيب', 'Installation', 1, false),
    line('accessories', 'الإكسسوارات', 'Accessories', 1, false),
    line('duct', 'مجاري الهواء', 'Duct Cost', 1, false),
    line('copper', 'مواسير النحاس', 'Copper Pipes', 1, false),
    line('drain', 'مواسير التصريف', 'Drain Pipes', 1, false),
    line('control', 'نظام التحكم / كابل التحكم', 'Control System / Cable', 1, false),
    line('electrical', 'التوصيل الكهربائي', 'Electrical Connection', 1, false),
    line('testing', 'الاختبار والتشغيل', 'Testing & Commissioning', 1, false),
    line('transportation', 'النقل', 'Transportation', 1, false),
    line('warranty', 'الضمان', 'Warranty', 1, false)
  ];
}
function buildAutomaticQuotationDraft(system, existingDraft){
  var snap = getSystemQuotationEquipmentSnapshot(system);
  var previous = existingDraft || {};
  return {
    version: 'quotation-draft-v1',
    source: 'technical_report_selected_equipment',
    updatedAt: new Date().toISOString(),
    equipmentRevisionKey: [snap.manufacturer, snap.model, snap.actualCapacityBtuH, snap.quantity].join('|'),
    snapshot: snap,
    lines: buildDefaultQuotationLines(system, previous),
    discount: Number(previous.discount || 0) || 0,
    vatRate: previous.vatRate == null ? 15 : Number(previous.vatRate || 0),
    warranty: previous.warranty || '',
    notes: previous.notes || ''
  };
}
function syncQuotationDraftFromEquipment(system, opts){
  opts = opts || {};
  if(!system) return null;
  var current = system.quotationDraft || null;
  var next = buildAutomaticQuotationDraft(system, current);
  system.quotationDraft = next;
  if(opts.persist !== false) saveProjectSystems();
  return next;
}
function getProjectQuotationDrafts(){
  return ensureProjectSystems().filter(Boolean).map(function(system){
    return system.quotationDraft || syncQuotationDraftFromEquipment(system, { persist:false });
  }).filter(Boolean);
}
function getQuotationLineTotal(line){
  return (Math.max(0, Number(line && line.quantity) || 0) * Math.max(0, Number(line && line.unitPrice) || 0));
}
function getQuotationDraftTotals(draft){
  var lines = draft && Array.isArray(draft.lines) ? draft.lines : [];
  var equipmentCost = 0;
  var installationCost = 0;
  var accessoriesCost = 0;
  var subtotal = lines.reduce(function(sum, line){
    var total = getQuotationLineTotal(line);
    if(line && line.key === 'equipment') equipmentCost += total;
    else if(line && line.key === 'installation') installationCost += total;
    else accessoriesCost += total;
    return sum + total;
  }, 0);
  var discount = Math.max(0, Number(draft && draft.discount) || 0);
  var vatRate = Math.max(0, Number(!draft || draft.vatRate == null ? 15 : draft.vatRate) || 0);
  var vatBase = Math.max(0, subtotal - discount);
  var vat = vatOn ? vatBase * vatRate / 100 : 0;
  return {
    equipmentCost: equipmentCost,
    installationCost: installationCost,
    accessoriesCost: accessoriesCost,
    subtotal: subtotal,
    discount: discount,
    vat: vat,
    grand: vatBase + vat
  };
}
function persistQuotationLineValue(systemId, lineId, field, value, rerender){
  var system = getProjectSystem(systemId);
  if(!system) return null;
  var draft = system.quotationDraft || syncQuotationDraftFromEquipment(system, { persist:false });
  var lines = Array.isArray(draft.lines) ? draft.lines : [];
  var changedLine = null;
  lines.forEach(function(line){
    if(line.id !== lineId) return;
    if(field === 'quantity') line.quantity = Math.max(0, Number(value) || 0);
    if(field === 'unitPrice') line.unitPrice = Math.max(0, Number(value) || 0);
    if(field === 'notes') line.notes = String(value || '');
    changedLine = line;
  });
  draft.updatedAt = new Date().toISOString();
  system.quotationDraft = draft;
  saveProjectSystems();
  if(rerender) renderQuote();
  return { line: changedLine, draft: draft };
}
function parseQuotationMoneyInput(value){
  var normalized = String(value == null ? '' : value)
    .replace(/,/g, '')
    .replace(/[^\d.-]/g, '');
  return Math.max(0, Number(normalized) || 0);
}
function recalcAutomaticQuotationCardFromDom(card){
  if(!card || !card.querySelectorAll) return null;
  var totals = {
    equipmentCost: 0,
    installationCost: 0,
    accessoriesCost: 0,
    subtotal: 0,
    discount: 0,
    vat: 0,
    grand: 0,
    equipmentQty: 0
  };
  card.querySelectorAll('.auto-quote-line').forEach(function(row){
    var key = row.getAttribute('data-auto-quote-line-key') || '';
    var qtyInput = row.querySelector('[data-auto-quote-line-field="quantity"]');
    var priceInput = row.querySelector('[data-auto-quote-line-field="unitPrice"]');
    var qty = parseQuotationMoneyInput(qtyInput && qtyInput.value);
    var unitPrice = parseQuotationMoneyInput(priceInput && priceInput.value);
    var lineTotal = qty * unitPrice;
    var totalEl = row.querySelector('[data-auto-quote-line-total]');
    if(totalEl) totalEl.textContent = t('cur') + ' ' + money(lineTotal);
    if(key === 'equipment'){
      totals.equipmentCost += lineTotal;
      totals.equipmentQty += qty;
    } else if(key === 'installation'){
      totals.installationCost += lineTotal;
    } else {
      totals.accessoriesCost += lineTotal;
    }
    totals.subtotal += lineTotal;
  });
  var discountInput = card.querySelector('[data-auto-quote-draft-field="discount"]');
  totals.discount = parseQuotationMoneyInput(discountInput && discountInput.value);
  var vatBase = Math.max(0, totals.subtotal - totals.discount);
  totals.vat = vatOn ? vatBase * 0.15 : 0;
  totals.grand = vatBase + totals.vat;
  var values = {
    equipment: totals.equipmentCost,
    installation: totals.installationCost,
    accessories: totals.accessoriesCost,
    subtotal: totals.subtotal,
    discount: totals.discount,
    vat: totals.vat,
    grand: totals.grand
  };
  Object.keys(values).forEach(function(key){
    var el = card.querySelector('[data-auto-quote-summary="'+key+'"]');
    if(el) el.textContent = t('cur') + ' ' + money(values[key]);
  });
  return totals;
}
function refreshProjectQuotationTotalsFromDom(){
  if(typeof document === 'undefined' || quoteMode !== 'proj') return false;
  var cards = document.querySelectorAll('.auto-quotation-card');
  if(!cards || !cards.length) return false;
  var subtotal = 0;
  var installationCost = 0;
  var totalQty = 0;
  var discount = 0;
  var vat = 0;
  var grand = 0;
  cards.forEach(function(card){
    var totals = recalcAutomaticQuotationCardFromDom(card);
    if(!totals) return;
    subtotal += totals.subtotal;
    installationCost += totals.installationCost;
    totalQty += totals.equipmentQty;
    discount += totals.discount;
    vat += totals.vat;
    grand += totals.grand;
  });
  var cur = t('cur');
  var sv = G('qs-subtotal-v'); if(sv) sv.textContent = cur + ' ' + money(subtotal);
  var iv = G('qs-inst-v'); if(iv) iv.textContent = cur + ' ' + money(installationCost);
  var vv = G('qs-vat-v'); if(vv) vv.textContent = cur + ' ' + money(vat);
  var tq = G('qt-total-qty'); if(tq) tq.textContent = totalQty;
  var tg = G('qt-grand'); if(tg) tg.textContent = cur + ' ' + money(grand);
  return true;
}
function updateQuotationLineLive(systemId, lineId, field, value, inputEl){
  var update = persistQuotationLineValue(systemId, lineId, field, value, false);
  refreshQuotationPricingProgress();
  var row = inputEl && inputEl.closest ? inputEl.closest('.auto-quote-line') : null;
  if(row && update && update.line){
    var totalEl = row.querySelector('[data-auto-quote-line-total]');
    if(totalEl) totalEl.textContent = t('cur') + ' ' + money(getQuotationLineTotal(update.line));
  }
  var card = inputEl && inputEl.closest ? inputEl.closest('.auto-quotation-card') : null;
  if(card){
    if(update && update.draft) refreshAutomaticQuotationSummary(card, update.draft);
    recalcAutomaticQuotationCardFromDom(card);
  }
  if(!refreshProjectQuotationTotalsFromDom()) refreshGrandTotal();
}
function refreshAutomaticQuotationSummary(card, draft){
  if(!card || !draft) return;
  var totals = getQuotationDraftTotals(draft);
  var values = {
    equipment: totals.equipmentCost,
    installation: totals.installationCost,
    accessories: totals.accessoriesCost,
    subtotal: totals.subtotal,
    discount: totals.discount,
    vat: totals.vat,
    grand: totals.grand
  };
  Object.keys(values).forEach(function(key){
    var el = card.querySelector('[data-auto-quote-summary="'+key+'"]');
    if(el) el.textContent = t('cur') + ' ' + money(values[key]);
  });
}
function updateQuotationLine(systemId, lineId, field, value){
  persistQuotationLineValue(systemId, lineId, field, value, true);
}
function persistQuotationDraftFieldValue(systemId, field, value, rerender){
  var system = getProjectSystem(systemId);
  if(!system) return null;
  var draft = system.quotationDraft || syncQuotationDraftFromEquipment(system, { persist:false });
  if(field === 'discount') draft.discount = Math.max(0, Number(value) || 0);
  if(field === 'warranty') draft.warranty = String(value || '');
  if(field === 'notes') draft.notes = String(value || '');
  draft.updatedAt = new Date().toISOString();
  system.quotationDraft = draft;
  saveProjectSystems();
  if(rerender) renderQuote();
  return draft;
}
function updateQuotationDraftField(systemId, field, value){
  persistQuotationDraftFieldValue(systemId, field, value, true);
}
function updateQuotationDraftFieldLive(systemId, field, value, inputEl){
  var draft = persistQuotationDraftFieldValue(systemId, field, value, false);
  var card = inputEl && inputEl.closest ? inputEl.closest('.auto-quotation-card') : null;
  if(card){
    if(draft) refreshAutomaticQuotationSummary(card, draft);
    recalcAutomaticQuotationCardFromDom(card);
  }
  if(!refreshProjectQuotationTotalsFromDom()) refreshGrandTotal();
}
var quotationLivePricingDelegatesBound = false;
function bindQuotationLivePricingDelegates(){
  if(quotationLivePricingDelegatesBound || typeof document === 'undefined') return;
  quotationLivePricingDelegatesBound = true;
  var handler = function(event){
    var input = event && event.target;
    if(!input || !input.getAttribute) return;
    var lineField = input.getAttribute('data-auto-quote-line-field');
    if(lineField){
      updateQuotationLineLive(
        input.getAttribute('data-auto-quote-system-id') || '',
        input.getAttribute('data-auto-quote-line-id') || '',
        lineField,
        input.value,
        input
      );
      return;
    }
    var draftField = input.getAttribute('data-auto-quote-draft-field');
    if(draftField){
      updateQuotationDraftFieldLive(
        input.getAttribute('data-auto-quote-system-id') || '',
        draftField,
        input.value,
        input
      );
    }
  };
  document.addEventListener('input', handler, true);
  document.addEventListener('change', handler, true);
}
function addQuotationCommercialLine(systemId){
  var system = getProjectSystem(systemId);
  if(!system) return;
  var draft = system.quotationDraft || syncQuotationDraftFromEquipment(system, { persist:false });
  draft.lines = Array.isArray(draft.lines) ? draft.lines : [];
  draft.lines.push({
    id: makeWorkspaceId('quote_line'),
    key: 'custom_' + Date.now().toString(36),
    labelAr: lang === 'ar' ? 'بند إضافي' : 'Custom Item',
    labelEn: 'Custom Item',
    quantity: 1,
    unitPrice: 0,
    notes: '',
    lockedTechnical: false,
    removable: true
  });
  system.quotationDraft = draft;
  saveProjectSystems();
  renderQuote();
}
function removeQuotationCommercialLine(systemId, lineId){
  var system = getProjectSystem(systemId);
  if(!system || !system.quotationDraft) return;
  system.quotationDraft.lines = (system.quotationDraft.lines || []).filter(function(line){
    return line.id !== lineId || line.removable === false;
  });
  saveProjectSystems();
  renderQuote();
}
function getCommercialEquipmentOptions(system){
  var records = window.AppEquipmentDatabase && window.AppEquipmentDatabase.allRecords ? window.AppEquipmentDatabase.allRecords() : [];
  var scenario = getReportScenarioSnapshotForSystem(system);
  var capacity=Number(getSelectedUnitCapacityBtu(system));
  var quantity=Math.max(1,parseInt(system.qty,10)||1);
  var required=Number(scenario.requiredCoolingCapacityBtuH)||0;
  if(!Number.isFinite(capacity) || capacity<=0) return [];
  return records.filter(function(record){
    var actual=Number(record.coolingCapacityBtuH);
    return !record.sampleData && !record.discontinued && isProjectSystemEquipmentRecordCompatible(system.unitType,record) &&
      Number.isFinite(actual) && actual>0 && Math.abs(actual/capacity-1)<=0.100000001 && actual*quantity>=required;
  }).map(function(record){
    return {record:record,quantity:quantity,unitCapacityDifferencePct:(Number(record.coolingCapacityBtuH)/capacity-1)*100};
  }).sort(function(a,b){return Math.abs(a.unitCapacityDifferencePct)-Math.abs(b.unitCapacityDifferencePct);});
}

function selectCommercialQuotationEquipment(systemId,equipmentId){
  var system = getProjectSystem(systemId);
  if(!system) return false;
  var match = getCommercialEquipmentOptions(system).find(function(item){return item.record.id === equipmentId;});
  if(!match) return false;
  var draft = system.quotationDraft || syncQuotationDraftFromEquipment(system,{persist:false});
  var record = match.record;
  // Commercial selection is a quote snapshot; engineering system state is untouched.
  draft.commercialEquipment = JSON.parse(JSON.stringify(record));
  draft.snapshot = Object.assign({},draft.snapshot,{
    manufacturer:record.manufacturerName || record.brand,model:record.exactModelNumber,
    actualCapacityBtuH:record.coolingCapacityBtuH,sourceReference:record.sourceReference,
    cfm:record.airflowNominalCfm,totalCfm:record.airflowNominalCfm == null ? null : record.airflowNominalCfm * match.quantity,
    esp:record.availableEspPa,imageUrl:record.imageUrl || '',equipmentSnapshot:JSON.parse(JSON.stringify(record))
  });
  draft.lines.forEach(function(line){
    if(line.key !== 'equipment') return;
    var label=[record.manufacturerName || record.brand,record.exactModelNumber,Number(record.coolingCapacityBtuH).toLocaleString('en-US')+' BTU/h'].join(' · ');
    line.labelAr=label; line.labelEn=label;
  });
  draft.updatedAt=new Date().toISOString();
  system.quotationDraft=draft;
  saveProjectSystems();
  renderQuote();
  return true;
}

function renderCommercialEquipmentPicker(system,draft){
  var options=getCommercialEquipmentOptions(system);
  var selected=draft.commercialEquipment && draft.commercialEquipment.id;
  return '<label class="commercial-equipment-picker no-print"><span>'+(lang==='ar'?'الشركة والموديل':'Manufacturer and model')+'</span><select onchange="selectCommercialQuotationEquipment(\''+esc(system.id)+'\',this.value)"><option value="">'+(lang==='ar'?'اختر معدة مناسبة للتسعير':'Select matching equipment to price')+'</option>'+options.map(function(item){
    var record=item.record;
    return '<option value="'+esc(record.id)+'" '+(record.id===selected?'selected':'')+'>'+esc([record.manufacturerName || record.brand,record.exactModelNumber,Number(record.coolingCapacityBtuH).toLocaleString('en-US')+' BTU/h',record.frequencyHz ? record.frequencyHz+' Hz' : '',record.manufacturerId==='skm'?(lang==='ar'?'إجمالية عند 46°C':'Gross at 46 C'):''].filter(Boolean).join(' · '))+'</option>';
  }).join('')+'</select>'+(!options.length?'<small>'+esc((lang==='ar'?'لم نجد سعة كتالوجية تغطي الحمل ضمن ±10% من ':'No catalogue capacity covers the load within ±10% of ')+Number(getSelectedUnitCapacityBtu(system)||0).toLocaleString('en-US')+' BTU/h · '+utLabel(system.unitType)+(lang==='ar'?'؛ قد تكون سعة التبريد غير مسجلة لبعض الموديلات.':'; some models may have no recorded cooling capacity.'))+'</small>':'')+'</label>';
}

function renderCommercialEquipmentAlternatives(system,draft){
  var options=getCommercialEquipmentOptions(system), picked=[], seen={};
  options.forEach(function(item){
    var brand=item.record.manufacturerName || item.record.brand || '';
    if(!seen[brand]){picked.push(item);seen[brand]=true;}
  });
  options.forEach(function(item){if(picked.length<6 && picked.indexOf(item)<0) picked.push(item);});
  return '<div class="commercial-alternatives no-print"><h3>'+(lang==='ar'?'بدائل المعدات المناسبة':'Matching equipment alternatives')+' <small>('+options.length+')</small></h3><div class="commercial-alternatives-grid">'+picked.slice(0,6).map(function(item){
    var record=item.record,active=draft.commercialEquipment && draft.commercialEquipment.id===record.id;
    var brandLogo=window.AirCalcManufacturerLogo?window.AirCalcManufacturerLogo(record.manufacturerName || record.brand):'';
    return '<article class="commercial-alternative'+(active?' is-selected':'')+ '">'+brandLogo+'<strong>'+esc(record.manufacturerName || record.brand || '')+'</strong><span>'+esc(record.exactModelNumber || '')+'</span><b dir="ltr">'+Number(record.coolingCapacityBtuH).toLocaleString('en-US')+' BTU/h</b><small>'+esc((record.frequencyHz?record.frequencyHz+' Hz':'')+(record.manufacturerId==='skm' && /^APMR/.test(record.exactModelNumber || '')?(lang==='ar'?' · سعة إجمالية عند 46°C':' · Gross at 46 C'):''))+'</small><button type="button" onclick="selectCommercialQuotationEquipment(\''+esc(system.id)+'\',\''+esc(record.id)+'\')">'+(active?(lang==='ar'?'مختارة':'Selected'):(lang==='ar'?'اختيار للتسعير':'Select to price'))+'</button></article>';
  }).join('')+'</div></div>';
}

function renderAutomaticQuotationDraft(system){
  var draft = system.quotationDraft || syncQuotationDraftFromEquipment(system, { persist:false });
  refreshQuotationPricingProgress();
  var snap = draft.snapshot || getSystemQuotationEquipmentSnapshot(system);
  var totals = getQuotationDraftTotals(draft);
  var systemId = system.id;
  var imageHtml = snap.imageUrl ? '<img class="auto-quote-equipment-image" src="'+esc(snap.imageUrl)+'" alt="'+esc(snap.manufacturer || 'Equipment')+'">' : '';
  var referenceItems = [
    [lang==='ar'?'الشركة':'Company', snap.manufacturer || '—'],
    [lang==='ar'?'الموديل':'Model', snap.model || '—'],
    [lang==='ar'?'السعة':'Capacity', Number(snap.actualCapacityBtuH || 0).toLocaleString() + ' BTU/h'],
    [lang==='ar'?'الكمية':'Quantity', snap.quantity],
    [lang==='ar'?'المرجع':'Reference', snap.sourceReference || '—']
  ];
  var transferItems = [
    [lang==='ar'?'اسم المشروع':'Project Name', (snap.project && snap.project.projectName) || '—'],
    [lang==='ar'?'رقم المشروع':'Project Number', (snap.project && snap.project.projectNumber) || '—'],
    [lang==='ar'?'العميل':'Client', (snap.project && snap.project.client) || '—'],
    [lang==='ar'?'الموقع':'Location', (snap.project && snap.project.location) || '—'],
    [lang==='ar'?'النظام':'System Type', utLabel(snap.systemType)],
    [lang==='ar'?'السيناريو':'Selected Scenario', snap.selectedScenario || '—'],
    [lang==='ar'?'السعة القياسية':'Standard Capacity', Number(snap.standardCapacityBtuH || 0).toLocaleString() + ' BTU/h'],
    [lang==='ar'?'CFM / ESP':'CFM / ESP', Number(snap.totalCfm || snap.cfm || 0).toLocaleString() + ' CFM · ' + (snap.esp == null ? '—' : snap.esp + ' Pa')]
  ];
  var notesHtml = ''
    + '<div class="auto-quote-notes-panel">'
    + '<div><strong>'+(lang==='ar'?'ملاحظات هندسية':'Engineering Notes')+'</strong>'+(snap.engineeringNotes || []).slice(0,3).map(function(note){ return '<span>'+esc(note)+'</span>'; }).join('')+'</div>'
    + '<div><strong>'+(lang==='ar'?'ملاحظات الهواء النقي':'Fresh Air Notes')+'</strong>'+(snap.freshAirNotes || []).slice(0,3).map(function(note){ return '<span>'+esc(note)+'</span>'; }).join('')+'</div>'
    + '</div>';
  var linesHtml = (draft.lines || []).map(function(line){
    var label = lang === 'ar' ? (line.labelAr || line.labelEn) : (line.labelEn || line.labelAr);
    var lineTotal = getQuotationLineTotal(line);
    return '<div class="auto-quote-line '+(line.lockedTechnical?'locked-tech':'')+'" data-auto-quote-line-key="'+esc(line.key || '')+'">'+
      '<div class="auto-quote-line-name"><strong>'+esc(label)+'</strong>'+(line.key==='equipment'?renderCommercialEquipmentPicker(system,draft):'')+'</div>'+
      '<label class="auto-quote-price-field"><span>'+(lang==='ar'?'الكمية':'Qty')+'</span><input type="number" min="0" step="1" value="'+esc(line.quantity)+'" placeholder="0" data-auto-quote-system-id="'+esc(systemId)+'" data-auto-quote-line-id="'+esc(line.id)+'" data-auto-quote-line-field="quantity" oninput="updateQuotationLineLive(\''+esc(systemId)+'\',\''+esc(line.id)+'\',\'quantity\',this.value,this)" onchange="updateQuotationLineLive(\''+esc(systemId)+'\',\''+esc(line.id)+'\',\'quantity\',this.value,this)" '+(line.lockedTechnical?'':'')+'></label>'+
      '<label class="auto-quote-price-field unit-price"><span>'+(lang==='ar'?'ضع السعر هنا':'Enter price here')+'</span><input type="number" min="0" step="0.01" value="'+esc(line.unitPrice)+'" placeholder="'+(lang==='ar'?'سعر الوحدة':'Unit Price')+'" data-auto-quote-system-id="'+esc(systemId)+'" data-auto-quote-line-id="'+esc(line.id)+'" data-auto-quote-line-field="unitPrice" oninput="updateQuotationLineLive(\''+esc(systemId)+'\',\''+esc(line.id)+'\',\'unitPrice\',this.value,this)" onchange="updateQuotationLineLive(\''+esc(systemId)+'\',\''+esc(line.id)+'\',\'unitPrice\',this.value,this)"></label>'+
      '<div class="auto-quote-line-total"><span>'+(lang==='ar'?'الإجمالي':'Total')+'</span><strong data-auto-quote-line-total>'+t('cur')+' '+money(lineTotal)+'</strong></div>'+
      '<button type="button" class="auto-quote-remove" '+(line.removable===false?'disabled':'')+' onclick="removeQuotationCommercialLine(\''+esc(systemId)+'\',\''+esc(line.id)+'\')">'+(lang==='ar'?'حذف':'Remove')+'</button>'+
    '</div>';
  }).join('');
  return '<section class="auto-quotation-card" data-quotation-source="equipment-snapshot">'+
    '<div class="auto-quotation-head"><div><span>'+esc((snap.project && snap.project.projectNumber)||'')+'</span><strong>'+(lang==='ar'?'عرض سعر':'Quotation')+'</strong></div><button type="button" class="auto-quote-generate no-print" onclick="saveQuotationToCurrentProject()">'+(lang==='ar'?'حفظ عرض السعر':'Save quotation')+'</button></div>'+
    '<div class="auto-quote-reference">'+imageHtml+'<div class="auto-quote-reference-grid">'+referenceItems.map(function(item){ return '<div><span>'+esc(item[0])+'</span><strong>'+esc(item[1])+'</strong></div>'; }).join('')+'</div></div>'+
    '<div class="auto-quote-transfer-grid">'+transferItems.map(function(item){ return '<div><span>'+esc(item[0])+'</span><strong>'+esc(item[1])+'</strong></div>'; }).join('')+'</div>'+
    '<details class="auto-quote-technical-notes"><summary>'+(lang==='ar'?'الملاحظات الفنية':'Technical notes')+'</summary>'+notesHtml+'</details>'+
    '<div class="auto-quote-commercial-title"><span>'+(lang==='ar'?'التسعير التجاري':'Commercial Pricing')+'</span><strong>'+(lang==='ar'?'أدخل الأسعار فقط هنا':'Enter prices only here')+'</strong></div>'+
    renderCommercialEquipmentAlternatives(system,draft)+
    '<div class="auto-quote-lines">'+linesHtml+'</div>'+
    '<button type="button" class="auto-quote-add" onclick="addQuotationCommercialLine(\''+esc(systemId)+'\')">+ '+(lang==='ar'?'إضافة بند':'Add Item')+'</button>'+
    '<div class="auto-quote-commercial-fields">'+
      '<label><span>'+(lang==='ar'?'الخصم':'Discount')+'</span><input type="number" min="0" step="0.01" value="'+esc(draft.discount || 0)+'" data-auto-quote-system-id="'+esc(systemId)+'" data-auto-quote-draft-field="discount" oninput="updateQuotationDraftFieldLive(\''+esc(systemId)+'\',\'discount\',this.value,this)" onchange="updateQuotationDraftFieldLive(\''+esc(systemId)+'\',\'discount\',this.value,this)"></label>'+
      '<label><span>'+(lang==='ar'?'الضمان':'Warranty')+'</span><input type="text" value="'+esc(draft.warranty || '')+'" onchange="updateQuotationDraftField(\''+esc(systemId)+'\',\'warranty\',this.value)"></label>'+
      '<label class="auto-quote-notes"><span>'+(lang==='ar'?'ملاحظات':'Notes')+'</span><textarea onchange="updateQuotationDraftField(\''+esc(systemId)+'\',\'notes\',this.value)">'+esc(draft.notes || '')+'</textarea></label>'+
    '</div>'+
    '<div class="auto-quote-summary">'+
      '<div><span>'+(lang==='ar'?'تكلفة المعدات':'Equipment Cost')+'</span><strong data-auto-quote-summary="equipment">'+t('cur')+' '+money(totals.equipmentCost)+'</strong></div>'+
      '<div><span>'+(lang==='ar'?'تكلفة التركيب':'Installation Cost')+'</span><strong data-auto-quote-summary="installation">'+t('cur')+' '+money(totals.installationCost)+'</strong></div>'+
      '<div><span>'+(lang==='ar'?'الإكسسوارات':'Accessories')+'</span><strong data-auto-quote-summary="accessories">'+t('cur')+' '+money(totals.accessoriesCost)+'</strong></div>'+
      '<div><span>'+(lang==='ar'?'Subtotal':'Subtotal')+'</span><strong data-auto-quote-summary="subtotal">'+t('cur')+' '+money(totals.subtotal)+'</strong></div>'+
      '<div><span>'+(lang==='ar'?'Discount':'Discount')+'</span><strong data-auto-quote-summary="discount">'+t('cur')+' '+money(totals.discount)+'</strong></div>'+
      '<div><span>'+(lang==='ar'?'VAT':'VAT')+'</span><strong data-auto-quote-summary="vat">'+t('cur')+' '+money(totals.vat)+'</strong></div>'+
      '<div class="grand"><span>'+(lang==='ar'?'Grand Total':'Grand Total')+'</span><strong data-auto-quote-summary="grand">'+t('cur')+' '+money(totals.grand)+'</strong></div>'+
    '</div>'+
  '</section>';
}

function selectReportManufacturerRecommendation(optionKey){
  var store = window._reportEquipmentRecommendationOptions || {};
  var item = store[optionKey];
  if(!item || !item.option || !item.option.record) return false;
  var system = getProjectSystem(item.systemId);
  var record = item.option.record;
  var unitBtu = Number(record.coolingCapacityBtuH || 0) || 0;
  var qty = Math.max(1, parseInt(item.option.quantity, 10) || 1);
  if(!system || unitBtu < getSelectedUnitCapacityBtu(system) || unitBtu * qty < getReportScenarioSnapshotForSystem(system).requiredCoolingCapacityBtuH || qty !== Math.max(1, parseInt(system.qty,10) || 1)){
    if(window.toast) window.toast(lang==='ar' ? 'الاختيار لا يغطي السعة الحالية أو تغيرت الكمية. حدث المقترحات.' : 'Selection no longer covers the current capacity or quantity. Refresh recommendations.');
    renderTechReportFoundation();
    return false;
  }
  var existingKey = system && system.quotationDraft ? system.quotationDraft.equipmentRevisionKey : '';
  var nextKey = [record.manufacturerName || record.brand || '', record.exactModelNumber || record.series || '', unitBtu, qty].join('|');
  if(existingKey && existingKey !== nextKey){
    var updateMsg = lang === 'ar'
      ? 'تغيرت المعدة المختارة.\n\nهل تريد تحديث عرض السعر تلقائيًا مع الحفاظ على الأسعار التي أدخلتها قدر الإمكان؟'
      : 'The selected equipment has changed.\n\nUpdate quotation while preserving entered prices where possible?';
    if(window.confirm && !window.confirm(updateMsg)) return false;
  }
  var msg = (lang === 'ar'
    ? 'سيتم إنشاء Equipment Snapshot لهذه المعدة مع الحفاظ على كمية السيناريو.\n\n'
    : 'This will create an Equipment Snapshot for this recommendation while preserving the selected scenario quantity.\n\n')+
    (record.manufacturerName || record.brand || '—')+' / '+(record.exactModelNumber || record.series || '—')+'\n'+
    qty+' x '+Number(unitBtu).toLocaleString()+' BTU/h = '+Number(unitBtu * qty).toLocaleString()+' BTU/h';
  if(window.confirm && !window.confirm(msg)) return false;
  var applied = applyProjectSystemEquipmentSelection(item.systemId, item.equipmentId, item.option);
  if(applied){
    var updatedSystem = getProjectSystem(item.systemId);
    syncQuotationDraftFromEquipment(updatedSystem);
    quoteMode = 'proj';
    if(window.AppState) window.AppState.quoteMode = quoteMode;
    try{ AppStorage.saveQuoteMode(quoteMode); }catch(_e){}
    renderQuote();
    if(typeof openDesktopView === 'function') openDesktopView('hist');
    else if(typeof showPanel === 'function') showPanel('hist');
    if(window.toast) window.toast(lang === 'ar' ? 'تم إنشاء عرض السعر تلقائيًا من المعدة المختارة' : 'Automatic quotation created from selected equipment');
  }
  return applied;
}

function getReportSelectedEquipmentItems(){
  return getSelectedReportScenarioSystems().map(function(system){
    var option = system.selectedEquipmentOption || (system.equipmentSnapshot && system.equipmentSnapshot.selectionOption) || {};
    var record = (system.equipmentSnapshot && system.equipmentSnapshot.record) || option.record || {};
    var manufacturer = system.selectedManufacturer || record.manufacturerName || record.brand || '';
    var model = system.selectedModel || record.exactModelNumber || record.series || '';
    if(!manufacturer && !model && !system.selectedEquipmentId) return null;
    var qty = Math.max(1, parseInt(option.quantity || system.qty, 10) || 1);
    var unitBtu = Number(system.selectedCapacityBtuH || record.coolingCapacityBtuH || system.selectedBtu || 0) || 0;
    return {
      system: system,
      manufacturer: manufacturer || '—',
      model: model || '—',
      quantity: qty,
      unitCapacityBtuH: unitBtu,
      totalCapacityBtuH: Number(option.totalCapacityBtuH || system.totalInstalledCapacityBtuH || (unitBtu * qty) || 0) || 0,
      status: system.scenarioStatus || (lang === 'ar' ? 'تم الاختيار' : 'Selected')
    };
  }).filter(Boolean);
}

function renderTechReportSelectedEquipmentCompactSection(){
  var items = getReportSelectedEquipmentItems();
  if(!items.length){
    return '<section class="tech-doc-section"><div class="tech-doc-section-head">'+(lang==='ar'?'المعدة المختارة':'Selected Equipment')+'</div><div class="tech-doc-empty">'+(lang==='ar'?'لم يتم اختيار معدة بعد. اختر من مقترحات الشركات لحفظ بياناتها ونقلها إلى عرض السعر.' :'No manufacturer equipment has been selected yet. Select from Manufacturer Recommendations to create the Equipment Snapshot and transfer it to Quotation.')+'</div></section>';
  }
  return '<section class="tech-doc-section selected-equipment-section" data-report-source="selected-equipment-workflow">'+
    '<div class="tech-doc-section-head">'+(lang==='ar'?'المعدة المختارة':'Selected Equipment')+'</div>'+
    '<div class="selected-equipment-cards">'+items.map(function(item){
      return '<article class="selected-equipment-card">'+
        '<div class="manufacturer-rec-logo">'+esc(item.manufacturer.slice(0,2).toUpperCase())+'</div>'+
        '<div><span>'+(lang==='ar'?'الشركة':'Company')+'</span><strong>'+esc(item.manufacturer)+'</strong></div>'+
        '<div><span>'+(lang==='ar'?'الموديل':'Model')+'</span><strong>'+esc(item.model)+'</strong></div>'+
        '<div><span>'+(lang==='ar'?'الكمية':'Quantity')+'</span><strong>'+item.quantity+'</strong></div>'+
        '<div><span>'+(lang==='ar'?'السعة الفعلية':'Actual Capacity')+'</span><strong>'+Number(item.unitCapacityBtuH||0).toLocaleString()+' BTU/h</strong></div>'+
        '<div><span>'+(lang==='ar'?'الحالة':'Status')+'</span><strong>'+esc(item.status || 'Selected')+'</strong></div>'+
      '</article>';
    }).join('')+'</div>'+
  '</section>';
}

function readSelectedEquipmentSnapshotForReport(){
  try{
    var raw = localStorage.getItem('aircalc_last_selected_equipment_snapshot');
    return raw ? JSON.parse(raw) : null;
  } catch(_err){
    return null;
  }
}
function reportEquipmentValue(value, unit){
  var n = Number(value);
  if(!isFinite(n) || n <= 0) return '—';
  return Number(Math.round(n)).toLocaleString() + (unit ? ' ' + unit : '');
}
function renderTechReportSelectedEquipmentSnapshotSection(forceIsAr){
  var isAr = typeof forceIsAr === 'boolean' ? forceIsAr : (lang === 'ar');
  var reportData = window._lastProfessionalReportData || refreshProfessionalReportDataCache({ language: isAr ? 'ar' : 'en' });
  var reportSnapshot = reportData && reportData.equipmentSnapshot ? reportData.equipmentSnapshot : null;
  var snap = reportSnapshot ? {
    selectedAt: reportSnapshot.selectedAt || reportSnapshot.snapshotTime,
    source: reportSnapshot.sourceReference,
    record: {
      manufacturerName: reportSnapshot.manufacturerName,
      exactModelNumber: reportSnapshot.exactModelNumber,
      equipmentType: reportSnapshot.equipmentType,
      verificationStatus: reportSnapshot.catalogueStatus,
      saudiMarketStatus: reportSnapshot.saudiMarketStatus,
      sourceReference: reportSnapshot.sourceReference,
      sourceDocumentName: reportSnapshot.sourceDocumentName,
      voltage: reportSnapshot.voltage,
      phase: reportSnapshot.phase,
      frequencyHz: reportSnapshot.frequencyHz,
      coolingCapacityStatus: reportSnapshot.coolingCapacityStatus,
      sensibleCapacityBtuH: reportSnapshot.sensibleCapacityBtuH,
      maxOutdoorTemperatureC: reportSnapshot.maxOutdoorTemperatureC
    },
    selectionOption: {
      quantity: reportSnapshot.quantity,
      totalCapacityBtuH: reportSnapshot.totalCapacityBtuH,
      totalAirflowCfm: reportSnapshot.totalAirflowCfm,
      availableEspPa: reportSnapshot.availableEspPa,
      selectionRequirements: reportSnapshot.requirements || {},
      preBindReview: reportSnapshot.preBindReview || null,
      engineerVerificationRequired: reportSnapshot.engineerVerificationRequired || []
    }
  } : readSelectedEquipmentSnapshotForReport();
  var title = isAr ? 'التفاصيل الفنية للمعدة المختارة' : 'Technical Details';
  if(!snap || (!snap.record && !(snap.selectionOption && snap.selectionOption.record))){
    return '<section class="tech-doc-section"><div class="tech-doc-section-head">'+title+'</div><div class="tech-doc-empty">'+
      (isAr ? 'لا توجد وحدة كتالوج مربوطة بالمشروع بعد.' : 'No catalogue equipment snapshot is linked to this project yet.')+
      '</div></section>';
  }
  var option = snap.selectionOption || {};
  var record = snap.record || option.record || {};
  var req = option.selectionRequirements || {};
  var preBindReview = option.preBindReview || null;
  var qty = Math.max(1, parseInt(option.quantity || option.activeQuantity || 1, 10) || 1);
  var isAirflowOnlyAhuSnapshot = String(record.equipmentType || '').toLowerCase() === 'ahu' && (record.coolingCapacityStatus === 'coil_submittal_required' || (!option.totalCapacityBtuH && !record.coolingCapacityBtuH));
  var totalBtu = isAirflowOnlyAhuSnapshot ? null : (Number(option.totalCapacityBtuH || ((record.coolingCapacityBtuH || 0) * qty)) || 0);
  var totalCfm = Number(option.totalAirflowCfm || ((record.airflowNominalCfm || record.airflowMaxCfm || 0) * qty)) || 0;
  var availableEsp = option.availableEspPa == null ? record.availableEspPa : option.availableEspPa;
  var capacityDiff = (!isAirflowOnlyAhuSnapshot && req.requiredCoolingLoadBtuH) ? ((totalBtu - Number(req.requiredCoolingLoadBtuH || 0)) / Number(req.requiredCoolingLoadBtuH || 1)) * 100 : null;
  var cfmDiff = req.requiredSupplyCfm ? ((totalCfm - Number(req.requiredSupplyCfm || 0)) / Number(req.requiredSupplyCfm || 1)) * 100 : null;
  var currentProjectBtu = typeof getProjectRequiredLoadBtu === 'function' ? Number(getProjectRequiredLoadBtu() || 0) : 0;
  var currentProjectCfm = typeof getProjectRequiredLoadCfm === 'function' ? Number(getProjectRequiredLoadCfm() || 0) : 0;
  var projectLoadChanged = req.requiredCoolingLoadBtuH && currentProjectBtu && Math.abs(((currentProjectBtu - Number(req.requiredCoolingLoadBtuH || 0)) / Number(req.requiredCoolingLoadBtuH || 1)) * 100) > 2;
  var projectCfmChanged = req.requiredSupplyCfm && currentProjectCfm && Math.abs(((currentProjectCfm - Number(req.requiredSupplyCfm || 0)) / Number(req.requiredSupplyCfm || 1)) * 100) > 2;
  var currentCapacityDiff = (!isAirflowOnlyAhuSnapshot && currentProjectBtu) ? ((totalBtu - currentProjectBtu) / Math.max(1, currentProjectBtu)) * 100 : null;
  var currentCfmDiff = currentProjectCfm ? ((totalCfm - currentProjectCfm) / Math.max(1, currentProjectCfm)) * 100 : null;
  var notes = [];
  if(projectLoadChanged || projectCfmChanged) notes.push(isAr ? 'تغيرت متطلبات المشروع بعد اختيار الوحدة؛ أعد تشغيل اختيار الوحدة قبل الاعتماد.' : 'Project requirements changed after equipment selection; re-run equipment selection before approval.');
  if(isAirflowOnlyAhuSnapshot) notes.push(isAr ? 'سعة AHU الحرارية غير معتمدة من قاعدة الوحدات؛ يجب اعتماد الكويل من submittal قبل إصدار التقرير النهائي.' : 'AHU cooling capacity is not approved from the equipment database; approve the coil from submittal before issuing the final report.');
  if(record.verificationStatus !== 'verified') notes.push(isAr ? 'بيانات الكتالوج تحتاج توثيق قبل الاعتماد.' : 'Catalogue data requires verification before approval.');
  if(!record.sourceReference && !record.sourceDocumentName) notes.push(isAr ? 'مرجع الكتالوج غير مرفق.' : 'Catalogue source reference is missing.');
  if(record.sensibleCapacityBtuH == null) notes.push(isAr ? 'سعة Sensible غير متوفرة وتحتاج مراجعة.' : 'Sensible capacity is missing and should be reviewed.');
  if(record.maxOutdoorTemperatureC == null) notes.push(isAr ? 'درجة حرارة التشغيل الخارجية غير موثقة.' : 'Outdoor operating temperature is not documented.');
  if(option.engineerVerificationRequired && option.engineerVerificationRequired.length){
    notes = notes.concat(option.engineerVerificationRequired);
  }
  if(preBindReview && preBindReview.notes && preBindReview.notes.length){
    notes = notes.concat(preBindReview.notes);
  }
  if(!notes.length) notes.push(isAr ? 'لا توجد ملاحظات كتالوج إضافية على snapshot الحالي.' : 'No additional catalogue notes on the current snapshot.');
  var selectedAt = snap.selectedAt ? new Date(snap.selectedAt).toLocaleString(isAr ? 'ar-SA' : 'en-GB') : '—';
  return '<section class="tech-doc-section" data-report-source="'+(reportSnapshot ? 'professional-report-equipment-snapshot' : 'local-storage-equipment-snapshot')+'">'+
    '<div class="tech-doc-section-head">'+title+'</div>'+
    '<div class="tech-doc-grid meta">'+
      '<div class="tech-doc-cell"><span>'+(isAr?'الشركة':'Manufacturer')+'</span><strong>'+esc(record.manufacturerName || '—')+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(isAr?'الموديل':'Model')+'</span><strong>'+esc(record.exactModelNumber || '—')+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(isAr?'نوع الوحدة':'Equipment Type')+'</span><strong>'+esc(record.equipmentType || '—')+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(isAr?'الكمية':'Quantity')+'</span><strong>'+esc(String(qty))+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(isAr?'إجمالي السعة':'Total Capacity')+'</span><strong>'+esc(isAirflowOnlyAhuSnapshot ? (isAr ? 'اعتماد الكويل مطلوب' : 'Coil submittal required') : reportEquipmentValue(totalBtu, 'BTU/h'))+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(isAr?'إجمالي الهواء':'Total Airflow')+'</span><strong>'+esc(reportEquipmentValue(totalCfm, 'CFM'))+'</strong></div>'+
      '<div class="tech-doc-cell"><span>ESP</span><strong>'+esc(reportEquipmentValue(availableEsp, 'Pa'))+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(isAr?'الكهرباء':'Electrical')+'</span><strong>'+esc([record.voltage ? record.voltage + 'V' : '', record.phase ? record.phase + 'Ph' : '', record.frequencyHz ? record.frequencyHz + 'Hz' : ''].filter(Boolean).join(' / ') || '—')+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(isAr?'توثيق الكتالوج':'Catalogue Status')+'</span><strong>'+esc(record.verificationStatus || '—')+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(isAr?'توفر السعودية':'Saudi Availability')+'</span><strong>'+esc(record.saudiMarketStatus || '—')+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(isAr?'فرق السعة وقت الاختيار':'Selection Capacity Delta')+'</span><strong>'+esc(capacityDiff == null ? '—' : ((capacityDiff >= 0 ? '+' : '') + capacityDiff.toFixed(1) + '%'))+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(isAr?'فرق CFM وقت الاختيار':'Selection CFM Delta')+'</span><strong>'+esc(cfmDiff == null ? '—' : ((cfmDiff >= 0 ? '+' : '') + cfmDiff.toFixed(1) + '%'))+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(isAr?'فرق السعة الحالي':'Current Capacity Delta')+'</span><strong>'+esc(currentCapacityDiff == null ? '—' : ((currentCapacityDiff >= 0 ? '+' : '') + currentCapacityDiff.toFixed(1) + '%'))+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(isAr?'فرق CFM الحالي':'Current CFM Delta')+'</span><strong>'+esc(currentCfmDiff == null ? '—' : ((currentCfmDiff >= 0 ? '+' : '') + currentCfmDiff.toFixed(1) + '%'))+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(isAr?'حالة المتطلبات':'Requirement Status')+'</span><strong>'+esc(projectLoadChanged || projectCfmChanged ? (isAr ? 'تغيرت بعد الاختيار' : 'Changed after selection') : (isAr ? 'مطابقة لوقت الاختيار' : 'Matches selection time'))+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(isAr?'مراجعة ما قبل الربط':'Pre-Bind Review')+'</span><strong>'+esc(preBindReview ? (preBindReview.label || preBindReview.status || '—') : '—')+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(isAr?'وقت الربط':'Snapshot Time')+'</span><strong>'+esc(selectedAt)+'</strong></div>'+
      '<div class="tech-doc-cell"><span>'+(isAr?'مصدر البيانات':'Data Source')+'</span><strong>'+esc(record.sourceDocumentName || record.sourceReference || snap.source || '—')+'</strong></div>'+
    '</div>'+
    '<div class="tech-doc-reasoning" style="margin-top:10px">'+
      notes.slice(0, 6).map(function(note){ return '<div class="tech-doc-reason"><span>'+esc(note)+'</span></div>'; }).join('')+
    '</div>'+
  '</section>';
}

function renderTechReportDuctRecommendationsSection(){
  return renderTechReportDuctRecommendationsContent() + '<div class="report-duct-editor">'+renderReportDuctEditor()+'</div>';
}

function renderTechReportDuctRecommendationsContent(){
  var hasDuctedSystem = getSelectedReportScenarioSystems().some(function(system){ return isDucted(system.unitType); });
  if(!hasDuctedSystem) return '';
  var reportData = window._lastProfessionalReportData || refreshProfessionalReportDataCache({ language: getEffectiveReportLanguage() });
  var ductAndEsp = reportData && reportData.ductAndEsp ? reportData.ductAndEsp : null;
  var cache = window._lastDuctSizing;
  function reportDuctSizeLabel(section){
    if(!section || !section.widthMm || !section.heightMm) return '—';
    return Number(section.widthMm).toLocaleString() + '×' + Number(section.heightMm).toLocaleString() + ' mm';
  }
  if(ductAndEsp && ductAndEsp.ductSizingAvailable && (ductAndEsp.supplyDuct || ductAndEsp.returnDuct)){
    var reportRows = [];
    if(ductAndEsp.supplyDuct){
      reportRows.push({
        section: lang==='ar' ? 'الإمداد الرئيسي' : 'Main Supply',
        velocity: Number(ductAndEsp.supplyDuct.actualVelocityFpm || 0).toLocaleString() + ' fpm',
        size: reportDuctSizeLabel(ductAndEsp.supplyDuct),
        status: ductRecommendation(getDuctVelocityRating(ductAndEsp.supplyDuct.actualVelocityFpm || 0, 'supply', false), null, lang === 'ar')
      });
    }
    if(ductAndEsp.returnDuct){
      reportRows.push({
        section: lang==='ar' ? 'الراجع الرئيسي' : 'Main Return',
        velocity: Number(ductAndEsp.returnDuct.actualVelocityFpm || 0).toLocaleString() + ' fpm',
        size: reportDuctSizeLabel(ductAndEsp.returnDuct),
        status: ductRecommendation(null, getDuctVelocityRating(ductAndEsp.returnDuct.actualVelocityFpm || 0, 'return', false), lang === 'ar')
      });
    }
    return '<section class="tech-doc-section">'+
      '<div class="tech-doc-section-head">'+(lang==='ar' ? 'توصيات المجاري' : 'Duct Recommendations')+'</div>'+
      '<div class="tech-doc-table-wrap"><table class="tech-doc-table" data-report-source="professional-report-duct-esp"><thead><tr>'+
        '<th>'+(lang==='ar'?'مقطع الدكت':'Duct Section')+'</th>'+
        '<th>'+(lang==='ar'?'السرعة':'Velocity')+'</th>'+
        '<th>'+(lang==='ar'?'المقاس المقترح':'Recommended Size')+'</th>'+
        '<th>'+(lang==='ar'?'الحالة':'Status')+'</th>'+
      '</tr></thead><tbody>'+
      reportRows.map(function(row){
        return '<tr><td>'+esc(row.section)+'</td><td>'+esc(row.velocity)+'</td><td>'+esc(row.size)+'</td><td>'+esc(row.status)+'</td></tr>';
      }).join('')+
      '</tbody></table></div></section>';
  }
  if(!cache || (!cache.sup && !cache.ret)){
    return '<section class="tech-doc-section"><div class="tech-doc-section-head">'+(lang==='ar' ? 'توصيات المجاري' : 'Duct Recommendations')+'</div><div class="tech-doc-empty">'+(lang==='ar' ? 'لا توجد بيانات مجاري كافية بعد لإخراج توصيات.' : 'Not enough duct data yet to provide recommendations.')+'</div></section>';
  }
  var rows = [];
  if(cache.sup){
    rows.push({
      section: lang==='ar' ? 'الإمداد الرئيسي' : 'Main Supply',
      velocity: Number(cache.sup.actualFpm || 0).toLocaleString() + ' fpm',
      size: ductSizeLabel(cache.sup),
      status: ductRecommendation(getDuctVelocityRating(cache.sup.actualFpm || 0, 'supply', false), null, lang === 'ar')
    });
  }
  if(cache.ret){
    rows.push({
      section: lang==='ar' ? 'الراجع الرئيسي' : 'Main Return',
      velocity: Number(cache.ret.actualFpm || 0).toLocaleString() + ' fpm',
      size: ductSizeLabel(cache.ret),
      status: ductRecommendation(null, getDuctVelocityRating(cache.ret.actualFpm || 0, 'return', false), lang === 'ar')
    });
  }
  return '<section class="tech-doc-section">'+
    '<div class="tech-doc-section-head">'+(lang==='ar' ? 'توصيات المجاري' : 'Duct Recommendations')+'</div>'+
    '<div class="tech-doc-table-wrap"><table class="tech-doc-table"><thead><tr>'+
      '<th>'+(lang==='ar'?'مقطع الدكت':'Duct Section')+'</th>'+
      '<th>'+(lang==='ar'?'السرعة':'Velocity')+'</th>'+
      '<th>'+(lang==='ar'?'المقاس المقترح':'Recommended Size')+'</th>'+
      '<th>'+(lang==='ar'?'الحالة':'Status')+'</th>'+
    '</tr></thead><tbody>'+
    rows.map(function(row){
      return '<tr><td>'+esc(row.section)+'</td><td>'+esc(row.velocity)+'</td><td>'+esc(row.size)+'</td><td>'+esc(row.status)+'</td></tr>';
    }).join('')+
    '</tbody></table></div></section>';
}

function renderTechReportValidationTable(){
  var reportData = window._lastProfessionalReportData || refreshProfessionalReportDataCache({ language: getEffectiveReportLanguage() });
  var reportValidation = reportData && reportData.validation && Array.isArray(reportData.validation.items) ? reportData.validation : null;
  var validation = reportValidation || getProjectEngineeringValidation();
  var validationItems = Array.isArray(validation.items) ? validation.items : [];
  return '<section class="tech-doc-section">'+
    '<div class="tech-doc-section-head">'+(lang==='ar' ? 'جدول التحقق الهندسي' : 'Engineering Validation Table')+'</div>'+
    '<div class="tech-doc-table-wrap"><table class="tech-doc-table" data-report-source="'+(reportValidation ? 'professional-report-validation' : 'legacy-validation')+'"><thead><tr>'+
      '<th>'+(lang==='ar'?'الفحص':'Check')+'</th>'+
      '<th>'+(lang==='ar'?'النتيجة':'Result')+'</th>'+
      '<th>'+(lang==='ar'?'الحالة':'Status')+'</th>'+
      '<th>'+(lang==='ar'?'التوصية':'Recommendation')+'</th>'+
    '</tr></thead><tbody>'+
    validationItems.map(function(item){
      var actionText = item && item.action && item.action.text ? item.action.text : (lang==='ar' ? 'لا يلزم إجراء إضافي.' : 'No further action required.');
      var resultText = esc(item.message) + (item.values && item.values.length ? '<div class="tech-doc-inline-note">'+esc(summarizeValidationValues(item))+'</div>' : '');
      var tone = item.status === 'pass' ? 'pass' : (item.status === 'warning' ? 'review' : (item.status === 'fail' ? 'fail' : 'info'));
      return '<tr><td>'+esc(item.title)+'</td><td>'+resultText+'</td><td><span class="tech-status-pill is-'+tone+'">'+esc(item.badgeAr || item.badgeEn || '—')+'</span></td><td>'+esc(actionText)+'</td></tr>';
    }).join('')+
    '</tbody></table></div></section>';
}

function getEngineeringSourceStatusNotes(){
  var status = ENGINEERING_SOURCE_STATUS || {};
  var notes = [];
  var hasHealthcareRooms = hist.some(function(room){ return room && (room.calcMode === 'hc' || room.mode === 'hc' || room.sup || room.ach); });
  var hasGeneralRooms = hist.some(function(room){ return room && !(room.calcMode === 'hc' || room.mode === 'hc' || room.sup || room.ach); });
  if(hasHealthcareRooms && status.healthcareRoomValues && status.healthcareRoomValues.status === 'requires_source_confirmation'){
    notes.push(lang === 'ar'
      ? 'قيم الغرف الصحية ACH/OA/Pressure/Temperature/RH حالتها: تحتاج تأكيد مرجعي مقابل إصدار ASHRAE 170 المعتمد والاشتراط المحلي قبل اعتماد التصميم النهائي.'
      : 'Healthcare ACH/OA/Pressure/Temperature/RH values require source confirmation against the adopted ASHRAE 170 edition and local authority before final design approval.');
  }
  if(hasGeneralRooms && status.generalRoomLoadFactors && status.generalRoomLoadFactors.status === 'preliminary_app_baseline'){
    notes.push(lang === 'ar'
      ? 'عوامل الحمل العامة المستخدمة في الحساب السريع هي أساس تقديري أولي، ويجب توثيق أساس الحمل أو استبداله بحساب تفصيلي عند الاعتماد النهائي.'
      : 'General quick-load factors are preliminary app baselines; document the load basis or replace them with detailed load calculations for final approval.');
  }
  return notes;
}

function renderTechReportNotesRecommendationsSection(){
  var reportData = window._lastProfessionalReportData || refreshProfessionalReportDataCache({ language: getEffectiveReportLanguage() });
  var reportNotes = reportData && Array.isArray(reportData.engineeringNotes) ? reportData.engineeringNotes : [];
  var validation = getProjectEngineeringValidation();
  var notes = [];
  if(reportNotes.length){
    reportNotes.forEach(function(note){
      if(note && note.message) notes.push(note.message.replace(/<br\s*\/?>/gi, ' · '));
    });
  } else {
    (validation.items || []).forEach(function(item){
      if(item && item.action && item.action.text){
        notes.push(item.action.text.replace(/<br\s*\/?>/gi, ' · '));
      }
    });
    notes = notes.concat(getDesktopSmartInsightItems());
    notes = notes.concat(getEngineeringSourceStatusNotes());
  }
  notes.push(lang === 'ar' ? 'هذا التقرير مخصص للمراجعة والتحليل الهندسي الأولي، وليس بديلاً عن التصميم التنفيذي المفصل.' : 'This report is intended for preliminary engineering review and is not a substitute for detailed final design.');
  notes.push(lang === 'ar' ? 'قد تتطلب مراجعة الكود السعودي ومتطلبات الموقع تحديث المقاسات أو التهوية النهائية.' : 'Saudi code requirements and site conditions may require further review of final sizing and ventilation.');
  if(!notes.length){
    notes.push(lang === 'ar' ? 'لا توجد توصيات هندسية إضافية حتى الآن.' : 'No additional engineering recommendations yet.');
  }
  var uniqueNotes = notes.filter(function(note, idx, arr){ return note && arr.indexOf(note) === idx; }).slice(0, 8);
  return '<section class="tech-doc-section">'+
    '<div class="tech-doc-section-head">'+(lang==='ar' ? 'ملاحظات وتوصيات هندسية' : 'Engineering Notes & Recommendations')+'</div>'+
    '<div class="tech-doc-reasoning" data-report-source="'+(reportNotes.length ? 'professional-report-engineering-notes' : 'legacy-engineering-notes')+'">'+
      uniqueNotes.map(function(note){
        return '<div class="tech-doc-reason"><span>'+esc(note)+'</span></div>';
      }).join('')+
    '</div></section>';
}

function renderTechReportAshraeReferencesSection(){
  var refs = lang === 'ar'
    ? ['ASHRAE 62.1 — متطلبات التهوية الأساسية للمباني العامة.', 'ASHRAE 170 — مرجع الغرف الصحية والضغط والعلاقات الهوائية.', 'نتائج AirCalc Pro تقديرية ومسترشدة بالمراجع الهندسية ولا تغني عن التصميم التفصيلي.']
    : ['ASHRAE 62.1 — baseline ventilation requirements for commercial buildings.', 'ASHRAE 170 — healthcare room airflow and pressure guidance.', 'AirCalc Pro results are preliminary and guided by engineering references, not a substitute for detailed design.'];
  refs = refs.concat(getEngineeringSourceStatusNotes());
  return '<section class="tech-doc-section">'+
    '<div class="tech-doc-section-head">'+(lang==='ar' ? 'مراجع ASHRAE' : 'ASHRAE References')+'</div>'+
    '<div class="tech-doc-reasoning">'+
      refs.map(function(text){
        return '<div class="tech-doc-reason"><span>'+esc(text)+'</span></div>';
      }).join('')+
    '</div></section>';
}

function getProjectSummarySectionsHtml(isAr){
  var totalBtu = getProjTotalBtu();
  var totalCfm = getProjTotalCfm();
  var totalTr  = getProjTotalTr();
  var selectedSummary = getActiveSelectedEquipmentSummary();
  var selectedProjectBtu = selectedSummary.btu;
  var selectedProjectTr = selectedSummary.tr;
  var selectedProjectCfm = selectedSummary.cfm;
  var projectStatus = getProjectCapacityStatus(totalBtu, selectedProjectBtu);
  var diffText = (projectStatus.difference >= 0 ? '+' : '') + Number(projectStatus.difference || 0).toLocaleString() + ' BTU';
  var pctText = projectStatus.percentText || '0.0%';
  var statusClass = projectStatus.key === 'matched' ? 'is-matched' : (projectStatus.key === 'undersized' ? 'is-under' : (projectStatus.key === 'oversized' ? 'is-over' : 'is-pending'));
  return ''+
    '<div class="proj-summary-card proj-summary-card-required">'+
      '<div class="proj-summary-head">'+(isAr ? 'الحمل المطلوب للمشروع' : 'Project Required Load')+'</div>'+
      '<div class="proj-summary-metric"><span class="proj-summary-label">BTU/h</span><strong>'+Math.round(totalBtu).toLocaleString()+'</strong></div>'+
      '<div class="proj-summary-subgrid">'+
        '<div class="proj-summary-stat"><span>TR</span><strong>'+totalTr.toFixed(2)+'</strong></div>'+
        '<div class="proj-summary-stat"><span>CFM</span><strong>'+Math.round(totalCfm).toLocaleString()+'</strong></div>'+
      '</div>'+
    '</div>'+
    '<div class="proj-summary-card proj-summary-card-selected">'+
      '<div class="proj-summary-head">'+(isAr ? 'السعة المختارة للوحدات' : 'Selected Equipment Capacity')+'</div>'+
      '<div class="proj-summary-metric"><span class="proj-summary-label">BTU</span><strong>'+Math.round(selectedProjectBtu).toLocaleString()+'</strong></div>'+
      '<div class="proj-summary-subgrid">'+
        '<div class="proj-summary-stat"><span>TR</span><strong>'+selectedProjectTr.toFixed(2)+'</strong></div>'+
        '<div class="proj-summary-stat"><span>CFM</span><strong>'+Math.round(selectedProjectCfm).toLocaleString()+'</strong></div>'+
        '<div class="proj-summary-stat proj-summary-stat-full"><span>'+(isAr ? 'عدد الوحدات المختارة' : 'Selected Unit Count')+'</span><strong>'+selectedSummary.unitCount+'</strong></div>'+
      '</div>'+
    '</div>'+
    '<div class="proj-summary-card proj-status-card '+statusClass+'">'+
      '<div class="proj-summary-head">'+(isAr ? 'حالة المطابقة' : 'Capacity Match Status')+'</div>'+
      '<div class="proj-status-message">'+projectStatus.label+'</div>'+
      '<div class="proj-summary-subgrid">'+
        '<div class="proj-summary-stat"><span>'+(isAr ? 'الفرق BTU' : 'BTU Difference')+'</span><strong>'+diffText+'</strong></div>'+
        '<div class="proj-summary-stat"><span>'+(isAr ? 'الفرق %' : 'Difference %')+'</span><strong>'+pctText+'</strong></div>'+
        '<div class="proj-summary-stat proj-summary-stat-full"><span>'+(isAr ? 'الحالة' : 'Status')+'</span><strong>'+projectStatus.label+'</strong></div>'+
      '</div>'+
    '</div>';
}

function renderHomeProjectSummary(){
  var card = G('home-project-summary-card');
  var host = G('home-project-summary-sections');
  if(!card || !host) return;
  card.style.display = 'none';
  host.innerHTML = '';
}

function getSelectedRoomPreviewMeta(room){
  if(!room) return null;
  var isHealthcare = room.mode === 'hc';
  var pressure = room.pres === 'positive'
    ? (lang === 'ar' ? 'ضغط موجب' : 'Positive Pressure')
    : room.pres === 'negative'
      ? (lang === 'ar' ? 'ضغط سالب' : 'Negative Pressure')
      : (lang === 'ar' ? 'ضغط محايد' : 'Neutral Pressure');
  var subtitle = isHealthcare
    ? room.oach + ' OA · ' + room.tach + ' ACH · ' + pressure
    : (lang === 'ar' ? 'تقدير سريع بمعامل مدينة' : 'Quick city factor estimate');
  return {
    title: rLabel(room),
    badge: isHealthcare ? 'ASHRAE' : (lang === 'ar' ? 'معامل مدينة' : 'City Factor'),
    subtitle: subtitle,
    cards: isHealthcare ? [
      { label: 'ACH', value: Number(room.tach || 0).toLocaleString() },
      { label: 'OA', value: Number(room.oach || 0).toLocaleString() },
      { label: lang === 'ar' ? 'الضغط' : 'Pressure', value: pressure },
      { label: lang === 'ar' ? 'العادم' : 'Exhaust', value: Number(room.exh || 0).toLocaleString() }
    ] : [
      { label: lang === 'ar' ? 'الفئة' : 'Category', value: getCategoryLabel(room.category || 'general') },
      { label: lang === 'ar' ? 'المرجع' : 'Reference', value: 'BTU/m³' },
      { label: lang === 'ar' ? 'نوع التقدير' : 'Estimate Type', value: lang === 'ar' ? 'سريع' : 'Quick' },
      { label: lang === 'ar' ? 'سير العمل' : 'Workflow', value: lang === 'ar' ? 'غرفة' : 'Room' }
    ]
  };
}

function renderSelectedRoomPreview(){
  var host = G('selected-room-preview');
  if(!host) return;
  var meta = getSelectedRoomPreviewMeta(curRoom);
  if(!meta){
    host.innerHTML = '';
    host.style.display = 'none';
    return;
  }
  host.style.display = '';
  host.innerHTML =
    '<div class="selected-room-card">'+
      '<div class="selected-room-head">'+
        '<div class="selected-room-copy">'+
          '<div class="selected-room-kicker">'+(lang === 'ar' ? 'الغرفة المختارة' : 'Selected Room')+'</div>'+
          '<div class="selected-room-title">'+esc(meta.title)+'</div>'+
          '<div class="selected-room-subtitle">'+esc(meta.subtitle)+'</div>'+
        '</div>'+
        '<span class="selected-room-badge">'+esc(meta.badge)+'</span>'+
      '</div>'+
      '<div class="selected-room-grid">'+
        meta.cards.map(function(card){
          return '<div class="selected-room-stat">'+
            '<span>'+esc(card.label)+'</span>'+
            '<strong>'+esc(card.value)+'</strong>'+
          '</div>';
        }).join('')+
      '</div>'+
    '</div>';
}

function renderTechReportProjectTotalsSection(){
  return ''+
    '<section class="tech-doc-section">'+
      '<div class="tech-doc-section-head">'+(lang==='ar' ? 'إجماليات المشروع' : 'Project Totals')+'</div>'+
      '<div class="proj-summary-sections tech-project-summary-sections">'+getProjectSummarySectionsHtml(lang==='ar')+'</div>'+
    '</section>';
}

function renderCalculationLevelBanner(){
  var meta = getCalculationLevelMeta(lang === 'ar');
  return ''+
    '<div class="calc-level-banner tech-section-card">'+
      '<div class="calc-level-badge">'+meta.badge+'</div>'+
      '<div class="calc-level-note">'+meta.disclaimer+'</div>'+
    '</div>';
}
function scrollTechnicalReportSection(id){
  if(typeof selectTechnicalReportTopic === 'function') selectTechnicalReportTopic(id);
  var report = G('tech-analysis-slot');
  var section = G(id);
  if(!report || !section || !report.contains(section)) return;
  section.setAttribute('tabindex', '-1');
  section.focus({preventScroll:true});
  section.scrollIntoView({behavior:'auto', block:'start'});
}

function getQuotationPricingProgress(){
  var lines=ensureProjectSystems().reduce(function(all,system){return all.concat(system.quotationDraft && Array.isArray(system.quotationDraft.lines)?system.quotationDraft.lines:[]);},[]).filter(function(line){return Number(line.quantity)>0;});
  var priced=lines.filter(function(line){return Number(line.unitPrice)>0;}).length;
  return lines.length ? (lang==='ar'?'البنود المسعّرة: ':'Priced items: ')+priced+' / '+lines.length : (lang==='ar'?'لم يبدأ التسعير':'Pricing not started');
}

function refreshQuotationPricingProgress(){
  var context=G('quote-project-context');
  var progress=context && context.querySelector('[data-pricing-progress]');
  if(progress) progress.textContent=getQuotationPricingProgress();
}

function renderProjectContextSummary(options){
  options=options || {};
  var required=getProjectRequiredLoadBtu(),selected=getSelectedProjectEquipmentBtu();
  var meta=getReportProjectMeta(),saved=getCurrentSavedProjectForReport();
  var status=getProjectCapacityStatus(required,selected);
  var systems=getSelectedReportScenarioSystems();
  var types=Array.from(new Set(systems.map(function(system){return utLabel(system.unitType);}))).join(' / ');
  var schedule=systems.map(function(system){return Math.max(1,parseInt(system.qty,10)||1)+' × '+Number(getSelectedUnitCapacityBtu(system)||0).toLocaleString('en-US')+' BTU/h';}).join(' · ');
  var area=hist.reduce(function(sum,room){return sum+(getWorkflowRoomArea(room) || Math.max(0,Number(room.area)||0)*Math.max(1,parseInt(room.roomCount,10)||1));},0);
  var lastSaved=saved && saved.updatedAt ? new Date(saved.updatedAt) : null;
  var savedText=lastSaved && Number.isFinite(lastSaved.getTime())?lastSaved.toLocaleString('en-GB',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):(lang==='ar'?'لم يُحفظ بعد':'Not saved yet');
  var difference=required>0 && selected>0 ? ((selected-required)/required*100) : null;
  var differenceText=difference==null?'—':(difference>=0?'+':'')+difference.toFixed(1)+'%';
  var groups=[];
  hist.forEach(function(room,index){
    var name=(lang==='ar'?(room.name || room.ar || room.en):(room.name || room.en || room.ar)) || (lang==='ar'?'غرفة ':'Room ')+(index+1);
    var quantity=Math.max(1,parseInt(room.roomCount,10)||1);
    var existing=groups.find(function(group){return group.name===name;});
    if(existing) existing.quantity+=quantity;
    else groups.push({name:name,quantity:quantity});
  });
  var rooms=groups.map(function(group){return '<li><span>'+esc(group.name)+'</span><b dir="ltr">× '+group.quantity+'</b></li>';}).join('');
  var count=hist.reduce(function(total,room){return total+Math.max(1,parseInt(room.roomCount,10)||1);},0);
  var unitCount=systems.reduce(function(total,system){return total+Math.max(1,parseInt(system.qty,10)||1);},0);
  var roomInfo=(lang==='ar'?'المساحة الإجمالية: ':'Total area: ')+Number(area).toLocaleString('en-US')+' m²';
  var loadInfo=count>0?(lang==='ar'?'متوسط الحمل للغرفة: ':'Average load per room: ')+Math.round(required/count).toLocaleString('en-US')+' BTU/h':(lang==='ar'?'أضف غرفًا لحساب الحمل':'Add rooms to calculate the load');
  var selectedInfo=(lang==='ar'?'عدد الوحدات: ':'Units: ')+unitCount+' · '+(lang==='ar'?'تغطية الحمل: ':'Load coverage: ')+(required>0?(selected/required*100).toFixed(1)+'%':'—');
  return '<section class="project-context-summary" aria-label="'+(lang==='ar'?'ملخص المشروع':'Project summary')+'"><div class="project-context-heading"><div><span>'+(lang==='ar'?'ملخص المشروع':'Project summary')+'</span><h2>'+esc(meta.projectName && meta.projectName!=='—'?meta.projectName:(lang==='ar'?'مشروع غير مسمى':'Untitled project'))+'</h2></div><bdi>'+esc(meta.projectNo || '—')+'</bdi></div><div class="project-context-metrics">'+
    '<div class="project-counter project-counter-rooms"><span>'+(lang==='ar'?'عدد الغرف':'Rooms')+'</span><strong>'+count+'</strong><small>'+(lang==='ar'?'إجمالي غرف المشروع':'Total project rooms')+'</small><p class="project-counter-note">'+esc(roomInfo)+'</p></div>'+
    '<div class="project-counter project-counter-required"><span>'+(lang==='ar'?'الحمل المطلوب':'Required cooling load')+'</span><strong><bdi>'+Number(required||0).toLocaleString('en-US')+'</bdi><small>BTU/h</small></strong><small dir="ltr">'+(required/12000).toFixed(2)+' TR</small><p class="project-counter-note">'+esc(loadInfo)+'</p></div>'+
    '<div class="project-counter project-counter-selected"><span>'+(lang==='ar'?'السعة المختارة':'Selected cooling capacity')+'</span><strong><bdi>'+Number(selected||0).toLocaleString('en-US')+'</bdi><small>BTU/h</small></strong><small dir="ltr">'+(selected/12000).toFixed(2)+' TR</small><p class="project-counter-note">'+esc(selectedInfo)+'</p></div></div>'+
    '<div class="project-context-status"><strong>'+esc(status.label)+'</strong><span>'+(lang==='ar'?'فرق السعة عن الحمل: ':'Capacity difference: ')+'<bdi>'+differenceText+'</bdi></span></div>'+
    '<dl class="project-context-facts"><div><dt>'+(lang==='ar'?'النظام والتوزيع':'System and distribution')+'</dt><dd>'+esc(types || '—')+' · '+(isProjectHvacMode()?(lang==='ar'?'وحدات للمشروع':'Project units'):(lang==='ar'?'وحدات للغرف':'Room units'))+'</dd></div><div><dt>'+(lang==='ar'?'عدد الوحدات × سعة الوحدة':'Quantity × unit capacity')+'</dt><dd><bdi>'+esc(schedule || '—')+'</bdi></dd></div><div><dt>'+(lang==='ar'?'الموقع / المساحة':'Location / area')+'</dt><dd>'+esc(meta.city || meta.location || '—')+' · <bdi>'+Number(area).toLocaleString('en-US')+' m²</bdi></dd></div><div><dt>'+(lang==='ar'?'مستوى الحساب / آخر حفظ':'Calculation level / last saved')+'</dt><dd>'+esc(getCalculationLevelMeta(lang==='ar').badge)+' · <bdi>'+esc(savedText)+'</bdi></dd></div></dl>'+
    (options.quotation?'<div class="project-context-pricing" data-pricing-progress>'+esc(getQuotationPricingProgress())+'</div>':'')+
    '<div class="project-context-rooms"><strong>'+(lang==='ar'?'توزيع الغرف':'Room breakdown')+'</strong><ul>'+ (rooms || '<li>'+(lang==='ar'?'لم تتم إضافة غرف':'No rooms added')+'</li>')+'</ul></div></section>';
}

function selectTechnicalReportTopic(id){
  var ids=['report-decision','report-loads','report-equipment','report-air','report-evidence'];
  if(ids.indexOf(id)<0) return;
  window._technicalReportTopic=id;
  ids.forEach(function(topic){var panel=G(topic);if(panel) panel.hidden=topic!==id;});
  var health=G('report-assistant-tool'),duct=G('report-duct-tool');
  if(health) health.hidden=id!=='report-decision';
  if(duct) duct.hidden=id!=='report-air';
  var nav=G('report-topic-nav');
  if(nav) Array.from(nav.querySelectorAll('button')).forEach(function(button){
    var active=button.getAttribute('aria-controls')===id;
    button.setAttribute('aria-selected',String(active));
    button.classList.toggle('is-active',active);
  });
}

function expandTechnicalReportPanels(){
  var report=G('p-tech');
  if(!report) return;
  Array.from(report.querySelectorAll('details')).forEach(function(details){
    var panel=document.createElement('section');
    Array.from(details.attributes).forEach(function(attribute){
      if(attribute.name!=='open') panel.setAttribute(attribute.name,attribute.value);
    });
    panel.classList.add('report-static-panel');
    while(details.firstChild){
      var child=details.firstChild;
      if(child.nodeName==='SUMMARY'){
        var heading=document.createElement('h3');
        heading.className='report-panel-heading';
        while(child.firstChild) heading.appendChild(child.firstChild);
        panel.appendChild(heading);
        child.remove();
      }else panel.appendChild(child);
    }
    details.replaceWith(panel);
  });
}

function renderTechReportFoundation(){
  var slot = G('tech-analysis-slot');
  if(!slot) return;
  var reportData = refreshProfessionalReportDataCache({ language: getEffectiveReportLanguage() });
  var reportModel = buildTechnicalReportModel();
  window._lastTechnicalReportModel = reportModel;
  if(reportData && slot.dataset){
    slot.dataset.reportSchemaVersion = reportData.schemaVersion || '';
    slot.dataset.reportSourceOfTruth = reportData.sourceOfTruth || '';
    slot.dataset.reportGeneratedAt = reportData.generatedAt || '';
    slot.dataset.technicalReportModel = reportModel.sourceOfTruth || '';
  }
  function section(id, number, ar, en, content){
    return '<section class="report-dashboard-section" id="'+id+'"><h2><span>'+number+'</span>'+esc(lang==='ar'?ar:en)+'</h2>'+content+'</section>';
  }
  function detail(ar, en, content){
    return '<section class="report-detail-panel report-static-panel'+(content.indexOf('<table')>=0?' report-table-panel':'')+'"><h3 class="report-panel-heading">'+esc(lang==='ar'?ar:en)+'</h3>'+content+'</section>';
  }
  slot.innerHTML =
    '<div class="report-dashboard">'+
    '<nav class="report-dashboard-nav" id="report-topic-nav" role="tablist" aria-label="'+(lang==='ar'?'أقسام التقرير':'Report sections')+'">'+
      [['report-decision','نظرة عامة','Overview'],['report-loads','الأحمال','Loads'],['report-equipment','المعدات','Equipment'],['report-air','الهواء والدكت','Airflow and ducts'],['report-evidence','المراجع','References']].map(function(item){
        return '<button type="button" role="tab" aria-controls="'+item[0]+'" onclick="selectTechnicalReportTopic(\''+item[0]+'\')">'+esc(lang==='ar'?item[1]:item[2])+'</button>';
      }).join('')+'</nav>'+
    section('report-decision','01','القرار الهندسي','Engineering decision','')+
    section('report-loads','02','الأحمال والسعة المختارة','Loads and selected capacity',renderTechReportDashboardSummarySection()+
      detail('أساس الحساب والافتراضات','Calculation basis and assumptions',renderCalculationLevelBanner()+renderTechReportEngineeringSummary())+
      detail('تفاصيل الغرف','Room schedule',renderTechReportRoomLoadTable()))+
    section('report-equipment','03','الوحدات المعتمدة','Approved equipment',
      detail('السيناريو وتوزيع الوحدات','Scenario and unit schedule',renderTechReportSelectedScenarioSection()+renderTechReportEquipmentTable())+
      detail('بيانات الكتالوج المحفوظة','Saved catalogue evidence',renderTechReportSelectedEquipmentSnapshotSection()))+
    section('report-air','04','الهواء ومجاري التوزيع','Airflow and ductwork',renderTechReportAirflowReviewSection()+
      detail('الأبعاد المقترحة لمجاري الهواء','Proposed duct dimensions',renderTechReportDuctRecommendationsSection())+renderReportFilterEditor()+renderHepaFilterReference())+
    section('report-evidence','05','المراجعة التفصيلية والمراجع','Detailed review and references',
      detail('نتائج قواعد التحقق','Validation findings',renderTechReportValidationTable())+
      detail('الملاحظات والمراجع الهندسية','Engineering notes and references',renderTechReportNotesRecommendationsSection()+renderTechReportAshraeReferencesSection()))+
    '</div>';
  var copilot = G('hvac-design-copilot-panel');
  var duct = G('tech-duct-slot');
  function moveTool(node, id, ar, en){
    if(!node) return;
    var wrapper = G(id);
    if(!wrapper){
      wrapper = document.createElement('section');
      wrapper.id = id;
      wrapper.className = id === 'report-assistant-tool' ? 'report-dashboard-health report-dashboard-tool' : 'report-duct-panel report-dashboard-tool';
      wrapper.appendChild(document.createElement('h2'));
    }
    wrapper.firstElementChild.textContent = lang==='ar'?ar:en;
    wrapper.appendChild(node);
    if(id === 'report-assistant-tool'){
      if(!wrapper.dataset.reportLayoutInitialized){
        wrapper.open = true;
        wrapper.dataset.reportLayoutInitialized = '1';
      }
      slot.parentNode.insertBefore(wrapper, slot);
    } else slot.parentNode.insertBefore(wrapper, slot.nextSibling);
  }
  moveTool(copilot,'report-assistant-tool','لوحة المتابعة','Monitoring dashboard');
  var healthWrapper=G('report-assistant-tool');
  if(healthWrapper){
    var followup=G('health-followup');
    if(!followup){followup=document.createElement('div');followup.id='health-followup';followup.className='health-followup-grid';}
    var airflowControls=G('health-airflow-controls');
    if(!airflowControls){airflowControls=document.createElement('section');airflowControls.id='health-airflow-controls';airflowControls.className='tech-doc-section';}
    airflowControls.innerHTML=renderInlineAirflowControls();
    followup.replaceChildren(airflowControls);
    var ar=lang==='ar';
    function monitoringPanel(title,body,route){
      var section=document.createElement('section');section.className='tech-doc-section';
      section.innerHTML='<h3>'+esc(title)+'</h3>'+body+(route?'<button type="button" onclick="openDesktopView(\''+route+'\')">'+(ar?'فتح الحقول المرتبطة':'Open related fields')+'</button>':'');
      followup.appendChild(section);
    }
    monitoringPanel(ar?'القرار الهندسي':'Engineering decision',renderTechReportCriticalAlertsSection(true));
    followup.children[1].id='health-decision-controls';
    healthWrapper.appendChild(followup);
  }
  moveTool(duct,'report-duct-tool','حساب مجاري الهواء والضغط الساكن','Duct and static pressure calculations');
  var topicNav=slot.querySelector('#report-topic-nav');
  var oldTopicNav=slot.parentNode.querySelector(':scope > #report-topic-nav');
  if(oldTopicNav) oldTopicNav.remove();
  if(topicNav) slot.parentNode.insertBefore(topicNav,G('report-assistant-tool') || slot);
  var context=G('report-project-context');
  if(!context){context=document.createElement('div');context.id='report-project-context';}
  context.innerHTML=renderProjectContextSummary();
  slot.parentNode.insertBefore(context,topicNav || slot);
  selectTechnicalReportTopic(window._technicalReportTopic || 'report-decision');
  expandTechnicalReportPanels();
  enforceTechnicalReportEnglishDigits();
}
function renderRoomValidationSection(i, roomState){
  var validation = getRoomEngineeringValidation(i, roomState);
  return renderEngineeringValidationPanel(lang==='ar' ? 'التحقق الهندسي' : 'Engineering Validation', validation.items, validation.notes);
}
function getRoomSystemState(i){
  var line = ensureQuoteLine(i);
  var room = hist[i] || {};
  var requiredBtu = getRoomRequiredBtu(i);
  var requiredCfm = getRoomRequiredCfm(i);
  var assignment = getRoomAssignment(i);
  if(quoteMode !== 'proj' && assignment.mode !== 'independent'){
    line.assignment = normalizeRoomAssignment({ mode:'independent', zoneId:'', projectSystemId:'' });
    assignment = line.assignment;
  }
  if(assignment.mode === 'project'){
    return {
      systems: [],
      requiredBtu: requiredBtu,
      requiredCfm: requiredCfm,
      selectedCapacityBtu: 0,
      selectedSystemCfm: 0,
      capacityDifference: 0,
      airflowDifference: 0,
      capacityStatus: 'project_connected',
      capacityStatusMeta: {
        key:'project_connected',
        delta:0,
        deltaText:'—',
        label:lang==='ar' ? 'مرتبطة بوحدة المشروع' : 'Connected to project unit',
        css:'pending'
      },
      airflowStatus: '',
      airflowStatusMeta: null,
      isHealthcare: isHealthcareRoom(room),
      pressureRequirement: room.pres || room.pressure || '',
      assignment: assignment
    };
  }
  if(assignment.mode === 'zone' && assignment.zoneId){
    var zone = getZoneById(assignment.zoneId);
    return {
      systems: zone ? zone.systems.map(normalizeQuoteSystem) : [],
      requiredBtu: requiredBtu,
      requiredCfm: requiredCfm,
      selectedCapacityBtu: 0,
      selectedSystemCfm: 0,
      capacityDifference: 0,
      airflowDifference: 0,
      capacityStatus: zone ? 'zone_connected' : 'zone_missing',
      capacityStatusMeta: {
        key: zone ? 'zone_connected' : 'zone_missing',
        delta:0,
        deltaText:'—',
        label: zone
          ? (lang==='ar' ? 'مرتبطة بمنطقة HVAC' : 'Connected to HVAC zone')
          : (lang==='ar' ? 'منطقة غير موجودة' : 'Zone not found'),
        css: zone ? 'pending' : 'deficit-mild'
      },
      airflowStatus: '',
      airflowStatusMeta: null,
      isHealthcare: isHealthcareRoom(room),
      pressureRequirement: room.pres || room.pressure || '',
      assignment: assignment,
      zoneId: assignment.zoneId
    };
  }
  var systems = ensureRoomSystems(i).map(normalizeQuoteSystem);
  line.systems = systems;
  var selectedCapacityBtu = (line.systems || []).reduce(function(sum, system){
    return sum + getSelectedInstalledCapacity(system);
  }, 0);
  var selectedSystemCfm = (line.systems || []).reduce(function(sum, system){
    return sum + (getUnitAirflowCfm(system) * Math.max(1, parseInt(system.qty, 10) || 1));
  }, 0);
  var capacityDifference = selectedCapacityBtu - requiredBtu;
  var airflowDifference = selectedSystemCfm - requiredCfm;
  var status = getCapacityStatus(requiredBtu, selectedCapacityBtu);
  var isHealthcare = isHealthcareRoom(room);
  var airflowStatus = isHealthcare ? getAirflowStatus(requiredCfm, selectedSystemCfm) : null;
  return {
    systems: systems,
    requiredBtu: requiredBtu,
    requiredCfm: requiredCfm,
    selectedCapacityBtu: selectedCapacityBtu,
    selectedSystemCfm: selectedSystemCfm,
    capacityDifference: capacityDifference,
    airflowDifference: airflowDifference,
    capacityStatus: status.key,
    capacityStatusMeta: status,
    airflowStatus: airflowStatus ? airflowStatus.key : '',
    airflowStatusMeta: airflowStatus,
    isHealthcare: isHealthcare,
    pressureRequirement: room.pres || room.pressure || '',
    assignment: assignment
  };
}
function syncRoomSystemState(i){
  if(i < 0 || i >= hist.length) return null;
  var line = ensureQuoteLine(i);
  var state = getRoomSystemState(i);
  line.systems = state.systems.map(normalizeQuoteSystem);
  line.selectedCapacityBtu = state.selectedCapacityBtu;
  line.capacityDifference = state.capacityDifference;
  line.capacityStatus = state.capacityStatus;
  line.requiredCfm = state.requiredCfm;
  line.selectedSystemCfm = state.selectedSystemCfm;
  line.airflowDifference = state.airflowDifference;
  line.airflowStatus = state.airflowStatus;
  hist[i].requiredBtu = state.requiredBtu;
  hist[i].finalBtu = state.requiredBtu;
  hist[i].systems = state.systems.map(normalizeQuoteSystem);
  hist[i].selectedCapacityBtu = state.selectedCapacityBtu;
  hist[i].capacityDifference = state.capacityDifference;
  hist[i].capacityStatus = state.capacityStatus;
  hist[i].capacityDeltaPct = state.capacityStatusMeta.delta;
  hist[i].requiredCfm = state.requiredCfm;
  hist[i].selectedSystemCfm = state.selectedSystemCfm;
  hist[i].airflowDifference = state.airflowDifference;
  hist[i].airflowStatus = state.airflowStatus;
  return state;
}
function syncAllRoomSystemStates(){
  for(var i=0;i<hist.length;i++) syncRoomSystemState(i);
}
function recalcProjectTotals(){
  syncAllRoomSystemStates();
  if(isProjectHvacMode() && getProjectQtyAuto()){
    syncProjectRecommendation({keepSelectedCapacity:true});
  }
  if(typeof renderProjBlock === 'function' && isProjectHvacMode()) renderProjBlock();
  if(typeof updateDirectResults === 'function') updateDirectResults();
  if(typeof refreshGrandTotal === 'function') refreshGrandTotal();
}
function recalcRoomSystems(i){
  var state = syncRoomSystemState(i);
  recalcProjectTotals();
  persistQuoteState();
  rerenderAfterProjectUnitChange();
  return state;
}
function addRoomSystem(i){
  ensureRoomSystems(i).push(normalizeQuoteSystem({
    unitType:'split',
    selectedBtu:getDefaultSystemCapacity('split'),
    qty:1
  }));
  return recalcRoomSystems(i);
}
function updateRoomSystem(i, systemId, field, value){
  var line = ensureQuoteLine(i);
  var systems = ensureRoomSystems(i);
  var system = null;
  for(var si=0;si<systems.length;si++){
    if(systems[si] && systems[si].id === systemId){
      system = systems[si];
      break;
    }
  }
  if(!system) return null;
  if(field === 'unitType'){
    system.unitType = getAllowedSystemType(value);
    system.selectedBtu = getDefaultSystemCapacity(system.unitType);
  } else if(field === 'selectedBtu'){
    system.selectedBtu = toSystemBtu(value) || getDefaultSystemCapacity(system.unitType);
  } else if(field === 'qty'){
    system.qty = Math.max(1, parseInt(value, 10) || 1);
  }
  line.systems = systems.map(normalizeQuoteSystem);
  return recalcRoomSystems(i);
}
function incrementSystemQty(i, systemId){
  var line = ensureQuoteLine(i);
  ensureRoomSystems(i);
  var idx = getQuoteSystemIndex(i, systemId);
  if(idx < 0) return null;
  var currentQty = Math.max(1, parseInt((line.systems[idx] && line.systems[idx].qty), 10) || 1);
  return updateRoomSystem(i, systemId, 'qty', currentQty + 1);
}
function decrementSystemQty(i, systemId){
  var line = ensureQuoteLine(i);
  ensureRoomSystems(i);
  var idx = getQuoteSystemIndex(i, systemId);
  if(idx < 0) return null;
  var currentQty = Math.max(1, parseInt((line.systems[idx] && line.systems[idx].qty), 10) || 1);
  return updateRoomSystem(i, systemId, 'qty', Math.max(1, currentQty - 1));
}
function removeRoomSystem(i, systemId){
  var line = ensureQuoteLine(i);
  if(!line || !Array.isArray(line.systems)) return null;
  ensureRoomSystems(i);
  if(!systemId) return null;
  line.systems = line.systems.filter(function(system){
    return system && system.id !== systemId;
  });
  if(line.systemPrices && line.systemPrices[systemId]){
    delete line.systemPrices[systemId];
  }
  if(line.systemPricing && line.systemPricing[systemId]){
    delete line.systemPricing[systemId];
  }
  recalcRoomSystems(i);
  return line.systems;
}
function setRoomSystemUnitPrice(i, systemId, value){
  if(getQuoteSystemIndex(i, systemId) < 0) return;
  getRoomSystemPricingMap(i)[systemId] = { unitPrice: Math.max(0, parseFloat(value) || 0) };
  save();
  renderQuote();
}
function buildRoomSystemsSummaryText(i){
  var systems = getQuoteSystems(i);
  if(!systems.length) return '';
  return systems.map(function(system){
    return utLabel(system.unitType) + ' × ' + Math.max(1, parseInt(system.qty, 10) || 1);
  }).join(' + ');
}
function renderQuoteSystemsPricing(i){
  var systems = getQuoteSystems(i);
  if(!systems.length) return '';
  var cur = t('cur');
  var rows = systems.map(function(system){
    var qty = Math.max(1, parseInt(system.qty, 10) || 1);
    var unitPrice = getRoomSystemUnitPrice(i, system.id);
    var lineTotal = getQuoteSystemLineTotal(i, system);
    return ''+
      '<div class="mixed-system-row quote-system-row">'+
        '<div class="mixed-system-grid">'+
          '<div class="proj-input-group"><div class="qi-plbl">'+t('mixedtype')+'</div><div class="ninput" style="display:flex;align-items:center">'+utLabel(system.unitType)+'</div></div>'+
          '<div class="proj-input-group"><div class="qi-plbl">'+t('mixedcapacity')+'</div><div class="ninput" style="display:flex;align-items:center">'+Number(system.selectedBtu||0).toLocaleString()+' BTU</div></div>'+
          '<div class="proj-input-group"><div class="qi-plbl">'+t('mixedqty')+'</div><div class="ninput" style="display:flex;align-items:center">'+qty+'</div></div>'+
          '<div class="proj-input-group"><div class="qi-plbl">'+t('mixedunitprice')+'</div><input class="minp" type="number" min="0" step="0.01" value="'+(unitPrice||'')+'" placeholder="0.00" onchange="setRoomSystemUnitPrice('+i+',\''+system.id+'\',this.value)"></div>'+
        '</div>'+
        '<div class="mixed-system-foot">'+
          '<div class="mixed-system-total"><span class="mixed-system-total-label">'+t('mixedlinetotal')+'</span><span>'+cur+' '+money(lineTotal)+'</span></div>'+
        '</div>'+
      '</div>';
  }).join('');
  return ''+
    '<div class="mixed-systems-card room-mixed-systems quote-mixed-systems">'+
      '<div class="mixed-systems-list">'+rows+'</div>'+
    '</div>';
}
function renderRoomSystemsEditor(i, requiredBtu){
  var roomState = syncRoomSystemState(i) || getRoomSystemState(i);
  var systems = roomState.systems;
  var rowsHtml = systems.map(function(system){
    var typeOpts = MIXED_SYSTEM_TYPES.map(function(key){
      return '<option value="'+key+'"'+(system.unitType===key?' selected':'')+'>'+utLabel(key)+'</option>';
    }).join('');
    var capOpts = getCatalog(system.unitType).map(function(item){
      var lbl = lang === 'ar' ? item.label.ar : item.label.en;
      return '<option value="'+item.btu+'"'+((parseInt(system.selectedBtu,10)||0)===(parseInt(item.btu,10)||0)?' selected':'')+'>'+lbl+'</option>';
    }).join('');
    var totalSelected = getSelectedInstalledCapacity(system);
    var typeControl = '<div class="system-select-field"><select class="qi-utype-sel system-select-control" onchange="updateRoomSystem('+i+',\''+system.id+'\',\'unitType\',this.value)">'+typeOpts+'</select></div>';
    return ''+
      '<div class="mixed-system-row">'+
        '<div class="mixed-system-grid">'+
          '<div class="proj-input-group mixed-field mixed-field-type"><div class="qi-plbl">'+t('mixedtype')+'</div>'+typeControl+'</div>'+
          '<div class="proj-input-group mixed-field mixed-field-qty"><div class="qi-plbl">'+t('mixedqty')+'</div><div class="mixed-qty-stepper"><button type="button" class="qbtn" onclick="decrementSystemQty('+i+',\''+system.id+'\')">-</button><input class="mixed-qty-value" type="text" readonly value="'+system.qty+'"><button type="button" class="qbtn" onclick="incrementSystemQty('+i+',\''+system.id+'\')">+</button></div></div>'+
          '<div class="proj-input-group mixed-field mixed-field-capacity"><div class="qi-plbl">'+t('mixedcapacity')+'</div><div class="system-select-field"><select class="qi-cap-sel system-select-control" onchange="updateRoomSystem('+i+',\''+system.id+'\',\'selectedBtu\',this.value)">'+capOpts+'</select></div></div>'+
          '<div class="proj-input-group mixed-field mixed-field-total"><div class="qi-plbl">'+t('mixedtotalcapacity')+'</div><div class="mixed-total-remove-row"><div class="ninput mixed-total-display" style="display:flex;align-items:center">'+Number(totalSelected).toLocaleString()+' BTU/h</div><button type="button" class="mixed-system-remove" onclick="removeRoomSystem('+i+',\''+system.id+'\')">'+t('mixedremove')+'</button></div></div>'+
        '</div>'+
      '</div>';
  }).join('');
  return ''+
    '<div class="room-systems-inline">'+
      '<div class="mixed-systems-list">'+
        (rowsHtml || '<div class="mixed-systems-empty">'+t('mixedempty')+'</div>')+
      '</div>'+
      '<div class="mixed-systems-actions mixed-systems-add-row"><button type="button" class="mixed-systems-btn primary" onclick="addRoomSystem('+i+')" aria-label="'+t('mixedadd')+'">'+t('mixedadd')+'</button></div>'+
    '</div>';
}
function getZoneSystem(zoneId, systemId){
  var zone = getZoneById(zoneId);
  if(!zone) return null;
  for(var i=0;i<zone.systems.length;i++){
    if(zone.systems[i] && zone.systems[i].id === systemId) return zone.systems[i];
  }
  return null;
}
function recalcZoneSystems(zoneId){
  if(zoneId && !getZoneById(zoneId)) return;
  recalcProjectTotals();
  persistQuoteState();
  renderCalcWorkflowCard();
  renderTechReport();
  renderQuotation();
  renderDesktopInsightPanel();
  refreshGrandTotal();
}
function addZoneSystem(zoneId){
  var zone = getZoneById(zoneId);
  if(!zone) return;
  zone.systems.push(normalizeQuoteSystem({
    unitType:'ahu',
    selectedBtu:getDefaultSystemCapacity('ahu'),
    qty:1
  }));
  saveHvacZones();
  recalcZoneSystems(zoneId);
}
function updateZoneSystem(zoneId, systemId, field, value){
  var zone = getZoneById(zoneId);
  var system = getZoneSystem(zoneId, systemId);
  if(!zone || !system) return;
  if(field === 'unitType'){
    system.unitType = getAllowedSystemType(value);
    system.selectedBtu = getDefaultSystemCapacity(system.unitType);
  } else if(field === 'selectedBtu'){
    system.selectedBtu = toSystemBtu(value) || getDefaultSystemCapacity(system.unitType);
  } else if(field === 'qty'){
    system.qty = Math.max(1, parseInt(value,10) || 1);
  }
  zone.systems = zone.systems.map(normalizeQuoteSystem);
  saveHvacZones();
  recalcZoneSystems(zoneId);
}
function incrementZoneSystemQty(zoneId, systemId){
  var system = getZoneSystem(zoneId, systemId);
  if(!system) return;
  updateZoneSystem(zoneId, systemId, 'qty', Math.max(1, parseInt(system.qty,10)||1) + 1);
}
function decrementZoneSystemQty(zoneId, systemId){
  var system = getZoneSystem(zoneId, systemId);
  if(!system) return;
  updateZoneSystem(zoneId, systemId, 'qty', Math.max(1, Math.max(1, parseInt(system.qty,10)||1) - 1));
}
function removeZoneSystem(zoneId, systemId){
  var zone = getZoneById(zoneId);
  if(!zone) return;
  zone.systems = zone.systems.filter(function(system){ return system && system.id !== systemId; });
  saveHvacZones();
  recalcZoneSystems(zoneId);
}
function deleteZone(zoneId){
  hvacZones = hvacZones.filter(function(zone){ return zone && zone.id !== zoneId; });
  for(var i=0;i<qlines.length;i++){
    var assignment = getRoomAssignment(i);
    if(assignment.mode === 'zone' && assignment.zoneId === zoneId){
      qlines[i].assignment = normalizeRoomAssignment({ mode:'independent', zoneId:'' });
    }
  }
  saveHvacZones();
  persistQuoteState();
  recalcProjectTotals();
  renderCalcWorkflowCard();
  renderTechReport();
  renderQuotation();
  renderDesktopInsightPanel();
}

function recalcProjectSystems(){
  syncLegacyProjectStateFromSystems();
  recalcProjectTotals();
  persistQuoteState();
  rerenderAfterProjectUnitChange();
}

function addProjectSystem(){
  ensureProjectSystems();
  projectSystems = addNormalizedSystemToCollection(projectSystems, {
    unitType: 'ahu',
    selectedBtu: getDefaultSystemCapacity('ahu'),
    qty: 1
  }).map(normalizeProjectSystem);
  saveProjectSystems();
  recalcProjectSystems();
}

function updateProjectSystem(systemId, field, value){
  if(!getProjectSystem(systemId)) return;
  projectSystems = updateNormalizedSystemInCollection(projectSystems, systemId, field, value).map(normalizeProjectSystem);
  saveProjectSystems();
  recalcProjectSystems();
}

function incrementProjectSystemQty(systemId){
  var system = getProjectSystem(systemId);
  if(!system) return;
  updateProjectSystem(systemId, 'qty', Math.max(1, parseInt(system.qty,10) || 1) + 1);
}

function decrementProjectSystemQty(systemId){
  var system = getProjectSystem(systemId);
  if(!system) return;
  updateProjectSystem(systemId, 'qty', Math.max(1, Math.max(1, parseInt(system.qty,10) || 1) - 1));
}

function removeProjectSystem(systemId){
  ensureProjectSystems();
  projectSystems = removeSystemFromCollection(projectSystems, systemId).map(normalizeProjectSystem);
  var fallbackId = (projectSystems[0] || {}).id || '';
  for(var i=0;i<hist.length;i++){
    var assignment = getRoomAssignment(i);
    if(assignment.mode === 'project' && assignment.projectSystemId === systemId){
      ensureQuoteLine(i).assignment = normalizeRoomAssignment({ mode:'project', zoneId:'', projectSystemId: fallbackId });
    }
  }
  saveProjectSystems();
  recalcProjectSystems();
}

function mapProjectSystemTypeToEquipmentType(unitType){
  unitType = getAllowedSystemType(unitType);
  if(unitType === 'chiller_air' || unitType === 'chiller_water') return 'chiller';
  return unitType;
}

function mapEquipmentTypeToProjectSystemType(equipmentType, fallbackType){
  equipmentType = String(equipmentType || '').trim();
  if(equipmentType === 'chiller') return getAllowedSystemType(fallbackType || 'chiller_air');
  return getAllowedSystemType(equipmentType || fallbackType || 'split');
}

function isProjectSystemEquipmentRecordCompatible(systemUnitType, record){
  if(!record) return false;
  var targetType = mapProjectSystemTypeToEquipmentType(systemUnitType);
  if(targetType && record.equipmentType !== targetType) return false;
  if(targetType === 'chiller'){
    var descriptor = String((record.series || '') + ' ' + (record.exactModelNumber || '') + ' ' + (record.notes || '')).toLowerCase();
    if(systemUnitType === 'chiller_air') return descriptor.indexOf('air-cooled') >= 0 || descriptor.indexOf('air cooled') >= 0;
    if(systemUnitType === 'chiller_water') return descriptor.indexOf('water-cooled') >= 0 || descriptor.indexOf('water cooled') >= 0;
  }
  return true;
}

function getProjectSystemEquipmentSelectorContext(systemId){
  var system = getProjectSystem(systemId) || {};
  var requiredBtu = getProjectSystemRequiredBtu(systemId) || getProjectRequiredLoadBtu();
  var requiredCfm = getProjectSystemRequiredCfm(systemId) || getProjectRequiredLoadCfm();
  var option = system.selectedEquipmentOption || (system.equipmentSnapshot && system.equipmentSnapshot.selectionOption) || null;
  var record = system.equipmentSnapshot && system.equipmentSnapshot.record ? system.equipmentSnapshot.record : null;
  return {
    target: 'projectSystem',
    systemId: systemId,
    requiredCoolingLoadBtuH: requiredBtu,
    requiredSupplyCfm: requiredCfm,
    requiredEspPa: window._lastEspCalc && window._lastEspCalc.totalPa != null ? Number(window._lastEspCalc.totalPa) || 0 : 0,
    systemUnitType: system.unitType || 'package',
    equipmentType: mapProjectSystemTypeToEquipmentType(system.unitType || 'package'),
    voltage: record && record.voltage != null ? record.voltage : 380,
    phase: record && record.phase != null ? record.phase : 3,
    frequencyHz: record && record.frequencyHz != null ? record.frequencyHz : 60,
    marketRegion: record && record.marketRegion ? record.marketRegion : 'SA',
    verifiedDataOnly: true,
    requireSaudiListing: false,
    maxUnits: Math.max(1, parseInt((option && option.quantity) || system.qty, 10) || 4)
  };
}

function openProjectSystemEquipmentSelector(systemId){
  if(!getProjectSystem(systemId)) return;
  var context = getProjectSystemEquipmentSelectorContext(systemId);
  try{
    if(window.AppEquipmentSelector && typeof window.AppEquipmentSelector.openForProjectSystem === 'function'){
      window.AppEquipmentSelector.openForProjectSystem(context);
      var modal = G('equip-select-modal');
      if(modal) modal.classList.add('on');
      return;
    }
    if(window.AppEquipmentSelector && typeof window.AppEquipmentSelector.open === 'function'){
      window.AppEquipmentSelector.open(context);
      var fallbackModal = G('equip-select-modal');
      if(fallbackModal) fallbackModal.classList.add('on');
      return;
    }
  }catch(error){
    console.warn('[AirCalc] Equipment selector failed to open, using manual capacity fallback.', error);
  }
  promptProjectSystemManualCapacity(systemId);
}

function applyProjectSystemManualCapacity(systemId, capacityBtu){
  var system = getProjectSystem(systemId);
  var selectedBtu = toSystemBtu(capacityBtu);
  if(!system || selectedBtu <= 0) return false;
  system.selectedBtu = selectedBtu;
  system.equipmentDatabaseId = '';
  system.equipmentId = null;
  system.equipmentSnapshot = null;
  system.selectedEquipmentOption = null;
  system.manualCapacity = true;
  system.manualCapacityBtuH = selectedBtu;
  system.selectionMode = 'manual';
  system.equipmentReviewStatus = 'manual_capacity';
  system.selectedEquipmentId = '';
  system.selectedManufacturer = '';
  system.selectedModel = '';
  system.selectedCapacityBtuH = selectedBtu;
  system.selectedCapacityTr = selectedBtu / 12000;
  system.selectedAirflowCfm = getEstimatedUnitAirflowCfm(system);
  system.selectedQuantity = Math.max(1, parseInt(system.qty, 10) || 1);
  system.totalInstalledCapacityBtuH = selectedBtu * system.selectedQuantity;
  system.totalInstalledAirflowCfm = system.selectedAirflowCfm * system.selectedQuantity;
  system.automaticSelectionReason = '';
  system.conceptualScenarioSnapshot = null;
  system.finalEquipmentCapacityBtuH = 0;
  saveProjectSystems();
  recalcProjectSystems();
  if(window.toast) window.toast(lang==='ar' ? 'تم حفظ السعة اليدوية للوحدة' : 'Manual capacity saved for this unit');
  return true;
}

function applyBestProjectSystemAutomatically(systemId){
  ensureProjectSystems();
  if(!projectSystems.length) seedProjectSystemsFromLegacyState();
  var system = systemId ? getProjectSystem(systemId) : projectSystems[0];
  if(!system) return false;
  var unitType = getAllowedSystemType(system.unitType || projState.sysType || 'split');
  var totalBtu = Math.max(0, getProjectRequiredLoadBtu());
  var totalCfm = Math.max(0, getProjectRequiredLoadCfm());
  var refRoom = getProjectReferenceRoomLoad();
  var decision = getBestProjectSystemAutoSelection(system, {
    unitType: unitType,
    totalRequiredBtu: totalBtu,
    totalRequiredCfm: totalCfm,
    roomCount: Math.max(1, getTotalRecordRoomCount()),
    refRoomBtu: refRoom.btu,
    refRoomCfm: refRoom.cfm
  });
  if(!decision || !decision.selectedBtu){
    if(window.toast) window.toast(lang==='ar' ? 'لم يتم العثور على سعة قياسية مناسبة.' : 'No suitable standard capacity was found.');
    return false;
  }
  system.unitType = unitType;
  system.selectedBtu = decision.selectedBtu;
  system.qty = Math.max(1, parseInt(decision.qty, 10) || 1);
  system.equipmentDatabaseId = '';
  system.equipmentId = '';
  system.equipmentSnapshot = null;
  system.selectedEquipmentOption = null;
  system.manualCapacity = true;
  system.manualCapacityBtuH = decision.selectedBtu;
  system.selectionMode = 'manual';
  system.equipmentReviewStatus = 'standard_capacity_auto';
  system.scenarioStatus = system.conceptualScenarioSnapshot ? 'Equipment Pending' : system.scenarioStatus;
  system.selectedEquipmentId = '';
  system.selectedManufacturer = '';
  system.selectedModel = '';
  system.selectedCapacityBtuH = decision.selectedBtu;
  system.selectedCapacityTr = decision.selectedBtu / 12000;
  system.selectedAirflowCfm = getEstimatedUnitAirflowCfm(system);
  system.selectedQuantity = system.qty;
  system.totalInstalledCapacityBtuH = decision.selectedBtu * system.qty;
  system.totalInstalledAirflowCfm = system.selectedAirflowCfm * system.qty;
  system.conceptualCapacityBtuH = system.totalInstalledCapacityBtuH;
  system.finalEquipmentCapacityBtuH = 0;
  system.automaticSelectionReason = decision.reason || buildAutoQtyReason('central-match');
  system = getProjectSystem(system.id) || system;
  system.autoReason = decision.reason || system.automaticSelectionReason || '';
  saveProjectSystems();
  recalcProjectSystems();
  if(window.toast){
    var perf = getInstalledEquipmentPerformance(system);
    var pickedText = Number(perf.unitCapacityBtuH || 0).toLocaleString('en-US') + ' BTU/h x ' + perf.quantity;
    window.toast(lang==='ar' ? ('تم اختيار ' + pickedText + ' حسب حمل المشروع') : ('Auto-selected ' + pickedText + ' from project load'));
  }
  return true;
}

function getProjectSystemDatabaseRecords(unitType){
  var records = [];
  try{
    records = window.AppEquipmentDatabase && typeof window.AppEquipmentDatabase.allRecords === 'function'
      ? window.AppEquipmentDatabase.allRecords()
      : [];
  }catch(error){
    records = [];
  }
  return records.filter(function(record){
    if(!record || record.discontinued || record.sampleData) return false;
    if(!record.id) return false;
    if(!isProjectSystemEquipmentRecordCompatible(unitType, record)) return false;
    if(record.equipmentType === 'ahu'){
      return !!(record.airflowNominalCfm || record.airflowMaxCfm || record.airflowMinCfm);
    }
    return !!record.coolingCapacityBtuH;
  });
}

function getBestProjectSystemDatabaseSelection(system, opts){
  system = normalizeProjectSystem(system || {});
  opts = opts || {};
  var unitType = getAllowedSystemType(opts.unitType || system.unitType || 'split');
  var totalRequiredBtu = Math.max(0, parseInt(opts.totalRequiredBtu, 10) || 0);
  var totalRequiredCfm = Math.max(0, parseInt(opts.totalRequiredCfm, 10) || 0);
  var records = getProjectSystemDatabaseRecords(unitType);
  if(!records.length) return null;
  var engine = window.AirCalcEquipmentSelection;
  var selection = null;
  if(engine && typeof engine.selectEquipment === 'function'){
    selection = engine.selectEquipment({
      requiredCoolingLoadBtuH: totalRequiredBtu,
      requiredSupplyCfm: totalRequiredCfm,
      requiredEspPa: window._lastEspCalc && window._lastEspCalc.totalPa != null ? Number(window._lastEspCalc.totalPa) || 0 : null,
      equipmentType: mapProjectSystemTypeToEquipmentType(unitType),
      systemUnitType: unitType,
      marketRegion: 'SA',
      requireSaudiListing: false,
      verifiedDataOnly: false,
      includeSampleData: false,
      maxUnits: 8,
      records: records
    });
  }
  var option = selection && selection.recommendedOption ? selection.recommendedOption : getBestProjectSystemDatabaseSelectionFallback(unitType, records, totalRequiredBtu, totalRequiredCfm);
  if(!option || !option.record) return null;
  var record = option.record;
  var qty = Math.max(1, parseInt(option.quantity, 10) || 1);
  var unitCfm = Math.max(0, parseInt(record.airflowNominalCfm || record.airflowMaxCfm || record.airflowMinCfm, 10) || 0);
  var note = lang==='ar'
    ? 'تم الاختيار تلقائياً من قاعدة الوحدات حسب الحمل، CFM، وبيانات الكتالوج.'
    : 'Automatically selected from Equipment Database using load, CFM, and catalogue data.';
  return {
    record: record,
    option: Object.assign({}, option, {
      optionId: option.optionId || (record.id + '-auto-x' + qty),
      equipmentId: record.id,
      record: record,
      quantity: qty,
      activeQuantity: option.activeQuantity || qty,
      totalCapacityBtuH: Number(option.totalCapacityBtuH || ((record.coolingCapacityBtuH || 0) * qty)) || 0,
      totalAirflowCfm: Number(option.totalAirflowCfm || (unitCfm * qty)) || 0,
      availableEspPa: option.availableEspPa == null ? record.availableEspPa : option.availableEspPa,
      selectionMode: 'database_auto',
      automaticSelectionReason: note,
      preBindReview: option.preBindReview || {
        source: 'rules_engine',
        status: 'rules_engine_reviewed',
        label: lang==='ar' ? 'اختيار تلقائي من قاعدة الوحدات' : 'Database Auto Selection',
        notes: [note]
      }
    }),
    selectedBtu: Number(record.coolingCapacityBtuH || 0) || 0,
    qty: qty,
    reason: note
  };
}

function getBestProjectSystemDatabaseSelectionFallback(unitType, records, targetBtu, targetCfm){
  var best = null;
  (records || []).forEach(function(record){
    var unitBtu = Number(record.coolingCapacityBtuH || 0);
    var unitCfm = Number(record.airflowNominalCfm || record.airflowMaxCfm || record.airflowMinCfm || 0);
    if(unitBtu <= 0 && unitCfm <= 0) return;
    var qtyByBtu = targetBtu > 0 && unitBtu > 0 ? Math.ceil(targetBtu / unitBtu) : 1;
    var qtyByCfm = targetCfm > 0 && unitCfm > 0 ? Math.ceil(targetCfm / unitCfm) : 1;
    var qty = Math.max(1, qtyByBtu, qtyByCfm);
    var totalBtu = unitBtu * qty;
    var totalCfm = unitCfm * qty;
    if(targetBtu > 0 && unitBtu > 0 && totalBtu < targetBtu) return;
    if(targetCfm > 0 && unitCfm > 0 && totalCfm < targetCfm) return;
    var overBtu = targetBtu > 0 && unitBtu > 0 ? ((totalBtu - targetBtu) / targetBtu) * 100 : 0;
    var overCfm = targetCfm > 0 && unitCfm > 0 ? ((totalCfm - targetCfm) / targetCfm) * 100 : 0;
    var status = String(record.verificationStatus || '').toLowerCase();
    var verifiedBonus = (status === 'verified' || status === 'published') ? -12 : 0;
    var score = Math.max(0, overBtu) * 2 + Math.max(0, overCfm) * 0.5 + qty * 4 + verifiedBonus;
    var candidate = {
      optionId: record.id + '-fallback-x' + qty,
      equipmentId: record.id,
      record: record,
      quantity: qty,
      activeQuantity: qty,
      totalCapacityBtuH: totalBtu,
      totalAirflowCfm: totalCfm,
      availableEspPa: record.availableEspPa,
      oversizingPercent: Math.round(overBtu * 10) / 10,
      matchScore: Math.max(1, Math.min(100, Math.round(100 - score))),
      score: score
    };
    if(!best || candidate.score < best.score) best = candidate;
  });
  return best;
}

function buildHvacScenarioProjectInput(){
  var totalBtu = Math.max(0, getProjectRequiredLoadBtu());
  var totalCfm = Math.max(0, getProjectRequiredLoadCfm());
  var roomCount = Math.max(0, hist.length || 0);
  var peak = getProjectReferenceRoomLoad();
  var outdoorAirCfm = hist.reduce(function(sum, room){
    return sum + (Number((room || {}).oaStd || (room || {}).oa || (room || {}).outdoorAirCfm || (room || {}).freshAirCfm || 0) || 0);
  }, 0);
  var healthcareRooms = hist.filter(function(room){ return isHealthcareRoom(room); }).length;
  return {
    requiredCapacityBtuH: totalBtu,
    peakCoolingLoadBtuH: peak.btu || 0,
    requiredAirflowCfm: totalCfm,
    outdoorAirCfm: Math.max(0, Math.round(outdoorAirCfm)),
    roomCount: roomCount,
    healthcareRooms: healthcareRooms,
    hasHealthcare: healthcareRooms > 0,
    ductSpaceAvailable: null,
    ceilingSpaceAvailable: null,
    plantRoomAvailable: null,
    existingChilledWater: false,
    redundancyRequired: false,
    projectType: healthcareRooms > 0 ? 'healthcare' : 'general',
    rooms: hist.map(function(room, index){
      return {
        index: index,
        name: (room && (room.name || room.type || room.roomType)) || ('Room ' + (index + 1)),
        btu: getRoomRequiredBtu(index),
        cfm: getRoomRequiredCfm(index),
        area: Number((room || {}).area || (room || {}).m2 || 0) || 0,
        usage: (room && (room.type || room.roomType || room.name)) || ''
      };
    })
  };
}

var STANDARD_HVAC_CAPACITY_FALLBACK = [9000,12000,18000,24000,27000,30000,36000,42000,48000,60000,72000,96000,120000];
var STANDARD_HVAC_CAPACITIES = {
  split: STANDARD_HVAC_CAPACITY_FALLBACK,
  ducted: STANDARD_HVAC_CAPACITY_FALLBACK,
  cassette: STANDARD_HVAC_CAPACITY_FALLBACK,
  package: STANDARD_HVAC_CAPACITY_FALLBACK,
  vrf: STANDARD_HVAC_CAPACITY_FALLBACK,
  chiller_air: STANDARD_HVAC_CAPACITY_FALLBACK,
  ahu: STANDARD_HVAC_CAPACITY_FALLBACK
};

function getStandardHvacCapacities(unitType){
  var catalogSource = [];
  try{
    catalogSource = (getCatalog(unitType) || []).map(function(item){ return item && item.btu; });
  }catch(e){
    catalogSource = [];
  }
  var source = (catalogSource && catalogSource.length ? catalogSource : null) || (AC_BTU_STEPS && AC_BTU_STEPS.length ? AC_BTU_STEPS : null) || (STANDARD_HVAC_CAPACITIES && STANDARD_HVAC_CAPACITIES[unitType]) || STANDARD_HVAC_CAPACITY_FALLBACK;
  return source.map(function(value){ return Math.max(0, parseInt(value, 10) || 0); })
    .filter(function(value, index, list){ return value > 0 && list.indexOf(value) === index; })
    .sort(function(a,b){ return a-b; });
}

function estimateScenarioAirflowFromCapacity(unitCapacityBtuH, quantity, requiredCfm){
  var capacityCfm = Math.round((Math.max(0, Number(unitCapacityBtuH || 0) || 0) / 12000) * 400) * Math.max(1, Number(quantity || 1) || 1);
  if(requiredCfm > 0 && capacityCfm <= 0) return Math.round(requiredCfm);
  return Math.max(0, capacityCfm);
}

function selectStandardScenarioCapacity(unitType, requiredBtu, requiredCfm, opts){
  opts = opts || {};
  var targetBtu = Math.max(0, Number(requiredBtu || 0) || 0);
  var targetCfm = Math.max(0, Number(requiredCfm || 0) || 0);
  var maxQty = Math.max(1, parseInt(opts.maxQty, 10) || 8);
  var minQty = Math.max(1, parseInt(opts.minQty, 10) || (unitType === 'split' && opts.roomCount ? parseInt(opts.roomCount, 10) : 1) || 1);
  var preferredQty = Math.max(0, parseInt(opts.preferredQty, 10) || 0);
  var maxOversizePct = opts.maxOversizePct == null ? 10 : Math.max(0, Number(opts.maxOversizePct) || 0);
  var hardOversizePct = opts.hardOversizePct == null ? 10 : Math.max(maxOversizePct, Number(opts.hardOversizePct) || maxOversizePct);
  var capacities = getStandardHvacCapacities(unitType);
  if(!capacities.length || targetBtu <= 0) return null;
  var best = null;
  var fallback = null;
  capacities.forEach(function(unitBtu){
    for(var qty=minQty; qty<=maxQty; qty++){
      var totalBtu = unitBtu * qty;
      if(totalBtu < targetBtu) continue;
      var oversizePct = targetBtu > 0 ? ((totalBtu - targetBtu) / targetBtu) * 100 : 0;
      if(oversizePct > hardOversizePct) continue;
      var qtyPenalty = preferredQty ? Math.abs(qty - preferredQty) * 3 : (qty * 1.2);
      var oversizePenalty = oversizePct <= maxOversizePct ? oversizePct : (maxOversizePct + ((oversizePct - maxOversizePct) * 5));
      var splitLargePenalty = unitType === 'split' && unitBtu > 30000 ? (unitBtu - 30000) / 1000 : 0;
      var score = oversizePenalty + qtyPenalty + splitLargePenalty + (unitBtu > 60000 && unitType === 'split' ? 12 : 0);
      var candidate = {
        unitType: unitType,
        standardUnitCapacityBtuH: unitBtu,
        unitCapacityBtuH: unitBtu,
        quantity: qty,
        totalInstalledCapacityBtuH: totalBtu,
        totalCapacityBtuH: totalBtu,
        requiredCapacityBtuH: targetBtu,
        capacityDifferenceBtuH: totalBtu - targetBtu,
        oversizingPercent: Math.round(oversizePct * 10) / 10,
        requiredAirflowCfm: targetCfm,
        estimatedInstalledAirflowCfm: estimateScenarioAirflowFromCapacity(unitBtu, qty, targetCfm),
        totalAirflowCfm: estimateScenarioAirflowFromCapacity(unitBtu, qty, targetCfm),
        standardCapacitySource: 'AC_BTU_STEPS',
        selectionStage: 'conceptual',
        score: score
      };
      if(oversizePct <= maxOversizePct){
        if(!best || candidate.score < best.score) best = candidate;
      } else if(!fallback || candidate.score < fallback.score){
        fallback = candidate;
      }
    }
  });
  return best || fallback;
}

function isAcceptableConceptualOversize(scenario, limitPct){
  var limit = limitPct == null ? 10 : Number(limitPct);
  if(!scenario) return false;
  if(scenario.oversizingPercent == null) return true;
  return Number(scenario.oversizingPercent) <= limit;
}

function rankProjectLevelDesignScenarios(scenarios, minOptions){
  var targetCount = Math.max(1, parseInt(minOptions, 10) || 3);
  var seen = {};
  var unique = (scenarios || []).filter(function(item){
    if(!item) return false;
    var key = item.scenarioType + '|' + item.architecture;
    if(seen[key]) return false;
    seen[key] = true;
    return true;
  });
  var acceptable = unique.filter(function(item){
    return isAcceptableConceptualOversize(item, 10);
  }).sort(function(a,b){
    return b.recommendationScore - a.recommendationScore;
  });
  var review = unique.filter(function(item){
    return !isAcceptableConceptualOversize(item, 10);
  }).sort(function(a,b){
    var aOver = Math.abs(Number(a.oversizingPercent || 999));
    var bOver = Math.abs(Number(b.oversizingPercent || 999));
    if(aOver !== bOver) return aOver - bOver;
    return b.recommendationScore - a.recommendationScore;
  });
  var ranked = acceptable.length >= targetCount
    ? acceptable
    : acceptable.concat(review);
  return ranked.slice(0, targetCount).map(function(item){
    if(item && item.oversizingPercent != null && Number(item.oversizingPercent) > 10){
      item.warnings = (item.warnings || []).slice();
      if(item.warnings.indexOf('Capacity oversize exceeds 10%; engineer review is required before selecting this scenario.') === -1){
        item.warnings.push('Capacity oversize exceeds 10%; engineer review is required before selecting this scenario.');
      }
      item.scenarioStatus = 'Conceptual - Review Required';
    }
    return item;
  });
}

function selectStandardChillerScenarioCapacity(requiredBtu, opts){
  opts = opts || {};
  var targetBtu = Math.max(0, Number(requiredBtu || 0) || 0);
  if(targetBtu <= 0) return null;
  var trSteps = [3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 9, 10, 12.5, 15, 20, 25, 30, 40, 50];
  var best = null;
  trSteps.forEach(function(tr){
    var totalBtu = Math.round(tr * 12000);
    if(totalBtu < targetBtu) return;
    var oversizePct = ((totalBtu - targetBtu) / targetBtu) * 100;
    var candidate = {
      unitType: opts.unitType || 'chiller_air',
      standardUnitCapacityBtuH: totalBtu,
      unitCapacityBtuH: totalBtu,
      standardUnitCapacityTr: tr,
      quantity: 1,
      totalInstalledCapacityBtuH: totalBtu,
      totalCapacityBtuH: totalBtu,
      requiredCapacityBtuH: targetBtu,
      capacityDifferenceBtuH: totalBtu - targetBtu,
      oversizingPercent: Math.round(oversizePct * 10) / 10,
      requiredAirflowCfm: 0,
      estimatedInstalledAirflowCfm: 0,
      totalAirflowCfm: 0,
      standardCapacitySource: 'STANDARD_CHILLER_TR_STEPS',
      selectionStage: 'conceptual',
      score: oversizePct
    };
    if(!best || candidate.score < best.score) best = candidate;
  });
  return best;
}

function selectScenarioEquipmentOption(unitType, requiredBtu, requiredCfm, opts){
  if(unitType === 'ahu' && Math.max(0, Number(requiredBtu || 0) || 0) <= 0 && Math.max(0, Number(requiredCfm || 0) || 0) > 0){
    var ahuCfm = Math.max(0, Math.round(Number(requiredCfm || 0) || 0));
    return {
      unitType: unitType,
      equipmentType: mapProjectSystemTypeToEquipmentType(unitType),
      standardUnitCapacityBtuH: 0,
      standardUnitCapacityTr: 0,
      unitCapacityBtuH: 0,
      unitAirflowCfm: ahuCfm,
      quantity: 1,
      totalInstalledCapacityBtuH: 0,
      totalCapacityBtuH: 0,
      requiredCapacityBtuH: 0,
      capacityDifferenceBtuH: 0,
      oversizingPercent: null,
      requiredAirflowCfm: ahuCfm,
      estimatedInstalledAirflowCfm: ahuCfm,
      totalAirflowCfm: ahuCfm,
      standardCapacitySource: 'PROJECT_REQUIRED_CFM',
      selectionStage: 'conceptual'
    };
  }
  var conceptual = unitType === 'chiller_air'
    ? selectStandardChillerScenarioCapacity(requiredBtu, Object.assign({}, opts || {}, { unitType: unitType }))
    : selectStandardScenarioCapacity(unitType, requiredBtu, requiredCfm, opts);
  if(!conceptual) return null;
  return {
    unitType: unitType,
    equipmentType: mapProjectSystemTypeToEquipmentType(unitType),
    standardUnitCapacityBtuH: conceptual.standardUnitCapacityBtuH,
    standardUnitCapacityTr: conceptual.standardUnitCapacityTr || (conceptual.standardUnitCapacityBtuH / 12000),
    unitCapacityBtuH: conceptual.unitCapacityBtuH,
    unitAirflowCfm: Math.round((conceptual.unitCapacityBtuH / 12000) * 400),
    quantity: conceptual.quantity,
    totalInstalledCapacityBtuH: conceptual.totalInstalledCapacityBtuH,
    totalCapacityBtuH: conceptual.totalInstalledCapacityBtuH,
    requiredCapacityBtuH: conceptual.requiredCapacityBtuH,
    capacityDifferenceBtuH: conceptual.capacityDifferenceBtuH,
    oversizingPercent: conceptual.oversizingPercent,
    requiredAirflowCfm: conceptual.requiredAirflowCfm,
    estimatedInstalledAirflowCfm: conceptual.estimatedInstalledAirflowCfm,
    totalAirflowCfm: conceptual.estimatedInstalledAirflowCfm,
    standardCapacitySource: conceptual.standardCapacitySource,
    selectionStage: 'conceptual'
  };
}

function makeHvacScenario(input, config){
  var selections = (config.selections || []).filter(Boolean);
  var installedBtu = selections.reduce(function(sum, item){ return sum + (Number(item.totalCapacityBtuH || 0) || 0); }, 0);
  var installedCfm = selections.reduce(function(sum, item){ return sum + (Number(item.totalAirflowCfm || 0) || 0); }, 0);
  var requiredBtu = Math.max(0, Number(input.requiredCapacityBtuH || 0) || 0);
  var requiredCfm = Math.max(0, Number(input.requiredAirflowCfm || 0) || 0);
  var oversize = requiredBtu > 0 && installedBtu > 0 ? ((installedBtu - requiredBtu) / requiredBtu) * 100 : null;
  var capacityDifference = installedBtu - requiredBtu;
  var warnings = (config.warnings || []).slice();
  var assumptions = (config.assumptions || []).slice();
  var requiredInputs = (config.requiredInputs || []).slice();
  if(!selections.length){
    warnings.push('Conceptual scenario - standard capacity required before manufacturer selection.');
    requiredInputs.push('Standard capacity selection for this system type.');
  }
  if(input.outdoorAirCfm > 0 && config.requiresDedicatedFreshAir){
    warnings.push('Fresh Air is not provided by this cooling equipment alone.');
  }
  if(config.scenarioType === 'centralized' && !config.coolingSource){
    warnings.push('Central scenario requires a defined cooling source.');
  }
  if(config.architecture && /AHU/i.test(config.architecture) && !/Chilled Water|Chiller|DX/i.test(config.architecture)){
    warnings.push('AHU must be connected to a cooling source.');
  }
  if(input.ductSpaceAvailable == null && config.needsDuctSpace){
    assumptions.push('Duct space availability is unknown.');
    requiredInputs.push('Confirm available duct/ceiling/service space.');
  }
  var capacitySuitability = installedBtu <= 0 ? 35 : Math.max(0, Math.min(100, oversize < 0 ? 20 : (oversize <= 20 ? 95 - oversize : 75 - (oversize - 20))));
  var airflowSuitability = installedCfm <= 0 || requiredCfm <= 0 ? 55 : Math.max(0, Math.min(100, installedCfm >= requiredCfm ? 95 : 35));
  var ventilationSuitability = input.outdoorAirCfm > 0 ? (config.freshAirSolution ? 90 : 45) : 75;
  var zoningSuitability = config.zoningScore == null ? 70 : config.zoningScore;
  var equipmentAvailability = selections.length ? 70 : 30;
  var projectConstraintsFit = warnings.length ? Math.max(20, 90 - warnings.length * 12) : 90;
  var score = Math.round((
    capacitySuitability * 0.22 +
    airflowSuitability * 0.16 +
    ventilationSuitability * 0.14 +
    zoningSuitability * 0.12 +
    (config.maintainabilityScore || 70) * 0.10 +
    (config.energyScore || 70) * 0.10 +
    equipmentAvailability * 0.10 +
    projectConstraintsFit * 0.06
  ) - (requiredInputs.length * 3));
  var confidence = Math.max(25, Math.min(96, Math.round(score - requiredInputs.length * 4 - assumptions.length * 2)));
  return {
    scenarioId: config.scenarioId,
    scenarioType: config.scenarioType,
    title: config.title,
    categoryLabel: config.categoryLabel || '',
    description: config.description || '',
    architecture: config.architecture || '',
    systemComponents: config.systemComponents || [],
    roomAssignments: config.roomAssignments || [],
    requiredCapacityBtuH: requiredBtu,
    conceptualCapacityBtuH: installedBtu,
    installedCapacityBtuH: installedBtu,
    totalInstalledCapacityBtuH: installedBtu,
    capacityDifferenceBtuH: capacityDifference,
    oversizingPercent: oversize == null ? null : Math.round(oversize * 10) / 10,
    requiredAirflowCfm: requiredCfm,
    estimatedInstalledAirflowCfm: installedCfm,
    installedAirflowCfm: installedCfm,
    finalEquipmentCapacityBtuH: 0,
    equipmentSelections: selections,
    standardCapacities: selections.map(function(item){
      return {
        unitType:item.unitType,
        standardUnitCapacityBtuH:item.standardUnitCapacityBtuH || item.unitCapacityBtuH,
        quantity:item.quantity,
        totalInstalledCapacityBtuH:item.totalCapacityBtuH,
        requiredCapacityBtuH:item.requiredCapacityBtuH || requiredBtu,
        capacityDifferenceBtuH:item.capacityDifferenceBtuH,
        oversizingPercent:item.oversizingPercent,
        requiredAirflowCfm:item.requiredAirflowCfm || requiredCfm,
        estimatedInstalledAirflowCfm:item.estimatedInstalledAirflowCfm || item.totalAirflowCfm
      };
    }),
    equipmentQuantities: selections.map(function(item){ return { unitType:item.unitType, standardUnitCapacityBtuH:item.standardUnitCapacityBtuH || item.unitCapacityBtuH, quantity:item.quantity }; }),
    scenarioStatus: 'Conceptual',
    manufacturerSelectionStatus: 'Equipment Pending',
    zoningStrategy: config.zoningStrategy || '',
    ventilationStrategy: config.freshAirSolution || (input.outdoorAirCfm > 0 ? 'Dedicated Fresh Air confirmation required.' : 'No explicit outdoor-air requirement in current inputs.'),
    controlStrategy: config.controlStrategy || '',
    redundancyLevel: config.redundancyLevel || 'none',
    estimatedComplexity: config.estimatedComplexity || 'medium',
    estimatedMaintainability: config.estimatedMaintainability || 'medium',
    energySuitability: config.energySuitability || 'medium',
    initialCostClass: config.initialCostClass || 'medium',
    operatingCostClass: config.operatingCostClass || 'medium',
    spaceRequirement: config.spaceRequirement || 'unknown',
    advantages: config.advantages || [],
    limitations: config.limitations || [],
    warnings: warnings,
    assumptions: assumptions,
    requiredInputs: requiredInputs,
    validationResults: {
      capacitySuitability: Math.round(capacitySuitability),
      airflowSuitability: Math.round(airflowSuitability),
      ventilationSuitability: Math.round(ventilationSuitability),
      equipmentAvailability: Math.round(equipmentAvailability)
    },
    confidenceScore: confidence,
    recommendationScore: Math.max(0, Math.min(100, score)),
    selectedByUser: false
  };
}

function generateHvacDesignScenarios(projectInput){
  var input = Object.assign(buildHvacScenarioProjectInput(), projectInput || {});
  var scenarios = [];
  if(input.requiredCapacityBtuH <= 0){
    return [];
  }
  var splitSelection = selectScenarioEquipmentOption('split', input.requiredCapacityBtuH, input.requiredAirflowCfm, {
    roomCount: input.roomCount,
    minQty: Math.max(1, input.roomCount || 1),
    maxQty: Math.max(3, input.roomCount + 1, 6),
    preferredQty: Math.max(1, input.roomCount || 1),
    maxOversizePct: 10,
    hardOversizePct: 25,
    refRoomBtu: input.peakCoolingLoadBtuH,
    refRoomCfm: input.requiredAirflowCfm && input.roomCount ? Math.ceil(input.requiredAirflowCfm / input.roomCount) : input.requiredAirflowCfm
  });
  var splitQty = splitSelection ? splitSelection.quantity : 0;
  if(splitSelection && splitQty <= Math.max(3, input.roomCount + 1, 6)){
    scenarios.push(makeHvacScenario(input, {
      scenarioId: 'scenario_multiple_split',
      scenarioType: 'decentralized',
      title: lang==='ar' ? 'وحدات سبليت متعددة' : 'Multiple Split Units',
      categoryLabel: lang==='ar' ? 'أقل تعقيد أولي' : 'Lowest Initial Complexity',
      description: lang==='ar' ? 'حل لا مركزي مناسب للمشاريع الصغيرة والمتوسطة مع تحكم مستقل لكل منطقة.' : 'Decentralized option for small to medium projects with independent zone control.',
      architecture: input.outdoorAirCfm > 0 ? 'Split Units + Dedicated Fresh Air System' : 'Multiple Split Units',
      systemComponents: input.outdoorAirCfm > 0 ? ['Split indoor/outdoor units', 'Dedicated Fresh Air System'] : ['Split indoor/outdoor units'],
      selections: [splitSelection],
      roomAssignments: input.rooms.map(function(room){ return { roomIndex: room.index, strategy: 'One indoor unit per room or small zone as required.' }; }),
      zoningStrategy: 'Independent room or small-zone control.',
      freshAirSolution: input.outdoorAirCfm > 0 ? 'Dedicated Fresh Air System required; split units are not assumed to provide outdoor air.' : 'Fresh Air requirement not defined in current inputs.',
      controlStrategy: 'Local independent thermostats.',
      estimatedComplexity: 'low',
      estimatedMaintainability: 'medium',
      energySuitability: 'medium',
      initialCostClass: 'low',
      operatingCostClass: 'medium',
      spaceRequirement: 'low',
      zoningScore: 92,
      maintainabilityScore: 68,
      energyScore: 66,
      requiresDedicatedFreshAir: input.outdoorAirCfm > 0,
      advantages: ['Simple installation path.', 'Independent control by room or zone.', 'Low central plant dependency.'],
      limitations: ['Higher outdoor-unit count.', 'Fresh Air requires a separate solution when applicable.', 'Not ideal for strict healthcare pressure control.'],
      warnings: input.hasHealthcare ? ['Healthcare rooms may require pressure, filtration, and outdoor air controls beyond split units.'] : [],
      assumptions: ['Outdoor unit locations are available.']
    }));
  }

  var packageSelection = selectScenarioEquipmentOption('package', input.requiredCapacityBtuH, input.requiredAirflowCfm, { roomCount: 1, maxQty: 2, preferredQty: 1, maxOversizePct: 10, hardOversizePct: 25 });
  var ductedSelection = selectScenarioEquipmentOption('ducted', input.requiredCapacityBtuH, input.requiredAirflowCfm, { roomCount: input.roomCount, maxQty: Math.max(2, Math.ceil(input.roomCount / 2) || 2), preferredQty: input.roomCount > 2 ? 2 : 1, maxOversizePct: 10, hardOversizePct: 25 });
  if(packageSelection){
    scenarios.push(makeHvacScenario(input, {
      scenarioId: 'scenario_package_ducted',
      scenarioType: 'semi_centralized',
      title: lang==='ar' ? 'حل باكيج / دكت مركزي' : 'Package / Ducted Solution',
      categoryLabel: lang==='ar' ? 'خيار متوازن' : 'Recommended based on current project inputs',
      description: lang==='ar' ? 'حل شبه مركزي يقلل عدد الوحدات ويحتاج مسار دكت وتحقق ESP.' : 'Semi-centralized option that reduces equipment count and requires duct/ESP confirmation.',
      architecture: 'Package Unit(s) + Duct Distribution',
      systemComponents: ['Package unit(s)', 'Supply/return ductwork', 'Fresh Air connection if required'],
      selections: [packageSelection],
      zoningStrategy: 'Zoning by duct branches or multiple units.',
      freshAirSolution: input.outdoorAirCfm > 0 ? 'Fresh Air can be ducted to the system after engineer verification.' : 'Fresh Air requirement not defined in current inputs.',
      controlStrategy: 'Central thermostat or zone controls if dampers are added.',
      estimatedComplexity: 'medium',
      estimatedMaintainability: 'medium',
      energySuitability: 'medium',
      initialCostClass: 'medium',
      operatingCostClass: 'medium',
      spaceRequirement: 'ceiling/duct space required',
      zoningScore: 72,
      maintainabilityScore: 72,
      energyScore: 70,
      needsDuctSpace: true,
      advantages: ['Lower equipment count than many split units.', 'Ducted Fresh Air integration is possible.', 'Cleaner indoor appearance.'],
      limitations: ['Requires duct routes and return air path.', 'ESP must be confirmed against catalogue data.', 'A single unit outage can affect multiple rooms.'],
      requiredInputs: ['Confirm duct route and ceiling/service space.']
    }));
  }
  if(ductedSelection){
    scenarios.push(makeHvacScenario(input, {
      scenarioId: 'scenario_multiple_ducted',
      scenarioType: 'semi_centralized',
      title: lang==='ar' ? 'وحدات دكت متعددة' : 'Multiple Ducted Units',
      categoryLabel: lang==='ar' ? 'مرونة توزيع متوازنة' : 'Balanced Ducted Zoning',
      description: lang==='ar' ? 'حل دكت متعدد يعطي مرونة أفضل من وحدة واحدة ويحتاج تحقق مسارات الهواء والـ ESP.' : 'Multiple ducted units improve zoning flexibility while requiring duct routing and ESP confirmation.',
      architecture: 'Multiple Ducted Units + Duct Distribution',
      systemComponents: ['Ducted indoor units', 'Supply/return ductwork', 'Fresh Air connection if required'],
      selections: [ductedSelection],
      zoningStrategy: 'Zoning by multiple ducted units and duct branches.',
      freshAirSolution: input.outdoorAirCfm > 0 ? 'Fresh Air can be ducted to each system after engineer verification.' : 'Fresh Air requirement not defined in current inputs.',
      controlStrategy: 'Zone thermostats per ducted unit or damper zoning if added.',
      estimatedComplexity: 'medium',
      estimatedMaintainability: 'medium',
      energySuitability: 'medium',
      initialCostClass: 'medium',
      operatingCostClass: 'medium',
      spaceRequirement: 'ceiling/duct space required',
      zoningScore: 82,
      maintainabilityScore: 74,
      energyScore: 72,
      needsDuctSpace: true,
      advantages: ['Better zoning than one large package unit.', 'Lower equipment count than many split units.', 'Fresh Air integration is possible.'],
      limitations: ['Requires duct routes and return air path.', 'ESP must be confirmed against catalogue data.', 'More coordination than split units.'],
      requiredInputs: ['Confirm duct route and ceiling/service space.']
    }));
  }

  if(input.roomCount > 1 && input.requiredCapacityBtuH >= 36000){
    var vrfSelection = selectScenarioEquipmentOption('vrf', input.requiredCapacityBtuH, input.requiredAirflowCfm, { roomCount: input.roomCount, maxQty: Math.max(2, Math.ceil(input.roomCount / 3) || 2), preferredQty: 1, maxOversizePct: 10, hardOversizePct: 25 });
    if(vrfSelection){
      scenarios.push(makeHvacScenario(input, {
        scenarioId: 'scenario_vrf',
        scenarioType: 'semi_centralized',
        title: lang==='ar' ? 'نظام VRF متعدد المناطق' : 'VRF Multi-Zone System',
        categoryLabel: lang==='ar' ? 'مرونة تقسيم عالية' : 'Best Zoning Flexibility',
        description: lang==='ar' ? 'سيناريو متعدد المناطق يحتاج تحقق الشركة المصنعة لمسارات المواسير والهواء الخارجي.' : 'Multi-zone scenario requiring manufacturer verification for piping and ventilation.',
        architecture: 'VRF Outdoor Unit(s) + Indoor Units + Dedicated Fresh Air if required',
        systemComponents: ['VRF outdoor unit(s)', 'Indoor units', 'Branch selectors/headers if required', 'Dedicated Fresh Air if required'],
        selections: [vrfSelection],
        zoningStrategy: 'High zoning flexibility by indoor unit.',
        freshAirSolution: input.outdoorAirCfm > 0 ? 'Dedicated Fresh Air system required; VRF is not assumed to provide outdoor air.' : 'Fresh Air requirement not defined in current inputs.',
        controlStrategy: 'Room/zone controllers with central supervision optional.',
        estimatedComplexity: 'medium-high',
        estimatedMaintainability: 'medium',
        energySuitability: 'high',
        initialCostClass: 'high',
        operatingCostClass: 'low',
        spaceRequirement: 'moderate outdoor and refrigerant piping routes',
        zoningScore: 94,
        maintainabilityScore: 70,
        energyScore: 86,
        advantages: ['Strong zoning flexibility.', 'Good part-load energy potential.', 'Lower indoor duct requirement.'],
        limitations: ['Manufacturer piping limits must be checked.', 'Fresh Air is separate when required.', 'Healthcare refrigerant risk and code limits require review.'],
        warnings: input.hasHealthcare ? ['Healthcare use requires refrigerant safety and ventilation review before adopting VRF.'] : ['Manufacturer design verification required.'],
        requiredInputs: ['Confirm piping distances and manufacturer selection.']
      }));
    }
  }

  if(input.requiredCapacityBtuH >= 60000 || input.existingChilledWater){
    var chillerSelection = input.existingChilledWater ? null : selectScenarioEquipmentOption('chiller_air', input.requiredCapacityBtuH, 0, { roomCount: 1 });
    var ahuSelection = selectScenarioEquipmentOption('ahu', 0, input.requiredAirflowCfm, { roomCount: 1 });
    if(input.existingChilledWater || chillerSelection || ahuSelection){
      scenarios.push(makeHvacScenario(input, {
        scenarioId: input.existingChilledWater ? 'scenario_existing_chw_ahu_fcu' : 'scenario_air_chiller_ahu_fcu',
        scenarioType: 'centralized',
        title: input.existingChilledWater ? (lang==='ar' ? 'مياه مبردة قائمة + AHU/FCU' : 'Existing Chilled Water + AHU/FCU') : (lang==='ar' ? 'تشيلر هواء + AHU/FCU' : 'Air-Cooled Chiller + AHU/FCU'),
        categoryLabel: lang==='ar' ? 'خيار مركزي قابل للتوسع' : 'Centralized Option',
        description: lang==='ar' ? 'حل مركزي لا يعرض AHU أو Chiller كوحدة مستقلة، بل كنظام كامل يحتاج مساحة وخدمات.' : 'Centralized system option with defined cooling source and air/water-side distribution.',
        architecture: input.existingChilledWater ? 'Existing Chilled Water + AHU/FCU Distribution' : 'Air-Cooled Chiller + AHU/FCU Distribution',
        coolingSource: input.existingChilledWater ? 'existing chilled water' : 'air-cooled chiller',
        systemComponents: input.existingChilledWater ? ['Existing chilled-water connection', 'AHU/FCU distribution', 'Pumps/control valves as required'] : ['Air-cooled chiller', 'AHU/FCU distribution', 'Pumps/control valves as required'],
        selections: [chillerSelection, ahuSelection].filter(Boolean),
        zoningStrategy: 'Zones by AHU/FCU arrangement and controls.',
        freshAirSolution: 'AHU/DOAS path can handle Fresh Air after coil and ventilation verification.',
        controlStrategy: 'Central plant controls with zone-level terminal controls.',
        estimatedComplexity: 'high',
        estimatedMaintainability: 'high',
        energySuitability: 'high',
        initialCostClass: 'high',
        operatingCostClass: 'medium-low',
        spaceRequirement: 'plant/service space required',
        zoningScore: 82,
        maintainabilityScore: 84,
        energyScore: 82,
        needsDuctSpace: true,
        advantages: ['Scalable central architecture.', 'Better path for ventilation, filtration, and pressure control.', 'Suitable for larger or healthcare-sensitive projects after review.'],
        limitations: ['Requires plant/service space.', 'Higher design and commissioning complexity.', 'Coil selection requires manufacturer submittal.'],
        warnings: ['Coil selection requires manufacturer submittal.', 'Pump and chilled-water flow design are preliminary until hydronic data is available.'],
        requiredInputs: input.existingChilledWater ? ['Confirm existing chilled-water capacity and connection conditions.'] : ['Confirm plant space and outdoor chiller location.']
      }));
    }
  }

  scenarios = scenarios.filter(function(item){
    if(item.scenarioId === 'scenario_air_chiller_ahu_fcu' && input.requiredCapacityBtuH < 60000 && !input.existingChilledWater) return false;
    if(item.scenarioType === 'semi_centralized' && input.ductSpaceAvailable === false) return false;
    if(item.scenarioType === 'centralized' && input.plantRoomAvailable === false && !input.existingChilledWater) return false;
    return true;
  });
  return rankProjectLevelDesignScenarios(scenarios, 3);
}

function getCurrentHvacDesignScenarios(){
  return generateHvacDesignScenarios();
}

function renderScenarioEquipmentLabel(selection){
  if(!selection) return lang==='ar' ? 'سعة قياسية تحتاج تأكيد' : 'Standard capacity pending';
  var unitBtu = Number(selection.standardUnitCapacityBtuH || selection.unitCapacityBtuH || 0);
  if(selection.unitType === 'ahu' && !unitBtu){
    return (lang==='ar' ? 'AHU تصميمي' : 'Conceptual AHU') + ' - ' + Number(selection.estimatedInstalledAirflowCfm || selection.totalAirflowCfm || 0).toLocaleString() + ' CFM';
  }
  return selection.quantity + ' x ' + Number(unitBtu).toLocaleString() + ' BTU/h = ' + Number(selection.totalCapacityBtuH || selection.totalInstalledCapacityBtuH || 0).toLocaleString() + ' BTU/h';
}

function renderHvacDesignScenarioDetails(scenario){
  var rows = [
    ['System concept', scenario.architecture],
    ['Standard capacity configuration', (scenario.equipmentSelections || []).map(renderScenarioEquipmentLabel).join(' / ') || 'Conceptual scenario - equipment selection pending'],
    ['Required capacity', Number(scenario.requiredCapacityBtuH || 0).toLocaleString() + ' BTU/h'],
    ['Proposed standard capacity', Number(scenario.conceptualCapacityBtuH || scenario.installedCapacityBtuH || 0).toLocaleString() + ' BTU/h'],
    ['Capacity difference', (scenario.capacityDifferenceBtuH >= 0 ? '+' : '') + Number(scenario.capacityDifferenceBtuH || 0).toLocaleString() + ' BTU/h'],
    ['Oversizing', scenario.oversizingPercent == null ? '—' : ((scenario.oversizingPercent >= 0 ? '+' : '') + scenario.oversizingPercent + '%')],
    ['Airflow', Number(scenario.estimatedInstalledAirflowCfm || scenario.installedAirflowCfm || 0).toLocaleString() + ' / ' + Number(scenario.requiredAirflowCfm || 0).toLocaleString() + ' CFM'],
    ['Ventilation', scenario.ventilationStrategy],
    ['Zoning', scenario.zoningStrategy],
    ['Controls', scenario.controlStrategy],
    ['Advantages', (scenario.advantages || []).join(' • ')],
    ['Limitations', (scenario.limitations || []).join(' • ')],
    ['Warnings', (scenario.warnings || []).join(' • ') || '—'],
    ['Assumptions', (scenario.assumptions || []).join(' • ') || '—'],
    ['Required confirmations', (scenario.requiredInputs || []).join(' • ') || '—']
  ];
  return '<div class="scenario-details-grid">'+rows.map(function(row){
    return '<div class="scenario-detail-row"><span>'+esc(row[0])+'</span><strong>'+esc(row[1] || '—')+'</strong></div>';
  }).join('')+'</div>';
}

function renderSelectedScenarioManufacturerStep(){
  if(!selectedHvacDesignScenario || !selectedHvacDesignScenario.selectedByUser) return '';
  var isAr = lang === 'ar';
  var standardText = (selectedHvacDesignScenario.standardCapacities || []).map(function(item){
    return item.quantity + ' x ' + Number(item.standardUnitCapacityBtuH || 0).toLocaleString() + ' BTU/h';
  }).join(' / ');
  return '<div class="scenario-manufacturer-step">'+
    '<div><span>'+(isAr?'المرحلة التالية':'Next Step')+'</span><strong>'+(isAr?'اختيار معدات الشركة المصنعة':'Select Manufacturer Equipment')+'</strong></div>'+
    '<p>'+(isAr?'تم حفظ السيناريو كسعة قياسية مفاهيمية. اختر الآن موديل الشركة من حقل السعة في وحدات المشروع لإنشاء Equipment Snapshot النهائي.':'The scenario is saved as a conceptual standard-capacity option. Choose the manufacturer model from the project unit capacity field to create the final Equipment Snapshot.')+'</p>'+
    '<em>'+(isAr?'السعات القياسية المختارة: ':'Selected standard capacities: ')+esc(standardText || '—')+'</em>'+
  '</div>';
}

function renderScenarioDecisionFacts(scenario){
  var ar=lang==='ar';
  var levels={low:ar?'منخفضة':'Low',medium:ar?'متوسطة':'Medium',high:ar?'مرتفعة':'High'};
  var complexity={low:ar?'منخفض':'Low',medium:ar?'متوسط':'Medium',high:ar?'مرتفع':'High'};
  var unknown=ar?'غير محدد':'Not specified';
  var types=(scenario.equipmentSelections || []).map(function(s){return s.unitType;});
  var split=types.indexOf('split')>=0;
  var plant=types.some(function(t){return t==='chiller_air' || t==='chiller_water' || t==='ahu' || t==='fcu';});
  var rows=[
    [ar?'التكلفة الأولية النسبية':'Relative initial cost',levels[scenario.initialCostClass] || unknown],
    [ar?'تعقيد التنفيذ':'Installation complexity',complexity[scenario.estimatedComplexity] || unknown],
    [ar?'ما يلزم مراجعته':'Key design checks',split?(ar?'مواقع الوحدات الخارجية ومسارات النحاس والتصريف؛ تأمين الهواء الخارجي بشكل مستقل.':'Outdoor unit locations, refrigerant and drain routes; separate outdoor-air provision.'):(plant?(ar?'مصدر التبريد ومساحة الخدمات وشبكة المياه والتحكم وتوزيع الهواء.':'Cooling source, service space, water network, controls and air distribution.'):(ar?'مسارات الدكت والضغط الاستاتيكي والكهرباء ومواقع الصيانة.':'Duct routes, static pressure, electrical supply and maintenance access.'))]
  ];
  return '<dl class="scenario-decision-facts" style="margin:12px 0;font-size:12px;line-height:1.65">'+rows.map(function(row){return '<div style="padding:5px 0;border-top:1px solid #e4eaf0"><dt style="font-weight:600">'+esc(row[0])+'</dt><dd style="margin:0">'+esc(row[1])+'</dd></div>';}).join('')+'</dl><p class="scenario-estimate-note" style="font-size:11px">'+(ar?'التكلفة والتعقيد تقديران مقارنان لطبيعة النظام، وليسا عرض سعر أو حسابًا لاستهلاك الطاقة. الثقة مؤشر داخلي لترتيب الخيارات وليست اعتمادًا هندسيًا.':'Cost and complexity are comparative system estimates, not a quotation or energy calculation. Confidence is an internal ranking indicator, not engineering approval.')+'</p>';
}

function renderHepaFilterReference(){
  var ar=lang==='ar';
  var items=[
    ['AAF','AstroCel II','H14','https://www.aafintl.com/us/products/high-purity-%28hepa%29-filtration/hepa-ulpa-panel-filters/astrocel--ii',ar?'وجود محلي: AAF السعودية؛ توفر الموديل والمقاس يحتاج تأكيد المورد.':'Local presence: AAF Saudi Arabia; confirm model and size availability.'],
    ['Camfil','Megalam ProSafe','H13 / H14','https://www.camfil.com/en-ie/products/epa-hepa--ulpa-filters/cleanroom-panels/megalam/megalam-prosafe-_-32426',ar?'سلسلة كتالوجية؛ يلزم تأكيد المورد المعتمد والتوفر في السعودية.':'Catalogue family; authorized Saudi supplier and availability require confirmation.']
  ];
  return '<section class="tech-doc-section report-hepa-reference"><h3>'+(ar?'فلاتر HEPA — مرجع الاختيار':'HEPA filters — selection reference')+'</h3><p>'+(ar?'تصنيف HEPA وفق EN 1822 / ISO 29463، وليس شهادة اعتماد ASHRAE للشركة. متطلبات ASHRAE 170 تعتمد على نوع الغرفة وإصدار المعيار المعتمد؛ لا تحتاج كل الغرف إلى HEPA.':'HEPA classification follows EN 1822 / ISO 29463, not an ASHRAE manufacturer certification. ASHRAE 170 requirements depend on room use and the adopted edition; HEPA is not required for every room.')+'</p><div class="tech-doc-table-wrap"><table class="tech-doc-table"><thead><tr>'+[ar?'الشركة والسلسلة':'Manufacturer / family',ar?'الفئة':'Class',ar?'التوريد':'Supply status'].map(function(x){return '<th>'+x+'</th>';}).join('')+'</tr></thead><tbody>'+items.map(function(x){return '<tr><td><a href="'+x[3]+'" target="_blank" rel="noopener noreferrer">'+x[0]+' — '+x[1]+'</a></td><td dir="ltr">'+x[2]+'</td><td>'+x[4]+'</td></tr>';}).join('')+'</tbody></table></div><p>'+(ar?'قبل الاعتماد: شهادة اختبار لكل فلتر، المقاس وتدفق الهواء التصميمي، فقد الضغط الابتدائي والنهائي، قدرة المروحة، إحكام الحاوية واختبار التسرب بعد التركيب. لا تُضاف مقاومة افتراضية للحسابات دون منحنى الموديل.':'Before approval: individual test certificate, dimensions and design airflow, initial/final pressure drop, fan capacity, housing seals and installed leakage testing. No assumed resistance is added to calculations without model data.')+'</p><p><a href="https://handbook.ashrae.org/Handbooks/S24/IP/s24_ch29/s24_ch29_ip.aspx" target="_blank" rel="noopener noreferrer">ASHRAE — Air cleaners</a> · <a href="https://aafimea.com/contact-us/" target="_blank" rel="noopener noreferrer">AAF — Saudi office</a></p></section>';
}

function renderHvacDesignScenariosPanel(){
  var scenarios = getCurrentHvacDesignScenarios();
  var isAr = lang === 'ar';
  if(!scenarios.length){
    return '<section class="design-scenarios-panel"><div class="design-scenarios-head"><div><span>HVAC Design Options</span><strong>'+(isAr?'سيناريوهات التصميم':'Design Scenarios')+'</strong></div></div><div class="scenario-empty">'+(isAr?'احسب حمل المشروع أولاً لعرض سيناريوهات تصميم قابلة للمقارنة.':'Run project load calculations first to show comparable design scenarios.')+'</div></section>';
  }
  var cards = scenarios.map(function(scenario, idx){
    var selected = selectedHvacDesignScenario && selectedHvacDesignScenario.scenarioId === scenario.scenarioId ? ' selected' : '';
    var equipmentText = (scenario.equipmentSelections || []).map(renderScenarioEquipmentLabel).join(' / ') || (isAr?'اختيار المعدات لاحقًا':'Equipment selection pending');
    return '<article class="scenario-card'+selected+'" data-scenario-id="'+esc(scenario.scenarioId)+'">'+
      '<div class="scenario-card-head"><span>'+(isAr?'السيناريو ':'Scenario ')+String.fromCharCode(65 + idx)+'</span><strong>'+esc(scenario.title)+'</strong></div>'+
      '<p>'+esc(scenario.description)+'</p>'+
      '<div class="scenario-kpis">'+
        '<div><span>'+(isAr?'السعة القياسية':'Standard Capacity')+'</span><strong>'+Number(scenario.conceptualCapacityBtuH || scenario.installedCapacityBtuH || 0).toLocaleString()+'</strong></div>'+
        '<div><span>'+(isAr?'نسبة الزيادة':'Oversizing')+'</span><strong>'+(scenario.oversizingPercent == null ? '—' : ((scenario.oversizingPercent >= 0 ? '+' : '') + scenario.oversizingPercent + '%'))+'</strong></div>'+
        '<div><span>CFM</span><strong>'+Number(scenario.estimatedInstalledAirflowCfm || scenario.installedAirflowCfm || 0).toLocaleString()+'</strong></div>'+
        '<div><span>'+(isAr?'الثقة':'Confidence')+'</span><strong>'+scenario.confidenceScore+'/100</strong></div>'+
      '</div>'+
      '<div class="scenario-equipment">'+esc(equipmentText)+'</div>'+
      '<div class="scenario-pending-note">'+(isAr?'اختيار الشركة والموديل يتم بعد اعتماد هذا السيناريو.':'Manufacturer equipment selection happens after this scenario is approved.')+'</div>'+
      '<div class="scenario-tags"><span>'+(isAr?'التكلفة الأولية: ':'Initial cost: ')+esc(({low:isAr?'منخفضة':'Low',medium:isAr?'متوسطة':'Medium',high:isAr?'مرتفعة':'High'})[scenario.initialCostClass] || '—')+'</span></div>'+
      '<details class="scenario-details"><summary>'+(isAr?'المتطلبات والتفاصيل':'Requirements and details')+'</summary>'+renderScenarioDecisionFacts(scenario)+renderHvacDesignScenarioDetails(scenario)+'</details>'+
      '<div class="scenario-actions"><button type="button" onclick="compareHvacDesignScenario(\''+esc(scenario.scenarioId)+'\')">'+(isAr?'قارن':'Compare')+'</button><button type="button" class="primary" onclick="selectHvacDesignScenario(\''+esc(scenario.scenarioId)+'\')">'+(isAr?'اختر هذا السيناريو':'Select This Scenario')+'</button></div>'+
    '</article>';
  }).join('');
  return '<section class="design-scenarios-panel">'+
    '<div class="design-scenarios-head"><div><span>'+(isAr?'خيارات أنظمة التكييف':'HVAC MULTI-SCENARIO DESIGN OPTIONS')+'</span><strong>'+(isAr?'سيناريوهات التصميم':'Design Scenarios')+'</strong></div><p>'+(isAr?'الخيارات مرتبة حسب مدخلات المشروع الحالية، والقرار النهائي للمهندس.':'Options are ranked from current project inputs; final selection remains with the engineer.')+'</p></div>'+
    '<div class="scenario-card-grid">'+cards+'</div>'+
    renderSelectedScenarioManufacturerStep()+
    '<div id="scenario-compare-slot" class="scenario-compare-slot"></div>'+
  '</section>';
}

function compareHvacDesignScenario(scenarioId){
  var scenarios = getCurrentHvacDesignScenarios();
  var selected = scenarios.filter(function(item){ return item.scenarioId === scenarioId; })[0] || null;
  var host = G('scenario-compare-slot');
  if(!host || !selected) return;
  host.innerHTML = '<div class="scenario-compare-box"><strong>'+(lang==='ar'?'مقارنة مع السيناريو الحالي':'Compare with Current Scenario')+'</strong>'+
    '<p>'+esc(selected.title)+' - '+esc(selected.architecture)+'</p>'+
    '<div class="scenario-kpis"><div><span>Proposed standard capacity</span><strong>'+Number(selected.conceptualCapacityBtuH || selected.installedCapacityBtuH || 0).toLocaleString()+' BTU/h</strong></div><div><span>Airflow</span><strong>'+Number(selected.estimatedInstalledAirflowCfm || selected.installedAirflowCfm || 0).toLocaleString()+' CFM</strong></div><div><span>Score</span><strong>'+selected.recommendationScore+'/100</strong></div></div>'+
    '<p>'+esc((selected.warnings || []).join(' • ') || (lang==='ar'?'لا توجد تحذيرات رئيسية.':'No major warnings.'))+'</p></div>';
}

function selectHvacDesignScenario(scenarioId){
  var scenarios = getCurrentHvacDesignScenarios();
  var scenario = scenarios.filter(function(item){ return item.scenarioId === scenarioId; })[0] || null;
  if(!scenario) return false;
  var summary = (lang==='ar' ? 'سيتم حفظ السيناريو المفاهيمي التالي على وحدات المشروع فقط، ولن يتم اختيار شركة أو موديل الآن:\n\n' : 'This will save the following conceptual scenario to project systems only. No manufacturer or model will be selected yet:\n\n') +
    scenario.title + '\n' +
    scenario.architecture + '\n' +
    (scenario.equipmentSelections || []).map(renderScenarioEquipmentLabel).join('\n') + '\n\n' +
    ((scenario.warnings || []).length ? (lang==='ar'?'تحذيرات: ':'Warnings: ') + scenario.warnings.join(' | ') : '');
  if(window.confirm && !window.confirm(summary)) return false;
  var previous = selectedHvacDesignScenario ? JSON.parse(JSON.stringify(selectedHvacDesignScenario)) : null;
  projectSystems = (scenario.equipmentSelections || []).map(function(selection, idx){
    var system = normalizeProjectSystem({
      id: createQuoteSystemId(),
      unitType: selection.unitType,
      selectedBtu: selection.unitCapacityBtuH,
      qty: selection.quantity,
      equipmentId: '',
      equipmentDatabaseId: '',
      equipmentSnapshot: null,
      selectedEquipmentOption: null,
      manualCapacity: true,
      manualCapacityBtuH: selection.unitCapacityBtuH,
      selectionMode: 'conceptual',
      equipmentReviewStatus: 'equipment_pending',
      scenarioStatus: 'Equipment Pending',
      selectedEquipmentId: '',
      selectedManufacturer: '',
      selectedModel: '',
      selectedCapacityBtuH: selection.unitCapacityBtuH,
      selectedCapacityTr: selection.unitCapacityBtuH / 12000,
      selectedAirflowCfm: selection.unitAirflowCfm,
      selectedQuantity: selection.quantity,
      totalInstalledCapacityBtuH: selection.totalCapacityBtuH,
      totalInstalledAirflowCfm: selection.totalAirflowCfm,
      conceptualCapacityBtuH: selection.totalCapacityBtuH,
      finalEquipmentCapacityBtuH: 0,
      conceptualScenarioSnapshot: {
        selectedScenarioId: scenario.scenarioId,
        scenarioType: scenario.scenarioType,
        systemArchitecture: scenario.architecture,
        standardUnitCapacityBtuH: selection.standardUnitCapacityBtuH || selection.unitCapacityBtuH,
        quantity: selection.quantity,
        totalInstalledCapacityBtuH: selection.totalCapacityBtuH,
        requiredCapacityBtuH: scenario.requiredCapacityBtuH,
        capacityDifferenceBtuH: selection.capacityDifferenceBtuH,
        oversizingPercent: selection.oversizingPercent,
        requiredAirflowCfm: scenario.requiredAirflowCfm,
        estimatedInstalledAirflowCfm: selection.totalAirflowCfm,
        zoning: scenario.zoningStrategy,
        airflow: scenario.ventilationStrategy,
        assumptions: scenario.assumptions || [],
        warnings: scenario.warnings || []
      },
      automaticSelectionReason: 'Conceptual scenario selected - equipment selection pending'
    });
    system.scenarioComponentIndex = idx;
    return system;
  });
  selectedHvacDesignScenario = JSON.parse(JSON.stringify(scenario));
  selectedHvacDesignScenario.selectedByUser = true;
  selectedHvacDesignScenario.scenarioStatus = 'Equipment Pending';
  selectedHvacDesignScenario.conceptualScenarioSnapshot = {
    selectedScenarioId: scenario.scenarioId,
    scenarioType: scenario.scenarioType,
    standardCapacities: scenario.standardCapacities || [],
    quantities: (scenario.standardCapacities || []).map(function(item){ return item.quantity; }),
    totalInstalledCapacity: scenario.conceptualCapacityBtuH || scenario.installedCapacityBtuH,
    zoning: scenario.zoningStrategy,
    airflow: scenario.ventilationStrategy,
    assumptions: scenario.assumptions || [],
    warnings: scenario.warnings || []
  };
  selectedHvacDesignScenario.selectedAt = new Date().toISOString();
  selectedHvacDesignScenario.previousScenario = previous ? {
    scenarioId: previous.scenarioId,
    title: previous.title,
    selectedAt: previous.selectedAt || ''
  } : null;
  saveProjectSystems();
  saveSelectedHvacScenario();
  recalcProjectSystems();
  if(window.toast) window.toast(lang==='ar' ? 'تم حفظ السيناريو. اختر الشركة والموديل في خطوة المعدات.' : 'Scenario saved. Select manufacturer equipment in the equipment step.');
  return true;
}

function getBestProjectSystemAutoSelection(system, opts){
  system = normalizeProjectSystem(system || {});
  opts = opts || {};
  var unitType = getAllowedSystemType(opts.unitType || system.unitType || 'split');
  var totalRequiredBtu = Math.max(0, parseInt(opts.totalRequiredBtu, 10) || 0);
  var totalRequiredCfm = Math.max(0, parseInt(opts.totalRequiredCfm, 10) || 0);
  var refRoomBtu = Math.max(0, parseInt(opts.refRoomBtu, 10) || 0);
  var refRoomCfm = Math.max(0, parseInt(opts.refRoomCfm, 10) || 0);
  var roomCount = Math.max(1, parseInt(opts.roomCount, 10) || 1);
  var perRoom = isPerRoomUnitType(unitType);
  var targetBtu = perRoom ? (refRoomBtu || totalRequiredBtu) : totalRequiredBtu;
  var targetCfm = perRoom ? (refRoomCfm || totalRequiredCfm) : totalRequiredCfm;
  var baseQty = perRoom ? roomCount : 1;
  var cat = (getCatalog(unitType) || []).map(function(entry){
    var btu = Math.max(0, parseInt(entry && entry.btu, 10) || 0);
    var cfm = Math.max(0, parseInt(entry && entry.cfm, 10) || 0);
    return { btu: btu, cfm: cfm };
  }).filter(function(entry){
    return entry.btu > 0;
  }).sort(function(a,b){
    if(a.btu !== b.btu) return a.btu - b.btu;
    return a.cfm - b.cfm;
  });

  if(targetBtu <= 0 && targetCfm <= 0){
    var current = getCatalogEntryByBtu(unitType, system.selectedBtu) ? toSystemBtu(system.selectedBtu) : 0;
    var fallback = current || defaultCapForUT(unitType, 0, 0);
    return {
      qty: Math.max(1, parseInt(system.qty, 10) || baseQty || 1),
      selectedBtu: fallback,
      reason: buildAutoQtyReason(perRoom ? 'room-count' : 'central-match')
    };
  }

  if(!cat.length){
    return getAutoUnitDecision(unitType, targetBtu, targetCfm, baseQty, 0, refRoomBtu, refRoomCfm);
  }

  var cfmPerTr = getCurrentCfmPerTr();
  var best = null;
  cat.forEach(function(entry){
    var entryCfm = entry.cfm || Math.round((entry.btu / 12000) * cfmPerTr);
    var qtyByBtu = targetBtu > 0 ? Math.ceil(targetBtu / Math.max(1, entry.btu)) : baseQty;
    var qtyByCfm = targetCfm > 0 ? Math.ceil(targetCfm / Math.max(1, entryCfm)) : baseQty;
    var cfmDrivenType = unitType === 'ahu' || unitType === 'fcu';
    var minQty = Math.max(1, baseQty, qtyByBtu, cfmDrivenType ? qtyByCfm : 1);
    [minQty, minQty + 1].forEach(function(qty){
      var totalBtu = entry.btu * qty;
      var totalCfm = entryCfm * qty;
      var btuDeltaPct = targetBtu > 0 ? ((totalBtu - targetBtu) / targetBtu) * 100 : 0;
      var cfmDeltaPct = targetCfm > 0 ? ((totalCfm - targetCfm) / targetCfm) * 100 : 0;
      var undersizedBtu = targetBtu > 0 && totalBtu < targetBtu;
      var undersizedCfm = targetCfm > 0 && totalCfm < targetCfm;
      var oversizePenalty = btuDeltaPct <= 15 ? Math.max(0, btuDeltaPct) * 2 : 30 + ((btuDeltaPct - 15) * 9);
      var cfmPenalty = cfmDeltaPct <= 35 ? Math.max(0, cfmDeltaPct) * 0.5 : 17.5 + ((cfmDeltaPct - 35) * 3);
      var score = 0;
      if(undersizedBtu) score += 10000 + Math.abs(btuDeltaPct) * 100;
      else score += oversizePenalty;
      if(undersizedCfm) score += cfmDrivenType ? (3000 + Math.abs(cfmDeltaPct) * 30) : (Math.abs(cfmDeltaPct) * 0.35);
      else score += cfmPenalty;
      score += qty * 4;
      score += entry.btu / 100000;
      var candidate = {
        selectedBtu: entry.btu,
        qty: qty,
        totalBtu: totalBtu,
        totalCfm: totalCfm,
        btuDeltaPct: btuDeltaPct,
        cfmDeltaPct: cfmDeltaPct,
        score: score
      };
      if(!best || candidate.score < best.score) best = candidate;
    });
  });

  if(!best) return null;
  best.reason = perRoom
    ? buildAutoQtyReason('room-count')
    : (best.qty > 1 ? buildAutoQtyReason('capacity-limit') : buildAutoQtyReason('single-central'));
  return best;
}

function getProjectSystemCapacityDropdownOptions(system){
  system = normalizeProjectSystem(system);
  var rows = [];
  var records = [];
  try{
    records = window.AppEquipmentDatabase && typeof window.AppEquipmentDatabase.allRecords === 'function'
      ? window.AppEquipmentDatabase.allRecords()
      : [];
  }catch(error){
    records = [];
  }
  records.filter(function(record){
    if(!record || record.discontinued) return false;
    if(!isProjectSystemEquipmentRecordCompatible(system.unitType, record)) return false;
    if(record.equipmentType === 'ahu') return !!(record.id && (record.airflowNominalCfm || record.airflowMaxCfm || record.airflowMinCfm));
    return !!(record.id && record.coolingCapacityBtuH);
  }).sort(function(a,b){
    var ma = String(a.manufacturerName || a.brand || '');
    var mb = String(b.manufacturerName || b.brand || '');
    if(ma !== mb) return ma.localeCompare(mb);
    return (Number(a.coolingCapacityBtuH || 0) - Number(b.coolingCapacityBtuH || 0));
  }).forEach(function(record){
    var recordCfm = Number(record.airflowNominalCfm || record.airflowMaxCfm || record.airflowMinCfm || 0);
    rows.push({
      value: 'equip:' + record.id,
      label: [
        record.manufacturerName || record.brand || 'Manufacturer',
        record.exactModelNumber || record.series || 'Model',
        record.equipmentType === 'ahu'
          ? (recordCfm.toLocaleString() + ' CFM / ESP ' + Number(record.availableEspPa || 0).toLocaleString() + ' Pa')
          : (Number(record.coolingCapacityBtuH || 0).toLocaleString() + ' BTU/h' + (recordCfm > 0 ? ' - ' + recordCfm.toLocaleString() + ' CFM' : '')),
        record.sampleData ? (lang==='ar' ? 'Sample - تجربة فقط' : 'Sample - test only') : (record.verificationStatus || 'catalogue')
      ].join(' - '),
      type: 'equipment',
      record: record
    });
  });
  rows.push({
    value: 'manual:custom',
    label: lang==='ar' ? 'إدخال سعة يدوية مخصصة...' : 'Custom manual capacity...',
    type: 'manual_custom'
  });
  return rows;
}

function handleProjectSystemCapacityDropdown(systemId, value){
  var system = getProjectSystem(systemId);
  if(!system || !value) return;
  if(value.indexOf('manual:') === 0){
    var manual = value.split(':')[1];
    if(manual === 'custom'){
      promptProjectSystemManualCapacity(systemId);
      recalcProjectSystems();
      return;
    }
    applyProjectSystemManualCapacity(systemId, manual);
    return;
  }
  if(value.indexOf('equip:') === 0){
    var id = value.slice('equip:'.length);
    var records = [];
    try{
      records = window.AppEquipmentDatabase && typeof window.AppEquipmentDatabase.allRecords === 'function'
        ? window.AppEquipmentDatabase.allRecords()
        : [];
    }catch(error){
      records = [];
    }
    var record = records.filter(function(item){ return item && item.id === id; })[0];
    if(!record){
      if(window.toast) window.toast(lang==='ar' ? 'لا يمكن اختيار بيانات عينة أو سجل غير موجود' : 'Cannot select sample or missing equipment record');
      recalcProjectSystems();
      return;
    }
    var qty = Math.max(1, parseInt(system.qty, 10) || 1);
    var unitCfm = Number(record.airflowNominalCfm || record.airflowMaxCfm || record.airflowMinCfm || 0);
    var isAirflowOnlyAhu = record.equipmentType === 'ahu' && !record.coolingCapacityBtuH;
    var reviewStatus = record.sampleData ? 'sample_data' : (isAirflowOnlyAhu ? 'coil_submittal_required' : 'review');
    var reviewLabel = record.sampleData
      ? (lang==='ar' ? 'تجربة فقط' : 'Sample Only')
      : (isAirflowOnlyAhu
        ? (lang==='ar' ? 'الكويل يحتاج اعتماد' : 'Coil Submittal Required')
        : (lang==='ar' ? 'يحتاج مراجعة' : 'Needs Review'));
    var reviewNote = record.sampleData
      ? (lang==='ar' ? 'هذه الوحدة Sample Data للتجربة وليست للاعتماد الهندسي النهائي.' : 'This unit is sample data for testing and is not for final engineering approval.')
      : (isAirflowOnlyAhu
        ? (lang==='ar' ? 'تم اختيار AHU من قاعدة الوحدات حسب CFM و ESP فقط. سعة التبريد الحرارية يجب اعتمادها من الكويل والـ submittal قبل التقرير النهائي.' : 'AHU was selected by CFM and ESP only. Cooling capacity must be approved from coil/submittal data before final reporting.')
        : (lang==='ar' ? 'تم اختيار الوحدة مباشرة من القائمة حسب نوع النظام. راجع المطابقة الهندسية قبل الاعتماد.' : 'Equipment was selected directly from the system-type dropdown. Review engineering match before approval.'));
    applyProjectSystemEquipmentSelection(systemId, record.id, {
      optionId: record.id + '-dropdown-x' + qty,
      equipmentId: record.id,
      record: record,
      quantity: qty,
      activeQuantity: qty,
      totalCapacityBtuH: Number(record.coolingCapacityBtuH || 0) * qty,
      totalAirflowCfm: unitCfm * qty,
      availableEspPa: record.availableEspPa,
      matchScore: 0,
      selectionMode: 'capacity_dropdown',
      preBindReview: {
        source: 'rules_engine',
        status: reviewStatus,
        label: reviewLabel,
        notes: [reviewNote]
      }
    });
  }
}

function closeProjectEquipmentMenus(exceptSystemId){
  document.querySelectorAll('.project-equipment-picker.open').forEach(function(node){
    if(exceptSystemId && node.getAttribute('data-system-id') === exceptSystemId) return;
    node.classList.remove('open');
    var btn = node.querySelector('.project-equipment-picker-trigger');
    if(btn) btn.setAttribute('aria-expanded', 'false');
  });
}

function toggleProjectSystemCapacityMenu(systemId, event){
  if(event && event.stopPropagation) event.stopPropagation();
  var node = document.querySelector('.project-equipment-picker[data-system-id="'+systemId+'"]');
  if(!node) return;
  var willOpen = !node.classList.contains('open');
  closeProjectEquipmentMenus(systemId);
  node.classList.toggle('open', willOpen);
  var btn = node.querySelector('.project-equipment-picker-trigger');
  if(btn) btn.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
}

function selectProjectSystemCapacityOption(systemId, value, event){
  if(event && event.stopPropagation) event.stopPropagation();
  closeProjectEquipmentMenus();
  handleProjectSystemCapacityDropdown(systemId, value);
}

function promptProjectSystemManualCapacity(systemId){
  var system = getProjectSystem(systemId);
  if(!system) return false;
  var current = toSystemBtu(system.selectedBtu) || getDefaultSystemCapacity(system.unitType);
  var label = lang==='ar'
    ? 'أدخل السعة اليدوية BTU/h'
    : 'Enter manual capacity BTU/h';
  var value = window.prompt ? window.prompt(label, String(current || '')) : '';
  if(value == null || value === '') return false;
  return applyProjectSystemManualCapacity(systemId, value);
}

function applyProjectSystemEquipmentSelection(systemId, equipmentId, selectionOption){
  var system = getProjectSystem(systemId);
  var option = selectionOption || {};
  var record = option.record || null;
  if(!system || !record) return false;
  var unitCapacity = toSystemBtu(record.coolingCapacityBtuH || option.unitCapacityBtuH || (option.totalCapacityBtuH / Math.max(1, parseInt(option.quantity,10) || 1)));
  var qty = Math.max(1, parseInt(option.quantity, 10) || parseInt(system.qty, 10) || 1);
  var catalogueRef = null;
  try{
    catalogueRef = window.AirCalcEquipmentCatalogue && typeof window.AirCalcEquipmentCatalogue.snapshotVersionRef === 'function'
      ? window.AirCalcEquipmentCatalogue.snapshotVersionRef(record)
      : null;
  }catch(e){}
  system.unitType = mapEquipmentTypeToProjectSystemType(record.equipmentType, system.unitType);
  system.selectedBtu = unitCapacity || toSystemBtu(option.totalCapacityBtuH) || system.selectedBtu;
  system.qty = qty;
  system.equipmentDatabaseId = equipmentId || record.id || '';
  system.equipmentId = equipmentId || record.id || '';
  system.selectedEquipmentOption = option;
  system.manualCapacity = false;
  system.manualCapacityBtuH = 0;
  system.selectionMode = 'database';
  system.equipmentReviewStatus = option.preBindReview && option.preBindReview.status ? option.preBindReview.status : 'rules_engine_reviewed';
  var unitAirflow = Math.max(0, parseInt(record.airflowNominalCfm || record.airflowMaxCfm || record.airflowMinCfm, 10) || 0);
  system.selectedEquipmentId = system.equipmentId;
  system.selectedManufacturer = record.manufacturerName || record.brand || '';
  system.selectedModel = record.exactModelNumber || record.series || '';
  system.selectedCapacityBtuH = unitCapacity || 0;
  system.selectedCapacityTr = unitCapacity ? (unitCapacity / 12000) : 0;
  system.selectedAirflowCfm = unitAirflow;
  system.selectedQuantity = qty;
  system.totalInstalledCapacityBtuH = unitCapacity ? unitCapacity * qty : (Number(option.totalCapacityBtuH || 0) || 0);
  system.totalInstalledAirflowCfm = unitAirflow ? unitAirflow * qty : (Number(option.totalAirflowCfm || 0) || 0);
  system.finalEquipmentCapacityBtuH = system.totalInstalledCapacityBtuH;
  system.scenarioStatus = system.conceptualScenarioSnapshot ? 'Equipment Selected' : system.scenarioStatus;
  system.automaticSelectionReason = option.automaticSelectionReason || (option.preBindReview && option.preBindReview.notes ? option.preBindReview.notes[0] : '');
  system.equipmentSnapshot = {
    selectedAt: new Date().toISOString(),
    source: 'equipment_selector_main_page',
    sourceOfTruth: 'rules_engine',
    record: record,
    catalogueVersion: catalogueRef,
    selectionOption: option
  };
  if(typeof syncQuotationDraftFromEquipment === 'function'){
    syncQuotationDraftFromEquipment(system, { persist:false });
  }
  try{
    localStorage.setItem('aircalc_last_selected_equipment_snapshot', JSON.stringify(system.equipmentSnapshot));
  }catch(e){}
  saveProjectSystems();
  recalcProjectSystems();
  if(window.toast) window.toast(lang==='ar' ? 'تم ربط الوحدة وحفظ snapshot داخل المشروع' : 'Equipment linked and snapshot saved in the project');
  return true;
}

function connectRoomToProjectSystem(i){
  ensureProjectSystems();
  if(!projectSystems.length) seedProjectSystemsFromLegacyState();
  var firstProjectSystem = projectSystems[0] || null;
  setRoomAssignmentMode(i, 'project', '', firstProjectSystem ? firstProjectSystem.id : '');
}
function connectRoomToExistingZone(i, zoneId){
  if(!zoneId) return;
  setRoomAssignmentMode(i, 'zone', zoneId);
}
function createZoneForRoom(i){
  var room = hist[i] || {};
  var roomName = (lang==='ar' ? (room.ar||room.en) : (room.en||room.ar)) || (lang==='ar' ? 'غرفة' : 'Room');
  var zone = createHvacZone((lang==='ar' ? 'منطقة ' : 'Zone ') + roomName, i);
  setRoomAssignmentMode(i, 'zone', zone.id);
}
function getSuggestionSummaryText(suggestion){
  if(!suggestion || !suggestion.systems || !suggestion.systems.length){
    return lang==='ar' ? 'لا يوجد اقتراح بعد' : 'No suggestion yet';
  }
  var sys = suggestion.systems[0];
  var qty = Math.max(1, parseInt(sys.qty,10)||1);
  return qty+' × '+utLabel(sys.unitType)+' · '+Number(sys.selectedBtu||0).toLocaleString()+' BTU';
}
function renderRoomQuickSummary(i, roomState, requiredBtu, selectedCapacityBtu){
  var status = roomState.capacityStatusMeta || getCapacityStatus(requiredBtu, selectedCapacityBtu);
  var assignment = roomState && roomState.assignment ? roomState.assignment : {mode:'independent'};
  var selectedLabel = assignment.mode === 'project'
    ? getProjectSystemDisplayName(assignment.projectSystemId || '')
    : Number(selectedCapacityBtu||0).toLocaleString();
  var selectedUnit = assignment.mode === 'independent' ? 'BTU/h' : '';
  return ''+
    '<div class="tech-quick-summary">'+
      '<div class="tech-summary-card"><div class="tech-summary-label">'+(lang==='ar'?'الحمل المطلوب':'Required BTU/h')+'</div><div class="tech-summary-value">'+Number(requiredBtu||0).toLocaleString()+'</div><div class="tech-summary-unit">BTU/h</div></div>'+
      '<div class="tech-summary-card"><div class="tech-summary-label">'+(lang==='ar'?'السعة المختارة':'Selected Capacity')+'</div><div class="tech-summary-value">'+selectedLabel+'</div><div class="tech-summary-unit">'+selectedUnit+'</div></div>'+
      '<div class="tech-summary-card tech-summary-status-card '+status.css+'"><div class="tech-summary-label">'+(lang==='ar'?'حالة المطابقة':'Match Status')+'</div><div class="tech-summary-badge"><span class="qi-cap-badge '+status.css+'">'+status.label+'</span></div><div class="tech-summary-unit">'+(status.key!=='no_system_selected'?status.deltaText:'—')+'</div></div>'+
    '</div>';
}
function renderRoomCapacityStatusSection(roomState, requiredBtu, selectedCapacityBtu, warnHtml){
  if(roomState && roomState.assignment && roomState.assignment.mode !== 'independent'){
    var linkedSystemName = getProjectSystemDisplayName(roomState.assignment.projectSystemId || '');
    var connectedLabel = lang==='ar'
      ? ('هذه الغرفة معلوماتية فقط في وضع وحدة المشروع، وترتبط حاليًا بـ '+linkedSystemName+'. تتم المطابقة على مستوى وحدة المشروع المرتبطة.')
      : ('This room is informational only in project mode and is currently linked to '+linkedSystemName+'. Validation is performed at the linked project system level.');
    return ''+
      '<div class="tech-status-banner tech-section-card pending">'+
        '<div class="tech-status-banner-head">'+
          '<div class="tech-status-banner-title">'+(lang==='ar'?'حالة الربط':'Assignment Status')+'</div>'+
          '<span class="qi-cap-badge pending">'+(roomState.capacityStatusMeta ? roomState.capacityStatusMeta.label : (lang==='ar'?'مرتبطة':'Connected'))+'</span>'+
        '</div>'+
        '<div class="tech-doc-inline-note">'+connectedLabel+'</div>'+
      '</div>';
  }
  var diffVal = (selectedCapacityBtu||0) - (requiredBtu||0);
  var pctMatch = requiredBtu > 0 ? Math.round(((selectedCapacityBtu||0) / requiredBtu) * 1000) / 10 : 0;
  var status = roomState.capacityStatusMeta || getCapacityStatus(requiredBtu, selectedCapacityBtu);
  return ''+
    '<div class="tech-status-banner tech-section-card '+status.css+'">'+
      '<div class="tech-status-banner-head">'+
        '<div class="tech-status-banner-title">'+(lang==='ar'?'حالة السعة':'Capacity Status')+'</div>'+
        '<span class="qi-cap-badge '+status.css+'">'+status.label+'</span>'+
      '</div>'+
      '<div class="tech-status-grid">'+
        '<div class="tech-status-stat"><span class="tech-status-label">'+(lang==='ar'?'السعة المطلوبة':'Required Capacity')+'</span><strong>'+Number(requiredBtu||0).toLocaleString()+' BTU/h</strong></div>'+
        '<div class="tech-status-stat"><span class="tech-status-label">'+(lang==='ar'?'السعة المختارة':'Selected Capacity')+'</span><strong>'+Number(selectedCapacityBtu||0).toLocaleString()+' BTU/h</strong></div>'+
        '<div class="tech-status-stat"><span class="tech-status-label">'+(lang==='ar'?'الفرق':'Difference')+'</span><strong>'+(diffVal>=0?'+':'')+Number(diffVal||0).toLocaleString()+' BTU/h</strong></div>'+
        '<div class="tech-status-stat"><span class="tech-status-label">'+(lang==='ar'?'نسبة المطابقة':'Percentage Match')+'</span><strong>'+(requiredBtu>0 ? pctMatch.toFixed(1)+'%' : '—')+'</strong></div>'+
      '</div>'+
      (warnHtml ? '<div class="tech-status-warning-wrap">'+warnHtml+'</div>' : '')+
    '</div>';
}
function renderRoomEngineeringDetails(i, roomState, summaryStatsHtml, hcLine, devLine, roomDuctHtml){
  var airflowHtml = '';
  if(roomState.isHealthcare){
    var airflowStatus = roomState.airflowStatusMeta || getAirflowStatus(roomState.requiredCfm, roomState.selectedSystemCfm);
    var pressureText = roomState.pressureRequirement
      ? (lang==='ar' ? 'متطلب الضغط: ' : 'Pressure requirement: ') + roomState.pressureRequirement
      : '';
    airflowHtml =
      '<div class="tech-engineering-grid">'+
        '<div class="tech-status-stat"><span class="tech-status-label">'+(lang==='ar'?'التدفق المطلوب':'Required CFM')+'</span><strong>'+Number(roomState.requiredCfm||0).toLocaleString()+' CFM</strong></div>'+
        '<div class="tech-status-stat"><span class="tech-status-label">'+(lang==='ar'?'تدفق الوحدات المختارة':'Selected System CFM')+'</span><strong>'+Number(roomState.selectedSystemCfm||0).toLocaleString()+' CFM</strong></div>'+
        '<div class="tech-status-stat"><span class="tech-status-label">'+(lang==='ar'?'حالة تدفق الهواء':'Airflow Status')+'</span><strong><span class="qi-cap-badge '+airflowStatus.css+'">'+airflowStatus.label+'</span></strong></div>'+
        (pressureText ? '<div class="tech-status-stat"><span class="tech-status-label">'+(lang==='ar'?'الضغط':'Pressure')+'</span><strong>'+pressureText.replace(/^.*?: /,'')+'</strong></div>' : '')+
      '</div>';
  }
  return ''+
    '<details class="tech-engineering-accordion">'+
      '<summary>'+(lang==='ar'?'عرض التفاصيل الهندسية':'Engineering Details')+'</summary>'+
      '<div class="tech-engineering-body">'+
        summaryStatsHtml+
        devLine+
        hcLine+
        airflowHtml+
        roomDuctHtml+
      '</div>'+
    '</details>';
}
function getRoomEngineeringNotes(i, roomState){
  roomState = ensureRoomEngineeringState(i, roomState);
  var validation = getRoomEngineeringValidation(i, roomState);
  var notes = [];
  (validation.items || []).forEach(function(item){
    if(item && item.action && item.action.text){
      notes.push(String(item.action.text).replace(/<br\s*\/?>/gi, ' · '));
    } else if(item && item.detail){
      notes.push(String(item.detail));
    }
  });
  notes = notes.filter(function(note, idx, arr){
    return note && arr.indexOf(note) === idx;
  });
  if(!notes.length){
    notes.push(lang==='ar' ? 'لا توجد توصيات إضافية حاليًا.' : 'No additional recommendations at the moment.');
  }
  return notes;
}
function renderRoomValidationCompact(i, roomState){
  roomState = ensureRoomEngineeringState(i, roomState);
  var validation = getRoomEngineeringValidation(i, roomState);
  var items = (validation.items || []).slice(0,4);
  if(!items.length) return '';
  var rows = items.map(function(item){
    var meta = getValidationStatusMeta(item.status);
    return '<div class="desktop-validation-row">'+
      '<div class="desktop-validation-row-head"><span>'+esc(item.title)+'</span><strong class="validation-badge '+meta.css+'">'+esc(meta.label)+'</strong></div>'+
    '</div>';
  }).join('');
  return '<div class="tech-section-card"><div class="assignment-panel-head"><div><strong>'+(lang==='ar'?'ملخص التحقق':'Validation Summary')+'</strong></div></div><div class="desktop-insight-list">'+rows+'</div></div>';
}
function renderRoomRecommendationCompact(i, roomState){
  roomState = ensureRoomEngineeringState(i, roomState);
  var notes = getRoomEngineeringNotes(i, roomState).slice(0,3);
  if(!notes.length){
    notes = [lang==='ar' ? 'لا توجد توصيات إضافية حاليًا.' : 'No additional recommendations at the moment.'];
  }
  return '<div class="tech-section-card"><div class="assignment-panel-head"><div><strong>'+(lang==='ar'?'الإجراء المقترح':'Recommended Action')+'</strong></div></div><div class="desktop-recommendation-note">'+notes.map(function(note){ return '<div>'+esc(note)+'</div>'; }).join('')+'</div></div>';
}
function getSuggestionTypePriority(room){
  var source = [
    room && room.roomType,
    room && room.category,
    room && room.rid,
    room && room.en,
    room && room.ar
  ].filter(Boolean).join(' ').toLowerCase();
  if((room && room.sup) || source.indexOf('health') >= 0 || source.indexOf('icu') >= 0 || source.indexOf('operating') >= 0 || source.indexOf('patient') >= 0){
    return ['ahu','fcu','chiller_air','chiller_water','ducted'];
  }
  if(source.indexOf('mosque') >= 0 || source.indexOf('retail') >= 0 || source.indexOf('hall') >= 0 || source.indexOf('shop') >= 0){
    return ['package','ducted','cassette','vrf','split'];
  }
  if(source.indexOf('home') >= 0 || source.indexOf('bedroom') >= 0 || source.indexOf('living') >= 0 || source.indexOf('residential') >= 0){
    return ['split','floor','ducted','cassette'];
  }
  if(source.indexOf('office') >= 0 || source.indexOf('class') >= 0 || source.indexOf('meeting') >= 0){
    return ['split','ducted','cassette','vrf'];
  }
  return ['split','ducted','package','cassette','vrf','floor','ahu','fcu','chiller_air','chiller_water','window'];
}
function getSuggestionScore(requiredBtu, suggestion){
  var status = getCapacityStatus(requiredBtu, suggestion.totalBtu);
  var diff = Math.abs((suggestion.totalBtu || 0) - (requiredBtu || 0));
  var oversizePct = requiredBtu > 0 ? Math.max(0, ((suggestion.totalBtu - requiredBtu) / requiredBtu) * 100) : 0;
  var units = suggestion.systems.reduce(function(sum, sys){ return sum + (parseInt(sys.qty,10)||0); }, 0);
  var penalty = 0;
  if(status.key === 'undersized') penalty += 1000000;
  if(status.key === 'oversized') penalty += oversizePct * 150;
  penalty += diff;
  penalty += units * (requiredBtu > 250000 ? 12 : 6);
  penalty += (suggestion.systems.length - 1) * 200;
  return penalty;
}
function createSmartSuggestion(requiredBtu, systems){
  var normalized = (systems || []).map(function(sys){
    return normalizeQuoteSystem({
      unitType: sys.unitType,
      selectedBtu: sys.selectedBtu,
      qty: sys.qty
    });
  }).filter(function(sys){ return (parseInt(sys.selectedBtu,10)||0) > 0 && (parseInt(sys.qty,10)||0) > 0; });
  if(!normalized.length) return null;
  var totalBtu = normalized.reduce(function(sum, sys){
    return sum + (toSystemBtu(sys.selectedBtu) * (parseInt(sys.qty,10)||0));
  }, 0);
  var status = getCapacityStatus(requiredBtu, totalBtu);
  return {
    systems: normalized,
    totalBtu: totalBtu,
    difference: totalBtu - requiredBtu,
    status: status,
    score: 0
  };
}
function getBestSingleTypeSuggestion(requiredBtu, unitType){
  var catalog = (getCatalog(unitType) || []).map(function(item){
    return {
      btu: toSystemBtu(item.btu),
      label: lang === 'ar' ? item.label.ar : item.label.en
    };
  }).filter(function(item){ return item.btu > 0; });
  if(!catalog.length || requiredBtu <= 0) return null;
  var best = null;
  catalog.forEach(function(item){
    var qty = Math.max(1, Math.ceil(requiredBtu / item.btu));
    var candidate = createSmartSuggestion(requiredBtu, [{ unitType: unitType, selectedBtu: item.btu, qty: qty }]);
    if(!candidate) return;
    candidate.score = getSuggestionScore(requiredBtu, candidate);
    if(!best || candidate.score < best.score) best = candidate;
  });
  return best;
}
function getBestMixedSuggestion(requiredBtu, primaryType, secondaryType){
  var primaryCatalog = (getCatalog(primaryType) || []).map(function(item){ return toSystemBtu(item.btu); }).filter(Boolean).sort(function(a,b){ return b-a; });
  var secondaryCatalog = (getCatalog(secondaryType) || []).map(function(item){ return toSystemBtu(item.btu); }).filter(Boolean).sort(function(a,b){ return b-a; });
  if(!primaryCatalog.length || !secondaryCatalog.length || requiredBtu <= 0) return null;
  var best = null;
  primaryCatalog.slice(0,4).forEach(function(primaryBtu){
    var maxPrimaryQty = Math.max(1, Math.ceil(requiredBtu / primaryBtu));
    for(var pq=1; pq<=Math.min(maxPrimaryQty, 4); pq++){
      secondaryCatalog.slice(0,5).forEach(function(secondaryBtu){
        var used = primaryBtu * pq;
        var remaining = Math.max(0, requiredBtu - used);
        var sq = remaining > 0 ? Math.ceil(remaining / secondaryBtu) : 1;
        var candidate = createSmartSuggestion(requiredBtu, [
          { unitType: primaryType, selectedBtu: primaryBtu, qty: pq },
          { unitType: secondaryType, selectedBtu: secondaryBtu, qty: Math.max(1, sq) }
        ]);
        if(!candidate) return;
        candidate.score = getSuggestionScore(requiredBtu, candidate) + 120;
        if(!best || candidate.score < best.score) best = candidate;
      });
    }
  });
  return best;
}
function getSuggestionSignature(suggestion){
  return suggestion.systems.map(function(sys){
    return [sys.unitType, toSystemBtu(sys.selectedBtu), parseInt(sys.qty,10)||0].join(':');
  }).join('|');
}
function getSmartUnitSuggestions(i){
  var room = hist[i] || {};
  var requiredBtu = getRoomRequiredBtu(i);
  if(requiredBtu <= 0) return [];
  var preferred = getSuggestionTypePriority(room);
  var candidates = [];
  preferred.slice(0,5).forEach(function(unitType){
    var single = getBestSingleTypeSuggestion(requiredBtu, unitType);
    if(single) candidates.push(single);
  });
  if(preferred.length >= 2){
    var mixedA = getBestMixedSuggestion(requiredBtu, preferred[0], preferred[1]);
    var mixedB = getBestMixedSuggestion(requiredBtu, preferred[0], preferred[Math.min(2, preferred.length - 1)]);
    if(mixedA) candidates.push(mixedA);
    if(mixedB) candidates.push(mixedB);
  }
  var seen = {};
  candidates = candidates.filter(function(candidate){
    var sig = getSuggestionSignature(candidate);
    if(seen[sig]) return false;
    seen[sig] = true;
    candidate.signature = sig;
    candidate.score = candidate.score || getSuggestionScore(requiredBtu, candidate);
    return true;
  }).sort(function(a,b){ return a.score - b.score; });
  return candidates.slice(0,5);
}
function applySmartSuggestion(i, suggestionIndex){
  var suggestions = getSmartUnitSuggestions(i);
  var suggestion = suggestions[suggestionIndex];
  if(!suggestion) return;
  var line = ensureQuoteLine(i);
  line.systems = suggestion.systems.map(function(sys){
    return normalizeQuoteSystem({
      id: createQuoteSystemId(),
      unitType: sys.unitType,
      selectedBtu: sys.selectedBtu,
      qty: sys.qty
    });
  });
  line.systemPrices = {};
  line.systemPricing = line.systemPrices;
  recalcRoomSystems(i);
}
function renderSmartSuggestions(i){
  var roomState = getRoomSystemState(i);
  var requiredBtu = roomState.requiredBtu;
  if(requiredBtu <= 0) return '';
  var suggestions = getSmartUnitSuggestions(i).slice(0,3);
  if(!suggestions.length){
    return '<div class="mixed-systems-card smart-suggestions-card"><div class="mixed-systems-head"><div class="mixed-systems-title">'+t('smartsuggestions')+'</div></div><div class="mixed-systems-empty">'+t('suggestionempty')+'</div></div>';
  }
  var labels = lang==='ar'
    ? ['أفضل اختيار','خيار بديل','خيار أكبر']
    : ['Best Match','Alternative Option','Oversized Option'];
  var cards = suggestions.map(function(suggestion, idx){
    var systemsHtml = suggestion.systems.map(function(sys){
      return '<div class="smart-suggestion-line"><span>'+Math.max(1, parseInt(sys.qty,10)||1)+' × '+utLabel(sys.unitType)+'</span><span>'+Number(sys.selectedBtu||0).toLocaleString()+' BTU</span></div>';
    }).join('');
    var diff = suggestion.difference || 0;
    return ''+
      '<div class="smart-suggestion-item">'+
        '<div class="smart-suggestion-body">'+
          '<div class="smart-suggestion-pill">'+(labels[idx] || labels[labels.length-1])+'</div>'+
          '<div class="smart-suggestion-lines">'+systemsHtml+'</div>'+
          '<div class="smart-suggestion-meta">'+
            '<div class="smart-suggestion-stat"><span class="mixed-system-total-label">'+t('suggestiontotal')+'</span><span>'+Number(suggestion.totalBtu||0).toLocaleString()+' BTU/h</span></div>'+
            '<div class="smart-suggestion-stat"><span class="mixed-system-total-label">'+t('suggestiondifference')+'</span><span>'+(diff>=0?'+':'')+Number(diff||0).toLocaleString()+' BTU/h</span></div>'+
            '<div class="smart-suggestion-stat"><span class="mixed-system-total-label">'+t('suggestionstatus')+'</span><span class="qi-cap-badge '+suggestion.status.css+'">'+suggestion.status.label+(suggestion.status.key!=='no_system_selected'?' '+suggestion.status.deltaText:'')+'</span></div>'+
          '</div>'+
          '<div class="smart-suggestion-actions"><button type="button" class="mixed-systems-btn primary" onclick="applySmartSuggestion('+i+','+idx+')">'+t('suggestionapply')+'</button></div>'+
        '</div>'+
      '</div>';
  }).join('');
  return ''+
    '<div class="mixed-systems-card smart-suggestions-card">'+
      '<div class="mixed-systems-head"><div class="mixed-systems-title">'+t('smartsuggestions')+'</div></div>'+
      '<div class="smart-suggestion-list">'+cards+'</div>'+
    '</div>';
}
function buildRoomSystemsTableHtml(i, requiredBtu, isAr, cur){
  var roomState = syncRoomSystemState(i) || getRoomSystemState(i);
  var systems = roomState.systems;
  if(!systems.length) return '';
  var selectedCapacity = roomState.selectedCapacityBtu;
  var status = roomState.capacityStatusMeta;
  var requiredVal = roomState.requiredBtu;
  var diffVal = roomState.capacityDifference;
  var rows = systems.map(function(system){
    var totalSelected = (parseInt(system.selectedBtu, 10) || 0) * Math.max(1, parseInt(system.qty, 10) || 1);
    return '<tr>'+
      '<td style="padding:6px 8px;border:1px solid #dbeafe;text-align:'+(isAr?'right':'left')+'">'+utLabel(system.unitType)+'</td>'+
      '<td style="padding:6px 8px;border:1px solid #dbeafe;text-align:center;font-family:monospace">'+Number(system.selectedBtu||0).toLocaleString()+'</td>'+
      '<td style="padding:6px 8px;border:1px solid #dbeafe;text-align:center;font-family:monospace">'+Math.max(1, parseInt(system.qty, 10) || 1)+'</td>'+
      '<td style="padding:6px 8px;border:1px solid #dbeafe;text-align:center;font-family:monospace">'+Number(totalSelected).toLocaleString()+'</td>'+
    '</tr>';
  }).join('');
  return ''+
    '<div style="margin-top:10px;border:1px solid #dbeafe;border-radius:8px;padding:10px;background:#f8fbff">'+
      '<table style="width:100%;border-collapse:collapse;font-size:10px;margin-bottom:8px"><thead><tr style="background:#eff6ff">'+
        '<th style="padding:6px 8px;border:1px solid #dbeafe;text-align:'+(isAr?'right':'left')+'">'+t('mixedtype')+'</th>'+
        '<th style="padding:6px 8px;border:1px solid #dbeafe;text-align:center">'+t('mixedcapacity')+'</th>'+
        '<th style="padding:6px 8px;border:1px solid #dbeafe;text-align:center">'+t('mixedqty')+'</th>'+
        '<th style="padding:6px 8px;border:1px solid #dbeafe;text-align:center">BTU Total</th>'+
      '</tr></thead><tbody>'+rows+'</tbody></table>'+
      '<div style="display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:10px;color:#334155;font-weight:700">'+
        '<span>'+t('mixedrequiredcapacity')+': '+Number(requiredVal).toLocaleString()+' BTU/h</span>'+
        '<span>'+t('mixedselectedtotal')+': '+Number(selectedCapacity).toLocaleString()+' BTU/h</span>'+
        '<span>'+t('mixeddifference')+': '+(diffVal>=0?'+':'')+Number(diffVal).toLocaleString()+' BTU/h</span>'+
      '</div>'+
      '<div style="margin-top:8px;font-size:10px;font-weight:700;color:'+(status.key==='matched'?'#166534':status.key==='undersized'?'#dc2626':status.key==='oversized'?'#4f46e5':'#64748b')+'">'+status.label+(status.key!=='no_system_selected'?' '+status.deltaText:'')+'</div>'+
    '</div>';
}

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
    'lbl-vol':'lvol','lbl-len':'llen','lbl-width':'lwidth','lbl-height':'lheight','lbl-type':'ltype','lbl-room-count':'lroomcount','lbl-load-factor':'lcity','lbl-load-factor-value':'lcityfactor','lbl-ppl':'lppl',
    'lbl-advanced-inputs':'ladvanced','lbl-window-area':'lwindowarea','lbl-exposure-type':'lexposure','lbl-insulation-type':'linsulation',
    'lbl-add':'ladd','lbl-modal':'lmodal','lbl-dtot':'ldtot',
    'st-room':'sroom','st-dev':'sdev',
    'breakdown-ttl':'bttl','hc-note-lbl':'notelbl',
    'brl-vol':'bvol','brl-base':'bbase','brl-window':'bwindow','brl-ppl':'bppl','brl-dev':'bdev','brl-sub':'bsub','brl-sf':'bsf',
    'brm-city-lbl':'bcity','brm-factor-lbl':'bcityfactor','brm-insulation-lbl':'binsulation','brm-multiplier-lbl':'binsulationm','brm-people-lbl':'bpeoplecount','brm-window-area-lbl':'bwindowarea',
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
  if (qtQtyLbl) qtQtyLbl.textContent = isProjectHvacMode() ? t('qqty') : t('qsqtyl');

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
  var windowAreaInp = G('inp-window-area');
  if (windowAreaInp) windowAreaInp.placeholder = '0.0';
  var loadFactorInp = G('inp-load-factor');
  if (loadFactorInp) loadFactorInp.placeholder = String(getSelectedCityFactor());
  if (loadFactorInp) loadFactorInp.value = String(getSelectedCityFactor());
  var loadFactorHelper = G('load-factor-helper');
  if (loadFactorHelper) loadFactorHelper.textContent = t('lfhelper');
  var loadFactorPreset = G('inp-load-factor-preset');
  if (loadFactorPreset) populateCityOptions(loadFactorPreset);
  var insulationType = G('inp-insulation-type');
  if (insulationType) populateInsulationOptions(insulationType);
  var exposureType = G('inp-exposure-type');
  if (exposureType) populateExposureOptions(exposureType);
  var freshAirMode = G('inp-fresh-air-mode');
  if(freshAirMode && freshAirMode.options.length >= 2){
    freshAirMode.options[0].text = t('freshairashrae');
    freshAirMode.options[1].text = t('freshair100');
  }
  updateFactorInputsUI();
  updateOccupancyHelper();

  var quoteProject = G('quote-project');
  if (quoteProject) quoteProject.placeholder = lang === 'ar' ? 'اسم المشروع' : 'Project Name';
  var techProject = G('tech-project');
  if (techProject) techProject.placeholder = lang === 'ar' ? 'اسم المشروع' : 'Project Name';
  var techNo = G('tech-no');
  if (techNo) techNo.placeholder = 'Q-001';
  var reportClient = G('report-client');
  if (reportClient) reportClient.placeholder = lang === 'ar' ? 'اسم العميل' : 'Client name';
  var reportLocation = G('report-location');
  if (reportLocation) reportLocation.placeholder = lang === 'ar' ? 'موقع المشروع' : 'Project location';
  var reportDesigner = G('report-designer');
  if (reportDesigner) reportDesigner.placeholder = lang === 'ar' ? 'المصمم / الشركة' : 'Designer / company';
  var reportClientLbl = G('report-client-lbl');
  if (reportClientLbl) reportClientLbl.textContent = lang === 'ar' ? 'اسم العميل' : 'Client';
  var reportLocationLbl = G('report-location-lbl');
  if (reportLocationLbl) reportLocationLbl.textContent = lang === 'ar' ? 'الموقع' : 'Location';
  var reportDesignerLbl = G('report-designer-lbl');
  if (reportDesignerLbl) reportDesignerLbl.textContent = lang === 'ar' ? 'المصمم' : 'Designer';
  var reportLanguage = G('report-language');
  if(reportLanguage && reportLanguage.options && reportLanguage.options.length >= 3){
    reportLanguage.options[0].text = lang === 'ar' ? 'حسب لغة الواجهة' : 'Auto';
    reportLanguage.options[1].text = lang === 'ar' ? 'العربية' : 'Arabic';
    reportLanguage.options[2].text = lang === 'ar' ? 'الإنجليزية' : 'English';
  }
  var reportLanguageLbl = G('report-language-lbl');
  if (reportLanguageLbl) reportLanguageLbl.textContent = lang === 'ar' ? 'لغة التقرير' : 'Report Language';
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
  var appSubtitle = G('app-subtitle');
  if (appSubtitle) appSubtitle.textContent = lang === 'ar'
    ? 'منصة حسابات وعروض أسعار التكييف'
    : 'HVAC Calculation & Quotation Suite';
  var contactPhoneLbl = G('contact-phone-lbl');
  if (contactPhoneLbl) contactPhoneLbl.textContent = lang === 'ar' ? 'رقم الجوال' : 'Mobile';
  var contactEmailLbl = G('contact-email-lbl');
  if (contactEmailLbl) contactEmailLbl.textContent = lang === 'ar' ? 'البريد الإلكتروني' : 'Email';
  var contactPhoneVal = G('contact-phone-val');
  if (contactPhoneVal) contactPhoneVal.textContent = '0560282701';
  var contactEmailVal = G('contact-email-val');
  if (contactEmailVal) contactEmailVal.textContent = 'yousef.alhammam@live.com';

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
  if (saveBtn) saveBtn.title = t('qsave');
  var saveLbl = G('quote-save-lbl');
  if (saveLbl) saveLbl.textContent = t('qsave');
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
  renderSelectedRoomPreview();
  renderDevs();
  renderHist();

  if (isProjectHvacMode()) renderProjBlock();

  if (window.AppProjects){
    var pp = G('p-projects');
    if (pp && pp.classList.contains('on')) {
      window.AppProjects.renderProjects();
    }
  }
}

function applyLang(){
  if (arguments.length && (arguments[0] === 'ar' || arguments[0] === 'en')) {
    lang = arguments[0];
  }
  if (window.AppState) {
    window.AppState.lang = lang;
  }
  applyDocumentLang();
  applyLangHeaderUI();
  applyLangStaticTexts();
  applyLangInputsAndLabels();
  applyLangModuleSync();
  applyLangRenders();
  updateDesktopProjectFields();
  updateDesktopInsightsVisibility();
  updateCalculationModeUI(curRoom);
  try{
    localStorage.setItem('aircalc_lang', lang);
  }catch(e){}
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
var currentDesktopView = 'dashboard';

function setDesktopActive(view,name){
  document.querySelectorAll('.desktop-nav-item').forEach(function(btn){ btn.classList.remove('on'); });
  var activeId = 'dni-' + (view || name || 'dashboard');
  var active = G(activeId);
  if(!active && name) active = G('dni-' + name);
  if(active) active.classList.add('on');
}

function updateDesktopProjectFields(){
  var desktopProject = G('desktop-project');
  var desktopNo = G('desktop-no');
  var desktopLangBtn = G('desktop-lang-btn');
  var desktopThemeBtn = G('desktop-theme-btn');
  var sourceProject = G('tech-project') || G('quote-project');
  var sourceNo = G('tech-no') || G('quote-no');
  if(desktopProject && sourceProject && document.activeElement!==desktopProject && desktopProject.value !== sourceProject.value) desktopProject.value = sourceProject.value;
  if(desktopNo && sourceNo && document.activeElement!==desktopNo && desktopNo.value !== sourceNo.value) desktopNo.value = sourceNo.value;
  if(desktopLangBtn){
    desktopLangBtn.textContent = (lang === 'ar' ? 'EN' : 'AR');
  }
  if(desktopThemeBtn){
    desktopThemeBtn.textContent = document.body.classList.contains('light-theme') ? '🌙' : '☀️';
  }
  var sidebarSubtitle = G('desktop-sidebar-subtitle');
  var appSubtitle = G('app-subtitle');
  var desktopSubtitleText = (lang === 'ar' ? 'منصة حسابات وعروض أسعار التكييف' : 'HVAC calculations and quotation platform');
  if(sidebarSubtitle) sidebarSubtitle.textContent = desktopSubtitleText;
  var topbarSubtitle = G('desktop-topbar-subtitle');
  if(topbarSubtitle) topbarSubtitle.textContent = desktopSubtitleText;
  if(appSubtitle) appSubtitle.textContent = desktopSubtitleText;
  var projectLabel = G('desktop-project-label');
  if(projectLabel) projectLabel.textContent = (lang === 'ar' ? 'اسم المشروع' : 'Project name');
  var projectNoLabel = G('desktop-no-label');
  if(projectNoLabel) projectNoLabel.textContent = (lang === 'ar' ? 'رقم المشروع' : 'Project number');
  var saveLabel = G('desktop-save-label');
  if(saveLabel) saveLabel.textContent = (lang === 'ar' ? 'حفظ المشروع الحالي' : 'Save current project');
  if(saveLabel){
    var saveButton = saveLabel.closest('button');
    saveButton.classList.add('project-save-icon');
    saveButton.title = saveLabel.textContent;
    saveButton.setAttribute('aria-label', saveLabel.textContent);
    if(!saveButton.querySelector('svg')) saveButton.insertAdjacentHTML('afterbegin', '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h12l4 4v12a2 2 0 0 1-2 2Z"/><path d="M17 21v-8H7v8M7 3v5h8V3"/></svg>');
    var projectFields = document.querySelector('.desktop-topbar-project');
    if(projectFields && saveButton.parentElement !== projectFields) projectFields.appendChild(saveButton);
  }
  var exportHapLabel = G('desktop-export-hap-label');
  if(exportHapLabel) exportHapLabel.closest('button').remove();
  var navTech = G('desktop-nav-tech');
  if(navTech) navTech.textContent = (lang === 'ar' ? 'التقرير الفني' : 'Technical report');
  var navHist = G('desktop-nav-hist');
  if(navHist) navHist.textContent = (lang === 'ar' ? 'عرض السعر التجاري' : 'Commercial quotation');
  var navProjects = G('desktop-nav-projects');
  if(navProjects) navProjects.textContent = (lang === 'ar' ? 'المشاريع' : 'Projects');
  var navEquipment = G('desktop-nav-equipment');
  if(navEquipment) navEquipment.textContent = (lang === 'ar' ? 'قاعدة الوحدات' : 'Equipment database');
  var navSettings = G('desktop-nav-settings');
  if(navSettings) navSettings.textContent = (lang === 'ar' ? 'الإعدادات' : 'Settings');
  var navDashboard = G('desktop-nav-dashboard');
  if(navDashboard) navDashboard.textContent = (lang === 'ar' ? 'تصميم المشروع' : 'Project design');
  var desktopFootnote = G('desktop-sidebar-footnote');
  if(desktopFootnote) desktopFootnote.textContent = (lang === 'ar' ? 'تجربة محسنة للشاشات الكبيرة' : 'Optimized for larger screens');
  var desktopHelpLabel = G('desktop-sidebar-help-label');
  if(desktopHelpLabel) desktopHelpLabel.textContent = (lang === 'ar' ? 'الدعم والمساعدة' : 'Support & Help');
  var desktopNote = G('desktop-rec-ar');
  if(desktopNote){
    desktopNote.textContent = (lang === 'ar'
      ? 'لأفضل تجربة في الحسابات والتقارير، ننصح باستخدام الكمبيوتر أو الشاشة الكبيرة.'
      : 'For the best calculation and reporting experience, we recommend using a desktop or larger screen.');
  }
  var insightResultsTitle = G('desktop-insight-results-title');
  if(insightResultsTitle) insightResultsTitle.textContent = (lang === 'ar' ? 'النتائج الفورية' : 'Quick Results');
  var currentRoomTitle = G('desktop-current-room-title');
  if(currentRoomTitle) currentRoomTitle.textContent = (lang === 'ar' ? 'الغرفة الحالية' : 'Current Room');
  var insightSelectedTitle = G('desktop-insight-selected-title');
  if(insightSelectedTitle) insightSelectedTitle.textContent = (lang === 'ar' ? 'إجماليات المشروع' : 'Project Totals');
  var insightStatusTitle = G('desktop-insight-status-title');
  if(insightStatusTitle) insightStatusTitle.textContent = (lang === 'ar' ? 'حالة المطابقة' : 'Capacity Match Status');
  var insightValidationTitle = G('desktop-insight-validation-title');
  if(insightValidationTitle) insightValidationTitle.textContent = (lang === 'ar' ? 'التحقق الهندسي' : 'Engineering Validation');
  var insightActionsTitle = G('desktop-insight-actions-title');
  if(insightActionsTitle) insightActionsTitle.textContent = (lang === 'ar' ? 'الإجراءات المقترحة' : 'Recommended Actions');
  var insightSmartTitle = G('desktop-insight-smart-title');
  if(insightSmartTitle) insightSmartTitle.textContent = (lang === 'ar' ? 'رؤى هندسية' : 'Engineering Insights');
  var metricBtuLabel = G('desktop-metric-btu-label');
  if(metricBtuLabel) metricBtuLabel.textContent = (lang === 'ar' ? 'الحمل المطلوب' : 'Required BTU/h');
  var metricTrLabel = G('desktop-metric-tr-label');
  if(metricTrLabel) metricTrLabel.textContent = (lang === 'ar' ? 'طن التبريد' : 'Required TR');
  var metricCfmLabel = G('desktop-metric-cfm-label');
  if(metricCfmLabel) metricCfmLabel.textContent = (lang === 'ar' ? 'تدفق الإمداد' : 'Required CFM');
  var metricMktLabel = G('desktop-metric-mkt-label');
  if(metricMktLabel) metricMktLabel.textContent = (lang === 'ar' ? 'السعة المختارة' : 'Selected Capacity');
  var metricDiffLabel = G('desktop-metric-diff-label');
  if(metricDiffLabel) metricDiffLabel.textContent = (lang === 'ar' ? 'فرق السعة %' : 'Capacity Difference %');
  var selectedBtuLabel = G('desktop-selected-btu-label');
  if(selectedBtuLabel) selectedBtuLabel.textContent = (lang === 'ar' ? 'إجمالي الغرف' : 'Total Rooms');
  var selectedTrLabel = G('desktop-selected-tr-label');
  if(selectedTrLabel) selectedTrLabel.textContent = (lang === 'ar' ? 'إجمالي BTU/h' : 'Total BTU/h');
  var selectedCfmLabel = G('desktop-selected-cfm-label');
  if(selectedCfmLabel) selectedCfmLabel.textContent = (lang === 'ar' ? 'إجمالي TR' : 'Total TR');
  var selectedQtyLabel = G('desktop-selected-qty-label');
  if(selectedQtyLabel) selectedQtyLabel.textContent = (lang === 'ar' ? 'إجمالي CFM' : 'Total CFM');
  var statusDiffLabel = G('desktop-status-diff-label');
  if(statusDiffLabel) statusDiffLabel.textContent = (lang === 'ar' ? 'الفرق BTU' : 'Difference');
  var statusPercentLabel = G('desktop-status-percent-label');
  if(statusPercentLabel) statusPercentLabel.textContent = (lang === 'ar' ? 'الفرق %' : 'Difference %');
  var valCapacity = G('desktop-val-capacity');
  if(valCapacity) valCapacity.textContent = (lang === 'ar' ? 'فحص السعة' : 'Capacity');
  var valCfm = G('desktop-val-cfm');
  if(valCfm) valCfm.textContent = (lang === 'ar' ? 'فحص تدفق الهواء' : 'CFM / Airflow');
  var valDuct = G('desktop-val-duct');
  if(valDuct) valDuct.textContent = (lang === 'ar' ? 'فحص سرعة الدكت' : 'Duct Velocity');
  var valEsp = G('desktop-val-esp');
  if(valEsp) valEsp.textContent = (lang === 'ar' ? 'فحص ESP' : 'ESP');
  var valAshrae = G('desktop-val-ashrae');
  if(valAshrae) valAshrae.textContent = (lang === 'ar' ? 'تحقق ASHRAE' : 'ASHRAE');
}

function syncDesktopProjectFields(source){
  if(source !== 'desktop') return;
  var desktopProject = G('desktop-project');
  var desktopNo = G('desktop-no');
  var techProject = G('tech-project');
  var techNo = G('tech-no');
  var quoteProject = G('quote-project');
  var quoteNo = G('quote-no');
  if(desktopProject){
    if(techProject) techProject.value = desktopProject.value;
    if(quoteProject) quoteProject.value = desktopProject.value;
  }
  if(desktopNo){
    if(techNo) techNo.value = desktopNo.value;
    if(quoteNo) quoteNo.value = desktopNo.value;
  }
  persistProjectIdentityDraft();
  refreshProjectIdentitySummaries();
}

function persistProjectIdentityDraft(){
  var fields={};
  ['tech-project','tech-no','report-client','report-location','report-designer','report-language'].forEach(function(id){var field=G(id);if(field) fields[id]=field.value;});
  try{localStorage.setItem('aircalc_project_identity_draft',JSON.stringify(fields));}catch(_err){}
}
function refreshProjectIdentitySummaries(){
  window._lastProfessionalReportData=null;
  var identity=getQuotationIdentitySnapshot();
  (projectSystems || []).forEach(function(system){
    if(system.quotationDraft && system.quotationDraft.snapshot) system.quotationDraft.snapshot.project=Object.assign({},identity);
  });
  saveProjectSystems();
  ['report-project-context','quote-project-context'].forEach(function(id){
    var host=G(id);
    if(host) host.innerHTML=renderProjectContextSummary({quotation:id==='quote-project-context'});
  });
}

function toggleDesktopSidebar(){
  var shell = document.querySelector('.desktop-shell');
  if(shell) shell.classList.toggle('sidebar-collapsed');
}

function getActiveWorkspacePanelName(){
  var activePanel = document.querySelector('.workspace-main .panel.on');
  if(!activePanel || !activePanel.id) return 'calc';
  return activePanel.id.replace(/^p-/, '') || 'calc';
}

function syncDesktopPageLayoutMode(activePanelName){
  var workspaceShell = document.querySelector('.workspace-shell');
  if(!workspaceShell) return;
  ['dashboard','tech','hist','projects','settings','equipment'].forEach(function(mode){
    workspaceShell.classList.remove('desktop-page-' + mode);
  });
  var mode = activePanelName === 'calc' ? 'dashboard' : activePanelName;
  workspaceShell.classList.add('desktop-page-' + mode);
}

function updateDesktopInsightsVisibility(){
  var insights = G('desktop-insights');
  var workspaceShell = document.querySelector('.workspace-shell');
  var activePanelName = getActiveWorkspacePanelName();
  var derivedView = activePanelName === 'calc' ? 'dashboard' : activePanelName;
  currentDesktopView = derivedView;
  var showInsights = false;
  syncDesktopPageLayoutMode(activePanelName);
  if(insights){
    insights.classList.toggle('is-hidden', !showInsights);
    insights.toggleAttribute('hidden', !showInsights);
    insights.setAttribute('aria-hidden', showInsights ? 'false' : 'true');
  }
  if(workspaceShell) workspaceShell.classList.toggle('insights-hidden', !showInsights);
  setDesktopActive(currentDesktopView, activePanelName);
}

function syncDesktopWorkflowPlacement(){
  var workflow = G('calc-workflow-card');
  var calcPanel = G('p-calc');
  var roomCard = calcPanel ? calcPanel.querySelector('.room-card') : null;
  if(!workflow || !calcPanel || !roomCard) return;
  if(workflow.parentNode !== calcPanel || roomCard.nextElementSibling !== workflow){
    roomCard.insertAdjacentElement('afterend', workflow);
  }
}

function getDesktopStatusTone(text){
  var txt = String(text || '').toLowerCase();
  if(/مطابق|pass|ok|within/.test(txt)) return 'pass';
  if(/مراجعة|review|warning|higher|above/.test(txt)) return 'review';
  if(/غير مطابق|fail|below|required|undersized|insufficient/.test(txt)) return 'fail';
  return 'na';
}

function setDesktopInlineStatus(node, text){
  if(!node) return;
  var tone = getDesktopStatusTone(text);
  node.textContent = text || (lang === 'ar' ? 'غير منطبق' : 'N/A');
  node.className = 'desktop-inline-status is-' + tone;
  var row = node.closest('.desktop-validation-row');
  if(row) row.setAttribute('data-status', tone);
}

function renderDesktopActionList(items){
  var host = G('desktop-insight-action-list');
  if(!host) return;
  var list = (items || []).filter(Boolean).slice(0, 4);
  if(!list.length){
    host.innerHTML = '<div class="desktop-action-row is-muted">' +
      '<span class="desktop-action-dot">i</span>' +
      '<span>' + (lang === 'ar'
        ? 'ستظهر هنا توصيات مختصرة بعد الحساب والتحقق.'
        : 'Short corrective actions will appear here after calculations and validation.') +
      '</span></div>';
    return;
  }
  host.innerHTML = list.map(function(item){
    return '<div class="desktop-action-row">' +
      '<span class="desktop-action-dot">•</span>' +
      '<span>' + esc(item) + '</span></div>';
  }).join('');
}

function summarizeValidationValues(item){
  var values = item && Array.isArray(item.values) ? item.values.filter(Boolean) : [];
  if(values.length){
    return values.slice(0, 3).map(function(entry){
      return entry.label + ': ' + entry.value;
    }).join(' | ');
  }
  return (item && item.message) ? item.message : '';
}

function renderDesktopProjectSummaryCard(){
  var host = G('desktop-project-summary-sections');
  if(!host) return;
  if(!hist.length){
    host.innerHTML = '';
    return;
  }
  host.innerHTML = getProjectSummarySectionsHtml(lang === 'ar');
}

function getCurrentRoomRecordIndex(){
  if(editIdx >= 0 && editIdx < hist.length) return editIdx;
  if(calcRoomsOpenIdx >= 0 && calcRoomsOpenIdx < hist.length) return calcRoomsOpenIdx;
  return hist.length ? hist.length - 1 : -1;
}

function renderDesktopCurrentRoomCard(){
  var host = G('desktop-current-room');
  if(!host) return;
  var idx = getCurrentRoomRecordIndex();
  if(idx < 0 || !hist[idx]){
    host.innerHTML = '<div class="desktop-current-room-empty">' + (lang === 'ar'
      ? 'اختر غرفة أو احسب غرفة جديدة لتظهر هنا بيانات الغرفة الحالية.'
      : 'Select a room or calculate a new room to show the current room summary here.') + '</div>';
    return;
  }
  var h = hist[idx];
  var roomState = getRoomSystemState(idx);
  var roomName = ((lang === 'ar' ? (h.ar || h.en) : (h.en || h.ar)) || (lang === 'ar' ? 'غرفة' : 'Room'))
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/gu,'')
    .trim();
  var statusMeta = getWorkflowStatusMeta(idx, roomState);
  host.innerHTML =
    '<div class="desktop-current-room-head">'+
      '<div>'+
        '<div class="desktop-current-room-name">'+esc(roomName)+'</div>'+
        '<div class="desktop-current-room-sub">'+esc(getWorkflowAssignedSystemText(idx, roomState))+'</div>'+
      '</div>'+
      '<span class="project-explorer-item-status is-'+statusMeta.tone+'">'+esc(statusMeta.label)+'</span>'+
    '</div>'+
    '<div class="desktop-current-room-grid">'+
      '<div class="desktop-current-room-stat"><span>BTU/h</span><strong>'+Number(getQuoteRequiredBtu(idx) || 0).toLocaleString()+'</strong></div>'+
      '<div class="desktop-current-room-stat"><span>TR</span><strong>'+((getQuoteRequiredBtu(idx) || 0)/12000).toFixed(2)+'</strong></div>'+
      '<div class="desktop-current-room-stat"><span>CFM</span><strong>'+Number(getRoomRequiredCfm(idx) || 0).toLocaleString()+'</strong></div>'+
      '<div class="desktop-current-room-stat"><span>'+(lang === 'ar' ? 'المساحة' : 'Area')+'</span><strong>'+((getWorkflowRoomArea(h) || 0).toLocaleString())+' m²</strong></div>'+
    '</div>';
}

function getDesktopSmartInsightItems(){
  var items = [];
  if(hist.length){
    var highestLoad = -1, highestLoadIdx = -1, highestCfm = -1, highestCfmIdx = -1;
    hist.forEach(function(h, idx){
      var reqBtu = getQuoteRequiredBtu(idx);
      var reqCfm = getRoomRequiredCfm(idx);
      if(reqBtu > highestLoad){ highestLoad = reqBtu; highestLoadIdx = idx; }
      if(reqCfm > highestCfm){ highestCfm = reqCfm; highestCfmIdx = idx; }
    });
    if(highestLoadIdx >= 0){
      items.push((lang === 'ar' ? 'أعلى حمل: ' : 'Highest load: ') + ((lang === 'ar' ? (hist[highestLoadIdx].ar || hist[highestLoadIdx].en) : (hist[highestLoadIdx].en || hist[highestLoadIdx].ar)) || '') + ' · ' + Number(highestLoad || 0).toLocaleString() + ' BTU/h');
    }
    if(highestCfmIdx >= 0){
      items.push((lang === 'ar' ? 'أعلى تدفق هواء: ' : 'Highest airflow: ') + ((lang === 'ar' ? (hist[highestCfmIdx].ar || hist[highestCfmIdx].en) : (hist[highestCfmIdx].en || hist[highestCfmIdx].ar)) || '') + ' · ' + Number(highestCfm || 0).toLocaleString() + ' CFM');
    }
  }
  var totalReqBtu = getProjectRequiredLoadBtu();
  var totalSelBtu = getSelectedProjectEquipmentBtu();
  var projectStatus = getProjectCapacityStatus(totalReqBtu, totalSelBtu);
  if(projectStatus.key === 'undersized'){
    items.push(lang === 'ar' ? 'السعة الحالية أقل من المطلوب على مستوى المشروع.' : 'Current selected capacity is below project demand.');
  }else if(projectStatus.key === 'oversized'){
    items.push(lang === 'ar' ? 'السعة الحالية أعلى من المطلوب وقد تسبب هدرًا أو تشغيلًا متقطعًا.' : 'Current selected capacity is oversized and may cause waste or short cycling.');
  }
  var validation = getProjectEngineeringValidation();
  var flagged = (validation.items || []).find(function(item){ return item && item.status && item.status !== 'pass' && item.status !== 'not_applicable'; });
  if(flagged){
    var flaggedText = flagged.message || flagged.detail || flagged.title || '';
    if(flaggedText){
      items.push((lang === 'ar' ? 'تنبيه هندسي: ' : 'Engineering insight: ') + flaggedText);
    }
  }
  if(window._lastEspCalc && Number(window._lastEspCalc.totalPa || 0) > 140){
    items.push(lang === 'ar' ? 'ESP مرتفع نسبيًا؛ راجع أطوال الدكت والفلاتر والمخارج.' : 'ESP is relatively high; review duct lengths, filters, and outlets.');
  }
  if(!items.length){
    items.push(lang === 'ar' ? 'ستظهر الرؤى الهندسية تلقائيًا بعد إضافة الغرف والوحدات.' : 'Engineering insights will appear automatically after adding rooms and systems.');
  }
  return items.slice(0,4);
}

function renderDesktopSmartInsights(){
  var host = G('desktop-smart-insights');
  if(!host) return;
  var items = getDesktopSmartInsightItems();
  host.innerHTML = items.map(function(item){
    return '<div class="desktop-action-row"><span class="desktop-action-dot">•</span><span>'+esc(item)+'</span></div>';
  }).join('');
}

function getExplorerGroupMeta(h){
  if(h && (h.floorLabelAr || h.floorLabelEn || h.floor)){
    return {
      key: 'floor:' + (h.floor || h.floorLabelAr || h.floorLabelEn),
      label: lang === 'ar' ? (h.floorLabelAr || h.floor || 'الدور') : (h.floorLabelEn || h.floor || 'Floor')
    };
  }
  if(h && h.calcMode === 'hc'){
    return { key:'healthcare', label: lang === 'ar' ? 'الغرف الصحية' : 'Healthcare Rooms' };
  }
  return { key:'project', label: lang === 'ar' ? 'غرف المشروع' : 'Project Rooms' };
}

function openExplorerRoom(idx){
  editRec(idx);
  renderProjectExplorer();
  renderDesktopInsightPanel();
}

function renderProjectExplorer(){
  var shell = G('project-explorer');
  if(shell){
    shell.style.display = 'none';
    shell.setAttribute('hidden','hidden');
    shell.setAttribute('aria-hidden','true');
  }
  var host = G('project-explorer-body');
  var meta = G('project-explorer-meta');
  var title = G('project-explorer-title');
  var kicker = G('project-explorer-kicker');
  if(title) title.textContent = lang === 'ar' ? 'الغرف والأنظمة' : 'Rooms & Systems';
  if(kicker) kicker.textContent = lang === 'ar' ? 'Project Explorer' : 'Project Explorer';
  if(meta) meta.textContent = String(hist.length || 0);
  if(!host) return;
  host.innerHTML = getProjectExplorerMarkup();
}

function getProjectExplorerMarkup(options){
  var opts = options || {};
  var emptyMessage = opts.emptyMessage || (lang === 'ar'
    ? 'لا توجد غرف محسوبة بعد. ابدأ بإضافة غرفة وحسابها لتظهر هنا ضمن المشروع.'
    : 'No calculated rooms yet. Add and calculate a room to list it here in the project explorer.');
  if(!hist.length){
    return '<div class="project-explorer-empty">' + emptyMessage + '</div>';
  }
  var groups = {};
  hist.forEach(function(h, idx){
    var metaInfo = getExplorerGroupMeta(h);
    if(!groups[metaInfo.key]) groups[metaInfo.key] = { label: metaInfo.label, rows: [] };
    groups[metaInfo.key].rows.push({ h:h, idx:idx });
  });
  return Object.keys(groups).map(function(key){
    var group = groups[key];
    return '<div class="project-explorer-group">'+
      '<div class="project-explorer-group-head"><span>▼ '+esc(group.label)+'</span><strong>'+group.rows.length+'</strong></div>'+
      '<div class="project-explorer-list">'+
        group.rows.map(function(entry){
          var h = entry.h, idx = entry.idx;
          var roomState = getRoomSystemState(idx);
          var statusMeta = getWorkflowStatusMeta(idx, roomState);
          var primary = (opts.inWorkflow && quoteMode !== 'proj')
            ? ensureWorkflowPrimarySystem(idx)
            : normalizeQuoteSystem((roomState.systems && roomState.systems[0]) || {
                unitType:getUT(idx) || 'split',
                selectedBtu:getSelBtu(idx) || getDefaultSystemCapacity(getUT(idx) || 'split'),
                qty:Math.max(1, getQty(idx) || 1)
              });
          var selectedBtu = Number(roomState.selectedCapacityBtu || 0);
          var selectedTr = selectedBtu / 12000;
          var selectedCfm = Number(roomState.selectedSystemCfm || 0);
          var typeOptions = getWorkflowSystemTypeKeys().map(function(k){
            return '<option value="'+k+'"'+(primary.unitType===k?' selected':'')+'>'+esc(utLabel(k))+'</option>';
          }).join('');
          var capOptions = getCatalog(primary.unitType).map(function(item){
            var lbl = lang==='ar' ? item.label.ar : item.label.en;
            return '<option value="'+item.btu+'"'+((Number(primary.selectedBtu)||0)===(Number(item.btu)||0)?' selected':'')+'>'+esc(lbl)+'</option>';
          }).join('');
          var roomName = ((lang === 'ar' ? (h.ar || h.en) : (h.en || h.ar)) || (lang === 'ar' ? 'غرفة' : 'Room'))
            .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/gu,'')
            .trim();
          var active = (idx === editIdx || idx === calcRoomsOpenIdx) ? ' active' : '';
          var workflowUnitControls = opts.inWorkflow && quoteMode !== 'proj'
            ? '<div class="project-explorer-workflow-box" onclick="event.stopPropagation()">'+
                '<div class="project-explorer-workflow-grid">'+
                  '<label class="project-explorer-workflow-field"><span>'+(lang==='ar'?'نوع الوحدة':'System Type')+'</span><select class="calc-room-unit-select" onchange="setRoomWorkflowUnitType('+idx+',this.value)">'+typeOptions+'</select></label>'+
                  '<label class="project-explorer-workflow-field"><span>'+(lang==='ar'?'السعة':'Capacity')+'</span><select class="calc-room-unit-select" onchange="setRoomWorkflowCapacity('+idx+',this.value)">'+capOptions+'</select></label>'+
                  '<div class="project-explorer-workflow-field"><span>'+(lang==='ar'?'العدد':'Qty')+'</span><div class="calc-room-mini-stepper"><button type="button" onclick="stepRoomWorkflowQty('+idx+',-1)">−</button><span>'+Math.max(1, parseInt(primary.qty,10)||1)+'</span><button type="button" onclick="stepRoomWorkflowQty('+idx+',1)">+</button></div></div>'+
                '</div>'+
                '<div class="project-explorer-workflow-summary">'+
                  '<div class="project-explorer-workflow-stat"><span>'+(lang==='ar'?'السعة المختارة':'Selected BTU')+'</span><strong>'+selectedBtu.toLocaleString()+' BTU</strong></div>'+
                  '<div class="project-explorer-workflow-stat"><span>TR</span><strong>'+selectedTr.toFixed(2)+'</strong></div>'+
                  '<div class="project-explorer-workflow-stat"><span>CFM</span><strong>'+selectedCfm.toLocaleString()+'</strong></div>'+
                '</div>'+
              '</div>'
            : '';
          return '<div class="project-explorer-item'+active+'" onclick="openExplorerRoom('+idx+')">'+
            '<div class="project-explorer-item-head">'+
              '<div><div class="project-explorer-item-name">'+esc(roomName)+'</div><div class="project-explorer-item-unit">'+esc(getWorkflowAssignedSystemText(idx, roomState))+'</div></div>'+
              '<span class="project-explorer-item-status is-'+statusMeta.tone+'">'+esc(statusMeta.label)+'</span>'+
            '</div>'+
            '<div class="project-explorer-item-metrics">'+
              '<div class="project-explorer-item-metric"><span>'+ (lang === 'ar' ? 'المساحة' : 'Area') +'</span><strong>'+((getWorkflowRoomArea(h) || 0).toLocaleString())+' m²</strong></div>'+
              '<div class="project-explorer-item-metric"><span>BTU/h</span><strong>'+Number(getQuoteRequiredBtu(idx) || 0).toLocaleString()+'</strong></div>'+
              '<div class="project-explorer-item-metric"><span>TR</span><strong>'+((getQuoteRequiredBtu(idx) || 0)/12000).toFixed(2)+'</strong></div>'+
            '</div>'+
      getRoomActionButtonsHtml(idx, 'project-explorer-item-actions is-inline')+
            workflowUnitControls+
          '</div>';
        }).join('')+
      '</div>'+
    '</div>';
  }).join('');
}

function renderDesktopInsightPanel(){
  var metricBtu = G('desktop-metric-btu');
  var metricTr = G('desktop-metric-tr');
  var metricCfm = G('desktop-metric-cfm');
  var metricMkt = G('desktop-metric-mkt');
  var metricDiff = G('desktop-metric-diff');
  var statusMessage = G('desktop-status-message');
  var statusDiff = G('desktop-status-diff');
  var statusPercent = G('desktop-status-percent');
  var actionsBody = G('desktop-insight-actions-body');
  var statusBox = G('desktop-status-box');
  if(!metricBtu || !metricTr || !metricCfm || !metricMkt || !metricDiff || !statusMessage || !statusDiff || !statusPercent || !actionsBody || !statusBox) return;
  function tx(id,fallback){
    var node = G(id);
    return node ? node.textContent.trim() : fallback;
  }
  renderDesktopProjectSummaryCard();
  renderDesktopCurrentRoomCard();
  renderDesktopSmartInsights();

  var activePanel = document.querySelector('.panel.on');
  if(!activePanel){
    actionsBody.textContent = '';
    return;
  }
  if(activePanel.id === 'p-calc'){
    var totalReqBtu = getProjTotalBtu();
    var totalReqCfm = getProjTotalCfm();
    var totalReqTr = getProjTotalTr();
    var totalSelBtu = getSelectedProjectEquipmentBtu();
    var projectStatus = getProjectCapacityStatus(totalReqBtu, totalSelBtu);
    metricBtu.textContent = Number(totalReqBtu || 0).toLocaleString() + ' BTU/h';
    metricTr.textContent = Number(totalReqTr || 0).toFixed(2) + ' TR';
    metricCfm.textContent = Number(totalReqCfm || 0).toLocaleString() + ' CFM';
    metricMkt.textContent = Number(totalSelBtu || 0).toLocaleString() + ' BTU';
    metricDiff.textContent = projectStatus.percentText || '0.0%';
    statusMessage.textContent = projectStatus.label;
    statusDiff.textContent = (projectStatus.difference >= 0 ? '+' : '') + Number(projectStatus.difference || 0).toLocaleString() + ' BTU';
    statusPercent.textContent = projectStatus.percentText || '0.0%';
    actionsBody.textContent = lang==='ar'
      ? 'تظهر هنا نفس إجماليات المشروع الرئيسية مع ملخص هندسي مختصر، بينما يعرض التقرير الفني التفاصيل الكاملة.'
      : 'This panel mirrors the main project totals with a concise engineering summary, while the technical report shows the full detail.';
    renderDesktopActionList([
      (lang==='ar' ? 'الحمل المطلوب: ' : 'Required Load: ') + Number(totalReqBtu || 0).toLocaleString() + ' BTU/h',
      (lang==='ar' ? 'الهواء المطلوب: ' : 'Required Airflow: ') + Number(totalReqCfm || 0).toLocaleString() + ' CFM',
      (G('fresh-air-warning') && G('fresh-air-warning').textContent.trim()) || '',
      (lang==='ar' ? 'راجع التقرير الفني لمزيد من تفاصيل المطابقة والغرف.' : 'Open the technical report for more detailed room-by-room matching.')
    ]);
    statusBox.setAttribute('data-tone', projectStatus.key === 'matched' ? 'pass' : (projectStatus.key === 'undersized' ? 'fail' : 'review'));
    updateDesktopValidationSummary();
    return;
  }
  if(activePanel.id === 'p-tech'){
    metricBtu.textContent = Number(getProjectRequiredLoadBtu() || 0).toLocaleString() + ' BTU/h';
    metricTr.textContent = Number(getProjTotalTr() || 0).toFixed(2) + ' TR';
    metricCfm.textContent = Number(getProjectRequiredLoadCfm() || 0).toLocaleString() + ' CFM';
    metricMkt.textContent = Number(getSelectedProjectEquipmentBtu() || 0).toLocaleString() + ' BTU';
    metricDiff.textContent = (getProjectCapacityStatus(getProjectRequiredLoadBtu(), getSelectedProjectEquipmentBtu()).percentText || '0.0%');
    var warn = activePanel.querySelector('.tech-status-banner .tech-status-headline, .proj-status-message, .validation-action-text');
    statusMessage.textContent = warn ? warn.textContent.trim() : (lang==='ar' ? 'راجع حالة المطابقة داخل بطاقات التقرير الفني.' : 'Review the match status inside the technical report cards.');
    statusDiff.textContent = tx('cum-mkt','—') + ' / ' + tx('cum-btu','—');
    statusPercent.textContent = lang==='ar' ? 'راجع التقرير الفني' : 'See Technical Report';
    actionsBody.textContent = lang==='ar'
      ? 'هذه التوصيات مشتقة من التحقق الهندسي الحالي وتُحدَّث مع كل تعديل.'
      : 'These recommendations are derived from the current engineering validation and update with each change.';
    renderDesktopActionList(Array.prototype.slice.call(activePanel.querySelectorAll('.validation-action-text')).map(function(node){
      return node.textContent.trim();
    }));
    statusBox.setAttribute('data-tone', getDesktopStatusTone(statusMessage.textContent));
    updateDesktopValidationSummary(activePanel);
    return;
  }
  if(activePanel.id === 'p-hist'){
    metricBtu.textContent = tx('vbtu','—') + ' BTU/h';
    metricTr.textContent = tx('vtr','—') + ' TR';
    metricCfm.textContent = tx('vcfm','—') + ' CFM';
    metricMkt.textContent = tx('vmkt','—') + ' BTU';
    metricDiff.textContent = '—';
    statusMessage.textContent = lang==='ar'
      ? 'راجع صفوف التسعير والضريبة ثم صدّر CSV أو PDF من نفس الشاشة.'
      : 'Review pricing rows and VAT, then export CSV or PDF from the same screen.';
    statusDiff.textContent = tx('qt-grand','—');
    statusPercent.textContent = lang==='ar' ? 'ملخص تسعير' : 'Pricing summary';
    actionsBody.textContent = lang==='ar'
      ? 'راجع صفوف التسعير والضريبة ثم صدّر CSV أو PDF من نفس الشاشة.'
      : 'Review pricing rows and VAT, then export CSV or PDF from the same screen.';
    renderDesktopActionList([
      lang==='ar' ? 'راجع الإجمالي الفرعي وضريبة القيمة المضافة قبل التصدير.' : 'Review subtotal and VAT before export.',
      lang==='ar' ? 'تحقق من كميات الوحدات قبل مشاركة عرض السعر.' : 'Confirm selected quantities before sharing the quotation.'
    ]);
    statusBox.setAttribute('data-tone', 'review');
    return;
  }
  if(activePanel.id === 'p-projects'){
    metricBtu.textContent = '—';
    metricTr.textContent = '—';
    metricCfm.textContent = '—';
    metricMkt.textContent = '—';
    metricDiff.textContent = '—';
    statusMessage.textContent = lang==='ar'
      ? 'لوحة المشاريع مهيأة للبحث، التصفية، والعودة السريعة لأحدث الملفات.'
      : 'Projects dashboard is optimized for search, filtering, and quick resume workflows.';
    statusDiff.textContent = '—';
    statusPercent.textContent = '—';
    actionsBody.textContent = lang==='ar'
      ? 'استخدم الفلاتر لترتيب المشاريع حسب النوع أو التاريخ أو عدد الغرف.'
      : 'Use filters to sort projects by type, date, or room count.';
    renderDesktopActionList([
      lang==='ar' ? 'ابحث باسم المشروع أو المدينة للوصول السريع.' : 'Search by project name or city for faster access.',
      lang==='ar' ? 'استخدم الحفظ الدوري قبل الانتقال بين المشاريع.' : 'Save regularly before switching between projects.'
    ]);
    statusBox.setAttribute('data-tone', 'na');
    return;
  }
  metricBtu.textContent = '—';
  metricTr.textContent = '—';
  metricCfm.textContent = '—';
  metricMkt.textContent = '—';
  metricDiff.textContent = '—';
  statusMessage.textContent = lang==='ar'
    ? 'يمكنك إدارة الإعدادات والحساب من هذه الشاشة.'
    : 'Use this screen to manage settings and account preferences.';
  statusDiff.textContent = '—';
  statusPercent.textContent = '—';
  actionsBody.textContent = lang==='ar'
    ? 'احرص على استخدام شاشة كبيرة للحصول على أفضل تجربة عمل هندسية.'
    : 'Use a larger screen for the best engineering workflow experience.';
  renderDesktopActionList([
    lang==='ar' ? 'فعّل الوضع المناسب ثم عد إلى المشروع لمتابعة الحساب.' : 'Pick the needed mode, then return to the project workflow.',
    lang==='ar' ? 'استخدم الشريط الجانبي للتنقل بين التقرير والسعر والإعدادات.' : 'Use the sidebar to move between report, quotation, and settings.'
  ]);
  statusBox.setAttribute('data-tone', 'na');
}

function updateDesktopValidationSummary(scope){
  syncAllRoomSystemStates();
  if(isProjectHvacMode()){
    ensureProjectSystems();
    syncLegacyProjectStateFromSystems();
  }
  var map = {
    capacity: G('desktop-val-capacity-status'),
    cfm: G('desktop-val-cfm-status'),
    duct: G('desktop-val-duct-status'),
    esp: G('desktop-val-esp-status'),
    ashrae: G('desktop-val-ashrae-status')
  };
  var notes = {
    capacity: G('desktop-val-capacity-note'),
    cfm: G('desktop-val-cfm-note'),
    duct: G('desktop-val-duct-note'),
    esp: G('desktop-val-esp-note'),
    ashrae: G('desktop-val-ashrae-note')
  };
  Object.keys(map).forEach(function(key){
    if(map[key]) setDesktopInlineStatus(map[key], (lang === 'ar' ? 'غير منطبق' : 'N/A'));
    if(notes[key]){
      notes[key].textContent = '';
      notes[key].hidden = true;
    }
  });
  var validation = getProjectEngineeringValidation();
  var items = validation && Array.isArray(validation.items) ? validation.items : [];
  var order = ['capacity','cfm','ashrae','duct','esp'];
  items.forEach(function(item, idx){
    var key = order[idx];
    if(!key || !item) return;
    if(map[key]) setDesktopInlineStatus(map[key], item.badgeAr || item.badgeEn || (lang === 'ar' ? 'غير منطبق' : 'N/A'));
    if(notes[key]){
      notes[key].textContent = '';
      notes[key].hidden = true;
    }
  });
}

var desktopInsightTimer = null;
function scheduleDesktopInsightRefresh(){
  if(desktopInsightTimer) clearTimeout(desktopInsightTimer);
  desktopInsightTimer = setTimeout(function(){
    updateDesktopInsightsVisibility();
    syncDesktopWorkflowPlacement();
    if(currentDesktopView === 'dashboard'){
      renderDesktopInsightPanel();
    }
    updateDesktopProjectFields();
  }, 60);
}

function openDesktopView(view){
  currentDesktopView = view || 'dashboard';
  if(view === 'dashboard'){
    goPanel('calc');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  goPanel(view);
}

function goPanel(name){
  document.querySelectorAll('.panel').forEach(function(p){p.classList.remove('on');});
  document.querySelectorAll('.ni').forEach(function(n){n.classList.remove('on');});
  var p=G('p-'+name), n=G('ni-'+name);
  if(p) p.classList.add('on');
  if(n) n.classList.add('on');
  if(name === 'calc'){
    currentDesktopView = 'dashboard';
  }else if(name === 'tech'){
    currentDesktopView = 'tech';
  }else{
    currentDesktopView = name;
  }
  setDesktopActive(currentDesktopView, name);
  updateDesktopInsightsVisibility();
  if(name==='projects') trackAppEvent('dashboard_view', { language: currentAnalyticsLanguage() });
  if(name==='tech') trackAppEvent('report_view', { language: currentAnalyticsLanguage() });
  if(name==='hist') trackAppEvent('quotation_view', { language: currentAnalyticsLanguage() });
  scheduleDesktopInsightRefresh();
}

function syncProjectFields(source){
  var fromProject = G(source + '-project');
  var fromNo = G(source + '-no');
  var toPrefix = source === 'tech' ? 'quote' : 'tech';
  var toProject = G(toPrefix + '-project');
  var toNo = G(toPrefix + '-no');
  if(fromProject && toProject && toProject.value !== fromProject.value) toProject.value = fromProject.value;
  if(fromNo && toNo && toNo.value !== fromNo.value) toNo.value = fromNo.value;
  updateDesktopProjectFields();
  persistProjectIdentityDraft();
  refreshProjectIdentitySummaries();
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
  var techDuctSlot = G('tech-duct-slot');
  var techAnalysisSlot = G('tech-analysis-slot');
  if(!quoteSettingsSlot || !quoteProjPricingSlot || !quoteProjPricingInlineSlot || !techCumSlot || !techControlsSlot || !techProjSlot || !techAnalysisSlot) return;
  techDuctSlot = techDuctSlot || techAnalysisSlot;

  if(techDuctSlot){
    var ductHeading = G('tech-duct-heading');
    if(!ductHeading){
      ductHeading = document.createElement('div');
      ductHeading.className = 'tech-section-inline-head';
      ductHeading.id = 'tech-duct-heading';
      techDuctSlot.insertBefore(ductHeading, techDuctSlot.firstChild || null);
    }
    if(ductHeading.parentNode === techDuctSlot && techDuctSlot.firstChild !== ductHeading){
      techDuctSlot.insertBefore(ductHeading, techDuctSlot.firstChild || null);
    }
    ductHeading.className = 'tech-section-inline-head';
    ductHeading.innerHTML =
      '<div><strong>'+(lang==='ar'?'تصميم مجاري الهواء':'Duct Design')+'</strong><span>'+(lang==='ar'?'تحقق السرعات، المقاسات، والضغط الساكن بجانب نتائج التقرير.':'Check velocities, sizes, and ESP beside the report results.')+'</span></div>';
  }

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
  if(calcModeRow && calcModeRow.parentNode !== techDuctSlot) techDuctSlot.appendChild(calcModeRow);

  var ductBlock = G('proj-duct-block');
  if(ductBlock && ductBlock.parentNode !== techDuctSlot) techDuctSlot.appendChild(ductBlock);

  var advDuctBlock = G('adv-duct-block');
  if(advDuctBlock && advDuctBlock.parentNode !== techDuctSlot) techDuctSlot.appendChild(advDuctBlock);

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
    var quoteProjSave = G('quote-proj-save-inline');
    if(pricingGrid && !quoteProjSave){
      quoteProjSave = document.createElement('div');
      quoteProjSave.className = 'qi-save-box qi-save-box-proj';
      quoteProjSave.id = 'quote-proj-save-inline';
      pricingGrid.appendChild(quoteProjSave);
    }
    if(quoteProjSave){
      quoteProjSave.innerHTML =
        '<div class="qi-plbl">'+t('qsave')+'</div>'+
        getQuotationSaveButtonHtml('quote-inline-save-btn-proj');
    }
    if(pricingGrid && projLineTotal.parentNode !== pricingGrid) pricingGrid.appendChild(projLineTotal);
  }
  updateQuoteModeAuxVisibility();
}

function updateQuoteModeAuxVisibility(){
  var showProjectPricing = isProjectHvacMode();
  var quoteProjPricingSlot = G('quote-proj-pricing-slot');
  if(quoteProjPricingSlot) quoteProjPricingSlot.style.display = showProjectPricing ? '' : 'none';
  var quoteProjPricingInlineSlot = G('quote-proj-pricing-inline-slot');
  if(quoteProjPricingInlineSlot) quoteProjPricingInlineSlot.style.display = showProjectPricing ? '' : 'none';
  var quoteProjPricingCard = G('quote-proj-pricing-card');
  if(quoteProjPricingCard) quoteProjPricingCard.style.display = showProjectPricing ? '' : 'none';
  var projUpGroup = G('proj-up-group');
  if(projUpGroup){
    var inQuotePricing = !!projUpGroup.closest('#quote-proj-pricing-card, #quote-proj-pricing-inline-slot, #quote-proj-pricing-grid');
    projUpGroup.style.display = (showProjectPricing && inQuotePricing) ? '' : 'none';
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
  if(!e.target.closest('.project-equipment-picker')) closeProjectEquipmentMenus();
});
document.addEventListener('input', scheduleDesktopInsightRefresh, true);
window.addEventListener('resize', scheduleDesktopInsightRefresh);
document.addEventListener('change', scheduleDesktopInsightRefresh, true);
document.addEventListener('DOMContentLoaded', function(){
  try{
    var identity=JSON.parse(localStorage.getItem('aircalc_project_identity_draft') || '{}');
    ['tech-project','tech-no','report-client','report-location','report-designer','report-language'].forEach(function(id){
      var field=G(id);if(field && typeof identity[id]==='string') field.value=identity[id];
    });
    if(G('quote-project') && G('tech-project')) G('quote-project').value=G('tech-project').value;
    if(G('quote-no') && G('tech-no')) G('quote-no').value=G('tech-no').value;
  }catch(_err){}
  updateDesktopProjectFields();
  setDesktopActive(currentDesktopView, 'calc');
  scheduleDesktopInsightRefresh();
});
var ROOM_GROUP_ORDER = {
  general:['r_office','r_residential','r_retail','r_kitchen','r_server','r_classroom','r_gym','r_mosque','r_restaurant'],
  healthcare:['h_patient_room','h_corridor','h_or','h_or_sub','h_icu','h_ccu','h_emergency','h_exam','h_treatment','h_medication','h_isolation','h_airborne','h_protective','h_nicu','h_nursery','h_labor','h_lab','h_pathology','h_autopsy','h_radiology','h_mri','h_dialysis','h_cath_lab','h_cardiac_cath','h_ep_lab','h_ir_lab','h_neuro_angio','h_hybrid_or','h_sterile_decontam','h_sterile_clean','h_sterile_storage','h_dental','h_physio','h_waiting','h_nurse','h_pharmacy','h_hkitchen','h_soiled','h_clean','h_toilet','h_records']
};
function renderRoomDropdown(){
  var dd = G('dd-room');
  if(!dd || !ROOMS) return;
  function roomBadge(room){
    return room.mode === 'hc' ? 'ASHRAE' : (lang === 'ar' ? 'مدينة' : 'City');
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
    return lang === 'ar' ? 'تقدير سريع بمعامل مدينة' : 'Quick city factor estimate';
  }
  function itemHtml(roomId){
    var room = ROOMS[roomId];
    if(!room) return '';
    var selected = curRoom && curRoom.id === roomId ? ' sel' : '';
    return '<div class="dd-item'+selected+'" onclick="pickRoom(this,\''+roomId+'\')">'+
      '<div class="dd-item-info"><div>'+rLabel(room)+'</div><div class="dd-item-sub">'+roomSub(room)+'</div></div>'+
      '<span class="dd-badge">'+roomBadge(room)+'</span></div>';
  }
  var generalHdr = lang === 'ar' ? 'عام — معامل مدينة' : 'General — City Factor';
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
  peopleManualOverride = false;
  var roomKey = inferRoomStandardKey(curRoom);
  applyRoomEquipmentPreset(roomKey);
  renderSelectedRoomPreview();
  renderDevs();
  G('breakdown').classList.remove('show');
  G('hc-card').style.display='none';
  flash('vtr','0.00'); flash('vcfm','0'); flash('vbtu','0'); flash('vmkt','0');
  trackAppEvent('room_type_selected', {
    room_type: r.id || rid || '',
    language: currentAnalyticsLanguage(),
    is_healthcare: !!(r && r.mode === 'hc')
  });
}

// Expose inline HTML handlers explicitly.
window.goPanel = goPanel;
window.openDesktopView = openDesktopView;
window.toggleDesktopSidebar = toggleDesktopSidebar;
window.syncDesktopProjectFields = syncDesktopProjectFields;
window.toggleDD = toggleDD;
window.closeAllDD = closeAllDD;
window.pickRoom = pickRoom;
window.stepRoomNumber = stepRoomNumber;
window.onRoomCountInput = onRoomCountInput;
window.onLoadFactorPresetChange = onLoadFactorPresetChange;
window.onLoadFactorInput = onLoadFactorInput;
window.onCityChange = onCityChange;
window.onInsulationTypeChange = onInsulationTypeChange;
window.onWindowAreaInput = onWindowAreaInput;
window.onExposureTypeChange = onExposureTypeChange;
window.onPplInput = onPplInput;
window.onDimInput = onDimInput;
window.onVolInput = onVolInput;
window.setResultsMode = setResultsMode;
window.toggleCalcRoom = toggleCalcRoom;
window.stepProjQty = stepProjQty;
window.setProjQtyManual = setProjQtyManual;
window.setProjectQtyAuto = setProjectQtyAuto;
window.setProjWorkflowType = setProjWorkflowType;
window.setProjWorkflowCapacity = setProjWorkflowCapacity;
window.setRoomAssignmentMode = setRoomAssignmentMode;
window.addRoomSystem = addRoomSystem;
window.updateRoomSystem = updateRoomSystem;
window.incrementSystemQty = incrementSystemQty;
window.decrementSystemQty = decrementSystemQty;
window.removeRoomSystem = removeRoomSystem;
window.connectRoomToProjectSystem = connectRoomToProjectSystem;
window.assignRoomToProjectSystem = assignRoomToProjectSystem;
window.clearRoomProjectSystemAssignment = clearRoomProjectSystemAssignment;
window.connectRoomToExistingZone = connectRoomToExistingZone;
window.createZoneForRoom = createZoneForRoom;
window.addProjectSystem = addProjectSystem;
window.updateProjectSystem = updateProjectSystem;
window.incrementProjectSystemQty = incrementProjectSystemQty;
window.decrementProjectSystemQty = decrementProjectSystemQty;
window.removeProjectSystem = removeProjectSystem;
window.applyBestProjectSystemAutomatically = applyBestProjectSystemAutomatically;
window.generateHvacDesignScenarios = generateHvacDesignScenarios;
window.compareHvacDesignScenario = compareHvacDesignScenario;
window.selectHvacDesignScenario = selectHvacDesignScenario;
window.toggleProjectSystemCapacityMenu = toggleProjectSystemCapacityMenu;
window.selectProjectSystemCapacityOption = selectProjectSystemCapacityOption;
window.closeProjectEquipmentMenus = closeProjectEquipmentMenus;
var roomUnitControlsBound = false;
function bindRoomUnitControlDelegates(){
  roomUnitControlsBound = true;
}
bindRoomUnitControlDelegates();
bindQuotationLivePricingDelegates();
window.addZoneSystem = addZoneSystem;
window.updateZoneSystem = updateZoneSystem;
window.incrementZoneSystemQty = incrementZoneSystemQty;
window.decrementZoneSystemQty = decrementZoneSystemQty;
window.removeZoneSystem = removeZoneSystem;
window.deleteZone = deleteZone;
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
window.updateQuotationLineLive = updateQuotationLineLive;
window.updateQuotationLine = updateQuotationLine;
window.updateQuotationDraftFieldLive = updateQuotationDraftFieldLive;
window.updateQuotationDraftField = updateQuotationDraftField;
window.addQuotationCommercialLine = addQuotationCommercialLine;
window.removeQuotationCommercialLine = removeQuotationCommercialLine;
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
function normalizeEquipmentPresetItems(list){
  return (Array.isArray(list) ? list : []).map(function(item){
    return {
      id: typeof item === 'string' ? item : item.id,
      qty: item && typeof item === 'object' && item.qty ? Number(item.qty) : 1
    };
  }).filter(function(item){ return !!item.id; }).sort(function(a,b){ return a.id.localeCompare(b.id); });
}
function equipmentItemSetsMatch(expected, actual){
  if(expected.length !== actual.length) return false;
  for(var i=0;i<expected.length;i++){
    if(expected[i].id !== actual[i].id || Number(expected[i].qty || 1) !== Number(actual[i].qty || 1)) return false;
  }
  return true;
}
function formatEquipmentPresetNames(items, savedItems){
  return items.map(function(item){
    var saved = (savedItems || []).filter(function(x){ return x && x.id === item.id; })[0];
    var d = DEVS.filter(function(x){ return x.id === item.id; })[0];
    var name = d ? (lang === 'ar' ? d.ar : d.en) : (saved && saved.name ? saved.name : item.id);
    return name + (Number(item.qty || 1) > 1 ? ' × ' + item.qty : '');
  });
}
function getEquipmentPresetMetaFromItems(room, items, totalBtu){
  if(!room || !ROOM_EQUIPMENT_PRESETS || !items || !items.length) return null;
  var roomKey = inferRoomStandardKey(room);
  var preset = ROOM_EQUIPMENT_PRESETS[roomKey];
  if(!preset || !Array.isArray(preset) || !preset.length) return null;
  var expected = normalizeEquipmentPresetItems(preset);
  var actual = normalizeEquipmentPresetItems(items);
  if(!equipmentItemSetsMatch(expected, actual)) return null;
  return {
    roomKey: roomKey,
    names: formatEquipmentPresetNames(expected, items),
    totalBtu: Number(totalBtu || 0)
  };
}
function getActiveEquipmentPresetMeta(){
  return getEquipmentPresetMetaFromItems(curRoom, devs, totalDevBtu());
}
function getRecordEquipmentPresetMeta(h){
  if(!h || !h.equipmentItems || !h.equipmentItems.length) return null;
  var room = h.rid && ROOMS[h.rid] ? ROOMS[h.rid] : {id:h.rid, ar:h.ar, en:h.en, mode:h.calcMode === 'hc' ? 'hc' : 'rot'};
  return getEquipmentPresetMetaFromItems(room, h.equipmentItems, h.equipmentBtu);
}
function renderDevs(){
  var list=G('dev-list'); list.innerHTML='';
  if(!devs.length){
    var em=document.createElement('div'); em.className='dev-empty'; em.textContent=t('dempty');
    list.appendChild(em); G('dev-total').style.display='none'; scheduleLiveRoomSync(); return;
  }
  var presetMeta = getActiveEquipmentPresetMeta();
  if(presetMeta){
    var note=document.createElement('div');
    note.className='dev-preset-note';
    note.innerHTML='<strong>'+(lang==='ar'?'أجهزة افتراضية للغرفة':'Default room equipment')+'</strong>'+
      '<span>'+(lang==='ar'
        ? 'تمت إضافتها تلقائيًا وتدخل ضمن حمل الأجهزة: '
        : 'Automatically added and included in device heat load: ')+
      esc(presetMeta.names.join('، '))+' · '+presetMeta.totalBtu.toLocaleString()+' BTU/h</span>';
    list.appendChild(note);
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
  scheduleLiveRoomSync();
}
function chgQty(id,d){
  for(var i=0;i<devs.length;i++){if(devs[i].id===id){devs[i].qty+=d;if(devs[i].qty<=0)devs.splice(i,1);break;}}
  renderDevs();
}
function delDev(id){ devs=devs.filter(function(d){return d.id!==id;}); renderDevs(); }

// ── MODAL ─────────────────────────────────────────────────────────────────
function openModal(){
  var overlay = G('overlay');
  var grid = G('cat-grid');
  if(!overlay || !grid){
    if(window.toast) toast(lang==='ar' ? 'نافذة الأجهزة غير متاحة حالياً' : 'Device picker is not available right now');
    return;
  }
  buildGrid(null);
  document.querySelectorAll('.ftab').forEach(function(t,i){t.className='ftab'+(i===0?' on':'');});
  overlay.classList.add('on');
}
function closeModal(){ var overlay = G('overlay'); if(overlay) overlay.classList.remove('on'); }
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
  var ROOM_STANDARD_KEY_BY_ROOM_ID = {
    h_patient_room:'patient_room',
    h_corridor:'corridor',
    h_or:'operating_room',
    h_icu:'icu',
    h_ccu:'icu',
    h_exam:'exam_room',
    h_treatment:'treatment_room',
    h_isolation:'isolation_room',
    h_airborne:'isolation_room',
    h_protective:'protective_environment',
    h_nicu:'nicu',
    h_lab:'laboratory',
    h_pathology:'laboratory',
    h_autopsy:'laboratory',
    h_cath_lab:'cath_lab',
    h_cardiac_cath:'cath_lab',
    h_ep_lab:'cath_lab',
    h_ir_lab:'cath_lab',
    h_neuro_angio:'cath_lab',
    h_hybrid_or:'operating_room',
    h_sterile_decontam:'sterile_processing',
    h_sterile_clean:'sterile_processing',
    h_sterile_storage:'sterile_processing',
    h_waiting:'waiting_area',
    h_pharmacy:'pharmacy_clean',
    h_clean:'sterile_processing'
  };
  function titlePressure(value){
    var p=String(value||'neutral').toLowerCase();
    if(p==='positive') return 'Positive';
    if(p==='negative') return 'Negative';
    return 'Neutral';
  }
  function makeRoomSpecificHealthcareStandard(room){
    return {
      category:'healthcare_room_specific',
      roomType:room ? (room.en||room.ar||'Healthcare Room') : 'Healthcare Room',
      ach:room && room.tach != null ? room.tach : null,
      oa:room && room.oach != null ? room.oach : null,
      exhaust:null,
      pressure:titlePressure(room && room.pres),
      notes:'Room-specific healthcare data; source confirmation required'
    };
  }
  return {
    inferRoomStandardKey:function(room){
      if(!room) return 'office';
      var rid=(room.id||'').toLowerCase();
      var en=(room.en||'').toLowerCase();
      if(ROOM_STANDARD_KEY_BY_ROOM_ID[rid]) return ROOM_STANDARD_KEY_BY_ROOM_ID[rid];
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
      if(room.mode === 'hc') return 'healthcare_room_specific';
      return 'office';
    },
    getRoomStandard:function(room){
      var key=this.inferRoomStandardKey(room);
      if(ROOM_STANDARDS[key]) return ROOM_STANDARDS[key];
      if(room && room.mode === 'hc') return makeRoomSpecificHealthcareStandard(room);
      return {
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
    syncPeopleEstimate(false);
    return {volume:displayVol,dims:lastRoomDims,complete:true,source:'dimensions'};
  }
  if(dims.hasAny){
    if(volEl) volEl.value='';
    if(volEl) delete volEl.dataset[LEGACY_VOL_KEY];
    lastRoomDims=null;
    syncPeopleEstimate(false);
    return {volume:0,dims:null,complete:false,source:'incomplete'};
  }
  if(volEl && volEl.dataset[LEGACY_VOL_KEY]){
    var legacyVol=parseFloat(volEl.dataset[LEGACY_VOL_KEY])||0;
    volEl.value=formatVolumeValue(legacyVol);
    lastRoomDims=null;
    syncPeopleEstimate(false);
    return {volume:legacyVol,dims:null,complete:false,source:'legacy'};
  }
  if(volEl) volEl.value='';
  lastRoomDims=null;
  syncPeopleEstimate(false);
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
function onDimInput(){ setRoomVolumeFromDimensions(); scheduleLiveRoomSync(); }
function onVolInput(){ setRoomVolumeFromDimensions(); scheduleLiveRoomSync(); }
function onPplInput(){
  normalizeNumericInput(G('inp-ppl'));
  if(!_syncingPeopleEstimate) peopleManualOverride = true;
  updateOccupancyHelper();
  scheduleLiveRoomSync();
}
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
  scheduleLiveRoomSync();
}

function parsePositiveFieldValue(id){
  var el = G(id);
  var raw = normalizeNumericInput(el);
  if(!raw) return 0;
  return Math.max(0, parseFloat(raw) || 0);
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

function getCityConfig(cityKey){
  return CITY_FACTORS[cityKey] || CITY_FACTORS[DEFAULT_CITY_KEY];
}

function getSelectedCityKey(){
  var el = G('inp-load-factor-preset');
  return (el && el.value && CITY_FACTORS[el.value]) ? el.value : DEFAULT_CITY_KEY;
}

function isHealthcareRoom(room){
  return !!(room && room.mode === 'hc');
}

function isMosqueRoom(room){
  return !!(room && room.id === 'r_mosque');
}

function populateCityOptions(selectEl){
  if(!selectEl) return;
  var selected = getSelectedCityKey();
  selectEl.innerHTML = CITY_FACTOR_ORDER.map(function(cityKey){
    var city = getCityConfig(cityKey);
    var label = lang === 'ar' ? city.ar : city.en;
    return '<option value="'+cityKey+'">'+label+'</option>';
  }).join('');
  selectEl.value = selected;
}

function populateExposureOptions(selectEl){
  if(!selectEl) return;
  var current = selectEl.value || 'shaded';
  selectEl.innerHTML = ''+
    '<option value="shaded">'+t('lexpshaded')+'</option>'+
    '<option value="direct">'+t('lexpdirect')+'</option>';
  selectEl.value = WINDOW_EXPOSURE[current] ? current : 'shaded';
}

function populateInsulationOptions(selectEl){
  if(!selectEl) return;
  var current = selectEl.value || 'medium';
  selectEl.innerHTML = ''+
    '<option value="excellent">'+t('linsulexcellent')+'</option>'+
    '<option value="medium">'+t('linsulmedium')+'</option>'+
    '<option value="none">'+t('linsulnone')+'</option>';
  selectEl.value = INSULATION_TYPES[current] ? current : 'medium';
}

function getSelectedCityFactor(){
  return Number(getCityConfig(getSelectedCityKey()).factor || 265);
}

function getEffectiveFactor(){
  return getSelectedCityFactor();
}

function setLoadFactorPresetValue(){
  updateFactorInputsUI();
}

function setLoadFactorInputMode(isCustom){
  updateFactorInputsUI();
}

function updateFactorInputsUI(){
  var factorEl = G('inp-load-factor');
  var cityEl = G('inp-load-factor-preset');
  var isHC = isHealthcareRoom(curRoom);
  if(cityEl){
    if(!cityEl.value || !CITY_FACTORS[cityEl.value]) cityEl.value = DEFAULT_CITY_KEY;
    cityEl.disabled = isHC;
  }
  if(factorEl){
    factorEl.value = String(Math.round(getSelectedCityFactor()));
  }
}

function syncLoadFactorFromRoom(room){
  var cityEl = G('inp-load-factor-preset');
  if(cityEl){
    cityEl.value = DEFAULT_CITY_KEY;
    populateCityOptions(cityEl);
    cityEl.value = DEFAULT_CITY_KEY;
  }
  var insEl = G('inp-insulation-type');
  if(insEl) populateInsulationOptions(insEl);
  if(insEl) insEl.value = 'medium';
  var expEl = G('inp-exposure-type');
  if(expEl) populateExposureOptions(expEl);
  if(expEl) expEl.value = 'shaded';
  var winEl = G('inp-window-area');
  if(winEl) winEl.value = '';
  peopleManualOverride = false;
  updateFactorInputsUI();
  updateOccupancyHelper();
}

function onCityChange(){
  updateFactorInputsUI();
  trackAppEvent('city_selected', {
    city: getSelectedCityKey(),
    language: currentAnalyticsLanguage(),
    is_healthcare: isHealthcareRoom(curRoom)
  });
  scheduleLiveRoomSync();
}

function onFactorModeChange(){ updateFactorInputsUI(); }
function onCustomFactorInput(){ updateFactorInputsUI(); scheduleLiveRoomSync(); }

function onLoadFactorPresetChange(){ onCityChange(); }
function onLoadFactorInput(){ updateFactorInputsUI(); scheduleLiveRoomSync(); }

function getInsulationConfig(){
  var insEl = G('inp-insulation-type');
  var key = insEl && INSULATION_TYPES[insEl.value] ? insEl.value : 'medium';
  var item = INSULATION_TYPES[key];
  return { key:key, label:lang === 'ar' ? item.ar : item.en, multiplier:Number(item.multiplier||1) };
}

function onInsulationTypeChange(){
  updateOccupancyHelper();
  scheduleLiveRoomSync();
}

function getWindowArea(){
  return parsePositiveFieldValue('inp-window-area');
}

function getWindowExposureConfig(){
  var expEl = G('inp-exposure-type');
  var key = expEl && WINDOW_EXPOSURE[expEl.value] ? expEl.value : 'shaded';
  var item = WINDOW_EXPOSURE[key];
  return { key:key, label:lang === 'ar' ? item.ar : item.en, factor:Number(item.factor||0) };
}

function getWindowLoad(){
  var exposure = getWindowExposureConfig();
  return getWindowArea() * exposure.factor;
}

function onWindowAreaInput(){
  parsePositiveFieldValue('inp-window-area');
  scheduleLiveRoomSync();
}

function onExposureTypeChange(){
  updateOccupancyHelper();
  scheduleLiveRoomSync();
}

function getPeopleDensityForRoom(room){
  if(!room) return 10;
  if(room.id === 'r_mosque') return 1.0;
  if(room.id === 'r_classroom') return 2.0;
  if(room.id === 'r_restaurant') return 1.5;
  return 10;
}

function getRoomArea(){
  var dims = readRoomDimensions();
  if(dims.len > 0 && dims.width > 0) return dims.len * dims.width;
  if(lastRoomDims && lastRoomDims.len > 0 && lastRoomDims.width > 0) return Number(lastRoomDims.len) * Number(lastRoomDims.width);
  return 0;
}

function getEstimatedPeopleCount(){
  var area = getRoomArea();
  var density = getPeopleDensityForRoom(curRoom);
  if(!area || !density) return 0;
  return Math.max(0, Math.round(area / density));
}

function updateOccupancyHelper(){
  var helper = G('occupancy-helper');
  if(!helper) return;
  if(isHealthcareRoom(curRoom)){
    helper.textContent = t('healthcaremode');
    return;
  }
  var manualText = peopleManualOverride ? ' — ' + t('occmanual') : '';
  helper.textContent = t('peopleautohelper') + manualText;
}

function syncPeopleEstimate(force){
  if(isHealthcareRoom(curRoom)){
    updateOccupancyHelper();
    return 0;
  }
  var pplEl = G('inp-ppl');
  if(!pplEl) return 0;
  var estimated = getEstimatedPeopleCount();
  if(force || !peopleManualOverride){
    _syncingPeopleEstimate = true;
    pplEl.value = estimated > 0 ? String(estimated) : '';
    _syncingPeopleEstimate = false;
  }
  updateOccupancyHelper();
  return estimated;
}

function onOccupancyTypeChange(){}

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
  scheduleLiveRoomSync();
}

function updateCalculationModeUI(room){
  var row = G('load-factor-row');
  var helper = G('load-factor-helper');
  var note = G('calc-mode-note');
  var freshAirRow = G('fresh-air-row');
  var advancedInputs = G('advanced-inputs');
  var isHC = isHealthcareRoom(room);
  if(row) row.style.display = isHC ? 'none' : '';
  if(helper) helper.style.display = isHC ? 'none' : '';
  if(advancedInputs) advancedInputs.style.display = isHC ? 'none' : '';
  if(freshAirRow) freshAirRow.style.display = isHC ? '' : 'none';
  updateFactorInputsUI();
  updateOccupancyHelper();
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

function getFreshAirMode(){
  return hcFreshAirMode === 'fresh100' ? 'fresh100' : 'ashrae';
}

function getSelectedLoadFactor(){
  return getEffectiveFactor();
}

function getRoomCount(){
  var el=G('inp-room-count');
  var n=el?parseInt(el.value,10):1;
  return Math.max(1,n||1);
}
function doCalc(silentMode){
  var wasEditing = editIdx >= 0;
  var volState=setRoomVolumeFromDimensions();
  if(curRoom && curRoom.mode !== 'hc' && !peopleManualOverride) syncPeopleEstimate(true);
  var vol=volState.volume||0;
  var ppl=parseInt(G('inp-ppl').value)||0;
  if(!curRoom){
    toast(lang==='ar'?'⚠️ اختر نوع الغرفة أولاً':'⚠️ Select room type first');
    return;
  }
  if(!vol){ if(!silentMode) toast(t('tnov')); return; }
  trackAppEvent('calculate_click', {
    room_type: currentAnalyticsRoomType(),
    city: isHealthcareRoom(curRoom) ? '' : getSelectedCityKey(),
    language: currentAnalyticsLanguage(),
    is_healthcare: isHealthcareRoom(curRoom)
  });
  if(curRoom.mode==='hc') calcHC(vol,ppl,silentMode);
  else calcROT(vol,ppl,silentMode);
  if(!wasEditing){
    setTimeout(function(){
      resetCalcEntryForm();
    }, 0);
  }
}
function calcROT(vol,ppl,silentMode){
  var cityKey = getSelectedCityKey();
  var city = getCityConfig(cityKey);
  var cityFactor = getSelectedCityFactor();
  var effectiveFactor = getEffectiveFactor();
  var insulation = getInsulationConfig();
  var windowArea = getWindowArea();
  var exposure = getWindowExposureConfig();
  var windowLoad = getWindowLoad();
  var devb=totalDevBtu();
  var eng = window.AirCalcEngineering ? window.AirCalcEngineering.calculateGeneralRoom({
    volumeM3: vol,
    loadFactorBtuhPerM3: effectiveFactor,
    insulationMultiplier: insulation.multiplier,
    windowLoadBtuh: windowLoad,
    peopleCount: ppl,
    deviceLoadBtuh: devb
  }) : null;
  var base=eng && eng.ok ? eng.baseBtuh : vol*effectiveFactor*insulation.multiplier;
  var pplb=eng && eng.ok ? eng.peopleBtuh : ppl*400;
  var sub=eng && eng.ok ? eng.subtotalBtuh : base+windowLoad+pplb+devb;
  var total=eng && eng.ok ? eng.totalBtuh : sub*1.10;
  var tr=eng && eng.ok ? eng.tr : total/12000;
  var cfm=eng && eng.ok ? eng.supplyCfm : Math.round(tr*400);
  var mkt=eng && eng.ok ? eng.marketBtuh : Math.ceil(total/9000)*9000;
  var std=getRoomStandard(curRoom);
  flash('vtr',tr.toFixed(2)); flash('vcfm',cfm.toLocaleString()); flash('vbtu',Math.round(total).toLocaleString()); flash('vmkt',mkt.toLocaleString());
  G('brv-vol').textContent=vol; G('brv-base').textContent=Math.round(base).toLocaleString();
  G('brv-window').textContent=Math.round(windowLoad).toLocaleString();
  G('brv-ppl').textContent=Math.round(pplb).toLocaleString(); G('brv-dev').textContent=Math.round(devb).toLocaleString();
  G('brv-sub').textContent=Math.round(sub).toLocaleString(); G('brv-sf').textContent=Math.round(total).toLocaleString();
  var metaGrid = G('breakdown-meta-grid');
  if(metaGrid) metaGrid.style.display = '';
  if(G('brm-city-val')) G('brm-city-val').textContent = lang === 'ar' ? city.ar : city.en;
  if(G('brm-factor-val')) G('brm-factor-val').textContent = Math.round(effectiveFactor) + ' BTU/m³';
  if(G('brm-insulation-val')) G('brm-insulation-val').textContent = insulation.label;
  if(G('brm-multiplier-val')) G('brm-multiplier-val').textContent = insulation.multiplier.toFixed(2);
  if(G('brm-people-val')) G('brm-people-val').textContent = ppl.toLocaleString();
  if(G('brm-window-area-val')) G('brm-window-area-val').textContent = Number(windowArea||0).toLocaleString() + ' m²';
  G('breakdown').classList.add('show');
  updateRoomStandardCard(std, cfm);
  G('hc-card').style.display='block';
  saveHist(vol,ppl,tr,cfm,total,mkt,devb,{
    loadFactor: effectiveFactor,
    cityKey: cityKey,
    cityLabelAr: city.ar,
    cityLabelEn: city.en,
    cityFactor: cityFactor,
    insulationType: insulation.key,
    insulationLabelAr: INSULATION_TYPES[insulation.key].ar,
    insulationLabelEn: INSULATION_TYPES[insulation.key].en,
    insulationMultiplier: insulation.multiplier,
    windowArea: windowArea,
    exposureType: exposure.key,
    exposureLabelAr: WINDOW_EXPOSURE[exposure.key].ar,
    exposureLabelEn: WINDOW_EXPOSURE[exposure.key].en,
    windowFactor: exposure.factor,
    windowLoad: windowLoad,
    manualOverride: peopleManualOverride,
    peopleManualOverride: peopleManualOverride,
    peopleLoad: pplb,
    baseLoad: base,
    subtotalLoad: sub,
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
function calcHC(vol,ppl,silentMode){
  var r=curRoom;
  var freshMode = getFreshAirMode();
  var devb=totalDevBtu();
  var eng = window.AirCalcEngineering ? window.AirCalcEngineering.calculateHealthcareRoom({
    volumeM3: vol,
    totalAch: r.tach,
    outdoorAch: r.oach,
    pressure: r.pres,
    freshAirMode: freshMode,
    peopleCount: ppl,
    deviceLoadBtuh: devb
  }) : null;
  var ft3=m3toft3(vol);
  var sup=eng && eng.ok ? eng.supplyCfm : Math.round((r.tach*ft3)/60);
  var oa=eng && eng.ok ? eng.outdoorAirCfm : (freshMode === 'fresh100' ? Math.round((r.tach*ft3)/60) : Math.round((r.oach*ft3)/60));
  var recirc=eng && eng.ok ? eng.recirculatedCfm : Math.max(0,sup-oa);
  var exh=eng && eng.ok ? eng.exhaustCfm : (r.pres==='negative'?Math.round(sup*1.10):r.pres==='positive'?Math.round(sup*0.90):sup);
  var base=eng && eng.ok ? eng.baseBtuh : sup*1.08*20;
  var pplb=eng && eng.ok ? eng.peopleBtuh : ppl*400;
  var sub=eng && eng.ok ? eng.subtotalBtuh : base+pplb+devb;
  var total=eng && eng.ok ? eng.totalBtuh : sub*1.10;
  var tr=eng && eng.ok ? eng.tr : total/12000;
  var mkt=eng && eng.ok ? eng.marketBtuh : Math.ceil(total/9000)*9000;
  flash('vtr',tr.toFixed(2)); flash('vcfm',sup.toLocaleString()); flash('vbtu',Math.round(total).toLocaleString()); flash('vmkt',mkt.toLocaleString());
  G('brv-vol').textContent=vol; G('brv-base').textContent=Math.round(base).toLocaleString();
  G('brv-window').textContent='0';
  G('brv-ppl').textContent=Math.round(pplb).toLocaleString(); G('brv-dev').textContent=Math.round(devb).toLocaleString();
  G('brv-sub').textContent=Math.round(sub).toLocaleString(); G('brv-sf').textContent=Math.round(total).toLocaleString();
  var metaGrid = G('breakdown-meta-grid');
  if(metaGrid) metaGrid.style.display = 'none';
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
    tempRange:Array.isArray(r.tr) ? r.tr.slice() : null,
    rhRange:Array.isArray(r.rh) ? r.rh.slice() : null,
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
  var isHCMode = curRoom && curRoom.mode === 'hc';
  var rec={
    time:new Date().toLocaleString('ar-SA'),
    rid:curRoom.id, ar:curRoom.ar, en:curRoom.en,
    vol:vol, ppl:ppl, peopleCount:ppl, roomCount:roomCount, loadFactor:isHCMode ? 0 : getSelectedLoadFactor(),
    calcMode: isHCMode ? 'hc' : 'rot',
    dims:lastRoomDims,
    devSum:eq.text,
    devBtu:eq.totalBtu,
    equipmentItems:eq.items,
    equipmentBtu:eq.totalBtu,
    equipmentWatt:eq.totalWatt,
    tr:tr.toFixed(2), cfm:cfm, btu:Math.round(totalBtu), mkt:mkt
  };
  if(hcdata){
    Object.keys(hcdata).forEach(function(key){
      if(hcdata[key] !== undefined) rec[key] = hcdata[key];
    });
    if(hcdata.oa != null) rec.oaStd = hcdata.oa;
  }
  var _copies = Math.max(1, parseInt(rec.roomCount,10) || 1);
  function _makeExpandedRecords(baseRec){
    var records = [];
    for(var ci=0; ci<_copies; ci++){
      var clone = JSON.parse(JSON.stringify(baseRec));
      clone.roomCount = 1;
      records.push(clone);
    }
    return records;
  }
  function _makeExpandedLines(baseLine, unitTypeHint){
    var lines = [];
    for(var li=0; li<_copies; li++){
      var lineClone = JSON.parse(JSON.stringify(baseLine || {qty:1,up:0,unitType:unitTypeHint || 'split',selectedBtu:0,qtyAuto:true,autoReason:''}));
      lineClone.roomRecordId = '';
      lines.push(lineClone);
    }
    return lines;
  }
  if(editIdx>=0&&editIdx<hist.length){
    var _editAt=editIdx;
    var _baseLine = ensureQuoteLine(_editAt);
    var _records = _makeExpandedRecords(rec);
    var _lines = _makeExpandedLines(_baseLine, _baseLine.unitType || 'split');
    hist.splice.apply(hist, [_editAt, 1].concat(_records));
    qlines.splice.apply(qlines, [_editAt, 1].concat(_lines));
    editIdx=-1;
    calcRoomsOpenIdx = _editAt;
    for(var ei=0; ei<_records.length; ei++){
      ensureRoomRecordId(_editAt + ei);
      if(!(qlines[_editAt + ei].systems && qlines[_editAt + ei].systems.length)){
        syncQuoteLineRecommendation(_editAt + ei,{keepSelectedCapacity:getQtyAuto(_editAt + ei)});
      } else {
        syncRoomSystemState(_editAt + ei);
      }
    }
  } else {
    var _pUT=(qlines.length>0?qlines[qlines.length-1].unitType:'')||'split';
    var _newRecords = _makeExpandedRecords(rec);
    var _newLines = _makeExpandedLines({qty:1,up:0,unitType:_pUT,selectedBtu:0,qtyAuto:true,autoReason:''}, _pUT);
    var _startIdx = hist.length;
    Array.prototype.push.apply(hist, _newRecords);
    Array.prototype.push.apply(qlines, _newLines);
    calcRoomsOpenIdx = _startIdx;
    for(var ni=0; ni<_newRecords.length; ni++){
      ensureRoomRecordId(_startIdx + ni);
      syncQuoteLineRecommendation(_startIdx + ni,{unitType:_pUT});
    }
    while(hist.length>100){hist.shift();qlines.shift();}
  }
  syncProjectRecommendation({keepSelectedCapacity:getProjectQtyAuto()});
  if(typeof recalcProjectTotals === 'function') recalcProjectTotals();
  save(); renderHist();
  if(typeof renderCalcWorkflowCard === 'function') renderCalcWorkflowCard();
  if(typeof renderTechReport === 'function') renderTechReport();
  if(typeof renderQuotation === 'function') renderQuotation();
  if(typeof refreshGrandTotal === 'function') refreshGrandTotal();
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
  var loadFactorEl = G('inp-load-factor'); if(loadFactorEl) loadFactorEl.value = String(getCityConfig(DEFAULT_CITY_KEY).factor);
  var loadFactorPresetEl = G('inp-load-factor-preset'); if(loadFactorPresetEl) loadFactorPresetEl.value = DEFAULT_CITY_KEY;
  var windowAreaEl = G('inp-window-area'); if(windowAreaEl) windowAreaEl.value = '';
  var exposureEl = G('inp-exposure-type'); if(exposureEl) exposureEl.value = 'shaded';
  var insulationEl = G('inp-insulation-type'); if(insulationEl) insulationEl.value = 'medium';
  peopleManualOverride = false;
  setFreshAirMode('ashrae');
  updateFactorInputsUI();
  updateCalculationModeUI(null);
  devs = [];
  renderDevs();
  G('breakdown').classList.remove('show');
  if(G('breakdown-meta-grid')) G('breakdown-meta-grid').style.display = 'none';
  G('hc-card').style.display='none';
}

function toggleCalcRoom(idx){
  calcRoomsOpenIdx = (calcRoomsOpenIdx === idx) ? -1 : idx;
  renderCalcWorkflowCard();
  renderCalcRooms();
}

function startNewRoomEntry(){
  editIdx = -1;
  calcRoomsOpenIdx = -1;
  resetCalcEntryForm();
  goPanel('calc');
  var target = G('p-calc');
  if(target && target.scrollIntoView) target.scrollIntoView({ behavior:'smooth', block:'start' });
  toast(lang==='ar' ? 'ابدأ بإدخال الغرفة التالية ثم اضغط احسب.' : 'Start entering the next room, then click calculate.');
}

var roomLiveSyncTimer = null;
function scheduleLiveRoomSync(){
  if(editIdx < 0 || !curRoom) return;
  if(roomLiveSyncTimer) clearTimeout(roomLiveSyncTimer);
  roomLiveSyncTimer = setTimeout(function(){
    doCalc(true);
  }, 180);
}

function duplicateRec(idx){
  var h = hist[idx];
  if(!h) return;
  syncAllRoomSystemStates();
  var clonedHist = JSON.parse(JSON.stringify(h));
  delete clonedHist._roomRecordId;
  clonedHist.time = new Date().toLocaleString('ar-SA');
  hist.splice(idx + 1, 0, clonedHist);
  var qline = ensureQuoteLine(idx);
  var clonedLine = JSON.parse(JSON.stringify(qline));
  delete clonedLine.roomRecordId;
  clonedLine.assignment = normalizeRoomAssignment({ mode:'independent', zoneId:'' });
  qlines.splice(idx + 1, 0, clonedLine);
  ensureRoomRecordId(idx + 1);
  calcRoomsOpenIdx = idx + 1;
  persistQuoteState();
  renderHist();
  renderCalcWorkflowCard();
  renderTechReport();
  renderQuotation();
  refreshGrandTotal();
  toast(lang==='ar' ? '✅ تم نسخ الغرفة' : '✅ Room duplicated');
}

function ensureWorkflowPrimarySystem(i){
  var systems = ensureRoomSystems(i);
  if(!systems.length){
    systems.push(normalizeQuoteSystem({
      unitType: getUT(i) || 'split',
      selectedBtu: getSelBtu(i) || getDefaultSystemCapacity(getUT(i) || 'split'),
      qty: Math.max(1, getQty(i) || 1)
    }));
  }
  return normalizeQuoteSystem(systems[0]);
}

function setRoomWorkflowUnitType(i, unitType){
  var primary = ensureWorkflowPrimarySystem(i);
  updateRoomSystem(i, primary.id, 'unitType', unitType);
  updateRoomSystem(i, primary.id, 'selectedBtu', getDefaultSystemCapacity(unitType));
}

function setRoomWorkflowCapacity(i, value){
  var primary = ensureWorkflowPrimarySystem(i);
  updateRoomSystem(i, primary.id, 'selectedBtu', parseInt(value,10) || primary.selectedBtu || 0);
}

function stepRoomWorkflowQty(i, delta){
  var primary = ensureWorkflowPrimarySystem(i);
  var next = Math.max(1, (parseInt(primary.qty,10) || 1) + (parseInt(delta,10) || 0));
  updateRoomSystem(i, primary.id, 'qty', next);
}
function recalcCentralProjectSystem(){
  recalcProjectTotals();
  persistQuoteState();
  rerenderAfterProjectUnitChange();
}
function setProjWorkflowType(unitType){
  projState.sysType = getAllowedSystemType(unitType);
  projState.selBtu = getDefaultSystemCapacity(projState.sysType);
  projState.qtyAuto = false;
  projState.autoReason = buildAutoQtyReason('manual');
  recalcCentralProjectSystem();
}
function setProjWorkflowCapacity(value){
  projState.selBtu = Math.max(0, parseInt(value,10) || 0);
  projState.qtyAuto = false;
  projState.autoReason = buildAutoQtyReason('manual');
  recalcCentralProjectSystem();
}

function openRoomUnitWorkflow(i){
  calcRoomsOpenIdx = i;
  goPanel('tech');
  setTimeout(function(){
    var cards = document.querySelectorAll('.room-tech-card,.qi-item');
    if(cards && cards[i] && cards[i].scrollIntoView) cards[i].scrollIntoView({behavior:'smooth',block:'start'});
  }, 80);
}

function getWorkflowRoomArea(h){
  if(!h) return 0;
  if(h.dims && h.dims.len && h.dims.width){
    var baseArea = (Number(h.dims.len) || 0) * (Number(h.dims.width) || 0);
    return baseArea * Math.max(1, parseInt(h.roomCount,10) || 1);
  }
  return 0;
}

function getWorkflowStatusMeta(i, roomState){
  var assignment = getRoomAssignment(i);
  if(quoteMode !== 'proj'){
    assignment = { mode:'independent', zoneId:'', projectSystemId:'' };
  }
  if(assignment.mode === 'project'){
    return {
      key:'project',
      label: assignment.projectSystemId
        ? (lang==='ar' ? 'مرتبطة بوحدة مشروع' : 'Linked to project system')
        : (lang==='ar' ? 'غير معينة' : 'Unassigned'),
      tone:'na'
    };
  }
  if(!roomState.systems || !roomState.systems.length){
    return {
      key:'none',
      label: lang==='ar' ? 'لا يوجد وحدة' : 'No unit assigned',
      tone:'fail'
    };
  }
  var st = roomState.capacityStatusMeta || getCapacityStatus(roomState.requiredBtu, roomState.selectedCapacityBtu);
  return {
    key: st.key,
    label: st.label || (lang==='ar' ? 'يحتاج مراجعة' : 'Review'),
    tone: st.key === 'matched' ? 'pass' : (st.key === 'undersized' ? 'fail' : 'review')
  };
}

function getWorkflowAssignedSystemText(i, roomState){
  var assignment = getRoomAssignment(i);
  if(quoteMode !== 'proj'){
    assignment = { mode:'independent', zoneId:'', projectSystemId:'' };
  }
  if(assignment.mode === 'project'){
    return assignment.projectSystemId
      ? ((lang==='ar' ? 'مرتبطة بـ ' : 'Linked to ') + getProjectSystemDisplayName(assignment.projectSystemId))
      : (lang==='ar' ? 'لم يتم ربطها بوحدة مشروع بعد' : 'Not linked to a project system yet');
  }
  if(!roomState.systems || !roomState.systems.length){
    return lang==='ar' ? 'لم يتم تعيين وحدة بعد' : 'No unit assigned yet';
  }
  if(roomState.systems.length > 1){
    return lang==='ar'
      ? 'أنظمة متعددة · ' + Number(roomState.selectedCapacityBtu || 0).toLocaleString() + ' BTU'
      : 'Multiple systems · ' + Number(roomState.selectedCapacityBtu || 0).toLocaleString() + ' BTU';
  }
  var primary = roomState.systems[0];
  var cap = Number(primary.selectedBtu || 0).toLocaleString();
  var qty = Math.max(1, parseInt(primary.qty,10) || 1);
  return utLabel(primary.unitType || 'split') + ' · ' + cap + ' BTU × ' + qty;
}

function buildRoomWorkflowRow(h, idx){
  var roomState = syncRoomSystemState(idx) || getRoomSystemState(idx);
  var rc = Math.max(1, parseInt(h.roomCount,10) || 1);
  var roomName = ((lang==='ar' ? (h.ar || h.en) : (h.en || h.ar)) || (lang==='ar' ? 'غرفة' : 'Room'))
    .replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/gu,'')
    .trim();
  var displayName = roomName + (rc > 1 ? (' × ' + rc) : '');
  var totalArea = getWorkflowRoomArea(h);
  var requiredBtu = getQuoteRequiredBtu(idx);
  var requiredCfm = (parseInt(h.cfm,10) || 0) * rc;
  var requiredTr = requiredBtu / 12000;
  var statusMeta = getWorkflowStatusMeta(idx, roomState);
  var primary = roomState.systems.length === 1 ? roomState.systems[0] : null;
  var unitType = primary ? primary.unitType : ((getUT(idx) || 'split'));
  var selectedBtu = primary ? (parseInt(primary.selectedBtu,10) || 0) : (getSelBtu(idx) || getDefaultSystemCapacity(unitType));
  var catalogs = getCatalog(unitType);
  var typeOptions = ['split','floor','ducted','cassette','package','vrf','ahu','fcu','window'].map(function(k){
    return '<option value="'+k+'"'+(unitType===k?' selected':'')+'>'+esc(utLabel(k))+'</option>';
  }).join('');
  var capOptions = catalogs.map(function(c){
    var lbl = (lang==='ar' ? c.label.ar : c.label.en);
    return '<option value="'+c.btu+'"'+(selectedBtu===c.btu?' selected':'')+'>'+esc(lbl)+'</option>';
  }).join('');
  var unitInline = roomState.systems.length > 1
    ? '<div class="calc-room-multi-note">'+(lang==='ar' ? 'يوجد أكثر من نظام — تابعها من التقرير الفني.' : 'Multiple systems assigned — manage them in Technical Report.')+'</div>'
    : (
      '<div class="calc-room-unit-inline">'+
        '<select class="calc-room-unit-select" onchange="setRoomWorkflowUnitType('+idx+',this.value)">'+typeOptions+'</select>'+
        '<select class="calc-room-unit-select" onchange="setRoomWorkflowCapacity('+idx+',this.value)">'+capOptions+'</select>'+
        '<div class="calc-room-mini-stepper">'+
          '<button type="button" onclick="stepRoomWorkflowQty('+idx+',-1)">−</button>'+
          '<span>'+(primary ? Math.max(1, parseInt(primary.qty,10) || 1) : 1)+'</span>'+
          '<button type="button" onclick="stepRoomWorkflowQty('+idx+',1)">+</button>'+
        '</div>'+
      '</div>'
    );
  var actionButtons =
    '<div class="calc-room-actions-inline">'+
      getRoomActionButtonsHtml(idx, 'is-inline')+
      '<button type="button" class="calc-room-inline-btn primary" onclick="event.stopPropagation();openRoomUnitWorkflow('+idx+')">'+(lang==='ar'?'إدارة الوحدة':'Manage Unit')+'</button>'+
    '</div>';
  return '<div class="calc-room-row'+(calcRoomsOpenIdx===idx?' open':'')+'" data-room-index="'+idx+'">'+
    '<button type="button" class="calc-room-row-main" onclick="toggleCalcRoom('+idx+')">'+
      '<div class="calc-room-col room"><strong>'+esc(displayName)+'</strong><span>'+(totalArea ? (Number(totalArea).toLocaleString()+' m²') : '—')+'</span></div>'+
      '<div class="calc-room-col">'+(totalArea ? Number(totalArea).toLocaleString() : '—')+'</div>'+
      '<div class="calc-room-col">'+Number(requiredBtu || 0).toLocaleString()+'</div>'+
      '<div class="calc-room-col">'+requiredTr.toFixed(2)+'</div>'+
      '<div class="calc-room-col">'+Number(requiredCfm || 0).toLocaleString()+'</div>'+
      (quoteMode === 'room'
        ? '<div class="calc-room-col">'+esc(utLabel(unitType))+'</div><div class="calc-room-col assigned"><strong>'+esc(getWorkflowAssignedSystemText(idx, roomState))+'</strong>'+unitInline+'</div>'
        : ''
      )+
      '<div class="calc-room-col"><span class="calc-room-status-pill is-'+statusMeta.tone+'">'+esc(statusMeta.label)+'</span></div>'+
      '<div class="calc-room-col actions">'+actionButtons+'</div>'+
    '</button>'+
    (calcRoomsOpenIdx===idx ? '<div class="calc-room-row-detail">'+calcRoomDetailHtml(h, idx)+'</div>' : '')+
  '</div>';
}

function getWorkflowEngineeringPanelMarkup(i, h){
  var roomSystemState = syncRoomSystemState(i) || getRoomSystemState(i);
  var hasMixedSystems = roomSystemState.systems.length > 0;
  var assignment = getRoomAssignment(i);
  var roomCount = Math.max(1, parseInt(h.roomCount,10) || 1);
  var roomName = (lang==='ar' ? (h.ar||h.en) : (h.en||h.ar)) || (lang==='ar' ? 'غرفة' : 'Room');
  var name = roomName.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/gu,'').trim();
  var hcLine = '';
  if(h.sup){
    var pl = lang==='ar' ? (h.pres==='positive'?'موجب':h.pres==='negative'?'سالب':'محايد') : (h.pres==='positive'?'Pos':h.pres==='negative'?'Neg':'Neutral');
    hcLine = '<div class="qi-hcline">ASHRAE — S:'+h.sup+' OA:'+h.oa+' Exh:'+h.exh+' CFM | '+pl+'</div>';
  } else if(h.roomType || h.ach || h.oaStd || h.exhaust){
    hcLine = '<div class="qi-hcline">'+
      (h.roomType ? ((lang==='ar'?'النوع: ':'Type: ')+h.roomType+' | ') : '')+
      (h.category ? ((lang==='ar'?'الفئة: ':'Category: ')+getCategoryLabel(h.category)+' | ') : '')+
      'ACH: '+(h.ach != null ? h.ach : '—')+
      ' | OA: '+(h.oaStd != null ? h.oaStd : '—')+
      ' | Exh: '+(h.exhaust != null ? h.exhaust : '—')+
      ' | '+(lang==='ar'?'Pressure: ':'Pressure: ')+(h.pressure || 'Neutral')+
    '</div>';
  }
  var devLine = h.devSum ? '<div class="qi-devline">⚡ '+h.devSum+(h.equipmentBtu?' · '+Number(h.equipmentBtu).toLocaleString()+' BTU/h':'')+'</div>' : '';
  var reqCompareBtu = getQuoteRequiredBtu(i, getUT(i));
  var roomSystemsSelected = roomSystemState.selectedCapacityBtu;
  var effCap = assignment.mode === 'independent'
    ? (bundleOn ? reqCompareBtu : (roomSystemsSelected > 0 ? roomSystemsSelected : ((getSelBtu(i)||0) * (getQty(i)||1))))
    : 0;
  var warnHtml = '';
  if(reqCompareBtu > 0){
    var _capacityThresholds = getEngineeringValidationThresholds();
    var deltaRaw = (effCap - reqCompareBtu) / reqCompareBtu * 100;
    var deltaRnd = Math.round(deltaRaw * 10) / 10;
    var absDelta = Math.abs(deltaRnd);
    var reqTR = (reqCompareBtu/12000).toFixed(1);
    var selTR = (effCap/12000).toFixed(1);
    var pctStr = (deltaRnd >= 0 ? '+' : '') + deltaRnd.toFixed(1) + '%';
    if(deltaRaw < 0){
      var defLines = lang==='ar'
        ? ['تنبيه: السعة أقل من الحمل المطلوب.','العجز: '+deltaRnd.toFixed(1)+'%','المطلوب: '+Number(reqCompareBtu).toLocaleString()+' BTU/h (~'+reqTR+' TR)','المختار: '+Number(effCap).toLocaleString()+' BTU/h (~'+selTR+' TR)','يُنصح برفع السعة أو تقسيم الحمل.']
        : ['Warning: Capacity below required load.','Deficit: '+deltaRnd.toFixed(1)+'%','Required: '+Number(reqCompareBtu).toLocaleString()+' BTU/h (~'+reqTR+' TR)','Selected: '+Number(effCap).toLocaleString()+' BTU/h (~'+selTR+' TR)','Consider higher capacity or multiple units.'];
      var sev = absDelta > 15 ? 'severe' : 'mild';
      var icon = absDelta > 15 ? '⛔' : '⚠';
      warnHtml = '<div class="qi-warn '+sev+'"><div class="qi-warn-head">'+icon+' '+defLines[0]+'</div>'+defLines.slice(1).map(function(l){ return '<div class="qi-warn-row">'+l+'</div>'; }).join('')+'</div>';
    } else if(deltaRaw > _capacityThresholds.GENERAL_OVERSIZE_HIGH_PCT){
      var highMsg = lang==='ar'
        ? 'ملاحظة: السعة أعلى من المطلوب ('+pctStr+') — احتمال قصر دورة الضاغط (Short Cycling).'
        : 'Note: Capacity exceeds load by '+pctStr+'. Short cycling risk.';
      warnHtml = '<div class="qi-warn mild"><div class="qi-warn-head">ℹ '+highMsg+'</div></div>';
    }
  }
  var curUT = getUT(i);
  var selBtu = getSelBtu(i);
  var roomDuctHtml = '';
  if(isDucted(curUT) && ((parseInt(h.cfm,10)||0) > 0 || selBtu > 0)){
    var _vSup = parseInt((G('duct-vel-sup')||{value:'1000'}).value,10) || 1000;
    var _vRet = parseInt((G('duct-vel-ret')||{value:'800'}).value,10) || 800;
    var _cfmPerTr = parseInt((G('duct-cfm-per-tr')||{value:'400'}).value,10) || 400;
    var _ductCfmObj = getDuctCfm(curUT, selBtu, parseInt(h.cfm,10)||0, _cfmPerTr);
    var _rCfm = _ductCfmObj.cfm;
    var _cfmSrcLbl = _ductCfmObj.source==='unit'
      ? (lang==='ar' ? 'مصدر CFM: السعة المختارة' : 'CFM Source: Selected Capacity')
      : (_ductCfmObj.source==='tr'
        ? (lang==='ar' ? 'مصدر CFM: TR × ' + _cfmPerTr : 'CFM Source: TR × ' + _cfmPerTr)
        : (lang==='ar' ? 'مصدر CFM: إجمالي التدفق المحسوب' : 'CFM Source: Calculated Total Flow'));
    var _dSup = calcDuctSize(_rCfm, _vSup);
    var _dRet = calcDuctSize(_rCfm, _vRet);
    var _dSupD = _dSup ? (_dSup.std||_dSup.calc) : null;
    var _dRetD = _dRet ? (_dRet.std||_dRet.calc) : null;
    var _supLbl = _dSupD ? ductSizeLabel(_dSupD) : '—';
    var _retLbl = _dRetD ? ductSizeLabel(_dRetD) : '—';
    roomDuctHtml =
      '<div class="duct-block">'+
        '<div class="duct-block-ttl">'+(lang==='ar'?'🌬 مجاري الهواء':'🌬 Duct Sizing')+'</div>'+
        '<div class="duct-row"><span class="duct-lbl">'+(lang==='ar'?'إمداد:':'Supply:')+'</span><span class="duct-val">'+_supLbl+'</span><span class="duct-lbl">'+(lang==='ar'?'رجوع:':'Return:')+'</span><span class="duct-val">'+_retLbl+'</span></div>'+
        '<div class="duct-row" style="margin-top:4px"><span dir="rtl" style="font-size:10px;color:var(--a);background:var(--ad);padding:3px 9px;border-radius:10px;font-family:var(--fe);white-space:nowrap;display:inline-flex;align-items:center;gap:4px">'+
          (lang==='ar'
            ? '<span dir="rtl">'+_cfmSrcLbl+'</span><span dir="ltr" style="font-family:var(--fe)"> — Q = '+Number(_rCfm).toLocaleString()+' CFM</span>'
            : '<span>'+_cfmSrcLbl+' — Q = '+Number(_rCfm).toLocaleString()+' CFM</span>')+
        '</span></div>'+
        '<div class="duct-note">'+(lang==='ar'?'سرعة الإمداد: ':'Sup vel: ')+_vSup+' fpm | '+(lang==='ar'?'الرجوع: ':'Ret: ')+_vRet+' fpm</div>'+
      '</div>';
  }
  var summaryStatsHtml =
    '<div class="qi-tech qi-tech-details">'+
      '<div class="qi-stat"><div class="qi-slbl">m³</div><div class="qi-sval">'+h.vol+'</div></div>'+
      '<div class="qi-stat"><div class="qi-slbl">'+(lang==='ar'?'غرف':'Rooms')+'</div><div class="qi-sval ca">'+roomCount+'</div></div>'+
      '<div class="qi-stat"><div class="qi-slbl">👤</div><div class="qi-sval">'+h.ppl+'</div></div>'+
      '<div class="qi-stat"><div class="qi-slbl">TR</div><div class="qi-sval ca">'+h.tr+'</div></div>'+
      '<div class="qi-stat"><div class="qi-slbl">CFM</div><div class="qi-sval">'+Number(h.cfm).toLocaleString()+'</div></div>'+
      '<div class="qi-stat"><div class="qi-slbl">BTU/h</div><div class="qi-sval cam">'+Number(h.btu).toLocaleString()+'</div></div>'+
      '<div class="qi-stat"><div class="qi-slbl">Mkt BTU</div><div class="qi-sval">'+Number(h.mkt).toLocaleString()+'</div></div>'+
      (h.devBtu>0?'<div class="qi-stat"><div class="qi-slbl">Dev</div><div class="qi-sval cam">'+Number(h.devBtu).toLocaleString()+'</div></div>':'')+
    '</div>';
  var assignmentBox = quoteMode === 'proj'
    ? '<div class="workflow-assignment-box">'+
        '<div class="workflow-assignment-head">'+(lang==='ar'?'الغرفة ضمن حمل المشروع':'Room included in project load')+'</div>'+
        '<div class="workflow-zone-note tech-section-card">'+
          (lang==='ar'
            ? 'في وضع وحدة للمشروع، تدخل هذه الغرفة تلقائياً ضمن إجمالي حمل المشروع.'
            : 'In project unit mode, this room is automatically included in the total project load.')+
        '</div>'+
      '</div>'
    : '';
  var systemsSection = quoteMode === 'proj'
    ? '<div class="workflow-zone-note tech-section-card">'+
        (lang==='ar'
          ? 'مطابقة السعة تتم على إجمالي حمل جميع الغرف مقابل إجمالي وحدات المشروع المختارة.'
          : 'Capacity matching is performed against the total load of all rooms versus the total selected project units.')+
      '</div>'
    : renderRoomSystemsEditor(i, parseInt(h.btu,10)||0);
  return '<div class="qi-item calc-workflow-room-panel">'+
    '<div class="qi-head"><span class="qi-num">#'+(i+1)+'</span><span class="qi-name">'+esc(name)+'</span></div>'+
    (bundleOn ? '<div class="bundle-lock-note">'+(lang==='ar'?'🔒 تم تعطيل اختيار الوحدات لكل غرفة بسبب تفعيل التجميع':'🔒 Per-room unit selection is locked because Bundle is enabled')+'</div>' : '')+
    '<div class="qi-body qi-body-tech-report">'+
      assignmentBox+
      renderRoomQuickSummary(i, roomSystemState, reqCompareBtu, effCap)+
      systemsSection+
      renderRoomCapacityStatusSection(roomSystemState, reqCompareBtu, effCap, ((bundleOn || hasMixedSystems) ? '' : warnHtml))+
      renderRoomValidationSection(i, roomSystemState)+
      renderSmartSuggestions(i)+
      renderRoomEngineeringDetails(i, roomSystemState, summaryStatsHtml, hcLine, devLine, roomDuctHtml)+
    '</div>'+
  '</div>';
}

function renderZoneSystemsEditor(zone){
  zone = normalizeHvacZone(zone);
  var rowsHtml = (zone.systems || []).map(function(system){
    var typeOpts = MIXED_SYSTEM_TYPES.map(function(key){
      return '<option value="'+key+'"'+(system.unitType===key?' selected':'')+'>'+utLabel(key)+'</option>';
    }).join('');
    var capOpts = getCatalog(system.unitType).map(function(item){
      var lbl = lang === 'ar' ? item.label.ar : item.label.en;
      return '<option value="'+item.btu+'"'+((parseInt(system.selectedBtu,10)||0)===(parseInt(item.btu,10)||0)?' selected':'')+'>'+lbl+'</option>';
    }).join('');
    var totalSelected = (parseInt(system.selectedBtu,10)||0) * Math.max(1, parseInt(system.qty,10)||1);
    return '<div class="mixed-system-row">'+
      '<div class="mixed-system-grid">'+
        '<div class="proj-input-group mixed-field mixed-field-type"><div class="qi-plbl">'+t('mixedtype')+'</div><div class="system-select-field"><select class="qi-utype-sel system-select-control" onchange="updateZoneSystem(\''+zone.id+'\',\''+system.id+'\',\'unitType\',this.value)">'+typeOpts+'</select></div></div>'+
        '<div class="proj-input-group mixed-field mixed-field-qty"><div class="qi-plbl">'+t('mixedqty')+'</div><div class="mixed-qty-stepper"><button type="button" class="qbtn" onclick="decrementZoneSystemQty(\''+zone.id+'\',\''+system.id+'\')">-</button><input class="mixed-qty-value" type="text" readonly value="'+system.qty+'"><button type="button" class="qbtn" onclick="incrementZoneSystemQty(\''+zone.id+'\',\''+system.id+'\')">+</button></div></div>'+
        '<div class="proj-input-group mixed-field mixed-field-capacity"><div class="qi-plbl">'+t('mixedcapacity')+'</div><div class="system-select-field"><select class="qi-cap-sel system-select-control" onchange="updateZoneSystem(\''+zone.id+'\',\''+system.id+'\',\'selectedBtu\',this.value)">'+capOpts+'</select></div></div>'+
        '<div class="proj-input-group mixed-field mixed-field-total"><div class="qi-plbl">'+t('mixedtotalcapacity')+'</div><div class="mixed-total-remove-row"><div class="ninput mixed-total-display" style="display:flex;align-items:center">'+Number(totalSelected).toLocaleString()+' BTU/h</div><button type="button" class="mixed-system-remove" onclick="removeZoneSystem(\''+zone.id+'\',\''+system.id+'\')">'+t('mixedremove')+'</button></div></div>'+
      '</div>'+
    '</div>';
  }).join('');
  return '<div class="mixed-systems-card room-mixed-systems tech-section-card">'+
    '<div class="mixed-systems-head"><div class="mixed-systems-title">'+(lang==='ar'?'أنظمة المنطقة':'Zone HVAC Systems')+'</div></div>'+
    '<div class="mixed-systems-list">'+(rowsHtml || '<div class="mixed-systems-empty">'+t('mixedempty')+'</div>')+'</div>'+
    '<div class="mixed-systems-actions mixed-systems-add-row"><button type="button" class="mixed-systems-btn primary" onclick="addZoneSystem(\''+zone.id+'\')">'+t('mixedadd')+'</button></div>'+
  '</div>';
}

function renderProjectSystemsEditor(){
  ensureProjectSystems();
  function renderProjectSystemCapacityPicker(system, totalSelected, totalCfm){
    var snapshot = system.equipmentSnapshot || {};
    var record = snapshot.record || {};
    var selectedCapacity = getSelectedUnitCapacityBtu(system) || system.selectedBtu || (record && record.coolingCapacityBtuH) || 0;
    var capacityCatalog = getCatalog(system.unitType) || [];
    var currentValue = selectedCapacity > 0 ? Number(selectedCapacity || 0) : getDefaultSystemCapacity(system.unitType);
    var hasCurrent = capacityCatalog.some(function(item){ return (parseInt(item.btu, 10) || 0) === currentValue; });
    if(currentValue && !hasCurrent){
      capacityCatalog = [{
        btu: currentValue,
        label: {
          ar: Number(currentValue).toLocaleString() + ' BTU',
          en: Number(currentValue).toLocaleString() + ' BTU'
        }
      }].concat(capacityCatalog);
    }
    var btuStepOpts = capacityCatalog.map(function(item){
      var itemBtu = parseInt(item.btu, 10) || 0;
      var label = lang === 'ar' ? (item.label && item.label.ar) : (item.label && item.label.en);
      label = label || (Number(itemBtu).toLocaleString() + ' BTU');
      return '<option value="'+itemBtu+'"'+(itemBtu===currentValue?' selected':'')+'>'+esc(label)+'</option>';
    }).join('');
    if(!btuStepOpts){
      btuStepOpts = '<option value="">'+esc(lang==='ar'?'لا توجد سعات متاحة':'No capacity options')+'</option>';
    }
    return '<div class="qi-unit-cap project-capacity-control"><span class="qi-utype-lbl">'+(lang==='ar'?'سعة الوحدة':'Unit Capacity')+'</span>'+
      '<select class="qi-cap-sel" onchange="updateProjectSystem(\''+system.id+'\',\'selectedBtu\',this.value)">'+btuStepOpts+'</select>'+
    '</div>';
  }
  var rowsHtml = projectSystems.map(function(system){
    var typeOpts = MIXED_SYSTEM_TYPES.map(function(key){
      return '<option value="'+key+'"'+(system.unitType===key?' selected':'')+'>'+utLabel(key)+'</option>';
    }).join('');
    var totalSelected = getSelectedInstalledCapacity(system);
    var totalTr = totalSelected / 12000;
    var totalCfm = getUnitAirflowCfm(system) * Math.max(1, parseInt(system.qty,10)||1);
    return '<div class="mixed-system-row workflow-project-system-card">'+
      '<div class="workflow-zone-head"><div><strong>'+esc(getProjectSystemDisplayName(system.id))+'</strong><span>'+(lang==='ar'?'وحدة مشروع':'Project HVAC Unit')+'</span></div><button type="button" class="mixed-system-remove" onclick="removeProjectSystem(\''+system.id+'\')">'+t('mixedremove')+'</button></div>'+
      '<div class="mixed-system-grid">'+
        '<div class="proj-input-group mixed-field mixed-field-type"><div class="qi-plbl">'+t('mixedtype')+'</div><div class="system-select-field"><select class="qi-utype-sel system-select-control" onchange="updateProjectSystem(\''+system.id+'\',\'unitType\',this.value)">'+typeOpts+'</select></div></div>'+
        '<div class="proj-input-group mixed-field mixed-field-qty"><div class="qi-plbl">'+t('mixedqty')+'</div><div class="mixed-qty-stepper" data-step-kind="project-system" data-system-id="'+system.id+'"><button type="button" class="qbtn" data-delta="-1" onclick="decrementProjectSystemQty(\''+system.id+'\')">-</button><input class="mixed-qty-value" type="text" readonly value="'+system.qty+'"><button type="button" class="qbtn" data-delta="1" onclick="incrementProjectSystemQty(\''+system.id+'\')">+</button></div></div>'+
        '<div class="proj-input-group mixed-field mixed-field-capacity"><div class="qi-plbl">'+t('mixedcapacity')+'</div>'+renderProjectSystemCapacityPicker(system, totalSelected, totalCfm)+'</div>'+
        '<div class="proj-input-group mixed-field"><div class="qi-plbl">TR</div><div class="ninput mixed-total-display" style="display:flex;align-items:center">'+totalTr.toFixed(2)+'</div></div>'+
        '<div class="proj-input-group mixed-field"><div class="qi-plbl">CFM</div><div class="ninput mixed-total-display" style="display:flex;align-items:center">'+Number(totalCfm).toLocaleString()+'</div></div>'+
      '</div>'+
    '</div>';
  }).join('');
  return '<div class="mixed-systems-card room-mixed-systems tech-section-card">'+
    '<div class="mixed-systems-head"><div class="mixed-systems-title">'+(lang==='ar'?'وحدات المشروع المختارة':'Project HVAC Units')+'</div></div>'+
    '<div class="mixed-systems-list">'+(rowsHtml || '<div class="mixed-systems-empty">'+t('mixedempty')+'</div>')+'</div>'+
    '<div class="mixed-systems-actions mixed-systems-add-row"><button type="button" class="mixed-systems-btn primary" onclick="addProjectSystem()">+ '+(lang==='ar'?'إضافة وحدة':'Add Unit')+'</button><button type="button" class="mixed-systems-btn" onclick="applyBestProjectSystemAutomatically()">'+(lang==='ar'?'اختيار أفضل وحدة تلقائياً':'Auto Select Best Unit')+'</button></div>'+
  '</div>';
}

function renderAssignmentSummaryPanel(){
  var totalRooms = hist.length;
  var totalBtu = getProjectRequiredLoadBtu();
  var totalCfm = getProjectRequiredLoadCfm();
  var totalTr = totalBtu / 12000;
  var independentRooms = 0, projectRooms = 0, warnings = 0, systemsCount = 0;
  for(var i=0;i<hist.length;i++){
    var assignment = getRoomAssignment(i);
    var roomState = syncRoomSystemState(i) || getRoomSystemState(i);
    if(assignment.mode === 'project') projectRooms++;
    else independentRooms++;
    if(roomState.capacityStatusMeta && ['undersized','review','zone_missing','no_system_selected'].indexOf(roomState.capacityStatusMeta.key) >= 0){
      warnings++;
    }
    if(roomState.systems && roomState.systems.length) systemsCount += roomState.systems.length;
  }
  if(isProjectHvacMode()) systemsCount += ensureProjectSystems().length;
  var highestRoomIdx = -1, highestRoomBtu = 0;
  for(var r=0;r<hist.length;r++){
    var roomBtu = getRoomRequiredBtu(r);
    if(roomBtu > highestRoomBtu){
      highestRoomBtu = roomBtu;
      highestRoomIdx = r;
    }
  }
  var highestRoomName = highestRoomIdx >= 0
    ? (((lang==='ar' ? (hist[highestRoomIdx].ar || hist[highestRoomIdx].en) : (hist[highestRoomIdx].en || hist[highestRoomIdx].ar))) || (lang==='ar'?'غرفة':'Room'))
    : (lang==='ar'?'—':'—');
  return ''+
    '<div class="assignment-summary-panel assignment-summary-panel-compact">'+
      '<div class="assignment-panel-head"><div><strong>'+(lang==='ar'?'ملخص المشروع':'Project Summary')+'</strong><span>'+(lang==='ar'?'إجمالي الأحمال والتوزيع الحالي للأنظمة':'Current loads and HVAC assignment overview')+'</span></div></div>'+
      '<div class="assignment-summary-grid">'+
        '<div class="assignment-summary-stat"><span>'+(lang==='ar'?'إجمالي الحمل':'Total Load')+'</span><strong>'+Number(totalBtu).toLocaleString()+' BTU/h</strong></div>'+
        '<div class="assignment-summary-stat"><span>TR</span><strong>'+Number(totalTr).toFixed(2)+'</strong></div>'+
        '<div class="assignment-summary-stat"><span>CFM</span><strong>'+Number(totalCfm).toLocaleString()+'</strong></div>'+
        '<div class="assignment-summary-stat"><span>'+(lang==='ar'?'إجمالي الغرف':'Total Rooms')+'</span><strong>'+totalRooms+'</strong></div>'+
        '<div class="assignment-summary-stat"><span>'+(lang==='ar'?'الأنظمة المعيّنة':'Assigned Systems')+'</span><strong>'+systemsCount+'</strong></div>'+
        '<div class="assignment-summary-stat"><span>'+(lang==='ar'?(quoteMode === 'proj' ? 'غرف المشروع' : 'غرف مستقلة'):(quoteMode === 'proj' ? 'Project Rooms' : 'Independent Rooms'))+'</span><strong>'+(quoteMode === 'proj' ? projectRooms : independentRooms)+'</strong></div>'+
      '</div>'+
      '<div class="assignment-summary-list">'+
        '<div class="assignment-summary-row"><span>'+(lang==='ar'?(quoteMode === 'proj' ? 'غرف ضمن وضع المشروع' : 'غرف مستقلة'):(quoteMode === 'proj' ? 'Rooms in project mode' : 'Independent rooms'))+'</span><strong>'+(quoteMode === 'proj' ? projectRooms : independentRooms)+'</strong></div>'+
        '<div class="assignment-summary-row"><span>'+(lang==='ar'?'غرف تحتاج مراجعة':'Rooms Needing Review')+'</span><strong>'+warnings+'</strong></div>'+
        '<div class="assignment-summary-row"><span>'+(lang==='ar'?'أعلى حمل غرفة':'Highest Load Room')+'</span><strong>'+esc(highestRoomName)+'</strong></div>'+
      '</div>'+
    '</div>';
}

function renderAssignmentRoomCard(i, h){
  var roomState = syncRoomSystemState(i) || getRoomSystemState(i);
  var assignment = getRoomAssignment(i);
  var status = getWorkflowStatusMeta(i, roomState);
  var roomName = ((lang==='ar' ? (h.ar || h.en) : (h.en || h.ar)) || (lang==='ar'?'غرفة':'Room'));
  var area = getWorkflowRoomArea(h);
  var isOpen = true;
  var editLabel = (lang==='ar'?'تعديل الغرفة':'Edit room');
  var copyLabel = (lang==='ar'?'نسخ الغرفة':'Duplicate room');
  var deleteLabel = (lang==='ar'?'حذف الغرفة':'Delete room');
  var controlsHtml =
    getRoomActionButtonsHtml(i);
  var detailHtml = '';
  if(isOpen){
    detailHtml = '<div class="assignment-room-detail">';
    if(quoteMode === 'proj'){
      detailHtml +=
        '<div class="workflow-zone-note tech-section-card">'+
          (lang==='ar'
            ? 'هذه الغرفة معلوماتية فقط في وضع وحدة المشروع. جميع الغرف تدخل تلقائياً في حمل المشروع ويتم اختيار الوحدات من لوحة المشروع.'
            : 'This room is informational only in project mode. All rooms are automatically included in the project load and HVAC units are selected from the project panel.')+
        '</div>';
    } else {
      detailHtml += renderRoomSystemsEditor(i, parseInt(h.btu,10)||0);
      detailHtml += renderRoomValidationSection(i, roomState);
    }
    detailHtml += '</div>';
  }
  return ''+
    '<div class="assignment-room-card'+(isOpen?' open':'')+'" data-room-index="'+i+'">'+
      '<div class="assignment-room-head">'+
        '<div class="assignment-room-head-main"><div><strong>'+esc(roomName)+'</strong><span>'+(lang==='ar'?'الغرفة #':'Room #')+(i+1)+'</span></div>'+controlsHtml+'</div>'+
        '<span class="calc-room-status-pill is-'+(status.key==='matched'?'pass':status.key==='undersized'?'fail':status.key==='project_connected'||status.key==='zone_connected'?'na':'review')+'">'+esc(status.label)+'</span>'+
      '</div>'+
      '<div class="assignment-room-grid">'+
        '<div class="assignment-room-stat"><span>'+(lang==='ar'?'المساحة':'Area')+'</span><strong>'+esc(area)+'</strong></div>'+
        '<div class="assignment-room-stat"><span>BTU/h</span><strong>'+Number(getRoomRequiredBtu(i)).toLocaleString()+'</strong></div>'+
        '<div class="assignment-room-stat"><span>CFM</span><strong>'+Number(getRoomRequiredCfm(i)).toLocaleString()+'</strong></div>'+
        '<div class="assignment-room-stat"><span>TR</span><strong>'+(getRoomRequiredBtu(i)/12000).toFixed(2)+'</strong></div>'+
      '</div>'+
      detailHtml+
    '</div>';
}

function getRoomActionButtonsHtml(idx, extraClass){
  var editLabel = lang === 'ar' ? 'تعديل الغرفة' : 'Edit room';
  var copyLabel = lang === 'ar' ? 'نسخ الغرفة' : 'Duplicate room';
  var deleteLabel = lang === 'ar' ? 'حذف الغرفة' : 'Delete room';
  return (
    '<div class="assignment-room-actions'+(extraClass ? (' '+extraClass) : '')+'" aria-label="'+(lang==='ar'?'إجراءات الغرفة':'Room actions')+'">'+
      '<button type="button" class="assignment-room-icon-btn" title="'+editLabel+'" aria-label="'+editLabel+'" onclick="event.stopPropagation();editRec('+idx+')">'+getRoomActionIconSvg('edit')+'</button>'+
      '<button type="button" class="assignment-room-icon-btn" title="'+copyLabel+'" aria-label="'+copyLabel+'" onclick="event.stopPropagation();duplicateRec('+idx+')">'+getRoomActionIconSvg('copy')+'</button>'+
      '<button type="button" class="assignment-room-icon-btn danger" title="'+deleteLabel+'" aria-label="'+deleteLabel+'" onclick="event.stopPropagation();delRec('+idx+')">'+getRoomActionIconSvg('delete')+'</button>'+
    '</div>'
  );
}

function getRoomActionIconSvg(kind){
  if(kind === 'edit'){
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l4.5-1 9-9a2 2 0 0 0-2.8-2.8l-9 9L4 20z"></path><path d="M13.5 6.5l4 4"></path></svg>';
  }
  if(kind === 'copy'){
    return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="10" height="10" rx="2"></rect><rect x="5" y="5" width="10" height="10" rx="2"></rect></svg>';
  }
  return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 7h12"></path><path d="M9 7V5h6v2"></path><path d="M8 7l1 12h6l1-12"></path><path d="M10.5 10.5v5"></path><path d="M13.5 10.5v5"></path></svg>';
}

function renderAssignmentRoomCards(){
  if(!hist.length){
    return '<div class="calc-workflow-empty"><strong>'+(lang==='ar'?'ابدأ بإضافة غرفة':'Start by adding a room')+'</strong><span>'+(lang==='ar'?'بعد الحساب ستظهر الغرف هنا مع التعيين والحالة الهندسية.' :'Rooms will appear here with their HVAC assignment and engineering status.')+'</span></div>';
  }
  return '<div class="assignment-rooms-list">'+hist.map(function(h, idx){ return renderAssignmentRoomCard(idx, h); }).join('')+'</div>';
}

function renderZoneCards(){
  if(quoteMode !== 'proj') return '';
  var cards = [];
  var projectRoomIndices = getProjectAssignedRoomIndices();
  if(quoteMode === 'proj' && hist.length){
    var requiredBtu = projectRoomIndices.reduce(function(sum, idx){ return sum + getRoomRequiredBtu(idx); }, 0);
    var requiredCfm = projectRoomIndices.reduce(function(sum, idx){ return sum + getRoomRequiredCfm(idx); }, 0);
    var selectedBtu = getProjectCentralSelectedBtu();
    var selectedCfm = getProjectCentralSelectedCfm();
    var status = getProjectCapacityStatus(requiredBtu, selectedBtu);
    cards.push(
      '<div class="workflow-zone-card">'+
        '<div class="workflow-zone-head"><div><strong>'+(lang==='ar'?'وحدة المشروع':'Project Unit')+'</strong><span>'+(lang==='ar'?'يتم جمع جميع الغرف تلقائياً لاختيار وحدة تكييف واحدة أو أكثر للمشروع بالكامل':'All rooms are automatically aggregated to select one or more HVAC units for the whole project')+'</span></div><span class="calc-room-status-pill is-'+(status.key==='matched'?'pass':status.key==='undersized'?'fail':'review')+'">'+esc(status.label)+'</span></div>'+
        '<div class="calc-central-metrics">'+
          '<div class="calc-central-stat"><span>'+(lang==='ar'?'إجمالي الغرف':'Total Rooms')+'</span><strong>'+projectRoomIndices.length+'</strong></div>'+
          '<div class="calc-central-stat"><span>'+(lang==='ar'?'الحمل المطلوب':'Required BTU')+'</span><strong>'+Number(requiredBtu).toLocaleString()+' BTU/h</strong></div>'+
          '<div class="calc-central-stat"><span>'+(lang==='ar'?'الأطنان المطلوبة':'Required TR')+'</span><strong>'+(requiredBtu/12000).toFixed(2)+' TR</strong></div>'+
          '<div class="calc-central-stat"><span>'+(lang==='ar'?'السعة المختارة':'Selected BTU')+'</span><strong>'+Number(selectedBtu).toLocaleString()+' BTU</strong></div>'+
          '<div class="calc-central-stat"><span>'+(lang==='ar'?'الأطنان المختارة':'Selected TR')+'</span><strong>'+(selectedBtu/12000).toFixed(2)+' TR</strong></div>'+
          '<div class="calc-central-stat"><span>'+(lang==='ar'?'CFM المطلوب':'Required CFM')+'</span><strong>'+Number(requiredCfm).toLocaleString()+' CFM</strong></div>'+
          '<div class="calc-central-stat"><span>'+(lang==='ar'?'CFM المختار':'Selected CFM')+'</span><strong>'+Number(selectedCfm).toLocaleString()+' CFM</strong></div>'+
        '</div>'+
        renderProjectSystemsEditor()+
      '</div>'
    );
  }
  return '<div class="workflow-zones-section">'+
    '<div class="workflow-zones-title">'+(lang==='ar'?'وحدات المشروع المختارة':'Selected Project Systems')+'</div>'+
    cards.join('')+
  '</div>';
}

function renderAssignmentGroupsPanel(){
  var content = renderZoneCards();
  return ''+
    '<div class="assignment-groups-panel">'+
      '<div class="assignment-panel-head"><div><strong>'+(lang==='ar'?'وحدات المشروع المختارة':'Selected Project Systems')+'</strong><span>'+(lang==='ar'?'جميع الغرف تدخل تلقائياً ضمن حمل المشروع، ويمكنك إضافة أكثر من وحدة أو نوع مختلف للمشروع نفسه.':'All rooms are automatically included in the project load, and you can add more than one unit or different system type for the same project.')+'</span></div></div>'+
      (content || '<div class="calc-workflow-empty"><strong>'+(lang==='ar'?'لا توجد وحدات مشروع بعد':'No project systems yet')+'</strong><span>'+(lang==='ar'?'أضف وحدة مشروع وسيتم احتسابها مباشرة على إجمالي حمل جميع الغرف.' :'Add a project system and it will be applied directly against the total load of all rooms.')+'</span></div>')+
    '</div>';
}

function ensureProjectBlockAnchor(){
  var projBlock = G('proj-block');
  if(!projBlock || !projBlock.parentNode) return null;
  var anchor = G('proj-block-anchor');
  if(!anchor){
    anchor = document.createElement('div');
    anchor.id = 'proj-block-anchor';
    projBlock.parentNode.insertBefore(anchor, projBlock.nextSibling);
  }
  return anchor;
}

function restoreProjectBlockHome(){
  var projBlock = G('proj-block');
  var anchor = ensureProjectBlockAnchor();
  if(!projBlock || !anchor || !anchor.parentNode) return;
  if(projBlock.parentNode !== anchor.parentNode){
    anchor.parentNode.insertBefore(projBlock, anchor);
  }
  if(quoteMode !== 'proj') projBlock.style.display = 'none';
}

function mountProjectBlockInWorkflow(){
  var projBlock = G('proj-block');
  var tableWrap = G('calc-room-table-wrap');
  if(!projBlock || !tableWrap) return;
  ensureProjectBlockAnchor();
  tableWrap.innerHTML = '';
  var host = document.createElement('div');
  host.className = 'workflow-project-host';
  tableWrap.appendChild(host);
  host.appendChild(projBlock);
  projBlock.style.display = '';
}

function renderCalcWorkflowCard(){
  var card = G('calc-workflow-card');
  var summary = G('calc-workflow-summary');
  var centralPanel = G('calc-central-panel');
  var tableWrap = G('calc-room-table-wrap');
  var btnRoom = G('calc-mode-btn-room');
  var btnProj = G('calc-mode-btn-proj');
  if(!card || !summary || !centralPanel || !tableWrap) return;

  var workflowTitle = G('workflow-input-title');
  if(workflowTitle) workflowTitle.textContent = (lang==='ar' ? 'إدارة الغرف والوحدات' : 'Room & Unit Management');
  var workflowNote = G('workflow-input-note');
  if(workflowNote) workflowNote.textContent = (lang==='ar'
    ? 'تابع جميع الغرف، وعيّن الوحدات، وبدّل بين وضع الغرف ووضع الوحدة المركزية.'
    : 'Track all rooms, assign units, and switch between per-room and central project modes.');
  var addRoomBtn = G('calc-add-room-btn');
  if(addRoomBtn) addRoomBtn.textContent = (lang==='ar' ? '+ إضافة غرفة' : '+ Add Room');
  var workflowCalcLabel = G('workflow-calc-label');
  if(workflowCalcLabel){
    workflowCalcLabel.textContent = hist.length
      ? (lang==='ar' ? 'تحديث النتائج' : 'Update Results')
      : (lang==='ar' ? 'احسب الأحمال' : 'Calculate Loads');
  }

  if(btnRoom) btnRoom.classList.toggle('active', quoteMode !== 'proj');
  if(btnProj) btnProj.classList.toggle('active', quoteMode === 'proj');
  if(btnRoom) btnRoom.textContent = (lang==='ar' ? 'وحدة لكل غرفة' : 'Unit Per Room');
  if(btnProj) btnProj.textContent = (lang==='ar' ? 'وحدة مركزية للمشروع' : 'Central Project Unit');

  if(quoteMode === 'proj'){
    restoreProjectBlockHome();
    if(summary) summary.style.display = 'none';
    if(centralPanel){
      centralPanel.style.display = 'none';
      centralPanel.innerHTML = '';
    }
    mountProjectBlockInWorkflow();
    return;
  }

  restoreProjectBlockHome();
  if(summary) summary.style.display = '';

  var totalRooms = 0, totalBtu = 0, totalCfm = 0, assignedSystems = 0, unmatched = 0;
  for(var i=0;i<hist.length;i++){
    var h = hist[i] || {};
    totalRooms += Math.max(1, parseInt(h.roomCount,10) || 1);
    totalBtu += getQuoteRequiredBtu(i);
    totalCfm += (parseInt(h.cfm,10) || 0) * Math.max(1, parseInt(h.roomCount,10) || 1);
    var state = syncRoomSystemState(i) || getRoomSystemState(i);
    if(state.systems && state.systems.length) assignedSystems += state.systems.length;
    if(getRoomAssignment(i).mode === 'independent' && (!state.systems.length || state.capacityStatus === 'undersized')) unmatched++;
  }
  hvacZones.forEach(function(zone){
    assignedSystems += (zone.systems || []).length;
  });
  if(getProjectAssignedRoomIndices().length || quoteMode === 'proj') assignedSystems += ensureProjectSystems().length;
  summary.innerHTML =
    '<div class="calc-workflow-chip"><span>'+(lang==='ar'?'إجمالي الغرف':'Total Rooms')+'</span><strong>'+totalRooms+'</strong></div>'+
    '<div class="calc-workflow-chip"><span>BTU/h</span><strong>'+Number(totalBtu).toLocaleString()+'</strong></div>'+
    '<div class="calc-workflow-chip"><span>TR</span><strong>'+(totalBtu/12000).toFixed(2)+'</strong></div>'+
    '<div class="calc-workflow-chip"><span>CFM</span><strong>'+Number(totalCfm).toLocaleString()+'</strong></div>'+
    '<div class="calc-workflow-chip"><span>'+(lang==='ar'?'الأنظمة المعينة':'Assigned Systems')+'</span><strong>'+assignedSystems+'</strong></div>'+
    '<div class="calc-workflow-chip warning"><span>'+(lang==='ar'?'غرف تحتاج متابعة':'Rooms Needing Review')+'</span><strong>'+unmatched+'</strong></div>';
  if(centralPanel){
    centralPanel.style.display = 'none';
    centralPanel.innerHTML = '';
  }

  if(!hist.length){
    tableWrap.innerHTML =
      '<div class="calc-workflow-empty">'+
        '<strong>'+(lang==='ar'?'ابدأ بإضافة أول غرفة في المشروع':'Start by adding the first room in the project')+'</strong>'+
        '<span>'+(lang==='ar'?'بعد الحساب ستظهر الغرف هنا مع الأحمال والتعيين والحالة الهندسية.' :'After calculation, rooms will appear here with load, assignment, and engineering status.')+'</span>'+
      '</div>';
    return;
  }
  tableWrap.innerHTML =
    '<div class="assignment-workspace-grid assignment-workspace-stacked">'+
      '<div class="assignment-rooms-panel">'+
        '<div class="assignment-panel-head"><div><strong>'+(lang==='ar'?'الغرف والوحدات':'Rooms & Units')+'</strong><span>'+(lang==='ar'?'كل غرفة تدير وحدتها الخاصة بشكل مستقل في هذا الوضع':'Each room manages its own HVAC units independently in this mode')+'</span></div></div>'+
        renderAssignmentRoomCards()+
      '</div>'+
    '</div>';
}

function calcRoomDetailHtml(h, idx){
  var rc = Math.max(1,parseInt(h.roomCount,10)||1);
  var isHC = h.calcMode === 'hc';
  var roomSystemState = idx >= 0 ? syncRoomSystemState(idx) : null;
  var dimsLine = '';
  if(h.dims && (h.dims.len || h.dims.width || h.dims.height)){
    dimsLine = '<div class="calc-room-detail-row calc-room-detail-row-wide calc-room-detail-dims"><span class="calc-room-detail-lbl">'+(lang==='ar'?'الأبعاد':'Dimensions')+'</span><span class="calc-room-detail-val">'+
      [h.dims.len||0,h.dims.width||0,h.dims.height||0].join(' × ')+' '+(lang==='ar'?'م':'m')+
    '</span></div>';
  }
  var roomTypeLine = h.roomType ? h.roomType : ((lang==='ar'?(h.ar||h.en):(h.en||h.ar))||'');
  var generalMeta = '';
  if(!isHC){
    var cityName = lang === 'ar' ? (h.cityLabelAr || getCityConfig(h.cityKey || DEFAULT_CITY_KEY).ar) : (h.cityLabelEn || getCityConfig(h.cityKey || DEFAULT_CITY_KEY).en);
    var insulationName = lang === 'ar' ? (h.insulationLabelAr || '') : (h.insulationLabelEn || '');
    generalMeta =
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+t('bcity')+'</span><span class="calc-room-detail-val">'+cityName+'</span></div>'+
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+t('bcityfactor')+'</span><span class="calc-room-detail-val">'+Number(h.loadFactor||0).toLocaleString()+' BTU/m³</span></div>'+
      (insulationName?'<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+t('binsulation')+'</span><span class="calc-room-detail-val">'+insulationName+'</span></div>':'')+
      (h.insulationMultiplier != null?'<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+t('binsulationm')+'</span><span class="calc-room-detail-val">'+Number(h.insulationMultiplier).toFixed(2)+'</span></div>':'')+
      (h.windowArea != null?'<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+t('bwindowarea')+'</span><span class="calc-room-detail-val">'+Number(h.windowArea||0).toLocaleString()+' m²</span></div>':'')+
      (h.windowLoad != null?'<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+t('bwindow')+'</span><span class="calc-room-detail-val">'+Number(h.windowLoad||0).toLocaleString()+' BTU/h</span></div>':'');
  }
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
  var systemsSummaryLine = '';
  if(roomSystemState && roomSystemState.systems.length){
    var statusMeta = roomSystemState.capacityStatusMeta || { key:'no_system_selected', label:'', deltaText:'' };
    var statusColor = statusMeta.key === 'matched' ? '#16a34a' : statusMeta.key === 'undersized' ? '#dc2626' : statusMeta.key === 'oversized' ? '#d97706' : '#64748b';
    systemsSummaryLine =
      '<div class="calc-room-detail-note" style="color:'+statusColor+'">'+
      (lang==='ar'?'السعة المختارة':'Selected Capacity')+': '+Number(roomSystemState.selectedCapacityBtu||0).toLocaleString()+' BTU/h · '+
      (lang==='ar'?'الفرق':'Difference')+': '+(roomSystemState.capacityDifference>=0?'+':'')+Number(roomSystemState.capacityDifference||0).toLocaleString()+' BTU/h · '+
      (statusMeta.label || '')+' '+(statusMeta.deltaText || '')+
      '</div>';
  }
  return '<div class="calc-room-detail">'+
    '<div class="calc-room-detail-grid">'+
      '<div class="calc-room-detail-row calc-room-detail-row-wide calc-room-detail-type"><span class="calc-room-detail-lbl">'+(lang==='ar'?'نوع الغرفة':'Room Type')+'</span><span class="calc-room-detail-val">'+roomTypeLine+'</span></div>'+
      dimsLine+
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+t('calcmode')+'</span><span class="calc-room-detail-val">'+(h.calcMode==='hc'?t('ashraehc'):t('loadmode'))+'</span></div>'+
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+(lang==='ar'?'الحجم':'Volume')+'</span><span class="calc-room-detail-val">'+h.vol+' m³</span></div>'+
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+(lang==='ar'?'عدد الغرف':'Room Count')+'</span><span class="calc-room-detail-val">'+rc+'</span></div>'+
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+(lang==='ar'?'عدد الأشخاص':'People')+'</span><span class="calc-room-detail-val">'+h.ppl+'</span></div>'+
      generalMeta+
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">TR</span><span class="calc-room-detail-val">'+h.tr+'</span></div>'+
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">CFM</span><span class="calc-room-detail-val">'+Number(h.cfm||0).toLocaleString()+'</span></div>'+
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">BTU/h</span><span class="calc-room-detail-val">'+Number(h.btu||0).toLocaleString()+'</span></div>'+
      '<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+(lang==='ar'?'سعة السوق':'Market BTU')+'</span><span class="calc-room-detail-val">'+Number(h.mkt||0).toLocaleString()+'</span></div>'+
      (h.equipmentBtu?'<div class="calc-room-detail-row calc-room-detail-stat"><span class="calc-room-detail-lbl">'+(lang==='ar'?'حمل الأجهزة':'Equipment Load')+'</span><span class="calc-room-detail-val">'+Number(h.equipmentBtu).toLocaleString()+' BTU/h</span></div>':'')+
      (h.devSum?'<div class="calc-room-detail-row calc-room-detail-row-wide calc-room-detail-equipment"><span class="calc-room-detail-lbl">'+(lang==='ar'?'الأجهزة':'Equipment')+'</span><span class="calc-room-detail-val">'+h.devSum+'</span></div>':'')+
    '</div>'+
    hcLine+
    systemsSummaryLine+
    ''+
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
  renderCalcWorkflowCard();
  renderCalcRooms();
  var aw=G('add-quote-wrap');
  if(aw) aw.style.display='none';
  setTimeout(function(){
    var target=G('calc-rooms-card');
    if(target&&target.scrollIntoView) target.scrollIntoView({behavior:'smooth',block:'nearest'});
  },40);
}

function renderHist(){
  syncAllRoomSystemStates();
  var list=G('hist-list'); list.innerHTML='';
  G('hist-count').textContent=hist.length;
  if(!hist.length){
    var em=document.createElement('div'); em.className='hist-empty'; em.textContent=t('hempty');
    list.appendChild(em); G('cum-card').style.display='none';
    renderCalcWorkflowCard();
    renderCalcRooms();
    renderHomeProjectSummary();
    renderProjectExplorer();
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
    '</div>'+
    '<div class="hist-right">'+
      '<div class="hist-tr">'+h.tr+' TR</div>'+
      '<div class="hist-btu">'+Number(h.btu).toLocaleString()+' BTU/h</div>'+
      '<div class="hist-btu">'+Number(h.mkt).toLocaleString()+' Mkt</div>'+
    '</div>';
    list.appendChild(row);
  });
  renderCalcWorkflowCard();
  renderCalcRooms();
  renderHomeProjectSummary();
  renderProjectExplorer();
  renderQuote();
  updateDirectResults();
  if(window.AppProjects&&window.AppProjects.updateNavDots) window.AppProjects.updateNavDots();
}

function delRec(idx){
  if(idx < 0 || idx >= hist.length) return;
  if(!confirm(t('delroomconfirm'))) return;
  var roomRecordId = ensureRoomRecordId(idx);
  removeRoomFromAllZones(roomRecordId);
  hist.splice(idx,1);
  qlines.splice(idx,1);
  if(calcRoomsOpenIdx === idx) calcRoomsOpenIdx = -1;
  else if(calcRoomsOpenIdx > idx) calcRoomsOpenIdx--;
  save();
  recalcProjectTotals();
  renderCalcWorkflowCard();
  renderHist();
  renderTechReport();
  renderQuotation();
  refreshGrandTotal();
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
  var cityEl = G('inp-load-factor-preset');
  if(cityEl && h.cityKey && CITY_FACTORS[h.cityKey]) cityEl.value = h.cityKey;
  var windowAreaEl = G('inp-window-area');
  if(windowAreaEl) windowAreaEl.value = h.windowArea != null && h.windowArea !== 0 ? String(h.windowArea) : '';
  var exposureEl = G('inp-exposure-type');
  if(exposureEl && h.exposureType) exposureEl.value = h.exposureType;
  var insulationEl = G('inp-insulation-type');
  if(insulationEl && h.insulationType) insulationEl.value = h.insulationType;
  peopleManualOverride = !!(h.peopleManualOverride || h.manualOverride);
  updateFactorInputsUI();
  updateCalculationModeUI(curRoom);
  var rcInput=G('inp-room-count'); if(rcInput) rcInput.value=Math.max(1,parseInt(h.roomCount,10)||getQty(idx)||1);
  setRoomDimensionInputs(h.dims);
  if(!h.dims) setLegacyRoomVolume(h.vol);
  if(G('inp-ppl')) G('inp-ppl').value = h.ppl;
  if(!peopleManualOverride) syncPeopleEstimate(true);
  else updateOccupancyHelper();
  devs=[];
  if(h.devSum){ h.devSum.split(' | ').forEach(function(part){
    var m=part.match(/^(.+?)×(\d+)$/); if(!m) return;
    var nm=m[1].trim(), qty=parseInt(m[2],10)||1;
    var c=DEVS.filter(function(x){return x.ar===nm||x.en===nm;})[0];
    if(c) devs.push({id:c.id,qty:qty});
  }); }
  renderDevs(); editIdx=idx;
  renderSelectedRoomPreview();
  renderProjectExplorer();
  renderDesktopInsightPanel();
  toast(lang==='ar'?'✏️ تم تحميل السجل للتعديل':'✏️ Record loaded for editing');
}
function resetApp(){
  // ── 1. Clear in-memory state ──────────────────────────────────────
  hist    = [];
  qlines  = [];
  hvacZones = [];
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
  renderCalcWorkflowCard();
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
  var rClient = G('report-client');  if(rClient) rClient.value = '';
  var rLoc    = G('report-location');if(rLoc)    rLoc.value    = '';
  var rDes    = G('report-designer');if(rDes)    rDes.value    = '';
  var rLang   = G('report-language');if(rLang)   rLang.value   = 'auto';
  persistProjectIdentityDraft();
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
    qlines[i]={qty:1,up:0,unitType:'split',selectedBtu:0,qtyAuto:true,autoReason:'',systems:[],systemPrices:{},systemPricing:{},assignment:{mode:'independent',zoneId:''},roomRecordId:''};
  } else {
    if(qlines[i].qtyAuto === undefined) qlines[i].qtyAuto = true;
    if(qlines[i].autoReason === undefined) qlines[i].autoReason = '';
    if(!qlines[i].unitType) qlines[i].unitType = 'split';
    if(qlines[i].selectedBtu === undefined) qlines[i].selectedBtu = 0;
    if(qlines[i].up === undefined) qlines[i].up = 0;
    if(qlines[i].qty === undefined) qlines[i].qty = 1;
    if(!Array.isArray(qlines[i].systems)) qlines[i].systems = [];
    if(!qlines[i].systemPrices || typeof qlines[i].systemPrices !== 'object') qlines[i].systemPrices = {};
    qlines[i].assignment = normalizeRoomAssignment(qlines[i].assignment);
    if(!qlines[i].roomRecordId) qlines[i].roomRecordId = '';
    if(qlines[i].systemPricing && typeof qlines[i].systemPricing === 'object'){
      Object.keys(qlines[i].systemPricing).forEach(function(key){
        if(qlines[i].systemPrices[key] === undefined) qlines[i].systemPrices[key] = qlines[i].systemPricing[key];
      });
    }
    qlines[i].systems.forEach(function(system){
      if(system && system.id && qlines[i].systemPrices[system.id] === undefined && system.unitPrice !== undefined){
        qlines[i].systemPrices[system.id] = { unitPrice: Math.max(0, parseFloat(system.unitPrice) || 0) };
      }
    });
    qlines[i].systemPricing = qlines[i].systemPrices;
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
  syncAllRoomSystemStates();
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
function getQuotationSaveButtonHtml(extraClass){
  var cls = 'quote-inline-save-btn' + (extraClass ? ' ' + extraClass : '');
  return '<button type="button" class="'+cls+'" data-pro-feature="saveQuotation" onclick="saveQuotationToCurrentProject()" title="'+t('qsave')+'" aria-label="'+t('qsave')+'">💾 <span>'+t('qsave')+'</span></button>';
}
function layoutQuotationWorkspace(quoteView){
  var page=G('p-hist'),quoteCard=quoteView && quoteView.closest('.quote-card');
  if(!page || !quoteCard) return;
  var context=G('quote-project-context');
  if(!context){context=document.createElement('div');context.id='quote-project-context';}
  context.innerHTML=renderProjectContextSummary({quotation:true})+renderDuctAndFilterSummary(lang==='ar');
  page.insertBefore(context,page.firstChild);
  var roomList=G('hist-list'),history=roomList && roomList.closest('.card');
  if(!history) return;
  history.classList.add('quote-room-history');
  var columns=G('quote-workspace-columns');
  if(!columns){columns=document.createElement('div');columns.id='quote-workspace-columns';}
  columns.className='quote-workspace-columns';
  quoteCard.dir=history.dir=document.documentElement.dir || (lang==='ar'?'rtl':'ltr');
  columns.appendChild(history);
  columns.appendChild(quoteCard);
  page.insertBefore(columns,context.nextSibling);
}

function quotationRiyalSymbol(){
  // Official SAMA outline, embedded so quotations also work offline and in print.
  return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1124.14 1256.39" role="img" aria-label="SAR" style="display:inline-block;width:.9em;height:1em;vertical-align:-.12em;fill:currentColor;margin-inline:3px"><path d="M699.62,1113.02h0c-20.06,44.48-33.32,92.75-38.4,143.37l424.51-90.24c20.06-44.47,33.31-92.75,38.4-143.37l-424.51,90.24Z"/><path d="M1085.73,895.8c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.33v-135.2l292.27-62.11c20.06-44.47,33.32-92.75,38.4-143.37l-330.68,70.27V66.13c-50.67,28.45-95.67,66.32-132.25,110.99v403.35l-132.25,28.11V0c-50.67,28.44-95.67,66.32-132.25,110.99v525.69l-295.91,62.88c-20.06,44.47-33.33,92.75-38.42,143.37l334.33-71.05v170.26l-358.3,76.14c-20.06,44.47-33.32,92.75-38.4,143.37l375.04-79.7c30.53-6.35,56.77-24.4,73.83-49.24l68.78-101.97v-.02c7.14-10.55,11.3-23.27,11.3-36.97v-149.98l132.25-28.11v270.4l424.53-90.28Z"/></svg>';
}
var quotationCurrencyObserver;
function prepareQuotationCurrency(){
  var host=G('p-hist');
  if(!host || quotationCurrencyObserver) return;
  function decorate(){
    quotationCurrencyObserver.disconnect();
    var walker=document.createTreeWalker(host,NodeFilter.SHOW_TEXT), nodes=[], node;
    while((node=walker.nextNode())){
      if(node.nodeValue.indexOf('\ufdfc')!==-1 && !node.parentElement.closest('input,textarea,select,script,style,svg')) nodes.push(node);
    }
    nodes.forEach(function(textNode){
      var fragment=document.createDocumentFragment();
      textNode.nodeValue.split('\ufdfc').forEach(function(part,index){
        if(index){var symbol=document.createElement('span');symbol.innerHTML=quotationRiyalSymbol();fragment.appendChild(symbol.firstChild);}
        fragment.appendChild(document.createTextNode(part));
      });
      textNode.replaceWith(fragment);
    });
    quotationCurrencyObserver.observe(host,{childList:true,subtree:true,characterData:true});
  }
  quotationCurrencyObserver=new MutationObserver(decorate);
  decorate();
}
function renderQuote(){
  prepareQuotationCurrency();
  renderTechReportFoundation();
  var list=G('qi-list'); if(list) list.innerHTML='';
  var quoteView=G('quote-view-list'); if(quoteView) quoteView.innerHTML='';
  if(isProjectHvacMode() && getProjectQtyAuto()){
    syncProjectRecommendation({keepSelectedCapacity:true});
  }
  layoutQuotationWorkspace(quoteView);
  if(!hist.length){
    var em=document.createElement('div'); em.className='qi-empty'; em.textContent=t('qempty');
    if(list) list.appendChild(em);
    if(quoteView){
      var em2=document.createElement('div'); em2.className='qi-empty'; em2.textContent=t('qempty');
      quoteView.appendChild(em2);
    }
    refreshGrandTotal();
    if (window.AppPlan && typeof window.AppPlan.syncLockedUI === 'function') {
      window.AppPlan.syncLockedUI(list || document);
      if (quoteView) window.AppPlan.syncLockedUI(quoteView);
    }
    return;
  }
  var showProjectQuoteCard = isProjectHvacMode();
  if(showProjectQuoteCard && quoteView){
    var projectAssignedRooms = getProjectAssignedRoomIndices();
    var projReqBtu = projectAssignedRooms.length
      ? projectAssignedRooms.reduce(function(sum, idx){ return sum + getRoomRequiredBtu(idx); }, 0)
      : getProjTotalBtu();
    var projReqCfm = projectAssignedRooms.length
      ? projectAssignedRooms.reduce(function(sum, idx){ return sum + getRoomRequiredCfm(idx); }, 0)
      : getProjTotalCfm();
    var projSelBtu = getProjectCentralSelectedBtu();
    var projSelCfm = getProjectCentralSelectedCfm();
    var projStatus = getProjectCapacityStatus(projReqBtu, projSelBtu);
    var projItem = document.createElement('div');
    projItem.className = 'quote-readonly-card';
    var systemsWithDrafts = ensureProjectSystems().filter(Boolean);
    var projectUnitsHtml = ensureProjectSystems().map(function(system){
      var qty = Math.max(1, parseInt(system.qty,10) || 1);
      var lineTotal = money((parseFloat(system.unitPrice)||0) * qty);
      var option = system.selectedEquipmentOption || (system.equipmentSnapshot && system.equipmentSnapshot.selectionOption) || {};
      var record = (system.equipmentSnapshot && system.equipmentSnapshot.record) || option.record || {};
      var manufacturer = system.selectedManufacturer || record.manufacturerName || record.brand || '';
      var model = system.selectedModel || record.exactModelNumber || record.series || '';
      var capacity = Number(system.selectedCapacityBtuH || record.coolingCapacityBtuH || system.selectedBtu || 0) || 0;
      var equipmentLine = manufacturer || model
        ? [utLabel(system.unitType || 'split'), manufacturer, model].filter(Boolean).join(' · ')
        : (utLabel(system.unitType || 'split') + ' · ' + (lang==='ar'?'سعة قياسية':'Standard Capacity'));
      return '<div class="quote-readonly-stat"><div class="quote-readonly-label">'+(lang==='ar'?'البند':'Item')+'</div><div class="quote-readonly-value">'+esc(getProjectSystemDisplayName(system.id))+' · '+esc(equipmentLine)+' · '+Number(capacity).toLocaleString()+' BTU/h × '+qty+'</div><div class="quote-readonly-label">'+(lang==='ar'?'الإجمالي':'Total')+' '+lineTotal+'</div></div>';
    }).join('');
    var automaticQuotationHtml = systemsWithDrafts.length
      ? systemsWithDrafts.map(function(system){ return renderAutomaticQuotationDraft(system); }).join('')
      : '<div class="quote-readonly-note quote-auto-empty">'+(lang==='ar'?'حدد نوع النظام والسعة في تصميم المشروع لبدء التسعير.' :'Set the system type and capacity in project design to start pricing.')+'</div>';
    projItem.innerHTML =
      '<div class="quote-readonly-head"><span class="qi-num">#1</span><span class="qi-name">'+(lang==='ar'?'وحدة المشروع المركزية':'Central Project Unit')+'</span></div>'+
      '<div class="quote-readonly-grid">'+
        projectUnitsHtml+
        '<div class="quote-readonly-stat"><div class="quote-readonly-label">'+(lang==='ar'?'الكمية الإجمالية':'Total Quantity')+'</div><div class="quote-readonly-value">'+ensureProjectSystems().reduce(function(sum, system){ return sum + Math.max(1, parseInt(system.qty,10)||1); }, 0)+'</div></div>'+
      '</div>'+
      '<div class="quote-readonly-note">'+(lang==='ar'?'البيانات الهندسية مقفلة من التقرير الفني. عد إلى التقرير لتغيير الشركة أو الموديل أو السعة الفعلية.':'Engineering data is locked from the technical report. Return to the report to change manufacturer, model, or actual capacity.')+'</div>'+
      automaticQuotationHtml;
    quoteView.appendChild(projItem);
  }
  hist.forEach(function(h,i){
    ensureQuoteLine(i);
    var roomSystemState = getRoomSystemState(i);
    var hasMixedSystems = roomSystemState.systems.length > 0;
    if(getQtyAuto(i) && !hasMixedSystems) syncQuoteLineRecommendation(i,{keepSelectedCapacity:true});
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
    var _qtyDisabled = _bundleLocked;
    var qtyCtrlHtml='<div class="qi-unit-count"><span class="qi-utype-lbl">'+(lang==='ar'?'عدد الوحدات':'Units Needed')+'</span>'+
      '<div class="qi-unit-stepper" data-step-kind="quote-room" data-room-index="'+i+'" aria-label="'+(lang==='ar'?'تعديل عدد الوحدات':'Adjust units needed')+'">'+
        '<button type="button" class="qbtn'+(_qtyDisabled?' qty-locked':'')+'" '+(_qtyDisabled?'disabled':'')+' data-delta="1" aria-label="'+(lang==='ar'?'زيادة عدد الوحدات':'Increase units needed')+'">+</button>'+
        '<input class="qi-unit-count-input'+(_qtyDisabled?' qty-locked-input':'')+'" type="number" min="1" step="1" value="'+qty+'" '+(_qtyDisabled?'readonly':'')+' onchange="setQty('+i+',this.value)">'+
        '<button type="button" class="qbtn'+(_qtyDisabled?' qty-locked':'')+'" '+(_qtyDisabled?'disabled':'')+' data-delta="-1" aria-label="'+(lang==='ar'?'تقليل عدد الوحدات':'Decrease units needed')+'">−</button>'+
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
    roomSystemState = syncRoomSystemState(i) || roomSystemState;
    var roomSystemsSelected = roomSystemState.selectedCapacityBtu;
    var roomSystemsSubtotal = getRoomSystemsSubtotal(i);
    var roomQuoteSystemsHtml = renderQuoteSystemsPricing(i);
    // In bundle mode: per-room warnings are suppressed (project-level shown separately)
    var reqCompareBtu = getQuoteRequiredBtu(i, curUT);
    var effCap = _bundleLocked ? reqCompareBtu : (roomSystemsSelected > 0 ? roomSystemsSelected : (selBtu * qty)); // neutralise per-room warnings in bundle mode
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
    if(!_bundleLocked && capBadge && !hasMixedSystems) capHtml = '<div class="qi-cap-status">'+capBadge+'</div>';
    var roomSystemsHtml = renderRoomSystemsEditor(i, parseInt(h.btu)||0);
    var smartSuggestionsHtml = renderSmartSuggestions(i);

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
            var _rdThresholds = getEngineeringValidationThresholds();
            var _rdNote = '';
            if(_rdR > _rdThresholds.GENERAL_OVERSIZE_HIGH_PCT){
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
              '<span style="margin-right:5px;font-family:var(--fe);color:' + (_rdR < 0 ? '#ef4444' : _rdR > _rdThresholds.GENERAL_OVERSIZE_HIGH_PCT ? '#f59e0b' : 'var(--g)') + '"> (' + _rdStr + ')</span>' +
              '</div>' + _rdNote;
          }
          return '';
        })()+
        '<div class="duct-note">'+(lang==='ar'?'سرعة الإمداد: ':'Sup vel: ')+_vSup+' fpm | '+(lang==='ar'?'الرجوع: ':'Ret: ')+_vRet+' fpm</div>'+
      '</div>';
    }

    var summaryStatsHtml =
      '<div class="qi-tech qi-tech-details">'+
          '<div class="qi-stat"><div class="qi-slbl">m³</div><div class="qi-sval">'+h.vol+'</div></div>'+
          '<div class="qi-stat"><div class="qi-slbl">'+(lang==='ar'?'غرف':'Rooms')+'</div><div class="qi-sval ca">'+roomCount+'</div></div>'+
          '<div class="qi-stat"><div class="qi-slbl">👤</div><div class="qi-sval">'+h.ppl+'</div></div>'+
          '<div class="qi-stat"><div class="qi-slbl">TR</div><div class="qi-sval ca">'+h.tr+'</div></div>'+
          '<div class="qi-stat"><div class="qi-slbl">CFM</div><div class="qi-sval">'+Number(h.cfm).toLocaleString()+'</div></div>'+
          '<div class="qi-stat"><div class="qi-slbl">BTU/h</div><div class="qi-sval cam">'+Number(h.btu).toLocaleString()+'</div></div>'+
          '<div class="qi-stat"><div class="qi-slbl">Mkt BTU</div><div class="qi-sval">'+Number(h.mkt).toLocaleString()+'</div></div>'+
          (h.devBtu>0?'<div class="qi-stat"><div class="qi-slbl">Dev</div><div class="qi-sval cam">'+Number(h.devBtu).toLocaleString()+'</div></div>':'')+
      '</div>';
    var quickSummaryHtml = renderRoomQuickSummary(i, roomSystemState, reqCompareBtu, effCap);
    var validationHtml = renderRoomValidationCompact(i, roomSystemState);
    var recommendationHtml = renderRoomRecommendationCompact(i, roomSystemState);
    item.innerHTML=
      '<div class="qi-head"><span class="qi-num">#'+(i+1)+'</span><span class="qi-name">'+name+'</span></div>'+_lockNote+
      '<div class="qi-body qi-body-tech-report">'+
        quickSummaryHtml+
        roomSystemsHtml+
        validationHtml+
        recommendationHtml+
      '</div>';
    if(list) list.appendChild(item);
    if(quoteView && quoteMode!=='proj'){
      var ro=document.createElement('div');
      ro.className='quote-readonly-card';
      if(hasMixedSystems){
        ro.innerHTML=
          '<div class="quote-readonly-head"><span class="qi-num">#'+(i+1)+'</span><span class="qi-name">'+name+'</span></div>'+
          '<div class="quote-readonly-grid">'+
            '<div class="quote-readonly-stat"><div class="quote-readonly-label">'+(lang==='ar'?'الوصف':'Description')+'</div><div class="quote-readonly-value">'+esc(name)+' · '+Number(roomSystemsSelected||0).toLocaleString()+' BTU</div></div>'+
            '<div class="quote-readonly-stat"><div class="quote-readonly-label">'+(lang==='ar'?'عدد الوحدات':'Unit Qty')+'</div><div class="quote-readonly-value">'+getRoomQuoteTotalQty(i)+'</div></div>'+
          '</div>'+
          roomQuoteSystemsHtml+
          '<div class="qi-price-row qi-price-row-simple quote-price-row">'+
            '<div class="qi-save-box">'+
              '<div class="qi-plbl">'+t('qsave')+'</div>'+
              getQuotationSaveButtonHtml('quote-inline-save-btn-row')+
            '</div>'+
            '<div class="qi-lt-box">'+
              '<div class="qi-lt-lbl">'+(lang==='ar'?'الإجمالي':'Total')+'</div>'+
              '<div class="qi-lt-val" id="qlt-'+i+'">'+money(getRoomQuoteSubtotal(i))+'</div>'+
            '</div>'+
          '</div>'+
          '<div class="quote-readonly-note">'+(lang==='ar'?'هذه الصفحة تعرض بنود التسعير فقط.':'This page shows pricing items only.')+'</div>';
      } else {
        ro.innerHTML=
          '<div class="quote-readonly-head"><span class="qi-num">#'+(i+1)+'</span><span class="qi-name">'+name+'</span></div>'+
          '<div class="quote-readonly-grid">'+
            '<div class="quote-readonly-stat"><div class="quote-readonly-label">'+(lang==='ar'?'الوصف':'Description')+'</div><div class="quote-readonly-value">'+utLabel(curUT)+' · '+Number(selBtu||0).toLocaleString()+' BTU</div></div>'+
            '<div class="quote-readonly-stat"><div class="quote-readonly-label">'+(lang==='ar'?'الكمية':'Quantity')+'</div><div class="quote-readonly-value">'+qty+'</div></div>'+
          '</div>'+
          '<div class="qi-price-row qi-price-row-simple quote-price-row">'+
            '<div>'+
              '<div class="qi-plbl">'+(lang==='ar'?'سعر الوحدة':'Unit Price')+'</div>'+
              '<input class="minp" type="number" min="0" step="0.01" value="'+(up||'')+'" placeholder="0.00" onchange="setUp('+i+',this.value)">'+
            '</div>'+
            '<div class="qi-save-box">'+
              '<div class="qi-plbl">'+t('qsave')+'</div>'+
              getQuotationSaveButtonHtml('quote-inline-save-btn-row')+
            '</div>'+
            '<div class="qi-lt-box">'+
              '<div class="qi-lt-lbl">'+(lang==='ar'?'الإجمالي':'Total')+'</div>'+
              '<div class="qi-lt-val" id="qlt-'+i+'">'+money(getRoomQuoteSubtotal(i))+'</div>'+
            '</div>'+
          '</div>'+
          '<div class="quote-readonly-note">'+(lang==='ar'?'هذه الصفحة تعرض بنود التسعير فقط.':'This page shows pricing items only.')+'</div>';
      }
      quoteView.appendChild(ro);
    }
  });
  refreshGrandTotal();
  if (window.AppPlan && typeof window.AppPlan.syncLockedUI === 'function') {
    window.AppPlan.syncLockedUI(list || document);
    if (quoteView) window.AppPlan.syncLockedUI(quoteView);
  }
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
  if(line.qtyAuto !== false){
    line.qtyAuto = false;
  }
  line.qty=Math.max(1,parseInt(v)||1);
  line.autoReason = buildAutoQtyReason('manual');
  save();
  var e=G('qlt-'+i); if(e) e.textContent=money(getRoomQuoteSubtotal(i));
  refreshGrandTotal();
  syncQuoteLineRecommendation(i,{keepSelectedCapacity:true});
  recalcProjectTotals();
  renderTechReport();
  renderQuotation();
  renderDesktopInsightPanel();
  renderHist();
  renderQuote();
}
function stepQuoteQty(i,delta){
  var line = ensureQuoteLine(i);
  if(line.qtyAuto !== false){
    line.qtyAuto = false;
    line.autoReason = buildAutoQtyReason('manual');
  }
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

function setUp(i,v){ if(!qlines[i]) qlines[i]={qty:1,up:0}; qlines[i].up=parseFloat(v)||0; save(); var e=G('qlt-'+i); if(e) e.textContent=money(getRoomQuoteSubtotal(i)); refreshGrandTotal(); }

function refreshGrandTotal(){
  var roomTotals = getRoomModeQuoteTotals();
  var totalQty = roomTotals.totalQty, subtotal = roomTotals.subtotal;
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
  var quoteTotals = getRoomModeQuoteTotals();
  var subtotal = quoteTotals.subtotal, totalQty = quoteTotals.totalQty;
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
  rows.push(['Equipment Subtotal',money(subtotal)+' ﷼','','','','','','','','','','','']);
  rows.push(['Installation ('+ip+'%)',money(instAmt)+' ﷼','','','','','','','','','','','']);
  if(vatOn) rows.push(['VAT 15%',money(vatAmt)+' ﷼','','','','','','','','','','','']);
    rows.push(['Total Quantity',totalQty,'','','','','','','','','','','']);
  rows.push(['Grand Total',money(grand)+' ﷼','','','','','','','','','','','']);
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
function esc(v){
  return xmlEscape(v);
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
function safeExportCell(v){
  if (v === undefined || v === null) return '';
  if (typeof v === 'number') return isFinite(v) ? v : '';
  if (typeof v === 'boolean') return v;
  return String(v);
}
var xlsxLoadPending = false;
function ensureXlsxForHap(callback){
  if(typeof XLSX !== 'undefined' && XLSX.utils && XLSX.writeFile){
    callback();
    return;
  }
  if(xlsxLoadPending){
    toast(lang==='ar'?'⏳ جاري تجهيز مكتبة Excel':'⏳ Preparing Excel export library');
    return;
  }
  xlsxLoadPending = true;
  var script = document.createElement('script');
  script.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
  script.async = true;
  script.onload = function(){
    xlsxLoadPending = false;
    if(typeof XLSX !== 'undefined' && XLSX.utils && XLSX.writeFile){
      callback();
    } else {
      toast(lang==='ar'?'⚠️ مكتبة Excel غير متاحة الآن':'⚠️ Excel library is not available right now');
    }
  };
  script.onerror = function(){
    xlsxLoadPending = false;
    toast(lang==='ar'?'⚠️ تعذر تحميل مكتبة Excel':'⚠️ Failed to load Excel export library');
  };
  document.head.appendChild(script);
  toast(lang==='ar'?'جاري تجهيز تصدير HAP':'Preparing HAP export');
}
function exportHAP(){
  if(!hist.length){ toast(lang==='ar'?'⚠️ لا توجد غرف محفوظة':'⚠️ No saved rooms'); return; }
  if(typeof XLSX === 'undefined' || !XLSX.utils || !XLSX.writeFile){
    ensureXlsxForHap(function(){ exportHAP(); });
    return;
  }
  trackAppEvent('export_hap', {
    language: currentAnalyticsLanguage(),
    rooms: hist.length
  });
  var projectName = ((G('quote-project')||{value:''}).value || (G('tech-project')||{value:''}).value || '').trim() || (lang==='ar'?'غير محدد':'Untitled');
  var today = new Date().toISOString().slice(0,10);
  var roomRows = [];
  var totalBtu = 0, totalTr = 0, totalCfm = 0;
  hist.forEach(function(h){
    var dims = h.dims || {};
    var area = (Number(dims.len||0) * Number(dims.width||0)) || 0;
    var modeLabel = h.calcMode === 'hc' ? t('ashraehc') : t('loadmode');
    var freshAirModeLabel = h.calcMode === 'hc'
      ? (h.freshAirMode === 'fresh100' ? t('fresh100lbl') : t('mixedair'))
      : '';
    roomRows.push({
      'Room Name': safeExportCell(lang==='ar'?(h.ar||h.en):(h.en||h.ar)),
      'Room Type': safeExportCell(h.roomType || (lang==='ar'?(h.ar||h.en):(h.en||h.ar))),
      'Calculation Mode': safeExportCell(modeLabel),
      'Volume': safeExportCell(Number(h.vol||0)),
      'Area': safeExportCell(Number(area.toFixed(2))),
      'Height': safeExportCell(Number(dims.height||0)),
      'People': safeExportCell(Number(h.ppl||0)),
      'Equipment Load': safeExportCell(Number(h.equipmentBtu||0)),
      'City': safeExportCell(h.calcMode === 'hc' ? '' : (h.cityLabelEn || h.cityLabelAr || '')),
      'City Factor': safeExportCell(h.calcMode === 'hc' ? '' : Number(h.cityFactor||0)),
      'Load Factor': safeExportCell(h.calcMode === 'hc' ? '' : Number(h.loadFactor||0)),
      'Insulation Type': safeExportCell(h.calcMode === 'hc' ? '' : (h.insulationLabelEn || h.insulationLabelAr || '')),
      'Insulation Multiplier': safeExportCell(h.calcMode === 'hc' ? '' : Number(h.insulationMultiplier||0)),
      'Window Area': safeExportCell(h.calcMode === 'hc' ? '' : Number(h.windowArea||0)),
      'Exposure Type': safeExportCell(h.calcMode === 'hc' ? '' : (h.exposureLabelEn || h.exposureLabelAr || '')),
      'Window Factor': safeExportCell(h.calcMode === 'hc' ? '' : Number(h.windowFactor||0)),
      'Window Load': safeExportCell(h.calcMode === 'hc' ? '' : Number(h.windowLoad||0)),
      'Manual Override': safeExportCell(h.calcMode === 'hc' ? '' : (h.manualOverride ? 'Yes' : 'No')),
      'Fresh Air Mode': safeExportCell(freshAirModeLabel),
      'Outdoor Air CFM': safeExportCell(Number(h.oa||0)),
      'Recirculated CFM': safeExportCell(Number(h.recirc||0)),
      'Exhaust CFM': safeExportCell(Number(h.exh||0)),
      'Total CFM': safeExportCell(Number(h.cfm||0)),
      'Total BTU': safeExportCell(Number(h.btu||0)),
      'TR': safeExportCell(Number(h.tr||0)),
      'ACH': safeExportCell(h.ach != null ? Number(h.ach) : ''),
      'Pressure': safeExportCell(h.pressure || h.pres || '')
    });
    totalBtu += Number(h.btu||0);
    totalTr += Number(h.tr||0);
    totalCfm += Number(h.cfm||0);
  });
  var summaryRows = [
    {'Metric':'Total Rooms','Value': safeExportCell(hist.length)},
    {'Metric':'Total BTU','Value': safeExportCell(totalBtu)},
    {'Metric':'Total TR','Value': safeExportCell(Number(totalTr.toFixed(2)))},
    {'Metric':'Total CFM','Value': safeExportCell(totalCfm)}
  ];
  var metaRows = [
    {'Field':'Project Name','Value': safeExportCell(projectName)},
    {'Field':'Date','Value': safeExportCell(today)},
    {'Field':'Mode','Value': safeExportCell(isProjectHvacMode() ? 'Project' : 'Room')}
  ];
  var wb = XLSX.utils.book_new();
  var wsRooms = XLSX.utils.json_to_sheet(roomRows);
  var wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  var wsMeta = XLSX.utils.json_to_sheet(metaRows);
  XLSX.utils.book_append_sheet(wb, wsRooms, 'Rooms');
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Metadata');
  XLSX.writeFile(wb, 'AirCalc_HAP_Export_' + today + '.xlsx');
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
  var cur  = quotationRiyalSymbol();
  var roomTotals = getRoomModeQuoteTotals();
  var subtotal = roomTotals.subtotal;
  var totalQty = roomTotals.totalQty;
  var instAmt = subtotal*ip/100;
  var vatBase = subtotal+instAmt;
  var vatAmt  = vatOn ? vatBase*0.15 : 0;
  var grand   = vatBase+vatAmt;
  var fontLink = isAr
    ? '<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">'
    : '<link href="https://fonts.googleapis.com/css2?family=Rajdhani:wght@500;600;700&display=swap" rel="stylesheet">';
  var bodyFont = isAr ? "'Cairo', Arial, sans-serif" : "'Segoe UI', Arial, sans-serif";
  var utLbls={}; Object.keys(UT_LABELS_AR).forEach(function(k){utLbls[k]=isAr?UT_LABELS_AR[k]:UT_LABELS_EN[k];}); utLbls['chillerfcu']=isAr?'وحدة مناولة / FCU':'FCU (Chilled Water)'; utLbls['chiller']=isAr?'تشيلر هوائي':'Chiller (Air-Cooled)';
  return {proj:proj,qno:qno,today:today,ip:ip,validDays:validDays,validLabel:validLabel,notes:notes,isAr:isAr,dir:dir,cur:cur,subtotal:subtotal,totalQty:totalQty,instAmt:instAmt,vatBase:vatBase,vatAmt:vatAmt,grand:grand,fontLink:fontLink,bodyFont:bodyFont,utLbls:utLbls,isBundleProj:(bundleOn&&isProjectHvacMode())};
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
    +' .report-qr-card{background:#fff;border:1px solid #dbeafe;border-radius:8px;padding:8px;text-align:center;min-height:118px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;}'
    +' .report-qr-title{font-size:8px;color:#64748b;font-weight:700;text-transform:uppercase;letter-spacing:.4px;}'
    +' .report-qr-img{width:78px;height:78px;object-fit:contain;border:1px solid #e2e8f0;border-radius:4px;background:#fff;}'
    +' .report-qr-caption{font-size:6.5px;color:#64748b;line-height:1.25;word-break:break-all;max-width:96px;}'
    +' .report-qr-placeholder{width:78px;height:78px;border:1px dashed #cbd5e1;border-radius:4px;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:11px;font-weight:700;background:#f8fafc;}'
    +' .report-qr-card.unavailable{background:#f8fafc;}'
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
    var roomSystemsSelected = getRoomSystemsSelectedCapacity(i);
    var roomSystemsSummary = buildRoomSystemsSummaryText(i);
    var effBtu = roomSystemsSelected > 0 ? roomSystemsSelected : (selBtu * getQty(i));
    var selTR=(effBtu/12000).toFixed(1);
    var lt=getRoomQuoteSubtotal(i);
    var bg=i%2===0?'#ffffff':'#f8fafc';
    rows+='<tr style="background:'+bg+'">'
      +'<td style="color:#64748b">'+(i+1)+'</td>'
      +'<td class="td-name">'+name
        +'<div style="font-size:10px;color:#0ea5e9;margin-top:1px;font-weight:600">'+utLbl+'</div>'
        +(roomSystemsSummary?'<div style="font-size:10px;color:#475569;margin-top:4px;line-height:1.5">'+roomSystemsSummary+'</div>':'')
      +'</td>'
      +'<td>'+h.vol+'</td>'
      +'<td>'+getRecordRoomCount(i)+'</td>'
      +'<td>'+Number(effBtu).toLocaleString()+' BTU</td>'
      +'<td>'+selTR+' TR</td>'
      +'<td>'+getRoomQuoteTotalQty(i)+'</td>'
      +'<td>'+c.cur+' '+money(getUP(i))+'</td>'
      +'<td style="color:#059669;font-weight:700">'+c.cur+' '+money(lt)+'</td>'
      +(function(){
        var _rb=parseInt(h.btu)||0;
        var _sb=roomSystemsSelected>0 ? roomSystemsSelected : (getSelBtu(i)||acRoundBtu(_rb,'btu'));
        var _ef=roomSystemsSelected>0 ? roomSystemsSelected : (_sb*getQty(i));
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
  var professionalReportData = refreshProfessionalReportDataCache({ language: c.isAr ? 'ar' : 'en' });
  var cards='';
  var anyUndersized=false, undersizedCount=0;
  var reportPrelude = buildReportPreludeHtml(c.isAr)+renderDuctAndFilterSummary(c.isAr);
  var assumptionsHtml =
    '<div style="border:1px solid #e2e8f0;border-radius:8px;padding:12px 14px;background:#fff;margin-bottom:12px;page-break-inside:avoid">'+
      '<div style="font-size:11px;font-weight:700;color:#0f172a;margin-bottom:6px">'+(c.isAr?'افتراضات وحدود':'Assumptions & Limitations')+'</div>'+
      '<div style="font-size:10px;color:#475569;line-height:1.8">'+
        (c.isAr
          ? 'يعرض هذا التقرير تحققًا هندسيًا أوليًا للسعة وتدفق الهواء والاشتراطات الصحية عند توفرها. لا يعتبر التقرير اعتمادًا نهائيًا للتصميم أو بديلاً عن مراجعة المخططات والكتالوجات واعتماد المهندس المختص.'
          : 'This report shows a preliminary engineering validation for capacity, airflow, and healthcare guidance when available. It is not a final design approval and does not replace drawing review, catalog verification, or qualified engineering approval.')+
      '</div>'+
    '</div>';
  for(var i=0;i<hist.length;i++){
    var h=hist[i];
    var _nm=c.isAr?(h.ar||h.en):(h.en||h.ar);
    var name=_nm.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{2702}-\u{27B0}\u{24C2}-\u{1F251}]/gu,'').trim();
    var utKey=getUT(i); var utLbl=c.utLbls[utKey]||utKey;
    var reqBtu=parseInt(h.btu)||0;
    var roomSystemsSelected = getRoomSystemsSelectedCapacity(i);
    var roomSystemsTableHtml = buildRoomSystemsTableHtml(i, reqBtu, c.isAr, c.cur);
    var roomValidation = getRoomEngineeringValidation(i, getRoomSystemState(i));
    var roomValidationHtml =
      '<div style="margin-top:8px;border:1px solid #e2e8f0;border-radius:8px;padding:10px 12px;background:#fff">'+
        '<div style="font-size:10px;font-weight:700;color:#0369a1;margin-bottom:6px">'+(c.isAr?'ملخص التحقق الهندسي':'Engineering Validation Summary')+'</div>'+
        buildValidationSummaryInline(roomValidation.items, c.isAr)+
      '</div>';
    // In project/bundle mode, per-room selBtu is irrelevant — use reqBtu to neutralise room warnings
    var _isBundleMode = (quoteMode==='proj') || bundleOn;
    var selBtu = _isBundleMode ? acRoundBtu(reqBtu,'btu') : (getSelBtu(i)||acRoundBtu(reqBtu,'btu'));
    var effCap = _isBundleMode ? reqBtu : (roomSystemsSelected>0 ? roomSystemsSelected : selBtu*getQty(i));
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
      var presetMeta = getRecordEquipmentPresetMeta(h);
      var presetNoteHtml = presetMeta
        ? '<div style="margin-bottom:7px;background:#fffbeb;border:1px solid #fbbf24;border-radius:6px;padding:7px 9px;font-size:10px;line-height:1.7;color:#92400e">'+
            '💡 '+(c.isAr
              ? 'تمت إضافة هذه الأجهزة تلقائيًا كافتراض للغرفة وتدخل ضمن حمل الأجهزة: '
              : 'These devices were automatically added as the room default equipment preset and are included in device heat load: ')+
            esc(presetMeta.names.join('، '))+' · '+Number(presetMeta.totalBtu||0).toLocaleString()+' BTU/h'+
          '</div>'
        : '';
      equipmentHtml='<div style="margin-top:8px;border:1px dashed #cbd5e1;border-radius:8px;padding:8px 10px">'+
        '<div style="font-size:10px;font-weight:700;color:#0369a1;margin-bottom:6px">'+(c.isAr?'ملخص حمل الأجهزة':'Equipment Heat Load Summary')+'</div>'+
        presetNoteHtml+
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
        +'<span style="font-size:10px;color:#94a3b8;margin-'+( c.isAr?'right':'left')+':auto">'+(roomSystemsSelected>0
          ? (Number(roomSystemsSelected).toLocaleString()+' BTU/h')
          : (Number(selBtu).toLocaleString()+' BTU × '+getQty(i)+(getQty(i)>1?' = '+Number(effCap).toLocaleString()+' BTU/h':'')))+' </span>'
        +'</div>')
        +roomLogicHtml+hcHtml+devHtml+equipmentHtml+roomSystemsTableHtml+roomValidationHtml+techDuctHtml
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
    var _bmProjStatus = getProjectCapacityStatus(_bmReqBtu, _bmSelBtu);
    var _bmBtuClr = _bmProjStatus.key==='matched' ? '#059669' : (_bmProjStatus.key==='undersized' ? '#d97706' : (_bmProjStatus.key==='oversized' ? '#6b7280' : '#64748b'));
    var _bmBtuBadge = _bmProjStatus.label + (_bmProjStatus.key!=='no_system_selected' ? ' ' + _bmProjStatus.percentText : '');
    // CFM comparison
    var _bmCfmPerTr=parseInt((typeof G==='function'&&G('duct-cfm-per-tr')?G('duct-cfm-per-tr').value:400))||400;
    var _bmUnitCfm=getProjectDuctCfmFromSelection(projState.sysType, projState.selBtu, projState.qty, _bmCfmPerTr);
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
            '<div style="font-size:9px;color:#94a3b8">'+_bmSelTr+' TR | '+esc(_bmProjStatus.percentText || '—')+'</div>'+
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
  return '<div class="inv-page" id="pdf-page2" data-report-schema-version="'+esc(professionalReportData && professionalReportData.schemaVersion || '')+'" data-report-source-of-truth="'+esc(professionalReportData && professionalReportData.sourceOfTruth || 'rules_engine')+'">'
    +buildTechnicalReportHeaderHtml(c)
    +'<div class="page-title">'+(c.isAr?'ملخص التصميم والتحقق':'Design & Validation Summary')+'<span class="page-badge tech">'+(c.isAr?'تقرير فني':'TECHNICAL REPORT')+'</span></div>'
    +reportPrelude
    +assumptionsHtml
    +globalWarn
    +renderTechReportSelectedEquipmentSnapshotSection(c.isAr)
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
  trackAppEvent('export_pdf', {
    language: currentAnalyticsLanguage(),
    report_type: 'quotation',
    rooms: hist.length
  });
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
  trackAppEvent('export_pdf', {
    language: currentAnalyticsLanguage(),
    report_type: 'technical',
    rooms: hist.length
  });
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

  var originalLang = lang;
  var reportLang = getEffectiveReportLanguage();
  var c, css, page2Html;
  try {
    if(reportLang !== originalLang) lang = reportLang;
    c=invCommon();
    css=invSharedCss(c);
    page2Html=buildPage2(c);
  } finally {
    lang = originalLang;
  }

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
      toast(originalLang==='ar'?'📄 تم استخراج التقرير الفني':'📄 Technical report exported');
      if(btn){ btn.disabled=false; btn.innerHTML='<span id="lbl-export4">'+(originalLang==='ar'?'تقرير فني':'Tech Report')+'</span>'; }
    }).catch(function(err){
      document.body.removeChild(wrap);
      console.error('TechPDF error:',err);
      toast(originalLang==='ar'?'❌ فشل استخراج التقرير':'❌ Export failed');
      if(btn){ btn.disabled=false; btn.innerHTML='<span id="lbl-export4">'+(originalLang==='ar'?'تقرير فني':'Tech Report')+'</span>'; }
    });
  };

  if(document.fonts&&document.fonts.ready){
    document.fonts.ready.then(function(){
      waitForPdfImages(wrap, 2500).then(function(){
        setTimeout(doCapture, reportLang==='ar' ? 800 : 400);
      });
    });
  } else {
    waitForPdfImages(wrap, 2500).then(function(){
      setTimeout(doCapture, reportLang==='ar' ? 1000 : 600);
    });
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
  var catalogCfm = 0;
  // Priority 1: catalog entry has explicit CFM
  for(var ci=0; ci<cat.length; ci++){
    if(cat[ci].btu === selBtu && cat[ci].cfm && cat[ci].cfm > 0){
      catalogCfm = cat[ci].cfm;
      break;
    }
  }
  if(window.AirCalcEngineering && typeof window.AirCalcEngineering.resolveDuctCfm === 'function'){
    var resolved = window.AirCalcEngineering.resolveDuctCfm({
      selectedBtuh: selBtu,
      fallbackCfm: fallbackCfm,
      cfmPerTr: cfmPerTr,
      catalogCfm: catalogCfm
    });
    if(resolved && resolved.ok === false){
      return {cfm: Math.max(1, fallbackCfm || 0), source: 'calc', label: 'CFM Source: Calculated Supply CFM'};
    }
    if(resolved.source === 'unit') return {cfm: resolved.cfm, source: 'unit', label: 'CFM Source: Selected Unit CFM'};
    if(resolved.source === 'tr') return {cfm: resolved.cfm, source: 'tr', label: 'CFM Source: Selected TR × ' + cfmPerTr};
    return {cfm: resolved.cfm, source: 'calc', label: 'CFM Source: Calculated Supply CFM'};
  }
  if(catalogCfm > 0) return {cfm: catalogCfm, source: 'unit', label: 'CFM Source: Selected Unit CFM'};
  // Priority 2: BTU-only catalog entry → derive from TR
  if(selBtu > 0){
    var selTrVal = selBtu / 12000;
    var derivedCfm = Math.round(selTrVal * cfmPerTr);
    if(derivedCfm > 0) return {cfm: derivedCfm, source: 'tr', label: 'CFM Source: Selected TR × ' + cfmPerTr};
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

function getProjectDuctCfmFromSelection(utKey, selBtu, qty, cfmPerTr){
  var resolved = getProjDuctCfm(utKey, selBtu, qty, 0, cfmPerTr);
  return resolved && resolved.source !== 'calc' ? resolved.cfm : 0;
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
  var inputs={
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
  var review=getDuctFilterReviewState();
  if(projState.ductDimensions && review.sup && review.ret && inputs.lenSup+inputs.lenRet>0){
    inputs.fric=(Number(review.sup.dP_pa)+Number(review.ret.dP_pa))/(inputs.lenSup+inputs.lenRet);
  }
  // This is an additional filter; retain the baseline filter loss exactly once.
  if(review.filterActive && Number.isFinite(review.filterLossPa) && review.filterLossPa>=0)inputs.filterLoss+=review.filterLossPa;
  return inputs;
}
function calculateEspBreakdown(inputs){
  var eng = window.AirCalcEngineering ? window.AirCalcEngineering.calculateEsp({
    lenSupM: inputs.lenSup,
    lenRetM: inputs.lenRet,
    bends: inputs.bends,
    frictionPaPerM: inputs.fric,
    bendLossPerPa: inputs.bendLossPer,
    filterLossPa: inputs.filterLoss,
    diffuserLossPa: inputs.diffuserLoss,
    coilLossPa: inputs.coilLoss,
    damperLossPa: inputs.damperLoss,
    otherLossPa: inputs.otherLoss
  }) : null;
  if(eng && eng.ok === false){
    return {
      ok: false,
      errors: eng.errors || []
    };
  }
  var iconMap = {low:'🟢', med:'🟡', high:'🔴'};
  var status = eng ? eng.status : {key:'low', ar:'منخفض', en:'Low'};
  status.icon = iconMap[status.key] || '🟢';
  var straightFriction = eng ? eng.straightFrictionPa : (inputs.lenSup + inputs.lenRet) * inputs.fric;
  var bendLoss = eng ? eng.bendLossPa : inputs.bends * inputs.bendLossPer;
  var adders = eng ? eng.addersPa : inputs.filterLoss + inputs.diffuserLoss + inputs.coilLoss + inputs.damperLoss + inputs.otherLoss;
  var totalPa = eng ? eng.totalPa : straightFriction + bendLoss + adders;
  var totalInwg = eng ? eng.totalInwg : paToInwg(totalPa);
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
  if(breakdown && breakdown.ok === false){
    window._lastEspCalc = null;
    var validationMessage = isAr
      ? 'تحقق من مدخلات ESP: لا يمكن استخدام قيم سالبة.'
      : 'Check ESP inputs: negative values are not allowed.';
    var validationDetails = (breakdown.errors || []).map(function(error){
      return '<div class="esp-break-row"><span class="esp-break-lbl">'+error+'</span></div>';
    }).join('');
    var invalidResult = G('esp-result');
    if(invalidResult){
      invalidResult.innerHTML =
        '<span class="esp-badge esp-high">'+(isAr ? 'غير صالح' : 'Invalid')+'</span>'+
        '<div class="esp-total-stack"><div class="esp-total-main">'+validationMessage+'</div></div>';
    }
    var invalidBreakdown = G('esp-breakdown');
    if(invalidBreakdown){
      invalidBreakdown.innerHTML = validationDetails;
    }
    syncEspBreakdownToggle();
    return;
  }
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
  var el = G('proj-qty');
  if(!el) return;
  if(getProjectQtyAuto()) projState.qtyAuto = false;
  var next = Math.max(1, (parseInt(el.value,10) || 1) + (parseInt(delta,10) || 0));
  el.value = next;
  projState.qty = next;
  projState.autoReason = buildAutoQtyReason('manual');
  recalcCentralProjectSystem();
}
function bindUnifiedQtySteppers(){
  if(window.__acpQtyStepperBound) return;
  window.__acpQtyStepperBound = true;
  document.addEventListener('click', function(ev){
    var btn = ev.target.closest('.mixed-qty-stepper .qbtn, .qi-unit-stepper .qbtn');
    if(!btn || btn.disabled) return;
    var host = btn.closest('.mixed-qty-stepper, .qi-unit-stepper');
    if(!host) return;
    var delta = parseInt(btn.getAttribute('data-delta'), 10) || 0;
    if(!delta) return;
    var kind = host.getAttribute('data-step-kind') || '';
    if(kind === 'quote-room'){
      ev.preventDefault();
      var quoteRoomIndex = parseInt(host.getAttribute('data-room-index'), 10);
      stepQuoteQty(quoteRoomIndex, delta);
      return;
    }
  });
}
function setProjQtyManual(v){
  if(getProjectQtyAuto()) projState.qtyAuto = false;
  projState.qty = Math.max(1, parseInt(v,10) || 1);
  projState.autoReason = buildAutoQtyReason('manual');
  recalcCentralProjectSystem();
}
function setProjectQtyAuto(enabled){
  projState.qtyAuto = enabled !== false;
  if(projState.qtyAuto){
    syncProjectRecommendation({keepSelectedCapacity:true});
  } else {
    projState.autoReason = buildAutoQtyReason('manual');
  }
  recalcCentralProjectSystem();
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
  if(row) row.style.display = isProjectHvacMode() ? '' : 'none';
}
function toggleBundle(){
  bundleOn = !bundleOn;
  _updateBundleUI();
  if(isProjectHvacMode()){ renderProjBlock(); } else { renderQuote(); }
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
  mode = setSharedQuoteMode(mode);
  var btnRoom = G('mode-btn-room'), btnProj = G('mode-btn-proj');
  var calcBtnRoom = G('calc-mode-btn-room'), calcBtnProj = G('calc-mode-btn-proj');
  var qiList = G('qi-list'), projBlock = G('proj-block');
  var bundleRow = G('bundle-row');
  if(mode === 'proj'){
    ensureProjectSystems();
    if(!projectSystems.length) seedProjectSystemsFromLegacyState();
    for(var pi=0; pi<hist.length; pi++){
      ensureQuoteLine(pi).assignment = normalizeRoomAssignment({ mode:'project', zoneId:'', projectSystemId:'' });
    }
    if(btnRoom) btnRoom.classList.remove('active');
    if(btnProj) btnProj.classList.add('active');
    if(calcBtnRoom) calcBtnRoom.classList.remove('active');
    if(calcBtnProj) calcBtnProj.classList.add('active');
    if(qiList) qiList.style.display = 'none';
    if(projBlock) projBlock.style.display = '';
    // Show bundle toggle only in proj mode
    if(bundleRow) bundleRow.style.display = '';
  } else {
    for(var ri=0; ri<hist.length; ri++){
      ensureQuoteLine(ri).assignment = normalizeRoomAssignment({ mode:'independent', zoneId:'', projectSystemId:'' });
    }
    if(btnRoom) btnRoom.classList.add('active');
    if(btnProj) btnProj.classList.remove('active');
    if(calcBtnRoom) calcBtnRoom.classList.add('active');
    if(calcBtnProj) calcBtnProj.classList.remove('active');
    if(qiList) qiList.style.display = '';
    if(projBlock) projBlock.style.display = 'none';
    // In room mode, bundle toggle shown only if there are rooms to aggregate
    if(bundleRow) bundleRow.style.display = hist.length > 1 ? '' : 'none';
  }
  _updateBundleUI();
  persistQuoteState();
  renderCalcWorkflowCard();
  refreshModeDependentUi();
}

function onProjSysTypeChange(){
  var sel = G('proj-systype');
  if(!sel) return;
  projState.sysType = getAllowedSystemType(sel.value);
  // Rebuild capacity dropdown
  var capSel = G('proj-cap');
  if(capSel){
    var cat = getCatalog(projState.sysType);
    capSel.innerHTML = cat.map(function(c){
      var lbl = lang==='ar' ? c.label.ar : c.label.en;
      return '<option value="'+c.btu+'">'+lbl+'</option>';
    }).join('');
  }
  projState.selBtu = getDefaultSystemCapacity(projState.sysType);
  projState.qtyAuto = false;
  projState.autoReason = buildAutoQtyReason('manual');
  recalcCentralProjectSystem();
}

function getProjectRequiredLoadBtu(){
  var total = 0;
  for(var i=0;i<hist.length;i++){
    total += getQuoteRequiredBtu(i);
  }
  return total;
}
function getProjectRequiredLoadCfm(){
  var total = 0;
  for(var i=0;i<hist.length;i++){
    var roomCfm = parseInt((hist[i]||{}).cfm, 10) || 0;
    total += roomCfm * getRecordRoomCount(i);
  }
  return total;
}
function getProjTotalBtu(){
  return getProjectRequiredLoadBtu();
}
function getProjTotalCfm(){
  return getProjectRequiredLoadCfm();
}
function getProjTotalTr(){
  return getProjectRequiredLoadBtu()/12000;
}
function getIndependentAssignedRoomIndices(){
  var indices = [];
  ensureAllRoomRecordIds();
  for(var i=0;i<hist.length;i++){
    if(getRoomAssignment(i).mode === 'independent') indices.push(i);
  }
  return indices;
}
function getAssignedZoneEquipmentBtu(){
  return hvacZones.reduce(function(sum, zone){
    return sum + getZoneSelectedBtu(zone);
  }, 0);
}
function getAssignedZoneEquipmentCfm(){
  return hvacZones.reduce(function(sum, zone){
    return sum + getZoneSelectedCfm(zone);
  }, 0);
}
function hasProjectCentralAssignments(){
  return getProjectAssignedRoomIndices().length > 0;
}
function getProjectCentralSelectedBtu(){
  if(!isProjectHvacMode()) return 0;
  ensureProjectSystems();
  if(projectSystems.length){
    return getProjectSystemsSelectedBtu();
  }
  return 0;
}
function getProjectCentralSelectedTr(){
  return getProjectCentralSelectedBtu() / 12000;
}
function getProjectCentralSelectedCfm(){
  ensureProjectSystems();
  if(projectSystems.length && isProjectHvacMode()){
    return getProjectSystemsSelectedCfm();
  }
  return 0;
}
function getRoomModeSelectedEquipmentSummary(){
  var totalBtu = 0;
  var totalCfm = 0;
  var unitCount = 0;
  for(var i=0;i<hist.length;i++){
    var state = getRoomSystemState(i);
    if(!state) continue;
    if((state.systems || []).length){
      totalBtu += Number(state.selectedCapacityBtu || 0);
      totalCfm += Number(state.selectedSystemCfm || 0);
      unitCount += state.systems.reduce(function(sum, system){
        return sum + Math.max(1, parseInt(system.qty,10) || 1);
      }, 0);
      continue;
    }
    var legacyBtu = (parseInt(getSelBtu(i),10)||0) * Math.max(1, parseInt(getQty(i),10)||1);
    if(legacyBtu > 0){
      totalBtu += legacyBtu;
      totalCfm += (legacyBtu / 12000) * getCurrentCfmPerTr();
      unitCount += Math.max(1, parseInt(getQty(i),10)||1);
    }
  }
  return {
    btu: totalBtu,
    tr: totalBtu / 12000,
    cfm: totalCfm,
    unitCount: unitCount
  };
}
function getProjectModeSelectedEquipmentSummary(){
  ensureProjectSystems();
  var selectedBtu = getProjectCentralSelectedBtu();
  var selectedTr = getProjectCentralSelectedTr();
  var selectedCfm = getProjectCentralSelectedCfm();
  var unitCount = ensureProjectSystems().reduce(function(sum, system){
    return sum + Math.max(1, parseInt(system.qty,10) || 1);
  }, 0);
  return {
    btu: selectedBtu,
    tr: selectedTr,
    cfm: selectedCfm,
    unitCount: unitCount
  };
}
function getActiveSelectedEquipmentSummary(){
  return quoteMode === 'proj'
    ? getProjectModeSelectedEquipmentSummary()
    : getRoomModeSelectedEquipmentSummary();
}
function getSelectedProjectEquipmentBtu(){
  return getActiveSelectedEquipmentSummary().btu;
}
function getSelectedProjectEquipmentTr(){
  return getActiveSelectedEquipmentSummary().tr;
}
function getSelectedProjectEquipmentCfm(){
  return getActiveSelectedEquipmentSummary().cfm;
}
function getProjTotalMkt(){
  var t=0; for(var i=0;i<hist.length;i++) t+=parseInt(hist[i].mkt)||0; return t;
}

function renderProjBlock(){
  if(!isProjectHvacMode()) return;
  var isAr = lang==='ar';
  ensureProjectSystems();
  syncLegacyProjectStateFromSystems();

  // Totals
  var totalBtu = getProjTotalBtu();
  var totalCfm = getProjTotalCfm();
  var totalTr  = totalBtu / 12000;
  var setV = function(id,v){ var el=G(id); if(el) el.textContent=v; };

  // Legacy single-unit controls remain for backward compatibility only.
  var sysTypeSel = G('proj-systype');
  if(sysTypeSel && !sysTypeSel.options.length){
    var UT_KEYS_PROJ = ['split','floor','ducted','cassette','package','vrf','chiller_air','chiller_water','fcu','ahu','window'];
    sysTypeSel.innerHTML = UT_KEYS_PROJ.map(function(k){
      return '<option value="'+k+'"'+(projState.sysType===k?' selected':'')+'>'+utLabel(k)+'</option>';
    }).join('');
  }
  var curUT = projState.sysType || ((sysTypeSel && sysTypeSel.value) || 'split');
  projState.sysType = curUT;
  if(sysTypeSel && sysTypeSel.value !== curUT) sysTypeSel.value = curUT;

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
    }
    if(!projState.selBtu && cat2.length){
      projState.selBtu = parseInt(cat2[0].btu,10) || 0;
    }
    if(getProjectQtyAuto()){
      syncProjectRecommendation({unitType:curUT,keepSelectedCapacity:true});
    }
    capSel.value = projState.selBtu;
    if(!capSel.value && cat2.length){
      capSel.selectedIndex = 0;
      projState.selBtu = parseInt(cat2[0].btu,10) || 0;
      capSel.value = projState.selBtu;
    }
  }

  // Qty / UP
  var qtyEl = G('proj-qty'), upEl = G('proj-up');
  projState.qty = Math.max(1, parseInt(projState.qty,10) || 1);
  projState.up  = parseFloat((upEl||{value:projState.up || '0'}).value)||0;
  if(getProjectQtyAuto()){
    syncProjectRecommendation({unitType:curUT,keepSelectedCapacity:true});
    projState.up  = parseFloat((upEl||{value:'0'}).value)||0;
  } else {
    projState.autoReason = buildAutoQtyReason('manual');
  }
  if(qtyEl){
    qtyEl.value = projState.qty;
    qtyEl.readOnly = false;
  }

  var configRow = document.querySelector('#proj-block .proj-config-row');
  if(configRow) configRow.style.display = 'none';
  var upGroup = G('proj-up-group');
  if(upGroup && upGroup.parentNode) upGroup.parentNode.style.display = 'none';

  var systemsSlot = G('proj-systems-editor-slot');
  if(!systemsSlot){
    systemsSlot = document.createElement('div');
    systemsSlot.id = 'proj-systems-editor-slot';
    var validationSlot = G('proj-validation-slot');
    if(validationSlot && validationSlot.parentNode){
      validationSlot.parentNode.insertBefore(systemsSlot, validationSlot.nextSibling);
    } else {
      G('proj-block').appendChild(systemsSlot);
    }
  }
  systemsSlot.innerHTML = renderProjectSystemsEditor();

  var scenarioSlot = G('proj-design-scenarios-slot');
  if(!scenarioSlot){
    scenarioSlot = document.createElement('div');
    scenarioSlot.id = 'proj-design-scenarios-slot';
    if(systemsSlot && systemsSlot.parentNode){
      systemsSlot.parentNode.insertBefore(scenarioSlot, systemsSlot.nextSibling);
    }
  }
  scenarioSlot.innerHTML = renderHvacDesignScenariosPanel();

  var summarySections = G('proj-summary-sections');
  if(summarySections){
    summarySections.innerHTML = getProjectSummarySectionsHtml(isAr);
  }
  var projValidationSlot = G('proj-validation-slot');
  if(projValidationSlot){
    var projectValidation = getProjectEngineeringValidation();
    projValidationSlot.innerHTML =
      renderEngineeringValidationPanel(isAr ? 'التحقق الهندسي' : 'Engineering Validation', projectValidation.items, projectValidation.notes);
  }

  var projQtyAutoTools = G('proj-qty-auto-tools');
  if(projQtyAutoTools){
    projQtyAutoTools.innerHTML = '';
    projQtyAutoTools.style.display = 'none';
  }

  var projQtyMinus = G('proj-qty-minus');
  var projQtyPlus = G('proj-qty-plus');
  if(projQtyMinus) projQtyMinus.disabled = false;
  if(projQtyPlus) projQtyPlus.disabled = false;

  // ── DUCT SIZING ─────────────────────────────────────────────────
  var ductBlock = G('proj-duct-block');
  if(ductBlock){
    if(ensureProjectSystems().length !== 1){
      ductBlock.style.display='none';
      var qWarnEl = G('duct-q-warn'); if(qWarnEl) qWarnEl.style.display='none';
      var qInfoEl = G('duct-q-info'); if(qInfoEl) qInfoEl.innerHTML='';
      var supVal = G('duct-sup-val'); if(supVal) supVal.textContent = '—';
      var retVal = G('duct-ret-val'); if(retVal) retVal.textContent = '—';
    } else if(isDucted(curUT) && (totalCfm > 0 || projState.selBtu > 0)){
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
      var _unitCfmResolved = getProjDuctCfm(curUT, projState.selBtu, projState.qty, 0, _cfmPerTr);
      var unitCFM = _unitCfmResolved && _unitCfmResolved.source !== 'calc' ? _unitCfmResolved.cfm : 0;
      var _isCfmBased = !!(_unitCfmResolved && _unitCfmResolved.source === 'unit');
      var _qSelSrcAr = '';
      var _qSelSrcEn = '';
      if(_unitCfmResolved && _unitCfmResolved.source === 'unit'){
        _qSelSrcAr = 'CFM الوحدة × ' + projState.qty + ' وحدة';
        _qSelSrcEn = 'Unit CFM × ' + projState.qty + ' unit(s)';
      } else if(_unitCfmResolved && _unitCfmResolved.source === 'tr'){
        _qSelSrcAr = (projState.selBtu / 12000).toFixed(1) + ' TR × ' + _cfmPerTr + ' × ' + projState.qty;
        _qSelSrcEn = (projState.selBtu / 12000).toFixed(1) + ' TR × ' + _cfmPerTr + ' × ' + projState.qty;
      }

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
      var _airflowThresholds = getEngineeringValidationThresholds();
      var _qInfoEl = G('duct-q-info');
      if(_qInfoEl){
        var _cfmDiff = unitCFM > 0 ? ((unitCFM - requiredCFM) / requiredCFM * 100) : 0;
        var _cfmDiffSign = _cfmDiff >= 0 ? '+' : '';
        var _cfmMatchColor = unitCFM <= 0 ? 'var(--tm)'
          : (_cfmDiff < -_airflowThresholds.MATCH_MAX_OVERSIZE_PCT ? '#ef4444' : (_cfmDiff > _airflowThresholds.GENERAL_OVERSIZE_HIGH_PCT ? '#f59e0b' : '#34d399'));
        var _cfmMatchIcon = unitCFM <= 0 ? '' : (_cfmDiff < -_airflowThresholds.MATCH_MAX_OVERSIZE_PCT ? '⚠ ' : (_cfmDiff > _airflowThresholds.GENERAL_OVERSIZE_HIGH_PCT ? '⚠ ' : '✅ '));
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
        if(_diffPct2 < -_airflowThresholds.MATCH_MAX_OVERSIZE_PCT){
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
        } else if(_diffPct2 > _airflowThresholds.GENERAL_OVERSIZE_HIGH_PCT){
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
      var supDuct = calcDuctSize(Q_design, vSup, 'sup');
      var retDuct = calcDuctSize(Q_design, vRet, 'ret'); // Return uses same Q_design but its own velocity
      var _sd = supDuct ? (supDuct.std||supDuct.calc) : null;
      var _rd = retDuct ? (retDuct.std||retDuct.calc) : null;
      // Cache structured duct data for Advanced Mode (avoids fragile DOM text parsing)
      window._lastDuctSizing = {
        supCfm: Q_design, retCfm: Q_design,
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
  var roomTotals = getRoomModeQuoteTotals();
  var totalQty = roomTotals.totalQty;
  var subtotal = roomTotals.subtotal;
  if(quoteMode === 'proj'){
    var drafts = getProjectQuotationDrafts();
    subtotal = drafts.reduce(function(sum, draft){ return sum + getQuotationDraftTotals(draft).subtotal; }, 0);
    totalQty = drafts.reduce(function(sum, draft){
      return sum + ((draft.lines || []).filter(function(line){ return line && line.key === 'equipment'; })[0] || { quantity:0 }).quantity;
    }, 0);
  }
  var ip=parseInt((G('qs-inst')||{value:'10'}).value)||10;
  var instAmt=quoteMode === 'proj' ? 0 : subtotal*ip/100;
  var discount = quoteMode === 'proj' ? getProjectQuotationDrafts().reduce(function(sum, draft){ return sum + getQuotationDraftTotals(draft).discount; }, 0) : 0;
  var vatBase=Math.max(0, subtotal+instAmt-discount);
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
  var draftsForPdf = getProjectQuotationDrafts();
  if(draftsForPdf.length){
    var pdfRows = '';
    var pdfSubtotal = 0;
    var pdfDiscount = 0;
    draftsForPdf.forEach(function(draft, draftIndex){
      var snap = draft.snapshot || {};
      (draft.lines || []).forEach(function(line, lineIndex){
        var label = c.isAr ? (line.labelAr || line.labelEn) : (line.labelEn || line.labelAr);
        var total = getQuotationLineTotal(line);
        pdfSubtotal += total;
        pdfRows += '<tr style="background:'+(lineIndex%2===0?'#ffffff':'#f8fafc')+'">'+
          '<td style="color:#64748b">'+(draftIndex+1)+'.'+(lineIndex+1)+'</td>'+
          '<td class="td-name">'+esc(label)+(line.key === 'equipment' ? '<div style="font-size:10px;color:#0ea5e9;margin-top:3px">'+esc([snap.manufacturer, snap.model].filter(Boolean).join(' · '))+'</div>' : '')+'</td>'+
          '<td>'+Number(line.quantity || 0).toLocaleString()+'</td>'+
          '<td>'+c.cur+' '+money(line.unitPrice || 0)+'</td>'+
          '<td style="color:#059669;font-weight:700">'+c.cur+' '+money(total)+'</td>'+
        '</tr>';
      });
      pdfDiscount += Number(draft.discount || 0) || 0;
    });
    var pdfVatBase = Math.max(0, pdfSubtotal - pdfDiscount);
    var pdfVat = vatOn ? pdfVatBase * 0.15 : 0;
    var pdfGrand = pdfVatBase + pdfVat;
    var firstSnap = (draftsForPdf[0] && draftsForPdf[0].snapshot) || {};
    var thPdf = c.isAr?'background:#0f172a;color:#fff;padding:9px 8px;font-weight:700;text-align:right;padding-right:12px;':'background:#0f172a;color:#fff;padding:9px 8px;font-weight:700;text-align:left;padding-left:12px;';
    var thCPdf='background:#0f172a;color:#fff;padding:9px 8px;font-weight:700;text-align:center;';
    return '<div class="inv-page" id="pdf-page1">'+
      '<div class="inv-header">'+
        '<div class="inv-brand"><div class="inv-brand-icon">AC</div><div><div class="inv-brand-name">AirCalc Pro</div><div class="inv-brand-sub">HVAC Engineering Suite</div></div></div>'+
        '<div style="text-align:'+(c.isAr?'left':'right')+'"><div style="font-size:18px;font-weight:700;color:#0f172a">'+(c.isAr?'عرض سعر':'Quotation')+'</div><div style="font-size:13px;color:#64748b;margin-top:3px"># '+c.qno+'</div></div>'+
      '</div>'+
      '<div class="inv-meta-grid">'+
        '<div class="inv-meta-item"><div class="inv-meta-lbl">'+(c.isAr?'المشروع':'Project')+'</div><div class="inv-meta-val">'+esc(c.proj)+'</div></div>'+
        '<div class="inv-meta-item"><div class="inv-meta-lbl">'+(c.isAr?'الشركة':'Company')+'</div><div class="inv-meta-val">'+esc(firstSnap.manufacturer || '—')+'</div></div>'+
        '<div class="inv-meta-item"><div class="inv-meta-lbl">'+(c.isAr?'الموديل':'Model')+'</div><div class="inv-meta-val">'+esc(firstSnap.model || '—')+'</div></div>'+
        '<div class="inv-meta-item"><div class="inv-meta-lbl">'+(c.isAr?'السعة':'Capacity')+'</div><div class="inv-meta-val">'+Number(firstSnap.actualCapacityBtuH || 0).toLocaleString()+' BTU/h</div></div>'+
      '</div>'+
      '<div class="page-title">'+(c.isAr?'عرض السعر التجاري':'Commercial Quotation')+'<span class="page-badge client">'+(c.isAr?'المعدة المختارة':'Selected Equipment')+'</span></div>'+
      '<table><thead><tr>'+
        '<th style="'+thCPdf+'">#</th>'+
        '<th style="'+thPdf+'">'+(c.isAr?'البند':'Item')+'</th>'+
        '<th style="'+thCPdf+'">'+(c.isAr?'الكمية':'Qty')+'</th>'+
        '<th style="'+thCPdf+'">'+(c.isAr?'سعر الوحدة':'Unit Price')+'</th>'+
        '<th style="'+thCPdf+'">'+(c.isAr?'الإجمالي':'Total')+'</th>'+
      '</tr></thead><tbody>'+pdfRows+'</tbody></table>'+
      '<div class="totals-box">'+
        '<div class="tot-row"><span class="tot-lbl">Equipment Cost</span><span class="tot-val">'+c.cur+' '+money(pdfSubtotal)+'</span></div>'+
        '<div class="tot-row"><span class="tot-lbl">Discount</span><span class="tot-val">'+c.cur+' '+money(pdfDiscount)+'</span></div>'+
        (vatOn ? '<div class="tot-row"><span class="tot-lbl">VAT 15%</span><span class="tot-val">'+c.cur+' '+money(pdfVat)+'</span></div>' : '')+
        '<div class="tot-row"><span class="tot-lbl">Grand Total</span><span class="tot-val" style="color:#0ea5e9;font-size:15px">'+c.cur+' '+money(pdfGrand)+'</span></div>'+
      '</div>'+
      (c.notes ? '<div style="margin-bottom:14px;padding:10px 14px;background:#f8fafc;border-radius:6px;border:1px solid #e2e8f0;font-size:12px;color:#475569">'+esc(c.notes)+'</div>' : '')+
      '<div class="footer">AirCalc Pro — HVAC Engineering Suite © '+new Date().getFullYear()+'</div>'+
    '</div>';
  }
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
    var _bUnitCfm2=getProjectDuctCfmFromSelection(curUT, projState.selBtu, projState.qty, _bCfmPerTr2);
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
    var _p2UnitCFM2 = getProjectDuctCfmFromSelection(curUT, projState.selBtu, projState.qty, _p2CfmPerTr);
    var _p2Cfm = (_p2Basis2==='unit' && _p2UnitCFM2>0) ? _p2UnitCFM2 : _p2RequiredCFM;
    // unitCFM for display comparison
    var _p2CatD = getCatalog(curUT);
    var _p2SelEntry = null;
    for(var _p2ci=0; _p2ci<_p2CatD.length; _p2ci++){
      if(_p2CatD[_p2ci].btu === projState.selBtu){ _p2SelEntry = _p2CatD[_p2ci]; break; }
    }
    var _p2UnitCFM = getProjectDuctCfmFromSelection(curUT, projState.selBtu, projState.qty, _p2CfmPerTr);
    var _p2Basis = _p2Basis2; // follows UI toggle
    var _p2BasisLbl = c.isAr
      ? (_p2Basis==='unit' ? 'حسب الوحدة — Q الوحدة' : 'حسب الاحتياج — Q المطلوب')
      : (_p2Basis==='unit' ? 'Unit CFM' : 'Required CFM (Project Load)');
    var _p2CfmSrcLbl = c.isAr
      ? (_p2Basis==='unit' ? 'CFM الوحدة المختارة' : 'إجمالي CFM المطلوب')
      : (_p2Basis==='unit' ? 'Selected Unit CFM' : 'Required Total CFM');
    // BTU Capacity status (separate from airflow)
    var _selBtu2 = projState.selBtu * Math.max(1,projState.qty);
    var _projCapStatus = getProjectCapacityStatus(totalBtu2, _selBtu2);
    var _capStatusAr = _projCapStatus.label + (_projCapStatus.key!=='no_system_selected' ? ' ' + _projCapStatus.percentText : '');
    var _capStatusEn = _projCapStatus.label + (_projCapStatus.key!=='no_system_selected' ? ' ' + _projCapStatus.percentText : '');
    var _capColor = _projCapStatus.key==='matched' ? '#059669' : (_projCapStatus.key==='undersized' ? '#d97706' : (_projCapStatus.key==='oversized' ? '#6b7280' : '#64748b'));
    // Airflow (CFM) status — separate comparison
    var _p2Thresholds = getEngineeringValidationThresholds();
    var _cfmDeltaPdf = _p2UnitCFM>0 && _p2RequiredCFM>0 ? ((_p2UnitCFM-_p2RequiredCFM)/_p2RequiredCFM*100) : 0;
    var _cfmStatusAr, _cfmStatusEn, _cfmStatusColor;
    if(_p2UnitCFM <= 0){ _cfmStatusAr='—'; _cfmStatusEn='—'; _cfmStatusColor='#64748b'; }
    else if(_cfmDeltaPdf < -_p2Thresholds.MATCH_MAX_OVERSIZE_PCT){ _cfmStatusAr='⚠ تنبيه تدفق الهواء '+_cfmDeltaPdf.toFixed(1)+'%'; _cfmStatusEn='⚠ Airflow Warning '+_cfmDeltaPdf.toFixed(1)+'%'; _cfmStatusColor='#dc2626'; }
    else if(_cfmDeltaPdf > _p2Thresholds.GENERAL_OVERSIZE_HIGH_PCT){ _cfmStatusAr='تدفق زائد +'+_cfmDeltaPdf.toFixed(1)+'%'; _cfmStatusEn='Excess Airflow +'+_cfmDeltaPdf.toFixed(1)+'%'; _cfmStatusColor='#d97706'; }
    else { _cfmStatusAr='✅ تدفق مناسب'; _cfmStatusEn='✅ Airflow OK'; _cfmStatusColor='#166534'; }

    // Duct calculations
    var supD=calcDuctSize(_p2Cfm>0?_p2Cfm:1,vSup,'sup');
    var retD=calcDuctSize(_p2Cfm>0?_p2Cfm:1,vRet,'ret'); // Return uses same Q_design with own velocity
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

(function(){
  var _origExportHAP = exportHAP;
  exportHAP = function(){
    if (!window.AppPlan || !window.AppPlan.requireFeature('exportHAP')) return;
    _origExportHAP();
  };
  window.exportHAP = exportHAP;
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
  if(window.AppPlan && window.AppPlan.isOpenAccess && window.AppPlan.isOpenAccess()){
    var openAr=lang==='ar';
    var settingsPlan=G('plan-test-group');
    if(settingsPlan) settingsPlan.innerHTML='<h2>'+(openAr?'AirCalc Pro مجانية':'AirCalc Pro is free')+'</h2><p>'+(openAr?'جميع أدوات الحساب والتقرير والتصدير مجانية، ولا توجد خطط مدفوعة. الفرق بين الضيف والحساب المجاني هو عدد المشاريع المحفوظة وإمكانية المزامنة السحابية.':'All calculation, report and export tools are free, with no paid plans. A free account adds multiple saved projects and cloud sync.')+'</p><dl class="settings-access-summary"><div><dt>'+(openAr?'بدون حساب':'Without an account')+'</dt><dd>'+(openAr?'استخدم جميع الأدوات واحفظ مشروعًا واحدًا على هذا المتصفح مع إمكانية تحديثه.':'All tools + save and update one project')+'</dd></div><div><dt>'+(openAr?'بحساب مجاني':'With a free account')+'</dt><dd>'+(openAr?'استخدم جميع الأدوات واحفظ مشاريع متعددة، مع مزامنتها عند الاتصال بالإنترنت.':'Multiple saved projects and cloud sync')+'</dd></div></dl>';
    if(G('plan-section-title')) G('plan-section-title').textContent=openAr?'المميزات المجانية':'Free features';
    if(G('settings-section-title')) G('settings-section-title').textContent=openAr?'الإعدادات':'Settings';
    if(G('account-section-title')) G('account-section-title').textContent=openAr?'الحساب المجاني':'Free account';
    if(G('sl-lang')) G('sl-lang').textContent=openAr?'لغة المنصة':'Platform language';
    if(G('sl-sub')) G('sl-sub').textContent=openAr?'العربية / English':'English / العربية';
    ['header-plan-badge','plan-status-pill','ptg-live-badge','sl-upgrade-lbl','ptg-title'].forEach(function(id){var el=G(id);if(el)el.textContent=openAr?'مجانية':'Free';});
    ['sl-upgrade-sub','ptg-sub','ptg-desc'].forEach(function(id){var el=G(id);if(el)el.textContent=openAr?'المنصة متاحة دون اشتراك. تسجيل الدخول مطلوب فقط لخدمات الحساب والبيانات السحابية.':'No subscription required. Sign in only for account and cloud data services.';});
    ['ea-monthly-name','ea-monthly-price','ea-yearly-name','ea-yearly-price','ea-soon-monthly','ea-soon-yearly'].forEach(function(id){var el=G(id);if(el && el.parentElement)el.parentElement.hidden=true;});
    document.querySelectorAll('.desktop-pro-badge,.desktop-sidebar-pill').forEach(function(el){el.textContent=openAr?'متاح':'Open';});
    window.AppPlan.syncLockedUI(document);
    [['btn-pdf','exportPDF'],['btn-techpdf','techReport'],['btn-techpdf-panel','techReport'],['mode-btn-proj','projectMode']].forEach(function(pair){var el=G(pair[0]);if(el)el.classList.toggle('btn-locked',!window.AppPlan.hasAccess(pair[1]));});
    [['proj-duct-block','ductSizing'],['esp-block','espCalc']].forEach(function(pair){var el=G(pair[0]);if(el)el.classList.toggle('section-locked',!window.AppPlan.hasAccess(pair[1]));});
    return;
  }
  var earlyAccess = window.AppPlan && window.AppPlan.isEarlyAccess ? window.AppPlan.isEarlyAccess() : true;
  var isPro = window.AppPlan ? window.AppPlan.isPro() : false;
  var visiblePro = !!Array.prototype.slice.call(document.querySelectorAll('.desktop-pro-badge,.desktop-sidebar-pill,.pro-badge')).some(function(node){
    return String(node.textContent || '').toUpperCase().indexOf('PRO') >= 0;
  });
  var featuresOpen = isPro || earlyAccess || visiblePro;
  var isAr  = lang === 'ar';
  var guestText = isAr ? 'ضيف' : 'Guest';
  var proEarlyText = isAr ? 'وصول مبكر PRO' : 'PRO Early Access';
  var unlockText = isAr ? 'تفعيل PRO مجانًا' : 'Unlock PRO for Free';

  // Header badge
  var badge = G('header-plan-badge');
  if (badge) {
    badge.textContent = isPro ? 'PRO' : guestText;
    badge.className = isPro ? 'pro-badge' : 'free-badge';
  }

  // Settings status pill
  var pill = G('plan-status-pill');
  if (pill) {
    pill.textContent = isPro ? proEarlyText : guestText;
    pill.className = 'plan-status-pill ' + (isPro ? 'pro' : 'free');
  }

  // Settings upgrade row label
  var upgLbl = G('sl-upgrade-lbl');
  if (upgLbl) upgLbl.textContent = isPro ? proEarlyText : unlockText;

  var upgSub = G('sl-upgrade-sub');
  if (upgSub) upgSub.textContent = isPro
    ? (isAr ? 'تم تفعيل جميع مزايا PRO خلال الوصول المبكر.' : 'All PRO features are unlocked during Early Access.')
    : (isAr ? 'سجّل الدخول بالبريد الإلكتروني لتفعيل PRO مجانًا.' : 'Sign in with email to unlock PRO for free.');

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
  if (featuresOpen) {
    document.querySelectorAll('[data-pro-feature]').forEach(function(el){
      el.dataset.proLocked = 'false';
      el.classList.remove('pro-locked-trigger', 'pro-locked-nav', 'btn-locked');
      if(el.disabled && el.hasAttribute('data-pro-feature')) el.disabled = false;
    });
  } else if (window.AppPlan && typeof window.AppPlan.syncLockedUI === 'function') {
    window.AppPlan.syncLockedUI(document);
  }

  // Duct and ESP blocks — lock overlay when free
  var ductBlock = G('proj-duct-block');
  if (ductBlock) { ductBlock.classList.toggle('section-locked', !featuresOpen && !isProjectHvacMode()); }
  var espBlock  = G('esp-block');
  if (espBlock)  { espBlock.classList.toggle('section-locked',  !featuresOpen && !isProjectHvacMode()); }

  // ── Plan Status test card ────────────────────────────────────────
  // Live badge in header of test card
  var liveBadge = G('ptg-live-badge');
  if (liveBadge) {
    liveBadge.textContent = isPro ? proEarlyText : guestText;
    liveBadge.className = 'plan-status-pill ' + (isPro ? 'pro' : 'free');
  }

  // Title & sub
  var ptgTitle = G('ptg-title');
  if (ptgTitle) ptgTitle.textContent = isPro ? proEarlyText : unlockText;
  var ptgSub = G('ptg-sub');
  if (ptgSub) ptgSub.textContent = isPro
    ? (isAr ? 'ميزات PRO مفعلة لك خلال الوصول المبكر.' : 'PRO features are enabled for you during Early Access.')
    : (isAr ? 'سجّل الدخول للحصول على وصول مبكر PRO.' : 'Sign in to get PRO Early Access.');
  if (G('ea-monthly-name')) G('ea-monthly-name').textContent = isAr ? 'شهري' : 'Monthly';
  if (G('ea-monthly-price')) G('ea-monthly-price').textContent = isAr ? '19 ﷼ / شهر' : '19 ﷼ / month';
  if (G('ea-yearly-name')) G('ea-yearly-name').textContent = isAr ? 'سنوي' : 'Yearly';
  if (G('ea-yearly-price')) G('ea-yearly-price').textContent = isAr ? '149 ﷼ / سنة' : '149 ﷼ / year';
  if (G('ea-soon-monthly')) G('ea-soon-monthly').textContent = isAr ? 'قريبًا' : 'Coming Soon';
  if (G('ea-soon-yearly')) G('ea-soon-yearly').textContent = isAr ? 'قريبًا' : 'Coming Soon';

  // Active plan description
  var descEl = G('ptg-desc');
  if (descEl) {
    descEl.innerHTML =
      '<span style="color:var(--a);font-weight:700;">' +
      (isAr ? 'الحالة الحالية: ' : 'Current status: ') +
      '</span>' + (isPro ? proEarlyText : guestText) +
      ' &nbsp;·&nbsp; <span style="color:var(--g);">' +
      (isPro
        ? (isAr ? 'جميع مزايا PRO مفعلة أثناء الوصول المبكر.' : 'All PRO features are unlocked during Early Access.')
        : (isAr ? 'سجّل الدخول لتفعيل PRO مجانًا.' : 'Sign in to unlock PRO for free.')) +
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
      { key:'exportHAP',         ar:'تصدير HAP',           en:'HAP export' },
      { key:'techReport',        ar:'التقرير الفني',        en:'Tech Report' },
      { key:'saveQuotation',     ar:'حفظ عرض السعر',        en:'Save quotation' },
      { key:'projectMode',       ar:'وضع المشروع',          en:'Project mode' },
      { key:'projectDashboard',  ar:'لوحة المشاريع',        en:'Project dashboard' },
      { key:'ductSizing',        ar:'تصميم المجاري',        en:'Duct sizing' },
      { key:'espCalc',           ar:'حساب ESP',             en:'ESP calc' },
      { key:'unlimitedProjects', ar:'مشاريع غير محدودة',    en:'Unlimited projects' }
    ];
    var fa = {};
    features.forEach(function(f){ fa[f.key] = window.AppPlan ? window.AppPlan.hasAccess(f.key) : false; });
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
  sl('pp-yr-amt','149 ﷼',  '149 ﷼');
  sl('pp-yr-per','سنوياً',    'Yearly');
  sl('pp-yr-badge','قريبًا', 'Coming Soon');
  sl('pp-mo-amt','19 ﷼',   '19 ﷼');
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
    if (isProjectHvacMode()) {
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

function calcDuctSize(cfm, velocityFpm, side){
  var manual = side && projState && projState.ductDimensions && projState.ductDimensions[side];
  if(manual && cfm > 0 && velocityFpm > 0 && manual.w >= 150 && manual.h >= 150){
    var candidate = _makeDuctCandidate(manual.w, manual.h, cfm / velocityFpm * 92903.04, cfm, velocityFpm, 'manual');
    return {calc:candidate, std:candidate};
  }
  if(window.AirCalcEngineering && typeof window.AirCalcEngineering.calculateDuctSize === 'function'){
    var engineDuct = window.AirCalcEngineering.calculateDuctSize({
      cfm: cfm,
      velocityFpm: velocityFpm,
      standardSizes: DUCT_STD,
      minSideMm: 150,
      maxSideMm: 1800,
      maxAspectRatio: ASHRAE_RECT_MAX_RATIO,
      preferredHeightsMm: [150,200,250,300,350,400,450,500,600,700,800]
    });
    return engineDuct && engineDuct.ok === false ? null : engineDuct;
  }
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

// Both invoice HTML and quotation PDF call this final page builder.
var buildQuotationPageWithoutDuctSelection=buildPage1;
buildPage1=function(c){
  var html=buildQuotationPageWithoutDuctSelection(c);
  var summary=renderDuctAndFilterSummary(c.isAr);
  if(!summary)return html;
  var container=document.createElement('div');container.innerHTML=html;
  var page=container.querySelector('.inv-page');
  if(page){
    var section=document.createElement('div');section.innerHTML=summary;
    page.insertBefore(section,page.querySelector('.footer'));
  }
  return container.innerHTML;
};
