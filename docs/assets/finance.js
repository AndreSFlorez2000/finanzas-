(() => {
"use strict";

const money=new Intl.NumberFormat("es-CO",{style:"currency",currency:"COP",maximumFractionDigits:0});
const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const currentMonth=today.slice(0,7);

const blank={accounts:[],goals:[],budgets:[],movements:[]};
let state=structuredClone(blank);
let committed=structuredClone(blank), revision=0, saving=false, ready=false;
let ui={
  profile:"joint",
  jointFilters:{person:"all",type:"all",account:"all",goal:"all",from:"",to:"",search:""},
  personalFilters:{
    juan:{type:"all",account:"all",link:"all",from:"",to:"",search:""},
    diana:{type:"all",account:"all",link:"all",from:"",to:"",search:""}
  }
};

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const fmt=n=>money.format(Number(n||0));
const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const personName=p=>p==="juan"?"Juan":"Diana";
const uid=p=>p+Date.now().toString(36)+Math.random().toString(36).slice(2,7);

function normalize(s){
  s.accounts=s.accounts||[];
  s.goals=s.goals||[];
  s.budgets=s.budgets||[];
  s.movements=s.movements||[];
  s.movements.forEach(m=>{
    if(m.budgetId===undefined)m.budgetId="";
    if(m.goalId===undefined)m.goalId="";
    if(m.note===undefined)m.note="";
    if(m.concept===undefined)m.concept="";
  });
  return s;
}
function status(message,error=false){
  $("#syncStatus").textContent=message;
  $("#syncStatus").classList.toggle("sync-error",error);
}
async function api(path,options={}){return window.NexoStorage.request(path,options);}
async function loadRemote(notify=false){
  if(saving)return;
  ready=false;
  document.body.classList.add("not-ready");
  status("Cargando tus datos…");
  try{
    const data=await api("/api/state");
    state=normalize(data.state);committed=structuredClone(state);revision=data.revision;
    ready=true;document.body.classList.remove("not-ready");render();
    status(revision?"Guardado en la nube · versión "+revision:"Base de datos lista · comienza creando una cuenta");
    if(notify)toast("Datos actualizados desde la nube");
  }catch(error){status(error.message,true);toast("No se pudieron cargar los datos. Revisa tu conexión y pulsa Actualizar.");}
}
async function save(){
  if(saving||!ready)return false;
  saving=true;document.body.classList.add("is-saving");status("Guardando…");
  try{
    const data=await api("/api/state",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({state,revision})});
    committed=structuredClone(state);revision=data.revision;
    status("Guardado en la nube · versión "+revision);return true;
  }catch(error){
    state=structuredClone(committed);
    status(error.message+" Usa Actualizar antes de volver a intentar.",true);
    toast("El cambio no se confirmó. Revisa el aviso superior.");return false;
  }finally{saving=false;document.body.classList.remove("is-saving");}
}
function download(data,name){
  const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
  const link=document.createElement("a");link.href=url;link.download=name;link.click();toast("Descarga del respaldo iniciada");setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function openHistory(){
  modal("Versiones guardadas",'<p>Cargando versiones…</p>');
  try{
    const data=await api("/api/history");
    $("#modalBody").innerHTML='<p>Cada cambio conserva una copia anterior. Se muestran las últimas 100 versiones.</p>'+ (data.versions.length?data.versions.map(v=>`<div class="version-row"><span>Versión ${v.revision} · ${esc(new Date(v.saved_at).toLocaleString("es-CO",{timeZone:"America/Bogota"}))}</span><button class="btn secondary" data-version="${v.revision}">Descargar</button></div>`).join(""):'<p>Todavía no hay cambios guardados.</p>');
    $$("[data-version]").forEach(button=>button.onclick=async()=>{
      try{download(await api("/api/history/"+button.dataset.version),"nexo-version-"+button.dataset.version+".json");}catch(error){toast(error.message);}
    });
  }catch(error){$("#modalBody").textContent=error.message;}
}
function account(id){return state.accounts.find(a=>a.id===id)}
function goal(id){return state.goals.find(g=>g.id===id)}
function budget(id){return state.budgets.find(b=>b.id===id)}
function sum(arr,fn){return arr.reduce((a,x)=>a+Number(fn(x)||0),0)}
function pct(a,b){return b?Math.max(0,Math.min(100,Math.round(a/b*100))):0}
function accountEffect(m){if(m.type==="expense"||m.type==="deposit")return-m.amount;if(m.type==="income"||m.type==="withdrawal")return m.amount;return 0}
function accountBalance(a,exclude=""){return Number(a.initialBalance||0)+sum(state.movements.filter(m=>m.accountId===a.id&&m.id!==exclude),accountEffect)}
function personBalance(p){return sum(state.accounts.filter(a=>a.person===p),a=>accountBalance(a))}
function goalBalance(id,exclude=""){return sum(state.movements.filter(m=>m.goalId===id&&m.id!==exclude&&(m.type==="deposit"||m.type==="withdrawal")),m=>m.type==="deposit"?m.amount:-m.amount)}
function goalPerson(id,p){return sum(state.movements.filter(m=>m.goalId===id&&m.person===p&&(m.type==="deposit"||m.type==="withdrawal")),m=>m.type==="deposit"?m.amount:-m.amount)}
function totalSaved(){return sum(state.goals,g=>goalBalance(g.id))}
function totalTarget(){return sum(state.goals,g=>g.target)}
function savedByPerson(p){return sum(state.movements.filter(m=>m.person===p&&(m.type==="deposit"||m.type==="withdrawal")),m=>m.type==="deposit"?m.amount:-m.amount)}
function monthlyStats(p){const ms=state.movements.filter(m=>m.person===p&&m.date.slice(0,7)===currentMonth);return{income:sum(ms.filter(m=>m.type==="income"),m=>m.amount),expense:sum(ms.filter(m=>m.type==="expense"),m=>m.amount)}}

function budgetStats(id){
  const b=budget(id);
  if(!b)return{expenses:0,returns:0,used:0,available:0,excess:0,percent:0};
  const list=state.movements.filter(m=>m.budgetId===id&&m.date.slice(0,7)===currentMonth&&(m.type==="expense"||m.type==="income"));
  const expenses=sum(list.filter(m=>m.type==="expense"),m=>m.amount);
  const returns=sum(list.filter(m=>m.type==="income"),m=>m.amount);
  const net=expenses-returns;
  const used=Math.max(0,net);
  const available=Math.max(0,Math.min(b.limit,b.limit-net));
  const excess=Math.max(0,returns-expenses);
  return{expenses,returns,used,available,excess,percent:pct(used,b.limit)};
}

function stat(label,value,note){return `<article class="stat-card"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(note)}</small></article>`}

function render(){
  $$(".profile-tab").forEach(b=>b.classList.toggle("active",b.dataset.profile===ui.profile));
  renderTop();
  ui.profile==="joint"?renderJoint():renderPersonal(ui.profile);
  $$(".filters [data-k]").forEach(el=>el.setAttribute("aria-label",({person:"Persona",type:"Tipo de movimiento",account:"Cuenta",goal:"Meta",link:"Presupuesto o meta",from:"Desde",to:"Hasta",search:"Buscar"})[el.dataset.k]));
  $$(".filter-panel").forEach(el=>{const filters=ui.profile==="joint"?ui.jointFilters:ui.personalFilters[ui.profile];el.open=Object.values(filters).some(value=>value!==""&&value!=="all");});
}

function renderTop(){
  const c=$("#topActions");
  if(ui.profile==="joint"){
    c.innerHTML=`<button class="btn secondary" id="newGoalTop">+ Meta</button><button class="btn primary" id="newSavingTop">+ Aporte</button>`;
    $("#newGoalTop").onclick=()=>openGoal();
    $("#newSavingTop").onclick=()=>openSaving();
  }else{
    c.innerHTML=`<button class="btn secondary" id="newBudgetTop">+ Presupuesto</button><button class="btn secondary" id="newAccountTop">+ Cuenta</button><button class="btn primary" id="newPersonalTop">+ Movimiento</button>`;
    $("#newBudgetTop").onclick=()=>openBudget("",ui.profile);
    $("#newAccountTop").onclick=()=>openAccount("",ui.profile);
    $("#newPersonalTop").onclick=()=>openPersonal("",ui.profile);
  }
}

function renderJoint(){
  $("#view").innerHTML=`
    <section class="hero"><div><span class="eyebrow">Juan + Diana</span><h1>Nuestro ahorro</h1><p>Metas conjuntas, aportes y retiros.</p></div></section>
    <section class="summary-grid">
      ${stat("Ahorro total",fmt(totalSaved()),state.goals.length?`${pct(totalSaved(),totalTarget())}% del objetivo total`:"Sin metas")}
      ${stat("Juan ha aportado",fmt(savedByPerson("juan")),"Aporte neto")}
      ${stat("Diana ha aportado",fmt(savedByPerson("diana")),"Aporte neto")}
      ${stat("Metas activas",String(state.goals.length),"Metas")}
    </section>
    <section class="workspace">
      <article class="panel">
        <div class="panel-header"><div><h2>Histórico de ahorro</h2><p>Aportes y retiros de ambos.</p></div></div>
        ${jointFiltersHtml()}
        <div class="table-wrap"><table>
          <thead><tr><th>Fecha</th><th>Quién</th><th>Tipo</th><th>Meta</th><th>Cuenta</th><th>Valor</th><th>Nota</th><th></th></tr></thead>
          <tbody id="jointBody"></tbody>
        </table></div>
      </article>
      <aside class="panel"><div class="panel-header"><div><h2>Progreso por metas</h2><p>Porcentaje y aporte de cada uno.</p></div></div><div class="goals-list" id="goalsList"></div></aside>
    </section>`;
  bindJointFilters(); renderJointTable(); renderGoals();
}

function jointFiltersHtml(){
  return `<details class="filter-panel"><summary>Buscar y filtrar movimientos</summary><div class="filters">
    <select class="select jf" data-k="person"><option value="all">Todos</option><option value="juan">Juan</option><option value="diana">Diana</option></select>
    <select class="select jf" data-k="type"><option value="all">Aporte y retiro</option><option value="deposit">Aportes</option><option value="withdrawal">Retiros</option></select>
    <select class="select jf" data-k="account"><option value="all">Todas las cuentas</option>${state.accounts.map(a=>`<option value="${a.id}">${personName(a.person)} · ${esc(a.name)}</option>`).join("")}</select>
    <select class="select jf" data-k="goal"><option value="all">Todas las metas</option>${state.goals.map(g=>`<option value="${g.id}">${esc(g.name)}</option>`).join("")}</select>
    <input class="input jf" data-k="from" type="date" title="Desde">
    <input class="input jf" data-k="to" type="date" title="Hasta">
    <input class="input jf filter-search" data-k="search" placeholder="Buscar nota...">
  </div></details>`;
}
function bindJointFilters(){
  $$(".jf").forEach(el=>{const k=el.dataset.k;el.value=ui.jointFilters[k]||"";el.oninput=()=>{ui.jointFilters[k]=el.value;renderJointTable()}});
}
function filteredJoint(){
  const f=ui.jointFilters;
  return state.movements.filter(m=>m.type==="deposit"||m.type==="withdrawal").filter(m=>{
    if(f.person!=="all"&&m.person!==f.person)return false;
    if(f.type!=="all"&&m.type!==f.type)return false;
    if(f.account!=="all"&&m.accountId!==f.account)return false;
    if(f.goal!=="all"&&m.goalId!==f.goal)return false;
    if(f.from&&m.date<f.from)return false;if(f.to&&m.date>f.to)return false;
    if(f.search&&!`${m.note||""} ${goal(m.goalId)?.name||""} ${account(m.accountId)?.name||""}`.toLowerCase().includes(f.search.toLowerCase()))return false;
    return true;
  }).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
}
function renderJointTable(){
  const list=filteredJoint();
  $("#jointBody").innerHTML=list.length?list.map(m=>`<tr>
    <td>${esc(m.date)}</td><td><span class="pill ${m.person}">${personName(m.person)}</span></td>
    <td><span class="pill ${m.type}">${m.type==="deposit"?"Aporte":"Retiro"}</span></td>
    <td>${esc(goal(m.goalId)?.name||"—")}</td><td>${esc(account(m.accountId)?.name||"—")}</td>
    <td class="amount ${m.type}">${m.type==="deposit"?"+":"−"} ${fmt(m.amount)}</td><td>${esc(m.note||"")}</td>
    <td><div class="row-actions"><button class="icon-action edit" data-edit-saving="${m.id}">Editar</button><button class="icon-action delete" data-del="${m.id}">Eliminar</button></div></td>
  </tr>`).join(""):`<tr class="empty-row"><td colspan="8">No hay movimientos con estos filtros.</td></tr>`;
  $$("[data-edit-saving]").forEach(b=>b.onclick=()=>openSaving(b.dataset.editSaving));
  labelMovementCards();
  $$("[data-del]").forEach(b=>b.onclick=()=>delMovement(b.dataset.del));
}

function labelMovementCards(){
  $$(".table-wrap table").forEach(table=>{const labels=[...table.querySelectorAll("th")].map(th=>th.textContent);table.querySelectorAll("tbody tr:not(.empty-row)").forEach(row=>[...row.children].forEach((cell,i)=>cell.dataset.label=labels[i]||"Acciones"));});
}

function renderGoals(){
  const c=$("#goalsList");
  if(!state.goals.length){c.innerHTML=`<div class="empty-card"><strong>Sin metas</strong>Crea la primera meta.</div>`;return}
  c.innerHTML=state.goals.map(g=>{const s=goalBalance(g.id),p=pct(s,g.target);return `<article class="goal-card">
    <div class="goal-head"><div><h3>${esc(g.name)}</h3><div class="goal-target">Objetivo ${fmt(g.target)}</div></div><span class="pill">${p}%</span></div>
    <div class="goal-main"><div class="ring" style="--p:${p}"><strong>${p}%</strong></div><div><div class="goal-saved">${fmt(s)}</div><div class="goal-left">Faltan ${fmt(Math.max(0,g.target-s))}</div>
    <div class="person-split"><div class="person-mini"><span>Juan</span><strong>${fmt(goalPerson(g.id,"juan"))}</strong></div><div class="person-mini"><span>Diana</span><strong>${fmt(goalPerson(g.id,"diana"))}</strong></div></div></div></div>
    <div class="goal-actions"><button class="btn purple" data-add-goal="${g.id}">+ Aportar</button><button class="btn ghost" data-with-goal="${g.id}">Retirar</button><button class="btn ghost" data-edit-goal="${g.id}">Editar</button><button class="btn danger" data-del-goal="${g.id}">Eliminar</button></div>
  </article>`}).join("");
  $$("[data-add-goal]").forEach(b=>b.onclick=()=>openSaving("",{goalId:b.dataset.addGoal,type:"deposit"}));
  $$("[data-with-goal]").forEach(b=>b.onclick=()=>openSaving("",{goalId:b.dataset.withGoal,type:"withdrawal"}));
  $$("[data-edit-goal]").forEach(b=>b.onclick=()=>openGoal(b.dataset.editGoal));
  $$("[data-del-goal]").forEach(b=>b.onclick=()=>delGoal(b.dataset.delGoal));
}

function renderPersonal(p){
  const stats=monthlyStats(p);
  $("#view").innerHTML=`
    <section class="hero"><div><span class="eyebrow">Perfil personal</span><h1>${personName(p)}</h1><p>Cuentas, presupuestos e histórico completo.</p></div></section>
    <section class="summary-grid">
      ${stat("Dinero disponible",fmt(personBalance(p)),`${state.accounts.filter(a=>a.person===p).length} cuentas`)}
      ${stat("Ingresos del mes",fmt(stats.income),currentMonth)}
      ${stat("Gastos del mes",fmt(stats.expense),currentMonth)}
      ${stat("Aportado a metas",fmt(savedByPerson(p)),"Aporte neto")}
    </section>

    <section class="panel" style="margin-bottom:15px">
      <div class="panel-header"><div><h2>Presupuestos personales</h2><p>Un presupuesto puede tener gastos y reintegros/ganancias.</p></div><button class="btn secondary" id="addBudgetBtn">+ Presupuesto</button></div>
      <div class="budgets-grid" id="budgetsGrid"></div>
    </section>

    <section class="personal-layout">
      <article class="panel">
        <div class="panel-header"><div><h2>Histórico completo</h2><p>Ingresos, gastos, aportes y retiros de ahorro.</p></div><button class="btn primary" id="addPersonalBtn">+ Movimiento</button></div>
        ${personalFiltersHtml(p)}
        <div class="table-wrap"><table>
          <thead><tr><th>Fecha</th><th>Tipo</th><th>Concepto / Meta</th><th>Presupuesto</th><th>Cuenta</th><th>Valor</th><th></th></tr></thead>
          <tbody id="personalBody"></tbody>
        </table></div>
      </article>
      <aside class="panel">
        <div class="panel-header"><div><h2>Mis cuentas</h2><p>Saldo actual.</p></div><button class="btn secondary" id="addAccountBtn">+ Cuenta</button></div>
        <div class="accounts-grid" id="accountsGrid"></div>
      </aside>
    </section>`;
  $("#addBudgetBtn").onclick=()=>openBudget("",p);
  $("#addPersonalBtn").onclick=()=>openPersonal("",p);
  $("#addAccountBtn").onclick=()=>openAccount("",p);
  renderBudgets(p);bindPersonalFilters(p);renderPersonalTable(p);renderAccounts(p);
}

function personalFiltersHtml(p){
  const f=ui.personalFilters[p];
  return `<details class="filter-panel"><summary>Buscar y filtrar movimientos</summary><div class="filters">
    <select class="select pf" data-k="type"><option value="all">Todos los tipos</option><option value="expense">Gastos</option><option value="income">Ingresos</option><option value="deposit">Aportes ahorro</option><option value="withdrawal">Retiros ahorro</option></select>
    <select class="select pf" data-k="account"><option value="all">Todas las cuentas</option>${state.accounts.filter(a=>a.person===p).map(a=>`<option value="${a.id}">${esc(a.name)}</option>`).join("")}</select>
    <select class="select pf" data-k="link"><option value="all">Presupuesto / meta</option>${state.budgets.filter(b=>b.person===p).map(b=>`<option value="b:${b.id}">Presupuesto: ${esc(b.name)}</option>`).join("")}${state.goals.map(g=>`<option value="g:${g.id}">Meta: ${esc(g.name)}</option>`).join("")}</select>
    <input class="input pf" data-k="from" type="date" title="Desde">
    <input class="input pf" data-k="to" type="date" title="Hasta">
    <input class="input pf filter-search" data-k="search" placeholder="Buscar concepto o nota...">
  </div></details>`;
}
function bindPersonalFilters(p){
  $$(".pf").forEach(el=>{const k=el.dataset.k;el.value=ui.personalFilters[p][k]||"";el.oninput=()=>{ui.personalFilters[p][k]=el.value;renderPersonalTable(p)}});
}
function filteredPersonal(p){
  const f=ui.personalFilters[p];
  return state.movements.filter(m=>m.person===p).filter(m=>{
    if(f.type!=="all"&&m.type!==f.type)return false;
    if(f.account!=="all"&&m.accountId!==f.account)return false;
    if(f.link!=="all"){
      const [kind,id]=f.link.split(":");
      if(kind==="b"&&m.budgetId!==id)return false;
      if(kind==="g"&&m.goalId!==id)return false;
    }
    if(f.from&&m.date<f.from)return false;if(f.to&&m.date>f.to)return false;
    if(f.search&&!`${m.concept||""} ${m.note||""} ${budget(m.budgetId)?.name||""} ${goal(m.goalId)?.name||""}`.toLowerCase().includes(f.search.toLowerCase()))return false;
    return true;
  }).sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id));
}

