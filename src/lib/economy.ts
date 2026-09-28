/**
 * Single source of truth for AXEN reward rules shown in the UI and taught to
 * the Coach. The server functions enforce the same numbers.
 */
export const DAILY_COIN_CAP = 50;
export const COIN_RULES = {
  contractVerified: 20,
  contractRecovery: 2,
  contractXp: 20,
  recoveryXp: 8,
  deepFocus: { "49 min": 10, "2 hours": 10, "3 hours": 15 },
  wakeChallenge: 10,
  priorityHabit: 3,
  customHabit: { min: 1, max: 5, default: 2 },
  zen: 5,
  top3: [7, 7, 6],
  focusMusic: 0,
} as const;

export const GOAL_TARGET_COINS = 18000;
export type GoalPlanKey = "1_year" | "6_month" | "3_month";
export const GOAL_PLANS: { key: GoalPlanKey; short: string; duration: string; target: number }[] = [
  { key: "1_year", short: "1 Year", duration: "1 year", target: 18000 },
  { key: "6_month", short: "6 Months", duration: "6 months", target: 9000 },
  { key: "3_month", short: "3 Months", duration: "3 months", target: 4500 },
];
export const goalPlanForTarget = (target?: number | null) =>
  GOAL_PLANS.find(p => p.target === target) ?? GOAL_PLANS[0];
export const GOAL_PROMISE =
  "Action Promise: Reach 18,000 coins and unlock a 90% probability of success in your goal — whether you're a student, athlete, boxer, or professional in any field. Consistency compounds. 18,000 coins is your proof of work.";

export type MilestoneTone = "yellow" | "green" | "blue" | "red" | "diamond";
export const STREAK_MILESTONES: { days: number; coins: number; tone: MilestoneTone }[] = [
  { days: 7, coins: 350, tone: "yellow" },
  { days: 21, coins: 1050, tone: "green" },
  { days: 100, coins: 5000, tone: "blue" },
  { days: 290, coins: 14500, tone: "red" },
  { days: 365, coins: 18250, tone: "diamond" },
];

export function topMilestone(bestStreak: number) {
  return [...STREAK_MILESTONES].reverse().find(m => bestStreak >= m.days) ?? null;
}

export const XP_RULES = [
  { title: "Complete Habits", xp: "+10 XP" },
  { title: "Achieve Goals", xp: "+20 XP" },
  { title: "Stay Consistent", xp: "+5 XP daily" },
  { title: "Use Focus Mode", xp: "+15 XP" },
  { title: "Meditate", xp: "+10 XP" },
  { title: "Unlock Achievements", xp: "+25 XP" },
];
