import type { VercelRequest, VercelResponse } from '@vercel/node'
import { ZodError } from 'zod'

export function allowRequest(req: VercelRequest, res: VercelResponse, methods: string[]): boolean {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  if (!methods.includes(req.method ?? '')) { res.setHeader('Allow', methods); res.status(405).json({ error: 'Method not allowed' }); return false }
  const origin = req.headers.origin
  const allowed = (process.env.ALLOWED_ORIGINS ?? process.env.APP_BASE_URL ?? '').split(',').map((v) => v.trim()).filter(Boolean)
  if (origin && allowed.length && !allowed.includes(origin)) { res.status(403).json({ error: 'Origin not allowed' }); return false }
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
