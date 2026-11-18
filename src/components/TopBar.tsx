import { ListOrdered, Search, X } from 'lucide-react';
import type { GenreFilter, ViewTab } from '../types/music';

interface TopBarProps {
  activeView: ViewTab;
  searchQuery: string;
  genreFilter: GenreFilter;
  queueCount: number;
  isQueueOpen: boolean;
  onSearchChange: (q: string) => void;
  onGenreChange: (g: GenreFilter) => void;
  onToggleQueue: () => void;
  onNavigateHome: () => void;
}

const GENRE_OPTIONS: GenreFilter[] = [
  'All',
  'Electronic',
  'Ambient',
  'Jazz',
  'Acoustic',
];

export function TopBar({
  activeView,
  searchQuery,
  genreFilter,
  queueCount,
  isQueueOpen,
  onSearchChange,
  onGenreChange,
  onToggleQueue,
  onNavigateHome,
}: TopBarProps) {
  return (
    <header className="lg:sticky lg:top-0 z-20 bg-[#0B0B0D]/90 backdrop-blur-md border-b border-white/[0.07]">
      <div className="px-4 sm:px-8 py-3 sm:py-3.5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 lg:gap-6">
        {/* Top Row on Mobile: Brand + Queue; Desktop: Search */}
        <div className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 flex-1 min-w-0">
          <button
            type="button"
            onClick={onNavigateHome}
            className="lg:hidden font-semibold text-lg tracking-[-0.02em] text-[#F4F4F6] whitespace-nowrap shrink-0 order-1"
          >
            Cadence
          </button>

          <button
            type="button"
            onClick={onToggleQueue}
            aria-label={isQueueOpen ? 'Hide queue' : 'Show queue'}
            aria-expanded={isQueueOpen}
            className={`xl:hidden min-h-[40px] px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors order-2 sm:order-3 ${
              isQueueOpen
                ? 'bg-[#1D1D22] border-white/20 text-[#F4F4F6]'
                : 'bg-[#151519] border-white/[0.08] text-[#9C9CA6] hover:text-[#F4F4F6]'
            }`}
          >
            <ListOrdered className="w-4 h-4" strokeWidth={1.75} />
            <span>Queue</span>
            <span className="font-mono tabular-nums text-[#7C7C87]">
              {queueCount}
            </span>
          </button>

          <div className="relative w-full sm:flex-1 sm:max-w-md order-3 sm:order-2">
            <label htmlFor="catalog-search" className="sr-only">
              Search tracks, albums, or artists
            </label>
            <Search
              className="w-4 h-4 text-[#6E6E78] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
              strokeWidth={1.75}
            />
            <input
              id="catalog-search"
              type="search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search tracks, artists, albums..."
              className="w-full h-10 pl-10 pr-9 bg-[#151519] border border-white/[0.08] rounded-lg text-sm text-[#F4F4F6] placeholder-[#6E6E78] focus:outline-none focus:border-[#E85D3F] transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[#7C7C87] hover:text-[#F4F4F6] rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Genre Filter Segmented Control (shown on Discover & Library) */}
        {(activeView === 'discover' || activeView === 'library') && (
          <div
            role="group"
            aria-label="Filter by genre"
            className="flex items-center gap-1 p-1 bg-[#141418] border border-white/[0.07] rounded-lg overflow-x-auto no-scrollbar shrink-0"
          >
            {GENRE_OPTIONS.map((genre) => {
              const active = genreFilter === genre;
              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => onGenreChange(genre)}
                  aria-pressed={active}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors duration-150 whitespace-nowrap shrink-0 min-h-[32px] focus-visible:outline-2 focus-visible:outline-[#E85D3F] ${
                    active
                      ? 'bg-[#23232A] text-[#F4F4F6]'
                      : 'text-[#8C8C96] hover:text-[#F4F4F6]'
                  }`}
                >
                  {genre}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
