import { discordBody } from './discord-message.ts'

type NotificationDatabase = { rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: any; error: unknown }>; from: (table: string) => any }
const cooldowns=new Map<string,number>()
export async function deliverOutbox(db: NotificationDatabase, token: string, baseUrl: string) {
  if((cooldowns.get(token)??0)>Date.now())return {processed:0,results:[]}
  const {data,error}=await db.rpc('claim_notification_outbox',{p_limit:10})
  if(error) throw error
  const results=[]
  for(const item of data??[]){
    try{
      const until=cooldowns.get(token)??0
      if(until>Date.now()){
        const deferred=await db.from('notification_outbox').update({status:'pending',attempts:Math.max(0,item.attempts-1),next_retry_at:new Date(until).toISOString(),updated_at:new Date().toISOString()}).eq('id',item.id)
        if(deferred.error)throw deferred.error
        results.push({id:item.id,status:'deferred'});continue
      }
      if(item.payload.kind==='missing_round'){
        const missing=await db.rpc('is_inspection_round_missing',{p_type_slug:item.payload.type_slug,p_work_date:item.payload.work_date,p_shift_code:item.payload.shift_code})
        if(missing.error)throw missing.error
        if(missing.data!==true){
          const cancelled=await db.from('notification_outbox').update({status:'cancelled',updated_at:new Date().toISOString()}).eq('id',item.id)
          if(cancelled.error)throw cancelled.error
          const logged=await db.from('notification_logs').insert({outbox_id:item.id,result:'cancelled_already_submitted'})
          if(logged.error)throw logged.error
          results.push({id:item.id,status:'cancelled'});continue
        }
      }
      const response=await fetch(`https://discord.com/api/v10/channels/${item.target_channel_id}/messages`,{method:'POST',signal:AbortSignal.timeout(15000),headers:{authorization:`Bot ${token}`,'content-type':'application/json','user-agent':`DiscordBot (${baseUrl||'http://localhost:3000'}, 0.1.0)`},body:JSON.stringify(discordBody(item.payload,baseUrl,item.dedupe_key))})
      const body=await response.json().catch(()=>({}))
      if(response.headers?.get('x-ratelimit-remaining')==='0'){
        const reset=Number(response.headers.get('x-ratelimit-reset-after'))
        if(Number.isFinite(reset)&&reset>0)cooldowns.set(token,Date.now()+Math.ceil(reset*1000))
      }
      if(response.ok){const sent=await db.from('notification_outbox').update({status:'sent',sent_at:new Date().toISOString(),discord_message_id:String(body.id),updated_at:new Date().toISOString()}).eq('id',item.id);if(sent.error)throw sent.error;await db.from('notification_logs').insert({outbox_id:item.id,result:'sent'});results.push({id:item.id,status:'sent'});continue}
      const retry=Number(body.retry_after??response.headers?.get('retry-after')??1)
      const retrySeconds=response.status===429?(Number.isFinite(retry)?Math.max(1,Math.ceil(retry)):60):Math.min(3600,30*2**item.attempts)
      if(response.status===429)cooldowns.set(token,Date.now()+retrySeconds*1000)
      const failed=await db.from('notification_outbox').update({status:'failed',next_retry_at:new Date(Date.now()+retrySeconds*1000).toISOString(),updated_at:new Date().toISOString()}).eq('id',item.id);if(failed.error)throw failed.error
      const log=await db.from('notification_logs').insert({outbox_id:item.id,result:`http_${response.status}`,error_text:JSON.stringify(body).slice(0,1000)});if(log.error)throw log.error;results.push({id:item.id,status:'failed'})
    }catch(error){const retrySeconds=Math.min(3600,30*2**item.attempts);const failed=await db.from('notification_outbox').update({status:'failed',next_retry_at:new Date(Date.now()+retrySeconds*1000).toISOString(),updated_at:new Date().toISOString()}).eq('id',item.id);const log=await db.from('notification_logs').insert({outbox_id:item.id,result:'network_error',error_text:String(error).slice(0,1000)});results.push({id:item.id,status:failed.error||log.error?'database_error':'failed'})}
  }
  return {processed:results.length,results}
}

