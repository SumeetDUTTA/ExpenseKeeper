import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-hot-toast";
import { Bot, ChevronDown, MessageSquare, Send, Trash2 } from "lucide-react";

import { clearChatHistory, getChatHistory, sendChatMessage } from "../lib/api";
import "../styles/Chat.css";

const STARTER_QUESTIONS = [
  "Why was my expense higher this month?",
  "What were my recurring expenses?",
  "Compare this month to last month.",
  "Am I on track with my budget?",
];

function getReplySourceLabel(modelInfo) {
  if (!modelInfo) return "Model: llama-3.1-8b-instant";
  if (modelInfo.provider === "rule_based") return "Rule-based answer";
  if (modelInfo.provider === "template_fallback") return "Fallback reply";
  return `Model: ${modelInfo.modelName || "llama-3.1-8b-instant"}`;
}

export default function ChatPanel({ monthKey, isReady, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [sending, setSending] = useState(false);
  const [modelInfo, setModelInfo] = useState(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (!isReady) {
      setMessages([]);
      return;
    }

    let cancelled = false;
    async function loadHistory() {
      setLoadingHistory(true);
      try {
        const { data } = await getChatHistory(monthKey);
        if (!cancelled) {
          setMessages(data.messages || []);
        }
      } catch (err) {
        if (!cancelled) {
          toast.error(err?.response?.data?.message || "Could not load chat history.");
        }
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }

    loadHistory();
    return () => {
      cancelled = true;
    };
  }, [isReady, monthKey]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending, loadingHistory]);

  const handleSend = async (presetMessage) => {
    const message = (presetMessage ?? input).trim();
    if (!message || sending || !isReady) return;

    const optimisticUser = {
      role: "user",
      content: message,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticUser]);
    setInput("");
    setSending(true);

    try {
      const { data } = await sendChatMessage(monthKey, message);
      setMessages(data.messages || []);
      setModelInfo(data.modelInfo || null);
    } catch (err) {
      setMessages((prev) => prev.filter((item) => item !== optimisticUser));
      toast.error(err?.response?.data?.message || "Chat request failed.");
    } finally {
      setSending(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm("Clear this conversation for the selected month?")) return;
    try {
      await clearChatHistory(monthKey);
      setMessages([]);
      setModelInfo(null);
      toast.success("Chat history cleared.");
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not clear chat history.");
    }
  };

  return (
    <section className="chat-panel">
      <button
        className={`chat-panel-toggle ${open ? "open" : ""}`}
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        <div className="chat-panel-toggle-left">
          <MessageSquare size={18} />
          <div>
            <strong>Conversational Mode</strong>
            <span>Ask direct questions about your spending for {monthKey}</span>
          </div>
        </div>
        <ChevronDown size={18} />
      </button>

      {open && (
        <div className="chat-panel-body">
          <div className="chat-panel-header">
            <div className="chat-panel-copy">
              <h3>Expense Chatbot</h3>
              <p>Powered by llama-3.1-8b-instant for lower-cost report Q&amp;A.</p>
            </div>
            {isReady && messages.length > 0 && (
              <button className="chat-clear-btn" onClick={handleClear} type="button">
                <Trash2 size={15} />
                Clear
              </button>
            )}
          </div>

          {!isReady ? (
            <div className="chat-empty-state chat-empty-state-report">
              <Bot size={34} />
              <p>Generate a monthly report first so the chatbot has data to analyze.</p>
              <Link to="/reports" className="chat-link-btn">Go to Reports</Link>
            </div>
          ) : (
            <>
              <div className="chat-suggestions">
                {STARTER_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    type="button"
                    className="chat-suggestion-chip"
                    onClick={() => handleSend(question)}
                    disabled={sending}
                  >
                    {question}
                  </button>
                ))}
              </div>

              <div className="chat-messages" ref={listRef}>
                {loadingHistory ? (
                  <div className="chat-empty-state compact">
                    <p>Loading conversation…</p>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="chat-empty-state compact">
                    <Bot size={30} />
                    <p>Ask why a category spiked, compare months, or check recurring charges.</p>
                  </div>
                ) : (
                  messages.map((message, index) => (
                    <div
                      key={`${message.role}-${index}-${message.timestamp || index}`}
                      className={`chat-bubble-row ${message.role}`}
                    >
                      <div className={`chat-bubble ${message.role}`}>
                        <div className="chat-bubble-role">
                          {message.role === "assistant" ? "ExpenseKeeper AI" : "You"}
                        </div>
                        <p>{message.content}</p>
                      </div>
                    </div>
                  ))
                )}

                {sending && (
                  <div className="chat-bubble-row assistant">
                    <div className="chat-bubble assistant typing">
                      <div className="chat-bubble-role">ExpenseKeeper AI</div>
                      <div className="chat-typing-dots">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="chat-compose-row">
                <textarea
                  className="chat-input"
                  rows={3}
                  value={input}
                  maxLength={500}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask something like: Why was my February expense higher?"
                />
                <button
                  className="chat-send-btn"
                  type="button"
                  onClick={() => handleSend()}
                  disabled={sending || !input.trim()}
                >
                  <Send size={16} />
                  Send
                </button>
              </div>

              <div className="chat-meta-row">
                <span>{input.trim().length}/500</span>
                <span>{getReplySourceLabel(modelInfo)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}