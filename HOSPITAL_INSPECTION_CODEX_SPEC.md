# Hospital Daily Inspection System — Specification for Codex

> **เวอร์ชัน:** 1.0 | **วันที่จัดทำ:** 9 พฤศจิกายน 2569 (2026-11-09)  
> **สถานะ:** ข้อกำหนดสำหรับลงมือพัฒนา MVP / ส่วนที่ต้องยืนยันระบุ `PENDING`  
> **กลุ่มผู้ใช้:** เจ้าหน้าที่โรงพยาบาลที่ตรวจนับยา อุปกรณ์ในรถ Emergency และเครื่องมือแพทย์  
> **หลักการสำคัญที่สุด:** **Mobile-first · ใช้ง่าย · กรอกตัวเลขเป็นหลัก · ไม่ต้อง Login · ข้อมูลย้อนหลังต้องไม่หาย**

---

## 0. คำสั่งถึง Codex (อ่านก่อนเริ่ม)

คุณคือ Senior Full-stack Engineer และ UX Engineer โปรดพัฒนาระบบตามเอกสารนี้เป็น **แอปที่ทำงานได้จริง** ไม่ใช่หน้าจอ Mockup เท่านั้น โดยใช้ไฟล์ Excel ต้นฉบับ 3 ไฟล์เป็นข้อมูลอ้างอิงเมื่อมีไฟล์อยู่ใน Repository หรือผู้ใช้แนบให้

**สิ่งที่ห้ามทำ**

- **ห้ามใช้ Next.js**; ต้องใช้ React + Vite + TypeScript และ Deploy บน Vercel
- **ห้ามเพิ่มหน้า Login / Sign-up / ระบบบัญชีผู้ใช้ / รหัสผ่านกลาง / PIN ผู้ใช้** ในแอปสำหรับเจ้าหน้าที่
- ห้ามทำให้ฟอร์มซับซ้อน เช่น บังคับให้เลือกสถานะ OK/ไม่ OK สำหรับทุกแถว; **ให้กรอกจำนวนจริงเป็นตัวเลขเท่านั้น** และระบบคำนวณความต่างอัตโนมัติ
- ห้ามฝังรายการยา/เครื่องมือไว้ตายตัวใน React; รายการทั้งหมดต้องมาจาก Supabase
- ห้ามเติมค่าเริ่มต้นของช่องกรอกเป็นจำนวนมาตรฐานโดยอัตโนมัติ เพราะอาจทำให้บันทึกว่า “ตรวจแล้ว” ทั้งที่ยังไม่ได้ตรวจ
- ห้ามถือว่าเซลล์ว่างใน Excel = 0 และห้ามถือว่า `5/5`, `2/1` เป็นการหารหรือทศนิยม
- ห้ามให้การนำเข้าข้อมูลย้อนหลังส่งแจ้งเตือน Discord เหมือนการบันทึกใหม่
- ห้าม expose `SUPABASE_SECRET_KEY` / `SERVICE_ROLE_KEY` / `DISCORD_BOT_TOKEN` ฝั่ง Browser
- ห้ามเพิ่มขั้นตอนที่ทำให้เจ้าหน้าที่ต้องคลิกหลายครั้งโดยไม่จำเป็น

**วิธีทำงาน:** ตั้งโครงสร้างโปรเจกต์ → DB migrations + seed → API → UI mobile-first → Discord → Excel import/export → tests → Deployment docs. ตัดสินใจเรื่อง implementation ย่อยตาม Best Practice โดยไม่ถามซ้ำในเรื่องที่เอกสารระบุแล้ว; เรื่องที่ `PENDING` ให้ทำเป็น Config พร้อมค่าเริ่มต้นที่ไม่แจ้งเตือนผิดพลาด

## 1. เป้าหมายและขอบเขต

ระบบทดแทนการกรอก Google Form และ Excel สำหรับตรวจนับความพร้อมประจำวันของโรงพยาบาล โดยใช้เว็บแอปตัวเดียวทั้งบนมือถือ แท็บเล็ต และคอมพิวเตอร์

**ประเภทเริ่มต้น 3 เรื่อง**

1. **ตรวจสอบยา** — 25 รายการหลักตามต้นฉบับ; ข้อมูลเก่ามีแบบรายวันใน ส.ค. 2569 และมีคอลัมน์ `ด / ช / บ` ใน ก.ย.–ธ.ค. 2569
2. **ตรวจสอบรถ Emergency** — รายการจัดตาม **ชั้นบน และชั้นที่ 1–4**; มีรายการแบบหลายชนิด/ขนาดในบรรทัดเดียว และมีรายการเพิ่มเติมบางเดือน; แบบรายวันใน ส.ค. และมีคอลัมน์เวรใน ก.ย.–ธ.ค.
3. **ตรวจสอบเครื่องมือแพทย์** — **21 รายการหลัก ตรวจวันละ 1 ครั้ง ไม่มีเวร** (ผู้ใช้ยืนยัน); มี 3 รายการหลักที่มีสองประเภทย่อย จึงเป็น **24 ช่องจำนวน** ในฟอร์มเริ่มต้น

**อนาคต:** สามารถเพิ่มประเภทตรวจใหม่ รายการใหม่ รุ่น/ขนาดใหม่ จำนวนมาตรฐานใหม่ หรือปิดใช้รายการเดิม ผ่านข้อมูล Config ใน Supabase โดยไม่แก้ Source Code หรือ Deploy เว็บใหม่

**ผู้ใช้:** เปิดเว็บแล้วกรอกได้ทันที ไม่ต้อง Login. ให้เลือกผู้ตรวจจากรายชื่อ หรือ “อื่น ๆ” แล้วกรอกชื่อ; ไม่ใช่การยืนยันตัวตนจริง

**ฟีเจอร์หลัก**

- ฟอร์มจำนวนจริงตามวัน/เวรของแต่ละประเภท
- Dashboard รวมและ Dashboard รายประเภท พร้อมประวัติย้อนหลัง
- Export `.xlsx` ตาม **วัน / เดือน / ปี** และประเภทที่เลือก
- Discord แจ้งเตือน **ทันทีเมื่อมีการบันทึก** และ **สรุปท้ายเวร/สรุปรายวันตามเวลาที่กำหนด**
- 1 เรื่อง = 1 Discord Text Channel; มีห้องภาพรวมแยก; รองรับเพิ่มเรื่องใหม่โดย Mapping Channel ID
- Import Excel เก่าเข้าฐานข้อมูลแบบตรวจสอบก่อนจริง (dry-run) และไม่ทำข้อมูลซ้ำ
- เก็บข้อมูลมาตรฐานตามช่วงเวลาเพื่อให้รายงานย้อนหลังไม่เปลี่ยนเมื่อเพิ่ม/ย้าย/ยกเลิกเครื่องมือ

**ไม่อยู่ใน MVP:** ระบบเวชระเบียนผู้ป่วย, ระบบจ่ายยา, คลังสินค้าซับซ้อน, Scan Barcode, ระบบตารางเวรบุคคล, ระบบบัญชีรายคน, การแชตโต้ตอบกับ Discord Bot, ฟีเจอร์ AI.

---

## 2. Tech Stack ที่ตัดสินใจแล้ว

| ชั้น | เทคโนโลยี | หมายเหตุ |
|---|---|---|
| Frontend | **React + Vite + TypeScript** | SPA; ห้าม Next.js |
| Styling | **Tailwind CSS** | Mobile-first และ Design Tokens |
| Components | **shadcn/ui** (React) + Lucide Icons | ใช้เท่าที่จำเป็น ไม่ทำ UI หนัก |
| Routing | React Router | `/`, `/inspect/:type`, `/dashboard`, `/history`, `/reports` |
| Forms | React Hook Form + Zod | จำนวนเป็น integer ไม่ติดลบ, แยก blank ออกจาก 0 |
| Data fetching | TanStack Query | loading/error/invalidation |
| Backend HTTP | **Vercel Functions** ใน `api/` | API สำหรับอ่าน/เขียน/Export โดยไม่ expose key |
| Database | **Supabase PostgreSQL** | migrations, index, constraints, transaction |
| Automation | **Supabase Cron + Edge Functions** | งานสรุป ตรวจครบ และ retry Discord |
| Discord | **Discord Bot REST API** | Bot เดียวส่งได้หลาย Channel; ไม่ต้องเปิด Gateway process ค้างไว้ถ้าส่งข้อความทางเดียว |
| Excel | **ExcelJS ฝั่ง Server** | สร้าง `.xlsx`, ไม่โหลดทั้งปีมาไว้ในเบราว์เซอร์ |
| Hosting | **Vercel** | เชื่อม GitHub, build `npm run build`, output `dist` |
| Testing | Vitest + React Testing Library + Playwright | มีมือถือใน E2E profiles |

