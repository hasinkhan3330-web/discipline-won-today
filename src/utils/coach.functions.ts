import { buildCoachKnowledge } from "@/lib/coach-knowledge";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { COACH_CHAT_MODEL } from "@/lib/coach-config";
import { COACH_SYSTEM_V2, COACH_TOOL_DEFS, callModel, runCoachTool } from "@/lib/coach-tools";
import { shouldDraft, requestedLength, spokenSlots } from '@/lib/coach-interview';

export type CoachMessage = { id?: string; role: "user" | "assistant"; content: string; suggestedAction?: { type: "create_habit" | "open_focus"; label: string; value?: string } | null };
const messageSchema = z.object({ role: z.enum(["user","assistant"]), content: z.string().min(1).max(2000) });
const inputSchema = z.object({ messages: z.array(messageSchema).min(1).max(12), conversationId: z.string().uuid().nullable().optional(), timezone: z.string().max(64).optional() });

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
  const { profileContextBlock } = await import("@/lib/coach-tools");
  if(data.timezone){const{setTimezone}=await import("@/lib/coach-tools");await setTimezone({supabase:context.supabase,userId:context.userId},data.timezone);}
  const tools=COACH_TOOL_DEFS.map(t=>({type:"function",function:t}));
  const ctx = { supabase: context.supabase, userId: context.userId };
  // Only the current interview window counts; old conversation history must not force a plan on every message.
  const questions = data.messages.filter(m => m.role === 'assistant' && /\?\s*$/.test(m.content.trim())).length;
  const forceDraft = shouldDraft(latest?.content ?? '', questions);
  if (forceDraft) {
    const slots = spokenSlots(latest?.content ?? '');
    if (Object.keys(slots).length) await runCoachTool(ctx, 'update_profile', { slots });
    const result = await runCoachTool(ctx, 'create_plan_draft', { days: requestedLength(latest?.content ?? '') }) as { ok?: boolean; error?: string; assumptions?: string[]; plan?: { title: string } };
    if (!result.ok) throw new Error(result.error ?? 'Could not build your plan.');
    const status = await runCoachTool(ctx, 'get_profile_status', {}) as { percent: number; filled: Record<string, unknown>; missing: string[] };
    const known = Object.entries(status.filled).map(([k, v]) => `${k} ${k === 'daily time available' ? v + ' min' : v}`).join(', ');
    const gap = status.missing[0];
    const nextQ = gap ? ` To refine it: what is your ${gap}?` : '';
    const reply = `Built from your profile (${status.percent}%): ${known || 'no saved details yet'}. Your "${result.plan?.title ?? 'plan'}" draft for today is ready — see the plan card. ${result.assumptions?.length ? 'Assumptions for missing details: ' + result.assumptions.join('; ') + '.' : ''} Accept it when you are ready.${nextQ}`;
    const { error } = await context.supabase.from('coach_messages').insert([{ conversation_id: conversationId, user_id: context.userId, role: 'user', content: latest?.content ?? '' }, { conversation_id: conversationId, user_id: context.userId, role: 'assistant', content: reply }]);
    if (error) throw new Error(error.message);
    return { conversationId, reply, suggestedAction: null };
  }
  const convo:any[]=[{role:"system",content:`${COACH_SYSTEM_V2}\n\nOutput rule: ${SYSTEM.split("End with")[1]?"End with"+SYSTEM.split("End with")[1]:""}\n\n${buildCoachKnowledge()}\n\nUSER DATA:\n${snapshot}\n\n${await profileContextBlock(ctx, "text")}`},...data.messages];
  let raw="";
  for(let step=0;step<6;step++){
    const json=await callModel(COACH_CHAT_MODEL,{messages:convo,tools});
    const msg=json?.choices?.[0]?.message; const calls=msg?.tool_calls??[];
    if(!calls.length){raw=String(msg?.content??"").trim();break;}
    convo.push({role:"assistant",content:msg.content??"",tool_calls:calls});
    for(const call of calls){let args={};try{args=JSON.parse(call.function?.arguments||"{}");}catch{}
      let result:unknown;try{result=await runCoachTool({supabase:context.supabase,userId:context.userId},call.function?.name,args);}catch(e:any){result={ok:false,error:e?.message??"tool failed"};}
      convo.push({role:"tool",tool_call_id:call.id,content:JSON.stringify(result).slice(0,12000)});}
  }
  if(!raw)throw new Error("The coach returned an empty answer."); const parsed=parseReply(raw);
  const {error:writeError}=await context.supabase.from("coach_messages").insert([{conversation_id:conversationId,user_id:context.userId,role:"user",content:latest?.content??""},{conversation_id:conversationId,user_id:context.userId,role:"assistant",content:parsed.content,suggested_action:parsed.suggestedAction}]);
  if(writeError)throw new Error(writeError.message);
  return{conversationId,reply:parsed.content,suggestedAction:parsed.suggestedAction};
});