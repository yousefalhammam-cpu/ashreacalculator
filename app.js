let REF_DATA = null;
let RESULTS = [];

const $ = (id) => document.getElementById(id);

async function init() {
  const resp = await fetch('data.json');
  REF_DATA = await resp.json();
  
  const catSel = $("buildingCat");
  REF_DATA.categories.forEach((cat, idx) => {
    catSel.innerHTML += `<option value="${idx}">${cat.name}</option>`;
  });

  updateRoomList();
  setupNavigation();
}

function updateRoomList() {
  const catIdx = $("buildingCat").value;
  const rooms = REF_DATA.categories[catIdx].items;
  $("roomType").innerHTML = rooms.map(it => `<option value="${it.id}">${it.label_ar}</option>`).join("");
}

function setupNavigation() {
  document.querySelectorAll(".navBtn").forEach(btn => {
    btn.onclick = () => {
      document.querySelectorAll(".tabPage").forEach(p => p.classList.remove("active"));
      document.querySelectorAll(".navBtn").forEach(b => b.classList.remove("active"));
      $(btn.dataset.tab).classList.add("active");
      btn.classList.add("active");
      if(btn.dataset.tab === 'tab-export') renderExportPreview();
    };
  });
}

// تحليل السعة التجارية
function analyzeUnit(tr) {
    if (tr <= 1.1) return "1.0 TR (12k BTU)";
    if (tr <= 1.6) return "1.5 TR (18k BTU)";
    if (tr <= 2.2) return "2.0 TR (24k BTU)";
    if (tr <= 3.2) return "3.0 TR (36k BTU)";
    return Math.ceil(tr) + ".0 TR (Commercial)";
}

$("btnAdd").onclick = () => {
  const catIdx = $("buildingCat").value;
  const roomIdx = $("roomType").selectedIndex;
  const it = REF_DATA.categories[catIdx].items[roomIdx];
  const vol = parseFloat($("roomVol").value);
  const unit = $("unitType").value;

  if(!vol) return alert("يرجى إدخال الحجم");

  const cfm = (it.ach * (vol * 35.3147)) / 60;
  const tr = cfm / parseFloat($("thumb").value);

  RESULTS.unshift({
    room: it.label_ar,
    unitType: unit,
    cfm: Math.round(cfm),
    tr: tr.toFixed(2),
    rec: analyzeUnit(tr),
    ach: it.ach
  });

  renderResults();
  $("roomVol").value = "";
};

function renderResults() {
  $("resultsList").innerHTML = RESULTS.map((r, i) => `
    <div class="item card-result">
      <div style="display:flex; justify-content:space-between; align-items:center;">
        <b>${r.room} - <span style="color:var(--primary)">${r.unitType}</span></b>
        <button onclick="RESULTS.splice(${i},1);renderResults();" class="del-btn">×</button>
      </div>
      <div class="res-grid">
        <div>CFM: <span>${r.cfm}</span></div>
        <div>الحمل: <span>${r.tr} TR</span></div>
        <div style="grid-column: span 2; color:#fbbf24; font-weight:bold;">المنصوح به: ${r.rec}</div>
      </div>
    </div>
  `).join("");
}

function renderExportPreview() {
    const box = $("exportPreview");
    if(RESULTS.length === 0) return box.innerHTML = "أضف بيانات أولاً";
    let sum = RESULTS.reduce((a, b) => a + parseFloat(b.tr), 0);
    box.innerHTML = `عدد الوحدات: ${RESULTS.length} | الإجمالي: ${sum.toFixed(2)} TR`;
}

init();
