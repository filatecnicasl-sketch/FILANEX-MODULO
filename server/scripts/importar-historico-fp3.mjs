// Importación de documentos históricos exportados desde el programa anterior
// en formato FastReport (.fp3). Los .fp3 son XML con los valores del informe:
// cabecera (cliente, fecha, serie/número), bandas de línea y pie de totales.
//
// Los listados en Excel del programa antiguo se usan como contraste: validan
// el total de cada documento y aportan el enlace albarán → factura.
//
// Uso (simulacro, no escribe nada):
//   node scripts/importar-historico-fp3.mjs --db filanex_filatecnica
//     --albaranes <carpeta> --facturas <carpeta>
//     --excel-albaranes <xlsx> --excel-facturas <xlsx>
//
// Añadir --aplicar para grabar y --limpiar para borrar una importación previa.
//
// Los documentos se importan como histórico: NO se registran en la cadena
// VeriFactu ni se envían a la AEAT (los emitió el programa anterior).

import fs from "node:fs";
import path from "node:path";
import mongoose from "mongoose";
import xlsx from "xlsx";

const SERIE_BASE = "3"; // serie del programa anterior
const EJERCICIO = 2026;
const SERIE_FACTURA = `${SERIE_BASE}-${EJERCICIO}`; // numeración anual por ejercicio

// --- Utilidades de parseo -------------------------------------------------

const NUMERO_ES = /^-?\d{1,3}(?:\.\d{3})*,\d{1,2}$|^-?\d+,\d{1,2}$/;

function aNumero(texto) {
  return Number(String(texto).trim().replace(/\./g, "").replace(",", "."));
}

function esNumero(texto) {
  return NUMERO_ES.test(String(texto).trim());
}

function redondear(n) {
  return Math.round(n * 100) / 100;
}

function limpiar(texto) {
  return String(texto)
    .replace(/&#13;&#10;/g, "\n")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function aFecha(texto) {
  const m = String(texto ?? "").match(/(\d{2})[-/](\d{2})[-/](\d{4})/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12, 0, 0);
}

// Devuelve los valores (atributo u="...") de un fragmento, en orden.
function valores(fragmento) {
  const salida = [];
  const re = /<(\w+)\b[^>]*?\bu="([^"]*)"[^>]*\/?>/g;
  let m;
  while ((m = re.exec(fragmento)) !== null) salida.push({ tag: m[1], valor: limpiar(m[2]) });
  return salida;
}

// Extrae las bandas <bN ...>...</bN> del informe, en orden de aparición.
function bandas(xml) {
  const salida = [];
  const re = /<(b\d+)\b[^>]*>([\s\S]*?)<\/\1>/g;
  let m;
  while ((m = re.exec(xml)) !== null) salida.push({ nombre: m[1], contenido: m[2] });
  return salida;
}

// Busca el valor que sigue a una etiqueta ("Fecha", "TOTAL"…) en la lista.
function trasEtiqueta(lista, etiqueta, { numerico = false, inmediato = false } = {}) {
  const idx = lista.findIndex((v) => v.valor.toUpperCase() === etiqueta.toUpperCase());
  if (idx < 0) return null;
  if (inmediato) return lista[idx + 1]?.valor ?? null;
  for (let i = idx + 1; i < lista.length; i++) {
    const v = lista[i].valor;
    if (v === "" || v === "/") continue;
    if (numerico && !esNumero(v)) continue;
    return v;
  }
  return null;
}

// --- Parseo de un documento ----------------------------------------------

