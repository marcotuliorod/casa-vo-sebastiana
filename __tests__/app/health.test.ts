// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const execute = vi.fn()
vi.mock('@/lib/db', () => ({ db: { execute: (...args: unknown[]) => execute(...args) } }))

import { GET } from '@/app/api/health/route'

function req(caminho: string) {
  return new NextRequest(new URL(`http://interno:3000${caminho}`))
}

describe('GET /api/health', () => {
  beforeEach(() => {
    execute.mockReset()
  })

  it('sem deep responde ok sem consultar o banco', async () => {
    const res = await GET(req('/api/health'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(execute).not.toHaveBeenCalled()
  })

  it('com deep e banco respondendo devolve 200', async () => {
    execute.mockResolvedValue([{ '?column?': 1 }])
    const res = await GET(req('/api/health?deep=1'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true, banco: true })
  })

  it('com deep e banco com erro devolve 503', async () => {
    execute.mockRejectedValue(new Error('connection refused'))
    const res = await GET(req('/api/health?deep=1'))
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ ok: false, banco: false })
  })
})
