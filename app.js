let currentLang = 'ar';
let activeField = 'display';
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];
let roomCatalog = null;
let currentRoomMeta = null;
let currentSector = 'common';

// ===============================
// 1) الأجهزة (فلترة ذكية حسب القطاع)
// ===============================
const equipmentCatalog = {
  common: [
    { id: 'pc', ar: '💻 كمبيوتر مكتبي', en: 'Desktop PC', watts: 250, count: 0 },
    { id: 'laptop', ar: '💻 لابتوب', en: 'Laptop', watts: 90, count: 0 },
    { id: 'monitor24', ar: '🖥️ شاشة 24"', en: '24" Monitor', watts: 35, count: 0 },
    { id: 'monitor32', ar: '🖥️ شاشة 32"', en: '32" Monitor', watts: 65, count: 0 },
    { id: 'tv', ar: '📺 شاشة عرض كبيرة', en: 'Large Display / TV', watts: 200, count: 0 },
    { id: 'printer', ar: '🖨️ طابعة مكتبية', en: 'Office Printer', watts: 120, count: 0 },
    { id: 'copier', ar: '🖨️ ماكينة تصوير', en: 'Copier', watts: 800, count: 0 },
    { id: 'router', ar: '📡 راوتر/سويتش', en: 'Router / Network Switch', watts: 40, count: 0 },
    { id: 'fridge_small', ar: '🧊 ثلاجة صغيرة', en: 'Small Fridge', watts: 180, count: 0 },
    { id: 'water_dispenser', ar: '💧 برادة ماء', en: 'Water Dispenser', watts: 120, count: 0 }
  ],

  hospital: [
    { id: 'patient_monitor', ar: '🩺 شاشة مراقبة مريض', en: 'Patient Monitor', watts: 120, count: 0 },
    { id: 'ventilator', ar: '🫁 جهاز تنفس صناعي', en: 'Ventilator', watts: 300, count: 0 },
    { id: 'infusion_pump', ar: '💉 مضخة محاليل', en: 'Infusion Pump', watts: 30, count: 0 },
    { id: 'syringe_pump', ar: '💉 مضخة حقن', en: 'Syringe Pump', watts: 20, count: 0 },
    { id: 'defibrillator', ar: '⚡ جهاز صدمات قلب', en: 'Defibrillator', watts: 250, count: 0 },
    { id: 'anesthesia_machine', ar: '😷 جهاز تخدير', en: 'Anesthesia Machine', watts: 500, count: 0 },
    { id: 'electrosurgical_unit', ar: '🔪 جهاز كي جراحي', en: 'Electrosurgical Unit', watts: 400, count: 0 },
    { id: 'surgical_light', ar: '💡 إضاءة جراحية (LED)', en: 'Surgical Light (LED)', watts: 160, count: 0 },
    { id: 'portable_xray', ar: '🩻 جهاز أشعة متنقل', en: 'Portable X-Ray', watts: 1500, count: 0 },
    { id: 'ultrasound_unit', ar: '📈 جهاز موجات فوق صوتية', en: 'Ultrasound Unit', watts: 300, count: 0 },
    { id: 'xray_console', ar: '🖥️ كونسول أشعة', en: 'X-Ray Console', watts: 500, count: 0 },
    { id: 'lab_analyzer', ar: '🧪 محلل مختبر', en: 'Lab Analyzer', watts: 700, count: 0 },
    { id: 'centrifuge', ar: '🧪 جهاز طرد مركزي', en: 'Centrifuge', watts: 400, count: 0 },
    { id: 'biosafety_cabinet', ar: '🧫 كابينة أمان حيوي', en: 'Biosafety Cabinet', watts: 800, count: 0 },
    { id: 'autoclave_small', ar: '♨️ أوتوكليف صغير', en: 'Small Autoclave', watts: 2000, count: 0 },
    { id: 'autoclave_large', ar: '♨️ أوتوكليف كبير', en: 'Large Autoclave', watts: 4500, count: 0 },
    { id: 'pharmacy_fridge', ar: '💊 ثلاجة أدوية/لقاحات', en: 'Pharmacy / Vaccine Fridge', watts: 300, count: 0 },
    { id: 'med_refrigerator', ar: '🧊 ثلاجة مختبر', en: 'Lab Refrigerator', watts: 450, count: 0 },
    { id: 'warmers', ar: '🍼 جهاز تدفئة أطفال', en: 'Infant Warmer', watts: 700, count: 0 },
    { id: 'dialysis_machine', ar: '🩸 جهاز غسيل كلى', en: 'Dialysis Machine', watts: 1500, count: 0 }
  ],

  commercial: [
    { id: 'pos', ar: '💳 جهاز كاشير POS', en: 'POS Terminal', watts: 60, count: 0 },
    { id: 'barcode', ar: '🔎 قارئ باركود', en: 'Barcode Scanner', watts: 10, count: 0 },
    { id: 'receipt_printer', ar: '🧾 طابعة فواتير', en: 'Receipt Printer', watts: 45, count: 0 },
    { id: 'display_fridge', ar: '🧊 ثلاجة عرض', en: 'Display Refrigerator', watts: 600, count: 0 },
    { id: 'freezer', ar: '🧊 فريزر تجاري', en: 'Commercial Freezer', watts: 900, count: 0 },
    { id: 'coffee_machine', ar: '☕ ماكينة قهوة', en: 'Coffee Machine', watts: 1500, count: 0 },
    { id: 'oven_small', ar: '🔥 فرن صغير', en: 'Small Oven', watts: 2500, count: 0 },
    { id: 'oven_large', ar: '🔥 فرن تجاري', en: 'Commercial Oven', watts: 5000, count: 0 },
    { id: 'grill', ar: '🍔 شواية', en: 'Grill', watts: 3500, count: 0 },
    { id: 'fryer', ar: '🍟 قلاية', en: 'Deep Fryer', watts: 3000, count: 0 },
    { id: 'dishwasher', ar: '🍽️ غسالة صحون تجارية', en: 'Commercial Dishwasher', watts: 1800, count: 0 },
    { id: 'treadmill', ar: '🏃 جهاز سير', en: 'Treadmill', watts: 900, count: 0 },
    { id: 'bike', ar: '🚴 دراجة رياضية', en: 'Exercise Bike', watts: 150, count: 0 },
    { id: 'elliptical', ar: '🏋️ جهاز إليبتكال', en: 'Elliptical Trainer', watts: 250, count: 0 },
    { id: 'speaker_amp', ar: '🔊 أمبليفاير صوت', en: 'Audio Amplifier', watts: 400, count: 0 }
  ],

  residential: [
    { id: 'tv_home', ar: '📺 تلفزيون منزلي', en: 'Home TV', watts: 120, count: 0 },
    { id: 'fridge_home', ar: '🧊 ثلاجة منزلية', en: 'Home Refrigerator', watts: 250, count: 0 },
    { id: 'deep_freezer_home', ar: '🧊 فريزر منزلي', en: 'Home Freezer', watts: 220, count: 0 },
    { id: 'washing_machine', ar: '🧺 غسالة ملابس', en: 'Washing Machine', watts: 600, count: 0 },
    { id: 'dryer', ar: '🧺 نشافة ملابس', en: 'Clothes Dryer', watts: 2500, count: 0 },
    { id: 'microwave', ar: '📡 مايكرويف', en: 'Microwave', watts: 1200, count: 0 },
    { id: 'electric_oven_home', ar: '🔥 فرن كهربائي', en: 'Electric Oven', watts: 2400, count: 0 },
    { id: 'dishwasher_home', ar: '🍽️ غسالة صحون', en: 'Dishwasher', watts: 1400, count: 0 },
    { id: 'water_heater', ar: '🚿 سخان ماء', en: 'Water Heater', watts: 2000, count: 0 },
    { id: 'vacuum', ar: '🧹 مكنسة كهربائية', en: 'Vacuum Cleaner', watts: 900, count: 0 },
    { id: 'gaming_console', ar: '🎮 جهاز ألعاب', en: 'Gaming Console', watts: 220, count: 0 },
    { id: 'desktop_home', ar: '💻 كمبيوتر منزلي', en: 'Home PC', watts: 250, count: 0 }
  ]
};

