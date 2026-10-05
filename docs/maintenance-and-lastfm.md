# Playback, storage and Last.fm

## Settings

- **Experiments**: Crossfade is off by default. Enable it to select 1–12 seconds (default 3). The next queued song is prepared before the transition. Crossfade applies to automatic queue changes, skips repeat-one and Personal FM, and skips songs shorter than twice the selected duration. Manual selection, seeking and pausing cancel the overlap.
- **Experiments**: Background optimization is on by default. Minimized windows pause CSS animations and visual audio RAF updates; saved progress updates less often. Music and playback transitions continue.
- **Storage**: The audio cache defaults to 5 GB, with 1/2/5/10/20/50 GB limits. Least recently used files are evicted first. Active playback, open streams and recently served files can temporarily exceed the limit. Explicit cleanup preserves active playback and open streams.
- **Storage**: Packaged apps default to `audio_cache` beside the executable. If the installation directory is not writable, the app uses the user-data cache automatically. Users can choose a different folder; the saved choice takes priority and falls back to user data if it is no longer writable. Existing caches in previous locations are retained.
- **Diagnostics**: Refresh app memory, uptime and recent warnings/errors, or export a JSON report. Export redacts the cache directory, URLs, credentials, emails and local paths. It does not export raw settings or full logs.

Long track lists mount only nearby rows. The playlist and plain album/artist list use their existing scrolling container.

## Configure Last.fm

Put the application credentials in the root `.env` before building:

```dotenv
LASTFM_API_KEY=your_application_api_key
LASTFM_API_SECRET=your_application_api_secret
```

These are application credentials, not the listener's account password. Keep `.env` out of Git. The desktop build embeds the credentials in the main process; changing `.env` requires rebuilding. A desktop binary cannot guarantee secrecy for application credentials. They are not sent to the renderer, settings UI, or diagnostics.

For GitHub release builds, configure repository Actions secrets named `LASTFM_API_KEY` and `LASTFM_API_SECRET`. The Windows build workflow supplies these during compilation. Missing credentials leave login disabled with an explanatory message.

Open **Settings → Player → Last.fm**, click login, and authorize R3PLAYX in the browser. The app checks for completion while that settings section is open; the completion button also checks manually. Login uses Last.fm's desktop token flow. The account session is encrypted with Electron `safeStorage` before local storage.

Now Playing and scrobbling can be disabled independently of login. Actual listening time is counted; pauses, seeks and large clock gaps do not contribute. Songs longer than 30 seconds are submitted after half their duration or four minutes, whichever comes first. Failed submissions remain in a persistent FIFO queue (up to 500 entries) and retry with backoff. Disconnecting clears the account session and pending submissions.

References: [desktop authentication](https://www.last.fm/api/desktopauth), [scrobbling rules](https://www.last.fm/api/scrobbling).

## Validation

Unit tests cover LRU cleanup, playback protection, migration conflicts, diagnostic redaction, Last.fm signatures/auth cancellation/offline retries/listening eligibility, background activity, and queue crossfade cancellation. Packaged Electron verification uses an isolated profile, mocked metadata, real HTML audio, a 10,000-song playlist and a 1,000-song album. An actual Last.fm account authorization still requires configured application credentials and the user's browser grant.