export function leerFp3(ruta) {
  const xml = fs.readFileSync(ruta, "utf8");
  const bs = bandas(xml);
  const todos = valores(xml);

  // Cabecera: la primera banda contiene cliente, fecha y serie/número.
  const cab = valores(bs[0]?.contenido ?? "");

  // La banda de detalle es la que más se repite (una por línea del documento).
  const frecuencia = {};
  for (const b of bs.slice(1)) frecuencia[b.nombre] = (frecuencia[b.nombre] ?? 0) + 1;
  const bandaDetalle = Object.entries(frecuencia).sort((a, b) => b[1] - a[1])[0]?.[0];
  // El pie es la banda (distinta de cabecera y detalle) con los totales.
  const posibles = bs.slice(1).filter((b) => b.nombre !== bandaDetalle);
  const pie =
    posibles.find((b) => /Base Imponible/i.test(b.contenido)) ??
    posibles.find((b) => /TOTAL/.test(b.contenido));
  const vPie = valores(pie?.contenido ?? "");

  const fecha = trasEtiqueta(cab, "Fecha") ?? trasEtiqueta(todos, "Fecha");
  const idxNum = cab.findIndex((v) => /^n[uú]mero$/i.test(v.valor));
  let serie = null;
  let numero = null;
  if (idxNum >= 0) {
    const restantes = cab.slice(idxNum + 1).filter((v) => v.valor !== "" && v.valor !== "/");
    serie = restantes[0]?.valor?.trim() ?? null;
    numero = restantes[1]?.valor?.trim() ?? null;
  }
  // Respaldo: el nombre del informe trae "… nº 0003-000009".
  const nombreInforme = xml.match(/ReportOptions\.Name="([^"]*)"/)?.[1] ?? "";
  const desdeNombre = nombreInforme.match(/(\d+)-(\d+)/);
  if (!numero && desdeNombre) {
    serie = String(Number(desdeNombre[1]));
    numero = String(Number(desdeNombre[2]));
  }

  const cifCliente = trasEtiqueta(cab, "CIF/DNI");
  const codigoCliente = cab.find((v) => /^\d{1,6}$/.test(v.valor))?.valor ?? null;
  const nombreCliente =
    cab.find(
      (v) =>
        v.valor.length > 6 &&
        !v.valor.startsWith("[") &&
        /[A-Za-zÁÉÍÓÚÑ]/.test(v.valor) &&
        !/^(fecha|n[uú]mero|c[oó]digo|art[ií]culo|cantidad|precio|dto|total|cif\/dni|p[aá]gina|de)$/i.test(
          v.valor
        )
    )?.valor ?? null;

  // Líneas: solo las bandas de detalle. Una banda con importes es una línea
  // real; una banda con solo texto es continuación (detalle) de la anterior.
  const lineas = [];
  for (const b of bs.slice(1)) {
    if (b.nombre !== bandaDetalle) continue;
    const vs = valores(b.contenido).filter((v) => v.valor !== "");
    if (vs.length === 0) continue;
    const textos = vs.filter((v) => !esNumero(v.valor));
    const nums = vs.filter((v) => esNumero(v.valor)).map((v) => aNumero(v.valor));
    const descripcion = textos[0]?.valor ?? "";

    if (nums.length === 0) {
      if (lineas.length > 0 && descripcion) lineas[lineas.length - 1].detalle.push(descripcion);
      continue;
    }
    if (nums.length < 3) continue;

    // Orden de las columnas: cantidad, precio, [descuento], importe.
    const [cantidad, precio, ...resto] = nums;
    const importe = resto[resto.length - 1];
    const descuento = resto.length > 1 ? resto[0] : 0;
    const calculado = cantidad * precio * (1 - (descuento || 0) / 100);
    lineas.push({
      descripcion,
      detalle: [],
      cantidad,
      precioUnitario: precio,
      descuento: descuento || 0,
      importe,
      cuadra: Math.abs(calculado - importe) < 0.02,
    });
  }

  const base = trasEtiqueta(vPie, "Base Imponible", { numerico: true });
  const cuota = vPie.find(
    (v, i) =>
      /I\.V\.A\./i.test(vPie[i - 1]?.valor ?? "") &&
      /importe/i.test(vPie[i - 1]?.valor ?? "") &&
      esNumero(v.valor)
  )?.valor;
  const total = trasEtiqueta(vPie, "TOTAL", { numerico: true });
  const tipoIva = vPie.find((v, i) => /^%\s*\n?I\.V\.A\./i.test(vPie[i - 1]?.valor ?? ""))?.valor;
  const formaPago = trasEtiqueta(todos, "Forma de Pago", { inmediato: true });

  return {
    archivo: path.basename(ruta),
    serie,
    numero: numero != null ? Number(numero) : null,
    fecha: aFecha(fecha),
    fechaTexto: fecha,
    codigoCliente,
    nombreCliente,
    cifCliente,
    formaPago: formaPago || null,
    lineas: lineas.map((l) => ({ ...l, detalle: l.detalle.join("\n") })),
    baseImponible: base ? aNumero(base) : null,
    tipoIva: tipoIva ? aNumero(tipoIva) : 21,
    cuotaIva: cuota ? aNumero(cuota) : null,
    total: total ? aNumero(total) : null,
  };
}

// --- Lectura de los listados en Excel ------------------------------------

function leerExcel(ruta) {
  const libro = xlsx.readFile(ruta);
  const hoja = libro.Sheets[libro.SheetNames[0]];
  const filas = xlsx.utils.sheet_to_json(hoja, { defval: null });
  const mapa = new Map();
  for (const f of filas) {
    const numero = Number(f["Número"]);
    if (!numero) continue;
    mapa.set(numero, {
      numero,
      serie: String(f["Serie"] ?? "").trim(),
      fecha: f["Fecha"],
      codigoCliente: f["Cliente"] != null ? String(f["Cliente"]) : null,
      nombre: f["Nombre"],
      total: Number(f["Total"]),
      factura: f["Factura"] != null ? Number(f["Factura"]) : null,
      observaciones: f["Observaciones"] ?? null,
    });
  }
  return mapa;
}

