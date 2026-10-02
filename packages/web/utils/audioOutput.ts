import settings from '@/web/states/settings'

type OutputAudioContext = AudioContext & { setSinkId?: (deviceId: string) => Promise<void> }
let context: OutputAudioContext | null = null
const routedElements = new WeakMap<HTMLMediaElement, OutputAudioContext>()

export async function setAudioOutput(deviceId: string, audio?: HTMLMediaElement) {
  const outputContext = audio ? routedElements.get(audio) : context
  if (outputContext && outputContext.state !== 'closed') {
    if (typeof outputContext.setSinkId === 'function') await outputContext.setSinkId(deviceId)
    else if (deviceId) throw new Error('Web Audio output selection is unavailable')
    return
  }
  if (audio) {
    if (typeof audio.setSinkId === 'function') await audio.setSinkId(deviceId)
    else if (deviceId) throw new Error('Audio output selection is unavailable')
  }
}

export function registerAudioOutputContext(value: AudioContext, audio?: HTMLMediaElement) {
  context = value
  if (audio) routedElements.set(audio, value)
  // Web Audio routes the analyser output through its own destination.
  // Keep it on the same device as the HTML audio element.
  void setAudioOutput(settings.audioOutputDeviceId, audio).catch(error =>
    console.error('Audio output:', error)
  )
}
