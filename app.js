let currentLang = 'ar';
let activeField = 'display';
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];
let roomData = { categories: [] };

// قائمة الأجهزة
const equipmentList = [
  { id: 'pc', ar: '💻 كمبيوتر مكتب', en: 'Desktop PC', watts: 250, count: 0 },
  { id: 'srv', ar: '🖥️ سيرفر', en: 'Server', watts: 1200, count: 0 },
  { id: 'med', ar: '🩺 جهاز طبي عام', en: 'Medical Device', watts: 400, count: 0 },
  { id: 'mri', ar: '🧬 جهاز تصوير/أشعة', en: 'Imaging Device', watts: 2500, count: 0 },
  { id: 'frg', ar: '🧊 ثلاجة', en: 'Fridge', watts: 600, count: 0 },
  { id: 'tv', ar: '📺 شاشة', en: 'Display Screen', watts: 200, count: 0 },
  { id: 'cop', ar: '🖨️ طابعة/تصوير', en: 'Copier', watts: 800, count: 0 }
];

// معاملات تقريبية (Rule of Thumb) شائعة للسعودية حسب القطاع (TR تقديري)
const saudiCategoryFactors = {
  residential: { btuPerM3: 180, peopleBTU: 400 },
  commercial:  { btuPerM3: 250, peopleBTU: 500 },
  hospital:    { btuPerM3: 220, peopleBTU: 450 } // احتياط بسيط للـ TR فقط، CFM يعتمد ACH
};

window.onload = async () => {
  await loadRoomData();
  updateRoomSelect();
  renderEquipChecklist();
  renderStandardsPage();
  updateDisplayValues();
  focusField('display');
  calculateLoad(false);

  // تسجيل SW (اختياري)
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
};

/* ------------------ DATA LOAD ------------------ */
async function loadRoomData() {
  try {
    const resp = await fetch(`data.json?v=${Date.now()}`, { cache: "no-store" });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const json = await resp.json();

    if (!json.categories || !Array.isArray(json.categories)) {
      throw new Error("Invalid data.json format");
    }

    roomData = normalizeCategories(json);
  } catch (err) {
    console.warn("data.json failed, using fallback", err);
    roomData = fallbackRoomData();
  }
}

// توحيد أسماء الحقول لو كانت بصيغة مختلفة
function normalizeCategories(json) {
  const categories = json.categories.map(cat => {
    // تحديد نوع القسم
    const nameAr = cat.name_ar || cat.name || "قسم";
    const nameEn = cat.name_en || cat.name || "Category";

    let kind = "commercial";
    const lower = (nameEn + " " + nameAr).toLowerCase();
    if (lower.includes("hospital") || lower.includes("ashrae 170") || nameAr.includes("مستشفيات")) kind = "hospital";
    else if (lower.includes("residential") || nameAr.includes("سكن")) kind = "residential";
    else kind = "commercial";

    const items = (cat.items || []).map(item => ({
      id: item.id,
      ar: item.ar || item.label_ar || item["Room Type"] || "غرفة",
      en: item.en || item.label_en || item["Room Type"] || "Room",
      ach: parseNum(item.ach),
      med: item.med ?? (kind === "hospital"),
      pressure: item.pressure || item.Pressure || null,
      tempC: item.tempC || item["Temp (°C)"] || null,
      rh: item.rh || item["RH (%)"] || null,
      outdoorACH: parseNum(item.outdoorACH || item["Outdoor Air ACH"]),
      totalACH: parseNum(item.totalACH || item["Total ACH"]) || parseNum(item.ach)
    }));

    return { name_ar: nameAr, name_en: nameEn, kind, items };
  });

  return { categories };
}

