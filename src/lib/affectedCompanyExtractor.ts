/**
 * Infer affected company tickers from event headline + description text.
 * Uses keyword matching against the curated watchlist universe and macro topic patterns.
 */

const COMPANY_KEYWORDS: { ticker: string; keywords: string[] }[] = [
  { ticker: 'NVDA', keywords: ['nvidia', 'nvda', 'ai chip', 'gpu', 'accelerator'] },
  { ticker: 'TSM', keywords: ['tsmc', 'taiwan semiconductor', 'taiwan chip', 'foundry'] },
  { ticker: 'ASML', keywords: ['asml', 'euv', 'lithography'] },
  { ticker: 'AAPL', keywords: ['apple', 'aapl', 'iphone', 'ipad'] },
  { ticker: 'AMD', keywords: ['amd', 'advanced micro', 'ryzen', 'epyc'] },
  { ticker: 'MSFT', keywords: ['microsoft', 'msft', 'azure'] },
  { ticker: 'XOM', keywords: ['exxon', 'xom', 'exxonmobil'] },
  { ticker: 'CVX', keywords: ['chevron', 'cvx'] },
  { ticker: 'SHEL', keywords: ['shell', 'shel'] },
  { ticker: 'LMT', keywords: ['lockheed', 'lmt', 'f-35'] },
  { ticker: 'RTX', keywords: ['rtx', 'raytheon'] },
  { ticker: 'BA', keywords: ['boeing', '737', '787'] },
  { ticker: 'JPM', keywords: ['jpmorgan', 'jp morgan', 'jpm'] },
  { ticker: 'AMZN', keywords: ['amazon', 'amzn', 'aws'] },
  { ticker: 'GOOGL', keywords: ['google', 'alphabet', 'googl'] },
  { ticker: 'TSLA', keywords: ['tesla', 'tsla'] },
  { ticker: 'TM', keywords: ['toyota'] },
  { ticker: 'HMC', keywords: ['honda'] },
  { ticker: 'SFTBY', keywords: ['softbank', 'soft bank'] },
  { ticker: 'SONY', keywords: ['sony'] },
  { ticker: 'CAT', keywords: ['caterpillar', 'cat '] },
  { ticker: 'DE', keywords: ['deere', 'john deere'] },
  { ticker: 'INFY', keywords: ['infosys', 'infy'] },
  { ticker: 'BABA', keywords: ['alibaba', 'baba'] },
  { ticker: 'MA', keywords: ['mastercard'] },
  { ticker: 'V', keywords: ['visa inc', 'visa shares'] },
  { ticker: 'SAP', keywords: ['sap se', ' sap '] },
  { ticker: 'INTC', keywords: ['intel', 'intc'] },
  { ticker: 'MU', keywords: ['micron', 'kioxia'] },
  { ticker: 'LRCX', keywords: ['lam research', 'lasertec', 'semiconductor equipment'] }
];

const MACRO_TICKER_MAP: { pattern: RegExp; tickers: string[] }[] = [
  { pattern: /taiwan|tsmc|semiconductor|chip export|foundry|asml|nvidia|gpu/i, tickers: ['TSM', 'NVDA', 'ASML', 'AMD', 'AAPL'] },
  { pattern: /hormuz|oil|crude|opec|energy|pipeline|chevron|exxon/i, tickers: ['XOM', 'CVX', 'SHEL'] },
  { pattern: /sanction|tariff|trade war|export control/i, tickers: ['NVDA', 'TSM', 'ASML', 'AAPL'] },
  { pattern: /defense|military|nato|missile|lockheed|raytheon|f-35|pentagon|armed conflict/i, tickers: ['LMT', 'RTX', 'BA'] },
  { pattern: /fed|interest rate|inflation|recession|\bbank\b|jpmorgan|central bank/i, tickers: ['JPM', 'MSFT', 'AMZN', 'GOOGL'] },
  { pattern: /japan|nikkei|yen|tokyo stock|japanese stock|japanese export/i, tickers: ['TM', 'SFTBY', 'SONY', 'HMC'] },
  { pattern: /auto.*stock|automotive|car maker|vehicle/i, tickers: ['TM', 'TSLA', 'F', 'GM', 'HMC'] },
  { pattern: /panama canal|shipping|freight|logistics|supply chain/i, tickers: ['FDX', 'UPS', 'CAT', 'AMZN'] },
  { pattern: /rupee|india stock|nifty|sensex|bse|nse/i, tickers: ['INFY', 'BABA'] },
  { pattern: /cyber|ransomware|breach|hack/i, tickers: ['MSFT', 'GOOGL', 'CRWD'] }
];

export function extractAffectedTickers(text: string, max = 6): string[] {
  const lower = text.toLowerCase();
  const tickers = new Set<string>();

  for (const { pattern, tickers: mapped } of MACRO_TICKER_MAP) {
    if (pattern.test(text)) mapped.forEach((t) => tickers.add(t));
  }

  for (const { ticker, keywords } of COMPANY_KEYWORDS) {
    if (keywords.some((k) => lower.includes(k))) tickers.add(ticker);
  }

  return Array.from(tickers).slice(0, max);
}
