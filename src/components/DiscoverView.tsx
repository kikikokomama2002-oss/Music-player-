import {
  Bookmark,
  Heart,
  ListPlus,
  Pause,
  Play,
  Plus,
} from 'lucide-react';
import type { Album, Playlist, Track } from '../types/music';
import { formatAlbumDuration, formatTimecode } from '../utils/musicLogic';
import { CoverArt } from './CoverArt';

interface DiscoverViewProps {
  featuredAlbum: Album;
  featuredAlbumTracks: Track[];
  albums: Album[];
  tracks: Track[];
  allTracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  likedTrackIds: string[];
  savedAlbumIds: string[];
  playlists: Playlist[];
  hasActiveFilter: boolean;
  onPlayTrack: (trackId: string, queueSourceIds?: string[]) => void;
  onTogglePlayPause: () => void;
  onPlayAlbum: (albumId: string) => void;
  onOpenAlbum: (albumId: string) => void;
  onToggleLikeTrack: (trackId: string) => void;
  onToggleSaveAlbum: (albumId: string) => void;
  onAddToQueue: (trackId: string) => void;
  onAddTrackToPlaylist: (playlistId: string, trackId: string) => void;
  onClearFilters: () => void;
}

export function DiscoverView({
  featuredAlbum,
  featuredAlbumTracks,
  albums,
  tracks,
  allTracks,
  currentTrackId,
  isPlaying,
  likedTrackIds,
  savedAlbumIds,
  playlists,
  hasActiveFilter,
  onPlayTrack,
  onTogglePlayPause,
  onPlayAlbum,
  onOpenAlbum,
  onToggleLikeTrack,
  onToggleSaveAlbum,
  onAddToQueue,
  onAddTrackToPlaylist,
  onClearFilters,
}: DiscoverViewProps) {
  const isFeaturedAlbumPlaying =
    isPlaying &&
    featuredAlbumTracks.some((t) => t.id === currentTrackId);
  const isFeaturedSaved = savedAlbumIds.includes(featuredAlbum.id);

  return (
    <div className="px-4 sm:px-8 py-4 sm:py-8 space-y-8 sm:space-y-10 max-w-6xl">
      {/* Featured Release Hero (hidden when user is actively searching/filtering down) */}
      {!hasActiveFilter && (
        <section
          aria-labelledby="featured-album-heading"
          className="grid grid-cols-1 md:grid-cols-[260px_1fr] lg:grid-cols-[300px_1fr] gap-5 lg:gap-8 items-stretch pb-7 border-b border-white/[0.08]"
        >
          <div className="aspect-square w-full max-w-[200px] md:max-w-[300px] rounded-xl overflow-hidden border border-white/[0.09]">
            <CoverArt
              src={featuredAlbum.coverUrl}
              alt={`${featuredAlbum.title} by ${featuredAlbum.artist}`}
              size="lg"
              className="w-full h-full"
            />
          </div>

          <div className="flex flex-col justify-between py-1">
            <div className="space-y-3">
              <p className="text-xs font-medium text-[#E85D3F]">
                Featured Release
              </p>
              <h1
                id="featured-album-heading"
                className="text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-[-0.025em] leading-[1.1] text-[#F4F4F6] text-balance"
              >
                {featuredAlbum.title}
              </h1>
              <p className="text-base sm:text-lg text-[#C4C4CC] font-medium">
                {featuredAlbum.artist}
              </p>

              {/* Zero-pill unboxed metadata */}
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-[#8C8C96] pt-1">
                <span>{featuredAlbum.genre}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">{featuredAlbum.year}</span>
                <span aria-hidden="true">·</span>
                <span>{featuredAlbum.label}</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {featuredAlbumTracks.length} tracks,{' '}
                  {formatAlbumDuration(featuredAlbumTracks)}
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {featuredAlbum.audioSpec}
                </span>
              </div>

              <p className="text-sm text-[#9C9CA6] leading-relaxed max-w-2xl pt-2">
                {featuredAlbum.linerNote}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-6">
              <button
                type="button"
                onClick={() => {
                  if (isFeaturedAlbumPlaying) {
                    onTogglePlayPause();
                  } else {
                    onPlayAlbum(featuredAlbum.id);
                  }
                }}
                className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#E85D3F] hover:bg-[#D55033] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-white"
              >
                {isFeaturedAlbumPlaying ? (
                  <>
                    <Pause className="w-4 h-4 fill-current" />
                    <span>Pause Album</span>
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
                onClick={() => onToggleSaveAlbum(featuredAlbum.id)}
                aria-pressed={isFeaturedSaved}
                className={`min-h-[44px] px-4 py-2.5 rounded-lg border text-sm font-medium inline-flex items-center gap-2 transition-colors duration-150 whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#E85D3F] ${
                  isFeaturedSaved
                    ? 'bg-[#1D1D22] border-white/20 text-[#F4F4F6]'
                    : 'bg-transparent border-white/[0.12] text-[#C4C4CC] hover:text-[#F4F4F6] hover:border-white/25'
                }`}
              >
                <Bookmark
                  className={`w-4 h-4 ${
                    isFeaturedSaved ? 'fill-[#E85D3F] text-[#E85D3F]' : ''
                  }`}
                  strokeWidth={1.75}
                />
                <span>{isFeaturedSaved ? 'Saved' : 'Save Album'}</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenAlbum(featuredAlbum.id)}
                className="min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-medium text-[#9C9CA6] hover:text-[#F4F4F6] transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-[#E85D3F]"
              >
                View Liner Notes
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Curated Releases Shelf */}
      <section aria-labelledby="curated-releases-heading" className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
          <h2
            id="curated-releases-heading"
            className="text-xl font-semibold tracking-[-0.015em] text-[#F4F4F6]"
          >
            {hasActiveFilter ? 'Matching Albums' : 'Curated Releases'}
          </h2>
          <span className="font-mono text-xs tabular-nums text-[#7C7C87]">
            {albums.length} {albums.length === 1 ? 'release' : 'releases'}
          </span>
        </div>

        {albums.length === 0 ? (
          <div className="py-8 border-y border-white/[0.06] text-sm text-[#8C8C96]">
            No albums match the current filter.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {albums.map((album) => {
              const albumTracks = allTracks.filter((t) => t.albumId === album.id);
              const isAlbumActive = albumTracks.some(
                (t) => t.id === currentTrackId
              );
              return (
                <article key={album.id} className="group flex flex-col">
                  <div className="relative aspect-square rounded-xl overflow-hidden border border-white/[0.08] bg-[#151519] mb-3">
                    <button
                      type="button"
                      onClick={() => onOpenAlbum(album.id)}
                      aria-label={`Open album ${album.title} by ${album.artist}`}
                      className="block w-full h-full focus-visible:outline-2 focus-visible:outline-[#E85D3F]"
                    >
                      <CoverArt
                        src={album.coverUrl}
                        alt={`${album.title} album cover`}
                        className="w-full h-full transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (isAlbumActive && isPlaying) {
                          onTogglePlayPause();
                        } else {
                          onPlayAlbum(album.id);
                        }
                      }}
                      aria-label={
                        isAlbumActive && isPlaying
                          ? `Pause ${album.title}`
                          : `Play ${album.title}`
                      }
                      className={`absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-[#E85D3F] text-white flex items-center justify-center shadow-lg transition-all duration-150 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-white ${
                        isAlbumActive
                          ? 'opacity-100 translate-y-0'
                          : 'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0'
                      }`}
                    >
                      {isAlbumActive && isPlaying ? (
                        <Pause className="w-4 h-4 fill-current" />
                      ) : (
                        <Play className="w-4 h-4 fill-current ml-0.5" />
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => onOpenAlbum(album.id)}
                    className="text-left focus-visible:outline-2 focus-visible:outline-[#E85D3F] rounded"
                  >
                    <h3 className="text-sm font-semibold text-[#F4F4F6] truncate group-hover:text-white">
                      {album.title}
                    </h3>
                  </button>
                  <p className="text-xs text-[#9C9CA6] truncate mt-0.5">
                    {album.artist}
                  </p>
                  <p className="text-[11px] text-[#6E6E78] mt-1 font-mono tabular-nums truncate">
                    {album.genre} · {album.year}
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* Tracklist Table */}
      <section aria-labelledby="tracks-heading" className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2
            id="tracks-heading"
            className="text-xl font-semibold tracking-[-0.015em] text-[#F4F4F6]"
          >
            {hasActiveFilter ? 'Matching Tracks' : 'Studio Catalog'}
          </h2>
          {hasActiveFilter && (
            <button
              type="button"
              onClick={onClearFilters}
              className="text-xs font-medium text-[#E85D3F] hover:underline whitespace-nowrap shrink-0"
            >
              Reset filters
            </button>
          )}
        </div>

        {tracks.length === 0 ? (
          <div className="py-12 px-6 rounded-xl bg-[#131316] border border-white/[0.07] text-center space-y-3">
            <p className="text-sm text-[#C4C4CC]">
              No tracks matched your search or genre selection.
            </p>
            <button
              type="button"
              onClick={onClearFilters}
              className="px-4 py-2 rounded-lg bg-[#23232A] hover:bg-[#2C2C35] text-xs font-medium text-[#F4F4F6] transition-colors"
            >
              Show All Tracks
            </button>
          </div>
        ) : (
          <div className="border-t border-white/[0.08]">
            {/* Desktop Column Header */}
            <div className="hidden md:grid grid-cols-[40px_1fr_180px_110px_68px_124px] items-center gap-4 px-3 py-2.5 text-[11px] font-medium text-[#6E6E78] border-b border-white/[0.06]">
              <span className="text-center">#</span>
              <span>Track</span>
              <span>Album</span>
              <span className="text-right">Spec</span>
              <span className="text-right">Time</span>
              <span className="text-right">Actions</span>
            </div>

            <ul className="divide-y divide-white/[0.05]">
              {tracks.map((track, idx) => {
                const isCurrent = track.id === currentTrackId;
                const isLiked = likedTrackIds.includes(track.id);
                const visibleQueueIds = tracks.map((t) => t.id);

                return (
                  <li
                    key={track.id}
                    className={`group grid grid-cols-[44px_1fr_auto] md:grid-cols-[40px_1fr_180px_110px_68px_124px] items-center gap-3 md:gap-4 px-2 sm:px-3 py-2.5 transition-colors duration-150 ${
                      isCurrent
                        ? 'bg-[#19191F]'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    {/* Play / Index button */}
                    <div className="flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => {
                          if (isCurrent) {
                            onTogglePlayPause();
                          } else {
                            onPlayTrack(track.id, visibleQueueIds);
                          }
                        }}
                        aria-label={
                          isCurrent && isPlaying
                            ? `Pause '${track.title}'`
                            : `Play '${track.title}'`
                        }
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-xs font-mono tabular-nums text-[#8C8C96] hover:text-[#F4F4F6] focus-visible:outline-2 focus-visible:outline-[#E85D3F]"
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
                              {String(idx + 1).padStart(2, '0')}
                            </span>
                            <Play className="w-4 h-4 hidden group-hover:block text-[#F4F4F6] fill-current" />
                          </>
                        )}
                      </button>
                    </div>

                    {/* Cover + Title + Artist */}
                    <div className="flex items-center gap-3 min-w-0">
                      <CoverArt
                        src={track.coverUrl}
                        alt={`${track.albumTitle} cover`}
                        size="sm"
                        className="w-10 h-10 rounded-md shrink-0 border border-white/[0.08]"
                      />
                      <div className="min-w-0">
                        <button
                          type="button"
                          onClick={() => {
                            if (isCurrent) {
                              onTogglePlayPause();
                            } else {
                              onPlayTrack(track.id, visibleQueueIds);
                            }
                          }}
                          className={`text-sm font-medium truncate block text-left w-full hover:underline ${
                            isCurrent ? 'text-[#E85D3F]' : 'text-[#F4F4F6]'
                          }`}
                        >
                          {track.title}
                        </button>
                        <p className="text-xs text-[#8C8C96] truncate">
                          {track.artist}
                          <span className="md:hidden"> · {track.genre}</span>
                        </p>
                      </div>
                    </div>

                    {/* Album */}
                    <button
                      type="button"
                      onClick={() => onOpenAlbum(track.albumId)}
                      className="hidden md:block text-left text-xs text-[#9C9CA6] hover:text-[#F4F4F6] truncate"
                    >
                      {track.albumTitle}
                    </button>

                    {/* Spec & BPM */}
                    <span className="hidden md:block text-right font-mono text-[11px] tabular-nums text-[#7C7C87] truncate">
                      {track.bpm} BPM
                    </span>

                    {/* Duration */}
                    <span className="hidden md:block text-right font-mono text-xs tabular-nums text-[#8C8C96]">
                      {formatTimecode(track.durationSec)}
                    </span>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => onToggleLikeTrack(track.id)}
                        aria-label={
                          isLiked
                            ? `Unlike '${track.title}'`
                            : `Like '${track.title}'`
                        }
                        aria-pressed={isLiked}
                        className="min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center text-[#8C8C96] hover:text-[#F4F4F6] hover:bg-white/[0.05] transition-colors focus-visible:outline-2 focus-visible:outline-[#E85D3F]"
                      >
                        <Heart
                          className={`w-4 h-4 ${
                            isLiked ? 'fill-[#E85D3F] text-[#E85D3F]' : ''
                          }`}
                          strokeWidth={1.75}
                        />
                      </button>

                      <button
                        type="button"
                        onClick={() => onAddToQueue(track.id)}
                        aria-label={`Add '${track.title}' to queue`}
                        className="min-w-[40px] min-h-[40px] rounded-lg flex items-center justify-center text-[#8C8C96] hover:text-[#F4F4F6] hover:bg-white/[0.05] transition-colors focus-visible:outline-2 focus-visible:outline-[#E85D3F]"
                      >
                        <ListPlus className="w-4 h-4" strokeWidth={1.75} />
                      </button>

                      {playlists.length > 0 && (
                        <div className="hidden sm:block">
                          <button
                            type="button"
                            onClick={() =>
                              onAddTrackToPlaylist(playlists[0].id, track.id)
                            }
                            aria-label={`Add '${track.title}' to '${playlists[0].name}'`}
                            title={`Add to ${playlists[0].name}`}
                            className="min-w-[36px] min-h-[40px] rounded-lg flex items-center justify-center text-[#8C8C96] hover:text-[#F4F4F6] hover:bg-white/[0.05] transition-colors focus-visible:outline-2 focus-visible:outline-[#E85D3F]"
                          >
                            <Plus className="w-4 h-4" strokeWidth={1.75} />
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
