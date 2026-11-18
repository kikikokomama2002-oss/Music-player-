import { ArrowDown, ArrowUp, Pause, Play, Trash2, X } from 'lucide-react';
import type { Track } from '../types/music';
import { formatTimecode } from '../utils/musicLogic';
import { CoverArt } from './CoverArt';

interface QueuePanelProps {
  queueTracks: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onPlayTrack: (trackId: string) => void;
  onTogglePlayPause: () => void;
  onMoveItem: (fromIndex: number, toIndex: number) => void;
  onRemoveItem: (trackId: string) => void;
  onClearQueue: () => void;
}

export function QueuePanel({
  queueTracks,
  currentTrackId,
  isPlaying,
  isOpenMobile,
  onCloseMobile,
  onPlayTrack,
  onTogglePlayPause,
  onMoveItem,
  onRemoveItem,
  onClearQueue,
}: QueuePanelProps) {
  return (
    <>
      {isOpenMobile && (
        <div
          className="xl:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-30"
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Playback Queue"
        className={`${
          isOpenMobile
            ? 'fixed top-0 right-0 bottom-[104px] lg:bottom-[80px] w-[320px] z-40 flex'
            : 'hidden xl:flex w-[300px]'
        } flex-col shrink-0 bg-[#131316] border-l border-white/[0.08] h-full select-none`}
      >
        <div className="px-5 h-16 flex items-center justify-between border-b border-white/[0.06] shrink-0">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-[#F4F4F6]">Up Next</h2>
            <span className="font-mono text-xs tabular-nums text-[#6E6E78]">
              {queueTracks.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {queueTracks.length > 0 && (
              <button
                type="button"
                onClick={onClearQueue}
                aria-label="Clear queue"
                className="px-2.5 py-1.5 rounded-md text-xs text-[#8C8C96] hover:text-[#F4F4F6] hover:bg-white/[0.05] transition-colors inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            )}
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close queue drawer"
              className="xl:hidden p-2 rounded-md text-[#8C8C96] hover:text-[#F4F4F6]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {queueTracks.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-1.5">
              <p className="text-sm font-medium text-[#C4C4CC]">Queue is empty</p>
              <p className="text-xs text-[#6E6E78]">
                Select any track or album to start playback.
              </p>
            </div>
          ) : (
            <ul className="space-y-1">
              {queueTracks.map((track, index) => {
                const isCurrent = track.id === currentTrackId;
                return (
                  <li
                    key={`${track.id}-${index}`}
                    className={`group flex items-center gap-2.5 p-2 rounded-lg transition-colors ${
                      isCurrent ? 'bg-[#1D1D23]' : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        if (isCurrent) onTogglePlayPause();
                        else onPlayTrack(track.id);
                      }}
                      aria-label={
                        isCurrent && isPlaying
                          ? `Pause '${track.title}'`
                          : `Play '${track.title}'`
                      }
                      className="relative w-10 h-10 rounded overflow-hidden shrink-0 border border-white/[0.08]"
                    >
                      <CoverArt
                        src={track.coverUrl}
                        alt={`${track.albumTitle} cover`}
                        size="sm"
                        className="w-full h-full"
                      />
                      <span
                        className={`absolute inset-0 bg-black/55 flex items-center justify-center transition-opacity ${
                          isCurrent
                            ? 'opacity-100'
                            : 'opacity-0 group-hover:opacity-100'
                        }`}
                      >
                        {isCurrent && isPlaying ? (
                          <Pause className="w-3.5 h-3.5 text-[#E85D3F] fill-current" />
                        ) : (
                          <Play className="w-3.5 h-3.5 text-white fill-current ml-0.5" />
                        )}
                      </span>
                    </button>

                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-medium truncate ${
                          isCurrent ? 'text-[#E85D3F]' : 'text-[#F4F4F6]'
                        }`}
                      >
                        {track.title}
                      </p>
                      <p className="text-[11px] text-[#8C8C96] truncate">
                        {track.artist} ·{' '}
                        <span className="font-mono tabular-nums">
                          {formatTimecode(track.durationSec)}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0 opacity-100 xl:opacity-0 xl:group-hover:opacity-100 xl:focus-within:opacity-100 transition-opacity">
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => onMoveItem(index, index - 1)}
                        aria-label={`Move '${track.title}' up in queue`}
                        className="p-1.5 rounded text-[#7C7C87] hover:text-[#F4F4F6] disabled:opacity-25"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === queueTracks.length - 1}
                        onClick={() => onMoveItem(index, index + 1)}
                        aria-label={`Move '${track.title}' down in queue`}
                        className="p-1.5 rounded text-[#7C7C87] hover:text-[#F4F4F6] disabled:opacity-25"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(track.id)}
                        aria-label={`Remove '${track.title}' from queue`}
                        className="p-1.5 rounded text-[#7C7C87] hover:text-[#F87171]"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}
