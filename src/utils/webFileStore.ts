import type { Track } from '../types/music';
import { extractAudioMetadataFromBlob } from './audioMetadataParser';
import { deriveMetadataFromFilename, estimateBitrateKbps } from './musicLogic';

const DB_NAME = 'cadence_studio_offline_db';
const DB_VERSION = 2;
const STORE_TRACKS = 'tracks';
const STORE_LYRICS = 'lyrics';
const STORE_ARTWORK = 'artwork';
const STORE_TRACK_LYRICS = 'track_lyrics';

interface StoredWebTrackRecord {
  id: string;
  blob: Blob;
  filePath: string;
  title: string;
  artist: string;
  album: string;
  albumId: string;
  durationSec: number;
  trackNumber: number;
  bitrateKbps?: number;
  mimeType: string;
  formatLabel: string;
  sizeBytes: number;
  dateAdded: number;
  folderPath: string;
  folderName: string;
  embeddedLyrics?: string;
  artworkKey?: string;
}

interface StoredLyricsRecord {
  key: string; // normalized basename without extension
  text: string;
}

interface StoredArtworkRecord {
  key: string;
  blob: Blob;
  updatedAt: number;
}

interface StoredTrackLyricsRecord {
  trackId: string;
  text: string;
  updatedAt: number;
}

// In-memory object URL caches keyed by track ID or artwork key to prevent leaks
const trackBlobUrlCache = new Map<string, string>();
const artworkBlobUrlCache = new Map<string, string>();

function getOrCreateTrackUrl(id: string, blob: Blob): string {
  const existing = trackBlobUrlCache.get(id);
  if (existing) return existing;
  const created = URL.createObjectURL(blob);
  trackBlobUrlCache.set(id, created);
  return created;
}

function getOrCreateArtworkUrl(key: string, blob: Blob): string {
  const existing = artworkBlobUrlCache.get(key);
  if (existing) return existing;
  const created = URL.createObjectURL(blob);
  artworkBlobUrlCache.set(key, created);
  return created;
}

function revokeArtworkUrl(key: string): void {
  const existing = artworkBlobUrlCache.get(key);
  if (existing) {
    URL.revokeObjectURL(existing);
    artworkBlobUrlCache.delete(key);
  }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB is unavailable in this environment.'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TRACKS)) {
        db.createObjectStore(STORE_TRACKS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_LYRICS)) {
        db.createObjectStore(STORE_LYRICS, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_ARTWORK)) {
        db.createObjectStore(STORE_ARTWORK, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(STORE_TRACK_LYRICS)) {
        db.createObjectStore(STORE_TRACK_LYRICS, { keyPath: 'trackId' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB.'));
  });
}

function probeAudioDuration(blob: Blob): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio();
    const cleanup = () => {
      audio.src = '';
      URL.revokeObjectURL(url);
    };
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      const dur = Number.isFinite(audio.duration) ? Math.round(audio.duration) : 0;
      cleanup();
      resolve(Math.max(1, dur));
    };
    audio.onerror = () => {
      cleanup();
      resolve(0);
    };
    audio.src = url;
  });
}

async function prepareValidatedArtworkBlob(
  blob: Blob,
  maxSize = 960
): Promise<Blob | null> {
  if (typeof document === 'undefined' || typeof createImageBitmap === 'undefined') {
    return blob;
  }
  try {
    const bitmap = await createImageBitmap(blob);
    const maxDim = Math.max(bitmap.width, bitmap.height);
    if (maxDim <= maxSize && blob.size <= 1.2 * 1024 * 1024) {
      bitmap.close();
      return blob;
    }
    const scale = maxDim > maxSize ? maxSize / maxDim : 1;
    const targetW = Math.max(1, Math.round(bitmap.width * scale));
    const targetH = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return blob;
    }
    ctx.drawImage(bitmap, 0, 0, targetW, targetH);
    bitmap.close();

    const outMime =
      blob.type === 'image/png' || blob.type === 'image/webp'
        ? blob.type
        : 'image/jpeg';
    const resized = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((out) => resolve(out), outMime, 0.92)
    );
    return resized ?? blob;
  } catch {
    return null;
  }
}

