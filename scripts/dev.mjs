import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { createWorker } from '../server/worker.mjs';
import { localDatabase } from './sqlite-local.mjs';
const DB=localDatabase();
const server=createServer(async(req,res)=>{
  const assets={};
  for(const [file,type] of [['index.html','text/html; charset=utf-8'],['styles.css','text/css'],['app.js','text/javascript']]) assets['/'+file]={body:await readFile(file,'utf8'),type};
  const headers=new Headers(req.headers);headers.set('oai-authenticated-user-id','local-preview');
  const request=new Request('http://127.0.0.1:4173'+req.url,{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:req,duplex:'half'}:{})});
  const response=await createWorker(assets).fetch(request,{DB});
  res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
});
server.listen(4173,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4173 (datos de prueba temporales)'));
