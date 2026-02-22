/* Air Calc Pro - Stable Core Build (v1) */
/* Numbers are always English digits */

let currentLang = localStorage.getItem("aircalc_lang") || "ar";
let activeField = "display";
let roomData = { categories: [] };

let inputs = {
  display: "0", // volume m3
  people: "0",
  equip: "0"
};

let calcHistory = JSON.parse(localStorage.getItem("aircalc_history") || "[]");

let selectedEquipCounts = {}; // {equipId: count}
let lastCalc = null;

// Equipment catalog with profiles (filtered by room type)
const EQUIPMENT_CATALOG = [
  // Common
  { id: "pc", ar: "كمبيوتر مكتبي", en: "Desktop PC", watts: 200, profiles: ["common", "commercial", "medical"] },
  { id: "laptop", ar: "لابتوب", en: "Laptop", watts: 90, profiles: ["common", "commercial", "medical", "home"] },
  { id: "monitor", ar: "شاشة", en: "Monitor", watts: 35, profiles: ["common", "commercial", "medical", "home"] },
  { id: "printer", ar: "طابعة", en: "Printer", watts: 600, profiles: ["common", "commercial", "medical"] },
  { id: "fridge_small", ar: "ثلاجة صغيرة", en: "Small Fridge", watts: 180, profiles: ["common", "commercial", "home"] },

  // Medical
  { id: "anesthesia", ar: "جهاز تخدير", en: "Anesthesia Machine", watts: 1200, profiles: ["medical"] },
  { id: "or_light", ar: "إضاءة عمليات جراحية", en: "OR Surgical Light", watts: 300, profiles: ["medical"] },
  { id: "cautery", ar: "جهاز كي جراحي", en: "Electrosurgical Unit", watts: 400, profiles: ["medical"] },
  { id: "monitor_patient", ar: "شاشة مراقبة مريض", en: "Patient Monitor", watts: 80, profiles: ["medical"] },
  { id: "ventilator", ar: "جهاز تنفس صناعي", en: "Ventilator", watts: 350, profiles: ["medical"] },
  { id: "infusion", ar: "مضخة محاليل", en: "Infusion Pump", watts: 50, profiles: ["medical"] },
  { id: "defib", ar: "جهاز صدمات قلبية", en: "Defibrillator", watts: 250, profiles: ["medical"] },
  { id: "ultrasound", ar: "جهاز ألتراساوند", en: "Ultrasound System", watts: 500, profiles: ["medical"] },
  { id: "xray_mobile", ar: "أشعة متنقلة", en: "Mobile X-ray", watts: 1500, profiles: ["medical"] },
  { id: "endoscopy_tower", ar: "برج مناظير", en: "Endoscopy Tower", watts: 1200, profiles: ["medical"] },
  { id: "centrifuge", ar: "جهاز طرد مركزي", en: "Centrifuge", watts: 350, profiles: ["medical"] },
  { id: "lab_analyzer", ar: "محلل مختبري", en: "Lab Analyzer", watts: 700, profiles: ["medical"] },
  { id: "biosafety", ar: "خزانة سلامة حيوية", en: "Biosafety Cabinet", watts: 900, profiles: ["medical"] },
  { id: "autoclave", ar: "أوتوكلاف تعقيم", en: "Autoclave", watts: 3000, profiles: ["medical"] },
  { id: "cssd_washer", ar: "غسالة أدوات CSSD", en: "Instrument Washer", watts: 2500, profiles: ["medical"] },
  { id: "med_fridge", ar: "ثلاجة أدوية/مختبر", en: "Medical Fridge", watts: 350, profiles: ["medical"] },

  // Commercial
  { id: "pos", ar: "جهاز كاشير", en: "POS System", watts: 120, profiles: ["commercial"] },
  { id: "display_sign", ar: "شاشة إعلانية", en: "Display Sign", watts: 150, profiles: ["commercial"] },
  { id: "coffee", ar: "ماكينة قهوة", en: "Coffee Machine", watts: 1500, profiles: ["commercial"] },
  { id: "freezer", ar: "فريزر تجاري", en: "Commercial Freezer", watts: 800, profiles: ["commercial"] },
  { id: "oven_small", ar: "فرن تجاري صغير", en: "Commercial Oven", watts: 2500, profiles: ["commercial"] },
  { id: "mixer", ar: "خلاط/عجانة", en: "Mixer", watts: 700, profiles: ["commercial"] },
  { id: "gym_treadmill", ar: "سير رياضي", en: "Treadmill", watts: 900, profiles: ["commercial"] },
  { id: "gym_bike", ar: "دراجة رياضية", en: "Exercise Bike", watts: 200, profiles: ["commercial"] },

  // Home
  { id: "tv", ar: "تلفزيون", en: "TV", watts: 120, profiles: ["home"] },
  { id: "washer", ar: "غسالة", en: "Washing Machine", watts: 600, profiles: ["home"] },
  { id: "dryer", ar: "نشافة", en: "Dryer", watts: 2000, profiles: ["home"] },
  { id: "microwave", ar: "مايكروويف", en: "Microwave", watts: 1200, profiles: ["home"] },
  { id: "air_fryer", ar: "قلاية هوائية", en: "Air Fryer", watts: 1500, profiles: ["home"] },
  { id: "vacuum", ar: "مكنسة كهربائية", en: "Vacuum Cleaner", watts: 800, profiles: ["home"] },
  { id: "router", ar: "راوتر", en: "Router", watts: 15, profiles: ["home", "common", "commercial"] }
];

