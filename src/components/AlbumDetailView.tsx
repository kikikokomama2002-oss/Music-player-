import {
  ArrowLeft,
  Bookmark,
  Heart,
  ListPlus,
  Pause,
  Play,
} from 'lucide-react';
import type { Album, Track } from '../types/music';
import { formatAlbumDuration, formatTimecode } from '../utils/musicLogic';
import { CoverArt } from './CoverArt';

interface AlbumDetailViewProps {
  album: Album;
  tracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  likedTrackIds: string[];
  isSaved: boolean;
  onBack: () => void;
  onPlayAlbum: (albumId: string) => void;
  onPlayTrack: (trackId: string, queueSourceIds?: string[]) => void;
  onTogglePlayPause: () => void;
  onToggleSaveAlbum: (albumId: string) => void;
  onToggleLikeTrack: (trackId: string) => void;
  onAddToQueue: (trackId: string) => void;
}

export function AlbumDetailView({
  album,
  tracks,
  currentTrackId,
  isPlaying,
  likedTrackIds,
  isSaved,
  onBack,
  onPlayAlbum,
  onPlayTrack,
  onTogglePlayPause,
  onToggleSaveAlbum,
  onToggleLikeTrack,
  onAddToQueue,
}: AlbumDetailViewProps) {
  const isAlbumPlaying =
    isPlaying && tracks.some((t) => t.id === currentTrackId);
  const albumTrackIds = tracks.map((t) => t.id);

  return (
    <div className="px-4 sm:px-8 py-6 sm:py-8 space-y-8 max-w-5xl">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm text-[#9C9CA6] hover:text-[#F4F4F6] transition-colors min-h-[40px] focus-visible:outline-2 focus-visible:outline-[#E85D3F] rounded"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to Discover</span>
      </button>

      <section className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 lg:gap-8 items-stretch pb-8 border-b border-white/[0.08]">
        <div className="aspect-square w-full max-w-[240px] rounded-xl overflow-hidden border border-white/[0.09]">
          <CoverArt
            src={album.coverUrl}
            alt={`${album.title} by ${album.artist}`}
            size="lg"
            className="w-full h-full"
          />
        </div>

        <div className="flex flex-col justify-between">
          <div className="space-y-2.5">
            <p className="text-xs font-medium text-[#8C8C96]">Album</p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-[-0.02em] text-[#F4F4F6] text-balance">
              {album.title}
            </h1>
            <p className="text-base text-[#C4C4CC] font-medium">
              {album.artist}
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#8C8C96] pt-1">
              <span>{album.genre}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{album.year}</span>
              <span aria-hidden="true">·</span>
              <span>{album.label}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {tracks.length} tracks, {formatAlbumDuration(tracks)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{album.audioSpec}</span>
            </div>
            <p className="text-sm text-[#9C9CA6] leading-relaxed max-w-xl pt-2">
              {album.linerNote}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-6">
            <button
              type="button"
              onClick={() => {
                if (isAlbumPlaying) {
                  onTogglePlayPause();
                } else {
                  onPlayAlbum(album.id);
                }
              }}
              className="min-h-[44px] px-5 py-2.5 rounded-lg bg-[#E85D3F] hover:bg-[#D55033] text-white text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              {isAlbumPlaying ? (
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
              onClick={() => onToggleSaveAlbum(album.id)}
              aria-pressed={isSaved}
              className={`min-h-[44px] px-4 py-2.5 rounded-lg border text-sm font-medium inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
                isSaved
                  ? 'bg-[#1D1D22] border-white/20 text-[#F4F4F6]'
                  : 'border-white/[0.12] text-[#C4C4CC] hover:text-[#F4F4F6]'
              }`}
            >
              <Bookmark
                className={`w-4 h-4 ${
                  isSaved ? 'fill-[#E85D3F] text-[#E85D3F]' : ''
                }`}
                strokeWidth={1.75}
              />
              <span>{isSaved ? 'Saved to Library' : 'Save Album'}</span>
            </button>
          </div>
        </div>
      </section>

      <section aria-label="Album Tracks">
        <ul className="divide-y divide-white/[0.06]">
          {tracks.map((track) => {
            const isCurrent = track.id === currentTrackId;
            const isLiked = likedTrackIds.includes(track.id);
            return (
              <li
                key={track.id}
                className={`flex items-center justify-between gap-4 px-3 py-3 transition-colors ${
                  isCurrent ? 'bg-[#19191F]' : 'hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  <button
                    type="button"
                    onClick={() => {
                      if (isCurrent) onTogglePlayPause();
                      else onPlayTrack(track.id, albumTrackIds);
                    }}
                    aria-label={
                      isCurrent && isPlaying
                        ? `Pause '${track.title}'`
                        : `Play '${track.title}'`
                    }
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-mono text-xs tabular-nums text-[#8C8C96] hover:text-[#F4F4F6]"
                  >
                    {isCurrent && isPlaying ? (
                      <Pause className="w-4 h-4 text-[#E85D3F] fill-current" />
                    ) : (
                      <span className={isCurrent ? 'text-[#E85D3F]' : ''}>
                        {String(track.trackNumber).padStart(2, '0')}
                      </span>
                    )}
                  </button>
                  <div className="min-w-0">
                    <p
                      className={`text-sm font-medium truncate ${
                        isCurrent ? 'text-[#E85D3F]' : 'text-[#F4F4F6]'
                      }`}
                    >
                      {track.title}
                    </p>
                    <p className="text-xs text-[#8C8C96] font-mono tabular-nums">
                      {track.bpm} BPM · {track.audioSpec}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-mono text-xs tabular-nums text-[#8C8C96] mr-2">
                    {formatTimecode(track.durationSec)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onToggleLikeTrack(track.id)}
                    aria-label={
                      isLiked
                        ? `Unlike '${track.title}'`
                        : `Like '${track.title}'`
                    }
                    className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#8C8C96] hover:text-[#F4F4F6] hover:bg-white/[0.05]"
                  >
                    <Heart
                      className={`w-4 h-4 ${
                        isLiked ? 'fill-[#E85D3F] text-[#E85D3F]' : ''
                      }`}
                    />
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
      </section>
    </div>
  );
}
