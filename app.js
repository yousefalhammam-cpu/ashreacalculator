let currentLang = 'ar';
let activeField = 'display'; // display | people
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];

// ===== قاعدة الغرف (صحي/تجاري/سكني) =====
// ملاحظة:
// - healthcare: نستخدم ACH بأسلوب ASHRAE 170 لحساب CFM
// - commercial/residential: أسلوب عملي (ACH + Rule of Thumb)
const roomDatabase = {
  healthcare: [
    { id: "or", ar: "غرفة عمليات (OR)", en: "Operating Room (OR)", ach: 20, factor: 0, standard: "ASHRAE 170" },
    { id: "hybrid_or", ar: "غرفة عمليات هجينة", en: "Hybrid OR", ach: 20, factor: 0, standard: "ASHRAE 170" },
    { id: "icu", ar: "العناية المركزة (ICU)", en: "ICU", ach: 12, factor: 0, standard: "ASHRAE 170" },
    { id: "er_trauma", ar: "طوارئ / إنعاش", en: "ER Trauma / Resus", ach: 12, factor: 0, standard: "ASHRAE 170" },
    { id: "aiir", ar: "عزل ضغط سالب (AIIR)", en: "AIIR (Negative Pressure)", ach: 12, factor: 0, standard: "ASHRAE 170" },
    { id: "pe", ar: "عزل ضغط موجب (PE)", en: "Protective Environment", ach: 12, factor: 0, standard: "ASHRAE 170" },
    { id: "endo", ar: "غرفة المناظير", en: "Endoscopy Room", ach: 15, factor: 0, standard: "ASHRAE 170" },
    { id: "lab", ar: "مختبر طبي عام", en: "General Lab", ach: 6, factor: 0, standard: "ASHRAE 170" },
    { id: "patient_room", ar: "غرفة مريض", en: "Patient Room", ach: 6, factor: 0, standard: "ASHRAE 170" },
    { id: "xray", ar: "أشعة تشخيصية", en: "Diagnostic X-Ray", ach: 6, factor: 0, standard: "ASHRAE 170" },
    { id: "cssd", ar: "تعقيم مركزي (CSSD)", en: "CSSD", ach: 10, factor: 0, standard: "ASHRAE 170" },
    { id: "pharmacy", ar: "صيدلية", en: "Pharmacy", ach: 4, factor: 0, standard: "ASHRAE 170" }
  ],
  commercial: [
    { id: "open_office", ar: "مكاتب مفتوحة", en: "Open Offices", ach: 4, factor: 320, standard: "Practical + ASHRAE 62.1" },
    { id: "conference", ar: "غرفة اجتماعات", en: "Conference Room", ach: 8, factor: 380, standard: "Practical + ASHRAE 62.1" },
    { id: "retail", ar: "محل تجاري", en: "Retail Store", ach: 6, factor: 360, standard: "Practical + ASHRAE 62.1" },
    { id: "restaurant", ar: "صالة مطعم", en: "Dining Area", ach: 10, factor: 420, standard: "Practical + ASHRAE 62.1" },
    { id: "commercial_kitchen", ar: "مطبخ تجاري", en: "Commercial Kitchen", ach: 20, factor: 600, standard: "Practical + ASHRAE 62.1" },
    { id: "gym", ar: "نادي رياضي", en: "Gym", ach: 8, factor: 450, standard: "Practical + ASHRAE 62.1" },
    { id: "lobby", ar: "ردهة استقبال", en: "Lobby / Reception", ach: 4, factor: 320, standard: "Practical + ASHRAE 62.1" }
  ],
  residential: [
    { id: "living", ar: "غرفة معيشة", en: "Living Room", ach: 2, factor: 260, standard: "Saudi Practical" },
    { id: "bedroom", ar: "غرفة نوم", en: "Bedroom", ach: 2, factor: 220, standard: "Saudi Practical" },
    { id: "majlis", ar: "مجلس ضيوف", en: "Majlis", ach: 4, factor: 320, standard: "Saudi Practical" },
    { id: "kitchen", ar: "مطبخ منزلي", en: "Domestic Kitchen", ach: 6, factor: 420, standard: "Saudi Practical" },
    { id: "bathroom", ar: "دورة مياه", en: "Bathroom", ach: 10, factor: 200, standard: "Saudi Practical" },
    { id: "corridor", ar: "ممر داخلي", en: "Corridor", ach: 2, factor: 150, standard: "Saudi Practical" }
  ]
};

