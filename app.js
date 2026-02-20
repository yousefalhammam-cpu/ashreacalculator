let currentLang = 'ar';
let activeField = 'display';
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];
let roomData = { categories: [] };

// قائمة الأجهزة
const equipmentList = [
  { id: 'pc', ar: '💻 كمبيوتر مكتب', en: 'Desktop PC', watts: 250, count: 0 },
  { id: 'srv', ar: '🖥️ سيرفر', en: 'Server', watts: 1200, count: 0 },
  { id: 'med', ar: '🩺 جهاز طبي عام', en: 'Medical Device', watts: 400, count: 0 },
  { id: 'mri', ar: '🧬 جهاز أشعة/رنين', en: 'Imaging Equip', watts: 2500, count: 0 },
  { id: 'frg', ar: '🧊 ثلاجة', en: 'Fridge', watts: 600, count: 0 },
  { id: 'tv', ar: '📺 شاشة', en: 'Large Screen', watts: 200, count: 0 },
  { id: 'cop', ar: '🖨️ طابعة/تصوير', en: 'Copier', watts: 800, count: 0 }
];

window.onload = async () => {
  await loadRoomData();
  updateRoomSelect();
  renderEquipChecklist();
  updateDisplayValues();
  focusField('display');
};

async function loadRoomData() {
  try {
    const res = await fetch('./data.json');
    roomData = await res.json();
  } catch (e) {
    console.error('Failed to load data.json', e);
    alert(currentLang === 'ar' ? 'تعذر تحميل بيانات الغرف' : 'Failed to load room data');
  }
}

function updateRoomSelect() {
  const select = document.getElementById('room-select');
  if (!select) return;

  const previousValue = select.value;
  select.innerHTML = '';

  roomData.categories.forEach(cat => {
    const group = document.createElement('optgroup');
    group.label = currentLang === 'ar' ? cat.name_ar : cat.name_en;

    cat.items.forEach(room => {
      const opt = document.createElement('option');
      opt.value = room.id;
      opt.textContent = currentLang === 'ar' ? room.ar : room.en;
      group.appendChild(opt);
    });

    select.appendChild(group);
  });

  // محاولة استرجاع الاختيار السابق
  if (previousValue) {
    select.value = previousValue;
    if (select.value !== previousValue && select.options.length > 0) {
      select.selectedIndex = 0;
    }
  } else if (select.options.length > 0) {
    select.selectedIndex = 0;
  }
}

function getSelectedRoom() {
  const select = document.getElementById('room-select');
  const roomId = select.value;

  for (const cat of roomData.categories) {
    const found = cat.items.find(item => item.id === roomId);
    if (found) return { ...found, category: cat };
  }
  return null;
}

function calculateLoad(save = false) {
  const volumeM3 = parseFloat(inputs.display) || 0;
  const people = parseInt(inputs.people) || 0;
  const equipWatts = parseFloat(inputs.equip) || 0;
  const room = getSelectedRoom();

  if (!room || volumeM3 <= 0) {
    document.getElementById('tr-result').innerText = `0 TR`;
    document.getElementById('cfm-result').innerText = `0 CFM`;
    return;
  }

  const volumeFt3 = volumeM3 * 35.3147;

  // CFM الأساسي من ACH
  const achCFM = (volumeFt3 * (room.ach || 0)) / 60;

  // تهوية الأشخاص (تقريب عام)
  const peopleCFM = people * (room.med ? 15 : 10);

  let cfm = 0;
  let tr = 0;

  if (room.med) {
    // --- المستشفيات: نعتمد ACH كأساس (ASHRAE style) ---
    cfm = Math.round(achCFM + peopleCFM);

    // حمل تبريد تقريبي مساعد (وليس بديل عن التصميم التفصيلي)
    const btuFromAir = cfm * (room.factor || 320) / 1.08; // تقريب عملي
    const btuPeople = people * 450;
    const btuEquip = equipWatts * 3.412;

    tr = ((btuFromAir + btuPeople + btuEquip) / 12000).toFixed(2);
  } else {
    // --- سكني/تجاري: طريقة شائعة بالسعودية (عامل حمل) ---
    // نفترض ارتفاع تقريبي 3 متر لتحويل الحجم لمساحة
    const areaM2 = volumeM3 / 3;
    const areaFt2 = areaM2 * 10.7639;

    // عامل الحمل (BTU/h per ft²) + أشخاص + أجهزة
    const btuArea = areaFt2 * (room.factor || 350);
    const btuPeople = people * 600;   // في الخليج غالبًا نرفعها شوي
    const btuEquip = equipWatts * 3.412;

    const trByLoad = (btuArea + btuPeople + btuEquip) / 12000;

    // CFM من الحمل (تقريب 400 CFM/ton)
    const cfmByTR = trByLoad * 400;

    // CFM الأدنى لا ينزل عن ACH المطلوب
    cfm = Math.round(Math.max(cfmByTR, achCFM + peopleCFM));
    tr = (cfm / 400).toFixed(2);
  }

  document.getElementById('tr-result').innerText = `${tr} TR`;
  document.getElementById('cfm-result').innerText = `${cfm} CFM`;

  const targetCFM = document.getElementById('targetCFM');
  if (targetCFM) targetCFM.value = cfm;

  if (save) {
    calcHistory.push({
      id: Date.now(),
      room: currentLang === 'ar' ? room.ar : room.en,
      tr,
      cfm
    });
    updateHistoryUI();
  }
}

