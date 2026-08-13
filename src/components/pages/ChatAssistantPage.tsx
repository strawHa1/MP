import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Bot,
  Send,
  User,
  Sparkles,
  RefreshCw,
  AlertTriangle,
  RotateCcw,
  Wallet,
  Loader2
} from 'lucide-react';
import { ChatMessage } from '../../types';
import { MarkdownMessage } from '../chat/MarkdownMessage';
import { TradeConfirmationCard, TradeConfirmationData } from '../chat/TradeConfirmationCard';
import { TradeReceiptCard, TradeReceiptData } from '../chat/TradeReceiptCard';
import { AlertCreatedCard, AlertCreatedData } from '../chat/AlertCreatedCard';
import { parseChatIntent, resolveTicker, TradeIntent, AlertIntent } from '../../lib/chatIntentParser';
import {
  executeTrade,
  getCashBalance,
  getHolding,
  PORTFOLIO_UPDATED_EVENT
} from '../../lib/portfolioService';
import { createUserAlert, describeUserAlert, removeUserAlert } from '../../lib/alertsService';

interface ChatAssistantPageProps {
  onNavigate: (path: string) => void;
}

const SESSION_KEY = 'bs-chat-session';

const PROMPT_SUGGESTIONS = [
  'Summarize Taiwan Strait risk for NVDA & TSM',
  'What are the top 3 risks for ASML?',
  'Generate a 1-page risk brief on Panama Canal draft cuts',
  'Invest $5,000 in NVDA',
  'Alert me if TSM drops below $150'
];

const WELCOME_MESSAGE: ChatMessage = {
  id: 'msg-welcome',
  sender: 'assistant',
  text:
    'Hello John. I am **Black Swan AI**, your financial risk intelligence assistant.\n\n' +
    'I can help you with:\n' +
    '- **Risk analysis** — geopolitical events, supply chain chokepoints, ticker exposure\n' +
    '- **Trading** — e.g. `Invest $5,000 in NVDA` or `Withdraw $2,000 from TSM`\n' +
    '- **Alerts** — e.g. `Alert me if TSM drops below $150`\n\n' +
    'Trades always require your explicit confirmation before anything is executed.',
  timestamp: 'Just now'
};

