import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { localSessionCookie, createLocalSession } from "./_core/localAuth";
import { archiveSite, authenticateSupervisor, clearDemoData, createGuard, createSite, createSupervisor, deleteGuard, deleteSite, getOperationalSnapshot, upsertAttendance } from "./db";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.supervisor ? ({ id:opts.ctx.supervisor.id, name:opts.ctx.supervisor.name, email:null, role:"user" as const, user:null, supervisor:opts.ctx.supervisor, authenticated:true }) : opts.ctx.user ? ({ ...opts.ctx.user, user:opts.ctx.user, supervisor:null, authenticated:true }) : null),
    login: publicProcedure.input(z.object({username:z.string().min(2),password:z.string().min(8)})).mutation(async ({input,ctx})=>{const supervisor=await authenticateSupervisor(input.username,input.password);if(!supervisor)throw new Error("Usuario o contraseña incorrectos");ctx.res.cookie(localSessionCookie.name,createLocalSession(supervisor.id),localSessionCookie.options);return {success:true,supervisor:{id:supervisor.id,name:supervisor.name,username:supervisor.username}};}),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); ctx.res.clearCookie(localSessionCookie.name,{...localSessionCookie.options,maxAge:0}); return { success: true } as const; }),
  }),
  operation: router({
    snapshot: protectedProcedure.input(z.object({ start:z.string(), end:z.string() })).query(({ input }) => getOperationalSnapshot(input.start, input.end)),
    createGuard: protectedProcedure.input(z.object({ rut:z.string().min(3), name:z.string().min(2), post:z.string().min(2), siteId:z.number().nullable().optional(), supervisorId:z.number().nullable().optional(), hireDate:z.string().optional(), annualVacation:z.string().default("15"), vacationUsedBefore:z.string().default("0") })).mutation(({ input }) => createGuard(input)),
    createSupervisor: protectedProcedure.input(z.object({name:z.string().min(2),username:z.string().min(2),password:z.string().min(8)})).mutation(({input})=>createSupervisor(input)),
    createSite: protectedProcedure.input(z.object({companyName:z.string().min(2),siteName:z.string().optional().nullable(),supervisorId:z.number().nullable().optional()})).mutation(({input})=>createSite(input)),
    archiveSite: protectedProcedure.input(z.object({id:z.number(),active:z.boolean()})).mutation(({input})=>archiveSite(input.id,input.active)),
    deleteSite: protectedProcedure.input(z.object({id:z.number()})).mutation(({input})=>deleteSite(input.id)),
    deleteGuard: protectedProcedure.input(z.object({id:z.number()})).mutation(({input})=>deleteGuard(input.id)),
    clearDemo: protectedProcedure.mutation(()=>clearDemoData()),
    mark: protectedProcedure.input(z.object({ guardId:z.number(), recordDate:z.string(), absenceTypeId:z.number().nullable(), notes:z.string().optional() })).mutation(({ input }) => upsertAttendance(input)),
  }),
});
export type AppRouter = typeof appRouter;
