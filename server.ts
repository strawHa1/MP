import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { fetchHeadlines, fetchCompanyNews } from './newsApi.js';
import {
  getImpactState,
  refreshImpactData,
  manualRefreshImpact,
  initImpactService,
  startImpactCron,
  startImpactPricePolling
} from './impactService.js';
import {
  getWatchlist,
  searchWatchlist,
  getCompanyProfile,
  getSectorsConfig,
  getSectorLiveData,
  getLiveCountryRisk,
  fetchQuote,
  fetchQuotesBatch
} from './marketDataService.js';
import { searchMarketSymbols, refreshSearchQuotes, initSearchUniverse } from './searchService.js';
import {
  getTrendHistory,
  backfillTrendFromHeadlines,
  initDashboardTrendService,
  startDashboardTrendCron
} from './dashboardTrendService.js';
import { getDashboardIntelligence } from './dashboardIntelligenceService.js';
import { getGeminiApiKey, logGeminiKeyStatus } from './envConfig.js';
import {
  buildLocalChatReply,
  formatContextForPrompt,
  gatherLiveChatContext,
  streamTextChunks
} from './localChatService.js';

// Loaded before any request handler runs; every module reads process.env lazily
// inside functions, so this single call covers the whole server. Both paths are
// listed so `node dist/server.cjs` resolves env the same way `tsx` does in dev.
dotenv.config({ path: ['.env.local', '.env'] });

const app = express();
const PORT = 3002;
const ENV_FILE_PATH = path.join(process.cwd(), '.env');

app.use(express.json());

// Initialize Gemini AI Client
const getGenAI = () => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build'
      }
    }
  });
};

// Base market prices baseline for realistic stock data
const STOCK_BASELINES: Record<string, { name: string; price: number; prevClose: number }> = {
  NVDA: { name: 'NVIDIA Corporation', price: 124.50, prevClose: 121.20 },
  AAPL: { name: 'Apple Inc.', price: 224.30, prevClose: 225.10 },
  TSM: { name: 'Taiwan Semiconductor Mfg.', price: 172.80, prevClose: 176.40 },
  MSFT: { name: 'Microsoft Corporation', price: 442.10, prevClose: 440.50 },
  AMZN: { name: 'Amazon.com Inc.', price: 186.20, prevClose: 184.90 },
  GOOGL: { name: 'Alphabet Inc.', price: 179.40, prevClose: 180.10 },
  XOM: { name: 'Exxon Mobil Corporation', price: 118.70, prevClose: 115.30 },
  LMT: { name: 'Lockheed Martin Corp.', price: 478.20, prevClose: 472.00 },
  JPM: { name: 'JPMorgan Chase & Co.', price: 208.50, prevClose: 207.10 },
  ASML: { name: 'ASML Holding N.V.', price: 845.00, prevClose: 860.20 },
  AMD: { name: 'Advanced Micro Devices', price: 154.20, prevClose: 151.80 },
  CVX: { name: 'Chevron Corporation', price: 158.40, prevClose: 156.10 },
  BA: { name: 'Boeing Company', price: 178.60, prevClose: 181.20 },
  RTX: { name: 'RTX Corporation', price: 102.30, prevClose: 101.50 },
  MA: { name: 'Mastercard Inc.', price: 452.80, prevClose: 450.10 }
};

// Helper: Check US market open status (9:30 AM - 4:00 PM ET on weekdays)
function isUSMarketOpen(): boolean {
  const now = new Date();
  const utcDay = now.getUTCDay();
  if (utcDay === 0 || utcDay === 6) return false; // Weekend

  // Convert to Eastern Time approximately (UTC - 4 or UTC - 5)
  const utcHour = now.getUTCHours();
  const utcMin = now.getUTCMinutes();
  const totalUtcMins = utcHour * 60 + utcMin;
  
  // 13:30 UTC to 20:00 UTC corresponds roughly to 9:30 AM - 4:00 PM ET
  return totalUtcMins >= 13 * 60 + 30 && totalUtcMins <= 20 * 60;
}

// Format current time with timezone tag
function getFormattedTimestamp(): string {
  const now = new Date();
  return now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  }) + ' UTC';
}

/**
 * Real-time Stock Quote Endpoint
 * Tries Finnhub API first if API key is provided, or returns realistic live-ticking price quotes
 */
app.get('/api/stocks/quote', async (req, res) => {
  try {
    const symbol = ((req.query.symbol as string) || 'NVDA').toUpperCase().trim();
    const quote = await fetchQuote(symbol);
    if (!quote) {
      return res.status(404).json({ error: 'Quote not available for symbol' });
    }
    res.set('Cache-Control', 'no-store');
    res.json(quote);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Quote fetch failed' });
  }
});