หมายเหตุ: เครื่องมือแพทย์และยาบางชนิดมีความอ่อนไหวด้านปฏิบัติการ องค์กรต้องรับทราบก่อนเปิดแสดงข้อมูลต่อ Internet และส่งไป Discord. **Vercel เป็น Public Cloud ไม่ใช่ LAN-only** แม้ใช้งานเพื่อภายในโรงพยาบาล; ระบบนี้ไม่มี Login ตามที่เจ้าของงานตัดสินใจ

---

## 3. Mobile-first UX/UI — ความสำคัญสูงสุด

### 3.1 Responsive breakpoints และข้อกำหนดการใช้งาน

| ขนาดจอ | วิธีแสดง |
|---|---|
| **320–430px** (มือถือหลัก) | 1 คอลัมน์, Card list, input ขนาดพอดีนิ้ว, Bottom Navigation, Sticky Save Bar |
| 431–767px | รูปแบบมือถือกว้าง 1 คอลัมน์ หรือ 2 คอลัมน์เฉพาะส่วนที่ไม่ทำให้ฟอร์มอ่านยาก |
| 768–1023px (Tablet) | เนื้อหา 2 คอลัมน์เฉพาะ Dashboard; ฟอร์มอาจแบ่งหมวดเป็น 2 คอลัมน์ถ้าอ่านได้ |
| ≥1024px (Desktop) | Container max-width ประมาณ 1100–1280px, Sidebar และตารางได้ |

**เกณฑ์ UX ที่ต้องผ่าน**

- ใช้งานด้วยมือเดียวได้บนจอ 360/375/390px; **ไม่มี horizontal scroll ในฟอร์ม**
- Touch target ขั้นต่ำ **44 × 44px**, spacing ระหว่าง input เพียงพอ ไม่กดผิด
- Input และปุ่มใช้ฟอนต์อ่านง่าย (input ≥16px ป้องกัน iOS zoom), Contrast เข้าถึงได้, Focus visible, label ผูกกับ input
- รองรับ safe-area ของ iPhone (`env(safe-area-inset-bottom)`), virtual keyboard ไม่บดบังปุ่มส่ง, และสถานะ Loading / Error / Retry
- ใช้ **`inputmode="numeric"`** และ Validation จำนวนเต็ม ≥0; หลีกเลี่ยงปัญหา `<input type="number">` ที่รับ `e`, `-` หรือเลขทศนิยมในบาง Browser (เลือกใช้ `type="text"` + parser แบบควบคุมได้)
- ห้ามใส่ค่าจำนวนมาตรฐานไว้เป็น *value* ตั้งต้น; แสดง “มาตรฐาน 5 เส้น” เป็นข้อความประกอบหรือ placeholder ที่ไม่ถูกนับว่าตรวจ
- `0` เป็นค่าที่เจ้าหน้าที่ตั้งใจกรอกและต้องเก็บเป็น 0 จริง; `''/null` = ยังไม่กรอก
- Show progress เช่น “กรอกแล้ว 17/24 ช่อง”; คิดจาก **ช่องจำนวนย่อยที่ต้องกรอก** ไม่ใช่จำนวน Card
- มี Search/Filter ชื่อรายการ และ Collapse หมวด เช่น ชั้นของรถ Emergency โดยจำสถานะหมวดระหว่างการกรอก
- Scroll ไปช่องที่ขาดเมื่อกดบันทึก; ด้านล่างมี Sticky bar “17/24 · บันทึกผล”
- ไม่เปิด Modal หลายชั้น; เมื่อครบกด “บันทึก” → แสดงยืนยันแบบกระชับเฉพาะเมื่อมีจำนวนต่างมาตรฐาน/แก้ข้อมูลเก่า
- รองรับ 3 สถานะชัดเจน: **ยังไม่ตรวจ / ตรวจครบ / ตรวจครบแต่จำนวนต่างมาตรฐาน** และ **กรอกไม่ครบ** ก่อนส่ง
- UI ภาษาไทยเป็นหลัก; ปีในหน้าจอแสดง **พ.ศ.**, ข้อมูล DB ใช้วันที่ ค.ศ. ISO; timezone = **Asia/Bangkok**
- Skeleton/empty state; Dashboard ไม่จำเป็นต้องใช้กราฟหากทำให้มือถือรก
- ใช้ Tailwind design token สี: เทา/ขาวพื้น, เขียวตรวจครบ, เหลืองเตือน, แดงจำนวนต่ำกว่าเกณฑ์; **อย่าพึ่งสีอย่างเดียว** ต้องมีข้อความด้วย
- **เป้าหมาย:** เจ้าหน้าที่เปิดหน้าประเภท → กรอกตัวเลข → เลือกชื่อ → บันทึก ภายใน 1 หน้าจอเลื่อนลง ไม่ต้องเปลี่ยนหน้าไปมา

### 3.2 Information Architecture

```text
/                     หน้าหลัก: 3 Card ประเภท + สถานะวันนี้ + เมนูด้านล่าง
/inspect/:slug        ฟอร์มบันทึกตามประเภท, วัน, เวร (เฉพาะประเภทที่มีเวร)
/dashboard            KPI และสถานะครบ/ไม่ครบของวันนี้ + เปลี่ยนวัน
/history              ดูบันทึกย้อนหลัง/รายละเอียดแต่ละรอบ
/reports              เลือกวัน/เดือน/ปี + ประเภท + Export .xlsx
```

**Bottom Navigation บนมือถือ:** `หน้าหลัก | บันทึก | Dashboard | รายงาน`; `ประวัติ` เข้าจาก Dashboard หรือหน้าเมนู. เมื่อกด “บันทึก” เลือกประเภทได้ใน Bottom Sheet หรือลิสต์ ไม่เพิ่มขั้นตอนโดยไม่จำเป็น

### 3.3 หน้าฟอร์มตรวจ (สำคัญที่สุด)

ส่วนบนแบบ Compact:

```text
← ตรวจสอบเครื่องมือแพทย์
วันจันทร์ที่ 9 พ.ย. 2569           [เปลี่ยนวันที่]
ตรวจวันละ 1 ครั้ง                   (ไม่มีช่องเวร)

กรอกแล้ว 8 / 24 ช่อง               [Progress bar]
[ค้นหารายการ...] 

┌────────────────────────────────────┐
│ เครื่อง Defrib                     │
│ มาตรฐาน: 2 เครื่อง       [  2  ]  │
└────────────────────────────────────┘
┌────────────────────────────────────┐
│ BP ตั้งโต๊ะ ผู้ใหญ่/เด็ก           │
│ ผู้ใหญ่ · มาตรฐาน 2      [  2  ]   │
│ เด็ก     · มาตรฐาน 1     [  1  ]   │
└────────────────────────────────────┘
...
ชื่อผู้ตรวจ [เลือกชื่อ ▼] [อื่น ๆ]
หมายเหตุ (ไม่บังคับ) [............]

[ Sticky: กรอก 8/24  |  บันทึกผล ]
```

