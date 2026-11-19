import type {
  AlbumGroup,
  ArtistGroup,
  FolderGroup,
  LyricsLine,
  ParsedLyrics,
  Playlist,
  RepeatMode,
  SortDirection,
  SortField,
  Track,
} from '../types/music';

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(
      2,
      '0'
    )}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatAlbumDuration(tracks: Track[]): string {
  const totalSec = tracks.reduce((sum, t) => sum + (t.durationSec || 0), 0);
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = Math.floor(totalSec % 60);
  if (hrs > 0) {
    return `${hrs}h ${String(mins).padStart(2, '0')}m`;
  }
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

export function deriveMetadataFromFilename(filename: string): {
  title: string;
  artist: string;
  trackNumber: number;
  formatLabel: string;
} {
  const cleanName = filename.split('/').pop()?.split('\\').pop() ?? filename;
  const dotIdx = cleanName.lastIndexOf('.');
  const ext = dotIdx > 0 ? cleanName.slice(dotIdx + 1).toLowerCase() : '';
  const base = dotIdx > 0 ? cleanName.slice(0, dotIdx) : cleanName;

  let trackNumber = 1;
  let working = base.trim();

  const numPrefix = working.match(/^(\d{1,3})[\s._-]+(.+)$/);
  if (numPrefix) {
    trackNumber = Math.max(1, parseInt(numPrefix[1], 10));
    working = numPrefix[2].trim();
  }

  let artist = 'Unknown Artist';
  let title = working || 'Untitled Track';
  const dashSplit = working.split(/\s+-\s+/);
  if (dashSplit.length >= 2) {
    artist = dashSplit[0].trim() || 'Unknown Artist';
    title = dashSplit.slice(1).join(' - ').trim() || title;
  }

  const formatMap: Record<string, string> = {
    mp3: 'MP3',
    flac: 'FLAC',
    wav: 'WAV',
    m4a: 'M4A',
    aac: 'AAC',
    ogg: 'OGG',
    opus: 'OPUS',
    wma: 'WMA',
  };

  return {
    title,
    artist,
    trackNumber,
    formatLabel: formatMap[ext] ?? (ext ? ext.toUpperCase() : 'AUDIO'),
  };
}

export function deduplicateTracks(tracks: Track[]): Track[] {
  const seenIds = new Set<string>();
  const seenUris = new Set<string>();
  const result: Track[] = [];
  for (const t of tracks) {
    const uriKey = t.filePath || t.uri;
    if (seenIds.has(t.id) || (uriKey && seenUris.has(uriKey))) {
      continue;
    }
    seenIds.add(t.id);
    if (uriKey) seenUris.add(uriKey);
    result.push(t);
  }
  return result;
}

export function filterTracks(tracks: Track[], query: string): Track[] {
  const q = query.trim().toLowerCase();
  if (!q) return tracks;
  return tracks.filter(
    (t) =>
      t.title.toLowerCase().includes(q) ||
      t.artist.toLowerCase().includes(q) ||
      t.album.toLowerCase().includes(q) ||
      t.folderName.toLowerCase().includes(q) ||
      t.formatLabel.toLowerCase().includes(q)
  );
}

export function sortTracks(
  tracks: Track[],
  field: SortField,
  direction: SortDirection
): Track[] {
  const factor = direction === 'asc' ? 1 : -1;
  return [...tracks].sort((a, b) => {
    switch (field) {
      case 'title':
        return a.title.localeCompare(b.title) * factor;
      case 'artist':
        return (
          (a.artist.localeCompare(b.artist) ||
            a.album.localeCompare(b.album) ||
            a.trackNumber - b.trackNumber) * factor
        );
      case 'album':
        return (
          (a.album.localeCompare(b.album) || a.trackNumber - b.trackNumber) *
          factor
        );
      case 'duration':
        return (a.durationSec - b.durationSec) * factor;
      case 'dateAdded':
        return (a.dateAdded - b.dateAdded) * factor;
    }
  });
}

export function groupTracksIntoAlbums(tracks: Track[]): AlbumGroup[] {
  const map = new Map<string, AlbumGroup>();
  for (const track of tracks) {
    const key = track.albumId || `alb-${track.album.toLowerCase()}`;
    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        id: key,
        title: track.album || 'Unknown Album',
        artist: track.artist || 'Unknown Artist',
        artworkUrl: track.artworkUrl,
        trackIds: [track.id],
        totalDurationSec: track.durationSec,
      });
    } else {
      existing.trackIds.push(track.id);
      existing.totalDurationSec += track.durationSec;
      if (!existing.artworkUrl && track.artworkUrl) {
        existing.artworkUrl = track.artworkUrl;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.title.localeCompare(b.title)
  );
}

