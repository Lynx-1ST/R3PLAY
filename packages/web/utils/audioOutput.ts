import settings from '@/web/states/settings'

type OutputAudioContext = AudioContext & { setSinkId?: (deviceId: string) => Promise<void> }
let context: OutputAudioContext | null = null

export async function setAudioOutput(deviceId: string, audio?: HTMLMediaElement) {
  if (audio) {
    if (typeof audio.setSinkId === 'function') await audio.setSinkId(deviceId)
    else if (deviceId) throw new Error('Audio output selection is unavailable')
  }
  if (context && typeof context.setSinkId === 'function') await context.setSinkId(deviceId)
}

export function registerAudioOutputContext(value: AudioContext) {
  context = value
  // Web Audio routes the analyser output through its own destination.
  // Keep it on the same device as the HTML audio element.
  void setAudioOutput(settings.audioOutputDeviceId).catch(error =>
    console.error('Audio output:', error)
  )
}
