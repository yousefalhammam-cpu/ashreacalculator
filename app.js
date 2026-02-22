let currentLang = 'ar';
let activeField = 'display'; // display | people
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];

/** =========================================
 *  Room Database (Healthcare = ASHRAE 170 ACH)
 *  Commercial/Residential = Practical ACH + Rule-of-thumb
 *  ========================================= */
const roomDatabase = {
  healthcare: [
    { id: "or", ar: "غرفة عمليات (OR)", en: "Operating Room (OR)", ach: 20, factor: 260, pressure: "neutral/positive", std_ar: "ASHRAE 170", std_en: "ASHRAE 170", sector: "healthcare" },
    { id: "endoscopy", ar: "غرفة المناظير", en: "Endoscopy Room", ach: 15, factor: 300, pressure: "neutral", std_ar: "ASHRAE 170", std_en: "ASHRAE 170", sector: "healthcare" },
    { id: "icu", ar: "العناية المركزة (ICU)", en: "ICU", ach: 12, factor: 330, pressure: "neutral", std_ar: "ASHRAE 170", std_en: "ASHRAE 170", sector: "healthcare" },
    { id: "aiir", ar: "عزل ضغط سالب (AIIR)", en: "Negative Pressure Isolation (AIIR)", ach: 12, factor: 330, pressure: "negative", std_ar: "ASHRAE 170", std_en: "ASHRAE 170", sector: "healthcare" },
    { id: "pe", ar: "عزل ضغط موجب (PE)", en: "Protective Environment (PE)", ach: 12, factor: 330, pressure: "positive", std_ar: "ASHRAE 170", std_en: "ASHRAE 170", sector: "healthcare" },
    { id: "exam", ar: "غرفة فحص", en: "Exam Room", ach: 6, factor: 360, pressure: "neutral", std_ar: "ASHRAE 170", std_en: "ASHRAE 170", sector: "healthcare" },
    { id: "lab", ar: "مختبر عام", en: "General Lab", ach: 6, factor: 380, pressure: "neutral", std_ar: "ASHRAE 170", std_en: "ASHRAE 170", sector: "healthcare" },
    { id: "patient", ar: "غرفة تنويم", en: "Patient Room", ach: 6, factor: 340, pressure: "neutral", std_ar: "ASHRAE 170", std_en: "ASHRAE 170", sector: "healthcare" }
  ],
  commercial: [
    { id: "office", ar: "مكاتب مفتوحة", en: "Open Offices", ach: 4, factor: 500, pressure: "neutral", std_ar: "قاعدة عملية (سعودي)", std_en: "Practical Rule (KSA)", sector: "commercial" },
    { id: "meeting", ar: "غرفة اجتماعات", en: "Meeting Room", ach: 8, factor: 450, pressure: "neutral", std_ar: "قاعدة عملية (سعودي)", std_en: "Practical Rule (KSA)", sector: "commercial" },
    { id: "retail", ar: "محل تجاري", en: "Retail Shop", ach: 6, factor: 420, pressure: "neutral", std_ar: "قاعدة عملية (سعودي)", std_en: "Practical Rule (KSA)", sector: "commercial" },
    { id: "restaurant", ar: "صالة مطعم", en: "Restaurant Dining", ach: 10, factor: 380, pressure: "neutral", std_ar: "قاعدة عملية (سعودي)", std_en: "Practical Rule (KSA)", sector: "commercial" },
    { id: "gym", ar: "نادي رياضي", en: "Gym", ach: 8, factor: 330, pressure: "neutral", std_ar: "قاعدة عملية (سعودي)", std_en: "Practical Rule (KSA)", sector: "commercial" }
  ],
  residential: [
    { id: "bedroom", ar: "غرفة نوم", en: "Bedroom", ach: 2, factor: 650, pressure: "neutral", std_ar: "قاعدة عملية (سعودي)", std_en: "Practical Rule (KSA)", sector: "residential" },
    { id: "living", ar: "غرفة معيشة", en: "Living Room", ach: 4, factor: 550, pressure: "neutral", std_ar: "قاعدة عملية (سعودي)", std_en: "Practical Rule (KSA)", sector: "residential" },
    { id: "majlis", ar: "مجلس ضيوف", en: "Majlis", ach: 5, factor: 500, pressure: "neutral", std_ar: "قاعدة عملية (سعودي)", std_en: "Practical Rule (KSA)", sector: "residential" },
    { id: "kitchen", ar: "مطبخ منزلي", en: "Kitchen", ach: 6, factor: 450, pressure: "negative-ish", std_ar: "قاعدة عملية (سعودي)", std_en: "Practical Rule (KSA)", sector: "residential" },
    { id: "bath", ar: "دورة مياه", en: "Bathroom", ach: 10, factor: 400, pressure: "negative", std_ar: "قاعدة عملية (سعودي)", std_en: "Practical Rule (KSA)", sector: "residential" }
  ]
};