// ---------- INIT ----------
window.addEventListener("DOMContentLoaded", async () => {
  applyLanguageDirection();
  await loadRoomData();
  populateRoomSelect();
  restoreState();
  bindEvents();
  updateInputsUI();
  updateRoomMeta();
  renderEquipmentModal();
  renderHistory();
  calculateNow(false);
  registerSW();
});

function bindEvents() {
  document.getElementById("room-select").addEventListener("change", onRoomChanged);
}

// ---------- DATA ----------
async function loadRoomData() {
  try {
    const res = await fetch("./data.json");
    roomData = await res.json();
  } catch (e) {
    console.error("Failed to load data.json", e);
    roomData = { categories: [] };
  }
}

function populateRoomSelect() {
  const select = document.getElementById("room-select");
  select.innerHTML = "";

  roomData.categories.forEach(cat => {
    const og = document.createElement("optgroup");
    og.label = currentLang === "ar" ? cat.name_ar : cat.name_en;

    cat.items.forEach(item => {
      const opt = document.createElement("option");
      opt.value = item.id;
      opt.textContent = currentLang === "ar" ? item.ar : item.en;
      opt.dataset.catId = cat.id;
      og.appendChild(opt);
    });

    select.appendChild(og);
  });

  if (!select.value && select.options.length) {
    select.selectedIndex = 0;
  }
}

// ---------- LANGUAGE ----------
function toggleLanguage() {
  currentLang = currentLang === "ar" ? "en" : "ar";
  localStorage.setItem("aircalc_lang", currentLang);

  applyLanguageDirection();

  document.querySelectorAll("[data-ar]").forEach(el => {
    el.textContent = currentLang === "ar" ? el.getAttribute("data-ar") : el.getAttribute("data-en");
  });

  document.getElementById("lang-btn").textContent = currentLang === "ar" ? "English" : "العربية";

  const currentRoomId = getCurrentRoom()?.id;
  populateRoomSelect();
  if (currentRoomId) {
    const select = document.getElementById("room-select");
    const found = Array.from(select.options).find(o => o.value === currentRoomId);
    if (found) select.value = currentRoomId;
  }

  updateRoomMeta();
  renderEquipmentModal();
  renderHistory();
  updateInputsUI();
  updateResultsUI(lastCalc || getEmptyCalc());
}

function applyLanguageDirection() {
  const html = document.getElementById("html-tag");
  html.setAttribute("lang", currentLang);
  html.setAttribute("dir", currentLang === "ar" ? "rtl" : "ltr");

  const langBtn = document.getElementById("lang-btn");
  if (langBtn) langBtn.textContent = currentLang === "ar" ? "English" : "العربية";
}

// ---------- INPUTS ----------
function focusField(field) {
  activeField = field;
  document.getElementById("display").classList.remove("active-field");
  document.getElementById("people-input").classList.remove("active-field");
  document.getElementById("equip-input").classList.remove("active-field");

  if (field === "display") document.getElementById("display").classList.add("active-field");
  if (field === "people") document.getElementById("people-input").classList.add("active-field");
  if (field === "equip") document.getElementById("equip-input").classList.add("active-field");
}

