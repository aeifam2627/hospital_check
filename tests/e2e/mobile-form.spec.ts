import { expect, test, type Page } from '@playwright/test'

const names = ['เครื่อง Defrib','เครื่อง EKG','เครื่อง NIBP Monitor','Infusion pump 1 ทาง','Infusion pump Body grad','เครื่องอุ่นเลือด','เครื่อง O2 Sat','เครื่องตรวจ Urin space','เครื่องตรวจ DTX','เครื่อง Suction mobile','BP ตั้งโต๊ะผู้ใหญ่/เด็ก','ปรอทวัดไข้ดิจิตอล','Peak Flow','กรรไกรตัดไหม/ตัดเนื้อ','Atery โค้ง/ตรง','เข็ม Biosy (1 ชุดมี 3 ชิ้น)','เข็มเจาะปอด','ด้ามมีด','HFNC','Stethoscope','สายเครื่องช่วยหายใจ']
const split = new Set(['BP ตั้งโต๊ะผู้ใหญ่/เด็ก','กรรไกรตัดไหม/ตัดเนื้อ','Atery โค้ง/ตรง'])
const items = names.map((name, index) => ({ id: `item-${index}`, name, variants: Array.from({ length: split.has(name) ? 2 : 1 }, (_, variant) => ({ id: `00000000-0000-4000-8000-${String(index * 2 + variant).padStart(12,'0')}`, variant_label: split.has(name) ? ['แบบที่ 1','แบบที่ 2'][variant] : null, unit: 'ชิ้น', standard_qty: 2 })) }))

async function mockApi(page: Page) {
  await page.route('**/api/inspection-form**', (route) => route.fulfill({ json: { data: { type: { id: 'type-1', slug: 'medical-equipment', title_th: 'เครื่องมือแพทย์', schedule_mode: 'daily' }, work_date: '2026-11-09', shift_code: 'daily', schedules: [{ shift_code: 'daily', required: true }], groups: [{ id: null, name: null, items }], existing_submission: null } } }))
  await page.route('**/api/inspectors', (route) => route.fulfill({ json: { data: [{ id: 'person-1', display_name: 'เจ้าหน้าที่ทดสอบ' }] } }))
  await page.route('**/api/submissions', (route) => route.fulfill({ json: { data: { id: 'saved-1', revision_number: 0, updated: false } } }))
}

for (const viewport of [{ width: 320, height: 700 },{ width: 375, height: 812 },{ width: 390, height: 844 },{ width: 768, height: 1024 },{ width: 1366, height: 768 }]) {
  test(`no horizontal overflow at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport); await mockApi(page); await page.goto('/inspect/medical-equipment')
    await expect(page.getByRole('heading', { name: 'เครื่องมือแพทย์' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  })
}

test('mobile user fills 24 fields, keeps zero and saves', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await mockApi(page); await page.goto('/inspect/medical-equipment')
  const inputs = page.locator('.count-input-wrap input'); await expect(inputs).toHaveCount(24)
  await expect(page.locator('.standard-ratio')).toHaveCount(24)
  await expect(page.locator('.standard-ratio').first()).toHaveText('/ 2')
  for (let index = 0; index < 24; index++) await inputs.nth(index).fill(index === 0 ? '0' : '2')
  await page.getByPlaceholder('เลือกหรือพิมพ์ชื่อผู้ตรวจ').fill('เจ้าหน้าที่ทดสอบ')
  await expect(page.getByText('กรอกแล้ว 24 / 24 ช่อง')).toBeVisible()
  await page.getByRole('button', { name: 'บันทึกผลตรวจ' }).click()
  await expect(page.getByRole('button', { name: 'บันทึกแล้ว' })).toBeVisible()
  await expect(page).toHaveURL('http://127.0.0.1:4173/')
  expect(await page.evaluate(() => Object.keys(localStorage).filter((key) => key.startsWith('inspection-draft:')))).toEqual([])
})

test('tablet save bar stays clear of navigation and touch targets are large enough', async ({ page }) => {
  await page.setViewportSize({ width: 768, height: 1024 }); await mockApi(page); await page.goto('/inspect/medical-equipment')
  await page.getByPlaceholder('ค้นหารายการ').fill('เครื่อง')
  const save = await page.locator('.sticky-save').evaluate((element) => element.getBoundingClientRect().toJSON())
  const nav = await page.locator('.bottom-nav').evaluate((element) => element.getBoundingClientRect().toJSON())
  const clear = await page.locator('.search-box button').evaluate((element) => element.getBoundingClientRect().toJSON())
  const filter = await page.locator('.filter-button').evaluate((element) => element.getBoundingClientRect().toJSON())
  expect(save.bottom).toBeLessThanOrEqual(nav.top)
  expect(clear.height).toBeGreaterThanOrEqual(44)
  expect(filter.height).toBeGreaterThanOrEqual(44)
})

test('capture mobile form evidence', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await mockApi(page); await page.goto('/inspect/medical-equipment')
  await expect(page.getByRole('heading', { name: 'เครื่องมือแพทย์' })).toBeVisible()
  await page.screenshot({ path: '.impeccable/review/mobile.png', fullPage: true })
})