/** =========================================
 *  Equipment (filtered by sector)
 *  watts = typical practical values
 *  sectors: healthcare/commercial/residential/common
 *  ========================================= */
const equipmentCatalog = [
  // Common
  { id: "pc", ar: "كمبيوتر مكتبي", en: "Desktop PC", watts: 250, sectors: ["common", "commercial", "healthcare"] },
  { id: "laptop", ar: "لابتوب", en: "Laptop", watts: 90, sectors: ["common", "commercial", "healthcare", "residential"] },
  { id: "monitor", ar: "شاشة", en: "Monitor", watts: 45, sectors: ["common", "commercial", "healthcare", "residential"] },
  { id: "printer", ar: "طابعة", en: "Printer", watts: 600, sectors: ["common", "commercial", "healthcare"] },
  { id: "fridge_small", ar: "ثلاجة صغيرة", en: "Small Fridge", watts: 180, sectors: ["common", "commercial", "residential", "healthcare"] },

  // Healthcare
  { id: "anesthesia", ar: "جهاز تخدير", en: "Anesthesia Machine", watts: 1500, sectors: ["healthcare"] },
  { id: "surgical_light", ar: "إضاءة عمليات", en: "Surgical Lights", watts: 800, sectors: ["healthcare"] },
  { id: "monitor_patient", ar: "شاشة مراقبة مريض", en: "Patient Monitor", watts: 120, sectors: ["healthcare"] },
  { id: "ventilator", ar: "جهاز تنفس صناعي", en: "Ventilator", watts: 350, sectors: ["healthcare"] },
  { id: "suction", ar: "جهاز شفط", en: "Suction Unit", watts: 200, sectors: ["healthcare"] },
  { id: "infusion", ar: "مضخة محاليل", en: "Infusion Pump", watts: 35, sectors: ["healthcare"] },
  { id: "endoscopy_tower", ar: "وحدة مناظير", en: "Endoscopy Tower", watts: 1200, sectors: ["healthcare"] },
  { id: "ultrasound", ar: "جهاز ألتراساوند", en: "Ultrasound", watts: 500, sectors: ["healthcare"] },
  { id: "lab_analyzer", ar: "جهاز تحليل مختبر", en: "Lab Analyzer", watts: 900, sectors: ["healthcare"] },
  { id: "sterilizer_small", ar: "معقم صغير", en: "Small Sterilizer", watts: 2000, sectors: ["healthcare"] },

  // Commercial
  { id: "pos", ar: "نقطة بيع POS", en: "POS Terminal", watts: 60, sectors: ["commercial"] },
  { id: "display_sign", ar: "شاشة عرض/لوحة", en: "Display Sign", watts: 180, sectors: ["commercial"] },
  { id: "coffee_machine", ar: "ماكينة قهوة", en: "Coffee Machine", watts: 1200, sectors: ["commercial"] },
  { id: "freezer_com", ar: "فريزر تجاري", en: "Commercial Freezer", watts: 700, sectors: ["commercial"] },
  { id: "showcase_chiller", ar: "ثلاجة عرض", en: "Display Chiller", watts: 600, sectors: ["commercial"] },
  { id: "treadmill", ar: "جهاز مشي", en: "Treadmill", watts: 900, sectors: ["commercial"] },

  // Residential
  { id: "tv", ar: "تلفزيون", en: "TV", watts: 120, sectors: ["residential"] },
  { id: "microwave", ar: "مايكرويف", en: "Microwave", watts: 1200, sectors: ["residential"] },
  { id: "oven", ar: "فرن كهربائي", en: "Electric Oven", watts: 2500, sectors: ["residential"] },
  { id: "washing_machine", ar: "غسالة", en: "Washing Machine", watts: 500, sectors: ["residential"] },
  { id: "dishwasher", ar: "غسالة صحون", en: "Dishwasher", watts: 1800, sectors: ["residential"] }
];

