import test from 'node:test';
import assert from 'node:assert/strict';
import type { Playlist, Track } from '../types/music';
import {
  clampEqGainDb,
  deduplicateTracks,
  deriveMetadataFromFilename,
  enqueueTrackUnique,
  estimateBitrateKbps,
  filterExcludedFolders,
  filterTracks,
  findActiveLyricIndex,
  formatAlbumDuration,
  formatFileSize,
  formatRemainingSleepTimer,
  formatTimecode,
  getNextTrackId,
  getPreviousTrackId,
  getRecentlyAddedTracks,
  groupTracksIntoAlbums,
  groupTracksIntoArtists,
  groupTracksIntoFolders,
  moveQueueItem,
  parseLrcLyrics,
  playNextInQueue,
  sortTracks,
  validatePlaylistInput,
} from './musicLogic';
import { parseAudioBinaryTags } from './audioMetadataParser';

const SAMPLE_TRACKS: Track[] = [
  {
    id: 'ms-1',
    uri: 'content://media/external/audio/media/1',
    filePath: '/storage/emulated/0/Music/Ambient/01 - Dawn.flac',
    title: 'Dawn Study',
    artist: 'Henrik Solberg',
    album: 'Winter Tape',
    albumId: 'alb-10',
    durationSec: 215,
    durationMs: 215000,
    trackNumber: 1,
    mimeType: 'audio/flac',
    formatLabel: 'FLAC',
    sizeBytes: 24_500_000,
    dateAdded: 1700000100,
    folderPath: 'Music/Ambient/',
    folderName: 'Ambient',
    artworkPath: '',
    artworkUrl: '',
    source: 'android',
  },
  {
    id: 'ms-2',
    uri: 'content://media/external/audio/media/2',
    filePath: '/storage/emulated/0/Music/Jazz/02 - Brass.mp3',
    title: 'Midnight Brass',
    artist: 'Julian Mercer',
    album: 'Ampex 04',
    albumId: 'alb-20',
    durationSec: 180,
    durationMs: 180000,
    trackNumber: 2,
    mimeType: 'audio/mpeg',
    formatLabel: 'MP3',
    sizeBytes: 7_200_000,
    dateAdded: 1700000200,
    folderPath: 'Music/Jazz/',
    folderName: 'Jazz',
    artworkPath: '',
    artworkUrl: '',
    source: 'android',
  },
  {
    id: 'ms-3',
    uri: 'content://media/external/audio/media/3',
    filePath: '/storage/emulated/0/Music/Ambient/02 - Frost.flac',
    title: 'Frost Line',
    artist: 'Henrik Solberg',
    album: 'Winter Tape',
    albumId: 'alb-10',
    durationSec: 260,
    durationMs: 260000,
    trackNumber: 2,
    mimeType: 'audio/flac',
    formatLabel: 'FLAC',
    sizeBytes: 29_100_000,
    dateAdded: 1700000050,
    folderPath: 'Music/Ambient/',
    folderName: 'Ambient',
    artworkPath: '',
    artworkUrl: '',
    source: 'android',
  },
];

test('formatTimecode, formatAlbumDuration, and formatFileSize format accurately', () => {
  assert.equal(formatTimecode(0), '00:00');
  assert.equal(formatTimecode(215), '03:35');
  assert.equal(formatTimecode(3665), '1:01:05');
  assert.equal(formatAlbumDuration(SAMPLE_TRACKS), '10m 55s');
  assert.equal(formatFileSize(512), '512 B');
  assert.equal(formatFileSize(2048), '2.0 KB');
  assert.equal(formatFileSize(5 * 1024 * 1024), '5.0 MB');
});

