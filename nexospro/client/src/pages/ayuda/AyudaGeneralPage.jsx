import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Seccion, Sub, Paso, Nota, K } from "./comun.jsx";

export default function AyudaGeneralPage() {
  return (
    <>
      <CabeceraPagina
        titulo="Ayuda general"
        descripcion="Conceptos básicos de FILANEX: navegación, facturación, ajustes, artículos, agenda, informes y VeriFactu."
      />
      <div className="space-y-4 max-w-4xl">
        <Seccion titulo="Cómo se organiza el programa">
          <Paso n={1}>
            El menú lateral agrupa el programa en bloques: <b>Tesorería, Artículos, Agenda, Compras, Ventas, Informes, Sistema y Ajustes</b>. Si tienes activos módulos adicionales (Taller, Servicio Técnico, Telefonía, Asesoría, TPV) aparecen también en el menú.
          </Paso>
          <Paso n={2}>
            La barra superior muestra el bloque activo, avisos, el nombre del usuario y un acceso a tu perfil.
          </Paso>
          <Nota titulo="Pantalla de inicio">
            En <K>Ajustes → Preferencias</K> eliges en qué pantalla arranca el programa al hacer login.
          </Nota>
        </Seccion>

        <Seccion titulo="Primeros pasos">
          <Paso n={1}>
            Revisa los datos de la empresa en <K>Ajustes → Configuración</K>: nombre, NIF, dirección, teléfono y logo. Estos datos salen en documentos impresos, emails y tickets.
          </Paso>
          <Paso n={2}>
            Configura las <K>Series</K> de facturación y los contadores de presupuestos, albaranes y facturas en <K>Ajustes → Series</K>.
          </Paso>
          <Paso n={3}>
            Sube el certificado digital en <K>Ajustes → Certificado</K> para enviar facturas a Hacienda (VeriFactu).
          </Paso>
          <Paso n={4}>
            Da de alta usuarios en <K>Ajustes → Usuarios</K> y activa los módulos que uses en <K>Ajustes → Módulos</K>.
          </Paso>
        </Seccion>

        <Seccion titulo="Facturación (Ventas)">
          <Paso n={1}>
            En <K>Ventas → Clientes</K> das de alta clientes con sus datos fiscales. En <K>Ventas → Presupuestos</K> creas ofertas; si se aceptan, se convierten en albarán o factura sin volver a teclear.
          </Paso>
          <Paso n={2}>
            <K>Ventas → Albaranes</K> registra entregas pendientes de facturar. <K>Ventas → Facturas</K> emite documentos VeriFactu con serie, número y QR.
          </Paso>
          <Paso n={3}>
            Las devoluciones o anulaciones se hacen con rectificativas o registros de anulación, nunca borrando la factura original.
          </Paso>
          <Paso n={4}>
            <K>Ventas → Recurrencias</K> automatiza facturas periódicas (cuotas, mantenimientos, alquileres).
          </Paso>
        </Seccion>

        <Seccion titulo="Artículos">
          <Paso n={1}>
            En <K>Artículos</K> das de alta lo que vendes o compras: descripción, código, precio, IVA, familia y stock.
          </Paso>
          <Paso n={2}>
            Puedes asignar foto y usar familias para agrupar artículos en el TPV.
          </Paso>
          <Paso n={3}>
            El botón <K>Inventario</K> permite ajustar el stock de cada artículo y ver el valor total del almacén.
          </Paso>
          <Nota titulo="Stock">
            El stock baja al cobrar un ticket del TPV o al crear un albarán/factura de venta. Sube al validar compras o hacer devoluciones. Presupuestos y pedidos no mueven stock.
          </Nota>
        </Seccion>

        <Seccion titulo="Agenda">
          <Paso n={1}>
            La <K>Agenda</K> es el calendario general de la empresa: eventos, tareas y avisos.
          </Paso>
          <Paso n={2}>
            Puedes crear eventos manuales o vinculados a documentos (presupuestos a revisar, vencimientos, mantenimientos).
          </Paso>
          <Paso n={3}>
            Desde la agenda puedes ver el día, la semana o el mes y filtrar por usuario.
          </Paso>
        </Seccion>

        <Seccion titulo="Informes">
          <Paso n={1}>
            <K>Informes → Vencimientos</K> lista facturas y documentos próximos a vencer o ya vencidos.
          </Paso>
          <Paso n={2}>
            <K>Informes → Ingresos/Gastos</K> muestra el resumen de la actividad por periodos, métodos de pago y series.
          </Paso>
          <Paso n={3}>
            <K>Informes → Informes</K> permite exportar listados y cuadros de mando para revisar la marcha del negocio.
          </Paso>
        </Seccion>

        <Seccion titulo="Ajustes">
          <Paso n={1}>
            <K>Ajustes → Configuración</K>: datos de la empresa, logo, dirección y parámetros generales.
          </Paso>
          <Paso n={2}>
            <K>Ajustes → Series</K>: numeración de documentos (presupuesto, albarán, factura, rectificativa...).
          </Paso>
          <Paso n={3}>
            <K>Ajustes → Formatos</K>: editor visual para personalizar el diseño de documentos impresos y PDFs.
          </Paso>
          <Paso n={4}>
            <K>Ajustes → Certificado</K>: certificado digital para VeriFactu y firma de documentos.
          </Paso>
          <Paso n={5}>
            <K>Ajustes → Usuarios</K> y <K>Ajustes → Módulos</K>: creación de usuarios y activación de módulos (Solo si tienes permisos de administrador).
          </Paso>
        </Seccion>

        <Seccion titulo="Búsquedas y listados">
          <Paso n={1}>
            Casi todas las pantallas tienen una caja de búsqueda que filtra en tiempo real por cualquier dato visible: nombre, NIF, número de documento, importe, matrícula, teléfono...
          </Paso>
          <Paso n={2}>
            Puedes escribir varias palabras y no importan las mayúsculas ni las tildes.
          </Paso>
          <Paso n={3}>
            Muchos listados permiten ordenar pulsando en las cabeceras de columna.
          </Paso>
        </Seccion>

        <Seccion titulo="Impresión y formatos">
          <Paso n={1}>
            Los documentos se imprimen desde el icono de impresora de cada fila o desde su ficha.
          </Paso>
          <Paso n={2}>
            En <K>Ajustes → Formatos</K> puedes personalizar el diseño de documentos con el editor visual: logotipo, colores, textos fijos, campos y firma.
          </Paso>
          <Paso n={3}>
            También puedes descargar la factura en XML (VeriFactu) o PDF para enviarla por email o WhatsApp.
          </Paso>
        </Seccion>

        <Seccion titulo="VeriFactu y Hacienda">
          <Paso n={1}>
            FILANEX está preparado para VeriFactu: cada factura genera un registro que se envía a la AEAT.
          </Paso>
          <Paso n={2}>
            El envío se hace en segundo plano para no bloquear la pantalla. Si falla, el sistema lo reintenta automáticamente.
          </Paso>
          <Paso n={3}>
            En <K>Ajustes → Notificaciones</K> verás si hay errores de envío o documentos por revisar.
          </Paso>
        </Seccion>

        <Seccion titulo="Seguridad y sesiones">
          <Paso n={1}>
            Cada pestaña del navegador tiene su propia sesión. Puedes tener una pestaña con un usuario administrador y otra con un usuario normal sin que se mezclen.
          </Paso>
          <Paso n={2}>
            Si marcas <b>"Mantener sesión iniciada"</b> al entrar, la sesión se recuerda en ese dispositivo.
          </Paso>
          <Paso n={3}>
            Si se inicia sesión con tu usuario en otro dispositivo, esta sesión se cierra automáticamente.
          </Paso>
          <Paso n={4}>
            No compartas tu contraseña. Los administradores pueden crear usuarios adicionales desde <K>Ajustes → Usuarios</K>.
          </Paso>
        </Seccion>

        <Seccion titulo="Trabajo offline (PWA)">
          <Paso n={1}>
            FILANEX es una aplicación web progresiva: se puede instalar en el móvil o tablet y funciona aunque haya cortes de red.
          </Paso>
          <Paso n={2}>
            Las operaciones que hagas sin conexión se encolan y se envían automáticamente cuando vuelva la red.
          </Paso>
        </Seccion>
      </div>
    </>
  );
}
