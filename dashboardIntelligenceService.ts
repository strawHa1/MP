/**
 * Derives dashboard AI insights and recommended actions from live feeds + portfolio holdings.
 * Uses Gemini when configured; always grounded in real data via rule-based fallback.
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import { fetchHeadlines } from './newsApi.js';
import { getImpactState } from './impactService.js';
import { getLiveCountryRisk } from './marketDataService.js';

export interface PortfolioRow {
  id: string;
  ticker: string;
  companyName: string;
  shares: number;
  avgCost: number;
  allocationPct: number;
  riskScore: number;
  action: string;
}

export interface DashboardInsight {
  id: string;
  title: string;
  body: string;
  relatedTickers: string[];
  relatedEventTitle?: string;
}

export interface RecommendedActionItem {
  id: string;
  type: 'execute' | 'review';
  title: string;
  subtitle: string;
  ticker: string;
  rationale: string;
  targetAllocationPct?: number;
  currentAllocationPct?: number;
  relatedHeadline?: string;
  hedgeInstrument?: string;
}

export interface DashboardIntelligencePayload {
  insights: DashboardInsight[];
  actions: RecommendedActionItem[];
  source: 'gemini' | 'rules';
  generatedAt: string;
  portfolioTickers: string[];
  liveEventCount: number;
}

const SEMI_TICKERS = new Set(['TSM', 'NVDA', 'ASML', 'AMD', 'AAPL']);
const ENERGY_TICKERS = new Set(['XOM', 'CVX', 'BP']);
const DEFENSE_TICKERS = new Set(['LMT', 'RTX', 'BA']);

let cache: { payload: DashboardIntelligencePayload; at: number } | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

function getGenAI(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey, httpOptions: { headers: { 'User-Agent': 'aistudio-build' } } });
}

function loadPortfolio(): PortfolioRow[] {
  const file = path.join(process.cwd(), 'data', 'portfolio.json');
  return JSON.parse(fs.readFileSync(file, 'utf-8')) as PortfolioRow[];
}

function buildRuleBasedInsights(
  portfolio: PortfolioRow[],
  impacts: { ticker: string; headline: string; severity: string }[],
  headlines: { title: string; description: string; sentiment: string }[],
  topCountries: { name: string; riskScore: number }[]
): DashboardInsight[] {
  const insights: DashboardInsight[] = [];
  const seen = new Set<string>();

  const add = (insight: DashboardInsight) => {
    if (seen.has(insight.id)) return;
    seen.add(insight.id);
    insights.push(insight);
  };

  for (const holding of portfolio.filter((h) => h.riskScore >= 70)) {
    const impact = impacts.find((i) => i.ticker === holding.ticker);
    if (impact) {
      add({
        id: `impact-${holding.ticker}`,
        title: `${holding.ticker} Live News Exposure`,
        body: `${holding.companyName} (${holding.allocationPct}% of portfolio, risk ${holding.riskScore}/100) is linked to current headline: "${impact.headline}" (${impact.severity} severity).`,
        relatedTickers: [holding.ticker],
        relatedEventTitle: impact.headline
      });
    }
  }

  const semiHoldings = portfolio.filter((h) => SEMI_TICKERS.has(h.ticker));
  const semiPct = semiHoldings.reduce((s, h) => s + h.allocationPct, 0);
  const semiNews = headlines.find((h) =>
    /taiwan|semiconductor|chip|tsmc|strait|nvidia|supply chain/i.test(`${h.title} ${h.description}`)
  );
  if (semiPct >= 15 && semiNews) {
    add({
      id: 'semi-concentration',
      title: 'Semiconductor Concentration Risk',
      body: `${semiPct.toFixed(1)}% of portfolio is in chip-linked names (${semiHoldings.map((h) => h.ticker).join(', ')}). Live feed: "${semiNews.title}".`,
      relatedTickers: semiHoldings.map((h) => h.ticker),
      relatedEventTitle: semiNews.title
    });
  }

  const energyHoldings = portfolio.filter((h) => ENERGY_TICKERS.has(h.ticker));
  const energyPct = energyHoldings.reduce((s, h) => s + h.allocationPct, 0);
  const energyNews = headlines.find((h) =>
    /oil|energy|hormuz|opec|petrol|crude|pipeline/i.test(`${h.title} ${h.description}`)
  );
  if (energyPct >= 10 && energyNews) {
    add({
      id: 'energy-transit',
      title: 'Energy Transit & Commodity Risk',
      body: `${energyPct.toFixed(1)}% energy allocation (${energyHoldings.map((h) => h.ticker).join(', ')}) exposed to headline: "${energyNews.title}".`,
      relatedTickers: energyHoldings.map((h) => h.ticker),
      relatedEventTitle: energyNews.title
    });
  }

  const topRisk = topCountries[0];
  if (topRisk && topRisk.riskScore >= 55) {
    add({
      id: `geo-${topRisk.name.slice(0, 12)}`,
      title: `Elevated ${topRisk.name} Geopolitical Risk`,
      body: `Country risk model scores ${topRisk.name} at ${topRisk.riskScore}/100 based on current headline corpus — review correlated portfolio names.`,
      relatedTickers: portfolio.filter((h) => h.riskScore >= 65).map((h) => h.ticker)
    });
  }

  if (insights.length === 0) {
    const avgRisk = Math.round(
      portfolio.reduce((s, h) => s + h.riskScore * h.allocationPct, 0) / 100
    );
    add({
      id: 'baseline',
      title: 'Portfolio Risk Baseline',
      body: `Composite weighted risk score is ${avgRisk}/100 across ${portfolio.length} holdings. No acute live headline match in the last refresh — monitoring continues.`,
      relatedTickers: portfolio.map((h) => h.ticker)
    });
  }

  return insights.slice(0, 4);
}

function buildRecommendedActions(
  portfolio: PortfolioRow[],
  impacts: { ticker: string; headline: string }[],
  headlines: { title: string; description: string }[]
): RecommendedActionItem[] {
  const actions: RecommendedActionItem[] = [];

  for (const holding of portfolio) {
    if (holding.action === 'Hedge / Reduce') {
      const impact = impacts.find((i) => i.ticker === holding.ticker);
      actions.push({
        id: `hedge-${holding.ticker}`,
        type: 'execute',
        title: `Hedge ${holding.ticker} Exposure`,
        subtitle: `Buy out-of-the-money 60-day put options`,
        ticker: holding.ticker,
        currentAllocationPct: holding.allocationPct,
        rationale: `${holding.companyName} carries risk score ${holding.riskScore}/100 at ${holding.allocationPct}% allocation.${impact ? ` Live driver: "${impact.headline}".` : ''} A protective put hedge limits downside while maintaining upside.`,
        relatedHeadline: impact?.headline,
        hedgeInstrument: `${holding.ticker} 60-day OTM put (~5% out-of-the-money)`
      });
    }
  }

  const defense = portfolio.find((h) => DEFENSE_TICKERS.has(h.ticker));
  const geoHeadlines = headlines.filter((h) =>
    /defense|military|conflict|war|sanction|strait|missile|nato/i.test(`${h.title} ${h.description}`)
  );
  if (defense && geoHeadlines.length >= 1 && defense.allocationPct < 18) {
    actions.push({
      id: `rebalance-${defense.ticker}`,
      type: 'review',
      title: 'Rebalance into Defense',
      subtitle: `Increase ${defense.ticker} allocation toward 18%`,
      ticker: defense.ticker,
      currentAllocationPct: defense.allocationPct,
      targetAllocationPct: 18,
      rationale: `${geoHeadlines.length} geopolitical headline(s) active including "${geoHeadlines[0].title}". ${defense.companyName} (${defense.riskScore}/100 risk) offers defensive ballast vs semiconductor/energy concentration.`,
      relatedHeadline: geoHeadlines[0].title
    });
  }

  for (const holding of portfolio.filter((h) => h.action === 'Review' && h.riskScore >= 70)) {
    if (actions.some((a) => a.ticker === holding.ticker)) continue;
    actions.push({
      id: `review-${holding.ticker}`,
      type: 'review',
      title: `Review ${holding.ticker} Position`,
      subtitle: `${holding.allocationPct}% allocation flagged for review`,
      ticker: holding.ticker,
      currentAllocationPct: holding.allocationPct,
      rationale: `${holding.companyName} risk score ${holding.riskScore}/100 exceeds comfort band. Review sizing and correlation with live event exposure.`,
      relatedHeadline: impacts.find((i) => i.ticker === holding.ticker)?.headline
    });
  }

  return actions.slice(0, 4);
}

async function enhanceWithGemini(
  base: DashboardIntelligencePayload,
  portfolio: PortfolioRow[],
  headlines: { title: string; description: string }[]
): Promise<DashboardIntelligencePayload | null> {
  const ai = getGenAI();
  if (!ai) return null;

  try {
    const prompt = `You are a portfolio risk analyst. Given REAL portfolio and live headline data below, rewrite insights and actions as concise JSON. Do NOT invent tickers or events not in the input.

Portfolio: ${JSON.stringify(portfolio.map((p) => ({ ticker: p.ticker, allocationPct: p.allocationPct, riskScore: p.riskScore, action: p.action })))}

Live headlines (sample): ${JSON.stringify(headlines.slice(0, 8).map((h) => h.title))}

Current rule-based insights: ${JSON.stringify(base.insights)}
Current rule-based actions: ${JSON.stringify(base.actions)}

Return JSON:
{
  "insights": [{ "id": string, "title": string, "body": string, "relatedTickers": string[] }],
  "actions": [{ "id": string, "type": "execute"|"review", "title": string, "subtitle": string, "ticker": string, "rationale": string, "targetAllocationPct": number|null, "currentAllocationPct": number|null, "relatedHeadline": string|null, "hedgeInstrument": string|null }]
}
Keep the same tickers and factual basis. Max 4 insights, max 4 actions.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0.25 }
    });

    const parsed = JSON.parse(response.text || '{}');
    if (!Array.isArray(parsed.insights) || !Array.isArray(parsed.actions)) return null;

    return {
      ...base,
      insights: parsed.insights.slice(0, 4),
      actions: parsed.actions.slice(0, 4),
      source: 'gemini'
    };
  } catch (e) {
    console.warn('[Dashboard] Gemini intelligence enhancement failed:', e);
    return null;
  }
}

export async function getDashboardIntelligence(force = false): Promise<DashboardIntelligencePayload> {
  if (!force && cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.payload;
  }

  const portfolio = loadPortfolio();
  const [{ articles }, countryData, impactState] = await Promise.all([
    fetchHeadlines('all', 25),
    getLiveCountryRisk(false),
    Promise.resolve(getImpactState())
  ]);

  const impacts = impactState.impactedCompanies || [];
  const topCountries = [...(countryData.countries || [])].sort((a, b) => b.riskScore - a.riskScore).slice(0, 3);

  const base: DashboardIntelligencePayload = {
    insights: buildRuleBasedInsights(portfolio, impacts, articles, topCountries),
    actions: buildRecommendedActions(portfolio, impacts, articles),
    source: 'rules',
    generatedAt: new Date().toISOString(),
    portfolioTickers: portfolio.map((p) => p.ticker),
    liveEventCount: articles.length
  };

  const enhanced = await enhanceWithGemini(base, portfolio, articles);
  const payload = enhanced ?? base;

  cache = { payload, at: Date.now() };
  return payload;
}
