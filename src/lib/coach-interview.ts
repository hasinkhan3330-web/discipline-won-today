import type { Slots } from './coach-plan-rules';

export const MAX_INTERVIEW_QUESTIONS = 6;
export const MAX_SETUP_QUESTIONS = 3;
export function requestsPlan(text: string) {
  return /\b(?:create|build|make|generate|start|give|want|need|plan)\b.*\bplan\b|\bplan\s+(?:my|for|please|bana|banao)|(?:mera|mere|mujhe)\s+.*plan|plan.*(?:bana|banao)/i.test(text);
}
export function shouldDraft(text: string, questions: number, setup = false) {
  return requestsPlan(text) || questions >= (setup ? MAX_SETUP_QUESTIONS : MAX_INTERVIEW_QUESTIONS);
}
export function requestedLength(text: string): 1 | 7 | 21 {
  if (/21\s*[- ]?days?/i.test(text)) return 21;
  if (/7\s*[- ]?days?|week/i.test(text)) return 7;
  return 1;
}
/** Explicit clock/time facts only; never label defaults as user answers. */
export function spokenSlots(text: string): Slots {
  const slots: Slots = {};
  const save = (key: string, value: unknown) => { slots[key] = { value, confidence: 1 }; };
  const wake = text.match(/wake(?:\s+up)?\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)/i);
  const sleep = text.match(/sleep\s+(?:at\s+)?(\d{1,2}(?::\d{2})?\s*[ap]\.?m\.?)/i);
  const hours = text.match(/(?:do|have|available|spend)\s+(\d+(?:\.\d+)?)\s*hours?/i);
  if (wake) save('wake_time', wake[1]?.replace(/\.$/, ''));
  if (sleep) save('sleep_time', sleep[1]?.replace(/\.$/, ''));
  if (wake || sleep) save('daily_schedule', text);
  if (hours) save('daily_time_available', Number(hours[1]) * 60);
  if (/physics\s+numericals/i.test(text)) save('goal', 'Physics numericals');
  return slots;
}
export function planningDefaults(slots: Slots) {
  const defaults: Record<string, unknown> = { goal: 'Build a sustainable daily routine', daily_time_available: 30, daily_schedule: 'Flexible daytime schedule', energy_peak: 'Morning', distraction_trigger: 'Phone notifications', wake_time: '07:00', sleep_time: '23:00', coach_style: 'calm' };
  const filled: Slots = { ...slots }; const assumptions: string[] = [];
  for (const [key, value] of Object.entries(defaults)) {
    if (filled[key]?.value === undefined || filled[key]?.value === '') {
      filled[key] = { value, confidence: 0 };
      assumptions.push(`${key.replaceAll('_', ' ')}: ${value}`);
    }
  }
  if (!slots.age_range?.value) assumptions.push('Age unknown; gentle, age-safe guidance');
  return { slots: filled, assumptions };
}