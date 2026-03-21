'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { useTransition } from 'react'
import { criarMedium, toggleMediumAtivo } from '@/lib/actions/admin'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils/cn'
import { Link2, Loader2, UserCheck, UserX } from 'lucide-react'
import type { Medium } from '@/types/database'

interface MediunsManagerProps {
  mediuns: Medium[]
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" disabled={pending} className="bg-purple-700 hover:bg-purple-800">
      {pending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
      Cadastrar médium
    </Button>
  )
}

function CopiarLink({ token }: { token: string }) {
  const handleCopy = () => {
    const base = process.env.NEXT_PUBLIC_BASE_URL ?? window.location.origin
    navigator.clipboard.writeText(`${base}/mediuns/${token}`)
  }

  return (
    <button
      onClick={handleCopy}
      title="Copiar link de acesso"
      className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-800 hover:underline"
    >
      <Link2 className="h-3.5 w-3.5" />
      Copiar link
    </button>
  )
}

function ToggleAtivoButton({ medium }: { medium: Medium }) {
  const [, startTransition] = useTransition()

  const handleToggle = () => {
    startTransition(async () => {
      await toggleMediumAtivo(medium.id, !medium.ativo)
    })
  }

  return (
    <button
      onClick={handleToggle}
      title={medium.ativo ? 'Desativar médium' : 'Reativar médium'}
      className={cn(
        'flex items-center gap-1.5 text-xs font-medium',
        medium.ativo
          ? 'text-red-500 hover:text-red-700'
          : 'text-green-600 hover:text-green-800'
      )}
    >
      {medium.ativo ? (
        <>
          <UserX className="h-3.5 w-3.5" />
          Desativar
        </>
      ) : (
        <>
          <UserCheck className="h-3.5 w-3.5" />
          Reativar
        </>
      )}
    </button>
  )
}

export function MediunsManager({ mediuns }: MediunsManagerProps) {
  const [estado, action] = useFormState(criarMedium, null)

  return (
    <div className="space-y-6">
      {/* Formulário de cadastro */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="text-base font-semibold text-gray-800 mb-4">Adicionar médium</h2>
        <form action={action} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="nome">Nome completo *</Label>
              <Input id="nome" name="nome" placeholder="Ex: Mãe Joana" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="especialidade">
                Especialidade{' '}
                <span className="font-normal text-gray-400 text-xs">(opcional)</span>
              </Label>
              <Input
                id="especialidade"
                name="especialidade"
                placeholder="Ex: Umbanda, Passe, Cura"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="telefone">
                Telefone{' '}
                <span className="font-normal text-gray-400 text-xs">(opcional)</span>
              </Label>
              <Input id="telefone" name="telefone" type="tel" placeholder="(11) 99999-9999" />
            </div>
          </div>

          {estado?.erro && (
            <p className="text-sm text-red-600">{estado.erro}</p>
          )}

          <SubmitButton />
        </form>
      </div>

      {/* Lista de médiuns */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-3 border-b bg-gray-50">
          <h2 className="text-base font-semibold text-gray-800">
            Médiuns cadastrados{' '}
            <span className="text-sm font-normal text-gray-500">({mediuns.length})</span>
          </h2>
        </div>

        {mediuns.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            Nenhum médium cadastrado ainda.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-5 py-3 text-left">Nome</th>
                <th className="px-5 py-3 text-left">Especialidade</th>
                <th className="px-5 py-3 text-left">Telefone</th>
                <th className="px-5 py-3 text-left">Status</th>
                <th className="px-5 py-3 text-left">Acesso</th>
                <th className="px-5 py-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {mediuns.map((m) => (
                <tr
                  key={m.id}
                  className={cn(
                    'transition-colors',
                    m.ativo ? 'hover:bg-gray-50' : 'bg-gray-50 opacity-60'
                  )}
                >
                  <td className="px-5 py-3 font-medium text-gray-900">{m.nome}</td>
                  <td className="px-5 py-3 text-gray-500">{m.especialidade ?? '—'}</td>
                  <td className="px-5 py-3 text-gray-500">{m.telefone ?? '—'}</td>
                  <td className="px-5 py-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium',
                        m.ativo
                          ? 'bg-green-50 text-green-700 border border-green-200'
                          : 'bg-gray-100 text-gray-500 border border-gray-200'
                      )}
                    >
                      {m.ativo ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    {m.ativo && <CopiarLink token={m.token_acesso} />}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <ToggleAtivoButton medium={m} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