function renderBudgets(p){
  const list=state.budgets.filter(b=>b.person===p),c=$("#budgetsGrid");
  if(!list.length){c.innerHTML=`<div class="empty-card"><strong>Sin presupuestos</strong>Crea uno para controlar una actividad.</div>`;return}
  c.innerHTML=list.map(b=>{const s=budgetStats(b.id);return `<article class="budget-card">
    <h3>${esc(b.name)}</h3><div class="budget-meta"><span>${s.percent}% utilizado</span><span>${currentMonth}</span></div>
    <div class="bar"><i style="width:${Math.min(100,s.percent)}%;background:${s.percent>=100?"var(--red)":s.percent>=80?"var(--amber)":"var(--blue)"}"></i></div>
    <div class="budget-values">
      <div><span>Tope</span><strong>${fmt(b.limit)}</strong></div><div><span>Disponible</span><strong>${fmt(s.available)}</strong></div>
      <div><span>Gastos</span><strong>${fmt(s.expenses)}</strong></div><div><span>Reintegros</span><strong>${fmt(s.returns)}</strong></div>
    </div>
    ${s.excess>0?`<div class="budget-excess">+ ${fmt(s.excess)} de ganancia neta quedó en tus cuentas.</div>`:""}
    <div class="budget-actions"><button class="btn ghost" data-edit-budget="${b.id}">Editar</button><button class="btn danger" data-del-budget="${b.id}">Eliminar</button></div>
  </article>`}).join("");
  $$("[data-edit-budget]").forEach(x=>x.onclick=()=>openBudget(x.dataset.editBudget,p));
  $$("[data-del-budget]").forEach(x=>x.onclick=()=>delBudget(x.dataset.delBudget));
}

