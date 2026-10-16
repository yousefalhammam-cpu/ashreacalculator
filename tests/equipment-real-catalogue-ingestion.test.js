const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const equipmentDb = fs.readFileSync(path.join(root, 'modules/equipment-database.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'app/index.html'), 'latin1');
const docs = fs.readFileSync(path.join(root, 'REAL_CATALOGUE_INGESTION_WORKFLOW.md'), 'utf8');

function includes(text, needle, message) {
  assert.ok(text.includes(needle), message + ` Missing: ${needle}`);
}

includes(indexHtml, 'id="equip-import-manufacturer-id"', 'Real catalogue import should collect manufacturer id.');
includes(indexHtml, 'id="equip-import-source-document"', 'Real catalogue import should collect source document.');
includes(indexHtml, 'id="equip-import-source-reference"', 'Real catalogue import should collect source reference.');
includes(indexHtml, 'id="equip-import-source-url"', 'Real catalogue import should collect source URL.');
includes(indexHtml, 'id="equip-import-source-file"', 'Real catalogue import should allow linking the original source file.');
includes(indexHtml, 'id="equip-import-source-file-status"', 'Real catalogue import should show source file fingerprint status.');
includes(equipmentDb, 'function currentImportContextInfo', 'Equipment DB should build an import context from provenance fields.');
includes(equipmentDb, 'function handleSourceFile', 'Equipment DB should handle source file linking.');
includes(equipmentDb, "sourceHash: (catalogueSourceFileMeta && catalogueSourceFileMeta.sha256)", 'Equipment DB should attach source file SHA-256 when available.');
includes(equipmentDb, 'AirCalcEquipmentCatalogue', 'Equipment DB should use the catalogue model for import provenance.');
includes(equipmentDb, 'catalogueWarnings', 'Equipment DB should surface incomplete catalogue provenance warnings.');
includes(equipmentDb, 'catalogue_metadata_incomplete', 'Equipment DB should block incomplete real catalogue imports.');
includes(equipmentDb, 'createImportContext(input)', 'Equipment DB should create a catalogue import context from metadata.');
includes(equipmentDb, "crypto.subtle.digest('SHA-256'", 'Source file handler should calculate a SHA-256 fingerprint.');
includes(docs, 'Imported rows must pass the catalogue review workflow', 'Workflow docs should keep import separate from verification.');
includes(docs, 'do not infer catalogue values from memory', 'Workflow docs should forbid invented manufacturer values.');

console.log('Real catalogue ingestion workflow tests passed.');
