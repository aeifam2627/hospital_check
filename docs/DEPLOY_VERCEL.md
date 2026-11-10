# Deploy Vercel

1. ตั้ง `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `APP_BASE_URL`, `ALLOWED_ORIGINS` ใน Vercel Project Settings
2. รัน Supabase migrations ตามลำดับและ seed
3. Deploy ด้วย build command `npm run build`, output `dist`
4. ตรวจ `/api/dashboard?date=YYYY-MM-DD` และดาวน์โหลด `/api/export?...` จาก production URL
5. ตรวจ Browser bundle ว่าไม่มี Supabase secret หรือ Discord token

`vercel.json` ทำ SPA fallback โดยไม่กลบ `/api/*`

ก่อน deploy ให้รัน `npm run test:runtime` เพื่อตรวจว่า API Export ที่ compile แล้วโหลดด้วย Node ESM ได้ และสร้างไฟล์ได้ทั้ง 3 รูปแบบ โดยไม่ต้องเชื่อมฐานข้อมูล
การ import JSON ฝั่ง server ต้องใช้ `with { type: 'json' }`; Vite/Vitest อาจโหลดได้แม้ขาด attribute นี้ แต่ Node บน Vercel จะหยุดด้วย `ERR_IMPORT_ATTRIBUTE_MISSING` ก่อนเข้า handler
