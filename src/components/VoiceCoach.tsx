import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLiveSession } from "@/utils/voice.functions";
import { PcmPlayer, base64ToFloat32, floatToPcm16Base64 } from "@/lib/live-audio";
import { haptic } from "@/lib/haptics";
import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";

type Status = "idle" | "connecting" | "live" | "error";
type LiveMessage = {
  serverContent?: {
    interrupted?: boolean;
    turnComplete?: boolean;
    modelTurn?: { parts?: Array<{ inlineData?: { data?: string } }> };
  };
};

const SYSTEM = `You are AXEN Coach, a spoken discipline coach inside the AXEN habit app.
Speak in short, direct, warm sentences. No lists, no markdown — this is a voice call.
Keep every reply under 60 words and end with one concrete action for today.`;

/** Real-time voice coach over the Gemini Live API (WebSocket, native audio). */
export function VoiceCoach() {
  const getSession = useServerFn(getLiveSession);
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
    setSpeaking(false);
    setStatus(nextStatus);
  };

  useEffect(() => () => release(), []);

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
      const { apiKey, model } = await getSession({});
      if (controller.signal.aborted || session !== sessionRef.current) return;
      const ws = new WebSocket(
        `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(apiKey)}`,
      );
      wsRef.current = ws;
      playerRef.current = new PcmPlayer(24000);

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
              systemInstruction: { parts: [{ text: SYSTEM }] },
              realtimeInputConfig: { automaticActivityDetection: { disabled: true } },
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
          if (rms >= 0.025) {
            sendActivity(ws, true);
          } else if (activityRef.current) {
            silenceStartedRef.current ??= now;
            if (now - silenceStartedRef.current >= 650) sendActivity(ws, false);
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
        processor.connect(context.destination);
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
          setError(event.reason || "The voice session ended unexpectedly.");
          release("error");
          return;
        }
        release();
      };
    } catch (cause) {
      if (controller.signal.aborted || session !== sessionRef.current) return;
      const message =
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Microphone access was blocked. Allow the mic and try again."
          : cause instanceof Error
            ? cause.message
            : "The voice coach could not start.";
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
