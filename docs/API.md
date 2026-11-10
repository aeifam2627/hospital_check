# HTTP API

ทุก endpoint ใช้ `Cache-Control: no-store`, ตรวจ method/origin/payload และเชื่อม Supabase ด้วย server-only secret
`POST /api/submissions` จำกัด 30 คำขอใน 5 นาทีต่อ client และ Export จำกัด 10 คำขอต่อนาทีด้วย atomic Supabase rate-limit bucket

- `GET /api/inspection-types?date=YYYY-MM-DD`
- `GET /api/inspection-form?type=slug&date=YYYY-MM-DD&shift=daily|night|morning|afternoon`
- `GET /api/inspectors`
- `POST /api/submissions`
- `GET /api/dashboard?date=YYYY-MM-DD`
- `GET /api/history?from=YYYY-MM-DD&to=YYYY-MM-DD&type=slug`
- `GET /api/export?period=day|month|year&date=YYYY-MM-DD&type=slug&format=detail|legacy`

Export ส่ง `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` และอ่านข้อมูลเป็นหน้าละ 1,000 แถว สูงสุด 50,000 แถวต่อคำขอ
