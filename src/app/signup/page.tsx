'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/actions/auth'
import { AuthHeader } from '@/app/auth-header'

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined)

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-ink to-ink-2">
      <AuthHeader />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-display text-white">Crear cuenta en Kratos</h1>
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm text-cream-dim">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white focus:border-ember focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm text-cream-dim">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white focus:border-ember focus:outline-none"
          />
          <span className="text-xs text-cream-dim">Mínimo 8 caracteres.</span>
        </div>
        {state?.error && <p className="text-sm text-rust">{state.error}</p>}
        <button
          disabled={pending}
          type="submit"
          className="rounded-lg bg-ember px-4 py-2.5 font-medium text-ink disabled:opacity-50"
        >
          {pending ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
      <p className="text-sm text-cream-dim">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="underline">
          Entra
        </Link>
      </p>
      </main>
    </div>
  )
}
