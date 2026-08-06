/**
 * Store for alerts the user creates from the AI Assistant chat.
 *
 * Uses the same localStorage + CustomEvent pattern as portfolioService so the
 * Alerts Center picks up new alerts immediately, and converts them into the
 * existing AlertItem shape so they render with the platform's own alert cards.
 */

import { AlertItem, RiskSeverity } from '../types';

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
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;
  return `${Math.floor(hours / 24)} day(s) ago`;
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
    category: alert.subjectType === 'stock' ? 'Custom Price Alert' : 'Custom Risk Alert',
    relatedEntitySymbol: alert.subjectType === 'stock' ? alert.subject : undefined
  };
}
