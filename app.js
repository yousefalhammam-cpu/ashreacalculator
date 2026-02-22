/* Air Calc Pro - app.js (full) */

let currentLang = 'ar';
let activeField = 'display';
let showMethodChip = true;

let inputs = {
  display: "0", // room volume m3
  people: "0",
  equip: "0" // watts
};

let calcHistory = [];
let lastCalcSummary = null;

/* -------------------- Room Database -------------------- */
/* Hospital = ASHRAE 170 style (ACH-based)
   Commercial / Residential = practical + ACH / rule-of-thumb hybrid */
const roomDatabase = {
  hospital: [
    { id: 'or', ar: 'غرفة عمليات (OR)', en: 'Operating Room (OR)', ach: 20, standard_ar: 'ASHRAE 170', standard_en: 'ASHRAE 170', mode: 'ashrae170', factor: 330 },
    { id: 'endo', ar: 'غرفة المناظير', en: 'Endoscopy Room', ach: 15, standard_ar: 'ASHRAE 170', standard_en: 'ASHRAE 170', mode: 'ashrae170', factor: 320 },
    { id: 'icu', ar: 'العناية المركزة (ICU)', en: 'ICU', ach: 6, standard_ar: 'ASHRAE 170', standard_en: 'ASHRAE 170', mode: 'ashrae170', factor: 300 },
    { id: 'aii', ar: 'عزل ضغط سالب (AII)', en: 'Negative Pressure (AII)', ach: 12, standard_ar: 'ASHRAE 170', standard_en: 'ASHRAE 170', mode: 'ashrae170', factor: 320 },
    { id: 'pe', ar: 'عزل ضغط موجب (PE)', en: 'Positive Pressure (PE)', ach: 12, standard_ar: 'ASHRAE 170', standard_en: 'ASHRAE 170', mode: 'ashrae170', factor: 320 },
    { id: 'triage', ar: 'طوارئ/فرز', en: 'Emergency / Triage', ach: 12, standard_ar: 'ASHRAE 170', standard_en: 'ASHRAE 170', mode: 'ashrae170', factor: 310 },
    { id: 'lab', ar: 'مختبر عام', en: 'General Laboratory', ach: 6, standard_ar: 'ASHRAE 170', standard_en: 'ASHRAE 170', mode: 'ashrae170', factor: 300 },
    { id: 'patient', ar: 'غرفة تنويم مريض', en: 'Patient Room', ach: 6, standard_ar: 'ASHRAE 170', standard_en: 'ASHRAE 170', mode: 'ashrae170', factor: 280 },
    { id: 'xray', ar: 'الأشعة التشخيصية', en: 'Diagnostic X-Ray', ach: 6, standard_ar: 'ASHRAE 170', standard_en: 'ASHRAE 170', mode: 'ashrae170', factor: 380 },
    { id: 'ldr', ar: 'غرفة الولادة (LDR)', en: 'Delivery Room (LDR)', ach: 15, standard_ar: 'ASHRAE 170', standard_en: 'ASHRAE 170', mode: 'ashrae170', factor: 320 }
  ],
  commercial: [
    { id: 'open_office', ar: 'مكاتب مفتوحة', en: 'Open Offices', ach: 4, standard_ar: 'قاعدة عملية (تجاري)', standard_en: 'Practical Commercial', mode: 'commercial', factor: 420 },
    { id: 'conference', ar: 'غرفة اجتماعات', en: 'Conference Room', ach: 10, standard_ar: 'قاعدة عملية (تجاري)', standard_en: 'Practical Commercial', mode: 'commercial', factor: 350 },
    { id: 'retail', ar: 'محل تجاري', en: 'Retail Store', ach: 6, standard_ar: 'قاعدة عملية (تجاري)', standard_en: 'Practical Commercial', mode: 'commercial', factor: 380 },
    { id: 'restaurant', ar: 'صالة مطعم', en: 'Dining Area', ach: 10, standard_ar: 'قاعدة عملية (تجاري)', standard_en: 'Practical Commercial', mode: 'commercial', factor: 340 },
    { id: 'gym', ar: 'نادي رياضي', en: 'Gym', ach: 8, standard_ar: 'قاعدة عملية (تجاري)', standard_en: 'Practical Commercial', mode: 'commercial', factor: 300 },
    { id: 'lobby', ar: 'ردهة استقبال', en: 'Lobby / Reception', ach: 4, standard_ar: 'قاعدة عملية (تجاري)', standard_en: 'Practical Commercial', mode: 'commercial', factor: 400 }
  ],
  residential: [
    { id: 'bedroom', ar: 'غرفة نوم', en: 'Bedroom', ach: 2, standard_ar: 'قاعدة عملية (سكني)', standard_en: 'Practical Residential', mode: 'residential', factor: 320 },
    { id: 'living', ar: 'غرفة معيشة', en: 'Living Room', ach: 4, standard_ar: 'قاعدة عملية (سكني)', standard_en: 'Practical Residential', mode: 'residential', factor: 350 },
    { id: 'majlis', ar: 'مجلس ضيوف', en: 'Majlis', ach: 5, standard_ar: 'قاعدة عملية (سكني)', standard_en: 'Practical Residential', mode: 'residential', factor: 400 },
    { id: 'kitchen', ar: 'مطبخ منزلي', en: 'Domestic Kitchen', ach: 6, standard_ar: 'قاعدة عملية (سكني)', standard_en: 'Practical Residential', mode: 'residential', factor: 450 },
    { id: 'bath', ar: 'دورة مياه', en: 'Bathroom', ach: 10, standard_ar: 'قاعدة عملية (سكني)', standard_en: 'Practical Residential', mode: 'residential', factor: 250 }
  ]
};

