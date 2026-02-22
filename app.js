/* Air Calc Pro - Stable Build (No Assistant) */

let currentLang = "ar";
let activeField = "display";
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];
let roomCatalog = [];
let allEquipment = [];

/* ---------- Room Data (Hospital + Commercial + Residential) ---------- */
/* Hospital: ACH-based (ASHRAE reference style)
   Commercial/Residential: practical Saudi-style quick estimate using ACH + sensible load model
*/
const roomData = {
  categories: [
    {
      key: "hospital",
      name_ar: "المستشفيات (ASHRAE 170)",
      name_en: "Hospitals (ASHRAE 170)",
      med: true,
      deltaT_F: 18,
      peopleSensibleBTU: 450,
      items: [
        { id: "h1", ar: "غرفة عمليات (OR)", en: "Operating Room (OR)", ach: 20, pressure: "P" },
        { id: "h2", ar: "عزل ضغط موجب (PE)", en: "Positive Pressure (PE)", ach: 12, pressure: "P" },
        { id: "h3", ar: "عزل ضغط سالب (AII)", en: "Negative Pressure (AII)", ach: 12, pressure: "N" },
        { id: "h4", ar: "العناية المركزة (ICU)", en: "Critical Care (ICU)", ach: 6, pressure: "N" },
        { id: "h5", ar: "غرفة الطوارئ (ترياج)", en: "Emergency (Triage)", ach: 12, pressure: "N" },
        { id: "h6", ar: "مختبر عام", en: "General Laboratory", ach: 6, pressure: "N" },
        { id: "h7", ar: "غرفة تنويم مريض", en: "Patient Room", ach: 6, pressure: "N" },
        { id: "h8", ar: "الأشعة التشخيصية", en: "Diagnostic X-Ray", ach: 6, pressure: "N" },
        { id: "h9", ar: "غرفة المناظير", en: "Endoscopy Room", ach: 15, pressure: "P" },
        { id: "h10", ar: "التعقيم المركزي (CSSD)", en: "Sterile Storage (CSSD)", ach: 10, pressure: "P" },
        { id: "h11", ar: "الصيدلية", en: "Pharmacy", ach: 4, pressure: "N" },
        { id: "h12", ar: "غرفة الولادة (LDR)", en: "Delivery Room (LDR)", ach: 15, pressure: "P" },
        { id: "h13", ar: "العلاج الطبيعي", en: "Physical Therapy", ach: 6, pressure: "N" },
        { id: "h14", ar: "غرفة فحص عامة", en: "Examination Room", ach: 6, pressure: "N" }
      ]
    },
    {
      key: "commercial",
      name_ar: "التجاري (ASHRAE 62.1)",
      name_en: "Commercial (ASHRAE 62.1)",
      med: false,
      deltaT_F: 20,
      peopleSensibleBTU: 500,
      items: [
        { id: "c1", ar: "مكاتب مفتوحة", en: "Open Offices", ach: 4, pressure: "N" },
        { id: "c2", ar: "غرفة اجتماعات", en: "Conference Room", ach: 10, pressure: "N" },
        { id: "c3", ar: "صالة مطعم", en: "Dining Area", ach: 10, pressure: "N" },
        { id: "c4", ar: "مطبخ تجاري", en: "Commercial Kitchen", ach: 30, pressure: "N" },
        { id: "c5", ar: "نادي رياضي", en: "Gym / Fitness Area", ach: 8, pressure: "N" },
        { id: "c6", ar: "قاعة سينما/مسرح", en: "Auditorium", ach: 15, pressure: "N" },
        { id: "c7", ar: "مكتبة عامة", en: "Library", ach: 4, pressure: "N" },
        { id: "c8", ar: "ردهة استقبال", en: "Lobby / Reception", ach: 4, pressure: "N" },
        { id: "c9", ar: "محلات تجارية", en: "Retail Store", ach: 6, pressure: "N" }
      ]
    },
    {
      key: "residential",
      name_ar: "المباني السكنية",
      name_en: "Residential Buildings",
      med: false,
      deltaT_F: 22,
      peopleSensibleBTU: 400,
      items: [
        { id: "r1", ar: "غرفة معيشة", en: "Living Room", ach: 4, pressure: "N" },
        { id: "r2", ar: "غرفة نوم", en: "Bedroom", ach: 2, pressure: "N" },
        { id: "r3", ar: "مطبخ منزلي", en: "Domestic Kitchen", ach: 6, pressure: "N" },
        { id: "r4", ar: "دورة مياه", en: "Bathroom", ach: 10, pressure: "N" },
        { id: "r5", ar: "ممر داخلي", en: "Corridor", ach: 2, pressure: "N" }
      ]
    }
  ]
};

