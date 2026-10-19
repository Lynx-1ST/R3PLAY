#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod backend;

use backend::BackendService;
use std::{sync::Arc, time::Duration};
use tauri::Manager;

struct ApiClient {
    http: reqwest::Client,
    backend: Arc<BackendService>,
}

const MAX_REQUEST_BYTES: usize = 1024 * 1024;
const MAX_RESPONSE_BYTES: usize = 16 * 1024 * 1024;

#[derive(serde::Serialize)]
struct ApiResponse {
    status: u16,
    body: String,
}

fn api_url(path: &str, port: u16) -> Result<reqwest::Url, String> {
    // The renderer can choose an API path, never a host or local service port.
    if path.len() > 8192
        || !path.starts_with('/')
        || path.starts_with("//")
        || path.contains('\\')
        || path.chars().any(char::is_control)
        || path.contains('#')
    {
        return Err("Expected a relative NetEase API path".into());
    }
    let base = reqwest::Url::parse(&format!("http://127.0.0.1:{port}/")).unwrap();
    let url = base.join(path).map_err(|_| "Invalid API path")?;
    if url.origin() != base.origin() {
        return Err("API origin is not allowed".into());
    }
    Ok(url)
}

#[tauri::command]
async fn netease_request(
    client: tauri::State<'_, ApiClient>,
    path: String,
    method: String,
    body: Option<String>,
    cookie: String,
    timeout_ms: u64,
) -> Result<ApiResponse, String> {
    // Validate before starting a process or forwarding credentials.
    api_url(&path, 1)?;
    if body
        .as_ref()
        .is_some_and(|body| body.len() > MAX_REQUEST_BYTES)
        || cookie.len() > 32_768
    {
        return Err("NetEase API request is too large".into());
    }
    let method = match method.as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        _ => return Err("Unsupported API method".into()),
    };
    let backend = Arc::clone(&client.backend);
    let endpoint = tauri::async_runtime::spawn_blocking(move || backend.endpoint())
        .await
        .map_err(|_| "Music service startup was interrupted")??;
    let url = api_url(&path, endpoint.port)?;
    let mut request = client
        .http
        .request(method, url)
        .header("x-r3playx-backend-token", endpoint.token)
        .timeout(Duration::from_millis(timeout_ms.clamp(1, 60_000)));
    if !cookie.is_empty() {
        request = request.header(reqwest::header::COOKIE, cookie);
    }
    if let Some(body) = body {
        request = request
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .body(body);
    }
    let mut response = request
        .send()
        .await
        .map_err(|_| "Music service unavailable. Retry the action to reconnect.")?;
    let status = response.status().as_u16();
    if response
        .content_length()
        .is_some_and(|size| size > MAX_RESPONSE_BYTES as u64)
    {
        return Err("NetEase API response is too large".into());
    }
    let mut bytes = Vec::new();
    while let Some(chunk) = response
        .chunk()
        .await
        .map_err(|_| "Cannot read NetEase API response")?
    {
        if bytes.len().saturating_add(chunk.len()) > MAX_RESPONSE_BYTES {
            return Err("NetEase API response is too large".into());
        }
        bytes.extend_from_slice(&chunk);
    }
    let body = String::from_utf8(bytes).map_err(|_| "Invalid NetEase API response encoding")?;
    Ok(ApiResponse { status, body })
}

fn main() {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .no_proxy()
        .build()
        .expect("Cannot initialize API client");
    tauri::Builder::default()
        .setup(move |app| {
            let resources = app.path().resource_dir()?.join("backend");
            app.manage(ApiClient {
                http: client,
                backend: Arc::new(BackendService::new(resources, app.path().app_data_dir()?)),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![netease_request])
        .build(tauri::generate_context!())
        .expect("Cannot build R3PLAYX Tauri")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                app.state::<ApiClient>().backend.stop();
            }
        });
}

#[cfg(test)]
mod tests {
    use super::api_url;

    #[test]
    fn confines_requests_to_loopback() {
        for path in [
            "https://example.com/",
            "//example.com/",
            "/\\example.com/",
            "song/detail",
            "/\n//example.com/",
            "/song#fragment",
        ] {
            assert!(api_url(path, 41234).is_err(), "accepted {path}");
        }
        assert!(api_url(&format!("/{}", "x".repeat(8192)), 41234).is_err());
        let url = api_url("/song/detail?ids=123&cookie=a%3Db", 41234).unwrap();
        assert_eq!(
            url.as_str(),
            "http://127.0.0.1:41234/song/detail?ids=123&cookie=a%3Db"
        );
        assert_eq!(
            api_url("/../login", 41234).unwrap().host_str(),
            Some("127.0.0.1")
        );
    }
}
