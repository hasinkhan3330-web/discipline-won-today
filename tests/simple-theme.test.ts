import { describe, expect, test } from "bun:test";
import { normalizeTheme, readStoredTheme, THEME_KEY } from "../src/lib/theme/theme";
import { mapDeclaration, mapColor } from "../src/lib/theme/color-map";

const store = (v: string | null) => ({ getItem: (k: string) => (k === THEME_KEY ? v : null) });

describe("appearance setting", () => {
  test("no saved choice means Dark", () => expect(readStoredTheme(store(null))).toBe("dark"));
  test("saved Simple is restored", () => expect(readStoredTheme(store("simple"))).toBe("simple"));
  test("old Coach orb values fall back to Dark", () => expect(readStoredTheme(store("lime"))).toBe("dark"));
  test("blocked storage falls back to Dark", () => expect(readStoredTheme({ getItem: () => { throw new Error("blocked"); } })).toBe("dark"));
  test("unknown values are Dark", () => expect(normalizeTheme("light")).toBe("dark"));
  test("the key is axen-theme", () => expect(THEME_KEY).toBe("axen-theme"));
});

describe("Simple color rules", () => {
  test("neon lime text becomes ink", () => expect(mapColor("#C6F432", "fg")).toBe("#111111"));
  test("white text becomes ink", () => expect(mapColor("#ffffff", "fg")).toBe("#111111"));
  test("near-black page becomes canvas", () => expect(mapColor("#000000", "bg")).toBe("#F5F5F3"));
  test("dark card becomes white surface", () => expect(mapColor("#14141C", "bg")).toBe("#FFFFFF"));
  test("white/10 border becomes hairline", () => expect(mapColor("rgba(255,255,255,0.1)", "border")).toBe("#E7E7E3"));
  test("danger text uses Simple danger", () => expect(mapColor("#FF3B5C", "fg")).toBe("#C93A3A"));
  test("glows are removed", () => expect(mapDeclaration("box-shadow", "0 0 20px #C6F432")).toBe("none"));
  test("decorative gradients go flat", () => expect(mapDeclaration("background", "linear-gradient(90deg, #6C5CE7, #00D4FF)")).toBe("#111111"));
});
