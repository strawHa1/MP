/**
 * Local (no-Gemini) chat replies grounded in live platform data.
 *
 * When GEMINI_API_KEY is missing the assistant still answers analytical questions
 * from impact scores, portfolio risk, country risk, and headlines — so the chat
 * feels useful instead of showing a dead "offline" wall.
 */

import fs from 'fs';
import path from 'path';
import { getImpactState, type StockImpactRecord } from './impactService.js';
import { getLiveCountryRisk } from './marketDataService.js';
import { fetchHeadlines } from './newsApi.js';

interface PortfolioRow {
  ticker: string;
  companyName: string;
  shares: number;
  avgCost: number;
  allocationPct: number;
  riskScore: number;
  action: string;
}

export interface LiveChatContext {
  portfolio: PortfolioRow[];
  impacts: StockImpactRecord[];
  countries: { name: string; riskScore: number }[];
  headlines: { title: string; description?: string; sentiment?: string }[];
  generatedAt: string;
}

function loadPortfolio(): PortfolioRow[] {
  try {
    const file = path.join(process.cwd(), 'data', 'portfolio.json');
    return JSON.parse(fs.readFileSync(file, 'utf-8')) as PortfolioRow[];
  } catch {
    return [];
  }
}

/** Snapshot used both for local replies and as grounding for Gemini. */
export async function gatherLiveChatContext(): Promise<LiveChatContext> {
  const portfolio = loadPortfolio();
  const impactState = getImpactState();
  const [countryData, news] = await Promise.all([
    getLiveCountryRisk(false).catch(() => ({ countries: [] as { name: string; riskScore: number }[] })),
    fetchHeadlines('all', 12).catch(() => ({ articles: [] as any[] }))
  ]);

  const countries = [...(countryData.countries || [])]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 6);

  return {
    portfolio,
    impacts: impactState.impactedCompanies || [],
    countries,
    headlines: (news.articles || []).slice(0, 8).map((a: any) => ({
      title: a.title,
      description: a.description,
      sentiment: a.sentiment
    })),
    generatedAt: new Date().toISOString()
  };
}

/** Compact text block injected into the Gemini system prompt. */
export function formatContextForPrompt(ctx: LiveChatContext): string {
  const holdings = ctx.portfolio
    .slice()
    .sort((a, b) => b.riskScore - a.riskScore)
    .map(
      (h) =>
        `- ${h.ticker} (${h.companyName}): risk ${h.riskScore}/100, allocation ${h.allocationPct}%, action "${h.action}"`
    )
    .join('\n');

  const byTicker = new Map<string, StockImpactRecord>();
  for (const hit of ctx.impacts) {
    const prev = byTicker.get(hit.ticker);
    if (!prev || severityRank(hit.severity) > severityRank(prev.severity)) {
      byTicker.set(hit.ticker, hit);
    }
  }
  const impacts = [...byTicker.values()]
    .slice(0, 8)
    .map(
      (i) =>
        `- ${i.ticker}: ${i.severity} / ${i.sentiment} — "${i.headline}" (projected ${i.projectedImpactLabel})`
    )
    .join('\n');

  const countries = ctx.countries
    .map((c) => `- ${c.name}: ${c.riskScore}/100`)
    .join('\n');

  const headlines = ctx.headlines
    .slice(0, 5)
    .map((h) => `- ${h.title}`)
    .join('\n');

  return [
    'LIVE PLATFORM CONTEXT (prefer this over inventing figures):',
    `As of ${ctx.generatedAt}`,
    '',
    'Portfolio holdings:',
    holdings || '- (none loaded)',
    '',
    'Highest live news → stock impacts:',
    impacts || '- (no impact rows yet)',
    '',
    'Top country risk scores:',
    countries || '- (unavailable)',
    '',
    'Recent headlines:',
    headlines || '- (none)'
  ].join('\n');
}

function severityRank(s: string): number {
  switch (s) {
    case 'critical':
      return 4;
    case 'high':
      return 3;
    case 'medium':
      return 2;
    default:
      return 1;
  }
}

function detectTickers(message: string, ctx: LiveChatContext): string[] {
  const upper = message.toUpperCase();
  const known = new Set([
    ...ctx.portfolio.map((p) => p.ticker),
    ...ctx.impacts.map((i) => i.ticker),
    'NVDA',
    'TSM',
    'ASML',
    'AAPL',
    'XOM',
    'LMT',
    'AMD',
    'MSFT',
    'AMZN',
    'GOOGL',
    'CVX',
    'RTX',
    'BA',
    'JPM'
  ]);
  return [...known].filter((t) => new RegExp(`\\b${t}\\b`, 'i').test(upper));
}

