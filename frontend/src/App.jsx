import { useState, useEffect, useRef } from 'react';
import { fetchConfig, login, invokeLambda } from './awsClients';
import { subscribe, clearLogs } from './logger';
import { cn } from './lib/utils';
import MovieList from './MovieList';

export default function App() {
  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [session, setSession] = useState(null);
  const [movies, setMovies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
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

  const fetchMovies = async (creds) => {
    const payload = await invokeLambda(config, creds, config.movieqListFunctionName);
    const parsed = JSON.parse(payload);
    const body = typeof parsed.body === 'string' ? JSON.parse(parsed.body) : parsed.body;
    setMovies(body.movies || []);
  };

  const handleLogin = async () => {
    setLoading(true);
    try {
      const result = await login(config, username, password);
      setSession(result);
      await fetchMovies(result.credentials);
    } catch (err) {
      // error already in log panel
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setSession(null);
    setMovies([]);
  };

  const ready = config !== null;

  // After login, show the movie list page
  if (session) {
    return (
      <MovieList
        movies={movies}
        config={config}
        credentials={session.credentials}
        onRefresh={() => fetchMovies(session.credentials)}
        onLogout={handleLogout}
      />
    );
  }

  if (configError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat px-4" style={{ backgroundImage: "url('/cinema-background-heavy.jpg')" }}>
        <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-xl">
          <h1 className="text-7xl sm:text-8xl font-serif font-bold tracking-tight text-black leading-none mb-1">MojoDojo</h1>
          <h1 className="text-7xl sm:text-8xl font-serif font-bold tracking-tight text-black leading-none mb-8">MovieQ</h1>
          <p className="text-red-600 text-sm mb-2">Failed to load config: {configError}</p>
          <p className="text-gray-500 text-sm">
            For local dev, place a <code className="bg-gray-100 px-1 rounded text-gray-700">config.json</code> in <code className="bg-gray-100 px-1 rounded text-gray-700">frontend/public/</code>.
          </p>
        </div>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat px-4" style={{ backgroundImage: "url('/cinema-background-heavy.jpg')" }}>
        <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-xl">
          <h1 className="text-7xl sm:text-8xl font-serif font-bold tracking-tight text-black leading-none mb-1">MojoDojo</h1>
          <h1 className="text-7xl sm:text-8xl font-serif font-bold tracking-tight text-black leading-none mb-8">MovieQ</h1>
          <p className="text-gray-400 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center bg-no-repeat px-4" style={{ backgroundImage: "url('/cinema-background-heavy.jpg')" }}>
      <div className="bg-white rounded-2xl shadow-2xl p-10 sm:p-14 w-full max-w-xl">
        {/* Left-justified Medium-style title */}
        <h1 className="text-7xl sm:text-8xl font-serif font-bold tracking-tight text-black leading-none mb-1">MojoDojo</h1>
        <h1 className="text-7xl sm:text-8xl font-serif font-bold tracking-tight text-black leading-none mb-3">MovieQ</h1>
        <p className="text-gray-500 text-lg mb-10">Discover your next favorite film.</p>

        {/* Login form */}
        <div className="flex flex-col gap-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-full bg-gray-50 text-black text-sm placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !loading && handleLogin()}
            className="w-full px-4 py-3 border border-gray-300 rounded-full bg-gray-50 text-black text-sm placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors"
          />
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full px-4 py-3 rounded-full text-sm font-medium cursor-pointer text-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ backgroundColor: '#d2b48c' }}
            onMouseEnter={(e) => !loading && (e.target.style.backgroundColor = '#c4a67a')}
            onMouseLeave={(e) => (e.target.style.backgroundColor = '#d2b48c')}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </div>

        {/* SDK Log — collapsible */}
        {logs.length > 0 && (
          <div className="mt-10">
            <details>
              <summary className="text-xs text-gray-400 cursor-pointer hover:text-gray-600 select-none">
                SDK Log ({logs.length})
              </summary>
              <div className="mt-2 max-h-[300px] overflow-y-auto border border-gray-200 rounded-lg p-3 bg-gray-50">
                <button
                  onClick={clearLogs}
                  className="text-xs text-gray-400 hover:text-gray-600 cursor-pointer mb-2 block ml-auto"
                >
                  Clear
                </button>
                {logs.map((entry) => (
                  <div
                    key={entry.id}
                    className={cn(
                      'border-l-3 pl-3 py-2 mb-2 text-sm',
                      entry.success === true && 'border-l-green-500',
                      entry.success === false && 'border-l-red-500',
                      entry.success === null && 'border-l-yellow-500',
                      entry.success === undefined && 'border-l-gray-300'
                    )}
                  >
                    <div className="flex gap-4 items-center mb-1">
                      <span className="text-gray-400 font-mono text-xs">
                        {entry.timestamp.split('T')[1].split('.')[0]}
                      </span>
                      <span className="font-semibold text-gray-700">{entry.method}</span>
                      <span className="text-gray-400 text-xs ml-auto">
                        {entry.durationMs !== null ? `${entry.durationMs}ms` : '...'}
                      </span>
                    </div>
                    <details className="mt-1">
                      <summary className="cursor-pointer text-gray-400 text-xs">Input</summary>
                      <pre className="bg-white p-2 rounded mt-1 text-xs overflow-x-auto whitespace-pre-wrap break-all text-gray-600">{entry.input}</pre>
                    </details>
                    {entry.output && (
                      <details className="mt-1">
                        <summary className="cursor-pointer text-gray-400 text-xs">Output</summary>
                        <pre className="bg-white p-2 rounded mt-1 text-xs overflow-x-auto whitespace-pre-wrap break-all text-gray-600">{entry.output}</pre>
                      </details>
                    )}
                    {entry.error && (
                      <details open className="mt-1">
                        <summary className="cursor-pointer text-gray-400 text-xs">Error</summary>
                        <pre className="bg-white p-2 rounded mt-1 text-xs overflow-x-auto whitespace-pre-wrap break-all text-red-500">{entry.error}</pre>
                      </details>
                    )}
                  </div>
                ))}
                <div ref={logEndRef} />
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
}
