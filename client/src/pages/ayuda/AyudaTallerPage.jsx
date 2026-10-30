import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Seccion, Sub, Paso, Nota, K } from "./comun.jsx";

// Manual de usuario del sistema de taller.
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
            Si es nuevo, escribe el nombre a mano; puedes anotar también su <b>dirección</b> y{" "}
            <b>provincia</b> y quedan guardadas en la ficha del cliente que se crea al guardar la cita.
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
          <p>
            <K>Hoy</K> abre directamente las citas de hoy; las flechas permiten avanzar o retroceder día a día.
            En <K>Próximos</K> aparecen primero los días cercanos con citas, ordenados por fecha y hora.
            En <K>Semana</K> o <K>Mes</K>, pulsa un día para abrir sus citas.
          </p>
          <p>
            Los <b>días festivos</b> se marcan en <b>rojo</b> para distinguirlos del resto: los
            nacionales (Reyes, Semana Santa, 1 de mayo…) salen solos y los de tu zona (día de tu
            comunidad, ferias locales…) se añaden en <K>Ajustes → Configuración → Días festivos</K>.
          </p>
          <p>
            Las citas con <b>coche de cortesía</b> se señalan en el calendario con el fondo{" "}
            <b>azul intenso</b> (en todas las vistas, incluida la de Mes), para localizarlas de un
            vistazo.
          </p>
          <Nota titulo="La cita se guarda sola, aunque imprimas el justificante">
            Al pulsar <K>Imprimir hoja y finalizar</K> (o el justificante de cita) el programa guarda
            primero los datos y después imprime: aunque la ventana se cierre o algo falle justo al
            imprimir, la cita ya ha quedado guardada con lo escrito hasta ese momento.
          </Nota>
        </Seccion>

        <Seccion titulo="Citas de peritaje (Taller → Citas, pestaña «Citas peritaje»)">
          <p>
            Son las citas en las que el cliente solo deja el coche para que venga el <b>perito</b> de la
            compañía: llevan compañía de seguros y nº de siniestro obligatorios, y tienen su propia
            pestaña (no se mezclan con las citas normales de taller/recepción).
          </p>
          <p>
            Dentro de esa pestaña hay dos vistas: <b>Agenda</b> (calendario) y <b>Lista</b>, que muestra
            todos los vehículos citados de un vistazo con su <b>marca y modelo</b>, matrícula, cliente,
            teléfono, compañía, nº de siniestro y si ya tiene la peritación adjunta.
          </p>
          <p>
            En la vista <b>Agenda</b> (Próximos, Día, Semana y Mes) cada cita muestra también el
            <b> modelo del vehículo</b> y el <b>teléfono del cliente</b> debajo del nombre, para llamar
            sin abrir la cita. En Semana y Mes, deja el ratón sobre una cita para verlos en el globo.
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
          <p>
            El historial está organizado en pestañas: órdenes, presupuestos, albaranes, facturas,
            citas, valoraciones, cortesías y <b>notas internas</b>. Al pulsar cualquier documento se
            abre <b>completo</b>: todos sus datos, el detalle de líneas (cantidades, precios,
            descuentos e importes), los totales, las horas invertidas, los cobros de las facturas y
            las fotos y firmas de recepción y entrega. Las <b>notas</b> que se escriban en cualquier
            sitio (por ejemplo, las notas de una cita) aparecen en la ficha de cada documento, en el
            recuadro azul <b>«Nota»</b>, para que nada se pierda.
          </p>
          <p>
            Las <b>notas internas</b> son anotaciones del vehículo o su dueño que <b>no salen en
            ningún impreso</b>: impagos, incidencias, piezas pendientes… Cualquier nota se puede
            marcar como <b>aviso</b>: entonces salta una ventana al abrir el historial y se ve en
            rojo también al crear una cita con esa matrícula, para que nadie se olvide.
          </p>
        </Seccion>

        <Seccion titulo="Valoraciones (peritajes)">
          <Paso n={1}>
            <K>Nueva valoración</K> y rellena matrícula, compañía y nº de siniestro, o pulsa
            <K> Importar PDF</K> y sube la valoración del perito (Audatex, GT Estimate…): el OCR lee la
            compañía, el siniestro y las partidas de daños.
          </Paso>
          <Paso n={2}>
            Cada valoración tiene dos estados: <b>CON COMPROMISO</b> (el taller se queda la reparación)
            o <b>SIN COMPROMISO</b>. Se elige al crearla, se cambia en cualquier momento desde la propia
            lista y el OCR la detecta al importar el PDF de la compañía. Cuando te confirmen el trabajo,
            pulsa <K>Crear OT</K>: genera la orden de trabajo con las partidas ya cargadas.
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
            La flota de cortesía se gestiona en <K>Cortesía → pestaña «Flota»</K>: ahí añades
            («Añadir a la flota») o quitas los coches de sustitución. También siguen disponibles en
            <K>Vehículos</K> con el tipo <b>«Cortesía»</b>. Un coche con préstamos o con órdenes
            registradas no se puede borrar, para no perder el historial.
          </Paso>
          <Paso n={2}>
            De cada coche de la flota se pueden registrar sus <b>datos de gestión</b>: fecha de
            <b> llegada</b> a la flota, fecha de <b>entrega</b> (fin de renting o préstamo; se marca en
            rojo si ya pasó), <b>empresa de renting</b> (vacío = propiedad), <b>kilómetros</b>, año y
            combustible. Se rellenan al añadir el coche o después con el lápiz de «Editar».
          </Paso>
          <Paso n={3}>
            El préstamo se crea desde <K>Cortesía → Nuevo préstamo</K>, desde la <b>cita</b> (botón
            «Coche de cortesía») o al recepcionar. El buscador solo ofrece los coches de cortesía libres;
            en la pestaña «Flota» se ve quién tiene cada coche prestado.
          </Paso>
          <Paso n={4}>
            Antes de imprimir el contrato, indica el <b>nivel de combustible de salida</b> en octavos (0 a 8).
            El contrato lo representa con un indicador visual de barras. Al volver el coche, pulsa
            <K> Devolver</K> y anota los KM de entrada: los vencidos se marcan en rojo solos.
          </Paso>
          <Paso n={5}>
            En la ficha del <b>vehículo del cliente</b>, la pestaña «Cortesías» del historial muestra
            qué coche de cortesía le prestaron y entre qué fechas (no solo en la ficha del coche de
            cortesía).
          </Paso>
        </Seccion>

        <Seccion titulo="Planning y operarios">
          <p>
            El <K>Planning</K> reparte las órdenes por días y operarios. En <K>Operarios</K> das de alta
            al equipo; los tiempos que registran en las órdenes (imputaciones) se consultan en la ficha
            de cada orden, apartado «Tiempos de taller».
          </p>
          <p>
            La ficha de cada operario guarda además su <b>teléfono</b> y <b>email</b>, la{" "}
            <b>situación laboral</b> (alta, periodo de prueba o baja) con sus <b>fechas de alta y baja</b>,
            <b> notas importantes</b> y el <b>curriculum</b> en PDF o foto: se sube desde el botón
            «Subir curriculum» de la ficha (sustituye al anterior si ya había uno) y se consulta con el
            enlace «CV» del listado. La derecha de la página muestra el informe del mes: horas
            invertidas por operario frente a las horas de mano de obra facturadas.
          </p>
        </Seccion>
      </div>
    </>
  );
}
