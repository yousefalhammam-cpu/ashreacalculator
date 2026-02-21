let currentLang = 'ar';
let activeField = 'display';
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];

// قاعدة الغرف (صحي = ASHRAE 170 / تجاري + سكني = سعودي شائع)
const roomCategories = [
  {
    key: 'hospital',
    name_ar: 'المستشفيات (ASHRAE 170)',
    name_en: 'Hospitals (ASHRAE 170)',
    calcMode: 'ashrae170',
    items: [
      { id: "h1", ar: "غرفة عمليات (OR)", en: "Operating Room (OR)", ach: 20, factor: 280, minCfmPerPerson: 20 },
      { id: "h2", ar: "عزل ضغط موجب (PE)", en: "Positive Pressure (PE)", ach: 12, factor: 320, minCfmPerPerson: 15 },
      { id: "h3", ar: "عزل ضغط سالب (AII)", en: "Negative Pressure (AII)", ach: 12, factor: 320, minCfmPerPerson: 15 },
      { id: "h4", ar: "العناية المركزة (ICU)", en: "Critical Care (ICU)", ach: 6, factor: 350, minCfmPerPerson: 15 },
      { id: "h5", ar: "غرفة الطوارئ (ترياج)", en: "Emergency (Triage)", ach: 12, factor: 330, minCfmPerPerson: 15 },
      { id: "h6", ar: "مختبر عام", en: "General Laboratory", ach: 6, factor: 380, minCfmPerPerson: 10 },
      { id: "h7", ar: "غرفة تنويم مريض", en: "Patient Room", ach: 6, factor: 340, minCfmPerPerson: 15 },
      { id: "h8", ar: "الأشعة التشخيصية", en: "Diagnostic X-Ray", ach: 6, factor: 420, minCfmPerPerson: 10 },
      { id: "h9", ar: "غرفة المناظير", en: "Endoscopy Room", ach: 15, factor: 320, minCfmPerPerson: 15 },
      { id: "h10", ar: "التعقيم المركزي (CSSD)", en: "Sterile Storage (CSSD)", ach: 10, factor: 300, minCfmPerPerson: 10 },
      { id: "h11", ar: "الصيدلية", en: "Pharmacy", ach: 4, factor: 360, minCfmPerPerson: 10 },
      { id: "h12", ar: "غرفة الولادة (LDR)", en: "Delivery Room (LDR)", ach: 15, factor: 300, minCfmPerPerson: 15 },
      { id: "h13", ar: "العلاج الطبيعي", en: "Physical Therapy", ach: 6, factor: 340, minCfmPerPerson: 15 },
      { id: "h14", ar: "غرفة فحص عامة", en: "Examination Room", ach: 6, factor: 360, minCfmPerPerson: 10 }
    ]
  },
  {
    key: 'commercial',
    name_ar: 'التجاري (سعودي)',
    name_en: 'Commercial (Saudi Practice)',
    calcMode: 'saudi_rot',
    items: [
      { id: "c1", ar: "مكاتب مفتوحة", en: "Open Offices", ach: 4, factor: 420, minCfmPerPerson: 10 },
      { id: "c2", ar: "غرفة اجتماعات", en: "Conference Room", ach: 10, factor: 350, minCfmPerPerson: 15 },
      { id: "c3", ar: "صالة مطعم", en: "Dining Area", ach: 10, factor: 330, minCfmPerPerson: 15 },
      { id: "c4", ar: "مطبخ تجاري", en: "Commercial Kitchen", ach: 30, factor: 500, minCfmPerPerson: 20 },
      { id: "c5", ar: "نادي رياضي", en: "Gym / Fitness Area", ach: 8, factor: 300, minCfmPerPerson: 20 },
      { id: "c6", ar: "قاعة سينما/مسرح", en: "Auditorium", ach: 15, factor: 320, minCfmPerPerson: 15 },
      { id: "c7", ar: "مكتبة عامة", en: "Library", ach: 4, factor: 380, minCfmPerPerson: 10 },
      { id: "c8", ar: "ردهة استقبال", en: "Lobby / Reception", ach: 4, factor: 380, minCfmPerPerson: 10 },
      { id: "c9", ar: "محلات تجارية", en: "Retail Store", ach: 6, factor: 380, minCfmPerPerson: 10 }
    ]
  },
  {
    key: 'residential',
    name_ar: 'المباني السكنية',
    name_en: 'Residential Buildings',
    calcMode: 'saudi_rot',
    items: [
      { id: "r1", ar: "غرفة معيشة", en: "Living Room", ach: 4, factor: 350, minCfmPerPerson: 10 },
      { id: "r2", ar: "غرفة نوم", en: "Bedroom", ach: 2, factor: 320, minCfmPerPerson: 8 },
      { id: "r3", ar: "مطبخ منزلي", en: "Domestic Kitchen", ach: 6, factor: 450, minCfmPerPerson: 10 },
      { id: "r4", ar: "دورة مياه", en: "Bathroom", ach: 10, factor: 300, minCfmPerPerson: 5 },
      { id: "r5", ar: "ممر داخلي", en: "Corridor", ach: 2, factor: 300, minCfmPerPerson: 5 },
      { id: "r6", ar: "مجلس ضيوف", en: "Majlis", ach: 5, factor: 400, minCfmPerPerson: 12 }
    ]
  }
];

