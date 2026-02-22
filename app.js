/* Air Calc Pro - Stable build (no assistant tab) */
let currentLang = 'ar';
let activeField = 'display';
let inputs = { display: '0', people: '0', equip: '0' };
let calcHistory = [];
let roomData = null;

// الأرقام بالإنجليزي دائمًا
const nfInt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// common market BTU steps
const MARKET_BTU_STEPS = [9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000, 72000, 90000, 120000, 144000, 180000, 240000];

// إعدادات
const settings = {
  ductVelocityFpm: 800
};

// معدات حسب نوع القطاع + مشتركة
const equipmentLibrary = {
  common: [
    { id: 'pc', ar: 'كمبيوتر مكتبي', en: 'Desktop PC', w: 250 },
    { id: 'laptop', ar: 'لابتوب', en: 'Laptop', w: 90 },
    { id: 'monitor', ar: 'شاشة', en: 'Monitor', w: 45 },
    { id: 'tv', ar: 'شاشة عرض كبيرة', en: 'Large Display', w: 180 },
    { id: 'printer', ar: 'طابعة/تصوير', en: 'Printer/Copier', w: 800 },
    { id: 'router', ar: 'راوتر/سويتش', en: 'Router/Switch', w: 35 },
    { id: 'fridge_small', ar: 'ثلاجة صغيرة', en: 'Mini Fridge', w: 150 }
  ],
  healthcare: [
    { id: 'patient_monitor', ar: 'مونيتر مريض', en: 'Patient Monitor', w: 120 },
    { id: 'ventilator', ar: 'جهاز تنفس صناعي', en: 'Ventilator', w: 300 },
    { id: 'infusion_pump', ar: 'مضخة محاليل', en: 'Infusion Pump', w: 45 },
    { id: 'suction', ar: 'جهاز شفط', en: 'Suction Unit', w: 180 },
    { id: 'anesthesia', ar: 'جهاز تخدير', en: 'Anesthesia Machine', w: 1200 },
    { id: 'or_light', ar: 'إضاءة عمليات', en: 'OR Light', w: 160 },
    { id: 'autoclave', ar: 'أوتوكليف تعقيم', en: 'Autoclave', w: 3000 },
    { id: 'xray_unit', ar: 'جهاز أشعة تشخيصية', en: 'X-Ray Unit', w: 2500 },
    { id: 'ultrasound', ar: 'ألتراساوند', en: 'Ultrasound', w: 350 },
    { id: 'endoscopy_tower', ar: 'برج مناظير', en: 'Endoscopy Tower', w: 1200 },
    { id: 'lab_analyzer', ar: 'جهاز تحليل مختبر', en: 'Lab Analyzer', w: 700 },
    { id: 'medical_fridge', ar: 'ثلاجة طبية', en: 'Medical Fridge', w: 400 }
  ],
  commercial: [
    { id: 'pos', ar: 'نقطة بيع POS', en: 'POS Terminal', w: 80 },
    { id: 'display_sign', ar: 'لوحة/شاشة إعلانية', en: 'Signage Display', w: 250 },
    { id: 'coffee', ar: 'ماكينة قهوة', en: 'Coffee Machine', w: 1400 },
    { id: 'freezer_shop', ar: 'فريزر عرض', en: 'Display Freezer', w: 900 },
    { id: 'fridge_shop', ar: 'ثلاجة عرض', en: 'Display Fridge', w: 700 },
    { id: 'oven_small', ar: 'فرن تجاري صغير', en: 'Commercial Oven', w: 3500 },
    { id: 'fryer', ar: 'قلاية تجارية', en: 'Commercial Fryer', w: 5000 },
    { id: 'hood_fan', ar: 'مروحة هود', en: 'Hood Fan', w: 600 },
    { id: 'treadmill', ar: 'سير رياضي', en: 'Treadmill', w: 900 },
    { id: 'gym_bike', ar: 'دراجة رياضية', en: 'Gym Bike', w: 150 }
  ],
  residential: [
    { id: 'fridge_home', ar: 'ثلاجة منزلية', en: 'Home Fridge', w: 250 },
    { id: 'microwave', ar: 'مايكرويف', en: 'Microwave', w: 1200 },
    { id: 'oven_home', ar: 'فرن منزلي', en: 'Home Oven', w: 2500 },
    { id: 'washer', ar: 'غسالة', en: 'Washing Machine', w: 500 },
    { id: 'dryer', ar: 'نشافة', en: 'Dryer', w: 3000 },
    { id: 'dishwasher', ar: 'غسالة صحون', en: 'Dishwasher', w: 1800 },
    { id: 'water_heater', ar: 'سخان ماء', en: 'Water Heater', w: 2000 },
    { id: 'vacuum', ar: 'مكنسة كهربائية', en: 'Vacuum Cleaner', w: 1200 }
  ]
};

