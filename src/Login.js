import { useState } from "react";
import "./Login.css";
import PropTypes from "prop-types";

function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    // Simple validation
    if (!email || !password) {
      setError("Please fill in all fields");
      return;
    }

    // Demo authentication (we'll replace this with Supabase later)
    if (email === "admin@pv.com" && password === "admin123") {
      onLogin({ email, role: "admin", name: "Admin User" });
    } else if (email === "user@pv.com" && password === "user123") {
      onLogin({ email, role: "user", name: "Regular User" });
    } else {
      setError("Invalid email or password");
    }
  };

  const handleDemoLogin = (role) => {
    if (role === "admin") {
      setEmail("admin@pv.com");
      setPassword("admin123");
    } else {
      setEmail("user@pv.com");
      setPassword("user123");
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div className="login-header">
          <div className="logo-large">⚡</div>
          <h1>PV Station Monitor</h1>
          <p>Sign in to access your dashboard</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="login-btn">
            Sign In
          </button>
        </form>

        <div className="demo-accounts">
          <p className="demo-title">Demo Accounts (Click to fill):</p>
          <div className="demo-buttons">
            <button
              onClick={() => handleDemoLogin("admin")}
              className="demo-btn admin"
            >
              👤 Admin Demo
            </button>
            <button
              onClick={() => handleDemoLogin("user")}
              className="demo-btn user"
            >
              👤 User Demo
            </button>
          </div>
          <div className="demo-info">
            <small>
              <strong>Admin:</strong> admin@pv.com / admin123
              <br />
              <strong>User:</strong> user@pv.com / user123
            </small>
          </div>
        </div>

        <div className="login-footer">
          <p>© 2025 PV Station Monitor. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

// add prop types
Login.propTypes = {
  onLogin: PropTypes.func.isRequired,
};

export default Login;
