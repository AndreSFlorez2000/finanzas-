import { DatabaseSync } from 'node:sqlite';
import { readdirSync,readFileSync } from 'node:fs';
export function localDatabase(filename=':memory:') {
  const db=new DatabaseSync(filename);
  for(const file of readdirSync(new URL('../drizzle/',import.meta.url)).filter(f=>f.endsWith('.sql')).sort()) {
    db.exec(readFileSync(new URL('../drizzle/'+file,import.meta.url),'utf8'));
  }
  return {
    raw:db,
    prepare(sql){return {bind(...args){const run=()=>({meta:{changes:Number(db.prepare(sql).run(...args).changes)}});return {
      run,first:async()=>db.prepare(sql).get(...args)??null,all:async()=>({results:db.prepare(sql).all(...args)})
    }}};},
    async batch(statements){db.exec('BEGIN');try{const result=statements.map(s=>s.run());db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}
  };
}
