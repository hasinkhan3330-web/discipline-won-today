// Original AXEN typing-mission sentences, composed from hand-written fragments.
// The server stores the same bank privately (wake_typing_sentences) and issues them;
// this module is the single source used to generate that seed and to test word counts.
export type MissionLang = "en" | "hi";
export type MissionDifficulty = 1 | 2 | 3;

const words = (s: string) => s.trim().split(/\s+/).length;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type Parts = { a: string[]; b: string[]; c: string[]; d: string[] };
const EN: Parts = {
  a: ["open your eyes", "stand up slowly", "breathe in deeply", "drink some water", "stretch your arms", "feel the light", "start the day", "wake your mind", "plant your feet", "lift your head"],
  b: ["and smile today", "before you scroll", "and begin again", "with a calm heart", "and keep moving", "for one more win", "and choose to grow", "while the world sleeps"],
  c: ["because today matters", "one small step counts", "the morning is yours", "your future is listening", "every minute builds you", "progress loves early hours", "discipline feels like freedom", "quiet effort wins"],
  d: ["then write one clear goal", "then do the hardest task first", "then thank yourself for showing up", "then keep your promise to yourself", "then move with purpose and patience", "then let the work speak for you"],
};
const HI: Parts = {
  a: ["aankhen kholo dost", "dheere se utho", "gehri saans lo", "thoda paani piyo", "haath faila do", "roshni ko dekho", "din shuru karo", "dimaag jagao", "pair zameen par", "sir upar uthao"],
  b: ["aur muskurao aaj", "phone se pehle", "aur phir se shuru", "shaant dil ke saath", "aur chalte raho", "ek aur jeet ke liye", "aur aage badho", "jab duniya so rahi"],
  c: ["kyunki aaj zaroori hai", "chhota kadam bhi ginta hai", "subah tumhari hai", "tumhara kal sun raha hai", "har minute tumhe banata hai", "mehnat subah pasand karti hai", "anushasan hi azaadi hai", "chupchaap mehnat jeetti hai"],
  d: ["phir ek saaf goal likho", "phir sabse mushkil kaam pehle karo", "phir khud ko shukriya bolo", "phir apna vaada nibhao", "phir dhyaan aur sabr se chalo", "phir kaam ko bolne do"],
};

function build(src: Parts, d: MissionDifficulty): string[] {
  const out: string[] = [];
  if (d === 1) for (const a of src.a) for (const b of src.b) { const s = `${a} ${b}`; if (words(s) >= 6 && words(s) <= 8) out.push(s); }
  if (d === 2) for (const c of src.c) for (const a of src.a) for (const b of src.b) { const s = `${a} ${b} ${c}`; if (words(s) >= 10 && words(s) <= 14) out.push(s); }
  if (d === 3) for (const dd of src.d) for (const c of src.c) for (const a of src.a) for (const b of src.b) {
    const s = `${cap(a)}, ${b}; ${c}, ${dd}.`;
    if (words(s) >= 18 && words(s) <= 24) out.push(s);
  }
  const step = Math.max(1, Math.floor(out.length / 72));
  return out.filter((_, i) => i % step === 0).slice(0, 72);
}

export const SENTENCES: Record<MissionLang, Record<MissionDifficulty, string[]>> = {
  en: { 1: build(EN, 1), 2: build(EN, 2), 3: build(EN, 3) },
  hi: { 1: build(HI, 1), 2: build(HI, 2), 3: build(HI, 3) },
};
export const sentenceWords = words;