// Counts
let equipmentCounts = {}; // key=id, value=count

document.addEventListener('DOMContentLoaded', initApp);

async function initApp() {
  loadSettings();
  loadHistory();

  try {
    const res = await fetch('data.json');
    roomData = await res.json();
  } catch (e) {
    console.error('data.json load failed', e);
    alert('Failed to load data.json');
    return;
  }

  buildRoomSelect();
  onRoomChanged();
  updateDisplayValues();
  updateLanguageUI();
  updateHistoryUI();
  registerSW();
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
}

function loadSettings() {
  const saved = localStorage.getItem('aircalc_settings_v1');
  if (saved) {
    try {
      Object.assign(settings, JSON.parse(saved));
    } catch (_) {}
  }
  const v = document.getElementById('duct-velocity');
  if (v) v.value = String(settings.ductVelocityFpm);
}

function saveSettings() {
  const v = parseInt(document.getElementById('duct-velocity').value, 10);
  settings.ductVelocityFpm = Number.isFinite(v) ? Math.max(400, Math.min(2000, v)) : 800;
  document.getElementById('duct-velocity').value = String(settings.ductVelocityFpm);
  localStorage.setItem('aircalc_settings_v1', JSON.stringify(settings));
  updateDuctChip();
}

function loadHistory() {
  const raw = localStorage.getItem('aircalc_history_v1');
  if (!raw) return;
  try {
    calcHistory = JSON.parse(raw);
  } catch (_) {
    calcHistory = [];
  }
}

function persistHistory() {
  localStorage.setItem('aircalc_history_v1', JSON.stringify(calcHistory));
}

function buildRoomSelect() {
  const select = document.getElementById('room-select');
  select.innerHTML = '';

  roomData.categories.forEach(cat => {
    const group = document.createElement('optgroup');
    group.label = currentLang === 'ar' ? cat.name_ar : cat.name_en;
    cat.items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = currentLang === 'ar' ? item.ar : item.en;
      opt.dataset.catNameAr = cat.name_ar;
      opt.dataset.catNameEn = cat.name_en;
      group.appendChild(opt);
    });
    select.appendChild(group);
  });
}

function getSelectedRoom() {
  const select = document.getElementById('room-select');
  const id = select.value;
  for (const cat of roomData.categories) {
    const item = cat.items.find(x => x.id === id);
    if (item) {
      return { ...item, category: cat };
    }
  }
  return null;
}

function onRoomChanged() {
  // ما نمسح الحجم/الأشخاص إلا إذا المستخدم يبغى، نخلي المعدات فقط تتفلتر مع إعادة احتساب الواط
  resetEquipmentForCurrentRoom();
  renderEquipmentList();
  updateRoomMetaChips();
  calculateLoad(false);
}

function getRoomSector(item) {
  // يعتمد على اسم القسم أو med flag
  if (item.med === true) return 'healthcare';
  if (item.id.startsWith('c')) return 'commercial';
  if (item.id.startsWith('r')) return 'residential';
  return 'commercial';
}

