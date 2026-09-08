import { AuthHeader } from '@/app/auth-header'

export default function CheckEmailPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-ink to-ink-2">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-8 px-6 py-12 text-center">
        <AuthHeader />
        <div className="flex w-full flex-col gap-4">
          <h1 className="text-2xl font-display text-white">Revisa tu email</h1>
          <p className="text-cream-dim">
            Te hemos enviado un enlace de confirmación. Ábrelo y luego vuelve a{' '}
            <a href="/login" className="text-white underline">
              iniciar sesión
            </a>
            .
          </p>
        </div>
      </main>
    </div>
  )
}
