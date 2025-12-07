import { useState, useEffect } from "react";
import "./App.css";
import Login from "./Login";
import Navigation from "./Navigation";
import Sidebar from "./Sidebar";
import {
  DashboardPage,
  AnalyticsPage,
  HistoryPage,
  AlertsPage,
  SettingsPage,
  UsersPage,
} from "./Pages";
import PropTypes from "prop-types";

function App() {
  // Restore user from localStorage on init
  const [user, setUser] = useState(() => {
    try {
      const raw = localStorage.getItem("pv_user");
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn("Failed to read pv_user from localStorage", e);
      return null;
    }
  });

  const [currentPage, setCurrentPage] = useState("dashboard");

  // Persist user to localStorage whenever it changes
  useEffect(() => {
    try {
      if (user) {
        localStorage.setItem("pv_user", JSON.stringify(user));
      } else {
        localStorage.removeItem("pv_user");
      }
    } catch (e) {
      console.warn("Failed to write pv_user to localStorage", e);
    }
  }, [user]);

  const handleLogin = (userData) => {
    setUser(userData);
    setCurrentPage("dashboard");
    // persistence handled by effect
  };

  const handleLogout = () => {
    setUser(null);
    setCurrentPage("dashboard");
    // persistence handled by effect
  };

  // If not logged in, show login page
  if (!user) {
    return <Login onLogin={handleLogin} />;
  }

  // Render the current page
  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <DashboardPage />;
      case "analytics":
        return <AnalyticsPage />;
      case "history":
        return <HistoryPage />;
      case "alerts":
        return <AlertsPage />;
      case "settings":
        return <SettingsPage />;
      case "users":
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
        <div className="page-container">{renderPage()}</div>
      </main>
    </div>
  );
}

// Header Component (updated to show live time)
function Header({ user }) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    // update immediately and every minute
    tick();
    const interval = setInterval(tick, 60_000);
    return () => clearInterval(interval);
  }, []);

  const dateOptions = {
    weekday: "long",
    month: "short",
    day: "2-digit",
    year: "numeric",
  };
  const timeOptions = { hour: "2-digit", minute: "2-digit", hour12: false };
  const dateString = now.toLocaleDateString(undefined, dateOptions);
  const timeString = now.toLocaleTimeString(undefined, timeOptions);
  const datetime = `${dateString} - ${timeString}`;

  return (
    <header className="main-header">
      <div className="header-left">
        <span className="logo-icon">⚡</span>
        <h1 className="app-title">SensaGrid</h1>
      </div>
      <div className="header-right">
        <AlertBadge />
        <span className="datetime">{datetime}</span>
        <div className="user-badge">
          <span className="user-icon">
            {user.role === "admin" ? "👤" : "👨"}
          </span>
          <span className="user-name">{user.name}</span>
        </div>
      </div>
    </header>
  );
}

// Alert Badge Component
function AlertBadge() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        const response = await fetch('http://localhost:8000/api/alerts/unread');
        const data = await response.json();
        setUnreadCount(data.count);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      }
    };

    fetchCount();
    const interval = setInterval(fetchCount, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  if (unreadCount === 0) return null;

  return (
    <div
      className="alert-badge"
      style={{
        position: 'relative',
        marginRight: '15px',
        cursor: 'pointer'
      }}
      title={`${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}`}
    >
      <span style={{ fontSize: '1.2rem' }}>🔔</span>
      <span
        className="alert-count"
        style={{
          position: 'absolute',
          top: '-5px',
          right: '-8px',
          background: '#dc2626',
          color: 'white',
          borderRadius: '50%',
          width: '18px',
          height: '18px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.7rem',
          fontWeight: 'bold'
        }}
      >
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    </div>
  );
}

Header.propTypes = {
  user: PropTypes.shape({
    name: PropTypes.string,
    role: PropTypes.string,
  }).isRequired,
};

export default App;