const categoryNames = {
  healthcare: { ar: "المستشفيات (ASHRAE 170)", en: "Hospitals (ASHRAE 170)" },
  commercial: { ar: "التجاري", en: "Commercial" },
  residential: { ar: "السكني", en: "Residential" }
};

// ===== الأجهزة (فلترة حسب القطاع + مشتركة) =====
const equipmentCatalog = [
  // shared
  { id: "pc", sectors: ["shared"], ar: "كمبيوتر مكتبي", en: "Desktop PC", watts: 200, count: 0 },
  { id: "laptop", sectors: ["shared"], ar: "لابتوب", en: "Laptop", watts: 90, count: 0 },
  { id: "monitor", sectors: ["shared"], ar: "شاشة", en: "Monitor", watts: 40, count: 0 },
  { id: "printer", sectors: ["shared"], ar: "طابعة", en: "Printer", watts: 600, count: 0 },
  { id: "fridge_small", sectors: ["shared"], ar: "ثلاجة صغيرة", en: "Small Fridge", watts: 150, count: 0 },
  { id: "tv", sectors: ["shared"], ar: "شاشة تلفاز", en: "TV Screen", watts: 120, count: 0 },

  // healthcare
  { id: "anesthesia", sectors: ["healthcare"], ar: "جهاز تخدير", en: "Anesthesia Machine", watts: 1200, count: 0 },
  { id: "or_lights", sectors: ["healthcare"], ar: "إضاءة عمليات", en: "OR Surgical Lights", watts: 300, count: 0 },
  { id: "ventilator", sectors: ["healthcare"], ar: "جهاز تنفس صناعي", en: "Ventilator", watts: 300, count: 0 },
  { id: "patient_monitor", sectors: ["healthcare"], ar: "شاشة مراقبة مريض", en: "Patient Monitor", watts: 80, count: 0 },
  { id: "infusion_pump", sectors: ["healthcare"], ar: "مضخة محاليل", en: "Infusion Pump", watts: 35, count: 0 },
  { id: "defibrillator", sectors: ["healthcare"], ar: "جهاز صدمات قلبية", en: "Defibrillator", watts: 250, count: 0 },
  { id: "autoclave", sectors: ["healthcare"], ar: "أوتوكليف تعقيم", en: "Autoclave", watts: 3000, count: 0 },
  { id: "lab_analyzer", sectors: ["healthcare"], ar: "جهاز تحليل مخبري", en: "Lab Analyzer", watts: 500, count: 0 },
  { id: "centrifuge", sectors: ["healthcare"], ar: "جهاز طرد مركزي", en: "Centrifuge", watts: 350, count: 0 },
  { id: "xray_machine", sectors: ["healthcare"], ar: "جهاز أشعة X-Ray", en: "X-Ray Unit", watts: 2000, count: 0 },
  { id: "ultrasound", sectors: ["healthcare"], ar: "جهاز ألتراساوند", en: "Ultrasound", watts: 250, count: 0 },
  { id: "endoscopy_tower", sectors: ["healthcare"], ar: "برج منظار", en: "Endoscopy Tower", watts: 1000, count: 0 },
  { id: "medical_fridge", sectors: ["healthcare"], ar: "ثلاجة طبية", en: "Medical Fridge", watts: 300, count: 0 },

  // commercial
  { id: "pos", sectors: ["commercial"], ar: "نقطة بيع POS", en: "POS Terminal", watts: 80, count: 0 },
  { id: "display_fridge", sectors: ["commercial"], ar: "ثلاجة عرض", en: "Display Fridge", watts: 500, count: 0 },
  { id: "freezer", sectors: ["commercial"], ar: "فريزر تجاري", en: "Commercial Freezer", watts: 700, count: 0 },
  { id: "espresso", sectors: ["commercial"], ar: "ماكينة قهوة", en: "Espresso Machine", watts: 1500, count: 0 },
  { id: "oven", sectors: ["commercial"], ar: "فرن تجاري", en: "Commercial Oven", watts: 5000, count: 0 },
  { id: "grill", sectors: ["commercial"], ar: "شواية كهربائية", en: "Electric Grill", watts: 3500, count: 0 },
  { id: "fryer", sectors: ["commercial"], ar: "قلاية تجارية", en: "Commercial Fryer", watts: 4500, count: 0 },
  { id: "mixer", sectors: ["commercial"], ar: "خلاط صناعي", en: "Industrial Mixer", watts: 800, count: 0 },
  { id: "ice_maker", sectors: ["commercial"], ar: "صانعة ثلج", en: "Ice Maker", watts: 600, count: 0 },
  { id: "server_rack", sectors: ["commercial"], ar: "راك سيرفر", en: "Server Rack", watts: 1200, count: 0 },

  // residential
  { id: "split_ac_misc", sectors: ["residential"], ar: "أجهزة منزلية أخرى", en: "Home Appliances (Misc.)", watts: 500, count: 0 },
  { id: "washing", sectors: ["residential"], ar: "غسالة", en: "Washing Machine", watts: 800, count: 0 },
  { id: "dryer", sectors: ["residential"], ar: "نشافة", en: "Dryer", watts: 2500, count: 0 },
  { id: "microwave", sectors: ["residential"], ar: "ميكرويف", en: "Microwave", watts: 1200, count: 0 },
  { id: "kettle", sectors: ["residential"], ar: "غلاية", en: "Kettle", watts: 1800, count: 0 },
  { id: "home_fridge", sectors: ["residential"], ar: "ثلاجة منزلية", en: "Home Fridge", watts: 250, count: 0 },
  { id: "dishwasher", sectors: ["residential"], ar: "غسالة صحون", en: "Dishwasher", watts: 1200, count: 0 }
];

