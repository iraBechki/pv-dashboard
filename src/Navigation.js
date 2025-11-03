/*import { useState } from 'react';
import './Navigation.css';

function Navigation({ user, currentPage, onPageChange }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊', roles: ['admin', 'user'] },
    { id: 'analytics', label: 'Analytics', icon: '📈', roles: ['admin', 'user'] },
    { id: 'history', label: 'History', icon: '📅', roles: ['admin', 'user'] },
    { id: 'alerts', label: 'Alerts', icon: '🔔', roles: ['admin', 'user'] },
    { id: 'settings', label: 'Settings', icon: '⚙️', roles: ['admin'] },
    { id: 'users', label: 'Users', icon: '👥', roles: ['admin'] },
  ];

  // Filter menu items based on user role
  const filteredMenuItems = menuItems.filter(item => 
    item.roles.includes(user.role)
  );

  return (
    <nav className="navigation">
      {/* Mobile menu toggle */ /*}
      <button 
        className="mobile-menu-btn"
        onClick={() => setIsMenuOpen(!isMenuOpen)}
      >
        {isMenuOpen ? '✕' : '☰'}
      </button>

      {/* Navigation links *//*}
      <ul className={`nav-list ${isMenuOpen ? 'open' : ''}`}>
        {filteredMenuItems.map(item => (
          <li key={item.id}>
            <button
              className={`nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => {
                onPageChange(item.id);
                setIsMenuOpen(false);
              }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          </li>
        ))}
      </ul>

      {/* Other Stations button *//*}
      <div className="nav-extra">
        <button className="nav-item coming-soon">
          <span className="nav-icon">🏢</span>
          <span className="nav-label">Other Stations</span>
          <span className="badge">Coming Soon</span>
        </button>
      </div>
    </nav>
  );
}

export default Navigation;*/