let REF_DATA = null;
let RESULTS = JSON.parse(localStorage.getItem('hvac_results')) || [];
let currentLang = localStorage.getItem('hvac_lang') || 'ar';
let myChart = null;

const $ = (id) => document.getElementById(id);

const i18n = {
    ar: {
        nav_calc: "الحاسبة", nav_ref: "المرجع", nav_exp: "تصدير", nav_set: "إعدادات",
        btn_add: "إضافة للتقرير", ph_vol: "حجم الغرفة م³", ph_search: "بحث في المعايير...",
        sum_tr: "إجمالي الحمل", sum_cfm: "إجمالي CFM", sum_rooms: "الغرف",
        dash_title: "لوحة التحكم", btn_pdf: "تحميل PDF", btn_clear: "مسح البيانات",
        set_lang: "لغة التطبيق"
    },
    en: {
        nav_calc: "Calculator", nav_ref: "Reference", nav_exp: "Export", nav_set: "Settings",
        btn_add: "Add to Report", ph_vol: "Room Volume m³", ph_search: "Search Rooms...",
        sum_tr: "Total Load", sum_cfm: "Total CFM", sum_rooms: "Rooms",
        dash_title: "Load Dashboard", btn_pdf: "Download PDF", btn_clear: "Clear Data",
        set_lang: "App Language"
    }
};

async function init() {
    const resp = await fetch('data.json?v=' + Date.now());
    REF_DATA = await resp.json();
    
    // تعبئة التصنيفات
    const catSel = $("buildingCat");
    REF_DATA.categories.forEach((cat, idx) => {
        catSel.innerHTML += `<option value="${idx}">${currentLang === 'ar' ? cat.name_ar : cat.name_en}</option>`;
    });

    changeLanguage(currentLang);
    setupNavigation();
    renderResults();
}

function changeLanguage(lang) {
    currentLang = lang;
    localStorage.setItem('hvac_lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    $("langSwitch").value = lang;

    // ترجمة النصوص
    document.querySelectorAll('[data-i18n]').forEach(el => {
        el.textContent = i18n[lang][el.dataset.i18n];
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(el => {
        el.placeholder = i18n[lang][el.dataset.i18nPh];
    });

    updateRoomList();
    renderResults();
    renderReference();
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
    RESULTS.unshift({
        id: Date.now(),
        name_ar: it.ar, name_en: it.en,
        cfm: cfm, tr: (cfm/400).toFixed(2), unit: it.unit
    });

    saveAndRender();
    $("roomVol").value = "";
};

function saveAndRender() {
    localStorage.setItem('hvac_results', JSON.stringify(RESULTS));
    renderResults();
    updateQuickSummary();
}

function renderResults() {
    $("resultsList").innerHTML = RESULTS.map((r, i) => `
        <div class="item">
            <span class="pill">${r.unit}</span>
            <b>${currentLang === 'ar' ? r.name_ar : r.name_en}</b>
            <div style="margin-top:8px; font-size:12px; color:var(--primary)">
                CFM: ${r.cfm} | ${r.tr} TR
                <span onclick="deleteItem(${i})" style="float:left; color:#ef4444; cursor:pointer">✖</span>
            </div>
        </div>
    `).join("");
}

function deleteItem(idx) {
    RESULTS.splice(idx, 1);
    saveAndRender();
}

function updateQuickSummary() {
    const tr = RESULTS.reduce((s, r) => s + parseFloat(r.tr), 0);
    const cfm = RESULTS.reduce((s, r) => s + r.cfm, 0);
    $("qTR").textContent = tr.toFixed(2);
    $("qCFM").textContent = cfm.toLocaleString();
    $("qCnt").textContent = RESULTS.length;
}

function renderReference() {
    const q = $("roomSearch").value.toLowerCase();
    let html = "";
    REF_DATA.categories.forEach(cat => {
        cat.items.forEach(it => {
            const name = currentLang === 'ar' ? it.ar : it.en;
            if(name.toLowerCase().includes(q)) {
                html += `<div class="item"><b>${name}</b><br><small>ACH: ${it.ach}</small></div>`;
            }
        });
    });
    $("roomsList").innerHTML = html;
}

function updateChart() {
    const ctx = $("loadChart").getContext('2d');
    if(myChart) myChart.destroy();
    myChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: RESULTS.map(r => currentLang === 'ar' ? r.name_ar : r.name_en),
            datasets: [{ data: RESULTS.map(r => r.tr), backgroundColor: ['#38bdf8','#fbbf24','#f87171','#34d399'] }]
        },
        options: { maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
}

function setupNavigation() {
    document.querySelectorAll(".navBtn").forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll(".tabPage").forEach(p => p.classList.remove("active"));
            document.querySelectorAll(".navBtn").forEach(b => b.classList.remove("active"));
            $(btn.dataset.tab).classList.add("active");
            btn.classList.add("active");
            if(btn.dataset.tab === 'tab-settings') setTimeout(updateChart, 100);
        };
    });
}

function clearData() { if(confirm("Clear all?")) { RESULTS=[]; saveAndRender(); } }

init();
