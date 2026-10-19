use serde::Deserialize;
use std::{
    fs,
    io::{BufRead, BufReader, Read},
    path::PathBuf,
    process::{Child, ChildStdin, Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        mpsc, Mutex,
    },
    thread,
    time::Duration,
};

const STARTUP_TIMEOUT: Duration = Duration::from_secs(20);
const STARTUP_ERROR: &str =
    "Music service could not start. Restart R3PLAYX; if this persists, reinstall the preview.";

#[derive(Clone, Deserialize)]
pub struct Endpoint {
    pub port: u16,
    pub token: String,
}

impl Endpoint {
    fn parse(line: &[u8]) -> Result<Self, String> {
        let endpoint: Self = serde_json::from_slice(line).map_err(|_| STARTUP_ERROR)?;
        if endpoint.port == 0
            || endpoint.token.len() != 64
            || !endpoint.token.bytes().all(|byte| byte.is_ascii_hexdigit())
        {
            return Err(STARTUP_ERROR.into());
        }
        Ok(endpoint)
    }
}

struct Backend {
    child: Child,
    input: Option<ChildStdin>,
    endpoint: Option<Endpoint>,
}

impl Drop for Backend {
    fn drop(&mut self) {
        // EOF lets the helper close gracefully; a hung helper is still reaped.
        self.input.take();
        for _ in 0..20 {
            if matches!(self.child.try_wait(), Ok(Some(_))) {
                return;
            }
            thread::sleep(Duration::from_millis(25));
        }
        let _ = self.child.kill();
        let _ = self.child.wait();
    }
}

pub struct BackendService {
    resources: PathBuf,
    data_dir: PathBuf,
    process: Mutex<Option<Backend>>,
    stopped: AtomicBool,
}

impl BackendService {
    pub fn new(resources: PathBuf, data_dir: PathBuf) -> Self {
        Self {
            // Tauri may return Windows namespaced paths (\\?\C:\...). Node's
            // CommonJS entry-point loader rejects these even though Rust can
            // spawn the executable, so normalize every path passed to Node.
            resources: dunce::simplified(&resources).to_path_buf(),
            data_dir: dunce::simplified(&data_dir).to_path_buf(),
            process: Mutex::new(None),
            stopped: AtomicBool::new(false),
        }
    }

