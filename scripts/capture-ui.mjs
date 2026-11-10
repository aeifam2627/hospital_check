/* global process, console, document */
import { chromium } from '@playwright/test'

const base=process.argv[2]??'http://127.0.0.1:3000'
const browser=await chromium.launch({channel:'chrome',headless:true})
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1})
for(const [name,path] of [['home','/'],['form','/inspect/medication?date=2026-11-10&shift=morning'],['manage','/manage/items'],['dashboard','/dashboard'],['history','/history?from=2026-08-01&to=2026-11-10']]){
  await page.goto(base+path,{waitUntil:'networkidle'})
  console.log(name,await page.evaluate(()=>({width:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth})))
  await page.evaluate(()=>document.fonts.ready)
  await page.screenshot({path:`.impeccable/review/${name}-app.png`,fullPage:false})
}
await browser.close()
