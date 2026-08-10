/**
 * Live platform context for the Gemini system prompt.
 *
 * This module intentionally does NOT generate chat replies. Keyword-matched /
 * canned answers (especially the old "high risk snapshot" default) caused every
 * unrelated question to look the same. Replies now come only from Gemini.
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

/** Snapshot injected into the Gemini system prompt as optional context. */
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

/**
 * Compact text block for the system prompt. The model is instructed to use this
 * ONLY when the user actually asks about live/platform data.
 */
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

  const countries = ctx.countries.map((c) => `- ${c.name}: ${c.riskScore}/100`).join('\n');
  const headlines = ctx.headlines
    .slice(0, 5)
    .map((h) => `- ${h.title}`)
    .join('\n');

  return [
    'OPTIONAL LIVE PLATFORM CONTEXT (use ONLY when the user question is about Black Swan live data, portfolio, risk scores, headlines, or tickers on this platform — never paste this block into unrelated answers):',
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
    headlines || '- (none)',
    '',
    'Platform features the user can open: Dashboard, Global Events, Company Explorer, Sector Explorer, World Risk Map, AI Reports, Portfolio Risk, Alerts Center, AI Assistant (chat). Trading commands like "Invest $5,000 in NVDA" and alerts like "Alert me if TSM drops below $150" are handled by the UI with an explicit confirmation step.'
  ].join('\n');
}
