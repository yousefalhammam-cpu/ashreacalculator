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

  // Robust JSON load: fixes accidental NaN (not valid JSON) by replacing with null
  async function loadData(){
    const resp = await fetch("data.json", { cache: "no-store" });
    const txt = await resp.text();

    // replace NaN tokens safely (common pandas export)
    const cleaned = txt
      .replace(/\bNaN\b/g, "null");

    // ensure it's an array
    const parsed = JSON.parse(cleaned);
    return Array.isArray(parsed) ? parsed : [parsed];
  }

  let data = [];
  try{
    data = await loadData();
  } catch(e){
    alert("في مشكلة بقراءة data.json. تأكد إنه JSON صحيح (بدون NaN).");
    console.error(e);
    return;
  }

  // Build items with fallback:
  // displayName/ashraeName optional. If missing, use Room Type.
  const items = data
    .map((r, i) => {
      const roomType = (r["Room Type"] ?? "").toString().trim();
      const display = (r.displayName ?? roomType).toString().trim();
      const ashrae = (r.ashraeName ?? roomType).toString().trim();
      return { i, display, ashrae };
    })
    .filter(x => x.display);

  items.sort((a,b)=>a.display.localeCompare(b.display, "en"));

  $("roomType").innerHTML = items
    .map(x => `<option value="${x.i}">${x.display}</option>`)
    .join("");

  $("roomType").value = String(items[0]?.i ?? "");

  function tag(type, text){
    const cls = type ? `tag ${type}` : "tag";
    return `<span class="${cls}">${text}</span>`;
  }

  function calc(){
    const idx = Number($("roomType").value);
    const row = data[idx];
    if (!row) return;

    const displayName = (row.displayName ?? row["Room Type"] ?? "—").toString().trim();
    const ashraeName  = (row.ashraeName  ?? row["Room Type"] ?? "—").toString().trim();

    const volume_m3 = Number($("volume").value || 0);
    const offsetPct = Number($("offset").value || 0) / 100.0;
    const thumb = Number($("thumb").value || 400);

    const volFt3 = volume_m3 * 35.3147;

    const pressure = (row["Pressure"] ?? "").toString().trim();
    const totalAch = toNum(row["Total ACH"]);

    const oaAchRaw = (row["Outdoor Air ACH"] ?? "").toString().trim();
    let oaAchRef = toNum(row["Outdoor Air ACH"]); // null for Optional / blanks

    // Professional OA logic: Override > Reference number > Optional assumed 0 > Not specified (blank)
    const oaOverrideStr = ($("oaOverride").value ?? "").toString().trim();
    const oaOverrideVal = oaOverrideStr === "" ? null : Number(oaOverrideStr);
    const hasOverride = oaOverrideVal !== null && Number.isFinite(oaOverrideVal) && oaOverrideVal >= 0;

    let oaAch = null;
    let oaSource = "—";
    let oaTagType = "";
    let oaTagText = "";

    if (hasOverride){
      oaAch = oaOverrideVal;
      oaSource = "Override";
      oaTagType = "";
      oaTagText = `Outdoor Air: Override = ${oaAch}`;
    } else if (oaAchRef !== null){
      oaAch = oaAchRef;
      oaSource = "Reference";
      oaTagType = "";
      oaTagText = `Outdoor Air: Reference = ${oaAch}`;
    } else if (oaAchRaw.toLowerCase() === "optional"){
      oaAch = 0;
      oaSource = "Optional (assumed 0)";
      oaTagType = "warn";
      oaTagText = "Outdoor Air: Optional (assumed 0)";
    } else if (oaAchRaw === "" || oaAchRaw.toLowerCase() === "null"){
      oaAch = null;
      oaSource = "Not specified";
      oaTagType = "danger";
      oaTagText = "Outdoor Air: Not specified";
    } else {
      // Any other string -> treat as not specified
      oaAch = null;
      oaSource = "Not specified";
      oaTagType = "danger";
      oaTagText = "Outdoor Air: Not specified";
    }

    const totalCfm = (totalAch===null) ? null : (volFt3 * totalAch / 60.0);
    const oaCfm = (oaAch===null) ? null : (volFt3 * oaAch / 60.0);
    const tr = (totalCfm===null) ? null : (totalCfm / thumb);

    // Exhaust estimate
    const exhOut = (row["Exhaust to Outdoors"] ?? "").toString().trim();
    let exh = null;
    if (totalCfm !== null){
      if (pressure.toUpperCase() === "P") exh = totalCfm * (1 - offsetPct);
      else if (pressure.toUpperCase() === "N") exh = totalCfm * (1 + offsetPct);
      else if (exhOut.toLowerCase() === "yes") exh = totalCfm;
    }

    // UI
    $("volFt3").textContent = format0(volFt3);
    $("totalCfm").textContent = format0(totalCfm);
    $("oaCfm").textContent = format0(oaCfm);
    $("exhCfm").textContent = format0(exh);
    $("trVal").textContent = format2(tr);
    $("pressPN").textContent = pressure || "—";

    $("totalAch").textContent = (totalAch===null) ? "—" : String(totalAch);
    $("oaAchRaw").textContent = oaAchRaw || "—";
    $("exhOut").textContent = exhOut || "—";
    $("recirc").textContent = (row["Recirc w/ In-room Units"] ?? "—").toString().trim() || "—";
    $("rh").textContent = (row["RH (%)"] ?? "—").toString().trim() || "—";
    $("tempC").textContent = (row["Temp (°C)"] ?? "—").toString().trim() || "—";

    $("ashraeRef").textContent = ashraeName || "—";

    // OA tag
    const tags = [];
    tags.push(tag("", `Display: <b>${displayName}</b>`));
    if (oaTagText) tags.push(tag(oaTagType, oaTagText));
    tags.push(tag("", `OA Source: <b>${oaSource}</b>`));
    $("oaTagWrap").innerHTML = tags.join("");

    // Update table highlight is not needed here
  }

  // Reference table (search)
  function renderTable(filter=""){
    const tbody = $("refTable");
    const q = filter.trim().toLowerCase();

    const rows = items
      .filter(x => q ? (x.display.toLowerCase().includes(q) || x.ashrae.toLowerCase().includes(q)) : true)
      .slice(0, 250)
      .map(x => {
        const r = data[x.i];
        const p = (r["Pressure"] ?? "").toString().trim();
        const oa = (r["Outdoor Air ACH"] ?? "").toString().trim();
        const ta = (r["Total ACH"] ?? "").toString().trim();
        const eo = (r["Exhaust to Outdoors"] ?? "").toString().trim();
        const rh = (r["RH (%)"] ?? "").toString().trim();
        const tc = (r["Temp (°C)"] ?? "").toString().trim();
        return `
          <tr>
            <td>${x.display}</td>
            <td>${x.ashrae}</td>
            <td>${p}</td>
            <td>${oa}</td>
            <td>${ta}</td>
            <td>${eo}</td>
            <td>${rh}</td>
            <td>${tc}</td>
          </tr>
        `;
      });

    tbody.innerHTML = rows.join("");
  }

  $("calcBtn").addEventListener("click", calc);
  $("roomType").addEventListener("change", calc);
  $("thumb").addEventListener("change", calc);
  $("oaOverride").addEventListener("input", calc);
  $("volume").addEventListener("input", ()=>{ /* optional live */ });
  $("offset").addEventListener("input", ()=>{ /* optional live */ });

  $("search").addEventListener("input", (e)=>renderTable(e.target.value));
  $("clearSearch").addEventListener("click", ()=>{ $("search").value=""; renderTable(""); });

  renderTable("");
  calc();

  // Register service worker
  if ("serviceWorker" in navigator){
    try { await navigator.serviceWorker.register("sw.js"); } catch(e){ /* ignore */ }
  }
})();
