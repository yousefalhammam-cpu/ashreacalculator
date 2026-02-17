/* =========================================
   Air Calc Pro - app.js (Hospital + Residential)
   - Fills Category (Hospital/Residential)
   - Fills Room Type based on category
   - Auto-fills ACH Override when room selected
   ========================================= */

'use strict';

/* ========= DOM IDS (عدّلها إذا أسماء عناصر HTML عندك مختلفة) ========= */
const IDS = {
  categorySelect: 'categorySelect',     // select: مستشفى/منازل
  roomTypeSelect: 'roomTypeSelect',     // select: نوع الغرفة
  roomNameInput: 'roomName',            // input: اسم الغرفة (اختياري)
  roomVolumeInput: 'roomVolume',        // input: حجم الغرفة (m3)
  pressureOffsetInput: 'pressureOffset',// input: Pressure Offset %
  ruleOfThumbInput: 'ruleOfThumb',      // input: Rule of Thumb (CFM/TR)
  outdoorAirOverrideInput: 'outdoorAirOverride', // input: ACH Override

  measuredAirflowInput: 'measuredAirflow',
  measuredPressureInput: 'measuredPressure',
  measuredTempInput: 'measuredTemp',
  measuredRhInput: 'measuredRh',

  // Areas to show results (اختياري)
  resultBox: 'resultBox',
  resultText: 'resultText'
};

/* ========= Helpers ========= */
function $(id) {
  return document.getElementById(id);
}
function setText(el, text) {
  if (el) el.textContent = text;
}
function setValue(el, val) {
  if (el) el.value = val;
}
function num(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}
function clearOptions(selectEl) {
  if (!selectEl) return;
  while (selectEl.options.length) selectEl.remove(0);
}
function addOption(selectEl, value, label) {
  if (!selectEl) return;
  const opt = document.createElement('option');
  opt.value = value;
  opt.textContent = label;
  selectEl.appendChild(opt);
}
function uiLang() {
  // لو موقعك عربي غالبًا html lang="ar"
  const lang = (document.documentElement.lang || '').toLowerCase();
  return lang.includes('ar') ? 'ar' : 'en';
}
function labelRoom(room, lang) {
  return lang === 'ar' ? (room.name_ar || room.name_en || room.id) : (room.name_en || room.name_ar || room.id);
}
function labelCategory(cat, lang) {
  return lang === 'ar' ? (cat.name_ar || cat.name_en || cat.id) : (cat.name_en || cat.name_ar || cat.id);
}

/* ========= Data ========= */
let DATA = null;
let currentCategoryId = null;
let currentRoomId = null;

