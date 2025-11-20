import { useState, useEffect } from "react";
import "./Sidebar.css";

function Sidebar({ user, currentPage, onPageChange, onLogout }) {
  const [isOpen, setIsOpen] = useState(false);

  // show toggle on desktop if sidebarCollapsibleOnDesktop()
  const sidebarCollapsibleOnDesktop = () =>
    window.matchMedia("(min-width: 1024px)").matches;
  const [showToggle, setShowToggle] = useState(sidebarCollapsibleOnDesktop());

  // track inline style for placing toggle next to header user box
  const [togglePos, setTogglePos] = useState(null);

  useEffect(() => {
    const handleResize = () => setShowToggle(sidebarCollapsibleOnDesktop());
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // compute toggle position to sit just right of the header's .header-right box
  useEffect(() => {
    const toggleSize = 36; // px, keep in sync with Sidebar.css --sidebar-toggle-size
    const gap = 8; // px gap between header box and toggle

    const updatePos = () => {
      const headerRight = document.querySelector(".main-header .header-right");
      if (!headerRight) {
        setTogglePos(null);
        return;
      }
      const rect = headerRight.getBoundingClientRect();
      const top = Math.round(rect.top + rect.height / 2 - toggleSize / 2);
      // distance from viewport right edge
      const right = Math.round(window.innerWidth - rect.right + gap);
      setTogglePos({ top, right });
    };

    // update on mount, resize, and scroll (header may shift)
    updatePos();
    window.addEventListener("resize", updatePos);
    window.addEventListener("scroll", updatePos, { passive: true });

    return () => {
      window.removeEventListener("resize", updatePos);
      window.removeEventListener("scroll", updatePos);
    };
  }, [isOpen]);

  // Only secondary items in sidebar
  const sidebarItems = [
    { id: "settings", label: "Settings", icon: "⚙️", roles: ["admin"] },
    { id: "users", label: "Users", icon: "👥", roles: ["admin"] },
    { id: "stations", label: "Other Stations", icon: "🏢", comingSoon: true },
  ];

  // Filter items based on user role
  const filteredItems = sidebarItems.filter(
    (item) => !item.roles || item.roles.includes(user.role),
  );

  const handlePageChange = (pageId) => {
    onPageChange(pageId);
    setIsOpen(false);
    // restore the toggle visibility after leaving sidebar
    setShowToggle(sidebarCollapsibleOnDesktop());
  };

  const toggleSidebar = () => {
    // When opening via toggle, hide the toggle button immediately.
    // When closing (if toggle still visible), restore according to viewport.
    if (!isOpen) {
      setIsOpen(true);
      setShowToggle(false);
    } else {
      setIsOpen(false);
      setShowToggle(sidebarCollapsibleOnDesktop());
    }
  };

  const closeSidebar = () => {
    setIsOpen(false);
    // show the toggle again when leaving the sidebar (respect viewport)
    setShowToggle(sidebarCollapsibleOnDesktop());
  };

  // Don't show sidebar if no items to display
  if (filteredItems.length === 0) {
    return null;
  }

  return (
    <>
      {/* Toggle Button - show only when sidebarCollapsibleOnDesktop() and not hidden after first click */}
      {showToggle && (
        <button
          className={`sidebar-toggle ${isOpen ? "open" : ""}`}
          onClick={toggleSidebar}
          aria-label={isOpen ? "Close options" : "Open options"}
          title={isOpen ? "Close options" : "Open options"}
          style={
            togglePos
              ? {
                  position: "fixed",
                  top: `${togglePos.top}px`,
                  right: `${togglePos.right}px`,
                  width: "36px",
                  height: "36px",
                }
              : undefined
          }
        >
          <span className="toggle-icon">&lt;</span>
        </button>
      )}

      {/* Overlay - Click to close */}
      {isOpen && <div className="sidebar-overlay" onClick={closeSidebar}></div>}

      {/* Sidebar */}
      <aside className={`sidebar ${isOpen ? "open" : ""}`}>
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
            {user.role === "admin" ? "👤" : "👨"}
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
              {filteredItems.map((item) => (
                <li key={item.id}>
                  <button
                    className={`nav-item ${
                      currentPage === item.id ? "active" : ""
                    } ${item.comingSoon ? "coming-soon" : ""}`}
                    onClick={() =>
                      !item.comingSoon && handlePageChange(item.id)
                    }
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
          <button
            className="logout-button"
            onClick={() => {
              // ensure sidebar closes and toggle returns when user logs out
              onLogout();
              closeSidebar();
            }}
          >
            <span className="nav-icon">🚪</span>
            <span className="nav-label">Logout</span>
          </button>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
