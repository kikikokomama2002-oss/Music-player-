import {
  AlertTriangle,
  Disc,
  FolderOpen,
  FolderPlus,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Settings,
  ShieldAlert,
  Shuffle,
} from 'lucide-react';
import type {
  AlbumGroup,
  ArtistGroup,
  FolderGroup,
  PermissionStatus,
  Track,
  ViewTab,
} from '../types/music';
import { formatTimecode, getRecentlyAddedTracks } from '../utils/musicLogic';
import { CoverArt } from './CoverArt';

interface HomeDashboardViewProps {
  tracks: Track[];
  albums: AlbumGroup[];
  artists: ArtistGroup[];
  folders: FolderGroup[];
  recentlyPlayed: Track[];
  mostPlayed: { track: Track; count: number }[];
  currentTrackId: string | null;
  isPlaying: boolean;
  isScanning: boolean;
  scanError: string | null;
  permissionStatus: PermissionStatus;
  isNativeAndroid: boolean;
  onRequestPermissions: () => void;
  onOpenSettings: () => void;
  onRescan: () => void;
  onImportFiles: () => void;
  onImportFolder: () => void;
  onPlayTrack: (trackId: string, queueIds: string[]) => void;
  onTogglePlayPause: () => void;
  onShuffleAll: () => void;
  onOpenAlbum: (albumId: string) => void;
  onNavigateView: (view: ViewTab) => void;
}

