let currentLang = 'ar';
let activeField = 'display';
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];
let roomData = { categories: [] };

// ارتفاع سقف افتراضي لتحويل الحجم (m3) إلى مساحة (m2)
const DEFAULT_CEILING_M = 3.0;

// قائمة أجهزة شاملة + تصنيف (healthcare/commercial/residential/shared)
const equipmentList = [
  // Shared
  { id: 'pc', ar: '💻 كمبيوتر مكتب', en: 'Desktop PC', watts: 200, count: 0, sectors: ['shared'] },
  { id: 'laptop', ar: '💻 لابتوب', en: 'Laptop', watts: 90, count: 0, sectors: ['shared'] },
  { id: 'screen', ar: '📺 شاشة', en: 'Monitor / Screen', watts: 80, count: 0, sectors: ['shared'] },
  { id: 'printer', ar: '🖨️ طابعة', en: 'Printer', watts: 500, count: 0, sectors: ['shared'] },
  { id: 'fridge_shared', ar: '🧊 ثلاجة صغيرة', en: 'Small Fridge', watts: 180, count: 0, sectors: ['shared'] },

  // Healthcare (أجهزة صحية)
  { id: 'med_general', ar: '🩺 جهاز طبي عام', en: 'Medical Device', watts: 400, count: 0, sectors: ['healthcare'] },
  { id: 'patient_monitor', ar: '📈 شاشة مراقبة مريض', en: 'Patient Monitor', watts: 120, count: 0, sectors: ['healthcare'] },
  { id: 'anesthesia', ar: '💨 جهاز تخدير', en: 'Anesthesia Machine', watts: 1200, count: 0, sectors: ['healthcare'] },
  { id: 'suction', ar: '🧪 جهاز شفط', en: 'Suction Unit', watts: 250, count: 0, sectors: ['healthcare'] },
  { id: 'infusion_pump', ar: '💉 مضخة محاليل', en: 'Infusion Pump', watts: 50, count: 0, sectors: ['healthcare'] },
  { id: 'ventilator', ar: '🫁 جهاز تنفس صناعي', en: 'Ventilator', watts: 300, count: 0, sectors: ['healthcare'] },
  { id: 'defibrillator', ar: '⚡ جهاز صدمات قلب', en: 'Defibrillator', watts: 200, count: 0, sectors: ['healthcare'] },
  { id: 'lab_analyzer', ar: '🧫 محلل مخبري', en: 'Lab Analyzer', watts: 900, count: 0, sectors: ['healthcare'] },
  { id: 'centrifuge', ar: '🧪 جهاز طرد مركزي', en: 'Centrifuge', watts: 600, count: 0, sectors: ['healthcare'] },
  { id: 'autoclave', ar: '🔥 أوتوكليف تعقيم', en: 'Autoclave', watts: 2000, count: 0, sectors: ['healthcare'] },
  { id: 'xray_equip', ar: '🩻 جهاز أشعة', en: 'X-Ray Equipment', watts: 2500, count: 0, sectors: ['healthcare'] },
  { id: 'ultrasound', ar: '🛰️ جهاز ألتراساوند', en: 'Ultrasound Unit', watts: 300, count: 0, sectors: ['healthcare'] },

  // Commercial
  { id: 'copier', ar: '🖨️ ماكينة تصوير', en: 'Copier', watts: 800, count: 0, sectors: ['commercial'] },
  { id: 'pos', ar: '🧾 جهاز نقاط بيع', en: 'POS System', watts: 120, count: 0, sectors: ['commercial'] },
  { id: 'display_light', ar: '💡 إضاءة عرض', en: 'Display Lighting', watts: 350, count: 0, sectors: ['commercial'] },
  { id: 'coffee_machine', ar: '☕ ماكينة قهوة', en: 'Coffee Machine', watts: 1400, count: 0, sectors: ['commercial'] },
  { id: 'oven', ar: '🔥 فرن', en: 'Oven', watts: 2500, count: 0, sectors: ['commercial'] },
  { id: 'freezer', ar: '🧊 فريزر', en: 'Freezer', watts: 500, count: 0, sectors: ['commercial'] },
  { id: 'grill', ar: '🍖 شواية كهربائية', en: 'Electric Grill', watts: 1800, count: 0, sectors: ['commercial'] },
  { id: 'showcase_fridge', ar: '🧃 ثلاجة عرض', en: 'Display Fridge', watts: 700, count: 0, sectors: ['commercial'] },
  { id: 'cash_drawer', ar: '💵 درج كاش', en: 'Cash Drawer', watts: 40, count: 0, sectors: ['commercial'] },

  // Residential
  { id: 'tv', ar: '📺 تلفزيون', en: 'TV', watts: 150, count: 0, sectors: ['residential'] },
  { id: 'home_fridge', ar: '🧊 ثلاجة منزلية', en: 'Home Fridge', watts: 250, count: 0, sectors: ['residential'] },
  { id: 'washing', ar: '🧺 غسالة', en: 'Washing Machine', watts: 700, count: 0, sectors: ['residential'] },
  { id: 'dryer', ar: '🌬️ نشافة', en: 'Dryer', watts: 1800, count: 0, sectors: ['residential'] },
  { id: 'microwave', ar: '🍲 مايكرويف', en: 'Microwave', watts: 1200, count: 0, sectors: ['residential'] },
  { id: 'electric_kettle', ar: '🫖 غلاية', en: 'Electric Kettle', watts: 1500, count: 0, sectors: ['residential'] },
  { id: 'dishwasher', ar: '🍽️ غسالة صحون', en: 'Dishwasher', watts: 1300, count: 0, sectors: ['residential'] },
  { id: 'home_oven', ar: '🔥 فرن منزلي', en: 'Home Oven', watts: 2000, count: 0, sectors: ['residential'] },
  { id: 'misc_house', ar: '🔌 أجهزة منزلية متنوعة', en: 'Misc Household Loads', watts: 300, count: 0, sectors: ['residential'] }
];

