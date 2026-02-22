/* Air Calc Pro - Main App */
let currentLang = "ar";
let activeField = "display";
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];

let roomData = { categories: [] };
let flatRooms = []; // flattened for quick lookup

// ---- Equipment database (filtered by selected room domain) ----
const equipmentCatalog = {
  common: [
    { id: "pc", ar: "💻 كمبيوتر مكتبي", en: "Desktop PC", watts: 200, count: 0 },
    { id: "laptop", ar: "💼 لابتوب", en: "Laptop", watts: 90, count: 0 },
    { id: "monitor", ar: "🖥️ شاشة", en: "Monitor", watts: 60, count: 0 },
    { id: "tv", ar: "📺 شاشة عرض كبيرة", en: "Large Display", watts: 180, count: 0 },
    { id: "printer", ar: "🖨️ طابعة", en: "Printer", watts: 500, count: 0 },
    { id: "fridge_small", ar: "🧊 ثلاجة صغيرة", en: "Small Fridge", watts: 180, count: 0 }
  ],
  medical: [
    { id: "patient_monitor", ar: "🫀 شاشة مراقبة مريض", en: "Patient Monitor", watts: 120, count: 0 },
    { id: "ventilator", ar: "🫁 جهاز تنفس صناعي", en: "Ventilator", watts: 300, count: 0 },
    { id: "infusion_pump", ar: "💉 مضخة محاليل", en: "Infusion Pump", watts: 60, count: 0 },
    { id: "anesthesia", ar: "😷 جهاز تخدير", en: "Anesthesia Machine", watts: 500, count: 0 },
    { id: "surgical_light", ar: "💡 إضاءة جراحية", en: "Surgical Light", watts: 180, count: 0 },
    { id: "autoclave", ar: "♨️ أوتوكلاف تعقيم", en: "Autoclave", watts: 2000, count: 0 },
    { id: "lab_analyzer", ar: "🧪 جهاز تحليل مخبري", en: "Lab Analyzer", watts: 700, count: 0 },
    { id: "xray_unit", ar: "🩻 جهاز أشعة", en: "X-Ray Unit", watts: 2200, count: 0 },
    { id: "ultrasound", ar: "🔊 جهاز ألتراساوند", en: "Ultrasound", watts: 250, count: 0 },
    { id: "med_fridge", ar: "🧊 ثلاجة أدوية", en: "Medical Fridge", watts: 350, count: 0 }
  ],
  commercial: [
    { id: "pos", ar: "💳 جهاز كاشير (POS)", en: "POS Terminal", watts: 80, count: 0 },
    { id: "display_sign", ar: "🔆 شاشة إعلانية", en: "Digital Signage", watts: 220, count: 0 },
    { id: "espresso", ar: "☕ ماكينة قهوة", en: "Coffee Machine", watts: 1500, count: 0 },
    { id: "freezer", ar: "🧊 فريزر عرض", en: "Display Freezer", watts: 700, count: 0 },
    { id: "fridge_com", ar: "🧊 ثلاجة تجارية", en: "Commercial Fridge", watts: 900, count: 0 },
    { id: "oven", ar: "🔥 فرن تجاري", en: "Commercial Oven", watts: 3000, count: 0 },
    { id: "mixer", ar: "🥣 خلاط/عجان", en: "Mixer", watts: 800, count: 0 },
    { id: "treadmill", ar: "🏃 سير رياضي", en: "Treadmill", watts: 1200, count: 0 },
    { id: "sound_amp", ar: "🔊 مضخم صوت", en: "Audio Amplifier", watts: 400, count: 0 }
  ],
  residential: [
    { id: "split_ac_aux", ar: "❄️ سبليت إضافي (مروحة/داخلي)", en: "Split Indoor Aux", watts: 250, count: 0 },
    { id: "tv_home", ar: "📺 تلفزيون", en: "TV", watts: 150, count: 0 },
    { id: "router", ar: "📶 راوتر", en: "WiFi Router", watts: 20, count: 0 },
    { id: "microwave", ar: "🍽️ مايكرويف", en: "Microwave", watts: 1200, count: 0 },
    { id: "fridge_home", ar: "🧊 ثلاجة منزلية", en: "Home Fridge", watts: 250, count: 0 },
    { id: "washing_machine", ar: "🧺 غسالة", en: "Washing Machine", watts: 600, count: 0 },
    { id: "dryer", ar: "🌀 نشافة", en: "Dryer", watts: 1800, count: 0 },
    { id: "dishwasher", ar: "🍽️ غسالة صحون", en: "Dishwasher", watts: 1400, count: 0 },
    { id: "water_heater", ar: "🚿 سخان ماء", en: "Water Heater", watts: 1500, count: 0 }
  ]
};

