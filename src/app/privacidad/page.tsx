export const metadata = { title: 'Política de privacidad — Kratos' }

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16 text-ink">
      <h1 className="font-display text-3xl text-ink">Política de privacidad</h1>
      <p className="text-xs font-mono uppercase tracking-wide text-bronze">
        Última actualización: septiembre de 2026
      </p>

      <Section title="1. Quién trata tus datos">
        Esta política de privacidad aplica al uso de Kratos, la plataforma de pedidos y pagos por
        código QR para restaurantes, gestionada por Kratos Systems (kratosystems.com). Puedes
        contactar con nosotros para cualquier cuestión de privacidad en{' '}
        <a href="mailto:hola@kratosystems.com" className="underline">
          hola@kratosystems.com
        </a>
        .
      </Section>

      <Section title="2. A quién se dirige esta política">
        Kratos trata datos de dos tipos de personas distintas, con finalidades distintas:
        <ul className="mt-2 list-disc pl-5">
          <li><strong>Comensales</strong>: personas que escanean el código QR de una mesa para pedir y pagar.</li>
          <li><strong>Personal del restaurante</strong>: propietarios, administradores, cocina y camareros que usan el panel de gestión de Kratos.</li>
        </ul>
        <p className="mt-2">
          Para los comensales, el restaurante decide qué datos se recogen y para qué (es el
          &quot;responsable del tratamiento&quot;); Kratos actúa como &quot;encargado del
          tratamiento&quot; en su nombre — ver el{' '}
          <a href="/tratamiento-datos" className="underline">
            contrato de encargado de tratamiento
          </a>
          .
        </p>
      </Section>

      <Section title="3. Qué datos recogemos">
        <p className="font-medium">De los comensales:</p>
        <ul className="mt-2 list-disc pl-5">
          <li>Nombre indicado al unirte a la mesa — para identificarte dentro del pedido compartido.</li>
          <li>Email (opcional, solo si te apuntas al programa de fidelización) — para guardar tus sellos.</li>
          <li>Contenido del pedido (platos, cantidades, notas) — para que la cocina prepare lo que has pedido.</li>
          <li>Valoración de 1 a 5 estrellas (opcional) — para que el restaurante conozca tu experiencia.</li>
          <li>Datos de pago — gestionados directamente por Stripe; Kratos nunca ve ni guarda el número de tu tarjeta.</li>
        </ul>
        <p className="mt-3">
          No pedimos contraseña ni creamos una cuenta para los comensales — no hace falta
          registrarse para pedir.
        </p>
        <p className="mt-3 font-medium">Del personal del restaurante:</p>
        <p className="mt-1">
          Email, contraseña (cifrada), nombre y rol dentro del restaurante (propietario,
          administrador, cocina, camarero).
        </p>
      </Section>

      <Section title="4. Con quién compartimos los datos">
        No vendemos datos a nadie. Los compartimos únicamente con los proveedores que necesitamos
        para que Kratos funcione:
        <ul className="mt-2 list-disc pl-5">
          <li><strong>Supabase</strong> — base de datos y autenticación.</li>
          <li><strong>Stripe</strong> — procesamiento de pagos y suscripciones.</li>
          <li><strong>Vercel</strong> — alojamiento de la aplicación.</li>
          <li><strong>Resend</strong> — envío de emails transaccionales.</li>
          <li><strong>Hostinger</strong> — alojamiento de la web y el correo corporativo.</li>
        </ul>
      </Section>

      <Section title="5. Cuánto tiempo guardamos los datos">
        Los datos de un pedido/mesa se conservan mientras el restaurante mantenga su cuenta activa
        en Kratos, y el tiempo adicional que exija la normativa fiscal y contable aplicable. Si te
        apuntaste a fidelización, tu email y tus sellos se conservan hasta que el restaurante los
        elimine o tú lo solicites.
      </Section>

      <Section title="6. Tus derechos">
        Conforme al RGPD y la LOPDGDD, puedes ejercer en cualquier momento tus derechos de acceso,
        rectificación, supresión, oposición, limitación y portabilidad escribiendo a{' '}
        <a href="mailto:hola@kratosystems.com" className="underline">
          hola@kratosystems.com
        </a>
        . Si tu dato lo recogió el restaurante (comensal), también puedes dirigirte directamente a él.
      </Section>

      <Section title="7. Cookies">
        Kratos usa una única cookie técnica, estrictamente necesaria, para reconocerte dentro de
        la mesa en la que estás pidiendo. No rastrea tu navegación fuera de la app ni se usa con
        fines publicitarios.
      </Section>
    </main>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <div className="text-sm leading-relaxed text-ink-2">{children}</div>
    </section>
  )
}
