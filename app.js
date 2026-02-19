let REF_DATA = null;
let RESULTS = JSON.parse(localStorage.getItem('hvac_final')) || [];
let currentLang = localStorage.getItem('lang_final') || 'ar';
let myChart = null;

const $ = (id) => document.getElementById(id);

const i18n = {
    ar: {
        nav_calc: "الحاسبة", nav_ref: "المرجع", nav_exp: "تصدير", nav_set: "إعدادات",
        btn_add: "إضافة للتقرير", ph_vol: "حجم الغرفة م³",
        sum_tr: "إجمالي TR", sum_cfm: "إجمالي CFM", sum_rooms: "الغرف",
        btn_clear: "مسح البيانات", set_lang: "لغة التطبيق", exp_ready: "التقرير جاهز للاستخراج"
    },
    en: {
        nav_calc: "Calculator", nav_ref: "Reference", nav_exp: "Export", nav_set: "Settings",
        btn_add: "Add to Report", ph_vol: "Room Volume m³",
        sum_tr: "Total Load", sum_cfm: "Total CFM", sum_rooms: "Rooms",
        btn_clear: "Clear All", set_lang: "App Language", exp_ready: "Report is ready for export"
    }
};

// محرك التوصيات بناءً على الحمل (TR) ونوع الغرفة
function getRec(tr, isMed) {
    if (isMed) return currentLang === 'ar' ? "وحدة معالجة هواء (AHU) مع فلاتر HEPA" : "AHU with HEPA Filters";
    if (tr <= 1.5) return currentLang === 'ar' ? "مكيف سبليت جداري (Hi-Wall Split)" : "Hi-Wall Split Unit";
    if (tr <= 4) return currentLang === 'ar' ? "كونسيلد مخفي (Ducted Split)" : "Ducted Split Unit";
    if (tr <= 15) return currentLang === 'ar' ? "وحدة مجمعة (Package Unit)" : "Rooftop Package Unit";
    return currentLang === 'ar' ? "نظام مركزي (Chiller System)" : "Central Chiller System";
}

async function init() {
    try {
        const resp = await fetch('data.json');
        REF_DATA = await resp.json();
        
        const catSel = $("buildingCat");
        REF_DATA.categories.forEach((cat, idx) => {
            catSel.innerHTML += `<option value="${idx}">${currentLang === 'ar' ? cat.name_ar : cat.name_en}</option>`;
        });

        changeLanguage(currentLang);
        setupNav();
        updateUI();
    } catch(e) { console.error("Data load failed", e); }
}

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('lang_final', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    $("langSwitch").value = lang;

    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = i18n[lang][el.dataset.i18n];
    });
    
    updateRoomList();
    renderResults();
}

function updateRoomList() {
    const catIdx = $("buildingCat").value;
    const rooms = REF_DATA.categories[catIdx].items;
    $("roomType").innerHTML = rooms.map(it => 
        `<option value="${it.id}">${currentLang === 'ar' ? it.ar : it.en}</option>`
    ).join("");
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
        ar: it.ar, en: it.en,
        cfm: cfm, tr: tr,
        rec: getRec(tr, it.med),
        vol: vol
    });

    localStorage.setItem('hvac_final', JSON.stringify(RESULTS));
    updateUI();
    $("roomVol").value = "";
};

function updateUI() {
    renderResults();
    updateChart();
    updateQuickSummary();
}

function renderResults() {
    $("resultsList").innerHTML = RESULTS.map((r, i) => `
        <div class="item">
            <span class="pill">${r.tr} TR</span>
            <b>${currentLang === 'ar' ? r.ar : r.en}</b>
            <div style="font-size:11px; color:var(--primary); margin-top:5px;">${r.cfm} CFM | Volume: ${r.vol} m³</div>
            <div class="recommendation-box">💡 ${r.rec}</div>
            <span onclick="deleteItem(${i})" style="position:absolute; top:10px; left:10px; color:#ef4444; cursor:pointer">✕</span>
        </div>
    `).join("");
}

function updateChart() {
    if (RESULTS.length === 0) { $("dashCard").style.display="none"; return; }
    $("dashCard").style.display="block";
    const ctx = $("loadChart").getContext('2d');
    if(myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: RESULTS.map(r => currentLang === 'ar' ? r.ar : r.en),
            datasets: [{ data: RESULTS.map(r => r.tr), backgroundColor: ['#38bdf8','#fbbf24','#f87171','#34d399','#a78bfa'] }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function updateQuickSummary() {
    const tr = RESULTS.reduce((s, r) => s + parseFloat(r.tr), 0);
    const cfm = RESULTS.reduce((s, r) => s + r.cfm, 0);
    $("qTR").textContent = tr.toFixed(2);
    $("qCFM").textContent = cfm.toLocaleString();
    $("qCnt").textContent = RESULTS.length;
}

// التصدير إلى Excel
$("btnExportExcel").onclick = () => {
    const data = RESULTS.map(r => ({
        "Area Name": r.en,
        "Airflow (CFM)": r.cfm,
        "Load (TR)": r.tr,
        "Recommended System": r.rec
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "HVAC Load Report");
    XLSX.writeFile(wb, "HVAC_Report.xlsx");
};

// التصدير إلى PDF
$("btnExportPDF").onclick = () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("HVAC Engineering Report", 14, 15);
    doc.autoTable({
        startY: 20,
        head: [['Room Name', 'CFM', 'Tons (TR)', 'Recommended System']],
        body: RESULTS.map(r => [r.en, r.cfm, r.tr, r.rec]),
    });
    doc.save("HVAC_Report.pdf");
};

function setupNav() {
    document.querySelectorAll(".navBtn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".tabPage").forEach(p => p.classList.remove("active"));
            document.querySelectorAll(".navBtn").forEach(b => b.classList.remove("active"));
            $(btn.dataset.tab).classList.add("active");
            btn.classList.add("active");
            if(btn.dataset.tab === 'tab-calc') updateChart();
        }
    });
}

function deleteItem(idx) { RESULTS.splice(idx, 1); localStorage.setItem('hvac_final', JSON.stringify(RESULTS)); updateUI(); }
function clearAllData() { if(confirm("Clear all data?")) { RESULTS=[]; localStorage.clear(); location.reload(); } }

init();
