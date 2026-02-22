/* Air Calc Pro - Stable Build (Arabic/English, ASHRAE + Practical modes) */

let currentLang = 'ar';
let activeField = 'display';
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];

// ============================
// Rooms database (full / categorized)
// standard:
//   medical => ASHRAE 170 (ACH-driven CFM + sensible load estimate)
//   commercial/residential => practical KSA-style estimate using ACH + load factor
// ============================
const roomDatabase = [
  {
    key: "medical",
    name_ar: "المستشفيات (ASHRAE 170)",
    name_en: "Hospitals (ASHRAE 170)",
    standard_ar: "ASHRAE 170",
    standard_en: "ASHRAE 170",
    items: [
      { id: "or", ar: "غرفة عمليات (OR)", en: "Operating Room (OR)", ach: 20, pressure: "0", factor: 260 },
      { id: "hybrid_or", ar: "غرفة عمليات هجينة", en: "Hybrid OR", ach: 20, pressure: "0", factor: 260 },
      { id: "cath_lab", ar: "مختبر قسطرة", en: "Cath Lab", ach: 15, pressure: "0", factor: 300 },
      { id: "ir", ar: "الأشعة التداخلية", en: "Interventional Radiology", ach: 15, pressure: "0", factor: 300 },
      { id: "icu", ar: "العناية المركزة (ICU)", en: "ICU", ach: 6, pressure: "0", factor: 340 },
      { id: "nicu", ar: "عناية حديثي الولادة (NICU)", en: "NICU", ach: 6, pressure: "0", factor: 330 },
      { id: "picu", ar: "عناية مركزة أطفال (PICU)", en: "PICU", ach: 6, pressure: "0", factor: 340 },
      { id: "ccu", ar: "عناية قلب (CCU)", en: "CCU", ach: 6, pressure: "0", factor: 340 },
      { id: "aiir", ar: "عزل ضغط سالب (AII)", en: "Negative Pressure Isolation (AII)", ach: 12, pressure: "-", factor: 330 },
      { id: "pe", ar: "عزل ضغط موجب (PE)", en: "Protective Environment (PE)", ach: 12, pressure: "+", factor: 330 },
      { id: "er_triage", ar: "غرفة الطوارئ (ترياج)", en: "ER Triage", ach: 12, pressure: "0", factor: 320 },
      { id: "er_treat", ar: "غرفة علاج طوارئ", en: "ER Treatment Room", ach: 6, pressure: "0", factor: 330 },
      { id: "patient_room", ar: "غرفة تنويم مريض", en: "Patient Room", ach: 6, pressure: "0", factor: 340 },
      { id: "ldr", ar: "غرفة الولادة (LDR)", en: "Labor/Delivery (LDR)", ach: 15, pressure: "0", factor: 300 },
      { id: "nursery", ar: "حضانة مواليد", en: "Nursery", ach: 6, pressure: "0", factor: 340 },
      { id: "exam_room", ar: "غرفة فحص عامة", en: "Examination Room", ach: 6, pressure: "0", factor: 340 },
      { id: "procedure", ar: "غرفة إجراءات", en: "Procedure Room", ach: 12, pressure: "0", factor: 320 },
      { id: "endoscopy", ar: "غرفة المناظير", en: "Endoscopy Room", ach: 15, pressure: "0", factor: 300 },
      { id: "xray", ar: "الأشعة التشخيصية", en: "Diagnostic X-Ray", ach: 6, pressure: "0", factor: 420 },
      { id: "ct", ar: "غرفة CT", en: "CT Room", ach: 6, pressure: "0", factor: 450 },
      { id: "mri", ar: "غرفة MRI", en: "MRI Room", ach: 6, pressure: "0", factor: 500 },
      { id: "lab", ar: "مختبر عام", en: "General Laboratory", ach: 6, pressure: "0", factor: 380 },
      { id: "micro_lab", ar: "مختبر أحياء دقيقة", en: "Microbiology Lab", ach: 8, pressure: "0", factor: 390 },
      { id: "pharmacy", ar: "الصيدلية", en: "Pharmacy", ach: 4, pressure: "0", factor: 360 },
      { id: "cssd_clean", ar: "تعقيم مركزي - نظيف", en: "CSSD Clean", ach: 10, pressure: "+", factor: 330 },
      { id: "cssd_soiled", ar: "تعقيم مركزي - متسخ", en: "CSSD Soiled", ach: 10, pressure: "-", factor: 330 },
      { id: "sterile_storage", ar: "مستودع معقم", en: "Sterile Storage", ach: 4, pressure: "+", factor: 300 },
      { id: "dialysis", ar: "غسيل كلى", en: "Dialysis", ach: 6, pressure: "0", factor: 350 },
      { id: "toilet_med", ar: "دورة مياه (صحي)", en: "Medical Toilet", ach: 10, pressure: "-", factor: 280 }
    ]
  },
  {
    key: "commercial",
    name_ar: "التجاري",
    name_en: "Commercial",
    standard_ar: "Practical (Saudi)",
    standard_en: "Practical (Saudi)",
    items: [
      { id: "open_office", ar: "مكاتب مفتوحة", en: "Open Offices", ach: 4, factor: 420 },
      { id: "private_office", ar: "مكتب خاص", en: "Private Office", ach: 4, factor: 430 },
      { id: "meeting", ar: "غرفة اجتماعات", en: "Meeting Room", ach: 8, factor: 380 },
      { id: "reception", ar: "استقبال / لوبي", en: "Reception / Lobby", ach: 4, factor: 360 },
      { id: "retail", ar: "محل تجاري", en: "Retail Store", ach: 6, factor: 380 },
      { id: "restaurant", ar: "صالة مطعم", en: "Restaurant Dining", ach: 10, factor: 340 },
      { id: "comm_kitchen", ar: "مطبخ تجاري", en: "Commercial Kitchen", ach: 20, factor: 520 },
      { id: "gym", ar: "نادي رياضي", en: "Gym", ach: 8, factor: 320 },
      { id: "salon", ar: "صالون / حلاقة", en: "Salon / Barber", ach: 8, factor: 360 },
      { id: "clinic_wait", ar: "صالة انتظار عيادة", en: "Clinic Waiting", ach: 4, factor: 360 },
      { id: "auditorium", ar: "قاعة محاضرات", en: "Auditorium", ach: 8, factor: 340 },
      { id: "server_room", ar: "غرفة سيرفر", en: "Server Room", ach: 10, factor: 550 },
      { id: "pharmacy_shop", ar: "صيدلية (تجارية)", en: "Pharmacy Shop", ach: 4, factor: 370 },
      { id: "warehouse_small", ar: "مستودع صغير", en: "Small Warehouse", ach: 2, factor: 260 }
    ]
  },
  {
    key: "residential",
    name_ar: "السكني",
    name_en: "Residential",
    standard_ar: "Practical (Saudi)",
    standard_en: "Practical (Saudi)",
    items: [
      { id: "living", ar: "غرفة معيشة", en: "Living Room", ach: 4, factor: 350 },
      { id: "bedroom", ar: "غرفة نوم", en: "Bedroom", ach: 2, factor: 320 },
      { id: "majlis", ar: "مجلس ضيوف", en: "Majlis", ach: 5, factor: 390 },
      { id: "dining", ar: "غرفة طعام", en: "Dining Room", ach: 4, factor: 350 },
      { id: "kitchen", ar: "مطبخ منزلي", en: "Kitchen", ach: 6, factor: 430 },
      { id: "bathroom", ar: "دورة مياه", en: "Bathroom", ach: 10, factor: 280 },
      { id: "corridor", ar: "ممر", en: "Corridor", ach: 2, factor: 260 },
      { id: "laundry", ar: "غرفة غسيل", en: "Laundry", ach: 4, factor: 330 },
      { id: "home_office", ar: "مكتب منزلي", en: "Home Office", ach: 4, factor: 350 },
      { id: "store", ar: "مخزن", en: "Store", ach: 1, factor: 230 }
    ]
  }
];

