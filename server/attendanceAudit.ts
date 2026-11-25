import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { absenceTypes, attendanceHistory, attendanceRecords, supervisors } from "../drizzle/schema";
import { getDb, upsertAttendance } from "./db";

type MarkInput = { guardId: number; recordDate: string; absenceTypeId: number | null; notes?: string };

/**
 * Guarda la marcación (misma lógica de siempre) y deja constancia de quién la hizo.
 * Solo se agrega una fila al historial cuando la causa realmente cambia.
 */
export async function markAttendanceWithAudit(input: MarkInput, changedBy: number | null) {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  const prior = (await db.select().from(attendanceRecords)
    .where(and(eq(attendanceRecords.guardId, input.guardId), eq(attendanceRecords.recordDate, input.recordDate))).limit(1))[0];
  const result = await upsertAttendance(input);
  const newTypeId = input.absenceTypeId ?? null;
  const changed = !prior || (prior.absenceTypeId ?? null) !== newTypeId;
  if (changed) {
    await db.update(attendanceRecords).set({ registeredBy: changedBy })
      .where(and(eq(attendanceRecords.guardId, input.guardId), eq(attendanceRecords.recordDate, input.recordDate)));
    await db.insert(attendanceHistory).values({
      guardId: input.guardId,
      recordDate: input.recordDate,
      previousTypeId: prior?.absenceTypeId ?? null,
      previousMarked: Boolean(prior),
      newTypeId,
      changedBy,
    });
  }
  return result;
}

async function supervisorNames() {
  const db = await getDb();
  if (!db) return new Map<number, string>();
  const rows = await db.select({ id: supervisors.id, name: supervisors.name }).from(supervisors);
  return new Map(rows.map(r => [r.id, r.name]));
}

const dayKey = (v: unknown) => (typeof v === "string" ? v.slice(0, 10) : new Date(v as Date).toISOString().slice(0, 10));

/** Último autor de cada casilla en un rango de fechas (para el texto al pasar el cursor). */
export async function listMarkAuthors(start: string, end: string) {
  const db = await getDb();
  if (!db) return [];
  const [rows, names] = await Promise.all([
    db.select().from(attendanceHistory)
      .where(and(gte(attendanceHistory.recordDate, start), lte(attendanceHistory.recordDate, end)))
      .orderBy(asc(attendanceHistory.changedAt), asc(attendanceHistory.id)),
    supervisorNames(),
  ]);
  const latest = new Map<string, { guardId: number; recordDate: string; changedByName: string; changedAt: Date; changes: number }>();
  for (const r of rows) {
    const key = `${r.guardId}:${dayKey(r.recordDate)}`;
    const previous = latest.get(key);
    latest.set(key, {
      guardId: r.guardId,
      recordDate: dayKey(r.recordDate),
      changedByName: (r.changedBy && names.get(r.changedBy)) || "Supervisor desconocido",
      changedAt: r.changedAt,
      changes: (previous?.changes ?? 0) + 1,
    });
  }
  return Array.from(latest.values());
}

/** Historial completo de una casilla (guardia + fecha), del más reciente al más antiguo. */
export async function listMarkHistory(guardId: number, recordDate: string) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(attendanceHistory)
    .where(and(eq(attendanceHistory.guardId, guardId), eq(attendanceHistory.recordDate, recordDate)))
    .orderBy(desc(attendanceHistory.changedAt), desc(attendanceHistory.id));
  if (!rows.length) return [];
  const typeIds = Array.from(new Set(rows.flatMap(r => [r.previousTypeId, r.newTypeId]).filter((x): x is number => x !== null)));
  const [types, names] = await Promise.all([
    typeIds.length ? db.select().from(absenceTypes).where(inArray(absenceTypes.id, typeIds)) : Promise.resolve([]),
    supervisorNames(),
  ]);
  const typeLabel = (id: number | null, marked = true) => {
    if (!marked) return "Sin marcar";
    if (id === null) return "Presente";
    const t = types.find(x => x.id === id);
    return t ? `${t.code} · ${t.name}` : "Causa eliminada";
  };
  return rows.map(r => ({
    id: r.id,
    from: typeLabel(r.previousTypeId, r.previousMarked),
    to: typeLabel(r.newTypeId),
    changedByName: (r.changedBy && names.get(r.changedBy)) || "Supervisor desconocido",
    changedAt: r.changedAt,
  }));
}