function getStandardLabel(item) {
  const sector = getRoomSector(item);
  if (sector === 'healthcare') return currentLang === 'ar' ? 'ASHRAE 170 (صحي)' : 'ASHRAE 170 (Healthcare)';
  if (sector === 'commercial') return currentLang === 'ar' ? 'ASHRAE 62.1 / عملي (سعودي)' : 'ASHRAE 62.1 / Practical';
  return currentLang === 'ar' ? 'ASHRAE 62.2 / عملي (سكني)' : 'ASHRAE 62.2 / Practical';
}

function getBtuFactor(item) {
  // BTU/h per m³ (practical tuned)
  const sector = getRoomSector(item);
  // صحي
  if (sector === 'healthcare') {
    const map = {
      h1: 700,  // OR
      h2: 650,  // PE
      h3: 650,  // AII
      h4: 520,  // ICU
      h5: 600,  // Triage
      h6: 560,  // Lab
      h7: 450,  // Patient room
      h8: 600,  // X-ray
      h9: 650,  // Endoscopy
      h10: 520, // CSSD
      h11: 420, // Pharmacy
      h12: 650, // LDR
      h13: 450, // Physio
      h14: 430  // Exam room
    };
    return map[item.id] || 500;
  }

  // تجاري (سعودي عملي)
  if (sector === 'commercial') {
    const map = {
      c1: 450, // Open offices
      c2: 520, // Conference
      c3: 550, // Dining
      c4: 850, // Comm kitchen
      c5: 600, // Gym
      c6: 500, // Auditorium
      c7: 420, // Library
      c8: 430, // Lobby
      c9: 500  // Retail
    };
    return map[item.id] || 500;
  }

  // سكني
  const map = {
    r1: 400, // living
    r2: 320, // bedroom
    r3: 550, // kitchen
    r4: 350, // bathroom
    r5: 220  // corridor
  };
  return map[item.id] || 350;
}

function getPeopleLoadPerPerson(item) {
  const sector = getRoomSector(item);
  if (sector === 'healthcare') return 500;
  if (sector === 'commercial') return 550;
  return 400;
}

function computeCFM(volumeM3, ach, people) {
  const baseVent = (volumeM3 * 35.3147 * ach) / 60;
  const peopleVent = people * 15;
  return Math.round(baseVent + peopleVent);
}

function computeBTU(volumeM3, item, cfm, people, equipW) {
  const factor = getBtuFactor(item);
  const byVolume = volumeM3 * factor;
  const byVentOnly = cfm * 1.08 * 20; // ΔT 20°F
  const peopleLoad = people * getPeopleLoadPerPerson(item);
  const equipLoad = equipW * 3.412;

  // نستخدم الأكبر بين الحجم والتهوية كأساس + أحمال إضافية
  return Math.round(Math.max(byVolume, byVentOnly) + peopleLoad + equipLoad);
}

function nearestMarketBTU(actualBTU) {
  if (!actualBTU || actualBTU <= 0) return 0;
  for (const s of MARKET_BTU_STEPS) {
    if (actualBTU <= s) return s;
  }
  return MARKET_BTU_STEPS[MARKET_BTU_STEPS.length - 1];
}

function calcTR(btu) {
  return btu / 12000;
}

function calcDuctSize(cfm) {
  const vel = settings.ductVelocityFpm || 800;
  const width = 12; // ثابت مبدئي
  if (!cfm || cfm <= 0) return { width, height: 0 };
  // area ft² = cfm / vel ; in² = *144 ; height = area/width
  const areaIn2 = (cfm / vel) * 144;
  const h = Math.max(4, Math.round(areaIn2 / width));
  return { width, height: h };
}