// ============================
// Equipment database (with categories / tags)
// Shared + medical + commercial + residential
// Watt values are practical rated/typical values
// ============================
const equipmentCatalog = [
  // Shared
  { id: "pc", ar: "كمبيوتر مكتبي", en: "Desktop PC", watts: 250, tags: ["shared"] },
  { id: "laptop", ar: "لابتوب", en: "Laptop", watts: 90, tags: ["shared"] },
  { id: "monitor", ar: "شاشة", en: "Monitor", watts: 40, tags: ["shared"] },
  { id: "printer", ar: "طابعة", en: "Printer", watts: 600, tags: ["shared"] },
  { id: "fridge_small", ar: "ثلاجة صغيرة", en: "Small Fridge", watts: 180, tags: ["shared","commercial","residential"] },
  { id: "water_dispenser", ar: "مبرد ماء", en: "Water Dispenser", watts: 120, tags: ["shared","commercial"] },
  { id: "tv", ar: "شاشة تلفاز", en: "TV Screen", watts: 120, tags: ["shared","residential","commercial"] },

  // Medical
  { id: "anesthesia", ar: "جهاز تخدير", en: "Anesthesia Machine", watts: 1200, tags: ["medical"] },
  { id: "or_light", ar: "إضاءة عمليات", en: "OR Surgical Light", watts: 300, tags: ["medical"] },
  { id: "electrosurgical", ar: "جهاز كي جراحي", en: "Electrosurgical Unit", watts: 400, tags: ["medical"] },
  { id: "patient_monitor", ar: "مراقبة مريض", en: "Patient Monitor", watts: 120, tags: ["medical"] },
  { id: "ventilator", ar: "جهاز تنفس صناعي", en: "Ventilator", watts: 350, tags: ["medical"] },
  { id: "infusion_pump", ar: "مضخة محاليل", en: "Infusion Pump", watts: 50, tags: ["medical"] },
  { id: "defibrillator", ar: "جهاز صدمات قلبية", en: "Defibrillator", watts: 250, tags: ["medical"] },
  { id: "ultrasound", ar: "جهاز موجات فوق صوتية", en: "Ultrasound Unit", watts: 400, tags: ["medical"] },
  { id: "xray_machine", ar: "جهاز أشعة X-Ray", en: "X-Ray Unit", watts: 2500, tags: ["medical"] },
  { id: "ct_scanner", ar: "جهاز CT", en: "CT Scanner", watts: 6000, tags: ["medical"] },
  { id: "mri_system", ar: "جهاز MRI", en: "MRI System (avg)", watts: 8000, tags: ["medical"] },
  { id: "autoclave", ar: "أوتوكلاف تعقيم", en: "Autoclave", watts: 3000, tags: ["medical"] },
  { id: "lab_analyzer", ar: "جهاز تحليل مختبري", en: "Lab Analyzer", watts: 700, tags: ["medical"] },
  { id: "biosafety", ar: "خزانة أمان حيوي", en: "Biosafety Cabinet", watts: 450, tags: ["medical"] },
  { id: "med_fridge", ar: "ثلاجة أدوية/مختبر", en: "Medical/Lab Fridge", watts: 350, tags: ["medical"] },

  // Commercial
  { id: "pos", ar: "نقطة بيع POS", en: "POS Terminal", watts: 80, tags: ["commercial"] },
  { id: "display_sign", ar: "لوحة/شاشة عرض", en: "Display Sign", watts: 180, tags: ["commercial"] },
  { id: "coffee_machine", ar: "آلة قهوة", en: "Coffee Machine", watts: 1500, tags: ["commercial"] },
  { id: "blender", ar: "خلاط", en: "Blender", watts: 500, tags: ["commercial"] },
  { id: "freezer", ar: "فريزر", en: "Freezer", watts: 450, tags: ["commercial"] },
  { id: "oven", ar: "فرن تجاري", en: "Commercial Oven", watts: 3500, tags: ["commercial"] },
  { id: "grill", ar: "شواية كهربائية", en: "Electric Grill", watts: 2500, tags: ["commercial"] },
  { id: "hood", ar: "شفاط مطبخ", en: "Kitchen Hood Fan", watts: 500, tags: ["commercial"] },
  { id: "treadmill", ar: "جهاز سير", en: "Treadmill", watts: 900, tags: ["commercial"] },
  { id: "elliptical", ar: "جهاز إليبتيكال", en: "Elliptical", watts: 500, tags: ["commercial"] },

  // Residential
  { id: "home_tv", ar: "تلفاز منزلي", en: "Home TV", watts: 120, tags: ["residential"] },
  { id: "game_console", ar: "جهاز ألعاب", en: "Game Console", watts: 180, tags: ["residential"] },
  { id: "router", ar: "راوتر", en: "Router", watts: 15, tags: ["residential","shared"] },
  { id: "washing", ar: "غسالة", en: "Washing Machine", watts: 700, tags: ["residential"] },
  { id: "dryer", ar: "نشافة", en: "Dryer", watts: 2000, tags: ["residential"] },
  { id: "microwave", ar: "ميكروويف", en: "Microwave", watts: 1200, tags: ["residential"] },
  { id: "dishwasher", ar: "غسالة صحون", en: "Dishwasher", watts: 1300, tags: ["residential"] },
  { id: "electric_kettle", ar: "غلاية", en: "Electric Kettle", watts: 1500, tags: ["residential"] }
];

