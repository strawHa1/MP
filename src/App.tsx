import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';
import { LoginPage } from './components/pages/LoginPage';
import { DashboardPage } from './components/pages/DashboardPage';
import { EventsPage } from './components/pages/EventsPage';
import { EventDetailPage } from './components/pages/EventDetailPage';
import { CompanyExplorerPage } from './components/pages/CompanyExplorerPage';
import { SectorExplorerPage } from './components/pages/SectorExplorerPage';
import { WorldMapPage } from './components/pages/WorldMapPage';
import { ReportsPage } from './components/pages/ReportsPage';
import { SimulationStudioPage } from './components/pages/SimulationStudioPage';
import { PortfolioRiskPage } from './components/pages/PortfolioRiskPage';
import { AlertsPage } from './components/pages/AlertsPage';
import { ChatAssistantPage } from './components/pages/ChatAssistantPage';
import { SearchPage } from './components/pages/SearchPage';
import { NotificationsPage } from './components/pages/NotificationsPage';
import { ProfilePage } from './components/pages/ProfilePage';
import { SettingsPage } from './components/pages/SettingsPage';

import { INITIAL_EVENTS, INITIAL_COMPANIES, INITIAL_ALERTS } from './data/mockData';
import { GlobalEvent, CompanyRisk, AlertItem } from './types';
import { useLiveHeadlines, NEWS_POLL_INTERVAL_MS } from './lib/newsService';

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [currentPath, setCurrentPath] = useState<string>('/dashboard');
  const [events, setEvents] = useState<GlobalEvent[]>(INITIAL_EVENTS);
  const [companies, setCompanies] = useState<CompanyRisk[]>(INITIAL_COMPANIES);
  const [alerts, setAlerts] = useState<AlertItem[]>(INITIAL_ALERTS);

  const { liveEvents, feed: newsFeed } = useLiveHeadlines('all', NEWS_POLL_INTERVAL_MS, 25);

  // Merge live API news with seeded events; live headlines appear first
  useEffect(() => {
    if (liveEvents.length === 0) return;
    const liveIds = new Set(liveEvents.map((e) => e.id));
    const staticEvents = INITIAL_EVENTS.filter((e) => !liveIds.has(e.id));
    setEvents([...liveEvents, ...staticEvents]);
  }, [liveEvents]);

  // App-wide risk tolerance & theme settings
  const [userRiskTolerance, setUserRiskTolerance] = useState<number>(55);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  // Sync theme class on <html> root element
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // Sync state with window location hash/path
  const navigate = (path: string) => {
    setCurrentPath(path);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogin = (name: string) => {
    setUsername(name);
    setIsAuthenticated(true);
    setCurrentPath('/dashboard');
  };

  const handleLogout = () => {
    setUsername('');
    setIsAuthenticated(false);
    setCurrentPath('/dashboard');
  };

  // Extract query params e.g. /events?id=evt-1 or /companies?symbol=NVDA
  const [baseRoute, queryString] = currentPath.split('?');
  const queryParams = new URLSearchParams(queryString || '');

  const eventId = queryParams.get('id') || '';
  const companySymbol = queryParams.get('symbol') || '';
  const simulationScenario = queryParams.get('scenario') || '';

  if (!isAuthenticated) {
    return <LoginPage onLogin={handleLogin} />;
  }

  // Unread alerts count
  const unreadAlertsCount = alerts.filter((a) => !a.read).length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0A0E17] text-slate-900 dark:text-slate-100 flex font-sans antialiased selection:bg-blue-600 selection:text-white transition-colors duration-200">
      {/* Persistent Left Sidebar */}
      <Sidebar
        currentPath={baseRoute}
        onNavigate={navigate}
        unreadAlertsCount={unreadAlertsCount}
        liveEventsCount={newsFeed?.count ?? liveEvents.length}
        userName={username}
        onLogout={handleLogout}
      />

      {/* Main Terminal Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header Bar */}
        <Header
          onNavigate={navigate}
          alerts={alerts}
          unreadCount={unreadAlertsCount}
        />

        {/* Dynamic Page Views */}
        <main className="flex-1 overflow-y-auto custom-scrollbar">
          {baseRoute === '/dashboard' && (
            <DashboardPage
              onNavigate={navigate}
              events={events}
              companies={companies}
              newsLastUpdated={newsFeed?.lastUpdated}
            />
          )}

          {baseRoute === '/events' && (
            eventId ? (
              <EventDetailPage
                eventId={eventId}
                onNavigate={navigate}
                events={events}
                companies={companies}
              />
            ) : (
              <EventsPage onNavigate={navigate} events={events} />
            )
          )}

          {baseRoute === '/companies' && (
            <CompanyExplorerPage
              initialSymbol={companySymbol}
              onNavigate={navigate}
              companies={companies}
              userRiskTolerance={userRiskTolerance}
              theme={theme}
            />
          )}

          {baseRoute === '/sectors' && (
            <SectorExplorerPage onNavigate={navigate} />
          )}

          {baseRoute === '/map' && (
            <WorldMapPage onNavigate={navigate} />
          )}

          {baseRoute === '/reports' && (
            <ReportsPage onNavigate={navigate} />
          )}

          {baseRoute === '/simulations' && (
            <SimulationStudioPage
              initialScenario={simulationScenario}
              onNavigate={navigate}
            />
          )}

          {baseRoute === '/portfolio' && (
            <PortfolioRiskPage
              onNavigate={navigate}
              companies={companies}
              userRiskTolerance={userRiskTolerance}
            />
          )}

          {baseRoute === '/alerts' && (
            <AlertsPage
              onNavigate={navigate}
              userRiskTolerance={userRiskTolerance}
            />
          )}

          {baseRoute === '/chat' && (
            <ChatAssistantPage onNavigate={navigate} />
          )}

          {baseRoute === '/search' && (
            <SearchPage
              onNavigate={navigate}
              events={events}
              companies={companies}
              userRiskTolerance={userRiskTolerance}
            />
          )}

          {baseRoute === '/notifications' && (
            <NotificationsPage onNavigate={navigate} />
          )}

          {baseRoute === '/profile' && (
            <ProfilePage onNavigate={navigate} onLogout={handleLogout} />
          )}

          {baseRoute === '/settings' && (
            <SettingsPage
              onNavigate={navigate}
              userRiskTolerance={userRiskTolerance}
              onUpdateRiskTolerance={setUserRiskTolerance}
              theme={theme}
              onUpdateTheme={setTheme}
            />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
