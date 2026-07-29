import Link from "next/link";

export const metadata = {
  title: "Tratamiento de datos personales | Portal ST",
  description: "Aviso de privacidad y autorización para el tratamiento de datos personales.",
};

export default function DataProcessingPage() {
  return (
    <main className="min-h-screen bg-[#0b0b0b] px-5 py-10 text-white sm:px-8">
      <article className="mx-auto max-w-3xl rounded-2xl border border-[#B03336]/60 bg-[#201E1E] p-6 shadow-2xl sm:p-10">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-[#facc15]">
          Portal ST
        </p>
        <h1 className="mt-3 text-3xl font-black uppercase tracking-tight">
          Tratamiento de datos personales
        </h1>
        <p className="mt-4 text-sm leading-7 text-white/80">
          Este aviso informa cómo Grupo Empresarial PST SAS utiliza los datos
          que proporcionas al realizar un pedido. El tratamiento se realiza
          conforme al régimen colombiano de protección de datos personales,
          especialmente la Ley 1581 de 2012 y sus normas reglamentarias.
        </p>

        <div className="mt-8 space-y-7 text-sm leading-7 text-white/80">
          <section className="rounded-xl border border-white/10 bg-black/20 p-4">
            <h2 className="text-lg font-black uppercase text-white">Responsable</h2>
            <p className="mt-2">
              <strong>Grupo Empresarial PST SAS</strong><br />
              NIT: 901946739<br />
              Dirección: Barrio Villa Claudia, Manzana G, esquina, Armenia,
              Quindío.<br />
              Correo: <a className="text-[#facc15] underline" href="mailto:elportal.st@gmail.com">elportal.st@gmail.com</a><br />
              Teléfono: <a className="text-[#facc15] underline" href="tel:+573046595522">3046595522</a><br />
              Área responsable: Gerencia
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black uppercase text-white">Datos que solicitamos</h2>
            <p className="mt-2">
              Nombre, dirección de entrega, teléfono celular, productos
              solicitados y observaciones relacionadas con el pedido.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black uppercase text-white">Finalidades</h2>
            <p className="mt-2">
              Usamos estos datos para recibir, preparar y entregar el pedido,
              comunicarnos contigo sobre su estado, confirmar el costo del
              domicilio y atender solicitudes relacionadas con la orden.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black uppercase text-white">Autorización y conservación</h2>
            <p className="mt-2">
              Al marcar la casilla de autorización, aceptas el tratamiento para
              las finalidades descritas. Conservaremos la información durante
              la gestión de la orden y hasta 12 meses después de la última
              orden. Después se eliminará o anonimizará, salvo que exista una
              obligación legal que exija conservarla por más tiempo.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-black uppercase text-white">Tus derechos</h2>
            <p className="mt-2">
              Puedes conocer, actualizar, rectificar o solicitar la supresión
              de tus datos, así como retirar la autorización cuando sea
              procedente. Para ejercer estos derechos, comunícate con el canal
              de atención del restaurante indicando tu nombre y el pedido
              relacionado.
            </p>
          </section>

          <section className="rounded-xl border border-amber-300/30 bg-amber-300/10 p-4 text-amber-100">
            <p className="font-bold">Versión del aviso: v3</p>
            <p className="mt-1 text-xs leading-6">
              Este texto es la versión operativa del MVP. Se recomienda que el
              responsable lo revise con su asesoría legal antes de publicarlo
              como política definitiva.
            </p>
          </section>
        </div>

        <Link
          href="/menu"
          className="mt-8 inline-flex rounded-lg border border-[#B03336] px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#B03336]"
        >
          Volver al menú
        </Link>
      </article>
    </main>
  );
}
