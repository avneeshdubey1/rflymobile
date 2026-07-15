import { useState } from "react";

const API = "http://localhost:5000";

function FlushPage() {
  const [password, setPassword] = useState("");
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const handleUnlock = (e) => {
    e.preventDefault();
    if (password === "flushit>") {
      setIsUnlocked(true);
    } else {
      alert("Invalid password");
    }
  };

  const handleRequest = async (endpoint, actionName) => {
    setStatusMsg(`Processing ${actionName}...`);
    try {
      const res = await fetch(`${API}${endpoint}`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMsg(`✅ Success: ${data.message}`);
      } else {
        setStatusMsg(`❌ Failed: ${data.message}`);
      }
    } catch (err) {
      console.error(err);
      setStatusMsg(`❌ Error: Could not reach server.`);
    }
  };

  if (!isUnlocked) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#0f172a', color: 'white' }}>
        <form onSubmit={handleUnlock} className="glass-card" style={{ padding: '3rem', textAlign: 'center', maxWidth: '400px', width: '100%' }}>
          <h2 style={{ marginBottom: '2rem' }}>Restricted Access</h2>
          <input 
            type="password" 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter password..." 
            style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)', background: 'rgba(255,255,255,0.05)', color: 'white', marginBottom: '1rem' }}
          />
          <button type="submit" className="submit-btn" style={{ width: '100%' }}>Unlock System</button>
        </form>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', minHeight: '100vh', color: 'white', background: '#0f172a' }}>
      <h1 style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem', marginBottom: '2rem' }}>System Data Management (/flush)</h1>
      
      <div style={{ marginBottom: '2rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', minHeight: '50px' }}>
        <strong>System Status:</strong> <span style={{ color: statusMsg.includes('❌') ? '#ef4444' : '#10b981' }}>{statusMsg || 'Awaiting command...'}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem', maxWidth: '800px' }}>
        
        <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>Leads</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Purge all leads</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="submit-btn" style={{ background: '#ef4444' }} onClick={() => handleRequest('/api/system/purge/leads', 'Purge Leads')}>Purge Leads</button>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>Assignments</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Purge all assignments (missions)</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="submit-btn" style={{ background: '#ef4444' }} onClick={() => handleRequest('/api/system/purge/assignments', 'Purge Assignments')}>Purge Assignments</button>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>Drones</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage drone fleet data</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="submit-btn" style={{ background: '#ef4444' }} onClick={() => handleRequest('/api/system/purge/drones', 'Purge Drones')}>Purge Drones</button>
            <button className="submit-btn" onClick={() => handleRequest('/api/system/populate/drones', 'Populate 27 Drones')}>Populate Drones</button>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3>Pilots (Users)</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Manage pilot data. (Admin/Sales/Fleet users are kept safe)</p>
          </div>
          <div style={{ display: 'flex', gap: '1rem' }}>
            <button className="submit-btn" style={{ background: '#ef4444' }} onClick={() => handleRequest('/api/system/purge/users', 'Purge Pilots')}>Purge Pilots</button>
            <button className="submit-btn" onClick={() => handleRequest('/api/system/populate/users', 'Populate 9 Pilots')}>Populate Pilots</button>
          </div>
        </div>

      </div>

      <div style={{ marginTop: '2rem' }}>
        <a href="/" style={{ color: 'var(--primary)', textDecoration: 'none' }}>&larr; Back to App</a>
      </div>
    </div>
  );
}

export default FlushPage;
