import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { archiveSite, clearDemoData, createGuard, createSite, createSupervisor, deleteGuard, deleteSite, getOperationalSnapshot, upsertAttendance } from "./db";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  operation: router({
    snapshot: publicProcedure.input(z.object({ start:z.string(), end:z.string() })).query(({ input }) => getOperationalSnapshot(input.start, input.end)),
    createGuard: publicProcedure.input(z.object({ rut:z.string().min(3), name:z.string().min(2), post:z.string().min(2), siteId:z.number().nullable().optional(), supervisorId:z.number().nullable().optional(), hireDate:z.string().optional(), annualVacation:z.string().default("15"), vacationUsedBefore:z.string().default("0") })).mutation(({ input }) => createGuard(input)),
    createSupervisor: publicProcedure.input(z.object({name:z.string().min(2)})).mutation(({input})=>createSupervisor(input.name)),
    createSite: publicProcedure.input(z.object({companyName:z.string().min(2),siteName:z.string().min(2),supervisorId:z.number().nullable().optional()})).mutation(({input})=>createSite(input)),
    archiveSite: publicProcedure.input(z.object({id:z.number(),active:z.boolean()})).mutation(({input})=>archiveSite(input.id,input.active)),
    deleteSite: publicProcedure.input(z.object({id:z.number()})).mutation(({input})=>deleteSite(input.id)),
    deleteGuard: publicProcedure.input(z.object({id:z.number()})).mutation(({input})=>deleteGuard(input.id)),
    clearDemo: publicProcedure.mutation(()=>clearDemoData()),
    mark: publicProcedure.input(z.object({ guardId:z.number(), recordDate:z.string(), absenceTypeId:z.number().nullable(), notes:z.string().optional() })).mutation(({ input }) => upsertAttendance(input)),
  }),
});
export type AppRouter = typeof appRouter;