test('deriveMetadataFromFilename extracts track number, artist, title, and format', () => {
  const parsed = deriveMetadataFromFilename('04 - Maren Lindqvist - Vermilion Line.flac');
  assert.equal(parsed.trackNumber, 4);
  assert.equal(parsed.artist, 'Maren Lindqvist');
  assert.equal(parsed.title, 'Vermilion Line');
  assert.equal(parsed.formatLabel, 'FLAC');

  const simple = deriveMetadataFromFilename('field_recording.wav');
  assert.equal(simple.artist, 'Unknown Artist');
  assert.equal(simple.title, 'field_recording');
  assert.equal(simple.formatLabel, 'WAV');
});

test('deduplicateTracks removes duplicate URIs and IDs', () => {
  const duped = [...SAMPLE_TRACKS, { ...SAMPLE_TRACKS[0], id: 'ms-dup' }];
  const deduped = deduplicateTracks(duped);
  assert.equal(deduped.length, 3);
});

test('filterTracks and sortTracks work across all sort fields', () => {
  assert.equal(filterTracks(SAMPLE_TRACKS, 'julian').length, 1);
  assert.equal(filterTracks(SAMPLE_TRACKS, 'ambient').length, 2);

  const byDurationDesc = sortTracks(SAMPLE_TRACKS, 'duration', 'desc');
  assert.equal(byDurationDesc[0].id, 'ms-3');
  assert.equal(byDurationDesc[2].id, 'ms-2');

  const byDateDesc = sortTracks(SAMPLE_TRACKS, 'dateAdded', 'desc');
  assert.equal(byDateDesc[0].id, 'ms-2');
});

test('grouping helpers build Albums, Artists, and Folders', () => {
  const albums = groupTracksIntoAlbums(SAMPLE_TRACKS);
  assert.equal(albums.length, 2);
  assert.equal(albums.find((a) => a.id === 'alb-10')?.trackIds.length, 2);

  const artists = groupTracksIntoArtists(SAMPLE_TRACKS);
  assert.equal(artists.length, 2);
  assert.equal(artists[0].name, 'Henrik Solberg');
  assert.equal(artists[0].albumIds.length, 1);

  const folders = groupTracksIntoFolders(SAMPLE_TRACKS);
  assert.equal(folders.length, 2);
  assert.equal(folders[0].name, 'Ambient');
  assert.equal(folders[0].trackIds.length, 2);
});

test('queue and playback navigation helpers behave deterministically', () => {
  const q = ['ms-1', 'ms-2', 'ms-3'];
  assert.equal(
    getNextTrackId({ queueIds: q, currentTrackId: 'ms-3', repeatMode: 'off', shuffle: false }),
    null
  );
  assert.equal(
    getNextTrackId({ queueIds: q, currentTrackId: 'ms-3', repeatMode: 'all', shuffle: false }),
    'ms-1'
  );
  assert.equal(
    getNextTrackId({ queueIds: q, currentTrackId: 'ms-2', repeatMode: 'one', shuffle: false }),
    'ms-2'
  );
  assert.deepEqual(
    getPreviousTrackId({ queueIds: q, currentTrackId: 'ms-2', currentTimeSec: 12, repeatMode: 'off' }),
    { trackId: 'ms-2', restartCurrent: true }
  );
  assert.deepEqual(
    getPreviousTrackId({ queueIds: q, currentTrackId: 'ms-2', currentTimeSec: 1.2, repeatMode: 'off' }),
    { trackId: 'ms-1', restartCurrent: false }
  );

  assert.deepEqual(playNextInQueue(['ms-1', 'ms-2'], 'ms-1', 'ms-3'), ['ms-1', 'ms-3', 'ms-2']);
  assert.deepEqual(moveQueueItem(['ms-1', 'ms-2', 'ms-3'], 2, 0), ['ms-3', 'ms-1', 'ms-2']);
  assert.deepEqual(enqueueTrackUnique(['ms-1'], 'ms-1'), ['ms-1']);
});

