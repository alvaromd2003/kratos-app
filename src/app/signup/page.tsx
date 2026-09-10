import { Suspense } from 'react'
import { AuthLocaleShell } from '@/app/auth-locale-shell'
import { SignupForm } from './signup-form'

export default function SignupPage() {
  return (
    <AuthLocaleShell>
      <Suspense>
        <SignupForm />
      </Suspense>
    </AuthLocaleShell>
  )
}
