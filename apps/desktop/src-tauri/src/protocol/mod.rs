//! Handler du protocole `vyntra://`.
//!
//! Forme attendue: `vyntra://<widget-id>/<path/in/archive>`
//! Ex: `vyntra://com.acme.clock/bundle.js`
//!
//! Sert les fichiers directement depuis l'archive `.vyn` en mémoire,
//! sans serveur HTTP local.

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
        let response = serve(&state, &uri.to_string());
        responder.respond(response);
    });
}

fn serve(state: &AppState, uri: &str) -> Response<Vec<u8>> {
    // Parse `vyntra://<id>/<path>`
    let stripped = uri.trim_start_matches("vyntra://");
    let (widget_id, asset_path) = match stripped.split_once('/') {
        Some(parts) => parts,
        None => return not_found(),
    };

    let asset_path = asset_path.trim_start_matches('/');
    if asset_path.is_empty() || asset_path.contains("..") {
        return not_found();
    }

    let bytes = match state.widgets.get(widget_id) {
        Some(w) => w.archive_bytes.clone(),
        None => return not_found(),
    };

    // Recharge l'archive à chaque requête (à optimiser: cache de fichiers décompressés).
    let mut archive = match VynArchive::from_bytes(bytes.as_ref().clone()) {
        Ok(a) => a,
        Err(_) => return not_found(),
    };

    let file_bytes = match archive.read_file(asset_path) {
        Ok(b) => b,
        Err(_) => return not_found(),
    };

    let mime = mime_for(asset_path);
    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", mime)
        .header("Cache-Control", "no-cache")
        .body(file_bytes)
        .unwrap()
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
