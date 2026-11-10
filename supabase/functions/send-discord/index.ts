import { createClient } from 'npm:@supabase/supabase-js@2'
import { deliverOutbox } from '../_shared/discord-delivery.ts'

Deno.serve(async(req)=>{
  const headers={'content-type':'application/json'}
  if(req.method!=='POST')return new Response(JSON.stringify({error:'Method not allowed'}),{status:405,headers})
  const secret=Deno.env.get('SCHEDULER_SECRET')
  if(!secret||req.headers.get('x-scheduler-secret')!==secret)return new Response(JSON.stringify({error:'Unauthorized'}),{status:401,headers})
  const url=Deno.env.get('SUPABASE_URL'), key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), token=Deno.env.get('DISCORD_BOT_TOKEN'),baseUrl=Deno.env.get('APP_BASE_URL')??''
  if(!url||!key||!token)return new Response(JSON.stringify({error:'Missing secrets'}),{status:500,headers})
  try {
    const db=createClient(url,key,{auth:{persistSession:false}})
    const result=await deliverOutbox(db,token,baseUrl)
    return new Response(JSON.stringify(result),{headers})
  }catch{return new Response(JSON.stringify({error:'Notification processing failed'}),{status:500,headers})}
})