function press(val) {
  const key = activeField === "display" ? "display" : (activeField === "people" ? "people" : "equip");

  // equip field is driven by modal only
  if (key === "equip") return;

  let current = inputs[key];

  if (val === "." && current.includes(".")) return;

  if (current === "0" && val !== ".") current = val;
  else if (current === "0" && val === ".") current = "0.";
  else current += val;

  inputs[key] = sanitizeNumericString(current, key === "people");
  updateInputsUI();
}

function deleteLast() {
  const key = activeField === "display" ? "display" : (activeField === "people" ? "people" : "equip");
  if (key === "equip") return;
  let s = inputs[key];
  s = s.slice(0, -1);
  if (!s || s === "-" || s === ".") s = "0";
  inputs[key] = sanitizeNumericString(s, key === "people");
  updateInputsUI();
}

function clearAllInputs() {
  inputs.display = "0";
  inputs.people = "0";
  selectedEquipCounts = {};
  recalcEquipWatts();
  updateInputsUI();
  calculateNow(false);
}

function sanitizeNumericString(v, integerOnly = false) {
  v = String(v).replace(/[^\d.]/g, "");
  if (integerOnly) v = v.replace(/\./g, "");
  const parts = v.split(".");
  if (parts.length > 2) v = parts[0] + "." + parts.slice(1).join("");
  if (v === "") v = "0";
  return v;
}

function updateInputsUI() {
  document.getElementById("display").textContent = toEnglishDigits(inputs.display || "0");
  document.getElementById("people-input").value = toEnglishDigits(inputs.people || "0");
  document.getElementById("equip-input").value = toEnglishDigits(inputs.equip || "0");
}

function onRoomChanged() {
  // Keep values, just refresh equipment filtering/meta/calculation
  renderEquipmentModal();
  updateRoomMeta();
  calculateNow(false);
  saveState();
}

// ---------- ROOM HELPERS ----------
function getCurrentRoom() {
  const select = document.getElementById("room-select");
  const roomId = select.value;

  for (const cat of roomData.categories) {
    const found = cat.items.find(i => i.id === roomId);
    if (found) {
      return { ...found, category: cat };
    }
  }
  return null;
}

function updateRoomMeta() {
  const room = getCurrentRoom();
  if (!room) return;

  const basisLabel = currentLang === "ar" ? room.basis_ar : room.basis_en;
  const roomLabel = currentLang === "ar" ? room.ar : room.en;

  document.getElementById("room-meta").textContent = `${basisLabel} • ACH: ${formatNum(room.ach)} • ${roomLabel}`;
  document.getElementById("chip-standard").textContent = basisLabel;
  document.getElementById("chip-ach").textContent = `ACH: ${formatNum(room.ach)}`;
}

// ---------- CALC CORE (STABLE) ----------
function calculateNow(saveToHistory = false) {
  const room = getCurrentRoom();
  if (!room) return;

  const volumeM3 = parseFloat(inputs.display) || 0;
  const people = parseInt(inputs.people || "0", 10) || 0;
  const equipW = parseFloat(inputs.equip) || 0;

  // 1) CFM from ACH + people OA (simple practical add)
  const baseCFM = (volumeM3 * 35.3147 * room.ach) / 60;
  const peopleCFM = people * (room.people_cfm || 15);
  const totalCFM = Math.max(0, Math.round(baseCFM + peopleCFM));

  // 2) BTU from airflow + people sensible/latent + equipment
  //    DeltaT chosen by category/use to keep realistic practical values.
  const deltaT = room.deltaT_F ?? 18;
  const airBtu = 1.08 * totalCFM * deltaT;
  const peopleBtu = people * (room.people_btu || 450);
  const equipBtu = equipW * 3.412;

  let totalBTU = airBtu + peopleBtu + equipBtu;

  // Safety / diversity factor
  const sf = room.safety_factor ?? 1.10;
  totalBTU *= sf;

  // 3) TR
  const tr = totalBTU / 12000;

  // 4) Market BTU suggestion (nearest common market size)
  const marketBTU = nearestMarketBTU(totalBTU);

  // 5) Duct suggestion (using default velocity by room)
  const vel = room.duct_fpm || 800;
  const duct = suggestDuct(totalCFM, 12, vel); // fixed width 12"

  lastCalc = {
    roomId: room.id,
    roomNameAr: room.ar,
    roomNameEn: room.en,
    standardAr: room.basis_ar,
    standardEn: room.basis_en,
    ach: room.ach,
    volumeM3,
    people,
    equipW,
    cfm: totalCFM,
    btu: Math.round(totalBTU),
    tr: Number(tr.toFixed(2)),
    marketBtu: marketBTU,
    duct,
    ts: new Date().toISOString()
  };

  updateResultsUI(lastCalc);

  if (saveToHistory) {
    calcHistory.unshift({
      id: Date.now(),
      ...lastCalc
    });
    if (calcHistory.length > 50) calcHistory = calcHistory.slice(0, 50);
    renderHistory();
    persistHistory();
  }

  saveState();
}

