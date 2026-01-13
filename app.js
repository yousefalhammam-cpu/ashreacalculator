async function loadRef(){
  // ✅ Fallback داخلي (إذا فشل data.json لأي سبب)
  const INLINE_DATA = [
    {"Room Type":"Airborne Infection Isolation room (AII)","Pressure":"N","Outdoor Air ACH":2,"Total ACH":12,"Exhaust to Outdoors":"Yes","RH (%)":"30-60","Temp (°C)":"21.1-23.9"},
    {"Room Type":"Operating/Procedure Room (Class A)","Pressure":"P","Outdoor Air ACH":3,"Total ACH":15,"Exhaust to Outdoors":"No","RH (%)":"30-60","Temp (°C)":"21.1-23.9"},
    {"Room Type":"Medication room","Pressure":"P","Outdoor Air ACH":2,"Total ACH":4,"Exhaust to Outdoors":"No","RH (%)":"30-60","Temp (°C)":"21.1-23.9"},
    {"Room Type":"Laboratory - Histology","Pressure":"N","Outdoor Air ACH":2,"Total ACH":6,"Exhaust to Outdoors":"Yes","RH (%)":"30-60","Temp (°C)":"21.1-23.9"},
    {"Room Type":"Patient room","Pressure":null,"Outdoor Air ACH":2,"Total ACH":6,"Exhaust to Outdoors":"No","RH (%)":"30-60","Temp (°C)":"21.1-23.9"},
    {"Room Type":"Toilet room","Pressure":"N","Outdoor Air ACH":null,"Total ACH":10,"Exhaust to Outdoors":"Yes","RH (%)":null,"Temp (°C)":null},
    {"Room Type":"Corridor","Pressure":null,"Outdoor Air ACH":null,"Total ACH":2,"Exhaust to Outdoors":"No","RH (%)":null,"Temp (°C)":null}
  ];

  // نحاول نقرأ data.json من كذا مسار + نكسر الكاش
  const bust = (u)=> u + (u.includes("?") ? "&" : "?") + "v=" + Date.now();

  const basePath = window.location.pathname.endsWith("/")
    ? window.location.pathname
    : window.location.pathname.replace(/\/[^\/]*$/, "/");

  const tries = [
    new URL("data.json", window.location.href).toString(),
    window.location.origin + basePath + "data.json"
  ];

  let lastErr = null;

  for (const url of tries){
    try{
      const resp = await fetch(bust(url), { cache:"no-store" });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      const txt = await resp.text();

      // لو أحد لصق NaN بالغلط
      const cleaned = txt.replace(/\bNaN\b/g, "null");
      const parsed = JSON.parse(cleaned);
      const arr = Array.isArray(parsed) ? parsed : [parsed];

      // ✅ لو البيانات فعلاً فيها عناصر
      if (arr.length){
        const st = document.getElementById("statusTag");
        if (st) st.textContent = `Loaded from data.json: ${arr.length} rooms`;
        return arr;
      }
    } catch(e){
      lastErr = e;
    }
  }

  // ❗ إذا فشل data.json → نستخدم fallback الداخلي
  const st = document.getElementById("statusTag");
  if (st) st.textContent = `Fallback data used (data.json failed)`;
  console.warn("data.json failed, using INLINE_DATA. Last error:", lastErr);
  return INLINE_DATA;
}