- วันปัจจุบันถูกเลือกอัตโนมัติ; เปลี่ยนย้อนหลังได้เพื่อแก้/เติมย้อนหลัง โดยต้องแสดงคำเตือนเมื่อบันทึกย้อนหลัง
- ประเภทที่มีเวรเท่านั้นแสดง Segmented Control `ดึก / เช้า / บ่าย`; แสดงรอบจาก Config ไม่ hardcode
- สำหรับรถ Emergency ให้มีหัวข้อ `ชั้นบน, ชั้นที่ 1, ชั้นที่ 2, ชั้นที่ 3, ชั้นที่ 4` ตามแผ่นงานเดิม พร้อมจำนวนช่องที่กรอกแล้วของแต่ละชั้น
- สามารถเลื่อนด้วยปุ่ม `ถัดไป` หรือ keyboard tab ได้เร็ว; อย่าเปิด keypad ใหม่ทุกครั้งที่เปลี่ยน Card โดยไม่จำเป็น
- เลือกผู้ตรวจจาก dropdown; ตัวเลือก “อื่น ๆ” พิมพ์ชื่อได้; บังคับชื่อก่อนส่ง แต่ **ไม่ต้อง Login**
- มี Autosave draft แบบ Local Storage โดย Scope ตาม `ประเภท + วันที่ + เวร`; ถ้ากลับมาให้ถาม “พบข้อมูลที่ยังไม่ได้ส่ง ต้องการเรียกคืนหรือไม่?”; ลบ draft หลังส่งสำเร็จ; อย่าเรียก draft ว่าบันทึกลงระบบแล้ว
- หากข้อมูลรอบนั้นส่งแล้ว ให้แสดงผลเดิมพร้อมปุ่ม “แก้ไขผล” และเตือนว่าจะเก็บประวัติการแก้ไขใหม่; ต้องไม่สร้างซ้ำ
- ก่อนกดส่งต้องครบทุกช่องที่มีผลในวันนั้น; หากยังไม่ครบ highlight ช่องที่ขาด; ห้ามแทนช่องว่างเป็นศูนย์

### 3.4 Dashboard บนมือถือ

- Card วันนี้: `ตรวจครบ X/Y รอบ`, `ยังไม่ส่ง X รอบ`, `จำนวนต่างมาตรฐาน X รายการ`
- แสดง 3 หมวดหลักเป็น Card มีชื่อ, รอบที่ต้องตรวจ, เวลาส่งล่าสุด, ชื่อผู้บันทึก, สถานะ
- ถ้าประเภทเป็น `daily` ให้แสดง `รายวัน` ไม่แสดง `เวร: -`
- กด Card เพื่อดูรายละเอียด รายการที่จำนวนต่างมาตรฐาน และประวัติเพิ่มเติม
- เปลี่ยนวัน/เดือน/ปี; ตารางรายละเอียดบนจอเล็กใช้ Card/Accordion ไม่บีบตารางแนวนอน
- **คำจำกัดความ:** “ส่งข้อมูลครบ” = กรอกครบทุกช่องที่ต้องกรอก ไม่ใช่ “จำนวนตรงมาตรฐาน”; `0` ที่กรอกแล้วถือว่าได้ตรวจ แต่ต้องแจ้งผิดปกติถ้าต่ำกว่าเกณฑ์

### 3.5 Export Excel

- เลือก **รายวัน / รายเดือน / รายปี** และ **ทุกประเภทหรือเลือกหนึ่งประเภท**
- ส่งออก `.xlsx` จริง ไม่ใช่ CSV เปลี่ยนนามสกุล
- รายงานแบบอ่านง่าย: Sheet `สรุป`, และ Sheets ตามประเภทหรือเดือนตามช่วงที่เลือก
- โหมด `รายละเอียดแนวยาว (long-form)` สำหรับ Pivot/วิเคราะห์: date, shift, category, group, item, variant, standard_qty, actual_qty, unit, inspector_name, submitted_at, source
- หากทำได้ให้มีโหมด `รูปแบบคล้าย Excel เดิม` (วันที่เป็นคอลัมน์) สำหรับงานรายเดือน แต่ต้องคงการแยกข้อมูลย่อยอย่างไม่กำกวม
- คอลัมน์วันที่แสดงตามไทยได้ แต่เก็บเป็น Excel Date Cell ที่ Sort ได้; เวลาบันทึกแสดง Asia/Bangkok
- ผู้ใช้ดาวน์โหลดได้บนมือถือ Safari/Chrome ด้วยชื่อไฟล์เป็น ASCII หรือ Thai-safe เช่น `hospital-inspection-2026-11.xlsx`
- อ่านข้อมูลทีละหน้า/เป็น chunk ฝั่ง Server เมื่อ Export รายปี; ไม่อัด JSON ทั้งปีมาที่ Browser

---

## 4. กติกาเรื่องวัน เวร และการตรวจครบ

| ประเภท | ระบบใหม่ | การตีความไฟล์ย้อนหลัง |
|---|---|---|
| **เครื่องมือแพทย์** | **วันละ 1 ครั้ง ไม่มีเวร** — ยืนยันแล้ว | ทุกเดือนรายวัน |
| **ยา** | เลือกเวรเฉพาะเมื่อ Schedule กำหนด | ส.ค. 2569 รายวัน; ก.ย.–ธ.ค. มีคอลัมน์ `ด/ช/บ` |
| **รถ Emergency** | เลือกเวรเฉพาะเมื่อ Schedule กำหนด | ส.ค. 2569 รายวัน; ก.ย.–ธ.ค. มีคอลัมน์ `ด/ช/บ` |

**`PENDING`:** แม้ยาและรถ Emergency จะมีคอลัมน์ 3 เวรใน Excel บางเดือน แต่ยัง **ไม่ได้ยืนยันว่าทุกเวรจำเป็นต้องส่งข้อมูลทุกวัน**. Codex ต้องรองรับการกำหนด *required cycles* ตามประเภท วัน และช่วงเวลา และ **ไม่เปิดการแจ้งเตือนว่าเวรขาดโดยปริยาย** จนเจ้าของงานตั้งค่าให้ชัดเจน

`shift_code`: `daily | night | morning | afternoon` (database ควรเก็บเป็น NOT NULL string; `daily` สำหรับไม่แยกเวร เพื่อรองรับ Unique Constraint ได้ง่าย). เก็บ `work_date` = วันที่ปฏิบัติงานของรอบ; เวรข้ามเที่ยงคืนมี `cutoff_time` และ `cutoff_day_offset` เพื่อสรุปเช้าวันถัดไปอย่างถูกต้อง

สำหรับรายการในแต่ละรอบต้องเก็บ **standard quantity snapshot** ตามวันที่นั้น หากเพิ่ม/ปิด/เปลี่ยนจำนวนภายหลัง รายงานเก่าต้องไม่เปลี่ยน หรือกลายเป็น “บันทึกไม่ครบ” ย้อนหลัง

---

## 5. การแยกชนิด / เบอร์ภายในรายการเดียว

**ให้เจ้าหน้าที่กรอกจำนวนเท่านั้น** แต่แสดงเป็นหลายช่องย่อยใต้ชื่อรายการเดียวเมื่อมีหลายชนิดหรือหลายเบอร์ เช่น:

| หมวด | รายการหลัก | ช่องย่อย + จำนวนมาตรฐานเริ่มต้นจาก Excel |
|---|---|---|
| รถ Emergency | สาย suction No.14/16 | No.14 = 5, No.16 = 5 (ผู้ใช้ยืนยันความหมาย `5/5`) |
| รถ Emergency | กรรไกร, ไฟฉาย | กรรไกร = 1, ไฟฉาย = 1 |
| รถ Emergency | สาย ICD No.28,32 | No.28 = 2, No.32 = 2 |
| รถ Emergency | เอี่ยม/แว่นตา | เอี่ยม = 5, แว่นตา = 2 |
| รถ Emergency | สาย NG no.14/no.16 | No.14 และ No.16 (จำนวนที่ถูกแปลงเป็นวันที่ใน Excel ต้องตรวจ/ยืนยันก่อน Seed เป็นมาตรฐาน) |
| เครื่องมือแพทย์ | BP ตั้งโต๊ะผู้ใหญ่/เด็ก | ผู้ใหญ่ / เด็ก (Excel แสดง `2/1`, รอยืนยันเกณฑ์จริง) |
| เครื่องมือแพทย์ | กรรไกรตัดไหม/ตัดเนื้อ | ตัดไหม / ตัดเนื้อ (`2/6`, รอยืนยันเกณฑ์จริง) |
| เครื่องมือแพทย์ | Atery โค้ง/ตรง | โค้ง / ตรง (`2/2`, รอยืนยันเกณฑ์จริง) |

