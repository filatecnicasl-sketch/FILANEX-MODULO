// Asigna el siguiente código libre a clientes/proveedores que aún no lo tengan.
const base = "http://localhost:4700";

for (const recurso of ["clientes", "proveedores"]) {
  const lista = await (await fetch(`${base}/api/${recurso}`)).json();
  const sinCodigo = lista.filter((x) => !x.codigo);
  let max = 0;
  for (const x of lista) {
    const n = parseInt(x.codigo, 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  for (const x of sinCodigo) {
    max++;
    const r = await fetch(`${base}/api/${recurso}/${x._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ codigo: String(max) }),
    });
    console.log(`${recurso} ${x.nombre} -> ${max} (${r.status})`);
  }
  if (sinCodigo.length === 0) console.log(`${recurso}: todos con código`);
}
