const assert=require('assert');
const fs=require('fs');
const path=require('path');
global.window=global;
require('../data/equipment-manufacturers.js');
for(const brand of ['Zamil','Carrier','Daikin','Haier','LG','Midea','Samsung','SKM','Trane']) {
  const html=global.AirCalcManufacturerLogo(brand);
  assert(html.includes('alt=""') && html.includes('width="88"'));
  const file=html.match(/src="([^"]+)"/)[1];
  assert(fs.statSync(path.resolve(__dirname,file)).size>100);
}
assert.strictEqual(global.AirCalcManufacturerLogo('<script>alert(1)</script>'),'');
assert.strictEqual(global.AirCalcManufacturerLogo('Unknown'), '');
assert(global.AirCalcManufacturerLogo('Haier').includes('background:#005aaa'));
assert(global.AirCalcManufacturerLogo('Zamil').includes('zamil.svg'));
console.log('Manufacturer logo assets: passed');
