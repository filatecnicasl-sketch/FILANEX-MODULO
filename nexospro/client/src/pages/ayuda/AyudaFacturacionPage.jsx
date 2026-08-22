import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Seccion, Sub, Paso, Nota, K } from "./comun.jsx";

// Manual de usuario del módulo de facturación (núcleo FILANEX).
export default function AyudaFacturacionPage() {
  return (
    <>
      <CabeceraPagina
        titulo="Ayuda · Facturación"
        descripcion="Cómo trabajar con FILANEX: ventas, compras, tesorería y VeriFactu."
      />
      <div className="space-y-4 max-w-4xl">
        <Seccion titulo="Primeros pasos">
          <Paso n={1}>
            Entra en <K>Sistema → Configuración</K> y revisa los datos de tu empresa: nombre, NIF,
            dirección y logo. Salen en la cabecera de todos los documentos impresos.
          </Paso>
          <Paso n={2}>
            En <K>Sistema → Series</K> define la serie de facturación (p.ej. <b>A</b>) y los contadores
            de presupuestos, albaranes y facturas. Cada documento nuevo toma el siguiente número solo.
          </Paso>
          <Paso n={3}>
            En <K>Sistema → Certificado</K> sube el certificado digital de la empresa: es imprescindible
            para enviar las facturas a Hacienda (VeriFactu).
          </Paso>
          <Paso n={4}>
            Da de alta tus <K>Clientes</K>, <K>Proveedores</K> y <K>Artículos</K>. Los artículos con
            referencia se ofrecen al escribir en las líneas de cualquier documento.
          </Paso>
        </Seccion>

        <Seccion titulo="Ventas: del presupuesto a la factura">
          <p>
            El ciclo completo es <b>Presupuesto → Albarán → Factura</b>. Puedes saltarte pasos: cada
            documento puede crearse desde cero o a partir del anterior con su botón de conversión.
          </p>
          <Sub>Presupuestos (Ventas → Presupuestos)</Sub>
          <p>
            Crea el presupuesto con el buscador de cliente y las líneas (escribe para buscar artículos;
            <K>Enter</K> pasa al siguiente campo). Cuando el cliente lo acepta, márcalo con el estado
            del desplegable: así luego el taller puede vincularlo a una orden.
          </p>
          <Sub>Albaranes (Ventas → Albaranes)</Sub>
          <p>Documento de entrega sin IVA desglosado en su versión clásica; sirve de justificante hasta facturar.</p>
          <Sub>Facturas (Ventas → Facturas)</Sub>
          <p>
            Al crear la factura se envía automáticamente a Hacienda por <b>VeriFactu</b> (verás el
            indicador «Compatible VeriFactu»). Desde la lista puedes imprimir, descargar el XML, ver el
            estado del envío y anularla si procede (la anulación genera registro de anulación, no borra).
          </p>
          <Nota titulo="Descuento por línea">
            Cada línea admite su propio <b>% de descuento</b>: el total del documento, la impresión y el
            PDF lo aplican automáticamente.
          </Nota>
          <Sub>Recurrencias</Sub>
          <p>
            Para cuotas periódicas (mantenimientos, alquileres…): crea la recurrencia con cliente,
            líneas y periodicidad, y las facturas se generan solas cada periodo.
          </p>
        </Seccion>

        <Seccion titulo="Compras y OCR de facturas de proveedor">
          <p>
            El ciclo es igual que en ventas pero con proveedores: <b>Pedido → Albarán → Factura</b>,
            cada uno convertible en el siguiente.
          </p>
          <Sub>Importar la factura del proveedor con OCR</Sub>
          <Paso n={1}>
            En <K>Compras → Facturas</K> pulsa <K>Importar PDF</K> (o hazle una foto a la factura en papel).
          </Paso>
          <Paso n={2}>
            El OCR lee proveedor, número, fecha, líneas con su <b>descuento</b> e IVA. Revisa el borrador:
            lo reconocido va resaltado y puedes corregir cualquier campo antes de guardar.
          </Paso>
          <Paso n={3}>
            Si algo quedó raro, en <K>Sistema → Revisión OCR</K> tienes las lecturas pendientes de verificar.
          </Paso>
        </Seccion>

        <Seccion titulo="Tesorería: cobros y pagos">
          <p>
            <K>Tesorería → Cobros</K> muestra las facturas de venta pendientes de cobrar; registra el cobro
            (total o parcial, con fecha y medio) y la factura queda cobrada. Lo mismo en
            <K> Tesorería → Pagos</K> con las facturas de compra. El <K>Panel</K> resume lo cobrado,
            lo pendiente y la previsión.
          </p>
        </Seccion>

        <Seccion titulo="Buscar en los listados">
          <p>
            Todas las listas (clientes, presupuestos, albaranes, facturas, pedidos…) tienen encima la caja
            <b> «Buscar en todos los campos…»</b>: filtra por cualquier dato visible (número, cliente,
            importe, fecha, estado…). Admite varias palabras y no distingue tildes ni mayúsculas.
          </p>
        </Seccion>

        <Seccion titulo="Impresión y formatos">
          <p>
            Cada documento se imprime con el icono de impresora de su fila: sale en PDF listo para
            enviar por correo o imprimir. Los diseños se personalizan en <K>Sistema → Formatos</K> con el
            editor visual (logotipo, colores, textos fijos, firma…).
          </p>
        </Seccion>

        <Seccion titulo="Sistema: configuración avanzada">
          <p>
            <K>Módulos</K> activa o desactiva Taller y Telefonía y elige en qué pantalla arranca el
            programa. <K>Usuarios</K> gestiona quién entra. <K>Notificaciones</K> centraliza avisos
            (documentos por vencer, errores de envío VeriFactu…). <K>Agenda</K> es el calendario general
            de la empresa, distinto de las citas del taller.
          </p>
        </Seccion>
      </div>
    </>
  );
}
