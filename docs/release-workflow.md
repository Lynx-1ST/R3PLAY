# Windows development and stable releases

Use dev for ongoing work and release for stable preparation. Checks run on pushes
and pull requests to either branch. Packaging runs only when explicitly requested
for dev or when a stable version tag is pushed.

| Source  | Trigger                                            | GitHub release name   | Tag          | App version      | Update file |
| ------- | -------------------------------------------------- | --------------------- | ------------ | ---------------- | ----------- |
| dev     | Run workflow, revision 1                           | dev-2.9.0r1           | v2.9.0-dev.1 | 2.9.0-dev.1      | dev.yml     |
| dev     | Run workflow, revision 2                           | dev-2.9.0r2           | v2.9.0-dev.2 | 2.9.0-dev.2      | dev.yml     |
| release | Push v2.9.0 tag                                    | 2.9.0                 | v2.9.0       | 2.9.0            | latest.yml  |
| release | Push v2.9.1 or v2.10.0 tag after updating packages | Corresponding version | Matching tag | Matching version | latest.yml  |

Names follow the requested dev-X.Y.ZrN format. Tags and installed app versions use
SemVer so electron-builder and electron-updater can compare versions correctly.
Development releases are GitHub prereleases and never replace the latest stable
release. Stable clients continue to ignore them. Native update prompts open the
matched version's release page, including development versions.

## Publish a development build

In GitHub Actions, select **Publish dev Windows release**, select branch **dev**,
enter revision **1**, and run. Increment the revision for each release of that base
version. The workflow rejects zero, leading zeros, invalid or unsafe revision values,
and attempts to run from another branch. Existing release names/tags cannot be
silently overwritten. A tag that points elsewhere is rejected.

Keep committed package versions stable, e.g. 2.9.0. Only the CI checkout rewrites
root, desktop and web package versions to 2.9.0-dev.1 before building. It does not
commit this rewrite back to dev. Optional development-specific notes are read from
release-notes/dev-2.9.0r1.md; otherwise the matching stable notes are included with
a development heading and source commit.

## Publish a stable build

Update root, desktop, web and server package versions when preparing the next
version, and create release-notes/vX.Y.Z.md. Commit and push the reviewed state to
release, then create and push its matching vX.Y.Z tag. Merely pushing release
does not publish. The pipeline verifies that the tagged commit is an ancestor of
origin/release, that root/desktop/web versions agree, and that notes exist.

An existing published version is immutable under the normal publishing workflow.
Use **Rebuild existing stable Windows release** only when deliberately replacing
artifacts on an already existing stable release. It shares all checks and does not
allow creating a new release or rebuilding development prereleases.
Rebuilds expect the tagged checkout to contain this pipeline's metadata and test
scripts; old tags predating the pipeline are not supported by this entry point.

## Shared quality gates and limitations

All publishing entry points call windows-release.yml. It runs frozen installation,
typechecks, full web/desktop tests, audio-cache/Discord/network/release-metadata
tests, server/workspace builds, Windows x64 packaging, packaged runtime/startup
checks and artifact upload before GitHub publishing. Both installer and blockmap
are uploaded alongside the appropriate update metadata.

Sources: [GitHub reusable workflows](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows),
[electron-builder v26 publishing](https://www.electron.build/v26/docs/publish/).
The installed electron-updater GitHub provider also requires SemVer-compatible tags
when selecting prereleases; a literal dev-2.9.0r1 tag would not satisfy that parser.

The streaming audio-cache proposal remains deferred despite this application's
version bump to 2.9.0. Changing the release number does not imply implementing that
separate architectural change. Dependency audit and signing limitations remain
documented in dependency-security-followup.md.

Local validation for the 2.9.0 preparation: frozen install, web/desktop types,
146 existing tests, four release metadata tests, network regression, three-workspace
build and nine mocked release/tag guard cases passed. Development packaging with
an extraMetadata.version override generated 2.9.0-dev.1 installer metadata and
dev.yml with channel dev; this validates builder/channel behavior, while the CI
metadata fixtures separately verify rewriting all three package versions before
building. GitHub publishing and actual remote updater delivery were not exercised.