/* ---------- Equipment lists by sector (filtered) ---------- */
const sharedEquip = [
  { id: "pc", ar: "💻 كمبيوتر", en: "Computer", watts: 200, sectors: ["hospital", "commercial", "residential"] },
  { id: "screen", ar: "📺 شاشة", en: "Display Screen", watts: 120, sectors: ["hospital", "commercial", "residential"] },
  { id: "fridge", ar: "🧊 ثلاجة", en: "Refrigerator", watts: 300, sectors: ["hospital", "commercial", "residential"] }
];

const hospitalEquip = [
  { id: "patient_monitor", ar: "🩺 شاشة مراقبة مريض", en: "Patient Monitor", watts: 80, sectors: ["hospital"] },
  { id: "ventilator", ar: "💨 جهاز تنفس صناعي", en: "Ventilator", watts: 300, sectors: ["hospital"] },
  { id: "anesthesia", ar: "💉 جهاز تخدير", en: "Anesthesia Machine", watts: 150, sectors: ["hospital"] },
  { id: "infusion_pump", ar: "🧪 مضخة محاليل", en: "Infusion Pump", watts: 50, sectors: ["hospital"] },
  { id: "suction", ar: "🫧 جهاز شفط", en: "Suction Unit", watts: 200, sectors: ["hospital"] },
  { id: "xray_unit", ar: "🩻 جهاز أشعة", en: "X-ray Unit", watts: 1500, sectors: ["hospital"] },
  { id: "ultrasound", ar: "🔊 جهاز ألتراساوند", en: "Ultrasound", watts: 250, sectors: ["hospital"] },
  { id: "endoscopy_tower", ar: "🔬 برج مناظير", en: "Endoscopy Tower", watts: 600, sectors: ["hospital"] },
  { id: "lab_analyzer", ar: "🧫 جهاز مختبر", en: "Lab Analyzer", watts: 500, sectors: ["hospital"] },
  { id: "sterilizer_small", ar: "♨️ معقم صغير", en: "Small Sterilizer", watts: 1800, sectors: ["hospital"] }
];

const commercialEquip = [
  { id: "copier", ar: "🖨️ آلة تصوير", en: "Copier", watts: 800, sectors: ["commercial"] },
  { id: "pos", ar: "💳 جهاز كاشير", en: "POS Terminal", watts: 80, sectors: ["commercial"] },
  { id: "spotlight", ar: "💡 إضاءة سبوت", en: "Spot Lighting Set", watts: 300, sectors: ["commercial"] },
  { id: "coffee", ar: "☕ ماكينة قهوة", en: "Coffee Machine", watts: 1200, sectors: ["commercial"] },
  { id: "oven", ar: "🔥 فرن تجاري", en: "Commercial Oven", watts: 3500, sectors: ["commercial"] },
  { id: "freezer", ar: "🧊 فريزر عرض", en: "Display Freezer", watts: 700, sectors: ["commercial"] },
  { id: "treadmill", ar: "🏃 سير رياضي", en: "Treadmill", watts: 900, sectors: ["commercial"] },
  { id: "projector", ar: "📽️ بروجيكتور", en: "Projector", watts: 350, sectors: ["commercial"] }
];

const residentialEquip = [
  { id: "tv_home", ar: "📺 تلفزيون", en: "Television", watts: 150, sectors: ["residential"] },
  { id: "microwave", ar: "🍲 مايكروويف", en: "Microwave", watts: 1200, sectors: ["residential"] },
  { id: "washer", ar: "🧺 غسالة", en: "Washing Machine", watts: 500, sectors: ["residential"] },
  { id: "dryer", ar: "🌀 نشافة", en: "Dryer", watts: 2000, sectors: ["residential"] },
  { id: "dishwasher", ar: "🍽️ غسالة صحون", en: "Dishwasher", watts: 1400, sectors: ["residential"] },
  { id: "electric_stove", ar: "🍳 موقد كهربائي", en: "Electric Stove", watts: 2000, sectors: ["residential"] },
  { id: "water_heater", ar: "🚿 سخان ماء", en: "Water Heater", watts: 1500, sectors: ["residential"] }
];