function renderPersonalTable(p){
  const list=filteredPersonal(p),body=$("#personalBody");
  body.innerHTML=list.length?list.map(m=>{
    const isSaving=m.type==="deposit"||m.type==="withdrawal";
    const title=isSaving?(goal(m.goalId)?.name||"Meta"):(m.concept||"");
    const link=isSaving?"—":(m.budgetId?budget(m.budgetId)?.name||"—":"—");
    return `<tr>
      <td>${esc(m.date)}</td><td><span class="pill ${m.type}">${{income:"Ingreso",expense:"Gasto",deposit:"Aporte ahorro",withdrawal:"Retiro ahorro"}[m.type]}</span></td>
      <td>${esc(title)}</td><td>${esc(link)}</td><td>${esc(account(m.accountId)?.name||"—")}</td>
      <td class="amount ${m.type}">${m.type==="income"||m.type==="withdrawal"?"+":"−"} ${fmt(m.amount)}</td>
      <td><div class="row-actions"><button class="icon-action edit" data-edit-m="${m.id}">Editar</button><button class="icon-action delete" data-del="${m.id}">Eliminar</button></div></td>
    </tr>`;
  }).join(""):`<tr class="empty-row"><td colspan="7">No hay movimientos con estos filtros.</td></tr>`;
  $$("[data-edit-m]").forEach(b=>b.onclick=()=>{const m=state.movements.find(x=>x.id===b.dataset.editM);(m.type==="deposit"||m.type==="withdrawal")?openSaving(m.id):openPersonal(m.id,p)});
  labelMovementCards();
  $$("[data-del]").forEach(b=>b.onclick=()=>delMovement(b.dataset.del));
}

