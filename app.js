let currentLang = 'ar';
let activeField = 'display';
let inputs = { display: "0", people: "0", equip: "0" };
let calcHistory = [];
let roomData = null;

// قائمة الأجهزة
const equipmentList = [
  { id: 'pc', ar: '💻 كمبيوتر مكتب', en: 'Desktop PC', watts: 250, count: 0 },
  { id: 'srv', ar: '🖥️ سيرفر', en: 'Server', watts: 1200, count: 0 },
  { id: 'med', ar: '🩺 جهاز طبي', en: 'Medical Device', watts: 400, count: 0 },
  { id: 'mri', ar: '🧬 جهاز أشعة/رنين', en: 'Imaging Equip', watts: 2500, count: 0 },
  { id: 'frg', ar: '🧊 ثلاجة', en: 'Fridge', watts: 600, count: 0 },
  { id: 'tv', ar: '📺 شاشة', en: 'Screen', watts: 200, count: 0 },
  { id: 'cop', ar: '🖨️ طابعة', en: 'Copier', watts: 800, count: 0 }
];

window.onload = async () => {
  await loadRoomData();
  renderEquipChecklist();
  focusField('display');
  updateDisplayValues();
  applyLanguageUI();
};

async function loadRoomData() {
  try {
    const res = await fetch('./data.json');
    roomData = await res.json();
    updateRoomSelect();
  } catch (e) {
    console.error('Failed to load data.json', e);
    alert('خطأ في تحميل data.json');
  }
}

function updateRoomSelect() {
  const select = document.getElementById('room-select');
  if (!select || !roomData) return;

  select.innerHTML = '';
  roomData.categories.forEach(cat => {
    const group = document.createElement('optgroup');
    group.label = currentLang === 'ar' ? cat.name_ar : cat.name_en;

    cat.items.forEach(item => {
      const opt = document.createElement('option');
      opt.value = item.id;
      opt.innerText = currentLang === 'ar' ? item.ar : item.en;
      group.appendChild(opt);
    });

    select.appendChild(group);
  });
}

function getSelectedRoom() {
  const select = document.getElementById('room-select');
  const id = select.value;
  for (const cat of roomData.categories) {
    const found = cat.items.find(i => i.id === id);
    if (found) return { ...found, category: cat };
  }
  return null;
}

function calculateLoad(save = false) {
  if (!roomData) return;

  const volM3 = parseFloat(inputs.display) || 0;
  const people = parseInt(inputs.people) || 0;
  const equipWatts = parseFloat(inputs.equip) || 0;
  const room = getSelectedRoom();

  if (!room || volM3 <= 0) {
    document.getElementById('tr-result').innerText = '0 TR';
    document.getElementById('cfm-result').innerText = '0 CFM';
    return;
  }

  let cfm = 0;
  let tr = 0;
  let note = '';

  // --- 1) القطاع الصحي: ASHRAE-style ACH ---
  if (room.med === true) {
    // CFM = Volume(ft³) * ACH / 60
    const volFt3 = volM3 * 35.3147;
    const cfmAch = (volFt3 * (room.ach || 0)) / 60;
    const cfmPeople = people * 15; // تهوية إضافية تقديرية للأشخاص
    cfm = Math.round(cfmAch + cfmPeople);

    // حمل تقريبي: من الهواء + أشخاص + أجهزة
    // (معامل 1.08 للهواء تقريبي مع ΔT تصميمي 20°F => ~21.6)
    const sensibleAirBTU = cfm * 21.6;
    const peopleBTU = people * 450;
    const equipBTU = equipWatts * 3.412;
    tr = (sensibleAirBTU + peopleBTU + equipBTU) / 12000;

    note = currentLang === 'ar' ? 'نظام صحي (ACH)' : 'Healthcare ACH';
  } 
  // --- 2) السكني + التجاري: ممارسة سعودية (عامل حمل لكل م3) ---
  else {
    const factor = room.factor || 400; // BTU/hr per m3 تقريبي عملي
    const baseBTU = volM3 * factor;
    const peopleBTU = people * 600;    // أعلى شوي للممارسة المحلية
    const equipBTU = equipWatts * 3.412;
    const totalBTU = baseBTU + peopleBTU + equipBTU;

    tr = totalBTU / 12000;

    // CFM تقريبي من الطن (1 TR ≈ 400 CFM)
    cfm = Math.round(tr * 400);

    note = currentLang === 'ar' ? 'سكني/تجاري (ممارسة محلية)' : 'Saudi Practice';
  }

  // تحسين عرض الأرقام
  tr = Math.max(0, tr);
  const trRounded = tr.toFixed(2);

  document.getElementById('tr-result').innerText = `${trRounded} TR`;
  document.getElementById('cfm-result').innerText = `${cfm} CFM`;
  document.getElementById('targetCFM').value = cfm;

  const hint = document.getElementById('field-hint');
  if (hint) {
    hint.setAttribute('title', note);
  }

  if (save) {
    calcHistory.push({
      id: Date.now(),
      room: currentLang === 'ar' ? room.ar : room.en,
      tr: trRounded,
      cfm
    });
    updateHistoryUI();
  }
}