/**
 * Batch Stock Quotes Endpoint (cached, parallel Finnhub)
 */
app.get('/api/stocks/quotes', async (req, res) => {
  try {
    const symbolsRaw = (req.query.symbols as string) || 'NVDA,AAPL,TSM,XOM,LMT';
    const symbols = symbolsRaw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
    const results = await fetchQuotesBatch(symbols);
    res.json(results);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Batch quote fetch failed' });
  }
});

/** Universal live symbol search (Finnhub) */
app.get('/api/search', async (req, res) => {
  try {
    const q = (req.query.q as string) || '';
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10) || 1);
    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10) || 20, 50);
    const data = await searchMarketSymbols(q, page, limit);
    if (data.error) {
      return res.status(503).json(data);
    }
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Search failed', results: [], total: 0, hasMore: false });
  }
});

/** Live quote refresh for search dropdown (never long-cached) */
app.get('/api/search/quotes', async (req, res) => {
  try {
    const raw = (req.query.symbols as string) || '';
    const symbols = raw.split(',').map((s) => s.trim()).filter(Boolean);
    if (symbols.length === 0) return res.json({});
    const quotes = await refreshSearchQuotes(symbols);
    res.set('Cache-Control', 'no-store');
    res.json(quotes);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Quote refresh failed' });
  }
});

/** Curated watchlist search */
app.get('/api/watchlist', (req, res) => {
  const q = (req.query.q as string) || '';
  const limit = Math.min(parseInt((req.query.limit as string) || '20', 10) || 20, 50);
  res.json({ entries: q ? searchWatchlist(q, limit) : getWatchlist(), count: getWatchlist().length });
});

/** Full company profile + live quote + risk score */
app.get('/api/companies/:ticker', async (req, res) => {
  try {
    const profile = await getCompanyProfile(req.params.ticker);
    if (!profile) {
      return res.status(404).json({ error: 'Company not found', inWatchlist: false });
    }
    res.json(profile);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to load company' });
  }
});

/** All sectors config */
app.get('/api/sectors', (_req, res) => {
  res.json({ sectors: getSectorsConfig() });
});

/** Live sector data with constituent quotes */
app.get('/api/sectors/:id', async (req, res) => {
  try {
    const data = await getSectorLiveData(req.params.id);
    if (!data) return res.status(404).json({ error: 'Sector not found' });
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to load sector' });
  }
});

/** Global risk score 30-day trend (daily snapshots + headline backfill) */
app.get('/api/dashboard/trend', async (req, res) => {
  try {
    const force = req.query.refresh === 'true';
    if (force) await backfillTrendFromHeadlines();
    const trend = getTrendHistory(30);
    res.set('Cache-Control', 'no-store');
    res.json({ ...trend, lastUpdated: new Date().toISOString() });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Failed to load trend' });
  }
});

/** AI insights + recommended actions from live data + portfolio */
app.get('/api/dashboard/intelligence', async (req, res) => {
  try {
    const force = req.query.refresh === 'true';
    const data = await getDashboardIntelligence(force);
    res.set('Cache-Control', 'no-store');
    res.json(data);
  } catch (e: any) {
    console.error('Dashboard intelligence error:', e);
    res.status(500).json({ error: e?.message || 'Failed to load dashboard intelligence' });
  }
});

/** Live country risk scores from news headlines + impact pipeline */
app.get('/api/countries/risk', async (req, res) => {
  try {
    const force = req.query.refresh === 'true';
    const data = await getLiveCountryRisk(force);
    res.set('Cache-Control', 'no-store');
    res.json(data);
  } catch (e: any) {
    console.error('Country risk error:', e);
    res.status(500).json({ error: e?.message || 'Failed to load country risk' });
  }
});

/**
 * AI Report Generation Endpoint
 */