function renderAccounts(p){
  const list=state.accounts.filter(a=>a.person===p),c=$("#accountsGrid");
  if(!list.length){c.innerHTML=`<div class="empty-card"><strong>Sin cuentas</strong>Agrega una cuenta.</div>`;return}
  c.innerHTML=list.map(a=>`<article class="account-card"><span class="owner">${esc(a.type)}</span><h3>${esc(a.name)}</h3><strong>${fmt(accountBalance(a))}</strong><small>Inicial: ${fmt(a.initialBalance)}</small><div class="account-actions"><button class="btn ghost" data-edit-account="${a.id}">Editar</button><button class="btn danger" data-del-account="${a.id}">Eliminar</button></div></article>`).join("");
  $$("[data-edit-account]").forEach(b=>b.onclick=()=>openAccount(b.dataset.editAccount,p));
  $$("[data-del-account]").forEach(b=>b.onclick=()=>delAccount(b.dataset.delAccount));
}

let modalOpener;
function modal(title,html){modalOpener=document.activeElement;document.body.classList.add("modal-open");$("#modalTitle").textContent=title;$("#modalBody").innerHTML=html;$("#modalBackdrop").classList.remove("hidden");$$("#modalBody .field").forEach(field=>{const label=field.querySelector("label"),input=field.querySelector("input,select,textarea");if(label&&input?.id)label.htmlFor=input.id;});$("#modalClose").focus()}
function close(){if(saving)return;$("#modalBackdrop").classList.add("hidden");document.body.classList.remove("modal-open");if(modalOpener?.isConnected)modalOpener.focus()}

