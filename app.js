let currentLang = 'ar';
let currentInput = "";

const roomData = {
    medical: [
        { id: 'or', ar: 'غرفة عمليات - OR', en: 'Operating Room', ach: 20, factor: 350 },
        { id: 'icu', ar: 'عناية مركزة - ICU', en: 'Intensive Care', ach: 6, factor: 400 },
        { id: 'iso', ar: 'غرفة عزل - Isolation', en: 'Isolation Room', ach: 12, factor: 380 }
    ],
    commercial: [
        { id: 'off', ar: 'مكاتب - Offices', en: 'Offices', ach: 6, factor: 450 },
        { id: 'rest', ar: 'مطعم - Restaurant', en: 'Restaurant', ach: 15, factor: 300 }
    ],
    residential: [
        { id: 'bed', ar: 'غرفة نوم - Bedroom', en: 'Bedroom', ach: 4, factor: 500 }
    ]
};

const translations = {
    ar: { title: "الحجم (م³)", duct: "تحديد مقاس الدكت", lang: "English", med: "🏥 مستشفيات", comm: "🏢 تجاري", res: "🏠 سكني", go: "احسب" },
    en: { title: "Volume (m³)", duct: "Duct Sizing", lang: "العربية", med: "🏥 Medical", comm: "🏢 Commercial", res: "🏠 Residential", go: "Calc" }
};

window.onload = () => updateUI();

function toggleLanguage() {
    currentLang = (currentLang === 'ar') ? 'en' : 'ar';
    document.getElementById('html-tag').dir = (currentLang === 'ar') ? 'rtl' : 'ltr';
    updateUI();
}

function updateUI() {
    const t = translations[currentLang];
    document.getElementById('txt-input-label').innerText = t.title;
    document.getElementById('txt-duct-title').innerText = t.duct;
    document.getElementById('txt-lang-btn').innerText = t.lang;
    document.getElementById('btn-duct-go').innerText = t.go;

    const select = document.getElementById('room-select');
    select.innerHTML = `
        <optgroup label="${t.med}">${fill(roomData.medical)}</optgroup>
        <optgroup label="${t.comm}">${fill(roomData.commercial)}</optgroup>
        <optgroup label="${t.res}">${fill(roomData.residential)}</optgroup>
    `;
}

function fill(data) {
    return data.map(item => `<option value="${item.id}">${currentLang === 'ar' ? item.ar : item.en}</option>`).join('');
}

function press(num) {
    currentInput += num;
    document.getElementById('display').innerText = currentInput;
}

function clearDisplay() { currentInput = ""; document.getElementById('display').innerText = "0"; }

function calculateLoad() {
    const vol = parseFloat(currentInput);
    if (!vol) return;
    const roomId = document.getElementById('room-select').value;
    let spec;
    [...roomData.medical, ...roomData.commercial, ...roomData.residential].forEach(r => { if(r.id === roomId) spec = r; });

    const cfm = (vol * 35.3147 * spec.ach) / 60;
    const tr = cfm / spec.factor;

    document.getElementById('display').innerText = tr.toFixed(2);
    document.getElementById('targetCFM').value = Math.round(cfm);
}

function runDuctCalc() {
    const q = document.getElementById('targetCFM').value;
    const w = document.getElementById('fixWidth').value;
    if(!q || !w) return;
    const h = Math.ceil(((q / 1000) * 144) / w);
    document.getElementById('duct-result').innerText = `${w} x ${h} Inch`;
}
