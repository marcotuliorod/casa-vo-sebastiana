import { CAMPO_ISCA } from '@/lib/isca'

/**
 * Campo isca: escondido de quem usa o site, mas robôs que preenchem todos os
 * campos do HTML caem nele. A action recusa o pedido quando ele vem preenchido.
 */
export function CampoIsca() {
  return (
    <div hidden aria-hidden="true">
      <label>
        Deixe este campo em branco
        <input type="text" name={CAMPO_ISCA} tabIndex={-1} autoComplete="off" defaultValue="" />
      </label>
    </div>
  )
}
