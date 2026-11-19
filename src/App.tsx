import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { HomeDashboardView } from './components/HomeDashboardView';
import {
  AlbumDetailView,
  AlbumsGridView,
  ArtistDetailView,
  ArtistsGridView,
  FoldersView,
} from './components/LibraryViews';
import { NowPlayingModal } from './components/NowPlayingModal';
import { PlayerBar } from './components/PlayerBar';
import { PlaylistsView } from './components/PlaylistsView';
import { QueuePanel } from './components/QueuePanel';
import { SettingsView } from './components/SettingsView';
import { Sidebar } from './components/Sidebar';
import { StudioEqView } from './components/StudioEqView';
import { TopBar } from './components/TopBar';
import { TrackDetailsModal } from './components/TrackDetailsModal';
import { TrackListView } from './components/TrackListView';
import { playbackBridge } from './services/playbackBridge';
import type {
  AlbumGroup,
  AppSettings,
  AudioEffectsState,
  PermissionStatus,
  PersistedPlaybackState,
  Playlist,
  RepeatMode,
  SortDirection,
  SortField,
  ThemeMode,
  Track,
  ViewTab,
} from './types/music';
import {
  clampEqGainDb,
  deduplicateTracks,
  enqueueTrackUnique,
  filterExcludedFolders,
  filterTracks,
  groupTracksIntoAlbums,
  groupTracksIntoArtists,
  groupTracksIntoFolders,
  moveQueueItem,
  playNextInQueue,
  sortTracks,
} from './utils/musicLogic';
import {
  clearAllTrackCustomLyrics,
  getAllTrackCustomLyricsIds,
  getWebStorageStats,
  loadAllCustomArtworkUrls,
  saveCustomArtwork,
  saveTrackCustomLyrics,
} from './utils/webFileStore';

const STORAGE_KEYS = {
  theme: 'cadence_theme_v1',
  settings: 'cadence_settings_v1',
  playbackState: 'cadence_playback_state_v1',
  favorites: 'cadence_favorites_v1',
  playlists: 'cadence_playlists_v1',
  recent: 'cadence_recent_v1',
  playCounts: 'cadence_play_counts_v1',
  volume: 'cadence_volume_v1',
  sortField: 'cadence_sort_field_v1',
  sortDir: 'cadence_sort_dir_v1',
};

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeStorage(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore storage quota errors
  }
}

function getDefaultSettings(): AppSettings {
  const legacyTheme = readStorage<ThemeMode>(STORAGE_KEYS.theme, 'dark');
  return {
    themePreference: legacyTheme === 'light' ? 'light' : 'dark',
    gaplessPlayback: true,
    resumeOnStartup: true,
    audioFocusMode: 'pause',
    pauseOnHeadphoneDisconnect: true,
    defaultPlaybackSpeed: 1.0,
    crossfadeSec: 0,
    loadEmbeddedArtwork: true,
    excludedFolders: [],
    syncedLyricsEnabled: true,
    lyricsAutoScroll: true,
    lyricsTextSize: 'md',
  };
}

const DEFAULT_EFFECTS: AudioEffectsState = {
  enabled: true,
  equalizerSupported: true,
  minLevelMb: -1200,
  maxLevelMb: 1200,
  bands: [
    { index: 0, centerFreqHz: 60, levelMb: 0 },
    { index: 1, centerFreqHz: 230, levelMb: 0 },
    { index: 2, centerFreqHz: 910, levelMb: 0 },
    { index: 3, centerFreqHz: 3600, levelMb: 0 },
    { index: 4, centerFreqHz: 14000, levelMb: 0 },
  ],
  bassBoostSupported: true,
  bassBoostStrength: 0,
  virtualizerSupported: false,
  virtualizerStrength: 0,
};

