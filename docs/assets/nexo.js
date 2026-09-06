const $=id=>document.getElementById(id);
new URL('./',location.href).href;
const notice=(text,error=false)=>{$('authMessage').textContent=text;$('authMessage').classList.toggle('sync-error',error);};
let mode='login',recovery=location.hash.includes('type=recovery');
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
setMode(recovery?'password':'login');
{
  notice('Estamos conectando la base de datos. El registro estará disponible al finalizar la configuración.',true);
  $('authSubmit').disabled=true;
}
$('authSwitch').onclick=()=>setMode(mode==='login'?'signup':'login');
$('forgotPassword').onclick=()=>setMode('reset');
