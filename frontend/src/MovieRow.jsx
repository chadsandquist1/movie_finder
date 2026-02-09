import { forwardRef, useState, useRef, useEffect } from 'react';

const statusLabels = {
  active: 'My List',
  recentlyWatched: 'Watched',
  notInterested: 'Not Interested',
};

const statusKeys = Object.keys(statusLabels);

const MovieRow = forwardRef(function MovieRow(
  { movie, displayOrder, onStatusChange, onMoveUp, onMoveDown, onMoveToTop, onMoveToBottom, onEdit, isFirst, isLast, style },
  ref,
) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  return (
    <div
      ref={ref}
      className="flex items-center gap-3 py-4 px-5"
      style={{ transition: 'transform 350ms ease-out', ...style }}
    >
      {/* Reorder arrows */}
      <div className="flex flex-col shrink-0">
        <button
          onClick={onMoveUp}
          disabled={isFirst}
          className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-default cursor-pointer p-0.5 transition-colors"
          aria-label="Move up"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          onClick={onMoveDown}
          disabled={isLast}
          className="text-gray-300 hover:text-gray-600 disabled:opacity-20 disabled:cursor-default cursor-pointer p-0.5 transition-colors"
          aria-label="Move down"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      <span className="text-2xl font-serif font-bold text-gray-300 w-8 shrink-0 text-right">
        {displayOrder}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-black leading-tight">
            {movie.title}
          </h2>
          <span className="text-sm text-gray-400">{movie.year}</span>
        </div>
        <div className="flex items-center gap-3 mt-1">
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {movie.genre}
          </span>
          <span className="text-sm text-gray-500">
            {movie.director}
          </span>
        </div>
      </div>
      <select
        value={movie.status}
        onChange={(e) => onStatusChange(movie, e.target.value)}
        className="text-xs px-2 py-1 border border-gray-200 rounded-lg bg-gray-50 text-gray-600 focus:outline-none focus:border-black transition-colors cursor-pointer shrink-0"
      >
        {statusKeys.map((key) => (
          <option key={key} value={key}>{statusLabels[key]}</option>
        ))}
      </select>
      <span className="text-sm font-semibold text-black shrink-0">
        {movie.rating}<span className="text-gray-400 font-normal">/10</span>
      </span>

      {/* Kebab menu */}
      <div className="relative shrink-0" ref={menuRef}>
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          aria-label="More options"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <circle cx="10" cy="4" r="1.5" />
            <circle cx="10" cy="10" r="1.5" />
            <circle cx="10" cy="16" r="1.5" />
          </svg>
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            <button
              onClick={() => { setMenuOpen(false); onMoveToTop?.(); }}
              disabled={isFirst}
              className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default"
            >
              Move to Top
            </button>
            <button
              onClick={() => { setMenuOpen(false); onMoveToBottom?.(); }}
              disabled={isLast}
              className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-default"
            >
              Move to Bottom
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => { setMenuOpen(false); onEdit?.(); }}
              className="w-full text-left px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
});

export default MovieRow;