function calculateLoad(saveToHistory = false) {
  const room = getSelectedRoom();
  if (!room) return;

  const volumeM3 = parseFloat(inputs.display) || 0;
  const people = parseInt(inputs.people, 10) || 0;
  const equipW = parseFloat(inputs.equip) || 0;

  const cfm = computeCFM(volumeM3, room.ach, people);
  const actualBTU = computeBTU(volumeM3, room, cfm, people, equipW);
  const marketBTU = nearestMarketBTU(actualBTU);
  const tr = calcTR(actualBTU);
  const duct = calcDuctSize(cfm);

  // النتائج (بدون سطر "المقترح" الإضافي)
  document.getElementById('res-cfm').textContent = `CFM ${nfInt.format(cfm)}`;
  document.getElementById('res-tr').textContent = `TR ${nf2.format(tr)}`;
  document.getElementById('res-btu').textContent = `BTU/h ${nfInt.format(actualBTU)}`;

  // chips
  document.getElementById('chip-ach').textContent = `ACH: ${nfInt.format(room.ach)}`;
  document.getElementById('chip-standard').textContent = getStandardLabel(room);
  document.getElementById('chip-duct').textContent = `Duct: ${duct.width}" x ${duct.height}"`;

  if (saveToHistory) {
    const entry = {
      id: Date.now(),
      ts: new Date().toISOString(),
      roomId: room.id,
      roomAr: room.ar,
      roomEn: room.en,
      standard: getStandardLabel(room),
      ach: room.ach,
      volumeM3,
      people,
      equipW,
      cfm,
      btuActual: actualBTU,
      btuMarket: marketBTU,
      tr: +tr.toFixed(2),
      ductW: duct.width,
      ductH: duct.height
    };
    calcHistory.unshift(entry);
    if (calcHistory.length > 100) calcHistory = calcHistory.slice(0, 100);
    persistHistory();
    updateHistoryUI();
  }
}

function updateHistoryUI() {
  const list = document.getElementById('history-list');
  if (!list) return;

  if (!calcHistory.length) {
    list.innerHTML = `<div class="hist-meta">${currentLang === 'ar' ? 'لا يوجد سجل بعد' : 'No history yet'}</div>`;
    return;
  }

  list.innerHTML = calcHistory.map(item => {
    const title = currentLang === 'ar' ? item.roomAr : item.roomEn;
    const dt = new Date(item.ts);
    const dateStr = `${dt.getFullYear()}-${pad2(dt.getMonth()+1)}-${pad2(dt.getDate())} ${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
    return `
      <div class="history-item">
        <div class="hist-top">
          <div>
            <div class="hist-room">${escapeHtml(title)}</div>
            <div class="hist-meta">${escapeHtml(item.standard)} • ${dateStr}</div>
          </div>
          <button class="small-btn" onclick="deleteHistoryItem(${item.id})">${currentLang === 'ar' ? 'حذف' : 'Delete'}</button>
        </div>
        <div class="hist-grid">
          <div class="kv"><div class="k">TR</div><div class="v">${nf2.format(item.tr)}</div></div>
          <div class="kv"><div class="k">CFM</div><div class="v">${nfInt.format(item.cfm)}</div></div>
          <div class="kv"><div class="k">BTU/h</div><div class="v">${nfInt.format(item.btuActual)}</div></div>
          <div class="kv"><div class="k">Duct</div><div class="v">${item.ductW}"x${item.ductH}"</div></div>
        </div>
      </div>
    `;
  }).join('');
}

function deleteHistoryItem(id) {
  calcHistory = calcHistory.filter(x => x.id !== id);
  persistHistory();
  updateHistoryUI();
}

function clearHistory() {
  if (!confirm(currentLang === 'ar' ? 'مسح سجل الحسابات؟' : 'Clear history?')) return;
  calcHistory = [];
  persistHistory();
  updateHistoryUI();
}

function exportHistoryJSON() {
  const blob = new Blob([JSON.stringify(calcHistory, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `aircalc-history-${dateFile()}.json`);
}

function exportHistoryTXT() {
  const lines = calcHistory.map((x, i) => {
    const room = currentLang === 'ar' ? x.roomAr : x.roomEn;
    return [
      `#${i + 1} - ${room}`,
      `TR: ${x.tr}`,
      `CFM: ${x.cfm}`,
      `BTU/h: ${x.btuActual}`,
      `Duct: ${x.ductW}" x ${x.ductH}"`,
      `ACH: ${x.ach}`,
      `Vol: ${x.volumeM3} m3 | P: ${x.people} | W: ${x.equipW}`,
      `---`
    ].join('\n');
  }).join('\n');
  const blob = new Blob([lines || 'No history'], { type: 'text/plain;charset=utf-8' });
  downloadBlob(blob, `aircalc-history-${dateFile()}.txt`);
}