    pub fn endpoint(&self) -> Result<Endpoint, String> {
        let mut process = self.process.lock().map_err(|_| STARTUP_ERROR)?;
        if self.stopped.load(Ordering::Acquire) {
            return Err("Music service is shutting down".into());
        }
        if let Some(backend) = process.as_mut() {
            if matches!(backend.child.try_wait(), Ok(None)) {
                return backend.endpoint.clone().ok_or_else(|| STARTUP_ERROR.into());
            }
        }
        process.take();
        fs::create_dir_all(&self.data_dir).map_err(|_| STARTUP_ERROR)?;
        let mut command = Command::new(self.resources.join("node.exe"));
        command
            .arg(self.resources.join("backend.cjs"))
            .current_dir(&self.data_dir)
            .env("R3PLAYX_DATA_DIR", &self.data_dir)
            .env("NODE_ENV", "production")
            .env_remove("NODE_OPTIONS")
            .env_remove("NODE_PATH")
            .env_remove("R3PLAYX_API_MODULE")
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            command.creation_flags(0x08000000); // CREATE_NO_WINDOW
        }
        let child = command.spawn().map_err(|_| STARTUP_ERROR)?;
        let mut backend = Backend {
            child,
            input: None,
            endpoint: None,
        };
        backend.input = backend.child.stdin.take();
        let output = backend.child.stdout.take().ok_or(STARTUP_ERROR)?;
        let (sender, receiver) = mpsc::sync_channel(1);
        thread::spawn(move || {
            let mut line = Vec::new();
            let result = BufReader::new(output)
                .take(4097)
                .read_until(b'\n', &mut line)
                .map_err(|_| STARTUP_ERROR.to_string())
                .and_then(|size| {
                    if size > 4096 || !line.ends_with(b"\n") {
                        return Err(STARTUP_ERROR.into());
                    }
                    Endpoint::parse(&line)
                });
            let _ = sender.send(result);
        });
        let endpoint = receiver
            .recv_timeout(STARTUP_TIMEOUT)
            .map_err(|_| STARTUP_ERROR)??;
        if !matches!(backend.child.try_wait(), Ok(None)) {
            return Err(STARTUP_ERROR.into());
        }
        backend.endpoint = Some(endpoint.clone());
        *process = Some(backend);
        Ok(endpoint)
    }

    pub fn stop(&self) {
        self.stopped.store(true, Ordering::Release);
        if let Ok(mut process) = self.process.lock() {
            process.take();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::{BackendService, Endpoint};
    use std::path::PathBuf;

    #[test]
    fn validates_private_backend_handshake() {
        let token = "ab".repeat(32);
        let endpoint =
            Endpoint::parse(format!(r#"{{"port":41234,"token":"{token}"}}"#).as_bytes()).unwrap();
        assert_eq!(endpoint.port, 41234);
        assert_eq!(endpoint.token, token);
        for line in [
            r#"{"port":0,"token":"abc"}"#,
            r#"{"port":65536,"token":"abc"}"#,
            r#"{"port":41234}"#,
            r#"not json"#,
        ] {
            assert!(Endpoint::parse(line.as_bytes()).is_err());
        }
        for token in ["aa".repeat(31), "xx".repeat(32)] {
            assert!(
                Endpoint::parse(format!(r#"{{"port":41234,"token":"{token}"}}"#).as_bytes())
                    .is_err()
            );
        }
    }

    #[test]
    fn does_not_spawn_a_service_after_shutdown() {
        let service = BackendService::new(PathBuf::new(), PathBuf::new());
        service.stop();
        assert_eq!(
            service.endpoint().err().unwrap(),
            "Music service is shutting down"
        );
    }

    #[test]
    fn supervises_start_crash_restart_and_shutdown() {
        use std::{
            fs,
            net::TcpStream,
            time::{SystemTime, UNIX_EPOCH},
        };

        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        let root = std::env::temp_dir().join(format!(
            "r3playx-supervisor-{}-{unique}",
            std::process::id()
        ));
        let resources = root.join("backend");
        let data = root.join("data");
        fs::create_dir_all(&resources).unwrap();
        fs::create_dir_all(&data).unwrap();
        let node = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources/backend/node.exe");
        assert!(
            node.is_file(),
            "Run pnpm --filter tauri-desktop prepare:backend before Rust tests"
        );
        fs::hard_link(&node, resources.join("node.exe"))
            .or_else(|_| fs::copy(&node, resources.join("node.exe")).map(|_| ()))
            .unwrap();
        fs::write(
            resources.join("backend.cjs"),
            r#"
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const token = require('node:crypto').randomBytes(32).toString('hex');
const server = http.createServer((_, response) => response.end('ready'));
server.listen(0, '127.0.0.1', () => {
  process.stdout.write(JSON.stringify({port: server.address().port, token}) + '\n');
});
process.stdin.on('end', () => server.close(() => {
  fs.writeFileSync(path.join(process.env.R3PLAYX_DATA_DIR, 'stopped'), 'yes');
  process.exit(0);
}));
process.stdin.resume();
"#,
        )
        .unwrap();
        // canonicalize() produces the same Windows \\?\ prefix that Tauri's
        // installed resource resolver may return. Plain paths miss this bug.
        let service = BackendService::new(
            resources.canonicalize().unwrap(),
            data.canonicalize().unwrap(),
        );
        let first = service.endpoint().unwrap();
        assert!(TcpStream::connect(("127.0.0.1", first.port)).is_ok());
        assert_eq!(service.endpoint().unwrap().token, first.token);
        {
            let mut process = service.process.lock().unwrap();
            let backend = process.as_mut().unwrap();
            backend.child.kill().unwrap();
            backend.child.wait().unwrap();
        }
        let second = service.endpoint().unwrap();
        assert_ne!(second.token, first.token);
        assert!(TcpStream::connect(("127.0.0.1", second.port)).is_ok());
        service.stop();
        assert!(
            data.join("stopped").is_file(),
            "helper did not receive parent EOF"
        );
        assert!(TcpStream::connect(("127.0.0.1", second.port)).is_err());
        assert!(service.endpoint().is_err());

        fs::remove_file(data.join("stopped")).unwrap();
        fs::write(
            resources.join("backend.cjs"),
            r#"
const fs = require('node:fs');
const path = require('node:path');
process.stdin.on('end', () => {
  fs.writeFileSync(path.join(process.env.R3PLAYX_DATA_DIR, 'stopped'), 'yes');
  process.exit(0);
});
process.stdin.resume();
process.stdout.write('invalid readiness\n');
"#,
        )
        .unwrap();
        let failed_service = BackendService::new(resources, data.clone());
        assert!(failed_service.endpoint().is_err());
        assert!(
            data.join("stopped").is_file(),
            "failed startup leaked its child"
        );
        drop(failed_service);
        drop(service);
        fs::remove_dir_all(root).unwrap();
    }
}
