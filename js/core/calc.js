(function () {
  'use strict';

  function calcRoom(room, vol, ppl, devBtu) {
    var eng = window.AirCalcEngineering && window.AirCalcEngineering.calculateGeneralRoom({
      volumeM3: vol,
      loadFactorBtuhPerM3: room.factor,
      peopleCount: ppl,
      deviceLoadBtuh: devBtu
    });
    var base = eng && eng.ok ? eng.baseBtuh : vol * room.factor;
    var pplb = eng && eng.ok ? eng.peopleBtuh : ppl * 400;
    var sub = eng && eng.ok ? eng.subtotalBtuh : base + pplb + devBtu;
    var total = eng && eng.ok ? eng.totalBtuh : sub * 1.10;
    var tr = eng && eng.ok ? eng.tr : total / 12000;
    var cfm = eng && eng.ok ? eng.supplyCfm : Math.round(tr * 400);
    var mkt = eng && eng.ok ? eng.marketBtuh : Math.ceil(total / 9000) * 9000;

    return {
      base: base,
      people: pplb,
      devices: devBtu,
      subtotal: sub,
      total: total,
      tr: tr,
      cfm: cfm,
      mkt: mkt
    };
  }

  function calcHC(room, vol, ppl, devBtu) {
    var eng = window.AirCalcEngineering && window.AirCalcEngineering.calculateHealthcareRoom({
      volumeM3: vol,
      totalAch: room.tach,
      outdoorAch: room.oach,
      pressure: room.pres,
      peopleCount: ppl,
      deviceLoadBtuh: devBtu
    });
    var ft3 = vol * 35.3147;
    var sup = eng && eng.ok ? eng.supplyCfm : Math.round((room.tach * ft3) / 60);
    var oa = eng && eng.ok ? eng.outdoorAirCfm : Math.round((room.oach * ft3) / 60);
    var exh = eng && eng.ok ? eng.exhaustCfm :
      room.pres === 'negative'
        ? Math.round(sup * 1.10)
        : room.pres === 'positive'
        ? Math.round(sup * 0.90)
        : sup;
    var base = eng && eng.ok ? eng.baseBtuh : sup * 1.08 * 20;
    var pplb = eng && eng.ok ? eng.peopleBtuh : ppl * 400;
    var sub = eng && eng.ok ? eng.subtotalBtuh : base + pplb + devBtu;
    var total = eng && eng.ok ? eng.totalBtuh : sub * 1.10;
    var tr = eng && eng.ok ? eng.tr : total / 12000;
    var mkt = eng && eng.ok ? eng.marketBtuh : Math.ceil(total / 9000) * 9000;

    return {
      base: base,
      people: pplb,
      devices: devBtu,
      subtotal: sub,
      total: total,
      tr: tr,
      cfm: sup,
      mkt: mkt,
      hc: {
        sup: sup,
        oa: oa,
        exh: exh,
        pres: room.pres
      }
    };
  }

  window.AppCalc = {
    calcRoom: calcRoom,
    calcHC: calcHC
  };

  console.log('[AirCalc] calc module loaded');
})();