function openGoal(id=""){
  const g=goal(id)||{name:"",target:""};
  modal(id?"Editar meta":"Nueva meta",`<form id="goalForm"><div class="form-grid"><div class="field span2"><label>Nombre</label><input class="input" id="gName" value="${esc(g.name)}" required></div><div class="field span2"><label>Objetivo</label><input class="input" id="gTarget" type="number" min="1" step="1" value="${g.target||""}" required></div></div><div class="form-actions"><button type="button" class="btn ghost" id="cancel">Cancelar</button><button class="btn primary">Guardar</button></div></form>`);
  $("#cancel").onclick=close;$("#goalForm").onsubmit=async e=>{e.preventDefault();const o={name:$("#gName").value.trim(),target:Number($("#gTarget").value)};if(id)Object.assign(g,o);else state.goals.push({id:uid("g_"),...o});if(!await save())return;close();render();toast("Meta guardada")}
}
async function delGoal(id){if(state.movements.some(m=>m.goalId===id))return toast("La meta tiene movimientos");if(confirm("¿Eliminar meta?")){state.goals=state.goals.filter(g=>g.id!==id);if(!await save())return;render();toast("Eliminado. Cambio guardado en la nube")}}

function openAccount(id="",p="juan"){
  const a=account(id)||{person:p,type:"Cuenta bancaria",name:"",initialBalance:0};
  modal(id?"Editar cuenta":"Nueva cuenta",`<form id="accForm"><div class="form-grid"><div class="field"><label>Tipo</label><select class="select" id="aType">${["Cuenta bancaria","Billetera digital","Efectivo","Otra"].map(x=>`<option ${a.type===x?"selected":""}>${x}</option>`).join("")}</select></div><div class="field"><label>Nombre</label><input class="input" id="aName" value="${esc(a.name)}" required></div><div class="field span2"><label>Saldo inicial</label><input class="input" id="aInitial" min="0" type="number" step="1" value="${a.initialBalance||0}" required></div></div><div class="note">El saldo se actualiza con ingresos, gastos y ahorro.</div><div class="form-actions"><button type="button" class="btn ghost" id="cancel">Cancelar</button><button class="btn primary">Guardar</button></div></form>`);
  $("#cancel").onclick=close;$("#accForm").onsubmit=async e=>{e.preventDefault();const o={person:p,type:$("#aType").value,name:$("#aName").value.trim(),initialBalance:Number($("#aInitial").value||0)};if(id)Object.assign(a,o);else state.accounts.push({id:uid("a_"),...o});if(!await save())return;close();render();toast("Cuenta guardada")}
}
async function delAccount(id){if(state.movements.some(m=>m.accountId===id))return toast("La cuenta tiene movimientos");if(confirm("¿Eliminar cuenta?")){state.accounts=state.accounts.filter(a=>a.id!==id);if(!await save())return;render();toast("Eliminado. Cambio guardado en la nube")}}

