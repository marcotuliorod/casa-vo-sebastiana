import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getAdminUser } from '@/lib/auth/admin'
import { LoginForm } from './LoginForm'

export const dynamic = 'force-dynamic'

export default async function LoginPage() {
  // Quem já está autenticado (e autorizado) não precisa pedir novo link.
  const user = await getAdminUser()
  if (user) redirect('/admin')

  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
