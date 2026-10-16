const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const projectsSource = fs.readFileSync(path.join(root, 'modules', 'projects.js'), 'utf8');
const selectorSource = fs.readFileSync(path.join(root, 'modules', 'equipment-selector.js'), 'utf8');
const databaseSource = fs.readFileSync(path.join(root, 'modules', 'equipment-database.js'), 'utf8');

assert.ok(
  projectsSource.includes('snap.equipmentSelection = _getEquipmentSelectionSnapshot();'),
  'project snapshot should include selected equipment snapshot'
);

assert.ok(
  projectsSource.includes("localStorage.setItem('aircalc_last_selected_equipment_snapshot'"),
  'project restore should restore selected equipment snapshot'
);

assert.ok(
  projectsSource.includes("localStorage.removeItem('aircalc_last_selected_equipment_snapshot')"),
  'project restore should clear stale selected equipment snapshot when a project has no equipment snapshot'
);

assert.ok(
  selectorSource.includes('selectionRequirements: lastResult && lastResult.requirements'),
  'AI select wizard should preserve requirements used by the deterministic selection engine'
);

assert.ok(
  databaseSource.includes('selectionOption: selectionOption || null'),
  'equipment database project selection should persist the applied selection option'
);

assert.ok(
  projectsSource.includes('function _projectEquipmentSnapshotSummary'),
  'project dashboard should summarize selected equipment snapshots'
);

assert.ok(
  projectsSource.includes('pm-equipment-snapshot'),
  'project cards should render selected equipment snapshot status'
);

assert.ok(
  projectsSource.includes('preBindReview'),
  'project cards should include pre-bind review status when present in the equipment snapshot'
);

assert.ok(
  projectsSource.includes('requirementChanged'),
  'project cards should flag equipment snapshots selected against changed project requirements'
);

assert.ok(
  projectsSource.includes('Requirements changed'),
  'project cards should show a reader-facing changed-requirements note'
);

console.log('Equipment snapshot persistence tests passed.');
