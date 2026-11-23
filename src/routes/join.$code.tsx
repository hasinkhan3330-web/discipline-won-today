import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvite } from "@/lib/verified/accountability.functions";
import { useTheme } from "@/lib/theme/theme";
import s from "@/components/verified/acct/acct.module.css";
import { EntitlementProvider } from "@/components/EntitlementProvider";
import { ProtectedFeatureGate } from "@/components/ProtectedFeatureGate";

const PENDING_JOIN_KEY = "axen.acct.join";

export const Route = createFileRoute("/join/$code")({
  head: () => ({
    meta: [
      { title: "Join me on AXEN" },
      { name: "description", content: "AXEN is a discipline app where partners keep each other on track." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Join me on AXEN" },
      { property: "og:description", content: "Be my accountability partner on AXEN." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: JoinPage,
});

const clean = (c: string) => c.replace(/[^0-9A-Fa-f]/g, "").slice(0, 32);
const FAIL = "This invite can't be used. Ask your friend for a fresh link.";

function JoinPage() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const doAccept = useServerFn(acceptInvite);
  const { theme } = useTheme();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [uid, setUid] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { void supabase.auth.getSession().then(({ data }) => { setAuthed(!!data.session); setUid(data.session?.user.id ?? null); }); }, []);
  const forget = () => { try { localStorage.removeItem(PENDING_JOIN_KEY); } catch { /* storage off */ } };
  const login = () => {
    try { localStorage.setItem(PENDING_JOIN_KEY, JSON.stringify({ code: clean(code), at: Date.now() })); } catch { /* storage off */ }
    void navigate({ to: "/" });
  };
  const join = async () => {
    if (busy) return; setBusy(true);
    try {
      const r = await doAccept({ data: { code: clean(code) } });
      forget();
      if (r.ok) { toast.success("Partner connected"); void navigate({ to: "/dashboard", replace: true }); } else setMsg(FAIL);
    } catch { setMsg(FAIL); } finally { setBusy(false); }
  };
  const notNow = () => { forget(); void navigate({ to: authed ? "/dashboard" : "/", replace: true }); };
  return (
    <main className={`${s.root} ${s.joinPage}`} data-theme={theme === "dark" ? "dark" : "light"}>
      <div className={s.card}>
        <div className={s.secTitle} style={{ fontSize: 22, color: "var(--a-ring)" }}>AXEN</div>
        {authed === null ? <div className={s.skel} style={{ marginTop: 12 }} />
          : msg ? <>
            <p className={s.muted} style={{ fontSize: 14, margin: "12px 0 0" }} role="status">{msg}</p>
            <div className={s.ctaCol}><button className={`${s.btn} ${s.ghost}`} onClick={notNow}>Go to AXEN</button></div>
          </>
          : authed ? <EntitlementProvider userId={uid}><ProtectedFeatureGate featureName="Accountability" onUpgrade={() => void navigate({ to: "/pro" })} onContinueBasic={notNow}>
            <div className={s.secTitle} style={{ fontSize: 18, marginTop: 10 }}>Partner invite ready. Join?</div>
            <div className={s.ctaCol}>
              <button className={s.limeBtn} onClick={() => void join()} disabled={busy}>{busy ? "Joining…" : "Join"}</button>
              <button className={`${s.btn} ${s.ghost}`} onClick={notNow} disabled={busy}>Not now</button>
            </div>
          </ProtectedFeatureGate></EntitlementProvider> : <>
            <p className={s.muted} style={{ fontSize: 14, margin: "10px 0 0" }}>AXEN helps friends build discipline together, one small daily pact at a time.</p>
            <div className={s.ctaCol}><button className={s.limeBtn} onClick={login}>Log in or sign up</button></div>
          </>}
      </div>
    </main>
  );
}