allEquipment = [...sharedEquip, ...hospitalEquip, ...commercialEquip, ...residentialEquip].map(e => ({ ...e, count: 0 }));

/* ---------- Lifecycle ---------- */
window.onload = () => {
  buildRoomCatalog();
  updateRoomSelect();
  renderEquipChecklist();
  focusField("display");
  updateDisplayValues();
  calculateLoad(false);
  registerSW();
};

/* ---------- Helpers ---------- */
function enNum(value, decimals = null) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  if (decimals !== null) {
    return n.toLocaleString("en-US", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }
  return n.toLocaleString("en-US");
}

function buildRoomCatalog() {
  roomCatalog = [];
  roomData.categories.forEach(cat => {
    cat.items.forEach(item => {
      roomCatalog.push({
        ...item,
        categoryKey: cat.key,
        category_ar: cat.name_ar,
        category_en: cat.name_en,
        med: cat.med,
        deltaT_F: cat.deltaT_F,
        peopleSensibleBTU: cat.peopleSensibleBTU
      });
    });
  });
}

function getSelectedRoom() {
  const select = document.getElementById("room-select");
  const id = select.value;
  return roomCatalog.find(r => r.id === id) || roomCatalog[0];
}

function getActiveSector() {
  const room = getSelectedRoom();
  return room?.categoryKey || "residential";
}

function roundToMarketBTU(btu) {
  const sizes = [9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000, 72000];
  let closest = sizes[0];
  let minDiff = Math.abs(btu - closest);
  for (const s of sizes) {
    const diff = Math.abs(btu - s);
    if (diff < minDiff) {
      minDiff = diff;
      closest = s;
    }
  }
  return closest;
}

function computeDuctSize(cfm) {
  // quick estimate @ ~800 fpm, fixed width 12"
  const width = 12;
  if (!cfm || cfm <= 0) return `${width}" x 0"`;
  const areaIn2 = (cfm / 800) * 144;
  const height = Math.max(4, Math.round(areaIn2 / width));
  return `${width}" x ${height}"`;
}

/* ---------- UI Population ---------- */
function updateRoomSelect() {
  const select = document.getElementById("room-select");
  select.innerHTML = "";

  roomData.categories.forEach(cat => {
    const group = document.createElement("optgroup");
    group.label = currentLang === "ar" ? cat.name_ar : cat.name_en;

    cat.items.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = currentLang === "ar" ? item.ar : item.en;
      group.appendChild(opt);
    });

    select.appendChild(group);
  });

  // keep previous if possible
  if (!select.value && roomCatalog.length) {
    select.value = roomCatalog[0].id;
  }
}

function renderEquipChecklist() {
  const sector = getActiveSector();
  const list = allEquipment.filter(e => e.sectors.includes(sector));

  const wrap = document.getElementById("equip-checklist");
  wrap.innerHTML = list.map(item => {
    const idx = allEquipment.findIndex(x => x.id === item.id);
    return `
      <div class="equip-item-row">
        <div class="equip-label">
          <div class="title">${currentLang === "ar" ? item.ar : item.en}</div>
          <div class="sub">${enNum(item.watts)} W</div>
        </div>
        <div class="counter-ctrl">
          <button class="counter-btn" onclick="changeCount(${idx}, -1)">-</button>
          <span class="count-pill" id="cnt-${idx}">${enNum(item.count)}</span>
          <button class="counter-btn" onclick="changeCount(${idx}, 1)">+</button>
        </div>
      </div>
    `;
  }).join("");
}

/* ---------- Input Handling ---------- */
function focusField(f) {
  activeField = f;

  document.getElementById("display").classList.remove("active-field");
  document.getElementById("people-count").classList.remove("active-field");
  document.getElementById("equip-watts").classList.remove("active-field");

  if (f === "display") document.getElementById("display").classList.add("active-field");
  if (f === "people") document.getElementById("people-count").classList.add("active-field");
  if (f === "equip") document.getElementById("equip-watts").classList.add("active-field");
}

