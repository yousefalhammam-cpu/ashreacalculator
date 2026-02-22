/* Air Calc Pro - Stable build (history fixed, assistant removed) */

let currentLang = 'ar';
let activeField = 'display';
let inputs = { display: '0', people: '0', equip: '0' };
let calcHistory = [];

// ---------- DATA ----------
let roomData = null;

// أجهزة شاملة + فلترة حسب القطاع
const equipmentCatalog = [
  // Shared
  { id:'pc', ar:'كمبيوتر مكتبي', en:'Desktop PC', watts:180, cats:['medical','commercial','residential','shared'] },
  { id:'laptop', ar:'لابتوب', en:'Laptop', watts:90, cats:['medical','commercial','residential','shared'] },
  { id:'monitor', ar:'شاشة', en:'Monitor', watts:40, cats:['medical','commercial','residential','shared'] },
  { id:'printer', ar:'طابعة', en:'Printer', watts:500, cats:['medical','commercial','shared'] },
  { id:'fridge_small', ar:'ثلاجة صغيرة', en:'Small Refrigerator', watts:150, cats:['medical','commercial','residential','shared'] },

  // Medical
  { id:'anesthesia', ar:'جهاز تخدير', en:'Anesthesia Machine', watts:1200, cats:['medical'] },
  { id:'surgical_light', ar:'إضاءة جراحية', en:'Surgical Light', watts:180, cats:['medical'] },
  { id:'electrosurgical', ar:'جهاز كي جراحي', en:'Electrosurgical Unit', watts:400, cats:['medical'] },
  { id:'patient_monitor', ar:'مراقبة مريض', en:'Patient Monitor', watts:80, cats:['medical'] },
  { id:'ventilator', ar:'جهاز تنفس صناعي', en:'Ventilator', watts:350, cats:['medical'] },
  { id:'infusion_pump', ar:'مضخة سوائل', en:'Infusion Pump', watts:25, cats:['medical'] },
  { id:'suction', ar:'جهاز شفط', en:'Suction Unit', watts:180, cats:['medical'] },
  { id:'defibrillator', ar:'جهاز صدمات', en:'Defibrillator', watts:300, cats:['medical'] },
  { id:'xray_portable', ar:'أشعة متنقلة', en:'Portable X-Ray', watts:1500, cats:['medical'] },
  { id:'ultrasound', ar:'جهاز ألتراساوند', en:'Ultrasound', watts:300, cats:['medical'] },
  { id:'cath_console', ar:'كونسول قسطرة', en:'Cath Lab Console', watts:2200, cats:['medical'] },
  { id:'endoscopy_stack', ar:'منظار (Stack)', en:'Endoscopy Stack', watts:1200, cats:['medical'] },
  { id:'sterilizer_small', ar:'معقم أدوات', en:'Sterilizer', watts:3000, cats:['medical'] },
  { id:'lab_analyzer', ar:'محلل مختبر', en:'Lab Analyzer', watts:900, cats:['medical'] },

  // Commercial
  { id:'cashier', ar:'نقطة بيع POS', en:'POS Terminal', watts:70, cats:['commercial'] },
  { id:'display_sign', ar:'لوحة عرض مضيئة', en:'Display Sign', watts:120, cats:['commercial'] },
  { id:'coffee_machine', ar:'مكينة قهوة', en:'Coffee Machine', watts:1200, cats:['commercial'] },
  { id:'freezer_shop', ar:'فريزر عرض', en:'Display Freezer', watts:500, cats:['commercial'] },
  { id:'oven_small', ar:'فرن تجاري صغير', en:'Commercial Oven', watts:2500, cats:['commercial'] },
  { id:'hood_fan', ar:'شفاط مطبخ', en:'Kitchen Hood Fan', watts:750, cats:['commercial'] },
  { id:'tv_large', ar:'شاشة كبيرة', en:'Large TV', watts:180, cats:['commercial','residential','shared'] },

  // Residential
  { id:'tv_home', ar:'تلفزيون منزلي', en:'Home TV', watts:120, cats:['residential'] },
  { id:'microwave', ar:'ميكروويف', en:'Microwave', watts:1200, cats:['residential'] },
  { id:'washing_machine', ar:'غسالة', en:'Washing Machine', watts:500, cats:['residential'] },
  { id:'dryer', ar:'نشافة', en:'Dryer', watts:2500, cats:['residential'] },
  { id:'iron', ar:'مكواة', en:'Iron', watts:1000, cats:['residential'] },
  { id:'vacuum', ar:'مكنسة', en:'Vacuum Cleaner', watts:800, cats:['residential'] }
];

