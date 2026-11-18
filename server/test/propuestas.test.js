import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";
import express from "express";
import propuestaRouter from "../src/routes/propuestas.js";
import uploadsRouter from "../src/routes/uploads.js";
import Cuenta from "../src/models/plataforma/Cuenta.js";
import { requiereAuth } from "../src/middleware/auth.js";
import { conContexto } from "../src/models/tenant.js";
import { firmarToken } from "../src/services/jwt.js";

import sharp from "sharp";

const png = await sharp({ create: { width: 8, height: 8, channels: 4, background: "white" } }).png().toBuffer();
const pdf = Buffer.from("%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF\n");

test("Propuestas: adjuntos, errores, aislamiento y pegado real con Ctrl+V", { timeout: 120000 }, async (t) => {
  const cwd = process.cwd();
  const temporal = await mkdtemp(path.join(tmpdir(), "filanex-test-propuestas-"));
  const variables = ["JWT_SECRET", "R2_ENDPOINT", "S3_ENDPOINT"];
  const anteriores = Object.fromEntries(variables.map((key) => [key, process.env[key]]));
  let server, vite, browser;
  let fallarGuardado = false;
  const registros = new Map();
  process.chdir(temporal);
  process.env.JWT_SECRET = "solo-pruebas-locales-propuestas-sin-cuentas-reales";
  delete process.env.R2_ENDPOINT;
  delete process.env.S3_ENDPOINT;
  t.mock.method(Cuenta, "findById", () => ({ select: () => ({ lean: async () => ({ activa: true, sesion: "test" }) }) }));
  const tokens = Object.fromEntries(["a", "b"].map((empresa) => [empresa, firmarToken({ sub: `test-${empresa}`, sid: "test", nombre: "Prueba aislada", t: `test-propuestas-${empresa}`, db: `filanex_test_propuestas_${empresa}` })]));
  try {
    const app = express();
    app.use("/api/propuestas", requiereAuth, (req, res, next) => {
      assert.ok(req.usuario.db.startsWith("filanex_test_"));
      const slug = req.usuario.t;
      if (!registros.has(slug)) registros.set(slug, []);
      const modelo = {
        async create(datos) {
          if (fallarGuardado) throw new Error("Fallo de guardado simulado");
          const documento = { ...datos, _id: String(registros.get(slug).length + 1), estado: "pendiente", createdAt: new Date().toISOString() };
          registros.get(slug).unshift(documento);
          return documento;
        },
        find: () => ({ sort: () => ({ limit: () => ({ lean: async () => registros.get(slug) }) }) }),
      };
      req.contextoEmpresa = { slug, dbName: req.usuario.db, conn: { model: (nombre) => { assert.equal(nombre, "Propuesta"); return modelo; } } };
      conContexto(req.contextoEmpresa, next);
    }, propuestaRouter);
    app.use(uploadsRouter);
    app.use((error, req, res, next) => res.status(500).json({ error: error.message }));
    server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    const base = `http://127.0.0.1:${server.address().port}`;
    async function enviar(archivos = [], texto = "Orden con líneas sin imprimir", token = tokens.a) {
      const form = new FormData();
      form.append("texto", texto);
      for (const archivo of archivos) form.append("capturas", new Blob([archivo.buffer], { type: archivo.type }), archivo.name);
      return fetch(`${base}/api/propuestas`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
    }
    const respuesta = await enviar([{ name: "captura.png", type: "image/png", buffer: png }, { name: "impresion.pdf", type: "application/octet-stream", buffer: pdf }]);
    assert.equal(respuesta.status, 201);
    const creada = await respuesta.json();
    assert.equal(creada.adjuntos.length, 2);
    for (const [indice, buffer] of [png, pdf].entries()) {
      const url = creada.adjuntos[indice].url;
      assert.ok(url.startsWith("/uploads/test-propuestas-a/propuestas/"));
      const archivo = await fetch(`${base}${url}`, { headers: { Authorization: `Bearer ${tokens.a}` } });
      assert.equal(archivo.status, 200);
      assert.equal(archivo.headers.get("content-type").split(";")[0], indice ? "application/pdf" : "image/png");
      assert.deepEqual(Buffer.from(await archivo.arrayBuffer()), buffer);
      assert.equal((await fetch(`${base}${url}`, { headers: { Authorization: `Bearer ${tokens.b}` } })).status, 403);
      assert.equal((await fetch(`${base}${url}`)).status, 401);
    }
    const leer = async (token) => (await fetch(`${base}/api/propuestas`, { headers: { Authorization: `Bearer ${token}` } })).json();
    assert.equal((await leer(tokens.a))[0].adjuntos.length, 2);
    assert.deepEqual(await leer(tokens.b), []);
    for (const archivo of [
      { name: "enganoso.png", type: "image/png", buffer: Buffer.from("<svg><script>alert(1)</script></svg>") },
      { name: "vacio.pdf", type: "application/pdf", buffer: Buffer.alloc(0) },
    ]) assert.equal((await enviar([archivo])).status, 400);
    assert.equal((await enviar(Array.from({ length: 5 }, () => ({ name: "imagen.png", type: "image/png", buffer: png })))).status, 400);
    assert.equal((await enviar([{ name: "grande.png", type: "image/png", buffer: Buffer.alloc(10 * 1024 * 1024 + 1) }])).status, 413);
    assert.equal((await enviar([], "")).status, 400);
    const carpeta = path.join(temporal, "uploads/test-propuestas-a/propuestas");
    const antes = await readdir(carpeta);
    fallarGuardado = true;
    assert.equal((await enviar([{ name: "captura.png", type: "image/png", buffer: png }])).status, 500);
    fallarGuardado = false;
    assert.deepEqual(await readdir(carpeta), antes);
    assert.equal((await leer(tokens.a)).length, 1);
    console.log("API: PNG y PDF guardados y reabiertos; 401/403 entre empresas; límites, archivos falsos y limpieza tras error comprobados. Persistencia simulada en memoria, sin MongoDB.");

    const requireClient = createRequire(new URL("../../client/package.json", import.meta.url));
    const { createServer } = await import(pathToFileURL(requireClient.resolve("vite")).href);
    const { default: react } = await import(pathToFileURL(requireClient.resolve("@vitejs/plugin-react")).href);
    vite = await createServer({ configFile: false, root: fileURLToPath(new URL("../../client/", import.meta.url)), plugins: [react()], server: { middlewareMode: true, hmr: false }, appType: "custom" });
    app.get("/", async (req, res) => res.type("html").send(await vite.transformIndexHtml("/", '<div id="root"></div><script type="module">import React from "react";import{createRoot}from"react-dom/client";import Novedades from"/src/pages/NovedadesPage.jsx";import{CabeceraContext}from"/src/components/Layout.jsx";import{instalarFetchConSesion}from"/src/lib/sesion.js";instalarFetchConSesion();createRoot(document.getElementById("root")).render(React.createElement(CabeceraContext.Provider,{value:{slotTitulo:null}},React.createElement(Novedades)));</script>')));
    app.use(vite.middlewares);
    const { chromium } = await import("playwright");
    const probarWindows = process.env.TEST_CAPTURA_WINDOWS === "true";
    assert.ok(!probarWindows || process.platform === "win32");
    browser = await chromium.launch({ headless: !probarWindows });
    const context = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
    await context.addInitScript((token) => sessionStorage.setItem("filanex-token", token), tokens.a);
    const page = await context.newPage();
    const errores = [];
    page.on("pageerror", (error) => errores.push(error.message));
    await page.goto(base);
    await page.getByRole("button", { name: /^Propuestas/ }).click();
    const textarea = page.locator("form textarea");
    if (probarWindows) {
      const ejecutar = promisify(execFile);
      const script = fileURLToPath(new URL("./captura-windows.ps1", import.meta.url));
      for (const metodo of ["Recortes", "ImprPant"]) {
        const titulo = `FILANEX_PRUEBA_AISLADA_${metodo}_${process.pid}`;
        await page.evaluate((valor) => { document.title = valor; }, titulo);
        await textarea.fill(`Prueba aislada de captura con ${metodo}`);
        await page.bringToFront();
        const { stdout } = await ejecutar("powershell.exe", ["-NoProfile", "-STA", "-ExecutionPolicy", "Bypass", "-File", script, "-Metodo", metodo, "-TituloVentana", titulo], { timeout: 60000 });
        const capturaWindows = JSON.parse(stdout.trim());
        assert.ok(capturaWindows.portapapelesWindows);
        assert.ok(capturaWindows.ancho > 0 && capturaWindows.alto > 0);
        await page.bringToFront();
        await textarea.focus();
        await page.keyboard.press("Control+V");
        const vista = page.locator('form img[alt="Captura 1"]');
        await vista.waitFor();
        await vista.evaluate((imagen) => imagen.decode());
        assert.deepEqual(await vista.evaluate((imagen) => [imagen.naturalWidth, imagen.naturalHeight]), [capturaWindows.ancho, capturaWindows.alto]);
        await page.getByRole("button", { name: "Enviar propuesta", exact: true }).click();
        await page.getByText("Propuesta enviada. Gracias por ayudarnos a mejorar.", { exact: true }).waitFor();
        const adjunto = registros.get("test-propuestas-a")[0].adjuntos[0];
        await page.reload();
        await page.getByRole("button", { name: /^Propuestas/ }).click();
        const reabierta = page.locator("a img").filter({ visible: true }).first();
        await reabierta.waitFor();
        await reabierta.evaluate((imagen) => imagen.decode());
        assert.deepEqual(await reabierta.evaluate((imagen) => [imagen.naturalWidth, imagen.naturalHeight]), [capturaWindows.ancho, capturaWindows.alto]);
        const archivo = await fetch(`${base}${adjunto.url}`, { headers: { Authorization: `Bearer ${tokens.a}` } });
        const metadata = await sharp(Buffer.from(await archivo.arrayBuffer())).metadata();
        assert.equal(metadata.width, capturaWindows.ancho);
        assert.equal(metadata.height, capturaWindows.alto);
        console.log(`Windows real: ${metodo}, ${capturaWindows.ancho}x${capturaWindows.alto}, selección=${capturaWindows.seleccion}; Ctrl+V, envío y reapertura correctos, sin guardar archivo de origen.`);
      }
    }
    await textarea.fill("No se imprimen todos los trabajos de la orden de prueba.");
    await page.evaluate(async (base64) => {
      const datos = Uint8Array.from(atob(base64), (caracter) => caracter.charCodeAt(0));
      await navigator.clipboard.write([new ClipboardItem({ "image/png": new Blob([datos], { type: "image/png" }) })]);
    }, png.toString("base64"));
    await textarea.focus();
    await page.keyboard.press("Control+V");
    await page.locator('form img[alt="Captura 1"]').waitFor();
    assert.match(await textarea.inputValue(), /No se imprimen/);
    await page.locator('input[type="file"]').setInputFiles({ name: "detalle.pdf", mimeType: "application/pdf", buffer: pdf });
    await page.getByRole("button", { name: "Adjuntar imágenes o PDF (2/4)", exact: true }).waitFor();
    await page.route("**/api/propuestas", (route) => route.request().method() === "POST" ? route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "Fallo de conexión simulado" }) }) : route.continue());
    await page.getByRole("button", { name: "Enviar propuesta", exact: true }).click();
    await page.getByRole("alert").filter({ hasText: "Fallo de conexión simulado" }).waitFor();
    assert.match(await textarea.inputValue(), /No se imprimen/);
    assert.equal(await page.locator("form img").count(), 1);
    await page.getByRole("button", { name: "Adjuntar imágenes o PDF (2/4)", exact: true }).waitFor();
    await page.unroute("**/api/propuestas");
    await page.getByRole("button", { name: "Enviar propuesta", exact: true }).click();
    await page.getByText("Propuesta enviada. Gracias por ayudarnos a mejorar.", { exact: true }).waitFor();
    assert.equal(await textarea.inputValue(), "");
    assert.equal(registros.get("test-propuestas-a")[0].adjuntos.length, 2);
    await page.reload();
    await page.getByRole("button", { name: /^Propuestas/ }).click();
    await page.getByTitle("detalle.pdf", { exact: true }).waitFor();
    const imagenPegada = page.locator('a img[alt^="captura-"]').first();
    await imagenPegada.waitFor();
    assert.equal(await imagenPegada.evaluate((imagen) => imagen.complete && imagen.naturalWidth > 0), true);
    const descarga = await page.request.get(new URL(await page.getByTitle("detalle.pdf", { exact: true }).getAttribute("href"), base).href);
    assert.equal(descarga.status(), 200);
    assert.deepEqual(await descarga.body(), pdf);
    await textarea.fill("Texto conservado");
    await page.evaluate(() => navigator.clipboard.writeText(" y texto pegado"));
    await textarea.focus();
    await page.keyboard.press("End");
    await page.keyboard.press("Control+V");
    assert.equal(await textarea.inputValue(), "Texto conservado y texto pegado");
    await page.locator('input[type="file"]').setInputFiles({ name: "no-admitido.exe", mimeType: "application/octet-stream", buffer: png });
    await page.getByRole("alert").filter({ hasText: "Adjunta imágenes" }).waitFor();
    await page.locator('input[type="file"]').setInputFiles(Array.from({ length: 4 }, (_, indice) => ({ name: `imagen-${indice}.png`, mimeType: "image/png", buffer: png })));
    await page.getByRole("button", { name: "Adjuntar imágenes o PDF (4/4)", exact: true }).waitFor();
    await page.evaluate(async (base64) => navigator.clipboard.write([new ClipboardItem({ "image/png": new Blob([Uint8Array.from(atob(base64), (caracter) => caracter.charCodeAt(0))], { type: "image/png" }) })]), png.toString("base64"));
    await textarea.focus();
    await page.keyboard.press("Control+V");
    await page.getByRole("alert").filter({ hasText: "hasta 4 archivos" }).waitFor();
    assert.equal(await page.locator("form img").count(), 4);
    await page.getByRole("button", { name: "Quitar imagen-0.png", exact: true }).click();
    assert.equal(await page.locator("form img").count(), 3);
    assert.deepEqual(errores, []);
    console.log("Navegador Chromium: Ctrl+V real desde portapapeles sin guardar archivo; texto sin alterar; PDF; envío fallido y reintento; recarga y apertura; pegado de texto normal; máximo cuatro y retirada de adjuntos.");
  } finally {
    if (browser) await browser.close();
    if (vite) await vite.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    process.chdir(cwd);
    for (const key of variables) {
      if (anteriores[key] === undefined) delete process.env[key];
      else process.env[key] = anteriores[key];
    }
    await rm(temporal, { recursive: true, force: true });
  }
});
