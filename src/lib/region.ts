const EU = new Set([
  "AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU",
  "MT","NL","PL","PT","RO","SK","SI","ES","SE",
]);

export type Region = "IN" | "US" | "EU" | "ROW";

const KEY = "dwt_region";

export function regionForCountry(country: string | null): Region {
  if (!country) return "ROW";
  const c = country.toUpperCase();
  if (c === "IN") return "IN";
  if (c === "US") return "US";
  if (EU.has(c)) return "EU";
  return "ROW";
}

/** Detects the buyer's region once per session (Cloudflare trace), cached in sessionStorage. */
export async function detectRegion(): Promise<Region> {
  try {
    const cached = sessionStorage.getItem(KEY);
    if (cached) return cached as Region;
  } catch { /* storage unavailable */ }

  let region: Region = "ROW";
  try {
    const res = await fetch("https://cloudflare.com/cdn-cgi/trace");
    const text = await res.text();
    const loc = text.split("\n").find(l => l.startsWith("loc="))?.slice(4) ?? null;
    region = regionForCountry(loc);
  } catch {
    region = "ROW";
  }
  try { sessionStorage.setItem(KEY, region); } catch { /* ignore */ }
  return region;
}

const SUFFIX: Record<Region, string> = { IN: "_inr", US: "", EU: "_eur", ROW: "_row" };

export function priceIdFor(region: Region, cycle: "monthly" | "yearly"): string {
  return `dwt_pro_${cycle}${SUFFIX[region]}`;
}

export const REGION_PRICING: Record<Region, { label: string; monthly: string; yearly: string; save: string }> = {
  IN:  { label: "INDIA",         monthly: "₹49 / mo",    yearly: "₹999 / yr",   save: "SAVE 30%" },
  US:  { label: "UNITED STATES", monthly: "$4.99 / mo",  yearly: "$29.99 / yr", save: "SAVE 50%" },
  EU:  { label: "EUROPE",        monthly: "€3.99 / mo",  yearly: "€24.99 / yr", save: "SAVE 48%" },
  ROW: { label: "GLOBAL",        monthly: "$3.49 / mo",  yearly: "$20.99 / yr", save: "SAVE 50%" },
};
