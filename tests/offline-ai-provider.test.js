'use strict';
const assert=require('assert');
const {createOllamaProvider,localEndpoint}=require('../server/providers/ollama-provider');
const {createConfiguredAiProvider}=require('../server/ai-provider-runtime');
const {explainEngineeringContext}=require('../server/ai-explanation-service');

async function main(){
  for(const endpoint of ['https://example.com','http://192.168.1.2:11434','http://localhost@evil.test','http://localhost/api']) assert.throws(()=>localEndpoint(endpoint));
  assert.throws(()=>createOllamaProvider({model:'model-cloud'}));
  assert.throws(()=>createConfiguredAiProvider({env:{AIRCALC_AI_MODE:'offline'}}));
  const context={language:'ar',sourceOfTruth:'rules_engine',aiRole:'explain_only',totals:{load:30000},constraints:{mustNotGenerateEngineeringNumbers:true,mustNotChangeRanking:true,mustNotVerifyCatalogueData:true}};
  const calls=[];
  let content=JSON.stringify({explanation:'Review the supplied warning.',questionsForEngineer:[]});
  const fetch=async(url,init)=>{
    calls.push({url,init});
    assert.strictEqual(init.redirect,'error');
    return {ok:true,json:async()=>url.endsWith('/tags')?{models:[{name:'test:latest'}]}:url.endsWith('/show')?{}:{message:{content}}};
  };
  const provider=createConfiguredAiProvider({env:{AIRCALC_AI_MODE:'offline',AIRCALC_AI_LOCAL_MODEL:'test'},fetch});
  const result=await explainEngineeringContext({context},{provider});
  assert.strictEqual(result.ok,true);
  assert.strictEqual(result.provider,'ollama_local');
  assert(calls.every(c=>c.url.startsWith('http://127.0.0.1:11434/')));
  const request=JSON.parse(calls.find(c=>c.url.endsWith('/chat')).init.body);
  assert.strictEqual(request.stream,false);
  assert(request.messages.some(m=>m.content.includes('Arabic')));
  content=JSON.stringify({explanation:'Use 99999 BTU/h'});
  assert.strictEqual((await explainEngineeringContext({context},{provider})).reason,'provider_returned_unsupported_engineering_numbers');
  const missing=createOllamaProvider({model:'test',fetch:async()=>({ok:true,json:async()=>({models:[]})})});
  await assert.rejects(()=>missing.checkAvailable(),/model_not_installed/);
  const cloud=createOllamaProvider({model:'test',fetch:async(url)=>({ok:true,json:async()=>url.endsWith('/tags')?{models:[{name:'test'}]}:{remote_host:'cloud.example'}})});
  await assert.rejects(()=>cloud.checkAvailable(),/remote_model_rejected/);
  const unavailable=createOllamaProvider({model:'test',fetch:async()=>{throw Error('connection refused');}});
  assert.strictEqual((await explainEngineeringContext({context},{provider:unavailable})).ok,false);
  assert.strictEqual(context.totals.load,30000);
  const timed=createOllamaProvider({model:'test',timeoutMs:10,fetch:(_url,init)=>new Promise((_resolve,reject)=>init.signal.addEventListener('abort',()=>reject(Error('aborted'))))});
  await assert.rejects(()=>timed.checkAvailable(),/aborted/);
  console.log('Offline AI provider and explanation integration tests passed.');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
