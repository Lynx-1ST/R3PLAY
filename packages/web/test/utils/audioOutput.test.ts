import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/web/states/settings', () => ({ default: { audioOutputDeviceId: '' } }))
beforeEach(() => vi.resetModules())

describe('audio output routing', () => {
  it('switches the HTML element when it has not been connected to Web Audio', async () => {
    const { setAudioOutput } = await import('../../utils/audioOutput')
    const setSinkId = vi.fn().mockResolvedValue(undefined)
    await setAudioOutput('speakers', { setSinkId } as unknown as HTMLMediaElement)
    expect(setSinkId).toHaveBeenCalledWith('speakers')
  })

  it.each(['running', 'suspended'])('switches only the context while %s', async state => {
    const { setAudioOutput, registerAudioOutputContext } = await import('../../utils/audioOutput')
    const elementSink = vi.fn().mockRejectedValue(new DOMException('Aborted', 'AbortError'))
    const contextSink = vi.fn().mockResolvedValue(undefined)
    const audio = { setSinkId: elementSink } as unknown as HTMLMediaElement
    const context = { setSinkId: contextSink, state } as unknown as AudioContext
    registerAudioOutputContext(context, audio)
    await setAudioOutput('speakers', audio)
    expect(contextSink).toHaveBeenLastCalledWith('speakers')
    expect(elementSink).not.toHaveBeenCalled()
  })

  it('routes a new track through its element until that element is connected', async () => {
    const { setAudioOutput, registerAudioOutputContext } = await import('../../utils/audioOutput')
    const contextSink = vi.fn().mockResolvedValue(undefined)
    registerAudioOutputContext(
      { setSinkId: contextSink, state: 'running' } as unknown as AudioContext,
      {} as HTMLMediaElement
    )
    contextSink.mockClear()
    const elementSink = vi.fn().mockResolvedValue(undefined)
    await setAudioOutput('headphones', { setSinkId: elementSink } as unknown as HTMLMediaElement)
    expect(elementSink).toHaveBeenCalledWith('headphones')
    expect(contextSink).not.toHaveBeenCalled()
  })

  it('propagates a routing failure without trying to change a connected element', async () => {
    const { setAudioOutput, registerAudioOutputContext } = await import('../../utils/audioOutput')
    const contextSink = vi.fn().mockResolvedValue(undefined)
    const elementSink = vi.fn()
    const audio = { setSinkId: elementSink } as unknown as HTMLMediaElement
    registerAudioOutputContext(
      { setSinkId: contextSink, state: 'running' } as unknown as AudioContext,
      audio
    )
    contextSink.mockRejectedValueOnce(new DOMException('Device removed', 'NotFoundError'))
    await expect(setAudioOutput('missing', audio)).rejects.toThrow('Device removed')
    expect(elementSink).not.toHaveBeenCalled()
  })
})
