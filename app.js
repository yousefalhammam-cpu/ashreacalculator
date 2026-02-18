/* Air Calc Pro — app.js
   Updates:
   - Removed ASHRAE tab dependency
   - Bottom nav order: Calc / Rooms / Export / Contact / Settings
   - Language toggle now updates bottom nav + UI text (RTL/LTR)
*/

let REF_DATA = null;
let FLAT_ITEMS = [];
let RESULTS = [];

const $ = (id) => document.getElementById(id);

function num(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// m³ → ft³
function m3_to_ft3(m3){ return m3 * 35.3146667; }

// ACH + volume → CFM
function ach_to_cfm(ach, vol_m3){
  const ft3 = m3_to_ft3(vol_m3);
  return (ach * ft3) / 60;
}

function fmt(x, d=0){
  if (!Number.isFinite(x)) return "—";
  return x.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: d });
}

function getPN(item){
  const po = num(item?.pressureOffset);
  if (po === null) return "—";
  if (po > 0) return "P";
  if (po < 0) return "N";
  return "N";
}

function safeAch(item){
  const a = num(item?.ach);
  return (a !== null && a > 0) ? a : null;
}

async function loadRef(){
  const bust = (u)=> u + (u.includes("?") ? "&" : "?") + "v=" + Date.now();

  const basePath = window.location.pathname.endsWith("/")
    ? window.location.pathname
    : window.location.pathname.replace(/\/[^\/]*$/, "/");

  const tries = [
    new URL("data.json", window.location.href).toString(),
    window.location.origin + basePath + "data.json",
    "./data.json"
  ];

  let lastErr = null;
  for (const url of tries){
    try{
      const resp = await fetch(bust(url), { cache:"no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const txt = await resp.text();
      const cleaned = txt.replace(/\bNaN\b/g, "null");
      const parsed = JSON.parse(cleaned);

      if (parsed?.categories?.length){
        const count = parsed.categories.reduce((a,c)=>a+(c.items?.length||0),0);
        const st = $("statusTag");
        if (st) st.textContent = `Loaded: ${count} rooms`;
        return parsed;
      }
    }catch(e){
      lastErr = e;
    }
  }

  console.warn("data.json failed. Last error:", lastErr);
  const st = $("statusTag");
  if (st) st.textContent = "Error loading data.json";

  return { version: 2, categories: [
    { name:"Fallback", items:[
      { id:"patient_room", label_ar:"غرفة مريض", label_en:"Patient Room", ach:6, pressureOffset:0 },
      { id:"or", label_ar:"غرفة عمليات", label_en:"Operating Room", ach:20, pressureOffset:5 }
    ]}
  ]};
}

function flattenData(data){
  const flat = [];
  for (const cat of (data.categories || [])){
    for (const it of (cat.items || [])){
      flat.push({ ...it, catName: cat.name });
    }
  }
  return flat;
}

function buildRoomSelect(){
  const sel = $("roomType");
  sel.innerHTML = "";

  for (const cat of (REF_DATA.categories || [])){
    const og = document.createElement("optgroup");
    og.label = cat.name;
    for (const it of (cat.items || [])){
      const opt = document.createElement("option");
      opt.value = it.id;
      opt.textContent = `${it.label_ar || it.label_en} — ${it.label_en || ""}`.trim();
      og.appendChild(opt);
    }
    sel.appendChild(og);
  }

  sel.addEventListener("change", updateSelectedMeta);
  updateSelectedMeta();
}

function getSelectedItem(){
  const id = $("roomType").value;
  return FLAT_ITEMS.find(x => x.id === id) || null;
}

function updateSelectedMeta(){
  const it = getSelectedItem();
  if (!it){
    const m = $("roomMeta");
    if (m) m.textContent = "—";
    return;
  }
  const ach = safeAch(it);
  const pn = getPN(it);

  const m = $("roomMeta");
  if (m){
    m.innerHTML = `
      <span class="mono">Ref:</span> ${it.label_en || "—"} •
      <span class="mono">Total ACH:</span> ${ach ?? "N/A"} •
      <span class="mono">Pressure:</span> ${pn}
    `;
  }
}

function calcRoom(it, vol_m3, offsetPct, thumb){
  const ach = safeAch(it);
  if (ach === null){
    return { ok:false, message: I18N.current === "en"
      ? "ACH is not available for this room type in data.json"
      : "قيمة ACH غير متوفرة لهذا النوع في data.json"
    };
  }
  const supply = ach_to_cfm(ach, vol_m3);

  const pn = getPN(it);
  let exhaust = supply;
  const off = Math.abs(offsetPct) / 100;

  const pressureMode = $("pressureMode")?.value || "on";
  if (pressureMode === "on"){
    if (pn === "N") exhaust = supply * (1 + off);
    else if (pn === "P") exhaust = supply * (1 - off);
    else exhaust = supply;
  }

  const tr = supply / thumb;

  return {
    ok:true,
    roomNameAr: it.label_ar || it.label_en || it.id,
    roomNameEn: it.label_en || "",
    catName: it.catName || "",
    id: it.id,
    vol_m3,
    ach,
    pn,
    offsetPct,
    thumb,
    supply,
    exhaust,
    tr
  };
}

function renderResults(){
  const box = $("resultsList");
  box.innerHTML = "";

  RESULTS.forEach((r, idx) => {
    const delTxt = I18N.current === "en" ? "Delete" : "حذف";
    const volumeTxt = I18N.current === "en" ? "Volume" : "Volume";
    const totalAchTxt = I18N.current === "en" ? "Total ACH" : "Total ACH";
    const pressureTxt = I18N.current === "en" ? "Pressure (P/N)" : "Pressure (P/N)";
    const supplyTxt = I18N.current === "en" ? "Supply" : "Supply";
    const exhaustTxt = I18N.current === "en" ? "Exhaust" : "Exhaust";
    const trTxt = I18N.current === "en" ? "TR (est)" : "TR (est)";
    const offThumbTxt = I18N.current === "en" ? "Offset / Thumb" : "Offset / Thumb";

    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemTitle">${I18N.current === "en" ? (r.roomNameEn || r.roomNameAr) : r.roomNameAr}</div>
          <div class="itemSub">${r.roomNameEn ? r.roomNameEn + " — " : ""}<span class="mono">${r.catName}</span></div>
        </div>
        <button class="btn btnDanger" data-del="${idx}" style="width:auto; padding:9px 12px;">${delTxt}</button>
      </div>

      <div class="kv3">
        <div class="k">
          <div class="kk">${volumeTxt}</div>
          <div class="vv">${fmt(r.vol_m3,0)} <span class="uu">m³</span></div>
        </div>
        <div class="k">
          <div class="kk">${totalAchTxt}</div>
          <div class="vv">${fmt(r.ach,0)}</div>
        </div>
        <div class="k">
          <div class="kk">${pressureTxt}</div>
          <div class="vv">${r.pn}</div>
        </div>
      </div>

      <div class="kv">
        <div class="k">
          <div class="kk">${supplyTxt}</div>
          <div class="vv">${fmt(r.supply,0)} <span class="uu">CFM</span></div>
        </div>
        <div class="k">
          <div class="kk">${exhaustTxt}</div>
          <div class="vv">${fmt(r.exhaust,0)} <span class="uu">CFM</span></div>
        </div>
        <div class="k">
          <div class="kk">${trTxt}</div>
          <div class="vv">${fmt(r.tr,2)} <span class="uu">TR</span></div>
        </div>
        <div class="k">
          <div class="kk">${offThumbTxt}</div>
          <div class="vv">${fmt(r.offsetPct,0)}% <span class="uu">•</span> ${r.thumb}</div>
        </div>
      </div>
    `;
    box.appendChild(el);
  });

  box.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-del"));
      RESULTS.splice(i,1);
      renderResults();
      updateSums();
      $("calcHint").textContent = I18N.current === "en" ? "Deleted." : "تم الحذف.";
    });
  });

  if (RESULTS.length === 0){
    box.innerHTML = `<div class="muted">${I18N.current === "en" ? "No rooms added yet." : "ما أضفت أي غرفة للحين."}</div>`;
  }
}

function updateSums(){
  const sumS = RESULTS.reduce((a,r)=>a + (r.supply||0), 0);
  const sumE = RESULTS.reduce((a,r)=>a + (r.exhaust||0), 0);
  const sumT = RESULTS.reduce((a,r)=>a + (r.tr||0), 0);

  $("sumSupply").textContent = fmt(sumS,0);
  $("sumExh").textContent = fmt(sumE,0);
  $("sumTR").textContent = fmt(sumT,2);
}

function renderRoomsList(){
  const box = $("roomsList");
  const q = ($("roomSearch")?.value || "").trim().toLowerCase();

  const filtered = FLAT_ITEMS.filter(it => {
    const a = (it.label_ar || "").toLowerCase();
    const e = (it.label_en || "").toLowerCase();
    const id = (it.id || "").toLowerCase();
    return !q || a.includes(q) || e.includes(q) || id.includes(q);
  });

  box.innerHTML = filtered.map(it => {
    const ach = safeAch(it);
    const title = (I18N.current === "en") ? (it.label_en || it.label_ar) : (it.label_ar || it.label_en);
    const sub = (it.label_en && I18N.current !== "en") ? it.label_en + " — " : "";
    return `
      <div class="item">
        <div class="itemTop">
          <div>
            <div class="itemTitle">${title}</div>
            <div class="itemSub">${sub}<span class="mono">${it.catName}</span></div>
          </div>
          <div class="pill mono">ACH: ${ach ?? "N/A"}</div>
        </div>
      </div>
    `;
  }).join("") || `<div class="muted">${I18N.current === "en" ? "No results." : "لا توجد نتائج."}</div>`;
}

function exportCSV(){
  if (RESULTS.length === 0){
    $("exportHint").textContent = I18N.current === "en" ? "No results to export." : "ما فيه نتائج للتصدير.";
    return;
  }

  const headers = [
    "Room_AR","Room_EN","Category","ID",
    "Volume_m3","ACH","Pressure_PN",
    "OffsetPct","Thumb_CFMperTR",
    "Supply_CFM","Exhaust_CFM","TR_est"
  ];

  const rows = RESULTS.map(r => ([
    r.roomNameAr, r.roomNameEn, r.catName, r.id,
    r.vol_m3, r.ach, r.pn,
    r.offsetPct, r.thumb,
    Math.round(r.supply), Math.round(r.exhaust), r.tr.toFixed(2)
  ]));

  const csv = [
    headers.join(","),
    ...rows.map(row => row.map(v => {
      const s = String(v ?? "");
      if (s.includes(",") || s.includes('"') || s.includes("\n")){
        return `"${s.replace(/"/g,'""')}"`;
      }
      return s;
    }).join(","))
  ].join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = `AirCalcPro_Results_${new Date().toISOString().slice(0,10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  $("exportHint").textContent = I18N.current === "en"
    ? "CSV downloaded. Open it in Excel."
    : "تم تنزيل ملف CSV. افتحه في Excel.";
}

/* Bottom tabs */
function setupTabs(){
  const navButtons = document.querySelectorAll(".navBtn");
  const pages = document.querySelectorAll(".tabPage");

  function openTab(id){
    pages.forEach(p => p.classList.toggle("active", p.id === id));
    navButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === id));
  }

  navButtons.forEach(btn => btn.addEventListener("click", () => openTab(btn.dataset.tab)));
  openTab("tab-calc");
}

/* PWA SW */
function setupSW(){
  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
}

/* ===== i18n (language) ===== */
const I18N = {
  current: "ar",
  nav: {
    ar: { calc:"الحاسبة", rooms:"الغرف", export:"تصدير", contact:"تواصل", settings:"إعدادات" },
    en: { calc:"Calculator", rooms:"Rooms", export:"Export", contact:"Contact", settings:"Settings" }
  },
  ui: {
    ar: {
      calcHintReady: "جاهز.",
      addOk: "تمت الإضافة ✅",
      needType: "اختر نوع الغرفة.",
      needVol: "أدخل حجم الغرفة m³ بشكل صحيح.",
      exportInit: "أضف غرف ثم صدّر النتائج."
    },
    en: {
      calcHintReady: "Ready.",
      addOk: "Added ✅",
      needType: "Select a room type.",
      needVol: "Enter a valid room volume (m³).",
      exportInit: "Add rooms then export results."
    }
  },
  textNodes: {
    ar: {
      calc_title:"الحاسبة",
      calc_hint:"اختر نوع الغرفة + أدخل حجم الغرفة (m³) ثم اضغط “إضافة غرفة”. النتائج تتراكم تحت.",
      room_type_lbl:"نوع الغرفة",
      vol_lbl:"حجم الغرفة (m³)",
      offset_lbl:"Offset % (فرق الضغط للحساب)",
      thumb_lbl:"Rule of Thumb (CFM/ton)",
      add_btn:"إضافة غرفة",
      sum_supply:"إجمالي Supply",
      sum_exh:"إجمالي Exhaust",
      sum_tr:"إجمالي تقديري TR",
      rooms_title:"قائمة الغرف",
      rooms_hint:"ابحث بسرعة وتأكد من ACH لكل غرفة.",
      search_lbl:"بحث",
      export_title:"تصدير النتائج",
      export_hint:"تصدير CSV (يفتح مباشرة في Excel).",
      export_btn:"تصدير CSV",
      contact_title:"تواصل معنا",
      contact_name_lbl:"الاسم",
      contact_email_lbl:"الإيميل",
      contact_phone_lbl:"رقم الجوال",
      contact_note:"للإقتراحات أو تطوير المعايير داخل التطبيق تواصل معي.",
      settings_title:"إعدادات",
      settings_hint:"إعدادات بسيطة للعرض.",
      lang_lbl:"اللغة",
      pressure_mode_lbl:"إظهار الضغط Offset",
      on_opt:"تشغيل",
      off_opt:"إيقاف",
      tip_lbl:"نصيحة",
      tip_txt:"إذا عدلت data.json على GitHub: لازم تحدث الصفحة (Refresh) أو امسح كاش المتصفح/التطبيق."
    },
    en: {
      calc_title:"Calculator",
      calc_hint:"Choose room type + enter room volume (m³), then tap “Add Room”. Results will stack below.",
      room_type_lbl:"Room Type",
      vol_lbl:"Room Volume (m³)",
      offset_lbl:"Offset % (pressure calc)",
      thumb_lbl:"Rule of Thumb (CFM/ton)",
      add_btn:"Add Room",
      sum_supply:"Total Supply",
      sum_exh:"Total Exhaust",
      sum_tr:"Total Estimated TR",
      rooms_title:"Rooms",
      rooms_hint:"Quick search and view ACH per room.",
      search_lbl:"Search",
      export_title:"Export",
      export_hint:"Export CSV (opens in Excel).",
      export_btn:"Export CSV",
      contact_title:"Contact",
      contact_name_lbl:"Name",
      contact_email_lbl:"Email",
      contact_phone_lbl:"Phone",
      contact_note:"For suggestions or standards updates, contact me.",
      settings_title:"Settings",
      settings_hint:"Simple display settings.",
      lang_lbl:"Language",
      pressure_mode_lbl:"Pressure Offset Mode",
      on_opt:"On",
      off_opt:"Off",
      tip_lbl:"Tip",
      tip_txt:"If you edited data.json on GitHub: refresh the page or clear cache."
    }
  }
};

function applyLanguage(lang){
  I18N.current = (lang === "en") ? "en" : "ar";

  // html lang/dir
  document.documentElement.lang = I18N.current;
  document.documentElement.dir = (I18N.current === "en") ? "ltr" : "rtl";

  // bottom nav labels
  document.querySelectorAll("[data-navkey]").forEach(el => {
    const key = el.getAttribute("data-navkey");
    el.textContent = I18N.nav[I18N.current][key] || el.textContent;
  });

  // static text (data-i18n)
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    const t = I18N.textNodes[I18N.current][key];
    if (t) el.textContent = t;
  });

  // placeholders
  const vol = $("roomVol");
  if (vol) vol.placeholder = (I18N.current === "en") ? "e.g. 120" : "مثال: 120";

  const search = $("roomSearch");
  if (search) search.placeholder = (I18N.current === "en") ? "e.g. lab / OR / patient ..." : "مثال: مختبر / OR / Patient ...";

  // hints
  $("calcHint").textContent = I18N.ui[I18N.current].calcHintReady;
  $("exportHint").textContent = I18N.ui[I18N.current].exportInit;

  // rerender lists in correct language
  renderRoomsList();
  renderResults();
}

/* ===== init ===== */
async function init(){
  setupTabs();
  setupSW();

  REF_DATA = await loadRef();
  FLAT_ITEMS = flattenData(REF_DATA);

  buildRoomSelect();
  renderRoomsList();

  $("roomSearch").addEventListener("input", renderRoomsList);

  $("btnAdd").addEventListener("click", () => {
    const it = getSelectedItem();
    const vol = num($("roomVol").value);
    const off = num($("offsetPct").value) ?? 0;
    const thumb = num($("thumb").value) ?? 400;

    if (!it){
      $("calcHint").textContent = I18N.ui[I18N.current].needType;
      return;
    }
    if (vol === null || vol <= 0){
      $("calcHint").textContent = I18N.ui[I18N.current].needVol;
      return;
    }

    const res = calcRoom(it, vol, off, thumb);
    if (!res.ok){
      $("calcHint").textContent = res.message;
      return;
    }

    RESULTS.unshift(res);
    renderResults();
    updateSums();
    $("calcHint").textContent = I18N.ui[I18N.current].addOk;
  });

  $("btnExport").addEventListener("click", exportCSV);

  $("pressureMode").addEventListener("change", () => {
    const offs = RESULTS.map(r => r.offsetPct);
    const thumbs = RESULTS.map(r => r.thumb);

    RESULTS = RESULTS.map((r, i) => {
      const it = FLAT_ITEMS.find(x => x.id === r.id);
      const rec = calcRoom(it, r.vol_m3, offs[i], thumbs[i]);
      return rec.ok ? rec : r;
    });

    renderResults();
    updateSums();
  });

  // language (fix for bottom nav)
  $("langSel").addEventListener("change", () => applyLanguage($("langSel").value));

  // default
  $("roomVol").value = "";
  renderResults();
  updateSums();

  // apply initial language from select
  applyLanguage($("langSel").value);
}

init();