// --- Análisis de una carpeta de .fp3 -------------------------------------

function analizarCarpeta(dir, excel, etiqueta) {
  const archivos = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".fp3"))
    .map((f) => path.join(dir, f));

  const porNumero = new Map();
  const avisos = [];

  for (const ruta of archivos) {
    const d = leerFp3(ruta);
    if (!d.numero) {
      avisos.push(`${path.basename(ruta)}: no se ha podido leer el número de documento`);
      continue;
    }
    const previo = porNumero.get(d.numero);
    if (previo) {
      // Copias del mismo documento: solo avisamos si no coinciden.
      if (Math.abs((previo.total ?? 0) - (d.total ?? 0)) > 0.01) {
        avisos.push(
          `${etiqueta} ${d.numero}: dos archivos con el mismo número y distinto total ` +
            `(${previo.archivo} ${previo.total} · ${d.archivo} ${d.total})`
        );
      }
      continue;
    }
    porNumero.set(d.numero, d);
  }

  // Contraste con el listado del programa anterior.
  const errores = [];
  for (const [numero, d] of porNumero) {
    const fila = excel?.get(numero);
    const suma = redondear(d.lineas.reduce((s, l) => s + l.importe, 0));

    if (d.lineas.length === 0) errores.push(`${etiqueta} ${numero}: sin líneas`);
    for (const l of d.lineas) {
      if (!l.cuadra) {
        errores.push(
          `${etiqueta} ${numero}: la línea "${l.descripcion}" no cuadra ` +
            `(${l.cantidad} x ${l.precioUnitario} ≠ ${l.importe})`
        );
      }
    }
    if (d.baseImponible == null || Math.abs(suma - d.baseImponible) > 0.02) {
      errores.push(`${etiqueta} ${numero}: suma de líneas ${suma} ≠ base ${d.baseImponible}`);
    }
    if (d.total == null || Math.abs((d.baseImponible ?? 0) + (d.cuotaIva ?? 0) - d.total) > 0.02) {
      errores.push(`${etiqueta} ${numero}: base + IVA ≠ total ${d.total}`);
    }
    if (fila) {
      if (Math.abs(fila.total - (d.total ?? 0)) > 0.02) {
        errores.push(`${etiqueta} ${numero}: total ${d.total} ≠ listado ${fila.total}`);
      }
      if (fila.codigoCliente && d.codigoCliente && fila.codigoCliente !== d.codigoCliente) {
        errores.push(
          `${etiqueta} ${numero}: cliente ${d.codigoCliente} ≠ listado ${fila.codigoCliente}`
        );
      }
    } else if (excel) {
      avisos.push(`${etiqueta} ${numero}: no aparece en el listado del programa anterior`);
    }
  }

  // Documentos del listado que no se han exportado.
  if (excel) {
    for (const numero of excel.keys()) {
      if (!porNumero.has(numero)) errores.push(`${etiqueta} ${numero}: falta el archivo .fp3`);
    }
  }

  return { documentos: porNumero, errores, avisos };
}

// --- Importación ----------------------------------------------------------

function lineasDocumento(d) {
  return d.lineas.map((l) => ({
    descripcion: l.descripcion,
    detalle: l.detalle || undefined,
    cantidad: l.cantidad,
    precioUnitario: l.precioUnitario,
    descuento: l.descuento || 0,
    iva: d.tipoIva ?? 21,
    devuelto: 0,
  }));
}

function metodoPago(d) {
  if (!d.formaPago) return "Transferencia";
  const t = d.formaPago.trim();
  return t.charAt(0).toUpperCase() + t.slice(1).toLowerCase();
}

