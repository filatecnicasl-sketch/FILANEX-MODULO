import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Seccion, Sub, Paso, Nota, K } from "./comun.jsx";

export default function AyudaGeneralPage() {
  return (
    <CabeceraPagina
      titulo="Ayuda general"
      descripcion="Conceptos básicos de FILANEX: navegación, búsquedas, documentos, seguridad y VeriFactu."
    >
      <div className="max-w-3xl space-y-6">
        <Seccion titulo="Cómo se organiza el programa">
          <Paso n={1}>
            El menú lateral agrupa el programa en módulos: <b>Ventas, Compras, Tesorería, Taller, Servicio Técnico, Telefonía, Asesoría, TPV, Informes y Sistema</b>.
          </Paso>
          <Paso n={2}>
            Cada módulo tiene su propio manual en <b>Ayuda</b>. Si necesitas saber cómo funciona una pantalla específica, entra en su ayuda correspondiente.
          </Paso>
          <Paso n={3}>
            La barra superior muestra el módulo activo, avisos, el nombre del usuario y un acceso a tu perfil. Desde ahí también puedes cerrar sesión.
          </Paso>
          <Nota titulo="Pantalla de inicio">
            En <K>Sistema → Preferencias</K> eliges en qué pantalla arranca el programa al hacer login.
          </Nota>
        </Seccion>

        <Seccion titulo="Primeros pasos obligatorios">
          <Paso n={1}>
            Revisa los datos de la empresa en <K>Sistema → Configuración</K>: nombre, NIF, dirección, teléfono y logo. Estos datos salen en documentos impresos, emails y tickets.
          </Paso>
          <Paso n={2}>
            Configura las <K>Series</K> de facturación y los contadores de presupuestos, albaranes y facturas.
          </Paso>
          <Paso n={3}>
            Sube el certificado digital en <K>Sistema → Certificado</K> para enviar facturas a Hacienda (VeriFactu).
          </Paso>
          <Paso n={4}>
            Da de alta usuarios en <K>Sistema → Usuarios</K> y activa los módulos que uses en <K>Sistema → Módulos</K>.
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

        <Seccion titulo="Documentos: relación entre ellos">
          <Paso n={1}>
            En FILANEX los documentos se pueden crear solos o convertirse unos en otros:
            <b>Presupuesto → Albarán → Factura</b> en ventas y <b>Pedido → Albarán → Factura</b> en compras.
          </Paso>
          <Paso n={2}>
            Cuando conviertes un documento, las líneas se copian al siguiente y se mantiene el enlace. Así, si facturas desde un albarán, el stock no se descuenta dos veces.
          </Paso>
          <Paso n={3}>
            Para anular una factura no se borra: se crea una rectificativa o un registro de anulación, según el tipo de factura.
          </Paso>
        </Seccion>

        <Seccion titulo="Líneas de documentos">
          <Paso n={1}>
            En cualquier documento (presupuesto, albarán, factura, orden...) puedes añadir líneas escribiendo artículos o texto libre.
          </Paso>
          <Paso n={2}>
            Si seleccionas un artículo del catálogo, se rellenan descripción, precio, IVA y se vincula el stock. Si escribes texto libre, no se vincula a ningún artículo.
          </Paso>
          <Paso n={3}>
            Cada línea admite cantidad, precio unitario, descuento e IVA. El programa calcula base, cuota y total automáticamente.
          </Paso>
        </Seccion>

        <Seccion titulo="Impresión y formatos">
          <Paso n={1}>
            Los documentos se imprimen desde el icono de impresora de cada fila o desde su ficha.
          </Paso>
          <Paso n={2}>
            En <K>Sistema → Formatos</K> puedes personalizar el diseño de documentos con el editor visual: logotipo, colores, textos fijos, campos y firma.
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
            En <K>Sistema → Notificaciones</K> verás si hay errores de envío o documentos por revisar.
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
            No compartas tu contraseña. Los administradores pueden crear usuarios adicionales desde <K>Sistema → Usuarios</K>.
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

        <Seccion titulo="¿Necesitas ayuda de un módulo concreto?">
          <p>
            En el menú lateral, dentro de cada módulo, encontrarás su entrada de ayuda específica:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><K>Ventas → Ayuda facturación</K>: clientes, presupuestos, albaranes, facturas, compras, tesorería, OCR y formatos.</li>
            <li><K>Taller → Ayuda taller</K>: agenda, citas, vehículos, órdenes, valoraciones, aseguradoras, cortesía y operarios.</li>
            <li><K>Servicio Técnico → Ayuda servicio</K>: aparatos, órdenes y citas de servicio.</li>
            <li><K>Telefonía → Ayuda telefonía</K>: llamadas y registros telefónicos.</li>
            <li><K>Asesoría → Ayuda asesoría</K>: cartera, documentos, libros IVA, fiscalidad, previsión, solicitudes y cierres.</li>
            <li><K>TPV → Ayuda TPV</K>: terminal, tickets, caja, ajustes y stock.</li>
          </ul>
        </Seccion>
      </div>
    </CabeceraPagina>
  );
}
