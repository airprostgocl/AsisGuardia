import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";
import { createLocalSession, hashPassword, passwordFingerprint, readLocalSession } from "./_core/localAuth";
import { publicSupervisor } from "./supervisorAccounts";

function supervisor(overrides: Partial<NonNullable<TrpcContext["supervisor"]>> = {}) {
  return {
    id: 2, name: "Juan Pérez", username: "jperez", passwordHash: hashPassword("temporal123"), email: null,
    isAdmin: false, mustChangePassword: false, active: true, createdAt: new Date(), ...overrides,
  } as NonNullable<TrpcContext["supervisor"]>;
}

function caller(sup: TrpcContext["supervisor"]) {
  const ctx = { user: null, supervisor: sup, req: { headers: {}, socket: {} } as never, res: { cookie() {}, clearCookie() {} } as never } as TrpcContext;
  return appRouter.createCaller(ctx);
}

describe("cuentas de supervisor", () => {
  it("nunca expone el hash de la contraseña", async () => {
    const sup = supervisor();
    expect(publicSupervisor(sup)).not.toHaveProperty("passwordHash");
    const me = await caller(sup).auth.me();
    expect(JSON.stringify(me)).not.toContain(sup.passwordHash);
  });

  it("solo el administrador puede gestionar supervisores", async () => {
    const api = caller(supervisor({ isAdmin: false }));
    await expect(api.supervisors.list()).rejects.toThrow("Solo el administrador");
    await expect(api.supervisors.create({ name: "Otro", username: "otro", temporaryPassword: "temporal123" })).rejects.toThrow("Solo el administrador");
    await expect(api.supervisors.resetPassword({ id: 3, temporaryPassword: "temporal123" })).rejects.toThrow("Solo el administrador");
    await expect(api.supervisors.setActive({ id: 3, active: false })).rejects.toThrow("Solo el administrador");
  });

  it("sin sesión no se puede acceder a la administración", async () => {
    await expect(caller(null).supervisors.list()).rejects.toThrow();
  });

  it("con contraseña temporal pendiente solo permite cambiarla", async () => {
    const api = caller(supervisor({ mustChangePassword: true, isAdmin: true }));
    await expect(api.operation.snapshot({ start: "2026-11-01", end: "2026-11-30" })).rejects.toThrow("contraseña temporal");
    await expect(api.supervisors.list()).rejects.toThrow("contraseña temporal");
  });

  it("la sesión queda ligada a la contraseña vigente", () => {
    const oldHash = hashPassword("anterior123");
    const session = readLocalSession(createLocalSession(7, oldHash));
    expect(session).toMatchObject({ supervisorId: 7, pv: passwordFingerprint(oldHash) });
    expect(session!.pv).not.toBe(passwordFingerprint(hashPassword("nueva12345")));
    expect(readLocalSession("manipulado.firma")).toBeNull();
  });
});
