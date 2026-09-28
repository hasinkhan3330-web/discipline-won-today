import { useRef, useState, type CSSProperties } from "react";
import { X, Camera } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { AX, buttonStyle, subText } from "@/tabs/styles";
import { haptic } from "@/lib/haptics";
import { submitContractProof } from "@/lib/verified/contract-proof.functions";
import { PROOF_METHODS, type ContractRow } from "@/lib/verified/contracts";

const CHECK_ITEMS = ["Started on time", "Stayed on the task", "Finished the planned work"];
const field: CSSProperties = {
  width: "100%", minHeight: 110, padding: "10px 12px", borderRadius: 12, background: "#181820",
  border: `1px solid ${AX.border}`, color: AX.text, fontFamily: AX.font, fontSize: 14, outline: "none", boxSizing: "border-box",
};

const readFile = (file: File) => new Promise<string>((res, rej) => {
  const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(new Error("read")); r.readAsDataURL(file);
});

export function ContractProofSheet({ contract, onClose, onDone }: { contract: ContractRow; onClose: () => void; onDone: () => void }) {
  const submit = useServerFn(submitContractProof);
  const method = contract.proof_method;
  const [recall, setRecall] = useState("");
  const [checks, setChecks] = useState<boolean[]>(CHECK_ITEMS.map(() => false));
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; good: boolean } | null>(null);
  const [done, setDone] = useState(false);
  const lock = useRef(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const go = async () => {
    if (lock.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) { setMsg({ text: "You're offline. Reconnect and try again.", good: false }); return; }
    lock.current = true; setBusy(true); setMsg(null);
    try {
      const r = await submit({ data: {
        contractId: contract.id,
        recall: method === "timer_recall" ? recall : undefined,
        checklist: method === "checklist" ? checks : undefined,
        imageBase64: method === "photo" ? photo ?? undefined : undefined,
      } });
      const good = r.ok && r.status === "verified";
      setMsg({ text: r.message, good });
      if (good || (r.ok && r.status === "needs_review")) { setDone(true); haptic?.("success" as never); }
    } catch (e) {
      const m = e instanceof Error && /unauth|401/i.test(e.message) ? "Your sign-in expired. Please sign in again." : "Something went wrong. Please retry.";
      setMsg({ text: m, good: false });
    } finally {
      lock.current = false; setBusy(false);
    }
  };

  const ready = method === "photo" ? !!photo : true;

  return (
    <div role="dialog" aria-modal="true" aria-label="Submit proof"
      style={{ position: "fixed", inset: 0, zIndex: 80, background: AX.bg, overflowY: "auto", fontFamily: AX.font,
        padding: "max(16px, env(safe-area-inset-top)) 18px max(24px, env(safe-area-inset-bottom))" }}>
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 18, fontWeight: 700, color: AX.text }}>Submit proof</div>
          <button aria-label="Close" onClick={done ? onDone : onClose} style={{ ...buttonStyle("ghost"), minHeight: 40, padding: "0 10px" }}><X size={18} /></button>
        </div>
        <div style={{ fontSize: 15, color: AX.text, marginTop: 14 }}>{contract.title}</div>
        <div style={{ ...subText, marginTop: 4 }}>Proof: {PROOF_METHODS.find(p => p.id === method)?.label ?? method}</div>

        <div style={{ marginTop: 18 }}>
          {method === "timer" && <div style={subText}>Your completed focus session is your proof. Tap submit to confirm.</div>}
          {method === "timer_recall" && (<>
            <label htmlFor="recall" style={{ ...subText, display: "block", marginBottom: 6 }}>In a few sentences, what did you get done?</label>
            <textarea id="recall" style={field} maxLength={600} value={recall} onChange={e => setRecall(e.target.value)} disabled={busy || done} />
          </>)}
          {method === "checklist" && CHECK_ITEMS.map((t, i) => (
            <label key={t} style={{ display: "flex", alignItems: "center", gap: 10, minHeight: 44, color: AX.text, fontSize: 14 }}>
              <input type="checkbox" checked={checks[i]} disabled={busy || done}
                onChange={e => setChecks(c => c.map((v, j) => (j === i ? e.target.checked : v)))} style={{ width: 20, height: 20 }} />{t}
            </label>
          ))}
          {method === "photo" && (<>
            <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
              onChange={async e => { const f = e.target.files?.[0]; if (f) { try { setPhoto(await readFile(f)); } catch { setMsg({ text: "Could not read that photo.", good: false }); } } }} />
            {photo && <img src={photo} alt="Your proof photo" style={{ width: "100%", borderRadius: 12, marginBottom: 10 }} />}
            <button style={{ ...buttonStyle("ghost"), width: "100%" }} onClick={() => fileRef.current?.click()} disabled={busy || done}>
              <Camera size={16} style={{ marginRight: 6, verticalAlign: "middle" }} />{photo ? "Change photo" : "Take or choose photo"}
            </button>
            <div style={{ ...subText, marginTop: 6 }}>The photo is checked and then discarded — it is never saved.</div>
          </>)}
          {method === "zen_session" && <div style={subText}>Complete a Zen session after your focus session, then submit.</div>}
        </div>

        {msg && <div role="status" style={{ marginTop: 14, fontSize: 13, color: msg.good ? AX.success : AX.flame }}>{msg.text}</div>}
        {done
          ? <button style={{ ...buttonStyle(), width: "100%", marginTop: 16, minHeight: 48 }} onClick={onDone}>DONE</button>
          : <button style={{ ...buttonStyle(), width: "100%", marginTop: 16, minHeight: 48 }} onClick={() => void go()} disabled={busy || !ready}>{busy ? "CHECKING…" : "SUBMIT PROOF"}</button>}
      </div>
    </div>
  );
}
