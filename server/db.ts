import { and, asc, eq, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, guards, absenceTypes, attendanceRecords, companies, sites, supervisors } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { hashPassword, verifyPassword } from "./_core/localAuth";

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
export async function getSupervisorById(id:number){const db=await getDb();if(!db)return undefined;const rows=await db.select().from(supervisors).where(and(eq(supervisors.id,id),eq(supervisors.active,true))).limit(1);return rows[0];}
export async function authenticateSupervisor(username:string,password:string){const db=await getDb();if(!db)return undefined;await ensureOperationalSeed();const rows=await db.select().from(supervisors).where(and(eq(supervisors.username,username.trim()),eq(supervisors.active,true))).limit(1);const supervisor=rows[0];return supervisor&&verifyPassword(password,supervisor.passwordHash)?supervisor:undefined;}

const defaultTypes = [
  { code: "H", name: "Festivo", deductionFactor: "1", color: "#62b86f" },
  { code: "HA", name: "Medio día (mañana)", deductionFactor: "0.5", color: "#86c9db" },
  { code: "HP", name: "Medio día (tarde)", deductionFactor: "0.5", color: "#9ed8e7" },
  { code: "V", name: "Vacaciones", deductionFactor: "1", color: "#e7f58b" },
  { code: "Q", name: "Cuarto de día", deductionFactor: "0.25", color: "#fff27c" },
  { code: "M", name: "Maternidad / paternidad", deductionFactor: "1", color: "#f2b6db" },
  { code: "S", name: "Baja por enfermedad", deductionFactor: "1", color: "#ee87df" },
  { code: "L", name: "Día libre por compensación", deductionFactor: "1", color: "#d8e4a0" },
  { code: "W", name: "Teletrabajo", deductionFactor: "1", color: "#c0e8a8" },
  { code: "P", name: "Festivo público / oficial", deductionFactor: "1", color: "#a9a8e9" },
  { code: "C", name: "Permiso por duelo", deductionFactor: "1", color: "#e6d9f1" },
  { code: "X1", name: "Personalizado no deducible", deductionFactor: "0", color: "#c9e8bd" },
  { code: "X2", name: "Personalizado no deducible 2", deductionFactor: "0", color: "#bfe7c1" },
  { code: "X3", name: "Personalizado no deducible 3", deductionFactor: "0", color: "#c7c7c7" },
  { code: "X4", name: "Personalizado deducible", deductionFactor: "1", color: "#e6a2c6" },
  { code: "X5", name: "Personalizado deducible 2", deductionFactor: "1", color: "#8ed8cf" },
  { code: "X6", name: "Personalizado deducible 3", deductionFactor: "1", color: "#a0d6de" },
  { code: "X7", name: "Personalizado deducible 4", deductionFactor: "1", color: "#aad6e4" },
  { code: "X8", name: "Personalizado deducible 5", deductionFactor: "1", color: "#a8d7c5" },
  { code: "X9", name: "Personalizado deducible 6", deductionFactor: "1", color: "#99d9c4" },
  { code: "X0", name: "Personalizado deducible 7", deductionFactor: "1", color: "#a8d9bd" },
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
  for (const type of defaultTypes) { if (typeMap.has(type.code)) await db.update(absenceTypes).set({ name:type.name, deductionFactor:type.deductionFactor, color:type.color }).where(eq(absenceTypes.code,type.code)); else { const inserted = await db.insert(absenceTypes).values(type); typeMap.set(type.code, Number(inserted[0].insertId)); } }
  const existingSupervisors = await db.select().from(supervisors); if (!existingSupervisors.length) await db.insert(supervisors).values({name:"Andrés Morales", username:"supervisor", passwordHash:hashPassword("GuardiaFlow2026!"), active:true}); else if (!existingSupervisors[0].username || !existingSupervisors[0].passwordHash) await db.update(supervisors).set({username:"supervisor",passwordHash:hashPassword("GuardiaFlow2026!"),active:true}).where(eq(supervisors.id,existingSupervisors[0].id));
  const existingCompanies = await db.select().from(companies); if (!existingCompanies.some(c=>c.name==="Empresa Demo")) await db.insert(companies).values({name:"Empresa Demo",isDemo:true,active:true}); const companyRows = await db.select().from(companies); const demoCompany = companyRows.find(c=>c.name==="Empresa Demo");
  const existingSites = await db.select().from(sites); if (!existingSites.length) await db.insert(sites).values([{companyId:demoCompany?.id??null,companyName:"Empresa Demo",siteName:"Torre Norte",isDemo:true,active:true},{companyId:demoCompany?.id??null,companyName:"Empresa Demo",siteName:"Bodega Central",isDemo:true,active:true},{companyId:demoCompany?.id??null,companyName:"Empresa Demo",siteName:"Parque Industrial",isDemo:true,active:true},{companyId:demoCompany?.id??null,companyName:"Empresa Demo",siteName:"Clínica Los Robles",isDemo:true,active:true}]);
  const sitesToLink = await db.select().from(sites); for (const site of sitesToLink) { let company = (await db.select().from(companies).where(eq(companies.name,site.companyName)).limit(1))[0]; if (!company) { const inserted = await db.insert(companies).values({name:site.companyName,active:true,isDemo:site.isDemo}); company = (await db.select().from(companies).where(eq(companies.id,Number(inserted[0].insertId))).limit(1))[0]; } if (company && site.companyId !== company.id) await db.update(sites).set({companyId:company.id}).where(eq(sites.id,site.id)); }
  const existingGuards = await db.select().from(guards); const guardMap = new Map(existingGuards.map(g => [g.rut, g.id]));
  if (!existingGuards.length) { await db.insert(guards).values(defaultGuards.map(g => ({ ...g, hireDate: new Date(g.hireDate) }))); const fresh = await db.select().from(guards); fresh.forEach(g => guardMap.set(g.rut, g.id)); }
  const supervisor = (await db.select().from(supervisors).limit(1))[0]; const siteRows = await db.select().from(sites); for (const g of await db.select().from(guards)) { const matchingSite = siteRows.find(s => s.siteName === g.post); const isSeedGuard = g.isDemo || defaultGuards.some(d => d.rut === g.rut); if (isSeedGuard && matchingSite && (!g.siteId || !g.supervisorId)) await db.update(guards).set({siteId:matchingSite.id, supervisorId:supervisor?.id??null, isDemo:true}).where(eq(guards.id,g.id)); }
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
  const [siteRows, supervisorRows] = await Promise.all([db.select().from(sites).orderBy(asc(sites.companyName),asc(sites.siteName)), db.select().from(supervisors).where(eq(supervisors.active,true)).orderBy(asc(supervisors.name))]);
  const companyRowsNow = await db.select().from(companies).where(eq(companies.active,true)).orderBy(asc(companies.name));
  return { guards: guardRows, types: typeRows, records: recordRows, sites:siteRows, companies:companyRowsNow, supervisors:supervisorRows };
}
export async function createGuard(input: {rut:string; name:string; post:string; siteId?:number|null; supervisorId?:number|null; hireDate?:string; annualVacation:string; vacationUsedBefore:string}) { const db = await getDb(); if (!db) throw new Error("Database is not available"); const annualVacation = Number(input.annualVacation || 15); const vacationUsedBefore = Number(input.vacationUsedBefore || 0); const initialVacation = annualVacation - vacationUsedBefore; const result = await db.insert(guards).values({ rut:input.rut, name:input.name, post:input.post, siteId:input.siteId??null, supervisorId:input.supervisorId??null, hireDate: input.hireDate ? new Date(input.hireDate) : null, initialVacation: initialVacation.toFixed(2), annualVacation: annualVacation.toFixed(2), vacationUsedBefore: vacationUsedBefore.toFixed(2), active:true, isDemo:false }); const rows = await db.select().from(guards).where(eq(guards.id, Number(result[0].insertId))).limit(1); return rows[0]; }
export async function createSupervisor(input:{name:string;username:string;password:string}){const db=await getDb();if(!db)throw new Error("Database is not available");return db.insert(supervisors).values({name:input.name.trim(),username:input.username.trim().toLowerCase(),passwordHash:hashPassword(input.password),active:true});}
export async function createSite(input:{companyName:string;siteName:string;supervisorId?:number|null}){const db=await getDb();if(!db)throw new Error("Database is not available");const companyName=input.companyName.trim();let row=(await db.select().from(companies).where(eq(companies.name,companyName)).limit(1))[0];if(!row){const result=await db.insert(companies).values({name:companyName,active:true,isDemo:false});row=(await db.select().from(companies).where(eq(companies.id,Number(result[0].insertId))).limit(1))[0];}return db.insert(sites).values({companyId:row?.id??null,companyName,siteName:input.siteName.trim(),supervisorId:input.supervisorId??null,active:true,isDemo:false});}
export async function archiveSite(id:number, active:boolean){const db=await getDb();if(!db)throw new Error("Database is not available");await db.update(sites).set({active}).where(eq(sites.id,id));if(!active)await db.update(guards).set({active:false}).where(eq(guards.siteId,id));}
export async function deleteSite(id:number){const db=await getDb();if(!db)throw new Error("Database is not available");const gs=await db.select({id:guards.id}).from(guards).where(eq(guards.siteId,id));for(const g of gs){await db.delete(attendanceRecords).where(eq(attendanceRecords.guardId,g.id));await db.delete(guards).where(eq(guards.id,g.id));}await db.delete(sites).where(eq(sites.id,id));}
export async function deleteGuard(id:number){const db=await getDb();if(!db)throw new Error("Database is not available");await db.delete(attendanceRecords).where(eq(attendanceRecords.guardId,id));await db.delete(guards).where(eq(guards.id,id));}
export async function clearDemoData(){const db=await getDb();if(!db)throw new Error("Database is not available");const demoRuts=defaultGuards.map(g=>g.rut);const gs=await db.select({id:guards.id}).from(guards);for(const g of gs){const row=await db.select({rut:guards.rut,isDemo:guards.isDemo}).from(guards).where(eq(guards.id,g.id)).limit(1);if(row[0]?.isDemo||demoRuts.includes(row[0]?.rut||"")){await db.delete(attendanceRecords).where(eq(attendanceRecords.guardId,g.id));await db.delete(guards).where(eq(guards.id,g.id));}}await db.delete(sites).where(eq(sites.isDemo,true));await db.delete(companies).where(eq(companies.isDemo,true));}
export async function upsertAttendance(input: {guardId:number; recordDate:string; absenceTypeId?:number|null; notes?:string}) { const db = await getDb(); if (!db) throw new Error("Database is not available"); const recordDate = new Date(input.recordDate); const prior = await db.select().from(attendanceRecords).where(and(eq(attendanceRecords.guardId,input.guardId), eq(attendanceRecords.recordDate,recordDate))).limit(1); if (prior[0]) { await db.update(attendanceRecords).set({ absenceTypeId: input.absenceTypeId ?? null, notes: input.notes ?? null, updatedAt: new Date() }).where(eq(attendanceRecords.id, prior[0].id)); return { ...prior[0], absenceTypeId: input.absenceTypeId ?? null }; } const result = await db.insert(attendanceRecords).values({guardId:input.guardId, recordDate, absenceTypeId:input.absenceTypeId ?? null, notes:input.notes ?? null}); return { id:Number(result[0].insertId), ...input }; }
