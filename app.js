/* Air Calc Pro - Stable build (Arabic/English, history, sector-based logic) */

let currentLang = 'ar';
let activeField = 'display';
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];
let roomData = { categories: [] };

// ---------- Equipment pools by sector ----------
const commonEquip = [
  { id: 'pc', ar: 'كمبيوتر مكتبي', en: 'Desktop PC', watts: 250, count: 0, sectors: ['hospital','commercial','residential'] },
  { id: 'laptop', ar: 'لابتوب', en: 'Laptop', watts: 90, count: 0, sectors: ['hospital','commercial','residential'] },
  { id: 'monitor', ar: 'شاشة', en: 'Monitor', watts: 60, count: 0, sectors: ['hospital','commercial','residential'] },
  { id: 'printer', ar: 'طابعة', en: 'Printer', watts: 500, count: 0, sectors: ['hospital','commercial'] },
  { id: 'fridge_small', ar: 'ثلاجة صغيرة', en: 'Small Refrigerator', watts: 180, count: 0, sectors: ['hospital','commercial','residential'] }
];

const hospitalEquip = [
  { id: 'anesthesia', ar: 'جهاز تخدير', en: 'Anesthesia Machine', watts: 300, count: 0, sectors: ['hospital'] },
  { id: 'ventilator', ar: 'جهاز تنفس صناعي', en: 'Ventilator', watts: 180, count: 0, sectors: ['hospital'] },
  { id: 'patient_monitor', ar: 'مونيتور مريض', en: 'Patient Monitor', watts: 80, count: 0, sectors: ['hospital'] },
  { id: 'suction', ar: 'شفاط طبي', en: 'Medical Suction', watts: 120, count: 0, sectors: ['hospital'] },
  { id: 'infusion_pump', ar: 'مضخة محاليل', en: 'Infusion Pump', watts: 30, count: 0, sectors: ['hospital'] },
  { id: 'autoclave', ar: 'أوتوكليف / تعقيم', en: 'Autoclave', watts: 2000, count: 0, sectors: ['hospital'] },
  { id: 'lab_analyzer', ar: 'جهاز تحليل مختبر', en: 'Lab Analyzer', watts: 700, count: 0, sectors: ['hospital'] },
  { id: 'biosafety', ar: 'خزانة سلامة حيوية', en: 'Biosafety Cabinet', watts: 900, count: 0, sectors: ['hospital'] },
  { id: 'xray_console', ar: 'كونسول أشعة', en: 'X-ray Console', watts: 600, count: 0, sectors: ['hospital'] },
  { id: 'ultrasound', ar: 'جهاز ألتراساوند', en: 'Ultrasound Machine', watts: 350, count: 0, sectors: ['hospital'] },
  { id: 'mri_aux', ar: 'معدات رنين مساعدة', en: 'MRI Support Equip', watts: 2500, count: 0, sectors: ['hospital'] },
  { id: 'med_fridge', ar: 'ثلاجة أدوية/مختبر', en: 'Medical Refrigerator', watts: 450, count: 0, sectors: ['hospital'] }
];

const commercialEquip = [
  { id: 'copier', ar: 'آلة تصوير', en: 'Copier', watts: 800, count: 0, sectors: ['commercial'] },
  { id: 'server', ar: 'سيرفر', en: 'Server', watts: 1200, count: 0, sectors: ['commercial'] },
  { id: 'display_sign', ar: 'شاشة عرض كبيرة', en: 'Display Screen', watts: 220, count: 0, sectors: ['commercial'] },
  { id: 'cashier', ar: 'نقطة بيع POS', en: 'POS System', watts: 120, count: 0, sectors: ['commercial'] },
  { id: 'coffee_machine', ar: 'مكينة قهوة', en: 'Coffee Machine', watts: 1500, count: 0, sectors: ['commercial'] },
  { id: 'freezer', ar: 'فريزر/ثلاجة عرض', en: 'Display Freezer', watts: 900, count: 0, sectors: ['commercial'] },
  { id: 'oven', ar: 'فرن تجاري', en: 'Commercial Oven', watts: 3500, count: 0, sectors: ['commercial'] },
  { id: 'gym_treadmill', ar: 'سير كهربائي', en: 'Treadmill', watts: 900, count: 0, sectors: ['commercial'] }
];

