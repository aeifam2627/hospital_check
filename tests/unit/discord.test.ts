import { describe, expect, it, vi, afterEach } from 'vitest'
import { discordBody } from '../../supabase/functions/_shared/discord-message'
import { deliverOutbox } from '../../supabase/functions/_shared/discord-delivery'

afterEach(()=>vi.unstubAllGlobals())
describe('Discord notifications',()=>{
  const roomReadings=[
    {item:'อุณหภูมิห้อง',actual:23.5,unit:'°C',comparison_mode:'range',standard_max:24,outside_standard:false},
    {item:'ความชื้นห้อง',actual:55.5,unit:'%',comparison_mode:'range',standard_max:60,outside_standard:false},
  ]
  const environmentPayload={kind:'submission',type_slug:'room-environment',title_th:'อุณหภูมิห้องและความชื้น',work_date:'2026-11-11',submitted_at:'2026-11-11T01:30:00Z',inspector_name:'ผู้ตรวจทดสอบ',schedule_mode:'shift',shift_code:'morning',revision_number:0,completed_count:2,difference_count:0,differences:[],readings:roomReadings,detail_path:'/history'}
  it('shows normal refrigerator readings, units and range in the refrigerator message',()=>{
    const body=discordBody({...environmentPayload,type_slug:'refrigerator-temperature',title_th:'อุณหภูมิตู้เย็น',completed_count:1,readings:[{item:'อุณหภูมิตู้เย็น',actual:5.25,unit:'°C',comparison_mode:'range',standard_min:2,standard_max:8,outside_standard:false}]},'','fridge:1')
    expect(body.content).toContain('อุณหภูมิตู้เย็น: 5.25 °C · เกณฑ์ 2–8 °C · อยู่ในเกณฑ์')
    expect(body.content).not.toContain('ความชื้นห้อง')
  })
  it('lists both normal room temperature and humidity on separate lines in the same message',()=>{
    const body=discordBody(environmentPayload,'','room:1')
    expect(body.content).toContain('- อุณหภูมิห้อง: 23.5 °C · เกณฑ์ ไม่เกิน 24 °C · อยู่ในเกณฑ์\n- ความชื้นห้อง: 55.5 % · เกณฑ์ ไม่เกิน 60 % · อยู่ในเกณฑ์')
    expect(body.content).toContain('จำนวนต่างมาตรฐาน: 0 ช่อง')
  })
  it('marks an abnormal reading once and preserves zero, missing values and corrective notes',()=>{
    const reading={...roomReadings[0],actual:25,outside_standard:true}
    const body=discordBody({...environmentPayload,readings:[reading,{...roomReadings[1],actual:0}],difference_count:1,differences:[reading],notes:'ตรวจซ้ำแล้ว @everyone'},'','room:2')
    expect(body.content).toContain('อุณหภูมิห้อง: 25 °C · เกณฑ์ ไม่เกิน 24 °C · นอกเกณฑ์')
    expect(body.content).toContain('ความชื้นห้อง: 0 %')
    expect(body.content.match(/- อุณหภูมิห้อง:/g)).toHaveLength(1)
    expect(body.content).toContain('ตรวจซ้ำแล้ว ＠everyone')
    const missing=discordBody({...environmentPayload,readings:[{...roomReadings[0],actual:null}]},'','room:missing')
    expect(missing.content).toContain('อุณหภูมิห้อง: ไม่ได้กรอก')
    expect(missing.content).not.toContain('อุณหภูมิห้อง: 0')
  })
  it('includes both environmental values in a scheduled summary as well',()=>{
    const body=discordBody({kind:'summary',title_th:'อุณหภูมิห้องและความชื้น',work_date:'2026-11-11',shift_code:'morning',submission:{inspector_name:'ผู้ตรวจทดสอบ',submitted_at:'2026-11-11T01:30:00Z',completed_count:2,difference_count:0,readings:roomReadings}},'','summary:1')
    expect(body.content).toContain('อุณหภูมิห้อง: 23.5 °C')
    expect(body.content).toContain('ความชื้นห้อง: 55.5 %')
  })
  it('labels a missing afternoon round with its original work date and midnight deadline',()=>{
    const body=discordBody({kind:'missing_round',title_th:'อุณหภูมิตู้เย็น',work_date:'2026-11-11',shift_code:'afternoon',window_start:'17:00',window_end:'24:00',detail_path:'/inspect/refrigerator-temperature?date=2026-11-11&shift=afternoon'},'https://example.test','missing:fridge:2026-11-11:afternoon')
    expect(body.content).toContain('ยังไม่ได้ลงข้อมูล')
    expect(body.content).toContain('รอบ: บ่าย')
    expect(body.content).toContain('17:00–24:00')
    expect(body.content).toContain('date=2026-11-11&shift=afternoon')
    expect(body.allowed_mentions.parse).toEqual([])
  })
  it('cancels a queued missing-round notification if the round was subsequently submitted',async()=>{
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch)
    const updates:Record<string,unknown>[]=[]
    const notification={id:'missing-1',attempts:1,dedupe_key:'missing:1',payload:{kind:'missing_round',type_slug:'room-environment',work_date:'2026-11-11',shift_code:'morning'}}
    const db={rpc:vi.fn().mockImplementation(async(name:string)=>({data:name==='claim_notification_outbox'?[notification]:false,error:null})),from:()=>({update:(value:Record<string,unknown>)=>{updates.push(value);return{eq:async()=>({error:null})}},insert:async()=>({error:null})})}
    const result=await deliverOutbox(db,'missing-test-token','')
    expect(fetch).not.toHaveBeenCalled()
    expect(updates[0]!.status).toBe('cancelled')
    expect(result.results[0]!.status).toBe('cancelled')
    expect(db.rpc).toHaveBeenCalledWith('is_inspection_round_missing',{p_type_slug:'room-environment',p_work_date:'2026-11-11',p_shift_code:'morning'})
  })
  it('sends a still-missing round and retries a failed recheck without sending',async()=>{
    const fetch=vi.fn().mockResolvedValue({ok:true,json:async()=>({id:'discord-message'})});vi.stubGlobal('fetch',fetch)
    const notification={id:'missing-1',target_channel_id:'123456789012345678',attempts:1,dedupe_key:'missing:1',payload:{kind:'missing_round',title_th:'อุณหภูมิตู้เย็น',type_slug:'refrigerator-temperature',work_date:'2026-11-11',shift_code:'morning',window_start:'08:00',window_end:'16:00',detail_path:'/inspect/refrigerator-temperature'}}
    const updates:Record<string,unknown>[]=[]
    const db={rpc:vi.fn().mockImplementation(async(name:string)=>({data:name==='claim_notification_outbox'?[notification]:true,error:null})),from:()=>({update:(value:Record<string,unknown>)=>{updates.push(value);return{eq:async()=>({error:null})}},insert:async()=>({error:null})})}
    expect((await deliverOutbox(db,'missing-recheck-token','')).results[0]!.status).toBe('sent')
    expect(fetch).toHaveBeenCalledTimes(1)
    db.rpc.mockImplementation(async(name:string)=>name==='claim_notification_outbox'?{data:[notification],error:null}:{data:null,error:new Error('database unavailable')})
    expect((await deliverOutbox(db,'missing-recheck-token','')).results[0]!.status).toBe('failed')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(updates.at(-1)!.status).toBe('failed')
  })
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
