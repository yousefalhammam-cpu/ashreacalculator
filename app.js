(async function(){
  const $ = (id)=>document.getElementById(id);

  const nf0 = new Intl.NumberFormat("en-US", {maximumFractionDigits:0});
  const nf2 = new Intl.NumberFormat("en-US", {maximumFractionDigits:2});
  const fmt0 = (n)=> (n==null || Number.isNaN(n)) ? "—" : nf0.format(n);
  const fmt2 = (n)=> (n==null || Number.isNaN(n)) ? "—" : nf2.format(n);

  function toNum(x){
    if (x===null || x===undefined) return null;
    if (typeof x === "number") return Number.isFinite(x) ? x : null;
    const s = String(x).trim();
    if (!s) return null;
    if (s.toLowerCase() === "optional") return null;
    const v = Number(s);
    return Number.isFinite(v) ? v : null;
  }

  async function loadRef(){
    // robust: some exports include NaN (invalid JSON) -> replace with null
    const resp = await fetch("data.json", { cache:"no-store" });
    const txt = await resp.text();
    const cleaned = txt.replace(/\bNaN\b/g, "null");
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  let ref = [];
  try{
    ref = await loadRef();
    $("statusTag").textContent = `Loaded: ${ref.length} room types`;
    $("statusTag").className = "tag";
  } catch(e){
    $("statusTag").textContent = "Error loading data.json";
    $("statusTag").className = "tag danger";
    console.error(e);
    return;
  }

  // Build dropdown: display (simple) + keep ASHRAE name for output.
  const options = ref.map((r, i)=>{
    const rt = (r["Room Type"] ?? "").toString().trim();
    const display = (r.displayName ?? rt).toString().trim() || rt || `Room ${i+1}`;
    const ashrae  = (r.ashraeName  ?? rt).toString().trim() || rt || display;
    return { i, display, ashrae };
  }).filter(o=>o.display);

  options.sort((a,b)=>a.display.localeCompare(b.display,"en"));

  $("roomType").innerHTML = options
    .map(o=>`<option value="${o.i}">${String(o.display).replace(/"/g,"&quot;")}</option>`)
    .join("");

  const rooms = []; // added rooms list

  function compute(row, inputs){
    const volumeM3 = inputs.volumeM3;
    const volFt3 = volumeM3 * 35.3147;

    const totalAch = toNum(row["Total ACH"]);
    const oaRaw = (row["Outdoor Air ACH"] ?? "").toString().trim();
    const oaRefNum = toNum(row["Outdoor Air ACH"]); // null if Optional/blank

    const pressure = (row["Pressure"] ?? "").toString().trim(); // P/N/blank
    const exhOut = (row["Exhaust to Outdoors"] ?? "").toString().trim();

    // OA Override
    const oaOverride = inputs.oaOverride; // number|null
    const hasOverride = oaOverride !== null && Number.isFinite(oaOverride) && oaOverride >= 0;

    let oaAch = null;
    let oaSource = "—";
    let oaTag = "";

    if (hasOverride){
      oaAch = oaOverride;
      oaSource = "Override";
      oaTag = "";
    } else if (oaRefNum !== null){
      oaAch = oaRefNum;
      oaSource = "Reference";
      oaTag = "";
    } else if (oaRaw.toLowerCase() === "optional"){
      oaAch = 0;
      oaSource = "Optional (assumed 0)";
      oaTag = "warn";
    } else {
      oaAch = null;
      oaSource = "Not specified";
      oaTag = "danger";
    }

    const totalCfm = (totalAch===null) ? null : (volFt3 * totalAch / 60.0);
    const oaCfm    = (oaAch===null) ? null : (volFt3 * oaAch / 60.0);

    // Exhaust estimate using offset
    const offset = inputs.offsetPct / 100.0;
    let exhCfm = null;
    if (totalCfm !== null){
      if (pressure.toUpperCase() === "P") exhCfm = totalCfm * (1 - offset);
      else if (pressure.toUpperCase() === "N") exhCfm = totalCfm * (1 + offset);
      else if (exhOut.toLowerCase() === "yes") exhCfm = totalCfm;
    }

    const tr = (totalCfm===null) ? null : (totalCfm / inputs.thumb);

    return {
      volFt3, totalAch, oaRaw, oaAch, oaSource, oaTag,
      pressure, exhOut,
      rh: (row["RH (%)"] ?? "").toString().trim(),
      tempC: (row["Temp (°C)"] ?? "").toString().trim(),
      totalCfm, oaCfm, exhCfm, tr
    };
  }

  function render(){
    $("countTag").textContent = `Rooms: ${rooms.length}`;
    const list = $("list");
    const empty = $("emptyState");
    empty.style.display = rooms.length ? "none" : "block";

    list.innerHTML = rooms.map((r, idx)=>{
      const tagHtml = r.calc.oaTag
        ? `<span class="tag ${r.calc.oaTag}">Outdoor Air: ${r.calc.oaSource}</span>`
        : `<span class="tag">Outdoor Air: ${r.calc.oaSource}</span>`;

      return `
        <div class="roomCard">
          <div class="roomHead">
            <div>
              <h3>${r.roomName ? `${r.roomName} — ` : ""}${r.display}</h3>
              <div class="sub">ASHRAE Reference: <b>${r.ashrae}</b></div>
            </div>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              ${tagHtml}
              <button class="btn danger" data-del="${idx}" style="width:auto; padding:8px 10px;">حذف</button>
            </div>
          </div>

          <div class="sub" style="margin-top:8px;">
            Volume: <b>${fmt2(r.volumeM3)}</b> m³ — Offset: <b>${fmt2(r.offsetPct)}</b>% — Thumb: <b>${r.thumb}</b>
          </div>

          <div class="metrics">
            <div class="metric"><div class="k">Total ACH</div><div class="v">${r.calc.totalAch ?? "—"}</div></div>
            <div class="metric"><div class="k">Outdoor ACH (Ref)</div><div class="v">${r.calc.oaRaw || "—"}</div></div>
            <div class="metric"><div class="k">Supply (CFM)</div><div class="v">${fmt0(r.calc.totalCfm)}</div></div>
            <div class="metric"><div class="k">Outdoor (CFM)</div><div class="v">${fmt0(r.calc.oaCfm)}</div></div>

            <div class="metric"><div class="k">Exhaust (CFM)</div><div class="v">${fmt0(r.calc.exhCfm)}</div></div>
            <div class="metric"><div class="k">TR (est)</div><div class="v">${fmt2(r.calc.tr)}</div></div>
            <div class="metric"><div class="k">Pressure (P/N)</div><div class="v">${r.calc.pressure || "—"}</div></div>
            <div class="metric"><div class="k">Temp/RH</div><div class="v">${(r.calc.tempC||"—")}/${(r.calc.rh||"—")}</div></div>
          </div>
        </div>
      `;
    }).join("");

    list.querySelectorAll("[data-del]").forEach(btn=>{
      btn.addEventListener("click", ()=>{
        const i = Number(btn.getAttribute("data-del"));
        rooms.splice(i, 1);
        render();
        renderSummary();
      });
    });

    renderSummary();
  }

  function renderSummary(){
    let sumSupply=0, sumOA=0, sumExh=0, sumTR=0;
    let hasSupply=false, hasOA=false, hasExh=false, hasTR=false;

    rooms.forEach(r=>{
      const c = r.calc;
      if (Number.isFinite(c.totalCfm)) { sumSupply += c.totalCfm; hasSupply = true; }
      if (Number.isFinite(c.oaCfm)) { sumOA += c.oaCfm; hasOA = true; }
      if (Number.isFinite(c.exhCfm)) { sumExh += c.exhCfm; hasExh = true; }
      if (Number.isFinite(c.tr)) { sumTR += c.tr; hasTR = true; }
    });

    $("sumSupply").textContent = hasSupply ? fmt0(sumSupply) : "—";
    $("sumOA").textContent     = hasOA ? fmt0(sumOA) : "—";
    $("sumExh").textContent    = hasExh ? fmt0(sumExh) : "—";
    $("sumTR").textContent     = hasTR ? fmt2(sumTR) : "—";
  }

  function addRoom(){
    const idx = Number($("roomType").value);
    const row = ref[idx];
    const opt = options.find(o=>o.i===idx);

    const volumeM3 = Number($("volumeM3").value || 0);
    if (!Number.isFinite(volumeM3) || volumeM3 <= 0){
      alert("اكتب حجم صحيح بالمتر المكعب (m³).");
      return;
    }

    const roomName = ($("roomName").value || "").trim();
    const offsetPct = Number($("offsetPct").value || 0);
    const thumb = Number($("thumb").value || 400);

    const oaOverrideStr = ($("oaOverride").value || "").trim();
    const oaOverride = oaOverrideStr === "" ? null : Number(oaOverrideStr);

    const inputs = { volumeM3, offsetPct, thumb, oaOverride };
    const calc = compute(row, inputs);

    rooms.push({
      roomName,
      idx,
      display: opt?.display || "—",
      ashrae: opt?.ashrae || "—",
      volumeM3,
      offsetPct,
      thumb,
      oaOverride,
      calc
    });

    $("roomName").value = "";
    $("oaOverride").value = "";

    render();
  }

  function exportExcelCsv(){
    const header = [
      "Room Name",
      "Display Name",
      "ASHRAE Reference",
      "Volume (m3)",
      "Volume (ft3)",
      "Total ACH",
      "Outdoor Air ACH (Ref)",
      "Outdoor Air Source",
      "OA Override (ACH)",
      "Supply (CFM)",
      "Outdoor (CFM)",
      "Exhaust (CFM)",
      "TR (est)",
      "Pressure (P/N)",
      "Exhaust to Outdoors",
      "Temp (°C)",
      "RH (%)",
      "Offset (%)",
      "Rule of Thumb (CFM/TR)"
    ];

    const rows = rooms.map(r=>{
      const c = r.calc;
      const safe = (v)=>`"${String(v ?? "").replace(/"/g,'""')}"`;
      return [
        r.roomName,
        r.display,
        r.ashrae,
        r.volumeM3,
        c.volFt3,
        c.totalAch ?? "",
        c.oaRaw || "",
        c.oaSource,
        r.oaOverride ?? "",
        c.totalCfm,
        c.oaCfm,
        c.exhCfm,
        c.tr,
        c.pressure || "",
        c.exhOut || "",
        c.tempC || "",
        c.rh || "",
        r.offsetPct,
        r.thumb
      ].map(safe).join(",");
    });

    const csv = [header.map(h=>`"${h}"`).join(","), ...rows].join("\n");
    const bom = "\uFEFF"; // UTF-8 BOM for Arabic
    const blob = new Blob([bom + csv], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "ASHRAE170P_Rooms.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function clearAll(){
    rooms.length = 0;
    render();
    renderSummary();
  }

  $("addBtn").addEventListener("click", addRoom);
  $("exportBtn").addEventListener("click", exportExcelCsv);
  $("clearBtn").addEventListener("click", clearAll);

  render();

  if ("serviceWorker" in navigator){
    try { await navigator.serviceWorker.register("sw.js"); } catch(e){ /* ignore */ }
  }
})();


