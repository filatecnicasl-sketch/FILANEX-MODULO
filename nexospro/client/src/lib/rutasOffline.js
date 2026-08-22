// Qué se puede guardar para enviar luego cuando no hay conexión.
//
// Norma: lista blanca. Solo entra lo que el taller y el servicio técnico
// necesitan poder hacer en el foso o en casa del cliente, más las altas
// rápidas y los borradores de venta. Todo lo demás (validar y emitir
// facturas, remesas, tesorería, OCR, certificado, usuarios, empresa,
// importaciones y cualquier borrado) exige red y avisa al usuario.

const ENCOLABLES = [
  // Taller
  { metodo: "POST", patron: /^\/api\/taller\/recepcion$/, tipo: "recepcion", etiqueta: "Recepción de vehículo" },
  { metodo: "POST", patron: /^\/api\/taller\/ordenes$/, etiqueta: "Orden de taller" },
  { metodo: "PUT", patron: /^\/api\/taller\/ordenes\/[^/]+$/, etiqueta: "Cambio en orden de taller" },
  { metodo: "POST", patron: /^\/api\/taller\/ordenes\/[^/]+\/recepcion\/fotos$/, tipo: "fotos", etiqueta: "Fotos de la recepción" },
  { metodo: "POST", patron: /^\/api\/taller\/ordenes\/[^/]+\/recepcion\/firma$/, tipo: "firma", etiqueta: "Firma del cliente" },
  { metodo: "POST", patron: /^\/api\/taller\/ordenes\/[^/]+\/tiempos$/, etiqueta: "Tiempo de operario" },
  { metodo: "POST", patron: /^\/api\/taller\/vehiculos$/, etiqueta: "Alta de vehículo" },
  { metodo: "PUT", patron: /^\/api\/taller\/vehiculos\/[^/]+$/, etiqueta: "Cambio en vehículo" },
  { metodo: "POST", patron: /^\/api\/taller\/citas$/, etiqueta: "Cita de taller" },
  { metodo: "PUT", patron: /^\/api\/taller\/citas\/[^/]+$/, etiqueta: "Cambio en cita" },
  // Servicio técnico
  { metodo: "POST", patron: /^\/api\/servicio\/recepcion$/, tipo: "recepcion", etiqueta: "Recepción de aparato" },
  { metodo: "POST", patron: /^\/api\/servicio\/ordenes$/, etiqueta: "Orden de servicio" },
  { metodo: "PUT", patron: /^\/api\/servicio\/ordenes\/[^/]+$/, etiqueta: "Cambio en orden de servicio" },
  { metodo: "POST", patron: /^\/api\/servicio\/ordenes\/[^/]+\/recepcion\/fotos$/, tipo: "fotos", etiqueta: "Fotos de la recepción" },
  { metodo: "POST", patron: /^\/api\/servicio\/ordenes\/[^/]+\/recepcion\/firma$/, tipo: "firma", etiqueta: "Firma del cliente" },
  { metodo: "POST", patron: /^\/api\/servicio\/aparatos$/, etiqueta: "Alta de aparato" },
  { metodo: "PUT", patron: /^\/api\/servicio\/aparatos\/[^/]+$/, etiqueta: "Cambio en aparato" },
  { metodo: "POST", patron: /^\/api\/servicio\/citas$/, etiqueta: "Cita de servicio" },
  { metodo: "PUT", patron: /^\/api\/servicio\/citas\/[^/]+$/, etiqueta: "Cambio en cita" },
  // Altas rápidas y borradores de venta
  { metodo: "POST", patron: /^\/api\/clientes$/, etiqueta: "Alta de cliente" },
  { metodo: "POST", patron: /^\/api\/presupuestos$/, etiqueta: "Presupuesto" },
  { metodo: "PUT", patron: /^\/api\/presupuestos\/[^/]+$/, etiqueta: "Cambio en presupuesto" },
  { metodo: "POST", patron: /^\/api\/albaranes-venta$/, etiqueta: "Albarán de venta" },
  { metodo: "PUT", patron: /^\/api\/albaranes-venta\/[^/]+$/, etiqueta: "Cambio en albarán" },
  { metodo: "POST", patron: /^\/api\/agenda\/citas$/, etiqueta: "Cita de agenda" },
  { metodo: "PUT", patron: /^\/api\/agenda\/citas\/[^/]+$/, etiqueta: "Cambio en cita" },
];

// Devuelve la regla si esa llamada se puede guardar para más tarde.
export function reglaOffline(metodo, url) {
  const ruta = String(url).split("?")[0];
  const m = String(metodo || "GET").toUpperCase();
  return ENCOLABLES.find((r) => r.metodo === m && r.patron.test(ruta)) ?? null;
}

export function nuevoIdTemporal() {
  const azar = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}${Math.random()}`;
  return `tmp_${azar.replace(/-/g, "").slice(0, 20)}`;
}

// Respuesta que ve la pantalla mientras no hay red. Imita lo justo de la
// respuesta real para que la interfaz siga su curso sin cambios.
export function respuestaSintetica(regla, cuerpo, idTemporal) {
  const base = { ...(cuerpo && typeof cuerpo === "object" ? cuerpo : {}) };
  if (regla.tipo === "recepcion") {
    return {
      vehiculo: { _id: nuevoIdTemporal(), matricula: base.matricula, marca: base.marca, modelo: base.modelo, km: base.km, _pendiente: true },
      orden: {
        _id: idTemporal,
        numero: "pendiente",
        estado: "recibido",
        matricula: base.matricula,
        clienteNombre: base.nombreCliente,
        telefono: base.telefono,
        motivo: base.motivo,
        trabajos: base.trabajos,
        recepcionDigital: { fotos: [], defectos: [] },
        _pendiente: true,
      },
      _pendiente: true,
    };
  }
  if (regla.tipo === "fotos") return { fotos: [], defectos: [], _pendiente: true };
  if (regla.tipo === "firma") {
    return { nombre: base.nombre, dni: base.dni, imagen: base.imagen, fecha: new Date().toISOString(), _pendiente: true };
  }
  return { _id: idTemporal, ...base, _pendiente: true };
}