async function copyHistory() {
  try {
    const text = calcHistory.map((x, i) =>
      `#${i + 1} ${currentLang === 'ar' ? x.roomAr : x.roomEn} | TR ${x.tr} | CFM ${x.cfm} | BTU ${x.btuActual}`
    ).join('\n');
    await navigator.clipboard.writeText(text || 'No history');
    alert(currentLang === 'ar' ? 'تم نسخ السجل' : 'History copied');
  } catch {
    alert(currentLang === 'ar' ? 'تعذر النسخ' : 'Copy failed');
  }
}

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 3000);
}

function dateFile() {
  const d = new Date();
  return `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}-${pad2(d.getHours())}${pad2(d.getMinutes())}`;
}

function pad2(n) { return String(n).padStart(2, '0'); }

function press(n) {
  const s = String(n);
  let val = inputs[activeField];

  if (s === '.' && val.includes('.')) return;
  if (val === '0' && s !== '.') val = s;
  else val += s;

  inputs[activeField] = val;
  updateDisplayValues();
}

function deleteLast() {
  const v = inputs[activeField];
  inputs[activeField] = (v.length <= 1) ? '0' : v.slice(0, -1);
  if (inputs[activeField] === '-' || inputs[activeField] === '') inputs[activeField] = '0';
  updateDisplayValues();
}

function clearActiveField() {
  inputs[activeField] = '0';
  updateDisplayValues();
  if (activeField === 'equip') {
    // لو مسحنا الأجهزة من الحقل، نصفر العدادات
    Object.keys(equipmentCounts).forEach(k => equipmentCounts[k] = 0);
    renderEquipmentList();
  }
}

function clearAllInputs() {
  inputs.display = '0';
  inputs.people = '0';
  inputs.equip = '0';
  Object.keys(equipmentCounts).forEach(k => equipmentCounts[k] = 0);
  renderEquipmentList();
  updateDisplayValues();
  calculateLoad(false);
}

function updateDisplayValues() {
  document.getElementById('display').textContent = sanitizeNumString(inputs.display);
  document.getElementById('people-count').value = sanitizeNumString(inputs.people);
  document.getElementById('equip-watts').value = sanitizeNumString(inputs.equip);
}

function sanitizeNumString(s) {
  const n = Number(s);
  if (!Number.isFinite(n)) return '0';
  // نحافظ على الديسيمل إذا المستخدم كتب نقطة
  if (String(s).includes('.')) return String(s);
  return String(Math.trunc(n));
}

function focusField(f) {
  activeField = f;
  document.getElementById('display').classList.remove('active-field');
  document.getElementById('people-count').classList.remove('active-field');
  document.getElementById('equip-watts').classList.remove('active-field');

  if (f === 'display') document.getElementById('display').classList.add('active-field');
  if (f === 'people') document.getElementById('people-count').classList.add('active-field');
  if (f === 'equip') document.getElementById('equip-watts').classList.add('active-field');
}

function switchTab(tabId, btnEl) {
  document.querySelectorAll('.tab-panel').forEach(x => x.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');

  document.querySelectorAll('.bottom-nav .nav-item').forEach(x => x.classList.remove('active'));
  btnEl.classList.add('active');
}

function toggleLanguage() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';

  const html = document.getElementById('html-tag');
  html.lang = currentLang;
  html.dir = currentLang === 'ar' ? 'rtl' : 'ltr';

  buildRoomSelect();
  renderEquipmentList();
  updateLanguageUI();
  updateRoomMetaChips();
  updateHistoryUI();
  calculateLoad(false);
}

