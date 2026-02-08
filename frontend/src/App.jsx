import { useState, useEffect, useRef } from 'react';
import { login, invokeLambda } from './awsClients';
import { subscribe, clearLogs } from './logger';

export default function App() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);

  useEffect(() => subscribe(setLogs), []);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await login(username, password);
      setSession(result);
    } catch (err) {
      // error already in log panel
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setSession(null);
  };

  const handleInvoke = async () => {
    setLoading(true);
    try {
      await invokeLambda(session.credentials);
    } catch (err) {
      // error already in log panel
    } finally {
      setLoading(false);
    }
  };

  const loggedIn = session !== null;

  return (
    <div className="app">
      <h1>Movie Finder</h1>

      <section className="panel">
        <h2>Credentials</h2>
        <div className="form-row">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loggedIn}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loggedIn}
          />
        </div>
      </section>

      <section className="panel">
        <h2>Actions</h2>
        <div className="form-row">
          <button onClick={handleLogin} disabled={loggedIn || loading}>
            Login
          </button>
          <button onClick={handleLogout} disabled={!loggedIn || loading}>
            Logout
          </button>
          <button onClick={handleInvoke} disabled={!loggedIn || loading}>
            Invoke Lambda
          </button>
          <button onClick={clearLogs} disabled={loading}>
            Clear Logs
          </button>
        </div>
      </section>

      <section className="panel log-panel">
        <h2>SDK Log</h2>
        <div className="log-entries">
          {logs.length === 0 && (
            <p className="empty">No SDK calls yet.</p>
          )}
          {logs.map((entry) => (
            <div
              key={entry.id}
              className={`log-entry ${entry.success === true ? 'success' : ''} ${entry.success === false ? 'error' : ''} ${entry.success === null ? 'pending' : ''}`}
            >
              <div className="log-header">
                <span className="log-time">
                  {entry.timestamp.split('T')[1].split('.')[0]}
                </span>
                <span className="log-method">{entry.method}</span>
                <span className="log-duration">
                  {entry.durationMs !== null ? `${entry.durationMs}ms` : '...'}
                </span>
              </div>
              <details>
                <summary>Input</summary>
                <pre>{entry.input}</pre>
              </details>
              {entry.output && (
                <details>
                  <summary>Output</summary>
                  <pre>{entry.output}</pre>
                </details>
              )}
              {entry.error && (
                <details open>
                  <summary>Error</summary>
                  <pre className="error-text">{entry.error}</pre>
                </details>
              )}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </section>
    </div>
  );
}