async function importar({ albaranes, facturas, db, aplicar, limpiar }) {
  const uriBase = process.env.MONGODB_URI_BASE || "mongodb://localhost:27017";
  await mongoose.connect(`${uriBase}/${db}`);
  const cx = mongoose.connection;
  const Clientes = cx.collection("clientes");
  const Facturas = cx.collection("facturaventas");
  const Albaranes = cx.collection("albaranventas");
  const Contadores = cx.collection("contadors");
  const Empresas = cx.collection("empresas");

  const empresa = await Empresas.findOne({});
  if (!empresa) throw new Error(`No hay empresa en ${db}`);

  // Resolución de clientes por el código del programa anterior.
  const codigos = new Set();
  for (const d of [...albaranes.values(), ...facturas.values()]) {
    if (d.codigoCliente) codigos.add(d.codigoCliente);
  }
  const fichas = await Clientes.find({ codigo: { $in: [...codigos] } }).toArray();
  const porCodigo = new Map(fichas.map((c) => [c.codigo, c]));
  const sinCliente = [...codigos].filter((c) => !porCodigo.has(c));
  if (sinCliente.length > 0) {
    throw new Error(`Clientes no encontrados por código: ${sinCliente.join(", ")}`);
  }

  if (limpiar && aplicar) {
    const f = await Facturas.deleteMany({ "verifactu.estadoEnvio": "historica" });
    const a = await Albaranes.deleteMany({ serieNumero: new RegExp(`^${SERIE_BASE}-\\d+$`) });
    console.log(`Limpieza: ${f.deletedCount} facturas y ${a.deletedCount} albaranes borrados`);
  }

  // 1) Facturas.
  const idFactura = new Map();
  const docsFactura = [];
  for (const [numero, d] of [...facturas.entries()].sort((a, b) => a[0] - b[0])) {
    const cliente = porCodigo.get(d.codigoCliente);
    const _id = new mongoose.Types.ObjectId();
    idFactura.set(numero, _id);
    docsFactura.push({
      _id,
      empresa: empresa._id,
      serie: SERIE_FACTURA,
      numero,
      serieNumero: `${SERIE_FACTURA}-${numero}`,
      tipoFactura: "F1",
      fechaExpedicion: d.fecha,
      cliente: cliente._id,
      descripcion: d.lineas[0]?.descripcion ?? "",
      lineas: lineasDocumento(d),
      baseImponible: d.baseImponible,
      cuotaIva: d.cuotaIva,
      total: d.total,
      estado: "emitida",
      metodoPago: metodoPago(d),
      cobros: [],
      origen: { albaranes: [] },
      // Histórico del programa anterior: fuera de la cadena VeriFactu.
      verifactu: { enviada: false, estadoEnvio: "historica" },
      createdAt: d.fecha,
      updatedAt: d.fecha,
    });
  }

  // 2) Albaranes, enlazados con su factura.
  const docsAlbaran = [];
  const enlaces = new Map(); // factura → [albaranId]
  for (const [numero, d] of [...albaranes.entries()].sort((a, b) => a[0] - b[0])) {
    const cliente = porCodigo.get(d.codigoCliente);
    const _id = new mongoose.Types.ObjectId();
    const numFactura = d.excel?.factura ?? null;
    const facturaId = numFactura ? idFactura.get(numFactura) : null;
    if (numFactura && !facturaId) {
      throw new Error(`Albarán ${numero}: la factura ${numFactura} no está en la importación`);
    }
    if (facturaId) {
      if (!enlaces.has(numFactura)) enlaces.set(numFactura, []);
      enlaces.get(numFactura).push(_id);
    }
    docsAlbaran.push({
      _id,
      empresa: empresa._id,
      numero,
      serieNumero: `${SERIE_BASE}-${numero}`,
      fecha: d.fecha,
      cliente: cliente._id,
      lineas: lineasDocumento(d),
      estado: facturaId ? "facturado" : "pendiente",
      ...(facturaId ? { facturaVenta: facturaId } : {}),
      origen: {},
      createdAt: d.fecha,
      updatedAt: d.fecha,
    });
  }
  for (const doc of docsFactura) {
    doc.origen.albaranes = enlaces.get(doc.numero) ?? [];
  }

  const maxFactura = facturas.size > 0 ? Math.max(...facturas.keys()) : 0;
  const maxAlbaran = albaranes.size > 0 ? Math.max(...albaranes.keys()) : 0;
  const metodos = [...new Set(docsFactura.map((f) => f.metodoPago))];

  console.log("\nResumen de la importación");
  console.log(
    `  Facturas  : ${docsFactura.length} (${SERIE_FACTURA}-1 … ${SERIE_FACTURA}-${maxFactura})`
  );
  console.log(`  Albaranes : ${docsAlbaran.length} (hasta ${SERIE_BASE}-${maxAlbaran})`);
  console.log(
    `  Pendientes de facturar: ${docsAlbaran.filter((a) => a.estado === "pendiente").length}`
  );
  console.log(`  Facturado : ${redondear(docsFactura.reduce((s, f) => s + f.total, 0))} €`);
  console.log(`  Base      : ${redondear(docsFactura.reduce((s, f) => s + f.baseImponible, 0))} €`);
  console.log(`  IVA       : ${redondear(docsFactura.reduce((s, f) => s + f.cuotaIva, 0))} €`);
  console.log(`  Métodos de pago: ${metodos.join(", ") || "—"}`);
  console.log(
    `  Próxima factura: ${SERIE_FACTURA}-${maxFactura + 1} · próximo albarán: ${SERIE_BASE}-${maxAlbaran + 1}`
  );

  if (!aplicar) {
    console.log("\nSimulacro: no se ha escrito nada. Añade --aplicar para grabar.");
    await mongoose.disconnect();
    return;
  }

  if (docsFactura.length > 0) await Facturas.insertMany(docsFactura);
  if (docsAlbaran.length > 0) await Albaranes.insertMany(docsAlbaran);

  // Contador atómico de la serie del ejercicio y punteros de la empresa.
  if (maxFactura > 0) {
    await Contadores.updateOne(
      { clave: `facturaVenta:${SERIE_FACTURA}` },
      {
        $set: { valor: maxFactura, updatedAt: new Date() },
        $setOnInsert: { createdAt: new Date() },
      },
      { upsert: true }
    );
  }

  const series = empresa.seriesVenta ?? [];
  const serie = series.find((s) => s.defecto) ?? series[0];
  if (serie) {
    serie.nombre = SERIE_BASE; // el año lo añade la numeración por ejercicio
    if (maxFactura > 0) serie.proxFactura = maxFactura + 1;
    if (maxAlbaran > 0) serie.proxAlbaran = maxAlbaran + 1;
  }
  const catalogo = new Set((empresa.metodosPago ?? []).map((m) => m.nombre ?? m));
  const nuevosMetodos = metodos.filter((m) => !catalogo.has(m));
  await Empresas.updateOne(
    { _id: empresa._id },
    {
      $set: { seriesVenta: series, renumerarAnual: true },
      ...(nuevosMetodos.length > 0
        ? {
            $push: {
              metodosPago: { $each: nuevosMetodos.map((nombre) => ({ nombre, plazos: [] })) },
            },
          }
        : {}),
    }
  );

  console.log("\nImportación aplicada.");
  await mongoose.disconnect();
}

