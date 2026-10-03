import { open } from 'node:fs/promises'

// Give parseFile a codec extension to avoid runtime MIME-loader differences for
// .tmp files. The parser still validates content; only 64 bytes are buffered here.
export async function detectAudioExtension(fileName: string): Promise<string> {
  const file = await open(fileName, 'r')
  try {
    const header = Buffer.alloc(64)
    const { bytesRead } = await file.read(header, 0, header.length, 0)
    if (bytesRead < 12) throw new Error('Audio file is too small')
    const magic = header.toString('ascii', 0, 4)
    if (magic === 'fLaC') return 'flac'
    if (magic === 'OggS') return 'ogg'
    if (magic === 'RIFF' && header.toString('ascii', 8, 12) === 'WAVE') return 'wav'
    if (header.toString('ascii', 4, 8) === 'ftyp') return 'm4a'
    if (header.toString('ascii', 0, 3) === 'ID3') return 'mp3'
    if (header[0] === 0xff && (header[1] & 0xe0) === 0xe0)
      return (header[1] & 0xf6) === 0xf0 ? 'aac' : 'mp3'
    throw new Error('Unsupported audio signature')
  } finally {
    await file.close()
  }
}
