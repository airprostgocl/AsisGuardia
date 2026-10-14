import crypto from "node:crypto";

const COOKIE = "guardiaflow_session";
const secret = () => process.env.MANUS_JWT_SECRET || process.env.DATABASE_URL || "guardiaflow-development-secret";

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, expected] = stored.split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, "hex");
  return expectedBuffer.length === actual.length && crypto.timingSafeEqual(actual, expectedBuffer);
}

export function createLocalSession(supervisorId: number) {
  const payload = Buffer.from(JSON.stringify({ supervisorId, exp: Date.now() + 1000 * 60 * 60 * 12 })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function readLocalSession(token?: string | string[]) {
  if (!token || Array.isArray(token)) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return data.exp > Date.now() ? { supervisorId: Number(data.supervisorId) } : null;
  } catch { return null; }
}

export const localSessionCookie = { name: COOKIE, options: { httpOnly: true, path: "/", sameSite: "none" as const, secure: true } };
