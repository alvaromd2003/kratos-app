import { requireManagerRole } from '@/lib/restaurant'

export default async function HelpPage() {
  await requireManagerRole()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <h1 className="text-2xl font-display text-ink">Ayuda — Cómo configurar Kratos</h1>

      <Section title="1. El menú">
        <p>
          Ve a <b>Menú</b>. En &quot;Nueva categoría&quot;, escribe el nombre (Entrantes,
          Principales, Postres, Bebidas...) y en el desplegable &quot;Va a&quot; elige{' '}
          <b>Cocina</b> o <b>Barra</b> — así el sistema sabe a qué pantalla mandar cada pedido
          automáticamente. Dale a &quot;Añadir&quot;.
        </p>
        <p>
          Luego añade tus platos: nombre, precio, foto (opcional), descripción. Si quieres marcar
          alérgenos (sin gluten, vegano, etc.), primero tienes que activarlos en{' '}
          <b>Ajustes → Etiquetas de alérgenos/dieta</b> — solo entonces aparecerán como casillas al
          crear o editar un plato. También puedes marcar un plato como disponible solo en una
          franja horaria (por ejemplo, un desayuno) con &quot;Disponible desde/hasta&quot;.
        </p>
      </Section>

      <Section title="2. Mesas y códigos QR">
        <p>
          En <b>Mesas</b>, escribe un nombre (ej. &quot;1&quot;, &quot;Terraza 2&quot;) y dale a
          &quot;Añadir&quot; — una fila por cada mesa física de tu local. Al momento aparece su
          código QR en pantalla.
        </p>
        <p>
          Para imprimirlo: haz clic derecho sobre la imagen del QR → &quot;Guardar imagen
          como...&quot; (o mantén pulsado sobre ella en el móvil) y mándala a imprimir, o
          simplemente imprime la página con Ctrl+P / Cmd+P. Coloca cada QR impreso en su mesa
          correspondiente — al escanearlo, el cliente entra directamente a pedir en esa mesa.
        </p>
      </Section>

      <Section title="3. Cobros con Stripe">
        <p>
          Para que tus clientes puedan pagar desde el móvil, hace falta conectar una cuenta de
          Stripe. Ve a <b>Ajustes</b>, baja hasta la sección &quot;Cobros&quot; y dale a{' '}
          <b>Conectar con Stripe</b>. Te llevará a un formulario de Stripe pidiendo datos del
          negocio y de una cuenta bancaria donde recibir los cobros.
        </p>
        <p>
          Ten en cuenta que Stripe puede tardar un tiempo en verificar los datos de una cuenta
          nueva antes de dejar recibir pagos reales — es un paso de Stripe, no de Kratos, y no hay
          forma de acelerarlo. Cuando quede verificado, en Ajustes verás &quot;✓ Cobros con Stripe
          activados&quot;.
        </p>
        <p>
          En esa misma sección de Ajustes puedes elegir qué métodos de pago aceptar además de
          tarjeta (Bizum, Revolut Pay, PayPal, según lo que tengas disponible), y añadir el enlace
          de tu ficha de reseñas de Google para que los clientes satisfechos puedan dejarte una
          reseña fácilmente.
        </p>
      </Section>

      <Section title="4. Tu equipo">
        <p>Hay 4 tipos de acceso:</p>
        <ul className="ml-5 list-disc">
          <li><b>Propietario/Administrador</b> — acceso a todo: menú, mesas, historial, estadísticas, personal y ajustes.</li>
          <li><b>Cocina</b> — solo ve la pantalla de Cocina, con los pedidos por preparar.</li>
          <li><b>Camarero</b> — solo ve Barra: qué mesas están ocupadas, avisos de los clientes, y los pedidos listos para servir.</li>
        </ul>
        <p>
          Invita a tu equipo desde <b>Personal</b>: escribe su email, elige su rol en el
          desplegable (Cocina, Camarero o Administrador), y dale a &quot;Invitar&quot;. Les llegará
          un correo con un enlace para crear su contraseña — el propietario no se invita, ya es
          quien creó la cuenta.
        </p>
      </Section>

      <Section title="5. El día a día">
        <p>
          El cliente escanea el QR, entra su nombre, y pide desde el móvil — el pedido llega solo
          a Cocina y/o Barra según lo que haya pedido. Cuando terminan de comer, pagan desde la
          misma pantalla, en el modo que prefieran: su parte individual, la cuenta entera dividida
          a partes iguales, un plato compartido dividido solo entre quienes lo pidieron, efectivo
          avisando al personal, o toda la cuenta de una vez.
        </p>
        <p>
          Si algún cliente no quiere o no puede usar su móvil, el personal puede tomarle el pedido
          a mano desde <b>Barra → Pedido asistido</b> en esa mesa — queda registrado igual que
          cualquier otro pedido.
        </p>
      </Section>

      <Section title="Preguntas frecuentes">
        <p>
          <b>¿Cuánto se queda Kratos de cada cobro?</b> Nada — el 100% de cada pago llega directo a
          tu cuenta bancaria a través de Stripe.
        </p>
        <p>
          <b>¿Qué pasa si cierro una mesa y aún debe dinero?</b> El sistema te avisa antes de
          cerrarla, pero te deja hacerlo igualmente (por ejemplo, si ya cobraste en efectivo por tu
          cuenta o con tu datáfono habitual).
        </p>
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2 border-l-2 border-marble-3 pl-4">
      <h2 className="font-display text-lg text-ink">{title}</h2>
      <div className="flex flex-col gap-2 text-sm text-bronze">{children}</div>
    </section>
  )
}
