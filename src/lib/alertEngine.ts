/**
 * Pure alert construction / upsert — no I/O, so the same rules run on the server
 * and in unit tests. Alerts are only created from real pipeline records.
 */

import { AlertItem, RiskSeverity, StockImpactRecord } from '../types';
import {
  classifyEventSeverity,
  impactScoreFromSeverity,
  isBlackSwanEvent,
  severityFromScore
} from './dashboardMetrics';

export const MAX_STORED_ALERTS = 80;

export interface StoredAlert {
  id: string;
  title: string;
  severity: RiskSeverity;
  message: string;
  createdAt: string;
  category: string;
  relatedEntitySymbol?: string;
  targetType?: AlertItem['targetType'];
  targetId?: string;
  source: NonNullable<AlertItem['source']>;
}

export function upsertAlerts(existing: StoredAlert[], incoming: StoredAlert[]): StoredAlert[] {
  const byId = new Map<string, StoredAlert>();
  for (const row of existing) {
    if (row?.id) byId.set(row.id, row);
  }
  for (const next of incoming) {
    if (!next?.id) continue;
    const prev = byId.get(next.id);
    if (prev) {
      byId.set(next.id, {
        ...prev,
        ...next,
        createdAt: prev.createdAt
      });
    } else {
      byId.set(next.id, next);
    }
  }
  return [...byId.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, MAX_STORED_ALERTS);
}

export function alertFromImpact(record: {
  id: string;
  ticker: string;
  headline: string;
  description?: string;
  severity: RiskSeverity;
  publishedAt?: string;
  sector?: string;
  projectedImpactLabel?: string;
}): StoredAlert | null {
  if (record.severity !== 'critical' && record.severity !== 'high') return null;
  const createdAt = validIso(record.publishedAt) || new Date().toISOString();
  const headline = (record.headline || '').trim();
  if (!headline) return null;
  return {
    id: `impact:${record.id}`,
    title: `${record.severity.toUpperCase()}: $${record.ticker} — ${headline.slice(0, 72)}`,
    severity: record.severity,
    message: [
      headline,
      record.description ? record.description.slice(0, 180) : '',
      record.projectedImpactLabel ? `Projected move ${record.projectedImpactLabel}.` : ''
    ]
      .filter(Boolean)
      .join(' '),
    createdAt,
    category: record.sector || 'Market Impact',
    relatedEntitySymbol: record.ticker,
    targetType: 'company',
    targetId: record.ticker,
    source: 'impact'
  };
}

export function alertsFromImpactRecords(records: StockImpactRecord[]): StoredAlert[] {
  const out: StoredAlert[] = [];
  for (const record of records) {
    const alert = alertFromImpact(record);
    if (alert) out.push(alert);
  }
  return out;
}

export function alertFromHeadline(article: {
  id: string;
  title: string;
  description?: string;
  sentiment?: string;
  publishedAt?: string;
}): StoredAlert | null {
  const title = (article.title || '').trim();
  if (!title || !article.id) return null;
  const text = `${title} ${article.description || ''}`;
  const severity = classifyEventSeverity(article.sentiment || 'neutral', text);
  const impactScore = impactScoreFromSeverity(severity);
  if (!isBlackSwanEvent({ severity, impactScore })) return null;
  return {
    id: `headline:${article.id}`,
    title: `${severity.toUpperCase()}: ${title.slice(0, 88)}`,
    severity,
    message: (article.description || title).slice(0, 280),
    createdAt: validIso(article.publishedAt) || new Date().toISOString(),
    category: 'Geopolitical',
    targetType: 'event',
    targetId: article.id,
    source: 'headline'
  };
}

export function alertsFromHeadlines(
  articles: {
    id: string;
    title: string;
    description?: string;
    sentiment?: string;
    publishedAt?: string;
  }[]
): StoredAlert[] {
  const out: StoredAlert[] = [];
  const seenTitles = new Set<string>();
  for (const article of articles) {
    const alert = alertFromHeadline(article);
    if (!alert) continue;
    const key = alert.title.trim().toLowerCase();
    if (seenTitles.has(key)) continue;
    seenTitles.add(key);
    out.push(alert);
  }
  return out;
}

export function alertFromCountryRisk(country: {
  id: string;
  name: string;
  riskScore: number;
  scoreChanged?: boolean;
  previousScore?: number;
  keyRisks?: string[];
}): StoredAlert | null {
  if (!country.scoreChanged) return null;
  if (country.riskScore < 70) return null;
  const severity = severityFromScore(country.riskScore);
  const prev =
    country.previousScore != null && Number.isFinite(country.previousScore)
      ? ` Previous score: ${country.previousScore}.`
      : '';
  const drivers = (country.keyRisks || []).slice(0, 2).join(' ');
  return {
    id: `country:${country.id}:${dayKey(new Date())}`,
    title: `${severity.toUpperCase()}: ${country.name} risk score ${country.riskScore}/100`,
    severity,
    message: `${country.name} live risk score moved to ${country.riskScore}/100.${prev} ${drivers}`.trim(),
    createdAt: new Date().toISOString(),
    category: 'Geopolitical',
    targetType: 'event',
    targetId: country.id,
    source: 'country'
  };
}

export function alertsFromCountryRisk(
  countries: {
    id: string;
    name: string;
    riskScore: number;
    scoreChanged?: boolean;
    previousScore?: number;
    keyRisks?: string[];
  }[]
): StoredAlert[] {
  return countries.map(alertFromCountryRisk).filter((a): a is StoredAlert => a != null);
}

export function storedAlertToItem(row: StoredAlert, read = false): AlertItem {
  return {
    id: row.id,
    title: row.title,
    severity: row.severity,
    message: row.message,
    read,
    createdAt: row.createdAt,
    createdAtIso: row.createdAt,
    category: row.category,
    relatedEntitySymbol: row.relatedEntitySymbol,
    targetType: row.targetType,
    targetId: row.targetId,
    source: row.source
  };
}

function validIso(value?: string): string | null {
  if (!value) return null;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
}

function dayKey(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}
