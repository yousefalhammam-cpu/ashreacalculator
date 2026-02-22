let currentLang = "ar";
let activeField = "display";
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];
let roomData = null;
let roomIndex = {}; // roomId -> {room, category, method}

const equipmentCatalog = [
  // Shared
  { id: "pc", ar: "كمبيوتر مكتبي", en: "Desktop PC", watts: 250, tags: ["shared", "commercial", "healthcare"] },
  { id: "laptop", ar: "لابتوب", en: "Laptop", watts: 90, tags: ["shared", "commercial", "healthcare", "residential"] },
  { id: "monitor", ar: "شاشة", en: "Monitor", watts: 60, tags: ["shared", "commercial", "healthcare", "residential"] },
  { id: "printer", ar: "طابعة", en: "Printer", watts: 600, tags: ["commercial", "healthcare"] },
  { id: "tv", ar: "شاشة تلفزيون", en: "TV Screen", watts: 180, tags: ["shared", "commercial", "residential"] },
  { id: "fridge_small", ar: "ثلاجة صغيرة", en: "Mini Fridge", watts: 200, tags: ["shared", "commercial", "healthcare"] },

  // Healthcare
  { id: "patient_monitor", ar: "شاشة مراقبة مريض", en: "Patient Monitor", watts: 120, tags: ["healthcare"] },
  { id: "infusion_pump", ar: "مضخة محاليل", en: "Infusion Pump", watts: 90, tags: ["healthcare"] },
  { id: "ventilator", ar: "جهاز تنفس صناعي", en: "Ventilator", watts: 350, tags: ["healthcare"] },
  { id: "anesthesia", ar: "جهاز تخدير", en: "Anesthesia Machine", watts: 800, tags: ["healthcare"] },
  { id: "surgical_light", ar: "إضاءة جراحية", en: "Surgical Light", watts: 300, tags: ["healthcare"] },
  { id: "lab_analyzer", ar: "جهاز تحليل مختبري", en: "Lab Analyzer", watts: 700, tags: ["healthcare"] },
  { id: "centrifuge", ar: "جهاز طرد مركزي", en: "Centrifuge", watts: 500, tags: ["healthcare"] },
  { id: "xray_console", ar: "وحدة أشعة", en: "X-ray Console", watts: 1500, tags: ["healthcare"] },
  { id: "ultrasound", ar: "جهاز ألتراساوند", en: "Ultrasound Machine", watts: 400, tags: ["healthcare"] },
  { id: "autoclave", ar: "أوتوكليف تعقيم", en: "Autoclave", watts: 2000, tags: ["healthcare"] },
  { id: "med_fridge", ar: "ثلاجة أدوية", en: "Medical Fridge", watts: 350, tags: ["healthcare"] },

  // Commercial
  { id: "pos", ar: "جهاز نقاط بيع", en: "POS Terminal", watts: 80, tags: ["commercial"] },
  { id: "display_sign", ar: "لوحة عرض", en: "Digital Signage", watts: 250, tags: ["commercial"] },
  { id: "coffee_machine", ar: "ماكينة قهوة", en: "Coffee Machine", watts: 1200, tags: ["commercial"] },
  { id: "grill", ar: "شواية كهربائية", en: "Electric Grill", watts: 2500, tags: ["commercial"] },
  { id: "fryer", ar: "قلاية", en: "Deep Fryer", watts: 3000, tags: ["commercial"] },
  { id: "freezer", ar: "فريزر", en: "Freezer", watts: 500, tags: ["commercial"] },
  { id: "cash_drawer", ar: "درج كاشير", en: "Cash Drawer", watts: 40, tags: ["commercial"] },

  // Residential
  { id: "home_tv", ar: "تلفزيون منزلي", en: "Home TV", watts: 150, tags: ["residential"] },
  { id: "washing_machine", ar: "غسالة", en: "Washing Machine", watts: 800, tags: ["residential"] },
  { id: "microwave", ar: "ميكروويف", en: "Microwave", watts: 1200, tags: ["residential"] },
  { id: "oven", ar: "فرن كهربائي", en: "Electric Oven", watts: 2500, tags: ["residential"] },
  { id: "home_fridge", ar: "ثلاجة منزلية", en: "Home Fridge", watts: 250, tags: ["residential"] },
  { id: "dishwasher", ar: "غسالة صحون", en: "Dishwasher", watts: 1500, tags: ["residential"] }
];

let equipmentState = {}; // eqId: count

window.addEventListener("load", async () => {
  await loadRooms();
  initEquipmentState();
  updateRoomSelect();
  renderEquipChecklist();
  focusField("display");
  updateDisplayValues();
  updateRecordsCount();
  registerSW();
});

