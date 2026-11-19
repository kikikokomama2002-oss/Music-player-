import { Capacitor, registerPlugin } from '@capacitor/core';
import type { PluginListenerHandle } from '@capacitor/core';
import type {
  AudioEffectsState,
  AudioFocusMode,
  PermissionStatus,
  PlaybackSnapshot,
  RepeatMode,
  Track,
} from '../types/music';
import { getNextTrackId, getPreviousTrackId } from '../utils/musicLogic';
import {
  clearStoredWebTracks,
  clearWebArtworkCache,
  importWebAudioFiles,
  loadStoredWebTracks,
  loadTrackCustomLyrics,
  lookupWebLyrics,
  refreshWebLibraryMetadata,
} from '../utils/webFileStore';

interface NativePermissionResponse {
  media: string;
  notifications: string;
  granted: boolean;
}

interface NativeScanResponse {
  tracks: Array<{
    id: string;
    mediaStoreId: number;
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
  }>;
  scannedAt: number;
}

interface CadenceAudioNativePlugin {
  getAudioPermissionStatus(): Promise<NativePermissionResponse>;
  requestAudioPermissions(): Promise<NativePermissionResponse>;
  openAppSettings(): Promise<void>;
  scanLibrary(opts?: { forceRefresh?: boolean }): Promise<NativeScanResponse>;
  getTrackLyrics(opts: {
    filePath: string;
    uri?: string;
    title?: string;
    artist?: string;
  }): Promise<{ lyrics: string; source: string }>;
  clearArtworkCache(): Promise<{ clearedBytes: number }>;
  setBackInterceptorActive(opts: { active: boolean }): Promise<void>;
  setPlaybackPreferences(opts: {
    pauseOnNoisy: boolean;
    audioFocusMode: AudioFocusMode;
  }): Promise<void>;
  setQueueAndPlay(opts: {
    tracks: Array<{
      id: string;
      uri: string;
      title: string;
      artist: string;
      album: string;
      artworkPath: string;
    }>;
    startIndex: number;
    startPositionMs: number;
    autoPlay: boolean;
  }): Promise<void>;
  updateQueue(opts: {
    tracks: Array<{
      id: string;
      uri: string;
      title: string;
      artist: string;
      album: string;
      artworkPath: string;
    }>;
    currentIndex: number;
  }): Promise<void>;
  play(): Promise<void>;
  pause(): Promise<void>;
  seekTo(opts: { positionMs: number }): Promise<void>;
  skipToNext(): Promise<void>;
  skipToPrevious(): Promise<void>;
  setShuffleMode(opts: { enabled: boolean }): Promise<void>;
  setRepeatMode(opts: { mode: RepeatMode }): Promise<void>;
  setPlaybackSpeed(opts: { speed: number }): Promise<void>;
  getPlaybackState(): Promise<{
    isPlaying: boolean;
    currentTrackId: string;
    positionMs: number;
    durationMs: number;
    shuffle: boolean;
    repeatMode: RepeatMode;
    playbackSpeed: number;
    sleepTimerEndAtMs?: number;
  }>;
  getAudioEffectsState(): Promise<AudioEffectsState>;
  setEqEnabled(opts: { enabled: boolean }): Promise<void>;
  setEqBandLevel(opts: { bandIndex: number; levelMb: number }): Promise<void>;
  setBassBoost(opts: { strength: number }): Promise<void>;
  setVirtualizer(opts: { strength: number }): Promise<void>;
  setSleepTimer(opts: { minutes: number }): Promise<{ endAtMs: number }>;
  shareTrack(opts: { filePath: string; uri: string; title: string }): Promise<void>;
  addListener(
    eventName: 'playbackStateChanged',
    listenerFunc: (state: {
      isPlaying: boolean;
      currentTrackId: string;
      positionMs: number;
      durationMs: number;
      shuffle: boolean;
      repeatMode: RepeatMode;
      playbackSpeed: number;
      sleepTimerEndAtMs?: number;
    }) => void
  ): Promise<PluginListenerHandle>;
  addListener(
    eventName: 'playbackError',
    listenerFunc: (err: { message: string }) => void
  ): Promise<PluginListenerHandle>;
}

const CadenceAudio = registerPlugin<CadenceAudioNativePlugin>('CadenceAudio');

const WEB_EQ_FREQS = [60, 230, 910, 3600, 14000];