- เก็บ **parent item + variants** ใน DB; 1 parent อาจมี 1 variant (รายการธรรมดา) หรือหลาย variant (แยกชนิด)
- ค่าของแต่ละ variant เป็น integer ≥0; ไม่รับ `5/5` ลงใน field เดียว
- ใน UI แสดงรายการหลักเพียงหนึ่ง Card ที่มี input 2 ช่องได้; export สามารถรวมเป็น `5/5` เฉพาะ presentation แบบ Excel เดิม โดยแถวข้อมูลรายละเอียดยังคงแยก
- Excel อาจบันทึกตัวเลขลักษณะ `2/1`, `5/3` เป็น **Excel Date Serial** เช่น `46024`, `46055`, `46175`, `46147` หรือมีเครื่องหมาย `,` / `.`; ห้ามแปลงโดยเดาตามตัวเลขดิบ ต้องอ่าน cell number format, displayed value, และจับคู่ชื่อรายการ; หากกำกวมให้ Flag เพื่อให้คนตรวจ
- `เข็ม Biosy (1 ชุดมี 3 ชิ้น)` ให้จำนวนจริงเป็นหน่วย **ชุด** ไม่แปลงเป็น 3 ชิ้นอัตโนมัติ

---

## 6. Database Model (Supabase PostgreSQL)

Codex ต้องสร้าง **SQL migrations ที่รันได้จริง**, seed, foreign keys, indexes, constraints, timestamps และ test DB รวมถึง TypeScript types. ใช้ UUID PK ได้ และชื่อ/slug ควรเป็น Unique ตามความเหมาะสม

| Table | Columns สำคัญ | หน้าที่ |
|---|---|---|
| `inspection_types` | id, slug, title_th, schedule_mode (`daily`/`shift`), sort_order, is_active, discord_channel_id nullable | ชนิดแบบตรวจ; เพิ่มเรื่องใหม่จาก DB |
| `inspection_groups` | id, inspection_type_id, name, sort_order | ชั้นบน/ชั้น 1–4 หรือกลุ่มอื่น |
| `inspection_items` | id, inspection_type_id, group_id nullable, name, sort_order, active_from, active_to nullable | Parent item, เก็บประวัติการเปิดใช้ |
| `inspection_variants` | id, item_id, variant_label nullable, unit, sort_order, active_from, active_to nullable | ช่องตัวเลขที่ต้องกรอกจริง |
| `variant_standards` | id, variant_id, standard_qty, effective_from, effective_to nullable | ประวัติจำนวนมาตรฐานแบบ effective-dated; ไม่ update ย้อนหลัง |
| `inspectors` | id, display_name, is_active, sort_order | รายชื่อใน Dropdown |
| `inspection_schedules` | id, inspection_type_id, shift_code, required, effective_from, effective_to, cutoff_local_time, cutoff_day_offset, timezone | รอบที่ต้องส่งและเวลาตรวจครบ |
| `inspection_submissions` | id, inspection_type_id, work_date, shift_code (`daily` ถ้าไม่มีเวร), inspector_name, notes nullable, source (`web_form`/`excel_import`), submitted_at, created_at, updated_at, revision_number | หัวผลตรวจต่อรอบ; ต้องมี unique หนึ่ง current submission ต่อ type/date/shift |
| `inspection_results` | id, submission_id, variant_id, actual_qty nullable, standard_qty_snapshot, item_name_snapshot, variant_label_snapshot, unit_snapshot | ข้อมูลรายช่องที่มีผล ณ วันที่ส่ง |
| `submission_revisions` | id, submission_id, revision_no, previous_payload jsonb, revised_at, inspector_name, reason nullable | ประวัติการแทนที่/แก้ไขผลตรวจ |
| `notification_schedules` | id, inspection_type_id nullable, shift_code nullable, notification_kind (`shift_summary`/`daily_summary`), send_local_time, day_offset, enabled, channel_id_override nullable | เวลาส่ง Discord แยกประเภท/ห้อง |
| `notification_outbox` | id, notification_kind, reference_id, target_channel_id, payload jsonb, status, attempts, next_retry_at, sent_at, discord_message_id nullable, dedupe_key unique | ส่ง Discord แบบ retry ได้ ไม่ส่งซ้ำ |
| `notification_logs` | id, outbox_id, attempted_at, result, error_text nullable | ประวัติการส่ง |
| `import_batches` | id, source_file, imported_at, status, source_checksum, row_count, warnings jsonb | ตรวจสอบ/ย้อนการนำเข้าชุดเก่า |
| `import_row_evidence` | id, batch_id, sheet_name, source_cell, raw_value, parsed_value jsonb, parse_status | ที่มาของค่าที่กำกวมจาก Excel |
| `audit_events` | id, kind, reference_id, created_at, actor_name nullable, payload jsonb | ประวัติการเปลี่ยนแปลงสำคัญ |

**ข้อกำหนด DB เพิ่มเติม:**

1. `inspection_submissions` ต้องกันการสร้างซ้ำ: Unique (`inspection_type_id`, `work_date`, `shift_code`) โดย `shift_code` ไม่เป็น null
2. `inspection_results` Unique (`submission_id`, `variant_id`)
3. ใช้ transactions เมื่อส่งฟอร์ม ทั้ง header + results + revision + outbox ต้อง atomic
4. จำนวนเป็นจำนวนเต็มเท่านั้น `CHECK (actual_qty >= 0)`, ช่วงจำนวนสมเหตุสมผลที่ configurable; ส่งผิดรูปแบบต้องได้ HTTP 400 พร้อมข้อความไทย
5. หากเปลี่ยนจำนวนมาตรฐาน/ปิดรายการ ต้องบันทึก effective date; ห้ามลบผลย้อนหลังแบบ cascade ที่ทำลายข้อมูล
6. รอบตรวจและจำนวนช่องที่คาดหวังในแต่ละวันคำนวณจาก schedule/variants ที่มีผลในวันนั้น ไม่ใช่จำนวนรายการ “ปัจจุบัน”
7. แยก `submitted_at` (เวลาที่เซิร์ฟเวอร์รับข้อมูลจริง) ออกจาก `work_date` (วันที่ตรวจ); **ห้ามสร้าง timestamp ย้อนหลังปลอมสำหรับ Excel เดิม**
8. หากข้อมูลนำเข้าจาก Excel ไม่มีชื่อผู้ตรวจ ต้องเก็บ `inspector_name = 'ไม่ปรากฏชื่อในต้นฉบับ'` หรือ nullable พร้อม display fallback; แต่ตอนกรอกผ่าน Web บังคับเลือกชื่อ

**Security / Access:** ไม่ทำระบบ Auth ในแอปและไม่ทำ RLS แบบเปิดเขียนทุกตารางให้ `anon`. ให้ Browser เรียก `/api/*` ของ Vercel Functions; เก็บ Supabase secret key เฉพาะ Server; DB RLS ปฏิเสธ direct anonymous data writes; routes อ่านข้อมูลสาธารณะเท่าที่แอปต้องการและ routes เขียนตรวจสอบ payload/limit/size/rate. ห้ามทำ SQL จาก String concatenation หรือเปิด generic CRUD endpoint

---

## 7. API Contract (Vercel Functions)

ให้เขียน Zod Schema ทั้ง request/response และ typed API client. เสนอชุด Endpoints ขั้นต่ำ:

| Method + Path | งาน |
|---|---|
| `GET /api/inspection-types` | รายการประเภทที่ Active พร้อม status วันนี้/การตั้งค่าแบบฟอร์ม |
| `GET /api/inspection-form?type=...&date=...&shift=...` | รายการ group/item/variants พร้อมมาตรฐานตามวัน, ค่าที่บันทึกเดิมถ้ามี |
| `GET /api/inspectors` | รายชื่อผู้ตรวจที่ Active |
| `POST /api/submissions` | ตรวจข้อมูล → เขียนแบบ transaction → คิว Discord ทันที |
| `GET /api/submissions?type=...&date=...&shift=...` | ดูผลตรวจ, revision ที่เป็น current |
| `GET /api/dashboard?date=...` | KPI และผลตรวจ/เวรที่คาดหวังในวันนั้น |
| `GET /api/history?from=...&to=...&type=...` | ดูย้อนหลังแบบ pagination |
| `GET /api/export?period=day|month|year&date=...&type=...&format=detail|legacy` | Download `.xlsx` |

