import { emptyLedger, validateLedger } from './validation.mjs';

const headers = {
  'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff',
  'Referrer-Policy':'same-origin',
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'"
};
const json = (value,status=200) => new Response(JSON.stringify(value),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8'}});
export function createWorker(assets) {
  return { async fetch(request,env) {
    const url=new URL(request.url);
    // Sites strips/replaces these identity headers at its authenticated gateway.
    // Each authenticated visitor owns an isolated ledger. Profile tabs are not logins.
    const owner=request.headers.get('oai-authenticated-user-id');
    if(!owner) {
      if(['GET','HEAD'].includes(request.method) && ['/', '/index.html', '/styles.css'].includes(url.pathname)) {
        const asset=assets[url.pathname==='/styles.css'?'/styles.css':'/welcome.html'];
        if(asset) return new Response(request.method==='HEAD'?null:asset.body,{headers:{...headers,'Content-Type':asset.type}});
      }
      return json({error:'Inicia sesión con ChatGPT para consultar tus datos.'},401);
    }
    try {
      if(url.pathname.startsWith('/api/')) {
        if(!env.DB) return json({error:'La base de datos todavía no está disponible.'},503);
        if(url.pathname === '/api/state' && request.method==='GET') {
          const row=await env.DB.prepare('SELECT revision, payload, updated_at FROM ledgers WHERE owner_id = ?').bind(owner).first();
          return json({state:row?JSON.parse(row.payload):emptyLedger(),revision:row?.revision??0,updatedAt:row?.updated_at??null});
        }
        if(url.pathname === '/api/state' && request.method==='PUT') {
          if(request.headers.get('Origin')!==url.origin) return json({error:'Origen no permitido.'},403);
          if(!request.headers.get('content-type')?.includes('application/json')) return json({error:'Formato no permitido.'},415);
          const reader=request.body?.getReader();
          if(!reader) return json({error:'Faltan datos.'},400);
          const chunks=[]; let size=0;
          while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2_000_000){await reader.cancel();return json({error:'El archivo supera el límite de 2 MB.'},413);}chunks.push(value);}
          const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
          let body,state;
          try {body=JSON.parse(new TextDecoder().decode(bytes));state=validateLedger(body.state);
            if(!Number.isSafeInteger(body.revision)||body.revision<0) throw new Error('Versión inválida.');
          } catch(error){return json({error:error.message},400);}
          const payload=JSON.stringify(state),now=new Date().toISOString();
          const results=await env.DB.batch([
            env.DB.prepare('INSERT OR IGNORE INTO ledgers (owner_id, revision, payload, updated_at) VALUES (?, 0, ?, ?)').bind(owner,JSON.stringify(emptyLedger()),now),
            env.DB.prepare('UPDATE ledgers SET payload = ?, revision = revision + 1, updated_at = ? WHERE owner_id = ? AND revision = ?').bind(payload,now,owner,body.revision),
            env.DB.prepare('INSERT OR IGNORE INTO ledger_history (owner_id, revision, payload, saved_at) SELECT owner_id, revision, payload, updated_at FROM ledgers WHERE owner_id = ? AND revision = ? AND payload = ? AND updated_at = ?').bind(owner,body.revision+1,payload,now)
          ]);
          if(results[1].meta.changes!==1) return json({error:'Los datos cambiaron en otra pestaña. Actualiza y vuelve a realizar el cambio.'},409);
          return json({revision:body.revision+1,updatedAt:now});
        }
        if(url.pathname === '/api/history' && request.method==='GET') {
          const {results}=await env.DB.prepare('SELECT revision, saved_at FROM ledger_history WHERE owner_id = ? ORDER BY revision DESC LIMIT 100').bind(owner).all();
          return json({versions:results});
        }
        if(/^\/api\/history\/\d+$/.test(url.pathname) && request.method==='GET') {
          const revision=Number(url.pathname.split('/').pop());
          const row=await env.DB.prepare('SELECT payload, saved_at FROM ledger_history WHERE owner_id = ? AND revision = ?').bind(owner,revision).first();
          if(!row) return json({error:'Versión no encontrada.'},404);
          return json({state:JSON.parse(row.payload),revision,updatedAt:row.saved_at});
        }
        return json({error:'Ruta no encontrada.'},404);
      }
      if(!['GET','HEAD'].includes(request.method)) return json({error:'Método no permitido.'},405);
      const asset=assets[url.pathname==='/'?'/index.html':url.pathname];
      if(!asset) return json({error:'Página no encontrada.'},404);
      return new Response(request.method==='HEAD'?null:asset.body,{headers:{...headers,'Content-Type':asset.type}});
    } catch(error) {
      console.error('NEXO storage failure',error?.name);
      return json({error:'No se pudo guardar o consultar la información. Intenta de nuevo.'},503);
    }
  }};
}
