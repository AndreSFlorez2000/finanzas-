import { readFile, mkdir, writeFile, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
await mkdir('dist/server',{recursive:true});
const assets={};
for(const [file,type] of [['index.html','text/html; charset=utf-8'],['welcome.html','text/html; charset=utf-8'],['styles.css','text/css; charset=utf-8'],['app.js','text/javascript; charset=utf-8']]) {
  assets['/'+file]={body:await readFile(file,'utf8'),type};
}
execFileSync(process.execPath,['--check','app.js'],{stdio:'inherit'});
for(const name of ['validation.mjs','worker.mjs']) await copyFile('server/'+name,'dist/server/'+name);
await writeFile('dist/server/index.js',`import { createWorker } from './worker.mjs';\nexport default createWorker(${JSON.stringify(assets)});\n`);
const worker=await import('../dist/server/index.js?build='+Date.now());
if(typeof worker.default.fetch!=='function') throw new Error('Worker inválido');
console.log('NEXO listo: interfaz y servidor compilados.');