class PlaybackBridge {
  public readonly isNativeAndroid =
    Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';

  private stateListeners = new Set<(snapshot: PlaybackSnapshot) => void>();
  private errorListeners = new Set<(message: string) => void>();
  private nativeListenersBound = false;

  // Web HTMLAudio + Web Audio EQ Graph (only used in browser mode)
  private webAudioEl: HTMLAudioElement | null = null;
  private webAudioCtx: AudioContext | null = null;
  private webSourceNode: MediaElementAudioSourceNode | null = null;
  private webEqNodes: BiquadFilterNode[] = [];
  private webBassNode: BiquadFilterNode | null = null;
  private webGainNode: GainNode | null = null;
  private webAnalyser: AnalyserNode | null = null;

  private webTracks: Track[] = [];
  private webQueueIds: string[] = [];
  private webCurrentTrackId: string | null = null;
  private webShuffle = false;
  private webRepeat: RepeatMode = 'all';
  private webSpeed = 1.0;
  private webTargetVolume = 0.8;
  private webMuted = false;
  private webCrossfadeSec = 0;
  private webCrossfadingOut = false;
  private webEqEnabled = true;
  private webBandLevelsMb = [0, 0, 0, 0, 0];
  private webBassBoostStrength = 0;
  private webSleepTimerId: number | null = null;
  private webSleepEndAtMs = 0;

  public async init(
    onState: (snapshot: PlaybackSnapshot) => void,
    onError: (msg: string) => void
  ): Promise<() => void> {
    this.stateListeners.add(onState);
    this.errorListeners.add(onError);

    if (this.isNativeAndroid) {
      if (!this.nativeListenersBound) {
        this.nativeListenersBound = true;
        await CadenceAudio.addListener('playbackStateChanged', (raw) => {
          const snap: PlaybackSnapshot = {
            isPlaying: Boolean(raw.isPlaying),
            currentTrackId: raw.currentTrackId || null,
            positionSec: Math.round((raw.positionMs || 0) / 100) / 10,
            durationSec: Math.floor((raw.durationMs || 0) / 1000),
            shuffle: Boolean(raw.shuffle),
            repeatMode: raw.repeatMode || 'off',
            playbackSpeed: raw.playbackSpeed || 1.0,
            sleepTimerEndAtMs: raw.sleepTimerEndAtMs || 0,
          };
          this.stateListeners.forEach((cb) => cb(snap));
        });
        await CadenceAudio.addListener('playbackError', (err) => {
          this.errorListeners.forEach((cb) =>
            cb(err.message || 'Unable to play audio file.')
          );
        });
      }
      try {
        const raw = await CadenceAudio.getPlaybackState();
        onState({
          isPlaying: Boolean(raw.isPlaying),
          currentTrackId: raw.currentTrackId || null,
          positionSec: Math.round((raw.positionMs || 0) / 100) / 10,
          durationSec: Math.floor((raw.durationMs || 0) / 1000),
          shuffle: Boolean(raw.shuffle),
          repeatMode: raw.repeatMode || 'off',
          playbackSpeed: raw.playbackSpeed || 1.0,
          sleepTimerEndAtMs: raw.sleepTimerEndAtMs || 0,
        });
      } catch {
        // Ignore initial state query error if service hasn't started yet
      }
    } else {
      this.ensureWebAudioElement();
    }

    return () => {
      this.stateListeners.delete(onState);
      this.errorListeners.delete(onError);
    };
  }

  public async checkPermissionStatus(): Promise<PermissionStatus> {
    if (!this.isNativeAndroid) return 'granted';
    try {
      const res = await CadenceAudio.getAudioPermissionStatus();
      if (res.granted) return 'granted';
      const normalized = res.media.toLowerCase();
      if (normalized.includes('denied')) return 'denied';
      return 'prompt';
    } catch {
      return 'unknown';
    }
  }

  public async requestPermissions(): Promise<PermissionStatus> {
    if (!this.isNativeAndroid) return 'granted';
    try {
      const res = await CadenceAudio.requestAudioPermissions();
      if (res.granted) return 'granted';
      const normalized = res.media.toLowerCase();
      if (normalized.includes('denied')) return 'denied';
      return 'prompt';
    } catch {
      return 'denied';
    }
  }

  public async openSettings(): Promise<void> {
    if (this.isNativeAndroid) {
      await CadenceAudio.openAppSettings();
    }
  }

