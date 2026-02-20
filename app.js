let currentLang = 'ar';
let activeField = 'display'; 
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];

// قاعدة بيانات الغرف الشاملة (تصنيف هندسي دقيق)
const rooms = [
    // --- السكني (Residential) ---
    { id: 'r1', cat: 'r', ar: '🏠 غرفة نوم رئيسية', en: 'Master Bedroom', ach: 1.5, factor: 300 },
    { id: 'r2', cat: 'r', ar: '🏠 غرفة نوم أطفال', en: 'Kids Bedroom', ach: 1.5, factor: 300 },
    { id: 'r3', cat: 'r', ar: '🏠 صالة معيشة', en: 'Living Room', ach: 3, factor: 350 },
    { id: 'r4', cat: 'r', ar: '🏠 مجلس ضيوف', en: 'Majlis', ach: 4, factor: 400 },
    { id: 'r5', cat: 'r', ar: '🏠 مطبخ منزلي', en: 'Kitchen', ach: 6, factor: 450 },
    { id: 'r6', cat: 'r', ar: '🏠 غرفة طعام', en: 'Dining Room', ach: 3, factor: 350 },
    
    // --- الصحي (Healthcare) ---
    { id: 'h1', cat: 'h', ar: '🏥 غرفة عمليات (OR)', en: 'Operating Room', ach: 20, factor: 280 },
    { id: 'h2', cat: 'h', ar: '🏥 عناية مركزة (ICU)', en: 'ICU', ach: 6, factor: 350 },
    { id: 'h3', cat: 'h', ar: '🏥 غرفة تنويم مرضى', en: 'Patient Room', ach: 4, factor: 320 },
    { id: 'h4', cat: 'h', ar: '🏥 مختبر طبي', en: 'Medical Lab', ach: 8, factor: 400 },
    { id: 'h5', cat: 'h', ar: '🏥 عيادة كشف', en: 'Clinic', ach: 4, factor: 350 },
    { id: 'h6', cat: 'h', ar: '🏥 ممر مستشفى', en: 'Hospital Corridor', ach: 2, factor: 300 },

    // --- التجاري (Commercial) ---
    { id: 'c1', cat: 'c', ar: '🏢 مكتب خاص', en: 'Private Office', ach: 4, factor: 400 },
    { id: 'c2', cat: 'c', ar: '🏢 مكاتب مفتوحة', en: 'Open Office', ach: 6, factor: 420 },
    { id: 'c3', cat: 'c', ar: '🏢 قاعة اجتماعات', en: 'Meeting Room', ach: 10, factor: 350 },
    { id: 'c4', cat: 'c', ar: '🏢 مطعم / صالة طعام', en: 'Restaurant', ach: 12, factor: 300 },
    { id: 'c5', cat: 'c', ar: '🏢 محل تجاري / معرض', en: 'Retail Store', ach: 8, factor: 380 },
    { id: 'c6', cat: 'c', ar: '🏢 نادي رياضي (Gym)', en: 'Fitness Gym', ach: 15, factor: 320 },
    { id: 'c7', cat: 'c', ar: '🏢 صالون حلاقة/تجميل', en: 'Beauty Salon', ach: 10, factor: 350 },
    { id: 'c8', cat: 'c', ar: '🏢 فندق (لوبي)', en: 'Hotel Lobby', ach: 4, factor: 400 },

    // --- تعليمي وعام (General/Education) ---
    { id: 'e1', cat: 'e', ar: '🏫 فصل دراسي', en: 'Classroom', ach: 6, factor: 380 },
    { id: 'e2', cat: 'e', ar: '🏫 مكتبة عامة', en: 'Library', ach: 4, factor: 350 },
    { id: 'e3', cat: 'e', ar: '🏫 مسجد / دار عبادة', en: 'Mosque', ach: 10, factor: 380 },
    { id: 'e4', cat: 'e', ar: '🏫 مختبر حاسب آلي', en: 'Computer Lab', ach: 8, factor: 450 }
];

// مصفوفة الأجهزة
const equipmentList = [
    { id: 'pc', ar: '💻 كمبيوتر', en: 'PC', watts: 200, count: 0 },
    { id: 'srv', ar: '🖥️ سيرفر', en: 'Server', watts: 1000, count: 0 },
    { id: 'med', ar: '🩺 جهاز طبي', en: 'Medical', watts: 500, count: 0 },
    { id: 'tv', ar: '📺 شاشة', en: 'TV', watts: 150, count: 0 },
    { id: 'kit', ar: '🔌 معدات مطبخ', en: 'Kitchen App', watts: 1500, count: 0 }
];

window.onload = () => {
    updateRoomSelect();
    renderEquipChecklist();
    focusField('display');
};

