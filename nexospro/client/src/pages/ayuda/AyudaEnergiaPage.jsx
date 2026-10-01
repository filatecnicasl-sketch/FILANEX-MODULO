import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Seccion, Paso, Nota, K } from "./comun.jsx";

// Manual de usuario del módulo de Energía.
export default function AyudaEnergiaPage() {
  return (
    <>
      <CabeceraPagina
        titulo="Ayuda · Energía"
        descripcion="Gestión de canal directo de comercializadoras: suministros de luz y gas, comisiones y estudios."
      />
      <div className="space-y-4 max-w-4xl">
        <Seccion titulo="Cómo fluye el trabajo">
          <p>
            El recorrido normal de un cliente de energía es: <b>Estudio → Trámite → Contrato activo → Comisiones</b>.
            Todo gira alrededor del <b>punto de suministro</b> (su código CUPS), que es a este módulo lo
            que el vehículo es al taller.
          </p>
          <p>
            El estudio empieza pidiéndole al cliente <b>su última factura</b>: con sus datos ya se ve la
            comercializadora actual, la tarifa, la potencia y el consumo. Más adelante, la lectura de
            facturas con IA dará de alta el suministro sola.
          </p>
        </Seccion>

        <Seccion titulo="Comercializadoras (Energía → Comercializadoras)">
          <p>
            Son las compañías con las que trabaja la agencia. En su ficha se guardan las
            <b> condiciones de comisión</b>, distintas para luz y gas:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Pago único por alta</b>: importe fijo por cada alta o portabilidad conseguida.</li>
            <li><b>€/mes por contrato activo</b>: lo que paga la comercializadora cada mes.</li>
            <li><b>€/año recurrente</b>: importe que se repite cada año de vigencia.</li>
          </ul>
          <p>
            Lo que se deja en blanco o a cero no genera comisión. No se puede borrar una comercializadora
            que tenga suministros vinculados.
          </p>
        </Seccion>

        <Seccion titulo="Suministros (Energía → Suministros)">
          <Paso n={1}>
            Pulsa <K>Nuevo suministro</K> y escribe el <b>CUPS</b> (22 caracteres: ES + 20; el programa lo
            normaliza solo: mayúsculas y sin espacios). Elige si es de <b>luz o gas</b>.
          </Paso>
          <Paso n={2}>
            Elige el <b>cliente</b> de la cartera (o crea uno nuevo) y la <b>comercializadora actual</b>.
            Si el suministro no puede darse de alta todavía, déjala sin asignar.
          </Paso>
          <Paso n={3}>
            Apunta la <b>dirección del suministro</b> (que puede ser distinta a la fiscal del cliente),
            la <b>tarifa</b> (2.0TD, 3.0TD… o el peaje de gas), la <b>potencia</b> en kW y el
            <b> consumo anual</b> en kWh: son los datos con los que se hace el estudio de ahorro.
          </Paso>
        </Seccion>

        <Seccion titulo="Trámites (Energía → Trámites)">
          <p>
            Cuando el cliente acepta el estudio, se abre un <b>trámite</b>. Hay cuatro tipos:
            <b> alta</b> de un suministro nuevo, <b>cambio de comercializadora</b>, <b>cambio de titular</b>
            y <b>baja</b>. También puedes abrirlo directamente desde Suministros con el icono del
            bolígrafo-firma de cada fila.
          </p>
          <Paso n={1}>
            Al abrir el trámite se elige el <b>suministro (CUPS)</b> y, según el tipo, la
            <b> comercializadora de destino</b> o el <b>nuevo titular</b>. La comercializadora de
            origen queda apuntada automáticamente.
          </Paso>
          <Paso n={2}>
            El trámite lleva su circuito: <b>Documentación → Enviado → En trámite → Activado</b>
            (o rechazado/cancelado). Cada cambio de estado admite una nota («firmado por el
            cliente», «falta el justificante»…) y queda en el historial del trámite.
          </Paso>
          <Paso n={3}>
            Al pulsar <K>Activar</K>, el trámite <b>actualiza el suministro solo</b>: le cambia la
            comercializadora, le cambia el titular o lo marca de baja. Por eso un trámite activado
            ya no se puede editar ni borrar.
          </Paso>
        </Seccion>

        <Seccion titulo="Comisiones (Energía → Comisiones)">
          <p>
            Es la caja del canal: lo que te debe cada comercializadora por tu cartera. Elige el mes y
            pulsa <K>Generar mes</K>: el programa calcula solo, suministro a suministro, tres cosas:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li><b>Mensual</b>: cada contrato activo devenga su €/mes.</li>
            <li><b>Pago por alta</b>: el alta (o portabilidad) cuya fecha cae en ese mes devenga el pago único.</li>
            <li><b>Anual</b>: en el mes del aniversario del alta, el recurrente anual.</li>
          </ul>
          <p>
            Generar el mismo mes dos veces no duplica nada: cada comisión es única por suministro,
            concepto y mes. Cuando la comercializadora te paga, marcas la comisión como
            <b> cobrada</b> con la flecha verde; el panel muestra siempre lo pendiente de cobrar.
            Para un bono puntual o un pacto especial fuera de la ficha, usa <K>Nueva manual</K>.
          </p>
        </Seccion>

        <Seccion titulo="Estudios de ahorro (Energía → Estudios)">
          <p>
            La herramienta comercial: lo primero es pedirle la factura al cliente (impórtala en
            Suministros con la IA) y después abrir el estudio. Desde la ficha del suministro, el botón de
            la balanza abre el estudio ya cargado con su CUPS, tarifa, potencia y consumo.
          </p>
          <p>
            A la izquierda va su <b>situación actual</b> (comercializadora, precio de la energía y de la
            potencia, o el coste anual de su factura directamente) y a la derecha <b>tu propuesta</b> con
            una de tus comercializadoras. El programa calcula el coste anual de cada lado y el
            <b> ahorro en €/año y en %</b> mientras escribes.
          </p>
          <p>
            El circuito es: <b>borrador → enviado → aceptado / rechazado</b>. Al marcar
            <b> aceptado</b>, el programa abre solo el trámite de cambio de comercializadora sobre ese
            CUPS (lo verás en Trámites), y el estudio queda cerrado con el ahorro conseguido.
          </p>
        </Seccion>

        <Seccion titulo="Consumos (botón de la gráfica en Suministros)">
          <p>
            Cada CUPS lleva su <b>histórico mensual de consumo</b>: kWh e importe de la factura del
            cliente, mes a mes. Se apunta con el botón de la gráfica en Suministros (repetir un mes ya
            apuntado lo actualiza). El modal muestra la media mensual, el total del último año y una
            gráfica de barras para ver la evolución — justo los datos que alimentan un buen estudio de
            ahorro.
          </p>
        </Seccion>

        <Seccion titulo="Autofacturas (Energía → Autofacturas)">
          <p>
            Cada mes, cada comercializadora te manda su <b>autofactura</b>: la liquidación de las
            comisiones del canal. Regístrala con su número, el mes que liquida y la base imponible; el
            IVA y el total se calculan solos.
          </p>
          <p>
            Lo importante es la <b>conciliación</b>: al lado de la base verás lo que el programa calculó
            para esa comercializadora y ese mes (apartado Comisiones) y la <b>diferencia</b>. Si no
            cuadra, revisa si falta alguna comisión o si la comercializadora ha liquidado de menos.
            Cuando te la pagan, márcala como cobrada.
          </p>
        </Seccion>

        <Seccion titulo="Agenda (Energía → Agenda)">
          <p>
            La agenda automática del canal: lo que hay que hacer hoy, sin apuntar nada. Tres
            columnas de un vistazo:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              <b>Llamar para renovar</b>: los suministros con <b>7 a 10 meses desde la fecha de
              alta</b> — la ventana para hablar con el cliente y renovar su contrato antes de que
              cumpla el año y se pase a tarifa por defecto. Cada uno muestra los meses que lleva, los
              que faltan para el aniversario y el teléfono.
            </li>
            <li><b>Contratos por renovar</b>: los que tienen fecha de fin en los próximos 60 días (o vencida).</li>
            <li><b>Estudios sin respuesta</b>: los enviados hace más de una semana que siguen sin contestar.</li>
          </ul>
          <p>
            Se llena sola con la fecha de alta y la fecha de fin de cada suministro; solo tienes que
            llamar.
          </p>
        </Seccion>

        <Seccion titulo="Grupos de empresas">
          <p>
            Muchos clientes son <b>grupos de empresas</b>: varias sociedades del mismo dueño, cada una con
            sus suministros. En la ficha de cada cliente (Ventas → Clientes) hay un campo <b>Grupo</b>:
            escribe el mismo nombre en todas las sociedades del grupo (p. ej. «Grupo XYZ»).
          </p>
          <p>
            En Suministros, el filtro <K>Grupo</K> del listado muestra todos los suministros del grupo de
            una vez, y la búsqueda también encuentra por nombre de grupo.
          </p>
        </Seccion>

        <Seccion titulo="El panel (Energía → Panel)">
          <p>
            El panel muestra la foto de la cartera: suministros activos, trámites y estudios en curso
            (con el ahorro potencial que tienes sobre la mesa), comisiones pendientes de cobrar,
            energía gestionada en kWh y la <b>distribución por comercializadora</b>.
          </p>
          <p>
            Debajo salen las <b>alertas del canal</b>: los contratos que terminan en los próximos 60
            días (rellena el campo «Fin del contrato» en cada suministro para que avise) y los estudios
            enviados hace más de una semana que siguen sin respuesta, con el teléfono del cliente para
            llamarle al momento.
          </p>
        </Seccion>

        <Seccion titulo="Lo que viene">
          <p>
            Este módulo está en crecimiento: seguimos puliendo según lo que pidáis las agencias.
          </p>
          <Nota titulo="Sugerencia">
            Si echas en falta algo, proponlo desde <b>Ayuda → Novedades → Propuestas</b>: las propuestas
            de todos los usuarios llegan directamente al administrador.
          </Nota>
        </Seccion>
      </div>
    </>
  );
}