function press(n) {
  const key = activeField;
  if (key === "equip") return; // equipment is modal controlled

  const char = String(n);
  let val = inputs[key];

  if (char === ".") {
    if (val.includes(".")) return;
    if (val === "0") val = "0.";
    else val += ".";
  } else {
    if (val === "0") val = char;
    else val += char;
  }

  inputs[key] = val;
  updateDisplayValues();
}

function deleteLast() {
  const key = activeField;
  if (key === "equip") return;
  inputs[key] = inputs[key].slice(0, -1) || "0";
  updateDisplayValues();
}

function clearActiveField() {
  const key = activeField;
  if (key === "equip") {
    // clear all equipment counts
    allEquipment.forEach(e => e.count = 0);
    inputs.equip = "0";
    renderEquipChecklist();
  } else {
    inputs[key] = "0";
  }
  updateDisplayValues();
  calculateLoad(false);
}

function updateDisplayValues() {
  document.getElementById("display").textContent = inputs.display || "0";
  document.getElementById("people-count").value = inputs.people || "0";
  document.getElementById("equip-watts").value = inputs.equip || "0";
}

function handleRoomChange() {
  // requirement: reset calculator when room changes
  resetAllFields();
  renderEquipChecklist();
  calculateLoad(false);
}

function resetAllFields() {
  inputs = { display: "0", people: "0", equip: "0" };
  allEquipment.forEach(e => e.count = 0);
  updateDisplayValues();
  focusField("display");
  renderEquipChecklist();

  document.getElementById("tr-result").textContent = "0.00 TR";
  document.getElementById("cfm-result").textContent = "0 CFM";
  document.getElementById("btu-result").textContent = "0 BTU/h";
  document.getElementById("btu-market-result").textContent = "0 BTU (Market)";
}

/* ---------- Equipment ---------- */
function changeCount(idx, delta) {
  const item = allEquipment[idx];
  if (!item) return;

  // protect against wrong sector
  const sector = getActiveSector();
  if (!item.sectors.includes(sector)) return;

  item.count = Math.max(0, (item.count || 0) + delta);

  const el = document.getElementById(`cnt-${idx}`);
  if (el) el.textContent = enNum(item.count);

  const totalWatts = allEquipment.reduce((sum, e) => sum + (e.watts * e.count), 0);
  inputs.equip = String(totalWatts);

  updateDisplayValues();
  calculateLoad(false);
}

function openEquipModal() {
  focusField("equip");
  renderEquipChecklist();
  document.getElementById("equip-modal").style.display = "block";
}
function closeEquipModal() {
  document.getElementById("equip-modal").style.display = "none";
}

/* ---------- Core Calculation ---------- */
function calculateLoad(save = false) {
  const room = getSelectedRoom();
  if (!room) return;

  const volM3 = parseFloat(inputs.display) || 0;
  const people = parseInt(inputs.people || "0", 10) || 0;
  const equipWatts = parseFloat(inputs.equip) || 0;

  // CFM from ACH + people ventilation allowance
  const cfmACH = ((volM3 * 35.3147) * room.ach) / 60;
  const cfmPeople = people * 15; // quick ventilation allowance
  const cfm = Math.max(0, Math.round(cfmACH + cfmPeople));

  // Sensible load estimation:
  // Air sensible: 1.08 * CFM * ΔT(F)
  const airBTU = 1.08 * cfm * room.deltaT_F;
  const peopleBTU = people * room.peopleSensibleBTU;
  const equipBTU = equipWatts * 3.412;

  // Small design allowance for field reality
  const diversityFactor = room.categoryKey === "hospital" ? 1.08 : 1.12;
  const totalBTU = (airBTU + peopleBTU + equipBTU) * diversityFactor;
  const tr = totalBTU / 12000;

  const marketBTU = roundToMarketBTU(totalBTU);
  const ductSize = computeDuctSize(cfm);

  document.getElementById("tr-result").textContent = `${enNum(tr, 2)} TR`;
  document.getElementById("cfm-result").textContent = `${enNum(cfm)} CFM`;
  document.getElementById("btu-result").textContent = `${enNum(Math.round(totalBTU))} BTU/h`;
  document.getElementById("btu-market-result").textContent = `${enNum(marketBTU)} BTU (Market)`;

  if (save && volM3 > 0) {
    calcHistory.unshift({
      id: Date.now(),
      room_ar: room.ar,
      room_en: room.en,
      category: room.categoryKey,
      volume: volM3,
      people,
      equipWatts,
      ach: room.ach,
      cfm,
      tr: Number(tr.toFixed(2)),
      btu: Math.round(totalBTU),
      marketBTU,
      duct: ductSize
    });
    updateHistoryUI();
  }
}

