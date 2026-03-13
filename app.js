// ── ESP Calculation (IMPROVED) ──────────────────────────────────────────
// Changes vs original:
//   • Derives actual supply velocity from real duct dimensions + Q_design CFM
//     rather than using the raw duct-vel-sup slider value
//   • Q_design is pulled from the live project/room totals so ESP updates
//     automatically when rooms, loads, or duct sizes change
//   • Return duct velocity is also derived from its own duct dims (Q × 0.9)
//   • Breakdown now shows Supply velocity, Return velocity, and where CFM came from
//   • Classification thresholds and adder logic unchanged (30 Pa diffuser + 20 Pa filter)
function calcESP(){
  var isAr = lang === 'ar';
  var espBlock = G('esp-block');
  if (!espBlock) return;

  // ── 1. Gather manual inputs ──────────────────────────────────────
  var lenSup = parseFloat((G('esp-len-sup') || {value:'30'}).value) || 30;   // m
  var lenRet = parseFloat((G('esp-len-ret') || {value:'20'}).value) || 20;   // m
  var bends  = parseInt ((G('esp-bends')   || {value:'4' }).value) || 4;
  var fric   = parseFloat((G('esp-fric')   || {value:'1.0'}).value) || 1.0;  // Pa/m

  // ── 2. Resolve Q_design CFM (same logic used by duct sizing) ────
  // Priority:
  //   Project mode/bundle  -> project total CFM
  //   Room mode            -> current room CFM if available, else sum of rooms
  //   Fallback             -> TR × CFM/TR
  var _cfmPerTr = parseInt((G('duct-cfm-per-tr') || {value:'400'}).value) || 400;
  var Q_design  = 0;
  var cfmSource = '';

  if (quoteMode === 'proj' || bundleOn) {
    var _totalCfm = getProjTotalCfm();
    var _totalTr  = getProjTotalTr();

    if (_totalCfm > 0) {
      Q_design  = Math.round(_totalCfm);
      cfmSource = isAr ? 'إجمالي CFM المشروع' : 'Project total CFM';
    } else if (_totalTr > 0) {
      Q_design  = Math.round(_totalTr * _cfmPerTr);
      cfmSource = isAr ? ('TR × ' + _cfmPerTr) : ('TR × ' + _cfmPerTr + ' CFM/TR');
    }
  } else {
    // Prefer current displayed room CFM when available
    var _currentRoomCfm = parseInt((G('vcfm') || {textContent:'0'}).textContent.toString().replace(/,/g,'')) || 0;
    if (_currentRoomCfm > 0) {
      Q_design  = _currentRoomCfm;
      cfmSource = isAr ? 'CFM الغرفة الحالية' : 'Current room CFM';
    } else {
      var _histCfm = 0;
      for (var _hi = 0; _hi < hist.length; _hi++) {
        _histCfm += parseInt(hist[_hi].cfm) || 0;
      }
      if (_histCfm > 0) {
        Q_design  = _histCfm;
        cfmSource = isAr ? 'إجمالي CFM الغرف' : 'Sum of room CFMs';
      }
    }
  }

  var vSupInput = parseInt((G('duct-vel-sup') || {value:'1000'}).value) || 1000;
  var vRetInput = parseInt((G('duct-vel-ret') || {value:'800' }).value) || 800;

  // Fallback if no project/room data yet
  if (Q_design <= 0) {
    var vMs0     = vSupInput * 0.00508;
    var dynPa0   = 0.5 * 1.2 * vMs0 * vMs0;
    var frLoss0  = (lenSup + lenRet) * fric;
    var fitLoss0 = bends * 0.3 * dynPa0;
    var total0   = Math.round(frLoss0 + fitLoss0 + 50);

    _renderESPResult(
      total0,
      frLoss0,
      fitLoss0,
      50,
      Math.round(vSupInput),
      Math.round(vRetInput),
      0,
      isAr ? 'لا توجد بيانات — استخدام السرعة المدخلة' : 'No room data — using input velocity',
      isAr
    );
    return;
  }

  // ── 3. Get actual duct dimensions and derive real velocities ─────
  // Supply uses Q_design, Return uses 90% of supply as in your duct block
  var qRet = Math.round(Q_design * 0.9);

  var supDuct = calcDuctSize(Q_design, vSupInput);
  var retDuct = calcDuctSize(qRet, vRetInput);

  var _sd = supDuct ? (supDuct.std || supDuct.calc) : null;
  var _rd = retDuct ? (retDuct.std || retDuct.calc) : null;

  // Actual velocity (fpm) = Q_cfm / A_ft²
  // 1 ft² = 92903.04 mm²
  var vSupActual = vSupInput;
  var vRetActual = vRetInput;

  if (_sd && _sd.w && _sd.h) {
    var aSupFt2 = (_sd.w * _sd.h) / 92903.04;
    vSupActual  = aSupFt2 > 0 ? Math.round(Q_design / aSupFt2) : vSupInput;
  }

  if (_rd && _rd.w && _rd.h) {
    var aRetFt2 = (_rd.w * _rd.h) / 92903.04;
    vRetActual  = aRetFt2 > 0 ? Math.round(qRet / aRetFt2) : vRetInput;
  }

  // ── 4. Dynamic pressure based on actual supply velocity ──────────
  var vMs   = vSupActual * 0.00508;   // fpm → m/s
  var dynPa = 0.5 * 1.2 * vMs * vMs;  // ρ = 1.2 kg/m³

  // ── 5. ESP components ────────────────────────────────────────────
  var frictionLoss = (lenSup + lenRet) * fric;
  var fittingLoss  = bends * 0.3 * dynPa; // K ≈ 0.3 per elbow
  var adderLoss    = 50;                  // 30 diffuser + 20 filter
  var totalEsp     = Math.round(frictionLoss + fittingLoss + adderLoss);

  // ── 6. Render ────────────────────────────────────────────────────
  _renderESPResult(
    totalEsp,
    frictionLoss,
    fittingLoss,
    adderLoss,
    vSupActual,
    vRetActual,
    Q_design,
    cfmSource,
    isAr
  );
}

