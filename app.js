let currentLang = 'ar';
let activeField = 'display'; 
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];

// قاعدة بيانات الغرف (تم تعديل العوامل لتكون واقعية ومنطقية)
const rooms = [
    { id: 'bed', cat: 'r', ar: '🏠 غرفة نوم', en: '🏠 Bedroom', ach: 1.5, factor: 300 },
    { id: 'liv', cat: 'r', ar: '🏠 صالة معيشة', en: '🏠 Living Room', ach: 3, factor: 350 },
    { id: 'kit', cat: 'r', ar: '🏠 مطبخ', en: '🏠 Kitchen', ach: 6, factor: 400 },
    { id: 'off', cat: 'c', ar: '🏢 مكتب', en: '🏢 Office', ach: 4, factor: 400 },
    { id: 'rest', cat: 'c', ar: '🏢 مطعم', en: '🏢 Restaurant', ach: 10, factor: 320 },
    { id: 'gym', cat: 'c', ar: '🏢 نادي رياضي', en: '🏢 Gym', ach: 12, factor: 300 },
    { id: 'or', cat: 'h', ar: '🏥 غرفة عمليات', en: '🏥 Operating Room', ach: 20, factor: 280 },
    { id: 'lab', cat: 'h', ar: '🏥 مختبر', en: '🏥 Laboratory', ach: 8, factor: 350 }
];

// قائمة الأجهزة الكاملة
const equipmentList = [
    { id: 'pc', ar: '💻 كمبيوتر', en: 'PC', watts: 200, count: 0 },
    { id: 'srv', ar: '🖥️ سيرفر', en: 'Server', watts: 800, count: 0 },
    { id: 'tv', ar: '📺 شاشة', en: 'TV', watts: 150, count: 0 },
    { id: 'med', ar: '🩺 جهاز طبي', en: 'Medical', watts: 400, count: 0 },
    { id: 'mic', ar: '🍱 مايكرويف', en: 'Microwave', watts: 1200, count: 0 },
    { id: 'cof', ar: '☕ ماكينة قهوة', en: 'Coffee', watts: 1000, count: 0 }
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

    // معادلة CFM (تحويل المتر المكعب لقدم مكعب ثم الضرب في عدد التبديلات)
    let cfm = Math.round(((vol * 35.31 * room.ach) / 60) + (people * 15));
    
    // معادلة TR (تعديل المعامل ليكون 13500 بدلاً من 12000 لتقريب الفاقد الحراري بشكل واقعي)
    let tr = (((cfm * room.factor / 1.1) + (people * 450) + (watts * 3.41)) / 13500).toFixed(2);

    // تحديث الشاشة
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
    if(confirm(currentLang === 'ar' ? "حذف هذه النتيجة؟" : "Delete this result?")) {
        calcHistory = calcHistory.filter(i => i.id !== id);
        updateHistoryUI();
    }
}

function clearHistory() {
    if(confirm(currentLang === 'ar' ? "مسح السجل بالكامل؟" : "Clear all?")) {
        calcHistory = [];
        updateHistoryUI();
    }
}

// وظائف التحكم بالأزرار
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
    document.getElementById('display').classList.toggle('active-field', f === 'display');
    document.getElementById('people-count').classList.toggle('active-field', f === 'people');
    document.getElementById('equip-watts').classList.toggle('active-field', f === 'equip');
}

function updateRoomSelect() {
    document.getElementById('room-select').innerHTML = rooms.map(r => `<option value="${r.id}">${currentLang === 'ar' ? r.ar : r.en}</option>`).join('');
}

function openEquipModal() { document.getElementById('equip-modal').style.display = 'block'; }
function closeEquipModal() { document.getElementById('equip-modal').style.display = 'none'; }

function renderEquipChecklist() {
    document.getElementById('equip-checklist').innerHTML = equipmentList.map((item, idx) => `
        <div class="equip-item-row">
            <div>${currentLang === 'ar' ? item.ar : item.en} <small style="color:#8e8e93">(${item.watts}W)</small></div>
            <div class="counter-ctrl">
                <button class="counter-btn" onclick="changeCount(${idx}, -1)">-</button>
                <span id="cnt-${idx}" style="margin:0 10px; min-width:20px; text-align:center">${item.count}</span>
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
function resetAllFields() {
    inputs = { display: "0", people: "0", equip: "0" };
    equipmentList.forEach(i => i.count = 0);
    renderEquipChecklist();
    updateDisplayValues();
    document.getElementById('tr-result').innerText = "0 TR";
    document.getElementById('cfm-result').innerText = "0 CFM";
}

function toggleLanguage() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    document.getElementById('html-tag').dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-ar]').forEach(el => el.innerText = el.getAttribute(`data-${currentLang}`));
    updateRoomSelect(); renderEquipChecklist(); updateHistoryUI();
}