// state for equipment counts
let equipState = {}; // id -> count

// Market BTU sizes (common)
const marketBTUSizes = [9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000, 72000, 96000, 120000, 144000, 180000, 240000];

// ============================
// Init
// ============================
window.onload = () => {
  forceEnglishDigitsBehavior();
  buildRoomSelect();
  onRoomChange(); // also renders equipment + resets
  updateDisplayValues();
  updateHistoryUI();

  // Service worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
};

function forceEnglishDigitsBehavior() {
  // keep all numeric outputs in English numerals
  document.body.style.fontVariantNumeric = 'tabular-nums';
}

// ============================
// Helpers
// ============================
function toEnglishDigits(value) {
  if (value === null || value === undefined) return "";
  return String(value).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d));
}

function numFmt(n, decimals = 0) {
  const x = Number(n) || 0;
  return x.toLocaleString('en-US', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals
  });
}

function getSelectedRoom() {
  const sel = document.getElementById('room-select');
  const roomId = sel.value;
  for (const cat of roomDatabase) {
    const found = cat.items.find(i => i.id === roomId);
    if (found) return { room: found, category: cat };
  }
  return null;
}

function getRoomLabel(room) {
  return currentLang === 'ar' ? room.ar : room.en;
}

function getCategoryLabel(cat) {
  return currentLang === 'ar' ? cat.name_ar : cat.name_en;
}

