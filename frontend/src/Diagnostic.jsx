import { useState, useEffect, useRef } from 'react';
import { fetchConfig, login, invokeLambda } from './awsClients';
import { subscribe, clearLogs } from './logger';

export default function Diagnostic() {
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [moviesJson, setMoviesJson] = useState(null);
  const logEndRef = useRef(null);

  useEffect(() => subscribe(setLogs), []);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    fetchConfig()
      .then(setConfig)
      .catch((err) => setConfigError(err.message));
  }, []);

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await login(config, username, password);
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
      await invokeLambda(config, session.credentials);
    } catch (err) {
      // error already in log panel
    } finally {
      setLoading(false);
    }
  };

  const handleGetMovies = async () => {
    setLoading(true);
    setMoviesJson(null);
    try {
      const payload = await invokeLambda(config, session.credentials, config.movieqListFunctionName);
      const parsed = JSON.parse(payload);
      const body = typeof parsed.body === 'string' ? JSON.parse(parsed.body) : parsed.body;
      setMoviesJson(JSON.stringify(body, null, 2));
    } catch (err) {
      // error already in log panel
    } finally {
      setLoading(false);
    }
  };

  const loggedIn = session !== null;
  const ready = config !== null;

  if (configError) {
    return (
      <div className="app min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/cinema-background-heavy.jpg')" }}>
        <h1>Movie Finder - Diagnostic</h1>
        <section className="panel">
          <p className="error-text">Failed to load config: {configError}</p>
          <p>For local dev, place a <code>config.json</code> in <code>frontend/public/</code>.</p>
        </section>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="app min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/cinema-background-heavy.jpg')" }}>
        <h1>Movie Finder - Diagnostic</h1>
        <section className="panel"><p>Loading config...</p></section>
      </div>
    );
  }

  return (
    <div className="app min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/cinema-background-heavy.jpg')" }}>
      <h1>Movie Finder - Diagnostic</h1>

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
          <button onClick={handleGetMovies} disabled={!loggedIn || loading}>
            Get Movies
          </button>
          <button onClick={clearLogs} disabled={loading}>
            Clear Logs
          </button>
        </div>
      </section>

      {moviesJson && (
        <section className="panel">
          <h2>Movies JSON</h2>
          <pre style={{ maxHeight: '400px', overflow: 'auto', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{moviesJson}</pre>
        </section>
      )}

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
