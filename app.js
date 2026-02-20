let currentLang = 'ar';
let activeField = 'display'; // الحقل الافتراضي هو حجم الغرفة
let inputs = { display: "", people: "", equip: "" };
let calcHistory = [];

const roomData = {
    medical: [
        { id: 'or', ar: 'غرفة عمليات (OR)', en: 'Operating Room', ach: 20, factor: 300 },
        { id: 'icu', ar: 'عناية مركزة (ICU)', en: 'Intensive Care', ach: 6, factor: 400 },
        { id: 'patient', ar: 'غرفة تنويم', en: 'Patient Room', ach: 4, factor: 500 }
    ],
    commercial: [
        { id: 'off', ar: 'مكاتب', en: 'Offices', ach: 8, factor: 450 },
        { id: 'rest', ar: 'مطعم', en: 'Restaurant', ach: 20, factor: 300 }
    ],
    residential: [
        { id: 'liv', ar: 'صالة / مجلس', en: 'Living Room', ach: 6, factor: 450 },
        { id: 'bed', ar: 'غرفة نوم', en: 'Bedroom', ach: 4, factor: 550 }
    ]
};

window.onload = () => updateUI();

// وظيفة تحديد الحقل النشط
function focusField(fieldId) {
    activeField = fieldId;
    // تحديث الشكل البصري
    document.getElementById('display').classList.remove('active-field');
    document.getElementById('people-count').classList.remove('active-field');
    document.getElementById('equip-watts').classList.remove('active-field');
    
    if(fieldId === 'display') {
        document.getElementById('display').classList.add('active-field');
    } else if(fieldId === 'people') {
        document.getElementById('people-count').classList.add('active-field');
    } else {
        document.getElementById('equip-watts').classList.add('active-field');
    }
}

function press(n) { 
    if (inputs[activeField].length > 8) return;
    inputs[activeField] += n; 
    updateDisplayValues();
}

function updateDisplayValues() {
    document.getElementById('display').innerText = inputs.display || "0";
    document.getElementById('people-count').value = inputs.people || "0";
    document.getElementById('equip-watts').value = inputs.equip || "0";
}

function clearActiveField() { 
    inputs[activeField] = ""; 
    updateDisplayValues();
}

function deleteLast() { 
    inputs[activeField] = inputs[activeField].slice(0, -1); 
    updateDisplayValues();
}

function resetForNewRoom() {
    inputs = { display: "", people: "", equip: "" };
    updateDisplayValues();
    document.getElementById('unit-label').innerText = "0 CFM | 0 TR";
    focusField('display');
}

function calculateLoad(save = false) {
    const vol = parseFloat(inputs.display) || 0;
    const people = parseInt(inputs.people) || 0;
    const watts = parseFloat(inputs.equip) || 0;
    
    if (vol <= 0) return;
    
    const roomId = document.getElementById('room-select').value;
    const all = [...roomData.medical, ...roomData.commercial, ...roomData.residential];
    const spec = all.find(r => r.id === roomId);
    
    let cfm_vent = (vol * 35.3147 * spec.ach) / 60;
    const total_btu = (cfm_vent * spec.factor / 1.1) + (people * 500) + (watts * 3.41);
    const tr = (total_btu / 12000).toFixed(2);
    const total_cfm = Math.round(cfm_vent + (people * 15)); 

    document.getElementById('unit-label').innerText = `${total_cfm} CFM | ${tr} TR`;

    if (save) {
        calcHistory.push({ id: Date.now(), room: currentLang==='ar'?spec.ar:spec.en, tr: tr, cfm: total_cfm });
        updateHistoryUI();
    }
}

function updateHistoryUI() {
    const tbody = document.getElementById('history-body');
    tbody.innerHTML = calcHistory.map(item => `
        <tr><td>${item.room}</td><td style="color:var(--ios-orange);">${item.tr}</td><td>${item.cfm}</td><td><button onclick="deleteEntry(${item.id})">✕</button></td></tr>
    `).reverse().join('');
}

function deleteEntry(id) { calcHistory = calcHistory.filter(i => i.id !== id); updateHistoryUI(); }
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
    select.innerHTML = `
        <optgroup label="🏥"><option value="or">غرفة عمليات</option><option value="icu">عناية مركزة</option></optgroup>
        <optgroup label="🏢"><option value="off">مكاتب</option></optgroup>
        <optgroup label="🏠"><option value="liv">صالة</option></optgroup>
    `;
}

// الدوال المتبقية (Duct, PDF, Excel) كما هي في الأكواد السابقة