function topRiskCompanies(ctx: LiveChatContext, limit = 5) {
  const impactBest = new Map<string, StockImpactRecord>();
  for (const hit of ctx.impacts) {
    const prev = impactBest.get(hit.ticker);
    if (!prev || severityRank(hit.severity) > severityRank(prev.severity)) {
      impactBest.set(hit.ticker, hit);
    }
  }

  const scores = new Map<
    string,
    { ticker: string; name: string; score: number; reason: string; action?: string }
  >();

  for (const h of ctx.portfolio) {
    scores.set(h.ticker, {
      ticker: h.ticker,
      name: h.companyName,
      score: h.riskScore,
      reason: `Portfolio risk score ${h.riskScore}/100 (${h.allocationPct}% allocation)`,
      action: h.action
    });
  }

  for (const [ticker, hit] of impactBest) {
    const bump =
      hit.severity === 'critical' ? 18 : hit.severity === 'high' ? 12 : hit.severity === 'medium' ? 6 : 2;
    const existing = scores.get(ticker);
    const base = existing?.score ?? 50;
    scores.set(ticker, {
      ticker,
      name: existing?.name || hit.companyName,
      score: Math.min(99, base + bump),
      reason: `Live ${hit.severity} impact: "${hit.headline}"`,
      action: existing?.action
    });
  }

  return [...scores.values()].sort((a, b) => b.score - a.score).slice(0, limit);
}

function replyHighRisk(ctx: LiveChatContext): string {
  const top = topRiskCompanies(ctx, 5);
  if (top.length === 0) {
    return (
      'I do not have enough live impact or portfolio data yet to rank companies.\n\n' +
      'Try again in a moment, or ask about a specific ticker such as **NVDA** or **TSM**.'
    );
  }

  const lines = top.map(
    (c, i) =>
      `${i + 1}. **${c.ticker}** (${c.name}) — risk **${c.score}/100**${
        c.action ? ` · suggested: *${c.action}*` : ''
      }\n   ${c.reason}`
  );

  const leader = top[0];
  return [
    `Right now **${leader.ticker}** looks like the highest-risk name on the platform.`,
    '',
    '### Highest-risk companies',
    ...lines,
    '',
    '### What you can do next',
    `- Ask for a deeper brief: *"Summarize risk drivers for ${leader.ticker}"*`,
    `- Set a watch: *"Alert me if ${leader.ticker} drops below $150"*`,
    `- Rebalance (confirmation required): *"Withdraw $2000 from ${leader.ticker}"*`,
    '',
    '_Answer grounded in live portfolio risk scores and news→stock impact data._'
  ].join('\n');
}

function replyTicker(ctx: LiveChatContext, tickers: string[]): string {
  const blocks = tickers.slice(0, 3).map((ticker) => {
    const holding = ctx.portfolio.find((p) => p.ticker === ticker);
    const hits = ctx.impacts.filter((i) => i.ticker === ticker).slice(0, 3);
    const parts: string[] = [`### ${ticker}${holding ? ` — ${holding.companyName}` : ''}`];

    if (holding) {
      parts.push(
        `- Portfolio risk: **${holding.riskScore}/100**`,
        `- Allocation: **${holding.allocationPct}%** (${holding.shares} shares @ ~$${holding.avgCost})`,
        `- Suggested stance: **${holding.action}**`
      );
    } else {
      parts.push('- Not currently in the mock portfolio — still tracked on the watchlist.');
    }

    if (hits.length) {
      parts.push('', '**Live impact headlines**');
      for (const h of hits) {
        parts.push(
          `- **${h.severity}** / ${h.sentiment}: ${h.headline} (${h.projectedImpactLabel})`
        );
      }
    } else {
      parts.push('', 'No high-severity live impact row for this ticker in the latest refresh.');
    }

    return parts.join('\n');
  });

  return [
    `Here is the live risk picture for **${tickers.slice(0, 3).join(', ')}**:`,
    '',
    ...blocks,
    '',
    'Trades always need an explicit confirm step — try `Invest $5,000 in ' +
      tickers[0] +
      '` if you want to act.'
  ].join('\n');
}

