/* Air Calc Pro - PWA HVAC Calculator (Offline/Online) */

const $ = (id) => document.getElementById(id);

const els = {
  roomType: $("roomType"),
  roomName: $("roomName"),
  volumeM3: $("volumeM3"),
  ach: $("ach"),
  cfmPerTR: $("cfmPerTR"),
  pressureOffset: $("pressureOffset"),
  measCfm: $("measCfm"),
  measPa: $("measPa"),
  measTemp: $("measTemp"),
  measRh: $("measRh"),

  outCfm: $("outCfm"),
  outLs: $("outLs"),
  outM3h: $("outM3h"),
  outTr: $("outTr"),
  outCfmOffset: $("outCfmOffset"),

  btnCalc: $("btnCalc"),
  btnReset: $("btnReset"),
  btnCompare: $("btnCompare"),

  note: $("note"),
  compareBox: $("compareBox"),

  netDot: $("netDot"),
  netText: $("netText"),

  installBtn: $("installBtn"),
};

let deferredPrompt = null;

function fmt(n, digits = 1) {
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: digits }).format(n);
}

// --- Core formulas
// ACH = (CFM * 60) / ft3, and 1 m3 = 35.3147 ft3
// => CFM = (ACH * m3 * 35.3147) / 60 = (ACH * m3) / 1.699
function cfmFromAch(volumeM3, ach) {
  return (ach * volumeM3) / 1.699;
}

function lsFromCfm(cfm) {
  return cfm * 0.47194745; // L/s
}

function m3hFromAch(volumeM3, ach) {
  return ach * volumeM3;
}

function trFromCfm(cfm, cfmPerTR) {
  return cfm / cfmPerTR;
}

function applyOffset(cfm, offsetPct) {
  const o = (Number(offsetPct) || 0) / 100;
  return cfm * (1 + o);
}

// --- UI helpers
function setNote(text) {
  if (!text) {
    els.note.classList.remove("show");
    els.note.textContent = "";
    return;
  }
  els.note.textContent = text;
  els.note.classList.add("show");
}

function setCompare(text) {
  if (!text) {
    els.compareBox.classList.remove("show");
    els.compareBox.textContent = "";
    return;
  }
  els.compareBox.textContent = text;
  els.compareBox.classList.add("show");
}

function updateNetworkUI() {
  const online = navigator.onLine;
  els.netDot.classList.toggle("on", online);
  els.netDot.classList.toggle("off", !online);
  els.netText.textContent = online ? "متصل" : "غير متصل (Offline)";
}

function readInputs() {
  return {
    roomType: els.roomType.value,
    roomName: els.roomName.value.trim(),
    volumeM3: Number(els.volumeM3.value),
    ach: Number(els.ach.value),
    cfmPerTR: Number(els.cfmPerTR.value),
    pressureOffset: Number(els.pressureOffset.value || 0),
    measCfm: Number(els.measCfm.value),
    measPa: Number(els.measPa.value),
    measTemp: Number(els.measTemp.value),
    measRh: Number(els.measRh.value),
  };
}

function validate({ volumeM3, ach }) {
  if (!Number.isFinite(volumeM3) || volumeM3 <= 0) return "اكتب حجم الغرفة (m³) بشكل صحيح.";
  if (!Number.isFinite(ach) || ach <= 0) return "اكتب ACH بشكل صحيح.";
  return null;
}

function calcAndRender() {
  const data = readInputs();
  const err = validate(data);
  if (err) {
    setNote(err);
    return;
  }

  const cfm = cfmFromAch(data.volumeM3, data.ach);
  const cfmOff = applyOffset(cfm, data.pressureOffset);
  const ls = lsFromCfm(cfm);
  const m3h = m3hFromAch(data.volumeM3, data.ach);
  const tr = trFromCfm(cfm, data.cfmPerTR);

  els.outCfm.textContent = fmt(cfm, 1);
  els.outCfmOffset.textContent = fmt(cfmOff, 1);
  els.outLs.textContent = fmt(ls, 1);
  els.outM3h.textContent = fmt(m3h, 1);
  els.outTr.textContent = fmt(tr, 2);

  const title =
    (data.roomName ? `${data.roomName} — ` : "") +
    (data.roomType ? data.roomType : "Room");

  setNote(`✅ تم الحساب: ${title}`);
  setCompare("");
  saveState();
}

