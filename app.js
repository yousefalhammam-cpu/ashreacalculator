(async function(){
  const $ = (id)=>document.getElementById(id);

  const format0 = (n)=> (n==null || Number.isNaN(n)) ? "—" : Intl.NumberFormat("en-US", {maximumFractionDigits:0}).format(n);
  const format2 = (n)=> (n==null || Number.isNaN(n)) ? "—" : Intl.NumberFormat("en-US", {maximumFractionDigits:2}).format(n);

  function toNum(x){
    if (x===null || x===undefined) return null;
    if (typeof x === "number") return x;
    const s = String(x).trim();
    if (!s) return null;
    if (s.toLowerCase() === "optional") return null;
    const v = Number(s);
    return Number.isFinite(v) ? v : null;
  }

  const res = await fetch("data.json");
  const data = await res.json();

  // Populate room type dropdown
  const roomTypes = [...new Set(data.map(r=>String(r["Room Type"]).trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"en"));
  $("roomType").innerHTML = roomTypes.map(rt=>`<option value="${rt.replaceAll('"','&quot;')}">${rt}</option>`).join("");
  $("roomType").value = roomTypes[0] || "";

  function getRow(roomType){
    return data.find(r=>String(r["Room Type"]).trim() === roomType);
  }

  function calc(){
    const rt = $("roomType").value;
    const row = getRow(rt);
    if (!row) return;

    const volume_m3 = Number($("volume").value || 0);
    const offsetPct = Number($("offset").value || 0) / 100.0;
    const thumb = Number($("thumb").value || 400);

    const volFt3 = volume_m3 * 35.3147;

    const pressure = (row["Pressure"] ?? "").toString().trim();
    const totalAch = toNum(row["Total ACH"]);
    const oaAchRaw = (row["Outdoor Air ACH"] ?? "").toString().trim();
    let oaAch = toNum(row["Outdoor Air ACH"]);
    if (oaAch === null){
      const opt = $("optionalOA").value; // "" or "0"
      if (opt !== "") oaAch = Number(opt);
    }

    const totalCfm = (totalAch===null) ? null : (volFt3 * totalAch / 60.0);
    const oaCfm = (oaAch===null) ? null : (volFt3 * oaAch / 60.0);
    const tr = (totalCfm===null) ? null : (totalCfm / thumb);

    // Exhaust estimate
    let exh = null;
    const exhOut = (row["Exhaust to Outdoors"] ?? "").toString().trim();
    if (totalCfm !== null){
      if (pressure.toUpperCase() === "P") exh = totalCfm * (1 - offsetPct);
      else if (pressure.toUpperCase() === "N") exh = totalCfm * (1 + offsetPct);
      else if (exhOut.toLowerCase() === "yes") exh = totalCfm;
    }

    // Set UI
    $("volFt3").textContent = format0(volFt3);
    $("totalCfm").textContent = format0(totalCfm);
    $("oaCfm").textContent = format0(oaCfm);
    $("exhCfm").textContent = format0(exh);
    $("trVal").textContent = format2(tr);
    $("pressPN").textContent = pressure || "—";

    $("totalAch").textContent = (totalAch===null) ? "—" : totalAch;
    $("oaAch").textContent = oaAchRaw || "—";
    $("exhOut").textContent = exhOut || "—";
    $("recirc").textContent = (row["Recirc w/ In-room Units"] ?? "—").toString().trim() || "—";
    $("rh").textContent = (row["RH (%)"] ?? "—").toString().trim() || "—";
    $("tempC").textContent = (row["Temp (°C)"] ?? "—").toString().trim() || "—";
  }

  // Reference table
  function renderTable(filter=""){
    const tbody = $("refTable");
    const q = filter.trim().toLowerCase();
    const rows = data.filter(r=>{
      const name = String(r["Room Type"]||"").toLowerCase();
      return q ? name.includes(q) : true;
    }).slice(0, 200);

    tbody.innerHTML = rows.map(r=>`
      <tr>
        <td>${String(r["Room Type"]||"").trim()}</td>
        <td>${String(r["Pressure"]||"").trim()}</td>
        <td>${String(r["Outdoor Air ACH"]||"").trim()}</td>
        <td>${String(r["Total ACH"]||"").trim()}</td>
        <td>${String(r["Exhaust to Outdoors"]||"").trim()}</td>
        <td>${String(r["RH (%)"]||"").trim()}</td>
        <td>${String(r["Temp (°C)"]||"").trim()}</td>
      </tr>
    `).join("");
  }

  $("calcBtn").addEventListener("click", calc);
  $("roomType").addEventListener("change", calc);
  $("volume").addEventListener("input", ()=>{ /* lightweight live */ });
  $("offset").addEventListener("input", ()=>{ /* lightweight live */ });
  $("thumb").addEventListener("change", calc);
  $("optionalOA").addEventListener("change", calc);

  $("search").addEventListener("input", (e)=>renderTable(e.target.value));
  $("clearSearch").addEventListener("click", ()=>{ $("search").value=""; renderTable(""); });

  // Initial render
  renderTable("");
  calc();

  // Register service worker
  if ("serviceWorker" in navigator){
    try { await navigator.serviceWorker.register("sw.js"); } catch(e){ /* ignore */ }
  }
})();