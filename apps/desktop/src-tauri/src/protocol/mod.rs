//! Handler du protocole `vyntra://`.
//!
//! Forme logique: `vyntra://<widget-id>/<path/in/archive>`
//! - Sur Linux/macOS, l'URI est telle quelle.
//! - Sur Windows, WebView2 réécrit en `http://vyntra.localhost/<widget-id>/<path>`.
//!
//! On parse via `Uri::host()` + `Uri::path()` pour être agnostique.

use tauri::{
    http::{Request, Response, StatusCode},
    Manager, UriSchemeContext, UriSchemeResponder,
};
use vyn_format::VynArchive;

use crate::state::AppState;

pub fn handler<R: tauri::Runtime>(
    ctx: UriSchemeContext<'_, R>,
    request: Request<Vec<u8>>,
    responder: UriSchemeResponder,
) {
    let state = ctx.app_handle().state::<AppState>().inner().clone();
    let uri = request.uri().clone();

    tauri::async_runtime::spawn(async move {
        let response = serve(&state, &uri);
        responder.respond(response);
    });
}

fn serve(state: &AppState, uri: &tauri::http::Uri) -> Response<Vec<u8>> {
    let host = uri.host().unwrap_or("");
    let raw_path = uri.path().trim_start_matches('/');

    // Sur Windows, WebView2 réécrit le custom protocol. Selon la version on a vu:
    //   - `http://vyntra.localhost/<id>/<asset>`
    //   - `vyntra://vyntra.localhost/<id>/<asset>`
    //   - `vyntra://localhost/<id>/<asset>`
    // Sur Linux/macOS, host = id du widget.
    let host_is_sentinel = host.is_empty()
        || host == "localhost"
        || host == "vyntra.localhost"
        || host.ends_with(".localhost");

    let (widget_id, asset_path) = if host_is_sentinel {
        match raw_path.split_once('/') {
            Some(parts) => parts,
            None => return not_found(),
        }
    } else {
        (host, raw_path)
    };

    tracing::debug!(uri = %uri, widget = %widget_id, asset = %asset_path, "vyntra:// request");

    if asset_path.is_empty() || asset_path.contains("..") {
        return not_found();
    }

    let (bytes, csp) = match state.widgets.get(widget_id) {
        Some(w) => {
            let csp = if asset_path.ends_with(".html") {
                Some(vyn_sandbox::build_csp(&w.manifest))
            } else {
                None
            };
            (w.archive_bytes.clone(), csp)
        }
        None => {
            tracing::warn!(widget = %widget_id, "widget not found in state");
            return not_found();
        }
    };

    let mut archive = match VynArchive::from_bytes(bytes.as_ref().clone()) {
        Ok(a) => a,
        Err(e) => {
            tracing::error!(err = %e, "failed to parse .vyn archive");
            return not_found();
        }
    };

    let file_bytes = match archive.read_file(asset_path) {
        Ok(b) => b,
        Err(e) => {
            tracing::warn!(asset = %asset_path, err = %e, "asset not in archive");
            return not_found();
        }
    };

    let mime = mime_for(asset_path);
    let mut builder = Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", mime)
        .header("Access-Control-Allow-Origin", "*")
        .header("Cache-Control", "no-cache");

    if let Some(csp) = csp {
        builder = builder.header("Content-Security-Policy", csp);
    }

    builder.body(file_bytes).unwrap()
}

fn not_found() -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(Vec::new())
        .unwrap()
}

fn mime_for(path: &str) -> &'static str {
    match path.rsplit_once('.').map(|(_, e)| e) {
        Some("js") => "application/javascript",
        Some("css") => "text/css",
        Some("json") => "application/json",
        Some("html") => "text/html",
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("webp") => "image/webp",
        Some("woff2") => "font/woff2",
        _ => "application/octet-stream",
    }
}