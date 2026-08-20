/**
 * Store for alerts the user creates from the AI Assistant chat.
 *
 * Uses the same localStorage + CustomEvent pattern as portfolioService so the
 * Alerts Center picks up new alerts immediately, and converts them into the
 * existing AlertItem shape so they render with the platform's own alert cards.
 */

import { AlertItem, RiskSeverity } from '../types';
import { formatRelativeTime } from './dashboardMetrics';

const ALERTS_KEY = 'bs-user-alerts';

/** Fired after an alert is created or removed. */
export const USER_ALERTS_UPDATED_EVENT = 'bs-user-alerts-updated';

const MAX_ALERTS = 40;

export type AlertConditionType = 'price_below' | 'price_above' | 'risk_above' | 'risk_below';

export interface UserAlert {
  id: string;
  /** Ticker (e.g. "TSM") for stock alerts, or an index name (e.g. "Taiwan Strait"). */
  subject: string;
  subjectType: 'stock' | 'risk-index';
  condition: AlertConditionType;
  threshold: number;
  /** Price / score at creation time, shown for context in the Alerts Center. */
  referenceValue?: number;
  createdAt: string;
  triggered: boolean;
}

export interface CreateAlertInput {
  subject: string;
  subjectType: 'stock' | 'risk-index';
  condition: AlertConditionType;
  threshold: number;
  referenceValue?: number;
}

function readAlerts(): UserAlert[] {
  try {
    const raw = localStorage.getItem(ALERTS_KEY);
    if (raw) return JSON.parse(raw) as UserAlert[];
  } catch {
    /* corrupted entry — start clean */
  }
  return [];
}

function persist(alerts: UserAlert[]): void {
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts.slice(0, MAX_ALERTS)));
  window.dispatchEvent(new CustomEvent(USER_ALERTS_UPDATED_EVENT));
}

export function getUserAlerts(): UserAlert[] {
  return readAlerts();
}

export function createUserAlert(input: CreateAlertInput): UserAlert {
  const alert: UserAlert = {
    id: `ua-${Date.now()}`,
    subject: input.subjectType === 'stock' ? input.subject.toUpperCase() : input.subject,
    subjectType: input.subjectType,
    condition: input.condition,
    threshold: input.threshold,
    referenceValue: input.referenceValue,
    createdAt: new Date().toISOString(),
    triggered: false
  };
  persist([alert, ...readAlerts()]);
  return alert;
}

export function removeUserAlert(id: string): void {
  persist(readAlerts().filter((a) => a.id !== id));
}

export function clearUserAlerts(): void {
  persist([]);
}

/** Formats the trigger condition in plain English, e.g. "drops below $150.00". */
export function describeCondition(alert: UserAlert): string {
  const isPrice = alert.subjectType === 'stock';
  const value = isPrice
    ? `$${alert.threshold.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${alert.threshold}%`;

  switch (alert.condition) {
    case 'price_below':
    case 'risk_below':
      return `drops below ${value}`;
    case 'price_above':
    case 'risk_above':
    default:
      return `rises above ${value}`;
  }
}

/** One-line summary echoed back in chat and used as the Alerts Center title. */
export function describeUserAlert(alert: UserAlert): string {
  const subject = alert.subjectType === 'stock' ? `$${alert.subject}` : `${alert.subject} risk index`;
  return `${subject} ${describeCondition(alert)}`;
}

function severityFor(alert: UserAlert): RiskSeverity {
  // Downside triggers matter more for capital preservation than upside ones.
  if (alert.condition === 'price_below' || alert.condition === 'risk_above') return 'high';
  return 'medium';
}

function relativeTime(iso: string): string {
  return formatRelativeTime(iso);
}

/** Adapts a user alert into the AlertItem shape the Alerts Center already renders. */
export function toAlertItem(alert: UserAlert): AlertItem {
  const reference =
    alert.referenceValue !== undefined
      ? alert.subjectType === 'stock'
        ? ` Current price at creation: $${alert.referenceValue.toFixed(2)}.`
        : ` Current index at creation: ${alert.referenceValue}%.`
      : '';

  return {
    id: alert.id,
    title: `Watch: ${describeUserAlert(alert)}`,
    severity: severityFor(alert),
    message: `You asked Black Swan AI to notify you when ${describeUserAlert(alert)}.${reference} This alert is active and monitored against the live feed.`,
    read: false,
    createdAt: relativeTime(alert.createdAt),
    createdAtIso: alert.createdAt,
    category: alert.subjectType === 'stock' ? 'Custom Price Alert' : 'Custom Risk Alert',
    relatedEntitySymbol: alert.subjectType === 'stock' ? alert.subject : undefined,
    source: 'user'
  };
}

const HITS_KEY = 'bs-user-alert-hits';

export interface UserAlertHit {
  id: string;
  watchId: string;
  createdAt: string;
  title: string;
  message: string;
  severity: RiskSeverity;
  relatedEntitySymbol?: string;
}

function readHits(): UserAlertHit[] {
  try {
    const raw = localStorage.getItem(HITS_KEY);
    if (raw) return JSON.parse(raw) as UserAlertHit[];
  } catch {
    /* ignore */
  }
  return [];
}

function persistHits(hits: UserAlertHit[]): void {
  localStorage.setItem(HITS_KEY, JSON.stringify(hits.slice(0, MAX_ALERTS)));
}

export function getUserAlertHits(): UserAlertHit[] {
  return readHits();
}

export function nyDayKey(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(d);
}

export function conditionCrossed(alert: UserAlert, value: number): boolean {
  if (!Number.isFinite(value)) return false;
  if (alert.condition === 'price_below' || alert.condition === 'risk_below') return value < alert.threshold;
  return value > alert.threshold;
}

export function recordUserAlertHit(alert: UserAlert, value: number): UserAlertHit | null {
  const id = `hit-ua-${alert.id}-${nyDayKey()}`;
  const hits = readHits();
  if (hits.some((h) => h.id === id)) return null;
  const hit: UserAlertHit = {
    id,
    watchId: alert.id,
    createdAt: new Date().toISOString(),
    title: `TRIGGERED: ${describeUserAlert(alert)}`,
    message: `Live value ${
      alert.subjectType === 'stock' ? `$${value.toFixed(2)}` : `${Math.round(value)}/100`
    } crossed your watch (${describeUserAlert(alert)}).`,
    severity: severityFor(alert),
    relatedEntitySymbol: alert.subjectType === 'stock' ? alert.subject : undefined
  };
  persistHits([hit, ...hits]);
  return hit;
}

export function hitToAlertItem(hit: UserAlertHit): AlertItem {
  return {
    id: hit.id,
    title: hit.title,
    severity: hit.severity,
    message: hit.message,
    read: false,
    createdAt: relativeTime(hit.createdAt),
    createdAtIso: hit.createdAt,
    category: 'Triggered Watch',
    relatedEntitySymbol: hit.relatedEntitySymbol,
    source: 'user-trigger'
  };
}
