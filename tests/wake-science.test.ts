import { expect, test } from "bun:test";
import bank from "../src/lib/wake-science-bank.server.json";

test("400 unique private science questions across five categories", () => {
  expect(bank.length).toBe(400);
  expect(new Set(bank.map(q => q.question_text)).size).toBe(400);
  expect([...new Set(bank.map(q => q.subject))].sort()).toEqual(["astronomy", "biology", "chemistry", "earth", "physics"]);
  for (const q of bank) {
    expect(q.wake_only).toBe(true);
    expect(q.options.length).toBe(4);
    expect(new Set(q.options).size).toBe(4);
    expect(Number(q.correct_answer)).toBeGreaterThanOrEqual(0);
    expect(Number(q.correct_answer)).toBeLessThan(4);
    expect(q.fact_source.startsWith("https://")).toBe(true);
  }
});
test("standard RNA code includes all 64 codons with explicit code context", () => {
  const codons = bank.filter(q => q.question_text.startsWith("In the standard genetic code"));
  expect(codons.length).toBe(64);
  const answer = (codon: string) => { const q = codons.find(x => x.question_text.includes(`codon ${codon} `)); return q?.options[Number(q.correct_answer)]; };
  expect(answer("AUG")).toBe("Methionine");
  expect(answer("UGG")).toBe("Tryptophan");
  for (const codon of ["UAA", "UAG", "UGA"]) expect(answer(codon)).toBe("Stop signal");
});
test("Mohs and planet comparisons select unique correct extrema", () => {
  const minerals = ["Talc", "Gypsum", "Calcite", "Fluorite", "Apatite", "Orthoclase feldspar", "Quartz", "Topaz", "Corundum", "Diamond"];
  const planets = ["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"];
  for (const q of bank.filter(q => q.question_text.startsWith("Which has the greatest Mohs"))) {
    expect(minerals.indexOf(q.options[Number(q.correct_answer)] ?? "")).toBe(Math.max(...q.options.map(x => minerals.indexOf(x))));
  }
  for (const q of bank.filter(q => q.question_text.startsWith("Which listed planet is nearest"))) {
    expect(planets.indexOf(q.options[Number(q.correct_answer)] ?? "")).toBe(Math.min(...q.options.map(x => planets.indexOf(x))));
  }
});