// ===== Init =====
window.addEventListener('load', () => {
  updateRoomSelect();
  renderEquipChecklist();
  focusField('display');
  updateDisplayValues();
  calculateLoad(false);
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});

// ===== Helpers =====
function getSelectedRoom() {
  const select = document.getElementById('room-select');
  if (!select || select.selectedIndex < 0) return null;
  const opt = select.options[select.selectedIndex];
  const catKey = opt.dataset.cat;
  const room = roomDatabase[catKey].find(r => r.id === select.value);
  return { room, catKey };
}

function updateRoomSelect() {
  const select = document.getElementById('room-select');
  if (!select) return;

  const prev = getSelectedRoom();
  const prevId = prev?.room?.id || null;

  select.innerHTML = '';

  for (const [catKey, rooms] of Object.entries(roomDatabase)) {
    const group = document.createElement('optgroup');
    group.label = currentLang === 'ar' ? categoryNames[catKey].ar : categoryNames[catKey].en;

    rooms.forEach(r => {
      const o = document.createElement('option');
      o.value = r.id;
      o.dataset.cat = catKey;
      o.textContent = currentLang === 'ar' ? r.ar : r.en;
      group.appendChild(o);
    });

    select.appendChild(group);
  }

  if (prevId) {
    const target = [...select.options].find(o => o.value === prevId);
    if (target) select.value = prevId;
  }
}

function onRoomChange() {
  // نعيد أعداد الأجهزة فقط لأن نوع الأجهزة يتغير حسب الغرفة
  equipmentCatalog.forEach(e => e.count = 0);
  inputs.equip = "0";
  renderEquipChecklist();
  updateDisplayValues();
  calculateLoad(false);
}