const now = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const money = (value: number) =>
  `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STALE_OFFLINE_MARKERS = [
  'AI reasoning engine is offline',
  'No `GEMINI_API_KEY` is configured on the server'
];

function isGeminiConfigError(message: string): boolean {
  const m = (message || '').toLowerCase();
  return (
    m.includes('gemini is not configured') ||
    m.includes('gemini is offline') ||
    m.includes('your_key_here') ||
    m.includes('gemini_api_key')
  );
}

/**
 * Restores the previous session. Any trade card left pending from a previous
 * visit is marked cancelled, because its quoted price is no longer current and
 * must never be executed against a stale quote. Old "Gemini offline" wall
 * messages are dropped so a fixed server is not masked by cached failures.
 */
function loadSession(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return [WELCOME_MESSAGE];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed) || parsed.length === 0) return [WELCOME_MESSAGE];
    const cleaned = parsed
      .filter((msg) => !STALE_OFFLINE_MARKERS.some((m) => (msg.text || '').includes(m)))
      .map((msg) =>
        msg.widget?.type === 'tradeConfirmation' && msg.widget.data?.status === 'pending'
          ? { ...msg, widget: { ...msg.widget, data: { ...msg.widget.data, status: 'cancelled' } } }
          : msg
      );
    return cleaned.length > 0 ? cleaned : [WELCOME_MESSAGE];
  } catch {
    return [WELCOME_MESSAGE];
  }
}

/** Best-effort current score for a named risk index, used for alert context. */
async function lookupRiskScore(subject: string): Promise<number | undefined> {
  try {
    const res = await fetch('/api/countries/risk', { cache: 'no-store' });
    if (!res.ok) return undefined;
    const data = await res.json();
    const rows: any[] = Array.isArray(data) ? data : data.countries || [];
    const needle = subject.toLowerCase();
    const match = rows.find((r) => {
      const name = String(r.name || r.country || '').toLowerCase();
      return name && (name.includes(needle) || needle.includes(name));
    });
    const score = Number(match?.riskScore ?? match?.score);
    return Number.isFinite(score) ? score : undefined;
  } catch {
    return undefined;
  }
}

export const ChatAssistantPage: React.FC<ChatAssistantPageProps> = ({ onNavigate }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(loadSession);
  const [inputQuery, setInputQuery] = useState('');
  const [thinking, setThinking] = useState(false);
  /** Id of the bubble currently receiving stream tokens, if any. */
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [busyTradeId, setBusyTradeId] = useState<string | null>(null);
  const [failedPrompt, setFailedPrompt] = useState<string | null>(null);
  const [degraded, setDegraded] = useState(false);
  const [cashBalance, setCashBalance] = useState(0);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [keyError, setKeyError] = useState<string | null>(null);
  const [keySaving, setKeySaving] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync offline banner with server key status (env file or runtime configure-key).
  useEffect(() => {
    fetch('/api/chat/status')
      .then((r) => r.json())
      .then((s) => setDegraded(!s.geminiConfigured))
      .catch(() => setDegraded(true));
  }, []);

  // Persist the transcript so the conversation survives reloads. Skipped mid-stream
  // to avoid a localStorage write for every token.
  useEffect(() => {
    if (streamingId) return;
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(messages.slice(-60)));
    } catch {
      /* quota exceeded — the session simply won't persist */
    }
  }, [messages, streamingId]);

  // Follow the newest content. Smooth scrolling per token looks jittery, so the
  // instant behaviour is used while a reply is streaming in.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({
      behavior: streamingId ? 'auto' : 'smooth',
      block: 'end'
    });
  }, [messages, thinking, streamingId]);

  // Keep the header cash figure in sync with trades made here or elsewhere.
  useEffect(() => {
    const sync = () => setCashBalance(getCashBalance());
    sync();
    window.addEventListener(PORTFOLIO_UPDATED_EVENT, sync);
    return () => window.removeEventListener(PORTFOLIO_UPDATED_EVENT, sync);
  }, []);

  const pushMessage = useCallback((message: Omit<ChatMessage, 'id' | 'timestamp'>) => {
    const full: ChatMessage = {
      ...message,
      id: `${message.sender}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: now()
    };
    setMessages((prev) => [...prev, full]);
    return full;
  }, []);

  const pushAssistantError = useCallback(
    (text: string, retryPrompt?: string) => {
      pushMessage({ sender: 'assistant', text, status: 'error' });
      setFailedPrompt(retryPrompt ?? null);
    },
    [pushMessage]
  );

  /**
   * Streams a reply from /api/chat/stream, appending each token to a single
   * assistant bubble. If the stream is empty or fails, falls back to POST
   * /api/chat so the user still gets a full answer instead of a blank bubble.
   */
  const askAssistant = useCallback(
    async (text: string, history: ChatMessage[]) => {
      const payload = {
        message: text,
        history: history.filter((m) => m.status !== 'error' && !m.widget)
      };
      const streamId = `assistant-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

      const appendDelta = (delta: string) => {
        setMessages((prev) => {
          if (prev.some((m) => m.id === streamId)) {
            return prev.map((m) => (m.id === streamId ? { ...m, text: m.text + delta } : m));
          }
          return [
            ...prev,
            { id: streamId, sender: 'assistant', text: delta, timestamp: now(), status: 'ok' }
          ];
        });
      };

      const fetchJsonReply = async () => {
        const fallback = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const body = await fallback.json().catch(() => ({}));
        if (!fallback.ok) {
          throw new Error(body.error || `HTTP ${fallback.status}`);
        }
        if (!body.reply || !String(body.reply).trim()) {
          throw new Error('Empty reply from /api/chat');
        }
        if (body.geminiError) {
          console.warn('[Chat] Gemini failed, used fallback:', body.geminiError);
        }
        setDegraded(Boolean(body.degraded));
        // Replace any partial stream bubble with the complete JSON reply.
        setMessages((prev) => {
          const withoutPartial = prev.filter((m) => m.id !== streamId);
          return [
            ...withoutPartial,
            {
              id: streamId,
              sender: 'assistant' as const,
              text: body.reply,
              timestamp: now(),
              status: 'ok' as const
            }
          ];
        });
        setFailedPrompt(null);
      };

      setThinking(true);
      try {
        const response = await fetch('/api/chat/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${response.status}`);
        }

        if (!response.body) {
          await fetchJsonReply();
          return;
        }

        setStreamingId(streamId);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let streamError: string | null = null;
        let receivedAny = false;
        let isDegraded = false;

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';

          for (const frame of frames) {
            const dataLines = frame
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l.startsWith('data:'));
            for (const line of dataLines) {
              let event: any;
              try {
                event = JSON.parse(line.slice(5).trim());
              } catch {
                continue;
              }
              if (event.degraded) isDegraded = true;
              if (event.error) streamError = event.error;
              if (event.warning) console.warn('[Chat] stream warning:', event.warning);
              if (typeof event.delta === 'string' && event.delta.length > 0) {
                receivedAny = true;
                setThinking(false);
                appendDelta(event.delta);
              }
            }
          }
        }

        setDegraded(isDegraded);
        if (streamError && !receivedAny) throw new Error(streamError);
        if (!receivedAny) {
          console.warn('[Chat] Empty SSE body — falling back to /api/chat');
          await fetchJsonReply();
          return;
        }
        if (!isDegraded) setDegraded(false);
        if (streamError) {
          // Partial answer already shown; surface the error as a follow-up note.
          console.error('[Chat] Stream ended with error after partial text:', streamError);
        }
        setFailedPrompt(null);
      } catch (err: any) {
        console.error('Chat AI error:', err);
        try {
          await fetchJsonReply();
          return;
        } catch (fallbackErr: any) {
          console.error('Chat AI fallback error:', fallbackErr);
          setMessages((prev) => prev.filter((m) => m.id !== streamId));
          const errText = fallbackErr?.message || err?.message || 'The assistant could not be reached.';
          if (isGeminiConfigError(errText)) {
            setDegraded(true);
            setShowKeyModal(true);
          }
          pushAssistantError(`**Error talking to the assistant.**\n\n${errText}`, text);
        }
      } finally {
        setStreamingId(null);
        setThinking(false);
      }
    },
    [pushMessage, pushAssistantError]
  );

  const handleConfigureKey = useCallback(async () => {
    const key = apiKeyInput.trim();
    if (!key) {
      setKeyError('Paste your Gemini API key.');
      return;
    }
    setKeySaving(true);
    setKeyError(null);
    try {
      const res = await fetch('/api/chat/configure-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: key, persist: true })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body.error || `HTTP ${res.status}`);
      }
      setDegraded(false);
      setShowKeyModal(false);
      setApiKeyInput('');
      pushMessage({
        sender: 'assistant',
        status: 'ok',
        text:
          `**Gemini connected.** Key saved to \`.env\` (${body.geminiKeyPreview || 'configured'}). You can chat normally now.`
      });
      if (failedPrompt) {
        const prompt = failedPrompt;
        setFailedPrompt(null);
        setMessages((prev) => prev.filter((m) => m.status !== 'error'));
        askAssistant(prompt, messages.filter((m) => m.status !== 'error'));
      }
    } catch (err: any) {
      setKeyError(err?.message || 'Could not save key');
    } finally {
      setKeySaving(false);
    }
  }, [apiKeyInput, failedPrompt, messages, pushMessage, askAssistant]);

  const runPipelinePing = useCallback(async () => {
    setThinking(true);
    try {
      const [statusRes, pingRes] = await Promise.all([
        fetch('/api/chat/status'),
        fetch('/api/chat/ping', { method: 'POST' })
      ]);
      const status = await statusRes.json();
      const ping = await pingRes.json().catch(() => ({}));
      console.log('[Chat] pipeline status:', status);
      console.log('[Chat] pipeline ping:', ping);
      const ok = Boolean(ping.ok);
      pushMessage({
        sender: 'assistant',
        status: ok ? 'ok' : 'error',
        text:
          `**Dev pipeline ping**\n\n` +
          `- Gemini configured: **${status.geminiConfigured ? 'yes' : 'no'}**` +
          (status.geminiKeyPreview ? ` (\`${status.geminiKeyPreview}\`)` : '') +
          `\n- Models: \`${(status.models || []).join(', ')}\`\n` +
          `- HTTP: **${pingRes.status}** · source: **${ping.source || 'n/a'}**` +
          (ping.model ? ` (\`${ping.model}\`)` : '') +
          `\n\n**Raw reply / error**\n\n${ping.reply || ping.error || '(empty)'}`
      });
      setDegraded(!status.geminiConfigured);
    } catch (err: any) {
      console.error('[Chat] pipeline ping failed:', err);
      pushAssistantError(`**Pipeline ping failed.**\n\n${err?.message || err}`);
    } finally {
      setThinking(false);
    }
  }, [pushMessage, pushAssistantError]);

  /**
   * Invest / withdraw: resolves a live price, validates the order up front, and
   * then renders a pending confirmation card. Nothing is executed at this stage.
   */
  const handleTradeIntent = useCallback(
    async (intent: TradeIntent) => {
      setThinking(true);
      const resolved = await resolveTicker(intent.ticker);
      setThinking(false);

      if (!resolved) {
        pushAssistantError(
          `I could not find a listed security with the ticker **$${intent.ticker}**. ` +
            'Please check the symbol and try again — for example `Invest $5,000 in NVDA`.'
        );
        return;
      }
      if (!Number.isFinite(intent.amount) || intent.amount <= 0) {
        pushAssistantError('Please specify an amount greater than **$0**.');
        return;
      }

      const cash = getCashBalance();
      const holding = getHolding(resolved.symbol);
      const positionValue = (holding?.shares || 0) * resolved.price;

      // Surface funding / position problems before showing a Confirm button.
      if (intent.action === 'invest' && intent.amount > cash) {
        pushAssistantError(
          `**Insufficient funds.** Investing ${money(intent.amount)} in $${resolved.symbol} is not ` +
            `possible — your available cash balance is ${money(cash)}.`
        );
        return;
      }
      if (intent.action === 'withdraw') {
        if (!holding) {
          pushAssistantError(
            `You do not currently hold any **$${resolved.symbol}**, so there is nothing to withdraw.`
          );
          return;
        }
        if (intent.amount > positionValue) {
          pushAssistantError(
            `**Amount exceeds position.** Your $${resolved.symbol} holding is worth ` +
              `${money(positionValue)} at ${money(resolved.price)}/share, so ${money(intent.amount)} ` +
              'cannot be withdrawn.'
          );
          return;
        }
      }

      const data: TradeConfirmationData = {
        action: intent.action,
        ticker: resolved.symbol,
        companyName: resolved.name,
        amount: intent.amount,
        price: resolved.price,
        shares: Number((intent.amount / resolved.price).toFixed(4)),
        cashBalance: cash,
        positionValue,
        status: 'pending'
      };

      pushMessage({
        sender: 'assistant',
        text: `Please review and confirm this ${
          intent.action === 'invest' ? 'investment' : 'withdrawal'
        } request.`,
        widget: { type: 'tradeConfirmation', data }
      });
    },
    [pushMessage, pushAssistantError]
  );

  /** Executes the order only after the user presses Confirm on the card. */
  const handleConfirmTrade = useCallback(
    (messageId: string, data: TradeConfirmationData) => {
      setBusyTradeId(messageId);
      const result = executeTrade({
        action: data.action,
        ticker: data.ticker,
        companyName: data.companyName,
        amount: data.amount,
        price: data.price
      });

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId && msg.widget
            ? {
                ...msg,
                widget: {
                  ...msg.widget,
                  data: { ...data, status: result.ok ? 'confirmed' : 'cancelled' }
                }
              }
            : msg
        )
      );
      setBusyTradeId(null);

      if (!result.ok || !result.transaction) {
        pushAssistantError(`**Order rejected.** ${result.error || 'Please try again.'}`);
        return;
      }

      const receipt: TradeReceiptData = {
        transaction: result.transaction,
        remainingShares: result.holding?.shares ?? 0,
        allocationPct: result.holding?.allocationPct ?? 0
      };

      pushMessage({
        sender: 'assistant',
        text:
          data.action === 'invest'
            ? `Done — ${money(data.amount)} invested in **$${data.ticker}**.`
            : `Done — ${money(data.amount)} withdrawn from **$${data.ticker}**.`,
        widget: { type: 'tradeReceipt', data: receipt }
      });
    },
    [pushMessage, pushAssistantError]
  );

  const handleCancelTrade = useCallback(
    (messageId: string, data: TradeConfirmationData) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === messageId && msg.widget
            ? { ...msg, widget: { ...msg.widget, data: { ...data, status: 'cancelled' } } }
            : msg
        )
      );
      pushMessage({
        sender: 'assistant',
        text: `No problem — the ${data.action === 'invest' ? 'investment' : 'withdrawal'} for **$${
          data.ticker
        }** was cancelled and nothing was executed.`
      });
    },
    [pushMessage]
  );

  /**
   * Alerts: validated, saved through alertsService, and immediately visible in
   * the Alerts Center via the shared storage event.
   */
  const handleAlertIntent = useCallback(
    async (intent: AlertIntent) => {
      setThinking(true);
      let referenceValue: number | undefined;

      if (intent.subjectType === 'stock') {
        const resolved = await resolveTicker(intent.subject);
        setThinking(false);
        if (!resolved) {
          pushAssistantError(
            `I could not find a listed security with the ticker **$${intent.subject}**, so I did not ` +
              'create that alert. Try `Alert me if TSM drops below $150`.'
          );
          return;
        }
        referenceValue = resolved.price;
      } else {
        referenceValue = await lookupRiskScore(intent.subject);
        setThinking(false);
      }

      if (!Number.isFinite(intent.threshold) || intent.threshold <= 0) {
        pushAssistantError('Please give me a threshold greater than **0** for that alert.');
        return;
      }

      const alert = createUserAlert({
        subject: intent.subject,
        subjectType: intent.subjectType,
        condition: intent.condition,
        threshold: intent.threshold,
        referenceValue
      });

      const data: AlertCreatedData = { alert };
      pushMessage({
        sender: 'assistant',
        text: `Alert created — I will notify you when **${describeUserAlert(alert)}**. It is now live in your Alerts Center.`,
        widget: { type: 'alertCreated', data }
      });
    },
    [pushMessage, pushAssistantError]
  );

  const handleRemoveAlert = useCallback((messageId: string, data: AlertCreatedData) => {
    removeUserAlert(data.alert.id);
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId && msg.widget
          ? { ...msg, widget: { ...msg.widget, data: { ...data, removed: true } } }
          : msg
      )
    );
  }, []);

  /** Entry point for the input bar, Enter key, and the quick-reply chips. */
  const handleSendMessage = useCallback(
    async (queryText?: string) => {
      const textToSend = (queryText ?? inputQuery).trim();
      if (!textToSend || thinking) return;

      const history = messages;
      pushMessage({ sender: 'user', text: textToSend });
      setInputQuery('');
      setFailedPrompt(null);

      // Trade and alert commands are handled locally so they stay deterministic
      // and always route through an explicit confirmation step.
      const intent = parseChatIntent(textToSend);
      if (intent.kind === 'trade') {
        await handleTradeIntent(intent);
        return;
      }
      if (intent.kind === 'alert') {
        await handleAlertIntent(intent);
        return;
      }

      await askAssistant(textToSend, history);
    },
    [inputQuery, thinking, messages, pushMessage, handleTradeIntent, handleAlertIntent, askAssistant]
  );

  const handleRetry = useCallback(() => {
    if (!failedPrompt) return;
    const prompt = failedPrompt;
    setFailedPrompt(null);
    // Drop the failed bubble so the retry reads as a single clean exchange.
    setMessages((prev) => prev.filter((m) => m.status !== 'error'));
    askAssistant(prompt, messages.filter((m) => m.status !== 'error'));
  }, [failedPrompt, messages, askAssistant]);

  const handleReset = useCallback(() => {
    setMessages([{ ...WELCOME_MESSAGE, timestamp: 'Just now' }]);
    setInputQuery('');
    setFailedPrompt(null);
    setThinking(false);
    setStreamingId(null);
    localStorage.removeItem(SESSION_KEY);
    inputRef.current?.focus();
  }, []);

  const renderWidget = (msg: ChatMessage) => {
    if (!msg.widget) return null;
    switch (msg.widget.type) {
      case 'tradeConfirmation':
        return (
          <TradeConfirmationCard
            data={msg.widget.data as TradeConfirmationData}
            busy={busyTradeId === msg.id}
            onConfirm={() => handleConfirmTrade(msg.id, msg.widget!.data as TradeConfirmationData)}
            onCancel={() => handleCancelTrade(msg.id, msg.widget!.data as TradeConfirmationData)}
          />
        );
      case 'tradeReceipt':
        return (
          <TradeReceiptCard
            data={msg.widget.data as TradeReceiptData}
            onViewPortfolio={() => onNavigate('/portfolio')}
          />
        );
      case 'alertCreated':
        return (
          <AlertCreatedCard
            data={msg.widget.data as AlertCreatedData}
            onViewAlerts={() => onNavigate('/alerts')}
            onRemove={() => handleRemoveAlert(msg.id, msg.widget!.data as AlertCreatedData)}
          />
        );
      default:
        return null;
    }
  };

  const lastMessage = messages[messages.length - 1];
  const showRetry = Boolean(failedPrompt) && lastMessage?.status === 'error';

  return (
    <div className="p-4 sm:p-6 h-[calc(100vh-4rem)] max-w-5xl mx-auto flex flex-col font-sans gap-3 sm:gap-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-slate-200 dark:border-[#232A3D]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-blue-600 flex items-center justify-center text-white shadow-lg shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <span className="truncate">Black Swan AI Assistant</span>
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  degraded ? 'bg-amber-400' : 'bg-emerald-400 animate-pulse'
                }`}
              />
            </h1>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
              Live risk intelligence · trading & alerts
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] text-[11px] font-mono">
            <Wallet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span className="text-slate-700 dark:text-slate-300">{money(cashBalance)}</span>
          </div>
          {import.meta.env.DEV && (
            <button
              type="button"
              onClick={runPipelinePing}
              disabled={thinking}
              className="p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40 text-amber-800 dark:text-amber-300 text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-50"
              title="Dev only: ping /api/chat/status and /api/chat/ping"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Ping</span>
            </button>
          )}
          <button
            onClick={handleReset}
            className="p-2 rounded-xl bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Clear conversation and start a fresh session"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Reset</span>
          </button>
        </div>
      </div>

      {degraded && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 px-3 py-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40 text-[11px] text-amber-800 dark:text-amber-300">
          <div className="flex items-start gap-2 flex-1">
            <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
            <span>
              Gemini is offline — your <code className="font-mono">.env</code> still has the placeholder{' '}
              <code className="font-mono">your_key_here</code>. Paste a real key from{' '}
              <a
                href="https://aistudio.google.com/apikey"
                target="_blank"
                rel="noreferrer"
                className="underline font-semibold"
              >
                Google AI Studio
              </a>
              .
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setKeyError(null);
              setShowKeyModal(true);
            }}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors"
          >
            Add API Key
          </button>
        </div>
      )}

      {showKeyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] p-5 shadow-xl">
            <h2 className="text-sm font-bold text-slate-900 dark:text-white mb-1">Connect Gemini</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-4">
              Paste your API key from{' '}
              <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline">
                aistudio.google.com/apikey
              </a>
              . It will be validated, saved to <code className="font-mono">.env</code>, and activated immediately.
            </p>
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="AQ.... or AIzaSy..."
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-[#232A3D] bg-slate-50 dark:bg-[#0F1420] text-xs font-mono text-slate-900 dark:text-white mb-2"
              autoFocus
            />
            {keyError && (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mb-2">{keyError}</p>
            )}
            <div className="flex justify-end gap-2 mt-3">
              <button
                type="button"
                onClick={() => {
                  setShowKeyModal(false);
                  setKeyError(null);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-400"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfigureKey}
                disabled={keySaving}
                className="px-4 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-xs font-semibold"
              >
                {keySaving ? 'Validating…' : 'Save & Connect'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Message history */}
      <div className="flex-1 overflow-y-auto space-y-4 p-3 sm:p-4 rounded-2xl bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] custom-scrollbar">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex gap-2 sm:gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {msg.sender === 'assistant' && (
              <div
                className={`w-8 h-8 rounded-xl border flex items-center justify-center shrink-0 ${
                  msg.status === 'error'
                    ? 'bg-rose-500/10 border-rose-500/30 text-rose-500'
                    : 'bg-purple-600/10 border-purple-500/30 text-purple-600 dark:text-purple-400'
                }`}
              >
                {msg.status === 'error' ? (
                  <AlertTriangle className="w-4 h-4" />
                ) : (
                  <Bot className="w-4 h-4" />
                )}
              </div>
            )}

            <div
              className={`max-w-[85%] sm:max-w-xl p-3 sm:p-4 rounded-2xl shadow-sm ${
                msg.sender === 'user'
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-br-none font-medium'
                  : msg.status === 'error'
                  ? 'bg-rose-50 dark:bg-rose-500/10 border border-rose-300 dark:border-rose-500/40 text-rose-900 dark:text-rose-200 rounded-bl-none'
                  : 'bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] text-slate-800 dark:text-slate-200 rounded-bl-none'
              }`}
            >
              {msg.sender === 'user' ? (
                <div className="text-xs leading-relaxed whitespace-pre-wrap break-words">{msg.text}</div>
              ) : (
                <>
                  <MarkdownMessage content={msg.text} />
                  {streamingId === msg.id && (
                    <span className="inline-block w-1.5 h-3 -mb-0.5 bg-purple-500 animate-pulse rounded-sm" />
                  )}
                </>
              )}

              {renderWidget(msg)}

              <div
                className={`text-[9px] font-mono mt-1.5 ${
                  msg.sender === 'user' ? 'text-blue-100 text-right' : 'text-slate-400 dark:text-slate-500'
                }`}
              >
                {msg.timestamp}
              </div>
            </div>

            {msg.sender === 'user' && (
              <div className="w-8 h-8 rounded-xl bg-blue-600/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
            )}
          </div>
        ))}

        {/* Typing indicator */}
        {thinking && (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-8 h-8 rounded-xl bg-purple-600/10 border border-purple-500/30 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div className="bg-slate-50 dark:bg-[#161B2C] border border-slate-200 dark:border-[#232A3D] px-4 py-3 rounded-2xl rounded-bl-none flex items-center gap-2">
              <span className="flex gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.3s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce [animation-delay:-0.15s]" />
                <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-bounce" />
              </span>
              <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                Analyzing market & risk data…
              </span>
            </div>
          </div>
        )}

        {showRetry && (
          <div className="flex flex-wrap items-center gap-2 justify-start pl-10 sm:pl-11">
            {degraded && (
              <button
                type="button"
                onClick={() => {
                  setKeyError(null);
                  setShowKeyModal(true);
                }}
                className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold transition-all flex items-center gap-1.5"
              >
                <AlertTriangle className="w-3 h-3" /> Add API Key
              </button>
            )}
            <button
              onClick={handleRetry}
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-[#0F1420] border border-slate-300 dark:border-[#232A3D] text-slate-700 dark:text-slate-300 text-[11px] font-bold hover:border-slate-400 transition-all flex items-center gap-1.5"
            >
              <RotateCcw className="w-3 h-3" /> Retry
            </button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick-reply chips — each fires a real query */}
      <div className="flex items-center gap-2 overflow-x-auto py-0.5 custom-scrollbar">
        {PROMPT_SUGGESTIONS.map((suggestion) => (
          <button
            key={suggestion}
            onClick={() => handleSendMessage(suggestion)}
            disabled={thinking}
            className="text-[11px] bg-white dark:bg-[#0F1420] hover:bg-slate-50 dark:hover:bg-[#161B2C] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#232A3D] hover:border-slate-400 px-3 py-1.5 rounded-xl shrink-0 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {suggestion}
          </button>
        ))}
      </div>

      {/* Input bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage();
        }}
        className="flex gap-2"
      >
        <input
          ref={inputRef}
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          onKeyDown={(e) => {
            // Explicit Enter handling so submitting never depends on the browser's
            // implicit form submission (which is skipped when Send is disabled).
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSendMessage();
            }
          }}
          placeholder="Ask about a risk, or try “Invest $5,000 in NVDA”…"
          aria-label="Message Black Swan AI"
          className="flex-1 min-w-0 bg-white dark:bg-[#0F1420] border border-slate-200 dark:border-[#232A3D] rounded-xl px-4 py-3 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-purple-500 transition-colors"
        />
        <button
          type="submit"
          disabled={thinking || !inputQuery.trim()}
          aria-label="Send message"
          className="px-4 sm:px-5 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold text-xs shadow-lg shadow-purple-500/20 transition-all flex items-center justify-center shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
};
