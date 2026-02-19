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
  renderReference();
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

function getUnitType(tr, catName) {
    if(catName.includes("الرعاية")) return tr > 3 ? "AHU (مركزي)" : "Medical FCU";
    if(tr <= 2) return "Split Unit";
    if(tr <= 5) return "Ducted Split";
    return "Package Unit";
}

$("btnAdd").onclick = () => {
  const catIdx = $("buildingCat").value;
  const roomIdx = $("roomType").selectedIndex;
  const it = REF_DATA.categories[catIdx].items[roomIdx];
  const vol = parseFloat($("roomVol").value);

  if(!vol) return alert("أدخل الحجم");

  const cfm = (it.ach * (vol * 35.3147)) / 60;
  const tr = cfm / 400;

  RESULTS.unshift({
    name: it.label_ar,
    cat: REF_DATA.categories[catIdx].name,
    cfm: Math.round(cfm),
    tr: tr.toFixed(2),
    unit: getUnitType(tr, REF_DATA.categories[catIdx].name)
  });

  renderResults();
  $("roomVol").value = "";
};

function renderResults() {
  $("resultsList").innerHTML = RESULTS.map((r, i) => `
    <div class="item">
      <div style="display:flex; justify-content:space-between">
        <b>${r.name}</b>
        <span class="pill">${r.unit}</span>
      </div>
      <div style="margin-top:8px; font-size:13px; color:var(--primary)">
        CFM: ${r.cfm} | Load: ${r.tr} TR
      </div>
    </div>
  `).join("");
}

function renderReference() {
  const query = $("roomSearch").value.toLowerCase();
  let allItems = [];
  REF_DATA.categories.forEach(cat => {
    cat.items.forEach(it => allItems.push({...it, catName: cat.name}));
  });

  $("roomsList").innerHTML = allItems.filter(it => it.label_ar.includes(query)).map(it => `
    <div class="item">
      <div style="display:flex; justify-content:space-between">
        <span>${it.label_ar}</span>
        <b>ACH: ${it.ach}</b>
      </div>
      <small style="color:var(--muted)">${it.catName}</small>
    </div>
  `).join("");
}

function renderExportPreview() {
    $("exportPreview").innerHTML = RESULTS.length > 0 ? `عدد الغرف: ${RESULTS.length} جاهزة للتصدير` : "لا توجد بيانات";
}

$("btnExportPDF").onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Technical Airflow Report", 20, 20);
    doc.autoTable({
        head: [['Room', 'Unit', 'CFM', 'TR']],
        body: RESULTS.map(r => [r.name, r.unit, r.cfm, r.tr])
    });
    doc.save("Report.pdf");
};

$("btnClearAll").onclick = () => { if(confirm("حذف الكل؟")) { RESULTS=[]; renderResults(); } };

init();
