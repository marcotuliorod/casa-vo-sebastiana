import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TextoFormatado } from '@/components/shared/TextoFormatado'

const DESCRICAO_REAL = `🌿 **GIRA DE UMBANDA — CABOCLO** 🌿

Neste próximo domingo, a **Casa de Vó Sebastiana** abre suas portas.

📍 **Casa de Vó Sebastiana**
Rua Japurá, 490 — Bairro Renascença

🕯️ **Horário de chegada:** das **18h40 às 19h00**

⚠️ **Vagas limitadas.**`

describe('TextoFormatado', () => {
  it('renderiza **negrito** como <strong> e não deixa asteriscos literais', () => {
    const { container } = render(<TextoFormatado texto={DESCRICAO_REAL} />)

    const negritos = Array.from(container.querySelectorAll('strong')).map((n) => n.textContent)
    expect(negritos).toContain('GIRA DE UMBANDA — CABOCLO')
    expect(negritos).toContain('18h40 às 19h00')
    expect(container.textContent).not.toContain('**')
  })

  it('preserva as quebras de linha do texto original', () => {
    const { container } = render(<TextoFormatado texto={DESCRICAO_REAL} />)

    expect(container.firstElementChild?.className).toContain('whitespace-pre-line')
    expect(container.textContent).toContain('Casa de Vó Sebastiana\nRua Japurá, 490')
    expect(container.textContent).toContain('\n\n')
  })

  it('renderiza *itálico* como <em>', () => {
    const { container } = render(<TextoFormatado texto="venha *com fé*" />)
    expect(container.querySelector('em')?.textContent).toBe('com fé')
  })

  it('não injeta HTML digitado no texto', () => {
    const { container } = render(<TextoFormatado texto={'<img src=x onerror=alert(1)> **ok**'} />)

    expect(container.querySelector('img')).toBeNull()
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>')
  })
})