// --- Línea de órdenes -----------------------------------------------------

function argumento(nombre, porDefecto = null) {
  const i = process.argv.indexOf(`--${nombre}`);
  return i >= 0 ? process.argv[i + 1] : porDefecto;
}

if (process.argv[1] && process.argv[1].endsWith("importar-historico-fp3.mjs")) {
  const dirAlbaranes = argumento("albaranes");
  const dirFacturas = argumento("facturas");
  const xlsAlbaranes = argumento("excel-albaranes");
  const xlsFacturas = argumento("excel-facturas");
  const db = argumento("db", "filanex_filatecnica");
  const aplicar = process.argv.includes("--aplicar");
  const limpiar = process.argv.includes("--limpiar");
  const forzar = process.argv.includes("--forzar");

  if (!dirAlbaranes && !dirFacturas) {
    console.error("Falta --albaranes <carpeta> y/o --facturas <carpeta>");
    process.exit(1);
  }

  const excelAlb = xlsAlbaranes ? leerExcel(xlsAlbaranes) : null;
  const excelFac = xlsFacturas ? leerExcel(xlsFacturas) : null;

  const alb = dirAlbaranes
    ? analizarCarpeta(dirAlbaranes, excelAlb, "Albarán")
    : { documentos: new Map(), errores: [], avisos: [] };
  const fac = dirFacturas
    ? analizarCarpeta(dirFacturas, excelFac, "Factura")
    : { documentos: new Map(), errores: [], avisos: [] };

  // El enlace albarán → factura vive en el listado del programa anterior.
  for (const [numero, d] of alb.documentos) d.excel = excelAlb?.get(numero) ?? null;

  const errores = [...alb.errores, ...fac.errores];
  const avisos = [...alb.avisos, ...fac.avisos];

  console.log(`Albaranes leídos: ${alb.documentos.size} · Facturas leídas: ${fac.documentos.size}`);
  if (avisos.length > 0) {
    console.log("\nAvisos:");
    for (const a of avisos) console.log(`  · ${a}`);
  }
  if (errores.length > 0) {
    console.log("\nErrores:");
    for (const e of errores) console.log(`  x ${e}`);
    if (!forzar) {
      console.log("\nNo se importa nada mientras haya errores (--forzar para saltárselos).");
      process.exit(1);
    }
  } else {
    console.log("\nTodos los documentos cuadran: líneas, base, IVA, total y listado.");
  }

  await importar({ albaranes: alb.documentos, facturas: fac.documentos, db, aplicar, limpiar });
}
