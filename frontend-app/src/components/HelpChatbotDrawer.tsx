import React, { useState, useRef, useEffect } from 'react';
import { useDomainStore } from '../store/useDomainStore';
import { useEDAStore } from '../store/useEDAStore';
import { useDataPrepStore } from '../store/useDataPrepStore';
import { useModelStore } from '../store/useModelStore';
import { buildApiUrl } from '../config/apiConfig';

interface Message {
  id: string;
  role: 'user' | 'ai';
  content: string;
}

export const HelpChatbotDrawer: React.FC = () => {
  const { isHelpOpen, toggleHelp, userMode, selectedDomainId, currentStep } = useDomainStore();
  const edaStore = useEDAStore();
  const prepStore = useDataPrepStore();
  const modelStore = useModelStore();
  const [inputText, setInputText] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: '1', 
      role: 'ai', 
      content: 'Hello! I am your HEALTH-AI assistant. Feel free to ask questions about machine learning and clinical models.' 
    }
  ]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat when messages change
  useEffect(() => {
    if (isHelpOpen && chatScrollRef.current) {
      requestAnimationFrame(() => {
        if (chatScrollRef.current) {
          chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
      });
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

    // Prepare history
    const historyPayload = messages.map(m => ({
      role: m.role,
      content: m.content
    }));

    const contextPayload = {
      global: {
        userMode,
        domain: selectedDomainId,
        currentStep
      },
      eda: {
        mlTask: edaStore.mlTask,
        targetColumn: edaStore.targetColumn,
        totalRows: edaStore.totalRows,
        ignoredColumns: edaStore.ignoredColumns,
        columnsSummary: edaStore.edaData?.columns?.map(c => ({
          name: c.name,
          type: c.type,
          missing_percentage: c.missing_percentage,
          unique_values: c.unique_values
        }))
      },
      dataPrep: {
        activeTab: prepStore.activeTabId,
        cleaningPipeline: prepStore.cleaningPipeline,
        previewShape: prepStore.previewShape,
        missingColumns: prepStore.missingColumns,
        outlierColumns: prepStore.outlierColumns,
        evaluatedSystemSuggestions: {
          imputation: prepStore.missingColumns?.map(col => ({
            column: col.column,
            missing_percentage: col.missing_percentage,
            systemSuggests: col.missing_percentage < 5 ? 'drop_rows' : col.missing_percentage > 30 ? 'drop_column' : 'knn'
          })),
          outliers: prepStore.outlierColumns?.map(col => ({
            column: col.column,
            outlier_percentage: col.outlier_percentage,
            systemSuggests: {
              detector: (col as any).recommended_detector ?? (col as any).recommendation ?? 'iqr',
              treatment: (col as any).recommended_treatment ?? 'cap_1_99',
              reason: (col as any).suggestion_reason
            }
          })),
          activeTabSuggestions: prepStore.tabSuggestions[prepStore.activeTabId] ?? null
        },
        systemHeuristics: {
          imputation: "If missing < 5% -> Drop Rows. If 5-30% -> KNN Imputer. If > 30% -> Drop Column.",
          general: "Always fit imputers/scalers on Training set only to prevent data leakage."
        }
      },
      modeling: {
        phase: modelStore.phase,
        bestResultTaskId: modelStore.bestResultTaskId,
        bestMetrics: modelStore.bestResultTaskId ? modelStore.results[modelStore.bestResultTaskId]?.test_metrics || modelStore.results[modelStore.bestResultTaskId]?.metrics : null
      }
    };

    try {
      const response = await fetch(buildApiUrl('/chat'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: trimmedInput,
          history: historyPayload,
          context: contextPayload
        })
      });

      if (!response.ok) {
        throw new Error('API Error');
      }

      const data = await response.json();
      
      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: data.response
      };
      setMessages((prev) => [...prev, aiMsg]);
      
    } catch (error) {
      console.error("Chat error:", error);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: 'Sorry, I cannot reach the server right now, or an error occurred.'
      };
      setMessages((prev) => [...prev, errorMsg]);
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
        <div ref={chatScrollRef} className="flex-1 overflow-y-auto p-4 sm:p-5 flex flex-col gap-4 scrollbar-hide">
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
              disabled={!inputText.trim()}
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
