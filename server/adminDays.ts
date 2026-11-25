import { and, eq, gte, lte } from "drizzle-orm";
import { absenceTypes, attendanceRecords, guards } from "../drizzle/schema";
import { getDb } from "./db";

/** Días administrativos (permiso con goce de sueldo): 6 por guardia en cada año calendario. */
export const ADMIN_DAYS_PER_YEAR = 6;
export const ADMIN_DAY_CODE = "A";

const dayKey = (v: unknown) => (typeof v === "string" ? v.slice(0, 10) : new Date(v as Date).toISOString().slice(0, 10));

/** Año calendario (1 de enero al 31 de diciembre) que contiene la fecha. */
export function calendarYearPeriod(date: string) {
  const year = date.slice(0, 4);
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

/** Cuenta días administrativos ya usados en el año y en el mes de `date`, sin contar ese mismo día. */
export function countAdminDays(usedDates: string[], date: string) {
  const others = usedDates.map(d => d.slice(0, 10)).filter(d => d !== date);
  return {
    yearUsed: others.filter(d => d.slice(0, 4) === date.slice(0, 4)).length,
    monthUsed: others.filter(d => d.slice(0, 7) === date.slice(0, 7)).length,
  };
}

async function adminTypeId() {
  const db = await getDb();
  if (!db) return null;
  return (await db.select({ id: absenceTypes.id }).from(absenceTypes).where(eq(absenceTypes.code, ADMIN_DAY_CODE)).limit(1))[0]?.id ?? null;
}

/** Fechas con día administrativo de un guardia dentro del año de `date`. */
async function adminDatesInYear(guardId: number, date: string) {
  const db = await getDb();
  const typeId = await adminTypeId();
  if (!db || !typeId) return [];
  const { start, end } = calendarYearPeriod(date);
  const rows = await db.select({ recordDate: attendanceRecords.recordDate }).from(attendanceRecords)
    .where(and(eq(attendanceRecords.guardId, guardId), eq(attendanceRecords.absenceTypeId, typeId), gte(attendanceRecords.recordDate, start), lte(attendanceRecords.recordDate, end)));
  return rows.map(r => dayKey(r.recordDate));
}

/** Situación de un guardia antes de registrar un día administrativo en `date`. */
export async function adminDayCheck(guardId: number, date: string) {
  const counts = countAdminDays(await adminDatesInYear(guardId, date), date);
  return { ...counts, total: ADMIN_DAYS_PER_YEAR, year: Number(date.slice(0, 4)), allowed: counts.yearUsed < ADMIN_DAYS_PER_YEAR };
}

/** Regla obligatoria: no se pueden registrar más de 6 días administrativos en el año calendario. */
export async function assertAdminDayAllowed(guardId: number, date: string, absenceTypeId: number | null) {
  if (!absenceTypeId || absenceTypeId !== (await adminTypeId())) return;
  const check = await adminDayCheck(guardId, date);
  if (!check.allowed) throw new Error(`Este guardia ya usó sus ${ADMIN_DAYS_PER_YEAR} días administrativos de ${check.year}. No se pueden registrar más.`);
}

/** Saldo de días administrativos de cada guardia en el año calendario de `asOf`. */
export async function adminDaysSummary(asOf: string) {
  const db = await getDb();
  if (!db) return [];
  const typeId = await adminTypeId();
  const { start, end } = calendarYearPeriod(asOf);
  const guardRows = await db.select({ id: guards.id }).from(guards).where(eq(guards.active, true));
  const records = typeId
    ? await db.select({ guardId: attendanceRecords.guardId }).from(attendanceRecords)
        .where(and(eq(attendanceRecords.absenceTypeId, typeId), gte(attendanceRecords.recordDate, start), lte(attendanceRecords.recordDate, end)))
    : [];
  return guardRows.map(g => {
    const used = records.filter(r => r.guardId === g.id).length;
    return { guardId: g.id, used, total: ADMIN_DAYS_PER_YEAR, left: ADMIN_DAYS_PER_YEAR - used, periodStart: start, periodEnd: end };
  });
}
