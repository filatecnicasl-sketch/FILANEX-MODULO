import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Seccion, Sub, Paso, Nota, K } from "./comun.jsx";

export default function AyudaTpvPage() {
  return (
    <>
      <CabeceraPagina
        titulo="Ayuda · TPV"
        descripcion="Manual del terminal de venta. Cómo vender, usar el teclado, gestionar la caja y configurar el ticket."
      />
      <div className="space-y-4 max-w-4xl">
        <Seccion titulo="Antes de empezar">
          <Paso n={1}>
            El TPV funciona como un punto de venta táctil o con ratón: las mismas pantallas sirven para monitor táctil y PC.
          </Paso>
          <Paso n={2}>
            Antes de cobrar tu primera venta tienes que abrir la caja. Sin caja abierta el terminal te avisa y no deja vender.
          </Paso>
          <Paso n={3}>
            Configura tu impresora de tickets en <b>TPV → Ajustes</b>: modo navegador (cualquier impresora del sistema) o ESC/POS (impresora térmica directa).
          </Paso>
        </Seccion>

        <Seccion titulo="Pantalla del terminal (TPV → Terminal)">
          <Sub>Barra superior</Sub>
          <Paso n={1}>
            <K>Volver</K> vuelve al escritorio. A la derecha están el buscador de artículos y los botones <K>Tickets</K>, <K>Caja</K> y <K>Ayuda</K>.
          </Paso>
          <Paso n={2}>
            El buscador sirve para escribir código de barras, referencia o nombre. También puedes leer con el escáner configurado en Ajustes.
          </Paso>

          <Sub>Columna de familias (izquierda)</Sub>
          <Paso n={1}>
            Ves <K>Favoritos</K>, <K>Todas</K> y cada familía de artículos. Pulsa una para filtrar la rejilla central.
          </Paso>
          <Paso n={2}>
            Las familias se configuran desde <b>Artículos → Familias TPV</b>: nombre, orden, color e imagen. Si no tienen foto se usa un icono por defecto.
          </Paso>

          <Sub>Rejilla de artículos (centro)</Sub>
          <Paso n={1}>
            Cada tarjeta muestra foto (o iniciales), precio y nombre. Pulsa una tarjeta para añadir el artículo al ticket.
          </Paso>
          <Paso n={2}>
            Si el artículo ya está en el ticket, la tarjeta muestra la cantidad acumulada.
          </Paso>
          <Paso n={3}>
            Los artículos pueden verse redondos o cuadrados según elija cada terminal en <b>TPV → Ajustes → Apariencia</b>.
          </Paso>

          <Sub>Panel derecho: ticket y teclado</Sub>
          <Paso n={1}>
            Arriba se ve el número de ticket provisional, las líneas añadidas, el bruto, la base, el IVA, los descuentos y el total.
          </Paso>
          <Paso n={2}>
            El teclado numérico (0-9, punto, borrar, intro) sirve para cantidades e importes. Selecciona primero una línea del ticket y escribe la cantidad.
          </Paso>
          <Paso n={3}>
            <K>Del</K> borra el último dígito. <K>Enter</K> confirma la cantidad en la línea activa.
          </Paso>
          <Paso n={4}>
            <K>Vaciar línea</K> quita la línea seleccionada. <K>Borrar ticket</K> deja el ticket a cero. <K>Aparcar</K> guarda el ticket en espera para recuperarlo después.
          </Paso>
          <Paso n={5}>
            Pulsa el botón grande <K>COBRAR</K> para pasar al cobro.
          </Paso>
        </Seccion>

        <Seccion titulo="Cobrar una venta">
          <Paso n={1}>
            En la ventana de cobro aparece el total, el método de pago (efectivo, tarjeta, etc.) y el importe entregado.
          </Paso>
          <Paso n={2}>
            Si es efectivo, escribe lo que te dan y el programa calcula el cambio.
          </Paso>
          <Paso n={3}>
            Pulsa <K>Confirmar</K>. Se crea la factura simplificada (F2 / ticket) con VeriFactu y se imprime si tienes activada la impresión automática.
          </Paso>
          <Nota titulo="Ticket regalo">
            Si marcas <K>Imprimir ticket regalo</K> al cobrar, después del ticket normal se imprime una copia sin precios para que el cliente pueda hacer cambios.
          </Nota>
        </Seccion>

        <Seccion titulo="Barra inferior de acciones">
          <Paso n={1}>
            <K>Movim. Caja</K>: apunta una entrada o salida de efectivo sin hacer una venta.
          </Paso>
          <Paso n={2}>
            <K>Informe Usuario</K>: resumen del día del usuario actual (ventas por método de pago, efectivo esperado, etc.).
          </Paso>
          <Paso n={3}>
            <K>Imprime Proforma</K>: imprime el ticket en curso como proforma, sin crear factura ni mover stock.
          </Paso>
          <Paso n={4}>
            <K>Ticket Regalo</K>: reimprime el último ticket en modo regalo (sin precios).
          </Paso>
          <Paso n={5}>
            <K>Copia Últ. Ticket</K>: reimprime el último ticket cobrado.
          </Paso>
          <Paso n={6}>
            <K>Email Últ. Ticket</K>: envía el último ticket por correo.
          </Paso>
          <Paso n={7}>
            <K>Abrir Cajón</K>: abre el cajón portamonedas solo si tienes una impresora ESC/POS conectada y configurada.
          </Paso>
        </Seccion>

        <Seccion titulo="Teclado rápido">
          <Paso n={1}>
            Escribe en el buscador y pulsa <K>Enter</K> para añadir el primer artículo encontrado.
          </Paso>
          <Paso n={2}>
            Con una línea seleccionada, los números cambian la cantidad directamente. Confirma con <K>Enter</K>.
          </Paso>
          <Paso n={3}>
            <K>Escape</K> cierra modales y el modal de cobro.
          </Paso>
          <Nota titulo="Monitor no táctil">
            Puedes usar el ratón: los botones tienen estado hover y se pulsan con clic. No hace falta una pantalla táctil.
          </Nota>
        </Seccion>

        <Seccion titulo="Caja (TPV → Caja)">
          <Paso n={1}>
            <K>Abrir caja</K>: indica el fondo inicial de efectivo y empieza turno.
          </Paso>
          <Paso n={2}>
            <K>Arqueo</K>: cuenta las monedas y billetes reales y compara con lo que debería haber.
          </Paso>
          <Paso n={3}>
            <K>Cerrar caja</K>: cierra el turno, imprime el cierre Z y guarda el arqueo. Después del cierre hay que volver a abrir caja para vender.
          </Paso>
          <Paso n={4}>
            Los movimientos de entrada/salida y los cierres se consultan en el historial de la misma pantalla.
          </Paso>
        </Seccion>

        <Seccion titulo="Tickets (TPV → Tickets)">
          <Paso n={1}>
            Lista de todos los tickets del día seleccionado. Desde aquí puedes <K>Reimprimir</K>, imprimir el <K>Regalo</K> o hacer una <K>Devolución</K>.
          </Paso>
          <Paso n={2}>
            La devolución crea una rectificativa (R5) y devuelve el stock al almacén.
          </Paso>
        </Seccion>

        <Seccion titulo="Ajustes del TPV (TPV → Ajustes)">
          <Paso n={1}>
            <b>Apariencia</b>: elige si los artículos se ven redondos o cuadrados en este terminal.
          </Paso>
          <Paso n={2}>
            <b>Impresión</b>: modo navegador o ESC/POS, ancho de papel (58 o 80 mm), copias e impresión automática al cobrar.
          </Paso>
          <Paso n={3}>
            <b>Modelo de ticket</b>: decide qué datos salen en el ticket (logo, NIF, dirección, teléfono, cabecera libre, pie libre, QR VeriFactu, desglose de IVA y método de pago). Se guarda por empresa, no por terminal.
          </Paso>
          <Paso n={4}>
            <b>Cajón</b>: abrir siempre, solo con efectivo o nunca.
          </Paso>
          <Paso n={5}>
            <b>Escáner</b>: activa el lector de códigos de barras para que el buscador responda directamente.
          </Paso>
        </Seccion>

        <Seccion titulo="Artículos y stock">
          <Paso n={1}>
            Los artículos se dan de alta en <b>Artículos</b>. Puedes asignarles familía, foto, precio, IVA y stock.
          </Paso>
          <Paso n={2}>
            El stock baja al cobrar un ticket o al crear un albarán de venta. Sube al hacer devoluciones o al validar compras/albaranes de compra.
          </Paso>
          <Paso n={3}>
            El botón <K>Inventario</K> de la pantalla Artículos permite ajustar el stock de cada artículo y ver el valor del almacén.
          </Paso>
          <Nota titulo="Servicios y líneas libres">
            Los servicios y las líneas de texto libre no mueven stock. Presupuestos y pedidos tampoco; el stock solo se mueve cuando se entrega mercancía (ticket, albarán o factura).
          </Nota>
        </Seccion>

        <Seccion titulo="VeriFactu y facturación">
          <Paso n={1}>
            Cada ticket cobrado es una factura simplificada (F2) con su propia serie. La serie se renueva cada año automáticamente.
          </Paso>
          <Paso n={2}>
            El envío a la AEAT se hace en segundo plano. Si falla, el sistema lo reintenta más tarde.
          </Paso>
          <Paso n={3}>
            El ticket lleva el QR VeriFactu si la empresa lo tiene activado en el modelo de ticket.
          </Paso>
        </Seccion>
      </div>
    </>
  );
}
