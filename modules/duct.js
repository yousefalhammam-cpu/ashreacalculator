// â”€â”€ AirCalc Pro â€” modules/duct.js â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Owns: all duct sizing math, velocity ratings, ESP, duct CFM resolution.
// Exposed on window.AppDuct so both app.js and future modules can call them.
// app.js still re-declares most of these as globals â€” those will be removed
// in a later phase. For now, this file runs BEFORE app.js so it sets up
// window.AppDuct; app.js can safely be left as-is (no double-init risk
// because these are pure math helpers, not UI bootstraps).

(function () {
  'use strict';

  // â”€â”€ Ducted system type list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  var DUCT_DUCTED_TYPES = ['ducted', 'package', 'vrf', 'fcu', 'ahu', 'chillerfcu', 'chiller'];

  function isDucted(utKey) {
    return DUCT_DUCTED_TYPES.indexOf(utKey || '') >= 0;
  }

  // â”€â”€ DUCT_STD: populated by buildDuctStd() once data.json is loaded â”€â”€â”€â”€â”€â”€â”€â”€
  var DUCT_STD = [];

  // Default duct dimension arrays (overridden by data.json on load)
  var _widths  = [150,200,250,300,350,400,450,500,600,700,800,900,1000,1100,1200];
  var _heights = [100,150,200,250,300,350,400,450,500,600,700,800];

  function buildDuctStd(widths, heights) {
    var w = widths  || _widths;
    var h = heights || _heights;
    var arr = [];
    for (var wi = 0; wi < w.length; wi++) {
      for (var hi = 0; hi < h.length; hi++) {
        var ww = w[wi], hh = h[hi];
        var ratio = ww >= hh ? ww / hh : hh / ww;
        if (ratio <= 4) arr.push([ww, hh]);
      }
    }
    arr.sort(function (a, b) { return (a[0] * a[1]) - (b[0] * b[1]); });
    DUCT_STD = arr;
    return DUCT_STD;
  }

  // Build with defaults immediately (gets rebuilt after data.json loads)
  buildDuctStd();


  // â”€â”€ ductSizeLabel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function ductSizeLabel(d) {
    if (!d) return 'â€”';
    return d.w + '×' + d.h + ' mm';
  }

  // â”€â”€ getDuctCfm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Resolves Q for duct sizing only â€” does NOT affect thermal load calcs.
  // Priority: unit-catalog CFM â†’ TR Ã— cfmPerTr â†’ fallbackCfm
  function getDuctCfm(utKey, selBtu, fallbackCfm, cfmPerTr) {
    cfmPerTr = cfmPerTr || 400;
    // Need AC_CATALOG via getCatalog (still in app.js for now)
    var cat = (typeof getCatalog === 'function') ? getCatalog(utKey) : [];
    var catalogCfm = 0;
    // Priority 1: catalog entry has explicit CFM
    for (var ci = 0; ci < cat.length; ci++) {
      if (cat[ci].btu === selBtu && cat[ci].cfm && cat[ci].cfm > 0) {
        catalogCfm = cat[ci].cfm;
        break;
      }
    }
    if (window.AirCalcEngineering && typeof window.AirCalcEngineering.resolveDuctCfm === 'function') {
      var resolved = window.AirCalcEngineering.resolveDuctCfm({
        selectedBtuh: selBtu,
        fallbackCfm: fallbackCfm,
        cfmPerTr: cfmPerTr,
        catalogCfm: catalogCfm
      });
      if (resolved && resolved.ok === false) {
        return { cfm: Math.max(1, fallbackCfm || 0), source: 'calc', label: 'CFM Source: Calculated Supply CFM' };
      }
      if (resolved.source === 'unit') return { cfm: resolved.cfm, source: 'unit', label: 'CFM Source: Selected Unit CFM' };
      if (resolved.source === 'tr') return { cfm: resolved.cfm, source: 'tr', label: 'CFM Source: Selected TR × ' + cfmPerTr };
      return { cfm: resolved.cfm, source: 'calc', label: 'CFM Source: Calculated Supply CFM' };
    }
    if (catalogCfm > 0) return { cfm: catalogCfm, source: 'unit', label: 'CFM Source: Selected Unit CFM' };
    // Priority 2: derive from selected TR
    if (selBtu > 0) {
      var selTr = selBtu / 12000;
      var derived = Math.round(selTr * cfmPerTr);
      if (derived > 0) {
        return { cfm: derived, source: 'tr', label: 'CFM Source: Selected TR × ' + cfmPerTr };
      }
    }
    // Priority 3: computed supply CFM fallback
    return { cfm: Math.max(1, fallbackCfm || 0), source: 'calc', label: 'CFM Source: Calculated Supply CFM' };
  }

  // â”€â”€ getProjDuctCfm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Project mode: multiply per-unit CFM by qty (for unit/tr sources)
  function getProjDuctCfm(utKey, selBtu, qty, fallbackTotalCfm, cfmPerTr) {
    cfmPerTr = cfmPerTr || 400;
    var per = getDuctCfm(utKey, selBtu, 0, cfmPerTr);
    if (per.source === 'unit' || per.source === 'tr') {
      var totalCfm = per.cfm * Math.max(1, qty || 1);
      return { cfm: totalCfm, source: per.source, label: per.label + ' × ' + Math.max(1, qty || 1) + ' units' };
    }
    return { cfm: Math.max(1, fallbackTotalCfm || 0), source: 'calc', label: 'CFM Source: Calculated Total CFM' };
  }

  // â”€â”€ getDuctVelocityRating â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // Returns {rating, badge, color, bg, border} or null
  function getDuctVelocityRating(actualFpm, ductType, isHealthcare) {
    if (!actualFpm || actualFpm <= 0) return null;
    var lims;
    if (ductType === 'supply') {
      lims = isHealthcare
        ? [{ max: 600,  r: 'Low',        e: 'ðŸ”µ', c: '#1d4ed8', bg: '#dbeafe', bd: '#93c5fd' },
           { max: 800,  r: 'Excellent',  e: 'âœ…', c: '#166534', bg: '#dcfce7', bd: '#86efac' },
           { max: 1000, r: 'Acceptable', e: 'ðŸŸ¡', c: '#374151', bg: '#f3f4f6', bd: '#d1d5db' },
           { max: 1200, r: 'High',       e: 'âš ',  c: '#92400e', bg: '#fef3c7', bd: '#fcd34d' },
           { max: 9999, r: 'Critical',   e: 'â›”', c: '#991b1b', bg: '#fee2e2', bd: '#fca5a5' }]
        : [{ max: 700,  r: 'Low',        e: 'ðŸ”µ', c: '#1d4ed8', bg: '#dbeafe', bd: '#93c5fd' },
           { max: 900,  r: 'Excellent',  e: 'âœ…', c: '#166534', bg: '#dcfce7', bd: '#86efac' },
           { max: 1100, r: 'Acceptable', e: 'ðŸŸ¡', c: '#374151', bg: '#f3f4f6', bd: '#d1d5db' },
           { max: 1400, r: 'High',       e: 'âš ',  c: '#92400e', bg: '#fef3c7', bd: '#fcd34d' },
           { max: 9999, r: 'Critical',   e: 'â›”', c: '#991b1b', bg: '#fee2e2', bd: '#fca5a5' }];
    } else {
      lims = isHealthcare
        ? [{ max: 450,  r: 'Low',        e: 'ðŸ”µ', c: '#1d4ed8', bg: '#dbeafe', bd: '#93c5fd' },
           { max: 650,  r: 'Excellent',  e: 'âœ…', c: '#166534', bg: '#dcfce7', bd: '#86efac' },
           { max: 850,  r: 'Acceptable', e: 'ðŸŸ¡', c: '#374151', bg: '#f3f4f6', bd: '#d1d5db' },
           { max: 1000, r: 'High',       e: 'âš ',  c: '#92400e', bg: '#fef3c7', bd: '#fcd34d' },
           { max: 9999, r: 'Critical',   e: 'â›”', c: '#991b1b', bg: '#fee2e2', bd: '#fca5a5' }]
        : [{ max: 500,  r: 'Low',        e: 'ðŸ”µ', c: '#1d4ed8', bg: '#dbeafe', bd: '#93c5fd' },
           { max: 700,  r: 'Excellent',  e: 'âœ…', c: '#166534', bg: '#dcfce7', bd: '#86efac' },
           { max: 900,  r: 'Acceptable', e: 'ðŸŸ¡', c: '#374151', bg: '#f3f4f6', bd: '#d1d5db' },
           { max: 1100, r: 'High',       e: 'âš ',  c: '#92400e', bg: '#fef3c7', bd: '#fcd34d' },
           { max: 9999, r: 'Critical',   e: 'â›”', c: '#991b1b', bg: '#fee2e2', bd: '#fca5a5' }];
    }
    for (var k = 0; k < lims.length; k++) {
      if (actualFpm <= lims[k].max) return lims[k];
    }
    return lims[lims.length - 1];
  }

  // â”€â”€ ratingBadge â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function ratingBadge(rt, isAr) {
    if (!rt) return 'â€”';
    var lbl = isAr
      ? ({ 'Excellent': 'Ù…Ù…ØªØ§Ø²', 'Acceptable': 'Ù…Ù‚Ø¨ÙˆÙ„', 'High': 'Ù…Ø±ØªÙØ¹', 'Critical': 'Ø­Ø±Ø¬', 'Low': 'Ù…Ù†Ø®ÙØ¶' }[rt.r] || rt.r)
      : rt.r;
    return '<span style="display:inline-flex;align-items:center;gap:3px;background:' + rt.bg +
      ';color:' + rt.c + ';border:1px solid ' + rt.bd +
      ';border-radius:10px;padding:2px 8px;font-size:10px;font-weight:700;white-space:nowrap">' +
      rt.e + ' ' + lbl + '</span>';
  }

  // â”€â”€ ductRecommendation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  function ductRecommendation(supRt, retRt, isAr) {
    var worst = 'Excellent';
    var order = ['Low', 'Excellent', 'Acceptable', 'High', 'Critical'];
    var sr = supRt ? supRt.r : 'Excellent';
    var rr = retRt ? retRt.r : 'Excellent';
    if (order.indexOf(sr) > order.indexOf(worst)) worst = sr;
    if (order.indexOf(rr) > order.indexOf(worst)) worst = rr;
    if (worst === 'High' || worst === 'Critical') {
      return isAr
        ? 'âš  ÙŠÙÙØ¶ÙŽÙ‘Ù„ Ø²ÙŠØ§Ø¯Ø© Ù…Ù‚Ø§Ø³ Ø§Ù„Ù…Ø¬Ø±Ù‰ Ù„ØªÙ‚Ù„ÙŠÙ„ Ø§Ù„Ø¶ÙˆØ¶Ø§Ø¡ ÙˆØ§Ù„Ø¶ØºØ· Ø§Ù„Ø³Ø§ÙƒÙ†.'
        : 'âš  Consider increasing duct size to reduce noise & static pressure.';
    }
    return isAr
      ? 'âœ… Ø§Ù„Ø³Ø±Ø¹Ø© Ù…Ù†Ø§Ø³Ø¨Ø© Ù…Ù† Ø§Ù„Ù†Ø§Ø­ÙŠØ© Ø§Ù„ÙÙ†ÙŠØ©.'
      : 'âœ… Velocity is within acceptable engineering limits.';
  }

  // â”€â”€ calcESP â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // External Static Pressure estimation (Pa)
  // Friction + Fittings (K=0.3 per bend) + Fixed adder (50 Pa)
  function calcESP() {
    var isAr = (typeof lang !== 'undefined') ? lang === 'ar' : false;
    var G = window.AppHelpers ? window.AppHelpers.G : function (id) { return document.getElementById(id); };
    var thresholds = (window.AirCalcEngineering && window.AirCalcEngineering.VALIDATION_THRESHOLDS) || {
      ESP_LOW_MAX_PA: 125,
      ESP_SUMMARY_MEDIUM_MAX_PA: 225
    };
    var espBlock = G('esp-block');
    if (!espBlock) return;

    var lenSup = parseFloat((G('esp-len-sup') || { value: '30' }).value) || 30;
    var lenRet = parseFloat((G('esp-len-ret') || { value: '20' }).value) || 20;
    var bends  = parseInt((G('esp-bends')    || { value: '4'  }).value) || 4;
    var fric   = parseFloat((G('esp-fric')   || { value: '1.0'}).value) || 1.0;
    var vSup   = parseInt((G('duct-vel-sup') || { value: '1000'}).value) || 1000;

    // fpm â†’ m/s â†’ dynamic pressure (Pa)
    var vMs   = vSup * 0.00508;
    var dynPa = 0.5 * 1.2 * vMs * vMs;

    var frictionLoss = (lenSup + lenRet) * fric;
    var fittingLoss  = bends * 0.3 * dynPa;  // K = 0.3 typical elbow
    var adderLoss    = 50;                    // 30 Pa diffuser + 20 Pa filter
    var totalEsp     = Math.round(frictionLoss + fittingLoss + adderLoss);

    var espClass, espColor, espIcon, badgeCls;
    if (totalEsp < thresholds.ESP_LOW_MAX_PA) {
      espClass = isAr ? 'Ù…Ù†Ø®ÙØ¶' : 'Low';
      espColor = '#065f46'; espIcon = 'ðŸŸ¢'; badgeCls = 'esp-low';
    } else if (totalEsp <= thresholds.ESP_SUMMARY_MEDIUM_MAX_PA) {
      espClass = isAr ? 'Ù…ØªÙˆØ³Ø·' : 'Medium';
      espColor = '#92400e'; espIcon = 'ðŸŸ¡'; badgeCls = 'esp-med';
    } else {
      espClass = isAr ? 'Ø¹Ø§Ù„Ù' : 'High';
      espColor = '#991b1b'; espIcon = 'ðŸ”´'; badgeCls = 'esp-high';
    }

    var espResult = G('esp-result');
    if (espResult) {
      espResult.innerHTML =
        '<span class="esp-badge ' + badgeCls + '">' + espIcon + ' ' + espClass + ' â€” ' + totalEsp + ' Pa</span>' +
        '<span style="font-size:9px;color:var(--tm)">' + (isAr
          ? 'Ø§Ø­ØªÙƒØ§Ùƒ: ' + Math.round(frictionLoss) + ' + ÙˆØµÙ„Ø§Øª: ' + Math.round(fittingLoss) + ' + Ø¥Ø¶Ø§ÙÙŠ: ' + adderLoss + ' Pa'
          : 'Friction: '  + Math.round(frictionLoss) + ' + Fittings: ' + Math.round(fittingLoss) + ' + Adders: ' + adderLoss + ' Pa'
        ) + '</span>';
    }

    return { total: totalEsp, friction: Math.round(frictionLoss), fittings: Math.round(fittingLoss), adders: adderLoss, cls: espClass };
  }

  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
  // ASHRAE ADVANCED DUCT ANALYSIS HELPERS
  // Reference: ASHRAE Fundamentals Handbook, Chapter 21 (Duct Design)
  //            Darcy-Weisbach equation for duct friction loss
  // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

  // Engineering constants (ASHRAE standard air, sea level, 20Â°C / 68Â°F)
  var ASHRAE = {
    rho:       1.2,       // air density [kg/mÂ³] â€” standard air at 20Â°C
    rho_lbft3: 0.075,     // [lb/ftÂ³] â€” ASHRAE standard for Pv formula
    f:         0.02,      // Darcy friction factor â€” smooth galvanised steel, preliminary
                          // (valid for Re 100kâ€“1M, Îµ/Dh â‰ˆ 0.0003, ASHRAE Table 21-1)
    fpm_to_ms: 0.00508,   // 1 fpm = 0.00508 m/s
    inwg_to_pa:249.089,   // 1 in.w.g. = 249.089 Pa
    ft_to_m:   0.3048,
    mm_to_ft:  0.00328084,
    in_to_ft:  0.08333333
  };

  /**
   * rectAreaFt2 â€” rectangular duct cross-section area
   * @param {number} W_mm  duct width  [mm]
   * @param {number} H_mm  duct height [mm]
   * @returns {number} area [ftÂ²]
   * Formula: A = (WÃ—H) / 92903.04   [ASHRAE Ch.21, unit conversion]
   */
  function rectAreaFt2(W_mm, H_mm) {
    return (W_mm * H_mm) / 92903.04;
  }

  /**
   * rectPerimFt â€” rectangular duct wetted perimeter
   * @param {number} W_mm  [mm]
   * @param {number} H_mm  [mm]
   * @returns {number} perimeter [ft]
   * Formula: P = 2(W + H) in feet
   */
  function rectPerimFt(W_mm, H_mm) {
    // mm â†’ ft: divide by (25.4 Ã— 12) = 304.8
    return 2 * (W_mm + H_mm) / 304.8;
  }

  /**
   * hydraulicDiameter â€” Dh for rectangular duct
   * @param {number} W_mm  [mm]
   * @param {number} H_mm  [mm]
   * @returns {{ Dh_ft: number, Dh_in: number, Dh_mm: number }}
   * ASHRAE Eq. 21-1:  Dh = 4A / P
   */
  function hydraulicDiameter(W_mm, H_mm) {
    var A = rectAreaFt2(W_mm, H_mm);
    var P = rectPerimFt(W_mm, H_mm);
    if (P <= 0) return { Dh_ft: 0, Dh_in: 0, Dh_mm: 0 };
    var Dh_ft = (4 * A) / P;
    return {
      Dh_ft: Dh_ft,
      Dh_in: Dh_ft * 12,
      Dh_mm: Dh_ft * 304.8
    };
  }

  /**
   * ductVelocity â€” air velocity in duct
   * @param {number} Q_cfm  airflow [CFM]
   * @param {number} A_ft2  duct area [ftÂ²]
   * @returns {{ V_fpm: number, V_ms: number }}
   * ASHRAE continuity: V = Q / A
   */
  function ductVelocity(Q_cfm, A_ft2) {
    if (A_ft2 <= 0) return { V_fpm: 0, V_ms: 0 };
    var V_fpm = Q_cfm / A_ft2;
    return {
      V_fpm: V_fpm,
      V_ms:  V_fpm * ASHRAE.fpm_to_ms
    };
  }

  /**
   * velocityPressure â€” dynamic pressure of moving air
   * @param {number} V_fpm  air velocity [fpm]
   * @returns {{ Pv_inwg: number, Pv_pa: number }}
   * ASHRAE Eq. 21-2:  Pv [in.w.g.] = (V / 4005)Â²
   * (exact for Ï = 0.075 lb/ftÂ³ standard air)
   */
  function velocityPressure(V_fpm) {
    var Pv_inwg = Math.pow(V_fpm / 4005, 2);
    return {
      Pv_inwg: Pv_inwg,
      Pv_pa:   Pv_inwg * ASHRAE.inwg_to_pa
    };
  }

  /**
   * straightFrictionLoss â€” Darcy-Weisbach friction loss for straight duct
   * @param {number} L_ft   duct length  [ft]
   * @param {number} Dh_ft  hydraulic diameter [ft]
   * @param {number} Pv_inwg velocity pressure [in.w.g.]
   * @returns {{ dP_inwg: number, dP_pa: number, dP_per100ft_inwg: number }}
   * ASHRAE Ch.21 / Darcy-Weisbach:
   *   Î”Pf = f Ã— (L / Dh) Ã— Pv
   *   f = 0.02 (smooth galvanised steel, preliminary â€” ASHRAE Table 21-1)
   */
  function straightFrictionLoss(L_ft, Dh_ft, Pv_inwg) {
    if (Dh_ft <= 0) return { dP_inwg: 0, dP_pa: 0, dP_per100ft_inwg: 0 };
    var dP_inwg = ASHRAE.f * (L_ft / Dh_ft) * Pv_inwg;
    var per100  = ASHRAE.f * (100  / Dh_ft) * Pv_inwg;
    return {
      dP_inwg:          dP_inwg,
      dP_pa:            dP_inwg * ASHRAE.inwg_to_pa,
      dP_per100ft_inwg: per100
    };
  }

  /**
   * advancedDuctAnalysis â€” complete ASHRAE-based analysis for one duct section
   * @param {number} Q_cfm      airflow [CFM]
   * @param {number} W_mm       duct width  [mm]
   * @param {number} H_mm       duct height [mm]
   * @param {number} L_m        duct run length [m]  (supply or return)
   * @returns {object} full analysis result
   */
  function advancedDuctAnalysis(Q_cfm, W_mm, H_mm, L_m) {
    if (window.AirCalcEngineering && typeof window.AirCalcEngineering.calculateAdvancedDuctAnalysis === 'function') {
      var engineAnalysis = window.AirCalcEngineering.calculateAdvancedDuctAnalysis({
        cfm: Q_cfm,
        widthMm: W_mm,
        heightMm: H_mm,
        lengthM: L_m,
        frictionFactor: ASHRAE.f
      });
      return engineAnalysis && engineAnalysis.ok === false ? null : engineAnalysis;
    }
    if (!Q_cfm || Q_cfm <= 0 || !W_mm || !H_mm) return null;

    var L_ft  = (L_m || 0) * (1 / ASHRAE.ft_to_m);   // m â†’ ft
    var A_ft2 = rectAreaFt2(W_mm, H_mm);
    var P_ft  = rectPerimFt(W_mm, H_mm);
    var Dh    = hydraulicDiameter(W_mm, H_mm);
    var vel   = ductVelocity(Q_cfm, A_ft2);
    var Pv    = velocityPressure(vel.V_fpm);
    var fric  = L_ft > 0 ? straightFrictionLoss(L_ft, Dh.Dh_ft, Pv.Pv_inwg) : null;

    return {
      // Inputs (for display)
      Q_cfm:   Q_cfm,
      W_mm:    W_mm,
      H_mm:    H_mm,
      L_m:     L_m || 0,
      L_ft:    Math.round(L_ft * 10) / 10,
      // Area
      A_ft2:   Math.round(A_ft2 * 10000) / 10000,
      A_m2:    Math.round(A_ft2 * 0.0929 * 10000) / 10000,
      // Velocity (ASHRAE Q = A Ã— V)
      V_fpm:   Math.round(vel.V_fpm),
      V_ms:    Math.round(vel.V_ms * 100) / 100,
      // Hydraulic diameter (ASHRAE Eq. 21-1: Dh = 4A/P)
      Dh_in:   Math.round(Dh.Dh_in * 10) / 10,
      Dh_mm:   Math.round(Dh.Dh_mm),
      // Velocity pressure (ASHRAE Eq. 21-2: Pv = (V/4005)Â²)
      Pv_inwg: Math.round(Pv.Pv_inwg * 1000) / 1000,
      Pv_pa:   Math.round(Pv.Pv_pa * 10) / 10,
      // Straight friction loss (Darcy-Weisbach, f=0.02)
      dP_inwg:          fric ? Math.round(fric.dP_inwg  * 1000) / 1000 : null,
      dP_pa:            fric ? Math.round(fric.dP_pa    * 10)   / 10   : null,
      dP_per100ft_inwg: fric ? Math.round(fric.dP_per100ft_inwg * 1000) / 1000 : null,
      // Friction factor used
      f_used: ASHRAE.f,
      // Note
      note: 'Darcy-Weisbach, f=0.02 (galvanised steel, preliminary). ASHRAE Ch.21.'
    };
  }

  // â”€â”€ Expose â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  var ASHRAE_RECT_TARGET_RATIO = 2.0;
  var ASHRAE_RECT_MAX_RATIO = 4.0;
  var ASHRAE_MAX_DUCT_FPM = 2500;

  function _ductCandidateScore(ww, hh, areaMm2, actualFpm) {
    var ratio = Math.max(ww, hh) / Math.min(ww, hh);
    var oversize = ((ww * hh) - areaMm2) / Math.max(areaMm2, 1);
    var ratioPenalty = Math.abs(ratio - ASHRAE_RECT_TARGET_RATIO);
    var velocityPenalty = actualFpm > ASHRAE_MAX_DUCT_FPM ? 1000 + (actualFpm - ASHRAE_MAX_DUCT_FPM) : 0;
    return velocityPenalty + (oversize * 10) + ratioPenalty;
  }

  function _makeDuctCandidate(ww, hh, areaMm2, cfm, velocityFpm, method) {
    var aFt2 = (ww * hh) / 92903.04;
    var actualFpm = aFt2 > 0 ? Math.round(cfm / aFt2) : velocityFpm;
    return {
      w: ww,
      h: hh,
      area_required: Math.round(areaMm2),
      area_actual: ww * hh,
      ratio: (Math.max(ww, hh) / Math.min(ww, hh)).toFixed(2),
      method: method,
      actualFpm: actualFpm,
      score: _ductCandidateScore(ww, hh, areaMm2, actualFpm)
    };
  }

  function calcDuctSize(cfm, velocityFpm) {
    if (window.AirCalcEngineering && typeof window.AirCalcEngineering.calculateDuctSize === 'function') {
      var engineDuct = window.AirCalcEngineering.calculateDuctSize({
        cfm: cfm,
        velocityFpm: velocityFpm,
        standardSizes: DUCT_STD,
        minSideMm: 150,
        maxSideMm: 1800,
        maxAspectRatio: ASHRAE_RECT_MAX_RATIO,
        preferredHeightsMm: [150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800]
      });
      return engineDuct && engineDuct.ok === false ? null : engineDuct;
    }
    if (!cfm || cfm <= 0) return null;
    var areaFt2 = cfm / velocityFpm;
    var areaMm2 = areaFt2 * 92903.04;
    var minSide = 150;
    var maxSide = 1800;
    var stdBest = null;
    var best = null;
    var prefHeights = [150, 200, 250, 300, 350, 400, 450, 500, 600, 700, 800];

    for (var si = 0; si < DUCT_STD.length; si++) {
      var sw = DUCT_STD[si][0], sh = DUCT_STD[si][1];
      var stdRatio = Math.max(sw, sh) / Math.min(sw, sh);
      if (sw >= minSide && sh >= minSide && sw <= maxSide && sh <= maxSide &&
          stdRatio <= ASHRAE_RECT_MAX_RATIO && sw * sh >= areaMm2) {
        var stdCand = _makeDuctCandidate(sw, sh, areaMm2, cfm, velocityFpm, 'std');
        if (!stdBest || stdCand.score < stdBest.score) stdBest = stdCand;
      }
    }

    for (var pi = 0; pi < prefHeights.length; pi++) {
      var ph = prefHeights[pi];
      var wRaw = areaMm2 / ph;
      var pw = Math.ceil(wRaw / 50) * 50;
      if (pw < minSide) pw = minSide;
      var ratio = Math.max(pw, ph) / Math.min(pw, ph);
      if (pw <= maxSide && ratio <= ASHRAE_RECT_MAX_RATIO) {
        var calcCand = _makeDuctCandidate(pw, ph, areaMm2, cfm, velocityFpm, 'calc');
        if (!best || calcCand.score < best.score) best = calcCand;
      }
    }

    if (!best) {
      var fh = 800, fwRaw = areaMm2 / fh, fw = Math.max(minSide, Math.ceil(fwRaw / 50) * 50);
      best = _makeDuctCandidate(fw, fh, areaMm2, cfm, velocityFpm, 'calc');
    }

    return { calc: best, std: stdBest || best };
  }

  window.AppDuct = {
    isDucted:                isDucted,
    buildDuctStd:            buildDuctStd,
    calcDuctSize:            calcDuctSize,
    ductSizeLabel:           ductSizeLabel,
    getDuctCfm:              getDuctCfm,
    getProjDuctCfm:          getProjDuctCfm,
    getDuctVelocityRating:   getDuctVelocityRating,
    ratingBadge:             ratingBadge,
    ductRecommendation:      ductRecommendation,
    calcESP:                 calcESP,
    DUCT_DUCTED_TYPES:       DUCT_DUCTED_TYPES,
    getDuctStd:              function () { return DUCT_STD; },
    // ASHRAE advanced helpers
    rectAreaFt2:             rectAreaFt2,
    rectPerimFt:             rectPerimFt,
    hydraulicDiameter:       hydraulicDiameter,
    ductVelocity:            ductVelocity,
    velocityPressure:        velocityPressure,
    straightFrictionLoss:    straightFrictionLoss,
    advancedDuctAnalysis:    advancedDuctAnalysis,
    ASHRAE:                  ASHRAE
  };

  console.log('[AirCalc] AppDuct initialised');
})();
