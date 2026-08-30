import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Sitewide banner: shows a red "PAYMENT FAILED" strip whenever the current
// subscription mandate is failing, and an amber strip when the subscription
// is set to end. Both render at the top of every authenticated screen.
export function AccountStatusStrip() {
  const [pastDue, setPastDue] = useState(false);
  const [shortUrl, setShortUrl] = useState<string | null>(null);
  const [cancelInfo, setCancelInfo] = useState<{ endDate: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return;
      const { data } = await supabase
        .from("subscriptions")
        .select("status, cancel_at_period_end, current_period_end, short_url")
        .eq("user_id", u.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      setPastDue(data?.status === "past_due");
      setShortUrl((data?.short_url as string | null) ?? null);
      const willCancel = !!data && (data.cancel_at_period_end || data.status === "canceled") && !!data.current_period_end && new Date(data.current_period_end) > new Date();
      setCancelInfo(willCancel
        ? { endDate: new Date(data!.current_period_end!).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) }
        : null);
    };
    load();
    const onFocus = () => load();
    window.addEventListener("focus", onFocus);
    window.addEventListener("subscription:refresh", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("subscription:refresh", onFocus);
    };
  }, []);

  const linkStyle = (bg: string, fg: string) => ({
    marginLeft: 8, background: bg, color: fg, border: "none",
    padding: "3px 10px", fontFamily: "monospace", fontSize: 10, fontWeight: 900,
    letterSpacing: 2, borderRadius: 2, textDecoration: "none", display: "inline-block",
  }) as const;

  return (
    <>
      {pastDue && (
        <div style={{
          width: "100%", background: "#3a0f0f", color: "#ffb3b3",
          padding: "8px 12px", textAlign: "center",
          fontFamily: "monospace", fontSize: "clamp(9px, 2.8vw, 11px)", letterSpacing: "clamp(1px, 0.4vw, 2px)", fontWeight: 800, overflowWrap: "anywhere",
          borderBottom: "1px solid #ff4d4d55",
        }}>
          ⚠ PAYMENT FAILED — we're retrying.
          {shortUrl && <a href={shortUrl} target="_blank" rel="noopener noreferrer" style={linkStyle("#ff4d4d", "#000")}>UPDATE PAYMENT</a>}
        </div>
      )}
      {!pastDue && cancelInfo && (
        <div style={{
          width: "100%", background: "#3a2a08", color: "#ffd88a",
          padding: "7px 12px", textAlign: "center",
          fontFamily: "monospace", fontSize: "clamp(9px, 2.8vw, 11px)", letterSpacing: "clamp(1px, 0.4vw, 2px)", fontWeight: 800, overflowWrap: "anywhere",
          borderBottom: "1px solid #ffb84d55",
        }}>
          ◌ SUBSCRIPTION ENDS {cancelInfo.endDate.toUpperCase()}
        </div>
      )}
    </>
  );
}
