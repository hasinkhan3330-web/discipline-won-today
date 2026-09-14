import { createContext, useContext, type ReactNode } from "react";
import { useEntitlement, type Entitlement } from "@/hooks/useEntitlement";

const Ctx = createContext<Entitlement | null>(null);

/**
 * One shared entitlement verdict for the whole authenticated app.
 * Everything below reads the same server-computed result.
 */
export function EntitlementProvider({ userId, children }: { userId: string | null; children: ReactNode }) {
  const ent = useEntitlement(userId);
  return <Ctx.Provider value={ent}>{children}</Ctx.Provider>;
}

export function useEntitlementContext(): Entitlement {
  const value = useContext(Ctx);
  if (!value) throw new Error("useEntitlementContext must be used inside EntitlementProvider");
  return value;
}
