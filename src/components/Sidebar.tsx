import {
  Disc,
  FolderOpen,
  Heart,
  Home,
  ListMusic,
  Mic2,
  Moon,
  Music2,
  Plus,
  Settings,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import type { Playlist, ThemeMode, ViewTab } from '../types/music';

interface SidebarProps {
  activeView: ViewTab;
  selectedPlaylistId: string | null;
  playlists: Playlist[];
  trackCount: number;
  favoriteCount: number;
  theme: ThemeMode;
  onToggleTheme: () => void;
  onSelectView: (view: ViewTab) => void;
  onSelectPlaylist: (playlistId: string) => void;
  onOpenCreatePlaylist: () => void;
}

export function Sidebar({
  activeView,
  selectedPlaylistId,
  playlists,
  trackCount,
  favoriteCount,
  theme,
  onToggleTheme,
  onSelectView,
  onSelectPlaylist,
  onOpenCreatePlaylist,
}: SidebarProps) {
  const navItems: {
    id: ViewTab;
    label: string;
    icon: typeof Home;
    meta?: string;
  }[] = [
    { id: 'home', label: 'Home', icon: Home },
    {
      id: 'tracks',
      label: 'Tracks',
      icon: Music2,
      meta: trackCount > 0 ? String(trackCount) : undefined,
    },
    { id: 'albums', label: 'Albums', icon: Disc },
    { id: 'artists', label: 'Artists', icon: Mic2 },
    { id: 'folders', label: 'Folders', icon: FolderOpen },
    { id: 'playlists', label: 'Playlists', icon: ListMusic },
    {
      id: 'favorites',
      label: 'Favorites',
      icon: Heart,
      meta: favoriteCount > 0 ? String(favoriteCount) : undefined,
    },
    { id: 'eq', label: 'Audio Effects', icon: SlidersHorizontal },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside
      aria-label="Primary Sidebar"
      className="hidden lg:flex flex-col w-[248px] shrink-0 bg-white dark:bg-[#131316] border-r border-zinc-200 dark:border-white/[0.08] h-full select-none"
    >
      <div className="px-6 h-16 flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06]">
        <a
          href="#home"
          onClick={(e) => {
            e.preventDefault();
            onSelectView('home');
          }}
          className="font-semibold text-[19px] tracking-[-0.02em] text-zinc-900 dark:text-[#F4F4F6] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#E85D3F] rounded"
        >
          Cadence
        </a>

        <button
          type="button"
          onClick={onToggleTheme}
          aria-label={
            theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
          }
          className="w-9 h-9 rounded-lg flex items-center justify-center text-zinc-600 dark:text-[#9C9CA6] hover:text-zinc-900 dark:hover:text-[#F4F4F6] hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" strokeWidth={1.75} />
          ) : (
            <Moon className="w-4 h-4" strokeWidth={1.75} />
          )}
        </button>
      </div>

      <nav aria-label="Main Navigation" className="px-3 pt-4 pb-3 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            activeView === item.id &&
            !(item.id === 'playlists' && selectedPlaylistId !== null);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectView(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#E85D3F] ${
                isActive
                  ? 'bg-zinc-100 dark:bg-[#1D1D22] text-zinc-900 dark:text-[#F4F4F6]'
                  : 'text-zinc-600 dark:text-[#9C9CA6] hover:text-zinc-900 dark:hover:text-[#F4F4F6] hover:bg-zinc-100/70 dark:hover:bg-white/[0.04]'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive
                      ? 'text-[#E85D3F]'
                      : 'text-zinc-500 dark:text-[#7C7C87]'
                  }`}
                  strokeWidth={1.75}
                />
                <span>{item.label}</span>
              </span>
              {item.meta && (
                <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-[#7C7C87]">
                  {item.meta}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="px-3 pt-3 border-t border-zinc-200 dark:border-white/[0.06] flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-3 mb-2">
          <h2 className="text-xs font-medium text-zinc-500 dark:text-[#7C7C87]">
            Playlists
          </h2>
          <button
            type="button"
            onClick={onOpenCreatePlaylist}
            aria-label="New playlist"
            className="p-1.5 rounded-md text-zinc-500 dark:text-[#9C9CA6] hover:text-zinc-900 dark:hover:text-[#F4F4F6] hover:bg-zinc-100 dark:hover:bg-white/[0.06] transition-colors"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

        {playlists.length === 0 ? (
          <p className="px-3 py-2 text-xs text-zinc-500 dark:text-[#6E6E78]">
            No playlists created yet.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {playlists.map((pl) => {
              const isSelected =
                activeView === 'playlists' && selectedPlaylistId === pl.id;
              return (
                <li key={pl.id}>
                  <button
                    type="button"
                    onClick={() => onSelectPlaylist(pl.id)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors duration-150 text-left focus-visible:outline-2 focus-visible:outline-[#E85D3F] ${
                      isSelected
                        ? 'bg-zinc-100 dark:bg-[#1D1D22] text-zinc-900 dark:text-[#F4F4F6] font-medium'
                        : 'text-zinc-600 dark:text-[#9C9CA6] hover:text-zinc-900 dark:hover:text-[#F4F4F6] hover:bg-zinc-100/70 dark:hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="truncate pr-2">{pl.name}</span>
                    <span className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-[#6E6E78] shrink-0">
                      {pl.trackIds.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
