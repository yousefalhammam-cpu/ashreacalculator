  // ===== KIMO Dashboard =====
  function setText(id, v){
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = (v==null || Number.isNaN(v) || v==="") ? "—" : String(v);
  }

  function nowClock(){
    const d = new Date();
    const time = d.toLocaleTimeString("en-GB", {hour:"2-digit", minute:"2-digit"});
    const date = d.toLocaleDateString("en-GB", {day:"2-digit", month:"short", year:"numeric"});
    setText("kimoTime", time);
    setText("kimoDate", date);
  }

  function pressureMode(refPressure, measuredPa){
    // if we have measured Pa, use it
    if (measuredPa != null){
      if (measuredPa > 0.5) return "Positive";
      if (measuredPa < -0.5) return "Negative";
      return "Neutral";
    }
    // fallback to reference P/N
    const p = (refPressure || "").toString().trim().toUpperCase();
    if (p === "P") return "Positive";
    if (p === "N") return "Negative";
    return "Neutral";
  }

  function updateKimoFromRoom(r){
    if (!r) return;

    // Name
    const title = (r.roomName ? `${r.roomName} — ` : "") + (r.display || "—");
    setText("kimoRoomName", title);

    // Measured values (preferred) otherwise show calculated supply as airflow + ref pressure etc.
    const m = r.measured || {};
    const mc = r.measuredCalc || {};
    const airflow = (m.mCfm != null) ? m.mCfm : r.calc?.totalCfm;

    setText("kimoPa",  (m.mPa   != null) ? Number(m.mPa).toFixed(1) : "—");
    setText("kimoTemp",(m.mTemp != null) ? Number(m.mTemp).toFixed(1) : "—");
    setText("kimoRh",  (m.mRh   != null) ? Number(m.mRh).toFixed(1) : "—");
    setText("kimoCfm", (airflow != null) ? Math.round(airflow) : "—");
    setText("kimoAch", (mc.mAch != null) ? Number(mc.mAch).toFixed(2) : "—");

    // Mode
    setText("kimoMode", pressureMode(r.refPressure, m.mPa));

    // Bottom comparison
    const refAchNum = (typeof r.refTotalACH === "number") ? r.refTotalACH : Number(r.refTotalACH);
    setText("kimoRefAch", Number.isFinite(refAchNum) ? refAchNum : (r.refTotalACH || "—"));

    if (mc.diffAchPct != null){
      setText("kimoDelta", `${Number(mc.diffAchPct).toFixed(2)}%`);
      setText("kimoStatus", mc.status || "—");
    } else {
      setText("kimoDelta", "—");
      setText("kimoStatus", "—");
    }
  }

  // keep clock updated
  nowClock();
  setInterval(nowClock, 15000);

  // Hook: whenever we render, update KIMO dashboard with LAST room
  const _renderOld = render;
  render = function(){
    _renderOld();
    const last = rooms.length ? rooms[rooms.length - 1] : null;
    updateKimoFromRoom(last);
  };