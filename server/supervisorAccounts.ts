import crypto from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import { passwordResetTokens, supervisors, type Supervisor } from "../drizzle/schema";
import { getDb } from "./db";
import { hashPassword, verifyPassword } from "./_core/localAuth";
import { sendPasswordResetEmail } from "./mailer";

export const MIN_PASSWORD_LENGTH = 8;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

/** Datos del supervisor que se pueden enviar al navegador (nunca el hash de la contraseña). */
export function publicSupervisor(s: Supervisor) {
  return {
    id: s.id,
    name: s.name,
    username: s.username,
    email: s.email,
    isAdmin: s.isAdmin,
    mustChangePassword: s.mustChangePassword,
    active: s.active,
    createdAt: s.createdAt,
  };
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

const normalizeUsername = (u: string) => u.trim().toLowerCase();
const normalizeEmail = (e?: string | null) => (e && e.trim() ? e.trim().toLowerCase() : null);
const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

function assertPassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) throw new Error(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres`);
}

/** Traduce errores de unicidad de Postgres a un mensaje claro. */
async function friendlyUnique<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const code = error?.code ?? error?.cause?.code;
    const detail = String(error?.detail ?? error?.cause?.detail ?? error?.message ?? "");
    if (code === "23505") {
      if (detail.includes("email")) throw new Error("Ese correo ya está registrado en otro supervisor");
      if (detail.includes("username")) throw new Error("Ese usuario ya existe; elige otro");
    }
    throw error;
  }
}

async function getById(id: number) {
  const db = await requireDb();
  const rows = await db.select().from(supervisors).where(eq(supervisors.id, id)).limit(1);
  if (!rows[0]) throw new Error("Supervisor no encontrado");
  return rows[0];
}

// ---------- Cuenta propia ----------

export async function updateOwnProfile(id: number, input: { name: string; username: string; email?: string | null }) {
  const db = await requireDb();
  await friendlyUnique(() =>
    db.update(supervisors)
      .set({ name: input.name.trim(), username: normalizeUsername(input.username), email: normalizeEmail(input.email) })
      .where(and(eq(supervisors.id, id), eq(supervisors.active, true))),
  );
  return publicSupervisor(await getById(id));
}

export async function changeOwnPassword(id: number, currentPassword: string, newPassword: string) {
  const db = await requireDb();
  const supervisor = await getById(id);
  if (!verifyPassword(currentPassword, supervisor.passwordHash)) throw new Error("La contraseña actual no es correcta");
  assertPassword(newPassword);
  if (currentPassword === newPassword) throw new Error("La nueva contraseña debe ser distinta de la actual");
  const passwordHash = hashPassword(newPassword);
  await db.update(supervisors).set({ passwordHash, mustChangePassword: false }).where(eq(supervisors.id, id));
  return { ...supervisor, passwordHash, mustChangePassword: false };
}

// ---------- Administración (solo el supervisor administrador) ----------

export async function listSupervisors() {
  const db = await requireDb();
  const rows = await db.select().from(supervisors).orderBy(asc(supervisors.id));
  return rows.map(publicSupervisor);
}

export async function adminCreateSupervisor(input: { name: string; username: string; email?: string | null; temporaryPassword: string }) {
  const db = await requireDb();
  assertPassword(input.temporaryPassword);
  const inserted = await friendlyUnique(() =>
    db.insert(supervisors).values({
      name: input.name.trim(),
      username: normalizeUsername(input.username),
      email: normalizeEmail(input.email),
      passwordHash: hashPassword(input.temporaryPassword),
      mustChangePassword: true,
      isAdmin: false,
      active: true,
    }).returning(),
  );
  return publicSupervisor(inserted[0]);
}

export async function adminUpdateSupervisor(id: number, input: { name: string; username: string; email?: string | null }) {
  const db = await requireDb();
  await friendlyUnique(() =>
    db.update(supervisors)
      .set({ name: input.name.trim(), username: normalizeUsername(input.username), email: normalizeEmail(input.email) })
      .where(eq(supervisors.id, id)),
  );
  return publicSupervisor(await getById(id));
}

export async function adminSetSupervisorActive(adminId: number, id: number, active: boolean) {
  const db = await requireDb();
  const target = await getById(id);
  if (target.id === adminId || target.isAdmin) throw new Error("No puedes desactivar la cuenta del administrador");
  await db.update(supervisors).set({ active }).where(eq(supervisors.id, id));
  return publicSupervisor(await getById(id));
}

export async function adminResetSupervisorPassword(adminId: number, id: number, temporaryPassword: string) {
  const db = await requireDb();
  if (id === adminId) throw new Error("Para tu propia cuenta usa «Cambiar mi contraseña»");
  assertPassword(temporaryPassword);
  await getById(id);
  await db.update(supervisors).set({ passwordHash: hashPassword(temporaryPassword), mustChangePassword: true }).where(eq(supervisors.id, id));
  await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(and(eq(passwordResetTokens.supervisorId, id), isNull(passwordResetTokens.usedAt)));
  return publicSupervisor(await getById(id));
}

// ---------- Recuperación por correo ----------

/**
 * Envía un enlace de recuperación si el usuario o correo corresponde a un supervisor activo con correo.
 * Siempre termina sin error visible para no revelar qué cuentas existen.
 */
export async function requestPasswordReset(identifier: string, appUrl: string) {
  const db = await requireDb();
  const value = identifier.trim().toLowerCase();
  const byEmail = value.includes("@");
  const rows = await db.select().from(supervisors)
    .where(and(byEmail ? eq(supervisors.email, value) : eq(supervisors.username, value), eq(supervisors.active, true)))
    .limit(1);
  const supervisor = rows[0];
  if (!supervisor?.email) return;

  await db.update(passwordResetTokens).set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.supervisorId, supervisor.id), isNull(passwordResetTokens.usedAt)));
  const token = crypto.randomBytes(32).toString("base64url");
  await db.insert(passwordResetTokens).values({
    supervisorId: supervisor.id,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
  });
  const link = `${appUrl.replace(/\/$/, "")}/restablecer?token=${encodeURIComponent(token)}`;
  try {
    await sendPasswordResetEmail(supervisor.email, supervisor.name, link);
  } catch (error) {
    console.error("[Mail] Error al enviar el correo de recuperación:", (error as Error).message);
  }
}

export async function resetPasswordWithToken(token: string, newPassword: string) {
  const db = await requireDb();
  assertPassword(newPassword);
  const rows = await db.select().from(passwordResetTokens).where(eq(passwordResetTokens.tokenHash, hashToken(token))).limit(1);
  const row = rows[0];
  if (!row || row.usedAt || row.expiresAt.getTime() < Date.now()) throw new Error("El enlace no es válido o ya expiró. Solicita uno nuevo.");
  const supervisor = await getById(row.supervisorId);
  if (!supervisor.active) throw new Error("La cuenta está desactivada. Contacta al administrador.");
  await db.update(supervisors).set({ passwordHash: hashPassword(newPassword), mustChangePassword: false }).where(eq(supervisors.id, supervisor.id));
  await db.update(passwordResetTokens).set({ usedAt: new Date() })
    .where(and(eq(passwordResetTokens.supervisorId, supervisor.id), isNull(passwordResetTokens.usedAt)));
  return { username: supervisor.username };
}
