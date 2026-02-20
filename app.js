let currentLang = 'ar';
let activeField = 'display'; 
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];

// قاعدة بيانات هندسية شاملة مقسمة حسب القطاع
const roomDatabase = {
    residential: [
        { id: 'r1', ar: '🏠 غرفة نوم رئيسية', en: 'Master Bedroom', ach: 2, factor: 320 },
        { id: 'r2', ar: '🏠 غرفة معيشة', en: 'Living Room', ach: 4, factor: 350 },
        { id: 'r3', ar: '🏠 مجلس ضيوف', en: 'Majlis', ach: 5, factor: 400 },
        { id: 'r4', ar: '🏠 مطبخ منزلي', en: 'Kitchen', ach: 8, factor: 450 },
        { id: 'r5', ar: '🏠 صالة طعام', en: 'Dining Room', ach: 4, factor: 350 }
    ],
    commercial: [
        { id: 'c1', ar: '🏢 مكاتب إدارية', en: 'Offices', ach: 6, factor: 420 },
        { id: 'c2', ar: '🏢 مطعم / صالة طعام', en: 'Restaurant', ach: 12, factor: 320 },
        { id: 'c3', ar: '🏢 معرض تجاري', en: 'Retail Store', ach: 8, factor: 380 },
        { id: 'c4', ar: '🏢 نادي رياضي', en: 'Gym', ach: 15, factor: 300 },
        { id: 'c5', ar: '🏢 قاعة مؤتمرات', en: 'Conference Room', ach: 10, factor: 350 }
    ],
    healthcare: [
        { id: 'h1', ar: '🏥 غرفة عمليات (OR)', en: 'Operating Room', ach: 20, factor: 280 },
        { id: 'h2', ar: '🏥 العناية المركزة (ICU)', en: 'ICU', ach: 12, factor: 350 },
        { id: 'h3', ar: '🏥 مختبر طبي', en: 'Laboratory', ach: 10, factor: 400 },
        { id: 'h4', ar: '🏥 غرفة عزل PE', en: 'Isolation Room', ach: 12, factor: 350 },
        { id: 'h5', ar: '🏥 غرفة أشعة / رنين', en: 'X-Ray / MRI', ach: 8, factor: 500 }
    ]
};

// قائمة الأجهزة الشاملة مع استهلاكها الحراري الدقيق
const equipmentList = [
    { id: 'pc', ar: '💻 كمبيوتر مكتب', en: 'Desktop PC', watts: 250, count: 0 },
    { id: 'srv', ar: '🖥️ سيرفر (Blade)', en: 'Server', watts: 1200, count: 0 },
    { id: 'med', ar: '🩺 جهاز طبي عام', en: 'Medical Device', watts: 400, count: 0 },
    { id: 'mri', ar: '🧬 جهاز رنين/أشعة', en: 'Imaging Equip', watts: 2500, count: 0 },
    { id: 'frg', ar: '🧊 ثلاجة مختبر/مطبخ', en: 'Fridge', watts: 600, count: 0 },
    { id: 'tv', ar: '📺 شاشة عرض كبرى', en: 'Large Screen', watts: 200, count: 0 },
    { id: 'cop', ar: '🖨️ طابعة / ماكينة تصوير', en: 'Copier', watts: 800, count: 0 }
];

window.onload = () => {
    updateRoomSelect();
    renderEquipChecklist();
    focusField('display');
};

function updateRoomSelect() {
    const select = document.getElementById('room-select');
    select.innerHTML = '';
    
    // إنشاء المجموعات (Optgroup) للتنظيم
    for (const [key, category] of Object.entries(roomDatabase)) {
        const group = document.createElement('optgroup');
        group.label = getCategoryName(key);
        category.forEach(room => {
            const opt = document.createElement('option');
            opt.value = room.id;
            opt.dataset.cat = key;
            opt.innerText = currentLang === 'ar' ? room.ar : room.en;
            group.appendChild(opt);
        });
        select.appendChild(group);
    }
}

function getCategoryName(key) {
    const names = {
        residential: { ar: 'القطاع السكني', en: 'Residential' },
        commercial: { ar: 'القطاع التجاري', en: 'Commercial' },
        healthcare: { ar: 'القطاع الصحي (ASHRAE)', en: 'Healthcare' }
    };
    return currentLang === 'ar' ? names[key].ar : names[key].en;
}

function calculateLoad(save = false) {
    const vol = parseFloat(inputs.display) || 0;
    const people = parseInt(inputs.people) || 0;
    const watts = parseFloat(inputs.equip) || 0;
    
    const select = document.getElementById('room-select');
    const catKey = select.options[select.selectedIndex].dataset.cat;
    const room = roomDatabase[catKey].find(r => r.id === select.value);

    // حساب CFM (تبديلات الهواء + تهوية الأشخاص)
    let cfm = Math.round(((vol * 35.31 * room.ach) / 60) + (people * 15));
    
    // معادلة الطن التبريدي (الحرارة المحسوسة من الـ CFM + الأشخاص + الأجهزة)
    // تقسيم على 12000 BTU للطن مع معامل أمان ميداني (1.1)
    let tr = (((cfm * room.factor / 1.1) + (people * 450) + (watts * 3.41)) / 12000).toFixed(2);

    document.getElementById('tr-result').innerText = `${tr} TR`;
    document.getElementById('cfm-result').innerText = `${cfm} CFM`;
    document.getElementById('targetCFM').value = cfm;
    
    if (save) {
        calcHistory.push({ id: Date.now(), room: currentLang === 'ar' ? room.ar : room.en, tr: tr, cfm: cfm });
        updateHistoryUI();
    }
}

// --- الوظائف المساعدة للواجهة ---
function renderEquipChecklist() {
    document.getElementById('equip-checklist').innerHTML = equipmentList.map((item, idx) => `
        <div class="equip-item-row">
            <div>${currentLang === 'ar' ? item.ar : item.en} <br><small style="color:#8e8e93">${item.watts}W</small></div>
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
    if(confirm(currentLang === 'ar' ? "حذف؟" : "Delete?")) {
        calcHistory = calcHistory.filter(i => i.id !== id);
        updateHistoryUI();
    }
}

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
    else if(f === 'people') document.getElementById('people-count').classList.add('active-field');
    else if(f === 'equip') document.getElementById('equip-watts').classList.add('active-field');
}

function switchTab(id, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    btn.classList.add('active');
}

function openEquipModal() { document.getElementById('equip-modal').style.display = 'block'; }
function closeEquipModal() { document.getElementById('equip-modal').style.display = 'none'; }
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
    calculateLoad(false);
}

function runDuctCalc() {
    const cfm = parseFloat(document.getElementById('targetCFM').value);
    const w = parseFloat(document.getElementById('fixWidth').value);
    if (cfm && w) {
        let h = Math.round((cfm / 800 * 144) / w);
        document.getElementById('duct-result').innerText = `${w}" x ${h}"`;
    }
}
