# R3PLAY stability, security and CI pass

Date: 2026-10-03. Base: `origin/dev` at `52bc0ee` (v2.8.9).
Work was performed on the existing `codex/fix-windows-runtime` checkout. The four
pre-existing `packages/web/pages/My/` edits and other pre-existing untracked files
were preserved and excluded from the stability commits. No app version, remote
branch, tag or GitHub Release was changed or published.

## Findings and fixes

| Area                 | Finding                                                                                                                                                                        | Change                                                                                                                                                                                                                                                                                                                                                         |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Large playlists      | Chunking replaced the caller's `params.ids`; async consumers could see another chunk's IDs.                                                                                    | Each request receives a fresh object and sliced IDs. Removed the redundant Promise wrapper. `Promise.all()` preserves chunk order, including when requests finish out of order.                                                                                                                                                                                |
| Track cache          | Missing/malformed params could throw; zero, negative, fractional, infinite and unsafe IDs were accepted. Empty writes could reach `Object.keys(data[0])`.                      | Require CSV input for reads and positive safe integer IDs after conversion. Validate numeric song IDs before writes and ignore empty responses. Build a Map to restore requested order and support repeated IDs.                                                                                                                                               |
| SQL                  | `findMany()` and `deleteMany()` embedded key values into SQL and produced invalid SQL for empty lists. OR expressions also hit SQLite's expression depth limit on large lists. | Use `IN` with bound `?` values, and make empty lists safe no-ops. Tests use the real SQLite engine and 1,201 IDs. Table identifiers remain internal typed constants.                                                                                                                                                                                           |
| Artist cache         | The second `CacheAPIs.Artist` case was unreachable.                                                                                                                            | Removed it after tracing `useArtist()` and `useArtists()`: both use the single-artist `{ id }` contract, and no bulk artist enum/contract exists. The surviving artist result is covered by a test.                                                                                                                                                            |
| Navigation           | Hostname substring checks allowed GitHub lookalikes; main-window navigation was unrestricted.                                                                                  | Parse URLs, compare the exact local origin, block external navigation and redirects, deny new renderer windows, and open only HTTP(S) links on `github.com` or `www.github.com` in the OS browser. Reject credentials and malformed URLs. Register guards before the initial load.                                                                             |
| IPC                  | Most renderer handlers lacked sender/frame checks.                                                                                                                             | Central `trustedListener()` checks the intended live window and main frame for every active `on`/`handle` registration in `ipcMain.ts`. Invalid synchronous requests receive `null`. The remaining Touch Bar IPC listener uses the same guard. Native tray/menu/taskbar callbacks are untouched.                                                               |
| Dev checks           | Direct pushes to `dev` did not trigger checks, and tests were omitted.                                                                                                         | Add `push: dev`, retain PR/manual triggers and cancellation concurrency, use Windows, install frozen dependencies, typecheck both clients, build server, run complete web/desktop Vitest suites and the audio-cache script. No packaging on dev pushes.                                                                                                        |
| Release              | Publishing happened on release-branch pushes; notes and release titles contained old-version special cases.                                                                    | Publish only on `v*` tag pushes. Derive tag/title/notes once from root version; reject a mismatched tag, desktop version, missing notes or prerelease version before building. Keep Windows typechecks, all tests, builds, x64 packaging, runtime/startup smoke tests, artifacts and publishing. Upload artifacts before publishing. Require updater metadata. |
| Legacy configuration | Unused unstable workflow targeted two obsolete branches and three platforms with old tooling.                                                                                  | Remove the workflow. Change desktop `package:test` to Windows x64 directory packaging. No macOS/Linux application packaging work.                                                                                                                                                                                                                              |
| Lockfiles            | Root npm lockfile duplicated pnpm dependency management.                                                                                                                       | Delete only root `package-lock.json`; keep its ignore rule and runtime exception. Preserve `packages/desktop/runtime/package-lock.json`, which `prepareRuntime.js` intentionally uses with `npm ci`. Stop ignoring the tracked pnpm lockfile.                                                                                                                  |
| Test tooling         | Desktop Vitest 0.26.3 had a critical UI-server advisory and differed from the web runner.                                                                                      | Upgrade desktop Vitest/UI to the web's existing 4.1.10 version, update pnpm lockfile and add a desktop test alias config. No production dependency or app version upgrade.                                                                                                                                                                                     |

