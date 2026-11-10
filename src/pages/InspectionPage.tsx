import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, ArrowLeft, Check, CloudOff, RotateCcw, Save, Search, X } from 'lucide-react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, ApiError } from '../lib/api'
import { clearDraft, readDraft, writeDraft } from '../lib/draft'
import { thaiDate, todayBangkok } from '../lib/dates'
import type { ShiftCode, SubmissionPayload } from '../types/inspection'

const shifts: Array<{ code: ShiftCode; label: string }> = [
  { code: 'morning', label: 'เช้า' }, { code: 'afternoon', label: 'บ่าย' }, { code: 'night', label: 'ดึก' },
]

export function parseCount(value: string): number | null {
  if (!/^\d+$/.test(value)) return null
  const count = Number(value)
  return Number.isSafeInteger(count) ? count : null
}

export function InspectionPage() {
  const { slug = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const [date, setDate] = useState(params.get('date') ?? todayBangkok())
  const [shift, setShift] = useState<ShiftCode>((params.get('shift') as ShiftCode) ?? (slug === 'medical-equipment' ? 'daily' : 'morning'))
  const [values, setValues] = useState<Record<string, string>>({})
  const [inspector, setInspector] = useState('')
  const [notes, setNotes] = useState('')
  const [search, setSearch] = useState('')
  const [onlyIncomplete, setOnlyIncomplete] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const [attempted, setAttempted] = useState(false)
  const [saved, setSaved] = useState(false)
  const hydrated = useRef('')

  const formQuery = useQuery({ queryKey: ['form', slug, date, shift], queryFn: () => api.getForm(slug, date, shift), enabled: Boolean(slug) })
  const inspectorsQuery = useQuery({ queryKey: ['inspectors'], queryFn: api.getInspectors })
  const form = formQuery.data?.data
  const variants = useMemo(() => form?.groups.flatMap((g) => g.items.flatMap((i) => i.variants)) ?? [], [form])
  const completed = variants.filter((v) => parseCount(values[v.id] ?? '') !== null).length
  const invalid = new Set(attempted ? variants.filter((v) => parseCount(values[v.id] ?? '') === null).map((v) => v.id) : [])

  useEffect(() => {
    if (!form) return
    const hydrateKey = `${slug}:${date}:${shift}:${form.existing_submission?.revision_number ?? 0}`
    if (hydrated.current === hydrateKey) return
    hydrated.current = hydrateKey
    const serverValues = Object.fromEntries((form.existing_submission?.results ?? []).map((r) => [r.variant_id, r.actual_qty == null ? '' : String(r.actual_qty)]))
    const draft = readDraft(slug, date, shift)
    setValues(draft?.values ?? serverValues)
    setInspector(draft?.inspectorName ?? form.existing_submission?.inspector_name ?? '')
    setNotes(draft?.notes ?? form.existing_submission?.notes ?? '')
    setDraftRestored(Boolean(draft)); setAttempted(false)
  }, [form, slug, date, shift])

  useEffect(() => {
    if (!form || !hydrated.current || saved) return
    const timer = window.setTimeout(() => writeDraft(slug, date, shift, { values, inspectorName: inspector, notes, savedAt: new Date().toISOString() }), 350)
    return () => window.clearTimeout(timer)
  }, [values, inspector, notes, form, slug, date, shift, saved])

  const mutation = useMutation({
    mutationFn: (payload: SubmissionPayload) => api.save(payload),
    onSuccess: async () => {
      clearDraft(slug, date, shift); setSaved(true)
      await Promise.all([queryClient.invalidateQueries({ queryKey: ['form', slug, date, shift] }), queryClient.invalidateQueries({ queryKey: ['types'] })])
      window.setTimeout(() => navigate('/'), 900)
    },
  })

  function setContext(nextDate: string, nextShift: ShiftCode) {
    setDate(nextDate); setShift(nextShift); setParams({ date: nextDate, shift: nextShift })
  }

  function submit() {
    setAttempted(true)
    if (!form || !inspector.trim() || completed !== variants.length) {
      window.setTimeout(() => document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0); return
    }
    mutation.mutate({
      type_slug: slug, work_date: date, shift_code: form.type.schedule_mode === 'daily' ? 'daily' : shift,
      inspector_name: inspector.trim(), notes: notes.trim(), revision_expected: form.existing_submission?.revision_number ?? 0,
      idempotency_key: crypto.randomUUID(), results: variants.map((v) => ({ variant_id: v.id, actual_qty: parseCount(values[v.id]!)! })),
    })
  }

  function focusCount(input:HTMLInputElement){input.select();input.scrollIntoView({behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'})}
  function focusVariant(id:string|undefined){if(!id)return;window.setTimeout(()=>document.querySelector<HTMLInputElement>(`input[data-count-id="${id}"]`)?.focus(),40)}
  function focusFirstIncomplete(){focusVariant(variants.find(variant=>parseCount(values[variant.id]??'')===null)?.id)}
  function focusNextIncomplete(currentId:string){const index=variants.findIndex(variant=>variant.id===currentId);const ordered=[...variants.slice(index+1),...variants.slice(0,index)];focusVariant(ordered.find(variant=>parseCount(values[variant.id]??'')===null)?.id)}

  if (formQuery.isLoading) return <LoadingForm />
  if (formQuery.isError) return <ErrorState error={formQuery.error} retry={() => void formQuery.refetch()} />
  if (!form) return null

  const groups = form.groups.map((group) => ({ ...group, items: group.items.filter((item) => {
    const matches = item.name.toLocaleLowerCase('th').includes(search.toLocaleLowerCase('th'))
    const missing = item.variants.some((v) => parseCount(values[v.id] ?? '') === null)
    return matches && (!onlyIncomplete || missing)
  }) })).filter((group) => group.items.length)

  return <div className="inspection-page">
    <header className="inspection-header"><Link to="/" className="icon-button" aria-label="กลับหน้าหลัก"><ArrowLeft /></Link><div><h1>{form.type.title_th}</h1><p>{form.existing_submission ? `แก้ไขครั้งที่ ${form.existing_submission.revision_number + 1}` : 'บันทึกรอบใหม่'}</p></div></header>
    <section className="context-panel" aria-label="วันและรอบตรวจ">
      <label><span>วันที่ตรวจ</span><input type="date" value={date} onChange={(e) => setContext(e.target.value, shift)} /></label><strong>{thaiDate(date)}</strong>
      {form.type.schedule_mode === 'shift' && <div className="shift-control" role="group" aria-label="เลือกเวร">{shifts.map(({ code, label }) => <button type="button" key={code} aria-pressed={shift === code} className={shift === code ? 'selected' : ''} onClick={() => setContext(date, code)}>{label}</button>)}</div>}
    </section>
    {draftRestored && <div className="draft-banner"><RotateCcw size={18} /><span>กู้คืนข้อมูลที่ยังไม่ได้บันทึกแล้ว</span><button type="button" onClick={() => { clearDraft(slug, date, shift); setDraftRestored(false); hydrated.current = ''; void formQuery.refetch() }}>ทิ้งฉบับร่าง</button></div>}
    <section className="progress-section" aria-live="polite"><div><strong>กรอกแล้ว {completed} / {variants.length} ช่อง</strong>{completed === variants.length ? <span>พร้อมบันทึก</span> : <button type="button" onClick={focusFirstIncomplete}>ไปช่องที่ยังว่าง</button>}</div><div className="progress-track" role="progressbar" aria-label="ความคืบหน้าการกรอก" aria-valuemin={0} aria-valuemax={variants.length} aria-valuenow={completed}><span style={{ width: `${variants.length ? completed / variants.length * 100 : 0}%` }} /></div></section>
    <div className="filter-row"><label className="search-box"><Search size={19} /><span className="sr-only">ค้นหา</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ค้นหารายการ" />{search && <button type="button" aria-label="ล้างคำค้น" onClick={() => setSearch('')}><X size={18} /></button>}</label><button type="button" aria-pressed={onlyIncomplete} className={onlyIncomplete ? 'filter-button active' : 'filter-button'} onClick={() => setOnlyIncomplete((v) => !v)}>ยังไม่กรอก</button></div>
    <div className="group-list">{groups.map((group) => <section className="inspection-group" key={group.id ?? 'none'}>{group.name && <h2>{group.name}</h2>}<div className="item-list">{group.items.map((item) => <article className="item-card" key={item.id}><h3>{item.name}</h3><div className="variant-list">{item.variants.map((variant) => <label className={invalid.has(variant.id) ? 'count-row invalid' : 'count-row'} key={variant.id} title={`กรอกจำนวนที่พบ จากค่ามาตรฐาน ${variant.standard_qty} ${variant.unit}`}><span className="variant-copy"><strong>{variant.variant_label ?? 'จำนวนที่พบ'}</strong><small>แตะช่องตัวเลขเพื่อกรอก</small></span><span className="count-input-wrap"><input data-count-id={variant.id} aria-invalid={invalid.has(variant.id)} aria-label={`${item.name} ${variant.variant_label ?? ''} จำนวนมาตรฐาน ${variant.standard_qty} ${variant.unit}`} inputMode="numeric" pattern="[0-9]*" autoComplete="off" value={values[variant.id] ?? ''} placeholder="—" onFocus={event=>focusCount(event.currentTarget)} onKeyDown={event=>{if(event.key==='Enter'){event.preventDefault();focusNextIncomplete(variant.id)}}} onChange={(e) => setValues((current) => ({ ...current, [variant.id]: e.target.value.replace(/\D/g, '').slice(0, 5) }))} /><span className="standard-ratio">/ {variant.standard_qty}</span><span className="count-unit">{variant.unit}</span></span></label>)}</div></article>)}</div></section>)}{groups.length === 0 && <div className="empty-state"><Search size={28} /><strong>ไม่พบรายการ</strong><span>ลองเปลี่ยนคำค้นหาหรือตัวกรอง</span></div>}</div>
    <section className="submission-details">
      <label><span>ชื่อผู้ตรวจ <em>จำเป็น</em></span><input className="inspector-input" list="inspector-options" aria-invalid={attempted && !inspector.trim()} value={inspector} onChange={(e) => setInspector(e.target.value)} placeholder="เลือกหรือพิมพ์ชื่อผู้ตรวจ" maxLength={120} /><datalist id="inspector-options">{inspectorsQuery.data?.data.map((p) => <option value={p.display_name} key={p.id} />)}</datalist></label>
      <label><span>หมายเหตุ <small>(ไม่บังคับ)</small></span><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ระบุสิ่งที่ต้องติดตามเพิ่มเติม" maxLength={500} /></label>
    </section>
    {attempted && (completed !== variants.length || !inspector.trim()) && <div className="validation-summary" role="alert"><AlertCircle size={19} /><span>{completed !== variants.length && !inspector.trim() ? 'กรุณากรอกจำนวนให้ครบทุกช่องและระบุชื่อผู้ตรวจ' : completed !== variants.length ? `กรุณากรอกจำนวนที่เหลืออีก ${variants.length - completed} ช่อง` : 'กรุณาระบุชื่อผู้ตรวจ'}</span></div>}
    {mutation.isError && <div className="validation-summary" role="alert"><CloudOff size={19} /><span>{mutation.error instanceof ApiError && mutation.error.status === 409 ? 'ข้อมูลถูกแก้ไขจากอุปกรณ์อื่น กรุณาโหลดข้อมูลล่าสุด' : mutation.error.message}</span>{mutation.error instanceof ApiError && mutation.error.status === 409 && <button type="button" onClick={() => void formQuery.refetch()}>โหลดใหม่</button>}</div>}
    <div className="save-spacer" /><footer className="sticky-save"><div><strong>{completed}/{variants.length}</strong><span>{completed === variants.length ? 'ครบแล้ว' : 'กรอกแล้ว'}</span></div><button type="button" onClick={submit} disabled={mutation.isPending || saved}>{saved ? <><Check /> บันทึกแล้ว</> : mutation.isPending ? 'กำลังบันทึก…' : <><Save /> บันทึกผลตรวจ</>}</button><span className="sr-only" role="status" aria-live="polite">{saved ? 'บันทึกข้อมูลสำเร็จ' : mutation.isPending ? 'กำลังบันทึกข้อมูล' : ''}</span></footer>
  </div>
}

function LoadingForm() { return <div className="inspection-page" role="status" aria-live="polite" aria-label="กำลังโหลดแบบฟอร์ม"><span className="sr-only">กำลังโหลดแบบฟอร์ม กรุณารอสักครู่</span><div className="header-skeleton skeleton" /><div className="panel-skeleton skeleton" />{[1,2,3,4].map((v) => <div className="card-skeleton skeleton" key={v} />)}</div> }
function ErrorState({ error, retry }: { error: Error; retry: () => void }) { return <section className="state-page"><AlertCircle size={34} /><h1>เปิดแบบฟอร์มไม่ได้</h1><p>{error.message || 'ตรวจสอบอินเทอร์เน็ตแล้วลองอีกครั้ง'}</p><button className="primary-button" type="button" onClick={retry}>ลองใหม่</button><Link className="text-link" to="/">กลับหน้าหลัก</Link></section> }
