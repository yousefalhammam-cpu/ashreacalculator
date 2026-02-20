let currentLang = 'ar';
let activeField = 'display';
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];
let roomCatalog = null;

// --- Equipment list (editable) ---
const equipmentList = [
  { id: 'pc', ar: '💻 كمبيوتر مكتب', en: 'Desktop PC', watts: 250, count: 0 },
  { id: 'srv', ar: '🖥️ سيرفر', en: 'Server', watts: 1200, count: 0 },
  { id: 'med', ar: '🩺 جهاز طبي عام', en: 'Medical Device', watts: 400, count: 0 },
  { id: 'mri', ar: '🧬 جهاز أشعة/رنين', en: 'Imaging Equip', watts: 2500, count: 0 },
  { id: 'frg', ar: '🧊 ثلاجة', en: 'Fridge', watts: 600, count: 0 },
  { id: 'tv', ar: '📺 شاشة عرض', en: 'Display Screen', watts: 200, count: 0 },
  { id: 'cop', ar: '🖨️ طابعة/تصوير', en: 'Copier', watts: 800, count: 0 }
];

// Fallback data if data.json fails
const INLINE_DATA = {
  categories: [
    {
      name_ar: "المستشفيات (ASHRAE 170)",
      name_en: "Hospitals (ASHRAE 170)",
      items: [
        { id: "h1", ar: "غرفة عمليات (OR)", en: "Operating Room (OR)", ach: 20, med: true },
        { id: "h2", ar: "عزل ضغط موجب (PE)", en: "Positive Pressure (PE)", ach: 12, med: true },
        { id: "h3", ar: "عزل ضغط سالب (AII)", en: "Negative Pressure (AII)", ach: 12, med: true },
        { id: "h4", ar: "العناية المركزة (ICU)", en: "Critical Care (ICU)", ach: 6, med: true },
        { id: "h5", ar: "غرفة الطوارئ (ترياج)", en: "Emergency (Triage)", ach: 12, med: true },
        { id: "h6", ar: "مختبر عام", en: "General Laboratory", ach: 6, med: true },
        { id: "h7", ar: "غرفة تنويم مريض", en: "Patient Room", ach: 6, med: true },
        { id: "h8", ar: "الأشعة التشخيصية", en: "Diagnostic X-Ray", ach: 6, med: true },
        { id: "h9", ar: "غرفة المناظير", en: "Endoscopy Room", ach: 15, med: true },
        { id: "h10", ar: "التعقيم المركزي (CSSD)", en: "Sterile Storage (CSSD)", ach: 10, med: true },
        { id: "h11", ar: "الصيدلية", en: "Pharmacy", ach: 4, med: true },
        { id: "h12", ar: "غرفة الولادة (LDR)", en: "Delivery Room (LDR)", ach: 15, med: true },
        { id: "h13", ar: "العلاج الطبيعي", en: "Physical Therapy", ach: 6, med: true },
        { id: "h14", ar: "غرفة فحص عامة", en: "Examination Room", ach: 6, med: true }
      ]
    },
    {
      name_ar: "التجاري (معمول به بالسعودية)",
      name_en: "Commercial (Saudi Practice)",
      items: [
        { id: "c1", ar: "مكاتب مفتوحة", en: "Open Offices", ach: 4, med: false, btu_m3: 320 },
        { id: "c2", ar: "غرفة اجتماعات", en: "Conference Room", ach: 10, med: false, btu_m3: 380 },
        { id: "c3", ar: "صالة مطعم", en: "Dining Area", ach: 10, med: false, btu_m3: 400 },
        { id: "c4", ar: "مطبخ تجاري", en: "Commercial Kitchen", ach: 30, med: false, btu_m3: 700 },
        { id: "c5", ar: "نادي رياضي", en: "Gym / Fitness Area", ach: 8, med: false, btu_m3: 450 },
        { id: "c6", ar: "قاعة سينما/مسرح", en: "Auditorium", ach: 15, med: false, btu_m3: 420 },
        { id: "c7", ar: "مكتبة عامة", en: "Library", ach: 4, med: false, btu_m3: 300 },
        { id: "c8", ar: "ردهة استقبال", en: "Lobby / Reception", ach: 4, med: false, btu_m3: 320 },
        { id: "c9", ar: "محلات تجارية", en: "Retail Store", ach: 6, med: false, btu_m3: 360 }
      ]
    },
    {
      name_ar: "المباني السكنية",
      name_en: "Residential Buildings",
      items: [
        { id: "r1", ar: "غرفة معيشة", en: "Living Room", ach: 4, med: false, btu_m3: 300 },
        { id: "r2", ar: "غرفة نوم", en: "Bedroom", ach: 2, med: false, btu_m3: 260 },
        { id: "r3", ar: "مطبخ منزلي", en: "Domestic Kitchen", ach: 6, med: false, btu_m3: 420 },
        { id: "r4", ar: "دورة مياه", en: "Bathroom", ach: 10, med: false, btu_m3: 220 },
        { id: "r5", ar: "ممر داخلي", en: "Corridor", ach: 2, med: false, btu_m3: 180 }
      ]
    }
  ]
};

