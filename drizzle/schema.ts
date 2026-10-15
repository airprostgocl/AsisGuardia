import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, date, decimal, boolean } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"), email: varchar("email", { length: 320 }), loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(), lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const supervisors = mysqlTable("supervisors", {
  id: int("id").autoincrement().primaryKey(), name: varchar("name", {length:180}).notNull(), username: varchar("username", {length:80}).notNull().unique(), passwordHash: varchar("passwordHash", {length:180}).notNull(), active: boolean("active").default(true).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const companies = mysqlTable("companies", {
  id: int("id").autoincrement().primaryKey(), name: varchar("name", {length:180}).notNull().unique(), active: boolean("active").default(true).notNull(), isDemo: boolean("isDemo").default(false).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const sites = mysqlTable("sites", {
  id: int("id").autoincrement().primaryKey(), companyId: int("companyId"), companyName: varchar("companyName", {length:180}).notNull(), siteName: varchar("siteName", {length:180}).notNull(), supervisorId: int("supervisorId"), active: boolean("active").default(true).notNull(), isDemo: boolean("isDemo").default(false).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const guards = mysqlTable("guards", {
  id: int("id").autoincrement().primaryKey(), rut: varchar("rut", {length: 20}).notNull().unique(), name: varchar("name", {length: 180}).notNull(), hireDate: date("hireDate"), post: varchar("post", {length: 160}).notNull(), siteId: int("siteId"), supervisorId: int("supervisorId"), initialVacation: decimal("initialVacation", {precision: 6, scale: 2}).default("0").notNull(), annualVacation: decimal("annualVacation", {precision: 6, scale: 2}).default("15").notNull(), vacationUsedBefore: decimal("vacationUsedBefore", {precision: 6, scale: 2}).default("0").notNull(), active: boolean("active").default(true).notNull(), isDemo: boolean("isDemo").default(false).notNull(), createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export const absenceTypes = mysqlTable("absence_types", { id:int("id").autoincrement().primaryKey(), code:varchar("code",{length:8}).notNull().unique(), name:varchar("name",{length:80}).notNull(), deductionFactor:decimal("deductionFactor",{precision:4,scale:2}).default("0").notNull(), color:varchar("color",{length:16}).notNull() });
export const attendanceRecords = mysqlTable("attendance_records", { id:int("id").autoincrement().primaryKey(), guardId:int("guardId").notNull(), recordDate:date("recordDate").notNull(), absenceTypeId:int("absenceTypeId"), notes:text("notes"), registeredBy:int("registeredBy"), updatedAt:timestamp("updatedAt").defaultNow().onUpdateNow().notNull() });

export type User = typeof users.$inferSelect; export type InsertUser = typeof users.$inferInsert;
export type Guard = typeof guards.$inferSelect; export type AbsenceType = typeof absenceTypes.$inferSelect; export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
