import { createClient } from 'npm:@supabase/supabase-js@2'

Deno.serve(async(req)=>{
  if(req.method!=='POST')return new Response('Method not allowed',{status:405})
  const schedulerSecret=Deno.env.get('SCHEDULER_SECRET')
  if(!schedulerSecret||req.headers.get('x-scheduler-secret')!==schedulerSecret)return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers:{'content-type':'application/json'}})
  const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  if(!url||!key)return new Response(JSON.stringify({error:'Missing secrets'}),{status:500,headers:{'content-type':'application/json'}})
  const db=createClient(url,key,{auth:{persistSession:false}});const {data,error}=await db.rpc('enqueue_due_notification_summaries')
  if(error)return new Response(JSON.stringify({error:error.message}),{status:500,headers:{'content-type':'application/json'}})
  const sender=await fetch(`${url}/functions/v1/send-discord`,{method:'POST',headers:{authorization:`Bearer ${key}`,'x-scheduler-secret':schedulerSecret}})
  return new Response(JSON.stringify({queued:data,sender_status:sender.status}),{headers:{'content-type':'application/json'}})
})
