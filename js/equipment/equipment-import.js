(function () {
  'use strict';

  var STORAGE_KEY = 'aircalc_equipment_records';
  var REQUIRED_IMPORT_FIELDS = [
    'manufacturerId',
    'manufacturerName',
    'exactModelNumber',
    'equipmentType',
    'marketRegion',
    'catalogueRevision'
  ];

  function schema() {
    return window.AirCalcEquipmentSchema || null;
  }

  function catalogueModel() {
    return window.AirCalcEquipmentCatalogue || null;
  }

  function splitCsvLine(line) {
    var out = [];
    var cur = '';
    var quoted = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (ch === ',' && !quoted) {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map(function (v) { return String(v || '').trim(); });
  }

  function parseCsv(text) {
    text = String(text || '').replace(/^\uFEFF/, '');
    var lines = text.split(/\r?\n/).filter(function (line) { return String(line).trim() !== ''; });
    if (!lines.length) return { ok: false, headers: [], rows: [], errors: ['CSV file is empty.'] };
    var headers = splitCsvLine(lines[0]);
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var cells = splitCsvLine(lines[i]);
      var row = {};
      headers.forEach(function (h, idx) { row[h] = cells[idx] == null ? '' : cells[idx]; });
      rows.push({ lineNumber: i + 1, raw: row });
    }
    return { ok: true, headers: headers, rows: rows, errors: [] };
  }

  function nullableNumber(value) {
    if (value === '' || value == null) return null;
    var n = Number(String(value).replace(/,/g, ''));
    return isFinite(n) ? n : null;
  }

  function readExistingRecords() {
    try {
      var parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function writeExistingRecords(records) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records || []));
  }

  function normalizeImportRow(row, lineNumber, importContext) {
    var raw = row.raw || row || {};
    var S = schema();
    var C = catalogueModel();
    var record = {};
    var fields = S ? S.EQUIPMENT_FIELDS : Object.keys(raw);
    fields.forEach(function (field) {
      record[field] = raw[field] == null ? '' : raw[field];
    });
    record.id = record.id || [
      record.manufacturerId,
      record.exactModelNumber,
      record.marketRegion,
      record.catalogueRevision
    ].join('-').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    record.verificationStatus = 'draft';
    record.sourceType = record.sourceType || 'csv_import';
    record.createdAt = record.createdAt || new Date().toISOString();
    record.updatedAt = new Date().toISOString();
    record.version = record.version || 1;
    record.discontinued = record.discontinued === true || String(record.discontinued).toLowerCase() === 'true';
    ['coolingCapacityBtuH','coolingCapacityTR','coolingCapacityKw','sensibleCapacityBtuH','airflowMinCfm','airflowNominalCfm','airflowMaxCfm','availableEspPa','availableEspInWg','voltage','phase','frequencyHz','inputPowerKw','runningCurrentA','eer','seer','cop','iplv','weightKg','soundLevelDb','minOutdoorTemperatureC','maxOutdoorTemperatureC','catalogueYear','version'].forEach(function (field) {
      record[field] = nullableNumber(record[field]);
    });
    if (!record.coolingCapacityTR && record.coolingCapacityBtuH) record.coolingCapacityTR = Math.round((record.coolingCapacityBtuH / 12000) * 100) / 100;
    if (!record.coolingCapacityKw && record.coolingCapacityBtuH) record.coolingCapacityKw = Math.round((record.coolingCapacityBtuH / 3412.142) * 100) / 100;
    if (!record.availableEspInWg && record.availableEspPa) record.availableEspInWg = Math.round((record.availableEspPa / 249.0889) * 100) / 100;
    record.dimensions = {
      widthMm: nullableNumber(raw.dimensionWidthMm || raw.widthMm),
      depthMm: nullableNumber(raw.dimensionDepthMm || raw.depthMm),
      heightMm: nullableNumber(raw.dimensionHeightMm || raw.heightMm)
    };
    if (C && importContext) record = C.attachCatalogueMetadata(record, importContext);
    var validation = S ? S.validateEquipmentRecord(record) : { ok: true, errors: [], record: record };
    return {
      lineNumber: row.lineNumber || lineNumber || 0,
      ok: validation.ok,
      errors: validation.errors || [],
      raw: Object.assign({}, raw),
      record: validation.record || record
    };
  }

  function validateRows(rows, existingRecords, importContext) {
    var S = schema();
    var existingKeys = {};
    var seenKeys = {};
    (existingRecords || readExistingRecords()).forEach(function (record) {
      var normalized = S ? S.normalizeEquipmentRecord(record) : record;
      existingKeys[S ? S.duplicateKey(normalized) : normalized.duplicateKey] = true;
    });
    var results = (rows || []).map(function (row, idx) {
      var result = normalizeImportRow(row, idx + 2, importContext);
      REQUIRED_IMPORT_FIELDS.forEach(function (field) {
        if (!String((result.record && result.record[field]) || '').trim()) {
          result.ok = false;
          result.errors.push(field + ' is required for CSV import.');
        }
      });
      var key = S ? S.duplicateKey(result.record) : result.record.duplicateKey;
      result.duplicateKey = key;
      if (existingKeys[key]) {
        result.ok = false;
        result.duplicateType = 'existing';
        result.errors.push('Duplicate existing record.');
      } else if (seenKeys[key]) {
        result.ok = false;
        result.duplicateType = 'file';
        result.errors.push('Duplicate row in CSV file.');
      }
      seenKeys[key] = true;
      return result;
    });
    var summary = summarizeValidation(results);
    if (importContext) summary.importContext = importContext;
    return summary;
  }

  function summarizeValidation(results) {
    var valid = results.filter(function (r) { return r.ok; });
    var invalid = results.filter(function (r) { return !r.ok; });
    var duplicateCount = invalid.filter(function (r) { return r.duplicateType; }).length;
    return {
      ok: invalid.length === 0,
      totalRows: results.length,
      validRows: valid.length,
      invalidRows: invalid.length,
      duplicateRows: duplicateCount,
      results: results,
      validRecords: valid.map(function (r) { return r.record; })
    };
  }

  function importValidRecords(summary) {
    var existing = readExistingRecords();
    var next = existing.concat((summary && summary.validRecords) || []);
    writeExistingRecords(next);
    var C = catalogueModel();
    var catalogueResult = null;
    if (C && summary && summary.importContext) {
      catalogueResult = C.saveImportContext(summary.importContext, ((summary && summary.validRecords) || []).length);
    }
    return {
      ok: true,
      imported: ((summary && summary.validRecords) || []).length,
      total: next.length,
      catalogue: catalogueResult
    };
  }

  function buildTemplateCsv() {
    var fields = schema() ? schema().EQUIPMENT_FIELDS.slice() : REQUIRED_IMPORT_FIELDS.slice();
    var extra = ['dimensionWidthMm', 'dimensionDepthMm', 'dimensionHeightMm'];
    fields = fields.concat(extra).filter(function (field, idx, arr) { return arr.indexOf(field) === idx; });
    return fields.join(',') + '\n';
  }

  window.AirCalcEquipmentImport = {
    STORAGE_KEY: STORAGE_KEY,
    REQUIRED_IMPORT_FIELDS: REQUIRED_IMPORT_FIELDS,
    parseCsv: parseCsv,
    normalizeImportRow: normalizeImportRow,
    validateRows: validateRows,
    importValidRecords: importValidRecords,
    buildTemplateCsv: buildTemplateCsv,
    readExistingRecords: readExistingRecords,
    writeExistingRecords: writeExistingRecords
  };
})();