// ===============================
// 2) تشغيل التطبيق
// ===============================
window.onload = async () => {
  await loadRoomData();
  updateRoomSelect();
  detectCurrentSector();
  renderEquipChecklist();
  focusField('display');
  updateDisplayValues();
  calculateLoad(false);

  const modal = document.getElementById('equip-modal');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target.id === 'equip-modal') closeEquipModal();
    });
  }
};

// ===============================
// 3) تحميل data.json
// ===============================
async function loadRoomData() {
  try {
    const resp = await fetch(`./data.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const text = await resp.text();
    const cleaned = text.replace(/\bNaN\b/g, 'null');
    roomCatalog = JSON.parse(cleaned);

    if (!roomCatalog || !Array.isArray(roomCatalog.categories)) {
      throw new Error('Invalid data.json structure');
    }
  } catch (e) {
    console.warn('data.json load failed', e);
    roomCatalog = {
      categories: [
        {
          name_ar: "المستشفيات (ASHRAE 170)",
          name_en: "Hospitals (ASHRAE 170)",
          items: [
            { id: "h1", ar: "غرفة عمليات (OR)", en: "Operating Room (OR)", ach: 20, med: true, factor: 280, pressure: "P", temp_c: "20-23", rh: "30-60", oa_ach: 4 },
            { id: "h3", ar: "عزل ضغط سالب (AII)", en: "Negative Pressure (AII)", ach: 12, med: true, factor: 350, pressure: "N", temp_c: "21-24", rh: "30-60", oa_ach: 2 }
          ]
        },
        {
          name_ar: "التجاري",
          name_en: "Commercial",
          items: [
            { id: "c1", ar: "مكاتب مفتوحة", en: "Open Offices", ach: 4, med: false, factor: 400 }
          ]
        },
        {
          name_ar: "السكني",
          name_en: "Residential",
          items: [
            { id: "r1", ar: "غرفة معيشة", en: "Living Room", ach: 4, med: false, factor: 330 }
          ]
        }
      ]
    };
  }
}

// ===============================
// 4) تعبئة الغرف
// ===============================
function updateRoomSelect() {
  const select = document.getElementById('room-select');
  if (!select || !roomCatalog) return;

  select.innerHTML = '';

  roomCatalog.categories.forEach((cat) => {
    const group = document.createElement('optgroup');
    group.label = currentLang === 'ar' ? (cat.name_ar || cat.name_en) : (cat.name_en || cat.name_ar);

    (cat.items || []).forEach((room) => {
      const opt = document.createElement('option');
      opt.value = room.id;
      opt.textContent = currentLang === 'ar' ? (room.ar || room.en) : (room.en || room.ar);
      opt.dataset.med = room.med ? '1' : '0';
      group.appendChild(opt);
    });

    select.appendChild(group);
  });

  if (select.options.length > 0) select.selectedIndex = 0;
  detectCurrentSector();
}

function getSelectedRoom() {
  const select = document.getElementById('room-select');
  if (!select || !roomCatalog) return null;
  const id = select.value;

  for (const cat of roomCatalog.categories) {
    const found = (cat.items || []).find(i => i.id === id);
    if (found) return found;
  }
  return null;
}

function detectCurrentSector() {
  const room = getSelectedRoom();
  if (!room) {
    currentSector = 'common';
    return;
  }

  if (room.med === true) {
    currentSector = 'hospital';
    return;
  }

  const id = String(room.id || '').toLowerCase();
  if (id.startsWith('r')) currentSector = 'residential';
  else currentSector = 'commercial';
}

// ===============================
// 5) الحساب الرئيسي (TR + CFM)
// ===============================
function calculateLoad(save = false) {
  const vol = parseFloat(inputs.display) || 0;
  const people = parseInt(inputs.people) || 0;
  const watts = parseFloat(inputs.equip) || 0;

  const room = getSelectedRoom();
  if (!room) return;

  currentRoomMeta = room;
  detectCurrentSector();

  const ach = Number(room.ach) || 0;
  const factor = Number(room.factor) || getDefaultFactorBySector(currentSector);

  // CFM = ACH + أشخاص
  const cfmAch = ((vol * 35.3147) * ach) / 60;
  const cfmPeople = people * 15;
  const cfm = Math.round(cfmAch + cfmPeople);

  // حمل تقريبي
  const sensibleFromAir = cfm * factor;
  const peopleLoad = people * 450;
  const equipLoad = watts * 3.412;
  const totalBTU = sensibleFromAir + peopleLoad + equipLoad;
  const tr = (totalBTU / 12000).toFixed(2);

  setText('tr-result', `${tr} TR`);
  setText('cfm-result', `${formatNum(cfm)} CFM`);

  updateFieldHint(room);

  if (save) {
    const duct = calcDuctSizeQuick(cfm, 800, 12);
    calcHistory.push({
      id: Date.now(),
      room: currentLang === 'ar' ? (room.ar || room.en) : (room.en || room.ar),
      tr,
      cfm,
      duct
    });
    updateHistoryUI();
  }
}

function getDefaultFactorBySector(sector) {
  if (sector === 'hospital') return 350;
  if (sector === 'commercial') return 400;
  return 330;
}

function updateFieldHint(room) {
  const hint = document.getElementById('field-hint');
  if (!hint) return;

  const ach = room?.ach ?? '-';

  if (room?.med) {
    const p = room.pressure || '-';
    const t = room.temp_c || '-';
    const rh = room.rh || '-';
    hint.textContent = currentLang === 'ar'
      ? `حجم الغرفة (m³) | ACH: ${ach} | ضغط: ${p} | حرارة: ${t}°C | RH: ${rh}%`
      : `Room Volume (m³) | ACH: ${ach} | Pressure: ${p} | Temp: ${t}°C | RH: ${rh}%`;
  } else {
    hint.textContent = currentLang === 'ar'
      ? `حجم الغرفة (m³) | ACH: ${ach}`
      : `Room Volume (m³) | ACH: ${ach}`;
  }
}

// ===============================
// 6) الأجهزة (فلترة حسب القطاع)
// ===============================
function getVisibleEquipmentList() {
  const common = equipmentCatalog.common.map(i => ({ ...i }));
  const sectorItems = (equipmentCatalog[currentSector] || []).map(i => ({ ...i }));
  const merged = [...common, ...sectorItems];

  const allSources = [
    ...equipmentCatalog.common,
    ...equipmentCatalog.hospital,
    ...equipmentCatalog.commercial,
    ...equipmentCatalog.residential
  ];
  const countMap = new Map(allSources.map(i => [i.id, i.count || 0]));
  merged.forEach(i => i.count = countMap.get(i.id) || 0);

  return merged;
}

function renderEquipChecklist() {
  const container = document.getElementById('equip-checklist');
  if (!container) return;

  const list = getVisibleEquipmentList();

  const sectorTitle = currentLang === 'ar'
    ? (currentSector === 'hospital' ? 'أجهزة صحية + مشتركة'
      : currentSector === 'commercial' ? 'أجهزة تجارية + مشتركة'
      : currentSector === 'residential' ? 'أجهزة منزلية + مشتركة'
      : 'أجهزة مشتركة')
    : (currentSector === 'hospital' ? 'Hospital + Common Equipment'
      : currentSector === 'commercial' ? 'Commercial + Common Equipment'
      : currentSector === 'residential' ? 'Residential + Common Equipment'
      : 'Common Equipment');

  container.innerHTML = `
    <div style="margin-bottom:10px;color:#ff9f0a;font-weight:700;">${sectorTitle}</div>
    ${list.map(item => `
      <div class="equip-item-row">
        <div>
          ${currentLang === 'ar' ? item.ar : item.en}
          <br><small>${item.watts} W</small>
        </div>
        <div class="counter-ctrl">
          <button class="counter-btn" onclick="changeCount('${item.id}', -1)">-</button>
          <span id="cnt-${item.id}" style="margin:0 10px">${item.count}</span>
          <button class="counter-btn" onclick="changeCount('${item.id}', 1)">+</button>
        </div>
      </div>
    `).join('')}
  `;
}

function findEquipmentById(id) {
  const all = [
    ...equipmentCatalog.common,
    ...equipmentCatalog.hospital,
    ...equipmentCatalog.commercial,
    ...equipmentCatalog.residential
  ];
  return all.find(i => i.id === id);
}

function changeCount(itemId, delta) {
  const item = findEquipmentById(itemId);
  if (!item) return;

  item.count = Math.max(0, (item.count || 0) + delta);

  const cntEl = document.getElementById(`cnt-${itemId}`);
  if (cntEl) cntEl.innerText = item.count;

  const visibleIds = new Set(getVisibleEquipmentList().map(i => i.id));
  let total = 0;

  const allSources = [
    ...equipmentCatalog.common,
    ...equipmentCatalog.hospital,
    ...equipmentCatalog.commercial,
    ...equipmentCatalog.residential
  ];

  for (const eq of allSources) {
    if (visibleIds.has(eq.id)) total += (eq.watts * (eq.count || 0));
  }

  inputs.equip = String(total);
  updateDisplayValues();
  calculateLoad(false);
}

// ===============================
// 7) سجل العمليات
// ===============================
function updateHistoryUI() {
  const container = document.getElementById('history-list');
  if (!container) return;

  if (!calcHistory.length) {
    container.innerHTML = `<div style="color:#8e8e93;padding:8px 0;">${currentLang === 'ar' ? 'لا يوجد سجل بعد' : 'No saved calculations yet'}</div>`;
    return;
  }

  container.innerHTML = calcHistory.map((item, index) => `
    <div class="swipe-item" onclick="deleteItem(${item.id})">
      <div class="info">
        <span style="color:#666; font-size:0.7rem">#${calcHistory.length - index}</span><br>
        <span>${item.room}</span>
        <div style="color:#8e8e93;font-size:0.75rem;margin-top:4px;">
          ${currentLang === 'ar' ? 'الدكت المقترح:' : 'Suggested duct:'} ${item.duct}
        </div>
      </div>
      <div class="vals" style="text-align:left">
        <span class="tr-val">${item.tr} TR</span><br>
        <span class="cfm-val">${formatNum(item.cfm)} CFM</span>
      </div>
    </div>
  `).reverse().join('');
}

function deleteItem(id) {
  if (confirm(currentLang === 'ar' ? 'حذف العملية؟' : 'Delete this entry?')) {
    calcHistory = calcHistory.filter(i => i.id !== id);
    updateHistoryUI();
  }
}

function clearHistory() {
  if (confirm(currentLang === 'ar' ? 'مسح كل السجل؟' : 'Clear all history?')) {
    calcHistory = [];
    updateHistoryUI();
  }
}

// ===============================
// 8) لوحة الأرقام والإدخال
// ===============================
function press(n) {
  if (inputs[activeField] === "0" && n !== '.') {
    inputs[activeField] = n.toString();
  } else {
    if (n === '.' && inputs[activeField].includes('.')) return;
    inputs[activeField] += n.toString();
  }
  updateDisplayValues();
}

function deleteLast() {
  inputs[activeField] = inputs[activeField].slice(0, -1) || "0";
  updateDisplayValues();
  if (activeField !== 'equip') calculateLoad(false);
}

function clearActiveField() {
  inputs[activeField] = "0";
  updateDisplayValues();
  calculateLoad(false);
}

function focusField(f) {
  activeField = f;
  document.getElementById('display')?.classList.remove('active-field');
  document.getElementById('people-count')?.classList.remove('active-field');
  document.getElementById('equip-watts')?.classList.remove('active-field');

  if (f === 'display') document.getElementById('display')?.classList.add('active-field');
  if (f === 'people') document.getElementById('people-count')?.classList.add('active-field');
  if (f === 'equip') document.getElementById('equip-watts')?.classList.add('active-field');
}

function updateDisplayValues() {
  setText('display', inputs.display || "0");

  const peopleInput = document.getElementById('people-count');
  const equipInput = document.getElementById('equip-watts');

  if (peopleInput) peopleInput.value = inputs.people || "0";
  if (equipInput) equipInput.value = inputs.equip || "0";
}

function resetAllFields() {
  inputs = { display: "0", people: "0", equip: "0" };

  for (const key of Object.keys(equipmentCatalog)) {
    equipmentCatalog[key].forEach(i => i.count = 0);
  }

  detectCurrentSector();
  renderEquipChecklist();
  updateDisplayValues();
  calculateLoad(false);
}

// ===============================
// 9) المودال + التبويبات + اللغة
// ===============================
function openEquipModal() {
  detectCurrentSector();
  renderEquipChecklist();
  const modal = document.getElementById('equip-modal');
  if (modal) modal.style.display = 'block';
}

function closeEquipModal() {
  const modal = document.getElementById('equip-modal');
  if (modal) modal.style.display = 'none';
}

function switchTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(id)?.classList.add('active');
  btn?.classList.add('active');
}

function toggleLanguage() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';

  const html = document.getElementById('html-tag');
  if (html) {
    html.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    html.lang = currentLang;
  }

  document.querySelectorAll('[data-ar]').forEach(el => {
    const txt = el.getAttribute(`data-${currentLang}`);
    if (txt) el.textContent = txt;
  });

  const langText = document.getElementById('lang-text');
  if (langText) langText.textContent = currentLang === 'ar' ? 'English' : 'العربية';

  updateRoomSelect();
  detectCurrentSector();
  renderEquipChecklist();
  updateHistoryUI();
  updateFieldHint(getSelectedRoom());

  // تحديث نص زر مسح السجل لو ما اعتمد data- attributes على الزر
  const clearBtn = document.querySelector('.clear-history-btn');
  if (clearBtn) clearBtn.textContent = currentLang === 'ar' ? 'مسح' : 'Clear';
}

// ===============================
// 10) دكت مقترح سريع (يظهر في السجل)
// ===============================
function calcDuctSizeQuick(cfm, velocityFPM = 800, fixedWidthIn = 12) {
  if (!cfm || cfm <= 0) return '--';
  const areaIn2 = (cfm / velocityFPM) * 144;
  const h = Math.max(4, Math.round(areaIn2 / fixedWidthIn));
  return `${fixedWidthIn}" x ${h}"`;
}

// ===============================
// 11) Helpers
// ===============================
function setText(id, txt) {
  const el = document.getElementById(id);
  if (el) el.textContent = txt;
}

function formatNum(n) {
  try {
    return Number(n || 0).toLocaleString(currentLang === 'ar' ? 'ar-SA' : 'en-US');
  } catch {
    return String(n || 0);
  }
}