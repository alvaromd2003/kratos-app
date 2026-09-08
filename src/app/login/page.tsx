'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { AuthHeader } from '@/app/auth-header'

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined)

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-ink to-ink-2">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <AuthHeader />
      <div className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-display text-white">Entrar a Kratos</h1>
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
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white focus:border-ember focus:outline-none"
          />
        </div>
        {state?.error && <p className="text-sm text-rust">{state.error}</p>}
        <button
          disabled={pending}
          type="submit"
          className="rounded-lg bg-ember px-4 py-2.5 font-medium text-ink disabled:opacity-50"
        >
          {pending ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
      <p className="text-sm text-cream-dim">
        <Link href="/forgot-password" className="underline">
          ¿Olvidaste tu contraseña?
        </Link>
      </p>
      <p className="text-sm text-cream-dim">
        ¿No tienes cuenta?{' '}
        <Link href="/signup" className="underline">
          Regístrate
        </Link>
      </p>
      </div>
      </main>
    </div>
  )
}