export function HomeDashboardView({
  tracks,
  albums,
  artists,
  folders,
  recentlyPlayed,
  mostPlayed,
  currentTrackId,
  isPlaying,
  isScanning,
  scanError,
  permissionStatus,
  isNativeAndroid,
  onRequestPermissions,
  onOpenSettings,
  onRescan,
  onImportFiles,
  onImportFolder,
  onPlayTrack,
  onTogglePlayPause,
  onShuffleAll,
  onOpenAlbum,
  onNavigateView,
}: HomeDashboardViewProps) {
  // Permission Denied / Prompt State (Android)
  if (isNativeAndroid && permissionStatus !== 'granted') {
    return (
      <div className="px-4 sm:px-8 py-12 max-w-2xl mx-auto">
        <div className="p-8 rounded-2xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.08] space-y-5">
          <div className="w-12 h-12 rounded-xl bg-[#E85D3F]/10 text-[#E85D3F] flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-[#F4F4F6]">
              Audio Library Access Required
            </h1>
            <p className="text-sm text-zinc-600 dark:text-[#9C9CA6] leading-relaxed">
              Cadence Studio plays MP3, FLAC, WAV, M4A, AAC, and OGG files
              stored offline on your device. Grant audio storage permission so
              Cadence can scan your local music collection.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              type="button"
              onClick={onRequestPermissions}
              className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#E85D3F] hover:bg-[#D55033] text-white text-sm font-semibold transition-colors"
            >
              Grant Audio Permission
            </button>
            {permissionStatus === 'denied' && (
              <button
                type="button"
                onClick={onOpenSettings}
                className="min-h-[44px] px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-white/[0.12] text-sm font-medium text-zinc-800 dark:text-[#F4F4F6] inline-flex items-center gap-2"
              >
                <Settings className="w-4 h-4" />
                <span>Open App Settings</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Scanning State
  if (isScanning && tracks.length === 0) {
    return (
      <div className="px-4 sm:px-8 py-16 max-w-2xl mx-auto text-center space-y-4">
        <Loader2 className="w-8 h-8 text-[#E85D3F] animate-spin mx-auto" />
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-[#F4F4F6]">
          Scanning Local Audio Library
        </h1>
        <p className="text-sm text-zinc-600 dark:text-[#9C9CA6]">
          Reading track metadata, folders, and album artwork from your device.
        </p>
      </div>
    );
  }

  // Error State
  if (scanError && tracks.length === 0) {
    return (
      <div className="px-4 sm:px-8 py-12 max-w-2xl mx-auto">
        <div className="p-8 rounded-2xl bg-white dark:bg-[#131316] border border-red-300 dark:border-red-500/30 space-y-4">
          <div className="w-11 h-11 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-zinc-900 dark:text-[#F4F4F6]">
            Unable to Read Audio Library
          </h1>
          <p className="text-sm text-zinc-600 dark:text-[#9C9CA6]">{scanError}</p>
          <button
            type="button"
            onClick={onRescan}
            className="min-h-[42px] px-4 py-2 rounded-lg bg-[#E85D3F] text-white text-sm font-semibold inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Scan</span>
          </button>
        </div>
      </div>
    );
  }

  // Empty Library State (Zero fake sample tracks!)
  if (tracks.length === 0) {
    return (
      <div className="px-4 sm:px-8 py-10 max-w-3xl mx-auto">
        <div className="p-8 sm:p-10 rounded-2xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.08] space-y-6">
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#E85D3F]">
              Offline Music Library
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-zinc-900 dark:text-[#F4F4F6]">
              {isNativeAndroid
                ? 'No Audio Files Found on Device'
                : 'Load Your Local Music Collection'}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-[#9C9CA6] leading-relaxed max-w-xl">
              {isNativeAndroid
                ? 'Add MP3, FLAC, WAV, M4A, AAC, or OGG files to your phone’s Music or Downloads folder, then rescan your library.'
                : 'Select audio files or a music folder from your device. Imported tracks and .lrc lyrics are stored offline in your browser for real playback and EQ shaping.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isNativeAndroid ? (
              <button
                type="button"
                onClick={onRescan}
                className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#E85D3F] hover:bg-[#D55033] text-white text-sm font-semibold inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Rescan Device Storage</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onImportFiles}
                  className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#E85D3F] hover:bg-[#D55033] text-white text-sm font-semibold inline-flex items-center gap-2"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>Import Audio Files</span>
                </button>
                <button
                  type="button"
                  onClick={onImportFolder}
                  className="min-h-[44px] px-4 py-2.5 rounded-lg border border-zinc-300 dark:border-white/[0.12] text-sm font-medium text-zinc-800 dark:text-[#F4F4F6] inline-flex items-center gap-2"
                >
                  <FolderOpen className="w-4 h-4" />
                  <span>Select Music Folder</span>
                </button>
              </>
            )}
          </div>

          <p className="text-xs font-mono text-zinc-500 dark:text-[#7C7C87]">
            Supported formats: MP3 · FLAC · WAV · M4A · AAC · OGG · OPUS · LRC Lyrics
          </p>
        </div>
      </div>
    );
  }

  const allTrackIds = tracks.map((t) => t.id);

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-8 max-w-6xl">
      {/* Library Overview Strip */}
      <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-white/[0.08]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-zinc-900 dark:text-[#F4F4F6]">
            Your Music Library
          </h1>
          <p className="text-xs font-mono tabular-nums text-zinc-500 dark:text-[#8C8C96] mt-1.5">
            {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'} ·{' '}
            {albums.length} {albums.length === 1 ? 'album' : 'albums'} ·{' '}
            {artists.length} {artists.length === 1 ? 'artist' : 'artists'} ·{' '}
            {folders.length} {folders.length === 1 ? 'folder' : 'folders'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onPlayTrack(tracks[0].id, allTrackIds)}
            className="min-h-[42px] px-4 py-2 rounded-lg bg-[#E85D3F] hover:bg-[#D55033] text-white text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Play Library</span>
          </button>
          <button
            type="button"
            onClick={onShuffleAll}
            className="min-h-[42px] px-4 py-2 rounded-lg border border-zinc-300 dark:border-white/[0.12] bg-white dark:bg-[#151519] text-sm font-medium text-zinc-800 dark:text-[#F4F4F6] inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Shuffle className="w-4 h-4 text-[#E85D3F]" />
            <span>Shuffle All</span>
          </button>
        </div>
      </section>

      {/* Quick Section Cards */}
      <section
        aria-label="Library Sections"
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
      >
        {[
          { label: 'Tracks', count: tracks.length, view: 'tracks' as ViewTab, icon: Disc },
          { label: 'Albums', count: albums.length, view: 'albums' as ViewTab, icon: Disc },
          { label: 'Artists', count: artists.length, view: 'artists' as ViewTab, icon: Disc },
          { label: 'Folders', count: folders.length, view: 'folders' as ViewTab, icon: FolderOpen },
        ].map((card) => (
          <button
            key={card.view}
            type="button"
            onClick={() => onNavigateView(card.view)}
            className="p-4 rounded-xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.08] hover:border-[#E85D3F]/60 text-left transition-colors"
          >
            <p className="font-mono text-2xl font-bold tabular-nums text-zinc-900 dark:text-[#F4F4F6]">
              {card.count}
            </p>
            <p className="text-xs font-medium text-zinc-500 dark:text-[#8C8C96] mt-1">
              {card.label}
            </p>
          </button>
        ))}
      </section>

      {/* Recently Played */}
      {recentlyPlayed.length > 0 && (
        <section aria-labelledby="recent-heading" className="space-y-3">
          <h2
            id="recent-heading"
            className="text-lg font-semibold text-zinc-900 dark:text-[#F4F4F6]"
          >
            Recently Played
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {recentlyPlayed.slice(0, 6).map((track) => {
              const isCurrent = track.id === currentTrackId;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() =>
                    isCurrent
                      ? onTogglePlayPause()
                      : onPlayTrack(track.id, allTrackIds)
                  }
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.07] hover:border-[#E85D3F]/50 text-left transition-colors"
                >
                  <CoverArt
                    src={track.artworkUrl}
                    alt={`${track.album} artwork`}
                    size="sm"
                    className="w-12 h-12 rounded-lg shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium truncate ${
                        isCurrent
                          ? 'text-[#E85D3F]'
                          : 'text-zinc-900 dark:text-[#F4F4F6]'
                      }`}
                    >
                      {track.title}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-[#8C8C96] truncate">
                      {track.artist}
                    </p>
                  </div>
                  {isCurrent && isPlaying ? (
                    <Pause className="w-4 h-4 text-[#E85D3F] shrink-0 mr-1" />
                  ) : (
                    <Play className="w-4 h-4 text-zinc-400 dark:text-[#7C7C87] shrink-0 mr-1" />
                  )}
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* Most Played */}
      {mostPlayed.length > 0 && (
        <section aria-labelledby="most-played-heading" className="space-y-3">
          <h2
            id="most-played-heading"
            className="text-lg font-semibold text-zinc-900 dark:text-[#F4F4F6]"
          >
            Most Played
          </h2>
          <ul className="divide-y divide-zinc-200 dark:divide-white/[0.06] border-t border-zinc-200 dark:border-white/[0.08]">
            {mostPlayed.slice(0, 5).map(({ track, count }) => (
              <li
                key={track.id}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <button
                  type="button"
                  onClick={() => onPlayTrack(track.id, allTrackIds)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <CoverArt
                    src={track.artworkUrl}
                    alt={`${track.album} artwork`}
                    size="sm"
                    className="w-10 h-10 rounded shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-[#F4F4F6] truncate">
                      {track.title}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-[#8C8C96] truncate">
                      {track.artist}
                    </p>
                  </div>
                </button>
                <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-[#7C7C87] shrink-0">
                  {count} {count === 1 ? 'play' : 'plays'} ·{' '}
                  {formatTimecode(track.durationSec)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Albums Shelf */}
      {albums.length > 0 && (
        <section aria-labelledby="albums-shelf-heading" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2
              id="albums-shelf-heading"
              className="text-lg font-semibold text-zinc-900 dark:text-[#F4F4F6]"
            >
              Albums
            </h2>
            <button
              type="button"
              onClick={() => onNavigateView('albums')}
              className="text-xs font-medium text-[#E85D3F] hover:underline"
            >
              View All
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {albums.slice(0, 10).map((album) => (
              <button
                key={album.id}
                type="button"
                onClick={() => onOpenAlbum(album.id)}
                className="group text-left flex flex-col"
              >
                <div className="aspect-square w-full rounded-xl overflow-hidden border border-zinc-200 dark:border-white/[0.08] mb-2.5">
                  <CoverArt
                    src={album.artworkUrl}
                    alt={`${album.title} cover`}
                    className="w-full h-full transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                </div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F6] truncate">
                  {album.title}
                </p>
                <p className="text-xs text-zinc-500 dark:text-[#8C8C96] truncate">
                  {album.artist}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Recently Added */}
      {tracks.length > 0 && (
        <section aria-labelledby="recently-added-heading" className="space-y-3">
          <div className="flex items-baseline justify-between">
            <h2
              id="recently-added-heading"
              className="text-lg font-semibold text-zinc-900 dark:text-[#F4F4F6]"
            >
              Recently Added
            </h2>
            <button
              type="button"
              onClick={() => onNavigateView('tracks')}
              className="text-xs font-medium text-[#E85D3F] hover:underline"
            >
              View Tracks
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {getRecentlyAddedTracks(tracks, 6).map((track) => {
              const isCurrent = track.id === currentTrackId;
              return (
                <button
                  key={track.id}
                  type="button"
                  onClick={() =>
                    isCurrent
                      ? onTogglePlayPause()
                      : onPlayTrack(track.id, allTrackIds)
                  }
                  className="flex items-center gap-3 p-2.5 rounded-xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.07] hover:border-[#E85D3F]/50 text-left transition-colors"
                >
                  <CoverArt
                    src={track.artworkUrl}
                    alt={`${track.album} artwork`}
                    size="sm"
                    className="w-11 h-11 rounded-lg shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm font-medium truncate ${
                        isCurrent
                          ? 'text-[#E85D3F]'
                          : 'text-zinc-900 dark:text-[#F4F4F6]'
                      }`}
                    >
                      {track.title}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-[#8C8C96] truncate">
                      {track.artist} · {track.formatLabel}
                    </p>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-[#7C7C87] shrink-0">
                    {formatTimecode(track.durationSec)}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
