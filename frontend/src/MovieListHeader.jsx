import { useState, useRef, useEffect } from 'react';

export default function MovieListHeader({
  lists,
  activeList,
  onListChange,
  searchQuery,
  onSearchChange,
  showForm,
  onToggleForm,
  onImport,
  onLogout,
  hideCatalogActions,
}) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
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

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-3xl mx-auto px-2 sm:px-6 py-2 sm:py-4 flex items-center justify-between flex-nowrap min-w-0">
        {/* Left: dropdown + title */}
        <div className="flex items-center gap-1 sm:gap-3 shrink-0">
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setDropdownOpen((o) => !o)}
              className="flex items-center gap-0.5 sm:gap-1.5 px-1.5 sm:px-3 py-1 sm:py-1.5 rounded-lg text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-100 transition-colors cursor-pointer whitespace-nowrap"
            >
              {activeLabel}
              <svg
                className={`w-3 h-3 sm:w-4 sm:h-4 text-gray-400 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
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
                      onListChange(list.key);
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
          <h1 className="text-xs sm:text-base font-serif font-bold whitespace-nowrap" style={{ color: '#d2b48c' }}>
            MojoDojo MovieQ
          </h1>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <div className="relative">
            <svg className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-3 h-3 sm:w-4 sm:h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-20 sm:w-48 pl-6 sm:pl-9 pr-2 sm:pr-3 py-1 sm:py-1.5 border border-gray-300 rounded-full bg-gray-50 text-xs sm:text-sm text-black placeholder:text-gray-400 focus:outline-none focus:border-black transition-colors"
            />
          </div>
          {!hideCatalogActions && (
            <>
              <button
                onClick={onImport}
                className="px-2 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-medium cursor-pointer text-white transition-colors whitespace-nowrap"
                style={{ backgroundColor: '#d2b48c' }}
                onMouseEnter={(e) => (e.target.style.backgroundColor = '#c4a67a')}
                onMouseLeave={(e) => (e.target.style.backgroundColor = '#d2b48c')}
                data-testid="import-btn"
              >
                Import
              </button>
              <button
                onClick={onToggleForm}
                className="px-2 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-medium cursor-pointer text-white transition-colors whitespace-nowrap"
                style={{ backgroundColor: '#d2b48c' }}
                onMouseEnter={(e) => (e.target.style.backgroundColor = '#c4a67a')}
                onMouseLeave={(e) => (e.target.style.backgroundColor = '#d2b48c')}
              >
                {showForm ? 'Cancel' : 'Add Movie'}
              </button>
            </>
          )}
          <button
            onClick={onLogout}
            className="px-2 sm:px-4 py-1 sm:py-2 rounded-full text-xs sm:text-sm font-medium cursor-pointer text-black border border-gray-300 hover:bg-gray-100 transition-colors whitespace-nowrap"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}
