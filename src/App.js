import { useState } from 'react';
import './App.css';
import Login from './Login';
import Sidebar from './Sidebar';
import {
  DashboardPage,
  AnalyticsPage,
  HistoryPage,
  AlertsPage,
  SettingsPage,
  UsersPage
} from './Pages';

function App() {
  const [user, setUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');

  const handleLogin = (userData) => {
    setUser(userData);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage('dashboard');
  };

  // If not logged in, show login page
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Render the current page
  const renderPage = () => {
    switch(currentPage) {
      case 'dashboard':
        return <DashboardPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'history':
        return <HistoryPage />;
      case 'alerts':
        return <AlertsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'users':
        return <UsersPage />;
      default:
        return <DashboardPage />;
    }
  };

  return (
    <div className="App">
      <Sidebar 
        user={user}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onLogout={handleLogout}
      />
      <main className="main-layout">
        <Header currentPage={currentPage} />
        <div className="page-container">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

// Simplified Header (no user dropdown needed, it's in sidebar now)
function Header({ currentPage }) {
  const getPageTitle = () => {
    switch(currentPage) {
      case 'dashboard': return '📊 Dashboard';
      case 'analytics': return '📈 Analytics';
      case 'history': return '📅 History';
      case 'alerts': return '🔔 Alerts';
      case 'settings': return '⚙️ Settings';
      case 'users': return '👥 Users';
      default: return '📊 Dashboard';
    }
  };

  return (
    <header className="main-header">
      <h1 className="page-title-header">{getPageTitle()}</h1>
      <div className="header-info">
        <span className="datetime">Sunday, Nov 03, 2025 - 14:30</span>
      </div>
    </header>
  );
}

export default App;