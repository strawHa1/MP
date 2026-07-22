export type RiskSeverity = 'critical' | 'high' | 'medium' | 'low';

export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  percentChange: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  lastUpdated: string; // ISO string or formatted time
  isMarketOpen: boolean;
}

export interface GlobalEvent {
  id: string;
  title: string;
  description: string;
  severity: RiskSeverity;
  impactScore: number; // 0 - 100
  region: string;
  countryIso?: string;
  sources: string[];
  reportedAt: string;
  category: 'Geopolitical' | 'Supply Chain' | 'Climate' | 'Macroeconomic' | 'Cybersecurity' | 'Energy';
  affectedCompanyTickers: string[];
  marketImpactSummary: string;
  timeline?: { date: string; title: string; detail: string }[];
}

export interface CompanyRisk {
  ticker: string;
  name: string;
  sector: string;
  country: string;
  marketCap: string;
  riskScore: number; // 0 - 100
  sentimentScore: number; // 0 - 100 (0 = Bearish, 100 = Bullish)
  sentimentLabel: 'Very Bearish' | 'Bearish' | 'Neutral' | 'Bullish' | 'Very Bullish';
  logoUrl?: string;
  description: string;
  keyRisks: string[];
  aiSummary: string;
  recentNews: { title: string; source: string; time: string; sentiment: 'negative' | 'neutral' | 'positive' }[];
  riskTrend: { date: string; score: number }[];
}

export interface SectorRisk {
  id: string;
  name: string;
  iconName: string;
  riskScore: number;
  companyCount: number;
  marketImpact: 'Critical' | 'Strong Negative' | 'Moderate' | 'Neutral' | 'Positive';
  topTickers: string[];
  keyRisks: string[];
  aiInsight: string;
  description: string;
}

export interface CountryRisk {
  id: string;
  name: string;
  isoCode: string;
  riskScore: number;
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low';
  flag: string;
  region: string;
  keyRisks: string[];
  eventsCount: number;
  coordinates: [number, number]; // [lng, lat]
  trendHistory: { month: string; score: number }[];
}

export interface PortfolioHolding {
  id: string;
  ticker: string;
  name?: string;
  companyName?: string;
  shares: number;
  costBasis?: number;
  avgCost?: number;
  currentValue?: number;
  allocationPct: number;
  riskScore: number;
  recommendedAction?: string;
  action?: string;
}

export interface PortfolioItem extends PortfolioHolding {}

export interface AlertItem {
  id: string;
  title: string;
  severity: RiskSeverity;
  message: string;
  read: boolean;
  createdAt: string;
  category: string;
  relatedEntitySymbol?: string;
  targetType?: 'event' | 'company' | 'sector' | 'portfolio';
  targetId?: string;
}

export interface ReportItem {
  id: string;
  title: string;
  summary: string;
  severityTag: RiskSeverity;
  createdAt: string;
  author: string;
  tags: string[];
  sections: { heading: string; body: string }[];
}

export interface SimulationResult {
  id: string;
  scenarioText: string;
  marketImpactPct: number;
  affectedCompaniesCount: number;
  recoveryTimeRange: string;
  probabilityPct: number;
  aiSummary: string;
  affectedTickers: { ticker: string; name: string; impactPct: number; riskLevel: string }[];
  supplyChainRisks: string[];
  marketImpactTimeline: { day: string; S_AND_P: number; TechSector: number; EnergySector: number }[];
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  widget?: {
    type: 'companyCard' | 'simulationPreview' | 'eventSummary';
    data: any;
  };
}

export interface UserProfile {
  name: string;
  email: string;
  avatarUrl: string;
  plan: 'Premium Plan' | 'Enterprise Terminal';
  company: string;
  role: string;
}

export interface AppSettings {
  theme: 'dark' | 'light' | 'system';
  language: string;
  timezone: string;
  enableAnimations: boolean;
  autoRefreshIntervalSec: number;
  emailAlerts: boolean;
  pushAlerts: boolean;
  criticalOnlyAlerts: boolean;
  finnhubApiKey?: string;
}
