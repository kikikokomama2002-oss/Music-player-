import { useState } from 'react';
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
  const [confirmClear, setConfirmClear] = useState(false);

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
            ? 'fixed top-0 right-0 bottom-[106px] lg:bottom-[80px] w-[320px] z-40 flex'
            : 'hidden xl:flex w-[300px]'
        } flex-col shrink-0 bg-white dark:bg-[#131316] border-l border-zinc-200 dark:border-white/[0.08] h-full select-none`}
      >
        <div className="px-5 h-16 flex items-center justify-between border-b border-zinc-200 dark:border-white/[0.06] shrink-0 gap-2">
          <div className="flex items-baseline gap-2">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F6]">
              Up Next
            </h2>
            <span className="font-mono text-xs tabular-nums text-zinc-500 dark:text-[#6E6E78]">
              {queueTracks.length}
            </span>
          </div>

          <div className="flex items-center gap-1">
            {queueTracks.length > 0 &&
              (confirmClear ? (
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmClear(false);
                      onClearQueue();
                    }}
                    className="px-2 py-1 rounded bg-red-600 text-white text-[11px] font-semibold"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClear(false)}
                    className="px-2 py-1 rounded border border-zinc-300 dark:border-white/[0.12] text-[11px]"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClear(true)}
                  aria-label="Clear queue"
                  className="px-2.5 py-1.5 rounded-md text-xs text-zinc-600 dark:text-[#8C8C96] hover:text-zinc-900 dark:hover:text-[#F4F4F6] hover:bg-zinc-100 dark:hover:bg-white/[0.05] transition-colors inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear</span>
                </button>
              ))}
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close queue drawer"
              className="xl:hidden p-2 rounded-md text-zinc-600 dark:text-[#8C8C96] hover:text-zinc-900 dark:hover:text-[#F4F4F6]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {queueTracks.length === 0 ? (
            <div className="py-12 px-4 text-center space-y-1.5">
              <p className="text-sm font-medium text-zinc-700 dark:text-[#C4C4CC]">
                Queue is empty
              </p>
              <p className="text-xs text-zinc-500 dark:text-[#6E6E78]">
                Select any track, album, or folder to start playback.
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
                      isCurrent
                        ? 'bg-zinc-100 dark:bg-[#1D1D23]'
                        : 'hover:bg-zinc-100/70 dark:hover:bg-white/[0.04]'
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
                      className="relative w-10 h-10 rounded overflow-hidden shrink-0 border border-zinc-200 dark:border-white/[0.08]"
                    >
                      <CoverArt
                        src={track.artworkUrl}
                        alt={`${track.album} cover`}
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
                          isCurrent
                            ? 'text-[#E85D3F]'
                            : 'text-zinc-900 dark:text-[#F4F4F6]'
                        }`}
                      >
                        {track.title}
                      </p>
                      <p className="text-[11px] text-zinc-500 dark:text-[#8C8C96] truncate">
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
                        className="p-1.5 rounded text-zinc-500 dark:text-[#7C7C87] hover:text-zinc-900 dark:hover:text-[#F4F4F6] disabled:opacity-25"
                      >
                        <ArrowUp className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={index === queueTracks.length - 1}
                        onClick={() => onMoveItem(index, index + 1)}
                        aria-label={`Move '${track.title}' down in queue`}
                        className="p-1.5 rounded text-zinc-500 dark:text-[#7C7C87] hover:text-zinc-900 dark:hover:text-[#F4F4F6] disabled:opacity-25"
                      >
                        <ArrowDown className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onRemoveItem(track.id)}
                        aria-label={`Remove '${track.title}' from queue`}
                        className="p-1.5 rounded text-zinc-500 dark:text-[#7C7C87] hover:text-red-500"
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
