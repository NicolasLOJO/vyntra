//! Garde-fou IPC: chaque `Capability` mappe sur une permission du manifest.
//! Le runtime appelle `check()` avant d'exécuter une commande.

use thiserror::Error;
use vyn_manifest::{Manifest, Permissions};

#[derive(Debug, Error)]
pub enum SandboxError {
    #[error("widget `{widget}` lacks permission `{cap:?}`")]
    Denied { widget: String, cap: Capability },
}

/// Toutes les capacités exposées par le bridge `window.Vyn`.
/// Ajouter ici quand on ajoute un module au SDK.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Capability {
    System,
    Media,
    Launcher,
    Storage,
    UiEffects,
    Network,
}

impl Capability {
    fn allowed_by(&self, p: &Permissions) -> bool {
        match self {
            Capability::System => p.system,
            Capability::Media => p.media,
            Capability::Launcher => p.launcher,
            Capability::Storage => p.storage,
            Capability::UiEffects => p.ui_effects,
            Capability::Network => p.network,
        }
    }
}

/// Vérifie qu'un widget a déclaré la capacité requise.
pub fn check(manifest: &Manifest, cap: Capability) -> Result<(), SandboxError> {
    if cap.allowed_by(&manifest.permissions) {
        Ok(())
    } else {
        Err(SandboxError::Denied {
            widget: manifest.id.clone(),
            cap,
        })
    }
}

/// Génère le CSP à injecter dans la WebView pour un widget donné.
/// `connect-src` est restreint aux domaines listés dans `network.allow`.
pub fn build_csp(manifest: &Manifest) -> String {
    let connect_src = if manifest.permissions.network && !manifest.network.allow.is_empty() {
        manifest
            .network
            .allow
            .iter()
            .map(|d| format!("https://{d}"))
            .collect::<Vec<_>>()
            .join(" ")
    } else {
        "'none'".to_string()
    };

    format!(
        "default-src 'none'; \
         script-src 'self' vyntra:; \
         style-src 'self' vyntra: 'unsafe-inline'; \
         img-src 'self' vyntra: data:; \
         font-src 'self' vyntra: data:; \
         connect-src {connect_src}; \
         frame-ancestors 'self';"
    )
}