window.onload = async () => {
  await loadRooms();
  populateRoomSelect();
  onRoomChange();
  focusField("display");
  updateDisplayValues();
  calculateLoad(false);
  registerSW();
};

// ---------- PWA ----------
function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}

// ---------- Data loading ----------
async function loadRooms() {
  const fallback = {
    categories: [
      {
        name_ar: "المستشفيات (ASHRAE 170)",
        name_en: "Hospitals (ASHRAE 170)",
        domain: "medical",
        method: "ashrae170_ach",
        items: [
          { id: "h_or", ar: "غرفة عمليات", en: "Operating Room", ach: 15, factor: 280 },
          { id: "h_aii", ar: "عزل سلبي AII", en: "AII Room", ach: 12, factor: 300 },
          { id: "h_patient", ar: "غرفة مريض", en: "Patient Room", ach: 6, factor: 350 }
        ]
      },
      {
        name_ar: "السكني",
        name_en: "Residential",
        domain: "residential",
        method: "saudi_practical",
        items: [{ id: "r_living", ar: "غرفة معيشة", en: "Living Room", ach: 4, factor: 350 }]
      }
    ]
  };

  try {
    const r = await fetch(`./data.json?v=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) throw new Error("HTTP " + r.status);
    const txt = await r.text();
    roomData = JSON.parse(txt.replace(/\bNaN\b/g, "null"));
  } catch (e) {
    console.warn("Using fallback room data", e);
    roomData = fallback;
  }

  flatRooms = [];
  (roomData.categories || []).forEach(cat => {
    (cat.items || []).forEach(item => {
      flatRooms.push({ ...item, _cat: cat });
    });
  });
}

function populateRoomSelect() {
  const select = document.getElementById("room-select");
  if (!select) return;
  select.innerHTML = "";

  (roomData.categories || []).forEach(cat => {
    const group = document.createElement("optgroup");
    group.label = currentLang === "ar" ? cat.name_ar : cat.name_en;

    (cat.items || []).forEach(room => {
      const opt = document.createElement("option");
      opt.value = room.id;
      opt.textContent = currentLang === "ar" ? room.ar : room.en;
      opt.dataset.domain = cat.domain || "";
      opt.dataset.method = cat.method || "";
      opt.dataset.ach = room.ach ?? "";
      group.appendChild(opt);
    });

    select.appendChild(group);
  });
}

function getSelectedRoom() {
  const select = document.getElementById("room-select");
  if (!select || !select.value) return null;
  return flatRooms.find(r => r.id === select.value) || null;
}

// ---------- Room / equipment handling ----------
function onRoomChange() {
  // reset equipment only (keep volume/people if you want, but user asked safe behavior => reset all is okay)
  resetAllFields();
  renderEquipChecklist();
  updateBadges();
  calculateLoad(false);
}

function getCurrentDomain() {
  const room = getSelectedRoom();
  return room?._cat?.domain || "common";
}

function getCurrentMethod() {
  const room = getSelectedRoom();
  return room?._cat?.method || "saudi_practical";
}

function getEquipmentPool() {
  const domain = getCurrentDomain();
  const commonClone = equipmentCatalog.common.map(x => ({ ...x }));
  const domainClone = (equipmentCatalog[domain] || []).map(x => ({ ...x }));

  // restore previous counts if same item IDs already existed in old rendered list
  const oldMap = {};
  [...equipmentCatalog.common, ...equipmentCatalog.medical, ...equipmentCatalog.commercial, ...equipmentCatalog.residential]
    .forEach(i => { oldMap[i.id] = i.count || 0; });

  const merged = [...commonClone, ...domainClone];
  merged.forEach(i => { i.count = oldMap[i.id] || 0; });
  return merged;
}

function renderEquipChecklist() {
  const wrap = document.getElementById("equip-checklist");
  const badge = document.getElementById("equip-category-badge");
  if (!wrap) return;

  const domain = getCurrentDomain();
  const domainName = {
    medical: currentLang === "ar" ? "طبي" : "Medical",
    commercial: currentLang === "ar" ? "تجاري" : "Commercial",
    residential: currentLang === "ar" ? "سكني" : "Residential"
  };
  if (badge) badge.textContent = `${currentLang === "ar" ? "الفئة" : "Type"}: ${domainName[domain] || domain}`;

  // build active pool and sync counts into source catalogs
  window._activeEquipList = getEquipmentPool();

  wrap.innerHTML = window._activeEquipList.map((item, idx) => `
    <div class="equip-item-row">
      <div>
        <div class="title">${currentLang === "ar" ? item.ar : item.en}</div>
        <div class="sub">${item.watts} W</div>
      </div>
      <div class="counter-ctrl">
        <button class="counter-btn" onclick="changeCount(${idx}, -1)">−</button>
        <span id="cnt-${idx}" style="margin:0 10px;min-width:16px;display:inline-block;text-align:center">${item.count}</span>
        <button class="counter-btn" onclick="changeCount(${idx}, 1)">+</button>
      </div>
    </div>
  `).join("");

  recalcEquipWattsFromActiveList();
}

function changeCount(idx, delta) {
  if (!window._activeEquipList) return;
  const item = window._activeEquipList[idx];
  if (!item) return;
  item.count = Math.max(0, (item.count || 0) + delta);
  const cnt = document.getElementById(`cnt-${idx}`);
  if (cnt) cnt.textContent = item.count;

  // sync back to master catalogs
  [equipmentCatalog.common, equipmentCatalog.medical, equipmentCatalog.commercial, equipmentCatalog.residential].forEach(arr => {
    const found = arr.find(x => x.id === item.id);
    if (found) found.count = item.count;
  });

  recalcEquipWattsFromActiveList();
  calculateLoad(false);
}

function recalcEquipWattsFromActiveList() {
  const total = (window._activeEquipList || []).reduce((sum, x) => sum + (x.watts * (x.count || 0)), 0);
  inputs.equip = String(total);
  updateDisplayValues();
}

// ---------- Calculator ----------
function calculateLoad(save = false) {
  const room = getSelectedRoom();
  if (!room) return;

  const volumeM3 = parseFloat(inputs.display) || 0;
  const people = parseInt(inputs.people || "0", 10) || 0;
  const equipWatts = parseFloat(inputs.equip) || 0;

  const ach = Number(room.ach || 0);
  const factor = Number(room.factor || 350);
  const method = getCurrentMethod();
  const isHospital = method === "ashrae170_ach";

  // 1) Ventilation CFM from ACH
  const cfmFromAch = ach > 0 ? ((volumeM3 * 35.3147 * ach) / 60) : 0;

  // 2) Extra air for people (practical allowance)
  // medical lower, others normal
  const peopleCfmEach = isHospital ? 10 : 15;
  const cfmPeople = people * peopleCfmEach;

  // 3) CFM result
  let cfm = Math.round(cfmFromAch + cfmPeople);

  // 4) BTU/TR
  // Hospital: air-dominant basis + internal gains
  // Non-hospital: practical Saudi factor basis + internal gains
  let btu;
  if (isHospital) {
    // sensible-ish approximation from airflow + internal loads
    // factor here is room-specific temp/load intensity indicator
    btu = (cfm * factor) + (people * 450) + (equipWatts * 3.412);
  } else {
    // practical factor method (volume-based) + people + equipment
    btu = ((volumeM3 * 35.3147) * factor) + (people * 450) + (equipWatts * 3.412);
    // sanity cap: ensure ventilation cfm not absurdly low compared to load-derived rough cfm
    const cfmFromLoadSanity = btu / 400; // rough field sanity
    cfm = Math.round(Math.max(cfm, cfmFromLoadSanity * 0.8));
  }

  // round carefully
  btu = Math.round(btu);
  const tr = btu / 12000;
  const trFixed = tr.toFixed(2);

  const marketBtu = getNearestMarketBTU(btu);

  // Duct sizing quick helper
  document.getElementById("targetCFM").value = cfm;

  // UI update
  document.getElementById("tr-result").innerText = `${trFixed} TR`;
  document.getElementById("cfm-result").innerText = `${formatNum(cfm)} CFM`;
  document.getElementById("btu-result").innerText = `${formatNum(btu)} BTU/h`;
  document.getElementById("btu-market-result").innerText = `${currentLang === "ar" ? "المقترح" : "Suggested"}: ${formatNum(marketBtu)} BTU`;

  updateBadges();

  if (save) {
    const ductRec = quickDuctFromCFM(cfm, 12); // assume 12" width for quick history note
    calcHistory.push({
      id: Date.now(),
      roomAr: room.ar,
      roomEn: room.en,
      method,
      ach,
      volumeM3,
      people,
      equipWatts,
      cfm,
      btu,
      marketBtu,
      tr: Number(trFixed),
      duct: ductRec
    });
    updateHistoryUI();
  }
}

function updateBadges() {
  const room = getSelectedRoom();
  if (!room) return;

  const basisBadge = document.getElementById("basis-badge");
  const achBadge = document.getElementById("ach-badge");
  const methodBadge = document.getElementById("method-badge");

  const method = getCurrentMethod();
  const basisTextAr = room?._cat?.domain === "medical" ? "المرجع: ASHRAE 170" : "مرجع عملي (السعودية)";
  const basisTextEn = room?._cat?.domain === "medical" ? "Ref: ASHRAE 170" : "Practical Ref (Saudi)";

  if (basisBadge) basisBadge.textContent = currentLang === "ar" ? basisTextAr : basisTextEn;
  if (achBadge) achBadge.textContent = `ACH: ${room.ach ?? "—"}`;

  if (methodBadge) {
    const text = method === "ashrae170_ach"
      ? (currentLang === "ar" ? "الطريقة: ACH" : "Method: ACH")
      : (currentLang === "ar" ? "الطريقة: عامل + أحمال" : "Method: Factor + Loads");
    methodBadge.textContent = text;
  }
}

function getNearestMarketBTU(btu) {
  // common market sizes in Saudi/GCC
  const sizes = [9000,12000,18000,24000,30000,36000,48000,60000,72000,96000,120000];
  let nearest = sizes[0];
  let minDiff = Math.abs(btu - nearest);
  for (const s of sizes) {
    const d = Math.abs(btu - s);
    if (d < minDiff) { minDiff = d; nearest = s; }
  }
  return nearest;
}

function quickDuctFromCFM(cfm, widthIn = 12) {
  // approximate rectangular duct at ~800 fpm
  if (!cfm || !widthIn) return "-";
  const areaIn2 = (cfm / 800) * 144;
  const h = Math.max(6, Math.round(areaIn2 / widthIn));
  return `${widthIn}" x ${h}"`;
}

function runDuctCalc() {
  const cfm = parseFloat(document.getElementById("targetCFM").value);
  const w = parseFloat(document.getElementById("fixWidth").value);
  if (cfm > 0 && w > 0) {
    const duct = quickDuctFromCFM(cfm, w);
    document.getElementById("duct-result").innerText = duct;
  } else {
    document.getElementById("duct-result").innerText = "---";
  }
}

// ---------- History ----------
function updateHistoryUI() {
  const container = document.getElementById("history-list");
  if (!container) return;

  if (!calcHistory.length) {
    container.innerHTML = `<div class="sub" style="color:#8e8e93;padding:8px 0;">
      ${currentLang === "ar" ? "لا يوجد عمليات محفوظة" : "No saved calculations"}
    </div>`;
    return;
  }

  const list = [...calcHistory].reverse();

  container.innerHTML = list.map((item, idx) => {
    const roomName = currentLang === "ar" ? item.roomAr : item.roomEn;
    const methodText = item.method === "ashrae170_ach"
      ? (currentLang === "ar" ? "ACH طبي" : "Medical ACH")
      : (currentLang === "ar" ? "عملي" : "Practical");

    return `
      <div class="swipe-item">
        <div class="info">
          <div class="room">#${calcHistory.length - idx} — ${roomName}</div>
          <div class="sub">
            ${currentLang === "ar" ? "الحجم" : "Vol"}: ${formatNum(item.volumeM3)} m³ •
            ${currentLang === "ar" ? "أشخاص" : "People"}: ${item.people} •
            ${methodText}
          </div>
          <div class="sub">
            CFM ${formatNum(item.cfm)} • BTU ${formatNum(item.marketBtu)} •
            ${currentLang === "ar" ? "دكت تقريبي" : "Duct"} ${item.duct}
          </div>
          <button class="del-mini" onclick="deleteItem(${item.id})">
            ${currentLang === "ar" ? "حذف" : "Delete"}
          </button>
        </div>
        <div class="vals">
          <div class="tr-val">${item.tr.toFixed(2)} TR</div>
          <div class="btu-val">${formatNum(item.btu)} BTU/h</div>
          <div>${formatNum(item.cfm)} CFM</div>
        </div>
      </div>
    `;
  }).join("");
}

function deleteItem(id) {
  const msg = currentLang === "ar" ? "حذف العملية؟" : "Delete this record?";
  if (confirm(msg)) {
    calcHistory = calcHistory.filter(i => i.id !== id);
    updateHistoryUI();
  }
}

function clearHistory() {
  const msg = currentLang === "ar" ? "مسح كل السجل؟" : "Clear all history?";
  if (confirm(msg)) {
    calcHistory = [];
    updateHistoryUI();
  }
}

function exportHistoryCsv() {
  if (!calcHistory.length) {
    alert(currentLang === "ar" ? "لا يوجد سجل للتصدير" : "No history to export");
    return;
  }

  const headers = [
    "Room","Method","Volume_m3","People","Equip_W","ACH","CFM","BTU_h","Market_BTU","TR","Duct"
  ];

  const rows = calcHistory.map(i => [
    `"${(currentLang === "ar" ? i.roomAr : i.roomEn).replace(/"/g, '""')}"`,
    i.method,
    i.volumeM3,
    i.people,
    i.equipWatts,
    i.ach,
    i.cfm,
    i.btu,
    i.marketBtu,
    i.tr,
    `"${i.duct}"`
  ]);

  const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "aircalc_history.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- UI helpers ----------
