import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Narrow local typing for the beta supabase.auth.oauth namespace.
type AuthorizationDetails = {
  client?: { name?: string; redirect_uris?: string[]; client_uri?: string } | null;
  scope?: string;
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult = { data: AuthorizationDetails | null; error: { message: string } | null };
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};
const oauth = () => (supabase.auth as unknown as { oauth: OAuthApi }).oauth;

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    const next = location.pathname + location.searchStr;
    if (!data.session) throw redirect({ to: "/auth", search: { next } });
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauth().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <Shell>
      <p style={{ color: "#ff9a9a" }}>
        Could not load this authorization request: {String((error as Error)?.message ?? error)}
      </p>
    </Shell>
  ),
});

function Shell({ children }: { children: React.ReactNode }) {
  const G = "#00d4ff";
  const G2 = "#a855f7";
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "#e8e8e8",
        fontFamily: "monospace",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        backgroundImage: `radial-gradient(circle at 20% 20%, ${G2}22, transparent 50%), radial-gradient(circle at 80% 80%, ${G}22, transparent 50%)`,
      }}
    >
      <div style={{ maxWidth: 460, width: "100%", border: `1px solid ${G}44`, padding: 28, borderRadius: 4, background: "rgba(10,10,25,0.7)" }}>
        <h1 style={{ fontSize: 22, fontWeight: 900, letterSpacing: 4, color: "#fff", textShadow: `0 0 20px ${G}` }}>
          AUTHORIZE ACCESS
        </h1>
        {children}
      </div>
    </div>
  );
}

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const G = "#00d4ff";

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauth().approveAuthorization(authorization_id)
      : await oauth().denyAuthorization(authorization_id);
    if (error) {
      setBusy(false);
      setError(error.message);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      setError("No redirect returned by the authorization server.");
      return;
    }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";

  return (
    <Shell>
      <p style={{ marginTop: 12, fontSize: 13, letterSpacing: 1, lineHeight: 1.6 }}>
        <b style={{ color: "#fff" }}>{clientName}</b> wants to connect to your AXEN - Habit & Discipline account
        and act as you.
      </p>
      <p style={{ marginTop: 10, fontSize: 11, color: "#888", letterSpacing: 1, lineHeight: 1.6 }}>
        It will be able to read your stats, tasks, alarms, and recent completions, and mark a task complete for
        today. Your app permissions and backend policies still decide what data is accessible.
      </p>
      {error && (
        <p role="alert" style={{ marginTop: 12, fontSize: 12, color: "#ff9a9a" }}>
          {error}
        </p>
      )}
      <div style={{ marginTop: 20, display: "flex", gap: 10 }}>
        <button
          disabled={busy}
          onClick={() => decide(true)}
          style={{
            flex: 1,
            padding: "12px 16px",
            background: busy ? "#333" : G,
            color: "#000",
            fontWeight: 900,
            letterSpacing: 3,
            fontSize: 12,
            border: "none",
            cursor: busy ? "wait" : "pointer",
            borderRadius: 2,
            boxShadow: `0 0 20px ${G}66`,
          }}
        >
          APPROVE
        </button>
        <button
          disabled={busy}
          onClick={() => decide(false)}
          style={{
            flex: 1,
            padding: "12px 16px",
            background: "transparent",
            color: "#ccc",
            border: "1px solid #444",
            fontFamily: "monospace",
            fontWeight: 700,
            letterSpacing: 2,
            fontSize: 12,
            cursor: busy ? "wait" : "pointer",
            borderRadius: 2,
          }}
        >
          DENY
        </button>
      </div>
    </Shell>
  );
}
