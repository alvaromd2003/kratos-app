'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { requestPasswordReset } from '@/app/actions/auth'
import { AuthHeader } from '@/app/auth-header'

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined)

  return (
    <div className="flex min-h-screen flex-col">
      <AuthHeader />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-display text-ink">Recuperar contraseña</h1>
      <p className="text-sm text-bronze">
        Te enviaremos un enlace para elegir una contraseña nueva.
      </p>
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="rounded-lg border border-marble-3 px-3 py-2 focus:border-ember focus:outline-none"
          />
        </div>
        {state?.error && <p className="text-sm text-rust">{state.error}</p>}
        <button
          disabled={pending}
          type="submit"
          className="rounded-lg bg-ink px-4 py-2.5 font-medium text-white disabled:opacity-50"
        >
          {pending ? 'Enviando…' : 'Enviar enlace'}
        </button>
      </form>
      <p className="text-sm">
        <Link href="/login" className="underline">
          Volver a iniciar sesión
        </Link>
      </p>
      </main>
    </div>
  )
}
