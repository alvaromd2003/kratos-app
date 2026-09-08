import { AuthHeader } from '@/app/auth-header'

export default function ForgotPasswordCheckEmailPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gradient-to-b from-ink to-ink-2">
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center justify-center gap-8 px-6 py-12 text-center">
        <AuthHeader />
        <div className="flex w-full flex-col gap-4">
          <h1 className="text-2xl font-display text-white">Revisa tu email</h1>
          <p className="text-cream-dim">
            Si esa dirección tiene una cuenta, te hemos enviado un enlace para elegir una
            contraseña nueva. Ábrelo desde este mismo dispositivo.
          </p>
        </div>
      </main>
    </div>
  )
}
