import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, ChevronDown } from "lucide-react";
import { useTheme, type AppTheme } from "@/lib/theme/theme";
import s from "./appearance.module.css";

const OPTIONS: Array<{ id: AppTheme; name: string; tag: string }> = [
  { id: "dark", name: "Dark", tag: "Neon focus" },
  { id: "simple", name: "Simple", tag: "Clean & light" },
];

function Preview({ id }: { id: AppTheme }) {
  const dark = id === "dark";
  // Fixed preview colors (the only hardcoded colors allowed outside token files).
  const bg = dark ? "#0B1220" : "#F5F5F3", card = dark ? "#131C2E" : "#FFFFFF", ink = dark ? "#C6FF3D" : "#111111", line = dark ? "#26324A" : "#E7E7E3", txt = dark ? "#E8EEF8" : "#111111";
  return (
    <span className={s.phone} style={{ background: bg, borderColor: line }} aria-hidden="true">
      <span className={s.bar} style={{ background: txt, opacity: 0.85 }} />
      <span className={s.card} style={{ background: card, borderColor: line }}>
        <span className={s.ring} style={{ borderColor: ink }} />
        <span className={s.lines}><i style={{ background: txt }} /><i style={{ background: txt, opacity: 0.45 }} /></span>
      </span>
      <span className={s.pill} style={{ background: ink }} />
      <span className={s.card} style={{ background: card, borderColor: line, height: 14 }} />
    </span>
  );
}

export function AppearanceSwitcher() {
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const timer = useRef(0);
  const pick = (t: AppTheme) => {
    setTheme(t);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), 250);
  };
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button type="button" className={s.trigger} data-open={open || undefined} aria-label="Change appearance" data-simple-keep="">
          <span className={s.circle}><ChevronDown size={20} strokeWidth={2} /></span>
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={s.scrim} data-simple-keep="" />
        <Dialog.Content className={s.sheet} data-simple-keep="" aria-describedby={undefined}>
          <span className={s.grabber} aria-hidden="true" />
          <Dialog.Title className={s.title}>Appearance</Dialog.Title>
          <div role="radiogroup" aria-label="Appearance" className={s.options}>
            {OPTIONS.map((o) => {
              const on = theme === o.id;
              return (
                <button key={o.id} type="button" role="radio" aria-checked={on} className={s.option} data-on={on || undefined} onClick={() => pick(o.id)}>
                  <Preview id={o.id} />
                  <span className={s.name}>{o.name}</span>
                  <span className={s.tag}>{o.tag}</span>
                  {on && <span className={s.check}><Check size={14} strokeWidth={3} /></span>}
                </button>
              );
            })}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
