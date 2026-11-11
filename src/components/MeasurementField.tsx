import { AlertCircle, CheckCircle2, Droplets, Thermometer } from 'lucide-react'
import type { InspectionVariant } from '../types/inspection'
import { outsideStandard, parseInspectionValue, standardLabel } from '../lib/inspection-values'

export function MeasurementField({ variant, name, value, invalid, onChange }: {
  variant: InspectionVariant; name: string; value: string; invalid: boolean; onChange: (value: string) => void
}) {
  const parsed = parseInspectionValue(value, variant.input_kind)
  const warning = parsed !== null && outsideStandard(parsed, variant)
  const malformed = value !== '' && parsed === null
  const Icon = variant.input_kind === 'humidity' ? Droplets : Thermometer
  const hintId = `reading-hint-${variant.id}`
  return <div className="measurement-field">
    <div className="measurement-heading"><Icon size={22} aria-hidden="true" /><label htmlFor={`reading-${variant.id}`}>{name}</label></div>
    <p className="measurement-standard">เกณฑ์ในแบบตรวจ: {standardLabel(variant)} {variant.unit}</p>
    <div className={`measurement-input${invalid || malformed ? ' invalid' : ''}`}>
      <input id={`reading-${variant.id}`} data-count-id={variant.id} inputMode="decimal" autoComplete="off"
        aria-describedby={hintId} aria-invalid={invalid || malformed} value={value} placeholder={variant.input_kind === 'humidity' ? 'เช่น 55.5' : 'เช่น 5.5'}
        onChange={event => onChange(event.target.value)} maxLength={9} />
      <span>{variant.unit}</span>
    </div>
    <p id={hintId} className={`measurement-feedback${warning || invalid || malformed ? ' warning' : parsed !== null ? ' good' : ''}`}>
      {invalid || malformed ? <><AlertCircle size={17} aria-hidden="true" />{variant.input_kind === 'humidity' ? 'กรอกความชื้น 0–100 ทศนิยมได้ 2 ตำแหน่ง' : 'กรอกอุณหภูมิ −273.15 ถึง 999 ทศนิยมได้ 2 ตำแหน่ง'}</>
        : warning ? <><AlertCircle size={17} aria-hidden="true" />อยู่นอกเกณฑ์ กรุณาตรวจสอบและระบุการแก้ไขด้านล่าง</>
          : parsed !== null ? <><CheckCircle2 size={17} aria-hidden="true" />อยู่ในเกณฑ์</> : 'กรอกค่าที่อ่านได้ ทศนิยมได้ 2 ตำแหน่ง'}
    </p>
  </div>
}
