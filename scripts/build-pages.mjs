import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {rollup} from 'rollup';
import {nodeResolve} from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import {resolve} from 'node:path';
await mkdir('docs/assets',{recursive:true});
const original=await readFile('app.js','utf8');
const start=original.indexOf('async function api(path,options={}){');
const end=original.indexOf('async function loadRemote(',start);
if(start<0||end<0)throw new Error('No se encontró la capa de almacenamiento.');
await writeFile('web/finance.js',original.slice(0,start)+'async function api(path,options={}){return window.NexoStorage.request(path,options);}\n'+original.slice(end));
const bundle=await rollup({input:resolve('web/entry.mjs'),external:id=>id==='./finance.js',plugins:[nodeResolve({browser:true,preferBuiltins:false}),commonjs()]});
await bundle.write({file:resolve('docs/assets/nexo.js'),format:'es',inlineDynamicImports:true});
await bundle.close();
await copyFile('web/finance.js','docs/assets/finance.js');
const appHtml=await readFile('index.html','utf8');
const shell=appHtml.slice(appHtml.indexOf('  <div class="app-shell">'),appHtml.indexOf('  <script src="app.js"></script>'))
  .replace('<div class="app-shell">','<div class="app-shell" id="appShell" hidden>')
  .replace('<a class="btn secondary" href="/signout-with-chatgpt?return_to=%2F" target="_top">Salir</a>','<span id="accountEmail"></span><button class="btn secondary" id="logout">Salir</button>');
const auth=await readFile('web/auth.html','utf8');
await writeFile('docs/index.html',`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>NEXO · Finanzas en pareja</title><link rel="stylesheet" href="assets/styles.css"></head><body>${auth}${shell}<script type="module" src="assets/nexo.js"></script></body></html>`);
await copyFile('styles.css','docs/assets/styles.css');
await writeFile('docs/.nojekyll','');
console.log('NEXO para GitHub Pages compilado.');

