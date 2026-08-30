import { AX, cardStyle, titleStyle } from "@/tabs/styles";
import { Lightbulb } from "lucide-react";

type Heat = { date: string; count: number };

/**
 * Rule-based weekly insight — derived purely from the user's own completion
 * data. No AI, no invented numbers. Falls back to a clear empty state when
 * there isn't enough history yet.
 */
export function buildInsight(weekly: number[], heat: Heat[], taskTotal: number): { headline: string; detail: string } | null {
  const days = weekly.filter(v => typeof v === "number");
  const recorded = heat.filter(h => h.count > 0).length;
  if (recorded < 3 || days.length < 7 || taskTotal <= 0) return null;

  const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const avg = Math.round(days.reduce((a, b) => a + b, 0) / days.length);

  const prev = heat.slice(-14, -7);
  const last = heat.slice(-7);
  const pctOf = (rows: Heat[]) =>
    rows.length ? Math.round((rows.reduce((s, r) => s + Math.min(r.count, taskTotal), 0) / (rows.length * taskTotal)) * 100) : 0;
  const lastPct = pctOf(last);
  const prevPct = pctOf(prev);

  let weakIdx = 0;
  days.forEach((v, i) => { if (v < days[weakIdx]) weakIdx = i; });
  let strongIdx = 0;
  days.forEach((v, i) => { if (v > days[strongIdx]) strongIdx = i; });

  const perfect = days.filter(v => v >= 100).length;

  if (prev.length === 7 && lastPct - prevPct >= 10) {
    return {
      headline: `Up ${lastPct - prevPct} points versus last week`,
      detail: `You completed ${lastPct}% of your habits this week, against ${prevPct}% the week before. ${labels[strongIdx]} was your strongest day.`,
    };
  }
  if (prev.length === 7 && prevPct - lastPct >= 10) {
    return {
      headline: `Down ${prevPct - lastPct} points versus last week`,
      detail: `This week landed at ${lastPct}%, last week was ${prevPct}%. ${labels[weakIdx]} pulled the average down — start there.`,
    };
  }
  if (perfect >= 5) {
    return {
      headline: `${perfect} complete days this week`,
      detail: `Your weekly average is ${avg}%. This is the consistency band where streaks actually survive.`,
    };
  }
  if (days[weakIdx] < avg - 15) {
    return {
      headline: `${labels[weakIdx]} is your weakest day`,
      detail: `${labels[weakIdx]} sits at ${days[weakIdx]}% while your week averages ${avg}%. Set a reminder for that day and the average moves on its own.`,
    };
  }
  return {
    headline: `Weekly average: ${avg}%`,
    detail: `You logged habits on ${recorded} of the last 30 days. ${labels[strongIdx]} is currently your most reliable day.`,
  };
}

export function WeeklyInsight({ weekly, heat, taskTotal }: { weekly: number[]; heat: Heat[]; taskTotal: number }) {
  const CARD = cardStyle();
  const insight = buildInsight(weekly, heat, taskTotal);

  return (
    <div style={CARD}>
      <div style={titleStyle}>
        <Lightbulb size={16} strokeWidth={1.8} color={AX.accent} />
        Weekly insight
      </div>
      {insight ? (
        <>
          <div style={{ fontSize: 16, fontWeight: 600, color: AX.text }}>{insight.headline}</div>
          <div style={{ fontSize: 13, color: AX.muted, marginTop: 6, lineHeight: 1.6 }}>{insight.detail}</div>
        </>
      ) : (
        <div style={{ fontSize: 13, color: AX.muted, lineHeight: 1.6 }}>
          Not enough history yet. Complete habits on three separate days and your first insight appears here.
        </div>
      )}
    </div>
  );
}
