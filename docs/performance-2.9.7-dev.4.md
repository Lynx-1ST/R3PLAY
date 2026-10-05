# Queue and visual-loop resource optimization

Continues the idle IPC/artwork work in [dev.3](performance-2.9.7.md). Audio source selection, bitrates, effects, artwork resolution and foreground animation cadence remain unchanged.

## Metadata reuse

Finite track metadata queries identify a sorted set of unique song IDs. Each caller selects its own original order, including duplicate occurrences, from the shared response. Infinite queries keep their separate shape. The persistent native metadata cache remains the first lookup; no new long-lived in-memory entity cache is introduced.

Controlled regression workload: 500 unique songs, 50 queue rotations and duplicate occurrences. Before: 50 metadata requests and 50 query-cache responses. After: one request and one response. Concurrent callers with differing orders also share one request and receive their own order. These counts describe an uncached synthetic workload, not an app-wide RAM percentage.

## Bounded and cancellable batches

Large metadata requests still fetch every song and privilege in chunks of at most 500. Up to four chunks run concurrently per list instead of starting the entire list at once. The query abort signal reaches the HTTP requests and removes waiting chunks when the list is no longer observed. Failure aborts the remaining chunks. This limits resource spikes; very large cold lists may need more request waves rather than one unrestricted burst.

The 10,000-song test returns all 10,000 songs/privileges using 20 requests with at most four in flight. Cancelling while four are active prevents the other sixteen chunks from being sent.

## Audio-reactive visuals

The ambient-volume loop retains its original decay when focus is lost, then parks after the displayed value reaches silence. Focus resumes the live analyser. Only playback-state changes can wake it; progress mutations no longer restart a deliberately idle loop. Foreground analyser cadence and audio routing are unchanged.

The regression reproduces the old loop continuing through 120 simulated unfocused frames with an outstanding callback. The new loop has no outstanding callback after its decay; a progress update keeps it parked and focus restores nonzero visual amplitude.

## Validation

- 156 renderer tests; renderer TypeScript check and lint of the changed runtime modules passed.
- Packaged Electron: 10,000-song playlist and 1,000-song album remain virtualized; real HTML audio crossfade overlap and outgoing cleanup passed; audio continued while minimized.
- Keyboard queue reorder preserves rendered order and sends no new metadata request.
- Existing dev.3 desktop checks remain applicable because this change only modifies renderer code.
