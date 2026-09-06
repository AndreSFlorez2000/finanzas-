import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep,extname} from 'node:path';
const root=resolve('docs');
createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,'http://127.0.0.1:4174');
    const path=resolve(root,'.'+decodeURIComponent(url.pathname.endsWith('/')?url.pathname+'index.html':url.pathname));
    if(!path.startsWith(root+sep))throw new Error('Ruta inválida');
    const content=await readFile(path);
    res.writeHead(200,{'Content-Type':{'.js':'text/javascript; charset=utf-8','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8'}[extname(path)]||'application/octet-stream','Cache-Control':'no-store'});res.end(content);
  }catch{res.writeHead(404);res.end('No encontrado');}
}).listen(4174,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:4174'));
