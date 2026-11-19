import { memo, useMemo, useState } from 'react';
import {
  ArrowDownUp,
  CheckSquare,
  FileText,
  Heart,
  ImagePlus,
  Info,
  ListEnd,
  ListPlus,
  MoreVertical,
  Pause,
  Play,
  Share2,
  Square,
} from 'lucide-react';
import type {
  Playlist,
  SortDirection,
  SortField,
  Track,
} from '../types/music';
import { formatTimecode } from '../utils/musicLogic';
import { CoverArt } from './CoverArt';

interface TrackListViewProps {
  title: string;
  subtitle?: string;
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  favoriteIds: string[];
  playlists: Playlist[];
  sortField: SortField;
  sortDirection: SortDirection;
  onChangeSort: (field: SortField) => void;
  onPlayTrack: (trackId: string, queueSourceIds: string[]) => void;
  onTogglePlayPause: () => void;
  onToggleFavorite: (trackId: string) => void;
  onPlayNext: (trackId: string) => void;
  onAddToQueue: (trackId: string) => void;
  onAddMultipleToQueue: (trackIds: string[]) => void;
  onAddTrackToPlaylist: (playlistId: string, trackId: string) => void;
  onAddMultipleToPlaylist: (playlistId: string, trackIds: string[]) => void;
  onOpenAlbum: (albumId: string) => void;
  onOpenArtist: (artistName: string) => void;
  onShowTrackDetails: (track: Track) => void;
  onShareTrack: (track: Track) => void;
  onSelectCustomCover: (track: Track) => void;
  onAssociateLyricsFile: (track: Track) => void;
  emptyMessage?: string;
}

const PAGE_SIZE = 60;

interface TrackRowProps {
  track: Track;
  index: number;
  isCurrent: boolean;
  isPlaying: boolean;
  isFavorite: boolean;
  multiSelectMode: boolean;
  isSelected: boolean;
  menuOpen: boolean;
  playlists: Playlist[];
  onToggleSelect: (id: string) => void;
  onPlayOrPause: (id: string) => void;
  onToggleFavorite: (id: string) => void;
  onToggleMenu: (id: string) => void;
  onCloseMenu: () => void;
  onPlayNext: (id: string) => void;
  onAddToQueue: (id: string) => void;
  onAddToPlaylist: (playlistId: string, trackId: string) => void;
  onOpenAlbum: (albumId: string) => void;
  onOpenArtist: (artistName: string) => void;
  onShowDetails: (track: Track) => void;
  onShare: (track: Track) => void;
  onSelectCustomCover: (track: Track) => void;
  onAssociateLyricsFile: (track: Track) => void;
}