// runtime equipment counts
let equipmentState = {}; // {id: count}
equipmentCatalog.forEach(item => equipmentState[item.id] = 0);

window.onload = () => {
  updateRoomSelect();
  updateDisplayValues();
  updateLanguageUI();
  renderEquipChecklist();
  refreshAllBadges();
  calculateLoad(false);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
};

/* =========================
   Helpers
========================= */
function getAllRooms() {
  return [...roomDatabase.healthcare, ...roomDatabase.commercial, ...roomDatabase.residential];
}
function getSelectedRoom() {
  const select = document.getElementById('room-select');
  const roomId = select.value;
  return getAllRooms().find(r => r.id === roomId);
}
function getSectorLabel(sector) {
  const labels = {
    healthcare: { ar: "المستشفيات (ASHRAE 170)", en: "Healthcare (ASHRAE 170)" },
    commercial: { ar: "التجاري", en: "Commercial" },
    residential: { ar: "السكني", en: "Residential" }
  };
  return currentLang === 'ar' ? labels[sector].ar : labels[sector].en;
}
function numberFmt(n) {
  try {
    return new Intl.NumberFormat(currentLang === 'ar' ? 'ar-SA' : 'en-US').format(n);
  } catch {
    return String(n);
  }
}
function nearestMarketBTU(btu) {
  const marketList = [9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000, 72000, 96000, 120000, 144000, 180000, 240000];
  let best = marketList[0];
  let minDiff = Math.abs(best - btu);
  for (const v of marketList) {
    const d = Math.abs(v - btu);
    if (d < minDiff) { minDiff = d; best = v; }
  }
  return best;
}
function currentCalcSnapshot() {
  const room = getSelectedRoom();
  const volume = parseFloat(inputs.display) || 0;
  const people = parseInt(inputs.people) || 0;
  const equipW = parseFloat(inputs.equip) || 0;

  // same equations as calculateLoad
  const cfmACH = ((volume * 35.3147 * room.ach) / 60);
  const cfmPeople = people * (room.sector === 'healthcare' ? 15 : 10);
  const cfm = Math.round(cfmACH + cfmPeople);

  // sensible-ish practical estimate
  const btu = Math.round((cfm * room.factor) + (people * 450) + (equipW * 3.412));
  const tr = +(btu / 12000).toFixed(2);

  return { room, volume, people, equipW, cfm, btu, tr };
}

/* =========================
   UI Setup
========================= */
function updateRoomSelect() {
  const select = document.getElementById('room-select');
  select.innerHTML = '';

  const groups = [
    { key: 'healthcare', items: roomDatabase.healthcare },
    { key: 'commercial', items: roomDatabase.commercial },
    { key: 'residential', items: roomDatabase.residential }
  ];

  groups.forEach(groupData => {
    const og = document.createElement('optgroup');
    og.label = getSectorLabel(groupData.key);

    groupData.items.forEach(room => {
      const opt = document.createElement('option');
      opt.value = room.id;
      opt.textContent = currentLang === 'ar' ? room.ar : room.en;
      og.appendChild(opt);
    });

    select.appendChild(og);
  });

  // keep selection if possible
  if (!select.value && roomDatabase.healthcare.length) {
    select.value = roomDatabase.healthcare[0].id;
  }
}
function updateLanguageUI() {
  document.getElementById('html-tag').dir = currentLang === 'ar' ? 'rtl' : 'ltr';
  document.getElementById('html-tag').lang = currentLang;

  document.querySelectorAll('[data-ar]').forEach(el => {
    const txt = el.getAttribute(currentLang === 'ar' ? 'data-ar' : 'data-en');
    if (txt) el.textContent = txt;
  });

  const langBtn = document.getElementById('lang-toggle-btn');
  if (langBtn) langBtn.textContent = currentLang === 'ar' ? 'English' : 'العربية';

  const aiInput = document.getElementById('ai-user-note');
  if (aiInput) {
    aiInput.placeholder = aiInput.getAttribute(currentLang === 'ar' ? 'data-ar-placeholder' : 'data-en-placeholder') || '';
  }

  // refresh dynamic labels
  updateRoomSelect();
  renderEquipChecklist();
  updateHistoryUI();
  refreshAllBadges();
}
function toggleLanguage() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';
  updateLanguageUI();
  calculateLoad(false);
}
function switchTab(tabId, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  if (btn) btn.classList.add('active');
}

