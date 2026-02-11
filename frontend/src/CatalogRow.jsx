import { useState } from 'react';

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

export default function CatalogRow({ movie, queuedStatus, onAddToQueue }) {
  const [selectedStatus, setSelectedStatus] = useState('');
  const [toast, setToast] = useState(null);

  const handleChange = async (e) => {
    const status = e.target.value;
    if (!status) return;
    setSelectedStatus('');
    await onAddToQueue(movie, status);
    setToast(toastMessages[status]);
    setTimeout(() => setToast(null), 500);
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
          {movie.rating}<span className="text-gray-400 font-normal">/10</span>
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
      </select>
    </div>
  );
}
