import { expect, test, type Page } from '@playwright/test'

async function mockEnvironment(page: Page, slug = 'refrigerator-temperature') {
  const room = slug === 'room-environment'
  const variants = [
    { id: '00000000-0000-4000-8000-000000000011', variant_label: null, input_kind: 'temperature', unit: '°C', standard_qty: room ? 24 : 8, comparison_mode: 'range', standard_min: room ? null : 2, standard_max: room ? 24 : 8 },
    ...(room ? [{ id: '00000000-0000-4000-8000-000000000012', variant_label: null, input_kind: 'humidity', unit: '%', standard_qty: 60, comparison_mode: 'range', standard_min: null, standard_max: 60 }] : []),
  ]
  await page.route('**/api/inspection-form**', route => {
    const url = new URL(route.request().url())
    return route.fulfill({ json: { data: { type: { id: 'environment', slug, title_th: room ? 'อุณหภูมิห้องและความชื้น' : 'อุณหภูมิตู้เย็น', schedule_mode: 'shift' }, work_date: url.searchParams.get('date'), shift_code: url.searchParams.get('shift'), schedules: [{ shift_code: 'morning', required: true }, { shift_code: 'afternoon', required: true }], groups: [{ id: null, name: null, items: variants.map((variant, index) => ({ id: `item-${index}`, name: index ? 'ความชื้นห้อง' : room ? 'อุณหภูมิห้อง' : 'อุณหภูมิตู้เย็น', variants: [variant] })) }], existing_submission: null } } })
  })
  await page.route('**/api/inspectors', route => route.fulfill({ json: { data: [] } }))
  await page.route('**/api/submissions', route => route.fulfill({ json: { data: { id: 'environment-save', revision_number: 0, updated: false } } }))
}

for (const width of [320, 375, 768, 1366]) {
  test(`environment forms fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 }); await mockEnvironment(page, 'room-environment')
    await page.goto('/inspect/room-environment?date=2026-11-11&shift=morning')
    await expect(page.getByLabel('อุณหภูมิห้อง', { exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: 'ดึก', exact: true })).toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
    if (width === 375) await page.screenshot({ path: 'test-results/environment-mobile.png', fullPage: true })
  })
}

test('keeps negative decimal readings and corrective action when saving out-of-range temperature', async ({ page }) => {
  await mockEnvironment(page); await page.goto('/inspect/refrigerator-temperature?date=2026-11-11&shift=morning')
  await page.getByLabel('อุณหภูมิตู้เย็น', { exact: true }).fill('-1.25')
  await expect(page.getByText('อยู่นอกเกณฑ์ กรุณาตรวจสอบและระบุการแก้ไขด้านล่าง')).toBeVisible()
  await page.getByPlaceholder('เลือกหรือพิมพ์ชื่อผู้ตรวจ').fill('ผู้ตรวจทดสอบ')
  await page.getByPlaceholder('ระบุการตรวจสอบซ้ำหรือการแก้ไขที่ดำเนินการ').fill('ตรวจซ้ำและแจ้งผู้รับผิดชอบ')
  const request = page.waitForRequest('**/api/submissions')
  await page.getByRole('button', { name: 'บันทึกผลตรวจ' }).click()
  expect((await request).postDataJSON()).toMatchObject({ shift_code: 'morning', notes: 'ตรวจซ้ำและแจ้งผู้รับผิดชอบ', results: [{ actual_qty: -1.25 }] })
  await expect(page.getByRole('button', { name: 'บันทึกแล้ว' })).toBeVisible()
})

test('blocks invalid humidity, retains form values, and accepts inclusive thresholds', async ({ page }) => {
  await mockEnvironment(page, 'room-environment'); await page.goto('/inspect/room-environment?date=2026-11-11&shift=afternoon')
  await page.getByLabel('อุณหภูมิห้อง', { exact: true }).fill('24')
  await page.getByLabel('ความชื้นห้อง', { exact: true }).fill('100.01')
  await page.getByPlaceholder('เลือกหรือพิมพ์ชื่อผู้ตรวจ').fill('ผู้ตรวจทดสอบ')
  let saves = 0; page.on('request', request => { if (request.url().endsWith('/api/submissions')) saves++ })
  await page.getByRole('button', { name: 'บันทึกผลตรวจ' }).click()
  await expect(page.getByLabel('ความชื้นห้อง', { exact: true })).toBeFocused()
  expect(saves).toBe(0)
  await expect(page.getByLabel('อุณหภูมิห้อง', { exact: true })).toHaveValue('24')
  await page.getByLabel('ความชื้นห้อง', { exact: true }).fill('60')
  await expect(page.getByText('อยู่ในเกณฑ์', { exact: true })).toHaveCount(2)
  await page.getByRole('button', { name: 'บันทึกผลตรวจ' }).click()
  await expect(page.getByRole('button', { name: 'บันทึกแล้ว' })).toBeVisible()
})

test('restores a decimal draft and keeps morning and afternoon values separate', async ({ page }) => {
  await mockEnvironment(page); await page.goto('/inspect/refrigerator-temperature?date=2026-11-11&shift=morning')
  const reading = page.getByLabel('อุณหภูมิตู้เย็น', { exact: true })
  await reading.fill('5.25')
  await expect.poll(() => page.evaluate(() => Object.values(localStorage).some(value => value.includes('5.25')))).toBe(true)
  await page.reload(); await expect(reading).toHaveValue('5.25')
  await page.getByRole('button', { name: 'บ่าย', exact: true }).click(); await expect(reading).toHaveValue('')
  await reading.fill('6.5')
  await expect.poll(() => page.evaluate(() => Object.values(localStorage).some(value => value.includes('6.5')))).toBe(true)
  await page.getByRole('button', { name: 'เช้า', exact: true }).click(); await expect(reading).toHaveValue('5.25')
})