/* =========================
   Calculator Input
========================= */
function focusField(field) {
  activeField = field;
  document.getElementById('display-wrap').classList.remove('active-field');
  document.getElementById('people-count').classList.remove('active-field');
  if (field === 'display') document.getElementById('display-wrap').classList.add('active-field');
  if (field === 'people') document.getElementById('people-count').classList.add('active-field');
}
function press(n) {
  if (activeField === 'equip') return; // equip via modal only

  let key = activeField;
  if (key !== 'display' && key !== 'people') key = 'display';

  if (n === '.' && key === 'people') return; // no decimal for people

  if (n === '.') {
    if (inputs[key].includes('.')) return;
    inputs[key] = inputs[key] === "0" ? "0." : inputs[key] + '.';
  } else {
    if (inputs[key] === "0") inputs[key] = String(n);
    else inputs[key] += String(n);
  }

  updateDisplayValues();
}
function deleteLast() {
  let key = activeField;
  if (key !== 'display' && key !== 'people') key = 'display';
  inputs[key] = inputs[key].slice(0, -1) || "0";
  if (key === 'people') {
    inputs[key] = String(Math.max(0, parseInt(inputs[key]) || 0));
  }
  updateDisplayValues();
}
function clearActiveField() {
  let key = activeField;
  if (key !== 'display' && key !== 'people') key = 'display';
  inputs[key] = "0";
  updateDisplayValues();
}
function resetAllFields() {
  inputs.display = "0";
  inputs.people = "0";
  // keep room selected, reset equip counts for filtered UX
  Object.keys(equipmentState).forEach(k => equipmentState[k] = 0);
  inputs.equip = "0";
  updateDisplayValues();
  renderEquipChecklist();
  calculateLoad(false);
}
function resetAppData() {
  if (!confirm(currentLang === 'ar' ? 'إعادة ضبط كل البيانات؟' : 'Reset all data?')) return;
  calcHistory = [];
  resetAllFields();
  updateHistoryUI();
  document.getElementById('ai-output').textContent = '';
}
function updateDisplayValues() {
  document.getElementById('display').textContent = inputs.display || "0";
  document.getElementById('people-count').value = inputs.people || "0";
  document.getElementById('equip-watts').value = inputs.equip || "0";
}

/* =========================
   Room change / badges
========================= */
function onRoomChange() {
  // reset fields only; keep history
  inputs.display = "0";
  inputs.people = "0";

  // reset equipment counts because list is filtered by room
  Object.keys(equipmentState).forEach(k => equipmentState[k] = 0);
  inputs.equip = "0";

  updateDisplayValues();
  renderEquipChecklist();
  refreshAllBadges();
  calculateLoad(false);
}
function refreshAllBadges() {
  const room = getSelectedRoom();
  if (!room) return;

  const standardText = currentLang === 'ar' ? room.std_ar : room.std_en;
  const roomName = currentLang === 'ar' ? room.ar : room.en;

  document.getElementById('chip-standard').textContent =
    room.sector === 'healthcare'
      ? (currentLang === 'ar' ? "ASHRAE 170 (صحي)" : "ASHRAE 170 (Healthcare)")
      : (currentLang === 'ar' ? "طريقة عملية" : "Practical Method");

  document.getElementById('chip-ach').textContent = `ACH: ${room.ach}`;
  updateDuctChip(0);

  const ruleText = currentLang === 'ar'
    ? `${roomName} • ACH: ${room.ach} • ${standardText}`
    : `${roomName} • ACH: ${room.ach} • ${standardText}`;

  document.getElementById('rule-chip').textContent = ruleText;
}

