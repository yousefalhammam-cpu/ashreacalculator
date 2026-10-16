'use strict';

const {createOllamaProvider} = require('../server/providers/ollama-provider');
const {createAirCalcServer} = require('../local-static-server');

async function main(){
  const model = process.env.AIRCALC_AI_LOCAL_MODEL;
  const provider = createOllamaProvider({model,endpoint:process.env.AIRCALC_AI_LOCAL_ENDPOINT});
  const status = await provider.checkAvailable();
  console.log(JSON.stringify(status));
  if(process.argv.includes('--check')) return;
  const port = Number(process.env.AIRCALC_LOCAL_PORT || 5501);
  if(!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('invalid_local_port');
  const server = createAirCalcServer({host:'127.0.0.1',port,provider});
  server.on('error',err=>{console.error(err.message);process.exitCode=1;});
  server.listen(port,'127.0.0.1',()=>console.log('AirCalc offline AI: http://127.0.0.1:'+port+'/app/index.html'));
}
main().catch(err=>{console.error('Offline AI unavailable: '+err.message);process.exitCode=1;});
