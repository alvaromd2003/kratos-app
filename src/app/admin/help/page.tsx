import { requireManagerRole } from '@/lib/restaurant'

export default async function HelpPage() {
  await requireManagerRole()

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <h1 className="text-xl font-semibold">Ayuda — Cómo configurar Kratos</h1>

      <Section title="1. El menú">
        <p>
          Ve a <b>Menú</b> y crea primero tus categorías (Entrantes, Principales, Postres,
          Bebidas...). Para cada categoría, elige si va a <b>Cocina</b> o a <b>Barra</b> — así el
          sistema sabe a qué pantalla mandar cada pedido automáticamente.
        </p>
        <p>
          Luego añade tus platos: nombre, precio, foto (opcional), descripción, y qué alérgenos
          aplican si los has activado en Ajustes. También puedes marcar un plato como disponible
          solo en una franja horaria (por ejemplo, un desayuno) con &quot;Disponible desde/hasta&quot;.
        </p>
      </Section>

      <Section title="2. Mesas y códigos QR">
        <p>
          En <b>Mesas</b>, crea una fila por cada mesa física de tu local. Cada una genera su
          propio código QR — imprímelo y colócalo en la mesa correspondiente. Al escanearlo, el
          cliente entra directamente a pedir en esa mesa.
        </p>
      </Section>

      <Section title="3. Cobros con Stripe">
        <p>
          Para que tus clientes puedan pagar desde el móvil, hace falta conectar una cuenta de
          Stripe. Ve a <b>Ajustes → Cobros → Conectar con Stripe</b> y sigue el proceso (te pedirá
          datos del negocio y de una cuenta bancaria para recibir los cobros).
        </p>
        <p>
          Una vez conectado, en esa misma sección puedes elegir qué métodos de pago aceptar además
          de tarjeta (Bizum, Revolut Pay, PayPal, según lo que tengas disponible), y añadir el
          enlace de tu ficha de Google para que los clientes satisfechos puedan dejarte una reseña
          fácilmente.
        </p>
      </Section>

      <Section title="4. Tu equipo">
        <p>Hay 4 tipos de acceso:</p>
        <ul className="ml-5 list-disc">
          <li><b>Dueño/Administrador</b> — acceso a todo: menú, mesas, historial, estadísticas, personal y ajustes.</li>
          <li><b>Cocina</b> — solo ve la pantalla de Cocina, con los pedidos por preparar.</li>
          <li><b>Camarero</b> — solo ve Barra: qué mesas están ocupadas, avisos de los clientes, y los pedidos listos para servir.</li>
        </ul>
        <p>
          Invita a tu equipo desde <b>Personal</b> con su email — les llegará un enlace para crear
          su contraseña.
        </p>
      </Section>

      <Section title="5. El día a día">
        <p>
          El cliente escanea el QR, entra su nombre, y pide desde el móvil — el pedido llega solo
          a Cocina y/o Barra según lo que haya pedido. Cuando terminan de comer, pagan desde la
          misma pantalla (individual, dividido entre varios, pagando platos concretos, en efectivo
          avisando al personal, o toda la cuenta de una vez).
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
    <section className="flex flex-col gap-2">
      <h2 className="font-medium">{title}</h2>
      <div className="flex flex-col gap-2 text-sm text-gray-700">{children}</div>
    </section>
  )
}