  public async scanLibrary(forceRefresh = false): Promise<Track[]> {
    if (this.isNativeAndroid) {
      const res = await CadenceAudio.scanLibrary({ forceRefresh });
      return (res.tracks ?? []).map((t) => ({
        ...t,
        artworkUrl: t.artworkPath
          ? Capacitor.convertFileSrc(t.artworkPath)
          : '',
        source: 'android' as const,
      }));
    }

    const stored = await loadStoredWebTracks();
    this.webTracks = stored;
    return stored;
  }

  public async refreshLibraryMetadata(
    loadEmbeddedArtwork = true
  ): Promise<Track[]> {
    if (this.isNativeAndroid) {
      return this.scanLibrary(true);
    }
    const refreshed = await refreshWebLibraryMetadata(loadEmbeddedArtwork);
    this.webTracks = refreshed;
    return refreshed;
  }

  public async importLocalFilesWeb(
    files: FileList | File[],
    options: { loadEmbeddedArtwork?: boolean } = {}
  ): Promise<{ tracks: Track[]; lyricsCount: number }> {
    const res = await importWebAudioFiles(files, options);
    const allStored = await loadStoredWebTracks();
    this.webTracks = allStored;
    return { tracks: allStored, lyricsCount: res.importedLyricsCount };
  }

  public async clearWebLibrary(): Promise<void> {
    await clearStoredWebTracks();
    this.webTracks = [];
    this.webQueueIds = [];
    this.webCurrentTrackId = null;
    if (this.webAudioEl) {
      this.webAudioEl.pause();
      this.webAudioEl.src = '';
    }
    this.emitWebState();
  }

  public async clearArtworkCache(): Promise<{ clearedBytes: number }> {
    if (this.isNativeAndroid) {
      try {
        return await CadenceAudio.clearArtworkCache();
      } catch {
        return { clearedBytes: 0 };
      }
    }
    return clearWebArtworkCache();
  }

  public async setPlaybackSettings(opts: {
    pauseOnHeadphoneDisconnect: boolean;
    audioFocusMode: AudioFocusMode;
    crossfadeSec: number;
  }): Promise<void> {
    this.webCrossfadeSec = Math.max(0, Math.min(8, opts.crossfadeSec));
    if (this.isNativeAndroid) {
      try {
        await CadenceAudio.setPlaybackPreferences({
          pauseOnNoisy: opts.pauseOnHeadphoneDisconnect,
          audioFocusMode: opts.audioFocusMode,
        });
      } catch {
        // Ignore if service unavailable
      }
    }
  }

  public async setBackInterceptor(active: boolean): Promise<void> {
    if (!this.isNativeAndroid) return;
    try {
      await CadenceAudio.setBackInterceptorActive({ active });
    } catch {
      // Ignore
    }
  }

  public async getTrackLyrics(track: Track): Promise<string> {
    const custom = await loadTrackCustomLyrics(track.id);
    if (custom.trim()) return custom;

    if (this.isNativeAndroid) {
      try {
        const res = await CadenceAudio.getTrackLyrics({
          filePath: track.filePath,
          uri: track.uri,
          title: track.title,
          artist: track.artist,
        });
        if (res.lyrics && res.lyrics.trim()) return res.lyrics;
      } catch {
        // Fall through
      }
      return track.embeddedLyrics || '';
    }
    return lookupWebLyrics(track);
  }

  public async restorePlaybackState(
    queueTracks: Track[],
    trackId: string,
    positionSec: number,
    prefs: { shuffle: boolean; repeatMode: RepeatMode; speed: number }
  ): Promise<void> {
    if (queueTracks.length === 0) return;
    const startIndex = queueTracks.findIndex((t) => t.id === trackId);
    if (startIndex === -1) return;

    if (this.isNativeAndroid) {
      await CadenceAudio.setShuffleMode({ enabled: prefs.shuffle });
      await CadenceAudio.setRepeatMode({ mode: prefs.repeatMode });
      await CadenceAudio.setPlaybackSpeed({ speed: prefs.speed });
      await CadenceAudio.setQueueAndPlay({
        tracks: queueTracks.map((t) => ({
          id: t.id,
          uri: t.uri,
          title: t.title,
          artist: t.artist,
          album: t.album,
          artworkPath: t.artworkPath || '',
        })),
        startIndex,
        startPositionMs: Math.max(0, Math.floor(positionSec * 1000)),
        autoPlay: false,
      });
      return;
    }

    this.webTracks = this.mergeTrackCatalog(this.webTracks, queueTracks);
    this.webQueueIds = queueTracks.map((t) => t.id);
    this.webShuffle = prefs.shuffle;
    this.webRepeat = prefs.repeatMode;
    this.webSpeed = prefs.speed;
    const target = queueTracks[startIndex];
    const audio = this.ensureWebAudioElement();
    this.webCurrentTrackId = target.id;
    audio.src = target.uri;
    audio.playbackRate = prefs.speed;
    const seekTarget = Math.max(0, positionSec);
    if (seekTarget > 0) {
      const onLoaded = () => {
        if (Number.isFinite(audio.duration) && seekTarget < audio.duration) {
          audio.currentTime = seekTarget;
        }
        audio.removeEventListener('loadedmetadata', onLoaded);
        this.emitWebState();
      };
      audio.addEventListener('loadedmetadata', onLoaded);
    }
    this.updateWebMediaSession(target);
    this.emitWebState();
  }

