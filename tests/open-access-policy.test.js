const assert=require('assert'),fs=require('fs'),vm=require('vm');
const text=fs.readFileSync(require('path').join(__dirname,'../modules/plan.js'),'utf8');
function load(code){const c={window:{},document:{documentElement:{lang:'en'},addEventListener(){}},console:{log(){}}};vm.createContext(c);vm.runInContext(code,c);return c.window.AppPlan;}
const open=load(text);
assert(open.hasAccess('export_pdf') && open.hasAccess('save_project'));
assert.strictEqual(open.getProjectLimit(),1);
assert.strictEqual(open.hasAccess('unknown'),false);
let called=false;assert(open.requirePro('exportPDF',()=>called=true));assert(called);
const limited=load(text.replace('features: {}','features: { exportPDF: false }'));
assert(!limited.hasAccess('export_pdf') && limited.hasAccess('techReport'));
const plans=load(text.replace("mode: 'open'","mode: 'plans'"));
assert(!plans.hasAccess('exportPDF'));
console.log('Open access and feature overrides passed.');
