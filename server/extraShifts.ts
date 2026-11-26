import { and, asc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { absenceTypes, attendanceRecords, companies, extraShifts, guards, sites } from "../drizzle/schema";
import { getDb } from "./db";

/** Turnos: día, tarde y noche. Cada extra guarda su hora de inicio y duración reales. */
export const SHIFTS = ["dia", "tarde", "noche"] as const;
export type Shift = (typeof SHIFTS)[number];
export const BASE_SHIFTS = ["dia", "tarde", "noche"] as const;
export const SHIFT_DEFAULTS: Record<Shift, { start: string; hours: number; label: string }> = {
  dia: { start: "08:00", hours: 12, label: "Día" },
  tarde: { start: "14:00", hours: 8, label: "Tarde" },
  noche: { start: "20:00", hours: 12, label: "Noche" },
};
/** Descanso mínimo entre turnos antes de advertir (horas). */
export const MIN_REST_HOURS = 8;

const dayKey = (v: unknown) => (typeof v === "string" ? v.slice(0, 10) : new Date(v as Date).toISOString().slice(0, 10));
const dayIndex = (date: string) => Math.round(Date.parse(`${date}T00:00:00Z`) / 86_400_000);
const toMinutes = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const hhmm = (minutes: number) => { const m = ((minutes % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };

export type ShiftSlot = { date: string; shift: Shift; startTime: string; hours: number; label?: string };

/** Intervalo absoluto en minutos. Un turno que cruza la medianoche pertenece a la fecha en que empieza. */
export function interval(slot: ShiftSlot) {
  const start = dayIndex(slot.date) * 1440 + toMinutes(slot.startTime);
  return { start, end: start + slot.hours * 60 };
}

export function describe(slot: ShiftSlot) {
  const { start, end } = interval(slot);
  return `${SHIFT_DEFAULTS[slot.shift].label} ${hhmm(start)}–${hhmm(end)}`;
}

/**
 * Valida un turno nuevo contra otros turnos del mismo guardia.
 * Bloquea si se superponen; advierte si suman 24 horas seguidas o dejan menos de 8 horas de descanso.
 */
export function checkSlot(slot: ShiftSlot, others: ShiftSlot[]) {
  const a = interval(slot);
  const blocked: string[] = [];
  const warnings: string[] = [];
  for (const o of others) {
    const b = interval(o);
    if (a.start < b.end && b.start < a.end) { blocked.push(`se superpone con ${o.label ?? describe(o)}`); continue; }
    const gap = a.start >= b.end ? a.start - b.end : b.start - a.end;
    const span = Math.max(a.end, b.end) - Math.min(a.start, b.start);
    if (gap === 0 && span >= 24 * 60) warnings.push(`suma ${Math.round(span / 60)} horas seguidas con ${o.label ?? describe(o)}`);
    else if (gap < MIN_REST_HOURS * 60) warnings.push(`deja solo ${Math.round((gap / 60) * 10) / 10} h de descanso respecto de ${o.label ?? describe(o)}`);
  }
  return { blocked, warnings };
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("Database is not available");
  return db;
}

const mapRow = (r: typeof extraShifts.$inferSelect) => ({
  id: r.id, guardId: r.guardId, date: dayKey(r.shiftDate), shift: r.shift as Shift, startTime: r.startTime, hours: r.hours,
  companyId: r.companyId, replacedGuardId: r.replacedGuardId,
});

/** Días extra de todos los guardias en un rango (tabla semanal y reportes). */
export async function listExtras(start: string, end: string) {
  const db = await requireDb();
  const rows = await db.select().from(extraShifts)
    .where(and(gte(extraShifts.shiftDate, start), lte(extraShifts.shiftDate, end)))
    .orderBy(asc(extraShifts.shiftDate), asc(extraShifts.startTime));
  return rows.map(mapRow);
}

/** Fechas con ausencia registrada del guardia en un rango (no puede hacer extras esos días). */
async function absencesInRange(guardId: number, start: string, end: string) {
  const db = await requireDb();
  const rows = await db.select({ recordDate: attendanceRecords.recordDate, code: absenceTypes.code, name: absenceTypes.name })
    .from(attendanceRecords)
    .innerJoin(absenceTypes, eq(absenceTypes.id, attendanceRecords.absenceTypeId))
    .where(and(eq(attendanceRecords.guardId, guardId), gte(attendanceRecords.recordDate, start), lte(attendanceRecords.recordDate, end), isNotNull(attendanceRecords.absenceTypeId)));
  return rows.map(r => ({ date: dayKey(r.recordDate), label: `${r.code} · ${r.name}` }));
}

/** Datos para la ventana de Extras de un guardia: sus extras y sus ausencias en el rango. */
export async function guardExtrasContext(guardId: number, start: string, end: string) {
  const db = await requireDb();
  const [rows, absences] = await Promise.all([
    db.select().from(extraShifts).where(and(eq(extraShifts.guardId, guardId), gte(extraShifts.shiftDate, start), lte(extraShifts.shiftDate, end))).orderBy(asc(extraShifts.shiftDate), asc(extraShifts.startTime)),
    absencesInRange(guardId, start, end),
  ]);
  return { extras: rows.map(mapRow), absences };
}

/** Guardias con ausencia en alguna de las fechas indicadas (candidatos a ser reemplazados). */
export async function absentGuards(dates: string[]) {
  const db = await requireDb();
  if (!dates.length) return [];
  const rows = await db.select({ guardId: attendanceRecords.guardId, recordDate: attendanceRecords.recordDate, code: absenceTypes.code, name: absenceTypes.name })
    .from(attendanceRecords)
    .innerJoin(absenceTypes, eq(absenceTypes.id, attendanceRecords.absenceTypeId))
    .where(and(inArray(attendanceRecords.recordDate, dates), isNotNull(attendanceRecords.absenceTypeId)));
  const byGuard = new Map<number, { guardId: number; absences: { date: string; label: string }[] }>();
  for (const r of rows) {
    const g = byGuard.get(r.guardId) ?? { guardId: r.guardId, absences: [] };
    g.absences.push({ date: dayKey(r.recordDate), label: `${r.code} · ${r.name}` });
    byGuard.set(r.guardId, g);
  }
  return Array.from(byGuard.values());
}

const shiftDay = (date: string, delta: number) => new Date(Date.parse(`${date}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);

/**
 * Asigna (o reasigna) días extra a una empresa en un turno.
 * - Bloquea: días con ausencia propia y turnos que se superponen con otros extras.
 * - Bloquea también si el turno no es el del guardia ausente.
 * - Advierte (requiere `confirm`): 24 h seguidas, menos de 8 h de descanso, o ausencia ya cubierta (al confirmar,
 *   se sustituye al reemplazante anterior). El horario normal del propio guardia no se valida: lo conoce el supervisor.
 */
export async function assignExtras(input: {
  guardId: number; dates: string[]; shift: Shift; startTime: string; hours: number; companyId: number;
  replacedGuardId: number; confirm?: boolean;
}, createdBy: number | null) {
  const db = await requireDb();
  const dates = Array.from(new Set(input.dates.map(d => d.slice(0, 10)))).sort();
  if (!dates.length) throw new Error("Selecciona al menos un día");
  if (!input.replacedGuardId) throw new Error("Indica a qué guardia ausente reemplaza");
  if (input.replacedGuardId === input.guardId) throw new Error("Un guardia no puede reemplazarse a sí mismo");
  const [replaced] = await db.select({ id: guards.id, name: guards.name, baseShift: guards.baseShift, companyId: guards.companyId, siteId: guards.siteId }).from(guards).where(eq(guards.id, input.replacedGuardId)).limit(1);
  if (!replaced) throw new Error("Guardia reemplazado no encontrado");
  // El extra se hace en el puesto del ausente: misma empresa.
  let replacedCompanyId = replaced.companyId;
  if (!replacedCompanyId && replaced.siteId) replacedCompanyId = (await db.select({ companyId: sites.companyId }).from(sites).where(eq(sites.id, replaced.siteId)).limit(1))[0]?.companyId ?? null;
  if (replacedCompanyId && replacedCompanyId !== input.companyId) {
    const name = (await db.select({ name: companies.name }).from(companies).where(eq(companies.id, replacedCompanyId)).limit(1))[0]?.name ?? "su empresa";
    throw new Error(`${replaced.name} trabaja en ${name}: el extra debe hacerse en esa empresa`);
  }
  const [guard] = await db.select({ id: guards.id, name: guards.name, baseShift: guards.baseShift }).from(guards).where(eq(guards.id, input.guardId)).limit(1);
  if (!guard) throw new Error("Guardia no encontrado");
  const [company] = await db.select({ id: companies.id, name: companies.name }).from(companies).where(eq(companies.id, input.companyId)).limit(1);
  if (!company) throw new Error("Empresa no encontrada");

  const from = shiftDay(dates[0], -1), to = shiftDay(dates[dates.length - 1], 1);
  const { extras: existing, absences } = await guardExtrasContext(input.guardId, from, to);
  const absent = new Map(absences.map(a => [a.date, a.label]));
  // Ausencias del guardia reemplazado y reemplazos ya existentes para él en esas fechas.
  const replacedAbs = new Map((await absencesInRange(input.replacedGuardId, dates[0], dates[dates.length - 1])).map(a => [a.date, a.label]));
  const existingCover = await db.select().from(extraShifts).where(and(eq(extraShifts.replacedGuardId, input.replacedGuardId), inArray(extraShifts.shiftDate, dates)));
  const coverNames = new Map((await db.select({ id: guards.id, name: guards.name }).from(guards).where(inArray(guards.id, Array.from(new Set(existingCover.map(c => c.guardId))).concat(0)))).map(g => [g.id, g.name]));
  const blocked: { date: string; reason: string }[] = [];
  const warnings: { date: string; reason: string }[] = [];
  const allowed: string[] = [];
  const toRemove: number[] = []; // extras de reemplazantes anteriores que se sustituyen
  const planned: ShiftSlot[] = [];

  for (const date of dates) {
    let pendingRemove: number[] = [];
    let pendingWarn: { date: string; reason: string } | null = null;
    if (absent.has(date)) { blocked.push({ date, reason: `tiene ausencia registrada (${absent.get(date)})` }); continue; }
    if (!replacedAbs.has(date)) { blocked.push({ date, reason: `${replaced.name} no tiene ausencia registrada ese día: regístrala primero en Control semanal` }); continue; }
    if (replaced.baseShift && replaced.baseShift in SHIFT_DEFAULTS && replaced.baseShift !== input.shift) {
      blocked.push({ date, reason: `${replaced.name} trabaja de ${SHIFT_DEFAULTS[replaced.baseShift as Shift].label.toLowerCase()}: el extra debe ser de ${SHIFT_DEFAULTS[replaced.baseShift as Shift].label.toLowerCase()}` });
      continue;
    }
    const coveredBy = existingCover.filter(c => dayKey(c.shiftDate) === date && !(c.guardId === input.guardId && c.shift === input.shift));
    if (coveredBy.length) {
      pendingWarn = ({ date, reason: `${replaced.name} ya tiene reemplazo ese día (${coveredBy.map(c => `${coverNames.get(c.guardId) ?? "otro guardia"}, ${SHIFT_DEFAULTS[c.shift as Shift]?.label ?? c.shift}`).join("; ")}). Al confirmar, se cambia por el nuevo reemplazante y se quita el extra anterior` });
      pendingRemove = coveredBy.map(c => c.id);
    }
    // Modificar un extra que el guardia ya tenía ese día en el mismo turno: se pide confirmar.
    const same = existing.find(e => e.date === date && e.shift === input.shift);
    let changeWarn: { date: string; reason: string } | null = null;
    if (same && (same.companyId !== input.companyId || same.replacedGuardId !== input.replacedGuardId)) {
      const prevCompany = (await db.select({ name: companies.name }).from(companies).where(eq(companies.id, same.companyId)).limit(1))[0]?.name ?? "otra empresa";
      changeWarn = { date, reason: `${guard.name} ya tiene un extra de ${SHIFT_DEFAULTS[input.shift].label.toLowerCase()} ese día en ${prevCompany}. Al confirmar, se cambia a ${company.name}, reemplazando a ${replaced.name}` };
    }
    const slot: ShiftSlot = { date, shift: input.shift, startTime: input.startTime, hours: input.hours };
    // El mismo turno de la misma fecha se reasigna (no cuenta como conflicto).
    const others: ShiftSlot[] = [
      ...existing.filter(e => !(e.date === date && e.shift === input.shift)).map(e => ({ date: e.date, shift: e.shift, startTime: e.startTime, hours: e.hours })),
      ...planned,
    ];
    const res = checkSlot(slot, others);
    if (res.blocked.length) { blocked.push({ date, reason: res.blocked[0] }); continue; }
    res.warnings.forEach(w => warnings.push({ date, reason: w }));
    allowed.push(date);
    toRemove.push(...pendingRemove);
    if (pendingWarn) warnings.push(pendingWarn);
    if (changeWarn) warnings.push(changeWarn);
    planned.push(slot);
  }

  if (warnings.length && !input.confirm) return { needsConfirmation: true as const, saved: [] as string[], blocked, warnings };

  // Sustitución: se quitan los extras del reemplazante anterior (p. ej. no se presentó).
  if (toRemove.length) await db.delete(extraShifts).where(inArray(extraShifts.id, toRemove));
  for (const date of allowed) {
    await db.insert(extraShifts)
      .values({ guardId: input.guardId, shiftDate: date, shift: input.shift, startTime: input.startTime, hours: input.hours, companyId: input.companyId, replacedGuardId: input.replacedGuardId, createdBy })
      .onConflictDoUpdate({ target: [extraShifts.guardId, extraShifts.shiftDate, extraShifts.shift], set: { startTime: input.startTime, hours: input.hours, companyId: input.companyId, replacedGuardId: input.replacedGuardId, createdBy } });
  }
  return { needsConfirmation: false as const, saved: allowed, blocked, warnings, substituted: toRemove.length };
}

/** Elimina días extra por id. */
export async function removeExtras(ids: number[]) {
  const db = await requireDb();
  if (!ids.length) return { removed: 0 };
  await db.delete(extraShifts).where(inArray(extraShifts.id, ids));
  return { removed: ids.length };
}