  public async setQueueAndPlay(
    queueTracks: Track[],
    startIndex: number,
    autoPlay = true
  ): Promise<void> {
    if (queueTracks.length === 0) return;

    if (this.isNativeAndroid) {
      await CadenceAudio.setQueueAndPlay({
        tracks: queueTracks.map((t) => ({
          id: t.id,
          uri: t.uri,
          title: t.title,
          artist: t.artist,
          album: t.album,
          artworkPath: t.artworkPath || '',
        })),
        startIndex,
        startPositionMs: 0,
        autoPlay,
      });
      return;
    }

    this.webTracks = this.mergeTrackCatalog(this.webTracks, queueTracks);
    this.webQueueIds = queueTracks.map((t) => t.id);
    const target = queueTracks[Math.max(0, Math.min(startIndex, queueTracks.length - 1))];
    await this.playWebTrack(target, autoPlay);
  }

  public async updateQueue(
    queueTracks: Track[],
    currentIndex: number
  ): Promise<void> {
    if (this.isNativeAndroid) {
      await CadenceAudio.updateQueue({
        tracks: queueTracks.map((t) => ({
          id: t.id,
          uri: t.uri,
          title: t.title,
          artist: t.artist,
          album: t.album,
          artworkPath: t.artworkPath || '',
        })),
        currentIndex,
      });
      return;
    }
    this.webTracks = this.mergeTrackCatalog(this.webTracks, queueTracks);
    this.webQueueIds = queueTracks.map((t) => t.id);
  }

  public async play(): Promise<void> {
    if (this.isNativeAndroid) {
      await CadenceAudio.play();
      return;
    }
    const audio = this.ensureWebAudioElement();
    this.ensureWebAudioGraph();
    if (this.webAudioCtx?.state === 'suspended') {
      await this.webAudioCtx.resume().catch(() => {});
    }
    if (!audio.src && this.webCurrentTrackId) {
      const track = this.webTracks.find((t) => t.id === this.webCurrentTrackId);
      if (track) await this.playWebTrack(track, true);
      return;
    }
    if (this.webGainNode && this.webAudioCtx) {
      this.webGainNode.gain.setTargetAtTime(
        this.webMuted ? 0 : this.webTargetVolume,
        this.webAudioCtx.currentTime,
        0.02
      );
    }
    await audio.play().catch((err) => {
      this.errorListeners.forEach((cb) =>
        cb(err instanceof Error ? err.message : 'Playback blocked by browser.')
      );
    });
    this.emitWebState();
  }

  public async pause(): Promise<void> {
    if (this.isNativeAndroid) {
      await CadenceAudio.pause();
      return;
    }
    this.webAudioEl?.pause();
    this.emitWebState();
  }

  public async seekTo(positionSec: number): Promise<void> {
    if (this.isNativeAndroid) {
      await CadenceAudio.seekTo({ positionMs: Math.max(0, positionSec * 1000) });
      return;
    }
    if (this.webAudioEl) {
      this.webAudioEl.currentTime = Math.max(0, positionSec);
      this.webCrossfadingOut = false;
      this.emitWebState();
    }
  }

