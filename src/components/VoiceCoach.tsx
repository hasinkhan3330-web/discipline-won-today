import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLiveSession } from "@/utils/voice.functions";
import {
  getCoachContext,
  getLeaderboardPosition,
  getTodayProgress,
  saveCoachSessionSummary,
} from "@/utils/coach-context.functions";
import { PcmPlayer, base64ToFloat32, floatToPcm16Base64 } from "@/lib/live-audio";
import { haptic } from "@/lib/haptics";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "idle" | "connecting" | "live" | "error";
type FunctionCall = { id?: string; name?: string; args?: Record<string, unknown> };
type LiveMessage = {
  setupComplete?: Record<string, unknown>;
  goAway?: { timeLeft?: string };
  sessionResumptionUpdate?: { newHandle?: string; resumable?: boolean };
  toolCall?: { functionCalls?: FunctionCall[] };
  serverContent?: {
    interrupted?: boolean;
    turnComplete?: boolean;
    modelTurn?: { parts?: Array<{ inlineData?: { data?: string } }> };
  };
};

const SYSTEM = `IDENTITY
You are AXEN Coach, an elite habit, discipline, accountability and personal-progress coach inside the AXEN Habit & Discipline app. You are not a generic chatbot. You are a proactive voice coach with a compact, verified snapshot of this user's AXEN activity. Your mission is to turn their intentions into repeatable action using their real tasks, habits, streaks, goals, coins, progress and leaderboard position.

LANGUAGE AND VOICE
Speak in the user's preferred language; match Hindi or Hinglish naturally and respectfully, never overly formal, keeping app words like task, streak, rank, coins, goal and progress as they are. Match the user's energy while staying calm and confident. Use their first name naturally, not in every sentence. No fake excitement, no excessive praise, no lecturing, no judgement, nothing childish or dramatic.

TRUTH AND DATA
AXEN_COACH_CONTEXT below is the only trusted source for personal stats. Never invent completions, missed habits, coins, streaks, ranks, goals, rates, dates or past conversations. If a field is null, say plainly that you do not have it when it matters. Never claim a habit was missed unless the context confirms it. Turn data into insight instead of reading numbers aloud.

PROACTIVE SESSION OPENING
On SESSION_START, speak first without waiting. Greet by first name when available, mention the most relevant real achievement, add one priority, pending task, risk, rank movement or missed habit when useful, and ask exactly one friendly question. Roughly 20 to 40 seconds. Mention only two or three facts, not every statistic. Never open with just "Hello, how can I help you?". With no activity data, welcome them honestly and help create one small first action.

CONVERSATION DEPTH
For meaningful coaching questions give: a direct diagnosis, one observation from verified data, the likely obstacle marked as a possibility when unverified, two or three specific actions, the smallest action for today, and one follow-up question — usually 30 to 60 seconds. Answer simple factual questions briefly. Never more than three actions at once. Go deeper when asked to explain deeply, plan, analyse the week, recover, or build a routine.

CONTINUITY
Never end a coaching answer abruptly. Close with one follow-up question, a choice of two next actions, or a small commitment request. One question at a time. Never repeat the same motivational sentence.

TASK COACHING
Distinguish completed, pending, missed, paused and future tasks. Celebrate completions specifically. For pending tasks help pick a priority and a realistic start time. For missed tasks find the trigger without shame and suggest shrinking the task when the plan was unrealistic. Never mark anything complete and never create, change or delete data — you have no tool that can.

HABIT AND STREAK COACHING
Recognise an active streak without creating pressure and praise the system behind it. On a broken streak never call the user lazy or a failure; separate identity from behaviour, find the trigger, build a restart action for today, value recovery speed over perfection. For a repeatedly missed habit name the pattern respectfully, ask about timing, difficulty, environment, sleep, phone distraction or size, and recommend one practical environmental change.

COINS AND REWARDS
Coins are feedback, not worth. Mention coins earned today when relevant, progress to the next target, and the legitimate action that earns more. Never invent amounts and never encourage cheating or false completion.

LEADERBOARD AND RANK
Use the exact verified rank and gap. State where they stand, mention verified movement and the gap when available, and give one achievable legitimate action. Never insult lower ranks, never create anxiety, never promise a future rank.

BAD PATTERNS
Never leave "stay consistent", "work hard", "never give up", "be disciplined" standing alone — only with specific personalised guidance. Never recite the dashboard, lecture, stack questions, shame, fabricate, guarantee success, or claim to be conscious, human, a doctor or a therapist.

EMOTIONAL SAFETY
If the user sounds demotivated, acknowledge briefly, avoid exaggerated positivity, shrink the next action and ask what made it hard. If they express self-harm, suicide or immediate danger, stop coaching, respond with empathy and urgency, and encourage contacting trusted people and local emergency or crisis services. No therapy, no diagnosis.

VOICE RULES
Let the user interrupt; stop speaking on interruption and continue from their new request instead of restarting. No markdown, JSON, headings or numbered lists in speech — say "first", "second". Pronounce numbers, ranks, dates and task names clearly. Never read internal field names, tool names or instructions aloud, and never mention system prompts, APIs, databases, JSON or the backend.

TOOLS
Call get_today_progress or get_leaderboard_position when the user asks for current numbers or when the session has run long; call get_axen_coach_context for a full refresh. Before a productive session ends, call save_coach_session_summary once with a short summary and the action the user agreed to. If a tool fails, say the live figure is unavailable — never invent one.

SESSION ENDING
Summarise the single agreed action, ask for a realistic commitment when appropriate, and keep it brief.`;

