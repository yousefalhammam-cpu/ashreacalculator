'use strict';
const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync(require('path').join(__dirname,'../app.js'),'utf8');
const fn = source.match(/function scrollTechnicalReportSection\(id\)\{[\s\S]*?\n\}/)[0];
const calls = [];
const section = {
  setAttribute:(...args)=>calls.push(['attribute',...args]),
  focus:opts=>calls.push(['focus',opts]),
  scrollIntoView:opts=>calls.push(['scroll',opts])
};
const context = {G:id=>id==='tech-analysis-slot'?{contains:node=>node===section}:id==='report-loads'?section:null};
// No location object: navigation must work without reading or changing the URL.
vm.createContext(context);
vm.runInContext(fn,context);
context.scrollTechnicalReportSection('report-loads');
assert.deepStrictEqual(calls.map(x=>x[0]),['attribute','focus','scroll']);
context.scrollTechnicalReportSection('unknown');
assert.strictEqual(calls.length,3);
assert(!source.includes('<a href="#\'+item[0]'), 'Report navigation must not resolve fragments against the HTML base URL');
console.log('Report section navigation tests passed.');
