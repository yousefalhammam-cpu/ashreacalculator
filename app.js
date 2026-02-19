let currentLang = 'ar';
let currentInput = "";

const translations = {
    ar: {
        title: "المساحة (م²)", unit: "طن تبريد | CFM", calc: "حساب", room: "نوع الفراغ:",
        duct: "تصميم مجاري الهواء", post: "نشر", lang: "English", 
        rec_ahu: "توصية: نظام AHU مع فلاتر HEPA.", rec_pkg: "توصية: نظام Package Unit.", rec_split: "توصية: نظام Split/Ducted.",
        nav_calc: "الحاسبة", nav_duct: "الدكت", nav_comm: "المجتمع",
        med: "🏥 المستشفيات", comm: "🏢 تجاري", res: "🏠 سكني"
    },
    en: {
        title: "Area (m²)", unit: "TR | CFM", calc: "Calc", room: "Space Type:",
        duct: "Duct Sizer", post: "Post", lang: "العربية",
        rec_ahu: "Rec: AHU System with HEPA filters.", rec_pkg: "Rec: Package Unit System.", rec_split: "Rec: Split/Ducted System.",
        nav_calc: "Calc", nav_duct: "Duct", nav_comm: "Community",
        med: "🏥 Medical", comm: "🏢 Commercial", res: "🏠 Residential"
    }
};

const roomSpecs = {
    or: { ach: 20, load: 0.08, cat: "med" },
    icu: { ach: 6, load: 0.06, cat: "med" },
    isolation: { ach: 12, load: 0.07, cat: "med" },
    office: { ach: 6, load: 0.05, cat: "comm" },
    mall: { ach: 8, load: 0.06, cat: "comm" },
    standard: { ach: 4, load: 0.045, cat: "res" }
};

function toggleLanguage() {
    currentLang = (currentLang === 'ar') ? 'en' : 'ar';
    const html = document.getElementById('html-tag');
    html.dir = (currentLang === 'ar') ? 'rtl' : 'ltr';
    html.lang = currentLang;
    updateUI();
}

function updateUI() {
    const t = translations[currentLang];
    document.getElementById('txt-input-label').innerText = t.title;
    document.getElementById('unit-label').innerText = t.unit;
    document.getElementById('btn-calc').innerText = t.calc;
    document.getElementById('txt-room-label').innerText = t.room;
    document.getElementById('txt-duct-title').innerText = t.duct;
    document.getElementById('txt-forum-title').innerText = t.duct;
    document.getElementById('txt-lang-btn').innerText = t.lang;
    document.getElementById('group-medical').label = t.med;
    document.getElementById('group-comm').label = t.comm;
    document.getElementById('group-res').label = t.res;
    
    document.querySelectorAll('.nav-text').forEach(el => {
        el.innerText = t[el.getAttribute('data-key')];
    });
}

function press(num) {
    currentInput += num;
    document.getElementById('display').innerText = currentInput;
}

function clearDisplay() {
    currentInput = "";
    document.getElementById('display').innerText = "0";
}

function calculateLoad() {
    const area = parseFloat(currentInput);
    if (!area) return;
    const type = document.getElementById('room-select').value;
    const spec = roomSpecs[type];

    const tr = area * spec.load;
    const cfm = (area * 3 * 35.31 * spec.ach) / 60; // الحسابات الرياضية الدقيقة

    document.getElementById('display').innerText = tr.toFixed(2);
    const t = translations[currentLang];
    document.getElementById('unit-label').innerText = `${Math.round(cfm)} CFM | ${currentLang === 'ar' ? 'طن' : 'TR'}`;

    let advice = (spec.cat === "med") ? t.rec_ahu : (tr > 5 ? t.rec_pkg : t.rec_split);
    document.getElementById('system-recommendation').innerText = advice;
    document.getElementById('targetCFM').value = Math.round(cfm);
}

function runDuctCalc() {
    const q = document.getElementById('targetCFM').value;
    const w = document.getElementById('fixWidth').value;
    if(!q || !w) return;
    const h = Math.ceil(((q / 1000) * 144) / w);
    document.getElementById('duct-result').innerText = `${w} x ${h} Inch`;
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');
}