function getStandardLabel(cat) {
  return currentLang === 'ar' ? cat.standard_ar : cat.standard_en;
}

function getRoomMode(cat) {
  return cat.key; // medical/commercial/residential
}

// ============================
// UI Build / Change handlers
// ============================
function buildRoomSelect() {
  const sel = document.getElementById('room-select');
  sel.innerHTML = '';

  roomDatabase.forEach(cat => {
    const group = document.createElement('optgroup');
    group.label = getCategoryLabel(cat);

    cat.items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = getRoomLabel(item);
      group.appendChild(opt);
    });

    sel.appendChild(group);
  });
}

function onRoomChange() {
  resetAllFields(false); // reset without clearing selected room
  renderEquipmentForSelectedRoom();
  updateMetaLine();
  calculateLoad(false); // live recalc
}

function updateMetaLine() {
  const data = getSelectedRoom();
  if (!data) return;
  const { room, category } = data;

  document.getElementById('meta-room-name').textContent = getRoomLabel(room);
  document.getElementById('meta-standard').textContent = getStandardLabel(category);
  document.getElementById('meta-ach').textContent = `ACH: ${numFmt(room.ach, 0)}`;

  document.getElementById('chip-standard').textContent = getStandardLabel(category);
  document.getElementById('chip-ach').textContent = `ACH: ${numFmt(room.ach, 0)}`;
}

function switchTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  btn.classList.add('active');
}

function toggleLanguage() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';
  const html = document.getElementById('html-tag');
  html.lang = currentLang;
  html.dir = currentLang === 'ar' ? 'rtl' : 'ltr';

  // Static text by data-ar/data-en
  document.querySelectorAll('[data-ar][data-en]').forEach(el => {
    el.textContent = el.getAttribute(currentLang === 'ar' ? 'data-ar' : 'data-en');
  });

  document.getElementById('lang-text').textContent = currentLang === 'ar' ? 'English' : 'العربية';

  // Rebuild dependent UI
  buildRoomSelect();
  updateMetaLine();
  renderEquipmentForSelectedRoom();
  updateHistoryUI();
  updateDisplayValues();
}

