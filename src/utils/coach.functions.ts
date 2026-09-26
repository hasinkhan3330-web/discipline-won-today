import { buildCoachKnowledge } from "@/lib/coach-knowledge";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type CoachMessage = { id?: string; role: "user" | "assistant"; content: string; suggestedAction?: { type: "create_habit" | "open_focus"; label: string; value?: string } | null };
const messageSchema = z.object({ role: z.enum(["user","assistant"]), content: z.string().min(1).max(2000) });
const inputSchema = z.object({ messages: z.array(messageSchema).min(1).max(12), conversationId: z.string().uuid().nullable().optional() });

async function buildContext(supabase:any,userId:string){
  const today=new Date().toISOString().slice(0,10); const since=new Date(Date.now()-29*86400000).toISOString().slice(0,10);
  const [{data:profile},{data:tasks},{data:comps}]=await Promise.all([
    supabase.from("profiles").select("display_name,coins,streak,longest_streak,shields,primary_goal,biggest_distraction,safe_minor_mode").eq("id",userId).maybeSingle(),
    supabase.from("tasks").select("id,name,pts").eq("user_id",userId).eq("is_active",true),
    supabase.from("task_completions").select("task_id,completed_on").eq("user_id",userId).gte("completed_on",since),
  ]);
  const counts=new Map<string,number>(); const days=new Set<string>();
  for(const item of comps??[]){counts.set(item.task_id,(counts.get(item.task_id)??0)+1);days.add(item.completed_on);}
  const {data:overview}=await supabase.rpc("goal_overview");
  const [{data:pos},{data:contract},{data:acc}]=await Promise.all([
    supabase.rpc("my_leaderboard_position",{_scope:"global",_period:"alltime"}),
    supabase.from("daily_contracts").select("title,status,is_recovery,scheduled_at").eq("user_id",userId).order("scheduled_at",{ascending:false}).limit(1).maybeSingle(),
    supabase.rpc("get_my_accountability"),
  ]);
  const p0=Array.isArray(pos)?pos[0]:pos; const a0=Array.isArray(acc)?acc[0]:acc;
  const extra=[p0?`Leaderboard: rank ${p0.rank} of ${p0.total}, ${p0.points} pts${p0.points_to_next?`, ${p0.points_to_next} pts to next milestone`:""}`:"Leaderboard: unknown",contract?`Latest contract: "${contract.title}" — ${contract.status}${contract.is_recovery?" (recovery)":""}, scheduled ${contract.scheduled_at}`:"Contracts: none yet",a0?.connection_id?`Accountability partner: ${a0.partner_name??"partner"} (my sharing ${a0.my_sharing?"on":"off"})`:"Accountability partner: none"];
  const goals=(Array.isArray(overview)?overview:[]) as any[];
  const goalLines=goals.length?["Goals (real, verified):",...goals.map(goal=>`- ${goal.title}${goal.category?` [${goal.category}]`:""}: ${goal.progress}% (${goal.earned_coins}/${goal.target_coins} coins), readiness ${goal.readiness}%, target ${goal.target_date??"none"}, habits: ${(goal.habits??[]).map((habit:any)=>habit.name).join(", ")||"none linked"}`)]:["Goals: none created yet."];
  return [`Name: ${profile?.display_name??"Athlete"}`,`Streak: ${profile?.streak??0} days (best ${profile?.longest_streak??0})`,`Coins: ${profile?.coins??0} · Shields: ${profile?.shields??0}`,`Active days in last 30: ${days.size}`,profile?.primary_goal?`Goal: ${profile.primary_goal}`:"",profile?.biggest_distraction?`Main distraction: ${profile.biggest_distraction}`:"",profile?.safe_minor_mode?"Safe minor mode: do not encourage surveillance, public sharing, or sensitive tracking.":"",...extra,...goalLines,"Habits:",...(tasks??[]).map((task:any)=>`- ${task.name}: ${counts.get(task.id)??0}/30 days, ${(comps??[]).some((item:any)=>item.task_id===task.id&&item.completed_on===today)?"done today":"open today"}`)].filter(Boolean).join("\n");

}
const SYSTEM=`You are AXEN Coach, a direct, warm discipline coach. Use the user's real data. Keep answers under 130 words unless explaining how an AXEN feature works (then up to 200) with short lines. Never invent data. Never promise or predict a real-world outcome (exam result, body change, income); readiness and progress describe completed actions only. End with one specific action. If useful, append exactly one machine-readable line: ACTION:FOCUS|Start focus now or ACTION:HABIT:<habit name>|Add this habit. Otherwise append no action line.`;

