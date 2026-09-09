export const metadata = { title: 'Términos y condiciones — Kratos' }

export default function TermsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16 text-ink">
      <h1 className="font-display text-3xl text-ink">Términos y condiciones</h1>
      <p className="text-xs font-mono uppercase tracking-wide text-bronze">
        Última actualización: septiembre de 2026
      </p>

      <Section title="1. Objeto">
        Estas condiciones regulan el uso de Kratos por parte de un restaurante (&quot;el
        Cliente&quot;) que se registra para gestionar pedidos, mesas y pagos de sus comensales a
        través de la plataforma, prestada por Kratos Systems (kratosystems.com).
      </Section>

      <Section title="2. Descripción del servicio">
        Kratos permite a los comensales de un restaurante pedir y pagar desde su propio móvil,
        escaneando un código QR en su mesa, sin necesidad de que un camarero tome nota. Incluye
        gestión de menú, mesas, cocina, pagos, fidelización y estadísticas para el Cliente.
      </Section>

      <Section title="3. Prueba gratuita y acceso">
        El registro requiere un código de acceso facilitado por Kratos. El Cliente dispone de{' '}
        <strong>30 días de prueba gratuita</strong> desde la creación de su restaurante en la
        plataforma. Transcurrido ese plazo sin una suscripción activa, el acceso al panel de
        gestión se suspende hasta contactar con Kratos.
      </Section>

      <Section title="4. Precio y facturación">
        La suscripción mensual tiene un precio de bienvenida de 350€/mes durante los primeros 6
        meses, pasando después a 600€/mes. Este precio reducido solo aplica mientras Kratos no
        disponga de casos de éxito acreditados con clientes reales; a partir de ese momento, los
        nuevos clientes se suscriben directamente al precio de 600€/mes. El precio no incluye IVA.
      </Section>

      <Section title="5. Pagos de los comensales">
        Los pagos que realizan los comensales de un Cliente se procesan a través de Stripe y se
        abonan directamente en la cuenta de Stripe Connect del propio Cliente. Kratos no retiene
        comisión alguna sobre estos pagos en la fecha de este documento, y no tiene acceso a los
        fondos ni a los datos completos de las tarjetas de los comensales.
      </Section>

      <Section title="6. Obligaciones del Cliente">
        <ul className="list-disc pl-5">
          <li>Mantener actualizada la información de su restaurante, menú y precios.</li>
          <li>Gestionar correctamente el acceso de su personal (altas y bajas).</li>
          <li>Cumplir con sus propias obligaciones fiscales sobre las ventas realizadas a través de Kratos.</li>
          <li>No usar la plataforma con fines distintos a la gestión de su propio negocio de restauración.</li>
        </ul>
      </Section>

      <Section title="7. Obligaciones de Kratos">
        <ul className="list-disc pl-5">
          <li>Mantener la plataforma operativa con una disponibilidad razonable.</li>
          <li>
            Tratar los datos de los comensales conforme al{' '}
            <a href="/tratamiento-datos" className="underline">
              contrato de encargado de tratamiento
            </a>
            .
          </li>
          <li>Notificar al Cliente ante cualquier incidencia de seguridad relevante.</li>
        </ul>
      </Section>

      <Section title="8. Cancelación">
        El Cliente puede darse de baja en cualquier momento; la suscripción se mantiene activa
        hasta el final del periodo ya facturado. No se realizan reembolsos por periodos parciales,
        salvo que la ley aplicable disponga lo contrario.
      </Section>

      <Section title="9. Limitación de responsabilidad">
        Kratos no será responsable de pérdidas derivadas de un uso indebido de la plataforma por
        parte del Cliente o su personal, ni de incidencias originadas por terceros proveedores
        (Stripe, Supabase, Vercel) fuera de su control razonable.
      </Section>

      <Section title="10. Ley aplicable">
        Estas condiciones se rigen por la legislación española. Cualquier disputa se someterá a
        los juzgados y tribunales que correspondan según la normativa de consumidores aplicable.
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