function updateResultsUI(r) {
  document.getElementById("res-cfm").textContent = `CFM ${formatNum(r.cfm)}`;
  document.getElementById("res-tr").textContent = `TR ${formatNum(r.tr, 2)}`;
  document.getElementById("res-btu").textContent = `BTU/h ${formatNum(r.btu)}`;
  document.getElementById("res-market-btu").textContent = `BTU ${formatNum(r.marketBtu)}`;
  document.getElementById("chip-duct").textContent = `Duct: ${r.duct}`;
}

function getEmptyCalc() {
  return {
    cfm: 0,
    tr: 0,
    btu: 0,
    marketBtu: 0,
    duct: `12" x 0"`
  };
}

function nearestMarketBTU(btu) {
  const standardSizes = [
    9000, 12000, 18000, 24000, 30000, 36000, 42000, 48000, 54000, 60000,
    72000, 84000, 96000, 120000, 144000, 180000, 240000, 300000
  ];

  if (btu <= 0) return 0;

  // pick nearest but avoid undersizing harshly for critical spaces
  let nearest = standardSizes[0];
  let minDiff = Infinity;

  for (const s of standardSizes) {
    const diff = Math.abs(s - btu);
    if (diff < minDiff) {
      minDiff = diff;
      nearest = s;
    }
  }

  // if nearest is below actual by >7%, move up one size
  if (nearest < btu && ((btu - nearest) / btu) > 0.07) {
    const higher = standardSizes.find(s => s >= btu);
    if (higher) nearest = higher;
  }

  return nearest;
}

function suggestDuct(cfm, widthIn = 12, velocityFpm = 800) {
  if (!cfm || !widthIn) return `12" x 0"`;
  const areaFt2 = cfm / velocityFpm;
  const areaIn2 = areaFt2 * 144;
  let height = Math.round(areaIn2 / widthIn);
  if (height < 4) height = 4;
  return `${widthIn}" x ${height}"`;
}

// ---------- EQUIPMENT FILTERING ----------
function getRoomEquipProfile(room) {
  // category ids in data.json: healthcare/commercial/residential
  if (!room || !room.category) return ["common"];

  if (room.category.id === "healthcare") return ["medical", "common"];
  if (room.category.id === "commercial") return ["commercial", "common"];
  if (room.category.id === "residential") return ["home", "common"];
  return ["common"];
}

function renderEquipmentModal() {
  const room = getCurrentRoom();
  const profiles = getRoomEquipProfile(room);

  const filtered = EQUIPMENT_CATALOG.filter(eq => eq.profiles.some(p => profiles.includes(p)));
  const container = document.getElementById("equip-list");

  container.innerHTML = "";

  filtered.forEach(eq => {
    const count = selectedEquipCounts[eq.id] || 0;

    const row = document.createElement("div");
    row.className = "equip-row";

    const left = document.createElement("div");
    left.innerHTML = `
      <div class="equip-name">${currentLang === "ar" ? eq.ar : eq.en}</div>
      <div class="equip-sub">${formatNum(eq.watts)} W</div>
    `;

    const ctr = document.createElement("div");
    ctr.className = "equip-ctr";
    ctr.innerHTML = `
      <button class="ctr-btn" type="button">-</button>
      <span class="ctr-val">${formatNum(count)}</span>
      <button class="ctr-btn" type="button">+</button>
    `;

    const [minusBtn, , plusBtn] = ctr.children;
    minusBtn.addEventListener("click", () => changeEquipCount(eq.id, -1));
    plusBtn.addEventListener("click", () => changeEquipCount(eq.id, +1));

    row.appendChild(left);
    row.appendChild(ctr);
    container.appendChild(row);
  });
}

