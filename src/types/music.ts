export type RepeatMode = 'off' | 'all' | 'one';

export type ThemeMode = 'dark' | 'light';

export type ThemePreference = 'dark' | 'light' | 'system';

export type SortField = 'title' | 'artist' | 'album' | 'duration' | 'dateAdded';

export type SortDirection = 'asc' | 'desc';

export type AudioFocusMode = 'pause' | 'duck';

export type LyricsTextSize = 'sm' | 'md' | 'lg';

export type ViewTab =
  | 'home'
  | 'tracks'
  | 'albums'
  | 'artists'
  | 'folders'
  | 'playlists'
  | 'favorites'
  | 'eq'
  | 'settings'
  | 'album-detail'
  | 'artist-detail';

export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unknown';

export interface Track {
  id: string;
  mediaStoreId?: number;
  uri: string;
  filePath: string;
  title: string;
  artist: string;
  album: string;
  albumId: string;
  durationSec: number;
  durationMs: number;
  trackNumber: number;
  bitrateKbps?: number;
  mimeType: string;
  formatLabel: string;
  sizeBytes: number;
  dateAdded: number;
  folderPath: string;
  folderName: string;
  artworkPath: string;
  artworkUrl: string;
  embeddedLyrics?: string;
  source: 'android' | 'web-file';
  missing?: boolean;
}

export interface AlbumGroup {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string;
  trackIds: string[];
  totalDurationSec: number;
}

export interface ArtistGroup {
  name: string;
  artworkUrl: string;
  albumIds: string[];
  trackIds: string[];
  totalDurationSec: number;
}

export interface FolderGroup {
  path: string;
  name: string;
  trackIds: string[];
  totalDurationSec: number;
}

export interface Playlist {
  id: string;
  name: string;
  description: string;
  trackIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface LyricsLine {
  timeSec: number | null;
  text: string;
}

export interface ParsedLyrics {
  synced: boolean;
  lines: LyricsLine[];
}

export interface EqBandInfo {
  index: number;
  centerFreqHz: number;
  levelMb: number;
}

export interface AudioEffectsState {
  enabled: boolean;
  equalizerSupported: boolean;
  minLevelMb: number;
  maxLevelMb: number;
  bands: EqBandInfo[];
  bassBoostSupported: boolean;
  bassBoostStrength: number;
  virtualizerSupported: boolean;
  virtualizerStrength: number;
}

export interface EqPreset {
  id: string;
  name: string;
  description: string;
  bandGainsDb: number[];
}

export interface PlaybackSnapshot {
  isPlaying: boolean;
  currentTrackId: string | null;
  positionSec: number;
  durationSec: number;
  shuffle: boolean;
  repeatMode: RepeatMode;
  playbackSpeed: number;
  sleepTimerEndAtMs: number;
}

export interface AppSettings {
  themePreference: ThemePreference;
  gaplessPlayback: boolean;
  resumeOnStartup: boolean;
  audioFocusMode: AudioFocusMode;
  pauseOnHeadphoneDisconnect: boolean;
  defaultPlaybackSpeed: number;
  crossfadeSec: number;
  loadEmbeddedArtwork: boolean;
  excludedFolders: string[];
  syncedLyricsEnabled: boolean;
  lyricsAutoScroll: boolean;
  lyricsTextSize: LyricsTextSize;
}

export interface PersistedPlaybackState {
  currentTrackId: string | null;
  positionSec: number;
  queueIds: string[];
  shuffle: boolean;
  repeatMode: RepeatMode;
  playbackSpeed: number;
}
