(function(root){
  'use strict';

  function toNumber(value, fallback){
    var n = Number(value);
    return Number.isFinite(n) ? n : (fallback || 0);
  }

  function safeCall(name, fallback){
    try{
      if(typeof root[name] === 'function') return root[name]();
    }catch(error){
      return fallback;
    }
    return fallback;
  }

  function clone(value){
    try{
      return JSON.parse(JSON.stringify(value == null ? null : value));
    }catch(error){
      return null;
    }
  }

  function readRooms(){
    var rooms = Array.isArray(root.hist) ? root.hist : [];
    return rooms.map(function(room, index){
      room = room || {};
      return {
        index: index,
        name: room.ar || room.en || room.roomType || ('Room ' + (index + 1)),
        btu: toNumber(room.btu || room.requiredBtu || room.finalBtu),
        cfm: toNumber(room.cfm || room.requiredCfm),
        outdoorAirCfm: toNumber(room.oa || room.outdoorAirCfm),
        exhaustCfm: toNumber(room.exh || room.exhaustCfm),
        roomType: room.roomType || room.category || '',
        mode: room.calcMode || room.mode || '',
        source: room.standardSource || room.source || ''
      };
    });
  }

  function readProjectSystems(){
    var systems = Array.isArray(root.projectSystems) ? root.projectSystems : [];
    return systems.map(function(system){
      system = system || {};
      return {
        id: system.id || '',
        name: system.name || '',
        unitType: system.unitType || system.type || '',
        selectedCapacityBtu: toNumber(system.selectedCapacityBtu || system.capacityBtu || system.mkt),
        unitCount: Math.max(1, toNumber(system.qty || system.unitCount, 1)),
        cfm: toNumber(system.cfm || system.selectedSystemCfm),
        equipmentId: system.equipmentId || '',
        equipmentSnapshot: clone(system.equipmentSnapshot || null)
      };
    });
  }

  function countMissingInputs(rooms){
    var missing = 0;
    rooms.forEach(function(room){
      if(!room.btu) missing += 1;
      if(!room.cfm) missing += 1;
      if(!room.name) missing += 1;
    });
    return missing;
  }

  function normalizeValidation(raw){
    raw = raw || {};
    var items = Array.isArray(raw.items) ? raw.items : [];
    return {
      status: raw.status || raw.overallStatus || '',
      items: clone(items) || []
    };
  }

  function readField(id){
    try{
      var el = root.document && root.document.getElementById ? root.document.getElementById(id) : null;
      return el && el.value != null ? String(el.value).trim() : '';
    }catch(error){
      return '';
    }
  }

  function readIdentity(){
    var projectName = readField('tech-project') || readField('desktop-project') || readField('quote-project') || 'Untitled Project';
    var projectNo = readField('tech-no') || readField('quote-no') || readField('desktop-project-no') || 'Q-001';
    var clientName = readField('report-client') || '';
    var location = readField('report-location') || '';
    var key = [projectNo, projectName].join('|').toLowerCase().replace(/[^a-z0-9|_-]+/g, '-').slice(0, 90);
    return {
      projectName: projectName,
      projectNo: projectNo,
      clientName: clientName,
      location: location,
      projectKey: key || 'default-project'
    };
  }

  function readProjectSnapshot(){
    var rooms = readRooms();
    var systems = readProjectSystems();
    var requiredBtu = toNumber(safeCall('getProjectRequiredLoadBtu', 0));
    var requiredCfm = toNumber(safeCall('getProjectRequiredLoadCfm', 0));
    var selectedBtu = toNumber(safeCall('getSelectedProjectEquipmentBtu', 0));
    var selectedCfm = toNumber(safeCall('getSelectedProjectEquipmentCfm', 0));
    var validation = normalizeValidation(safeCall('getProjectEngineeringValidation', { items: [] }));

    return {
      schemaVersion: 'copilot-state-v1',
      sourceOfTruth: 'rules_engine',
      generatedAt: new Date().toISOString(),
      identity: readIdentity(),
      totals: {
        requiredBtu: requiredBtu,
        selectedBtu: selectedBtu,
        requiredTr: requiredBtu / 12000,
        selectedTr: selectedBtu / 12000,
        requiredCfm: requiredCfm,
        selectedCfm: selectedCfm
      },
      rooms: {
        count: rooms.length,
        missingInputs: countMissingInputs(rooms),
        items: rooms
      },
      systems: {
        count: systems.length,
        items: systems,
        equipmentSnapshots: systems.map(function(system){ return system.equipmentSnapshot; }).filter(Boolean)
      },
      validation: validation,
      esp: clone(root._lastEspCalc || null),
      duct: clone(root._lastDuctSizing || null),
      reportData: clone(root._lastProfessionalReportData || null)
    };
  }

  root.AirCalcCopilotStateAdapter = {
    readProjectSnapshot: readProjectSnapshot
  };
})(typeof window !== 'undefined' ? window : globalThis);
