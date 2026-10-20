(function () {
  'use strict';

  var createdAt = '2026-07-25T00:00:00.000Z';
  var sourceName = 'Daikin NZ Rooftop Package Unit RT Series UAYN-AFY1A';
  var sourceUrl = 'https://www.daikin.co.nz/pages/rooftop-package-unit-rt-series';
  var note = 'Official Daikin public product page lists model, total cooling capacity kW, airflow L/s, and ESP range 210-400 Pa. Values are imported as real catalogue seed data and require local market/engineer confirmation before final approval.';

  function kwToBtuH(kw) {
    return Math.round(Number(kw || 0) * 3412.142);
  }

  function lsToCfm(ls) {
    return Math.round(Number(ls || 0) * 2.11888);
  }

  function m3hToCfm(m3h) {
    return Math.round(Number(m3h || 0) * 0.588577);
  }

  function trToBtuH(tr) {
    return Math.round(Number(tr || 0) * 12000);
  }

  function baseRecord(input) {
    input = input || {};
    var hasCoolingCapacity = input.coolingCapacityBtuH != null && input.coolingCapacityBtuH !== '';
    var btu = hasCoolingCapacity ? Math.round(Number(input.coolingCapacityBtuH)) : null;
    var tr = input.coolingCapacityTR != null ? Number(input.coolingCapacityTR) : (btu == null ? null : Math.round((btu / 12000) * 100) / 100);
    var kw = input.coolingCapacityKw != null ? Number(input.coolingCapacityKw) : (btu == null ? null : Math.round((btu / 3412.142) * 100) / 100);
    return {
      id: input.id,
      manufacturerId: input.manufacturerId,
      manufacturerName: input.manufacturerName,
      brand: input.brand || input.manufacturerName,
      series: input.series || '',
      exactModelNumber: input.exactModelNumber,
      indoorModelNumber: input.indoorModelNumber || '',
      outdoorModelNumber: input.outdoorModelNumber || input.exactModelNumber,
      equipmentType: input.equipmentType || 'package',
      marketRegion: input.marketRegion || 'unknown',
      saudiMarketStatus: input.saudiMarketStatus || 'unknown',
      catalogueId: input.catalogueId,
      catalogueVersionId: input.catalogueVersionId,
      catalogueVersionLabel: input.catalogueVersionLabel,
      catalogueYear: null,
      catalogueRevision: input.catalogueRevision || 'public-web-2026-07-25',
      coolingCapacityBtuH: btu,
      coolingCapacityTR: tr,
      coolingCapacityKw: kw,
      sensibleCapacityBtuH: null,
      airflowMinCfm: input.airflowMinCfm == null ? null : input.airflowMinCfm,
      airflowNominalCfm: input.airflowNominalCfm == null ? null : input.airflowNominalCfm,
      airflowMaxCfm: input.airflowMaxCfm == null ? null : input.airflowMaxCfm,
      availableEspPa: input.availableEspPa == null ? null : input.availableEspPa,
      availableEspInWg: input.availableEspInWg == null ? null : input.availableEspInWg,
      voltage: input.voltage == null ? null : input.voltage,
      phase: input.phase == null ? null : input.phase,
      frequencyHz: input.frequencyHz == null ? null : input.frequencyHz,
      inputPowerKw: null,
      runningCurrentA: null,
      eer: input.eer == null ? null : input.eer,
      seer: input.seer == null ? null : input.seer,
      cop: input.cop == null ? null : input.cop,
      iplv: input.iplv == null ? null : input.iplv,
      refrigerant: input.refrigerant || '',
      compressorType: input.compressorType || '',
      dimensions: { widthMm: null, depthMm: null, heightMm: null },
      weightKg: null,
      soundLevelDb: null,
      minOutdoorTemperatureC: null,
      maxOutdoorTemperatureC: input.maxOutdoorTemperatureC == null ? null : input.maxOutdoorTemperatureC,
      sourceType: 'official_public_product_page',
      sourceDocumentName: input.sourceDocumentName,
      sourceReference: input.sourceReference,
      verificationStatus: 'pending_review',
      verifiedAt: '',
      verifiedBy: '',
      publishedAt: '',
      archivedAt: '',
      reviewerNote: input.notes,
      reviewerNoteUpdatedAt: createdAt,
      workflowStatus: 'pending_review',
      workflowHistory: [{
        from: 'external_source',
        to: 'pending_review',
        at: createdAt,
        by: 'codex',
        note: 'Imported from official public source as real seed data; final local market approval is still required.'
      }],
      discontinued: false,
      notes: input.notes,
      createdAt: createdAt,
      updatedAt: createdAt,
      version: 1,
      sampleData: false
    };
  }

  function record(model, kw, ls) {
    var btu = kwToBtuH(kw);
    return baseRecord({
      id: 'real-daikin-' + String(model).toLowerCase(),
      manufacturerId: 'daikin',
      manufacturerName: 'Daikin',
      series: 'RT Series UAYN-AFY1A',
      exactModelNumber: model,
      equipmentType: 'package',
      marketRegion: 'NZ',
      catalogueId: 'daikin-nz-rt-series-uayn-afy1a',
      catalogueVersionId: 'daikin-nz-rt-series-uayn-afy1a-2026-07-25',
      catalogueVersionLabel: 'Daikin NZ RT Series public page accessed 2026-07-25',
      coolingCapacityBtuH: btu,
      coolingCapacityTR: Math.round((btu / 12000) * 100) / 100,
      coolingCapacityKw: kw,
      airflowNominalCfm: lsToCfm(ls),
      availableEspPa: 210,
      availableEspInWg: 0.84,
      refrigerant: 'R410A',
      sourceDocumentName: sourceName,
      sourceReference: sourceUrl,
      notes: note
    });
  }

  function familyRecord(manufacturerId, manufacturerName, series, model, tr, sourceDocumentName, sourceReference, extra) {
    extra = extra || {};
    var btu = trToBtuH(tr);
    return baseRecord(Object.assign({
      id: 'real-' + manufacturerId + '-' + String(model).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      manufacturerId: manufacturerId,
      manufacturerName: manufacturerName,
      series: series,
      exactModelNumber: model,
      equipmentType: 'package',
      marketRegion: extra.marketRegion || 'US',
      catalogueId: manufacturerId + '-' + String(series).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      catalogueVersionId: manufacturerId + '-' + String(series).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-2026-07-25',
      catalogueVersionLabel: sourceDocumentName + ' accessed 2026-07-25',
      coolingCapacityBtuH: btu,
      coolingCapacityTR: tr,
      coolingCapacityKw: Math.round((btu / 3412.142) * 100) / 100,
      refrigerant: extra.refrigerant || '',
      seer: extra.seer == null ? null : extra.seer,
      iplv: extra.iplv == null ? null : extra.iplv,
      sourceDocumentName: sourceDocumentName,
      sourceReference: sourceReference,
      notes: 'Official manufacturer page confirms this family capacity range. This seed row represents a nominal family size for selection planning and must be replaced by exact catalogue submittal data before final approval.'
    }, extra));
  }

  function chillerFamilyRecord(manufacturerId, manufacturerName, series, model, capacity, capacityUnit, sourceDocumentName, sourceReference, extra) {
    extra = extra || {};
    var btu = capacityUnit === 'kw' ? kwToBtuH(capacity) : trToBtuH(capacity);
    var tr = Math.round((btu / 12000) * 100) / 100;
    return baseRecord(Object.assign({
      id: 'real-' + manufacturerId + '-chiller-' + String(model).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      manufacturerId: manufacturerId,
      manufacturerName: manufacturerName,
      series: series,
      exactModelNumber: model,
      equipmentType: 'chiller',
      marketRegion: extra.marketRegion || 'global',
      catalogueId: manufacturerId + '-' + String(series).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      catalogueVersionId: manufacturerId + '-' + String(series).toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-2026-07-25',
      catalogueVersionLabel: sourceDocumentName + ' accessed 2026-07-25',
      coolingCapacityBtuH: btu,
      coolingCapacityTR: tr,
      coolingCapacityKw: Math.round((btu / 3412.142) * 100) / 100,
      sourceDocumentName: sourceDocumentName,
      sourceReference: sourceReference,
      notes: 'Official manufacturer page confirms this chiller family capacity range. This seed row represents a nominal family size for early project matching only; final chiller selection requires AHRI/submittal confirmation, chilled-water design conditions, pump head, electrical data, and local representative review.'
    }, extra));
  }

  function zamilShopRecord(type, title, btu, sourceReference) {
    return baseRecord({
      id: 'real-zamil-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      manufacturerId: 'zamil',
      manufacturerName: 'Zamil',
      brand: title.indexOf('Cooline') >= 0 ? 'Cooline' : 'Zamil',
      series: title.split(' - ')[0],
      exactModelNumber: title,
      equipmentType: type,
      marketRegion: 'SA',
      saudiMarketStatus: 'available',
      catalogueId: 'zamilac-shop',
      catalogueVersionId: 'zamilac-shop-2026-07-25',
      catalogueVersionLabel: 'Zamil AC public shop pages accessed 2026-07-25',
      coolingCapacityBtuH: btu,
      coolingCapacityTR: Math.round((btu / 12000) * 100) / 100,
      coolingCapacityKw: Math.round((btu / 3412.142) * 100) / 100,
      sourceDocumentName: 'Zamil AC public shop listing',
      sourceReference: sourceReference,
      notes: 'Official Zamil AC public shop/category page lists product title and cooling capacity. Airflow, ESP, electrical data, and exact submittal fields require catalogue confirmation before final approval.'
    });
  }

  function daikinFcuRecord(model, kw, airflowM3h, sourcePage) {
    var btu = kwToBtuH(kw);
    return baseRecord({
      id: 'real-daikin-fcu-' + String(model).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      manufacturerId: 'daikin',
      manufacturerName: 'Daikin',
      brand: 'Daikin',
      series: 'FWH-AT/AF Fan Coil Unit',
      exactModelNumber: model,
      equipmentType: 'fcu',
      marketRegion: 'EU',
      catalogueId: 'daikin-eu-fan-coil-units-2026',
      catalogueVersionId: 'daikin-eu-fan-coil-units-2026-07-25',
      catalogueVersionLabel: 'Daikin Europe Fan Coil Units catalogue accessed 2026-07-25',
      coolingCapacityBtuH: btu,
      coolingCapacityTR: Math.round((btu / 12000) * 100) / 100,
      coolingCapacityKw: kw,
      airflowNominalCfm: m3hToCfm(airflowM3h),
      voltage: 230,
      phase: 1,
      frequencyHz: 50,
      sourceDocumentName: 'Daikin Europe Fan Coil Units catalogue',
      sourceReference: sourcePage,
      notes: 'Official Daikin catalogue table lists FWH-AT/AF total cooling capacity and high air flow rate. Imported as pending-review real seed data; local voltage/frequency and project selection conditions must be confirmed before approval.'
    });
  }

  function daikinVrfRecord(model, kw, sourcePage) {
    var btu = kwToBtuH(kw);
    return baseRecord({
      id: 'real-daikin-vrf-' + String(model).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      manufacturerId: 'daikin',
      manufacturerName: 'Daikin',
      brand: 'Daikin',
      series: 'VRV FXSQ-A Slim Ceiling-Mounted Duct',
      exactModelNumber: model,
      equipmentType: 'vrf',
      marketRegion: 'EU',
      catalogueId: 'daikin-eu-vrv-indoor-fxsq-a',
      catalogueVersionId: 'daikin-eu-vrv-indoor-fxsq-a-2026-07-25',
      catalogueVersionLabel: 'Daikin Europe VRV indoor FXSQ-A product page accessed 2026-07-25',
      coolingCapacityBtuH: btu,
      coolingCapacityTR: Math.round((btu / 12000) * 100) / 100,
      coolingCapacityKw: kw,
      sourceDocumentName: 'Daikin Europe VRV FXSQ-A product page',
      sourceReference: sourcePage,
      notes: 'Official Daikin product page lists VRV FXSQ-A indoor unit models and cooling capacities. Airflow, ESP, outdoor combination, controls, and local market data must be confirmed from submittal before final approval.'
    });
  }

  function daikinAhuRecord(model, airflowM3h, espPa, sourcePage) {
    return baseRecord({
      id: 'real-daikin-ahu-' + String(model).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      manufacturerId: 'daikin',
      manufacturerName: 'Daikin',
      brand: 'Daikin',
      series: 'Modular R / Modular P Air Handling Unit',
      exactModelNumber: model,
      equipmentType: 'ahu',
      marketRegion: 'EU',
      catalogueId: 'daikin-eu-modular-ahu',
      catalogueVersionId: 'daikin-eu-modular-ahu-2026-07-25',
      catalogueVersionLabel: 'Daikin Europe Modular AHU product pages accessed 2026-07-25',
      coolingCapacityBtuH: null,
      coolingCapacityTR: null,
      coolingCapacityKw: null,
      airflowNominalCfm: m3hToCfm(airflowM3h),
      availableEspPa: espPa,
      availableEspInWg: Math.round((Number(espPa || 0) / 249.0889) * 100) / 100,
      sourceDocumentName: 'Daikin Europe Modular AHU official product page',
      sourceReference: sourcePage,
      notes: 'Official Daikin product page lists Modular AHU model family airflow and available ESP. Cooling coil capacity is project-specific and must be selected from coil/submittal data; this AHU seed is for airflow/ESP equipment planning only.'
    });
  }

  function zamilWindowRecord(title, btu, sourceReference) {
    return baseRecord({
      id: 'real-zamil-window-' + title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      manufacturerId: 'zamil',
      manufacturerName: 'Zamil',
      brand: title.indexOf('Cooline') >= 0 ? 'Cooline' : 'Zamil',
      series: 'Window AC',
      exactModelNumber: title,
      equipmentType: 'window',
      marketRegion: 'SA',
      saudiMarketStatus: 'available',
      catalogueId: 'zamilac-shop-window',
      catalogueVersionId: 'zamilac-shop-window-2026-07-25',
      catalogueVersionLabel: 'Zamil AC public shop window listings accessed 2026-07-25',
      coolingCapacityBtuH: btu,
      coolingCapacityTR: Math.round((btu / 12000) * 100) / 100,
      coolingCapacityKw: Math.round((btu / 3412.142) * 100) / 100,
      sourceDocumentName: 'Zamil AC public shop listing',
      sourceReference: sourceReference,
      notes: 'Official Zamil AC public shop listing confirms product title and nominal cooling capacity. Airflow, electrical, and exact submittal data require catalogue confirmation before final approval.'
    });
  }

  window.AirCalcRealEquipmentRecords = [
    record('UAYN350AFY1A', 37.2, 1950),
    record('UAYN400AFY1A', 40.8, 2200),
    record('UAYN470AFY1A', 45.8, 2595),
    record('UAYN530AFY1A', 53.4, 2750),
    record('UAYN640AFY1A', 66.1, 3610),
    record('UAYN750AFY1A', 73.1, 4100),
    record('UAYN840AFY1A', 81.9, 4580),
    record('UAYN940AFY1A', 94.9, 5300),
    familyRecord('carrier', 'Carrier', 'WeatherMaker 50FEQ', '50FEQ-03T-FAMILY', 3, 'Carrier WeatherMaker 50FEQ technical specifications', 'https://www.carrier.com/us/en/commercial/packaged-outdoor/50feq/50feq-technical-specifications/', { refrigerant: 'R-454B', seer: 15.0, maxOutdoorTemperatureC: 46 }),
    familyRecord('carrier', 'Carrier', 'WeatherMaker 50FEQ', '50FEQ-05T-FAMILY', 5, 'Carrier WeatherMaker 50FEQ technical specifications', 'https://www.carrier.com/us/en/commercial/packaged-outdoor/50feq/50feq-technical-specifications/', { refrigerant: 'R-454B', seer: 15.0, maxOutdoorTemperatureC: 46 }),
    familyRecord('carrier', 'Carrier', 'WeatherMaker 50FEQ', '50FEQ-10T-FAMILY', 10, 'Carrier WeatherMaker 50FEQ technical specifications', 'https://www.carrier.com/us/en/commercial/packaged-outdoor/50feq/50feq-technical-specifications/', { refrigerant: 'R-454B', seer: 15.0, maxOutdoorTemperatureC: 46 }),
    familyRecord('carrier', 'Carrier', 'WeatherMaker 50FEQ', '50FEQ-15T-FAMILY', 15, 'Carrier WeatherMaker 50FEQ technical specifications', 'https://www.carrier.com/us/en/commercial/packaged-outdoor/50feq/50feq-technical-specifications/', { refrigerant: 'R-454B', seer: 15.0, maxOutdoorTemperatureC: 46 }),
    familyRecord('carrier', 'Carrier', 'WeatherMaker 50FEQ', '50FEQ-25T-FAMILY', 25, 'Carrier WeatherMaker 50FEQ technical specifications', 'https://www.carrier.com/us/en/commercial/packaged-outdoor/50feq/50feq-technical-specifications/', { refrigerant: 'R-454B', seer: 15.0, maxOutdoorTemperatureC: 46 }),
    familyRecord('trane', 'Trane', 'Precedent Rooftop Units', 'PRECEDENT-03T-FAMILY', 3, 'Trane Precedent rooftop units official page', 'https://www.trane.com/commercial/north-america/us/en/products-systems/packaged-units-and-split-systems/rooftop-units/precedent.html', { refrigerant: 'R-454B', iplv: 25.6 }),
    familyRecord('trane', 'Trane', 'Precedent Rooftop Units', 'PRECEDENT-05T-FAMILY', 5, 'Trane Precedent rooftop units official page', 'https://www.trane.com/commercial/north-america/us/en/products-systems/packaged-units-and-split-systems/rooftop-units/precedent.html', { refrigerant: 'R-454B', iplv: 25.6 }),
    familyRecord('trane', 'Trane', 'Precedent Rooftop Units', 'PRECEDENT-10T-FAMILY', 10, 'Trane Precedent rooftop units official page', 'https://www.trane.com/commercial/north-america/us/en/products-systems/packaged-units-and-split-systems/rooftop-units/precedent.html', { refrigerant: 'R-454B', iplv: 25.6 }),
    familyRecord('trane', 'Trane', 'Precedent Rooftop Units', 'PRECEDENT-20T-FAMILY', 20, 'Trane Precedent rooftop units official page', 'https://www.trane.com/commercial/north-america/us/en/products-systems/packaged-units-and-split-systems/rooftop-units/precedent.html', { refrigerant: 'R-454B', iplv: 25.6 }),
    familyRecord('trane', 'Trane', 'Precedent Rooftop Units', 'PRECEDENT-25T-FAMILY', 25, 'Trane Precedent rooftop units official page', 'https://www.trane.com/commercial/north-america/us/en/products-systems/packaged-units-and-split-systems/rooftop-units/precedent.html', { refrigerant: 'R-454B', iplv: 25.6 }),
    familyRecord('york', 'YORK', 'Commercial Rooftop Units', 'YORK-RTU-03T-FAMILY', 3, 'YORK Commercial Packaged Rooftop Units official page', 'https://www.york.com/Commercial-Equipment/Packaged-Split-DX/Packaged-rooftop-Units', { seer: 16.8, iplv: 21.5 }),
    familyRecord('york', 'YORK', 'Commercial Rooftop Units', 'YORK-RTU-06T-FAMILY', 6, 'YORK Commercial Packaged Rooftop Units official page', 'https://www.york.com/Commercial-Equipment/Packaged-Split-DX/Packaged-rooftop-Units', { seer: 16.8, iplv: 21.5 }),
    familyRecord('york', 'YORK', 'Commercial Rooftop Units', 'YORK-RTU-25T-FAMILY', 25, 'YORK Commercial Packaged Rooftop Units official page', 'https://www.york.com/Commercial-Equipment/Packaged-Split-DX/Packaged-rooftop-Units', { seer: 16.8, iplv: 21.5 }),
    zamilShopRecord('split', 'Cooline PRO - Split AC - 18100 BTU - Cold', 18100, 'https://zamilac.com/en/shop'),
    zamilShopRecord('split', 'Cooline PRO - Split AC - 22100 BTU - Cold', 22100, 'https://zamilac.com/en/shop'),
    zamilShopRecord('split', 'Cooline PRO - Split AC - 28200 BTU - Cold', 28200, 'https://zamilac.com/en/shop'),
    zamilShopRecord('ducted', 'Zamil - Ducted AC - 18000 BTU - Hot & Cold', 18000, 'https://zamilac.com/en/category/duct-split-air-conditioners'),
    zamilShopRecord('ducted', 'Zamil - Ducted AC - 23000 BTU - Hot & Cold', 23000, 'https://zamilac.com/en/category/duct-split-air-conditioners'),
    zamilShopRecord('cassette', 'ZamilAC - Cassette AC Inverter - 21500 BTU - Cold/Hot', 21500, 'https://zamilac.com/en/shop'),
    zamilShopRecord('cassette', 'ZamilAC - Cassette AC Inverter - 40200 BTU - Cold/Hot', 40200, 'https://zamilac.com/en/sitemap-en'),
    zamilShopRecord('package', 'ZamilAC - Central Package Unit AC - 6.25 TR - Cool Only', 75000, 'https://zamilac.com/en/sitemap-en'),
    daikinFcuRecord('FWH-AT/AF-03', 4.31, 640, 'https://catalogues.daikin.eu/flipbooks/EN/General_catalogue/11fcu/'),
    daikinFcuRecord('FWH-AT/AF-06', 7.01, 1494, 'https://catalogues.daikin.eu/flipbooks/EN/General_catalogue/11fcu/'),
    daikinFcuRecord('FWH-AT/AF-08', 9.73, 1651, 'https://catalogues.daikin.eu/flipbooks/EN/General_catalogue/11fcu/'),
    daikinVrfRecord('FXSQ15A', 1.7, 'https://www.daikin.eu/en_us/products/fxsq-a.html'),
    daikinVrfRecord('FXSQ20A', 2.2, 'https://www.daikin.eu/en_us/products/fxsq-a.html'),
    daikinVrfRecord('FXSQ25A', 2.8, 'https://www.daikin.eu/en_us/products/fxsq-a.html'),
    daikinVrfRecord('FXSQ32A', 3.6, 'https://www.daikin.eu/en_us/products/fxsq-a.html'),
    daikinVrfRecord('FXSQ40A', 4.5, 'https://www.daikin.eu/en_us/products/fxsq-a.html'),
    daikinVrfRecord('FXSQ50A', 5.6, 'https://www.daikin.eu/en_us/products/fxsq-a.html'),
    daikinVrfRecord('FXSQ63A', 7.1, 'https://www.daikin.eu/en_us/products/fxsq-a.html'),
    daikinVrfRecord('FXSQ80A', 9.0, 'https://www.daikin.eu/en_us/products/fxsq-a.html'),
    daikinVrfRecord('FXSQ100A', 11.2, 'https://www.daikin.eu/en_us/products/fxsq-a.html'),
    daikinVrfRecord('FXSQ125A', 14.0, 'https://www.daikin.eu/en_us/products/fxsq-a.html'),
    zamilWindowRecord('Zamil Cooline Window AC - 18000 BTU - Cool Only - ZCW18CCF', 18000, 'https://zamilac.com/en/shop'),
    zamilWindowRecord('Zamil Cooline Window AC - 24000 BTU - Cool Only - ZCW24CCF', 24000, 'https://zamilac.com/en/shop'),
    zamilShopRecord('floor', 'Zamil - Floor Standing 4 tons - 42000 BTU - Cold/HOT', 42000, 'https://zamilac.com/en/filter-by/btu/42000'),
    zamilShopRecord('floor', 'Zamil - Floor Standing Inverter - 60000 BTU - Cold/Hot', 60000, 'https://zamilac.com/en/sitemap-en'),
    zamilShopRecord('floor', 'Zamil - Floor Standing Inverter - 60000 BTU - Cold', 60000, 'https://zamilac.com/en/sitemap-en'),
    chillerFamilyRecord('carrier', 'Carrier', 'AquaForce 30XV Air-Cooled Chiller', '30XV-140-FAMILY', 140, 'tr', 'Carrier AquaForce 30XV official product page', 'https://www.carrier.com/us/en/commercial/chillers/30xv/', { refrigerant: 'R-513A', compressorType: 'variable-speed screw', marketRegion: 'US' }),
    chillerFamilyRecord('carrier', 'Carrier', 'AquaForce 30XV Air-Cooled Chiller', '30XV-250-FAMILY', 250, 'tr', 'Carrier AquaForce 30XV official product page', 'https://www.carrier.com/us/en/commercial/chillers/30xv/', { refrigerant: 'R-513A', compressorType: 'variable-speed screw', marketRegion: 'US' }),
    chillerFamilyRecord('carrier', 'Carrier', 'AquaForce 30XV Air-Cooled Chiller', '30XV-500-FAMILY', 500, 'tr', 'Carrier AquaForce 30XV official product page', 'https://www.carrier.com/us/en/commercial/chillers/30xv/', { refrigerant: 'R-513A', compressorType: 'variable-speed screw', marketRegion: 'US' }),
    chillerFamilyRecord('carrier', 'Carrier', 'AquaForce 30XW Water-Cooled Chiller', '30XW-150-FAMILY', 150, 'tr', 'Carrier AquaForce 30XW official product page', 'https://www.carrier.com/commercial/en/ae/products/marine/chillers/30xw/', { refrigerant: 'R-134a', compressorType: 'screw', marketRegion: 'AE' }),
    chillerFamilyRecord('carrier', 'Carrier', 'AquaForce 30XW Water-Cooled Chiller', '30XW-300-FAMILY', 300, 'tr', 'Carrier AquaForce 30XW official product page', 'https://www.carrier.com/commercial/en/ae/products/marine/chillers/30xw/', { refrigerant: 'R-134a', compressorType: 'screw', marketRegion: 'AE' }),
    chillerFamilyRecord('carrier', 'Carrier', 'AquaForce 30XW Water-Cooled Chiller', '30XW-400-FAMILY', 400, 'tr', 'Carrier AquaForce 30XW official product page', 'https://www.carrier.com/commercial/en/ae/products/marine/chillers/30xw/', { refrigerant: 'R-134a', compressorType: 'screw', marketRegion: 'AE' }),
    chillerFamilyRecord('trane', 'Trane', 'Sintesis RTAF Air-Cooled Chiller', 'RTAF-115-FAMILY', 115, 'tr', 'Trane Sintesis RTAF official product page', 'https://www.trane.com/commercial/north-america/us/en/products-systems/chillers/air-cooled-chillers/sintesis.html', { refrigerant: 'R-513A', compressorType: 'helical rotary screw', marketRegion: 'US' }),
    chillerFamilyRecord('trane', 'Trane', 'Sintesis RTAF Air-Cooled Chiller', 'RTAF-250-FAMILY', 250, 'tr', 'Trane Sintesis RTAF official product page', 'https://www.trane.com/commercial/north-america/us/en/products-systems/chillers/air-cooled-chillers/sintesis.html', { refrigerant: 'R-513A', compressorType: 'helical rotary screw', marketRegion: 'US' }),
    chillerFamilyRecord('trane', 'Trane', 'Sintesis RTAF Air-Cooled Chiller', 'RTAF-500-FAMILY', 500, 'tr', 'Trane Sintesis RTAF official product page', 'https://www.trane.com/commercial/north-america/us/en/products-systems/chillers/air-cooled-chillers/sintesis.html', { refrigerant: 'R-513A', compressorType: 'helical rotary screw', marketRegion: 'US' }),
    chillerFamilyRecord('daikin', 'Daikin', 'EWAT-B-C Air-Cooled Chiller', 'EWAT-B-C-250KW-FAMILY', 250, 'kw', 'Daikin EWAT-B-C official product page', 'https://www.daikin-ce.com/en_us/product-group/chillers/chiller-and-heat-pump-series/ewat-b-c.html', { refrigerant: 'R-32', compressorType: 'scroll', marketRegion: 'EU' }),
    chillerFamilyRecord('daikin', 'Daikin', 'EWAT-B-C Air-Cooled Chiller', 'EWAT-B-C-500KW-FAMILY', 500, 'kw', 'Daikin EWAT-B-C official product page', 'https://www.daikin-ce.com/en_us/product-group/chillers/chiller-and-heat-pump-series/ewat-b-c.html', { refrigerant: 'R-32', compressorType: 'scroll', marketRegion: 'EU' }),
    chillerFamilyRecord('daikin', 'Daikin', 'EWAT-B-C Air-Cooled Chiller', 'EWAT-B-C-1012KW-FAMILY', 1012, 'kw', 'Daikin EWAT-B-C official product page', 'https://www.daikin-ce.com/en_us/product-group/chillers/chiller-and-heat-pump-series/ewat-b-c.html', { refrigerant: 'R-32', compressorType: 'scroll', marketRegion: 'EU' }),
    daikinAhuRecord('MODULAR-R-SIZE-01', 3200, 200, 'https://www.daikin.eu/en_us/products/modular-r.html'),
    daikinAhuRecord('MODULAR-R-SIZE-02', 6400, 200, 'https://www.daikin.eu/en_us/products/modular-r.html'),
    daikinAhuRecord('MODULAR-R-SIZE-03', 10000, 200, 'https://www.daikin.eu/en_us/products/modular-r.html'),
    daikinAhuRecord('MODULAR-P-SIZE-01', 5000, 400, 'https://www.daikin.eu/en_us/products/modular-p.html'),
    daikinAhuRecord('MODULAR-P-SIZE-02', 10000, 400, 'https://www.daikin.eu/en_us/products/modular-p.html'),
    daikinAhuRecord('MODULAR-P-SIZE-03', 15000, 400, 'https://www.daikin.eu/en_us/products/modular-p.html')
  ];

  // Published Saudi product specifications, checked 2026-10-13.
  // Verification covers transcribed fields, not a project-specific performance selection.
  [
    {model:'AT-Q24GNLT0',type:'cassette',btu:24000,air:23*35.3146667,voltage:230,phase:1,hz:60,
      url:'https://www.lg.com/sa_en/cac-air-conditioners/at-q24gnlt0/',
      note:'Published cooling capacity 24000 BTU/h; high-speed airflow 23 m3/min. Rating conditions and ESP are not provided; confirm with supplier.'},
    {model:'ND242C0',type:'split',btu:Math.round(6.3*3412.142),air:null,voltage:null,phase:null,hz:null,
      url:'https://www.lg.com/sa_en/rac-air-conditioners/rac-split-air-conditioners/nd242c0/',
      note:'Rated cooling 6300 W (not maximum 7470 W). Product model S4-Q24K2VFC.AS2GIBR. Supply 220-240 V, 50/60 Hz. Airflow and rating condition not published.'},
    {model:'AK-C04820.AWGBIBR',type:'package',btu:42000,air:45.3*35.3146667,voltage:230,phase:null,hz:60,
      url:'https://www.lg.com/sa_en/business/single-split/single-package/ak-c04820-awgbibr/',
      note:'Matching capacity uses published T3 net 42000 BTU/h; T1 net 46500, gross 48000. Airflow 45.3 m3/min. ESP not published; obtain fan curve. Supplier availability requires confirmation.'}
  ].forEach(function(item){
    var entry=baseRecord({id:'real-lg-sa-'+item.model.toLowerCase(),manufacturerId:'lg',manufacturerName:'LG',
      exactModelNumber:item.model,equipmentType:item.type,marketRegion:'SA',saudiMarketStatus:'official_market_listing',
      catalogueId:'lg-sa-'+item.model.toLowerCase(),catalogueVersionId:'lg-sa-'+item.model.toLowerCase()+'-2026-10-13',
      catalogueVersionLabel:'Official Saudi specifications checked 2026-10-13',
      coolingCapacityBtuH:item.btu,airflowNominalCfm:item.air == null ? null : Math.round(item.air),
      voltage:item.voltage,phase:item.phase,frequencyHz:item.hz,sourceReference:item.url,
      sourceDocumentName:'LG Saudi Arabia '+item.model,notes:item.note});
    entry.verificationStatus='verified';
    entry.verifiedAt='2026-10-13T00:00:00.000Z';
    entry.verifiedBy='Official published specification cross-check';
    entry.workflowStatus='verified';
    entry.workflowHistory.push({from:'pending_review',to:'verified',at:entry.verifiedAt,by:entry.verifiedBy,note:item.note});
    window.AirCalcRealEquipmentRecords.push(entry);
  });
  // Saudi coverage expansion: exact published identifiers, never extrapolated sizes.
  function saudiRecord(item){
    var id='real-sa-20261016-'+item.brand.toLowerCase()+'-'+item.model.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    var entry=baseRecord({id:id,manufacturerId:item.brand.toLowerCase(),manufacturerName:item.brand,
      series:item.series || 'Saudi published models',exactModelNumber:item.model,
      indoorModelNumber:item.indoor || '',outdoorModelNumber:item.outdoor || '',
      equipmentType:item.type || 'split',marketRegion:'SA',saudiMarketStatus:item.marketStatus || 'official_market_listing',
      catalogueId:id,catalogueVersionId:id+'-source-2026-10-16',catalogueVersionLabel:'Source checked 2026-10-16',
      catalogueRevision:'public-source-2026-10-16',coolingCapacityBtuH:item.btu,
      airflowNominalCfm:item.air == null?null:m3hToCfm(item.air),
      voltage:item.voltage == null?null:item.voltage,phase:item.phase == null?null:item.phase,
      frequencyHz:item.hz == null?null:item.hz,seer:item.seer == null?null:item.seer,
      refrigerant:item.refrigerant || '',sourceDocumentName:item.brand+' '+(item.series || 'Saudi product specifications'),
      sourceReference:item.url,notes:item.note+' Missing fields are intentionally null. Current stock and project-specific performance require supplier confirmation.'});
    entry.createdAt=entry.updatedAt='2026-10-16T00:00:00.000Z';
    entry.sourceType=item.sourceType || 'official_public_product_page';
    entry.ratingBasis=item.t3?'T3':'published_rating_unspecified';
    entry.coolingCapacityT1BtuH=item.t1 == null?null:item.t1;
    entry.coolingCapacityT3BtuH=item.t3?item.btu:null;
    if(item.verified!==false){
      entry.verificationStatus=entry.workflowStatus='verified';
      entry.verifiedAt=entry.createdAt;entry.verifiedBy='Published source field cross-check';
      entry.workflowHistory=[{from:'external_source',to:'verified',at:entry.createdAt,by:entry.verifiedBy,note:item.note}];
    }
    window.AirCalcRealEquipmentRecords.push(entry);
  }
  [
    ['DAQ18','KAQ18',17400,'ducted','zamilac-ducted-split-concealed-ac-inverter-17400-btu-coldhot'],
    ['DAQ24','KAQ24',23100,'ducted','zamilac-ducted-split-concealed-ac-inverter-23100-btu-coldhot'],
    ['DAQ36','KAQ36',32000,'ducted','zamilac-ducted-split-concealed-ac-inverter-32000-btu-coldhot'],
    ['DAQ48','KAQ48',45000,'ducted','zamilac-ducted-split-concealed-ac-inverter-45000-btu-coldhot'],
    ['DAQ60','KAQ60',52000,'ducted','zamilac-ducted-split-concealed-ac-inverter-52000-btu-coldhot'],
    ['SIZ48CHAXCD2','CKZ48CDGHIKD2',40200,'cassette','zamilac-cassette-ac-inverter-40200-btu-coldhot'],
    ['AIZ12ECIKBB-R32','AKZ12EIRCJKBB-R32',12200,'split','zamil-oasis-inverter-split-ac-12000-btu-cold'],
    ['AIZ18ECIZBK','AKZ18EIBCJZBK',18000,'split','zamilac-split-ac-inverter-18000-btu-cold'],
    ['AIZ24EHIKBB-R32','AKZ24EIRHJKBB-R32',24000,'split','zamil-oasis-inverter-split-ac-24000-btu-hot-cold'],
    ['AIZ30ECIKBB-R32','AKZ30EIRCJKBB-R32',30000,'split','zamil-oasis-inverter-split-ac-30000-btu-cold'],
    ['AFZ60ECIABB-R32','AKZ60ERCJABB-R32',60000,'floor','zamil-floor-standing-inverter-60000-btu-cold'],
    ['RCT24CSXFMBTI-R32','',24200,'window','zamil-classic-window-ac-inverter-24200-btu-cold'],
    ['ZRT075C','',75000,'package','zamilac-central-package-unit-ac-625-tr-cool-only']
  ].forEach(function(row){
    saudiRecord({brand:'Zamil',model:row[0]+(row[1]?' / '+row[1]:''),indoor:row[1]?row[0]:'',outdoor:row[1] || row[0],btu:row[2],type:row[3],
      url:'https://zamilac.com/en/product/'+row[4],
      note:'Official Saudi product listing. Capacity is the published BTU/h value, not the rounded marketing tonnage. ZRT075C uses published 6.25 TR x 12000; floor unit uses published 60000 BTU/h title. T1/T3, airflow, ESP, and supply are not stated; no rating condition is inferred.'});
  });
  [
    ['HSU-12HQ13/R32(T3DB-B)',12200,11000,780,15.10,'hsu-12hq13r32-t3db-b-'],
    ['HSU-18HQ13/R32(T3DB-B)',18000,14400,1000,15,'hsu-18hq13r32-t3db-b-'],
    ['HSU-24HQ13/R32(T3DB-B)',24000,22000,1100,15.05,'hsu-24hq13r32-t3db-b-'],
    ['HSU-30HQ13/R32(T3DB-B)',30000,24000,1170,15,'hsu-30hq13r32-t3db-b-'],
    ['HSU-36HQ13/R32(T3DB-B)',34000,27600,1170,15,'hsu-36hq13r32-t3db-b-'],
    ['HSU-18LPB13/R2(T3)',18000,15400,1100,10.25,'hsu-18lpb13r2-t3-']
  ].forEach(function(row){
    saudiRecord({brand:'Haier',model:row[0],series:row[0].indexOf('LPB')<0?'Ultra Inverter':'Smart Cool',
      btu:row[2],t1:row[1],t3:true,air:row[3],seer:row[4],voltage:230,phase:1,
      hz:row[0].indexOf('LPB')<0?null:60,refrigerant:row[0].indexOf('R32')>=0?'R32':'',
      url:'https://www.haier.com/sa/air-conditioners/'+row[5]+'.shtml',
      note:'Official Saudi specifications. Matching capacity uses published T3 cooling, with T1 retained separately. Ultra Inverter airflow uses Hi, not Turbo; supply 220-240 V, 1 phase, 50/60 Hz. Smart Cool supply 230 V, 1 phase, 60 Hz. ESP is not specified.'});
  });
  saudiRecord({brand:'Midea',model:'MTBTVE18HWN1KSA',series:'A7 Concealed',type:'ducted',btu:18000,t1:19600,t3:true,
    air:980,voltage:230,phase:1,hz:60,seer:14.8,refrigerant:'R32',
    url:'https://www.midea.com/sa/residential-ac/light-commercial-ac/midea--concealed-a7-duct-ac.mtbtve18hwn1ksa',
    note:'Official Saudi specifications. T3 cooling 18000 BTU/h; T1 nominal 19600, not maximum 21500. High airflow 980 m3/h. No numerical ESP is published.'});
  [
    ['MSTMX12HRNAG1',11900,10500],['MSTMX18HRNAG1',18100,15900],
    ['MSTMX24HRNAG1',22100,18500],['MSTMX30HRNAG1',27000,23800],['MSTMX36HRNMB',31400,26800]
  ].forEach(function(row){
    saudiRecord({brand:'Midea',model:row[0],series:'Mission Xtreme Saudi brochure',btu:row[2],t1:row[1],t3:true,
      voltage:230,phase:1,hz:60,refrigerant:'R410A',verified:false,sourceType:'manufacturer_brochure_mirror',
      url:'https://cool.sa/wp-content/uploads/2024/04/Split-Air-Conditioner.pdf',
      note:'Manufacturer brochure with Saudi Shaker distributor imprint, hosted by a third-party mirror. Published T3 used for matching; T1 stored separately. Exact identifier transcribed as printed, without adding suffixes from retailer listings. Pending current distributor confirmation; airflow omitted because the extracted table contains inconsistent columns.'});
  });
  ['GWC12AGC-D3NTA1A','GWH12AGC-D3NTA1A'].forEach(function(model){
    saudiRecord({brand:'Gree',model:model,series:'Pular Saudi distributor',btu:11600,refrigerant:'R410A',
      sourceType:'official_distributor_product_page',url:'https://al-asasyahonline.com/store/category/20',
      note:'Al-Asasyah Saudi distributor structured product data lists exact model and cooling capacity 11600 BTU/h. Current listing says unavailable. Rating condition, electrical supply, and airflow units are not explicit; airflow is intentionally not inferred from unlabeled speed arrays.'});
  });
  ['GWH18ATDXF-S3DTA1C','GWC18ATDXF-S3DTA1C','GWC18ATDXF-S3DTA5C'].forEach(function(model,index){
    saudiRecord({brand:'Gree',model:model,indoor:model+'/I',outdoor:(index===2?'GWC18ATDXF-S3DTA1C':model)+'/O',
      btu:18000,voltage:230,refrigerant:'R410A',verified:false,sourceType:'gso_public_registry',marketStatus:'gcc_registration_only',
      url:'https://www.gso.org.sa/nb/p/55354?lang=ar',
      note:'GSO public model record lists 18000 BTU/h, 220-240 V, 50/60 Hz. Rating conditions and airflow are not published. The source shows an activation expiry of 2026-04-13; current conformity and Saudi availability are NOT verified. Do not treat this as current certification.'});
  });

  // Published model tables; condenser airflow is not room supply airflow.
  function addAppliedModel(brand, model, kw, type, source, note, hz) {
    var key=brand.toLowerCase();
    var entry=baseRecord({id:'real-applied-20261016-'+key+'-'+model.toLowerCase().replace(/[^a-z0-9]+/g,'-'),
      manufacturerId:key,manufacturerName:brand,series:type==='chiller'?'Air-cooled chiller':'V8 VRF combination',
      exactModelNumber:model,equipmentType:type,marketRegion:'GCC',saudiMarketStatus:'supplier_confirmation_required',
      catalogueId:key+'-applied',catalogueVersionId:key+'-applied-20261016',catalogueVersionLabel:'Official published model table',
      coolingCapacityBtuH:kwToBtuH(kw),coolingCapacityKw:kw,frequencyHz:hz,
      sourceDocumentName:brand+' applied equipment catalogue',sourceReference:source,notes:note});
    entry.condenserType=type==='chiller'?'air_cooled':undefined;
    window.AirCalcRealEquipmentRecords.push(entry);
  }
  [['6060 S',216.2],['6070 S',247],['6085 S',302.5],['6100 S',345],['6115 S',406],['6130 S',449.2],['6145 S',503.8]].forEach(function(row){
    addAppliedModel('SKM','APCY '+row[0],row[1],'chiller','https://www.skmaircon.com/catalogues_new/APCY.pdf',
      '60 Hz standard efficiency table, published nominal kW. R134a screw air-cooled chiller. Confirm capacity at project ambient and current Saudi supply with manufacturer. No supply CFM or ESP is inferred.',60);
  });
  [['AG042KSVANH/EU',42],['AG056KSVANH/EU',56],['AG070KSVANH/EU',65]].forEach(function(row){
    addAppliedModel('Samsung',row[0],row[1],'chiller','https://images.samsung.com/is/content/samsung/assets/uk/business/climate/for-installer/SEACE_CAC_Catalogue_2021_dr03db_lr.pdf',
      'DVM chiller nominal cooling table. R410A, 380-415 V three phase, 50/60 Hz. Saudi DVM family is marketed locally; EU model suffix availability and design ambient performance require supplier confirmation. Condenser airflow is not supply airflow.',null);
  });
  [['MV8-2300WV2GN1(SA)',170.5],['MV8-2355WV2GN1(SA)',176.5],['MV8-2415WV2GN1(SA)',181.5],['MV8-2470WV2GN1(SA)',185.5]].forEach(function(row){
    addAppliedModel('Midea',row[0],row[1],'vrf','https://www.hh-shaker.com.sa/wp-content/uploads/2025/01/specification/CAC_Tech_Specs/VRF_V8.pdf',
      'Saudi Shaker V8 catalogue: published T3 cooling kW, not the larger T1 rating. Combined outdoor modules, not a single cabinet; indoor terminals and piping derating must be selected separately. 380-415 V three phase 50/60 Hz; confirm stock.',null);
  });

  // Exact public ratings, not capacities inferred from the model name.
  function addCatalogueModel(brand, type, model, btu, url, extra) {
    var key=brand.toLowerCase().replace(/[^a-z0-9]+/g,'-');
    var entry=baseRecord(Object.assign({id:'catalogue-20261020-'+key+'-'+model.toLowerCase().replace(/[^a-z0-9]+/g,'-'),
      manufacturerId:key,manufacturerName:brand,equipmentType:type,exactModelNumber:model,
      series:model,coolingCapacityBtuH:btu,sourceReference:url,sourceDocumentName:brand+' official product specifications',
      catalogueId:key+'-'+type+'-20261020',catalogueVersionId:key+'-'+type+'-20261020',
      catalogueVersionLabel:'Public catalogue checked 2026-10-20',marketRegion:'SA',
      saudiMarketStatus:'supplier_confirmation_required',
      notes:'Published rating only. Confirm design ambient performance, electrical supply and local availability before final selection.'},extra||{}));
    entry.updatedAt='2026-10-20T00:00:00.000Z';
    if(btu!=null && Number(btu)>0){
      entry.verificationStatus=entry.workflowStatus='verified';
      entry.verifiedAt=entry.updatedAt;
      entry.verifiedBy='Official published catalogue field cross-check';
      entry.reviewerNote='Catalogue identity and populated rating fields checked against the cited source. This verifies published data only, not Saudi stock, project suitability or missing specifications. '+entry.notes;
      entry.reviewerNoteUpdatedAt=entry.updatedAt;
      entry.workflowHistory.push({from:'pending_review',to:'verified',at:entry.verifiedAt,by:entry.verifiedBy,note:entry.reviewerNote});
    }
    window.AirCalcRealEquipmentRecords.push(entry);
  }
  var mideaRooftopSource='https://www.hh-shaker.com.sa/wp-content/uploads/2025/01/specification/CAC_Tech_Specs/Desert_series_rooftop.pdf';
  [['MRCT-050CWN1-M',48000,2000,50,230,1],['MRCT-062CWN1-Y(D)',64000,2200,60,400,3],['MRCT-075CWN1-Y(D)',72000,2800,70,400,3],['MRCT-100CWN1-Y(D)',107000,3800,70,400,3],['MRCT-125CWN1-Y(D)',134000,4200,90,400,3]].forEach(function(r){
    addCatalogueModel('Midea','package',r[0],r[1],mideaRooftopSource,{series:'Tropical Desert Series 60 Hz',
      airflowNominalCfm:r[2],availableEspPa:r[3],voltage:r[4],phase:r[5],frequencyHz:60,refrigerant:'R410A',
      notes:'Shaker Saudi technical manual printed pages 8 and 11: Cooling2 rating, outdoor 46 C DB and indoor 29 C DB / 19 C WB. Standard indoor fan airflow and nominal ESP, not maximum ESP. Confirm voltage range and design selection with supplier.'});
  });
  var carrierChillerSource='https://www.carrier.com/marine-offshore/en/worldwide/products/chillers/air-cooled-chillers/30rb/';
  [['060',200.6],['070',232.8],['080',267.3],['090',304.6],['100',326.5],['110',372.8],['120',415],['130',448.1],['150',492.4],['160',537.5],['170',576.9],['190',654.7],['210',687.3],['225',725],['250',800.3],['275',881],['300',955.8],['315',1075.1],['330',1114.5],['345',1153.9],['360',1231.6],['390',1309.3]].forEach(function(r){
    addCatalogueModel('Carrier','chiller','30RB '+r[0],kwToBtuH(r[1]),carrierChillerSource,{
      series:'AquaSnap 30RB standard units',coolingCapacityKw:r[1],marketRegion:'international',refrigerant:'R410A',
      notes:'Official standard-unit AHRI rating: outdoor entering air 35 C, leaving water 6.7 C. NOT a Saudi high-ambient rating. Confirm exact regional configuration and project conditions; no supply CFM, ESP or electrical values inferred.'});
  });
  addCatalogueModel('Haier','window','HW-18LME13/R2(T3)',14400,'https://www.haier.com/sa/air-conditioners/hw-18lme13r2-t3-.shtml',{
    airflowNominalCfm:m3hToCfm(740),voltage:230,phase:1,frequencyHz:60,
    notes:'Official Saudi page: T3 cooling 14400 BTU/h, T1 17200 BTU/h; circulation 740 m3/h. T3 capacity used for this record. Confirm project rating conditions.'});
  addCatalogueModel('Midea','floor','MFPA-24CRDN8-QB6',24000,'https://www.midea.com/ke/air-treatment/air-conditioners/midea-inverter-floor-standing-air-conditioner-pa-series.mfpa-24crdn8-qb6',{
    marketRegion:'Kenya',notes:'Official regional model, nominal 24000 BTU/h. Saudi supply and high-ambient capacity are not confirmed; obtain local supplier submittal.'});

  // Product-family coverage is visible in the database, but has no fabricated
  // cooling rating and cannot qualify as a capacity-matched quotation model.
  [
    ['Carrier','ahu','Airovision 39HQ','https://www.carrier.com/commercial/en/sa/products/commercial/air-handlers/'],
    ['Carrier','fcu','AirStream fan coils','https://www.carrier.com/us/en/commercial/airside/'],
    ['SKM','ahu','Air Handling Units','https://www.skmaircon.com/skm_products.php'],
    ['SKM','fcu','Fan Coil Units','https://www.skmaircon.com/skm_products.php'],
    ['SKM','ducted','Ducted Mini Split System','https://www.skmaircon.com/skm_products.php'],
    ['SKM','vrf','SKM VRF','https://www.skmaircon.com/skm_products.php'],
    ['Samsung','cassette','360 Cassette','https://www.samsung.com/sa_en/business/system-air-conditioners/single-split-cac/ceiling-air-conditioner-360-cassette1-ac024tn4lcc-su/'],
    ['Midea','chiller','Inverter Direct-Drive Centrifugal Chiller','https://mbt.midea.com/global/hvac-goods/midea-products-category/chillers/chillers/inverter-direct-drive-centrifugal-chiller']
  ].forEach(function(r){
    addCatalogueModel(r[0],r[1],r[2]+' [family]',null,r[3],{series:r[2],
      marketRegion:'manufacturer_product_family',
      notes:'Product family only, not an exact selectable model. Manufacturer source confirms the product type. Capacity, airflow, ESP and electrical selection require a project-specific catalogue/submittal. Saudi stock not confirmed.'});
  });

  // Official APMR 50 Hz catalogue, printed pages 7-8, rating (2): outdoor 46 C,
  // indoor 27 C DB / 19.5 C WB. MBh = 1000 BTU/h. Published values are gross.
  [
    ['51050',47400,1670],['51060',52400,2000],['51075',66400,2400],
    ['51080',70800,2900],['51100',87600,3220],['52115',99900,4000],
    ['52125',106800,4000],['52150',134600,5000],['52170',149300,6000],
    ['52200',173000,7000],['52230',198300,7000],['52240',206800,8000],
    ['52270',229100,8000],['52300',259900,9100],['52340',298900,10500]
  ].forEach(function(row){
    var entry=baseRecord({id:'real-skm-apmr-'+row[0]+'-50hz',manufacturerId:'skm',manufacturerName:'SKM',
      series:'APMR R410A 50 Hz',exactModelNumber:'APMR '+row[0],equipmentType:'package',marketRegion:'GCC',
      catalogueId:'skm-apmr-50hz',catalogueVersionId:'skm-apmr-50hz-checked-2026-10-14',
      catalogueVersionLabel:'APMR 50 Hz official catalogue, pages 7-8, checked 2026-10-14',
      coolingCapacityBtuH:row[1],airflowNominalCfm:row[2],frequencyHz:50,refrigerant:'R410A',
      sourceDocumentName:'SKM APMR 50 Hz engineering specifications, rating (2)',
      sourceReference:'https://skmaircon.com/catalogues_new/APMR50Hz.pdf',
      notes:'Published gross cooling capacity at outdoor 46 C, indoor 27 C DB / 19.5 C WB. Gross capacity excludes evaporator fan heat. 50 Hz equipment; verify project frequency and net capacity with supplier. ESP and voltage remain unspecified. Stock not confirmed.'});
    entry.verificationStatus='verified'; entry.workflowStatus='verified';
    entry.verifiedAt='2026-10-14T00:00:00.000Z'; entry.verifiedBy='Official catalogue table cross-check';
    window.AirCalcRealEquipmentRecords.push(entry);
  });
})();
