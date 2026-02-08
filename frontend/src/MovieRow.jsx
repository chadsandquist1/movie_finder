export default function MovieRow({ movie, displayOrder }) {
  return (
    <div className="flex items-baseline gap-4 py-4 px-5">
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
      <span className="text-sm font-semibold text-black shrink-0">
        {movie.rating}<span className="text-gray-400 font-normal">/10</span>
      </span>
    </div>
  );
}
