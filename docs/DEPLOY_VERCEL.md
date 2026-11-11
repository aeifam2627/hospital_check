# Deploy Vercel

1. ตั้ง `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `APP_BASE_URL`, `ALLOWED_ORIGINS` ใน Vercel Project Settings
2. รัน Supabase migrations ตามลำดับและ seed
3. Deploy ด้วย build command `npm run build`, output `dist`
4. ตรวจ `/api/dashboard?date=YYYY-MM-DD` และดาวน์โหลด `/api/export?...` จาก production URL
5. ตรวจ Browser bundle ว่าไม่มี Supabase secret หรือ Discord token

`vercel.json` ทำ SPA fallback โดยไม่กลบ `/api/*`

ก่อน deploy ให้รัน `npm run test:runtime` เพื่อตรวจว่า API Export ที่ compile แล้วโหลดด้วย Node ESM ได้ และสร้างไฟล์ได้ทั้ง 3 รูปแบบ โดยไม่ต้องเชื่อมฐานข้อมูล
การ import JSON ฝั่ง server ต้องใช้ `with { type: 'json' }`; Vite/Vitest อาจโหลดได้แม้ขาด attribute นี้ แต่ Node บน Vercel จะหยุดด้วย `ERR_IMPORT_ATTRIBUTE_MISSING` ก่อนเข้า handler

## บันทึกแล้วได้ 403 Origin not allowed

API ยอมรับ origin จาก `ALLOWED_ORIGINS`, `APP_BASE_URL` และโดเมนโปรเจกต์/การ deploy ที่ Vercel ให้ผ่าน `VERCEL_URL`, `VERCEL_BRANCH_URL`, `VERCEL_PROJECT_PRODUCTION_URL` โดยเทียบโดเมนตรงตัว ไม่มี wildcard สำหรับ `*.vercel.app` และค่าที่ตั้งเป็น URL ลงท้าย `/` จะถูกปรับเป็น origin ก่อนเทียบ

หากปิดการเปิดเผย System Environment Variables ใน Vercel ให้เปิดใช้ หรือกำหนดค่า Production ให้ตรงกับโดเมนจริง เช่น:

```dotenv
APP_BASE_URL=https://hospital-check-i2nt.vercel.app
ALLOWED_ORIGINS=https://hospital-check-i2nt.vercel.app
```

เมื่อแก้ Environment Variables ต้อง Redeploy เพื่อให้ deployment ใหม่ได้รับค่า หากใช้ custom domains หลายชื่อ ให้ใส่แต่ละ origin ใน `ALLOWED_ORIGINS` คั่นด้วย comma ส่วน `APP_BASE_URL` ใช้ URL หลักสำหรับลิงก์ Discord และต้องตั้งให้ตรงกันใน Supabase Edge Function secrets ด้วย

## Console แสดง CSP script-src 'none' จาก simulator

ตรวจ response ของหน้าเว็บจริงและ `<meta http-equiv="Content-Security-Policy">` ก่อนแก้ CSP หากหน้าเว็บจริงไม่มี policy นี้และเปิด Chrome โดยตรงได้ แสดงว่ายังไม่ยืนยันว่าเกิดจากแอป อาจเป็น simulator/iframe/ส่วนขยายที่เพิ่มข้อจำกัด ให้เปิด URL ของแอปในแท็บใหม่เพื่อแยกปัญหา การเพิ่ม CSP ที่อนุญาต script ในแอปไม่สามารถคลาย policy ที่ตัวครอบกำหนดไว้ได้
