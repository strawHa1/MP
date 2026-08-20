import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ShieldAlert,
  Building2,
  Bell,
  TrendingDown,
  TrendingUp,
  Globe2,
  ArrowRight,
  Zap,
  CheckCircle2,
  Compass,
  Loader2,
  RefreshCw,
  AlertTriangle
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip } from 'recharts';
import { GlobalEvent, AlertItem } from '../../types';
import { SeverityBadge } from '../common/SeverityBadge';
import { RiskGauge } from '../common/RiskGauge';
import { ImpactOnStocksSection } from '../dashboard/ImpactOnStocksSection';
import { RecommendedActionModal } from '../dashboard/RecommendedActionModal';
import { useDashboardStats, type TrendPoint } from '../../lib/useDashboardStats';
import { useDashboardIntelligence, RecommendedActionItem } from '../../lib/useDashboardIntelligence';
import {
  displayCountryName,
  findTrendGaps,
  formatTrendAxisDay,
  isDataFresh,
  trendGapCaption,
  trendYAxisDomain
} from '../../lib/dashboardMetrics';

const EMPTY_TREND: TrendPoint[] = [];
const TREND_CHART_HEIGHT = 224;

function SnapshotJobStatus({
  job
}: {
  job: {
    ok: boolean;
    lastAttemptAt: string | null;
    lastSuccessAt: string | null;
    lastError: string | null;
    unrecoverableDays: string[];
  } | null;
}) {
  if (!job) return null;
  const when = job.lastSuccessAt
    ? new Date(job.lastSuccessAt).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      })
    : null;
  if (job.lastAttemptAt && !job.ok) {
    return (
      <span
        className="text-[10px] font-mono text-amber-400 flex items-center gap-1"
        title={job.lastError || 'Snapshot job failed'}
      >
        <AlertTriangle className="w-3 h-3" />
        last attempt failed
      </span>
    );
  }
  if (when) {
    const gaps = job.unrecoverableDays?.length ?? 0;
    return (
      <span
        className={`text-[10px] font-mono flex items-center gap-1 ${
          gaps > 0 ? 'text-amber-400' : 'text-emerald-400'
        }`}
        title={gaps > 0 ? `Unrecoverable gaps: ${job.unrecoverableDays.join(', ')}` : 'Daily snapshot job healthy'}
      >
        last snapshot: {when} {gaps > 0 ? '⚠' : '✓'}
      </span>
    );
  }
  return <span className="text-[10px] font-mono text-slate-500">snapshot job: waiting</span>;
}