// ============================
// Input / keypad
// ============================
function focusField(field) {
  activeField = field;
  document.getElementById('display').classList.remove('active-field');
  document.getElementById('people-count').classList.remove('active-field');
  document.getElementById('equip-watts').classList.remove('active-field');

  if (field === 'display') document.getElementById('display').classList.add('active-field');
  if (field === 'people') document.getElementById('people-count').classList.add('active-field');
  if (field === 'equip') document.getElementById('equip-watts').classList.add('active-field');
}

function press(v) {
  const key = String(v);

  if (activeField === 'equip') {
    // equipment watts is managed by modal counts only
    openEquipModal();
    return;
  }

  let s = inputs[activeField] || "0";

  if (key === '.') {
    if (activeField !== 'display') return; // decimal only for volume
    if (s.includes('.')) return;
    s += '.';
  } else {
    if (s === "0") s = key;
    else s += key;
  }

  inputs[activeField] = toEnglishDigits(s);
  updateDisplayValues();
}

function deleteLast() {
  if (activeField === 'equip') {
    openEquipModal();
    return;
  }
  let s = String(inputs[activeField] || "0");
  s = s.slice(0, -1);
  if (!s || s === "-") s = "0";
  inputs[activeField] = s;
  updateDisplayValues();
}

function clearActiveField() {
  if (activeField === 'equip') {
    // clear equipment counts
    Object.keys(equipState).forEach(k => equipState[k] = 0);
    renderEquipmentForSelectedRoom();
    recalcEquipWatts();
    calculateLoad(false);
    return;
  }
  inputs[activeField] = "0";
  updateDisplayValues();
}

function updateDisplayValues() {
  document.getElementById('display').textContent = toEnglishDigits(inputs.display || "0");
  document.getElementById('people-count').value = toEnglishDigits(inputs.people || "0");
  document.getElementById('equip-watts').value = toEnglishDigits(inputs.equip || "0");
}

// ============================
// Equipment modal and filtering
// ============================
function equipmentAllowedForRoom(roomMode) {
  return equipmentCatalog.filter(eq => {
    const tags = eq.tags || [];
    if (tags.includes('shared')) return true;
    return tags.includes(roomMode);
  });
}

function renderEquipmentForSelectedRoom() {
  const data = getSelectedRoom();
  if (!data) return;
  const roomMode = getRoomMode(data.category);
  const list = equipmentAllowedForRoom(roomMode);

  // initialize state if missing
  list.forEach(item => {
    if (equipState[item.id] == null) equipState[item.id] = 0;
  });

  const box = document.getElementById('equip-checklist');
  box.innerHTML = list.map(item => {
    const count = equipState[item.id] || 0;
    const title = currentLang === 'ar' ? item.ar : item.en;
    return `
      <div class="equip-row">
        <div class="equip-info">
          <div class="equip-title">${title}</div>
          <div class="equip-sub">${numFmt(item.watts,0)} W</div>
        </div>
        <div class="equip-controls">
          <button class="counter-btn" onclick="changeEquipCount('${item.id}', -1)">-</button>
          <div class="counter-val">${numFmt(count,0)}</div>
          <button class="counter-btn" onclick="changeEquipCount('${item.id}', 1)">+</button>
        </div>
      </div>
    `;
  }).join('');

  recalcEquipWatts();
}

function changeEquipCount(id, delta) {
  if (equipState[id] == null) equipState[id] = 0;
  equipState[id] = Math.max(0, Number(equipState[id]) + delta);
  renderEquipmentForSelectedRoom(); // refresh counts
  calculateLoad(false); // live recalc
}

function recalcEquipWatts() {
  const data = getSelectedRoom();
  if (!data) return;
  const roomMode = getRoomMode(data.category);

  const allowed = equipmentAllowedForRoom(roomMode);
  const total = allowed.reduce((sum, item) => {
    const cnt = Number(equipState[item.id] || 0);
    return sum + (cnt * item.watts);
  }, 0);

  inputs.equip = String(Math.round(total));
  updateDisplayValues();
}

function openEquipModal() {
  focusField('equip');
  document.getElementById('equip-modal').style.display = 'block';
}

function closeEquipModal() {
  document.getElementById('equip-modal').style.display = 'none';
}

