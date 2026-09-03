export default function CheckEmailPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl font-semibold">Revisa tu email</h1>
      <p className="text-gray-600">
        Te hemos enviado un enlace de confirmación. Ábrelo y luego vuelve a{' '}
        <a href="/login" className="underline">
          iniciar sesión
        </a>
        .
      </p>
    </main>
  )
}