Clarification: JavaScript `Array.prototype.includes(NaN)` does detect NaN. The
original issue was incomplete validation, rather than NaN equality alone.

The navigation and sender checks follow [Electron's security guidance](https://www.electronjs.org/docs/latest/tutorial/security).
The test-tool upgrade addresses [Vitest's UI-server advisory](https://github.com/vitest-dev/vitest/security/advisories/GHSA-5xrq-8626-4rwp).

## Files changed

- `packages/web/api/hooks/useTracks.ts`
- `packages/web/test/api/longTracks.test.ts` (new)
- `packages/desktop/main/cache.ts`
- `packages/desktop/main/db.ts`
- `packages/desktop/main/index.ts`
- `packages/desktop/main/ipcMain.ts`
- `packages/desktop/main/touchBar.ts`
- `packages/desktop/main/utils/rendererSecurity.ts` (new)
- `packages/desktop/main/utils/trustedIpc.ts` (new)
- `packages/desktop/test/cache.test.ts` (new)
- `packages/desktop/test/db.test.ts` (new)
- `packages/desktop/test/ipcMain.test.ts` (new)
- `packages/desktop/test/rendererSecurity.test.ts` (new)
- `packages/desktop/vitest.config.ts` (new)
- `packages/desktop/package.json`
- `pnpm-lock.yaml`
- `.github/workflows/check.yml`
- `.github/workflows/build.yaml`
- `.github/workflows/build-unstable-dev.yml` (deleted)
- `.gitignore`
- `package-lock.json` (deleted)
- `docs/audio-cache-v2.9.md` (new)
- `docs/stability-security-ci-pass.md` (this report)

## Tests and local validation

Added 59 regression tests: eight playlist tests, 19 cache tests, two real SQLite
bulk-query tests, 26 URL/IPC helper tests and four IPC registration tests. Playlist
cases include 0, 1, 499, 500, 501 and 1,201 tracks, immutable inputs, merged privileges,
out-of-order completion and request failure. Cache tests include malformed/string IDs,
NaN, negative/zero/unsafe/fractional/infinite IDs, repeated IDs, missing rows, empty
writes and the single-artist contract. IPC registration tests exercise every registered
handler with another window, a subframe or missing frame, plus trusted side effects
and invoke results.

Commands below used `npx --yes pnpm@8.6.12` because the environment's default pnpm
11.25.0 cannot read this pnpm 8 lockfile. CI already pins 8.6.12. Local Node was
24.21.0 on Windows; the workflows use Node 22. Hosted Actions have not been run.

| Check                                                         | Result                                                                                                                            |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` after the tooling update     | Passed, including desktop native binding setup and Prisma generation.                                                             |
| Web and desktop `test:types`                                  | Both passed.                                                                                                                      |
| Server build                                                  | Passed.                                                                                                                           |
| All web Vitest tests                                          | 70 passed across 11 files.                                                                                                        |
| All desktop Vitest tests                                      | 65 passed across seven files.                                                                                                     |
| Desktop `test:cache`                                          | Six passed, including FLAC metadata, ranges/HEAD, variant migration, unblock expiry, media CORS and effects filenames.            |
| Desktop `test:discord`                                        | Five passed.                                                                                                                      |
| `pnpm build`                                                  | All three workspaces passed. Existing large web-chunk/deprecation warnings remain.                                                |
| Windows x64 electron-builder, `--publish never`               | Passed; generated `R3PLAYX-2.8.9-win-x64-Setup.exe`, blockmap, `latest.yml` and `win-unpacked`.                                   |
| Packaged `testRuntime.cjs` using Electron as Node             | Passed.                                                                                                                           |
| Packaged `testStartup.cjs`                                    | Passed: SQLite initialization, API, web page and download validation.                                                             |
| Workflow YAML/trigger inspection                              | Parsed successfully; dev/PR checks and Windows tag-only release triggers verified.                                                |
| Actual release metadata PowerShell block in isolated fixtures | Valid case passed; missing notes, wrong tag, wrong desktop version and prerelease version were rejected with the intended errors. |
| New test/helper/config ESLint and diff whitespace checks      | Passed.                                                                                                                           |

The existing modified application files still contain 20 baseline ESLint errors.
Linting the original HEAD versions of those same six files produced 24 errors;
this pass reduced that count and added no lint errors. Avoided unrelated cleanup
of existing `any`, require, unused-variable and empty-block issues.

## Remaining issues and follow-up

Audio downloading remains unchanged for v2.8.x because privileged streaming requires
new URL/redirect trust rules, header parity, concurrency and file/DB failure handling.
The separate [v2.9 proposal](audio-cache-v2.9.md) records the observed memory duplication,
stream-to-temp/hash/metadata/atomic-rename design, preservation of every quality field,
range playback and nonblocking failure semantics.

Dependency audits at the end of the first pass were **not clean**. That pnpm audit reported zero critical,
56 high, 39 moderate and six low advisories across the workspace dependency graph.
The separate runtime `npm audit` reports five high and zero critical entries
(`@neteasecloudmusicapienhanced/api`, `basic-ftp`, `get-uri`, `node-forge`,
`pac-proxy-agent`), with no npm-proposed fix. Counts across those audits overlap and
should not be added together. Triage runtime reachability and upstream patches
before declaring the release security-clean. Broad dependency upgrades/overrides
were left out because they could change proxy, media, metadata and packaged API
compatibility. The old Vitest critical advisory was resolved in this pass.

The subsequent [dependency security follow-up](dependency-security-followup.md)
records patched networking dependencies, the newer Electron runtime, regression
tests and updated audit results. Use that follow-up for the current dependency status.

CI configuration and release guards were verified locally, but GitHub Actions,
GitHub publishing, branch protection and authenticated updater delivery were not
exercised. No tag was pushed and no Release was created. Packaging was unsigned
development validation, not confirmation of production code signing. The working
checkout also contained the user's existing UI edits, so the local packaged artifact
includes them; the stability commits exclude those edits.

Recommended next work: triage the remaining shipped dependency advisories before
release, run the hosted Windows checks after pushing these commits, and land the
streaming audio-cache refactor with failure-path and packaged playback tests in v2.9.

## Remote branch review

Fetched origin and compared the named remote refs to `origin/dev` at `52bc0ee`.
Behind/ahead are commit counts, not file counts. No remote branch was deleted or merged.

| Remote branch                   | Behind dev | Unique commits ahead | Classification                                                                                      |
| ------------------------------- | ---------: | -------------------: | --------------------------------------------------------------------------------------------------- |
| `codex/fix-windows-runtime`     |          0 |                    0 | Identical to dev before this local stability pass.                                                  |
| `copilot/fix-build-windows-job` |         10 |                    1 | Diverged; the unique commit is `ea03c77 Initial plan`. Review its diff before deciding on deletion. |
| `docs/readme-en-vi`             |         58 |                    0 | Fully behind dev.                                                                                   |
| `feat/android-mvp`              |          6 |                    0 | Fully behind dev. No Android work performed.                                                        |
| `fix/stability-vietnamese`      |         57 |                   32 | Diverged; requires individual commit review. Do not merge blindly.                                  |

## Logical commit breakdown

1. `fix(web): avoid mutating track requests for large playlists`
2. `chore(desktop): align Windows test tooling and upgrade Vitest`
3. `fix(cache): validate track ids and parameterize bulk queries`
4. `security(electron): restrict navigation and renderer IPC`
5. `ci: run full Windows checks on dev pushes`
6. `ci(release): publish version-aware Windows builds from tags`
7. `chore: remove obsolete workflow and root npm lockfile`
8. `docs: record stability validation and v2.9 cache proposal`
