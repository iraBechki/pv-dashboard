import { useState } from 'react';
import './Sidebar.css';

function Sidebar({ user, currentPage, onPageChange, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSecondaryOpen, setIsSecondaryOpen] = useState(false);

  // Main navigation items (always visible)
  const mainItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'analytics', label: 'Analytics', icon: '📈' },
    { id: 'history', label: 'History', icon: '📅' },
    { id: 'alerts', label: 'Alerts', icon: '🔔' },
  ];

  // Secondary items (collapsible section)
  const secondaryItems = [
    { id: 'settings', label: 'Settings', icon: '⚙️', roles: ['admin'] },
    { id: 'users', label: 'Users', icon: '👥', roles: ['admin'] },
    { id: 'stations', label: 'Other Stations', icon: '🏢', comingSoon: true },
  ];

  // Filter secondary items based on user role
  const filteredSecondaryItems = secondaryItems.filter(item => 
    !item.roles || item.roles.includes(user.role)
  );

  const handlePageChange = (pageId) => {
    onPageChange(pageId);
    setIsOpen(false);
  };

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const closeSidebar = () => {
    setIsOpen(false);
  };

  return (
    <>
      {/* Toggle Button - Always visible */}
      <button 
        className={`sidebar-toggle ${isOpen ? 'open' : ''}`}
        onClick={toggleSidebar}
        aria-label="Toggle menu"
      >
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
      </button>

      {/* Overlay - Click to close */}
      {isOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">PV Monitor</span>
          </div>
          <button className="sidebar-close" onClick={closeSidebar}>
            ✕
          </button>
        </div>

        {/* User Info */}
        <div className="sidebar-user">
          <div className="user-avatar">
            {user.role === 'admin' ? '👤' : '👨'}
          </div>
          <div className="user-info">
            <div className="user-name">{user.name}</div>
            <div className="user-role">{user.role}</div>
          </div>
        </div>

        {/* Main Navigation */}
        <nav className="sidebar-nav">
          <div className="nav-section">
            <div className="nav-section-title">Main</div>
            <ul className="nav-list">
              {mainItems.map(item => (
                <li key={item.id}>
                  <button
                    className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
                    onClick={() => handlePageChange(item.id)}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Secondary Section (Collapsible) */}
          {filteredSecondaryItems.length > 0 && (
            <div className="nav-section">
              <button 
                className="nav-section-title collapsible"
                onClick={() => setIsSecondaryOpen(!isSecondaryOpen)}
              >
                <span>More</span>
                <span className={`collapse-icon ${isSecondaryOpen ? 'open' : ''}`}>
                  ▼
                </span>
              </button>
              
              <ul className={`nav-list secondary ${isSecondaryOpen ? 'open' : ''}`}>
                {filteredSecondaryItems.map(item => (
                  <li key={item.id}>
                    <button
                      className={`nav-item ${currentPage === item.id ? 'active' : ''} ${item.comingSoon ? 'coming-soon' : ''}`}
                      onClick={() => !item.comingSoon && handlePageChange(item.id)}
                      disabled={item.comingSoon}
                    >
                      <span className="nav-icon">{item.icon}</span>
                      <span className="nav-label">{item.label}</span>
                      {item.comingSoon && (
                        <span className="coming-soon-badge">Soon</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </nav>

        {/* Sidebar Footer - Logout */}
        <div className="sidebar-footer">
          <button className="logout-button" onClick={onLogout}>
            <span className="nav-icon">🚪</span>
            <span className="nav-label">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;