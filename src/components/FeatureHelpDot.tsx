import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type HelpContent = { title: string; lines: string[]; question: string };

/** Tiny glowing info dot + premium glassmorphism bottom sheet. Layout-neutral. */
export function FeatureHelpDot({ label, content }: { label: string; content: HelpContent }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const askAi = () => {
    setOpen(false);
    window.dispatchEvent(new CustomEvent("axen:ask-coach", { detail: { question: content.question } }));
  };

  return (
    <>
      <button
        type="button"
        className="axh-dot"
        aria-label={`How ${label} works`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        •
      </button>
      {open && typeof document !== "undefined" && createPortal(
        <div className="axh-scrim" role="presentation" onClick={() => setOpen(false)}>
          <div className="axh-sheet" role="dialog" aria-modal="true" aria-label={`How ${label} works`} onClick={event => event.stopPropagation()}>
            <i className="axh-grip" />
            <h3>{content.title}</h3>
            <ul>{content.lines.map(line => <li key={line}>{line}</li>)}</ul>
            <p className="axh-note">Based on your completed actions, not a guarantee of results.</p>
            <div className="axh-actions">
              <button type="button" className="axh-ask" onClick={askAi}>Ask AXEN AI</button>
              <button type="button" className="axh-close" onClick={() => setOpen(false)}>Close</button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
