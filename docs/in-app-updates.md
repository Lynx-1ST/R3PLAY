# In-app Windows updates

Settings → Updates (also available from About) exposes Stable and Dev channels.
The choice persists in the Electron store independently of synced renderer settings.
Stable uses the GitHub latest feed; Dev uses the dev feed and permits prereleases.
Only versions newer than the running app are offered. Returning from Dev to Stable
waits for a newer stable version instead of downgrading the database.

The main process owns electron-updater and the fixed Lynx-1ST/R3PLAY feed. Trusted
main-window IPC exposes state and five operations: read, channel selection, check,
download, and explicit install. Renderer input cannot supply a URL or repository.
Concurrent checks/downloads are blocked and channel changes are locked during an
operation or after download. Downloads report progress and failures can be retried.
Automatic download and automatic installation on exit are disabled. Restart to
update starts the NSIS installer silently and relaunches the app. Windows may request
administrator permission because the existing installer installs per machine.

GitHub releases must contain their installer, blockmap and channel YAML generated
by the existing Windows release workflow. Updates still download installation data
(the updater can use differential downloads); users no longer download and launch
a setup executable manually. The older 2.9.4 application needs one manual install
of a release containing this feature before it can use this flow.

Unsigned builds do not declare a nonexistent signing publisher. If a signing
certificate is configured, electron-builder derives the publisher from it; the
updater's normal signature and SHA-512 verification remain enabled.

Support is currently limited to packaged Windows builds. Web, local development,
macOS and Linux display an unsupported message. Playback and settings are unchanged
until the user explicitly restarts. A downloaded update cannot switch channels;
restart without installing if a different channel is desired.

Validation: controller tests cover channel persistence, no downgrade, concurrency,
progress, manual install, retries, and unsupported environments. Component tests
cover manual controls, IPC failures, progress and stale snapshot ordering. Browser
checks exercise the whole Settings journey in light/dark themes at 1440 and 390 px
with simulated IPC. These tests do not prove a real install over a previous version;
that acceptance check needs a newer published release and an isolated installation.