window.onload = async () => {
  await loadRoomData();
  updateRoomSelect();
  renderEquipChecklist();
  focusField('display');
  updateDisplayValues();
  registerServiceWorker();
};

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('./sw.js');
      console.log('SW registered');
    } catch (e) {
      console.warn('SW failed:', e);
    }
  }
}

async function loadRoomData() {
  try {
    const res = await fetch(`data.json?v=${Date.now()}`, { cache: 'no-store' });
    const txt = await res.text();
    const cleaned = txt.replace(/\bNaN\b/g, "null");
    const parsed = JSON.parse(cleaned);

    if (!parsed.categories || !Array.isArray(parsed.categories)) {
      throw new Error('Invalid data.json format');
    }

    roomData = parsed;
    console.log('Loaded data.json:', roomData.categories.length, 'categories');
  } catch (e) {
    console.error('Error loading data.json:', e);
    alert('Error loading data.json');
    roomData = { categories: [] };
  }
}

function updateRoomSelect() {
  const select = document.getElementById('room-select');
  if (!select) return;

  select.innerHTML = '';

  roomData.categories.forEach((cat, cIdx) => {
    const group = document.createElement('optgroup');
    group.label = currentLang === 'ar' ? cat.name_ar : cat.name_en;

    cat.items.forEach((room, rIdx) => {
      const opt = document.createElement('option');
      opt.value = room.id;
      opt.dataset.catIndex = cIdx;
      opt.dataset.roomIndex = rIdx;
      opt.innerText = currentLang === 'ar' ? room.ar : room.en;
      group.appendChild(opt);
    });

    select.appendChild(group);
  });

  if (select.options.length > 0) select.selectedIndex = 0;
}

function getSelectedRoom() {
  const select = document.getElementById('room-select');
  if (!select || select.selectedIndex < 0) return null;

  const opt = select.options[select.selectedIndex];
  const catIndex = Number(opt.dataset.catIndex);
  const roomIndex = Number(opt.dataset.roomIndex);

  const category = roomData.categories[catIndex];
  const room = category?.items?.[roomIndex];

  if (!category || !room) return null;
  return { category, room };
}

function detectSector(category) {
  const txt = ((category.name_en || '') + ' ' + (category.name_ar || '')).toLowerCase();
  if (txt.includes('hospital') || txt.includes('مستشفى')) return 'healthcare';
  if (txt.includes('commercial') || txt.includes('تجاري')) return 'commercial';
  if (txt.includes('residential') || txt.includes('سكن')) return 'residential';
  return 'commercial';
}