const TrackRow = memo(function TrackRow({
  track,
  index,
  isCurrent,
  isPlaying,
  isFavorite,
  multiSelectMode,
  isSelected,
  menuOpen,
  playlists,
  onToggleSelect,
  onPlayOrPause,
  onToggleFavorite,
  onToggleMenu,
  onCloseMenu,
  onPlayNext,
  onAddToQueue,
  onAddToPlaylist,
  onOpenAlbum,
  onOpenArtist,
  onShowDetails,
  onShare,
  onSelectCustomCover,
  onAssociateLyricsFile,
}: TrackRowProps) {
  return (
    <li
      className={`relative group grid grid-cols-[44px_1fr_auto] md:grid-cols-[44px_1fr_170px_86px_64px_92px] items-center gap-3 px-2 sm:px-3 py-2.5 transition-colors ${
        isCurrent
          ? 'bg-zinc-100 dark:bg-[#19191F]'
          : 'hover:bg-zinc-100/60 dark:hover:bg-white/[0.03]'
      }`}
    >
      {/* Index / Play / Multi-select Checkbox */}
      <div className="flex items-center justify-center">
        {multiSelectMode ? (
          <button
            type="button"
            onClick={() => onToggleSelect(track.id)}
            aria-label={
              isSelected ? `Deselect '${track.title}'` : `Select '${track.title}'`
            }
            aria-pressed={isSelected}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-zinc-600 dark:text-[#9C9CA6] hover:text-[#E85D3F]"
          >
            {isSelected ? (
              <CheckSquare className="w-4 h-4 text-[#E85D3F]" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onPlayOrPause(track.id)}
            aria-label={
              isCurrent && isPlaying
                ? `Pause '${track.title}'`
                : `Play '${track.title}'`
            }
            className="w-10 h-10 rounded-lg flex items-center justify-center font-mono text-xs tabular-nums text-zinc-500 dark:text-[#8C8C96] hover:text-zinc-900 dark:hover:text-[#F4F4F6]"
          >
            {isCurrent && isPlaying ? (
              <Pause className="w-4 h-4 text-[#E85D3F] fill-current" />
            ) : (
              <>
                <span
                  className={
                    isCurrent
                      ? 'text-[#E85D3F] font-semibold group-hover:hidden'
                      : 'group-hover:hidden'
                  }
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <Play className="w-4 h-4 hidden group-hover:block fill-current" />
              </>
            )}
          </button>
        )}
      </div>

      {/* Artwork + Title + Artist */}
      <div className="flex items-center gap-3 min-w-0">
        <CoverArt
          src={track.artworkUrl}
          alt={`${track.album} artwork`}
          size="sm"
          className="w-10 h-10 rounded-md shrink-0"
        />
        <div className="min-w-0">
          <button
            type="button"
            onClick={() =>
              multiSelectMode ? onToggleSelect(track.id) : onPlayOrPause(track.id)
            }
            className={`text-sm font-medium truncate block text-left w-full hover:underline ${
              isCurrent ? 'text-[#E85D3F]' : 'text-zinc-900 dark:text-[#F4F4F6]'
            }`}
          >
            {track.title}
          </button>
          <p className="text-xs text-zinc-500 dark:text-[#8C8C96] truncate">
            {track.artist}
            <span className="md:hidden"> · {track.formatLabel}</span>
          </p>
        </div>
      </div>

      {/* Album */}
      <button
        type="button"
        onClick={() => onOpenAlbum(track.albumId)}
        className="hidden md:block text-left text-xs text-zinc-600 dark:text-[#9C9CA6] hover:text-zinc-900 dark:hover:text-[#F4F4F6] truncate"
      >
        {track.album}
      </button>

      {/* Format */}
      <span className="hidden md:block text-right font-mono text-[11px] text-zinc-500 dark:text-[#7C7C87] truncate">
        {track.formatLabel}
      </span>

      {/* Duration */}
      <span className="hidden md:block text-right font-mono text-xs tabular-nums text-zinc-600 dark:text-[#8C8C96]">
        {formatTimecode(track.durationSec)}
      </span>

      {/* Actions */}
      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={() => onToggleFavorite(track.id)}
          aria-label={
            isFavorite
              ? `Remove '${track.title}' from favorites`
              : `Add '${track.title}' to favorites`
          }
          aria-pressed={isFavorite}
          className="min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center text-zinc-500 dark:text-[#8C8C96] hover:text-zinc-900 dark:hover:text-[#F4F4F6] hover:bg-zinc-200/60 dark:hover:bg-white/[0.05] transition-colors"
        >
          <Heart
            className={`w-4 h-4 ${
              isFavorite ? 'fill-[#E85D3F] text-[#E85D3F]' : ''
            }`}
            strokeWidth={1.75}
          />
        </button>

        <button
          type="button"
          onClick={() => onToggleMenu(track.id)}
          aria-label={`More options for '${track.title}'`}
          aria-expanded={menuOpen}
          className="min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center text-zinc-500 dark:text-[#8C8C96] hover:text-zinc-900 dark:hover:text-[#F4F4F6] hover:bg-zinc-200/60 dark:hover:bg-white/[0.05] transition-colors"
        >
          <MoreVertical className="w-4 h-4" strokeWidth={1.75} />
        </button>
      </div>

      {/* Context Menu */}
      {menuOpen && (
        <div
          role="menu"
          aria-label={`Actions for ${track.title}`}
          className="absolute right-3 top-12 z-30 w-56 rounded-xl bg-white dark:bg-[#19191F] border border-zinc-200 dark:border-white/[0.12] shadow-xl py-1.5 text-xs"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onPlayNext(track.id);
              onCloseMenu();
            }}
            className="w-full px-3.5 py-2.5 text-left text-zinc-800 dark:text-[#F4F4F6] hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center gap-2.5"
          >
            <ListEnd className="w-3.5 h-3.5 text-[#E85D3F]" />
            <span>Play Next</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onAddToQueue(track.id);
              onCloseMenu();
            }}
            className="w-full px-3.5 py-2.5 text-left text-zinc-800 dark:text-[#F4F4F6] hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center gap-2.5"
          >
            <ListPlus className="w-3.5 h-3.5" />
            <span>Add to Queue</span>
          </button>

          {playlists.length > 0 && (
            <div className="border-y border-zinc-200 dark:border-white/[0.07] my-1 py-1">
              <p className="px-3.5 py-1 text-[11px] font-medium text-zinc-500 dark:text-[#7C7C87]">
                Add to Playlist
              </p>
              {playlists.slice(0, 4).map((pl) => (
                <button
                  key={pl.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onAddToPlaylist(pl.id, track.id);
                    onCloseMenu();
                  }}
                  className="w-full px-3.5 py-2 text-left text-zinc-700 dark:text-[#C4C4CC] hover:bg-zinc-100 dark:hover:bg-white/[0.06] truncate"
                >
                  {pl.name}
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpenAlbum(track.albumId);
              onCloseMenu();
            }}
            className="w-full px-3.5 py-2.5 text-left text-zinc-700 dark:text-[#C4C4CC] hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
          >
            Go to Album
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onOpenArtist(track.artist);
              onCloseMenu();
            }}
            className="w-full px-3.5 py-2.5 text-left text-zinc-700 dark:text-[#C4C4CC] hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
          >
            Go to Artist
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onSelectCustomCover(track);
              onCloseMenu();
            }}
            className="w-full px-3.5 py-2.5 text-left text-zinc-700 dark:text-[#C4C4CC] hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center gap-2.5"
          >
            <ImagePlus className="w-3.5 h-3.5" />
            <span>Set Custom Cover</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onAssociateLyricsFile(track);
              onCloseMenu();
            }}
            className="w-full px-3.5 py-2.5 text-left text-zinc-700 dark:text-[#C4C4CC] hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center gap-2.5"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Load Lyrics (.lrc)</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onShowDetails(track);
              onCloseMenu();
            }}
            className="w-full px-3.5 py-2.5 text-left text-zinc-700 dark:text-[#C4C4CC] hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center gap-2.5"
          >
            <Info className="w-3.5 h-3.5" />
            <span>Track Details</span>
          </button>

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              onShare(track);
              onCloseMenu();
            }}
            className="w-full px-3.5 py-2.5 text-left text-zinc-700 dark:text-[#C4C4CC] hover:bg-zinc-100 dark:hover:bg-white/[0.06] flex items-center gap-2.5"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Audio File</span>
          </button>
        </div>
      )}
    </li>
  );
});

