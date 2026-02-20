let currentLang = 'ar';
let currentInput = "";
let lastResult = { tr: 0, cfm: 0, room: "", vol: 0 };

// قاعدة بيانات الغرف الشاملة
const roomData = {
    medical: [
        { id: 'or', ar: 'غرفة عمليات - OR', en: 'Operating Room', ach: 20, factor: 350 },
        { id: 'icu', ar: 'عناية مركزة - ICU', en: 'Intensive Care', ach: 6, factor: 400 },
        { id: 'iso', ar: 'غرفة عزل - Isolation', en: 'Isolation Room', ach: 12, factor: 380 },
        { id: 'er', ar: 'طوارئ - Emergency', en: 'Emergency Room', ach: 10, factor: 400 },
        { id: 'lab', ar: 'مختبرات - Labs', en: 'Laboratories', ach: 12, factor: 350 },
        { id: 'pharm', ar: 'صيدلية - Pharmacy', en: 'Pharmacy', ach: 4, factor: 450 },
        { id: 'xray', ar: 'أشعة - Radiology', en: 'X-Ray Unit', ach: 6, factor: 400 },
        { id: 'dent', ar: 'عيادة أسنان - Dental', en: 'Dental Clinic', ach: 8, factor: 380 }
    ],
    commercial: [
        { id: 'off', ar: 'مكاتب - Offices', en: 'Offices', ach: 6, factor: 450 },
        { id: 'mall', ar: 'مول تجاري - Mall', en: 'Shopping Mall', ach: 8, factor: 400 },
        { id: 'rest', ar: 'مطعم - Restaurant', en: 'Restaurant', ach: 15, factor: 300 },
        { id: 'gym', ar: 'نادي رياضي - Gym', en: 'Gymnasium', ach: 10, factor: 350 },
        { id: 'pray', ar: 'مصلى - Prayer Room', en: 'Prayer Room', ach: 8, factor: 400 }
    ],
    residential: [
        { id: 'bed', ar: 'غرفة نوم - Bedroom', en: 'Bedroom', ach: 4, factor: 500 },
        { id: 'kit', ar: 'مطبخ - Kitchen', en: 'Kitchen', ach: 8, factor: 400 },
        { id: 'maj', ar: 'مجلس - Majlis', en: 'Majlis', ach: 5, factor: 450 }
    ]
};

const translations = {
    ar: { nav_calc: "الحاسبة", nav_duct: "الدكت", nav_comm: "المجتمع", nav_export: "تصدير", lang: "English", input_label: "الحجم (م³)" },
    en: { nav_calc: "Calc", nav_duct: "Duct", nav_comm: "Forum", nav_export: "Export", lang: "العربية", input_label: "Volume (m³)" }
};

window.onload = () => updateUI();

// وظائف الأرقام
function press(n) {
    if (currentInput.length < 10) {
        currentInput += n;
        document.getElementById('display').innerText = currentInput;
    }
}

function clearDisplay() {
    currentInput = "";
    document.getElementById('display').innerText = "0";
    document.getElementById('unit-label').innerText = "0 CFM | 0 TR";
}

function deleteLast() {
    currentInput = currentInput.slice(0, -1);
    document.getElementById('display').innerText = currentInput || "0";
}

// الحساب والربط
function calculateLoad() {
    const vol = parseFloat(currentInput);
    if (!vol) return;
    const roomId = document.getElementById('room-select').value;
    const spec = [...roomData.medical, ...roomData.commercial, ...roomData.residential].find(r => r.id === roomId);

    const cfm = (vol * 35.3147 * spec.ach) / 60;
    const tr = cfm / spec.factor;

    lastResult = { tr: tr.toFixed(2), cfm: Math.round(cfm), room: currentLang==='ar'?spec.ar:spec.en, vol: vol };

    document.getElementById('display').innerText = tr.toFixed(2);
    document.getElementById('unit-label').innerText = `${Math.round(cfm)} CFM | ${tr.toFixed(2)} TR`;
    document.getElementById('targetCFM').value = Math.round(cfm);
}

// التنقل بين التبويبات
function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
}

// تغيير اللغة
function toggleLanguage() {
    currentLang = (currentLang === 'ar') ? 'en' : 'ar';
    document.getElementById('html-tag').dir = (currentLang === 'ar') ? 'rtl' : 'ltr';
    updateUI();
}

function updateUI() {
    const t = translations[currentLang];
    document.getElementById('txt-input-label').innerText = t.input_label;
    document.getElementById('txt-lang-btn').innerText = t.lang;
    document.querySelectorAll('.nav-text').forEach(el => el.innerText = t[el.getAttribute('data-key')]);

    const select = document.getElementById('room-select');
    select.innerHTML = `
        <optgroup label="${currentLang==='ar'?'🏥 طبي':'🏥 Medical'}">${roomData.medical.map(r=>`<option value="${r.id}">${currentLang==='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${currentLang==='ar'?'🏢 تجاري':'🏢 Commercial'}">${roomData.commercial.map(r=>`<option value="${r.id}">${currentLang==='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${currentLang==='ar'?'🏠 سكني':'🏠 Residential'}">${roomData.residential.map(r=>`<option value="${r.id}">${currentLang==='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
    `;
}

// حساب الدكت
function runDuctCalc() {
    const q = document.getElementById('targetCFM').value;
    const w = document.getElementById('fixWidth').value;
    if(!q || !w) return;
    const h = Math.ceil(((q / 1000) * 144) / w);
    document.getElementById('duct-result').innerText = `${w}" x ${h}" Inch`;
}

// التصدير
function exportPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text("HVAC Engineering Report", 10, 10);
    doc.text(`Room: ${lastResult.room}`, 10, 20);
    doc.text(`Load: ${lastResult.tr} TR`, 10, 30);
    doc.save("Report.pdf");
}

function exportExcel() {
    const ws = XLSX.utils.json_to_sheet([lastResult]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "HVAC");
    XLSX.writeFile(wb, "AirCalc.xlsx");
}
