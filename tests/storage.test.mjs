import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorker} from '../server/worker.mjs';
import {emptyLedger,validateLedger} from '../server/validation.mjs';
import {localDatabase} from '../scripts/sqlite-local.mjs';
const app=createWorker({'/index.html':{body:'NEXO',type:'text/html'}});
function fixture(){
  const state=emptyLedger();
  state.accounts.push({id:'a1',person:'juan',name:'Bancolombia',type:'Cuenta bancaria',initialBalance:1000000});
  state.budgets.push({id:'b1',person:'juan',name:'Póker',limit:200000});
  state.goals.push({id:'g1',name:'Viaje',target:1000000});
  return state;
}
function movement(id,type,amount){return {id,type,amount,person:'juan',accountId:'a1',date:'2026-09-06',concept:['income','expense'].includes(type)?'Movimiento':'',note:'',budgetId:['income','expense'].includes(type)?'b1':'',goalId:['deposit','withdrawal'].includes(type)?'g1':''};}
const call=(db,path='/api/state',method='GET',data,owner='owner-1',origin='https://nexo.test')=>app.fetch(new Request('https://nexo.test'+path,{method,headers:{...(owner?{'oai-authenticated-user-id':owner}:{}),'Origin':origin,'Content-Type':'application/json'},...(data?{body:JSON.stringify(data)}:{})}),{DB:db});
test('empty database, durable writes, isolation, concurrency and immutable history',async()=>{
  const db=localDatabase();
  assert.deepEqual((await (await call(db)).json()).state,emptyLedger());
  assert.equal((await call(db,'/api/state','GET',null,null)).status,401);
  let state=fixture();
  assert.equal((await call(db,'/api/state','PUT',{state,revision:0})).status,200);
  state.movements.push(movement('m1','expense',200000),movement('m2','income',300000),movement('m3','deposit',100000),movement('m4','withdrawal',40000));
  assert.equal((await call(db,'/api/state','PUT',{state,revision:1})).status,200);
  // A fresh handler reads persisted data, independent of the original request.
  assert.deepEqual((await (await call(db)).json()).state,state);
  assert.deepEqual((await (await call(db,'/api/state','GET',null,'other-owner')).json()).state,emptyLedger());
  assert.equal((await call(db,'/api/state','PUT',{state:fixture(),revision:1})).status,409);
  assert.equal((await (await call(db)).json()).revision,2);
  assert.equal((await (await call(db,'/api/history')).json()).versions.length,2);
  assert.deepEqual((await (await call(db,'/api/history/1')).json()).state,fixture());
  assert.equal((await call(db,'/api/history/1','GET',null,'other-owner')).status,404);
  assert.equal((await call(db,'/api/state','PUT',{state,revision:2},'owner-1','https://evil.test')).status,403);
  db.raw.close();
});
test('edits and deletions cannot leave orphan records or negative balances',()=>{
  let state=fixture();state.movements=[movement('m1','deposit',100000),movement('m2','withdrawal',40000)];
  validateLedger(state);
  state.movements[0].amount=20000;assert.throws(()=>validateLedger(state),/negativo/);
  state.movements=[movement('m1','expense',1000001)];assert.throws(()=>validateLedger(state),/saldo/);
  state.movements=[movement('m1','expense',1000)];state.accounts=[];assert.throws(()=>validateLedger(state),/cuenta/);
});
test('server rejects invalid data without changing the ledger',async()=>{
  const db=localDatabase();let state=fixture();
  await call(db,'/api/state','PUT',{state,revision:0});
  state.movements=[movement('m1','expense',-5)];
  assert.equal((await call(db,'/api/state','PUT',{state,revision:1})).status,400);
  assert.equal((await (await call(db)).json()).revision,1);
  state=fixture();state.accounts[0].id='\" onclick=evil';assert.throws(()=>validateLedger(state),/Identificador/);
  state=fixture();state.movements=[{...movement('m1','expense',5),date:'2026-02-30'}];assert.throws(()=>validateLedger(state),/Fecha/);
  db.raw.close();
});
