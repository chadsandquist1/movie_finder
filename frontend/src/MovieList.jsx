import { useState } from 'react';
import { generateKeyBetween } from 'fractional-indexing';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { invokeLambda } from './awsClients';
import SortableMovieRow, { MovieRowContent } from './MovieRow';
import MovieListHeader from './MovieListHeader';
import MovieForm from './MovieForm';
import SearchResults from './SearchResults';
import ImportModal from './ImportModal';
import CatalogRow from './CatalogRow';

const lists = [
  { key: 'active', label: 'My List' },
  { key: 'recentlyWatched', label: 'Recently Watched' },
  { key: 'notInterested', label: 'Not Interested' },
  { key: 'catalog', label: 'All Movies' },
];

const emptyForm = { title: '', year: '', genre: '', rating: '', director: '', status: 'active' };

export default function MovieList({ movies, config, credentials, username, onRefresh, onLogout }) {
  const [activeList, setActiveList] = useState('active');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [editing, setEditing] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [catalogMovies, setCatalogMovies] = useState([]);
  const [catalogQueued, setCatalogQueued] = useState({});
  const [catalogPage, setCatalogPage] = useState(0);
  const [catalogLoaded, setCatalogLoaded] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const isCatalog = activeList === 'catalog';

  const filtered = movies
    .filter((m) => m.status === activeList)
    .sort((a, b) => a.rank.localeCompare(b.rank));

  // Fetch catalog when switching to All Movies
  const fetchCatalog = async () => {
    try {
      const payload = await invokeLambda(config, credentials, config.movieqCatalogFunctionName, { username });
      const parsed = JSON.parse(payload);
      const data = typeof parsed.body === 'string' ? JSON.parse(parsed.body) : parsed.body;
      setCatalogMovies(data.movies || []);
      setCatalogQueued(data.queued || {});
      setCatalogLoaded(true);
      setCatalogPage(0);
    } catch (err) {
      // error visible in SDK log panel
    }
  };

  const handleListChange = (key) => {
    setActiveList(key);
    if (key === 'catalog' && !catalogLoaded) {
      fetchCatalog();
    }
  };

  const handleAddToQueue = async (movie, targetStatus) => {
    try {
      const targetList = movies
        .filter((m) => m.status === targetStatus)
        .sort((a, b) => a.rank.localeCompare(b.rank));
      const lastRank = targetList.length > 0 ? targetList[targetList.length - 1].rank : null;
      const rank = generateKeyBetween(lastRank, null);

      const payload = {
        username,
        movie_id: movie.movie_id,
        title: movie.title,
        year: movie.year,
        status: targetStatus,
        rank,
        importedFrom: 'catalog',
        importedDate: new Date().toISOString(),
      };
      if (movie.genre) payload.genre = movie.genre;
      if (movie.rating) payload.rating = movie.rating;
      if (movie.director) payload.director = movie.director;

      await invokeLambda(config, credentials, config.movieqWriteFunctionName, payload);
      await onRefresh();
      // Update catalog queued map
      setCatalogQueued((prev) => ({ ...prev, [movie.movie_id]: targetStatus }));
    } catch (err) {
      // error visible in SDK log panel
    }
  };

  // Catalog pagination
  const CATALOG_PAGE_SIZE = 50;
  const sortedCatalog = [...catalogMovies].sort((a, b) => (b.year || 0) - (a.year || 0));
  const catalogTotalPages = Math.max(1, Math.ceil(sortedCatalog.length / CATALOG_PAGE_SIZE));
  const catalogPageMovies = sortedCatalog.slice(
    catalogPage * CATALOG_PAGE_SIZE,
    (catalogPage + 1) * CATALOG_PAGE_SIZE
  );

  // --- Add / Edit ---

  const handleAdd = async () => {
    setSaving(true);
    try {
      const targetList = movies
        .filter((m) => m.status === form.status)
        .sort((a, b) => a.rank.localeCompare(b.rank));
      const lastRank = targetList.length > 0 ? targetList[targetList.length - 1].rank : null;
      const rank = generateKeyBetween(lastRank, null);

      const payload = {
        username,
        rank,
        title: form.title,
        year: Number(form.year),
        status: form.status,
      };
      if (form.genre) payload.genre = form.genre;
      if (form.rating) payload.rating = Number(form.rating);
      if (form.director) payload.director = form.director;

      await invokeLambda(config, credentials, config.movieqWriteFunctionName, payload);

      setForm(emptyForm);
      setShowForm(false);
      await onRefresh();
    } catch (err) {
      // error visible in SDK log panel
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const currentMovie = movies.find((m) => m.movie_id === editing);
      const payload = {
        username,
        movie_id: editing,
        title: form.title,
        year: Number(form.year),
        genre: form.genre,
        rating: Number(form.rating),
        director: form.director,
        old_sk: currentMovie ? `${currentMovie.status}#${currentMovie.rank}` : undefined,
      };

      if (currentMovie && form.status !== currentMovie.status) {
        const targetList = movies
          .filter((m) => m.status === form.status)
          .sort((a, b) => a.rank.localeCompare(b.rank));
        const lastRank = targetList.length > 0 ? targetList[targetList.length - 1].rank : null;
        payload.status = form.status;
        payload.rank = generateKeyBetween(lastRank, null);
      }

      await invokeLambda(config, credentials, config.movieqWriteFunctionName, payload);

      setForm(emptyForm);
      setShowForm(false);
      setEditing(null);
      await onRefresh();
    } catch (err) {
      // error visible in SDK log panel
    } finally {
      setSaving(false);
    }
  };

  const handleStartEdit = (movie) => {
    setEditing(movie.movie_id);
    setForm({
      title: movie.title || '',
      year: movie.year || '',
      genre: movie.genre || '',
      rating: movie.rating || '',
      director: movie.director || '',
      status: movie.status || 'active',
    });
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const handleToggleForm = () => {
    if (showForm) {
      handleCancelForm();
    } else {
      setEditing(null);
      setForm(emptyForm);
      setShowForm(true);
    }
  };

  // --- Status change ---

  const handleStatusChange = async (movie, newStatus) => {
    if (newStatus === movie.status) return;
    try {
      const targetList = movies
        .filter((m) => m.status === newStatus)
        .sort((a, b) => a.rank.localeCompare(b.rank));
      const lastRank = targetList.length > 0 ? targetList[targetList.length - 1].rank : null;
      const rank = generateKeyBetween(lastRank, null);

      await invokeLambda(config, credentials, config.movieqWriteFunctionName, {
        username,
        movie_id: movie.movie_id,
        status: newStatus,
        rank,
        old_sk: `${movie.status}#${movie.rank}`,
      });

      await onRefresh();
    } catch (err) {
      // error visible in SDK log panel
    }
  };

  // --- Drag and drop ---

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;

    const oldIndex = filtered.findIndex((m) => m.movie_id === active.id);
    const newIndex = filtered.findIndex((m) => m.movie_id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    let newRank;
    if (newIndex === 0) {
      newRank = generateKeyBetween(null, filtered[0].movie_id === active.id ? filtered[1]?.rank ?? null : filtered[0].rank);
    } else if (newIndex === filtered.length - 1) {
      const last = filtered[filtered.length - 1];
      newRank = generateKeyBetween(last.movie_id === active.id ? filtered[filtered.length - 2]?.rank ?? null : last.rank, null);
    } else {
      const withoutDragged = filtered.filter((m) => m.movie_id !== active.id);
      const insertAt = newIndex > oldIndex ? newIndex - 1 : newIndex;
      const before = withoutDragged[insertAt - 1]?.rank ?? null;
      const after = withoutDragged[insertAt]?.rank ?? null;
      newRank = generateKeyBetween(before, after);
    }

    try {
      const draggedMovie = filtered.find((m) => m.movie_id === active.id);
      await invokeLambda(config, credentials, config.movieqWriteFunctionName, {
        username,
        movie_id: active.id,
        rank: newRank,
        old_sk: `${draggedMovie.status}#${draggedMovie.rank}`,
      });
      await onRefresh();
    } catch (err) {
      // error visible in SDK log panel
    }
  };

  const handleDragCancel = () => {
    setActiveId(null);
  };

  // --- Move to top / bottom (from kebab menu) ---

  const handleMoveToTop = async (movie) => {
    if (filtered.length === 0 || filtered[0].movie_id === movie.movie_id) return;
    const rank = generateKeyBetween(null, filtered[0].rank);
    try {
      await invokeLambda(config, credentials, config.movieqWriteFunctionName, {
        username,
        movie_id: movie.movie_id,
        rank,
        old_sk: `${movie.status}#${movie.rank}`,
      });
      await onRefresh();
    } catch (err) {
      // error visible in SDK log panel
    }
  };

  const handleMoveToBottom = async (movie) => {
    if (filtered.length === 0 || filtered[filtered.length - 1].movie_id === movie.movie_id) return;
    const rank = generateKeyBetween(filtered[filtered.length - 1].rank, null);
    try {
      await invokeLambda(config, credentials, config.movieqWriteFunctionName, {
        username,
        movie_id: movie.movie_id,
        rank,
        old_sk: `${movie.status}#${movie.rank}`,
      });
      await onRefresh();
    } catch (err) {
      // error visible in SDK log panel
    }
  };

  // --- Search ---

  const isSearching = searchQuery.trim().length > 0;
  const searchResults = isSearching
    ? (() => {
        const q = searchQuery.trim().toLowerCase();
        const matched = movies.filter(
          (m) =>
            m.title?.toLowerCase().includes(q) ||
            m.director?.toLowerCase().includes(q) ||
            m.genre?.toLowerCase().includes(q)
        );
        return lists.map((list) => ({
          ...list,
          movies: matched
            .filter((m) => m.status === list.key)
            .sort((a, b) => a.rank.localeCompare(b.rank)),
        })).filter((group) => group.movies.length > 0);
      })()
    : null;

  // DragOverlay helpers
  const activeMovie = activeId ? filtered.find((m) => m.movie_id === activeId) : null;
  const activeIndex = activeMovie ? filtered.indexOf(activeMovie) : -1;

  const movieRowProps = (movie, index, list) => ({
    movie,
    displayOrder: index + 1,
    isFirst: index === list.length - 1,
    isLast: index === 0,
    onStatusChange: handleStatusChange,
    onMoveToTop: () => handleMoveToBottom(movie),
    onMoveToBottom: () => handleMoveToTop(movie),
    onEdit: () => handleStartEdit(movie),
  });

  return (
    <div className="min-h-screen bg-cover bg-center bg-no-repeat" style={{ backgroundImage: "url('/cinema-background-heavy.jpg')" }}>
      <MovieListHeader
        lists={lists}
        activeList={activeList}
        onListChange={handleListChange}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        showForm={showForm}
        onToggleForm={handleToggleForm}
        onImport={() => setShowImportModal(true)}
        onLogout={onLogout}
        hideCatalogActions={isCatalog}
      />

      {showForm && (
        <MovieForm
          form={form}
          setForm={setForm}
          editing={editing}
          onSave={editing ? handleSaveEdit : handleAdd}
          saving={saving}
          movies={movies}
          lists={lists}
        />
      )}

      <main className="max-w-3xl mx-auto px-4 py-8">
        {isSearching ? (
          <SearchResults
            searchResults={searchResults}
            searchQuery={searchQuery}
            movieRowProps={movieRowProps}
          />
        ) : isCatalog ? (
          <div>
            <div className="bg-white rounded-2xl shadow-2xl divide-y divide-gray-200">
              {catalogPageMovies.length === 0 && (
                <p className="text-gray-400 text-sm py-8 text-center">No movies in the catalog.</p>
              )}
              {catalogPageMovies.map((movie) => (
                <CatalogRow
                  key={movie.movie_id}
                  movie={movie}
                  queuedStatus={catalogQueued[movie.movie_id] || null}
                  onAddToQueue={handleAddToQueue}
                />
              ))}
            </div>
            {sortedCatalog.length > CATALOG_PAGE_SIZE && (
              <div className="flex items-center justify-center gap-4 mt-4" data-testid="catalog-pagination">
                <button
                  onClick={() => setCatalogPage((p) => Math.max(0, p - 1))}
                  disabled={catalogPage === 0}
                  className="px-3 py-1 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 disabled:opacity-40 disabled:cursor-default cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  Prev
                </button>
                <span className="text-sm text-white font-medium">
                  Page {catalogPage + 1} of {catalogTotalPages}
                </span>
                <button
                  onClick={() => setCatalogPage((p) => Math.min(catalogTotalPages - 1, p + 1))}
                  disabled={catalogPage >= catalogTotalPages - 1}
                  className="px-3 py-1 rounded-lg text-sm font-medium bg-white border border-gray-300 text-gray-700 disabled:opacity-40 disabled:cursor-default cursor-pointer hover:bg-gray-50 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={filtered.map((m) => m.movie_id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="bg-white rounded-2xl shadow-2xl divide-y divide-gray-200">
                {filtered.length === 0 && (
                  <p className="text-gray-400 text-sm py-8 text-center">No movies in this list.</p>
                )}
                {filtered.map((movie, index) => (
                  <SortableMovieRow
                    key={movie.movie_id}
                    {...movieRowProps(movie, index, filtered)}
                  />
                ))}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeMovie ? (
                <MovieRowContent
                  {...movieRowProps(activeMovie, activeIndex, filtered)}
                  dragHandleProps={{}}
                  isOverlay
                />
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </main>

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        movies={movies}
        config={config}
        credentials={credentials}
        username={username}
        onImportComplete={onRefresh}
      />
    </div>
  );
}
