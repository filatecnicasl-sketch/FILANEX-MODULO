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
            El panel muestra la foto de la cartera: suministros activos, cuántos de luz y cuántos de gas,
            inactivos o de baja, y la <b>distribución por comercializadora</b> para ver de un vistazo
            con quién está trabajando cada cliente.
          </p>
        </Seccion>

        <Seccion titulo="Lo que viene">
          <p>
            Este módulo está en crecimiento. Próximamente: estudios de ahorro (situación
            actual frente a la propuesta), cálculo de comisiones devengadas por comercializadora,
            registro de autofacturas e histórico de consumos de los clientes.
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
