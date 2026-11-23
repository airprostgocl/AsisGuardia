import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { localSessionCookie, passwordFingerprint, readLocalSession } from "./localAuth";
import { getSupervisorById } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
  supervisor: Awaited<ReturnType<typeof getSupervisorById>> | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;
  let supervisor: Awaited<ReturnType<typeof getSupervisorById>> | null = null;

  try {
    user = await sdk.authenticateRequest(opts.req);
  } catch (error) {
    // Authentication is optional for public procedures.
    user = null;
  }
  if (!user) {
    const cookieHeader = opts.req.headers.cookie || "";
    const localCookie = cookieHeader.split(";").map(v=>v.trim()).find(v=>v.startsWith(`${localSessionCookie.name}=`))?.slice(localSessionCookie.name.length + 1);
    const session = readLocalSession(localCookie);
    if (session) {
      const found = await getSupervisorById(session.supervisorId);
      supervisor = found && passwordFingerprint(found.passwordHash) === session.pv ? found : null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
    supervisor,
  };
}
