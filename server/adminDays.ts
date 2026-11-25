import { and, eq, gte, lte } from "drizzle-orm";
import { absenceTypes, attendanceRecords, guards } from "../drizzle/schema";
import { getDb } from "./db";

/** Días administrativos (permiso con goce de sueldo) que corresponden a cada guardia por año. */
export const ADMIN_DAYS_PER_YEAR = 6;
export const ADMIN_DAY_CODE = "A";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m: number, d: number) => `${y}-${pad(m)}-${pad(d)}`;
const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

function anniversaryIn(year: number, month: number, day: number) {
  return month === 2 && day === 29 && !isLeap(year) ? iso(year, 2, 28) : iso(year, month, day);
}

/**
 * Período anual vigente según la fecha de ingreso: desde el último aniversario (inclusive)
 * hasta el día anterior al siguiente. Sin fecha de ingreso se usa el año calendario.
 */
export function anniversaryPeriod(hireDate: string | null | undefined, asOf: string) {
  const [ay] = asOf.split("-").map(Number);
  if (!hireDate) return { start: iso(ay, 1, 1), end: iso(ay, 12, 31) };
  const hire = hireDate.slice(0, 10);
  const [, hm, hd] = hire.split("-").map(Number);
  let startYear = ay;
  if (anniversaryIn(ay, hm, hd) > asOf) startYear -= 1;
  let start = anniversaryIn(startYear, hm, hd);
  if (start < hire) start = hire; // ingreso futuro o en el mismo período
  const next = anniversaryIn(Number(start.slice(0, 4)) + 1, hm, hd);
  const endDate = new Date(`${next}T00:00:00Z`);
  endDate.setUTCDate(endDate.getUTCDate() - 1);
  return { start, end: endDate.toISOString().slice(0, 10) };
}

const dayKey = (v: unknown) => (typeof v === "string" ? v.slice(0, 10) : new Date(v as Date).toISOString().slice(0, 10));

/** Saldo de días administrativos de cada guardia en su período vigente a la fecha `asOf`. */
export async function adminDaysSummary(asOf: string) {
  const db = await getDb();
  if (!db) return [];
  const type = (await db.select().from(absenceTypes).where(eq(absenceTypes.code, ADMIN_DAY_CODE)).limit(1))[0];
  const guardRows = await db.select({ id: guards.id, hireDate: guards.hireDate }).from(guards).where(eq(guards.active, true));
  const [y, m, d] = asOf.split("-").map(Number);
  const from = iso(y - 1, m, d), to = iso(y + 1, m, d);
  const records = type
    ? await db.select({ guardId: attendanceRecords.guardId, recordDate: attendanceRecords.recordDate }).from(attendanceRecords)
        .where(and(eq(attendanceRecords.absenceTypeId, type.id), gte(attendanceRecords.recordDate, from), lte(attendanceRecords.recordDate, to)))
    : [];
  return guardRows.map(g => {
    const period = anniversaryPeriod(g.hireDate ? dayKey(g.hireDate) : null, asOf);
    const used = records.filter(r => r.guardId === g.id && dayKey(r.recordDate) >= period.start && dayKey(r.recordDate) <= period.end).length;
    return { guardId: g.id, used, total: ADMIN_DAYS_PER_YEAR, left: ADMIN_DAYS_PER_YEAR - used, periodStart: period.start, periodEnd: period.end };
  });
}
