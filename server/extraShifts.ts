import { and, asc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { absenceTypes, attendanceRecords, companies, extraShifts, guards } from "../drizzle/schema";
import { getDb } from "./db";

export const SHIFTS = ["dia", "noche"] as const;
export type Shift = (typeof SHIFTS)[number];

const dayKey = (v: unknown) => (typeof v === "string" ? v.slice(0, 10) : new Date(v as Date).toISOString().slice(0, 10));

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

/** Días extra en un rango de fechas (para la tabla semanal, la ventana y los reportes). */
export async function listExtras(start: string, end: string) {
  const db = await requireDb();
  const rows = await db.select().from(extraShifts)
    .where(and(gte(extraShifts.shiftDate, start), lte(extraShifts.shiftDate, end)))
    .orderBy(asc(extraShifts.shiftDate), asc(extraShifts.shift));
  return rows.map(r => ({ id: r.id, guardId: r.guardId, date: dayKey(r.shiftDate), shift: r.shift as Shift, companyId: r.companyId, replacedGuardId: r.replacedGuardId }));
}

/** Fechas en que el guardia tiene una ausencia registrada (no puede hacer extras esos días). */
async function absenceDates(guardId: number, dates: string[]) {
  const db = await requireDb();
  if (!dates.length) return new Map<string, string>();
  const rows = await db.select({ recordDate: attendanceRecords.recordDate, code: absenceTypes.code, name: absenceTypes.name })
    .from(attendanceRecords)
    .innerJoin(absenceTypes, eq(absenceTypes.id, attendanceRecords.absenceTypeId))
    .where(and(eq(attendanceRecords.guardId, guardId), inArray(attendanceRecords.recordDate, dates), isNotNull(attendanceRecords.absenceTypeId)));
  return new Map(rows.map(r => [dayKey(r.recordDate), `${r.code} · ${r.name}`]));
}

/**
 * Asigna (o reasigna) uno o varios días extra de un guardia a una empresa y turno.
 * Si el día ya tenía extra en ese turno, se cambia la empresa. Los días con ausencia se rechazan.
 */
export async function assignExtras(input: { guardId: number; dates: string[]; shift: Shift; companyId: number; replacedGuardId?: number | null }, createdBy: number | null) {
  const db = await requireDb();
  const dates = Array.from(new Set(input.dates.map(d => d.slice(0, 10)))).sort();
  if (!dates.length) throw new Error("Selecciona al menos un día");
  if (input.replacedGuardId && input.replacedGuardId === input.guardId) throw new Error("Un guardia no puede reemplazarse a sí mismo");
  const [guard] = await db.select({ id: guards.id }).from(guards).where(eq(guards.id, input.guardId)).limit(1);
  if (!guard) throw new Error("Guardia no encontrado");
  const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, input.companyId)).limit(1);
  if (!company) throw new Error("Empresa no encontrada");

  const absences = await absenceDates(input.guardId, dates);
  const blocked = dates.filter(d => absences.has(d)).map(d => ({ date: d, reason: absences.get(d)! }));
  const allowed = dates.filter(d => !absences.has(d));
  for (const date of allowed) {
    await db.insert(extraShifts)
      .values({ guardId: input.guardId, shiftDate: date, shift: input.shift, companyId: input.companyId, replacedGuardId: input.replacedGuardId ?? null, createdBy })
      .onConflictDoUpdate({ target: [extraShifts.guardId, extraShifts.shiftDate, extraShifts.shift], set: { companyId: input.companyId, replacedGuardId: input.replacedGuardId ?? null, createdBy } });
  }
  return { saved: allowed, blocked };
}

/** Elimina días extra por id. */
export async function removeExtras(ids: number[]) {
  const db = await requireDb();
  if (!ids.length) return { removed: 0 };
  await db.delete(extraShifts).where(inArray(extraShifts.id, ids));
  return { removed: ids.length };
}
