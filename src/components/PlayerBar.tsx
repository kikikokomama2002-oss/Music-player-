import { useState } from 'react';
import {
  ChevronDown,
  Compass,
  Heart,
  Library,
  ListMusic,
  ListOrdered,
  Pause,
  Play,
  Repeat,
  Repeat1,
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
  currentTimeSec: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  isLiked: boolean;
  isQueueOpen: boolean;
  activeView: ViewTab;
  onTogglePlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (sec: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleLike: () => void;
  onToggleQueue: () => void;
  onSelectView: (view: ViewTab) => void;
}

export function PlayerBar({
  currentTrack,
  isPlaying,
  currentTimeSec,
  volume,
  muted,
  shuffle,
  repeatMode,
  isLiked,
  isQueueOpen,
  activeView,
  onTogglePlayPause,
  onPrev,
  onNext,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeat,
  onToggleLike,
  onToggleQueue,
  onSelectView,
}: PlayerBarProps) {
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);

  const duration = currentTrack?.durationSec ?? 0;
  const progressPct =
    duration > 0 ? Math.min(100, (currentTimeSec / duration) * 100) : 0;

  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;

  return (
    <>
      {/* Desktop Transport Bar */}
      <footer
        aria-label="Audio Transport Controls"
        className="hidden lg:grid grid-cols-[1fr_minmax(380px,520px)_1fr] items-center gap-6 px-6 h-[80px] bg-[#111114] border-t border-white/[0.08] shrink-0 select-none z-30"
      >
        {/* Left: Active Track Metadata */}
        <div className="flex items-center gap-3.5 min-w-0">
          {currentTrack ? (
            <>
              <CoverArt
                src={currentTrack.coverUrl}
                alt={`${currentTrack.albumTitle} cover`}
                size="sm"
                className="w-12 h-12 rounded-lg shrink-0 border border-white/[0.1]"
              />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-[#F4F4F6] truncate">
                  {currentTrack.title}
                </p>
                <p className="text-xs text-[#8C8C96] truncate">
                  {currentTrack.artist} ·{' '}
                  <span className="font-mono text-[11px]">
                    {currentTrack.audioSpec}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleLike}
                aria-label={
                  isLiked
                    ? `Unlike '${currentTrack.title}'`
                    : `Like '${currentTrack.title}'`
                }
                aria-pressed={isLiked}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-[#8C8C96] hover:text-[#F4F4F6] hover:bg-white/[0.05] shrink-0 transition-colors"
              >
                <Heart
                  className={`w-4 h-4 ${
                    isLiked ? 'fill-[#E85D3F] text-[#E85D3F]' : ''
                  }`}
                  strokeWidth={1.75}
                />
              </button>
            </>
          ) : (
            <p className="text-xs text-[#6E6E78]">Select a track to listen</p>
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
                  ? 'text-[#E85D3F] bg-white/[0.06]'
                  : 'text-[#8C8C96] hover:text-[#F4F4F6]'
              }`}
            >
              <Shuffle className="w-4 h-4" strokeWidth={1.75} />
            </button>

            <button
              type="button"
              onClick={onPrev}
              aria-label="Previous track"
              disabled={!currentTrack}
              className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-[#C4C4CC] hover:text-[#F4F4F6] disabled:opacity-35 transition-colors"
            >
              <SkipBack className="w-4 h-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={onTogglePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              disabled={!currentTrack}
              className="w-10 h-10 rounded-full bg-[#F4F4F6] hover:bg-white text-[#0B0B0D] flex items-center justify-center transition-transform active:scale-95 disabled:opacity-40"
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
              className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-[#C4C4CC] hover:text-[#F4F4F6] disabled:opacity-35 transition-colors"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>

            <button
              type="button"
              onClick={onCycleRepeat}
              aria-label={`Repeat mode: ${repeatMode}`}
              className={`min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center transition-colors ${
                repeatMode !== 'off'
                  ? 'text-[#E85D3F] bg-white/[0.06]'
                  : 'text-[#8C8C96] hover:text-[#F4F4F6]'
              }`}
            >
              <RepeatIcon className="w-4 h-4" strokeWidth={1.75} />
            </button>
          </div>

          <div className="flex items-center gap-2.5 w-full">
            <span className="font-mono text-[11px] tabular-nums text-[#8C8C96] w-10 text-right shrink-0">
              {formatTimecode(currentTimeSec)}
            </span>
            <input
              type="range"
              min={0}
              max={duration || 1}
              step={1}
              value={Math.min(currentTimeSec, duration || 1)}
              onChange={(e) => onSeek(Number(e.target.value))}
              aria-label="Seek playback position"
              style={{
                background: `linear-gradient(to right, #E85D3F ${progressPct}%, rgba(255,255,255,0.12) ${progressPct}%)`,
              }}
              className="studio-range flex-1 h-1 rounded-full"
            />
            <span className="font-mono text-[11px] tabular-nums text-[#8C8C96] w-10 shrink-0">
              {formatTimecode(duration)}
            </span>
          </div>
        </div>

        {/* Right: Volume + EQ Shortcut + Queue */}
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => onSelectView('eq')}
            aria-label="Open Studio Equalizer"
            className={`min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center transition-colors ${
              activeView === 'eq'
                ? 'text-[#E85D3F] bg-white/[0.06]'
                : 'text-[#8C8C96] hover:text-[#F4F4F6]'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" strokeWidth={1.75} />
          </button>

          <button
            type="button"
            onClick={onToggleQueue}
            aria-label="Toggle queue panel"
            className={`xl:hidden min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center transition-colors ${
              isQueueOpen
                ? 'text-[#E85D3F] bg-white/[0.06]'
                : 'text-[#8C8C96] hover:text-[#F4F4F6]'
            }`}
          >
            <ListOrdered className="w-4 h-4" strokeWidth={1.75} />
          </button>

          <div className="flex items-center gap-2 pl-1">
            <button
              type="button"
              onClick={onToggleMute}
              aria-label={muted ? 'Unmute audio' : 'Mute audio'}
              className="min-w-[36px] min-h-[36px] rounded-lg flex items-center justify-center text-[#8C8C96] hover:text-[#F4F4F6] transition-colors"
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
                background: `linear-gradient(to right, #F4F4F6 ${
                  (muted ? 0 : volume) * 100
                }%, rgba(255,255,255,0.12) ${(muted ? 0 : volume) * 100}%)`,
              }}
              className="studio-range w-24 h-1 rounded-full"
            />
          </div>
        </div>
      </footer>

      {/* Mobile Compact Bottom Bar (Mini Player + 4-Tab Nav = 104px <= 15% of 844px) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-[#111114]/95 backdrop-blur-md border-t border-white/[0.08]">
        {/* Thin 2px progress line at top of mini player */}
        <div className="h-[2px] w-full bg-white/[0.08]">
          <div
            className="h-full bg-[#E85D3F] transition-[width] duration-200"
            style={{ width: `${progressPct}%` }}
          />
        </div>

        {/* 52px Mini Player Strip */}
        <div className="h-[52px] px-3 flex items-center justify-between gap-2 border-b border-white/[0.06]">
          <button
            type="button"
            onClick={() => setMobileSheetOpen(true)}
            aria-label="Open now playing sheet"
            className="flex items-center gap-2.5 min-w-0 flex-1 text-left"
          >
            {currentTrack && (
              <CoverArt
                src={currentTrack.coverUrl}
                alt={`${currentTrack.albumTitle} cover`}
                size="sm"
                className="w-9 h-9 rounded shrink-0 border border-white/[0.1]"
              />
            )}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#F4F4F6] truncate">
                {currentTrack?.title ?? 'No track selected'}
              </p>
              <p className="text-[11px] text-[#8C8C96] truncate">
                {currentTrack?.artist ?? 'Tap any track to play'}
              </p>
            </div>
          </button>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onTogglePlayPause}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              disabled={!currentTrack}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#F4F4F6] disabled:opacity-35"
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
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#C4C4CC] disabled:opacity-35"
            >
              <SkipForward className="w-4 h-4 fill-current" />
            </button>
          </div>
        </div>

        {/* 52px Mobile Bottom Navigation */}
        <nav
          aria-label="Mobile Navigation"
          className="grid grid-cols-4 h-[52px]"
        >
          {[
            { id: 'discover' as ViewTab, label: 'Discover', icon: Compass },
            { id: 'library' as ViewTab, label: 'Library', icon: Library },
            { id: 'playlists' as ViewTab, label: 'Playlists', icon: ListMusic },
            { id: 'eq' as ViewTab, label: 'Studio EQ', icon: SlidersHorizontal },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeView === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectView(tab.id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  active ? 'text-[#E85D3F]' : 'text-[#8C8C96]'
                }`}
              >
                <Icon className="w-4 h-4" strokeWidth={1.75} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Mobile Expanded Now Playing Sheet */}
      {mobileSheetOpen && currentTrack && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Now Playing"
          className="lg:hidden fixed inset-0 z-50 bg-[#0B0B0D] flex flex-col justify-between p-6 overflow-y-auto"
        >
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMobileSheetOpen(false)}
              aria-label="Close now playing"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#9C9CA6]"
            >
              <ChevronDown className="w-5 h-5" />
            </button>
            <span className="text-xs font-mono text-[#8C8C96]">
              {currentTrack.audioSpec}
            </span>
            <button
              type="button"
              onClick={() => {
                setMobileSheetOpen(false);
                onToggleQueue();
              }}
              aria-label="Open queue"
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#9C9CA6]"
            >
              <ListOrdered className="w-5 h-5" />
            </button>
          </div>

          <div className="my-auto py-6 space-y-6">
            <div className="aspect-square max-w-[300px] mx-auto rounded-2xl overflow-hidden border border-white/[0.1]">
              <CoverArt
                src={currentTrack.coverUrl}
                alt={`${currentTrack.albumTitle} cover`}
                size="lg"
                className="w-full h-full"
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-xl font-bold text-[#F4F4F6] truncate">
                  {currentTrack.title}
                </h2>
                <p className="text-sm text-[#9C9CA6] truncate">
                  {currentTrack.artist} · {currentTrack.albumTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleLike}
                aria-label={
                  isLiked
                    ? `Unlike '${currentTrack.title}'`
                    : `Like '${currentTrack.title}'`
                }
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#9C9CA6]"
              >
                <Heart
                  className={`w-5 h-5 ${
                    isLiked ? 'fill-[#E85D3F] text-[#E85D3F]' : ''
                  }`}
                />
              </button>
            </div>

            <div className="space-y-2">
              <input
                type="range"
                min={0}
                max={duration || 1}
                step={1}
                value={Math.min(currentTimeSec, duration || 1)}
                onChange={(e) => onSeek(Number(e.target.value))}
                aria-label="Seek playback position"
                style={{
                  background: `linear-gradient(to right, #E85D3F ${progressPct}%, rgba(255,255,255,0.12) ${progressPct}%)`,
                }}
                className="studio-range w-full h-1.5 rounded-full"
              />
              <div className="flex justify-between font-mono text-xs tabular-nums text-[#8C8C96]">
                <span>{formatTimecode(currentTimeSec)}</span>
                <span>{formatTimecode(duration)}</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                onClick={onToggleShuffle}
                aria-label="Toggle shuffle"
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg ${
                  shuffle ? 'text-[#E85D3F]' : 'text-[#8C8C96]'
                }`}
              >
                <Shuffle className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={onPrev}
                aria-label="Previous track"
                className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg text-[#F4F4F6]"
              >
                <SkipBack className="w-6 h-6 fill-current" />
              </button>
              <button
                type="button"
                onClick={onTogglePlayPause}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="w-16 h-16 rounded-full bg-[#E85D3F] text-white flex items-center justify-center"
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 fill-current" />
                ) : (
                  <Play className="w-6 h-6 fill-current ml-0.5" />
                )}
              </button>
              <button
                type="button"
                onClick={onNext}
                aria-label="Next track"
                className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg text-[#F4F4F6]"
              >
                <SkipForward className="w-6 h-6 fill-current" />
              </button>
              <button
                type="button"
                onClick={onCycleRepeat}
                aria-label={`Repeat mode: ${repeatMode}`}
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg ${
                  repeatMode !== 'off' ? 'text-[#E85D3F]' : 'text-[#8C8C96]'
                }`}
              >
                <RepeatIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
