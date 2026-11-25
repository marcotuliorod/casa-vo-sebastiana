import { describe, it, expect, vi, beforeEach } from 'vitest'

// after() roda o callback depois da resposta; aqui guardamos para rodar no teste
const pendentes: Array<() => Promise<void>> = []
vi.mock('next/server', () => ({ after: (fn: () => Promise<void>) => pendentes.push(fn) }))
vi.mock('next/headers', () => ({ cookies: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/queries/appointments', () => ({ getNomeClientePorEmail: vi.fn() }))
vi.mock('@/lib/email/cliente', () => ({ enviarEmail: vi.fn() }))

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { getNomeClientePorEmail } from '@/lib/queries/appointments'
import { enviarEmail } from '@/lib/email/cliente'
import { verificarTokenHistorico } from '@/lib/historico/token'
import { solicitarLinkHistorico, sairDoHistorico } from '@/lib/actions/historico'

const mockNome = vi.mocked(getNomeClientePorEmail)
const mockEnviar = vi.mocked(enviarEmail)

function form(email?: string) {
  const fd = new FormData()
  if (email !== undefined) fd.set('email', email)
  return fd
}

async function rodarPendentes() {
  while (pendentes.length) await pendentes.shift()!()
}

describe('solicitarLinkHistorico', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    pendentes.length = 0
    process.env.AUTH_SECRET = 'segredo-de-teste'
    process.env.NEXT_PUBLIC_BASE_URL = 'https://casa.exemplo'
    mockEnviar.mockResolvedValue({ sucesso: true, idMensagem: 'msg-1' })
  })

  it.each([undefined, '', '   ', 'nao-e-email'])('recusa e-mail inválido (%s) sem agendar envio', async (email) => {
    const estado = await solicitarLinkHistorico(null, form(email))
    expect(estado).toHaveProperty('erro')
    expect(pendentes).toHaveLength(0)
  })

  it('envia um link válido para o e-mail de um consulente cadastrado', async () => {
    mockNome.mockResolvedValue('Maria')

    const estado = await solicitarLinkHistorico(null, form(' Maria@Exemplo.com '))
    expect(estado).toEqual({ enviadoPara: 'maria@exemplo.com' })
    // Nada é consultado nem enviado antes da resposta
    expect(mockNome).not.toHaveBeenCalled()
    expect(mockEnviar).not.toHaveBeenCalled()

    await rodarPendentes()

    expect(mockNome).toHaveBeenCalledWith('maria@exemplo.com')
    expect(mockEnviar).toHaveBeenCalledTimes(1)
    const [para, email] = mockEnviar.mock.calls[0]
    expect(para).toEqual(['maria@exemplo.com'])
    expect(email.texto).toContain('Olá, Maria!')

    const url = new URL(email.texto.match(/https:\/\/casa\.exemplo\/historico\/acesso\?t=\S+/)![0])
    expect(verificarTokenHistorico(url.searchParams.get('t'))?.email).toBe('maria@exemplo.com')
  })

  it('responde igual e não envia nada quando o e-mail não é de nenhum consulente', async () => {
    mockNome.mockResolvedValue(null)

    const estado = await solicitarLinkHistorico(null, form('ninguem@exemplo.com'))
    expect(estado).toEqual({ enviadoPara: 'ninguem@exemplo.com' })

    await rodarPendentes()
    expect(mockEnviar).not.toHaveBeenCalled()
  })

  it('não lança quando o envio falha', async () => {
    mockNome.mockResolvedValue('Maria')
    mockEnviar.mockRejectedValue(new Error('rede fora'))
    const erro = vi.spyOn(console, 'error').mockImplementation(() => {})

    await solicitarLinkHistorico(null, form('maria@exemplo.com'))
    await expect(rodarPendentes()).resolves.toBeUndefined()
    expect(erro).toHaveBeenCalled()
    erro.mockRestore()
  })
})

describe('sairDoHistorico', () => {
  it('apaga o cookie no mesmo path em que foi gravado e volta para /historico', async () => {
    const del = vi.fn()
    vi.mocked(cookies).mockResolvedValue({ delete: del } as never)

    await sairDoHistorico()

    expect(del).toHaveBeenCalledWith({ name: 'cvs_historico', path: '/historico' })
    expect(redirect).toHaveBeenCalledWith('/historico')
  })
})