window.onload = async () => {
  await loadRoomCatalog();
  updateRoomSelect();
  renderEquipChecklist();
  updateDisplayValues();
  focusField('display');

  // Register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
};

async function loadRoomCatalog() {
  try {
    const res = await fetch(`./data.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error('data.json not found');
    const txt = await res.text();
    roomCatalog = JSON.parse(txt);
  } catch (e) {
    console.warn('Using inline fallback data:', e);
    roomCatalog = INLINE_DATA;
  }
}

function updateRoomSelect() {
  const select = document.getElementById('room-select');
  if (!select || !roomCatalog?.categories) return;

  select.innerHTML = '';

  roomCatalog.categories.forEach((cat) => {
    const group = document.createElement('optgroup');
    group.label = currentLang === 'ar' ? cat.name_ar : cat.name_en;

    cat.items.forEach((room) => {
      const opt = document.createElement('option');
      opt.value = room.id;
      opt.dataset.med = room.med ? '1' : '0';
      opt.dataset.ach = room.ach ?? '';
      opt.dataset.btu = room.btu_m3 ?? '';
      opt.dataset.nameAr = room.ar;
      opt.dataset.nameEn = room.en;
      opt.textContent = currentLang === 'ar' ? room.ar : room.en;
      group.appendChild(opt);
    });

    select.appendChild(group);
  });
}

function getSelectedRoom() {
  const select = document.getElementById('room-select');
  if (!select || select.selectedIndex < 0) return null;
  return select.options[select.selectedIndex];
}

// Main calculation
function calculateLoad(save = false) {
  const volumeM3 = parseFloat(inputs.display) || 0;
  const people = parseInt(inputs.people) || 0;
  const equipWatts = parseFloat(inputs.equip) || 0;
  const opt = getSelectedRoom();

  if (!opt || volumeM3 <= 0) {
    document.getElementById('tr-result').innerText = '0 TR';
    document.getElementById('cfm-result').innerText = '0 CFM';
    return;
  }

  const isMedical = opt.dataset.med === '1';
  const ach = parseFloat(opt.dataset.ach) || 0;
  const btuM3 = parseFloat(opt.dataset.btu) || 0;

  let cfm = 0;
  let tr = 0;
  let ductSize = '—';

  if (isMedical) {
    // --- Hospital / ASHRAE style ---
    // CFM = volume(ft3) * ACH / 60
    const volumeFt3 = volumeM3 * 35.3147;
    cfm = Math.round((volumeFt3 * ach) / 60);

    // add sensible loads
    const extraCFM = people * 15; // rough OA/sensible proxy
    cfm += extraCFM;

    const btuFromAir = cfm * 1.08 * 20;   // ΔT ~20°F rough field estimate
    const btuPeople = people * 450;
    const btuEquip = equipWatts * 3.412;
    const totalBTU = btuFromAir + btuPeople + btuEquip;

    tr = totalBTU / 12000;
  } else {
    // --- Commercial/Residential (common Saudi field practice) ---
    // Base room load from volume
    const btuRoom = volumeM3 * btuM3;
    const btuPeople = people * 600;        // harsher assumption for hot climate
    const btuEquip = equipWatts * 3.412;
    const totalBTU = btuRoom + btuPeople + btuEquip;

    tr = totalBTU / 12000;

    // Approx airflow from tonnage (400 CFM / TR)
    cfm = Math.round(tr * 400);
  }

  tr = Number(tr.toFixed(2));

  document.getElementById('tr-result').innerText = `${tr} TR`;
  document.getElementById('cfm-result').innerText = `${cfm} CFM`;

  // suggested duct at ~800 fpm with fixed width 12"
  ductSize = suggestDuctSize(cfm, 12);

  if (save) {
    const roomName = currentLang === 'ar' ? opt.dataset.nameAr : opt.dataset.nameEn;
    calcHistory.push({
      id: Date.now(),
      room: roomName,
      tr,
      cfm,
      duct: ductSize
    });
    updateHistoryUI();
  }
}

function suggestDuctSize(cfm, widthIn = 12) {
  if (!cfm || cfm <= 0) return '—';
  // Area(in²)= CFM / 800 * 144
  const area = (cfm / 800) * 144;
  const h = Math.max(6, Math.round(area / widthIn));
  return `${widthIn}" x ${h}"`;
}

// UI Helpers
function renderEquipChecklist() {
  const el = document.getElementById('equip-checklist');
  if (!el) return;

  el.innerHTML = equipmentList.map((item, idx) => `
    <div class="equip-item-row">
      <div>
        ${currentLang === 'ar' ? item.ar : item.en}
        <br><small>${item.watts}W</small>
      </div>
      <div class="counter-ctrl">
        <button class="counter-btn" onclick="changeCount(${idx}, -1)">-</button>
        <span id="cnt-${idx}" class="counter-val">${item.count}</span>
        <button class="counter-btn" onclick="changeCount(${idx}, 1)">+</button>
      </div>
    </div>
  `).join('');
}

function changeCount(idx, delta) {
  equipmentList[idx].count = Math.max(0, equipmentList[idx].count + delta);
  document.getElementById(`cnt-${idx}`).innerText = equipmentList[idx].count;

  const totalWatts = equipmentList.reduce((sum, item) => sum + (item.watts * item.count), 0);
  inputs.equip = String(totalWatts);

  updateDisplayValues();
  calculateLoad(false);
}

function updateHistoryUI() {
  const container = document.getElementById('history-list');
  if (!container) return;

  if (!calcHistory.length) {
    container.innerHTML = `<div class="empty-history">${currentLang === 'ar' ? 'لا يوجد سجل بعد' : 'No history yet'}</div>`;
    return;
  }

  const rows = [...calcHistory].reverse().map((item, idx) => `
    <div class="swipe-item" onclick="deleteItem(${item.id})" title="${currentLang === 'ar' ? 'اضغط للحذف' : 'Tap to delete'}">
      <div class="info">
        <span class="hist-no">#${calcHistory.length - idx}</span>
        <span class="hist-room">${item.room}</span>
        <span class="hist-duct">${currentLang === 'ar' ? 'دكت مقترح:' : 'Duct:'} ${item.duct}</span>
      </div>
      <div class="vals">
        <span class="tr-val">${item.tr} TR</span>
        <span class="cfm-val">${item.cfm} CFM</span>
      </div>
    </div>
  `);

  container.innerHTML = rows.join('');
}

function deleteItem(id) {
  const ok = confirm(currentLang === 'ar' ? 'حذف العملية؟' : 'Delete this item?');
  if (!ok) return;
  calcHistory = calcHistory.filter(i => i.id !== id);
  updateHistoryUI();
}

function clearHistory() {
  const ok = confirm(currentLang === 'ar' ? 'مسح كل السجل؟' : 'Clear all history?');
  if (!ok) return;
  calcHistory = [];
  updateHistoryUI();
}

function press(n) {
  const val = String(n);

  if (val === '.' && inputs[activeField].includes('.')) return;

  if (inputs[activeField] === "0" && val !== '.') {
    inputs[activeField] = val;
  } else {
    inputs[activeField] += val;
  }

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
  const display = document.getElementById('display');
  const people = document.getElementById('people-count');
  const equip = document.getElementById('equip-watts');

  if (display) display.innerText = inputs.display || "0";
  if (people) people.value = inputs.people || "0";
  if (equip) equip.value = inputs.equip || "0";
}

function focusField(field) {
  activeField = field;

  // remove active from all
  document.getElementById('display')?.classList.remove('active-field');
  document.getElementById('people-count')?.classList.remove('active-field');
  document.getElementById('equip-watts')?.classList.remove('active-field');

  // add active to selected
  if (field === 'display') document.getElementById('display')?.classList.add('active-field');
  if (field === 'people') document.getElementById('people-count')?.classList.add('active-field');
  if (field === 'equip') document.getElementById('equip-watts')?.classList.add('active-field');
}

function switchTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(id)?.classList.add('active');
  btn.classList.add('active');
}

function openEquipModal() {
  document.getElementById('equip-modal').style.display = 'block';
  focusField('equip');
}

function closeEquipModal() {
  document.getElementById('equip-modal').style.display = 'none';
}

function toggleLanguage() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';

  const html = document.getElementById('html-tag');
  html.lang = currentLang;
  html.dir = currentLang === 'ar' ? 'rtl' : 'ltr';

  document.querySelectorAll('[data-ar]').forEach(el => {
    const txt = el.getAttribute(`data-${currentLang}`);
    if (txt) el.innerText = txt;
  });

  // language button label
  const langText = document.getElementById('lang-text');
  if (langText) langText.innerText = currentLang === 'ar' ? 'English' : 'العربية';

  // buttons without data-attrs
  const clearBtn = document.querySelector('.clear-history-btn');
  if (clearBtn) clearBtn.innerText = currentLang === 'ar' ? 'مسح' : 'Clear';

  const closeBtn = document.querySelector('.close-modal-btn');
  if (closeBtn) closeBtn.innerText = currentLang === 'ar' ? 'تم' : 'Done';

  updateRoomSelect();
  renderEquipChecklist();
  updateHistoryUI();
}

function resetAllFields() {
  inputs = { display: "0", people: "0", equip: "0" };
  equipmentList.forEach(i => i.count = 0);

  renderEquipChecklist();
  updateDisplayValues();
  calculateLoad(false);

  focusField('display');
}