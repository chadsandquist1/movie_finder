import { MovieRowContent } from './MovieRow';

export default function SearchResults({ searchResults, searchQuery, movieRowProps }) {
  if (searchResults.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-2xl">
        <p className="text-gray-400 text-sm py-8 text-center">
          No movies match &ldquo;{searchQuery.trim()}&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <>
      {searchResults.map((group) => (
        <div key={group.key} className="mb-6">
          <h2 className="text-sm font-semibold text-white/80 uppercase tracking-wide mb-2 px-1">
            {group.label} ({group.movies.length})
          </h2>
          <div className="bg-white rounded-2xl shadow-2xl divide-y divide-gray-200">
            {group.movies.map((movie, index) => (
              <MovieRowContent
                key={movie.movie_id}
                {...movieRowProps(movie, index, group.movies)}
                dragHandleProps={{}}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