function calculateLoad(save = false) {
  const volM3 = parseFloat(inputs.display) || 0;
  const people = parseInt(inputs.people) || 0;
  const equipWatts = parseFloat(inputs.equip) || 0;

  const sel = getSelectedRoom();
  if (!sel) return;

  const { category, room } = sel;
  const sector = detectSector(category);

  const ceilingM = Number(room.ceiling_m || DEFAULT_CEILING_M);
  const areaM2 = ceilingM > 0 ? volM3 / ceilingM : 0;
  const areaFt2 = areaM2 * 10.7639;

  let cfm = 0;
  let methodLabel = '';
  let achShown = room.ach || 0;

  // 1) Healthcare (ASHRAE 170 - ACH)
  if (room.method === 'ashrae170_ach' || sector === 'healthcare') {
    cfm = ((volM3 * 35.3147 * (Number(room.ach) || 0)) / 60) + (people * 15);
    methodLabel = 'ASHRAE 170 (ACH)';
  }

  // 2) Commercial (ASHRAE 62.1 VRP) => Rp*P + Ra*A
  else if (room.method === 'ashrae62_1_vrp') {
    const rp = Number(room.rp || 0); // cfm/person
    const ra = Number(room.ra || 0); // cfm/ft²
    cfm = (rp * people) + (ra * areaFt2);

    // fallback لو ما فيه أشخاص
    if (cfm <= 0 && room.ach) {
      cfm = (volM3 * 35.3147 * Number(room.ach)) / 60;
    }

    methodLabel = 'ASHRAE 62.1 (VRP)';
  }

  // 3) Residential (ASHRAE 62.2 Approx)
  else if (room.method === 'ashrae62_2_res') {
    const occ = Math.max(1, people || 1);
    cfm = (0.03 * areaFt2) + (7.5 * occ);

    if (room.exhaust_boost_cfm) {
      cfm += Number(room.exhaust_boost_cfm);
    }

    if (!room.ach && volM3 > 0) {
      achShown = Math.round((((cfm * 60) / (volM3 * 35.3147)) * 10)) / 10;
    }

    methodLabel = 'ASHRAE 62.2 (Approx)';
  }

  // fallback
  else {
    cfm = ((volM3 * 35.3147 * (Number(room.ach) || 0)) / 60) + (people * 15);
    methodLabel = currentLang === 'ar' ? 'طريقة ACH' : 'ACH Method';
  }

  cfm = Math.max(0, Math.round(cfm));

  // عامل حراري (تقريبي عملي)
  const factor = Number(
    room.factor ||
    (sector === 'healthcare' ? 350 :
      sector === 'commercial' ? 400 : 350)
  );

  // TR تقريبي
  const tr = (((cfm * factor) + (people * 450) + (equipWatts * 3.41)) / 12000).toFixed(2);

  // Update UI
  const trEl = document.getElementById('tr-result');
  const cfmEl = document.getElementById('cfm-result');
  const targetCFM = document.getElementById('targetCFM');
  const hint = document.getElementById('field-hint');

  if (trEl) trEl.innerText = `${tr} TR`;
  if (cfmEl) cfmEl.innerText = `${cfm} CFM`;
  if (targetCFM) targetCFM.value = cfm;

  if (hint) {
    const roomName = currentLang === 'ar' ? room.ar : room.en;
    const achText = achShown ? ` • ACH: ${achShown}` : '';
    hint.innerText = `${roomName} • ${methodLabel}${achText}`;
  }

  if (save) {
    const duct = calcDuctQuick(cfm);
    calcHistory.push({
      id: Date.now(),
      room: currentLang === 'ar' ? room.ar : room.en,
      tr,
      cfm,
      method: methodLabel,
      duct
    });
    updateHistoryUI();
  }
}

function calcDuctQuick(cfm) {
  // سرعة تقريبية 800 fpm وعرض ثابت 12"
  const width = 12;
  const h = Math.max(4, Math.round(((cfm / 800) * 144) / width));
  return `${width}" x ${h}"`;
}

function runDuctCalc() {
  const cfm = parseFloat(document.getElementById('targetCFM')?.value || 0);
  const w = parseFloat(document.getElementById('fixWidth')?.value || 12);

  if (cfm > 0 && w > 0) {
    const h = Math.round((cfm / 800 * 144) / w);
    const out = document.getElementById('duct-result');
    if (out) out.innerText = `${w}" x ${Math.max(4, h)}"`;
  }
}

// ---------- Equipment ----------
function renderEquipChecklist() {
  const wrap = document.getElementById('equip-checklist');
  if (!wrap) return;

  const sel = getSelectedRoom();
  const sector = sel ? detectSector(sel.category) : 'commercial';

  const filtered = equipmentList.filter(item =>
    item.sectors.includes('shared') || item.sectors.includes(sector)
  );

  wrap.innerHTML = filtered.map((item) => {
    const idx = equipmentList.findIndex(x => x.id === item.id);
    return `
      <div class="equip-item-row">
        <div>
          ${currentLang === 'ar' ? item.ar : item.en}
          <br><small>${item.watts}W</small>
        </div>
        <div class="counter-ctrl">
          <button class="counter-btn" onclick="changeCount(${idx}, -1)">-</button>
          <span id="cnt-${idx}" style="margin:0 10px">${item.count}</span>
          <button class="counter-btn" onclick="changeCount(${idx}, 1)">+</button>
        </div>
      </div>
    `;
  }).join('');
}