/* =========================
   Core Calculation
========================= */
function calculateLoad(save = false) {
  const room = getSelectedRoom();
  if (!room) return;

  const volume = parseFloat(inputs.display) || 0; // m3
  const people = parseInt(inputs.people) || 0;
  const equipW = parseFloat(inputs.equip) || 0;

  // CFM from ACH + fresh air allowance for people
  const cfmACH = (volume * 35.3147 * room.ach) / 60;
  const cfmPeople = people * (room.sector === 'healthcare' ? 15 : 10);
  const cfm = Math.round(cfmACH + cfmPeople);

  // Practical BTU estimate:
  // (CFM × factor) + people sensible + equipment watts to BTU/h
  const btu = Math.round((cfm * room.factor) + (people * 450) + (equipW * 3.412));
  const tr = +(btu / 12000).toFixed(2);
  const marketBTU = nearestMarketBTU(btu);

  // UI results
  document.getElementById('tr-result').textContent = `TR ${tr.toFixed(2)}`;
  document.getElementById('cfm-result').textContent = `CFM ${numberFmt(cfm)}`;
  document.getElementById('btu-result').textContent = `BTU/h ${numberFmt(btu)}`;
  document.getElementById('market-btu-text').textContent =
    currentLang === 'ar'
      ? `BTU ${numberFmt(marketBTU)}`
      : `BTU ${numberFmt(marketBTU)}`;

  // Duct quick suggestion at ~800 FPM with width 12" default
  const ductText = calcDuctString(cfm, 12);
  updateDuctChip(cfm, ductText);

  updateAiSummary();

  if (save) {
    calcHistory.unshift({
      id: Date.now(),
      ts: new Date().toISOString(),
      roomId: room.id,
      roomAr: room.ar,
      roomEn: room.en,
      sector: room.sector,
      standardAr: room.std_ar,
      standardEn: room.std_en,
      ach: room.ach,
      volume,
      people,
      equipW,
      cfm,
      btu,
      tr,
      marketBTU,
      duct: ductText
    });
    if (calcHistory.length > 30) calcHistory = calcHistory.slice(0, 30);
    updateHistoryUI();
  }
}

function calcDuctString(cfm, fixedWidthIn = 12) {
  if (!cfm || cfm <= 0) return '-';
  const areaIn2 = (cfm / 800) * 144; // velocity 800 fpm
  const h = Math.max(6, Math.round(areaIn2 / fixedWidthIn));
  return `Duct: ${fixedWidthIn}" x ${h}"`;
}
function updateDuctChip(cfm, text = null) {
  const chip = document.getElementById('chip-duct');
  chip.textContent = text || (cfm > 0 ? calcDuctString(cfm, 12) : 'Duct: -');
}

/* =========================
   History
========================= */
function updateHistoryUI() {
  const wrap = document.getElementById('history-list');
  if (!calcHistory.length) {
    wrap.innerHTML = `<div class="history-item"><div class="left">${currentLang === 'ar' ? 'لا يوجد عمليات محفوظة' : 'No saved calculations'}</div></div>`;
    return;
  }

  wrap.innerHTML = calcHistory.map(item => {
    const roomName = currentLang === 'ar' ? item.roomAr : item.roomEn;
    return `
      <div class="history-item" onclick="loadHistoryItem(${item.id})">
        <div class="left">
          <div>${roomName}</div>
          <div class="muted">ACH ${item.ach} • ${numberFmt(item.volume)} m³</div>
        </div>
        <div class="right">
          <div class="tr">TR ${item.tr.toFixed(2)}</div>
          <div>CFM ${numberFmt(item.cfm)}</div>
          <div>BTU ${numberFmt(item.marketBTU)}</div>
        </div>
      </div>
    `;
  }).join('');
}
function loadHistoryItem(id) {
  const item = calcHistory.find(x => x.id === id);
  if (!item) return;
  document.getElementById('room-select').value = item.roomId;
  inputs.display = String(item.volume);
  inputs.people = String(item.people);
  // reset all eq then put aggregate only (counts unknown from history)
  Object.keys(equipmentState).forEach(k => equipmentState[k] = 0);
  inputs.equip = String(item.equipW);
  updateDisplayValues();
  renderEquipChecklist();
  refreshAllBadges();
  calculateLoad(false);
}
function clearHistory() {
  if (!confirm(currentLang === 'ar' ? 'مسح سجل الحسابات؟' : 'Clear history?')) return;
  calcHistory = [];
  updateHistoryUI();
}