app.post('/api/reports/generate', async (req, res) => {
  const { topic, focusArea } = req.body;
  const ai = getGenAI();

  if (!ai) {
    return res.json({
      id: `rep-${Date.now()}`,
      title: `${topic || 'Global Market Risk'} Intelligence Brief`,
      summary: `Automated intelligence evaluation covering ${focusArea || 'geopolitical and trade risks'}.`,
      severityTag: 'high',
      createdAt: new Date().toISOString().split('T')[0],
      author: 'Black Swan AI Desk',
      tags: ['Geopolitics', 'Markets', 'Supply Chain'],
      sections: [
        { heading: 'Executive Brief', body: 'Heightened volatility across global asset classes requires defensive capital positioning.' },
        { heading: 'Transmission Channels', body: 'Trade friction and logistics bottlenecks remain primary vectors for corporate margin compression.' }
      ]
    });
  }

  try {
    const prompt = `Generate a high-level financial risk intelligence report on the topic: "${topic || 'Geopolitical Freight & Tech Risk'}". Focus area: "${focusArea || 'Global Supply Chains'}".
Return JSON with this schema:
{
  "title": string,
  "summary": string,
  "severityTag": "critical" | "high" | "medium" | "low",
  "tags": [string],
  "sections": [
    { "heading": "Executive Brief", "body": "paragraph text" },
    { "heading": "Key Risk Drivers", "body": "paragraph text" },
    { "heading": "Market & Sector Exposure", "body": "paragraph text" },
    { "heading": "Recommended Risk Mitigation", "body": "paragraph text" }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.3
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return res.json({
      id: `rep-${Date.now()}`,
      title: parsed.title || `${topic} Intelligence Brief`,
      summary: parsed.summary || 'AI generated market risk brief.',
      severityTag: parsed.severityTag || 'high',
      createdAt: new Date().toISOString().split('T')[0],
      author: 'Black Swan AI Intelligence Engine',
      tags: parsed.tags || ['Risk Analysis'],
      sections: parsed.sections || []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

const CHAT_SYSTEM_PROMPT = `You are Black Swan AI, an elite quantitative financial risk intelligence assistant on the Black Swan platform.
Your role is to analyze geopolitical events, market sentiment, stock risk scores (e.g., NVDA, TSM, XOM, LMT), portfolio hedging strategies, and supply chain bottlenecks.

The platform can also execute these actions for the user, so mention them when relevant:
- Invest or withdraw a dollar amount from a stock (always requires explicit user confirmation).
- Create price alerts (e.g. "Alert me if TSM drops below $150") and risk-index alerts.

Format responses in Markdown. Use bold for key figures, bullet points for lists, and tables when comparing multiple tickers.
Keep responses clear, professional, direct, and analytical. Never invent live prices — describe drivers and ranges instead.`;

/**
 * Translates the client's ChatMessage[] history into the Gemini `contents` shape.
 *
 * The client sends { sender, text }; the SDK expects { role, parts }. Gemini also
 * requires the history to open on a user turn, so the seeded assistant greeting is
 * dropped and only the most recent turns are forwarded.
 */
function buildChatHistory(history: unknown) {
  const mapped = (Array.isArray(history) ? history : [])
    .filter((h: any) => typeof h?.text === 'string' && h.text.trim().length > 0)
    .slice(-20)
    .map((h: any) => ({
      role: h.sender === 'user' ? 'user' : 'model',
      parts: [{ text: String(h.text) }]
    }));

  while (mapped.length > 0 && mapped[0].role !== 'user') {
    mapped.shift();
  }
  return mapped;
}

async function createChatSession(ai: GoogleGenAI, history: unknown) {
  // Ground the model in the same live snapshot the local fallback uses so answers
  // stay consistent whether Gemini is on or off.
  let liveBlock = '';
  try {
    liveBlock = '\n\n' + formatContextForPrompt(await gatherLiveChatContext());
  } catch (e: any) {
    console.warn('[AI] Live context gather failed:', e?.message || e);
  }

  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: CHAT_SYSTEM_PROMPT + liveBlock,
      temperature: 0.4
    },
    history: buildChatHistory(history)
  });
}

/** Stream a locally built reply word-by-word so the UI still feels ChatGPT-like. */
async function streamLocalReply(
  message: string,
  send: (payload: Record<string, unknown>) => void,
  aborted: () => boolean
) {
  const reply = await buildLocalChatReply(message);
  for await (const delta of streamTextChunks(reply)) {
    if (aborted()) return;
    send({ delta, source: 'local' });
  }
  if (!aborted()) send({ done: true, source: 'local' });
}

/**
 * Streaming chat endpoint (Server-Sent Events).
 *
 * Primary path: Gemini token stream when a key is set.
 * Fallback: live-data local reply streamed in small chunks (same SSE shape) so the
 * assistant still answers risk questions without a key.
 */
app.post('/api/chat/stream', async (req, res) => {
  const { message, history } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message required' });
  }

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Disables proxy buffering so chunks reach the browser immediately.
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (payload: Record<string, unknown>) => {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };

  let aborted = false;
  // Use the response socket — `req` "close" fires as soon as the POST body is
  // fully read, which would abort the stream before the first token is written.
  res.on('close', () => {
    aborted = true;
  });

  const ai = getGenAI();
  if (!ai) {
    try {
      await streamLocalReply(message, send, () => aborted);
    } catch (e: any) {
      console.error('[AI] Local chat stream error:', e?.message || e);
      if (!aborted) {
        send({ error: 'AI Assistant is temporarily unavailable. Please try again.' });
        send({ done: true });
      }
    }
    return res.end();
  }

  try {
    const chat = await createChatSession(ai, history);
    const stream = await chat.sendMessageStream({ message });

    let streamed = '';
    for await (const chunk of stream) {
      if (aborted) break;
      const delta = chunk.text;
      if (delta) {
        streamed += delta;
        send({ delta, source: 'gemini' });
      }
    }

    if (!aborted) {
      if (!streamed.trim()) {
        // Empty model output → fall back to live-data answer instead of failing hard.
        await streamLocalReply(message, send, () => aborted);
      } else {
        send({ done: true, source: 'gemini' });
      }
    }
    res.end();
  } catch (e: any) {
    console.error('[AI] Chat stream error:', e?.message || e);
    if (!aborted) {
      try {
        await streamLocalReply(message, send, () => aborted);
      } catch {
        send({ error: 'AI Assistant is temporarily unavailable. Please try again.' });
        send({ done: true });
      }
    }
    res.end();
  }
});

/**
 * Non-streaming chat endpoint. Kept as the client's fallback for environments
 * where the SSE body cannot be read incrementally.
 */
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message required' });
  }

  const ai = getGenAI();
  if (!ai) {
    try {
      const reply = await buildLocalChatReply(message);
      return res.json({ reply, degraded: false, source: 'local' });
    } catch (e: any) {
      console.error('[AI] Local chat error:', e?.message || e);
      return res.status(502).json({ error: 'AI Assistant is temporarily unavailable. Please try again.' });
    }
  }

  try {
    const chat = await createChatSession(ai, history);
    const response = await chat.sendMessage({ message });
    const reply = (response.text || '').trim();
    if (!reply) {
      const local = await buildLocalChatReply(message);
      return res.json({ reply: local, degraded: false, source: 'local' });
    }

    return res.json({ reply, degraded: false, source: 'gemini' });
  } catch (e: any) {
    console.error('[AI] Chat error:', e?.message || e);
    try {
      const local = await buildLocalChatReply(message);
      return res.json({ reply: local, degraded: false, source: 'local' });
    } catch {
      return res.status(502).json({ error: 'AI Assistant is temporarily unavailable. Please try again.' });
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/**
 * Live News Headlines — India & World
 * Uses GNews / NewsAPI / Finnhub when keys are set, otherwise RSS feeds.
 */
app.get('/api/news/headlines', async (req, res) => {
  try {
    const region = ((req.query.region as string) || 'all').toLowerCase() as 'india' | 'world' | 'all';
    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10) || 20, 50);
    const validRegion = ['india', 'world', 'all'].includes(region) ? region : 'all';
    const { articles, source } = await fetchHeadlines(validRegion, limit);
    res.json({
      articles,
      source,
      region: validRegion,
      lastUpdated: new Date().toISOString(),
      count: articles.length
    });
  } catch (e: any) {
    console.error('News headlines error:', e);
    res.status(500).json({ error: 'Failed to fetch news headlines' });
  }
});

/**
 * Company-specific live news
 */
app.get('/api/news/company', async (req, res) => {
  try {
    const symbol = ((req.query.symbol as string) || 'NVDA').toUpperCase().trim();
    const limit = Math.min(parseInt((req.query.limit as string) || '10', 10) || 10, 25);
    const { articles, source } = await fetchCompanyNews(symbol, limit);
    res.json({
      articles,
      source,
      symbol,
      lastUpdated: new Date().toISOString(),
      count: articles.length
    });
  } catch (e: any) {
    console.error('Company news error:', e);
    res.status(500).json({ error: 'Failed to fetch company news' });
  }
});

/**
 * Stock Impact — news-to-price correlation pipeline
 */
app.get('/api/impact', (req, res) => {
  res.json(getImpactState());
});

app.post('/api/impact/refresh', async (req, res) => {
  try {
    const result = await manualRefreshImpact();
    if (!result.ok) {
      return res.status(429).json({ error: result.message, ...result.state });
    }
    res.json(result.state);
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Refresh failed' });
  }
});

// Setup Vite or Static File Serving
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Black Swan Server running on http://localhost:${PORT}`);
    logGeminiKeyStatus(ENV_FILE_PATH);
    initImpactService();
    startImpactCron();
    startImpactPricePolling(30_000);
    initSearchUniverse();
    initDashboardTrendService();
    startDashboardTrendCron();
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(
        `\nError: Port ${PORT} is already in use.\n` +
        `Stop the other server (Task Manager / kill node) or run: $env:PORT=3003; npm run dev\n`
      );
      process.exit(1);
    }
    throw err;
  });
}

startServer();
