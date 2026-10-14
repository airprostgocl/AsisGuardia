import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, router } from "./_core/trpc";
import { createGuard, getOperationalSnapshot, upsertAttendance } from "./db";
import { z } from "zod";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => { const cookieOptions = getSessionCookieOptions(ctx.req); ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 }); return { success: true } as const; }),
  }),
  operation: router({
    snapshot: publicProcedure.input(z.object({ start:z.string(), end:z.string() })).query(({ input }) => getOperationalSnapshot(input.start, input.end)),
    createGuard: publicProcedure.input(z.object({ rut:z.string().min(3), name:z.string().min(2), post:z.string().min(2), hireDate:z.string().optional(), annualVacation:z.string().default("15"), vacationUsedBefore:z.string().default("0") })).mutation(({ input }) => createGuard(input)),
    mark: publicProcedure.input(z.object({ guardId:z.number(), recordDate:z.string(), absenceTypeId:z.number().nullable(), notes:z.string().optional() })).mutation(({ input }) => upsertAttendance(input)),
  }),
});
export type AppRouter = typeof appRouter;
