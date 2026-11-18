import type {
  Album,
  EqBands,
  EqPreset,
  GenreFilter,
  Playlist,
  RepeatMode,
  Track,
} from '../types/music';

export function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function formatAlbumDuration(tracks: Track[]): string {
  const totalSec = tracks.reduce((sum, t) => sum + t.durationSec, 0);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

export function filterTracks(
  tracks: Track[],
  genre: GenreFilter,
  query: string
): Track[] {
  const normalizedQuery = query.trim().toLowerCase();
  return tracks.filter((track) => {
    const matchesGenre = genre === 'All' || track.genre === genre;
    if (!matchesGenre) return false;
    if (!normalizedQuery) return true;
    return (
      track.title.toLowerCase().includes(normalizedQuery) ||
      track.artist.toLowerCase().includes(normalizedQuery) ||
      track.albumTitle.toLowerCase().includes(normalizedQuery) ||
      track.genre.toLowerCase().includes(normalizedQuery)
    );
  });
}

export function filterAlbums(
  albums: Album[],
  genre: GenreFilter,
  query: string
): Album[] {
  const normalizedQuery = query.trim().toLowerCase();
  return albums.filter((album) => {
    const matchesGenre = genre === 'All' || album.genre === genre;
    if (!matchesGenre) return false;
    if (!normalizedQuery) return true;
    return (
      album.title.toLowerCase().includes(normalizedQuery) ||
      album.artist.toLowerCase().includes(normalizedQuery) ||
      album.genre.toLowerCase().includes(normalizedQuery) ||
      album.label.toLowerCase().includes(normalizedQuery)
    );
  });
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

  if (repeatMode === 'one' && currentTrackId && queueIds.includes(currentTrackId)) {
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

  // Standard pro player behavior: if > 3s into track, restart current track
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

export function enqueueTrackUnique(queueIds: string[], trackId: string): string[] {
  if (queueIds.includes(trackId)) return queueIds;
  return [...queueIds, trackId];
}

export function validatePlaylistInput(
  name: string,
  existingPlaylists: Playlist[]
): { valid: boolean; error?: string; trimmedName: string } {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return {
      valid: false,
      error: 'Enter a playlist name before creating.',
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
    (p) => p.name.trim().toLowerCase() === trimmedName.toLowerCase()
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

export function findMatchingEqPreset(
  bands: EqBands,
  presets: EqPreset[]
): string | null {
  const match = presets.find(
    (preset) =>
      Math.abs(preset.bands.hz60 - bands.hz60) < 0.05 &&
      Math.abs(preset.bands.hz230 - bands.hz230) < 0.05 &&
      Math.abs(preset.bands.hz910 - bands.hz910) < 0.05 &&
      Math.abs(preset.bands.hz3600 - bands.hz3600) < 0.05 &&
      Math.abs(preset.bands.hz14000 - bands.hz14000) < 0.05
  );
  return match ? match.id : null;
}

export function clampEqGain(db: number): number {
  if (!Number.isFinite(db)) return 0;
  return Math.max(-12, Math.min(12, Math.round(db * 2) / 2));
}
