import mongoose from "mongoose";

const conn = await mongoose.createConnection("mongodb://localhost:27017/filanex_montiel").asPromise();
try {
  const formatos = conn.db.collection("formatos");
  const plantilla = await formatos.findOne({ tipoDocumento: "contrato-cortesia", porDefecto: true });
  if (!plantilla) throw new Error("No se encontró el contrato de cortesía predeterminado");

  const elementos = [...(plantilla.elements ?? [])];
  const logo = elementos.filter((e) => e.type === "image" && e.src === "{{empresa.logo}}" && e.x === 12 && e.y === 6);
  if (logo.length > 1) throw new Error("Hay más de un marco de logo en la cabecera; no se modificó la plantilla");
  const cabecera = elementos.filter((e) => ["{{empresa.nombre}}", "{{empresa.direccion}}", "{{empresa.telefono}}"].includes(e.text));
  if (cabecera.length !== 3) throw new Error(`Cabecera inesperada (${cabecera.length}/3 campos); no se modificó la plantilla`);
  for (const e of cabecera) {
    e.x = 12;
    e.w = 186;
    e.align = "center";
  }

  const camposVehiculo = [
    ["vehiculo.marca", 12, 60, "Marca"],
    ["vehiculo.modelo", 76, 60, "Modelo"],
    ["vehiculo.matricula", 140, 58, "Nº Matrícula"],
    ["vehiculo.vin", 12, 91, "V.I.N."],
    ["vehiculo.forfaitDiario", 105, 91, "Participación forfait diaria (€)"],
  ];
  for (const [fieldKey, x, w, label] of camposVehiculo) {
    const encontrados = elementos.filter((e) => e.type === "field" && e.fieldKey === fieldKey);
    if (encontrados.length !== 1) throw new Error(`Campo ${fieldKey} inesperado (${encontrados.length}/1); no se modificó la plantilla`);
    encontrados[0].x = x;
    encontrados[0].w = w;
    encontrados[0].label = label;
  }
  for (const e of elementos) {
    if (e.type === "field" && e.label) e.mostrarEtiquetaImpresion = true;
  }

  const otrosConductores = elementos.filter((e) => e.type === "field" && e.fieldKey === "cliente.otrosConductores");
  if (otrosConductores.length !== 1) throw new Error("Campo de otros conductores inesperado; no se modificó la plantilla");
  otrosConductores[0].y = 97;

  const camposSegundoConductor = elementos.filter((e) => e.type === "field" && e.fieldKey?.startsWith("cliente2."));
  if (camposSegundoConductor.length !== 0 && camposSegundoConductor.length !== 5) {
    throw new Error(`Se encontraron ${camposSegundoConductor.length}/5 campos del segundo conductor; no se modificó la plantilla`);
  }
  const seccionReparacion = elementos.filter((e) => e.type === "rect" && e.x === 12 && e.y === 238 && e.w === 186);
  if (seccionReparacion.length === 1) {
    for (const e of elementos.filter((e) => e.y >= 238 && e.y < 264)) e.y -= 3;
  } else if (seccionReparacion.length > 1) {
    throw new Error("Se encontró más de una sección de reparación en la posición antigua; no se modificó la plantilla");
  }

  const rotulos = ["Fecha y hora:", "Km. En el contador:", "Nivel de carburante:"];
  const rotulosEncontrados = elementos.filter((e) => e.type === "text" && rotulos.includes(e.text));
  if (rotulosEncontrados.length !== 0 && rotulosEncontrados.length !== 3) {
    throw new Error(`Se encontraron ${rotulosEncontrados.length}/3 rótulos duplicados; no se modificó la plantilla`);
  }
  const etiquetasVehiculo = ["Vehículo puesto a disposición Nº", "PTE €"];
  const etiquetasVehiculoEncontradas = elementos.filter((e) => e.type === "text" && etiquetasVehiculo.includes(e.text));
  if (etiquetasVehiculoEncontradas.length !== 0 && etiquetasVehiculoEncontradas.length !== 2) {
    throw new Error(`Se encontraron ${etiquetasVehiculoEncontradas.length}/2 etiquetas antiguas; no se modificó la plantilla`);
  }
  const filtrados = elementos.filter((e) =>
    !(e.type === "image" && e.src === "{{empresa.logo}}" && e.x === 12 && e.y === 6) &&
    !(e.type === "field" && e.fieldKey?.startsWith("cliente2.")) &&
    !(e.type === "text" && [...rotulos, ...etiquetasVehiculo].includes(e.text))
  );

  const r = await formatos.updateOne(
    { _id: plantilla._id, tipoDocumento: "contrato-cortesia", porDefecto: true },
    { $set: { elements: filtrados, updatedAt: new Date() } },
  );
  if (r.matchedCount !== 1) throw new Error("La plantilla cambió durante la actualización");
  const verificada = await formatos.findOne({ _id: plantilla._id });
  console.log(JSON.stringify({
    plantilla: verificada.nombre,
    logoVacioQuitado: !verificada.elements.some((e) => e.type === "image" && e.src === "{{empresa.logo}}" && e.x === 12 && e.y === 6),
    datosEmpresaCentrados: verificada.elements.filter((e) => ["{{empresa.nombre}}", "{{empresa.direccion}}", "{{empresa.telefono}}"].includes(e.text)).every((e) => e.x === 12 && e.w === 186 && e.align === "center"),
    rotulosDuplicadosRestantes: verificada.elements.filter((e) => e.type === "text" && [...rotulos, ...etiquetasVehiculo].includes(e.text)).length,
    camposSegundoConductorRestantes: verificada.elements.filter((e) => e.type === "field" && e.fieldKey?.startsWith("cliente2.")).length,
    otrosConductoresAntesDeVehiculo: verificada.elements.find((e) => e.type === "field" && e.fieldKey === "cliente.otrosConductores")?.y < 108,
    camposConEtiquetaImpresion: verificada.elements.filter((e) => e.type === "field" && e.label).every((e) => e.mostrarEtiquetaImpresion),
  }));
} finally {
  await conn.close();
}
