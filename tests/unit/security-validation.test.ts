import { describe,expect,it,vi } from 'vitest'
import { submissionSchema } from '../../server/validation'
import { allowRequest } from '../../server/http'

const valid={type_slug:'medical-equipment',work_date:'2026-11-09',shift_code:'daily',inspector_name:'ผู้ตรวจ',notes:'',revision_expected:0,idempotency_key:'00000000-0000-4000-8000-000000000001',results:[{variant_id:'00000000-0000-4000-8000-000000000002',actual_qty:0}]}
describe('API security validation',()=>{
  it('accepts zero but rejects negative, decimal and oversized counts',()=>{
    expect(submissionSchema.parse(valid).results[0]?.actual_qty).toBe(0)
    for(const actual_qty of [-1,1.5,100000])expect(()=>submissionSchema.parse({...valid,results:[{...valid.results[0],actual_qty}]})).toThrow()
  })
  it('rejects unknown payload keys and malformed idempotency keys',()=>{
    expect(()=>submissionSchema.parse({...valid,admin:true})).toThrow()
    expect(()=>submissionSchema.parse({...valid,idempotency_key:'repeat-me'})).toThrow()
  })
  it('blocks wrong methods, oversized requests and untrusted origins',()=>{
    const response=()=>{const res:any={setHeader:vi.fn(),status:vi.fn()};res.status.mockReturnValue(res);res.json=vi.fn().mockReturnValue(res);return res}
    expect(allowRequest({method:'DELETE',headers:{}} as any,response(),['POST'])).toBe(false)
    expect(allowRequest({method:'POST',headers:{'content-length':'100001'}} as any,response(),['POST'])).toBe(false)
    const original=process.env.ALLOWED_ORIGINS;process.env.ALLOWED_ORIGINS='https://trusted.example'
    expect(allowRequest({method:'POST',headers:{origin:'https://evil.example'}} as any,response(),['POST'])).toBe(false)
    process.env.ALLOWED_ORIGINS=original
  })
})
