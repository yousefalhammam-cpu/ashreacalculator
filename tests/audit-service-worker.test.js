'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const listeners={},entries=new Map(),putKeys=[];
const canonical=key=>new URL(typeof key==='string'?key:key.url,'https://aircalcpro.com/').href;
const cache={put:async(key,response)=>{putKeys.push(canonical(key));entries.set(canonical(key),response);},
  addAll:async urls=>{for(const url of urls) assert(fs.existsSync(path.join(__dirname,'..',url)),url+' must exist');}};
let offline=false;
const ctx={URL,Response,self:{location:{origin:'https://aircalcpro.com'},
  addEventListener:(name,fn)=>{listeners[name]=fn;},skipWaiting:async()=>{},clients:{claim:async()=>{}}},
  caches:{open:async()=>cache,keys:async()=>[],delete:async()=>true,match:async(key,options)=>{
    const url=new URL(canonical(key));if(options&&options.ignoreSearch)url.search='';
    const r=entries.get(url.href);return r&&r.clone();}},
  fetch:async request=>{if(offline)throw Error('offline');return new Response(request.url.endsWith('app.js')?'javascript':'document',{status:200});}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),ctx);
async function dispatch(url,destination){
  let result;const pending=[];
  listeners.fetch({request:{url,method:'GET',destination:destination||'',mode:destination==='document'?'navigate':'cors'},
    respondWith:value=>{result=value;},waitUntil:p=>pending.push(p)});
  const response=await result;await Promise.all(pending);return response;
}
(async()=>{
  let installed;listeners.install({waitUntil:p=>installed=p});await installed;
  entries.set('https://aircalcpro.com/index.html',new Response('landing'));
  const js=await dispatch('https://aircalcpro.com/app.js','script');assert.equal(await js.text(),'javascript');
  assert.equal(await entries.get('https://aircalcpro.com/index.html').clone().text(),'landing','script must not corrupt index cache');
  assert(!putKeys.includes('https://aircalcpro.com/index.html'));
  offline=true;
  entries.set('https://aircalcpro.com/app/index.html',new Response('application'));
  assert.equal(await (await dispatch('https://aircalcpro.com/app/','document')).text(),'application');
  assert.equal(await (await dispatch('https://aircalcpro.com/app.js?v=changed','script')).text(),'javascript');
  assert.equal((await dispatch('https://aircalcpro.com/missing.js','script')).status,503,'missing script must not receive HTML');
  entries.delete('https://aircalcpro.com/app/index.html');
  entries.set('https://aircalcpro.com/app/',new Response('fallback application'));
  assert.equal(await (await dispatch('https://aircalcpro.com/app/index.html','document')).text(),'fallback application','fallback promises must be awaited');
  console.log('Audit regression: all precache assets exist; JS/HTML caches, versioned scripts and offline fallbacks passed.');
})().catch(err=>{console.error(err);process.exitCode=1;});