function openBudget(id="",p="juan"){
  const b=budget(id)||{person:p,name:"",limit:""};
  modal(id?"Editar presupuesto":"Nuevo presupuesto",`<form id="budgetForm"><div class="form-grid"><div class="field span2"><label>Nombre</label><input class="input" id="bName" value="${esc(b.name)}" placeholder="Ej. Póker" required></div><div class="field span2"><label>Tope mensual</label><input class="input" id="bLimit" type="number" min="1" step="1" value="${b.limit||""}" required></div></div><div class="note">Los gastos consumen presupuesto. Los ingresos vinculados lo reintegran; si superan lo gastado, el excedente queda en tu cuenta.</div><div class="form-actions"><button type="button" class="btn ghost" id="cancel">Cancelar</button><button class="btn primary">Guardar</button></div></form>`);
  $("#cancel").onclick=close;$("#budgetForm").onsubmit=async e=>{e.preventDefault();const o={person:p,name:$("#bName").value.trim(),limit:Number($("#bLimit").value)};if(id)Object.assign(b,o);else state.budgets.push({id:uid("b_"),...o});if(!await save())return;close();render();toast("Presupuesto guardado")}
}
async function delBudget(id){if(state.movements.some(m=>m.budgetId===id))return toast("El presupuesto tiene movimientos asociados");if(confirm("¿Eliminar presupuesto?")){state.budgets=state.budgets.filter(b=>b.id!==id);if(!await save())return;render();toast("Eliminado. Cambio guardado en la nube")}}

