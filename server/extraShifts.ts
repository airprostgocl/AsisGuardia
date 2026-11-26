import { and, asc, eq, gte, inArray, isNotNull, lte } from "drizzle-orm";
import { absenceTypes, attendanceRecords, companies, extraShifts, guards } from "../drizzle/schema";
import { getDb } from "./db";

/** Turnos: día, tarde y noche. Cada extra guarda su hora de inicio y duración reales. */
export const SHIFTS = ["dia", "tarde", "noche"] as const;
export type Shift = (typeof SHIFTS)[number];
export const BASE_SHIFTS = ["dia", "tarde", "noche"] as const;
export const SHIFT_DEFAULTS: Record<Shift, { start: string; hours: number; label: string }> = {
  dia: { start: "08:00", hours: 12, label: "Día" },
  tarde: { start: "15:00", hours: 8, label: "Tarde" },
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

const shiftDay = (date: string, delta: number) => new Date(Date.parse(`${date}T00:00:00Z`) + delta * 86_400_000).toISOString().slice(0, 10);

/**
 * Asigna (o reasigna) días extra a una empresa en un turno.
 * - Bloquea: días con ausencia propia y turnos que se superponen con otros extras.
 * - Advierte (requiere `confirm`): 24 h seguidas, menos de 8 h de descanso o coincidencia con su turno habitual.
 */
export async function assignExtras(input: {
  guardId: number; dates: string[]; shift: Shift; startTime: string; hours: number; companyId: number;
  replacedGuardId?: number | null; confirm?: boolean;
}, createdBy: number | null) {
  const db = await requireDb();
  const dates = Array.from(new Set(input.dates.map(d => d.slice(0, 10)))).sort();
  if (!dates.length) throw new Error("Selecciona al menos un día");
  if (input.replacedGuardId && input.replacedGuardId === input.guardId) throw new Error("Un guardia no puede reemplazarse a sí mismo");
  const [guard] = await db.select({ id: guards.id, baseShift: guards.baseShift }).from(guards).where(eq(guards.id, input.guardId)).limit(1);
  if (!guard) throw new Error("Guardia no encontrado");
  const [company] = await db.select({ id: companies.id }).from(companies).where(eq(companies.id, input.companyId)).limit(1);
  if (!company) throw new Error("Empresa no encontrada");

  const from = shiftDay(dates[0], -1), to = shiftDay(dates[dates.length - 1], 1);
  const { extras: existing, absences } = await guardExtrasContext(input.guardId, from, to);
  const absent = new Map(absences.map(a => [a.date, a.label]));
  const blocked: { date: string; reason: string }[] = [];
  const warnings: { date: string; reason: string }[] = [];
  const allowed: string[] = [];
  const planned: ShiftSlot[] = [];

  for (const date of dates) {
    if (absent.has(date)) { blocked.push({ date, reason: `tiene ausencia registrada (${absent.get(date)})` }); continue; }
    const slot: ShiftSlot = { date, shift: input.shift, startTime: input.startTime, hours: input.hours };
    // El mismo turno de la misma fecha se reasigna (no cuenta como conflicto).
    const others: ShiftSlot[] = [
      ...existing.filter(e => !(e.date === date && e.shift === input.shift)).map(e => ({ date: e.date, shift: e.shift, startTime: e.startTime, hours: e.hours })),
      ...planned,
    ];
    const res = checkSlot(slot, others);
    if (res.blocked.length) { blocked.push({ date, reason: res.blocked[0] }); continue; }
    res.warnings.forEach(w => warnings.push({ date, reason: w }));
    if (guard.baseShift && guard.baseShift in SHIFT_DEFAULTS) {
      const base: ShiftSlot = { date, shift: guard.baseShift as Shift, startTime: SHIFT_DEFAULTS[guard.baseShift as Shift].start, hours: SHIFT_DEFAULTS[guard.baseShift as Shift].hours };
      const bi = interval(base), si = interval(slot);
      if (si.start < bi.end && bi.start < si.end) warnings.push({ date, reason: `coincide con su turno habitual de ${SHIFT_DEFAULTS[base.shift].label.toLowerCase()}: confirma que ese día lo tiene libre` });
    }
    allowed.push(date);
    planned.push(slot);
  }

  if (warnings.length && !input.confirm) return { needsConfirmation: true as const, saved: [] as string[], blocked, warnings };

  for (const date of allowed) {
    await db.insert(extraShifts)
      .values({ guardId: input.guardId, shiftDate: date, shift: input.shift, startTime: input.startTime, hours: input.hours, companyId: input.companyId, replacedGuardId: input.replacedGuardId ?? null, createdBy })
      .onConflictDoUpdate({ target: [extraShifts.guardId, extraShifts.shiftDate, extraShifts.shift], set: { startTime: input.startTime, hours: input.hours, companyId: input.companyId, replacedGuardId: input.replacedGuardId ?? null, createdBy } });
  }
  return { needsConfirmation: false as const, saved: allowed, blocked, warnings };
}

/** Elimina días extra por id. */
export async function removeExtras(ids: number[]) {
  const db = await requireDb();
  if (!ids.length) return { removed: 0 };
  await db.delete(extraShifts).where(inArray(extraShifts.id, ids));
  return { removed: ids.length };
}
