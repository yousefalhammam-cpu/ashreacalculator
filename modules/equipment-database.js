(function () {
  'use strict';

  var STORAGE_KEY = 'aircalc_equipment_records';
  var DEV_SAMPLE_KEY = 'aircalc_show_sample_equipment';
  var selectedCompareIds = [];
  var viewMode = 'table';
  var importSummary = null;
  var catalogueSyncTimer = null;
  var catalogueSourceFileMeta = null;

  function G(id) { return document.getElementById(id); }
  function lang() { return (window.lang || document.documentElement.lang || 'ar') === 'en' ? 'en' : 'ar'; }
  function isAr() { return lang() === 'ar'; }
  function t(ar, en) { return isAr() ? ar : en; }
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr(s) {
    return esc(s).replace(/'/g, '&#39;');
  }

  function schema() {
    return window.AirCalcEquipmentSchema || null;
  }

  function manufacturers() {
    return (window.AirCalcEquipmentManufacturers || []).slice();
  }

  function readStoredRecords() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      return [];
    }
  }

  function writeStoredRecords(records) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(records) ? records : []));
      return true;
    } catch (_err) {
      return false;
    }
  }

  function writeCatalogueSyncStatus(status) {
    try {
      localStorage.setItem('aircalc_equipment_catalogue_sync_status', JSON.stringify(Object.assign({
        updatedAt: new Date().toISOString()
      }, status || {})));
    } catch (_err) {}
  }

  function getCatalogueSyncStatus() {
    try {
      var parsed = JSON.parse(localStorage.getItem('aircalc_equipment_catalogue_sync_status') || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_err) {
      return {};
    }
  }

  function showSampleData() {
    try {
      return localStorage.getItem(DEV_SAMPLE_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function allRecords() {
    var S = schema();
    var importer = window.AirCalcEquipmentImport || null;
    var records = importer && typeof importer.readExistingRecords === 'function'
      ? importer.readExistingRecords()
      : readStoredRecords();
    records = records.concat(window.AirCalcRealEquipmentRecords || []);
    if (showSampleData()) {
      records = records.concat(window.AirCalcSampleEquipmentRecords || []);
    }
    if (S) records = records.map(S.normalizeEquipmentRecord);
    return records;
  }

  function fmtNum(value, suffix) {
    if (value === '' || value == null || !isFinite(Number(value))) {
      return '<span class="equip-muted">' + t('غير متوفر', 'Not provided') + '</span>';
    }
    return Number(value).toLocaleString('en-US') + (suffix ? ' ' + suffix : '');
  }

  function fmtText(value) {
    var S = schema();
    return esc(S ? S.displayValue(value, lang()) : (value || t('غير متوفر', 'Not provided')));
  }

  function normalizeWorkflowStatus(status) {
    var C = window.AirCalcEquipmentCatalogue;
    if (C && typeof C.normalizeRecordStatus === 'function') return C.normalizeRecordStatus(status);
    status = String(status || 'imported').toLowerCase();
    if (status === 'draft') return 'imported';
    if (status === 'pending') return 'pending_review';
    return status;
  }

  function statusLabel(status) {
    status = normalizeWorkflowStatus(status);
    if (status === 'imported') return isAr() ? '\u0645\u0633\u062a\u0648\u0631\u062f' : 'Imported';
    if (status === 'pending_review') return isAr() ? '\u0628\u0627\u0646\u062a\u0638\u0627\u0631 \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629' : 'Pending review';
    if (status === 'published') return isAr() ? '\u0645\u0646\u0634\u0648\u0631' : 'Published';
    if (status === 'archived') return isAr() ? '\u0645\u0624\u0631\u0634\u0641' : 'Archived';
    var map = {
      verified: [ 'موثق', 'Verified' ],
      pending: [ 'بانتظار المراجعة', 'Pending review' ],
      draft: [ 'مسودة', 'Draft' ],
      sample: [ 'Sample - غير للاختيار', 'Sample - not for selection' ],
      rejected: [ 'مرفوض', 'Rejected' ]
    };
    var hit = map[String(status || '').toLowerCase()] || [ 'غير معروف', 'Unknown' ];
    return isAr() ? hit[0] : hit[1];
  }

  function statusClass(status) {
    status = normalizeWorkflowStatus(status);
    if (status === 'published') return 'ok';
    if (status === 'verified') return 'ok';
    if (status === 'sample' || status === 'rejected') return 'danger';
    if (status === 'draft' || status === 'imported' || status === 'pending' || status === 'pending_review') return 'warn';
    return 'neutral';
  }

  function importMetaValue(id) {
    return String((G(id) || {}).value || '').trim();
  }

  function currentImportContextInfo() {
    var C = window.AirCalcEquipmentCatalogue;
    var input = {
      manufacturerId: importMetaValue('equip-import-manufacturer-id'),
      manufacturerName: importMetaValue('equip-import-manufacturer-name'),
      catalogueYear: importMetaValue('equip-import-catalogue-year'),
      catalogueRevision: importMetaValue('equip-import-catalogue-revision'),
      sourceDocumentName: importMetaValue('equip-import-source-document') || (catalogueSourceFileMeta && catalogueSourceFileMeta.name) || '',
      sourceReference: importMetaValue('equip-import-source-reference'),
      sourceUrl: importMetaValue('equip-import-source-url'),
      sourceHash: (catalogueSourceFileMeta && catalogueSourceFileMeta.sha256) || ''
    };
    var hasAny = Object.keys(input).some(function (key) { return String(input[key] || '').trim() !== ''; });
    if (!hasAny) return { context: null, warnings: [] };

    var required = [
      ['manufacturerId', 'Manufacturer ID'],
      ['manufacturerName', 'Manufacturer name'],
      ['catalogueRevision', 'Catalogue revision'],
      ['sourceDocumentName', 'Source document']
    ];
    var warnings = required.filter(function (pair) {
      return !String(input[pair[0]] || '').trim();
    }).map(function (pair) {
      return pair[1] + ' is required for a real manufacturer catalogue import.';
    });
    var context = C && typeof C.createImportContext === 'function' ? C.createImportContext(input) : null;
    return { context: context, warnings: warnings, input: input };
  }

  function hexFromBuffer(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), function (byte) {
      return byte.toString(16).padStart(2, '0');
    }).join('');
  }

  async function handleSourceFile(file) {
    catalogueSourceFileMeta = null;
    var status = G('equip-import-source-file-status');
    if (!file) {
      if (status) status.textContent = '';
      return { ok: false, reason: 'no_source_file' };
    }
    var meta = {
      name: file.name || '',
      size: file.size || 0,
      type: file.type || '',
      sha256: '',
      hashedAt: new Date().toISOString()
    };
    var sourceName = G('equip-import-source-document');
    if (sourceName && !String(sourceName.value || '').trim()) sourceName.value = meta.name;
    if (status) status.textContent = t('جاري حساب بصمة ملف المصدر...', 'Calculating source file fingerprint...');
    try {
      if (!window.crypto || !window.crypto.subtle || typeof file.arrayBuffer !== 'function') {
        throw new Error('crypto_subtle_unavailable');
      }
      var digest = await window.crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      meta.sha256 = hexFromBuffer(digest);
      catalogueSourceFileMeta = meta;
      if (status) status.textContent = t('تم ربط ملف المصدر وحساب SHA-256.', 'Source file linked with SHA-256 fingerprint.');
      return { ok: true, meta: meta };
    } catch (err) {
      meta.hashWarning = (err && err.message) || 'source_hash_unavailable';
      catalogueSourceFileMeta = meta;
      if (status) status.textContent = t('تم ربط اسم الملف، لكن لم يتم حساب SHA-256 في هذا المتصفح.', 'Source file name linked, but SHA-256 could not be calculated in this browser.');
      return { ok: true, meta: meta, warning: meta.hashWarning };
    }
  }

  function typeLabel(type) {
    var map = {
      split: [ 'سبليت جداري', 'Wall split' ],
      ducted: [ 'سبليت مخفي', 'Ducted split' ],
      package: [ 'باكج', 'Package unit' ],
      ahu: [ 'وحدة مناولة هواء', 'AHU' ],
      fcu: [ 'FCU', 'FCU' ],
      vrf: [ 'VRF', 'VRF' ],
      chiller: [ 'Chiller', 'Chiller' ]
    };
    var hit = map[String(type || '').toLowerCase()] || [ type || '-', type || '-' ];
    return isAr() ? hit[0] : hit[1];
  }

  function currentFilters() {
    return {
      query: String((G('equip-search') || {}).value || '').trim().toLowerCase(),
      manufacturerId: String((G('equip-filter-manufacturer') || {}).value || 'all'),
      equipmentType: String((G('equip-filter-type') || {}).value || 'all'),
      minCapacity: Number((G('equip-filter-capacity-min') || {}).value || 0) || 0,
      minCfm: Number((G('equip-filter-cfm-min') || {}).value || 0) || 0,
      minEsp: Number((G('equip-filter-esp-min') || {}).value || 0) || 0,
      voltagePhase: String((G('equip-filter-electrical') || {}).value || 'all'),
      verificationStatus: String((G('equip-filter-status') || {}).value || 'all'),
      conflictOnly: String((G('equip-filter-status') || {}).value || 'all') === 'cloud_conflict'
    };
  }

  function matches(record, filters) {
    var haystack = [
      record.manufacturerName,
      record.brand,
      record.series,
      record.exactModelNumber,
      record.indoorModelNumber,
      record.outdoorModelNumber
    ].join(' ').toLowerCase();
    if (filters.query && haystack.indexOf(filters.query) < 0) return false;
    if (filters.manufacturerId !== 'all' && record.manufacturerId !== filters.manufacturerId) return false;
    if (filters.equipmentType !== 'all' && record.equipmentType !== filters.equipmentType) return false;
    if (filters.minCapacity && Number(record.coolingCapacityBtuH || 0) < filters.minCapacity) return false;
    if (filters.minCfm && Number(record.airflowNominalCfm || 0) < filters.minCfm) return false;
    if (filters.minEsp && Number(record.availableEspPa || 0) < filters.minEsp) return false;
    if (filters.voltagePhase !== 'all') {
      var parts = filters.voltagePhase.split('-');
      if (Number(record.voltage || 0) !== Number(parts[0]) || Number(record.phase || 0) !== Number(parts[1])) return false;
    }
    if (filters.conflictOnly && !record.cloudConflict) return false;
    if (filters.conflictOnly) return true;
    if (filters.verificationStatus !== 'all' && !statusMatchesFilter(record.verificationStatus, filters.verificationStatus)) return false;
    return true;
  }

  function statusMatchesFilter(status, filter) {
    status = String(status || '').toLowerCase();
    filter = String(filter || '').toLowerCase();
    if (status === filter) return true;
    return normalizeWorkflowStatus(status) === normalizeWorkflowStatus(filter);
  }

  function filteredRecords() {
    var filters = currentFilters();
    return allRecords().filter(function (record) { return matches(record, filters); });
  }

  function enrichManufacturerCounts() {
    var records = allRecords();
    return manufacturers().map(function (m) {
      var own = records.filter(function (r) { return r.manufacturerId === m.id; });
      var verified = own.filter(function (r) { var s = normalizeWorkflowStatus(r.verificationStatus); return s === 'verified' || s === 'published'; }).length;
      var pending = own.filter(function (r) { var s = normalizeWorkflowStatus(r.verificationStatus); return s === 'pending_review' || s === 'imported'; }).length;
      var sample = own.filter(function (r) { return r.sampleData; }).length;
      var updated = own.reduce(function (latest, r) {
        return String(r.updatedAt || '') > latest ? String(r.updatedAt || '') : latest;
      }, m.updatedAt || '');
      var availability = verified ? 'verified_available' : (pending ? 'pending_review' : (sample ? 'sample_only' : 'none'));
      return Object.assign({}, m, {
        verifiedModelCount: verified,
        pendingModelCount: pending,
        sampleModelCount: sample,
        lastUpdated: updated || '',
        dataAvailabilityStatus: availability
      });
    });
  }

  function readCatalogueVersions() {
    var C = window.AirCalcEquipmentCatalogue;
    return C && typeof C.readVersions === 'function' ? C.readVersions() : [];
  }

  function readCatalogueStoreForCloud() {
    var C = window.AirCalcEquipmentCatalogue;
    return {
      catalogues: C && typeof C.readCatalogues === 'function' ? C.readCatalogues() : [],
      versions: C && typeof C.readVersions === 'function' ? C.readVersions() : [],
      records: allRecords().filter(function (record) { return record && !record.sampleData; })
    };
  }

  function cloudRecordFingerprint(record) {
    var S = schema();
    var normalized = S ? S.normalizeEquipmentRecord(record) : (record || {});
    var copy = Object.assign({}, normalized);
    delete copy.updatedAt;
    delete copy.cloudConflict;
    delete copy.cloudConflictAt;
    delete copy.cloudConflictRecord;
    return JSON.stringify(copy);
  }

  function mergeCloudEquipmentRecords(records) {
    var S = schema();
    var local = readStoredRecords().map(function (record) {
      return S ? S.normalizeEquipmentRecord(record) : record;
    });
    var byId = {};
    local.forEach(function (record, idx) {
      if (record && record.id) byId[record.id] = idx;
    });
    var imported = 0;
    var conflicts = 0;
    (records || []).forEach(function (record) {
      var normalized = S ? S.normalizeEquipmentRecord(record) : record;
      if (!normalized || !normalized.id || normalized.sampleData) return;
      if (byId[normalized.id] == null) {
        local.push(normalized);
        byId[normalized.id] = local.length - 1;
        imported += 1;
        return;
      }
      var existing = local[byId[normalized.id]];
      if (cloudRecordFingerprint(existing) !== cloudRecordFingerprint(normalized)) {
        local[byId[normalized.id]] = Object.assign({}, existing, {
          cloudConflict: true,
          cloudConflictAt: new Date().toISOString(),
          cloudConflictRecord: normalized
        });
        conflicts += 1;
      }
    });
    writeStoredRecords(local);
    return { imported: imported, conflicts: conflicts };
  }

  async function importCloudCatalogue(options) {
    options = options || {};
    if (!window.AppAuth || typeof window.AppAuth.loadEquipmentCatalogueFromCloud !== 'function') {
      writeCatalogueSyncStatus({ state: 'local_only', reason: 'cloud_unavailable' });
      return { ok: false, reason: 'cloud_unavailable' };
    }
    var result = await window.AppAuth.loadEquipmentCatalogueFromCloud({ silent: options.silent !== false });
    if (!result || !result.ok) {
      writeCatalogueSyncStatus({ state: 'sync_failed', reason: (result && result.reason) || 'cloud_import_failed' });
      renderRecords();
      if (!options.silent && window.toast) window.toast(t('\u0644\u0645 \u064a\u0643\u062a\u0645\u0644 \u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0627\u0644\u0643\u062a\u0627\u0644\u0648\u062c \u0645\u0646 \u0627\u0644\u0633\u062d\u0627\u0628\u0629', 'Cloud catalogue import did not complete'));
      return result || { ok: false };
    }
    var C = window.AirCalcEquipmentCatalogue;
    var metaMerge = C && typeof C.mergeCloudStore === 'function'
      ? C.mergeCloudStore(result)
      : { importedCatalogues: 0, importedVersions: 0 };
    var recordMerge = mergeCloudEquipmentRecords(result.records || []);
    writeCatalogueSyncStatus({
      state: 'synced',
      importedCatalogues: metaMerge.importedCatalogues || 0,
      importedVersions: metaMerge.importedVersions || 0,
      importedRecords: recordMerge.imported,
      conflicts: recordMerge.conflicts
    });
    renderRecords();
    if (!options.silent && window.toast) {
      window.toast(t('\u062a\u0645 \u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0633\u062c\u0644\u0627\u062a: ', 'Imported records: ') + recordMerge.imported);
    }
    return Object.assign({ ok: true }, metaMerge, recordMerge);
  }

  async function syncCatalogueToCloud(options) {
    options = options || {};
    if (!window.AppAuth || typeof window.AppAuth.saveEquipmentCatalogueToCloud !== 'function') {
      writeCatalogueSyncStatus({ state: 'local_only', reason: 'cloud_unavailable' });
      return { ok: false, reason: 'cloud_unavailable' };
    }
    var store = readCatalogueStoreForCloud();
    var result = await window.AppAuth.saveEquipmentCatalogueToCloud(store, { silent: options.silent !== false });
    if (result && result.ok) {
      writeCatalogueSyncStatus({
        state: 'synced',
        ownerId: result.ownerId || '',
        catalogues: result.catalogues || 0,
        versions: result.versions || 0,
        records: result.records || 0
      });
      if (!options.silent && window.toast) window.toast(t('\u062a\u0645\u062a \u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u0643\u062a\u0627\u0644\u0648\u062c', 'Catalogue synced'));
    } else {
      writeCatalogueSyncStatus({ state: 'sync_failed', reason: (result && result.reason) || 'unknown' });
      if (!options.silent && window.toast) window.toast(t('\u0644\u0645 \u062a\u062a\u0645 \u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u0643\u062a\u0627\u0644\u0648\u062c', 'Catalogue sync did not complete'));
    }
    return result;
  }

  function scheduleCatalogueCloudSync() {
    clearTimeout(catalogueSyncTimer);
    catalogueSyncTimer = setTimeout(function () {
      syncCatalogueToCloud({ silent: true });
    }, 1200);
  }

  function versionDisplayLabel(version) {
    if (!version) return '';
    return [
      version.manufacturerId || version.catalogueId || '',
      version.versionLabel || version.id || '',
      version.year || ''
    ].filter(Boolean).join(' · ');
  }

  function versionOptions(records) {
    var byId = {};
    readCatalogueVersions().forEach(function (version) {
      if (!version.id) return;
      byId[version.id] = Object.assign({}, version, { recordCount: Number(version.recordCount || 0) });
    });
    (records || []).forEach(function (record) {
      if (!record || record.sampleData) return;
      var id = record.catalogueVersionId || record.catalogueRevision || '';
      if (!id) return;
      if (!byId[id]) {
        byId[id] = {
          id: id,
          catalogueId: record.catalogueId || '',
          manufacturerId: record.manufacturerId || '',
          year: record.catalogueYear || null,
          versionLabel: record.catalogueVersionLabel || record.catalogueRevision || id,
          recordCount: 0
        };
      }
      byId[id].recordCount = Number(byId[id].recordCount || 0) + 1;
    });
    return Object.keys(byId).map(function (id) { return byId[id]; }).sort(function (a, b) {
      return versionDisplayLabel(a).localeCompare(versionDisplayLabel(b));
    });
  }

  function renderFilterOptions() {
    var manSel = G('equip-filter-manufacturer');
    if (manSel && !manSel.dataset.boundOptions) {
      manSel.innerHTML = '<option value="all">' + t('كل الشركات', 'All manufacturers') + '</option>' +
        manufacturers().map(function (m) {
          return '<option value="' + esc(m.id) + '">' + esc(m.name) + '</option>';
        }).join('');
      manSel.dataset.boundOptions = '1';
    }
  }

  function renderRegistry() {
    var host = G('equip-manufacturer-registry');
    if (!host) return;
    var rows = enrichManufacturerCounts();
    host.innerHTML = rows.map(function (m) {
      return '<div class="equip-manufacturer-row">' +
        '<div>' + (window.AirCalcManufacturerLogo?window.AirCalcManufacturerLogo(m.name):'') + '<strong>' + esc(m.name) + '</strong><span>' + esc(m.id) + '</span></div>' +
        '<div>' + Number(m.verifiedModelCount || 0).toLocaleString() + '</div>' +
        '<div>' + Number(m.pendingModelCount || 0).toLocaleString() + '</div>' +
        '<div>' + (m.lastUpdated ? esc(String(m.lastUpdated).slice(0, 10)) : t('لا يوجد', 'None')) + '</div>' +
        '<div><span class="equip-status ' + statusClass(m.dataAvailabilityStatus === 'verified_available' ? 'verified' : (m.dataAvailabilityStatus === 'sample_only' ? 'sample' : 'pending')) + '">' + esc(availabilityLabel(m.dataAvailabilityStatus)) + '</span></div>' +
      '</div>';
    }).join('');
  }

  function availabilityLabel(status) {
    var map = {
      none: [ 'لا توجد بيانات', 'No data' ],
      sample_only: [ 'عينات اختبار فقط', 'Sample only' ],
      pending_review: [ 'بانتظار المراجعة', 'Pending review' ],
      verified_available: [ 'بيانات موثقة', 'Verified data' ]
    };
    var hit = map[status] || map.none;
    return isAr() ? hit[0] : hit[1];
  }

  function renderStats(records) {
    var host = G('equip-stats');
    if (!host) return;
    var verified = records.filter(function (r) { var s = normalizeWorkflowStatus(r.verificationStatus); return s === 'verified' || s === 'published'; }).length;
    var pending = records.filter(function (r) { var s = normalizeWorkflowStatus(r.verificationStatus); return s === 'pending_review' || s === 'imported'; }).length;
    var sample = records.filter(function (r) { return r.sampleData; }).length;
    host.innerHTML =
      statCard(t('إجمالي السجلات المعروضة', 'Displayed records'), records.length) +
      statCard(t('موديلات موثقة', 'Verified models'), verified) +
      statCard(t('بانتظار المراجعة', 'Pending review'), pending) +
      statCard(t('عينات اختبار', 'Sample records'), sample);
  }

  function statCard(label, value) {
    return '<div class="equip-stat"><span>' + esc(label) + '</span><strong>' + Number(value || 0).toLocaleString() + '</strong></div>';
  }

  function csvCell(value) {
    var textValue = value == null ? '' : String(value);
    return '"' + textValue.replace(/"/g, '""') + '"';
  }

  function buildRejectedRowsCsv(summary) {
    var rows = ((summary && summary.results) || []).filter(function (row) { return !row.ok; });
    var headers = [
      'lineNumber',
      'errors',
      'duplicateType',
      'manufacturerId',
      'manufacturerName',
      'exactModelNumber',
      'equipmentType',
      'marketRegion',
      'catalogueRevision',
      'coolingCapacityBtuH',
      'airflowNominalCfm',
      'availableEspPa'
    ];
    var csv = [headers.join(',')];
    rows.forEach(function (row) {
      var record = row.record || {};
      var raw = row.raw || {};
      csv.push(headers.map(function (field) {
        if (field === 'lineNumber') return csvCell(row.lineNumber);
        if (field === 'errors') return csvCell((row.errors || []).join(' | '));
        if (field === 'duplicateType') return csvCell(row.duplicateType || '');
        return csvCell(record[field] != null && record[field] !== '' ? record[field] : raw[field]);
      }).join(','));
    });
    return csv.join('\n');
  }

  function recordActions(record) {
    var checked = selectedCompareIds.indexOf(record.id) >= 0 ? ' checked' : '';
    var selectDisabled = record.sampleData ? ' disabled title="' + esc(t('\u0639\u064a\u0646\u0627\u062a \u0627\u0644\u0627\u062e\u062a\u0628\u0627\u0631 \u0644\u0627 \u064a\u0645\u0643\u0646 \u0627\u062e\u062a\u064a\u0627\u0631\u0647\u0627 \u0644\u0644\u0645\u0634\u0631\u0648\u0639', 'Sample records cannot be selected for projects')) + '"' : '';
    var workflowButtons = recordWorkflowButtons(record);
    var conflictButtons = recordConflictButtons(record);
    return '<div class="equip-actions">' +
      '<button type="button" onclick="AppEquipmentDatabase.openDetails(\'' + esc(record.id) + '\')">' + t('\u0627\u0644\u062a\u0641\u0627\u0635\u064a\u0644', 'Details') + '</button>' +
      '<button type="button"' + selectDisabled + ' onclick="AppEquipmentDatabase.selectForProject(\'' + esc(record.id) + '\')">' + t('\u0627\u062e\u062a\u064a\u0627\u0631 \u0644\u0644\u0645\u0634\u0631\u0648\u0639', 'Use for project') + '</button>' +
      workflowButtons +
      conflictButtons +
      '<label class="equip-compare-toggle"><input type="checkbox"' + checked + ' onchange="AppEquipmentDatabase.toggleCompare(\'' + esc(record.id) + '\', this.checked)"> ' + t('\u0642\u0627\u0631\u0646', 'Compare') + '</label>' +
    '</div>';
  }

  function recordConflictButtons(record) {
    if (!record || !record.cloudConflict || !record.cloudConflictRecord) return '';
    return '<button class="equip-conflict-keep" type="button" onclick="AppEquipmentDatabase.resolveCloudConflict(\'' + esc(record.id) + '\',\'keep_local\')">' + t('\u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u0645\u062d\u0644\u064a', 'Keep Local') + '</button>' +
      '<button class="equip-conflict-cloud" type="button" onclick="AppEquipmentDatabase.resolveCloudConflict(\'' + esc(record.id) + '\',\'use_cloud\')">' + t('\u0627\u0633\u062a\u062e\u062f\u0627\u0645 \u0627\u0644\u0633\u062d\u0627\u0628\u0629', 'Use Cloud') + '</button>';
  }

  function conflictPreviewFields() {
    return [
      ['coolingCapacityBtuH', 'BTU/h'],
      ['coolingCapacityTR', 'TR'],
      ['coolingCapacityKw', 'kW'],
      ['airflowNominalCfm', 'CFM'],
      ['availableEspPa', 'ESP Pa'],
      ['availableEspInWg', 'ESP in.wg'],
      ['equipmentType', t('\u0646\u0648\u0639 \u0627\u0644\u0648\u062d\u062f\u0629', 'Equipment type')],
      ['verificationStatus', t('\u062d\u0627\u0644\u0629 \u0627\u0644\u062a\u062d\u0642\u0642', 'Verification')],
      ['sourceDocumentName', t('\u0627\u0644\u0645\u0635\u062f\u0631', 'Source')],
      ['sourceReference', t('\u0645\u0631\u062c\u0639 \u0627\u0644\u0645\u0635\u062f\u0631', 'Source reference')],
      ['reviewerNote', t('\u0645\u0644\u0627\u062d\u0638\u0629 \u0627\u0644\u0645\u0631\u0627\u062c\u0639', 'Reviewer note')]
    ];
  }

  function buildConflictDiff(record) {
    if (!record || !record.cloudConflictRecord) return [];
    var cloud = record.cloudConflictRecord || {};
    return conflictPreviewFields().map(function (item) {
      var field = item[0];
      var localValue = record[field];
      var cloudValue = cloud[field];
      return {
        field: field,
        label: item[1],
        local: localValue,
        cloud: cloudValue,
        changed: compareFieldValue(localValue) !== compareFieldValue(cloudValue)
      };
    }).filter(function (row) { return row.changed; });
  }

  function renderConflictPreview(record) {
    if (!record || !record.cloudConflict || !record.cloudConflictRecord) return '';
    var diffs = buildConflictDiff(record);
    return '<div class="equip-conflict-preview">' +
      '<div class="equip-conflict-preview-head"><strong>' + t('\u0645\u0639\u0627\u064a\u0646\u0629 \u062a\u0639\u0627\u0631\u0636 \u0627\u0644\u0633\u062d\u0627\u0628\u0629', 'Cloud Conflict Preview') + '</strong><span>' + t('\u0631\u0627\u062c\u0639 \u0627\u0644\u0641\u0631\u0648\u0642 \u0642\u0628\u0644 \u0627\u0639\u062a\u0645\u0627\u062f \u0623\u064a \u0646\u0633\u062e\u0629.', 'Review differences before accepting either copy.') + '</span></div>' +
      (diffs.length ? '<div class="equip-conflict-diff-table"><table><thead><tr><th>' + t('\u0627\u0644\u062d\u0642\u0644', 'Field') + '</th><th>' + t('\u0627\u0644\u0645\u062d\u0644\u064a', 'Local') + '</th><th>' + t('\u0627\u0644\u0633\u062d\u0627\u0628\u0629', 'Cloud') + '</th></tr></thead><tbody>' +
        diffs.map(function (diff) {
          return '<tr><td>' + esc(diff.label) + '</td><td>' + fmtText(diff.local) + '</td><td>' + fmtText(diff.cloud) + '</td></tr>';
        }).join('') +
      '</tbody></table></div>' : '<div class="equip-import-ok">' + t('\u0644\u0627 \u062a\u0648\u062c\u062f \u0641\u0631\u0648\u0642 \u0641\u064a \u0627\u0644\u062d\u0642\u0648\u0644 \u0627\u0644\u0645\u0647\u0645\u0629.', 'No differences in tracked fields.') + '</div>') +
      '<div class="equip-conflict-preview-actions">' + recordConflictButtons(record) + '</div>' +
    '</div>';
  }

  function conflictRecords(records) {
    return (records || []).filter(function (record) {
      return !!(record && record.cloudConflict && record.cloudConflictRecord && !record.sampleData);
    });
  }

  function setConflictFilter() {
    var status = G('equip-filter-status');
    if (status) status.value = 'cloud_conflict';
    renderRecords();
  }

  function renderConflictReview(records) {
    var host = G('equip-conflict-review');
    if (!host) return;
    var conflicts = conflictRecords(records);
    if (!conflicts.length) {
      host.innerHTML = '<div class="equip-review-empty">' + t('\u0644\u0627 \u062a\u0648\u062c\u062f \u062a\u0639\u0627\u0631\u0636\u0627\u062a \u0643\u062a\u0627\u0644\u0648\u062c \u062d\u0627\u0644\u064a\u064b\u0627.', 'No catalogue conflicts currently need review.') + '</div>';
      return;
    }
    host.innerHTML =
      '<div class="equip-review-stats">' +
        statCard(t('\u062a\u0639\u0627\u0631\u0636\u0627\u062a', 'Conflicts'), conflicts.length) +
        statCard(t('\u062a\u062d\u062a\u0627\u062c \u0642\u0631\u0627\u0631', 'Need decision'), conflicts.length) +
        statCard(t('\u0622\u0645\u0646 \u0644\u0644\u0645\u062d\u0644\u064a', 'Safe local'), conflicts.length) +
        statCard(t('\u0639\u064a\u0646\u0627\u062a', 'Samples'), 0) +
      '</div>' +
      '<div class="equip-review-toolbar">' +
        '<button type="button" onclick="AppEquipmentDatabase.setConflictFilter()">' + t('\u0639\u0631\u0636 \u0627\u0644\u0645\u062a\u0639\u0627\u0631\u0636 \u0641\u0642\u0637', 'Show conflicts only') + '</button>' +
        '<button type="button" onclick="AppEquipmentDatabase.resolveConflictBatchKeepLocal()">' + t('\u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u0645\u062d\u0644\u064a \u0644\u0644\u0643\u0644', 'Keep local for all') + '</button>' +
      '</div>' +
      '<div class="equip-review-list">' +
        conflicts.slice(0, 12).map(renderConflictReviewRow).join('') +
        (conflicts.length > 12 ? '<div class="equip-review-more">' + t('\u062a\u0648\u062c\u062f \u062a\u0639\u0627\u0631\u0636\u0627\u062a \u0625\u0636\u0627\u0641\u064a\u0629 \u0641\u064a \u0627\u0644\u062c\u062f\u0648\u0644.', 'Additional conflicts are available in the table.') + '</div>' : '') +
      '</div>';
  }

  function renderConflictReviewRow(record) {
    var diffs = buildConflictDiff(record);
    var firstDiff = diffs[0];
    var diffText = firstDiff
      ? esc(firstDiff.label) + ': ' + fmtText(firstDiff.local) + ' -> ' + fmtText(firstDiff.cloud)
      : t('\u062a\u0639\u0627\u0631\u0636 \u0628\u062f\u0648\u0646 \u0641\u0631\u0648\u0642 \u0645\u062a\u062a\u0628\u0639\u0629', 'Conflict without tracked field differences');
    return '<div class="equip-review-row equip-conflict-review-row">' +
      '<div><strong>' + fmtText(record.manufacturerName) + ' · ' + fmtText(record.exactModelNumber) + '</strong><span>' + diffText + '</span></div>' +
      '<span class="equip-status warn">' + t('\u062a\u0639\u0627\u0631\u0636', 'Conflict') + '</span>' +
      '<button type="button" onclick="AppEquipmentDatabase.openDetails(\'' + esc(record.id) + '\')">' + t('\u0645\u0639\u0627\u064a\u0646\u0629', 'Preview') + '</button>' +
      recordConflictButtons(record) +
    '</div>';
  }

  function recordWorkflowButtons(record) {
    if (!record || record.sampleData) return '';
    var status = normalizeWorkflowStatus(record.verificationStatus);
    if (status === 'imported') {
      return '<button type="button" onclick="AppEquipmentDatabase.updateRecordStatus(\'' + esc(record.id) + '\',\'pending_review\')">' + t('\u0625\u0631\u0633\u0627\u0644 \u0644\u0644\u0645\u0631\u0627\u062c\u0639\u0629', 'Send to review') + '</button>';
    }
    if (status === 'pending_review') {
      return '<button type="button" onclick="AppEquipmentDatabase.updateRecordStatus(\'' + esc(record.id) + '\',\'verified\')">' + t('\u062a\u0648\u062b\u064a\u0642', 'Verify') + '</button>';
    }
    if (status === 'verified') {
      return '<button type="button" onclick="AppEquipmentDatabase.updateRecordStatus(\'' + esc(record.id) + '\',\'published\')">' + t('\u0646\u0634\u0631', 'Publish') + '</button>';
    }
    if (status !== 'archived') {
      return '<button type="button" onclick="AppEquipmentDatabase.updateRecordStatus(\'' + esc(record.id) + '\',\'archived\')">' + t('\u0623\u0631\u0634\u0641\u0629', 'Archive') + '</button>';
    }
    return '';
  }
  function renderTable(records) {
    if (!records.length) {
      return '<div class="equip-empty">' + t('لا توجد موديلات مطابقة. البيانات الموثقة لم تتم إضافتها بعد.', 'No matching models. Verified catalogue records have not been added yet.') + '</div>';
    }
    return '<div class="equip-table-wrap"><table class="equip-table"><thead><tr>' +
      '<th>' + t('الشركة', 'Manufacturer') + '</th>' +
      '<th>' + t('الموديل', 'Model') + '</th>' +
      '<th>' + t('النوع', 'Type') + '</th>' +
      '<th>BTU/h</th>' +
      '<th>CFM</th>' +
      '<th>ESP</th>' +
      '<th>' + t('الكهرباء', 'Electrical') + '</th>' +
      '<th>' + t('التحقق', 'Status') + '</th>' +
      '<th>' + t('إجراءات', 'Actions') + '</th>' +
      '</tr></thead><tbody>' +
      records.map(function (r) {
        return '<tr>' +
          '<td>' + (window.AirCalcManufacturerLogo?window.AirCalcManufacturerLogo(r.manufacturerName):'') + fmtText(r.manufacturerName) + '</td>' +
          '<td><strong>' + fmtText(r.exactModelNumber) + '</strong><span class="equip-muted">' + fmtText(r.series) + '</span></td>' +
          '<td>' + esc(typeLabel(r.equipmentType)) + '</td>' +
          '<td>' + fmtNum(r.coolingCapacityBtuH, '') + '</td>' +
          '<td>' + fmtNum(r.airflowNominalCfm, '') + '</td>' +
          '<td>' + fmtNum(r.availableEspPa, 'Pa') + '</td>' +
          '<td>' + fmtNum(r.voltage, 'V') + ' / ' + fmtNum(r.phase, 'Ph') + '</td>' +
          '<td><span class="equip-status ' + statusClass(r.verificationStatus) + '">' + esc(statusLabel(r.verificationStatus)) + '</span>' + (r.cloudConflict ? '<span class="equip-status warn">Cloud conflict</span>' : '') + '</td>' +
          '<td>' + recordActions(r) + '</td>' +
        '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function renderCards(records) {
    if (!records.length) return renderTable(records);
    return '<div class="equip-card-grid">' + records.map(function (r) {
      return '<div class="equip-model-card">' +
        '<div class="equip-model-head"><div>' + (window.AirCalcManufacturerLogo?window.AirCalcManufacturerLogo(r.manufacturerName):'') + '<strong>' + fmtText(r.exactModelNumber) + '</strong><span>' + fmtText(r.manufacturerName) + '</span></div><span class="equip-status ' + statusClass(r.verificationStatus) + '">' + esc(statusLabel(r.verificationStatus)) + '</span></div>' +
        (r.cloudConflict ? '<div class="equip-sample-banner equip-conflict-banner">Cloud conflict - review before replacing local record</div>' : '') +
        (r.cloudConflict ? renderConflictPreview(r) : '') +
        '<div class="equip-model-specs">' +
          '<div><span>BTU/h</span><strong>' + fmtNum(r.coolingCapacityBtuH, '') + '</strong></div>' +
          '<div><span>CFM</span><strong>' + fmtNum(r.airflowNominalCfm, '') + '</strong></div>' +
          '<div><span>ESP</span><strong>' + fmtNum(r.availableEspPa, 'Pa') + '</strong></div>' +
          '<div><span>' + t('النوع', 'Type') + '</span><strong>' + esc(typeLabel(r.equipmentType)) + '</strong></div>' +
        '</div>' +
        recordActions(r) +
        (r.sampleData ? '<div class="equip-sample-banner">SAMPLE DATA - NOT FOR ENGINEERING SELECTION</div>' : '') +
      '</div>';
    }).join('') + '</div>';
  }

  function renderCompare(records) {
    var host = G('equip-compare');
    if (!host) return;
    var chosen = selectedCompareIds.map(function (id) {
      return records.filter(function (r) { return r.id === id; })[0] || allRecords().filter(function (r) { return r.id === id; })[0];
    }).filter(Boolean).slice(0, 4);
    if (chosen.length < 2) {
      host.innerHTML = '<div class="equip-compare-empty">' + t('اختر 2 إلى 4 موديلات للمقارنة.', 'Select 2 to 4 models to compare.') + '</div>';
      return;
    }
    var fields = [
      ['coolingCapacityBtuH', 'BTU/h'],
      ['airflowNominalCfm', 'CFM'],
      ['availableEspPa', 'ESP Pa'],
      ['voltage', 'Voltage'],
      ['phase', 'Phase'],
      ['eer', 'EER'],
      ['seer', 'SEER'],
      ['verificationStatus', t('حالة التحقق', 'Verification')]
    ];
    host.innerHTML = '<div class="equip-compare-table"><table><thead><tr><th>' + t('البند', 'Item') + '</th>' +
      chosen.map(function (r) { return '<th>' + fmtText(r.manufacturerName) + '<br><strong>' + fmtText(r.exactModelNumber) + '</strong></th>'; }).join('') +
      '</tr></thead><tbody>' +
      fields.map(function (f) {
        return '<tr><td>' + esc(f[1]) + '</td>' + chosen.map(function (r) {
          return '<td>' + (f[0] === 'verificationStatus' ? esc(statusLabel(r[f[0]])) : fmtText(r[f[0]])) + '</td>';
        }).join('') + '</tr>';
      }).join('') +
      '</tbody></table></div>';
  }

  function renderRecords() {
    renderFilterOptions();
    var records = filteredRecords();
    renderStats(records);
    var host = G('equip-results');
    if (host) host.innerHTML = viewMode === 'cards' ? renderCards(records) : renderTable(records);
    renderReviewQueue(allRecords());
    renderConflictReview(allRecords());
    renderVersionComparison();
    renderCompare(records);
    renderRegistry();
    renderCatalogueSyncStatus();
    updateLabels();
  }

  function renderCatalogueSyncStatus() {
    var host = G('equip-catalogue-sync-status');
    if (!host) return;
    var status = getCatalogueSyncStatus();
    var state = status.state || 'local_only';
    var label = state === 'synced'
      ? t('\u0645\u062a\u0632\u0627\u0645\u0646', 'Synced')
      : (state === 'sync_failed' ? t('\u0641\u0634\u0644\u062a \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629', 'Sync failed') : t('\u0645\u062d\u0644\u064a \u0641\u0642\u0637', 'Local only'));
    var cls = state === 'synced' ? 'ok' : (state === 'sync_failed' ? 'danger' : 'warn');
    var details = [];
    if (status.importedRecords) details.push(t('\u0645\u0633\u062a\u0648\u0631\u062f: ', 'Imported: ') + status.importedRecords);
    if (status.conflicts) details.push(t('\u062a\u0639\u0627\u0631\u0636\u0627\u062a: ', 'Conflicts: ') + status.conflicts);
    host.innerHTML = '<span class="equip-status ' + cls + '">' + esc(label) + '</span>' +
      (details.length ? '<small>' + esc(details.join(' · ')) + '</small>' : '') +
      (status.updatedAt ? '<small>' + esc(String(status.updatedAt).slice(0, 19).replace('T', ' ')) + '</small>' : '');
  }

  function compareRecordKey(record) {
    return [
      record.manufacturerId,
      record.exactModelNumber,
      record.marketRegion
    ].map(function (value) { return String(value || '').trim().toLowerCase(); }).join('|');
  }

  function compareFieldValue(value) {
    return value == null ? '' : String(value);
  }

  function compareCatalogueVersions(versionA, versionB, records) {
    var fields = [
      'coolingCapacityBtuH',
      'airflowNominalCfm',
      'availableEspPa',
      'equipmentType',
      'verificationStatus'
    ];
    var a = {};
    var b = {};
    (records || allRecords()).forEach(function (record) {
      if (!record || record.sampleData) return;
      var versionId = record.catalogueVersionId || record.catalogueRevision || '';
      var key = compareRecordKey(record);
      if (!key.trim()) return;
      if (versionId === versionA) a[key] = record;
      if (versionId === versionB) b[key] = record;
    });
    var keys = {};
    Object.keys(a).forEach(function (key) { keys[key] = true; });
    Object.keys(b).forEach(function (key) { keys[key] = true; });
    var result = { added: [], removed: [], changed: [], unchanged: [] };
    Object.keys(keys).sort().forEach(function (key) {
      var left = a[key];
      var right = b[key];
      if (!left && right) {
        result.added.push({ key: key, record: right });
        return;
      }
      if (left && !right) {
        result.removed.push({ key: key, record: left });
        return;
      }
      var diffs = fields.filter(function (field) {
        return compareFieldValue(left[field]) !== compareFieldValue(right[field]);
      }).map(function (field) {
        return { field: field, from: left[field], to: right[field] };
      });
      if (diffs.length) result.changed.push({ key: key, from: left, to: right, diffs: diffs });
      else result.unchanged.push({ key: key, record: right });
    });
    return result;
  }

  function renderVersionComparison() {
    var host = G('equip-version-compare');
    if (!host) return;
    var records = allRecords();
    var options = versionOptions(records);
    if (options.length < 2) {
      host.innerHTML = '<div class="equip-review-empty">' + t('\u0623\u0636\u0641 \u0625\u0635\u062f\u0627\u0631\u064a\u0646 \u0645\u0646 \u0627\u0644\u0643\u062a\u0627\u0644\u0648\u062c \u0644\u062a\u0641\u0639\u064a\u0644 \u0627\u0644\u0645\u0642\u0627\u0631\u0646\u0629.', 'Add two catalogue versions to enable comparison.') + '</div>';
      return;
    }
    var aEl = G('equip-compare-version-a');
    var bEl = G('equip-compare-version-b');
    var aId = aEl && aEl.value ? aEl.value : options[0].id;
    var bId = bEl && bEl.value ? bEl.value : (options[1] || options[0]).id;
    if (aId === bId && options.length > 1) bId = options.filter(function (item) { return item.id !== aId; })[0].id;
    var comparison = compareCatalogueVersions(aId, bId, records);
    function selectHtml(id, selected) {
      return '<select id="' + id + '" onchange="AppEquipmentDatabase.renderVersionComparison()">' +
        options.map(function (version) {
          var count = Number(version.recordCount || 0);
          return '<option value="' + escAttr(version.id) + '"' + (version.id === selected ? ' selected' : '') + '>' + esc(versionDisplayLabel(version)) + ' (' + count + ')</option>';
        }).join('') +
      '</select>';
    }
    host.innerHTML =
      '<div class="equip-version-controls">' +
        '<label><span>' + t('\u0627\u0644\u0625\u0635\u062f\u0627\u0631 \u0627\u0644\u0623\u0648\u0644', 'Base version') + '</span>' + selectHtml('equip-compare-version-a', aId) + '</label>' +
        '<label><span>' + t('\u0627\u0644\u0625\u0635\u062f\u0627\u0631 \u0627\u0644\u062b\u0627\u0646\u064a', 'Compare version') + '</span>' + selectHtml('equip-compare-version-b', bId) + '</label>' +
      '</div>' +
      '<div class="equip-version-stats">' +
        statCard(t('\u0645\u0636\u0627\u0641', 'Added'), comparison.added.length) +
        statCard(t('\u0645\u062d\u0630\u0648\u0641', 'Removed'), comparison.removed.length) +
        statCard(t('\u0645\u062a\u063a\u064a\u0631', 'Changed'), comparison.changed.length) +
        statCard(t('\u0628\u0644\u0627 \u062a\u063a\u064a\u064a\u0631', 'Unchanged'), comparison.unchanged.length) +
      '</div>' +
      renderVersionChanges(comparison);
  }

  function renderVersionChanges(comparison) {
    var rows = comparison.changed.slice(0, 12);
    if (!rows.length && !comparison.added.length && !comparison.removed.length) {
      return '<div class="equip-import-ok">' + t('\u0644\u0627 \u062a\u0648\u062c\u062f \u0641\u0631\u0648\u0642 \u0641\u064a \u0627\u0644\u062d\u0642\u0648\u0644 \u0627\u0644\u0645\u0647\u0645\u0629.', 'No differences in tracked engineering fields.') + '</div>';
    }
    return '<div class="equip-version-diff">' +
      rows.map(function (row) {
        return '<div class="equip-version-diff-row">' +
          '<strong>' + fmtText(row.to.manufacturerName) + ' · ' + fmtText(row.to.exactModelNumber) + '</strong>' +
          '<span>' + row.diffs.map(function (diff) {
            return esc(diff.field) + ': ' + fmtText(diff.from) + ' -> ' + fmtText(diff.to);
          }).join(' | ') + '</span>' +
        '</div>';
      }).join('') +
      (comparison.added.length ? '<div class="equip-version-diff-row ok"><strong>' + t('\u0645\u0648\u062f\u064a\u0644\u0627\u062a \u0645\u0636\u0627\u0641\u0629', 'Added models') + '</strong><span>' + comparison.added.slice(0, 8).map(function (row) { return fmtText(row.record.exactModelNumber); }).join(' | ') + '</span></div>' : '') +
      (comparison.removed.length ? '<div class="equip-version-diff-row danger"><strong>' + t('\u0645\u0648\u062f\u064a\u0644\u0627\u062a \u0645\u062d\u0630\u0648\u0641\u0629', 'Removed models') + '</strong><span>' + comparison.removed.slice(0, 8).map(function (row) { return fmtText(row.record.exactModelNumber); }).join(' | ') + '</span></div>' : '') +
    '</div>';
  }

  function reviewQueueRecords(records) {
    return (records || []).filter(function (record) {
      if (!record || record.sampleData) return false;
      var status = normalizeWorkflowStatus(record.verificationStatus);
      return status === 'imported' || status === 'pending_review' || status === 'verified' || status === 'published';
    });
  }

  function nextWorkflowAction(record) {
    var status = normalizeWorkflowStatus(record && record.verificationStatus);
    if (status === 'imported') return { status: 'pending_review', labelAr: '\u0625\u0631\u0633\u0627\u0644 \u0644\u0644\u0645\u0631\u0627\u062c\u0639\u0629', labelEn: 'Send to review' };
    if (status === 'pending_review') return { status: 'verified', labelAr: '\u062a\u0648\u062b\u064a\u0642', labelEn: 'Verify' };
    if (status === 'verified') return { status: 'published', labelAr: '\u0646\u0634\u0631', labelEn: 'Publish' };
    if (status === 'published') return { status: 'archived', labelAr: '\u0623\u0631\u0634\u0641\u0629', labelEn: 'Archive' };
    return null;
  }

  function recordQuality(record) {
    var C = window.AirCalcEquipmentCatalogue;
    return C && typeof C.evaluateRecordQuality === 'function'
      ? C.evaluateRecordQuality(record)
      : { ok: true, findings: [] };
  }

  function renderReviewQueue(records) {
    var host = G('equip-review-queue');
    if (!host) return;
    var queue = reviewQueueRecords(records);
    var imported = queue.filter(function (r) { return normalizeWorkflowStatus(r.verificationStatus) === 'imported'; }).length;
    var pending = queue.filter(function (r) { return normalizeWorkflowStatus(r.verificationStatus) === 'pending_review'; }).length;
    var verified = queue.filter(function (r) { return normalizeWorkflowStatus(r.verificationStatus) === 'verified'; }).length;
    var published = queue.filter(function (r) { return normalizeWorkflowStatus(r.verificationStatus) === 'published'; }).length;
    if (!queue.length) {
      host.innerHTML = '<div class="equip-review-empty">' + t('\u0644\u0627 \u062a\u0648\u062c\u062f \u0633\u062c\u0644\u0627\u062a \u062a\u062d\u062a\u0627\u062c \u0645\u0631\u0627\u062c\u0639\u0629 \u062d\u0627\u0644\u064a\u064b\u0627.', 'No records currently need catalogue review.') + '</div>';
      return;
    }
    host.innerHTML =
      '<div class="equip-review-stats">' +
        statCard(t('\u0645\u0633\u062a\u0648\u0631\u062f', 'Imported'), imported) +
        statCard(t('\u0642\u064a\u062f \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629', 'Pending review'), pending) +
        statCard(t('\u0645\u0648\u062b\u0642', 'Verified'), verified) +
        statCard(t('\u0645\u0646\u0634\u0648\u0631', 'Published'), published) +
      '</div>' +
      '<div class="equip-review-toolbar">' +
        '<button type="button" onclick="AppEquipmentDatabase.advanceReviewBatch(\'imported\')">' + t('\u0625\u0631\u0633\u0627\u0644 \u0643\u0644 \u0627\u0644\u0645\u0633\u062a\u0648\u0631\u062f \u0644\u0644\u0645\u0631\u0627\u062c\u0639\u0629', 'Send all imported to review') + '</button>' +
        '<button type="button" onclick="AppEquipmentDatabase.advanceReviewBatch(\'pending_review\')">' + t('\u062a\u0648\u062b\u064a\u0642 \u0643\u0644 \u0642\u064a\u062f \u0627\u0644\u0645\u0631\u0627\u062c\u0639\u0629', 'Verify all pending') + '</button>' +
      '</div>' +
      '<div class="equip-review-list">' +
        queue.slice(0, 10).map(renderReviewRow).join('') +
        (queue.length > 10 ? '<div class="equip-review-more">' + t('\u062a\u0648\u062c\u062f \u0633\u062c\u0644\u0627\u062a \u0625\u0636\u0627\u0641\u064a\u0629 \u0641\u064a \u0627\u0644\u062c\u062f\u0648\u0644.', 'Additional records are available in the table.') + '</div>' : '') +
      '</div>';
  }

  function renderReviewRow(record) {
    var action = nextWorkflowAction(record);
    var status = normalizeWorkflowStatus(record.verificationStatus);
    var quality = recordQuality(record);
    var blockers = (quality.findings || []).filter(function (finding) { return finding.severity === 'blocker'; });
    return '<div class="equip-review-row">' +
      '<div><strong>' + fmtText(record.manufacturerName) + ' · ' + fmtText(record.exactModelNumber) + '</strong><span>' + fmtText(record.sourceDocumentName || record.catalogueVersionLabel || record.catalogueRevision) + '</span></div>' +
      '<span class="equip-status ' + statusClass(status) + '">' + esc(statusLabel(status)) + '</span>' +
      (blockers.length ? '<span class="equip-status danger">' + t('\u0646\u0642\u0635 \u0628\u064a\u0627\u0646\u0627\u062a', 'Data gaps') + '</span>' : '<span class="equip-status ok">' + t('\u062c\u0627\u0647\u0632', 'Ready') + '</span>') +
      '<input class="equip-review-note" type="text" value="' + escAttr(record.reviewerNote || '') + '" placeholder="' + escAttr(t('\u0645\u0644\u0627\u062d\u0638\u0629 \u0627\u0644\u0645\u0631\u0627\u062c\u0639', 'Reviewer note')) + '" onchange="AppEquipmentDatabase.updateRecordReviewNote(\'' + escAttr(record.id) + '\', this.value)">' +
      (action ? '<button type="button" onclick="AppEquipmentDatabase.updateRecordStatus(\'' + esc(record.id) + '\',\'' + esc(action.status) + '\')">' + esc(isAr() ? action.labelAr : action.labelEn) + '</button>' : '') +
      (blockers.length ? '<small class="equip-review-quality">' + esc(blockers.map(function (finding) { return finding.field; }).join(' | ')) + '</small>' : '') +
    '</div>';
  }

  function advanceReviewBatch(currentStatus) {
    var queue = reviewQueueRecords(allRecords()).filter(function (record) {
      return normalizeWorkflowStatus(record.verificationStatus) === normalizeWorkflowStatus(currentStatus);
    });
    var changed = 0;
    queue.forEach(function (record) {
      var action = nextWorkflowAction(record);
      if (!action) return;
      var result = updateRecordStatus(record.id, action.status, { silent: true });
      if (result && result.ok) changed += 1;
    });
    renderRecords();
    if (window.toast) window.toast(t('\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u0633\u062c\u0644\u0627\u062a: ', 'Updated records: ') + changed);
    return { ok: true, updated: changed };
  }

  function renderImportSummary(summary) {
    var host = G('equip-import-summary');
    if (!host) return;
    if (!summary) {
      host.innerHTML = '<div class="equip-import-empty">' + t('ارفع ملف CSV لمعاينة السجلات قبل الاستيراد.', 'Upload a CSV file to preview records before import.') + '</div>';
      return;
    }
    var invalidRows = (summary.results || []).filter(function (r) { return !r.ok; });
    var catalogueWarnings = summary.catalogueWarnings || [];
    var context = summary.importContext || null;
    var sourceBlock = (context || catalogueWarnings.length) ? '<div class="equip-import-source-card ' + (catalogueWarnings.length ? 'warn' : 'ok') + '">' +
      '<strong>' + t('بيانات اعتماد الكتالوج', 'Catalogue provenance') + '</strong>' +
      (context ? '<span>' + esc((context.catalogue && context.catalogue.manufacturerName) || '') + ' · ' + esc((context.version && context.version.versionLabel) || '') + ' · ' + esc((context.version && context.version.sourceDocumentName) || '') + '</span>' : '') +
      (context && context.version && context.version.sourceHash ? '<code>SHA-256: ' + esc(context.version.sourceHash.slice(0, 16)) + '...</code>' : '') +
      (catalogueWarnings.length ? '<ul>' + catalogueWarnings.map(function (warning) { return '<li>' + esc(warning) + '</li>'; }).join('') + '</ul>' : '<span>' + t('سيتم ربط السجلات بإصدار كتالوج قابل للتدقيق قبل المراجعة.', 'Rows will be linked to an auditable catalogue version before review.') + '</span>') +
    '</div>' : '';
    host.innerHTML =
      '<div class="equip-import-stats">' +
        statCard(t('إجمالي الصفوف', 'Total rows'), summary.totalRows) +
        statCard(t('صالحة للاستيراد', 'Valid rows'), summary.validRows) +
        statCard(t('أخطاء', 'Errors'), summary.invalidRows) +
        statCard(t('تكرارات', 'Duplicates'), summary.duplicateRows) +
      '</div>' + sourceBlock +
      (invalidRows.length ? '<div class="equip-import-errors">' +
        invalidRows.slice(0, 12).map(function (row) {
          return '<div><strong>Line ' + row.lineNumber + '</strong><span>' + esc((row.errors || []).join(' | ')) + '</span></div>';
        }).join('') +
        (invalidRows.length > 12 ? '<div><strong>...</strong><span>' + t('توجد أخطاء إضافية', 'Additional errors exist') + '</span></div>' : '') +
      '</div><div class="equip-import-tools"><button type="button" onclick="AppEquipmentDatabase.downloadRejectedRows()">' + t('\u062a\u0635\u062f\u064a\u0631 \u0627\u0644\u0635\u0641\u0648\u0641 \u0627\u0644\u0645\u0631\u0641\u0648\u0636\u0629 CSV', 'Export rejected rows CSV') + '</button></div>' : '<div class="equip-import-ok">' + t('كل الصفوف المعروضة صالحة. سيتم حفظها كمسودة draft.', 'All previewed rows are valid. They will be saved as draft records.') + '</div>') +
      '<div class="equip-import-preview">' + renderImportPreview((summary.results || []).slice(0, 8)) + '</div>';
  }

  function renderImportPreview(rows) {
    if (!rows.length) return '';
    return '<table><thead><tr><th>Line</th><th>Manufacturer</th><th>Model</th><th>BTU/h</th><th>CFM</th><th>Status</th></tr></thead><tbody>' +
      rows.map(function (row) {
        var r = row.record || {};
        return '<tr>' +
          '<td>' + row.lineNumber + '</td>' +
          '<td>' + fmtText(r.manufacturerName) + '</td>' +
          '<td>' + fmtText(r.exactModelNumber) + '</td>' +
          '<td>' + fmtNum(r.coolingCapacityBtuH, '') + '</td>' +
          '<td>' + fmtNum(r.airflowNominalCfm, '') + '</td>' +
          '<td><span class="equip-status ' + (row.ok ? 'ok' : 'danger') + '">' + (row.ok ? 'draft' : 'error') + '</span></td>' +
        '</tr>';
      }).join('') +
      '</tbody></table>';
  }

  function handleImportFile(file) {
    var importer = window.AirCalcEquipmentImport;
    if (!importer || !file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var parsed = importer.parseCsv(reader.result || '');
      if (!parsed.ok) {
        importSummary = { totalRows: 0, validRows: 0, invalidRows: 1, duplicateRows: 0, results: [{ lineNumber: 0, ok: false, errors: parsed.errors || [] }], validRecords: [] };
      } else {
        var contextInfo = currentImportContextInfo();
        importSummary = importer.validateRows(parsed.rows, importer.readExistingRecords(), contextInfo.context);
        importSummary.catalogueWarnings = contextInfo.warnings || [];
      }
      renderImportSummary(importSummary);
    };
    reader.readAsText(file);
  }

  function importValidRows() {
    var importer = window.AirCalcEquipmentImport;
    if (!importer || !importSummary) return;
    if ((importSummary.catalogueWarnings || []).length) {
      if (window.toast) window.toast(t('أكمل بيانات مصدر الكتالوج قبل الاستيراد.', 'Complete catalogue source metadata before importing.'));
      renderImportSummary(importSummary);
      return { ok: false, reason: 'catalogue_metadata_incomplete' };
    }
    var result = importer.importValidRecords(importSummary);
    importSummary = null;
    renderImportSummary(null);
    renderRecords();
    scheduleCatalogueCloudSync();
    if (window.toast) window.toast(t('تم استيراد السجلات الصحيحة كمسودة: ', 'Imported valid draft records: ') + result.imported);
  }

  function downloadTemplate() {
    var importer = window.AirCalcEquipmentImport;
    var csv = importer ? importer.buildTemplateCsv() : '';
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'EQUIPMENT_IMPORT_TEMPLATE.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadRejectedRows() {
    if (!importSummary) return { ok: false, reason: 'no import summary' };
    var rejected = (importSummary.results || []).filter(function (row) { return !row.ok; });
    if (!rejected.length) return { ok: false, reason: 'no rejected rows' };
    var csv = buildRejectedRowsCsv(importSummary);
    var blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'AIR_CALC_REJECTED_EQUIPMENT_ROWS.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return { ok: true, rows: rejected.length };
  }

  function toggleCompare(id, checked) {
    if (checked && selectedCompareIds.indexOf(id) < 0) {
      if (selectedCompareIds.length >= 4) {
        if (window.toast) window.toast(t('يمكن مقارنة 4 موديلات كحد أقصى', 'You can compare up to 4 models'));
        renderRecords();
        return;
      }
      selectedCompareIds.push(id);
    } else if (!checked) {
      selectedCompareIds = selectedCompareIds.filter(function (item) { return item !== id; });
    }
    renderRecords();
  }

  function openDetails(id) {
    var record = allRecords().filter(function (r) { return r.id === id; })[0];
    var modal = G('equip-detail-modal');
    var body = G('equip-detail-body');
    if (!record || !modal || !body) return;
    var fields = (schema() && schema().EQUIPMENT_FIELDS) || Object.keys(record);
    body.innerHTML =
      '<div class="equip-detail-head">' +
        '<div><strong>' + fmtText(record.exactModelNumber) + '</strong><span>' + fmtText(record.manufacturerName) + ' · ' + esc(typeLabel(record.equipmentType)) + '</span></div>' +
        '<span class="equip-status ' + statusClass(record.verificationStatus) + '">' + esc(statusLabel(record.verificationStatus)) + '</span>' +
      '</div>' +
      (record.sampleData ? '<div class="equip-sample-banner">SAMPLE DATA - NOT FOR ENGINEERING SELECTION</div>' : '') +
      renderConflictPreview(record) +
      '<div class="equip-detail-grid">' + fields.map(function (field) {
        return '<div class="equip-detail-row"><span>' + esc(field) + '</span><strong>' + fmtText(record[field]) + '</strong></div>';
      }).join('') + '</div>';
    modal.classList.add('on');
  }

  function closeDetails() {
    var modal = G('equip-detail-modal');
    if (modal) modal.classList.remove('on');
  }

  function updateRecordReviewNote(id, note) {
    var records = readStoredRecords();
    var found = false;
    var S = schema();
    var now = new Date().toISOString();
    var nextRecords = records.map(function (record) {
      var normalized = S ? S.normalizeEquipmentRecord(record) : record;
      if (normalized.id !== id) return record;
      found = true;
      return Object.assign({}, normalized, {
        reviewerNote: String(note || '').trim(),
        reviewerNoteUpdatedAt: now,
        updatedAt: now
      });
    });
    if (!found) return { ok: false, reason: 'record not found' };
    writeStoredRecords(nextRecords);
    renderRecords();
    scheduleCatalogueCloudSync();
    return { ok: true };
  }

  function updateRecordStatus(id, nextStatus, options) {
    options = options || {};
    var records = readStoredRecords();
    var found = false;
    var result = null;
    var C = window.AirCalcEquipmentCatalogue;
    var S = schema();
    var nextRecords = records.map(function (record) {
      var normalized = S ? S.normalizeEquipmentRecord(record) : record;
      if (normalized.id !== id) return record;
      found = true;
      if (normalized.sampleData) {
        result = { ok: false, reason: 'Sample data cannot enter the verification workflow.' };
        return record;
      }
      result = C && typeof C.transitionRecord === 'function'
        ? C.transitionRecord(normalized, nextStatus, { by: 'local_user' })
        : { ok: true, record: Object.assign({}, normalized, { verificationStatus: nextStatus, updatedAt: new Date().toISOString() }) };
      return result.ok ? result.record : record;
    });
    if (!found) {
      if (!options.silent && window.toast) window.toast(t('\u0644\u0645 \u064a\u062a\u0645 \u0627\u0644\u0639\u062b\u0648\u0631 \u0639\u0644\u0649 \u0627\u0644\u0633\u062c\u0644', 'Record was not found'));
      return { ok: false, reason: 'record not found' };
    }
    if (!result || !result.ok) {
      if (!options.silent && window.toast) {
        var findingText = result && result.findings && result.findings.length
          ? ': ' + result.findings.map(function (finding) { return finding.field; }).join(', ')
          : '';
        window.toast(t('\u0644\u0627 \u064a\u0645\u0643\u0646 \u062a\u063a\u064a\u064a\u0631 \u062d\u0627\u0644\u0629 \u0647\u0630\u0627 \u0627\u0644\u0633\u062c\u0644', 'This record status cannot be changed') + findingText);
      }
      return result || { ok: false };
    }
    writeStoredRecords(nextRecords);
    if (!options.silent) renderRecords();
    scheduleCatalogueCloudSync();
    if (!options.silent && window.toast) window.toast(t('\u062a\u0645 \u062a\u062d\u062f\u064a\u062b \u062d\u0627\u0644\u0629 \u0627\u0644\u0633\u062c\u0644', 'Record status updated'));
    return result;
  }

  function resolveCloudConflict(id, action, options) {
    options = options || {};
    action = action === 'use_cloud' ? 'use_cloud' : 'keep_local';
    var records = readStoredRecords();
    var S = schema();
    var now = new Date().toISOString();
    var found = false;
    var resolved = null;
    var nextRecords = records.map(function (record) {
      var normalized = S ? S.normalizeEquipmentRecord(record) : record;
      if (normalized.id !== id) return record;
      found = true;
      if (!normalized.cloudConflict || !normalized.cloudConflictRecord) {
        resolved = { ok: false, reason: 'no_conflict' };
        return record;
      }
      var history = Array.isArray(normalized.workflowHistory) ? normalized.workflowHistory.slice() : [];
      history.push({
        from: 'cloud_conflict',
        to: action,
        at: now,
        by: 'local_user',
        note: action === 'use_cloud' ? 'Resolved catalogue conflict using cloud record.' : 'Resolved catalogue conflict keeping local record.'
      });
      var base = action === 'use_cloud'
        ? Object.assign({}, normalized.cloudConflictRecord, {
            id: normalized.id,
            workflowHistory: history,
            updatedAt: now
          })
        : Object.assign({}, normalized, {
            workflowHistory: history,
            updatedAt: now
          });
      delete base.cloudConflict;
      delete base.cloudConflictAt;
      delete base.cloudConflictRecord;
      resolved = { ok: true, action: action, record: base };
      return base;
    });
    if (!found) return { ok: false, reason: 'record_not_found' };
    if (!resolved || !resolved.ok) return resolved || { ok: false };
    writeStoredRecords(nextRecords);
    if (!options.silent) renderRecords();
    if (!options.silent) scheduleCatalogueCloudSync();
    if (!options.silent && window.toast) window.toast(action === 'use_cloud'
      ? t('\u062a\u0645 \u0627\u0639\u062a\u0645\u0627\u062f \u0646\u0633\u062e\u0629 \u0627\u0644\u0633\u062d\u0627\u0628\u0629', 'Cloud record applied')
      : t('\u062a\u0645 \u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u0646\u0633\u062e\u0629 \u0627\u0644\u0645\u062d\u0644\u064a\u0629', 'Local record kept'));
    return resolved;
  }

  function resolveConflictBatchKeepLocal() {
    var conflicts = conflictRecords(allRecords());
    var updated = 0;
    conflicts.forEach(function (record) {
      var result = resolveCloudConflict(record.id, 'keep_local', { silent: true });
      if (result && result.ok) updated += 1;
    });
    renderRecords();
    scheduleCatalogueCloudSync();
    if (window.toast) window.toast(t('\u062a\u0645 \u0627\u0639\u062a\u0645\u0627\u062f \u0627\u0644\u0645\u062d\u0644\u064a \u0644\u0633\u062c\u0644\u0627\u062a: ', 'Kept local records: ') + updated);
    return { ok: true, updated: updated };
  }

  function selectForProject(id, selectionOption) {
    var record = allRecords().filter(function (r) { return r.id === id; })[0];
    if (!record) return;
    if (record.sampleData) {
      if (window.toast) window.toast(t('لا يمكن اختيار Sample Data للمشروع', 'Sample data cannot be selected for a project'));
      return;
    }
    try {
      var catalogueRef = window.AirCalcEquipmentCatalogue && typeof window.AirCalcEquipmentCatalogue.snapshotVersionRef === 'function'
        ? window.AirCalcEquipmentCatalogue.snapshotVersionRef(record)
        : null;
      localStorage.setItem('aircalc_last_selected_equipment_snapshot', JSON.stringify({
        selectedAt: new Date().toISOString(),
        source: 'equipment_database_mvp',
        record: record,
        catalogueVersion: catalogueRef,
        selectionOption: selectionOption || null
      }));
    } catch (e) {}
    if (typeof window.setQuoteMode === 'function') window.setQuoteMode('proj');
    if (typeof window.setProjWorkflowType === 'function') window.setProjWorkflowType(record.equipmentType || 'package');
    if (typeof window.setProjWorkflowCapacity === 'function' && record.coolingCapacityBtuH) {
      window.setProjWorkflowCapacity(record.coolingCapacityBtuH);
    }
    if (selectionOption && selectionOption.quantity && typeof window.setProjQtyManual === 'function') {
      window.setProjQtyManual(selectionOption.quantity);
    }
    if (window.toast) {
      window.toast(t('تم تطبيق الوحدة على إعدادات المشروع وحفظ snapshot مبدئي', 'Unit applied to project settings and preliminary snapshot saved'));
    }
  }

  function setView(mode) {
    viewMode = mode === 'cards' ? 'cards' : 'table';
    var tableBtn = G('equip-view-table');
    var cardBtn = G('equip-view-cards');
    if (tableBtn) tableBtn.classList.toggle('on', viewMode === 'table');
    if (cardBtn) cardBtn.classList.toggle('on', viewMode === 'cards');
    renderRecords();
  }

  function toggleSampleData() {
    var next = !showSampleData();
    try { localStorage.setItem(DEV_SAMPLE_KEY, next ? '1' : '0'); } catch (e) {}
    renderRecords();
  }

  function updateLabels() {
    var labels = {
      'desktop-nav-equipment': [ 'قاعدة الوحدات', 'Equipment DB' ],
      'nl-equipment': [ 'الوحدات', 'Equipment' ],
      'equip-title': [ 'قاعدة بيانات الوحدات', 'Equipment Database' ],
      'equip-subtitle': [ 'سجل منظم لموديلات التكييف. البيانات التجريبية لا تدخل الاختيار الهندسي.', 'Structured HVAC unit catalogue. Sample data is excluded from engineering selection.' ],
      'equip-search-label': [ 'بحث', 'Search' ],
      'equip-manufacturer-label': [ 'الشركة', 'Manufacturer' ],
      'equip-type-label': [ 'نوع الوحدة', 'Equipment type' ],
      'equip-capacity-label': [ 'أقل سعة BTU/h', 'Min capacity BTU/h' ],
      'equip-cfm-label': [ 'أقل CFM', 'Min CFM' ],
      'equip-esp-label': [ 'أقل ESP Pa', 'Min ESP Pa' ],
      'equip-electrical-label': [ 'الكهرباء', 'Electrical' ],
      'equip-status-label': [ 'حالة التحقق', 'Verification' ],
      'equip-registry-title': [ 'Manufacturer Registry', 'Manufacturer Registry' ],
      'equip-review-title': [ 'مراجعة الكتالوج', 'Catalogue Review Queue' ],
      'equip-conflict-review-title': [ 'مراجعة تعارضات الكتالوج', 'Catalogue Conflict Review' ],
      'equip-version-compare-title': [ 'مقارنة إصدارات الكتالوج', 'Catalogue Version Comparison' ],
      'equip-results-title': [ 'موديلات الوحدات', 'Equipment Models' ],
      'equip-compare-title': [ 'المقارنة', 'Comparison' ],
      'equip-import-meta-title': [ 'توثيق مصدر الكتالوج', 'Catalogue provenance' ],
      'equip-import-manufacturer-id-label': [ 'معرف الشركة', 'Manufacturer ID' ],
      'equip-import-manufacturer-name-label': [ 'اسم الشركة', 'Manufacturer name' ],
      'equip-import-catalogue-year-label': [ 'سنة الكتالوج', 'Catalogue year' ],
      'equip-import-catalogue-revision-label': [ 'إصدار الكتالوج', 'Catalogue revision' ],
      'equip-import-source-document-label': [ 'مستند المصدر', 'Source document' ],
      'equip-import-source-reference-label': [ 'مرجع المصدر', 'Source reference' ],
      'equip-import-source-url-label': [ 'رابط المصدر', 'Source URL' ],
      'equip-import-source-file-label': [ 'ملف المصدر', 'Source file' ]
    };
    Object.keys(labels).forEach(function (id) {
      var el = G(id);
      if (el) el.textContent = isAr() ? labels[id][0] : labels[id][1];
    });
    var search = G('equip-search');
    if (search) search.placeholder = t('ابحث باسم الشركة أو رقم الموديل', 'Search by manufacturer or model number');
    var sampleBtn = G('equip-sample-toggle');
    if (sampleBtn) {
      sampleBtn.textContent = showSampleData() ? t('إخفاء Sample Data', 'Hide Sample Data') : t('إظهار Sample Data للاختبار', 'Show Sample Data for testing');
      sampleBtn.classList.toggle('on', showSampleData());
    }
    var importBtn = G('equip-import-btn');
    if (importBtn) importBtn.textContent = t('استيراد السجلات الصحيحة كمسودة', 'Import valid rows as draft');
    var templateBtn = G('equip-template-btn');
    if (templateBtn) templateBtn.textContent = t('تحميل نموذج CSV', 'Download CSV template');
    var importTitle = G('equip-import-title');
    if (importTitle) importTitle.textContent = t('استيراد CSV', 'CSV Import');
    var importSub = G('equip-import-subtitle');
    if (importSub) importSub.textContent = t('المعاينة والتحقق وكشف التكرار تتم قبل الحفظ. لا يتم اعتماد أي موديل تلقائيًا.', 'Preview, validation, and duplicate detection run before saving. No model is verified automatically.');
    var importMetaSub = G('equip-import-meta-subtitle');
    if (importMetaSub) importMetaSub.textContent = t('استخدم هذه الحقول عند استيراد كتالوج شركة حقيقي حتى يمكن تتبع كل موديل قبل المراجعة الهندسية.', 'Use these fields for real manufacturer catalogues so every model can be traced before engineering review.');
    var cloudSyncBtn = G('equip-cloud-sync-btn');
    if (cloudSyncBtn) cloudSyncBtn.textContent = t('\u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u0643\u062a\u0627\u0644\u0648\u062c', 'Sync Catalogue');
    var cloudImportBtn = G('equip-cloud-import-btn');
    if (cloudImportBtn) cloudImportBtn.textContent = t('\u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0645\u0646 \u0627\u0644\u0633\u062d\u0627\u0628\u0629', 'Import from Cloud');
  }

  function bind() {
    ['equip-search','equip-filter-manufacturer','equip-filter-type','equip-filter-capacity-min','equip-filter-cfm-min','equip-filter-esp-min','equip-filter-electrical','equip-filter-status'].forEach(function (id) {
      var el = G(id);
      if (el && !el.dataset.equipBound) {
        el.addEventListener('input', renderRecords);
        el.addEventListener('change', renderRecords);
        el.dataset.equipBound = '1';
      }
    });
    var file = G('equip-import-file');
    if (file && !file.dataset.equipBound) {
      file.addEventListener('change', function () {
        handleImportFile(file.files && file.files[0]);
      });
      file.dataset.equipBound = '1';
    }
    var sourceFile = G('equip-import-source-file');
    if (sourceFile && !sourceFile.dataset.equipBound) {
      sourceFile.addEventListener('change', function () {
        handleSourceFile(sourceFile.files && sourceFile.files[0]);
      });
      sourceFile.dataset.equipBound = '1';
    }
  }

  function init() {
    bind();
    renderRecords();
    renderImportSummary(null);
    setTimeout(function () {
      if (typeof window.goPanel === 'function' && !window.goPanel._equipmentPatched) {
        var original = window.goPanel;
        window.goPanel = function (name) {
          original(name);
          if (name === 'equipment') renderRecords();
        };
        window.goPanel._equipmentPatched = true;
      }
      if (typeof window.applyLang === 'function' && !window.applyLang._equipmentPatched) {
        var originalApplyLang = window.applyLang;
        window.applyLang = function () {
          var result = originalApplyLang.apply(this, arguments);
          updateLabels();
          return result;
        };
        window.applyLang._equipmentPatched = true;
      }
    }, 0);
  }

  window.AppEquipmentDatabase = {
    render: renderRecords,
    setView: setView,
    toggleSampleData: toggleSampleData,
    toggleCompare: toggleCompare,
    openDetails: openDetails,
    closeDetails: closeDetails,
    updateRecordStatus: updateRecordStatus,
    updateRecordReviewNote: updateRecordReviewNote,
    resolveCloudConflict: resolveCloudConflict,
    resolveConflictBatchKeepLocal: resolveConflictBatchKeepLocal,
    setConflictFilter: setConflictFilter,
    advanceReviewBatch: advanceReviewBatch,
    selectForProject: selectForProject,
    handleSourceFile: handleSourceFile,
    handleImportFile: handleImportFile,
    importValidRows: importValidRows,
    currentImportContextInfo: currentImportContextInfo,
    downloadTemplate: downloadTemplate,
    downloadRejectedRows: downloadRejectedRows,
    buildRejectedRowsCsv: buildRejectedRowsCsv,
    compareCatalogueVersions: compareCatalogueVersions,
    renderVersionComparison: renderVersionComparison,
    syncCatalogueToCloud: syncCatalogueToCloud,
    importCloudCatalogue: importCloudCatalogue,
    mergeCloudEquipmentRecords: mergeCloudEquipmentRecords,
    allRecords: allRecords,
    filteredRecords: filteredRecords,
    manufacturers: enrichManufacturerCounts
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
