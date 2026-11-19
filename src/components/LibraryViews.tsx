import { useState } from 'react';
import {
  ArrowLeft,
  ChevronRight,
  FolderOpen,
  Heart,
  ImagePlus,
  ListPlus,
  Pause,
  Play,
  Shuffle,
} from 'lucide-react';
import type {
  AlbumGroup,
  ArtistGroup,
  FolderGroup,
  Track,
} from '../types/music';
import { formatAlbumDuration, formatTimecode } from '../utils/musicLogic';
import { CoverArt } from './CoverArt';

interface AlbumsGridViewProps {
  albums: AlbumGroup[];
  onOpenAlbum: (albumId: string) => void;
  onPlayAlbum: (albumId: string) => void;
}

export function AlbumsGridView({
  albums,
  onOpenAlbum,
  onPlayAlbum,
}: AlbumsGridViewProps) {
  return (
    <div className="px-4 sm:px-8 py-6 space-y-6 max-w-6xl">
      <div className="pb-4 border-b border-zinc-200 dark:border-white/[0.08] flex items-baseline justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-zinc-900 dark:text-[#F4F4F6]">
          Albums
        </h1>
        <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-[#7C7C87]">
          {albums.length} {albums.length === 1 ? 'album' : 'albums'}
        </span>
      </div>

      {albums.length === 0 ? (
        <div className="py-12 px-6 rounded-xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.07] text-center text-sm text-zinc-600 dark:text-[#9C9CA6]">
          No albums found in your library.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {albums.map((album) => (
            <article key={album.id} className="group flex flex-col">
              <div className="relative aspect-square rounded-xl overflow-hidden border border-zinc-200 dark:border-white/[0.08] mb-2.5">
                <button
                  type="button"
                  onClick={() => onOpenAlbum(album.id)}
                  aria-label={`Open album ${album.title}`}
                  className="block w-full h-full"
                >
                  <CoverArt
                    src={album.artworkUrl}
                    alt={`${album.title} cover`}
                    className="w-full h-full transition-transform duration-200 group-hover:scale-[1.03]"
                  />
                </button>
                <button
                  type="button"
                  onClick={() => onPlayAlbum(album.id)}
                  aria-label={`Play ${album.title}`}
                  className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-[#E85D3F] text-white flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
                >
                  <Play className="w-4 h-4 fill-current ml-0.5" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => onOpenAlbum(album.id)}
                className="text-left"
              >
                <h2 className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F6] truncate hover:underline">
                  {album.title}
                </h2>
              </button>
              <p className="text-xs text-zinc-600 dark:text-[#9C9CA6] truncate">
                {album.artist}
              </p>
              <p className="text-[11px] font-mono tabular-nums text-zinc-500 dark:text-[#6E6E78] mt-0.5">
                {album.trackIds.length} tracks
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

interface ArtistsGridViewProps {
  artists: ArtistGroup[];
  onOpenArtist: (artistName: string) => void;
}

export function ArtistsGridView({
  artists,
  onOpenArtist,
}: ArtistsGridViewProps) {
  return (
    <div className="px-4 sm:px-8 py-6 space-y-6 max-w-6xl">
      <div className="pb-4 border-b border-zinc-200 dark:border-white/[0.08] flex items-baseline justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-zinc-900 dark:text-[#F4F4F6]">
          Artists
        </h1>
        <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-[#7C7C87]">
          {artists.length} {artists.length === 1 ? 'artist' : 'artists'}
        </span>
      </div>

      {artists.length === 0 ? (
        <div className="py-12 px-6 rounded-xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.07] text-center text-sm text-zinc-600 dark:text-[#9C9CA6]">
          No artists found in your library.
        </div>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {artists.map((artist) => (
            <li key={artist.name}>
              <button
                type="button"
                onClick={() => onOpenArtist(artist.name)}
                className="w-full p-3.5 rounded-xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.08] hover:border-[#E85D3F]/60 flex items-center justify-between gap-3 text-left transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <CoverArt
                    src={artist.artworkUrl}
                    alt={`${artist.name}`}
                    size="sm"
                    className="w-12 h-12 rounded-full shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F6] truncate">
                      {artist.name}
                    </p>
                    <p className="text-xs font-mono tabular-nums text-zinc-500 dark:text-[#8C8C96] mt-0.5">
                      {artist.albumIds.length}{' '}
                      {artist.albumIds.length === 1 ? 'album' : 'albums'} ·{' '}
                      {artist.trackIds.length}{' '}
                      {artist.trackIds.length === 1 ? 'track' : 'tracks'}
                    </p>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400 dark:text-[#6E6E78] shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface FoldersViewProps {
  folders: FolderGroup[];
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlayTrack: (trackId: string, queueIds: string[]) => void;
  onTogglePlayPause: () => void;
}

export function FoldersView({
  folders,
  tracks,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onTogglePlayPause,
}: FoldersViewProps) {
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(
    null
  );

  const activeFolder = folders.find((f) => f.path === selectedFolderPath) ?? null;
  const folderTracks = activeFolder
    ? activeFolder.trackIds
        .map((id) => tracks.find((t) => t.id === id))
        .filter((t): t is Track => Boolean(t))
    : [];

  if (activeFolder) {
    const queueIds = folderTracks.map((t) => t.id);
    return (
      <div className="px-4 sm:px-8 py-6 space-y-6 max-w-5xl">
        <button
          type="button"
          onClick={() => setSelectedFolderPath(null)}
          className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-[#9C9CA6] hover:text-zinc-900 dark:hover:text-[#F4F4F6]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>All Folders</span>
        </button>

        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-4 border-b border-zinc-200 dark:border-white/[0.08]">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-[#F4F4F6]">
              {activeFolder.name}
            </h1>
            <p className="text-xs font-mono text-zinc-500 dark:text-[#7C7C87] mt-1 break-all">
              {activeFolder.path} · {folderTracks.length} tracks ·{' '}
              {formatAlbumDuration(folderTracks)}
            </p>
          </div>
          {folderTracks.length > 0 && (
            <button
              type="button"
              onClick={() => onPlayTrack(folderTracks[0].id, queueIds)}
              className="min-h-[40px] px-4 py-2 rounded-lg bg-[#E85D3F] text-white text-xs font-semibold inline-flex items-center gap-2 self-start sm:self-auto"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Play Folder</span>
            </button>
          )}
        </div>

        <ul className="divide-y divide-zinc-200 dark:divide-white/[0.06] border-t border-zinc-200 dark:border-white/[0.08]">
          {folderTracks.map((track, idx) => {
            const isCurrent = track.id === currentTrackId;
            return (
              <li
                key={track.id}
                className="flex items-center justify-between gap-3 py-2.5 px-2 hover:bg-zinc-100/60 dark:hover:bg-white/[0.03]"
              >
                <button
                  type="button"
                  onClick={() =>
                    isCurrent
                      ? onTogglePlayPause()
                      : onPlayTrack(track.id, queueIds)
                  }
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <span className="w-7 text-center font-mono text-xs tabular-nums text-zinc-500 dark:text-[#7C7C87]">
                    {isCurrent && isPlaying ? (
                      <Pause className="w-3.5 h-3.5 text-[#E85D3F] mx-auto fill-current" />
                    ) : (
                      String(idx + 1).padStart(2, '0')
                    )}
                  </span>
                  <CoverArt
                    src={track.artworkUrl}
                    alt={`${track.album} artwork`}
                    size="sm"
                    className="w-9 h-9 rounded shrink-0"
                  />
                  <div className="min-w-0">
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
                </button>
                <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-[#7C7C87]">
                  {formatTimecode(track.durationSec)}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-8 py-6 space-y-6 max-w-5xl">
      <div className="pb-4 border-b border-zinc-200 dark:border-white/[0.08] flex items-baseline justify-between">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-zinc-900 dark:text-[#F4F4F6]">
          Folders
        </h1>
        <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-[#7C7C87]">
          {folders.length} {folders.length === 1 ? 'folder' : 'folders'}
        </span>
      </div>

      {folders.length === 0 ? (
        <div className="py-12 px-6 rounded-xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.07] text-center text-sm text-zinc-600 dark:text-[#9C9CA6]">
          No audio folders found.
        </div>
      ) : (
        <ul className="space-y-2">
          {folders.map((folder) => (
            <li key={folder.path}>
              <button
                type="button"
                onClick={() => setSelectedFolderPath(folder.path)}
                className="w-full p-4 rounded-xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.08] hover:border-[#E85D3F]/60 flex items-center justify-between gap-4 text-left transition-colors"
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-zinc-100 dark:bg-[#1D1D22] flex items-center justify-center text-[#E85D3F] shrink-0">
                    <FolderOpen className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F6] truncate">
                      {folder.name}
                    </p>
                    <p className="text-xs font-mono text-zinc-500 dark:text-[#7C7C87] truncate">
                      {folder.path}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-[#8C8C96]">
                    {folder.trackIds.length} tracks
                  </span>
                  <ChevronRight className="w-4 h-4 text-zinc-400" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface AlbumDetailViewProps {
  album: AlbumGroup;
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  favoriteIds: string[];
  onBack: () => void;
  onPlayTracks: (startTrackId: string, queueIds: string[], shuffle?: boolean) => void;
  onTogglePlayPause: () => void;
  onToggleFavorite: (trackId: string) => void;
  onAddToQueue: (trackId: string) => void;
  onOpenArtist: (artistName: string) => void;
  onSelectCustomAlbumCover: (album: AlbumGroup) => void;
}

export function AlbumDetailView({
  album,
  tracks,
  currentTrackId,
  isPlaying,
  favoriteIds,
  onBack,
  onPlayTracks,
  onTogglePlayPause,
  onToggleFavorite,
  onAddToQueue,
  onOpenArtist,
  onSelectCustomAlbumCover,
}: AlbumDetailViewProps) {
  const orderedTracks = [...tracks].sort((a, b) => a.trackNumber - b.trackNumber);
  const queueIds = orderedTracks.map((t) => t.id);
  const isAlbumPlaying =
    isPlaying && orderedTracks.some((t) => t.id === currentTrackId);

  return (
    <div className="px-4 sm:px-8 py-6 space-y-8 max-w-5xl">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-[#9C9CA6] hover:text-zinc-900 dark:hover:text-[#F4F4F6]"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Albums</span>
      </button>

      <section className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-stretch pb-7 border-b border-zinc-200 dark:border-white/[0.08]">
        <div className="aspect-square w-full max-w-[220px] rounded-xl overflow-hidden border border-zinc-200 dark:border-white/[0.09]">
          <CoverArt
            src={album.artworkUrl}
            alt={`${album.title} cover`}
            size="lg"
            className="w-full h-full"
          />
        </div>

        <div className="flex flex-col justify-between">
          <div className="space-y-2">
            <p className="text-xs font-medium text-[#E85D3F]">Album</p>
            <h1 className="text-2xl sm:text-4xl font-bold tracking-[-0.02em] text-zinc-900 dark:text-[#F4F4F6] text-balance">
              {album.title}
            </h1>
            <button
              type="button"
              onClick={() => onOpenArtist(album.artist)}
              className="text-base font-medium text-zinc-700 dark:text-[#C4C4CC] hover:underline"
            >
              {album.artist}
            </button>
            <p className="text-xs font-mono tabular-nums text-zinc-500 dark:text-[#8C8C96]">
              {orderedTracks.length}{' '}
              {orderedTracks.length === 1 ? 'track' : 'tracks'} ·{' '}
              {formatAlbumDuration(orderedTracks)}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-5">
            {orderedTracks.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    isAlbumPlaying
                      ? onTogglePlayPause()
                      : onPlayTracks(orderedTracks[0].id, queueIds, false)
                  }
                  className="min-h-[42px] px-5 py-2 rounded-lg bg-[#E85D3F] hover:bg-[#D55033] text-white text-sm font-semibold inline-flex items-center gap-2"
                >
                  {isAlbumPlaying ? (
                    <>
                      <Pause className="w-4 h-4 fill-current" />
                      <span>Pause</span>
                    </>
                  ) : (
                    <>
                      <Play className="w-4 h-4 fill-current" />
                      <span>Play Album</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => onPlayTracks(orderedTracks[0].id, queueIds, true)}
                  className="min-h-[42px] px-4 py-2 rounded-lg border border-zinc-300 dark:border-white/[0.12] text-sm font-medium text-zinc-800 dark:text-[#F4F4F6] inline-flex items-center gap-2"
                >
                  <Shuffle className="w-4 h-4" />
                  <span>Shuffle</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={() => onSelectCustomAlbumCover(album)}
              className="min-h-[42px] px-4 py-2 rounded-lg border border-zinc-300 dark:border-white/[0.12] text-sm font-medium text-zinc-800 dark:text-[#F4F4F6] inline-flex items-center gap-2"
            >
              <ImagePlus className="w-4 h-4 text-[#E85D3F]" />
              <span>Set Custom Cover</span>
            </button>
          </div>
        </div>
      </section>

      <ul className="divide-y divide-zinc-200 dark:divide-white/[0.06]">
        {orderedTracks.map((track) => {
          const isCurrent = track.id === currentTrackId;
          const isFav = favoriteIds.includes(track.id);
          return (
            <li
              key={track.id}
              className="flex items-center justify-between gap-4 px-2 py-2.5 hover:bg-zinc-100/60 dark:hover:bg-white/[0.03]"
            >
              <button
                type="button"
                onClick={() =>
                  isCurrent
                    ? onTogglePlayPause()
                    : onPlayTracks(track.id, queueIds, false)
                }
                className="flex items-center gap-4 min-w-0 flex-1 text-left"
              >
                <span className="w-7 text-center font-mono text-xs tabular-nums text-zinc-500 dark:text-[#8C8C96]">
                  {isCurrent && isPlaying ? (
                    <Pause className="w-3.5 h-3.5 text-[#E85D3F] mx-auto fill-current" />
                  ) : (
                    String(track.trackNumber).padStart(2, '0')
                  )}
                </span>
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      isCurrent
                        ? 'text-[#E85D3F]'
                        : 'text-zinc-900 dark:text-[#F4F4F6]'
                    }`}
                  >
                    {track.title}
                  </p>
                  <p className="text-xs font-mono text-zinc-500 dark:text-[#7C7C87]">
                    {track.formatLabel}
                  </p>
                </div>
              </button>

              <div className="flex items-center gap-1 shrink-0">
                <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-[#8C8C96] mr-2">
                  {formatTimecode(track.durationSec)}
                </span>
                <button
                  type="button"
                  onClick={() => onToggleFavorite(track.id)}
                  aria-label={
                    isFav
                      ? `Remove '${track.title}' from favorites`
                      : `Add '${track.title}' to favorites`
                  }
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-zinc-500 dark:text-[#8C8C96]"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      isFav ? 'fill-[#E85D3F] text-[#E85D3F]' : ''
                    }`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => onAddToQueue(track.id)}
                  aria-label={`Add '${track.title}' to queue`}
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-zinc-500 dark:text-[#8C8C96]"
                >
                  <ListPlus className="w-4 h-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

interface ArtistDetailViewProps {
  artistName: string;
  albums: AlbumGroup[];
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onBack: () => void;
  onOpenAlbum: (albumId: string) => void;
  onPlayTrack: (trackId: string, queueIds: string[]) => void;
  onTogglePlayPause: () => void;
}

export function ArtistDetailView({
  artistName,
  albums,
  tracks,
  currentTrackId,
  isPlaying,
  onBack,
  onOpenAlbum,
  onPlayTrack,
  onTogglePlayPause,
}: ArtistDetailViewProps) {
  const queueIds = tracks.map((t) => t.id);

  return (
    <div className="px-4 sm:px-8 py-6 space-y-8 max-w-5xl">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-zinc-600 dark:text-[#9C9CA6] hover:text-zinc-900 dark:hover:text-[#F4F4F6]"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Artists</span>
      </button>

      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 border-b border-zinc-200 dark:border-white/[0.08]">
        <div>
          <p className="text-xs font-medium text-[#E85D3F]">Artist</p>
          <h1 className="text-3xl font-bold tracking-[-0.02em] text-zinc-900 dark:text-[#F4F4F6] mt-1">
            {artistName}
          </h1>
          <p className="text-xs font-mono tabular-nums text-zinc-500 dark:text-[#8C8C96] mt-1">
            {albums.length} {albums.length === 1 ? 'album' : 'albums'} ·{' '}
            {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
          </p>
        </div>

        {tracks.length > 0 && (
          <button
            type="button"
            onClick={() => onPlayTrack(tracks[0].id, queueIds)}
            className="min-h-[42px] px-5 py-2 rounded-lg bg-[#E85D3F] text-white text-sm font-semibold inline-flex items-center gap-2 self-start sm:self-auto"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>Play Artist</span>
          </button>
        )}
      </div>

      {albums.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-[#F4F4F6]">
            Albums
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {albums.map((album) => (
              <button
                key={album.id}
                type="button"
                onClick={() => onOpenAlbum(album.id)}
                className="text-left group"
              >
                <div className="aspect-square rounded-xl overflow-hidden border border-zinc-200 dark:border-white/[0.08] mb-2">
                  <CoverArt
                    src={album.artworkUrl}
                    alt={`${album.title} cover`}
                    className="w-full h-full group-hover:scale-[1.03] transition-transform"
                  />
                </div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F6] truncate">
                  {album.title}
                </p>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-[#F4F4F6]">
          All Tracks
        </h2>
        <ul className="divide-y divide-zinc-200 dark:divide-white/[0.06] border-t border-zinc-200 dark:border-white/[0.08]">
          {tracks.map((track, idx) => {
            const isCurrent = track.id === currentTrackId;
            return (
              <li key={track.id}>
                <button
                  type="button"
                  onClick={() =>
                    isCurrent
                      ? onTogglePlayPause()
                      : onPlayTrack(track.id, queueIds)
                  }
                  className="w-full flex items-center justify-between gap-3 py-2.5 px-2 text-left hover:bg-zinc-100/60 dark:hover:bg-white/[0.03]"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 text-center font-mono text-xs tabular-nums text-zinc-500">
                      {isCurrent && isPlaying ? (
                        <Pause className="w-3.5 h-3.5 text-[#E85D3F] mx-auto fill-current" />
                      ) : (
                        String(idx + 1).padStart(2, '0')
                      )}
                    </span>
                    <CoverArt
                      src={track.artworkUrl}
                      alt={`${track.album} cover`}
                      size="sm"
                      className="w-9 h-9 rounded shrink-0"
                    />
                    <div className="min-w-0">
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
                        {track.album}
                      </p>
                    </div>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-zinc-500">
                    {formatTimecode(track.durationSec)}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
