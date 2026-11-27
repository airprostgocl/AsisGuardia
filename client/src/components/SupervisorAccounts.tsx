import { useEffect, useState } from "react";
import { KeyRound, Save, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const MIN = 8;

type Supervisor = { id: number; name: string; username: string; email: string | null; isAdmin: boolean; mustChangePassword: boolean; active: boolean };

/** Datos propios (nombre, usuario, correo) y cambio de la contraseña propia. */
export function MyAccountCard({ supervisor }: { supervisor: Supervisor | null | undefined }) {
  const utils = trpc.useUtils();
  const [name, setName] = useState(supervisor?.name || "");
  const [username, setUsername] = useState(supervisor?.username || "");
  const [email, setEmail] = useState(supervisor?.email || "");
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  useEffect(() => { setName(supervisor?.name || ""); setUsername(supervisor?.username || ""); setEmail(supervisor?.email || ""); }, [supervisor?.id, supervisor?.name, supervisor?.username, supervisor?.email]);

  const save = trpc.operation.updateSupervisor.useMutation({
    onSuccess: async () => { toast.success("Cuenta actualizada"); await Promise.all([utils.auth.me.invalidate(), utils.operation.snapshot.invalidate(), utils.supervisors.list.invalidate()]); },
    onError: e => toast.error(e.message),
  });
  const change = trpc.auth.changePassword.useMutation({
    onSuccess: () => { toast.success("Contraseña actualizada", { description: "Tus otras sesiones abiertas se cerraron." }); setCurrent(""); setNext(""); },
    onError: e => toast.error(e.message),
  });

  return (
    <div className="admin-card">
      <h3>Mi cuenta de supervisor</h3>
      <div className="admin-form-stack">
        <input placeholder="Nombre completo" value={name} onChange={e => setName(e.target.value)} />
        <input placeholder="Usuario de acceso" value={username} onChange={e => setUsername(e.target.value)} />
        <input type="email" placeholder="Correo (para recuperar la contraseña)" value={email} onChange={e => setEmail(e.target.value)} />
        <button className="primary" disabled={save.isPending || !name.trim() || username.trim().length < 2} onClick={() => save.mutate({ name: name.trim(), username: username.trim(), email: email.trim() || null })}><Save size={15} /> Guardar mis datos</button>
      </div>
      <h3 className="admin-subtitle">Cambiar mi contraseña</h3>
      <div className="admin-form-stack">
        <input type="password" autoComplete="current-password" placeholder="Contraseña actual" value={current} onChange={e => setCurrent(e.target.value)} />
        <input type="password" autoComplete="new-password" placeholder={`Nueva contraseña (mín. ${MIN} caracteres)`} value={next} onChange={e => setNext(e.target.value)} />
        <button className="outline" disabled={change.isPending || !current || next.length < MIN} onClick={() => change.mutate({ currentPassword: current, newPassword: next })}><KeyRound size={15} /> Cambiar contraseña</button>
      </div>
      {!supervisor?.email && <small className="admin-help">Registra tu correo para poder recuperar la contraseña si la olvidas.</small>}
    </div>
  );
}

/** Solo para el administrador: crear, editar, desactivar y restablecer supervisores. */
export function SupervisorAdminCard({ currentId }: { currentId: number }) {
  const utils = trpc.useUtils();
  const list = trpc.supervisors.list.useQuery();
  const refresh = () => utils.supervisors.list.invalidate();
  const [form, setForm] = useState({ name: "", username: "", email: "", temporaryPassword: "" });
  const [editing, setEditing] = useState<{ id: number; name: string; username: string; email: string } | null>(null);

  const invite = trpc.supervisors.sendInvite.useMutation({
    onSuccess: r => r.sent ? toast.success("Invitación enviada", { description: `Correo enviado a ${r.email} con un enlace para crear su contraseña (válido 72 h).` }) : toast.error("No se pudo enviar la invitación", { description: r.reason }),
    onError: e => toast.error(e.message),
  });
  const create = trpc.supervisors.create.useMutation({
    onSuccess: async x => { if (!x.invite) toast.success("Supervisor creado", { description: `Entrega a ${x.name} su usuario «${x.username}» y la contraseña temporal. Deberá cambiarla al ingresar.` }); else if (x.invite.sent) toast.success("Supervisor creado e invitado", { description: `Se envió a ${x.invite.email} un correo con su usuario «${x.username}» y un enlace para crear su contraseña (válido 72 h).` }); else toast.error("Supervisor creado, pero no se pudo enviar la invitación", { description: `${x.invite.reason}. Usa «Enviar invitación» más tarde o «Restablecer contraseña» con una temporal.`, duration: 12000 }); setForm({ name: "", username: "", email: "", temporaryPassword: "" }); await refresh(); },
    onError: e => toast.error(e.message),
  });
  const update = trpc.supervisors.update.useMutation({ onSuccess: async () => { toast.success("Supervisor actualizado"); setEditing(null); await refresh(); }, onError: e => toast.error(e.message) });
  const setActive = trpc.supervisors.setActive.useMutation({ onSuccess: async x => { toast.success(x.active ? "Cuenta reactivada" : "Cuenta desactivada"); await refresh(); }, onError: e => toast.error(e.message) });
  const reset = trpc.supervisors.resetPassword.useMutation({ onSuccess: async x => { toast.success("Contraseña restablecida", { description: `${x.name} deberá cambiarla al ingresar.` }); await refresh(); }, onError: e => toast.error(e.message) });

  const askReset = (s: Supervisor) => {
    const temporaryPassword = window.prompt(`Nueva contraseña temporal para ${s.name} (mín. ${MIN} caracteres). Deberá cambiarla al ingresar.`);
    if (temporaryPassword === null) return;
    if (temporaryPassword.length < MIN) { toast.error(`La contraseña temporal debe tener al menos ${MIN} caracteres`); return; }
    reset.mutate({ id: s.id, temporaryPassword });
  };
  const toggleActive = (s: Supervisor) => {
    if (s.active && !window.confirm(`¿Desactivar la cuenta de ${s.name}? No podrá ingresar hasta que la reactives.`)) return;
    setActive.mutate({ id: s.id, active: !s.active });
  };

  const hasEmail = /\S+@\S+\.\S+/.test(form.email.trim());
  const valid = form.name.trim().length >= 2 && form.username.trim().length >= 2 && (form.temporaryPassword.length >= MIN || (hasEmail && !form.temporaryPassword));

  return (
    <div className="admin-card supervisor-admin-card">
      <h3>Administrar supervisores</h3>
      <p className="admin-help">Solo tú, como administrador, ves esta sección. Las contraseñas no se muestran nunca. Si indicas su correo y dejas la contraseña temporal vacía, recibirá un correo de bienvenida para crearla; si no, asígnale una temporal y la cambiará en su primer ingreso.</p>
      <div className="form-grid">
        <label>Nombre completo<input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Ej. Juan Pérez" /></label>
        <label>Usuario<input value={form.username} onChange={e => setForm({ ...form, username: e.target.value })} placeholder="Ej. jperez" /></label>
        <label>Correo <span className="optional-label">(opcional · para recuperar la contraseña)</span><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="nombre@correo.cl" /></label>
        <label>Contraseña temporal<input type="text" autoComplete="off" value={form.temporaryPassword} onChange={e => setForm({ ...form, temporaryPassword: e.target.value })} placeholder={hasEmail ? "Vacía = se envía invitación por correo" : `Mín. ${MIN} caracteres`} /></label>
      </div>
      <button className="primary" disabled={create.isPending || !valid} onClick={() => create.mutate({ name: form.name.trim(), username: form.username.trim(), email: form.email.trim() || null, temporaryPassword: form.temporaryPassword || undefined })}><UserPlus size={15} /> {create.isPending ? "Creando…" : "Crear supervisor"}</button>

      <div className="site-list supervisor-list">
        {list.isLoading && <small>Cargando supervisores…</small>}
        {list.error && <small className="login-error">{list.error.message}</small>}
        {(list.data || []).map(s => editing?.id === s.id ? (
          <div className="site-row" key={s.id}>
            <div className="admin-form-stack">
              <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} placeholder="Nombre completo" />
              <input value={editing.username} onChange={e => setEditing({ ...editing, username: e.target.value })} placeholder="Usuario" />
              <input type="email" value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} placeholder="Correo (opcional)" />
            </div>
            <div>
              <button className="primary" disabled={update.isPending || editing.name.trim().length < 2 || editing.username.trim().length < 2} onClick={() => update.mutate({ id: editing.id, name: editing.name.trim(), username: editing.username.trim(), email: editing.email.trim() || null })}>Guardar</button>
              <button className="outline" onClick={() => setEditing(null)}>Cancelar</button>
            </div>
          </div>
        ) : (
          <div className={`site-row ${!s.active ? "archived" : ""}`} key={s.id}>
            <div>
              <b>{s.name}{s.isAdmin ? " · Administrador" : ""}{s.id === currentId ? " (tú)" : ""}</b>
              <span>Usuario: {s.username} · {s.email || "sin correo"} · {s.active ? "Activo" : "Desactivado"}{s.mustChangePassword ? " · Contraseña temporal pendiente" : ""}</span>
            </div>
            <div>
              <button className="outline" onClick={() => setEditing({ id: s.id, name: s.name, username: s.username, email: s.email || "" })}>Editar</button>
              {!s.isAdmin && s.email && s.active && <button className="outline" disabled={invite.isPending} onClick={() => invite.mutate({ id: s.id })} title="Envía un correo con un enlace para crear su contraseña (72 h)">Enviar invitación</button>}
              {!s.isAdmin && <button className="outline" onClick={() => askReset(s)}>Restablecer contraseña</button>}
              {!s.isAdmin && <button className={s.active ? "danger-button" : "outline"} onClick={() => toggleActive(s)}>{s.active ? "Desactivar" : "Reactivar"}</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
