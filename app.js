// المتغيرات العالمية
let currentLang = 'ar';
let currentInput = "";
let lastResult = { tr: 0, cfm: 0, room: "", vol: 0 };

// القائمة الشاملة للغرف (أكثر من 20 غرفة)
const roomData = {
    medical: [
        { id: 'or', ar: 'غرفة عمليات - OR', en: 'Operating Room', ach: 20, factor: 350 },
        { id: 'icu', ar: 'عناية مركزة - ICU', en: 'Intensive Care', ach: 6, factor: 400 },
        { id: 'iso', ar: 'غرفة عزل - Isolation', en: 'Isolation Room', ach: 12, factor: 380 },
        { id: 'er', ar: 'طوارئ - Emergency', en: 'Emergency Room', ach: 10, factor: 400 },
        { id: 'lab', ar: 'مختبرات - Laboratories', en: 'Labs', ach: 12, factor: 350 },
        { id: 'pharm', ar: 'صيدلية - Pharmacy', en: 'Pharmacy', ach: 4, factor: 450 },
        { id: 'dent', ar: 'عيادة أسنان - Dental', en: 'Dental Clinic', ach: 8, factor: 380 },
        { id: 'wait', ar: 'انتظار - Waiting Area', en: 'Waiting Room', ach: 6, factor: 450 }
    ],
    commercial: [
        { id: 'off', ar: 'مكاتب - Offices', en: 'Offices', ach: 6, factor: 450 },
        { id: 'mall', ar: 'مول تجاري - Mall', en: 'Shopping Mall', ach: 8, factor: 400 },
        { id: 'rest', ar: 'مطعم - Restaurant', en: 'Restaurant', ach: 15, factor: 300 },
        { id: 'gym', ar: 'نادي رياضي - Gym', en: 'Gymnasium', ach: 10, factor: 350 },
        { id: 'hotel', ar: 'فندق - Hotel Room', en: 'Hotel Room', ach: 5, factor: 450 },
        { id: 'pray', ar: 'مصلى - Prayer Room', en: 'Prayer Room', ach: 8, factor: 400 }
    ],
    residential: [
        { id: 'bed', ar: 'غرفة نوم - Bedroom', en: 'Bedroom', ach: 4, factor: 500 },
        { id: 'kit', ar: 'مطبخ - Kitchen', en: 'Kitchen', ach: 8, factor: 350 },
        { id: 'maj', ar: 'مجلس - Majlis', en: 'Majlis', ach: 5, factor: 450 }
    ]
};

const translations = {
    ar: { nav_calc: "الحاسبة", nav_duct: "الدكت", nav_comm: "المجتمع", nav_export: "تصدير", med: "🏥 طبي", comm: "🏢 تجاري", res: "🏠 سكني", lang: "English", input_title: "الحجم (م³)" },
    en: { nav_calc: "Calc", nav_duct: "Duct", nav_comm: "Forum", nav_export: "Export", med: "🏥 Medical", comm: "🏢 Commercial", res: "🏠 Residential", lang: "العربية", input_title: "Volume (m³)" }
};

// تشغيل عند التحميل
window.onload = () => {
    updateUI();
};

// وظائف الحاسبة
function press(num) {
    currentInput += num;
    document.getElementById('display').innerText = currentInput;
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

// حساب الأحمال وربطها بالدكت
function calculateLoad() {
    const vol = parseFloat(currentInput);
    if (!vol) return;
    const roomId = document.getElementById('room-select').value;
    const allRooms = [...roomData.medical, ...roomData.commercial, ...roomData.residential];
    const spec = allRooms.find(r => r.id === roomId);

    // معادلة الحجم (متر مكعب) إلى CFM
    const cfm = (vol * 35.3147 * spec.ach) / 60;
    const tr = cfm / spec.factor;

    lastResult = { tr: tr.toFixed(2), cfm: Math.round(cfm), room: currentLang==='ar'?spec.ar:spec.en, vol: vol };

    document.getElementById('display').innerText = tr.toFixed(2);
    document.getElementById('unit-label').innerText = `${Math.round(cfm)} CFM | ${tr.toFixed(2)} TR`;
    
    // ربط النتيجة بتبويب الدكت
    if(document.getElementById('targetCFM')) {
        document.getElementById('targetCFM').value = Math.round(cfm);
    }
}

// التنقل بين التبويبات (الأيقونات السفلية)
function switchTab(tabId) {
    // إخفاء الكل
    document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.style.display = 'none';
        panel.classList.remove('active');
    });
    // إزالة التنشيط عن الأزرار
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

    // إظهار المطلوب
    const activeTab = document.getElementById(tabId);
    activeTab.style.display = 'flex';
    activeTab.classList.add('active');
    
    // تنشيط زر النابار
    event.currentTarget.classList.add('active');
}

// تغيير اللغة
function toggleLanguage() {
    currentLang = (currentLang === 'ar') ? 'en' : 'ar';
    document.getElementById('html-tag').dir = (currentLang === 'ar') ? 'rtl' : 'ltr';
    updateUI();
}

function updateUI() {
    const t = translations[currentLang];
    document.getElementById('txt-input-label').innerText = t.input_title;
    document.getElementById('txt-lang-btn').innerText = t.lang;
    
    document.querySelectorAll('.nav-text').forEach(el => {
        const key = el.getAttribute('data-key');
        if(t[key]) el.innerText = t[key];
    });

    const select = document.getElementById('room-select');
    select.innerHTML = `
        <optgroup label="${t.med}">${roomData.medical.map(r => `<option value="${r.id}">${currentLang==='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${t.comm}">${roomData.commercial.map(r => `<option value="${r.id}">${currentLang==='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
        <optgroup label="${t.res}">${roomData.residential.map(r => `<option value="${r.id}">${currentLang==='ar'?r.ar:r.en}</option>`).join('')}</optgroup>
    `;
}

// دالة حساب الدكت
function runDuctCalc() {
    const q = document.getElementById('targetCFM').value;
    const w = document.getElementById('fixWidth').value;
    if(!q || !w) return;
    const h = Math.ceil(((q / 1000) * 144) / w);
    document.getElementById('duct-result').innerText = `${w}" x ${h}" Inch`;
}
