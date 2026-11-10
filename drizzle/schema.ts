import { boolean, date, integer, numeric, pgEnum, pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const userRole = pgEnum("user_role", ["user", "admin"]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRole("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const supervisors = pgTable("supervisors", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  username: varchar("username", { length: 80 }).notNull().unique(),
  passwordHash: varchar("passwordHash", { length: 180 }).notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const supervisorSites = pgTable("supervisorSites", {
  id: serial("id").primaryKey(),
  supervisorId: integer("supervisorId").notNull(),
  siteId: integer("siteId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 180 }).notNull().unique(),
  active: boolean("active").default(true).notNull(),
  isDemo: boolean("isDemo").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const sites = pgTable("sites", {
  id: serial("id").primaryKey(),
  companyId: integer("companyId"),
  companyName: varchar("companyName", { length: 180 }).notNull(),
  siteName: varchar("siteName", { length: 180 }),
  supervisorId: integer("supervisorId"),
  active: boolean("active").default(true).notNull(),
  isDemo: boolean("isDemo").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const guards = pgTable("guards", {
  id: serial("id").primaryKey(),
  rut: varchar("rut", { length: 20 }).notNull().unique(),
  name: varchar("name", { length: 180 }).notNull(),
  hireDate: date("hireDate"),
  post: varchar("post", { length: 160 }).notNull(),
  companyId: integer("companyId"),
  siteId: integer("siteId"),
  supervisorId: integer("supervisorId"),
  initialVacation: numeric("initialVacation", { precision: 6, scale: 2 }).default("0").notNull(),
  annualVacation: numeric("annualVacation", { precision: 6, scale: 2 }).default("15").notNull(),
  vacationUsedBefore: numeric("vacationUsedBefore", { precision: 6, scale: 2 }).default("0").notNull(),
  active: boolean("active").default(true).notNull(),
  isDemo: boolean("isDemo").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const absenceTypes = pgTable("absence_types", {
  id: serial("id").primaryKey(),
  code: varchar("code", { length: 8 }).notNull().unique(),
  name: varchar("name", { length: 80 }).notNull(),
  deductionFactor: numeric("deductionFactor", { precision: 4, scale: 2 }).default("0").notNull(),
  color: varchar("color", { length: 16 }).notNull(),
});

export const attendanceRecords = pgTable("attendance_records", {
  id: serial("id").primaryKey(),
  guardId: integer("guardId").notNull(),
  recordDate: date("recordDate").notNull(),
  absenceTypeId: integer("absenceTypeId"),
  notes: text("notes"),
  registeredBy: integer("registeredBy"),
  updatedAt: timestamp("updatedAt").defaultNow().$onUpdate(() => new Date()).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Guard = typeof guards.$inferSelect;
export type AbsenceType = typeof absenceTypes.$inferSelect;
export type AttendanceRecord = typeof attendanceRecords.$inferSelect;
