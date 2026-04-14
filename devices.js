(function () {
  'use strict';

  function calcRoom(room, vol, ppl, devBtu) {
    var base = vol * room.factor;
    var pplb = ppl * 400;
    var sub = base + pplb + devBtu;
    var total = sub * 1.10;
    var tr = total / 12000;
    var cfm = Math.round(tr * 400);
    var mkt = Math.ceil(total / 9000) * 9000;

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
    var ft3 = vol * 35.3147;

    var sup = Math.round((room.tach * ft3) / 60);
    var oa = Math.round((room.oach * ft3) / 60);

    var exh =
      room.pres === 'negative'
        ? Math.round(sup * 1.10)
        : room.pres === 'positive'
        ? Math.round(sup * 0.90)
        : sup;

    var base = sup * 1.08 * 20;
    var pplb = ppl * 400;
    var sub = base + pplb + devBtu;
    var total = sub * 1.10;
    var tr = total / 12000;
    var mkt = Math.ceil(total / 9000) * 9000;

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
