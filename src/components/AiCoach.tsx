import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { askCoach, type CoachMessage } from "@/utils/coach.functions";
import { haptic } from "@/lib/haptics";
import { ChevronUp } from "lucide-react";
import { VoiceCoach } from "@/components/VoiceCoach";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import coachOffice from "@/assets/ai-coach-office.jpg";

const STARTERS = ["Plan my next 7 days", "Fix my weakest habit", "I feel like quitting"];

/** Full-screen Pro coaching room with real voice and text coaching. */
export function AiCoach() {
  const ask = useServerFn(askCoach);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatOpen, setChatOpen] = useState(false);

  const send = async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    haptic("tap");
    setError(null);
    setInput("");
    setChatOpen(true);
    const next: CoachMessage[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setBusy(true);
    try {
      const res = await ask({ data: { messages: next } });
      setMessages([...next, { role: "assistant", content: res.reply }]);
      haptic("success");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "The coach could not answer right now.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="coach-stage" aria-label="AXEN AI Coach">
      <img
        src={coachOffice}
        alt="AXEN virtual discipline coach in a futuristic office"
        width={720}
        height={1280}
        className="coach-stage__portrait"
      />
      <div className="coach-stage__shade" />

      <div className="coach-stage__controls">
        <VoiceCoach />

        {!chatOpen && (
          <div className="coach-stage__starters" aria-label="Suggested questions">
            {STARTERS.map((starter) => (
              <button key={starter} type="button" onClick={() => send(starter)} disabled={busy}>
                {starter}
              </button>
            ))}
          </div>
        )}

        <div className={`coach-chat ${chatOpen ? "coach-chat--open" : ""}`}>
          <button
            type="button"
            className="coach-chat__handle"
            onClick={() => setChatOpen((open) => !open)}
            aria-expanded={chatOpen}
          >
            <ChevronUp size={16} />
            {chatOpen ? "Close text coach" : "Open text coach"}
          </button>

          {chatOpen && (
            <div className="coach-chat__body">
              <Conversation className="coach-chat__conversation">
                <ConversationContent className="gap-4 px-3 py-3">
                  {messages.length === 0 && (
                    <p className="coach-chat__empty">
                      Ask for a plan, a reset, or one direct action for today.
                    </p>
                  )}
                  {messages.map((message, index) => (
                    <Message key={`${message.role}-${index}`} from={message.role}>
                      <MessageContent
                        className={
                          message.role === "user" ? "coach-chat__user" : "coach-chat__assistant"
                        }
                      >
                        <MessageResponse>{message.content}</MessageResponse>
                      </MessageContent>
                    </Message>
                  ))}
                  {busy && <p className="coach-chat__thinking">Coach is thinking…</p>}
                  {error && <p className="coach-chat__error">{error}</p>}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>

              <PromptInput className="coach-chat__composer" onSubmit={({ text }) => send(text)}>
                <PromptInputTextarea
                  name="message"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Message your coach…"
                  className="min-h-12 max-h-24"
                />
                <PromptInputFooter className="justify-end">
                  <PromptInputSubmit
                    status={busy ? "submitted" : "ready"}
                    disabled={busy || !input.trim()}
                  />
                </PromptInputFooter>
              </PromptInput>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
