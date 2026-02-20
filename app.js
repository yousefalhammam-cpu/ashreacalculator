let currentLang = 'ar';
let currentInput = "";
let calcHistory = [];

const roomData = {
    medical: [
        { id: 'or', ar: 'غرفة عمليات (OR)', en: 'Operating Room', ach: 25, factor: 300 },
        { id: 'icu', ar: 'عناية مركزة (ICU)', en: 'Intensive Care', ach: 12, factor: 400 },
        { id: 'iso', ar: 'غرفة عزل', en: 'Isolation Room', ach: 12, factor: 380 },
        { id: 'er', ar: 'طوارئ واستقبال', en: 'Emergency', ach: 15, factor: 400 },
        { id: 'lab', ar: 'مختبرات', en: 'Laboratories', ach: 12, factor: 350 },
        { id: 'xray', ar: 'أشعة X-Ray', en: 'Radiology', ach: 10, factor: 400 },
        { id: 'dent', ar: 'عيادة أسنان', en: 'Dental Clinic', ach: 10, factor: 380 },
        { id: 'patient', ar: 'غرفة تنويم', en: 'Patient Room', ach: 6, factor: 450 }
    ],
    commercial: [
        { id: 'off', ar: 'مكاتب مفتوحة', en: 'Open Offices', ach: 8, factor: 450 },
        { id: 'mall', ar: 'مركز تجاري', en: 'Mall', ach: 10, factor: 400 },
        { id: 'rest', ar: 'صالة مطعم', en: 'Restaurant Area', ach: 20, factor: 300 },
        { id: 'gym', ar: 'نادي رياضي', en: 'Gym', ach: 15, factor: 350 },
        { id: 'hotel', ar: 'غرف فندق', en: 'Hotel Room', ach: 8, factor: 450 },
        { id: 'cinema', ar: 'سينما', en: 'Cinema', ach: 15, factor: 320 }
    ],
    residential: [
        { id: 'liv', ar: 'مجلس / صالة معيشة', en: 'Living Room', ach: 6, factor: 450 },
        { id: 'bed', ar: 'غرفة نوم', en: 'Bedroom', ach: 4, factor: 550 },
        { id: 'kit', ar: 'مطبخ منزلي', en: 'Kitchen', ach: 10, factor: 350 },
        { id: 'bath', ar: 'دورة مياه', en: 'Bathroom', ach: 12, factor: 300 }
    ],
    industrial: [
        { id: 'server', ar: 'غرفة سيرفرات', en: 'Server Room', ach: 20, factor: 200 },
        { id: 'ware', ar: 'مستودع', en: 'Warehouse', ach: 4, factor: 600 }
    ]
};

const translations = {
    ar: { nav_calc: "الحاسبة", nav_duct: "الدكت", lang: "English", cat_med: "🏥 طبي", cat_comm: "🏢 تجاري", cat_res: "🏠 سكني", cat_ind: "⚙️ صناعي" },
    en: { nav_calc: "Calc", nav_duct: "Duct", lang: "العربية", cat_med: "🏥 Medical", cat_comm: "🏢 Commercial", cat_res: "🏠 Residential", cat_ind: "⚙️ Industrial" }
};

window.onload = () => updateUI();

function press(n) { currentInput += n; document.getElementById('display').innerText = currentInput; }
function clearDisplay() { currentInput = ""; document.getElementById('display').innerText = "0"; }
function deleteLast() { currentInput = currentInput.slice(0, -1); document.getElementById('display').innerText = currentInput || "0"; }

function calculateLoad() {
    const vol = parseFloat(currentInput);
    if (!vol) return;
    const roomId = document.getElementById('room-select').value;
    const all = [...roomData.medical, ...roomData.commercial, ...roomData.residential, ...roomData.industrial];
    const spec = all.find(r => r.id === roomId);
    
    const cfm = Math.round((vol * 35.3147 * spec.ach) / 60);
    const tr = (cfm / spec.factor).toFixed(2);
    
    const entry = { room: currentLang === 'ar' ? spec.ar : spec.en, tr: tr, cfm: cfm };
    calcHistory.push(entry);
    
    document.getElementById('unit-label').innerText = `${cfm} CFM | ${tr} TR`;
    updateHistoryUI();
    document.getElementById('targetCFM').value = cfm; // نقل الـ CFM للدكت تلقائياً
}

function updateHistoryUI() {
    const tbody = document.getElementById('history-body');
    tbody.innerHTML = calcHistory.map(item => `
        <tr><td>${item.room}</td><td style="color:var(--accent)">${item.tr}</td><td>${item.cfm}</td></tr>
    `).reverse().join('');
}

function clearHistory() { calcHistory = []; updateHistoryUI(); }

function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
}

function toggleLanguage() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    document.getElementById('html-tag').dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    updateUI();
}

function updateUI() {
    const t = translations[currentLang];
    document.getElementById('txt-lang-btn').innerText = t.lang;
    document.querySelectorAll('.nav-text').forEach(el => el.innerText = t[el.getAttribute('data-key')]);
    
    const select = document.getElementById('room-select');
    select.innerHTML = `
        <optgroup label="${t.cat_med}">${roomData.medical.map(r=>`<option value="${r.id}">${currentLang=='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${t.cat_comm}">${roomData.commercial.map(r=>`<option value="${r.id}">${currentLang=='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${t.cat_res}">${roomData.residential.map(r=>`<option value="${r.id}">${currentLang=='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${t.cat_ind}">${roomData.industrial.map(r=>`<option value="${r.id}">${currentLang=='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
    `;
    updateHistoryUI();
}

function runDuctCalc() {
    const q = document.getElementById('targetCFM').value;
    const w = document.getElementById('fixWidth').value;
    if(!q || !w) return;
    const h = Math.ceil(((q / 1000) * 144) / w);
    document.getElementById('duct-result').innerText = `${w}" x ${h}" Inch`;
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(18); doc.text("HVAC Load Report", 20, 20);
    doc.setFontSize(12);
    calcHistory.forEach((item, i) => {
        doc.text(`${i+1}. ${item.room} - Load: ${item.tr} TR | Air: ${item.cfm} CFM`, 20, 40 + (i*10));
    });
    doc.save("Project_Report.pdf");
}

function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(calcHistory);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "ProjectResults");
    XLSX.writeFile(wb, "Project_Report.xlsx");
}
