import { afterEach,describe,expect,it,vi } from 'vitest'
import { submissionSchema } from '../../server/validation'
import { allowRequest } from '../../server/http'

const valid={type_slug:'medical-equipment',work_date:'2026-11-09',shift_code:'daily',inspector_name:'ผู้ตรวจ',notes:'',revision_expected:0,idempotency_key:'00000000-0000-4000-8000-000000000001',results:[{variant_id:'00000000-0000-4000-8000-000000000002',actual_qty:0}]}
const response=()=>{const res:any={setHeader:vi.fn(),status:vi.fn()};res.status.mockReturnValue(res);res.json=vi.fn().mockReturnValue(res);return res}
afterEach(()=>vi.unstubAllEnvs())
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
    expect(allowRequest({method:'DELETE',headers:{}} as any,response(),['POST'])).toBe(false)
    expect(allowRequest({method:'POST',headers:{'content-length':'100001'}} as any,response(),['POST'])).toBe(false)
    vi.stubEnv('ALLOWED_ORIGINS','https://trusted.example')
    expect(allowRequest({method:'POST',headers:{origin:'https://evil.example'}} as any,response(),['POST'])).toBe(false)
  })
  it('accepts this Vercel project production domain despite stale localhost origin configuration',()=>{
    vi.stubEnv('ALLOWED_ORIGINS','http://localhost:5173')
    vi.stubEnv('APP_BASE_URL','http://localhost:5173')
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL','hospital-check-i2nt.vercel.app')
    expect(allowRequest({method:'POST',headers:{origin:'https://hospital-check-i2nt.vercel.app'}} as any,response(),['POST'])).toBe(true)
    expect(allowRequest({method:'POST',headers:{origin:'https://other-project.vercel.app'}} as any,response(),['POST'])).toBe(false)
    expect(allowRequest({method:'POST',headers:{origin:'https://hospital-check-i2nt.vercel.app.evil.example'}} as any,response(),['POST'])).toBe(false)
  })
  it('accepts the exact deployment and branch domains, normalizes configured URLs, and combines both explicit settings',()=>{
    vi.stubEnv('ALLOWED_ORIGINS','https://trusted.example/, https://another.example:443/')
    vi.stubEnv('APP_BASE_URL','https://custom.example/')
    vi.stubEnv('VERCEL_URL','hospital-check-abc123.vercel.app')
    vi.stubEnv('VERCEL_BRANCH_URL','hospital-check-git-main-team.vercel.app')
    for(const origin of ['https://trusted.example','https://another.example','https://custom.example','https://hospital-check-abc123.vercel.app','https://hospital-check-git-main-team.vercel.app']){
      expect(allowRequest({method:'POST',headers:{origin}} as any,response(),['POST'])).toBe(true)
    }
  })
  it('rejects opaque origins and arbitrary origins when deployment/configured origins are absent',()=>{
    for(const name of ['ALLOWED_ORIGINS','APP_BASE_URL','VERCEL_URL','VERCEL_BRANCH_URL','VERCEL_PROJECT_PRODUCTION_URL'])vi.stubEnv(name,'')
    for(const origin of ['null','https://evil.example'])expect(allowRequest({method:'POST',headers:{origin}} as any,response(),['POST'])).toBe(false)
    expect(allowRequest({method:'GET',headers:{}} as any,response(),['GET'])).toBe(true)
  })
})
