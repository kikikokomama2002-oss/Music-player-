import { useState } from 'react';
import {
  Disc3,
  FileText,
  FolderMinus,
  HardDrive,
  Monitor,
  Moon,
  Plus,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Trash2,
  Volume2,
  X,
} from 'lucide-react';
import type {
  AppSettings,
  AudioEffectsState,
  AudioFocusMode,
  FolderGroup,
  LyricsTextSize,
  SortDirection,
  SortField,
  ThemePreference,
} from '../types/music';
import { formatFileSize } from '../utils/musicLogic';

interface SettingsViewProps {
  settings: AppSettings;
  sortField: SortField;
  sortDirection: SortDirection;
  effects: AudioEffectsState;
  detectedFolders: FolderGroup[];
  isNativeAndroid: boolean;
  isScanning: boolean;
  storageStats: {
    trackCount: number;
    audioBytes: number;
    artworkCount: number;
    artworkBytes: number;
    customLyricsCount: number;
  };
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onChangeDefaultSort: (field: SortField, direction: SortDirection) => void;
  onRescanLibrary: () => void;
  onRefreshMetadata: () => void;
  onClearArtworkCache: () => void;
  onClearCustomLyrics: () => void;
  onClearWebLibrary: () => void;
  onOpenEffects: () => void;
}

function ToggleRow({
  id,
  label,
  description,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <label
          htmlFor={id}
          className="text-sm font-medium text-zinc-900 dark:text-[#F4F4F6] block cursor-pointer"
        >
          {label}
        </label>
        <p className="text-xs text-zinc-500 dark:text-[#8C8C96] mt-0.5 leading-relaxed">
          {description}
        </p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-11 h-6 rounded-full shrink-0 transition-colors ${
          checked ? 'bg-[#E85D3F]' : 'bg-zinc-300 dark:bg-white/15'
        }`}
      >
        <span
          className={`block w-4 h-4 rounded-full bg-white shadow-xs transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );
}