/* =========================
   Equipment Modal / Filtering
========================= */
function getFilteredEquipment() {
  const room = getSelectedRoom();
  if (!room) return [];
  const sector = room.sector;

  return equipmentCatalog.filter(item =>
    item.sectors.includes('common') || item.sectors.includes(sector)
  );
}
function renderEquipChecklist() {
  const wrap = document.getElementById('equip-checklist');
  const items = getFilteredEquipment();

  wrap.innerHTML = items.map(item => {
    const name = currentLang === 'ar' ? item.ar : item.en;
    const count = equipmentState[item.id] || 0;
    return `
      <div class="equip-item">
        <div>
          <div class="equip-name">${name}</div>
          <div class="equip-meta">${item.watts} W</div>
        </div>
        <div class="counter">
          <button onclick="changeEquipCount('${item.id}',-1)">-</button>
          <span id="eq-count-${item.id}">${count}</span>
          <button onclick="changeEquipCount('${item.id}',1)">+</button>
        </div>
      </div>
    `;
  }).join('');

  recalcEquipmentWatts();
}
function openEquipModal() {
  document.getElementById('equip-modal').classList.add('show');
}
function closeEquipModal() {
  document.getElementById('equip-modal').classList.remove('show');
}
function changeEquipCount(id, delta) {
  equipmentState[id] = Math.max(0, (equipmentState[id] || 0) + delta);
  const span = document.getElementById(`eq-count-${id}`);
  if (span) span.textContent = equipmentState[id];
  recalcEquipmentWatts();
  calculateLoad(false);
}
function recalcEquipmentWatts() {
  const filteredIds = new Set(getFilteredEquipment().map(i => i.id));
  let total = 0;

  // only current room sector + common devices count toward total
  equipmentCatalog.forEach(item => {
    if (filteredIds.has(item.id)) {
      total += (equipmentState[item.id] || 0) * item.watts;
    }
  });

  inputs.equip = String(total);
  updateDisplayValues();
}

/* =========================
   Export
========================= */
function exportHistoryJSON() {
  const blob = new Blob([JSON.stringify(calcHistory, null, 2)], { type: 'application/json' });
  downloadBlob(blob, 'aircalc-history.json');
}
function exportHistoryCSV() {
  const headers = ['timestamp','room','sector','standard','ach','volume_m3','people','equip_w','cfm','btu','tr','market_btu','duct'];
  const rows = calcHistory.map(i => [
    i.ts,
    (currentLang === 'ar' ? i.roomAr : i.roomEn),
    i.sector,
    (currentLang === 'ar' ? i.standardAr : i.standardEn),
    i.ach, i.volume, i.people, i.equipW, i.cfm, i.btu, i.tr, i.marketBTU, i.duct
  ]);

  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, 'aircalc-history.csv');
}
function downloadBlob(blob, fileName) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* =========================
   AI Assistant (local guidance layer)
   No API yet, purely interpretive and safe.