// ================== UI Helpers ==================

function renderEquipChecklist() {
  const container = document.getElementById('equip-checklist');
  if (!container) return;

  container.innerHTML = equipmentList.map((item, idx) => `
    <div class="equip-item-row">
      <div>
        ${currentLang === 'ar' ? item.ar : item.en}
        <br><small style="color:#8e8e93">${item.watts}W</small>
      </div>
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

  inputs.equip = equipmentList.reduce((sum, item) => sum + (item.watts * item.count), 0).toString();
  updateDisplayValues();
  calculateLoad(false);
}

function updateHistoryUI() {
  const container = document.getElementById('history-list');
  if (!container) return;

  const isAr = currentLang === 'ar';

  container.innerHTML = calcHistory.slice().reverse().map((item, index) => `
    <div class="swipe-item" onclick="deleteItem(${item.id})">
      <div class="info">
        <span style="color:#666; font-size:0.7rem">#${calcHistory.length - index}</span>
        <span>${item.room}</span>
      </div>
      <div class="vals" style="text-align:${isAr ? 'right' : 'left'}">
        <span class="tr-val">${item.tr} TR</span><br>
        <span class="cfm-val">${item.cfm} CFM</span>
      </div>
    </div>
  `).join('');
}

function deleteItem(id) {
  const msg = currentLang === 'ar' ? 'حذف العملية؟' : 'Delete this item?';
  if (confirm(msg)) {
    calcHistory = calcHistory.filter(item => item.id !== id);
    updateHistoryUI();
  }
}

function press(n) {
  if (inputs[activeField] === "0") inputs[activeField] = n.toString();
  else inputs[activeField] += n.toString();
  updateDisplayValues();
}

function updateDisplayValues() {
  const displayEl = document.getElementById('display');
  const peopleEl = document.getElementById('people-count');
  const equipEl = document.getElementById('equip-watts');

  if (displayEl) displayEl.innerText = inputs.display || "0";
  if (peopleEl) peopleEl.value = inputs.people || "0";
  if (equipEl) equipEl.value = inputs.equip || "0";
}

function focusField(field) {
  activeField = field;

  document.querySelectorAll('.active-field').forEach(el => el.classList.remove('active-field'));

  if (field === 'display') {
    document.getElementById('display')?.classList.add('active-field');
  } else if (field === 'people') {
    document.getElementById('people-count')?.classList.add('active-field');
  } else if (field === 'equip') {
    document.getElementById('equip-watts')?.classList.add('active-field');
  }
}

function switchTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  document.getElementById(id)?.classList.add('active');
  btn.classList.add('active');
}

function openEquipModal() {
  document.getElementById('equip-modal').style.display = 'block';
  focusField('equip');
}

function closeEquipModal() {
  document.getElementById('equip-modal').style.display = 'none';
}

function deleteLast() {
  inputs[activeField] = inputs[activeField].slice(0, -1) || "0";
  updateDisplayValues();
}

function clearActiveField() {
  inputs[activeField] = "0";
  updateDisplayValues();
  calculateLoad(false);
}

function clearHistory() {
  const msg = currentLang === 'ar' ? 'مسح السجل بالكامل؟' : 'Clear all history?';
  if (confirm(msg)) {
    calcHistory = [];
    updateHistoryUI();
  }
}

function toggleLanguage() {
  currentLang = currentLang === 'ar' ? 'en' : 'ar';

  const html = document.getElementById('html-tag');
  html.setAttribute('lang', currentLang);
  html.setAttribute('dir', currentLang === 'ar' ? 'rtl' : 'ltr');

  // النصوص الديناميكية
  document.querySelectorAll('[data-ar]').forEach(el => {
    const txt = el.getAttribute(`data-${currentLang}`);
    if (txt) el.innerText = txt;
  });

  // زر اللغة السفلي
  const langText = document.getElementById('lang-text');
  if (langText) {
    langText.innerText = currentLang === 'ar' ? 'English' : 'العربية';
  }

  // محاذاة الشاشة حسب اللغة
  const calcScreen = document.querySelector('.calc-screen');
  if (calcScreen) calcScreen.style.textAlign = currentLang === 'ar' ? 'right' : 'left';

  updateRoomSelect();
  renderEquipChecklist();
  updateHistoryUI();
  updateDisplayValues();
}

function resetAllFields() {
  inputs = { display: "0", people: "0", equip: "0" };
  equipmentList.forEach(i => i.count = 0);

  renderEquipChecklist();
  updateDisplayValues();

  document.getElementById('tr-result').innerText = `0 TR`;
  document.getElementById('cfm-result').innerText = `0 CFM`;
  const targetCFM = document.getElementById('targetCFM');
  if (targetCFM) targetCFM.value = "";
}

function runDuctCalc() {
  const cfm = parseFloat(document.getElementById('targetCFM').value);
  const w = parseFloat(document.getElementById('fixWidth').value);

  if (!cfm || !w) return;

  // سرعة افتراضية 800 fpm
  const areaIn2 = (cfm / 800) * 144;
  const h = Math.max(4, Math.round(areaIn2 / w));

  document.getElementById('duct-result').innerText = `${w}" x ${h}"`;
}