export const emptyLedger = () => ({ accounts: [], goals: [], budgets: [], movements: [] });
const fail = message => { throw new Error(message); };
const str = (value, name, max = 200, optional = false) => {
  if (typeof value !== 'string' || value.length > max || (!optional && !value.trim())) fail(`${name}: texto inválido.`);
  return value.trim();
};
const id = value => { if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) fail('Identificador inválido.'); return value; };
const amount = (value, name, allowZero = false) => {
  if (!Number.isSafeInteger(value) || value < (allowZero ? 0 : 1) || value > 1e12) fail(`${name}: usa un valor entero válido en pesos.`);
  return value;
};
const person = value => { if (!['juan', 'diana'].includes(value)) fail('Persona inválida.'); return value; };
export function validateLedger(input) {
  if (!input || typeof input !== 'object') fail('Datos inválidos.');
  for (const key of ['accounts','goals','budgets','movements']) {
    if (!Array.isArray(input[key]) || input[key].length > (key === 'movements' ? 10000 : 500)) fail('Demasiados registros o formato inválido.');
    const ids = input[key].map(x => id(x?.id));
    if (new Set(ids).size !== ids.length) fail('Hay registros duplicados.');
  }
  const state = {
    accounts: input.accounts.map(a => ({id:id(a.id), person:person(a.person), name:str(a.name,'Nombre'), type:str(a.type,'Tipo'), initialBalance:amount(a.initialBalance,'Saldo inicial',true)})),
    goals: input.goals.map(g => ({id:id(g.id), name:str(g.name,'Nombre'), target:amount(g.target,'Objetivo')})),
    budgets: input.budgets.map(b => ({id:id(b.id), person:person(b.person), name:str(b.name,'Nombre'), limit:amount(b.limit,'Tope')})),
    movements: []
  };
  const accounts = new Map(state.accounts.map(a => [a.id,a]));
  const goals = new Map(state.goals.map(g => [g.id,g]));
  const budgets = new Map(state.budgets.map(b => [b.id,b]));
  const balances = new Map(state.accounts.map(a => [a.id,a.initialBalance]));
  const savings = new Map(state.goals.map(g => [g.id,0]));
  state.movements = input.movements.map(m => {
    if (!['income','expense','deposit','withdrawal'].includes(m.type)) fail('Tipo de movimiento inválido.');
    const a=accounts.get(m.accountId);
    if (!a || a.person !== m.person) fail('La cuenta no corresponde a la persona.');
    const saving = ['deposit','withdrawal'].includes(m.type);
    const value=amount(m.amount,'Valor');
    if (saving && (!goals.has(m.goalId) || m.budgetId)) fail('Selecciona una meta válida.');
    if (!saving && (m.goalId || (m.budgetId && budgets.get(m.budgetId)?.person !== m.person))) fail('Presupuesto inválido.');
    if (typeof m.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(m.date) || !Number.isFinite(Date.parse(m.date)) || new Date(m.date).toISOString().slice(0,10) !== m.date) fail('Fecha inválida.');
    balances.set(a.id, balances.get(a.id) + (['income','withdrawal'].includes(m.type) ? value : -value));
    if(saving) savings.set(m.goalId, savings.get(m.goalId) + (m.type === 'deposit' ? value : -value));
    return {id:id(m.id),person:person(m.person),type:m.type,accountId:a.id,amount:value,date:m.date,
      concept:str(m.concept ?? '', 'Concepto', 300, saving), note:str(m.note ?? '', 'Nota', 2000,true),
      goalId:saving?m.goalId:'',budgetId:!saving?(m.budgetId||''):''};
  });
  for (const balance of balances.values()) if (!Number.isSafeInteger(balance) || balance < 0) fail('Este cambio dejaría una cuenta sin saldo suficiente.');
  for (const balance of savings.values()) if (!Number.isSafeInteger(balance) || balance < 0) fail('Este cambio dejaría una meta con saldo negativo.');
  return state;
}
