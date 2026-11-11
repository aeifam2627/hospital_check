import { useMutation,useQuery,useQueryClient } from '@tanstack/react-query'
import { ArrowLeft,CheckCircle2,Plus,Settings2 } from 'lucide-react'
import { FormEvent,useMemo,useState } from 'react'
import { Link } from 'react-router-dom'
import { isEnvironmentInspection } from '../lib/inspection-values'
import { api } from '../lib/api'
import { todayBangkok } from '../lib/dates'

export function ManageItemsPage(){
  const date=todayBangkok(),queryClient=useQueryClient()
  const typesQuery=useQuery({queryKey:['types',date],queryFn:()=>api.getTypes(date)})
  const [typeSlug,setTypeSlug]=useState('medication'),[name,setName]=useState(''),[variant,setVariant]=useState(''),[unit,setUnit]=useState(''),[qty,setQty]=useState(''),[effectiveFrom,setEffectiveFrom]=useState(date),[group,setGroup]=useState('')
  const selected=useMemo(()=>typesQuery.data?.data.find(type=>type.slug===typeSlug),[typesQuery.data,typeSlug])
  const itemsQuery=useQuery({queryKey:['manage-form',typeSlug,date],queryFn:()=>api.getForm(typeSlug,date,typeSlug==='medical-equipment'?'daily':'morning'),enabled:Boolean(typeSlug)})
  const mutation=useMutation({mutationFn:api.addMasterItem,onSuccess:async()=>{setName('');setVariant('');setUnit('');setQty('');await Promise.all([itemsQuery.refetch(),queryClient.invalidateQueries({queryKey:['types']}),queryClient.invalidateQueries({queryKey:['form']})])}})
  const itemCount=itemsQuery.data?.data.groups.reduce((sum,current)=>sum+current.items.length,0)??0
  function submit(event:FormEvent){event.preventDefault();const standard=Number(qty);if(!name.trim()||!unit.trim()||!Number.isInteger(standard)||standard<0)return;mutation.mutate({type_slug:typeSlug,name:name.trim(),variant_label:variant.trim(),unit:unit.trim(),standard_qty:standard,effective_from:effectiveFrom,group_name:group.trim()})}
  return <div className="page manage-page">
    <header className="manage-header"><Link to="/" className="icon-button" aria-label="กลับหน้าตรวจวันนี้"><ArrowLeft/></Link><div><h1>จัดการรายการตรวจ</h1><p>เพิ่มยาและอุปกรณ์โดยไม่ต้องแก้โค้ด</p></div></header>
    <section className="manage-context"><label><span>ประเภทแบบตรวจ</span><select value={typeSlug} onChange={event=>setTypeSlug(event.target.value)}>{typesQuery.data?.data.map(type=><option value={type.slug} key={type.id}>{type.title_th}</option>)}</select></label><div><Settings2 size={18}/><span>มีใช้งาน {itemCount} รายการ</span></div></section>
    {isEnvironmentInspection(typeSlug) ? <div className="definition-note"><Settings2 size={20}/><p>แบบตรวจนี้ใช้เกณฑ์อุณหภูมิและความชื้นตามฟอร์มต้นฉบับ เลือกกรอกผลตรวจได้จากหน้าหลัก</p></div> : <form className="add-item-form" onSubmit={submit}>
      <div className="form-heading"><span><Plus size={20}/></span><div><h2>เพิ่มรายการใหม่</h2><p>รายการจะแสดงในแบบฟอร์มตั้งแต่วันที่กำหนด</p></div></div>
      <label><span>ชื่อรายการ</span><input value={name} onChange={event=>setName(event.target.value)} placeholder={selected?.title_th==='ยา'?'เช่น Amiodarone 150 mg':'เช่น เครื่องวัดความดัน'} required maxLength={160}/></label>
      <div className="field-pair"><label><span>จำนวนมาตรฐาน</span><input type="number" inputMode="numeric" min="0" max="99999" value={qty} onChange={event=>setQty(event.target.value)} placeholder="0" required/></label><label><span>หน่วย</span><input value={unit} onChange={event=>setUnit(event.target.value)} placeholder="เช่น ขวด, ชิ้น, เครื่อง" required maxLength={40}/></label></div>
      <label><span>ชนิดย่อย <small>(ถ้ามี)</small></span><input value={variant} onChange={event=>setVariant(event.target.value)} placeholder="เช่น ผู้ใหญ่ หรือ No.14" maxLength={80}/></label>
      {typeSlug==='emergency-cart'&&<label><span>ชั้น/หมวด <small>(ถ้ามี)</small></span><input value={group} onChange={event=>setGroup(event.target.value)} placeholder="เช่น ชั้นที่ 2" maxLength={100}/></label>}
      <label><span>เริ่มใช้วันที่</span><input type="date" value={effectiveFrom} onChange={event=>setEffectiveFrom(event.target.value)} required/></label>
      {mutation.isSuccess&&<div className="manage-success" role="status"><CheckCircle2/>เพิ่มรายการแล้ว แบบฟอร์มอัปเดตเรียบร้อย</div>}
      {mutation.isError&&<div className="validation-summary" role="alert">{mutation.error.message}</div>}
      <button className="add-item-button" type="submit" disabled={mutation.isPending}>{mutation.isPending?'กำลังเพิ่ม…':<><Plus/>เพิ่มในแบบฟอร์ม {selected?.title_th}</>}</button>
    </form>}
  </div>
}
