import {
  Compass,
  Library,
  ListMusic,
  Plus,
  SlidersHorizontal,
} from 'lucide-react';
import type { Playlist, ViewTab } from '../types/music';

interface SidebarProps {
  activeView: ViewTab;
  selectedPlaylistId: string | null;
  playlists: Playlist[];
  likedCount: number;
  onSelectView: (view: ViewTab) => void;
  onSelectPlaylist: (playlistId: string) => void;
  onOpenCreatePlaylist: () => void;
}

export function Sidebar({
  activeView,
  selectedPlaylistId,
  playlists,
  likedCount,
  onSelectView,
  onSelectPlaylist,
  onOpenCreatePlaylist,
}: SidebarProps) {
  const navItems: { id: ViewTab; label: string; icon: typeof Compass; meta?: string }[] = [
    { id: 'discover', label: 'Discover', icon: Compass },
    {
      id: 'library',
      label: 'Library',
      icon: Library,
      meta: likedCount > 0 ? String(likedCount) : undefined,
    },
    { id: 'playlists', label: 'Playlists', icon: ListMusic },
    { id: 'eq', label: 'Studio EQ', icon: SlidersHorizontal },
  ];

  return (
    <aside
      aria-label="Primary Sidebar"
      className="hidden lg:flex flex-col w-[240px] shrink-0 bg-[#131316] border-r border-white/[0.08] h-full select-none"
    >
      {/* Brand Wordmark */}
      <div className="px-6 h-16 flex items-center border-b border-white/[0.06]">
        <a
          href="#discover"
          onClick={(e) => {
            e.preventDefault();
            onSelectView('discover');
          }}
          className="font-semibold text-[19px] tracking-[-0.02em] text-[#F4F4F6] whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#E85D3F] rounded"
        >
          Cadence
        </a>
      </div>

      {/* Main Navigation */}
      <nav aria-label="Main Navigation" className="px-3 pt-5 pb-4 space-y-1">
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
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#E85D3F] ${
                isActive
                  ? 'bg-[#1D1D22] text-[#F4F4F6]'
                  : 'text-[#9C9CA6] hover:text-[#F4F4F6] hover:bg-white/[0.04]'
              }`}
            >
              <span className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-[#E85D3F]' : 'text-[#7C7C87]'
                  }`}
                  strokeWidth={1.75}
                />
                <span>{item.label}</span>
              </span>
              {item.meta && (
                <span className="font-mono text-xs tabular-nums text-[#7C7C87]">
                  {item.meta}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Playlists Section */}
      <div className="px-3 pt-4 border-t border-white/[0.06] flex-1 overflow-y-auto">
        <div className="flex items-center justify-between px-3 mb-2">
          <h2 className="text-xs font-medium text-[#7C7C87]">Your Playlists</h2>
          <button
            type="button"
            onClick={onOpenCreatePlaylist}
            aria-label="New playlist"
            className="p-1.5 rounded-md text-[#9C9CA6] hover:text-[#F4F4F6] hover:bg-white/[0.06] transition-colors focus-visible:outline-2 focus-visible:outline-[#E85D3F]"
          >
            <Plus className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>

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
                      ? 'bg-[#1D1D22] text-[#F4F4F6] font-medium'
                      : 'text-[#9C9CA6] hover:text-[#F4F4F6] hover:bg-white/[0.04]'
                  }`}
                >
                  <span className="truncate pr-2">{pl.name}</span>
                  <span className="font-mono text-[11px] tabular-nums text-[#6E6E78] shrink-0">
                    {pl.trackIds.length}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </aside>
  );
}
