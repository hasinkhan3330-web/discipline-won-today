import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getLiveSession } from "@/utils/voice.functions";
import { PcmPlayer, base64ToFloat32, floatToPcm16Base64 } from "@/lib/live-audio";
import { AX, cardStyle, titleStyle } from "@/tabs/styles";
import { haptic } from "@/lib/haptics";
import { Mic, MicOff, Radio } from "lucide-react";

type Status = "idle" | "connecting" | "live" | "error";

const SYSTEM = `You are AXEN Coach, a spoken discipline coach inside the AXEN habit app.
Speak in short, direct, warm sentences. No lists, no markdown — this is a voice call.
Keep every reply under 60 words and end with one concrete action for today.`;

/** Real-time voice coach over the Gemini Live API (WebSocket, native audio). */
export function VoiceCoach() {
  const mintToken = useServerFn(getLiveSession);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [speaking, setSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const micCtxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const playerRef = useRef<PcmPlayer | null>(null);

  const stop = () => {
    try { wsRef.current?.close(); } catch { /* ignore */ }
    wsRef.current = null;
    try { nodeRef.current?.disconnect(); } catch { /* ignore */ }
    nodeRef.current = null;
    try { micCtxRef.current?.close(); } catch { /* ignore */ }
    micCtxRef.current = null;
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    playerRef.current?.close();
    playerRef.current = null;
    setSpeaking(false);
    setStatus("idle");
  };

  useEffect(() => () => stop(), []);

  const start = async () => {
    setError(null);
    setStatus("connecting");
    haptic("tap");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      const { apiKey, model } = await mintToken({});

      const ws = new WebSocket(
        `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${encodeURIComponent(apiKey)}`,
      );
      wsRef.current = ws;
      playerRef.current = new PcmPlayer(24000);

      ws.onopen = () => {
        ws.send(JSON.stringify({
          setup: {
            model,
            generationConfig: { responseModalities: ["AUDIO"] },
            systemInstruction: { parts: [{ text: SYSTEM }] },
          },
        }));

        const AC = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AC({ sampleRate: 16000 });
        micCtxRef.current = ctx;
        const src = ctx.createMediaStreamSource(stream);
        const node = ctx.createScriptProcessor(4096, 1, 1);
        nodeRef.current = node;
        node.onaudioprocess = e => {
          if (ws.readyState !== WebSocket.OPEN) return;
          const data = floatToPcm16Base64(e.inputBuffer.getChannelData(0));
          ws.send(JSON.stringify({
            realtimeInput: { mediaChunks: [{ mimeType: "audio/pcm;rate=16000", data }] },
          }));
        };
        src.connect(node);
        node.connect(ctx.destination);
        setStatus("live");
        haptic("success");
      };

      ws.onmessage = async ev => {
        const raw = typeof ev.data === "string" ? ev.data : await (ev.data as Blob).text();
        let msg: any;
        try { msg = JSON.parse(raw); } catch { return; }

        if (msg.serverContent?.interrupted) {
          playerRef.current?.clear();
          setSpeaking(false);
        }
        const parts = msg.serverContent?.modelTurn?.parts ?? [];
        for (const p of parts) {
          const b64 = p?.inlineData?.data;
          if (b64) {
            playerRef.current?.push(base64ToFloat32(b64));
            setSpeaking(true);
          }
        }
        if (msg.serverContent?.turnComplete) setSpeaking(false);
      };

      ws.onerror = () => {
        setError("The voice connection dropped. Check your network and try again.");
        setStatus("error");
      };
      ws.onclose = e => {
        if (e.code !== 1000 && e.reason) setError(e.reason);
        stop();
      };
    } catch (e: any) {
      const m = e?.name === "NotAllowedError"
        ? "Microphone access was blocked. Allow the mic and try again."
        : e?.message || "The voice coach could not start.";
      setError(m);
      setStatus("error");
      stop();
      setStatus("error");
    }
  };

  const live = status === "live";
  const busy = status === "connecting";
  const CARD = cardStyle();

  return (
    <div style={CARD}>
      <div style={titleStyle}>
        <Radio size={16} strokeWidth={1.8} color={AX.cyan} />
        Voice Coach
      </div>
      <div style={{ fontSize: 13, color: AX.muted, lineHeight: 1.6, marginBottom: 12 }}>
        Talk out loud and your coach answers in real time. Nothing is recorded.
      </div>

      <button
        onClick={() => (live ? stop() : start())}
        disabled={busy}
        style={{
          width: "100%", minHeight: 52, borderRadius: 14,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
          cursor: busy ? "not-allowed" : "pointer",
          background: live ? "#181820" : AX.accent,
          border: `1px solid ${live ? AX.danger : AX.accent}`,
          color: live ? AX.danger : "#FFFFFF",
          fontFamily: AX.font, fontSize: 14, fontWeight: 600, letterSpacing: 0.3,
        }}
      >
        {live ? <MicOff size={18} strokeWidth={2} /> : <Mic size={18} strokeWidth={2} />}
        {busy ? "Connecting…" : live ? "End voice session" : "Start voice session"}
      </button>

      {live && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, fontSize: 12, color: speaking ? AX.cyan : AX.success }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: speaking ? AX.cyan : AX.success }} />
          {speaking ? "Coach is speaking…" : "Listening — go ahead"}
        </div>
      )}

      {error && (
        <div style={{ fontSize: 13, color: AX.danger, marginTop: 10, lineHeight: 1.5 }}>{error}</div>
      )}
    </div>
  );
}