function openPersonal(id="",p="juan"){
  if(!state.accounts.some(a=>a.person===p))return toast("Primero crea una cuenta");
  const m=state.movements.find(x=>x.id===id)||{person:p,type:"expense",accountId:"",amount:"",date:today,concept:"",budgetId:"",note:""};
  const budgets=state.budgets.filter(b=>b.person===p);
  modal(id?"Editar movimiento":"Nuevo movimiento",`<form id="personalForm"><div class="form-grid">
    <div class="field"><label>Tipo</label><select class="select" id="pType"><option value="expense" ${m.type==="expense"?"selected":""}>Gasto</option><option value="income" ${m.type==="income"?"selected":""}>Ingreso / reintegro</option></select></div>
    <div class="field"><label>Cuenta</label><select class="select" id="pAccount">${state.accounts.filter(a=>a.person===p).map(a=>`<option value="${a.id}" ${m.accountId===a.id?"selected":""}>${esc(a.name)} · ${fmt(accountBalance(a,id))}</option>`).join("")}</select></div>
    <div class="field span2"><label>Concepto</label><input class="input" id="pConcept" value="${esc(m.concept||"")}" placeholder="Ej. Entrada torneo / premio / mercado" required></div>
    <div class="field"><label>Presupuesto asociado</label><select class="select" id="pBudget"><option value="">Sin presupuesto</option>${budgets.map(b=>`<option value="${b.id}" ${m.budgetId===b.id?"selected":""}>${esc(b.name)}</option>`).join("")}</select></div>
    <div class="field"><label>Valor</label><input class="input" id="pAmount" type="number" min="1" step="1" value="${m.amount||""}" required></div>
    <div class="field"><label>Fecha</label><input class="input" id="pDate" type="date" value="${m.date||today}" required></div>
    <div class="field"><label>Nota</label><input class="input" id="pNote" value="${esc(m.note||"")}" placeholder="Opcional"></div>
  </div><div class="note" id="personalHelp"></div><div class="form-actions"><button type="button" class="btn ghost" id="cancel">Cancelar</button><button class="btn primary">Guardar</button></div></form>`);
  const type=$("#pType"),bud=$("#pBudget");
  function helper(){
    $("#personalHelp").innerHTML=type.value==="expense"
      ?"El gasto baja la cuenta y, si eliges presupuesto, consume su disponible."
      :"El ingreso sube la cuenta. Si lo vinculas a un presupuesto, reintegra primero lo gastado; cualquier excedente queda en tu cuenta.";
  } helper();type.onchange=helper;
  $("#cancel").onclick=close;$("#personalForm").onsubmit=async e=>{e.preventDefault();const acc=account($("#pAccount").value),amount=Number($("#pAmount").value),typev=type.value;if(typev==="expense"&&accountBalance(acc,id)<amount)return toast("Saldo insuficiente");const o={person:p,type:typev,accountId:acc.id,amount,date:$("#pDate").value,concept:$("#pConcept").value.trim(),budgetId:bud.value,goalId:"",note:$("#pNote").value.trim()};if(id)Object.assign(m,o);else state.movements.push({id:uid("m_"),...o});if(!await save())return;close();render();toast("Movimiento guardado")}
}

