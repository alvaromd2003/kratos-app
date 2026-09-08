import { AuthHeader } from '@/app/auth-header'

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <AuthHeader />
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-4 px-6 py-12 text-center">
        <h1 className="text-2xl font-display text-ink">Revisa tu email</h1>
        <p className="text-bronze">
          Te hemos enviado un enlace de confirmación. Ábrelo y luego vuelve a{' '}
          <a href="/login" className="underline">
            iniciar sesión
          </a>
          .
        </p>
      </main>
    </div>
  )
}
