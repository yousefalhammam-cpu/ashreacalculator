let currentLang = 'ar';
let currentInput = "";

// قاعدة البيانات الهندية للغرف
const roomData = {
    medical: [
        { id: 'or', ar: 'غرفة عمليات - OR', en: 'Operating Room', ach: 20, factor: 350 },
        { id: 'icu', ar: 'عناية مركزة - ICU', en: 'Intensive Care', ach: 6, factor: 400 },
        { id: 'iso', ar: 'غرفة عزل - Isolation', en: 'Isolation Room', ach: 12, factor: 380 },
        { id: 'lab', ar: 'مختبرات - Medical Lab', en: 'Medical Lab', ach: 12, factor: 350 }
    ],
    commercial: [
        { id: 'off', ar: 'مكاتب - Offices', en: 'Offices', ach: 6, factor: 450 },
        { id: 'mall', ar: 'مول تجاري - Mall', en: 'Shopping Mall', ach: 8, factor: 400 },
        { id: 'rest', ar: 'مطعم - Restaurant', en: 'Restaurant', ach: 15, factor: 300 }
    ],
    residential: [
        { id: 'bed', ar: 'غرفة نوم - Bedroom', en: 'Bedroom', ach: 4, factor: 500 },
        { id: 'kit', ar: 'مطبخ - Kitchen', en: 'Kitchen', ach: 8, factor: 400 }
    ]
};

const translations = {
    ar: {
        title: "الحجم (م³)", unit: "طن تبريد | CFM", calc: "حساب", duct: "تصميم الدكت",
        forum: "ساحة النقاش", post: "نشر", lang: "English", nav_calc: "الحاسبة", 
        nav_duct: "الدكت", nav_comm: "المجتمع", med_label: "🏥 المستشفيات", comm_label: "🏢 تجاري", res_label: "🏠 سكني"
    },
    en: {
        title: "Volume (m³)", unit: "TR | CFM", calc: "Calc", duct: "Duct Sizer",
        forum: "Forum", post: "Post", lang: "العربية", nav_calc: "Calculator", 
        nav_duct: "Duct", nav_comm: "Community", med_label: "🏥 Medical", comm_label: "🏢 Commercial", res_label: "🏠 Residential"
    }
};

// تهيئة التطبيق عند التحميل
window.onload = () => {
    updateUI();
};

function toggleLanguage() {
    currentLang = (currentLang === 'ar') ? 'en' : 'ar';
    const html = document.getElementById('html-tag');
    html.dir = (currentLang === 'ar') ? 'rtl' : 'ltr';
    updateUI();
}

function updateUI() {
    const t = translations[currentLang];
    document.getElementById('txt-input-label').innerText = t.title;
    document.getElementById('unit-label').innerText = t.unit;
    document.getElementById('txt-duct-title').innerText = t.duct;
    document.getElementById('txt-forum-title').innerText = t.forum;
    document.getElementById('btn-post').innerText = t.post;
    document.getElementById('txt-lang-btn').innerText = t.lang;

    // تحديث نصوص القائمة السفلية
    document.querySelectorAll('.nav-text').forEach(el => {
        el.innerText = t[el.getAttribute('data-key')];
    });

    // تحديث قائمة الغرف بالكامل
    const select = document.getElementById('room-select');
    select.innerHTML = `
        <optgroup label="${t.med_label}">${fillOptions(roomData.medical)}</optgroup>
        <optgroup label="${t.comm_label}">${fillOptions(roomData.commercial)}</optgroup>
        <optgroup label="${t.res_label}">${fillOptions(roomData.residential)}</optgroup>
    `;
}

function fillOptions(data) {
    return data.map(item => `<option value="${item.id}">${currentLang === 'ar' ? item.ar : item.en}</option>`).join('');
}

function press(num) {
    if (currentInput.length < 12) {
        currentInput += num;
        document.getElementById('display').innerText = currentInput;
    }
}

function clearDisplay() {
    currentInput = "";
    document.getElementById('display').innerText = "0";
}

function deleteLast() {
    currentInput = currentInput.slice(0, -1);
    document.getElementById('display').innerText = currentInput || "0";
}



function calculateLoad() {
    const volume = parseFloat(currentInput);
    if (!volume) return;
    
    const roomId = document.getElementById('room-select').value;
    let spec;
    // البحث عن خصائص الغرفة المختارة
    [...roomData.medical, ...roomData.commercial, ...roomData.residential].forEach(r => {
        if(r.id === roomId) spec = r;
    });

    // الحسابات الرياضية الدقيقة
    const cfm = (volume * 35.3147 * spec.ach) / 60;
    const tr = cfm / spec.factor;

    document.getElementById('display').innerText = tr.toFixed(2);
    document.getElementById('unit-label').innerText = `${Math.round(cfm)} CFM | ${currentLang === 'ar' ? 'طن تبريد' : 'TR'}`;
    document.getElementById('targetCFM').value = Math.round(cfm);
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}
