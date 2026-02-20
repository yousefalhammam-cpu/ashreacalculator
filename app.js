let currentLang = 'ar';
let activeField = 'display'; 
let inputs = { display: "", people: "", equip: "" };
let calcHistory = [];

// الدليل الشامل لغرف ASHRAE
const rooms = [
    // --- الصحية ---
    { id: 'or_gen', ar: '🏥 غرفة عمليات عامة', ach: 20, factor: 300 },
    { id: 'or_ortho', ar: '🏥 عمليات عظام/نقل أعضاء', ach: 25, factor: 280 },
    { id: 'icu', ar: '🏥 العناية المركزة ICU', ach: 6, factor: 400 },
    { id: 'pe_iso', ar: '🏥 عزل ضغط موجب PE', ach: 12, factor: 380 },
    { id: 'aii_iso', ar: '🏥 عزل ضغط سالب AII', ach: 12, factor: 380 },
    { id: 'er_exam', ar: '🏥 غرف فحص الطوارئ', ach: 12, factor: 350 },
    { id: 'delivery', ar: '🏥 غرف الولادة LDR', ach: 15, factor: 320 },
    { id: 'trauma', ar: '🏥 غرف الصدمات Trauma', ach: 15, factor: 300 },
    { id: 'lab_gen', ar: '🏥 مختبرات عامة', ach: 8, factor: 400 },
    { id: 'pharmacy', ar: '🏥 الصيدلية', ach: 4, factor: 450 },
    { id: 'patient_rm', ar: '🏥 غرف تنويم المرضى', ach: 4, factor: 500 },
    { id: 'sterile_st', ar: '🏥 مستودع معقم', ach: 4, factor: 400 },
    { id: 'dialysis', ar: '🏥 غسيل الكلى', ach: 6, factor: 400 },
    { id: 'morgue', ar: '🏥 المشرحة', ach: 12, factor: 350 },
    // --- التجارية ---
    { id: 'office_op', ar: '🏢 مكاتب مفتوحة', ach: 6, factor: 450 },
    { id: 'conf_rm', ar: '🏢 قاعات اجتماعات', ach: 10, factor: 350 },
    { id: 'mall_shop', ar: '🏢 مراكز تجارية', ach: 8, factor: 400 },
    { id: 'restaurant', ar: '🏢 صالة مطعم', ach: 15, factor: 300 },
    { id: 'kitchen_com', ar: '🏢 مطبخ تجاري', ach: 30, factor: 250 },
    { id: 'gym_hall', ar: '🏢 نادي رياضي', ach: 15, factor: 350 },
    { id: 'mosque', ar: '🏢 مسجد/قاعة صلاة', ach: 10, factor: 400 },
    { id: 'cinema', ar: '🏢 سينما/مسرح', ach: 12, factor: 350 },
    { id: 'data_ctr', ar: '🏢 غرف سيرفرات', ach: 30, factor: 150 },
    // --- السكنية ---
    { id: 'living_rm', ar: '🏠 مجلس / صالة معيشة', ach: 4, factor: 500 },
    { id: 'bedroom', ar: '🏠 غرف نوم', ach: 2, factor: 550 },
    { id: 'kitchen_res', ar: '🏠 مطبخ منزلي', ach: 6, factor: 450 },
    { id: 'laundry', ar: '🏠 غرف الغسيل', ach: 10, factor: 350 },
    { id: 'basement', ar: '🏠 القبو', ach: 4, factor: 600 }
];

window.onload = () => {
    updateUI();
    focusField('display');
};

function focusField(fieldId) {
    activeField = fieldId;
    document.getElementById('display').classList.toggle('active-field', fieldId === 'display');
    document.getElementById('people-count').classList.toggle('active-field', fieldId === 'people');
    document.getElementById('equip-watts').classList.toggle('active-field', fieldId === 'equip');
}

function press(n) { 
    if (inputs[activeField].length > 7) return;
    inputs[activeField] += n; 
    updateDisplayValues();
}

function updateDisplayValues() {
    document.getElementById('display').innerText = inputs.display || "0";
    document.getElementById('people-count').value = inputs.people || "0";
    document.getElementById('equip-watts').value = inputs.equip || "0";
}

function clearActiveField() { inputs[activeField] = ""; updateDisplayValues(); }
function deleteLast() { inputs[activeField] = inputs[activeField].slice(0, -1); updateDisplayValues(); }

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
        calcHistory.push({ id: Date.now(), room: spec.ar, tr: tr, cfm: cfm });
        updateHistoryUI();
    }
}

function updateHistoryUI() {
    document.getElementById('history-body').innerHTML = calcHistory.map(i => 
        `<tr><td>${i.room}</td><td style="color:#ff9f0a">${i.tr} TR</td><td>${i.cfm} CFM</td></tr>`
    ).reverse().slice(0, 3).join('');
}

function updateUI() {
    const select = document.getElementById('room-select');
    let html = '';
    const cats = [
        { label: 'المنشآت الصحية (ASHRAE 170)', prefix: '🏥' },
        { label: 'المنشآت التجارية', prefix: '🏢' },
        { label: 'المنشآت السكنية', prefix: '🏠' }
    ];
    cats.forEach(c => {
        html += `<optgroup label="${c.label}">`;
        rooms.filter(r => r.ar.includes(c.prefix)).forEach(r => {
            html += `<option value="${r.id}">${r.ar}</option>`;
        });
        html += `</optgroup>`;
    });
    select.innerHTML = html;
}

function openContact() { document.getElementById('contact-modal').style.display = 'block'; }
function closeContact() { document.getElementById('contact-modal').style.display = 'none'; }
function resetForNewRoom() { inputs = { display: "", people: "", equip: "" }; updateDisplayValues(); focusField('display'); }

function switchTab(tabId, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    btn.classList.add('active');
}

function runDuctCalc() {
    const cfm = parseFloat(document.getElementById('targetCFM').value);
    const w = parseFloat(document.getElementById('fixWidth').value);
    if (!cfm || !w) return;
    const area = cfm / 800; // تقريبي لسرعة 800 fpm
    const h = Math.round((area * 144) / w);
    document.getElementById('duct-result').innerText = `${w}" x ${h}"`;
}
