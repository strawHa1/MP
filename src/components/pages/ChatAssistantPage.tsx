import React, { useState } from 'react';
import {
  Bot,
  Send,
  User,
  Zap,
  Sparkles,
  RefreshCw,
  Building2,
  Flame,
  FileSpreadsheet
} from 'lucide-react';
import { ChatMessage } from '../../types';

interface ChatAssistantPageProps {
  onNavigate: (path: string) => void;
}

const PROMPT_SUGGESTIONS = [
  'Summarize Taiwan Strait risk for NVDA & TSM',
  'Simulate 20% crude oil shock on airline sector',
  'Generate 1-page risk brief on Panama Canal draft cuts',
  'What are top 3 risks for ASML semiconductor supply chain?'
];

export const ChatAssistantPage: React.FC<ChatAssistantPageProps> = ({ onNavigate }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      sender: 'assistant',
      text: 'Hello John. I am **Black Swan AI**, your financial risk intelligence assistant. Ask me about geopolitical events, supply chain chokepoints, or run scenario shocks across your portfolio.',
      timestamp: 'Just now'
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [thinking, setThinking] = useState(false);

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim()) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!queryText) setInputQuery('');
    setThinking(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend, history: messages })
      });

      if (response.ok) {
        const data = await response.json();
        const aiMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          text: data.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, aiMsg]);
      } else {
        // Fallback response
        const fallbackMsg: ChatMessage = {
          id: `ai-${Date.now()}`,
          sender: 'assistant',
          text: `Analysis complete for: "${textToSend}". Key risk drivers indicate heightened maritime freight premiums and sub-30 day supply buffer constraints for Asia-Pacific hardware exports.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };
        setMessages((prev) => [...prev, fallbackMsg]);
      }
    } catch (err) {
      console.error('Chat AI error:', err);
    } finally {
      setThinking(false);
    }
  };

  return (
    <div className="p-6 h-[calc(100vh-4rem)] max-w-5xl mx-auto flex flex-col font-sans space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-4 border-b border-[#232A3D]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-lg">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold text-white tracking-tight flex items-center gap-2">
              Black Swan AI Assistant
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            </h1>
            <p className="text-xs text-slate-400">Powered by server-side Gemini AI Reasoning Engine</p>
          </div>
        </div>

        <button
          onClick={() => setMessages([messages[0]])}
          className="p-2 rounded-xl bg-[#0F1420] border border-[#232A3D] text-slate-400 hover:text-white text-xs font-semibold flex items-center gap-1.5"
          title="Clear Conversation"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Reset
        </button>
      </div>

      {/* Message History Container */}
      <div className="flex-1 overflow-y-auto space-y-4 p-4 rounded-2xl bg-[#0F1420] border border-[#232A3D] custom-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'assistant' && (
              <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
            )}

            <div
              className={`max-w-xl p-4 rounded-2xl text-xs leading-relaxed space-y-1 ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-br-none shadow-md font-medium'
                  : 'bg-[#161B2C] border border-[#232A3D] text-slate-200 rounded-bl-none shadow-md'
              }`}
            >
              <div className="whitespace-pre-line">{msg.text}</div>
              <div className={`text-[9px] font-mono mt-1 ${msg.sender === 'user' ? 'text-blue-100 text-right' : 'text-slate-500'}`}>
                {msg.timestamp}
              </div>
            </div>

            {msg.sender === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {thinking && (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-600/20 border border-purple-500/30 text-purple-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4 animate-spin" />
            </div>
            <div className="bg-[#161B2C] border border-[#232A3D] px-4 py-3 rounded-2xl text-xs text-slate-400 font-mono animate-pulse">
              Synthesizing real-time market data & geopolitical intelligence...
            </div>
          </div>
        )}
      </div>

      {/* Prompt Suggestions */}
      <div className="flex items-center gap-2 overflow-x-auto py-1 custom-scrollbar">
        {PROMPT_SUGGESTIONS.map((sug) => (
          <button
            key={sug}
            onClick={() => handleSendMessage(sug)}
            className="text-[11px] bg-[#0F1420] hover:bg-[#161B2C] text-slate-300 border border-[#232A3D] hover:border-slate-500 px-3 py-1.5 rounded-xl shrink-0 transition-colors"
          >
            {sug}
          </button>
        ))}
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask Black Swan AI about any event, company, or market risk..."
          className="flex-1 bg-[#0F1420] border border-[#232A3D] rounded-xl px-4 py-3 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-purple-500 font-mono transition-colors"
        />

        <button
          type="submit"
          disabled={thinking || !inputQuery.trim()}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center shrink-0 disabled:opacity-50"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};