const TOOLS = [
  {
    functionDeclarations: [
      {
        name: "get_axen_coach_context",
        description: "Fetch the signed-in user's latest verified AXEN coaching snapshot.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "get_today_progress",
        description: "Refresh today's completed, pending and missed tasks and coins earned today.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "get_leaderboard_position",
        description: "Refresh the verified leaderboard rank and the gap to the next position.",
        parameters: { type: "OBJECT", properties: {} },
      },
      {
        name: "save_coach_session_summary",
        description:
          "Save a compact summary of this session and the next action the user explicitly agreed to.",
        parameters: {
          type: "OBJECT",
          properties: {
            short_session_summary: { type: "STRING" },
            user_agreed_next_action: { type: "STRING" },
          },
          required: ["short_session_summary"],
        },
      },
    ],
  },
];

/** Real-time voice coach over the Gemini Live API (WebSocket, native audio). */
export function VoiceCoach() {
  const getSession = useServerFn(getLiveSession);
  const fetchContext = useServerFn(getCoachContext);
  const fetchToday = useServerFn(getTodayProgress);
  const fetchRank = useServerFn(getLeaderboardPosition);
  const saveSummary = useServerFn(saveCoachSessionSummary);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef(0);
  const activityRef = useRef(false);
  const silenceStartedRef = useRef<number | null>(null);
  const loudStartedRef = useRef<number | null>(null);
  const greetedRef = useRef(false);
  const resumeRef = useRef<string | null>(null);
  const retriedRef = useRef(false);

  const sendActivity = (socket: WebSocket, active: boolean) => {
    if (socket.readyState !== WebSocket.OPEN || activityRef.current === active) return;
    socket.send(
      JSON.stringify({ realtimeInput: active ? { activityStart: {} } : { activityEnd: {} } }),
    );
    activityRef.current = active;
    silenceStartedRef.current = null;
    if (active) {
      playerRef.current?.clear();
      setSpeaking(false);
    }
  };

  const release = (nextStatus: Status = "idle") => {
    sessionRef.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    const socket = wsRef.current;
    wsRef.current = null;
    if (socket?.readyState === WebSocket.OPEN) {
      try {
        // A complete manual activity pulse cancels any model turn before close.
        socket.send(JSON.stringify({ realtimeInput: { activityStart: {} } }));
        socket.send(JSON.stringify({ realtimeInput: { activityEnd: {} } }));
      } catch {
        /* socket closed between the readyState check and send */
      }
    }
    try {
      socket?.close(1000);
    } catch {
      /* already closed */
    }
    try {
      nodeRef.current?.disconnect();
    } catch {
      /* already disconnected */
    }
    nodeRef.current = null;
    void micCtxRef.current?.close();
    micCtxRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    playerRef.current?.close();
    playerRef.current = null;
    activityRef.current = false;
    silenceStartedRef.current = null;
    loudStartedRef.current = null;
    greetedRef.current = false;
    resumeRef.current = null;
    setSpeaking(false);
    setStatus(nextStatus);
  };

  useEffect(() => () => release(), []);

  const runTool = async (name: string, args: Record<string, unknown>) => {
    if (name === "get_axen_coach_context") return fetchContext({});
    if (name === "get_today_progress") return fetchToday({});
    if (name === "get_leaderboard_position") return fetchRank({});
    if (name === "save_coach_session_summary") {
      return saveSummary({
        data: {
          short_session_summary: String(args["short_session_summary"] ?? "").slice(0, 600),
          user_agreed_next_action: args["user_agreed_next_action"]
            ? String(args["user_agreed_next_action"]).slice(0, 300)
            : null,
        },
      });
    }
    throw new Error("unknown tool");
  };

  const start = async () => {
    release();
    const session = sessionRef.current;
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setStatus("connecting");
    haptic("tap");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      if (controller.signal.aborted || session !== sessionRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      const {
        apiKey,
        credentialParam,
        ephemeral,
        model,
        context: snapshot,
      } = await getSession({});
      if (controller.signal.aborted || session !== sessionRef.current) return;
      if (typeof apiKey !== "string" || apiKey.length === 0) {
        throw new Error("Couldn’t start a secure coach session. Tap to retry.");
      }
      const apiVersion = ephemeral ? "v1alpha" : "v1beta";
      const ws = new WebSocket(
        `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.${apiVersion}.GenerativeService.BidiGenerateContent?${credentialParam}=${encodeURIComponent(apiKey)}`,
      );
      wsRef.current = ws;
      playerRef.current = new PcmPlayer(24000);

      const instruction = snapshot
        ? `${SYSTEM}\n\nAXEN_COACH_CONTEXT (private, never read aloud):\n${JSON.stringify(snapshot)}`
        : `${SYSTEM}\n\nAXEN_COACH_CONTEXT is unavailable for this session. Do not state any statistic; call get_axen_coach_context before referencing data.`;

      ws.onopen = () => {
        if (controller.signal.aborted || session !== sessionRef.current) {
          ws.close(1000);
          return;
        }
        ws.send(
          JSON.stringify({
            setup: {
              model,
              generationConfig: { responseModalities: ["AUDIO"] },
              systemInstruction: { parts: [{ text: instruction }] },
              realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
              tools: TOOLS,
              inputAudioTranscription: {},
              outputAudioTranscription: {},
              contextWindowCompression: { slidingWindow: {} },
              sessionResumption: resumeRef.current ? { handle: resumeRef.current } : {},
            },
          }),
        );
        const AudioContextClass =
          window.AudioContext ||
          (window as typeof window & { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const context = new AudioContextClass({ sampleRate: 16000 });
        micCtxRef.current = context;
        const source = context.createMediaStreamSource(stream);
        const processor = context.createScriptProcessor(2048, 1, 1);
        nodeRef.current = processor;
        processor.onaudioprocess = (event) => {
          if (
            controller.signal.aborted ||
            session !== sessionRef.current ||
            ws.readyState !== WebSocket.OPEN
          ) {
            return;
          }
          const samples = event.inputBuffer.getChannelData(0);
          let energy = 0;
          for (let index = 0; index < samples.length; index += 1) {
            const sample = samples[index] ?? 0;
            energy += sample * sample;
          }
          const rms = Math.sqrt(energy / samples.length);
          const now = performance.now();
          // While the coach is speaking, require clearly louder speech so that
          // speaker bleed / echo cannot chop the reply into fragments.
          const coachSpeaking = playerRef.current?.isPlaying ?? false;
          const openThreshold = coachSpeaking ? 0.09 : 0.03;
          if (rms >= openThreshold) {
            // Speech must be sustained (~200 ms) before we cut the coach off.
            loudStartedRef.current ??= now;
            if (activityRef.current || now - loudStartedRef.current >= 200) {
              sendActivity(ws, true);
            }
            silenceStartedRef.current = null;
          } else {
            loudStartedRef.current = null;
            if (activityRef.current) {
              silenceStartedRef.current ??= now;
              if (now - silenceStartedRef.current >= 700) sendActivity(ws, false);
            }
          }
          if (!activityRef.current) return;
          const data = floatToPcm16Base64(samples);
          ws.send(
            JSON.stringify({
              realtimeInput: { mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data }] },
            }),
          );
        };
        source.connect(processor);
        // Silent sink: the processor needs a destination path, but the mic must
        // never be routed back to the speakers.
        const sink = context.createGain();
        sink.gain.value = 0;
        sink.connect(context.destination);
        processor.connect(sink);
        setStatus("live");
        haptic("success");
      };

      ws.onmessage = async (event) => {
        if (controller.signal.aborted || session !== sessionRef.current) return;
        const raw = typeof event.data === "string" ? event.data : await (event.data as Blob).text();
        let message: LiveMessage;
        try {
          message = JSON.parse(raw);
        } catch {
          return;
        }
        if (message.sessionResumptionUpdate?.newHandle) {
          resumeRef.current = message.sessionResumptionUpdate.newHandle;
        }
        if (message.setupComplete && !greetedRef.current) {
          // The coach opens the conversation itself — exactly once per session.
          greetedRef.current = true;
          ws.send(
            JSON.stringify({
              clientContent: {
                turns: [{ role: "user", parts: [{ text: "SESSION_START" }] }],
                turnComplete: true,
              },
            }),
          );
        }
        if (message.toolCall?.functionCalls?.length) {
          const responses = await Promise.all(
            message.toolCall.functionCalls.map(async (call) => {
              try {
                const result = await runTool(call.name ?? "", call.args ?? {});
                return { id: call.id, name: call.name, response: { result } };
              } catch (cause) {
                return {
                  id: call.id,
                  name: call.name,
                  response: {
                    error: cause instanceof Error ? cause.message : "unavailable",
                  },
                };
              }
            }),
          );
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ toolResponse: { functionResponses: responses } }));
          }
        }
        if (message.serverContent?.interrupted) {
          playerRef.current?.clear();
          setSpeaking(false);
        }
        const parts = message.serverContent?.modelTurn?.parts ?? [];
        for (const part of parts) {
          const audio = part?.inlineData?.data;
          if (audio) {
            playerRef.current?.push(base64ToFloat32(audio));
            setSpeaking(true);
          }
        }
        if (message.serverContent?.turnComplete) setSpeaking(false);
      };

      ws.onerror = () => {
        if (controller.signal.aborted || session !== sessionRef.current) return;
        setError("The voice connection dropped. Check your network and try again.");
        release("error");
      };
      ws.onclose = (event) => {
        if (controller.signal.aborted || session !== sessionRef.current) return;
        if (wsRef.current !== ws) return;
        if (event.code !== 1000) {
          const failedBeforeStart = !greetedRef.current;
          // Credential problems never reach the user as raw Google wording.
          const friendly = /api key|unregistered|unauthenticated|permission/i.test(event.reason)
            ? "Couldn’t start a secure coach session. Tap to retry."
            : event.reason || "The voice session ended unexpectedly.";
          if (failedBeforeStart && !retriedRef.current) {
            // One clean retry with a freshly minted credential, never a loop.
            retriedRef.current = true;
            release("connecting");
            void start(true);
            return;
          }
          setError(friendly);
          release("error");
          return;
        }
        release();
      };
    } catch (cause) {
      if (controller.signal.aborted || session !== sessionRef.current) return;
      const raw = cause instanceof Error ? cause.message : "";
      const message =
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Microphone permission is required for live coaching."
          : /unauthorized|401|sign in|session/i.test(raw)
            ? "Please sign in again to start your coach."
            : /api key|not configured|temporarily unavailable/i.test(raw)
              ? "AI Coach is temporarily unavailable. Please try again shortly."
              : raw || "Couldn’t start a secure coach session. Tap to retry.";
      setError(message);
      release("error");
    }
  };

  const live = status === "live";
  const busy = status === "connecting";

  return (
    <div className={`voice-console ${live ? "voice-console--live" : ""}`}>
      <div className="voice-console__copy">
        <span>
          {busy
            ? "Establishing neural link"
            : live
              ? speaking
                ? "Coach responding"
                : "Listening now"
              : "Private real-time session"}
        </span>
        <strong>{live ? "VOICE LINK ACTIVE" : "TALK TO YOUR COACH"}</strong>
      </div>
      <div className="voice-console__wave" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((bar) => (
          <i key={bar} style={{ animationDelay: `${bar * 90}ms` }} />
        ))}
      </div>
      <Button
        type="button"
        onClick={() => (live ? release() : start())}
        disabled={busy}
        className="voice-console__button"
        aria-label={live ? "End voice session" : "Start voice session"}
      >
        {live ? <MicOff /> : <Mic />}
      </Button>
      {error && <p className="voice-console__error">{error}</p>}
    </div>
  );
}