// ============================
// HVAC calculation engine
// ============================
function calculateLoad(save = false) {
  const data = getSelectedRoom();
  if (!data) return;

  const { room, category } = data;
  const roomMode = getRoomMode(category);

  const volM3 = parseFloat(toEnglishDigits(inputs.display)) || 0;
  const people = parseFloat(toEnglishDigits(inputs.people)) || 0;
  const equipW = parseFloat(toEnglishDigits(inputs.equip)) || 0;

  // Volume m3 -> ft3
  const volFt3 = volM3 * 35.3147;

  // CFM by ACH + people OA allowance
  // Medical: person allowance 20 CFM/person (conservative)
  // Commercial/Residential: 15 CFM/person practical
  const peopleCFM = roomMode === 'medical' ? 20 : 15;
  const cfmFromACH = (volFt3 * room.ach) / 60;
  const cfm = Math.round(cfmFromACH + (people * peopleCFM));

  // TR estimation
  // Medical: CFM sensible load basis + people + equipment (more conservative for critical spaces)
  // Commercial/Residential: Practical factor + people + equipment
  let btuPerHour = 0;

  if (roomMode === 'medical') {
    // improved practical-medical hybrid:
    // (CFM * room factor) + people sensible+latent approx + equip heat
    btuPerHour =
      (cfm * room.factor) +
      (people * 600) +
      (equipW * 3.412);
  } else {
    // practical Saudi-style estimate (factor-based) with ACH influence already reflected in cfm
    // base by room volume + people + equipment
    const baseVolumeBtu = volM3 * room.factor;
    const occupancyBtu = people * 600;
    const equipBtu = equipW * 3.412;
    // blend with ventilation impact using cfm*1.08*deltaT approx (deltaT 18F practical)
    const ventBtu = cfm * 1.08 * 18;
    btuPerHour = baseVolumeBtu + occupancyBtu + equipBtu + (0.35 * ventBtu);
  }

  // safety factor (small)
  const safetyFactor = roomMode === 'medical' ? 1.08 : 1.05;
  btuPerHour *= safetyFactor;

  const tr = btuPerHour / 12000;
  const marketBTU = getNearestMarketBTU(btuPerHour);

  // Duct size quick estimate (rectangular @ ~800 fpm, width 12")
  const ductWidthIn = 12;
  const ductHeightIn = calcDuctHeight(cfm, ductWidthIn);

  // Update UI
  document.getElementById('cfm-result').textContent = `CFM ${numFmt(cfm, 0)}`;
  document.getElementById('tr-result').textContent = `TR ${numFmt(tr, 2)}`;
  document.getElementById('btu-result').textContent = `BTU/h ${numFmt(Math.round(btuPerHour), 0)}`;
  document.getElementById('market-btu').textContent = `BTU ${numFmt(marketBTU, 0)}`;

  document.getElementById('chip-duct').textContent = `Duct: 12" x ${numFmt(ductHeightIn, 0)}`;
  document.getElementById('chip-ach').textContent = `ACH: ${numFmt(room.ach, 0)}`;
  document.getElementById('chip-standard').textContent = getStandardLabel(category);

  updateMetaLine();

  if (save) {
    const entry = {
      id: Date.now(),
      room: getRoomLabel(room),
      standard: getStandardLabel(category),
      ach: room.ach,
      volM3: volM3,
      people: people,
      equipW: equipW,
      cfm: cfm,
      tr: tr,
      btu: Math.round(btuPerHour),
      marketBTU: marketBTU,
      duct: `12" x ${ductHeightIn}`
    };
    calcHistory.unshift(entry);
    if (calcHistory.length > 100) calcHistory.pop();
    updateHistoryUI();
  }
}

function getNearestMarketBTU(btu) {
  const target = Number(btu) || 0;
  for (const size of marketBTUSizes) {
    if (target <= size) return size;
  }
  return marketBTUSizes[marketBTUSizes.length - 1];
}

function calcDuctHeight(cfm, widthIn) {
  const c = Number(cfm) || 0;
  const w = Number(widthIn) || 12;
  if (c <= 0 || w <= 0) return 0;
  // area in² = (CFM / velocity_fpm) * 144
  const areaIn2 = (c / 800) * 144;
  const h = Math.max(6, Math.round(areaIn2 / w));
  return h;
}