function replyTaiwan(ctx: LiveChatContext): string {
  const semi = ['TSM', 'NVDA', 'ASML', 'AMD', 'AAPL'];
  const related = topRiskCompanies(ctx, 10).filter((c) => semi.includes(c.ticker));
  const geo = ctx.countries.find((c) => /taiwan|china|east asia/i.test(c.name));
  const news = ctx.headlines.filter((h) =>
    /taiwan|strait|semiconductor|tsmc|chip|foundry/i.test(`${h.title} ${h.description || ''}`)
  );

  return [
    '### Taiwan Strait / semiconductor risk brief',
    geo
      ? `Country-risk model currently flags **${geo.name}** at **${geo.riskScore}/100**.`
      : 'Country-risk model has no Taiwan-specific row in this refresh — using semiconductor exposure instead.',
    '',
    '**Portfolio / watchlist names most exposed**',
    ...(related.length
      ? related.map((c) => `- **${c.ticker}**: ${c.score}/100 — ${c.reason}`)
      : ['- TSM, NVDA, ASML are the primary transmission channels on this platform.']),
    '',
    '**Relevant headlines**',
    ...(news.length
      ? news.slice(0, 4).map((h) => `- ${h.title}`)
      : ctx.headlines.slice(0, 3).map((h) => `- ${h.title}`)),
    '',
    'Practical next steps: review **TSM** allocation on Portfolio Risk, or ask *"What are the top 3 risks for ASML?"*.'
  ].join('\n');
}

function replyPortfolio(ctx: LiveChatContext): string {
  if (!ctx.portfolio.length) {
    return 'Portfolio data is not loaded yet. Open **Portfolio Risk** or try again shortly.';
  }

  const sorted = [...ctx.portfolio].sort((a, b) => b.riskScore - a.riskScore);
  const weighted = Math.round(
    sorted.reduce((s, h) => s + h.riskScore * h.allocationPct, 0) / 100
  );

  const rows = sorted
    .map(
      (h) =>
        `| ${h.ticker} | ${h.riskScore} | ${h.allocationPct}% | ${h.action} |`
    )
    .join('\n');

  return [
    `Your mock portfolio’s **weighted risk score is ${weighted}/100** across ${sorted.length} holdings.`,
    '',
    '| Ticker | Risk | Allocation | Stance |',
    '| --- | ---: | ---: | --- |',
    rows,
    '',
    `Highest concentration of concern: **${sorted[0].ticker}** (${sorted[0].riskScore}/100, ${sorted[0].action}).`,
    '',
    'Say `Invest $5,000 in NVDA` or `Withdraw $2,000 from TSM` to open a confirmation card — nothing executes without your OK.'
  ].join('\n');
}

function replyGeneral(ctx: LiveChatContext, message: string): string {
  const top = topRiskCompanies(ctx, 3);
  const countries = ctx.countries.slice(0, 3);
  const news = ctx.headlines.slice(0, 3);

  return [
    `I read your question as: *“${message.trim().slice(0, 140)}${message.trim().length > 140 ? '…' : ''}”*`,
    '',
    'Here is the current Black Swan live snapshot:',
    '',
    '**Highest-risk names**',
    ...(top.length
      ? top.map((c) => `- **${c.ticker}**: ${c.score}/100 — ${c.reason}`)
      : ['- Impact cache is still warming up.']),
    '',
    '**Elevated country risk**',
    ...(countries.length
      ? countries.map((c) => `- ${c.name}: ${c.riskScore}/100`)
      : ['- Country risk feed unavailable.']),
    '',
    '**Recent headlines**',
    ...(news.length ? news.map((h) => `- ${h.title}`) : ['- No headlines cached.']),
    '',
    'Ask a sharper follow-up (e.g. *"which company is at high risk right now"* or *"Summarize Taiwan Strait risk for NVDA & TSM"*) and I will go deeper.',
    '',
    'Trading & alerts work anytime: `Invest $5,000 in NVDA` · `Alert me if TSM drops below $150`.'
  ].join('\n');
}

/**
 * Produce a markdown reply from live platform data — used when Gemini is offline
 * or as a safety net if the model call fails.
 */
export async function buildLocalChatReply(message: string): Promise<string> {
  const ctx = await gatherLiveChatContext();
  const q = message.toLowerCase();
  const tickers = detectTickers(message, ctx);

  if (
    /high\s*risk|most\s*risk|riskiest|at\s*risk|which\s+compan|top\s*risk|elevated\s*risk/.test(q)
  ) {
    return replyHighRisk(ctx);
  }
  if (/taiwan|strait|tsmc|semiconductor|chip\s*war/.test(q)) {
    return replyTaiwan(ctx);
  }
  if (/portfolio|holdings|my\s+positions|allocation|diversif/.test(q)) {
    return replyPortfolio(ctx);
  }
  if (tickers.length > 0) {
    return replyTicker(ctx, tickers);
  }
  return replyGeneral(ctx, message);
}

/**
 * Yield a reply in small pieces so the SSE client can render a ChatGPT-style stream
 * even when the text was produced locally in one shot.
 */
export async function* streamTextChunks(
  text: string,
  chunkSize = 18
): AsyncGenerator<string> {
  for (let i = 0; i < text.length; i += chunkSize) {
    yield text.slice(i, i + chunkSize);
    // Tiny pause so the UI can paint between frames (non-blocking for Node).
    await new Promise((r) => setTimeout(r, 8));
  }
}
