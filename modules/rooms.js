// AirCalc Pro - modules/rooms.js
// Owns room standard lookup and room equipment preset helpers.
// Exposes AppRooms while app.js keeps backward-compatible global wrappers.

(function () {
  'use strict';

  function _standards() {
    return typeof ROOM_STANDARDS !== 'undefined' ? ROOM_STANDARDS : {};
  }

  function _presets() {
    return typeof ROOM_EQUIPMENT_PRESETS !== 'undefined' ? ROOM_EQUIPMENT_PRESETS : {};
  }

  function _devices() {
    return typeof DEVS !== 'undefined' ? DEVS : [];
  }

  function _lang() {
    return typeof lang !== 'undefined' ? lang : 'ar';
  }

  function inferRoomStandardKey(room) {
    if (!room) return 'office';
    var rid = (room.id || '').toLowerCase();
    var en  = (room.en || '').toLowerCase();

    if (rid.indexOf('operating') >= 0 || en.indexOf('operating room') >= 0) return 'operating_room';
    if (rid.indexOf('procedure') >= 0 || en.indexOf('procedure') >= 0) return 'minor_procedure';
    if (rid.indexOf('cath') >= 0 || en.indexOf('cath') >= 0) return 'cath_lab';
    if (rid.indexOf('endoscopy') >= 0 || en.indexOf('endoscopy') >= 0) return 'endoscopy';

    if (rid.indexOf('icu') >= 0 || en.indexOf('icu') >= 0) return 'icu';
    if (rid.indexOf('nicu') >= 0 || en.indexOf('nicu') >= 0) return 'nicu';

    if (rid.indexOf('isolation') >= 0 || en.indexOf('isolation') >= 0) return 'isolation_room';
    if (rid.indexOf('protective') >= 0 || en.indexOf('protective') >= 0) return 'protective_environment';

    if (rid.indexOf('emergency') >= 0 && en.indexOf('treatment') >= 0) return 'emergency_treatment';
    if (rid.indexOf('emergency') >= 0 || en.indexOf('emergency') >= 0) return 'emergency_exam';

    if (rid.indexOf('patient') >= 0 || en.indexOf('patient') >= 0) return 'patient_room';
    if (rid.indexOf('exam') >= 0 || en.indexOf('exam') >= 0) return 'exam_room';
    if (rid.indexOf('treatment') >= 0 || en.indexOf('treatment') >= 0) return 'treatment_room';
    if (rid.indexOf('recovery') >= 0 || en.indexOf('recovery') >= 0) return 'recovery_room';

    if (rid.indexOf('lab') >= 0 || en.indexOf('laboratory') >= 0 || en.indexOf('lab') >= 0) return 'laboratory';
    if (rid.indexOf('pharmacy') >= 0 || en.indexOf('pharmacy') >= 0) return 'pharmacy_clean';
    if (rid.indexOf('sterile') >= 0 || en.indexOf('sterile') >= 0 || en.indexOf('cssd') >= 0) return 'sterile_processing';

    if (rid.indexOf('wait') >= 0 || en.indexOf('waiting') >= 0) return 'waiting_area';
    if (rid.indexOf('corridor') >= 0 || en.indexOf('corridor') >= 0) return 'corridor';
    return 'office';
  }

  function getRoomStandard(room) {
    var key = inferRoomStandardKey(room);
    return _standards()[key] || {
      category: 'unknown',
      roomType: room ? (room.en || room.ar || 'Room') : 'Room',
      ach: null,
      oa: null,
      exhaust: null,
      pressure: 'Neutral',
      notes: 'No standard linked'
    };
  }

  function getRecommendedEquipmentIds(room) {
    var key = inferRoomStandardKey(room);
    return _presets()[key] || [];
  }

  function normalizePreset(preset) {
    if (!preset || !Array.isArray(preset)) return null;
    return preset.map(function (item) {
      var id = typeof item === 'string' ? item : item.id;
      var qty = (item && typeof item === 'object' && item.qty) ? item.qty : 1;
      return { id: id, qty: qty };
    }).filter(function (x) { return !!x.id; });
  }

  function applyRoomEquipmentPreset(roomKey) {
    var preset = _presets()[roomKey];
    var next = normalizePreset(preset);
    if (!next) return;
    if (typeof devs !== 'undefined') devs = next;
  }

  function getEquipmentSummary() {
    var liveDevs = typeof devs !== 'undefined' ? devs : [];
    var devices = _devices();
    var isAr = _lang() === 'ar';
    var items = liveDevs.map(function (d) {
      var c = devices.filter(function (x) { return x.id === d.id; })[0];
      return c ? {
        id: d.id,
        name: (isAr ? c.ar : c.en),
        qty: d.qty || 1,
        watt: (c.w || 0) * (d.qty || 1),
        btu: Math.round((c.w || 0) * 3.412 * (d.qty || 1)),
        group: c.g || ''
      } : null;
    }).filter(Boolean);
    var totalBtu = items.reduce(function (s, x) { return s + (x.btu || 0); }, 0);
    var totalWatt = items.reduce(function (s, x) { return s + (x.watt || 0); }, 0);
    var text = items.map(function (x) { return x.name + '×' + x.qty; }).join(' | ');
    return { items: items, totalBtu: totalBtu, totalWatt: totalWatt, text: text };
  }

  function getEquipmentGroupLabel(g) {
    var map = {
      office: { ar: 'مكتبي', en: 'Office' },
      light: { ar: 'إنارة', en: 'Lighting' },
      home: { ar: 'منزلي', en: 'Domestic' },
      health: { ar: 'رعاية صحية', en: 'Healthcare' },
      medical: { ar: 'أجهزة طبية', en: 'Medical Equipment' },
      lab: { ar: 'أجهزة مختبر', en: 'Laboratory Equipment' },
      support: { ar: 'دعم سريري', en: 'Clinical Support' }
    };
    var row = map[g] || { ar: g, en: g };
    return _lang() === 'ar' ? row.ar : row.en;
  }

  function getPressureLabel(p) {
    if (_lang() === 'ar') {
      if (p === 'Positive') return 'موجب';
      if (p === 'Negative') return 'سالب';
      return 'محايد';
    }
    return p || 'Neutral';
  }

  function getCategoryLabel(cat) {
    if (_lang() === 'ar') {
      var map = {
        non_clinical: 'غير سريري',
        general_clinical: 'سريري عام',
        emergency: 'طوارئ',
        critical_care: 'عناية حرجة',
        isolation: 'عزل',
        procedure: 'إجراءات / عمليات',
        support_clinical: 'دعم سريري',
        unknown: 'غير محدد'
      };
      return map[cat] || 'غير محدد';
    }
    return cat || 'unknown';
  }

  window.AppRooms = {
    inferRoomStandardKey: inferRoomStandardKey,
    getRoomStandard: getRoomStandard,
    getRecommendedEquipmentIds: getRecommendedEquipmentIds,
    applyRoomEquipmentPreset: applyRoomEquipmentPreset,
    getEquipmentSummary: getEquipmentSummary,
    getEquipmentGroupLabel: getEquipmentGroupLabel,
    getPressureLabel: getPressureLabel,
    getCategoryLabel: getCategoryLabel,
    normalizePreset: normalizePreset
  };

  console.log('[AirCalc] AppRooms initialised');
})();
