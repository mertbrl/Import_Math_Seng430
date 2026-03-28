import React, { useState, useRef, useEffect } from 'react';
import { useDomainStore } from '../store/useDomainStore';

const GLOSSARY_TERMS: Record<string, string> = {
  "algorithm": "A set of step-by-step instructions a computer follows to find patterns in patient data and make predictions — like a fast, data-driven decision checklist.",
  "training data": "Historical patient records the model learns from. Similar to a doctor reviewing past cases before seeing new patients.",
  "test data": "Patients the model has never seen, used to measure how well the AI performs. If a model only works on training data, it has memorised rather than learned.",
  "features": "The input measurements (columns in your data) used to make predictions — for example, age, blood pressure, creatinine level, smoking status.",
  "target variable": "The outcome the model is trying to predict — for example, readmission, diagnosis, survival, or disease stage.",
  "overfitting": "When a model memorises the training cases so precisely that it fails on new patients. Like a student who memorises exam answers but cannot apply the knowledge.",
  "underfitting": "When a model is too simple to learn anything useful. Like a clinician who gives the same diagnosis regardless of symptoms.",
  "normalisation": "Adjusting all measurements to the same scale so no single measurement dominates because of its units. Age (0–100) and a troponin level (0–50,000) must be rescaled before they can be compared fairly.",
  "class imbalance": "When one outcome is much rarer than the other in the training data. A model trained on 95% negative cases may simply predict negative for everyone and appear 95% accurate — but miss all real cases.",
  "smote": "Synthetic Minority Over-sampling Technique. Creates artificial examples of the rare outcome to balance the training data. Applied to training data only — never to test patients.",
  "sensitivity": "Of all patients who truly have the condition, what fraction did the model correctly identify? Low sensitivity means the model misses real cases. Critical in any screening application.",
  "specificity": "Of all patients who truly do not have the condition, what fraction did the model correctly call healthy? Low specificity means too many false alarms.",
  "precision": "Of all patients the model flagged as positive, what fraction actually were? Low precision means many unnecessary referrals or treatments.",
  "f1 score": "A single number that balances Sensitivity and Precision. Useful when both false negatives and false positives have real clinical costs.",
  "auc-roc": "A score from 0.5 (random guessing) to 1.0 (perfect separation) summarising how well the model distinguishes between positive and negative patients. Above 0.8 is considered good.",
  "confusion matrix": "A 2x2 table showing: correctly identified sick patients, correctly identified healthy patients, healthy patients incorrectly flagged as sick, and sick patients incorrectly called safe.",
  "feature importance": "A ranking of which patient measurements the model relied on most. Helps confirm whether the AI is using clinically meaningful signals.",
  "hyperparameter": "A setting chosen before training that controls model behaviour — for example, K in KNN or tree depth in Decision Tree. Not learned from data; set by the user via sliders.",
  "bias": "When a model performs significantly worse for certain patient subgroups (for example, older patients, women, or ethnic minorities) because they were under-represented in the training data.",
  "cross-validation": "Splitting the data multiple times and averaging results to get a more reliable performance estimate than a single train/test split."
};

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
      content: 'Hello! I am your HEALTH-AI assistant. You can ask me about ML terms like SMOTE, AUC-ROC, or Overfitting.' 
    }
  ]);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat when messages change
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isHelpOpen]);

  const handleSendMessage = (e?: React.FormEvent) => {
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

    // 2. Mock AI Logic (Look for keywords in input)
    setTimeout(() => {
      const lowerInput = trimmedInput.toLowerCase();
      let matchedDefinition = '';
      let matchedKey = '';

      // Check against glossary keys
      for (const [key, value] of Object.entries(GLOSSARY_TERMS)) {
        if (lowerInput.includes(key)) {
          matchedDefinition = value;
          matchedKey = key;
          break;
        }
      }

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'ai',
        content: matchedDefinition 
          ? `**${matchedKey.toUpperCase()}**: ${matchedDefinition}` 
          : "I'm currently running in frontend-only mode. Soon, I'll be connected to my Python RAG backend to answer that!"
      };

      setMessages((prev) => [...prev, aiMsg]);
    }, 600); // Simulate network delay
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
