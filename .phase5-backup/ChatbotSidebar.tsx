import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";
import { ApiError } from "@/lib/api";
import { sendChatMessage } from "@/lib/trips";
import type { ChatMessage } from "@/data/chatMessages";

function formatTime(): string {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function greeting(destination: string): ChatMessage {
  return {
    id: 1,
    role: "assistant",
    content: `Hi! I'm your RihlaTech AI travel companion for ${destination}. Ask me about your itinerary, local tips, or tell me what you'd like to change.`,
    time: formatTime(),
  };
}

type ChatbotSidebarProps = {
  isOpen: boolean;
  onClose: () => void;
  tripPlanId: number;
  destination: string;
  initialInput?: string;
};

export default function ChatbotSidebar({
  isOpen,
  onClose,
  tripPlanId,
  destination,
  initialInput = "",
}: ChatbotSidebarProps) {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([greeting(destination)]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const nextId = useRef(2);

  const quickSuggestions = [
    `Best time for Day 1 activities`,
    "Budget breakdown",
    "Add a day trip",
    "Restaurant recommendations",
  ];

  useEffect(() => {
    if (isOpen) {
      setMessages([greeting(destination)]);
      nextId.current = 2;
      if (initialInput.trim()) {
        setInput(initialInput.trim());
      }
    }
  }, [isOpen, destination, initialInput]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending) return;

    const userMsg: ChatMessage = {
      id: nextId.current++,
      role: "user",
      content,
      time: formatTime(),
    };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setSending(true);

    try {
      const reply = await sendChatMessage(content, tripPlanId);
      const aiMsg: ChatMessage = {
        id: nextId.current++,
        role: "assistant",
        content: reply.message,
        time: formatTime(),
      };
      setMessages((m) => [...m, aiMsg]);
    } catch (err: unknown) {
      const aiMsg: ChatMessage = {
        id: nextId.current++,
        role: "assistant",
        content: err instanceof ApiError ? err.message : "Sorry, I couldn't respond right now. Please try again.",
        time: formatTime(),
      };
      setMessages((m) => [...m, aiMsg]);
    } finally {
      setSending(false);
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: theme.backdrop, backdropFilter: "blur(3px)" }}
          />

          <motion.div
            initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 flex flex-col"
            style={{
              width: "min(440px, 100vw)",
              background: theme.chatPanelBg,
              borderLeft: `1px solid ${theme.chatPanelBorder}`,
              boxShadow: theme.isDark ? "-20px 0 60px rgba(5,13,26,0.6)" : "-20px 0 60px rgba(10,22,40,0.12)",
              transition: "background 0.3s",
            }}
          >
            <div className="flex items-center justify-between px-4 py-4" style={{ borderBottom: `1px solid ${theme.chatPanelBorder}`, flexShrink: 0 }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})` }}>
                  <svg width="17" height="17" viewBox="0 0 18 18" fill="none">
                    <path d="M3 9l6-6 6 6" stroke="#58ABD4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 3v12" stroke="#58ABD4" strokeWidth="1.5" strokeLinecap="round" />
                  </svg>
                </div>
                <div>
                  <p style={{ color: theme.heading, fontWeight: 600, fontSize: "0.95rem", fontFamily: "system-ui, sans-serif" }}>
                    RihlaTech AI
                  </p>
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: sending ? "#FFC107" : "#4CAF50" }} />
                    <p style={{ color: theme.muted, fontSize: "0.72rem", fontFamily: "system-ui, sans-serif" }}>
                      {sending ? "Thinking..." : `${destination} Expert`}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center cursor-pointer transition-colors flex-shrink-0"
                style={{ background: theme.toggleBg, border: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.cardBorder)}
                onMouseLeave={(e) => (e.currentTarget.style.background = theme.toggleBg)}
                aria-label="Close chat"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2 2l10 10M12 2L2 12" stroke={theme.body} strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
              style={{ scrollbarWidth: "thin", scrollbarColor: `${theme.border} transparent` }}>
              {messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div style={{ maxWidth: "85%" }}>
                    <div className="px-4 py-3"
                      style={msg.role === "user"
                        ? { background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`, color: "#FFFFFF", borderRadius: "18px 18px 4px 18px" }
                        : { background: theme.chatAiBubbleBg, border: `1px solid ${theme.chatAiBubbleBorder}`, color: theme.chatAiBubbleText, borderRadius: "18px 18px 18px 4px" }
                      }
                    >
                      <p style={{ fontSize: "0.88rem", lineHeight: "1.55", fontFamily: "system-ui, sans-serif", whiteSpace: "pre-wrap" }}>{msg.content}</p>
                    </div>
                    <p className={`mt-1 ${msg.role === "user" ? "text-right" : "text-left"}`}
                      style={{ color: theme.faint, fontFamily: "system-ui, sans-serif", fontSize: "0.68rem" }}>
                      {msg.time}
                    </p>
                  </div>
                </motion.div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 rounded-2xl" style={{ background: theme.chatAiBubbleBg, border: `1px solid ${theme.chatAiBubbleBorder}` }}>
                    <div className="flex gap-1">
                      {[0, 1, 2].map((i) => (
                        <div key={i} className="w-2 h-2 rounded-full animate-bounce" style={{ background: theme.muted, animationDelay: `${i * 0.15}s` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>

            <div className="px-4 py-2.5" style={{ borderTop: `1px solid ${theme.borderFaint}`, flexShrink: 0 }}>
              <p style={{ color: theme.faint, fontSize: "0.68rem", marginBottom: "0.4rem", fontFamily: "system-ui, sans-serif" }}>
                Quick suggestions
              </p>
              <div className="flex gap-2" style={{ overflowX: "auto", scrollbarWidth: "none", paddingBottom: "2px" }}>
                {quickSuggestions.map((s) => (
                  <button key={s} onClick={() => handleSend(s)} disabled={sending}
                    className="px-3 py-1.5 rounded-full text-xs cursor-pointer transition-all flex-shrink-0"
                    style={{ background: theme.chatSuggestionBg, border: `1px solid ${theme.chatSuggestionBorder}`, color: theme.chatSuggestionText, fontFamily: "system-ui, sans-serif", opacity: sending ? 0.6 : 1 }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.accentMid)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = theme.chatSuggestionBorder)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 pt-2" style={{ paddingBottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))", flexShrink: 0 }}>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2"
                style={{ background: theme.chatInputBg, border: `1px solid ${theme.inputBorder}` }}>
                <input
                  type="text" value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="Ask me anything about your trip..."
                  disabled={sending}
                  className="flex-1 bg-transparent outline-none py-1.5"
                  style={{ color: theme.inputText, fontSize: "0.9rem", fontFamily: "system-ui, sans-serif", minWidth: 0 }}
                />
                <button onClick={() => handleSend()} disabled={sending || !input.trim()}
                  className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer flex-shrink-0 transition-all"
                  style={{ background: input.trim() && !sending ? `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})` : theme.progressTrack, border: "none" }}
                  aria-label="Send message"
                >
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <path d="M2 7.5h11M8 3l4.5 4.5L8 12" stroke={input.trim() && !sending ? "#fff" : theme.faint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <p style={{ color: theme.faint, fontSize: "0.65rem", textAlign: "center", marginTop: "0.4rem", fontFamily: "system-ui, sans-serif" }}>
                AI responses are suggestions — always verify local conditions.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