// الأجهزة
const equipmentList = [
  { id: 'pc',  ar: '💻 كمبيوتر مكتب',      en: 'Desktop PC',      watts: 250,  count: 0 },
  { id: 'srv', ar: '🖥️ سيرفر',             en: 'Server',          watts: 1200, count: 0 },
  { id: 'med', ar: '🩺 جهاز طبي',          en: 'Medical Device',  watts: 400,  count: 0 },
  { id: 'mri', ar: '🧬 جهاز أشعة/رنين',    en: 'Imaging Device',  watts: 2500, count: 0 },
  { id: 'frg', ar: '🧊 ثلاجة',             en: 'Fridge',          watts: 600,  count: 0 },
  { id: 'tv',  ar: '📺 شاشة',              en: 'Screen',          watts: 200,  count: 0 },
  { id: 'cop', ar: '🖨️ طابعة/تصوير',       en: 'Copier',          watts: 800,  count: 0 }
];

window.onload = () => {
  updateRoomSelect();
  renderEquipChecklist();
  renderStandardsList();
  updateDisplayValues();
  focusField('display');
  syncLanguageUI();
  registerSW();
};

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(() => {});
  }
}

function updateRoomSelect() {
  const select = document.getElementById('room-select');
  if (!select) return;
  select.innerHTML = '';

  roomCategories.forEach(cat => {
    const group = document.createElement('optgroup');
    group.label = currentLang === 'ar' ? cat.name_ar : cat.name_en;

    cat.items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.dataset.cat = cat.key;
      opt.textContent = currentLang === 'ar' ? item.ar : item.en;
      group.appendChild(opt);
    });

    select.appendChild(group);
  });

  updateMethodNote();
}

function getSelectedRoom() {
  const select = document.getElementById('room-select');
  if (!select || !select.selectedOptions.length) return null;

  const selected = select.selectedOptions[0];
  const catKey = selected.dataset.cat;
  const category = roomCategories.find(c => c.key === catKey);
  if (!category) return null;

  const room = category.items.find(i => i.id === selected.value);
  if (!room) return null;

  return { category, room };
}

