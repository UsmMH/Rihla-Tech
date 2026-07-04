import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "@/contexts/ThemeContext";
import { ApiError } from "@/lib/api";
import {
  applyTripEdit,
  getChatMessages,
  sendChatMessage,
  sendConsultMessage,
  type StoredChatMessage,
  type TripDetail,
} from "@/lib/trips";

type UiMessage = {
  id: number;
  role: "user" | "assistant";
  content: string;
  time: string;
  proposes_edit: boolean;
  apply_instruction: string | null;
};

function formatTime(iso?: string): string {
  if (iso) {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function tripGreeting(destination: string): UiMessage {
  return {
    id: 0,
    role: "assistant",
    content: `Hi! I'm your RihlaTech AI travel companion for ${destination}. Ask me about your itinerary, local tips, or tell me what you'd like to change.`,
    time: formatTime(),
    proposes_edit: false,
    apply_instruction: null,
  };
}

function consultGreeting(): UiMessage {
  return {
    id: 0,
    role: "assistant",
    content:
      "Hi! I'm your RihlaTech travel assistant. Ask about destinations, when to visit, budgets, or packing — or tap Plan a new trip when you're ready for a full itinerary.",
    time: formatTime(),
    proposes_edit: false,
    apply_instruction: null,
  };
}

function toUiMessage(row: StoredChatMessage): UiMessage {
  return {
    id: row.id,
    role: row.role,
    content: row.content,
    time: formatTime(row.created_at),
    proposes_edit: row.proposes_edit,
    apply_instruction: row.apply_instruction,
  };
}

type TripChatbotProps = {
  mode?: "trip";
  isOpen: boolean;
  onClose: () => void;
  tripPlanId: number;
  destination: string;
  initialInput?: string;
  onItineraryUpdated?: (trip: TripDetail) => void;
  onPlanTrip?: never;
};

type ConsultChatbotProps = {
  mode: "consult";
  isOpen: boolean;
  onClose: () => void;
  tripPlanId?: never;
  destination?: never;
  initialInput?: string;
  onItineraryUpdated?: never;
  onPlanTrip?: () => void;
};

type ChatbotSidebarProps = TripChatbotProps | ConsultChatbotProps;

export default function ChatbotSidebar(props: ChatbotSidebarProps) {
  const { isOpen, onClose, initialInput = "", mode = "trip" } = props;
  const isConsult = mode === "consult";
  const tripPlanId = !isConsult ? props.tripPlanId : undefined;
  const destination = !isConsult ? props.destination : "Travel";
  const onItineraryUpdated = !isConsult ? props.onItineraryUpdated : undefined;
  const onPlanTrip = isConsult ? props.onPlanTrip : undefined;

  const { theme } = useTheme();
  const [messages, setMessages] = useState<UiMessage[]>([
    isConsult ? consultGreeting() : tripGreeting(destination),
  ]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [applyingId, setApplyingId] = useState<number | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    if (isConsult || tripPlanId === undefined) {
      setMessages([consultGreeting()]);
      return;
    }
    setLoadingHistory(true);
    try {
      const rows = await getChatMessages(tripPlanId);
      if (rows.length === 0) {
        setMessages([tripGreeting(destination)]);
      } else {
        setMessages(rows.map(toUiMessage));
      }
    } catch {
      setMessages([tripGreeting(destination)]);
    } finally {
      setLoadingHistory(false);
    }
  }, [isConsult, tripPlanId, destination]);

  useEffect(() => {
    if (isOpen) {
      void loadHistory();
      setInput(initialInput.trim());
    }
  }, [isOpen, initialInput, loadHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending, loadingHistory]);

  function appendAssistantMessage(content: string) {
    const msg: UiMessage = {
      id: -Date.now(),
      role: "assistant",
      content,
      time: formatTime(),
      proposes_edit: false,
      apply_instruction: null,
    };
    setMessages((m) => [...m, msg]);
  }

  async function handleApply(instruction: string, messageId: number) {
    if (applyingId !== null || tripPlanId === undefined) return;
    setApplyingId(messageId);
    try {
      const trip = await applyTripEdit(tripPlanId, instruction, messageId);
      onItineraryUpdated?.(trip);
      await loadHistory();
      appendAssistantMessage("Your itinerary has been updated successfully. Check the activity cards for the changes.");
    } catch (err: unknown) {
      const detail = err instanceof ApiError ? err.message : "Something went wrong";
      appendAssistantMessage(`I couldn't apply those changes: ${detail}. You can try again or describe the edit differently.`);
    } finally {
      setApplyingId(null);
    }
  }

  async function handleSend(text?: string) {
    const content = (text ?? input).trim();
    if (!content || sending) return;

    const userMsg: UiMessage = {
      id: -Date.now(),
      role: "user",
      content,
      time: formatTime(),
      proposes_edit: false,
      apply_instruction: null,
    };
    setInput("");
    setSending(true);

    if (isConsult) {
      const historyForApi = messages
        .filter((m) => m.id !== 0)
        .map((m) => ({ role: m.role, content: m.content }));
      historyForApi.push({ role: "user" as const, content });
      setMessages((m) => [...m, userMsg]);
      try {
        const reply = await sendConsultMessage(content, historyForApi);
        appendAssistantMessage(reply.message);
      } catch (err: unknown) {
        appendAssistantMessage(
          err instanceof ApiError ? err.message : "Sorry, I couldn't respond right now. Please try again.",
        );
      } finally {
        setSending(false);
      }
      return;
    }

    try {
      const reply = await sendChatMessage(content, tripPlanId!);
      if (reply.itinerary_updated && reply.trip) {
        onItineraryUpdated?.(reply.trip);
      }
      await loadHistory();
    } catch (err: unknown) {
      appendAssistantMessage(
        err instanceof ApiError ? err.message : "Sorry, I couldn't respond right now. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }

  const quickSuggestions = isConsult
    ? [
        "Best destinations for a week in Europe",
        "How do I plan a trip on a budget?",
        "When is the best time to visit Japan?",
        "Plan a new trip for me",
      ]
    : [
        "I'd like to change part of my itinerary",
        "Best time for Day 1 activities",
        "Budget breakdown",
        "Restaurant recommendations",
      ];

  function handleSuggestion(s: string) {
    if (isConsult && s.toLowerCase().includes("plan a new trip") && onPlanTrip) {
      onClose();
      onPlanTrip();
      return;
    }
    void handleSend(s);
  }

  const subtitle = sending
    ? "Thinking..."
    : applyingId
      ? "Updating itinerary..."
      : isConsult
        ? "Travel assistant"
        : `${destination} Expert`;

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
            className="fixed inset-0 z-50 flex flex-col md:inset-y-0 md:left-auto md:right-0 md:w-[min(440px,100vw)]"
            style={{
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
                    <div className="w-1.5 h-1.5 rounded-full" style={{ background: sending || applyingId ? "#FFC107" : "#4CAF50" }} />
                    <p style={{ color: theme.muted, fontSize: "0.72rem", fontFamily: "system-ui, sans-serif" }}>
                      {subtitle}
                    </p>
                  </div>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-11 h-11 rounded-full flex items-center justify-center cursor-pointer transition-colors flex-shrink-0"
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
              {loadingHistory && (
                <div className="flex justify-center py-8">
                  <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: theme.accentSky, borderTopColor: "transparent" }} />
                </div>
              )}
              {!loadingHistory && messages.map((msg) => {
                const showApply = !isConsult && msg.role === "assistant" && msg.proposes_edit && msg.apply_instruction;
                const showApplied = !isConsult && msg.role === "assistant" && !msg.proposes_edit && msg.apply_instruction;

                return (
                <motion.div key={`${msg.id}-${msg.time}`} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
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
                    {showApply && (
                      <button
                        type="button"
                        disabled={applyingId !== null}
                        onClick={() => void handleApply(msg.apply_instruction!, msg.id)}
                        className="mt-2 w-full sm:w-auto px-4 py-2.5 rounded-lg text-sm cursor-pointer transition-all min-h-[44px]"
                        style={{
                          background: `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})`,
                          color: "#fff",
                          border: "none",
                          fontFamily: "system-ui, sans-serif",
                          opacity: applyingId !== null && applyingId !== msg.id ? 0.6 : 1,
                        }}
                      >
                        {applyingId === msg.id ? "Applying..." : "Apply to itinerary"}
                      </button>
                    )}
                    {showApplied && (
                      <p className="mt-2 text-xs" style={{ color: theme.accentSky, fontFamily: "system-ui, sans-serif" }}>
                        Applied to itinerary
                      </p>
                    )}
                    <p className={`mt-1 ${msg.role === "user" ? "text-right" : "text-left"}`}
                      style={{ color: theme.faint, fontFamily: "system-ui, sans-serif", fontSize: "0.68rem" }}>
                      {msg.time}
                    </p>
                  </div>
                </motion.div>
                );
              })}
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
              <div className="flex flex-wrap gap-2">
                {quickSuggestions.map((s) => (
                  <button key={s} onClick={() => handleSuggestion(s)} disabled={sending}
                    className="px-3 py-2 rounded-full text-xs cursor-pointer transition-all min-h-[36px]"
                    style={{ background: theme.chatSuggestionBg, border: `1px solid ${theme.chatSuggestionBorder}`, color: theme.chatSuggestionText, fontFamily: "system-ui, sans-serif", opacity: sending ? 0.6 : 1 }}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = theme.accentMid)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = theme.chatSuggestionBorder)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="px-4 pt-2" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom, 1rem))", flexShrink: 0 }}>
              <div className="flex items-center gap-2 rounded-xl px-3 py-2 min-h-[48px]"
                style={{ background: theme.chatInputBg, border: `1px solid ${theme.inputBorder}` }}>
                <input
                  type="text" value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder={isConsult ? "Ask about travel destinations, tips..." : "Ask me anything about your trip..."}
                  disabled={sending}
                  className="flex-1 bg-transparent outline-none py-2 text-base md:text-sm"
                  style={{ color: theme.inputText, fontFamily: "system-ui, sans-serif", minWidth: 0 }}
                />
                <button onClick={() => handleSend()} disabled={sending || !input.trim()}
                  className="w-11 h-11 rounded-lg flex items-center justify-center cursor-pointer flex-shrink-0 transition-all"
                  style={{ background: input.trim() && !sending ? `linear-gradient(135deg, ${theme.accentDeep}, ${theme.accentMid})` : theme.progressTrack, border: "none" }}
                  aria-label="Send message"
                >
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                    <path d="M2 7.5h11M8 3l4.5 4.5L8 12" stroke={input.trim() && !sending ? "#fff" : theme.faint} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              <p style={{ color: theme.faint, fontSize: "0.65rem", textAlign: "center", marginTop: "0.4rem", fontFamily: "system-ui, sans-serif" }}>
                {isConsult
                  ? "Ready to build an itinerary? Use Plan a new trip on Home."
                  : 'Say "yes" or tap Apply to confirm itinerary changes.'}
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
