import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router, supervisorAdminProcedure } from "./_core/trpc";
import { clientIp, rateLimit } from "./_core/rateLimit";
import { localSessionCookie, createLocalSession } from "./_core/localAuth";
import { archiveSite, authenticateSupervisor, clearDemoData, createGuard, createSite, deleteGuard, deleteSite, getOperationalSnapshot, setSiteAssignment, updateGuard } from "./db";
import { adminCreateSupervisor, adminResetSupervisorPassword, adminSetSupervisorActive, adminUpdateSupervisor, changeOwnPassword, listSupervisors, MIN_PASSWORD_LENGTH, publicSupervisor, requestPasswordReset, resetPasswordWithToken, updateOwnProfile } from "./supervisorAccounts";
import { z } from "zod";
import { listMarkAuthors, listMarkHistory, markAttendanceWithAudit } from "./attendanceAudit";
import type { Request } from "express";

const emailInput = z.string().trim().email("Correo no válido").nullable().optional().or(z.literal(""));

/** URL pública de la app para los enlaces de los correos. En producción se exige APP_URL. */
function appUrl(req: Request) {
  if (process.env.APP_URL) return process.env.APP_URL;
  if (process.env.NODE_ENV === "production") throw new Error("APP_URL no está configurada en el servidor");
  return `${req.protocol}://${req.get("host")}`;
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.supervisor ? ({ id:opts.ctx.supervisor.id, name:opts.ctx.supervisor.name, email:opts.ctx.supervisor.email, role:"user" as const, user:null, supervisor:publicSupervisor(opts.ctx.supervisor), authenticated:true }) : opts.ctx.user ? ({ ...opts.ctx.user, user:opts.ctx.user, supervisor:null, authenticated:true }) : null),
    login: publicProcedure.input(z.object({username:z.string().min(2),password:z.string().min(8)})).mutation(async ({input,ctx})=>{rateLimit(`login:${clientIp(ctx.req)}:${input.username.trim().toLowerCase()}`,10,15*60_000);const supervisor=await authenticateSupervisor(input.username,input.password);if(!supervisor)throw new Error("Usuario o contraseña incorrectos");ctx.res.cookie(localSessionCookie.name,createLocalSession(supervisor.id,supervisor.passwordHash),localSessionCookie.options);return {success:true,supervisor:{id:supervisor.id,name:supervisor.name,username:supervisor.username}};}),
    changePassword: protectedProcedure.input(z.object({ currentPassword:z.string().min(1), newPassword:z.string().min(MIN_PASSWORD_LENGTH) })).mutation(async ({ input, ctx }) => {
      if (!ctx.supervisor) throw new Error("Supervisor no identificado");
      const updated = await changeOwnPassword(ctx.supervisor.id, input.currentPassword, input.newPassword);
      // La sesión actual se renueva; las demás sesiones abiertas quedan invalidadas.
      ctx.res.cookie(localSessionCookie.name, createLocalSession(updated.id, updated.passwordHash), localSessionCookie.options);
      return { success: true } as const;
    }),
    requestPasswordReset: publicProcedure.input(z.object({ identifier:z.string().min(2).max(320) })).mutation(async ({ input, ctx }) => {
      rateLimit(`reset-ip:${clientIp(ctx.req)}`, 5, 15 * 60_000);
      rateLimit(`reset-id:${input.identifier.trim().toLowerCase()}`, 3, 15 * 60_000);
      await requestPasswordReset(input.identifier, appUrl(ctx.req));
      return { success: true } as const;
    }),
    resetPassword: publicProcedure.input(z.object({ token:z.string().min(20).max(200), newPassword:z.string().min(MIN_PASSWORD_LENGTH) })).mutation(async ({ input, ctx }) => {
      rateLimit(`reset-token:${clientIp(ctx.req)}`, 10, 15 * 60_000);
      return resetPasswordWithToken(input.token, input.newPassword);
    }),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); ctx.res.clearCookie(localSessionCookie.name,{...localSessionCookie.options,maxAge:0}); return { success: true } as const; }),
  }),
  operation: router({
    snapshot: protectedProcedure.input(z.object({ start:z.string(), end:z.string() })).query(async ({ input,ctx }) => { const data = await getOperationalSnapshot(input.start, input.end, ctx.supervisor?.id); if (!data || ctx.supervisor?.isAdmin) return data; return { ...data, records: data.records.map(({ registeredBy, ...r }) => r) }; }),
    createGuard: protectedProcedure.input(z.object({ rut:z.string().min(3), name:z.string().min(2), post:z.string().min(2), companyId:z.number().nullable().optional(), siteId:z.number().nullable().optional(), supervisorId:z.number().nullable().optional(), hireDate:z.string().optional(), annualVacation:z.string().default("15"), vacationUsedBefore:z.string().default("0") })).mutation(({ input,ctx }) => createGuard({...input, supervisorId:ctx.supervisor?.id??null})),
    updateGuard: protectedProcedure.input(z.object({id:z.number(),rut:z.string().min(3),name:z.string().min(2),post:z.string().min(2),companyId:z.number().nullable().optional(),siteId:z.number().nullable().optional(),hireDate:z.string().optional(),annualVacation:z.string().default("15"),vacationUsedBefore:z.string().default("0")})).mutation(({input})=>updateGuard(input.id,input)),
    updateSupervisor: protectedProcedure.input(z.object({ name:z.string().min(2), username:z.string().min(2), email:emailInput })).mutation(({ input, ctx }) => { if (!ctx.supervisor) throw new Error("Supervisor no identificado"); return updateOwnProfile(ctx.supervisor.id, input); }),
    createSite: protectedProcedure.input(z.object({companyName:z.string().min(2),siteName:z.string().optional().nullable()})).mutation(({input,ctx})=>createSite(input,ctx.supervisor?.id)),
    setSiteAssignment: protectedProcedure.input(z.object({siteId:z.number(),assigned:z.boolean()})).mutation(({input,ctx})=>{if(!ctx.supervisor)throw new Error("Supervisor no identificado");return setSiteAssignment(ctx.supervisor.id,input.siteId,input.assigned);}),
    archiveSite: protectedProcedure.input(z.object({id:z.number(),active:z.boolean()})).mutation(({input})=>archiveSite(input.id,input.active)),
    deleteSite: protectedProcedure.input(z.object({id:z.number()})).mutation(({input})=>deleteSite(input.id)),
    deleteGuard: protectedProcedure.input(z.object({id:z.number()})).mutation(({input})=>deleteGuard(input.id)),
    clearDemo: protectedProcedure.mutation(()=>clearDemoData()),
    mark: protectedProcedure.input(z.object({ guardId:z.number(), recordDate:z.string(), absenceTypeId:z.number().nullable(), notes:z.string().optional() })).mutation(({ input, ctx }) => markAttendanceWithAudit(input, ctx.supervisor?.id ?? null)),
  }),
  supervisors: router({
    list: supervisorAdminProcedure.query(() => listSupervisors()),
    create: supervisorAdminProcedure.input(z.object({ name:z.string().min(2), username:z.string().min(2), email:emailInput, temporaryPassword:z.string().min(MIN_PASSWORD_LENGTH) })).mutation(({ input }) => adminCreateSupervisor(input)),
    update: supervisorAdminProcedure.input(z.object({ id:z.number(), name:z.string().min(2), username:z.string().min(2), email:emailInput })).mutation(({ input }) => adminUpdateSupervisor(input.id, input)),
    setActive: supervisorAdminProcedure.input(z.object({ id:z.number(), active:z.boolean() })).mutation(({ input, ctx }) => adminSetSupervisorActive(ctx.supervisor.id, input.id, input.active)),
    markAuthors: supervisorAdminProcedure.input(z.object({ start:z.string(), end:z.string() })).query(({ input }) => listMarkAuthors(input.start, input.end)),
    markHistory: supervisorAdminProcedure.input(z.object({ guardId:z.number(), recordDate:z.string() })).query(({ input }) => listMarkHistory(input.guardId, input.recordDate)),
    resetPassword: supervisorAdminProcedure.input(z.object({ id:z.number(), temporaryPassword:z.string().min(MIN_PASSWORD_LENGTH) })).mutation(({ input, ctx }) => adminResetSupervisorPassword(ctx.supervisor.id, input.id, input.temporaryPassword)),
  }),
});
export type AppRouter = typeof appRouter;
