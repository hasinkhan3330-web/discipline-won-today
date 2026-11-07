import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { runCoachToolFn } from '@/utils/coach-v2.functions';
import { Button } from '@/components/ui/button';
import s from './coach-plan.module.css';

const groups = [
  { key: 'goal', label: 'Your goal', options: ['Study', 'Exercise', 'Phone addiction', 'Sleep', 'Other'] },
  { key: 'wake_time', label: 'Wake time', options: ['04:00', '05:00', '06:00', '07:00', '08:00'] },
  { key: 'sleep_time', label: 'Sleep time', options: ['21:00', '22:00', '23:00', '00:00'] },
  { key: 'daily_time_available', label: 'Daily time available', options: ['30 min', '1 h', '2 h', '3 h+'] },
  { key: 'distraction_trigger', label: 'Main distraction', options: ['Phone', 'Social media', 'Noise', 'Procrastination', 'Other'] },
  { key: 'intensity', label: 'Intensity', options: ['Gentle', 'Balanced', 'Hardcore'] },
] as const;
export function CoachQuickSetup({ onDone }: { onDone: () => void }) {
  const run = useServerFn(runCoachToolFn);
  const [selected, setSelected] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState(false);
  const pick = async (key: string, choice: string) => {
    setBusy(true); setError(false);
    const value = key === 'daily_time_available' ? ({ '30 min': 30, '1 h': 60, '2 h': 120, '3 h+': 180 }[choice] ?? 30) : choice;
    const slots: Record<string, { value: unknown; confidence: number }> = { [key]: { value, confidence: 1 } };
    if (key === 'intensity') slots.coach_style = { value: choice === 'Hardcore' ? 'strict' : choice === 'Gentle' ? 'calm' : 'friendly', confidence: 1 };
    const next = { ...selected, [key]: choice };
    if (next.wake_time && next.sleep_time) slots.daily_schedule = { value: `Wake ${next.wake_time}; sleep ${next.sleep_time}`, confidence: 1 };
    try {
      const result = await run({ data: { name: 'update_profile', args: { slots } } });
      if (result?.ok === false) throw new Error('save failed');
      setSelected(next); window.dispatchEvent(new Event('axen:coach-plan-changed'));
    } catch { setError(true); } finally { setBusy(false); }
  };
  return <section className={s.setup} aria-label="Quick Coach setup">
    <strong>Quick setup</strong>
    {groups.map(group => <fieldset key={group.key} className={s.setupGroup}><legend>{group.label}</legend><div className={s.options}>{group.options.map(choice => <Button key={choice} variant="outline" aria-pressed={selected[group.key] === choice} disabled={busy} onClick={() => void pick(group.key, choice)}>{choice}</Button>)}</div></fieldset>)}
    {error && <p className={s.error}>Couldn't save that choice. Tap again.</p>}
    <Button disabled={busy || groups.some(group => !selected[group.key])} onClick={onDone}>Start voice interview</Button>
  </section>;
}