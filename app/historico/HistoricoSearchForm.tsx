'use client'

import { useState } from 'react'
import { Search } from 'lucide-react'

interface Props {
  defaultValue?: string
}

export function HistoricoSearchForm({ defaultValue = '' }: Props) {
  const [value, setValue] = useState(defaultValue)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nums = e.target.value.replace(/\D/g, '').slice(0, 11)
    let formatted = nums
    if (nums.length > 2) formatted = `(${nums.slice(0, 2)}) ${nums.slice(2)}`
    if (nums.length > 7) formatted = `(${nums.slice(0, 2)}) ${nums.slice(2, 7)}-${nums.slice(7)}`
    setValue(formatted)
  }

  return (
    <form method="GET" className="flex gap-2 mb-8">
      <input
        type="tel"
        name="tel"
        value={value}
        onChange={handleChange}
        inputMode="numeric"
        placeholder="(11) 99999-9999"
        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400"
      />
      <button
        type="submit"
        className="flex items-center gap-1.5 rounded-lg bg-purple-700 px-4 py-2 text-sm font-medium text-white hover:bg-purple-800"
      >
        <Search className="h-4 w-4" />
        Buscar
      </button>
    </form>
  )
}
