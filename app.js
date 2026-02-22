let currentLang = 'ar';
let activeField = 'display';
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];

// قاعدة الغرف (صحية + تجاري + سكني)
// ملاحظة: health = صحي (ASHRAE), commercial/residential = عملي شائع
const roomCategories = [
  {
    key: "healthcare",
    name_ar: "المستشفيات (ASHRAE)",
    name_en: "Healthcare (ASHRAE)",
    items: [
      { id: "or", ar: "غرفة عمليات (OR)", en: "Operating Room (OR)", ach: 20, factor: 280, med: true },
      { id: "aii", ar: "عزل ضغط سالب (AII)", en: "Negative Pressure (AII)", ach: 12, factor: 320, med: true },
      { id: "pe", ar: "عزل ضغط موجب (PE)", en: "Positive Pressure (PE)", ach: 12, factor: 300, med: true },
      { id: "icu", ar: "العناية المركزة (ICU)", en: "ICU", ach: 6, factor: 340, med: true },
      { id: "er", ar: "غرفة طوارئ", en: "Emergency / Triage", ach: 12, factor: 330, med: true },
      { id: "patient", ar: "غرفة تنويم مريض", en: "Patient Room", ach: 6, factor: 360, med: true },
      { id: "lab", ar: "مختبر عام", en: "General Laboratory", ach: 6, factor: 390, med: true },
      { id: "endo", ar: "غرفة مناظير", en: "Endoscopy Room", ach: 15, factor: 310, med: true },
      { id: "xray", ar: "أشعة تشخيصية", en: "Diagnostic X-Ray", ach: 6, factor: 420, med: true },
      { id: "cssd", ar: "تعقيم مركزي (CSSD)", en: "CSSD", ach: 10, factor: 340, med: true },
      { id: "pharmacy", ar: "صيدلية", en: "Pharmacy", ach: 4, factor: 360, med: true },
      { id: "exam", ar: "غرفة فحص", en: "Examination Room", ach: 6, factor: 350, med: true },
      { id: "delivery", ar: "غرفة ولادة (LDR)", en: "Delivery Room (LDR)", ach: 15, factor: 300, med: true }
    ]
  },
  {
    key: "commercial",
    name_ar: "التجاري",
    name_en: "Commercial",
    items: [
      { id: "office", ar: "مكاتب مفتوحة", en: "Open Offices", ach: 4, factor: 380, med: false },
      { id: "meeting", ar: "غرفة اجتماعات", en: "Conference Room", ach: 10, factor: 340, med: false },
      { id: "restaurant", ar: "صالة مطعم", en: "Dining Area", ach: 10, factor: 330, med: false },
      { id: "retail", ar: "محل تجاري", en: "Retail Store", ach: 6, factor: 370, med: false },
      { id: "gym", ar: "نادي رياضي", en: "Gym / Fitness", ach: 8, factor: 320, med: false },
      { id: "lobby", ar: "ردهة استقبال", en: "Lobby / Reception", ach: 4, factor: 360, med: false },
      { id: "commercial_kitchen", ar: "مطبخ تجاري", en: "Commercial Kitchen", ach: 30, factor: 280, med: false },
      { id: "auditorium", ar: "قاعة", en: "Auditorium", ach: 15, factor: 320, med: false }
    ]
  },
  {
    key: "residential",
    name_ar: "السكني",
    name_en: "Residential",
    items: [
      { id: "living", ar: "غرفة معيشة", en: "Living Room", ach: 4, factor: 350, med: false },
      { id: "bedroom", ar: "غرفة نوم", en: "Bedroom", ach: 2, factor: 340, med: false },
      { id: "majlis", ar: "مجلس", en: "Majlis", ach: 5, factor: 370, med: false },
      { id: "kitchen", ar: "مطبخ منزلي", en: "Domestic Kitchen", ach: 6, factor: 380, med: false },
      { id: "bathroom", ar: "دورة مياه", en: "Bathroom", ach: 10, factor: 300, med: false },
      { id: "corridor", ar: "ممر", en: "Corridor", ach: 2, factor: 340, med: false }
    ]
  }
];