let equipmentState = {}; // {eqId: count}

window.addEventListener('load', initApp);

async function initApp() {
  try {
    const res = await fetch('./data.json');
    roomData = await res.json();
  } catch (e) {
    console.error('data.json load failed', e);
    roomData = { categories: [] };
  }

  loadHistory();
  updateRoomSelect();
  resetEquipmentStateForCurrentCategory();
  renderEquipChecklist();
  updateDisplayValues();
  updateLanguageUI();
  updateHistoryUI();
  calculateLoad(false);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(()=>{});
  }
}

// ---------- Helpers ----------
function toEnglishDigits(v) {
  return String(v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

function normalizeNumberInput(str) {
  const x = toEnglishDigits(String(str || ''));
  return x.replace(/[^\d.]/g, '');
}

function fmtInt(num) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(Number(num || 0));
}
function fmtDec(num, d = 2) {
  return new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(Number(num || 0));
}

function getAllRoomsFlat() {
  if (!roomData || !roomData.categories) return [];
  return roomData.categories.flatMap(cat => cat.items.map(item => ({
    ...item,
    categoryNameAr: cat.name_ar,
    categoryNameEn: cat.name_en
  })));
}

function getSelectedRoom() {
  const select = document.getElementById('room-select');
  const id = select.value;
  return getAllRoomsFlat().find(r => r.id === id);
}

function getRoomSector(room) {
  if (!room) return 'commercial';
  if (room.std === 'ASHRAE 170') return 'medical';
  if (room.id.startsWith('h')) return 'medical';
  if (room.id.startsWith('c')) return 'commercial';
  if (room.id.startsWith('r')) return 'residential';
  return 'commercial';
}

function getStdText(room) {
  if (!room) return '—';
  return currentLang === 'ar' ? room.std_ar : room.std_en;
}

// ---------- UI / Language ----------
function updateLanguageUI() {
  document.documentElement.lang = currentLang;
  document.documentElement.dir = currentLang === 'ar' ? 'rtl' : 'ltr';

  document.querySelectorAll('[data-ar]').forEach(el => {
    el.textContent = el.getAttribute(currentLang === 'ar' ? 'data-ar' : 'data-en');
  });

  const btn = document.getElementById('lang-toggle-btn');
  if (btn) btn.textContent = currentLang === 'ar' ? 'English' : 'العربية';

  updateRoomSelect(true);
  renderEquipChecklist();
  updateHistoryUI();
}

function toggleLanguage() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';
  updateLanguageUI();
  calculateLoad(false);
}

function switchTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const panel = document.getElementById(id);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');
}

// ---------- Rooms ----------
function updateRoomSelect(keepCurrent = false) {
  const select = document.getElementById('room-select');
  if (!select || !roomData) return;
  const prev = keepCurrent ? select.value : null;

  select.innerHTML = '';
  roomData.categories.forEach(cat => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = currentLang === 'ar' ? cat.name_ar : cat.name_en;

    cat.items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = currentLang === 'ar' ? item.ar : item.en;
      optgroup.appendChild(opt);
    });

    select.appendChild(optgroup);
  });

  if (prev && getAllRoomsFlat().some(r => r.id === prev)) {
    select.value = prev;
  } else {
    select.selectedIndex = 0;
  }
}

function onRoomChange() {
  resetEquipmentStateForCurrentCategory();
  renderEquipChecklist();
  inputs.equip = '0';
  updateDisplayValues();
  calculateLoad(false);
}

// ---------- Equipment ----------
function getFilteredEquipment() {
  const room = getSelectedRoom();
  const sector = getRoomSector(room);
  return equipmentCatalog.filter(eq => eq.cats.includes(sector) || eq.cats.includes('shared'));
}

function resetEquipmentStateForCurrentCategory() {
  const list = getFilteredEquipment();
  const fresh = {};
  list.forEach(eq => {
    fresh[eq.id] = equipmentState[eq.id] || 0;
  });
  equipmentState = fresh;
  syncEquipTotalFromState();
}

