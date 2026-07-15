import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const API = "http://localhost:5000";

function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: email, password }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        login(data.user); // Save to context & localStorage
        
        // Redirect based on role
        if (data.user.role === 'admin') navigate("/admin");
        else if (data.user.role === 'sales') navigate("/marketing");
        else if (data.user.role === 'pilot') navigate("/pilot");
        else if (data.user.role === 'fleet-manager') navigate("/fleet-manager");
        else navigate("/");
      } else {
        setError(data.message || "Login failed");
      }
    } catch (err) {
      setError("Server error. Please try again.");
    }
  };

  return (
    <div className="login-container">
      <div className="glass-card login-card">
        <h1>Welcome Back</h1>
        <p className="subtitle">Login to your RFLY Dashboard</p>
        
        {error && <div className="alert error">{error}</div>}
        
        <form onSubmit={handleLogin} className="login-form">
          <div className="input-group">
            <label>Employee ID</label>
            <input
              type="text"
              placeholder="e.g. 40001"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <div className="input-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          
          <button type="submit" className="submit-btn login-submit">
            Login
          </button>
        </form>
        
        <div className="demo-credentials">
          <small>Demo Logins: Admin (10001) | Sales (40001) | Pilot (60001)</small>
          <small>Password: password123</small>
        </div>
      </div>
    </div>
  );
}

export default Login;