function normalizeBasename(pathOrName: string): string {
  const name = pathOrName.split('/').pop()?.split('\\').pop() ?? pathOrName;
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name).replace(/^\uFEFF/, '').trim().toLowerCase();
}

function stripLeadingTrackNumber(name: string): string {
  return name.replace(/^\d{1,3}\s*[-._)\]]+\s*/, '').trim().toLowerCase();
}

function getRelativeFolderKey(file: File): string {
  const relPath =
    (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
    file.name;
  const parts = relPath.split('/').filter(Boolean);
  return parts.length > 1 ? parts.slice(0, -1).join('/').toLowerCase() : '';
}

function mapRecordToTrack(
  record: StoredWebTrackRecord,
  artworkMap: Map<string, string>
): Track {
  const artworkUrl = record.artworkKey ? artworkMap.get(record.artworkKey) ?? '' : '';
  return {
    id: record.id,
    uri: getOrCreateTrackUrl(record.id, record.blob),
    filePath: record.filePath || `${record.folderPath}/${record.title}`,
    title: record.title,
    artist: record.artist,
    album: record.album,
    albumId: record.albumId,
    durationSec: record.durationSec,
    durationMs: record.durationSec * 1000,
    trackNumber: record.trackNumber,
    bitrateKbps:
      record.bitrateKbps ??
      estimateBitrateKbps(record.sizeBytes, record.durationSec),
    mimeType: record.mimeType,
    formatLabel: record.formatLabel,
    sizeBytes: record.sizeBytes,
    dateAdded: record.dateAdded,
    folderPath: record.folderPath,
    folderName: record.folderName,
    artworkPath: record.artworkKey ?? '',
    artworkUrl,
    embeddedLyrics: record.embeddedLyrics,
    source: 'web-file',
  };
}

export async function importWebAudioFiles(
  fileList: FileList | File[],
  options: { loadEmbeddedArtwork?: boolean } = {}
): Promise<{ importedTracks: Track[]; importedLyricsCount: number }> {
  const loadArtwork = options.loadEmbeddedArtwork !== false;
  const files = Array.from(fileList);
  const audioRegex = /\.(mp3|flac|wav|m4a|aac|ogg|opus|wma|webm)$/i;
  const audioFiles = files.filter(
    (f) => f.type.startsWith('audio/') || audioRegex.test(f.name)
  );
  const lrcFiles = files.filter((f) => /\.(lrc|txt)$/i.test(f.name));

  const coverRegex = /^(cover|folder|front|album|artwork)\.(jpe?g|png|webp)$/i;
  const folderCoverFiles = new Map<string, File>();
  for (const f of files) {
    if (coverRegex.test(f.name)) {
      const fKey = getRelativeFolderKey(f);
      if (fKey && !folderCoverFiles.has(fKey)) {
        folderCoverFiles.set(fKey, f);
      }
    }
  }

  const db = await openDb();

  let importedLyricsCount = 0;
  for (const lrc of lrcFiles) {
    try {
      const text = (await lrc.text()).replace(/^\uFEFF/, '');
      const key = normalizeBasename(lrc.name);
      if (key && text.trim()) {
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_LYRICS, 'readwrite');
          tx.objectStore(STORE_LYRICS).put({ key, text } satisfies StoredLyricsRecord);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        importedLyricsCount += 1;
      }
    } catch {
      // Skip unreadable lyrics file
    }
  }

  const importedTracks: Track[] = [];
  for (const file of audioFiles) {
    const relPath =
      (file as File & { webkitRelativePath?: string }).webkitRelativePath ||
      file.name;
    const parts = relPath.split('/').filter(Boolean);
    const folderPath =
      parts.length > 1 ? parts.slice(0, -1).join('/') : 'Imported Files';
    const folderName =
      parts.length > 1 ? parts[parts.length - 2] : 'Imported Files';

    const fallbackMeta = deriveMetadataFromFilename(file.name);
    const parsedTags = await extractAudioMetadataFromBlob(file);
    const durationSec = await probeAudioDuration(file);

    const title = parsedTags.title || fallbackMeta.title;
    const artist = parsedTags.artist || fallbackMeta.artist;
    const albumName =
      parsedTags.album ||
      (parts.length > 2 ? parts[parts.length - 2] : 'Local Imports');
    const trackNumber = parsedTags.trackNumber || fallbackMeta.trackNumber;
    const albumId = `alb-web-${albumName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    const id = `web-${file.name}-${file.size}-${file.lastModified}`;
    const bitrateKbps = estimateBitrateKbps(file.size, durationSec);

    let artworkKey = '';
    let artworkUrl = '';
    if (loadArtwork) {
      let sourceArtBlob: Blob | null = null;
      if (parsedTags.artworkBytes && parsedTags.artworkBytes.length > 0) {
        const rawBytes = new Uint8Array(parsedTags.artworkBytes);
        sourceArtBlob = new Blob([rawBytes], {
          type: parsedTags.artworkMime || 'image/jpeg',
        });
      } else {
        const relFolderKey = getRelativeFolderKey(file);
        const sidecar = relFolderKey ? folderCoverFiles.get(relFolderKey) : undefined;
        if (sidecar) {
          sourceArtBlob = sidecar;
        }
      }

      if (sourceArtBlob) {
        try {
          const validatedBlob = await prepareValidatedArtworkBlob(sourceArtBlob);
          if (validatedBlob) {
            artworkKey = `embedded-${id}`;
            await new Promise<void>((resolve, reject) => {
              const tx = db.transaction(STORE_ARTWORK, 'readwrite');
              tx.objectStore(STORE_ARTWORK).put({
                key: artworkKey,
                blob: validatedBlob,
                updatedAt: Date.now(),
              } satisfies StoredArtworkRecord);
              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(tx.error);
            });
            revokeArtworkUrl(artworkKey);
            artworkUrl = getOrCreateArtworkUrl(artworkKey, validatedBlob);
          }
        } catch {
          artworkKey = '';
          artworkUrl = '';
        }
      }
    }

    const record: StoredWebTrackRecord = {
      id,
      blob: file,
      filePath: relPath,
      title,
      artist,
      album: albumName,
      albumId,
      durationSec,
      trackNumber,
      bitrateKbps,
      mimeType: file.type || 'audio/*',
      formatLabel: fallbackMeta.formatLabel,
      sizeBytes: file.size,
      dateAdded: Math.floor((file.lastModified || Date.now()) / 1000),
      folderPath,
      folderName,
      embeddedLyrics: parsedTags.lyrics || undefined,
      artworkKey: artworkKey || undefined,
    };

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readwrite');
      tx.objectStore(STORE_TRACKS).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    const objectUrl = getOrCreateTrackUrl(record.id, file);
    importedTracks.push({
      id: record.id,
      uri: objectUrl,
      filePath: record.filePath,
      title: record.title,
      artist: record.artist,
      album: record.album,
      albumId: record.albumId,
      durationSec: record.durationSec,
      durationMs: record.durationSec * 1000,
      trackNumber: record.trackNumber,
      bitrateKbps: record.bitrateKbps,
      mimeType: record.mimeType,
      formatLabel: record.formatLabel,
      sizeBytes: record.sizeBytes,
      dateAdded: record.dateAdded,
      folderPath: record.folderPath,
      folderName: record.folderName,
      artworkPath: artworkKey,
      artworkUrl,
      embeddedLyrics: record.embeddedLyrics,
      source: 'web-file',
    });
  }

  db.close();
  return { importedTracks, importedLyricsCount };
}

export async function loadStoredWebTracks(): Promise<Track[]> {
  try {
    const db = await openDb();
    const [records, artRecords] = await Promise.all([
      new Promise<StoredWebTrackRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_TRACKS, 'readonly');
        const req = tx.objectStore(STORE_TRACKS).getAll();
        req.onsuccess = () => resolve((req.result as StoredWebTrackRecord[]) ?? []);
        req.onerror = () => reject(req.error);
      }),
      new Promise<StoredArtworkRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_ARTWORK, 'readonly');
        const req = tx.objectStore(STORE_ARTWORK).getAll();
        req.onsuccess = () => resolve((req.result as StoredArtworkRecord[]) ?? []);
        req.onerror = () => reject(req.error);
      }),
    ]);
    db.close();

    const artworkMap = new Map<string, string>();
    for (const art of artRecords) {
      artworkMap.set(art.key, getOrCreateArtworkUrl(art.key, art.blob));
    }

    return records.map((record) => mapRecordToTrack(record, artworkMap));
  } catch {
    return [];
  }
}

export async function refreshWebLibraryMetadata(
  loadEmbeddedArtwork = true
): Promise<Track[]> {
  try {
    const db = await openDb();
    const records = await new Promise<StoredWebTrackRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_TRACKS, 'readonly');
      const req = tx.objectStore(STORE_TRACKS).getAll();
      req.onsuccess = () => resolve((req.result as StoredWebTrackRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });

    for (const record of records) {
      const fileName = record.filePath.split('/').pop() || record.title;
      const fallbackMeta = deriveMetadataFromFilename(fileName);
      const parsed = await extractAudioMetadataFromBlob(record.blob);

      const updated: StoredWebTrackRecord = {
        ...record,
        title: parsed.title || record.title || fallbackMeta.title,
        artist: parsed.artist || record.artist || fallbackMeta.artist,
        album: parsed.album || record.album || 'Local Imports',
        trackNumber: parsed.trackNumber || record.trackNumber || 1,
        bitrateKbps:
          record.bitrateKbps ??
          estimateBitrateKbps(record.sizeBytes, record.durationSec),
        embeddedLyrics: parsed.lyrics || record.embeddedLyrics,
      };
      updated.albumId = `alb-web-${updated.album.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;

      if (loadEmbeddedArtwork && parsed.artworkBytes && parsed.artworkBytes.length > 0) {
        try {
          const rawBytes = new Uint8Array(parsed.artworkBytes);
          const rawBlob = new Blob([rawBytes], {
            type: parsed.artworkMime || 'image/jpeg',
          });
          const compactBlob = await prepareValidatedArtworkBlob(rawBlob);
          if (compactBlob) {
            const artKey = `embedded-${record.id}`;
            await new Promise<void>((resolve, reject) => {
              const tx = db.transaction(STORE_ARTWORK, 'readwrite');
              tx.objectStore(STORE_ARTWORK).put({
                key: artKey,
                blob: compactBlob,
                updatedAt: Date.now(),
              } satisfies StoredArtworkRecord);
              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(tx.error);
            });
            revokeArtworkUrl(artKey);
            getOrCreateArtworkUrl(artKey, compactBlob);
            updated.artworkKey = artKey;
          }
        } catch {
          // Ignore unreadable cover bytes
        }
      } else if (!loadEmbeddedArtwork) {
        updated.artworkKey = undefined;
      }

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_TRACKS, 'readwrite');
        tx.objectStore(STORE_TRACKS).put(updated);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    db.close();
    return loadStoredWebTracks();
  } catch {
    return loadStoredWebTracks();
  }
}

