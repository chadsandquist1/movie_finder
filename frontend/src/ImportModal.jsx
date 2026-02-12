import { useState, useEffect } from 'react';
import { generateKeyBetween } from 'fractional-indexing';
import { apiCall } from './awsClients';
import titleSimilarity from './titleSimilarity';

const PAGE_SIZE = 30;
const CATALOG_PAGE_SIZE = 100;

export default function ImportModal({ isOpen, onClose, movies, config, idToken, username, onImportComplete }) {
  const [mode, setMode] = useState('browse'); // browse | manual
  const [step, setStep] = useState('input'); // input | preview | done
  const [imdbInput, setImdbInput] = useState('');
  const [fetching, setFetching] = useState(false);
  const [importing, setImporting] = useState(false);
  const [fetchedMovies, setFetchedMovies] = useState([]);
  const [selected, setSelected] = useState({});
  const [errors, setErrors] = useState([]);
  const [duplicates, setDuplicates] = useState({});
  const [importResult, setImportResult] = useState(null);
  const [page, setPage] = useState(0);

  // Browse catalog state
  const [catalogMovies, setCatalogMovies] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [catalogSelected, setCatalogSelected] = useState({});
  const [catalogPage, setCatalogPage] = useState(0);

  // Fetch catalog when modal opens in browse mode
  useEffect(() => {
    if (isOpen && mode === 'browse' && !catalogLoaded) {
      fetchCatalog();
    }
  }, [isOpen, mode]);

  const fetchCatalog = async () => {
    setCatalogLoading(true);
    try {
      const data = await apiCall(config.apiBaseUrl, idToken, 'GET', '/movies');
      setCatalogMovies(data.movies || []);
      setCatalogLoaded(true);
      setCatalogPage(0);
      setCatalogSelected({});
    } catch (err) {
      // error visible in console
    } finally {
      setCatalogLoading(false);
    }
  };

  if (!isOpen) return null;

  // Filter catalog to only movies NOT in user's queue
  const queuedIds = new Set(movies.map((m) => m.movie_id));
  const availableCatalog = catalogMovies
    .filter((m) => !queuedIds.has(m.movie_id))
    .sort((a, b) => (b.year || 0) - (a.year || 0));
  const catalogTotalPages = Math.max(1, Math.ceil(availableCatalog.length / CATALOG_PAGE_SIZE));
  const catalogPageMovies = availableCatalog.slice(
    catalogPage * CATALOG_PAGE_SIZE,
    (catalogPage + 1) * CATALOG_PAGE_SIZE
  );
  const catalogSelectedCount = Object.values(catalogSelected).filter(Boolean).length;

  const parseImdbIds = (text) => {
    return text
      .split(/[\s,]+/)
      .map((s) => s.trim())
      .filter((s) => s.startsWith('tt'));
  };

  const handleFetch = async () => {
    const ids = parseImdbIds(imdbInput);
    if (ids.length === 0) return;

    setFetching(true);
    setErrors([]);
    try {
      const data = await apiCall(config.apiBaseUrl, idToken, 'POST', '/movies/omdb_lookup', { imdb_ids: ids });

      const fetched = data.movies || [];
      setFetchedMovies(fetched);
      setErrors(data.errors || []);

      // Duplicate detection
      const dupeMap = {};
      const selectionMap = {};
      for (const movie of fetched) {
        let isDuplicate = false;
        let duplicateOf = '';
        for (const existing of movies) {
          const sim = titleSimilarity(movie.title, existing.title);
          const sameYear = Number(movie.year) === Number(existing.year);
          if (sim >= 0.90 && sameYear) {
            isDuplicate = true;
            duplicateOf = existing.title;
            break;
          }
        }
        if (isDuplicate) {
          dupeMap[movie.imdb_id] = duplicateOf;
          selectionMap[movie.imdb_id] = false;
        } else {
          selectionMap[movie.imdb_id] = true;
        }
      }
      setDuplicates(dupeMap);
      setSelected(selectionMap);
      setPage(0);
      setStep('preview');
    } catch (err) {
      setErrors([{ error: err.message }]);
    } finally {
      setFetching(false);
    }
  };

  const handleImport = async () => {
    const selectedMovies = fetchedMovies.filter((m) => selected[m.imdb_id]);
    if (selectedMovies.length === 0) return;

    setImporting(true);
    try {
      const activeMovies = movies
        .filter((m) => m.status === 'active')
        .sort((a, b) => a.rank.localeCompare(b.rank));
      let lastRank = activeMovies.length > 0 ? activeMovies[activeMovies.length - 1].rank : null;

      const now = new Date().toISOString();
      const moviesToWrite = selectedMovies.map((m) => {
        const rank = generateKeyBetween(lastRank, null);
        lastRank = rank;
        return {
          title: m.title,
          year: Number(m.year),
          genre: m.genre || '',
          rating: m.rating || 0,
          director: m.director || '',
          status: 'active',
          rank,
          importedFrom: 'omdb',
          importedDate: now,
        };
      });

      const data = await apiCall(config.apiBaseUrl, idToken, 'POST', `/users/${encodeURIComponent(username)}/queue/batch`, { movies: moviesToWrite });

      setImportResult({ count: selectedMovies.length, message: data.message });
      setStep('done');
    } catch (err) {
      setErrors([{ error: err.message }]);
    } finally {
      setImporting(false);
    }
  };

  const handleCatalogImport = async () => {
    const moviesToAdd = availableCatalog.filter((m) => catalogSelected[m.movie_id]);
    if (moviesToAdd.length === 0) return;

    setImporting(true);
    try {
      const activeMovies = movies
        .filter((m) => m.status === 'active')
        .sort((a, b) => a.rank.localeCompare(b.rank));
      let lastRank = activeMovies.length > 0 ? activeMovies[activeMovies.length - 1].rank : null;

      const now = new Date().toISOString();
      const moviesToWrite = moviesToAdd.map((m) => {
        const rank = generateKeyBetween(lastRank, null);
        lastRank = rank;
        return {
          movie_id: m.movie_id,
          title: m.title,
          year: Number(m.year),
          genre: m.genre || '',
          rating: m.rating || 0,
          director: m.director || '',
          status: 'active',
          rank,
          importedFrom: 'catalog',
          importedDate: now,
        };
      });

      const data = await apiCall(config.apiBaseUrl, idToken, 'POST', `/users/${encodeURIComponent(username)}/queue/batch`, { movies: moviesToWrite });

      setImportResult({ count: moviesToAdd.length, message: data.message });
      setMode('browse');
      setStep('done');
    } catch (err) {
      setErrors([{ error: err.message }]);
    } finally {
      setImporting(false);
    }
  };

  const handleDone = () => {
    setStep('input');
    setMode('browse');
    setImdbInput('');
    setFetchedMovies([]);
    setSelected({});
    setErrors([]);
    setDuplicates({});
    setImportResult(null);
    setPage(0);
    setCatalogSelected({});
    setCatalogPage(0);
    setCatalogLoaded(false);
    onImportComplete();
    onClose();
  };

  const handleBack = () => {
    setStep('input');
    setFetchedMovies([]);
    setSelected({});
    setErrors([]);
    setDuplicates({});
    setPage(0);
  };

  const selectedCount = Object.values(selected).filter(Boolean).length;
  const totalPages = Math.ceil(fetchedMovies.length / PAGE_SIZE);
  const pageMovies = fetchedMovies.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleSelectAll = () => {
    const newSelected = {};
    for (const m of fetchedMovies) {
      newSelected[m.imdb_id] = true;
    }
    setSelected(newSelected);
  };

  const handleDeselectAll = () => {
    const newSelected = {};
    for (const m of fetchedMovies) {
      newSelected[m.imdb_id] = false;
    }
    setSelected(newSelected);
  };

  const handleCatalogSelectAll = () => {
    const newSelected = {};
    for (const m of catalogPageMovies) {
      newSelected[m.movie_id] = true;
    }
    setCatalogSelected((prev) => ({ ...prev, ...newSelected }));
  };

  const handleCatalogDeselectAll = () => {
    setCatalogSelected({});
  };

  const switchToManual = () => {
    setMode('manual');
    setStep('input');
  };

  const switchToBrowse = () => {
    setMode('browse');
    setStep('input');
    if (!catalogLoaded) fetchCatalog();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-serif font-bold text-black">
            {step === 'done' ? 'Import Complete' : 'Import Movies'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 cursor-pointer text-xl leading-none"
            data-testid="import-close"
          >
            &times;
          </button>
        </div>

        {/* Mode tabs (only in input step) */}
        {step === 'input' && (
          <div className="flex border-b border-gray-200 px-6">
            <button
              onClick={switchToBrowse}
              className={`px-4 py-2 text-sm font-medium cursor-pointer border-b-2 transition-colors ${
                mode === 'browse'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              data-testid="browse-tab"
            >
              Browse Catalog
            </button>
            <button
              onClick={switchToManual}
              className={`px-4 py-2 text-sm font-medium cursor-pointer border-b-2 transition-colors ${
                mode === 'manual'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              data-testid="manual-tab"
            >
              IMDb IDs
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Browse catalog mode */}
          {mode === 'browse' && step === 'input' && (
            <div>
              {catalogLoading && (
                <p className="text-gray-400 text-sm py-8 text-center">Loading catalog...</p>
              )}
              {catalogLoaded && availableCatalog.length === 0 && (
                <p className="text-gray-400 text-sm py-8 text-center">All catalog movies are already in your queue.</p>
              )}
              {catalogLoaded && availableCatalog.length > 0 && (
                <>
                  <p className="text-xs text-gray-500 mb-3">
                    {availableCatalog.length} movies not in your queue, sorted by year
                  </p>
                  <div className="space-y-1">
                    {catalogPageMovies.map((movie) => (
                      <label
                        key={movie.movie_id}
                        className="flex items-start gap-3 py-2 px-2 rounded hover:bg-gray-50 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={!!catalogSelected[movie.movie_id]}
                          onChange={(e) => setCatalogSelected((prev) => ({ ...prev, [movie.movie_id]: e.target.checked }))}
                          className="mt-1 cursor-pointer"
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-black">
                            {movie.title} ({movie.year})
                          </span>
                          {(movie.genre || movie.director) && (
                            <span className="text-xs text-gray-500 ml-2">
                              {[movie.genre, movie.director].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </div>
                        {movie.rating ? (
                          <span className="text-xs text-gray-500 shrink-0">{Number(movie.rating).toFixed(1)}/10</span>
                        ) : null}
                      </label>
                    ))}
                  </div>

                  {catalogTotalPages > 1 && (
                    <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-600">
                      <button
                        onClick={() => setCatalogPage((p) => Math.max(0, p - 1))}
                        disabled={catalogPage === 0}
                        className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        Prev
                      </button>
                      <span>Page {catalogPage + 1} of {catalogTotalPages}</span>
                      <button
                        onClick={() => setCatalogPage((p) => Math.min(catalogTotalPages - 1, p + 1))}
                        disabled={catalogPage >= catalogTotalPages - 1}
                        className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Manual IMDb ID mode */}
          {mode === 'manual' && step === 'input' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Enter IMDb IDs (one per line or comma-separated)
              </label>
              <textarea
                value={imdbInput}
                onChange={(e) => setImdbInput(e.target.value)}
                placeholder="tt3896198&#10;tt0111161&#10;tt0068646"
                className="w-full h-40 px-3 py-2 border border-gray-300 rounded-lg text-sm text-black placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors resize-none"
                data-testid="imdb-input"
              />
              {errors.length > 0 && (
                <div className="mt-2 text-red-600 text-sm">
                  {errors.map((e, i) => (
                    <p key={i}>{e.imdb_id ? `${e.imdb_id}: ${e.error}` : e.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div>
              <div className="space-y-1">
                {pageMovies.map((movie) => (
                  <label
                    key={movie.imdb_id}
                    className="flex items-start gap-3 py-2 px-2 rounded hover:bg-gray-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={!!selected[movie.imdb_id]}
                      onChange={(e) => setSelected((prev) => ({ ...prev, [movie.imdb_id]: e.target.checked }))}
                      className="mt-1 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-black">
                        {movie.title} ({movie.year})
                      </span>
                      {movie.genre || movie.director ? (
                        <span className="text-xs text-gray-500 ml-2">
                          {[movie.genre, movie.director].filter(Boolean).join(' · ')}
                        </span>
                      ) : null}
                      {duplicates[movie.imdb_id] && (
                        <span className="block text-xs text-amber-600 mt-0.5" data-testid="duplicate-badge">
                          Duplicate of {duplicates[movie.imdb_id]}
                        </span>
                      )}
                    </div>
                  </label>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-4 mt-4 text-sm text-gray-600">
                  <button
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                    disabled={page === 0}
                    className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Prev
                  </button>
                  <span>Page {page + 1} of {totalPages}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                    disabled={page === totalPages - 1}
                    className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}

              {errors.length > 0 && (
                <div className="mt-3 text-red-600 text-sm">
                  {errors.map((e, i) => (
                    <p key={i}>{e.imdb_id}: {e.error}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {step === 'done' && (
            <div className="text-center py-8">
              <p className="text-lg font-medium text-black" data-testid="import-success">
                Imported {importResult?.count} movies!
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
          {/* Browse catalog footer */}
          {mode === 'browse' && step === 'input' && catalogLoaded && availableCatalog.length > 0 && (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCatalogSelectAll}
                  className="px-3 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Select Page
                </button>
                <button
                  onClick={handleCatalogDeselectAll}
                  className="px-3 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
              <button
                onClick={handleCatalogImport}
                disabled={importing || catalogSelectedCount === 0}
                className="px-5 py-2 rounded-full text-sm font-medium cursor-pointer text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#d2b48c' }}
                data-testid="catalog-import-button"
              >
                {importing ? 'Adding...' : `Add to My List (${catalogSelectedCount})`}
              </button>
            </>
          )}

          {/* Browse catalog footer - empty/loading state */}
          {mode === 'browse' && step === 'input' && (!catalogLoaded || availableCatalog.length === 0) && (
            <div />
          )}

          {/* Manual input footer */}
          {mode === 'manual' && step === 'input' && (
            <>
              <div />
              <button
                onClick={handleFetch}
                disabled={fetching || parseImdbIds(imdbInput).length === 0}
                className="px-5 py-2 rounded-full text-sm font-medium cursor-pointer text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#d2b48c' }}
                data-testid="fetch-button"
              >
                {fetching ? 'Fetching...' : 'Fetch'}
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBack}
                  className="px-4 py-2 rounded-full text-sm font-medium cursor-pointer text-black border border-gray-300 hover:bg-gray-100 transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSelectAll}
                  className="px-3 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Select All
                </button>
                <button
                  onClick={handleDeselectAll}
                  className="px-3 py-1.5 rounded text-xs text-gray-600 hover:bg-gray-100 cursor-pointer"
                >
                  Deselect All
                </button>
              </div>
              <button
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
                className="px-5 py-2 rounded-full text-sm font-medium cursor-pointer text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#d2b48c' }}
                data-testid="import-button"
              >
                {importing ? 'Importing...' : `Import Selected (${selectedCount})`}
              </button>
            </>
          )}

          {step === 'done' && (
            <>
              <div />
              <button
                onClick={handleDone}
                className="px-5 py-2 rounded-full text-sm font-medium cursor-pointer text-white transition-colors"
                style={{ backgroundColor: '#d2b48c' }}
                data-testid="done-button"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
