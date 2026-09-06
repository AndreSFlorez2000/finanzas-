import {validateLedger} from '../server/validation.mjs';
export function storageFor(client){
  return {async request(path,options={}){
    const {data:auth,error:authError}=await client.auth.getSession();
    if(authError||!auth.session)throw new Error('Tu sesión terminó. Vuelve a iniciar sesión.');
    const user=auth.session.user.id;
    if(path==='/api/state'&&options.method==='PUT'){
      const body=JSON.parse(options.body);const state=validateLedger(body.state);
      const {data,error}=await client.rpc('save_nexo',{p_state:state,p_revision:body.revision});
      if(error)throw new Error(error.message);return data;
    }
    if(path==='/api/state'){
      const {data,error}=await client.from('nexo_ledgers').select('payload,revision,updated_at').eq('user_id',user).maybeSingle();
      if(error)throw new Error(error.message);
      return {state:data?.payload??{accounts:[],goals:[],budgets:[],movements:[]},revision:data?.revision??0,updatedAt:data?.updated_at??null};
    }
    if(path==='/api/history'){
      const {data,error}=await client.from('nexo_history').select('revision,saved_at').eq('user_id',user).order('revision',{ascending:false}).limit(100);
      if(error)throw new Error(error.message);return {versions:data};
    }
    if(/^\/api\/history\/\d+$/.test(path)){
      const {data,error}=await client.from('nexo_history').select('payload,revision,saved_at').eq('user_id',user).eq('revision',Number(path.split('/').pop())).single();
      if(error)throw new Error('No se pudo consultar esta versión.');return {state:data.payload,revision:data.revision,updatedAt:data.saved_at};
    }
    throw new Error('Operación no disponible.');
  }};
}