========================= */
function updateAiSummary() {
  const s = currentCalcSnapshot();
  const roomName = currentLang === 'ar' ? s.room.ar : s.room.en;
  const stdName = currentLang === 'ar' ? s.room.std_ar : s.room.std_en;

  const txt = currentLang === 'ar'
    ? `الغرفة: ${roomName}
المعيار/الطريقة: ${stdName}
ACH: ${s.room.ach}
الحجم: ${numberFmt(s.volume)} m³
الأشخاص: ${numberFmt(s.people)}
الأجهزة: ${numberFmt(s.equipW)} W
CFM: ${numberFmt(s.cfm)}
TR: ${s.tr.toFixed(2)}
BTU/h: ${numberFmt(s.btu)}
BTU السوق المقترح: ${numberFmt(nearestMarketBTU(s.btu))}`
    : `Room: ${roomName}
Method: ${stdName}
ACH: ${s.room.ach}
Volume: ${numberFmt(s.volume)} m³
People: ${numberFmt(s.people)}
Equipment: ${numberFmt(s.equipW)} W
CFM: ${numberFmt(s.cfm)}
TR: ${s.tr.toFixed(2)}
BTU/h: ${numberFmt(s.btu)}
Suggested market BTU: ${numberFmt(nearestMarketBTU(s.btu))}`;

  document.getElementById('ai-summary-box').textContent = txt;
}
function generateAiAdvice() {
  const s = currentCalcSnapshot();
  const roomName = currentLang === 'ar' ? s.room.ar : s.room.en;
  const question = (document.getElementById('ai-user-note').value || '').trim();

  const warnings = [];
  if (s.volume <= 0) warnings.push(currentLang === 'ar' ? 'أدخل حجم الغرفة أولًا.' : 'Enter room volume first.');
  if (s.room.sector === 'healthcare' && s.cfm < 100) warnings.push(currentLang === 'ar' ? 'CFM منخفض جدًا لغرفة صحية؛ راجع الحجم والوحدة.' : 'CFM is too low for a healthcare room; recheck volume/units.');
  if (s.people > 50 && s.volume < 80) warnings.push(currentLang === 'ar' ? 'عدد الأشخاص مرتفع مقارنة بالحجم.' : 'People count looks high for the entered volume.');

  const recBTU = nearestMarketBTU(s.btu);
  let hvacSuggestion = '';
  if (s.tr <= 3) hvacSuggestion = currentLang === 'ar' ? 'مكيف سبليت/دكت سبليت (حسب الاستخدام)' : 'Split / Ducted Split (depending on use)';
  else if (s.tr <= 8) hvacSuggestion = currentLang === 'ar' ? 'دكت سبليت أو باكيج صغير' : 'Ducted Split or small package unit';
  else if (s.tr <= 20) hvacSuggestion = currentLang === 'ar' ? 'باكيج أو عدة وحدات دكت سبليت' : 'Package unit or multiple ducted splits';
  else hvacSuggestion = currentLang === 'ar' ? 'AHU/FCU أو تقسيم الحمل على عدة وحدات' : 'AHU/FCU or split load across multiple units';

  const pressureNote = s.room.sector === 'healthcare'
    ? (currentLang === 'ar'
        ? `ملاحظة صحية: راجع متطلبات الضغط (${s.room.pressure}) ومسارات الهواء والفلترة حسب المشروع.`
        : `Healthcare note: verify pressure mode (${s.room.pressure}), airflow paths, and filtration for the project.`)
    : (currentLang === 'ar'
        ? 'ملاحظة: هذه نتيجة أولية (Preliminary) وليست بديلًا عن التصميم التفصيلي.'
        : 'Note: this is a preliminary result, not a replacement for detailed design.');

  const answer = currentLang === 'ar'
    ? `تحليل الحالة — ${roomName}

• النتيجة الحالية تبدو ${s.volume > 0 ? 'مقبولة مبدئيًا' : 'غير مكتملة'} للاستخدام الأولي.
• تم الحساب باستخدام ${s.room.sector === 'healthcare' ? 'ASHRAE 170 (ACH)' : 'طريقة عملية (ACH + Rule of Thumb)'}.
• CFM = ${numberFmt(s.cfm)} ، TR = ${s.tr.toFixed(2)} ، BTU/h = ${numberFmt(s.btu)}.
• أقرب سعة سوقية: ${numberFmt(recBTU)} BTU.
• اقتراح نظام تكييف: ${hvacSuggestion}.
• اقتراح مبدئي للدكت: ${calcDuctString(s.cfm,12)}.

${pressureNote}

${warnings.length ? 'تنبيهات:\n- ' + warnings.join('\n- ') : 'لا توجد تنبيهات واضحة.'}

${question ? `\nسؤالك: ${question}\nالرد: إذا تبغى، أقدر أساعدك بخطوة تالية مثل تقسيم الحمل على عدة وحدات أو مراجعة الأجهزة المدخلة.` : ''}`
    : `Case Analysis — ${roomName}

• Current result looks ${s.volume > 0 ? 'reasonable for a preliminary estimate' : 'incomplete'}.
• Calculation method: ${s.room.sector === 'healthcare' ? 'ASHRAE 170 (ACH)' : 'Practical method (ACH + Rule of Thumb)'}.
• CFM = ${numberFmt(s.cfm)}, TR = ${s.tr.toFixed(2)}, BTU/h = ${numberFmt(s.btu)}.
• Closest market size: ${numberFmt(recBTU)} BTU.
• HVAC suggestion: ${hvacSuggestion}.
• Preliminary duct suggestion: ${calcDuctString(s.cfm,12)}.

${pressureNote}

${warnings.length ? 'Warnings:\n- ' + warnings.join('\n- ') : 'No obvious warnings.'}

${question ? `\nYour question: ${question}\nAnswer: I can also help you split the load across multiple units or review equipment inputs.` : ''}`;

  document.getElementById('ai-output').textContent = answer;
}
function copyAiPrompt() {
  const s = currentCalcSnapshot();
  const roomName = currentLang === 'ar' ? s.room.ar : s.room.en;
  const text = `Air Calc Pro Snapshot:
Room: ${roomName}
Sector: ${s.room.sector}
Standard: ${currentLang === 'ar' ? s.room.std_ar : s.room.std_en}
ACH: ${s.room.ach}
Volume (m3): ${s.volume}
People: ${s.people}
Equipment W: ${s.equipW}
CFM: ${s.cfm}
TR: ${s.tr}
BTU/h: ${s.btu}
Suggested Market BTU: ${nearestMarketBTU(s.btu)}
Duct: ${calcDuctString(s.cfm,12)}`;
  navigator.clipboard?.writeText(text);
}