function changeCount(idx, delta) {
  equipmentList[idx].count = Math.max(0, equipmentList[idx].count + delta);

  const countEl = document.getElementById(`cnt-${idx}`);
  if (countEl) countEl.innerText = equipmentList[idx].count;

  inputs.equip = equipmentList.reduce((sum, item) => sum + (item.watts * item.count), 0).toString();
  updateDisplayValues();
  calculateLoad(false);
}

// ---------- History ----------
function updateHistoryUI() {
  const container = document.getElementById('history-list');
  if (!container) return;

  const rows = [...calcHistory].reverse().map((item, index) => `
    <div class="swipe-item" onclick="deleteItem(${item.id})" title="${currentLang === 'ar' ? 'اضغط للحذف' : 'Tap to delete'}">
      <div class="info">
        <span style="color:#666;font-size:.72rem;">#${calcHistory.length - index}</span><br>
        <span>${item.room}</span><br>
        <small>${item.method}</small><br>
        <small>${currentLang === 'ar' ? 'الدكت' : 'Duct'}: ${item.duct}</small>
      </div>
      <div class="vals">
        <span class="tr-val">${item.tr} TR</span><br>
        <span class="cfm-val">${item.cfm} CFM</span>
      </div>
    </div>
  `).join('');

  container.innerHTML = rows;
}

function deleteItem(id) {
  const ok = confirm(currentLang === 'ar' ? 'حذف العملية؟' : 'Delete this calculation?');
  if (!ok) return;

  calcHistory = calcHistory.filter(item => item.id !== id);
  updateHistoryUI();
}

function clearHistory() {
  if (calcHistory.length === 0) return;
  const ok = confirm(currentLang === 'ar' ? 'مسح السجل بالكامل؟' : 'Clear all history?');
  if (!ok) return;
  calcHistory = [];
  updateHistoryUI();
}

// ---------- Input / Keypad ----------
function press(n) {
  if (inputs[activeField] === "0") inputs[activeField] = n.toString();
  else inputs[activeField] += n.toString();

  updateDisplayValues();
}

function deleteLast() {
  inputs[activeField] = inputs[activeField].slice(0, -1) || "0";
  updateDisplayValues();
}

function clearActiveField() {
  inputs[activeField] = "0";
  updateDisplayValues();
}

function updateDisplayValues() {
  const d = document.getElementById('display');
  const p = document.getElementById('people-count');
  const e = document.getElementById('equip-watts');

  if (d) d.innerText = inputs.display || "0";
  if (p) p.value = inputs.people || "0";
  if (e) e.value = inputs.equip || "0";
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

function resetAllFields() {
  inputs = { display: "0", people: "0", equip: "0" };

  equipmentList.forEach(item => item.count = 0);

  updateDisplayValues();
  renderEquipChecklist();

  const trEl = document.getElementById('tr-result');
  const cfmEl = document.getElementById('cfm-result');
  if (trEl) trEl.innerText = '0 TR';
  if (cfmEl) cfmEl.innerText = '0 CFM';

  calculateLoad(false);
}

// ---------- Modal ----------
function openEquipModal() {
  renderEquipChecklist(); // فلترة حسب نوع الغرفة الحالي
  const modal = document.getElementById('equip-modal');
  if (modal) modal.style.display = 'block';
}
function closeEquipModal() {
  const modal = document.getElementById('equip-modal');
  if (modal) modal.style.display = 'none';
}

// ---------- Tabs ----------
function switchTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(id)?.classList.add('active');
  btn?.classList.add('active');
}

// ---------- Language ----------
function toggleLanguage() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';

  const html = document.getElementById('html-tag');
  if (html) {
    html.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    html.lang = currentLang;
  }

  document.querySelectorAll('[data-ar]').forEach(el => {
    const val = el.getAttribute(`data-${currentLang}`);
    if (val !== null) el.innerText = val;
  });

  const langText = document.getElementById('lang-text');
  if (langText) langText.innerText = currentLang === 'ar' ? 'English' : 'العربية';

  // تحديث نص زر الإغلاق في المودال (لأنه data-attrs)
  updateRoomSelect();
  renderEquipChecklist();
  updateHistoryUI();
  calculateLoad(false);
}