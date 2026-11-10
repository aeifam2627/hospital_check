# Legacy Excel migration

CLI รองรับไฟล์ `.xlsx` ทีละไฟล์และทำ dry-run เป็นค่าเริ่มต้น

```bash
npm run import:legacy -- --file "ตาราง OK ยา.xlsx" --dry-run
npm run import:legacy -- --file "ตาราง OK รถ Emergency.xlsx" --type emergency-cart --dry-run --out emergency-report.json
```

Dry-run ทำงานได้โดยไม่มี Supabase ด้วย catalog จากสเปก แต่ commit ต้องตั้ง `SUPABASE_URL` และ `SUPABASE_SECRET_KEY` เพื่อโหลด Stable UUID จากฐานข้อมูล

```bash
npm run import:legacy -- --file "ตารางOk เครื่องมือแพทย์.xlsx" --commit
```

Importer ตรวจชื่อ sheet เพื่อหาเดือน/ปี พ.ศ., ค้นหาแถวหัววันที่โดยไม่ยึดเลขแถว, อ่าน merged date headers และ `ด/ช/บ`, แยก variant เช่น `5/5`, รักษา `0` และข้ามช่องว่าง ค่า Date Cell/serial date หรือรูปแบบกำกวมจะถูกเก็บเป็น evidence แต่ไม่ commit รอบนั้น

รายงาน JSON มีจำนวน worksheet, รอบที่พบข้อมูล, converted/ambiguous cells, วันที่ว่าง, warning และตัวอย่าง 10 รอบ ควรให้เจ้าของข้อมูลตรวจ exception report ก่อนใช้ `--commit`

ข้อจำกัด: ต้องนำไฟล์จริงทั้งสามมาทำ dry-run ก่อน cutover เนื่องจาก workspace ไม่มี source Excel และ parser จงใจไม่เดาโครงแถวที่ยังไม่เคยเห็น