// قائمة الأجهزة حسب القطاع (مع أجهزة مشتركة)
const equipmentCatalog = [
  // مشتركة
  { id: "pc", ar: "💻 كمبيوتر", en: "Desktop PC", watts: 250, tags: ["common", "commercial", "healthcare"] },
  { id: "laptop", ar: "💻 لابتوب", en: "Laptop", watts: 90, tags: ["common", "commercial", "healthcare", "residential"] },
  { id: "monitor", ar: "🖥️ شاشة", en: "Monitor", watts: 45, tags: ["common", "commercial", "healthcare", "residential"] },
  { id: "printer", ar: "🖨️ طابعة", en: "Printer", watts: 600, tags: ["commercial", "healthcare"] },
  { id: "fridge", ar: "🧊 ثلاجة", en: "Fridge", watts: 250, tags: ["common", "commercial", "residential", "healthcare"] },

  // صحي
  { id: "patient_monitor", ar: "🩺 شاشة مراقبة مريض", en: "Patient Monitor", watts: 120, tags: ["healthcare"] },
  { id: "ventilator", ar: "🫁 جهاز تنفس", en: "Ventilator", watts: 300, tags: ["healthcare"] },
  { id: "infusion_pump", ar: "💉 مضخة سوائل", en: "Infusion Pump", watts: 30, tags: ["healthcare"] },
  { id: "ultrasound_device", ar: "🩻 جهاز ألتراساوند", en: "Ultrasound Device", watts: 400, tags: ["healthcare"] },
  { id: "xray_console", ar: "🩻 كونسل أشعة", en: "X-Ray Console", watts: 1200, tags: ["healthcare"] },
  { id: "lab_analyzer", ar: "🧪 جهاز مختبر", en: "Lab Analyzer", watts: 800, tags: ["healthcare"] },
  { id: "sterilizer", ar: "♨️ جهاز تعقيم", en: "Sterilizer", watts: 2000, tags: ["healthcare"] },

  // تجاري
  { id: "pos", ar: "🧾 جهاز كاشير", en: "POS System", watts: 120, tags: ["commercial"] },
  { id: "display_sign", ar: "📺 شاشة عرض", en: "Display Sign", watts: 180, tags: ["commercial"] },
  { id: "coffee_machine", ar: "☕ ماكينة قهوة", en: "Coffee Machine", watts: 1500, tags: ["commercial"] },
  { id: "commercial_oven", ar: "🔥 فرن تجاري", en: "Commercial Oven", watts: 3000, tags: ["commercial"] },

  // سكني
  { id: "tv", ar: "📺 تلفزيون", en: "TV", watts: 150, tags: ["residential"] },
  { id: "washing_machine", ar: "🧺 غسالة", en: "Washing Machine", watts: 700, tags: ["residential"] },
  { id: "microwave", ar: "🍽️ مايكرويف", en: "Microwave", watts: 1200, tags: ["residential"] },
  { id: "router", ar: "📡 راوتر", en: "Router", watts: 15, tags: ["residential", "commercial", "healthcare"] }
];

// العدادات الحالية لكل جهاز
const equipmentCounts = {};
equipmentCatalog.forEach(e => equipmentCounts[e.id] = 0);

window.onload = () => {
  updateRoomSelect();
  renderEquipChecklist();
  updateDisplayValues();
  focusField('display');
  applyLanguageTexts();
};

// ====== HELPERS ======
function getSelectedRoom() {
  const select = document.getElementById('room-select');
  const val = select.value;
  for (const cat of roomCategories) {
    const room = cat.items.find(r => r.id === val);
    if (room) return { ...room, categoryKey: cat.key, categoryNameAr: cat.name_ar, categoryNameEn: cat.name_en };
  }
  return null;
}

function getCategoryName(cat) {
  return currentLang === 'ar' ? cat.name_ar : cat.name_en;
}

function formatNum(n, digits = 0) {
  const num = Number(n || 0);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits
  });
}

// ====== ROOM SELECT ======
function updateRoomSelect() {
  const select = document.getElementById('room-select');
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = '';

  roomCategories.forEach(cat => {
    const group = document.createElement('optgroup');
    group.label = getCategoryName(cat);

    cat.items.forEach(room => {
      const opt = document.createElement('option');
      opt.value = room.id;
      opt.innerText = currentLang === 'ar' ? room.ar : room.en;
      group.appendChild(opt);
    });

    select.appendChild(group);
  });

  // استرجاع القيمة إذا موجودة
  if (currentValue) {
    const exists = [...select.options].some(o => o.value === currentValue);
    if (exists) select.value = currentValue;
  }

  // لو أول مرة
  if (!select.value && select.options.length) {
    select.selectedIndex = 0;
  }
}

