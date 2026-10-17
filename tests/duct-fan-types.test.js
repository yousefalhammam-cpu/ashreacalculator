const assert=require('assert'),fs=require('fs'),vm=require('vm');
const source=fs.readFileSync(require('path').join(__dirname,'../app.js'),'utf8');
const ctx={};vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('function getDuctFanTypes('),source.indexOf('function getInlineFilterPresets(')),ctx);
const types=ctx.getDuctFanTypes();
assert.strictEqual(new Set(types.map(x=>x.id)).size,types.length);
for(const id of ['axial','mixed_flow','centrifugal_backward','centrifugal_forward','plug','other'])assert(types.some(x=>x.id===id && x.ar && x.en));
assert(source.includes('name="fanType"'));
assert(source.includes('data.operating=null;data.shutoff=null;'));
console.log('Duct fan type choices and curve invalidation passed.');