`POST /api/submissions` ตัวอย่าง payload:

```json
{
  "type_slug": "medical-equipment",
  "work_date": "2026-11-09",
  "shift_code": "daily",
  "inspector_name": "นางสาว ก.",
  "notes": "",
  "revision_expected": 0,
  "idempotency_key": "browser-generated-uuid",
  "results": [
    { "variant_id": "uuid-from-server-form", "actual_qty": 2 },
    { "variant_id": "another-uuid", "actual_qty": 0 }
  ]
}
```

- ต้องตรวจว่าจำนวน `variant_id` ตรงกับรายการที่ใช้จริงในวันที่/เวรนั้น และไม่ซ้ำกัน; ห้ามรับ `standard_qty` จาก Client เป็น Source of Truth
- เวร `daily` สำหรับเครื่องมือแพทย์; วัน/เวลา Server ใช้ timezone และ DB timestamp อย่างถูกต้อง
- ป้องกัน Double Submit ด้วย idempotency key; ถ้าแก้รายการเดิมใช้ optimistic concurrency (`revision_expected`) และสร้าง `submission_revisions`
- Response ชัดเจนว่าบันทึกสำเร็จแม้ Discord กำลัง Retry; Discord ส่งไม่สำเร็จ **ไม่ใช่การบันทึกผลตรวจล้มเหลว**
- Limit ขนาด Request, คุมความถี่/จำนวน submissions, escape notes/inspector_name, ไม่สะท้อน secrets ใน error; อย่าพึ่ง `Origin` หรือ CORS เป็นมาตรการป้องกันหลัก
- ใช้ `Cache-Control: no-store` สำหรับข้อมูลผลตรวจ/รายงานที่ไม่ควรค้าง และปิด indexing ของเว็บถ้าใช้งานภายใน (`robots.txt` เป็นเพียงลดการค้นพบ ไม่ใช่ Security)

**ไม่ทำหน้า Login.** ข้อแลกเปลี่ยนคือใครที่ทราบ URL อาจเข้าดู/ส่งข้อมูลได้ ต้องทำ Abuse Protection ขั้นพื้นฐานโดยไม่เพิ่มขั้นตอนกรอกของเจ้าหน้าที่ เช่น server validation, request limits แบบไม่กีดขวางหลายเครื่องที่แชร์ NAT/IP และ telemetry; อาจเปิด CAPTCHA เฉพาะเมื่อผิดปกติในอนาคต ข้อจำกัดนี้ต้องเขียนชัดใน README

---

## 8. Discord: แยก 1 เรื่อง = 1 ห้อง และตั้งเวลารายงานได้

**Discord Bot เดียว** มีสิทธิ์ `View Channel`, `Send Messages`, `Embed Links` ในห้องที่กำหนด; ไม่ต้องเปิด Gateway หรือใช้ `discord.js` process ตลอดเวลา หากความต้องการคือส่งข้อความทางเดียว (ใช้ HTTP API)

ตัวอย่างการผูกห้อง:

```text
#ตรวจสอบ-ยา                ← inspection_types.slug = medication
#ตรวจสอบ-รถ-emergency     ← inspection_types.slug = emergency-cart
#ตรวจสอบ-เครื่องมือแพทย์   ← inspection_types.slug = medical-equipment
#สรุปผลประจำวัน            ← channel รวม (setting กลาง)
#ตรวจสอบ-ถังออกซิเจน       ← เพิ่มใหม่ในอนาคตได้
```

การเพิ่มประเภทใหม่: ผู้ดูแลสร้างห้อง Discord และนำ Channel ID มาผูกกับ `inspection_types.discord_channel_id` พร้อมรายการใหม่ใน DB. ไม่ต้องเพิ่ม Bot ใหม่หรือแก้โค้ด

### 8.1 เหตุการณ์ A — เมื่อเจ้าหน้าที่บันทึกทันที

ส่งเข้าห้องของประเภทนั้นหลัง DB commit พร้อม:

- ชื่อประเภท / วันที่ตรวจ (**พ.ศ.**) / **เวลาที่ส่งจริง (Asia/Bangkok)**
- **ชื่อผู้บันทึก** จาก Dropdown/กรอกเอง (ไม่ใช่ตัวตนที่ผ่านการ Auth)
- **เวร** เฉพาะประเภทที่มีเวร; **เครื่องมือแพทย์ไม่แสดงเวร**
- `ครบ 24/24 ช่อง` หรือจำนวนที่ตรงกับแบบฟอร์มจริง ณ วันนั้น
- จำนวนรายการที่ **ต่างมาตรฐาน** พร้อมรายการที่แตกต่าง (รายการละไม่กี่บรรทัด; ถ้าเยอะให้สรุป + Link ไป Dashboard)
- หากเป็นแก้ไข ให้เขียนว่า “แก้ไขบันทึก ครั้งที่ N” ไม่เป็น “บันทึกใหม่”
- มี Link กลับสู่หน้าดูรายละเอียด (ไม่แนบ key/token)

ตัวอย่าง:

```text
[ตรวจสอบเครื่องมือแพทย์] บันทึกผลเรียบร้อย
วันที่ตรวจ: 9 พ.ย. 2569
เวลาบันทึก: 15:42 น. (เวลาไทย)
ผู้บันทึก: นางสาว ก.
ตรวจครบ: 24/24 ช่อง
จำนวนต่างมาตรฐาน: 2 ช่อง
- เครื่อง Defrib: มาตรฐาน 2 / พบ 1
- Infusion pump Body grad: มาตรฐาน 2 / พบ 0
ดูรายละเอียด: https://<domain>/history/...
```

### 8.2 เหตุการณ์ B — สรุปท้ายเวร/สรุปรายวันตามเวลาที่กำหนด

- ตั้งค่าต่อประเภทได้ว่า summary เวลา HH:mm, timezone `Asia/Bangkok`, shift, day offset, enabled
- เครื่องมือแพทย์ = Summary รายวัน **1 ครั้ง** (ไม่มีเวร)
- ยา/รถ Emergency = ถ้ากำหนดรอบเวรจริง ให้สรุปเฉพาะเวรที่ต้องตรวจ
- Report ต้องแสดง **มีใครบันทึก เวลาเท่าไร**, ส่งครบ/ยังขาด, ผลต่างมาตรฐาน, หมายเหตุส่งต่อเวร (ถ้าเจ้าหน้าที่กรอก)
- เวรข้ามเที่ยงคืนยึด `work_date` ของเวร และเวลาปิดรอบที่ตั้งค่า
- ถ้ารอบนั้นยังไม่ถึง Cutoff ห้ามแจ้งว่าขาด; `PENDING` schedule ที่ยังไม่ยืนยันให้ปิด completeness reminder จนกำหนดจริง
- มีการส่งห้องรวม `#สรุปผลประจำวัน` แบบไม่ duplicate รายข้อความต้นฉบับ
- ทุก message set `allowed_mentions: { "parse": [] }` ป้องกันชื่อ/หมายเหตุที่มี `@everyone` ทำให้ mention ไม่ตั้งใจ

### 8.3 การส่งให้เชื่อถือได้

- `POST /api/submissions` เขียน `notification_outbox` ลง DB ใน transaction เดียวกัน; หลัง commit ให้ invoke sender หรือใช้ Database Webhook + Edge Function; Cron เป็นตัว Retry ข้อมูลที่ pending/failed
- Supabase Cron เรียก Edge Function ทุก 1–5 นาทีเพื่อตรวจ Summary ที่ถึงกำหนด และ Retry Outbox; อย่าใช้ Cron ที่เช็คเฉพาะเวลาตรงนาทีเป๊ะแล้วพลาดเมื่อ Job delay
- Unique `dedupe_key` แยก event เช่น `submission:<id>:rev:<n>` และ `summary:<type>:<work_date>:<shift>`
- ถ้า Discord ตอบ rate limit 429 ให้เคารพ `Retry-After` และ log สถานะ; ห้ามส่งซ้ำเมื่อเคยสำเร็จแล้ว
- **Migration จาก Excel ไม่สร้าง outbox ส่งย้อนหลัง**
- Bot Token อยู่เฉพาะ Server/Edge Secrets และ Channel ID เป็น string ขนาดใหญ่ (Discord Snowflake ไม่ parse เป็น JS Number)
- ไม่ส่งข้อมูลผู้ป่วยหรือข้อมูลระบุตัวผู้ป่วยลง Discord

