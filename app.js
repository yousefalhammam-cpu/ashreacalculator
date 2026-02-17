(() => {
  const $ = (id) => document.getElementById(id);

  // عناصر الصفحة (تأكد IDs موجودة في index.html)
  const roomType = $("roomType");      // select
  const volumeEl = $("volume");        // input m3
  const achOverrideEl = $("achOverride"); // input optional
  const result = $("result");          // div
  const calcBtn = $("calcBtn");        // button

  function setLoading(msg) {
    roomType.innerHTML = `<option value="" selected>${msg}</option>`;
  }

  function showError(e, extra = "") {
    setLoading("فشل تحميل البيانات — راجع الرسالة تحت");
    const msg = `DATA LOAD ERROR ❌\n${extra}\n${String(e)}`;
    result.innerHTML =
      `<pre style="white-space:pre-wrap;direction:ltr;text-align:left;
      background:#081226;border:1px solid #1d2a46;padding:12px;border-radius:12px;color:#e9f1ff;">
${msg}
</pre>`;
    console.error("DATA LOAD ERROR:", e);
  }

  async function loadData() {
    setLoading("جاري تحميل البيانات…");

    // مسار صحيح داخل GitHub Pages
    const basePath = location.pathname.endsWith("/")
      ? location.pathname
      : location.pathname.replace(/\/[^\/]*$/, "/");

    const urls = [
      `${basePath}data.json?v=${Date.now()}`,
      `./data.json?v=${Date.now()}`
    ];

    let data = null;
    let usedUrl = null;

    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status} عند ${url}`);
        data = await res.json();
        usedUrl = url;
        break;
      } catch (e) {
        // جرّب الرابط الثاني
      }
    }

    if (!data) {
      showError("لم استطع قراءة data.json", `جرّبت:\n- ${urls.join("\n- ")}`);
      return;
    }

    // ✅ هذه هي البنية عندك: categories -> items
    const categories = Array.isArray(data.categories) ? data.categories : null;
    if (!categories) {
      showError("شكل data.json غير صحيح",
        `المتوقع: { "categories": [ { "name": "...", "items":[...] } ] }\nتم التحميل من: ${usedUrl}`
      );
      return;
    }

    // بناء القائمة
    roomType.innerHTML = `<option value="" selected>اختر نوع الغرفة…</option>`;

    let totalItems = 0;

    categories.forEach((cat) => {
      const items = Array.isArray(cat.items) ? cat.items : [];
      if (!items.length) return;

      const og = document.createElement("optgroup");
      og.label = cat.name || "Category";

      items.forEach((it) => {
        // label عربي افتراضي (ولو ما وجد نستخدم الإنجليزي)
        const label = it.label_ar || it.label_en || it.id || "Room";
        const ach = Number(it.ach ?? 0);
        const p = Number(it.pressureOffset ?? 0);

        const opt = document.createElement("option");
        opt.value = String(it.id ?? label);

        // نخزن بيانات الحساب داخل الداتا سِت
        opt.dataset.ach = String(ach);
        opt.dataset.pressureOffset = String(p);
        opt.textContent = `${label} (ACH ${ach}${p ? `, ΔP ${p}` : ""})`;

        og.appendChild(opt);
        totalItems++;
      });

      roomType.appendChild(og);
    });

    if (!totalItems) {
      showError("القوائم فاضية", "categories موجودة لكن items فاضية.");
      return;
    }

    result.innerHTML = `<div class="muted">تم تحميل ${totalItems} غرفة ✅</div>`;
  }

  function calc() {
    const opt = roomType.selectedOptions?.[0];
    if (!opt || !opt.value) {
      result.innerHTML = `<div class="muted">اختر نوع الغرفة أول.</div>`;
      return;
    }

    const vol = parseFloat(volumeEl?.value || "0");
    if (!vol || vol <= 0) {
      result.innerHTML = `<div class="muted">دخل حجم الغرفة (m³) بشكل صحيح.</div>`;
      return;
    }

    const override = parseFloat(achOverrideEl?.value || "");
    const ach = Number.isFinite(override) ? override : parseFloat(opt.dataset.ach || "0");

    if (!ach || ach <= 0) {
      result.innerHTML = `<div class="muted">النوع المختار ما له ACH صحيح.</div>`;
      return;
    }

    const pressureOffset = parseFloat(opt.dataset.pressureOffset || "0");

    // CFM = (ACH * Volume(m3) / 60) * 35.3147
    const cfm = (ach * vol / 60) * 35.3147;

    result.innerHTML = `
      <div style="display:grid;gap:8px">
        <div><b>نوع الغرفة:</b> ${opt.textContent}</div>
        <div><b>الحجم (m³):</b> ${vol}</div>
        <div><b>ACH:</b> ${ach}</div>
        <div><b>الضغط (Pressure Offset):</b> ${pressureOffset}</div>
        <div><b>التدفق المطلوب:</b> ${cfm.toFixed(1)} CFM</div>
      </div>
    `;
  }

  calcBtn?.addEventListener("click", calc);

  loadData();
})();