function parseReply(raw:string){
  const match=raw.match(/\n?ACTION:(FOCUS|HABIT(?::([^|\n]+))?)\|([^\n]+)\s*$/i);
  if(!match)return{content:raw.trim(),suggestedAction:null};
  return{content:raw.replace(match[0],"").trim(),suggestedAction:match[1]?.toUpperCase()==="FOCUS"?{type:"open_focus" as const,label:match[3]?.trim()||"Start focus"}:{type:"create_habit" as const,label:match[3]?.trim()||"Add habit",value:match[2]?.trim()||"Daily discipline habit"}};
}

export const getLatestCoachConversation=createServerFn({method:"GET"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {data:conversation}=await context.supabase.from("coach_conversations").select("id,title").eq("user_id",context.userId).order("updated_at",{ascending:false}).limit(1).maybeSingle();
  if(!conversation)return{conversationId:null,messages:[] as CoachMessage[]};
  const {data:messages,error}=await context.supabase.from("coach_messages").select("id,role,content,suggested_action").eq("conversation_id",conversation.id).eq("user_id",context.userId).order("created_at").limit(60);
  if(error)throw new Error(error.message);
  return{conversationId:conversation.id,messages:(messages??[]).map((item:any)=>({id:item.id,role:item.role,content:item.content,suggestedAction:item.suggested_action})) as CoachMessage[]};
});

export const askCoach=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).validator(data=>inputSchema.parse(data)).handler(async({data,context})=>{
  const apiKey=process.env["LOVABLE_API_KEY"]; if(!apiKey)throw new Error("The coach is not configured yet.");
  const {data:premium}=await context.supabase.rpc("has_premium_access",{_user_id:context.userId}); if(!premium)throw new Error("AI Coach is part of AXEN PRO.");
  let conversationId=data.conversationId??null;
  if(conversationId){const{data:owned}=await context.supabase.from("coach_conversations").select("id").eq("id",conversationId).eq("user_id",context.userId).maybeSingle();if(!owned)conversationId=null;}
  const latest=data.messages[data.messages.length-1];
  if(!conversationId){const{data:created,error}=await context.supabase.from("coach_conversations").insert({user_id:context.userId,title:(latest?.content??"New conversation").slice(0,48)}).select("id").single();if(error)throw new Error(error.message);conversationId=created.id;}
  const snapshot=await buildContext(context.supabase,context.userId);
  const response=await fetch("https://ai.gateway.lovable.dev/v1/chat/completions",{method:"POST",headers:{"Content-Type":"application/json","Lovable-API-Key":apiKey,"X-Lovable-AIG-SDK":"fetch"},body:JSON.stringify({model:"google/gemini-3.8-flash",messages:[{role:"system",content:`${SYSTEM}\n\n${buildCoachKnowledge()}\n\nUSER DATA:\n${snapshot}`},...data.messages]})});
  if(response.status===429)throw new Error("The coach is busy right now — try again in a moment."); if(response.status===402)throw new Error("AI usage credits have run out for this app."); if(!response.ok)throw new Error(`The coach could not answer (${response.status}).`);
  const json=await response.json() as any; const raw=json?.choices?.[0]?.message?.content?.trim(); if(!raw)throw new Error("The coach returned an empty answer."); const parsed=parseReply(raw);
  const {error:writeError}=await context.supabase.from("coach_messages").insert([{conversation_id:conversationId,user_id:context.userId,role:"user",content:latest?.content??""},{conversation_id:conversationId,user_id:context.userId,role:"assistant",content:parsed.content,suggested_action:parsed.suggestedAction}]);
  if(writeError)throw new Error(writeError.message);
  return{conversationId,reply:parsed.content,suggestedAction:parsed.suggestedAction};
});