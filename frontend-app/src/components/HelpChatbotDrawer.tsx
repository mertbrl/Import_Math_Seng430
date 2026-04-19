import React, { useState, useRef, useEffect } from 'react';
import { useDomainStore } from '../store/useDomainStore';

import api from '../services/api';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
}

export const HelpChatbotDrawer: React.FC = () => {
  const { isHelpOpen, toggleHelp } = useDomainStore();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: '1', 
      role: 'ai', 
      content: 'Hello! I am your HEALTH-AI assistant. You can ask me anything about this model or platform!' 
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat when messages change
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isHelpOpen]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmedInput = inputText.trim();
    if (!trimmedInput) return;

    // 1. Add User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedInput
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');

    // Convert history messages format to send to API
    const history = messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    setIsLoading(true);

    // Call actual backend endpoint
    try {
      const response = await api.post('/chat', {
        message: trimmedInput,
        history: history
      });

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: response.data?.response || "No response generated."
      };
      
      setMessages((prev) => [...prev, aiMsg]);
    } catch (error) {
      console.error('Chat API Error:', error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: "Üzgünüm, şu anda yanıt veremiyorum. Lütfen sunucu bağlantısını veya internetinizi kontrol edin."
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Backdrop overlay */}
      <div 
        onClick={toggleHelp}
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[60] transition-opacity duration-300 ${
          isHelpOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Slide-over Drawer */}
      <div 
        className={`fixed top-0 right-0 h-full w-full sm:w-[420px] bg-slate-50 shadow-2xl z-[70] transform transition-transform duration-300 ease-in-out flex flex-col ${
          isHelpOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="bg-white border-b border-slate-200 px-5 py-4 flex items-center justify-between shadow-sm z-10 shrink-0">
          <div className="flex items-center gap-3">
            <span className="w-9 h-9 flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-inner font-serif text-lg font-bold">
              AI
            </span>
            <div>
              <h2 className="text-[15px] font-bold text-slate-800 tracking-tight">HEALTH-AI Assistant</h2>
              <p className="text-[11px] font-semibold text-emerald-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Online
              </p>
            </div>
          </div>
          <button 
            onClick={toggleHelp}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors"
            aria-label="Close Assistant"
          >
            ✕
          </button>
        </div>

        {/* Chat Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 scrollbar-hide">
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div 
                key={msg.id} 
                className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <div 
                  className={`relative max-w-[85%] px-4 py-3 rounded-2xl text-[14px] leading-relaxed shadow-sm ${
                    isUser 
                      ? 'bg-indigo-600 text-white rounded-br-sm' 
                      : 'bg-white border border-slate-200 text-slate-700 rounded-bl-sm'
                  }`}
                >
                  {/* Parse basic markdown bolding if present */}
                  {msg.content.split('**').map((chunk, i) => 
                    i % 2 === 1 ? <strong key={i} className={isUser ? "text-white" : "text-slate-900"}>{chunk}</strong> : chunk
                  )}
                </div>
              </div>
            );
          })}
          
          {isLoading && (
            <div className={`flex w-full justify-start`}>
              <div className={`relative px-5 py-3 rounded-2xl bg-white border border-slate-200 text-slate-500 rounded-bl-sm flex items-center gap-1.5 shadow-sm`}>
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
          
          <div ref={bottomRef} className="h-1 shrink-0" />
        </div>

        {/* Input Area */}
        <div className="bg-white p-4 border-t border-slate-200 shrink-0 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.02)]">
          <form 
            onSubmit={handleSendMessage}
            className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-1.5 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 transition-all"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about ML concepts..."
              className="flex-1 bg-transparent border-none text-[14px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0 px-3 py-2"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="w-10 h-10 flex items-center justify-center shrink-0 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
            >
              <span className="text-lg -mt-0.5 ml-0.5">↑</span>
            </button>
          </form>
          <div className="text-center mt-2.5">
            <span className="text-[10px] text-slate-400 font-medium tracking-wide">AI can make mistakes. Verify clinical decisions.</span>
          </div>
        </div>
      </div>
    </>
  );
};
