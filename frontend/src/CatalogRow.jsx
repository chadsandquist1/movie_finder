import { useState, useRef, useEffect } from 'react';

const statusLabels = {
  active: 'My List',
  recentlyWatched: 'Watched',
  notInterested: 'Not Interested',
};

const toastMessages = {
  active: 'Added to My List',
  recentlyWatched: 'Added to Watched',
  notInterested: 'Added to Not Interested',
};

const badgeColors = {
  active: 'bg-blue-100 text-blue-700',
  recentlyWatched: 'bg-green-100 text-green-700',
  notInterested: 'bg-gray-200 text-gray-600',
};

export default function CatalogRow({ movie, queuedStatus, onAddToQueue, onDeleteFromCatalog, onEdit }) {
  const [selectedStatus, setSelectedStatus] = useState('');
  const [toast, setToast] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
        setConfirmingDelete(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleChange = async (e) => {
    const value = e.target.value;
    if (!value) return;
    setSelectedStatus('');
    if (value === '_delete') {
      setConfirmingDelete(true);
      return;
    }
    await onAddToQueue(movie, value);
    setToast(toastMessages[value]);
    setTimeout(() => setToast(null), 500);
  };

  const handleConfirmDelete = async () => {
    setConfirmingDelete(false);
    await onDeleteFromCatalog(movie);
  };

  return (
    <div className="flex items-center gap-3 py-4 px-5 relative">
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-black leading-tight">
            {movie.title}
          </h2>
          <span className="text-sm text-gray-400">{movie.year}</span>
          {queuedStatus && !toast && (
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${badgeColors[queuedStatus]}`} data-testid="queue-badge">
              {statusLabels[queuedStatus]}
            </span>
          )}
          {toast && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700" data-testid="add-toast">
              {toast}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-1">
          {movie.genre && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
              {movie.genre}
            </span>
          )}
          {movie.director && (
            <span className="text-sm text-gray-500">
              {movie.director}
            </span>
          )}
        </div>
      </div>
      {movie.rating && (
        <span className="text-sm font-semibold text-black shrink-0">
          {Number(movie.rating).toFixed(1)}<span className="text-gray-400 font-normal">/10</span>
        </span>
      )}
      <select
        value={selectedStatus}
        onChange={handleChange}
        className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 focus:outline-none focus:border-black transition-colors cursor-pointer shrink-0"
        data-testid="add-to-select"
      >
        <option value="">Add to...</option>
        {Object.entries(statusLabels).map(([key, label]) => (
          <option key={key} value={key} disabled={queuedStatus === key}>
            {label}
          </option>
        ))}
        <option value="_delete" data-testid="delete-catalog-option">Delete from Catalog</option>
      </select>

      {/* Kebab menu */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => { setMenuOpen((o) => !o); setConfirmingDelete(false); }}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          aria-label="More options"
          data-testid="catalog-kebab"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="10" cy="4" r="1.5" />
            <circle cx="10" cy="10" r="1.5" />
            <circle cx="10" cy="16" r="1.5" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            <button
              onClick={() => { setMenuOpen(false); onEdit?.(movie); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors"
              data-testid="catalog-edit-btn"
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Delete confirmation popover */}
      {confirmingDelete && (
        <div className="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border border-gray-200 p-4 z-50" data-testid="delete-confirm">
          <p className="text-sm text-gray-700 mb-3">
            Delete <strong>{movie.title}</strong> from the catalog?
          </p>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setConfirmingDelete(false)}
              className="px-3 py-1 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
              data-testid="delete-cancel"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmDelete}
              className="px-3 py-1 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 cursor-pointer transition-colors"
              data-testid="delete-confirm-btn"
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