function press(n) {
  const v = String(n);

  if (activeField === "equip") {
    // equip field is modal-driven, ignore keypad
    return;
  }

  if (activeField === "people") {
    // people integer only
    if (v === ".") return;
    if (inputs.people === "0") inputs.people = v;
    else inputs.people += v;
  } else {
    // display volume field can accept decimal
    if (v === "." && (inputs.display || "").includes(".")) return;
    if (inputs.display === "0" && v !== ".") inputs.display = v;
    else if (inputs.display === "0" && v === ".") inputs.display = "0.";
    else inputs.display += v;
  }

  updateDisplayValues();
  calculateLoad(false);
}

function deleteLast() {
  if (activeField === "equip") return;
  const key = activeField;
  inputs[key] = (inputs[key] || "").slice(0, -1);
  if (!inputs[key]) inputs[key] = "0";
  updateDisplayValues();
  calculateLoad(false);
}

function clearActiveField() {
  if (activeField === "equip") {
    // clear all equipment counts
    [equipmentCatalog.common, equipmentCatalog.medical, equipmentCatalog.commercial, equipmentCatalog.residential].forEach(arr => {
      arr.forEach(i => i.count = 0);
    });
    if (window._activeEquipList) window._activeEquipList.forEach(i => i.count = 0);
    renderEquipChecklist();
  } else {
    inputs[activeField] = "0";
  }
  updateDisplayValues();
  calculateLoad(false);
}