function openSaving(id="",pref={}){
  if(!state.goals.length)return toast("Primero crea una meta");
  if(!state.accounts.length)return toast("Primero crea una cuenta en Juan o Diana");
  const m=state.movements.find(x=>x.id===id)||{type:pref.type||"deposit",person:"juan",goalId:pref.goalId||state.goals[0].id,accountId:"",amount:"",date:today,note:""};
  modal(id?"Editar ahorro":"Movimiento de ahorro",`<form id="savingForm"><div class="form-grid">
    <div class="field"><label>Tipo</label><select class="select" id="sType"><option value="deposit" ${m.type==="deposit"?"selected":""}>Aporte</option><option value="withdrawal" ${m.type==="withdrawal"?"selected":""}>Retiro</option></select></div>
    <div class="field"><label>Quién</label><select class="select" id="sPerson"><option value="juan" ${m.person==="juan"?"selected":""}>Juan</option><option value="diana" ${m.person==="diana"?"selected":""}>Diana</option></select></div>
    <div class="field"><label>Meta</label><select class="select" id="sGoal">${state.goals.map(g=>`<option value="${g.id}" ${m.goalId===g.id?"selected":""}>${esc(g.name)}</option>`).join("")}</select></div>
    <div class="field"><label>Cuenta</label><select class="select" id="sAccount"></select></div>
    <div class="field"><label>Valor</label><input class="input" id="sAmount" type="number" min="1" step="1" value="${m.amount||""}" required></div>
    <div class="field"><label>Fecha</label><input class="input" id="sDate" type="date" value="${m.date||today}" required></div>
    <div class="field span2"><label>Nota</label><textarea class="textarea" id="sNote">${esc(m.note||"")}</textarea></div>
  </div><div class="form-actions"><button type="button" class="btn ghost" id="cancel">Cancelar</button><button class="btn primary">Guardar</button></div></form>`);
  const per=$("#sPerson"),acc=$("#sAccount");
  function sync(){const list=state.accounts.filter(a=>a.person===per.value);acc.innerHTML=list.length?list.map(a=>`<option value="${a.id}" ${m.accountId===a.id?"selected":""}>${esc(a.name)} · ${fmt(accountBalance(a,id))}</option>`).join(""):`<option value="">Sin cuentas</option>`} sync();per.onchange=sync;
  $("#cancel").onclick=close;$("#savingForm").onsubmit=async e=>{e.preventDefault();const a=account(acc.value),g=goal($("#sGoal").value),amount=Number($("#sAmount").value),type=$("#sType").value;if(!a)return toast("Selecciona una cuenta");if(type==="deposit"&&accountBalance(a,id)<amount)return toast("Saldo insuficiente");if(type==="withdrawal"&&goalBalance(g.id,id)<amount)return toast("La meta no tiene suficiente dinero");const o={type,person:per.value,goalId:g.id,accountId:a.id,amount,date:$("#sDate").value,note:$("#sNote").value.trim(),concept:"",budgetId:""};if(id)Object.assign(m,o);else state.movements.push({id:uid("m_"),...o});if(!await save())return;close();render();toast("Movimiento guardado")}
}

async function delMovement(id){if(confirm("¿Eliminar movimiento?")){state.movements=state.movements.filter(m=>m.id!==id);if(!await save())return;render();toast("Eliminado. Cambio guardado en la nube")}}
function toast(t){const e=$("#toast");e.textContent=t;e.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove("show"),5500)}

$$(".profile-tab").forEach(b=>b.onclick=()=>{ui.profile=b.dataset.profile;render();toast("Espacio de "+b.textContent.trim())});
document.addEventListener("keydown",e=>{if($("#modalBackdrop").classList.contains("hidden"))return;if(e.key==="Escape"){e.preventDefault();close();}if(e.key==="Tab"){const nodes=$$(".modal button,.modal input,.modal select,.modal textarea,.modal a[href]").filter(el=>!el.disabled&&el.getClientRects().length);const first=nodes[0],last=nodes.at(-1);if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}});
$("#modalClose").onclick=close;$("#modalBackdrop").onclick=e=>{if(e.target.id==="modalBackdrop")close()};
document.addEventListener("click",e=>{if(saving){e.preventDefault();e.stopImmediatePropagation();}},true);
document.addEventListener("submit",e=>{if(saving){e.preventDefault();e.stopImmediatePropagation();}},true);
window.addEventListener("beforeunload",e=>{if(saving){e.preventDefault();e.returnValue="";}});
$("#refreshData").onclick=()=>{close();loadRemote(true);};
$("#showHistory").onclick=openHistory;
$("#exportData").onclick=()=>download({state:committed,revision},"nexo-respaldo-"+today+".json");
loadRemote();
})();
