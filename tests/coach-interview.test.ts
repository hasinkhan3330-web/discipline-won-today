import { expect, test } from 'bun:test';
import { planningDefaults, shouldDraft, spokenSlots } from '../src/lib/coach-interview';
import { profileConfidence, canBuildPlan } from '../src/lib/coach-plan-rules';

test('explicit spoken/typed plan requests bypass confidence', () => {
  expect(canBuildPlan({})).toBe(false);
  expect(shouldDraft('Create my plan.', 0)).toBe(true);
  expect(shouldDraft('I want a 21-day plan', 0)).toBe(true);
});
test('six questions stop the regular interview, not five', () => {
  expect(shouldDraft('Not sure', 5)).toBe(false);
  expect(shouldDraft('Not sure', 6)).toBe(true);
});
test('quick setup allows at most three gap questions', () => {
  expect(shouldDraft('Not sure', 2, true)).toBe(false);
  expect(shouldDraft('Not sure', 3, true)).toBe(true);
});
test('scripted audio facts save certain slots with positive confidence', () => {
  const slots = spokenSlots('I wake at 4am, do 3 hours of physics numericals, sleep at 11pm. Create my plan.');
  expect(slots.wake_time?.value).toBe('4am');
  expect(slots.sleep_time?.value).toBe('11pm');
  expect(slots.daily_time_available?.value).toBe(180);
  expect(slots.goal?.value).toBe('Physics numericals');
  expect(profileConfidence(slots)).toBeGreaterThan(0);
  expect(Object.values(slots).every(s => s.confidence === 1)).toBe(true);
});
test('defaults are disclosed, never treated as learned answers', () => {
  const result = planningDefaults({ daily_time_available: { value: 180, confidence: 1 } });
  expect(result.slots.daily_time_available?.value).toBe(180);
  expect(result.slots.wake_time?.confidence).toBe(0);
  expect(result.assumptions).toContain('wake time: 07:00');
  expect(result.assumptions).not.toContain('daily time available: 30');
});
import { getProfileCompleteness } from '../src/lib/coach-plan-rules';
test('quick setup fields give exactly 75%, age adds 10, guesses do not count', () => {
  const one = { value: 'x', confidence: 1 };
  const quick = { goal: one, wake_time: one, sleep_time: one, daily_time_available: one, distraction_trigger: one, intensity: one, energy_peak: { value: 'Morning', confidence: 0 } };
  const r = getProfileCompleteness(quick);
  expect(r.percent).toBe(75);
  expect(r.missing).toEqual(['age_range', 'energy_peak', 'weakest_habit']);
  expect(getProfileCompleteness({ ...quick, age_range: { value: '18_24', confidence: 1 } }).percent).toBe(85);
});

import { savedChoices } from "../src/components/coach/CoachQuickSetup";
test("quick setup highlights come only from saved values", () => {
  expect(savedChoices({})).toEqual({});
  expect(savedChoices({ goal: { value: "Study", confidence: 1 }, daily_time_available: { value: 30, confidence: 1 }, intensity: { value: "Hardcore", confidence: 1 } }))
    .toEqual({ goal: "Study", daily_time_available: "30 min", intensity: "Hardcore" });
});