function syncEquipTotalFromState() {
  const list = getFilteredEquipment();
  let total = 0;
  list.forEach(eq => {
    total += (equipmentState[eq.id] || 0) * eq.watts;
  });
  inputs.equip = String(total);
}

function renderEquipChecklist() {
  const wrap = document.getElementById('equip-checklist');
  if (!wrap) return;

  const list = getFilteredEquipment();
  wrap.innerHTML = '';

  list.forEach(eq => {
    const row = document.createElement('div');
    row.className = 'equip-item';

    const left = document.createElement('div');
    left.innerHTML = `
      <div class="name">${currentLang === 'ar' ? eq.ar : eq.en}</div>
      <div class="watts">${fmtInt(eq.watts)} W</div>
    `;

    const ctrl = document.createElement('div');
    ctrl.className = 'equip-ctrl';
    ctrl.innerHTML = `
      <button class="eq-btn" type="button">-</button>
      <span class="eq-count">${equipmentState[eq.id] || 0}</span>
      <button class="eq-btn" type="button">+</button>
    `;

    const [minus, countEl, plus] = ctrl.children;
    minus.addEventListener('click', () => changeEquipCount(eq.id, -1, countEl));
    plus.addEventListener('click', () => changeEquipCount(eq.id, 1, countEl));

    row.appendChild(left);
    row.appendChild(ctrl);
    wrap.appendChild(row);
  });
}

function changeEquipCount(id, delta, countEl) {
  const curr = equipmentState[id] || 0;
  equipmentState[id] = Math.max(0, curr + delta);
  if (countEl) countEl.textContent = String(equipmentState[id]);
  syncEquipTotalFromState();
  updateDisplayValues();
  calculateLoad(false);
}

function openEquipModal() {
  document.getElementById('equip-modal')?.classList.add('show');
}
function closeEquipModal() {
  document.getElementById('equip-modal')?.classList.remove('show');
}

// ---------- Keypad ----------
function focusField(field) {
  activeField = field;
}

function press(n) {
  const val = String(n);
  let x = normalizeNumberInput(inputs[activeField]);

  if (val === '.') {
    if (x.includes('.')) return;
    if (x === '') x = '0';
    x += '.';
  } else {
    if (x === '0') x = val;
    else x += val;
  }

  inputs[activeField] = x;
  updateDisplayValues();
}

function deleteLast() {
  let x = normalizeNumberInput(inputs[activeField]);
  x = x.slice(0, -1);
  if (!x) x = '0';
  inputs[activeField] = x;
  updateDisplayValues();
}

function clearAllFields() {
  inputs = { display: '0', people: '0', equip: '0' };
  Object.keys(equipmentState).forEach(k => equipmentState[k] = 0);
  renderEquipChecklist();
  updateDisplayValues();
  calculateLoad(false);
}

function updateDisplayValues() {
  const displayEl = document.getElementById('display');
  const peopleEl = document.getElementById('people-count');
  const equipEl = document.getElementById('equip-watts');

  if (displayEl) displayEl.textContent = normalizeNumberInput(inputs.display) || '0';
  if (peopleEl) peopleEl.value = normalizeNumberInput(inputs.people) || '0';
  if (equipEl) equipEl.value = fmtInt(Number(normalizeNumberInput(inputs.equip) || 0));
}

