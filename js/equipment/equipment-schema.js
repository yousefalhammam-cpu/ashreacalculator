(function () {
  'use strict';

  var REQUIRED_FIELDS = [
    'id',
    'manufacturerId',
    'manufacturerName',
    'exactModelNumber',
    'equipmentType',
    'marketRegion',
    'catalogueRevision',
    'verificationStatus'
  ];

  var NUMERIC_FIELDS = [
    'catalogueYear',
    'coolingCapacityBtuH',
    'coolingCapacityTR',
    'coolingCapacityKw',
    'sensibleCapacityBtuH',
    'airflowMinCfm',
    'airflowNominalCfm',
    'airflowMaxCfm',
    'availableEspPa',
    'availableEspInWg',
    'voltage',
    'phase',
    'frequencyHz',
    'inputPowerKw',
    'runningCurrentA',
    'eer',
    'seer',
    'cop',
    'iplv',
    'weightKg',
    'soundLevelDb',
    'minOutdoorTemperatureC',
    'maxOutdoorTemperatureC',
    'version'
  ];

  var EQUIPMENT_FIELDS = [
    'id',
    'manufacturerId',
    'manufacturerName',
    'brand',
    'series',
    'exactModelNumber',
    'indoorModelNumber',
    'outdoorModelNumber',
    'equipmentType',
    'marketRegion',
    'saudiMarketStatus',
    'catalogueId',
    'catalogueVersionId',
    'catalogueVersionLabel',
    'catalogueYear',
    'catalogueRevision',
    'coolingCapacityBtuH',
    'coolingCapacityTR',
    'coolingCapacityKw',
    'sensibleCapacityBtuH',
    'airflowMinCfm',
    'airflowNominalCfm',
    'airflowMaxCfm',
    'availableEspPa',
    'availableEspInWg',
    'voltage',
    'phase',
    'frequencyHz',
    'inputPowerKw',
    'runningCurrentA',
    'eer',
    'seer',
    'cop',
    'iplv',
    'refrigerant',
    'compressorType',
    'dimensions',
    'weightKg',
    'soundLevelDb',
    'minOutdoorTemperatureC',
    'maxOutdoorTemperatureC',
    'sourceType',
    'sourceDocumentName',
    'sourceReference',
    'verificationStatus',
    'verifiedAt',
    'verifiedBy',
    'publishedAt',
    'archivedAt',
    'reviewerNote',
    'reviewerNoteUpdatedAt',
    'workflowStatus',
    'workflowHistory',
    'cloudConflict',
    'cloudConflictAt',
    'cloudConflictRecord',
    'discontinued',
    'notes',
    'createdAt',
    'updatedAt',
    'version'
  ];

  function text(value) {
    return value == null ? '' : String(value).trim();
  }

  function nullableNumber(value) {
    if (value === '' || value == null) return null;
    var n = Number(value);
    return isFinite(n) ? n : null;
  }

  function bool(value) {
    if (value === true || value === 'true' || value === '1' || value === 1) return true;
    return false;
  }

  function displayValue(value, lang) {
    if (value === '' || value == null) return lang === 'en' ? 'Not provided' : 'غير متوفر';
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  function duplicateKey(record) {
    var versionKey = text(record.catalogueVersionId) || text(record.catalogueRevision);
    return [
      text(record.manufacturerId).toLowerCase(),
      text(record.exactModelNumber).toLowerCase(),
      text(record.marketRegion).toLowerCase(),
      versionKey.toLowerCase()
    ].join('|');
  }

  function normalizeEquipmentRecord(input) {
    var source = input || {};
    var out = {};
    EQUIPMENT_FIELDS.forEach(function (field) {
      if (field === 'dimensions') {
        out.dimensions = source.dimensions && typeof source.dimensions === 'object'
          ? {
              widthMm: nullableNumber(source.dimensions.widthMm),
              depthMm: nullableNumber(source.dimensions.depthMm),
              heightMm: nullableNumber(source.dimensions.heightMm)
            }
          : { widthMm: null, depthMm: null, heightMm: null };
      } else if (field === 'workflowHistory') {
        out.workflowHistory = Array.isArray(source.workflowHistory) ? source.workflowHistory.slice() : [];
      } else if (field === 'cloudConflict') {
        out.cloudConflict = bool(source.cloudConflict);
      } else if (field === 'cloudConflictRecord') {
        out.cloudConflictRecord = source.cloudConflictRecord && typeof source.cloudConflictRecord === 'object'
          ? Object.assign({}, source.cloudConflictRecord)
          : null;
      } else if (field === 'discontinued') {
        out.discontinued = bool(source.discontinued);
      } else if (NUMERIC_FIELDS.indexOf(field) >= 0) {
        out[field] = nullableNumber(source[field]);
      } else {
        out[field] = text(source[field]);
      }
    });
    out.sampleData = bool(source.sampleData) || out.verificationStatus === 'sample';
    out.duplicateKey = duplicateKey(out);
    return out;
  }

  function validateEquipmentRecord(record) {
    var normalized = normalizeEquipmentRecord(record);
    var errors = [];
    REQUIRED_FIELDS.forEach(function (field) {
      if (!text(normalized[field])) errors.push(field + ' is required.');
    });
    if (normalized.coolingCapacityBtuH != null && normalized.coolingCapacityBtuH <= 0) {
      errors.push('coolingCapacityBtuH must be greater than zero when provided.');
    }
    if (normalized.airflowNominalCfm != null && normalized.airflowNominalCfm <= 0) {
      errors.push('airflowNominalCfm must be greater than zero when provided.');
    }
    if (normalized.availableEspPa != null && normalized.availableEspPa < 0) {
      errors.push('availableEspPa cannot be negative.');
    }
    return { ok: errors.length === 0, errors: errors, record: normalized };
  }

  window.AirCalcEquipmentSchema = {
    EQUIPMENT_FIELDS: EQUIPMENT_FIELDS,
    REQUIRED_FIELDS: REQUIRED_FIELDS,
    NUMERIC_FIELDS: NUMERIC_FIELDS,
    normalizeEquipmentRecord: normalizeEquipmentRecord,
    validateEquipmentRecord: validateEquipmentRecord,
    duplicateKey: duplicateKey,
    displayValue: displayValue
  };
})();
