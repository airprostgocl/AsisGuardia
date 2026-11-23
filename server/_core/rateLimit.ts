import { TRPCError } from "@trpc/server";
import type { Request } from "express";

/** Límite simple en memoria: máximo `max` intentos por clave dentro de `windowMs`. */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function clientIp(req: Request) {
  const forwarded = req.headers["x-forwarded-for"];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(",")[0]?.trim();
  return first || req.socket?.remoteAddress || "unknown";
}

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.resetAt < now) buckets.delete(k);
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  bucket.count += 1;
  if (bucket.count > max) {
    const minutes = Math.ceil((bucket.resetAt - now) / 60_000);
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: `Demasiados intentos. Vuelve a intentarlo en ${minutes} min.` });
  }
}
