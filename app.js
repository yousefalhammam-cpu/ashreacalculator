let currentLang = 'ar';
let currentInput = "";
let calcHistory = [];

const roomData = {
    medical: [
        { id: 'or', ar: 'غرفة عمليات - OR', en: 'Operating Room', ach: 20, factor: 350 },
        { id: 'icu', ar: 'عناية مركزة - ICU', en: 'Intensive Care', ach: 6, factor: 400 },
        { id: 'iso', ar: 'غرفة عزل - Isolation', en: 'Isolation', ach: 12, factor: 380 },
        { id: 'dent', ar: 'عيادة أسنان', en: 'Dental Clinic', ach: 8, factor: 380 }
    ],
    commercial: [
        { id: 'off', ar: 'مكاتب - Offices', en: 'Offices', ach: 6, factor: 450 },
        { id: 'mall', ar: 'مول تجاري', en: 'Mall', ach: 8, factor: 400 },
        { id: 'rest', ar: 'مطعم', en: 'Restaurant', ach: 15, factor: 300 }
    ],
    residential: [
        { id: 'bed', ar: 'غرفة نوم', en: 'Bedroom', ach: 4, factor: 500 },
        { id: 'liv', ar: 'صالة معيشة', en: 'Living Room', ach: 4, factor: 450 }
    ]
};

const translations = {
    ar: { nav_calc: "الحاسبة", nav_duct: "الدكت", nav_export: "تصدير", lang: "English", cat_med: "🏥 طبي", cat_comm: "🏢 تجاري", cat_res: "🏠 سكني", alert: "ℹ️ الحسابات تتراكم تلقائياً أدناه وفي التصدير." },
    en: { nav_calc: "Calc", nav_duct: "Duct", nav_export: "Export", lang: "العربية", cat_med: "🏥 Medical", cat_comm: "🏢 Commercial", cat_res: "🏠 Residential", alert: "ℹ️ Calculations accumulate below and in Export." }
};

window.onload = () => updateUI();

function press(n) { currentInput += n; document.getElementById('display').innerText = currentInput; }
function clearDisplay() { currentInput = ""; document.getElementById('display').innerText = "0"; }
function deleteLast() { currentInput = currentInput.slice(0, -1); document.getElementById('display').innerText = currentInput || "0"; }

function calculateLoad() {
    const vol = parseFloat(currentInput);
    if (!vol) return;
    
    const roomId = document.getElementById('room-select').value;
    const all = [...roomData.medical, ...roomData.commercial, ...roomData.residential];
    const spec = all.find(r => r.id === roomId);
    
    const cfm = (vol * 35.3147 * spec.ach) / 60;
    const tr = cfm / spec.factor;
    
    const result = {
        room: currentLang === 'ar' ? spec.ar : spec.en,
        tr: tr.toFixed(2),
        cfm: Math.round(cfm),
        vol: vol
    };

    calcHistory.push(result);
    document.getElementById('display').innerText = result.tr;
    document.getElementById('unit-label').innerText = `${result.cfm} CFM | ${result.tr} TR`;
    
    updateHistoryTable();
    if(document.getElementById('targetCFM')) document.getElementById('targetCFM').value = result.cfm;
}

function updateHistoryTable() {
    const tbody = document.getElementById('history-body');
    tbody.innerHTML = calcHistory.map(item => `
        <tr><td>${item.room}</td><td style="color:var(--accent)">${item.tr}</td><td>${item.cfm}</td></tr>
    `).join('');
}

function clearHistory() { calcHistory = []; updateHistoryTable(); alert(currentLang === 'ar' ? "تم مسح السجل" : "History Cleared"); }

function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
}

function toggleLanguage() {
    currentLang = (currentLang === 'ar') ? 'en' : 'ar';
    document.getElementById('html-tag').dir = (currentLang === 'ar') ? 'rtl' : 'ltr';
    updateUI();
}

function updateUI() {
    const t = translations[currentLang];
    document.getElementById('txt-lang-btn').innerText = t.lang;
    document.getElementById('txt-alert').innerText = t.alert;
    document.querySelectorAll('.nav-text').forEach(el => el.innerText = t[el.getAttribute('data-key')]);
    
    const select = document.getElementById('room-select');
    select.innerHTML = `
        <optgroup label="${t.cat_med}">${roomData.medical.map(r=>`<option value="${r.id}">${currentLang==='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${t.cat_comm}">${roomData.commercial.map(r=>`<option value="${r.id}">${currentLang==='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${t.cat_res}">${roomData.residential.map(r=>`<option value="${r.id}">${currentLang==='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
    `;
}

function runDuctCalc() {
    const q = document.getElementById('targetCFM').value;
    const w = document.getElementById('fixWidth').value;
    const h = Math.ceil(((q / 1000) * 144) / w);
    document.getElementById('duct-result').innerText = `${w}" x ${h}" Inch`;
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("Project HVAC Report", 10, 10);
    calcHistory.forEach((item, i) => {
        doc.text(`${i+1}. ${item.room}: ${item.tr} TR / ${item.cfm} CFM`, 10, 20 + (i*10));
    });
    doc.save("AirCalc_Report.pdf");
}

function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(calcHistory);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Calculations");
    XLSX.writeFile(wb, "AirCalc_Report.xlsx");
}
