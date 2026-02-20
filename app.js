let activeField = 'display'; 
let inputs = { display: "", people: "", equip: "0" };
let calcHistory = [];

const rooms = [
    // الصحية
    { id: 'or_gen', ar: '🏥 غرفة عمليات عامة', ach: 20, factor: 300 },
    { id: 'or_ortho', ar: '🏥 عمليات عظام/نقل أعضاء', ach: 25, factor: 280 },
    { id: 'icu', ar: '🏥 العناية المركزة ICU', ach: 6, factor: 400 },
    { id: 'pe_iso', ar: '🏥 عزل ضغط موجب PE', ach: 12, factor: 380 },
    { id: 'aii_iso', ar: '🏥 عزل ضغط سالب AII', ach: 12, factor: 380 },
    { id: 'patient', ar: '🏥 غرف تنويم المرضى', ach: 4, factor: 500 },
    { id: 'lab', ar: '🏥 مختبرات عامة', ach: 8, factor: 400 },
    // التجارية
    { id: 'office', ar: '🏢 مكاتب مفتوحة', ach: 8, factor: 450 },
    { id: 'mall', ar: '🏢 مراكز تجارية', ach: 8, factor: 400 },
    { id: 'gym', ar: '🏢 نادي رياضي', ach: 15, factor: 350 },
    { id: 'data_ctr', ar: '🏢 غرف سيرفرات', ach: 30, factor: 150 },
    // السكنية
    { id: 'living', ar: '🏠 مجلس / صالة معيشة', ach: 4, factor: 500 },
    { id: 'bedroom', ar: '🏠 غرف نوم', ach: 2, factor: 550 }
];

const equipmentList = [
    { id: 'pc', name: 'كمبيوتر مكتبي', watts: 250 },
    { id: 'laptop', name: 'لاب توب', watts: 65 },
    { id: 'printer', name: 'طابعة ليزر', watts: 400 },
    { id: 'server', name: 'خادم (Server)', watts: 1000 },
    { id: 'fridge', name: 'ثلاجة صغيرة', watts: 150 },
    { id: 'med_mon', name: 'جهاز طبي', watts: 200 }
];

window.onload = () => {
    updateUI();
    renderEquipChecklist();
    focusField('display');
};

function renderEquipChecklist() {
    const container = document.getElementById('equip-checklist');
    container.innerHTML = equipmentList.map(item => `
        <div class="check-item">
            <label>${item.name} <span class="watt-tag">${item.watts}W</span></label>
            <input type="checkbox" value="${item.watts}" onchange="updateTotalWatts()">
        </div>
    `).join('');
}

function updateTotalWatts() {
    const checkboxes = document.querySelectorAll('#equip-checklist input[type="checkbox"]:checked');
    let total = Array.from(checkboxes).reduce((sum, cb) => sum + parseInt(cb.value), 0);
    inputs.equip = total.toString();
    document.getElementById('equip-watts').value = inputs.equip;
    calculateLoad(false);
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
    let html = '';
    const cats = [{ l: 'المنشآت الصحية', p: '🏥' }, { l: 'التجارية', p: '🏢' }, { l: 'السكنية', p: '🏠' }];
    cats.forEach(c => {
        html += `<optgroup label="${c.l}">`;
        rooms.filter(r => r.ar.includes(c.p)).forEach(r => html += `<option value="${r.id}">${r.ar}</option>`);
        html += `</optgroup>`;
    });
    select.innerHTML = html;
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