// ── Internal render helper ───────────────────────────────────────────────
function _renderESPResult(totalEsp, frictionLoss, fittingLoss, adderLoss,
                          vSupFpm, vRetFpm, qCfm, cfmSource, isAr){
  var espClass, espIcon, badgeCls;

  if (totalEsp < 125) {
    espClass = isAr ? 'منخفض' : 'Low';
    espIcon  = '🟢';
    badgeCls = 'esp-low';
  } else if (totalEsp <= 250) {
    espClass = isAr ? 'متوسط' : 'Medium';
    espIcon  = '🟡';
    badgeCls = 'esp-med';
  } else {
    espClass = isAr ? 'عالٍ' : 'High';
    espIcon  = '🔴';
    badgeCls = 'esp-high';
  }

  var espResult = G('esp-result');
  if (!espResult) return;

  var ductLine = (qCfm > 0)
    ? '<span style="font-size:9px;color:var(--tm);display:block;margin-top:3px">' +
        (isAr
          ? 'Q = ' + Number(qCfm).toLocaleString() + ' CFM (' + cfmSource + ') — ' +
            'سرعة الإمداد: ' + vSupFpm + ' fpm | سرعة الرجوع: ' + vRetFpm + ' fpm'
          : 'Q = ' + Number(qCfm).toLocaleString() + ' CFM (' + cfmSource + ') — ' +
            'Sup: ' + vSupFpm + ' fpm | Ret: ' + vRetFpm + ' fpm') +
      '</span>'
    : '';

  espResult.innerHTML =
    '<span class="esp-badge ' + badgeCls + '">' + espIcon + ' ' + espClass + ' — ' + totalEsp + ' Pa</span>' +
    '<span style="font-size:9px;color:var(--tm);display:block">' + (isAr
      ? 'احتكاك: ' + Math.round(frictionLoss) +
        ' + وصلات: ' + Math.round(fittingLoss) +
        ' + إضافي: ' + adderLoss + ' Pa'
      : 'Friction: ' + Math.round(frictionLoss) +
        ' + Fittings: ' + Math.round(fittingLoss) +
        ' + Adders: ' + adderLoss + ' Pa'
    ) + '</span>' +
    ductLine;
}