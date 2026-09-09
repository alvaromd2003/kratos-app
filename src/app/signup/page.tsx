'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/actions/auth'
import { AuthHeader } from '@/app/auth-header'

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined)

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-ink to-ink-2">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <AuthHeader />
      <div className="flex w-full flex-col gap-6">
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
        <div className="flex flex-col gap-1">
          <label htmlFor="access_code" className="text-sm text-cream-dim">
            Código de acceso
          </label>
          <input
            id="access_code"
            name="access_code"
            type="text"
            required
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white focus:border-ember focus:outline-none"
          />
          <span className="text-xs text-cream-dim">
            Te lo facilita Kratos — activa 1 mes de prueba gratis.
          </span>
        </div>
        <label className="flex items-start gap-2 text-sm text-cream-dim">
          <input
            name="accepted_terms"
            type="checkbox"
            required
            className="mt-0.5 h-4 w-4 shrink-0 accent-ember"
          />
          <span>
            He leído y acepto los{' '}
            <Link href="/terminos" target="_blank" className="underline">
              Términos y condiciones
            </Link>
            , la{' '}
            <Link href="/privacidad" target="_blank" className="underline">
              Política de privacidad
            </Link>{' '}
            y el{' '}
            <Link href="/tratamiento-datos" target="_blank" className="underline">
              tratamiento de datos de mis comensales
            </Link>
            .
          </span>
        </label>
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
      </div>
      </main>
    </div>
  )
}
