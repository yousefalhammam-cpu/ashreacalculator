async function loadRef(){
  // نجرب أكثر من مسار عشان GitHub Pages أحياناً يكون داخل فولدر مشروع
  const tries = [];

  // 1) نفس المسار (الأكثر شيوعاً)
  tries.push(new URL("data.json", window.location.href).toString());

  // 2) جذر المشروع (…/ashreacalculator/)
  const basePath = window.location.pathname.endsWith("/")
    ? window.location.pathname
    : window.location.pathname.replace(/\/[^\/]*$/, "/");
  tries.push(window.location.origin + basePath + "data.json");

  // 3) محاولة أخيرة: نفس الرابط لكن مع cache bust
  // (نضيفها لكل try)
  const withBust = (u)=> u + (u.includes("?") ? "&" : "?") + "v=" + Date.now();

  let lastErr = null;
  for (const u of tries){
    try{
      const resp = await fetch(withBust(u), { cache: "no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${u}`);

      const txt = await resp.text();

      // إصلاح NaN إلى null عشان JSON.parse ما يطيح
      const cleaned = txt.replace(/\bNaN\b/g, "null");

      const parsed = JSON.parse(cleaned);
      return Array.isArray(parsed) ? parsed : [parsed];
    }catch(e){
      lastErr = e;
    }
  }

  throw lastErr || new Error("Failed to load data.json");
}