  public async skipToNext(): Promise<void> {
    if (this.isNativeAndroid) {
      await CadenceAudio.skipToNext();
      return;
    }
    const nextId = getNextTrackId({
      queueIds: this.webQueueIds,
      currentTrackId: this.webCurrentTrackId,
      repeatMode: this.webRepeat,
      shuffle: this.webShuffle,
    });
    if (!nextId) {
      this.webAudioEl?.pause();
      this.emitWebState();
      return;
    }
    const nextTrack = this.webTracks.find((t) => t.id === nextId);
    if (nextTrack) await this.playWebTrack(nextTrack, true);
  }

  public async skipToPrevious(): Promise<void> {
    if (this.isNativeAndroid) {
      await CadenceAudio.skipToPrevious();
      return;
    }
    const currentPos = this.webAudioEl?.currentTime ?? 0;
    const prev = getPreviousTrackId({
      queueIds: this.webQueueIds,
      currentTrackId: this.webCurrentTrackId,
      currentTimeSec: currentPos,
      repeatMode: this.webRepeat,
    });
    if (prev.restartCurrent && this.webAudioEl) {
      this.webAudioEl.currentTime = 0;
      await this.play();
      return;
    }
    if (prev.trackId) {
      const prevTrack = this.webTracks.find((t) => t.id === prev.trackId);
      if (prevTrack) await this.playWebTrack(prevTrack, true);
    }
  }

  public async setShuffle(enabled: boolean): Promise<void> {
    if (this.isNativeAndroid) {
      await CadenceAudio.setShuffleMode({ enabled });
      return;
    }
    this.webShuffle = enabled;
    this.emitWebState();
  }

  public async setRepeatMode(mode: RepeatMode): Promise<void> {
    if (this.isNativeAndroid) {
      await CadenceAudio.setRepeatMode({ mode });
      return;
    }
    this.webRepeat = mode;
    this.emitWebState();
  }

  public async setPlaybackSpeed(speed: number): Promise<void> {
    const clamped = Math.max(0.5, Math.min(2.0, speed));
    if (this.isNativeAndroid) {
      await CadenceAudio.setPlaybackSpeed({ speed: clamped });
      return;
    }
    this.webSpeed = clamped;
    if (this.webAudioEl) {
      this.webAudioEl.playbackRate = clamped;
    }
    this.emitWebState();
  }

  public async setVolume(vol: number, muted: boolean): Promise<void> {
    const clamped = Math.max(0, Math.min(1, vol));
    this.webTargetVolume = clamped;
    this.webMuted = muted;
    if (this.webAudioEl) {
      this.webAudioEl.volume = muted ? 0 : clamped;
    }
    if (this.webGainNode && this.webAudioCtx) {
      this.webGainNode.gain.setTargetAtTime(
        muted ? 0 : clamped,
        this.webAudioCtx.currentTime,
        0.02
      );
    }
  }

  public async setSleepTimer(minutes: number): Promise<number> {
    if (this.isNativeAndroid) {
      const res = await CadenceAudio.setSleepTimer({ minutes });
      return res.endAtMs || 0;
    }
    if (this.webSleepTimerId !== null) {
      window.clearTimeout(this.webSleepTimerId);
      this.webSleepTimerId = null;
    }
    if (minutes <= 0) {
      this.webSleepEndAtMs = 0;
      this.emitWebState();
      return 0;
    }
    this.webSleepEndAtMs = Date.now() + minutes * 60_000;
    this.webSleepTimerId = window.setTimeout(() => {
      this.webSleepEndAtMs = 0;
      this.webAudioEl?.pause();
      this.emitWebState();
    }, minutes * 60_000);
    this.emitWebState();
    return this.webSleepEndAtMs;
  }

  public async getAudioEffectsState(): Promise<AudioEffectsState> {
    if (this.isNativeAndroid) {
      try {
        return await CadenceAudio.getAudioEffectsState();
      } catch {
        // Fallback if service not started yet
      }
    }
    return {
      enabled: this.webEqEnabled,
      equalizerSupported: true,
      minLevelMb: -1200,
      maxLevelMb: 1200,
      bands: WEB_EQ_FREQS.map((freq, idx) => ({
        index: idx,
        centerFreqHz: freq,
        levelMb: this.webBandLevelsMb[idx] ?? 0,
      })),
      bassBoostSupported: true,
      bassBoostStrength: this.webBassBoostStrength,
      virtualizerSupported: false,
      virtualizerStrength: 0,
    };
  }

  public async setEqEnabled(enabled: boolean): Promise<void> {
    if (this.isNativeAndroid) {
      await CadenceAudio.setEqEnabled({ enabled });
      return;
    }
    this.webEqEnabled = enabled;
    this.applyWebEq();
  }

