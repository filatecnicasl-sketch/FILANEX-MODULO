import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import mongoose from "mongoose";
import express from "express";
import empresaRouter from "../src/routes/empresa.js";
import Empresa from "../src/models/Empresa.js";
import { conContexto, conexionTenant } from "../src/models/tenant.js";
import { consultarSeriesNumeracion, tomarNumeroAtomico, tomarNumeroFacturaVentaAtomico } from "../src/services/numeracion.js";

test("Series muestra los contadores reales sin consumirlos ni reiniciarlos", { skip: !process.env.TEST_MONGODB_URI, timeout: 120000 }, async () => {
  const sufijo = `${Date.now()}_${process.pid}`;
  const nombreBase = `filanex_test_series_${sufijo}`;
  const otraBase = `filanex_test_series_otro_${sufijo}`;
  const uri = new URL(process.env.TEST_MONGODB_URI);
  assert.ok(["127.0.0.1", "localhost"].includes(uri.hostname));
  uri.pathname = `/filanex_test_series_pool_${sufijo}`;
  await mongoose.connect(uri.href, { serverSelectionTimeoutMS: 10000, autoCreate: false, autoIndex: false });
  const contexto = { conn: conexionTenant(nombreBase), slug: "test-series", dbName: nombreBase };
  const otro = { conn: conexionTenant(otraBase), slug: "test-series-otro", dbName: otraBase };
  for (const ctx of [contexto, otro]) assert.ok(ctx.dbName.startsWith("filanex_test_"));
  const ejercicio = new Date().getFullYear();
  let server, vite, browser;
  try {
    await contexto.conn.collection("empresas").insertOne({
      nombre: "Empresa aislada", nif: "B00000000", renumerarAnual: true,
      seriesVenta: [{ nombre: "3", defecto: true, proxFactura: 29, proxPresupuesto: 1, proxAlbaran: 1 }],
      seriesCompra: [{ nombre: "C", defecto: true, proxPresupuesto: 1, proxPedido: 1, proxAlbaran: 1 }],
      metodosPago: [{ nombre: "Transferencia", defecto: true, plazos: [] }],
    });
    await contexto.conn.collection("contadors").insertMany([
      { clave: `facturaVenta:3-${ejercicio}`, valor: 39 },
      { clave: `facturaVenta:3-${ejercicio - 1}`, valor: 100 },
      { clave: "presupuestoVenta:3", valor: 112 },
      { clave: "albaranVenta:3", valor: 32 },
      { clave: "presupuestoCompra:C", valor: 4 },
      { clave: "pedidoCompra:C", valor: 7 },
      { clave: "albaranCompra:C", valor: 9 },
    ]);
    await contexto.conn.collection("facturaventas").insertOne({ serieNumero: `3-${ejercicio}-39`, estado: "emitida" });
    await otro.conn.collection("contadors").insertOne({ clave: `facturaVenta:3-${ejercicio}`, valor: 900 });
    const instantanea = () => contexto.conn.collection("contadors").find().sort({ clave: 1 }).toArray();
    const antes = await instantanea();
    const facturasAntes = await contexto.conn.collection("facturaventas").find().toArray();
    const app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      req.usuario = { rol: "admin" };
      req.contextoEmpresa = contexto;
      conContexto(contexto, next);
    });
    app.use("/api/empresa", empresaRouter);
    app.use((error, req, res, next) => res.status(500).json({ error: error.message }));
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    async function consultar(method = "GET", body) {
      const respuesta = await fetch(`${base}/api/empresa/series`, {
        method, headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const datos = await respuesta.json();
      assert.equal(respuesta.status, 200, JSON.stringify(datos));
      return datos;
    }
    let datos = await consultar();
    assert.equal(datos.seriesVenta[0].proxFactura, 40);
    assert.equal(datos.seriesVenta[0].proxPresupuesto, 113);
    assert.equal(datos.seriesVenta[0].proxAlbaran, 33);
    assert.deepEqual([datos.seriesCompra[0].proxPresupuesto, datos.seriesCompra[0].proxPedido, datos.seriesCompra[0].proxAlbaran], [5, 8, 10]);
    assert.equal(datos.ejercicio, ejercicio);
    await Promise.all(Array.from({ length: 12 }, () => consultar()));
    assert.deepEqual(await instantanea(), antes);
    assert.deepEqual(await contexto.conn.collection("facturaventas").find().toArray(), facturasAntes);
    assert.equal((await contexto.conn.collection("empresas").findOne()).seriesVenta[0].proxFactura, 29);
    console.log("OK: caso 29/39 muestra 40; todos los tipos, consultas concurrentes y aislamiento sin escrituras");
    datos.metodosPago[0].nombre = "Contado";
    datos.seriesVenta[0].proxFactura = 1;
    datos = await consultar("PUT", datos);
    assert.equal(datos.seriesVenta[0].proxFactura, 40);
    assert.equal((await consultar()).metodosPago[0].nombre, "Contado");
    assert.deepEqual(await instantanea(), antes);
    assert.deepEqual(await contexto.conn.collection("facturaventas").find().toArray(), facturasAntes);
    const entidad = await conContexto(contexto, () => Empresa.findOne());
    const siguiente = await conContexto(contexto, () => tomarNumeroFacturaVentaAtomico(entidad, { ano: ejercicio }));
    assert.equal(siguiente.serieNumero, `3-${ejercicio}-40`);
    assert.equal((await consultar()).seriesVenta[0].proxFactura, 41);
    const presupuesto = await conContexto(contexto, () => tomarNumeroAtomico(entidad, "presupuestoVenta"));
    assert.equal(presupuesto.numero, 113);
    assert.equal((await consultar()).seriesVenta[0].proxPresupuesto, 114);
    const simultaneos = await conContexto(contexto, () => Promise.all(Array.from({ length: 8 }, () => tomarNumeroFacturaVentaAtomico(entidad, { ano: ejercicio }))));
    assert.deepEqual(simultaneos.map(item => item.numero).sort((a, b) => a - b), [41, 42, 43, 44, 45, 46, 47, 48]);
    assert.equal((await consultar()).seriesVenta[0].proxFactura, 49);
    console.log("OK: guardar y reabrir no reinicia; asignación real 40 y ocho asignaciones concurrentes sin duplicados");
    const casos = [
      { nombre: "NUEVA", renumerarAnual: true, docs: [], esperado: 1 },
      { nombre: "HIST", renumerarAnual: true, docs: [`HIST-${ejercicio}-6`, `HIST-${ejercicio - 1}-99`, `HISTX-${ejercicio}-80`], esperado: 7 },
      { nombre: "FIJA", renumerarAnual: false, docs: ["FIJA-17"], esperado: 18 },
      { nombre: "A.+", renumerarAnual: true, docs: [`A.+-${ejercicio}-8`, `ABZ-${ejercicio}-100`], esperado: 9 },
    ];
    for (const caso of casos) {
      if (caso.docs.length) await contexto.conn.collection("facturaventas").insertMany(caso.docs.map(serieNumero => ({ serieNumero })));
      const config = { renumerarAnual: caso.renumerarAnual, seriesVenta: [{ nombre: caso.nombre, defecto: true, proxFactura: 999 }] };
      const previos = await instantanea();
      const vista = await conContexto(contexto, () => consultarSeriesNumeracion(config, { ano: ejercicio }));
      assert.equal(vista.seriesVenta[0].proxFactura, caso.esperado);
      assert.equal(config.seriesVenta[0].proxFactura, 999);
      assert.deepEqual(await instantanea(), previos);
      const asignado = await conContexto(contexto, () => tomarNumeroFacturaVentaAtomico(config, { ano: ejercicio }));
      assert.equal(asignado.numero, caso.esperado);
    }
    const otroEjercicio = await conContexto(contexto, () => consultarSeriesNumeracion(entidad, { ano: ejercicio + 1 }));
    assert.equal(otroEjercicio.seriesVenta[0].proxFactura, 1);
    assert.equal((await otro.conn.collection("contadors").findOne()).valor, 900);
    console.log("OK: series nuevas, históricas, sin renumeración, prefijos especiales y cambio de ejercicio");
    const tiposHistoricos = [
      ["presupuestoVenta", "Presupuesto", "seriesVenta", "proxPresupuesto"],
      ["albaranVenta", "AlbaranVenta", "seriesVenta", "proxAlbaran"],
      ["presupuestoCompra", "PresupuestoCompra", "seriesCompra", "proxPresupuesto"],
      ["pedidoCompra", "PedidoCompra", "seriesCompra", "proxPedido"],
      ["albaranCompra", "AlbaranCompra", "seriesCompra", "proxAlbaran"],
    ];
    for (const [tipo, modelo, lista, campo] of tiposHistoricos) {
      const { default: Modelo } = await import(`../src/models/${modelo}.js`);
      await conContexto(contexto, () => Modelo.collection.insertOne({ serieNumero: "HIST-12" }));
      const config = {
        seriesVenta: [{ nombre: "HIST", defecto: true }],
        seriesCompra: [{ nombre: "HIST", defecto: true }],
      };
      const vista = await conContexto(contexto, () => consultarSeriesNumeracion(config, { ano: ejercicio }));
      assert.equal(vista[lista][0][campo], 13);
      const asignado = await conContexto(contexto, () => tomarNumeroAtomico(config, tipo));
      assert.equal(asignado.numero, 13);
    }
    const vistaOtroTenant = await conContexto(otro, () => consultarSeriesNumeracion({ seriesVenta: [{ nombre: "3" }] }, { ano: ejercicio }));
    assert.equal(vistaOtroTenant.seriesVenta[0].proxFactura, 901);
    console.log("OK: cinco tipos históricos sin contador coinciden con su primera asignación; el otro tenant muestra su propio contador");
    if (process.env.TEST_SERIES_UI === "true") {
      const requireClient = createRequire(new URL("../../client/package.json", import.meta.url));
      const { createServer } = await import(pathToFileURL(requireClient.resolve("vite")).href);
      vite = await createServer({ root: fileURLToPath(new URL("../../client/", import.meta.url)), server: { middlewareMode: true, hmr: false }, appType: "custom" });
      app.get("/", async (req, res) => res.type("html").send(await vite.transformIndexHtml("/", '<div id="root"></div><script type="module">import React from "react";import{createRoot}from"react-dom/client";import Series from"/src/pages/SeriesPage.jsx";import{CabeceraContext}from"/src/components/Layout.jsx";const titulo=document.createElement("div");document.body.prepend(titulo);createRoot(document.getElementById("root")).render(React.createElement(CabeceraContext.Provider,{value:{slotTitulo:titulo}},React.createElement(Series)));</script>')));
      app.use(vite.middlewares);
      const { chromium } = await import("playwright");
      browser = await chromium.launch({ headless: true });
      const page = await browser.newPage();
      const errores = [];
      page.on("pageerror", error => errores.push(error.message));
      await page.goto(base);
      const factura = page.getByRole("spinbutton", { name: "proxFactura de la serie 3", exact: true });
      await factura.waitFor();
      assert.equal(await factura.inputValue(), "49");
      assert.equal(await factura.getAttribute("readonly"), "");
      await page.getByPlaceholder("Transferencia, pagaré, confirming…").fill("Transferencia revisada");
      const guardada = page.waitForResponse(response => response.url().endsWith("/api/empresa/series") && response.request().method() === "PUT", { timeout: 5000 }).catch(async error => {
        throw new Error(`${error.message}\n${await page.locator("body").innerText()}\n${JSON.stringify(errores)}`);
      });
      await page.getByRole("button", { name: "Guardar cambios" }).click();
      assert.equal((await guardada).status(), 200);
      await page.getByText("Series y métodos de pago guardados.", { exact: false }).waitFor();
      await page.reload();
      await factura.waitFor();
      assert.equal(await factura.inputValue(), "49");
      assert.equal(await page.getByPlaceholder("Transferencia, pagaré, confirming…").inputValue(), "Transferencia revisada");
      await page.route("**/api/empresa/series", route => route.fulfill({ status: 503, contentType: "application/json", body: '{"error":"Prueba de desconexión"}' }));
      await page.reload();
      await page.getByText("No se pudo conectar con la API.").waitFor();
      assert.equal(await page.getByRole("button", { name: "Guardar cambios" }).count(), 0);
      assert.deepEqual(errores, []);
      console.log("OK: navegador real muestra 49, solo lectura, guardar, recargar y error de conexión sin permitir guardar");
    }
  } finally {
    if (browser) await browser.close();
    if (vite) await vite.close();
    if (server) await new Promise(resolve => server.close(resolve));
    for (const ctx of [contexto, otro]) {
      assert.ok(ctx.dbName.startsWith("filanex_test_"));
      await ctx.conn.dropDatabase();
    }
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
});
