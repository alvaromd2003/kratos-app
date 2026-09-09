export const metadata = { title: 'Encargado de tratamiento — Kratos' }

export default function DataProcessingPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16 text-ink">
      <h1 className="font-display text-3xl text-ink">Contrato de encargado de tratamiento</h1>
      <p className="text-xs font-mono uppercase tracking-wide text-bronze">
        Última actualización: septiembre de 2026 · Art. 28 RGPD
      </p>

      <Section title="1. Partes">
        Este contrato regula el tratamiento de datos personales de los comensales del restaurante
        (&quot;el Responsable&quot;) por parte de Kratos Systems (&quot;el Encargado&quot;), en el
        marco del uso de la plataforma Kratos.
      </Section>

      <Section title="2. Objeto y duración">
        El Encargado tratará, por cuenta del Responsable, los datos personales de los comensales
        del Responsable estrictamente para prestar el servicio de pedidos y pagos por QR
        contratado. Este contrato estará vigente mientras exista una suscripción activa entre las
        partes.
      </Section>

      <Section title="3. Naturaleza y finalidad del tratamiento">
        Gestión de pedidos en tiempo real, procesamiento de pagos (a través de Stripe), programa
        de fidelización opcional, y recogida de valoraciones de satisfacción.
      </Section>

      <Section title="4. Tipo de datos y categorías de interesados">
        <p><strong>Interesados</strong>: comensales que escanean el código QR de una mesa del Responsable.</p>
        <p className="mt-2">
          <strong>Datos</strong>: nombre indicado al pedir, email (solo si se apunta a
          fidelización), contenido del pedido, valoración de satisfacción, y metadatos del pago
          (nunca el número completo de tarjeta, que gestiona Stripe directamente).
        </p>
      </Section>

      <Section title="5. Obligaciones del Encargado">
        <ul className="list-disc pl-5">
          <li>Tratar los datos únicamente siguiendo las instrucciones documentadas del Responsable, y solo para la finalidad de este contrato.</li>
          <li>Garantizar la confidencialidad del personal con acceso a los datos.</li>
          <li>Aplicar medidas técnicas y organizativas adecuadas (cifrado en tránsito, control de acceso por roles, copias de seguridad).</li>
          <li>Notificar al Responsable, sin dilación indebida, cualquier violación de seguridad de los datos de la que tenga conocimiento.</li>
          <li>Asistir al Responsable en el cumplimiento de sus obligaciones de responder a solicitudes de derechos de los interesados.</li>
          <li>Suprimir o devolver todos los datos personales al finalizar la prestación del servicio, salvo obligación legal de conservarlos.</li>
        </ul>
      </Section>

      <Section title="6. Subencargados de tratamiento">
        El Responsable autoriza al Encargado a subcontratar el tratamiento a los siguientes
        proveedores, cada uno actuando como subencargado bajo su propio compromiso de protección
        de datos: Supabase (base de datos y autenticación), Stripe (procesamiento de pagos),
        Vercel (alojamiento de la aplicación), y Resend (envío de emails transaccionales). El
        Encargado informará al Responsable de cualquier cambio previsto en esta lista.
      </Section>

      <Section title="7. Auditoría">
        El Responsable podrá solicitar al Encargado información razonable para verificar el
        cumplimiento de este contrato.
      </Section>

      <p className="text-xs text-bronze">
        Kratos se encuentra en proceso de constitución legal como actividad económica. La
        titularidad formal (nombre legal, NIF) se incorporará a este documento en cuanto se
        complete ese trámite.
      </p>
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
