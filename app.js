let currentLang = 'ar';
let activeField = 'display'; 
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];
let lastCFM = 0;

const rooms = [
    { id: 'or', cat: 'h', ar: '🏥 غرفة عمليات', en: '🏥 Operating Room', ach: 20, factor: 300 },
    { id: 'icu', cat: 'h', ar: '🏥 العناية المركزة', en: '🏥 ICU', ach: 6, factor: 400 },
    { id: 'off', cat: 'c', ar: '🏢 مكاتب', en: '🏢 Offices', ach: 6, factor: 450 },
    { id: 'bed', cat: 'r', ar: '🏠 غرفة نوم', en: '🏠 Bedroom', ach: 2, factor: 550 }
];

// قائمة الأجهزة الشاملة لجميع الأقسام
const equipmentList = [
    { id: 'pc', ar: '💻 كمبيوتر مكتب', en: 'Desktop PC', watts: 250, count: 0 },
    { id: 'lap', ar: '💻 لاب توب', en: 'Laptop', watts: 65, count: 0 },
    { id: 'srv', ar: '🖥️ سيرفر', en: 'Server Unit', watts: 1000, count: 0 },
    { id: 'med', ar: '🩺 جهاز طبي', en: 'Medical Device', watts: 300, count: 0 },
    { id: 'tv', ar: '📺 شاشة عرض', en: 'TV/Display', watts: 150, count: 0 },
    { id: 'kit', ar: '☕ غلاية/ماكينة قهوة', en: 'Coffee Machine', watts: 800, count: 0 },
    { id: 'mic', ar: '🍱 مايكرويف', en: 'Microwave', watts: 1200, count: 0 }
];

window.onload = () => {
    updateRoomSelect();
    renderEquipChecklist();
    focusField('display');
};

function resetAllFields() {
    inputs = { display: "0", people: "0", equip: "0" };
    equipmentList.forEach(i => i.count = 0);
    renderEquipChecklist();
    updateDisplayValues();
    document.getElementById('unit-label').innerText = "0 CFM | 0 TR";
}

function renderEquipChecklist() {
    const container = document.getElementById('equip-checklist');
    container.innerHTML = equipmentList.map((item, idx) => `
        <div class="equip-item-row">
            <div>
                <span style="display:block; font-size:0.9rem">${currentLang === 'ar' ? item.ar : item.en}</span>
                <small style="color:orange">${item.watts}W</small>
            </div>
            <div class="counter-ctrl">
                <button class="counter-btn" onclick="changeCount(${idx}, -1)">-</button>
                <span id="cnt-${idx}">${item.count}</span>
                <button class="counter-btn" onclick="changeCount(${idx}, 1)">+</button>
            </div>
        </div>
    `).join('');
}

function changeCount(idx, delta) {
    equipmentList[idx].count = Math.max(0, equipmentList[idx].count + delta);
    document.getElementById(`cnt-${idx}`).innerText = equipmentList[idx].count;
    let totalWatts = equipmentList.reduce((sum, item) => sum + (item.watts * item.count), 0);
    inputs.equip = totalWatts.toString();
    document.getElementById('equip-watts').value = inputs.equip;
    calculateLoad(false);
}

function calculateLoad(save = false) {
    const vol = parseFloat(inputs.display) || 0;
    const people = parseInt(inputs.people) || 0;
    const watts = parseFloat(inputs.equip) || 0;
    const room = rooms.find(r => r.id === document.getElementById('room-select').value);

    let cfm = Math.round(((vol * 35.31 * room.ach) / 60) + (people * 15));
    let tr = (((cfm * room.factor / 1.15) + (people * 450) + (watts * 3.41)) / 12000).toFixed(2);

    lastCFM = cfm;
    document.getElementById('targetCFM').value = cfm;
    document.getElementById('unit-label').innerText = `${cfm} CFM | ${tr} TR`;
    
    if (save) {
        calcHistory.push({ no: calcHistory.length + 1, room: currentLang === 'ar' ? room.ar : room.en, tr: tr, cfm: cfm });
        updateHistoryUI();
    }
}

function updateHistoryUI() {
    document.getElementById('history-body').innerHTML = calcHistory.map(i => `
        <tr>
            <td style="color:#444">#${i.no}</td>
            <td>${i.room}</td>
            <td class="tr-val">${i.tr} TR</td>
            <td class="cfm-val">${i.cfm} CFM</td>
        </tr>
    `).reverse().join('');
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

// وظائف مساعدة
function focusField(f) {
    activeField = f;
    document.getElementById('display').classList.toggle('active-field', f === 'display');
    document.getElementById('people-count').classList.toggle('active-field', f === 'people');
    document.getElementById('equip-watts').classList.toggle('active-field', f === 'equip');
}
function press(n) { inputs[activeField] = (inputs[activeField] === "0") ? n.toString() : inputs[activeField] + n; updateDisplayValues(); }
function updateDisplayValues() {
    document.getElementById('display').innerText = inputs.display || "0";
    document.getElementById('people-count').value = inputs.people || "0";
    document.getElementById('equip-watts').value = inputs.equip || "0";
}
function updateRoomSelect() {
    const select = document.getElementById('room-select');
    select.innerHTML = rooms.map(r => `<option value="${r.id}">${currentLang === 'ar' ? r.ar : r.en}</option>`).join('');
}
function toggleLanguage() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    document.getElementById('html-tag').dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    document.querySelectorAll('[data-ar]').forEach(el => el.innerText = el.getAttribute(`data-${currentLang}`));
    updateRoomSelect(); renderEquipChecklist(); updateHistoryUI();
}
function openEquipModal() { document.getElementById('equip-modal').style.display = 'block'; }
function closeEquipModal() { document.getElementById('equip-modal').style.display = 'none'; }
function clearActiveField() { inputs[activeField] = "0"; updateDisplayValues(); }
function deleteLast() { inputs[activeField] = inputs[activeField].slice(0, -1) || "0"; updateDisplayValues(); }
function clearHistory() { calcHistory = []; updateHistoryUI(); }
