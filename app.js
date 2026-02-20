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
        { id: 'xray', ar: 'أشعة - X-Ray', en: 'Radiology', ach: 6, factor: 400 },
        { id: 'dent', ar: 'عيادة أسنان', en: 'Dental Clinic', ach: 8, factor: 380 },
        { id: 'mri', ar: 'رنين مغناطيسي', en: 'MRI Room', ach: 10, factor: 350 },
        { id: 'dial', ar: 'غسيل كلى', en: 'Dialysis', ach: 10, factor: 400 }
    ],
    commercial: [
        { id: 'off', ar: 'مكاتب - Offices', en: 'Offices', ach: 6, factor: 450 },
        { id: 'mall', ar: 'مول تجاري', en: 'Mall', ach: 8, factor: 400 },
        { id: 'rest', ar: 'مطعم - Dining', en: 'Restaurant', ach: 15, factor: 300 },
        { id: 'gym', ar: 'نادي رياضي', en: 'Gym', ach: 10, factor: 350 },
        { id: 'hotel', ar: 'غرفة فندق', en: 'Hotel Room', ach: 5, factor: 450 },
        { id: 'cinema', ar: 'سينما / مسرح', en: 'Cinema', ach: 10, factor: 320 },
        { id: 'pray', ar: 'مسجد / مصلى', en: 'Prayer Room', ach: 8, factor: 400 },
        { id: 'salon', ar: 'صالون حلاقة', en: 'Salon', ach: 10, factor: 350 },
        { id: 'kitchen_c', ar: 'مطبخ تجاري', en: 'Com. Kitchen', ach: 30, factor: 250 }
    ],
    residential: [
        { id: 'bed', ar: 'غرفة نوم', en: 'Bedroom', ach: 4, factor: 500 },
        { id: 'liv', ar: 'صالة معيشة', en: 'Living Room', ach: 4, factor: 450 },
        { id: 'kit', ar: 'مطبخ منزلي', en: 'Kitchen', ach: 8, factor: 350 },
        { id: 'maj', ar: 'مجلس ريجيل/نساء', en: 'Majlis', ach: 6, factor: 450 },
        { id: 'bath', ar: 'دورة مياه', en: 'Bathroom', ach: 10, factor: 300 }
    ],
    industrial: [
        { id: 'server', ar: 'غرفة سيرفرات', en: 'Data Center', ach: 15, factor: 250 },
        { id: 'ware', ar: 'مستودع مخازن', en: 'Warehouse', ach: 4, factor: 550 },
        { id: 'fact', ar: 'مصنع خفيف', en: 'Light Factory', ach: 8, factor: 400 }
    ]
};

const translations = {
    ar: { nav_calc: "الحاسبة", nav_duct: "الدكت", nav_comm: "المجتمع", nav_export: "تصدير", lang: "English", input: "الحجم (م³)", cat_med: "🏥 طبي", cat_comm: "🏢 تجاري", cat_res: "🏠 سكني", cat_ind: "⚙️ صناعي" },
    en: { nav_calc: "Calc", nav_duct: "Duct", nav_comm: "Forum", nav_export: "Export", lang: "العربية", input: "Volume (m³)", cat_med: "🏥 Medical", cat_comm: "🏢 Commercial", cat_res: "🏠 Residential", cat_ind: "⚙️ Industrial" }
};

window.onload = () => updateUI();

function press(n) { currentInput += n; document.getElementById('display').innerText = currentInput; calculateLoad(); }
function clearDisplay() { currentInput = ""; document.getElementById('display').innerText = "0"; document.getElementById('unit-label').innerText = "0 CFM | 0 TR"; }
function deleteLast() { currentInput = currentInput.slice(0, -1); document.getElementById('display').innerText = currentInput || "0"; calculateLoad(); }

function calculateLoad() {
    const vol = parseFloat(currentInput);
    if (!vol) return;
    const roomId = document.getElementById('room-select').value;
    const all = [...roomData.medical, ...roomData.commercial, ...roomData.residential, ...roomData.industrial];
    const spec = all.find(r => r.id === roomId);

    const cfm = (vol * 35.3147 * spec.ach) / 60;
    const tr = cfm / spec.factor;

    lastResult = { tr: tr.toFixed(2), cfm: Math.round(cfm), room: currentLang==='ar'?spec.ar:spec.en, vol: vol };
    document.getElementById('display').innerText = currentInput;
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
    document.getElementById('txt-input-label').innerText = t.input;
    document.getElementById('txt-lang-btn').innerText = t.lang;
    document.querySelectorAll('.nav-text').forEach(el => el.innerText = t[el.getAttribute('data-key')]);
    
    const select = document.getElementById('room-select');
    select.innerHTML = `
        <optgroup label="${t.cat_med}">${roomData.medical.map(r=>`<option value="${r.id}">${currentLang==='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${t.cat_comm}">${roomData.commercial.map(r=>`<option value="${r.id}">${currentLang==='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${t.cat_res}">${roomData.residential.map(r=>`<option value="${r.id}">${currentLang==='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${t.cat_ind}">${roomData.industrial.map(r=>`<option value="${r.id}">${currentLang==='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
    `;
    calculateLoad();
}

function runDuctCalc() {
    const q = document.getElementById('targetCFM').value;
    const w = document.getElementById('fixWidth').value;
    if(!q || !w) return;
    const h = Math.ceil(((q / 1000) * 144) / w);
    document.getElementById('duct-result').innerText = `${w}" x ${h}" Inch`;
}