  public async setEqBandLevel(bandIndex: number, levelMb: number): Promise<void> {
    if (this.isNativeAndroid) {
      await CadenceAudio.setEqBandLevel({ bandIndex, levelMb });
      return;
    }
    if (bandIndex >= 0 && bandIndex < this.webBandLevelsMb.length) {
      this.webBandLevelsMb[bandIndex] = levelMb;
      this.applyWebEq();
    }
  }

  public async setBassBoost(strength: number): Promise<void> {
    if (this.isNativeAndroid) {
      await CadenceAudio.setBassBoost({ strength });
      return;
    }
    this.webBassBoostStrength = Math.max(0, Math.min(1000, strength));
    this.applyWebEq();
  }

  public async setVirtualizer(strength: number): Promise<void> {
    if (this.isNativeAndroid) {
      await CadenceAudio.setVirtualizer({ strength });
    }
  }

  public async shareTrack(track: Track): Promise<void> {
    if (this.isNativeAndroid) {
      await CadenceAudio.shareTrack({
        filePath: track.filePath,
        uri: track.uri,
        title: `${track.title} — ${track.artist}`,
      });
      return;
    }
    if (navigator.share) {
      await navigator.share({
        title: track.title,
        text: `${track.title} by ${track.artist} (${track.album})`,
      });
    }
  }

  public getWebFrequencyData(target: Uint8Array<ArrayBuffer>): boolean {
    if (!this.webAnalyser || !this.webAudioEl || this.webAudioEl.paused) {
      return false;
    }
    try {
      this.webAnalyser.getByteFrequencyData(target);
      return true;
    } catch {
      return false;
    }
  }

  private mergeTrackCatalog(existing: Track[], incoming: Track[]): Track[] {
    const map = new Map<string, Track>();
    for (const t of existing) map.set(t.id, t);
    for (const t of incoming) map.set(t.id, t);
    return Array.from(map.values());
  }

  private ensureWebAudioElement(): HTMLAudioElement {
    if (!this.webAudioEl) {
      const audio = new Audio();
      audio.preload = 'metadata';
      audio.addEventListener('timeupdate', () => {
        if (
          this.webCrossfadeSec > 0 &&
          !this.webCrossfadingOut &&
          !audio.paused &&
          Number.isFinite(audio.duration) &&
          audio.duration > this.webCrossfadeSec + 1 &&
          audio.duration - audio.currentTime <= this.webCrossfadeSec &&
          this.webGainNode &&
          this.webAudioCtx
        ) {
          this.webCrossfadingOut = true;
          const now = this.webAudioCtx.currentTime;
          this.webGainNode.gain.cancelScheduledValues(now);
          this.webGainNode.gain.setValueAtTime(
            this.webGainNode.gain.value,
            now
          );
          this.webGainNode.gain.linearRampToValueAtTime(
            0.02,
            now + Math.max(0.25, audio.duration - audio.currentTime)
          );
        }
        this.emitWebState();
      });
      audio.addEventListener('play', () => this.emitWebState());
      audio.addEventListener('pause', () => this.emitWebState());
      audio.addEventListener('ended', () => {
        void this.skipToNext();
      });
      audio.addEventListener('error', () => {
        this.errorListeners.forEach((cb) =>
          cb('Unable to decode this audio file in the browser.')
        );
      });
      this.webAudioEl = audio;
    }
    return this.webAudioEl;
  }

  private ensureWebAudioGraph(): void {
    if (this.webAudioCtx || !this.webAudioEl || typeof window === 'undefined') {
      return;
    }
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtx) return;

