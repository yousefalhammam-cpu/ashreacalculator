let currentLang = 'ar';
let currentInput = "";
let calcHistory = [];

const roomData = {
    medical: [
        { id: 'or', ar: 'غرفة عمليات كبرى (OR)', en: 'Major Operating Room', ach: 25, factor: 300 },
        { id: 'icu', ar: 'عناية مركزة (ICU)', en: 'Intensive Care Unit', ach: 12, factor: 400 },
        { id: 'iso', ar: 'غرفة عزل', en: 'Isolation Room', ach: 12, factor: 380 },
        { id: 'er', ar: 'طوارئ واستقبال', en: 'Emergency Room', ach: 15, factor: 400 },
        { id: 'lab', ar: 'مختبرات وتحاليل', en: 'Laboratories', ach: 12, factor: 350 },
        { id: 'dent', ar: 'عيادة أسنان', en: 'Dental Clinic', ach: 10, factor: 380 },
        { id: 'patient', ar: 'غرفة تنويم مرضى', en: 'Patient Room', ach: 6, factor: 450 }
    ],
    commercial: [
        { id: 'off', ar: 'مكاتب مفتوحة', en: 'Open Offices', ach: 8, factor: 450 },
        { id: 'mall', ar: 'مركز تجاري / مول', en: 'Shopping Mall', ach: 10, factor: 400 },
        { id: 'rest', ar: 'صالة مطعم', en: 'Dining Area', ach: 20, factor: 300 },
        { id: 'gym', ar: 'نادي رياضي', en: 'Gymnasium', ach: 15, factor: 350 },
        { id: 'hotel', ar: 'غرف فندقية', en: 'Hotel Room', ach: 8, factor: 450 },
        { id: 'pray', ar: 'مسجد / دار عبادة', en: 'Prayer Hall', ach: 12, factor: 350 }
    ],
    residential: [
        { id: 'liv', ar: 'مجلس / صالة معيشة', en: 'Living Room', ach: 6, factor: 450 },
        { id: 'bed', ar: 'غرفة نوم', en: 'Bedroom', ach: 4, factor: 550 },
        { id: 'kit', ar: 'مطبخ منزلي', en: 'Kitchen', ach: 10, factor: 350 },
        { id: 'bath', ar: 'دورة مياه', en: 'Bathroom', ach: 12, factor: 300 }
    ]
};

const translations = {
    ar: { nav_calc: "الحاسبة", nav_duct: "الدكت", lang: "English", cat_med: "🏥 طبي", cat_comm: "🏢 تجاري", cat_res: "🏠 سكني", alert: "ℹ️ اضغط CALC للإضافة للسجل." },
    en: { nav_calc: "Calc", nav_duct: "Duct", lang: "العربية", cat_med: "🏥 Medical", cat_comm: "🏢 Commercial", cat_res: "🏠 Residential", alert: "ℹ️ Press CALC to add to history." }
};

window.onload = () => updateUI();

// تصفير عند تغيير الغرفة
function resetForNewRoom() {
    clearDisplay();
    document.getElementById('unit-label').innerText = "0 CFM | 0 TR";
}

function press(n) { currentInput += n; document.getElementById('display').innerText = currentInput; }
function clearDisplay() { currentInput = ""; document.getElementById('display').innerText = "0"; }
function deleteLast() { currentInput = currentInput.slice(0, -1); document.getElementById('display').innerText = currentInput || "0"; }

function calculateLoad(save = false) {
    const vol = parseFloat(currentInput);
    if (!vol) return;
    
    const roomId = document.getElementById('room-select').value;
    const all = [...roomData.medical, ...roomData.commercial, ...roomData.residential];
    const spec = all.find(r => r.id === roomId);
    
    const cfm = Math.round((vol * 35.3147 * spec.ach) / 60);
    const tr = (cfm / spec.factor).toFixed(2);
    
    document.getElementById('unit-label').innerText = `${cfm} CFM | ${tr} TR`;
    document.getElementById('targetCFM').value = cfm;

    if (save) {
        const entry = { id: Date.now(), room: currentLang === 'ar' ? spec.ar : spec.en, tr: tr, cfm: cfm };
        calcHistory.push(entry);
        updateHistoryUI();
    }
}

function updateHistoryUI() {
    const tbody = document.getElementById('history-body');
    tbody.innerHTML = calcHistory.map(item => `
        <tr>
            <td>${item.room}</td>
            <td style="color:var(--accent)">${item.tr}</td>
            <td>${item.cfm}</td>
            <td><button class="btn-delete-row" onclick="deleteEntry(${item.id})">🗑️</button></td>
        </tr>
    `).reverse().join('');
}

function deleteEntry(id) {
    calcHistory = calcHistory.filter(i => i.id !== id);
    updateHistoryUI();
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
    document.getElementById('txt-alert').innerText = t.alert;
    document.querySelectorAll('.nav-text').forEach(el => el.innerText = t[el.getAttribute('data-key')]);
    
    const select = document.getElementById('room-select');
    select.innerHTML = `
        <optgroup label="${t.cat_med}">${roomData.medical.map(r=>`<option value="${r.id}">${currentLang=='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${t.cat_comm}">${roomData.commercial.map(r=>`<option value="${r.id}">${currentLang=='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${t.cat_res}">${roomData.residential.map(r=>`<option value="${r.id}">${currentLang=='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
    `;
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
    doc.text("HVAC Project Report", 20, 20);
    calcHistory.forEach((item, i) => {
        doc.text(`${i+1}. ${item.room}: ${item.tr} TR / ${item.cfm} CFM`, 20, 30 + (i*10));
    });
    doc.save("Project_Report.pdf");
}

function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(calcHistory);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Results");
    XLSX.writeFile(wb, "Project_Report.xlsx");
}
