(function () {
  const $ = (id) => document.getElementById(id);

  const roomType = $("roomType");
  const roomHint = $("roomHint");
  const volume = $("volume");
  const pressureOffset = $("pressureOffset");
  const oaOverride = $("oaOverride");
  const ruleOfThumb = $("ruleOfThumb");

  const measuredCfm = $("measuredCfm");
  const measuredPa = $("measuredPa");
  const measuredTemp = $("measuredTemp");
  const measuredRh = $("measuredRh");

  const results = $("results");
  const statusDot = $("statusDot");
  const statusText = $("statusText");

  let db = null;
  let flatItems = []; // for quick lookup by id

  function setStatus(ok, text) {
    statusDot.className = "dot " + (ok ? "ok" : "bad");
    statusText.textContent = text;
  }

  async function loadData() {
    try {
      // مهم: كاش-بستر عشان ما يعلق الآيفون على نسخة قديمة
      const url = "data.json?v=" + Date.now();
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      db = await res.json();
      buildRoomList(db);
      setStatus(true, "تم تحميل البيانات ✅");
    } catch (e) {
      console.error(e);
      roomType.innerHTML = `<option value="">فشل تحميل data.json</option>`;
      roomHint.textContent = "تأكد إن data.json بنفس مجلد index.html";
      setStatus(false, "فيه مشكلة بتحميل البيانات ❌");
    }
  }

  function buildRoomList(db) {
    flatItems = [];
    roomType.innerHTML = `<option value="">اختر نوع الغرفة…</option>`;

    db.categories.forEach((cat) => {
      const og = document.createElement("optgroup");
      og.label = cat.name;

      cat.items.forEach((item) => {
        flatItems.push(item);
        const opt = document.createElement("option");
        opt.value = item.id;
        opt.textContent = `${item.label_ar} — ${item.label_en}`;
        og.appendChild(opt);
      });

      roomType.appendChild(og);
    });

    roomHint.textContent = "اختيارك بيعبّي ACH و Pressure Offset تلقائياً (تقدر تعدل).";
  }

  function getItemById(id) {
    return flatItems.find((x) => x.id === id) || null;
  }

  function onRoomChange() {
    const id = roomType.value;
    const item = getItemById(id);
    if (!item) return;

    // عبّي القيم الافتراضية
    if (pressureOffset.value === "" || pressureOffset.value === null) {
      pressureOffset.value = item.pressureOffset ?? 0;
    } else {
      pressureOffset.value = item.pressureOffset ?? 0;
    }

    // نخزن ACH الافتراضي في oaOverride إذا كان فاضي (حتى يبان للمستخدم)
    if (oaOverride.value === "" || oaOverride.value === null) {
      oaOverride.value = item.ach ?? "";
    } else {
      // إذا المستخدم كاتب override بنفسه لا نغيّره
    }
  }

  function calc() {
    const v = parseFloat(volume.value);
    if (!isFinite(v) || v <= 0) {
      results.innerHTML = `<div class="badText">دخل حجم صحيح (m³).</div>`;
      return;
    }

    const id = roomType.value;
    const item = getItemById(id);
    const ach = (oaOverride.value !== "" ? parseFloat(oaOverride.value) : (item ? item.ach : NaN));

    if (!isFinite(ach) || ach <= 0) {
      results.innerHTML = `<div class="badText">حدد نوع الغرفة أو اكتب ACH في Outdoor Air Override.</div>`;
      return;
    }

    // ACH → CFM
    // m³/h = ACH * Volume
    // CFM = (m³/h) * 0.588577 (تقريب)
    const m3h = ach * v;
    const cfm = m3h * 0.588577;

    const pOff = parseFloat(pressureOffset.value || "0");
    const rot = parseFloat(ruleOfThumb.value || "400");
    const tr = cfm / rot;

    const measCfm = measuredCfm.value ? parseFloat(measuredCfm.value) : null;

    results.innerHTML = `
      <div class="grid">
        <div class="k">ACH</div><div class="v">${ach.toFixed(2)}</div>
        <div class="k">Volume (m³)</div><div class="v">${v.toFixed(2)}</div>
        <div class="k">Outdoor Air (m³/h)</div><div class="v">${m3h.toFixed(1)}</div>
        <div class="k">Outdoor Air (CFM)</div><div class="v">${cfm.toFixed(1)}</div>
        <div class="k">Pressure Offset (%)</div><div class="v">${isFinite(pOff) ? pOff.toFixed(1) : "—"}</div>
        <div class="k">TR (Rule ${rot})</div><div class="v">${tr.toFixed(2)}</div>
        ${measCfm !== null && isFinite(measCfm) ? `<div class="k">Measured vs Required</div><div class="v">${(measCfm - cfm).toFixed(1)} CFM</div>` : ``}
      </div>
    `;
  }

  function resetAll() {
    $("roomName").value = "";
    roomType.value = "";
    volume.value = "";
    pressureOffset.value = "";
    oaOverride.value = "";
    measuredCfm.value = "";
    measuredPa.value = "";
    measuredTemp.value = "";
    measuredRh.value = "";
    results.innerHTML = `<div class="muted">اختر نوع الغرفة وادخل الحجم ثم اضغط احسب.</div>`;
  }

  // Service Worker (Offline)
  async function registerSW() {
    if (!("serviceWorker" in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.register("sw.js");
      // طلب تحديث سريع
      reg.update();
    } catch (e) {
      console.warn("SW failed", e);
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    roomType.addEventListener("change", onRoomChange);
    $("calcBtn").addEventListener("click", calc);
    $("resetBtn").addEventListener("click", resetAll);

    await loadData();
    await registerSW();
  });
})();