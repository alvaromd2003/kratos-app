import { AuthLocaleShell } from '@/app/auth-locale-shell'
import { LoginForm } from './login-form'

export default function LoginPage() {
  return (
    <AuthLocaleShell>
      <LoginForm />
    </AuthLocaleShell>
  )
}
