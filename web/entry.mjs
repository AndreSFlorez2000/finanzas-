import {createClient} from '@supabase/supabase-js';
import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './config.js';
import {storageFor} from './storage.mjs';
const $=id=>document.getElementById(id);
const baseUrl=new URL('./',location.href).href;
const notice=(text,error=false)=>{$('authMessage').textContent=text;$('authMessage').classList.toggle('sync-error',error);};
let mode='login',client,loaded=false,currentUser=null,recovery=location.hash.includes('type=recovery');
function setMode(next){
  mode=next;$('authForm').reset();notice('');
  $('authTitle').textContent={login:'Bienvenido a NEXO',signup:'Crea tu cuenta',reset:'Recupera tu acceso',password:'Elige una contraseña nueva'}[mode];
  $('emailField').hidden=mode==='password';$('passwordField').hidden=mode==='reset';
  $('authEmail').required=mode!=='password';$('authPassword').required=mode!=='reset';
  $('authPassword').autocomplete=mode==='login'?'current-password':'new-password';
  $('authPassword').minLength=mode==='login'?1:8;
  $('authSubmit').textContent={login:'Entrar',signup:'Crear cuenta',reset:'Enviar enlace',password:'Guardar contraseña'}[mode];
  $('authSwitch').textContent=mode==='login'?'Crear una cuenta':'Volver a iniciar sesión';
  $('authSwitch').hidden=mode==='password';$('forgotPassword').hidden=mode!=='login';
}
function friendly(error){
  const m=error?.message||'';
  if(/Invalid login credentials/i.test(m))return 'Correo o contraseña incorrectos.';
  if(/Email not confirmed/i.test(m))return 'Confirma tu correo desde el enlace que recibiste.';
  if(/rate limit|over_email_send_rate_limit|email.*limit/i.test(m))return 'Se alcanzó el límite de correos. Intenta más tarde.';
  if(/signup.*disabled/i.test(m))return 'El registro todavía no está habilitado.';
  if(/password/i.test(m))return 'Usa una contraseña de al menos 8 caracteres.';
  if(/fetch|network/i.test(m))return 'No se pudo conectar. Revisa tu conexión e intenta de nuevo.';
  return m||'No se pudo completar la operación.';
}
async function showSession(session){
  $('sessionLoading').hidden=true;
  if(recovery){$('authPanel').hidden=false;$('appShell').hidden=true;document.body.classList.remove('not-ready');setMode('password');return;}
  if(!session){$('authPanel').hidden=false;$('appShell').hidden=true;document.body.classList.remove('not-ready');return;}
  if(currentUser&&currentUser!==session.user.id){location.reload();return;}
  currentUser=session.user.id;$('accountEmail').textContent=session.user.email||'';
  $('authPanel').hidden=true;$('appShell').hidden=false;
  if(!loaded){loaded=true;window.NexoStorage=storageFor(client);await import('./finance.js');}
}
setMode(recovery?'password':'login');
if(!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY){
  $('sessionLoading').hidden=true;$('authPanel').hidden=false;
  notice('Estamos conectando la base de datos. El registro estará disponible al finalizar la configuración.',true);
  $('authSubmit').disabled=true;
}else{
  client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
  client.auth.onAuthStateChange((event,session)=>{
    if(event==='PASSWORD_RECOVERY')recovery=true;
    if(event==='SIGNED_OUT'){location.reload();return;}
    if(event==='INITIAL_SESSION'||event==='SIGNED_IN'||event==='PASSWORD_RECOVERY')setTimeout(()=>showSession(session).catch(()=>notice('No se pudo abrir tu espacio. Recarga la página.',true)),0);
  });
  $('authForm').onsubmit=async event=>{
    event.preventDefault();$('authSubmit').disabled=true;notice('Procesando…');
    const email=$('authEmail').value.trim(),password=$('authPassword').value;
    try{
      if(mode==='signup'){
        const {data,error}=await client.auth.signUp({email,password,options:{emailRedirectTo:baseUrl}});if(error)throw error;
        $('authPassword').value='';if(data.session)await showSession(data.session);else notice('Revisa tu correo y confirma tu cuenta antes de entrar. Si ya tienes cuenta, inicia sesión.');
      }else if(mode==='reset'){
        const {error}=await client.auth.resetPasswordForEmail(email,{redirectTo:baseUrl});if(error)throw error;
        notice('Si el correo tiene una cuenta, recibirás un enlace para recuperar el acceso.');
      }else if(mode==='password'){
        const {error}=await client.auth.updateUser({password});if(error)throw error;
        recovery=false;history.replaceState(null,'',baseUrl);await client.auth.signOut();
      }else{
        const {data,error}=await client.auth.signInWithPassword({email,password});if(error)throw error;
        $('authPassword').value='';await showSession(data.session);
      }
    }catch(error){notice(friendly(error),true);}finally{$('authSubmit').disabled=false;}
  };
  $('logout').onclick=async()=>{
    if(document.body.classList.contains('is-saving'))return;
    const {error}=await client.auth.signOut({scope:'local'});if(error)alert('No se pudo cerrar sesión. Intenta de nuevo.');
  };
}
$('authSwitch').onclick=()=>setMode(mode==='login'?'signup':'login');
$('forgotPassword').onclick=()=>setMode('reset');