function onRoomChange() {
  // ✅ تصفير كامل عند تغيير الغرفة (كما اتفقنا)
  resetAllFields();
  renderEquipChecklist(); // تحديث قائمة الأجهزة حسب القطاع
  calculateLoad(false);   // تحديث النتائج بصفر
}

// ====== CALCULATION ======
function calculateLoad(save = false) {
  const room = getSelectedRoom();
  if (!room) return;

  const vol = parseFloat(inputs.display) || 0;   // m3
  const people = parseInt(inputs.people) || 0;
  const watts = parseFloat(inputs.equip) || 0;

  // CFM = (Volume m3 -> ft3) * ACH / 60 + people ventilation
  const cfmFromACH = ((vol * 35.3147) * room.ach) / 60;
  const cfmPeople = people * 15;
  const cfm = Math.max(0, Math.round(cfmFromACH + cfmPeople));

  // BTU/h = (CFM × factor) + people sensible + equipment watts to BTU
  // معامل factor مختلف حسب الغرفة (محافظة ومعقول)
  const btuRaw = (cfm * room.factor) + (people * 450) + (watts * 3.412);
  const btu = Math.max(0, Math.round(btuRaw));

  // TR
  const tr = btu / 12000;

  // تحديث الواجهة
  const trEl = document.getElementById('tr-result');
  const btuEl = document.getElementById('btu-result');
  const cfmEl = document.getElementById('cfm-result');

  trEl.innerText = `${formatNum(tr, 2)} TR`;
  btuEl.innerText = `${formatNum(btu)} BTU/h`;
  cfmEl.innerText = `${formatNum(cfm)} CFM`;

  if (save) {
    const ductW = 12;
    const ductH = cfm > 0 ? Math.max(4, Math.round((cfm / 800 * 144) / ductW)) : 0;
    const ductSize = cfm > 0 ? `${ductW}" x ${ductH}"` : '—';

    calcHistory.unshift({
      id: Date.now(),
      room: currentLang === 'ar' ? room.ar : room.en,
      volume: vol,
      people,
      equipW: watts,
      ach: room.ach,
      cfm,
      btu,
      tr: Number(tr.toFixed(2)),
      duct: ductSize
    });

    // حد أعلى للسجل
    if (calcHistory.length > 30) calcHistory.pop();

    updateHistoryUI();
  }
}

// ====== EQUIPMENT ======
function getAllowedEquipmentForSelectedRoom() {
  const room = getSelectedRoom();
  if (!room) return [];

  const sector = room.categoryKey; // healthcare/commercial/residential
  return equipmentCatalog.filter(eq => eq.tags.includes(sector) || eq.tags.includes("common"));
}

function renderEquipChecklist() {
  const container = document.getElementById('equip-checklist');
  if (!container) return;

  const allowed = getAllowedEquipmentForSelectedRoom();

  container.innerHTML = allowed.map((item) => `
    <div class="equip-item-row">
      <div>
        ${currentLang === 'ar' ? item.ar : item.en}
        <br><small style="color:#8e8e93">${formatNum(item.watts)}W</small>
      </div>
      <div class="counter-ctrl">
        <button class="counter-btn" onclick="changeCount('${item.id}', -1)">-</button>
        <span id="cnt-${item.id}" style="margin:0 10px">${equipmentCounts[item.id] || 0}</span>
        <button class="counter-btn" onclick="changeCount('${item.id}', 1)">+</button>
      </div>
    </div>
  `).join('');
}

function changeCount(id, delta) {
  equipmentCounts[id] = Math.max(0, (equipmentCounts[id] || 0) + delta);

  const span = document.getElementById(`cnt-${id}`);
  if (span) span.innerText = equipmentCounts[id];

  // مجموع الواط فقط من كل الأجهزة
  const totalWatts = equipmentCatalog.reduce((sum, item) => {
    return sum + (item.watts * (equipmentCounts[item.id] || 0));
  }, 0);

  inputs.equip = String(totalWatts);
  updateDisplayValues();
  calculateLoad(false);
}

function openEquipModal() {
  const modal = document.getElementById('equip-modal');
  if (!modal) return;
  renderEquipChecklist();
  modal.style.display = 'block';
}