function FittedWidth({
  className,
  children
}: {
  className?: string;
  children: (width: number) => React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const apply = (next: number) => {
      const rounded = Math.round(next);
      if (rounded < 1) return;
      setWidth((prev) => (Math.abs(prev - rounded) < 2 ? prev : rounded));
    };
    apply(el.getBoundingClientRect().width);
    const ro = new ResizeObserver((entries) => {
      apply(entries[0]?.contentRect.width ?? 0);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={ref} className={className}>
      {width > 0 ? children(width) : null}
    </div>
  );
}

interface DashboardPageProps {
  onNavigate: (path: string) => void;
  events: GlobalEvent[];
  alerts: AlertItem[];
  newsLastUpdated?: string;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({
  onNavigate,
  events,
  alerts,
  newsLastUpdated
}) => {
  const { stats, loading, refreshing, error, refresh } = useDashboardStats(events, alerts);
  const intelligence = useDashboardIntelligence();
  const [selectedAction, setSelectedAction] = useState<RecommendedActionItem | null>(null);
  const [actionConfirmed, setActionConfirmed] = useState<string | null>(null);
  const dataFresh = isDataFresh(stats?.lastUpdated);
  const trendPoints = stats?.trend ?? EMPTY_TREND;
  const trendGaps = useMemo(() => findTrendGaps(trendPoints), [trendPoints]);
  const trendYDomain = useMemo(() => {
    const scores = trendPoints
      .map((p) => p.score)
      .filter((s): s is number => s != null && Number.isFinite(s));
    return trendYAxisDomain(scores);
  }, [trendPoints]);
  const trendChartData = useMemo(
    () =>
      trendPoints.map((p) => ({
        ...p,
        date: p.date || p.day,
        recordedScore:
          p.recordedScore !== undefined
            ? p.recordedScore
            : p.source === 'estimated' || p.source === 'gap'
              ? null
              : p.score
      })),
    [trendPoints]
  );
  const renderTrendDot = useCallback((dotProps: any) => {
    const src = dotProps.payload?.source;
    const score = dotProps.payload?.score;
    if (score == null || dotProps.cx == null || dotProps.cy == null) return false;
    if (src === 'estimated') {
      return (
        <circle
          key={`est-${dotProps.index}`}
          cx={dotProps.cx}
          cy={dotProps.cy}
          r={2.5}
          fill="#64748B"
        />
      );
    }
    return (
      <circle
        key={dotProps.index}
        cx={dotProps.cx}
        cy={dotProps.cy}
        r={4}
        fill={src === 'headline-backfill' ? '#F59E0B' : '#EF4444'}
      />
    );
  }, []);

  const handleConfirmExecute = (action: RecommendedActionItem) => {
    const log = JSON.parse(localStorage.getItem('bs-action-log') || '[]') as object[];
    log.unshift({
      id: action.id,
      type: 'execute',
      ticker: action.ticker,
      title: action.title,
      at: new Date().toISOString()
    });
    localStorage.setItem('bs-action-log', JSON.stringify(log.slice(0, 20)));
    setActionConfirmed(action.id);
    setTimeout(() => {
      setSelectedAction(null);
      setActionConfirmed(null);
      onNavigate(`/portfolio?review=${action.ticker}&action=hedge`);
    }, 1200);
  };

  const handleOpenPortfolioReview = (action: RecommendedActionItem) => {
    setSelectedAction(null);
    onNavigate(`/portfolio?review=${action.ticker}&action=rebalance`);
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto font-sans">
      {/* Top Welcome / Header Status Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#0F1420] border border-[#232A3D] p-5 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400 uppercase tracking-widest">
            <span
              className={`w-2 h-2 rounded-full ${
                dataFresh ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'
              }`}
            />
            {dataFresh ? 'LIVE RISK INTELLIGENCE RADAR' : 'RISK INTELLIGENCE RADAR'}
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight mt-1">
            Global Risk Intelligence Dashboard
          </h1>
        </div>

        <div className="flex items-center gap-3">
            {stats?.lastUpdated && (
              <span className="text-[10px] text-emerald-400 font-mono hidden sm:block">
                Updated {new Date(stats.lastUpdated).toLocaleTimeString()}
                {!dataFresh && ' • delayed'}
              </span>
            )}
          <button
            onClick={refresh}
            disabled={refreshing}
            className="p-2 rounded-xl bg-[#161B2C] border border-[#232A3D] text-slate-400 hover:text-white disabled:opacity-50"
            title="Refresh dashboard"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {loading && !stats ? (
        <div className="flex flex-col items-center py-24 text-slate-400">
          <Loader2 className="w-8 h-8 animate-spin text-blue-400 mb-3" />
          <p className="text-xs">Loading live risk intelligence...</p>
        </div>
      ) : error && !stats ? (
        <div className="bg-[#0F1420] border border-red-500/30 p-8 rounded-2xl text-center">
          <p className="text-red-400 font-bold text-sm">{error}</p>
          <button onClick={refresh} className="mt-2 text-xs text-blue-400 hover:underline">Retry</button>
        </div>
      ) : stats && (
      <>

      {/* Top Row: 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* Stat Card 1: Global Risk Score */}
        <div className="bg-[#0F1420] border border-[#232A3D] p-5 rounded-2xl shadow-lg hover:border-slate-600 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Global Risk Score
            </span>
            <span className="p-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20">
              <Activity className="w-4 h-4" />
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white">{stats.globalRiskScore}</span>
            <span className="text-xs text-slate-400">/ 100</span>
            <SeverityBadge severity={stats.globalRiskSeverity} size="sm" className="ml-auto" />
          </div>

          <div className={`mt-3 flex items-center gap-1.5 text-xs font-semibold ${stats.scoreDelta != null && stats.scoreDelta >= 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {stats.scoreDelta != null ? (
              <>
                {stats.scoreDelta >= 0 ? (
                  <TrendingDown className="w-3.5 h-3.5 rotate-180" />
                ) : (
                  <TrendingUp className="w-3.5 h-3.5" />
                )}
                <span>
                  {stats.scoreDelta >= 0 ? '+' : ''}{stats.scoreDelta} pts from prior snapshot
                  {stats.globalRiskSeverity === 'critical' || stats.globalRiskSeverity === 'high' ? ' (Elevated)' : ''}
                </span>
              </>
            ) : (
              <span className="text-slate-500">Building trend baseline...</span>
            )}
          </div>
        </div>

        {/* Stat Card 2: Active Black Swan Events */}
        <div className="bg-[#0F1420] border border-[#232A3D] p-5 rounded-2xl shadow-lg hover:border-slate-600 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Active Black Swans
            </span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldAlert className="w-4 h-4" />
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white">{stats.activeBlackSwans}</span>
            {stats.liveEventsToday > 0 && (
              <span className="text-xs font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full ml-auto">
                +{stats.liveEventsToday} Live
              </span>
            )}
          </div>

          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
            <span>Critical Focus: {stats.criticalFocus}</span>
            <button onClick={() => onNavigate('/events')} className="text-blue-400 font-semibold hover:underline">
              View Feed
            </button>
          </div>
        </div>

        {/* Stat Card 3: Companies at Risk */}
        <div className="bg-[#0F1420] border border-[#232A3D] p-5 rounded-2xl shadow-lg hover:border-slate-600 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Companies At Risk
            </span>
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
              <Building2 className="w-4 h-4" />
            </span>
          </div>

          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold font-mono text-white">{stats.companiesAtRisk}</span>
            {stats.companiesAtRisk > 0 && (
              <span className="text-xs font-semibold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded-full ml-auto">
                Live impacts
              </span>
            )}
          </div>

          <div className="mt-3 text-xs text-slate-400 flex items-center justify-between">
            <span>
              High Risk: {stats.highRiskTickers.length > 0 ? stats.highRiskTickers.join(', ') : 'Scanning watchlist...'}
            </span>
            <button
              type="button"
              onClick={() => {
                const tickers = stats.atRiskTickers.join(',');
                onNavigate(
                  tickers
                    ? `/companies?filter=at-risk&tickers=${encodeURIComponent(tickers)}`
                    : '/companies?filter=at-risk'
                );
              }}
              className="text-blue-400 font-semibold hover:underline shrink-0 ml-2"
            >
              Explore
            </button>
          </div>
        </div>

        {/* Stat Card 4: Critical Alerts */}
        <div className="bg-[#0F1420] border border-red-500/30 p-5 rounded-2xl shadow-lg relative overflow-hidden hover:border-red-500/60 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-xl pointer-events-none" />

          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              Critical Alerts
            </span>
            <span className="p-2 rounded-xl bg-red-500/20 text-red-400 border border-red-500/30">
              <Bell className="w-4 h-4" />
            </span>
          </div>

          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-3xl font-extrabold font-mono text-white">{stats.criticalAlerts}</span>
            <button
              onClick={() => onNavigate('/alerts')}
              className="text-xs text-red-400 hover:text-red-300 font-bold flex items-center gap-1"
            >
              View all <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-3 text-xs text-slate-300 font-medium truncate">
            {stats.topCriticalTitle}
          </div>
        </div>
      </div>

      {/* Middle Row: Charts & Dial */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk Trend (30 Days) Chart */}
        <div className="lg:col-span-2 bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-blue-400" />
                Global Risk Score Trend (30 Days)
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Composite Index measuring geopolitical, maritime chokepoint, and commodity stress.
                <span className="block text-[10px] text-slate-500 mt-1">
                  {stats.trendSnapshotCount} recorded day{stats.trendSnapshotCount === 1 ? '' : 's'}
                  {stats.trendEstimatedCount > 0
                    ? ` · ${stats.trendEstimatedCount} estimated (dashed) to complete the 30-day window`
                    : ''}
                  . Daily snapshots run automatically at 16:05 America/New_York (after US equity close).
                </span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="text-xs font-mono font-bold text-slate-300 bg-[#161B2C] border border-[#232A3D] px-2.5 py-1 rounded-lg">
                30D HIGH: {stats.trendHigh}
              </span>
              <SnapshotJobStatus job={stats.snapshotJob} />
            </div>
          </div>

          <div className="h-56 w-full mt-2 relative">
            {stats.trendSnapshotCount > 0 ? (
            <>
            <FittedWidth className="h-full w-full">
              {(chartWidth) => (
              <LineChart
                width={chartWidth}
                height={TREND_CHART_HEIGHT}
                data={trendChartData}
                margin={{ top: 8, right: 8, left: 4, bottom: 4 }}
              >
                <XAxis
                  dataKey="date"
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  interval="preserveStartEnd"
                  minTickGap={22}
                  tickFormatter={formatTrendAxisDay}
                />
                <YAxis
                  type="number"
                  domain={trendYDomain}
                  stroke="#64748B"
                  fontSize={11}
                  tickLine={false}
                  allowDecimals={false}
                  width={36}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#161B2C', borderColor: '#232A3D', borderRadius: '12px', color: '#FFF' }}
                  formatter={(value: number | null, name: string, item: any) => {
                    if (name === 'recordedScore') return null;
                    if (value == null) return ['No snapshot recorded', 'Score'];
                    const src = item?.payload?.source;
                    if (src === 'estimated') return [value, 'Estimated (no snapshot)'];
                    if (src === 'headline-backfill') return [value, 'Score (from headlines)'];
                    return [value, 'Score'];
                  }}
                  labelFormatter={(label: string, payload: any[]) => {
                    const date = payload?.[0]?.payload?.date || label;
                    const day = payload?.[0]?.payload?.day || formatTrendAxisDay(date);
                    return `${day} (${date} UTC)`;
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#64748B"
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  connectNulls
                  isAnimationActive={false}
                  dot={renderTrendDot}
                  activeDot={false}
                />
                <Line
                  type="monotone"
                  dataKey="recordedScore"
                  stroke="#EF4444"
                  strokeWidth={3}
                  connectNulls={false}
                  isAnimationActive={false}
                  dot={false}
                  activeDot={{ r: 6, fill: '#FFF' }}
                />
              </LineChart>
              )}
            </FittedWidth>
            {trendChartData.length > 0 &&
              trendGaps.map((gap) => {
              const caption = trendGapCaption(gap);
              const left = (gap.startIndex / trendChartData.length) * 100;
              const width = (gap.days / trendChartData.length) * 100;
              const showSubtitle = width >= 10;
              return (
                <div
                  key={`gap-${gap.startKey}-${gap.endKey}`}
                  className="absolute top-2 bottom-6 pointer-events-none flex flex-col items-center justify-center border-x border-dashed border-slate-600/50 bg-slate-500/[0.04]"
                  style={{ left: `calc(36px + ${left} * (100% - 44px) / 100)`, width: `calc(${width} * (100% - 44px) / 100)` }}
                  aria-hidden
                >
                  <span className="text-[10px] leading-tight text-slate-500 font-medium">{caption.title}</span>
                  {showSubtitle && (
                    <span className="text-[9px] leading-tight text-slate-600 mt-0.5">{caption.subtitle}</span>
                  )}
                </div>
              );
            })}
            </>
            ) : (
              <div className="flex items-center justify-center h-full text-xs text-slate-500">
                Collecting trend data from live news feeds...
              </div>
            )}
          </div>
        </div>

        {/* Market Sentiment Dial Card */}
        <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl flex flex-col items-center justify-between text-center">
          <div className="w-full text-left">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Compass className="w-4 h-4 text-amber-400" />
              Global Market Sentiment
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Real-time NLP analysis of news & financial streams</p>
          </div>

          <div className="my-4">
            <RiskGauge score={stats.sentiment.gaugeScore} size="lg" label={stats.sentiment.label} />
          </div>

          <div className="w-full bg-[#161B2C] border border-[#232A3D] p-3 rounded-xl text-xs text-slate-300 flex items-center justify-between font-mono">
            <span>BEARISH: {stats.sentiment.bearishPct}%</span>
            <span>NEUTRAL: {stats.sentiment.neutralPct}%</span>
            <span>BULLISH: {stats.sentiment.bullishPct}%</span>
          </div>
        </div>
      </div>

      {/* Global Events Feed */}
      <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#232A3D]">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              Global Events
            </h3>
            {newsLastUpdated && (
              <p className="text-[10px] text-emerald-400 font-mono mt-0.5">
                Live India & World news • Updated {new Date(newsLastUpdated).toLocaleTimeString()}
              </p>
            )}
          </div>
          <button onClick={() => onNavigate('/events')} className="text-xs text-blue-400 hover:underline font-semibold">
            View All
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {events.length === 0 ? (
            <p className="col-span-full text-xs text-slate-500 py-6 text-center">
              No live headlines available right now. The feed will populate on the next refresh.
            </p>
          ) : (
          events.slice(0, 3).map((evt) => (
            <div
              key={evt.id}
              role="button"
              tabIndex={0}
              onClick={() => onNavigate(`/events?id=${evt.id}`)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onNavigate(`/events?id=${evt.id}`);
                }
              }}
              className="p-4 rounded-xl bg-[#161B2C] hover:bg-slate-800/80 border border-[#232A3D] cursor-pointer transition-colors"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SeverityBadge severity={evt.severity} size="sm" />
                  {evt.isLive && (
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 uppercase">Live</span>
                  )}
                </div>
                <span className="text-[10px] text-slate-400 font-mono">{evt.reportedAt}</span>
              </div>
              <h4 className="text-xs font-bold text-slate-200 mt-2 line-clamp-2">{evt.title}</h4>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-1">{evt.region} • Impact Score: {evt.impactScore}/100</p>
            </div>
          ))
          )}
        </div>
      </div>

      {/* Impact on Stocks — news-to-price correlation */}
      <ImpactOnStocksSection onNavigate={onNavigate} />

      {/* World Map Heatmap Preview Row */}
      <div 
        onClick={() => onNavigate('/map')}
        className="bg-[#0F1420] border border-[#232A3D] hover:border-blue-500/50 p-6 rounded-2xl shadow-xl cursor-pointer transition-all group"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2 group-hover:text-blue-400 transition-colors">
              <Globe2 className="w-5 h-5 text-blue-400" />
              Global Risk Heatmap Preview
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Geographic threat distribution across {stats.trackedCountryCount || stats.mapCountries.length} tracked countries
              · 30-day history updates daily
            </p>
          </div>
          <span className="text-xs text-blue-400 font-bold flex items-center gap-1 group-hover:underline">
            Open Interactive Map <ArrowRight className="w-4 h-4" />
          </span>
        </div>

        {/* Mini World Preview Graphic */}
        <div className="h-40 bg-[#161B2C] rounded-xl border border-[#232A3D] relative overflow-hidden p-3">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(#3B82F6_1px,transparent_1px)] [background-size:16px_16px]" />
          <div className="relative z-10 h-full grid grid-cols-4 sm:grid-cols-7 gap-2">
            {(stats.mapCountries?.length ? stats.mapCountries : stats.topCountries).map((c) => {
              const tone =
                c.riskLevel === 'Critical'
                  ? 'bg-red-500/25 border-red-500/40 text-red-300'
                  : c.riskLevel === 'High'
                    ? 'bg-amber-500/20 border-amber-500/35 text-amber-300'
                    : c.riskLevel === 'Medium'
                      ? 'bg-blue-500/20 border-blue-500/30 text-blue-300'
                      : 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300';
              return (
                <div
                  key={c.id}
                  className={`rounded-lg border px-1.5 py-1 flex flex-col justify-center ${tone}`}
                >
                  <span className="text-[10px] font-bold truncate">{displayCountryName(c.name)}</span>
                  <span className="text-[10px] font-mono">{c.riskScore}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Row: AI Insights, Recommended Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* AI Insights Card */}
        <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#232A3D]">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Zap className="w-4 h-4 text-purple-400" />
              AI Risk Insights
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded font-mono">
                {intelligence.source === 'gemini' ? 'GEMINI' : 'LIVE'}
              </span>
              {intelligence.generatedAt && (
                <span className="text-[10px] text-slate-500 font-mono hidden sm:inline">
                  {new Date(intelligence.generatedAt).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>

          {intelligence.loading && intelligence.insights.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-purple-400" />
              Analyzing live events against portfolio...
            </div>
          ) : intelligence.error && intelligence.insights.length === 0 ? (
            <p className="text-xs text-amber-400 py-4">{intelligence.error}</p>
          ) : (
            <ul className="space-y-3 text-xs text-slate-300 leading-relaxed">
              {intelligence.insights.map((insight) => (
                <li
                  key={insight.id}
                  className="flex gap-2.5 p-2.5 rounded-xl bg-[#161B2C] border border-[#232A3D]"
                >
                  <span className="text-purple-400 font-bold shrink-0">•</span>
                  <span>
                    <strong>{insight.title}:</strong> {insight.body}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="text-[10px] text-slate-500 font-mono">
            Derived from {intelligence.liveEventCount} live headlines + {intelligence.portfolioTickers.length} portfolio holdings
          </p>
        </div>

        {/* Recommended Actions Card */}
        <div className="bg-[#0F1420] border border-[#232A3D] p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#232A3D]">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              Recommended Actions
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('/portfolio')}
              className="text-xs text-blue-400 hover:underline font-semibold"
            >
              Portfolio
            </button>
          </div>

          {intelligence.loading && intelligence.actions.length === 0 ? (
            <div className="flex items-center gap-2 text-xs text-slate-400 py-6 justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              Computing portfolio actions...
            </div>
          ) : intelligence.actions.length === 0 ? (
            <p className="text-xs text-slate-500 py-4">No actions recommended for current portfolio state.</p>
          ) : (
            <div className="space-y-2.5">
              {intelligence.actions.map((action) => (
                <div
                  key={action.id}
                  className="p-3 rounded-xl bg-[#161B2C] border border-[#232A3D] flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-slate-200">{action.title}</div>
                    <div className="text-[11px] text-slate-400 truncate">{action.subtitle}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedAction(action)}
                    className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold shrink-0"
                  >
                    {action.type === 'execute' ? 'Execute' : 'Review'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <RecommendedActionModal
        action={selectedAction}
        onClose={() => setSelectedAction(null)}
        onConfirmExecute={handleConfirmExecute}
        onOpenPortfolioReview={handleOpenPortfolioReview}
      />

      {actionConfirmed && (
        <div className="fixed bottom-6 right-6 z-[110] bg-emerald-600 text-white text-xs font-bold px-4 py-3 rounded-xl shadow-lg flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          Hedge plan confirmed — opening portfolio...
        </div>
      )}
      </>
      )}
    </div>
  );
};