function updateLanguageUI() {
  document.querySelectorAll('[data-ar]').forEach(el => {
    const txt = el.getAttribute(`data-${currentLang}`);
    if (txt) el.textContent = txt;
  });

  // زر اللغة في الإعدادات
  const langBtn = document.getElementById('lang-btn');
  if (langBtn) langBtn.textContent = currentLang === 'ar' ? 'English' : 'العربية';
}

function updateRoomMetaChips() {
  const room = getSelectedRoom();
  if (!room) return;
  document.getElementById('chip-standard').textContent = getStandardLabel(room);
  document.getElementById('chip-ach').textContent = `ACH: ${nfInt.format(room.ach)}`;
  updateDuctChip();
}

function updateDuctChip() {
  const cfmText = document.getElementById('res-cfm').textContent || 'CFM 0';
  const cfm = parseInt(cfmText.replace(/[^\d]/g, ''), 10) || 0;
  const duct = calcDuctSize(cfm);
  document.getElementById('chip-duct').textContent = `Duct: ${duct.width}" x ${duct.height}"`;
}

// EQUIPMENT
function getEquipmentForCurrentRoom() {
  const room = getSelectedRoom();
  if (!room) return [];
  const sector = getRoomSector(room);
  return [...equipmentLibrary.common, ...(equipmentLibrary[sector] || [])];
}

function resetEquipmentForCurrentRoom() {
  const allowed = new Set(getEquipmentForCurrentRoom().map(x => x.id));

  // حذف أي عدادات لأجهزة غير مسموحة
  Object.keys(equipmentCounts).forEach(id => {
    if (!allowed.has(id)) delete equipmentCounts[id];
  });

  // إنشاء عدادات للأجهزة المتاحة
  for (const eq of getEquipmentForCurrentRoom()) {
    if (typeof equipmentCounts[eq.id] !== 'number') equipmentCounts[eq.id] = 0;
  }

  refreshEquipWattsFromCounts();
}

function refreshEquipWattsFromCounts() {
  const list = getEquipmentForCurrentRoom();
  const totalW = list.reduce((sum, e) => sum + ((equipmentCounts[e.id] || 0) * e.w), 0);
  inputs.equip = String(totalW);
  updateDisplayValues();
}

function renderEquipmentList() {
  const box = document.getElementById('equip-list');
  if (!box) return;
  const list = getEquipmentForCurrentRoom();

  box.innerHTML = list.map(eq => {
    const count = equipmentCounts[eq.id] || 0;
    return `
      <div class="equip-item">
        <div>
          <div class="eq-name">${escapeHtml(currentLang === 'ar' ? eq.ar : eq.en)}</div>
          <div class="eq-sub">${nfInt.format(eq.w)} W</div>
        </div>
        <div class="eq-controls">
          <button onclick="changeEquipCount('${eq.id}', -1)">−</button>
          <div class="eq-count">${nfInt.format(count)}</div>
          <button onclick="changeEquipCount('${eq.id}', 1)">+</button>
        </div>
      </div>
    `;
  }).join('');
}

function changeEquipCount(id, delta) {
  if (typeof equipmentCounts[id] !== 'number') equipmentCounts[id] = 0;
  equipmentCounts[id] = Math.max(0, equipmentCounts[id] + delta);
  refreshEquipWattsFromCounts();
  renderEquipmentList();
  calculateLoad(false);
}

function openEquipModal() {
  focusField('equip');
  document.getElementById('equip-modal').classList.add('show');
}

function closeEquipModal() {
  document.getElementById('equip-modal').classList.remove('show');
}

// helpers
function escapeHtml(str = '') {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}