function closeEquipModal() {
  const modal = document.getElementById('equip-modal');
  if (!modal) return;
  modal.style.display = 'none';
}

// ====== HISTORY ======
function updateHistoryUI() {
  const container = document.getElementById('history-list');
  if (!container) return;

  if (!calcHistory.length) {
    container.innerHTML = `<div class="empty-history">${currentLang === 'ar' ? 'لا يوجد سجل بعد' : 'No history yet'}</div>`;
    return;
  }

  container.innerHTML = calcHistory.map((item, idx) => `
    <div class="swipe-item">
      <div class="info">
        <div class="hist-title">#${formatNum(calcHistory.length - idx)} - ${item.room}</div>
        <div class="hist-sub">
          V: ${formatNum(item.volume, 1)} m³ | P: ${formatNum(item.people)} | W: ${formatNum(item.equipW)}W | ACH: ${formatNum(item.ach)}
        </div>
        <div class="hist-sub">
          Duct: ${item.duct}
        </div>
      </div>
      <div class="vals" style="text-align:left">
        <span class="tr-val">${formatNum(item.tr,2)} TR</span><br>
        <span class="cfm-val">${formatNum(item.cfm)} CFM</span><br>
        <span class="btu-val">${formatNum(item.btu)} BTU</span><br>
        <button class="delete-history-btn" onclick="deleteItem(${item.id})">${currentLang === 'ar' ? 'حذف' : 'Delete'}</button>
      </div>
    </div>
  `).join('');
}

function deleteItem(id) {
  if (confirm(currentLang === 'ar' ? 'حذف العملية؟' : 'Delete record?')) {
    calcHistory = calcHistory.filter(i => i.id !== id);
    updateHistoryUI();
  }
}

function clearHistory() {
  if (confirm(currentLang === 'ar' ? 'مسح السجل؟' : 'Clear history?')) {
    calcHistory = [];
    updateHistoryUI();
  }
}

// ====== INPUT / CALC UI ======
function press(n) {
  const char = String(n);

  if (char === '.' && inputs[activeField].includes('.')) return;

  if (inputs[activeField] === "0" && char !== '.') {
    inputs[activeField] = char;
  } else {
    inputs[activeField] += char;
  }

  // منع أرقام غير منطقية في people (بدون كسور)
  if (activeField === 'people') {
    inputs.people = inputs.people.replace(/\./g, '');
  }

  updateDisplayValues();
  calculateLoad(false);
}

function deleteLast() {
  let val = inputs[activeField] || "0";
  val = val.slice(0, -1);
  if (!val || val === "-" || val === ".") val = "0";
  inputs[activeField] = val;
  updateDisplayValues();
  calculateLoad(false);
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
  const disp = document.getElementById('display');
  const people = document.getElementById('people-count');
  const equip = document.getElementById('equip-watts');

  if (disp) disp.innerText = inputs.display || "0";
  if (people) people.value = inputs.people || "0";
  if (equip) equip.value = inputs.equip || "0";
}

function resetAllFields() {
  inputs = { display: "0", people: "0", equip: "0" };

  // تصفير عدادات الأجهزة
  Object.keys(equipmentCounts).forEach(k => equipmentCounts[k] = 0);

  updateDisplayValues();

  // تصفير النتائج
  document.getElementById('tr-result').innerText = '0.00 TR';
  document.getElementById('btu-result').innerText = '0 BTU/h';
  document.getElementById('cfm-result').innerText = '0 CFM';

  focusField('display');
}

// ====== TABS / LANGUAGE ======
function switchTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(id)?.classList.add('active');
  btn?.classList.add('active');
}

function toggleLanguage() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';

  // اتجاه الصفحة (مع بقاء الأرقام إنجليزي)
  document.getElementById('html-tag').setAttribute('dir', currentLang === 'ar' ? 'rtl' : 'ltr');

  applyLanguageTexts();
  updateRoomSelect();
  renderEquipChecklist();
  updateHistoryUI();
}

function applyLanguageTexts() {
  document.querySelectorAll('[data-ar]').forEach(el => {
    el.innerText = currentLang === 'ar' ? el.getAttribute('data-ar') : el.getAttribute('data-en');
  });

  const langText = document.getElementById('lang-text');
  if (langText) langText.innerText = currentLang === 'ar' ? 'English' : 'العربية';
}