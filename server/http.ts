import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ZodError } from 'zod'

function normalizedOrigin(value: string): string | null {
  try {
    const url = new URL(value.trim())
    return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password ? url.origin : null
  } catch { return null }
}

function allowedOrigins(): Set<string> {
  const configured = [process.env.ALLOWED_ORIGINS, process.env.APP_BASE_URL]
    .flatMap(value => (value ?? '').split(','))
  // Vercel supplies these project/deployment domains without a protocol.
  // Accept exact domains only; never allow every *.vercel.app origin.
  const deployed = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL]
    .filter((value): value is string => Boolean(value?.trim()))
    .map(value => `https://${value.trim()}`)
  return new Set([...configured, ...deployed].map(normalizedOrigin).filter((value): value is string => value !== null))
}

export function allowRequest(req: VercelRequest, res: VercelResponse, methods: string[]): boolean {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (!methods.includes(req.method ?? '')) { res.setHeader('Allow', methods); res.status(405).json({ error: 'Method not allowed' }); return false }
  const origin = req.headers.origin
  if (origin && (typeof origin !== 'string' || !allowedOrigins().has(normalizedOrigin(origin) ?? ''))) { res.status(403).json({ error: 'Origin not allowed' }); return false }
  const length = Number(req.headers['content-length'] ?? 0)
  if (length > 100_000) { res.status(413).json({ error: 'Request too large' }); return false }
  return true
}

export function handleError(error: unknown, res: VercelResponse) {
  // A failed binary download must not retain its attachment headers or byte length.
  if (res.headersSent) { res.end(); return }
  res.removeHeader('Content-Length')
  res.removeHeader('Content-Disposition')
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  if (error instanceof ZodError) return res.status(400).json({ error: 'ข้อมูลไม่ถูกต้อง', details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })) })
  const candidate = error as { message?: string; code?: string }
  if (candidate.code === 'P0002') return res.status(409).json({ error: 'ข้อมูลถูกแก้ไขจากอุปกรณ์อื่น กรุณาโหลดใหม่' })
  if (candidate.code === 'P0001') return res.status(400).json({ error: candidate.message ?? 'ไม่สามารถบันทึกข้อมูลได้' })
  console.error(error)
  return res.status(500).json({ error: 'ระบบขัดข้องชั่วคราว กรุณาลองใหม่' })
}

export function queryValue(req: VercelRequest, key: string): string | undefined {
  const value = req.query[key]
  return Array.isArray(value) ? value[0] : value
}
