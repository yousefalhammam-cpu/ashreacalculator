(function (root, factory) {
  'use strict';
  var catalogue = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = catalogue;
  root.AirCalcEquipmentCatalogue = catalogue;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
  'use strict';

  var CATALOGUE_STORAGE_KEY = 'aircalc_equipment_catalogues';
  var VERSION_STORAGE_KEY = 'aircalc_equipment_catalogue_versions';

  var CATALOGUE_STATUSES = ['imported', 'pending_review', 'verified', 'published', 'archived'];
  var RECORD_STATUS_ALIASES = {
    draft: 'imported',
    pending: 'pending_review',
    sample: 'sample'
  };
  var RECORD_TRANSITIONS = {
    imported: ['pending_review', 'archived'],
    pending_review: ['verified', 'archived'],
    verified: ['published', 'archived'],
    published: ['archived'],
    archived: []
  };

  function text(value) {
    return value == null ? '' : String(value).trim();
  }

  function numberOrNull(value) {
    if (value === '' || value == null) return null;
    var n = Number(value);
    return isFinite(n) ? n : null;
  }

  function slug(parts) {
    return (parts || [])
      .map(function (part) { return text(part).toLowerCase(); })
      .filter(Boolean)
      .join('-')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function clone(value) {
    if (value == null) return value;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_err) {
      return value;
    }
  }

  function readJson(key) {
    try {
      var parsed = JSON.parse(root.localStorage.getItem(key) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (_err) {
      return [];
    }
  }

  function writeJson(key, list) {
    root.localStorage.setItem(key, JSON.stringify(Array.isArray(list) ? list : []));
  }

  function buildCatalogueId(input) {
    input = input || {};
    return slug([
      input.manufacturerId,
      input.catalogueYear || input.year,
      input.catalogueRevision || input.revision || input.edition || input.title || 'catalogue'
    ]) || 'catalogue';
  }

  function buildVersionId(input) {
    input = input || {};
    return slug([
      input.catalogueId || buildCatalogueId(input),
      input.version || input.versionLabel || input.catalogueRevision || 'v1'
    ]) || 'catalogue-version';
  }

  function normalizeStatus(status) {
    var value = text(status || 'imported').toLowerCase();
    return CATALOGUE_STATUSES.indexOf(value) >= 0 ? value : 'imported';
  }

  function normalizeRecordStatus(status) {
    var value = text(status || 'imported').toLowerCase();
    return RECORD_STATUS_ALIASES[value] || value;
  }

  function normalizeCatalogue(input) {
    input = input || {};
    var catalogue = {
      id: text(input.id) || buildCatalogueId(input),
      manufacturerId: text(input.manufacturerId),
      manufacturerName: text(input.manufacturerName),
      title: text(input.title || input.sourceDocumentName || input.catalogueRevision || 'Equipment Catalogue'),
      year: numberOrNull(input.year || input.catalogueYear),
      edition: text(input.edition || input.catalogueRevision),
      sourceType: text(input.sourceType || 'manual'),
      sourceUrl: text(input.sourceUrl || input.sourceReference),
      sourceFileName: text(input.sourceFileName || input.sourceDocumentName),
      status: normalizeStatus(input.status),
      createdAt: text(input.createdAt),
      updatedAt: text(input.updatedAt)
    };
    catalogue.versionCount = numberOrNull(input.versionCount) || 0;
    return catalogue;
  }

  function normalizeCatalogueVersion(input) {
    input = input || {};
    var catalogueId = text(input.catalogueId) || buildCatalogueId(input);
    return {
      id: text(input.id) || buildVersionId(Object.assign({}, input, { catalogueId: catalogueId })),
      catalogueId: catalogueId,
      manufacturerId: text(input.manufacturerId),
      year: numberOrNull(input.year || input.catalogueYear),
      versionLabel: text(input.versionLabel || input.catalogueRevision || input.revision || input.version || 'v1'),
      sourceHash: text(input.sourceHash),
      sourceType: text(input.sourceType || 'manual'),
      sourceDocumentName: text(input.sourceDocumentName || input.sourceFileName),
      sourceReference: text(input.sourceReference || input.sourceUrl),
      status: normalizeStatus(input.status),
      importedAt: text(input.importedAt || input.createdAt),
      importedBy: text(input.importedBy),
      reviewedAt: text(input.reviewedAt),
      reviewedBy: text(input.reviewedBy),
      changeSummary: text(input.changeSummary || 'Initial catalogue version.'),
      recordCount: numberOrNull(input.recordCount) || 0
    };
  }

  function createImportContext(input) {
    input = input || {};
    var now = new Date().toISOString();
    var catalogue = normalizeCatalogue(Object.assign({
      sourceType: 'csv_import',
      status: 'imported',
      createdAt: now,
      updatedAt: now
    }, input));
    var version = normalizeCatalogueVersion(Object.assign({
      catalogueId: catalogue.id,
      manufacturerId: catalogue.manufacturerId,
      catalogueYear: catalogue.year,
      catalogueRevision: catalogue.edition,
      sourceType: catalogue.sourceType,
      sourceDocumentName: catalogue.sourceFileName,
      sourceReference: catalogue.sourceUrl,
      status: 'imported',
      importedAt: now
    }, input));
    return { catalogue: catalogue, version: version };
  }

  function attachCatalogueMetadata(record, context) {
    record = clone(record || {});
    context = context || {};
    var catalogue = context.catalogue || {};
    var version = context.version || {};
    if (catalogue.id) record.catalogueId = catalogue.id;
    if (version.id) record.catalogueVersionId = version.id;
    if (version.versionLabel) record.catalogueVersionLabel = version.versionLabel;
    if (!record.catalogueYear && version.year) record.catalogueYear = version.year;
    if (!record.catalogueRevision && version.versionLabel) record.catalogueRevision = version.versionLabel;
    if (!record.sourceDocumentName && version.sourceDocumentName) record.sourceDocumentName = version.sourceDocumentName;
    if (!record.sourceReference && version.sourceReference) record.sourceReference = version.sourceReference;
    return record;
  }

  function readCatalogues() {
    return readJson(CATALOGUE_STORAGE_KEY).map(normalizeCatalogue);
  }

  function readVersions() {
    return readJson(VERSION_STORAGE_KEY).map(normalizeCatalogueVersion);
  }

  function upsertById(list, item) {
    var next = (list || []).filter(function (existing) { return existing.id !== item.id; });
    next.push(item);
    return next;
  }

  function saveImportContext(context, recordCount) {
    context = context || {};
    if (!context.catalogue || !context.version) return { ok: false, reason: 'missing catalogue context' };
    var catalogue = normalizeCatalogue(Object.assign({}, context.catalogue, {
      versionCount: Math.max(1, Number(context.catalogue.versionCount || 0)),
      updatedAt: new Date().toISOString()
    }));
    var version = normalizeCatalogueVersion(Object.assign({}, context.version, {
      recordCount: recordCount == null ? context.version.recordCount : recordCount
    }));
    writeJson(CATALOGUE_STORAGE_KEY, upsertById(readCatalogues(), catalogue));
    writeJson(VERSION_STORAGE_KEY, upsertById(readVersions(), version));
    return { ok: true, catalogue: catalogue, version: version };
  }

  function mergeCloudStore(store) {
    store = store || {};
    var catalogues = Array.isArray(store.catalogues) ? store.catalogues.map(normalizeCatalogue) : [];
    var versions = Array.isArray(store.versions) ? store.versions.map(normalizeCatalogueVersion) : [];
    var localCatalogues = readCatalogues();
    var localVersions = readVersions();
    var importedCatalogues = 0;
    var importedVersions = 0;

    catalogues.forEach(function (catalogue) {
      if (!catalogue.id || localCatalogues.some(function (local) { return local.id === catalogue.id; })) return;
      localCatalogues.push(catalogue);
      importedCatalogues += 1;
    });
    versions.forEach(function (version) {
      if (!version.id || localVersions.some(function (local) { return local.id === version.id; })) return;
      localVersions.push(version);
      importedVersions += 1;
    });

    writeJson(CATALOGUE_STORAGE_KEY, localCatalogues);
    writeJson(VERSION_STORAGE_KEY, localVersions);
    return {
      ok: true,
      importedCatalogues: importedCatalogues,
      importedVersions: importedVersions
    };
  }

  function snapshotVersionRef(record) {
    record = record || {};
    return {
      catalogueId: text(record.catalogueId),
      catalogueVersionId: text(record.catalogueVersionId),
      catalogueVersionLabel: text(record.catalogueVersionLabel || record.catalogueRevision),
      catalogueYear: numberOrNull(record.catalogueYear),
      sourceDocumentName: text(record.sourceDocumentName),
      sourceReference: text(record.sourceReference)
    };
  }

  function canTransitionRecord(record, nextStatus) {
    record = record || {};
    var current = normalizeRecordStatus(record.verificationStatus);
    var next = normalizeRecordStatus(nextStatus);
    if (record.sampleData || current === 'sample') {
      return { ok: false, reason: 'Sample data cannot enter the verification workflow.' };
    }
    if (current === next) return { ok: true, current: current, next: next, noop: true };
    var allowed = RECORD_TRANSITIONS[current] || [];
    if (allowed.indexOf(next) < 0) {
      return {
        ok: false,
        current: current,
        next: next,
        reason: 'Invalid equipment verification transition: ' + current + ' -> ' + next + '.'
      };
    }
    if (next === 'pending_review' || next === 'verified' || next === 'published') {
      var quality = evaluateRecordQuality(record);
      if (!quality.ok) {
        return {
          ok: false,
          current: current,
          next: next,
          reason: 'Equipment record failed catalogue data quality gates.',
          findings: quality.findings
        };
      }
    }
    return { ok: true, current: current, next: next };
  }

  function numberValue(value) {
    var n = Number(value);
    return isFinite(n) ? n : null;
  }

  function qualityFinding(field, severity, message) {
    return { field: field, severity: severity, message: message };
  }

  function requiresEsp(record) {
    var type = text(record && record.equipmentType).toLowerCase();
    return ['ducted', 'package', 'ahu', 'fcu'].indexOf(type) >= 0;
  }

  function evaluateRecordQuality(record) {
    record = record || {};
    var S = root.AirCalcEquipmentSchema || null;
    var normalized = S && typeof S.normalizeEquipmentRecord === 'function' ? S.normalizeEquipmentRecord(record) : clone(record);
    var findings = [];
    var btu = numberValue(normalized.coolingCapacityBtuH);
    var cfm = numberValue(normalized.airflowNominalCfm);
    var esp = numberValue(normalized.availableEspPa);

    if (!text(normalized.sourceDocumentName) && !text(normalized.sourceReference)) {
      findings.push(qualityFinding('sourceDocumentName', 'blocker', 'Catalogue source document or reference is required.'));
    }
    if (btu == null || btu <= 0) {
      findings.push(qualityFinding('coolingCapacityBtuH', 'blocker', 'Cooling capacity BTU/h is required and must be greater than zero.'));
    }
    if (cfm == null || cfm <= 0) {
      findings.push(qualityFinding('airflowNominalCfm', 'blocker', 'Nominal airflow CFM is required and must be greater than zero.'));
    }
    if (requiresEsp(normalized) && (esp == null || esp < 0)) {
      findings.push(qualityFinding('availableEspPa', 'blocker', 'Available ESP Pa is required for ducted, package, AHU, and FCU records.'));
    }
    if (btu && cfm) {
      var tons = btu / 12000;
      var cfmPerTon = tons > 0 ? cfm / tons : 0;
      if (cfmPerTon && (cfmPerTon < 250 || cfmPerTon > 550)) {
        findings.push(qualityFinding('airflowNominalCfm', 'warning', 'CFM per TR is outside the typical review band; verify catalogue data before publishing.'));
      }
    }

    var blockers = findings.filter(function (finding) { return finding.severity === 'blocker'; });
    return { ok: blockers.length === 0, findings: findings, blockers: blockers };
  }

  function transitionRecord(record, nextStatus, meta) {
    var check = canTransitionRecord(record, nextStatus);
    if (!check.ok) return { ok: false, reason: check.reason, findings: check.findings || [], record: clone(record) };
    var now = new Date().toISOString();
    var next = clone(record || {});
    var history = Array.isArray(next.workflowHistory) ? next.workflowHistory.slice() : [];
    if (!check.noop) {
      history.push({
        from: check.current,
        to: check.next,
        at: now,
        by: text(meta && meta.by),
        note: text(meta && meta.note)
      });
      next.verificationStatus = check.next;
      next.workflowStatus = check.next;
      next.updatedAt = now;
      if (check.next === 'verified') {
        next.verifiedAt = next.verifiedAt || now;
        next.verifiedBy = next.verifiedBy || text(meta && meta.by);
      }
      if (check.next === 'published') next.publishedAt = now;
      if (check.next === 'archived') next.archivedAt = now;
    }
    next.workflowHistory = history;
    return { ok: true, record: next, current: check.current, next: check.next, noop: !!check.noop };
  }

  return {
    CATALOGUE_STORAGE_KEY: CATALOGUE_STORAGE_KEY,
    VERSION_STORAGE_KEY: VERSION_STORAGE_KEY,
    CATALOGUE_STATUSES: CATALOGUE_STATUSES.slice(),
    buildCatalogueId: buildCatalogueId,
    buildVersionId: buildVersionId,
    normalizeCatalogue: normalizeCatalogue,
    normalizeCatalogueVersion: normalizeCatalogueVersion,
    createImportContext: createImportContext,
    attachCatalogueMetadata: attachCatalogueMetadata,
    readCatalogues: readCatalogues,
    readVersions: readVersions,
    saveImportContext: saveImportContext,
    mergeCloudStore: mergeCloudStore,
    snapshotVersionRef: snapshotVersionRef
    ,
    normalizeRecordStatus: normalizeRecordStatus,
    evaluateRecordQuality: evaluateRecordQuality,
    canTransitionRecord: canTransitionRecord,
    transitionRecord: transitionRecord
  };
});