function getFilteredEquipments() {
  const selected = getSelectedRoom();
  const catKey = selected?.catKey || 'commercial';
  return equipmentCatalog.filter(item =>
    item.sectors.includes('shared') || item.sectors.includes(catKey)
  );
}

function renderEquipChecklist() {
  const container = document.getElementById('equip-checklist');
  if (!container) return;

  const filtered = getFilteredEquipments();

  container.innerHTML = filtered.map(item => {
    const idx = equipmentCatalog.findIndex(e => e.id === item.id);
    return `
      <div class="equip-item-row">
        <div>
          <div class="equip-item-name">${currentLang === 'ar' ? item.ar : item.en}</div>
          <div class="equip-item-meta">${item.watts} W</div>
        </div>
        <div class="counter-ctrl">
          <button class="counter-btn" onclick="changeCount('${item.id}', -1)">-</button>
          <span class="counter-num" id="cnt-${idx}">${item.count}</span>
          <button class="counter-btn" onclick="changeCount('${item.id}', 1)">+</button>
        </div>
      </div>
    `;
  }).join('');
}

function changeCount(itemId, delta) {
  const item = equipmentCatalog.find(e => e.id === itemId);
  if (!item) return;
  item.count = Math.max(0, item.count + delta);

  const totalWatts = equipmentCatalog.reduce((sum, e) => sum + (e.watts * e.count), 0);
  inputs.equip = String(totalWatts);
  updateDisplayValues();
  renderEquipChecklist();
  calculateLoad(false);
}

function updateDisplayValues() {
  document.getElementById('display').textContent = inputs.display || "0";
  document.getElementById('people-count').value = inputs.people || "0";
  document.getElementById('equip-watts').value = inputs.equip || "0";
}

function focusField(field) {
  activeField = field;
  document.getElementById('display-wrap').style.borderColor = field === 'display' ? 'var(--accent)' : '#444';
  document.getElementById('people-count').style.borderColor = field === 'people' ? 'var(--accent)' : '#313543';
}

function press(n) {
  const val = String(n);

  if (activeField === 'display') {
    if (val === '.' && inputs.display.includes('.')) return;
    if (inputs.display === "0" && val !== '.') inputs.display = val;
    else inputs.display += val;
  } else if (activeField === 'people') {
    if (val === '.') return; // أشخاص أعداد صحيحة
    if (inputs.people === "0") inputs.people = val;
    else inputs.people += val;
  }

  updateDisplayValues();
}

function deleteLast() {
  if (activeField === 'display') {
    inputs.display = inputs.display.slice(0, -1) || "0";
  } else if (activeField === 'people') {
    inputs.people = inputs.people.slice(0, -1) || "0";
  }
  updateDisplayValues();
}

function clearActiveField() {
  if (activeField === 'display') inputs.display = "0";
  if (activeField === 'people') inputs.people = "0";
  updateDisplayValues();
  calculateLoad(false);
}

function resetAllFields() {
  inputs = { display: "0", people: "0", equip: "0" };
  equipmentCatalog.forEach(e => e.count = 0);
  renderEquipChecklist();
  updateDisplayValues();
  calculateLoad(false);
}

function openEquipModal() {
  renderEquipChecklist();
  document.getElementById('equip-modal').style.display = 'block';
}
function closeEquipModal() {
  document.getElementById('equip-modal').style.display = 'none';
}

