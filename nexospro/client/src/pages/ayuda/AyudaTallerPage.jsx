import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Seccion, Sub, Paso, Nota, K } from "./comun.jsx";

// Manual de usuario del módulo de taller.
export default function AyudaTallerPage() {
  return (
    <>
      <CabeceraPagina
        titulo="Ayuda · Taller"
        descripcion="Citas, recepción de vehículos, órdenes de trabajo, valoraciones y cortesía."
      />
      <div className="space-y-4 max-w-4xl">
        <Seccion titulo="Cómo fluye el trabajo">
          <p>
            El recorrido normal de un coche es: <b>Cita → Recepción → Orden de trabajo → Factura</b>.
            Casi todo se puede automatizar: la cita rellena la recepción, la recepción abre la orden y
            la orden genera la factura con un clic.
          </p>
        </Seccion>

        <Seccion titulo="Citas (Taller → Citas)">
          <Paso n={1}>
            Pulsa <K>Nueva cita</K> o haz clic en el hueco del calendario. La hora de entrada se ofrece
            de <b>07:00 a 10:00</b> (lo habitual al dejar el coche); elige <i>«Otra hora…»</i> para
            cualquier otra.
          </Paso>
          <Paso n={2}>
            Escribe la matrícula: si el vehículo ya existe se rellenan solos el cliente y el teléfono.
            Si es nuevo, escribe el nombre a mano.
          </Paso>
          <Paso n={3}>
            Si la cita viene de un presupuesto, deja marcada la casilla <b>«Viene de presupuesto»</b>
            (aparecerá la píldora violeta <b>Pto</b> en la agenda). Desde la propia cita puedes abrir
            el <b>coche de cortesía</b> para reservárselo.
          </Paso>
          <p>
            La caja de búsqueda de arriba encuentra citas por <b>cualquier dato</b>: matrícula, cliente,
            teléfono o motivo, estén en la fecha que estén.
          </p>
        </Seccion>

        <Seccion titulo="Recepción rápida (Panel u Órdenes → Recepción rápida)">
          <Paso n={1}>
            Si el cliente <b>viene con cita</b>, el bloque azul de arriba la muestra: un clic y todo el
            formulario se rellena (matrícula, cliente, teléfono, motivo). También puedes buscar otra cita.
          </Paso>
          <Paso n={2}>
            Sin cita, escribe la matrícula y elige el vehículo existente o crea uno nuevo; marca el tipo
            de trabajo (Chapa, Pintura, Mecánica) y el motivo.
          </Paso>
          <Paso n={3}>
            Si el cliente tiene <b>presupuestos abiertos</b>, aparece el bloque violeta: elige el que
            corresponda y se <b>incluye en la orden</b> con todas sus líneas (y queda aceptado). Solo se
            ofrecen presupuestos a nombre de ese cliente.
          </Paso>
          <Paso n={4}>
            Al pulsar <K>Crear recepción</K> se abre la <b>recepción digital</b>: haz las
            <b> fotos del estado</b> del vehículo (desde el móvil se abre la cámara), recoge la
            <b> firma del cliente</b> en pantalla y pulsa <K>Imprimir hoja y finalizar</K>.
          </Paso>
          <Nota titulo="La hoja de entrada sale por duplicado">
            Se imprimen dos copias automáticamente: <b>«Ejemplar para el prestador del servicio»</b> (te
            la quedas tú, firmada) y <b>«Ejemplar para el cliente»</b>. Las fotos quedan guardadas en el
            <b> historial del vehículo</b>.
          </Nota>
        </Seccion>

        <Seccion titulo="Órdenes de trabajo">
          <p>
            El tablero muestra las órdenes por estado (Recepción, Diagnóstico, En reparación, Listo,
            Entregado). Cambia el estado arrastrando la tarjeta o desde la ficha.
          </p>
          <Sub>Ficha de la orden (botón Editar)</Sub>
          <p>
            Vehículo y cliente, líneas de <b>mano de obra y materiales</b> (con descuento por línea),
            imputación por tipo de trabajo, aseguradora y nº de siniestro si es un siniestro, y el
            <b> presupuesto</b> del que nace (puedes vincularlo o cargar sus líneas a posteriori; solo se
            ofrecen los de ese cliente).
          </p>
          <Sub>Recepción digital (icono de cámara)</Sub>
          <p>
            Reabre fotos y firma en cualquier momento, no solo al crear la orden.
          </p>
          <Sub>Facturar</Sub>
          <p>
            Con la orden «Listo», el botón <K>Facturar</K> crea la factura de venta con las líneas de la
            orden y la envía a VeriFactu. Si la orden venía de un presupuesto, este queda
            <b> facturado</b> automáticamente.
          </p>
          <Sub>Imprimir</Sub>
          <p>
            El menú de impresora de cada orden ofrece: <b>hoja de entrada</b> (las dos copias),
            <b> orden de trabajo</b> para el operario y <b>hoja de entrega</b>.
          </p>
        </Seccion>

        <Seccion titulo="Vehículos e historial">
          <p>
            En <K>Taller → Vehículos</K> está el parque: matrícula, modelo, cliente y KM. El botón
            <K> Historial</K> de cada uno muestra todas sus recepciones con la fecha, el motivo, los KM y
            <b> las fotos del estado</b> que se hicieron en cada entrada (clic para ampliarlas).
          </p>
        </Seccion>

        <Seccion titulo="Valoraciones (peritajes)">
          <Paso n={1}>
            <K>Nueva valoración</K> y rellena matrícula, compañía y nº de siniestro, o pulsa
            <K> Importar PDF</K> y sube la valoración del perito (Audatex, GT Estimate…): el OCR lee la
            compañía, el siniestro y las partidas de daños.
          </Paso>
          <Paso n={2}>
            Cuando la compañía la apruebe, cambia el estado a <b>Aceptada</b> y pulsa <K>Crear OT</K>:
            genera la orden de trabajo con las partidas ya cargadas.
          </Paso>
        </Seccion>

        <Seccion titulo="Aseguradoras">
          <p>
            Ficha de cada compañía con sus <b>condiciones negociadas</b>: precio de la hora de mano de
            obra y descuentos (mano de obra, materiales o total). El descuento total, si lo tiene,
            sustituye a los demás.
          </p>
        </Seccion>

        <Seccion titulo="Coches de cortesía">
          <Paso n={1}>
            Los vehículos de sustitución se dan de alta en <K>Vehículos</K> marcando el tipo
            <b> «Cortesía»</b>.
          </Paso>
          <Paso n={2}>
            El préstamo se crea desde <K>Cortesía → Nuevo préstamo</K>, desde la <b>cita</b> (botón
            «Coche de cortesía») o al recepcionar. El buscador solo ofrece los coches de cortesía libres.
          </Paso>
          <Paso n={3}>
            Imprime el <b>contrato de préstamo</b> con el icono de impresora. Al volver el coche, pulsa
            <K> Devolver</K> y anota los KM de entrada: los vencidos se marcan en rojo solos.
          </Paso>
        </Seccion>

        <Seccion titulo="Planning y operarios">
          <p>
            El <K>Planning</K> reparte las órdenes por días y operarios. En <K>Operarios</K> das de alta
            al equipo; los tiempos que registran en las órdenes (imputaciones) se consultan en la ficha
            de cada orden, apartado «Tiempos de taller».
          </p>
        </Seccion>
      </div>
    </>
  );
}