function allRoomsFlat() {
  return [...roomDatabase.hospital, ...roomDatabase.commercial, ...roomDatabase.residential];
}

/* -------------------- Equipment Database -------------------- */
/* category: common / hospital / commercial / residential */
const equipmentCatalog = [
  // Common
  { id: 'pc', ar: 'كمبيوتر مكتبي', en: 'Desktop PC', watts: 250, category: 'common' },
  { id: 'laptop', ar: 'لابتوب', en: 'Laptop', watts: 90, category: 'common' },
  { id: 'monitor', ar: 'شاشة', en: 'Monitor', watts: 40, category: 'common' },
  { id: 'printer', ar: 'طابعة', en: 'Printer', watts: 600, category: 'common' },
  { id: 'fridge_small', ar: 'ثلاجة صغيرة', en: 'Small Refrigerator', watts: 180, category: 'common' },
  { id: 'display_tv', ar: 'شاشة عرض', en: 'Display Screen', watts: 180, category: 'common' },

  // Hospital
  { id: 'endo_tower', ar: 'برج مناظير', en: 'Endoscopy Tower', watts: 1200, category: 'hospital' },
  { id: 'anesthesia', ar: 'جهاز تخدير', en: 'Anesthesia Machine', watts: 800, category: 'hospital' },
  { id: 'or_light', ar: 'إضاءة عمليات (مجموعة)', en: 'OR Lights (Set)', watts: 600, category: 'hospital' },
  { id: 'ventilator', ar: 'جهاز تنفس صناعي', en: 'Ventilator', watts: 350, category: 'hospital' },
  { id: 'patient_monitor', ar: 'مونيتور مريض', en: 'Patient Monitor', watts: 120, category: 'hospital' },
  { id: 'infusion_pump', ar: 'مضخة محاليل', en: 'Infusion Pump', watts: 45, category: 'hospital' },
  { id: 'xray_console', ar: 'كونسول أشعة', en: 'X-Ray Console', watts: 700, category: 'hospital' },
  { id: 'ultrasound', ar: 'جهاز موجات فوق صوتية', en: 'Ultrasound Device', watts: 250, category: 'hospital' },
  { id: 'lab_analyzer', ar: 'محلل مختبري', en: 'Lab Analyzer', watts: 900, category: 'hospital' },
  { id: 'med_fridge', ar: 'ثلاجة أدوية', en: 'Medical Fridge', watts: 300, category: 'hospital' },

  // Commercial
  { id: 'pos', ar: 'جهاز كاشير', en: 'POS Terminal', watts: 120, category: 'commercial' },
  { id: 'coffee_machine', ar: 'ماكينة قهوة', en: 'Coffee Machine', watts: 1500, category: 'commercial' },
  { id: 'freezer', ar: 'فريزر عرض', en: 'Display Freezer', watts: 700, category: 'commercial' },
  { id: 'signage', ar: 'لوحة إعلانية مضيئة', en: 'Light Signage', watts: 250, category: 'commercial' },
  { id: 'cctv_nvr', ar: 'وحدة تسجيل كاميرات', en: 'CCTV NVR', watts: 80, category: 'commercial' },
  { id: 'server_small', ar: 'سيرفر صغير', en: 'Small Server', watts: 500, category: 'commercial' },

  // Residential
  { id: 'tv_home', ar: 'تلفزيون منزلي', en: 'Home TV', watts: 150, category: 'residential' },
  { id: 'router', ar: 'راوتر', en: 'Router', watts: 20, category: 'residential' },
  { id: 'washing_machine', ar: 'غسالة', en: 'Washing Machine', watts: 700, category: 'residential' },
  { id: 'microwave', ar: 'مايكرويف', en: 'Microwave', watts: 1200, category: 'residential' },
  { id: 'oven_electric', ar: 'فرن كهربائي', en: 'Electric Oven', watts: 2200, category: 'residential' },
  { id: 'water_heater', ar: 'سخان ماء', en: 'Water Heater', watts: 1500, category: 'residential' }
];

