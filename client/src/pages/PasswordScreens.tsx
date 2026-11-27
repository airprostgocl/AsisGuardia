import { useState, type ReactNode } from "react";
import { KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const MIN = 8;

function Shell({ eyebrow, title, copy, children }: { eyebrow: string; title: string; copy: string; children: ReactNode }) {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-brand"><span className="brand-mark"><ShieldCheck size={24} /></span><span>guardia<strong>flow</strong></span></div>
        <p className="eyebrow teal">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="login-copy">{copy}</p>
        {children}
      </section>
    </main>
  );
}

/** Valida la nueva contraseña y su confirmación; devuelve el mensaje de error o null. */
function passwordProblem(password: string, confirm: string) {
  if (password.length < MIN) return `Mínimo ${MIN} caracteres.`;
  if (confirm && password !== confirm) return "Las contraseñas no coinciden.";
  return null;
}

export function ForgotPasswordScreen({ onBack }: { onBack: () => void }) {
  const [identifier, setIdentifier] = useState("");
  const request = trpc.auth.requestPasswordReset.useMutation();
  if (request.isSuccess) {
    return (
      <Shell eyebrow="RECUPERAR ACCESO" title="Revisa tu correo" copy="Si el usuario o correo corresponde a una cuenta con correo registrado, te enviamos un enlace para crear una nueva contraseña. Es válido por 1 hora.">
        <small className="login-note">¿No llega? Revisa la carpeta de spam o pide al administrador que restablezca tu contraseña.</small>
        <button className="primary login-button" onClick={onBack}>Volver al ingreso</button>
      </Shell>
    );
  }
  return (
    <Shell eyebrow="RECUPERAR ACCESO" title="¿Olvidaste tu contraseña?" copy="Escribe tu usuario o el correo registrado en tu cuenta. Te enviaremos un enlace para crear una nueva contraseña.">
      <form onSubmit={e => { e.preventDefault(); request.mutate({ identifier: identifier.trim() }); }}>
        <label>Usuario o correo<input autoComplete="username" value={identifier} onChange={e => setIdentifier(e.target.value)} placeholder="Ej. supervisor o nombre@correo.cl" /></label>
        {request.error && <p className="login-error">{request.error.message}</p>}
        <button className="primary login-button" disabled={request.isPending || identifier.trim().length < 2}><Mail size={17} />{request.isPending ? "Enviando…" : "Enviar enlace"}</button>
      </form>
      <button type="button" className="link-button" onClick={onBack}>Volver al ingreso</button>
    </Shell>
  );
}

export function ResetPasswordScreen({ token, onDone, welcome = false }: { token: string; onDone: () => void; welcome?: boolean }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const reset = trpc.auth.resetPassword.useMutation();
  const problem = passwordProblem(password, confirm);
  if (!token) {
    return <Shell eyebrow="RECUPERAR ACCESO" title="Enlace incompleto" copy="Abre el enlace exactamente como llegó en el correo, o solicita uno nuevo."><button className="primary login-button" onClick={onDone}>Ir al ingreso</button></Shell>;
  }
  if (reset.isSuccess) {
    return (
      <Shell eyebrow={welcome ? "BIENVENIDO A GUARDIAFLOW" : "RECUPERAR ACCESO"} title={welcome ? "Contraseña creada" : "Contraseña actualizada"} copy={`Ya puedes ingresar con tu usuario «${reset.data.username}» y tu ${welcome ? "" : "nueva "}contraseña.`}>
        <button className="primary login-button" onClick={onDone}>Ir al ingreso</button>
      </Shell>
    );
  }
  return (
    <Shell eyebrow={welcome ? "BIENVENIDO A GUARDIAFLOW" : "RECUPERAR ACCESO"} title={welcome ? "Crea tu contraseña" : "Crea una nueva contraseña"} copy={welcome ? `Tu cuenta de supervisor está lista. Elige una contraseña de al menos ${MIN} caracteres para ingresar.` : `Elige una contraseña de al menos ${MIN} caracteres.`}>
      <form onSubmit={e => { e.preventDefault(); reset.mutate({ token, newPassword: password }); }}>
        <label>Nueva contraseña<input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label>Repite la nueva contraseña<input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
        {(reset.error || (password && problem)) && <p className="login-error">{reset.error?.message || problem}</p>}
        <button className="primary login-button" disabled={reset.isPending || !!problem || password !== confirm}><KeyRound size={17} />{reset.isPending ? "Guardando…" : "Guardar contraseña"}</button>
      </form>
    </Shell>
  );
}

/** Se muestra tras ingresar con una contraseña temporal: no se puede usar la app hasta cambiarla. */
export function ForceChangePasswordScreen({ name }: { name: string }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const utils = trpc.useUtils();
  const change = trpc.auth.changePassword.useMutation({
    onSuccess: async () => { toast.success("Contraseña actualizada"); await utils.auth.me.invalidate(); },
  });
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => utils.auth.me.invalidate() });
  const problem = passwordProblem(password, confirm);
  return (
    <Shell eyebrow="PRIMER INGRESO" title={`Hola, ${name}`} copy="Estás usando una contraseña temporal. Antes de continuar, crea tu propia contraseña.">
      <form onSubmit={e => { e.preventDefault(); change.mutate({ currentPassword: current, newPassword: password }); }}>
        <label>Contraseña temporal<input type="password" autoComplete="current-password" value={current} onChange={e => setCurrent(e.target.value)} placeholder="La que te entregó el administrador" /></label>
        <label>Nueva contraseña<input type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} /></label>
        <label>Repite la nueva contraseña<input type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} /></label>
        {(change.error || (password && problem)) && <p className="login-error">{change.error?.message || problem}</p>}
        <button className="primary login-button" disabled={change.isPending || !current || !!problem || password !== confirm}><LockKeyhole size={17} />{change.isPending ? "Guardando…" : "Guardar y continuar"}</button>
      </form>
      <button type="button" className="link-button" onClick={() => logout.mutate()}>Cerrar sesión</button>
    </Shell>
  );
}
