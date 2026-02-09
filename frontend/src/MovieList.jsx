import { useState, useRef, useEffect } from 'react';
import { generateKeyBetween } from 'fractional-indexing';
import { invokeLambda } from './awsClients';
import MovieRow from './MovieRow';

const lists = [
  { key: 'active', label: 'My List' },
  { key: 'recentlyWatched', label: 'Recently Watched' },
  { key: 'notInterested', label: 'Not Interested' },
];

const emptyForm = { title: '', year: '', genre: '', rating: '', director: '', status: 'active' };

export default function MovieList({ movies, config, credentials, onRefresh, onLogout }) {
  const [activeList, setActiveList] = useState('active');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const activeLabel = lists.find((l) => l.key === activeList)?.label;
  const filtered = movies
    .filter((m) => m.status === activeList)
    .sort((a, b) => a.rank.localeCompare(b.rank));

  const handleAdd = async () => {
    setSaving(true);
    try {
      // Compute rank after the last movie in the target status list
      const targetList = movies
        .filter((m) => m.status === form.status)
        .sort((a, b) => a.rank.localeCompare(b.rank));
      const lastRank = targetList.length > 0 ? targetList[targetList.length - 1].rank : null;
      const rank = generateKeyBetween(lastRank, null);

      await invokeLambda(config, credentials, config.movieqWriteFunctionName, {
        rank,
        title: form.title,
        year: Number(form.year),
        genre: form.genre,
        rating: Number(form.rating),
        director: form.director,
        status: form.status,
      });

      setForm(emptyForm);
      setShowForm(false);
      await onRefresh();
    } catch (err) {
      // error visible in SDK log panel
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (movie, newStatus) => {
    if (newStatus === movie.status) return;
    try {
      // Compute rank at end of the target list
      const targetList = movies
        .filter((m) => m.status === newStatus)
        .sort((a, b) => a.rank.localeCompare(b.rank));
      const lastRank = targetList.length > 0 ? targetList[targetList.length - 1].rank : null;
      const rank = generateKeyBetween(lastRank, null);

      await invokeLambda(config, credentials, config.movieqWriteFunctionName, {
        movie_id: movie.movie_id,
        status: newStatus,
        rank,
      });

      await onRefresh();
    } catch (err) {
      // error visible in SDK log panel
    }
  };

  const formValid = form.title && form.year && form.genre && form.rating && form.director;

  return (
    <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/cinema-background-heavy.jpg')" }}>
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center justify-between">
          {/* Left: dropdown + title */}
          <div className="flex items-center gap-3">
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen((o) => !o)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer"
              >
                {activeLabel}
                <svg
                  className={`w-4 h-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="absolute left-0 top-full mt-1 w-52 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                  {lists.map((list) => (
                    <button
                      key={list.key}
                      onClick={() => {
                        setActiveList(list.key);
                        setDropdownOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm cursor-pointer transition-colors ${
                        activeList === list.key
                          ? 'bg-gray-100 text-black font-medium'
                          : 'text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {list.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="text-gray-300 select-none">|</span>
            <h1 className="text-base font-serif font-bold" style={{ color: '#d2b48c' }}>
              MojoDojo MovieQ
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowForm((v) => !v)}
              className="px-4 py-2 rounded-full text-sm font-medium cursor-pointer text-white transition-colors"
              style={{ backgroundColor: '#d2b48c' }}
              onMouseEnter={(e) => (e.target.style.backgroundColor = '#c4a67a')}
              onMouseLeave={(e) => (e.target.style.backgroundColor = '#d2b48c')}
            >
              {showForm ? 'Cancel' : 'Add Movie'}
            </button>
            <button
              onClick={onLogout}
              className="px-4 py-2 rounded-full text-sm font-medium cursor-pointer text-black border border-gray-300 hover:bg-gray-100 transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Add Movie Form */}
      {showForm && (
        <div className="max-w-3xl mx-auto px-4 pt-6">
          <div className="bg-white rounded-2xl shadow-2xl p-6">
            <h2 className="text-lg font-semibold text-black mb-4">Add Movie</h2>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                placeholder="Title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-black text-sm placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors"
              />
              <input
                type="number"
                placeholder="Year"
                value={form.year}
                onChange={(e) => setForm({ ...form, year: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-black text-sm placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors"
              />
              <input
                type="text"
                placeholder="Genre"
                value={form.genre}
                onChange={(e) => setForm({ ...form, genre: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-black text-sm placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors"
              />
              <input
                type="number"
                step="0.1"
                placeholder="Rating (0-10)"
                value={form.rating}
                onChange={(e) => setForm({ ...form, rating: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-black text-sm placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors"
              />
              <input
                type="text"
                placeholder="Director"
                value={form.director}
                onChange={(e) => setForm({ ...form, director: e.target.value })}
                className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-black text-sm placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors"
              />
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-black text-sm focus:outline-none focus:border-black transition-colors"
              >
                {lists.map((list) => (
                  <option key={list.key} value={list.key}>{list.label}</option>
                ))}
              </select>
            </div>
            <button
              onClick={handleAdd}
              disabled={!formValid || saving}
              className="mt-4 px-6 py-2 rounded-full text-sm font-medium cursor-pointer text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#d2b48c' }}
              onMouseEnter={(e) => !saving && formValid && (e.target.style.backgroundColor = '#c4a67a')}
              onMouseLeave={(e) => (e.target.style.backgroundColor = '#d2b48c')}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Movie List */}
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-2xl divide-y divide-gray-200">
          {filtered.length === 0 && (
            <p className="text-gray-400 text-sm py-8 text-center">No movies in this list.</p>
          )}
          {filtered.map((movie, index) => (
            <MovieRow key={movie.movie_id} movie={movie} displayOrder={index + 1} onStatusChange={handleStatusChange} />
          ))}
        </div>
      </main>
    </div>
  );
}