function changeEquipCount(equipId, delta) {
  const current = selectedEquipCounts[equipId] || 0;
  const next = Math.max(0, current + delta);
  selectedEquipCounts[equipId] = next;
  recalcEquipWatts();
  renderEquipmentModal();
  calculateNow(false);
  saveState();
}

function recalcEquipWatts() {
  let sum = 0;
  for (const eq of EQUIPMENT_CATALOG) {
    const c = selectedEquipCounts[eq.id] || 0;
    sum += c * eq.watts;
  }
  inputs.equip = String(Math.round(sum));
  updateInputsUI();
}

function openEquipModal() {
  focusField("equip");
  renderEquipmentModal();
  document.getElementById("equip-modal").classList.add("show");
}

function closeEquipModal() {
  document.getElementById("equip-modal").classList.remove("show");
}

// ---------- HISTORY ----------
function renderHistory() {
  const box = document.getElementById("history-list");
  box.innerHTML = "";

  if (!calcHistory.length) {
    const empty = document.createElement("div");
    empty.className = "history-item";
    empty.textContent = currentLang === "ar" ? "لا يوجد سجل بعد" : "No history yet";
    box.appendChild(empty);
    return;
  }

  calcHistory.forEach(item => {
    const card = document.createElement("div");
    card.className = "history-item";

    const roomName = currentLang === "ar" ? item.roomNameAr : item.roomNameEn;
    const standard = currentLang === "ar" ? item.standardAr : item.standardEn;

    card.innerHTML = `
      <div class="history-row-top">
        <div>
          <div class="history-room">${roomName}</div>
          <div class="history-standard">${standard} • ACH ${formatNum(item.ach)} • ${formatNum(item.volumeM3)} m³ • ${formatNum(item.people)} P • ${formatNum(item.equipW)} W</div>
        </div>
        <button class="small-btn" data-id="${item.id}">${currentLang === "ar" ? "حذف" : "Delete"}</button>
      </div>
      <div class="history-values">
        <div class="tr">TR ${formatNum(item.tr, 2)}</div>
        <div>CFM ${formatNum(item.cfm)}</div>
        <div>BTU ${formatNum(item.marketBtu)}</div>
        <div>${item.duct}</div>
      </div>
    `;

    card.querySelector("button").addEventListener("click", () => deleteHistoryItem(item.id));
    box.appendChild(card);
  });
}

function deleteHistoryItem(id) {
  calcHistory = calcHistory.filter(x => x.id !== id);
  persistHistory();
  renderHistory();
}

function clearHistory() {
  calcHistory = [];
  persistHistory();
  renderHistory();
}

function persistHistory() {
  localStorage.setItem("aircalc_history", JSON.stringify(calcHistory));
}

