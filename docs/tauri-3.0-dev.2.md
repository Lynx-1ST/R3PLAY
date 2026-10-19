# R3PLAYX 3.0.0-dev.2

Fix Windows startup of the bundled music service. Tauri can resolve installed
resources through Windows namespaced paths (`\\?\C:\...`). Passing those paths
as Node's CommonJS entry point causes Node 22 to exit with `EISDIR ... lstat C:`
before sending its readiness message. The desktop then shows a blank login QR
and "Music service could not start" for login requests.

Normalize resource and application-data paths with `dunce::simplified` before
passing them to Node. The Rust supervisor regression test now uses canonicalized
paths so Windows CI exercises this installed-path case, including backend
startup, crash recovery and shutdown.

The installed Node/backend was independently checked with ordinary Windows
paths: live `/login/qr/key` returned HTTP 200 and a nonempty QR key. Generating
the QR key does not log in to an account. Final verification must also inspect
the QR in the updated native application.

Install the dev.2 preview over the previous Tauri preview. No data reset or
uninstall is needed.
