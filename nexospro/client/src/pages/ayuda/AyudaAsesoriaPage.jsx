import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Seccion, Sub, Paso, Nota, K } from "./comun.jsx";

export default function AyudaAsesoriaPage() {
  return (
    <>
      <CabeceraPagina
        titulo="Ayuda · Asesoría"
        descripcion="Manual del módulo de asesoría: cartera de clientes, documentos contables, libros de IVA, fiscalidad y cierres."
      />
      <div className="space-y-4 max-w-4xl">
        <Seccion titulo="Panel de asesoría">
          <Paso n={1}>
            El panel es la pantalla de inicio del módulo. Resume documentos pendientes, clientes con vencimientos próximos, solicitudes sin responder y el estado general de la cartera.
          </Paso>
          <Paso n={2}>
            Las tarjetas son enlaces directos a cada apartado. Usa el panel para detectar rápidamente qué clientes necesitan atención.
          </Paso>
        </Seccion>

        <Seccion titulo="Cartera de clientes">
          <Paso n={1}>
            En <K>Asesoría → Cartera</K> das de alta a tus clientes de asesoría. Son independientes de los clientes de facturación de cada empresa.
          </Paso>
          <Paso n={2}>
            Rellena los datos fiscales: NIF, forma jurídica, régimen de IRPF, actividad, epígrafe IAE y dirección.
          </Paso>
          <Paso n={3}>
            Marca las <b>áreas de trabajo</b> de cada cliente (fiscal, contable, laboral) y los <b> modelos tributarios </b> que presentas (303, 390, 130, 111, etc.).
          </Paso>
          <Paso n={4}>
            Puedes añadir una cuota mensual estimada y notas internas. La búsqueda filtra por nombre, NIF, actividad o persona de contacto.
          </Paso>
        </Seccion>

        <Seccion titulo="Documentos contables">
          <Paso n={1}>
            En <K>Asesoría → Documentos</K> registras facturas emitidas, facturas recibidas, tickets/gastos, nóminas y otros documentos de cada cliente.
          </Paso>
          <Paso n={2}>
            Cada documento tiene fecha, número, tercero, NIF, base imponible, tipo de IVA, cuota, total y retención si la tiene.
          </Paso>
          <Paso n={3}>
            Los documentos pasan por estados: <b>Pendiente → Revisado → Contabilizado</b>. También puedes marcarlos como <b>Devuelto al cliente</b> si falta algo.
          </Paso>
          <Nota titulo="Origen de los documentos">
            Los documentos se pueden crear a mano o venir del OCR de compras de cada empresa. Desde la ficha del documento también puedes adjuntar el PDF justificante.
          </Nota>
        </Seccion>

        <Seccion titulo="Libros de IVA">
          <Paso n={1}>
            <K>Asesoría → Libros IVA</K> muestra, cliente por cliente y año por año, el registro de facturas emitidas y recibidas por trimestre.
          </Paso>
          <Paso n={2}>
            Solo se incluyen los documentos marcados como <b>Revisados</b> o <b>Contabilizados</b>, así que revisa los documentos antes de cerrar un trimestre.
          </Paso>
          <Paso n={3}>
            Pulsa <K>Descargar CSV</K> para obtener un archivo que puedes abrir en Excel o importar en tu programa de contabilidad.
          </Paso>
        </Seccion>

        <Seccion titulo="Calendario fiscal">
          <Paso n={1}>
            <K>Asesoría → Fiscalidad</K> muestra todos los vencimientos fiscales del año de todos tus clientes de la cartera.
          </Paso>
          <Paso n={2}>
            Los vencimientos se generan automáticamente a partir de los modelos que hayas marcado en la ficha de cada cliente.
          </Paso>
          <Paso n={3}>
            Sirve para planificar la semana: verás qué modelos toca presentar y de qué clientes te falta documentación.
          </Paso>
        </Seccion>

        <Seccion titulo="Previsión fiscal">
          <Paso n={1}>
            <K>Asesoría → Previsión</K> calcula una estimación del modelo 303 (IVA) y del modelo 130 (pago fraccionado) por cliente y año.
          </Paso>
          <Paso n={2}>
            El cálculo usa los documentos contabilizados/revisados del cliente. Es una previsión orientativa, no el borrador oficial.
          </Paso>
          <Paso n={3}>
            Puedes filtrar por cliente o ver toda la cartera a la vez.
          </Paso>
        </Seccion>

        <Seccion titulo="Solicitudes de documentos">
          <Paso n={1}>
            En <K>Asesoría → Solicitudes</K> creas avisos del tipo "falta factura del trimestre 2" o "enviar nóminas del mes".
          </Paso>
          <Paso n={2}>
            Cada solicitud tiene cliente, descripción, periodo y estado (pendiente/cerrada).
          </Paso>
          <Paso n={3}>
            Sirve para controlar qué documentos has pedido y cuáles siguen sin llegar. También puedes avisar al cliente por WhatsApp desde la pantalla.
          </Paso>
        </Seccion>

        <Seccion titulo="Cierres de trimestre">
          <Paso n={1}>
            <K>Asesoría → Cierres</K> te dice, cliente por cliente, si tienes todo listo para cerrar cada trimestre.
          </Paso>
          <Paso n={2}>
            El sistema marca qué clientes tienen documentos pendientes, revisados o ya contabilizados en cada trimestre.
          </Paso>
          <Paso n={3}>
            Úsalo como check-list antes de presentar los modelos del período.
          </Paso>
        </Seccion>

        <Seccion titulo="Flujo de trabajo recomendado">
          <Paso n={1}>
            Alta del cliente en Cartera con sus datos fiscales y modelos.
          </Paso>
          <Paso n={2}>
            Registro o importación de documentos (facturas, tickets, nóminas) a lo largo del mes.
          </Paso>
          <Paso n={3}>
            Revisión y contabilización de documentos.
          </Paso>
          <Paso n={4}>
            Consulta Libros IVA y Previsión fiscal para comprobar cifras antes del cierre.
          </Paso>
          <Paso n={5}>
            Uso del Calendario fiscal y Cierres de trimestre para planificar y presentar modelos.
          </Paso>
        </Seccion>
      </div>
    </>
  );
}
