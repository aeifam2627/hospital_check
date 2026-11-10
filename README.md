# Hospital Daily Inspection — Phase A

ระบบบันทึกจำนวนยา รถ Emergency และเครื่องมือแพทย์แบบ mobile-first ตาม `HOSPITAL_INSPECTION_CODEX_SPEC.md` โดยหน้าเว็บไม่มี Login และไม่เชื่อมฐานข้อมูลโดยตรง ทุกการอ่าน/เขียนผ่าน Vercel Functions ซึ่งใช้ Supabase secret เฉพาะฝั่ง server

## สิ่งที่ใช้งานได้

- หน้าหลักแสดง 3 ประเภทและสถานะการส่งของวันที่ปัจจุบัน
- ฟอร์ม dynamic จาก Supabase รองรับรายการ กลุ่ม variant จำนวนมาตรฐาน และ effective date
- มือถือ 320px ขึ้นไป: ช่องกดง่าย, numeric keypad, progress, ค้นหา, กรองช่องว่าง และ sticky save bar
- `0` เป็นค่าจริง ส่วนช่องว่างบันทึกไม่ได้; variant เช่น `2/1` แยกคนละช่อง
- autosave draft ในเครื่อง แยกตามประเภท/วัน/เวร และกู้คืนหลัง refresh
- บันทึก/แก้ไขรอบเดิมแบบ transaction, optimistic revision และ idempotency
- RLS เปิดทุกตารางและปิด direct access ของ `anon`; browser bundle ไม่มี Supabase secret
- Dashboard แยกตัวชี้วัดส่งครบออกจากจำนวนตรงมาตรฐาน พร้อมรายละเอียดรายประเภท
- ประวัติกรองช่วงวัน/ประเภทและเปิดดูผลต่างมาตรฐานได้บนมือถือ
- Export `.xlsx` รายวัน/เดือน/ปี ทั้ง long-form และรูปแบบวันที่เป็นคอลัมน์
- Discord transactional outbox, Edge Function sender, retry 429/5xx และ summary schedule ที่เปิดใช้เมื่อกำหนดเวลาแล้ว

Legacy Excel Import พร้อม dry-run/commit อยู่ใน Phase C แล้ว ส่วนการเทียบไฟล์จริงและ production cutover ต้องทำเมื่อได้รับไฟล์ต้นฉบับและ credentials

## เริ่มใช้งาน

ต้องมี Node.js 22+ และ Supabase project

1. คัดลอก `.env.example` เป็น `.env` และใส่ `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `APP_BASE_URL`, `ALLOWED_ORIGINS`
2. เปิด Supabase SQL Editor แล้วรัน `supabase/migrations/202611090001_phase_a_schema.sql`
3. รัน `supabase/migrations/202611090002_phase_b_reporting_notifications.sql`
4. สร้าง Vault secrets ตามหัวไฟล์ `202611090003_discord_cron.sql` แล้วรัน migration นี้เพื่อสร้าง cron ทุก 2 นาที
5. รัน `supabase/migrations/202611100001_phase_c_import.sql`
6. รัน `supabase/seed.sql` ใน SQL Editor
7. เพิ่มรายชื่อผู้ตรวจในตาราง `inspectors` หากต้องการ dropdown suggestion (ผู้ใช้ยังพิมพ์ชื่อเองได้)
8. รัน `npm install` และ `npm run dev` สำหรับ UI; การทดลอง API เหมือน production ให้ใช้ `vercel dev`

```sql
insert into public.inspectors (display_name, sort_order)
values ('ชื่อเจ้าหน้าที่', 10);
```

## Deploy บน Vercel

1. Import repository และตั้ง environment variables ฝั่ง Production/Preview ตาม `.env.example`
2. ตั้ง `APP_BASE_URL` และ `ALLOWED_ORIGINS` เป็น URL จริง (คั่นหลาย origin ด้วย comma)
3. Deploy; `vercel.json` แยก `/api/*` ออกจาก SPA fallback แล้ว
4. เปิด `/api/inspection-types?date=2026-11-09` เพื่อตรวจการเชื่อม Supabase ก่อนทดลองฟอร์ม

ดูการตั้ง Discord/Edge Functions ที่ `docs/DISCORD_SETUP.md` และรายการ API ที่ `docs/API.md`
ดู dry-run/commit ของ Excel เดิมที่ `docs/MIGRATION.md` และการสำรองข้อมูลที่ `docs/BACKUP_RESTORE.md`

ห้ามใช้ `VITE_` นำหน้า secret และห้าม commit `.env` หรือไฟล์ Excel ดิบ

## ค่าที่ยังต้องยืนยันก่อน production

- เวลา/ความบังคับของเวรยาและรถ Emergency: seed เปิด 3 เวรแต่ตั้ง `required=false` และไม่มี cutoff
- รถ Emergency: seed เฉพาะ variant/จำนวนที่สเปกระบุชัด รายการอื่นต้องเพิ่มใน Supabase หลังเจ้าหน้าที่ยืนยัน
- ตัวเลข `BP 2/1`, `กรรไกร 2/6`, `Atery 2/2` ถูกใส่ตาม baseline และต้องยืนยันก่อนเปิดใช้จริง
- รายชื่อผู้ตรวจและนโยบายการเปิด public URL โดยไม่มี Login
- เวลา summary ของ Discord: `notification_schedules.enabled=false` จนกว่าเจ้าหน้าที่จะยืนยันเวลา

## ตรวจคุณภาพ

```bash
npm run typecheck
npm run test
npm run build
```

ทดสอบมือถือจริงด้วย URL จาก `vercel dev --listen 0.0.0.0:3000` บนอุปกรณ์เครือข่ายเดียวกัน โดยเน้นเครื่องมือแพทย์ 24 ช่องก่อนเริ่ม Phase B
