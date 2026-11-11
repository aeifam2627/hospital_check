# แบบตรวจอุณหภูมิและความชื้น

เพิ่มจาก Google Forms ที่ผู้ใช้ส่งมา โดยเริ่มใช้วันที่ 11 พฤศจิกายน 2569:

| ประเภท | รอบ | ช่องกรอก | เกณฑ์ตามฟอร์ม |
| --- | --- | --- | --- |
| [อุณหภูมิตู้เย็น](https://docs.google.com/forms/d/e/1FAIpQLSew5NvqvD7tn00FdrZp3uiG3GxxREpadkK-sYJu4NNXVBWxgQ/viewform) (`refrigerator-temperature`) | เช้า / บ่าย | อุณหภูมิ °C | 2–8°C รวมขอบเขต |
| [อุณหภูมิห้องและความชื้น](https://docs.google.com/forms/d/e/1FAIpQLSfobJpSc58N8PqPQcav_CSa9CYVxVECYy17i3bBNsnShiBVjA/viewform) (`room-environment`) | เช้า / บ่าย | อุณหภูมิ °C และความชื้น % | อุณหภูมิ ≤24°C, ความชื้น ≤60% |

มีชื่อผู้ตรวจที่จำเป็นและช่องการแก้ไขที่ไม่บังคับตามต้นฉบับ ค่าที่อยู่นอกเกณฑ์แสดงคำเตือนแต่บันทึกได้ เพื่อเก็บผลตรวจจริง ไม่มีการส่งคำตอบกลับไปยัง Google Forms

รับทศนิยมไม่เกิน 2 ตำแหน่ง รับ comma เป็นจุดทศนิยมในหน้ากรอก อุณหภูมิรับค่าลบได้ (-273.15 ถึง 999°C) และความชื้นรับ 0–100% ขอบเขตการรับข้อมูลเป็นการป้องกันค่าที่กรอกผิด แยกจากเกณฑ์การแจ้งเตือนของฟอร์ม รายการตรวจนับเดิมยังต้องเป็นจำนวนเต็ม 0–99999

## ติดตั้งกับระบบเดิม

1. รัน `supabase/migrations/202611110001_environment_inspections.sql` เพียงไฟล์เดียวบนฐานข้อมูลเดิมที่มี migrations ก่อนหน้าและ seed แล้ว ทั้งไฟล์ทำงานใน transaction เดียว
2. Deploy โค้ดเว็บและ API ชุดนี้พร้อมกัน โดยรัน migration ก่อนให้ API Export เริ่มอ่านคอลัมน์ snapshot ใหม่
3. หากใช้ Discord ให้ deploy `send-discord` ใหม่เพื่อให้ข้อความรองรับเกณฑ์ช่วงค่า ตั้ง `inspection_types.discord_channel_id` ให้ทั้งสองประเภทเมื่อมี channel ปลายทางแล้ว migration ไม่สร้างหรือส่งข้อความไปยัง channel ใด
4. ตรวจหน้าแรกว่ามี 5 ประเภท เปิดทั้งสองแบบตรวจและตรวจรอบเช้า/บ่าย

ฐานข้อมูลที่เชื่อมอยู่เดิมติดตั้ง SQL ด้วยวิธีที่ไม่ได้บันทึก migration history ครบ จึงควรรันไฟล์ใหม่นี้ตรง ๆ ผ่าน SQL Editor หรือ `supabase db query --remote --file supabase/migrations/202611110001_environment_inspections.sql --yes` ไม่ใช้ `db push` รวม migrations เก่าซ้ำ

ผลตรวจเก็บ `comparison_mode_snapshot`, `standard_min_snapshot`, `standard_max_snapshot` และ `input_kind_snapshot` เพื่อให้ประวัติ สรุป และรายงานใช้เกณฑ์เดิม แม้เปลี่ยน master data ภายหลัง รายงาน Excel รองรับทุก format; รูปแบบต้นฉบับของสองประเภทใหม่เป็นตารางรายเดือนที่แบ่งวันละสองรอบ พร้อมผู้ตรวจและการแก้ไข

## แจ้งเตือนรอบที่ยังไม่ได้ลงข้อมูล

Migration เพิ่มเติม: `supabase/migrations/202611110002_missing_environment_rounds.sql` สำหรับสองประเภทใหม่นี้

| รอบ | ช่วงเวลาตาม Asia/Bangkok | เริ่มตรวจว่าขาดข้อมูล |
| --- | --- | --- |
| เช้า | 08:00–16:00 | 16:00 ของวันที่ตรวจ |
| บ่าย | 17:00–24:00 | 00:00 ของวันถัดไป แต่ข้อความยังระบุวันที่ตรวจเดิม |

ระบบเข้าคิวเฉพาะรอบที่ยังไม่มี submission สถานะ `complete` (ข้อมูลนำเข้าที่ยังเป็น `partial` ถือว่ายังไม่ครบ) แจ้งแยกห้องของแต่ละประเภท ไม่แจ้งซ้ำสำหรับประเภท/วันที่/รอบเดียวกัน และมีลิงก์เปิดฟอร์มของรอบที่ขาด เมื่อมีการกรอกระหว่างรอส่ง จะตรวจซ้ำและเปลี่ยนคิวเป็น `cancelled` โดยไม่ส่งข้อความเตือนที่ล้าสมัย

ติดตั้งตามลำดับ:

1. Deploy `send-discord` จากโค้ดล่าสุดก่อน: `npx supabase functions deploy send-discord` เพื่อรองรับข้อความ `missing_round` และการยกเลิกคิว
2. รัน `supabase/migrations/202611110002_missing_environment_rounds.sql` ใน SQL Editor โดยไม่ต้องรัน migration แรกซ้ำ
3. ยืนยันว่า `inspection_types.discord_channel_id` ของสองประเภทมี Channel ID และบอตส่งข้อความในห้องนั้นได้
4. ยืนยัน Cron เดิมทำงานทุก 2 นาทีด้วย SQL ด้านล่าง หากติดตั้ง Cron เดิมแล้ว ไม่ต้องสร้าง Cron/Webhook เพิ่ม ไม่ต้อง deploy `check-inspection-schedules` ซ้ำ และไม่ต้องเพิ่ม Environment Variables หรือ redeploy Vercel สำหรับการแจ้งรอบขาดนี้

```sql
select jobname, schedule, active
from cron.job
where jobname = 'hospital-inspection-discord-every-2-minutes';

select t.slug, s.shift_code, s.start_local_time, s.cutoff_local_time,
       s.cutoff_day_offset, s.timezone, s.missing_alerts_enabled_from,
       t.discord_channel_id
from public.inspection_schedules s
join public.inspection_types t on t.id = s.inspection_type_id
where t.slug in ('refrigerator-temperature', 'room-environment');
```

Cron เดิมเรียก `enqueue_due_notification_summaries` ซึ่งรวมการตรวจรอบขาดไว้แล้ว การแจ้งมักเริ่มในรอบ Cron แรกหลังครบกำหนด (ประมาณ 0–2 นาที หากคิวและ Discord ทำงานปกติ) หรือทุก 15 วินาทีหากใช้ local worker

เริ่มแจ้งเฉพาะกำหนดเวลาที่มาถึงหลังรัน migration ไม่ส่งเตือนย้อนหลังตั้งแต่วันแรกที่เปิดแบบตรวจ หาก scheduler หยุดชั่วคราว จะตรวจเก็บตกกำหนดเวลาล่าสุดภายใน 24 ชั่วโมง และยังป้องกันข้อความซ้ำด้วย unique dedupe key

## แสดงค่าที่ตรวจได้ในข้อความ Discord

Migration เพิ่มเติม: `supabase/migrations/202611110003_discord_environment_readings.sql` ต่อจากสองไฟล์ก่อนหน้า

คงการแจ้งเตือน 2 ห้องตามเดิม:

- ห้องตู้เย็น: แสดงอุณหภูมิตู้เย็น เช่น `อุณหภูมิตู้เย็น: 5.25 °C · เกณฑ์ 2–8 °C · อยู่ในเกณฑ์`
- ห้องอุณหภูมิห้องและความชื้น: แสดง `อุณหภูมิห้อง: 23.5 °C` และ `ความชื้นห้อง: 55.5 %` แยกบรรทัดในข้อความเดียว พร้อมเกณฑ์และสถานะของแต่ละค่า

แสดงค่าทุกรายการทั้งที่อยู่ในเกณฑ์และนอกเกณฑ์ ในข้อความบันทึกใหม่ การแก้ไข และสรุปตามเวลาที่เปิดไว้ โดยอ่านจาก snapshot ของผลตรวจ ไม่แสดงรายการผิดเกณฑ์ซ้ำสองบรรทัด และเก็บค่า `0` แยกจากช่องที่ไม่ได้กรอก

เปิดใช้งานโดยรัน migration ไฟล์ `202611110003` ใน SQL Editor แล้วรัน `npx supabase functions deploy send-discord` อีกครั้ง ไม่ต้องสร้างห้องใหม่หรือแก้ Channel ID, Environment Variables, Cron หรือ Webhook การเปลี่ยนนี้ใช้กับข้อความที่สร้างใหม่หลัง migration และไม่แก้ไขข้อความที่ส่งไปแล้ว

## ทดสอบ

`npm run test`, `npm run build`, `npm run test:e2e`, `npm run test:runtime`, `npm run lint`

ทดสอบฐานข้อมูลจริงแบบแยกด้วย PostgreSQL: สร้างฐานข้อมูลชั่วคราวและ roles `anon`, `authenticated`, `service_role` จากนั้นรัน migrations schema, reporting, legacy-import, seed และ migration สิ่งแวดล้อม ตามด้วย `tests/integration/environment-inspections.sql` (ไม่ต้องรัน migration cron ที่ต้องใช้ Supabase Vault) ชุดทดสอบ rollback ข้อมูลทั้งหมด และไม่ควรรันบน production

เมื่อเพิ่ม migration รอบขาดแล้ว ให้รัน `tests/integration/missing-environment-rounds.sql` เพื่อตรวจ cutoff เวลาไทย การเปลี่ยนวันที่ตอนเที่ยงคืน การไม่แจ้งซ้ำ การข้ามรอบที่กรอกครบ การเริ่มแจ้งหลังเปิดใช้ และการข้ามห้องที่ยังไม่ตั้งค่า

หลัง migration `202611110003` รัน `tests/integration/discord-environment-readings.sql` เพื่อตรวจว่าค่าปกติและผิดเกณฑ์อยู่ใน payload ทั้งการบันทึกและสรุป และยังส่งตู้เย็นไปห้องหนึ่ง ส่วนอุณหภูมิห้อง/ความชื้นรวมอีกห้องหนึ่ง