export async function saveCustomArtwork(
  key: string,
  fileOrBlob: Blob
): Promise<string> {
  const validated = await prepareValidatedArtworkBlob(fileOrBlob, 960);
  if (!validated) {
    throw new Error('Selected file is not a decodable image.');
  }
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_ARTWORK, 'readwrite');
    tx.objectStore(STORE_ARTWORK).put({
      key,
      blob: validated,
      updatedAt: Date.now(),
    } satisfies StoredArtworkRecord);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  revokeArtworkUrl(key);
  return getOrCreateArtworkUrl(key, validated);
}

export async function loadAllCustomArtworkUrls(): Promise<Record<string, string>> {
  try {
    const db = await openDb();
    const artRecords = await new Promise<StoredArtworkRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_ARTWORK, 'readonly');
      const req = tx.objectStore(STORE_ARTWORK).getAll();
      req.onsuccess = () => resolve((req.result as StoredArtworkRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();

    const out: Record<string, string> = {};
    for (const art of artRecords) {
      if (art.key.startsWith('custom-')) {
        out[art.key] = getOrCreateArtworkUrl(art.key, art.blob);
      }
    }
    return out;
  } catch {
    return {};
  }
}

export async function clearWebArtworkCache(): Promise<{ clearedBytes: number }> {
  let clearedBytes = 0;
  try {
    const db = await openDb();
    const artRecords = await new Promise<StoredArtworkRecord[]>((resolve, reject) => {
      const tx = db.transaction(STORE_ARTWORK, 'readonly');
      const req = tx.objectStore(STORE_ARTWORK).getAll();
      req.onsuccess = () => resolve((req.result as StoredArtworkRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });

    const embeddedKeys = artRecords
      .filter((a) => !a.key.startsWith('custom-'))
      .map((a) => {
        clearedBytes += a.blob.size;
        return a.key;
      });

    if (embeddedKeys.length > 0) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_ARTWORK, 'readwrite');
        const store = tx.objectStore(STORE_ARTWORK);
        for (const k of embeddedKeys) {
          store.delete(k);
          revokeArtworkUrl(k);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
    db.close();
  } catch {
    // Ignore
  }
  return { clearedBytes };
}

export async function saveTrackCustomLyrics(
  trackId: string,
  text: string
): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_TRACK_LYRICS, 'readwrite');
    if (text.trim()) {
      tx.objectStore(STORE_TRACK_LYRICS).put({
        trackId,
        text,
        updatedAt: Date.now(),
      } satisfies StoredTrackLyricsRecord);
    } else {
      tx.objectStore(STORE_TRACK_LYRICS).delete(trackId);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function loadTrackCustomLyrics(trackId: string): Promise<string> {
  try {
    const db = await openDb();
    const rec = await new Promise<StoredTrackLyricsRecord | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_TRACK_LYRICS, 'readonly');
        const req = tx.objectStore(STORE_TRACK_LYRICS).get(trackId);
        req.onsuccess = () =>
          resolve(req.result as StoredTrackLyricsRecord | undefined);
        req.onerror = () => reject(req.error);
      }
    );
    db.close();
    return rec?.text ?? '';
  } catch {
    return '';
  }
}

