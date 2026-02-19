let REF_DATA = null;
let RESULTS = JSON.parse(localStorage.getItem('hvac_v5')) || [];
let currentLang = localStorage.getItem('lang_v5') || 'ar';
let myChart = null;

const $ = (id) => document.getElementById(id);

// محرك التوصيات الذكي
function getRecommendation(tr, isMed) {
    if (isMed) {
        if (tr > 5) return currentLang === 'ar' ? "موصى به: وحدة معالجة هواء (AHU) مع فلاتر HEPA" : "Rec: Air Handling Unit (AHU) with HEPA filters";
        return currentLang === 'ar' ? "موصى به: وحدة كونسيلد طبية (Medical FCU)" : "Rec: Medical Concealed Unit (FCU)";
    }
    if (tr <= 1.5) return currentLang === 'ar' ? "موصى به: مكيف سبليت جداري (Hi-Wall Split)" : "Rec: Hi-Wall Split Unit";
    if (tr <= 4) return currentLang === 'ar' ? "موصى به: كونسيلد مخفي (Ducted Split)" : "Rec: Ducted Split Unit";
    if (tr <= 20) return currentLang === 'ar' ? "موصى به: وحدة مجمعة (Package Unit)" : "Rec: Rooftop Package Unit";
    return currentLang === 'ar' ? "موصى به: نظام مركزي (Chiller / AHU)" : "Rec: Central System (Chiller/AHU)";
}

async function init() {
    const resp = await fetch('data.json?v=' + Date.now());
    REF_DATA = await resp.json();
    const catSel = $("buildingCat");
    REF_DATA.categories.forEach((cat, idx) => {
        catSel.innerHTML += `<option value="${idx}">${currentLang === 'ar' ? cat.name_ar : cat.name_en}</option>`;
    });
    updateRoomList();
    setupNav();
    renderResults();
    updateChart();
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
        cfm: cfm, tr: tr,
        rec: getRecommendation(tr, it.med)
    });

    save();
};

function save() {
    localStorage.setItem('hvac_v5', JSON.stringify(RESULTS));
    renderResults();
    updateChart();
    $("roomVol").value = "";
}

function renderResults() {
    $("resultsList").innerHTML = RESULTS.map((r, i) => `
        <div class="item">
            <span class="pill">${r.tr} TR</span>
            <b>${currentLang === 'ar' ? r.name_ar : r.name_en}</b>
            <div style="font-size:12px; color:var(--primary); margin-top:5px;">Airflow: ${r.cfm} CFM</div>
            <div class="recommendation-box">💡 ${r.rec}</div>
            <span onclick="deleteItem(${i})" style="position:absolute; top:10px; left:10px; color:#ef4444; cursor:pointer">✕</span>
        </div>
    `).join("");
    const totalTR = RESULTS.reduce((s, r) => s + parseFloat(r.tr), 0);
    $("qTR").textContent = totalTR.toFixed(1);
    $("qCnt").textContent = RESULTS.length;
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

function setupNav() {
    document.querySelectorAll(".navBtn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".tabPage").forEach(p => p.classList.remove("active"));
            $(btn.dataset.tab).classList.add("active");
            document.querySelectorAll(".navBtn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
        }
    });
}

function deleteItem(idx) { RESULTS.splice(idx, 1); save(); }

init();