// state for equipment counts
const equipmentCounts = {};
equipmentCatalog.forEach(e => equipmentCounts[e.id] = 0);

/* -------------------- Init -------------------- */
window.onload = () => {
  initRoomSelect();
  updateDisplayValues();
  updateLanguageUI();
  renderEquipChecklist();
  calculateLoad(false);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
};

/* -------------------- UI / Tabs -------------------- */
function switchTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(id).classList.add('active');

  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  if (btn) btn.classList.add('active');
}

function toggleLanguage() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';
  document.getElementById('html-tag').lang = currentLang;
  document.getElementById('html-tag').dir = currentLang === 'ar' ? 'rtl' : 'ltr';

  updateLanguageUI();
  initRoomSelect(getSelectedRoomId());
  renderEquipChecklist();
  updateHistoryUI();
  calculateLoad(false);
}

function updateLanguageUI() {
  document.querySelectorAll('[data-ar]').forEach(el => {
    el.innerText = el.getAttribute(`data-${currentLang}`);
  });

  const langBtn = document.getElementById('lang-toggle-btn');
  if (langBtn) langBtn.innerText = currentLang === 'ar' ? 'English' : 'العربية';

  const market = document.getElementById('market-btu-line');
  if (market && lastCalcSummary) {
    market.innerText = currentLang === 'ar'
      ? `المقترح: BTU ${formatNumber(lastCalcSummary.marketBtu)}`
      : `Suggested: BTU ${formatNumber(lastCalcSummary.marketBtu)}`;
  }
}

