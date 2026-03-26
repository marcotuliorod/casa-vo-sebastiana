import { createAdminClient } from '@/lib/supabase/server'
import type { Recado } from '@/types/database'

export async function listarRecados(): Promise<Recado[]> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('recados')
    .select('*')
    .eq('ativo', true)
    .order('fixado', { ascending: false })
    .order('criado_em', { ascending: false })
  return (data ?? []) as Recado[]
}
