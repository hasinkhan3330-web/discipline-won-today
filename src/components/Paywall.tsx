import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PlatformCheckout } from "@/components/PlatformCheckout";
import { type Cycle } from "@/lib/pricing";
import { PricingSelector } from "@/components/PricingSelector";

export function Paywall({userId,email}:{userId:string;email?:string|null}){
  const[cycle,setCycle]=useState<Cycle>("yearly");
  return <main className="membership-screen"><div className="membership-aurora" aria-hidden="true"/><header><div><Sparkles size={22}/></div><span>AXEN PRO</span><h1>Unlock your full potential</h1></header>
    <PricingSelector cycle={cycle} onChange={setCycle}/>
    <PlatformCheckout userId={userId} cycle={cycle} email={email}/>
    <button className="membership-signout" onClick={()=>supabase.auth.signOut()}>Sign out</button>
  </main>;
}
export function PaywallLoading(){return <div className="membership-loading">Preparing AXEN…</div>}
type SubRow={status:string;current_period_end:string|null};
function isRowActive(row:SubRow){const end=row.current_period_end?new Date(row.current_period_end):null;const valid=!end||end>new Date();return (["active","past_due"].includes(row.status)&&valid)||(row.status==="canceled"&&!!end&&end>new Date());}
export function PaywallGate({children}:{children:React.ReactNode}){const[userId,setUserId]=useState<string|null>(null);const[email,setEmail]=useState<string|null>(null);const[ready,setReady]=useState(false);const[sub,setSub]=useState<SubRow|null>(null);const refresh=async(uid:string)=>{const{data}=await supabase.from("subscriptions").select("status,current_period_end").eq("user_id",uid).order("created_at",{ascending:false}).limit(20);const rows=(data??[]) as SubRow[];setSub(rows.find(isRowActive)??rows[0]??null);};useEffect(()=>{void(async()=>{const{data}=await supabase.auth.getUser();if(data.user){setUserId(data.user.id);setEmail(data.user.email??null);await refresh(data.user.id);if(await isNativeBillingAvailable().catch(()=>false)){try{const{initPlayBilling}=await import("@/lib/play-billing");const{syncPlayEntitlement}=await import("@/utils/play-billing.functions");await initPlayBilling(data.user.id);await syncPlayEntitlement({data:{}} as never);await refresh(data.user.id);}catch{}}}setReady(true);})();},[]);useEffect(()=>{if(!userId)return;const channel=supabase.channel(`gate_${userId}`).on("postgres_changes",{event:"*",schema:"public",table:"subscriptions",filter:`user_id=eq.${userId}`},()=>refresh(userId)).subscribe();const update=()=>refresh(userId);window.addEventListener("focus",update);window.addEventListener("subscription:refresh",update);return()=>{void supabase.removeChannel(channel);window.removeEventListener("focus",update);window.removeEventListener("subscription:refresh",update);};},[userId]);if(!ready||!userId)return<PaywallLoading/>;if(!sub||!isRowActive(sub))return<Paywall userId={userId} email={email}/>;return<>{children}</>}