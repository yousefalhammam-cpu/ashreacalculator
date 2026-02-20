let activeField = 'display'; 
let inputs = { display: "", people: "", equip: "0" };
let calcHistory = [];

const rooms = [
    { id: 'or_gen', ar: '🏥 غرفة عمليات عامة', ach: 20, factor: 300 },
    { id: 'icu', ar: '🏥 العناية المركزة ICU', ach: 6, factor: 400 },
    { id: 'office', ar: '🏢 مكاتب مفتوحة', ach: 8, factor: 450 },
    { id: 'living', ar: '🏠 مجلس / صالة معيشة', ach: 4, factor: 500 }
];

// قائمة موسعة للأجهزة (تراكمية)
const equipmentList = [
    { id: 'pc', name: 'كمبيوتر مكتبي', watts: 250, count: 0 },
    { id: 'laptop', name: 'لاب توب', watts: 65, count: 0 },
    { id: 'screen', name: 'شاشة إضافية', watts: 50, count: 0 },
    { id: 'printer_l', name: 'طابعة ليزر كبيرة', watts: 500, count: 0 },
    { id: 'server', name: 'خادم (Server)', watts: 1000, count: 0 },
    { id: 'fridge', name: 'ثلاجة مكتب', watts: 150, count: 0 },
    { id: 'coffee', name: 'ماكينة قهوة', watts: 800, count: 0 },
    { id: 'projector', name: 'جهاز عرض', watts: 300, count: 0 },
    { id: 'med_mon', name: 'جهاز مراقبة طبي', watts: 150, count: 0 },
    { id: 'surgical_lt', name: 'كشاف جراحي', watts: 200, count: 0 },
    { id: 'tv_large', name: 'شاشة تلفزيون كبيرة', watts: 200, count: 0 },
    { id: 'microwave', name: 'مايكرويف', watts: 1200, count: 0 }
];

window.onload = () => {
    updateUI();
    renderEquipChecklist();
    focusField('display');
};

function renderEquipChecklist() {
    const container = document.getElementById('equip-checklist');
    container.innerHTML = equipmentList.map((item, index) => `
        <div class="equip-item-row">
            <div class="equip-info">
                <span class="equip-name">${item.name}</span>
                <span class="equip-watt-label">${item.watts}W لكل وحدة</span>
            </div>
            <div class="counter-ctrl">
                <button class="counter-btn" onclick="changeCount(${index}, -1)">-</button>
                <span class="counter-val" id="count-${index}">${item.count}</span>
                <button class="counter-btn" onclick="changeCount(${index}, 1)">+</button>
            </div>
        </div>
    `).join('');
}

function changeCount(index, delta) {
    equipmentList[index].count = Math.max(0, equipmentList[index].count + delta);
    document.getElementById(`count-${index}`).innerText = equipmentList[index].count;
    
    // حساب المجموع الكلي
    let totalWatts = equipmentList.reduce((sum, item) => sum + (item.watts * item.count), 0);
    inputs.equip = totalWatts.toString();
    document.getElementById('equip-watts').value = inputs.equip;
    calculateLoad(false); // تحديث النتائج فوراً
}

function focusField(fieldId) {
    activeField = fieldId;
    document.getElementById('display').classList.toggle('active-field', fieldId === 'display');
    document.getElementById('people-count').classList.toggle('active-field', fieldId === 'people');
    document.getElementById('equip-watts').classList.toggle('active-field', fieldId === 'equip');
}

function press(n) { 
    if (inputs[activeField].length > 7) return;
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
    if (vol <= 0) return;

    const roomId = document.getElementById('room-select').value;
    const spec = rooms.find(r => r.id === roomId);

    let cfm = Math.round(((vol * 35.31 * spec.ach) / 60) + (people * 15));
    let tr = (((cfm * spec.factor / 1.15) + (people * 450) + (watts * 3.41)) / 12000).toFixed(2);

    document.getElementById('unit-label').innerText = `${cfm} CFM | ${tr} TR`;
    if (save) {
        calcHistory.push({ room: spec.ar, tr: tr, cfm: cfm });
        updateHistoryUI();
    }
}

function updateHistoryUI() {
    document.getElementById('history-body').innerHTML = calcHistory.map(i => 
        `<tr><td>${i.room}</td><td style="color:#ff9f0a">${i.tr} TR</td><td>${i.cfm}</td></tr>`
    ).reverse().slice(0, 3).join('');
}

function updateUI() {
    const select = document.getElementById('room-select');
    select.innerHTML = rooms.map(r => `<option value="${r.id}">${r.ar}</option>`).join('');
}

function openEquipModal() { document.getElementById('equip-modal').style.display = 'block'; }
function closeEquipModal() { document.getElementById('equip-modal').style.display = 'none'; }
function openContact() { document.getElementById('contact-modal').style.display = 'block'; }
function closeContact() { document.getElementById('contact-modal').style.display = 'none'; }
function clearActiveField() { inputs[activeField] = "0"; updateDisplayValues(); }
function deleteLast() { inputs[activeField] = inputs[activeField].slice(0, -1) || "0"; updateDisplayValues(); }

function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
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