---

## 9. การนำเข้าข้อมูล Excel เดิม (Migration)

ไฟล์ต้นฉบับ:

```text
ตาราง OK ยา.xlsx
ตาราง OK รถ Emergency.xlsx
ตารางOk เครื่องมือแพทย์.xlsx
```

ตรวจสอบพบ 5 Worksheet ต่อไฟล์ (`ส.ค.–ธ.ค. 2569`) รวม **15 Worksheet**. บางเดือนเป็นตารางเตรียมล่วงหน้าที่ไม่มีข้อมูลจริง; **ไม่สร้างผลตรวจสำหรับช่องว่างทั้งหมด**

### 9.1 ขั้นตอนที่ Codex ต้องทำ

1. สร้าง CLI `scripts/import-legacy-excel.ts` (หากสะดวกใช้ Python script แยกได้) ที่รองรับ `--dry-run` และ `--commit`
2. อ่าน worksheet/merged headers/วัน/เวร/ค่าของแต่ละรายการอย่างถูกต้อง โดย **ห้ามอิงเลขแถวคงที่เพียงอย่างเดียว**
3. map ชื่อรายการจาก Excel เป็น `inspection_items` / `variants` ที่ Stable ID; ระบุ alias ของชื่อที่เปลี่ยนสะกดได้ เช่น Othamoscope / otoscope, Carifix Stretch / Carifix Stretch1
4. เก็บ `raw_value`, source file, sheet, row, cell และ parse warning โดยเฉพาะเซลล์ที่ Excel เปลี่ยน `2/1` เป็น serial date
5. `0` คือค่าตรวจจริง; `blank` คือไม่บันทึก. หากวัน/เวรมีข้อมูลเพียงบางแถว ให้บันทึก import status ว่า `partial` ไม่เติมที่เหลือ
6. หาก sheet มีแถวข้อมูลอื่นปะปนใต้รายการ (พบในไฟล์เครื่องมือแพทย์) ให้ข้าม แต่ออก log ไม่ย้ายเข้ารายการเครื่องมือ
7. Import ก่อนเปิดระบบจริง; ข้อมูลใหม่จากเว็บต้องมี priority ไม่ให้การ Import รอบหลัง overwrite
8. ใช้ checksum / unique source key / idempotent upsert; รันซ้ำต้องไม่ทำข้อมูลซ้ำ
9. แสดงรายงาน `จำนวน Worksheet / จำนวนวันและรอบที่มีข้อมูล / จำนวนเซลล์ที่แปลง / จำนวนรายการกำกวม / วันที่ไม่มีข้อมูล / ตัวอย่างข้อมูล 10 รายการ`
10. **รอบที่ parse กำกวมต้องยังไม่ commit เป็นจำนวนจริง** ให้เขียน exception report และเก็บ source evidence เพื่อให้ผู้รับผิดชอบยืนยัน

### 9.2 กติกาสำหรับวันที่/เวรที่เปลี่ยนรูปแบบ

- ส.ค. 2569: ยาและรถ Emergency แบบรายวัน (`shift_code='daily'` สำหรับข้อมูลย้อนหลังเท่านั้น)
- ก.ย.–ธ.ค. 2569: ยาและรถ Emergency มีคอลัมน์ย่อย `ด/ช/บ`; ต้อง map เป็น `night/morning/afternoon` ต่อ **วันที่** ตาม merged header
- เครื่องมือแพทย์: `daily` ทุกเดือน ไม่ต้องมีเวร
- วันใน Sheet ให้ผูกกับเดือน/ปีจากชื่อ Sheet; ตรวจจำนวนวันจริงของเดือน เช่น 30/31
- มาตรฐานกับผลตรวจในแถวเดียวกันต้องแยก `standard quantity` และ `actual quantity` อย่างระมัดระวัง
- ชื่อผู้ตรวจจากแถว `ผู้ตรวจสอบ` (เมื่อมี) ให้ map ตามวันที่/เวร; ช่องที่ไม่มีชื่อให้แสดงว่าไม่พบชื่อในต้นฉบับ
- `submitted_at` สำหรับ Excel เก่า = null ถ้าไม่มีเวลาจริง; เก็บ `imported_at` แยก

### 9.3 QA หลัง Migration

- สุ่มเทียบอย่างน้อย 10 วัน/เวรข้ามทั้ง 3 ประเภทกับ Excel ต้นฉบับ
- Test แถวที่ `0`, แถวที่ว่าง, `5,5`, `1,1`, `2,2`, `5,2`, `2/1`, `2/6`, `2/2`, ตัวเลข serial date, ชื่อที่สะกดไม่เหมือนกัน, รายการที่เพิ่มเดือน พ.ย.
- Test การ Import ซ้ำ 2 ครั้ง = จำนวนข้อมูลไม่เพิ่ม
- Dashboard ย้อนหลังแสดงครบตามข้อมูลที่มีจริง ไม่ตีความวันว่างเป็นตรวจแล้ว
- Discord Outbox ต้องไม่เพิ่มข้อความสำหรับ Historical Import
- ต้องให้เจ้าของงานตรวจ exception report ก่อนตัดสินใจนำค่าที่กำกวมเป็นข้อมูลหลัก

---

## 10. รายการจาก Excel สำหรับ Seed เริ่มต้น

**สำคัญ:** ชื่อ/จำนวนบางรายการสะกดตามต้นฉบับ ไม่ควรแก้ความหมายทางการแพทย์เอง ให้ normalize aliases แบบไม่ทำลายชื่อดั้งเดิม

### 10.1 ยา: 25 รายการหลัก (ตามชีตสิงหาคม)

1. Morphine (ยาเสพติด) — 2 Amp
2. Pethidine (ยาเสพติด) — 1 Amp
3. Dormicum (ยาเสพติด) — 2 Amp
4. Fentanyl (ยาเสพติด) — 2 Amp
5. Ventolin NB (ยาพ่น) — 2 ขวด
6. Levophed 4 mg — 2 Amp
7. 7.5%NaHCo3 — 2 Amp
8. 10%calcium gluconate — 1 Amp
9. Dopamine 500 mg — 2 Amp
10. Adrenaline 1 mg — 10 Amp
11. Diazepam 10 mg — 2 Amp
12. Dexamethazone 4 mg — 5 Amp
13. CPM 10 mg — 2 Amp
14. Holoperidol 5 mg — 2 Amp
15. 50%glucose 50 ml — 2 Amp
16. ASA 300 mg — 5 เม็ด
17. Amlodipine 10 mg — 5 เม็ด
18. Captopril 25 mg — 5 เม็ด
19. Clopidogrel 75 mg — 8 เม็ด
20. Hydralazine 25 mg — 5 เม็ด
21. Isordil 5 mg — 5 เม็ด
22. HN(70/30) 10 ml (ตู้เย็น) — 2 ขวด
23. NPH 10 ml (ตู้เย็น) — 1 ขวด
24. RI 10 ml (ตู้เย็น) — 2 ขวด
25. กระเป๋า CPR — 2 กล่อง

### 10.2 เครื่องมือแพทย์: 21 รายการหลัก (`daily`, ไม่มีเวร)

1. เครื่อง Defrib — 2
2. เครื่อง EKG — 1
3. เครื่อง NIBP Monitor — 10
4. Infusion pump 1 ทาง — 14
5. Infusion pump Body grad — 2
6. เครื่องอุ่นเลือด — 1
7. เครื่อง O2 Sat — 1
8. เครื่องตรวจ Urin space — 1
9. เครื่องตรวจ DTX — 2
10. เครื่อง Suction mobile — 1
11. BP ตั้งโต๊ะผู้ใหญ่/เด็ก — สอง variant: ผู้ใหญ่ / เด็ก (baseline แสดง `2/1`; ต้องยืนยัน)
12. ปรอทวัดไข้ดิจิตอล — 10
13. Peak Flow — 1
14. กรรไกรตัดไหม/ตัดเนื้อ — สอง variant: ตัดไหม / ตัดเนื้อ (แสดง `2/6`; ต้องยืนยัน)
15. Atery โค้ง/ตรง — สอง variant: โค้ง / ตรง (แสดง `2/2`; ต้องยืนยัน)
16. เข็ม Biosy (1 ชุดมี 3 ชิ้น) — 1 ชุด
17. เข็มเจาะปอด — 3
18. ด้ามมีด — 3
19. HFNC — 6
20. Stethoscope — 4
21. สายเครื่องช่วยหายใจ — 3 (ในบาง Sheet มีหมายเหตุตำแหน่ง “อยู่ห้องหัตถการ”)

