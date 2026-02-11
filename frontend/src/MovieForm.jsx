import { useState } from 'react';
import titleSimilarity from './titleSimilarity';

export default function MovieForm({ form, setForm, editing, onSave, saving, movies, lists }) {
  const [duplicateError, setDuplicateError] = useState(null);

  const handleChange = (updates) => {
    setDuplicateError(null);
    setForm({ ...form, ...updates });
  };

  const formValid = form.title && form.year;

  const handleSubmit = () => {
    // Duplicate detection on add (not edit)
    if (!editing) {
      const year = Number(form.year);
      for (const m of movies) {
        if (
          titleSimilarity(form.title, m.title) >= 0.90 &&
          Number(m.year) === year
        ) {
          setDuplicateError(
            `A similar movie already exists: ${m.title} (${m.year})`
          );
          return;
        }
      }
    }
    setDuplicateError(null);
    onSave();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 pt-6">
      <div className="bg-white rounded-2xl shadow-2xl p-6">
        <h2 className="text-lg font-semibold text-black mb-4">
          {editing ? 'Edit Movie' : 'Add Movie'}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Title"
            value={form.title}
            onChange={(e) => handleChange({ title: e.target.value })}
            className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-black text-sm placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors"
          />
          <input
            type="number"
            placeholder="Year"
            value={form.year}
            onChange={(e) => handleChange({ year: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-black text-sm placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors"
          />
          <input
            type="text"
            placeholder="Genre"
            value={form.genre}
            onChange={(e) => handleChange({ genre: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-black text-sm placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Rating (0-10)"
            value={form.rating}
            onChange={(e) => handleChange({ rating: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-black text-sm placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors"
          />
          <input
            type="text"
            placeholder="Director"
            value={form.director}
            onChange={(e) => handleChange({ director: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-black text-sm placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors"
          />
          <select
            value={form.status}
            onChange={(e) => handleChange({ status: e.target.value })}
            className="col-span-2 px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-black text-sm focus:outline-none focus:border-black transition-colors"
          >
            {lists.map((list) => (
              <option key={list.key} value={list.key}>
                {list.label}
              </option>
            ))}
          </select>
        </div>
        {duplicateError && (
          <p className="text-red-500 text-sm mt-2">{duplicateError}</p>
        )}
        <button
          onClick={handleSubmit}
          disabled={!formValid || saving}
          className="mt-4 px-6 py-2 rounded-full text-sm font-medium cursor-pointer text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ backgroundColor: '#d2b48c' }}
          onMouseEnter={(e) =>
            !saving && formValid && (e.target.style.backgroundColor = '#c4a67a')
          }
          onMouseLeave={(e) => (e.target.style.backgroundColor = '#d2b48c')}
        >
          {saving ? 'Saving...' : editing ? 'Update' : 'Save'}
        </button>
      </div>
    </div>
  );
}
