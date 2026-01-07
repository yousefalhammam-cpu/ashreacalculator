(async function(){
  const $ = (id)=>document.getElementById(id);

  const nf0 = new Intl.NumberFormat("en-US", {maximumFractionDigits:0});
  const nf2 = new Intl.NumberFormat("en-US", {maximumFractionDigits:2});
  const format0 = (n)=> (n==null || Number.isNaN(n)) ? "—" : nf0.format(n);
  const format2 = (n)=> (n==null || Number.isNaN(n)) ? "—" : nf2.format(n);

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
    // robust: replace NaN with null
    const resp = await fetch("data.json", { cache: "no-store" });
    const txt = await resp.text();
    const cleaned = txt.replace(/\bNaN\b/g, "null");
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  let ref = [];
  try{
    ref = await loadRef();
    $("statusTag").textContent = `Loaded: ${ref.length} rooms`;
    $("statusTag").className = "tag";
  } catch(e){
    $("statusTag").textContent = "Error loading data.json";
    $("statusTag").className = "tag danger";
    console.error(e);
    return;
  }

  // Build selectable list (Display + ASHRAE)
  // If displayName/ashraeName not present -> use "Room Type"
  const options = ref
    .map((r, i) => {
      const roomType = (r["Room Type"] ?? "").toString().trim();
      const display = (r.displayName ?? roomType).toString().trim();
      const ashrae  = (r.ashraeName  ?? roomType).toString().trim();
      return { i, display, ashrae };
    })
    .filter(x => x.display);

  options.sort((a,b)=>a.display.localeCompare(b.display, "en"));

  function buildRoomTypeSelect(selectedIdx){
    const safe = (s)=>String(s).replace(/"/g, "&quot;");
    return `
      <select class="rtSel">
        ${options.map(o => `<option value="${o.i}" ${Number(selectedIdx)===o.i ? "selected":""}>${safe(o.display)}</option>`).join("")}
      </select>
    `;
  }

  function cellInput(cls, value, placeholder="", readonly=false, type="text"){
    const ro = readonly ? "readonly" : "";
    const v = value==null ? "" : String(value);
    return `<input class="${cls}" type="${type}" ${ro} value="${v}" placeholder="${placeholder}">`;
  }

  function cellText(cls, text){
    const t = (text==null || String(text).trim()==="") ? "—" : String(text).trim();
    return `<input class="${cls}" type="text" readonly value="${t}">`;
  }

  const rowsBody = $("rowsBody");

  function defaultRowModel(){
    // match your Excel-like inputs
    return {
      roomName: "",
      refIdx: options[0]?.i ?? 0,
      volumeM3: 60,
      oaOverride: "",          // optional ACH
      offsetPct: 10,
      thumb: 400
    };
  }

  function addRow(model){
    const m = model || defaultRowModel();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${cellInput("roomName", m.roomName, "مثال: OR-01")}</td>

      <td>${buildRoomTypeSelect(m.refIdx)}</td>
      <td>${cellText("ashraeRef", "")}</td>

      <td>${cellInput("volM3", m.volumeM3, "m³", false, "number")}</td>

      <td>${cellText("oaAchRaw", "")}</td>
      <td>${cellInput("oaOverride", m.oaOverride, "اختياري", false, "number")}</td>

      <td>${cellText("totalAch", "")}</td>
      <td>${cellText("pressurePN", "")}</td>
      <td>${cellText("exhOut", "")}</td>

      <td>${cellText("rh", "")}</td>
      <td>${cellText("tempC", "")}</td>

      <td>${cellInput("offset", m.offsetPct, "%", false, "number")}</td>
      <td>
        <select class="thumb">
          <option value="350" ${Number(m.thumb)===350?"selected":""}>350</option>
          <option value="400" ${Number(m.thumb)===400?"selected":""}>400</option>
          <option value="450" ${Number(m.thumb)===450?"selected":""}>450</option>
        </select>
      </td>

      <td>${cellText("volFt3", "")}</td>
      <td>${cellText("oaCfm", "")}</td>
      <td>${cellText("supplyCfm", "")}</td>
      <td>${cellText("exhCfm", "")}</td>
      <td>${cellText("tr", "")}</td>

      <td><button class="btn danger delBtn" type="button">حذف</button></td>
    `;

    rowsBody.appendChild(tr);

    // events
    tr.querySelector(".delBtn").addEventListener("click", ()=>{
      tr.remove();
      recalcAll();
    });

    const recalcOn = ["change","input"];
    ["rtSel","volM3","oaOverride","offset","thumb","roomName"].forEach(cls=>{
      const el = tr.querySelector("."+cls);
      if (!el) return;
      recalcOn.forEach(ev => el.addEventListener(ev, ()=>{ recalcRow(tr); recalcSummary(); }));
    });

    recalcRow(tr);
    recalcSummary();
  }

  function getRefRow(idx){
    const r = ref[Number(idx)];
    return r || null;
  }

  function recalcRow(tr){
    const idx = Number(tr.querySelector(".rtSel").value);
    const r = getRefRow(idx);
    if (!r) return;

    const roomType = (r["Room Type"] ?? "").toString().trim();
    const display = (r.displayName ?? roomType).toString().trim();
    const ashrae  = (r.ashraeName  ?? roomType).toString().trim();

    const volM3 = Number(tr.querySelector(".volM3").value || 0);
    const volFt3 = volM3 * 35.3147;

    const totalAch = toNum(r["Total ACH"]);
    const oaRaw = (r["Outdoor Air ACH"] ?? "").toString().trim();
    const oaRefNum = toNum(r["Outdoor Air ACH"]); // null if Optional/blank

    const pressure = (r["Pressure"] ?? "").toString().trim();
    const exhOut = (r["Exhaust to Outdoors"] ?? "").toString().trim();
    const rh = (r["RH (%)"] ?? "").toString().trim();
    const tempC = (r["Temp (°C)"] ?? "").toString().trim();

    // OA Override (professional)
    const oaOverrideStr = (tr.querySelector(".oaOverride").value ?? "").toString().trim();
    const oaOverrideVal = oaOverrideStr === "" ? null : Number(oaOverrideStr);
    const hasOverride = oaOverrideVal !== null && Number.isFinite(oaOverrideVal) && oaOverrideVal >= 0;

    let oaAch = null;
    let oaNote = "";
    if (hasOverride){
      oaAch = oaOverrideVal;
      oaNote = "Override";
    } else if (oaRefNum !== null){
      oaAch = oaRefNum;
      oaNote = "Ref";
    } else if (oaRaw.toLowerCase() === "optional"){
      oaAch = 0;
      oaNote = "Optional→0";
    } else {
      oaAch = null; // Not specified
      oaNote = "Not specified";
    }

    const supplyCfm = (totalAch===null) ? null : (volFt3 * totalAch / 60.0);
    const oaCfm = (oaAch===null) ? null : (volFt3 * oaAch / 60.0);

    const offsetPct = Number(tr.querySelector(".offset").value || 0) / 100.0;
    const thumb = Number(tr.querySelector(".thumb").value || 400);

    const trEst = (supplyCfm===null) ? null : (supplyCfm / thumb);

    // Exhaust estimate
    let exhCfm = null;
    if (supplyCfm !== null){
      if (pressure.toUpperCase() === "P") exhCfm = supplyCfm * (1 - offsetPct);
      else if (pressure.toUpperCase() === "N") exhCfm = supplyCfm * (1 + offsetPct);
      else if (exhOut.toLowerCase() === "yes") exhCfm = supplyCfm;
    }

    // Fill readonly cells
    tr.querySelector(".ashraeRef").value = ashrae || display || "—";
    tr.querySelector(".oaAchRaw").value = oaRaw ? `${oaRaw}${oaNote ? " ("+oaNote+")":""}` : (oaNote==="Not specified" ? "— (Not specified)" : "—");
    tr.querySelector(".totalAch").value = (totalAch===null) ? "—" : String(totalAch);
    tr.querySelector(".pressurePN").value = pressure || "—";
    tr.querySelector(".exhOut").value = exhOut || "—";
    tr.querySelector(".rh").value = rh || "—";
    tr.querySelector(".tempC").value = tempC || "—";

    tr.querySelector(".volFt3").value = format0(volFt3);
    tr.querySelector(".oaCfm").value = format0(oaCfm);
    tr.querySelector(".supplyCfm").value = format0(supplyCfm);
    tr.querySelector(".exhCfm").value = format0(exhCfm);
    tr.querySelector(".tr").value = format2(trEst);

    // store hidden metadata for export
    tr.dataset.displayName = display;
    tr.dataset.ashraeName = ashrae;
    tr.dataset.oaAch = (oaAch===null) ? "" : String(oaAch);
    tr.dataset.totalAch = (totalAch===null) ? "" : String(totalAch);
  }

  function recalcSummary(){
    const trs = Array.from(rowsBody.querySelectorAll("tr"));
    $("sumRooms").textContent = String(trs.length);

    let sumSupply=0, sumOA=0, sumExh=0, sumTR=0;
    let hasSupply=false, hasOA=false, hasExh=false, hasTR=false;

    trs.forEach(tr=>{
      const supply = Number(String(tr.querySelector(".supplyCfm").value).replace(/,/g,""));
      const oa = Number(String(tr.querySelector(".oaCfm").value).replace(/,/g,""));
      const exh = Number(String(tr.querySelector(".exhCfm").value).replace(/,/g,""));
      const trv = Number(String(tr.querySelector(".tr").value).replace(/,/g,""));

      if (Number.isFinite(supply)) { sumSupply+=supply; hasSupply=true; }
      if (Number.isFinite(oa)) { sumOA+=oa; hasOA=true; }
      if (Number.isFinite(exh)) { sumExh+=exh; hasExh=true; }
      if (Number.isFinite(trv)) { sumTR+=trv; hasTR=true; }
    });

    $("sumSupply").textContent = hasSupply ? format0(sumSupply) : "—";
    $("sumOA").textContent = hasOA ? format0(sumOA) : "—";
    $("sumExh").textContent = hasExh ? format0(sumExh) : "—";
    $("sumTR").textContent = hasTR ? format2(sumTR) : "—";
  }

  function recalcAll(){
    Array.from(rowsBody.querySelectorAll("tr")).forEach(tr=>recalcRow(tr));
    recalcSummary();
  }

  function exportCsv(){
    const trs = Array.from(rowsBody.querySelectorAll("tr"));

    const header = [
      "Room Name",
      "Display Name",
      "ASHRAE Reference",
      "Room Volume (m3)",
      "Outdoor Air ACH (Ref)",
      "OA Override (ACH)",
      "Total ACH",
      "Room Pressure",
      "Exhaust to Outdoors",
      "RH (%)",
      "Temp (C)",
      "Pressure Offset (%)",
      "Rule of Thumb (CFM/TR)",
      "Volume (ft3)",
      "Outdoor Air CFM",
      "Total Supply CFM",
      "Estimated Exhaust CFM",
      "Estimated TR"
    ];

    const rows = trs.map(tr=>{
      const get = (sel)=>tr.querySelector(sel)?.value ?? "";
      const safe = (v)=>`"${String(v).replace(/"/g,'""')}"`;

      return [
        get(".roomName"),
        tr.dataset.displayName || "",
        tr.dataset.ashraeName || "",
        get(".volM3"),
        get(".oaAchRaw"),
        get(".oaOverride"),
        tr.dataset.totalAch || get(".totalAch"),
        get(".pressurePN"),
        get(".exhOut"),
        get(".rh"),
        get(".tempC"),
        get(".offset"),
        get(".thumb"),
        get(".volFt3"),
        get(".oaCfm"),
        get(".supplyCfm"),
        get(".exhCfm"),
        get(".tr")
      ].map(safe).join(",");
    });

    const csv = [header.map(h=>`"${h}"`).join(","), ...rows].join("\n");
    const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "ASHRAE170P_rooms.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // Search filter (client-side hide/show)
  function applySearch(q){
    const query = (q||"").trim().toLowerCase();
    const trs = Array.from(rowsBody.querySelectorAll("tr"));
    trs.forEach(tr=>{
      const d = (tr.dataset.displayName||"").toLowerCase();
      const a = (tr.dataset.ashraeName||"").toLowerCase();
      const rn = (tr.querySelector(".roomName")?.value || "").toLowerCase();
      const show = !query || d.includes(query) || a.includes(query) || rn.includes(query);
      tr.style.display = show ? "" : "none";
    });
  }

  // Buttons
  $("addRowBtn").addEventListener("click", ()=>addRow());
  $("exportCsvBtn").addEventListener("click", exportCsv);
  $("clearBtn").addEventListener("click", ()=>{
    rowsBody.innerHTML = "";
    recalcSummary();
  });
  $("searchRoom").addEventListener("input", (e)=>applySearch(e.target.value));

  // Start with 3 rows like Excel feel
  addRow(defaultRowModel());
  addRow({ ...defaultRowModel(), volumeM3: 80 });
  addRow({ ...defaultRowModel(), volumeM3: 40 });

  // Service worker
  if ("serviceWorker" in navigator){
    try { await navigator.serviceWorker.register("sw.js"); } catch(e){ /* ignore */ }
  }
})();