ตรวจชื่อ/มาตรฐานกับผู้รับผิดชอบก่อน production โดยเฉพาะรายการที่ข้อมูลถูก Excel แปลงเป็นวันที่และจำนวนจริงในบางเดือนแตกต่างจาก baseline

### 10.3 รถ Emergency: กลุ่มและรายการเริ่มต้น

**ชั้นบน:** ถุงมือ, mask, Set ทำแผล, สาย suction No.14/16, ถุงมือ steri  
**ชั้นที่ 1:** Laryngoscope, เครื่อง Othamoscope/otoscope, Carifix Stretch, กรรไกร/ไฟฉาย, เครื่องจับเวลา, ข้อต่อ 3 ทาง, Lubrieate Jelly, Guide Wire, สาย ICD No.28/32, Syring 10 cc  
**ชั้นที่ 2:** ET-tube No.6, No.6.5, No.7, No.7.5, No.8, ตัวหนอน, Air Way, Filter, T-piece  
**ชั้นที่ 3:** Ambu bag ผู้ใหญ่, Tracheostomy Tube  
**ชั้นที่ 4:** ปลั๊กไฟ, หมอนทราย, เอี่ยม/แว่นตา; และในเดือน พ.ย. พบรายการเพิ่ม เช่น สาย NG no.14/no.16, เข็มเจาะหลัง, Urine bag, สาย foley's cath, set C-line, DLC

ให้ Codex ประมวลผลจากทุก Worksheet เพื่อสร้าง **effective-dated seed ที่ตรงกับแต่ละเดือน** ไม่ใช่นำรายการเดือน พ.ย. ไปใส่ย้อนหลังสิงหาคมทันที

---

## 11. เพิ่มรายการ/เรื่องใหม่ในอนาคต โดยไม่เพิ่ม Login

- **ฟอร์มของเจ้าหน้าที่ไม่มี Login และไม่มีหน้าจัดการที่บังคับรหัส** ตามความต้องการปัจจุบัน
- **MVP:** ผู้รับผิดชอบแก้รายการ Config ใน **Supabase Dashboard** (ใช้สิทธิ์ของเจ้าของ Supabase ซึ่งอยู่นอกแอป) เพื่อลดความเสี่ยงที่ใครก็ได้แก้จำนวนมาตรฐาน
- จัด Seed/DB ให้เพิ่มประเภท, หมวด, รายการ, variant, จำนวนมาตรฐาน, วันเริ่มใช้งาน, รอบตรวจ, Discord Channel ID ได้โดยไม่แก้ Source Code
- ถ้าจะมีหน้า “จัดการรายการ” ในเว็บภายหลัง ต้องคุยเรื่องวิธีคุมสิทธิ์ก่อน เพราะแอปไม่ Login; **อย่าแอบสร้างหน้า Admin ที่เปิดเขียน Master Data โดยไม่มีการป้องกัน**
- ไม่ใช้ `DELETE` ลบรายการที่เคยตรวจ; ให้ปิด `is_active` หรือกำหนด `active_to` เพื่อรักษาประวัติ

---

## 12. Repo Structure ที่ต้องการ

```text
hospital-inspection/
├─ api/
│  ├─ inspection-types.ts
│  ├─ inspection-form.ts
│  ├─ inspectors.ts
│  ├─ submissions.ts
│  ├─ dashboard.ts
│  ├─ history.ts
│  └─ export.ts
├─ src/
│  ├─ app/                # Router, Providers, layouts
│  ├─ components/
│  │  ├─ ui/              # shadcn/ui
│  │  ├─ inspection/      # CountInput, ItemCard, GroupAccordion, StickySaveBar
│  │  ├─ dashboard/
│  │  └─ shared/
│  ├─ pages/              # Home, Inspection, Dashboard, History, Reports
│  ├─ hooks/
│  ├─ lib/                # API client, dates, Thai locale, validation
│  └─ types/
├─ server/                # Helpers for Vercel Functions and ExcelJS
├─ supabase/
│  ├─ migrations/
│  ├─ seed.sql
│  └─ functions/
│     ├─ send-discord/
│     └─ check-inspection-schedules/
├─ scripts/
│  └─ import-legacy-excel.ts
├─ tests/
│  ├─ unit/
│  ├─ api/
│  ├─ migration/
│  └─ e2e/
├─ docs/
│  ├─ API.md
│  ├─ DATABASE.md
│  ├─ MIGRATION.md
│  ├─ DISCORD_SETUP.md
│  └─ DEPLOY_VERCEL.md
├─ .env.example
├─ .gitignore
├─ vercel.json
├─ package.json
└─ README.md
```

โครงสร้างเป็นข้อเสนอ สามารถปรับชื่อให้เป็นมาตรฐานที่สอดคล้องกันได้ แต่ต้องแยก `frontend / api / database / scripts / tests` ชัดเจน และเก็บ Source Excel ดิบให้พ้นจาก Public Git Repo

**Environment variables ตัวอย่าง:**

```dotenv
# Server only — ใส่ใน Vercel/Edge Secrets ห้าม VITE_ prefix
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SECRET_KEY=YOUR_SERVER_ONLY_SECRET
DISCORD_BOT_TOKEN=YOUR_DISCORD_BOT_TOKEN
DISCORD_DAILY_SUMMARY_CHANNEL_ID=YOUR_CHANNEL_ID
APP_BASE_URL=https://YOUR_APP.vercel.app

# Browser: ไม่จำเป็นต้องมี DB Secret หรือ Bot Token
VITE_APP_TITLE=Hospital Inspection
```

ถ้าทำ CLI/import script ให้แยก env ของ local และอย่า commit `.env`, Bot Token, DB credentials หรือข้อมูลผู้ป่วย

---

## 13. Tests & Acceptance Criteria — ต้องผ่านก่อนส่งมอบ

### 13.1 Mobile-first

- [ ] Playwright E2E ทดสอบ viewport **320 × 700, 375 × 812, 390 × 844, 768 × 1024, 1366 × 768**
- [ ] ที่ 320/375/390px ไม่มี Horizontal Scroll ในฟอร์มและ Navigation
- [ ] ช่องจำนวนกดง่าย (≥44px), มี keyboard numeric บน iOS/Android, ไม่ zoom อัตโนมัติ
- [ ] Sticky Save Bar ไม่ทับช่องกรอกและ keyboard
- [ ] การกรอก 21 รายการหลักของเครื่องมือแพทย์ (24 ช่อง) ใช้งานได้ด้วยมือถือ
- [ ] มี Loading, Network Error, Retry และ Local Draft Recovery

### 13.2 ข้อมูล/เวร

- [ ] เครื่องมือแพทย์: เลือกวัน + กรอกจำนวน + เลือกชื่อ + บันทึก; **ไม่มีเวร** ทุกหน้า/Discord/Excel
- [ ] ยาและรถ Emergency: เลือกเวรเมื่อ Configure ให้มีเวร; ข้อมูล Excel เดือนสิงหาคมยังอ่านย้อนหลังเป็น daily ได้
- [ ] `0` บันทึกเป็น 0; ช่องว่างบันทึกไม่ผ่าน; ไม่ถือว่าครบเพียงเพราะค่าเท่ามาตรฐานที่อยู่ใน placeholder
- [ ] รายการ `สาย suction No.14/16` แสดงสองช่อง, 5/5 ไม่ใช่ 5.5
- [ ] ค่า `2/1`, `2/6`, `2/2` ของเครื่องมือแพทย์เก็บแยก variant ตามที่ยืนยัน
- [ ] แก้ไขรอบเดิมได้โดยไม่สร้างแถวซ้ำ และมี Revision History
- [ ] เพิ่มรายการใหม่ effective date ใน Supabase → แบบฟอร์มแสดงตั้งแต่วันนั้น; รายงานเก่าไม่เปลี่ยน