test('validatePlaylistInput handles rename ignore ID and duplicates', () => {
  const existing: Playlist[] = [
    { id: 'pl-1', name: 'Road Trip', description: '', trackIds: [], createdAt: '', updatedAt: '' },
  ];
  assert.equal(validatePlaylistInput('', existing).valid, false);
  assert.equal(validatePlaylistInput('road trip', existing).valid, false);
  assert.equal(validatePlaylistInput('Road Trip', existing, 'pl-1').valid, true);
});

test('parseLrcLyrics parses synced LRC timestamps and finds active line', () => {
  const lrc = `
[ti:Dawn Study]
[ar:Henrik Solberg]
[00:05.00]First line opens
[00:12.50]Second line echoes
[00:25.00]Final chorus
`;
  const parsed = parseLrcLyrics(lrc);
  assert.equal(parsed.synced, true);
  assert.equal(parsed.lines.length, 3);
  assert.equal(findActiveLyricIndex(parsed.lines, 2), -1);
  assert.equal(findActiveLyricIndex(parsed.lines, 7), 0);
  assert.equal(findActiveLyricIndex(parsed.lines, 14), 1);
  assert.equal(findActiveLyricIndex(parsed.lines, 30), 2);
});

test('clampEqGainDb clamps between -12 and +12 dB', () => {
  assert.equal(clampEqGainDb(-20), -12);
  assert.equal(clampEqGainDb(18), 12);
  assert.equal(clampEqGainDb(3.3), 3.5);
});

test('filterExcludedFolders and getRecentlyAddedTracks filter and sort accurately', () => {
  const visible = filterExcludedFolders(SAMPLE_TRACKS, ['Music/Jazz/']);
  assert.equal(visible.length, 2);
  assert.equal(visible.some((t) => t.id === 'ms-2'), false);

  const recent = getRecentlyAddedTracks(SAMPLE_TRACKS, 2);
  assert.equal(recent.length, 2);
  assert.equal(recent[0].id, 'ms-2');
  assert.equal(recent[1].id, 'ms-1');
});

test('estimateBitrateKbps and formatRemainingSleepTimer compute clean telemetry', () => {
  assert.equal(estimateBitrateKbps(7_200_000, 180), 320);
  assert.equal(estimateBitrateKbps(7_200_000, 180, 1411), 1411);
  assert.equal(formatRemainingSleepTimer(100_000, 100_000), '');
  assert.equal(formatRemainingSleepTimer(165_000, 100_000), '01:05');
});

test('parseAudioBinaryTags extracts ID3v2 title, artist, album, and lyrics', () => {
  const makeFrame = (id: string, text: string): number[] => {
    const enc = new TextEncoder().encode(text);
    const size = 1 + enc.length;
    return [
      ...id.split('').map((c) => c.charCodeAt(0)),
      (size >>> 24) & 0xff,
      (size >>> 16) & 0xff,
      (size >>> 8) & 0xff,
      size & 0xff,
      0,
      0,
      3, // UTF-8
      ...enc,
    ];
  };

  const usltPayload = [
    3, // UTF-8
    0x65, 0x6e, 0x67, // eng
    0, // empty descriptor
    ...new TextEncoder().encode('[00:01.00]Hello from ID3'),
  ];
  const usltFrame = [
    ...'USLT'.split('').map((c) => c.charCodeAt(0)),
    (usltPayload.length >>> 24) & 0xff,
    (usltPayload.length >>> 16) & 0xff,
    (usltPayload.length >>> 8) & 0xff,
    usltPayload.length & 0xff,
    0,
    0,
    ...usltPayload,
  ];

  const body = [
    ...makeFrame('TIT2', 'Tape Study'),
    ...makeFrame('TPE1', 'Klara Nyman'),
    ...makeFrame('TALB', 'Nordic Room'),
    ...usltFrame,
  ];
  const tagSize = body.length;
  const header = [
    0x49, 0x44, 0x33, 3, 0, 0,
    (tagSize >> 21) & 0x7f,
    (tagSize >> 14) & 0x7f,
    (tagSize >> 7) & 0x7f,
    tagSize & 0x7f,
  ];
  const bytes = new Uint8Array([...header, ...body]);
  const parsed = parseAudioBinaryTags(bytes.buffer);
  assert.equal(parsed.title, 'Tape Study');
  assert.equal(parsed.artist, 'Klara Nyman');
  assert.equal(parsed.album, 'Nordic Room');
  assert.equal(parsed.lyrics, '[00:01.00]Hello from ID3');
});

