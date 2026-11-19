import {
  FolderPlus,
  ListOrdered,
  Moon,
  RefreshCw,
  Search,
  Sun,
  X,
} from 'lucide-react';
import type { ThemeMode } from '../types/music';

interface TopBarProps {
  searchQuery: string;
  queueCount: number;
  isQueueOpen: boolean;
  isScanning: boolean;
  isNativeAndroid: boolean;
  theme: ThemeMode;
  onSearchChange: (q: string) => void;
  onToggleQueue: () => void;
  onRescan: () => void;
  onImportFiles: () => void;
  onToggleTheme: () => void;
  onNavigateHome: () => void;
}

export function TopBar({
  searchQuery,
  queueCount,
  isQueueOpen,
  isScanning,
  isNativeAndroid,
  theme,
  onSearchChange,
  onToggleQueue,
  onRescan,
  onImportFiles,
  onToggleTheme,
  onNavigateHome,
}: TopBarProps) {
  return (
    <header className="lg:sticky lg:top-0 z-20 bg-stone-50/90 dark:bg-[#0B0B0D]/90 backdrop-blur-md border-b border-zinc-200 dark:border-white/[0.07]">
      <div className="px-4 sm:px-8 py-3 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
        {/* Mobile Brand */}
        <button
          type="button"
          onClick={onNavigateHome}
          className="lg:hidden font-semibold text-lg tracking-[-0.02em] text-zinc-900 dark:text-[#F4F4F6] whitespace-nowrap shrink-0 order-1"
        >
          Cadence
        </button>

        {/* Right Controls on Mobile, Trailing on Desktop */}
        <div className="flex items-center gap-2 order-2 sm:order-3 shrink-0">
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
            }
            className="lg:hidden min-w-[40px] min-h-[40px] rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#151519] flex items-center justify-center text-zinc-600 dark:text-[#9C9CA6]"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4" strokeWidth={1.75} />
            ) : (
              <Moon className="w-4 h-4" strokeWidth={1.75} />
            )}
          </button>

          {isNativeAndroid ? (
            <button
              type="button"
              onClick={onRescan}
              disabled={isScanning}
              aria-label="Scan device audio library"
              className="min-h-[40px] px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#151519] text-xs font-medium text-zinc-700 dark:text-[#C4C4CC] hover:text-zinc-900 dark:hover:text-[#F4F4F6] inline-flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`}
              />
              <span>{isScanning ? 'Scanning...' : 'Scan'}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onImportFiles}
              className="min-h-[40px] px-3 py-2 rounded-lg border border-zinc-200 dark:border-white/[0.08] bg-white dark:bg-[#151519] text-xs font-medium text-zinc-700 dark:text-[#C4C4CC] hover:text-zinc-900 dark:hover:text-[#F4F4F6] inline-flex items-center gap-2 whitespace-nowrap shrink-0"
            >
              <FolderPlus className="w-3.5 h-3.5 text-[#E85D3F]" />
              <span>Add Audio</span>
            </button>
          )}

          <button
            type="button"
            onClick={onToggleQueue}
            aria-label={isQueueOpen ? 'Hide queue' : 'Show queue'}
            aria-expanded={isQueueOpen}
            className={`xl:hidden min-h-[40px] px-3 py-2 rounded-lg border text-xs font-medium flex items-center gap-2 whitespace-nowrap shrink-0 transition-colors ${
              isQueueOpen
                ? 'bg-zinc-200 dark:bg-[#1D1D22] border-zinc-300 dark:border-white/20 text-zinc-900 dark:text-[#F4F4F6]'
                : 'bg-white dark:bg-[#151519] border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-[#9C9CA6] hover:text-zinc-900 dark:hover:text-[#F4F4F6]'
            }`}
          >
            <ListOrdered className="w-4 h-4" strokeWidth={1.75} />
            <span>Queue</span>
            <span className="font-mono tabular-nums text-zinc-500 dark:text-[#7C7C87]">
              {queueCount}
            </span>
          </button>
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:flex-1 sm:max-w-lg order-3 sm:order-2">
          <label htmlFor="catalog-search" className="sr-only">
            Search tracks, albums, artists, or folders
          </label>
          <Search
            className="w-4 h-4 text-zinc-400 dark:text-[#6E6E78] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
            strokeWidth={1.75}
          />
          <input
            id="catalog-search"
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tracks, artists, albums, folders..."
            className="w-full h-10 pl-10 pr-9 bg-white dark:bg-[#151519] border border-zinc-200 dark:border-white/[0.08] rounded-lg text-sm text-zinc-900 dark:text-[#F4F4F6] placeholder-zinc-400 dark:placeholder-[#6E6E78] focus:outline-none focus:border-[#E85D3F] transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear search"
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-500 dark:text-[#7C7C87] hover:text-zinc-900 dark:hover:text-[#F4F4F6] rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
