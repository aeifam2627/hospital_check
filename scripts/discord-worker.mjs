/* global console, process, setInterval, clearInterval */
import { loadEnv } from 'vite'
import { createClient } from '@supabase/supabase-js'
import { deliverOutbox } from '../supabase/functions/_shared/discord-delivery.ts'

// Explicit local worker command; never starts merely by opening the application.
const env = loadEnv('development', process.cwd(), '')
if (!env.DISCORD_BOT_TOKEN || /YOUR_|REPLACE|xxx/i.test(env.DISCORD_BOT_TOKEN)) {
  console.log('กรุณาใส่ DISCORD_BOT_TOKEN ใน .env.local และรัน npm run discord:setup -- --apply ก่อน')
  process.exit(2)
}
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const configured = await db.from('inspection_types').select('discord_channel_id').in('slug', ['medication','emergency-cart','medical-equipment'])
if (configured.error || configured.data?.length !== 3 || configured.data.some(row => !/^\d{17,20}$/.test(row.discord_channel_id ?? ''))) {
  console.log('ยังตั้งค่าห้องไม่ครบ รัน npm run discord:setup -- --apply ก่อน')
  process.exit(2)
}
let busy = false
async function tick() {
  if (busy) return
  busy = true
  try {
    const summary = await db.rpc('enqueue_due_notification_summaries')
    if (summary.error) throw summary.error
    const result = await deliverOutbox(db, env.DISCORD_BOT_TOKEN, env.APP_BASE_URL || 'http://127.0.0.1:3000')
    if (result.processed) console.log(JSON.stringify({ processed: result.processed, sent: result.results.filter(r => r.status === 'sent').length, retry: result.results.filter(r => r.status !== 'sent').length }))
  } catch { console.error('ตรวจคิว Discord ไม่สำเร็จ จะลองใหม่ใน 15 วินาที') }
  finally { busy = false }
}
console.log('Discord worker เริ่มแล้ว: ส่งคิวจริงแยกห้องตามประเภททุก 15 วินาที ปิดด้วย Ctrl+C')
console.log('ลิงก์ localhost เปิดได้เฉพาะเครื่องนี้ หากใช้งานทั้งหน่วยงานให้ตั้ง APP_BASE_URL เป็น URL ที่เจ้าหน้าที่เปิดได้')
const timer = setInterval(() => void tick(), 15000)
process.on('SIGINT', () => { clearInterval(timer); process.exit(0) })
process.on('SIGTERM', () => { clearInterval(timer); process.exit(0) })
await tick()
