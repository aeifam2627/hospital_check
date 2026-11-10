# Database notes

Migration หลักอยู่ที่ `supabase/migrations/202611090001_phase_a_schema.sql` และ seed อยู่ที่ `supabase/seed.sql`

## หลักการสำคัญ

- `inspection_items`, `inspection_variants`, `variant_standards` ใช้ effective date เพื่อให้แก้ master data โดยไม่เปลี่ยนรายงานย้อนหลัง
- `inspection_results` เก็บ snapshot ของชื่อ, variant, unit และ standard ณ วันที่บันทึก
- หนึ่ง submission ต่อ `(inspection_type_id, work_date, shift_code)`; `daily` เป็นค่าจริง ไม่ใช้ `NULL`
- `save_inspection_submission(jsonb)` ล็อก submission เดิมและทำ revision/results/audit ใน transaction เดียว
- ทุกตารางเปิด RLS และไม่มี policy สำหรับ `anon`/`authenticated`; server ใช้ `service_role` ผ่าน Vercel Function เท่านั้น

การแก้ master data ให้กำหนด `active_to` หรือเพิ่ม standard ช่วงใหม่ ห้ามลบแถวที่มีประวัติ