### 13.3 Discord

- [ ] ส่ง Message ไป **Channel ที่ตรงกับประเภท** ทุกครั้งที่บันทึกสำเร็จ
- [ ] แสดงชื่อผู้ตรวจ, work date, เวลาบันทึกจริง, เวรเฉพาะประเภทที่มี, ผลครบ, จำนวนต่างมาตรฐาน
- [ ] Summary ตามเวลา Config แยกตามประเภท; daily สำหรับเครื่องมือแพทย์
- [ ] ไม่มีการแจ้งขาดก่อน Cutoff และไม่ถือว่าทุกเวรต้องส่งจนกว่าจะ Configure ว่า required
- [ ] เมื่อ Discord 429/5xx มี Retry และไม่ส่งซ้ำเมื่อเคยสำเร็จ
- [ ] Import Excel ไม่สร้าง Discord Notification

### 13.4 Dashboard / Export / Import

- [ ] Dashboard สรุปผลส่งครบ vs จำนวนตรงมาตรฐานเป็นคนละตัวชี้วัด
- [ ] Date / Month / Year filters ทำงานบนมือถือและคอมพิวเตอร์
- [ ] `.xlsx` ดาวน์โหลดจริงและเปิดได้ใน Microsoft Excel / LibreOffice
- [ ] Report เวลาตรง Asia/Bangkok, แยก daily กับ shifts ถูกต้อง
- [ ] Import Dry-run สร้าง Warning Report; แยก blank จาก 0; import ซ้ำไม่เพิ่มจำนวนแถว
- [ ] ความต่างชื่อ/serial date ไม่ทำให้เกิดอุปกรณ์หมายเลข 46024 หรือจำนวน 46175 ชิ้น

### 13.5 Security / Delivery

- [ ] App **ไม่มี Login** ตามข้อกำหนด
- [ ] Browser Bundle ไม่มี Secret Key / Discord Token
- [ ] Direct public anonymous write ไป Supabase master tables ทำไม่ได้
- [ ] API ทดสอบ invalid payload, oversized payload, double submit, concurrency, rate-control
- [ ] `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build` ผ่าน
- [ ] Deploy Vercel แล้ว Deep Link `/inspect/...`, `/dashboard` และ `/api/*` ไม่ 404; SPA fallback ไม่กลบ API routes
- [ ] README มีวิธี Setup Supabase, Run migration/seed, Discord Bot, Cron, Vercel env, Import, Backup/Restore

---

## 14. Roadmap การ Implement (ลำดับที่ Codex ควรทำ)

**Phase A — โครงสร้างฐานและต้นแบบ UX**
1. Scaffold React + Vite + TS + Tailwind + shadcn/ui + Router, ทดสอบ viewport มือถือจริง
2. สร้าง DB schema, dynamic seed สำหรับ 3 ประเภท, list/variant/schedule, fixtures
3. ทำหน้าบ้าน + หน้าฟอร์ม Mobile-first ให้กรอกและบันทึกจริง

**Phase B — รายงานและ Discord**
4. หน้ารวม/ประวัติและ Dashboard คำนวณ completeness ถูกต้อง
5. Discord Bot/outbox + Cron summaries + Channel mapping ต่อประเภท
6. Excel Export day/month/year (`.xlsx` จริง)

**Phase C — ย้ายข้อมูลและทดสอบเปิดใช้งาน**
7. Import script จาก Excel 3 ไฟล์, dry-run, exception report, ยืนยันข้อมูลกำกวม
8. Mobile E2E/DB/Discord integration tests, Security Review, ปรับประสิทธิภาพ
9. Deploy Vercel + Supabase และทดสอบรอบจริงก่อน Cutover; เก็บ Excel เดิมเป็น Backup

**Definition of Done:** มี Source Code, Database Migrations, Seed, Edge Functions, Import CLI, หน้า Web Responsive, Tests, `.env.example`, Setup README และ Deployment Guide. ไม่ถือว่าเสร็จจากภาพ UI หรือ Mock Data อย่างเดียว

---

## 15. ประเด็นที่ต้องให้เจ้าหน้าที่/เจ้าของงานยืนยัน (PENDING — อย่าคาดเดา)

1. **ยาและรถ Emergency:** 3 เวรเป็นรอบ **ที่ต้องตรวจจริงทุกวัน** หรือเป็นเพียงช่องเผื่อใน Excel? หากต้องตรวจ กำหนดเวรดึก/เช้า/บ่ายเริ่ม-สิ้นสุดเวลาใด และให้ Bot สรุปเมื่อใด?
2. **ค่ามาตรฐานรูปแบบแยกประเภท:** ยืนยันตัวเลขในรายการเครื่องมือแพทย์ `BP 2/1`, `กรรไกร 2/6`, `Atery 2/2` และรายการสาย NG ที่ Excel เก็บเป็น Serial Date (ชื่อแยกเบอร์ยืนยันได้ แต่ค่าตัวเลขยังต้องตรวจ)
3. **รายชื่อผู้ตรวจ:** ใครเป็นรายชื่อ Seed เริ่มต้น? ให้เลือกชื่อหรือกรอกเองได้ตาม Spec
4. **ตั้งเวลา Discord:** HH:mm จริงของแต่ละประเภท/เวร และเวลาสรุปภาพรวม (MVP ต้อง Config ได้ โดยมี `enabled=false` หากยังไม่ยืนยัน)
5. **ความปลอดภัย:** ผู้รับผิดชอบโรงพยาบาลยอมรับการใช้ Vercel Public URL โดยไม่มี Login และการส่งข้อมูลจำนวนยา/อุปกรณ์ขึ้น Discord หรือไม่? ต้องตรวจนโยบายหน่วยงาน

รายการ `PENDING` **ไม่ใช่เหตุให้หยุดพัฒนาส่วนอื่น**: ให้ Codex ใช้ Config และเปิดเฉพาะฟังก์ชันที่ยืนยันแล้ว โดยไม่สร้างข้อมูลหรือแจ้งเตือนผิดความหมาย

---

## 16. Documentation / Official References

- Vite บน Vercel (รวม API Functions และ SPA deep link): https://vercel.com/docs/frameworks/frontend/vite
- Supabase Cron: https://supabase.com/docs/guides/cron
- Schedule Supabase Edge Functions: https://supabase.com/docs/guides/functions/schedule-functions
- Supabase Row Level Security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Supabase Secure Data: https://supabase.com/docs/guides/database/secure-data
- Discord Bot REST: https://discord.com/developers/docs/resources/message
- Discord API Reference: https://discord.com/developers/docs/reference
- Discord Webhook (ทางเลือกเมื่อส่งออกทางเดียว): https://discord.com/developers/docs/resources/webhook

---

## 17. Prompt สั้นสำหรับเริ่มงานใน Codex

คัดลอกข้อความด้านล่างส่งให้ Codex พร้อมไฟล์นี้และ Excel ต้นฉบับทั้งสามไฟล์:

> **อ่าน `HOSPITAL_INSPECTION_CODEX_SPEC.md` ให้ครบทุกหัวข้อ แล้วพัฒนาระบบ Hospital Daily Inspection System ที่ใช้งานได้จริงตาม Specification โดยยึด Mobile-first Responsive เป็น Priority สูงสุด ใช้ React + Vite + TypeScript, Supabase PostgreSQL, Vercel Functions, Supabase Cron/Edge Functions และ Discord Bot ห้าม Next.js และห้ามสร้างระบบ Login ให้สร้าง SQL migrations/seed, Dynamic Forms ทั้งสามประเภท, Dashboard, Export .xlsx, Discord notifications/shift summaries, Historical Excel importer แบบ dry-run และ tests ครบถ้วน รายการ/เวร/จำนวน/เวลาที่เอกสารระบุ PENDING ต้องตั้งเป็น Config และห้ามเดาแทนเจ้าหน้าที่ เริ่มจาก Phase A ตาม Roadmap และเขียน README ติดตั้ง/Deploy ให้ทดสอบได้จริง ก่อนจบให้รายงานสิ่งที่เสร็จและสิ่งที่ยังรอยืนยัน ไม่ส่งมอบแค่ Mockup.**