function calculateLoad(save = false) {
  const selected = getSelectedRoom();
  if (!selected) return;

  const { category, room } = selected;
  const volM3 = parseFloat(inputs.display) || 0;
  const people = parseInt(inputs.people) || 0;
  const watts = parseFloat(inputs.equip) || 0;

  // CFM من ACH
  const cfmFromACH = (volM3 * 35.3147 * room.ach) / 60;

  // تهوية الأشخاص
  const cfmPeople = people * (room.minCfmPerPerson || 10);

  // نحسب CFM النهائي
  let cfm = Math.round(cfmFromACH + cfmPeople);
  if (cfm < 0 || !isFinite(cfm)) cfm = 0;

  // طن تبريد (تقريبي)
  // السعودي/العملي: نعتمد factor أعلى قليلاً
  // الصحي: نراعي ACH كمرجعية ونستخدم factor طبي
  let totalBTU =
    (cfm * room.factor) +
    (people * 450) +
    (watts * 3.412);

  let tr = totalBTU / 12000;
  if (!isFinite(tr) || tr < 0) tr = 0;

  document.getElementById('cfm-result').textContent = `CFM ${cfm}`;
  document.getElementById('tr-result').textContent = `TR ${tr.toFixed(2)}`;

  if (save) {
    calcHistory.unshift({
      id: Date.now(),
      roomLabel: currentLang === 'ar' ? room.ar : room.en,
      categoryLabel: currentLang === 'ar' ? category.name_ar : category.name_en,
      cfm,
      tr: tr.toFixed(2),
      ach: room.ach,
      mode: category.calcMode
    });
    updateHistoryUI();
  }
}

function updateMethodNote() {
  const note = document.getElementById('method-note');
  const selected = getSelectedRoom();
  if (!note || !selected) return;

  const { category, room } = selected;

  if (currentLang === 'ar') {
    if (category.calcMode === 'ashrae170') {
      note.textContent = `الوضع: صحي — ASHRAE 170 + ACH (${room.ach})`;
    } else {
      note.textContent = `الوضع: ${category.key === 'commercial' ? 'تجاري' : 'سكني'} — Rule of Thumb سعودي + ACH (${room.ach})`;
    }
  } else {
    if (category.calcMode === 'ashrae170') {
      note.textContent = `Mode: Healthcare — ASHRAE 170 + ACH (${room.ach})`;
    } else {
      note.textContent = `Mode: ${category.key === 'commercial' ? 'Commercial' : 'Residential'} — Saudi Rule of Thumb + ACH (${room.ach})`;
    }
  }
}

function renderEquipChecklist() {
  const container = document.getElementById('equip-checklist');
  if (!container) return;

  container.innerHTML = equipmentList.map((item, idx) => `
    <div class="equip-item-row">
      <div>
        ${currentLang === 'ar' ? item.ar : item.en}
        <br><small style="color:#9ca3af">${item.watts} W</small>
      </div>
      <div class="counter-ctrl">
        <button class="counter-btn" onclick="changeCount(${idx}, -1)">−</button>
        <span id="cnt-${idx}" style="min-width:24px;text-align:center;display:inline-block;margin:0 8px;">${item.count}</span>
        <button class="counter-btn" onclick="changeCount(${idx}, 1)">+</button>
      </div>
    </div>
  `).join('');
}

function changeCount(idx, delta) {
  equipmentList[idx].count = Math.max(0, equipmentList[idx].count + delta);
  document.getElementById(`cnt-${idx}`).textContent = equipmentList[idx].count;

  const totalWatts = equipmentList.reduce((sum, item) => sum + item.watts * item.count, 0);
  inputs.equip = String(totalWatts);

  updateDisplayValues();
  calculateLoad(false);
}

function updateHistoryUI() {
  const mini = document.getElementById('history-list');
  const page = document.getElementById('history-list-page');

  const html = calcHistory.length
    ? calcHistory.map((item, index) => `
      <div class="swipe-item" onclick="deleteItem(${item.id})">
        <div class="info">
          <span style="color:#9ca3af;font-size:.72rem">#${calcHistory.length - index}</span>
          <span>${item.roomLabel}</span>
          <span style="color:#9ca3af;font-size:.72rem">${item.categoryLabel} • ACH ${item.ach}</span>
        </div>
        <div class="vals">
          <span class="tr-val">${item.tr} TR</span><br>
          <span>${item.cfm} CFM</span>
        </div>
      </div>
    `).join('')
    : `<div style="color:#9ca3af;padding:8px 0;">${currentLang === 'ar' ? 'لا يوجد سجل بعد' : 'No history yet'}</div>`;

  if (mini) mini.innerHTML = html;
  if (page) page.innerHTML = html;
}

