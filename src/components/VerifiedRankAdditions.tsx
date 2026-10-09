import { Coins } from "lucide-react";
import { MilestoneSeal } from "@/components/MilestoneSeal";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { highestMilestoneSeal, type VerifiedRankCoins } from "@/lib/milestone-seals";

export function VerifiedMemberSeal({ data }: { data: VerifiedRankCoins }) {
  const seal = highestMilestoneSeal(data.coins_earned, data.highest_seal_tier);
  if (!seal) return null;
  const label = `${seal.name.replace("Dark ", "")} seal, earned at ${seal.coins.toLocaleString("en-US")} coins`;
  return <Popover><PopoverTrigger asChild><Button variant="ghost" className="rank-member-seal" aria-label={label}>
    <MilestoneSeal tier={seal.tier} label={label} />
  </Button></PopoverTrigger><PopoverContent className="rank-member-seal-tooltip" side="bottom">{label}</PopoverContent></Popover>;
}

export function VerifiedCoinChip({ data, loading }: { data?: VerifiedRankCoins; loading: boolean }) {
  if (loading) return <span className="rank-earned-coins is-loading" aria-label="Loading coins earned" />;
  if (!data) return null;
  return <span className="rank-earned-coins" aria-label={`${data.coins_earned.toLocaleString("en-US")} coins earned`}><Coins size={14} aria-hidden="true" /><span>{data.coins_earned.toLocaleString("en-US")}</span></span>;
}