// ===== الحسابات (مضبوطة) =====
function calculateLoad(save = false) {
  try {
    const volM3 = parseFloat(inputs.display) || 0;
    const people = parseInt(inputs.people) || 0;
    const equipWatts = parseFloat(inputs.equip) || 0;

    const selected = getSelectedRoom();
    if (!selected || !selected.room) return;
    const { room, catKey } = selected;

    const volFt3 = volM3 * 35.3147;
    const ach = Number(room.ach || 0);

    let cfm = 0;
    let totalBTU = 0;

    if (catKey === 'healthcare') {
      // CFM من ACH (ASHRAE 170) + تهوية أشخاص خفيفة
      const cfmAch = (volFt3 * ach) / 60;
      const cfmPeople = people * 15;
      cfm = Math.round(cfmAch + cfmPeople);

      // حمل الهواء + أشخاص + أجهزة + إضاءة
      const deltaT = 18; // °F
      const airBTU = 1.08 * cfm * deltaT;
      const peopleBTU = people * 450;
      const equipBTU = equipWatts * 3.412;
      const lightingBTU = volM3 * 8 * 3.412;

      totalBTU = (airBTU + peopleBTU + equipBTU + lightingBTU) * 1.08;
    } else if (catKey === 'commercial') {
      // عملي ومناسب للسعودية (Rule of Thumb + ACH)
      const cfmAch = (volFt3 * ach) / 60;
      const cfmPeople = people * 15;
      const cfmByTRApprox = (volM3 * (room.factor || 350)) / 12000 * 400; // 400 CFM/ton
      cfm = Math.round(Math.max(cfmAch + cfmPeople, cfmByTRApprox));

      const roomFactorBTU = volM3 * (room.factor || 350);
      const peopleBTU = people * 600;
      const equipBTU = equipWatts * 3.412;

      totalBTU = (roomFactorBTU + peopleBTU + equipBTU) * 1.05;
    } else {
      // residential
      const cfmAch = (volFt3 * ach) / 60;
      const cfmPeople = people * 10;
      const cfmByTRApprox = (volM3 * (room.factor || 260)) / 12000 * 400;
      cfm = Math.round(Math.max(cfmAch + cfmPeople, cfmByTRApprox));

      const roomFactorBTU = volM3 * (room.factor || 260);
      const peopleBTU = people * 450;
      const equipBTU = equipWatts * 3.412;

      totalBTU = (roomFactorBTU + peopleBTU + equipBTU) * 1.05;
    }

    if (!isFinite(cfm) || cfm < 0) cfm = 0;
    if (!isFinite(totalBTU) || totalBTU < 0) totalBTU = 0;

    const tr = totalBTU / 12000;
    const suggestedBTU = getSuggestedMarketBTU(totalBTU);

    // Duct size تقريبي
    const duct = getDuctSize(cfm, 12);

    // UI
    document.getElementById('tr-result').textContent = `TR ${tr.toFixed(2)}`;
    document.getElementById('cfm-result').textContent = `CFM ${Math.round(cfm)}`;
    document.getElementById('btu-result').textContent = `BTU/h ${formatNum(Math.round(totalBTU))}`;

    document.getElementById('suggested-btu').textContent =
      currentLang === 'ar'
        ? `المقترح: ${formatNum(suggestedBTU)} BTU`
        : `Suggested: ${formatNum(suggestedBTU)} BTU`;

    document.getElementById('chip-standard').textContent =
      currentLang === 'ar'
        ? (catKey === 'healthcare' ? 'ASHRAE 170 (صحي)' : catKey === 'commercial' ? 'تجاري (عملي)' : 'سكني (عملي)')
        : (catKey === 'healthcare' ? 'ASHRAE 170 (Healthcare)' : catKey === 'commercial' ? 'Commercial (Practical)' : 'Residential (Practical)');

    document.getElementById('chip-ach').textContent = `ACH: ${ach}`;
    document.getElementById('chip-duct').textContent = `Duct: ${duct}`;

    document.getElementById('mode-badge').textContent =
      currentLang === 'ar'
        ? `${room.ar} • ${room.standard} • ACH: ${ach}`
        : `${room.en} • ${room.standard} • ACH: ${ach}`;

    if (save) {
      calcHistory.push({
        id: Date.now(),
        room: currentLang === 'ar' ? room.ar : room.en,
        cfm: Math.round(cfm),
        tr: tr.toFixed(2),
        btu: Math.round(totalBTU),
        suggestedBTU,
        duct
      });
      updateHistoryUI();
    }

  } catch (e) {
    console.error('calculateLoad error:', e);
  }
}

