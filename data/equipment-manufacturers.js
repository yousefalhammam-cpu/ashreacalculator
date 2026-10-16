(function () {
  'use strict';

  var now = '2026-07-23T00:00:00.000Z';
  var names = [
    'Zamil',
    'Carrier',
    'Trane',
    'York',
    'Daikin',
    'Mitsubishi Electric',
    'Mitsubishi Heavy Industries',
    'LG',
    'Samsung',
    'Gree',
    'Midea',
    'Haier',
    'AUX',
    'Fujitsu',
    'O General',
    'Hitachi',
    'Panasonic',
    'Toshiba',
    'Rheem',
    'Lennox',
    'SKM',
    'Petra',
    'Blue Star'
  ];

  function idFromName(name) {
    return String(name || '')
      .toLowerCase()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  var logos={zamil:'zamil.svg',carrier:'carrier.png',daikin:'daikin.svg',haier:'haier.png',lg:'lg.svg',midea:'midea.webp',samsung:'samsung.svg',skm:'skm.png',trane:'trane.png'};
  var script=typeof document!=='undefined'?document.currentScript:null;
  var assetRoot=script && script.src?new URL('../assets/manufacturers/',script.src).href:'../assets/manufacturers/';
  window.AirCalcManufacturerLogo=function(name){
    var key=idFromName(name);
    var file=logos[key];
    if(!file)return '';
    return '<img class="equipment-brand-logo" alt="" width="88" height="32" loading="lazy" style="object-fit:contain;box-sizing:border-box;padding:4px;background:'+(key==='haier'?'#005aaa':'#fff')+';border-radius:4px;vertical-align:middle;margin-inline-end:8px" src="'+assetRoot+file+'">';
  };
  window.AirCalcEquipmentManufacturers = names.map(function (name) {
    return {
      id: idFromName(name),
      name: name,
      verifiedModelCount: 0,
      pendingModelCount: 0,
      lastUpdated: '',
      dataAvailabilityStatus: 'none',
      notes: 'Manufacturer registry entry only. No verified catalogue models are included yet.',
      createdAt: now,
      updatedAt: now
    };
  });
})();
