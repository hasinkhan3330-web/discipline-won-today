import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { startSimple, stopSimple } from "./simple-engine";

export type AppTheme = "dark" | "simple";
export const THEME_KEY = "axen-theme";

/** Anything other than "simple" is Dark (today's default look). */
/** Only an explicit saved "dark" is Dark; nothing saved (or anything else) defaults to Simple. */
export function normalizeTheme(v: unknown): AppTheme { return v === "dark" ? "dark" : "simple"; }

export function readStoredTheme(storage: Pick<Storage, "getItem"> | null | undefined): AppTheme {
  try { return normalizeTheme(storage?.getItem(THEME_KEY)); } catch { return "simple"; }
}

/** Runs in <head> before the app draws: applies a saved Simple choice with no dark flash. */
export const THEME_BOOT_SCRIPT = `(function(){try{var s=null;try{s=localStorage.getItem('${THEME_KEY}')}catch(e){}if(s!=='dark'){var d=document.documentElement;d.setAttribute('data-theme','simple');d.setAttribute('data-simple-pending','');setTimeout(function(){d.removeAttribute('data-simple-pending')},2500);}}catch(e){}})();`;

function applyDom(theme: AppTheme) {
  const d = document.documentElement;
  let meta = document.querySelector('meta[name="theme-color"][data-axen]') as HTMLMetaElement | null;
  if (theme === "simple") {
    d.setAttribute("data-theme", "simple");
    startSimple();
    if (!meta) { meta = document.createElement("meta"); meta.name = "theme-color"; meta.setAttribute("data-axen", ""); document.head.appendChild(meta); }
    meta.content = "#F5F5F3";
  } else {
    stopSimple();
    d.removeAttribute("data-theme");
    meta?.remove();
  }
  d.removeAttribute("data-simple-pending");
}

const Ctx = createContext<{ theme: AppTheme; setTheme: (t: AppTheme) => void }>({ theme: "simple", setTheme: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<AppTheme>("simple");
  useEffect(() => {
    const t = readStoredTheme(window.localStorage);
    setThemeState(t);
    applyDom(t);
  }, []);
  const setTheme = useCallback((t: AppTheme) => {
    const d = document.documentElement;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduce) { d.classList.add("theme-switching"); window.setTimeout(() => d.classList.remove("theme-switching"), 320); }
    try { window.localStorage.setItem(THEME_KEY, t); } catch { /* private mode */ }
    applyDom(t);
    setThemeState(t);
  }, []);
  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
