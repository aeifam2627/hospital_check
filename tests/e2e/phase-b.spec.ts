import { expect,test,type Page } from '@playwright/test'

const dashboard={work_date:'2026-11-09',kpi:{expected_slots:1,submitted_slots:1,missing_slots:0,difference_count:1},types:[
  {id:'1',slug:'medication',title_th:'ยา',schedule_mode:'shift',expected_slots:0,submitted_slots:0,is_complete:null,latest_submitted_at:null,latest_inspector:null,difference_count:0,submissions:[],differences:[]},
  {id:'2',slug:'emergency-cart',title_th:'รถ Emergency',schedule_mode:'shift',expected_slots:0,submitted_slots:0,is_complete:null,latest_submitted_at:null,latest_inspector:null,difference_count:0,submissions:[],differences:[]},
  {id:'3',slug:'medical-equipment',title_th:'เครื่องมือแพทย์',schedule_mode:'daily',expected_slots:1,submitted_slots:1,is_complete:true,latest_submitted_at:'2026-11-09T08:42:00Z',latest_inspector:'เจ้าหน้าที่ทดสอบ',difference_count:1,submissions:[{id:'s1',shift_code:'daily',inspector_name:'เจ้าหน้าที่ทดสอบ',submitted_at:'2026-11-09T08:42:00Z',completed_fields:24,difference_count:1,revision_number:0}],differences:[{submission_id:'s1',shift_code:'daily',item:'เครื่อง Defrib',variant:null,standard_qty:2,actual_qty:0,unit:'เครื่อง'}]},
]}
const history={total:25,items:[{id:'s1',type_slug:'medical-equipment',title_th:'เครื่องมือแพทย์',schedule_mode:'daily',work_date:'2026-11-09',shift_code:'daily',inspector_name:'เจ้าหน้าที่ทดสอบ',notes:'ติดตามเครื่อง',submitted_at:'2026-11-09T08:42:00Z',revision_number:0,completed_fields:24,difference_count:1,differences:[{item:'เครื่อง Defrib',variant:null,standard_qty:2,actual_qty:0,unit:'เครื่อง'}]}]}
async function mock(page:Page){await page.route('**/api/dashboard**',r=>r.fulfill({json:{data:dashboard}}));await page.route('**/api/history**',r=>r.fulfill({json:{data:history}}));await page.route('**/api/export**',r=>r.fulfill({status:200,headers:{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':'attachment; filename="hospital-inspection-test.xlsx"'},body:'xlsx-test'}))}

for(const width of [320,375,390,768,1366]) test(`Phase B pages fit ${width}px`,async({page})=>{await page.setViewportSize({width,height:844});await mock(page);for(const path of ['/dashboard','/history','/reports']){await page.goto(path);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true)}})

test('graphs expose values, filter shifts and work with reduced motion',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await mock(page);await page.goto('/dashboard')
  const charts=page.getByRole('region',{name:'กราฟผลการตรวจ'})
  await expect(charts.getByText('ตรง 23 · ทบทวน 1')).toBeVisible()
  await charts.getByRole('button',{name:'เช้า',exact:true}).click()
  await expect(charts.getByText('ยังไม่มีบันทึกในรอบที่เลือก')).toBeVisible()
  await charts.getByRole('button',{name:'รายวัน',exact:true}).click()
  await expect(charts.locator('.chart-bar-row strong').filter({hasText:'1 รอบ'})).toBeVisible()
})

test('all-data download defaults to the original template and supports details',async({page})=>{
  await mock(page);await page.goto('/reports')
  await expect(page.getByRole('radio',{name:/แบบต้นฉบับ/})).toBeChecked()
  await page.getByRole('button',{name:'ทั้งหมด',exact:true}).click()
  await expect(page.locator('input[type=month]')).toHaveCount(0)
  let requested=page.waitForRequest(r=>r.url().includes('/api/export'))
  await page.getByRole('button',{name:'ดาวน์โหลด .xlsx'}).click()
  expect((await requested).url()).toContain('period=all')
  await page.getByRole('radio',{name:/รายละเอียดทั้งหมด/}).check()
  requested=page.waitForRequest(r=>r.url().includes('/api/export'))
  await page.getByRole('button',{name:'ดาวน์โหลด .xlsx'}).click()
  expect((await requested).url()).toContain('format=detail')
})

test('dashboard separates completeness from standard differences',async({page})=>{await page.setViewportSize({width:390,height:844});await mock(page);await page.goto('/dashboard');await expect(page.locator('.kpi-strip>div').first()).toContainText('บันทึกผลแล้ว1รอบตรวจ');await expect(page.getByText('1 ค่าต้องทบทวน')).toBeVisible();await page.locator('.summary-card summary').filter({hasText:'เครื่องมือแพทย์'}).click();await expect(page.getByText('มาตรฐาน 2 / พบ')).toBeVisible()})
test('history and report controls expose operational details',async({page})=>{await page.setViewportSize({width:390,height:844});await mock(page);await page.goto('/history');await page.locator('.history-card summary').click();await expect(page.getByText('ติดตามเครื่อง')).toBeVisible();const nextRequest=page.waitForRequest(request=>request.url().includes('/api/history')&&request.url().includes('page=2'));await page.getByRole('button',{name:'ถัดไป'}).click();await nextRequest;await page.goto('/reports');await page.getByRole('button',{name:'รายปี'}).click();const requested=page.waitForRequest(request=>request.url().includes('/api/export'));await page.getByRole('button',{name:'ดาวน์โหลด .xlsx'}).click();const request=await requested;expect(request.url()).toContain('period=year');expect(request.url()).toContain('format=original');await expect(page.getByText('ดาวน์โหลดรายงานสำเร็จ')).toBeVisible()})
test('capture Phase B dashboard evidence',async({page})=>{await page.setViewportSize({width:390,height:844});await mock(page);await page.goto('/dashboard');await page.screenshot({path:'.impeccable/review/dashboard-mobile.png',fullPage:true})})
test('capture Phase B desktop evidence',async({page})=>{await page.setViewportSize({width:1366,height:768});await mock(page);await page.goto('/dashboard');await page.screenshot({path:'.impeccable/review/desktop.png',fullPage:true})})
