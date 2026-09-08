'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AuthHeader } from '@/app/auth-header'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [supabase] = useState(() => createClient())
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  useEffect(() => {
    // The recovery link puts a temporary session in the URL; the browser
    // client picks it up automatically on load. We just wait for it.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setReady(true)
      }
    })

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setReady(true)
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres.')
      return
    }
    if (password !== confirmPassword) {
      setError('Las dos contraseñas no coinciden.')
      return
    }

    setPending(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setPending(false)

    if (updateError) {
      setError('No se pudo cambiar la contraseña. Pide un enlace nuevo e inténtalo otra vez.')
      return
    }

    router.push('/admin')
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen flex-col bg-gradient-to-b from-ink to-ink-2">
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-8 px-6 py-12 text-center">
          <AuthHeader />
          <div className="flex w-full flex-col gap-4">
            <h1 className="text-2xl font-display text-white">Enlace no válido</h1>
            <p className="text-cream-dim">
              Abre esta página directamente desde el enlace del email que te hemos enviado.
            </p>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-ink to-ink-2">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-8 px-6 py-12">
      <AuthHeader />
      <div className="flex w-full flex-col gap-6">
      <h1 className="text-2xl font-display text-white">Elige una contraseña nueva</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm text-cream-dim">
            Contraseña nueva
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white focus:border-ember focus:outline-none"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="confirm-password" className="text-sm text-cream-dim">
            Repite la contraseña
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-white focus:border-ember focus:outline-none"
          />
        </div>
        {error && <p className="text-sm text-rust">{error}</p>}
        <button
          disabled={pending}
          type="submit"
          className="rounded-lg bg-ember px-4 py-2.5 font-medium text-ink disabled:opacity-50"
        >
          {pending ? 'Guardando…' : 'Guardar contraseña'}
        </button>
      </form>
      </div>
      </main>
    </div>
  )
}