// ---------- TABS ----------
function switchTab(tabId, btn) {
  document.querySelectorAll(".tab-panel").forEach(s => s.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(b => b.classList.remove("active"));
  document.getElementById(tabId).classList.add("active");
  btn.classList.add("active");

  if (tabId === "tab-export") {
    fillExportPreview();
  }
}

// ---------- EXPORT ----------
function fillExportPreview() {
  const preview = document.getElementById("export-preview");
  preview.value = JSON.stringify(calcHistory, null, 2);
}

function exportHistoryJSON() {
  const data = JSON.stringify(calcHistory, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "aircalc-history.json";
  a.click();
  URL.revokeObjectURL(url);
  fillExportPreview();
}

async function copyHistoryText() {
  const lines = calcHistory.map((h, i) => {
    const room = currentLang === "ar" ? h.roomNameAr : h.roomNameEn;
    return `${i + 1}) ${room} | CFM ${h.cfm} | TR ${h.tr} | BTU ${h.marketBtu} | ${h.duct}`;
  }).join("\n");

  try {
    await navigator.clipboard.writeText(lines || "");
    document.getElementById("export-preview").value = lines || "";
  } catch {
    document.getElementById("export-preview").value = lines || "";
  }
}

// ---------- ASSISTANT ----------
function generateAssistantTip() {
  const out = document.getElementById("assistant-output");
  const room = getCurrentRoom();
  if (!lastCalc || !room) {
    out.textContent = currentLang === "ar" ? "احسب أولاً ثم اطلب ملاحظة." : "Run a calculation first, then ask for a tip.";
    return;
  }

  const tipsAr = [];
  const tipsEn = [];

  tipsAr.push(`الغرفة الحالية: ${room.ar}`);
  tipsEn.push(`Current room: ${room.en}`);

  if (room.category.id === "healthcare") {
    tipsAr.push("هذه غرفة صحية: الأفضل اعتماد التحقق النهائي من جدول الضغط والترشيح (HEPA/ضغط موجب/سالب) ضمن التصميم التفصيلي.");
    tipsEn.push("Healthcare room: final design should also verify pressure relationship and filtration (HEPA/positive/negative) in detailed design.");
  }

  if (lastCalc.equipW > 0) {
    tipsAr.push(`أحمال الأجهزة (${formatNum(lastCalc.equipW)} W) أثّرت على الحمل، راجع الأحمال الفعلية من كتالوج الأجهزة لرفع الدقة.`);
    tipsEn.push(`Equipment load (${formatNum(lastCalc.equipW)} W) affects cooling load. Use actual equipment datasheets for better accuracy.`);
  }

  if (lastCalc.people > 0) {
    tipsAr.push(`تمت إضافة تهوية أشخاص (${formatNum(lastCalc.people)} شخص). تأكد من occupancy الفعلي وقت الذروة.`);
    tipsEn.push(`People ventilation was added (${formatNum(lastCalc.people)} persons). Verify actual peak occupancy.`);
  }

  tipsAr.push(`المقترح السوقي الحالي: ${formatNum(lastCalc.marketBtu)} BTU (تقريب).`);
  tipsEn.push(`Current market suggestion: ${formatNum(lastCalc.marketBtu)} BTU (approx).`);

  out.textContent = currentLang === "ar" ? tipsAr.join(" ") : tipsEn.join(" ");
}

// ---------- SETTINGS ----------
function resetAppData() {
  localStorage.removeItem("aircalc_history");
  localStorage.removeItem("aircalc_state");
  calcHistory = [];
  selectedEquipCounts = {};
  inputs = { display: "0", people: "0", equip: "0" };
  updateInputsUI();
  renderHistory();
  calculateNow(false);
}

// ---------- PERSIST STATE ----------
function saveState() {
  const state = {
    currentLang,
    inputs,
    selectedRoomId: getCurrentRoom()?.id || null,
    selectedEquipCounts
  };
  localStorage.setItem("aircalc_state", JSON.stringify(state));
}

function restoreState() {
  const raw = localStorage.getItem("aircalc_state");
  if (!raw) {
    document.getElementById("lang-btn").textContent = currentLang === "ar" ? "English" : "العربية";
    return;
  }

  try {
    const s = JSON.parse(raw);

    if (s.currentLang && s.currentLang !== currentLang) {
      currentLang = s.currentLang;
      localStorage.setItem("aircalc_lang", currentLang);
      applyLanguageDirection();
      document.querySelectorAll("[data-ar]").forEach(el => {
        el.textContent = currentLang === "ar" ? el.getAttribute("data-ar") : el.getAttribute("data-en");
      });
    }

    if (s.inputs) {
      inputs.display = sanitizeNumericString(s.inputs.display || "0");
      inputs.people = sanitizeNumericString(s.inputs.people || "0", true);
      inputs.equip = sanitizeNumericString(s.inputs.equip || "0", true);
    }

    if (s.selectedEquipCounts) {
      selectedEquipCounts = s.selectedEquipCounts;
      recalcEquipWatts();
    }

    if (s.selectedRoomId) {
      const select = document.getElementById("room-select");
      const found = Array.from(select.options).find(o => o.value === s.selectedRoomId);
      if (found) select.value = s.selectedRoomId;
    }

    document.getElementById("lang-btn").textContent = currentLang === "ar" ? "English" : "العربية";
  } catch (e) {
    console.warn("state restore failed", e);
  }
}

// ---------- HELPERS ----------
function formatNum(value, decimals = 0) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  }).format(num);
}

function toEnglishDigits(str) {
  // Ensures no Arabic digits even if pasted
  return String(str).replace(/[٠-٩]/g, d => "٠١٢٣٤٥٦٧٨٩".indexOf(d)).replace(/[^\d.]/g, "");
}

// ---------- SERVICE WORKER ----------
function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
}