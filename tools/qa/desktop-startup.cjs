const fs = require('fs'), vm = require('vm'), assert = require('assert'), { EventEmitter } = require('events');
const file = require('path').resolve(__dirname, '../../desktop/main.js');
const source = fs.readFileSync(file, 'utf8');
const section = source.slice(source.indexOf('async function up('), source.indexOf('let win = null'));
async function scenario(kind) {
 let clock = 0, spawned = 0;
 const socket = new EventEmitter(); socket.destroy = () => {}; socket.setTimeout = () => queueMicrotask(() => socket.emit(kind === 'occupied' ? 'connect' : 'error', { code: 'ECONNREFUSED' }));
 const sandbox = { BASE: 'http://localhost:4321', PORT:4321, ROOT:'.', process:{env:{}}, AbortController,
 setTimeout: (f, ms) => setTimeout(() => { clock += ms; f(); }, Math.min(ms, 5)), clearTimeout,
 Date:{now:()=>clock}, sleep:async ms=>{clock+=ms}, net:{connect:()=>socket},
 fetch: async (url, options) => {
  if(kind === 'healthy') return {ok:true};
  if(kind === 'hung') return new Promise((resolve,reject)=>options.signal.addEventListener('abort',()=>{reject(new Error('abort'))}));
  throw new Error('offline');
 }, spawn:()=> {spawned++;const child=new EventEmitter();child.unref=()=>{};if(kind==='missing')queueMicrotask(()=>child.emit('error',new Error('ENOENT')));return child;}
 };
 vm.createContext(sandbox); vm.runInContext(section+';globalThis.run=ensureServer;',sandbox);
 const result=await sandbox.run();
 assert.equal(result,kind==='healthy');assert.equal(spawned, ['healthy','occupied'].includes(kind)?0:1);
 assert(clock<=10000, 'deadline exceeded');
 console.log(kind+': passed');
}
(async()=>{for(const k of ['healthy','occupied','missing','hung','offline'])await scenario(k)})().catch(e=>{console.error(e);process.exitCode=1});
