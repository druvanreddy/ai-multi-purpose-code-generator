import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Sparkles, User, Plus, Trash2, MessageSquare,
  ChevronLeft, Clock, X,
} from 'lucide-react';
import { marked } from 'marked';
import { api } from '../../utils/api';
import { useSettings } from '../../hooks/useSettings';

const STORAGE_KEY = 'dmixerai_chat_sessions';

const STARTERS = [
  { label: 'Explain a concept', prompt: 'Explain the difference between a process and a thread, with a real-world analogy.' },
  { label: 'Write a function', prompt: 'Write a Python function that flattens an arbitrarily nested list.' },
  { label: 'Compare approaches', prompt: 'What are the trade-offs between SQL and NoSQL databases for a booking system?' },
  { label: 'Ask anything', prompt: 'What are the latest trends in AI and machine learning?' },
];

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getTitle(messages) {
  const first = messages.find((m) => m.role === 'user');
  if (!first) return 'New Chat';
  const text = first.content.slice(0, 60);
  return text.length < first.content.length ? text + '…' : text;
}

function loadSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  } catch { /* quota exceeded — silently drop */ }
}

function formatTime(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
  return d.toLocaleDateString();
}

export default function ChatPanel() {
  const { settings } = useSettings();
  const [sessions, setSessions] = useState(loadSessions);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const endRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const persistSession = useCallback((id, msgs) => {
    if (!id || msgs.length === 0) return;
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === id);
      const entry = {
        id,
        title: getTitle(msgs),
        messages: msgs,
        updatedAt: Date.now(),
      };
      let next;
      if (idx >= 0) {
        next = [...prev];
        next[idx] = entry;
      } else {
        next = [entry, ...prev];
      }
      next.sort((a, b) => b.updatedAt - a.updatedAt);
      if (next.length > 50) next = next.slice(0, 50);
      saveSessions(next);
      return next;
    });
  }, []);

  const send = async (text) => {
    if (!text.trim() || streaming) return;
    const userMsg = { role: 'user', content: text.trim() };

    let sessionId = activeId;
    if (!sessionId) {
      sessionId = generateId();
      setActiveId(sessionId);
    }

    const history = messages.map((m) => ({ role: m.role, content: m.content }));
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setStreaming(true);

    const aiMsg = { role: 'assistant', content: '' };
    setMessages((prev) => [...prev, aiMsg]);

    try {
      const res = await api.chat({
        message: text.trim(),
        history,
        model: settings.model,
        temperature: settings.temperature,
        max_tokens: settings.maxTokens,
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], content: full };
          return copy;
        });
      }

      const finalMessages = [...updatedMessages, { role: 'assistant', content: full }];
      setMessages(finalMessages);
      persistSession(sessionId, finalMessages);
    } catch {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { ...copy[copy.length - 1], content: 'Error connecting to AI. Please try again.' };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send(input);
    }
  };

  const newConversation = () => {
    if (streaming) return;
    setActiveId(null);
    setMessages([]);
    setInput('');
    setShowHistory(false);
    textareaRef.current?.focus();
  };

  const loadSession = (session) => {
    if (streaming) return;
    setActiveId(session.id);
    setMessages(session.messages);
    setShowHistory(false);
    textareaRef.current?.focus();
  };

  const deleteSession = (id, e) => {
    e.stopPropagation();
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id);
      saveSessions(next);
      return next;
    });
    if (activeId === id) {
      setActiveId(null);
      setMessages([]);
    }
  };

  const clearAllSessions = () => {
    setSessions([]);
    saveSessions([]);
    setActiveId(null);
    setMessages([]);
    setShowHistory(false);
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
      {/* Top bar */}
      <div className="shrink-0 flex items-center justify-between pb-3 mb-3 border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-surface-800/60 border border-white/[0.06] text-surface-300 hover:text-surface-100 hover:bg-surface-700/60 transition-colors"
          >
            <Clock size={14} />
            History
            {sessions.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] rounded-full bg-primary-500/20 text-primary-400">
                {sessions.length}
              </span>
            )}
          </button>
          {hasMessages && (
            <span className="flex items-center gap-1.5 text-surface-500 text-xs">
              <MessageSquare size={12} />
              {Math.floor(messages.length / 2)} exchange{Math.floor(messages.length / 2) !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <button
          onClick={newConversation}
          disabled={streaming}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-primary-500/10 border border-primary-500/20 text-primary-400 hover:bg-primary-500/20 transition-colors disabled:opacity-40"
        >
          <Plus size={14} />
          New Chat
        </button>
      </div>

      {/* Chat history sidebar (overlay) */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-30 flex"
            style={{ position: 'relative', marginBottom: '0.5rem' }}
          >
            <div className="w-full max-w-md rounded-xl bg-surface-900/95 border border-white/[0.06] backdrop-blur-xl overflow-hidden flex flex-col max-h-[60vh]">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                <h3 className="text-sm font-medium text-surface-200">Chat History</h3>
                <div className="flex items-center gap-2">
                  {sessions.length > 0 && (
                    <button
                      onClick={clearAllSessions}
                      className="text-[11px] text-danger-400 hover:text-danger-300 transition-colors"
                    >
                      Clear All
                    </button>
                  )}
                  <button
                    onClick={() => setShowHistory(false)}
                    className="p-1 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-surface-200 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {sessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <MessageSquare size={24} className="text-surface-600 mb-2" />
                    <p className="text-surface-500 text-sm">No previous chats</p>
                    <p className="text-surface-600 text-xs mt-1">Start a conversation and it will appear here</p>
                  </div>
                ) : (
                  <div className="py-1">
                    {sessions.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => loadSession(s)}
                        className={`w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-surface-800/60 transition-colors group ${
                          activeId === s.id ? 'bg-primary-500/10 border-l-2 border-primary-500' : ''
                        }`}
                      >
                        <MessageSquare size={14} className="text-surface-500 shrink-0 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-surface-200 truncate">{s.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] text-surface-500">{formatTime(s.updatedAt)}</span>
                            <span className="text-[11px] text-surface-600">
                              {Math.floor(s.messages.length / 2)} msg{Math.floor(s.messages.length / 2) !== 1 ? 's' : ''}
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => deleteSession(s.id, e)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-danger-500/20 text-surface-500 hover:text-danger-400 transition-all shrink-0"
                          title="Delete chat"
                        >
                          <Trash2 size={12} />
                        </button>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-2 pb-4">
        <AnimatePresence initial={false}>
          {messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full text-center gap-4"
            >
              <div className="p-4 rounded-2xl bg-primary-500/10 border border-primary-500/20">
                <Sparkles size={28} className="text-primary-400" />
              </div>
              <h3 className="text-surface-200 font-medium text-lg">Start a Conversation</h3>
              <p className="text-surface-400 text-sm max-w-md">
                Ask me anything — coding, finance, science, business, or any topic.
                Your conversation is saved automatically so you can come back to it later.
              </p>
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                {STARTERS.map((s) => (
                  <button
                    key={s.label}
                    onClick={() => send(s.prompt)}
                    className="chip hover:chip-active"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-primary-500/15 flex items-center justify-center shrink-0 mt-0.5">
                    <Sparkles size={14} className="text-primary-400" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                    msg.role === 'user'
                      ? 'bg-primary-600/20 border border-primary-500/20 text-surface-100'
                      : 'bg-surface-800/60 border border-white/[0.04] text-surface-200'
                  }`}
                >
                  {msg.role === 'assistant' ? (
                    <div
                      className="prose prose-invert prose-sm max-w-none prose-pre:bg-surface-900/80 prose-pre:border prose-pre:border-white/[0.06] prose-pre:rounded-xl prose-code:text-primary-300"
                      dangerouslySetInnerHTML={{ __html: marked.parse(msg.content || '') }}
                    />
                  ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-surface-700 flex items-center justify-center shrink-0 mt-0.5">
                    <User size={14} className="text-surface-300" />
                  </div>
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
        <div ref={endRef} />
      </div>

      {/* Input */}
      <div className="shrink-0 border-t border-white/[0.04] pt-4">
        <form
          onSubmit={(e) => { e.preventDefault(); send(input); }}
          className="flex items-end gap-3"
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKey}
            rows={1}
            placeholder={hasMessages ? "Continue the conversation… (Enter to send)" : "Ask me anything… (Enter to send, Shift+Enter for new line)"}
            className="textarea-field flex-1 min-h-[44px] max-h-[160px] resize-none"
          />
          <button type="submit" disabled={streaming || !input.trim()} className="btn-primary !px-4 shrink-0">
            <Send size={16} />
          </button>
        </form>
        {hasMessages && (
          <p className="text-surface-500 text-[11px] mt-2 text-center">
            Conversation context is active — follow-ups reference previous messages
          </p>
        )}
      </div>
    </div>
  );
}