function getSuggestedMarketBTU(totalBTU) {
  const sizes = [9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000, 72000, 96000, 120000, 144000, 180000, 240000];
  return sizes.find(s => s >= totalBTU) || Math.ceil(totalBTU / 6000) * 6000;
}

function getDuctSize(cfm, widthIn = 12) {
  if (!cfm || cfm <= 0) return '--';
  const vel = 800; // fpm تقريبي
  const areaFt2 = cfm / vel;
  const areaIn2 = areaFt2 * 144;
  const h = Math.max(6, Math.round(areaIn2 / widthIn));
  return `${widthIn}" x ${h}"`;
}

function formatNum(n) {
  return Number(n).toLocaleString(currentLang === 'ar' ? 'ar-SA' : 'en-US');
}

// ===== History =====
function updateHistoryUI() {
  const container = document.getElementById('history-list');
  if (!container) return;

  container.innerHTML = [...calcHistory].reverse().map((item, idx) => `
    <div class="swipe-item" onclick="deleteItem(${item.id})" title="${currentLang === 'ar' ? 'اضغط للحذف' : 'Tap to delete'}">
      <div class="info">
        <span style="color:#7f8594;font-size:.75rem">#${calcHistory.length - idx}</span>
        <span>${item.room}</span>
        <span style="color:#9aa0ad;font-size:.75rem">${item.duct ? `Duct: ${item.duct}` : ''}</span>
      </div>
      <div class="vals">
        <span class="tr-val">${item.tr} TR</span><br>
        <span>${item.cfm} CFM</span><br>
        <span>${formatNum(item.btu)} BTU/h</span>
      </div>
    </div>
  `).join('');
}

function deleteItem(id) {
  const msg = currentLang === 'ar' ? 'حذف هذا السجل؟' : 'Delete this entry?';
  if (confirm(msg)) {
    calcHistory = calcHistory.filter(i => i.id !== id);
    updateHistoryUI();
  }
}

function clearHistory() {
  const msg = currentLang === 'ar' ? 'مسح كل السجل؟' : 'Clear all history?';
  if (confirm(msg)) {
    calcHistory = [];
    updateHistoryUI();
  }
}

// ===== Tabs =====
function switchTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  if (btn) btn.classList.add('active');
}

// ===== Language =====
function toggleLanguage() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';

  const html = document.getElementById('html-tag');
  html.lang = currentLang;
  html.dir = currentLang === 'ar' ? 'rtl' : 'ltr';

  document.querySelectorAll('[data-ar]').forEach(el => {
    el.textContent = el.getAttribute(currentLang === 'ar' ? 'data-ar' : 'data-en');
  });

  document.getElementById('lang-text').textContent = currentLang === 'ar' ? 'English' : 'العربية';

  updateRoomSelect();
  renderEquipChecklist();
  updateDisplayValues();
  updateHistoryUI();
  calculateLoad(false);
}

// ===== Export =====
function exportCSV() {
  if (!calcHistory.length) {
    alert(currentLang === 'ar' ? 'لا يوجد سجل للتصدير' : 'No history to export');
    return;
  }

  const rows = [
    ['Room', 'TR', 'CFM', 'BTU/h', 'Suggested BTU', 'Duct'],
    ...calcHistory.map(i => [i.room, i.tr, i.cfm, i.btu, i.suggestedBTU, i.duct || ''])
  ];

  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadFile('aircalc-history.csv', csv, 'text/csv;charset=utf-8;');
}

function exportJSON() {
  if (!calcHistory.length) {
    alert(currentLang === 'ar' ? 'لا يوجد سجل للتصدير' : 'No history to export');
    return;
  }
  downloadFile('aircalc-history.json', JSON.stringify(calcHistory, null, 2), 'application/json');
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}