function resetAll() {
  ["roomType","roomName","volumeM3","ach","pressureOffset","measCfm","measPa","measTemp","measRh"].forEach(k=>{
    els[k].value = "";
  });
  els.cfmPerTR.value = "400";

  ["outCfm","outLs","outM3h","outTr","outCfmOffset"].forEach(k=>{
    els[k].textContent = "—";
  });

  setNote("");
  setCompare("");
  localStorage.removeItem("aircalc_state_v1");
}

function compareMeasured() {
  const data = readInputs();
  const err = validate(data);
  if (err) {
    setCompare("");
    setNote(err);
    return;
  }

  const targetCfm = applyOffset(cfmFromAch(data.volumeM3, data.ach), data.pressureOffset);

  if (!Number.isFinite(data.measCfm) || data.measCfm <= 0) {
    setCompare("اكتب Measured Airflow (CFM) عشان نقارن.");
    return;
  }

  const diff = data.measCfm - targetCfm;
  const pct = (diff / targetCfm) * 100;

  const status =
    Math.abs(pct) <= 10 ? "ممتاز ✅" :
    Math.abs(pct) <= 20 ? "قريب ⚠️" :
    "بعيد ❗";

  setCompare(
    `المطلوب ≈ ${fmt(targetCfm,1)} CFM | المقاس = ${fmt(data.measCfm,1)} CFM\n` +
    `الفرق = ${fmt(diff,1)} CFM (${fmt(pct,1)}%) → ${status}`
  );
  setNote("");
  saveState();
}

// --- Persistence
function saveState() {
  const data = readInputs();
  localStorage.setItem("aircalc_state_v1", JSON.stringify(data));
}

function loadState() {
  const raw = localStorage.getItem("aircalc_state_v1");
  if (!raw) return;
  try {
    const d = JSON.parse(raw);
    els.roomType.value = d.roomType ?? "";
    els.roomName.value = d.roomName ?? "";
    els.volumeM3.value = (d.volumeM3 ?? "") === 0 ? "" : (d.volumeM3 ?? "");
    els.ach.value = (d.ach ?? "") === 0 ? "" : (d.ach ?? "");
    els.cfmPerTR.value = String(d.cfmPerTR ?? 400);
    els.pressureOffset.value = (d.pressureOffset ?? "") === 0 ? "" : (d.pressureOffset ?? "");
    els.measCfm.value = (d.measCfm ?? "") === 0 ? "" : (d.measCfm ?? "");
    els.measPa.value = (d.measPa ?? "") === 0 ? "" : (d.measPa ?? "");
    els.measTemp.value = (d.measTemp ?? "") === 0 ? "" : (d.measTemp ?? "");
    els.measRh.value = (d.measRh ?? "") === 0 ? "" : (d.measRh ?? "");
  } catch {}
}

// --- PWA install prompt
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  els.installBtn.classList.remove("hidden");
});

els.installBtn.addEventListener("click", async (e) => {
  e.preventDefault();
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  els.installBtn.classList.add("hidden");
});

// --- Service Worker
async function registerSW() {
  if (!("serviceWorker" in navigator)) return;
  try {
    await navigator.serviceWorker.register("./sw.js", { scope: "./" });
  } catch (err) {
    // ignore in dev
  }
}

// --- Events
els.btnCalc.addEventListener("click", calcAndRender);
els.btnReset.addEventListener("click", resetAll);
els.btnCompare.addEventListener("click", compareMeasured);

["roomType","roomName","volumeM3","ach","cfmPerTR","pressureOffset","measCfm","measPa","measTemp","measRh"]
  .forEach(id=>{
    $(id).addEventListener("change", saveState);
    $(id).addEventListener("input", () => {
      // لا نحسب تلقائيًا عشان ما يزعجك، بس نحفظ.
      saveState();
    });
  });

window.addEventListener("online", updateNetworkUI);
window.addEventListener("offline", updateNetworkUI);

// Init
updateNetworkUI();
loadState();
registerSW();