const residentialEquip = [
  { id: 'tv', ar: 'تلفزيون', en: 'TV', watts: 150, count: 0, sectors: ['residential'] },
  { id: 'router', ar: 'راوتر', en: 'Router', watts: 15, count: 0, sectors: ['residential'] },
  { id: 'washing', ar: 'غسالة', en: 'Washing Machine', watts: 700, count: 0, sectors: ['residential'] },
  { id: 'dryer', ar: 'نشافة', en: 'Dryer', watts: 2500, count: 0, sectors: ['residential'] },
  { id: 'microwave', ar: 'مايكرويف', en: 'Microwave', watts: 1200, count: 0, sectors: ['residential'] },
  { id: 'oven_home', ar: 'فرن منزلي', en: 'Home Oven', watts: 2200, count: 0, sectors: ['residential'] },
  { id: 'fridge_home', ar: 'ثلاجة منزلية', en: 'Home Refrigerator', watts: 250, count: 0, sectors: ['residential'] }
];

let equipmentList = [...commonEquip, ...hospitalEquip, ...commercialEquip, ...residentialEquip];

// ---------- Boot ----------
window.onload = async () => {
  forceEnglishDigitsEverywhere();
  await loadData();
  updateRoomSelect();
  renderEquipChecklist();
  updateDisplayValues();
  focusField('display');
  updateLangUi();
  calculateLoad(false);
};

function forceEnglishDigitsEverywhere() {
  document.documentElement.style.fontVariantNumeric = "tabular-nums";
}

