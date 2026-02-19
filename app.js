/* Air Calc Pro — app.js (Pro Version) */

let REF_DATA = null;
let FLAT_ITEMS = [];
let RESULTS = [];

const $ = (id) => document.getElementById(id);

// Math Helpers
function num(v){ const n = Number(v); return Number.isFinite(n) ? n : null; }
function m3_to_ft3(m3){ return m3 * 35.3146667; }

/** * ASHRAE Formula: CFM = (ACH * Volume_ft3) / 60
 */
function ach_to_cfm(ach, vol_m3){
  const ft3 = m3_to_ft3(vol_m3);
  return (ach * ft3) / 60;
}

function fmt(x, d=0){
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
}

// Logic for Pressure P/N
function getPN(item){
  const po = num(item?.pressureOffset);
  if (po === null) return "—";
  return po > 0 ? "P" : (po < 0 ? "N" : "N");
}

function safeAch(item){
  const a = num(item?.ach);
  return (a !== null && a > 0) ? a : null;
}

// Data Fetching
async function loadRef(){
  const bust = (u)=> u + (u.includes("?") ? "&" : "?") + "v=" + Date.now();
  try {
    const resp = await fetch(bust("data.json"), { cache:"no-store" });
    const parsed = await resp.json();
    if (parsed?.categories) {
      $("statusTag").textContent = `Loaded: ${parsed.categories.length} sections`;
      return parsed;
    }
  } catch(e) {
    console.warn("JSON fail, using fallback");
    return { categories: [{ name:"Hospitals", items:[{ id:"or", label_ar:"غرفة عمليات", label_en:"Operating Room", ach:20, pressureOffset:5 }]}]};
  }
}

function flattenData(data){
  const flat = [];
  data.categories?.forEach(cat => {
    cat.items?.forEach(it => flat.push({ ...it, catName: cat.name }));
  });
  return flat;
}

// UI Building
function buildRoomSelect(){
  const sel = $("roomType");
  sel.innerHTML = "";
  REF_DATA.categories?.forEach(cat => {
    const og = document.createElement("optgroup");
    og.label = cat.name;
    cat.items?.forEach(it => {
      const opt = document.createElement("option");
      opt.value = it.id;
      opt.textContent = I18N.current === "en" ? it.label_en : it.label_ar;
      og.appendChild(opt);
    });
    sel.appendChild(og);
  });
  sel.onchange = updateSelectedMeta;
  updateSelectedMeta();
}

function updateSelectedMeta(){
  const id = $("roomType").value;
  const it = FLAT_ITEMS.find(x => x.id === id);
  if (it) {
    $("roomMeta").innerHTML = `ACH: ${it.ach} | ${getPN(it)}`;
  }
}

// Core Calculation
function calcRoom(it, vol_m3, offsetPct, thumb){
  const ach = safeAch(it);
  const supply = ach_to_cfm(ach, vol_m3);
  const pn = getPN(it);
  
  // Apply Offset based on P/N
  let exhaust = supply;
  const offFactor = Math.abs(offsetPct) / 100;
  if (pn === "N") exhaust = supply * (1 + offFactor);
  else if (pn === "P") exhaust = supply * (1 - offFactor);

  return {
    roomName: I18N.current === "en" ? it.label_en : it.label_ar,
    vol_m3, ach, pn, supply, exhaust, tr: supply / thumb, thumb, offsetPct
  };
}

// Rendering
function renderResults(){
  const box = $("resultsList");
  box.innerHTML = "";
  RESULTS.forEach((r, idx) => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <strong>${r.roomName}</strong>
        <span class="pill">${r.pn === "P" ? "+" : "-"} Pressure</span>
      </div>
      <div class="grid3" style="margin-top:10px;">
        <div class="k"><div class="kk">Supply</div><div class="vv">${fmt(r.supply)} <small>CFM</small></div></div>
        <div class="k"><div class="kk">Exhaust</div><div class="vv">${fmt(r.exhaust)} <small>CFM</small></div></div>
        <div class="k"><div class="kk">Load</div><div class="vv">${fmt(r.tr, 2)} <small>TR</small></div></div>
      </div>
      <button class="btn btnDanger" onclick="deleteRoom(${idx})" style="margin-top:10px; height:30px; font-size:11px;">Remove</button>
    `;
    box.appendChild(div);
  });
}

window.deleteRoom = (idx) => {
  RESULTS.splice(idx, 1);
  renderResults();
  updateSums();
};

function updateSums(){
  const sS = RESULTS.reduce((a,b) => a + b.supply, 0);
  const sE = RESULTS.reduce((a,b) => a + b.exhaust, 0);
  const sT = RESULTS.reduce((a,b) => a + b.tr, 0);
  $("sumSupply").textContent = fmt(sS);
  $("sumExh").textContent = fmt(sE);
  $("sumTR").textContent = fmt(sT, 2);
}

// PDF EXPORT FEATURE
function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('p', 'mm', 'a4');
  const isAr = I18N.current === "ar";

  doc.setFont("helvetica", "bold");
  doc.text("HVAC DESIGN REPORT - AIR CALC PRO", 14, 15);
  doc.setFontSize(10);
  doc.text(`Project Date: ${new Date().toLocaleDateString()}`, 14, 22);

  const tableData = RESULTS.map(r => [
    r.roomName,
    r.vol_m3 + " m3",
    r.ach,
    r.pn,
    Math.round(r.supply),
    Math.round(r.exhaust),
    r.tr.toFixed(2)
  ]);

  doc.autoTable({
    startY: 30,
    head: [['Room', 'Vol', 'ACH', 'P/N', 'Supply', 'Exhaust', 'TR']],
    body: tableData,
    theme: 'grid'
  });

  doc.save("AirCalcPro_Report.pdf");
}

// CLEAR ALL FEATURE
function clearAll() {
  if (confirm(I18N.current === "en" ? "Clear all data?" : "هل تريد مسح جميع البيانات؟")) {
    RESULTS = [];
    renderResults();
    updateSums();
    $("roomVol").value = "";
  }
}

// Initialization
async function init(){
  // Tab Logic
  document.querySelectorAll(".navBtn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tabPage").forEach(p => p.classList.remove("active"));
      document.querySelectorAll(".navBtn").forEach(b => b.classList.remove("active"));
      $(btn.dataset.tab).classList.add("active");
      btn.classList.add("active");
    };
  });

  REF_DATA = await loadRef();
  FLAT_ITEMS = flattenData(REF_DATA);
  buildRoomSelect();

  $("btnAdd").onclick = () => {
    const id = $("roomType").value;
    const it = FLAT_ITEMS.find(x => x.id === id);
    const vol = num($("roomVol").value);
    if (!vol) return alert("Please enter Volume");
    
    const res = calcRoom(it, vol, num($("offsetPct").value), num($("thumb").value));
    RESULTS.unshift(res);
    renderResults();
    updateSums();
  };

  $("btnExportPDF").onclick = exportPDF;
  $("btnClearAll").onclick = clearAll;
}

const I18N = { current: "ar" }; // Simplified for logic check
init();