export default function App() {
  const [settings, setSettings] = useState<AppSettings>(() => ({
    ...getDefaultSettings(),
    ...readStorage<Partial<AppSettings>>(STORAGE_KEYS.settings, {}),
  }));
  const [systemPrefersDark, setSystemPrefersDark] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return true;
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const theme: ThemeMode =
    settings.themePreference === 'system'
      ? systemPrefersDark
        ? 'dark'
        : 'light'
      : settings.themePreference;

  const [activeView, setActiveView] = useState<ViewTab>('home');
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [selectedArtistName, setSelectedArtistName] = useState<string | null>(
    null
  );
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(
    null
  );

  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>(() =>
    readStorage<SortField>(STORAGE_KEYS.sortField, 'title')
  );
  const [sortDirection, setSortDirection] = useState<SortDirection>(() =>
    readStorage<SortDirection>(STORAGE_KEYS.sortDir, 'asc')
  );

  const [rawTracks, setRawTracks] = useState<Track[]>([]);
  const [customArtworkUrls, setCustomArtworkUrls] = useState<
    Record<string, string>
  >({});
  const [customLyricsTrackIds, setCustomLyricsTrackIds] = useState<string[]>(
    []
  );

  const [permissionStatus, setPermissionStatus] = useState<PermissionStatus>(
    playbackBridge.isNativeAndroid ? 'unknown' : 'granted'
  );
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);

  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    readStorage<string[]>(STORAGE_KEYS.favorites, [])
  );
  const [playlists, setPlaylists] = useState<Playlist[]>(() =>
    readStorage<Playlist[]>(STORAGE_KEYS.playlists, [])
  );
  const [recentIds, setRecentIds] = useState<string[]>(() =>
    readStorage<string[]>(STORAGE_KEYS.recent, [])
  );
  const [playCounts, setPlayCounts] = useState<Record<string, number>>(() =>
    readStorage<Record<string, number>>(STORAGE_KEYS.playCounts, {})
  );

  const [queueIds, setQueueIds] = useState<string[]>([]);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [positionSec, setPositionSec] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('all');
  const [playbackSpeed, setPlaybackSpeed] = useState(
    () => settings.defaultPlaybackSpeed || 1.0
  );
  const [sleepTimerEndAtMs, setSleepTimerEndAtMs] = useState(0);

  const [volume, setVolume] = useState<number>(() =>
    readStorage<number>(STORAGE_KEYS.volume, 0.8)
  );
  const [muted, setMuted] = useState(false);

  const [effects, setEffects] = useState<AudioEffectsState>(DEFAULT_EFFECTS);
  const [rawLyrics, setRawLyrics] = useState('');
  const [lyricsRefreshNonce, setLyricsRefreshNonce] = useState(0);

  const [isQueueOpen, setIsQueueOpen] = useState(false);
  const [nowPlayingOpen, setNowPlayingOpen] = useState(false);
  const [detailsTrack, setDetailsTrack] = useState<Track | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [storageStats, setStorageStats] = useState({
    trackCount: 0,
    audioBytes: 0,
    artworkCount: 0,
    artworkBytes: 0,
    customLyricsCount: 0,
  });

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const lyricsPickerRef = useRef<HTMLInputElement | null>(null);
  const coverPickerRef = useRef<HTMLInputElement | null>(null);
  const pendingLyricsTrackRef = useRef<Track | null>(null);
  const pendingCoverTargetRef = useRef<{ key: string; label: string } | null>(
    null
  );
  const lastRecordedPlayKeyRef = useRef<string | null>(null);
  const playbackRestoredRef = useRef(false);
  const lastPlaybackPersistAtRef = useRef(0);

  // Listen to OS theme preference changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = (e: MediaQueryListEvent) => setSystemPrefersDark(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  // Apply Tailwind dark class on <html>
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    writeStorage(STORAGE_KEYS.theme, theme);
  }, [theme]);

  // Persist user preferences & settings
  useEffect(() => writeStorage(STORAGE_KEYS.settings, settings), [settings]);
  useEffect(() => writeStorage(STORAGE_KEYS.favorites, favoriteIds), [favoriteIds]);
  useEffect(() => writeStorage(STORAGE_KEYS.playlists, playlists), [playlists]);
  useEffect(() => writeStorage(STORAGE_KEYS.recent, recentIds), [recentIds]);
  useEffect(() => writeStorage(STORAGE_KEYS.playCounts, playCounts), [playCounts]);
  useEffect(() => writeStorage(STORAGE_KEYS.volume, volume), [volume]);
  useEffect(() => writeStorage(STORAGE_KEYS.sortField, sortField), [sortField]);
  useEffect(() => writeStorage(STORAGE_KEYS.sortDir, sortDirection), [sortDirection]);

  // Sync Web Audio volume
  useEffect(() => {
    void playbackBridge.setVolume(volume, muted);
  }, [volume, muted]);

  // Sync playback settings (audio focus, headphone disconnect, crossfade)
  useEffect(() => {
    void playbackBridge.setPlaybackSettings({
      pauseOnHeadphoneDisconnect: settings.pauseOnHeadphoneDisconnect,
      audioFocusMode: settings.audioFocusMode,
      crossfadeSec: settings.crossfadeSec,
    });
  }, [
    settings.pauseOnHeadphoneDisconnect,
    settings.audioFocusMode,
    settings.crossfadeSec,
  ]);

  // Auto-dismiss transient toast notice
  useEffect(() => {
    if (!statusNotice) return;
    const t = window.setTimeout(() => setStatusNotice(null), 3500);
    return () => window.clearTimeout(t);
  }, [statusNotice]);

  // Merge custom covers + sibling album art inheritance onto scanned tracks
  const tracksWithCustomArtwork = useMemo(() => {
    const albumFallbackArt = new Map<string, string>();
    if (settings.loadEmbeddedArtwork) {
      for (const t of rawTracks) {
        const isNamedAlbum =
          Boolean(t.albumId) &&
          t.album !== 'Local Imports' &&
          t.album !== 'Unknown Album';
        if (isNamedAlbum && t.artworkUrl && !albumFallbackArt.has(t.albumId)) {
          albumFallbackArt.set(t.albumId, t.artworkUrl);
        }
      }
    }
    return rawTracks.map((t) => {
      const trackCustom = customArtworkUrls[`custom-track-${t.id}`];
      const albumCustom = customArtworkUrls[`custom-album-${t.albumId}`];
      const isNamedAlbum =
        Boolean(t.albumId) &&
        t.album !== 'Local Imports' &&
        t.album !== 'Unknown Album';
      const embeddedOrInherited = settings.loadEmbeddedArtwork
        ? t.artworkUrl || (isNamedAlbum ? albumFallbackArt.get(t.albumId) ?? '' : '')
        : '';
      const resolvedUrl = trackCustom || albumCustom || embeddedOrInherited;
      return resolvedUrl === t.artworkUrl
        ? t
        : { ...t, artworkUrl: resolvedUrl };
    });
  }, [rawTracks, customArtworkUrls, settings.loadEmbeddedArtwork]);

  const tracks = useMemo(
    () => filterExcludedFolders(tracksWithCustomArtwork, settings.excludedFolders),
    [tracksWithCustomArtwork, settings.excludedFolders]
  );

  const allDetectedFolders = useMemo(
    () => groupTracksIntoFolders(rawTracks),
    [rawTracks]
  );

  const refreshStorageStats = useCallback(async () => {
    if (playbackBridge.isNativeAndroid) {
      const customLyricsIds = await getAllTrackCustomLyricsIds();
      setStorageStats({
        trackCount: rawTracks.length,
        audioBytes: rawTracks.reduce((sum, t) => sum + (t.sizeBytes || 0), 0),
        artworkCount: Object.keys(customArtworkUrls).length,
        artworkBytes: 0,
        customLyricsCount: customLyricsIds.length,
      });
      return;
    }
    const stats = await getWebStorageStats();
    setStorageStats(stats);
  }, [rawTracks, customArtworkUrls]);

  useEffect(() => {
    if (activeView === 'settings') {
      void refreshStorageStats();
    }
  }, [activeView, refreshStorageStats]);

  const refreshEffectsState = useCallback(async () => {
    const state = await playbackBridge.getAudioEffectsState();
    setEffects(state);
  }, []);

  const performScan = useCallback(async (forceRefresh = false): Promise<Track[]> => {
    setIsScanning(true);
    setScanError(null);
    try {
      const scanned = await playbackBridge.scanLibrary(forceRefresh);
      const deduped = deduplicateTracks(scanned);
      setRawTracks(deduped);
      return deduped;
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : 'Failed to scan local audio files.'
      );
      return [];
    } finally {
      setIsScanning(false);
    }
  }, []);

  // Initialize PlaybackBridge, custom covers/lyrics maps, and restore last session
  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let active = true;

    const boot = async () => {
      const [artMap, lyricsIds] = await Promise.all([
        loadAllCustomArtworkUrls(),
        getAllTrackCustomLyricsIds(),
      ]);
      if (!active) return;
      setCustomArtworkUrls(artMap);
      setCustomLyricsTrackIds(lyricsIds);

      cleanup = await playbackBridge.init(
        (snap) => {
          if (!active) return;
          setIsPlaying(snap.isPlaying);
          setCurrentTrackId(snap.currentTrackId);
          setPositionSec(snap.positionSec);
          setDurationSec(snap.durationSec);
          setShuffle(snap.shuffle);
          setRepeatMode(snap.repeatMode);
          setPlaybackSpeed(snap.playbackSpeed);
          setSleepTimerEndAtMs(snap.sleepTimerEndAtMs);
        },
        (msg) => {
          if (!active) return;
          setStatusNotice(msg);
        }
      );

      let loadedTracks: Track[] = [];
      if (playbackBridge.isNativeAndroid) {
        const perm = await playbackBridge.checkPermissionStatus();
        if (!active) return;
        setPermissionStatus(perm);
        if (perm === 'granted') {
          loadedTracks = await performScan();
        }
      } else {
        loadedTracks = await performScan();
      }

      if (!active) return;

      // Restore previous queue, active track, and position on startup
      if (settings.resumeOnStartup && !playbackRestoredRef.current && loadedTracks.length > 0) {
        playbackRestoredRef.current = true;
        const saved = readStorage<PersistedPlaybackState | null>(
          STORAGE_KEYS.playbackState,
          null
        );
        if (saved && saved.currentTrackId) {
          const availableIds = new Set(loadedTracks.map((t) => t.id));
          if (availableIds.has(saved.currentTrackId)) {
            const validQueueIds = (
              saved.queueIds?.length ? saved.queueIds : [saved.currentTrackId]
            ).filter((id) => availableIds.has(id));
            const finalQueueIds = validQueueIds.includes(saved.currentTrackId)
              ? validQueueIds
              : [saved.currentTrackId, ...validQueueIds];
            const trackLookup = new Map(loadedTracks.map((t) => [t.id, t]));
            const resolvedQueue = finalQueueIds
              .map((id) => trackLookup.get(id))
              .filter((t): t is Track => Boolean(t));

            setQueueIds(finalQueueIds);
            setCurrentTrackId(saved.currentTrackId);
            setPositionSec(saved.positionSec || 0);
            setShuffle(Boolean(saved.shuffle));
            setRepeatMode(saved.repeatMode || 'all');
            setPlaybackSpeed(
              saved.playbackSpeed || settings.defaultPlaybackSpeed || 1.0
            );

            await playbackBridge.restorePlaybackState(
              resolvedQueue,
              saved.currentTrackId,
              saved.positionSec || 0,
              {
                shuffle: Boolean(saved.shuffle),
                repeatMode: saved.repeatMode || 'all',
                speed: saved.playbackSpeed || settings.defaultPlaybackSpeed || 1.0,
              }
            );
          }
        }
      }

      await refreshEffectsState();
    };

    void boot();

    return () => {
      active = false;
      cleanup?.();
    };
  }, [performScan, refreshEffectsState, settings.resumeOnStartup, settings.defaultPlaybackSpeed]);

  // Persist playback progress & queue periodically and on track/queue switches
  useEffect(() => {
    if (!currentTrackId) return;
    const now = Date.now();
    if (now - lastPlaybackPersistAtRef.current < 1200 && isPlaying) {
      return;
    }
    lastPlaybackPersistAtRef.current = now;
    const payload: PersistedPlaybackState = {
      currentTrackId,
      positionSec,
      queueIds,
      shuffle,
      repeatMode,
      playbackSpeed,
    };
    writeStorage(STORAGE_KEYS.playbackState, payload);
  }, [currentTrackId, positionSec, queueIds, shuffle, repeatMode, playbackSpeed, isPlaying]);

  // Re-check permissions when returning from Android Settings
  useEffect(() => {
    if (!playbackBridge.isNativeAndroid) return;
    const onVisibility = async () => {
      if (document.visibilityState === 'visible') {
        const perm = await playbackBridge.checkPermissionStatus();
        setPermissionStatus(perm);
        if (perm === 'granted' && rawTracks.length === 0 && !isScanning) {
          await performScan();
        }
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [rawTracks.length, isScanning, performScan]);

  // Android hardware back & desktop Escape key dismissal without stopping playback
  const handleDismissTopOverlay = useCallback(() => {
    if (detailsTrack) {
      setDetailsTrack(null);
      return true;
    }
    if (nowPlayingOpen) {
      setNowPlayingOpen(false);
      return true;
    }
    if (isQueueOpen) {
      setIsQueueOpen(false);
      return true;
    }
    if (activeView === 'album-detail') {
      setActiveView('albums');
      return true;
    }
    if (activeView === 'artist-detail') {
      setActiveView('artists');
      return true;
    }
    return false;
  }, [detailsTrack, nowPlayingOpen, isQueueOpen, activeView]);

  const hasDismissibleOverlay = Boolean(
    detailsTrack ||
      nowPlayingOpen ||
      isQueueOpen ||
      activeView === 'album-detail' ||
      activeView === 'artist-detail'
  );

  useEffect(() => {
    void playbackBridge.setBackInterceptor(hasDismissibleOverlay);
  }, [hasDismissibleOverlay]);

  useEffect(() => {
    const onHardwareBack = () => {
      handleDismissTopOverlay();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismissTopOverlay();
      }
    };
    window.addEventListener('cadenceHardwareBack', onHardwareBack);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('cadenceHardwareBack', onHardwareBack);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [handleDismissTopOverlay]);

  // Track play counts & recently played when a track starts playing
  useEffect(() => {
    if (!isPlaying || !currentTrackId) return;
    if (lastRecordedPlayKeyRef.current === currentTrackId) return;
    lastRecordedPlayKeyRef.current = currentTrackId;

    setRecentIds((prev) =>
      [currentTrackId, ...prev.filter((id) => id !== currentTrackId)].slice(0, 20)
    );
    setPlayCounts((prev) => ({
      ...prev,
      [currentTrackId]: (prev[currentTrackId] ?? 0) + 1,
    }));
  }, [isPlaying, currentTrackId]);

  const trackMap = useMemo(
    () => new Map(tracks.map((t) => [t.id, t])),
    [tracks]
  );

  const currentTrack = useMemo(
    () => (currentTrackId ? trackMap.get(currentTrackId) ?? null : null),
    [currentTrackId, trackMap]
  );

  // Load lyrics whenever active track or imported/refreshed lyrics change
  useEffect(() => {
    let cancelled = false;
    if (!currentTrack) {
      setRawLyrics('');
      return;
    }
    void playbackBridge.getTrackLyrics(currentTrack).then((text) => {
      if (!cancelled) setRawLyrics(text);
    });
    return () => {
      cancelled = true;
    };
  }, [currentTrack, lyricsRefreshNonce]);

  // Refresh hardware AudioEffects when playback starts or EQ view opens
  useEffect(() => {
    if (activeView === 'eq' || isPlaying) {
      void refreshEffectsState();
    }
  }, [activeView, isPlaying, currentTrackId, refreshEffectsState]);

  const queueTracks = useMemo(
    () =>
      queueIds
        .map((id) => trackMap.get(id))
        .filter((t): t is Track => Boolean(t)),
    [queueIds, trackMap]
  );

  const filteredAndSortedTracks = useMemo(
    () => sortTracks(filterTracks(tracks, searchQuery), sortField, sortDirection),
    [tracks, searchQuery, sortField, sortDirection]
  );

  const albums = useMemo(() => groupTracksIntoAlbums(tracks), [tracks]);
  const artists = useMemo(() => groupTracksIntoArtists(tracks), [tracks]);
  const folders = useMemo(() => groupTracksIntoFolders(tracks), [tracks]);

  const filteredAlbums = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return albums;
    return albums.filter(
      (a) =>
        a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q)
    );
  }, [albums, searchQuery]);

  const filteredArtists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return artists;
    return artists.filter((a) => a.name.toLowerCase().includes(q));
  }, [artists, searchQuery]);

  const filteredFolders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter(
      (f) =>
        f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)
    );
  }, [folders, searchQuery]);

  const favoriteTracks = useMemo(() => {
    const favs = favoriteIds
      .map((id) => trackMap.get(id))
      .filter((t): t is Track => Boolean(t));
    return sortTracks(filterTracks(favs, searchQuery), sortField, sortDirection);
  }, [favoriteIds, trackMap, searchQuery, sortField, sortDirection]);

  const recentlyPlayedTracks = useMemo(
    () =>
      recentIds
        .map((id) => trackMap.get(id))
        .filter((t): t is Track => Boolean(t)),
    [recentIds, trackMap]
  );

  const mostPlayedTracks = useMemo(
    () =>
      Object.entries(playCounts)
        .map(([id, count]) => ({ track: trackMap.get(id), count }))
        .filter((entry): entry is { track: Track; count: number } =>
          Boolean(entry.track && entry.count > 0)
        )
        .sort((a, b) => b.count - a.count),
    [playCounts, trackMap]
  );

  // Handlers
  const handleUpdateSettings = (patch: Partial<AppSettings>) => {
    if (
      patch.loadEmbeddedArtwork === true &&
      !settings.loadEmbeddedArtwork &&
      rawTracks.some((t) => !t.artworkUrl)
    ) {
      void playbackBridge.refreshLibraryMetadata(true).then((refreshed) => {
        setRawTracks(deduplicateTracks(refreshed));
      });
    }
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (
        patch.defaultPlaybackSpeed !== undefined &&
        patch.defaultPlaybackSpeed !== prev.defaultPlaybackSpeed
      ) {
        void playbackBridge.setPlaybackSpeed(patch.defaultPlaybackSpeed);
      }
      return next;
    });
  };

  const handleRequestPermissions = async () => {
    const status = await playbackBridge.requestPermissions();
    setPermissionStatus(status);
    if (status === 'granted') {
      await performScan();
    }
  };

  const handleFilesSelected = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setIsScanning(true);
    setScanError(null);
    try {
      const res = await playbackBridge.importLocalFilesWeb(files, {
        loadEmbeddedArtwork: settings.loadEmbeddedArtwork,
      });
      setRawTracks(deduplicateTracks(res.tracks));
      setLyricsRefreshNonce((n) => n + 1);
      const importedCount = res.tracks.length;
      setStatusNotice(
        res.lyricsCount > 0
          ? `Library updated: ${importedCount} tracks and ${res.lyricsCount} LRC lyrics ready.`
          : `Library updated: ${importedCount} local audio tracks ready.`
      );
      await refreshStorageStats();
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : 'Failed to import audio files.'
      );
    } finally {
      setIsScanning(false);
      e.target.value = '';
    }
  };

  const handleAssociateLyricsFile = (track: Track) => {
    pendingLyricsTrackRef.current = track;
    lyricsPickerRef.current?.click();
  };

  const handleLyricsFilePicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const targetTrack = pendingLyricsTrackRef.current;
    e.target.value = '';
    if (!file || !targetTrack) return;

    try {
      const text = await file.text();
      if (!text.trim()) {
        setStatusNotice('Selected lyrics file is empty.');
        return;
      }
      await saveTrackCustomLyrics(targetTrack.id, text);
      setCustomLyricsTrackIds((prev) =>
        prev.includes(targetTrack.id) ? prev : [...prev, targetTrack.id]
      );
      if (targetTrack.id === currentTrackId) {
        setRawLyrics(text);
      }
      setStatusNotice(`Lyrics linked to "${targetTrack.title}".`);
      await refreshStorageStats();
    } catch {
      setStatusNotice('Failed to read selected lyrics file.');
    }
  };

  const handleClearTrackCustomLyrics = async (track: Track) => {
    await saveTrackCustomLyrics(track.id, '');
    setCustomLyricsTrackIds((prev) => prev.filter((id) => id !== track.id));
    if (track.id === currentTrackId) {
      const fallback = await playbackBridge.getTrackLyrics(track);
      setRawLyrics(fallback);
    }
    setStatusNotice(`Cleared custom lyrics for "${track.title}".`);
    await refreshStorageStats();
  };

  const handleSelectCustomCoverForTrack = (track: Track) => {
    pendingCoverTargetRef.current = {
      key: `custom-track-${track.id}`,
      label: track.title,
    };
    coverPickerRef.current?.click();
  };

  const handleSelectCustomCoverForAlbum = (album: AlbumGroup) => {
    pendingCoverTargetRef.current = {
      key: `custom-album-${album.id}`,
      label: album.title,
    };
    coverPickerRef.current?.click();
  };

  const handleCustomCoverPicked = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = pendingCoverTargetRef.current;
    e.target.value = '';
    if (!file || !target) return;

    try {
      const url = await saveCustomArtwork(target.key, file);
      setCustomArtworkUrls((prev) => ({ ...prev, [target.key]: url }));
      if (detailsTrack && target.key === `custom-track-${detailsTrack.id}`) {
        setDetailsTrack((prev) => (prev ? { ...prev, artworkUrl: url } : null));
      }
      setStatusNotice(`Custom artwork saved for "${target.label}".`);
      await refreshStorageStats();
    } catch {
      setStatusNotice('Unable to process selected image file.');
    }
  };

  const handleRefreshMetadata = async () => {
    setIsScanning(true);
    setScanError(null);
    try {
      const refreshed = await playbackBridge.refreshLibraryMetadata(
        settings.loadEmbeddedArtwork
      );
      setRawTracks(deduplicateTracks(refreshed));
      setLyricsRefreshNonce((n) => n + 1);
      setStatusNotice('Library metadata and embedded artwork refreshed.');
      await refreshStorageStats();
    } catch (err) {
      setScanError(
        err instanceof Error ? err.message : 'Failed to refresh metadata.'
      );
    } finally {
      setIsScanning(false);
    }
  };

  const handleClearArtworkCache = async () => {
    await playbackBridge.clearArtworkCache();
    if (playbackBridge.isNativeAndroid) {
      await performScan(true);
    } else {
      const rebuilt = await playbackBridge.refreshLibraryMetadata(
        settings.loadEmbeddedArtwork
      );
      setRawTracks(deduplicateTracks(rebuilt));
    }
    await refreshStorageStats();
    setStatusNotice('Artwork cache cleared and rebuilt.');
  };

  const handleClearAllCustomLyrics = async () => {
    await clearAllTrackCustomLyrics();
    setCustomLyricsTrackIds([]);
    if (currentTrack) {
      const text = await playbackBridge.getTrackLyrics(currentTrack);
      setRawLyrics(text);
    }
    await refreshStorageStats();
    setStatusNotice('All custom lyrics associations cleared.');
  };

  const handleClearWebLibrary = async () => {
    await playbackBridge.clearWebLibrary();
    setRawTracks([]);
    setQueueIds([]);
    setCurrentTrackId(null);
    setRawLyrics('');
    await refreshStorageStats();
    setStatusNotice('Browser library cleared.');
  };

  const handlePlayTrack = async (
    trackId: string,
    queueSourceIds?: string[],
    enableShuffle?: boolean
  ) => {
    const targetIds =
      queueSourceIds && queueSourceIds.length > 0
        ? queueSourceIds
        : queueIds.includes(trackId)
        ? queueIds
        : [trackId, ...queueIds];

    const resolvedTracks = targetIds
      .map((id) => trackMap.get(id))
      .filter((t): t is Track => Boolean(t));

    if (resolvedTracks.length === 0) return;

    const startIndex = Math.max(
      0,
      resolvedTracks.findIndex((t) => t.id === trackId)
    );

    setQueueIds(resolvedTracks.map((t) => t.id));
    lastRecordedPlayKeyRef.current = null;

    if (enableShuffle !== undefined) {
      await playbackBridge.setShuffle(enableShuffle);
    }
    await playbackBridge.setQueueAndPlay(resolvedTracks, startIndex, true);
  };

  const handleTogglePlayPause = async () => {
    if (!currentTrack) {
      if (queueTracks.length > 0) {
        await handlePlayTrack(queueTracks[0].id, queueIds);
      } else if (tracks.length > 0) {
        await handlePlayTrack(
          tracks[0].id,
          tracks.map((t) => t.id)
        );
      }
      return;
    }
    if (isPlaying) {
      await playbackBridge.pause();
    } else {
      await playbackBridge.play();
    }
  };

  const handleShuffleAll = async () => {
    if (tracks.length === 0) return;
    const idx = Math.floor(Math.random() * tracks.length);
    await handlePlayTrack(
      tracks[idx].id,
      tracks.map((t) => t.id),
      true
    );
  };

  const handleCycleRepeat = async () => {
    const next: RepeatMode =
      repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
    await playbackBridge.setRepeatMode(next);
  };

  const handlePlayNextInQueue = async (trackId: string) => {
    const nextIds = playNextInQueue(queueIds, currentTrackId, trackId);
    setQueueIds(nextIds);
    const resolved = nextIds
      .map((id) => trackMap.get(id))
      .filter((t): t is Track => Boolean(t));
    const currentIdx = Math.max(
      0,
      resolved.findIndex((t) => t.id === currentTrackId)
    );
    await playbackBridge.updateQueue(resolved, currentIdx);
    setStatusNotice('Queued to play next.');
  };

  const handleAddToQueue = async (trackId: string) => {
    const nextIds = enqueueTrackUnique(queueIds, trackId);
    setQueueIds(nextIds);
    const resolved = nextIds
      .map((id) => trackMap.get(id))
      .filter((t): t is Track => Boolean(t));
    const currentIdx = Math.max(
      0,
      resolved.findIndex((t) => t.id === currentTrackId)
    );
    await playbackBridge.updateQueue(resolved, currentIdx);
    setStatusNotice('Added to playback queue.');
  };

  const handleAddMultipleToQueue = async (ids: string[]) => {
    let nextIds = [...queueIds];
    for (const id of ids) {
      nextIds = enqueueTrackUnique(nextIds, id);
    }
    setQueueIds(nextIds);
    const resolved = nextIds
      .map((id) => trackMap.get(id))
      .filter((t): t is Track => Boolean(t));
    const currentIdx = Math.max(
      0,
      resolved.findIndex((t) => t.id === currentTrackId)
    );
    await playbackBridge.updateQueue(resolved, currentIdx);
    setStatusNotice(`Added ${ids.length} tracks to queue.`);
  };

  const handleMoveQueueItem = async (fromIndex: number, toIndex: number) => {
    const nextIds = moveQueueItem(queueIds, fromIndex, toIndex);
    setQueueIds(nextIds);
    const resolved = nextIds
      .map((id) => trackMap.get(id))
      .filter((t): t is Track => Boolean(t));
    const currentIdx = Math.max(
      0,
      resolved.findIndex((t) => t.id === currentTrackId)
    );
    await playbackBridge.updateQueue(resolved, currentIdx);
  };

  const handleRemoveQueueItem = async (trackId: string) => {
    const nextIds = queueIds.filter((id) => id !== trackId);
    setQueueIds(nextIds);
    const resolved = nextIds
      .map((id) => trackMap.get(id))
      .filter((t): t is Track => Boolean(t));
    const currentIdx = Math.max(
      0,
      resolved.findIndex((t) => t.id === currentTrackId)
    );
    await playbackBridge.updateQueue(resolved, currentIdx);
  };

  const handleClearQueue = async () => {
    setQueueIds([]);
    await playbackBridge.pause();
    await playbackBridge.updateQueue([], 0);
    setStatusNotice('Queue cleared.');
  };

  const handleToggleFavorite = (trackId: string) => {
    setFavoriteIds((prev) =>
      prev.includes(trackId)
        ? prev.filter((id) => id !== trackId)
        : [trackId, ...prev]
    );
  };

  const handleCreatePlaylist = (name: string, description: string) => {
    const now = new Date().toISOString();
    const pl: Playlist = {
      id: `pl-${Date.now()}`,
      name,
      description,
      trackIds: [],
      createdAt: now,
      updatedAt: now,
    };
    setPlaylists((prev) => [pl, ...prev]);
    setSelectedPlaylistId(pl.id);
    setActiveView('playlists');
  };

  const handleRenamePlaylist = (playlistId: string, newName: string) => {
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === playlistId
          ? { ...pl, name: newName, updatedAt: new Date().toISOString() }
          : pl
      )
    );
  };

  const handleDeletePlaylist = (playlistId: string) => {
    setPlaylists((prev) => {
      const next = prev.filter((p) => p.id !== playlistId);
      if (selectedPlaylistId === playlistId) {
        setSelectedPlaylistId(next[0]?.id ?? null);
      }
      return next;
    });
  };

  const handleAddTrackToPlaylist = (playlistId: string, trackId: string) => {
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === playlistId && !pl.trackIds.includes(trackId)
          ? {
              ...pl,
              trackIds: [...pl.trackIds, trackId],
              updatedAt: new Date().toISOString(),
            }
          : pl
      )
    );
    setStatusNotice('Added track to playlist.');
  };

  const handleAddMultipleToPlaylist = (playlistId: string, ids: string[]) => {
    setPlaylists((prev) =>
      prev.map((pl) => {
        if (pl.id !== playlistId) return pl;
        const merged = [...pl.trackIds];
        for (const id of ids) {
          if (!merged.includes(id)) merged.push(id);
        }
        return { ...pl, trackIds: merged, updatedAt: new Date().toISOString() };
      })
    );
    setStatusNotice(`Added ${ids.length} tracks to playlist.`);
  };

  const handleRemoveTrackFromPlaylist = (
    playlistId: string,
    trackId: string
  ) => {
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === playlistId
          ? {
              ...pl,
              trackIds: pl.trackIds.filter((id) => id !== trackId),
              updatedAt: new Date().toISOString(),
            }
          : pl
      )
    );
  };

  const handleMovePlaylistTrack = (
    playlistId: string,
    fromIndex: number,
    toIndex: number
  ) => {
    setPlaylists((prev) =>
      prev.map((pl) =>
        pl.id === playlistId
          ? {
              ...pl,
              trackIds: moveQueueItem(pl.trackIds, fromIndex, toIndex),
              updatedAt: new Date().toISOString(),
            }
          : pl
      )
    );
  };

  const handleChangeSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection(field === 'dateAdded' ? 'desc' : 'asc');
    }
  };

  const handleShareTrack = async (track: Track) => {
    try {
      await playbackBridge.shareTrack(track);
    } catch (err) {
      setStatusNotice(
        err instanceof Error ? err.message : 'Unable to share this track.'
      );
    }
  };

  const handleToggleEqEnabled = async (enabled: boolean) => {
    await playbackBridge.setEqEnabled(enabled);
    setEffects((prev) => ({ ...prev, enabled }));
  };

  const handleChangeEqBand = async (bandIndex: number, levelMb: number) => {
    await playbackBridge.setEqBandLevel(bandIndex, levelMb);
    setEffects((prev) => ({
      ...prev,
      bands: prev.bands.map((b) =>
        b.index === bandIndex ? { ...b, levelMb } : b
      ),
    }));
  };

  const handleApplyEqPreset = async (bandGainsDb: number[]) => {
    const updatedBands = effects.bands.map((band, i) => {
      const targetDb = clampEqGainDb(bandGainsDb[i] ?? 0);
      const levelMb = Math.max(
        effects.minLevelMb,
        Math.min(effects.maxLevelMb, Math.round(targetDb * 100))
      );
      return { ...band, levelMb };
    });
    for (const band of updatedBands) {
      await playbackBridge.setEqBandLevel(band.index, band.levelMb);
    }
    setEffects((prev) => ({ ...prev, bands: updatedBands }));
  };

  const handleChangeBassBoost = async (strength: number) => {
    await playbackBridge.setBassBoost(strength);
    setEffects((prev) => ({ ...prev, bassBoostStrength: strength }));
  };

  const handleChangeVirtualizer = async (strength: number) => {
    await playbackBridge.setVirtualizer(strength);
    setEffects((prev) => ({ ...prev, virtualizerStrength: strength }));
  };

  const selectedAlbum = useMemo(
    () => albums.find((a) => a.id === selectedAlbumId) ?? null,
    [albums, selectedAlbumId]
  );

  const selectedAlbumTracks = useMemo(
    () =>
      selectedAlbum
        ? tracks.filter((t) => t.albumId === selectedAlbum.id)
        : [],
    [tracks, selectedAlbum]
  );

  const selectedArtistAlbums = useMemo(
    () =>
      selectedArtistName
        ? albums.filter((a) =>
            tracks.some(
              (t) => t.artist === selectedArtistName && t.albumId === a.id
            )
          )
        : [],
    [albums, tracks, selectedArtistName]
  );

  const selectedArtistTracks = useMemo(
    () =>
      selectedArtistName
        ? tracks.filter((t) => t.artist === selectedArtistName)
        : [],
    [tracks, selectedArtistName]
  );

  const resolvedDetailsTrack = detailsTrack
    ? trackMap.get(detailsTrack.id) ?? detailsTrack
    : null;

  return (
    <div className="h-screen w-full flex flex-col bg-stone-50 text-zinc-900 dark:bg-[#0B0B0D] dark:text-[#F4F4F6] overflow-hidden">
      {/* Hidden File Pickers */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*,.mp3,.flac,.wav,.m4a,.aac,.ogg,.opus,.lrc"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
      />
      <input
        ref={folderInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFilesSelected}
        {...({ webkitdirectory: '', directory: '' } as Record<string, string>)}
      />
      <input
        ref={lyricsPickerRef}
        type="file"
        accept={playbackBridge.isNativeAndroid ? '*/*' : '.lrc,.txt,text/plain'}
        className="hidden"
        onChange={handleLyricsFilePicked}
      />
      <input
        ref={coverPickerRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleCustomCoverPicked}
      />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        <Sidebar
          activeView={activeView}
          selectedPlaylistId={selectedPlaylistId}
          playlists={playlists}
          trackCount={tracks.length}
          favoriteCount={favoriteIds.length}
          theme={theme}
          onToggleTheme={() =>
            handleUpdateSettings({
              themePreference: theme === 'dark' ? 'light' : 'dark',
            })
          }
          onSelectView={(v) => {
            setSelectedPlaylistId(null);
            setActiveView(v);
          }}
          onSelectPlaylist={(plId) => {
            setSelectedPlaylistId(plId);
            setActiveView('playlists');
          }}
          onOpenCreatePlaylist={() => {
            setSelectedPlaylistId(null);
            setActiveView('playlists');
          }}
        />

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TopBar
            searchQuery={searchQuery}
            queueCount={queueTracks.length}
            isQueueOpen={isQueueOpen}
            isScanning={isScanning}
            isNativeAndroid={playbackBridge.isNativeAndroid}
            theme={theme}
            onSearchChange={(q) => {
              setSearchQuery(q);
              if (
                q.trim() &&
                ['home', 'album-detail', 'artist-detail', 'eq', 'settings'].includes(
                  activeView
                )
              ) {
                setActiveView('tracks');
              }
            }}
            onToggleQueue={() => setIsQueueOpen((o) => !o)}
            onRescan={() => void performScan(true)}
            onImportFiles={() => fileInputRef.current?.click()}
            onToggleTheme={() =>
              handleUpdateSettings({
                themePreference: theme === 'dark' ? 'light' : 'dark',
              })
            }
            onNavigateHome={() => setActiveView('home')}
          />

          {statusNotice && (
            <div
              role="status"
              aria-live="polite"
              className="mx-4 sm:mx-8 mt-3 px-4 py-2.5 rounded-lg bg-zinc-900 dark:bg-[#1D1D23] text-white text-xs flex items-center justify-between gap-3 shrink-0"
            >
              <span>{statusNotice}</span>
              <button
                type="button"
                onClick={() => setStatusNotice(null)}
                className="text-zinc-400 hover:text-white font-medium"
              >
                Dismiss
              </button>
            </div>
          )}

          <main className="flex-1 overflow-y-auto pb-32 lg:pb-8">
            {activeView === 'home' && (
              <HomeDashboardView
                tracks={tracks}
                albums={albums}
                artists={artists}
                folders={folders}
                recentlyPlayed={recentlyPlayedTracks}
                mostPlayed={mostPlayedTracks}
                currentTrackId={currentTrackId}
                isPlaying={isPlaying}
                isScanning={isScanning}
                scanError={scanError}
                permissionStatus={permissionStatus}
                isNativeAndroid={playbackBridge.isNativeAndroid}
                onRequestPermissions={() => void handleRequestPermissions()}
                onOpenSettings={() => void playbackBridge.openSettings()}
                onRescan={() => void performScan(true)}
                onImportFiles={() => fileInputRef.current?.click()}
                onImportFolder={() => folderInputRef.current?.click()}
                onPlayTrack={(id, qIds) => void handlePlayTrack(id, qIds)}
                onTogglePlayPause={() => void handleTogglePlayPause()}
                onShuffleAll={() => void handleShuffleAll()}
                onOpenAlbum={(albumId) => {
                  setSelectedAlbumId(albumId);
                  setActiveView('album-detail');
                }}
                onNavigateView={setActiveView}
              />
            )}

            {activeView === 'tracks' && (
              <TrackListView
                title="Tracks"
                tracks={filteredAndSortedTracks}
                currentTrackId={currentTrackId}
                isPlaying={isPlaying}
                favoriteIds={favoriteIds}
                playlists={playlists}
                sortField={sortField}
                sortDirection={sortDirection}
                onChangeSort={handleChangeSort}
                onPlayTrack={(id, qIds) => void handlePlayTrack(id, qIds)}
                onTogglePlayPause={() => void handleTogglePlayPause()}
                onToggleFavorite={handleToggleFavorite}
                onPlayNext={(id) => void handlePlayNextInQueue(id)}
                onAddToQueue={(id) => void handleAddToQueue(id)}
                onAddMultipleToQueue={(ids) => void handleAddMultipleToQueue(ids)}
                onAddTrackToPlaylist={handleAddTrackToPlaylist}
                onAddMultipleToPlaylist={handleAddMultipleToPlaylist}
                onOpenAlbum={(albumId) => {
                  setSelectedAlbumId(albumId);
                  setActiveView('album-detail');
                }}
                onOpenArtist={(artistName) => {
                  setSelectedArtistName(artistName);
                  setActiveView('artist-detail');
                }}
                onShowTrackDetails={setDetailsTrack}
                onShareTrack={(t) => void handleShareTrack(t)}
                onSelectCustomCover={handleSelectCustomCoverForTrack}
                onAssociateLyricsFile={handleAssociateLyricsFile}
                emptyMessage={
                  tracks.length === 0
                    ? 'Your local library is empty. Import audio files or scan your device storage.'
                    : 'No tracks match your search query.'
                }
              />
            )}

            {activeView === 'albums' && (
              <AlbumsGridView
                albums={filteredAlbums}
                onOpenAlbum={(albumId) => {
                  setSelectedAlbumId(albumId);
                  setActiveView('album-detail');
                }}
                onPlayAlbum={(albumId) => {
                  const album = albums.find((a) => a.id === albumId);
                  if (album && album.trackIds.length > 0) {
                    void handlePlayTrack(album.trackIds[0], album.trackIds);
                  }
                }}
              />
            )}

            {activeView === 'album-detail' && selectedAlbum && (
              <AlbumDetailView
                album={selectedAlbum}
                tracks={selectedAlbumTracks}
                currentTrackId={currentTrackId}
                isPlaying={isPlaying}
                favoriteIds={favoriteIds}
                onBack={() => setActiveView('albums')}
                onPlayTracks={(startId, qIds, shuf) =>
                  void handlePlayTrack(startId, qIds, shuf)
                }
                onTogglePlayPause={() => void handleTogglePlayPause()}
                onToggleFavorite={handleToggleFavorite}
                onAddToQueue={(id) => void handleAddToQueue(id)}
                onOpenArtist={(artistName) => {
                  setSelectedArtistName(artistName);
                  setActiveView('artist-detail');
                }}
                onSelectCustomAlbumCover={handleSelectCustomCoverForAlbum}
              />
            )}

            {activeView === 'artists' && (
              <ArtistsGridView
                artists={filteredArtists}
                onOpenArtist={(name) => {
                  setSelectedArtistName(name);
                  setActiveView('artist-detail');
                }}
              />
            )}

            {activeView === 'artist-detail' && selectedArtistName && (
              <ArtistDetailView
                artistName={selectedArtistName}
                albums={selectedArtistAlbums}
                tracks={selectedArtistTracks}
                currentTrackId={currentTrackId}
                isPlaying={isPlaying}
                onBack={() => setActiveView('artists')}
                onOpenAlbum={(albumId) => {
                  setSelectedAlbumId(albumId);
                  setActiveView('album-detail');
                }}
                onPlayTrack={(id, qIds) => void handlePlayTrack(id, qIds)}
                onTogglePlayPause={() => void handleTogglePlayPause()}
              />
            )}

            {activeView === 'folders' && (
              <FoldersView
                folders={filteredFolders}
                tracks={tracks}
                currentTrackId={currentTrackId}
                isPlaying={isPlaying}
                onPlayTrack={(id, qIds) => void handlePlayTrack(id, qIds)}
                onTogglePlayPause={() => void handleTogglePlayPause()}
              />
            )}

            {activeView === 'playlists' && (
              <PlaylistsView
                playlists={playlists}
                selectedPlaylistId={selectedPlaylistId}
                allTracks={tracks}
                currentTrackId={currentTrackId}
                isPlaying={isPlaying}
                onSelectPlaylist={setSelectedPlaylistId}
                onCreatePlaylist={handleCreatePlaylist}
                onRenamePlaylist={handleRenamePlaylist}
                onDeletePlaylist={handleDeletePlaylist}
                onAddTrackToPlaylist={handleAddTrackToPlaylist}
                onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
                onMovePlaylistTrack={handleMovePlaylistTrack}
                onPlayPlaylist={(ids, shuf) => {
                  if (ids.length > 0) {
                    void handlePlayTrack(ids[0], ids, shuf);
                  }
                }}
                onPlayTrack={(id, qIds) => void handlePlayTrack(id, qIds)}
              />
            )}

            {activeView === 'favorites' && (
              <TrackListView
                title="Favorites"
                subtitle="Offline saved tracks"
                tracks={favoriteTracks}
                currentTrackId={currentTrackId}
                isPlaying={isPlaying}
                favoriteIds={favoriteIds}
                playlists={playlists}
                sortField={sortField}
                sortDirection={sortDirection}
                onChangeSort={handleChangeSort}
                onPlayTrack={(id, qIds) => void handlePlayTrack(id, qIds)}
                onTogglePlayPause={() => void handleTogglePlayPause()}
                onToggleFavorite={handleToggleFavorite}
                onPlayNext={(id) => void handlePlayNextInQueue(id)}
                onAddToQueue={(id) => void handleAddToQueue(id)}
                onAddMultipleToQueue={(ids) => void handleAddMultipleToQueue(ids)}
                onAddTrackToPlaylist={handleAddTrackToPlaylist}
                onAddMultipleToPlaylist={handleAddMultipleToPlaylist}
                onOpenAlbum={(albumId) => {
                  setSelectedAlbumId(albumId);
                  setActiveView('album-detail');
                }}
                onOpenArtist={(artistName) => {
                  setSelectedArtistName(artistName);
                  setActiveView('artist-detail');
                }}
                onShowTrackDetails={setDetailsTrack}
                onShareTrack={(t) => void handleShareTrack(t)}
                onSelectCustomCover={handleSelectCustomCoverForTrack}
                onAssociateLyricsFile={handleAssociateLyricsFile}
                emptyMessage="No favorite tracks yet. Tap the heart icon on any track to save it here."
              />
            )}

            {activeView === 'eq' && (
              <StudioEqView
                effects={effects}
                isPlaying={isPlaying}
                currentTrack={currentTrack}
                onToggleEnabled={(en) => void handleToggleEqEnabled(en)}
                onChangeBand={(idx, mb) => void handleChangeEqBand(idx, mb)}
                onApplyPreset={(gains) => void handleApplyEqPreset(gains)}
                onChangeBassBoost={(s) => void handleChangeBassBoost(s)}
                onChangeVirtualizer={(s) => void handleChangeVirtualizer(s)}
              />
            )}

            {activeView === 'settings' && (
              <SettingsView
                settings={settings}
                sortField={sortField}
                sortDirection={sortDirection}
                effects={effects}
                detectedFolders={allDetectedFolders}
                isNativeAndroid={playbackBridge.isNativeAndroid}
                isScanning={isScanning}
                storageStats={storageStats}
                onUpdateSettings={handleUpdateSettings}
                onChangeDefaultSort={(field, dir) => {
                  setSortField(field);
                  setSortDirection(dir);
                }}
                onRescanLibrary={() => void performScan(true)}
                onRefreshMetadata={() => void handleRefreshMetadata()}
                onClearArtworkCache={() => void handleClearArtworkCache()}
                onClearCustomLyrics={() => void handleClearAllCustomLyrics()}
                onClearWebLibrary={() => void handleClearWebLibrary()}
                onOpenEffects={() => setActiveView('eq')}
              />
            )}
          </main>
        </div>

        <QueuePanel
          queueTracks={queueTracks}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
          isOpenMobile={isQueueOpen}
          onCloseMobile={() => setIsQueueOpen(false)}
          onPlayTrack={(id) => void handlePlayTrack(id)}
          onTogglePlayPause={() => void handleTogglePlayPause()}
          onMoveItem={(from, to) => void handleMoveQueueItem(from, to)}
          onRemoveItem={(id) => void handleRemoveQueueItem(id)}
          onClearQueue={() => void handleClearQueue()}
        />
      </div>

      <PlayerBar
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        positionSec={positionSec}
        durationSec={durationSec}
        volume={volume}
        muted={muted}
        shuffle={shuffle}
        repeatMode={repeatMode}
        isFavorite={currentTrack ? favoriteIds.includes(currentTrack.id) : false}
        isQueueOpen={isQueueOpen}
        activeView={activeView}
        isNativeAndroid={playbackBridge.isNativeAndroid}
        onOpenNowPlaying={() => setNowPlayingOpen(true)}
        onTogglePlayPause={() => void handleTogglePlayPause()}
        onPrev={() => void playbackBridge.skipToPrevious()}
        onNext={() => void playbackBridge.skipToNext()}
        onSeek={(sec) => void playbackBridge.seekTo(sec)}
        onVolumeChange={(v) => {
          setVolume(v);
          if (muted && v > 0) setMuted(false);
        }}
        onToggleMute={() => setMuted((m) => !m)}
        onToggleShuffle={() => void playbackBridge.setShuffle(!shuffle)}
        onCycleRepeat={() => void handleCycleRepeat()}
        onToggleFavorite={() => {
          if (currentTrack) handleToggleFavorite(currentTrack.id);
        }}
        onToggleQueue={() => setIsQueueOpen((o) => !o)}
        onSelectView={(v) => {
          setSelectedPlaylistId(null);
          setActiveView(v);
        }}
      />

      <NowPlayingModal
        isOpen={nowPlayingOpen}
        track={currentTrack}
        rawLyrics={rawLyrics}
        hasCustomLyrics={
          currentTrack ? customLyricsTrackIds.includes(currentTrack.id) : false
        }
        syncedLyricsEnabled={settings.syncedLyricsEnabled}
        lyricsAutoScroll={settings.lyricsAutoScroll}
        lyricsTextSize={settings.lyricsTextSize}
        isPlaying={isPlaying}
        positionSec={positionSec}
        durationSec={durationSec}
        shuffle={shuffle}
        repeatMode={repeatMode}
        playbackSpeed={playbackSpeed}
        sleepTimerEndAtMs={sleepTimerEndAtMs}
        isFavorite={currentTrack ? favoriteIds.includes(currentTrack.id) : false}
        queueTracks={queueTracks}
        onClose={() => setNowPlayingOpen(false)}
        onTogglePlayPause={() => void handleTogglePlayPause()}
        onPrev={() => void playbackBridge.skipToPrevious()}
        onNext={() => void playbackBridge.skipToNext()}
        onSeek={(sec) => void playbackBridge.seekTo(sec)}
        onToggleShuffle={() => void playbackBridge.setShuffle(!shuffle)}
        onCycleRepeat={() => void handleCycleRepeat()}
        onToggleFavorite={() => {
          if (currentTrack) handleToggleFavorite(currentTrack.id);
        }}
        onChangeSpeed={(sp) => void playbackBridge.setPlaybackSpeed(sp)}
        onSetSleepTimer={(mins) => {
          void playbackBridge.setSleepTimer(mins).then((endAt) => {
            setSleepTimerEndAtMs(endAt);
          });
        }}
        onPlayQueueTrack={(id) => void handlePlayTrack(id)}
        onOpenEq={() => setActiveView('eq')}
        onShowDetails={setDetailsTrack}
        onShareTrack={(t) => void handleShareTrack(t)}
        onAssociateLyricsFile={handleAssociateLyricsFile}
        onClearCustomLyrics={(t) => void handleClearTrackCustomLyrics(t)}
        onSelectCustomCover={handleSelectCustomCoverForTrack}
      />

      <TrackDetailsModal
        track={resolvedDetailsTrack}
        playCount={
          resolvedDetailsTrack ? playCounts[resolvedDetailsTrack.id] ?? 0 : 0
        }
        onClose={() => setDetailsTrack(null)}
        onShare={(t) => void handleShareTrack(t)}
        onSelectCustomCover={handleSelectCustomCoverForTrack}
        onAssociateLyricsFile={handleAssociateLyricsFile}
      />
    </div>
  );
}