// ---------- Data loading ----------
async function loadData() {
  const fallback = getInlineFallbackData();

  try {
    const res = await fetch(`./data.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txt = await res.text();
    const parsed = JSON.parse(txt);
    if (!parsed || !Array.isArray(parsed.categories)) throw new Error('Invalid data.json');
    roomData = parsed;
  } catch (e) {
    console.warn('Using inline fallback data:', e);
    roomData = fallback;
  }
}

// ---------- Room Select ----------
function updateRoomSelect() {
  const select = document.getElementById('room-select');
  if (!select) return;

  select.innerHTML = '';

  roomData.categories.forEach(cat => {
    const group = document.createElement('optgroup');
    group.label = currentLang === 'ar' ? cat.name_ar : cat.name_en;

    cat.items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.textContent = currentLang === 'ar' ? item.ar : item.en;

      opt.dataset.sector = item.sector || detectSectorByCategory(cat);
      opt.dataset.ach = String(item.ach ?? '');
      opt.dataset.standard = item.standard || '';
      opt.dataset.method = item.method || '';
      opt.dataset.factor = String(item.factor ?? '');
      opt.dataset.peopleCfm = String(item.peopleCfm ?? '');
      opt.dataset.exhaustBias = String(item.exhaustBias ?? '0');
      opt.dataset.med = item.med ? '1' : '0';

      group.appendChild(opt);
    });

    select.appendChild(group);
  });

  if (select.options.length > 0) {
    select.selectedIndex = 0;
  }
  refreshRoomMeta();
}

function detectSectorByCategory(cat) {
  const n = `${cat.name_en} ${cat.name_ar}`.toLowerCase();
  if (n.includes('hospital') || n.includes('مستشفى') || n.includes('المستشفيات')) return 'hospital';
  if (n.includes('commercial') || n.includes('تجاري')) return 'commercial';
  return 'residential';
}

function onRoomChange() {
  resetAllFields(false); // لا تمسح الغرفة المختارة
  refreshRoomMeta();
  renderEquipChecklist();
  calculateLoad(false);
}

function getSelectedRoomOption() {
  const select = document.getElementById('room-select');
  if (!select || !select.options.length) return null;
  return select.options[select.selectedIndex];
}

function refreshRoomMeta() {
  const opt = getSelectedRoomOption();
  if (!opt) return;

  const ach = Number(opt.dataset.ach || 0);
  const std = opt.dataset.standard || '—';
  const method = opt.dataset.method || '—';

  document.getElementById('ach-badge').textContent = ach ? `${ach}` : '—';
  document.getElementById('std-badge').textContent = std;
  document.getElementById('method-badge').textContent = method;

  updateEquipScopeNote();
}

function updateEquipScopeNote() {
  const opt = getSelectedRoomOption();
  const note = document.getElementById('equip-scope-note');
  if (!opt || !note) return;

  const sector = opt.dataset.sector;
  const map = {
    hospital: {
      ar: 'تظهر أجهزة طبية + أجهزة مشتركة فقط',
      en: 'Medical + shared equipment only'
    },
    commercial: {
      ar: 'تظهر أجهزة تجارية + أجهزة مشتركة فقط',
      en: 'Commercial + shared equipment only'
    },
    residential: {
      ar: 'تظهر أجهزة منزلية + أجهزة مشتركة فقط',
      en: 'Residential + shared equipment only'
    }
  };
  note.textContent = currentLang === 'ar' ? map[sector].ar : map[sector].en;
}

// ---------- Calculation ----------
function calculateLoad(save = false) {
  const volumeM3 = parseFloat(inputs.display) || 0;
  const people = parseInt(inputs.people || '0', 10) || 0;
  const equipWatts = parseFloat(inputs.equip) || 0;

  const opt = getSelectedRoomOption();
  if (!opt) return;

  const sector = opt.dataset.sector;
  const ach = Number(opt.dataset.ach || 0);
  const factor = Number(opt.dataset.factor || 350);
  const peopleCfm = Number(opt.dataset.peopleCfm || 15);
  const exhaustBias = Number(opt.dataset.exhaustBias || 0);

  // CFM by ACH
  // 1 m³ = 35.3147 ft³
  const cfmACH = (volumeM3 * 35.3147 * ach) / 60;

  // People ventilation add-on
  const cfmPeople = people * peopleCfm;

  // Total supply CFM (rounded)
  let supplyCFM = Math.round(cfmACH + cfmPeople);
  if (!Number.isFinite(supplyCFM) || supplyCFM < 0) supplyCFM = 0;

  // Sector-based TR estimation (kept stable + practical)
  let tr = 0;
  let methodLabel = '';

  if (sector === 'hospital') {
    // Healthcare: ACH-driven airflow + sensible factor + people + equipment
    const btuFromAir = supplyCFM * factor;     // factor tuned in data per room
    const btuPeople = people * 450;
    const btuEquip = equipWatts * 3.412;
    const totalBTU = btuFromAir + btuPeople + btuEquip;
    tr = totalBTU / 12000;
    methodLabel = currentLang === 'ar' ? 'ASHRAE 170 (ACH-driven)' : 'ASHRAE 170 (ACH-driven)';
  } else if (sector === 'commercial') {
    // Commercial: common local quick method with airflow + occupancy + equipment
    const btuFromAir = supplyCFM * factor;
    const btuPeople = people * 500;
    const btuEquip = equipWatts * 3.412;
    const totalBTU = btuFromAir + btuPeople + btuEquip;
    tr = totalBTU / 12000;
    methodLabel = currentLang === 'ar' ? 'Saudi practice (commercial)' : 'Saudi practice (commercial)';
  } else {
    // Residential: practical Saudi-style simplified estimate + occupancy + equipment
    const btuFromAir = supplyCFM * factor;
    const btuPeople = people * 400;
    const btuEquip = equipWatts * 3.412;
    const totalBTU = btuFromAir + btuPeople + btuEquip;
    tr = totalBTU / 12000;
    methodLabel = currentLang === 'ar' ? 'Saudi practice (residential)' : 'Saudi practice (residential)';
  }

  const btu = Math.round(tr * 12000);

  // Mild sanity floor for very small inputs (optional behavior)
  if (volumeM3 <= 0) {
    tr = 0;
  }

  // Exhaust estimate (only for record display)
  let exhaustCFM = Math.round(supplyCFM * (1 + exhaustBias / 100));
  if (exhaustCFM < 0) exhaustCFM = 0;

  // UI outputs (English numerals)
  document.getElementById('tr-result').textContent = `${toEnNum(tr.toFixed(2))} TR`;
  document.getElementById('btu-result').textContent = `${toEnNum(btu)} BTU/h`;
  document.getElementById('cfm-result').textContent = `${toEnNum(supplyCFM)} CFM`;

  // Push to duct field
  const targetCFM = document.getElementById('targetCFM');
  if (targetCFM) targetCFM.value = toEnNum(supplyCFM);

  // Update method badge live
  document.getElementById('method-badge').textContent = methodLabel;

  if (save) {
    const roomName = opt.textContent;
    const achVal = Number(opt.dataset.ach || 0);
    const ductWidth = parseFloat(document.getElementById('fixWidth')?.value || '12') || 12;
    const ductH = estimateDuctHeight(supplyCFM, ductWidth);

    calcHistory.unshift({
      id: Date.now(),
      room: roomName,
      tr: tr.toFixed(2),
      btu,
      cfm: supplyCFM,
      ach: achVal,
      duct: `${ductWidth}" x ${ductH}"`,
      sector
    });

    if (calcHistory.length > 100) calcHistory.pop();
    updateHistoryUI();
  }
}

function estimateDuctHeight(cfm, widthIn) {
  if (!cfm || !widthIn) return 0;
  const velocity = 800; // fpm target
  const areaIn2 = (cfm / velocity) * 144;
  return Math.max(4, Math.round(areaIn2 / widthIn));
}

// ---------- History ----------
function updateHistoryUI() {
  const container = document.getElementById('history-list');
  if (!container) return;

  if (!calcHistory.length) {
    container.innerHTML = `<div class="hist-sub">${currentLang === 'ar' ? 'لا يوجد نتائج محفوظة' : 'No saved results'}</div>`;
    return;
  }

  container.innerHTML = calcHistory.map((item, idx) => `
    <div class="swipe-item" onclick="deleteItem(${item.id})">
      <div class="hist-left">
        <div class="hist-room">${escapeHtml(item.room)}</div>
        <div class="hist-sub">
          #${toEnNum(calcHistory.length - idx)} • ACH ${toEnNum(item.ach)} • Duct ${item.duct}
        </div>
      </div>
      <div class="hist-right">
        <div class="tr-val">${toEnNum(item.tr)} TR</div>
        <div>${toEnNum(item.btu)} BTU/h</div>
        <div>${toEnNum(item.cfm)} CFM</div>
      </div>
    </div>
  `).join('');
}

function deleteItem(id) {
  const msg = currentLang === 'ar' ? 'حذف هذا السجل؟' : 'Delete this record?';
  if (!confirm(msg)) return;
  calcHistory = calcHistory.filter(i => i.id !== id);
  updateHistoryUI();
}

function clearHistory() {
  const msg = currentLang === 'ar' ? 'مسح كل السجل؟' : 'Clear all history?';
  if (!confirm(msg)) return;
  calcHistory = [];
  updateHistoryUI();
}

// ---------- Input / keypad ----------
function press(n) {
  const s = String(n);
  let v = inputs[activeField] || '0';

  if (s === '.') {
    if (activeField !== 'display') return; // decimal only in room volume
    if (v.includes('.')) return;
    v += '.';
  } else {
    if (v === '0') v = s;
    else v += s;
  }

  inputs[activeField] = normalizeNumString(v);
  updateDisplayValues();
  calculateLoad(false);
}

function deleteLast() {
  let v = inputs[activeField] || '0';
  v = v.slice(0, -1);
  if (!v || v === '-') v = '0';
  inputs[activeField] = normalizeNumString(v);
  updateDisplayValues();
  calculateLoad(false);
}

function clearActiveField() {
  inputs[activeField] = '0';
  updateDisplayValues();
  calculateLoad(false);
}

function focusField(field) {
  activeField = field;

  document.getElementById('display').classList.remove('active-field');
  document.getElementById('people-count').classList.remove('active-field');
  document.getElementById('equip-watts').classList.remove('active-field');

  if (field === 'display') document.getElementById('display').classList.add('active-field');
  if (field === 'people') document.getElementById('people-count').classList.add('active-field');
  if (field === 'equip') document.getElementById('equip-watts').classList.add('active-field');
}

function updateDisplayValues() {
  document.getElementById('display').textContent = toEnNum(inputs.display || '0');
  document.getElementById('people-count').value = toEnNum(inputs.people || '0');
  document.getElementById('equip-watts').value = toEnNum(inputs.equip || '0');
}

// ---------- Equipment modal ----------
function getCurrentSector() {
  const opt = getSelectedRoomOption();
  return opt ? opt.dataset.sector : 'residential';
}

function renderEquipChecklist() {
  const box = document.getElementById('equip-checklist');
  if (!box) return;

  const sector = getCurrentSector();

  const filtered = equipmentList.filter(eq =>
    eq.sectors.includes(sector) || eq.sectors.includes('all')
  );

  box.innerHTML = filtered.map(eq => {
    const idx = equipmentList.findIndex(x => x.id === eq.id);
    return `
      <div class="equip-item-row">
        <div class="equip-text">
          ${currentLang === 'ar' ? eq.ar : eq.en}<br>
          <small>${toEnNum(eq.watts)} W</small>
        </div>
        <div class="counter-ctrl">
          <button class="counter-btn" onclick="changeCount(${idx}, -1)">-</button>
          <span id="cnt-${idx}">${toEnNum(eq.count)}</span>
          <button class="counter-btn" onclick="changeCount(${idx}, 1)">+</button>
        </div>
      </div>
    `;
  }).join('');

  updateEquipScopeNote();
}

function openEquipModal() {
  document.getElementById('equip-modal').style.display = 'block';
  renderEquipChecklist();
}

function closeEquipModal() {
  document.getElementById('equip-modal').style.display = 'none';
  focusField('equip');
}

function changeCount(globalIdx, delta) {
  const item = equipmentList[globalIdx];
  if (!item) return;

  item.count = Math.max(0, (item.count || 0) + delta);

  const span = document.getElementById(`cnt-${globalIdx}`);
  if (span) span.textContent = toEnNum(item.count);

  const currentSector = getCurrentSector();
  const totalWatts = equipmentList
    .filter(eq => eq.sectors.includes(currentSector))
    .reduce((sum, eq) => sum + (eq.watts * (eq.count || 0)), 0);

  inputs.equip = String(Math.round(totalWatts));
  updateDisplayValues();
  calculateLoad(false);
}

function resetAllFields(resetRoom = true) {
  inputs = { display: '0', people: '0', equip: '0' };

  // تصفير العدادات للأجهزة
  equipmentList.forEach(eq => eq.count = 0);

  if (resetRoom) {
    const select = document.getElementById('room-select');
    if (select && select.options.length) select.selectedIndex = 0;
  }

  renderEquipChecklist();
  updateDisplayValues();
  updateHistoryUI();
  calculateLoad(false);
}

// ---------- Tabs / Language / Settings ----------
function switchTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(id).classList.add('active');
  if (btn) btn.classList.add('active');
}

function toggleLanguage() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';

  const html = document.getElementById('html-tag');
  html.lang = currentLang;
  html.dir = currentLang === 'ar' ? 'rtl' : 'ltr';

  // static texts
  document.querySelectorAll('[data-ar]').forEach(el => {
    const txt = el.getAttribute(`data-${currentLang}`);
    if (txt !== null) el.textContent = txt;
  });

  updateLangUi();
  updateRoomSelect();
  renderEquipChecklist();
  updateHistoryUI();
  refreshRoomMeta();
  calculateLoad(false);
}

function updateLangUi() {
  const langText = document.getElementById('lang-text');
  if (langText) langText.textContent = currentLang === 'ar' ? 'English' : 'العربية';
}

function runDuctCalc() {
  const cfm = parseFloat(document.getElementById('targetCFM').value || '0') || 0;
  const w = parseFloat(document.getElementById('fixWidth').value || '12') || 12;

  if (!cfm || !w) {
    document.getElementById('duct-result').textContent = '---';
    return;
  }

  const h = estimateDuctHeight(cfm, w);
  document.getElementById('duct-result').textContent = `${toEnNum(w)}" x ${toEnNum(h)}"`;
}

// ---------- Utils ----------
function toEnNum(v) {
  return String(v).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
}

function normalizeNumString(v) {
  v = toEnNum(v);
  // keep only digits and one dot
  v = v.replace(/[^0-9.]/g, '');
  const parts = v.split('.');
  if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
  if (v.startsWith('.')) v = '0' + v;
  return v || '0';
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

// ---------- Fallback data (if data.json fails) ----------
function getInlineFallbackData() {
  return {
    categories: [
      {
        name_ar: "المستشفيات (ASHRAE 170)",
        name_en: "Hospitals (ASHRAE 170)",
        items: [
          { id:"h_or", ar:"غرفة عمليات (Class A)", en:"Operating / Procedure Room (Class A)", ach:15, med:true, sector:"hospital", standard:"ASHRAE 170", method:"ACH+People+Equip", factor:280, peopleCfm:15, exhaustBias:-10 },
          { id:"h_aii", ar:"عزل هوائي (AII)", en:"Airborne Infection Isolation Room (AII)", ach:12, med:true, sector:"hospital", standard:"ASHRAE 170", method:"ACH+People+Equip", factor:300, peopleCfm:15, exhaustBias:10 },
          { id:"h_pe", ar:"غرفة عزل إيجابي (PE)", en:"Protective Environment Room", ach:12, med:true, sector:"hospital", standard:"ASHRAE 170", method:"ACH+People+Equip", factor:280, peopleCfm:15, exhaustBias:-10 },
          { id:"h_exam", ar:"غرفة فحص", en:"Examination Room", ach:6, med:true, sector:"hospital", standard:"ASHRAE 170", method:"ACH+People+Equip", factor:320, peopleCfm:15, exhaustBias:0 },
          { id:"h_patient", ar:"غرفة مريض", en:"Patient Room", ach:6, med:true, sector:"hospital", standard:"ASHRAE 170", method:"ACH+People+Equip", factor:320, peopleCfm:15, exhaustBias:0 }
        ]
      },
      {
        name_ar: "التجاري",
        name_en: "Commercial",
        items: [
          { id:"c_office", ar:"مكتب", en:"Office", ach:4, med:false, sector:"commercial", standard:"Saudi Practice", method:"Airflow+Occupancy", factor:360, peopleCfm:12, exhaustBias:0 },
          { id:"c_shop", ar:"محل تجاري", en:"Retail Store", ach:6, med:false, sector:"commercial", standard:"Saudi Practice", method:"Airflow+Occupancy", factor:380, peopleCfm:10, exhaustBias:0 }
        ]
      },
      {
        name_ar: "السكني",
        name_en: "Residential",
        items: [
          { id:"r_living", ar:"صالة معيشة", en:"Living Room", ach:4, med:false, sector:"residential", standard:"Saudi Practice", method:"Airflow+Occupancy", factor:340, peopleCfm:10, exhaustBias:0 },
          { id:"r_bed", ar:"غرفة نوم", en:"Bedroom", ach:2, med:false, sector:"residential", standard:"Saudi Practice", method:"Airflow+Occupancy", factor:330, peopleCfm:8, exhaustBias:0 }
        ]
      }
    ]
  };
}