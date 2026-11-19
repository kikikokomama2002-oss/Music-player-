import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import {
  ChevronDown,
  Clock,
  FileText,
  Gauge,
  Heart,
  ImagePlus,
  Info,
  ListOrdered,
  Pause,
  Play,
  Repeat,
  Repeat1,
  RotateCcw,
  Share2,
  Shuffle,
  SkipBack,
  SkipForward,
  SlidersHorizontal,
  Trash2,
  Upload,
} from 'lucide-react';
import type { LyricsTextSize, RepeatMode, Track } from '../types/music';
import {
  findActiveLyricIndex,
  formatRemainingSleepTimer,
  formatTimecode,
  parseLrcLyrics,
} from '../utils/musicLogic';
import { CoverArt } from './CoverArt';

interface NowPlayingModalProps {
  isOpen: boolean;
  track: Track | null;
  rawLyrics: string;
  hasCustomLyrics: boolean;
  syncedLyricsEnabled: boolean;
  lyricsAutoScroll: boolean;
  lyricsTextSize: LyricsTextSize;
  isPlaying: boolean;
  positionSec: number;
  durationSec: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  playbackSpeed: number;
  sleepTimerEndAtMs: number;
  isFavorite: boolean;
  queueTracks: Track[];
  onClose: () => void;
  onTogglePlayPause: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSeek: (sec: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleFavorite: () => void;
  onChangeSpeed: (speed: number) => void;
  onSetSleepTimer: (minutes: number) => void;
  onPlayQueueTrack: (trackId: string) => void;
  onOpenEq: () => void;
  onShowDetails: (track: Track) => void;
  onShareTrack: (track: Track) => void;
  onAssociateLyricsFile: (track: Track) => void;
  onClearCustomLyrics: (track: Track) => void;
  onSelectCustomCover: (track: Track) => void;
}

export function NowPlayingModal({
  isOpen,
  track,
  rawLyrics,
  hasCustomLyrics,
  syncedLyricsEnabled,
  lyricsAutoScroll,
  lyricsTextSize,
  isPlaying,
  positionSec,
  durationSec,
  shuffle,
  repeatMode,
  playbackSpeed,
  sleepTimerEndAtMs,
  isFavorite,
  queueTracks,
  onClose,
  onTogglePlayPause,
  onPrev,
  onNext,
  onSeek,
  onToggleShuffle,
  onCycleRepeat,
  onToggleFavorite,
  onChangeSpeed,
  onSetSleepTimer,
  onPlayQueueTrack,
  onOpenEq,
  onShowDetails,
  onShareTrack,
  onAssociateLyricsFile,
  onClearCustomLyrics,
  onSelectCustomCover,
}: NowPlayingModalProps) {
  const [panel, setPanel] = useState<'player' | 'lyrics' | 'queue'>('player');
  const [entered, setEntered] = useState(false);
  const [closing, setClosing] = useState(false);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLButtonElement | null>(null);
  const manualHoldTimerRef = useRef<number | null>(null);
  const lastProgrammaticScrollAtRef = useRef<number>(0);

  const gestureRef = useRef<{
    active: boolean;
    pointerId: number | null;
    startX: number;
    startY: number;
    startTime: number;
    dragging: boolean;
  }>({
    active: false,
    pointerId: null,
    startX: 0,
    startY: 0,
    startTime: 0,
    dragging: false,
  });

  // Entry animation when opening
  useEffect(() => {
    if (isOpen) {
      setClosing(false);
      setDragY(0);
      setIsDragging(false);
      const id = window.requestAnimationFrame(() => setEntered(true));
      return () => window.cancelAnimationFrame(id);
    } else {
      setEntered(false);
    }
  }, [isOpen]);

  // Reset manual scroll pause when track changes
  useEffect(() => {
    setAutoScrollPaused(false);
    if (manualHoldTimerRef.current !== null) {
      window.clearTimeout(manualHoldTimerRef.current);
      manualHoldTimerRef.current = null;
    }
  }, [track?.id]);

  // Live 1-second sleep timer countdown tick
  useEffect(() => {
    if (!isOpen || !sleepTimerEndAtMs || sleepTimerEndAtMs <= Date.now()) return;
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [isOpen, sleepTimerEndAtMs]);

  const parsedLyrics = useMemo(() => {
    const parsed = parseLrcLyrics(rawLyrics);
    if (!syncedLyricsEnabled && parsed.synced) {
      return {
        synced: false,
        lines: parsed.lines.map((l) => ({ timeSec: null, text: l.text })),
      };
    }
    return parsed;
  }, [rawLyrics, syncedLyricsEnabled]);

  const activeLyricIndex = useMemo(
    () =>
      syncedLyricsEnabled && parsedLyrics.synced
        ? findActiveLyricIndex(parsedLyrics.lines, positionSec)
        : -1,
    [syncedLyricsEnabled, parsedLyrics, positionSec]
  );

  const scrollActiveLineIntoCenter = useCallback(() => {
    const container = scrollContainerRef.current;
    const lineEl = activeLineRef.current;
    if (!container || !lineEl) return;

    const containerRect = container.getBoundingClientRect();
    const lineRect = lineEl.getBoundingClientRect();
    const offsetWithinContainer =
      lineRect.top -
      containerRect.top +
      container.scrollTop -
      container.clientHeight / 2 +
      lineEl.clientHeight / 2;

    lastProgrammaticScrollAtRef.current = Date.now();
    container.scrollTo({
      top: Math.max(0, offsetWithinContainer),
      behavior: 'smooth',
    });
  }, []);

  // Follow active lyric smoothly unless user recently scrolled manually
  useEffect(() => {
    if (
      isOpen &&
      panel === 'lyrics' &&
      lyricsAutoScroll &&
      syncedLyricsEnabled &&
      !autoScrollPaused &&
      activeLyricIndex >= 0
    ) {
      const rafId = window.requestAnimationFrame(() => {
        scrollActiveLineIntoCenter();
      });
      return () => window.cancelAnimationFrame(rafId);
    }
  }, [
    isOpen,
    activeLyricIndex,
    parsedLyrics,
    panel,
    lyricsAutoScroll,
    syncedLyricsEnabled,
    autoScrollPaused,
    scrollActiveLineIntoCenter,
  ]);

  const registerManualLyricsScroll = useCallback((isDirectUserInput = false) => {
    if (
      !isDirectUserInput &&
      Date.now() - lastProgrammaticScrollAtRef.current < 450
    ) {
      return;
    }
    setAutoScrollPaused(true);
    if (manualHoldTimerRef.current !== null) {
      window.clearTimeout(manualHoldTimerRef.current);
    }
    manualHoldTimerRef.current = window.setTimeout(() => {
      setAutoScrollPaused(false);
      manualHoldTimerRef.current = null;
    }, 4500);
  }, []);

  const triggerSmoothDismiss = useCallback(() => {
    if (closing) return;
    setClosing(true);
    setIsDragging(false);
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    setDragY(vh);
    window.setTimeout(() => {
      onClose();
      setClosing(false);
      setDragY(0);
    }, 180);
  }, [closing, onClose]);

  const handlePointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Never hijack interactive controls or range sliders
    if (target.closest('input, select, textarea, button, a')) {
      return;
    }

    const fromHandle = Boolean(target.closest('[data-drag-handle="true"]'));
    const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;

    // On Lyrics or Queue tabs, allow pulling down only from top drag handle or when scrolled to top
    if (!fromHandle && panel !== 'player' && scrollTop > 2) {
      return;
    }
    if (!fromHandle && scrollTop > 2) {
      return;
    }

    gestureRef.current = {
      active: true,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startTime: Date.now(),
      dragging: false,
    };
  };

  const handlePointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g.active || g.pointerId !== e.pointerId) return;

    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;

