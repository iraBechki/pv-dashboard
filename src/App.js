import { useState } from 'react';
import './App.css';
import Login from './Login';
import Navigation from './Navigation';
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
      <Header user={user} />
      <Navigation 
        user={user}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
      />
      <Sidebar 
        user={user}
        currentPage={currentPage}
        onPageChange={setCurrentPage}
        onLogout={handleLogout}
      />
      <main className="main-layout">
        <div className="page-container">
          {renderPage()}
        </div>
      </main>
    </div>
  );
}

// Header Component
function Header({ user }) {
  return (
    <header className="main-header">
      <div className="header-left">
        <span className="logo-icon">⚡</span>
        <h1 className="app-title">PV Station Monitor</h1>
      </div>
      <div className="header-right">
        <span className="datetime">Sunday, Nov 03, 2025 - 14:30</span>
        <div className="user-badge">
          <span className="user-icon">{user.role === 'admin' ? '👤' : '👨'}</span>
          <span className="user-name">{user.name}</span>
        </div>
      </div>
    </header>
  );
}

export default App;