function calculateLoad(save = false) {
    const vol = parseFloat(inputs.display) || 0;
    const people = parseInt(inputs.people) || 0;
    const watts = parseFloat(inputs.equip) || 0;
    const room = rooms.find(r => r.id === document.getElementById('room-select').value);

    // معادلة CFM الواقعية
    let cfm = Math.round(((vol * 35.31 * room.ach) / 60) + (people * 15));
    
    // معادلة الطن التبريدي TR المحسنة (تقسيم على 13000 لنتائج مطابقة للواقع الميداني)
    let tr = (((cfm * room.factor / 1.1) + (people * 450) + (watts * 3.41)) / 13000).toFixed(2);

    document.getElementById('tr-result').innerText = `${tr} TR`;
    document.getElementById('cfm-result').innerText = `${cfm} CFM`;
    document.getElementById('targetCFM').value = cfm;
    
    if (save) {
        calcHistory.push({ id: Date.now(), room: currentLang === 'ar' ? room.ar : room.en, tr: tr, cfm: cfm });
        updateHistoryUI();
    }
}

function updateHistoryUI() {
    const container = document.getElementById('history-list');
    container.innerHTML = calcHistory.map((item, index) => `
        <div class="swipe-item" onclick="deleteItem(${item.id})">
            <div class="info">
                <span style="color:#666; font-size:0.7rem">#${calcHistory.length - index}</span>
                <span>${item.room}</span>
            </div>
            <div class="vals" style="text-align:left">
                <span class="tr-val">${item.tr} TR</span><br>
                <span class="cfm-val">${item.cfm} CFM</span>
            </div>
        </div>
    `).reverse().join('');
}

function deleteItem(id) {
    if(confirm(currentLang === 'ar' ? "حذف هذه النتيجة؟" : "Delete?")) {
        calcHistory = calcHistory.filter(i => i.id !== id);
        updateHistoryUI();
    }
}

function updateRoomSelect() {
    // ترتيب الغرف أبجدياً حسب اللغة المختارة
    const sorted = [...rooms].sort((a,b) => currentLang === 'ar' ? a.ar.localeCompare(b.ar) : a.en.localeCompare(b.en));
    document.getElementById('room-select').innerHTML = sorted.map(r => `<option value="${r.id}">${currentLang === 'ar' ? r.ar : r.en}</option>`).join('');
}

// --- باقي وظائف الحاسبة المعتادة ---
function press(n) { 
    if (inputs[activeField] === "0") inputs[activeField] = n.toString();
    else inputs[activeField] += n.toString();
    updateDisplayValues(); 
}
function updateDisplayValues() {
    document.getElementById('display').innerText = inputs.display || "0";
    document.getElementById('people-count').value = inputs.people || "0";
    document.getElementById('equip-watts').value = inputs.equip || "0";
}
function focusField(f) {
    activeField = f;
    document.querySelectorAll('.active-field, .input-box input').forEach(el => el.classList.remove('active-field'));
    if(f === 'display') document.getElementById('display').classList.add('active-field');
    else document.getElementById(f + '-count' || f + '-watts').classList.add('active-field');
}
function openEquipModal() { document.getElementById('equip-modal').style.display = 'block'; }
function closeEquipModal() { document.getElementById('equip-modal').style.display = 'none'; }
function renderEquipChecklist() {
    document.getElementById('equip-checklist').innerHTML = equipmentList.map((item, idx) => `
        <div class="equip-item-row">
            <div>${currentLang === 'ar' ? item.ar : item.en}</div>
            <div class="counter-ctrl">
                <button class="counter-btn" onclick="changeCount(${idx}, -1)">-</button>
                <span id="cnt-${idx}" style="margin:0 10px">${item.count}</span>
                <button class="counter-btn" onclick="changeCount(${idx}, 1)">+</button>
            </div>
        </div>
    `).join('');
}
function changeCount(idx, delta) {
    equipmentList[idx].count = Math.max(0, equipmentList[idx].count + delta);
    document.getElementById(`cnt-${idx}`).innerText = equipmentList[idx].count;
    inputs.equip = equipmentList.reduce((s, i) => s + (i.watts * i.count), 0).toString();
    updateDisplayValues();
    calculateLoad(false);
}
function switchTab(id, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');
}
function runDuctCalc() {
    const cfm = parseFloat(document.getElementById('targetCFM').value);
    const w = parseFloat(document.getElementById('fixWidth').value);
    if (cfm && w) {
        let h = Math.round((cfm / 800 * 144) / w);
        document.getElementById('duct-result').innerText = `${w}" x ${h}"`;
    }
}
function deleteLast() { inputs[activeField] = inputs[activeField].slice(0, -1) || "0"; updateDisplayValues(); }
function clearActiveField() { inputs[activeField] = "0"; updateDisplayValues(); }
function clearHistory() { if(confirm("Clear?")) { calcHistory = []; updateHistoryUI(); } }
function toggleLanguage() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    document.getElementById('html-tag').dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-ar]').forEach(el => el.innerText = el.getAttribute(`data-${currentLang}`));
    updateRoomSelect(); renderEquipChecklist(); updateHistoryUI();
}
function resetAllFields() {
    inputs = { display: "0", people: "0", equip: "0" };
    equipmentList.forEach(i => i.count = 0);
    renderEquipChecklist();
    updateDisplayValues();
}
