let currentLang = 'ar';
let currentInput = "";
let lastResult = { tr: 0, cfm: 0, room: "", vol: 0 };

// القائمة الكاملة للغرف والمعايير الهندسية
const roomData = {
    medical: [
        { id: 'or', ar: 'غرفة عمليات - OR', en: 'Operating Room', ach: 20, factor: 350 },
        { id: 'icu', ar: 'عناية مركزة - ICU', en: 'Intensive Care', ach: 6, factor: 400 },
        { id: 'iso', ar: 'غرفة عزل - Isolation', en: 'Isolation Room', ach: 12, factor: 380 },
        { id: 'er', ar: 'طوارئ - Emergency', en: 'Emergency Room', ach: 10, factor: 400 },
        { id: 'lab', ar: 'مختبرات - Laboratories', en: 'Labs', ach: 12, factor: 350 },
        { id: 'pharm', ar: 'صيدلية - Pharmacy', en: 'Pharmacy', ach: 4, factor: 450 },
        { id: 'xray', ar: 'أشعة - Radiology', en: 'Radiology/X-Ray', ach: 6, factor: 400 },
        { id: 'dent', ar: 'عيادة أسنان - Dental', en: 'Dental Clinic', ach: 8, factor: 380 },
        { id: 'wait', ar: 'انتظار - Waiting Area', en: 'Waiting Room', ach: 6, factor: 450 }
    ],
    commercial: [
        { id: 'off', ar: 'مكاتب - Offices', en: 'Offices', ach: 6, factor: 450 },
        { id: 'mall', ar: 'مول تجاري - Mall', en: 'Shopping Mall', ach: 8, factor: 400 },
        { id: 'rest', ar: 'مطعم - Restaurant', en: 'Restaurant', ach: 15, factor: 300 },
        { id: 'gym', ar: 'نادي رياضي - Gym', en: 'Gymnasium', ach: 10, factor: 350 },
        { id: 'hotel', ar: 'فندق - Hotel Room', en: 'Hotel Room', ach: 5, factor: 450 },
        { id: 'cinema', ar: 'سينما - Cinema', en: 'Cinema/Theater', ach: 10, factor: 320 },
        { id: 'pray', ar: 'مصلى - Prayer Room', en: 'Prayer Room', ach: 8, factor: 400 }
    ],
    residential: [
        { id: 'bed', ar: 'غرفة نوم - Bedroom', en: 'Bedroom', ach: 4, factor: 500 },
        { id: 'liv', ar: 'صالة معيشة - Living', en: 'Living Room', ach: 4, factor: 450 },
        { id: 'kit', ar: 'مطبخ - Kitchen', en: 'Kitchen', ach: 8, factor: 350 },
        { id: 'maj', ar: 'مجلس - Majlis', en: 'Majlis', ach: 5, factor: 450 }
    ]
};

const translations = {
    ar: { nav_calc: "الحاسبة", nav_duct: "الدكت", nav_comm: "المجتمع", nav_export: "تصدير", med: "🏥 طبي", comm: "🏢 تجاري", res: "🏠 سكني", lang: "English" },
    en: { nav_calc: "Calc", nav_duct: "Duct", nav_comm: "Forum", nav_export: "Export", med: "🏥 Medical", comm: "🏢 Commercial", res: "🏠 Residential", lang: "العربية" }
};

window.onload = () => updateUI();

function toggleLanguage() {
    currentLang = (currentLang === 'ar') ? 'en' : 'ar';
    document.getElementById('html-tag').dir = (currentLang === 'ar') ? 'rtl' : 'ltr';
    updateUI();
}

function updateUI() {
    const t = translations[currentLang];
    document.querySelectorAll('.nav-text').forEach(el => el.innerText = t[el.getAttribute('data-key')]);
    document.getElementById('txt-lang-btn').innerText = t.lang;

    // تعبئة الغرف كاملة
    const select = document.getElementById('room-select');
    select.innerHTML = `
        <optgroup label="${t.med}">${roomData.medical.map(r => `<option value="${r.id}">${currentLang==='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${t.comm}">${roomData.commercial.map(r => `<option value="${r.id}">${currentLang==='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${t.res}">${roomData.residential.map(r => `<option value="${r.id}">${currentLang==='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
    `;
}

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

// التوابع المساعدة للتصدير والحساب والتبديل (كما في الكود السابق)