function deleteItem(id) {
  const msg = currentLang === 'ar' ? 'حذف العملية؟' : 'Delete item?';
  if (confirm(msg)) {
    calcHistory = calcHistory.filter(i => i.id !== id);
    updateHistoryUI();
  }
}

function clearHistory() {
  const msg = currentLang === 'ar' ? 'مسح السجل بالكامل؟' : 'Clear all history?';
  if (confirm(msg)) {
    calcHistory = [];
    updateHistoryUI();
  }
}

function press(n) {
  const v = String(n);

  if (activeField === 'people') {
    if (v === '.') return; // الأشخاص أعداد صحيحة
  }

  if (inputs[activeField] === "0" && v !== ".") {
    inputs[activeField] = v;
  } else {
    // منع تكرار النقطة
    if (v === "." && inputs[activeField].includes(".")) return;
    inputs[activeField] += v;
  }

  updateDisplayValues();
  if (activeField === 'display' || activeField === 'people') calculateLoad(false);
}

function deleteLast() {
  let val = inputs[activeField] || "0";
  val = val.slice(0, -1);
  if (!val || val === "-") val = "0";
  inputs[activeField] = val;
  updateDisplayValues();
  calculateLoad(false);
}

function clearActiveField() {
  inputs[activeField] = "0";
  updateDisplayValues();
  calculateLoad(false);
}

function resetAllFields() {
  inputs = { display: "0", people: "0", equip: String(getEquipTotalWatts()) };
  updateDisplayValues();
  updateMethodNote();
  calculateLoad(false);
}

function getEquipTotalWatts() {
  return equipmentList.reduce((sum, item) => sum + (item.watts * item.count), 0);
}

function updateDisplayValues() {
  const d = document.getElementById('display');
  const peopleInput = document.getElementById('people-count');
  const equipInput = document.getElementById('equip-watts');

  if (d) d.textContent = inputs.display || "0";
  if (peopleInput) peopleInput.value = inputs.people || "0";
  if (equipInput) equipInput.value = inputs.equip || "0";
}

function focusField(field) {
  activeField = field;

  // تلوين التركيز
  document.getElementById('display')?.classList.remove('active-field');
  document.getElementById('people-count')?.classList.remove('active-field');
  document.getElementById('equip-watts')?.classList.remove('active-field');

  if (field === 'display') document.getElementById('display')?.classList.add('active-field');
  if (field === 'people') document.getElementById('people-count')?.classList.add('active-field');
  if (field === 'equip') document.getElementById('equip-watts')?.classList.add('active-field');
}

function openEquipModal() {
  document.getElementById('equip-modal').style.display = 'block';
  focusField('equip');
}
function closeEquipModal() {
  document.getElementById('equip-modal').style.display = 'none';
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
  html.lang = currentLang;
  html.dir = currentLang === 'ar' ? 'rtl' : 'ltr';

  // العناصر النصية data-ar/data-en
  document.querySelectorAll('[data-ar]').forEach(el => {
    el.textContent = el.getAttribute(currentLang === 'ar' ? 'data-ar' : 'data-en');
  });

  syncLanguageUI();
  updateRoomSelect();
  renderEquipChecklist();
  renderStandardsList();
  updateHistoryUI();
  updateMethodNote();
}

function syncLanguageUI() {
  const langBtn = document.getElementById('lang-text');
  if (langBtn) langBtn.textContent = currentLang === 'ar' ? 'English' : 'العربية';
}

function renderStandardsList() {
  const box = document.getElementById('standards-list');
  if (!box) return;

  const rows = [];

  roomCategories.forEach(cat => {
    cat.items.forEach(item => {
      rows.push(`
        <div class="std-row">
          <div>${currentLang === 'ar' ? item.ar : item.en}</div>
          <div style="color:#f2a53a;font-weight:700;">ACH ${item.ach}</div>
        </div>
      `);
    });
  });

  box.innerHTML = rows.join('');
}