test('parseLrcLyrics handles BOM, [offset:], 1-digit tenths, and enhanced LRC tags', () => {
  const lrc =
    '\uFEFF[offset:+500]\n' +
    '[ar:Test Artist]\n' +
    '[00:05.5]<00:05.50>Half second <00:06.10>line\n' +
    '[00:10.250]Quarter second line\n';
  const parsed = parseLrcLyrics(lrc);
  assert.equal(parsed.synced, true);
  assert.equal(parsed.lines.length, 2);
  // LRC spec: +offset shifts lyric timestamps earlier (subtract offsetSec)
  assert.equal(parsed.lines[0].timeSec, 5.0);
  assert.equal(parsed.lines[0].text, 'Half second line');
  assert.equal(parsed.lines[1].timeSec, 9.75);

  const delayed = parseLrcLyrics('[offset:-250]\n[00:10.250]Delayed line');
  assert.equal(delayed.lines[0].timeSec, 10.5);
});

test('parseAudioBinaryTags extracts APIC artwork, prefers Front Cover, rejects URL APIC, and handles unsync', () => {
  const pngMagic = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00];
  const jpgMagic = [0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10];

  const makeApic = (mime: string, picType: number, imgBytes: number[]): number[] => {
    const payload = [
      0, // latin1
      ...new TextEncoder().encode(mime),
      0,
      picType,
      0, // empty desc
      ...imgBytes,
    ];
    return [
      ...'APIC'.split('').map((c) => c.charCodeAt(0)),
      (payload.length >>> 24) & 0xff,
      (payload.length >>> 16) & 0xff,
      (payload.length >>> 8) & 0xff,
      payload.length & 0xff,
      0,
      0,
      ...payload,
    ];
  };

  const bodyRaw = [
    ...makeApic('-->', 3, [0x68, 0x74, 0x74, 0x70]),
    ...makeApic('image/jpeg', 0, jpgMagic),
    ...makeApic('image/png', 3, pngMagic),
  ];

  const unsyncedBody: number[] = [];
  for (let i = 0; i < bodyRaw.length; i++) {
    unsyncedBody.push(bodyRaw[i]);
    if (bodyRaw[i] === 0xff) {
      unsyncedBody.push(0x00);
    }
  }

  const tagSize = unsyncedBody.length;
  const header = [
    0x49, 0x44, 0x33, 3, 0, 0x80,
    (tagSize >> 21) & 0x7f,
    (tagSize >> 14) & 0x7f,
    (tagSize >> 7) & 0x7f,
    tagSize & 0x7f,
  ];

  const parsed = parseAudioBinaryTags(new Uint8Array([...header, ...unsyncedBody]).buffer);
  assert.equal(parsed.artworkMime, 'image/png');
  assert.deepEqual(Array.from(parsed.artworkBytes || []), pngMagic);
});

