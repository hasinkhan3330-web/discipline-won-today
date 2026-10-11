import { supabase } from "@/integrations/supabase/client";
export type DailyCoinRewards = { local_date: string; zen_claimed: boolean; contract_claimed: boolean };
export type ZenAward = { coins: number; awarded: number; minutes: number; result: string };
export async function coinRewardRpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw error;
  return (Array.isArray(data) ? data[0] : data) as T;
}
export function getDailyCoinRewards() { return coinRewardRpc<DailyCoinRewards>("get_daily_coin_rewards"); }