let REF_DATA = null;
let RESULTS = JSON.parse(localStorage.getItem('hvac_v7')) || [];
let currentLang = localStorage.getItem('lang_v7') || 'ar';
let myChart = null;

const $ = (id) => document.getElementById(id);

// دالة التوصية المحدثة باللغتين
function getRecommendation(tr, isMed) {
    if (isMed) return currentLang === 'ar' ? "توصية: وحدة معالجة هواء (AHU) مخصصة طبياً مع فلاتر HEPA" : "Rec: Medical AHU with HEPA Filters";
    if (tr <= 1.5) return currentLang === 'ar' ? "توصية: مكيف سبليت جداري (Hi-Wall Split)" : "Rec: Hi-Wall Split Unit";
    if (tr <= 4.5) return currentLang === 'ar' ? "توصية: وحدة كونسيلد مخفي (Ducted Split)" : "Rec: Ducted Split Unit";
    return currentLang === 'ar' ? "توصية: وحدة مجمعة (Rooftop Package Unit)" : "Rec: Rooftop Package Unit";
}

async function init() {
    const resp = await fetch('data.json');
    REF_DATA = await resp.json();
    
    const catSel = $("buildingCat");
    REF_DATA.categories.forEach((cat, idx) => {
        catSel.innerHTML += `<option value="${idx}">${currentLang === 'ar' ? cat.name_ar : cat.name_en}</option>`;
    });

    changeLanguage(currentLang);
    setupNav();
    updateUI();
}

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang_v7', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    updateRoomList();
    renderResults();
}

function updateRoomList() {
    const catIdx = $("buildingCat").value;
    const rooms = REF_DATA.categories[catIdx].items;
    $("roomType").innerHTML = rooms.map(it => `<option value="${it.id}">${currentLang === 'ar' ? it.ar : it.en}</option>`).join("");
}

$("btnAdd").onclick = () => {
    const catIdx = $("buildingCat").value;
    const roomIdx = $("roomType").selectedIndex;
    const it = REF_DATA.categories[catIdx].items[roomIdx];
    const vol = parseFloat($("roomVol").value);

    if(!vol) return;

    const cfm = Math.round((it.ach * (vol * 35.3147)) / 60);
    const tr = (cfm/400).toFixed(2);
    
    RESULTS.unshift({
        id: Date.now(),
        name_ar: it.ar, name_en: it.en,
        cfm: cfm, tr: tr, vol: vol,
        rec: getRecommendation(tr, it.med)
    });

    localStorage.setItem('hvac_v7', JSON.stringify(RESULTS));
    updateUI();
    $("roomVol").value = "";
};

function renderResults() {
    $("resultsList").innerHTML = RESULTS.map((r, i) => `
        <div class="item">
            <span class="pill">${r.tr} TR</span>
            <b>${currentLang === 'ar' ? r.name_ar : r.name_en}</b>
            <div style="font-size:11px; color:#38bdf8; margin-top:5px;">Airflow: ${r.cfm} CFM | Vol: ${r.vol} m³</div>
            <div class="recommendation-box">💡 ${r.rec}</div>
            <span onclick="deleteItem(${i})" style="position:absolute; top:10px; left:10px; color:#ef4444; cursor:pointer">✕</span>
        </div>
    `).join("");
}

function updateUI() {
    renderResults();
    updateChart();
    const totalTR = RESULTS.reduce((s, r) => s + parseFloat(r.tr), 0);
    const totalCFM = RESULTS.reduce((s, r) => s + r.cfm, 0);
    $("qTR").textContent = totalTR.toFixed(2);
    $("qCFM").textContent = totalCFM;
    $("qCnt").textContent = RESULTS.length;
}

// تصدير PDF احترافي
$("btnExportPDF").onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text("HVAC Load Calculation Report", 14, 20);
    doc.autoTable({
        startY: 30,
        head: [['Room Name', 'Volume (m3)', 'Airflow (CFM)', 'Load (TR)', 'Recommendation']],
        body: RESULTS.map(r => [r.name_en, r.vol, r.cfm, r.tr, r.rec]),
    });
    doc.save("HVAC_Report.pdf");
};

// تصدير Excel
$("btnExportExcel").onclick = () => {
    const ws = XLSX.utils.json_to_sheet(RESULTS.map(r => ({
        "Room": r.name_en, "Volume": r.vol, "CFM": r.cfm, "TR": r.tr, "System": r.rec
    })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, "HVAC_Report.xlsx");
};

function setupNav() {
    document.querySelectorAll(".navBtn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".tabPage").forEach(p => p.classList.remove("active"));
            document.querySelectorAll(".navBtn").forEach(b => b.classList.remove("active"));
            $(btn.dataset.tab).classList.add("active");
            btn.classList.add("active");
        }
    });
}

function updateChart() {
    if (RESULTS.length === 0) { $("dashCard").style.display="none"; return; }
    $("dashCard").style.display="block";
    const ctx = $("loadChart").getContext('2d');
    if(myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: RESULTS.map(r => currentLang === 'ar' ? r.name_ar : r.name_en),
            datasets: [{ data: RESULTS.map(r => r.tr), backgroundColor: ['#38bdf8','#fbbf24','#f87171','#34d399','#a78bfa'] }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function deleteItem(idx) { RESULTS.splice(idx, 1); localStorage.setItem('hvac_v7', JSON.stringify(RESULTS)); updateUI(); }
function clearAllData() { if(confirm("مسح؟")) { RESULTS=[]; localStorage.clear(); location.reload(); } }

init();