// ============================
// History
// ============================
function updateHistoryUI() {
  const box = document.getElementById('history-list');
  if (!calcHistory.length) {
    box.innerHTML = `<div class="history-empty">${currentLang === 'ar' ? 'لا يوجد حسابات محفوظة' : 'No saved calculations yet'}</div>`;
    return;
  }

  box.innerHTML = calcHistory.map(item => `
    <div class="history-item" onclick="loadHistoryItem(${item.id})">
      <div class="left">
        <div class="room">${escapeHtml(item.room)}</div>
        <div class="meta">
          ${escapeHtml(item.standard)} • ACH ${numFmt(item.ach,0)} • ${numFmt(item.volM3,0)} m³ • ${numFmt(item.people,0)} P • ${numFmt(item.equipW,0)} W
        </div>
      </div>
      <div class="right">
        <div class="tr">TR ${numFmt(item.tr,2)}</div>
        <div>CFM ${numFmt(item.cfm,0)}</div>
        <div>BTU ${numFmt(item.marketBTU,0)}</div>
        <div>${item.duct}</div>
      </div>
    </div>
  `).join('');
}

function loadHistoryItem(id) {
  const item = calcHistory.find(x => x.id === id);
  if (!item) return;

  // find room by label fallback impossible if language changed, so better by matching room text not reliable
  // we keep current room selected; just restore values
  inputs.display = String(item.volM3);
  inputs.people = String(item.people);

  // clear all equipment counts and set watts only (exact counts unknown)
  Object.keys(equipState).forEach(k => equipState[k] = 0);
  inputs.equip = String(item.equipW);

  updateDisplayValues();
  calculateLoad(false);
}

function clearHistory() {
  const ok = confirm(currentLang === 'ar' ? 'مسح سجل الحسابات؟' : 'Clear calculation history?');
  if (!ok) return;
  calcHistory = [];
  updateHistoryUI();
}

// ============================
// Reset / settings
// ============================
function resetAllFields(recalc = true) {
  inputs.display = "0";
  inputs.people = "0";
  inputs.equip = "0";

  // reset only visible room equipment counts
  Object.keys(equipState).forEach(k => equipState[k] = 0);

  updateDisplayValues();
  renderEquipmentForSelectedRoom();
  focusField('display');

  if (recalc) calculateLoad(false);
}

// ============================
// Export PDF
// ============================
function exportHistoryPDF() {
  if (!calcHistory.length) {
    alert(currentLang === 'ar' ? 'لا يوجد سجل للتصدير' : 'No history to export');
    return;
  }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

  doc.setFontSize(16);
  doc.text("Air Calc Pro - Calculation History", 40, 40);

  const rows = calcHistory.map((x, idx) => [
    String(idx + 1),
    x.room,
    x.standard,
    numFmt(x.volM3,0),
    numFmt(x.people,0),
    numFmt(x.equipW,0),
    numFmt(x.cfm,0),
    numFmt(x.tr,2),
    numFmt(x.marketBTU,0),
    x.duct
  ]);

  doc.autoTable({
    startY: 60,
    head: [["#", "Room", "Standard", "m3", "P", "W", "CFM", "TR", "BTU", "Duct"]],
    body: rows,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [20, 25, 35] }
  });

  doc.save("air-calc-history.pdf");
}

// ============================
// Assistant demo
// ============================
function assistantDemoReply() {
  const q = (document.getElementById('assistant-input').value || "").trim();
  const out = document.getElementById('assistant-reply');
  if (!q) {
    out.textContent = currentLang === 'ar' ? 'اكتب سؤال أولاً.' : 'Type a question first.';
    return;
  }

  const data = getSelectedRoom();
  const roomName = data ? getRoomLabel(data.room) : '-';

  out.textContent = currentLang === 'ar'
    ? `مساعد تجريبي: بناءً على الغرفة الحالية (${roomName})، يمكن لاحقًا اقتراح نوع المكيف والسعة المناسبة وربط الأسعار مباشرة من السوق عبر API.`
    : `Demo assistant: Based on the current room (${roomName}), we can later suggest AC type, required capacity, and live market prices via an API.`;
}

// ============================
// Utilities
// ============================
function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}