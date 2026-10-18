#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::time::Duration;

struct ApiClient(reqwest::Client);

#[derive(serde::Serialize)]
struct ApiResponse {
    status: u16,
    body: String,
}

fn api_url(path: &str) -> Result<reqwest::Url, String> {
    // Only relative NetEase paths reach the fixed loopback backend. Never accept
    // a renderer-supplied host, redirect, credentials or arbitrary local port.
    if !path.starts_with('/') || path.starts_with("//") || path.contains('\\') {
        return Err("Expected a relative NetEase API path".into());
    }
    let base = reqwest::Url::parse("http://127.0.0.1:30001/").unwrap();
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
    let url = api_url(&path)?;
    let method = match method.as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        _ => return Err("Unsupported API method".into()),
    };
    let mut request = client
        .0
        .request(method, url)
        .timeout(Duration::from_millis(timeout_ms.clamp(1, 60_000)));
    if !cookie.is_empty() {
        request = request.header(reqwest::header::COOKIE, cookie);
    }
    if let Some(body) = body {
        request = request
            .header(reqwest::header::CONTENT_TYPE, "application/json")
            .body(body);
    }
    let response = request
        .send()
        .await
        .map_err(|_| "NetEase API unavailable. Start pnpm tauri:api on port 30001.")?;
    let status = response.status().as_u16();
    let body = response
        .text()
        .await
        .map_err(|_| "Cannot read NetEase API response")?;
    Ok(ApiResponse { status, body })
}

fn main() {
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .no_proxy()
        .build()
        .expect("Cannot initialize API client");
    tauri::Builder::default()
        .manage(ApiClient(client))
        .invoke_handler(tauri::generate_handler![netease_request])
        .run(tauri::generate_context!())
        .expect("Cannot run R3PLAYX Tauri");
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
        ] {
            assert!(api_url(path).is_err(), "accepted {path}");
        }
        let url = api_url("/song/detail?ids=123&cookie=a%3Db").unwrap();
        assert_eq!(
            url.as_str(),
            "http://127.0.0.1:30001/song/detail?ids=123&cookie=a%3Db"
        );
        assert_eq!(api_url("/../login").unwrap().host_str(), Some("127.0.0.1"));
    }
}
