import { expect, it } from 'vitest'
import { matchLastFmTrack } from '../../utils/lastfmMatch'
const song = (id: number, name: string, artist: string, album = 'Album') =>
  ({ id, name, ar: [{ name: artist }], al: { name: album } }) as Track
it('matches title and artist rather than blindly playing the first search result', () => {
  const target = { name: 'Believe', artist: 'Cher', album: '' }
  expect(
    matchLastFmTrack(target, [song(1, 'Believe', 'Other'), song(2, 'BELIEVE', 'Cher')])?.id
  ).toBe(2)
  expect(matchLastFmTrack(target, [song(1, 'Believe (Live)', 'Cher')])).toBeUndefined()
})
it('resolves only a unique album match and rejects ambiguous recordings', () => {
  const songs = [song(1, 'Song', 'Artist', 'First'), song(2, 'Song', 'Artist', 'Second')]
  expect(matchLastFmTrack({ name: 'Song', artist: 'Artist', album: 'Second' }, songs)?.id).toBe(2)
  expect(matchLastFmTrack({ name: 'Song', artist: 'Artist', album: '' }, songs)).toBeUndefined()
})
it('supports Unicode and punctuation while retaining version and accent distinctions', () => {
  expect(
    matchLastFmTrack({ name: 'Đêm – nay', artist: 'Nghệ sĩ', album: '' }, [
      song(1, 'Đêm-nay', 'Nghệ sĩ'),
    ])?.id
  ).toBe(1)
  expect(
    matchLastFmTrack({ name: 'ma', artist: 'Artist', album: '' }, [song(1, 'má', 'Artist')])
  ).toBeUndefined()
})
