let currentLang = 'ar';
let currentInput = "";
let lastResult = { tr: 0, cfm: 0, room: "", vol: 0 };

const roomData = {
    medical: [
        { id: 'or', ar: 'غرفة عمليات - OR', en: 'Operating Room', ach: 20, factor: 350 },
        { id: 'icu', ar: 'عناية مركزة - ICU', en: 'Intensive Care', ach: 6, factor: 400 },
        { id: 'iso', ar: 'غرفة عزل - Isolation', en: 'Isolation', ach: 12, factor: 380 },
        { id: 'er', ar: 'طوارئ - Emergency', en: 'Emergency', ach: 10, factor: 400 },
        { id: 'lab', ar: 'مختبرات - Labs', en: 'Laboratories', ach: 12, factor: 350 },
        { id: 'pharm', ar: 'صيدلية - Pharmacy', en: 'Pharmacy', ach: 4, factor: 450 },
        { id: 'dent', ar: 'عيادة أسنان', en: 'Dental Clinic', ach: 8, factor: 380 }
    ],
    commercial: [
        { id: 'off', ar: 'مكاتب - Offices', en: 'Offices', ach: 6, factor: 450 },
        { id: 'mall', ar: 'مول تجاري', en: 'Mall', ach: 8, factor: 400 },
        { id: 'rest', ar: 'مطعم', en: 'Restaurant', ach: 15, factor: 300 },
        { id: 'gym', ar: 'نادي رياضي', en: 'Gym', ach: 10, factor: 350 },
        { id: 'pray', ar: 'مسجد / مصلى', en: 'Prayer Room', ach: 8, factor: 400 }
    ],
    residential: [
        { id: 'bed', ar: 'غرفة نوم', en: 'Bedroom', ach: 4, factor: 500 },
        { id: 'liv', ar: 'صالة معيشة', en: 'Living Room', ach: 4, factor: 450 },
        { id: 'kit', ar: 'مطبخ منزلي', en: 'Kitchen', ach: 8, factor: 350 },
        { id: 'maj', ar: 'مجلس', en: 'Majlis', ach: 6, factor: 450 }
    ]
};

const translations = {
    ar: { nav_calc: "الحاسبة", nav_duct: "الدكت", nav_export: "تصدير", lang: "English", cat_med: "🏥 طبي", cat_comm: "🏢 تجاري", cat_res: "🏠 سكني" },
    en: { nav_calc: "Calc", nav_duct: "Duct", nav_export: "Export", lang: "العربية", cat_med: "🏥 Medical", cat_comm: "🏢 Commercial", cat_res: "🏠 Residential" }
};

window.onload = () => updateUI();

function press(n) { currentInput += n; document.getElementById('display').innerText = currentInput; calculateLoad(); }
function clearDisplay() { currentInput = ""; document.getElementById('display').innerText = "0"; document.getElementById('unit-label').innerText = "0 CFM | 0 TR"; }
function deleteLast() { currentInput = currentInput.slice(0, -1); document.getElementById('display').innerText = currentInput || "0"; calculateLoad(); }

function calculateLoad() {
    const vol = parseFloat(currentInput);
    if (!vol) return;
    const roomId = document.getElementById('room-select').value;
    const all = [...roomData.medical, ...roomData.commercial, ...roomData.residential];
    const spec = all.find(r => r.id === roomId);
    const cfm = (vol * 35.3147 * spec.ach) / 60;
    const tr = cfm / spec.factor;
    lastResult = { tr: tr.toFixed(2), cfm: Math.round(cfm), room: currentLang==='ar'?spec.ar:spec.en, vol: vol };
    document.getElementById('unit-label').innerText = `${Math.round(cfm)} CFM | ${tr.toFixed(2)} TR`;
    if(document.getElementById('targetCFM')) document.getElementById('targetCFM').value = Math.round(cfm);
}

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
    doc.text(`Report: ${lastResult.tr} TR`, 10, 10); 
    doc.save("AirCalc.pdf"); 
}
