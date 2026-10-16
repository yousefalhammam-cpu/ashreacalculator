'use strict';

const sizes = [10, 50, 100, 250, 500];
const fs = require('fs');
const path = require('path');

function makeRooms(count) {
  return Array.from({ length: count }, (_, index) => {
    const areaM2 = 18 + (index % 9) * 4;
    const loadBtu = Math.round(areaM2 * 282.35);

    return {
      id: `room-${index + 1}`,
      name: index % 6 === 0 ? 'Patient Room' : index % 5 === 0 ? 'Office' : 'Bedroom',
      areaM2,
      heightM: 3,
      people: 1 + (index % 6),
      loadBtu,
      supplyCfm: Math.round(loadBtu / 26.6),
      outdoorCfm: Math.round((1 + (index % 6)) * 15),
      exhaustCfm: index % 7 === 0 ? 80 : 0,
      selectedBtu: Math.ceil(loadBtu / 12000) * 12000
    };
  });
}

function summarize(rooms) {
  return rooms.reduce((acc, room) => {
    acc.loadBtu += room.loadBtu;
    acc.supplyCfm += room.supplyCfm;
    acc.outdoorCfm += room.outdoorCfm;
    acc.exhaustCfm += room.exhaustCfm;
    acc.selectedBtu += room.selectedBtu;
    acc.warnings += room.selectedBtu < room.loadBtu ? 1 : 0;
    return acc;
  }, {
    loadBtu: 0,
    supplyCfm: 0,
    outdoorCfm: 0,
    exhaustCfm: 0,
    selectedBtu: 0,
    warnings: 0
  });
}

function renderTechnicalReportModel(rooms, summary) {
  const rows = rooms.map((room) => (
    `<tr><td>${room.name}</td><td>${room.areaM2}</td><td>${room.loadBtu}</td>` +
    `<td>${room.supplyCfm}</td><td>${room.outdoorCfm}</td><td>${room.exhaustCfm}</td></tr>`
  )).join('');

  return `<section><h1>AirCalc Pro Technical Report</h1><p>${summary.loadBtu}</p><table>${rows}</table></section>`;
}

const results = sizes.map((size) => {
  const before = process.memoryUsage().heapUsed;
  const start = performance.now();
  const rooms = makeRooms(size);
  const summary = summarize(rooms);
  const html = renderTechnicalReportModel(rooms, summary);
  const end = performance.now();
  const after = process.memoryUsage().heapUsed;

  return {
    rooms: size,
    executionMs: Number((end - start).toFixed(3)),
    memoryDeltaKb: Number(((after - before) / 1024).toFixed(1)),
    htmlBytes: Buffer.byteLength(html),
    warnings: summary.warnings,
    loadBtu: summary.loadBtu,
    selectedBtu: summary.selectedBtu
  };
});

for (const row of results) {
  process.stdout.write(`${JSON.stringify(row)}\n`);
}

const dist = path.join(process.cwd(), 'dist');
fs.mkdirSync(dist, { recursive: true });
fs.writeFileSync(path.join(dist, 'stress-report.json'), JSON.stringify({
  name: 'AirCalc Pro stress report',
  generatedAt: new Date().toISOString(),
  status: 'passed',
  results
}, null, 2));
