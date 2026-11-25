'use client'

import { useState } from 'react'

/** Máscara de telefone brasileiro enquanto a pessoa digita: (11) 99999-9999 */
export function usePhoneMask() {
  const [value, setValue] = useState('')

  const handleInput = (e: React.FormEvent<HTMLInputElement>) => {
    let v = e.currentTarget.value.replace(/\D/g, '')
    if (v.length > 11) v = v.slice(0, 11)
    let formatted = v
    if (v.length === 11) {
      formatted = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`
    } else if (v.length === 10) {
      formatted = `(${v.slice(0, 2)}) ${v.slice(2, 6)}-${v.slice(6)}`
    } else if (v.length > 6) {
      formatted = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`
    } else if (v.length > 2) {
      formatted = `(${v.slice(0, 2)}) ${v.slice(2)}`
    } else if (v.length > 0) {
      formatted = `(${v}`
    }
    setValue(formatted)
  }

  return [value, handleInput] as const
}
