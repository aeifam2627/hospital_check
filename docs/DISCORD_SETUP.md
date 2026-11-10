# Discord และ Supabase Edge Functions

## ใช้งานในเครื่องตอนนี้ — แยก 3 ห้อง

เติมค่าใน `.env.local` (Token อยู่ฝั่ง server เท่านั้น ไม่ต้องส่งในแชต):

```dotenv
DISCORD_BOT_TOKEN=โทเคนของบอต
DISCORD_MEDICATION_CHANNEL_ID=รหัสห้องยา
DISCORD_EMERGENCY_CHANNEL_ID=รหัสห้องรถ_Emergency
DISCORD_EQUIPMENT_CHANNEL_ID=รหัสห้องเครื่องมือแพทย์
APP_BASE_URL=http://127.0.0.1:3000
```

เชิญ Bot เข้า Server และเปิด View Channel / Send Messages ในทั้ง 3 ห้อง
Channel ID ต้องเก็บเป็นข้อความ ห้ามแปลงเป็น Number
สคริปต์ตรวจสิทธิ์รวมทั้ง role และ channel overwrites ตาม [Discord Permissions](https://github.com/discord/discord-api-docs/blob/main/developers/topics/permissions.mdx)
ไม่ต้องเปิด Message Content Intent เพราะระบบส่งข้อความทาง REST เท่านั้น
การเรียกใช้ API v10 ส่ง `Authorization: Bot …`, `Content-Type` และ `User-Agent` ตาม [API Reference](https://docs.discord.com/developers/reference)
Sender อ่าน rate-limit headers และ `retry_after`/`Retry-After` แล้วพักการส่งและตั้งเวลาลองใหม่ตาม [Rate Limits](https://docs.discord.com/developers/topics/rate-limits)

```powershell
npm.cmd run discord:setup -- --apply
npm.cmd run discord:worker
```

คำสั่งแรกตรวจ Bot, ห้อง และสิทธิ์ก่อนบันทึก Channel ID แยกประเภทลง Supabase โดยไม่ส่งข้อความทดสอบ
คำสั่งที่สอง **ส่งข้อความจริงจาก notification_outbox** ทุก 15 วินาที เปิดทิ้งไว้ใน terminal แยกจาก `npm.cmd run dev`
เมื่อปิด worker จะหยุดส่ง; เมื่อเปิดใหม่จะ retry คิวที่ยังไม่สำเร็จ ใช้ claim/nonce เดียวกับ Edge Function
Import Excel ไม่สร้างคิวแจ้งเตือน รายการที่ถูกบันทึกก่อนตั้งห้องและไม่มี outbox จะไม่ส่งย้อนหลัง
APP_BASE_URL แบบ localhost เปิดได้เฉพาะเครื่องเจ้าของ URL; หากต้องให้เพื่อนร่วมงานเปิดจาก Discord ให้ใช้ URL แอปที่เข้าถึงได้จริง
เวลาสรุปและแจ้งเตือนเวรขาดยังปิดไว้จนกว่าจะกำหนดเวลาปฏิบัติงานจริง
`DISCORD_DAILY_SUMMARY_CHANNEL_ID` เดิมไม่ถูกใช้เป็นห้องรวมในโหมดแยกห้องนี้

หากต้องการให้ทำงานตลอดแม้ปิดเครื่อง ให้ deploy Edge Functions และตั้ง Cron ตามหัวข้อด้านล่าง

## Bot

1. สร้าง Discord Application/Bot หนึ่งตัว
2. ให้สิทธิ์เฉพาะ `View Channel`, `Send Messages`, `Embed Links` ในห้องที่ต้องใช้
3. คัดลอก Channel ID เป็น string ใส่ `inspection_types.discord_channel_id` ห้ามแปลงเป็น JavaScript Number
4. ตั้ง Edge Function secrets:

```bash
supabase secrets set DISCORD_BOT_TOKEN=... APP_BASE_URL=https://your-app.vercel.app SCHEDULER_SECRET=GENERATE_A_LONG_RANDOM_VALUE
supabase functions deploy send-discord
supabase functions deploy check-inspection-schedules
```

Supabase จะมี `SUPABASE_URL` และ `SUPABASE_SERVICE_ROLE_KEY` ให้ Edge Functions โดยอัตโนมัติ

## ส่งทันทีและ Retry

เมื่อบันทึกผ่านเว็บ deferred trigger จะสร้าง `notification_outbox` ใน transaction เดียวกัน หากเป็น Excel import จะไม่สร้าง outbox

- แนะนำสร้าง Database Webhook เมื่อ `notification_outbox` มี `INSERT` ให้ POST ไป `/functions/v1/send-discord` พร้อม header `x-scheduler-secret`
- Migration `202611090003_discord_cron.sql` สร้าง Supabase Cron ทุก 2 นาทีให้เรียก `/functions/v1/check-inspection-schedules`; function นี้สร้าง summary ที่ถึงเวลาและเรียก sender เพื่อ retry outbox
- Sender เคารพ Discord `retry_after`, backoff สำหรับ 5xx/network error และไม่ claim รายการที่ `sent` แล้ว

ทุกข้อความใช้ `allowed_mentions.parse=[]` และแทน `@` ในชื่อ/หมายเหตุเพื่อไม่ให้ mention โดยไม่ตั้งใจ
Sender ใช้ Discord nonce จาก `dedupe_key` และ claim ที่ค้างสถานะ `processing` เกิน 10 นาทีจะถูกนำกลับมา retry

ก่อนรัน migration cron ให้สร้าง Vault secrets ใน SQL Editor:

```sql
select vault.create_secret('https://YOUR_PROJECT.supabase.co','project_url');
select vault.create_secret('YOUR_SERVICE_ROLE_KEY','service_role_key');
select vault.create_secret('THE_SAME_VALUE_AS_SCHEDULER_SECRET','scheduler_secret');
```

ตรวจการทำงานหลัง deploy:

```sql
select jobid, jobname, schedule, active from cron.job
where jobname='hospital-inspection-discord-every-2-minutes';

select status, count(*) from public.notification_outbox group by status;
select * from public.notification_logs order by attempted_at desc limit 20;
```

## เปิด Summary หลังยืนยันเวลา

ค่าเริ่มต้นไม่มี schedule ที่เปิดใช้งาน ห้ามเปิดจนกว่าเจ้าหน้าที่จะยืนยันเวลา ตัวอย่างรายวัน:

```sql
insert into public.notification_schedules
  (inspection_type_id, shift_code, notification_kind, send_local_time, enabled, channel_id_override)
select id, 'daily', 'daily_summary', '16:30', true, 'DISCORD_CHANNEL_ID'
from public.inspection_types where slug='medical-equipment';
```

สำหรับยา/รถ Emergency ให้เพิ่มเฉพาะเวรที่ `inspection_schedules.required=true` และกำหนด cutoff แล้ว