    try {
      const ctx = new AudioCtx();
      const source = ctx.createMediaElementSource(this.webAudioEl);

      const eqNodes = WEB_EQ_FREQS.map((freq, idx) => {
        const filter = ctx.createBiquadFilter();
        filter.type =
          idx === 0
            ? 'lowshelf'
            : idx === WEB_EQ_FREQS.length - 1
            ? 'highshelf'
            : 'peaking';
        filter.frequency.value = freq;
        filter.Q.value = 1.1;
        return filter;
      });

      const bassNode = ctx.createBiquadFilter();
      bassNode.type = 'lowshelf';
      bassNode.frequency.value = 90;

      const gainNode = ctx.createGain();
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 128;

      let prev: AudioNode = source;
      for (const node of eqNodes) {
        prev.connect(node);
        prev = node;
      }
      prev.connect(bassNode);
      bassNode.connect(gainNode);
      gainNode.connect(analyser);
      analyser.connect(ctx.destination);

      this.webAudioCtx = ctx;
      this.webSourceNode = source;
      this.webEqNodes = eqNodes;
      this.webBassNode = bassNode;
      this.webGainNode = gainNode;
      this.webAnalyser = analyser;
      this.applyWebEq();
    } catch {
      // Fallback: HTMLAudioElement plays directly without Web Audio graph
    }
  }

  private applyWebEq(): void {
    if (!this.webAudioCtx) return;
    this.webEqNodes.forEach((node, idx) => {
      const db = this.webEqEnabled ? (this.webBandLevelsMb[idx] ?? 0) / 100 : 0;
      node.gain.setTargetAtTime(db, this.webAudioCtx!.currentTime, 0.03);
    });
    if (this.webBassNode) {
      const bassDb = this.webEqEnabled ? (this.webBassBoostStrength / 1000) * 8 : 0;
      this.webBassNode.gain.setTargetAtTime(
        bassDb,
        this.webAudioCtx.currentTime,
        0.03
      );
    }
  }

  private async playWebTrack(track: Track, autoPlay: boolean): Promise<void> {
    const audio = this.ensureWebAudioElement();
    this.ensureWebAudioGraph();
    this.webCurrentTrackId = track.id;
    this.webCrossfadingOut = false;
    audio.src = track.uri;
    audio.playbackRate = this.webSpeed;
    this.updateWebMediaSession(track);

    if (autoPlay) {
      if (this.webAudioCtx?.state === 'suspended') {
        await this.webAudioCtx.resume().catch(() => {});
      }
      const targetVol = this.webMuted ? 0 : this.webTargetVolume;
      if (this.webGainNode && this.webAudioCtx) {
        const now = this.webAudioCtx.currentTime;
        this.webGainNode.gain.cancelScheduledValues(now);
        if (this.webCrossfadeSec > 0 && targetVol > 0) {
          this.webGainNode.gain.setValueAtTime(0.02, now);
          this.webGainNode.gain.linearRampToValueAtTime(
            targetVol,
            now + Math.min(2.5, this.webCrossfadeSec)
          );
        } else {
          this.webGainNode.gain.setValueAtTime(targetVol, now);
        }
      }
      await audio.play().catch((err) => {
        this.errorListeners.forEach((cb) =>
          cb(err instanceof Error ? err.message : 'Unable to start playback.')
        );
      });
    }
    this.emitWebState();
  }

  private updateWebMediaSession(track: Track): void {
    if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) {
      return;
    }
    try {
      const artwork = track.artworkUrl
        ? [{ src: track.artworkUrl, sizes: '512x512', type: 'image/jpeg' }]
        : undefined;
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.title,
        artist: track.artist,
        album: track.album,
        artwork,
      });
      navigator.mediaSession.setActionHandler('play', () => void this.play());
      navigator.mediaSession.setActionHandler('pause', () => void this.pause());
      navigator.mediaSession.setActionHandler('previoustrack', () =>
        void this.skipToPrevious()
      );
      navigator.mediaSession.setActionHandler('nexttrack', () =>
        void this.skipToNext()
      );
    } catch {
      // Ignore MediaSession errors
    }
  }

  private emitWebState(): void {
    const audio = this.webAudioEl;
    const track = this.webTracks.find((t) => t.id === this.webCurrentTrackId);
    const snap: PlaybackSnapshot = {
      isPlaying: Boolean(audio && !audio.paused && !audio.ended),
      currentTrackId: this.webCurrentTrackId,
      positionSec:
        audio && Number.isFinite(audio.currentTime)
          ? Math.round(audio.currentTime * 10) / 10
          : 0,
      durationSec:
        audio && Number.isFinite(audio.duration) && audio.duration > 0
          ? Math.floor(audio.duration)
          : track?.durationSec ?? 0,
      shuffle: this.webShuffle,
      repeatMode: this.webRepeat,
      playbackSpeed: this.webSpeed,
      sleepTimerEndAtMs: this.webSleepEndAtMs,
    };
    this.stateListeners.forEach((cb) => cb(snap));
  }
}

export const playbackBridge = new PlaybackBridge();