/* ========= Load data.json ========= */
async function loadData() {
  // data.json لازم يكون في نفس مجلد index.html على GitHub Pages
  const res = await fetch('./data.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Failed to load data.json (${res.status})`);
  const json = await res.json();

  if (!json || !Array.isArray(json.categories)) {
    throw new Error('data.json structure invalid. Expected: { "categories": [ ... ] }');
  }
  return json;
}

/* ========= Populate UI ========= */
function populateCategories() {
  const lang = uiLang();
  const catSelect = $(IDS.categorySelect);
  clearOptions(catSelect);

  addOption(catSelect, '', lang === 'ar' ? 'اختر الاستخدام…' : 'Select category…');

  DATA.categories.forEach(cat => {
    addOption(catSelect, cat.id, labelCategory(cat, lang));
  });

  // اختر الافتراضي: hospital إذا موجود
  const defaultCat = DATA.categories.find(c => c.id === 'hospital') ? 'hospital' : (DATA.categories[0]?.id || '');
  setValue(catSelect, defaultCat);
  currentCategoryId = defaultCat;
}

function populateRooms(categoryId) {
  const lang = uiLang();
  const roomSelect = $(IDS.roomTypeSelect);
  clearOptions(roomSelect);

  addOption(roomSelect, '', lang === 'ar' ? 'اختر نوع الغرفة…' : 'Select room type…');

  const cat = DATA.categories.find(c => c.id === categoryId);
  if (!cat || !Array.isArray(cat.rooms)) return;

  cat.rooms.forEach(r => {
    addOption(roomSelect, r.id, labelRoom(r, lang));
  });

  // لا تختار غرفة تلقائيًا، خله المستخدم يختار
  setValue(roomSelect, '');
  currentRoomId = null;

  // امسح ACH override (اختياري)
  const achEl = $(IDS.outdoorAirOverrideInput);
  if (achEl) achEl.placeholder = lang === 'ar'
    ? 'اتركه فاضي للتطبيق المرجع'
    : 'Leave blank to use default';
}

function applyRoomDefaults(categoryId, roomId) {
  const cat = DATA.categories.find(c => c.id === categoryId);
  if (!cat) return;
  const room = (cat.rooms || []).find(r => r.id === roomId);
  if (!room) return;

  // Auto-fill ACH Override
  const achEl = $(IDS.outdoorAirOverrideInput);
  if (achEl) {
    // نحط الرقم مباشرة (تقدر تغيره)
    achEl.value = String(room.ach_default ?? '');
  }

  // ممكن نعرض ضغط الغرفة كتلميح (اختياري)
  const resultText = $(IDS.resultText);
  const lang = uiLang();
  if (resultText) {
    const press = room.pressurization || 'neutral';
    const pressAr = press === 'positive' ? 'موجب' : press === 'negative' ? 'سالب' : 'محايد';
    const pressEn = press === 'positive' ? 'Positive' : press === 'negative' ? 'Negative' : 'Neutral';

    setText(
      resultText,
      lang === 'ar'
        ? `تم اختيار: ${room.name_ar || room.name_en}. الضغط: ${pressAr}. تم تعبئة ACH = ${room.ach_default}.`
        : `Selected: ${room.name_en || room.name_ar}. Pressurization: ${pressEn}. ACH set to ${room.ach_default}.`
    );
  }
}

/* ========= Optional: basic calculation example (إذا عندك نتائج) =========
   ملاحظة: ما غيرت حاسباتك الأساسية لأنك ممكن عندك منطق خاص.
   لكن لو تبي أربطه بالنتائج الموجودة عندك، قلّي ايش IDs حق حقول النتيجة.
*/
function wireBasicRecalcHooks() {
  const inputs = [
    IDS.roomVolumeInput,
    IDS.pressureOffsetInput,
    IDS.ruleOfThumbInput,
    IDS.outdoorAirOverrideInput,
    IDS.measuredAirflowInput,
    IDS.measuredPressureInput,
    IDS.measuredTempInput,
    IDS.measuredRhInput
  ].map(id => $(id)).filter(Boolean);

  inputs.forEach(el => {
    el.addEventListener('input', () => {
      // مكان مناسب تنادي دوال حسابك الموجودة لو عندك
      // recalc();
    });
  });
}

/* ========= Event bindings ========= */
function bindEvents() {
  const catSelect = $(IDS.categorySelect);
  const roomSelect = $(IDS.roomTypeSelect);

  if (catSelect) {
    catSelect.addEventListener('change', (e) => {
      currentCategoryId = e.target.value;
      populateRooms(currentCategoryId);
    });
  }

  if (roomSelect) {
    roomSelect.addEventListener('change', (e) => {
      currentRoomId = e.target.value;
      if (currentCategoryId && currentRoomId) {
        applyRoomDefaults(currentCategoryId, currentRoomId);
      }
    });
  }

  wireBasicRecalcHooks();
}

/* ========= Init ========= */
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // تأكد العناصر موجودة
    const catEl = $(IDS.categorySelect);
    const roomEl = $(IDS.roomTypeSelect);
    if (!catEl || !roomEl) {
      console.warn('Missing categorySelect or roomTypeSelect in index.html');
    }

    DATA = await loadData();

    populateCategories();
    populateRooms(currentCategoryId);

    bindEvents();

    const box = $(IDS.resultBox);
    if (box) box.style.display = 'block';
  } catch (err) {
    console.error(err);
    const lang = uiLang();
    const msg = lang === 'ar'
      ? `خطأ: تأكد أن data.json موجود وبنفس المجلد. التفاصيل: ${err.message}`
      : `Error: Make sure data.json exists in the same folder. Details: ${err.message}`;

    alert(msg);
  }
});