function fallbackRoomData() {
  return {
    categories: [
      {
        name_ar: "المستشفيات (ASHRAE 170)",
        name_en: "Hospitals (ASHRAE 170)",
        kind: "hospital",
        items: [
          { id: "h1", ar: "غرفة عمليات (OR)", en: "Operating Room (OR)", ach: 20, med: true, totalACH: 20 },
          { id: "h2", ar: "عزل ضغط سالب (AII)", en: "Negative Pressure (AII)", ach: 12, med: true, totalACH: 12 },
          { id: "h3", ar: "العناية المركزة (ICU)", en: "Critical Care (ICU)", ach: 6, med: true, totalACH: 6 },
          { id: "h4", ar: "غرفة تنويم مريض", en: "Patient Room", ach: 6, med: true, totalACH: 6 }
        ]
      },
      {
        name_ar: "التجاري",
        name_en: "Commercial",
        kind: "commercial",
        items: [
          { id: "c1", ar: "مكاتب", en: "Offices", ach: 4, med: false, totalACH: 4 },
          { id: "c2", ar: "مطعم", en: "Restaurant", ach: 10, med: false, totalACH: 10 }
        ]
      },
      {
        name_ar: "السكني",
        name_en: "Residential",
        kind: "residential",
        items: [
          { id: "r1", ar: "غرفة معيشة", en: "Living Room", ach: 4, med: false, totalACH: 4 },
          { id: "r2", ar: "غرفة نوم", en: "Bedroom", ach: 2, med: false, totalACH: 2 }
        ]
      }
    ]
  };
}

