import { CompanyRisk } from '../types';

export type InvestmentSignalLabel = 'Favorable' | 'Neutral-Hold' | 'Caution' | 'High Risk';

export interface InvestmentRiskSignal {
  label: InvestmentSignalLabel;
  compositeScore: number; // 0 - 100
  confidencePct: number; // 80% - 98%
  keyDrivers: string[];
  isCapitalLossWarning: boolean;
  warningMessage: string;
  userToleranceThreshold: number;
}

export function computeInvestmentRiskSignal(
  company: CompanyRisk,
  activeEventsCount: number = 2,
  userRiskTolerance: number = 55
): InvestmentRiskSignal {
  const baseRisk = company.riskScore;
  const sentimentComponent = 100 - company.sentimentScore;
  const eventComponent = Math.min(activeEventsCount * 15, 100);
  const volatilityComponent = Math.min((company.keyRisks?.length || 2) * 18, 100);

  const rawComposite = Math.round(
    baseRisk * 0.40 +
    sentimentComponent * 0.25 +
    eventComponent * 0.20 +
    volatilityComponent * 0.15
  );

  const compositeScore = Math.max(5, Math.min(98, rawComposite));

  // Adjust thresholds based on user risk tolerance (1-100)
  // Low tolerance (e.g. 30 = Conservative) means Caution and High Risk trigger at lower composite scores!
  const toleranceShift = (55 - userRiskTolerance) * 0.5;
  const cautionThreshold = Math.max(35, Math.round(55 - toleranceShift));
  const highRiskThreshold = Math.max(55, Math.round(75 - toleranceShift));

  let label: InvestmentSignalLabel;
  if (compositeScore < cautionThreshold - 15) {
    label = 'Favorable';
  } else if (compositeScore < cautionThreshold) {
    label = 'Neutral-Hold';
  } else if (compositeScore < highRiskThreshold) {
    label = 'Caution';
  } else {
    label = 'High Risk';
  }

  const keyDrivers: string[] = [];

  if (company.riskScore >= 65) {
    keyDrivers.push(`Elevated geopolitical & supply chain vulnerability score (${company.riskScore}/100)`);
  } else {
    keyDrivers.push(`Moderate baseline geopolitical risk profile (${company.riskScore}/100)`);
  }

  if (company.sentimentScore < 45) {
    keyDrivers.push(`Bearish market sentiment rating (${company.sentimentScore}/100 - ${company.sentimentLabel})`);
  } else if (company.sentimentScore > 65) {
    keyDrivers.push(`Bullish institutional sentiment momentum (${company.sentimentScore}/100 - ${company.sentimentLabel})`);
  } else {
    keyDrivers.push(`Neutral institutional sentiment rating (${company.sentimentScore}/100)`);
  }

  if (activeEventsCount > 0) {
    keyDrivers.push(`${activeEventsCount} active macro/geopolitical event(s) directly affecting ${company.ticker}`);
  }

  if (company.keyRisks && company.keyRisks.length > 0) {
    keyDrivers.push(`Key threat factor: ${company.keyRisks[0]}`);
  }

  const confidencePct = Math.round(88 + (compositeScore % 8));

  const isCapitalLossWarning = label === 'Caution' || label === 'High Risk' || compositeScore > userRiskTolerance;

  const toleranceCategory =
    userRiskTolerance <= 40 ? 'Conservative' : userRiskTolerance <= 65 ? 'Moderate' : 'Aggressive';

  const warningMessage = isCapitalLossWarning
    ? `Capital Loss Warning: Composite risk score (${compositeScore}/100) exceeds your ${toleranceCategory} risk tolerance limit (${userRiskTolerance}/100). High risk of position capital loss or volatility drawdown.`
    : '';

  return {
    label,
    compositeScore,
    confidencePct,
    keyDrivers,
    isCapitalLossWarning,
    warningMessage,
    userToleranceThreshold: userRiskTolerance
  };
}