/* ---------- History ---------- */
function updateHistoryUI() {
  const container = document.getElementById("history-list");
  if (!calcHistory.length) {
    container.innerHTML = `<div class="muted" style="padding:8px 2px;">${currentLang === "ar" ? "لا يوجد سجل بعد" : "No history yet"}</div>`;
    return;
  }

  container.innerHTML = calcHistory.map((item, index) => {
    const roomName = currentLang === "ar" ? item.room_ar : item.room_en;
    return `
      <div class="swipe-item" onclick="deleteItem(${item.id})" title="${currentLang === "ar" ? "اضغط للحذف" : "Tap to delete"}">
        <div class="info">
          <div class="room-name">#${enNum(calcHistory.length - index)} • ${roomName}</div>
          <div class="meta">
            V: ${enNum(item.volume)} m³ | P: ${enNum(item.people)} | W: ${enNum(item.equipWatts)}<br>
            ACH: ${enNum(item.ach)} | Duct: ${item.duct}
          </div>
        </div>
        <div class="vals">
          <div class="tr-val">${enNum(item.tr, 2)} TR</div>
          <div>${enNum(item.cfm)} CFM</div>
          <div>${enNum(item.marketBTU)} BTU</div>
        </div>
      </div>
    `;
  }).join("");
}

function deleteItem(id) {
  const msg = currentLang === "ar" ? "حذف السجل؟" : "Delete this record?";
  if (!confirm(msg)) return;
  calcHistory = calcHistory.filter(i => i.id !== id);
  updateHistoryUI();
}

function clearHistory() {
  const msg = currentLang === "ar" ? "مسح سجل الحسابات بالكامل؟" : "Clear calculation history?";
  if (!confirm(msg)) return;
  calcHistory = [];
  updateHistoryUI();
}

/* ---------- Tabs / Settings ---------- */
function switchTab(id, btn) {
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if (btn) btn.classList.add("active");
}

function toggleLanguage() {
  currentLang = currentLang === "ar" ? "en" : "ar";

  // keep numbers English, only switch labels/layout
  const html = document.getElementById("html-tag");
  html.lang = currentLang;
  html.dir = currentLang === "ar" ? "rtl" : "ltr";

  document.querySelectorAll("[data-ar]").forEach(el => {
    const txt = el.getAttribute(`data-${currentLang}`);
    if (txt !== null) el.textContent = txt;
  });

  // update top language button text
  const langBtn = document.getElementById("lang-text");
  if (langBtn) langBtn.textContent = currentLang === "ar" ? "English" : "العربية";

  // preserve selected room
  const selectedId = document.getElementById("room-select").value;
  updateRoomSelect();
  if (selectedId) document.getElementById("room-select").value = selectedId;

  renderEquipChecklist();
  updateHistoryUI();
}

/* ---------- Export ---------- */
function exportHistoryCSV() {
  const status = document.getElementById("export-status");
  if (!calcHistory.length) {
    status.textContent = currentLang === "ar" ? "لا يوجد بيانات للتصدير" : "No history to export";
    return;
  }

  const headers = [
    "Room",
    "Category",
    "Volume_m3",
    "People",
    "Equipment_W",
    "ACH",
    "CFM",
    "TR",
    "BTU_h",
    "Market_BTU",
    "Duct_Size"
  ];

  const rows = calcHistory.map(item => [
    `"${(currentLang === "ar" ? item.room_ar : item.room_en).replace(/"/g, '""')}"`,
    item.category,
    item.volume,
    item.people,
    item.equipWatts,
    item.ach,
    item.cfm,
    item.tr,
    item.btu,
    item.marketBTU,
    `"${item.duct}"`
  ]);

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "aircalcpro_history.csv";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  status.textContent = currentLang === "ar" ? "تم تصدير ملف CSV بنجاح" : "CSV exported successfully";
}

/* ---------- Service Worker ---------- */
function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}