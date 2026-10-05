# Audio fixture

`tone.webm` is a short synthetic oscillator recorded with Chromium MediaRecorder (`audio/webm;codecs=opus`, 128 kbps). It contains no song or user data. Tests parse it with the real music-metadata implementation, cache identical bytes and verify range playback. The packaged Electron release smoke test uses it too.
