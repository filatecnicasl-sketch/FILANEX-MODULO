// Lista ligera de clientes compartida por todos los selectores del programa.
// Con carteras de miles de fichas, bajar la lista en cada pantalla hacía
// esperar en cada navegación: aquí se pide UNA vez y se reutiliza entre
// pantallas durante 3 minutos (o hasta que se crea/edita un cliente).

let cache = null;
let enCurso = null;
const TTL = 3 * 60 * 1000;

export function cargarClientesLigeros() {
  if (cache && Date.now() - cache.momento < TTL) return Promise.resolve(cache.lista);
  if (enCurso) return enCurso;
  enCurso = fetch("/api/clientes")
    .then((r) => (r.ok ? r.json() : []))
    .then((lista) => {
      cache = { lista: Array.isArray(lista) ? lista : [], momento: Date.now() };
      return cache.lista;
    })
    .catch(() => [])
    .finally(() => {
      enCurso = null;
    });
  return enCurso;
}

// Se llama al crear, editar o borrar un cliente para que la próxima pantalla
// vea los datos frescos en vez de la copia en caché.
export function invalidarClientesLigeros() {
  cache = null;
}