export async function getAllTrackCustomLyricsIds(): Promise<string[]> {
  try {
    const db = await openDb();
    const records = await new Promise<StoredTrackLyricsRecord[]>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_TRACK_LYRICS, 'readonly');
        const req = tx.objectStore(STORE_TRACK_LYRICS).getAll();
        req.onsuccess = () =>
          resolve((req.result as StoredTrackLyricsRecord[]) ?? []);
        req.onerror = () => reject(req.error);
      }
    );
    db.close();
    return records.map((r) => r.trackId);
  } catch {
    return [];
  }
}

export async function clearAllTrackCustomLyrics(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_TRACK_LYRICS, 'readwrite');
      tx.objectStore(STORE_TRACK_LYRICS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Ignore
  }
}

export async function lookupWebLyrics(track: Track): Promise<string> {
  try {
    const custom = await loadTrackCustomLyrics(track.id);
    if (custom.trim()) return custom;

    const db = await openDb();
    const baseFromPath = normalizeBasename(track.filePath || '');
    const strippedFromPath = stripLeadingTrackNumber(baseFromPath);
    const titleLower = (track.title || '').trim().toLowerCase();
    const artistLower = (track.artist || '').trim().toLowerCase();
    const artistTitleKey =
      artistLower && artistLower !== 'unknown artist' && titleLower
        ? `${artistLower} - ${titleLower}`
        : '';

    const candidateKeys = Array.from(
      new Set(
        [
          baseFromPath,
          strippedFromPath,
          artistTitleKey,
          normalizeBasename(track.title || ''),
        ].filter(Boolean)
      )
    );

    let matched = '';
    for (const key of candidateKeys) {
      const rec = await new Promise<StoredLyricsRecord | undefined>(
        (resolve, reject) => {
          const tx = db.transaction(STORE_LYRICS, 'readonly');
          const req = tx.objectStore(STORE_LYRICS).get(key);
          req.onsuccess = () => resolve(req.result as StoredLyricsRecord | undefined);
          req.onerror = () => reject(req.error);
        }
      );
      if (rec?.text) {
        matched = rec.text;
        break;
      }
    }
    db.close();
    if (matched.trim()) return matched;
    return track.embeddedLyrics || '';
  } catch {
    return track.embeddedLyrics || '';
  }
}

