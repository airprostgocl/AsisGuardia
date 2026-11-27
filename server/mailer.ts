import nodemailer from "nodemailer";

/**
 * Envío de correos por SMTP (por defecto Gmail con "contraseña de aplicación").
 * Variables: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM.
 */
let transporter: nodemailer.Transporter | null = null;

export function isMailConfigured() {
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
}

function getTransporter() {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT || 465);
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export async function sendPasswordResetEmail(to: string, name: string, link: string) {
  if (!isMailConfigured()) {
    console.warn("[Mail] SMTP_USER/SMTP_PASS no configurados: no se envió el correo de recuperación.");
    return false;
  }
  const from = process.env.MAIL_FROM || `GuardiaFlow <${process.env.SMTP_USER}>`;
  const safeName = escapeHtml(name);
  await getTransporter().sendMail({
    from,
    to,
    subject: "GuardiaFlow · Restablecer contraseña",
    text: `Hola ${name},\n\nRecibimos una solicitud para restablecer tu contraseña de GuardiaFlow.\nAbre este enlace (válido por 1 hora, un solo uso):\n\n${link}\n\nSi no lo solicitaste, ignora este correo: tu contraseña no cambiará.`,
    html: `<p>Hola ${safeName},</p><p>Recibimos una solicitud para restablecer tu contraseña de GuardiaFlow.</p><p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#16745f;color:#fff;border-radius:8px;text-decoration:none">Restablecer contraseña</a></p><p style="color:#666;font-size:13px">El enlace es válido por 1 hora y se puede usar una sola vez. Si no lo solicitaste, ignora este correo: tu contraseña no cambiará.</p>`,
  });
  return true;
}

/** Correo de bienvenida para un supervisor nuevo, con enlace para crear su contraseña. */
export async function sendWelcomeEmail(to: string, name: string, username: string, link: string, appUrl: string) {
  if (!isMailConfigured()) {
    console.warn("[Mail] SMTP_USER/SMTP_PASS no configurados: no se envió la invitación.");
    return false;
  }
  const from = process.env.MAIL_FROM || `GuardiaFlow <${process.env.SMTP_USER}>`;
  await getTransporter().sendMail({
    from,
    to,
    subject: "Bienvenido a GuardiaFlow · crea tu contraseña",
    text: `Hola ${name},\n\nSe creó tu cuenta de supervisor en GuardiaFlow.\n\nDirección: ${appUrl}\nUsuario: ${username}\n\nCrea tu contraseña con este enlace (válido por 72 horas, un solo uso):\n${link}\n\nSi no esperabas este correo, ignóralo.`,
    html: `<p>Hola ${escapeHtml(name)},</p><p>Se creó tu cuenta de supervisor en <b>GuardiaFlow</b>.</p><p>Dirección: <a href="${escapeHtml(appUrl)}">${escapeHtml(appUrl)}</a><br>Usuario: <b>${escapeHtml(username)}</b></p><p><a href="${escapeHtml(link)}" style="display:inline-block;padding:10px 18px;background:#16745f;color:#fff;border-radius:8px;text-decoration:none">Crear mi contraseña</a></p><p style="color:#666;font-size:13px">El enlace es válido por 72 horas y se puede usar una sola vez. Si no esperabas este correo, ignóralo.</p>`,
  });
  return true;
}