function toggleMethodChip() {
  showMethodChip = !showMethodChip;
  document.getElementById('method-chip').style.display = showMethodChip ? 'block' : 'none';
  document.getElementById('method-toggle-btn').innerText = showMethodChip ? 'ON' : 'OFF';
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

/* -------------------- Room select -------------------- */
function getCategoryLabel(key) {
  const labels = {
    hospital: { ar: 'المستشفيات', en: 'Hospitals' },
    commercial: { ar: 'التجاري', en: 'Commercial' },
    residential: { ar: 'السكني', en: 'Residential' }
  };
  return labels[key][currentLang];
}

function initRoomSelect(selectedId = null) {
  const select = document.getElementById('room-select');
  if (!select) return;

  select.innerHTML = '';

  ['hospital', 'commercial', 'residential'].forEach(cat => {
    const optgroup = document.createElement('optgroup');
    optgroup.label = getCategoryLabel(cat);

    roomDatabase[cat].forEach(room => {
      const opt = document.createElement('option');
      opt.value = room.id;
      opt.dataset.category = cat;
      opt.textContent = currentLang === 'ar' ? room.ar : room.en;
      optgroup.appendChild(opt);
    });

    select.appendChild(optgroup);
  });

  if (selectedId) select.value = selectedId;
  if (!select.value) select.selectedIndex = 0;

  updateMethodAndChips();
}

function getSelectedRoom() {
  const select = document.getElementById('room-select');
  const roomId = select.value;
  const all = allRoomsFlat();
  return all.find(r => r.id === roomId);
}
function getSelectedRoomId() {
  const select = document.getElementById('room-select');
  return select ? select.value : null;
}
function getSelectedRoomCategory() {
  const select = document.getElementById('room-select');
  if (!select || !select.selectedOptions.length) return 'commercial';
  return select.selectedOptions[0].dataset.category;
}

function onRoomChange() {
  // keep numeric values, just refresh devices/chips/calc
  renderEquipChecklist();
  calculateLoad(false);
}

/* -------------------- Input handling -------------------- */
function press(n) {
  const key = String(n);

  if (activeField === 'equip') {
    // no manual typing in equipment field, open modal instead
    openEquipModal();
    return;
  }

  if (key === '.' && inputs[activeField].includes('.')) return;

  if (inputs[activeField] === '0' && key !== '.') {
    inputs[activeField] = key;
  } else {
    inputs[activeField] += key;
  }

  updateDisplayValues();
}

function deleteLast() {
  if (activeField === 'equip') return;
  const val = inputs[activeField];
  inputs[activeField] = val.length > 1 ? val.slice(0, -1) : '0';
  updateDisplayValues();
}

function clearActiveField() {
  if (activeField === 'equip') {
    resetEquipCounts();
  } else {
    inputs[activeField] = '0';
  }
  updateDisplayValues();
  calculateLoad(false);
}

function updateDisplayValues() {
  document.getElementById('display').innerText = inputs.display || '0';
  document.getElementById('people-count').value = inputs.people || '0';
  document.getElementById('equip-watts').value = inputs.equip || '0';
}

/* -------------------- Equipment modal -------------------- */
function getAllowedEquipmentForCurrentRoom() {
  const cat = getSelectedRoomCategory();
  return equipmentCatalog.filter(item => item.category === 'common' || item.category === cat);
}

function renderEquipChecklist() {
  const box = document.getElementById('equip-checklist');
  const label = document.getElementById('equip-filter-label');
  if (!box) return;

  const cat = getSelectedRoomCategory();
  const catText = {
    hospital: { ar: 'الأجهزة المعروضة: صحية + مشتركة', en: 'Shown: Healthcare + Common devices' },
    commercial: { ar: 'الأجهزة المعروضة: تجارية + مشتركة', en: 'Shown: Commercial + Common devices' },
    residential: { ar: 'الأجهزة المعروضة: منزلية + مشتركة', en: 'Shown: Residential + Common devices' }
  };
  label.innerText = catText[cat][currentLang];

  const items = getAllowedEquipmentForCurrentRoom();

  box.innerHTML = items.map(item => `
    <div class="equip-item-row">
      <div>
        <div class="equip-name">${currentLang === 'ar' ? item.ar : item.en}</div>
        <div class="equip-meta">${item.watts} W</div>
      </div>
      <div class="counter-wrap">
        <button class="counter-btn" onclick="changeEquipCount('${item.id}', -1)">-</button>
        <span class="counter-val" id="cnt-${item.id}">${equipmentCounts[item.id] || 0}</span>
        <button class="counter-btn" onclick="changeEquipCount('${item.id}', 1)">+</button>
      </div>
    </div>
  `).join('');
}

function openEquipModal() {
  renderEquipChecklist();
  document.getElementById('equip-modal').style.display = 'block';
}
function closeEquipModal() {
  document.getElementById('equip-modal').style.display = 'none';
}

function changeEquipCount(id, delta) {
  equipmentCounts[id] = Math.max(0, (equipmentCounts[id] || 0) + delta);
  const cnt = document.getElementById(`cnt-${id}`);
  if (cnt) cnt.innerText = equipmentCounts[id];

  recalcEquipWattsFromCounts();
  calculateLoad(false);
}

function resetEquipCounts() {
  Object.keys(equipmentCounts).forEach(k => equipmentCounts[k] = 0);
  recalcEquipWattsFromCounts();
  renderEquipChecklist();
}

function recalcEquipWattsFromCounts() {
  let total = 0;
  equipmentCatalog.forEach(item => {
    total += (equipmentCounts[item.id] || 0) * item.watts;
  });
  inputs.equip = String(total);
  updateDisplayValues();
}

/* -------------------- Calculations -------------------- */
function calculateLoad(saveToHistory = false) {
  try {
    const room = getSelectedRoom();
    if (!room) return;

    const volM3 = parseFloat(inputs.display) || 0;
    const people = parseFloat(inputs.people) || 0;
    const equipWatts = parseFloat(inputs.equip) || 0;

    // CFM from ACH
    const cfmACH = ((volM3 * 35.3147) * room.ach) / 60;

    // People ventilation add-on (simple practical)
    const peopleCFM = people * (room.mode === 'ashrae170' ? 15 : 15);

    const cfm = Math.round(cfmACH + peopleCFM);

    // Sensible load from airflow + people + equipment
    // airflow component uses room.factor (practical factor by use type)
    const airBTU = cfm * room.factor;
    const peopleBTU = people * (room.mode === 'ashrae170' ? 450 : 500);
    const equipBTU = equipWatts * 3.412;

    // safety factor (mild)
    const totalBTU = Math.round((airBTU + peopleBTU + equipBTU) * 1.05);
    const tr = totalBTU / 12000;

    // nearest market BTU
    const marketBtu = nearestMarketBTU(totalBTU);

    // duct size quick estimate (800 fpm, rectangular fixed width 12")
    const duct = getRecommendedDuct(cfm, 12);

    // Update UI
    document.getElementById('cfm-result').innerText = `CFM ${formatNumber(cfm)}`;
    document.getElementById('tr-result').innerText = `TR ${tr.toFixed(2)}`;
    document.getElementById('btu-result').innerText = `BTU/h ${formatNumber(totalBTU)}`;

    document.getElementById('market-btu-line').innerText =
      currentLang === 'ar'
        ? `المقترح: BTU ${formatNumber(marketBtu)}`
        : `Suggested: BTU ${formatNumber(marketBtu)}`;

    document.getElementById('chip-ach').innerText = `ACH: ${room.ach}`;
    document.getElementById('chip-duct').innerText = `Duct: ${duct}`;
    document.getElementById('chip-standard').innerText =
      currentLang === 'ar'
        ? `${room.standard_ar}${room.mode === 'ashrae170' ? ' (صحي)' : ''}`
        : `${room.standard_en}${room.mode === 'ashrae170' ? ' (Healthcare)' : ''}`;

    const methodTextAr = `${room.standard_ar} • ACH: ${room.ach} • ${room.ar}`;
    const methodTextEn = `${room.standard_en} • ACH: ${room.ach} • ${room.en}`;
    document.getElementById('method-chip').innerText = currentLang === 'ar' ? methodTextAr : methodTextEn;

    lastCalcSummary = {
      roomAr: room.ar,
      roomEn: room.en,
      cfm,
      tr: Number(tr.toFixed(2)),
      totalBTU,
      marketBtu,
      ach: room.ach,
      standardAr: room.standard_ar,
      standardEn: room.standard_en,
      duct
    };

    if (saveToHistory) {
      calcHistory.unshift({
        id: Date.now(),
        room: currentLang === 'ar' ? room.ar : room.en,
        cfm,
        tr: Number(tr.toFixed(2)),
        btu: totalBTU,
        marketBtu,
        duct,
        ach: room.ach,
        standard: currentLang === 'ar' ? room.standard_ar : room.standard_en
      });
      updateHistoryUI();
    }
  } catch (err) {
    console.error(err);
    alert(currentLang === 'ar' ? 'خطأ في الحساب. راجع القيم.' : 'Calculation error. Check values.');
  }
}

function nearestMarketBTU(btu) {
  const standards = [9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000, 72000, 96000, 120000, 144000, 180000, 240000, 300000];
  let best = standards[0];
  let minDiff = Math.abs(btu - best);

  standards.forEach(v => {
    const d = Math.abs(btu - v);
    if (d < minDiff) {
      minDiff = d;
      best = v;
    }
  });

  // if larger than listed
  if (btu > standards[standards.length - 1]) {
    best = Math.ceil(btu / 12000) * 12000;
  }
  return best;
}

function getRecommendedDuct(cfm, widthIn = 12) {
  if (!cfm || cfm <= 0) return '--';
  // Area (sq.in) = CFM / V * 144  ; assume V=800 fpm
  const area = (cfm / 800) * 144;
  let h = Math.round(area / widthIn);
  if (h < 6) h = 6;
  return `${widthIn}" x ${h}"`;
}

function updateMethodAndChips() {
  const room = getSelectedRoom();
  if (!room) return;
  document.getElementById('chip-ach').innerText = `ACH: ${room.ach}`;
  document.getElementById('chip-standard').innerText = currentLang === 'ar' ? room.standard_ar : room.standard_en;
}

/* -------------------- History -------------------- */
function updateHistoryUI() {
  const box = document.getElementById('history-list');
  if (!box) return;

  if (!calcHistory.length) {
    box.innerHTML = `<div style="color:#9fa3ad; padding:8px 0;">${currentLang === 'ar' ? 'لا يوجد سجل بعد' : 'No history yet'}</div>`;
    return;
  }

  box.innerHTML = calcHistory.map((item, i) => `
    <div class="history-item" onclick="deleteHistoryItem(${item.id})">
      <div class="h-left">
        <div>#${calcHistory.length - i} - ${item.room}</div>
        <small style="color:#9fa3ad">${item.standard} • ACH ${item.ach}</small>
      </div>
      <div class="h-right">
        <div class="tr">TR ${item.tr.toFixed ? item.tr.toFixed(2) : item.tr}</div>
        <div>CFM ${formatNumber(item.cfm)}</div>
        <div>BTU ${formatNumber(item.marketBtu)}</div>
        <div style="color:#9fa3ad">${item.duct}</div>
      </div>
    </div>
  `).join('');
}

function deleteHistoryItem(id) {
  const ok = confirm(currentLang === 'ar' ? 'حذف السجل؟' : 'Delete record?');
  if (!ok) return;
  calcHistory = calcHistory.filter(x => x.id !== id);
  updateHistoryUI();
}

function clearHistory() {
  const ok = confirm(currentLang === 'ar' ? 'مسح السجل بالكامل؟' : 'Clear all history?');
  if (!ok) return;
  calcHistory = [];
  updateHistoryUI();
}

/* -------------------- Export / Copy -------------------- */
function exportHistoryJSON() {
  const payload = {
    app: "Air Calc Pro",
    exportedAt: new Date().toISOString(),
    history: calcHistory
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'aircalc-history.json';
  a.click();
  URL.revokeObjectURL(a.href);
}

async function copySummary() {
  if (!lastCalcSummary) {
    alert(currentLang === 'ar' ? 'لا توجد نتيجة بعد' : 'No result yet');
    return;
  }

  const roomName = currentLang === 'ar' ? lastCalcSummary.roomAr : lastCalcSummary.roomEn;
  const txt = currentLang === 'ar'
    ? `Air Calc Pro\nالغرفة: ${roomName}\nCFM: ${lastCalcSummary.cfm}\nTR: ${lastCalcSummary.tr}\nBTU/h: ${lastCalcSummary.totalBTU}\nBTU المقترح: ${lastCalcSummary.marketBtu}\nACH: ${lastCalcSummary.ach}\nDuct: ${lastCalcSummary.duct}`
    : `Air Calc Pro\nRoom: ${roomName}\nCFM: ${lastCalcSummary.cfm}\nTR: ${lastCalcSummary.tr}\nBTU/h: ${lastCalcSummary.totalBTU}\nSuggested BTU: ${lastCalcSummary.marketBtu}\nACH: ${lastCalcSummary.ach}\nDuct: ${lastCalcSummary.duct}`;

  try {
    await navigator.clipboard.writeText(txt);
    alert(currentLang === 'ar' ? 'تم نسخ الملخص' : 'Summary copied');
  } catch {
    alert(currentLang === 'ar' ? 'تعذر النسخ' : 'Copy failed');
  }
}

/* -------------------- Helpers -------------------- */
function formatNumber(n) {
  try {
    return Number(n).toLocaleString(currentLang === 'ar' ? 'ar-SA' : 'en-US');
  } catch {
    return String(n);
  }
}

// Clicking people input should allow keypad entry
document.addEventListener('click', (e) => {
  if (e.target.id === 'people-count') {
    focusField('people');
  } else if (e.target.id === 'display') {
    focusField('display');
  }
});