export function TrackListView({
  title,
  subtitle,
  tracks,
  currentTrackId,
  isPlaying,
  favoriteIds,
  playlists,
  sortField,
  sortDirection,
  onChangeSort,
  onPlayTrack,
  onTogglePlayPause,
  onToggleFavorite,
  onPlayNext,
  onAddToQueue,
  onAddMultipleToQueue,
  onAddTrackToPlaylist,
  onAddMultipleToPlaylist,
  onOpenAlbum,
  onOpenArtist,
  onShowTrackDetails,
  onShareTrack,
  onSelectCustomCover,
  onAssociateLyricsFile,
  emptyMessage = 'No tracks found.',
}: TrackListViewProps) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [multiSelectMode, setMultiSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [openMenuTrackId, setOpenMenuTrackId] = useState<string | null>(null);
  const [targetPlaylistId, setTargetPlaylistId] = useState<string>(
    playlists[0]?.id ?? ''
  );

  const visibleTracks = useMemo(
    () => tracks.slice(0, visibleCount),
    [tracks, visibleCount]
  );

  const allTrackIds = useMemo(() => tracks.map((t) => t.id), [tracks]);
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handlePlayOrPause = (id: string) => {
    if (id === currentTrackId) {
      onTogglePlayPause();
    } else {
      onPlayTrack(id, allTrackIds);
    }
  };

  const sortOptions: { field: SortField; label: string }[] = [
    { field: 'title', label: 'Title' },
    { field: 'artist', label: 'Artist' },
    { field: 'album', label: 'Album' },
    { field: 'duration', label: 'Duration' },
    { field: 'dateAdded', label: 'Date Added' },
  ];

  return (
    <div className="px-4 sm:px-8 py-6 space-y-5 max-w-6xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/[0.08]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-zinc-900 dark:text-[#F4F4F6]">
            {title}
          </h1>
          <p className="text-xs font-mono tabular-nums text-zinc-500 dark:text-[#8C8C96] mt-1">
            {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
            {subtitle ? ` · ${subtitle}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {tracks.length > 0 && (
            <>
              <button
                type="button"
                onClick={() => onPlayTrack(tracks[0].id, allTrackIds)}
                className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#E85D3F] hover:bg-[#D55033] text-white text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Play All</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMultiSelectMode((m) => !m);
                  setSelectedIds([]);
                }}
                aria-pressed={multiSelectMode}
                className={`min-h-[38px] px-3 py-1.5 rounded-lg border text-xs font-medium whitespace-nowrap shrink-0 ${
                  multiSelectMode
                    ? 'bg-zinc-200 dark:bg-[#1D1D22] border-zinc-300 dark:border-white/20 text-zinc-900 dark:text-[#F4F4F6]'
                    : 'border-zinc-200 dark:border-white/[0.1] text-zinc-700 dark:text-[#C4C4CC]'
                }`}
              >
                {multiSelectMode ? 'Done Selecting' : 'Select'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sort Bar */}
      {tracks.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            role="group"
            aria-label="Sort tracks"
            className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-[#141418] border border-zinc-200 dark:border-white/[0.07] rounded-lg overflow-x-auto"
          >
            {sortOptions.map((opt) => {
              const active = sortField === opt.field;
              return (
                <button
                  key={opt.field}
                  type="button"
                  onClick={() => onChangeSort(opt.field)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                    active
                      ? 'bg-white dark:bg-[#23232A] text-zinc-900 dark:text-[#F4F4F6] shadow-xs'
                      : 'text-zinc-600 dark:text-[#8C8C96] hover:text-zinc-900 dark:hover:text-[#F4F4F6]'
                  }`}
                >
                  <span>{opt.label}</span>
                  {active && (
                    <ArrowDownUp className="w-3 h-3 text-[#E85D3F]" />
                  )}
                  {active && (
                    <span className="font-mono text-[10px] uppercase">
                      {sortDirection}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {multiSelectMode && selectedIds.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-mono tabular-nums text-zinc-600 dark:text-[#9C9CA6]">
                {selectedIds.length} selected
              </span>
              <button
                type="button"
                onClick={() => {
                  onAddMultipleToQueue(selectedIds);
                  setMultiSelectMode(false);
                  setSelectedIds([]);
                }}
                className="px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-[#23232A] text-white text-xs font-medium whitespace-nowrap"
              >
                Queue Selected
              </button>
              {playlists.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <select
                    aria-label="Choose playlist for selected tracks"
                    value={targetPlaylistId || playlists[0].id}
                    onChange={(e) => setTargetPlaylistId(e.target.value)}
                    className="h-8 px-2 rounded-lg bg-white dark:bg-[#151519] border border-zinc-200 dark:border-white/[0.1] text-xs"
                  >
                    {playlists.map((pl) => (
                      <option key={pl.id} value={pl.id}>
                        {pl.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const pid = targetPlaylistId || playlists[0].id;
                      onAddMultipleToPlaylist(pid, selectedIds);
                      setMultiSelectMode(false);
                      setSelectedIds([]);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#E85D3F] text-white text-xs font-medium whitespace-nowrap"
                  >
                    Add to Playlist
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tracks.length === 0 ? (
        <div className="py-12 px-6 rounded-xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.07] text-center">
          <p className="text-sm text-zinc-600 dark:text-[#9C9CA6]">
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div className="border-t border-zinc-200 dark:border-white/[0.08]">
          <div className="hidden md:grid grid-cols-[44px_1fr_170px_86px_64px_92px] items-center gap-3 px-3 py-2 text-[11px] font-medium text-zinc-500 dark:text-[#6E6E78] border-b border-zinc-200 dark:border-white/[0.06]">
            <span className="text-center">#</span>
            <span>Title</span>
            <span>Album</span>
            <span className="text-right">Format</span>
            <span className="text-right">Time</span>
            <span className="text-right">Actions</span>
          </div>

          <ul className="divide-y divide-zinc-200/70 dark:divide-white/[0.05]">
            {visibleTracks.map((track, idx) => (
              <TrackRow
                key={track.id}
                track={track}
                index={idx}
                isCurrent={track.id === currentTrackId}
                isPlaying={isPlaying}
                isFavorite={favoriteSet.has(track.id)}
                multiSelectMode={multiSelectMode}
                isSelected={selectedSet.has(track.id)}
                menuOpen={openMenuTrackId === track.id}
                playlists={playlists}
                onToggleSelect={handleToggleSelect}
                onPlayOrPause={handlePlayOrPause}
                onToggleFavorite={onToggleFavorite}
                onToggleMenu={(id) =>
                  setOpenMenuTrackId((prev) => (prev === id ? null : id))
                }
                onCloseMenu={() => setOpenMenuTrackId(null)}
                onPlayNext={onPlayNext}
                onAddToQueue={onAddToQueue}
                onAddToPlaylist={onAddTrackToPlaylist}
                onOpenAlbum={onOpenAlbum}
                onOpenArtist={onOpenArtist}
                onShowDetails={onShowTrackDetails}
                onShare={onShareTrack}
                onSelectCustomCover={onSelectCustomCover}
                onAssociateLyricsFile={onAssociateLyricsFile}
              />
            ))}
          </ul>

          {visibleCount < tracks.length && (
            <div className="pt-5 flex justify-center">
              <button
                type="button"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                className="px-5 py-2.5 rounded-lg border border-zinc-200 dark:border-white/[0.1] bg-white dark:bg-[#151519] text-xs font-medium text-zinc-800 dark:text-[#F4F4F6] hover:border-[#E85D3F]"
              >
                Show {Math.min(PAGE_SIZE, tracks.length - visibleCount)} More (
                {tracks.length - visibleCount} remaining)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