    if (!g.dragging) {
      if (dy > 10 && dy > Math.abs(dx) * 1.15) {
        const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
        const fromHandle = Boolean(
          (e.target as HTMLElement | null)?.closest('[data-drag-handle="true"]')
        );
        if (!fromHandle && scrollTop > 2) {
          g.active = false;
          return;
        }
        g.dragging = true;
        setIsDragging(true);
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Ignore capture failures
        }
      } else if (Math.abs(dx) > 16 || dy < -12) {
        g.active = false;
        return;
      }
    }

    if (g.dragging) {
      setDragY(Math.max(0, dy));
    }
  };

  const handlePointerEnd = (e: ReactPointerEvent<HTMLDivElement>) => {
    const g = gestureRef.current;
    if (!g.active || g.pointerId !== e.pointerId) return;
    const wasDragging = g.dragging;
    const dy = Math.max(0, e.clientY - g.startY);
    const elapsed = Math.max(1, Date.now() - g.startTime);
    const velocity = dy / elapsed; // px per ms

    g.active = false;
    g.dragging = false;
    setIsDragging(false);

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    if (!wasDragging) return;

    if (dy > 110 || (dy > 40 && velocity > 0.55)) {
      triggerSmoothDismiss();
    } else {
      setDragY(0);
    }
  };

  if (!isOpen || !track) return null;

  const effectiveDuration = durationSec > 0 ? durationSec : track.durationSec;
  const progressPct =
    effectiveDuration > 0
      ? Math.min(100, (positionSec / effectiveDuration) * 100)
      : 0;
  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;
  const sleepCountdown = formatRemainingSleepTimer(sleepTimerEndAtMs, nowMs);

  const activeSizeClass =
    lyricsTextSize === 'sm'
      ? 'text-base sm:text-lg font-bold text-[#E85D3F]'
      : lyricsTextSize === 'lg'
      ? 'text-xl sm:text-2xl font-bold text-[#E85D3F]'
      : 'text-lg sm:text-xl font-bold text-[#E85D3F]';

  const inactiveSizeClass =
    lyricsTextSize === 'sm'
      ? 'text-xs sm:text-sm text-zinc-600 dark:text-[#8C8C96] hover:text-zinc-900 dark:hover:text-[#F4F4F6]'
      : lyricsTextSize === 'lg'
      ? 'text-base sm:text-lg text-zinc-600 dark:text-[#8C8C96] hover:text-zinc-900 dark:hover:text-[#F4F4F6]'
      : 'text-sm sm:text-base text-zinc-600 dark:text-[#8C8C96] hover:text-zinc-900 dark:hover:text-[#F4F4F6]';

  const sheetTranslateY = !entered && !closing ? 36 : dragY;
  const sheetOpacity = !entered && !closing ? 0 : Math.max(0.45, 1 - dragY / 600);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Now Playing"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerEnd}
      onPointerCancel={handlePointerEnd}
      style={{
        transform: `translate3d(0, ${sheetTranslateY}px, 0)`,
        opacity: sheetOpacity,
        transition: isDragging
          ? 'none'
          : 'transform 220ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease',
      }}
      className="fixed inset-0 z-50 bg-stone-50 dark:bg-[#0B0B0D] text-zinc-900 dark:text-[#F4F4F6] flex flex-col overflow-hidden touch-pan-y will-change-transform"
    >
      {/* Drag Handle Strip */}
      <div
        data-drag-handle="true"
        className="pt-2 pb-1 flex justify-center shrink-0 cursor-grab active:cursor-grabbing"
      >
        <div className="w-10 h-1 rounded-full bg-zinc-300 dark:bg-white/20" />
      </div>

      {/* Top Bar */}
      <div
        data-drag-handle="true"
        className="px-2.5 sm:px-6 pb-3 pt-1 flex items-center justify-between gap-1.5 border-b border-zinc-200 dark:border-white/[0.07] shrink-0"
      >
        <button
          type="button"
          onClick={triggerSmoothDismiss}
          aria-label="Close Now Playing"
          className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg flex items-center justify-center text-zinc-600 dark:text-[#9C9CA6] hover:text-zinc-900 dark:hover:text-[#F4F4F6] shrink-0"
        >
          <ChevronDown className="w-5 h-5" />
        </button>

        {/* Sub-view Switcher */}
        <div className="flex items-center gap-0.5 sm:gap-1 p-1 bg-zinc-200/70 dark:bg-[#151519] rounded-lg min-w-0">
          {[
            { id: 'player' as const, label: 'Player' },
            { id: 'lyrics' as const, label: 'Lyrics' },
            { id: 'queue' as const, label: `Queue (${queueTracks.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setPanel(tab.id)}
              className={`px-2 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-medium whitespace-nowrap transition-colors ${
                panel === tab.id
                  ? 'bg-white dark:bg-[#23232A] text-zinc-900 dark:text-[#F4F4F6]'
                  : 'text-zinc-600 dark:text-[#8C8C96]'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onSelectCustomCover(track)}
            aria-label="Set custom artwork"
            title="Set custom artwork"
            className="w-8 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-zinc-600 dark:text-[#9C9CA6] hover:text-zinc-900 dark:hover:text-[#F4F4F6]"
          >
            <ImagePlus className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onShowDetails(track)}
            aria-label="Track details"
            className="w-8 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-zinc-600 dark:text-[#9C9CA6] hover:text-zinc-900 dark:hover:text-[#F4F4F6]"
          >
            <Info className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => onShareTrack(track)}
            aria-label="Share track"
            className="w-8 h-9 sm:w-10 sm:h-10 rounded-lg flex items-center justify-center text-zinc-600 dark:text-[#9C9CA6] hover:text-zinc-900 dark:hover:text-[#F4F4F6]"
          >
            <Share2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div
        ref={scrollContainerRef}
        onWheel={() => {
          if (panel === 'lyrics') registerManualLyricsScroll(true);
        }}
        onTouchMove={() => {
          if (panel === 'lyrics') registerManualLyricsScroll(true);
        }}
        className="flex-1 overflow-y-auto px-5 sm:px-6 py-6 max-w-2xl w-full mx-auto flex flex-col justify-between"
      >
        {panel === 'player' && (
          <div className="my-auto space-y-6">
            {/* Large Original-Color Artwork (fit="contain" preserves original aspect ratio) */}
            <div className="relative group aspect-square max-w-[340px] w-full mx-auto rounded-2xl overflow-hidden border border-zinc-200 dark:border-white/[0.1] bg-zinc-200/70 dark:bg-[#141418] shadow-2xl">
              <CoverArt
                src={track.artworkUrl}
                alt={`${track.album} artwork`}
                size="lg"
                fit="contain"
                className="w-full h-full"
              />
              <button
                type="button"
                onClick={() => onSelectCustomCover(track)}
                aria-label="Change cover artwork"
                className="absolute bottom-3 right-3 px-2.5 py-1.5 rounded-lg bg-black/70 text-white text-[11px] font-medium inline-flex items-center gap-1.5 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
              >
                <ImagePlus className="w-3.5 h-3.5" />
                <span>Custom Cover</span>
              </button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold truncate">
                  {track.title}
                </h2>
                <p className="text-sm text-zinc-600 dark:text-[#9C9CA6] truncate mt-0.5">
                  {track.artist} · {track.album}
                </p>
              </div>

              <button
                type="button"
                onClick={onToggleFavorite}
                aria-label={
                  isFavorite ? 'Remove from favorites' : 'Add to favorites'
                }
                className="min-w-[44px] min-h-[44px] rounded-lg flex items-center justify-center shrink-0"
              >
                <Heart
                  className={`w-5 h-5 ${
                    isFavorite
                      ? 'fill-[#E85D3F] text-[#E85D3F]'
                      : 'text-zinc-500 dark:text-[#8C8C96]'
                  }`}
                />
              </button>
            </div>

            {/* Scrub Bar */}
            <div className="space-y-2">
              <input
                type="range"
                min={0}
                max={effectiveDuration || 1}
                step={0.1}
                value={Math.min(positionSec, effectiveDuration || 1)}
                onChange={(e) => onSeek(Number(e.target.value))}
                aria-label="Seek playback position"
                style={{
                  background: `linear-gradient(to right, #E85D3F ${progressPct}%, rgba(160,160,170,0.22) ${progressPct}%)`,
                }}
                className="studio-range w-full h-1.5 rounded-full"
              />
              <div className="flex justify-between font-mono text-xs tabular-nums text-zinc-500 dark:text-[#8C8C96]">
                <span>{formatTimecode(positionSec)}</span>
                <span>{formatTimecode(effectiveDuration)}</span>
              </div>
            </div>

            {/* Primary Transport */}
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={onToggleShuffle}
                aria-label="Toggle shuffle"
                aria-pressed={shuffle}
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg ${
                  shuffle
                    ? 'text-[#E85D3F]'
                    : 'text-zinc-500 dark:text-[#8C8C96]'
                }`}
              >
                <Shuffle className="w-5 h-5" />
              </button>

              <button
                type="button"
                onClick={onPrev}
                aria-label="Previous track"
                className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg"
              >
                <SkipBack className="w-6 h-6 fill-current" />
              </button>

              <button
                type="button"
                onClick={onTogglePlayPause}
                aria-label={isPlaying ? 'Pause' : 'Play'}
                className="w-16 h-16 rounded-full bg-[#E85D3F] hover:bg-[#D55033] text-white flex items-center justify-center shadow-lg transition-transform active:scale-95"
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
                className="min-w-[48px] min-h-[48px] flex items-center justify-center rounded-lg"
              >
                <SkipForward className="w-6 h-6 fill-current" />
              </button>

              <button
                type="button"
                onClick={onCycleRepeat}
                aria-label={`Repeat mode: ${repeatMode}`}
                className={`min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg ${
                  repeatMode !== 'off'
                    ? 'text-[#E85D3F]'
                    : 'text-zinc-500 dark:text-[#8C8C96]'
                }`}
              >
                <RepeatIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Secondary Utilities: Speed, Sleep Timer, EQ, Lyrics */}
            <div className="pt-4 border-t border-zinc-200 dark:border-white/[0.08] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <Gauge className="w-4 h-4 text-zinc-500" />
                <label htmlFor="speed-select" className="sr-only">
                  Playback speed
                </label>
                <select
                  id="speed-select"
                  value={playbackSpeed}
                  onChange={(e) => onChangeSpeed(Number(e.target.value))}
                  className="h-8 px-2 rounded-md bg-white dark:bg-[#151519] border border-zinc-300 dark:border-white/[0.1] font-mono"
                >
                  {[0.75, 1, 1.25, 1.5, 2].map((sp) => (
                    <option key={sp} value={sp}>
                      {sp}x
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <Clock
                  className={`w-4 h-4 ${
                    sleepCountdown ? 'text-[#E85D3F]' : 'text-zinc-500'
                  }`}
                />
                <label htmlFor="sleep-select" className="sr-only">
                  Sleep timer
                </label>
                <select
                  id="sleep-select"
                  value={0}
                  onChange={(e) => onSetSleepTimer(Number(e.target.value))}
                  className="h-8 px-2 rounded-md bg-white dark:bg-[#151519] border border-zinc-300 dark:border-white/[0.1] font-mono"
                >
                  <option value={0}>
                    {sleepCountdown
                      ? `Sleep ${sleepCountdown}`
                      : 'Sleep Timer: Off'}
                  </option>
                  <option value={15}>Sleep in 15 min</option>
                  <option value={30}>Sleep in 30 min</option>
                  <option value={45}>Sleep in 45 min</option>
                  <option value={60}>Sleep in 60 min</option>
                  {sleepCountdown && <option value={-1}>Cancel Timer</option>}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPanel('lyrics')}
                  className="h-8 px-3 rounded-md border border-zinc-300 dark:border-white/[0.1] inline-flex items-center gap-1.5"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Lyrics</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEq();
                  }}
                  className="h-8 px-3 rounded-md border border-zinc-300 dark:border-white/[0.1] inline-flex items-center gap-1.5"
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>EQ</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {panel === 'lyrics' && (
          <div className="py-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-zinc-200 dark:border-white/[0.08]">
              <div>
                <p className="text-base font-bold">{track.title}</p>
                <p className="text-xs text-zinc-500 dark:text-[#8C8C96]">
                  {track.artist}
                  {parsedLyrics.synced ? ' · Synced LRC' : ''}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {autoScrollPaused &&
                  syncedLyricsEnabled &&
                  parsedLyrics.synced &&
                  lyricsAutoScroll && (
                    <button
                      type="button"
                      onClick={() => {
                        setAutoScrollPaused(false);
                        scrollActiveLineIntoCenter();
                      }}
                      className="h-8 px-3 rounded-lg bg-[#E85D3F] text-white text-xs font-medium inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Resume Sync</span>
                    </button>
                  )}

                <button
                  type="button"
                  onClick={() => onAssociateLyricsFile(track)}
                  className="h-8 px-3 rounded-lg border border-zinc-300 dark:border-white/[0.12] bg-white dark:bg-[#151519] text-xs font-medium inline-flex items-center gap-1.5"
                >
                  <Upload className="w-3.5 h-3.5 text-[#E85D3F]" />
                  <span>Load .LRC</span>
                </button>

                {hasCustomLyrics && (
                  <button
                    type="button"
                    onClick={() => onClearCustomLyrics(track)}
                    aria-label="Clear custom lyrics for this track"
                    className="h-8 px-2.5 rounded-lg border border-zinc-300 dark:border-white/[0.12] text-xs text-zinc-600 dark:text-[#9C9CA6] hover:text-red-500 inline-flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Clear</span>
                  </button>
                )}
              </div>
            </div>

            {parsedLyrics.lines.length === 0 ? (
              <div className="py-16 text-center space-y-4">
                <div className="w-12 h-12 rounded-xl bg-zinc-200/70 dark:bg-[#16161B] text-[#E85D3F] flex items-center justify-center mx-auto">
                  <FileText className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <p className="text-base font-semibold">
                    No Lyrics Associated
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-[#8C8C96] max-w-sm mx-auto leading-relaxed">
                    Load a local .lrc or .txt lyrics file to associate synced
                    lyrics with this track, or embed USLT/SYLT lyrics in the
                    audio file metadata.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onAssociateLyricsFile(track)}
                  className="min-h-[40px] px-4 py-2 rounded-lg bg-[#E85D3F] hover:bg-[#D55033] text-white text-xs font-semibold inline-flex items-center gap-2"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Load .LRC or .TXT Lyrics File</span>
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 py-14">
                {parsedLyrics.lines.map((line, idx) => {
                  const isActive = idx === activeLyricIndex;
                  return (
                    <button
                      key={`${idx}-${line.text}`}
                      ref={isActive ? activeLineRef : undefined}
                      type="button"
                      disabled={line.timeSec === null || !syncedLyricsEnabled}
                      onClick={() => {
                        if (line.timeSec !== null && syncedLyricsEnabled) {
                          setAutoScrollPaused(false);
                          onSeek(line.timeSec);
                        }
                      }}
                      className={`block w-full text-center py-1.5 px-3 rounded-lg transition-colors ${
                        isActive ? activeSizeClass : inactiveSizeClass
                      }`}
                    >
                      {line.text}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {panel === 'queue' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-3 border-b border-zinc-200 dark:border-white/[0.08]">
              <ListOrdered className="w-4 h-4 text-[#E85D3F]" />
              <h2 className="text-sm font-semibold">
                Up Next ({queueTracks.length})
              </h2>
            </div>
            <ul className="divide-y divide-zinc-200 dark:divide-white/[0.06]">
              {queueTracks.map((qt, idx) => {
                const active = qt.id === track.id;
                return (
                  <li key={`${qt.id}-${idx}`}>
                    <button
                      type="button"
                      onClick={() => onPlayQueueTrack(qt.id)}
                      className="w-full py-2.5 flex items-center justify-between gap-3 text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <CoverArt
                          src={qt.artworkUrl}
                          alt={`${qt.album} cover`}
                          size="sm"
                          className="w-10 h-10 rounded shrink-0"
                        />
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-medium truncate ${
                              active ? 'text-[#E85D3F]' : ''
                            }`}
                          >
                            {qt.title}
                          </p>
                          <p className="text-xs text-zinc-500 dark:text-[#8C8C96] truncate">
                            {qt.artist}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono text-xs tabular-nums text-zinc-500">
                        {formatTimecode(qt.durationSec)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
