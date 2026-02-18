/* Air Calc Pro — app.js
   - Loads data.json safely (GitHub Pages friendly)
   - Bottom tabs
   - Add multiple rooms, calculate Supply/Exhaust/TR
   - Rooms list + search
   - Export CSV
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
  // using your sign convention (pressureOffset): >0 P, <0 N
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
  const INLINE_DATA = null; // keep null because we ship a real data.json
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
      const data = parsed;

      if (data?.categories?.length){
        $("statusTag").textContent = `Loaded: ${data.categories.reduce((a,c)=>a+(c.items?.length||0),0)} rooms`;
        return data;
      }
    }catch(e){
      lastErr = e;
    }
  }

  console.warn("data.json failed. Last error:", lastErr);
  $("statusTag").textContent = "Error loading data.json";
  if (INLINE_DATA) return INLINE_DATA;

  // minimal emergency fallback
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

  // group by categories
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
    $("roomMeta").textContent = "—";
    return;
  }
  const ach = safeAch(it);
  const pn = getPN(it);
  $("roomMeta").innerHTML = `
    <span class="mono">ASHRAE Ref:</span> ${it.label_en || "—"} •
    <span class="mono">Total ACH:</span> ${ach ?? "N/A"} •
    <span class="mono">Pressure:</span> ${pn}
  `;

  // update ASHRAE tab preview too
  $("refRoomName").textContent = it.label_ar || "—";
  $("refRoomEn").textContent = it.label_en || "—";
  $("refAch").textContent = (ach ?? "N/A");
  $("refPN").textContent = pn;
}

function calcRoom(it, vol_m3, offsetPct, thumb){
  const ach = safeAch(it);
  if (ach === null){
    return { ok:false, message:"قيمة ACH غير متوفرة لهذا النوع في data.json" };
  }
  const supply = ach_to_cfm(ach, vol_m3);

  // pressure logic:
  // if Negative (N) -> Exhaust > Supply
  // if Positive (P) -> Exhaust < Supply
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
    const el = document.createElement("div");
    el.className = "item";
    el.innerHTML = `
      <div class="itemTop">
        <div>
          <div class="itemTitle">${r.roomNameAr}</div>
          <div class="itemSub">${r.roomNameEn} — <span class="mono">${r.catName}</span></div>
        </div>
        <button class="btn btnDanger" data-del="${idx}" style="width:auto; padding:9px 12px;">حذف</button>
      </div>

      <div class="kv3">
        <div class="k">
          <div class="kk">Volume</div>
          <div class="vv">${fmt(r.vol_m3,0)} <span class="uu">m³</span></div>
        </div>
        <div class="k">
          <div class="kk">Total ACH</div>
          <div class="vv">${fmt(r.ach,0)}</div>
        </div>
        <div class="k">
          <div class="kk">Pressure (P/N)</div>
          <div class="vv">${r.pn}</div>
        </div>
      </div>

      <div class="kv">
        <div class="k">
          <div class="kk">Supply</div>
          <div class="vv">${fmt(r.supply,0)} <span class="uu">CFM</span></div>
        </div>
        <div class="k">
          <div class="kk">Exhaust</div>
          <div class="vv">${fmt(r.exhaust,0)} <span class="uu">CFM</span></div>
        </div>
        <div class="k">
          <div class="kk">TR (est)</div>
          <div class="vv">${fmt(r.tr,2)} <span class="uu">TR</span></div>
        </div>
        <div class="k">
          <div class="kk">Offset / Thumb</div>
          <div class="vv">${fmt(r.offsetPct,0)}% <span class="uu">•</span> ${r.thumb}</div>
        </div>
      </div>
    `;
    box.appendChild(el);
  });

  // bind delete
  box.querySelectorAll("[data-del]").forEach(btn => {
    btn.addEventListener("click", () => {
      const i = Number(btn.getAttribute("data-del"));
      RESULTS.splice(i,1);
      renderResults();
      updateSums();
      $("calcHint").textContent = "تم الحذف.";
    });
  });

  if (RESULTS.length === 0){
    box.innerHTML = `<div class="muted">ما أضفت أي غرفة للحين.</div>`;
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
    return `
      <div class="item">
        <div class="itemTop">
          <div>
            <div class="itemTitle">${it.label_ar || it.label_en}</div>
            <div class="itemSub">${it.label_en || ""} — <span class="mono">${it.catName}</span></div>
          </div>
          <div class="pill mono">ACH: ${ach ?? "N/A"}</div>
        </div>
      </div>
    `;
  }).join("") || `<div class="muted">لا توجد نتائج.</div>`;
}

function exportCSV(){
  if (RESULTS.length === 0){
    $("exportHint").textContent = "ما فيه نتائج للتصدير.";
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
      // escape quotes/commas
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

  $("exportHint").textContent = "تم تنزيل ملف CSV. افتحه في Excel.";
}

/* Bottom tabs */
function setupTabs(){
  const navButtons = document.querySelectorAll(".navBtn");
  const pages = document.querySelectorAll(".tabPage");

  function openTab(id){
    pages.forEach(p => p.classList.toggle("active", p.id === id));
    navButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === id));
  }

  navButtons.forEach(btn => {
    btn.addEventListener("click", () => openTab(btn.dataset.tab));
  });

  openTab("tab-calc");
}

/* PWA SW */
function setupSW(){
  if ("serviceWorker" in navigator){
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
}

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
      $("calcHint").textContent = "اختر نوع الغرفة.";
      return;
    }
    if (vol === null || vol <= 0){
      $("calcHint").textContent = "أدخل حجم الغرفة m³ بشكل صحيح.";
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
    $("calcHint").textContent = "تمت الإضافة ✅";
  });

  $("btnExport").addEventListener("click", exportCSV);

  $("langSel").addEventListener("change", () => {
    const lang = $("langSel").value;
    document.documentElement.lang = lang === "en" ? "en" : "ar";
    document.documentElement.dir = lang === "en" ? "ltr" : "rtl";
  });

  $("pressureMode").addEventListener("change", () => {
    // recalculation only affects exhaust — re-render from stored values:
    const off = RESULTS.map(r => r.offsetPct);
    const thumb = RESULTS.map(r => r.thumb);
    // Recompute exhaust according to toggle
    RESULTS = RESULTS.map((r, i) => {
      const it = FLAT_ITEMS.find(x => x.id === r.id);
      const rec = calcRoom(it, r.vol_m3, off[i], thumb[i]);
      return rec.ok ? rec : r;
    });
    renderResults();
    updateSums();
  });

  // initial state
  $("exportHint").textContent = "أضف غرف ثم صدّر النتائج.";
  $("roomVol").value = "";
  renderResults();
  updateSums();
}

init();