test('parseAudioBinaryTags supports ID3v2.2 frames (TT2, TP1, ULT, PIC)', () => {
  const makeV22Text = (id: string, text: string): number[] => {
    const enc = new TextEncoder().encode(text);
    const size = 1 + enc.length;
    return [
      ...id.split('').map((c) => c.charCodeAt(0)),
      (size >>> 16) & 0xff,
      (size >>> 8) & 0xff,
      size & 0xff,
      3,
      ...enc,
    ];
  };
  const jpgBytes = [0xff, 0xd8, 0xff, 0xe1, 0x11, 0x22];
  const picPayload = [0, 0x4a, 0x50, 0x47, 3, 0, ...jpgBytes];
  const picFrame = [
    ...'PIC'.split('').map((c) => c.charCodeAt(0)),
    (picPayload.length >>> 16) & 0xff,
    (picPayload.length >>> 8) & 0xff,
    picPayload.length & 0xff,
    ...picPayload,
  ];
  const ultPayload = [3, 0x65, 0x6e, 0x67, 0, ...new TextEncoder().encode('[00:02.00]V2.2 lyric')];
  const ultFrame = [
    ...'ULT'.split('').map((c) => c.charCodeAt(0)),
    (ultPayload.length >>> 16) & 0xff,
    (ultPayload.length >>> 8) & 0xff,
    ultPayload.length & 0xff,
    ...ultPayload,
  ];
  const body = [...makeV22Text('TT2', 'V22 Title'), ...makeV22Text('TP1', 'V22 Artist'), ...ultFrame, ...picFrame];
  const tagSize = body.length;
  const header = [
    0x49, 0x44, 0x33, 2, 0, 0,
    (tagSize >> 21) & 0x7f,
    (tagSize >> 14) & 0x7f,
    (tagSize >> 7) & 0x7f,
    tagSize & 0x7f,
  ];
  const parsed = parseAudioBinaryTags(new Uint8Array([...header, ...body]).buffer);
  assert.equal(parsed.title, 'V22 Title');
  assert.equal(parsed.artist, 'V22 Artist');
  assert.equal(parsed.lyrics, '[00:02.00]V2.2 lyric');
  assert.equal(parsed.artworkMime, 'image/jpeg');
  assert.deepEqual(Array.from(parsed.artworkBytes || []), jpgBytes);
});

test('parseAudioBinaryTags extracts OGG OpusTags metadata, lyrics, and METADATA_BLOCK_PICTURE', () => {
  const pngBytes = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3];
  const u32be = (n: number) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  const u32le = (n: number) => [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff];
  const mime = new TextEncoder().encode('image/png');
  const flacPic = new Uint8Array([
    ...u32be(3),
    ...u32be(mime.length),
    ...mime,
    ...u32be(0),
    ...u32be(1), ...u32be(1), ...u32be(24), ...u32be(0),
    ...u32be(pngBytes.length),
    ...pngBytes,
  ]);
  const picB64 = Buffer.from(flacPic).toString('base64');

  const comments = [
    'TITLE=Opus Nocturne',
    'ARTIST=Elena Lind',
    'LYRICS=[00:01.00]Ogg lyric line',
    `METADATA_BLOCK_PICTURE=${picB64}`,
  ].map((s) => new TextEncoder().encode(s));

  const vendor = new TextEncoder().encode('test');
  const payload: number[] = [
    ...new TextEncoder().encode('OpusTags'),
    ...u32le(vendor.length),
    ...vendor,
    ...u32le(comments.length),
    ...comments.flatMap((c) => [...u32le(c.length), ...c]),
  ];

  const segments: number[] = [];
  let rem = payload.length;
  while (rem >= 255) {
    segments.push(255);
    rem -= 255;
  }
  segments.push(rem);

  const oggPage = new Uint8Array([
    0x4f, 0x67, 0x67, 0x53,
    0, 0,
    0, 0, 0, 0, 0, 0, 0, 0,
    1, 0, 0, 0,
    1, 0, 0, 0,
    0, 0, 0, 0,
    segments.length,
    ...segments,
    ...payload,
  ]);

  const parsed = parseAudioBinaryTags(oggPage.buffer);
  assert.equal(parsed.title, 'Opus Nocturne');
  assert.equal(parsed.artist, 'Elena Lind');
  assert.equal(parsed.lyrics, '[00:01.00]Ogg lyric line');
  assert.equal(parsed.artworkMime, 'image/png');
  assert.deepEqual(Array.from(parsed.artworkBytes || []), pngBytes);
});
