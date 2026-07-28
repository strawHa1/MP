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
  getLiveCountryRiskCached,
  fetchQuote,
  fetchQuotesBatch
} from './marketDataService.js';
import { searchMarketSymbols, refreshSearchQuotes } from './searchService.js';

dotenv.config();

const app = express();
const PORT = 3002;

app.use(express.json());

// Initialize Gemini AI Client
const getGenAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
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

/** Live country risk scores from news/impact pipeline */
app.get('/api/countries/risk', (req, res) => {
  const force = req.query.refresh === 'true';
  res.json(getLiveCountryRiskCached(force));
});

/**
 * AI Risk Scenario Simulation Endpoint (Google GenAI)
 */
app.post('/api/simulations/run', async (req, res) => {
  const { scenario } = req.body;
  if (!scenario) {
    return res.status(400).json({ error: 'Scenario description is required' });
  }

  const ai = getGenAI();
  if (!ai) {
    // Fallback response if GEMINI_API_KEY is missing
    return res.json({
      id: `sim-${Date.now()}`,
      scenarioText: scenario,
      marketImpactPct: -4.8,
      affectedCompaniesCount: 42,
      recoveryTimeRange: '45 - 90 Days',
      probabilityPct: 68,
      aiSummary: `Simulation analysis for "${scenario}": High probability of supply chain friction resulting in immediate margin compression for regional hardware manufacturers and transportation choke points.`,
      affectedTickers: [
        { ticker: 'TSM', name: 'TSMC', impactPct: -8.4, riskLevel: 'Critical' },
        { ticker: 'NVDA', name: 'NVIDIA', impactPct: -6.2, riskLevel: 'High' },
        { ticker: 'AAPL', name: 'Apple', impactPct: -3.5, riskLevel: 'Medium' },
        { ticker: 'XOM', name: 'Exxon Mobil', impactPct: 4.1, riskLevel: 'Positive' }
      ],
      supplyChainRisks: [
        'Maritime insurance freight premiums spike +140%',
        'Air cargo volume re-routed via secondary hubs',
        '30-day inventory buffers depleted across Tier-1 suppliers'
      ],
      marketImpactTimeline: [
        { day: 'Day 1', S_AND_P: -1.2, TechSector: -2.8, EnergySector: 1.5 },
        { day: 'Day 7', S_AND_P: -3.4, TechSector: -5.8, EnergySector: 3.2 },
        { day: 'Day 30', S_AND_P: -4.8, TechSector: -8.2, EnergySector: 5.1 },
        { day: 'Day 60', S_AND_P: -2.1, TechSector: -4.1, EnergySector: 2.8 },
        { day: 'Day 90', S_AND_P: -0.5, TechSector: -1.2, EnergySector: 1.0 }
      ]
    });
  }

  try {
    const prompt = `You are Black Swan, a world-class financial risk intelligence AI engine.
Analyze the following macroeconomic or geopolitical risk scenario and return structured risk impact quantitative metrics:
Scenario: "${scenario}"

Respond ONLY with valid JSON adhering to this exact schema:
{
  "marketImpactPct": number (e.g. -5.2 for negative impact or 2.1 for positive),
  "affectedCompaniesCount": number (integer, e.g. 38),
  "recoveryTimeRange": string (e.g. "30 - 60 Days"),
  "probabilityPct": number (integer between 1 and 100),
  "aiSummary": string (2-3 concise sentences explaining the financial mechanisms, supply chain risks, and market transmission channels),
  "affectedTickers": [
    { "ticker": "TSM", "name": "Taiwan Semiconductor", "impactPct": -8.5, "riskLevel": "Critical" },
    { "ticker": "NVDA", "name": "NVIDIA", "impactPct": -6.2, "riskLevel": "High" },
    { "ticker": "XOM", "name": "Exxon Mobil", "impactPct": 3.4, "riskLevel": "Low" }
  ],
  "supplyChainRisks": [
    "string risk point 1",
    "string risk point 2",
    "string risk point 3"
  ],
  "marketImpactTimeline": [
    { "day": "Day 1", "S_AND_P": -1.5, "TechSector": -3.2, "EnergySector": 1.2 },
    { "day": "Day 7", "S_AND_P": -3.8, "TechSector: -6.5, "EnergySector": 2.8 },
    { "day": "Day 30", "S_AND_P": -5.2, "TechSector": -8.9, "EnergySector": 4.1 },
    { "day": "Day 60", "S_AND_P": -2.8, "TechSector": -4.5, "EnergySector": 2.0 },
    { "day": "Day 90", "S_AND_P": -0.8, "TechSector": -1.5, "EnergySector": 0.8 }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });

    const jsonText = response.text || '';
    const parsed = JSON.parse(jsonText);

    return res.json({
      id: `sim-${Date.now()}`,
      scenarioText: scenario,
      marketImpactPct: parsed.marketImpactPct ?? -4.5,
      affectedCompaniesCount: parsed.affectedCompaniesCount ?? 35,
      recoveryTimeRange: parsed.recoveryTimeRange ?? '60 - 90 Days',
      probabilityPct: parsed.probabilityPct ?? 72,
      aiSummary: parsed.aiSummary ?? 'High systemic impact expected across global markets.',
      affectedTickers: parsed.affectedTickers ?? [],
      supplyChainRisks: parsed.supplyChainRisks ?? [],
      marketImpactTimeline: parsed.marketImpactTimeline ?? []
    });
  } catch (error: any) {
    console.error('Gemini simulation error:', error);
    return res.status(500).json({ error: 'Failed to run AI simulation' });
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

/**
 * AI Financial Assistant Chat Endpoint
 */
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const ai = getGenAI();
  if (!ai) {
    return res.json({
      reply: `I am Black Swan AI, your financial risk intelligence assistant. Regarding "${message}", global market metrics indicate elevated tail-risk in East Asian tech supply chains and Middle Eastern maritime energy corridors. How can I assist you with specific ticker or portfolio analysis?`,
      widget: null
    });
  }

  try {
    const systemPrompt = `You are Black Swan AI, a elite quantitative financial risk intelligence assistant on the Black Swan platform.
Your role is to analyze geopolitical events, market sentiment, stock risk scores (e.g., NVDA, TSM, XOM, LMT), portfolio hedging strategies, and supply chain bottlenecks.
Keep responses clear, professional, direct, analytical, and structured with concise bullet points where appropriate.`;

    const chatHistory = (history || []).map((h: any) => ({
      role: h.role === 'user' ? 'user' : 'model',
      parts: [{ text: h.content }]
    }));

    const chat = ai.chats.create({
      model: 'gemini-3.6-flash',
      config: {
        systemInstruction: systemPrompt,
        temperature: 0.4
      },
      history: chatHistory
    });

    const response = await chat.sendMessage({ message });
    return res.json({
      reply: response.text,
      widget: null
    });
  } catch (e: any) {
    console.error('Chat error:', e);
    return res.status(500).json({ error: 'AI Assistant error' });
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
    initImpactService();
    startImpactCron();
    startImpactPricePolling(30_000);
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
