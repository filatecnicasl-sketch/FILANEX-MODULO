import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Seccion, Sub, Paso, Nota, K } from "./comun.jsx";

// Manual de usuario del módulo de Servicio Técnico (SAT).
export default function AyudaServicioPage() {
  return (
    <>
      <CabeceraPagina
        titulo="Ayuda · Servicio Técnico"
        descripcion="Citas, recepción de aparatos, órdenes de servicio y facturación, en tienda o a domicilio."
      />
      <div className="space-y-4 max-w-4xl">
        <Seccion titulo="Cómo fluye el trabajo">
          <p>
            El recorrido normal de un aparato es: <b>Cita → Recepción → Orden de servicio → Factura</b>.
            La recepción abre la orden y la orden genera la factura con un clic.
          </p>
          <p>
            El servicio puede ser <b>en tienda</b> (el cliente trae el aparato) o <b>a domicilio</b>
            (el técnico va a casa o al local del cliente): se elige en cada recepción y la dirección
            de la intervención se precarga de la ficha del cliente.
          </p>
        </Seccion>

        <Seccion titulo="Aparatos (Servicio Técnico → Aparatos)">
          <p>
            Cada aparato tiene ficha propia con código automático <b>AP-000001</b>, tipo (PC, portátil,
            móvil, tablet, monitor, impresora…), marca, modelo y <b>nº de serie</b>, además de los
            accesorios que suele traer, su estado físico y la garantía.
          </p>
          <p>
            La caja de búsqueda encuentra aparatos por <b>cualquier dato</b>: código, tipo, marca,
            modelo, nº de serie o cliente. El botón <K>Historial</K> muestra todas las recepciones del
            aparato con las fotos del estado tomadas al entrar.
          </p>
        </Seccion>

        <Seccion titulo="Citas (Servicio Técnico → Citas)">
          <Paso n={1}>
            Pulsa <K>Nueva cita</K> o haz clic en el hueco del calendario. Puedes elegir un aparato ya
            dado de alta (se rellenan solos cliente y teléfono) o escribir los datos a mano.
          </Paso>
          <Paso n={2}>
            Marca si la cita es <b>en tienda o a domicilio</b>. Si es a domicilio y eliges un cliente,
            su dirección se rellena sola (puedes cambiarla para esa cita).
          </Paso>
          <Paso n={3}>
            Si la cita viene de un presupuesto, deja marcada la casilla <b>«Viene de presupuesto»</b>.
            La búsqueda de arriba encuentra citas por cualquier dato: cliente, teléfono, aparato,
            dirección o motivo.
          </Paso>
        </Seccion>

        <Seccion titulo="Recepción rápida (Órdenes → Recepción rápida)">
          <Paso n={1}>
            Busca el aparato por <b>nº de serie, marca, modelo o código</b>, o dalo de alta en el
            momento. Si el aparato ya tiene cliente, se rellena solo.
          </Paso>
          <Paso n={2}>
            Elige <b>tienda o domicilio</b> y describe la <b>avería</b> tal como la cuenta el cliente.
            Accesorios, estado físico y garantía se precargan de la ficha del aparato y se pueden
            ajustar en cada recepción.
          </Paso>
          <Paso n={3}>
            Si el cliente tiene <b>presupuestos abiertos</b>, aparece el bloque violeta: elige el que
            corresponda y se <b>incluye en la orden</b> con todas sus líneas (y queda aceptado). Solo se
            ofrecen presupuestos a nombre de ese cliente.
          </Paso>
          <Paso n={4}>
            Al guardar se abre la <b>recepción digital</b>: haz las <b>fotos del estado</b> del aparato,
            recoge la <b>firma del cliente</b> en pantalla y pulsa <K>Imprimir hoja y finalizar</K>.
          </Paso>
          <Nota titulo="La hoja de entrada sale por duplicado">
            Se imprimen dos copias: <b>«Ejemplar para el prestador del servicio»</b> y
            <b> «Ejemplar para el cliente»</b>. Las fotos quedan guardadas en el historial del aparato.
          </Nota>
        </Seccion>

        <Seccion titulo="Órdenes de servicio">
          <p>
            El tablero muestra las órdenes por estado (Recepción, En curso, Finalizado, Entregado).
            La píldora <b>«Domicilio»</b> distingue los servicios fuera de la tienda y la violeta
            indica el presupuesto del que nace la orden.
          </p>
          <Sub>Ficha de la orden (botón Editar)</Sub>
          <p>
            Aparato y cliente, avería y diagnóstico, líneas de <b>mano de obra y materiales</b> (con
            descuento por línea) y el presupuesto vinculado, que puedes cambiar o quitar a posteriori.
          </p>
          <Sub>Facturar la orden</Sub>
          <p>
            Cuando el trabajo está <b>finalizado</b>, el botón <K>Facturar</K> crea la factura
            <b> en borrador</b> (sin número definitivo). La factura aparece en <b>Ventas</b> y allí se
            revisa y se pulsa <K>Validar y emitir</K>: en ese momento recibe su número, el registro
            VeriFactu y el QR, y se envía a la AEAT. El presupuesto vinculado queda marcado como
            facturado automáticamente.
          </p>
          <Nota titulo="Primero borrador, después validar">
            Mientras la factura esté en borrador puedes corregirla o borrarla desde Ventas. Una vez
            validada y emitida ya no se puede modificar (solo rectificar), como exige VeriFactu.
          </Nota>
        </Seccion>
      </div>
    </>
  );
}
