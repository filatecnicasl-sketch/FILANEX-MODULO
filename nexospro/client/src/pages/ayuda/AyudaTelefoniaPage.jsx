import CabeceraPagina from "../../components/CabeceraPagina.jsx";
import { Seccion, Sub, Paso, Nota, K } from "./comun.jsx";

// Manual de usuario del módulo de telefonía (centralita IP).
export default function AyudaTelefoniaPage() {
  return (
    <>
      <CabeceraPagina
        titulo="Ayuda · Telefonía"
        descripcion="Centralita IP integrada: aviso de llamada y ficha del cliente al sonar."
      />
      <div className="space-y-4 max-w-4xl">
        <Seccion titulo="Qué hace el módulo">
          <p>
            Conecta FILANEX con tu centralita IP: cuando entra una llamada, el programa
            <b> reconoce el número</b> y te muestra quién llama antes de descolgar, con su situación
            (lo que te debe, facturas pendientes, órdenes abiertas). Todas las llamadas quedan
            registradas en el historial.
          </p>
        </Seccion>

        <Seccion titulo="El aviso de llamada entrante">
          <p>
            Al sonar el teléfono aparece una tarjeta flotante abajo a la derecha (en cualquier pantalla):
          </p>
          <Sub>Si el número está en la cartera</Sub>
          <p>
            Ves el <b>nombre del cliente o proveedor</b>, su teléfono y, si es cliente, un resumen con
            <b> pendiente de cobro</b>, <b>facturas pendientes</b> y <b>órdenes abiertas</b> en el taller.
            El enlace <K>Ver ficha del cliente</K> te lleva a su ficha con un clic.
          </p>
          <Sub>Si el número es desconocido</Sub>
          <p>
            Te ofrece <K>Crear cliente</K> directamente, para darlo de alta mientras atiendes.
          </p>
          <p>
            La tarjeta cambia de color según el momento: azul mientras suena, verde en curso y rojo si la
            llamada se pierde (para que la devuelvas).
          </p>
          <Nota titulo="Pruébalo sin centralita">
            En <K>Telefonía → Llamadas</K> el botón <K>Simular llamada</K> genera una llamada de prueba
            para que veas el aviso exactamente igual que en producción.
          </Nota>
        </Seccion>

        <Seccion titulo="Historial de llamadas">
          <p>
            <K>Telefonía → Llamadas</K> lista todas las llamadas (entrantes y salientes) con fecha,
            número, contacto reconocido, estado y duración. Se actualiza solo en cuanto la centralita
            envía un evento.
          </p>
          <Sub>Filtros</Sub>
          <p>
            Busca por <b>número</b> y filtra por <b>tipo</b> (entrantes/salientes) y por <b>estado</b>
            (atendidas, perdidas, en curso…). Muy útil para revisar las perdidas del día.
          </p>
          <Sub>Acciones de cada llamada</Sub>
          <p>
            <b>Notas</b>: clic sobre «+ nota» para anotar de qué hablasteis. El icono de teléfono
            <b> devuelve la llamada</b> (abre el marcador del sistema). La papelera elimina el registro
            del historial.
          </p>
        </Seccion>

        <Seccion titulo="Conexión con la centralita (técnico)">
          <p>
            La centralita (o el proveedor SIP) debe enviar los eventos de llamada al webhook que aparece
            al pie de la página de Llamadas:
          </p>
          <p>
            <code className="text-accent bg-accent/10 rounded px-1.5 py-0.5">
              POST /api/telefonia/evento?token=filanex-telefonia
            </code>
          </p>
          <p>
            con los campos <code>numero</code>, <code>direccion</code> (entrante/saliente) y
            <code> estado</code> (sonando, en-curso, colgada). El reconocimiento del contacto es
            automático por número de teléfono: mantén los teléfonos de clientes y proveedores bien
            cumplimentados.
          </p>
          <Nota titulo="Activar o desactivar">
            El módulo se enciende y se apaga en <K>Sistema → Módulos</K>. Si no usas telefonía IP,
            desactívalo y desaparece del menú.
          </Nota>
        </Seccion>
      </div>
    </>
  );
}
