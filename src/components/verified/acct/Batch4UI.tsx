import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Copy, Download, Share2, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import s from "./acct.module.css";
import { Switch } from "./AcctUI";
import { inviteLink } from "./home-priority";
import { canShareFile, deviceGet, deviceSet, drawShareCard, saveBlob, shareFile, type CardData, type CardFormat } from "./share-card";

const MSG_KEY = "axen.acct.inviteMsg";
export const DEFAULT_INVITE_MSG = "Chal saath mein discipline banate hain 💪 Mera AXEN accountability partner banega? Roz ek chhota pact, ek dusre ko cheer. Is link se join kar:";
const hasShare = () => typeof navigator !== "undefined" && typeof (navigator as any).share === "function";

export function Portal({ theme, children }: { theme: string; children: ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(<div className={s.portal} data-theme={theme}>{children}</div>, document.body);
}

/** Invite actions for an existing pairing code. Message edits stay on this device. */
export function InviteActions({ code }: { code: string }) {
  const [msg, setMsg] = useState(DEFAULT_INVITE_MSG);
  useEffect(() => { const v = deviceGet(MSG_KEY); if (v) setMsg(v); }, []);
  const link = inviteLink(window.location.origin, code);
  const text = `${msg.trim()}\n${link}`;
  const copy = async () => { try { await navigator.clipboard.writeText(text); toast.success("Link copied"); } catch { toast.error("Couldn't copy. Long-press the link to copy."); } };
  const wa = async () => {
    if (hasShare()) { try { await (navigator as any).share({ text }); return; } catch (e) { if ((e as DOMException)?.name === "AbortError") return; } }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener");
  };
  return <div className={s.stack}>
    <label className={s.field} style={{ marginTop: 0 }}><span className={s.label}>Your message</span>
      <textarea className={s.fInput} rows={3} maxLength={280} value={msg} aria-label="Invite message" style={{ resize: "none" }}
        onChange={e => { setMsg(e.target.value); deviceSet(MSG_KEY, e.target.value); }} /></label>
    <div className={s.evidence} style={{ wordBreak: "break-all", fontSize: 12 }} aria-label="Invite link">{link}</div>
    <button className={s.limeBtn} onClick={() => void wa()}><MessageCircle size={18} /> Invite on WhatsApp</button>
    <button className={`${s.btn} ${s.ghost}`} onClick={() => void copy()}><Copy size={16} /> Copy link</button>
  </div>;
}

const NAME_KEY = "axen.acct.share.partnerName";
export function ShareSheet({ theme, data, partnerName, onClose }: { theme: string; data: CardData; partnerName: string | null; onClose: () => void }) {
  const [fmt, setFmt] = useState<CardFormat>("story");
  const [withName, setWithName] = useState(false);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [fail, setFail] = useState(false);
  useEffect(() => { setWithName(deviceGet(NAME_KEY) === "1"); }, []);
  useEffect(() => {
    let alive = true; let u: string | null = null; setFail(false);
    drawShareCard({ ...data, partnerFirst: withName ? partnerName : null }, fmt)
      .then(b => { if (!alive) return; u = URL.createObjectURL(b); setBlob(b); setUrl(u); })
      .catch(() => { if (alive) setFail(true); });
    return () => { alive = false; if (u) URL.revokeObjectURL(u); };
  }, [fmt, withName, data, partnerName]);
  const name = `axen-${data.kind}-${fmt === "story" ? "1080x1920" : "1080x1080"}.png`;
  const canShare = !!blob && canShareFile(blob, name);
  const copyLink = async () => { try { await navigator.clipboard.writeText("https://axonhabit.app"); toast.success("Link copied"); } catch { toast.error("Couldn't copy"); } };
  return <Portal theme={theme}>
    <div className={`${s.scrim} ${s.scrimCenter}`} onClick={onClose}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-label="Share card" onClick={e => e.stopPropagation()} style={{ maxHeight: "90vh", overflowY: "auto" }}>
        <div className={s.fRow}><div className={s.secTitle}>Share card</div><button className={s.round} aria-label="Close" onClick={onClose}><X size={16} /></button></div>
        <div className={s.row2}>
          {(["story", "square"] as const).map(f => <button key={f} className={`${s.chipBtn} ${fmt === f ? s.chipBtnOn : ""}`} aria-pressed={fmt === f} onClick={() => setFmt(f)}>{f === "story" ? "Story 9:16" : "Square 1:1"}</button>)}
        </div>
        <div className={s.shareFrame}>{url ? <img src={url} alt="Share card preview" className={s.shareImg} /> : fail ? <span className={s.muted}>Couldn't make the image on this device.</span> : <div className={s.skel} />}</div>
        {partnerName && <Switch label="Include my partner's first name" help="Off by default. Only their first name." checked={withName} onChange={v => { setWithName(v); deviceSet(NAME_KEY, v ? "1" : "0"); }} />}
        <div className={s.stack}>
          {canShare && <button className={s.limeBtn} onClick={() => blob && void shareFile(blob, name)}><Share2 size={18} /> Share</button>}
          <button className={canShare ? `${s.btn} ${s.ghost}` : s.limeBtn} disabled={!blob} onClick={() => blob && saveBlob(blob, name)}><Download size={16} /> Save image</button>
          {!canShare && <button className={`${s.btn} ${s.ghost}`} onClick={() => void copyLink()}><Copy size={16} /> Copy link</button>}
        </div>
      </div>
    </div>
  </Portal>;
}

export function MilestoneSheet({ theme, badge, title, sub, onShare, onClose }: { theme: string; badge: string; title: string; sub: string; onShare?: () => void; onClose: () => void }) {
  useEffect(() => { const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return <Portal theme={theme}>
    <div className={`${s.scrim} ${s.scrimCenter}`} onClick={onClose}>
      <div className={s.dialog} role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()} style={{ textAlign: "center" }}>
        <div className={s.badge} style={{ margin: "0 auto 10px" }}>{badge}</div>
        <div className={s.secTitle} style={{ fontSize: 20 }}>{title}</div>
        <p className={s.muted} style={{ fontSize: 13, margin: "6px 0 0" }}>{sub}</p>
        <div className={s.ctaCol}>
          {onShare && <button className={s.limeBtn} onClick={onShare}><Share2 size={16} /> Share card</button>}
          <button className={`${s.btn} ${s.ghost}`} onClick={onClose}>Continue</button>
        </div>
      </div>
    </div>
  </Portal>;
}