function parseNum(v) {
  if (v === null || v === undefined || v === "" || v === "Optional") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/* ------------------ UI BUILD ------------------ */
function updateRoomSelect() {
  const select = document.getElementById('room-select');
  if (!select) return;

  select.innerHTML = '';

  roomData.categories.forEach(cat => {
    const group = document.createElement('optgroup');
    group.label = currentLang === 'ar' ? cat.name_ar : cat.name_en;

    cat.items.forEach(room => {
      const opt = document.createElement('option');
      opt.value = room.id;
      opt.innerText = currentLang === 'ar' ? room.ar : room.en;
      opt.dataset.categoryKind = cat.kind;
      opt.dataset.categoryAr = cat.name_ar;
      opt.dataset.categoryEn = cat.name_en;
      group.appendChild(opt);
    });

    select.appendChild(group);
  });

  updateModeNote();
}

function renderEquipChecklist() {
  const el = document.getElementById('equip-checklist');
  if (!el) return;

  el.innerHTML = equipmentList.map((item, idx) => `
    <div class="equip-item-row">
      <div>
        <div>${currentLang === 'ar' ? item.ar : item.en}</div>
        <small style="color:#8e8e93">${item.watts} W</small>
      </div>
      <div class="counter-ctrl">
        <button class="counter-btn" onclick="changeCount(${idx}, -1)">-</button>
        <span id="cnt-${idx}" style="margin:0 10px">${item.count}</span>
        <button class="counter-btn" onclick="changeCount(${idx}, 1)">+</button>
      </div>
    </div>
  `).join('');
}

function renderStandardsPage() {
  const wrap = document.getElementById('standards-content');
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="std-box">
      <h3>${currentLang === 'ar' ? 'القطاع الصحي (المستشفيات)' : 'Healthcare (Hospitals)'}</h3>
      <p>${currentLang === 'ar'
        ? 'يتم حساب تدفق الهواء CFM بناءً على ACH (عدد مرات تغيير الهواء) حسب نوع الغرفة. هذا هو الأساس المستخدم لغرف المستشفيات في التطبيق.'
        : 'CFM is calculated using ACH (Air Changes per Hour) based on room type. This is the basis used for hospital spaces in the app.'}</p>
      <ul class="std-list">
        <li>${currentLang === 'ar' ? 'CFM = (الحجم بالمتر المكعب × 35.31 × ACH) ÷ 60' : 'CFM = (Volume m³ × 35.31 × ACH) ÷ 60'}</li>
        <li>${currentLang === 'ar' ? 'TR تقديري ويُستخدم كقيمة عملية للمقارنة الأولية' : 'TR is an estimated practical value for early comparison'}</li>
      </ul>
    </div>

    <div class="std-box">
      <h3>${currentLang === 'ar' ? 'القطاع التجاري / السكني' : 'Commercial / Residential'}</h3>
      <p>${currentLang === 'ar'
        ? 'يتم استخدام طريقة عملية (Rule of Thumb) متداولة ميدانيًا في السعودية لتقدير الحمل التبريدي، مع مراعاة الأشخاص والأجهزة.'
        : 'A practical Saudi-style rule of thumb is used for cooling load estimation, including people and equipment.'}</p>
      <ul class="std-list">
        <li>${currentLang === 'ar' ? 'TR تقديري = (حمل الحجم + حمل الأشخاص + حمل الأجهزة) ÷ 12000' : 'Estimated TR = (Volume load + People load + Equipment load) ÷ 12000'}</li>
        <li>${currentLang === 'ar' ? 'CFM يظهر أيضًا بناءً على ACH المختار لنوع الغرفة' : 'CFM is also shown based on selected room ACH'}</li>
      </ul>
    </div>

    <div class="std-box">
      <h3>${currentLang === 'ar' ? 'تنبيه' : 'Note'}</h3>
      <p>${currentLang === 'ar'
        ? 'النتائج تقديرية للتصميم الأولي وليست بديلًا عن الحسابات التفصيلية (Heat Load, Psychrometrics, Pressure Relationships, Code Compliance).'
        : 'Results are preliminary design estimates and do not replace detailed heat load, psychrometric, pressure, and code compliance calculations.'}</p>
    </div>
  `;
}

/* ------------------ CORE CALC ------------------ */
function getSelectedRoom() {
  const select = document.getElementById('room-select');
  if (!select || !select.value) return null;

  for (const cat of roomData.categories) {
    const room = cat.items.find(r => r.id === select.value);
    if (room) return { room, category: cat };
  }
  return null;
}

function calculateLoad(save = false) {
  const selected = getSelectedRoom();
  if (!selected) return;

  const { room, category } = selected;

  const volumeM3 = parseFloat(inputs.display) || 0;
  const people = parseInt(inputs.people) || 0;
  const equipW = parseFloat(inputs.equip) || 0;

  // CFM مبني على ACH
  const ach = Number(room.totalACH || room.ach || 0);
  let cfm = 0;
  if (volumeM3 > 0 && ach > 0) {
    cfm = Math.round((volumeM3 * 35.31 * ach) / 60);
  }

  // زيادة بسيطة للتهوية بسبب الأشخاص (عملي)
  const peopleVentCfm = people * 15;
  cfm += peopleVentCfm;

  // TR حسب نوع القطاع
  let tr = 0;
  const sector = category.kind;

  if (sector === 'hospital') {
    // المستشفى: CFM من ACH (ASHRAE style) + حمل أشخاص/أجهزة
    const sensibleFromAir = cfm * 1.08 * 20; // فرق حرارة تقريبي 20°F
    const peopleBTU = people * saudiCategoryFactors.hospital.peopleBTU;
    const equipBTU = equipW * 3.41;
    tr = (sensibleFromAir + peopleBTU + equipBTU) / 12000;
  } else {
    // التجاري/السكني: Rule of Thumb سعودي (تقريبي)
    const factor = sector === 'residential'
      ? saudiCategoryFactors.residential
      : saudiCategoryFactors.commercial;

    const volumeBTU = volumeM3 * factor.btuPerM3;
    const peopleBTU = people * factor.peopleBTU;
    const equipBTU = equipW * 3.41;

    tr = (volumeBTU + peopleBTU + equipBTU) / 12000;
  }

  tr = Math.max(0, tr);

  // تحديث النتائج
  document.getElementById('tr-result').innerText = `${tr.toFixed(2)} TR`;
  document.getElementById('cfm-result').innerText = `${Math.round(cfm)} CFM`;

  // تحديث الملاحظة
  updateModeNote();

  // حفظ في السجل
  if (save) {
    const duct = suggestDuct(Math.round(cfm), 800); // سرعة تصميمية افتراضية
    calcHistory.push({
      id: Date.now(),
      ts: new Date().toLocaleString(),
      roomAr: room.ar,
      roomEn: room.en,
      sector,
      ach: ach || 0,
      volumeM3,
      people,
      equipW,
      tr: Number(tr.toFixed(2)),
      cfm: Math.round(cfm),
      duct
    });
    updateHistoryUI();
  }
}

function updateModeNote() {
  const selected = getSelectedRoom();
  const note = document.getElementById('mode-note');
  if (!selected || !note) return;

  const { room, category } = selected;
  const ach = room.totalACH || room.ach || 0;

  if (category.kind === 'hospital') {
    note.textContent = currentLang === 'ar'
      ? `الوضع: صحي (ASHRAE) — ACH = ${ach || '-'} | الحساب الرئيسي للهواء عبر ACH`
      : `Mode: Healthcare (ASHRAE) — ACH = ${ach || '-'} | Airflow based on ACH`;
  } else if (category.kind === 'commercial') {
    note.textContent = currentLang === 'ar'
      ? `الوضع: تجاري — Rule of Thumb سعودي + ACH (${ach || '-'})`
      : `Mode: Commercial — Saudi Rule of Thumb + ACH (${ach || '-'})`;
  } else {
    note.textContent = currentLang === 'ar'
      ? `الوضع: سكني — Rule of Thumb سعودي + ACH (${ach || '-'})`
      : `Mode: Residential — Saudi Rule of Thumb + ACH (${ach || '-'})`;
  }
}

/* ------------------ DUCT SUGGESTION ------------------ */
function suggestDuct(cfm, velocityFpm = 800) {
  if (!cfm || cfm <= 0) return '--';
  const areaIn2 = (cfm / velocityFpm) * 144;

  // خيارات عرض شائعة
  const widths = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30];
  let best = null;

  for (const w of widths) {
    const h = Math.max(6, Math.round(areaIn2 / w));
    const roundedH = Math.ceil(h / 2) * 2; // تقريب لأقرب 2 إنش
    const area = w * roundedH;
    const diff = Math.abs(area - areaIn2);

    if (!best || diff < best.diff) {
      best = { w, h: roundedH, diff };
    }
  }

  return `${best.w}" x ${best.h}"`;
}

/* ------------------ HISTORY ------------------ */
function updateHistoryUI() {
  const container = document.getElementById('history-list');
  if (!container) return;

  if (calcHistory.length === 0) {
    container.innerHTML = `
      <div class="swipe-item">
        <div class="info">
          <span class="room-name">${currentLang === 'ar' ? 'لا يوجد عمليات محفوظة' : 'No saved calculations'}</span>
          <span class="meta">${currentLang === 'ar' ? 'اضغط CALC للحفظ' : 'Press CALC to save'}</span>
        </div>
      </div>
    `;
    return;
  }

  const rows = [...calcHistory].reverse().map((item, index) => `
    <div class="swipe-item" onclick="deleteItem(${item.id})" title="${currentLang === 'ar' ? 'اضغط للحذف' : 'Tap to delete'}">
      <div class="info">
        <span class="room-name">#${calcHistory.length - index} — ${currentLang === 'ar' ? item.roomAr : item.roomEn}</span>
        <span class="meta">
          ${currentLang === 'ar' ? 'الحجم' : 'Vol'}: ${item.volumeM3} m³ •
          ${currentLang === 'ar' ? 'أشخاص' : 'People'}: ${item.people} •
          ACH: ${item.ach}
        </span>
      </div>
      <div class="vals">
        <div class="tr-val">${item.tr} TR</div>
        <div class="cfm-val">${item.cfm} CFM</div>
        <div class="duct-val">${item.duct}</div>
      </div>
    </div>
  `).join('');

  container.innerHTML = rows;
}

function deleteItem(id) {
  const ok = confirm(currentLang === 'ar' ? "حذف هذه العملية؟" : "Delete this calculation?");
  if (!ok) return;

  calcHistory = calcHistory.filter(i => i.id !== id);
  updateHistoryUI();
}

function clearHistory() {
  const ok = confirm(currentLang === 'ar' ? "مسح كل السجل؟" : "Clear all history?");
  if (!ok) return;
  calcHistory = [];
  updateHistoryUI();
}

function exportHistoryCSV() {
  if (!calcHistory.length) {
    alert(currentLang === 'ar' ? 'السجل فارغ' : 'History is empty');
    return;
  }

  const header = [
    "DateTime", "Room_AR", "Room_EN", "Sector", "Volume_m3",
    "People", "Equip_W", "ACH", "CFM", "TR", "Duct"
  ];

  const rows = calcHistory.map(r => [
    r.ts, r.roomAr, r.roomEn, r.sector, r.volumeM3,
    r.people, r.equipW, r.ach, r.cfm, r.tr, r.duct
  ]);

  const csv = [header, ...rows]
    .map(row => row.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "air_calc_history.csv";
  a.click();

  URL.revokeObjectURL(url);
}

/* ------------------ INPUTS / KEYPAD ------------------ */
function press(n) {
  if (activeField === 'equip') return; // الأجهزة تُحسب من القائمة
  const v = String(n);

  if (v === '.' && inputs[activeField].includes('.')) return;

  if (inputs[activeField] === "0" && v !== ".") inputs[activeField] = v;
  else inputs[activeField] += v;

  updateDisplayValues();
  calculateLoad(false);
}

function deleteLast() {
  if (activeField === 'equip') return;
  inputs[activeField] = inputs[activeField].slice(0, -1) || "0";
  updateDisplayValues();
  calculateLoad(false);
}

function clearActiveField() {
  if (activeField === 'equip') {
    equipmentList.forEach(i => i.count = 0);
    inputs.equip = "0";
    renderEquipChecklist();
  } else {
    inputs[activeField] = "0";
  }

  updateDisplayValues();
  calculateLoad(false);
}

function resetAllFields() {
  inputs = { display: "0", people: "0", equip: "0" };
  equipmentList.forEach(i => i.count = 0);
  renderEquipChecklist();
  updateDisplayValues();
  calculateLoad(false);
  updateModeNote();
}

function updateDisplayValues() {
  const display = document.getElementById('display');
  const peopleEl = document.getElementById('people-count');
  const equipEl = document.getElementById('equip-watts');

  if (display) display.innerText = inputs.display || "0";
  if (peopleEl) peopleEl.value = inputs.people || "0";
  if (equipEl) equipEl.value = inputs.equip || "0";
}

function focusField(f) {
  activeField = f;

  document.getElementById('display')?.classList.remove('active-field');
  document.getElementById('people-count')?.classList.remove('active-field');
  document.getElementById('equip-watts')?.classList.remove('active-field');

  if (f === 'display') document.getElementById('display')?.classList.add('active-field');
  if (f === 'people') document.getElementById('people-count')?.classList.add('active-field');
  if (f === 'equip') document.getElementById('equip-watts')?.classList.add('active-field');

  if (f === 'people') {
    // ناسخ القيمة للشاشة لتسهيل الإدخال
    document.getElementById('field-hint').innerText = currentLang === 'ar' ? 'عدد الأشخاص' : 'People Count';
  } else {
    document.getElementById('field-hint').innerText = currentLang === 'ar' ? 'حجم الغرفة (m³)' : 'Room Volume (m³)';
  }
}

/* ------------------ EQUIPMENT MODAL ------------------ */
function openEquipModal() {
  document.getElementById('equip-modal').style.display = 'block';
  focusField('equip');
}
function closeEquipModal() {
  document.getElementById('equip-modal').style.display = 'none';
  focusField('display');
}
function changeCount(idx, delta) {
  equipmentList[idx].count = Math.max(0, equipmentList[idx].count + delta);
  document.getElementById(`cnt-${idx}`).innerText = equipmentList[idx].count;

  const totalW = equipmentList.reduce((sum, i) => sum + (i.watts * i.count), 0);
  inputs.equip = String(totalW);

  updateDisplayValues();
  calculateLoad(false);
}

/* ------------------ NAV / TABS / LANGUAGE ------------------ */
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

  document.querySelectorAll('[data-ar]').forEach(el => {
    const txt = el.getAttribute(`data-${currentLang}`);
    if (txt !== null) el.innerText = txt;
  });

  // زر اللغة داخل الإعدادات
  const langBtn = document.getElementById('lang-text');
  if (langBtn) langBtn.innerText = currentLang === 'ar' ? 'English' : 'العربية';

  // تحديث القوائم
  updateRoomSelect();
  renderEquipChecklist();
  renderStandardsPage();
  updateHistoryUI();
  updateModeNote();

  // تحديث Hint حسب الحقل النشط
  if (activeField === 'people') {
    document.getElementById('field-hint').innerText = currentLang === 'ar' ? 'عدد الأشخاص' : 'People Count';
  } else {
    document.getElementById('field-hint').innerText = currentLang === 'ar' ? 'حجم الغرفة (m³)' : 'Room Volume (m³)';
  }
}

/* ------------------ OPTIONAL DUCT CALC ------------------ */
function runDuctCalc() {
  // لو عندك صفحة دكت مستقبلًا
  const cfm = parseFloat(document.getElementById('targetCFM')?.value || 0);
  const w = parseFloat(document.getElementById('fixWidth')?.value || 0);
  const out = document.getElementById('duct-result');
  if (!out) return;

  if (cfm && w) {
    const h = Math.round((cfm / 800 * 144) / w);
    out.innerText = `${w}" x ${Math.max(6, h)}"`;
  } else {
    out.innerText = "---";
  }
}