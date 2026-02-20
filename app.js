let currentLang = 'ar';
let activeField = 'display'; 
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];

// قاعدة بيانات ASHRAE الشاملة (تراكمي)
const rooms = [
    // صحي
    { id: 'or', cat: 'h', ar: '🏥 غرفة عمليات', en: '🏥 Operating Room', ach: 20, factor: 300 },
    { id: 'icu', cat: 'h', ar: '🏥 العناية المركزة ICU', en: '🏥 Intensive Care Unit', ach: 6, factor: 400 },
    { id: 'pe', cat: 'h', ar: '🏥 غرف عزل PE', en: '🏥 Isolation Room', ach: 12, factor: 380 },
    { id: 'lab', cat: 'h', ar: '🏥 مختبرات عامة', en: '🏥 General Labs', ach: 8, factor: 400 },
    { id: 'pharm', cat: 'h', ar: '🏥 صيدلية', en: '🏥 Pharmacy', ach: 4, factor: 450 },
    // تجاري
    { id: 'off_op', cat: 'c', ar: '🏢 مكتب مفتوح', en: '🏢 Open Office', ach: 6, factor: 450 },
    { id: 'conf', cat: 'c', ar: '🏢 قاعة اجتماعات', en: '🏢 Conference Room', ach: 10, factor: 350 },
    { id: 'mall', cat: 'c', ar: '🏢 مول/معرض', en: '🏢 Retail/Mall', ach: 8, factor: 400 },
    { id: 'gym', cat: 'c', ar: '🏢 نادي رياضي', en: '🏢 Fitness Gym', ach: 15, factor: 350 },
    { id: 'mosque', cat: 'c', ar: '🏢 مسجد/مصلى', en: '🏢 Prayer Hall', ach: 10, factor: 400 },
    // سكني
    { id: 'living', cat: 'r', ar: '🏠 صالة معيشة', en: '🏠 Living Room', ach: 4, factor: 500 },
    { id: 'bed', cat: 'r', ar: '🏠 غرفة نوم', en: '🏠 Bedroom', ach: 2, factor: 550 },
    { id: 'kitchen', cat: 'r', ar: '🏠 مطبخ', en: '🏠 Kitchen', ach: 6, factor: 450 }
];

const equipmentList = [
    { id: 'pc', ar: 'كمبيوتر', en: 'PC', watts: 250, count: 0 },
    { id: 'print', ar: 'طابعة', en: 'Printer', watts: 400, count: 0 },
    { id: 'serv', ar: 'سيرفر', en: 'Server', watts: 1000, count: 0 },
    { id: 'screen', ar: 'شاشة/تلفاز', en: 'Monitor/TV', watts: 150, count: 0 }
];

window.onload = () => {
    updateRoomSelect();
    renderEquipChecklist();
    focusField('display');
};

// وظيفة التصفير عند اختيار غرفة جديدة
function resetAllFields() {
    inputs = { display: "0", people: "0", equip: "0" };
    equipmentList.forEach(item => item.count = 0);
    renderEquipChecklist();
    updateDisplayValues();
    document.getElementById('unit-label').innerText = "0 CFM | 0 TR";
    focusField('display');
}

function updateRoomSelect() {
    const select = document.getElementById('room-select');
    const cats = [
        { id: 'h', ar: 'صحي (ASHRAE 170)', en: 'Healthcare' },
        { id: 'c', ar: 'تجاري (62.1)', en: 'Commercial' },
        { id: 'r', ar: 'سكني', en: 'Residential' }
    ];
    let html = '';
    cats.forEach(c => {
        html += `<optgroup label="${currentLang === 'ar' ? c.ar : c.en}">`;
        rooms.filter(r => r.cat === c.id).forEach(r => {
            html += `<option value="${r.id}">${currentLang === 'ar' ? r.ar : r.en}</option>`;
        });
        html += `</optgroup>`;
    });
    select.innerHTML = html;
}

function renderEquipChecklist() {
    const container = document.getElementById('equip-checklist');
    container.innerHTML = equipmentList.map((item, idx) => `
        <div class="equip-item-row">
            <div><span>${currentLang === 'ar' ? item.ar : item.en}</span> <small style="color:orange">${item.watts}W</small></div>
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
    let total = equipmentList.reduce((sum, i) => sum + (i.watts * i.count), 0);
    inputs.equip = total.toString();
    document.getElementById('equip-watts').value = inputs.equip;
    calculateLoad(false);
}

function toggleLanguage() {
    currentLang = currentLang === 'ar' ? 'en' : 'ar';
    const tag = document.getElementById('html-tag');
    tag.dir = currentLang === 'ar' ? 'rtl' : 'ltr';
    tag.lang = currentLang;
    document.querySelectorAll('[data-ar]').forEach(el => el.innerText = el.getAttribute(`data-${currentLang}`));
    document.getElementById('lang-text').innerText = currentLang === 'ar' ? 'English' : 'العربية';
    updateRoomSelect();
    renderEquipChecklist();
    updateHistoryUI();
}

function focusField(f) {
    activeField = f;
    document.getElementById('display').classList.toggle('active-field', f === 'display');
    document.getElementById('people-count').classList.toggle('active-field', f === 'people');
    document.getElementById('equip-watts').classList.toggle('active-field', f === 'equip');
}

function press(n) {
    if (inputs[activeField].length > 8) return;
    inputs[activeField] = (inputs[activeField] === "0") ? n.toString() : inputs[activeField] + n;
    updateDisplayValues();
}

function updateDisplayValues() {
    document.getElementById('display').innerText = inputs.display || "0";
    document.getElementById('people-count').value = inputs.people || "0";
    document.getElementById('equip-watts').value = inputs.equip || "0";
}

function calculateLoad(save = false) {
    const vol = parseFloat(inputs.display) || 0;
    const people = parseInt(inputs.people) || 0;
    const watts = parseFloat(inputs.equip) || 0;
    const room = rooms.find(r => r.id === document.getElementById('room-select').value);

    let cfm = Math.round(((vol * 35.31 * room.ach) / 60) + (people * 15));
    let tr = (((cfm * room.factor / 1.15) + (people * 450) + (watts * 3.41)) / 12000).toFixed(2);

    document.getElementById('unit-label').innerText = `${cfm} CFM | ${tr} TR`;
    
    if (save) {
        calcHistory.push({ no: calcHistory.length + 1, room: currentLang === 'ar' ? room.ar : room.en, tr: tr, cfm: cfm });
        updateHistoryUI();
    }
}

function updateHistoryUI() {
    document.getElementById('history-body').innerHTML = calcHistory.map(i => `
        <tr><td>${i.no}</td><td>${i.room}</td><td style="color:orange; font-weight:bold">${i.tr}</td><td>${i.cfm}</td></tr>
    `).reverse().join('');
}

function clearActiveField() { inputs[activeField] = "0"; updateDisplayValues(); }
function deleteLast() { inputs[activeField] = inputs[activeField].slice(0, -1) || "0"; updateDisplayValues(); }
function openEquipModal() { document.getElementById('equip-modal').style.display = 'block'; }
function closeEquipModal() { document.getElementById('equip-modal').style.display = 'none'; }
function clearHistory() { if(confirm("Clear?")){calcHistory = []; updateHistoryUI();} }
function switchTab(id, btn) { /* منطق التبديل التراكمي */ }
