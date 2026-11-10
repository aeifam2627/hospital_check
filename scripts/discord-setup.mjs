/* global console, process, fetch, AbortSignal */
import { loadEnv } from 'vite'
import { createClient } from '@supabase/supabase-js'

const env = loadEnv('development', process.cwd(), '')
const config = [
  ['medication', 'DISCORD_MEDICATION_CHANNEL_ID'],
  ['emergency-cart', 'DISCORD_EMERGENCY_CHANNEL_ID'],
  ['medical-equipment', 'DISCORD_EQUIPMENT_CHANNEL_ID'],
]
const missing = ['DISCORD_BOT_TOKEN', ...config.map(([, key]) => key)].filter(key => !env[key] || /YOUR_|REPLACE|xxx/i.test(env[key]))
if (missing.length) {
  console.log(`ยังตั้งค่าไม่ครบใน .env.local: ${missing.join(', ')}`)
  console.log('เติม Token และ Channel ID ห้องทั้ง 3 ก่อน แล้วรัน npm run discord:setup -- --apply')
  process.exit(2)
}
if (config.some(([, key]) => !/^\d{17,20}$/.test(env[key]))) throw new Error('Channel ID ต้องเป็นตัวเลข 17–20 หลัก เก็บเป็นข้อความ')
if (new Set(config.map(([, key]) => env[key])).size !== 3) throw new Error('เลือกแยกห้อง: Channel ID ทั้ง 3 ต้องต่างกัน')
async function get(path) {
  const res = await fetch(`https://discord.com/api/v10${path}`, { headers: { authorization: `Bot ${env.DISCORD_BOT_TOKEN}`, 'content-type': 'application/json', 'user-agent': `DiscordBot (${env.APP_BASE_URL || 'http://localhost:3000'}, 0.1.0)` }, signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`ตรวจ Discord ไม่สำเร็จ (HTTP ${res.status}); ตรวจ Token และสิทธิ์ Bot`)
  return res.json()
}
const bot = await get('/users/@me')
for (const [slug, key] of config) {
  const channel = await get(`/channels/${env[key]}`)
  if (![0, 5].includes(channel.type) || !channel.guild_id) throw new Error(`${key}: ต้องเป็นห้องข้อความใน Server`)
  const [guild, member, roles] = await Promise.all([get(`/guilds/${channel.guild_id}`), get(`/guilds/${channel.guild_id}/members/${bot.id}`), get(`/guilds/${channel.guild_id}/roles`)])
  const roleIds = new Set([channel.guild_id, ...member.roles])
  let permissions = roles.filter(role => roleIds.has(role.id)).reduce((bits, role) => bits | BigInt(role.permissions), 0n)
  if (guild.owner_id !== bot.id && !(permissions & 8n)) {
    const overrides = channel.permission_overwrites ?? []
    const apply = entries => { let allow = 0n, deny = 0n; for (const entry of entries) { allow |= BigInt(entry.allow); deny |= BigInt(entry.deny) } permissions = (permissions & ~deny) | allow }
    apply(overrides.filter(entry => entry.id === channel.guild_id))
    apply(overrides.filter(entry => entry.type === 0 && entry.id !== channel.guild_id && roleIds.has(entry.id)))
    apply(overrides.filter(entry => entry.type === 1 && entry.id === bot.id))
    if ((permissions & 3072n) !== 3072n || (member.communication_disabled_until && Date.parse(member.communication_disabled_until) > Date.now())) throw new Error(`${key}: Bot ต้องมี View Channel และ Send Messages และไม่ถูก Timeout`)
  }
  console.log(`${slug}: ห้องและสิทธิ์ Bot ผ่าน`)
}
const db = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } })
const { data: types, error } = await db.from('inspection_types').select('id,slug,discord_channel_id')
if (error) throw new Error('อ่านการตั้งค่า Supabase ไม่สำเร็จ')
if (config.some(([slug]) => !types.some(type => type.slug === slug))) throw new Error('ไม่พบประเภทการตรวจครบทั้ง 3 ใน Supabase')
if (process.argv.includes('--apply')) {
  for (const [slug, key] of config) {
    const result = await db.from('inspection_types').update({ discord_channel_id: env[key] }).eq('slug', slug).select('id,discord_channel_id').single()
    if (result.error || result.data?.discord_channel_id !== env[key]) throw new Error(`บันทึกห้อง ${slug} ไม่สำเร็จ กรุณารันซ้ำ`)
  }
  console.log('ตั้งค่าห้องใน Supabase ครบแล้ว เปิด npm run discord:worker ควบคู่กับ npm run dev เพื่อส่งแจ้งเตือนจากเครื่องนี้')
} else console.log('ตรวจครบแล้ว (ยังไม่แก้ฐานข้อมูล) ใช้ --apply เพื่อบันทึกการแยกห้อง')
console.log('ไม่ได้ส่งข้อความทดสอบ และไม่ได้เปิดเวลาสรุปหรือแจ้งเตือนเวรขาด')
