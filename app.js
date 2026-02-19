let REF_DATA = null;
let FLAT_ITEMS = [];
let RESULTS = [];

const $ = (id) => document.getElementById(id);

async function init() {
  try {
    const resp = await fetch('data.json?v=' + Date.now());
    REF_DATA = await resp.json();
    FLAT_ITEMS = [];
    REF_DATA.categories.forEach(cat => {
      cat.items.forEach(it => FLAT_ITEMS.push({ ...it, catName: cat.name }));
    });
    
    buildRoomSelect();
    setupTabs();
    renderReference();
  } catch (e) { console.error("Data load failed"); }
}

function setupTabs() {
  document.querySelectorAll(".navBtn").forEach(btn => {
    btn.onclick = () => {
      const target = btn.dataset.tab;
      
      // إخفاء كافة الصفحات
      document.querySelectorAll(".tabPage").forEach(p => p.classList.remove("active"));
      document.querySelectorAll(".navBtn").forEach(b => b.classList.remove("active"));
      
      // إظهار الصفحة المطلوبة
      $(target).classList.add("active");
      btn.classList.add("active");

      if(target === 'tab-export') renderExportPreview();
    };
  });
}

function buildRoomSelect() {
  const sel = $("roomType");
  sel.innerHTML = FLAT_ITEMS.map(it => `<option value="${it.id}">${it.label_ar}</option>`).join("");
}

function renderReference() {
  const list = $("roomsList");
  list.innerHTML = FLAT_ITEMS.map(it => `
    <div class="item">
      <div style="display:flex; justify-content:space-between;">
        <b>${it.label_ar}</b>
        <span style="color:var(--primary)">ACH: ${it.ach}</span>
      </div>
      <div style="font-size:11px; color:var(--muted)">${it.catName}</div>
    </div>
  `).join("");
}

$("btnAdd").onclick = () => {
  const it = FLAT_ITEMS.find(x => x.id === $("roomType").value);
  const vol = parseFloat($("roomVol").value);
  if(!vol) return alert("أدخل الحجم");

  const supply = (it.ach * (vol * 35.3147)) / 60;
  RESULTS.unshift({
    name: it.label_ar,
    supply: Math.round(supply),
    tr: (supply / parseFloat($("thumb").value)).toFixed(2)
  });
  
  renderResults();
  $("roomVol").value = "";
};

function renderResults() {
  $("resultsList").innerHTML = RESULTS.map((r, i) => `
    <div class="item">
      <div style="display:flex; justify-content:space-between">
        <b>${r.name}</b>
        <button onclick="RESULTS.splice(${i},1);renderResults();" style="color:red; background:none; border:none">حذف</button>
      </div>
      <div>Supply: ${r.supply} CFM | Load: ${r.tr} TR</div>
    </div>
  `).join("");
}

function renderExportPreview() {
  if(RESULTS.length === 0) {
    $("exportPreview").innerHTML = "لا توجد بيانات مضافة";
    return;
  }
  $("exportPreview").innerHTML = `لديك ${RESULTS.length} غرف جاهزة للتصدير`;
}

$("btnExportPDF").onclick = () => {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text("Air Calc Pro Report", 20, 20);
  doc.autoTable({
    head: [['الغرفة', 'CFM', 'TR']],
    body: RESULTS.map(r => [r.name, r.supply, r.tr])
  });
  doc.save("Report.pdf");
};

$("btnClearAll").onclick = () => {
  if(confirm("مسح الكل؟")) { RESULTS = []; renderResults(); }
};

init();
