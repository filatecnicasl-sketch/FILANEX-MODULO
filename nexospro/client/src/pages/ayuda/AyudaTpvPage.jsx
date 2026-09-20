import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Seccion, Sub, Paso, Nota } from "./comun.jsx";

export default function AyudaTpvPage() {
  return (
    <CabeceraPagina
      titulo="Ayuda · TPV"
      descripcion="Guía rápida del terminal de venta."
    >
      <div className="max-w-3xl">
        <Seccion titulo="Terminal">
          <Sub>Apertura de caja</Sub>
          <Paso>
            Antes de vender, abre la caja desde <b>TPV → Terminal</b> con el importe inicial.
          </Paso>
          <Paso>
            Si ya hay una caja abierta de otro usuario, ciérrala o contínuala según el caso.
          </Paso>

          <Sub>Venta rápida</Sub>
          <Paso>
            Escanea o busca el artículo, indica cantidad y pulsa <b>Cobrar</b>.
          </Paso>
          <Paso>
            Elige la forma de pago. Si es en efectivo, indica lo entregado para calcular el cambio.
          </Paso>
          <Paso>
            El ticket se imprime automáticamente si tienes activada la impresión de tickets.
          </Paso>

          <Sub>Devoluciones</Sub>
          <Paso>
            Localiza el ticket original en <b>TPV → Tickets</b> y pulsa <b>Devolver</b>.
          </Paso>
        </Seccion>

        <Seccion titulo="Cierre de caja">
          <Paso>
            Ve a <b>TPV → Caja</b> y pulsa <b>Cerrar caja</b>.
          </Paso>
          <Paso>
            Introduce el importe real en efectivo y revisa las diferencias, si las hay.
          </Paso>
          <Nota>
            Los cierres se guardan con su arqueo y se pueden consultar después.
          </Nota>
        </Seccion>

        <Seccion titulo="Periféricos">
          <Paso>
            En <b>TPV → Periféricos</b> configura la impresora de tickets, el cajón y el lector de códigos.
          </Paso>
          <Nota>
            En Windows puedes usar una impresora térmica genérica ESC/POS conectada por USB o red.
          </Nota>
        </Seccion>
      </div>
    </CabeceraPagina>
  );
}
