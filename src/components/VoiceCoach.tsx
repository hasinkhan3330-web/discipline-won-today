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

  const release = (nextStatus: Status = "idle") => {
    const socket = wsRef.current;
    wsRef.current = null;
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
    setSpeaking(false);
    setStatus(nextStatus);
  };

  useEffect(() => () => release(), []);

  const start = async () => {
    setError(null);
    setStatus("connecting");
    haptic("tap");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;
      const { apiKey, model } = await getSession({});
      const ws = new WebSocket(
        `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(apiKey)}`,
      );
      wsRef.current = ws;
      playerRef.current = new PcmPlayer(24000);

      ws.onopen = () => {
        ws.send(
          JSON.stringify({
            setup: {
              model,
              generationConfig: { responseModalities: ["AUDIO"] },
              systemInstruction: { parts: [{ text: SYSTEM }] },
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
        const processor = context.createScriptProcessor(4096, 1, 1);
        nodeRef.current = processor;
        processor.onaudioprocess = (event) => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const data = floatToPcm16Base64(event.inputBuffer.getChannelData(0));
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
        setError("The voice connection dropped. Check your network and try again.");
        release("error");
      };
      ws.onclose = (event) => {
        if (wsRef.current !== ws) return;
        if (event.code !== 1000) {
          setError(event.reason || "The voice session ended unexpectedly.");
          release("error");
          return;
        }
        release();
      };
    } catch (cause) {
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
