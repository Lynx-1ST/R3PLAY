import { describe, expect, it } from 'vitest'
import {
  moveQueueItem,
  readListeningSession,
  trackMatchesSearch,
} from '../../utils/listeningSession'

const track = {
  id: 2,
  name: 'Đường về',
  dt: 200000,
  ar: [{ id: 1, name: 'Nghệ sĩ' }],
  al: { id: 1, name: 'Album mùa hè', picUrl: '' },
} as Track

describe('listening sessions', () => {
  it('restores the exact shuffled queue, current index, zero volume, repeat and position', () => {
    const saved = {
      trackList: [3, 2, 1],
      originTrackList: [1, 2, 3],
      shuffle: true,
      _trackIndex: 1,
      _track: track,
      _progress: 85.5,
      _volume: 0,
      _repeatMode: 'one',
    }
    const restored = readListeningSession(saved)
    expect(restored).toMatchObject(saved)
    expect(restored.trackList).toEqual([3, 2, 1])
  })
  it('handles malformed storage and legacy player state without corrupting the queue', () => {
    expect(readListeningSession(null).trackList).toEqual([])
    expect(
      readListeningSession({ trackList: [1, '2', -1, null, 3], state: 'playing', _volume: 0 })
        .trackList
    ).toEqual([1, 3])
    expect(
      readListeningSession({ trackList: 'playing', _progress: Infinity, _trackIndex: 999 })
        ._progress
    ).toBe(0)
  })
  it('clamps index and position and discards mismatched cached track metadata', () => {
    expect(
      readListeningSession({ trackList: [2], _trackIndex: 999, _track: track, _progress: 999 })
        ._progress
    ).toBeCloseTo(199.9)
    expect(readListeningSession({ trackList: [1], _track: track })._track).toBeNull()
    expect(
      readListeningSession({ mode: 'fm', fmTrackList: [2], fmTrack: track, _progress: 30 }).fmTrack
    ).toEqual(track)
  })
})

describe('queue reordering', () => {
  it('keeps the playing occurrence when moving it or moving another song across it', () => {
    expect(moveQueueItem([1, 2, 3], 1, 1, 0)).toEqual({ queue: [2, 1, 3], index: 0 })
    expect(moveQueueItem([1, 2, 3], 1, 0, 2)).toEqual({ queue: [2, 3, 1], index: 0 })
    expect(moveQueueItem([1, 2, 3], 1, 2, 0)).toEqual({ queue: [3, 1, 2], index: 2 })
    expect(moveQueueItem([2, 1, 2], 2, 0, 2)).toEqual({ queue: [1, 2, 2], index: 1 })
  })
  it('rejects indices outside the queue', () => {
    expect(moveQueueItem([1], 0, 0, 1)).toBeNull()
    expect(moveQueueItem([1], 0, -1, 0)).toBeNull()
  })
})

describe('playlist search', () => {
  it('matches title, artist and album without case or Vietnamese accent sensitivity', () => {
    expect(trackMatchesSearch(track, 'DUONG ve')).toBe(true)
    expect(trackMatchesSearch(track, 'nghe si')).toBe(true)
    expect(trackMatchesSearch(track, 'mua he')).toBe(true)
    expect(trackMatchesSearch(track, 'duong nghe')).toBe(true)
    expect(trackMatchesSearch(track, 'other song')).toBe(false)
  })
})
