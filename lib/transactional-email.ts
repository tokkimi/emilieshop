import { createSupabaseAdminClient } from './supabase/server';

type OrderEmailInput={orderId:string;orderNumber:string;email:string;name:string;total:string;locale:'fr'|'en'};

export async function queueAndSendOrderEmail(input:OrderEmailInput){
  const admin=createSupabaseAdminClient();
  if(!admin)return{sent:false,status:'unavailable' as const};
  const subject=input.locale==='en'?`Order ${input.orderNumber} received`:`Commande ${input.orderNumber} reçue`;
  const html=input.locale==='en'
    ?`<h1>Thank you, ${escapeHtml(input.name)}</h1><p>Your order <strong>${input.orderNumber}</strong> (${input.total}) is saved in your account. It will not be sent to print until the exact proof is approved and payment is active.</p>`
    :`<h1>Merci, ${escapeHtml(input.name)}</h1><p>Votre commande <strong>${input.orderNumber}</strong> (${input.total}) est enregistrée dans votre profil. Elle ne partira pas à l’impression avant l’approbation de l’aperçu exact et l’activation du paiement.</p>`;
  const {data:outbox}=await admin.from('email_outbox').insert({user_email:input.email,template:'order-confirmation',subject,payload:input,order_id:input.orderId,status:'queued'}).select('id').single();
  const apiKey=process.env.RESEND_API_KEY;const from=process.env.EMAIL_FROM;
  if(!apiKey||!from||!outbox)return{sent:false,status:'queued' as const};
  try{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({from,to:[input.email],subject,html})});
    if(!response.ok)throw new Error('email-provider');
    const result=await response.json() as {id?:string};
    await admin.from('email_outbox').update({status:'sent',provider_id:result.id||null,sent_at:new Date().toISOString()}).eq('id',outbox.id);
    return{sent:true,status:'sent' as const};
  }catch{await admin.from('email_outbox').update({status:'failed',attempts:1,last_error:'provider_error'}).eq('id',outbox.id);return{sent:false,status:'failed' as const};}
}

export async function queueAndSendPaymentEmail(input:OrderEmailInput){
  const admin=createSupabaseAdminClient();
  if(!admin)return{sent:false,status:'unavailable' as const};
  const subject=input.locale==='en'?`Payment received — ${input.orderNumber}`:`Paiement reçu — ${input.orderNumber}`;
  const html=input.locale==='en'
    ?`<h1>Payment received by Maison Mémoire</h1><p>Thank you, ${escapeHtml(input.name)}. Your payment of <strong>${escapeHtml(input.total)}</strong> for order <strong>${escapeHtml(input.orderNumber)}</strong> is confirmed. Your approved book will now enter preflight before printing.</p>`
    :`<h1>Paiement reçu par Maison Mémoire</h1><p>Merci, ${escapeHtml(input.name)}. Votre paiement de <strong>${escapeHtml(input.total)}</strong> pour la commande <strong>${escapeHtml(input.orderNumber)}</strong> est confirmé. Votre livre approuvé passe maintenant au contrôle prépresse.</p>`;
  const {data:outbox}=await admin.from('email_outbox').insert({user_email:input.email,template:'payment-confirmation',subject,payload:input,order_id:input.orderId,status:'queued'}).select('id').single();
  const apiKey=process.env.RESEND_API_KEY;const from=process.env.EMAIL_FROM;
  if(!apiKey||!from||!outbox)return{sent:false,status:'queued' as const};
  try{
    const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${apiKey}`,'content-type':'application/json'},body:JSON.stringify({from,to:[input.email],subject,html})});
    if(!response.ok)throw new Error('email-provider');
    const result=await response.json() as {id?:string};
    await admin.from('email_outbox').update({status:'sent',provider_id:result.id||null,sent_at:new Date().toISOString()}).eq('id',outbox.id);
    return{sent:true,status:'sent' as const};
  }catch{await admin.from('email_outbox').update({status:'failed',attempts:1,last_error:'provider_error'}).eq('id',outbox.id);return{sent:false,status:'failed' as const};}
}
function escapeHtml(value:string){return value.replace(/[&<>'"]/g,(character)=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[character]||character);}