export async function getWebStorageStats(): Promise<{
  trackCount: number;
  audioBytes: number;
  artworkCount: number;
  artworkBytes: number;
  customLyricsCount: number;
}> {
  try {
    const db = await openDb();
    const [tracks, artworks, customLyrics] = await Promise.all([
      new Promise<StoredWebTrackRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_TRACKS, 'readonly');
        const req = tx.objectStore(STORE_TRACKS).getAll();
        req.onsuccess = () => resolve((req.result as StoredWebTrackRecord[]) ?? []);
        req.onerror = () => reject(req.error);
      }),
      new Promise<StoredArtworkRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_ARTWORK, 'readonly');
        const req = tx.objectStore(STORE_ARTWORK).getAll();
        req.onsuccess = () => resolve((req.result as StoredArtworkRecord[]) ?? []);
        req.onerror = () => reject(req.error);
      }),
      new Promise<StoredTrackLyricsRecord[]>((resolve, reject) => {
        const tx = db.transaction(STORE_TRACK_LYRICS, 'readonly');
        const req = tx.objectStore(STORE_TRACK_LYRICS).getAll();
        req.onsuccess = () => resolve((req.result as StoredTrackLyricsRecord[]) ?? []);
        req.onerror = () => reject(req.error);
      }),
    ]);
    db.close();

    return {
      trackCount: tracks.length,
      audioBytes: tracks.reduce((sum, t) => sum + (t.sizeBytes || 0), 0),
      artworkCount: artworks.length,
      artworkBytes: artworks.reduce((sum, a) => sum + (a.blob?.size || 0), 0),
      customLyricsCount: customLyrics.length,
    };
  } catch {
    return {
      trackCount: 0,
      audioBytes: 0,
      artworkCount: 0,
      artworkBytes: 0,
      customLyricsCount: 0,
    };
  }
}

export async function clearStoredWebTracks(): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(
        [STORE_TRACKS, STORE_LYRICS, STORE_ARTWORK, STORE_TRACK_LYRICS],
        'readwrite'
      );
      tx.objectStore(STORE_TRACKS).clear();
      tx.objectStore(STORE_LYRICS).clear();
      tx.objectStore(STORE_ARTWORK).clear();
      tx.objectStore(STORE_TRACK_LYRICS).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();

    trackBlobUrlCache.forEach((u) => URL.revokeObjectURL(u));
    trackBlobUrlCache.clear();
    artworkBlobUrlCache.forEach((u) => URL.revokeObjectURL(u));
    artworkBlobUrlCache.clear();
  } catch {
    // Ignore
  }
}
