# Deploy Vercel

1. ตั้ง `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `APP_BASE_URL`, `ALLOWED_ORIGINS` ใน Vercel Project Settings
2. รัน Supabase migrations ตามลำดับและ seed
3. Deploy ด้วย build command `npm run build`, output `dist`
4. ตรวจ `/api/dashboard?date=YYYY-MM-DD` และดาวน์โหลด `/api/export?...` จาก production URL
5. ตรวจ Browser bundle ว่าไม่มี Supabase secret หรือ Discord token

`vercel.json` ทำ SPA fallback โดยไม่กลบ `/api/*`
