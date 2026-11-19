import {
  ChevronUp,
  Disc,
  Heart,
  Home,
  ListMusic,
  ListOrdered,
  Music2,
  Pause,
  Play,
  Repeat,
  Repeat1,
  Settings,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type { RepeatMode, Track, ViewTab } from '../types/music';
import { formatTimecode } from '../utils/musicLogic';
import { CoverArt } from './CoverArt';

interface PlayerBarProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  isFavorite: boolean;
  isQueueOpen: boolean;
  activeView: ViewTab;
  isNativeAndroid: boolean;
  onOpenNowPlaying: () => void;
  onTogglePlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (sec: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleFavorite: () => void;
  onToggleQueue: () => void;
  onSelectView: (view: ViewTab) => void;
}

export function PlayerBar({
  currentTrack,
  isPlaying,
  positionSec,
  durationSec,
  volume,
  muted,
  shuffle,
  repeatMode,
  isFavorite,
  isQueueOpen,
  activeView,
  isNativeAndroid,
  onOpenNowPlaying,
  onTogglePlayPause,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeat,
  onToggleFavorite,
  onToggleQueue,
  onSelectView,
}: PlayerBarProps) {
  const effectiveDuration =
    durationSec > 0 ? durationSec : currentTrack?.durationSec ?? 0;
  const progressPct =
    effectiveDuration > 0
      ? Math.min(100, (positionSec / effectiveDuration) * 100)
      : 0;

  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;

  return (
    <>
      {/* Desktop Transport Bar */}
      <footer
        aria-label="Audio Transport Controls"
        className="hidden lg:grid grid-cols-[1fr_minmax(380px,520px)_1fr] items-center gap-6 px-6 h-[80px] bg-white dark:bg-[#111114] border-t border-zinc-200 dark:border-white/[0.08] shrink-0 select-none z-30"
      >
        {/* Left: Active Track Metadata */}
        <div className="flex items-center gap-3 min-w-0">
          {currentTrack ? (
            <>
              <button
                type="button"
                onClick={onOpenNowPlaying}
                aria-label={`Open Now Playing for '${currentTrack.title}'`}
                className="flex items-center gap-3 min-w-0 text-left group rounded-lg focus-visible:outline-2 focus-visible:outline-[#E85D3F]"
              >
                <CoverArt
                  src={currentTrack.artworkUrl}
                  alt={`${currentTrack.album} cover`}
                  size="sm"
                  className="w-12 h-12 rounded-lg shrink-0 border border-zinc-200 dark:border-white/[0.1]"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-zinc-900 dark:text-[#F4F4F6] truncate group-hover:underline">
                    {currentTrack.title}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-[#8C8C96] truncate">
                    {currentTrack.artist} ·{' '}
                    <span className="font-mono text-[11px]">
                      {currentTrack.formatLabel}
                    </span>
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={onToggleFavorite}
                aria-label={
                  isFavorite
                    ? `Remove '${currentTrack.title}' from favorites`
                    : `Add '${currentTrack.title}' to favorites`
                }
                aria-pressed={isFavorite}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-zinc-500 dark:text-[#8C8C96] hover:text-zinc-900 dark:hover:text-[#F4F4F6] hover:bg-zinc-100 dark:hover:bg-white/[0.05] shrink-0 transition-colors"
              >
                <Heart
                  className={`w-4 h-4 ${
                    isFavorite ? 'fill-[#E85D3F] text-[#E85D3F]' : ''
                  }`}
                  strokeWidth={1.75}
                />
              </button>
            </>
          ) : (
            <p className="text-xs text-zinc-500 dark:text-[#6E6E78]">
              Select a track to play offline audio
            </p>
          )}
        </div>

        {/* Center: Transport + Scrub */}
        <div className="flex flex-col items-center gap-1.5 w-full">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleShuffle}
              aria-label="Toggle shuffle"
              aria-pressed={shuffle}
              className={`min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center transition-colors ${
                shuffle
                  ? 'text-[#E85D3F] bg-zinc-100 dark:bg-white/[0.06]'
                  : 'text-zinc-500 dark:text-[#8C8C96] hover:text-zinc-900 dark:hover:text-[#F4F4F6]'
              }`}
            >
              <Shuffle className="w-4 h-4" strokeWidth={1.75} />
            </button>

            <button
              type="button"
              onClick={onPrev}
              aria-label="Previous track"
              disabled={!currentTrack}
              className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-zinc-700 dark:text-[#C4C4CC] hover:text-zinc-900 dark:hover:text-[#F4F4F6] disabled:opacity-35 transition-colors"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={onTogglePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              disabled={!currentTrack}
              className="w-10 h-10 rounded-full bg-zinc-900 dark:bg-[#F4F4F6] hover:opacity-90 text-white dark:text-[#0B0B0D] flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>

            <button
              type="button"
              onClick={onNext}
              aria-label="Next track"
              disabled={!currentTrack}
              className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-zinc-700 dark:text-[#C4C4CC] hover:text-zinc-900 dark:hover:text-[#F4F4F6] disabled:opacity-35 transition-colors"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={onCycleRepeat}
              aria-label={`Repeat mode: ${repeatMode}`}
              className={`min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center transition-colors ${
                repeatMode !== 'off'
                  ? 'text-[#E85D3F] bg-zinc-100 dark:bg-white/[0.06]'
                  : 'text-zinc-500 dark:text-[#8C8C96] hover:text-zinc-900 dark:hover:text-[#F4F4F6]'
              }`}
            >
              <RepeatIcon className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="flex items-center gap-2.5 w-full">
            <span className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-[#8C8C96] w-11 text-right shrink-0">
              {formatTimecode(positionSec)}
            </span>
            <input
              type="range"
              min={0}
              max={effectiveDuration || 1}
              step={0.1}
              value={Math.min(positionSec, effectiveDuration || 1)}
              disabled={!currentTrack}
              onChange={(e) => onSeek(Number(e.target.value))}
              aria-label="Seek playback position"
              style={{
                background: `linear-gradient(to right, #E85D3F ${progressPct}%, rgba(160,160,170,0.25) ${progressPct}%)`,
              }}
              className="studio-range flex-1 h-1 rounded-full disabled:opacity-40"
            />
            <span className="font-mono text-[11px] tabular-nums text-zinc-500 dark:text-[#8C8C96] w-11 shrink-0">
              {formatTimecode(effectiveDuration)}
            </span>
          </div>
        </div>

        {/* Right: Now Playing + EQ Shortcut + Queue + Web Volume */}
        <div className="flex items-center justify-end gap-1.5">
          {currentTrack && (
            <button
              type="button"
              onClick={onOpenNowPlaying}
              aria-label="Expand Now Playing view"
              className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-zinc-500 dark:text-[#8C8C96] hover:text-zinc-900 dark:hover:text-[#F4F4F6] transition-colors"
            >
              <ChevronUp className="w-4 h-4" strokeWidth={1.75} />
            </button>
          )}

          <button
            type="button"
            onClick={() => onSelectView('eq')}
            aria-label="Open Audio Effects"
            className={`min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center transition-colors ${
              activeView === 'eq'
                ? 'text-[#E85D3F] bg-zinc-100 dark:bg-white/[0.06]'
                : 'text-zinc-500 dark:text-[#8C8C96] hover:text-zinc-900 dark:hover:text-[#F4F4F6]'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={() => onSelectView('settings')}
            aria-label="Open Settings"
            className={`min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center transition-colors ${
              activeView === 'settings'
                ? 'text-[#E85D3F] bg-zinc-100 dark:bg-white/[0.06]'
                : 'text-zinc-500 dark:text-[#8C8C96] hover:text-zinc-900 dark:hover:text-[#F4F4F6]'
            }`}
          >
            <Settings className="w-4 h-4" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={onToggleQueue}
            aria-label="Toggle queue panel"
            className={`xl:hidden min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center transition-colors ${
              isQueueOpen
                ? 'text-[#E85D3F] bg-zinc-100 dark:bg-white/[0.06]'
                : 'text-zinc-500 dark:text-[#8C8C96] hover:text-zinc-900 dark:hover:text-[#F4F4F6]'
            }`}
          >
            <ListOrdered className="w-4 h-4" strokeWidth={1.75} />
          </button>

          {!isNativeAndroid && (
            <div className="flex items-center gap-2 pl-1">
              <button
                type="button"
                onClick={onToggleMute}
                aria-label={muted ? 'Unmute audio' : 'Mute audio'}
                className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-zinc-500 dark:text-[#8C8C96] hover:text-zinc-900 dark:hover:text-[#F4F4F6] transition-colors"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="w-4 h-4" strokeWidth={1.75} />
                ) : (
                  <Volume2 className="w-4 h-4" strokeWidth={1.75} />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={muted ? 0 : volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                aria-label="Master volume"
                style={{
                  background: `linear-gradient(to right, #E85D3F ${
                    (muted ? 0 : volume) * 100
                  }%, rgba(160,160,170,0.25) ${(muted ? 0 : volume) * 100}%)`,
                }}
                className="studio-range w-24 h-1 rounded-full"
              />
            </div>
          )}
        </div>
      </footer>

      {/* Mobile Compact Bottom Bar (Mini Player + 4-Tab Nav = 106px <= 15% of 844px) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white/95 dark:bg-[#111114]/95 backdrop-blur-md border-t border-zinc-200 dark:border-white/[0.08]">
        {/* Thin 2px progress line at top of mini player */}
        <div className="h-[2px] w-full bg-zinc-200 dark:bg-white/[0.08]">
          <div
            className="h-full bg-[#E85D3F] transition-[width] duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* 52px Mini Player Strip */}
        <div className="h-[52px] px-3 flex items-center justify-between gap-2 border-b border-zinc-200 dark:border-white/[0.06]">
          <button
            type="button"
            onClick={() => {
              if (currentTrack) onOpenNowPlaying();
            }}
            aria-label={
              currentTrack ? 'Open Now Playing view' : 'No track selected'
            }
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
          >
            {currentTrack && (
              <CoverArt
                src={currentTrack.artworkUrl}
                alt={`${currentTrack.album} cover`}
                size="sm"
                className="w-9 h-9 rounded shrink-0 border border-zinc-200 dark:border-white/[0.1]"
              />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-zinc-900 dark:text-[#F4F4F6] truncate">
                {currentTrack?.title ?? 'No track selected'}
              </p>
              <p className="text-[11px] text-zinc-500 dark:text-[#8C8C96] truncate">
                {currentTrack?.artist ?? 'Import or scan local audio'}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onTogglePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              disabled={!currentTrack}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-zinc-900 dark:text-[#F4F4F6] disabled:opacity-35"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4 fill-current" />
              ) : (
                <Play className="w-4 h-4 fill-current ml-0.5" />
              )}
            </button>
            <button
              type="button"
              onClick={onNext}
              aria-label="Next track"
              disabled={!currentTrack}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-zinc-700 dark:text-[#C4C4CC] disabled:opacity-35"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
          </div>
        </div>

        {/* 52px Mobile Bottom Navigation */}
        <nav
          aria-label="Mobile Navigation"
          className="grid grid-cols-5 h-[52px]"
        >
          {[
            { id: 'home' as ViewTab, label: 'Home', icon: Home },
            { id: 'tracks' as ViewTab, label: 'Tracks', icon: Music2 },
            { id: 'albums' as ViewTab, label: 'Albums', icon: Disc },
            { id: 'playlists' as ViewTab, label: 'Playlists', icon: ListMusic },
            { id: 'settings' as ViewTab, label: 'Settings', icon: Settings },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectView(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium whitespace-nowrap transition-colors ${
                  active
                    ? 'text-[#E85D3F]'
                    : 'text-zinc-500 dark:text-[#8C8C96]'
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={1.75} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </>
  );
}