async function loadRooms() {
  try {
    const res = await fetch(`data.json?v=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error("data.json fetch failed");
    roomData = await res.json();
  } catch (e) {
    console.warn("Failed to load data.json", e);
    roomData = { categories: [] };
  }

  roomIndex = {};
  (roomData.categories || []).forEach(cat => {
    (cat.items || []).forEach(item => {
      roomIndex[item.id] = { room: item, category: cat.key, method: cat.method, catObj: cat };
    });
  });
}

function initEquipmentState() {
  equipmentState = {};
  equipmentCatalog.forEach(e => equipmentState[e.id] = 0);
}

function updateRoomSelect() {
  const select = document.getElementById("room-select");
  select.innerHTML = "";

  (roomData.categories || []).forEach(cat => {
    const group = document.createElement("optgroup");
    group.label = currentLang === "ar" ? cat.name_ar : cat.name_en;

    (cat.items || []).forEach(room => {
      const opt = document.createElement("option");
      opt.value = room.id;
      opt.textContent = currentLang === "ar" ? room.ar : room.en;
      opt.dataset.category = cat.key;
      group.appendChild(opt);
    });

    select.appendChild(group);
  });

  onRoomChange(false);
}

function onRoomChange(reset = true) {
  if (reset) resetAllFields();

  const roomMeta = getSelectedRoomMeta();
  if (!roomMeta) return;

  document.getElementById("room-standard-pill").textContent =
    roomMeta.method === "ashrae170"
      ? (currentLang === "ar" ? "ASHRAE 170 (صحي)" : "ASHRAE 170 (Healthcare)")
      : (currentLang === "ar" ? "KSA Practice" : "KSA Practice");

  document.getElementById("room-ach-pill").textContent = `ACH: ${roomMeta.room.ach ?? "-"}`;
  document.getElementById("room-duct-pill").textContent = (currentLang === "ar" ? "Duct: -" : "Duct: -");

  renderEquipChecklist(); // فلترة الأجهزة حسب القسم
}

function getSelectedRoomMeta() {
  const select = document.getElementById("room-select");
  if (!select || !select.value) return null;
  return roomIndex[select.value] || null;
}

function getCategoryTagForEquip() {
  const roomMeta = getSelectedRoomMeta();
  if (!roomMeta) return "shared";
  return roomMeta.category; // healthcare/commercial/residential
}

function getFilteredEquipment() {
  const catTag = getCategoryTagForEquip();
  return equipmentCatalog.filter(eq => eq.tags.includes("shared") || eq.tags.includes(catTag));
}

function renderEquipChecklist() {
  const list = document.getElementById("equip-checklist");
  const items = getFilteredEquipment();

  list.innerHTML = items.map(eq => `
    <div class="equip-item-row">
      <div class="equip-text">
        <div>${currentLang === "ar" ? eq.ar : eq.en}</div>
        <div class="equip-w">${eq.watts} W</div>
      </div>
      <div class="counter-ctrl">
        <button class="counter-btn" onclick="changeCount('${eq.id}', -1)">-</button>
        <span id="cnt-${eq.id}" style="margin:0 8px;min-width:18px;text-align:center;">${equipmentState[eq.id] || 0}</span>
        <button class="counter-btn" onclick="changeCount('${eq.id}', 1)">+</button>
      </div>
    </div>
  `).join("");
}

function changeCount(eqId, delta) {
  equipmentState[eqId] = Math.max(0, (equipmentState[eqId] || 0) + delta);

  const span = document.getElementById(`cnt-${eqId}`);
  if (span) span.textContent = equipmentState[eqId];

  const totalWatts = equipmentCatalog.reduce((sum, eq) => sum + ((equipmentState[eq.id] || 0) * eq.watts), 0);
  inputs.equip = String(totalWatts);
  updateDisplayValues();
  calculateLoad(false);
}

function focusField(field) {
  activeField = field;
  document.getElementById("display").classList.remove("active-field");
  document.getElementById("people-count").classList.remove("active-field");
  document.getElementById("equip-watts").classList.remove("active-field");

  if (field === "display") document.getElementById("display").classList.add("active-field");
  if (field === "people") document.getElementById("people-count").classList.add("active-field");
  if (field === "equip") document.getElementById("equip-watts").classList.add("active-field");
}

function press(n) {
  if (activeField === "equip") return; // الأجهزة من المودال فقط

  const key = activeField;
  const val = String(n);

  if (val === "." && inputs[key].includes(".")) return;

  if (inputs[key] === "0" && val !== ".") inputs[key] = val;
  else inputs[key] += val;

  updateDisplayValues();
}

function deleteLast() {
  if (activeField === "equip") return;
  inputs[activeField] = inputs[activeField].slice(0, -1) || "0";
  updateDisplayValues();
}

function clearActiveField() {
  if (activeField === "equip") {
    // إعادة تصفير الأجهزة كلها
    initEquipmentState();
    renderEquipChecklist();
    inputs.equip = "0";
  } else {
    inputs[activeField] = "0";
  }
  updateDisplayValues();
  calculateLoad(false);
}

function resetAllFields() {
  inputs = { display: "0", people: "0", equip: "0" };
  initEquipmentState();
  renderEquipChecklist();
  updateDisplayValues();
  document.getElementById("tr-result").textContent = "0 TR";
  document.getElementById("cfm-result").textContent = "0 CFM";
  document.getElementById("btu-result").textContent = "0 BTU/h";
  document.getElementById("btu-market-result").textContent = currentLang === "ar" ? "المقترح: 0 BTU" : "Suggested: 0 BTU";
  document.getElementById("room-duct-pill").textContent = currentLang === "ar" ? "Duct: -" : "Duct: -";
  onRoomChange(false);
}

function updateDisplayValues() {
  document.getElementById("display").textContent = inputs.display || "0";
  document.getElementById("people-count").value = inputs.people || "0";
  document.getElementById("equip-watts").value = inputs.equip || "0";
}

function calculateLoad(save = false) {
  const roomMeta = getSelectedRoomMeta();
  if (!roomMeta) return;

  const vol = parseFloat(inputs.display) || 0;    // m³
  const people = parseInt(inputs.people) || 0;
  const watts = parseFloat(inputs.equip) || 0;

  if (vol <= 0) {
    document.getElementById("tr-result").textContent = "0 TR";
    document.getElementById("cfm-result").textContent = "0 CFM";
    document.getElementById("btu-result").textContent = "0 BTU/h";
    return;
  }

  const room = roomMeta.room;
  const ach = Number(room.ach) || 0;
  const peopleCfm = Number(room.peopleCfm) || 0;
  const factor = Number(room.factor) || 350;

  // CFM من ACH + أشخاص
  const cfmByAch = ((vol * 35.3147) * ach) / 60; // m³ -> ft³
  const cfmPeople = people * peopleCfm;
  const cfm = Math.round(cfmByAch + cfmPeople);

  // BTU/h (تقريب هندسي)
  // sensible-ish base + people + equipment
  const btuFromAir = cfm * factor;
  const btuFromPeople = people * 450;
  const btuFromEquip = watts * 3.412;
  const rawBtu = btuFromAir + btuFromPeople + btuFromEquip;

  // معامل تحفظ مختلف حسب القطاع
  const safety = roomMeta.method === "ashrae170" ? 1.10 : 1.15;
  const btu = Math.round(rawBtu * safety);

  // TR
  const tr = btu / 12000;
  const trFixed = tr.toFixed(2);

  // أقرب سعة سوقية
  const marketBtu = nearestMarketBTU(btu);

  // مقاس دكت مقترح (سرعة 800 fpm + عرض 12")
  const duct = quickDuctFromCFM(cfm, 12);

  // Update UI
  document.getElementById("tr-result").textContent = `${trFixed} TR`;
  document.getElementById("cfm-result").textContent = `${formatNum(cfm)} CFM`;
  document.getElementById("btu-result").textContent = `${formatNum(btu)} BTU/h`;
  document.getElementById("btu-market-result").textContent =
    currentLang === "ar"
      ? `المقترح: ${formatNum(marketBtu)} BTU`
      : `Suggested: ${formatNum(marketBtu)} BTU`;

  document.getElementById("room-duct-pill").textContent =
    (currentLang === "ar" ? "Duct: " : "Duct: ") + duct;

  if (save) {
    const roomName = currentLang === "ar" ? room.ar : room.en;
    calcHistory.push({
      id: Date.now(),
      room: roomName,
      category: roomMeta.category,
      method: roomMeta.method,
      vol,
      people,
      watts,
      ach,
      cfm,
      btu,
      marketBtu,
      tr: Number(trFixed),
      duct
    });
    updateHistoryUI();
    updateRecordsCount();
  }
}

function nearestMarketBTU(value) {
  const sizes = [
    9000, 12000, 18000, 24000, 30000, 36000, 48000, 60000,
    72000, 96000, 120000, 144000
  ];
  let best = sizes[0];
  let diff = Math.abs(value - best);
  for (const s of sizes) {
    const d = Math.abs(value - s);
    if (d < diff) {
      diff = d;
      best = s;
    }
  }
  return best;
}

function quickDuctFromCFM(cfm, widthIn = 12) {
  if (!cfm || cfm <= 0) return "-";
  const velocity = 800; // fpm
  const areaFt2 = cfm / velocity;
  const areaIn2 = areaFt2 * 144;
  const h = Math.max(6, Math.round(areaIn2 / widthIn));
  return `${widthIn}" x ${h}"`;
}

function formatNum(n) {
  return Number(n || 0).toLocaleString(currentLang === "ar" ? "ar-SA" : "en-US");
}

function updateHistoryUI() {
  const container = document.getElementById("history-list");
  if (!calcHistory.length) {
    container.innerHTML = `<div class="muted">${currentLang === "ar" ? "لا يوجد سجل بعد" : "No records yet"}</div>`;
    return;
  }

  container.innerHTML = [...calcHistory].reverse().map((item, idx) => `
    <div class="swipe-item" onclick="deleteItem(${item.id})">
      <div class="info">
        <span style="color:#666;font-size:11px">#${calcHistory.length - idx}</span>
        <span>${item.room}</span>
        <span style="color:#8e8e93;font-size:11px">ACH ${item.ach} • ${item.method === "ashrae170" ? "ASHRAE170" : "KSA"}</span>
      </div>
      <div class="vals">
        <span class="tr-val">${item.tr} TR</span><br>
        <span>${formatNum(item.cfm)} CFM</span><br>
        <span>${formatNum(item.marketBtu)} BTU</span><br>
        <span class="duct-val">${item.duct}</span>
      </div>
    </div>
  `).join("");
}

function deleteItem(id) {
  const ok = confirm(currentLang === "ar" ? "حذف السجل؟" : "Delete record?");
  if (!ok) return;
  calcHistory = calcHistory.filter(i => i.id !== id);
  updateHistoryUI();
  updateRecordsCount();
}

function clearHistory() {
  const ok = confirm(currentLang === "ar" ? "مسح جميع السجلات؟" : "Clear all records?");
  if (!ok) return;
  calcHistory = [];
  updateHistoryUI();
  updateRecordsCount();
}

function updateRecordsCount() {
  const el = document.getElementById("records-count");
  if (el) el.textContent = String(calcHistory.length);
}

function openEquipModal() {
  document.getElementById("equip-modal").style.display = "block";
}

function closeEquipModal() {
  document.getElementById("equip-modal").style.display = "none";
  calculateLoad(false);
}

function switchTab(id, btn) {
  document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach(n => n.classList.remove("active"));
  document.getElementById(id).classList.add("active");
  if (btn) btn.classList.add("active");
}

function toggleLanguage() {
  currentLang = currentLang === "ar" ? "en" : "ar";
  const html = document.getElementById("html-tag");
  html.lang = currentLang;
  html.dir = currentLang === "ar" ? "rtl" : "ltr";

  // Replace all data-ar / data-en text
  document.querySelectorAll("[data-ar]").forEach(el => {
    const txt = el.getAttribute(`data-${currentLang}`);
    if (txt) el.textContent = txt;
  });

  // settings lang button label
  const langBtn = document.getElementById("lang-text");
  if (langBtn) langBtn.textContent = currentLang === "ar" ? "English" : "العربية";

  updateRoomSelect();
  renderEquipChecklist();
  updateHistoryUI();
  updateDisplayValues();

  // refresh top labels if values exist
  calculateLoad(false);
}

function exportCSV() {
  if (!calcHistory.length) {
    alert(currentLang === "ar" ? "السجل فارغ" : "History is empty");
    return;
  }

  const headers = [
    "Room", "Category", "Method", "Volume_m3", "People", "Equip_W",
    "ACH", "CFM", "BTU_h", "Suggested_BTU", "TR", "Duct"
  ];

  const rows = calcHistory.map(r => [
    r.room,
    r.category,
    r.method,
    r.vol,
    r.people,
    r.watts,
    r.ach,
    r.cfm,
    r.btu,
    r.marketBtu,
    r.tr,
    r.duct
  ]);

  const csv = [headers, ...rows]
    .map(row => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "aircalcpro_history.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function copySummary() {
  if (!calcHistory.length) {
    alert(currentLang === "ar" ? "السجل فارغ" : "History is empty");
    return;
  }
  const txt = calcHistory.map((r, i) =>
    `${i + 1}) ${r.room} | ${r.tr} TR | ${r.cfm} CFM | ${r.marketBtu} BTU | ${r.duct}`
  ).join("\n");

  navigator.clipboard.writeText(txt)
    .then(() => alert(currentLang === "ar" ? "تم نسخ الملخص" : "Summary copied"))
    .catch(() => alert(currentLang === "ar" ? "تعذر النسخ" : "Copy failed"));
}

function registerSW() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("./sw.js").catch(err => console.warn("SW fail", err));
    });
  }
}