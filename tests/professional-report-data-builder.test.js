const assert = require('assert');
const path = require('path');

const root = path.resolve(__dirname, '..');
const builder = require(path.join(root, 'js', 'reports', 'professional-report-data-builder.js'));

global.lang = 'en';
global.hist = [
  {
    en: 'Office',
    roomType: 'Office',
    cityLabelEn: 'Riyadh',
    category: 'Commercial Office',
    roomCount: 1,
    area: 25,
    btu: 18000,
    cfm: 680,
    oa: 75,
    exhaust: 0,
    ach: 6,
    pressure: 'Neutral',
    tempRange: [22, 24],
    rhRange: [45, 55]
  },
  {
    en: 'Patient Room',
    roomType: 'Patient Room',
    roomCount: 2,
    area: 40,
    btu: 22588,
    cfm: 848,
    oa: 90,
    exhaust: 40,
    ach: 6,
    oaAch: 2,
    pressure: 'Positive'
  }
];

global.getQuoteRequiredBtu = (index) => [18000, 22588][index];
global.getRoomRequiredCfm = (index) => [680, 1696][index];
global.getRoomSystemState = (index) => ({
  selectedCapacityBtu: [24000, 48000][index],
  systems: [{ unitType: 'split', selectedBtu: [24000, 24000][index], qty: index === 1 ? 2 : 1 }]
});
global.getSelectedProjectEquipmentBtu = () => 75600;
global.getSelectedProjectEquipmentCfm = () => 3500;
global.getProjectEngineeringValidation = () => ({
  items: [
    { status: 'warning', code: 'source_confirmation', text: 'Catalogue source requires engineer review.' }
  ]
});
global.getReportReferenceNumber = (projectNo) => `ACP-TR-${projectNo}`;
global._ductBasis = 'required';
global._lastDuctSizing = {
  basis: 'required',
  qDesign: 2376,
  sup: { w: 700, h: 350, actualFpm: 965, area_actual: 245000, area_required: 227000, method: 'std' },
  ret: { w: 800, h: 400, actualFpm: 739, area_actual: 320000, area_required: 276000, method: 'std' }
};
global._lastEspCalc = {
  totalPa: 140,
  totalInwg: 0.56,
  frictionPa: 50,
  fittingLossPa: 60,
  adderLossPa: 30,
  status: { key: 'med', label: 'Medium' }
};
global.localStorage = {
  getItem(key) {
    if (key !== 'aircalc_last_selected_equipment_snapshot') return null;
    return JSON.stringify({
      snapshotTime: '2026-07-25T10:00:00.000Z',
      record: {
        manufacturerName: 'VerifiedCo',
        exactModelNumber: 'VC-060',
        equipmentType: 'AHU',
        verificationStatus: 'verified',
        saudiMarketStatus: 'available',
        sourceReference: 'Catalogue page 12',
        sourceDocumentName: 'VerifiedCo catalogue.pdf',
        coolingCapacityBtuH: 60000,
        airflowNominalCfm: 2200,
        availableEspPa: 140,
        voltage: 400,
        phase: 3,
        frequencyHz: 60,
        sensibleCapacityBtuH: 48000,
        maxOutdoorTemperatureC: 52
      },
      selectionOption: {
        quantity: 1,
        totalCapacityBtuH: 60000,
        totalAirflowCfm: 2200,
        availableEspPa: 140,
        selectionRequirements: {
          requiredCoolingLoadBtuH: 63176,
          requiredSupplyCfm: 2376
        },
        preBindReview: { status: 'review', label: 'Review' },
        engineerVerificationRequired: ['Confirm ESP.']
      }
    });
  }
};

const report = builder.buildProfessionalReportData({
  projectName: 'Clinic Fitout',
  projectNo: 'Q-009',
  clientName: 'ACME Clinic',
  location: 'Riyadh',
  city: 'Riyadh',
  buildingType: 'Healthcare Clinic',
  engineer: 'HVAC Reviewer',
  designer: 'AirCalc Designer',
  date: '2026-07-25',
  language: 'en'
});

