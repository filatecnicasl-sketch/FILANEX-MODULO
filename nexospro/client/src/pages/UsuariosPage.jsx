import { useEffect, useState } from "react";
import CabeceraPagina from "../components/CabeceraPagina.jsx";
import { Avatar, Badge, EstadoVacio } from "../components/ui.jsx";
import { IconEditar, IconBorrar } from "../components/icons.jsx";

const VACIO = { nombre: "", email: "", password: "", rol: "usuario" };

function ModalUsuario({ inicial, editando, onCerrar, onGuardado }) {
  const [form, setForm] = useState(inicial);
  const [error, setError] = useState(null);
  const [guardando, setGuardando] = useState(false);

  const poner = (campo) => (e) => setForm((f) => ({ ...f, [campo]: e.target.value }));

  async function guardar(e) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const r = await fetch(editando ? `/api/usuarios/${editando}` : "/api/usuarios", {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo guardar");
      onGuardado();
    } catch (err) {
      setError(err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCerrar}>
      <div className="modal-panel w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-white mb-4">
          {editando ? `Editar ${inicial.nombre}` : "Nuevo usuario"}
        </h2>
        <form onSubmit={guardar} className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 block mb-1">Nombre</label>
            <input value={form.nombre} onChange={poner("nombre")} className="input" autoFocus />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Email</label>
            <input type="email" value={form.email} onChange={poner("email")} className="input" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-slate-400 block mb-1">
                {editando ? "Nueva contraseña (opcional)" : "Contraseña"}
              </label>
              <input
                type="password"
                value={form.password}
                onChange={poner("password")}
                className="input"
                placeholder={editando ? "Vacía = no cambiar" : "Mínimo 6 caracteres"}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="text-sm text-slate-400 block mb-1">Rol</label>
              <select value={form.rol} onChange={poner("rol")} className="input">
                <option value="usuario">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          </div>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onCerrar} className="btn-ghost">Cancelar</button>
            <button type="submit" disabled={guardando} className="btn-primary">
              {guardando ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function UsuariosPage() {
  const [lista, setLista] = useState(null);
  const [modal, setModal] = useState(null); // { inicial, editando }
  const [error, setError] = useState(null);

  const cargar = () =>
    fetch("/api/usuarios")
      .then((r) => r.json())
      .then(setLista)
      .catch(() => setError("No se pudo conectar con la API."));

  useEffect(() => { cargar(); }, []);

  async function borrar(u) {
    if (!window.confirm(`¿Eliminar al usuario ${u.nombre}?`)) return;
    setError(null);
    try {
      const r = await fetch(`/api/usuarios/${u._id}`, { method: "DELETE" });
      const datos = await r.json();
      if (!r.ok) throw new Error(datos.error || "No se pudo eliminar");
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <>
      <CabeceraPagina
        titulo="Usuarios"
        contador={lista?.length}
        descripcion="Cuentas de acceso al programa. Las contraseñas se guardan cifradas."
      >
        <button
          className="btn-primary"
          onClick={() => setModal({ inicial: VACIO, editando: null })}
        >
          Nuevo usuario
        </button>
      </CabeceraPagina>

      {error && <p className="text-sm text-red-400 mb-4">{error}</p>}

      {!lista ? null : lista.length === 0 ? (
        <EstadoVacio
          titulo="Sin usuarios"
          descripcion="Crea el primer usuario administrador para preparar el acceso multiusuario."
        />
      ) : (
        <div className="panel overflow-x-auto max-w-4xl">
          <table className="tabla">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Rol</th>
                <th>Alta</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((u) => (
                <tr key={u._id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Avatar nombre={u.nombre} />
                      <div className="min-w-0">
                        <p className="font-semibold text-white leading-tight">{u.nombre}</p>
                        <p className="text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge tono={u.rol === "admin" ? "cyan" : "slate"}>
                      {u.rol === "admin" ? "Administrador" : "Usuario"}
                    </Badge>
                  </td>
                  <td className="text-slate-400 whitespace-nowrap">
                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString("es-ES") : "—"}
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <button
                      className="p-1.5 text-slate-400 hover:text-accent transition-colors"
                      title="Editar"
                      onClick={() =>
                        setModal({
                          inicial: { nombre: u.nombre, email: u.email, password: "", rol: u.rol },
                          editando: u._id,
                        })
                      }
                    >
                      <IconEditar />
                    </button>
                    <button
                      className="p-1.5 text-slate-400 hover:text-rose-400 transition-colors"
                      title="Eliminar"
                      onClick={() => borrar(u)}
                    >
                      <IconBorrar />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <ModalUsuario
          inicial={modal.inicial}
          editando={modal.editando}
          onCerrar={() => setModal(null)}
          onGuardado={() => {
            setModal(null);
            cargar();
          }}
        />
      )}
    </>
  );
}
