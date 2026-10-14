import { and, asc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, guards, absenceTypes, attendanceRecords } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
export async function getDb() { if (!_db && process.env.DATABASE_URL) { try { _db = drizzle(process.env.DATABASE_URL); } catch (error) { console.warn("[Database] Failed to connect:", error); _db = null; } } return _db; }

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb(); if (!db) throw new Error("Database is not available");
  const values: InsertUser = { openId: user.openId }; const updateSet: Record<string, unknown> = {};
  (['name','email','loginMethod'] as const).forEach(field => { if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; } });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; } else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date(); if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}
export async function getUserByOpenId(openId: string) { const db = await getDb(); if (!db) return undefined; const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1); return result[0]; }

const defaultTypes = [
  { code: "P", name: "Presente / turno normal", deductionFactor: "0", color: "#16745f" },
  { code: "V", name: "Vacaciones", deductionFactor: "1", color: "#3172c6" },
  { code: "L", name: "Licencia médica", deductionFactor: "0", color: "#d55454" },
  { code: "PM", name: "Permiso / medio día", deductionFactor: "0.5", color: "#c46a16" },
  { code: "C", name: "Día compensatorio", deductionFactor: "0", color: "#7552b8" },
];
const defaultGuards = [
  { rut:"18.492.201-7", name:"Camila Rojas", post:"Torre Norte", hireDate:"2022-03-14", initialVacation:"15" },
  { rut:"17.208.446-2", name:"Matías Sepúlveda", post:"Bodega Central", hireDate:"2021-08-02", initialVacation:"12" },
  { rut:"19.827.301-4", name:"Daniela Muñoz", post:"Parque Industrial", hireDate:"2023-01-16", initialVacation:"10" },
  { rut:"16.741.908-9", name:"José Araya", post:"Torre Norte", hireDate:"2020-11-30", initialVacation:"15" },
  { rut:"20.104.630-1", name:"Sofía Vargas", post:"Clínica Los Robles", hireDate:"2024-02-12", initialVacation:"12" },
  { rut:"15.990.412-6", name:"Felipe Contreras", post:"Bodega Central", hireDate:"2019-06-21", initialVacation:"15" },
];
const demoAbsences: Record<string, string> = {
  "18.492.201-7:2026-10-05":"V", "18.492.201-7:2026-10-06":"V", "18.492.201-7:2026-10-09":"PM",
  "17.208.446-2:2026-10-02":"L", "17.208.446-2:2026-10-03":"L",
  "19.827.301-4:2026-10-04":"V", "19.827.301-4:2026-10-05":"V", "19.827.301-4:2026-10-06":"V", "19.827.301-4:2026-10-07":"V",
  "16.741.908-9:2026-10-03":"PM", "20.104.630-1:2026-10-06":"C", "15.990.412-6:2026-10-01":"L",
};

export async function ensureOperationalSeed() {
  const db = await getDb(); if (!db) return false;
  const existingTypes = await db.select().from(absenceTypes); const typeMap = new Map(existingTypes.map(t => [t.code, t.id]));
  if (!existingTypes.length) { await db.insert(absenceTypes).values(defaultTypes); const fresh = await db.select().from(absenceTypes); fresh.forEach(t => typeMap.set(t.code, t.id)); }
  const existingGuards = await db.select().from(guards); const guardMap = new Map(existingGuards.map(g => [g.rut, g.id]));
  if (!existingGuards.length) { await db.insert(guards).values(defaultGuards.map(g => ({ ...g, hireDate: new Date(g.hireDate) }))); const fresh = await db.select().from(guards); fresh.forEach(g => guardMap.set(g.rut, g.id)); }
  const existingRecords = await db.select().from(attendanceRecords).limit(1);
  if (!existingRecords.length) { const rows = Object.entries(demoAbsences).map(([key, code]) => { const [rut, recordDate] = key.split(":"); return { guardId: guardMap.get(rut)!, recordDate: new Date(recordDate), absenceTypeId: typeMap.get(code)! }; }).filter(r => r.guardId && r.absenceTypeId); if (rows.length) await db.insert(attendanceRecords).values(rows); }
  return true;
}

export async function getOperationalSnapshot(start: string, end: string) {
  const db = await getDb(); if (!db) return null; await ensureOperationalSeed();
  const startDate = new Date(start); const endDate = new Date(end);
  const [guardRows, typeRows, recordRows] = await Promise.all([
    db.select().from(guards).where(eq(guards.active, true)).orderBy(asc(guards.name)),
    db.select().from(absenceTypes).orderBy(asc(absenceTypes.id)),
    db.select().from(attendanceRecords).where(and(gte(attendanceRecords.recordDate, startDate), lte(attendanceRecords.recordDate, endDate))),
  ]);
  return { guards: guardRows, types: typeRows, records: recordRows };
}
export async function createGuard(input: {rut:string; name:string; post:string; hireDate?:string; initialVacation:string}) { const db = await getDb(); if (!db) throw new Error("Database is not available"); const result = await db.insert(guards).values({ ...input, hireDate: input.hireDate ? new Date(input.hireDate) : null, active:true }); const rows = await db.select().from(guards).where(eq(guards.id, Number(result[0].insertId))).limit(1); return rows[0]; }
export async function upsertAttendance(input: {guardId:number; recordDate:string; absenceTypeId?:number|null; notes?:string}) { const db = await getDb(); if (!db) throw new Error("Database is not available"); const recordDate = new Date(input.recordDate); const prior = await db.select().from(attendanceRecords).where(and(eq(attendanceRecords.guardId,input.guardId), eq(attendanceRecords.recordDate,recordDate))).limit(1); if (prior[0]) { await db.update(attendanceRecords).set({ absenceTypeId: input.absenceTypeId ?? null, notes: input.notes ?? null, updatedAt: new Date() }).where(eq(attendanceRecords.id, prior[0].id)); return { ...prior[0], absenceTypeId: input.absenceTypeId ?? null }; } const result = await db.insert(attendanceRecords).values({guardId:input.guardId, recordDate, absenceTypeId:input.absenceTypeId ?? null, notes:input.notes ?? null}); return { id:Number(result[0].insertId), ...input }; }