// ---------- Calculations ----------
function calculateLoad(saveHistory = false) {
  const room = getSelectedRoom();
  if (!room) return;

  const volM3 = parseFloat(normalizeNumberInput(inputs.display)) || 0;
  const people = parseInt(normalizeNumberInput(inputs.people) || '0', 10) || 0;
  const equipW = parseFloat(normalizeNumberInput(inputs.equip)) || 0;
  const ach = Number(room.ach || 0);

  const cfmFromAch = (volM3 * 35.3147 * ach) / 60;
  const peopleVent = people * (room.std === 'ASHRAE 170' ? 15 : 10);
  const cfm = Math.max(0, Math.round(cfmFromAch + peopleVent));

  let baseFactorPerCFM;
  if (room.std === 'ASHRAE 170') {
    baseFactorPerCFM = 250; // صحي
  } else if (room.id.startsWith('c')) {
    baseFactorPerCFM = 38;  // تجاري
  } else {
    baseFactorPerCFM = 28;  // سكني
  }

  let btu = (cfm * baseFactorPerCFM) + (people * 450) + (equipW * 3.412);
  btu = Math.max(0, btu);

  const tr = btu / 12000;

  const marketSizes = [9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000, 90000, 120000, 144000, 180000, 240000];
  let suggestedBTU = marketSizes[marketSizes.length - 1];
  for (const s of marketSizes) {
    if (s >= btu) { suggestedBTU = s; break; }
  }

  const ductW = 12;
  const ductH = cfm > 0 ? Math.max(4, Math.round(((cfm / 800) * 144) / ductW)) : 0;

  document.getElementById('cfm-result').textContent = `CFM ${fmtInt(cfm)}`;
  document.getElementById('tr-result').textContent = `TR ${fmtDec(tr, 2)}`;
  document.getElementById('btu-result').textContent = `BTU/h ${fmtInt(btu)}`;

  document.getElementById('duct-chip').textContent = `Duct: ${ductW}" x ${ductH}`;
  document.getElementById('ach-chip').textContent = `ACH: ${fmtInt(ach)}`;
  document.getElementById('std-chip').textContent = getStdText(room);

  if (saveHistory) {
    const item = {
      id: Date.now(),
      ts: new Date().toISOString(),
      roomId: room.id,
      roomAr: room.ar,
      roomEn: room.en,
      stdAr: room.std_ar,
      stdEn: room.std_en,
      ach,
      volM3,
      people,
      equipW,
      cfm,
      tr: Number(tr.toFixed(2)),
      btu: Math.round(btu),
      suggestedBTU,
      ductW,
      ductH
    };
    calcHistory.unshift(item);
    saveHistoryToStorage();
    updateHistoryUI();
  }
}

// ---------- History ----------
function loadHistory() {
  try {
    const raw = localStorage.getItem('aircalc_history_v1');
    calcHistory = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(calcHistory)) calcHistory = [];
  } catch {
    calcHistory = [];
  }
}

function saveHistoryToStorage() {
  localStorage.setItem('aircalc_history_v1', JSON.stringify(calcHistory));
}

function updateHistoryUI() {
  const list = document.getElementById('history-list');
  if (!list) return;

  if (!calcHistory.length) {
    list.innerHTML = `<div class="history-empty">${currentLang === 'ar' ? 'لا يوجد عمليات محفوظة' : 'No saved calculations'}</div>`;
    return;
  }

  list.innerHTML = calcHistory.map(item => {
    const roomName = currentLang === 'ar' ? item.roomAr : item.roomEn;
    const stdName = currentLang === 'ar' ? item.stdAr : item.stdEn;

    return `
      <div class="history-item">
        <div class="left">
          <div class="tr">TR ${fmtDec(item.tr, 2)}</div>
          <div class="line">CFM ${fmtInt(item.cfm)}</div>
          <div class="line">BTU ${fmtInt(item.suggestedBTU)}</div>
          <div class="line">${item.ductW}" x ${item.ductH}</div>
        </div>
        <div class="right">
          <div class="room">${roomName}</div>
          <div class="meta">${stdName} • ACH ${fmtInt(item.ach)} • ${fmtInt(item.volM3)} m³ • ${fmtInt(item.people)} P • ${fmtInt(item.equipW)} W</div>
        </div>
      </div>
    `;
  }).join('');
}

function clearHistory() {
  const msg = currentLang === 'ar' ? 'مسح سجل العمليات؟' : 'Clear calculation history?';
  if (!confirm(msg)) return;
  calcHistory = [];
  saveHistoryToStorage();
  updateHistoryUI();
}

// ---------- Export ----------
function exportCSV() {
  if (!calcHistory.length) {
    alert(currentLang === 'ar' ? 'لا يوجد بيانات للتصدير' : 'No data to export');
    return;
  }

  const rows = [
    ['Date','Room','Standard','ACH','Volume_m3','People','Equip_W','CFM','TR','BTU_actual','BTU_market','Duct']
  ];

  calcHistory.forEach(i => {
    rows.push([
      i.ts,
      (currentLang === 'ar' ? i.roomAr : i.roomEn),
      (currentLang === 'ar' ? i.stdAr : i.stdEn),
      i.ach, i.volM3, i.people, i.equipW, i.cfm, i.tr, i.btu, i.suggestedBTU, `${i.ductW}" x ${i.ductH}`
    ]);
  });

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'aircalc-history.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
}