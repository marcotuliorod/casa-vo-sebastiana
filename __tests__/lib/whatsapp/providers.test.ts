import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ZApiProvider } from '@/lib/whatsapp/providers/zapi'
import { TwilioProvider } from '@/lib/whatsapp/providers/twilio'

// ─────────────────────────────────────────────────────────────────
// ZApiProvider
// ─────────────────────────────────────────────────────────────────
describe('ZApiProvider', () => {
  const CONFIG = {
    instanceId: 'inst123',
    instanceToken: 'tok456',
    clientToken: 'cli789',
  }

  let provider: ZApiProvider

  beforeEach(() => {
    provider = new ZApiProvider(CONFIG)
  })

  describe('nome', () => {
    it('é "zapi"', () => {
      expect(provider.nome).toBe('zapi')
    })
  })

  describe('enviarMensagem — sucesso', () => {
    it('retorna sucesso com zaapId', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ zaapId: 'zid_abc123' }),
      })

      const resultado = await provider.enviarMensagem({
        para: '+5511999999999',
        corpo: 'Mensagem de teste',
      })

      expect(resultado.sucesso).toBe(true)
      expect(resultado.idMensagemProvedor).toBe('zid_abc123')
      expect(resultado.erro).toBeUndefined()
    })

    it('retorna sucesso com messageId quando zaapId ausente', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ messageId: 'mid_xyz' }),
      })

      const resultado = await provider.enviarMensagem({
        para: '+5511999999999',
        corpo: 'Teste',
      })

      expect(resultado.sucesso).toBe(true)
      expect(resultado.idMensagemProvedor).toBe('mid_xyz')
    })

    it('remove o "+" do número antes de enviar', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ zaapId: 'zid_1' }),
      })

      await provider.enviarMensagem({
        para: '+5511999999999',
        corpo: 'Teste',
      })

      const chamada = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = JSON.parse(chamada[1].body)
      expect(body.phone).toBe('5511999999999')
      expect(body.phone).not.toContain('+')
    })

    it('envia com Client-Token correto no header', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ zaapId: 'zid_1' }),
      })

      await provider.enviarMensagem({ para: '+5511999999999', corpo: 'Teste' })

      const chamada = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      expect(chamada[1].headers['Client-Token']).toBe('cli789')
    })

    it('URL da requisição contém instanceId e instanceToken', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ zaapId: 'z1' }),
      })

      await provider.enviarMensagem({ para: '+5511999999999', corpo: 'Teste' })

      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(url).toContain('inst123')
      expect(url).toContain('tok456')
      expect(url).toContain('send-text')
    })
  })

  describe('enviarMensagem — erro HTTP', () => {
    it('retorna sucesso=false com mensagem de erro da API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ message: 'Unauthorized' }),
      })

      const resultado = await provider.enviarMensagem({
        para: '+5511999999999',
        corpo: 'Teste',
      })

      expect(resultado.sucesso).toBe(false)
      expect(resultado.erro).toBe('Unauthorized')
    })

    it('retorna erro genérico quando resposta não tem message', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({}),
      })

      const resultado = await provider.enviarMensagem({
        para: '+5511999999999',
        corpo: 'Teste',
      })

      expect(resultado.sucesso).toBe(false)
      expect(resultado.erro).toContain('500')
    })
  })

  describe('enviarMensagem — erro de rede', () => {
    it('captura exceção e retorna sucesso=false', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Timeout de rede'))

      const resultado = await provider.enviarMensagem({
        para: '+5511999999999',
        corpo: 'Teste',
      })

      expect(resultado.sucesso).toBe(false)
      expect(resultado.erro).toBe('Timeout de rede')
    })

    it('trata erros não-Error com mensagem padrão', async () => {
      global.fetch = vi.fn().mockRejectedValue('erro string')

      const resultado = await provider.enviarMensagem({
        para: '+5511999999999',
        corpo: 'Teste',
      })

      expect(resultado.sucesso).toBe(false)
      expect(resultado.erro).toBe('Erro desconhecido')
    })
  })
})

// ─────────────────────────────────────────────────────────────────
// TwilioProvider
// ─────────────────────────────────────────────────────────────────
describe('TwilioProvider', () => {
  const CONFIG = {
    accountSid: 'ACtest123',
    authToken: 'authtoken456',
    fromNumber: '+14155238886',
  }

  let provider: TwilioProvider

  beforeEach(() => {
    provider = new TwilioProvider(CONFIG)
  })

  describe('nome', () => {
    it('é "twilio"', () => {
      expect(provider.nome).toBe('twilio')
    })
  })

  describe('enviarMensagem — sucesso', () => {
    it('retorna sucesso com sid', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sid: 'SM123456789' }),
      })

      const resultado = await provider.enviarMensagem({
        para: '+5511999999999',
        corpo: 'Mensagem de teste',
      })

      expect(resultado.sucesso).toBe(true)
      expect(resultado.idMensagemProvedor).toBe('SM123456789')
      expect(resultado.erro).toBeUndefined()
    })

    it('envia para o número correto no formato whatsapp:', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sid: 'SM_abc' }),
      })

      await provider.enviarMensagem({ para: '+5511999999999', corpo: 'Teste' })

      const chamada = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = new URLSearchParams(chamada[1].body)
      expect(body.get('To')).toBe('whatsapp:+5511999999999')
      expect(body.get('From')).toBe('whatsapp:+14155238886')
    })

    it('usa autenticação Basic correta', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sid: 'SM_abc' }),
      })

      await provider.enviarMensagem({ para: '+5511999999999', corpo: 'Teste' })

      const chamada = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const authHeader = chamada[1].headers['Authorization']
      const credEsperada = Buffer.from('ACtest123:authtoken456').toString('base64')
      expect(authHeader).toBe(`Basic ${credEsperada}`)
    })

    it('URL da requisição inclui accountSid', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sid: 'SM_abc' }),
      })

      await provider.enviarMensagem({ para: '+5511999999999', corpo: 'Teste' })

      const url = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]
      expect(url).toContain('ACtest123')
      expect(url).toContain('Messages.json')
    })

    it('envia o corpo da mensagem corretamente', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sid: 'SM_abc' }),
      })

      await provider.enviarMensagem({ para: '+5511999999999', corpo: 'Olá, Marco!' })

      const chamada = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0]
      const body = new URLSearchParams(chamada[1].body)
      expect(body.get('Body')).toBe('Olá, Marco!')
    })
  })

  describe('enviarMensagem — erro HTTP', () => {
    it('retorna sucesso=false com mensagem de erro da API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ message: 'The number is not verified' }),
      })

      const resultado = await provider.enviarMensagem({
        para: '+5511999999999',
        corpo: 'Teste',
      })

      expect(resultado.sucesso).toBe(false)
      expect(resultado.erro).toBe('The number is not verified')
    })
  })

  describe('enviarMensagem — erro de rede', () => {
    it('captura exceção e retorna sucesso=false', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'))

      const resultado = await provider.enviarMensagem({
        para: '+5511999999999',
        corpo: 'Teste',
      })

      expect(resultado.sucesso).toBe(false)
      expect(resultado.erro).toBe('Connection refused')
    })
  })
})
