import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mocks dos providers — devem usar function() para serem construtores válidos
vi.mock('@/lib/whatsapp/providers/zapi', () => ({
  ZApiProvider: vi.fn().mockImplementation(function (this: Record<string, unknown>, config: unknown) {
    this.nome = 'zapi'
    this.config = config
    this.enviarMensagem = vi.fn()
  }),
}))

vi.mock('@/lib/whatsapp/providers/twilio', () => ({
  TwilioProvider: vi.fn().mockImplementation(function (this: Record<string, unknown>, config: unknown) {
    this.nome = 'twilio'
    this.config = config
    this.enviarMensagem = vi.fn()
  }),
}))

import { getProvedorWhatsApp } from '@/lib/whatsapp/factory'
import { ZApiProvider } from '@/lib/whatsapp/providers/zapi'
import { TwilioProvider } from '@/lib/whatsapp/providers/twilio'

// Env original
const ENV_ORIG = { ...process.env }

function setEnv(vars: Record<string, string | undefined>) {
  Object.assign(process.env, vars)
}

function clearEnv(keys: string[]) {
  keys.forEach((k) => delete process.env[k])
}

afterEach(() => {
  // Restaura env
  Object.keys(process.env).forEach((k) => {
    if (!(k in ENV_ORIG)) delete process.env[k]
  })
  Object.assign(process.env, ENV_ORIG)
  vi.clearAllMocks()
})

describe('lib/whatsapp/factory — getProvedorWhatsApp', () => {
  // ─── Z-API ────────────────────────────────────────────────────
  describe('quando WHATSAPP_PROVIDER=zapi', () => {
    beforeEach(() => {
      setEnv({
        WHATSAPP_PROVIDER: 'zapi',
        ZAPI_INSTANCE_ID: 'inst123',
        ZAPI_INSTANCE_TOKEN: 'tok456',
        ZAPI_CLIENT_TOKEN: 'cli789',
      })
    })

    it('retorna instância de ZApiProvider', () => {
      const provedor = getProvedorWhatsApp()
      expect(ZApiProvider).toHaveBeenCalledOnce()
      expect(ZApiProvider).toHaveBeenCalledWith({
        instanceId: 'inst123',
        instanceToken: 'tok456',
        clientToken: 'cli789',
      })
      expect(provedor.nome).toBe('zapi')
    })

    it('lança erro se ZAPI_INSTANCE_ID ausente', () => {
      clearEnv(['ZAPI_INSTANCE_ID'])
      expect(() => getProvedorWhatsApp()).toThrow('ZAPI_INSTANCE_ID')
    })

    it('lança erro se ZAPI_INSTANCE_TOKEN ausente', () => {
      clearEnv(['ZAPI_INSTANCE_TOKEN'])
      expect(() => getProvedorWhatsApp()).toThrow('ZAPI_INSTANCE_TOKEN')
    })

    it('lança erro se ZAPI_CLIENT_TOKEN ausente', () => {
      clearEnv(['ZAPI_CLIENT_TOKEN'])
      expect(() => getProvedorWhatsApp()).toThrow('ZAPI_CLIENT_TOKEN')
    })
  })

  // ─── Twilio ───────────────────────────────────────────────────
  describe('quando WHATSAPP_PROVIDER=twilio', () => {
    beforeEach(() => {
      setEnv({
        WHATSAPP_PROVIDER: 'twilio',
        TWILIO_ACCOUNT_SID: 'ACtest123',
        TWILIO_AUTH_TOKEN: 'authtoken456',
        TWILIO_WHATSAPP_FROM: '+14155238886',
      })
    })

    it('retorna instância de TwilioProvider', () => {
      const provedor = getProvedorWhatsApp()
      expect(TwilioProvider).toHaveBeenCalledOnce()
      expect(TwilioProvider).toHaveBeenCalledWith({
        accountSid: 'ACtest123',
        authToken: 'authtoken456',
        fromNumber: '+14155238886',
      })
      expect(provedor.nome).toBe('twilio')
    })

    it('lança erro se TWILIO_ACCOUNT_SID ausente', () => {
      clearEnv(['TWILIO_ACCOUNT_SID'])
      expect(() => getProvedorWhatsApp()).toThrow('TWILIO_ACCOUNT_SID')
    })

    it('lança erro se TWILIO_AUTH_TOKEN ausente', () => {
      clearEnv(['TWILIO_AUTH_TOKEN'])
      expect(() => getProvedorWhatsApp()).toThrow('TWILIO_AUTH_TOKEN')
    })

    it('lança erro se TWILIO_WHATSAPP_FROM ausente', () => {
      clearEnv(['TWILIO_WHATSAPP_FROM'])
      expect(() => getProvedorWhatsApp()).toThrow('TWILIO_WHATSAPP_FROM')
    })
  })

  // ─── Provedor inválido ────────────────────────────────────────
  describe('quando WHATSAPP_PROVIDER inválido', () => {
    it('lança erro para valor desconhecido', () => {
      setEnv({ WHATSAPP_PROVIDER: 'telegram' })
      expect(() => getProvedorWhatsApp()).toThrow('WHATSAPP_PROVIDER inválido')
    })

    it('lança erro quando variável não definida', () => {
      clearEnv(['WHATSAPP_PROVIDER'])
      expect(() => getProvedorWhatsApp()).toThrow('WHATSAPP_PROVIDER inválido')
    })

    it('mensagem de erro menciona "zapi" e "twilio"', () => {
      setEnv({ WHATSAPP_PROVIDER: 'invalido' })
      expect(() => getProvedorWhatsApp()).toThrow(/zapi.*twilio|twilio.*zapi/i)
    })
  })
})
