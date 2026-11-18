import test from 'node:test';
import assert from 'node:assert/strict';
import { ALBUMS, DEFAULT_PLAYLISTS, EQ_PRESETS, TRACKS } from '../data/catalog';
import {
  clampEqGain,
  enqueueTrackUnique,
  filterAlbums,
  filterTracks,
  findMatchingEqPreset,
  formatAlbumDuration,
  formatTimecode,
  getNextTrackId,
  getPreviousTrackId,
  moveQueueItem,
  validatePlaylistInput,
} from './musicLogic';

test('formatTimecode formats seconds into mm:ss', () => {
  assert.equal(formatTimecode(0), '00:00');
  assert.equal(formatTimecode(65), '01:05');
  assert.equal(formatTimecode(214), '03:34');
  assert.equal(formatTimecode(-5), '00:00');
});

test('formatAlbumDuration aggregates track lengths', () => {
  const obsidianTracks = TRACKS.filter((t) => t.albumId === 'alb-obsidian');
  assert.equal(formatAlbumDuration(obsidianTracks), '10m 58s');
});

test('filterTracks filters by genre and search query', () => {
  const jazzTracks = filterTracks(TRACKS, 'Jazz', '');
  assert.equal(jazzTracks.length, 3);
  assert.ok(jazzTracks.every((t) => t.genre === 'Jazz'));

  const searchResult = filterTracks(TRACKS, 'All', 'monolith');
  assert.equal(searchResult.length, 3);

  const combined = filterTracks(TRACKS, 'Acoustic', 'fern');
  assert.equal(combined.length, 1);
  assert.equal(combined[0].id, 'trk-06');
});

test('filterAlbums filters albums by genre and query', () => {
  const ambientAlbums = filterAlbums(ALBUMS, 'Ambient', '');
  assert.equal(ambientAlbums.length, 2);

  const byLabel = filterAlbums(ALBUMS, 'All', 'blue room');
  assert.equal(byLabel.length, 1);
  assert.equal(byLabel[0].id, 'alb-brass');
});

test('getNextTrackId respects repeat and shuffle modes', () => {
  const q = ['trk-01', 'trk-02', 'trk-03'];

  assert.equal(
    getNextTrackId({
      queueIds: q,
      currentTrackId: 'trk-01',
      repeatMode: 'off',
      shuffle: false,
    }),
    'trk-02'
  );

  // End of queue with repeat off returns null
  assert.equal(
    getNextTrackId({
      queueIds: q,
      currentTrackId: 'trk-03',
      repeatMode: 'off',
      shuffle: false,
    }),
    null
  );

  // End of queue with repeat all wraps to first
  assert.equal(
    getNextTrackId({
      queueIds: q,
      currentTrackId: 'trk-03',
      repeatMode: 'all',
      shuffle: false,
    }),
    'trk-01'
  );

  // Repeat one keeps current track
  assert.equal(
    getNextTrackId({
      queueIds: q,
      currentTrackId: 'trk-02',
      repeatMode: 'one',
      shuffle: false,
    }),
    'trk-02'
  );

  // Shuffle avoids repeating current track
  const shuffled = getNextTrackId({
    queueIds: q,
    currentTrackId: 'trk-02',
    repeatMode: 'off',
    shuffle: true,
    randomIndex: 0,
  });
  assert.notEqual(shuffled, 'trk-02');
});

test('getPreviousTrackId restarts current track after 3 seconds', () => {
  const q = ['trk-01', 'trk-02', 'trk-03'];

  assert.deepEqual(
    getPreviousTrackId({
      queueIds: q,
      currentTrackId: 'trk-02',
      currentTimeSec: 12,
      repeatMode: 'off',
    }),
    { trackId: 'trk-02', restartCurrent: true }
  );

  assert.deepEqual(
    getPreviousTrackId({
      queueIds: q,
      currentTrackId: 'trk-02',
      currentTimeSec: 1.5,
      repeatMode: 'off',
    }),
    { trackId: 'trk-01', restartCurrent: false }
  );
});

test('queue helpers reorder and enqueue uniquely', () => {
  assert.deepEqual(moveQueueItem(['a', 'b', 'c'], 0, 2), ['b', 'c', 'a']);
  assert.deepEqual(enqueueTrackUnique(['a', 'b'], 'b'), ['a', 'b']);
  assert.deepEqual(enqueueTrackUnique(['a', 'b'], 'c'), ['a', 'b', 'c']);
});

test('validatePlaylistInput rejects empty, short, and duplicate names', () => {
  assert.equal(validatePlaylistInput('   ', DEFAULT_PLAYLISTS).valid, false);
  assert.equal(validatePlaylistInput('A', DEFAULT_PLAYLISTS).valid, false);
  assert.equal(
    validatePlaylistInput('late night analog', DEFAULT_PLAYLISTS).valid,
    false
  );
  const ok = validatePlaylistInput('  Morning Tape  ', DEFAULT_PLAYLISTS);
  assert.equal(ok.valid, true);
  assert.equal(ok.trimmedName, 'Morning Tape');
});

test('EQ preset matching and gain clamping', () => {
  const warm = EQ_PRESETS.find((p) => p.id === 'warm-analog')!;
  assert.equal(findMatchingEqPreset(warm.bands, EQ_PRESETS), 'warm-analog');
  assert.equal(
    findMatchingEqPreset(
      { hz60: 7, hz230: 0, hz910: 0, hz3600: 0, hz14000: 0 },
      EQ_PRESETS
    ),
    null
  );
  assert.equal(clampEqGain(20), 12);
  assert.equal(clampEqGain(-18), -12);
  assert.equal(clampEqGain(2.4), 2.5);
});
