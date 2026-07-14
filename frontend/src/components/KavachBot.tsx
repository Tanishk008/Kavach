import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { bot } from "../api/kavach";
import type { BotAction } from "../api/types";
import { ShieldIcon } from "./Icons";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  actions?: BotAction[];
}

export default function KavachBot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "bot",
      text: "Hi! I am Kavach Bot. I can help you detect scams, verify numbers, or check currency. How can I help you today?",
      actions: [
        { label: "Scan a Message", route: "/check-message" },
        { label: "Check a Number", route: "/check-number" },
        { label: "Verify Currency", route: "/check-currency" }
      ]
    }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim()) return;
    
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: "user",
      text: input.trim()
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    try {
      const res = await bot.chat(userMsg.text);
      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        sender: "bot",
        text: res.response,
        actions: res.actions
      };
      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        id: (Date.now() + 1).toString(),
        sender: "bot",
        text: "I'm having trouble connecting to the server right now. Please try again later."
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleActionClick = (route: string) => {
    setIsOpen(false);
    navigate(route);
  };

  return (
    <>
      {/* Floating Action Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="absolute bottom-16 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-navy text-white shadow-lg transition-transform hover:scale-105 active:scale-95 border-2 border-white/20"
          style={{ boxShadow: '0 4px 20px rgba(12, 19, 41, 0.4)' }}
          aria-label="Open Kavach Bot"
        >
          <ShieldIcon className="text-white w-6 h-6" />
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="absolute bottom-12 right-4 z-50 h-[85%] max-h-[600px] w-[calc(100%-32px)] rounded-2xl flex flex-col overflow-hidden bg-surface shadow-2xl border border-hairline animate-in slide-in-from-bottom-5 fade-in duration-300">
          
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-navy to-navy/90 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-lg"><ShieldIcon className="w-5 h-5"/></div>
              <div>
                <h3 className="text-sm font-bold leading-tight">Kavach Bot</h3>
                <p className="text-[10px] text-white/70">Always here to help</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            >
              ✕
            </button>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#F8FAFC]">
            <div className="flex flex-col gap-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 shadow-sm text-sm ${
                    msg.sender === "user" 
                      ? "bg-navy text-white rounded-br-none" 
                      : "bg-white text-ink border border-hairline rounded-bl-none"
                  }`}>
                    <p className="leading-relaxed">{msg.text}</p>
                    
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {msg.actions.map((action, i) => (
                          <button
                            key={i}
                            onClick={() => handleActionClick(action.route)}
                            className="text-[11px] font-bold text-navy bg-canvas hover:bg-saffron/10 border border-navy/20 px-3 py-1.5 rounded-full transition-colors"
                          >
                            {action.label} 
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-hairline rounded-2xl rounded-bl-none px-4 py-3 shadow-sm flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-navy/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-navy/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-navy/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="bg-white border-t border-hairline p-3">
            <div className="flex items-center gap-2 bg-canvas rounded-full px-4 py-2 border border-hairline focus-within:border-navy/30 focus-within:ring-1 focus-within:ring-navy/20 transition-all">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSend();
                }}
                placeholder="Ask me anything..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
                disabled={isTyping}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isTyping}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-white disabled:bg-muted disabled:opacity-50 transition-colors"
              >
                <svg className="h-4 w-4 ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
          </div>
          
        </div>
      )}
    </>
  );
}
