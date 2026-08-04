import { GlobalEvent } from '../types';

/** Fallback homepages for static/mock event source labels */
const SOURCE_HOME_URLS: Record<string, string> = {
  'Economic Times': 'https://economictimes.indiatimes.com',
  'Mint Markets': 'https://www.livemint.com/markets',
  'Business Standard': 'https://www.business-standard.com/markets',
  Reuters: 'https://www.reuters.com',
  'Reuters Top': 'https://www.reuters.com',
  'BBC Business': 'https://www.bbc.com/news/business',
  Bloomberg: 'https://www.bloomberg.com',
  'Nikkei Asia': 'https://asia.nikkei.com',
  'Financial Times': 'https://www.ft.com',
  'Wall Street Journal': 'https://www.wsj.com',
  'South China Morning Post': 'https://www.scmp.com',
  'Al Jazeera': 'https://www.aljazeera.com',
  'Lloyds List': 'https://www.lloydslist.com',
  'Maritime Executive': 'https://maritime-executive.com',
  'Panama Canal Authority': 'https://www.pancanal.com',
  'JOC Shipping News': 'https://www.joc.com',
  'CERT-EU': 'https://cert.europa.eu',
  'Der Spiegel': 'https://www.spiegel.de',
  'Central Bank Bulletin': 'https://www.reuters.com/markets',
  'Reuters Finance': 'https://www.reuters.com/markets',
  GNews: 'https://gnews.io',
  NewsAPI: 'https://newsapi.org',
  Finnhub: 'https://finnhub.io'
};

/**
 * Resolve a clickable URL for an intelligence source badge.
 * Prefers per-event sourceLinks / article URL, then known source homepages.
 */
export function resolveSourceUrl(source: string, event: GlobalEvent): string | null {
  const fromLinks = event.sourceLinks?.find((l) => l.name === source)?.url;
  if (fromLinks) return fromLinks;

  if (event.url && event.sources.length === 1 && event.sources[0] === source) {
    return event.url;
  }

  return SOURCE_HOME_URLS[source] ?? null;
}