export function groupTracksIntoArtists(tracks: Track[]): ArtistGroup[] {
  const map = new Map<string, ArtistGroup>();
  for (const track of tracks) {
    const name = track.artist || 'Unknown Artist';
    const existing = map.get(name);
    if (!existing) {
      map.set(name, {
        name,
        artworkUrl: track.artworkUrl,
        albumIds: track.albumId ? [track.albumId] : [],
        trackIds: [track.id],
        totalDurationSec: track.durationSec,
      });
    } else {
      existing.trackIds.push(track.id);
      existing.totalDurationSec += track.durationSec;
      if (track.albumId && !existing.albumIds.includes(track.albumId)) {
        existing.albumIds.push(track.albumId);
      }
      if (!existing.artworkUrl && track.artworkUrl) {
        existing.artworkUrl = track.artworkUrl;
      }
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export function groupTracksIntoFolders(tracks: Track[]): FolderGroup[] {
  const map = new Map<string, FolderGroup>();
  for (const track of tracks) {
    const path = track.folderPath || '/';
    const existing = map.get(path);
    if (!existing) {
      map.set(path, {
        path,
        name: track.folderName || 'Music',
        trackIds: [track.id],
        totalDurationSec: track.durationSec,
      });
    } else {
      existing.trackIds.push(track.id);
      existing.totalDurationSec += track.durationSec;
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

export function getNextTrackId(params: {
  queueIds: string[];
  currentTrackId: string | null;
  repeatMode: RepeatMode;
  shuffle: boolean;
  randomIndex?: number;
}): string | null {
  const { queueIds, currentTrackId, repeatMode, shuffle, randomIndex } = params;
  if (queueIds.length === 0) return null;

  if (
    repeatMode === 'one' &&
    currentTrackId &&
    queueIds.includes(currentTrackId)
  ) {
    return currentTrackId;
  }

  if (shuffle && queueIds.length > 1) {
    const candidates = queueIds.filter((id) => id !== currentTrackId);
    const idx =
      randomIndex !== undefined
        ? Math.abs(randomIndex) % candidates.length
        : Math.floor(Math.random() * candidates.length);
    return candidates[idx] ?? queueIds[0];
  }

  const currentIdx = currentTrackId ? queueIds.indexOf(currentTrackId) : -1;
  if (currentIdx === -1) return queueIds[0];

  const nextIdx = currentIdx + 1;
  if (nextIdx < queueIds.length) {
    return queueIds[nextIdx];
  }

  return repeatMode === 'all' ? queueIds[0] : null;
}

export function getPreviousTrackId(params: {
  queueIds: string[];
  currentTrackId: string | null;
  currentTimeSec: number;
  repeatMode: RepeatMode;
}): { trackId: string | null; restartCurrent: boolean } {
  const { queueIds, currentTrackId, currentTimeSec, repeatMode } = params;
  if (queueIds.length === 0) return { trackId: null, restartCurrent: false };

  if (currentTimeSec > 3 && currentTrackId) {
    return { trackId: currentTrackId, restartCurrent: true };
  }

  const currentIdx = currentTrackId ? queueIds.indexOf(currentTrackId) : -1;
  if (currentIdx <= 0) {
    if (repeatMode === 'all') {
      return { trackId: queueIds[queueIds.length - 1], restartCurrent: false };
    }
    return { trackId: queueIds[0], restartCurrent: true };
  }

  return { trackId: queueIds[currentIdx - 1], restartCurrent: false };
}

export function moveQueueItem(
  queueIds: string[],
  fromIndex: number,
  toIndex: number
): string[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= queueIds.length ||
    toIndex >= queueIds.length ||
    fromIndex === toIndex
  ) {
    return queueIds;
  }
  const copy = [...queueIds];
  const [moved] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, moved);
  return copy;
}

export function enqueueTrackUnique(
  queueIds: string[],
  trackId: string
): string[] {
  if (queueIds.includes(trackId)) return queueIds;
  return [...queueIds, trackId];
}

export function playNextInQueue(
  queueIds: string[],
  currentTrackId: string | null,
  trackId: string
): string[] {
  const filtered = queueIds.filter((id) => id !== trackId);
  if (!currentTrackId) return [trackId, ...filtered];
  const currentIdx = filtered.indexOf(currentTrackId);
  if (currentIdx === -1) return [trackId, ...filtered];
  const copy = [...filtered];
  copy.splice(currentIdx + 1, 0, trackId);
  return copy;
}

export function validatePlaylistInput(
  name: string,
  existingPlaylists: Playlist[],
  ignorePlaylistId?: string
): { valid: boolean; error?: string; trimmedName: string } {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return {
      valid: false,
      error: 'Enter a playlist name.',
      trimmedName,
    };
  }
  if (trimmedName.length < 2) {
    return {
      valid: false,
      error: 'Playlist name must be at least 2 characters.',
      trimmedName,
    };
  }
  const duplicate = existingPlaylists.some(
    (p) =>
      p.id !== ignorePlaylistId &&
      p.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (duplicate) {
    return {
      valid: false,
      error: `A playlist named "${trimmedName}" already exists.`,
      trimmedName,
    };
  }
  return { valid: true, trimmedName };
}

export function parseLrcLyrics(raw: string): ParsedLyrics {
  const trimmed = raw.replace(/^\uFEFF/, '').trim();
  if (!trimmed) {
    return { synced: false, lines: [] };
  }

  const timestampRegex = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const enhancedInlineRegex = /<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g;
  const offsetRegex = /^\[offset:\s*([+-]?\d+)\s*\]$/i;
  const metadataRegex = /^\[[a-z]{1,12}:[^\]]*\]$/i;

  let offsetSec = 0;
  const timedLines: LyricsLine[] = [];
  const plainLines: LyricsLine[] = [];

  for (const rawLine of trimmed.split(/\r?\n/)) {
    const line = rawLine.replace(/^\uFEFF/, '').trim();
    if (!line) continue;

    const offsetMatch = line.match(offsetRegex);
    if (offsetMatch) {
      const ms = parseInt(offsetMatch[1], 10);
      if (Number.isFinite(ms)) {
        offsetSec = ms / 1000;
      }
      continue;
    }

    const matches = Array.from(line.matchAll(timestampRegex));
    if (matches.length > 0) {
      const text = line
        .replace(timestampRegex, '')
        .replace(enhancedInlineRegex, '')
        .trim();
      for (const m of matches) {
        const mins = parseInt(m[1], 10);
        const secs = parseInt(m[2], 10);
        const fracRaw = m[3] ?? '';
        const frac =
          fracRaw.length > 0
            ? parseInt(fracRaw, 10) / Math.pow(10, fracRaw.length)
            : 0;
        const timeSec = Math.max(0, mins * 60 + secs + frac - offsetSec);
        timedLines.push({ timeSec, text: text || '···' });
      }
    } else if (!metadataRegex.test(line)) {
      plainLines.push({ timeSec: null, text: line });
    }
  }

  if (timedLines.length > 0) {
    timedLines.sort((a, b) => (a.timeSec ?? 0) - (b.timeSec ?? 0));
    return { synced: true, lines: timedLines };
  }

  return { synced: false, lines: plainLines };
}

export function findActiveLyricIndex(
  lines: LyricsLine[],
  currentTimeSec: number
): number {
  let active = -1;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].timeSec;
    if (t !== null && t <= currentTimeSec + 0.15) {
      active = i;
    } else if (t !== null && t > currentTimeSec + 0.15) {
      break;
    }
  }
  return active;
}

export function clampEqGainDb(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.max(-12, Math.min(12, Math.round(db * 2) / 2));
}

export function filterExcludedFolders(
  tracks: Track[],
  excludedFolders: string[]
): Track[] {
  if (!excludedFolders || excludedFolders.length === 0) return tracks;
  const normalized = excludedFolders
    .map((f) => f.trim().toLowerCase().replace(/\/+$/, ''))
    .filter(Boolean);
  if (normalized.length === 0) return tracks;

  return tracks.filter((t) => {
    const fp = (t.folderPath || '').trim().toLowerCase().replace(/\/+$/, '');
    const fn = (t.folderName || '').trim().toLowerCase();
    return !normalized.some(
      (ex) => fp === ex || fp.startsWith(`${ex}/`) || fn === ex
    );
  });
}

export function getRecentlyAddedTracks(tracks: Track[], limit = 8): Track[] {
  return [...tracks]
    .sort((a, b) => (b.dateAdded || 0) - (a.dateAdded || 0))
    .slice(0, Math.max(0, limit));
}

export function estimateBitrateKbps(
  sizeBytes: number,
  durationSec: number,
  explicitBitrateKbps?: number
): number {
  if (
    explicitBitrateKbps &&
    Number.isFinite(explicitBitrateKbps) &&
    explicitBitrateKbps > 0
  ) {
    return Math.round(explicitBitrateKbps);
  }
  if (!Number.isFinite(sizeBytes) || !Number.isFinite(durationSec) || durationSec <= 0) {
    return 0;
  }
  return Math.max(1, Math.round((sizeBytes * 8) / durationSec / 1000));
}

export function formatRemainingSleepTimer(
  endAtMs: number,
  nowMs = Date.now()
): string {
  if (!endAtMs || endAtMs <= nowMs) return '';
  const remainingSec = Math.max(0, Math.ceil((endAtMs - nowMs) / 1000));
  const mins = Math.floor(remainingSec / 60);
  const secs = remainingSec % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}