export function SettingsView({
  settings,
  sortField,
  sortDirection,
  effects,
  detectedFolders,
  isNativeAndroid,
  isScanning,
  storageStats,
  onUpdateSettings,
  onChangeDefaultSort,
  onRescanLibrary,
  onRefreshMetadata,
  onClearArtworkCache,
  onClearCustomLyrics,
  onClearWebLibrary,
  onOpenEffects,
}: SettingsViewProps) {
  const [newFolderInput, setNewFolderInput] = useState('');
  const [confirmClearLyrics, setConfirmClearLyrics] = useState(false);
  const [confirmClearWeb, setConfirmClearWeb] = useState(false);

  const handleAddExcludedFolder = () => {
    const trimmed = newFolderInput.trim();
    if (!trimmed) return;
    if (!settings.excludedFolders.includes(trimmed)) {
      onUpdateSettings({
        excludedFolders: [...settings.excludedFolders, trimmed],
      });
    }
    setNewFolderInput('');
  };

  const handleToggleExcludedFolder = (folderPath: string) => {
    const exists = settings.excludedFolders.includes(folderPath);
    onUpdateSettings({
      excludedFolders: exists
        ? settings.excludedFolders.filter((f) => f !== folderPath)
        : [...settings.excludedFolders, folderPath],
    });
  };

  return (
    <div className="px-4 sm:px-8 py-6 space-y-6 max-w-4xl">
      <header className="pb-4 border-b border-zinc-200 dark:border-white/[0.08]">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-[-0.02em] text-zinc-900 dark:text-[#F4F4F6]">
          Settings
        </h1>
        <p className="text-xs text-zinc-500 dark:text-[#8C8C96] mt-1">
          Configure appearance, offline audio playback, library scanning, lyrics,
          and local storage.
        </p>
      </header>

      {/* Appearance */}
      <section className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.08] space-y-4">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-[#E85D3F]" />
          <h2 className="text-base font-semibold text-zinc-900 dark:text-[#F4F4F6]">
            Appearance
          </h2>
        </div>

        <div className="space-y-2">
          <p className="text-xs text-zinc-500 dark:text-[#8C8C96]">
            Theme Mode
          </p>
          <div className="grid grid-cols-3 gap-2.5">
            {(
              [
                { id: 'dark', label: 'Dark', icon: Moon },
                { id: 'light', label: 'Light', icon: Sun },
                { id: 'system', label: 'System', icon: Monitor },
              ] as { id: ThemePreference; label: string; icon: typeof Moon }[]
            ).map((opt) => {
              const Icon = opt.icon;
              const active = settings.themePreference === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onUpdateSettings({ themePreference: opt.id })}
                  aria-pressed={active}
                  className={`min-h-[44px] px-3 py-2 rounded-xl border text-xs font-medium inline-flex items-center justify-center gap-2 transition-colors ${
                    active
                      ? 'border-[#E85D3F] bg-[#E85D3F]/10 text-[#E85D3F]'
                      : 'border-zinc-200 dark:border-white/[0.09] text-zinc-700 dark:text-[#C4C4CC] hover:border-zinc-300 dark:hover:border-white/20'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Playback */}
      <section className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.08] space-y-2">
        <div className="flex items-center gap-2.5 pb-2">
          <Volume2 className="w-4 h-4 text-[#E85D3F]" />
          <h2 className="text-base font-semibold text-zinc-900 dark:text-[#F4F4F6]">
            Playback
          </h2>
        </div>

        <div className="divide-y divide-zinc-200 dark:divide-white/[0.06]">
          <ToggleRow
            id="setting-gapless"
            label="Gapless Playback"
            description="Transition seamlessly between consecutive album tracks without injected silence."
            checked={settings.gaplessPlayback}
            onChange={(val) => onUpdateSettings({ gaplessPlayback: val })}
          />

          <ToggleRow
            id="setting-resume-startup"
            label="Resume Last Track & Position"
            description="Restore your previous queue, active track, and playback timestamp on restart."
            checked={settings.resumeOnStartup}
            onChange={(val) => onUpdateSettings({ resumeOnStartup: val })}
          />

          <ToggleRow
            id="setting-headphone-pause"
            label="Pause When Headphones Disconnect"
            description="Automatically pause playback if wired or Bluetooth audio output disconnects."
            checked={settings.pauseOnHeadphoneDisconnect}
            onChange={(val) =>
              onUpdateSettings({ pauseOnHeadphoneDisconnect: val })
            }
          />

          <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label
                htmlFor="setting-audio-focus"
                className="text-sm font-medium text-zinc-900 dark:text-[#F4F4F6] block"
              >
                Audio Focus Behavior
              </label>
              <p className="text-xs text-zinc-500 dark:text-[#8C8C96] mt-0.5">
                How Android handles interruptions from navigation prompts or
                calls.
              </p>
            </div>
            <select
              id="setting-audio-focus"
              value={settings.audioFocusMode}
              onChange={(e) =>
                onUpdateSettings({
                  audioFocusMode: e.target.value as AudioFocusMode,
                })
              }
              className="h-9 px-3 rounded-lg bg-stone-50 dark:bg-[#19191F] border border-zinc-300 dark:border-white/[0.12] text-xs font-medium text-zinc-900 dark:text-[#F4F4F6]"
            >
              <option value="pause">Pause on Focus Loss</option>
              <option value="duck">Lower Volume (Duck)</option>
            </select>
          </div>

          <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label
                htmlFor="setting-default-speed"
                className="text-sm font-medium text-zinc-900 dark:text-[#F4F4F6] block"
              >
                Default Playback Speed
              </label>
              <p className="text-xs text-zinc-500 dark:text-[#8C8C96] mt-0.5">
                Applied across sessions and adjustable anytime from Now Playing.
              </p>
            </div>
            <select
              id="setting-default-speed"
              value={settings.defaultPlaybackSpeed}
              onChange={(e) =>
                onUpdateSettings({
                  defaultPlaybackSpeed: Number(e.target.value),
                })
              }
              className="h-9 px-3 rounded-lg bg-stone-50 dark:bg-[#19191F] border border-zinc-300 dark:border-white/[0.12] text-xs font-mono text-zinc-900 dark:text-[#F4F4F6]"
            >
              {[0.75, 1, 1.25, 1.5, 2].map((sp) => (
                <option key={sp} value={sp}>
                  {sp}x
                </option>
              ))}
            </select>
          </div>

          <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label
                htmlFor="setting-crossfade"
                className="text-sm font-medium text-zinc-900 dark:text-[#F4F4F6] block"
              >
                Track Crossfade / Gain Ramp
              </label>
              <p className="text-xs text-zinc-500 dark:text-[#8C8C96] mt-0.5">
                {isNativeAndroid
                  ? 'Native Android Media3 uses a single gapless pipeline; fade ramps apply in browser mode.'
                  : 'Smoothly fades volume out at track end and ramps into the next track.'}
              </p>
            </div>
            <select
              id="setting-crossfade"
              value={settings.crossfadeSec}
              onChange={(e) =>
                onUpdateSettings({ crossfadeSec: Number(e.target.value) })
              }
              className="h-9 px-3 rounded-lg bg-stone-50 dark:bg-[#19191F] border border-zinc-300 dark:border-white/[0.12] text-xs font-mono text-zinc-900 dark:text-[#F4F4F6]"
            >
              <option value={0}>Off (0s)</option>
              <option value={2}>2 seconds</option>
              <option value={4}>4 seconds</option>
              <option value={6}>6 seconds</option>
            </select>
          </div>
        </div>
      </section>

      {/* Library & Folders */}
      <section className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.08] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Disc3 className="w-4 h-4 text-[#E85D3F]" />
            <h2 className="text-base font-semibold text-zinc-900 dark:text-[#F4F4F6]">
              Library & Artwork
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRescanLibrary}
              disabled={isScanning}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-zinc-300 dark:border-white/[0.12] text-xs font-medium text-zinc-800 dark:text-[#F4F4F6] inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`}
              />
              <span>Rescan Library</span>
            </button>
            <button
              type="button"
              onClick={onRefreshMetadata}
              disabled={isScanning}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#E85D3F] hover:bg-[#D55033] text-white text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`}
              />
              <span>Refresh Metadata & Artwork</span>
            </button>
          </div>
        </div>

        <div className="divide-y divide-zinc-200 dark:divide-white/[0.06]">
          <ToggleRow
            id="setting-load-artwork"
            label="Load Embedded Album Artwork"
            description="Extract cover art from ID3 APIC, FLAC PICTURE, and M4A covr tags during library scan."
            checked={settings.loadEmbeddedArtwork}
            onChange={(val) => onUpdateSettings({ loadEmbeddedArtwork: val })}
          />

          <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-[#F4F4F6]">
                Default Track Sort
              </p>
              <p className="text-xs text-zinc-500 dark:text-[#8C8C96] mt-0.5">
                Used across Tracks and Favorites lists.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Default sort field"
                value={sortField}
                onChange={(e) =>
                  onChangeDefaultSort(
                    e.target.value as SortField,
                    sortDirection
                  )
                }
                className="h-9 px-3 rounded-lg bg-stone-50 dark:bg-[#19191F] border border-zinc-300 dark:border-white/[0.12] text-xs font-medium"
              >
                <option value="title">Title</option>
                <option value="artist">Artist</option>
                <option value="album">Album</option>
                <option value="duration">Duration</option>
                <option value="dateAdded">Date Added</option>
              </select>
              <select
                aria-label="Default sort direction"
                value={sortDirection}
                onChange={(e) =>
                  onChangeDefaultSort(
                    sortField,
                    e.target.value as SortDirection
                  )
                }
                className="h-9 px-3 rounded-lg bg-stone-50 dark:bg-[#19191F] border border-zinc-300 dark:border-white/[0.12] text-xs font-mono uppercase"
              >
                <option value="asc">ASC</option>
                <option value="desc">DESC</option>
              </select>
            </div>
          </div>
        </div>

        {/* Excluded Folders */}
        <div className="pt-2 space-y-3">
          <div className="flex items-center gap-2">
            <FolderMinus className="w-4 h-4 text-zinc-500" />
            <h3 className="text-sm font-medium text-zinc-900 dark:text-[#F4F4F6]">
              Excluded Folders
            </h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-[#8C8C96]">
            Hide ringtones, voice recordings, or specific directories from your
            Cadence library without deleting any files.
          </p>

          <div className="flex gap-2">
            <input
              type="text"
              value={newFolderInput}
              onChange={(e) => setNewFolderInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddExcludedFolder();
              }}
              placeholder="Folder name or path (e.g. Ringtones)"
              aria-label="Folder path to exclude"
              className="flex-1 h-9 px-3 rounded-lg bg-stone-50 dark:bg-[#19191F] border border-zinc-300 dark:border-white/[0.12] text-xs text-zinc-900 dark:text-[#F4F4F6] focus:outline-none focus:border-[#E85D3F]"
            />
            <button
              type="button"
              onClick={handleAddExcludedFolder}
              className="h-9 px-3.5 rounded-lg bg-zinc-900 dark:bg-[#23232A] text-white text-xs font-medium inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Exclude</span>
            </button>
          </div>

          {settings.excludedFolders.length > 0 && (
            <ul className="space-y-1.5">
              {settings.excludedFolders.map((folder) => (
                <li
                  key={folder}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-stone-50 dark:bg-[#19191F] border border-zinc-200 dark:border-white/[0.08] text-xs font-mono"
                >
                  <span className="truncate">{folder}</span>
                  <button
                    type="button"
                    onClick={() => handleToggleExcludedFolder(folder)}
                    aria-label={`Include folder ${folder}`}
                    className="text-zinc-500 hover:text-[#E85D3F] p-1"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {detectedFolders.length > 0 && (
            <div className="space-y-1.5 pt-1">
              <p className="text-[11px] font-medium text-zinc-500 dark:text-[#7C7C87]">
                Detected Library Folders
              </p>
              <div className="flex flex-wrap gap-2">
                {detectedFolders.slice(0, 8).map((df) => {
                  const excluded = settings.excludedFolders.includes(df.path);
                  return (
                    <button
                      key={df.path}
                      type="button"
                      onClick={() => handleToggleExcludedFolder(df.path)}
                      className={`px-2.5 py-1.5 rounded-lg border text-xs font-mono transition-colors ${
                        excluded
                          ? 'border-[#E85D3F] text-[#E85D3F] bg-[#E85D3F]/10'
                          : 'border-zinc-200 dark:border-white/[0.08] text-zinc-600 dark:text-[#9C9CA6]'
                      }`}
                    >
                      {excluded ? `Excluded: ${df.name}` : df.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Lyrics */}
      <section className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.08] space-y-2">
        <div className="flex items-center gap-2.5 pb-2">
          <FileText className="w-4 h-4 text-[#E85D3F]" />
          <h2 className="text-base font-semibold text-zinc-900 dark:text-[#F4F4F6]">
            Lyrics
          </h2>
        </div>

        <div className="divide-y divide-zinc-200 dark:divide-white/[0.06]">
          <ToggleRow
            id="setting-synced-lyrics"
            label="Synchronized LRC Lyrics"
            description="Parse timestamps from .lrc files and ID3 SYLT frames for live active-line tracking."
            checked={settings.syncedLyricsEnabled}
            onChange={(val) => onUpdateSettings({ syncedLyricsEnabled: val })}
          />

          <ToggleRow
            id="setting-lyrics-autoscroll"
            label="Auto-Scroll Following Playback"
            description="Automatically center the active lyric line while respecting manual browsing."
            checked={settings.lyricsAutoScroll}
            onChange={(val) => onUpdateSettings({ lyricsAutoScroll: val })}
          />

          <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-[#F4F4F6]">
                Lyrics Font Size
              </p>
              <p className="text-xs text-zinc-500 dark:text-[#8C8C96] mt-0.5">
                Adjust readability inside the Now Playing lyrics sheet.
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {(
                [
                  { id: 'sm', label: 'Small' },
                  { id: 'md', label: 'Medium' },
                  { id: 'lg', label: 'Large' },
                ] as { id: LyricsTextSize; label: string }[]
              ).map((sz) => (
                <button
                  key={sz.id}
                  type="button"
                  onClick={() => onUpdateSettings({ lyricsTextSize: sz.id })}
                  aria-pressed={settings.lyricsTextSize === sz.id}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-medium ${
                    settings.lyricsTextSize === sz.id
                      ? 'border-[#E85D3F] bg-[#E85D3F]/10 text-[#E85D3F]'
                      : 'border-zinc-200 dark:border-white/[0.09] text-zinc-700 dark:text-[#C4C4CC]'
                  }`}
                >
                  {sz.label}
                </button>
              ))}
            </div>
          </div>

          <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-[#F4F4F6]">
                Custom Lyrics Associations ({storageStats.customLyricsCount})
              </p>
              <p className="text-xs text-zinc-500 dark:text-[#8C8C96] mt-0.5">
                Manually linked .lrc and .txt lyrics stored offline per track.
              </p>
            </div>
            {confirmClearLyrics ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClearCustomLyrics();
                    setConfirmClearLyrics(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold"
                >
                  Confirm Clear
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearLyrics(false)}
                  className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-white/[0.12] text-xs"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={storageStats.customLyricsCount === 0}
                onClick={() => setConfirmClearLyrics(true)}
                className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-white/[0.12] text-xs font-medium text-zinc-700 dark:text-[#C4C4CC] disabled:opacity-40"
              >
                Clear Custom Lyrics
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Audio DSP */}
      <section className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.08] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-[#E85D3F]" />
            <h2 className="text-base font-semibold text-zinc-900 dark:text-[#F4F4F6]">
              Audio Processing & Equalizer
            </h2>
          </div>
          <p className="text-xs font-mono text-zinc-500 dark:text-[#8C8C96]">
            EQ: {effects.equalizerSupported ? `${effects.bands.length}-Band Active` : 'Unsupported'} ·{' '}
            Bass Boost: {effects.bassBoostSupported ? 'Available' : 'Unsupported'} ·{' '}
            Virtualizer: {effects.virtualizerSupported ? 'Available' : 'Device Dependent'}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenEffects}
          className="min-h-[40px] px-4 py-2 rounded-lg bg-[#E85D3F] hover:bg-[#D55033] text-white text-xs font-semibold inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>Open Equalizer</span>
        </button>
      </section>

      {/* Storage & Privacy */}
      <section className="p-5 sm:p-6 rounded-2xl bg-white dark:bg-[#131316] border border-zinc-200 dark:border-white/[0.08] space-y-4">
        <div className="flex items-center gap-2.5">
          <HardDrive className="w-4 h-4 text-[#E85D3F]" />
          <h2 className="text-base font-semibold text-zinc-900 dark:text-[#F4F4F6]">
            Storage & Privacy
          </h2>
        </div>

        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#19191F] border border-zinc-200 dark:border-white/[0.06]">
            <dt className="text-zinc-500 dark:text-[#8C8C96]">Library Audio</dt>
            <dd className="font-mono font-semibold text-sm mt-1">
              {formatFileSize(storageStats.audioBytes)}
            </dd>
          </div>
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#19191F] border border-zinc-200 dark:border-white/[0.06]">
            <dt className="text-zinc-500 dark:text-[#8C8C96]">Artwork Cache</dt>
            <dd className="font-mono font-semibold text-sm mt-1">
              {formatFileSize(storageStats.artworkBytes)}
            </dd>
          </div>
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#19191F] border border-zinc-200 dark:border-white/[0.06]">
            <dt className="text-zinc-500 dark:text-[#8C8C96]">Indexed Tracks</dt>
            <dd className="font-mono font-semibold text-sm mt-1">
              {storageStats.trackCount}
            </dd>
          </div>
          <div className="p-3 rounded-xl bg-stone-50 dark:bg-[#19191F] border border-zinc-200 dark:border-white/[0.06]">
            <dt className="text-zinc-500 dark:text-[#8C8C96]">App Version</dt>
            <dd className="font-mono font-semibold text-sm mt-1">v1.0.0</dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-xs text-zinc-500 dark:text-[#8C8C96]">
            100% offline. No analytics, cloud uploads, or remote tracking.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onClearArtworkCache}
              className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-zinc-300 dark:border-white/[0.12] text-xs font-medium inline-flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear Artwork Cache</span>
            </button>

            {!isNativeAndroid &&
              (confirmClearWeb ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onClearWebLibrary();
                      setConfirmClearWeb(false);
                    }}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-red-600 text-white text-xs font-semibold"
                  >
                    Confirm Wipe Browser Library
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmClearWeb(false)}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-white/[0.12] text-xs"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmClearWeb(true)}
                  className="min-h-[38px] px-3.5 py-1.5 rounded-lg border border-red-300 dark:border-red-500/30 text-red-600 dark:text-red-400 text-xs font-medium"
                >
                  Clear Imported Browser Files
                </button>
              ))}
          </div>
        </div>
      </section>
    </div>
  );
}
