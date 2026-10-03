# Dependency security follow-up — 2026-10-03

Continues the stability pass on `codex/fix-windows-runtime`. Application versions
remain unchanged. No push, tag, release, remote deletion or audio-cache refactor.
The user's four existing My-page edits are excluded from these commits, but are
present in the local build checkout and consequently its packaged artifact.

## Changes and compatibility

- Pin Electron to 43.5.0 so the build script's native ABI lookup and Windows
  electron-builder resolve the same version. See the
  [official release](https://github.com/electron/electron/releases/tag/v43.5.0).
- Raise Fastify to ^5.12.2 and Axios to ^1.20.0 in their existing workspace
  manifests. Both stay on the same major. References:
  [Fastify](https://github.com/fastify/fastify/releases/tag/v5.12.2),
  [Axios](https://github.com/axios/axios/releases/tag/v1.20.0).
- Keep fast-uri 3/4 and undici 6/7 on their respective major versions while
  pinning patched transitive versions (3.1.7/4.1.4 and 6.28.1/7.29.1).
- Override only get-uri 6's basic-ftp dependency to 6.2.1 in pnpm, and the same
  edge in the isolated runtime's npm graph. Preserve the runtime API and unblock
  package pins, independent npm lock and reproducible npm ci packaging.
  [The LIST parser advisory](https://github.com/advisories/GHSA-c475-qrg2-pj4r)
  identifies 6.2.1 as patched. This is a major upgrade from 5.x, deliberately
  scoped and tested. Version 6 rejects separate transfer hosts by default;
  no insecure compatibility option is enabled. See
  [the breaking-change notes](https://github.com/patrickjuchli/basic-ftp/releases/tag/v6.0.0).

## Regression and packaging verification

`packages/desktop/scripts/testNetworkDependencies.cjs` resolves through the real
NetEase API dependency graph, without mocked imports or external network servers.
Local ephemeral-port fixtures verify binary HTTP data, disabled redirect following,
HTTP PAC retrieval and DIRECT routing, and get-uri FTP download after failed MDTM
forces a LIST fallback. The fixture uses machine-readable listing facts with a
modification time, which get-uri requires. It is a compatibility check, not a
claim that every malformed FTP response or proxy configuration is covered.

Both dev-check and release workflows run `test:network`. The packaged Electron
runtime probe runs the same test against resources/runtime/node_modules, guarding
against a safe workspace lock accidentally shipping an unsafe isolated runtime.

Validation passed:

- Frozen pnpm 8.6.12 install and isolated runtime npm ci.
- Web and desktop typechecks; server build; all three workspace builds.
- 70 web tests, 65 desktop tests, six audio-cache tests and five Discord tests.
- Network regression against workspace, isolated runtime and packaged runtime.
- Windows x64 installer packaging with Electron 43.5.0 and --publish never.
- Packaged startup, SQLite, API, web page and download-validation smoke test.
- Changed CommonJS probes' ESLint, workflow YAML parsing and diff whitespace check.

Windows outputs remain under packages/desktop/release, including
R3PLAYX-2.8.9-win-x64-Setup.exe, blockmap, latest.yml and win-unpacked.
These are local development artifacts; signing and hosted CI are not verified.

## Remaining advisories

The full workspace pnpm audit reports zero critical, 27 high, 27 moderate and
two low entries, down from 56 high, 39 moderate and six low in the first pass.
The npm runtime and pnpm workspace counts overlap; do not add them together.
Local JSON snapshots are tmp/security-followup-audit.json and
tmp/security-followup-runtime-audit.json (ignored validation outputs).

Isolated runtime npm audit falls from five high entries to two high and zero
critical. Both remaining entries concern node-forge and its dependent API package;
they describe one underlying advisory, not two distinct vulnerabilities.

[Node-forge's signature-verification advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv)
has no published patched version at the time of this pass. Inspection of the API's
util/crypto.js finds public-key parsing and RSA encryption, without signature
verification in that module. That reduces the observed relevance of the reported
signature path; it is not proof that every transitive caller is unreachable.
Do not replace or vendor cryptography casually. Review upstream patch availability
again by 2026-10-10 and before any release.

The whole workspace still includes older build-tool and standalone-server
dependencies. Major upgrades of those trees need their own compatibility work;
this follow-up does not claim the dependency graph is security-clean.

Remaining high entries include braces, minimatch, music-metadata, postcss,
deepmerge-ts, @xmldom/xmldom, js-yaml, svgo, joi, brace-expansion, node-forge and
http-cache-semantics. Some have compatible patches; others need major upgrades or
have no published fix. Audit reachability and upgrade each parent deliberately
before a production release rather than applying broad forced major overrides.

Local follow-up implementation commit: `4a90128 security(deps): patch Windows
runtime and networking dependencies`.
