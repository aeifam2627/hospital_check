# Backup and restore

ก่อน migration หรือ cutover ให้สำรอง Supabase PostgreSQL ด้วย Dashboard backup หรือ `pg_dump` ที่รวม schema และ data และเก็บ Excel ต้นฉบับแบบ read-only แยกจาก public repository

ลำดับ restore ที่แนะนำ:

1. สร้าง Supabase project/database เปล่า
2. Restore database dump
3. ตรวจ migrations และ RLS
4. Deploy Edge Functions และตั้ง Vault/Function secrets ใหม่
5. ตรวจจำนวน `inspection_submissions`, `inspection_results`, `import_batches`, `notification_outbox`
6. เปิดเว็บในโหมดตรวจสอบก่อนให้เจ้าหน้าที่บันทึกจริง

อย่าใช้ Excel import เป็นวิธี restore หลัก เพราะ evidence, revisions, audit events และ notification status ไม่ได้อยู่ในไฟล์ Excel เดิม
