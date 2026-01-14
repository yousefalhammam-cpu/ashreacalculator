(async function () {
  const $ = (id) => document.getElementById(id);

  // ===== Guards =====
  const must = [
    "statusTag","countTag","roomType","roomName","volumeM3","offsetPct","thumb","oaOverride",
    "mCfm","mPa","mTemp","mRh",
    "addBtn","exportBtn","clearBtn",
    "list","emptyState","sumSupply","sumOA","sumExh","sumTR",
    "kimoRoomName","kimoTime","kimoDate","kimoMode",
    "kimoPa","kimoTemp","kimoRh","kimoCfm","kimoAch",
    "kimoRefAch","kimoDelta","kimoStatus"
  ];
  const missing = must.filter((id) => !$(id));
  if (missing.length) {
    alert("في عناصر ناقصة في index.html (IDs):\n" + missing.join(", "));
    throw new Error("Missing DOM IDs: " + missing.join(", "));
  }

  // ===== Formatters =====
  const nf0 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });
  const fmt0 = (n) => (n == null || Number.isNaN(n)) ? "—" : nf0.format(n);
  const fmt2 = (n) => (n == null || Number.isNaN(n)) ? "—" : nf2.format(n);

  function toNum(x) {
    if (x === null || x === undefined) return null;
    if (typeof x === "number") return Number.isFinite(x) ? x : null;
    const s = String(x).trim();
    if (!s) return null;
    if (s.toLowerCase() === "optional") return null;
    const v = Number(s);
    return Number.isFinite(v) ? v : null;
  }

  function inputNum(id) {
    const s = ($(id).value || "").toString().trim();
    if (s === "") return null;
    const v = Number(s);
    return Number.isFinite(v) ? v : null;
  }

  // ===== KIMO Dashboard =====
  function setText(id, v) {
    const el = $(id);
    if (!el) return;
    el.textContent = (v == null || Number.isNaN(v) || v === "") ? "—" : String(v);
  }

  function nowClock() {
    const d = new Date();
    const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
    const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    setText("kimoTime", time);
    setText("kimoDate", date);
  }

  function pressureMode(refPressure, measuredPa) {
    if (measuredPa != null) {
      if (measuredPa > 0.5) return "Positive";
      if (measuredPa < -0.5) return "Negative";
      return "Neutral";
    }
    const p = (refPressure || "").toString().trim().toUpperCase();
    if (p === "P") return "Positive";
    if (p === "N") return "Negative";
    return "Neutral";
  }

  function updateKimoFromRoom(r) {
    if (!r) return;
    const title = (r.roomName ? `${r.roomName} — ` : "") + (r.display || "—");
    setText("kimoRoomName", title);

    const m = r.measured || {};
    const mc = r.measuredCalc || {};
    const airflow = (m.mCfm != null) ? m.mCfm : r.calc?.totalCfm;

    setText("kimoPa", (m.mPa != null) ? Number(m.mPa).toFixed(1) : "—");
    setText("kimoTemp", (m.mTemp != null) ? Number(m.mTemp).toFixed(1) : "—");
    setText("kimoRh", (m.mRh != null) ? Number(m.mRh).toFixed(1) : "—");
    setText("kimoCfm", (airflow != null) ? Math.round(airflow) : "—");
    setText("kimoAch", (mc.mAch != null) ? Number(mc.mAch).toFixed(2) : "—");

    setText("kimoMode", pressureMode(r.refPressure, m.mPa));

    const refAchNum = Number(r.refTotalACH);
    setText("kimoRefAch", Number.isFinite(refAchNum) ? refAchNum : (r.refTotalACH || "—"));

    if (mc.diffAchPct != null) {
      setText("kimoDelta", `${Number(mc.diffAchPct).toFixed(2)}%`);
      setText("kimoStatus", mc.status || "—");
    } else {
      setText("kimoDelta", "—");
      setText("kimoStatus", "—");
    }
  }

  // ===== Load reference data (data.json) + fallback =====
  async function loadRef() {
    const INLINE_DATA = [
      { "Room Type": "Airborne Infection Isolation room (AII)", "Pressure": "N", "Outdoor Air ACH": 2, "Total ACH": 12, "Exhaust to Outdoors": "Yes", "RH (%)": "30-60", "Temp (°C)": "21.1-23.9" },
      { "Room Type": "Operating/Procedure Room (Class A)", "Pressure": "P", "Outdoor Air ACH": 3, "Total ACH": 15, "Exhaust to Outdoors": "No", "RH (%)": "30-60", "Temp (°C)": "21.1-23.9" },
      { "Room Type": "Medication room", "Pressure": "P", "Outdoor Air ACH": 2, "Total ACH": 4, "Exhaust to Outdoors": "No", "RH (%)": "30-60", "Temp (°C)": "21.1-23.9" },
      { "Room Type": "Laboratory - Histology", "Pressure": "N", "Outdoor Air ACH": 2, "Total ACH": 6, "Exhaust to Outdoors": "Yes", "RH (%)": "30-60", "Temp (°C)": "21.1-23.9" },
      { "Room Type": "Patient room", "Pressure": null, "Outdoor Air ACH": 2, "Total ACH": 6, "Exhaust to Outdoors": "No", "RH (%)": "30-60", "Temp (°C)": "21.1-23.9" },
      { "Room Type": "Toilet room", "Pressure": "N", "Outdoor Air ACH": null, "Total ACH": 10, "Exhaust to Outdoors": "Yes", "RH (%)": null, "Temp (°C)": null },
      { "Room Type": "Corridor", "Pressure": null, "Outdoor Air ACH": null, "Total ACH": 2, "Exhaust to Outdoors": "No", "RH (%)": null, "Temp (°C)": null }
    ];

    const bust = (u) => u + (u.includes("?") ? "&" : "?") + "v=" + Date.now();

    const basePath = window.location.pathname.endsWith("/")
      ? window.location.pathname
      : window.location.pathname.replace(/\/[^\/]*$/, "/");

    const tries = [
      new URL("data.json", window.location.href).toString(),
      window.location.origin + basePath + "data.json"
    ];

    let lastErr = null;

    for (const url of tries) {
      try {
        const resp = await fetch(bust(url), { cache: "no-store" });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const txt = await resp.text();
        const cleaned = txt.replace(/\bNaN\b/g, "null");
        const parsed = JSON.parse(cleaned);
        const arr = Array.isArray(parsed) ? parsed : [parsed];

        if (arr.length) {
          $("statusTag").textContent = `Loaded rooms: ${arr.length}`;
          $("statusTag").className = "tag ok";
          return arr;
        }
      } catch (e) {
        lastErr = e;
      }
    }

    $("statusTag").textContent = `Fallback data used (data.json failed)`;
    $("statusTag").className = "tag warn";
    console.warn("data.json failed, using INLINE_DATA. Last error:", lastErr);
    return INLINE_DATA;
  }

  // ===== Core calculations =====
  function compute(row, inputs) {
    const volumeM3 = inputs.volumeM3;
    const volFt3 = volumeM3 * 35.3147;

    const totalAch = toNum(row["Total ACH"]);
    const oaRaw = (row["Outdoor Air ACH"] ?? "").toString().trim();
    const oaRefNum = toNum(row["Outdoor Air ACH"]);

    const pressure = (row["Pressure"] ?? "").toString().trim();
    const exhOut = (row["Exhaust to Outdoors"] ?? "").toString().trim();

    const oaOverride = inputs.oaOverride;
    const hasOverride = oaOverride !== null && Number.isFinite(oaOverride) && oaOverride >= 0;

    let oaAch = null;
    let oaSource = "—";
    let oaTag = "";

    if (hasOverride) {
      oaAch = oaOverride;
      oaSource = "Override";
    } else if (oaRefNum !== null) {
      oaAch = oaRefNum;
      oaSource = "Reference";
    } else if (oaRaw.toLowerCase() === "optional") {
      oaAch = 0;
      oaSource = "Optional (assumed 0)";
      oaTag = "warn";
    } else {
      oaAch = null;
      oaSource = "Not specified";
      oaTag = "danger";
    }

    const totalCfm = (totalAch === null) ? null : (volFt3 * totalAch / 60.0);
    const oaCfm = (oaAch === null) ? null : (volFt3 * oaAch / 60.0);

    const offset = inputs.offsetPct / 100.0;
    let exhCfm = null;
    if (totalCfm !== null) {
      if (pressure.toUpperCase() === "P") exhCfm = totalCfm * (1 - offset);
      else if (pressure.toUpperCase() === "N") exhCfm = totalCfm * (1 + offset);
      else if (exhOut.toLowerCase() === "yes") exhCfm = totalCfm;
    }

    const tr = (totalCfm === null) ? null : (totalCfm / inputs.thumb);

    return {
      volFt3, totalAch, oaRaw, oaAch, oaSource, oaTag,
      pressure, exhOut,
      rh: (row["RH (%)"] ?? "").toString().trim(),
      tempC: (row["Temp (°C)"] ?? "").toString().trim(),
      totalCfm, oaCfm, exhCfm, tr
    };
  }

  function computeMeasured(meas, volumeM3) {
    const volFt3 = volumeM3 * 35.3147;
    const mCfm = meas.mCfm;
    const mAch = (mCfm == null) ? null : (mCfm * 60 / volFt3);

    const refAch = meas.refTotalAchNum;
    const diffAch = (mAch == null || refAch == null) ? null : (mAch - refAch);
    const diffAchPct = (mAch == null || refAch == null || refAch === 0) ? null : (diffAch / refAch) * 100;

    let status = "";
    if (diffAchPct != null) {
      if (Math.abs(diffAchPct) <= 10) status = "OK (±10%)";
      else if (diffAchPct > 10) status = "High";
      else status = "Low";
    }

    return { mAch, diffAch, diffAchPct, status };
  }

  // ===== “AI” Advisor (rule-based) =====
  function aiClassify(r){
    const refAch = Number(r.refTotalACH);
    const mAch = r.measuredCalc?.mAch;

    if (!Number.isFinite(refAch) || !Number.isFinite(mAch)) {
      return {grade:"—", score:null, reasons:["أدخل Measured CFM عشان أقدر أقارن."], actions:[]};
    }

    const tol = 10; // ±10%
    const diffPct = ((mAch - refAch) / refAch) * 100;

    let grade = "OK";
    if (diffPct > tol) grade = "HIGH";
    else if (diffPct < -tol) grade = "LOW";

    const score = Math.max(0, Math.min(100, 100 - Math.abs(diffPct) * 3));
    const reasons = [];
    const actions = [];

    const volFt3 = r.volumeM3 * 35.3147;
    const targetCfm = (refAch * volFt3) / 60;
    const mCfm = r.measured?.mCfm;

    if (grade === "LOW"){
      reasons.push("ACH الفعلي أقل من التصميم: احتمال damper مقفول/توازن غير مضبوط/سرعة المروحة منخفضة/فلتر متّسخ.");
      if (Number.isFinite(mCfm)) actions.push(`اقترح رفع الهواء الكلي إلى ≈ ${Math.round(targetCfm)} CFM (الآن: ${Math.round(mCfm)}).`);
    } else if (grade === "HIGH"){
      reasons.push("ACH الفعلي أعلى من التصميم: احتمال over-supply أو damper مفتوح زيادة أو balancing غير دقيق.");
      if (Number.isFinite(mCfm)) actions.push(`اقترح خفض الهواء الكلي إلى ≈ ${Math.round(targetCfm)} CFM (الآن: ${Math.round(mCfm)}).`);
    } else {
      reasons.push("القراءة ضمن التفاوت المقبول مقارنة بالتصميم.");
      actions.push("راجع فقط اتجاه الضغط وفرق Supply/Exhaust حسب متطلبات الغرفة.");
    }

    const refP = (r.refPressure || "").toUpperCase();
    const mPa = r.measured?.mPa;
    if (mPa != null){
      if (refP === "P" && mPa < 0) reasons.push("ضغط مقاس سلبي بينما الغرفة تصميمها Positive (P).");
      if (refP === "N" && mPa > 0) reasons.push("ضغط مقاس إيجابي بينما الغرفة تصميمها Negative (N).");
    }

    if (Number.isFinite(r.calc?.oaCfm) && Number.isFinite(mCfm) && mCfm < r.calc.oaCfm){
      reasons.push("تنبيه: CFM المقاس أقل من Outdoor Air المطلوب (راجع القياس/تعريف النقطة).");
    }

    return {grade, score: Math.round(score), diffPct, targetCfm, reasons, actions};
  }

  function aiBadge(grade){
    if (grade === "OK") return `<span class="tag ok">AI: OK</span>`;
    if (grade === "LOW") return `<span class="tag warn">AI: LOW</span>`;
    if (grade === "HIGH") return `<span class="tag danger">AI: HIGH</span>`;
    return `<span class="tag">AI: —</span>`;
  }

  // ===== Init data =====
  const ref = await loadRef();

  // Build dropdown
  const options = ref
    .map((r, i) => {
      const rt = (r["Room Type"] ?? "").toString().trim();
      const display = (r.displayName ?? rt).toString().trim() || rt || `Room ${i + 1}`;
      const ashrae = (r.ashraeName ?? rt).toString().trim() || rt || display;
      return { i, display, ashrae };
    })
    .filter(o => o.display)
    .sort((a, b) => a.display.localeCompare(b.display, "en"));

  $("roomType").innerHTML = options.map(o =>
    `<option value="${o.i}">${String(o.display).replace(/"/g, "&quot;")}</option>`
  ).join("");

  const rooms = [];

  function renderSummary() {
    let sumSupply = 0, sumOA = 0, sumExh = 0, sumTR = 0;
    let hasSupply = false, hasOA = false, hasExh = false, hasTR = false;

    rooms.forEach(r => {
      const c = r.calc;
      if (Number.isFinite(c.totalCfm)) { sumSupply += c.totalCfm; hasSupply = true; }
      if (Number.isFinite(c.oaCfm)) { sumOA += c.oaCfm; hasOA = true; }
      if (Number.isFinite(c.exhCfm)) { sumExh += c.exhCfm; hasExh = true; }
      if (Number.isFinite(c.tr)) { sumTR += c.tr; hasTR = true; }
    });

    $("sumSupply").textContent = hasSupply ? fmt0(sumSupply) : "—";
    $("sumOA").textContent = hasOA ? fmt0(sumOA) : "—";
    $("sumExh").textContent = hasExh ? fmt0(sumExh) : "—";
    $("sumTR").textContent = hasTR ? fmt2(sumTR) : "—";
  }

  function render() {
    $("countTag").textContent = `Rooms: ${rooms.length}`;

    const list = $("list");
    const empty = $("emptyState");
    empty.style.display = rooms.length ? "none" : "block";

    list.innerHTML = rooms.map((r, idx) => {
      const tagHtml = r.calc.oaTag
        ? `<span class="tag ${r.calc.oaTag}">Outdoor Air: ${r.calc.oaSource}</span>`
        : `<span class="tag">Outdoor Air: ${r.calc.oaSource}</span>`;

      const hasMeasured = r.measured && (
        r.measured.mCfm != null || r.measured.mPa != null || r.measured.mTemp != null || r.measured.mRh != null
      );

      const measLine = hasMeasured
        ? `<div class="sub" style="margin-top:6px;">
            Measured: CFM <b>${fmt0(r.measured.mCfm)}</b> — ACH <b>${fmt2(r.measuredCalc.mAch)}</b>
            ${r.measuredCalc.diffAchPct == null ? "" : `— ΔACH <b>${fmt2(r.measuredCalc.diffAchPct)}%</b> (${r.measuredCalc.status})`}
          </div>`
        : `<div class="sub" style="margin-top:6px; opacity:.8;">Measured: —</div>`;

      const ai = aiClassify(r);

      return `
        <div class="roomCard">
          <div class="roomHead">
            <div>
              <h3>${r.roomName ? `${r.roomName} — ` : ""}${r.display}</h3>
              <div class="sub">ASHRAE Reference: <b>${r.ashrae}</b></div>
              ${measLine}
            </div>
            <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
              ${tagHtml}
              <button class="btn danger" data-del="${idx}" style="width:auto; padding:8px 10px;">حذف</button>
            </div>
          </div>

          <div class="sub" style="margin-top:8px;">
            Volume: <b>${fmt2(r.volumeM3)}</b> m³ — Offset: <b>${fmt2(r.offsetPct)}</b>% — Thumb: <b>${r.thumb}</b>
          </div>

          <div class="sub" style="margin-top:10px;">
            ${aiBadge(ai.grade)}
            <span class="tag">AI Score: <b>${ai.score ?? "—"}</b>/100</span>
            ${ai.diffPct==null ? "" : `<span class="tag">ΔACH: <b>${ai.diffPct.toFixed(2)}%</b></span>`}
          </div>

          <div class="aiBox">
            <div class="aiTitle">AI Advisor (Design vs Measured)</div>
            <div class="sub" style="opacity:.92;">
              ${ai.reasons.map(x=>`• ${x}`).join("<br/>")}
            </div>
            ${ai.actions.length ? `<div class="sub" style="margin-top:8px; opacity:.92;">${ai.actions.map(x=>`✅ ${x}`).join("<br/>")}</div>` : ""}
          </div>

          <div class="metrics">
            <div class="metric"><div class="k">Total ACH (Ref)</div><div class="v">${(r.refTotalACH ?? "—")}</div></div>
            <div class="metric"><div class="k">Outdoor ACH (Ref)</div><div class="v">${(r.refOutdoorACH ?? "—")}</div></div>
            <div class="metric"><div class="k">Supply (CFM)</div><div class="v">${fmt0(r.calc.totalCfm)}</div></div>
            <div class="metric"><div class="k">Outdoor (CFM)</div><div class="v">${fmt0(r.calc.oaCfm)}</div></div>

            <div class="metric"><div class="k">Exhaust (CFM)</div><div class="v">${fmt0(r.calc.exhCfm)}</div></div>
            <div class="metric"><div class="k">TR (est)</div><div class="v">${fmt2(r.calc.tr)}</div></div>
            <div class="metric"><div class="k">Pressure (P/N)</div><div class="v">${r.refPressure || "—"}</div></div>
            <div class="metric"><div class="k">Temp/RH (Ref)</div><div class="v">${(r.refTempC || "—")}/${(r.refRH || "—")}</div></div>

            <div class="metric"><div class="k">Measured Pressure (Pa)</div><div class="v">${fmt2(r.measured?.mPa)}</div></div>
            <div class="metric"><div class="k">Measured Temp (°C)</div><div class="v">${fmt2(r.measured?.mTemp)}</div></div>
            <div class="metric"><div class="k">Measured RH (%)</div><div class="v">${fmt2(r.measured?.mRh)}</div></div>
            <div class="metric"><div class="k">Measured ACH</div><div class="v">${fmt2(r.measuredCalc?.mAch)}</div></div>
          </div>
        </div>
      `;
    }).join("");

    list.querySelectorAll("[data-del]").forEach(btn => {
      btn.addEventListener("click", () => {
        const i = Number(btn.getAttribute("data-del"));
        rooms.splice(i, 1);
        render();
      });
    });

    renderSummary();

    const last = rooms.length ? rooms[rooms.length - 1] : null;
    if (last) updateKimoFromRoom(last);
  }

  function addRoom() {
    const idx = Number($("roomType").value);
    const row = ref[idx];
    const opt = options.find(o => o.i === idx);

    const volumeM3 = Number($("volumeM3").value || 0);
    if (!Number.isFinite(volumeM3) || volumeM3 <= 0) {
      alert("اكتب حجم صحيح بالمتر المكعب (m³).");
      return;
    }

    const roomName = ($("roomName").value || "").trim();
    const offsetPct = Number($("offsetPct").value || 0);
    const thumb = Number($("thumb").value || 400);

    const oaOverrideStr = ($("oaOverride").value || "").trim();
    const oaOverride = oaOverrideStr === "" ? null : Number(oaOverrideStr);

    const calc = compute(row, { volumeM3, offsetPct, thumb, oaOverride });

    const mCfm = inputNum("mCfm");
    const mPa = inputNum("mPa");
    const mTemp = inputNum("mTemp");
    const mRh = inputNum("mRh");
    const refTotalAchNum = toNum(row["Total ACH"]);
    const measured = { mCfm, mPa, mTemp, mRh, refTotalAchNum };
    const measuredCalc = computeMeasured(measured, volumeM3);

    rooms.push({
      roomName,
      idx,
      display: opt?.display || "—",
      ashrae: opt?.ashrae || "—",
      volumeM3,
      offsetPct,
      thumb,
      oaOverride,

      refPressure: (row["Pressure"] ?? "").toString().trim(),
      refTotalACH: (row["Total ACH"] ?? ""),
      refOutdoorACH: (row["Outdoor Air ACH"] ?? ""),
      refExhaustOutdoors: (row["Exhaust to Outdoors"] ?? "").toString().trim(),
      refTempC: (row["Temp (°C)"] ?? "").toString().trim(),
      refRH: (row["RH (%)"] ?? "").toString().trim(),

      measured,
      measuredCalc,
      calc
    });

    $("roomName").value = "";
    $("oaOverride").value = "";
    $("mCfm").value = "";
    $("mPa").value = "";
    $("mTemp").value = "";
    $("mRh").value = "";

    render();
  }

  function exportExcelCsv() {
    const header = [
      "Room Name","Display Name","ASHRAE Reference",
      "Volume (m3)","Total ACH (Ref)","Outdoor ACH (Ref)",
      "Supply (CFM)","Outdoor (CFM)","Exhaust (CFM)","TR (est)",
      "Pressure (P/N) (Ref)","Temp (°C) (Ref)","RH (%) (Ref)",
      "Measured CFM","Measured ACH","Measured Pressure (Pa)","Measured Temp (°C)","Measured RH (%)",
      "ΔACH (%)","AI Grade","AI Score","Offset (%)","Rule of Thumb (CFM/TR)"
    ];

    const rows = rooms.map(r => {
      const c = r.calc;
      const m = r.measured || {};
      const mc = r.measuredCalc || {};
      const ai = aiClassify(r);
      const safe = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

      return [
        r.roomName, r.display, r.ashrae,
        r.volumeM3, r.refTotalACH ?? "", r.refOutdoorACH ?? "",
        c.totalCfm, c.oaCfm, c.exhCfm, c.tr,
        r.refPressure || "", r.refTempC || "", r.refRH || "",
        m.mCfm, mc.mAch, m.mPa, m.mTemp, m.mRh,
        mc.diffAchPct, ai.grade, ai.score,
        r.offsetPct, r.thumb
      ].map(safe).join(",");
    });

    const csv = [header.map(h => `"${h}"`).join(","), ...rows].join("\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "ASHRAE170_Rooms_AI.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    rooms.length = 0;
    render();
  }

  // ===== Bind =====
  $("addBtn").addEventListener("click", addRoom);
  $("exportBtn").addEventListener("click", exportExcelCsv);
  $("clearBtn").addEventListener("click", clearAll