# Session and search improvements

Date: 2026-10-05

## Behavior

- Remote logout has a five-second timeout. A failed request still clears local
  cookies, desktop account data and cached user results. Mounted account views
  receive a guest state without requiring a successful network refetch.
- Root cookies are removed even when logout starts on a nested route. Cancelled
  account-cache and cookie-refresh requests cannot restore the old session.
- Daily check-in waits for both device types, propagates transport/API failures,
  and accepts code `-2` (already checked in), including HTTP 400 responses.
- Artist, album and playlist search tabs support Load more, retain previous
  results when the next page fails, and offer Retry for that same page. Changing
  keywords resets the pages; empty pages stop pagination.
- Search results use native links. Songs have labelled play buttons, visible
  keyboard focus and native Enter/Space activation. Global playback shortcuts
  respect native activation keys and events already handled by a component.
- Search tabs wrap on narrow screens; song rows retain readable titles and play
  controls. Search text remains visible in the mobile dark layout.

Pagination uses the existing React Query dependency and its
[official infinite-query contract](https://tanstack.com/query/latest/docs/framework/react/reference/functions/useInfiniteQuery).
No new dependency was added.

## Verification

- Web: 128 tests pass, including 21 new regression tests.
- Desktop: 628 tests pass.
- Web and desktop TypeScript checks pass; the Electron web production build passes.
- Real Chromium checks use deterministic local API responses, without account
  credentials: all three pagination tabs, failed next-page retry, song activation
  with Space, visible keyboard focus, and widths 1440, 768, 390 and 320 pixels.
- Browser checks found no console/page errors and no horizontal document overflow.
- Local screenshots and network/focus evidence: `.codex/qa/search-evidence/`.
- Changed API/test files pass ESLint. Existing UI lint issues remain: compared
  with the starting revision, CoverRowVirtual has 27 errors / 2 warnings (was
  28 / 2), Search has 3 / 2 (unchanged), and useApplyKeyboardShortcuts has 1 / 0
  (unchanged). The repository-wide lint gate is therefore not clean.
- Production builds retain the existing large-chunk warning.

Browser fixtures verify UI requests and interaction, not live NetEase availability
or playback of a real audio stream. The tests use the installed Vitest executable
directly because the shell's pnpm version differs from the project configuration.
