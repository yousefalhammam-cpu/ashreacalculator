const $ = (id) => document.getElementById(id);

const els = {
  roomType: $("roomType"),
  roomName: $("roomName"),
  volume: $("volume"),
  pressureOffset: $("pressureOffset"),
  ruleOfThumb: $("ruleOfThumb"),
  outdoorOverride: $("outdoorOverride"),
  measuredAirflow: $("measuredAirflow"),
  measuredPressure: $("measuredPressure"),
  measuredTemp: $("measuredTemp"),
  measuredRH: $("measuredRH"),
  calcBtn: $("calcBtn"),
  resetBtn: $("resetBtn"),
  achOut: $("achOut"),
  cfmOut: $("cfmOut"),
  trOut: $("trOut"),
  pOut: $("pOut"),
  noteOut: $("noteOut"),
  status: $("status")
};

let roomMap = new Map(); // id -> item

function setStatus(msg) {
  if (els.status) els.status.textContent = msg;
}

function num(v) {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function fmt(n, digits = 2) {
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(digits);
}

async function loadData() {
  try {
    setStatus("جاري تحميل البيانات…");

    const res = await fetch("./data.json?v=1", { cache: "no-store" });
    if (!res.ok) throw new Error("Fetch failed: " + res.status);

    const data = await res.json();
    const categories = data.categories || [];

    // reset select
    els.roomType.innerHTML = `<option value="" selected disabled>اختر نوع الغرفة</option>`;
    roomMap.clear();

    categories.forEach(cat => {
      const group = document.createElement("optgroup");
      group.label = cat.name || "Category";

      (cat.items || []).forEach(item => {
        roomMap.set(item.id, item);

        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = (item.label_ar || item.label_en || item.id);
        group.appendChild(opt);
      });

      els.roomType.appendChild(group);
    });

    setStatus("جاهز");
  } catch (e) {
    console.error(e);
    els.roomType.innerHTML = `<option value="" selected disabled>فشل تحميل البيانات</option>`;
    setStatus("فشل تحميل البيانات");
  }
}

function applySelectedDefaults() {
  const id = els.roomType.value;
  const item = roomMap.get(id);
  if (!item) return;

  // ACH reference goes to pressureOffset default only (ach used in calc)
  const p = num(item.pressureOffset);
  if (p !== null) els.pressureOffset.value = p;
}

function calc() {
  const id = els.roomType.value;
  const item = roomMap.get(id);

  if (!item) {
    setStatus("اختر نوع الغرفة أولاً");
    els.noteOut.textContent = "⚠️ اختر نوع الغرفة من القائمة.";
    return;
  }

  const volume = num(els.volume.value);
  if (volume === null || volume <= 0) {
    setStatus("أدخل حجم الغرفة");
    els.noteOut.textContent = "⚠️ لازم تدخل حجم الغرفة بالمتر المكعب (m³).";
    return;
  }

  const overrideACH = num(els.outdoorOverride.value);
  const achRef = (overrideACH !== null && overrideACH > 0) ? overrideACH : Number(item.ach || 0);

  if (!Number.isFinite(achRef) || achRef <= 0) {
    setStatus("ACH غير صالح");
    els.noteOut.textContent = "⚠️ قيمة ACH المرجعية غير صحيحة لهذا النوع.";
    return;
  }

  // ACH -> CFM
  // CFM = ACH * Volume(m3) / 60(min/hr) * (35.3147 ft3/m3)
  const cfm = achRef * volume * 35.3147 / 60;

  // TR (approx) from rule of thumb
  const rot = num(els.ruleOfThumb.value) ?? 400;
  const tr = cfm / rot;

  // pressure offset suggestion
  const pUser = num(els.pressureOffset.value);
  const pSuggested = (pUser !== null) ? pUser : (num(item.pressureOffset) ?? 0);

  // output
  els.achOut.textContent = `${fmt(achRef, 2)} ACH`;
  els.cfmOut.textContent = `${fmt(cfm, 1)} CFM`;
  els.trOut.textContent = `${fmt(tr, 2)} TR`;
  els.pOut.textContent = `${fmt(pSuggested, 0)} %`;

  // optional measured notes
  const mAir = num(els.measuredAirflow.value);
  const mP = num(els.measuredPressure.value);
  const mT = num(els.measuredTemp.value);
  const mRH = num(els.measuredRH.value);

  let note = `• النوع المختار: ${item.label_ar || item.label_en || item.id}\n`;
  note += `• ACH المرجعي: ${achRef}\n`;
  note += `• CFM المطلوب: ${fmt(cfm, 1)}\n`;

  if (mAir !== null) {
    const diff = mAir - cfm;
    const pct = (diff / cfm) * 100;
    note += `\nالقراءة الميدانية:\n`;
    note += `• Measured CFM: ${fmt(mAir, 1)} (فرق ${fmt(diff, 1)} = ${fmt(pct, 1)}%)\n`;
  }
  if (mP !== null) note += `• Pressure: ${mP} Pa\n`;
  if (mT !== null) note += `• Temp: ${mT} °C\n`;
  if (mRH !== null) note += `• RH: ${mRH}%\n`;

  els.noteOut.textContent = note;

  setStatus("تم الحساب");
}

function resetAll() {
  els.roomType.selectedIndex = 0;
  els.roomName.value = "";
  els.volume.value = "";
  els.pressureOffset.value = 0;
  els.ruleOfThumb.value = 400;
  els.outdoorOverride.value = "";
  els.measuredAirflow.value = "";
  els.measuredPressure.value = "";
  els.measuredTemp.value = "";
  els.measuredRH.value = "";

  els.achOut.textContent = "—";
  els.cfmOut.textContent = "—";
  els.trOut.textContent = "—";
  els.pOut.textContent = "—";
  els.noteOut.textContent = "";

  setStatus("جاهز");
}

function registerSW() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", async () => {
    try {
      await navigator.serviceWorker.register("./sw.js?v=1");
      // console.log("SW registered");
    } catch (e) {
      console.warn("SW failed", e);
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadData();

  els.roomType.addEventListener("change", applySelectedDefaults);
  els.calcBtn.addEventListener("click", calc);
  els.resetBtn.addEventListener("click", resetAll);

  registerSW();
});