// ---------------- UI Helpers ----------------
function renderEquipChecklist() {
  const box = document.getElementById('equip-checklist');
  if (!box) return;

  box.innerHTML = equipmentList.map((item, idx) => `
    <div class="equip-item-row">
      <div>
        ${currentLang === 'ar' ? item.ar : item.en}
        <br><small style="color:#8e8e93">${item.watts} W</small>
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
  const cnt = document.getElementById(`cnt-${idx}`);
  if (cnt) cnt.innerText = equipmentList[idx].count;

  inputs.equip = equipmentList.reduce((sum, i) => sum + (i.watts * i.count), 0).toString();
  updateDisplayValues();
  calculateLoad(false);
}

function updateHistoryUI() {
  const container = document.getElementById('history-list');
  if (!container) return;

  container.innerHTML = calcHistory.slice().reverse().map((item, index) => `
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
  `).join('');
}

function deleteItem(id) {
  const msg = currentLang === 'ar' ? 'حذف العملية؟' : 'Delete this record?';
  if (confirm(msg)) {
    calcHistory = calcHistory.filter(i => i.id !== id);
    updateHistoryUI();
  }
}

function press(n) {
  if (inputs[activeField] === "0" && n !== '.') inputs[activeField] = n.toString();
  else {
    // منع تكرار النقطة
    if (n === '.' && inputs[activeField].includes('.')) return;
    inputs[activeField] += n.toString();
  }
  updateDisplayValues();
  if (activeField !== 'equip') calculateLoad(false);
}

function updateDisplayValues() {
  const display = document.getElementById('display');
  const people = document.getElementById('people-count');
  const equip = document.getElementById('equip-watts');

  if (display) display.innerText = inputs.display || "0";
  if (people) people.value = inputs.people || "0";
  if (equip) equip.value = inputs.equip || "0";
}

function focusField(f) {
  activeField = f;

  document.getElementById('display')?.classList.remove('active-field');
  document.getElementById('people-count')?.classList.remove('active-field');
  document.getElementById('equip-watts')?.classList.remove('active-field');

  if (f === 'display') document.getElementById('display')?.classList.add('active-field');
  if (f === 'people') document.getElementById('people-count')?.classList.add('active-field');
  if (f === 'equip') document.getElementById('equip-watts')?.classList.add('active-field');
}

function switchTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item[data-tab]').forEach(n => n.classList.remove('active'));

  document.getElementById(id)?.classList.add('active');
  if (btn) btn.classList.add('active');
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
  if (activeField !== 'equip') calculateLoad(false);
}
function clearActiveField() {
  inputs[activeField] = "0";
  updateDisplayValues();
  if (activeField !== 'equip') calculateLoad(false);
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

  // اتجاه الصفحة
  const html = document.getElementById('html-tag');
  html.lang = currentLang;
  html.dir = currentLang === 'ar' ? 'rtl' : 'ltr';

  // تحديث النصوص العامة
  applyLanguageUI();

  // تحديث العناصر الديناميكية
  updateRoomSelect();
  renderEquipChecklist();
  updateHistoryUI();
  calculateLoad(false);
}

function applyLanguageUI() {
  document.querySelectorAll('[data-ar]').forEach(el => {
    el.innerText = el.getAttribute(currentLang === 'ar' ? 'data-ar' : 'data-en');
  });

  // زر اللغة السفلي
  const langText = document.getElementById('lang-text');
  if (langText) {
    langText.innerText = currentLang === 'ar' ? 'English' : 'العربية';
  }

  // زر مسح السجل
  const clearBtn = document.querySelector('.clear-history-btn');
  if (clearBtn) {
    clearBtn.innerText = currentLang === 'ar' ? 'مسح' : 'Clear';
  }

  // عنوان التطبيق (اختياري)
  const header = document.querySelector('.simple-header');
  if (header) {
    header.innerText = 'Air Calc Pro | HVAC Engineering Suite';
  }
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

  if (!cfm || !w) {
    document.getElementById('duct-result').innerText = '---';
    return;
  }

  // سرعة تقديرية 800 fpm
  const h = Math.max(4, Math.round((cfm / 800 * 144) / w));
  document.getElementById('duct-result').innerText = `${w}" x ${h}"`;
}