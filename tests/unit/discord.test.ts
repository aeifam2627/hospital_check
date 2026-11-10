import { describe, expect, it, vi, afterEach } from 'vitest'
import { discordBody } from '../../supabase/functions/_shared/discord-message'
import { deliverOutbox } from '../../supabase/functions/_shared/discord-delivery'

afterEach(()=>vi.unstubAllGlobals())
describe('Discord notifications',()=>{
  it('formats Thai shifts/time and neutralizes mentions with a stable nonce',()=>{
    const payload={kind:'submission',title_th:'ยา',work_date:'2026-11-10',submitted_at:'2026-11-10T08:00:00Z',inspector_name:'@everyone',schedule_mode:'shift',shift_code:'morning',revision_number:0,completed_count:25,difference_count:0,detail_path:'/history'}
    const body=discordBody(payload,'http://127.0.0.1:3000','submission:1')
    expect(body.content).toContain('เวร: เช้า')
    expect(body.content).toContain('15:00')
    expect(body.content).not.toContain('@everyone')
    expect(body.allowed_mentions.parse).toEqual([])
    expect(body.nonce).toBe(discordBody(payload,'','submission:1').nonce)
    expect(discordBody({...payload,schedule_mode:'daily'},'','submission:1').content).not.toContain('เวร:')
  })
  it('only sends claimed notifications and respects Discord retry_after',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:false,status:429,json:async()=>({retry_after:42})})
    vi.stubGlobal('fetch',fetch)
    const updates:Record<string,unknown>[]=[]
    const pending={target_channel_id:'123456789012345678',attempts:1,dedupe_key:'key',payload:{kind:'summary',title_th:'ยา',work_date:'2026-11-10'}}
    const db={rpc:vi.fn().mockResolvedValue({data:[{...pending,id:'1'},{...pending,id:'2'}],error:null}),from:()=>({update:(value:Record<string,unknown>)=>{updates.push(value);return{eq:async()=>({error:null})}},insert:async()=>({error:null})})}
    const before=Date.now()
    const result=await deliverOutbox(db,'test-token','')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(updates[0]!.status).toBe('failed')
    expect(Date.parse(updates[0]!.next_retry_at as string)-before).toBeGreaterThanOrEqual(42000)
    expect(result.results[0]!.status).toBe('failed')
    expect(result.results[1]!.status).toBe('deferred')
    expect(updates[1]!.attempts).toBe(0)
    expect(fetch.mock.calls[0]![1].headers['user-agent']).toContain('DiscordBot')
    db.rpc.mockResolvedValue({data:[],error:null})
    await deliverOutbox(db,'test-token','')
    expect(fetch).toHaveBeenCalledTimes(1)
  })
})
