'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/actions/auth'

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined)

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">Crear cuenta en Kratos</h1>
      <form action={action} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            className="rounded border border-gray-300 px-3 py-2"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            className="rounded border border-gray-300 px-3 py-2"
          />
          <span className="text-xs text-gray-500">Mínimo 8 caracteres.</span>
        </div>
        {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          disabled={pending}
          type="submit"
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {pending ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
      <p className="text-sm">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="underline">
          Entra
        </Link>
      </p>
    </main>
  )
}