assert.strictEqual(report.schemaVersion, 'professional-report-data-v1');
assert.strictEqual(report.sourceOfTruth, 'rules_engine');
assert.strictEqual(report.identity.projectName, 'Clinic Fitout');
assert.strictEqual(report.identity.reportReference, 'ACP-TR-Q-009');
assert.strictEqual(report.identity.city, 'Riyadh');
assert.strictEqual(report.identity.buildingType, 'Healthcare Clinic');
assert.strictEqual(report.identity.engineer, 'HVAC Reviewer');
assert.strictEqual(report.identity.designer, 'AirCalc Designer');
assert.strictEqual(report.identity.date, '2026-07-25');
assert.strictEqual(report.summary.roomCount, 3);
assert.strictEqual(report.summary.coolingLoadBtuH, 40588);
assert.strictEqual(report.summary.coolingLoadTr, 40588 / 12000);
assert.strictEqual(report.summary.supplyCfm, 2376);
assert.strictEqual(report.summary.outdoorAirCfm, 255);
assert.strictEqual(report.summary.exhaustCfm, 80);
assert.strictEqual(report.summary.selectedCapacityBtuH, 75600);
assert.strictEqual(report.summary.selectedCapacityTr, 6.3);
assert.strictEqual(report.summary.selectedSupplyCfm, 3500);
assert.strictEqual(report.validation.status, 'review');
assert.strictEqual(report.ductAndEsp.source, 'rules_engine');
assert.strictEqual(report.ductAndEsp.ductSizingAvailable, true);
assert.strictEqual(report.ductAndEsp.designCfm, 2376);
assert.strictEqual(report.ductAndEsp.supplyDuct.widthMm, 700);
assert.strictEqual(report.ductAndEsp.returnDuct.actualVelocityFpm, 739);
assert.strictEqual(report.ductAndEsp.espAvailable, true);
assert.strictEqual(report.ductAndEsp.totalEspPa, 140);
assert.strictEqual(report.ductAndEsp.totalEspInWg, 0.56);
assert.strictEqual(report.engineeringNotes.length, 1);
assert.strictEqual(report.equipmentSnapshot.manufacturerName, 'VerifiedCo');
assert.strictEqual(report.equipmentSnapshot.equipmentType, 'AHU');
assert.strictEqual(report.equipmentSnapshot.catalogueStatus, 'verified');
assert.strictEqual(report.equipmentSnapshot.saudiMarketStatus, 'available');
assert.strictEqual(report.equipmentSnapshot.sourceDocumentName, 'VerifiedCo catalogue.pdf');
assert.strictEqual(report.equipmentSnapshot.quantity, 1);
assert.strictEqual(report.equipmentSnapshot.totalAirflowCfm, 2200);
assert.strictEqual(report.equipmentSnapshot.availableEspPa, 140);
assert.strictEqual(report.equipmentSnapshot.voltage, '400');
assert.strictEqual(report.equipmentSnapshot.phase, '3');
assert.strictEqual(report.equipmentSnapshot.frequencyHz, '60');
assert.strictEqual(report.equipmentSnapshot.sensibleCapacityBtuH, 48000);
assert.strictEqual(report.equipmentSnapshot.maxOutdoorTemperatureC, 52);
assert.strictEqual(report.equipmentSnapshot.preBindReview.status, 'review');
assert.strictEqual(report.aiPolicy.aiGeneratesEngineeringNumbers, false);

global.localStorage.getItem = (key) => {
  if (key !== 'aircalc_last_selected_equipment_snapshot') return null;
  return JSON.stringify({
    selectedAt: '2026-07-25T11:00:00.000Z',
    record: {
      manufacturerName: 'Daikin',
      exactModelNumber: 'MODULAR-R-SIZE-01',
      equipmentType: 'ahu',
      verificationStatus: 'pending_review',
      sourceDocumentName: 'Daikin Modular AHU',
      airflowNominalCfm: 1883,
      availableEspPa: 200
    },
    selectionOption: {
      quantity: 1,
      totalCapacityBtuH: 0,
      totalAirflowCfm: 1883,
      availableEspPa: 200,
      preBindReview: { status: 'coil_submittal_required', label: 'Coil Submittal Required' }
    }
  });
};

const airflowOnlyAhuReport = builder.buildProfessionalReportData({
  projectName: 'AHU Airflow Test',
  projectNo: 'Q-010',
  language: 'en'
});
assert.strictEqual(airflowOnlyAhuReport.equipmentSnapshot.totalCapacityBtuH, null);
assert.strictEqual(airflowOnlyAhuReport.equipmentSnapshot.coolingCapacityStatus, 'coil_submittal_required');
assert.strictEqual(airflowOnlyAhuReport.equipmentSnapshot.totalAirflowCfm, 1883);
assert.strictEqual(airflowOnlyAhuReport.equipmentSnapshot.availableEspPa, 200);

delete global.getQuoteRequiredBtu;
delete global.getRoomRequiredCfm;
delete global.getRoomSystemState;
delete global.getSelectedProjectEquipmentBtu;
delete global.getSelectedProjectEquipmentCfm;
delete global.getProjectEngineeringValidation;
delete global.getReportReferenceNumber;
delete global._ductBasis;
delete global._lastDuctSizing;
delete global._lastEspCalc;
delete global.localStorage;
delete global.hist;
delete global.lang;

console.log('Professional report data builder tests passed.');
