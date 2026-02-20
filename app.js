let currentLang = 'ar';
let currentInput = "";
let calcHistory = [];

// قائمة الغرف الشاملة (مطابقة لـ ASHRAE 170 للمستشفيات)
const roomData = {
    medical: [
        { id: 'or_gen', ar: 'غرفة عمليات عامة (General OR)', en: 'General Operating Room', ach: 20, factor: 300 },
        { id: 'or_ortho', ar: 'غرفة عمليات عظام (Ortho OR)', en: 'Orthopedic OR', ach: 25, factor: 280 },
        { id: 'icu', ar: 'عناية مركزة (ICU)', en: 'Intensive Care Unit', ach: 6, factor: 400 },
        { id: 'peic', ar: 'عزل ضغط موجب (PE)', en: 'Protective Environment', ach: 12, factor: 380 },
        { id: 'aiir', ar: 'عزل ضغط سالب (AII)', en: 'Infection Isolation', ach: 12, factor: 380 },
        { id: 'er_trauma', ar: 'غرفة صدمات وحوادث', en: 'Trauma Room', ach: 15, factor: 350 },
        { id: 'recovery', ar: 'غرفة إفاقة (PACU)', en: 'Recovery Room', ach: 6, factor: 450 },
        { id: 'mri', ar: 'غرفة رنين (MRI)', en: 'MRI Room', ach: 12, factor: 350 },
        { id: 'ct_scan', ar: 'غرفة أشعة مقطعية (CT)', en: 'CT Scan Room', ach: 10, factor: 400 },
        { id: 'lab_gen', ar: 'مختبر عام', en: 'General Lab', ach: 8, factor: 400 },
        { id: 'pharmacy', ar: 'الصيدلية (Pharmacy)', en: 'Pharmacy', ach: 4, factor: 500 },
        { id: 'patient_rm', ar: 'غرفة تنويم مرضى', en: 'Patient Room', ach: 4, factor: 500 },
        { id: 'endoscopy', ar: 'غرفة مناظير (Endoscopy)', en: 'Endoscopy Room', ach: 15, factor: 350 }
    ],
    commercial: [
        { id: 'off_o', ar: 'مكاتب مفتوحة', en: 'Open Offices', ach: 8, factor: 450 },
        { id: 'off_p', ar: 'مكتب خاص', en: 'Private Office', ach: 6, factor: 500 },
        { id: 'mall', ar: 'مركز تجاري / مول', en: 'Shopping Mall', ach: 10, factor: 400 },
        { id: 'rest', ar: 'صالة مطعم', en: 'Dining Area', ach: 20, factor: 300 },
        { id: 'gym', ar: 'نادي رياضي', en: 'Gymnasium', ach: 15, factor: 350 },
        { id: 'pray', ar: 'مسجد / قاعة صلاة', en: 'Prayer Hall', ach: 12, factor: 350 }
    ],
    residential: [
        { id: 'liv', ar: 'صالة معيشة / مجلس', en: 'Living Room/Majlis', ach: 6, factor: 450 },
        { id: 'bed', ar: 'غرفة نوم', en: 'Bedroom', ach: 4, factor: 550 },
        { id: 'kit_r', ar: 'مطبخ منزلي', en: 'Kitchen', ach: 8, factor: 400 },
        { id: 'bath', ar: 'دورة مياه', en: 'Bathroom', ach: 10, factor: 300 }
    ]
};

window.onload = () => updateUI();

// تصفير الحاسبة عند تغيير الغرفة
function resetForNewRoom() {
    clearDisplay();
    document.getElementById('unit-label').innerText = "0 CFM | 0 TR";
}

function press(n) { 
    if (currentInput.length > 9) return;
    currentInput += n; 
    document.getElementById('display').innerText = currentInput; 
}

function clearDisplay() { 
    currentInput = ""; 
    document.getElementById('display').innerText = "0"; 
}

function deleteLast() { 
    currentInput = currentInput.slice(0, -1); 
    document.getElementById('display').innerText = currentInput || "0"; 
}

function calculateLoad(save = false) {
    const vol = parseFloat(currentInput);
    if (!vol) return;
    
    const roomId = document.getElementById('room-select').value;
    const all = [...roomData.medical, ...roomData.commercial, ...roomData.residential];
    const spec = all.find(r => r.id === roomId);
    
    // حساب CFM: (الحجم م3 * 35.3147 * ACH) / 60
    const cfm = Math.round((vol * 35.3147 * spec.ach) / 60);
    const tr = (cfm / spec.factor).toFixed(2);
    
    document.getElementById('unit-label').innerText = `${cfm} CFM | ${tr} TR`;
    if(document.getElementById('targetCFM')) document.getElementById('targetCFM').value = cfm;

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
            <td style="color:var(--ios-orange); font-weight:bold;">${item.tr}</td>
            <td>${item.cfm}</td>
            <td><button style="background:none; border:none; color:#ff3b30; font-size:1.1rem;" onclick="deleteEntry(${item.id})">✕</button></td>
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
    const select = document.getElementById('room-select');
    const t = { 
        ar: { med: "🏥 معايير المستشفيات (ASHRAE)", comm: "🏢 القطاع التجاري", res: "🏠 القطاع السكني" }, 
        en: { med: "Hospital Standards (ASHRAE)", comm: "Commercial Sector", res: "Residential Sector" } 
    }[currentLang];
    
    select.innerHTML = `
        <optgroup label="${t.med}">${roomData.medical.map(r=>`<option value="${r.id}">${currentLang=='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${t.comm}">${roomData.commercial.map(r=>`<option value="${r.id}">${currentLang=='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${t.res}">${roomData.residential.map(r=>`<option value="${r.id}">${currentLang=='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
    `;
    document.getElementById('txt-lang-btn').innerText = currentLang === 'ar' ? "English" : "العربية";
}

function runDuctCalc() {
    const q = document.getElementById('targetCFM').value;
    const w = document.getElementById('fixWidth').value;
    if(!q || !w) return;
    const h = Math.ceil(((q / 1000) * 144) / w); 
    document.getElementById('duct-result').innerText = `${w}" x ${h}"`;
}

function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("HVAC Engineering Report", 20, 20);
    doc.setFontSize(10);
    calcHistory.forEach((item, i) => {
        doc.text(`${i+1}. ${item.room}: ${item.tr} TR / ${item.cfm} CFM`, 20, 40 + (i*8));
    });
    doc.save("Project_Report.pdf");
}

function exportExcel() {
    const ws = XLSX.utils.json_to_sheet(calcHistory);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "HVAC_Data");
    XLSX.writeFile(wb, "Project_Report.xlsx");
}
