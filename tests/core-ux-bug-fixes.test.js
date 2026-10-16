const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const styles = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');

assert.ok(app.includes('function getSelectedUnitCapacityBtu'), 'installed capacity should have one central unit-capacity resolver.');
assert.ok(app.includes('function getSelectedInstalledCapacity'), 'installed capacity should have one central total-capacity resolver.');
assert.ok(app.includes("system.selectionMode === 'database'"), 'database selections should be handled explicitly.');
assert.ok(app.includes("system.selectionMode === 'manual'"), 'manual capacity should be handled explicitly.');
assert.ok(app.includes('manualCapacityBtuH'), 'manual capacity should be stored separately from catalogue snapshots.');
assert.ok(app.includes("system.selectionMode = 'database'"), 'equipment selections should persist selectionMode=database.');
assert.ok(app.includes("system.selectionMode = 'manual'"), 'manual selections should persist selectionMode=manual.');
assert.ok(app.includes('return sum + getSelectedInstalledCapacity(system);'), 'capacity totals should use the central resolver.');

assert.ok(app.includes('applyLangRenders();\n  updateDesktopProjectFields();'), 'language changes should refresh desktop sidebar/topbar labels.');
assert.ok(app.includes('document.documentElement.dir = lang ==='), 'language changes should update document direction.');
assert.ok(styles.includes('html[dir="ltr"] .desktop-shell .desktop-sidebar'), 'English LTR should move the desktop sidebar to the left.');
assert.ok(styles.includes('html[dir="ltr"] .desktop-shell .app'), 'English LTR should move app spacing to the left sidebar.');
assert.ok(app.includes('project-capacity-control'), 'project capacity should use the compact per-room capacity control shell.');
assert.ok(app.includes('class="qi-cap-sel" onchange="updateProjectSystem'), 'project capacity changes should use the shared numeric select style and calculation update path.');
assert.ok(!app.includes('project-equipment-picker-select'), 'capacity picker should not render the native browser select that caused the white dropdown.');

assert.ok(app.includes('function openModal(){\n  var overlay = G(\'overlay\');'), 'device picker should guard missing modal elements before opening.');
assert.ok(app.includes('buildGrid(null);'), 'device picker should populate the device grid before showing the modal.');
assert.ok(app.includes("overlay.classList.add('on')"), 'device picker should show the modal overlay.');

console.log('Core UX bug-fix coverage tests passed.');