function resetAllFields() {
  inputs = { display: "0", people: "0", equip: "0" };
  [equipmentCatalog.common, equipmentCatalog.medical, equipmentCatalog.commercial, equipmentCatalog.residential].forEach(arr => {
    arr.forEach(i => i.count = 0);
  });
  renderEquipChecklist();
  updateDisplayValues();
}

function updateDisplayValues() {
  const d = document.getElementById("display");
  const p = document.getElementById("people-count");
  const e = document.getElementById("equip-watts");
  if (d) d.innerText = inputs.display || "0";
  if (p) p.value = inputs.people || "0";
  if (e) e.value = inputs.equip || "0";
}

function focusField(f) {
  activeField = f;
  document.getElementById("display")?.classList.remove("active-field");
  document.getElementById("people-count")?.classList.remove("active-field");
  document.getElementById("equip-watts")?.classList.remove("active-field");

  if (f === "display") document.getElementById("display")?.classList.add("active-field");
  if (f === "people") document.getElementById("people-count")?.classList.add("active-field");
  if (f === "equip") document.getElementById("equip-watts")?.classList.add("active-field");
}

function openEquipModal() {
  document.getElementById("equip-modal").style.display = "block";
  focusField("equip");
}
function closeEquipModal() {
  document.getElementById("equip-modal").style.display = "none";
  focusField("display");
}

function switchTab(id, btn) {
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(id)?.classList.add("active");
  btn?.classList.add("active");
}

function toggleLanguage() {
  currentLang = currentLang === "ar" ? "en" : "ar";

  const html = document.getElementById("html-tag");
  html.lang = currentLang;
  html.dir = currentLang === "ar" ? "rtl" : "ltr";

  // translate static labels
  document.querySelectorAll("[data-ar]").forEach(el => {
    const text = el.getAttribute(`data-${currentLang}`);
    if (text) el.textContent = text;
  });

  // repopulate room names and equipment names
  const selectedId = document.getElementById("room-select")?.value;
  populateRoomSelect();
  if (selectedId) document.getElementById("room-select").value = selectedId;

  renderEquipChecklist();
  updateHistoryUI();
  updateBadges();
  calculateLoad(false);
}

function formatNum(n) {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return "0";
  return Number(n).toLocaleString(currentLang === "ar" ? "ar-SA" : "en-US");
}