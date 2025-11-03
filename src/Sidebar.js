import { useState } from 'react';
import './Sidebar.css';

function Sidebar({ user, currentPage, onPageChange, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  // Only secondary items in sidebar
  const sidebarItems = [
    { id: 'settings', label: 'Settings', icon: '⚙️', roles: ['admin'] },
    { id: 'users', label: 'Users', icon: '👥', roles: ['admin'] },
    { id: 'stations', label: 'Other Stations', icon: '🏢', comingSoon: true },
  ];

  // Filter items based on user role
  const filteredItems = sidebarItems.filter(item => 
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

  // Don't show sidebar if no items to display
  if (filteredItems.length === 0) {
    return null;
  }

  return (
    <>
      {/* Toggle Button - Always visible */}
      <button 
        className={`sidebar-toggle ${isOpen ? 'open' : ''}`}
        onClick={toggleSidebar}
        aria-label="Toggle menu"
        title="More options"
      >
        <span className="toggle-icon">⚙️</span>
      </button>

      {/* Overlay - Click to close */}
      {isOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Sidebar Header */}
        <div className="sidebar-header">
          <div className="sidebar-logo">
            <span className="logo-icon">⚡</span>
            <span className="logo-text">More Options</span>
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

        {/* Navigation */}
        <nav className="sidebar-nav">
          <div className="nav-section">
            <ul className="nav-list">
              {filteredItems.map(item => (
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
