document.addEventListener('DOMContentLoaded',async()=>{
 const message=document.getElementById('finance-login-result'),params=new URLSearchParams(location.hash.slice(1)),slug=params.get('slug'),token=params.get('token_hash');
 history.replaceState(null,'',location.pathname);
 if(!slug||!token||!/^[a-z0-9-]{2,40}$/.test(slug)){message.textContent='This sign-in link is incomplete. Request a fresh link from your admin dashboard.';return;}
 try{
  const response=await fetch(SUPABASE_URL+'/auth/v1/verify',{method:'POST',headers:{apikey:SUPABASE_ANON_KEY,'Content-Type':'application/json'},body:JSON.stringify({token_hash:token,type:'magiclink'}),signal:AbortSignal.timeout(15000)});
  const session=await response.json();if(!response.ok||!session.access_token)throw Error('This sign-in link has expired or was already used. Request a fresh link.');
  try{
   sessionStorage.setItem('finance-session:'+slug,JSON.stringify({access_token:session.access_token,expires_at:session.expires_at||Date.now()/1000+session.expires_in}));
   const saved=sessionStorage.getItem('finance-return:'+slug);sessionStorage.removeItem('finance-return:'+slug);
   if(saved){const destination=new URL(saved,location.origin);if(destination.origin===location.origin&&(destination.pathname.startsWith('/admin/')||destination.pathname==='/admin.html')){location.replace(destination.href);return;}}
  }catch(_){}
  message.textContent='You are signed in. Reopen your saved admin dashboard to view Payments.';
 }catch(error){message.textContent=error.message||'Could not sign in. Request another link from your admin dashboard.';message.setAttribute('role','alert');}
});