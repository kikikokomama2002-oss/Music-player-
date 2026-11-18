import { useState } from 'react';
import { Bookmark, Heart, ListPlus, Pause, Play } from 'lucide-react';
import type { Album, Track } from '../types/music';
import { formatTimecode } from '../utils/musicLogic';
import { CoverArt } from './CoverArt';

interface LibraryViewProps {
  likedTracks: Track[];
  savedAlbums: Album[];
  currentTrackId: string | null;
  isPlaying: boolean;
  onPlayTrack: (trackId: string, queueSourceIds?: string[]) => void;
  onTogglePlayPause: () => void;
  onToggleLikeTrack: (trackId: string) => void;
  onToggleSaveAlbum: (albumId: string) => void;
  onPlayAlbum: (albumId: string) => void;
  onOpenAlbum: (albumId: string) => void;
  onAddToQueue: (trackId: string) => void;
  onNavigateDiscover: () => void;
}

export function LibraryView({
  likedTracks,
  savedAlbums,
  currentTrackId,
  isPlaying,
  onPlayTrack,
  onTogglePlayPause,
  onToggleLikeTrack,
  onToggleSaveAlbum,
  onPlayAlbum,
  onOpenAlbum,
  onAddToQueue,
  onNavigateDiscover,
}: LibraryViewProps) {
  const [tab, setTab] = useState<'tracks' | 'albums'>('tracks');

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-6 max-w-5xl">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-white/[0.08]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-[#F4F4F6]">
            Your Library
          </h1>
          <p className="text-sm text-[#8C8C96] mt-1 font-mono tabular-nums">
            {likedTracks.length} liked{' '}
            {likedTracks.length === 1 ? 'track' : 'tracks'} ·{' '}
            {savedAlbums.length} saved{' '}
            {savedAlbums.length === 1 ? 'album' : 'albums'}
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Library sections"
          className="inline-flex items-center gap-1 p-1 bg-[#141418] border border-white/[0.07] rounded-lg self-start"
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'tracks'}
            onClick={() => setTab('tracks')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              tab === 'tracks'
                ? 'bg-[#23232A] text-[#F4F4F6]'
                : 'text-[#8C8C96] hover:text-[#F4F4F6]'
            }`}
          >
            Liked Tracks
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'albums'}
            onClick={() => setTab('albums')}
            className={`px-3.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              tab === 'albums'
                ? 'bg-[#23232A] text-[#F4F4F6]'
                : 'text-[#8C8C96] hover:text-[#F4F4F6]'
            }`}
          >
            Saved Albums
          </button>
        </div>
      </div>

      {tab === 'tracks' ? (
        likedTracks.length === 0 ? (
          <div className="py-14 px-6 rounded-xl bg-[#131316] border border-white/[0.07] text-center space-y-3">
            <p className="text-base font-medium text-[#F4F4F6]">
              No liked tracks yet
            </p>
            <p className="text-sm text-[#8C8C96] max-w-md mx-auto">
              Select the heart icon on any track in Discover to keep your
              favorite recordings within reach.
            </p>
            <button
              type="button"
              onClick={onNavigateDiscover}
              className="mt-2 px-4 py-2.5 rounded-lg bg-[#E85D3F] hover:bg-[#D55033] text-xs font-semibold text-white transition-colors"
            >
              Browse Catalog
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05] border-t border-white/[0.08]">
            {likedTracks.map((track, idx) => {
              const isCurrent = track.id === currentTrackId;
              const queueIds = likedTracks.map((t) => t.id);
              return (
                <li
                  key={track.id}
                  className={`flex items-center justify-between gap-4 px-3 py-2.5 transition-colors ${
                    isCurrent ? 'bg-[#19191F]' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <button
                      type="button"
                      onClick={() => {
                        if (isCurrent) onTogglePlayPause();
                        else onPlayTrack(track.id, queueIds);
                      }}
                      aria-label={
                        isCurrent && isPlaying
                          ? `Pause '${track.title}'`
                          : `Play '${track.title}'`
                      }
                      className="w-10 h-10 rounded-lg flex items-center justify-center font-mono text-xs tabular-nums text-[#8C8C96] hover:text-[#F4F4F6] shrink-0"
                    >
                      {isCurrent && isPlaying ? (
                        <Pause className="w-4 h-4 text-[#E85D3F] fill-current" />
                      ) : (
                        <span className={isCurrent ? 'text-[#E85D3F]' : ''}>
                          {String(idx + 1).padStart(2, '0')}
                        </span>
                      )}
                    </button>
                    <CoverArt
                      src={track.coverUrl}
                      alt={`${track.albumTitle} cover`}
                      size="sm"
                      className="w-10 h-10 rounded-md shrink-0 border border-white/[0.08]"
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium truncate ${
                          isCurrent ? 'text-[#E85D3F]' : 'text-[#F4F4F6]'
                        }`}
                      >
                        {track.title}
                      </p>
                      <p className="text-xs text-[#8C8C96] truncate">
                        {track.artist} · {track.albumTitle}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <span className="hidden sm:inline font-mono text-xs tabular-nums text-[#7C7C87] mr-2">
                      {formatTimecode(track.durationSec)}
                    </span>
                    <button
                      type="button"
                      onClick={() => onToggleLikeTrack(track.id)}
                      aria-label={`Unlike '${track.title}'`}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#E85D3F] hover:bg-white/[0.05]"
                    >
                      <Heart className="w-4 h-4 fill-current" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onAddToQueue(track.id)}
                      aria-label={`Add '${track.title}' to queue`}
                      className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#8C8C96] hover:text-[#F4F4F6] hover:bg-white/[0.05]"
                    >
                      <ListPlus className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )
      ) : savedAlbums.length === 0 ? (
        <div className="py-14 px-6 rounded-xl bg-[#131316] border border-white/[0.07] text-center space-y-3">
          <p className="text-base font-medium text-[#F4F4F6]">
            No saved albums yet
          </p>
          <p className="text-sm text-[#8C8C96] max-w-md mx-auto">
            Save any release from Discover to build your personal studio shelf.
          </p>
          <button
            type="button"
            onClick={onNavigateDiscover}
            className="mt-2 px-4 py-2.5 rounded-lg bg-[#E85D3F] hover:bg-[#D55033] text-xs font-semibold text-white transition-colors"
          >
            Explore Releases
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
          {savedAlbums.map((album) => (
            <article key={album.id} className="group flex flex-col">
              <div className="relative aspect-square rounded-xl overflow-hidden border border-white/[0.08] bg-[#151519] mb-3">
                <button
                  type="button"
                  onClick={() => onOpenAlbum(album.id)}
                  aria-label={`Open album ${album.title}`}
                  className="block w-full h-full"
                >
                  <CoverArt
                    src={album.coverUrl}
                    alt={`${album.title} cover`}
                    className="w-full h-full transition-transform duration-300 group-hover:scale-[1.03]"
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
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onOpenAlbum(album.id)}
                    className="text-sm font-semibold text-[#F4F4F6] truncate block text-left hover:underline"
                  >
                    {album.title}
                  </button>
                  <p className="text-xs text-[#8C8C96] truncate">
                    {album.artist}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onToggleSaveAlbum(album.id)}
                  aria-label={`Remove '${album.title}' from saved albums`}
                  className="min-w-[36px] min-h-[36px] flex items-center justify-center text-[#E85D3F] hover:bg-white/[0.05] rounded-lg shrink-0"
                >
                  <Bookmark className="w-4 h-4 fill-current" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
